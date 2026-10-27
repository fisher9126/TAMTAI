'use strict';
/* Aetherfall step 3 (server side): new zones with their monsters, gathering nodes, professions and crafting,
   consumable buffs, and the party dungeon. Everything is decided here; the browser only sends requests and draws answers.
   Monsters of the new zones are spawned by world.js through layout(); dungeon monsters are spawned per run and are only
   sent to the members of that run (wrapBroadcast). */
const db = require('./db');
const items = require('../public/js/items.js');
const rules = require('../public/js/rules.js');

db.exec('CREATE TABLE IF NOT EXISTS zone_player (user_id INTEGER PRIMARY KEY, data TEXT NOT NULL)');

let C = null; // { online, send, broadcast, sys, pushMe, addExp, world, saveNow }
const now = () => Date.now();
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const W = rules.WORLD, DUN = Object.assign({}, rules.DUNGEON, { x0: rules.WORLD.DUNGEON.x, z0: rules.WORLD.DUNGEON.z }); // x0/z0 = room centre
const RC = new Map(rules.RECIPES.map((r) => [r.id, r]));
const dayKey = () => new Date(now() + 7 * 3600e3).toISOString().slice(0, 10);
const sys = (p, t) => C.sys(p, t);
const evMult = (k) => { try { return require('./events')[k](); } catch (e) { return 1; } }; // admin events (x2 gathering, ...); 1 when events.js is not installed
function thr(p, k, ms) { p.zThr = p.zThr || {}; const t = now(); if ((p.zThr[k] || 0) > t) return false; p.zThr[k] = t + ms; return true; }

/* ---------- plugins: optional modules next to this file (explore, quests, ...). A module that is missing is ignored and a
   module that throws is logged and skipped, so one bad file never takes the game down. A plugin may export:
   init(C, API), onConnect(p), onLeave(p), onKill(p, e), onMove(p, x, z), tick(t), and ops = { opName(p, m) } for { t: 'zone', op } messages. ---------- */
const PLUGIN_NAMES = ['explore', 'quests', 'skilltree', 'gear', 'auction', 'arena', 'equip', 'world2', 'move', 'instances', 'faction', 'pvp', 'team'];
const plugins = [];
let pluginsLoaded = false;
function loadPlugins() {
  if (pluginsLoaded) return; pluginsLoaded = true; // layout() may run before init(), so both call this
  const fs = require('fs'), path = require('path');
  PLUGIN_NAMES.forEach((n) => {
    if (!fs.existsSync(path.join(__dirname, n + '.js'))) return;
    try { const m = require('./' + n); m.__name = n; plugins.push(m); console.log('[plugin] da nap ' + n); } catch (err) { console.error('[plugin ' + n + '] khong nap duoc, bo qua:', err.message); }
  });
}
function each(fn, what) { for (let i = 0; i < plugins.length; i++) { try { fn(plugins[i]); } catch (err) { console.error('[plugin ' + plugins[i].__name + '] ' + (what || '') + ':', err.message); } } }

/* ---------- per-player data (own table, so game.js sanitizeSave never touches it) ---------- */
function blank() {
  const prof = {}; Object.keys(rules.PROFS).forEach((k) => { prof[k] = { lv: 1, xp: 0 }; });
  return { prof, mats: {}, cons: {}, dun: { day: dayKey(), n: 0, clears: 0, best: 0 }, dirty: false };
}
function clean(raw) {
  const z = blank(); if (!raw || typeof raw !== 'object') return z;
  Object.keys(z.prof).forEach((k) => {
    const s = raw.prof && raw.prof[k]; if (!s) return;
    z.prof[k].lv = Math.max(1, Math.min(rules.PROF_MAX, (s.lv | 0) || 1)); z.prof[k].xp = Math.max(0, s.xp | 0);
  });
  Object.keys(rules.MATS).forEach((k) => { z.mats[k] = Math.max(0, Math.min(999, ((raw.mats && raw.mats[k]) | 0))); });
  Object.keys(rules.CONS).forEach((k) => { z.cons[k] = Math.max(0, Math.min(99, ((raw.cons && raw.cons[k]) | 0))); });
  if (raw.dun) { z.dun.clears = Math.max(0, raw.dun.clears | 0); z.dun.best = Math.max(0, Math.min(rules.DUNGEON.diffs.length - 1, raw.dun.best | 0)); if (raw.dun.day === z.dun.day) z.dun.n = Math.max(0, raw.dun.n | 0); }
  return z;
}
function loadRaw(id) { const r = db.get('SELECT data FROM zone_player WHERE user_id = ?', id); if (!r) return null; try { return JSON.parse(r.data); } catch (e) { return null; } }
function save(p) {
  if (!p.zn) return;
  const o = { prof: p.zn.prof, mats: p.zn.mats, cons: p.zn.cons, dun: p.zn.dun };
  db.run('INSERT INTO zone_player (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data', p.id, JSON.stringify(o));
  p.zn.dirty = false;
}
function rollDay(z) { const k = dayKey(); if (z.dun.day !== k) { z.dun.day = k; z.dun.n = 0; z.dirty = true; } }
const leftToday = (p) => { if (!p.zn) return 0; rollDay(p.zn); return Math.max(0, DUN.dailyMax - p.zn.dun.n); };

