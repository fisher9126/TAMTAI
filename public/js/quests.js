/* Aetherfall step 6 (browser): story NPCs standing in the world, dialogue with choices, quest tracker, journal (N), titles, bestiary.
   Data comes from public/js/story.js (AF_STORY); progress comes from the server (qstate). Talk to an NPC with E. */
(function () {
  'use strict';
  const H = window.AF_CH, X = window.AF_CHX, RU = window.AF_RULES, ST = window.AF_STORY, THREE = window.THREE;
  if (!H || !X || !RU || !ST || !THREE) { console.warn('[quests] thiếu AF_CH/AF_CHX/AF_STORY, bỏ qua (hãy thêm story.js trước quests.js trong index.html)'); return; }
  const esc = H.esc, send = (m) => H.NET.send(m), S = X.scene;
  const Q = { st: { done: [], act: [], flags: {}, titles: [], title: '', bes: {}, dailyDone: [] }, open: false, tab: 'act', npc: null, dlg: false };
  window.AF_QUESTS = Q;
  const num = (n) => Number(n || 0).toLocaleString('vi-VN');
  const plv = () => (X.P && X.P.level) || 1;
  const byId = ST.byId, actOf = (id) => Q.st.act.find((a) => a.id === id);
  const isDone = (q) => (q.daily ? Q.st.dailyDone.includes(q.id) : Q.st.done.includes(q.id));
  const isReady = (q) => { const a = actOf(q.id); return !!a && a.p >= q.need; };
  const isAvail = (q) => !actOf(q.id) && !isDone(q) && plv() >= q.lv && q.pre.every((id) => Q.st.done.includes(id));
  const objText = (q) => {
    const o = q.obj;
    switch (o.k) {
      case 'kill': return 'Hạ ' + (o.type === '*' ? 'quái bất kỳ' : (RU.ENEMIES[o.type] ? RU.ENEMIES[o.type].name : o.type));
      case 'have': return 'Mang ' + (RU.MATS[o.m] ? RU.MATS[o.m].name : o.m);
      case 'talk': return 'Gặp ' + (ST.NPCS[o.npc] ? ST.NPCS[o.npc].name : o.npc);
      case 'visit': return 'Đi tới ' + o.name;
      case 'clears': return 'Thắng hầm ngục Tro Đen';
      case 'steles': return 'Đọc bia đá cổ';
      default: return 'Nói chuyện để hoàn thành';
    }
  };
  const progText = (q) => { const a = actOf(q.id), need = Math.max(1, q.need); return q.obj.k === 'none' ? 'Sẵn sàng' : (a ? Math.min(a.p, need) : 0) + '/' + need; };

  /* ---------- NPC figures (simple primitives so nothing depends on the player model) ---------- */
  const npcs = {}; // id -> { g, mark, x, z }
  function label(text, color, w) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d');
    g.font = '700 40px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(text, 256, 48); g.fillStyle = color; g.fillText(text, 256, 48);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, depthTest: false })); sp.scale.set(w || 4.4, (w || 4.4) * 0.1875, 1); sp.renderOrder = 5; return sp;
  }
  const NPC_LOOK = { 0xf2a6c0: [0xf2c9a0, 0x8a3a22], 0x8ec5f2: [0xf6dcc4, 0xe8e0d0], 0xc48a52: [0xe6b48a, 0xb5403f], 0xd9d9e6: [0xe6b48a, 0x1f1a17], 0x7ddc8f: [0xc98f62, 0x3a2a1a], 0xffd95a: [0xf2c9a0, 0x5a3a22], 0xb48cff: [0xe6b48a, 0xdadada], 0x9a8f7a: [0xc98f62, 0x4a3626], 0x6a9a5a: [0x7fae5a, 0x1f1a17] };
  function figure(color) {
    if (X && X.buildHumanoid) {
      try {
        const lk = NPC_LOOK[color] || [0xf2c9a0, 0x4a3626];
        const Hm = X.buildHumanoid({ skin: lk[0], shirt: color, pants: 0x3a3348, hair: lk[1], beard: color === 0xc48a52 || color === 0xb48cff });
        Hm.legs.forEach((l) => { l.rotation.x = 0; }); Hm.arms[0].rotation.z = 0.12; Hm.arms[1].rotation.z = -0.12;
        Hm.root.userData.afNpc = true; return Hm.root;
      } catch (err) { console.warn('[quests] figure fallback', err); }
    }
    const g = new THREE.Group(), M = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 1.0, 8), M(color)); body.position.y = 1.15; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), M(0xf2c9a0)); head.position.y = 1.9; g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.31, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(0x4a3626)); hair.position.y = 1.97; g.add(hair);
    [-0.22, 0.22].forEach((dx) => { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.24), M(0x3a3348)); leg.position.set(dx, 0.35, 0); g.add(leg); const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.8, 0.16), M(color)); arm.position.set(dx * 2.1, 1.2, 0); g.add(arm); });
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  function buildNpcs() {
    Object.keys(ST.NPCS).forEach((id) => {
      if (npcs[id]) return;
      const n = ST.NPCS[id], g = figure(n.color), y = H.heightAt(n.x, n.z);
      g.position.set(n.x, y, n.z); g.rotation.y = Math.atan2(-n.x, -n.z);
      const nm = label(n.name, '#ffe9a8'); nm.position.set(0, 3.0, 0); g.add(nm);
      const mark = label('', '#ffd95a', 1.4); mark.position.set(0, 3.7, 0); g.add(mark);
      S.add(g); npcs[id] = { g, mark, x: n.x, z: n.z, last: '' };
    });
  }
  function setMark(sp, text, color) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d');
    g.font = '800 110px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 12; g.strokeStyle = 'rgba(0,0,0,.8)'; g.strokeText(text, 64, 70); g.fillStyle = color; g.fillText(text, 64, 70);
    if (sp.material.map) sp.material.map.dispose(); sp.material.map = new THREE.CanvasTexture(c); sp.material.needsUpdate = true; sp.scale.set(1.3, 1.3, 1);
  }
  function refreshMarks() {
    Object.keys(npcs).forEach((id) => {
      const qs = ST.QUESTS; let m = '';
      if (qs.some((q) => q.to === id && isReady(q))) m = '?'; else if (qs.some((q) => q.giver === id && isAvail(q))) m = '!';
      if (m !== npcs[id].last) { npcs[id].last = m; npcs[id].mark.visible = !!m; if (m) setMark(npcs[id].mark, m, m === '?' ? '#8ef0d0' : '#ffd95a'); }
    });
  }

  /* ---------- UI ---------- */
  const css = document.createElement('style');
  css.textContent = `
  #afQP{position:fixed;left:50%;bottom:230px;transform:translateX(-50%);z-index:30;padding:6px 14px;border-radius:999px;background:rgba(13,18,31,.9);border:2px solid #ffd95a;color:#f1ebde;font:600 13px system-ui,sans-serif;pointer-events:none}
  #afQT{position:fixed;right:12px;top:44px;z-index:20;width:230px;padding:8px 10px;border-radius:10px;background:rgba(13,18,31,.78);color:#f1ebde;font:12px/1.4 system-ui,sans-serif;pointer-events:none}
  #afQT b{color:#ffd95a}#afQT .r{color:#8ef0d0}
  #afQB{position:fixed;left:10px;top:calc(46% - 132px);z-index:40;border:2px solid #241a05;background:#ffd0a0;color:#241a05;font:700 13px system-ui,sans-serif;padding:8px 12px;border-radius:12px;cursor:pointer;box-shadow:0 3px 0 #241a05}
  #afQD,#afQJ{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:57;width:min(96vw,560px);max-height:84vh;overflow:auto;box-sizing:border-box;padding:14px 16px;background:rgba(18,26,52,.97);color:#eef3ff;border:3px solid #241a05;border-radius:16px;box-shadow:0 10px 0 rgba(0,0,0,.35);font:13px/1.5 system-ui,sans-serif}
  .afq-row{padding:8px 10px;border-radius:9px;background:rgba(255,255,255,.06);margin:6px 0}
  .afq-mut{color:#aab6d8}.afq-h{font-size:12px;letter-spacing:.06em;color:#ffd96a;margin:12px 0 4px}
  .afq-btn{background:#f0bf4c;color:#241a05;border:2px solid #241a05;border-radius:10px;padding:5px 11px;font:700 12px system-ui,sans-serif;cursor:pointer;margin:3px 4px 3px 0}
  .afq-btn.g{background:#e9edf8}.afq-btn.on{background:#fff3c4;box-shadow:0 0 0 2px #f0bf4c}.afq-btn[disabled]{opacity:.4;cursor:default}
  #afQP[hidden],#afQT[hidden],#afQB[hidden],#afQD[hidden],#afQJ[hidden]{display:none}`;
  document.head.appendChild(css);
  const prompt = document.createElement('div'); prompt.id = 'afQP'; prompt.hidden = true;
  const track = document.createElement('div'); track.id = 'afQT'; track.hidden = true;
  const btn = document.createElement('button'); btn.id = 'afQB'; btn.type = 'button'; btn.textContent = 'Nhiệm vụ (N)'; btn.hidden = true;
  const dlg = document.createElement('div'); dlg.id = 'afQD'; dlg.hidden = true;
  const jr = document.createElement('div'); jr.id = 'afQJ'; jr.hidden = true;
  document.body.append(prompt, track, btn, dlg, jr);
  [dlg, jr, btn].forEach((el) => ['keydown', 'keyup', 'pointerdown', 'mousedown'].forEach((ev) => el.addEventListener(ev, (e) => e.stopPropagation())));

  function rewardText(q) {
    const r = q.reward, bits = [];
    if (r.exp) bits.push('EXP ~' + num(Math.round(RU.expNeed(Math.max(plv(), q.lv)) * r.exp)));
    if (r.gold) bits.push(num(r.gold) + ' vàng'); if (r.potions) bits.push(r.potions + ' bình máu');
    if (r.mats) bits.push(Object.keys(r.mats).map((k) => r.mats[k] + ' ' + RU.MATS[k].name).join(', '));
    if (r.item) bits.push('trang bị ' + window.AF_ITEMS.RNAME[r.item[1]]); if (r.title) bits.push('danh hiệu "' + r.title + '"');
    return bits.join(' · ');
  }
  function renderDlg() {
    const id = Q.npc; if (!id || !Q.dlg) return;
    const n = ST.NPCS[id]; let h = '<div class="afq-row" style="display:flex;justify-content:space-between;align-items:center"><span><b style="font-size:17px">' + esc(n.name) + '</b><br><small class="afq-mut">' + esc(n.title) + '</small></span><button class="afq-btn g" data-a="close">Đóng</button></div>';
    const ready = ST.QUESTS.filter((q) => q.to === id && isReady(q)), avail = ST.QUESTS.filter((q) => q.giver === id && isAvail(q)).slice(0, 4), going = ST.QUESTS.filter((q) => (q.to === id || q.giver === id) && actOf(q.id) && !isReady(q));
    ready.forEach((q) => {
      h += '<div class="afq-row"><b>' + esc(q.title) + '</b> <span class="afq-mut">· hoàn thành</span><br>' + esc(q.done) + '<br><small class="afq-mut">Thưởng: ' + esc(rewardText(q)) + '</small>';
      if (q.choice) { h += '<div style="margin-top:6px"><i>' + esc(q.choice.q) + '</i></div>' + q.choice.opts.map((o, i) => '<button class="afq-btn" data-a="turn" data-id="' + q.id + '" data-c="' + i + '">' + esc(o.t) + '</button>').join(''); }
      else h += '<div><button class="afq-btn" data-a="turn" data-id="' + q.id + '" data-c="0">Nhận thưởng</button></div>';
      h += '</div>';
    });
    avail.forEach((q) => { h += '<div class="afq-row"><b>' + esc(q.title) + '</b> <span class="afq-mut">· ' + esc(q.ch) + ' · cấp ' + q.lv + '</span><br>' + esc(q.offer) + '<br><small class="afq-mut">Việc cần làm: ' + esc(objText(q)) + (q.need > 1 ? ' x' + q.need : '') + ' · Thưởng: ' + esc(rewardText(q)) + '</small><div><button class="afq-btn" data-a="accept" data-id="' + q.id + '">Nhận nhiệm vụ</button></div></div>'; });
    going.forEach((q) => { h += '<div class="afq-row"><b>' + esc(q.title) + '</b> <span class="afq-mut">· đang làm ' + progText(q) + '</span><br><small class="afq-mut">' + esc(objText(q)) + (q.need > 1 ? ' x' + q.need : '') + '</small></div>'; });
    if (!ready.length && !avail.length && !going.length) h += '<div class="afq-row afq-mut">' + esc(n.name) + ' gật đầu chào bạn. "Hiện giờ tôi chưa có việc cần nhờ. Hãy quay lại khi bạn mạnh hơn hoặc đã làm xong việc trước đó."</div>';
    dlg.innerHTML = h;
  }
  dlg.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const a = b.dataset.a;
    if (a === 'close') { Q.dlg = false; dlg.hidden = true; }
    else if (a === 'accept') send({ t: 'zone', op: 'qaccept', id: b.dataset.id });
    else if (a === 'turn') send({ t: 'zone', op: 'qturn', id: b.dataset.id, c: Number(b.dataset.c) });
  });

  function renderJournal() {
    if (!Q.open) return;
    const tabs = [['act', 'Đang làm'], ['story', 'Cốt truyện'], ['title', 'Danh hiệu'], ['bes', 'Sổ quái vật']];
    let h = '<div class="afq-row" style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:17px">Nhật ký</b><button class="afq-btn g" data-a="x">Đóng (N)</button></div>';
    h += '<div>' + tabs.map((t) => '<button class="afq-btn' + (Q.tab === t[0] ? ' on' : '') + '" data-a="tab" data-v="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>';
    if (Q.tab === 'act') {
      h += Q.st.act.length ? Q.st.act.map((a) => { const q = byId[a.id]; return '<div class="afq-row"><b>' + esc(q.title) + '</b> <span class="afq-mut">· ' + esc(q.ch) + '</span> <span style="float:right;color:' + (a.p >= q.need ? '#8ef0d0' : '#ffd95a') + '">' + progText(q) + '</span><br><small class="afq-mut">' + esc(objText(q)) + (q.need > 1 ? ' x' + q.need : '') + ' · giao cho ' + esc(ST.NPCS[q.to].name) + '</small> <button class="afq-btn g" data-a="drop" data-id="' + q.id + '" style="float:right">Bỏ</button></div>'; }).join('') : '<div class="afq-row afq-mut">Chưa nhận nhiệm vụ nào. Hãy nói chuyện với người có dấu <b>!</b> trên đầu (phím E).</div>';
    } else if (Q.tab === 'story') {
      const main = ST.QUESTS.filter((q) => /^(s|c)\d/.test(q.id)); let last = '';
      h += '<div class="afq-mut" style="margin:6px 0">Đã xong ' + main.filter((q) => Q.st.done.includes(q.id)).length + '/' + main.length + ' nhiệm vụ chính' + (Q.st.flags.ending ? ' · Kết thúc: ' + ST.ENDINGS[Q.st.flags.ending] : '') + '</div>';
      main.forEach((q) => { if (q.ch !== last) { last = q.ch; h += '<div class="afq-h">' + esc(q.ch.toUpperCase()) + '</div>'; } const d = Q.st.done.includes(q.id), a = !!actOf(q.id); h += '<div class="afq-mut" style="padding:2px 4px">' + (d ? '✔ ' : a ? '▶ ' : '○ ') + esc(q.title) + '</div>'; });
    } else if (Q.tab === 'title') {
      h += '<div class="afq-mut" style="margin:6px 0">Danh hiệu nhận từ nhiệm vụ. Danh hiệu đang chọn hiện trong nhật ký và thông báo của bạn.</div>';
      h += Q.st.titles.length ? Q.st.titles.map((t) => '<button class="afq-btn' + (Q.st.title === t ? ' on' : ' g') + '" data-a="title" data-v="' + esc(t) + '">' + esc(t) + '</button>').join('') : '<div class="afq-row afq-mut">Chưa có danh hiệu nào.</div>';
      if (Q.st.title) h += '<div><button class="afq-btn g" data-a="title" data-v="">Bỏ danh hiệu</button></div>';
    } else {
      const keys = Object.keys(RU.ENEMIES); const seen = keys.filter((k) => Q.st.bes[k]).length;
      h += '<div class="afq-mut" style="margin:6px 0">Đã gặp ' + seen + '/' + keys.length + ' loài</div>';
      h += keys.map((k) => {
        const e = RU.ENEMIES[k], n = Q.st.bes[k] | 0; if (!n) return '<div class="afq-row afq-mut">??? · chưa gặp</div>';
        const drops = (RU.MAT_DROPS[k] || []).map((d) => RU.MATS[d[0]] ? RU.MATS[d[0]].name : d[0]).join(', ');
        return '<div class="afq-row"><b>' + esc(e.name) + '</b> <span class="afq-mut">· cấp ' + e.lv[0] + (e.lv[1] !== e.lv[0] ? '-' + e.lv[1] : '') + ' · đã hạ ' + n + '</span><br><small class="afq-mut">Máu ' + num(e.hp) + ' · Sức đánh ' + e.atk + (e.boss ? ' · Boss' : e.elite ? ' · Tinh anh' : '') + (drops ? '<br>Rơi: ' + esc(drops) : '') + '</small></div>';
      }).join('');
    }
    jr.innerHTML = h;
  }
  jr.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
    if (a === 'x') toggle(false); else if (a === 'tab') { Q.tab = b.dataset.v; renderJournal(); }
    else if (a === 'drop') { if (confirm('Bỏ nhiệm vụ này? Tiến độ sẽ mất.')) send({ t: 'zone', op: 'qabandon', id: b.dataset.id }); }
    else if (a === 'title') send({ t: 'zone', op: 'qtitle', title: b.dataset.v });
  });
  function toggle(v) { Q.open = v === undefined ? !Q.open : v; jr.hidden = !Q.open; if (Q.open) { send({ t: 'zone', op: 'qinfo' }); renderJournal(); } }
  btn.addEventListener('click', () => toggle());

  function renderTracker() {
    const on = H.isRunning() && Q.st.act.length > 0 && !(window.AF_CLASS && window.AF_CLASS.creating); track.hidden = !on; if (!on) return;
    track.innerHTML = '<b>Nhiệm vụ</b>' + Q.st.act.slice(0, 4).map((a) => { const q = byId[a.id], ok = a.p >= q.need; return '<div class="' + (ok ? 'r' : '') + '">' + esc(q.title) + ' <span style="float:right">' + (ok ? 'Giao ' + esc(ST.NPCS[q.to].name) : progText(q)) + '</span></div>'; }).join('');
  }

  /* ---------- interaction ---------- */
  let near = null;
  setInterval(() => {
    const on = H.isRunning() && H.R.alive && !(window.AF_CLASS && window.AF_CLASS.creating);
    btn.hidden = !on; renderTracker();
    near = null; if (on) { let bd = 4.6; Object.keys(npcs).forEach((id) => { const d = Math.hypot(npcs[id].x - H.R.x, npcs[id].z - H.R.z); if (d < bd) { bd = d; near = id; } }); }
    prompt.hidden = !near || Q.dlg; if (near) prompt.textContent = 'Nhấn E: nói chuyện với ' + ST.NPCS[near].name;
    if (Q.dlg && Q.npc && Math.hypot(npcs[Q.npc].x - H.R.x, npcs[Q.npc].z - H.R.z) > 9) { Q.dlg = false; dlg.hidden = true; }
  }, 200);
  window.addEventListener('keydown', (e) => {
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (!H.isRunning() || e.ctrlKey || e.metaKey || e.altKey || e.repeat || (window.AF_CLASS && window.AF_CLASS.creating)) return;
    const k = (e.code || '').indexOf('Key') === 0 ? e.code.slice(3).toLowerCase() : String(e.key).toLowerCase();
    if (k === 'n') toggle(); else if (k === 'e' && near && !Q.dlg) send({ t: 'zone', op: 'qtalk', npc: near });
  });
  setTimeout(buildNpcs, 600);

  /* ---------- server messages ---------- */
  Q.onNet = function (m) {
    switch (m.t) {
      case 'qstate': Q.st = { done: m.done || [], act: m.act || [], flags: m.flags || {}, titles: m.titles || [], title: m.title || '', bes: m.bes || {}, dailyDone: m.dailyDone || [] }; buildNpcs(); refreshMarks(); renderTracker(); renderDlg(); renderJournal(); return true;
      case 'qtalk': Q.npc = m.npc; Q.dlg = true; dlg.hidden = false; renderDlg(); return true;
      case 'qprog': H.toast('<b>' + esc(m.title) + '</b>: ' + m.p + '/' + m.need); return true;
      case 'qdone': {
        const bits = []; if (m.exp) bits.push(num(m.exp) + ' EXP'); if (m.gold) bits.push(num(m.gold) + ' vàng'); if (m.potions) bits.push(m.potions + ' bình máu');
        Object.keys(m.mats || {}).forEach((k) => bits.push(m.mats[k] + ' ' + (RU.MATS[k] ? RU.MATS[k].name : k))); (m.items || []).forEach((i) => bits.push(i));
        H.toast('Hoàn thành <b>' + esc(m.title) + '</b>', true); H.chatLine('sys', 'Nhận: ' + esc(bits.join(', ')) + (m.reply ? '<br><i>' + esc(m.reply) + '</i>' : ''));
        (m.titles || []).forEach((t) => H.toast('Danh hiệu mới: <b>' + esc(t) + '</b>', true));
        if (m.lvUp) H.toast('Lên cấp <b>' + m.lvUp + '</b>!', true);
        return true; }
      default: return false;
    }
  };
})();
