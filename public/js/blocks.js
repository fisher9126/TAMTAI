/* Aetherfall world in a blocky, Minecraft Dungeons-like style (browser, visual only).
   1. Terrain: one block per square metre inside the world circle, pixel textures per biome (grass, path, cobblestone, sand, red sand,
      snow, mud, stone, dungeon stone, end stone...), heights follow the game's height function in quarter-block steps.
   2. Trees: blocky oaks, spruces, birches, mushrooms and cacti on the old tree spots (each biome its own kind).
   3. Village: the five houses, the well and the tower rebuilt from planks, logs, cobblestone, glass and roof blocks.
   4. Map: a baked top-down picture of the world used by the minimap (index.html) and the big map (explore.js), with
      quest marker, monsters, NPCs, players, zone names.
   Walking, heights and collisions are unchanged: everything here is decoration. Quality 0 (AF_VISUAL.setQuality(0)) skips 1-3. */
(function () {
  'use strict';
  const T = window.THREE, H = window.AF_CH, X = window.AF_CHX, G = window.AF_GFX, RU = window.AF_RULES;
  if (!T || !H || !X || !G || !RU) { console.warn('[blocks] thieu AF_GFX, bo qua'); return; }
  const S = G.scene, W = RU.WORLD, PI = Math.PI;
  const Q = () => (window.AF_VISUAL && window.AF_VISUAL.quality ? window.AF_VISUAL.quality() : 2);
  const BK = window.AF_BLOCKS = { built: false };
  const RAD = 112, STEP = 0.25;
  const hq = (x, z) => Math.round(H.heightAt(x, z) / STEP) * STEP;
  function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  function hash(x, z) { let h = (x * 374761393 + z * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, z) { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }

  /* ---------- pixel textures ---------- */
  function px16(draw) { const c = document.createElement('canvas'); c.width = c.height = 16; draw(c.getContext('2d'), rng(Math.floor(Math.random() * 1e9))); const t = new T.CanvasTexture(c); t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; t.generateMipmaps = false; t.encoding = T.sRGBEncoding; return t; }
  const rgb = (r, g, b) => 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  function noiseFill(g, r, base, amt) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const k = 1 - amt + r() * amt * 2; g.fillStyle = rgb(base[0] * k, base[1] * k, base[2] * k); g.fillRect(x, y, 1, 1); } }
  function topSide(base, top, rows) { return px16((g, r) => { noiseFill(g, r, base, 0.12); for (let x = 0; x < 16; x++) { const n = rows + (r() < 0.4 ? 1 : 0); for (let y = 0; y < n; y++) { const k = 0.9 + r() * 0.2; g.fillStyle = rgb(top[0] * k, top[1] * k, top[2] * k); g.fillRect(x, y, 1, 1); } } }); }
  const BT = {}; /* biome -> [topTex, sideTex, mapColor] */
  function biomeTex() {
    const dirt = [134, 96, 67];
    BT.grass = [px16((g, r) => { noiseFill(g, r, [104, 162, 62], 0.14); for (let i = 0; i < 10; i++) { g.fillStyle = rgb(80 + r() * 20, 130 + r() * 25, 44); g.fillRect(r() * 16 | 0, r() * 16 | 0, 1, 1); } }), topSide(dirt, [104, 162, 62], 3), '#69a23e'];
    BT.forest = [px16((g, r) => { noiseFill(g, r, [72, 128, 50], 0.16); }), topSide(dirt, [72, 128, 50], 3), '#48803a'];
    BT.path = [px16((g, r) => { noiseFill(g, r, [158, 128, 84], 0.12); for (let i = 0; i < 8; i++) { g.fillStyle = rgb(120, 96, 64); g.fillRect(r() * 16 | 0, r() * 16 | 0, 2, 1); } }), topSide(dirt, [158, 128, 84], 2), '#9e8054'];
    BT.cobble = [px16((g, r) => { g.fillStyle = '#5c5c5c'; g.fillRect(0, 0, 16, 16); for (let i = 0; i < 14; i++) { const x = r() * 14 | 0, y = r() * 14 | 0, w = 3 + (r() * 3 | 0), h = 2 + (r() * 3 | 0), v = 110 + r() * 50; g.fillStyle = rgb(v, v, v); g.fillRect(x, y, w, h); g.fillStyle = rgb(v + 25, v + 25, v + 25); g.fillRect(x, y, w, 1); } }), null, '#8a8a8a'];
    BT.cobble[1] = BT.cobble[0];
    BT.sand = [px16((g, r) => noiseFill(g, r, [222, 206, 150], 0.08)), null, '#ddce96']; BT.sand[1] = BT.sand[0];
    BT.redsand = [px16((g, r) => noiseFill(g, r, [196, 112, 54], 0.1)), null, '#c47036']; BT.redsand[1] = px16((g, r) => { noiseFill(g, r, [170, 94, 46], 0.1); for (let y = 3; y < 16; y += 5) { g.fillStyle = 'rgba(120,60,30,.5)'; g.fillRect(0, y, 16, 1); } });
    BT.snow = [px16((g, r) => noiseFill(g, r, [236, 244, 250], 0.04)), topSide(dirt, [236, 244, 250], 4), '#eef4fa'];
    BT.mud = [px16((g, r) => { noiseFill(g, r, [86, 78, 48], 0.16); for (let i = 0; i < 6; i++) { g.fillStyle = rgb(60, 92, 50); g.fillRect(r() * 16 | 0, r() * 16 | 0, 2, 2); } }), topSide([70, 56, 40], [86, 78, 48], 3), '#56502f'];
    BT.stone = [px16((g, r) => { noiseFill(g, r, [128, 128, 128], 0.1); for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(80,80,80,.7)'; g.fillRect(r() * 14 | 0, r() * 16 | 0, 3, 1); } }), null, '#808080']; BT.stone[1] = BT.stone[0];
    BT.dark = [px16((g, r) => { noiseFill(g, r, [52, 46, 60], 0.14); for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(140,60,200,.55)'; g.fillRect(r() * 16 | 0, r() * 16 | 0, 1, 1); } }), null, '#342e3c']; BT.dark[1] = BT.dark[0];
    BT.nether = [px16((g, r) => { noiseFill(g, r, [112, 40, 38], 0.18); for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(255,140,40,.7)'; g.fillRect(r() * 16 | 0, r() * 16 | 0, 1, 1); } }), null, '#702826']; BT.nether[1] = BT.nether[0];
    BT.end = [px16((g, r) => { noiseFill(g, r, [86, 58, 120], 0.16); for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(200,150,255,.6)'; g.fillRect(r() * 16 | 0, r() * 16 | 0, 1, 1); } }), null, '#563a78']; BT.end[1] = BT.end[0];
    BT.bricks = [px16((g, r) => { g.fillStyle = '#7a7a80'; g.fillRect(0, 0, 16, 16); for (let y = 0; y < 16; y += 4) for (let x = (y / 4) % 2 ? -4 : 0; x < 16; x += 8) { const v = 140 + r() * 30; g.fillStyle = rgb(v, v, v + 4); g.fillRect(x + 1, y + 1, 7, 3); } }), null, '#9a9aa0']; BT.bricks[1] = BT.bricks[0];
    BT.sandstone = [px16((g, r) => { noiseFill(g, r, [216, 196, 140], 0.06); g.fillStyle = 'rgba(170,140,90,.6)'; g.fillRect(0, 5, 16, 1); g.fillRect(0, 11, 16, 1); }), null, '#d8c48c']; BT.sandstone[1] = BT.sandstone[0];
    BT.water = [null, null, '#3f76c8'];
  }
  /* which block covers the ground at (x, z) */
  const roads = [W.FOREST, W.ARENA, W.POND];
  function segDist(px, pz, ax, az, bx, bz) { const vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz))); return Math.hypot(px - (ax + vx * t), pz - (az + vz * t)); }
  const roadDist = (x, z) => Math.min.apply(null, roads.map((p) => segDist(x, z, 0, 0, p.x, p.z)));
  const ZB = { swamp: 'mud', mine: 'stone', frost: 'snow', dungeon: 'dark', wboss: 'nether', desert: 'redsand', abyss: 'end', fort: 'bricks' };
  function biome(x, z) {
    const n = vnoise(x * 0.18, z * 0.18) * 3.2;
    if (Math.hypot(x, z) < 7.8) return 'cobble';
    if (Math.hypot(x - W.POND.x, z - W.POND.z) < (W.POND_R || 9) + 1.4 + n * 0.4) return 'sand';
    for (const zz of RU.ZONES) { const d = Math.hypot(x - zz.x, z - zz.z); if (d < zz.r + n - 0.8 && ZB[zz.id]) { if (zz.id === 'desert' && vnoise(x * 0.3, z * 0.3) > 0.62) return 'sand'; if (zz.id === 'mine' && vnoise(x * 0.4, z * 0.4) > 0.65) return 'path'; return ZB[zz.id]; } }
    if (Math.hypot(x - W.ARENA.x, z - W.ARENA.z) < 16 + n * 0.3) return 'sandstone';
    if (roadDist(x, z) < 1.5 + vnoise(x * 0.5, z * 0.5) * 0.9) return 'path';
    if (Math.hypot(x - W.FOREST.x, z - W.FOREST.z) < 26 + n) return 'forest';
    return vnoise(x * 0.07 + 40, z * 0.07) > 0.78 ? 'forest' : 'grass';
  }
  BK.biome = biome;

  /* ---------- 1. terrain ---------- */
  function buildTerrain() {
    biomeTex();
    const cells = {}, top = {}, key = (x, z) => x + ',' + z;
    for (let z = -RAD; z < RAD; z++) for (let x = -RAD; x < RAD; x++) { if (Math.hypot(x + 0.5, z + 0.5) > RAD) continue; top[key(x, z)] = hq(x + 0.5, z + 0.5); }
    Object.keys(top).forEach((k) => { const [x, z] = k.split(',').map(Number), b = biome(x + 0.5, z + 0.5); (cells[b] = cells[b] || []).push([x, z]); });
    const d = new T.Object3D(), col = new T.Color(), CH = 16;
    const meshes = [];
    Object.keys(cells).forEach((b) => {
      const tx = BT[b] || BT.grass, tm = new T.MeshLambertMaterial({ map: tx[0] }), sm = new T.MeshLambertMaterial({ map: tx[1] || tx[0] });
      /* one instanced mesh per 16x16 chunk, placed at the chunk centre with a matching bounding sphere, so off-screen chunks are skipped */
      const chunks = {}; cells[b].forEach((c) => { const k = Math.floor(c[0] / CH) + ':' + Math.floor(c[1] / CH); (chunks[k] = chunks[k] || []).push(c); });
      Object.keys(chunks).forEach((ck) => {
        const list = chunks[ck], [ci, cj] = ck.split(':').map(Number), ox = ci * CH + CH / 2, oz = cj * CH + CH / 2;
        let ymin = Infinity, ymax = -Infinity; list.forEach(([x, z]) => { const t = top[key(x, z)]; ymin = Math.min(ymin, t - 3); ymax = Math.max(ymax, t); });
        const oy = (ymin + ymax) / 2, geo = new T.BoxGeometry(1, 1, 1); geo.boundingSphere = new T.Sphere(new T.Vector3(0, 0, 0), Math.hypot(CH / 2, CH / 2, (ymax - ymin) / 2) + 1);
        const im = new T.InstancedMesh(geo, [sm, sm, tm, sm, sm, sm], list.length); im.receiveShadow = true; im.position.set(ox, oy, oz);
        list.forEach(([x, z], i) => {
          const t = top[key(x, z)]; let lo = t; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dz]) => { const n = top[key(x + dx, z + dz)]; if (n != null && n < lo) lo = n; });
          const h = Math.max(0.6, t - lo + 0.6);
          d.position.set(x + 0.5 - ox, t - h / 2 - oy, z + 0.5 - oz); d.scale.set(1, h, 1); d.updateMatrix(); im.setMatrixAt(i, d.matrix);
          const v = 0.9 + hash(x * 3 + 1, z * 7 + 2) * 0.16; col.setRGB(v, v, v); im.setColorAt(i, col);
        });
        im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.userData.afBlocks = true; S.add(im); meshes.push(im);
      });
    });
    /* the old smooth ground is lowered so it only shows past the edge of the block world; the zone colour patches go away */
    S.children.forEach((o) => {
      if (o.isMesh && o.geometry && o.geometry.type === 'PlaneGeometry' && o.geometry.parameters.width >= 200) o.position.y -= 0.7;
      if (o.isMesh && o.renderOrder === 1 && o.material && o.material.polygonOffset && o.material.isMeshBasicMaterial) o.visible = false;
    });
    BK.top = top; return meshes.length;
  }

  /* ---------- 2. trees ---------- */
  function buildTrees() {
    const spots = [];
    S.children.forEach((o) => { if (o.isInstancedMesh && o.geometry && o.geometry.type === 'CylinderGeometry' && o.geometry.parameters.height > 2 && o.geometry.parameters.radiusTop < 0.3) { const M4 = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3(); for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, M4); M4.decompose(p, q, s); spots.push([p.x, p.z, s.x]); } } });
    if (!spots.length) return 0;
    /* hide the KayKit / old trees */
    S.children.forEach((o) => { if (o.isInstancedMesh && (o.userData.afCut || (o.geometry && /Cylinder|Icosahedron|Cone/.test(o.geometry.type) && o.geometry.parameters && (o.geometry.parameters.height > 2 || o.geometry.parameters.radius >= 1)))) { if (!o.userData.afBlocks) o.visible = false; } });
    const logs = [], leaves = [], caps = [], r = rng(99);
    const LEAF = { grass: 0x4a9a32, forest: 0x2f7a2a, snow: 0x6a8a7a, mud: 0x5a7a2a, redsand: null, sand: null, stone: 0x4a7a3a, dark: null, nether: null, end: null, path: 0x4a9a32, cobble: 0x4a9a32, bricks: 0x4a9a32, sandstone: null };
    spots.forEach(([x, z, s]) => {
      const b = biome(x, z), y = hq(x, z), hgt = 3 + Math.floor(r() * 3) + (s > 1.1 ? 1 : 0);
      /* fewer trees than before so the diagonal camera can see the ground; forests stay dense */
      if (Math.hypot(x, z) < 15 || (b !== 'forest' && r() < 0.4)) return;
      const cx = Math.floor(x) + 0.5, cz = Math.floor(z) + 0.5;
      if (b === 'redsand' || b === 'sand' || b === 'sandstone') { for (let i = 0; i < hgt - 1; i++) logs.push([cx, y + 0.5 + i, cz, 0.8, 0x3a8a2a, 'cactus']); if (r() < 0.6) { logs.push([cx + 0.8, y + 1.6, cz, 0.55, 0x3a8a2a, 'cactus']); logs.push([cx + 0.8, y + 2.2, cz, 0.55, 0x3a8a2a, 'cactus']); } return; }
      if (b === 'dark' || b === 'nether' || b === 'end' || b === 'mud' && r() < 0.5) { /* giant mushroom */
        for (let i = 0; i < hgt; i++) logs.push([cx, y + 0.5 + i, cz, 0.8, 0xd8d0b8, 'stem']);
        const cc = b === 'end' ? 0x8a5ab8 : b === 'nether' ? 0xa02a2a : b === 'dark' ? 0x5a3a7a : (r() < 0.5 ? 0xc83a2a : 0x9a7a52);
        for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (Math.abs(dx) + Math.abs(dz) < 4) caps.push([cx + dx, y + hgt + 0.5, cz + dz, 1, cc]);
        return;
      }
      const spruce = b === 'snow' || (b === 'forest' && r() < 0.35), birch = !spruce && r() < 0.18;
      const bark = spruce ? 0x4a3020 : birch ? 0xe8e4d8 : 0x6a4a2a, leaf = LEAF[b] || 0x4a9a32;
      for (let i = 0; i < hgt; i++) logs.push([cx, y + 0.5 + i, cz, 1, bark, birch ? 'birch' : 'log']);
      const lc = new T.Color(spruce ? (b === 'snow' ? 0x5a7a6a : 0x2a5a32) : birch ? 0x6aa840 : leaf);
      if (spruce) { for (let l = 0; l < 4; l++) { const rr = Math.max(0, 2 - Math.floor(l * 0.7)); for (let dx = -rr; dx <= rr; dx++) for (let dz = -rr; dz <= rr; dz++) if (Math.abs(dx) + Math.abs(dz) <= rr + 0.5 && !(dx === 0 && dz === 0 && l < 3)) leaves.push([cx + dx, y + hgt - 2 + l + 0.5, cz + dz, lc, b === 'snow' && l === 3]); } leaves.push([cx, y + hgt + 2.5, cz, lc, b === 'snow']); }
      else { for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { const far = Math.abs(dx) + Math.abs(dz) + Math.abs(dy) * 1.5; if (far > 3.2 || (dx === 0 && dz === 0 && dy < 1) || r() < 0.12) continue; leaves.push([cx + dx, y + hgt + dy + 0.5, cz + dz, lc, false]); } leaves.push([cx, y + hgt + 1.5, cz, lc, false]); }
    });
    const tex = {
      log: px16((g, r2) => { noiseFill(g, r2, [104, 76, 46], 0.18); for (let x = 1; x < 16; x += 4) { g.fillStyle = 'rgba(50,34,20,.6)'; g.fillRect(x, 0, 1, 16); } }),
      birch: px16((g, r2) => { noiseFill(g, r2, [226, 222, 210], 0.05); for (let i = 0; i < 7; i++) { g.fillStyle = '#2a2a2a'; g.fillRect(r2() * 14 | 0, r2() * 16 | 0, 2 + (r2() * 2 | 0), 1); } }),
      cactus: px16((g, r2) => { noiseFill(g, r2, [70, 140, 50], 0.1); for (let x = 2; x < 16; x += 4) { g.fillStyle = 'rgba(30,80,20,.7)'; g.fillRect(x, 0, 1, 16); } g.fillStyle = '#e8e0b0'; for (let i = 0; i < 5; i++) g.fillRect(r2() * 16 | 0, r2() * 16 | 0, 1, 1); }),
      stem: px16((g, r2) => noiseFill(g, r2, [222, 214, 190], 0.06)),
      leaf: px16((g, r2) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const k = r2(); g.fillStyle = k < 0.12 ? 'rgba(0,0,0,0.0)' : rgb(255 * (0.7 + k * 0.3), 255 * (0.7 + k * 0.3), 255 * (0.7 + k * 0.3)); g.fillRect(x, y, 1, 1); } }),
      cap: px16((g, r2) => { noiseFill(g, r2, [255, 255, 255], 0.08); for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(255,255,255,.95)'; g.fillRect(r2() * 14 | 0, r2() * 14 | 0, 2, 2); } }),
      snowtop: px16((g, r2) => noiseFill(g, r2, [240, 246, 250], 0.04))
    };
    const geo = new T.BoxGeometry(1, 1, 1), d = new T.Object3D(), c = new T.Color();
    const groups = {}; logs.forEach((l) => { (groups[l[5]] = groups[l[5]] || []).push(l); });
    let n = 0;
    Object.keys(groups).forEach((k) => {
      const L = groups[k], im = new T.InstancedMesh(geo, new T.MeshLambertMaterial({ map: tex[k] || tex.log }), L.length); im.castShadow = true; im.receiveShadow = true;
      L.forEach((l, i) => { d.position.set(l[0], l[1], l[2]); d.scale.set(l[3], 1, l[3]); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
      im.frustumCulled = false; im.userData.afCut = true; im.userData.afBlocks = true; S.add(im); n += L.length;
    });
    if (leaves.length) {
      const lm = new T.MeshLambertMaterial({ map: tex.leaf, alphaTest: 0.5, side: T.DoubleSide }), ch = {};
      leaves.forEach((l) => { const k = Math.floor(l[0] / 24) + ':' + Math.floor(l[2] / 24); (ch[k] = ch[k] || []).push(l); });
      Object.keys(ch).forEach((k) => {
        const L = ch[k], [ci, cj] = k.split(':').map(Number), ox = ci * 24 + 12, oz = cj * 24 + 12, oy = L[0][1];
        const g2 = new T.BoxGeometry(1, 1, 1); g2.boundingSphere = new T.Sphere(new T.Vector3(0, 0, 0), 24);
        const im = new T.InstancedMesh(g2, lm, L.length); im.castShadow = true; im.receiveShadow = true; im.position.set(ox, oy, oz);
        L.forEach((l, i) => { d.position.set(l[0] - ox, l[1] - oy, l[2] - oz); d.scale.set(1, 1, 1); d.updateMatrix(); im.setMatrixAt(i, d.matrix); c.copy(l[3]); if (l[4]) c.setRGB(0.92, 0.95, 0.98); const v = 0.88 + hash(i + ci * 97, 3 + cj) * 0.2; c.multiplyScalar(v); im.setColorAt(i, c); });
        im.instanceColor.needsUpdate = true; im.userData.afCut = true; im.userData.afBlocks = true; S.add(im);
      });
    }
    if (caps.length) {
      const im = new T.InstancedMesh(geo, new T.MeshLambertMaterial({ map: tex.cap }), caps.length); im.castShadow = true;
      caps.forEach((l, i) => { d.position.set(l[0], l[1], l[2]); d.scale.set(1, 1, 1); d.updateMatrix(); im.setMatrixAt(i, d.matrix); im.setColorAt(i, c.set(l[4])); });
      im.instanceColor.needsUpdate = true; im.frustumCulled = false; im.userData.afCut = true; im.userData.afBlocks = true; S.add(im);
    }
    return spots.length;
  }

  /* ---------- 3. village houses from blocks ---------- */
  let MATS = null;
  function houseMats() {
    if (MATS) return MATS;
    const T2 = (d) => new T.MeshLambertMaterial({ map: px16(d) });
    MATS = {
      plank: T2((g, r) => { noiseFill(g, r, [162, 128, 78], 0.08); for (let y = 3; y < 16; y += 4) { g.fillStyle = 'rgba(90,64,36,.8)'; g.fillRect(0, y, 16, 1); } g.fillStyle = 'rgba(90,64,36,.6)'; g.fillRect(5, 0, 1, 4); g.fillRect(11, 4, 1, 4); g.fillRect(3, 8, 1, 4); g.fillRect(9, 12, 1, 4); }),
      log: T2((g, r) => { noiseFill(g, r, [96, 70, 42], 0.16); for (let x = 1; x < 16; x += 4) { g.fillStyle = 'rgba(50,34,20,.6)'; g.fillRect(x, 0, 1, 16); } }),
      cobble: T2((g, r) => { g.fillStyle = '#585858'; g.fillRect(0, 0, 16, 16); for (let i = 0; i < 14; i++) { const x = r() * 14 | 0, y = r() * 14 | 0, v = 110 + r() * 50; g.fillStyle = rgb(v, v, v); g.fillRect(x, y, 3 + (r() * 3 | 0), 2 + (r() * 3 | 0)); } }),
      roof: T2((g, r) => { noiseFill(g, r, [150, 62, 48], 0.1); for (let y = 0; y < 16; y += 4) { g.fillStyle = 'rgba(70,24,18,.7)'; g.fillRect(0, y, 16, 1); for (let x = (y / 4) % 2 ? 2 : 6; x < 16; x += 8) g.fillRect(x, y, 1, 4); } }),
      dark: T2((g, r) => { noiseFill(g, r, [72, 52, 32], 0.1); for (let y = 3; y < 16; y += 4) { g.fillStyle = 'rgba(30,20,10,.8)'; g.fillRect(0, y, 16, 1); } }),
      glass: new T.MeshLambertMaterial({ map: px16((g) => { g.fillStyle = 'rgba(170,220,255,.55)'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#e8f4ff'; g.fillRect(0, 0, 16, 1); g.fillRect(0, 15, 16, 1); g.fillRect(0, 0, 1, 16); g.fillRect(15, 0, 1, 16); g.fillRect(3, 3, 2, 1); g.fillRect(3, 4, 1, 1); }), transparent: true, emissive: 0x3a5a7a, emissiveIntensity: 0.4 }),
      door: T2((g, r) => { noiseFill(g, r, [110, 76, 40], 0.1); g.fillStyle = '#3a2410'; g.fillRect(0, 0, 16, 1); g.fillRect(0, 7, 16, 1); g.fillRect(7, 0, 1, 16); g.fillStyle = '#c8a040'; g.fillRect(12, 8, 2, 2); }),
      lantern: new T.MeshLambertMaterial({ color: 0xffd080, emissive: 0xffa040, emissiveIntensity: 1.2 })
    };
    return MATS;
  }
  /* one house: lists of [x, y, z, mat] in house space (x across, z depth, door at +z), turned and placed by a group */
  function houseBlocks(w, d, wallH, roofMat) {
    const out = [], hw = Math.floor(w / 2), hd = Math.floor(d / 2);
    for (let x = -hw; x <= hw; x++) for (let z = -hd; z <= hd; z++) out.push([x, 0, z, 'cobble']);
    for (let y = 1; y <= wallH; y++) for (let x = -hw; x <= hw; x++) for (let z = -hd; z <= hd; z++) {
      const edgeX = Math.abs(x) === hw, edgeZ = Math.abs(z) === hd; if (!edgeX && !edgeZ) continue;
      let m = edgeX && edgeZ ? 'log' : 'plank';
      if (z === hd && x === 0 && y <= 2) { m = 'door'; }
      else if (y === 2 && !(edgeX && edgeZ) && ((edgeZ && Math.abs(x) === Math.max(1, hw - 1)) || (edgeX && z === 0))) m = 'glass';
      out.push([x, y, z, m]);
    }
    for (let x = -hw; x <= hw; x++) for (let z = -hd; z <= hd; z++) if (Math.abs(x) === hw || Math.abs(z) === hd) out.push([x, wallH + 1, z, 'log']);
    /* gable roof: steps along x, overhanging by one */
    for (let s = 0; s <= hw + 1; s++) for (let z = -hd - 1; z <= hd + 1; z++) { const y = wallH + 1 + s; [-1, 1].forEach((k) => { const x = k * (hw + 1 - s); out.push([x, y, z, roofMat]); }); if (hw + 1 - s <= 0) break; }
    for (let s = 1; s <= hw; s++) for (let x = -(hw - s); x <= hw - s; x++) [-hd, hd].forEach((z) => out.push([x, wallH + 1 + s, z, 'plank']));
    out.push([hw - 1, wallH + hw + 1, -hd + 1, 'cobble']); out.push([hw - 1, wallH + hw + 2, -hd + 1, 'cobble']);
    out.push([1, 3, hd + 1, 'lantern']);
    return out;
  }
  function placeHouse(x0, z0, face, w, d, wallH, roofMat) {
    const mats = houseMats(), g = new T.Group(), list = houseBlocks(w, d, wallH, roofMat), geo = new T.BoxGeometry(1, 1, 1), dd = new T.Object3D(), by = {};
    list.forEach((b) => { (by[b[3]] = by[b[3]] || []).push(b); });
    Object.keys(by).forEach((k) => {
      const L = by[k], m = k === 'lantern' ? mats.lantern : mats[k] || mats.plank, im = new T.InstancedMesh(geo, m, L.length); im.castShadow = k !== 'glass'; im.receiveShadow = true;
      L.forEach((b, i) => { const s = k === 'lantern' ? 0.4 : 1; dd.position.set(b[0], b[1] + 0.5, b[2]); dd.scale.set(s, s, s); dd.updateMatrix(); im.setMatrixAt(i, dd.matrix); });
      im.frustumCulled = false; g.add(im);
    });
    g.position.set(x0, hq(x0, z0) - 0.45, z0); g.rotation.y = face; g.userData.afOcc = true; g.userData.afBlocks = true; S.add(g);
    return g;
  }
  function buildVillage() {
    let n = 0;
    const roofs = ['roof', 'dark', 'roof', 'dark', 'roof'];
    S.children.slice().forEach((o) => {
      if (o.userData && o.userData.afHouse) {
        const u = o.userData.afHouse, face = Math.round(Math.atan2(-o.position.x, -o.position.z) / (PI / 2)) * (PI / 2);
        placeHouse(o.position.x, o.position.z, face, u.i === 4 ? 7 : 5, 5, u.i === 4 ? 4 : 3, roofs[u.i % 5]); n++; /* sized to the house's collision circle */
      }
    });
    /* hide the KayKit / old buildings that stood on those spots and the tower */
    S.children.forEach((o) => { if (o.userData && o.userData.afOcc && !o.userData.afBlocks) { const near = S.children.some((h) => h.userData && h.userData.afHouse && Math.hypot(h.position.x - o.position.x, h.position.z - o.position.z) < 2); if (near) o.visible = false; } });
    return n;
  }

  /* ---------- 4. baked map ---------- */
  const MAP = window.AF_MAP = { img: null, size: 0, scale: 2 };
  function bake() {
    if (!BT.grass) biomeTex();
    const sc = MAP.scale, R = 120, N = R * 2 * sc, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
    g.fillStyle = '#2a3a2a'; g.fillRect(0, 0, N, N);
    const img = g.createImageData(N, N), D = img.data, colCache = {};
    const hex = (h) => colCache[h] || (colCache[h] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
    for (let py = 0; py < N; py++) for (let pxx = 0; pxx < N; pxx++) {
      const x = pxx / sc - R, z = py / sc - R, i = (py * N + pxx) * 4, d0 = Math.hypot(x, z);
      if (d0 > R) { D[i] = 26; D[i + 1] = 32; D[i + 2] = 28; D[i + 3] = 255; continue; }
      const b = Math.hypot(x - W.POND.x, z - W.POND.z) < (W.POND_R || 9) ? 'water' : biome(x, z), cc = hex(BT[b][2]);
      const h = H.heightAt(x, z), hx = H.heightAt(x + 1, z), shadeK = Math.max(0.65, Math.min(1.25, 1 + (h - hx) * 0.35)) * (d0 > 108 ? 0.6 : 1);
      const grain = 0.94 + hash(Math.floor(x), Math.floor(z)) * 0.1;
      D[i] = Math.min(255, cc[0] * shadeK * grain); D[i + 1] = Math.min(255, cc[1] * shadeK * grain); D[i + 2] = Math.min(255, cc[2] * shadeK * grain); D[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const P = (x, z) => [(x + R) * sc, (z + R) * sc];
    /* houses and buildings */
    S.children.forEach((o) => { if (o.userData && o.userData.afHouse) { const [x, y] = P(o.position.x, o.position.z); g.save(); g.translate(x, y); g.rotate(-o.rotation.y); g.fillStyle = '#8a3a2a'; g.fillRect(-11, -11, 22, 22); g.strokeStyle = '#2a1408'; g.lineWidth = 2; g.strokeRect(-11, -11, 22, 22); g.fillStyle = '#c86a4a'; g.fillRect(-11, -2, 22, 4); g.restore(); } });
    /* trees as dots */
    S.children.forEach((o) => { if (o.isInstancedMesh && o.geometry && o.geometry.type === 'CylinderGeometry' && o.geometry.parameters.height > 2 && o.geometry.parameters.radiusTop < 0.3) { const M4 = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3(); for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, M4); M4.decompose(p, q, s); const [x, y] = P(p.x, p.z), b = biome(p.x, p.z); g.fillStyle = b === 'snow' ? '#5a7a6a' : b === 'redsand' || b === 'sand' ? '#3a8a2a' : '#2a6a22'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(x - 1.5, y - 1.5, 2.2, 0, 7); g.fill(); } } });
    MAP.img = c; MAP.size = N; MAP.R = R; return c;
  }
  MAP.bake = bake;
  const toMap = (x, z) => [(x + MAP.R) * MAP.scale, (z + MAP.R) * MAP.scale];
  const ZONE_NAMES = () => RU.ZONES.map((z) => ({ x: z.x, z: z.z, n: z.name })).concat([{ x: 0, z: -9, n: 'Làng Ashford' }, { x: W.FOREST.x, z: W.FOREST.z, n: 'Rừng Bóng Đèn' }, { x: W.ARENA.x, z: W.ARENA.z, n: 'Đấu trường' }]);
  function marker(g, x, y, kind, s) {
    s = s || 1;
    if (kind === 'quest') { g.save(); g.translate(x, y); g.fillStyle = '#ffd25a'; g.strokeStyle = '#3a2405'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, -11 * s); g.lineTo(8 * s, 0); g.lineTo(0, 11 * s); g.lineTo(-8 * s, 0); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#3a2405'; g.font = '900 ' + (11 * s) + 'px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 0, 1); g.restore(); }
    else if (kind === 'npc') { g.fillStyle = '#ffe9a8'; g.strokeStyle = '#3a2a10'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 4.5 * s, 0, 7); g.fill(); g.stroke(); }
    else if (kind === 'boss') { g.fillStyle = '#ff3a2a'; g.strokeStyle = '#2a0404'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 6.5 * s, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.fillRect(x - 2.5 * s, y - 2 * s, 2 * s, 2 * s); g.fillRect(x + 0.5 * s, y - 2 * s, 2 * s, 2 * s); }
  }
  /* minimap: a north-up crop of the baked map around the player */
  MAP.drawMini = function (mc, Wd, Hd) {
    if (!MAP.img) return false;
    const R0 = H.R, view = 70, k = Wd / view, sc = MAP.scale, [cx, cy] = toMap(R0.x, R0.z);
    mc.save(); mc.clearRect(0, 0, Wd, Hd); mc.beginPath(); mc.arc(Wd / 2, Hd / 2, Wd / 2 - 1, 0, 7); mc.clip();
    mc.imageSmoothingEnabled = false; mc.drawImage(MAP.img, cx - view * sc / 2, cy - view * sc / 2, view * sc, view * sc, 0, 0, Wd, Hd);
    const to = (x, z) => [Wd / 2 + (x - R0.x) * k, Hd / 2 + (z - R0.z) * k];
    const Zs = window.AF_ZONES; if (Zs && Zs.nodes) Zs.nodes.forEach((n) => { if (!n.on) return; const [x, y] = to(n.x, n.z); mc.fillStyle = '#8ef0d0'; mc.fillRect(x - 2.5, y - 2.5, 5, 5); });
    X.enemyById.forEach((e) => { if (e.dead) return; const [x, y] = to(e.x, e.z); if (x < -10 || y < -10 || x > Wd + 10 || y > Hd + 10) return; if (e.d.boss || e.d.elite) marker(mc, x, y, 'boss', 1.1); else { mc.fillStyle = '#ff5a46'; mc.strokeStyle = '#2a0606'; mc.lineWidth = 1.5; mc.beginPath(); mc.arc(x, y, 3.6, 0, 7); mc.fill(); mc.stroke(); } });
    const ST = window.AF_STORY; if (ST) Object.keys(ST.NPCS).forEach((id) => { const n = ST.NPCS[id], [x, y] = to(n.x, n.z); marker(mc, x, y, 'npc', 1); });
    if (H.others) H.others.forEach((o) => { const [x, y] = to(o.x, o.z); mc.fillStyle = '#7dffa0'; mc.strokeStyle = '#06260e'; mc.lineWidth = 2; mc.beginPath(); mc.arc(x, y, 4.5, 0, 7); mc.fill(); mc.stroke(); });
    const N = window.AF_NAV, en = N && N.last, t = en && N.target(en);
    if (t) { let [x, y] = to(t.x, t.z); const dx = x - Wd / 2, dy = y - Hd / 2, d = Math.hypot(dx, dy), lim = Wd / 2 - 14; if (d > lim) { x = Wd / 2 + dx / d * lim; y = Hd / 2 + dy / d * lim; } marker(mc, x, y, 'quest', 1.15); }
    mc.save(); mc.translate(Wd / 2, Hd / 2); mc.rotate(-R0.facing + PI); mc.fillStyle = '#fff4d0'; mc.strokeStyle = '#2a1a06'; mc.lineWidth = 2.5; mc.beginPath(); mc.moveTo(0, -12); mc.lineTo(8, 9); mc.lineTo(0, 4); mc.lineTo(-8, 9); mc.closePath(); mc.fill(); mc.stroke(); mc.restore();
    mc.restore();
    mc.strokeStyle = 'rgba(0,0,0,.6)'; mc.lineWidth = 6; mc.beginPath(); mc.arc(Wd / 2, Hd / 2, Wd / 2 - 3, 0, 7); mc.stroke();
    mc.fillStyle = '#fff'; mc.strokeStyle = '#000'; mc.lineWidth = 4; mc.font = '900 20px system-ui'; mc.textAlign = 'center'; mc.strokeText('B', Wd / 2, 24); mc.fillText('B', Wd / 2, 24);
    return true;
  };
  /* big map: the whole world */
  MAP.drawBig = function (ctx, SZ, toPx) {
    if (!MAP.img) return false;
    ctx.imageSmoothingEnabled = true; const R = MAP.R, a = toPx(-R, -R), b = toPx(R, R);
    ctx.drawImage(MAP.img, a[0], a[1], b[0] - a[0], b[1] - a[1]);
    ctx.font = '800 15px Cinzel, Georgia, serif'; ctx.textAlign = 'center';
    ZONE_NAMES().forEach((z) => { const [x, y] = toPx(z.x, z.z); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(z.n, x, y); ctx.fillStyle = '#fff4d8'; ctx.fillText(z.n, x, y); });
    const ST = window.AF_STORY; if (ST) Object.keys(ST.NPCS).forEach((id) => { const n = ST.NPCS[id], [x, y] = toPx(n.x, n.z); marker(ctx, x, y, 'npc', 1.2); });
    X.enemyById.forEach((e) => { if (e.dead || !(e.d.boss || e.d.elite)) return; const [x, y] = toPx(e.x, e.z); marker(ctx, x, y, 'boss', 1.4); });
    const N = window.AF_NAV, en = N && N.last, t = en && N.target(en); if (t) { const [x, y] = toPx(t.x, t.z); marker(ctx, x, y, 'quest', 1.6); }
    return true;
  };

  /* ---------- run ---------- */
  function go() {
    if (BK.built) return; BK.built = true;
    const t0 = performance.now();
    try { if (Q() > 0) BK.terrain = buildTerrain(); } catch (e) { console.error('[blocks terrain]', e); }
    try { bake(); } catch (e) { console.error('[blocks map]', e); }
    console.log('[blocks] dia hinh khoi vuong ' + Math.round(performance.now() - t0) + 'ms');
    /* trees and houses wait for dark.js to finish placing its models, then replace them */
    const later = () => {
      const D = window.AF_DARK;
      if (!(D && D.ready && D.built)) { setTimeout(later, 700); return; }
      try { if (Q() > 0) BK.trees = buildTrees(); } catch (e) { console.error('[blocks trees]', e); }
      try { if (Q() > 0) BK.houses = buildVillage(); } catch (e) { console.error('[blocks village]', e); }
      try { bake(); } catch (e) { /* ignore */ }
    };
    later();
  }
  const wait = () => { if (H.isRunning()) go(); else setTimeout(wait, 500); };
  wait();
})();
