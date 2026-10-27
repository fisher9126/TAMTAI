'use strict';
/* Character system: race / gender / appearance / class, stat points, advanced class, support skills.
   The profile lives in its own table (char_profile) and is attached to the player's data at runtime as data.prof,
   so rules.playerStats (shared by browser and server) sees it. Everything is validated here. */
const db = require('./db');
const rules = require('../public/js/rules.js');
const world = require('./world');

let C = null; // { online, send, broadcast, sys, pushMe, saveNow, int }
const combat = () => require('./combat');
const now = () => Date.now();
const intIn = (v, a, b, d) => C.int(v, a, b, d);
const { RACES, CLASSES, ADV, STATS, APPEARANCE } = rules;

db.exec('CREATE TABLE IF NOT EXISTS char_profile (user_id INTEGER PRIMARY KEY, data TEXT NOT NULL)');

function init(ctx) { C = ctx; }

/* ---------- profile ---------- */
const sumAlloc = (a) => Object.keys(STATS).reduce((n, k) => n + ((a && a[k]) | 0), 0);
const pointsLeft = (p) => Math.max(0, rules.pointsTotal(p.data.level) - sumAlloc(p.prof.alloc));
function cleanProf(o) {
  if (!o || typeof o !== 'object') return null;
  if (!RACES[o.race] || !CLASSES[o.cls] || (o.gender !== 'm' && o.gender !== 'f')) return null;
  const ap = o.app || {}; const alloc = {};
  Object.keys(STATS).forEach((k) => { alloc[k] = Math.max(0, Math.min(10000, (o.alloc && o.alloc[k]) | 0)); });
  return { race: o.race, gender: o.gender, cls: o.cls, adv: ADV[o.adv] && ADV[o.adv].cls === o.cls ? o.adv : null,
    app: { skin: intIn(ap.skin, 0, APPEARANCE.SKINS.length - 1, 0), hs: intIn(ap.hs, 0, APPEARANCE.STYLES.length - 1, 0), hair: intIn(ap.hair, 0, APPEARANCE.HAIRS.length - 1, 0), shirt: intIn(ap.shirt, 0, APPEARANCE.SHIRTS.length - 1, 0) },
    alloc };
}
function saveProf(p) {
  const pr = p.prof; const o = { race: pr.race, gender: pr.gender, cls: pr.cls, adv: pr.adv, app: pr.app, alloc: pr.alloc };
  db.run('INSERT INTO char_profile (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data', p.id, JSON.stringify(o));
}
const appOf = (pr) => ({ cls: pr.cls, race: pr.race, gender: pr.gender, skin: pr.app.skin, hs: pr.app.hs, hair: pr.app.hair, shirt: pr.app.shirt });
function view(p) {
  const pr = p.prof;
  return { race: pr.race, gender: pr.gender, cls: pr.cls, adv: pr.adv, app: pr.app, alloc: pr.alloc, points: pointsLeft(p) };
}
function attach(p, prof) {
  p.prof = prof; p.data.prof = prof; p.noChar = false; p.app = appOf(prof);
}
function pushView(p, st) { C.send(p, Object.assign({ t: 'char', st }, view(p))); }

function onConnect(p) {
  p.prof = null; p.app = null; p.noChar = true; p.hidden = false; p.scd = {};
  let prof = null;
  const r = db.get('SELECT data FROM char_profile WHERE user_id = ?', p.id);
  if (r) { try { prof = cleanProf(JSON.parse(r.data)); } catch (e) { prof = null; } }
  if (prof) {
    attach(p, prof); C.pushMe(p); pushView(p, 'ok');
    C.broadcast({ t: 'app', id: p.id, app: p.app }, p.id);
    combat().clamp(p);
  } else {
    C.send(p, { t: 'char', st: 'create' });
    C.sys(p, 'Hãy tạo nhân vật của bạn: chọn chủng tộc, lớp và ngoại hình.');
  }
}
function onLeave(p) { p.hidden = false; }

/* ---------- requests ---------- */
function onChar(p, m) {
  const op = m.op;
  if (op === 'info') { return p.prof ? pushView(p, 'update') : C.send(p, { t: 'char', st: 'create' }); }
  if (op === 'create') {
    if (p.prof) return C.sys(p, 'Bạn đã tạo nhân vật rồi.');
    const prof = cleanProf({ race: String(m.race), gender: m.gender, cls: String(m.cls), adv: null,
      app: { skin: m.skin, hs: m.hs, hair: m.hair, shirt: m.shirt }, alloc: {} });
    if (!prof) return C.sys(p, 'Lựa chọn không hợp lệ.');
    attach(p, prof); saveProf(p);
    combat().fullHeal(p);
    C.pushMe(p); C.saveNow(p); pushView(p, 'ok');
    C.broadcast({ t: 'app', id: p.id, app: p.app }, p.id);
    C.sys(p, 'Chào mừng ' + RACES[prof.race].name + ' ' + CLASSES[prof.cls].name + '! Phím 1-4 dùng kỹ năng, phím C mở bảng nhân vật.');
    return;
  }
  if (!p.prof) return;
  const pr = p.prof, d = p.data;
  if (op === 'alloc') {
    const stat = String(m.stat); if (!STATS[stat]) return;
    const n = Math.min(intIn(m.n, 1, 1000, 1), pointsLeft(p)); if (n <= 0) return C.sys(p, 'Bạn không còn điểm chỉ số.');
    pr.alloc[stat] += n; saveProf(p); C.pushMe(p); pushView(p, 'update');
  } else if (op === 'reset') {
    if (!sumAlloc(pr.alloc)) return C.sys(p, 'Bạn chưa phân bổ điểm nào.');
    const cost = d.level < 10 ? 0 : d.level * 50;
    if (d.gold < cost) return C.sys(p, 'Tẩy điểm cần ' + cost + ' vàng.');
    d.gold -= cost; Object.keys(STATS).forEach((k) => { pr.alloc[k] = 0; });
    saveProf(p); combat().clamp(p); C.pushMe(p); C.saveNow(p); pushView(p, 'update');
    C.sys(p, 'Đã tẩy điểm chỉ số' + (cost ? ' (mất ' + cost + ' vàng)' : ' miễn phí') + '. Bạn có ' + pointsLeft(p) + ' điểm để phân bổ lại.');
  } else if (op === 'advance') {
    if (d.level < rules.ADV_LEVEL) return C.sys(p, 'Cần đạt cấp ' + rules.ADV_LEVEL + ' để lên lớp nâng cao.');
    if (pr.adv) return C.sys(p, 'Bạn đã có lớp nâng cao.');
    const adv = String(m.adv); if (!ADV[adv] || ADV[adv].cls !== pr.cls) return C.sys(p, 'Lớp nâng cao không hợp lệ.');
    pr.adv = adv; saveProf(p); C.pushMe(p); C.saveNow(p); pushView(p, 'update');
    C.broadcast({ t: 'sys', text: p.name + ' đã lên lớp nâng cao ' + ADV[adv].name + '!' });
  }
}

