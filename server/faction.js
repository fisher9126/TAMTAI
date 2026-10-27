'use strict';
/* Aetherfall step 13 (server plugin of zones.js): factions and reputation.
   Four factions (rules.js FACTIONS). Reputation comes from killing monsters (each monster type favours a faction) and from donating materials.
   A rival loses a share of what you gain. Tiers: Thù địch < 0 <= Trung lập < 500 Thân thiện < 2000 Kính trọng < 6000 Tôn kính.
   Rewards: a small permanent stat bonus per faction (d.xfac, added by server/equip.js), a faction shop, and access to faction mounts (server/move.js). */
const rules = require('../public/js/rules.js');
const F = rules.FACTIONS, TIERS = rules.REP_TIERS;
let C = null, API = null;

/* monster type -> [faction, points]; boss and elite monsters give 5x */
const KILL = {
  teieretta: ['knight', 1], gufo: ['knight', 1], fungo: ['mage', 1], ragno: ['mage', 1], talpa: ['trader', 1], golem: ['trader', 1],
  pinguino: ['trader', 1], orso: ['trader', 1], scorpio: ['trader', 2], mummia: ['knight', 2], demone: ['mage', 2], drago: ['mage', 3],
  cinder: ['mage', 1], ombra: ['mage', 1]
};
const DONATE = { knight: { ore: 3, coal: 3, gear: 8 }, mage: { shroom: 3, frost: 3, void: 8, core: 10 }, trader: { herb: 2, shell: 2, feather: 3, pelt: 3, sand: 4 }, cult: { venom: 4, void: 10, bone: 6, core: 10 } };
const BONUS = { // per tier index (2 friendly, 3 honored, 4 exalted), flat stats
  knight: { 2: { def: 3 }, 3: { def: 8, hp: 40 }, 4: { def: 15, hp: 120 } },
  mage: { 2: { mp: 20 }, 3: { mp: 60, crit: 1 }, 4: { mp: 120, crit: 2.5 } },
  trader: { 2: { hp: 30 }, 3: { hp: 80, spd: 1 }, 4: { hp: 160, spd: 2.5 } },
  cult: { 2: { atk: 3 }, 3: { atk: 8, crit: 1 }, 4: { atk: 15, crit: 2.5 } }
};
const SHOP = [
  { id: 'pot', tier: 2, name: 'Bình máu x10', gold: 150, give: (p) => { p.data.potions = Math.min(999, p.data.potions + 10); } },
  { id: 'rare', tier: 3, name: 'Trang bị phụ Hiếm', gold: 600, give: (p, E) => !!(E && E.grantPiece && E.grantPiece(p, 'rare')) },
  { id: 'epic', tier: 4, name: 'Trang bị phụ Sử thi', gold: 3000, give: (p, E) => !!(E && E.grantPiece && E.grantPiece(p, 'epic')) },
  { id: 'gem', tier: 3, name: 'Ngọc bậc 2 ngẫu nhiên', gold: 900, give: (p, E) => !!(E && E.grantGem && E.grantGem(p, 2)) }
];
const tierIdx = (pts) => { let t = 0; TIERS.forEach((x, i) => { if (pts >= x.min && i >= 1) t = i; }); return pts < 0 ? 0 : t; };

