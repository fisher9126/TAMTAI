'use strict';
/* Social and economy layer: party, guild, player trade, market, enhancement, daily quests,
   achievements, rankings and emotes. Everything here is server-authoritative: the browser only
   sends requests, the server checks them against the saved character and answers. */
const db = require('./db');
const items = require('../public/js/items.js');
const rules = require('../public/js/rules.js');

let C = null; // context handed over by game.js
const now = () => Date.now();
const J = JSON.stringify;
const INV = rules.INV_SIZE;
const MAX_GOLD = 1e9;

db.exec(`
CREATE TABLE IF NOT EXISTS guilds (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE COLLATE NOCASE, leader_id INTEGER NOT NULL,
  funds INTEGER NOT NULL DEFAULT 0, motd TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS guild_members (
  user_id INTEGER PRIMARY KEY, guild_id INTEGER NOT NULL, rank INTEGER NOT NULL DEFAULT 0,
  contrib INTEGER NOT NULL DEFAULT 0, joined_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_gm_guild ON guild_members(guild_id);
CREATE TABLE IF NOT EXISTS market (
  id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL, seller_name TEXT NOT NULL, item TEXT NOT NULL,
  slot TEXT NOT NULL, rarity TEXT NOT NULL, price INTEGER NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_market_seller ON market(seller_id);
CREATE TABLE IF NOT EXISTS social_player (user_id INTEGER PRIMARY KEY, data TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS trade_log (id INTEGER PRIMARY KEY AUTOINCREMENT, a_id INTEGER, b_id INTEGER, detail TEXT, created_at INTEGER);
`);

function init(ctx) {
  C = ctx;
  setInterval(expireMarket, 10 * 60000).unref();
  setInterval(flushAll, 15000).unref();
  expireMarket();
}

/* ---------- small helpers ---------- */
const sys = (p, t) => C.sys(p, t);
const send = (p, m) => C.send(p, m);
const intIn = (v, a, b, d) => C.int(v, a, b, d);
function onlineByName(name) { const u = C.userByName(name); return u ? (C.online.get(u.id) || null) : null; }
function throttle(p, key, ms) { p.sThr = p.sThr || {}; const t = now(); if ((p.sThr[key] || 0) > t) return false; p.sThr[key] = t + ms; return true; }
function chatOk(p) {
  const t = now();
  if ((p.mutedUntil || 0) > t) { sys(p, 'Bạn đang bị cấm chat.'); return false; }
  p.sChat = (p.sChat || []).filter((x) => t - x < 6000);
  if (p.sChat.length >= 5) { sys(p, 'Bạn chat nhanh quá, đợi vài giây nhé.'); return false; }
  p.sChat.push(t); return true;
}
function itemLine(it) { return it.name + ' (Lv' + it.ilvl + ')'; }
function near(a, b, r) { return Math.hypot(a.x - b.x, a.z - b.z) <= r; }

/* ---------- per-player extras (daily progress, achievements, counters) ---------- */
const DEF_ST = () => ({ kills: 0, gufo: 0, teieretta: 0, boss: 0, enh: 0, enhMax: 0, trades: 0, sales: 0, donated: 0, guild: 0, party: 0 });
const dayKey = (back) => new Date(now() + 7 * 3600e3 - (back || 0) * 864e5).toISOString().slice(0, 10); // UTC+7
function loadSoc(p) {
  const r = db.get('SELECT data FROM social_player WHERE user_id = ?', p.id);
  const s = { date: '', streak: 0, loginClaimed: false, dq: { date: '', prog: {}, claimed: {} }, st: DEF_ST(), ach: {} };
  if (r) {
    try {
      const o = JSON.parse(r.data);
      if (typeof o.date === 'string') s.date = o.date;
      s.streak = intIn(o.streak, 0, 100000, 0); s.loginClaimed = !!o.loginClaimed;
      if (o.dq && typeof o.dq === 'object') s.dq = { date: String(o.dq.date || ''), prog: o.dq.prog || {}, claimed: o.dq.claimed || {} };
      Object.assign(s.st, o.st || {}); s.ach = o.ach || {};
    } catch (e) { /* keep defaults */ }
  }
  p.soc = s; p.socDirty = false; rollDay(p);
}
function rollDay(p) {
  const s = p.soc, today = dayKey();
  if (s.date !== today) { s.streak = s.date === dayKey(1) ? s.streak + 1 : 1; s.date = today; s.loginClaimed = false; p.socDirty = true; }
  if (s.dq.date !== today) { s.dq = { date: today, prog: {}, claimed: {} }; p.socDirty = true; }
}
function saveSoc(p) {
  if (!p.soc || !p.socDirty) return; p.socDirty = false;
  db.run('INSERT INTO social_player (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data', p.id, J(p.soc));
}
function flushAll() { C.online.forEach((p) => { try { saveSoc(p); } catch (e) { console.error('soc save', e.message); } }); }

