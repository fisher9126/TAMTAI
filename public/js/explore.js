/* Aetherfall step 5 (browser): day/night sky, weather, map with fog of war (M), waypoints + fast travel, lookouts, ancient steles, falling-star
   shards. Reads AF_CH / AF_CHX / THREE like zones.js. The server decides what is unlocked; this file only draws and sends requests. */
(function () {
  'use strict';
  const H = window.AF_CH, X = window.AF_CHX, RU = window.AF_RULES, THREE = window.THREE;
  if (!H || !X || !RU || !THREE || !RU.ZONES) { console.warn('[explore] thiếu AF_CH/AF_CHX/AF_RULES.ZONES, bỏ qua'); return; }
  const esc = H.esc, send = (m) => H.NET.send(m), S = X.scene, W = RU.WORLD;
  const E = { wp: [], lk: [], st: [], wps: [], looks: [], steles: [], fog: new Array(27).fill(0), pct: 0, weather: { w: 'clear' }, off: 0, rev: null, open: false };
  window.AF_EXPLORE = E;
  const M = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85, flatShading: true }, o || {}));
  function label(text, color, w) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d');
    g.font = '700 38px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(text, 256, 48); g.fillStyle = color; g.fillText(text, 256, 48);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })); sp.scale.set(w || 7, (w || 7) * 0.1875, 1); return sp;
  }

  /* ---------- sky: lights, background and fog follow the hour; weather darkens and adds particles ---------- */
  const base = { bg: null, fog: null, lights: [] };
  function captureBase() {
    if (base.ready) return; base.ready = true;
    if (S.background && S.background.isColor) base.bg = S.background.clone();
    if (S.fog) base.fog = { c: S.fog.color.clone(), near: S.fog.near, far: S.fog.far, den: S.fog.density };
    S.traverse((o) => { if (o.isLight && !o.userData.afSky) base.lights.push({ o, i: o.intensity, c: o.color.clone() }); });
  }
  const NIGHT = new THREE.Color(0x0b1230), DUSK = new THREE.Color(0xff9a5a), TMP = new THREE.Color();
  /* hour 0..24 from the shared clock: 1 real hour = 1 game day, hour 12 = noon */
  const hourNow = () => (((Date.now() + E.off) % 3600000) / 3600000) * 24;
  const daylight = (h) => Math.max(0, Math.min(1, 0.5 + Math.sin(((h - 6) / 24) * Math.PI * 2) * 0.75));
  E.hour = hourNow; E.isNight = () => daylight(hourNow()) < 0.3;
  const WX = { clear: { dark: 0, fog: 1 }, rain: { dark: 0.3, fog: 0.7 }, storm: { dark: 0.5, fog: 0.5 }, fog: { dark: 0.15, fog: 0.22 } };
  let flash = 0;
  function applySky() {
    captureBase(); const h = hourNow(), d = daylight(h), wx = WX[E.weather.w] || WX.clear;
    const dim = d * (1 - wx.dark), twi = Math.max(0, 1 - Math.abs(d - 0.45) * 4) * 0.35;
    base.lights.forEach((l) => { l.o.intensity = l.i * (0.18 + 0.82 * dim) + (flash > 0 ? 1.2 * flash : 0); TMP.copy(l.c).lerp(DUSK, twi); l.o.color.copy(TMP); });
    if (base.bg) { S.background.copy(base.bg).lerp(NIGHT, 1 - dim).lerp(DUSK, twi * 0.5); }
    if (S.fog && base.fog) {
      S.fog.color.copy(base.fog.c).lerp(NIGHT, (1 - dim) * 0.9);
      if (S.fog.isFogExp2) S.fog.density = base.fog.den / wx.fog; else { S.fog.near = base.fog.near * wx.fog; S.fog.far = base.fog.far * (0.45 + 0.55 * wx.fog); }
    }
    flash = Math.max(0, flash - 0.08);
  }
  setInterval(applySky, 250);

  /* rain / snow particles that follow the camera */
  const N = 900, rain = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xbcd4ff, size: 0.12, transparent: true, opacity: 0.7, depthWrite: false }));
  const rp = new Float32Array(N * 3); for (let i = 0; i < N; i++) { rp[i * 3] = (Math.random() - 0.5) * 40; rp[i * 3 + 1] = Math.random() * 22; rp[i * 3 + 2] = (Math.random() - 0.5) * 40; }
  rain.geometry.setAttribute('position', new THREE.BufferAttribute(rp, 3)); rain.frustumCulled = false; rain.visible = false; S.add(rain);
  let nextBolt = 0;
  (function loop() {
    const w = E.weather.w, on = (w === 'rain' || w === 'storm') && H.isRunning(); rain.visible = on;
    if (on && X.P) {
      const px = H.R.x, pz = H.R.z, a = rain.geometry.attributes.position, sp = w === 'storm' ? 0.9 : 0.6;
      for (let i = 0; i < N; i++) { let y = a.array[i * 3 + 1] - sp; if (y < 0) { y = 22; a.array[i * 3] = (Math.random() - 0.5) * 40; a.array[i * 3 + 2] = (Math.random() - 0.5) * 40; } a.array[i * 3 + 1] = y; }
      a.needsUpdate = true; rain.position.set(px, H.heightAt(px, pz), pz);
      if (w === 'storm' && performance.now() > nextBolt) { flash = 1; nextBolt = performance.now() + 5000 + Math.random() * 12000; }
    }
    requestAnimationFrame(loop);
  })();

  /* ---------- world markers ---------- */
  const markers = { wp: [], steles: [], looks: [] }, pulse = [];
  function pillar(x, z, col, name) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.4, 8), M(0x4a4560)); base.position.y = 0.2; g.add(base);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5 })); beam.position.y = 3.4; g.add(beam);
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ color: col })); orb.position.y = 6.6; g.add(orb); pulse.push(orb);
    const lb = label(name, '#' + col.toString(16).padStart(6, '0'), 7); lb.position.y = 8; g.add(lb);
    g.position.set(x, H.heightAt(x, z), z); S.add(g); return g;
  }
  function buildMarkers() {
    [].concat(markers.wp, markers.steles, markers.looks).forEach((g) => S.remove(g)); markers.wp = []; markers.steles = []; markers.looks = [];
    E.wps.forEach((w) => markers.wp.push(pillar(w.x, w.z, 0x6fc1ff, w.name)));
    E.looks.forEach((l) => markers.looks.push(pillar(l.x, l.z, 0xffd95a, l.name)));
    E.steles.forEach((s) => {
      const g = new THREE.Group(), st = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.2, 0.35), M(0x7d7a86)); st.position.y = 1.1; g.add(st);
      const rune = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, 0.38), new THREE.MeshBasicMaterial({ color: 0x8ef0d0 })); rune.position.y = 1.3; rune.userData.afRune = s.id; g.add(rune);
      g.position.set(s.x, H.heightAt(s.x, s.z), s.z); g.rotation.y = s.id; S.add(g); markers.steles.push(g);
    });
  }
  setInterval(() => { const t = performance.now() / 400; pulse.forEach((o, i) => { o.rotation.y = t + i; o.position.y = 6.6 + Math.sin(t + i) * 0.25; }); }, 50);
  let shard = null;
  function setShard(m) {
    if (shard) { S.remove(shard.g); shard = null; }
    if (!m.on) return;
    const g = new THREE.Group(), core = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), new THREE.MeshBasicMaterial({ color: 0xff8de1 })); core.position.y = 1.2; g.add(core); pulse.push(core);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 30, 6), new THREE.MeshBasicMaterial({ color: 0xff8de1, transparent: true, opacity: 0.45 })); beam.position.y = 15; g.add(beam);
    const lb = label('Mảnh sao rơi', '#ff8de1', 6); lb.position.y = 3; g.add(lb);
    g.position.set(m.x, H.heightAt(m.x, m.z), m.z); S.add(g); shard = { g, id: m.id, x: m.x, z: m.z };
  }

  /* ---------- interaction (E) ---------- */
  const css = document.createElement('style');
  css.textContent = '#afXPrompt{position:fixed;left:50%;bottom:190px;transform:translateX(-50%);z-index:30;padding:6px 14px;border-radius:999px;background:rgba(13,18,31,.9);border:2px solid #8ef0d0;color:#f1ebde;font:600 13px system-ui,sans-serif;pointer-events:none}' +
    '#afMap{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:56;background:rgba(14,19,34,.97);border:3px solid #241a05;border-radius:16px;padding:12px;color:#eef3ff;font:13px system-ui,sans-serif;box-shadow:0 10px 0 rgba(0,0,0,.35)}' +
    '#afMap canvas{display:block;border-radius:10px;background:#0a0f1c;width:min(86vh,92vw);height:min(86vh,92vw);cursor:crosshair}' +
    '#afMap .top{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px}#afMap button{background:#f0bf4c;color:#241a05;border:2px solid #241a05;border-radius:9px;padding:4px 10px;font:700 12px system-ui,sans-serif;cursor:pointer}' +
    '#afXTime{position:fixed;right:12px;top:12px;z-index:20;padding:3px 10px;border-radius:999px;background:rgba(13,18,31,.8);color:#f1ebde;font:600 12px system-ui,sans-serif;pointer-events:none}' +
    '#afXPrompt[hidden],#afMap[hidden],#afXTime[hidden]{display:none}';
  document.head.appendChild(css);
  const prompt = document.createElement('div'); prompt.id = 'afXPrompt'; prompt.hidden = true;
  const timeEl = document.createElement('div'); timeEl.id = 'afXTime'; timeEl.hidden = true;
  const mapEl = document.createElement('div'); mapEl.id = 'afMap'; mapEl.hidden = true;
  mapEl.innerHTML = '<div class="top"><b id="afMapT">Bản đồ</b><span><button type="button" data-x>Đóng (M)</button></span></div><canvas id="afMapC" width="640" height="640"></canvas><div id="afMapH" style="margin-top:6px;color:#aab6d8">Bấm vào điểm dịch chuyển xanh để đến đó (tốn vàng theo khoảng cách).</div>';
  document.body.append(prompt, timeEl, mapEl);
  ['keydown', 'keyup', 'pointerdown', 'mousedown'].forEach((ev) => mapEl.addEventListener(ev, (e) => e.stopPropagation()));

  let tgt = null;
  function findTarget() {
    const R = H.R; let best = null, bd = 4;
    E.steles.forEach((s) => { const d = Math.hypot(s.x - R.x, s.z - R.z); if (d < bd) { bd = d; best = { k: 'st', s }; } });
    if (shard) { const d = Math.hypot(shard.x - R.x, shard.z - R.z); if (d < bd) { bd = d; best = { k: 'rev' }; } }
    return best;
  }
  setInterval(() => {
    const on = H.isRunning() && H.R.alive && !(window.AF_CLASS && window.AF_CLASS.creating);
    timeEl.hidden = !on;
    if (on) { const h = hourNow(), hh = Math.floor(h), mm = Math.floor((h - hh) * 60); timeEl.textContent = ('0' + hh).slice(-2) + ':' + ('0' + mm).slice(-2) + (E.isNight() ? ' · đêm' : ' · ngày') + ({ rain: ' · mưa', storm: ' · bão', fog: ' · sương mù' }[E.weather.w] || ''); }
    tgt = on ? findTarget() : null; prompt.hidden = !tgt;
    if (tgt) prompt.textContent = tgt.k === 'st' ? 'Nhấn E: đọc bia đá cổ' + (E.st.includes(tgt.s.id) ? ' (đã đọc)' : '') : 'Nhấn E: nhặt mảnh sao rơi';
  }, 200);
  window.addEventListener('keydown', (e) => {
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (!H.isRunning() || e.ctrlKey || e.metaKey || e.altKey || e.repeat || (window.AF_CLASS && window.AF_CLASS.creating)) return;
    const k = (e.code || '').indexOf('Key') === 0 ? e.code.slice(3).toLowerCase() : String(e.key).toLowerCase();
    if (k === 'm') toggle();
    else if (k === 'e' && tgt) { if (tgt.k === 'st') send({ t: 'zone', op: 'stele', id: tgt.s.id }); else send({ t: 'zone', op: 'rev', id: shard.id }); }
  });

  /* ---------- map ---------- */
  const cvs = mapEl.querySelector('canvas'), ctx = cvs.getContext('2d'), SZ = 640, RADIUS = W.R;
  const toPx = (x, z) => [(x + RADIUS) / (RADIUS * 2) * SZ, (z + RADIUS) / (RADIUS * 2) * SZ];
  let lastPos = null, face = 0;
  function drawMap() {
    if (!E.open) return;
    ctx.clearRect(0, 0, SZ, SZ);
    const g = ctx.createRadialGradient(SZ / 2, SZ / 2, 40, SZ / 2, SZ / 2, SZ / 2); g.addColorStop(0, '#24402e'); g.addColorStop(1, '#122019'); ctx.fillStyle = g; ctx.fillRect(0, 0, SZ, SZ);
    RU.ZONES.forEach((z) => { const [x, y] = toPx(z.x, z.z), r = z.r / (RADIUS * 2) * SZ; ctx.fillStyle = z.col + '66'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.fillStyle = '#ffffffcc'; ctx.font = '600 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText(z.name, x, y - r - 4); });
    [[W.VILLAGE, 'Làng', '#f0bf4c'], [W.FOREST, 'Rừng Bóng Đèn', '#7ddc8f'], [W.ARENA, 'Đấu trường', '#ff8a78']].forEach((a) => { const [x, y] = toPx(a[0].x, a[0].z); ctx.fillStyle = a[2] + '55'; ctx.beginPath(); ctx.arc(x, y, 26, 0, 7); ctx.fill(); ctx.fillStyle = '#ffffffcc'; ctx.font = '600 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText(a[1], x, y - 30); });
    // fog: unexplored cells are dark
    const cs = SZ / 27; ctx.fillStyle = 'rgba(6,9,16,.93)';
    for (let z = 0; z < 27; z++) for (let x = 0; x < 27; x++) if (!(E.fog[z] & (1 << x))) ctx.fillRect(x * cs - 0.5, z * cs - 0.5, cs + 1, cs + 1);
    E.wps.forEach((w) => { const [x, y] = toPx(w.x, w.z), ok = E.wp.includes(w.id); ctx.fillStyle = ok ? '#6fc1ff' : '#4a5570'; ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 9); ctx.lineTo(x - 7, y); ctx.closePath(); ctx.fill(); if (ok) { ctx.fillStyle = '#e6f3ff'; ctx.font = '600 12px system-ui'; ctx.textAlign = 'center'; ctx.fillText(w.name, x, y + 22); } });
    E.looks.forEach((l) => { const [x, y] = toPx(l.x, l.z); ctx.fillStyle = E.lk.includes(l.id) ? '#ffd95a' : '#6a6240'; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill(); });
    E.steles.forEach((s) => { if (!E.st.includes(s.id)) return; const [x, y] = toPx(s.x, s.z); ctx.fillStyle = '#8ef0d0'; ctx.fillRect(x - 3, y - 5, 6, 10); });
    if (shard) { const [x, y] = toPx(shard.x, shard.z); ctx.fillStyle = '#ff8de1'; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill(); }
    const Zt = window.AF_ZONES && window.AF_ZONES.boss; if (Zt && !Zt.dead) { const [x, y] = toPx(Zt.x, Zt.z); ctx.fillStyle = '#ff5a3a'; ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText('BOSS', x, y - 12); }
    if (H.others) H.others.forEach((o) => { const [x, y] = toPx(o.x, o.z); ctx.fillStyle = '#9be15d'; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill(); });
    const [px, py] = toPx(H.R.x, H.R.z); ctx.save(); ctx.translate(px, py); ctx.rotate(face); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    mapEl.querySelector('#afMapT').textContent = 'Bản đồ · đã khám phá ' + E.pct + '% · bia đá ' + E.st.length + '/12 · đài quan sát ' + E.lk.length + '/' + E.looks.length;
  }
  setInterval(() => { const R = H.R; if (lastPos && Math.hypot(R.x - lastPos[0], R.z - lastPos[1]) > 0.05) face = Math.atan2(R.x - lastPos[0], -(R.z - lastPos[1])); lastPos = [R.x, R.z]; drawMap(); }, 200);
  cvs.addEventListener('click', (e) => {
    const r = cvs.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * SZ, y = ((e.clientY - r.top) / r.height) * SZ;
    let best = null, bd = 18;
    E.wps.forEach((w) => { if (!E.wp.includes(w.id)) return; const [wx, wy] = toPx(w.x, w.z), d = Math.hypot(wx - x, wy - y); if (d < bd) { bd = d; best = w; } });
    if (best) { const cost = 15 + Math.round(Math.hypot(best.x - H.R.x, best.z - H.R.z) * 0.5); if (confirm('Dịch chuyển tới ' + best.name + '? Tốn khoảng ' + cost + ' vàng.')) { send({ t: 'zone', op: 'tp', id: best.id }); toggle(false); } }
  });
  mapEl.querySelector('[data-x]').addEventListener('click', () => toggle(false));
  function toggle(v) { E.open = v === undefined ? !E.open : v; mapEl.hidden = !E.open; if (E.open) { send({ t: 'zone', op: 'xinfo' }); drawMap(); } }

  /* ---------- server messages ---------- */
  E.onNet = function (m) {
    switch (m.t) {
      case 'xinfo':
        E.wp = m.wp || []; E.lk = m.lk || []; E.st = m.st || []; E.wps = m.wps || []; E.looks = m.looks || []; E.steles = m.steles || [];
        E.off = (m.tm || Date.now()) - Date.now(); if (m.weather) E.weather = { w: m.weather.w };
        buildMarkers(); drawMap(); return true;
      case 'fog': E.fog = m.rows || E.fog; E.pct = m.pct || 0; drawMap(); return true;
      case 'weather':
        E.weather = { w: m.w };
        if (m.w !== 'clear') H.toast('Thời tiết đổi: <b>' + ({ rain: 'Mưa', storm: 'Bão', fog: 'Sương mù' }[m.w] || m.w) + '</b>'); else H.toast('Trời quang trở lại');
        return true;
      case 'xwp': if (!E.wp.includes(m.id)) E.wp.push(m.id); H.toast('Mở điểm dịch chuyển <b>' + esc(m.name) + '</b> (phím M)'); drawMap(); return true;
      case 'xstele':
        if (m.first && !E.st.includes(m.id)) E.st.push(m.id);
        H.chatLine('sys', '<i>' + esc(m.text) + '</i> (' + m.n + '/12 bia đá)'); H.toast(m.first ? 'Bia đá cổ <b>' + m.n + '/12</b>' : 'Bạn đã đọc bia này'); return true;
      case 'rev': setShard(m); return true;
      default: return false;
    }
  };
})();
