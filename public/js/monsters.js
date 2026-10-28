/* Aetherfall visuals, step 2: real monster models.
   Until now most monsters were the snail, the owl or the washing-machine bull with a different color. This file builds a
   separate model for 15 of them (mushrooms, spider-pot, mole, rice-cooker golem, penguin-fridge, polar bear, ice queen, ember imp,
   scorpion, mummy, pharaoh, demon, dragon, void eye) and adds a glowing ground ring under every elite and boss.
   It hooks AF_ZONES.skin (called once for every monster that appears) and animates the new models in scene.onBeforeRender.
   Monsters without a new model keep the old look. If a builder throws, that monster falls back to the old model.
   Quality: AF_VISUAL.setQuality(0) turns off the glow sprites and orbiting bits. */
(function () {
  'use strict';
  const H = window.AF_CH, X = window.AF_CHX, RU = window.AF_RULES, T = window.THREE, Z = window.AF_ZONES;
  if (!H || !X || !RU || !T || !Z || !Z.skin || !RU.ENEMIES) { console.warn('[monsters] thieu AF_ZONES/AF_RULES.ENEMIES, bo qua'); return; }
  const PI = Math.PI, TAU = PI * 2, sin = Math.sin, cos = Math.cos;
  const Q = () => (window.AF_VISUAL && window.AF_VISUAL.quality ? window.AF_VISUAL.quality() : 2);
  const MV = window.AF_MONSTERS = { off: false };

  /* ---------- helpers (geometry is shared, materials are per monster because the hit flash edits them) ---------- */
  const gc = {}; const G = (k, f) => gc[k] || (gc[k] = f());
  const M = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6, metalness: 0.1 }, o || {}));
  const E = (c, i, o) => M(c, Object.assign({ emissive: c, emissiveIntensity: i == null ? 1 : i, roughness: 0.35 }, o || {}));
  const mk = (geo, m, p, x, y, z, cs) => { const o = new T.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); o.castShadow = !!cs; p.add(o); return o; };
  const grp = (p, x, y, z) => { const g = new T.Group(); g.position.set(x || 0, y || 0, z || 0); p.add(g); return g; };
  const ell = (p, m, rx, ry, rz, x, y, z) => { const o = mk(G('sph', () => new T.SphereGeometry(1, 16, 12)), m, p, x, y, z, Math.max(rx, ry, rz) > 0.3); o.scale.set(rx, ry, rz); return o; };
  const half = (p, m, rx, ry, rz, x, y, z) => { const o = mk(G('half', () => new T.SphereGeometry(1, 18, 8, 0, TAU, 0, PI / 2)), m, p, x, y, z, true); o.scale.set(rx, ry, rz); return o; };
  const cyl = (p, m, rt, rb, h, x, y, z, seg) => mk(G('cy' + rt + '|' + rb + '|' + h + '|' + (seg || 10), () => new T.CylinderGeometry(rt, rb, h, seg || 10)), m, p, x, y, z, h > 0.6);
  const cone = (p, m, r, h, x, y, z, seg) => mk(G('co' + r + '|' + h + '|' + (seg || 6), () => new T.ConeGeometry(r, h, seg || 6)), m, p, x, y, z, false);
  const box = (p, m, w, h, d, x, y, z) => mk(G('bx' + w + '|' + h + '|' + d, () => new T.BoxGeometry(w, h, d)), m, p, x, y, z, Math.max(w, h, d) > 0.7);
  const tor = (p, m, R, r, x, y, z, seg) => mk(G('to' + R + '|' + r + '|' + (seg || 18), () => new T.TorusGeometry(R, r, 6, seg || 18)), m, p, x, y, z, false);
  const octa = (p, m, r, x, y, z) => mk(G('oc' + r, () => new T.OctahedronGeometry(r)), m, p, x, y, z, false);
  function limb(p, m, x, y, z, len, r) { const g = grp(p, x, y, z); const c = mk(G('lm' + r + '|' + len, () => new T.CylinderGeometry(r, r * 0.82, len, 8)), m, g, 0, -len / 2, 0, len > 0.7); return g; }
  function eye(p, x, y, z, r, col) { ell(p, M(0xffffff, { roughness: 0.3 }), r, r, r, x, y, z); ell(p, col ? E(col, 0.9) : M(0x15141c), r * 0.55, r * 0.55, r * 0.55, x, y, z + r * 0.6); }
  let gt = null;
  function glowTex() {
    if (gt) return gt; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); gt = new T.CanvasTexture(c); return gt;
  }
  function glow(p, x, y, z, size, col, parts) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: col, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
    s.scale.setScalar(size); s.position.set(x, y, z); p.add(s); if (parts) (parts.glows = parts.glows || []).push(s); return s;
  }
  function orbiter(parts, m, r, y, sp, ph, a) { (parts.orbit = parts.orbit || []).push({ m, r, y, sp, ph: ph || 0, a: a == null ? 0.08 : a }); }
  const root = () => { const g = new T.Group(), body = new T.Group(); g.add(body); return { g, body }; };
  const hop = (body, t, mv, amp) => { body.position.y = Math.abs(sin(t * (mv ? 8 : 2))) * amp * (mv ? 1 : 0.25); };

  /* ---------- mushrooms ---------- */
  function mushroom(o) {
    const { g, body } = root(), s = o.s, parts = {};
    const cream = M(0xefe6c8), cap = M(o.cap, { emissive: o.cap, emissiveIntensity: 0.12 }), spot = M(o.spot), dark = M(0x1c1b24);
    cyl(body, cream, 0.34 * s, 0.42 * s, 0.95 * s, 0, 0.48 * s, 0);
    ell(body, cream, 0.16 * s, 0.1 * s, 0.24 * s, 0.2 * s, 0.05 * s, 0.1 * s); ell(body, cream, 0.16 * s, 0.1 * s, 0.24 * s, -0.2 * s, 0.05 * s, 0.1 * s);
    const capG = grp(body, 0, 0.95 * s, 0);
    half(capG, cap, 0.98 * s, 0.7 * s, 0.98 * s, 0, 0, 0);
    cyl(capG, M(0xd8c9a0), 0.96 * s, 0.9 * s, 0.05 * s, 0, 0, 0, 18);
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + 0.3, el = 0.35 + (i % 3) * 0.28; ell(capG, spot, 0.14 * s, 0.05 * s, 0.14 * s, 0.98 * s * cos(a) * cos(el), 0.7 * s * sin(el), 0.98 * s * sin(a) * cos(el)); }
    [-1, 1].forEach((k) => { eye(body, k * 0.15 * s, 0.62 * s, 0.37 * s, 0.1 * s, o.crown ? 0xff3b30 : null); const br = box(body, dark, 0.2 * s, 0.04 * s, 0.04 * s, k * 0.15 * s, 0.76 * s, 0.4 * s); br.rotation.z = k * 0.45; });
    box(body, dark, 0.2 * s, 0.04 * s, 0.04 * s, 0, 0.42 * s, 0.4 * s);
    const arms = [-1, 1].map((k) => limb(body, cream, k * 0.4 * s, 0.7 * s, 0, 0.6 * s, 0.07 * s));
    if (o.crown) { const gold = M(0xf0bf4c, { metalness: 0.8, roughness: 0.3 }); for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; cone(capG, gold, 0.1 * s, 0.38 * s, cos(a) * 0.5 * s, 0.78 * s, sin(a) * 0.5 * s); } }
    for (let i = 0; i < 3; i++) { const sp = ell(capG, E(0xcaff7a, 0.8), 0.07 * s, 0.07 * s, 0.07 * s, 0, 0.9 * s, 0); orbiter(parts, sp, 0.7 * s, 0.9 * s, 1.4 + i * 0.3, i * 2.1, 0.15 * s); }
    parts.tick = (e, dt, mv, t) => {
      hop(body, t, mv, 0.1 * s); body.rotation.z = sin(t * (mv ? 8 : 3)) * 0.05; capG.rotation.x = e.st === 1 ? -0.3 : sin(t * 2) * 0.03;
      arms.forEach((a, i) => { a.rotation.x = e.st === 1 ? -2.2 : sin(t * (mv ? 8 : 2.5) + i * PI) * 0.5; a.rotation.z = (i ? -1 : 1) * 0.3; });
    };
    return { g, body, parts, lh: o.lh };
  }

  /* ---------- builders ---------- */
  const B = {};
  B.fungo = () => mushroom({ s: 1, cap: 0x7ccf4a, spot: 0xe7ffb0, lh: 2.4 });
  B.sporo = () => mushroom({ s: 2.2, cap: 0xc94545, spot: 0xf5e6c8, crown: true, lh: 5.5 });

  B.ragno = () => {
    const { g, body } = root(), parts = {}, shell = M(0x4b3f66, { metalness: 0.5, roughness: 0.35 }), lidM = M(0x9a8fc4, { metalness: 0.6, roughness: 0.3 }), red = E(0xff3b4a, 1);
    const abd = grp(body, 0, 1.0, -0.4); ell(abd, shell, 0.8, 0.62, 0.85, 0, 0, 0);
    cyl(abd, lidM, 0.3, 0.44, 0.14, 0, 0.6, 0); ell(abd, lidM, 0.09, 0.09, 0.09, 0, 0.72, 0);
    [-1, 1].forEach((k) => { const h = tor(abd, lidM, 0.2, 0.05, k * 0.82, 0.05, 0); h.rotation.y = PI / 2; });
    const hd = grp(body, 0, 0.9, 0.7); ell(hd, shell, 0.42, 0.36, 0.42, 0, 0, 0);
    [[-0.14, 0.1], [0.14, 0.1], [-0.07, 0.2], [0.07, 0.2]].forEach(([x, y]) => ell(hd, red, 0.06, 0.06, 0.06, x, y, 0.36));
    [-1, 1].forEach((k) => { const f = cone(hd, M(0xe8e0c8), 0.05, 0.22, k * 0.12, -0.28, 0.34); f.rotation.x = PI; });
    const legs = [];
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? 1 : -1, idx = i % 4, hip = grp(body, side * 0.4, 0.95, 0.45 - idx * 0.3);
      hip.rotation.y = (idx - 1.5) * 0.35 * side; hip.rotation.z = side * 1.9;
      cyl(hip, shell, 0.05, 0.045, 0.9, 0, -0.45, 0, 6);
      const kn = grp(hip, 0, -0.9, 0); kn.rotation.z = -side * 1.5; cyl(kn, shell, 0.045, 0.03, 0.95, 0, -0.475, 0, 6);
      legs.push({ hip, side, ph: (idx % 2) * PI + (side > 0 ? 0 : PI) });
    }
    glow(body, 0, 1.1, 0.9, 1.0, 0xff3b4a, parts);
    parts.tick = (e, dt, mv, t) => {
      legs.forEach((l) => { l.hip.rotation.z = l.side * (1.9 + sin(t * (mv ? 11 : 2) + l.ph) * (mv ? 0.2 : 0.05)); });
      body.position.y = (mv ? Math.abs(sin(t * 11)) * 0.05 : 0) + (e.st === 1 ? -0.1 : 0); abd.rotation.x = e.st === 1 ? 0.4 : sin(t * 2) * 0.03;
    };
    return { g, body, parts, lh: 2.4 };
  };

  B.talpa = () => {
    const { g, body } = root(), parts = {}, fur = M(0x7a5c3e), belly = M(0xb89468), pink = M(0xe69aa0), stone = M(0x8a8f98, { metalness: 0.3 }), wood = M(0x5a3a22), dark = M(0x1c1b24);
    const bd = grp(body, 0, 0.95, 0); ell(bd, fur, 0.9, 0.85, 0.8, 0, 0, 0); ell(bd, belly, 0.6, 0.6, 0.45, 0, -0.05, 0.4);
    const hd = grp(bd, 0, 0.55, 0.7); ell(hd, fur, 0.5, 0.45, 0.55, 0, 0, 0); ell(hd, pink, 0.22, 0.18, 0.2, 0, -0.08, 0.5);
    [-1, 1].forEach((k) => { ell(hd, dark, 0.07, 0.07, 0.07, k * 0.24, 0.15, 0.42); const gg = tor(hd, M(0xd9b04c, { metalness: 0.8 }), 0.11, 0.025, k * 0.24, 0.15, 0.44); gg.rotation.y = 0; });
    const armL = limb(bd, fur, -0.85, 0.2, 0.1, 0.9, 0.17), armR = limb(bd, fur, 0.85, 0.2, 0.1, 0.9, 0.17);
    [armL, armR].forEach((a) => { [-1, 0, 1].forEach((k) => { const c = cone(a, M(0xe8e0c8), 0.04, 0.2, k * 0.08, -1.0, 0.04); c.rotation.x = PI; }); });
    const hm = grp(armR, 0, -0.9, 0.1); cyl(hm, wood, 0.06, 0.06, 1.5, 0, 0.25, 0); box(hm, stone, 0.7, 0.45, 0.45, 0, 1.0, 0);
    [-0.4, 0.4].forEach((x) => cyl(body, fur, 0.2, 0.17, 0.7, x, 0.35, 0));
    parts.tick = (e, dt, mv, t) => {
      hop(body, t, mv, 0.08); armL.rotation.x = sin(t * (mv ? 8 : 2)) * 0.5;
      armR.rotation.x = e.st === 1 ? -2.6 : e.st === 2 ? 0.4 : -0.5 + sin(t * (mv ? 8 : 2) + PI) * 0.3; bd.rotation.x = e.st === 1 ? -0.2 : 0;
    };
    return { g, body, parts, lh: 2.5 };
  };

  function golem(o) {
    const { g, body } = root(), parts = {}, s = o.s, st = M(o.stone, { roughness: 0.9 }), dk = M(o.dark || 0x3a3a42), gl = E(o.glow, 1.4);
    const legs = [-1, 1].map((k) => { const l = limb(body, st, k * 0.5 * s, 0.75 * s, 0, 0.75 * s, 0.3 * s); box(l, dk, 0.5 * s, 0.2 * s, 0.65 * s, 0, -0.75 * s, 0.1 * s); return l; });
    const tr = grp(body, 0, 1.55 * s, 0); cyl(tr, st, 0.95 * s, 0.8 * s, 1.3 * s, 0, 0, 0, 10);
    if (o.lid) { half(tr, M(o.lid, { metalness: 0.5, roughness: 0.4 }), 0.97 * s, 0.5 * s, 0.97 * s, 0, 0.65 * s, 0); cyl(tr, dk, 0.1 * s, 0.14 * s, 0.25 * s, 0, 1.2 * s, 0); ell(tr, gl, 0.09 * s, 0.09 * s, 0.09 * s, 0, 1.36 * s, 0); }
    box(tr, dk, 1.0 * s, 0.5 * s, 0.1 * s, 0, 0.2 * s, 0.84 * s);
    [-1, 1].forEach((k) => box(tr, gl, 0.22 * s, 0.12 * s, 0.05 * s, k * 0.25 * s, 0.24 * s, 0.9 * s)); box(tr, gl, 0.5 * s, 0.05 * s, 0.05 * s, 0, 0.05 * s, 0.9 * s);
    [[-0.6, 0.0], [0.55, -0.2], [0.1, -0.45]].forEach(([x, y], i) => { const c = box(tr, gl, 0.05 * s, 0.5 * s, 0.05 * s, x * s, y * s, 0.7 * s); c.rotation.z = (i - 1) * 0.5; });
    const arms = [-1, 1].map((k) => { const a = limb(tr, st, k * 1.15 * s, 0.5 * s, 0, 1.1 * s, 0.3 * s); ell(a, st, 0.4 * s, 0.4 * s, 0.4 * s, 0, -1.15 * s, 0); return a; });
    if (o.crystals) { const cm = E(o.crystals, 0.9, { transparent: true, opacity: 0.9 }); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, c = cone(tr, cm, 0.16 * s, 0.9 * s, cos(a) * 0.7 * s, 0.85 * s, sin(a) * 0.7 * s, 5); c.rotation.z = -cos(a) * 0.5; c.rotation.x = sin(a) * 0.5; } glow(tr, 0, 0.9 * s, 0, 3 * s, o.crystals, parts); }
    if (o.crown) { const gold = M(0xf0bf4c, { metalness: 0.8, roughness: 0.3 }); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; cone(tr, gold, 0.12 * s, 0.45 * s, cos(a) * 0.55 * s, 0.95 * s, sin(a) * 0.55 * s); } }
    parts.tick = (e, dt, mv, t) => {
      body.position.y = Math.abs(sin(t * (mv ? 4 : 1.2))) * 0.1 * s * (mv ? 1 : 0.3); tr.rotation.y = sin(t * (mv ? 4 : 1.2)) * 0.08;
      arms.forEach((a, i) => { a.rotation.x = e.st === 1 ? -2.5 : e.st === 2 ? -1.2 : sin(t * (mv ? 4 : 1.2) + i * PI) * 0.45; a.rotation.z = (i ? -1 : 1) * (e.st === 1 ? 0.25 : 0.15); });
      legs.forEach((l, i) => { l.rotation.x = mv ? sin(t * 4 + i * PI) * 0.5 : 0; });
    };
    return { g, body, parts, lh: o.lh };
  }
  B.golem = () => golem({ s: 1, stone: 0x9a9aa8, glow: 0xff8a3a, lid: 0xe8e8ee, lh: 3.8 });
  B.reQuang = () => golem({ s: 2, stone: 0x8a5a38, dark: 0x4a3322, glow: 0xffa040, crystals: 0xff9a2e, crown: true, lh: 7.5 });

  B.pinguino = () => {
    const { g, body } = root(), parts = {}, navy = M(0x2b3350), white = M(0xf2f6fa, { metalness: 0.4, roughness: 0.3 }), orange = M(0xf0a03c), dark = M(0x1c1b24);
    const bd = grp(body, 0, 1.0, 0); ell(bd, navy, 0.75, 0.98, 0.66, 0, 0, 0);
    box(bd, white, 0.8, 1.15, 0.18, 0, -0.02, 0.5); box(bd, dark, 0.8, 0.04, 0.2, 0, 0.3, 0.5); cyl(bd, M(0x9aa2ad, { metalness: 0.8 }), 0.04, 0.04, 0.45, 0.28, 0.5, 0.64); cyl(bd, M(0x9aa2ad, { metalness: 0.8 }), 0.04, 0.04, 0.3, 0.28, 0.0, 0.64);
    const hd = grp(bd, 0, 1.05, 0.05); ell(hd, navy, 0.46, 0.44, 0.44, 0, 0, 0); eye(hd, -0.18, 0.08, 0.36, 0.1); eye(hd, 0.18, 0.08, 0.36, 0.1);
    const bk = cone(hd, orange, 0.1, 0.3, 0, -0.06, 0.5); bk.rotation.x = PI / 2;
    const ice = E(0xa8e0ff, 0.6, { transparent: true, opacity: 0.9 }); for (let i = 0; i < 5; i++) { const c = cone(hd, ice, 0.07, 0.3, (i - 2) * 0.14, 0.5, 0, 4); c.rotation.z = -(i - 2) * 0.2; }
    const fl = [-1, 1].map((k) => { const f = limb(bd, navy, k * 0.78, 0.45, 0, 0.9, 0.1); f.rotation.z = k * 0.35; return f; });
    [-0.3, 0.3].forEach((x) => box(body, orange, 0.34, 0.1, 0.5, x, 0.07, 0.1));
    parts.tick = (e, dt, mv, t) => {
      bd.rotation.z = mv ? sin(t * 8) * 0.14 : sin(t * 1.5) * 0.02; body.position.y = mv ? Math.abs(sin(t * 8)) * 0.07 : 0;
      fl.forEach((f, i) => { const k = i ? 1 : -1; f.rotation.z = k * (e.st === 1 ? 1.5 : 0.35 + (mv ? sin(t * 8 + i * PI) * 0.35 : 0)); }); hd.rotation.x = e.st === 1 ? 0.35 : 0;
    };
    return { g, body, parts, lh: 2.7 };
  };

  B.orso = () => {
    const { g, body } = root(), parts = {}, fur = M(0xf4f8fc, { roughness: 0.9 }), cream = M(0xe3d8c0), dark = M(0x1c1b24), ice = E(0xa8e0ff, 0.8, { transparent: true, opacity: 0.9 });
    const bd = grp(body, 0, 1.3, 0); ell(bd, fur, 0.95, 0.85, 1.5, 0, 0, 0);
    for (let i = 0; i < 5; i++) { const c = cone(bd, ice, 0.14, 0.7, 0, 0.85, -0.9 + i * 0.45, 5); c.rotation.x = (i - 2) * -0.12; }
    const hd = grp(bd, 0, 0.45, 1.4); ell(hd, fur, 0.55, 0.5, 0.55, 0, 0, 0); ell(hd, cream, 0.3, 0.24, 0.32, 0, -0.12, 0.5); ell(hd, dark, 0.08, 0.06, 0.06, 0, -0.04, 0.8);
    [-1, 1].forEach((k) => { ell(hd, fur, 0.14, 0.14, 0.1, k * 0.38, 0.45, -0.05); eye(hd, k * 0.22, 0.14, 0.42, 0.08, 0x80d8ff); });
    const legs = [[-0.55, 1.0], [0.55, 1.0], [-0.55, -1.0], [0.55, -1.0]].map(([x, z]) => limb(bd, fur, x, -0.45, z, 1.0, 0.27));
    parts.tick = (e, dt, mv, t) => {
      legs.forEach((l, i) => { l.rotation.x = mv ? sin(t * 7 + (i === 1 || i === 2 ? PI : 0)) * 0.55 : 0; });
      bd.position.y = mv ? Math.abs(sin(t * 7)) * 0.06 : sin(t * 1.5) * 0.02; hd.rotation.x = e.st === 1 ? -0.5 : sin(t * 1.4) * 0.05; bd.rotation.x = e.st === 1 ? -0.25 : 0;
    };
    return { g, body, parts, lh: 3.2 };
  };

  B.regina = () => {
    const { g, body } = root(), parts = {}, icy = M(0x9fd4ff, { emissive: 0x4a90d0, emissiveIntensity: 0.3, transparent: true, opacity: 0.88, roughness: 0.2 }), skin = M(0xcfe6ff), hair = M(0xeaf6ff), shard = E(0xbfe8ff, 0.9, { transparent: true, opacity: 0.9 });
    const fl = grp(body, 0, 0.3, 0); const gown = cyl(fl, icy, 0.4, 1.35, 2.4, 0, 1.2, 0, 16);
    const up = grp(body, 0, 2.4, 0); cyl(up, icy, 0.32, 0.4, 0.7, 0, 0.3, 0); const hd = grp(up, 0, 1.0, 0); ell(hd, skin, 0.34, 0.4, 0.34, 0, 0, 0); eye(hd, -0.12, 0.04, 0.28, 0.07, 0x4aa8ff); eye(hd, 0.12, 0.04, 0.28, 0.07, 0x4aa8ff);
    ell(hd, hair, 0.38, 0.5, 0.3, 0, -0.1, -0.1);
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; cone(hd, shard, 0.07, 0.4 + (i % 2) * 0.2, cos(a) * 0.28, 0.4, sin(a) * 0.28, 4); }
    const aL = limb(up, skin, -0.5, 0.55, 0, 0.8, 0.09), aR = limb(up, skin, 0.5, 0.55, 0, 0.8, 0.09);
    const sc = grp(aR, 0, -0.8, 0.05); cyl(sc, M(0xe8f4ff, { metalness: 0.7 }), 0.03, 0.03, 1.6, 0, 0.5, 0, 6); octa(sc, shard, 0.2, 0, 1.45, 0); glow(sc, 0, 1.45, 0, 1.4, 0x9fd8ff, parts);
    for (let i = 0; i < 6; i++) { const sh = octa(body, shard, 0.17 + (i % 2) * 0.06, 0, 0, 0); orbiter(parts, sh, 1.9, 2.4, 0.9 + (i % 3) * 0.25, i / 6 * TAU, 0.3); }
    parts.tick = (e, dt, mv, t) => {
      body.position.y = 0.2 + sin(t * 1.6) * 0.15; fl.rotation.y = sin(t * 0.8) * 0.15; gown.scale.x = gown.scale.z = 1 + sin(t * 2) * 0.03;
      aL.rotation.x = e.st === 1 ? -2.4 : -0.3 + sin(t * 2) * 0.1; aL.rotation.z = -0.5; aR.rotation.x = e.st === 1 ? -2.6 : -0.6; aR.rotation.z = 0.2; up.rotation.x = e.st === 1 ? -0.2 : 0;
    };
    return { g, body, parts, lh: 6.0 };
  };

  B.cinder = () => {
    const { g, body } = root(), parts = {}, ash = M(0x2a2530, { roughness: 0.9 }), em = E(0xff7a2a, 1.2), horn = M(0x7a1f2a);
    const bd = grp(body, 0, 0.8, 0); ell(bd, ash, 0.5, 0.6, 0.45, 0, 0, 0); box(bd, em, 0.05, 0.4, 0.05, 0.1, 0.05, 0.42); box(bd, em, 0.28, 0.05, 0.05, 0, -0.1, 0.43);
    const hd = grp(bd, 0, 0.78, 0.05); ell(hd, ash, 0.4, 0.36, 0.38, 0, 0, 0); eye(hd, -0.15, 0.05, 0.3, 0.08, 0xffa040); eye(hd, 0.15, 0.05, 0.3, 0.08, 0xffa040);
    [-1, 1].forEach((k) => { const h = cone(hd, horn, 0.08, 0.38, k * 0.24, 0.36, 0, 5); h.rotation.z = -k * 0.5; });
    const aL = limb(bd, ash, -0.55, 0.3, 0, 0.7, 0.1), aR = limb(bd, ash, 0.55, 0.3, 0, 0.7, 0.1);
    [-0.22, 0.22].forEach((x) => limb(body, ash, x, 0.5, 0, 0.5, 0.12));
    const tail = grp(bd, 0, -0.3, -0.45); tail.rotation.x = -1.0; cyl(tail, ash, 0.07, 0.04, 0.8, 0, 0.4, 0, 6); glow(tail, 0, 0.9, 0, 1.0, 0xff7a2a, parts); cone(tail, em, 0.09, 0.3, 0, 0.9, 0, 5);
    glow(hd, 0, 0.55, 0, 0.8, 0xff7a2a, parts);
    parts.tick = (e, dt, mv, t) => { body.position.y = Math.abs(sin(t * (mv ? 9 : 3))) * (mv ? 0.25 : 0.05); aL.rotation.x = e.st === 1 ? -2.3 : sin(t * 9) * 0.5; aR.rotation.x = e.st === 1 ? -2.3 : -sin(t * 9) * 0.5; tail.rotation.z = sin(t * 5) * 0.3; bd.rotation.x = e.st === 1 ? -0.3 : 0.1; };
    return { g, body, parts, lh: 2.3 };
  };

  B.scorpio = () => {
    const { g, body } = root(), parts = {}, shell = M(0xd9a441, { roughness: 0.4, metalness: 0.3 }), dk = M(0x8a5a1c), red = E(0xff3b2a, 1.2);
    const bd = grp(body, 0, 0.55, 0); ell(bd, shell, 0.7, 0.42, 0.95, 0, 0, 0); ell(bd, shell, 0.45, 0.32, 0.4, 0, 0.0, 0.85); eye(bd, -0.15, 0.2, 1.15, 0.06, 0xff3b2a); eye(bd, 0.15, 0.2, 1.15, 0.06, 0xff3b2a);
    const claws = [-1, 1].map((k) => { const a = grp(bd, k * 0.62, 0.0, 0.75); a.rotation.y = -k * 0.35; cyl(a, dk, 0.07, 0.07, 0.8, 0, 0, 0.4, 6).rotation.x = PI / 2; const c = grp(a, 0, 0, 0.9); box(c, shell, 0.34, 0.12, 0.5, 0, 0, 0.1); const f = cone(c, dk, 0.1, 0.35, 0.12, 0, 0.45, 4); f.rotation.x = PI / 2; const f2 = cone(c, dk, 0.1, 0.35, -0.12, 0, 0.45, 4); f2.rotation.x = PI / 2; return a; });
    const joints = []; let par = bd; const base = [-0.6, 0.55, 0.55, 0.55, 0.5];
    base.forEach((b, i) => { const j = grp(par, 0, i ? 0.42 : 0.2, i ? 0 : -0.8); j.rotation.x = b; ell(j, shell, 0.17 - i * 0.015, 0.26, 0.17 - i * 0.015, 0, 0.2, 0); joints.push({ j, b }); par = j; });
    cone(par, red, 0.1, 0.4, 0, 0.55, 0, 5); glow(par, 0, 0.6, 0, 0.9, 0xff3b2a, parts);
    const legs = []; for (let i = 0; i < 8; i++) { const k = i < 4 ? 1 : -1, idx = i % 4, h = grp(bd, k * 0.5, -0.05, 0.6 - idx * 0.4); h.rotation.z = k * 1.2; cyl(h, dk, 0.045, 0.03, 0.8, 0, -0.4, 0, 5); legs.push({ h, k, ph: (idx % 2) * PI }); }
    parts.tick = (e, dt, mv, t) => {
      legs.forEach((l) => { l.h.rotation.z = l.k * (1.2 + sin(t * (mv ? 12 : 2) + l.ph) * (mv ? 0.2 : 0.04)); });
      joints.forEach((o, i) => { o.j.rotation.x = e.st === 1 ? o.b * 0.4 - (i ? 0 : 0.2) : o.b + sin(t * 2 + i * 0.5) * 0.08; });
      claws.forEach((c, i) => { c.rotation.x = e.st === 1 ? -0.5 : sin(t * 3 + i) * 0.1; }); body.position.y = mv ? Math.abs(sin(t * 12)) * 0.03 : 0;
    };
    return { g, body, parts, lh: 2.6 };
  };

  B.mummia = () => {
    const { g, body } = root(), parts = {}, wrap = M(0xd8cfae, { roughness: 0.95 }), dk = M(0x4a3f2a), eg = E(0x7aff9a, 1.4);
    const bd = grp(body, 0, 0, 0); cyl(bd, wrap, 0.5, 0.62, 1.5, 0, 1.5, 0, 10);
    for (let i = 0; i < 5; i++) { const r = tor(bd, M(0xc2b78f, { roughness: 1 }), 0.55 + (4 - i) * 0.018, 0.04, 0, 0.95 + i * 0.28, 0, 14); r.rotation.x = PI / 2 + (i % 2 ? 0.2 : -0.2); }
    const hd = grp(bd, 0, 2.6, 0.05); ell(hd, wrap, 0.4, 0.45, 0.4, 0, 0, 0); ell(hd, dk, 0.1, 0.1, 0.06, -0.15, 0.06, 0.34); ell(hd, eg, 0.08, 0.08, 0.06, 0.15, 0.06, 0.35); glow(hd, 0.15, 0.06, 0.4, 0.5, 0x7aff9a, parts);
    const aL = limb(bd, wrap, -0.7, 2.15, 0.05, 1.0, 0.15), aR = limb(bd, wrap, 0.7, 2.15, 0.05, 1.0, 0.15);
    const legs = [-1, 1].map((k) => limb(body, wrap, k * 0.28, 0.9, 0, 0.9, 0.2));
    const strips = [-1, 0, 1].map((k) => { const s = new T.Mesh(G('strip', () => new T.PlaneGeometry(0.14, 0.9)), new T.MeshStandardMaterial({ color: 0xcfc59c, side: T.DoubleSide, roughness: 1 })); const gg = grp(bd, k * 0.3, 1.1, -0.55); s.position.y = -0.45; gg.add(s); return gg; });
    parts.tick = (e, dt, mv, t) => {
      bd.rotation.z = sin(t * (mv ? 4 : 1.5)) * 0.06; body.position.y = mv ? Math.abs(sin(t * 4)) * 0.06 : 0;
      aL.rotation.x = e.st === 1 ? -2.4 : -1.2 + sin(t * 2.5) * 0.15; aR.rotation.x = e.st === 1 ? -2.4 : -1.2 + sin(t * 2.5 + 1) * 0.15; aL.rotation.z = -0.12; aR.rotation.z = 0.12;
      legs.forEach((l, i) => { l.rotation.x = mv ? sin(t * 4 + i * PI) * 0.4 : 0; }); strips.forEach((s, i) => { s.rotation.x = 0.3 + sin(t * 3 + i) * 0.2 + (mv ? 0.3 : 0); });
    };
    return { g, body, parts, lh: 3.5 };
  };

  B.sethra = () => {
    const { g, body } = root(), parts = {}, gold = M(0xe0b83a, { metalness: 0.85, roughness: 0.25 }), linen = M(0xf1ead2), skin = M(0xc89868), blue = M(0x2a6ab8, { metalness: 0.4 }), cyan = E(0x4ae0e0, 0.8);
    const fl = grp(body, 0, 0, 0); cyl(fl, linen, 0.45, 0.95, 2.0, 0, 1.1, 0, 14); tor(fl, gold, 0.72, 0.05, 0, 0.5, 0, 16).rotation.x = PI / 2;
    const up = grp(body, 0, 2.2, 0); cyl(up, linen, 0.4, 0.46, 0.8, 0, 0.3, 0); const col = tor(up, gold, 0.4, 0.09, 0, 0.62, 0, 16); col.rotation.x = PI / 2.4; ell(up, cyan, 0.09, 0.09, 0.05, 0, 0.5, 0.42);
    const hd = grp(up, 0, 1.1, 0); ell(hd, skin, 0.3, 0.36, 0.3, 0, 0, 0.02); eye(hd, -0.11, 0.05, 0.26, 0.06, null); eye(hd, 0.11, 0.05, 0.26, 0.06, null);
    box(hd, gold, 0.74, 0.28, 0.62, 0, 0.26, -0.02); [-1, 1].forEach((k) => { box(hd, blue, 0.2, 0.8, 0.22, k * 0.38, -0.2, -0.05); box(hd, gold, 0.21, 0.08, 0.23, k * 0.38, -0.05, -0.05); box(hd, gold, 0.21, 0.08, 0.23, k * 0.38, -0.3, -0.05); });
    cone(hd, gold, 0.06, 0.25, 0, 0.5, 0.25, 4); box(hd, blue, 0.1, 0.35, 0.1, 0, -0.38, 0.28);
    const aL = limb(up, skin, -0.6, 0.65, 0, 0.9, 0.1), aR = limb(up, skin, 0.6, 0.65, 0, 0.9, 0.1);
    const crook = grp(aR, 0, -0.9, 0.1); cyl(crook, gold, 0.035, 0.035, 2.2, 0, 0.6, 0, 6); const hook = tor(crook, gold, 0.18, 0.035, 0, 1.75, 0.0, 12); hook.rotation.y = PI / 2;
    const flail = grp(aL, 0, -0.9, 0.1); cyl(flail, gold, 0.03, 0.03, 0.8, 0, 0.3, 0, 6); [-0.12, 0, 0.12].forEach((x) => cyl(flail, M(0xe0b83a), 0.015, 0.015, 0.5, x, 0.85, 0, 4));
    for (let i = 0; i < 4; i++) { const sc = ell(body, cyan, 0.13, 0.08, 0.17, 0, 0, 0); orbiter(parts, sc, 1.6, 2.2 + (i % 2) * 0.6, 1.0 + i * 0.1, i / 4 * TAU, 0.2); }
    glow(up, 0, 0.7, 0, 3.2, 0xe0b83a, parts);
    parts.tick = (e, dt, mv, t) => {
      body.position.y = 0.25 + sin(t * 1.5) * 0.12; aR.rotation.x = e.st === 1 ? -2.6 : -0.4 + sin(t * 1.5) * 0.1; aL.rotation.x = e.st === 1 ? -2.4 : -0.5; aL.rotation.z = -0.2; aR.rotation.z = 0.15; fl.rotation.y = sin(t * 0.9) * 0.1;
    };
    return { g, body, parts, lh: 5.2 };
  };

  B.demone = () => {
    const { g, body } = root(), parts = {}, skin = M(0x3b2160, { roughness: 0.5 }), dk = M(0x1a0f2e), horn = M(0xe8e0c8), em = E(0xff4aa0, 1.4), memb = M(0x5a2a8a, { side: T.DoubleSide, emissive: 0x2a0a50, emissiveIntensity: 0.4 });
    const bd = grp(body, 0, 2.0, 0); ell(bd, skin, 0.7, 1.0, 0.55, 0, 0, 0); ell(bd, dk, 0.45, 0.6, 0.3, 0, -0.1, 0.35); box(bd, em, 0.07, 0.5, 0.05, 0, 0.1, 0.62);
    const hd = grp(bd, 0, 1.2, 0.05); ell(hd, skin, 0.4, 0.42, 0.4, 0, 0, 0); eye(hd, -0.16, 0.06, 0.32, 0.08, 0xff4aa0); eye(hd, 0.16, 0.06, 0.32, 0.08, 0xff4aa0);
    [-1, 1].forEach((k) => { const h = cone(hd, horn, 0.1, 0.65, k * 0.28, 0.42, -0.05, 5); h.rotation.z = -k * 0.6; h.rotation.x = -0.3; const sp = cone(bd, dk, 0.11, 0.4, k * 0.7, 0.78, 0, 5); sp.rotation.z = -k * 0.8; });
    const wings = [-1, 1].map((k) => { const w = grp(bd, k * 0.45, 0.5, -0.3); [0, 1, 2].forEach((i) => { const f = cone(w, dk, 0.05, 1.6 - i * 0.2, k * (0.6 + i * 0.35), 0.2 - i * 0.5, 0, 4); f.rotation.z = -k * (1.3 + i * 0.2); });
      const m = mk(G('wing', () => new T.PlaneGeometry(2.1, 1.5)), memb, w, k * 1.1, -0.1, -0.02); m.rotation.z = k * 0.1; return w; });
    const aL = limb(bd, skin, -0.85, 0.55, 0, 1.2, 0.14), aR = limb(bd, skin, 0.85, 0.55, 0, 1.2, 0.14);
    [aL, aR].forEach((a) => [-1, 0, 1].forEach((k) => { const c = cone(a, horn, 0.035, 0.25, k * 0.07, -1.28, 0.03, 4); c.rotation.x = PI; }));
    [-0.3, 0.3].forEach((x) => limb(body, skin, x, 1.1, 0, 1.1, 0.19));
    glow(bd, 0, 0.3, 0, 3.0, 0x9a3aff, parts);
    parts.tick = (e, dt, mv, t) => {
      body.position.y = 0.2 + sin(t * 1.8) * 0.12; wings.forEach((w, i) => { const k = i ? 1 : -1; w.rotation.z = k * (0.2 + sin(t * (mv ? 7 : 3)) * 0.35); w.rotation.y = -k * 0.3; });
      aL.rotation.x = e.st === 1 ? -2.4 : sin(t * 2) * 0.2; aR.rotation.x = e.st === 1 ? -2.4 : -sin(t * 2) * 0.2; bd.rotation.x = e.st === 1 ? -0.3 : 0.05;
    };
    return { g, body, parts, lh: 4.6 };
  };

  B.drago = () => {
    const { g, body } = root(), parts = {}, sc = M(0x7a1f2a, { roughness: 0.5 }), belly = M(0xd9b88a), horn = M(0xe8e0c8), dk = M(0x3a0f16), memb = M(0x9a2a3a, { side: T.DoubleSide, emissive: 0x3a0810, emissiveIntensity: 0.4 }), em = E(0xffd34a, 1.3);
    const bd = grp(body, 0, 1.3, 0); ell(bd, sc, 0.9, 0.72, 1.5, 0, 0, 0); ell(bd, belly, 0.6, 0.45, 1.2, 0, -0.3, 0.1);
    for (let i = 0; i < 5; i++) cone(bd, dk, 0.1, 0.35, 0, 0.72, -0.9 + i * 0.5, 4);
    const neck = []; let par = bd;
    [0, 1, 2].forEach((i) => { const j = grp(par, 0, i ? 0.55 : 0.2, i ? 0 : 1.2); j.rotation.x = i ? -0.35 : 0.9; ell(j, sc, 0.32 - i * 0.04, 0.4, 0.32 - i * 0.04, 0, 0.25, 0); neck.push({ j, b: j.rotation.x }); par = j; });
    const hd = grp(par, 0, 0.6, 0.12); hd.rotation.x = 0.9; ell(hd, sc, 0.38, 0.32, 0.5, 0, 0, 0.1); ell(hd, sc, 0.26, 0.2, 0.35, 0, -0.05, 0.55); eye(hd, -0.2, 0.14, 0.2, 0.07, 0xffd34a); eye(hd, 0.2, 0.14, 0.2, 0.07, 0xffd34a);
    [-1, 1].forEach((k) => { const h = cone(hd, horn, 0.07, 0.5, k * 0.2, 0.3, -0.15, 5); h.rotation.x = -0.9; });
    const fire = glow(hd, 0, -0.05, 0.85, 0.01, 0xff7a2a, parts); fire.userData.fire = 1;
    const wings = [-1, 1].map((k) => { const w = grp(bd, k * 0.7, 0.55, 0.1); [0, 1, 2].forEach((i) => { const f = cone(w, dk, 0.045, 1.9 - i * 0.2, k * (0.9 + i * 0.5), 0.2 - i * 0.2, 0, 4); f.rotation.z = -k * (1.4 + i * 0.12); });
      const m = mk(G('dwing', () => new T.PlaneGeometry(2.6, 1.6)), memb, w, k * 1.3, 0, 0); return w; });
    const tj = []; par = bd;
    [0, 1, 2, 3, 4].forEach((i) => { const j = i ? grp(par, 0, 0.5, 0) : grp(par, 0, 0, -1.35); j.rotation.x = i ? 0.12 : -1.9; ell(j, sc, 0.3 - i * 0.045, 0.4, 0.3 - i * 0.045, 0, 0.2, 0); tj.push(j); par = j; });
    const legs = [[-0.6, 0.8], [0.6, 0.8], [-0.6, -0.8], [0.6, -0.8]].map(([x, z]) => limb(bd, sc, x, -0.4, z, 0.8, 0.2));
    parts.tick = (e, dt, mv, t) => {
      body.position.y = Math.abs(sin(t * (mv ? 6 : 1.6))) * 0.08; wings.forEach((w, i) => { const k = i ? 1 : -1; w.rotation.z = k * (0.15 + sin(t * (e.st === 1 ? 10 : 3)) * 0.5); });
      neck.forEach((n, i) => { n.j.rotation.x = n.b + (e.st === 1 ? (i ? -0.2 : -0.5) : sin(t * 1.5 + i) * 0.05); }); tj.forEach((j, i) => { if (i) j.rotation.y = sin(t * 2 + i * 0.6) * 0.25; else j.rotation.y = sin(t * 2) * 0.15; });
      legs.forEach((l, i) => { l.rotation.x = mv ? sin(t * 6 + (i === 1 || i === 2 ? PI : 0)) * 0.5 : 0; }); fire.scale.setScalar(e.st === 1 ? 1.4 + sin(t * 30) * 0.2 : 0.01);
    };
    return { g, body, parts, lh: 3.4 };
  };

  B.vuoto = () => {
    const { g, body } = root(), parts = {}, dk = M(0x1a0b30, { roughness: 0.4, metalness: 0.2 }), vio = E(0xa04aff, 1.2), white = M(0xf4eefc, { roughness: 0.2 }), tent = [];
    const orb = grp(body, 0, 3.4, 0); ell(orb, dk, 1.6, 1.6, 1.6, 0, 0, 0);
    ell(orb, white, 0.95, 0.95, 0.5, 0, 0.1, 1.35); ell(orb, vio, 0.55, 0.55, 0.3, 0, 0.1, 1.62); box(orb, M(0x08040f), 0.12, 0.7, 0.05, 0, 0.1, 1.86);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU, root0 = grp(orb, cos(a) * 1.0, -1.15, sin(a) * 1.0); root0.rotation.y = -a; const chain = []; let par = root0;
      for (let j = 0; j < 4; j++) { const sj = grp(par, 0, j ? -0.8 : 0, 0); sj.rotation.x = 0.35; cyl(sj, dk, 0.2 - j * 0.04, 0.16 - j * 0.04, 0.85, 0, -0.42, 0, 7); if (j === 3) ell(sj, vio, 0.12, 0.12, 0.12, 0, -0.9, 0); chain.push(sj); par = sj; }
      tent.push({ chain, ph: i * 0.8 });
    }
    const r1 = tor(orb, vio, 2.3, 0.05, 0, 0, 0, 40), r2 = tor(orb, vio, 2.7, 0.04, 0, 0, 0, 40); r1.rotation.x = PI / 2.3; r2.rotation.y = PI / 2.4;
    for (let i = 0; i < 4; i++) { const m = octa(orb, vio, 0.16, 0, 0, 0); orbiter(parts, m, 2.0, 0, 1.0 + i * 0.1, i / 4 * TAU, 0.5); }
    glow(orb, 0, 0, 0, 7, 0x8a2aff, parts);
    parts.tick = (e, dt, mv, t) => {
      body.position.y = sin(t * 1.3) * 0.25; r1.rotation.z += dt * 0.7; r2.rotation.x += dt * 0.5; orb.rotation.y = sin(t * 0.5) * 0.15;
      tent.forEach((tt) => tt.chain.forEach((j, k) => { j.rotation.x = 0.35 + sin(t * 2 + tt.ph + k * 0.7) * (e.st === 1 ? 0.7 : 0.25); }));
    };
    return { g, body, parts, lh: 6.8 };
  };

  /* ---------- hook the game's monster creation ---------- */
  const KEY = {}; Object.keys(RU.ENEMIES).forEach((k) => { KEY[RU.ENEMIES[k].name] = k; });
  function aura(d, built) {
    const col = d.tint || 0xffb347, sc = built.g.scale.x || 1, r = (d.radius || 1.5) * 1.15 / sc;
    const ring = new T.Mesh(new T.RingGeometry(r * 0.8, r, 40), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, side: T.DoubleSide, depthWrite: false }));
    ring.rotation.x = -PI / 2; ring.position.y = 0.15; built.g.add(ring);
    built.parts = built.parts || {}; built.parts.aura = ring;
  }
  const skin0 = Z.skin;
  Z.skin = function (d, built) {
    const key = KEY[d.name], b = B[key];
    if (b && !MV.off) {
      let r = null; try { r = b(); } catch (err) { console.warn('[monsters] ' + key, err); }
      if (r) {
        while (built.g.children.length) built.g.remove(built.g.children[0]);
        r.g.children.slice().forEach((c) => built.g.add(c));
        built.body = r.body; built.parts = r.parts; built.anim = 'mon'; d.lh = r.lh; d._lhs = 1;
        if (d.elite || d.boss) aura(d, built);
        return;
      }
    }
    skin0.apply(this, arguments);
    if (d.elite || d.boss) aura(d, built);
  };

  /* ---------- animation ---------- */
  let lastT = 0, warned = false;
  function frame() {
    if (MV.off) return;
    const time = H.time; let dt = time - lastT; lastT = time; if (!(dt > 0)) return; dt = Math.min(dt, 0.1);
    const R = H.R, q = Q();
    X.enemyById.forEach((e) => {
      const p = e.parts; if (!p || e.dead) return;
      if (Math.hypot(e.x - R.x, e.z - R.z) > 90) return;
      const mv = e._px != null && Math.hypot(e.x - e._px, e.z - e._pz) / dt > 0.4; e._px = e.x; e._pz = e.z;
      const t = e.t || time;
      if (p.tick) p.tick(e, dt, mv, t);
      if (p.orbit) p.orbit.forEach((o) => { o.m.visible = q > 0; o.m.position.set(cos(t * o.sp + o.ph) * o.r, o.y + sin(t * o.sp * 1.3 + o.ph) * o.a, sin(t * o.sp + o.ph) * o.r); o.m.rotation.y += dt * 2; });
      if (p.glows) p.glows.forEach((s) => { if (s.userData.fire) return; s.visible = q > 0; });
      if (p.aura) p.aura.material.opacity = 0.35 + 0.2 * sin(t * 3);
    });
  }
  const sc = X.scene, prev = sc.onBeforeRender;
  sc.onBeforeRender = function () {
    try { frame(); } catch (err) { if (!warned) { warned = true; MV.off = true; console.warn('[monsters] tat do loi:', err); } }
    if (prev) prev.apply(this, arguments);
  };
  console.log('[monsters] da nap: ' + Object.keys(B).length + ' mo hinh quai moi');
})();
