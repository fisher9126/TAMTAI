'use strict';
/* Aetherfall step 4 (server): timed events (x2 EXP, more drops, ...), the scheduled world boss, and the admin API for
   events, world boss, guilds, market, trades, professions, dungeon and statistics. Everything is saved in SQLite so a restart keeps
   running events and the boss schedule. */
const db = require('./db');
const items = require('../public/js/items.js');
const rules = require('../public/js/rules.js');

db.exec('CREATE TABLE IF NOT EXISTS ev_kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
db.exec('CREATE TABLE IF NOT EXISTS wboss_log (id INTEGER PRIMARY KEY AUTOINCREMENT, started_at INTEGER, ended_at INTEGER, result TEXT, top TEXT)');

let C = null; // { online, send, broadcast, sendMail, logAdmin, world }
const now = () => Date.now();
const J = JSON.stringify;
const W = rules.WORLD;
const kvGet = (k, d) => { const r = db.get('SELECT v FROM ev_kv WHERE k = ?', k); if (!r) return d; try { return JSON.parse(r.v); } catch (e) { return d; } };
const kvSet = (k, v) => db.run('INSERT INTO ev_kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, J(v));
const announce = (text) => C.broadcast({ t: 'announce', text });
const pubOf = (e) => ({ id: e.id, type: e.type, lv: e.lv, maxHp: e.maxHp, hp: e.hp, x: +e.x.toFixed(2), z: +e.z.toFixed(2), f: +e.f.toFixed(2), dead: !!e.dead });

/* ---------- timed events ---------- */
const TYPES = {
  exp: { name: 'Nhân kinh nghiệm', min: 1.1, max: 5, def: 2 },
  drop: { name: 'Tăng tỉ lệ rơi đồ', min: 1.1, max: 5, def: 2 },
  gold: { name: 'Tăng vàng rơi từ quái', min: 1.1, max: 5, def: 2 },
  gather: { name: 'Tăng sản lượng khai thác', min: 1.1, max: 4, def: 2 },
  shop: { name: 'Giảm giá cửa hàng NPC', min: 0.1, max: 0.95, def: 0.5 }
};
let events = kvGet('events', []).filter((e) => e && TYPES[e.type] && e.until > now() && Number.isFinite(e.mult));
const active = () => { const t = now(); return events.filter((e) => e.until > t); };
const multOf = (type) => { const e = active().find((x) => x.type === type); return e ? e.mult : 1; };
const fmtMult = (type, m) => (type === 'shop' ? 'giá ' + Math.round(m * 100) + '%' : 'x' + m);
function eventList() { return active().map((e) => ({ type: e.type, name: TYPES[e.type].name, mult: e.mult, left: Math.max(0, Math.round((e.until - now()) / 1000)) })); }
function pushEvents(p) { const msg = { t: 'event', list: eventList() }; if (p) C.send(p, msg); else C.broadcast(msg); }
function startEvent(type, mult, minutes, by) {
  const T = TYPES[type]; if (!T) return null;
  mult = Math.max(T.min, Math.min(T.max, Math.round(Number(mult) * 100) / 100 || T.def));
  minutes = Math.max(1, Math.min(10080, Math.round(Number(minutes)) || 60));
  events = active().filter((e) => e.type !== type);
  events.push({ type, mult, until: now() + minutes * 60000, by: by || '' });
  kvSet('events', events);
  announce('Sự kiện "' + T.name + ' (' + fmtMult(type, mult) + ')" bắt đầu, kéo dài ' + (minutes >= 120 ? Math.round(minutes / 60) + ' giờ' : minutes + ' phút') + '!');
  pushEvents(); return { type, mult, minutes };
}
function stopEvent(type) {
  const ev = active().find((e) => e.type === type); if (!ev) return false;
  events = active().filter((e) => e.type !== type); kvSet('events', events);
  announce('Sự kiện "' + TYPES[type].name + '" đã kết thúc.'); pushEvents(); return true;
}
function expireEvents() {
  const t = now(), gone = events.filter((e) => e.until <= t);
  if (!gone.length) return;
  events = events.filter((e) => e.until > t); kvSet('events', events);
  gone.forEach((e) => announce('Sự kiện "' + TYPES[e.type].name + '" đã kết thúc. Cảm ơn mọi người đã tham gia!'));
  pushEvents();
}

/* ---------- world boss ---------- */
let wbCfg = Object.assign({ enabled: true, hours: [12, 20], lastKey: '', warnKey: '' }, kvGet('wboss_cfg', {}));
const saveCfg = () => kvSet('wboss_cfg', wbCfg);
let wb = null; // { e, startedAt, endsAt, dmg: Map(uid -> damage), state: 'alive'|'dead', doneAt, lastHud, by }
const vn = () => new Date(now() + 7 * 3600e3); // use getUTC* on it to read Vietnam time
const keyOf = (d) => d.toISOString().slice(0, 13);
const nameOf = (uid) => { const o = C.online.get(uid); if (o) return o.name; const r = db.get('SELECT username FROM users WHERE id = ?', uid); return r ? r.username : '#' + uid; };
const rndSlot = () => items.SLOTS[Math.floor(Math.random() * items.SLOTS.length)];

function bossMsg(st, extra) {
  const e = wb && wb.e;
  return Object.assign({ t: 'wboss', st, name: e ? e.d.name : '', hp: e ? Math.max(0, Math.round(e.hp)) : 0, maxHp: e ? e.maxHp : 0, x: W.WBOSS.x, z: W.WBOSS.z, left: wb ? Math.max(0, Math.round((wb.endsAt - now()) / 1000)) : 0 }, extra || {});
}
function bossStatus() {
  if (!wb) return { state: 'none' };
  return { state: wb.state, name: wb.e.d.name, hp: Math.max(0, Math.round(wb.e.hp)), maxHp: wb.e.maxHp, left: Math.max(0, Math.round((wb.endsAt - now()) / 1000)), fighters: wb.dmg.size, by: wb.by };
}
function spawnWorldBoss(by) {
  if (wb) return false;
  const c = W.WBOSS;
  const e = C.world.spawnAt('wboss', c.x, c.z, { arena: { x: c.x, z: c.z } });
  wb = { e, startedAt: now(), endsAt: now() + 30 * 60000, dmg: new Map(), state: 'alive', doneAt: 0, lastHud: 0, by: by || '' };
  announce('BOSS THẾ GIỚI ' + e.d.name + ' đã xuất hiện ở Bãi Tế Thần (phía Đông)! Hãy rủ bạn bè đến hạ nó trong 30 phút.');
  C.broadcast({ t: 'espawn', e: pubOf(e) });
  C.broadcast(bossMsg('spawn'));
  return true;
}
function dropBoss() {
  if (!wb) return;
  const id = wb.e.id; C.world.despawn(wb.e); C.broadcast({ t: 'erem', ids: [id] }); wb = null;
}
function bossDead() {
  const e = wb.e;
  wb.state = 'dead'; wb.doneAt = now() + 60000;
  const list = [...wb.dmg.entries()].map((x) => ({ uid: x[0], dmg: x[1], name: nameOf(x[0]) })).sort((a, b) => b.dmg - a.dmg);
  const total = list.reduce((s, x) => s + x.dmg, 0) || 1, need = e.maxHp * 0.005;
  list.forEach((x, i) => {
    if (x.dmg < need) return;
    const share = x.dmg / total;
    const payload = { gold: Math.round(300 + share * 3000), potions: 3, items: [] };
    if (i === 0) payload.items.push(items.makeItem(rndSlot(), 'legend', 25));
    else if (i < 3) payload.items.push(items.makeItem(rndSlot(), 'epic', 25));
    try { if (!C.sendMail) throw new Error('chua co sendMail'); C.sendMail([x.uid], 'Boss thế giới', 'Phần thưởng hạng ' + (i + 1) + ' (' + Math.round(share * 100) + '% sát thương)', payload); } catch (err) { console.error('wboss mail', err.message); }
  });
  const top = list.slice(0, 3).map((x, i) => (i + 1) + '. ' + x.name + ' (' + Math.round(x.dmg / total * 100) + '%)').join(' · ');
  announce('Boss thế giới ' + e.d.name + ' đã bị hạ! Sát thương cao nhất: ' + (top || 'không ai') + '. Phần thưởng đã gửi vào hộp thư.');
  db.run('INSERT INTO wboss_log (started_at, ended_at, result, top) VALUES (?, ?, ?, ?)', wb.startedAt, now(), 'win', J(list.slice(0, 10)));
  C.broadcast(bossMsg('dead', { top: list.slice(0, 3).map((x) => ({ name: x.name, dmg: x.dmg })) }));
}
function bossGone(why) {
  announce('Boss thế giới đã biến mất' + (why ? ' (' + why + ')' : ' vì không ai hạ được nó kịp giờ') + '.');
  db.run('INSERT INTO wboss_log (started_at, ended_at, result, top) VALUES (?, ?, ?, ?)', wb.startedAt, now(), why || 'timeout', '[]');
  C.broadcast(bossMsg('gone')); dropBoss();
}
/* the map of "who hit this monster for how much" that world.js keeps on each enemy; its property name is looked up so a different name still works */
function damageMap(e) {
  for (const k of ['dmgBy', 'dmg', 'dmgMap', 'contrib', 'hitBy', 'damagers', 'attackers']) if (e[k] instanceof Map) return e[k];
  for (const k of Object.keys(e)) if (e[k] instanceof Map) return e[k];
  return null;
}
function bossTick() {
  if (!wb) return;
  const e = wb.e, t = now();
  if (wb.state === 'alive') {
    const mp = damageMap(e);
    if (mp) mp.forEach((v, uid) => { const n = typeof v === 'number' ? v : (v && (v.dmg || v.damage)) || 0; if (n > 0) wb.dmg.set(uid, n); });
    if (e.dead) return bossDead();
    if (t >= wb.endsAt) return bossGone();
    if (t - wb.lastHud >= 5000) { wb.lastHud = t; C.broadcast(bossMsg('hud')); }
  } else if (t >= wb.doneAt) { C.broadcast(bossMsg('cleared')); dropBoss(); }
}
function scheduleTick() {
  if (!wbCfg.enabled || wb) return;
  const d = vn(), h = d.getUTCHours(), m = d.getUTCMinutes(), key = keyOf(d);
  if (m >= 55 && wbCfg.hours.includes((h + 1) % 24)) {
    const wk = keyOf(new Date(d.getTime() + 3600e3));
    if (wbCfg.warnKey !== wk) { wbCfg.warnKey = wk; saveCfg(); announce('Boss thế giới sẽ xuất hiện ở Bãi Tế Thần sau ' + (60 - m) + ' phút! Chuẩn bị bình máu và rủ bạn bè.'); }
  }
  if (m < 5 && wbCfg.hours.includes(h) && wbCfg.lastKey !== key) { wbCfg.lastKey = key; saveCfg(); spawnWorldBoss('lịch tự động'); }
}

/* ---------- hooks used by game.js / social.js / zones.js ---------- */
function onConnect(p) { try { pushEvents(p); if (wb && wb.state === 'alive') C.send(p, bossMsg('hud')); } catch (err) { console.error('events connect', err.message); } }
function init(ctx) {
  C = ctx;
  setInterval(() => { try { expireEvents(); bossTick(); scheduleTick(); } catch (err) { console.error('events tick', err.message); } }, 1000).unref();
}

/* ---------- admin API ---------- */
const GL = [0, 2000, 8000, 25000, 70000, 150000];
const glevel = (funds) => { let l = 1; GL.forEach((t, i) => { if (funds >= t) l = i + 1; }); return l; };
function adminRoutes(game) {
  const bad = (code, msg) => Object.assign(new Error(msg), { status: code });
  const log = (u, action, target, detail) => { try { C.logAdmin(u.id, action, target, detail); } catch (err) { /* ignore */ } };
  return [
    ['GET', /^\/api\/admin\/game\/state$/, false, () => ({
      types: Object.keys(TYPES).map((k) => Object.assign({ type: k }, TYPES[k])),
      events: eventList(), wboss: bossStatus(), cfg: { enabled: wbCfg.enabled, hours: wbCfg.hours },
      history: db.all('SELECT started_at, ended_at, result, top FROM wboss_log ORDER BY id DESC LIMIT 10').map((r) => { let top = []; try { top = JSON.parse(r.top).slice(0, 3); } catch (e) { /* ignore */ } return { started_at: r.started_at, ended_at: r.ended_at, result: r.result, top }; }),
      online: C.online.size
    })],
    ['POST', /^\/api\/admin\/game\/event\/start$/, true, (req, u, m, q, b) => {
      if (!TYPES[b.type]) throw bad(400, 'Loại sự kiện không hợp lệ.');
      const r = startEvent(b.type, b.mult, b.minutes, u.username);
      log(u, 'event_start', null, TYPES[b.type].name + ' ' + fmtMult(b.type, r.mult) + ' trong ' + r.minutes + ' phút');
      return { ok: true, message: 'Đã bật sự kiện ' + TYPES[b.type].name + ' (' + fmtMult(b.type, r.mult) + ', ' + r.minutes + ' phút).' };
    }],
    ['POST', /^\/api\/admin\/game\/event\/stop$/, true, (req, u, m, q, b) => {
      if (!stopEvent(String(b.type))) throw bad(404, 'Sự kiện này không đang chạy.');
      log(u, 'event_stop', null, String(b.type)); return { ok: true, message: 'Đã tắt sự kiện.' };
    }],
    ['POST', /^\/api\/admin\/game\/wboss\/spawn$/, true, (req, u) => {
      if (!spawnWorldBoss(u.username)) throw bad(400, 'Boss thế giới đang có mặt rồi.');
      log(u, 'wboss_spawn', null, 'Triệu hồi thủ công'); return { ok: true, message: 'Đã triệu hồi boss thế giới.' };
    }],
    ['POST', /^\/api\/admin\/game\/wboss\/cancel$/, true, (req, u) => {
      if (!wb) throw bad(400, 'Không có boss thế giới nào.');
      if (wb.state === 'alive') bossGone('ban quan tri huy'); else dropBoss();
      log(u, 'wboss_cancel', null, ''); return { ok: true, message: 'Đã hủy boss thế giới.' };
    }],
    ['POST', /^\/api\/admin\/game\/wboss\/config$/, true, (req, u, m, q, b) => {
      const hours = (Array.isArray(b.hours) ? b.hours : []).map((x) => Math.round(Number(x))).filter((x) => x >= 0 && x <= 23);
      wbCfg.enabled = !!b.enabled; wbCfg.hours = [...new Set(hours)].sort((a, c) => a - c).slice(0, 8); saveCfg();
      log(u, 'wboss_config', null, (wbCfg.enabled ? 'bật' : 'tắt') + ' · giờ ' + wbCfg.hours.join(','));
      return { ok: true, message: 'Đã lưu lịch boss thế giới (giờ Việt Nam).' };
    }],
    ['GET', /^\/api\/admin\/game\/guilds$/, false, () => ({
      guilds: db.all(`SELECT g.id, g.name, g.funds, g.motd, g.created_at, u.username AS leader, (SELECT COUNT(*) FROM guild_members m WHERE m.guild_id = g.id) AS members
                      FROM guilds g LEFT JOIN users u ON u.id = g.leader_id ORDER BY g.funds DESC LIMIT 200`).map((g) => Object.assign(g, { level: glevel(g.funds) }))
    })],
    ['GET', /^\/api\/admin\/game\/guild\/(\d+)$/, false, (req, u, m) => ({
      members: db.all(`SELECT m.user_id AS id, m.rank, m.contrib, m.joined_at, us.username AS name, COALESCE(c.level, 1) AS level
                       FROM guild_members m JOIN users us ON us.id = m.user_id LEFT JOIN characters c ON c.user_id = m.user_id WHERE m.guild_id = ? ORDER BY m.rank DESC, m.contrib DESC`, Number(m[1]))
    })],
    ['POST', /^\/api\/admin\/game\/guild\/(\d+)\/disband$/, true, (req, u, m) => {
      const id = Number(m[1]), g = db.get('SELECT name FROM guilds WHERE id = ?', id);
      if (!g) throw bad(404, 'Không tìm thấy bang hội.');
      db.tx(() => { db.run('DELETE FROM guild_members WHERE guild_id = ?', id); db.run('DELETE FROM guilds WHERE id = ?', id); });
      C.online.forEach((p) => { if (p.gid === id) { p.gid = null; C.send(p, { t: 'guild', guild: null }); C.send(p, { t: 'sys', text: 'Bang hội ' + g.name + ' đã bị ban quản trị giải tán.' }); } });
      log(u, 'guild_disband', null, g.name); return { ok: true, message: 'Đã giải tán bang ' + g.name + '.' };
    }],
    ['GET', /^\/api\/admin\/game\/market$/, false, () => ({
      list: db.all('SELECT id, seller_id, seller_name, item, slot, rarity, price, created_at, expires_at FROM market ORDER BY id DESC LIMIT 200').map((r) => {
        let it = null; try { it = JSON.parse(r.item); } catch (e) { /* ignore */ }
        return { id: r.id, seller_id: r.seller_id, seller: r.seller_name, name: it ? it.name : '?', ilvl: it ? it.ilvl : 0, enh: it ? it.enh || 0 : 0, rarity: r.rarity, slot: r.slot, price: r.price, created_at: r.created_at, expires_at: r.expires_at };
      })
    })],
    ['POST', /^\/api\/admin\/game\/market\/(\d+)\/remove$/, false, (req, u, m) => {
      const id = Number(m[1]), row = db.get('SELECT * FROM market WHERE id = ?', id);
      if (!row) throw bad(404, 'Món này không còn trên chợ.');
      if (!C.sendMail) throw bad(501, 'Máy chủ chưa có chức năng gửi thư nên chưa gỡ được món (sợ mất đồ của người bán).');
      const r = db.run('DELETE FROM market WHERE id = ?', id); if (r.changes !== 1) throw bad(409, 'Món này vừa được bán hoặc gỡ.');
      let it = null; try { it = items.validItem(JSON.parse(row.item)); } catch (e) { /* ignore */ }
      if (it) C.sendMail([row.seller_id], 'Ban quản trị', 'Món ' + it.name + ' bị gỡ khỏi chợ, trả lại cho bạn', { items: [it] });
      log(u, 'market_remove', row.seller_id, (it ? it.name : '?') + ' giá ' + row.price); return { ok: true, message: 'Đã gỡ và trả đồ về hộp thư của người bán.' };
    }],
    ['GET', /^\/api\/admin\/game\/trades$/, false, () => ({
      trades: db.all(`SELECT t.id, t.detail, t.created_at, a.username AS a_name, b.username AS b_name FROM trade_log t
                      LEFT JOIN users a ON a.id = t.a_id LEFT JOIN users b ON b.id = t.b_id ORDER BY t.id DESC LIMIT 150`)
    })],
    ['GET', /^\/api\/admin\/game\/zones$/, false, () => {
      let rows = [];
      try { rows = db.all('SELECT z.user_id, z.data, us.username FROM zone_player z JOIN users us ON us.id = z.user_id'); } catch (err) { rows = []; }
      const players = rows.map((r) => { let d = {}; try { d = JSON.parse(r.data); } catch (e) { /* ignore */ }
        const prof = {}; let sum = 0; Object.keys(rules.PROFS).forEach((k) => { const lv = d.prof && d.prof[k] ? d.prof[k].lv | 0 : 1; prof[k] = lv; sum += lv; });
        return { id: r.user_id, name: r.username, prof, sum, clears: d.dun ? d.dun.clears | 0 : 0 };
      }).sort((a, b) => b.sum - a.sum);
      let runs = []; try { runs = require('./zones').stats().runs; } catch (err) { /* zones module missing */ }
      return { players: players.slice(0, 50), total: players.length, clears: players.reduce((s, x) => s + x.clears, 0), runs, profs: Object.keys(rules.PROFS).map((k) => ({ id: k, name: rules.PROFS[k].name })) };
    }],
    ['GET', /^\/api\/admin\/game\/stats$/, false, () => {
      const since = now() - 14 * 864e5;
      const signups = db.all("SELECT strftime('%Y-%m-%d', (created_at / 1000) + 25200, 'unixepoch') AS d, COUNT(*) AS n FROM users WHERE created_at > ? GROUP BY d ORDER BY d", since);
      const levels = db.all('SELECT level AS l, COUNT(*) AS n FROM characters GROUP BY level ORDER BY level');
      const gold = db.get('SELECT COALESCE(SUM(gold), 0) AS s, COALESCE(AVG(gold), 0) AS a FROM characters');
      return { signups, levels, goldTotal: gold.s, goldAvg: Math.round(gold.a), market: db.get('SELECT COUNT(*) AS n, COALESCE(SUM(price), 0) AS v FROM market'), guilds: db.get('SELECT COUNT(*) AS n FROM guilds').n };
    }]
  ];
}

module.exports = { init, onConnect, adminRoutes, expMult: () => multOf('exp'), dropMult: () => multOf('drop'), goldMult: () => multOf('gold'), gatherMult: () => multOf('gather'), shopMult: () => multOf('shop') };