function addXp(z, k, xp) {
  const s = z.prof[k]; let up = 0;
  if (s.lv >= rules.PROF_MAX) return 0;
  s.xp += xp;
  while (s.lv < rules.PROF_MAX && s.xp >= rules.profNeed(s.lv)) { s.xp -= rules.profNeed(s.lv); s.lv++; up = s.lv; }
  if (s.lv >= rules.PROF_MAX) s.xp = 0;
  return up;
}
function giveMats(z, got) { Object.keys(got).forEach((k) => { if (rules.MATS[k]) z.mats[k] = Math.min(999, (z.mats[k] || 0) + got[k]); }); z.dirty = true; }

function info(p) {
  const z = p.zn; if (!z) return;
  rollDay(z);
  const prof = {}; Object.keys(z.prof).forEach((k) => { prof[k] = [z.prof[k].lv, z.prof[k].xp]; });
  const buffs = {}, bf = p.data.buffs || {}, t = now();
  Object.keys(bf).forEach((k) => { if (bf[k] && bf[k].until > t) buffs[k] = [bf[k].v, Math.ceil((bf[k].until - t) / 1000), bf[k].id]; else delete bf[k]; });
  C.send(p, { t: 'zinfo', prof, mats: z.mats, cons: z.cons, buffs, dun: { left: leftToday(p), max: DUN.dailyMax, active: !!runOf(p), clears: z.dun.clears, minLv: DUN.minLv, best: z.dun.best | 0 } });
}

/* ---------- gathering nodes (same list for everyone) ---------- */
const nodes = [], nodeById = new Map();
(function buildNodes() {
  let seed = 424242; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  let id = 1;
  const okSpot = (x, z) => Math.hypot(x - W.POND.x, z - W.POND.z) > 14 && Math.hypot(x - W.ARENA.x, z - W.ARENA.z) > 22 &&
    Math.hypot(x - W.PORTAL.x, z - W.PORTAL.z) > 5 && Math.hypot(x, z) < W.R - 14;
  const add = (type, cx, cz, rMin, rMax) => {
    let x = cx, z = cz;
    for (let k = 0; k < 25; k++) { const a = rnd() * 6.283, r = rMin + rnd() * (rMax - rMin); x = cx + Math.cos(a) * r; z = cz + Math.sin(a) * r; if (okSpot(x, z)) break; }
    const n = { id: id++, type, x: +x.toFixed(2), z: +z.toFixed(2), until: 0 }; nodes.push(n); nodeById.set(n.id, n);
  };
  for (let i = 0; i < 8; i++) add('herb', 0, 0, 24, 36);
  for (let i = 0; i < 4; i++) add('herb', W.FOREST.x, W.FOREST.z, 20, 32);
  for (let i = 0; i < 7; i++) add('shroom', W.SWAMP.x, W.SWAMP.z, 3, 15);
  for (let i = 0; i < 8; i++) add('ore', W.MINE.x, W.MINE.z, 3, 14);
  for (let i = 0; i < 5; i++) add('coal', W.MINE.x, W.MINE.z, 3, 14);
  for (let i = 0; i < 7; i++) add('frost', W.FROST.x, W.FROST.z, 3, 12);
  for (let i = 0; i < 6; i++) add('ore', W.DESERT.x, W.DESERT.z, 14, 19); // desert (step 11): outside the PvP ring
  for (let i = 0; i < 4; i++) add('coal', W.DESERT.x, W.DESERT.z, 14, 19);
})();
const nodeList = () => { const t = now(); return nodes.map((n) => [n.id, n.type, n.x, n.z, n.until > t ? 0 : 1]); };

