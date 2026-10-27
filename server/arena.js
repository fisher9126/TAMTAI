'use strict';
/* Aetherfall step 10 (server plugin of zones.js): ranked arena (1v1) with Elo rating, matchmaking queue and monthly seasons.
   Fights reuse the existing duel system in combat.js: the server makes both players meet in the arena corner, then sends an invite and an accept
   through combat.handle. The result is read from the duel_stats table (wins/losses change for the winner/loser). Rating is saved in arena_player.
   A season is one calendar month (Vietnam time): at the start of a new month ratings are halved toward 1000 and the old rating pays a reward. */
let C = null, API = null;
const MIN_LV = 10;                               // the design doc says 40; 10 here so it can be tried early. Change this one number.
const ARENA = { x: -88, z: 0 };                  // west edge of the map, away from every zone
const K = 32, START = 1000, FIGHT_MAX = 6 * 60000;
const now = () => Date.now();
const season = () => new Date(now() + 7 * 3600e3).toISOString().slice(0, 7);
const queue = new Map();                         // uid -> since
const matches = new Set();                       // { a, b, step, at, base:{...}, done }
const combat = () => require('./combat');

function init(ctx, api) {
  C = ctx; API = api;
  API.db.exec('CREATE TABLE IF NOT EXISTS arena_player (user_id INTEGER PRIMARY KEY, rating INTEGER NOT NULL DEFAULT 1000, wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0, streak INTEGER NOT NULL DEFAULT 0, best INTEGER NOT NULL DEFAULT 1000, season TEXT NOT NULL, pending INTEGER NOT NULL DEFAULT 0)');
}
function rewardFor(r) { return r >= 1500 ? 5000 : r >= 1300 ? 2500 : r >= 1150 ? 1000 : 300; }
function get(uid) {
  let r = API.db.get('SELECT * FROM arena_player WHERE user_id = ?', uid);
  if (!r) { API.db.run('INSERT INTO arena_player (user_id, rating, season) VALUES (?, ?, ?)', uid, START, season()); r = API.db.get('SELECT * FROM arena_player WHERE user_id = ?', uid); }
  if (r.season !== season()) { // a new month: pay out the old one, then pull the rating halfway back to 1000
    const played = r.wins + r.losses > 0;
    API.db.run('UPDATE arena_player SET pending = pending + ?, rating = ?, wins = 0, losses = 0, streak = 0, best = ?, season = ? WHERE user_id = ?', played ? rewardFor(r.rating) : 0, Math.round(START + (r.rating - START) / 2), Math.round(START + (r.rating - START) / 2), season(), uid);
    r = API.db.get('SELECT * FROM arena_player WHERE user_id = ?', uid);
  }
  return r;
}
function info(p) {
  const r = get(p.id), rank = API.db.get('SELECT COUNT(*) + 1 AS n FROM arena_player WHERE season = ? AND rating > ? AND wins + losses > 0', season(), r.rating).n;
  C.send(p, { t: 'rqinfo', rating: r.rating, wins: r.wins, losses: r.losses, streak: r.streak, best: r.best, rank: r.wins + r.losses ? rank : 0, season: r.season, pending: r.pending, queued: queue.has(p.id), minLv: MIN_LV, qn: queue.size });
}
const busy = (p) => p.dead || p.run || p.hp <= 0;
const inMatch = (uid) => { for (const m of matches) if (!m.done && (m.a === uid || m.b === uid)) return true; return false; };
const stat = (uid) => API.db.get('SELECT wins, losses FROM duel_stats WHERE user_id = ?', uid) || { wins: 0, losses: 0 };

const ops = {
  rqinfo(p) { info(p); },
  rqjoin(p) {
    if (!API.thr(p, 'rq', 1000)) return;
    if ((p.data.level || 1) < MIN_LV) return API.sys(p, 'Đấu trường xếp hạng mở từ cấp ' + MIN_LV + '.');
    if (!p.prof) return API.sys(p, 'Hãy tạo nhân vật trước.');
    if (busy(p)) return API.sys(p, 'Bạn không thể xếp hàng lúc này (đang chết hoặc trong hầm ngục).');
    if (inMatch(p.id)) return;
    queue.set(p.id, now()); API.sys(p, 'Đã vào hàng chờ đấu trường xếp hạng. Hãy ở yên trong game.'); info(p);
  },
  rqleave(p) { if (queue.delete(p.id)) API.sys(p, 'Đã rời hàng chờ.'); info(p); },
  rqtop(p) {
    const rows = API.db.all('SELECT a.user_id AS id, a.rating, a.wins, a.losses, u.username AS name FROM arena_player a JOIN users u ON u.id = a.user_id WHERE a.season = ? AND a.wins + a.losses > 0 ORDER BY a.rating DESC LIMIT 10', season());
    C.send(p, { t: 'rqtop', list: rows, season: season() });
  },
  rqclaim(p) {
    const r = get(p.id); if (!r.pending) return API.sys(p, 'Chưa có phần thưởng mùa nào để nhận.');
    const g = r.pending; API.db.run('UPDATE arena_player SET pending = 0 WHERE user_id = ?', p.id);
    p.data.gold += g; C.pushMe(p); API.sys(p, 'Nhận thưởng mùa giải: ' + g + ' vàng.'); info(p);
  }
};

