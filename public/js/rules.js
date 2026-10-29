/* Shared game rules: used by the browser (window.AF_RULES) and the server (require).
   The server is the authority for everything here; the browser uses it only to display.
   Upgrade: races, classes, skills, appearance options, stat points and advanced classes. */
(function (root) {
  'use strict';
  const items = (typeof module !== 'undefined' && module.exports) ? require('./items.js') : root.AF_ITEMS;

  function expNeed(l) { return Math.round(40 * Math.pow(l, 1.6)); }

  /* ---------- character creation options ---------- */
  const APPEARANCE = {
    SKINS: [0xf2c9a0, 0xe6b48a, 0xc98f62, 0x9a6a44, 0x7fae5a, 0xa9b9e0],
    HAIRS: [0x5a3a22, 0x1f1a17, 0xc9a24a, 0x8a3a22, 0xdadada, 0x3f6fb5, 0xb5403f, 0x6a4fa0],
    SHIRTS: [0x3f5a8c, 0x9a4a3c, 0x3f8c5a, 0x7a4a9c, 0xa0773c, 0x3c7a9a, 0x9c3f72, 0x4a8a8a],
    STYLES: ['Ngắn', 'Dài', 'Nhọn', 'Trọc']
  };
  /* mul: multiplies hp/atk/def/mp; add: adds to crit/spd */
  const RACES = {
    human: { name: 'Con người', desc: 'Cân bằng. Nhận thêm 5% EXP.', mul: {}, exp: 1.05, scale: 1 },
    elf: { name: 'Elf', desc: '+15% mana, hồi mana nhanh hơn 50%.', mul: { mp: 1.15 }, mpRegen: 1.5, scale: 1.04 },
    dwarf: { name: 'Người lùn', desc: '+10% máu, +10% giáp, chịu độc giảm 50%.', mul: { hp: 1.1, def: 1.1 }, poisonRes: 0.5, scale: 0.88 },
    orc: { name: 'Orc', desc: '+8% sức đánh. Cuồng nộ khi máu dưới 30%: thêm 25% sức đánh.', mul: { atk: 1.08 }, rage: true, scale: 1.08 }
  };
  const STATS = {
    str: { name: 'Sức mạnh', desc: '+2 sức đánh' },
    agi: { name: 'Nhanh nhẹn', desc: '+0.4% chí mạng, +0.25% tốc độ chạy' },
    int: { name: 'Trí tuệ', desc: '+5 mana tối đa' },
    vit: { name: 'Thể lực', desc: '+12 máu tối đa, +0.5 giáp' },
    spi: { name: 'Tinh thần', desc: '+4 mana tối đa, +0.3 giáp' }
  };
  const POINTS_PER_LEVEL = 3, ADV_LEVEL = 30;
  /* mana regeneration per second (slower than before so skills cannot be spammed): 1 + 0.5% of max mana */
  const mpRegenPerSec = (maxMp) => 1 + (maxMp || 0) * 0.005;

  /* ---------- skills ---------- */
  /* Damage skills have an entry of the same id in ATTACKS (reach, multiplier, cooldown, mana, cone). Support skills carry their own numbers. */
  const SKILLS = {
    atk: { name: 'Chém' }, stab: { name: 'Đâm nhanh' }, bolt: { name: 'Phép bắn' }, arrow: { name: 'Bắn cung' }, smite: { name: 'Thánh kích' },
    spin: { name: 'Chém xoáy', desc: 'Quét quanh người' },
    dash: { name: 'Lao tới', desc: 'Lao về trước chém mọi thứ trên đường' },
    quake: { name: 'Chấn động', desc: 'Dậm đất, làm choáng quái xung quanh 1.5 giây' },
    bulwark: { name: 'Giáp sắt', desc: 'Giảm 40% sát thương nhận trong 8 giây', support: { mp: 30, cd: 25 } },
    fireball: { name: 'Cầu lửa', desc: 'Một quả cầu lửa sát thương lớn' },
    frost: { name: 'Băng giá', desc: 'Làm quái phía trước chậm 50% trong 4 giây' },
    thunder: { name: 'Sấm sét', desc: 'Sét đánh xung quanh, làm choáng ngắn' },
    meteor: { name: 'Thiên thạch', desc: 'Mưa thiên thạch xung quanh, sát thương rất lớn' },
    pierce: { name: 'Tên xuyên', desc: 'Mũi tên dài xuyên qua nhiều quái' },
    volley: { name: 'Mưa tên', desc: 'Bắn tên khắp xung quanh' },
    stunshot: { name: 'Tên choáng', desc: 'Làm choáng mục tiêu 1.5 giây' },
    barrage: { name: 'Loạt tên', desc: 'Xả loạt tên cực mạnh về phía trước' },
    backstab: { name: 'Đâm lén', desc: 'Một nhát đâm sát thương cao' },
    vanish: { name: 'Ẩn thân', desc: 'Quái mất dấu bạn trong 5 giây; đánh sẽ lộ diện', support: { mp: 26, cd: 20 } },
    flurry: { name: 'Loạt dao', desc: 'Phi dao quanh người' },
    execute: { name: 'Hạ sát', desc: 'Nhát chém kết liễu sát thương cực lớn' },
    heal: { name: 'Chữa lành', desc: 'Hồi 30% máu cho bạn và đồng đội trong 14m', support: { mp: 28, cd: 6 } },
    holy: { name: 'Thánh quang', desc: 'Chùm sáng thánh sát thương lớn' },
    bless: { name: 'Ban phước', desc: 'Bạn và đồng đội trong 14m tăng 15% sức đánh trong 12 giây', support: { mp: 35, cd: 30 } },
    revive: { name: 'Hồi sinh', desc: 'Hồi sinh một đồng đội đã ngã trong 12m với 40% máu', support: { mp: 55, cd: 40 } }
  };
  /* balance pass (armory update): melee basics hit harder than ranged ones (ranged trade damage for safety), area and ultimate skills
     were raised so they are worth their mana, backstab was lowered a little. */
  /* reach beyond the monster radius, damage multiplier per combo step, cooldown (s), mana, cone (cos; -2 = all around), optional enemy stun/slow (ms) */
  const ATTACKS = {
    atk: { reach: 2.9, mult: [1.1, 1.2, 1.8], cd: 0.3, cos: 0.35 },
    stab: { reach: 2.4, mult: [1.0, 1.1, 1.7], cd: 0.3, cos: 0.3 },
    bolt: { reach: 14, mult: [0.9, 1.0, 1.35], cd: 0.35, cos: 0.92 },
    arrow: { reach: 16, mult: [0.9, 1.0, 1.35], cd: 0.35, cos: 0.94 },
    smite: { reach: 10, mult: [0.95, 1.05, 1.4], cd: 0.35, cos: 0.9 },
    spin: { reach: 3.4, mult: [1.9], cd: 4.6, mp: 18 },
    dash: { reach: 7.5, mult: [1.7], cd: 3.6, mp: 14 },
    quake: { reach: 4.5, mult: [1.8], cd: 9, mp: 28, cos: -2, stun: 1500 },
    fireball: { reach: 15, mult: [2.2], cd: 3, mp: 20, cos: 0.93 },
    frost: { reach: 10, mult: [1.6], cd: 7, mp: 26, cos: 0.5, slow: 4000 },
    thunder: { reach: 8, mult: [1.9], cd: 10, mp: 34, cos: -2, stun: 800 },
    meteor: { reach: 12, mult: [4.2], cd: 25, mp: 65, cos: -2 },
    pierce: { reach: 18, mult: [2.2], cd: 4, mp: 18, cos: 0.97 },
    volley: { reach: 8, mult: [1.8], cd: 8, mp: 28, cos: -2 },
    stunshot: { reach: 14, mult: [1.4], cd: 10, mp: 22, cos: 0.9, stun: 1500 },
    barrage: { reach: 16, mult: [3.8], cd: 22, mp: 55, cos: 0.6 },
    backstab: { reach: 2.8, mult: [2.6], cd: 6, mp: 20, cos: 0.3 },
    flurry: { reach: 3.2, mult: [2.0], cd: 8, mp: 26, cos: -2 },
    execute: { reach: 3.0, mult: [4.5], cd: 20, mp: 45, cos: 0.3 },
    holy: { reach: 12, mult: [2.2], cd: 5, mp: 20, cos: 0.9 }
  };

  /* ---------- classes (key 1-4 use the skills in order; each unlocks at its level) ---------- */
  const CLASSES = {
    warrior: { name: 'Chiến binh', role: 'Đỡ đòn, cận chiến', desc: 'Nhiều máu và giáp. Kiếm, xoáy, lao tới, dậm đất làm choáng.', mul: { hp: 1.25, def: 1.2, mp: 0.8 }, add: {},
      basic: 'atk', autoRange: 4.5, color: '#e0733f', skills: [{ id: 'spin', lv: 1 }, { id: 'dash', lv: 3 }, { id: 'quake', lv: 10 }, { id: 'bulwark', lv: 20 }] },
    mage: { name: 'Pháp sư', role: 'Sát thương phép tầm xa', desc: 'Nhiều mana, sát thương lớn nhưng mỏng máu. Đánh từ xa.', mul: { hp: 0.85, atk: 1.25, def: 0.9, mp: 1.6 }, add: {},
      basic: 'bolt', autoRange: 14, color: '#6fa8ff', skills: [{ id: 'fireball', lv: 1 }, { id: 'frost', lv: 5 }, { id: 'thunder', lv: 12 }, { id: 'meteor', lv: 20 }] },
    archer: { name: 'Cung thủ', role: 'Sát thương vật lý tầm xa', desc: 'Nhanh, chí mạng cao, bắn rất xa.', mul: { hp: 0.95, atk: 1.15, def: 0.95 }, add: { crit: 3, spd: 4 },
      basic: 'arrow', autoRange: 16, color: '#79d08a', skills: [{ id: 'pierce', lv: 1 }, { id: 'volley', lv: 5 }, { id: 'stunshot', lv: 12 }, { id: 'barrage', lv: 20 }] },
    assassin: { name: 'Sát thủ', role: 'Sát thương đơn mục tiêu, ẩn thân', desc: 'Rất nhanh, chí mạng cao, sát thương bùng nổ gần.', mul: { hp: 0.9, atk: 1.2, def: 0.9 }, add: { crit: 10, spd: 8 },
      basic: 'stab', autoRange: 4.5, color: '#b48cff', skills: [{ id: 'backstab', lv: 1 }, { id: 'vanish', lv: 5 }, { id: 'flurry', lv: 12 }, { id: 'execute', lv: 20 }] },
    healer: { name: 'Hồi máu', role: 'Hỗ trợ, hồi phục', desc: 'Chữa lành, ban phước, hồi sinh đồng đội. Tấn công yếu.', mul: { atk: 0.85, mp: 1.5 }, add: {},
      basic: 'smite', autoRange: 10, color: '#ffe27a', skills: [{ id: 'heal', lv: 1 }, { id: 'holy', lv: 5 }, { id: 'bless', lv: 12 }, { id: 'revive', lv: 20 }] }
  };
  /* advanced classes: unlock at ADV_LEVEL, pick one branch; stat bonuses only (no new skills yet) */
  const ADV = {
    paladin: { cls: 'warrior', name: 'Hiệp sĩ thánh', desc: '+15% máu, +15% giáp', mul: { hp: 1.15, def: 1.15 }, add: {} },
    berserker: { cls: 'warrior', name: 'Kẻ hủy diệt', desc: '+20% sức đánh, +5% chí mạng', mul: { atk: 1.2 }, add: { crit: 5 } },
    pyro: { cls: 'mage', name: 'Pháp sư lửa', desc: '+20% sức đánh', mul: { atk: 1.2 }, add: {} },
    sage: { cls: 'mage', name: 'Hiền giả', desc: '+30% mana, +10% máu', mul: { mp: 1.3, hp: 1.1 }, add: {} },
    ranger: { cls: 'archer', name: 'Xạ thủ', desc: '+15% sức đánh, +6% chí mạng', mul: { atk: 1.15 }, add: { crit: 6 } },
    hunter: { cls: 'archer', name: 'Thợ săn', desc: '+15% máu, +6% tốc độ chạy', mul: { hp: 1.15 }, add: { spd: 6 } },
    shadow: { cls: 'assassin', name: 'Bóng đêm', desc: '+12% chí mạng', mul: {}, add: { crit: 12 } },
    blade: { cls: 'assassin', name: 'Kiếm khách', desc: '+20% sức đánh', mul: { atk: 1.2 }, add: {} },
    priest: { cls: 'healer', name: 'Linh mục', desc: '+30% mana, +10% máu', mul: { mp: 1.3, hp: 1.1 }, add: {} },
    cleric: { cls: 'healer', name: 'Giáo sĩ', desc: '+20% giáp, +15% máu', mul: { def: 1.2, hp: 1.15 }, add: {} }
  };

  /* d.prof (set by the server after character creation): { race, gender, cls, adv, app, alloc, rageOn, blessUntil } */
  function playerStats(d) {
    const lv = d.level || 1;
    const s = { maxHp: 120 + (lv - 1) * 26, atk: 10 + (lv - 1) * 3, def: 2 + (lv - 1), crit: 5, spd: 0, maxMp: 60 + (lv - 1) * 6, maxSt: 100 };
    items.SLOTS.forEach((k) => {
      const it = d.eq && d.eq[k]; if (!it) return;
      if (d.prof && d.prof.cls && items.canUse && !items.canUse(it, d.prof.cls)) return; /* another class's piece gives nothing */
      const t = items.statsFor(it.slot, it.rarity, it.ilvl, it.enh || 0, it.type, it.v);
      s.maxHp += t.hp || 0; s.atk += t.atk || 0; s.def += t.def || 0; s.crit += t.crit || 0; s.spd += t.spd || 0; s.maxMp += t.mp || 0;
    });
    const pr = d.prof;
    if (pr) {
      const a = pr.alloc || {};
      s.atk += 2 * (a.str | 0); s.crit += 0.4 * (a.agi | 0); s.spd += 0.25 * (a.agi | 0);
      s.maxMp += 5 * (a.int | 0) + 4 * (a.spi | 0); s.maxHp += 12 * (a.vit | 0); s.def += 0.5 * (a.vit | 0) + 0.3 * (a.spi | 0);
      [RACES[pr.race] && RACES[pr.race].mul, CLASSES[pr.cls] && CLASSES[pr.cls].mul, ADV[pr.adv] && ADV[pr.adv].mul].forEach((m) => {
        if (!m) return; if (m.hp) s.maxHp *= m.hp; if (m.atk) s.atk *= m.atk; if (m.def) s.def *= m.def; if (m.mp) s.maxMp *= m.mp;
      });
      [CLASSES[pr.cls] && CLASSES[pr.cls].add, ADV[pr.adv] && ADV[pr.adv].add].forEach((m) => { if (!m) return; s.crit += m.crit || 0; s.spd += m.spd || 0; });
      if (pr.rageOn) s.atk *= 1.25;
      if (pr.blessUntil && pr.blessUntil > Date.now()) s.atk *= 1.15;
    }
    /* step 5+: accessories (d.xgear, flat numbers) and skill-tree passives (d.tree, fractions) are attached at run time by server/gear.js and
       server/skilltree.js; they are never saved inside the player's save, so sanitizeSave cannot lose or forge them */
    const xg = d.xgear, tr = d.tree;
    if (xg) { s.atk += xg.atk || 0; s.def += xg.def || 0; s.maxHp += xg.hp || 0; s.maxMp += xg.mp || 0; s.crit += xg.crit || 0; s.spd += xg.spd || 0; }
    /* step 11+: gloves / pants / off-hand (server/equip.js -> d.xgear2, flat), faction bonus (d.xfac, flat), mount and swimming speed */
    const x2 = d.xgear2;
    if (x2) { s.atk += x2.atk || 0; s.def += x2.def || 0; s.maxHp += x2.hp || 0; s.maxMp += x2.mp || 0; s.crit += x2.crit || 0; s.spd += x2.spd || 0; }
    if (d.mountSpd) s.spd += d.mountSpd;
    if (d.swim) s.spd -= 35;
    if (tr) { s.atk *= 1 + (tr.atk || 0); s.def *= 1 + (tr.def || 0); s.maxHp *= 1 + (tr.hp || 0); s.maxMp *= 1 + (tr.mp || 0); s.crit += (tr.crit || 0) * 100; s.spd += (tr.spd || 0) * 100; }
    const bf = d.buffs, tNow = Date.now(); /* temporary buffs from potions and food (step 3); never saved, see server/zones.js */
    if (bf) {
      const on = (k) => (bf[k] && bf[k].until > tNow ? bf[k].v : 0);
      s.atk *= 1 + on('atk'); s.def *= 1 + on('def'); s.maxHp *= 1 + on('hp'); s.spd += on('spd');
    }
    if (d.wear) { s.atk *= 1 - d.wear; s.def *= 1 - d.wear; } /* broken equipment (durability 0) weakens attack and armour, see server/equip.js */
    s.maxHp = Math.round(s.maxHp); s.atk = Math.round(s.atk); s.def = Math.round(s.def * 10) / 10; s.maxMp = Math.round(s.maxMp);
    s.crit = Math.round(s.crit * 10) / 10; s.spd = Math.round(s.spd * 10) / 10;
    return s;
  }
  const pointsTotal = (level) => POINTS_PER_LEVEL * Math.max(0, (level | 0) - 1);

  /* World layout (same numbers on both sides) */
  const WORLD = { VILLAGE: { x: 0, z: 0 }, FOREST: { x: 55, z: 50 }, ARENA: { x: 62, z: -58 }, POND: { x: -34, z: 26 }, R: 108, SPAWN: { x: 1, z: 9 },
    SWAMP: { x: -62, z: -30 }, MINE: { x: -20, z: -72 }, FROST: { x: -55, z: 62 }, DUNGEON: { x: 6, z: 76 }, PORTAL: { x: -6, z: -24 }, WBOSS: { x: 78, z: 2 },
    /* step 11+: two more regions (the document has 6), the free-PvP ring inside the desert, and the siege fortress */
    DESERT: { x: 22, z: -84 }, ABYSS: { x: 80, z: -34 }, PVPZ: { x: 22, z: -84, r: 12 }, FORT: { x: 36, z: -26, r: 12 }, POND_R: 9 };
  /* Zones added in step 3. `col` tints the ground, `lv` is only shown to the player. */
  const ZONES = [
    { id: 'swamp', name: 'Đầm Lầy Nấm Độc', lv: '7-12', x: WORLD.SWAMP.x, z: WORLD.SWAMP.z, r: 20, col: '#4f7a3a' },
    { id: 'mine', name: 'Mỏ Quặng Gỉ Sét', lv: '10-15', x: WORLD.MINE.x, z: WORLD.MINE.z, r: 19, col: '#7a6a58' },
    { id: 'frost', name: 'Cánh Đồng Tủ Lạnh', lv: '13-19', x: WORLD.FROST.x, z: WORLD.FROST.z, r: 17, col: '#bfe3ff' },
    { id: 'dungeon', name: 'Hầm Ngục Tro Đen', lv: '12+', x: WORLD.DUNGEON.x, z: WORLD.DUNGEON.z, r: 17, col: '#3a2f4a' },
    { id: 'wboss', name: 'Bãi Tế Thần', lv: '20+', x: WORLD.WBOSS.x, z: WORLD.WBOSS.z, r: 19, col: '#8a3a3a' },
    { id: 'desert', name: 'Sa Mạc Huyết Thạch', lv: '20-27', x: WORLD.DESERT.x, z: WORLD.DESERT.z, r: 21, col: '#c9894a' },
    { id: 'abyss', name: 'Vực Thẳm Hư Không', lv: '28-35', x: WORLD.ABYSS.x, z: WORLD.ABYSS.z, r: 18, col: '#4b2478' },
    { id: 'fort', name: 'Pháo Đài Valdren', lv: '30+', x: WORLD.FORT.x, z: WORLD.FORT.z, r: 14, col: '#80808f' }
  ];
  const DUNGEON = { name: 'Hầm Ngục Tro Đen', minLv: 12, dailyMax: 4, minutes: 15, waves: 3, roomR: 15, diffs: ['Thường', 'Khó', 'Ác mộng', 'Địa ngục'],
    diffMinLv: [12, 20, 30, 40], diffHp: [1, 1.8, 3.2, 5.5], diffAtk: [1, 1.3, 1.7, 2.2], diffRew: [1, 1.8, 3, 5] };

  /* Monsters. Numbers only; the browser adds models. */
  const ENEMIES = {
    teieretta: { name: 'Teieretta Lumacona', lv: [1, 3], hp: 42, atk: 7, spd: 1.6, range: 1.6, aggro: 7, exp: 14, radius: 0.8, drop: 0.3, gold: [2, 6], respawn: 16, leash: 26 },
    gufo: { name: 'Gufo Lampadino', lv: [4, 6], hp: 95, atk: 13, spd: 2.8, range: 1.8, aggro: 10, exp: 34, radius: 0.8, drop: 0.45, gold: [6, 14], respawn: 20, bonus: 6, leash: 26 },
    boss: { name: 'Lavatricio Torone', lv: [10, 10], hp: 1150, atk: 26, spd: 2.5, range: 3.6, aggro: 16, exp: 420, radius: 2.5, drop: 1, gold: [120, 180], respawn: 70, bonus: 30, leash: 22, boss: true },
    /* Step 3. look = which existing model to reuse, tint/scale recolor and resize it in the browser. elite = bigger monster, always drops. */
    fungo: { name: 'Funghino Tossico', look: 'teieretta', tint: 0x9be15d, scale: 1.05, lv: [7, 9], hp: 190, atk: 20, spd: 1.9, range: 1.7, aggro: 8, exp: 75, radius: 0.9, drop: 0.35, gold: [10, 20], respawn: 18, leash: 26, bonus: 3 },
    ragno: { name: 'Ragno Pentola', look: 'gufo', tint: 0x8a5fd0, scale: 0.95, lv: [9, 11], hp: 270, atk: 28, spd: 3.0, range: 1.8, aggro: 10, exp: 115, radius: 0.85, drop: 0.4, gold: [14, 26], respawn: 20, leash: 26, bonus: 5 },
    sporo: { name: 'Re Nấm Bùn', look: 'teieretta', tint: 0xd95a5a, scale: 2.3, lv: [12, 12], hp: 1500, atk: 40, spd: 2.1, range: 2.6, aggro: 12, exp: 700, radius: 1.9, drop: 1, gold: [80, 140], respawn: 120, leash: 24, bonus: 22, elite: true },
    talpa: { name: 'Chuột Chũi Búa', look: 'teieretta', tint: 0xb08a5a, scale: 1.2, lv: [10, 12], hp: 340, atk: 32, spd: 2.3, range: 1.8, aggro: 9, exp: 150, radius: 1.0, drop: 0.4, gold: [16, 30], respawn: 20, leash: 26, bonus: 6 },
    golem: { name: 'Golem Nồi Cơm', look: 'gufo', tint: 0x9a9aa8, scale: 1.5, lv: [12, 14], hp: 560, atk: 42, spd: 2.0, range: 2.4, aggro: 9, exp: 200, radius: 1.3, drop: 0.45, gold: [20, 38], respawn: 24, leash: 26, bonus: 8 },
    reQuang: { name: 'Vua Quặng Gỉ', look: 'gufo', tint: 0xd08a3c, scale: 2.6, lv: [15, 15], hp: 2900, atk: 50, spd: 2.2, range: 3.0, aggro: 12, exp: 1100, radius: 2.1, drop: 1, gold: [120, 200], respawn: 150, leash: 24, bonus: 26, elite: true },
    pinguino: { name: 'Pinguino Tủ Lạnh', look: 'teieretta', tint: 0xcfe6ff, scale: 1.1, lv: [13, 15], hp: 440, atk: 36, spd: 2.2, range: 1.8, aggro: 9, exp: 190, radius: 0.95, drop: 0.4, gold: [24, 42], respawn: 22, leash: 26, bonus: 8 },
    orso: { name: 'Orso Ghiacciolo', look: 'gufo', tint: 0xe8f4ff, scale: 1.35, lv: [15, 17], hp: 650, atk: 47, spd: 2.6, range: 2.2, aggro: 10, exp: 260, radius: 1.2, drop: 0.45, gold: [30, 52], respawn: 26, leash: 26, bonus: 10 },
    regina: { name: 'Regina Gelata', look: 'gufo', tint: 0x7fc0ff, scale: 2.5, lv: [19, 19], hp: 3900, atk: 58, spd: 2.4, range: 3.0, aggro: 12, exp: 1600, radius: 2.0, drop: 1, gold: [160, 260], respawn: 180, leash: 24, bonus: 30, elite: true },
    /* dungeon only (spawned per run, never respawn) */
    cinder: { name: 'Cinderino', look: 'teieretta', tint: 0x3a3548, scale: 1.2, lv: [14, 14], hp: 480, atk: 36, spd: 2.4, range: 1.8, aggro: 12, exp: 120, radius: 1.0, drop: 0.2, gold: [20, 36], respawn: 9999, leash: 40, bonus: 6 },
    ombra: { name: 'Gufo Ombra', look: 'gufo', tint: 0x5a3f8a, scale: 1.25, lv: [15, 15], hp: 640, atk: 46, spd: 3.1, range: 2.0, aggro: 12, exp: 160, radius: 1.0, drop: 0.25, gold: [26, 44], respawn: 9999, leash: 40, bonus: 8 },
    dboss: { name: 'Re Tro Đen', look: 'boss', tint: 0x6a3a7a, scale: 1.1, lv: [18, 18], hp: 7000, atk: 54, spd: 2.6, range: 3.6, aggro: 24, exp: 1500, radius: 2.7, drop: 1, gold: [200, 300], respawn: 9999, leash: 40, bonus: 40, boss: true },
    /* world boss: spawned by server/events.js on a schedule or by an admin, never respawns by itself */
    wboss: { name: 'Gran Lavatrice Ardente', look: 'boss', tint: 0xff7a3a, scale: 1.7, lv: [25, 25], hp: 36000, atk: 70, spd: 2.8, range: 4.2, aggro: 30, exp: 6000, radius: 4.2, drop: 1, gold: [800, 1200], respawn: 99999, leash: 70, bonus: 50, boss: true },
    /* step 11+: desert and abyss (server/world2.js spawns them), then the raid boss (server/instances.js) */
    scorpio: { name: 'Scorpio Fornello', look: 'gufo', tint: 0xd9a441, scale: 1.25, lv: [20, 22], hp: 900, atk: 62, spd: 2.8, range: 2.0, aggro: 10, exp: 320, radius: 1.1, drop: 0.45, gold: [40, 70], respawn: 24, leash: 28, bonus: 12 },
    mummia: { name: 'Mummia Bendata', look: 'teieretta', tint: 0xd8cfae, scale: 1.55, lv: [23, 26], hp: 1350, atk: 78, spd: 2.2, range: 2.2, aggro: 10, exp: 460, radius: 1.2, drop: 0.5, gold: [55, 95], respawn: 26, leash: 28, bonus: 14 },
    sethra: { name: 'Sethra, Pharaon Cát', look: 'boss', tint: 0xe0b83a, scale: 1.5, lv: [28, 28], hp: 9500, atk: 98, spd: 2.6, range: 3.6, aggro: 14, exp: 3200, radius: 2.4, drop: 1, gold: [300, 480], respawn: 200, leash: 26, bonus: 40, elite: true },
    demone: { name: 'Demone Ombrato', look: 'gufo', tint: 0x4a2a6e, scale: 1.65, lv: [28, 31], hp: 1900, atk: 104, spd: 3.0, range: 2.2, aggro: 11, exp: 720, radius: 1.3, drop: 0.5, gold: [80, 130], respawn: 28, leash: 28, bonus: 18 },
    drago: { name: 'Draghetto Nero', look: 'boss', tint: 0x7a1f2a, scale: 0.95, lv: [31, 34], hp: 3100, atk: 128, spd: 2.8, range: 3.0, aggro: 12, exp: 1100, radius: 1.8, drop: 0.55, gold: [110, 180], respawn: 32, leash: 28, bonus: 24 },
    vuoto: { name: 'Il Vuoto Affamato', look: 'boss', tint: 0x2a1040, scale: 1.9, lv: [35, 35], hp: 18000, atk: 155, spd: 2.7, range: 4.0, aggro: 14, exp: 6500, radius: 3.2, drop: 1, gold: [600, 900], respawn: 240, leash: 28, bonus: 50, elite: true },
    morvain: { name: 'Morvain, Kẻ Nuốt Sao', look: 'boss', tint: 0x5a1a8a, scale: 2.4, lv: [40, 40], hp: 60000, atk: 170, spd: 2.6, range: 4.6, aggro: 40, exp: 20000, radius: 4.4, drop: 1, gold: [2000, 3000], respawn: 99999, leash: 60, bonus: 60, boss: true }
  };

  const QUESTS = [
    { title: 'Ốc sên pha trà', desc: 'Hạ những con Teieretta Lumacona đang phá ruộng quanh làng.', type: 'teieretta', need: 5, reward: { exp: 70, gold: 30, potions: 2 },
      talk: 'Chào Kẻ Không Tro! Bọn ốc sên đội ấm trà đang bò khắp ruộng quanh làng, phun trà nóng vào mặt dân làng. Hạ giúp ta 5 con Teieretta Lumacona nhé. Chúng chậm thôi, cứ chém là được.' },
    { title: 'Bóng đèn biết bay', desc: 'Vào Rừng Bóng Đèn ở phía Đông Bắc, hạ những con Gufo Lampadino.', type: 'gufo', need: 3, reward: { exp: 170, gold: 80, rarity: 'rare' },
      talk: 'Giỏi lắm! Giờ tới chuyện khác: trong khu rừng phía Đông Bắc có bọn cú mèo đầu bóng đèn. Chúng sáng rực cả đêm làm cả làng mất ngủ. Hạ 3 con Gufo Lampadino. Chúng nhanh hơn ốc sên nhiều, nhớ dùng Space để né.' },
    { title: 'Con bò máy giặt', desc: 'Cùng mọi người đánh bại boss Lavatricio Torone ở Đấu trường phía Đông Nam. Khi thấy vùng đỏ dưới đất, hãy né sang ngang.', type: 'boss', need: 1, reward: { exp: 450, gold: 300, rarity: 'epic' },
      talk: 'Ta nghe tiếng ầm ầm như máy giặt vắt đồ từ đấu trường phía Đông Nam. Đó là Lavatricio Torone, con bò tót bị tro biến thành máy giặt. Khi nó cúi đầu, một vùng đỏ hiện dưới đất: đó là đường húc. Né sang ngang ngay! Rủ thêm người chơi khác đi cùng sẽ dễ hơn nhiều.' },
    { title: 'Tự do khám phá', desc: 'Săn quái để tìm đồ Sử thi và Huyền thoại. Boss hồi sinh sau ít phút.', type: null, need: 0,
      talk: 'Ngươi đã cứu cả Thung lũng Bình Minh! Cứ tiếp tục săn quái cùng bạn bè, boss sẽ hồi sinh sau ít phút và rơi đồ Huyền thoại.' }
  ];

  /* ---------- Step 3: materials, professions, gathering nodes, recipes, consumables ---------- */
  const MATS = {
    herb: { name: 'Cỏ trà', c: '#7ddc8f' }, shell: { name: 'Vỏ ấm trà', c: '#d8c7a8' }, feather: { name: 'Lông bóng đèn', c: '#ffe27a' },
    shroom: { name: 'Nấm phát sáng', c: '#9be15d' }, venom: { name: 'Tuyến độc', c: '#b48cff' }, ore: { name: 'Quặng gỉ', c: '#c48a52' },
    coal: { name: 'Than đá', c: '#9a9aa8' }, frost: { name: 'Hoa băng', c: '#9fd3ff' }, pelt: { name: 'Da lông băng', c: '#dff0ff' },
    gear: { name: 'Bánh răng máy giặt', c: '#f4a64a' }, core: { name: 'Lõi tro', c: '#ff7a55' }, gem: { name: 'Đá quý', c: '#ff8de1' },
    sand: { name: 'Cát huyết thạch', c: '#e0a050' }, bone: { name: 'Xương cổ', c: '#e8e0c8' }, void: { name: 'Mảnh hư không', c: '#a070ff' }, ward: { name: 'Bùa bảo hộ', c: '#7dd8ff' }
  };
  const PROFS = {
    mining: { name: 'Khai khoáng', kind: 'gather', desc: 'Đào quặng, than và đá quý ở các mỏ.' },
    herbal: { name: 'Hái thuốc', kind: 'gather', desc: 'Hái cỏ, nấm và hoa ngoài đồng.' },
    smith: { name: 'Rèn', kind: 'craft', desc: 'Rèn trang bị Hiếm, Sử thi và Huyền thoại.' },
    alchemy: { name: 'Giả kim', kind: 'craft', desc: 'Pha bình máu và thuốc tăng sức tạm thời.' },
    cooking: { name: 'Nấu ăn', kind: 'craft', desc: 'Nấu món ăn tăng chỉ số tạm thời.' }
  };
  const PROF_MAX = 15;
  const profNeed = (lv) => 30 + lv * 30; // xp to go from lv to lv+1
  const NODES = {
    herb: { name: 'Bụi cỏ trà', prof: 'herbal', lv: 1, yield: [{ m: 'herb', a: 1, b: 3 }], extra: [{ m: 'shell', p: 0.1, n: 1 }], respawn: 40, xp: 6 },
    shroom: { name: 'Cụm nấm phát sáng', prof: 'herbal', lv: 3, yield: [{ m: 'shroom', a: 1, b: 2 }], extra: [{ m: 'venom', p: 0.15, n: 1 }], respawn: 50, xp: 9 },
    frost: { name: 'Bông hoa băng', prof: 'herbal', lv: 6, yield: [{ m: 'frost', a: 1, b: 2 }], extra: [{ m: 'pelt', p: 0.1, n: 1 }], respawn: 55, xp: 12 },
    ore: { name: 'Mạch quặng gỉ', prof: 'mining', lv: 1, yield: [{ m: 'ore', a: 1, b: 3 }], extra: [{ m: 'gem', p: 0.04, n: 1 }], respawn: 50, xp: 7 },
    coal: { name: 'Vỉa than đá', prof: 'mining', lv: 4, yield: [{ m: 'coal', a: 1, b: 2 }], extra: [{ m: 'gem', p: 0.06, n: 1 }], respawn: 55, xp: 10 }
  };
  /* [material, chance, min, max] per monster type */
  const MAT_DROPS = {
    teieretta: [['shell', 0.35, 1, 2], ['herb', 0.2, 1, 2]], gufo: [['feather', 0.4, 1, 2]], boss: [['gear', 1, 2, 4], ['core', 0.5, 1, 1]],
    fungo: [['shroom', 0.45, 1, 2]], ragno: [['venom', 0.35, 1, 2], ['shroom', 0.15, 1, 1]], sporo: [['venom', 1, 2, 3], ['gem', 0.6, 1, 1], ['gear', 0.6, 1, 2]],
    talpa: [['ore', 0.5, 1, 2], ['coal', 0.2, 1, 1]], golem: [['coal', 0.45, 1, 2], ['ore', 0.3, 1, 2], ['gear', 0.15, 1, 1]],
    reQuang: [['ore', 1, 4, 6], ['coal', 1, 2, 4], ['gem', 0.8, 1, 2], ['gear', 1, 1, 2]],
    pinguino: [['pelt', 0.4, 1, 2], ['frost', 0.25, 1, 1]], orso: [['pelt', 0.5, 1, 2], ['frost', 0.35, 1, 2]],
    regina: [['pelt', 1, 3, 4], ['frost', 1, 2, 3], ['gem', 0.8, 1, 2], ['gear', 1, 1, 2]],
    cinder: [['coal', 0.4, 1, 2], ['core', 0.12, 1, 1]], ombra: [['venom', 0.3, 1, 2], ['core', 0.18, 1, 1]], dboss: [['core', 1, 3, 4], ['gem', 1, 1, 2], ['gear', 1, 2, 3]],
    wboss: [['core', 1, 3, 5], ['gem', 1, 2, 3], ['gear', 1, 3, 5]],
    scorpio: [['sand', 0.45, 1, 2], ['venom', 0.2, 1, 1]], mummia: [['bone', 0.45, 1, 2], ['sand', 0.2, 1, 1]],
    sethra: [['sand', 1, 3, 5], ['bone', 1, 2, 4], ['gem', 1, 1, 2], ['core', 0.8, 1, 2], ['gear', 1, 2, 3]],
    demone: [['void', 0.4, 1, 2], ['bone', 0.2, 1, 1]], drago: [['void', 0.5, 1, 2], ['core', 0.3, 1, 1], ['gem', 0.2, 1, 1]],
    vuoto: [['void', 1, 3, 5], ['gem', 1, 2, 3], ['core', 1, 2, 3], ['gear', 1, 3, 4]],
    morvain: [['void', 1, 8, 12], ['gem', 1, 4, 6], ['core', 1, 5, 8], ['gear', 1, 5, 8]]
  };
  /* consumables: one buff slot per kind (exp, atk, def, hp, spd); a new one replaces the old one */
  const CONS = {
    el_exp: { name: 'Tinh chất Tăng EXP', buff: 'exp', v: 0.2, secs: 1200, desc: '+20% EXP trong 20 phút' },
    el_def: { name: 'Thuốc Da Đá', buff: 'def', v: 0.25, secs: 600, desc: '+25% giáp trong 10 phút' },
    el_atk: { name: 'Thuốc Cuồng Lực', buff: 'atk', v: 0.15, secs: 600, desc: '+15% sức đánh trong 10 phút' },
    fd_hp: { name: 'Bánh Ấm Trà', buff: 'hp', v: 0.15, secs: 900, desc: '+15% máu tối đa trong 15 phút' },
    fd_hp2: { name: 'Lẩu Quặng Hầm', buff: 'hp', v: 0.3, secs: 1200, desc: '+30% máu tối đa trong 20 phút' },
    fd_spd: { name: 'Súp Lông Cú', buff: 'spd', v: 8, secs: 900, desc: '+8% tốc độ chạy trong 15 phút' },
    fd_atk: { name: 'Thịt Nướng Băng', buff: 'atk', v: 0.1, secs: 900, desc: '+10% sức đánh trong 15 phút' }
  };
  const BUFF_NAME = { exp: 'EXP', atk: 'Sức đánh', def: 'Giáp', hp: 'Máu', spd: 'Tốc độ' };
  const RECIPES = [];
  items.SLOTS.forEach((slot) => {
    const w = slot === 'weapon' || slot === 'armor' ? 1.3 : 1, sn = items.SLOTNAME[slot];
    RECIPES.push({ id: 'sm_' + slot + '_rare', prof: 'smith', lv: 1, name: sn + ' Hiếm', gold: 40, mats: { ore: Math.round(6 * w), coal: 2 }, out: { kind: 'gear', slot, rarity: 'rare' }, xp: 14 });
    RECIPES.push({ id: 'sm_' + slot + '_epic', prof: 'smith', lv: 6, name: sn + ' Sử thi', gold: 220, mats: { ore: Math.round(12 * w), coal: 6, gear: 2 }, out: { kind: 'gear', slot, rarity: 'epic' }, xp: 30 });
    RECIPES.push({ id: 'sm_' + slot + '_legend', prof: 'smith', lv: 12, name: sn + ' Huyền thoại', gold: 900, mats: { ore: Math.round(20 * w), coal: 12, core: 4, gem: 2 }, out: { kind: 'gear', slot, rarity: 'legend' }, xp: 60 });
  });
  RECIPES.push(
    { id: 'al_pot3', prof: 'alchemy', lv: 1, name: 'Bình máu x3', gold: 10, mats: { herb: 3, shell: 1 }, out: { kind: 'potion', n: 3 }, xp: 8 },
    { id: 'al_pot10', prof: 'alchemy', lv: 4, name: 'Bình máu x10', gold: 35, mats: { herb: 8, shroom: 2 }, out: { kind: 'potion', n: 10 }, xp: 20 },
    { id: 'al_exp', prof: 'alchemy', lv: 5, name: CONS.el_exp.name, gold: 90, mats: { shroom: 3, feather: 2, venom: 1 }, out: { kind: 'cons', id: 'el_exp' }, xp: 26 },
    { id: 'al_def', prof: 'alchemy', lv: 7, name: CONS.el_def.name, gold: 120, mats: { pelt: 2, frost: 2, coal: 2 }, out: { kind: 'cons', id: 'el_def' }, xp: 34 },
    { id: 'al_atk', prof: 'alchemy', lv: 9, name: CONS.el_atk.name, gold: 160, mats: { venom: 3, shroom: 3, gear: 1 }, out: { kind: 'cons', id: 'el_atk' }, xp: 42 },
    { id: 'ck_hp', prof: 'cooking', lv: 1, name: CONS.fd_hp.name, gold: 15, mats: { shell: 3, herb: 2 }, out: { kind: 'cons', id: 'fd_hp' }, xp: 8 },
    { id: 'ck_spd', prof: 'cooking', lv: 3, name: CONS.fd_spd.name, gold: 30, mats: { feather: 3, herb: 2 }, out: { kind: 'cons', id: 'fd_spd' }, xp: 14 },
    { id: 'ck_atk', prof: 'cooking', lv: 6, name: CONS.fd_atk.name, gold: 60, mats: { pelt: 2, frost: 1, coal: 1 }, out: { kind: 'cons', id: 'fd_atk' }, xp: 28 },
    { id: 'ck_hp2', prof: 'cooking', lv: 10, name: CONS.fd_hp2.name, gold: 120, mats: { ore: 4, shroom: 3, pelt: 3 }, out: { kind: 'cons', id: 'fd_hp2' }, xp: 40 },
    /* step 11+: protection charm (used automatically when an enhancement from +7 fails) */
    { id: 'sm_ward', prof: 'smith', lv: 3, name: 'Bùa bảo hộ', gold: 120, mats: { core: 2, gem: 1 }, out: { kind: 'mat', id: 'ward', n: 1 }, xp: 20 },
    { id: 'sm_ward2', prof: 'smith', lv: 8, name: 'Bùa bảo hộ x2', gold: 200, mats: { sand: 6, bone: 3 }, out: { kind: 'mat', id: 'ward', n: 2 }, xp: 36 }
  );
  /* item level of forged gear: limited by the forger's skill as well as by the character level */
  const forgeIlvl = (charLv, profLv) => Math.max(1, Math.min(charLv | 0, 4 + (profLv | 0) * 4));

  /* ---------- Step 11: mounts and factions ---------- */
  /* spd = speed bonus in the same units as boots (percent points), added only while mounted. rep = [faction, tier] needed to buy. */
  const MOUNTS = {
    horse: { name: 'Ngựa Ấm Trà', lv: 15, price: 800, spd: 28, col: 0x8a5a32, desc: 'Ngựa thồ hiền lành, chạy nhanh hơn 28%.' },
    lizard: { name: 'Thằn Lằn Sa Mạc', lv: 20, price: 2500, spd: 36, col: 0x6fa84a, desc: 'Quen cát nóng, nhanh hơn 36%.' },
    wolf: { name: 'Sói Tro Đen', lv: 30, price: 6000, spd: 44, col: 0x44444f, desc: 'Sói bị tro nhuộm đen, nhanh hơn 44%.' },
    warhorse: { name: 'Chiến Mã Hiệp Sĩ', lv: 25, price: 9000, spd: 48, col: 0xe8e8f0, rep: ['knight', 4], desc: 'Chỉ bán cho người Tôn kính của Hội Hiệp Sĩ, nhanh hơn 48%.' },
    ashbeast: { name: 'Ác Thú Tro Tàn', lv: 25, price: 9000, spd: 48, col: 0x2a1a3a, rep: ['cult', 4], desc: 'Chỉ bán cho người Tôn kính của Giáo phái Tro Tàn, nhanh hơn 48%.' }
  };
  /* four factions: reputation tiers by points; the rival loses a share of what the other gains (see server/faction.js) */
  const FACTIONS = {
    knight: { name: 'Hội Hiệp Sĩ', col: '#7fb2ff', rival: 'cult', desc: 'Giữ trật tự, săn quái ở vùng ngoài thành.' },
    mage: { name: 'Hội Pháp Sư', col: '#c58cff', rival: 'cult', desc: 'Thanh tẩy tro, cần nguyên liệu ma thuật.' },
    trader: { name: 'Liên minh Thương nhân', col: '#ffd95a', rival: null, desc: 'Kiếm lời từ hỗn loạn, thích vàng và nguyên liệu.' },
    cult: { name: 'Giáo phái Tro Tàn', col: '#ff7a55', rival: 'knight', desc: 'Thu gom mảnh sao, đối địch Hội Hiệp Sĩ.' }
  };
  const REP_TIERS = [{ id: 'hostile', name: 'Thù địch', min: -99999 }, { id: 'neutral', name: 'Trung lập', min: 0 }, { id: 'friendly', name: 'Thân thiện', min: 500 }, { id: 'honored', name: 'Kính trọng', min: 2000 }, { id: 'exalted', name: 'Tôn kính', min: 6000 }];

  const api = { expNeed, playerStats, pointsTotal, mpRegenPerSec, APPEARANCE, RACES, STATS, SKILLS, CLASSES, ADV, POINTS_PER_LEVEL, ADV_LEVEL,
    WORLD, ZONES, DUNGEON, ENEMIES, ATTACKS, QUESTS, MAX_LEVEL: 60, INV_SIZE: 42, POTION_CD: 8,
    MATS, PROFS, PROF_MAX, profNeed, NODES, MAT_DROPS, CONS, BUFF_NAME, RECIPES, forgeIlvl, MOUNTS, FACTIONS, REP_TIERS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AF_RULES = api;
})(typeof window !== 'undefined' ? window : globalThis);