function gather(p, m) {
  const z = p.zn; if (!z || p.dead) return;
  if (!thr(p, 'gather', 700)) return;
  const n = nodeById.get(Math.floor(Number(m.id)));
  if (!n) return;
  if (n.until > now()) return sys(p, 'Điểm này vừa bị lấy, đợi nó mọc lại.');
  if (Math.hypot(p.x - n.x, p.z - n.z) > 4.5) return sys(p, 'Bạn đứng quá xa.');
  const def = rules.NODES[n.type], pr = z.prof[def.prof];
  if (pr.lv < def.lv) return sys(p, rules.PROFS[def.prof].name + ' cấp ' + def.lv + ' mới lấy được ' + def.name + '.');
  const got = {};
  def.yield.forEach((y) => { got[y.m] = (got[y.m] || 0) + rint(y.a, y.b) + (pr.lv >= 8 && Math.random() < 0.3 ? 1 : 0); });
  (def.extra || []).forEach((x) => { if (Math.random() < x.p + pr.lv * 0.005) got[x.m] = (got[x.m] || 0) + (x.n || 1); });
  const gm = evMult('gatherMult'); if (gm > 1) Object.keys(got).forEach((k) => { got[k] = Math.round(got[k] * gm); });
  n.until = now() + def.respawn * 1000;
  C.broadcast({ t: 'node', id: n.id, on: 0 });
  const up = addXp(z, def.prof, def.xp);
  giveMats(z, got);
  C.send(p, { t: 'zgain', mats: got, x: n.x, z: n.z, prof: def.prof, xp: def.xp, up });
  info(p);
}

/* ---------- monster material drops (called from game.js onKill for every contributor) ---------- */
function onKill(p, e) {
  coreKill(p, e);
  each((pl) => pl.onKill && pl.onKill(p, e), 'onKill');
}
function coreKill(p, e) {
  try {
    if (!p.zn) return;
    const table = rules.MAT_DROPS[e.type]; if (!table) return;
    const got = {};
    table.forEach((r) => { if (Math.random() < r[1]) got[r[0]] = (got[r[0]] || 0) + rint(r[2], r[3]); });
    if (!Object.keys(got).length) return;
    giveMats(p.zn, got);
    C.send(p, { t: 'zgain', mats: got, x: e.x, z: e.z });
    info(p);
  } catch (err) { console.error('zones onKill', err.message); }
}

/* ---------- crafting and consumables ---------- */
function craft(p, m) {
  const z = p.zn; if (!z) return;
  if (!thr(p, 'craft', 500)) return;
  const rc = RC.get(String(m.id || '').slice(0, 40)); if (!rc) return;
  const pr = z.prof[rc.prof], d = p.data;
  if (pr.lv < rc.lv) return sys(p, rules.PROFS[rc.prof].name + ' cấp ' + rc.lv + ' mới làm được món này.');
  if (d.gold < rc.gold) return sys(p, 'Không đủ vàng (cần ' + rc.gold + ').');
  for (const k in rc.mats) if ((z.mats[k] || 0) < rc.mats[k]) return sys(p, 'Thiếu ' + rules.MATS[k].name + ' (cần ' + rc.mats[k] + ', có ' + (z.mats[k] || 0) + ').');
  if (rc.out.kind === 'gear' && d.inv.length >= rules.INV_SIZE) return sys(p, 'Túi đồ đã đầy.');
  if (rc.out.kind === 'cons' && (z.cons[rc.out.id] || 0) >= 99) return sys(p, 'Bạn đang giữ tối đa món này.');
  d.gold -= rc.gold;
  for (const k in rc.mats) z.mats[k] -= rc.mats[k];
  let item = null, note = '';
  if (rc.out.kind === 'gear') {
    item = items.makeItem(rc.out.slot, rc.out.rarity, rules.forgeIlvl(d.level, pr.lv));
    if (Math.random() < 0.05 + pr.lv * 0.01) { item.enh = 1; item.stats = items.statsFor(item.slot, item.rarity, item.ilvl, 1); item.name = items.withEnhName(item.name, 1); note = 'Chế tác tinh xảo, tặng thêm +1!'; }
    d.inv.push(item);
  } else if (rc.out.kind === 'potion') d.potions = Math.min(999, d.potions + rc.out.n);
  else if (rc.out.kind === 'cons') z.cons[rc.out.id] = (z.cons[rc.out.id] || 0) + 1;
  else if (rc.out.kind === 'mat') giveMats(z, { [rc.out.id]: rc.out.n || 1 });
  const up = addXp(z, rc.prof, rc.xp); z.dirty = true;
  C.pushMe(p);
  C.send(p, { t: 'zcraft', ok: true, name: rc.name, item, note, up, prof: rc.prof, xp: rc.xp });
  info(p);
}
function useCons(p, m) {
  const z = p.zn; if (!z) return;
  const id = String(m.id || ''), def = rules.CONS[id];
  if (!def || !(z.cons[id] > 0)) return;
  z.cons[id]--; z.dirty = true;
  const d = p.data; d.buffs = d.buffs || {};
  d.buffs[def.buff] = { v: def.v, until: now() + def.secs * 1000, id };
  C.pushMe(p);
  sys(p, 'Đã dùng ' + def.name + ': ' + def.desc + '.');
  info(p);
}
function expBonus(p) {
  const b = p.data && p.data.buffs && p.data.buffs.exp; let m = b && b.until > now() ? 1 + b.v : 1;
  for (let i = 0; i < plugins.length; i++) { try { if (plugins[i].expBonus) m *= plugins[i].expBonus(p) || 1; } catch (err) { /* ignore */ } } // e.g. siege-holder guild bonus
  return m;
}