const DQ = [
  { id: 'kill15', stat: 'kills', need: 15, title: 'Dọn dẹp thung lũng', desc: 'Hạ 15 quái bất kỳ', reward: { exp: 120, gold: 60 } },
  { id: 'gufo5', stat: 'gufo', need: 5, title: 'Tắt đèn trong rừng', desc: 'Hạ 5 Gufo Lampadino', reward: { exp: 150, gold: 90, potions: 2 } },
  { id: 'enh2', stat: 'enh', need: 2, title: 'Thợ rèn chăm chỉ', desc: 'Cường hóa trang bị 2 lần', reward: { gold: 120 } },
  { id: 'boss1', stat: 'boss', need: 1, title: 'Đồ tể máy giặt', desc: 'Hạ boss Lavatricio Torone 1 lần', reward: { exp: 300, gold: 200 } }
];
const ACH = [
  { id: 'k100', title: 'Thợ săn tập sự', desc: 'Hạ 100 quái', test: (s) => s.kills >= 100, reward: { gold: 200 } },
  { id: 'k1000', title: 'Nỗi kinh hoàng thung lũng', desc: 'Hạ 1000 quái', test: (s) => s.kills >= 1000, reward: { gold: 1500, potions: 5 } },
  { id: 'boss1', title: 'Máy giặt đã dừng quay', desc: 'Hạ boss lần đầu', test: (s) => s.boss >= 1, reward: { gold: 300 } },
  { id: 'boss10', title: 'Khách quen đấu trường', desc: 'Hạ boss 10 lần', test: (s) => s.boss >= 10, reward: { gold: 1500 } },
  { id: 'enh5', title: 'Lò rèn nóng', desc: 'Cường hóa một món lên +5', test: (s) => s.enhMax >= 5, reward: { gold: 400 } },
  { id: 'enh10', title: 'Đỉnh cao cường hóa', desc: 'Cường hóa một món lên +10', test: (s) => s.enhMax >= 10, reward: { gold: 3000, potions: 5 } },
  { id: 'trade1', title: 'Buôn có bạn', desc: 'Hoàn tất 1 giao dịch với người chơi', test: (s) => s.trades >= 1, reward: { gold: 100 } },
  { id: 'sale1', title: 'Chủ quán mới', desc: 'Bán được 1 món ở Chợ', test: (s) => s.sales >= 1, reward: { gold: 150 } },
  { id: 'party1', title: 'Đi săn có bạn', desc: 'Tham gia một tổ đội', test: (s) => s.party >= 1, reward: { gold: 80 } },
  { id: 'guild1', title: 'Có nhà', desc: 'Gia nhập hoặc lập một bang hội', test: (s) => s.guild >= 1, reward: { gold: 120 } },
  { id: 'don1000', title: 'Mạnh thường quân', desc: 'Quyên góp tổng 1000 vàng cho bang', test: (s) => s.donated >= 1000, reward: { gold: 300 } }
];
function grant(p, r) {
  const d = p.data; let up = 0;
  if (r.gold) d.gold = Math.min(MAX_GOLD, d.gold + r.gold);
  if (r.potions) d.potions = Math.min(999, d.potions + r.potions);
  if (r.exp) up = C.addExp(p, r.exp);
  C.pushMe(p);
  return up;
}
function rewardText(r) { const a = []; if (r.exp) a.push(r.exp + ' EXP'); if (r.gold) a.push(r.gold + ' vàng'); if (r.potions) a.push(r.potions + ' bình máu'); return a.join(', '); }
function bump(p, key, n) {
  if (!p.soc) return; rollDay(p);
  n = n || 1; p.soc.st[key] = (p.soc.st[key] || 0) + n; p.soc.dq.prog[key] = (p.soc.dq.prog[key] || 0) + n; p.socDirty = true;
  checkAch(p);
}
function checkAch(p) {
  const s = p.soc; let any = false;
  ACH.forEach((a) => {
    if (s.ach[a.id] || !a.test(s.st)) return;
    s.ach[a.id] = now(); p.socDirty = true; any = true;
    grant(p, a.reward);
    send(p, { t: 'ach', title: a.title, reward: rewardText(a.reward) });
    sys(p, 'Thành tựu mới: ' + a.title + ' (+' + rewardText(a.reward) + ')');
  });
  if (any) send(p, dailyView(p));
}
const loginReward = (streak) => ({ gold: 50 + 25 * Math.min(streak, 7), potions: streak % 7 === 0 ? 3 : 1 });
function dailyView(p) {
  rollDay(p); const s = p.soc;
  return { t: 'daily', streak: s.streak, loginClaimed: s.loginClaimed, loginReward: loginReward(s.streak),
    dq: DQ.map((q) => ({ id: q.id, title: q.title, desc: q.desc, need: q.need, prog: Math.min(q.need, s.dq.prog[q.stat] || 0), claimed: !!s.dq.claimed[q.id], reward: q.reward })),
    ach: ACH.map((a) => ({ id: a.id, title: a.title, desc: a.desc, done: !!s.ach[a.id], reward: a.reward })), st: s.st };
}
function onDaily(p, m) {
  rollDay(p);
  if (m.op === 'login') {
    if (p.soc.loginClaimed) return sys(p, 'Hôm nay bạn đã nhận quà đăng nhập rồi.');
    p.soc.loginClaimed = true; p.socDirty = true;
    const r = loginReward(p.soc.streak); grant(p, r);
    sys(p, 'Quà đăng nhập ngày ' + p.soc.streak + ': ' + rewardText(r));
  } else if (m.op === 'claim') {
    const q = DQ.find((x) => x.id === m.id); if (!q) return;
    if (p.soc.dq.claimed[q.id]) return;
    if ((p.soc.dq.prog[q.stat] || 0) < q.need) return sys(p, 'Nhiệm vụ chưa hoàn thành.');
    p.soc.dq.claimed[q.id] = true; p.socDirty = true;
    grant(p, q.reward); sys(p, 'Hoàn thành "' + q.title + '": ' + rewardText(q.reward));
  }
  send(p, dailyView(p)); saveSoc(p);
}

