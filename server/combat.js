'use strict';
/* Combat authority: the server owns player HP/MP, damage taken, death, potion healing, blocking, status effects and 1v1 duels.
   The browser only sends actions ("I swung", "I dodged", "I blocked") and draws what the server reports.
   Step 2 additions: class skill gating, stealth, guard/bless effects, race effects (elf mana regen, dwarf poison resistance, orc rage). */
const db = require('./db');
const rules = require('../public/js/rules.js');
const character = require('./character');

let C = null; // { online, send, sys }
let pvp = null; // step 11: server/pvp.js (free PvP zone, battleground, siege); optional
try { pvp = require('./pvp'); } catch (e) { pvp = null; }
const now = () => Date.now();
const rand = (a, b) => a + Math.random() * (b - a);
const stats = (p) => rules.playerStats(p.data);

db.exec('CREATE TABLE IF NOT EXISTS duel_stats (user_id INTEGER PRIMARY KEY, wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0)');

const DODGE_CD = 700, DODGE_INVULN = 500;
const BLOCK_MS = 600, BLOCK_CD = 1500, PARRY_MS = 370, BLOCK_REDUCE = 0.4, PARRY_STUN = 1200;
const PVP_SCALE = 0.6, DUEL_RANGE = 40, DUEL_MAX_MS = 5 * 60000;
const GUARD_MULT = 0.6;

/* what a monster's hit can inflict */
const ON_HIT = {
  teieretta: { fx: 'burn', chance: 0.35, sec: 4, frac: 0.35 },
  gufo: { fx: 'slow', chance: 0.4, sec: 3 },
  boss: { fx: 'poison', chance: 0.5, sec: 5, frac: 0.18 }
};
const lastVit = new Map(); // userId -> { hp, mp, until }: keeps HP across a quick reconnect

function init(ctx) {
  C = ctx;
  setInterval(tick, 500).unref();
}

/* ---------- vitals ---------- */
const maxHp = (p) => stats(p).maxHp;
function sendVit(p) { C.send(p, { t: 'vit', hp: Math.round(p.hp), mp: Math.floor(p.mp) }); }
function sendFx(p) {
  const t = now(); const list = [];
  (p.fx || new Map()).forEach((f, id) => { if (f.until > t) list.push({ id, left: +((f.until - t) / 1000).toFixed(1) }); });
  C.send(p, { t: 'fx', list });
}
function isDead(p) { return !!p && p.hp <= 0; }
function onConnect(p) {
  const st = stats(p); const keep = lastVit.get(p.id); lastVit.delete(p.id);
  p.hp = keep && keep.until > now() ? Math.min(keep.hp, st.maxHp) : st.maxHp;
  p.mp = keep && keep.until > now() ? Math.min(keep.mp, st.maxMp) : st.maxMp;
  p.lastHurt = 0; p.lastLv = p.data.level; p.fx = new Map(); p.dead = p.hp <= 0;
  sendVit(p);
}
function onLeave(p) {
  const d = duels.get(p.id); if (d) duelEnd(d, otherOf(d, p), 'đối thủ rời game');
  duelReq.delete(p.id);
  lastVit.set(p.id, { hp: p.hp, mp: p.mp, until: now() + 60000 });
}
function respawn(p) {
  if (p.hp > 0) return;
  const st = stats(p); p.hp = st.maxHp; p.mp = st.maxMp; p.fx = new Map(); p.dead = false; p.lastHurt = 0;
  sendVit(p); sendFx(p);
}
/* bring a dead ally back with a share of their max HP */
function revive(p, pct) {
  if (p.hp > 0) return;
  p.hp = Math.max(1, Math.round(stats(p).maxHp * pct)); p.fx = new Map(); p.dead = false; p.lastHurt = now();
  sendVit(p); sendFx(p); C.send(p, { t: 'revived' });
}
function heal(p, n) {
  if (p.hp <= 0) return; p.hp = Math.min(stats(p).maxHp, p.hp + n); sendVit(p);
}
function fullHeal(p) { const st = stats(p); p.hp = st.maxHp; p.mp = st.maxMp; sendVit(p); }
/* keep HP/MP inside the (possibly changed) maximums */
function clamp(p) { const st = stats(p); p.hp = Math.min(p.hp, st.maxHp); p.mp = Math.min(p.mp, st.maxMp); sendVit(p); }
function potionBlocked(p) { return p.hp <= 0 || p.hp >= stats(p).maxHp; }

/* ---------- status effects ---------- */
function addFx(p, id, sec, dps) {
  const until = now() + sec * 1000; const cur = p.fx.get(id);
  p.fx.set(id, { until: cur ? Math.max(cur.until, until) : until, dps: Math.max(dps || 0, cur ? cur.dps || 0 : 0) });
  sendFx(p);
}
function dropFx(p, id) { if (p.fx && p.fx.delete(id)) sendFx(p); }
function hasFx(p, id) { const f = p.fx && p.fx.get(id); return !!f && f.until > now(); }
function isStunned(p) { return hasFx(p, 'stun'); }