/* ---------- dungeon ---------- */
let runSeq = 1;
const runs = new Map();
const WAVES = [[['cinder', 4]], [['cinder', 3], ['ombra', 3]], [['dboss', 1]]];
const isDead = (e) => e.dead;
const pubOf = (e) => ({ id: e.id, type: e.type, lv: e.lv, maxHp: e.maxHp, hp: e.hp, x: +e.x.toFixed(2), z: +e.z.toFixed(2), f: +e.f.toFixed(2), dead: !!e.dead });
function runOf(p) { const r = p.run && runs.get(p.run); return r && (r.state === 'run' || r.state === 'clear') ? r : null; }
/* instances created by plugins (tower, raid): id -> { members: Set(userId), ... }. They reuse the dungeon room and the same "only members see these monsters" filter. */
const extRuns = new Map();
const extOf = (p) => { for (const r of extRuns.values()) if (r.members.has(p.id)) return r; return null; };
function toRun(run, msg) { run.members.forEach((id) => { const o = C.online.get(id); if (o) C.send(o, msg); }); }
const inRoom = (o) => Math.hypot(o.x - DUN.x0, o.z - DUN.z0) <= DUN.roomR + 2;
function exitTo(o) { o.x = W.PORTAL.x + 2.5; o.z = W.PORTAL.z + 2.5; o.dirty = true; C.send(o, { t: 'correct', x: o.x, z: o.z }); }
function tpIn(o, run) {
  o.x = DUN.x0 + (Math.random() - 0.5) * 4; o.z = DUN.z0 - (DUN.roomR - 4); o.dirty = true;
  C.send(o, { t: 'correct', x: o.x, z: o.z });
  run.enemies.forEach((e) => { if (!e.dead) C.send(o, { t: 'espawn', e: pubOf(e) }); });
}
function hudMsg(run) {
  const t = now();
  return { t: 'dun', st: 'hud', wave: run.wave, waves: DUN.waves, left: run.enemies.filter((e) => !e.dead).length, secs: Math.max(0, Math.round((run.endsAt - t) / 1000)),
    n: run.n, wait: run.nextWaveAt ? Math.max(0, Math.ceil((run.nextWaveAt - t) / 1000)) : 0, clear: run.state === 'clear', diff: run.diff | 0 };
}
const nearPortal = (o, r) => Math.hypot(o.x - W.PORTAL.x, o.z - W.PORTAL.z) <= r;

