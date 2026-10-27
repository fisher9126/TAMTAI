'use strict';
/* Aetherfall step 14 (server plugin of zones.js): teamwork.
   - party health frame: every second each party member receives the health / mana of the others (pframe)
   - guild storage (kho bang): members deposit items from their bag, officers and the leader withdraw (officers 5 a day), everything is logged
   - voice chat signalling: the server only relays WebRTC offers / answers between members of the same party or guild; the audio itself goes
     directly between browsers (peer to peer), so the server carries no voice traffic. */
const rules = require('../public/js/rules.js');
const items = require('../public/js/items.js');
let C = null, API = null;
const J = JSON.stringify;
const now = () => Date.now();
const BANK_CAP = 80, OFFICER_DAILY = 5, VOICE_MAX = 8;
const day = () => new Date(now() + 7 * 3600e3).toISOString().slice(0, 10);
const sys = (p, t) => API.sys(p, t);

/* ---------- party frame ---------- */
function frame() {
  C.online.forEach((p) => {
    if (!p.party) { if (p.hadFrame) { p.hadFrame = false; C.send(p, { t: 'pframe', list: [] }); } return; }
    const list = [];
    (p.party.members || []).forEach((id) => {
      const o = C.online.get(id); if (!o || typeof o.hp !== 'number') return;
      let st; try { st = rules.playerStats(o.data); } catch (e) { return; }
      list.push({ id: o.id, name: o.name, lv: o.data.level || 1, hp: Math.max(0, Math.round(o.hp)), max: st.maxHp, mp: Math.floor(o.mp || 0), mmax: st.maxMp, dead: o.hp <= 0, lead: p.party.leader === o.id, cls: o.data.prof ? o.data.prof.cls : '' });
    });
    p.hadFrame = true; C.send(p, { t: 'pframe', list });
  });
}

