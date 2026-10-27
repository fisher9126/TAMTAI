'use strict';
/* Aetherfall step 12 (server plugin of zones.js): Tháp Thử Thách (endless tower) and Raid Morvain.
   Both run in their own rooms (tower west, raid east) with the same trick as the dungeon: monsters carry `inst`, so only the members of the
   instance receive them (zones.js wrapBroadcast looks the id up in API.extRuns). Members who stay outside the room are dropped.
   - Tower: floor n has more and stronger monsters (every 10th floor is a boss floor). 1-4 players (party), best floor ranking. Rewards per floor.
   - Raid: a lobby of 1-10 players near the village, boss Morvain with 3 add phases and an enrage timer. The first clear of each week gives the full loot. */
const rules = require('../public/js/rules.js');
const W = rules.WORLD;
let C = null, API = null;
const now = () => Date.now();
const TOWER = { x: -80, z: 30, r: 12, name: 'Tháp Thử Thách', minLv: 12, floorMs: 4 * 60000 };
const RAID = { x: 86, z: 34, r: 13, name: 'Raid Morvain', minLv: 25, max: 10, minStart: 1, timeMs: 20 * 60000, enrageMs: 12 * 60000, revives: 3 };
const VILLAGE_R = 50;
const TIERS = [['cinder', 'ombra'], ['scorpio', 'mummia'], ['demone', 'drago']];
const BOSSES = ['dboss', 'sethra', 'vuoto'];
let seq = 1;
let lobby = null; // { leader, members: Set }

const weekKey = () => Math.floor((now() + 7 * 3600e3 - 4 * 86400e3) / (7 * 86400e3));
const nearVillage = (p) => Math.hypot(p.x - W.VILLAGE.x, p.z - W.VILLAGE.z) <= VILLAGE_R;
const sys = (p, t) => API.sys(p, t);
const rint = (a, b) => API.rint(a, b);
const insts = () => API.extRuns;
function room(inst) { return inst.kind === 'tower' ? TOWER : RAID; }
function toI(inst, msg) { API.toRun(inst, msg); }
function members(inst) { const out = []; inst.members.forEach((id) => { const o = C.online.get(id); if (o) out.push(o); }); return out; }
const equipP = () => API.plugin('equip');

function exitOut(o) {
  o.x = W.SPAWN.x + (Math.random() - 0.5) * 3; o.z = W.SPAWN.z + (Math.random() - 0.5) * 3; o.dirty = true;
  C.send(o, { t: 'correct', x: o.x, z: o.z });
}
function tpIn(o, inst) {
  const R = room(inst);
  o.x = R.x + (Math.random() - 0.5) * 5; o.z = R.z + R.r - 3; o.dirty = true;
  C.send(o, { t: 'correct', x: o.x, z: o.z });
  inst.enemies.forEach((e) => { if (!e.dead) C.send(o, { t: 'espawn', e: API.pubOf(e) }); });
}
function spawn(inst, type, ox, oz, hpMul, atkMul) {
  const R = room(inst);
  const e = C.world.spawnAt(type, R.x + ox, R.z + oz, { inst: inst.id, arena: { x: R.x, z: R.z }, hpMul, atkMul });
  inst.enemies.push(e); toI(inst, { t: 'espawn', e: API.pubOf(e) });
  return e;
}
function ring(inst, type, n, rad, hpMul, atkMul) {
  for (let i = 0; i < n; i++) { const a = (i / Math.max(1, n)) * 6.283 + Math.random() * 0.4; spawn(inst, type, Math.cos(a) * rad, Math.sin(a) * rad, hpMul, atkMul); }
}
function cleanup(inst) {
  const ids = []; inst.enemies.forEach((e) => { ids.push(e.id); try { C.world.despawn(e); } catch (err) { /* already gone */ } });
  toI(inst, { t: 'erem', ids });
  members(inst).forEach((o) => { C.send(o, { t: 'inst', st: 'left', kind: inst.kind, why: '' }); if (Math.hypot(o.x - room(inst).x, o.z - room(inst).z) <= room(inst).r + 6) exitOut(o); });
  insts().delete(inst.id);
}
function dropMember(inst, o, why) {
  inst.members.delete(o.id);
  if (Math.hypot(o.x - room(inst).x, o.z - room(inst).z) <= room(inst).r + 6) exitOut(o);
  C.send(o, { t: 'inst', st: 'left', kind: inst.kind, why: why || '' });
  if (!inst.members.size) cleanup(inst);
}
function endInst(inst, win, reason, extra) {
  if (inst.state === 'over') return;
  inst.state = 'over';
  toI(inst, Object.assign({ t: 'inst', st: 'end', kind: inst.kind, win, reason: reason || '', floor: inst.floor | 0 }, extra || {}));
  inst.closeAt = now() + (win ? 25000 : 6000);
}