function enterDungeon(p, m) {
  const z = p.zn; if (!z || p.dead) return;
  if (!thr(p, 'dun', 1500)) return;
  const cur = runOf(p);
  if (!nearPortal(p, 9)) return sys(p, 'Hãy đứng gần cổng hầm ngục (phía Nam làng, có vòng sáng tím) rồi nhấn E.');
  if (cur) { tpIn(p, cur); C.send(p, hudMsg(cur)); return sys(p, 'Bạn quay lại hầm ngục.'); }
  if (extOf(p)) return sys(p, 'Bạn đang ở trong một phó bản khác.');
  if (p.party && p.party.leader !== p.id) return sys(p, 'Chỉ đội trưởng mới mở được cổng. Hãy nhờ đội trưởng nhấn E.');
  const diff = Math.max(0, Math.min(DUN.diffs.length - 1, Math.floor(Number(m && m.diff)) || 0));
  const crew = (p.party ? p.party.members.map((id) => C.online.get(id)).filter(Boolean) : [p]).filter((o) => o.id === p.id || (!o.dead && nearPortal(o, 20) && !runOf(o) && !extOf(o)));
  const bad = [];
  crew.forEach((o) => {
    if ((o.data.level || 1) < DUN.diffMinLv[diff]) bad.push(o.name + ' (chưa đủ cấp ' + DUN.diffMinLv[diff] + ')');
    else if (leftToday(o) <= 0) bad.push(o.name + ' (hết lượt hôm nay)');
    else if (diff > ((o.zn && o.zn.dun.best) | 0) + 1) bad.push(o.name + ' (chưa thắng độ khó ' + DUN.diffs[diff - 1] + ')');
  });
  if (bad.length) return sys(p, 'Chưa thể vào: ' + bad.join(', ') + '.');
  const n = crew.length, t = now();
  const run = { id: runSeq++, members: new Set(crew.map((o) => o.id)), n, wave: 0, enemies: [], state: 'run', startAt: t, endsAt: t + DUN.minutes * 60000, diff,
    nextWaveAt: t + 8000, emptyFor: 0, hpMul: (1 + 0.65 * (n - 1)) * DUN.diffHp[diff], atkMul: (1 + 0.1 * (n - 1)) * DUN.diffAtk[diff], exitAt: 0 };
  runs.set(run.id, run);
  crew.forEach((o) => {
    o.run = run.id; o.zn.dun.n++; o.zn.dirty = true;
    tpIn(o, run);
    C.send(o, { t: 'dun', st: 'start', name: DUN.name + (diff ? ' (' + DUN.diffs[diff] + ')' : ''), n, minutes: DUN.minutes });
    sys(o, 'Vào ' + DUN.name + ' (' + DUN.diffs[diff] + ') cùng ' + n + ' người. Hạ hết ' + DUN.waves + ' đợt quái và boss trong ' + DUN.minutes + ' phút.');
    info(o);
  });
}
function leaveRun(p) {
  const run = runOf(p); if (!run) return;
  run.members.delete(p.id); p.run = null;
  if (inRoom(p)) exitTo(p);
  C.send(p, { t: 'dun', st: 'left' });
  info(p);
  if (!run.members.size) cleanup(run);
}
function spawnWave(run) {
  run.wave++;
  const c = { x: DUN.x0, z: DUN.z0 }, spawned = [];
  WAVES[run.wave - 1].forEach((pl) => {
    for (let i = 0; i < pl[1]; i++) {
      const boss = pl[0] === 'dboss', a = Math.random() * 6.283, r = boss ? 0 : 5 + Math.random() * 4;
      const e = C.world.spawnAt(pl[0], c.x + Math.cos(a) * r, c.z + Math.sin(a) * r, { inst: run.id, arena: c, hpMul: run.hpMul, atkMul: run.atkMul });
      run.enemies.push(e); spawned.push(e);
    }
  });
  toRun(run, { t: 'dun', st: 'wave', wave: run.wave, waves: DUN.waves, boss: run.wave === DUN.waves });
  spawned.forEach((e) => toRun(run, { t: 'espawn', e: pubOf(e) }));
}
function reward(o, run) {
  const d = o.data, lv = d.level || 1, df = run && run.diff | 0, rm = DUN.diffRew[df] || 1;
  const exp = Math.round(rules.expNeed(lv) * 0.35 * rm), gold = Math.round((300 + lv * 20) * rm), mats = { core: Math.round(rint(2, 3) * rm), gem: Math.round(rint(1, 2) * rm), gear: Math.round(rint(1, 2) * rm) };
  d.gold += gold; d.potions = Math.min(999, d.potions + 3);
  const up = C.addExp(o, exp);
  if (o.zn) { giveMats(o.zn, mats); o.zn.dun.clears++; if (df > (o.zn.dun.best | 0)) { o.zn.dun.best = df; sys(o, 'Đã mở độ khó ' + DUN.diffs[Math.min(df + 1, DUN.diffs.length - 1)] + '.'); } }
  C.pushMe(o);
  C.send(o, { t: 'dun', st: 'end', win: true, exp, gold, mats, lvUp: up ? d.level : null });
  info(o);
}
function finish(run, win, reason) {
  if (run.state !== 'run') return;
  if (win) {
    run.state = 'clear'; run.exitAt = now() + 25000;
    run.members.forEach((id) => { const o = C.online.get(id); if (o) reward(o, run); });
  } else {
    toRun(run, { t: 'dun', st: 'end', win: false, reason: reason || '' });
    cleanup(run);
  }
}
function cleanup(run) {
  const ids = [];
  run.enemies.forEach((e) => { ids.push(e.id); C.world.despawn(e); });
  toRun(run, { t: 'erem', ids });
  run.members.forEach((id) => {
    const o = C.online.get(id); if (!o) return;
    if (o.run === run.id) o.run = null;
    if (inRoom(o)) exitTo(o);
    info(o);
  });
  run.state = 'gone'; runs.delete(run.id);
}
function tickRuns() {
  const t = now();
  runs.forEach((run) => {
    if (run.state === 'clear') { toRun(run, hudMsg(run)); if (t >= run.exitAt) cleanup(run); return; }
    if (run.state !== 'run') return;
    const inside = [];
    run.members.forEach((id) => { const o = C.online.get(id); if (o && !o.dead && Math.hypot(o.x - DUN.x0, o.z - DUN.z0) <= DUN.roomR + 4) inside.push(o); });
    run.emptyFor = inside.length ? 0 : run.emptyFor + 1;
    if (t >= run.endsAt) return finish(run, false, 'Hết giờ.');
    if (run.emptyFor >= 40) return finish(run, false, 'Cả đội đã rời hầm ngục.');
    if (run.enemies.every(isDead)) {
      if (run.wave >= DUN.waves) return finish(run, true);
      if (!run.nextWaveAt) run.nextWaveAt = t + 4000;
      if (t >= run.nextWaveAt) { run.nextWaveAt = 0; spawnWave(run); }
    }
    toRun(run, hudMsg(run));
  });
}
/* players may only stand inside the dungeon room while they belong to a running run */
function blocked(p, x, z) {
  for (let i = 0; i < plugins.length; i++) { try { if (plugins[i].blocked && plugins[i].blocked(p, x, z)) return true; } catch (err) { /* ignore a broken plugin */ } }
  if (Math.hypot(x - DUN.x0, z - DUN.z0) > DUN.roomR + 1) return false;
  return !runOf(p) && !extOf(p);
}

