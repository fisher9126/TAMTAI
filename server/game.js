'use strict';
/* Online world: who is connected, position sync, saves, chat, friends, mail (gifts), moderation. */
const db = require('./db');
const items = require('../public/js/items.js');
const rules = require('../public/js/rules.js');
const world = require('./world');

const online = new Map(); // userId -> player
const TICK_MS = 100;
const WORLD_R = 108;
const SPAWN = { x: 1, z: 9 };
const J = JSON.stringify;
const now = () => Date.now();

/* ---------- helpers ---------- */
function int(v, min, max, def) { v = Math.round(Number(v)); return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def; }
function num(v, min, max, def) { v = Number(v); return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def; }
function send(p, msg) { if (p && p.ws && !p.ws.closed) p.ws.send(typeof msg === 'string' ? msg : J(msg)); }
function broadcast(msg, exceptId) { const s = J(msg); online.forEach((p) => { if (p.id !== exceptId) send(p, s); }); }
function userByName(name) { return db.get('SELECT id, username, role FROM users WHERE username = ?', String(name || '').trim()); }
function logAdmin(adminId, action, targetId, detail) {
  db.run('INSERT INTO admin_log (admin_id, action, target_id, detail, created_at) VALUES (?, ?, ?, ?, ?)', adminId || null, action, targetId || null, detail ? String(detail).slice(0, 500) : null, now());
}

const BAD_WORDS = ['đm', 'dm', 'đmm', 'dmm', 'vcl', 'vkl', 'vl', 'đéo', 'địt', 'đụ', 'lồn', 'cặc', 'dcm', 'đcm', 'clm', 'cmm', 'fuck', 'shit', 'bitch'];
const BAD_RE = new RegExp('(?<![\\p{L}\\p{N}])(' + BAD_WORDS.join('|') + ')(?![\\p{L}\\p{N}])', 'giu');
function cleanText(t) { return String(t || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200).replace(BAD_RE, (m) => '*'.repeat(m.length)); }

/* ---------- saves ---------- */
function freshData() {
  return { level: 1, exp: 0, gold: 0, potions: 5, inv: [], eq: { weapon: items.makeItem('weapon', 'common', 1, 'Kiếm Gỗ Sồi'), helmet: null, armor: null, boots: null, cape: null }, quest: 0, qcount: 0, seenIntro: false };
}
function sanitizeSave(d, prev, allowGold) {
  if (!d || typeof d !== 'object') return null;
  const out = {};
  out.level = int(d.level, 1, 60, 1);
  const warn = [];
  if (prev && out.level > prev.level + 5) { warn.push('cấp ' + prev.level + '→' + out.level); out.level = prev.level + 5; }
  out.exp = int(d.exp, 0, 1e9, 0);
  out.gold = int(d.gold, 0, 1e9, 0);
  if (prev && out.gold > prev.gold + 50000 + (allowGold || 0)) warn.push('vàng ' + prev.gold + '→' + out.gold);
  out.potions = int(d.potions, 0, 999, 0);
  out.inv = (Array.isArray(d.inv) ? d.inv : []).slice(0, 24).map(items.validItem).filter(Boolean);
  out.eq = {};
  items.SLOTS.forEach((s) => { const it = d.eq && d.eq[s] ? items.validItem(d.eq[s]) : null; out.eq[s] = it && it.slot === s ? it : null; });
  out.quest = int(d.quest, 0, 3, 0);
  out.qcount = int(d.qcount, 0, 100, 0);
  out.seenIntro = !!d.seenIntro;
  return { data: out, warn };
}
function lookOf(data) { const eq = {}; items.SLOTS.forEach((s) => { eq[s] = data && data.eq && data.eq[s] ? data.eq[s].rarity : null; }); return eq; }
function loadChar(userId) {
  const r = db.get('SELECT data, x, z FROM characters WHERE user_id = ?', userId);
  if (!r) return null;
  try { return { data: JSON.parse(r.data), x: r.x, z: r.z }; } catch (e) { return null; }
}
function storeChar(userId, data, x, z, addSeconds) {
  const s = J(data);
  db.run(`INSERT INTO characters (user_id, data, level, gold, x, z, play_seconds, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, level = excluded.level, gold = excluded.gold, x = excluded.x, z = excluded.z,
          play_seconds = characters.play_seconds + ?, updated_at = excluded.updated_at`,
  userId, s, data.level, data.gold, x, z, addSeconds || 0, now(), addSeconds || 0);
}

