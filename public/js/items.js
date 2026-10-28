/* Shared item rules: loaded by the browser (window.AF_ITEMS) and by the server (require).
   The server recomputes stats from these formulas, so a client cannot forge item stats.
   Upgrade: items now carry an enhancement level `enh` (0..MAX_ENH) that scales their stats.
   Armory update: every new piece has a `type` (weapon kind or armour style, each owned by one class) and a variant `v` (0..3)
   picked from its rarity tier. Type and variant shape the stats; pieces made before this update (no type) keep the old formula
   and can be worn by every class. */
(function (root) {
  'use strict';
  const RAR = ['common', 'rare', 'epic', 'legend'];
  const SLOTS = ['weapon', 'helmet', 'armor', 'boots', 'cape'];
  const RMULT = { common: 1, rare: 1.6, epic: 2.4, legend: 3.5 };
  const RNAME = { common: 'Thường', rare: 'Hiếm', epic: 'Sử thi', legend: 'Huyền thoại' };
  const SLOTNAME = { weapon: 'Vũ khí', helmet: 'Mũ', armor: 'Giáp', boots: 'Giày', cape: 'Áo choàng' };
  const BASE = { weapon: 'Kiếm', helmet: 'Mũ', armor: 'Giáp', boots: 'Giày', cape: 'Áo choàng' };
  const SUF = {
    common: ['Sắt', 'Gỗ Sồi', 'Da Thô', 'Nông Dân'],
    rare: ['Thợ Săn', 'Gió Lốc', 'Hiệp Sĩ', 'Ốc Sên Bạc'],
    epic: ['Tro Tàn', 'Bóng Đèn Thần', 'Máy Giặt Cuồng Nộ', 'Ấm Trà Sôi'],
    legend: ['Sao Rơi', 'Bò Tót Bất Diệt', 'Vắt Ly Tâm', 'Ánh Sao Vĩnh Cửu']
  };
  const STATNAME = { atk: 'Sức đánh', def: 'Giáp', hp: 'Máu', mp: 'Mana', crit: 'Chí mạng', spd: 'Tốc độ' };
  const PCT = { crit: 1, spd: 1 };

  /* ---------- classes ---------- */
  const CLS = ['warrior', 'mage', 'archer', 'assassin', 'healer'];
  const CLSNAME = { warrior: 'Chiến binh', mage: 'Pháp sư', archer: 'Cung thủ', assassin: 'Sát thủ', healer: 'Hồi máu' };

  /* ---------- weapon kinds: atk = damage multiplier, add = extra stat points (see points()), grip decides the model and animation ---------- */
  const WTYPES = {
    sword: { cls: 'warrior', name: 'Kiếm', atk: 1.0, add: { def: 1.5, crit: 1 }, grip: '1h', perk: 'Cân bằng công và thủ, đi kèm khiên.' },
    greatsword: { cls: 'warrior', name: 'Đại kiếm', atk: 1.35, add: { spd: -3 }, grip: '2h', perk: 'Sát thương mỗi nhát lớn nhất của Chiến binh, nhưng nặng nên chạy chậm hơn.' },
    axe: { cls: 'warrior', name: 'Rìu chiến', atk: 1.1, add: { crit: 5 }, grip: '1h', perk: 'Lưỡi rìu bổ chí mạng thường xuyên, đi kèm khiên tròn.' },
    greataxe: { cls: 'warrior', name: 'Rìu lớn', atk: 1.25, add: { hp: 2, crit: 2 }, grip: '2h', perk: 'Vừa mạnh vừa thêm máu, hợp người đứng mũi chịu sào.' },
    staff: { cls: 'mage', name: 'Trượng', atk: 1.15, add: { mp: 2.5 }, grip: 'cast', perk: 'Sát thương phép ổn định, thêm mana.' },
    wand: { cls: 'mage', name: 'Đũa phép', atk: 0.95, add: { crit: 3, spd: 3 }, grip: 'cast', perk: 'Nhẹ tay: chạy nhanh hơn và dễ chí mạng.' },
    orb: { cls: 'mage', name: 'Quả cầu tinh tú', atk: 1.05, add: { mp: 4.5, crit: 1 }, grip: 'cast', perk: 'Kho mana khổng lồ để xả kỹ năng liên tục.' },
    runeblade: { cls: 'mage', name: 'Kiếm phù văn', atk: 1.05, add: { def: 1.5, hp: 1.5 }, grip: 'cast', perk: 'Pháp sư cận chiến: thêm giáp và máu.' },
    bow: { cls: 'archer', name: 'Cung ngắn', atk: 0.95, add: { spd: 5, crit: 2 }, grip: 'bow', perk: 'Cơ động nhất: chạy nhanh, thả diều quái dễ.' },
    longbow: { cls: 'archer', name: 'Trường cung', atk: 1.25, add: { crit: 2 }, grip: 'bow', perk: 'Mũi tên nặng, sát thương cao.' },
    crossbow: { cls: 'archer', name: 'Nỏ tay', atk: 1.05, add: { crit: 5 }, grip: 'xbow', perk: 'Chính xác: tỉ lệ chí mạng cao.' },
    heavycrossbow: { cls: 'archer', name: 'Nỏ hạng nặng', atk: 1.35, add: { spd: -3, crit: 1 }, grip: 'xbow', perk: 'Phát bắn mạnh nhất của Cung thủ, nhưng nặng.' },
    daggers: { cls: 'assassin', name: 'Song dao', atk: 0.9, add: { crit: 6, spd: 4 }, grip: 'dual', perk: 'Hai dao nhanh: chí mạng và tốc độ rất cao.' },
    shortsword: { cls: 'assassin', name: 'Đoản kiếm', atk: 1.15, add: { crit: 3 }, grip: 'dual', perk: 'Đoản kiếm và dao găm: sát thương đều tay.' },
    throwing: { cls: 'assassin', name: 'Dao phi', atk: 1.0, add: { spd: 6, crit: 2 }, grip: 'dual', perk: 'Lướt nhanh nhất, hợp lối đánh vào rồi rút.' },
    twinaxe: { cls: 'assassin', name: 'Song rìu', atk: 1.25, add: { hp: 1.5 }, grip: 'dual', perk: 'Hai rìu nhỏ: sát thương lớn, thêm máu.' },
    scepter: { cls: 'healer', name: 'Quyền trượng', atk: 0.95, add: { hp: 2, mp: 2 }, grip: 'cast', perk: 'Đi kèm sách thánh: thêm máu và mana.' },
    holystaff: { cls: 'healer', name: 'Gậy thánh', atk: 1.1, add: { mp: 3 }, grip: 'cast', perk: 'Gậy dài: đánh mạnh hơn, nhiều mana để hồi máu.' },
    mace: { cls: 'healer', name: 'Chùy thánh', atk: 1.2, add: { def: 1.5 }, grip: 'cast', perk: 'Giáo sĩ chiến đấu: sát thương cao, thêm giáp.' },
    lantern: { cls: 'healer', name: 'Đèn thánh', atk: 0.85, add: { hp: 3, def: 1, mp: 1 }, grip: 'cast', perk: 'Rất bền bỉ: nhiều máu, giáp và mana.' }
  };
  /* ---------- armour styles (helmet, armour, boots, cape): def/hp multiply the slot base, add = extra stat points ---------- */
  const ATYPES = {
    plate: { cls: 'warrior', name: 'Thép tấm', def: 1.4, hp: 1.1, add: { spd: -1 }, perk: 'Giáp dày nhất game, hơi nặng.' },
    mail: { cls: 'warrior', name: 'Lưới xích', def: 1.1, hp: 1.35, add: {}, perk: 'Nhiều máu nhất.' },
    arcane: { cls: 'mage', name: 'Vải phép', def: 0.7, hp: 0.85, add: { mp: 2.5, atk: 0.8 }, perk: 'Mỏng nhưng tăng mana và sức đánh phép.' },
    starweave: { cls: 'mage', name: 'Lụa sao', def: 0.8, hp: 0.9, add: { mp: 1.5, crit: 1.5 }, perk: 'Tăng mana và chí mạng.' },
    leather: { cls: 'archer', name: 'Da thuộc', def: 0.95, hp: 1.0, add: { spd: 2 }, perk: 'Nhẹ, thêm tốc độ chạy.' },
    hunter: { cls: 'archer', name: 'Da săn', def: 0.85, hp: 0.95, add: { crit: 1.5, atk: 0.6 }, perk: 'Thêm sức đánh và chí mạng.' },
    shadow: { cls: 'assassin', name: 'Vải bóng đêm', def: 0.8, hp: 0.9, add: { crit: 2.5 }, perk: 'Chí mạng cao.' },
    nightsilk: { cls: 'assassin', name: 'Lụa đêm', def: 0.85, hp: 0.9, add: { spd: 2.5, atk: 0.6 }, perk: 'Nhanh và mạnh hơn.' },
    holy: { cls: 'healer', name: 'Thánh y', def: 1.0, hp: 1.15, add: { mp: 1.5 }, perk: 'Thêm máu và mana.' },
    cleric: { cls: 'healer', name: 'Giáp giáo sĩ', def: 1.2, hp: 1.05, add: { mp: 1 }, perk: 'Giáp tốt nhất cho Hồi máu.' }
  };
  /* display name of an armour piece = slot word for that style */
  const ANAME = {
    helmet: { plate: 'Mũ trụ thép', mail: 'Mũ xích', arcane: 'Mũ phù thủy', starweave: 'Vòng trán sao', leather: 'Mũ da', hunter: 'Mũ thợ săn', shadow: 'Khăn trùm', nightsilk: 'Mặt nạ đêm', holy: 'Vương miện thánh', cleric: 'Mũ giáo sĩ' },
    armor: { plate: 'Giáp tấm', mail: 'Giáp xích', arcane: 'Áo choàng phép', starweave: 'Áo lụa sao', leather: 'Áo giáp da', hunter: 'Áo thợ săn', shadow: 'Áo bóng đêm', nightsilk: 'Áo lụa đêm', holy: 'Thánh y', cleric: 'Giáp giáo sĩ' },
    boots: { plate: 'Ủng thép', mail: 'Ủng xích', arcane: 'Giày phép', starweave: 'Hài sao', leather: 'Giày da', hunter: 'Ủng thợ săn', shadow: 'Giày lặng', nightsilk: 'Hài đêm', holy: 'Dép thánh', cleric: 'Ủng giáo sĩ' },
    cape: { plate: 'Áo choàng hiệp sĩ', mail: 'Khăn choàng xích', arcane: 'Áo choàng phù thủy', starweave: 'Áo choàng sao', leather: 'Áo choàng da', hunter: 'Áo choàng săn', shadow: 'Áo choàng bóng', nightsilk: 'Khăn lụa đêm', holy: 'Áo choàng thánh', cleric: 'Áo choàng giáo sĩ' }
  };
  /* ---------- variants: four per rarity tier, each leans to its own stats (points, see points()) ---------- */
  const VARIANTS = {
    common: [{ n: 'Sắt', b: { def: 1 } }, { n: 'Gỗ Sồi', b: { hp: 1 } }, { n: 'Da Thô', b: { spd: 1 } }, { n: 'Nông Dân', b: { atk: 1 } }],
    rare: [{ n: 'Thợ Săn', b: { crit: 1.5 } }, { n: 'Gió Lốc', b: { spd: 2 } }, { n: 'Hiệp Sĩ', b: { def: 1.5, hp: 1 } }, { n: 'Ốc Sên Bạc', b: { hp: 2 } }],
    epic: [{ n: 'Tro Tàn', b: { atk: 2 } }, { n: 'Bóng Đèn Thần', b: { mp: 3, crit: 1 } }, { n: 'Máy Giặt Cuồng Nộ', b: { atk: 1.5, crit: 1.5 } }, { n: 'Ấm Trà Sôi', b: { hp: 2.5, def: 1 } }],
    legend: [{ n: 'Sao Rơi', b: { atk: 3, crit: 2 } }, { n: 'Bò Tót Bất Diệt', b: { hp: 4, def: 2.5 } }, { n: 'Vắt Ly Tâm', b: { spd: 3, crit: 3 } }, { n: 'Ánh Sao Vĩnh Cửu', b: { mp: 4, atk: 2.5 } }]
  };
  const UNIT = { atk: 1, def: 1, hp: 5, mp: 5 };
  const PCTF = { common: 0.7, rare: 0.85, epic: 1, legend: 1.2 };

  const MAX_ENH = 15; // AF-EQUIP: was 10 (document: +1 to +15)
  /* chance to succeed when going from level i to i+1 */
  const ENH_CHANCE = [1, 0.95, 0.9, 0.8, 0.7, 0.55, 0.45, 0.35, 0.25, 0.15, 0.1, 0.07, 0.05, 0.03, 0.02];
  function enhChance(enh) { return ENH_CHANCE[Math.max(0, Math.min(MAX_ENH - 1, enh | 0))]; }
  function enhCost(it) { return Math.round((15 + it.ilvl * 6) * (1 + (it.enh || 0)) * Math.sqrt(RMULT[it.rarity])); }
  function withEnhName(name, enh) { const base = String(name || '').replace(/\s*\+\d+$/, ''); return enh > 0 ? base + ' +' + enh : base; }

  const typeOk = (slot, type) => !!type && (slot === 'weapon' ? !!WTYPES[type] : !!(ATYPES[type] && ANAME[slot]));
  function typeInfo(slot, type) { if (!typeOk(slot, type)) return null; return slot === 'weapon' ? WTYPES[type] : ATYPES[type]; }
  function typeName(slot, type) { if (!typeOk(slot, type)) return BASE[slot]; return slot === 'weapon' ? WTYPES[type].name : ANAME[slot][type]; }
  function typesFor(slot, cls) {
    const src = slot === 'weapon' ? WTYPES : ATYPES;
    return Object.keys(src).filter((k) => !cls || src[k].cls === cls);
  }

  /* adds stat points to s: flat stats grow with the item's power m, percent stats with rarity and item level */
  function points(s, add, m, pf) {
    for (const k in add) {
      const v = add[k]; if (!v) continue;
      if (PCT[k]) s[k] = (s[k] || 0) + v * pf;
      else s[k] = (s[k] || 0) + v * UNIT[k] * m * 0.35;
    }
  }
  function statsFor(slot, rarity, ilvl, enh, type, v) {
    enh = Math.max(0, Math.min(MAX_ENH, enh | 0));
    const m = RMULT[rarity] * (1 + (ilvl - 1) * 0.16) * (1 + enh * 0.12);
    const s = {};
    const t = typeInfo(slot, type);
    if (!t) {
      /* original formula (items without a type) */
      if (slot === 'weapon') { s.atk = Math.round(4 * m); if (rarity === 'epic') s.crit = 4; if (rarity === 'legend') s.crit = 8; }
      if (slot === 'helmet') { s.def = Math.round(2 * m); s.hp = Math.round(10 * m); }
      if (slot === 'armor') { s.def = Math.round(3 * m); s.hp = Math.round(26 * m); }
      if (slot === 'boots') { s.def = Math.round(1.2 * m); s.spd = { common: 0, rare: 5, epic: 8, legend: 12 }[rarity] || 0; }
      if (slot === 'cape') { s.hp = Math.round(15 * m); s.crit = { common: 0, rare: 2, epic: 3, legend: 5 }[rarity] || 0; }
      for (const k in s) if (!s[k]) delete s[k];
      return s;
    }
    const pf = PCTF[rarity] * (1 + Math.min(70, ilvl) * 0.012);
    if (slot === 'weapon') { s.atk = 4 * m * t.atk; s.crit = { common: 0, rare: 0, epic: 3, legend: 6 }[rarity] || 0; }
    if (slot === 'helmet') { s.def = 2 * m * t.def; s.hp = 10 * m * t.hp; }
    if (slot === 'armor') { s.def = 3 * m * t.def; s.hp = 26 * m * t.hp; }
    if (slot === 'boots') { s.def = 1.2 * m * t.def; s.spd = { common: 0, rare: 4, epic: 6, legend: 9 }[rarity] || 0; }
    if (slot === 'cape') { s.hp = 15 * m * t.hp; s.crit = { common: 0, rare: 1.5, epic: 2.5, legend: 4 }[rarity] || 0; }
    points(s, t.add, m, pf);
    const vr = VARIANTS[rarity] && VARIANTS[rarity][v | 0];
    if (vr) points(s, vr.b, m, pf);
    for (const k in s) { s[k] = PCT[k] ? Math.round(s[k] * 10) / 10 : Math.round(s[k]); if (!s[k]) delete s[k]; }
    return s;
  }
  const restat = (it) => statsFor(it.slot, it.rarity, it.ilvl, it.enh || 0, it.type, it.v);
  function nameFor(slot, rarity, type, v) {
    const vr = VARIANTS[rarity] && VARIANTS[rarity][v | 0];
    return typeName(slot, type) + ' ' + (vr ? vr.n : SUF[rarity][0]);
  }
  function newId() { return 'i' + Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36); }
  /* cls: the owner's class; 80% of pieces fit that class, the rest fit another class (for trading). No class: any class.
     A fixed `name` (starter weapon, gifts) makes an untyped piece that every class can wear. */
  function pickType(slot, cls) {
    let pool = CLS.indexOf(cls) >= 0 && Math.random() < 0.8 ? typesFor(slot, cls) : typesFor(slot);
    if (!pool.length) pool = typesFor(slot);
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function makeItem(slot, rarity, ilvl, name, cls, type) {
    if (name) {
      const suf = SUF[rarity];
      return { id: newId(), slot, rarity, ilvl, enh: 0, name: name || (BASE[slot] + ' ' + suf[Math.floor(Math.random() * suf.length)]), stats: statsFor(slot, rarity, ilvl, 0) };
    }
    const tp = typeOk(slot, type) ? type : pickType(slot, cls), v = Math.floor(Math.random() * 4);
    return { id: newId(), slot, rarity, ilvl, enh: 0, type: tp, v, name: nameFor(slot, rarity, tp, v), stats: statsFor(slot, rarity, ilvl, 0, tp, v) };
  }
  /* class that may wear a piece (null = everyone) */
  function itemClass(it) { const t = it && typeInfo(it.slot, it.type); return t ? t.cls : null; }
  function canUse(it, cls) { const c = itemClass(it); return !c || !cls || c === cls; }
  /* short text about what makes this piece special */
  function describe(it) {
    const t = it && typeInfo(it.slot, it.type); if (!t) return '';
    const vr = VARIANTS[it.rarity] && VARIANTS[it.rarity][it.v | 0];
    const lean = vr ? Object.keys(vr.b).map((k) => STATNAME[k]).join(' và ') : '';
    return t.perk + (lean ? ' Biến thể "' + vr.n + '" thiên về ' + lean.toLowerCase() + '.' : '');
  }
  function itemValue(it) { return Math.round({ common: 6, rare: 22, epic: 65, legend: 220 }[it.rarity] * (1 + it.ilvl * 0.2) * (1 + (it.enh || 0) * 0.3)); }
  function rollRarity(bonus) { const r = Math.random() * 100 - (bonus || 0); if (r < 2) return 'legend'; if (r < 12) return 'epic'; if (r < 40) return 'rare'; return 'common'; }
  /* Returns a clean copy of an item, or null if it is not a valid item. Stats always come from the formula. */
  function validItem(it) {
    if (!it || typeof it !== 'object') return null;
    if (SLOTS.indexOf(it.slot) < 0 || RAR.indexOf(it.rarity) < 0) return null;
    const ilvl = Math.round(Number(it.ilvl));
    if (!(ilvl >= 1 && ilvl <= 70)) return null;
    const enh = Math.max(0, Math.min(MAX_ENH, Math.round(Number(it.enh)) || 0));
    const id = typeof it.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(it.id) ? it.id : newId();
    let name = typeof it.name === 'string' ? it.name.replace(/[<>]/g, '').trim().slice(0, 40) : '';
    if (!name) name = BASE[it.slot];
    const out = { id, slot: it.slot, rarity: it.rarity, ilvl, enh, name };
    if (typeOk(it.slot, it.type)) { out.type = it.type; out.v = Math.max(0, Math.min(3, Math.round(Number(it.v)) || 0)); }
    out.stats = statsFor(it.slot, it.rarity, ilvl, enh, out.type, out.v);
    return out;
  }
  const api = { RAR, SLOTS, RNAME, SLOTNAME, BASE, SUF, MAX_ENH, STATNAME, PCT, CLS, CLSNAME, WTYPES, ATYPES, ANAME, VARIANTS,
    statsFor, restat, makeItem, itemValue, rollRarity, validItem, enhChance, enhCost, withEnhName,
    typeOk, typeInfo, typeName, typesFor, nameFor, itemClass, canUse, describe };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AF_ITEMS = api;
})(typeof window !== 'undefined' ? window : globalThis);
