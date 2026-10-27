'use strict';
/* Aetherfall step 7 (server plugin of zones.js): skill tree.
   1 point per level (from level 2), 3 branches per class, up to 3 saved builds ("bộ kỹ năng") that can be switched, free reset under level 20.
   Passive nodes change the player's stats (d.tree, read by rules.playerStats on both server and browser). Skill nodes raise the damage of one
   attack: world.playerHit is wrapped once so the server multiplies the attack stat for that kind of hit. Ultimate nodes need 8 points in
   their branch and level 20 / 40 / 60. Saved in table tree_player. */
const T = require('../public/js/tree.js');
let C = null, API = null, patched = false;
const now = () => Date.now();

function blankSets() { return Array.from({ length: T.SETS }, () => ({})); }
function load(p) {
  const s = { sets: blankSets(), cur: 0, dirty: false };
  try {
    const r = API.db.get('SELECT data FROM tree_player WHERE user_id = ?', p.id);
    if (r) {
      const d = JSON.parse(r.data);
      s.cur = Math.max(0, Math.min(T.SETS - 1, d.cur | 0));
      for (let i = 0; i < T.SETS; i++) {
        const a = (d.sets && d.sets[i]) || {};
        Object.keys(a).forEach((id) => { const n = T.byId[id]; if (n) s.sets[i][id] = Math.max(0, Math.min(n.max, a[id] | 0)); });
      }
    }
  } catch (err) { console.error('tree load', err.message); }
  p.tr = s; p.treeDone = false;
}
function save(p) {
  if (!p.tr) return;
  API.db.run('INSERT INTO tree_player (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data', p.id, JSON.stringify({ sets: p.tr.sets, cur: p.tr.cur }));
  p.tr.dirty = false;
}
const alloc = (p) => p.tr.sets[p.tr.cur];
const spent = (a) => Object.keys(a).reduce((n, id) => n + a[id], 0);
const branchPts = (a, cls, bi) => Object.keys(a).reduce((n, id) => { const nd = T.byId[id]; return nd && nd.cls === cls && nd.branch === bi && nd.kind !== 'u' ? n + a[id] : n; }, 0);

/* rebuild everything that depends on the allocation: d.tree (stats) and p.treeDmg (per-attack damage) */
function apply(p) {
  const cls = p.prof && p.prof.cls; if (!cls || !p.tr) return;
  const a = alloc(p), lv = p.data.level || 1, tree = { atk: 0, def: 0, hp: 0, mp: 0, crit: 0, spd: 0 }, dmg = {};
  // points above what the level allows (after a reset of the level) are ignored from the end of the list, so a stale save can never exceed the budget
  let budget = T.pointsTotal(lv);
  Object.keys(a).forEach((id) => {
    const nd = T.byId[id]; if (!nd || nd.cls !== cls || lv < nd.lv) return;
    const r = Math.min(a[id], budget); if (r <= 0) return; budget -= r;
    if (nd.eff) Object.keys(nd.eff).forEach((k) => { tree[k] += nd.eff[k] * r; });
    if (nd.skill) dmg[nd.skill] = (dmg[nd.skill] || 0) + (nd.per || 0) * r;
  });
  p.data.tree = tree; p.treeDmg = dmg; p.treeDone = true; p.treeLv = lv;
  try { require('./combat').sendVit(p); } catch (err) { /* combat module not installed */ }
  C.pushMe(p);
}
function info(p) {
  if (!p.tr) return;
  const cls = p.prof && p.prof.cls, lv = p.data.level || 1;
  C.send(p, { t: 'tinfo', cls: cls || null, sets: p.tr.sets, cur: p.tr.cur, total: T.pointsTotal(lv), resetCost: T.resetCost(lv) });
}
const needClass = (p) => { if (!p.prof) { API.sys(p, 'Hãy tạo nhân vật trước.'); return false; } return true; };

const ops = {
  tinfo(p) { info(p); },
  tup(p, m) {
    if (!needClass(p) || !API.thr(p, 'tup', 120)) return;
    const nd = T.byId[String(m.id || '')], a = alloc(p), lv = p.data.level || 1;
    if (!nd || nd.cls !== p.prof.cls) return;
    if (lv < nd.lv) return API.sys(p, 'Cần cấp ' + nd.lv + ' để học "' + nd.name + '".');
    if ((a[nd.id] | 0) >= nd.max) return API.sys(p, '"' + nd.name + '" đã đủ bậc.');
    if (spent(a) >= T.pointsTotal(lv)) return API.sys(p, 'Hết điểm kỹ năng. Mỗi cấp được 1 điểm.');
    if (nd.kind === 'u' && branchPts(a, nd.cls, nd.branch) < T.ULT_NEED) return API.sys(p, 'Cần ' + T.ULT_NEED + ' điểm trong nhánh này để học kỹ năng tối thượng.');
    a[nd.id] = (a[nd.id] | 0) + 1; p.tr.dirty = true; apply(p); info(p);
  },
  treset(p) {
    if (!needClass(p) || !API.thr(p, 'treset', 1500)) return;
    const lv = p.data.level || 1, cost = T.resetCost(lv), a = alloc(p);
    if (!spent(a)) return API.sys(p, 'Bộ kỹ năng này chưa dùng điểm nào.');
    if (p.data.gold < cost) return API.sys(p, 'Không đủ vàng để tẩy điểm (cần ' + cost + ').');
    p.data.gold -= cost; Object.keys(a).forEach((k) => delete a[k]); p.tr.dirty = true; apply(p); info(p);
    API.sys(p, cost ? 'Đã tẩy điểm kỹ năng (' + cost + ' vàng).' : 'Đã tẩy điểm kỹ năng miễn phí.');
  },
  tset(p, m) {
    if (!needClass(p) || !API.thr(p, 'tset', 8000)) return API.sys(p, 'Đổi bộ kỹ năng quá nhanh, đợi vài giây.');
    const i = m.i | 0; if (i < 0 || i >= T.SETS || i === p.tr.cur) return;
    if (p.duelWith != null) return API.sys(p, 'Không đổi được trong lúc thách đấu.');
    p.tr.cur = i; p.tr.dirty = true; apply(p); info(p); API.sys(p, 'Đã chuyển sang bộ kỹ năng ' + (i + 1) + '.');
  }
};

function init(ctx, api) {
  C = ctx; API = api;
  API.db.exec('CREATE TABLE IF NOT EXISTS tree_player (user_id INTEGER PRIMARY KEY, data TEXT NOT NULL)');
  if (patched) return; patched = true;
  const world = require('./world'), orig = world.playerHit;
  if (typeof orig === 'function') {
    world.playerHit = function (p, kind, combo, ids, stats) {
      const td = p && p.treeDmg;
      if (td && td[kind] && stats) stats = Object.assign({}, stats, { atk: stats.atk * (1 + td[kind]) });
      return orig.call(this, p, kind, combo, ids, stats);
    };
  }
}
function onConnect(p) { load(p); info(p); }
function onLeave(p) { try { save(p); } catch (err) { console.error('tree save', err.message); } }
function tick() {
  C.online.forEach((p) => {
    if (!p.tr) return;
    if (p.prof && (!p.treeDone || p.treeLv !== (p.data.level || 1))) { apply(p); info(p); }
    if (p.tr.dirty && now() % 15000 < 1000) save(p);
  });
}

module.exports = { init, onConnect, onLeave, tick, ops };