/* ---------- taking damage ---------- */
function applyDamage(p, dmg, kind, extra, attacker) {
  p.hp = Math.max(0, p.hp - dmg); p.lastHurt = now();
  C.send(p, { t: 'hurt', kind, dmg, hp: Math.round(p.hp), label: extra.label || null, kbx: extra.kbx, kbz: extra.kbz });
  const d = duels.get(p.id);
  if (d) { const o = otherOf(d, p); if (o) C.send(o, { t: 'duel', st: 'hp', oppHp: Math.round(p.hp), oppMax: stats(p).maxHp }); }
  if (p.hp > 0) return;
  if (d) return duelEnd(d, attacker || otherOf(d, p), 'hạ gục');
  p.dead = true; p.fx = new Map(); p.hidden = false; sendFx(p);
  if (attacker && pvp && pvp.pvpDeath) { try { pvp.pvpDeath(attacker, p); } catch (err) { console.error('pvp death', err.message); } }
}
/* A monster (e) or a duel opponent (attacker) hits player p with `raw` damage before defence. */
function hurt(p, raw, extra, e, attacker) {
  if (!p || p.hp <= 0) return;
  extra = extra || {}; const t = now();
  if (p.noChar || t < (p.invulnUntil || 0)) return C.send(p, { t: 'hurt', kind: 'miss' });
  if (t <= (p.blockStart || 0) + PARRY_MS) {
    if (e) { e.stunUntil = t + PARRY_STUN; e.dirty = true; }
    return C.send(p, { t: 'hurt', kind: 'parry', hp: Math.round(p.hp) });
  }
  const blocking = t <= (p.blockUntil || 0);
  const def = stats(p).def;
  const dmg = Math.max(1, Math.round((raw - def * 0.6) * rand(0.9, 1.1) * (blocking ? BLOCK_REDUCE : 1) * (hasFx(p, 'guard') ? GUARD_MULT : 1)));
  applyDamage(p, dmg, blocking ? 'block' : 'hit', extra, attacker);
  if (p.hp <= 0 || !e || blocking) return;
  const eff = ON_HIT[e.type];
  if (extra.label === 'Húc!') addFx(p, 'stun', 1.0);
  else if (eff && Math.random() < eff.chance) addFx(p, eff.fx, eff.sec, eff.frac ? Math.max(1, Math.round(e.atk * eff.frac)) : 0);
}

/* ---------- periodic tick (regen, damage over time, duel upkeep) ---------- */
function tick() {
  const t = now();
  C.online.forEach((p) => {
    if (p.hp === undefined) return;
    const st = stats(p); let changed = false;
    if (p.data.level > (p.lastLv || 0)) { p.hp = st.maxHp; p.mp = st.maxMp; changed = true; }
    p.lastLv = p.data.level;
    if (p.hp > st.maxHp) { p.hp = st.maxHp; changed = true; }
    if (p.hidden && t > (p.hiddenUntil || 0)) p.hidden = false;
    character.rageUpdate(p, st.maxHp);
    if (p.hp > 0) {
      const dots = []; let fxChanged = false;
      p.fx.forEach((f, id) => {
        if (f.until <= t) { p.fx.delete(id); fxChanged = true; return; }
        if ((id === 'burn' || id === 'poison') && f.dps) dots.push([id, Math.max(1, Math.round(f.dps / 2 * (id === 'poison' ? character.poisonMult(p) : 1)))]);
      });
      if (fxChanged) sendFx(p);
      dots.forEach(([id, n]) => { if (p.hp > 0) { applyDamage(p, n, id, {}, null); changed = true; } });
      if (p.hp > 0 && t - p.lastHurt > 6000 && p.hp < st.maxHp) { p.hp = Math.min(st.maxHp, p.hp + st.maxHp * 0.02 * 0.5); changed = true; }
      if (p.mp < st.maxMp) { p.mp = Math.min(st.maxMp, p.mp + 3 * 0.5 * character.mpRegen(p)); changed = true; }
    }
    if (changed || Math.round(p.hp) !== p.sentHp || Math.floor(p.mp) !== p.sentMp) { p.sentHp = Math.round(p.hp); p.sentMp = Math.floor(p.mp); sendVit(p); }
  });
  duels.forEach((d, uid) => {
    if (d.a !== uid) return;
    const a = C.online.get(d.a), b = C.online.get(d.b);
    if (!a || !b) return duelEnd(d, a || b, 'đối thủ rời game');
    if (t > d.endAt) return duelEnd(d, null, 'hết giờ');
    d.far = Math.hypot(a.x - b.x, a.z - b.z) > DUEL_RANGE * 2 ? d.far + 1 : 0;
    if (d.far >= 10) duelEnd(d, null, 'hai bên đi quá xa nhau');
  });
}