/* ---------- party ---------- */
const PARTY_MAX = 4;
const partyInv = new Map(); // targetId -> { from, until }
let partySeq = 1;
function partyView(pt) {
  return { leader: pt.leader, members: pt.members.map((id) => { const o = C.online.get(id); return { id, name: o ? o.name : '?', level: o ? o.level : 0 }; }) };
}
function pushParty(pt) { const v = partyView(pt); pt.members.forEach((id) => { const o = C.online.get(id); if (o) send(o, { t: 'party', party: v }); }); }
function partyNote(pt, text, exceptId) { pt.members.forEach((id) => { const o = C.online.get(id); if (o && o.id !== exceptId) sys(o, text); }); }
function leaveParty(p, why) {
  const pt = p.party; if (!pt) return;
  p.party = null; send(p, { t: 'party', party: null });
  pt.members = pt.members.filter((id) => id !== p.id);
  if (why) sys(p, why);
  if (pt.members.length < 2) {
    pt.members.forEach((id) => { const o = C.online.get(id); if (o) { o.party = null; send(o, { t: 'party', party: null }); sys(o, 'Tổ đội đã giải tán.'); } });
    pt.members = []; return;
  }
  if (pt.leader === p.id) { pt.leader = pt.members[0]; const nl = C.online.get(pt.leader); partyNote(pt, (nl ? nl.name : 'Người khác') + ' là đội trưởng mới.'); }
  partyNote(pt, p.name + ' đã rời tổ đội.'); pushParty(pt);
}
function onParty(p, m) {
  const op = m.op;
  if (op === 'invite') {
    const t = onlineByName(m.name);
    if (!t) return sys(p, 'Người chơi "' + C.cleanText(m.name) + '" không online.');
    if (t.id === p.id) return;
    if (p.party && p.party.leader !== p.id) return sys(p, 'Chỉ đội trưởng mới mời được người mới.');
    if (p.party && p.party.members.length >= PARTY_MAX) return sys(p, 'Tổ đội đã đủ ' + PARTY_MAX + ' người.');
    if (t.party) return sys(p, t.name + ' đã ở trong một tổ đội.');
    partyInv.set(t.id, { from: p.id, until: now() + 60000 });
    sys(p, 'Đã mời ' + t.name + ' vào tổ đội.'); send(t, { t: 'pinv', from: p.name });
  } else if (op === 'accept') {
    const inv = partyInv.get(p.id); partyInv.delete(p.id);
    if (!inv || inv.until < now()) return sys(p, 'Lời mời đã hết hạn.');
    const f = C.online.get(inv.from); if (!f) return sys(p, 'Người mời đã offline.');
    if (p.party) return sys(p, 'Bạn đang ở trong một tổ đội.');
    if (!f.party) { f.party = { id: partySeq++, leader: f.id, members: [f.id] }; }
    const pt = f.party;
    if (pt.members.length >= PARTY_MAX) return sys(p, 'Tổ đội đã đủ người.');
    pt.members.push(p.id); p.party = pt;
    bump(p, 'party', 1); bump(f, 'party', 1);
    partyNote(pt, p.name + ' đã vào tổ đội.', p.id); sys(p, 'Bạn đã vào tổ đội của ' + f.name + '.'); pushParty(pt);
  } else if (op === 'decline') {
    const inv = partyInv.get(p.id); partyInv.delete(p.id);
    const f = inv && C.online.get(inv.from); if (f) sys(f, p.name + ' từ chối lời mời tổ đội.');
  } else if (op === 'leave') {
    if (!p.party) return; leaveParty(p, 'Bạn đã rời tổ đội.');
  } else if (op === 'kick' || op === 'lead') {
    const pt = p.party; if (!pt || pt.leader !== p.id) return sys(p, 'Chỉ đội trưởng làm được việc này.');
    const t = onlineByName(m.name); if (!t || t.party !== pt || t.id === p.id) return sys(p, 'Người đó không ở trong tổ đội của bạn.');
    if (op === 'kick') leaveParty(t, 'Bạn đã bị mời ra khỏi tổ đội.');
    else { pt.leader = t.id; partyNote(pt, t.name + ' là đội trưởng mới.'); pushParty(pt); }
  }
}
function onPChat(p, m) {
  if (!p.party) return sys(p, 'Bạn chưa ở trong tổ đội.');
  const text = C.cleanText(m.text); if (!text || !chatOk(p)) return;
  p.party.members.forEach((id) => { const o = C.online.get(id); if (o) send(o, { t: 'pchat', from: p.name, text }); });
}

