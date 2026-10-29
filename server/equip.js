'use strict';
/* Aetherfall step 11 (server plugin of zones.js): extended equipment.
   - gloves, pants and off-hand (shield / spell book) in their own bag of 40 (table equip_player), stats added through d.xgear2
   - durability for ALL eight slots: -8 on every death, 0 = the piece stops working (extra slots) or weakens attack/armour (main slots, d.wear), repaired in the village
   - gem sockets (epic 0-1, legendary 2), gem cutting and upgrading, unsocketing, reforging one secondary line, enhancement +1..+15 for the extra pieces
     (the original five slots are enhanced in the Social panel, now also up to +15)
   - appearance slots (transmog) per slot and hide-helmet / hide-cape; the visible look of every player is broadcast as { t: 'elook', id, v }
   - personal storage (60 original-style items) usable by the character */
const E = require('../public/js/equipdata.js');
let C = null, API = null;
const J = JSON.stringify;
const now = () => Date.now();
const VILLAGE = { x: 0, z: 0 }, VILLAGE_R = 45;
const COST = {
  rare: { gold: 140, mats: { ore: 4, coal: 2 }, lv: 5 },
  epic: { gold: 550, mats: { gem: 2, core: 2, sand: 3 }, lv: 12 },
  legend: { gold: 2800, mats: { gem: 6, core: 5, gear: 4, bone: 3 }, lv: 20 }
};

function blank() { return { bag: [], eq: { gloves: null, pants: null, offhand: null }, gems: {}, cos: {}, hide: { helmet: false, cape: false }, unlocked: {}, store: [], mdur: {}, dirty: false, saved: 0 }; }
function load(p) {
  const s = blank();
  try {
    const r = API.db.get('SELECT data FROM equip_player WHERE user_id = ?', p.id);
    if (r) {
      const d = JSON.parse(r.data);
      s.bag = (d.bag || []).map(E.clean).filter(Boolean).slice(0, E.BAG);
      E.SLOTS.forEach((k) => { const it = E.clean(d.eq && d.eq[k]); s.eq[k] = it && it.slot === k ? it : null; });
      Object.keys(d.gems || {}).forEach((k) => { if (E.parseGem(k)) s.gems[k] = Math.max(0, Math.min(999, d.gems[k] | 0)); });
      Object.keys(d.unlocked || {}).forEach((k) => { const m = /^([a-z]+)_(common|rare|epic|legend)$/.exec(k); if (m && E.ALL.includes(m[1])) s.unlocked[k] = 1; });
      Object.keys(d.cos || {}).forEach((k) => { if (E.ALL.includes(k) && E.RAR.includes(d.cos[k]) && s.unlocked[k + '_' + d.cos[k]]) s.cos[k] = d.cos[k]; });
      s.hide = { helmet: !!(d.hide && d.hide.helmet), cape: !!(d.hide && d.hide.cape) };
      s.store = (d.store || []).map((it) => API.items.validItem(it)).filter(Boolean).slice(0, E.STORE);
      Object.keys(d.mdur || {}).slice(0, 200).forEach((k) => { if (/^[A-Za-z0-9_-]{1,40}$/.test(k)) s.mdur[k] = Math.max(0, Math.min(E.MAX_DUR, d.mdur[k] | 0)); });
    }
  } catch (err) { console.error('equip load', err.message); }
  p.eqx = s;
}
function save(p) {
  const s = p.eqx; if (!s) return;
  const keys = Object.keys(s.mdur); if (keys.length > 200) keys.slice(0, keys.length - 200).forEach((k) => { delete s.mdur[k]; });
  API.db.run('INSERT INTO equip_player (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data', p.id,
    J({ bag: s.bag, eq: s.eq, gems: s.gems, unlocked: s.unlocked, cos: s.cos, hide: s.hide, store: s.store, mdur: s.mdur }));
  s.dirty = false; s.saved = now();
}
const mark = (p) => { p.eqx.dirty = true; };
const sys = (p, t) => API.sys(p, t);

