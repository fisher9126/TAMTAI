/* Aetherfall accessories data + item generator (shared: browser reads names/labels, server rolls items). Pure functions, no state.
   Slots: ring (2 equipped), neck (1), charm (1). Stats are flat except crit and spd (percent points). */
(function (root) {
  'use strict';
  const KINDS = { ring: 'Nhẫn', neck: 'Dây chuyền', charm: 'Bùa hộ mệnh' };
  const EQ = { ring1: 'Nhẫn 1', ring2: 'Nhẫn 2', neck: 'Dây chuyền', charm: 'Bùa hộ mệnh' };
  const STAT = { atk: 'Sức đánh', def: 'Giáp', hp: 'Máu', mp: 'Mana', crit: 'Chí mạng', spd: 'Tốc độ' };
  const PCT = { crit: 1, spd: 1 };
  const RAR = ['common', 'rare', 'epic', 'legend'];
  const RNAME = { common: 'Thường', rare: 'Hiếm', epic: 'Sử thi', legend: 'Huyền thoại' };
  const RCOL = { common: '#c8c8d0', rare: '#6fb4ff', epic: '#c58cff', legend: '#ffa94a' };
  const RMUL = { common: 1, rare: 1.3, epic: 1.7, legend: 2.3 };
  const NAMES = {
    ring: ['Nhẫn Tro', 'Nhẫn Tàn Lửa', 'Nhẫn Vết Sao', 'Nhẫn Bạc Gỉ', 'Nhẫn Lõi Sáng'],
    neck: ['Dây Hạt Tro', 'Dây Chuyền Sương', 'Dây Mảnh Sao', 'Dây Đồng Cũ', 'Dây Lông Cú'],
    charm: ['Bùa Ốc Sên', 'Bùa Bóng Đèn', 'Bùa Mảnh Sao', 'Bùa Nấm Phát Sáng', 'Bùa Hoa Băng']
  };
  const BASE = { ring: 'atk', neck: 'hp', charm: 'def' };
  const SETS = {
    ash: { name: 'Bộ Tro Tàn', b2: { atk: 15 }, b3: { atk: 25, crit: 4 } },
    star: { name: 'Bộ Sao Rơi', b2: { hp: 120 }, b3: { hp: 200, def: 8 } },
    frost: { name: 'Bộ Băng Vĩnh Cửu', b2: { mp: 60 }, b3: { mp: 100, spd: 4 } }
  };
  const BAG = 30, MAX_AFF = 4;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const baseVal = (key, il, rm) => ({ atk: (2 + il * 1.4) * rm, hp: (14 + il * 9) * rm, def: (1.5 + il * 0.8) * rm }[key]);
  const affVal = (k, il) => ({
    atk: (1 + il * 0.7) * rnd(0.6, 1.2), def: (0.8 + il * 0.4) * rnd(0.6, 1.2), hp: (8 + il * 4.5) * rnd(0.6, 1.2),
    mp: (5 + il * 2.5) * rnd(0.6, 1.2), crit: (0.6 + il * 0.05) * rnd(0.8, 1.6), spd: (0.5 + il * 0.03) * rnd(0.8, 1.6)
  }[k]);
  const round = (k, v) => (PCT[k] ? Math.round(v * 10) / 10 : Math.max(1, Math.round(v)));
  let seq = 0;
  /* roll one accessory. Epic and legendary pieces may belong to a set; the first affix of a legendary piece is the "special trait" (x1.6). */
  function roll(kind, rarity, ilvl) {
    const il = Math.max(1, Math.min(60, ilvl | 0)), rm = RMUL[rarity], nA = { common: 0, rare: 1 + (Math.random() < 0.5 ? 1 : 0), epic: 3, legend: 4 }[rarity];
    const baseKey = BASE[kind], keys = Object.keys(STAT).filter((k) => k !== baseKey), aff = [];
    for (let i = 0; i < nA && keys.length; i++) {
      const k = keys.splice(Math.floor(Math.random() * keys.length), 1)[0], big = rarity === 'legend' && i === 0;
      aff.push({ k, v: round(k, affVal(k, il) * (big ? 1.6 : 1)), big });
    }
    const set = (rarity === 'epic' || rarity === 'legend') && Math.random() < 0.5 ? Object.keys(SETS)[Math.floor(Math.random() * 3)] : null;
    const pool = NAMES[kind];
    return { id: Date.now().toString(36) + (seq++).toString(36), kind, rarity, ilvl: il, name: pool[Math.floor(Math.random() * pool.length)], base: { k: baseKey, v: round(baseKey, baseVal(baseKey, il, rm)) }, aff, set, lock: false };
  }
  function stats(it) { const o = {}; if (!it) return o; o[it.base.k] = it.base.v; it.aff.forEach((a) => { o[a.k] = (o[a.k] || 0) + a.v; }); return o; }
  const worth = (it) => Math.round({ common: 5, rare: 25, epic: 90, legend: 320 }[it.rarity] * (1 + it.ilvl * 0.25));
  /* validate an item loaded from storage: rebuilds only allowed fields and clamps numbers */
  function clean(o) {
    if (!o || !KINDS[o.kind] || !RAR.includes(o.rarity) || !o.base || !STAT[o.base.k]) return null;
    const aff = (Array.isArray(o.aff) ? o.aff : []).slice(0, MAX_AFF).filter((a) => a && STAT[a.k]).map((a) => ({ k: a.k, v: Math.max(0, Math.min(5000, Number(a.v) || 0)), big: !!a.big }));
    return { id: String(o.id || '').slice(0, 24), kind: o.kind, rarity: o.rarity, ilvl: Math.max(1, Math.min(60, o.ilvl | 0)), name: String(o.name || KINDS[o.kind]).slice(0, 40), base: { k: BASE[o.kind], v: Math.max(0, Math.min(5000, Number(o.base.v) || 0)) }, aff, set: SETS[o.set] ? o.set : null, lock: !!o.lock };
  }
  const api = { KINDS, EQ, STAT, PCT, RAR, RNAME, RCOL, SETS, BAG, MAX_AFF, roll, stats, worth, clean };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AF_GEARDATA = api;
})(typeof window !== 'undefined' ? window : globalThis);