/* ---------- player actions ---------- */
function onAct(p, m) {
  if (p.hp <= 0 || p.noChar) return; const t = now();
  if (m.k === 'dodge') {
    if (t < (p.dodgeReady || 0)) return;
    p.dodgeReady = t + DODGE_CD; p.invulnUntil = t + DODGE_INVULN;
  } else if (m.k === 'block') {
    if (t < (p.blockReady || 0) || isStunned(p)) return;
    p.blockReady = t + BLOCK_CD; p.blockStart = t; p.blockUntil = t + BLOCK_MS;
  }
}
/* 'hit' message: check the class may use that attack, spend mana, then let the world resolve monsters (doEnemyHit) and/or the duel opponent. */
function onHit(p, m, doEnemyHit) {
  if (p.hp <= 0 || isStunned(p)) return;
  const kind = String(m.kind), a = rules.ATTACKS[kind]; if (!a || !character.canUse(p, kind)) return;
  const t = now(); p.cd = p.cd || {};
  const ids = Array.isArray(m.ids) ? m.ids : [], pids = Array.isArray(m.pids) ? m.pids : [];
  const eReady = ids.length > 0 && (p.cd[kind] || 0) <= t + 80;
  const d = duels.get(p.id);
  const dReady = !!d && t >= d.startAt && pids.length > 0 && (p.cd['d_' + kind] || 0) <= t + 80;
  const vReady = !d && !!pvp && !!pvp.pvpActive && pids.length > 0 && (p.cd['v_' + kind] || 0) <= t + 80 && pvp.pvpActive(p);
  if (!eReady && !dReady && !vReady) return;
  if (a.mp) { if (p.mp < a.mp) return; p.mp -= a.mp; sendVit(p); }
  character.reveal(p);
  if (eReady) { doEnemyHit(ids); character.afterHit(p, kind, ids); }
  if (dReady) duelHit(p, d, m, kind, a);
  if (vReady) pvpHit(p, pids, m, kind, a);
}

/* free PvP / battleground / siege: the same damage as a duel, but the targets are checked by server/pvp.js */
function pvpHit(p, pids, m, kind, a) {
  let hit = 0; const st = stats(p);
  pids.slice(0, 3).forEach((id) => {
    const o = C.online.get(Number(id)); if (!o || o.id === p.id || o.hp <= 0) return;
    if (Math.hypot(p.x - o.x, p.z - o.z) > a.reach + 0.8 + 1.5) return;
    if (!pvp.canHit(p, o)) return;
    const mult = a.mult[Math.max(0, Math.min(a.mult.length - 1, m.combo | 0))];
    const crit = Math.random() * 100 < st.crit;
    hurt(o, st.atk * mult * rand(0.9, 1.1) * (crit ? 1.8 : 1) * PVP_SCALE, { label: crit ? 'Chí mạng!' : null }, null, p);
    hit++;
  });
  if (hit) p.cd['v_' + kind] = now() + a.cd * 1000;
}