/* ---------- tower ---------- */
function towerBest(uid) { const r = API.db.get('SELECT best FROM tower_best WHERE user_id = ?', uid); return r ? r.best : 0; }
function towerPlan(f) {
  if (f % 10 === 0) return { boss: BOSSES[(f / 10 - 1) % 3], adds: [[TIERS[Math.min(2, Math.floor((f - 1) / 12))][0], 2]] };
  const t = TIERS[Math.min(2, Math.floor((f - 1) / 12))], n = Math.min(8, 3 + Math.floor(f / 6));
  return { adds: [[t[0], Math.ceil(n / 2)], [t[1], Math.floor(n / 2)]] };
}
function towerSpawn(inst) {
  inst.floor++; inst.state = 'fight'; inst.endsAt = now() + TOWER.floorMs; inst.enemies = inst.enemies.filter((e) => !e.dead);
  const f = inst.floor, plan = towerPlan(f), n = inst.members.size;
  const hp = (1 + 0.08 * (f - 1)) * (1 + 0.5 * (n - 1)), atk = (1 + 0.03 * (f - 1)) * (1 + 0.08 * (n - 1));
  plan.adds.forEach(([type, cnt]) => { if (cnt > 0) ring(inst, type, cnt, 6, hp, atk); });
  if (plan.boss) spawn(inst, plan.boss, 0, 0, hp * 1.2, atk);
  toI(inst, { t: 'inst', st: 'floor', kind: 'tower', floor: f, boss: !!plan.boss });
}
function towerCleared(inst) {
  const f = inst.floor, E = equipP(); inst.state = 'between'; inst.nextAt = now() + 6000;
  members(inst).forEach((o) => {
    const gold = 40 + f * 12; o.data.gold += gold;
    const mats = {}; mats[['core', 'gem', 'gear', 'ore', 'coal'][rint(0, 4)]] = rint(1, 1 + Math.floor(f / 8));
    if (f % 5 === 0) mats.gem = (mats.gem | 0) + 1;
    if (o.zn) API.giveMats(o.zn, mats);
    C.addExp(o, Math.round(rules.expNeed(o.data.level || 1) * 0.02 * (1 + f / 10)));
    C.pushMe(o); API.info(o);
    C.send(o, { t: 'inst', st: 'reward', kind: 'tower', floor: f, gold, mats });
    if (f % 10 === 0 && E && E.grantPiece) E.grantPiece(o, f >= 30 ? 'epic' : 'rare');
    else if (f % 5 === 0 && E && E.grantGem) E.grantGem(o, f >= 25 ? 2 : 1);
    const best = towerBest(o.id);
    if (f > best) { API.db.run('INSERT INTO tower_best (user_id, best, at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET best = excluded.best, at = excluded.at', o.id, f, now()); sys(o, 'Kỷ lục mới của bạn: tầng ' + f + '!'); }
  });
}
function enterTower(p) {
  if (!API.thr(p, 'tenter', 1500) || p.dead) return;
  if (API.extOf(p) || API.runOf(p)) return sys(p, 'Bạn đang ở trong một phó bản.');
  if (!nearVillage(p)) return sys(p, 'Hãy đứng trong làng để vào ' + TOWER.name + '.');
  if (p.party && p.party.leader !== p.id) return sys(p, 'Chỉ đội trưởng mới mở được ' + TOWER.name + '.');
  const crew = (p.party ? p.party.members.map((id) => C.online.get(id)).filter(Boolean) : [p]).filter((o) => o.id === p.id || (!o.dead && nearVillage(o) && !API.extOf(o) && !API.runOf(o)));
  const bad = crew.filter((o) => (o.data.level || 1) < TOWER.minLv).map((o) => o.name + ' (chưa đủ cấp ' + TOWER.minLv + ')');
  if (bad.length) return sys(p, 'Chưa thể vào: ' + bad.join(', ') + '.');
  const inst = { id: 'T' + (seq++), kind: 'tower', members: new Set(crew.map((o) => o.id)), enemies: [], floor: 0, state: 'between', nextAt: now() + 6000, endsAt: 0, away: {}, closeAt: 0 };
  insts().set(inst.id, inst);
  crew.forEach((o) => { tpIn(o, inst); C.send(o, { t: 'inst', st: 'start', kind: 'tower', name: TOWER.name, n: crew.length }); sys(o, 'Bạn bước vào ' + TOWER.name + '. Hạ hết quái mỗi tầng để lên tầng tiếp theo.'); });
}