/* messages that world.js broadcasts about dungeon monsters go only to the run's members */
function wrapBroadcast(bc, world) {
  return (msg, except) => {
    try {
      const t = msg && msg.t;
      if (t === 'es') {
        const pub = [], per = new Map();
        msg.list.forEach((r) => {
          const e = world.byId.get(r[0]);
          if (e && e.inst) { if (!per.has(e.inst)) per.set(e.inst, []); per.get(e.inst).push(r); } else pub.push(r);
        });
        if (pub.length) bc({ t: 'es', list: pub }, except);
        per.forEach((list, rid) => { const run = runs.get(rid) || extRuns.get(rid); if (run) toRun(run, { t: 'es', list }); });
        return;
      }
      if (t === 'espawn' || t === 'edmg' || t === 'edie' || t === 'ewind') {
        const e = world.byId.get(t === 'espawn' ? msg.e.id : msg.e);
        if (e && e.inst) { const run = runs.get(e.inst) || extRuns.get(e.inst); if (run) toRun(run, msg); return; }
      }
    } catch (err) { console.error('zones broadcast', err.message); }
    return bc(msg, except);
  };
}

/* ---------- monsters of the new zones (called once from world.js while it builds its layout) ---------- */
function layout(spawnAt) {
  loadPlugins();
  let seed = 777123; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const ring = (c, n, rMin, rMax, type) => { for (let i = 0; i < n; i++) { const a = rnd() * 6.283, r = rMin + rnd() * (rMax - rMin); spawnAt(type, c.x + Math.cos(a) * r, c.z + Math.sin(a) * r); } };
  ring(W.SWAMP, 8, 3, 15, 'fungo'); ring(W.SWAMP, 5, 5, 15, 'ragno'); spawnAt('sporo', W.SWAMP.x, W.SWAMP.z);
  ring(W.MINE, 8, 3, 14, 'talpa'); ring(W.MINE, 6, 4, 14, 'golem'); spawnAt('reQuang', W.MINE.x, W.MINE.z);
  ring(W.FROST, 8, 3, 12, 'pinguino'); ring(W.FROST, 6, 4, 12, 'orso'); spawnAt('regina', W.FROST.x, W.FROST.z);
  each((pl) => pl.layout && pl.layout(spawnAt, ring), 'layout'); // step 11: desert and abyss monsters (server/world2.js)
}

