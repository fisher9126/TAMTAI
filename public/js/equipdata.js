/* Aetherfall equipment extension (shared by the browser and server/equip.js): gloves, pants and off-hand (shield or spell book) pieces with
   random secondary lines, gem sockets, enhancement +1..+15 and durability. Pure functions and tables, no state. The five original slots
   (weapon, helmet, armor, boots, cape) stay in the player's save and keep their own rules in items.js. */
(function (root) {
  'use strict';
  const items = (typeof require === 'function' && typeof module !== 'undefined') ? require('./items.js') : root.AF_ITEMS;
  const SLOTS = ['gloves', 'pants', 'offhand'];
  const SLOTNAME = { gloves: 'Găng tay', pants: 'Quần', offhand: 'Vũ khí phụ' };
  const SUBNAME = { shield: 'Khiên', tome: 'Sách phép' };
  const BASENAME = { gloves: 'Găng', pants: 'Quần' };
  const MAIN = items.SLOTS;
  const ALL = MAIN.concat(SLOTS);
  const ALLNAME = Object.assign({}, items.SLOTNAME, SLOTNAME);
  const RAR = items.RAR, RNAME = items.RNAME;
  const RCOL = { common: '#c8c8d0', rare: '#6fb4ff', epic: '#c58cff', legend: '#ffa94a' };
  const RMULT = { common: 1, rare: 1.6, epic: 2.4, legend: 3.5 };
  const STAT = { atk: 'Sức đánh', def: 'Giáp', hp: 'Máu', mp: 'Mana', crit: 'Chí mạng', spd: 'Tốc độ' };
  const PCT = { crit: 1, spd: 1 };
  const MAX_ENH = items.MAX_ENH, MAX_DUR = 100, BAG = 40, STORE = 60;
  const GEMS = {
    ruby: { name: 'Hồng ngọc', stat: 'atk', v: [4, 9, 16], c: '#ff5a6a' },
    sapphire: { name: 'Lam ngọc', stat: 'mp', v: [20, 45, 80], c: '#5aa8ff' },
    topaz: { name: 'Hoàng ngọc', stat: 'crit', v: [1, 2, 3.5], c: '#ffd95a' },
    emerald: { name: 'Lục ngọc', stat: 'hp', v: [30, 70, 130], c: '#5ae08a' },
    onyx: { name: 'Hắc ngọc', stat: 'def', v: [3, 7, 12], c: '#b79ac8' },
    opal: { name: 'Bạch ngọc', stat: 'spd', v: [1, 2, 3], c: '#e8f0ff' }
  };
  const GEM_TIER = ['Thô', 'Tinh', 'Hoàn mỹ'];
  const gemKey = (type, tier) => type + tier;
  function parseGem(k) {
    const m = /^([a-z]+)([123])$/.exec(String(k || '')); if (!m || !GEMS[m[1]]) return null;
    return { type: m[1], tier: Number(m[2]) };
  }
  const gemName = (k) => { const g = parseGem(k); return g ? GEMS[g.type].name + ' ' + GEM_TIER[g.tier - 1].toLowerCase() : '?'; };
  const gemText = (k) => { const g = parseGem(k); if (!g) return ''; const d = GEMS[g.type], v = d.v[g.tier - 1]; return (PCT[d.stat] ? '+' + v + '%' : '+' + v) + ' ' + STAT[d.stat]; };

  const rnd = (a, b) => a + Math.random() * (b - a);
  const round = (k, v) => (PCT[k] ? Math.round(v * 10) / 10 : Math.max(1, Math.round(v)));
  let seq = 0;
  const newId = () => 'x' + Date.now().toString(36) + (seq++).toString(36) + Math.floor(Math.random() * 1e6).toString(36);

  /* main numbers of a piece; same growth curve as the original equipment (rarity x item level x enhancement) */
  function base(slot, sub, rarity, ilvl, enh) {
    enh = Math.max(0, Math.min(MAX_ENH, enh | 0));
    const m = RMULT[rarity] * (1 + (ilvl - 1) * 0.16) * (1 + enh * 0.12), s = {};
    if (slot === 'gloves') { s.atk = Math.round(2.2 * m); s.crit = { common: 0, rare: 1, epic: 2, legend: 3 }[rarity] || 0; }
    else if (slot === 'pants') { s.def = Math.round(2.4 * m); s.hp = Math.round(16 * m); }
    else if (slot === 'offhand') { if (sub === 'tome') { s.mp = Math.round(14 * m); s.atk = Math.round(1.8 * m); } else { s.def = Math.round(3 * m); s.hp = Math.round(12 * m); } }
    for (const k in s) if (!s[k]) delete s[k];
    return s;
  }
  const affVal = (k, il) => ({
    atk: (1 + il * 0.7) * rnd(0.6, 1.2), def: (0.8 + il * 0.4) * rnd(0.6, 1.2), hp: (8 + il * 4.5) * rnd(0.6, 1.2),
    mp: (5 + il * 2.5) * rnd(0.6, 1.2), crit: (0.6 + il * 0.05) * rnd(0.8, 1.6), spd: (0.5 + il * 0.03) * rnd(0.8, 1.6)
  }[k]);
  function rollAff(il, rarity, avoid) {
    const keys = Object.keys(STAT).filter((k) => !(avoid || []).includes(k));
    const k = keys[Math.floor(Math.random() * keys.length)];
    return { k, v: round(k, affVal(k, il) * (rarity === 'legend' ? 1.25 : 1)) };
  }
  function roll(slot, rarity, ilvl) {
    const il = Math.max(1, Math.min(60, ilvl | 0)), sub = slot === 'offhand' ? (Math.random() < 0.5 ? 'shield' : 'tome') : null;
    const nA = { common: 0, rare: 1 + (Math.random() < 0.5 ? 1 : 0), epic: 3, legend: 4 }[rarity], aff = [];
    for (let i = 0; i < nA; i++) aff.push(rollAff(il, rarity, aff.map((a) => a.k)));
    const ns = rarity === 'legend' ? 2 : rarity === 'epic' ? (Math.random() < 0.6 ? 1 : 0) : 0;
    const suf = items.SUF[rarity], nm = (slot === 'offhand' ? SUBNAME[sub] : BASENAME[slot]) + ' ' + suf[Math.floor(Math.random() * suf.length)];
    return { id: newId(), slot, sub, rarity, ilvl: il, name: nm, enh: 0, aff, sock: new Array(ns).fill(null), cur: MAX_DUR, lock: false };
  }
  function stats(it) {
    const o = {}; if (!it) return o;
    const b = base(it.slot, it.sub, it.rarity, it.ilvl, it.enh); for (const k in b) o[k] = (o[k] || 0) + b[k];
    (it.aff || []).forEach((a) => { o[a.k] = (o[a.k] || 0) + a.v; });
    (it.sock || []).forEach((g) => { const p = parseGem(g); if (p) { const d = GEMS[p.type]; o[d.stat] = (o[d.stat] || 0) + d.v[p.tier - 1]; } });
    for (const k in o) o[k] = Math.round(o[k] * 10) / 10;
    return o;
  }
  const worth = (it) => Math.round({ common: 6, rare: 22, epic: 65, legend: 220 }[it.rarity] * (1 + it.ilvl * 0.2) * (1 + (it.enh || 0) * 0.3));
  const enhCost = (it) => Math.round((15 + it.ilvl * 6) * (1 + (it.enh || 0)) * Math.sqrt(RMULT[it.rarity]));
  const repairCost = (value, missing) => Math.max(0, Math.ceil(value * 0.012 * Math.max(0, missing)));
  const nameOf = (it) => items.withEnhName(it.name, it.enh || 0);
  /* rebuild an item from storage using only allowed fields and clamped numbers */
  function clean(o) {
    if (!o || typeof o !== 'object' || !SLOTS.includes(o.slot) || !RAR.includes(o.rarity)) return null;
    const il = Math.round(Number(o.ilvl)); if (!(il >= 1 && il <= 70)) return null;
    const sub = o.slot === 'offhand' ? (o.sub === 'tome' ? 'tome' : 'shield') : null;
    const aff = (Array.isArray(o.aff) ? o.aff : []).slice(0, 4).filter((a) => a && STAT[a.k]).map((a) => ({ k: a.k, v: Math.max(0, Math.min(5000, Number(a.v) || 0)) }));
    const sock = (Array.isArray(o.sock) ? o.sock : []).slice(0, 2).map((g) => (parseGem(g) ? String(g) : null));
    return { id: typeof o.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(o.id) ? o.id : newId(), slot: o.slot, sub, rarity: o.rarity, ilvl: il,
      name: String(o.name || SLOTNAME[o.slot]).replace(/[<>]/g, '').replace(/\s*\+\d+$/, '').slice(0, 40), enh: Math.max(0, Math.min(MAX_ENH, Math.round(Number(o.enh)) || 0)),
      aff, sock, cur: Math.max(0, Math.min(MAX_DUR, Math.round(Number(o.cur == null ? MAX_DUR : o.cur)))), lock: !!o.lock };
  }
  const api = { SLOTS, SLOTNAME, SUBNAME, MAIN, ALL, ALLNAME, RAR, RNAME, RCOL, RMULT, STAT, PCT, MAX_ENH, MAX_DUR, BAG, STORE, GEMS, GEM_TIER,
    gemKey, parseGem, gemName, gemText, base, roll, rollAff, stats, worth, enhCost, repairCost, nameOf, clean, newId, enhChance: items.enhChance };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AF_EQUIPDATA = api;
})(typeof window !== 'undefined' ? window : globalThis);