/* ---------- raid ---------- */
function lobbyView() {
  if (!lobby) return null;
  return { leader: lobby.leader, max: RAID.max, minLv: RAID.minLv, members: [...lobby.members].map((id) => { const o = C.online.get(id); return { id, name: o ? o.name : '#' + id, lv: o ? o.data.level || 1 : 0 }; }) };
}
function pushLobby() {
  const v = lobbyView();
  if (v) lobby.members.forEach((id) => { const o = C.online.get(id); if (o) C.send(o, { t: 'raidlobby', lobby: v }); });
}
function lobbyLeave(p, quiet) {
  if (!lobby || !lobby.members.has(p.id)) return;
  lobby.members.delete(p.id); C.send(p, { t: 'raidlobby', lobby: null });
  if (!lobby.members.size) { lobby = null; return; }
  if (lobby.leader === p.id) lobby.leader = [...lobby.members][0];
  if (!quiet) pushLobby(); else pushLobby();
}
function raidWeek(uid) { const r = API.db.get('SELECT week, clears FROM raid_player WHERE user_id = ?', uid); return r ? r : { week: -1, clears: 0 }; }
function raidLoot(inst, o) {
  const lv = o.data.level || 1, E = equipP(), wk = weekKey(), st = raidWeek(o.id);
  const first = st.week !== wk, gold = first ? 3000 + lv * 60 : 800, exp = Math.round(rules.expNeed(lv) * (first ? 1.2 : 0.3));
  o.data.gold += gold; C.addExp(o, exp);
  const mats = first ? { void: rint(6, 10), gem: rint(3, 5), core: rint(4, 7), gear: rint(3, 6) } : { void: rint(1, 3), core: rint(1, 2) };
  if (o.zn) API.giveMats(o.zn, mats);
  let got = [];
  if (first && E) {
    const piece = E.grantPiece && E.grantPiece(o, Math.random() < 0.35 ? 'legend' : 'epic'); if (piece) got.push(piece.name);
    if (E.grantGem) { E.grantGem(o, 2); E.grantGem(o, 2); }
  }
  API.db.run('INSERT INTO raid_player (user_id, week, clears, total) VALUES (?, ?, 1, 1) ON CONFLICT(user_id) DO UPDATE SET week = excluded.week, clears = ' + (first ? '1' : 'clears + 1') + ', total = total + 1', o.id, wk);
  C.pushMe(o); API.info(o);
  C.send(o, { t: 'inst', st: 'reward', kind: 'raid', first, gold, exp, mats, got });
}
function startRaid(p) {
  if (!lobby || lobby.leader !== p.id) return sys(p, 'Chỉ chủ sảnh mới bắt đầu được raid.');
  const crew = [...lobby.members].map((id) => C.online.get(id)).filter(Boolean);
  const bad = [];
  crew.forEach((o) => { if (o.dead) bad.push(o.name + ' (đang bị hạ gục)'); else if (!nearVillage(o)) bad.push(o.name + ' (ở xa làng)'); else if (API.extOf(o) || API.runOf(o)) bad.push(o.name + ' (đang ở phó bản khác)'); else if ((o.data.level || 1) < RAID.minLv) bad.push(o.name + ' (chưa đủ cấp ' + RAID.minLv + ')'); });
  if (bad.length) return sys(p, 'Chưa bắt đầu được: ' + bad.join(', ') + '.');
  if (crew.length < RAID.minStart) return sys(p, 'Cần ít nhất ' + RAID.minStart + ' người.');
  const inst = { id: 'R' + (seq++), kind: 'raid', members: new Set(crew.map((o) => o.id)), enemies: [], state: 'prep', startAt: now(), bossAt: now() + 10000, endsAt: now() + RAID.timeMs, phase: 0, boss: null, revives: RAID.revives, enraged: false, away: {}, n: crew.length, closeAt: 0, floor: 0 };
  insts().set(inst.id, inst); lobby.members.forEach((id) => { const o = C.online.get(id); if (o) C.send(o, { t: 'raidlobby', lobby: null }); }); lobby = null;
  crew.forEach((o) => { tpIn(o, inst); C.send(o, { t: 'inst', st: 'start', kind: 'raid', name: RAID.name, n: crew.length }); sys(o, 'Raid bắt đầu! Morvain sẽ xuất hiện sau 10 giây. Mỗi raid có ' + RAID.revives + ' lượt hồi sinh chung.'); });
}
function raidTick(inst, t) {
  const R = RAID;
  if (inst.state === 'prep' && t >= inst.bossAt) {
    inst.state = 'fight';
    const hp = 1 + 0.5 * (inst.n - 1), atk = 1 + 0.06 * (inst.n - 1);
    inst.boss = spawn(inst, 'morvain', 0, -3, hp, atk); inst.baseAtk = inst.boss.atk;
    toI(inst, { t: 'inst', st: 'phase', kind: 'raid', phase: 1, text: 'Morvain, Kẻ Nuốt Sao xuất hiện! Giai đoạn 1: Pháp sư.' });
  }
  if (inst.state !== 'fight' || !inst.boss) return;
  const b = inst.boss, pct = b.maxHp ? b.hp / b.maxHp : 1, hp = 1 + 0.5 * (inst.n - 1), atk = 1 + 0.06 * (inst.n - 1);
  if (b.dead) {
    endInst(inst, true, 'Morvain đã bị hạ!'); members(inst).forEach((o) => { try { raidLoot(inst, o); } catch (err) { console.error('raid loot', err.message); } });
    return;
  }
  if (inst.phase === 0 && pct <= 0.75) { inst.phase = 1; ring(inst, 'demone', 4, 7, hp, atk); toI(inst, { t: 'inst', st: 'phase', kind: 'raid', phase: 2, text: 'Giai đoạn 2: Morvain hút năm nguyên tố, gọi quỷ bóng tối!' }); }
  if (inst.phase === 1 && pct <= 0.5) { inst.phase = 2; ring(inst, 'drago', 4, 7, hp, atk); ring(inst, 'demone', 2, 4, hp, atk); toI(inst, { t: 'inst', st: 'phase', kind: 'raid', phase: 3, text: 'Morvain gầm lên: rồng con xuất hiện!' }); }
  if (inst.phase === 2 && pct <= 0.25) { inst.phase = 3; ring(inst, 'drago', 6, 8, hp, atk); if (typeof b.atk === 'number') b.atk = b.atk * 1.25; toI(inst, { t: 'inst', st: 'phase', kind: 'raid', phase: 4, text: 'Giai đoạn cuối: Morvain nổi điên, sát thương tăng!' }); }
  if (!inst.enraged && t - inst.startAt >= R.enrageMs) { inst.enraged = true; if (typeof b.atk === 'number') b.atk = b.atk * 1.5; toI(inst, { t: 'inst', st: 'phase', kind: 'raid', phase: 9, text: 'Morvain cuồng nộ! Sát thương tăng mạnh, hãy kết thúc nhanh!' }); }
  if (t >= inst.endsAt) endInst(inst, false, 'Hết giờ, Morvain nuốt chửng ánh sao.');
}