/* ---------- guild storage ---------- */
function bankRow(gid) {
  const r = API.db.get('SELECT data FROM guild_bank WHERE guild_id = ?', gid);
  let d = { items: [], log: [], taken: {} };
  if (r) { try { d = Object.assign(d, JSON.parse(r.data)); } catch (e) { /* keep default */ } }
  d.items = (d.items || []).map((x) => ({ item: items.validItem(x.item), by: String(x.by || '').slice(0, 24), at: x.at | 0 })).filter((x) => x.item).slice(0, BANK_CAP);
  d.log = (d.log || []).slice(-30); d.taken = d.taken || {};
  return d;
}
function bankSave(gid, d) { API.db.run('INSERT INTO guild_bank (guild_id, data) VALUES (?, ?) ON CONFLICT(guild_id) DO UPDATE SET data = excluded.data', gid, J(d)); }
function rankOf(p) { const r = p.gid && API.db.get('SELECT rank FROM guild_members WHERE user_id = ? AND guild_id = ?', p.id, p.gid); return r ? r.rank : -1; }
function bankInfo(p) {
  if (!p.gid) return C.send(p, { t: 'gbank', none: true });
  const d = bankRow(p.gid), rank = rankOf(p), t = d.taken[p.id];
  C.send(p, { t: 'gbank', items: d.items, log: d.log, rank, cap: BANK_CAP, left: rank >= 2 ? 999 : rank === 1 ? Math.max(0, OFFICER_DAILY - (t && t.day === day() ? t.n : 0)) : 0 });
}
const ops = {
  gbinfo(p) { bankInfo(p); },
  gbput(p, m) {
    if (!API.thr(p, 'gbput', 300)) return;
    if (!p.gid || rankOf(p) < 0) return sys(p, 'Bạn chưa ở trong bang hội.');
    const inv = p.data.inv, i = inv.findIndex((x) => x.id === String(m.id || '')); if (i < 0) return;
    const d = bankRow(p.gid); if (d.items.length >= BANK_CAP) return sys(p, 'Kho bang đã đầy (' + BANK_CAP + ').');
    const it = inv.splice(i, 1)[0];
    d.items.push({ item: it, by: p.name, at: now() }); d.log.push(day().slice(5) + ' ' + p.name + ' gửi ' + it.name); d.log = d.log.slice(-30);
    bankSave(p.gid, d); C.pushMe(p); if (C.saveNow) C.saveNow(p); bankInfo(p);
  },
  gbget(p, m) {
    if (!API.thr(p, 'gbget', 400)) return;
    const rank = rankOf(p); if (rank < 1) return sys(p, 'Chỉ phó bang và trưởng bang mới lấy được đồ từ kho bang.');
    const d = bankRow(p.gid), i = d.items.findIndex((x) => x.item.id === String(m.id || '')); if (i < 0) return;
    if (p.data.inv.length >= rules.INV_SIZE) return sys(p, 'Túi đồ đã đầy.');
    if (rank < 2) {
      const t = d.taken[p.id] && d.taken[p.id].day === day() ? d.taken[p.id] : { day: day(), n: 0 };
      if (t.n >= OFFICER_DAILY) return sys(p, 'Phó bang chỉ lấy tối đa ' + OFFICER_DAILY + ' món mỗi ngày.');
      t.n++; d.taken[p.id] = t;
    }
    const it = d.items.splice(i, 1)[0].item; p.data.inv.push(it);
    d.log.push(day().slice(5) + ' ' + p.name + ' lấy ' + it.name); d.log = d.log.slice(-30);
    bankSave(p.gid, d); C.pushMe(p); if (C.saveNow) C.saveNow(p); bankInfo(p);
  },
  /* voice */
  vcjoin(p, m) {
    if (!API.thr(p, 'vcjoin', 500)) return;
    leaveVoice(p);
    const key = m.room === 'guild' && p.gid ? 'g' + p.gid : m.room === 'party' && p.party ? 'p' + p.party.leader : null;
    if (!key) return sys(p, m.room === 'guild' ? 'Bạn chưa ở trong bang hội.' : 'Bạn chưa ở trong tổ đội.');
    const set = voice.get(key) || new Set(); if (set.size >= VOICE_MAX) return sys(p, 'Kênh thoại đã đủ ' + VOICE_MAX + ' người.');
    const peers = [...set].map((id) => C.online.get(id)).filter(Boolean).map((o) => ({ id: o.id, name: o.name }));
    set.add(p.id); voice.set(key, set); p.vc = key;
    C.send(p, { t: 'vc', st: 'joined', room: key, peers });
    peers.forEach((q) => C.send(C.online.get(q.id), { t: 'vc', st: 'peer', id: p.id, name: p.name }));
  },
  vcleave(p) { leaveVoice(p); C.send(p, { t: 'vc', st: 'left' }); },
  vcsig(p, m) {
    const to = C.online.get(Number(m.to)); if (!to || !p.vc || to.vc !== p.vc) return;
    p.vcN = (p.vcN | 0) + 1; if (p.vcN > 80) return; // flood guard, reset every second in tick
    const data = m.data; if (!data || typeof data !== 'object') return;
    const s = J(data); if (s.length > 12000) return;
    C.send(to, { t: 'vc', st: 'sig', from: p.id, data });
  }
};
const voice = new Map(); // room key -> Set(userId)
function leaveVoice(p) {
  const key = p.vc; if (!key) return; p.vc = null;
  const set = voice.get(key); if (!set) return;
  set.delete(p.id); if (!set.size) voice.delete(key);
  set.forEach((id) => { const o = C.online.get(id); if (o) C.send(o, { t: 'vc', st: 'gone', id: p.id }); });
}
function voiceTick() {
  C.online.forEach((p) => {
    p.vcN = 0;
    if (!p.vc) return;
    const ok = p.vc[0] === 'g' ? p.gid === Number(p.vc.slice(1)) : !!(p.party && p.party.leader === Number(p.vc.slice(1)));
    if (!ok) { leaveVoice(p); C.send(p, { t: 'vc', st: 'left' }); }
  });
}

function init(ctx, api) { C = ctx; API = api; API.db.exec('CREATE TABLE IF NOT EXISTS guild_bank (guild_id INTEGER PRIMARY KEY, data TEXT NOT NULL)'); }
function onConnect(p) { p.vc = null; p.hadFrame = false; }
function onLeave(p) { leaveVoice(p); }
let n = 0;
function tick() { n++; frame(); voiceTick(); }

module.exports = { init, onConnect, onLeave, tick, ops };
