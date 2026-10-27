'use strict';
/* Aetherfall step 13 (server plugin of zones.js, also called by combat.js): PvP.
   - Free PvP ring in the desert (rules.WORLD.PVPZ): level 10+, anyone can hit anyone except party and guild mates. Kills give honor.
   - Battleground (chiến trường): team deathmatch in a room in the west. Queue, balanced teams, first to 15 kills or 6 minutes. Honor, gold and EXP.
   - Siege (công thành): the Pháo Đài Valdren circle. Every Saturday 20:00-20:30 (Vietnam time) guilds fight for control: a guild scores while it
     holds the circle alone, and +5 per kill. The winning guild keeps +5% EXP for its members and gets 3000 gold in its fund until the next siege.
   combat.js asks pvpActive(p) / canHit(a, b) before it lets a normal attack hit another player, and calls pvpDeath(killer, victim). */
const rules = require('../public/js/rules.js');
const W = rules.WORLD;
let C = null, API = null;
const now = () => Date.now();
const FREE = W.PVPZ, FORT = W.FORT;
const BG = { x: -72, z: -56, r: 10, minLv: 10, win: 15, ms: 6 * 60000, queueWait: 15000 };
const SIEGE = { minLv: 20, ms: 30 * 60000, minPts: 60, killPts: 5, fund: 3000, day: 6, hour: 20, bonus: 1.05 };
const VILLAGE_R = 50;

let queue = []; // [{ id, at }]
const matches = new Map(); // id -> match
let mseq = 1;
let siege = { live: false, endsAt: 0, pts: new Map(), names: new Map(), warned: '', startedKey: '' };
let holder = null; // { gid, name, at }
const lastKill = new Map(); // killerId + ':' + victimId -> time (anti-farm for honor)