/* ---------- friends ---------- */
function friendList(userId) {
  const rows = db.all(`SELECT f.friend_id AS id, u.username AS name, f.status, 'out' AS dir FROM friends f JOIN users u ON u.id = f.friend_id WHERE f.user_id = ?
                       UNION ALL
                       SELECT f.user_id AS id, u.username AS name, f.status, 'in' AS dir FROM friends f JOIN users u ON u.id = f.user_id WHERE f.friend_id = ? AND f.status = 'pending'`, userId, userId);
  return rows.map((r) => {
    const o = online.get(r.id);
    return { name: r.name, status: r.status === 'accepted' ? 'friend' : r.dir === 'in' ? 'incoming' : 'outgoing', online: !!o, level: o ? o.level : null };
  });
}
function pushFriends(userId) { const p = online.get(userId); if (p) send(p, { t: 'friends', list: friendList(userId) }); }
function friendIds(userId) { return db.all("SELECT friend_id AS id FROM friends WHERE user_id = ? AND status = 'accepted'", userId).map((r) => r.id); }
function onFriend(p, m) {
  const target = userByName(m.name);
  const op = m.op;
  if (!target) return sys(p, 'Không tìm thấy người chơi "' + cleanText(m.name) + '".');
  if (target.id === p.id) return sys(p, 'Bạn không thể kết bạn với chính mình.');
  const mine = db.get('SELECT status FROM friends WHERE user_id = ? AND friend_id = ?', p.id, target.id);
  const theirs = db.get('SELECT status FROM friends WHERE user_id = ? AND friend_id = ?', target.id, p.id);
  if (op === 'add') {
    if (mine && mine.status === 'accepted') return sys(p, target.username + ' đã là bạn của bạn.');
    if (theirs && theirs.status === 'pending') return onFriend(p, { op: 'accept', name: target.username });
    if (mine) return sys(p, 'Đã gửi lời mời cho ' + target.username + ' rồi, đang chờ đồng ý.');
    if (db.get("SELECT COUNT(*) AS n FROM friends WHERE user_id = ? AND status = 'accepted'", p.id).n >= 100) return sys(p, 'Danh sách bạn bè đã đủ 100 người.');
    db.run("INSERT INTO friends (user_id, friend_id, status, created_at) VALUES (?, ?, 'pending', ?)", p.id, target.id, now());
    sys(p, 'Đã gửi lời mời kết bạn tới ' + target.username + '.');
    const t = online.get(target.id); if (t) sys(t, p.name + ' muốn kết bạn với bạn. Mở bảng Bạn bè để đồng ý.');
  } else if (op === 'accept') {
    if (!theirs || theirs.status !== 'pending') return sys(p, 'Không có lời mời nào từ ' + target.username + '.');
    db.tx(() => {
      db.run("UPDATE friends SET status = 'accepted' WHERE user_id = ? AND friend_id = ?", target.id, p.id);
      db.run("INSERT OR REPLACE INTO friends (user_id, friend_id, status, created_at) VALUES (?, ?, 'accepted', ?)", p.id, target.id, now());
    });
    sys(p, 'Bạn và ' + target.username + ' đã là bạn bè.');
    const t = online.get(target.id); if (t) sys(t, p.name + ' đã đồng ý kết bạn.');
  } else if (op === 'decline' || op === 'remove') {
    db.run('DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)', p.id, target.id, target.id, p.id);
    sys(p, op === 'remove' ? 'Đã xóa ' + target.username + ' khỏi danh sách bạn bè.' : 'Đã từ chối lời mời.');
  } else return;
  pushFriends(p.id); pushFriends(target.id);
}