/* ---------- skills ---------- */
function canUse(p, kind) {
  if (!p.prof) return false;
  const cls = CLASSES[p.prof.cls];
  if (kind === cls.basic) return true;
  const sk = cls.skills.find((s) => s.id === kind);
  return !!sk && p.data.level >= sk.lv;
}
/* stun / slow that a damage skill puts on the monsters it hit */
function afterHit(p, kind, ids) {
  const a = rules.ATTACKS[kind]; if (!a || (!a.stun && !a.slow)) return;
  const t = now();
  (ids || []).slice(0, 12).forEach((id) => {
    const e = world.byId.get(Number(id)); if (!e || e.dead) return;
    if (Math.hypot(p.x - e.x, p.z - e.z) > a.reach + e.d.radius + 1.5) return;
    const k = e.d.boss ? 0.3 : 1;
    if (a.stun) e.stunUntil = Math.max(e.stunUntil || 0, t + a.stun * k);
    if (a.slow) e.slowUntil = Math.max(e.slowUntil || 0, t + a.slow * k);
    e.dirty = true;
  });
}
function allies(p, range) {
  const out = [p];
  if (p.party) p.party.members.forEach((id) => { const o = C.online.get(id); if (o && o.id !== p.id && Math.hypot(o.x - p.x, o.z - p.z) <= range) out.push(o); });
  return out;
}
function onSkill(p, m) {
  const id = String(m.id), sk = rules.SKILLS[id];
  if (!sk || !sk.support || p.hp <= 0 || !canUse(p, id) || combat().isStunned(p)) return;
  const t = now(); p.scd = p.scd || {};
  if ((p.scd[id] || 0) > t + 80) return;
  if (p.mp < sk.support.mp) return C.sys(p, 'Không đủ mana.');
  const cb = combat();
  let target = null;
  if (id === 'revive') {
    allies(p, 12).forEach((o) => { if (o.hp <= 0 && (!target || Math.hypot(o.x - p.x, o.z - p.z) < Math.hypot(target.x - p.x, target.z - p.z))) target = o; });
    if (!target) return C.sys(p, 'Không có đồng đội nào ngã gần bạn.');
  }
  p.mp -= sk.support.mp; p.scd[id] = t + sk.support.cd * 1000; cb.sendVit(p);
  if (id === 'bulwark') cb.addFx(p, 'guard', 8);
  else if (id === 'vanish') { p.hidden = true; p.hiddenUntil = t + 5000; cb.addFx(p, 'hide', 5); }
  else if (id === 'heal') allies(p, 14).forEach((o) => { if (o.hp > 0) cb.heal(o, Math.round(cb.maxHp(o) * 0.3)); });
  else if (id === 'bless') allies(p, 14).forEach((o) => { if (o.hp > 0 && o.prof) { o.prof.blessUntil = t + 12000; cb.addFx(o, 'bless', 12); } });
  else if (id === 'revive') { cb.revive(target, 0.4); C.sys(target, p.name + ' đã hồi sinh bạn!'); }
}
/* breaking stealth when the player attacks */
function reveal(p) { if (p.hidden) { p.hidden = false; combat().dropFx(p, 'hide'); } }

/* ---------- small hooks used by other modules ---------- */
const expBonus = (p) => (p.prof && RACES[p.prof.race].exp) || 1;
const mpRegen = (p) => (p.prof && RACES[p.prof.race].mpRegen) || 1;
const poisonMult = (p) => (p.prof && RACES[p.prof.race].poisonRes) || 1;
function rageUpdate(p, maxHp) { if (p.prof) p.prof.rageOn = !!RACES[p.prof.race].rage && p.hp > 0 && p.hp < maxHp * 0.3; }

function handle(p, m) {
  try {
    if (m.t === 'char') return onChar(p, m);
    if (m.t === 'skill') return onSkill(p, m);
  } catch (e) { console.error('character error', m.t, e); }
  return undefined;
}

module.exports = { init, handle, onConnect, onLeave, canUse, afterHit, reveal, expBonus, mpRegen, poisonMult, rageUpdate };