/* ---------- connection lifecycle and requests ---------- */
function onConnect(p) {
  try {
    p.zn = clean(loadRaw(p.id)); p.run = null; p.zThr = {};
    for (const run of runs.values()) if (run.members.has(p.id) && (run.state === 'run' || run.state === 'clear')) { p.run = run.id; break; }
    C.send(p, { t: 'nodes', list: nodeList() });
    info(p);
    const run = runOf(p);
    if (run) { run.enemies.forEach((e) => { if (!e.dead) C.send(p, { t: 'espawn', e: pubOf(e) }); }); C.send(p, hudMsg(run)); }
    else if (inRoom(p)) exitTo(p);
  } catch (err) { console.error('zones connect', err.message); }
  each((pl) => pl.onConnect && pl.onConnect(p), 'onConnect');
}
function onLeave(p) {
  each((pl) => pl.onLeave && pl.onLeave(p), 'onLeave');
  try { save(p); } catch (err) { console.error('zones leave', err.message); }
}
function handle(p, m) {
  try {
    switch (m.op) {
      case 'info': return info(p);
      case 'gather': return gather(p, m);
      case 'craft': return craft(p, m);
      case 'use': return useCons(p, m);
      case 'dun': return m.act === 'leave' ? leaveRun(p) : enterDungeon(p, m);
      default: {
        const op = String(m.op || '');
        for (let i = 0; i < plugins.length; i++) {
          const f = plugins[i].ops && plugins[i].ops[op];
          if (typeof f === 'function') { try { f(p, m); } catch (err) { console.error('[plugin ' + plugins[i].__name + '] op ' + op + ':', err.message); } return; }
        }
      }
    }
  } catch (err) { console.error('zones handle', err.message); }
}
function init(ctx) {
  C = ctx;
  loadPlugins();
  const API = { C, db, items, rules, thr, sys, rint, now, info, giveMats, addXp, evMult,
    room: DUN, W, pubOf, toRun, extRuns, extOf, runOf, nearPortal, exitTo, tpIn, plugin: (n) => plugins.find((x) => x.__name === n) || null };
  const ok = []; // a plugin whose init throws is dropped completely so its hooks never run half-set-up
  plugins.forEach((pl) => { try { if (pl.init) pl.init(C, API); ok.push(pl); } catch (err) { console.error('[plugin ' + pl.__name + '] init loi, bo qua plugin nay:', err.message); } });
  plugins.length = 0; ok.forEach((pl) => plugins.push(pl));
  setInterval(() => {
    const t = now();
    nodes.forEach((n) => { if (n.until && n.until <= t) { n.until = 0; C.broadcast({ t: 'node', id: n.id, on: 1 }); } });
    try { tickRuns(); } catch (err) { console.error('zones tick', err.message); }
    each((pl) => pl.tick && pl.tick(t), 'tick');
  }, 1000).unref();
  setInterval(() => { C.online.forEach((p) => { if (p.zn && p.zn.dirty) { try { save(p); } catch (err) { /* retry next round */ } } }); }, 15000).unref();
}

/* read-only numbers for the admin page */
function stats() {
  const out = [];
  runs.forEach((run) => {
    out.push({ id: run.id, state: run.state, wave: run.wave, waves: DUN.waves, members: [...run.members].map((id) => { const o = C.online.get(id); return o ? o.name : '#' + id; }),
      left: run.enemies.filter((e) => !e.dead).length, secs: Math.max(0, Math.round((run.endsAt - now()) / 1000)) });
  });
  return { runs: out, extra: (() => { try { const i = plugins.find((x) => x.__name === 'instances'); return i && i.stats ? i.stats() : []; } catch (err) { return []; } })() };
}

module.exports = { init, layout, onConnect, onLeave, handle, onKill, blocked, wrapBroadcast, expBonus, stats };