/* ---------- guild ---------- */
const GL = [0, 2000, 8000, 25000, 70000, 150000]; // funds needed for guild level 1..6
const GUILD_COST = 500, GUILD_MIN_LEVEL = 5;
const glevel = (funds) => { let l = 1; GL.forEach((t, i) => { if (funds >= t) l = i + 1; }); return l; };
const gcap = (lv) => 10 + 5 * lv;
const guildInv = new Map(); // targetId -> { gid, gname, from, until }
const gcache = new Map();
const gq = (uid) => db.get('SELECT g.id, g.name, g.leader_id, g.funds, g.motd, m.rank FROM guild_members m JOIN guilds g ON g.id = m.guild_id WHERE m.user_id = ?', uid);
function guildView(gid) {
  const g = db.get('SELECT id, name, leader_id, funds, motd FROM guilds WHERE id = ?', gid); if (!g) return null;
  const mem = db.all(`SELECT m.user_id AS id, m.rank, m.contrib, u.username AS name, COALESCE(c.level, 1) AS level
                      FROM guild_members m JOIN users u ON u.id = m.user_id LEFT JOIN characters c ON c.user_id = m.user_id
                      WHERE m.guild_id = ? ORDER BY m.rank DESC, m.contrib DESC`, gid);
  const lv = glevel(g.funds);
  return { id: g.id, name: g.name, level: lv, funds: g.funds, next: GL[lv] || null, cap: gcap(lv), motd: g.motd, leader: g.leader_id,
    members: mem.map((x) => ({ id: x.id, name: x.name, rank: x.rank, level: x.level, contrib: x.contrib, online: C.online.has(x.id) })) };
}
function pushGuild(gid) { const v = guildView(gid); C.online.forEach((p) => { if (p.gid === gid) send(p, { t: 'guild', guild: v }); }); }
function guildNote(gid, text, exceptId) { C.online.forEach((p) => { if (p.gid === gid && p.id !== exceptId) sys(p, '[Bang] ' + text); }); }
function guildLevelOf(p) {
  if (!p.gid) return 0;
  const c = gcache.get(p.gid); if (c && c.until > now()) return c.lv;
  const r = db.get('SELECT funds FROM guilds WHERE id = ?', p.gid); const lv = r ? glevel(r.funds) : 0;
  gcache.set(p.gid, { lv, until: now() + 60000 }); return lv;
}
function dropGuildMember(uid, gid) {
  db.run('DELETE FROM guild_members WHERE user_id = ?', uid);
  const o = C.online.get(uid); if (o) { o.gid = null; send(o, { t: 'guild', guild: null }); }
  gcache.delete(gid);
}
function onGuild(p, m) {
  const d = p.data, op = m.op;
  if (op === 'info') { return send(p, { t: 'guild', guild: p.gid ? guildView(p.gid) : null }); }
  if (op === 'create') {
    if (p.gid) return sys(p, 'Bạn đã ở trong một bang hội.');
    const name = String(m.name || '').trim().replace(/\s+/g, ' ');
    if (!/^[\p{L}\p{N}][\p{L}\p{N} ]{1,14}[\p{L}\p{N}]$/u.test(name) || C.cleanText(name) !== name) return sys(p, 'Tên bang dài 3-16 ký tự, chỉ gồm chữ cái, số và khoảng trắng.');
    if (d.level < GUILD_MIN_LEVEL) return sys(p, 'Cần đạt cấp ' + GUILD_MIN_LEVEL + ' để lập bang.');
    if (d.gold < GUILD_COST) return sys(p, 'Lập bang tốn ' + GUILD_COST + ' vàng.');
    let gid;
    try {
      db.tx(() => {
        const r = db.run("INSERT INTO guilds (name, leader_id, funds, motd, created_at) VALUES (?, ?, 0, '', ?)", name, p.id, now());
        gid = Number(r.lastInsertRowid);
        db.run('INSERT INTO guild_members (user_id, guild_id, rank, contrib, joined_at) VALUES (?, ?, 2, 0, ?)', p.id, gid, now());
      });
    } catch (e) { return sys(p, 'Tên bang đã có người dùng.'); }
    d.gold -= GUILD_COST; p.gid = gid; bump(p, 'guild', 1);
    C.pushMe(p); C.saveNow(p); pushGuild(gid); sys(p, 'Đã lập bang "' + name + '".');
    return;
  }
  const mine = p.gid ? gq(p.id) : null;
  if (op === 'accept') {
    const inv = guildInv.get(p.id); guildInv.delete(p.id);
    if (!inv || inv.until < now()) return sys(p, 'Lời mời đã hết hạn.');
    if (p.gid) return sys(p, 'Bạn đã ở trong một bang hội.');
    const g = db.get('SELECT id, funds FROM guilds WHERE id = ?', inv.gid); if (!g) return sys(p, 'Bang này không còn nữa.');
    const n = db.get('SELECT COUNT(*) AS n FROM guild_members WHERE guild_id = ?', g.id).n;
    if (n >= gcap(glevel(g.funds))) return sys(p, 'Bang đã đủ thành viên.');
    db.run('INSERT INTO guild_members (user_id, guild_id, rank, contrib, joined_at) VALUES (?, ?, 0, 0, ?)', p.id, g.id, now());
    p.gid = g.id; bump(p, 'guild', 1); guildNote(g.id, p.name + ' đã gia nhập bang.', p.id); pushGuild(g.id); sys(p, 'Bạn đã gia nhập bang "' + inv.gname + '".');
    return;
  }
  if (op === 'decline') { guildInv.delete(p.id); return; }
  if (!mine) return sys(p, 'Bạn chưa ở trong bang hội nào.');
  const gid = mine.id;
  if (op === 'invite') {
    if (mine.rank < 1) return sys(p, 'Chỉ trưởng bang và phó bang mới mời được người.');
    const t = onlineByName(m.name); if (!t) return sys(p, 'Người chơi "' + C.cleanText(m.name) + '" không online.');
    if (t.gid) return sys(p, t.name + ' đã ở trong một bang hội.');
    const n = db.get('SELECT COUNT(*) AS n FROM guild_members WHERE guild_id = ?', gid).n;
    if (n >= gcap(glevel(mine.funds))) return sys(p, 'Bang đã đủ thành viên. Quyên góp để lên cấp bang.');
    guildInv.set(t.id, { gid, gname: mine.name, from: p.name, until: now() + 60000 });
    sys(p, 'Đã mời ' + t.name + ' vào bang.'); send(t, { t: 'ginv', guild: mine.name, from: p.name });
  } else if (op === 'leave') {
    if (mine.rank === 2) {
      const n = db.get('SELECT COUNT(*) AS n FROM guild_members WHERE guild_id = ?', gid).n;
      if (n > 1) return sys(p, 'Trưởng bang hãy chuyển quyền (nút "Nhường") hoặc giải tán bang trước khi rời.');
      return onGuild(p, { op: 'disband' });
    }
    dropGuildMember(p.id, gid); guildNote(gid, p.name + ' đã rời bang.'); pushGuild(gid); sys(p, 'Bạn đã rời bang.');
  } else if (op === 'kick') {
    const u = C.userByName(m.name); if (!u || u.id === p.id) return;
    const tm = db.get('SELECT rank FROM guild_members WHERE user_id = ? AND guild_id = ?', u.id, gid);
    if (!tm) return sys(p, 'Người đó không ở trong bang.');
    if (mine.rank < 1 || mine.rank <= tm.rank) return sys(p, 'Bạn không đủ quyền với người này.');
    dropGuildMember(u.id, gid); const o = C.online.get(u.id); if (o) sys(o, 'Bạn đã bị mời ra khỏi bang.');
    guildNote(gid, u.username + ' bị mời ra khỏi bang.'); pushGuild(gid);
  } else if (op === 'promote' || op === 'demote' || op === 'lead') {
    if (mine.rank !== 2) return sys(p, 'Chỉ trưởng bang làm được việc này.');
    const u = C.userByName(m.name); if (!u || u.id === p.id) return;
    const tm = db.get('SELECT rank FROM guild_members WHERE user_id = ? AND guild_id = ?', u.id, gid); if (!tm) return sys(p, 'Người đó không ở trong bang.');
    if (op === 'lead') {
      db.tx(() => {
        db.run('UPDATE guild_members SET rank = 2 WHERE user_id = ?', u.id); db.run('UPDATE guild_members SET rank = 1 WHERE user_id = ?', p.id);
        db.run('UPDATE guilds SET leader_id = ? WHERE id = ?', u.id, gid);
      });
      guildNote(gid, u.username + ' là trưởng bang mới.');
    } else {
      db.run('UPDATE guild_members SET rank = ? WHERE user_id = ?', op === 'promote' ? 1 : 0, u.id);
      guildNote(gid, u.username + (op === 'promote' ? ' được phong phó bang.' : ' bị hạ xuống thành viên.'));
    }
    pushGuild(gid);
  } else if (op === 'disband') {
    if (mine.rank !== 2) return sys(p, 'Chỉ trưởng bang giải tán được bang.');
    const ids = db.all('SELECT user_id AS id FROM guild_members WHERE guild_id = ?', gid).map((r) => r.id);
    db.tx(() => { db.run('DELETE FROM guild_members WHERE guild_id = ?', gid); db.run('DELETE FROM guilds WHERE id = ?', gid); });
    ids.forEach((id) => { const o = C.online.get(id); if (o) { o.gid = null; send(o, { t: 'guild', guild: null }); sys(o, 'Bang "' + mine.name + '" đã giải tán.'); } });
    gcache.delete(gid);
  } else if (op === 'donate') {
    const amt = intIn(m.amount, 1, MAX_GOLD, 0);
    if (!amt || d.gold < amt) return sys(p, 'Bạn không đủ vàng.');
    d.gold -= amt;
    db.tx(() => { db.run('UPDATE guilds SET funds = funds + ? WHERE id = ?', amt, gid); db.run('UPDATE guild_members SET contrib = contrib + ? WHERE user_id = ?', amt, p.id); });
    gcache.delete(gid); bump(p, 'donated', amt);
    C.pushMe(p); C.saveNow(p); guildNote(gid, p.name + ' quyên góp ' + amt + ' vàng.'); pushGuild(gid); sys(p, 'Đã quyên góp ' + amt + ' vàng cho bang.');
  } else if (op === 'motd') {
    if (mine.rank < 1) return sys(p, 'Chỉ trưởng bang và phó bang đặt được lời nhắn.');
    db.run('UPDATE guilds SET motd = ? WHERE id = ?', C.cleanText(m.text).slice(0, 100), gid); pushGuild(gid);
  }
}
function onGChat(p, m) {
  if (!p.gid) return sys(p, 'Bạn chưa ở trong bang hội nào.');
  const text = C.cleanText(m.text); if (!text || !chatOk(p)) return;
  C.online.forEach((o) => { if (o.gid === p.gid) send(o, { t: 'gchat', from: p.name, text }); });
}