/* ---------- durability ---------- */
function mainItem(p, slot) { return (p.data.eq && p.data.eq[slot]) || null; }
function durMain(p, it) { const v = p.eqx.mdur[it.id]; return v == null ? E.MAX_DUR : v; }
function curOf(p, slot) { // current durability of whatever is worn in this slot, or null
  if (E.SLOTS.includes(slot)) { const it = p.eqx.eq[slot]; return it ? it.cur : null; }
  const it = mainItem(p, slot); return it ? durMain(p, it) : null;
}
function loseDur(p, n) {
  E.MAIN.forEach((s) => { const it = mainItem(p, s); if (it) p.eqx.mdur[it.id] = Math.max(0, durMain(p, it) - n); });
  E.SLOTS.forEach((s) => { const it = p.eqx.eq[s]; if (it) it.cur = Math.max(0, it.cur - n); });
  mark(p); apply(p); info(p);
  sys(p, 'Trang bị bị hao mòn sau khi bạn bị hạ gục (-' + n + ' độ bền). Sửa ở thợ rèn trong làng (phím J, tab Trang bị).');
}

/* ---------- stats ---------- */
function apply(p) {
  const x = { atk: 0, def: 0, hp: 0, mp: 0, crit: 0, spd: 0 };
  E.SLOTS.forEach((s) => { const it = p.eqx.eq[s]; if (!it || it.cur <= 0) return; const st = E.stats(it); Object.keys(st).forEach((k) => { x[k] += st[k]; }); });
  const xf = p.data.xfac; if (xf) Object.keys(xf).forEach((k) => { if (k in x) x[k] += xf[k]; }); // faction reputation bonus (server/faction.js)
  p.data.xgear2 = x;
  let broken = 0; E.MAIN.forEach((s) => { const it = mainItem(p, s); if (it && durMain(p, it) <= 0) broken++; });
  p.data.wear = Math.min(0.4, broken * 0.08);
  if (typeof p.hp === 'number') { try { require('./combat').clamp(p); } catch (err) { /* combat module missing */ } }
  C.pushMe(p);
}

/* ---------- appearance ---------- */
function scanUnlock(p) {
  const s = p.eqx; let add = 0;
  const got = (it) => { if (!it || !it.slot || !it.rarity) return; const k = it.slot + '_' + it.rarity; if (!s.unlocked[k]) { s.unlocked[k] = 1; add++; } };
  E.MAIN.forEach((sl) => got(mainItem(p, sl)));
  (p.data.inv || []).forEach(got); s.bag.forEach(got); E.SLOTS.forEach((sl) => got(s.eq[sl])); s.store.forEach(got);
  if (add) mark(p);
}
function visOf(p) {
  const s = p.eqx, v = {};
  E.ALL.forEach((sl) => {
    const it = E.SLOTS.includes(sl) ? s.eq[sl] : mainItem(p, sl);
    let r = it ? it.rarity : null; if (s.cos[sl]) r = s.cos[sl];
    if (!r) return;
    v[sl] = sl === 'offhand' ? r + ':' + (it && it.sub === 'tome' ? 't' : 's') : r;
  });
  if (s.hide.helmet) delete v.helmet; if (s.hide.cape) delete v.cape;
  return v;
}
function pushLook(p) {
  const v = visOf(p), j = J(v);
  if (p.eqxLook === j) return; p.eqxLook = j;
  C.broadcast({ t: 'elook', id: p.id, v }, p);
  C.send(p, { t: 'elook', id: p.id, v, self: true });
}

/* ---------- client info ---------- */
function info(p) {
  const s = p.eqx; if (!s) return;
  const main = E.MAIN.map((sl) => { const it = mainItem(p, sl); return it ? { slot: sl, id: it.id, name: it.name, rarity: it.rarity, ilvl: it.ilvl, enh: it.enh || 0, cur: durMain(p, it) } : { slot: sl, id: null }; });
  C.send(p, { t: 'einfo', bag: s.bag, eq: s.eq, gems: s.gems, cos: s.cos, hide: s.hide, unlocked: Object.keys(s.unlocked), store: s.store, main,
    cap: { bag: E.BAG, store: E.STORE }, inVillage: inVillage(p), repair: repairTotal(p) });
}
const inVillage = (p) => Math.hypot(p.x - VILLAGE.x, p.z - VILLAGE.z) <= VILLAGE_R;
function repairTotal(p) {
  let c = 0;
  E.MAIN.forEach((sl) => { const it = mainItem(p, sl); if (it) c += E.repairCost(API.items.itemValue(it), E.MAX_DUR - durMain(p, it)); });
  E.SLOTS.forEach((sl) => { const it = p.eqx.eq[sl]; if (it) c += E.repairCost(E.worth(it), E.MAX_DUR - it.cur); });
  return c;
}