/* ---------- player economy (server is the authority) ---------- */
function pushMe(p) {
  p.saveDirty = true;
  send(p, { t: 'me', data: p.data });
  const look = lookOf(p.data);
  if (J(look) !== J(p.eq) || p.level !== p.data.level) {
    const lvChanged = p.level !== p.data.level;
    p.eq = look; p.level = p.data.level;
    broadcast({ t: 'look', id: p.id, eq: p.eq, level: p.level }, p.id);
    if (lvChanged) friendIds(p.id).forEach(pushFriends);
  }
}
function addExp(p, n) {
  const d = p.data; let up = 0;
  d.exp += n;
  while (d.level < rules.MAX_LEVEL && d.exp >= rules.expNeed(d.level)) { d.exp -= rules.expNeed(d.level); d.level++; up++; }
  if (d.level >= rules.MAX_LEVEL) d.exp = Math.min(d.exp, rules.expNeed(d.level));
  return up;
}
function questProgress(p, type) {
  const d = p.data; const q = rules.QUESTS[d.quest];
  if (!q || !q.type || q.type !== type) return;
  d.qcount++;
  if (d.qcount < q.need) return;
  const r = q.reward || {}; const got = [];
  if (r.gold) { d.gold += r.gold; got.push(r.gold + ' vàng'); }
  if (r.potions) { d.potions += r.potions; got.push(r.potions + ' bình máu'); }
  let item = null;
  if (r.rarity && d.inv.length < rules.INV_SIZE) { item = items.makeItem(items.SLOTS[Math.floor(Math.random() * 5)], r.rarity, d.level); d.inv.push(item); }
  d.quest = Math.min(d.quest + 1, rules.QUESTS.length - 1); d.qcount = 0;
  const up = r.exp ? addExp(p, r.exp) : 0;
  send(p, { t: 'quest', done: q.title, exp: r.exp || 0, rewards: got, item, levelUp: up ? d.level : null, next: d.quest });
}
let lootSeq = 1;
function giveLoot(p, e) {
  const list = [];
  const add = (kind, item) => {
    const a = Math.random() * 6.283, r = Math.random() * 1.4;
    const l = { id: lootSeq++, x: +(e.x + Math.cos(a) * r).toFixed(2), z: +(e.z + Math.sin(a) * r).toFixed(2), kind, item, until: now() + 180000 };
    p.loots.set(l.id, l); list.push({ id: l.id, x: l.x, z: l.z, kind, rarity: item ? item.rarity : null });
  };
  const slot = () => items.SLOTS[Math.floor(Math.random() * items.SLOTS.length)];
  if (e.d.boss) {
    add('item', items.makeItem(slot(), 'legend', e.lv));
    add('item', items.makeItem(slot(), Math.random() < 0.5 ? 'epic' : 'legend', e.lv));
    add('potion');
  } else {
    if (Math.random() < e.d.drop) add('item', items.makeItem(slot(), items.rollRarity(e.d.bonus || 0), e.lv));
    if (Math.random() < 0.16) add('potion');
  }
  if (list.length) send(p, { t: 'loot', list });
}
function onKill(e, contributors) {
  contributors.forEach((p) => {
    const exp = e.d.exp + e.lv * 2, gold = world.randi(e.d.gold[0], e.d.gold[1]);
    p.data.gold += gold;
    const up = addExp(p, exp);
    send(p, { t: 'reward', e: e.id, x: e.x, z: e.z, exp, gold, levelUp: up ? p.data.level : null });
    questProgress(p, e.type);
    giveLoot(p, e);
    pushMe(p);
  });
}
function onPick(p, m) {
  const l = p.loots.get(int(m.id, 1, 1e12, 0)); if (!l) return;
  if (Math.hypot(p.x - l.x, p.z - l.z) > 3.2) return;
  const d = p.data;
  if (l.kind === 'item' && d.inv.length >= rules.INV_SIZE) { send(p, { t: 'pickfail', id: l.id }); return sys(p, 'Túi đồ đã đầy. Bán bớt đồ trong túi (phím I) để nhặt thêm.'); }
  p.loots.delete(l.id);
  if (l.kind === 'potion') d.potions = Math.min(999, d.potions + 1); else d.inv.push(l.item);
  send(p, { t: 'picked', id: l.id, kind: l.kind, item: l.item || null });
  pushMe(p);
}
function onEquip(p, m) {
  const d = p.data; const i = d.inv.findIndex((x) => x.id === m.id); if (i < 0) return;
  const it = d.inv[i]; const old = d.eq[it.slot];
  d.inv.splice(i, 1); d.eq[it.slot] = it; if (old) d.inv.splice(i, 0, old);
  pushMe(p);
}
function onUnequip(p, m) {
  const d = p.data; if (!items.SLOTS.includes(m.slot) || !d.eq[m.slot]) return;
  if (d.inv.length >= rules.INV_SIZE) return sys(p, 'Túi đồ đã đầy.');
  d.inv.push(d.eq[m.slot]); d.eq[m.slot] = null; pushMe(p);
}
function onSell(p, m) {
  const d = p.data; const i = d.inv.findIndex((x) => x.id === m.id); if (i < 0) return;
  const it = d.inv.splice(i, 1)[0]; d.gold += items.itemValue(it);
  send(p, { t: 'sold', name: it.name, gold: items.itemValue(it) });
  pushMe(p); deliverMail(p);
}
function onPotion(p) {
  const d = p.data; const t = now();
  if (d.potions <= 0 || (p.potCd || 0) > t + 150) return send(p, { t: 'potion', ok: false });
  p.potCd = t + rules.POTION_CD * 1000; d.potions--; send(p, { t: 'potion', ok: true }); pushMe(p);
}

