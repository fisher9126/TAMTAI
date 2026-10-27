/* Shared game rules: used by the browser (window.AF_RULES) and the server (require).
   The server is the authority for everything here; the browser uses it only to display. */
(function (root) {
  'use strict';
  const items = (typeof module !== 'undefined' && module.exports) ? require('./items.js') : root.AF_ITEMS;

  function expNeed(l) { return Math.round(40 * Math.pow(l, 1.6)); }
  function playerStats(d) {
    const lv = d.level || 1;
    const s = { maxHp: 120 + (lv - 1) * 26, atk: 10 + (lv - 1) * 3, def: 2 + (lv - 1), crit: 5, spd: 0, maxMp: 60 + (lv - 1) * 6, maxSt: 100 };
    items.SLOTS.forEach((k) => {
      const it = d.eq && d.eq[k]; if (!it) return;
      const t = items.statsFor(it.slot, it.rarity, it.ilvl);
      s.maxHp += t.hp || 0; s.atk += t.atk || 0; s.def += t.def || 0; s.crit += t.crit || 0; s.spd += t.spd || 0;
    });
    return s;
  }

  /* World layout (same numbers on both sides) */
  const WORLD = { VILLAGE: { x: 0, z: 0 }, FOREST: { x: 55, z: 50 }, ARENA: { x: 62, z: -58 }, POND: { x: -34, z: 26 }, R: 108, SPAWN: { x: 1, z: 9 } };

  /* Monsters. Numbers only; the browser adds models. */
  const ENEMIES = {
    teieretta: { name: 'Teieretta Lumacona', lv: [1, 3], hp: 42, atk: 7, spd: 1.6, range: 1.6, aggro: 7, exp: 14, radius: 0.8, drop: 0.3, gold: [2, 6], respawn: 16, leash: 26 },
    gufo: { name: 'Gufo Lampadino', lv: [4, 6], hp: 95, atk: 13, spd: 2.8, range: 1.8, aggro: 10, exp: 34, radius: 0.8, drop: 0.45, gold: [6, 14], respawn: 20, bonus: 6, leash: 26 },
    boss: { name: 'Lavatricio Torone', lv: [10, 10], hp: 1150, atk: 26, spd: 2.5, range: 3.6, aggro: 16, exp: 420, radius: 2.5, drop: 1, gold: [120, 180], respawn: 70, bonus: 30, leash: 22, boss: true }
  };
  /* Player attacks: reach (beyond the monster's radius), damage multiplier, cooldown in seconds */
  const ATTACKS = {
    atk: { reach: 2.9, mult: [1, 1.1, 1.6], cd: 0.3 },
    spin: { reach: 3.4, mult: [1.9], cd: 4.6, mp: 15 },
    dash: { reach: 7.5, mult: [1.5], cd: 3.6, mp: 10 }
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

  const api = { expNeed, playerStats, WORLD, ENEMIES, ATTACKS, QUESTS, MAX_LEVEL: 60, INV_SIZE: 24, POTION_CD: 8 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AF_RULES = api;
})(typeof window !== 'undefined' ? window : globalThis);