/* ---------- matchmaking and fights ---------- */
function pair() {
  const list = [...queue.entries()].map(([uid, since]) => ({ uid, since, p: C.online.get(uid) })).filter((x) => {
    if (!x.p || busy(x.p) || inMatch(x.uid)) { if (!x.p) queue.delete(x.uid); return false; } return true;
  });
  if (list.length < 2) return;
  const rated = list.map((x) => Object.assign(x, { r: get(x.uid).rating })).sort((a, b) => a.r - b.r);
  const used = new Set();
  for (let i = 0; i < rated.length; i++) {
    if (used.has(rated[i].uid)) continue;
    for (let j = i + 1; j < rated.length; j++) {
      if (used.has(rated[j].uid)) continue;
      const wait = (now() - Math.min(rated[i].since, rated[j].since)) / 1000, range = Math.min(600, 100 + wait * 25);
      if (Math.abs(rated[i].r - rated[j].r) <= range) { used.add(rated[i].uid); used.add(rated[j].uid); start(rated[i].p, rated[j].p); break; }
    }
  }
}
function start(a, b) {
  queue.delete(a.id); queue.delete(b.id);
  const m = { a: a.id, b: b.id, step: 0, at: now(), base: { a: stat(a.id), b: stat(b.id) }, done: false };
  matches.add(m);
  [[a, -4], [b, 4]].forEach(([p, dx]) => {
    try { combat().fullHeal(p); } catch (err) { /* combat module missing */ }
    p.x = ARENA.x + dx; p.z = ARENA.z; p.dirty = true; C.send(p, { t: 'correct', x: p.x, z: p.z });
    C.send(p, { t: 'rqmatch', vs: p === a ? b.name : a.name, vsRating: get(p === a ? b.id : a.id).rating });
    API.sys(p, 'Đã ghép trận với ' + (p === a ? b.name : a.name) + '! Trận bắt đầu sau vài giây.');
  });
}
function elo(ra, rb, sa) { const ea = 1 / (1 + Math.pow(10, (rb - ra) / 400)); return Math.round(K * (sa - ea)); }
function finish(m, winnerId) {
  m.done = true; m.at = now();
  const a = get(m.a), b = get(m.b);
  if (winnerId) {
    const wr = winnerId === m.a ? a : b, lr = winnerId === m.a ? b : a, d = elo(wr.rating, lr.rating, 1), dl = elo(lr.rating, wr.rating, 0);
    const nw = Math.max(0, wr.rating + d), nl = Math.max(0, lr.rating + dl);
    API.db.run('UPDATE arena_player SET rating = ?, wins = wins + 1, streak = streak + 1, best = MAX(best, ?) WHERE user_id = ?', nw, nw, wr.user_id);
    API.db.run('UPDATE arena_player SET rating = ?, losses = losses + 1, streak = 0 WHERE user_id = ?', nl, lr.user_id);
    [[wr, nw, true], [lr, nl, false]].forEach(([r, nr, win]) => { const o = C.online.get(r.user_id); if (o) C.send(o, { t: 'rqres', win, delta: nr - r.rating, rating: nr }); });
  } else {
    [a, b].forEach((r) => { const o = C.online.get(r.user_id); if (o) C.send(o, { t: 'rqres', win: null, delta: 0, rating: r.rating }); });
  }
}
function leave(uid) {
  const p = C.online.get(uid); if (!p) return;
  try { combat().fullHeal(p); } catch (err) { /* ignore */ }
  p.x = 2; p.z = 12; p.dirty = true; C.send(p, { t: 'correct', x: p.x, z: p.z }); info(p);
}
function tick() {
  const t = now();
  if (t % 2000 < 1000) pair();
  matches.forEach((m) => {
    const a = C.online.get(m.a), b = C.online.get(m.b);
    if (m.done) { if (t - m.at > 6000) { leave(m.a); leave(m.b); matches.delete(m); } return; }
    if (!a || !b) { finish(m, a ? m.a : b ? m.b : null); return; }
    if (m.step === 0 && t - m.at > 3000) { // both are in place: send the duel invite and accept it for the second player
      m.step = 1;
      try { combat().handle(a, { t: 'duel', op: 'invite', name: b.name }); combat().handle(b, { t: 'duel', op: 'accept' }); } catch (err) { console.error('arena duel', err.message); }
      return;
    }
    const sa = stat(m.a), sb = stat(m.b);
    if (sa.wins > m.base.a.wins || sb.losses > m.base.b.losses) return finish(m, m.a);
    if (sb.wins > m.base.b.wins || sa.losses > m.base.a.losses) return finish(m, m.b);
    if (t - m.at > FIGHT_MAX) finish(m, null);
  });
}
function onConnect(p) { try { get(p.id); info(p); } catch (err) { console.error('arena connect', err.message); } }
function onLeave(p) { queue.delete(p.id); }

module.exports = { init, onConnect, onLeave, tick, ops };
