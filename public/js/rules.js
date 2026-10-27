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

  /* ---------- skills ---------- */
  /* Damage skills have an entry of the same id in ATTACKS (reach, multiplier, cooldown, mana, cone). Support skills carry their own numbers. */
  const SKILLS = {
    atk: { name: 'Chém' }, stab: { name: 'Đâm nhanh' }, bolt: { name: 'Phép bắn' }, arrow: { name: 'Bắn cung' }, smite: { name: 'Thánh kích' },
    spin: { name: 'Chém xoáy', desc: 'Quét quanh người' },
    dash: { name: 'Lao tới', desc: 'Lao về trước chém mọi thứ trên đường' },
    quake: { name: 'Chấn động', desc: 'Dậm đất, làm choáng quái xung quanh 1.5 giây' },
    bulwark: { name: 'Giáp sắt', desc: 'Giảm 40% sát thương nhận trong 8 giây', support: { mp: 25, cd: 25 } },
    fireball: { name: 'Cầu lửa', desc: 'Một quả cầu lửa sát thương lớn' },
    frost: { name: 'Băng giá', desc: 'Làm quái phía trước chậm 50% trong 4 giây' },
    thunder: { name: 'Sấm sét', desc: 'Sét đánh xung quanh, làm choáng ngắn' },
    meteor: { name: 'Thiên thạch', desc: 'Mưa thiên thạch xung quanh, sát thương rất lớn' },
    pierce: { name: 'Tên xuyên', desc: 'Mũi tên dài xuyên qua nhiều quái' },
    volley: { name: 'Mưa tên', desc: 'Bắn tên khắp xung quanh' },
    stunshot: { name: 'Tên choáng', desc: 'Làm choáng mục tiêu 1.5 giây' },
    barrage: { name: 'Loạt tên', desc: 'Xả loạt tên cực mạnh về phía trước' },
    backstab: { name: 'Đâm lén', desc: 'Một nhát đâm sát thương cao' },
    vanish: { name: 'Ẩn thân', desc: 'Quái mất dấu bạn trong 5 giây; đánh sẽ lộ diện', support: { mp: 20, cd: 20 } },
    flurry: { name: 'Loạt dao', desc: 'Phi dao quanh người' },
    execute: { name: 'Hạ sát', desc: 'Nhát chém kết liễu sát thương cực lớn' },
    heal: { name: 'Chữa lành', desc: 'Hồi 30% máu cho bạn và đồng đội trong 14m', support: { mp: 20, cd: 6 } },
    holy: { name: 'Thánh quang', desc: 'Chùm sáng thánh sát thương lớn' },
    bless: { name: 'Ban phước', desc: 'Bạn và đồng đội trong 14m tăng 15% sức đánh trong 12 giây', support: { mp: 25, cd: 30 } },
    revive: { name: 'Hồi sinh', desc: 'Hồi sinh một đồng đội đã ngã trong 12m với 40% máu', support: { mp: 40, cd: 40 } }
  };
  /* reach beyond the monster radius, damage multiplier per combo step, cooldown (s), mana, cone (cos; -2 = all around), optional enemy stun/slow (ms) */
  const ATTACKS = {
    atk: { reach: 2.9, mult: [1, 1.1, 1.6], cd: 0.3, cos: 0.35 },
    stab: { reach: 2.4, mult: [0.85, 0.95, 1.5], cd: 0.3, cos: 0.3 },
    bolt: { reach: 14, mult: [1, 1.1, 1.5], cd: 0.35, cos: 0.92 },
    arrow: { reach: 16, mult: [1, 1.05, 1.5], cd: 0.35, cos: 0.94 },
    smite: { reach: 10, mult: [0.8, 0.9, 1.2], cd: 0.35, cos: 0.9 },
    spin: { reach: 3.4, mult: [1.9], cd: 4.6, mp: 15 },
    dash: { reach: 7.5, mult: [1.5], cd: 3.6, mp: 10 },
    quake: { reach: 4.5, mult: [1.4], cd: 9, mp: 20, cos: -2, stun: 1500 },
    fireball: { reach: 15, mult: [2.2], cd: 3, mp: 12, cos: 0.93 },
    frost: { reach: 10, mult: [1.3], cd: 7, mp: 18, cos: 0.5, slow: 4000 },
    thunder: { reach: 8, mult: [1.5], cd: 10, mp: 24, cos: -2, stun: 800 },
    meteor: { reach: 12, mult: [3.2], cd: 25, mp: 45, cos: -2 },
    pierce: { reach: 18, mult: [2.4], cd: 4, mp: 12, cos: 0.97 },
    volley: { reach: 8, mult: [1.5], cd: 8, mp: 20, cos: -2 },
    stunshot: { reach: 14, mult: [1.2], cd: 10, mp: 15, cos: 0.9, stun: 1500 },
    barrage: { reach: 16, mult: [3.0], cd: 22, mp: 40, cos: 0.6 },
    backstab: { reach: 2.8, mult: [3.0], cd: 6, mp: 15, cos: 0.3 },
    flurry: { reach: 3.2, mult: [2.0], cd: 8, mp: 18, cos: -2 },
    execute: { reach: 3.0, mult: [4.5], cd: 20, mp: 35, cos: 0.3 },
    holy: { reach: 12, mult: [1.8], cd: 5, mp: 14, cos: 0.9 }
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
    healer: { name: 'Hồi máu', role: 'Hỗ trợ, hồi phục', desc: 'Chữa lành, ban phước, hồi sinh đồng đội. Tấn công yếu.', mul: { atk: 0.8, mp: 1.5 }, add: {},
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
      const t = items.statsFor(it.slot, it.rarity, it.ilvl, it.enh || 0);
      s.maxHp += t.hp || 0; s.atk += t.atk || 0; s.def += t.def || 0; s.crit += t.crit || 0; s.spd += t.spd || 0;
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
    s.maxHp = Math.round(s.maxHp); s.atk = Math.round(s.atk); s.def = Math.round(s.def * 10) / 10; s.maxMp = Math.round(s.maxMp);
    s.crit = Math.round(s.crit * 10) / 10; s.spd = Math.round(s.spd * 10) / 10;
    return s;
  }
  const pointsTotal = (level) => POINTS_PER_LEVEL * Math.max(0, (level | 0) - 1);

  /* World layout (same numbers on both sides) */
  const WORLD = { VILLAGE: { x: 0, z: 0 }, FOREST: { x: 55, z: 50 }, ARENA: { x: 62, z: -58 }, POND: { x: -34, z: 26 }, R: 108, SPAWN: { x: 1, z: 9 } };

  /* Monsters. Numbers only; the browser adds models. */
  const ENEMIES = {
    teieretta: { name: 'Teieretta Lumacona', lv: [1, 3], hp: 42, atk: 7, spd: 1.6, range: 1.6, aggro: 7, exp: 14, radius: 0.8, drop: 0.3, gold: [2, 6], respawn: 16, leash: 26 },
    gufo: { name: 'Gufo Lampadino', lv: [4, 6], hp: 95, atk: 13, spd: 2.8, range: 1.8, aggro: 10, exp: 34, radius: 0.8, drop: 0.45, gold: [6, 14], respawn: 20, bonus: 6, leash: 26 },
    boss: { name: 'Lavatricio Torone', lv: [10, 10], hp: 1150, atk: 26, spd: 2.5, range: 3.6, aggro: 16, exp: 420, radius: 2.5, drop: 1, gold: [120, 180], respawn: 70, bonus: 30, leash: 22, boss: true }
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

  const api = { expNeed, playerStats, pointsTotal, APPEARANCE, RACES, STATS, SKILLS, CLASSES, ADV, POINTS_PER_LEVEL, ADV_LEVEL,
    WORLD, ENEMIES, ATTACKS, QUESTS, MAX_LEVEL: 60, INV_SIZE: 24, POTION_CD: 8 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AF_RULES = api;
})(typeof window !== 'undefined' ? window : globalThis);