/* ---------- duels ---------- */
const duels = new Map(); // userId -> duel (both players point to the same object)
const duelReq = new Map(); // targetId -> { from, until }
const otherOf = (d, p) => C.online.get(d.a === p.id ? d.b : d.a);
function duelStart(a, b) {
  const t = now(); const d = { a: a.id, b: b.id, startAt: t + 3000, endAt: t + 3000 + DUEL_MAX_MS, far: 0 };
  duels.set(a.id, d); duels.set(b.id, d);
  [[a, b], [b, a]].forEach(([me, opp]) => {
    const st = stats(me); me.hp = st.maxHp; me.mp = st.maxMp; me.fx = new Map(); sendVit(me); sendFx(me);
    C.send(me, { t: 'duel', st: 'start', with: opp.id, name: opp.name, startIn: 3, oppHp: stats(opp).maxHp, oppMax: stats(opp).maxHp });
  });
}
function addStat(uid, w, l) {
  db.run('INSERT INTO duel_stats (user_id, wins, losses) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET wins = wins + excluded.wins, losses = losses + excluded.losses', uid, w, l);
}
function duelEnd(d, winner, reason) {
  if (duels.get(d.a) !== d && duels.get(d.b) !== d) return;
  duels.delete(d.a); duels.delete(d.b);
  const a = C.online.get(d.a), b = C.online.get(d.b);
  [a, b].forEach((p) => {
    if (!p) return;
    const won = !!winner && winner.id === p.id, draw = !winner;
    if (!won && !draw) { p.hp = Math.max(1, Math.ceil(stats(p).maxHp * 0.3)); p.dead = false; }
    p.fx = new Map(); sendFx(p); sendVit(p);
    C.send(p, { t: 'duel', st: 'end', win: won, draw, reason });
    C.sys(p, draw ? 'Trận đấu hòa (' + reason + ').' : won ? 'Bạn thắng trận đấu! (' + reason + ')' : 'Bạn thua trận đấu. (' + reason + ')');
  });
  try { if (winner) { const loser = winner.id === d.a ? d.b : d.a; addStat(winner.id, 1, 0); addStat(loser, 0, 1); } } catch (e) { console.error('duel stats', e.message); }
}
function duelHit(p, d, m, kind, a) {
  const o = otherOf(d, p); if (!o || o.hp <= 0) return;
  if (!m.pids.some((x) => Number(x) === o.id)) return;
  if (Math.hypot(p.x - o.x, p.z - o.z) > a.reach + 0.8 + 1.5) return;
  p.cd['d_' + kind] = now() + a.cd * 1000;
  const st = stats(p); const mult = a.mult[Math.max(0, Math.min(a.mult.length - 1, m.combo | 0))];
  const crit = Math.random() * 100 < st.crit;
  const raw = st.atk * mult * rand(0.9, 1.1) * (crit ? 1.8 : 1) * PVP_SCALE;
  hurt(o, raw, { label: crit ? 'Chí mạng!' : null }, null, p);
}
function onDuel(p, m) {
  const op = m.op, d = duels.get(p.id);
  if (op === 'invite') {
    if (d) return C.sys(p, 'Bạn đang trong một trận đấu.');
    if (p.hp <= 0) return C.sys(p, 'Bạn đang bị hạ gục.');
    let target = null; C.online.forEach((o) => { if (o.name.toLowerCase() === String(m.name || '').trim().toLowerCase()) target = o; });
    if (!target || target.id === p.id) return C.sys(p, 'Người chơi "' + String(m.name || '').slice(0, 20) + '" không online.');
    if (duels.get(target.id) || target.hp <= 0) return C.sys(p, target.name + ' đang bận.');
    if (Math.hypot(p.x - target.x, p.z - target.z) > DUEL_RANGE) return C.sys(p, 'Hai bên phải đứng gần nhau (trong ' + DUEL_RANGE + 'm).');
    duelReq.set(target.id, { from: p.id, until: now() + 30000 });
    C.sys(p, 'Đã thách đấu ' + target.name + '.');
    C.send(target, { t: 'duel', st: 'invite', from: p.name });
    C.sys(target, p.name + ' thách đấu bạn! Gõ /duel ok để nhận, /duel no để từ chối.');
  } else if (op === 'accept') {
    const rq = duelReq.get(p.id); duelReq.delete(p.id);
    if (!rq || rq.until < now()) return C.sys(p, 'Không có lời thách đấu nào (hoặc đã hết hạn).');
    const f = C.online.get(rq.from);
    if (!f || duels.get(f.id) || duels.get(p.id) || f.hp <= 0 || p.hp <= 0) return C.sys(p, 'Không bắt đầu được trận đấu.');
    if (Math.hypot(p.x - f.x, p.z - f.z) > DUEL_RANGE) return C.sys(p, 'Hai bên đã đứng quá xa nhau.');
    duelStart(f, p);
  } else if (op === 'decline') {
    const rq = duelReq.get(p.id); duelReq.delete(p.id);
    const f = rq && C.online.get(rq.from); if (f) C.sys(f, p.name + ' từ chối thách đấu.');
  } else if (op === 'stop') {
    if (d) duelEnd(d, otherOf(d, p), p.name + ' đầu hàng');
  } else if (op === 'top') {
    const rows = db.all('SELECT u.username AS name, s.wins AS wins, s.losses AS losses FROM duel_stats s JOIN users u ON u.id = s.user_id ORDER BY s.wins DESC, s.losses ASC LIMIT 10');
    C.sys(p, rows.length ? 'Xếp hạng thách đấu: ' + rows.map((r, i) => (i + 1) + '. ' + r.name + ' ' + r.wins + 'T-' + r.losses + 'B').join(' · ') : 'Chưa có trận thách đấu nào.');
  }
}

function handle(p, m) {
  try {
    if (m.t === 'act') return onAct(p, m);
    if (m.t === 'duel') return onDuel(p, m);
  } catch (e) { console.error('combat error', m.t, e); }
  return undefined;
}

module.exports = { init, hurt, handle, onHit, onConnect, onLeave, isDead, respawn, heal, potionBlocked,
  revive, fullHeal, clamp, addFx, dropFx, isStunned, sendVit, maxHp };
