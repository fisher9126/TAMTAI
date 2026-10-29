/* Aetherfall item pictures (browser): every piece of equipment, potion and mount gets a real 3D picture, rendered once on a small
   off-screen canvas and cached. Weapons, shields, books, helmets and capes are the KayKit models the heroes hold (dark.js);
   chest armour, boots, gloves, pants, rings, necklaces, charms and potions are built here in the same chunky style.
   AF_ICONS.item(spec) -> image URL or null (models not loaded yet). spec: { slot, type, sub, kind, rarity } or { potion: 'hp'|'mp' } or { mount: id }.
   AF_ICONS.forItem(src, item) builds the spec from an inventory item. AF_ICONS.preview(canvas) shows the dressed hero (armory). */
(function () {
  'use strict';
  const T = window.THREE, H = window.AF_CH, X = window.AF_CHX;
  if (!T || !H) return;
  const IC = window.AF_ICONS = window.AF_ICONS || {};
  const cache = {}, PI = Math.PI;
  const RC = { common: 0xa8b0bc, rare: 0x4f96e6, epic: 0x9f6ae4, legend: 0xf09a3a };
  let R = null, scene = null, cam = null;
  function setup() {
    if (R) return true;
    try { R = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true }); } catch (e) { return false; }
    R.setPixelRatio(1); R.setSize(128, 128); R.setClearColor(0x000000, 0); R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 0.95;
    scene = new T.Scene(); cam = new T.PerspectiveCamera(30, 1, 0.01, 100);
    scene.add(new T.HemisphereLight(0xfff4e0, 0x403020, 1.0));
    const k = new T.DirectionalLight(0xffffff, 1.6); k.position.set(2, 3, 4); scene.add(k);
    const rim = new T.DirectionalLight(0xffb070, 1.2); rim.position.set(-3, 1, -2); scene.add(rim);
    return true;
  }
  const M = (c, metal, rough, extra) => new T.MeshStandardMaterial(Object.assign({ color: c, metalness: metal || 0, roughness: rough == null ? 0.6 : rough }, extra || {}));
  const gem = (c) => M(c, 0.2, 0.15, { emissive: c, emissiveIntensity: 0.55 });
  const STYLE = { plate: [0xc0c8d2, 0.85, 0x6a7280], mail: [0x8f98a2, 0.8, 0x5a4030], arcane: [0x3c3c96, 0.05, 0xd8a84a], starweave: [0x28508a, 0.1, 0xe8f0ff], leather: [0x8a5630, 0.05, 0x4a2a14],
    hunter: [0x4f6e2c, 0.05, 0x6a4422], shadow: [0x2c2434, 0.05, 0x8a3a6a], nightsilk: [0x3c1c50, 0.1, 0xb07cff], holy: [0xf2ead6, 0.2, 0xd8a84a], cleric: [0xc8c0b0, 0.6, 0xd8a84a], none: [0x8a7a66, 0.3, 0x5a4a3a] };
  const st = (t) => STYLE[t] || STYLE.none;
  /* ---------- builders ---------- */
  function box(g, w, h, d, m, x, y, z) { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x || 0, y || 0, z || 0); g.add(o); return o; }
  function chest(type, rar) {
    const g = new T.Group(), s = st(type), main = M(s[0], s[1], s[1] > 0.5 ? 0.35 : 0.8), trim = M(s[2], 0.6, 0.4);
    const torso = new T.Mesh(new T.CylinderGeometry(0.62, 0.5, 1.0, 10), main); torso.scale.z = 0.62; g.add(torso);
    const neck = new T.Mesh(new T.TorusGeometry(0.24, 0.07, 8, 16), trim); neck.rotation.x = PI / 2; neck.position.y = 0.5; g.add(neck);
    [-1, 1].forEach((k) => { const p = new T.Mesh(new T.SphereGeometry(0.3, 14, 10, 0, PI * 2, 0, PI / 2), s[1] > 0.5 ? main : trim); p.position.set(k * 0.62, 0.38, 0); p.rotation.z = -k * 0.35; g.add(p); });
    box(g, 1.04, 0.14, 0.7, trim, 0, -0.42, 0); box(g, 0.2, 0.2, 0.1, gem(RC[rar]), 0, -0.42, 0.35);
    if (s[1] > 0.5) for (let i = 0; i < 3; i++) box(g, 0.9 - i * 0.1, 0.05, 0.66, trim, 0, 0.15 - i * 0.18, 0.02);
    else box(g, 0.08, 0.9, 0.66, trim, 0, 0.02, 0.02);
    box(g, 0.24, 0.24, 0.08, gem(RC[rar]), 0, 0.12, 0.34);
    return g;
  }
  function boots(type, rar) {
    const g = new T.Group(), s = st(type), m = M(s[0], s[1], 0.5), t = M(s[2], 0.5, 0.4);
    [-0.32, 0.32].forEach((x, i) => { const b = new T.Group(); b.position.x = x; b.rotation.y = i ? -0.25 : 0.25; g.add(b); box(b, 0.34, 0.6, 0.36, m, 0, 0.2, 0); box(b, 0.36, 0.22, 0.62, m, 0, -0.18, 0.13); box(b, 0.4, 0.1, 0.4, t, 0, 0.5, 0); box(b, 0.12, 0.12, 0.05, gem(RC[rar]), 0, 0.32, 0.19); });
    return g;
  }
  function gloves(type, rar) {
    const g = new T.Group(), s = st(type), m = M(s[0], s[1], 0.5), t = M(s[2], 0.5, 0.4);
    box(g, 0.56, 0.6, 0.26, m, 0, 0, 0);
    for (let i = 0; i < 4; i++) box(g, 0.11, 0.38, 0.14, m, -0.21 + i * 0.14, 0.48, 0);
    const th = box(g, 0.13, 0.3, 0.14, m, 0.36, 0.1, 0); th.rotation.z = -0.6;
    const cuff = new T.Mesh(new T.CylinderGeometry(0.36, 0.3, 0.32, 10), t); cuff.position.y = -0.44; cuff.scale.z = 0.6; g.add(cuff);
    box(g, 0.16, 0.16, 0.05, gem(RC[rar]), 0, 0.02, 0.15); g.rotation.z = 0.3;
    return g;
  }
  function pants(type, rar) {
    const g = new T.Group(), s = st(type), m = M(s[0], s[1] * 0.6, 0.6), t = M(s[2], 0.5, 0.4);
    box(g, 0.9, 0.18, 0.42, t, 0, 0.55, 0); box(g, 0.16, 0.16, 0.06, gem(RC[rar]), 0, 0.55, 0.22);
    [-0.22, 0.22].forEach((x) => { box(g, 0.38, 1.0, 0.38, m, x, 0, 0); box(g, 0.4, 0.16, 0.42, t, x, -0.12, 0.02); });
    return g;
  }
  function ring(rar, kind) {
    const g = new T.Group(), gold = M(kind === 'neck' ? 0xd8b060 : 0xe0b84a, 0.95, 0.25);
    if (kind === 'ring') { const r = new T.Mesh(new T.TorusGeometry(0.42, 0.1, 12, 32), gold); g.add(r); const o = new T.Mesh(new T.OctahedronGeometry(0.22), gem(RC[rar])); o.position.y = 0.52; g.add(o); const cl = new T.Mesh(new T.CylinderGeometry(0.16, 0.12, 0.12, 6), gold); cl.position.y = 0.4; g.add(cl); g.rotation.x = -0.4; }
    else if (kind === 'neck') { const c = new T.Mesh(new T.TorusGeometry(0.7, 0.035, 8, 40, PI * 1.25), gold); c.rotation.z = PI * 1.375 - PI; g.add(c); const p = new T.Mesh(new T.OctahedronGeometry(0.3), gem(RC[rar])); p.scale.y = 1.4; p.position.y = -0.82; g.add(p); const b = new T.Mesh(new T.TorusGeometry(0.34, 0.05, 8, 20), gold); b.position.y = -0.82; g.add(b); }
    else { const c = new T.Mesh(new T.DodecahedronGeometry(0.42), gem(RC[rar])); g.add(c); const l = new T.Mesh(new T.TorusGeometry(0.14, 0.04, 8, 16), gold); l.position.y = 0.52; g.add(l); [0, 1, 2, 3].forEach((i) => { const sp = new T.Mesh(new T.ConeGeometry(0.1, 0.3, 4), gold); const a = i * PI / 2 + PI / 4; sp.position.set(Math.cos(a) * 0.48, Math.sin(a) * 0.48, 0); sp.rotation.z = a - PI / 2; g.add(sp); }); }
    return g;
  }
  function hood(type) { const g = new T.Group(), s = st(type), m = M(s[0], 0.05, 0.85); const h = new T.Mesh(new T.SphereGeometry(0.55, 16, 12, 0, PI * 2, 0, PI * 0.65), m); g.add(h); const tip = new T.Mesh(new T.ConeGeometry(0.3, 0.6, 10), m); tip.position.set(0, 0.45, -0.28); tip.rotation.x = -0.8; g.add(tip); const face = new T.Mesh(new T.CircleGeometry(0.34, 16), M(0x0a0808)); face.position.set(0, -0.08, 0.42); g.add(face); [-0.12, 0.12].forEach((x) => { const e = new T.Mesh(new T.SphereGeometry(0.05, 8, 6), gem(s[2])); e.position.set(x, -0.05, 0.45); g.add(e); }); return g; }
  function potion(kind) {
    const g = new T.Group(), c = kind === 'mp' ? 0x3f7aff : 0xe0332a;
    const prof = [[0.01, -0.62], [0.38, -0.6], [0.5, -0.4], [0.52, -0.1], [0.42, 0.18], [0.18, 0.32], [0.16, 0.56], [0.2, 0.62]].map((p) => new T.Vector2(p[0], p[1]));
    g.add(new T.Mesh(new T.LatheGeometry(prof, 24), M(0xdde8ff, 0.1, 0.05, { transparent: true, opacity: 0.35 })));
    const liq = [[0.01, -0.58], [0.34, -0.56], [0.46, -0.38], [0.48, -0.12], [0.4, 0.05], [0.01, 0.05]].map((p) => new T.Vector2(p[0], p[1]));
    g.add(new T.Mesh(new T.LatheGeometry(liq, 24), M(c, 0, 0.2, { emissive: c, emissiveIntensity: 0.55 })));
    const cork = new T.Mesh(new T.CylinderGeometry(0.17, 0.15, 0.22, 12), M(0x8a5a30, 0, 0.9)); cork.position.y = 0.72; g.add(cork);
    const sh = new T.Mesh(new T.SphereGeometry(0.08, 8, 6), M(0xffffff, 0, 0.1, { emissive: 0xffffff, emissiveIntensity: 0.6 })); sh.position.set(-0.22, -0.1, 0.4); g.add(sh);
    return g;
  }
  const HELM = { plate: 'Knight_Helmet', mail: 'Knight_Helmet', holy: 'Knight_Helmet', cleric: 'Knight_Helmet', arcane: 'Mage_Hat', starweave: 'Mage_Hat', leather: 'Barbarian_Hat', hunter: 'Barbarian_Hat' };
  const CAPE = { plate: 'Knight_Cape', mail: 'Knight_Cape', holy: 'Knight_Cape', cleric: 'Knight_Cape', arcane: 'Mage_Cape', starweave: 'Mage_Cape', leather: 'Barbarian_Cape', hunter: 'Barbarian_Cape', shadow: 'Rogue_Cape', nightsilk: 'Rogue_Cape' };
  function model(name, tint) {
    const A = window.AF_DARK && window.AF_DARK.api; if (!A) return null;
    const src = A.wlib(name); if (!src) return null;
    const m = src.clone(true); m.position.set(0, 0, 0); m.quaternion.identity(); m.scale.setScalar(1); m.visible = true;
    if (tint != null) m.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.lerp(new T.Color(tint), 0.55); } });
    const g = new T.Group(); g.add(m); return g;
  }
  function build(spec) {
    const A = window.AF_DARK && window.AF_DARK.api, rar = spec.rarity || 'common';
    if (spec.potion) return potion(spec.potion);
    if (spec.mount) { const MV = window.AF_MOVE; if (!MV || !MV.model) return null; const g = MV.model(spec.mount); g.position.y = 0; g.rotation.y = -0.7; return g; }
    if (spec.kind) return ring(rar, spec.kind);
    const s = spec.slot;
    if (s === 'weapon') {
      if (!A) return null; const type = A.WSPEC[spec.type] ? spec.type : (spec.cls && A.WDEF[spec.cls]) || 'sword', sp = A.WSPEC[type], g = new T.Group();
      const r = sp.r ? A.makePiece(sp.r, rar, sp.tint) : null, l = sp.l && sp.l !== 'SHIELD' && !/Spellbook/.test(sp.l) ? A.makePiece(sp.l, rar, sp.tint) : null;
      if (r) { r.position.set(0, 0, 0); r.quaternion.identity(); r.rotation.set(0, 0, 0); r.scale.setScalar(1); g.add(r); }
      if (l) { l.position.set(r ? 0.45 : 0, r ? -0.15 : 0, r ? -0.2 : 0); l.quaternion.identity(); l.rotation.set(0, 0, r ? 0.25 : 0); if (!r) l.rotation.set(0, 0, 0); l.scale.setScalar(1); g.add(l); }
      if (/bow/.test(type)) g.rotation.set(0, 0.5, 0); else g.rotation.set(0.2, 0.6, -0.75);
      return g;
    }
    if (s === 'offhand') return spec.sub === 'tome' ? model('Spellbook') : model({ common: 'Round_Shield', rare: 'Rectangle_Shield', epic: 'Badge_Shield', legend: 'Spike_Shield' }[rar]);
    if (s === 'helmet') { if (spec.type === 'shadow' || spec.type === 'nightsilk') return hood(spec.type); const g = model(HELM[spec.type] || 'Knight_Helmet', spec.type === 'holy' || spec.type === 'cleric' ? 0xe8c060 : spec.type ? st(spec.type)[0] : null); return g; }
    if (s === 'cape') return model(CAPE[spec.type] || 'Knight_Cape', st(spec.type || 'none')[0]);
    if (s === 'armor') return chest(spec.type, rar);
    if (s === 'boots') return boots(spec.type, rar);
    if (s === 'gloves') return gloves(spec.type, rar);
    if (s === 'pants') return pants(spec.type, rar);
    return null;
  }
  const v3 = new T.Vector3(), bx = new T.Box3(), sph = new T.Sphere();
  function render(obj) {
    scene.add(obj); obj.updateMatrixWorld(true);
    bx.setFromObject(obj); bx.getBoundingSphere(sph); const c = sph.center, r = Math.max(0.05, sph.radius);
    const d = r / Math.sin(cam.fov * PI / 360) * 1.02; v3.set(0.35, 0.3, 1).normalize().multiplyScalar(d);
    cam.position.copy(c).add(v3); cam.near = d / 50; cam.far = d * 4; cam.updateProjectionMatrix(); cam.lookAt(c);
    R.render(scene, cam); const url = R.domElement.toDataURL('image/png'); scene.remove(obj);
    /* geometry is not disposed: KayKit pieces share theirs with the heroes in the world */
    return url;
  }
  const keyOf = (spec) => JSON.stringify([spec.slot, spec.type, spec.sub, spec.kind, spec.rarity, spec.potion, spec.mount, spec.cls]);
  IC.item = function (spec) {
    const k = keyOf(spec); if (cache[k]) return cache[k];
    if (!setup()) return null;
    let o = null; try { o = build(spec); } catch (e) { console.warn('[icons]', e); }
    if (!o) return null;
    try { cache[k] = render(o); } catch (e) { console.warn('[icons render]', e); return null; }
    return cache[k];
  };
  IC.forItem = function (src, it) {
    if (!it) return null;
    const cls = (window.AF_CLASS && window.AF_CLASS.prof && window.AF_CLASS.prof.cls) || null;
    if (src === 'main') return IC.item({ slot: it.slot, type: it.type, rarity: it.rarity, cls: it.slot === 'weapon' && !it.type ? cls : undefined });
    if (src === 'ext') return IC.item({ slot: it.slot, sub: it.sub, type: null, rarity: it.rarity });
    return IC.item({ kind: it.kind, rarity: it.rarity });
  };
  IC.ready = () => !!(window.AF_DARK && window.AF_DARK.api && window.AF_DARK.ready);

  /* ---------- hero preview: a second small renderer that draws the dressed hero turning slowly ---------- */
  let P = null;
  IC.preview = function (canvas, eqKey, make) {
    if (!P) {
      try { P = { r: new T.WebGLRenderer({ canvas: document.createElement('canvas'), alpha: true, antialias: true }) }; } catch (e) { return false; }
      P.r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); P.r.outputEncoding = T.sRGBEncoding; P.r.toneMapping = T.ACESFilmicToneMapping; P.r.toneMappingExposure = 1.1; P.r.setClearColor(0, 0);
      P.s = new T.Scene(); P.c = new T.PerspectiveCamera(28, 1, 0.1, 50);
      P.s.add(new T.HemisphereLight(0xfff0e0, 0x302418, 1.0)); const k = new T.DirectionalLight(0xffffff, 1.5); k.position.set(2, 4, 5); P.s.add(k); const rim = new T.DirectionalLight(0xff9a50, 1.3); rim.position.set(-3, 2, -3); P.s.add(rim);
      const base = new T.Mesh(new T.CylinderGeometry(1.0, 1.1, 0.12, 40), M(0x2a2018, 0.3, 0.6)); base.position.y = -0.06; P.s.add(base);
      const glowR = new T.Mesh(new T.RingGeometry(0.95, 1.12, 48), new T.MeshBasicMaterial({ color: 0xe07a3a, transparent: true, opacity: 0.7, side: T.DoubleSide })); glowR.rotation.x = -PI / 2; glowR.position.y = 0.01; P.s.add(glowR);
      P.yaw = 0.4; P.drag = null; P.t = performance.now();
      const cv = P.r.domElement; cv.style.cssText = 'width:100%;height:100%;display:block;cursor:grab;touch-action:none';
      cv.addEventListener('pointerdown', (e) => { P.drag = e.clientX; cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', (e) => { if (P.drag == null) return; P.yaw += (e.clientX - P.drag) * 0.012; P.drag = e.clientX; });
      cv.addEventListener('pointerup', () => { P.drag = null; });
      cv.addEventListener('dblclick', () => { if (P.hero && P.hero.attack) P.hero.attack(); });
      const loop = () => {
        requestAnimationFrame(loop);
        if (!P.host || !P.host.isConnected || !P.host.offsetParent) return;
        const now = performance.now(), dt = Math.min(0.05, (now - P.t) / 1000); P.t = now;
        const w = P.host.clientWidth, h = P.host.clientHeight; if (w < 10 || h < 10) return;
        if (P.w !== w || P.h !== h) { P.w = w; P.h = h; P.r.setSize(w, h, false); P.c.aspect = w / h; P.c.updateProjectionMatrix(); }
        if (P.drag == null) P.yaw += dt * 0.35;
        if (P.hero) { P.hero.update(dt); P.hero.root.rotation.y = P.yaw; }
        P.c.position.set(0, 1.45, 6.2); P.c.lookAt(0, 1.1, 0);
        P.r.render(P.s, P.c);
      };
      requestAnimationFrame(loop);
    }
    if (canvas && P.host !== canvas) { P.host = canvas; canvas.innerHTML = ''; canvas.appendChild(P.r.domElement); }
    if (eqKey !== P.key && make) { const hero = make(); if (hero) { if (P.hero) P.s.remove(P.hero.root); P.hero = hero; P.s.add(hero.root); P.key = eqKey; } }
    return true;
  };
})();