/* ---------- helpers ---------- */
function findAny(p, id) { // an extra piece in the bag or worn
  id = String(id || '');
  let i = p.eqx.bag.findIndex((it) => it.id === id); if (i >= 0) return { it: p.eqx.bag[i], where: 'bag', i };
  for (const sl of E.SLOTS) if (p.eqx.eq[sl] && p.eqx.eq[sl].id === id) return { it: p.eqx.eq[sl], where: 'eq', slot: sl };
  return null;
}
function matsError(p, need) { const z = p.zn; if (!z) return 'Chưa tải dữ liệu nguyên liệu.'; for (const k in need) if ((z.mats[k] | 0) < need[k]) return 'Thiếu ' + API.rules.MATS[k].name + ' (cần ' + need[k] + ').'; return null; }
function takeMats(p, need) { for (const k in need) p.zn.mats[k] -= need[k]; p.zn.dirty = true; }
function giveGems(p, list) { list.forEach((k) => { if (E.parseGem(k)) p.eqx.gems[k] = Math.min(999, (p.eqx.gems[k] | 0) + 1); }); }
const reply = (p, ok, text) => { C.send(p, { t: 'eres', ok, text }); };

const ops = {
  einfo(p) { info(p); },
  eequip(p, m) {
    if (!API.thr(p, 'eequip', 200)) return;
    const f = findAny(p, m.id); if (!f || f.where !== 'bag') return;
    const it = f.it, lv = p.data.level || 1;
    if (lv < Math.max(1, it.ilvl - 6)) return sys(p, 'Cần cấp ' + (it.ilvl - 6) + ' để mặc món này.');
    p.eqx.bag.splice(f.i, 1);
    const old = p.eqx.eq[it.slot]; if (old) p.eqx.bag.push(old);
    p.eqx.eq[it.slot] = it; mark(p); scanUnlock(p); apply(p); pushLook(p); info(p);
  },
  eunequip(p, m) {
    const k = String(m.slot || ''); if (!E.SLOTS.includes(k) || !p.eqx.eq[k]) return;
    if (p.eqx.bag.length >= E.BAG) return sys(p, 'Túi trang bị phụ đã đầy (' + E.BAG + ').');
    p.eqx.bag.push(p.eqx.eq[k]); p.eqx.eq[k] = null; mark(p); apply(p); pushLook(p); info(p);
  },
  elock(p, m) { const f = findAny(p, m.id); if (!f) return; f.it.lock = !f.it.lock; mark(p); info(p); },
  esell(p, m) {
    const f = findAny(p, m.id); if (!f || f.where !== 'bag') return;
    if (f.it.lock) return sys(p, 'Món này đang khóa, mở khóa trước khi bán.');
    p.eqx.bag.splice(f.i, 1); giveGems(p, f.it.sock.filter(Boolean));
    const gold = E.worth(f.it); p.data.gold += gold; mark(p); C.pushMe(p); info(p); sys(p, 'Đã bán ' + E.nameOf(f.it) + ' được ' + gold + ' vàng.');
  },
  esellmany(p, m) {
    if (!p.eqx || !Array.isArray(m.ids)) return;
    const want = new Set(m.ids.slice(0, 100).map(String)); let n = 0, gold = 0;
    p.eqx.bag = p.eqx.bag.filter((it) => { if (!want.has(String(it.id)) || it.lock) return true; giveGems(p, (it.sock || []).filter(Boolean)); n++; gold += E.worth(it); return false; });
    if (!n) return;
    p.data.gold += gold; mark(p); C.pushMe(p); info(p); sys(p, 'Đã bán nhanh ' + n + ' món trang bị phụ được ' + gold + ' vàng.');
  },
  edis(p, m) {
    const f = findAny(p, m.id); if (!f || f.where !== 'bag') return;
    if (f.it.lock) return sys(p, 'Món này đang khóa, mở khóa trước khi phân rã.');
    const it = f.it, got = {}, R = API.rint;
    if (it.rarity === 'common') got.ore = R(1, 2); else if (it.rarity === 'rare') { got.ore = R(2, 3); if (Math.random() < 0.4) got.gem = 1; }
    else if (it.rarity === 'epic') { got.gem = R(1, 2); got.core = R(0, 1); } else { got.gem = R(2, 3); got.core = R(1, 2); }
    if ((it.enh | 0) >= 5) got.gear = (got.gear | 0) + Math.floor(it.enh / 5); // enhanced pieces give gears back (document: disassemble into enhancement materials)
    p.eqx.bag.splice(f.i, 1); giveGems(p, it.sock.filter(Boolean)); mark(p);
    if (p.zn) API.giveMats(p.zn, got);
    C.send(p, { t: 'zgain', mats: got, x: p.x, z: p.z }); API.info(p); info(p);
  },
  ecraft(p, m) {
    if (!API.thr(p, 'ecraft', 800)) return;
    const slot = String(m.slot || ''), rarity = String(m.rarity || ''), c = COST[rarity];
    if (!E.SLOTS.includes(slot) || !c) return;
    if ((p.data.level || 1) < c.lv) return sys(p, 'Cần cấp ' + c.lv + ' để chế tác món ' + E.RNAME[rarity] + '.');
    if (p.eqx.bag.length >= E.BAG) return sys(p, 'Túi trang bị phụ đã đầy.');
    if (p.data.gold < c.gold) return sys(p, 'Không đủ vàng (cần ' + c.gold + ').');
    const err = matsError(p, c.mats); if (err) return sys(p, err);
    p.data.gold -= c.gold; takeMats(p, c.mats);
    const it = E.roll(slot, rarity, p.data.level || 1); p.eqx.bag.push(it); mark(p); scanUnlock(p);
    C.pushMe(p); API.info(p); info(p); C.send(p, { t: 'edrop', item: it, from: 'craft' });
  },
  /* gems */
  ecut(p, m) {
    if (!API.thr(p, 'ecut', 400)) return;
    const type = String(m.type || ''); if (!E.GEMS[type]) return;
    const need = { gem: 2 }, err = matsError(p, need); if (err) return sys(p, err);
    if (p.data.gold < 30) return sys(p, 'Cần 30 vàng để mài ngọc.');
    p.data.gold -= 30; takeMats(p, need); giveGems(p, [E.gemKey(type, 1)]); mark(p); C.pushMe(p); API.info(p); info(p);
  },
  eupg(p, m) {
    if (!API.thr(p, 'eupg', 400)) return;
    const type = String(m.type || ''), tier = Number(m.tier) | 0; if (!E.GEMS[type] || tier < 1 || tier >= 3) return;
    const k = E.gemKey(type, tier), cost = 100 * tier;
    if ((p.eqx.gems[k] | 0) < 3) return sys(p, 'Cần 3 ' + E.gemName(k) + ' để ghép.');
    if (p.data.gold < cost) return sys(p, 'Cần ' + cost + ' vàng để ghép ngọc.');
    p.data.gold -= cost; p.eqx.gems[k] -= 3; giveGems(p, [E.gemKey(type, tier + 1)]); mark(p); C.pushMe(p); info(p);
  },
  esocket(p, m) {
    if (!API.thr(p, 'esock', 250)) return;
    const f = findAny(p, m.id); if (!f) return;
    const idx = Number(m.idx) | 0, g = String(m.gem || '');
    if (!E.parseGem(g) || idx < 0 || idx >= f.it.sock.length) return;
    if (f.it.sock[idx]) return sys(p, 'Ô này đã có ngọc, hãy tháo trước.');
    if ((p.eqx.gems[g] | 0) < 1) return sys(p, 'Bạn không có ngọc này.');
    p.eqx.gems[g]--; f.it.sock[idx] = g; mark(p); if (f.where === 'eq') apply(p); info(p);
  },
  eunsocket(p, m) {
    if (!API.thr(p, 'eunsock', 250)) return;
    const f = findAny(p, m.id); if (!f) return;
    const idx = Number(m.idx) | 0; if (idx < 0 || idx >= f.it.sock.length || !f.it.sock[idx]) return;
    const g = E.parseGem(f.it.sock[idx]), gold = 50 * g.tier, need = { core: 1 };
    if (p.data.gold < gold) return sys(p, 'Cần ' + gold + ' vàng để tháo ngọc.');
    const err = matsError(p, need); if (err) return sys(p, 'Tháo ngọc tốn 1 Lõi tro. ' + err);
    p.data.gold -= gold; takeMats(p, need); giveGems(p, [f.it.sock[idx]]); f.it.sock[idx] = null;
    mark(p); if (f.where === 'eq') apply(p); C.pushMe(p); API.info(p); info(p);
  },
  /* enhancement of extra pieces (+1..+15). Failure from +5 loses a level; from +7 a protection charm is used automatically if you own one. */
  eenh(p, m) {
    if (!API.thr(p, 'eenh', 300)) return;
    const f = findAny(p, m.id); if (!f) return;
    const it = f.it, enh = it.enh | 0;
    if (enh >= E.MAX_ENH) return sys(p, 'Món này đã đạt cấp cường hóa tối đa (+' + E.MAX_ENH + ').');
    const cost = E.enhCost(it);
    if (p.data.gold < cost) return sys(p, 'Cần ' + cost + ' vàng để cường hóa.');
    p.data.gold -= cost;
    const ok = Math.random() < E.enhChance(enh); let warded = false, lost = false;
    if (ok) it.enh = enh + 1;
    else if (enh >= 5) {
      if (enh >= 7 && p.zn && (p.zn.mats.ward | 0) > 0) { p.zn.mats.ward--; p.zn.dirty = true; warded = true; }
      else { it.enh = enh - 1; lost = true; }
    }
    mark(p); if (f.where === 'eq') apply(p);
    C.pushMe(p); API.info(p); info(p);
    C.send(p, { t: 'eenh', ok, id: it.id, enh: it.enh, name: E.nameOf(it), cost, warded, lost });
  },
  erefo(p, m) {
    if (!API.thr(p, 'erefo', 300)) return;
    const f = findAny(p, m.id); if (!f) return;
    const it = f.it, idx = Number(m.idx) | 0; if (idx < 0 || idx >= it.aff.length) return;
    const gold = 120 + it.ilvl * 25, need = { core: 1 };
    if (p.data.gold < gold) return sys(p, 'Cần ' + gold + ' vàng để tẩy luyện.');
    const err = matsError(p, need); if (err) return sys(p, 'Tẩy luyện tốn 1 Lõi tro. ' + err);
    p.data.gold -= gold; takeMats(p, need);
    const others = it.aff.filter((a, i) => i !== idx).map((a) => a.k);
    it.aff[idx] = E.rollAff(it.ilvl, it.rarity, others);
    mark(p); if (f.where === 'eq') apply(p); C.pushMe(p); API.info(p); info(p);
  },
  /* repair: every worn piece, at the blacksmith (anywhere inside the village) */
  erepair(p) {
    if (!API.thr(p, 'erepair', 500)) return;
    if (!inVillage(p)) return sys(p, 'Hãy về làng để sửa đồ (thợ rèn Bram).');
    const cost = repairTotal(p); if (!cost) return sys(p, 'Trang bị của bạn còn nguyên.');
    if (p.data.gold < cost) return sys(p, 'Cần ' + cost + ' vàng để sửa toàn bộ.');
    p.data.gold -= cost;
    E.MAIN.forEach((sl) => { const it = mainItem(p, sl); if (it) p.eqx.mdur[it.id] = E.MAX_DUR; });
    E.SLOTS.forEach((sl) => { const it = p.eqx.eq[sl]; if (it) it.cur = E.MAX_DUR; });
    mark(p); apply(p); info(p); sys(p, 'Đã sửa toàn bộ trang bị (' + cost + ' vàng).');
  },
  /* appearance */
  ecos(p, m) {
    const sl = String(m.slot || ''); if (!E.ALL.includes(sl)) return;
    const look = m.look ? String(m.look) : '';
    if (!look) delete p.eqx.cos[sl];
    else { if (!E.RAR.includes(look) || !p.eqx.unlocked[sl + '_' + look]) return sys(p, 'Bạn chưa mở khóa kiểu này (cần từng sở hữu một món ' + (E.RNAME[look] || '?') + ' ở ô này).'); p.eqx.cos[sl] = look; }
    mark(p); pushLook(p); info(p);
  },
  ehide(p, m) { const w = String(m.what || ''); if (w !== 'helmet' && w !== 'cape') return; p.eqx.hide[w] = !p.eqx.hide[w]; mark(p); pushLook(p); info(p); },
  /* personal storage (original-style items from the main bag) */
  stput(p, m) {
    if (!API.thr(p, 'stput', 150)) return;
    const d = p.data, i = d.inv.findIndex((x) => x.id === String(m.id || '')); if (i < 0) return;
    if (p.eqx.store.length >= E.STORE) return sys(p, 'Kho cá nhân đã đầy (' + E.STORE + ').');
    const it = d.inv.splice(i, 1)[0]; p.eqx.store.push(it); mark(p); save(p);
    C.pushMe(p); if (C.saveNow) C.saveNow(p); info(p);
  },
  stget(p, m) {
    if (!API.thr(p, 'stget', 150)) return;
    const d = p.data, i = p.eqx.store.findIndex((x) => x.id === String(m.id || '')); if (i < 0) return;
    if (d.inv.length >= API.rules.INV_SIZE) return sys(p, 'Túi đồ đã đầy.');
    const it = p.eqx.store.splice(i, 1)[0]; d.inv.push(it); mark(p); save(p);
    C.pushMe(p); if (C.saveNow) C.saveNow(p); info(p);
  }
};