/* ---------- mail / gifts (delivered straight into the save when there is room) ---------- */
function pendingMail(userId) {
  return db.all('SELECT id, from_name, message, payload, created_at FROM mail WHERE user_id = ? AND claimed_at IS NULL ORDER BY id LIMIT 50', userId)
    .map((r) => ({ id: r.id, from: r.from_name, message: r.message, payload: JSON.parse(r.payload), at: r.created_at }));
}
function deliverMail(p) {
  const list = pendingMail(p.id); if (!list.length) return;
  let changed = false;
  list.forEach((ml) => {
    const its = (ml.payload.items || []).map(items.validItem).filter(Boolean);
    if (p.data.inv.length + its.length > rules.INV_SIZE) { if (!p.mailWarned) { p.mailWarned = true; sys(p, 'Bạn có quà từ ' + ml.from + ' nhưng túi đồ đầy. Bán bớt đồ để nhận.'); } return; }
    const r = db.run('UPDATE mail SET claimed_at = ? WHERE id = ? AND claimed_at IS NULL', now(), ml.id);
    if (r.changes !== 1) return;
    p.data.gold += ml.payload.gold || 0; p.data.potions += ml.payload.potions || 0; its.forEach((it) => p.data.inv.push(it));
    send(p, { t: 'gift', from: ml.from, message: ml.message, payload: Object.assign({}, ml.payload, { items: its }) });
    changed = true;
  });
  if (changed) { p.mailWarned = false; pushMe(p); }
}
function sendMail(userIds, fromName, message, payload) {
  const s = J(payload); const t = now(); let n = 0;
  db.tx(() => { userIds.forEach((id) => { db.run('INSERT INTO mail (user_id, from_name, message, payload, created_at) VALUES (?, ?, ?, ?, ?)', id, fromName, message, s, t); n++; }); });
  userIds.forEach((id) => { const p = online.get(id); if (p) deliverMail(p); });
  return n;
}
function buildGift(spec) {
  const out = { gold: int(spec.gold, 0, 1e7, 0), potions: int(spec.potions, 0, 100, 0), items: [] };
  (Array.isArray(spec.items) ? spec.items : []).slice(0, 10).forEach((it) => {
    const slot = items.SLOTS.includes(it.slot) ? it.slot : items.SLOTS[Math.floor(Math.random() * items.SLOTS.length)];
    const rarity = items.RAR.includes(it.rarity) ? it.rarity : 'rare';
    out.items.push(items.makeItem(slot, rarity, int(it.level, 1, 60, 1)));
  });
  return out;
}

/* ---------- connections ---------- */
function sys(p, text) { send(p, { t: 'sys', text }); }
function pub(p) { return { id: p.id, name: p.name, role: p.role, level: p.level, x: +p.x.toFixed(2), z: +p.z.toFixed(2), f: +p.f.toFixed(2), anim: p.anim, eq: p.eq }; }

function connect(ws, user) {
  const old = online.get(user.id);
  if (old) { send(old, { t: 'kicked', reason: 'Tài khoản vừa đăng nhập ở một nơi khác.' }); old.ws.close(4000, 'replaced'); removeOnline(old); }
  let ch = loadChar(user.id);
  if (!ch) { const d = freshData(); storeChar(user.id, d, SPAWN.x, SPAWN.z, 0); ch = { data: d, x: SPAWN.x, z: SPAWN.z }; }
  const clean = sanitizeSave(ch.data, null); if (clean) ch.data = clean.data;
  const p = { id: user.id, name: user.username, role: user.role, ws, x: ch.x, z: ch.z, f: Math.PI, anim: 0, eq: lookOf(ch.data), level: ch.data.level,
    data: ch.data, lastState: now(), dirty: true, joinedAt: now(), lastSaveAt: now(), rate: [], chatTimes: [], mutedUntil: user.muted_until || 0,
    dead: false, loots: new Map(), cd: {}, saveDirty: false };
  online.set(user.id, p);
  send(p, { t: 'hello', you: { id: p.id, name: p.name, role: p.role }, data: ch.data, pos: { x: p.x, z: p.z },
    players: [...online.values()].filter((o) => o.id !== p.id).map(pub), enemies: world.snapshot(), friends: friendList(p.id), online: online.size,
    motd: process.env.MOTD || 'Chào mừng tới Aetherfall! Gõ /help trong khung chat để xem lệnh.' });
  broadcast({ t: 'join', p: pub(p), online: online.size }, p.id);
  friendIds(p.id).forEach(pushFriends);
  deliverMail(p);
  ws.on('message', (m) => onMessage(p, m));
  ws.on('close', () => { if (online.get(p.id) === p) removeOnline(p); });
}
function removeOnline(p) {
  if (online.get(p.id) !== p) return;
  online.delete(p.id);
  const secs = Math.round((now() - p.lastSaveAt) / 1000);
  try { storeChar(p.id, p.data, p.x, p.z, secs); } catch (e) { console.error('save on leave failed', e.message); }
  broadcast({ t: 'leave', id: p.id, online: online.size });
  friendIds(p.id).forEach(pushFriends);
}

