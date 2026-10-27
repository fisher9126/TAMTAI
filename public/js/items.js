/* Shared item rules: loaded by the browser (window.AF_ITEMS) and by the server (require).
   The server recomputes stats from these formulas, so a client cannot forge item stats. */
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

  function statsFor(slot, rarity, ilvl) {
    const m = RMULT[rarity] * (1 + (ilvl - 1) * 0.16);
    const s = {};
    if (slot === 'weapon') { s.atk = Math.round(4 * m); if (rarity === 'epic') s.crit = 4; if (rarity === 'legend') s.crit = 8; }
    if (slot === 'helmet') { s.def = Math.round(2 * m); s.hp = Math.round(10 * m); }
    if (slot === 'armor') { s.def = Math.round(3 * m); s.hp = Math.round(26 * m); }
    if (slot === 'boots') { s.def = Math.round(1.2 * m); s.spd = { common: 0, rare: 5, epic: 8, legend: 12 }[rarity] || 0; }
    if (slot === 'cape') { s.hp = Math.round(15 * m); s.crit = { common: 0, rare: 2, epic: 3, legend: 5 }[rarity] || 0; }
    for (const k in s) if (!s[k]) delete s[k];
    return s;
  }
  function newId() { return 'i' + Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36); }
  function makeItem(slot, rarity, ilvl, name) {
    const suf = SUF[rarity];
    return { id: newId(), slot, rarity, ilvl, name: name || (BASE[slot] + ' ' + suf[Math.floor(Math.random() * suf.length)]), stats: statsFor(slot, rarity, ilvl) };
  }
  function itemValue(it) { return Math.round({ common: 6, rare: 22, epic: 65, legend: 220 }[it.rarity] * (1 + it.ilvl * 0.2)); }
  function rollRarity(bonus) { const r = Math.random() * 100 - (bonus || 0); if (r < 2) return 'legend'; if (r < 12) return 'epic'; if (r < 40) return 'rare'; return 'common'; }
  /* Returns a clean copy of an item, or null if it is not a valid item. Stats always come from the formula. */
  function validItem(it) {
    if (!it || typeof it !== 'object') return null;
    if (SLOTS.indexOf(it.slot) < 0 || RAR.indexOf(it.rarity) < 0) return null;
    const ilvl = Math.round(Number(it.ilvl));
    if (!(ilvl >= 1 && ilvl <= 70)) return null;
    const id = typeof it.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(it.id) ? it.id : newId();
    let name = typeof it.name === 'string' ? it.name.replace(/[<>]/g, '').trim().slice(0, 40) : '';
    if (!name) name = BASE[it.slot];
    return { id, slot: it.slot, rarity: it.rarity, ilvl, name, stats: statsFor(it.slot, it.rarity, ilvl) };
  }
  const api = { RAR, SLOTS, RNAME, SLOTNAME, BASE, SUF, statsFor, makeItem, itemValue, rollRarity, validItem };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AF_ITEMS = api;
})(typeof window !== 'undefined' ? window : globalThis);