/* ---------- player to player trade ---------- */
const trades = new Map(); // userId -> trade (both participants point to the same object)
const tradeReq = new Map(); // targetId -> { from, until }
const TRADE_RANGE = 20;
const blank = () => ({ gold: 0, items: [], lock: false, ok: false });
function tradeSide(tr, p) {
  const o = tr.off[p.id];
  return { gold: o.gold, lock: o.lock, ok: o.ok, items: o.items.map((id) => p.data.inv.find((x) => x.id === id)).filter(Boolean) };
}
function pushTrade(tr) {
  [tr.a, tr.b].forEach((id) => {
    const me = C.online.get(id), other = C.online.get(id === tr.a ? tr.b : tr.a); if (!me || !other) return;
    send(me, { t: 'trade', st: { with: other.name, mine: tradeSide(tr, me), theirs: tradeSide(tr, other) } });
  });
}
function endTrade(tr, why) {
  [tr.a, tr.b].forEach((id) => {
    if (trades.get(id) === tr) trades.delete(id);
    const o = C.online.get(id); if (o) { send(o, { t: 'trade', st: null }); if (why) sys(o, why); }
  });
}
function onTrade(p, m) {
  const op = m.op, tr = trades.get(p.id);
  if (op === 'request') {
    if (tr) return sys(p, 'Bạn đang trong một giao dịch.');
    const t = onlineByName(m.name); if (!t || t.id === p.id) return sys(p, 'Người chơi "' + C.cleanText(m.name) + '" không online.');
    if (trades.get(t.id)) return sys(p, t.name + ' đang bận giao dịch.');
    if (!near(p, t, TRADE_RANGE)) return sys(p, 'Hai bên phải đứng gần nhau (trong ' + TRADE_RANGE + 'm).');
    tradeReq.set(t.id, { from: p.id, until: now() + 30000 });
    sys(p, 'Đã gửi lời mời giao dịch tới ' + t.name + '.'); send(t, { t: 'treq', from: p.name });
    return;
  }
  if (op === 'accept') {
    const rq = tradeReq.get(p.id); tradeReq.delete(p.id);
    if (!rq || rq.until < now()) return sys(p, 'Lời mời giao dịch đã hết hạn.');
    const f = C.online.get(rq.from); if (!f) return sys(p, 'Người mời đã offline.');
    if (trades.get(p.id) || trades.get(f.id)) return sys(p, 'Một trong hai bên đang bận giao dịch.');
    if (!near(p, f, TRADE_RANGE)) return sys(p, 'Hai bên phải đứng gần nhau.');
    const t = { a: f.id, b: p.id, off: { [f.id]: blank(), [p.id]: blank() } };
    trades.set(f.id, t); trades.set(p.id, t); pushTrade(t);
    return;
  }
  if (op === 'decline') { const rq = tradeReq.get(p.id); tradeReq.delete(p.id); const f = rq && C.online.get(rq.from); if (f) sys(f, p.name + ' từ chối giao dịch.'); return; }
  if (!tr) return;
  const other = C.online.get(tr.a === p.id ? tr.b : tr.a);
  if (!other) return endTrade(tr, 'Đối phương đã rời game. Giao dịch bị hủy.');
  if (op === 'cancel') return endTrade(tr, 'Giao dịch đã bị hủy.');
  const mine = tr.off[p.id], theirs = tr.off[other.id];
  if (op === 'offer') {
    const ids = Array.isArray(m.items) ? [...new Set(m.items.map(String))].slice(0, 8) : [];
    if (!ids.every((id) => p.data.inv.some((x) => x.id === id))) return sys(p, 'Có món đồ không còn trong túi của bạn.');
    mine.items = ids; mine.gold = intIn(m.gold, 0, p.data.gold, 0);
    mine.lock = mine.ok = theirs.lock = theirs.ok = false; pushTrade(tr);
  } else if (op === 'lock') {
    mine.lock = true; mine.ok = theirs.ok = false; pushTrade(tr);
  } else if (op === 'confirm') {
    if (!mine.lock || !theirs.lock) return sys(p, 'Cả hai bên cần khóa đề nghị trước khi xác nhận.');
    mine.ok = true; pushTrade(tr);
    if (theirs.ok) executeTrade(tr, p, other);
  }
}
function executeTrade(tr, p, q) {
  const fail = (why) => endTrade(tr, why);
  if (!near(p, q, TRADE_RANGE * 2)) return fail('Hai bên đã đi xa nhau. Giao dịch bị hủy.');
  const op = tr.off[p.id], oq = tr.off[q.id];
  const ip = op.items.map((id) => p.data.inv.find((x) => x.id === id)), iq = oq.items.map((id) => q.data.inv.find((x) => x.id === id));
  if (ip.some((x) => !x) || iq.some((x) => !x)) return fail('Đồ trong đề nghị đã thay đổi. Giao dịch bị hủy.');
  if (p.data.gold < op.gold || q.data.gold < oq.gold) return fail('Một bên không đủ vàng. Giao dịch bị hủy.');
  if (p.data.inv.length - ip.length + iq.length > INV || q.data.inv.length - iq.length + ip.length > INV) return fail('Túi đồ của một bên không đủ chỗ. Giao dịch bị hủy.');
  if (p.data.gold - op.gold + oq.gold > MAX_GOLD || q.data.gold - oq.gold + op.gold > MAX_GOLD) return fail('Vượt giới hạn vàng. Giao dịch bị hủy.');
  p.data.inv = p.data.inv.filter((x) => !op.items.includes(x.id)); q.data.inv = q.data.inv.filter((x) => !oq.items.includes(x.id));
  iq.forEach((x) => p.data.inv.push(x)); ip.forEach((x) => q.data.inv.push(x));
  p.data.gold += oq.gold - op.gold; q.data.gold += op.gold - oq.gold;
  db.run('INSERT INTO trade_log (a_id, b_id, detail, created_at) VALUES (?, ?, ?, ?)', p.id, q.id,
    J({ [p.name]: { gold: op.gold, items: ip.map(itemLine) }, [q.name]: { gold: oq.gold, items: iq.map(itemLine) } }), now());
  C.pushMe(p); C.pushMe(q); C.saveNow(p); C.saveNow(q);
  bump(p, 'trades', 1); bump(q, 'trades', 1);
  endTrade(tr, 'Giao dịch thành công!');
}

