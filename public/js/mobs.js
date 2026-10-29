/* Aetherfall monsters in a blocky, Minecraft Dungeons-like style (browser, visual only).
   Every monster type gets a model made of boxes with 16x16 pixel textures: slimes, zombies, husks, skeletons, strays, a wither skeleton,
   spiders, a blaze, iron golems, endermen, witches, a polar bear, ravagers, a ghast, a dragon and the wither.
   Hooks AF_ZONES.skin (after monsters.js) and animates with parts.tick, which monsters.js already calls every frame.
   Names, stats, hit boxes and AI stay exactly as they were. */
(function () {
  'use strict';
  const H = window.AF_CH, RU = window.AF_RULES, T = window.THREE, Z = window.AF_ZONES;
  if (!H || !RU || !T || !Z || !Z.skin) { console.warn('[mobs] thieu AF_ZONES, bo qua'); return; }
  const PI = Math.PI, sin = Math.sin, cos = Math.cos;
  const MB = window.AF_MOBS = { off: false };
  try { MB.off = localStorage.getItem('af-mobs') === '0'; } catch (e) { /* ignore */ }

  /* ---------- pixel textures ---------- */
  function tex(draw) { const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'); draw(g); const t = new T.CanvasTexture(c); t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; t.generateMipmaps = false; return t; }
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const NOISE = tex((g) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = 200 + Math.floor(rnd() * 55); g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.fillRect(x, y, 1, 1); } });
  const px = (g, c, pts) => { g.fillStyle = c; pts.forEach((p) => g.fillRect(p[0], p[1], p[2] || 1, p[3] || 1)); };
  const base = (g, c) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = 0.82 + rnd() * 0.18; g.fillStyle = shade(c, v); g.fillRect(x, y, 1, 1); } };
  function shade(hex, k) { const r = ((hex >> 16) & 255) * k, gg = ((hex >> 8) & 255) * k, b = (hex & 255) * k; return 'rgb(' + (r | 0) + ',' + (gg | 0) + ',' + (b | 0) + ')'; }
  const FACES = {};
  function face(kind, col) {
    const k = kind + col; if (FACES[k]) return FACES[k];
    FACES[k] = tex((g) => {
      base(g, col);
      if (kind === 'zombie') { px(g, '#1a2a10', [[3, 6, 3, 2], [10, 6, 3, 2], [5, 11, 6, 1]]); px(g, '#2a3a1a', [[7, 8, 2, 2]]); }
      else if (kind === 'skull') { px(g, '#1a1a1a', [[3, 6, 3, 3], [10, 6, 3, 3], [7, 10, 2, 1], [4, 12, 8, 1]]); px(g, '#555', [[5, 13, 1, 1], [7, 13, 1, 1], [9, 13, 1, 1]]); }
      else if (kind === 'creeper') { px(g, '#0a0a0a', [[3, 4, 3, 3], [10, 4, 3, 3], [6, 8, 4, 2], [5, 10, 6, 3]]); px(g, shade(col, 0.82), [[6, 12, 1, 1], [9, 12, 1, 1]]); }
      else if (kind === 'ender') { px(g, '#0a0a0e', [[0, 0, 16, 16]]); px(g, '#e080ff', [[2, 7, 4, 1], [10, 7, 4, 1]]); px(g, '#c040ff', [[3, 7, 2, 1], [11, 7, 2, 1]]); }
      else if (kind === 'slime') { px(g, '#1a3a12', [[3, 4, 2, 2], [11, 4, 2, 2], [6, 10, 2, 1]]); }
      else if (kind === 'blaze') { px(g, '#3a1a00', [[3, 6, 3, 2], [10, 6, 3, 2], [5, 11, 6, 1]]); px(g, '#ffffa0', [[4, 6, 1, 1], [11, 6, 1, 1]]); }
      else if (kind === 'spider') { px(g, '#ff2020', [[3, 5, 2, 2], [11, 5, 2, 2], [5, 4, 1, 1], [10, 4, 1, 1], [6, 7, 1, 1], [9, 7, 1, 1], [4, 9, 1, 1], [11, 9, 1, 1]]); }
      else if (kind === 'golem') { px(g, '#5a5a50', [[3, 5, 10, 2]]); px(g, '#a01010', [[4, 6, 2, 1], [10, 6, 2, 1]]); px(g, shade(col, 0.7), [[7, 7, 2, 5]]); }
      else if (kind === 'witch') { px(g, '#2a1a10', [[3, 6, 3, 2], [10, 6, 3, 2]]); px(g, '#4aa040', [[4, 6, 1, 1], [11, 6, 1, 1]]); px(g, shade(col, 0.75), [[7, 8, 2, 5]]); px(g, '#3a2a1a', [[5, 13, 6, 1]]); }
      else if (kind === 'beast') { px(g, '#1a1a1a', [[2, 4, 3, 2], [11, 4, 3, 2], [4, 10, 8, 2]]); px(g, '#e8e0c8', [[4, 12, 1, 2], [11, 12, 1, 2]]); }
      else if (kind === 'ghast') { px(g, '#2a2a2a', [[3, 5, 3, 1], [10, 5, 3, 1], [5, 10, 6, 3]]); px(g, '#c03030', [[4, 7, 1, 2], [11, 7, 1, 2]]); }
      else if (kind === 'wither') { px(g, '#0a0a0a', [[3, 5, 3, 3], [10, 5, 3, 3], [5, 11, 6, 2]]); px(g, '#80e0ff', [[4, 6, 1, 1], [11, 6, 1, 1]]); }
      else if (kind === 'bear') { px(g, '#1a1a1a', [[3, 5, 2, 2], [11, 5, 2, 2], [6, 10, 4, 3]]); }
      else if (kind === 'dragon') { px(g, '#ff40ff', [[2, 6, 4, 2], [10, 6, 4, 2]]); px(g, '#1a1a1a', [[4, 12, 8, 2]]); }
    });
    return FACES[k];
  }
  /* materials are per monster because the hit flash edits them */
  const mat = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, map: NOISE, roughness: 0.95, metalness: 0 }, o || {}));
  const glowMat = (c, i) => new T.MeshStandardMaterial({ color: c, map: NOISE, emissive: c, emissiveIntensity: i == null ? 0.9 : i, roughness: 0.6 });
  function cube(p, w, h, d, m, x, y, z) { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; p.add(o); return o; }
  function head(p, s, kind, col, m, x, y, z) { const fm = new T.MeshStandardMaterial({ color: 0xffffff, map: face(kind, col), roughness: 0.95 }); return cube(p, s, s, s, [m, m, m, m, fm, m], x, y, z); }
  function limb(p, w, h, d, m, x, y, z) { const g = new T.Group(); g.position.set(x, y, z); p.add(g); cube(g, w, h, d, m, 0, -h / 2, 0); return g; }

  /* ---------- builders: return { g, tick(e, dt, moving, t), h } (h = height before scaling) ---------- */
  function humanoid(o) {
    const g = new T.Group(), skin = mat(o.skin), top = mat(o.shirt), bot = mat(o.pants), W = o.thin ? 0.14 : 0.25, L = o.tall ? 1.5 : 0.75;
    const legL = limb(g, W, L, W, bot, -0.13, L, 0), legR = limb(g, W, L, W, bot, 0.13, L, 0);
    const body = cube(g, 0.5, 0.75, o.thin ? 0.16 : 0.26, top, 0, L + 0.375, 0);
    if (o.robe) cube(g, 0.6, L + 0.5, 0.42, top, 0, (L + 0.5) / 2, 0);
    if (o.ribs) for (let i = 0; i < 3; i++) cube(g, 0.42, 0.05, 0.18, mat(0x2a2a26), 0, L + 0.25 + i * 0.18, 0.02);
    const sh = L + 0.72, armL = limb(g, W, L * (o.tall ? 1 : 1), W, o.armSkin ? skin : top, -0.25 - W / 2, sh, 0), armR = limb(g, W, L, W, o.armSkin ? skin : top, 0.25 + W / 2, sh, 0);
    if (o.armSkin) { cube(armL, W * 1.02, 0.3, W * 1.02, top, 0, -0.15, 0); cube(armR, W * 1.02, 0.3, W * 1.02, top, 0, -0.15, 0); }
    const hd = head(g, 0.5, o.face, o.faceCol || o.skin, skin, 0, L + 1.0, 0);
    if (o.hat === 'witch') { const hm = mat(o.hatCol || 0x2a1a3a); cube(g, 0.7, 0.08, 0.7, hm, 0, L + 1.29, 0); cube(g, 0.42, 0.3, 0.42, hm, 0, L + 1.45, 0); const tip = cube(g, 0.22, 0.3, 0.22, hm, 0.04, L + 1.72, -0.05); tip.rotation.z = -0.25; }
    if (o.hat === 'crown') { const cm = glowMat(o.hatCol || 0x9fe0ff, 0.6); for (let i = 0; i < 4; i++) cube(g, 0.12, 0.2, 0.12, cm, (i % 2 ? 1 : -1) * 0.2, L + 1.33, (i < 2 ? 1 : -1) * 0.2); cube(g, 0.56, 0.08, 0.56, cm, 0, L + 1.27, 0); }
    if (o.hat === 'miner') { cube(g, 0.58, 0.14, 0.58, mat(0xd8b020), 0, L + 1.3, 0); cube(g, 0.14, 0.1, 0.06, glowMat(0xfff0a0, 1), 0, L + 1.3, 0.3); }
    if (o.horns) [-1, 1].forEach((k) => { const hn = cube(g, 0.1, 0.32, 0.1, mat(0xe8e0c8), k * 0.22, L + 1.36, 0); hn.rotation.z = -k * 0.4; });
    if (o.eyes) { const em = glowMat(o.eyes, 1.4); cube(hd, 0.1, 0.05, 0.02, em, -0.13, 0.02, 0.26); cube(hd, 0.1, 0.05, 0.02, em, 0.13, 0.02, 0.26); }
    let tool = null;
    if (o.tool === 'bow') { tool = new T.Group(); const wm = mat(0x6a4a2a); cube(tool, 0.06, 0.8, 0.06, wm, 0, -L, 0.12); cube(tool, 0.06, 0.2, 0.06, wm, 0, -L + 0.45, 0.2); cube(tool, 0.06, 0.2, 0.06, wm, 0, -L - 0.45, 0.2); armR.add(tool); }
    if (o.tool === 'sword') { tool = new T.Group(); cube(tool, 0.1, 1.2, 0.04, mat(0x3a3a3a, { metalness: 0.4 }), 0, -L - 0.45, 0.2); cube(tool, 0.3, 0.08, 0.08, mat(0x2a1a10), 0, -L + 0.1, 0.2); armR.add(tool); }
    if (o.tool === 'pick') { tool = new T.Group(); cube(tool, 0.07, 0.8, 0.07, mat(0x6a4a2a), 0, -L - 0.2, 0.15); cube(tool, 0.5, 0.1, 0.1, mat(0x8a8a90, { metalness: 0.5 }), 0, -L - 0.55, 0.15); armR.add(tool); }
    if (o.tool === 'staff') { tool = new T.Group(); cube(tool, 0.07, 1.4, 0.07, mat(0x5a3a1a), 0, -L, 0.15); cube(tool, 0.18, 0.18, 0.18, glowMat(o.hatCol || 0xa0e0ff, 1.2), 0, -L + 0.75, 0.15); armR.add(tool); }
    const fwd = !!o.reach;
    if (fwd) { armL.rotation.x = -PI / 2; armR.rotation.x = -PI / 2; }
    return {
      g, h: L + 1.25 + (o.hat ? 0.4 : 0),
      tick(e, dt, mv, t) {
        const sp = mv ? 7 : 0, sw = mv ? sin(t * sp) * 0.7 : 0;
        legL.rotation.x = sw; legR.rotation.x = -sw;
        const atk = e.st === 1 || e.st === 2;
        if (fwd) { armL.rotation.x = -PI / 2 + sin(t * 3) * 0.08 + (atk ? -0.5 : 0); armR.rotation.x = -PI / 2 - sin(t * 3) * 0.08 + (atk ? -0.5 : 0); }
        else { armL.rotation.x = -sw * 0.8; armR.rotation.x = atk ? -PI * 0.75 : sw * 0.8; }
        if (o.robe) { legL.visible = legR.visible = false; }
        hd.rotation.y = sin(t * 0.7) * 0.25;
      }
    };
  }
  function creeper(o) {
    const g = new T.Group(), m = mat(o.col), legs = [];
    const body = cube(g, 0.5, 0.85, 0.32, m, 0, 0.375 + 0.425, 0), hd = head(g, 0.5, 'creeper', o.col, m, 0, 1.47, 0);
    [[-0.13, 0.17], [0.13, 0.17], [-0.13, -0.17], [0.13, -0.17]].forEach((p) => legs.push(limb(g, 0.24, 0.375, 0.24, m, p[0], 0.375, p[1])));
    const mats = [m, hd.material[0]];
    return { g, h: 1.75, tick(e, dt, mv, t) { const sw = mv ? sin(t * 9) * 0.6 : 0; legs.forEach((l, i) => { l.rotation.x = i % 3 ? sw : -sw; }); const sw2 = e.st === 1 ? 1 + 0.12 + sin(t * 30) * 0.06 : 1; body.scale.setScalar(sw2); hd.scale.setScalar(sw2); if (e.st === 1 && e.flash <= 0) mats.forEach((q) => { q.emissive.setHex(0xffffff); q.emissiveIntensity = (sin(t * 30) > 0 ? 0.5 : 0); }); else if (e.flash <= 0) mats.forEach((q) => { q.emissiveIntensity = 0; }); } };
  }
  function spider(o) {
    const g = new T.Group(), m = mat(o.col), legs = [];
    cube(g, 0.95, 0.7, 1.05, m, 0, 0.62, -0.45); cube(g, 0.62, 0.55, 0.55, m, 0, 0.6, 0.25);
    head(g, 0.62, 'spider', o.col, m, 0, 0.62, 0.7);
    for (let i = 0; i < 4; i++) [-1, 1].forEach((k) => { const l = new T.Group(); l.position.set(k * 0.3, 0.62, 0.35 - i * 0.28); g.add(l); const s = cube(l, 1.3, 0.1, 0.1, m, k * 0.6, 0, 0); s.rotation.z = k * -0.55; l.rotation.y = k * (0.5 - i * 0.33); legs.push({ l, k, i }); });
    if (o.tail) { const tm = mat(o.col); const t1 = cube(g, 0.2, 0.2, 0.6, tm, 0, 0.9, -1.1); t1.rotation.x = -0.8; cube(g, 0.25, 0.25, 0.25, glowMat(0xff6a1a, 0.8), 0, 1.35, -1.35); }
    return { g, h: 1.2, tick(e, dt, mv, t) { legs.forEach((q) => { q.l.rotation.z = (mv ? sin(t * 14 + q.i * 1.7 + (q.k > 0 ? PI : 0)) * 0.25 : 0); }); g.children[0].position.y = 0.62 + (mv ? Math.abs(sin(t * 14)) * 0.04 : 0); } };
  }
  function slime(o) {
    const g = new T.Group(), body = new T.Group(); g.add(body);
    const outer = cube(body, 1, 1, 1, new T.MeshStandardMaterial({ color: o.col, map: NOISE, transparent: true, opacity: 0.72, roughness: 0.3 }), 0, 0.5, 0);
    const im = mat(o.inner || o.col); cube(body, 0.6, 0.6, 0.6, im, 0, 0.45, 0);
    const fm = new T.MeshStandardMaterial({ color: 0xffffff, map: face('slime', o.col), transparent: true, opacity: 0.95 }); const f = new T.Mesh(new T.PlaneGeometry(0.98, 0.98), fm); f.position.set(0, 0.5, 0.505); body.add(f);
    if (o.cap) { const cm = mat(o.cap); cube(body, 1.1, 0.3, 1.1, cm, 0, 1.15, 0); cube(body, 0.6, 0.25, 0.6, cm, 0, 1.4, 0); const dm = mat(0xf0e8d0); [[-0.3, 0.3], [0.32, -0.2], [0.05, 0.42]].forEach((p) => cube(body, 0.18, 0.06, 0.18, dm, p[0], 1.31, p[1])); }
    if (o.crown) { const cm = glowMat(0xffd25a, 0.7); for (let i = 0; i < 4; i++) cube(body, 0.14, 0.24, 0.14, cm, (i % 2 ? 1 : -1) * 0.3, o.cap ? 1.65 : 1.15, (i < 2 ? 1 : -1) * 0.3); }
    let ph = Math.random() * 6;
    return { g, h: o.cap ? 1.7 : 1.1, tick(e, dt, mv, t) { ph += dt * (mv ? 5 : 2); const hop = mv ? Math.max(0, sin(ph)) : Math.max(0, sin(ph)) * 0.15; body.position.y = hop * 0.55; const sq = 1 + (hop < 0.05 ? 0.18 : -0.08 * hop); body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq)); } };
  }
  function blaze(o) {
    const g = new T.Group(), body = new T.Group(); g.add(body);
    const hm = mat(o.col, { emissive: o.col, emissiveIntensity: 0.35 }); head(body, 0.55, 'blaze', o.col, hm, 0, 1.6, 0);
    const rods = []; const rm = glowMat(o.rod || 0xffa020, 1.0);
    for (let i = 0; i < 12; i++) { const r = cube(body, 0.12, 0.55, 0.12, rm, 0, 0, 0); rods.push({ r, i }); }
    const smoke = mat(0x3a3a3a); cube(body, 0.2, 0.6, 0.2, smoke, 0, 0.95, 0);
    return { g, h: 2.0, tick(e, dt, mv, t) { body.position.y = 0.3 + sin(t * 2) * 0.15; rods.forEach((q) => { const ring = q.i < 4 ? 0 : q.i < 8 ? 1 : 2, a = t * (ring === 1 ? -1.5 : 1.8) + (q.i % 4) * PI / 2, rr = 0.55 - ring * 0.08; q.r.position.set(cos(a) * rr, 1.55 - ring * 0.45, sin(a) * rr); }); } };
  }
  function golem(o) {
    const g = new T.Group(), m = mat(o.col), vine = mat(0x4a7a2a);
    const legL = limb(g, 0.42, 1.0, 0.42, m, -0.28, 1.0, 0), legR = limb(g, 0.42, 1.0, 0.42, m, 0.28, 1.0, 0);
    cube(g, 1.1, 0.85, 0.65, m, 0, 1.6, 0); cube(g, 0.75, 0.45, 0.5, m, 0, 1.0, 0);
    cube(g, 0.3, 0.6, 0.05, vine, 0.25, 1.65, 0.34);
    const armL = limb(g, 0.36, 1.7, 0.36, m, -0.74, 2.0, 0), armR = limb(g, 0.36, 1.7, 0.36, m, 0.74, 2.0, 0);
    head(g, 0.55, 'golem', o.col, m, 0, 2.3, 0.05);
    if (o.crystals) { const cm = glowMat(o.crystals, 0.9); [[-0.3, 2.1, -0.3], [0.35, 2.15, -0.25], [0, 2.2, -0.35]].forEach((p) => { const c = cube(g, 0.22, 0.4, 0.22, cm, p[0], p[1], p[2]); c.rotation.z = 0.3; }); }
    return { g, h: 2.7, tick(e, dt, mv, t) { const sw = mv ? sin(t * 5) * 0.5 : 0; legL.rotation.x = sw; legR.rotation.x = -sw; const atk = e.st === 1 || e.st === 2; armL.rotation.x = atk ? -1.6 : -sw * 0.6; armR.rotation.x = atk ? -1.6 : sw * 0.6; } };
  }
  function quad(o) {
    const g = new T.Group(), m = mat(o.col), legs = [];
    const bw = o.big ? 1.4 : 1.0, bh = o.big ? 1.25 : 0.95, bl = o.big ? 2.4 : 1.7, lh = o.big ? 1.1 : 0.75;
    cube(g, bw, bh, bl, m, 0, lh + bh / 2, 0);
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach((p) => legs.push(limb(g, bw * 0.32, lh, bw * 0.32, m, p[0] * bw * 0.32, lh, p[1] * bl * 0.36)));
    const hd = new T.Group(); hd.position.set(0, lh + bh * (o.big ? 0.45 : 0.6), bl / 2); g.add(hd);
    const hs = o.big ? 0.95 : 0.65; const hb = new T.Mesh(new T.BoxGeometry(hs, hs, hs * 1.1), [m, m, m, m, new T.MeshStandardMaterial({ color: 0xffffff, map: face(o.face, o.col), roughness: 0.9 }), m]); hb.position.set(0, 0, hs * 0.4); hb.castShadow = true; hd.add(hb);
    if (o.horns) [-1, 1].forEach((k) => { const h1 = cube(hd, 0.18, 0.18, 0.7, mat(0xd8d0b8), k * hs * 0.55, hs * 0.35, 0.1); h1.rotation.x = 0.6; h1.rotation.y = k * 0.3; });
    if (o.glow) { const gm = glowMat(o.glow, 1.1); cube(g, bw * 0.5, 0.12, bl * 0.6, gm, 0, lh + bh + 0.04, -0.1); }
    if (o.face === 'bear') cube(hd, 0.32, 0.25, 0.25, mat(o.col), 0, -0.08, hs * 0.95);
    return { g, h: lh + bh + 0.4, tick(e, dt, mv, t) { const sw = mv ? sin(t * (o.big ? 5 : 7)) * 0.55 : 0; legs.forEach((l, i) => { l.rotation.x = i === 0 || i === 3 ? sw : -sw; }); const atk = e.st === 1 || e.st === 2; hd.rotation.x = atk ? 0.45 + sin(t * 20) * 0.08 : sin(t * 1.5) * 0.05; } };
  }
  function ghast(o) {
    const g = new T.Group(), body = new T.Group(); g.add(body); const m = mat(o.col);
    const s = 2.2; cube(body, s, s, s, [m, m, m, m, new T.MeshStandardMaterial({ color: 0xffffff, map: face('ghast', o.col) }), m], 0, 2.8, 0);
    const ten = []; for (let i = 0; i < 9; i++) { const l = limb(body, 0.2, 1.2 + (i % 3) * 0.3, 0.2, mat(o.col), ((i % 3) - 1) * 0.6, 1.7, (Math.floor(i / 3) - 1) * 0.6); ten.push(l); }
    if (o.eye) { const em = glowMat(o.eye, 1.4); cube(body, 0.5, 0.5, 0.05, em, 0, 3.0, 1.12); }
    return { g, h: 4.0, tick(e, dt, mv, t) { body.position.y = sin(t * 1.4) * 0.3; ten.forEach((l, i) => { l.rotation.x = sin(t * 2 + i) * 0.25; l.rotation.z = cos(t * 1.7 + i) * 0.2; }); } };
  }
  function wither(o) {
    const g = new T.Group(), body = new T.Group(); g.add(body); const m = mat(o.col), fm = new T.MeshStandardMaterial({ color: 0xffffff, map: face('wither', o.col) });
    cube(body, 2.4, 0.4, 0.4, m, 0, 2.6, 0); cube(body, 0.35, 1.4, 0.35, m, 0, 1.85, 0);
    for (let i = 0; i < 3; i++) cube(body, 1.2, 0.18, 0.5, m, 0, 2.2 - i * 0.32, 0.1);
    const tail = limb(body, 0.3, 1.0, 0.3, m, 0, 1.15, -0.1);
    const heads = [[0, 3.3, 0.9], [-1.0, 3.0, 0.65], [1.0, 3.0, 0.65]].map((p) => cube(body, p[2], p[2], p[2], [m, m, m, m, fm, m], p[0], p[1], 0.1));
    const aura = glowMat(0x7ad8ff, 0.5); cube(body, 0.1, 0.1, 0.1, aura, 0, 3.9, 0);
    return { g, h: 4.0, tick(e, dt, mv, t) { body.position.y = 0.6 + sin(t * 1.3) * 0.25; tail.rotation.x = 0.5 + sin(t * 2) * 0.3; heads.forEach((h, i) => { h.rotation.y = sin(t * 0.8 + i * 2) * 0.4; }); } };
  }
  function dragon(o) {
    const g = new T.Group(), body = new T.Group(); g.add(body); const m = mat(o.col), wm = new T.MeshStandardMaterial({ color: o.wing || 0x3a2a4a, map: NOISE, side: T.DoubleSide, roughness: 0.9 });
    cube(body, 0.9, 0.8, 2.2, m, 0, 1.6, 0); const neck = cube(body, 0.5, 0.5, 1.0, m, 0, 1.9, 1.4);
    const hd = cube(body, 0.8, 0.6, 1.0, [m, m, m, m, new T.MeshStandardMaterial({ color: 0xffffff, map: face('dragon', o.col) }), m], 0, 2.05, 2.2);
    for (let i = 0; i < 4; i++) cube(body, 0.5 - i * 0.1, 0.45 - i * 0.08, 0.7, m, 0, 1.55 - i * 0.05, -1.4 - i * 0.65);
    for (let i = 0; i < 5; i++) cube(body, 0.12, 0.25, 0.25, glowMat(o.spikes || 0xff4060, 0.6), 0, 2.08, 0.9 - i * 0.5);
    const wings = [-1, 1].map((k) => { const w = new T.Group(); w.position.set(k * 0.45, 1.95, 0.2); body.add(w); const p = new T.Mesh(new T.PlaneGeometry(2.6, 1.8), wm); p.rotation.x = -PI / 2; p.position.x = k * 1.3; w.add(p); cube(w, 2.6, 0.12, 0.12, m, k * 1.3, 0, 0.9); return { w, k }; });
    const legs = [[-0.35, 0.6], [0.35, 0.6], [-0.35, -0.6], [0.35, -0.6]].map((p) => limb(body, 0.25, 1.2, 0.25, m, p[0], 1.2, p[1]));
    return { g, h: 3.0, tick(e, dt, mv, t) { body.position.y = 0.2 + sin(t * 2.4) * 0.15; wings.forEach((q) => { q.w.rotation.z = q.k * sin(t * 4) * 0.5; }); legs.forEach((l, i) => { l.rotation.x = mv ? sin(t * 6 + i) * 0.4 : 0.2; }); hd.rotation.x = (e.st === 1 || e.st === 2) ? 0.3 : 0; } };
  }

  /* ---------- which monster gets which model ---------- */
  const B = {
    teieretta: () => slime({ col: 0x6ad04a, inner: 0x3a9a2a }),
    fungo: () => slime({ col: 0x9ad06a, inner: 0x5a8a3a, cap: 0xc83a2a }),
    sporo: () => slime({ col: 0xb85a5a, inner: 0x7a2a2a, cap: 0xd83a2a, crown: true }),
    gufo: () => blaze({ col: 0xf0c040, rod: 0xffa020 }),
    ragno: () => spider({ col: 0x1e5a5a }),
    scorpio: () => spider({ col: 0xc89a50, tail: true }),
    talpa: () => humanoid({ skin: 0x5a8a3a, shirt: 0x6a4a2a, pants: 0x3a3a5a, face: 'zombie', reach: true, armSkin: true, hat: 'miner', tool: 'pick' }),
    cinder: () => humanoid({ skin: 0x3a3634, shirt: 0x2a2220, pants: 0x1a1816, face: 'zombie', faceCol: 0x3a3634, reach: true, armSkin: true, eyes: 0xff6a1a }),
    mummia: () => humanoid({ skin: 0xc8b088, shirt: 0xd8c8a0, pants: 0xb8a070, face: 'zombie', faceCol: 0xc8b088, reach: true, armSkin: true }),
    pinguino: () => humanoid({ skin: 0xc0d8e0, shirt: 0x6a8a9a, pants: 0x4a6a7a, face: 'skull', faceCol: 0xc0d8e0, thin: true, armSkin: true, tool: 'bow' }),
    dboss: () => humanoid({ skin: 0x1e1e20, shirt: 0x1e1e20, pants: 0x1e1e20, face: 'skull', faceCol: 0x2a2a2a, thin: true, armSkin: true, ribs: true, tool: 'sword', eyes: 0xb04aff }),
    golem: () => golem({ col: 0xc8c4bc }),
    reQuang: () => golem({ col: 0xa06a40, crystals: 0xffa040 }),
    orso: () => quad({ col: 0xf2f2ea, face: 'bear' }),
    regina: () => humanoid({ skin: 0xd8e8f0, shirt: 0x5a9ad8, pants: 0x3a6aa8, face: 'witch', faceCol: 0xd8e8f0, robe: true, armSkin: true, hat: 'crown', hatCol: 0xa8e8ff, tool: 'staff' }),
    sethra: () => humanoid({ skin: 0xc89868, shirt: 0xe0b83a, pants: 0x2a6ab8, face: 'witch', faceCol: 0xc89868, robe: true, armSkin: true, hat: 'crown', hatCol: 0xffd040, tool: 'staff' }),
    ombra: () => humanoid({ skin: 0x141418, shirt: 0x141418, pants: 0x141418, face: 'ender', faceCol: 0x141418, thin: true, tall: true, armSkin: true }),
    demone: () => humanoid({ skin: 0x2a1438, shirt: 0x2a1438, pants: 0x2a1438, face: 'ender', faceCol: 0x2a1438, thin: true, tall: true, armSkin: true, horns: true }),
    boss: () => quad({ col: 0x7a7a78, face: 'beast', big: true, horns: true }),
    wboss: () => quad({ col: 0x8a4a2a, face: 'beast', big: true, horns: true, glow: 0xff6a1a }),
    drago: () => dragon({ col: 0x2a1a2a, wing: 0x4a2a4a }),
    vuoto: () => ghast({ col: 0x2a1a3a, eye: 0xc040ff }),
    morvain: () => wither({ col: 0x1a1a1e })
  };
  const KEY = {}; Object.keys(RU.ENEMIES).forEach((k) => { KEY[RU.ENEMIES[k].name] = k; });
  function aura(d, built, r) {
    const ring = new T.Mesh(new T.RingGeometry(r * 0.85, r, 40), new T.MeshBasicMaterial({ color: d.boss ? 0xff4a2a : 0xffb347, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, side: T.DoubleSide, depthWrite: false }));
    ring.rotation.x = -PI / 2; ring.position.y = 0.12; built.g.add(ring); return ring;
  }
  const skin0 = Z.skin;
  Z.skin = function (d, built) {
    const key = KEY[d.name], b = B[key];
    if (b && !MB.off) {
      let r = null; try { r = b(); } catch (err) { console.warn('[mobs] ' + key, err); }
      if (r) {
        while (built.g.children.length) built.g.remove(built.g.children[0]);
        built.g.add(r.g);
        /* size: the hit radius decides how big the model is, so a 2 m wide boss looks like one */
        const sc = Math.max(0.75, Math.pow((d.radius || 0.8) / 0.8, 0.6) * (key === 'boss' || key === 'wboss' || key === 'drago' || key === 'vuoto' || key === 'morvain' ? 0.85 : 1));
        /* the scale sits on the inner model: index.html resets the outer group's scale when a monster dies and respawns */
        built.g.scale.setScalar(1); r.g.scale.setScalar(sc);
        const parts = { tick: r.tick };
        if (d.elite || d.boss) { const ring = aura(d, built, (d.radius || 1.5) * 1.1); parts.aura = ring; }
        built.body = r.g; built.parts = parts; built.anim = 'mc'; d.lh = r.h * sc + 0.3; d._lhs = 1;
        return;
      }
    }
    skin0.apply(this, arguments);
  };
  console.log('[mobs] da nap ' + Object.keys(B).length + ' quai kieu khoi vuong');
})();