/* ---------- shared tick ---------- */
function hud(inst, t) {
  const R = room(inst), left = inst.enemies.filter((e) => !e.dead).length;
  const base = { t: 'inst', st: 'hud', kind: inst.kind, state: inst.state, left, secs: Math.max(0, Math.round(((inst.endsAt || t) - t) / 1000)), n: inst.members.size, floor: inst.floor | 0 };
  if (inst.kind === 'raid') Object.assign(base, { phase: inst.phase | 0, revives: inst.revives | 0, boss: inst.boss ? { hp: Math.max(0, Math.round(inst.boss.hp)), max: inst.boss.maxHp, name: inst.boss.d ? inst.boss.d.name : 'Morvain' } : null, wait: inst.state === 'prep' ? Math.max(0, Math.ceil((inst.bossAt - t) / 1000)) : 0 });
  else Object.assign(base, { best: 0, wait: inst.state === 'between' ? Math.max(0, Math.ceil((inst.nextAt - t) / 1000)) : 0 });
  toI(inst, base);
}
function tick(t) {
  insts().forEach((inst) => {
    if (inst.kind !== 'tower' && inst.kind !== 'raid') return;
    const R = room(inst);
    if (inst.state === 'over') { if (t >= inst.closeAt) cleanup(inst); return; }
    // drop members who left the room or went offline for a while
    let alive = 0;
    inst.members.forEach((id) => {
      const o = C.online.get(id);
      if (!o) { inst.away[id] = (inst.away[id] || 0) + 1; if (inst.away[id] > 60) inst.members.delete(id); return; }
      const inside = Math.hypot(o.x - R.x, o.z - R.z) <= R.r + 5;
      if (!inside && !o.dead) { inst.away[id] = (inst.away[id] || 0) + 1; if (inst.away[id] >= 6) dropMember(inst, o, 'Bạn đã rời khỏi phòng.'); return; }
      if (inside) inst.away[id] = 0;
      if (!o.dead && inside) alive++;
    });
    if (!insts().has(inst.id)) return;
    if (inst.kind === 'tower') {
      if (inst.state === 'between' && t >= inst.nextAt) { if (alive) towerSpawn(inst); }
      else if (inst.state === 'fight') {
        if (inst.enemies.every((e) => e.dead)) towerCleared(inst);
        else if (t >= inst.endsAt) endInst(inst, false, 'Hết giờ ở tầng ' + inst.floor + '.');
        else if (!alive) { inst.noneFor = (inst.noneFor | 0) + 1; if (inst.noneFor >= 6) endInst(inst, false, 'Cả đội đã gục ở tầng ' + inst.floor + '.'); } else inst.noneFor = 0;
      }
    } else {
      if (!alive && inst.state !== 'prep' && (inst.revives | 0) <= 0) { inst.noneFor = (inst.noneFor | 0) + 1; if (inst.noneFor >= 8) endInst(inst, false, 'Cả đội đã gục.'); } else if (alive) inst.noneFor = 0;
      raidTick(inst, t);
    }
    if (insts().has(inst.id) && inst.state !== 'over') hud(inst, t);
  });
}

