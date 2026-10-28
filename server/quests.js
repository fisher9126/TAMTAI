'use strict';
/* Aetherfall step 6 (server plugin of zones.js): story and quests.
   Main story (prologue + 6 chapters), side quests, daily quests, dialogue choices that set flags (endings), titles and the bestiary.
   Quest data lives in public/js/story.js (shared with the browser). Progress is saved in table quest_player.
   Objective kinds: kill (type or '*'), talk (npc), have (hand in materials), visit (place), clears (dungeon wins since accepting), steles (ancient steles read), none. */
const story = require('../public/js/story.js');
let C = null, API = null;
const MAX_ACTIVE = 10, NEAR = 9;
const day = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

function blank() { return { done: [], act: {}, flags: {}, titles: [], title: '', bes: {}, daily: { day: day(), done: [] }, dirty: false }; }
function load(p) {
  const s = blank();
  try {
    const r = API.db.get('SELECT data FROM quest_player WHERE user_id = ?', p.id);
    if (r) {
      const d = JSON.parse(r.data);
      s.done = (d.done || []).filter((id) => story.byId[id]);
      Object.keys(d.act || {}).forEach((id) => { if (story.byId[id]) s.act[id] = { p: d.act[id].p | 0, b: d.act[id].b | 0 }; });
      Object.keys(d.flags || {}).forEach((k) => { s.flags[k] = d.flags[k] | 0; });
      s.titles = (d.titles || []).filter((t) => story.TITLES.includes(t)); s.title = s.titles.includes(d.title) ? d.title : '';
      Object.keys(d.bes || {}).forEach((k) => { if (API.rules.ENEMIES[k]) s.bes[k] = d.bes[k] | 0; });
      if (d.daily && d.daily.day === s.daily.day) s.daily.done = (d.daily.done || []).filter((id) => story.byId[id]);
    }
  } catch (err) { console.error('quests load', err.message); }
  p.qs = s;
}
function save(p) {
  if (!p.qs) return;
  const s = p.qs;
  API.db.run('INSERT INTO quest_player (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data', p.id, JSON.stringify({ done: s.done, act: s.act, flags: s.flags, titles: s.titles, title: s.title, bes: s.bes, daily: s.daily }));
  s.dirty = false;
}
function rollDay(s) { if (s.daily.day !== day()) { s.daily = { day: day(), done: [] }; s.dirty = true; } }

function prog(p, q) {
  const a = p.qs.act[q.id]; if (!a) return 0;
  switch (q.obj.k) {
    case 'none': return q.need;
    case 'have': return p.zn ? (p.zn.mats[q.obj.m] | 0) : 0;
    case 'clears': return p.zn ? Math.max(0, p.zn.dun.clears - a.b) : 0;
    case 'steles': return p.ex ? p.ex.st.length : 0;
    default: return a.p;
  }
}
const isReady = (p, q) => prog(p, q) >= q.need;
function doneNow(s, q) { return q.daily ? s.daily.done.includes(q.id) : s.done.includes(q.id); }
function available(p, q) {
  const s = p.qs; rollDay(s);
  if (s.act[q.id] || doneNow(s, q)) return false;
  if ((p.data.level || 1) < q.lv) return false;
  return q.pre.every((id) => s.done.includes(id));
}
function stateMsg(p) {
  const s = p.qs; rollDay(s);
  const act = Object.keys(s.act).map((id) => ({ id, p: Math.min(prog(p, story.byId[id]), story.byId[id].need) }));
  return { t: 'qstate', done: s.done, act, flags: s.flags, titles: s.titles, title: s.title, bes: s.bes, dailyDone: s.daily.done };
}
const send = (p) => { if (p.qs) API.C.send(p, stateMsg(p)); };
function near(p, npcId) { const n = story.NPCS[npcId]; return !!n && Math.hypot(p.x - n.x, p.z - n.z) <= NEAR; }
const notify = (p, text) => API.sys(p, text);

