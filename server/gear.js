'use strict';
/* Aetherfall step 8 (server plugin of zones.js): accessories (rings, necklace, charm), random secondary stats, sets, legendary special trait,
   lock / sell / disassemble / craft. Items live in table gear_player (own bag of 30), equipped ones add flat stats through d.xgear
   (read by rules.playerStats). Monsters drop accessories through onKill. The player's main equipment is unchanged. */
const G = require('../public/js/geardata.js');
let C = null, API = null;
const SLOTS = ['ring1', 'ring2', 'neck', 'charm'];
const now = () => Date.now();

function blank() { return { bag: [], eq: { ring1: null, ring2: null, neck: null, charm: null }, dirty: false }; }
function load(p) {
  const s = blank();
  try {
    const r = API.db.get('SELECT data FROM gear_player WHERE user_id = ?', p.id);
    if (r) {
      const d = JSON.parse(r.data);
      s.bag = (d.bag || []).map(G.clean).filter(Boolean).slice(0, G.BAG);
      SLOTS.forEach((k) => { const it = G.clean(d.eq && d.eq[k]); s.eq[k] = it && (it.kind === 'ring' ? k.startsWith('ring') : it.kind === k) ? it : null; });
    }
  } catch (err) { console.error('gear load', err.message); }
  p.gr = s;
}
function save(p) {
  if (!p.gr) return;
  API.db.run('INSERT INTO gear_player (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data', p.id, JSON.stringify({ bag: p.gr.bag, eq: p.gr.eq }));
  p.gr.dirty = false;
}
/* sum of equipped stats + set bonuses -> d.xgear */
function apply(p) {
  const g = p.gr, x = { atk: 0, def: 0, hp: 0, mp: 0, crit: 0, spd: 0 }, cnt = {};
  SLOTS.forEach((k) => { const it = g.eq[k]; if (!it) return; const st = G.stats(it); Object.keys(st).forEach((s) => { x[s] += st[s]; }); if (it.set) cnt[it.set] = (cnt[it.set] || 0) + 1; });
  Object.keys(cnt).forEach((id) => {
    const set = G.SETS[id];
    if (cnt[id] >= 2) Object.keys(set.b2).forEach((s) => { x[s] += set.b2[s]; });
    if (cnt[id] >= 3) Object.keys(set.b3).forEach((s) => { x[s] += set.b3[s]; });
  });
  p.data.xgear = x; g.sets = cnt;
  try { require('./combat').sendVit(p); } catch (err) { /* combat module not installed */ }
  C.pushMe(p);
}
function info(p) { if (p.gr) C.send(p, { t: 'ginfo', bag: p.gr.bag, eq: p.gr.eq, sets: p.gr.sets || {}, max: G.BAG }); }
const find = (p, id) => p.gr.bag.findIndex((it) => it.id === String(id || ''));