/* drops: normal monsters 2%, elite 30%, boss 100% (a piece of a random extra slot); gems from elites and bosses */
function onKill(p, e) {
  const s = p.eqx; if (!s) return;
  const d = e.d || {}, chance = d.boss ? 1 : d.elite ? 0.3 : 0.02;
  if (Math.random() < chance && s.bag.length < E.BAG) {
    const r = Math.random();
    const rarity = d.boss ? (r < 0.1 ? 'legend' : r < 0.55 ? 'epic' : 'rare') : d.elite ? (r < 0.04 ? 'legend' : r < 0.35 ? 'epic' : 'rare') : (r < 0.02 ? 'epic' : r < 0.3 ? 'rare' : 'common');
    const lvl = Math.max(1, Math.min(p.data.level || 1, ((d.lv && d.lv[1]) || 1) + 2));
    const it = E.roll(E.SLOTS[Math.floor(Math.random() * 3)], rarity, lvl);
    s.bag.push(it); mark(p); scanUnlock(p); C.send(p, { t: 'edrop', item: it, from: 'drop' }); info(p);
  }
  const gc = d.boss ? 0.8 : d.elite ? 0.25 : 0.01;
  if (Math.random() < gc) {
    const types = Object.keys(E.GEMS), tier = d.boss && Math.random() < 0.35 ? 2 : 1, k = E.gemKey(types[Math.floor(Math.random() * types.length)], tier);
    giveGems(p, [k]); mark(p); C.send(p, { t: 'edrop', gem: k, from: 'drop' }); info(p);
  }
}