function onMessage(p, raw) {
  const t0 = now();
  p.rate = p.rate.filter((t) => t0 - t < 1000); p.rate.push(t0);
  if (p.rate.length > 40) { if (p.rate.length === 41) sys(p, 'Bạn đang gửi quá nhiều dữ liệu.'); return; }
  let m; try { m = JSON.parse(raw); } catch (e) { return; }
  if (!m || typeof m.t !== 'string') return;
  switch (m.t) {
    case 'state': return onState(p, m);
    case 'hit': return world.playerHit(p, String(m.kind), m.combo, m.ids, rules.playerStats(p.data));
    case 'pick': return onPick(p, m);
    case 'equip': return onEquip(p, m);
    case 'unequip': return onUnequip(p, m);
    case 'sell': return onSell(p, m);
    case 'potion': return onPotion(p);
    case 'intro': if (!p.data.seenIntro) { p.data.seenIntro = true; p.saveDirty = true; } return;
    case 'chat': return onChat(p, m);
    case 'friend': return onFriend(p, m);
    case 'friends': return send(p, { t: 'friends', list: friendList(p.id) });
    case 'report': return onReport(p, m);
    case 'ping': return send(p, { t: 'pong', at: m.at, online: online.size });
    default: return;
  }
}
function onState(p, m) {
  const t = now(); const dt = Math.max(0.05, (t - p.lastState) / 1000); p.lastState = t;
  let x = num(m.x, -WORLD_R, WORLD_R, p.x), z = num(m.z, -WORLD_R, WORLD_R, p.z);
  const d = Math.hypot(x - p.x, z - p.z), max = 24 * Math.min(dt, 2) + 1.5;
  const respawn = m.respawn === true && Math.hypot(x - SPAWN.x, z - SPAWN.z) < 2;
  if (d > max && !respawn) { send(p, { t: 'correct', x: p.x, z: p.z }); return; }
  const r = Math.hypot(x, z); if (r > WORLD_R) { x *= WORLD_R / r; z *= WORLD_R / r; }
  p.x = x; p.z = z; p.f = num(m.f, -1000, 1000, p.f) % (Math.PI * 2); p.anim = int(m.anim, 0, 9, 0); p.dirty = true;
  p.dead = p.anim === 5;
}
function onChat(p, m) {
  const text = cleanText(m.text);
  if (!text) return;
  const t = now();
  const u = db.get('SELECT muted_until FROM users WHERE id = ?', p.id); p.mutedUntil = u ? u.muted_until : 0;
  if (p.mutedUntil > t) return sys(p, 'Bạn đang bị cấm chat thêm ' + Math.ceil((p.mutedUntil - t) / 60000) + ' phút.');
  p.chatTimes = p.chatTimes.filter((x) => t - x < 6000); p.chatTimes.push(t);
  if (p.chatTimes.length > 5) return sys(p, 'Bạn chat nhanh quá, đợi vài giây nhé.');
  if (m.ch === 'whisper') {
    const target = userByName(m.to); const o = target && online.get(target.id);
    if (!o) return sys(p, 'Người chơi "' + cleanText(m.to) + '" không online.');
    if (o.id === p.id) return;
    send(o, { t: 'chat', ch: 'whisper', from: p.name, text });
    send(p, { t: 'chat', ch: 'whisper', from: p.name, to: o.name, text });
    db.run('INSERT INTO chat_log (user_id, channel, target, text, created_at) VALUES (?, ?, ?, ?, ?)', p.id, 'whisper', o.name, text, t);
    return;
  }
  broadcast({ t: 'chat', ch: 'world', from: p.name, role: p.role, text });
  db.run('INSERT INTO chat_log (user_id, channel, target, text, created_at) VALUES (?, ?, ?, ?, ?)', p.id, 'world', null, text, t);
}
function onReport(p, m) {
  const target = userByName(m.name);
  if (!target || target.id === p.id) return sys(p, 'Không tìm thấy người chơi để báo cáo.');
  const reason = cleanText(m.reason) || 'Không ghi lý do';
  const recent = db.get('SELECT COUNT(*) AS n FROM reports WHERE reporter_id = ? AND created_at > ?', p.id, now() - 3600e3).n;
  if (recent >= 10) return sys(p, 'Bạn đã gửi nhiều báo cáo trong một giờ. Đợi một chút nhé.');
  db.run('INSERT INTO reports (reporter_id, target_id, reason, created_at) VALUES (?, ?, ?, ?)', p.id, target.id, reason, now());
  sys(p, 'Đã gửi báo cáo về ' + target.username + '. Cảm ơn bạn.');
}