/* ---------- market ---------- */
const PAGE = 8, MAX_LISTINGS = 8, TAX = 0.05, LIST_MS = 72 * 3600e3, MAX_PRICE = 10000000;
const rowView = (r) => { let it = null; try { it = items.validItem(JSON.parse(r.item)); } catch (e) { /* ignore */ } return it ? { id: r.id, seller: r.seller_name, price: r.price, exp: r.expires_at, item: it } : null; };
function sendMine(p) {
  const rows = db.all('SELECT id, seller_name, item, price, expires_at FROM market WHERE seller_id = ? ORDER BY id DESC', p.id);
  send(p, { t: 'market', kind: 'mine', list: rows.map(rowView).filter(Boolean), tax: TAX });
}
function onMarket(p, m) {
  const op = m.op, d = p.data;
  if (op === 'browse') {
    if (!throttle(p, 'mbrowse', 250)) return;
    const slot = items.SLOTS.includes(m.slot) ? m.slot : null, rar = items.RAR.includes(m.rarity) ? m.rarity : null;
    const page = intIn(m.page, 0, 10000, 0), t = now();
    const total = db.get('SELECT COUNT(*) AS n FROM market WHERE expires_at > ? AND (? IS NULL OR slot = ?) AND (? IS NULL OR rarity = ?)', t, slot, slot, rar, rar).n;
    const rows = db.all('SELECT id, seller_name, item, price, expires_at FROM market WHERE expires_at > ? AND (? IS NULL OR slot = ?) AND (? IS NULL OR rarity = ?) ORDER BY price ASC, id ASC LIMIT ? OFFSET ?',
      t, slot, slot, rar, rar, PAGE, page * PAGE);
    send(p, { t: 'market', kind: 'browse', list: rows.map(rowView).filter(Boolean), page, pages: Math.max(1, Math.ceil(total / PAGE)), slot: slot || '', rarity: rar || '', tax: TAX });
    return;
  }
  if (op === 'mine') return sendMine(p);
  if (op === 'shop') return send(p, shopView(p));
  if (op === 'shopbuy') return shopBuy(p, m);
  if (!throttle(p, 'mwrite', 400)) return;
  if (op === 'list') {
    const i = d.inv.findIndex((x) => x.id === m.id); if (i < 0) return sys(p, 'Không thấy món đồ này trong túi.');
    const price = intIn(m.price, 1, MAX_PRICE, 0); if (!price) return sys(p, 'Giá bán từ 1 đến ' + MAX_PRICE + ' vàng.');
    if (db.get('SELECT COUNT(*) AS n FROM market WHERE seller_id = ?', p.id).n >= MAX_LISTINGS) return sys(p, 'Mỗi người chỉ đăng tối đa ' + MAX_LISTINGS + ' món.');
    const it = d.inv[i];
    d.inv.splice(i, 1);
    db.run('INSERT INTO market (seller_id, seller_name, item, slot, rarity, price, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      p.id, p.name, J(it), it.slot, it.rarity, price, now(), now() + LIST_MS);
    C.pushMe(p); C.saveNow(p); sendMine(p); sys(p, 'Đã đăng bán ' + it.name + ' giá ' + price + ' vàng (thuế ' + Math.round(TAX * 100) + '% khi bán được).');
  } else if (op === 'buy') {
    const row = db.get('SELECT * FROM market WHERE id = ? AND expires_at > ?', intIn(m.id, 1, 1e12, 0), now());
    if (!row) return sys(p, 'Món này không còn nữa.');
    if (row.seller_id === p.id) return sys(p, 'Đây là món của bạn. Hãy dùng nút Gỡ.');
    if (d.gold < row.price) return sys(p, 'Bạn không đủ vàng.');
    if (d.inv.length >= INV) return sys(p, 'Túi đồ đã đầy.');
    let it = null; try { it = items.validItem(JSON.parse(row.item)); } catch (e) { /* ignore */ }
    if (!it) return sys(p, 'Món đồ bị lỗi, không mua được.');
    const r = db.run('DELETE FROM market WHERE id = ?', row.id); if (r.changes !== 1) return sys(p, 'Đã có người mua món này.');
    d.gold -= row.price; d.inv.push(it); C.pushMe(p); C.saveNow(p);
    const proceeds = row.price - Math.floor(row.price * TAX);
    C.sendMail([row.seller_id], 'Chợ', it.name + ' đã bán cho ' + p.name + ' (đã trừ thuế)', { gold: proceeds });
    const so = C.online.get(row.seller_id); if (so) { bump(so, 'sales', 1); sendMine(so); }
    sys(p, 'Đã mua ' + it.name + ' với giá ' + row.price + ' vàng.');
    onMarket(p, { op: 'browse', page: m.page, slot: m.slot, rarity: m.rarity });
  } else if (op === 'cancel') {
    const row = db.get('SELECT * FROM market WHERE id = ? AND seller_id = ?', intIn(m.id, 1, 1e12, 0), p.id); if (!row) return;
    if (d.inv.length >= INV) return sys(p, 'Túi đồ đã đầy, không gỡ về được.');
    let it = null; try { it = items.validItem(JSON.parse(row.item)); } catch (e) { /* ignore */ }
    const r = db.run('DELETE FROM market WHERE id = ?', row.id); if (r.changes !== 1) return;
    if (it) d.inv.push(it);
    C.pushMe(p); C.saveNow(p); sendMine(p);
  }
}
/* ---------- NPC shop (potions and basic gear at the player's level; buy price is 5x the sell price) ---------- */
const NPC = { x: 1.5, z: 5 }, SHOP_RANGE = 15, POTION_PRICE = 30;
const shopLv = (p) => Math.max(1, Math.min(60, p.data.level | 0));
const shopMult = () => { try { return require('./events').shopMult(); } catch (e) { return 1; } }; // admin sale event; 1 when events.js is not installed
const gearPrice = (rarity, ilvl) => Math.max(1, Math.round(items.itemValue({ rarity, ilvl, enh: 0 }) * 5 * shopMult()));
function shopList(p) {
  const lv = shopLv(p), pp = Math.max(1, Math.round(POTION_PRICE * shopMult()));
  const list = [
    { id: 'pot1', kind: 'potion', name: 'Bình máu x1', price: pp },
    { id: 'pot10', kind: 'potion', name: 'Bình máu x10', price: Math.max(1, pp * 10 - Math.round(30 * shopMult())) }
  ];
  ['common', 'rare'].forEach((rarity) => items.SLOTS.forEach((slot) => {
    list.push({ id: slot + ':' + rarity, kind: 'gear', slot, rarity, ilvl: lv, price: gearPrice(rarity, lv),
      item: { slot, rarity, ilvl: lv, enh: 0, name: items.BASE[slot] + ' ' + items.RNAME[rarity], stats: items.statsFor(slot, rarity, lv, 0) } });
  }));
  return list;
}
function shopView(p) { return { t: 'market', kind: 'shop', level: shopLv(p), list: shopList(p) }; }
function shopBuy(p, m) {
  if (!throttle(p, 'shop', 250)) return;
  if (!near(p, NPC, SHOP_RANGE)) return sys(p, 'Hãy lại gần NPC ở giữa làng để mua đồ.');
  const e = shopList(p).find((x) => x.id === m.id); if (!e) return;
  const d = p.data;
  if (d.gold < e.price) return sys(p, 'Bạn không đủ vàng.');
  if (e.kind === 'potion') {
    const n = e.id === 'pot10' ? 10 : 1;
    if (d.potions + n > 999) return sys(p, 'Bạn mang đủ bình máu rồi.');
    d.gold -= e.price; d.potions += n; sys(p, 'Đã mua ' + e.name + ' với giá ' + e.price + ' vàng.');
  } else {
    if (d.inv.length >= INV) return sys(p, 'Túi đồ đã đầy.');
    d.gold -= e.price; const it = items.makeItem(e.slot, e.rarity, e.ilvl); d.inv.push(it);
    sys(p, 'Đã mua ' + it.name + ' với giá ' + e.price + ' vàng.');
  }
  C.pushMe(p); C.saveNow(p);
}
function expireMarket() {
  try {
    const rows = db.all('SELECT * FROM market WHERE expires_at <= ?', now());
    rows.forEach((row) => {
      const r = db.run('DELETE FROM market WHERE id = ?', row.id); if (r.changes !== 1) return;
      let it = null; try { it = items.validItem(JSON.parse(row.item)); } catch (e) { /* ignore */ }
      if (it) C.sendMail([row.seller_id], 'Chợ', 'Món ' + it.name + ' hết hạn đăng bán, trả lại cho bạn', { items: [it] });
    });
  } catch (e) { console.error('market expire', e.message); }
}

/* ---------- enhancement ---------- */
function onEnhance(p, m) {
  if (!throttle(p, 'enh', 300)) return;
  const d = p.data; let it = d.inv.find((x) => x.id === m.id);
  if (!it) for (const sl of items.SLOTS) if (d.eq[sl] && d.eq[sl].id === m.id) it = d.eq[sl];
  if (!it) return;
  const enh = it.enh || 0;
  if (enh >= items.MAX_ENH) return sys(p, 'Món này đã đạt cấp cường hóa tối đa.');
  const cost = items.enhCost(it);
  if (d.gold < cost) return sys(p, 'Cần ' + cost + ' vàng để cường hóa.');
  d.gold -= cost;
  const ok = Math.random() < items.enhChance(enh);
  let warded = false;
  if (ok) it.enh = enh + 1;
  else if (enh >= 5) {
    /* step 11: from +7 a protection charm (crafted in the smith tab, kept in the material store) is used automatically instead of losing a level */
    const zn = p.zn;
    if (enh >= 7 && zn && (zn.mats.ward | 0) > 0) { zn.mats.ward--; zn.dirty = true; warded = true; sys(p, 'Bùa bảo hộ đã được dùng: món đồ không bị tụt cấp.'); }
    else it.enh = enh - 1;
  }
  it.stats = items.statsFor(it.slot, it.rarity, it.ilvl, it.enh || 0);
  it.name = items.withEnhName(it.name, it.enh || 0);
  bump(p, 'enh', 1);
  if (ok) { p.soc.st.enhMax = Math.max(p.soc.st.enhMax, it.enh); p.socDirty = true; checkAch(p); }
  send(p, { t: 'enh', ok, id: it.id, enh: it.enh || 0, name: it.name, cost, lost: !ok && enh >= 5 && !warded });
  C.pushMe(p); saveSoc(p);
}

/* ---------- ranking ---------- */
let rankCache = { at: 0, v: null };
function onRank(p) {
  if (!throttle(p, 'rank', 1500)) return;
  if (now() - rankCache.at > 30000) {
    const t = now();
    const base = "FROM characters c JOIN users u ON u.id = c.user_id WHERE u.role = 'player' AND COALESCE(u.banned_until, 0) < ?";
    rankCache = { at: t, v: {
      level: db.all('SELECT u.username AS name, c.level AS level, c.gold AS gold ' + base + ' ORDER BY c.level DESC, c.gold DESC LIMIT 20', t),
      gold: db.all('SELECT u.username AS name, c.level AS level, c.gold AS gold ' + base + ' ORDER BY c.gold DESC LIMIT 20', t),
      guilds: db.all('SELECT g.name AS name, g.funds AS funds, (SELECT COUNT(*) FROM guild_members m WHERE m.guild_id = g.id) AS members FROM guilds g ORDER BY g.funds DESC LIMIT 20').map((g) => Object.assign(g, { level: glevel(g.funds) }))
    } };
  }
  send(p, Object.assign({ t: 'rank' }, rankCache.v));
}

/* ---------- emotes ---------- */
const EMOTES = { wave: 'vẫy tay chào', dance: 'nhảy múa', laugh: 'cười ha ha', cry: 'khóc hu hu', cheer: 'reo hò', bow: 'cúi chào', sleep: 'ngáp ngủ' };
function onEmote(p, m) {
  const e = String(m.e || ''); if (!EMOTES[e] || !throttle(p, 'emote', 1500)) return;
  C.online.forEach((o) => { if (o.id === p.id || near(o, p, 45)) send(o, { t: 'emote', id: p.id, name: p.name, e, text: EMOTES[e] }); });
}

/* ---------- hooks used by game.js ---------- */
function handle(p, m) {
  try {
    switch (m.t) {
      case 'party': return onParty(p, m);
      case 'pchat': return onPChat(p, m);
      case 'guild': return onGuild(p, m);
      case 'gchat': return onGChat(p, m);
      case 'trade': return onTrade(p, m);
      case 'market': return onMarket(p, m);
      case 'enhance': return onEnhance(p, m);
      case 'rank': return onRank(p);
      case 'daily': return onDaily(p, m);
      case 'emote': return onEmote(p, m);
      default: return undefined;
    }
  } catch (e) { console.error('social error', m.t, e); sys(p, 'Có lỗi máy chủ, hãy thử lại sau.'); return undefined; }
}
function onConnect(p) {
  try {
    loadSoc(p); p.party = null;
    const g = gq(p.id); p.gid = g ? g.id : null;
    send(p, { t: 'party', party: null });
    send(p, { t: 'guild', guild: p.gid ? guildView(p.gid) : null });
    send(p, dailyView(p));
    if (p.gid) pushGuild(p.gid);
    if (!p.soc.loginClaimed) sys(p, 'Bạn có quà đăng nhập hôm nay. Mở bảng Xã hội (phím K), tab Nhiệm vụ để nhận.');
  } catch (e) { console.error('social connect', e); }
}
function onLeave(p) {
  try {
    const tr = trades.get(p.id); if (tr) endTrade(tr, 'Đối phương đã rời game. Giao dịch bị hủy.');
    partyInv.delete(p.id); guildInv.delete(p.id); tradeReq.delete(p.id);
    if (p.party) leaveParty(p);
    saveSoc(p);
    if (p.gid) pushGuild(p.gid);
  } catch (e) { console.error('social leave', e); }
}
/* Party members near the kill share it (EXP, gold, loot) even if they did not hit the monster. */
function expandKill(e, contributors) {
  const set = new Map(); contributors.forEach((p) => set.set(p.id, p));
  contributors.forEach((p) => {
    if (!p.party) return;
    p.party.members.forEach((id) => {
      if (set.has(id)) return; const o = C.online.get(id);
      if (o && !o.dead && Math.hypot(o.x - e.x, o.z - e.z) < 60) set.set(id, o);
    });
  });
  const list = [...set.values()];
  list.forEach((p) => { bump(p, 'kills', 1); if (e.type === 'gufo') bump(p, 'gufo', 1); else if (e.type === 'teieretta') bump(p, 'teieretta', 1); else if (e.d.boss) bump(p, 'boss', 1); });
  return list;
}
/* EXP multiplier: +8% per extra nearby party member, +2% per guild level. */
function expMult(p, contributors) {
  let m = 1 + guildLevelOf(p) * 0.02;
  if (p.party) { const n = contributors.filter((o) => o.party === p.party).length; m += 0.08 * (Math.min(n, PARTY_MAX) - 1); }
  try { m *= require('./character').expBonus(p); } catch (e) { /* character module not installed yet */ }
  try { m *= require('./zones').expBonus(p); } catch (e) { /* zones module not installed yet */ }
  try { m *= require('./events').expMult(); } catch (e) { /* events module not installed yet */ }
  return m;
}

module.exports = { init, handle, onConnect, onLeave, expandKill, expMult };