function blank() { const rep = {}; Object.keys(F).forEach((k) => { rep[k] = 0; }); return { rep, bought: {}, dirty: false }; }
function load(p) {
  const s = blank();
  try {
    const r = API.db.get('SELECT data FROM faction_player WHERE user_id = ?', p.id);
    if (r) { const d = JSON.parse(r.data); Object.keys(F).forEach((k) => { s.rep[k] = Math.max(-5000, Math.min(99999, d.rep && d.rep[k] | 0)); }); }
  } catch (err) { console.error('faction load', err.message); }
  p.fc = s;
}
function save(p) {
  if (!p.fc) return;
  API.db.run('INSERT INTO faction_player (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data', p.id, JSON.stringify({ rep: p.fc.rep }));
  p.fc.dirty = false;
}
function apply(p) {
  const x = {};
  Object.keys(F).forEach((k) => { const t = tierIdx(p.fc.rep[k]), b = BONUS[k] && BONUS[k][t]; if (b) Object.keys(b).forEach((s) => { x[s] = (x[s] || 0) + b[s]; }); });
  p.data.xfac = x;
  const E = API.plugin('equip'); if (E && E.refresh) E.refresh(p); else C.pushMe(p);
}
function info(p) {
  const rep = {}, tiers = {};
  Object.keys(F).forEach((k) => { rep[k] = p.fc.rep[k]; tiers[k] = tierIdx(p.fc.rep[k]); });
  C.send(p, { t: 'finfo', rep, tiers, mats: p.zn ? p.zn.mats : {}, bonus: p.data.xfac || {} });
}
function give(p, fid, pts) {
  if (!F[fid] || !pts) return;
  const before = tierIdx(p.fc.rep[fid]);
  p.fc.rep[fid] += pts; p.fc.dirty = true;
  const rival = F[fid].rival;
  if (rival && pts > 0) p.fc.rep[rival] = Math.max(-5000, p.fc.rep[rival] - Math.ceil(pts * 0.4));
  const after = tierIdx(p.fc.rep[fid]);
  if (after !== before) { apply(p); API.sys(p, 'Danh tiếng với ' + F[fid].name + ': ' + TIERS[after].name + '!'); C.send(p, { t: 'fup', f: fid, tier: after }); }
}

const ops = {
  finfo(p) { info(p); },
  fdonate(p, m) {
    if (!API.thr(p, 'fdon', 300)) return;
    const fid = String(m.f || ''), mat = String(m.mat || ''), n = Math.max(1, Math.min(50, m.n | 0 || 1));
    if (!F[fid] || !DONATE[fid][mat]) return;
    if (!p.zn || (p.zn.mats[mat] | 0) < n) return API.sys(p, 'Bạn không đủ nguyên liệu.');
    p.zn.mats[mat] -= n; p.zn.dirty = true;
    const pts = DONATE[fid][mat] * n; give(p, fid, pts);
    API.sys(p, 'Cống hiến ' + n + ' ' + rules.MATS[mat].name + ' cho ' + F[fid].name + ': +' + pts + ' danh tiếng.');
    API.info(p); info(p);
  },
  fbuy(p, m) {
    if (!API.thr(p, 'fbuy', 400)) return;
    const fid = String(m.f || ''), it = SHOP.find((x) => x.id === String(m.id || ''));
    if (!F[fid] || !it) return;
    if (tierIdx(p.fc.rep[fid]) < it.tier) return API.sys(p, 'Cần danh tiếng ' + TIERS[it.tier].name + ' với ' + F[fid].name + '.');
    if (p.data.gold < it.gold) return API.sys(p, 'Cần ' + it.gold + ' vàng.');
    const E = API.plugin('equip');
    if (it.id === 'pot') { p.data.gold -= it.gold; it.give(p); }
    else { const ok = it.give(p, E); if (!ok) return API.sys(p, 'Không thể nhận (túi trang bị phụ đầy?).'); p.data.gold -= it.gold; }
    C.pushMe(p); if (C.saveNow) C.saveNow(p); API.sys(p, 'Đã mua ' + it.name + '.'); info(p);
  }
};

function onKill(p, e) {
  if (!p.fc) return;
  const row = KILL[e.type]; if (!row) return;
  const d = e.d || {}, k = d.boss || d.elite ? 5 : 1;
  const was = p.fc.rep[row[0]];
  give(p, row[0], row[1] * k);
  if ((p.fc.rep[row[0]] | 0) % 10 < (was | 0) % 10) info(p); // refresh the panel now and then
}
function init(ctx, api) { C = ctx; API = api; API.db.exec('CREATE TABLE IF NOT EXISTS faction_player (user_id INTEGER PRIMARY KEY, data TEXT NOT NULL)'); }
function onConnect(p) { load(p); apply(p); info(p); }
function onLeave(p) { try { save(p); } catch (err) { console.error('faction save', err.message); } }
function tick() { C.online.forEach((p) => { if (p.fc && p.fc.dirty && Math.random() < 0.1) { try { save(p); } catch (err) { /* retry */ } } }); }
/* 0 hostile .. 4 exalted; used by server/move.js */
function tierOf(p, fid) { return p.fc ? tierIdx(p.fc.rep[fid] | 0) : 0; }

module.exports = { init, onConnect, onLeave, onKill, tick, ops, tierOf };