const sys = (p, t) => API.sys(p, t);
const hypot = Math.hypot;
const inFree = (p) => p && !p.dead && (p.data.level || 1) >= 10 && hypot(p.x - FREE.x, p.z - FREE.z) <= FREE.r;
const inFort = (p, m) => p && hypot(p.x - FORT.x, p.z - FORT.z) <= FORT.r + (m || 0);
const bgOf = (p) => { const m = p && p.bgId && matches.get(p.bgId); return m && m.state !== 'gone' ? m : null; };
const vn = () => new Date(now() + 7 * 3600e3);
function kvGet(k, d) { const r = API.db.get('SELECT v FROM pvp_kv WHERE k = ?', k); if (!r) return d; try { return JSON.parse(r.v); } catch (e) { return d; } }
function kvSet(k, v) { API.db.run('INSERT INTO pvp_kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, JSON.stringify(v)); }
function combat() { try { return require('./combat'); } catch (e) { return null; } }
function gname(gid) { const r = API.db.get('SELECT name FROM guilds WHERE id = ?', gid); return r ? r.name : '#' + gid; }

/* ---------- honor ---------- */
function stat(uid) { return API.db.get('SELECT honor, kills, deaths, bgwins FROM pvp_player WHERE user_id = ?', uid) || { honor: 0, kills: 0, deaths: 0, bgwins: 0 }; }
function addStat(uid, honor, k, d, w) {
  API.db.run('INSERT INTO pvp_player (user_id, honor, kills, deaths, bgwins) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET honor = MAX(0, honor + excluded.honor), kills = kills + excluded.kills, deaths = deaths + excluded.deaths, bgwins = bgwins + excluded.bgwins',
    uid, Math.max(0, honor), k, d, w);
}

/* ---------- queries used by combat.js ---------- */
function pvpActive(p) {
  if (!C || !p || p.dead || p.hp <= 0) return false;
  const m = bgOf(p); if (m) return m.state === 'fight';
  if (siege.live && p.gid && (p.data.level || 1) >= SIEGE.minLv && inFort(p, 3)) return true;
  return inFree(p);
}
function canHit(a, b) {
  if (!C || !a || !b || a.id === b.id || b.dead || b.hp <= 0) return false;
  const ma = bgOf(a), mb = bgOf(b);
  if (ma || mb) return ma && ma === mb && ma.state === 'fight' && ma.team.get(a.id) !== ma.team.get(b.id);
  if (siege.live && a.gid && b.gid && inFort(a, 3) && inFort(b, 3) && (a.data.level || 1) >= SIEGE.minLv && (b.data.level || 1) >= SIEGE.minLv) return a.gid !== b.gid;
  if (inFree(a) && inFree(b)) { if (a.party && a.party === b.party) return false; if (a.gid && a.gid === b.gid) return false; return true; }
  return false;
}
const inMatch = (p) => !!bgOf(p);

/* ---------- death hook ---------- */
function pvpDeath(killer, victim) {
  if (!C || !killer || !victim) return;
  const m = bgOf(victim);
  if (m && bgOf(killer) === m && m.state === 'fight') {
    const tk = m.team.get(killer.id); m.score[tk]++; m.kills[killer.id] = (m.kills[killer.id] | 0) + 1;
    addStat(killer.id, 2, 1, 0, 0); addStat(victim.id, 0, 0, 1, 0);
    setTimeout(() => bgRespawn(m, victim), 4000);
    bgHud(m); return;
  }
  if (siege.live && killer.gid && victim.gid && inFort(victim, 3)) {
    siege.pts.set(killer.gid, (siege.pts.get(killer.gid) || 0) + SIEGE.killPts); addStat(killer.id, 3, 1, 0, 0); addStat(victim.id, 0, 0, 1, 0);
    sys(killer, 'Hạ ' + victim.name + ': +' + SIEGE.killPts + ' điểm cho bang.'); return;
  }
  if (inFree(killer) || hypot(victim.x - FREE.x, victim.z - FREE.z) <= FREE.r + 2) {
    const key = killer.id + ':' + victim.id, t = now();
    addStat(victim.id, 0, 0, 1, 0);
    if ((lastKill.get(key) || 0) > t - 120000) return sys(killer, 'Bạn vừa hạ ' + victim.name + ' gần đây nên không nhận danh dự.');
    lastKill.set(key, t);
    const lvK = killer.data.level || 1, lvV = victim.data.level || 1, honor = Math.max(2, Math.min(25, 8 + (lvV - lvK))), gold = 20 + lvV * 2;
    killer.data.gold += gold; addStat(killer.id, honor, 1, 0, 0); C.pushMe(killer);
    sys(killer, 'Hạ ' + victim.name + ': +' + honor + ' danh dự, +' + gold + ' vàng.'); sys(victim, 'Bạn bị ' + killer.name + ' hạ gục.');
  }
}

/* ---------- battleground ---------- */
function bgPush(m, msg) { m.players.forEach((id) => { const o = C.online.get(id); if (o) C.send(o, msg); }); }
function bgHud(m) {
  const t = now();
  bgPush(m, { t: 'bg', st: 'hud', state: m.state, score: m.score, win: BG.win, secs: Math.max(0, Math.round(((m.state === 'count' ? m.fightAt : m.endsAt) - t) / 1000)),
    top: Object.keys(m.kills).map((id) => ({ id: Number(id), n: m.kills[id], team: m.team.get(Number(id)), name: (C.online.get(Number(id)) || {}).name || '#' + id })).sort((a, b) => b.n - a.n).slice(0, 5) });
}
function spawnOf(m, uid) { const tm = m.team.get(uid); return { x: BG.x + (tm === 0 ? -6 : 6) + (Math.random() - 0.5) * 2, z: BG.z + (Math.random() - 0.5) * 6 }; }
function bgPlace(m, o) {
  const s = spawnOf(m, o.id); o.x = s.x; o.z = s.z; o.dirty = true; C.send(o, { t: 'correct', x: o.x, z: o.z });
}
function bgRespawn(m, o) {
  if (m.state !== 'fight' || !m.players.has(o.id) || !C.online.get(o.id)) return;
  const cb = combat(); if (cb) { cb.respawn(o); o.dead = false; cb.fullHeal(o); }
  bgPlace(m, o); C.send(o, { t: 'revived' });
}
function exitOut(o) { o.x = W.SPAWN.x + (Math.random() - 0.5) * 3; o.z = W.SPAWN.z + (Math.random() - 0.5) * 3; o.dirty = true; C.send(o, { t: 'correct', x: o.x, z: o.z }); }
function startMatch(ids) {
  const ps = ids.map((id) => C.online.get(id)).filter(Boolean).sort((a, b) => (b.data.level || 1) - (a.data.level || 1));
  if (ps.length < 2) { ps.forEach((p) => { sys(p, 'Không đủ người để mở trận.'); }); return; }
  const m = { id: mseq++, players: new Set(), team: new Map(), score: [0, 0], kills: {}, state: 'count', fightAt: now() + 8000, endsAt: now() + 8000 + BG.ms, away: {}, closeAt: 0 };
  ps.forEach((p, i) => { const tm = [0, 1, 1, 0][i % 4]; m.team.set(p.id, tm); m.players.add(p.id); p.bgId = m.id; });
  matches.set(m.id, m);
  const cb = combat();
  ps.forEach((p) => {
    if (cb) { cb.respawn(p); p.dead = false; cb.fullHeal(p); }
    if (p.mv && p.mv.active) { p.mv.active = null; p.data.mountSpd = 0; }
    bgPlace(m, p);
    C.send(p, { t: 'bg', st: 'start', team: m.team.get(p.id), n: ps.length, win: BG.win, ms: BG.ms });
    sys(p, 'Chiến trường bắt đầu sau 8 giây! Bạn thuộc đội ' + (m.team.get(p.id) === 0 ? 'Xanh' : 'Đỏ') + '. Đội nào đạt ' + BG.win + ' lượt hạ gục trước hoặc nhiều hơn khi hết ' + (BG.ms / 60000) + ' phút sẽ thắng.');
  });
}
function finishMatch(m, forced) {
  if (m.state !== 'fight' && m.state !== 'count') return;
  m.state = 'over'; m.closeAt = now() + 8000;
  const win = m.score[0] === m.score[1] ? -1 : m.score[0] > m.score[1] ? 0 : 1;
  m.players.forEach((id) => {
    const o = C.online.get(id); if (!o) return;
    const mine = m.team.get(id), won = win === mine, draw = win === -1, lv = o.data.level || 1;
    const honor = won ? 30 : draw ? 15 : 10, gold = won ? 300 + lv * 10 : 100, exp = Math.round(rules.expNeed(lv) * (won ? 0.15 : 0.05));
    o.data.gold += gold; C.addExp(o, exp); addStat(id, honor, 0, 0, won ? 1 : 0); C.pushMe(o);
    C.send(o, { t: 'bg', st: 'end', win: won, draw, score: m.score, honor, gold, exp, reason: forced || '' });
    sys(o, (draw ? 'Hòa' : won ? 'Đội bạn thắng' : 'Đội bạn thua') + ' (' + m.score[0] + ' - ' + m.score[1] + '): +' + honor + ' danh dự, +' + gold + ' vàng, +' + exp + ' EXP.');
  });
}
function bgTick(t) {
  // matchmaking
  queue = queue.filter((q) => { const o = C.online.get(q.id); return o && !o.dead && !bgOf(o); });
  if (queue.length >= 2 && (queue.length >= 6 || t - queue[0].at >= BG.queueWait)) {
    const take = queue.splice(0, 10); const ids = take.map((q) => q.id);
    startMatch(ids);
  }
  queue.forEach((q) => { const o = C.online.get(q.id); if (o && Math.random() < 0.2) C.send(o, { t: 'bg', st: 'queue', n: queue.length, waited: Math.round((t - q.at) / 1000) }); });
  matches.forEach((m) => {
    if (m.state === 'gone') return;
    if (m.state === 'over') { if (t >= m.closeAt) { m.players.forEach((id) => { const o = C.online.get(id); if (o) { o.bgId = null; if (hypot(o.x - BG.x, o.z - BG.z) <= BG.r + 6) exitOut(o); C.send(o, { t: 'bg', st: 'left' }); } }); m.state = 'gone'; matches.delete(m.id); } return; }
    if (m.state === 'count' && t >= m.fightAt) { m.state = 'fight'; bgPush(m, { t: 'bg', st: 'go' }); }
    // drop absent players
    m.players.forEach((id) => {
      const o = C.online.get(id), out = !o || (hypot(o.x - BG.x, o.z - BG.z) > BG.r + 5 && !o.dead);
      m.away[id] = out ? (m.away[id] | 0) + 1 : 0;
      if (m.away[id] >= 6) { m.players.delete(id); if (o) { o.bgId = null; C.send(o, { t: 'bg', st: 'left' }); } }
    });
    const left = [0, 0]; m.players.forEach((id) => { left[m.team.get(id)]++; });
    if (m.state === 'fight') {
      if (!left[0] || !left[1]) { m.score[left[0] ? 0 : 1] += 0; if (!left[0] && !left[1]) { m.state = 'gone'; matches.delete(m.id); return; } m.score[left[0] ? 0 : 1] = Math.max(m.score[left[0] ? 0 : 1], m.score[left[0] ? 1 : 0] + 1); return finishMatch(m, 'Đội kia đã rời trận.'); }
      if (m.score[0] >= BG.win || m.score[1] >= BG.win || t >= m.endsAt) finishMatch(m, '');
    }
    if (m.state !== 'over') bgHud(m);
  });
}

/* ---------- siege ---------- */
function siegeInfo(forPlayer) {
  const list = [...siege.pts.entries()].map(([gid, pts]) => ({ gid, name: siege.names.get(gid) || gname(gid), pts: Math.round(pts) })).sort((a, b) => b.pts - a.pts).slice(0, 5);
  const d = vn(), dow = d.getUTCDay(), hh = d.getUTCHours() + d.getUTCMinutes() / 60;
  let days = (SIEGE.day - dow + 7) % 7; if (days === 0 && hh >= SIEGE.hour + 0.5) days = 7;
  const nextIn = days * 86400 + Math.round((SIEGE.hour - hh) * 3600);
  return { live: siege.live, secs: siege.live ? Math.max(0, Math.round((siege.endsAt - now()) / 1000)) : 0, pts: list, holder, nextIn: siege.live ? 0 : Math.max(0, nextIn), minLv: SIEGE.minLv };
}
function siegeStart(by) {
  if (siege.live) return false;
  siege = { live: true, endsAt: now() + SIEGE.ms, pts: new Map(), names: new Map(), warned: siege.warned, startedKey: siege.startedKey };
  C.broadcast({ t: 'announce', text: 'CÔNG THÀNH bắt đầu' + (by ? ' (' + by + ')' : '') + '! Các bang hội hãy tiến vào Pháo Đài Valdren để giành quyền kiểm soát trong 30 phút.' });
  return true;
}
function siegeEnd() {
  if (!siege.live) return;
  siege.live = false;
  const best = [...siege.pts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] >= SIEGE.minPts) {
    holder = { gid: best[0], name: siege.names.get(best[0]) || gname(best[0]), at: now() }; kvSet('holder', holder);
    API.db.run('UPDATE guilds SET funds = funds + ? WHERE id = ?', SIEGE.fund, best[0]);
    C.broadcast({ t: 'announce', text: 'Bang hội "' + holder.name + '" đã chiếm Pháo Đài Valdren! Thành viên được +5% EXP cho tới cuộc công thành tiếp theo.' });
  } else C.broadcast({ t: 'announce', text: 'Công thành kết thúc: chưa bang nào chiếm được pháo đài (cần ít nhất ' + SIEGE.minPts + ' điểm).' });
  C.broadcast({ t: 'siege', st: 'holder', holder, info: siegeInfo() });
}
function siegeTick(t) {
  const d = vn(), dow = d.getUTCDay(), hh = d.getUTCHours(), mm = d.getUTCMinutes(), key = d.toISOString().slice(0, 10);
  if (dow === SIEGE.day && hh === SIEGE.hour - 1 && mm >= 55 && siege.warned !== key) { siege.warned = key; C.broadcast({ t: 'announce', text: 'Công thành sẽ bắt đầu sau ' + (60 - mm) + ' phút! Bang hội hãy tập hợp.' }); }
  if (!siege.live && dow === SIEGE.day && hh === SIEGE.hour && mm < 30 && siege.startedKey !== key) { siege.startedKey = key; siegeStart(''); }
  if (!siege.live) return;
  if (t >= siege.endsAt) return siegeEnd();
  const count = new Map();
  C.online.forEach((p) => { if (p.gid && !p.dead && (p.data.level || 1) >= SIEGE.minLv && inFort(p, 0) && !bgOf(p)) count.set(p.gid, (count.get(p.gid) || 0) + 1); });
  if (count.size) {
    const arr = [...count.entries()].sort((a, b) => b[1] - a[1]);
    if (arr.length === 1 || arr[0][1] > arr[1][1]) { siege.pts.set(arr[0][0], (siege.pts.get(arr[0][0]) || 0) + 1); if (!siege.names.has(arr[0][0])) siege.names.set(arr[0][0], gname(arr[0][0])); }
  }
  if (Math.floor(t / 1000) % 2 === 0) {
    const msg = { t: 'siege', st: 'hud', info: siegeInfo() };
    C.online.forEach((p) => { if (p.gid || inFort(p, 70)) C.send(p, msg); });
  }
}

/* ---------- friend lists / state for the client ---------- */
function friendsOf(p) {
  const out = [], m = bgOf(p);
  C.online.forEach((o) => {
    if (o.id === p.id) return;
    if (m) { if (bgOf(o) === m && m.team.get(o.id) === m.team.get(p.id)) out.push(o.id); }
    else if ((p.party && p.party === o.party) || (p.gid && p.gid === o.gid)) out.push(o.id);
  });
  return out;
}
function pushState(p) {
  const act = pvpActive(p), m = bgOf(p);
  const mode = m ? 'bg' : act ? (siege.live && p.gid && inFort(p, 3) ? 'siege' : 'free') : (inFree(p) || (siege.live && inFort(p, 3)) ? 'wait' : null);
  const sig = mode + ':' + (act ? friendsOf(p).join(',') : '');
  if (p.pvpSig === sig) return; p.pvpSig = sig;
  C.send(p, { t: 'pvpstate', mode, active: act, friends: act ? friendsOf(p) : [] });
}

const ops = {
  pinfo(p) {
    const s = stat(p.id), top = API.db.all('SELECT u.username AS name, s.honor AS honor, s.kills AS kills FROM pvp_player s JOIN users u ON u.id = s.user_id ORDER BY s.honor DESC LIMIT 10');
    C.send(p, { t: 'pvpinfo', me: s, top, queued: queue.some((q) => q.id === p.id), inMatch: !!bgOf(p), siege: siegeInfo(p), zone: { x: FREE.x, z: FREE.z, r: FREE.r }, fort: { x: FORT.x, z: FORT.z, r: FORT.r }, bg: { win: BG.win, minLv: BG.minLv, mins: BG.ms / 60000 } });
  },
  bgjoin(p) {
    if (!API.thr(p, 'bgjoin', 800)) return;
    if ((p.data.level || 1) < BG.minLv) return sys(p, 'Cần cấp ' + BG.minLv + ' để vào chiến trường.');
    if (p.dead) return sys(p, 'Bạn đang bị hạ gục.');
    if (API.extOf(p) || API.runOf(p) || bgOf(p)) return sys(p, 'Bạn đang ở trong một phó bản hoặc trận khác.');
    if (queue.some((q) => q.id === p.id)) return;
    queue.push({ id: p.id, at: now() }); sys(p, 'Đã vào hàng chờ chiến trường. Cần ít nhất 2 người; trận mở sau tối đa ' + BG.queueWait / 1000 + ' giây khi có đủ người.');
    C.send(p, { t: 'bg', st: 'queue', n: queue.length, waited: 0 });
  },
  bgleave(p) {
    queue = queue.filter((q) => q.id !== p.id);
    const m = bgOf(p); if (m && m.state !== 'over') { m.players.delete(p.id); p.bgId = null; exitOut(p); }
    C.send(p, { t: 'bg', st: 'left' });
  },
  pexchange(p, m) {
    if (!API.thr(p, 'pex', 400)) return;
    const R = { gem: [50, { gem: 1 }, 'Đá quý'], core: [100, { core: 1 }, 'Lõi tro'], ward: [150, { ward: 1 }, 'Bùa bảo hộ'], gear: [60, { gear: 2 }, 'Bánh răng'] }[String(m.id || '')];
    if (!R || !p.zn) return;
    if (stat(p.id).honor < R[0]) return sys(p, 'Cần ' + R[0] + ' danh dự.');
    addStat(p.id, -R[0], 0, 0, 0); API.giveMats(p.zn, R[1]); sys(p, 'Đã đổi ' + R[0] + ' danh dự lấy ' + R[2] + '.'); API.info(p); ops.pinfo(p);
  },
  siegestart(p) {
    if (p.role !== 'admin' && p.role !== 'gm') return sys(p, 'Chỉ GM hoặc admin mới bắt đầu công thành thủ công được.');
    if (!siegeStart(p.name)) sys(p, 'Công thành đang diễn ra.');
  },
  siegestop(p) { if (p.role !== 'admin' && p.role !== 'gm') return; siegeEnd(); }
};

function init(ctx, api) {
  C = ctx; API = api;
  API.db.exec('CREATE TABLE IF NOT EXISTS pvp_player (user_id INTEGER PRIMARY KEY, honor INTEGER NOT NULL DEFAULT 0, kills INTEGER NOT NULL DEFAULT 0, deaths INTEGER NOT NULL DEFAULT 0, bgwins INTEGER NOT NULL DEFAULT 0)');
  API.db.exec('CREATE TABLE IF NOT EXISTS pvp_kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
  holder = kvGet('holder', null);
}
function onConnect(p) {
  p.bgId = null; p.pvpSig = '';
  if (hypot(p.x - BG.x, p.z - BG.z) <= BG.r + 2) exitOut(p);
  C.send(p, { t: 'siege', st: 'holder', holder, info: siegeInfo() });
}
function onLeave(p) { queue = queue.filter((q) => q.id !== p.id); }
let tickN = 0;
function tick(t) {
  tickN++;
  try { bgTick(t); } catch (err) { console.error('bg tick', err.message); }
  try { siegeTick(t); } catch (err) { console.error('siege tick', err.message); }
  C.online.forEach((p) => { if (tickN % 2 === 0) { try { pushState(p); } catch (err) { /* ignore */ } } });
}
function blocked(p, x, z) { return hypot(x - BG.x, z - BG.z) <= BG.r + 1 && !bgOf(p); }
function expBonus(p) { return holder && p.gid && p.gid === holder.gid ? SIEGE.bonus : 1; }

module.exports = { init, onConnect, onLeave, tick, blocked, expBonus, ops, pvpActive, canHit, pvpDeath, inMatch };