const ops = {
  tenter(p) { enterTower(p); },
  tleave(p) { const i = API.extOf(p); if (i && i.kind === 'tower') dropMember(i, p, 'Bạn rời tháp.'); },
  ttop(p) {
    const rows = API.db.all('SELECT u.username AS name, t.best AS best FROM tower_best t JOIN users u ON u.id = t.user_id ORDER BY t.best DESC, t.at ASC LIMIT 10');
    C.send(p, { t: 'tower', top: rows, mine: towerBest(p.id) });
  },
  rjoin(p) {
    if (!API.thr(p, 'rjoin', 600)) return;
    if (API.extOf(p) || API.runOf(p)) return sys(p, 'Bạn đang ở trong một phó bản.');
    if ((p.data.level || 1) < RAID.minLv) return sys(p, 'Cần cấp ' + RAID.minLv + ' để vào raid.');
    if (!nearVillage(p)) return sys(p, 'Hãy đứng trong làng để vào sảnh raid.');
    if (!lobby) lobby = { leader: p.id, members: new Set() };
    if (lobby.members.has(p.id)) return pushLobby();
    if (lobby.members.size >= RAID.max) return sys(p, 'Sảnh raid đã đủ ' + RAID.max + ' người.');
    lobby.members.add(p.id); pushLobby();
    lobby.members.forEach((id) => { if (id !== p.id) { const o = C.online.get(id); if (o) sys(o, p.name + ' vào sảnh raid.'); } });
  },
  rleave(p) { lobbyLeave(p); const i = API.extOf(p); if (i && i.kind === 'raid') dropMember(i, p, 'Bạn rời raid.'); },
  rstart(p) { startRaid(p); },
  rinfo(p) {
    const wk = weekKey(), st = raidWeek(p.id);
    C.send(p, { t: 'raidlobby', lobby: lobbyView(), me: { firstDone: st.week === wk, clears: st.clears | 0 } });
    ops.ttop(p);
  },
  rrevive(p) {
    const i = API.extOf(p); if (!i || i.kind !== 'raid' || i.state !== 'fight') return sys(p, 'Bạn không ở trong raid đang diễn ra.');
    if (!p.dead && p.hp > 0) return;
    if ((i.revives | 0) <= 0) return sys(p, 'Raid đã hết lượt hồi sinh.');
    if (!API.thr(p, 'rrev', 4000)) return;
    i.revives--;
    let cb = null; try { cb = require('./combat'); } catch (err) { /* no combat module */ }
    if (cb) { cb.respawn(p); }
    p.dead = false; i.members.add(p.id); i.away[p.id] = 0; tpIn(p, i);
    C.send(p, { t: 'revived' }); sys(p, 'Bạn đã hồi sinh trong raid. Còn ' + i.revives + ' lượt.');
  }
};