function init(ctx, api) {
  C = ctx; API = api;
  API.db.exec('CREATE TABLE IF NOT EXISTS equip_player (user_id INTEGER PRIMARY KEY, data TEXT NOT NULL)');
}
function onConnect(p) {
  load(p); scanUnlock(p); apply(p); info(p);
  C.online.forEach((o) => { if (o !== p && o.eqx) C.send(p, { t: 'elook', id: o.id, v: visOf(o) }); });
  p.eqxLook = ''; pushLook(p);
}
function onLeave(p) { try { save(p); } catch (err) { console.error('equip save', err.message); } }
let tickN = 0;
function tick() {
  tickN++;
  C.online.forEach((p) => {
    const s = p.eqx; if (!s) return;
    const dead = !!p.dead || p.hp <= 0;
    if (dead && !p.eqxDead) { p.eqxDead = true; try { loseDur(p, 8); } catch (err) { console.error('equip dur', err.message); } } else if (!dead) p.eqxDead = false;
    if (p.data.xgear2 == null) apply(p); // another module rebuilt p.data: put the bonuses back
    if (tickN % 2 === 0) pushLook(p);
    if (tickN % 10 === 0) scanUnlock(p);
    if (s.dirty && now() - s.saved > 15000) { try { save(p); } catch (err) { /* retry */ } }
  });
}

module.exports = { info, init, onConnect, onLeave, onKill, tick, ops, refresh: (p) => { if (p.eqx) apply(p); else C.pushMe(p); },
  /* used by other plugins (raid, battleground, siege): give a random extra piece of this rarity; returns the item, or null when the extra bag is full */
  grantPiece(p, rarity) {
    const s = p.eqx; if (!s || s.bag.length >= E.BAG) return null;
    const it = E.roll(E.SLOTS[Math.floor(Math.random() * 3)], rarity, Math.max(1, Math.min(60, p.data.level || 1)));
    s.bag.push(it); mark(p); scanUnlock(p); C.send(p, { t: 'edrop', item: it, from: 'drop' }); info(p); return it;
  },
  grantGem(p, tier) {
    const s = p.eqx; if (!s) return null;
    const types = Object.keys(E.GEMS), k = E.gemKey(types[Math.floor(Math.random() * types.length)], Math.max(1, Math.min(3, tier | 0)));
    giveGems(p, [k]); mark(p); C.send(p, { t: 'edrop', gem: k, from: 'drop' }); info(p); return k;
  } };
