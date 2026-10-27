'use strict';
/* Aetherfall step 11 (server plugin of zones.js): mounts and swimming.
   - Mounts (level 15+): bought with gold (two need Tôn kính reputation with a faction), toggled on and off; while mounted the server adds a speed bonus
     through d.mountSpd (read by rules.playerStats). A mount is dropped automatically inside any dungeon, tower, raid or PvP match.
   - Swimming: standing inside the pond circle sets d.swim (speed -35) and tells the browser, which sinks and bobs the model.
   Jumping is a browser-only visual (public/js/move.js): the server does not track the vertical axis. */
const rules = require('../public/js/rules.js');
const W = rules.WORLD, MOUNTS = rules.MOUNTS;
let C = null, API = null;

function blank() { return { owned: {}, active: null, dirty: false }; }
function load(p) {
  const s = blank();
  try {
    const r = API.db.get('SELECT data FROM move_player WHERE user_id = ?', p.id);
    if (r) {
      const d = JSON.parse(r.data);
      Object.keys(d.owned || {}).forEach((k) => { if (MOUNTS[k]) s.owned[k] = 1; });
      s.active = MOUNTS[d.active] && s.owned[d.active] ? d.active : null;
    }
  } catch (err) { console.error('move load', err.message); }
  p.mv = s;
}
function save(p) {
  if (!p.mv) return;
  API.db.run('INSERT INTO move_player (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data', p.id, JSON.stringify({ owned: p.mv.owned, active: p.mv.active }));
  p.mv.dirty = false;
}
function apply(p) { p.data.mountSpd = p.mv.active ? MOUNTS[p.mv.active].spd : 0; C.pushMe(p); }
function info(p) { C.send(p, { t: 'mvinfo', owned: p.mv.owned, active: p.mv.active, swim: !!p.data.swim }); }
const lockedIn = (p) => { const pv = API.plugin('pvp'); return !!(API.runOf(p) || API.extOf(p) || (pv && pv.inMatch && pv.inMatch(p))); };

const ops = {
  mvinfo(p) { info(p); },
  mvbuy(p, m) {
    if (!API.thr(p, 'mvbuy', 400)) return;
    const id = String(m.id || ''), d = MOUNTS[id]; if (!d || p.mv.owned[id]) return;
    if ((p.data.level || 1) < d.lv) return API.sys(p, 'Cần cấp ' + d.lv + ' để mua ' + d.name + '.');
    if (d.rep) { const f = API.plugin('faction'); if (!f || !f.tierOf || f.tierOf(p, d.rep[0]) < d.rep[1]) return API.sys(p, 'Cần danh tiếng ' + rules.REP_TIERS[d.rep[1]].name + ' với ' + rules.FACTIONS[d.rep[0]].name + '.'); }
    if (p.data.gold < d.price) return API.sys(p, 'Cần ' + d.price + ' vàng.');
    p.data.gold -= d.price; p.mv.owned[id] = 1; p.mv.dirty = true; save(p); C.pushMe(p); if (C.saveNow) C.saveNow(p);
    API.sys(p, 'Đã mua ' + d.name + '! Bấm Cưỡi trong bảng Thú cưỡi (phím H).'); info(p);
  },
  mvtoggle(p, m) {
    if (!API.thr(p, 'mvtoggle', 400)) return;
    const id = m.id ? String(m.id) : p.mv.active || Object.keys(p.mv.owned)[0];
    if (p.mv.active && (!m.id || m.id === p.mv.active)) { p.mv.active = null; p.mv.dirty = true; apply(p); return info(p); }
    if (!id || !p.mv.owned[id]) return API.sys(p, 'Bạn chưa có thú cưỡi này.');
    if ((p.data.level || 1) < MOUNTS[id].lv) return API.sys(p, 'Cần cấp ' + MOUNTS[id].lv + '.');
    if (lockedIn(p)) return API.sys(p, 'Không cưỡi được trong hầm ngục, tháp, raid hoặc trận PvP.');
    if (p.data.swim) return API.sys(p, 'Không cưỡi được khi đang bơi.');
    p.mv.active = id; p.mv.dirty = true; apply(p); info(p);
  }
};

function init(ctx, api) { C = ctx; API = api; API.db.exec('CREATE TABLE IF NOT EXISTS move_player (user_id INTEGER PRIMARY KEY, data TEXT NOT NULL)'); }
function onConnect(p) { load(p); p.data.swim = false; apply(p); info(p); }
function onLeave(p) { try { save(p); } catch (err) { console.error('move save', err.message); } }
function tick() {
  C.online.forEach((p) => {
    if (!p.mv) return;
    const inWater = Math.hypot(p.x - W.POND.x, p.z - W.POND.z) < W.POND_R;
    if (inWater !== !!p.data.swim) {
      p.data.swim = inWater;
      if (inWater && p.mv.active) { p.mv.active = null; p.mv.dirty = true; API.sys(p, 'Bạn xuống nước nên phải xuống ngựa.'); }
      apply(p); info(p);
    } else if (p.mv.active && lockedIn(p)) { p.mv.active = null; p.mv.dirty = true; apply(p); info(p); API.sys(p, 'Bạn đã xuống thú cưỡi.'); }
    if (p.data.mountSpd == null || (p.mv.active ? MOUNTS[p.mv.active].spd : 0) !== p.data.mountSpd) apply(p); // another module rebuilt p.data
    if (p.mv.dirty && Math.random() < 0.1) { try { save(p); } catch (err) { /* retry */ } }
  });
}

module.exports = { init, onConnect, onLeave, tick, ops };