/* ---------- tick ---------- */
setInterval(() => {
  const list = [];
  online.forEach((p) => { if (p.dirty) { p.dirty = false; list.push([p.id, +p.x.toFixed(2), +p.z.toFixed(2), +p.f.toFixed(2), p.anim]); } });
  if (list.length) broadcast({ t: 'states', list });
}, TICK_MS).unref();
setInterval(() => {
  const t = now();
  online.forEach((p) => {
    if (t - p.ws.lastSeen > 70000) { p.ws.close(4001, 'timeout'); removeOnline(p); }
    else p.ws.ping();
  });
}, 20000).unref();
setInterval(() => {
  const t = now();
  online.forEach((p) => {
    if (p.saveDirty) { p.saveDirty = false; const secs = Math.round((t - p.lastSaveAt) / 1000); p.lastSaveAt = t; try { storeChar(p.id, p.data, p.x, p.z, secs); } catch (e) { console.error('save failed', e.message); } }
    const gone = []; p.loots.forEach((l) => { if (l.until < t) { p.loots.delete(l.id); gone.push(l.id); } });
    if (gone.length) send(p, { t: 'lootgone', ids: gone });
  });
}, 5000).unref();
world.init({ online, send, broadcast, onKill });

/* ---------- moderation API (used by admin routes) ---------- */
function kick(userId, reason) {
  const p = online.get(userId); if (!p) return false;
  send(p, { t: 'kicked', reason: reason || 'Bạn đã bị đưa ra khỏi game.' });
  p.ws.close(4002, 'kicked'); removeOnline(p); return true;
}
function setMute(userId, minutes) {
  const until = minutes > 0 ? now() + minutes * 60000 : 0;
  db.run('UPDATE users SET muted_until = ? WHERE id = ?', until, userId);
  const p = online.get(userId); if (p) { p.mutedUntil = until; sys(p, minutes > 0 ? 'Bạn bị cấm chat trong ' + minutes + ' phút.' : 'Bạn đã được bỏ cấm chat.'); }
}
function setBan(userId, days, reason) {
  const until = days > 0 ? now() + days * 864e5 : 0;
  db.run('UPDATE users SET banned_until = ?, ban_reason = ? WHERE id = ?', until, days > 0 ? reason || null : null, userId);
  if (days > 0) { db.run('DELETE FROM sessions WHERE user_id = ?', userId); kick(userId, 'Tài khoản của bạn đã bị khóa' + (reason ? ': ' + reason : '.')); }
}
function announce(text) { broadcast({ t: 'announce', text: cleanText(text) }); }
function saveAll() { online.forEach((p) => { try { storeChar(p.id, p.data, p.x, p.z, 0); } catch (e) { /* ignore */ } }); }
function onlineList() { return [...online.values()].map((p) => ({ id: p.id, name: p.name, role: p.role, level: p.level, x: Math.round(p.x), z: Math.round(p.z), since: p.joinedAt, gold: p.data.gold })); }
function isOnline(id) { return online.has(id); }
function liveData(id) { const p = online.get(id); return p ? p.data : null; }

module.exports = { connect, kick, setMute, setBan, announce, sendMail, buildGift, saveAll, onlineList, isOnline, liveData, logAdmin, online, sanitizeSave, freshData, cleanText };