const ops = {
  ginfo(p) { info(p); },
  gequip(p, m) {
    if (!API.thr(p, 'gequip', 200)) return;
    const i = find(p, m.id); if (i < 0) return;
    const it = p.gr.bag[i]; let slot;
    if (it.kind === 'ring') slot = m.slot === 'ring2' ? 'ring2' : m.slot === 'ring1' ? 'ring1' : (!p.gr.eq.ring1 ? 'ring1' : !p.gr.eq.ring2 ? 'ring2' : 'ring1');
    else slot = it.kind;
    if ((p.data.level || 1) < Math.max(1, it.ilvl - 6)) return API.sys(p, 'Cần cấp ' + (it.ilvl - 6) + ' để mặc món này.');
    p.gr.bag.splice(i, 1);
    const old = p.gr.eq[slot]; if (old) p.gr.bag.push(old);
    p.gr.eq[slot] = it; p.gr.dirty = true; apply(p); info(p);
  },
  gunequip(p, m) {
    const k = String(m.slot || ''); if (!SLOTS.includes(k) || !p.gr.eq[k]) return;
    if (p.gr.bag.length >= G.BAG) return API.sys(p, 'Túi trang sức đã đầy (' + G.BAG + ').');
    p.gr.bag.push(p.gr.eq[k]); p.gr.eq[k] = null; p.gr.dirty = true; apply(p); info(p);
  },
  glock(p, m) { const i = find(p, m.id); if (i < 0) return; p.gr.bag[i].lock = !p.gr.bag[i].lock; p.gr.dirty = true; info(p); },
  gsell(p, m) {
    const i = find(p, m.id); if (i < 0) return; const it = p.gr.bag[i];
    if (it.lock) return API.sys(p, 'Món này đang khóa, mở khóa trước khi bán.');
    p.gr.bag.splice(i, 1); const gold = G.worth(it); p.data.gold += gold; p.gr.dirty = true; C.pushMe(p); info(p);
    API.sys(p, 'Đã bán ' + it.name + ' được ' + gold + ' vàng.');
  },
  gdis(p, m) {
    const i = find(p, m.id); if (i < 0) return; const it = p.gr.bag[i];
    if (it.lock) return API.sys(p, 'Món này đang khóa, mở khóa trước khi phân rã.');
    const got = {}, R = API.rint;
    if (it.rarity === 'common') got.ore = R(1, 2); else if (it.rarity === 'rare') { got.ore = R(2, 3); if (Math.random() < 0.4) got.gem = 1; }
    else if (it.rarity === 'epic') { got.gem = R(1, 2); got.core = R(0, 1); } else { got.gem = R(2, 3); got.core = R(1, 2); }
    p.gr.bag.splice(i, 1); p.gr.dirty = true; if (p.zn) API.giveMats(p.zn, got);
    C.send(p, { t: 'zgain', mats: got, x: p.x, z: p.z }); API.info(p); info(p);
  },
  gcraft(p, m) {
    if (!API.thr(p, 'gcraft', 800)) return;
    const kind = String(m.kind || ''), rarity = String(m.rarity || '');
    const COST = { rare: { gold: 150, mats: { gem: 1, ore: 4 }, lv: 5 }, epic: { gold: 600, mats: { gem: 3, core: 2 }, lv: 12 }, legend: { gold: 3000, mats: { gem: 8, core: 6, gear: 4 }, lv: 20 } }[rarity];
    if (!G.KINDS[kind] || !COST) return;
    const lv = p.data.level || 1;
    if (lv < COST.lv) return API.sys(p, 'Cần cấp ' + COST.lv + ' để chế tác món ' + G.RNAME[rarity] + '.');
    if (p.gr.bag.length >= G.BAG) return API.sys(p, 'Túi trang sức đã đầy.');
    if (p.data.gold < COST.gold) return API.sys(p, 'Không đủ vàng (cần ' + COST.gold + ').');
    for (const k in COST.mats) if (!p.zn || (p.zn.mats[k] | 0) < COST.mats[k]) return API.sys(p, 'Thiếu ' + API.rules.MATS[k].name + ' (cần ' + COST.mats[k] + ').');
    p.data.gold -= COST.gold; for (const k in COST.mats) p.zn.mats[k] -= COST.mats[k]; p.zn.dirty = true;
    const it = G.roll(kind, rarity, lv); p.gr.bag.push(it); p.gr.dirty = true;
    C.pushMe(p); API.info(p); info(p); C.send(p, { t: 'gdrop', item: it, from: 'craft' });
  }
};

/* drops from monsters: normal 3%, elite 35%, boss 100% (rarity rolled from the table) */
function onKill(p, e) {
  const g = p.gr; if (!g || g.bag.length >= G.BAG) return;
  const d = e.d || {}, chance = d.boss ? 1 : d.elite ? 0.35 : 0.03;
  if (Math.random() >= chance) return;
  const r = Math.random();
  const rarity = d.boss ? (r < 0.12 ? 'legend' : r < 0.6 ? 'epic' : 'rare') : d.elite ? (r < 0.05 ? 'legend' : r < 0.4 ? 'epic' : 'rare') : (r < 0.02 ? 'epic' : r < 0.3 ? 'rare' : 'common');
  const lvl = Math.max(1, Math.min(p.data.level || 1, ((d.lv && d.lv[1]) || 1) + 2));
  const it = G.roll(['ring', 'neck', 'charm'][Math.floor(Math.random() * 3)], rarity, lvl);
  g.bag.push(it); g.dirty = true; C.send(p, { t: 'gdrop', item: it, from: 'drop' }); info(p);
}
function init(ctx, api) { C = ctx; API = api; API.db.exec('CREATE TABLE IF NOT EXISTS gear_player (user_id INTEGER PRIMARY KEY, data TEXT NOT NULL)'); }
function onConnect(p) { load(p); apply(p); info(p); }
function onLeave(p) { try { save(p); } catch (err) { console.error('gear save', err.message); } }
function tick() { C.online.forEach((p) => { if (p.gr && p.gr.dirty && now() % 15000 < 1000) save(p); }); }

module.exports = { init, onConnect, onLeave, onKill, tick, ops };
