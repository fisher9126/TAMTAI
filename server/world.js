'use strict';
/* Shared monsters: AI, combat, deaths and respawns run here, so every player sees and fights the same creatures. */
const rules = require('../public/js/rules.js');

const { WORLD, ENEMIES, ATTACKS } = rules;
const TICK = 0.1;
const enemies = [];
const byId = new Map();
let ctx = null; // { online, send, broadcast, onKill(enemy, contributors) }

/* deterministic layout so monsters return to the same places after a restart */
let seed = 20261027;
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
const rr = (a, b) => a + rnd() * (b - a);
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
function angTo(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
function turn(e, target, rate) { const d = angTo(e.f, target); e.f += Math.max(-rate, Math.min(rate, d)); }

let nextId = 1;
function spawn(type, x, z) {
  const d = ENEMIES[type];
  const lv = d.lv[0] + Math.floor(rnd() * (d.lv[1] - d.lv[0] + 1));
  const mult = 1 + (lv - d.lv[0]) * 0.22;
  const e = { id: nextId++, type, d, lv, maxHp: Math.round(d.hp * mult), atk: Math.round(d.atk * mult), home: { x, z }, x, z, f: rr(0, 6.28),
    state: 'idle', target: null, wander: 0, tx: x, tz: z, atkCd: 1, windup: 0, dead: false, respawnAt: 0, dmgBy: new Map(),
    kx: 0, kz: 0, cstate: null, cT: 0, chargeCd: 4, chargeHit: null, st: 0, dirty: true };
  e.hp = e.maxHp;
  enemies.push(e); byId.set(e.id, e);
}
(function layout() {
  const { POND, FOREST, ARENA } = WORLD;
  for (let i = 0; i < 13; i++) {
    let x, z, k = 0;
    do { const a = rr(0, 6.283), r = rr(19, 46); x = Math.cos(a) * r; z = Math.sin(a) * r; k++; }
    while (k < 40 && (Math.hypot(x - POND.x, z - POND.z) < 13 || Math.hypot(x - FOREST.x, z - FOREST.z) < 28 || Math.hypot(x - ARENA.x, z - ARENA.z) < 22));
    spawn('teieretta', x, z);
  }
  for (let i = 0; i < 9; i++) { const a = rr(0, 6.283), r = rr(4, 19); spawn('gufo', FOREST.x + Math.cos(a) * r, FOREST.z + Math.sin(a) * r); }
  spawn('boss', ARENA.x, ARENA.z);
  try { require('./zones').layout(spawnAt); } catch (err) { console.error('zones layout', err.message); }
})();

function pub(e) { return { id: e.id, type: e.type, lv: e.lv, maxHp: e.maxHp, hp: e.hp, x: +e.x.toFixed(2), z: +e.z.toFixed(2), f: +e.f.toFixed(2), dead: e.dead }; }
/* AF-ZONES */ function snapshot() { return enemies.filter((e) => !e.inst).map(pub); }
/* spawn with options: inst = dungeon run id (only that run sees it), arena = clamp centre for bosses, hpMul / atkMul = party scaling */
function spawnAt(type, x, z, o) {
  spawn(type, x, z);
  const e = enemies[enemies.length - 1];
  if (o) {
    if (o.inst) e.inst = o.inst;
    if (o.arena) e.arena = o.arena;
    if (o.hpMul) { e.maxHp = Math.round(e.maxHp * o.hpMul); e.hp = e.maxHp; }
    if (o.atkMul) e.atk = Math.round(e.atk * o.atkMul);
  }
  return e;
}
function despawn(e) { const i = enemies.indexOf(e); if (i >= 0) enemies.splice(i, 1); byId.delete(e.id); }
function setBroadcast(f) { ctx.broadcast = f; }
function alivePlayers() { const out = []; ctx.online.forEach((p) => { if (!p.dead && !p.hidden) out.push(p); }); return out; }
function reset(e) {
  e.x = e.home.x; e.z = e.home.z; e.hp = e.maxHp; e.dead = false; e.state = 'idle'; e.target = null; e.cstate = null; e.windup = 0; e.dmgBy.clear(); e.dirty = true;
  ctx.broadcast({ t: 'espawn', e: pub(e) });
}

/* AF-COMBAT */ function hitPlayer(e, p, raw, extra) { if (ctx.hurt) return ctx.hurt(p, raw, extra, e); ctx.send(p, Object.assign({ t: 'ehit', e: e.id, raw: Math.round(raw) }, extra || {})); }

function tickEnemy(e, now) {
  if (e.dead) { if (now >= e.respawnAt) reset(e); return; }
  if (e.stunUntil > now) { e.st = 0; return; }
  let vx = 0, vz = 0; const d = e.d, sp = d.spd * (e.slowUntil > now ? 0.5 : 1);
  const tgt = e.target != null ? ctx.online.get(e.target) : null;
  /* AF-CLASS */ const tgtOk = tgt && !tgt.dead && !tgt.hidden;
  const pd = tgtOk ? Math.hypot(tgt.x - e.x, tgt.z - e.z) : Infinity;
  const hd = Math.hypot(e.x - e.home.x, e.z - e.home.z);
  e.atkCd -= TICK;
  const prevSt = e.st;
  if (d.boss && e.cstate) {
    e.cT -= TICK;
    if (e.cstate === 'windup') { e.st = 1; if (e.cT <= 0) { e.cstate = 'charge'; e.cT = 0.8; e.chargeHit = new Set(); } }
    else if (e.cstate === 'charge') {
      e.st = 2; vx = Math.sin(e.f) * 18; vz = Math.cos(e.f) * 18;
      alivePlayers().forEach((p) => {
        if (e.chargeHit.has(p.id)) return;
        const dd = Math.hypot(p.x - e.x, p.z - e.z);
        if (dd < 2.9) { e.chargeHit.add(p.id); const k = dd || 1; hitPlayer(e, p, e.atk * 1.9, { label: 'Húc!', kbx: +((p.x - e.x) / k * 14).toFixed(2), kbz: +((p.z - e.z) / k * 14).toFixed(2) }); }
      });
      if (e.cT <= 0) { e.cstate = 'recover'; e.cT = 1.1; }
    } else if (e.cstate === 'recover') { e.st = 0; if (e.cT <= 0) e.cstate = null; }
  } else if (e.state === 'idle') {
    e.st = 0;
    e.wander -= TICK;
    if (e.wander <= 0) { e.wander = rand(2, 5); const a = rand(0, 6.283), r = rand(0, 5); e.tx = e.home.x + Math.cos(a) * r; e.tz = e.home.z + Math.sin(a) * r; }
    const dx = e.tx - e.x, dz = e.tz - e.z, dd = Math.hypot(dx, dz);
    if (dd > 0.4) { vx = dx / dd * sp * 0.4; vz = dz / dd * sp * 0.4; turn(e, Math.atan2(dx, dz), 0.4); }
    let best = null, bd = d.aggro;
    alivePlayers().forEach((p) => { const q = Math.hypot(p.x - e.x, p.z - e.z); if (q < bd) { bd = q; best = p; } });
    if (best) { e.state = 'chase'; e.target = best.id; }
  } else if (e.state === 'chase') {
    if (!tgtOk || hd > d.leash) {
      // look for another attacker nearby before giving up
      let alt = null; e.dmgBy.forEach((v, pid) => { const p = ctx.online.get(pid); if (p && !p.dead && Math.hypot(p.x - e.x, p.z - e.z) < d.aggro * 1.5 && Math.hypot(p.x - e.home.x, p.z - e.home.z) < d.leash) alt = p; });
      if (alt && hd <= d.leash) e.target = alt.id; else { e.state = 'return'; e.target = null; }
    } else {
      const dx = tgt.x - e.x, dz = tgt.z - e.z;
      turn(e, Math.atan2(dx, dz), d.boss ? 0.3 : 0.7);
      if (pd > d.range + 0.2) { vx = dx / pd * sp; vz = dz / pd * sp; }
      if (e.windup > 0) { e.st = 1; e.windup -= TICK; vx *= 0.2; vz *= 0.2; if (e.windup <= 0) { e.st = 0; if (pd < d.range + 0.9) hitPlayer(e, tgt, e.atk); } }
      else if (pd < d.range + 0.3 && e.atkCd <= 0) { e.windup = d.boss ? 0.55 : 0.4; e.atkCd = d.boss ? 2.0 : rand(1.3, 1.8); e.st = 1; }
      else e.st = 0;
      if (d.boss) {
        e.chargeCd -= TICK; const enraged = e.hp < e.maxHp * 0.5;
        if (e.chargeCd <= 0 && pd > 4.5 && pd < 17 && e.windup <= 0) {
          e.cstate = 'windup'; e.cT = enraged ? 0.7 : 0.95; e.f = Math.atan2(dx, dz); e.chargeCd = enraged ? 4.2 : 6.5; e.st = 1;
          ctx.broadcast({ t: 'ewind', e: e.id, f: +e.f.toFixed(3), dur: e.cT });
        }
      }
    }
  } else if (e.state === 'return') {
    e.st = 0;
    const dx = e.home.x - e.x, dz = e.home.z - e.z, dd = Math.hypot(dx, dz);
    if (dd > 0.5) { vx = dx / dd * sp * 1.4; vz = dz / dd * sp * 1.4; turn(e, Math.atan2(dx, dz), 0.6); } else { e.state = 'idle'; e.dmgBy.clear(); }
    if (e.hp < e.maxHp) { e.hp = Math.min(e.maxHp, e.hp + Math.ceil(e.maxHp * 0.03)); }
  }
  e.kx *= 0.6; e.kz *= 0.6;
  const ox = e.x, oz = e.z;
  e.x += (vx + e.kx) * TICK; e.z += (vz + e.kz) * TICK;
  if (d.boss) {
    const AR = e.arena || WORLD.ARENA; const dc = Math.hypot(e.x - AR.x, e.z - AR.z);
    if (dc > 15) { e.x = AR.x + (e.x - AR.x) / dc * 15; e.z = AR.z + (e.z - AR.z) / dc * 15; if (e.cstate === 'charge') { e.cstate = 'recover'; e.cT = 1.2; } }
  }
  if (Math.abs(e.x - ox) > 0.005 || Math.abs(e.z - oz) > 0.005 || e.st !== prevSt) e.dirty = true;
}

/* A player's attack. ids = monsters the browser saw in the swing; the server checks reach, cooldown and mana-free rules itself. */
function playerHit(p, kind, combo, ids, stats) {
  const a = ATTACKS[kind]; if (!a || !Array.isArray(ids)) return;
  const now = Date.now();
  p.cd = p.cd || {};
  if ((p.cd[kind] || 0) > now + 80) return;
  p.cd[kind] = now + a.cd * 1000;
  const mult = a.mult[Math.max(0, Math.min(a.mult.length - 1, combo | 0))];
  ids.slice(0, 12).forEach((id) => {
    const e = byId.get(Number(id)); if (!e || e.dead) return;
    if (Math.hypot(p.x - e.x, p.z - e.z) > a.reach + e.d.radius + 1.5) return;
    const crit = Math.random() * 100 < stats.crit;
    const dmg = Math.max(1, Math.round(stats.atk * mult * rand(0.9, 1.1) * (crit ? 1.8 : 1)));
    e.hp -= dmg; e.dmgBy.set(p.id, (e.dmgBy.get(p.id) || 0) + dmg);
    if (e.state === 'idle' || e.state === 'return') { e.state = 'chase'; e.target = p.id; }
    const dx = e.x - p.x, dz = e.z - p.z, dd = Math.hypot(dx, dz) || 1, kb = e.d.boss ? 0.9 : 4.5;
    e.kx += dx / dd * kb; e.kz += dz / dd * kb;
    ctx.broadcast({ t: 'edmg', e: e.id, dmg, crit, by: p.id, hp: Math.max(0, e.hp) });
    if (e.hp <= 0) kill(e);
  });
}
function kill(e) {
  e.dead = true; e.hp = 0; e.cstate = null; e.windup = 0; e.respawnAt = e.inst ? Infinity : Date.now() + e.d.respawn * 1000;
  ctx.broadcast({ t: 'edie', e: e.id });
  const contributors = [];
  e.dmgBy.forEach((dmg, pid) => { const p = ctx.online.get(pid); if (p && Math.hypot(p.x - e.x, p.z - e.z) < 60) contributors.push(p); });
  e.dmgBy.clear();
  ctx.onKill(e, contributors);
}

setInterval(() => {
  if (!ctx) return;
  const now = Date.now();
  enemies.forEach((e) => tickEnemy(e, now));
  const list = [];
  enemies.forEach((e) => { if (e.dirty && !e.dead) { e.dirty = false; list.push([e.id, +e.x.toFixed(2), +e.z.toFixed(2), +e.f.toFixed(2), e.st, Math.max(0, e.hp)]); } });
  if (list.length && ctx.online.size) ctx.broadcast({ t: 'es', list });
}, TICK * 1000).unref();

module.exports = { init(c) { ctx = c; }, setHurt(f) { ctx.hurt = f; }, snapshot, playerHit, enemies, byId, randi, spawnAt, despawn, setBroadcast };