const ops = {
  qinfo(p) { send(p); },
  qtalk(p, m) {
    const id = String(m.npc || ''); if (!near(p, id)) return;
    const s = p.qs; let changed = false;
    Object.keys(s.act).forEach((qid) => { const q = story.byId[qid]; if (q.obj.k === 'talk' && q.obj.npc === id && !s.act[qid].p) { s.act[qid].p = 1; changed = true; notify(p, 'Nhiệm vụ "' + q.title + '": đã gặp ' + story.NPCS[id].name + '.'); } });
    if (changed) { s.dirty = true; }
    send(p); API.C.send(p, { t: 'qtalk', npc: id });
  },
  qaccept(p, m) {
    const q = story.byId[String(m.id || '')]; if (!q || !near(p, q.giver)) return;
    const s = p.qs;
    if (!available(p, q)) return notify(p, 'Chưa nhận được nhiệm vụ này.');
    if (Object.keys(s.act).length >= MAX_ACTIVE) return notify(p, 'Bạn đang làm quá nhiều nhiệm vụ (tối đa ' + MAX_ACTIVE + ').');
    s.act[q.id] = { p: 0, b: p.zn ? p.zn.dun.clears : 0 }; s.dirty = true;
    notify(p, 'Đã nhận nhiệm vụ: ' + q.title + '.'); send(p);
  },
  qabandon(p, m) {
    const id = String(m.id || ''); if (!p.qs.act[id]) return;
    delete p.qs.act[id]; p.qs.dirty = true; notify(p, 'Đã bỏ nhiệm vụ.'); send(p);
  },
  qtitle(p, m) {
    const t = String(m.title || '').slice(0, 40);
    if (t && !p.qs.titles.includes(t)) return;
    p.qs.title = t; p.qs.dirty = true; send(p);
  },
  qturn(p, m) {
    const q = story.byId[String(m.id || '')]; if (!q || !near(p, q.to)) return;
    if (!API.thr(p, 'qturn', 400)) return;
    const s = p.qs, d = p.data;
    if (!s.act[q.id]) return;
    if (!isReady(p, q)) return notify(p, 'Bạn chưa hoàn thành nhiệm vụ này.');
    let opt = null;
    if (q.choice) {
      opt = q.choice.opts[m.c | 0];
      if (!opt) return notify(p, 'Hãy chọn một đáp án.');
      if (opt.need === 'steles12' && !(p.ex && p.ex.st.length >= 12)) return notify(p, 'Lựa chọn này cần tìm đủ 12 bia đá cổ.');
    }
    const r = q.reward;
    if (r.item && d.inv.length >= API.rules.INV_SIZE) return notify(p, 'Túi đồ đã đầy, hãy dọn bớt trước khi nhận thưởng.');
    if (q.obj.k === 'have') { if (!p.zn || (p.zn.mats[q.obj.m] | 0) < q.need) return; p.zn.mats[q.obj.m] -= q.need; p.zn.dirty = true; }
    // rewards
    const lv = d.level || 1, sum = { exp: 0, gold: 0, items: [], mats: {}, potions: 0, titles: [], reply: opt ? opt.reply : '' };
    sum.exp = Math.round(API.rules.expNeed(lv) * (r.exp || 0));
    sum.gold = (r.gold || 0) + (opt && opt.gold ? opt.gold : 0);
    sum.potions = r.potions || 0;
    if (r.mats) Object.keys(r.mats).forEach((k) => { sum.mats[k] = r.mats[k]; });
    if (r.title) sum.titles.push(r.title);
    if (q.bonusFlag) {
      const bk = Object.keys(q.bonusFlag).find((k) => k !== 'gold' && k !== 'title'); // e.g. { orrin: 1, gold: 200 } = extra reward when that choice was made earlier
      if (bk && s.flags[bk] === q.bonusFlag[bk]) { sum.gold += q.bonusFlag.gold || 0; if (q.bonusFlag.title) sum.titles.push(q.bonusFlag.title); }
    }
    if (r.item) {
      const slot = r.item[0] === 'any' ? API.items.SLOTS[Math.floor(Math.random() * API.items.SLOTS.length)] : r.item[0];
      const it = API.items.makeItem(slot, r.item[1], Math.max(1, lv), null, p.prof && p.prof.cls); d.inv.push(it); sum.items.push(it);
    }
    d.gold += sum.gold; d.potions = Math.min(999, d.potions + sum.potions);
    if (p.zn && Object.keys(sum.mats).length) API.giveMats(p.zn, sum.mats);
    sum.titles.forEach((t) => { if (!s.titles.includes(t)) s.titles.push(t); });
    if (opt) s.flags[opt.flag] = opt.v;
    delete s.act[q.id];
    if (q.daily) s.daily.done.push(q.id); else s.done.push(q.id);
    s.dirty = true;
    const up = sum.exp ? C.addExp(p, sum.exp) : 0;
    C.pushMe(p);
    C.send(p, { t: 'qdone', id: q.id, title: q.title, exp: sum.exp, gold: sum.gold, potions: sum.potions, mats: sum.mats, items: sum.items.map((i) => i.name), titles: sum.titles, reply: sum.reply, lvUp: up ? d.level : null });
    if (q.id === 'c6d' && opt) C.broadcast({ t: 'announce', text: p.name + ' đã hoàn thành cốt truyện chính với kết thúc "' + story.ENDINGS[opt.v] + '"!' });
    send(p); API.info(p);
  }
};

function onKill(p, e) {
  const s = p.qs; if (!s) return;
  let changed = false;
  if (API.rules.ENEMIES[e.type]) { const first = !s.bes[e.type]; s.bes[e.type] = (s.bes[e.type] | 0) + 1; s.dirty = true; if (first) changed = true; }
  Object.keys(s.act).forEach((id) => {
    const q = story.byId[id];
    if (q.obj.k === 'kill' && (q.obj.type === '*' || q.obj.type === e.type) && s.act[id].p < q.need) {
      s.act[id].p++; s.dirty = true; changed = true;
      API.C.send(p, { t: 'qprog', id, p: s.act[id].p, need: q.need, title: q.title });
    }
  });
  if (changed) send(p);
}
function tick() {
  API.C.online.forEach((p) => {
    const s = p.qs; if (!s || p.dead) return;
    Object.keys(s.act).forEach((id) => {
      const q = story.byId[id];
      if (q.obj.k === 'visit' && !s.act[id].p && Math.hypot(p.x - q.obj.x, p.z - q.obj.z) <= q.obj.r) {
        s.act[id].p = 1; s.dirty = true; notify(p, 'Nhiệm vụ "' + q.title + '": đã tới ' + q.obj.name + '.'); API.C.send(p, { t: 'qprog', id, p: 1, need: 1, title: q.title }); send(p);
      }
    });
  });
  if (Date.now() % 15000 < 1000) API.C.online.forEach((p) => { if (p.qs && p.qs.dirty) save(p); });
}

function init(ctx, api) { C = ctx; API = api; API.db.exec('CREATE TABLE IF NOT EXISTS quest_player (user_id INTEGER PRIMARY KEY, data TEXT NOT NULL)'); }
function onConnect(p) { load(p); send(p); }
function onLeave(p) { try { save(p); } catch (err) { console.error('quests save', err.message); } }

module.exports = { init, onConnect, onLeave, onKill, tick, ops };