function init(ctx, api) {
  C = ctx; API = api;
  API.db.exec('CREATE TABLE IF NOT EXISTS tower_best (user_id INTEGER PRIMARY KEY, best INTEGER NOT NULL, at INTEGER NOT NULL)');
  API.db.exec('CREATE TABLE IF NOT EXISTS raid_player (user_id INTEGER PRIMARY KEY, week INTEGER NOT NULL, clears INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL DEFAULT 0)');
}
function onConnect(p) {
  const i = API.extOf(p);
  if (i && (i.kind === 'tower' || i.kind === 'raid') && i.state !== 'over') { tpIn(p, i); C.send(p, { t: 'inst', st: 'start', kind: i.kind, name: room(i).name, n: i.members.size }); }
  else for (const R of [TOWER, RAID]) if (Math.hypot(p.x - R.x, p.z - R.z) <= R.r + 2) exitOut(p);
}
function onLeave(p) { lobbyLeave(p, true); }
function blocked(p, x, z) {
  const i = API.extOf(p);
  if (Math.hypot(x - TOWER.x, z - TOWER.z) <= TOWER.r + 1) return !(i && i.kind === 'tower');
  if (Math.hypot(x - RAID.x, z - RAID.z) <= RAID.r + 1) return !(i && i.kind === 'raid');
  return false;
}
function stats() { const out = []; insts().forEach((i) => { if (i.kind === 'tower' || i.kind === 'raid') out.push({ id: i.id, kind: i.kind, floor: i.floor, members: i.members.size }); }); return out; }

module.exports = { init, onConnect, onLeave, tick, blocked, ops, stats };
