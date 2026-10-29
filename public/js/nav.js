/* Aetherfall quest guidance (browser): where to go for each quest, a golden arrow on the ground that points there, a light beacon
   at the destination, step-by-step hints, and the "tracked" quest (the one the arrow follows).
   AF_NAV.target(entry) -> { x, z, label } · AF_NAV.steps(entry) -> [text] · AF_NAV.track(key) · AF_NAV.entries() -> main / side lists.
   An entry is either a story quest from story.js ({ kind: 'story', q }) or the village chief's quest line ({ kind: 'main' }).
   Purely a helper: it never changes quest progress. */
(function () {
  'use strict';
  const H = window.AF_CH, X = window.AF_CHX, RU = window.AF_RULES, ST = window.AF_STORY, T = window.THREE, G = window.AF_GFX;
  if (!H || !X || !RU || !T || !G) { console.warn('[nav] thiếu AF_CH, bỏ qua'); return; }
  const W = RU.WORLD, S = G.scene, R = H.R;
  const N = window.AF_NAV = { tracked: null, last: null };
  try { N.tracked = localStorage.getItem('af-track') || null; } catch (e) { /* ignore */ }

  /* ---------- where things are ---------- */
  const PLACE = {
    village: { x: 0, z: 4, name: 'Làng Ashford' }, forest: { x: W.FOREST.x, z: W.FOREST.z, name: 'Rừng Bóng Đèn' }, arena: { x: W.ARENA.x, z: W.ARENA.z, name: 'Đấu trường' },
    swamp: { x: W.SWAMP.x, z: W.SWAMP.z, name: 'Đầm Lầy Nấm Độc' }, mine: { x: W.MINE.x, z: W.MINE.z, name: 'Mỏ Quặng Gỉ Sét' }, frost: { x: W.FROST.x, z: W.FROST.z, name: 'Cánh Đồng Tủ Lạnh' },
    dungeon: { x: W.DUNGEON.x, z: W.DUNGEON.z, name: 'Hầm Ngục Tro Đen' }, wboss: { x: W.WBOSS.x, z: W.WBOSS.z, name: 'Bãi Tế Thần' }, desert: { x: W.DESERT.x, z: W.DESERT.z, name: 'Sa Mạc Huyết Thạch' },
    abyss: { x: W.ABYSS.x, z: W.ABYSS.z, name: 'Vực Thẳm Hư Không' }, fields: { x: 14, z: 24, name: 'Ruộng quanh làng' }, pond: { x: W.POND.x, z: W.POND.z, name: 'Hồ nước' }
  };
  const ENEMY_AT = { teieretta: 'fields', gufo: 'forest', boss: 'arena', fungo: 'swamp', ragno: 'swamp', sporo: 'swamp', talpa: 'mine', golem: 'mine', reQuang: 'mine', pinguino: 'frost', orso: 'frost', regina: 'frost',
    cinder: 'dungeon', ombra: 'dungeon', dboss: 'dungeon', wboss: 'wboss', scorpio: 'desert', mummia: 'desert', sethra: 'desert', demone: 'abyss', drago: 'abyss', vuoto: 'abyss', morvain: 'abyss' };
  const MAT_AT = { herb: ['node', 'herb', 'fields'], shroom: ['node', 'shroom', 'swamp'], frost: ['node', 'frost', 'frost'], ore: ['node', 'ore', 'mine'], coal: ['node', 'coal', 'mine'], gem: ['node', 'ore', 'mine'] };
  const near = (list) => { let b = null, bd = Infinity; list.forEach((p) => { const d = Math.hypot(p.x - R.x, p.z - R.z); if (d < bd) { bd = d; b = p; } }); return b; };
  function enemyPos(type) {
    const alive = [], all = [];
    X.enemyById.forEach((e) => { if (type !== '*' && e.type !== type) return; all.push(e); if (!e.dead) alive.push(e); });
    const e = near(alive.length ? alive : all);
    if (e) return { x: e.x, z: e.z };
    const p = PLACE[ENEMY_AT[type]]; return p ? { x: p.x, z: p.z } : null;
  }
  function matPos(m) {
    const spec = MAT_AT[m], Z = window.AF_ZONES;
    if (spec && Z && Z.nodes && Z.nodes.size) { const list = []; Z.nodes.forEach((n) => { if (n.type === spec[1]) list.push(n); }); const n = near(list.filter((x) => x.on).length ? list.filter((x) => x.on) : list); if (n) return { x: n.x, z: n.z, how: 'gather' }; }
    let best = null, bc = 0; Object.keys(RU.MAT_DROPS || {}).forEach((t) => (RU.MAT_DROPS[t] || []).forEach((d) => { if (d[0] === m && d[1] > bc && !(RU.ENEMIES[t] && (RU.ENEMIES[t].boss || RU.ENEMIES[t].elite))) { bc = d[1]; best = t; } }));
    if (best) { const p = enemyPos(best); if (p) return Object.assign(p, { how: 'kill', type: best }); }
    if (spec) { const p = PLACE[spec[2]]; return { x: p.x, z: p.z, how: 'gather' }; }
    return null;
  }
  const npcPos = (id) => (ST && ST.NPCS[id] ? { x: ST.NPCS[id].x, z: ST.NPCS[id].z } : null);
  const placeName = (x, z) => {
    for (const zz of RU.ZONES) if (Math.hypot(x - zz.x, z - zz.z) < zz.r + 4) return zz.name;
    let b = null, bd = Infinity; Object.keys(PLACE).forEach((k) => { const p = PLACE[k], d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; b = p; } }); return bd < 30 ? b.name : 'vùng hoang dã';
  };
  N.placeName = placeName;
  const ename = (t) => (t === '*' ? 'quái bất kỳ' : RU.ENEMIES[t] ? RU.ENEMIES[t].name : t);
  const mname = (m) => (RU.MATS[m] ? RU.MATS[m].name : m);
  const npcName = (id) => (ST && ST.NPCS[id] ? ST.NPCS[id].name : id);

  /* ---------- quest entries ---------- */
  const QS = () => window.AF_QUESTS && window.AF_QUESTS.st;
  const isMainId = (id) => /^(s|c)\d/.test(id);
  function entries() {
    const st = QS(), main = [], side = [], P = X.P;
    if (P && RU.QUESTS[P.quest] && RU.QUESTS[P.quest].need) main.push({ key: 'main', kind: 'main' });
    if (st && ST) {
      st.act.forEach((a) => { const q = ST.byId[a.id]; if (!q) return; (isMainId(q.id) ? main : side).push({ key: q.id, kind: 'story', q, a }); });
      /* the next story quest you can pick up, so the main line always shows where to go next */
      const plv = (P && P.level) || 1;
      const nextMain = ST.QUESTS.find((q) => isMainId(q.id) && !st.done.includes(q.id) && !st.act.find((a) => a.id === q.id) && q.pre.every((id) => st.done.includes(id)));
      if (nextMain) main.push({ key: 'n:' + nextMain.id, kind: 'offer', q: nextMain, locked: plv < nextMain.lv });
      ST.QUESTS.filter((q) => !isMainId(q.id) && !st.act.find((a) => a.id === q.id) && !(q.daily ? (st.dailyDone || []).includes(q.id) : st.done.includes(q.id)) && plv >= q.lv && q.pre.every((id) => st.done.includes(id)))
        .slice(0, 6).forEach((q) => side.push({ key: 'n:' + q.id, kind: 'offer', q }));
    }
    return { main, side };
  }
  N.entries = entries;
  function find(key) { const e = entries(); return e.main.concat(e.side).find((x) => x.key === key) || null; }
  N.find = find;
  const ready = (en) => en.kind === 'story' && en.a.p >= en.q.need && en.q.need > 0 || (en.kind === 'story' && en.q.obj.k === 'none');

  /* destination of an entry */
  function target(en) {
    if (!en) return null;
    if (en.kind === 'main') {
      const q = RU.QUESTS[X.P.quest]; if (!q || !q.type) return null;
      if (X.P.qcount >= q.need) return { x: 1.5, z: 5, label: 'Trưởng làng Hollis' };
      const p = enemyPos(q.type); return p ? Object.assign(p, { label: ename(q.type) }) : null;
    }
    const q = en.q;
    if (en.kind === 'offer') { const p = npcPos(q.giver); return p ? Object.assign(p, { label: npcName(q.giver) }) : null; }
    if (ready(en)) { const p = npcPos(q.to); return p ? Object.assign(p, { label: 'Giao cho ' + npcName(q.to) }) : null; }
    const o = q.obj;
    switch (o.k) {
      case 'kill': { const p = enemyPos(o.type); return p ? Object.assign(p, { label: ename(o.type) }) : null; }
      case 'have': { const p = matPos(o.m); return p ? Object.assign(p, { label: mname(o.m) }) : null; }
      case 'talk': { const p = npcPos(o.npc); return p ? Object.assign(p, { label: npcName(o.npc) }) : null; }
      case 'visit': return { x: o.x, z: o.z, label: o.name };
      case 'clears': return { x: W.DUNGEON.x, z: W.DUNGEON.z, label: 'Cổng Hầm Ngục' };
      case 'steles': { const E = window.AF_EXPLORE; if (E && E.steles) { const s = near(E.steles.filter((s) => !E.st.includes(s.id))); if (s) return { x: s.x, z: s.z, label: 'Bia đá cổ' }; } return null; }
      default: return null;
    }
  }
  N.target = target;
  /* MMORPG-style hints */
  function steps(en) {
    if (!en) return [];
    if (en.kind === 'main') {
      const q = RU.QUESTS[X.P.quest], done = X.P.qcount >= q.need, at = PLACE[ENEMY_AT[q.type]];
      return done ? ['Đã đủ. Quay về gặp Trưởng làng Hollis ở giữa làng (phím E khi đứng gần).']
        : ['Đi tới ' + (at ? at.name : 'khu vực có quái') + ' theo mũi tên vàng dưới chân.', 'Hạ ' + q.need + ' ' + ename(q.type) + ' (đã hạ ' + X.P.qcount + ').', 'Quay về gặp Trưởng làng Hollis để nhận thưởng.'];
    }
    const q = en.q, o = q.obj, need = Math.max(1, q.need), t = target(en), where = t ? placeName(t.x, t.z) : '';
    if (en.kind === 'offer') return [(en.locked ? 'Cần đạt cấp ' + q.lv + '. ' : '') + 'Đến gặp ' + npcName(q.giver) + ' ở ' + placeName(npcPos(q.giver).x, npcPos(q.giver).z) + '.', 'Nhấn E khi đứng gần để nói chuyện và nhận nhiệm vụ.'];
    if (ready(en)) return ['Đã xong mục tiêu.', 'Quay về gặp ' + npcName(q.to) + ' (' + placeName(npcPos(q.to).x, npcPos(q.to).z) + ') và nhấn E để nhận thưởng.'];
    const prog = en.a ? Math.min(en.a.p, need) : 0, list = [];
    switch (o.k) {
      case 'kill': list.push('Đi tới ' + (o.type === '*' ? 'bất kỳ khu săn nào' : where) + ' theo mũi tên vàng.', 'Hạ ' + need + ' ' + ename(o.type) + ' (' + prog + '/' + need + ').'); break;
      case 'have': { const mp = matPos(o.m); list.push(mp && mp.how === 'gather' ? 'Tới ' + where + ', đứng cạnh điểm khai thác và nhấn E để thu thập ' + mname(o.m) + '.' : 'Hạ ' + (mp && mp.type ? ename(mp.type) : 'quái') + ' ở ' + where + ' để lấy ' + mname(o.m) + '.', 'Cần ' + need + ' ' + mname(o.m) + ' trong kho nguyên liệu (bảng Nghề, phím P).'); break; }
      case 'talk': list.push('Tìm ' + npcName(o.npc) + ' ở ' + where + ' và nhấn E để nói chuyện.'); break;
      case 'visit': list.push('Đi tới ' + o.name + ' theo mũi tên vàng.', 'Chỉ cần bước vào khu vực là hoàn thành.'); break;
      case 'clears': list.push('Đi tới cổng Hầm Ngục Tro Đen (phía Nam làng).', 'Thắng hầm ngục ' + need + ' lần (' + prog + '/' + need + '). Rủ thêm đồng đội sẽ dễ hơn.'); break;
      case 'steles': list.push('Tìm và đọc bia đá cổ (nhấn E khi đứng gần).', 'Đã đọc ' + prog + '/' + need + '. Mở bản đồ (M) để xem bia đã tìm.'); break;
      default: list.push('Nói chuyện với ' + npcName(q.to) + '.');
    }
    list.push('Xong thì quay về gặp ' + npcName(q.to) + ' để nhận thưởng.');
    return list;
  }
  N.steps = steps;
  N.track = function (key) { N.tracked = key; try { localStorage.setItem('af-track', key || ''); } catch (e) { /* ignore */ } };
  function current() {
    const e = entries(), all = e.main.concat(e.side);
    let en = N.tracked ? all.find((x) => x.key === N.tracked) : null;
    if (!en && N.tracked && N.tracked.indexOf('n:') !== 0) en = all.find((x) => x.key === 'n:' + N.tracked) || null;
    if (!en) en = e.main.find((x) => x.kind !== 'offer' || !x.locked) || e.side.find((x) => x.kind === 'story') || null;
    return en;
  }
  N.current = current;
  /* a quest that was just accepted becomes the tracked one */
  let known = null;
  setInterval(() => {
    const st = QS(); if (!st) return; const ids = st.act.map((a) => a.id);
    if (known) { const fresh = ids.find((id) => !known.includes(id)); if (fresh) { N.track(fresh); H.toast('Đang theo dõi: <b>' + (ST.byId[fresh] ? ST.byId[fresh].title : fresh) + '</b> · đi theo mũi tên vàng'); } }
    known = ids;
  }, 500);

  /* ---------- the arrow, the beacon and the off-screen pointer ---------- */
  const arrowG = new T.Group(), mat = new T.MeshBasicMaterial({ color: 0xffd25a, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false });
  const shape = new T.Shape(); shape.moveTo(0, 1.1); shape.lineTo(0.62, 0.25); shape.lineTo(0.24, 0.25); shape.lineTo(0.24, -0.55); shape.lineTo(-0.24, -0.55); shape.lineTo(-0.24, 0.25); shape.lineTo(-0.62, 0.25); shape.closePath();
  mat.side = T.DoubleSide; const arrow = new T.Mesh(new T.ShapeGeometry(shape), mat); arrow.rotation.x = Math.PI / 2; /* shape tip (+Y) -> +Z, the group then turns to the target */ arrow.renderOrder = 998; arrowG.add(arrow);
  const edge = new T.Mesh(new T.ShapeGeometry(shape), new T.MeshBasicMaterial({ color: 0x5a3a08, transparent: true, opacity: 0.7, depthTest: false, depthWrite: false, side: T.DoubleSide })); edge.rotation.x = Math.PI / 2; edge.scale.setScalar(1.18); edge.position.y = -0.01; edge.renderOrder = 997; arrowG.add(edge);
  arrowG.visible = false; S.add(arrowG);
  const beacon = new T.Group();
  const bc = new T.Mesh(new T.CylinderGeometry(0.5, 0.9, 40, 16, 1, true), new T.MeshBasicMaterial({ color: 0xffd25a, transparent: true, opacity: 0.22, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide })); bc.position.y = 20; beacon.add(bc);
  const bring = new T.Mesh(new T.RingGeometry(1.2, 1.6, 40), new T.MeshBasicMaterial({ color: 0xffd25a, transparent: true, opacity: 0.6, depthWrite: false, side: T.DoubleSide })); bring.rotation.x = -Math.PI / 2; bring.position.y = 0.1; beacon.add(bring);
  beacon.visible = false; S.add(beacon);
  const css = document.createElement('style');
  css.textContent = '#afNavTag{position:fixed;z-index:25;pointer-events:none;transform:translate(-50%,-50%);padding:3px 9px;border-radius:999px;background:rgba(20,14,6,.85);border:1px solid #ffd25a;color:#ffe9a8;font:700 12px system-ui,sans-serif;white-space:nowrap;text-shadow:0 1px 2px #000}#afNavTag[hidden]{display:none}#afNavTag i{font-style:normal;color:#ffd25a;margin-right:4px}';
  document.head.appendChild(css);
  const tag = document.createElement('div'); tag.id = 'afNavTag'; tag.hidden = true; document.body.appendChild(tag);
  const v = new T.Vector3();
  let tgt = null, tgtT = 0, tt = 0;
  function frame() {
    requestAnimationFrame(frame);
    const on = H.isRunning() && R.alive;
    tt += 0.016;
    if (on && performance.now() - tgtT > 400) { tgtT = performance.now(); const en = current(); N.last = en; tgt = en ? target(en) : null; }
    if (!on || !tgt) { arrowG.visible = false; beacon.visible = false; tag.hidden = true; return; }
    const dx = tgt.x - R.x, dz = tgt.z - R.z, d = Math.hypot(dx, dz), y = H.heightAt(R.x, R.z);
    const a = Math.atan2(dx, dz), pulse = 2.2 + Math.sin(tt * 5) * 0.18;
    arrowG.visible = d > 4; arrowG.position.set(R.x + Math.sin(a) * pulse, y + 0.15, R.z + Math.cos(a) * pulse); arrowG.rotation.y = a;
    mat.opacity = 0.75 + Math.sin(tt * 5) * 0.2;
    beacon.visible = d < 140; beacon.position.set(tgt.x, H.heightAt(tgt.x, tgt.z), tgt.z); bring.scale.setScalar(1 + (tt * 0.6 % 1)); bring.material.opacity = 0.6 * (1 - (tt * 0.6 % 1));
    /* label over the destination, or at the screen edge when it is off screen */
    v.set(tgt.x, H.heightAt(tgt.x, tgt.z) + 3, tgt.z).project(G.camera);
    let sx = (v.x + 1) / 2 * innerWidth, sy = (1 - v.y) / 2 * innerHeight; const off = v.z > 1 || sx < 40 || sx > innerWidth - 40 || sy < 80 || sy > innerHeight - 140;
    if (off) { const cx = innerWidth / 2, cy = innerHeight / 2, ang = Math.atan2((v.z > 1 ? -1 : 1) * (sy - cy), (v.z > 1 ? -1 : 1) * (sx - cx)); const rx = innerWidth / 2 - 110, ry = innerHeight / 2 - 130, k = Math.min(rx / Math.abs(Math.cos(ang) || 1e-3), ry / Math.abs(Math.sin(ang) || 1e-3)); sx = cx + Math.cos(ang) * k; sy = cy + Math.sin(ang) * k; }
    tag.hidden = d < 3; tag.style.left = sx + 'px'; tag.style.top = sy + 'px';
    const txt = (off ? '➤ ' : '') + tgt.label + ' · ' + Math.round(d) + 'm';
    if (tag.dataset.t !== txt) { tag.dataset.t = txt; tag.innerHTML = '<i>◆</i>' + H.esc(txt); }
  }
  requestAnimationFrame(frame);
})();
