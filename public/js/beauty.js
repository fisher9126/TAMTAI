/* Aetherfall visuals, step 3: a full art pass that sits on top of the game without changing any rule.
     1. Light and sky: filmic tone mapping, warmer sun, softer fill, a painted sky dome with a sun glow that follows day/night.
     2. Ground: a calmer, richer terrain grade, smooth shading, wind-blown grass, a real pond (ripples, foam, lily pads, reeds).
     3. Village: timber-frame cottages with tiled roofs, shutters, flower boxes, lanterns, chimney smoke; a cobbled square,
        street lamps, a market stall, fences, barrels, crates, hay and benches.
     4. Characters: smooth shading, a face (eyes, brows, nose, mouth, ears), fuller hair, collar, tunic and belt buckle.
        Story NPCs (Mira, Bram...) become full characters instead of boxes.
     5. Interface: one icon menu bar instead of 14 colored buttons, darker glass panels, a cleaner HUD.
   Needs window.AF_GFX (index.html) for the renderer. Everything is wrapped: if one part fails, the rest still runs and the game keeps working.
   Quality follows AF_VISUAL.quality(): 0 = low (no grass, no smoke), 1 = medium, 2 = high. */
(function () {
  'use strict';
  const T = window.THREE, G = window.AF_GFX, H = window.AF_CH, X = window.AF_CHX, RU = window.AF_RULES;
  if (!T || !G || !H || !X || !RU) { console.warn('[beauty] thieu AF_GFX/AF_CH/AF_CHX, bo qua'); return; }
  const S = G.scene, W = RU.WORLD, PI = Math.PI, TAU = PI * 2, sin = Math.sin, cos = Math.cos;
  const B = window.AF_BEAUTY = { parts: {} };
  const Q = () => (window.AF_VISUAL && window.AF_VISUAL.quality ? window.AF_VISUAL.quality() : 2);
  const night = () => !!(window.AF_EXPLORE && window.AF_EXPLORE.isNight && window.AF_EXPLORE.isNight());
  function safe(name, fn) { try { fn(); B.parts[name] = 'ok'; } catch (e) { B.parts[name] = 'loi: ' + e.message; console.error('[beauty ' + name + ']', e); } }
  const ticks = [];
  const onTick = (f) => ticks.push(f);

  /* ---------- shared helpers ---------- */
  function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  const Mat = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.82, metalness: 0 }, o || {}));
  function mk(geo, mat, cast, recv) { const m = new T.Mesh(geo, mat); m.castShadow = cast !== false; m.receiveShadow = !!recv; return m; }
  function at(parent, o, x, y, z, ry) { o.position.set(x || 0, y || 0, z || 0); if (ry) o.rotation.y = ry; parent.add(o); return o; }
  function canvasTex(w, h, draw, rx, ry) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); t.anisotropy = 4; return t;
  }
  let glowT = null;
  function glowTex() {
    if (glowT) return glowT;
    glowT = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
    return glowT;
  }
  function glow(color, size, op) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: op == null ? 0.8 : op }));
    s.scale.setScalar(size); return s;
  }
  /* grayscale textures, tinted by material color */
  const TEX = {};
  function tex(name) {
    if (TEX[name]) return TEX[name];
    const r = rng(name.length * 977 + 13);
    if (name === 'tiles') TEX[name] = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#b8b8b8'; g.fillRect(0, 0, w, h);
      const rows = 8, rh = h / rows, cols = 8, cw = w / cols;
      for (let y = 0; y < rows; y++) for (let x = -1; x < cols + 1; x++) {
        const ox = (y % 2) * cw / 2, px = x * cw + ox, v = 175 + Math.floor(r() * 60);
        g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
        g.beginPath(); g.moveTo(px + 2, y * rh); g.lineTo(px + cw - 2, y * rh); g.lineTo(px + cw - 2, y * rh + rh * 0.72); g.quadraticCurveTo(px + cw / 2, y * rh + rh + 4, px + 2, y * rh + rh * 0.72); g.closePath(); g.fill();
        g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(px + 2, y * rh + rh * 0.78, cw - 4, rh * 0.22);
        g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(px + 3, y * rh + 2, cw - 6, 3);
      }
    }, 2, 1);
    else if (name === 'plaster') TEX[name] = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#e9e9e9'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) { const v = 200 + Math.floor(r() * 55); g.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',.35)'; g.fillRect(r() * w, r() * h, 2 + r() * 5, 2 + r() * 5); }
      for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(120,110,100,.12)'; g.beginPath(); g.ellipse(r() * w, r() * h, 10 + r() * 30, 6 + r() * 14, r() * 3, 0, TAU); g.fill(); }
    }, 1, 1);
    else if (name === 'stone') TEX[name] = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#5a5a5a'; g.fillRect(0, 0, w, h);
      const rows = 6, rh = h / rows;
      for (let y = 0; y < rows; y++) { let x = -r() * 30; while (x < w) { const sw = 30 + r() * 40, v = 130 + Math.floor(r() * 80); g.fillStyle = 'rgb(' + v + ',' + v + ',' + (v - 4) + ')'; roundRect(g, x + 2, y * rh + 2, sw - 4, rh - 4, 8); g.fill(); g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(x + 6, y * rh + 4, sw - 14, 3); x += sw; } }
    }, 1, 1);
    else if (name === 'cobble') TEX[name] = canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#6e6a63'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 520; i++) { const x = r() * w, y = r() * h, s = 10 + r() * 14, v = 140 + Math.floor(r() * 70); g.fillStyle = 'rgb(' + v + ',' + (v - 3) + ',' + (v - 10) + ')'; g.beginPath(); g.ellipse(x, y, s, s * (0.7 + r() * 0.3), r() * 3, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.ellipse(x - s * 0.2, y - s * 0.25, s * 0.5, s * 0.3, 0, 0, TAU); g.fill(); }
    }, 3, 3);
    else if (name === 'planks') TEX[name] = canvasTex(128, 256, (g, w, h) => {
      const n = 5, pw = w / n;
      for (let i = 0; i < n; i++) { const v = 150 + Math.floor(r() * 50); g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.fillRect(i * pw, 0, pw, h); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(i * pw, 0, 2, h);
        for (let k = 0; k < 6; k++) { g.strokeStyle = 'rgba(0,0,0,.12)'; g.beginPath(); const x = i * pw + 4 + r() * (pw - 8); g.moveTo(x, r() * h); g.lineTo(x + (r() - 0.5) * 4, r() * h); g.stroke(); } }
    }, 1, 1);
    else if (name === 'stripes') TEX[name] = canvasTex(128, 32, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4efe4' : '#c8443a'; g.fillRect(i * 16, 0, 16, h); } }, 1, 1);
    else if (name === 'ripple') TEX[name] = canvasTex(256, 256, (g, w, h) => {
      const img = g.createImageData(w, h), d = img.data;
      const f = (x, y) => sin(x * 0.11 + sin(y * 0.07) * 2) * 0.5 + sin(y * 0.13 + sin(x * 0.05) * 3) * 0.5 + sin((x + y) * 0.05) * 0.4;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = f(x + 1, y) - f(x - 1, y), dy = f(x, y + 1) - f(x, y - 1), i = (y * w + x) * 4; d[i] = 128 + dx * 60; d[i + 1] = 128 + dy * 60; d[i + 2] = 255; d[i + 3] = 255; }
      g.putImageData(img, 0, 0);
    }, 5, 5);
    return TEX[name];
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  const roads = [W.FOREST, W.ARENA, W.POND];
  function segDist(px, pz, ax, az, bx, bz) { const vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz))); return Math.hypot(px - (ax + vx * t), pz - (az + vz * t)); }
  const roadDist = (x, z) => Math.min.apply(null, roads.map((p) => segDist(x, z, 0, 0, p.x, p.z)));

  /* ================= 1. LIGHT AND SKY ================= */
  const SKY = { top: new T.Color(0x3f86d8), hor: new T.Color(0xe3ecef), night: new T.Color(0x0b1430), sun: new T.Color(0xfff0c8) };
  let skyMat = null, baseBgLum = 1;
  safe('light', () => {
    const r = G.renderer;
    r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    G.sun.color.setHex(0xfff0d6); G.sun.intensity = 1.55;
    S.traverse((o) => { if (o.isHemisphereLight) { o.color.setHex(0xd6e6ff); o.groundColor.setHex(0x6a6040); o.intensity = 0.32; } });
    if (S.fog) S.fog.color.copy(SKY.hor);
    if (S.background && S.background.isColor) S.background.copy(SKY.hor);
    baseBgLum = lum(SKY.hor);
    skyMat = new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: SKY.top.clone() }, hor: { value: SKY.hor.clone() }, nightC: { value: SKY.night.clone() }, sunC: { value: SKY.sun.clone() }, sunDir: { value: new T.Vector3(0.5, 0.75, 0.3) }, dim: { value: 1 } },
      vertexShader: 'varying vec3 vP; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
      fragmentShader: [
        'uniform vec3 top; uniform vec3 hor; uniform vec3 nightC; uniform vec3 sunC; uniform vec3 sunDir; uniform float dim; varying vec3 vP;',
        'void main(){ vec3 d=normalize(vP-cameraPosition); float h=d.y; float t=pow(clamp(h,0.0,1.0),0.5);',
        ' vec3 c=mix(hor,top,t); c=mix(c,hor*0.92,clamp(-h*4.0,0.0,1.0));',
        ' float s=max(dot(d,normalize(sunDir)),0.0); c+=sunC*(pow(s,900.0)*2.5+pow(s,24.0)*0.22+pow(s,4.0)*0.06)*dim;',
        ' vec3 n=mix(nightC*1.6,nightC*0.55,t); c=mix(n,c,clamp(dim,0.0,1.0));',
        ' gl_FragColor=vec4(c,1.0); }'].join('\n')
    });
    G.sky.material = skyMat;
    // image-based light so metal (swords, armor, lanterns) reflects a sky instead of turning black
    if (T.PMREMGenerator) {
      const es = new T.Scene(), geo = new T.SphereGeometry(10, 32, 16), cols = [], p = geo.attributes.position, c = new T.Color();
      for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 10; if (y > 0) c.copy(SKY.hor).lerp(SKY.top, Math.pow(y, 0.6)); else c.setHex(0x5f5a3c).lerp(new T.Color(0x9aa07a), 1 + y); cols.push(c.r, c.g, c.b); }
      geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
      es.add(new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
      const sunB = new T.Mesh(new T.SphereGeometry(1.2, 12, 8), new T.MeshBasicMaterial({ color: 0xfff2d0 })); sunB.position.set(5, 7, 3); es.add(sunB);
      const pm = new T.PMREMGenerator(r); S.environment = pm.fromScene(es, 0.03).texture; pm.dispose();
    }
    // softer clouds
    S.children.forEach((g) => {
      if (!g.isGroup || g.position.y < 45 || g.children.length !== 4) return;
      g.children.forEach((m) => { if (m.material) { m.material.flatShading = false; m.material.roughness = 1; m.material.emissive && m.material.emissive.setHex(0xaab8c8); m.material.emissiveIntensity = 0.35; m.material.needsUpdate = true; m.castShadow = false; } });
    });
  });
  function lum(c) { return c.r * 0.3 + c.g * 0.59 + c.b * 0.11; }
  onTick(() => {
    if (!skyMat) return;
    const bg = S.background && S.background.isColor ? S.background : SKY.hor;
    const dim = Math.max(0, Math.min(1.1, lum(bg) / baseBgLum));
    skyMat.uniforms.dim.value = dim;
    skyMat.uniforms.hor.value.copy(bg);
    skyMat.uniforms.sunDir.value.subVectors(G.sun.position, G.sun.target.position).normalize();
    G.renderer.toneMappingExposure = 0.98 + 0.08 * Math.min(1, dim);
    envDim = 0.15 + 0.85 * Math.min(1, dim);
  });
  /* the sky reflection follows day and night too */
  let envDim = 1, envList = [], envT = 0;
  onTick((dt) => {
    envT -= dt; if (envT > 0 || !S.environment) return; envT = 1;
    if (!envList.length || Math.random() < 0.2) { envList = []; const seen = new Set(); S.traverse((o) => { const m = o.material; if (m && m.isMeshStandardMaterial && !seen.has(m)) { seen.add(m); envList.push(m); } }); }
    envList.forEach((m) => { m.envMapIntensity = envDim * (m.metalness > 0.4 ? 1 : 0.45); });
  });

  /* ================= 2. GROUND, WATER, GRASS ================= */
  let terrain = null;
  safe('terrain', () => {
    S.children.forEach((o) => { if (o.isMesh && o.geometry && o.geometry.type === 'PlaneGeometry' && o.geometry.parameters.width >= 200 && o.material.vertexColors) terrain = o; });
    if (!terrain) return;
    const col = terrain.geometry.attributes.color, pos = terrain.geometry.attributes.position, c = new T.Color(), hsl = {};
    for (let i = 0; i < col.count; i++) {
      c.setRGB(col.getX(i), col.getY(i), col.getZ(i)); c.getHSL(hsl);
      const x = pos.getX(i), z = pos.getZ(i);
      const n = sin(x * 0.09 + cos(z * 0.07) * 2) * 0.5 + sin(z * 0.11 - x * 0.05) * 0.5;
      const green = hsl.h > 0.17 && hsl.h < 0.45 && hsl.s > 0.25;
      if (green) { hsl.s = Math.min(1, hsl.s * 1.12); hsl.l = hsl.l * 0.74 + n * 0.035; hsl.h += n * 0.02 - 0.012; }
      else { hsl.l = hsl.l * 0.97 + n * 0.02; }
      c.setHSL(hsl.h, Math.max(0, Math.min(1, hsl.s)), Math.max(0, Math.min(1, hsl.l)));
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
    terrain.material.flatShading = false; terrain.material.roughness = 0.95; terrain.material.needsUpdate = true;
    B.terrain = terrain;
  });
  function groundColorAt(x, z) {
    if (!terrain) return null;
    const step = 260 / 150, col = Math.round((x + 130) / step), row = Math.round((z + 130) / step);
    if (col < 0 || row < 0 || col > 150 || row > 150) return null;
    const a = terrain.geometry.attributes.color, i = row * 151 + col;
    return new T.Color(a.getX(i), a.getY(i), a.getZ(i));
  }
  const windU = { value: 0 };
  onTick((dt) => { windU.value += dt; });
  safe('grass', () => {
    if (Q() === 0 || !terrain) return;
    const N = Q() === 2 ? 16000 : 7000;
    const geo = new T.BufferGeometry(), P = [], Cc = [];
    for (let k = 0; k < 3; k++) {
      const a = k * PI / 3, ca = cos(a), sa = sin(a), w = 0.12;
      const tri = [[-w, 0], [w, 0], [0, 0.62]];
      tri.forEach(([u, y], j) => { P.push(u * ca, y * 0.75, u * sa); const s = j === 2 ? 1.18 : 0.82; Cc.push(s, s, s); });
      const b = k * PI / 3 + 0.5, cb = cos(b), sb = sin(b);
      [[-w, 0], [w, 0], [0.04, 0.45]].forEach(([u, y], j) => { P.push(u * cb + 0.08, y * 0.75, u * sb + 0.05); const s = j === 2 ? 1.12 : 0.82; Cc.push(s, s, s); });
    }
    geo.setAttribute('position', new T.Float32BufferAttribute(P, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(Cc, 3)); geo.computeVertexNormals();
    const mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: T.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uWind = windU;
      sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', [
        '#include <begin_vertex>',
        'float wph = instanceMatrix[3].x * 0.21 + instanceMatrix[3].z * 0.17;',
        'float sway = sin(uWind * 1.9 + wph) * 0.6 + sin(uWind * 3.7 + wph * 1.7) * 0.25;',
        'transformed.x += sway * 0.13 * position.y; transformed.z += cos(uWind * 1.3 + wph) * 0.07 * position.y;'].join('\n'));
    };
    const im = new T.InstancedMesh(geo, mat, N); im.receiveShadow = true; im.castShadow = false;
    const r = rng(4242), d = new T.Object3D(), c = new T.Color(); let n = 0, tries = 0;
    while (n < N && tries < N * 6) {
      tries++;
      const a = r() * TAU, rad = Math.sqrt(r()) * 100, x = cos(a) * rad, z = sin(a) * rad;
      if (Math.hypot(x, z) < 8.6 || roadDist(x, z) < 1.8 || Math.hypot(x - W.POND.x, z - W.POND.z) < 12.6) continue;
      const g = groundColorAt(x, z); if (!g) continue;
      const hsl = {}; g.getHSL(hsl); if (!(hsl.h > 0.17 && hsl.h < 0.45 && hsl.s > 0.18)) continue;
      d.position.set(x, H.heightAt(x, z) - 0.02, z); d.rotation.set(0, r() * TAU, 0); const s = 0.7 + r() * 0.6; d.scale.set(s, s * (0.8 + r() * 0.5), s); d.updateMatrix();
      im.setMatrixAt(n, d.matrix); c.copy(g).offsetHSL((r() - 0.5) * 0.03, 0.06, 0.02 + r() * 0.06); im.setColorAt(n, c); n++;
    }
    im.count = n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.frustumCulled = false; S.add(im); B.grass = im;
    // the old spiky cone grass goes away
    S.children.forEach((o) => { if (o.isInstancedMesh && o !== im && o.geometry.type === 'ConeGeometry' && o.geometry.parameters.radius < 0.2) o.visible = false; });
  });
  safe('trees', () => {
    const c = new T.Color(), hsl = {};
    S.children.forEach((o) => {
      if (!o.isInstancedMesh || !o.instanceColor) return;
      const t = o.geometry.type, p = o.geometry.parameters || {};
      const crown = (t === 'IcosahedronGeometry' && p.radius > 1) || (t === 'ConeGeometry' && p.radius >= 1);
      if (!crown) return;
      for (let i = 0; i < o.count; i++) { o.getColorAt(i, c); c.getHSL(hsl); c.setHSL(hsl.h + 0.01, hsl.s * 0.92, hsl.l * 0.8); o.setColorAt(i, c); }
      o.instanceColor.needsUpdate = true; o.material.roughness = 0.95; o.receiveShadow = true;
    });
  });
  safe('pond', () => {
    let water = null;
    S.children.forEach((o) => { if (o.isMesh && o.geometry && o.geometry.type === 'CircleGeometry' && Math.abs(o.position.x - W.POND.x) < 0.5 && Math.abs(o.position.z - W.POND.z) < 0.5) water = o; });
    if (!water) return;
    const ripple = tex('ripple');
    water.material = new T.MeshStandardMaterial({ color: 0x2e7fb2, roughness: 0.06, metalness: 0.35, transparent: true, opacity: 0.86, normalMap: ripple, normalScale: new T.Vector2(0.35, 0.35) });
    water.receiveShadow = true;
    onTick((dt) => { ripple.offset.x += dt * 0.012; ripple.offset.y += dt * 0.007; });
    const y = water.position.y;
    const foam = mk(new T.RingGeometry(11.3, 12.2, 64), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false }), false);
    foam.rotation.x = -PI / 2; at(S, foam, W.POND.x, y + 0.02, W.POND.z);
    const r = rng(77), pad = Mat(0x4f8a3a, { roughness: 0.7, side: T.DoubleSide }), flower = Mat(0xffb3d1, { emissive: 0x552233, emissiveIntensity: 0.2 });
    for (let i = 0; i < 14; i++) {
      const a = r() * TAU, rd = 3 + r() * 7, s = 0.35 + r() * 0.4;
      const p = mk(new T.CircleGeometry(s, 14, 0.4, TAU - 0.4), pad, false, true); p.rotation.x = -PI / 2; p.rotation.z = r() * TAU;
      at(S, p, W.POND.x + cos(a) * rd, y + 0.03, W.POND.z + sin(a) * rd);
      if (r() < 0.35) at(S, mk(new T.SphereGeometry(0.11, 8, 6), flower, false), p.position.x, y + 0.1, p.position.z);
    }
    const reed = Mat(0x6f8a3a), cat = Mat(0x5a3a22);
    for (let i = 0; i < 26; i++) {
      const a = r() * TAU, rd = 11.6 + r() * 1.6, x = W.POND.x + cos(a) * rd, z = W.POND.z + sin(a) * rd, gy = H.heightAt(x, z);
      const cl = new T.Group();
      for (let k = 0; k < 4; k++) { const h = 0.9 + r() * 0.9, st = mk(new T.CylinderGeometry(0.018, 0.03, h, 4), reed); st.position.set((r() - 0.5) * 0.4, h / 2, (r() - 0.5) * 0.4); st.rotation.z = (r() - 0.5) * 0.3; cl.add(st); if (r() < 0.5) { const tp = mk(new T.CylinderGeometry(0.05, 0.05, 0.22, 6), cat); tp.position.set(st.position.x, h, st.position.z); cl.add(tp); } }
      at(S, cl, x, gy - 0.05, z);
    }
  });

  /* ================= 3. VILLAGE ================= */
  const MAT = {};
  function mats() {
    if (MAT.ok) return MAT; MAT.ok = true;
    MAT.plaster = Mat(0xf2e8d2, { map: tex('plaster'), roughness: 0.95 });
    MAT.timber = Mat(0x5b3b24, { roughness: 0.85 });
    MAT.stone = Mat(0xb3ada3, { map: tex('stone'), roughness: 0.95 });
    MAT.door = Mat(0x7a4f2c, { map: tex('planks'), roughness: 0.8 });
    MAT.glass = Mat(0xa9cde3, { roughness: 0.15, metalness: 0.3, emissive: 0xffc56a, emissiveIntensity: 0 });
    MAT.iron = Mat(0x2a2a30, { roughness: 0.5, metalness: 0.7 });
    MAT.brass = Mat(0xd9a84a, { roughness: 0.35, metalness: 0.8 });
    MAT.lampGlass = Mat(0xffe2a0, { emissive: 0xffb84a, emissiveIntensity: 0.4, roughness: 0.2 });
    MAT.wood = Mat(0x8a5a32, { map: tex('planks'), roughness: 0.85 });
    MAT.hay = Mat(0xd9b860, { roughness: 1 });
    MAT.dirt = Mat(0x6a4a2a);
    MAT.leaf = Mat(0x4f8a3a);
    MAT.flowers = [0xff5a6a, 0xffd34a, 0xff9ad0, 0xb48cff, 0xffffff].map((c) => Mat(c, { roughness: 0.6 }));
    MAT.shutters = [0x3e6e8e, 0x6e8a3a, 0x8e3e3e, 0x4a6a5a, 0x7a5a9a].map((c) => Mat(c, { map: tex('planks'), roughness: 0.8 }));
    MAT.roofs = [0xb4523c, 0xa8462f, 0x3f6fb0, 0x9a5a3a, 0x7a3a2a];
    return MAT;
  }
  const lamps = [], windows = [], smokes = [];
  function roofMat(hex) { const t = tex('tiles').clone(); t.needsUpdate = true; t.repeat.set(3, 2.2); return Mat(hex, { map: t, roughness: 0.85 }); }
  function beam(g, w, h, d, x, y, z, rz) { const b = at(g, mk(new T.BoxGeometry(w, h, d), MAT.timber), x, y, z); if (rz) b.rotation.z = rz; return b; }
  function windowAt(g, x, y, z, ry, shutter, flowersOn, r) {
    const wg = new T.Group(); at(g, wg, x, y, z, ry);
    at(wg, mk(new T.BoxGeometry(0.86, 0.96, 0.08), MAT.timber), 0, 0, 0);
    const gl = at(wg, mk(new T.BoxGeometry(0.66, 0.76, 0.06), MAT.glass, false), 0, 0, 0.03); windows.push(gl);
    at(wg, mk(new T.BoxGeometry(0.05, 0.76, 0.09), MAT.timber, false), 0, 0, 0.05);
    at(wg, mk(new T.BoxGeometry(0.66, 0.05, 0.09), MAT.timber, false), 0, 0.04, 0.05);
    [-1, 1].forEach((s) => { const sh = at(wg, mk(new T.BoxGeometry(0.36, 0.86, 0.04), shutter), s * 0.62, 0, 0.12); sh.rotation.y = s * 0.45; });
    at(wg, mk(new T.BoxGeometry(0.98, 0.07, 0.2), MAT.timber), 0, -0.52, 0.08);
    if (flowersOn) {
      at(wg, mk(new T.BoxGeometry(0.86, 0.18, 0.22), MAT.wood), 0, -0.64, 0.18);
      for (let i = 0; i < 6; i++) { at(wg, mk(new T.SphereGeometry(0.09, 7, 5), MAT.leaf, false), -0.34 + i * 0.136, -0.5, 0.18 + (r() - 0.5) * 0.06); at(wg, mk(new T.SphereGeometry(0.06, 6, 5), MAT.flowers[Math.floor(r() * 5)], false), -0.34 + i * 0.136 + 0.03, -0.43, 0.22); }
    }
  }
  function lantern(parent, x, y, z) {
    const g = new T.Group(); at(parent, g, x, y, z);
    at(g, mk(new T.BoxGeometry(0.24, 0.3, 0.24), MAT.iron, false), 0, 0, 0);
    at(g, mk(new T.BoxGeometry(0.18, 0.24, 0.26), MAT.lampGlass, false), 0, 0, 0);
    at(g, mk(new T.BoxGeometry(0.26, 0.18, 0.18), MAT.lampGlass, false), 0, 0, 0);
    const cap = at(g, mk(new T.ConeGeometry(0.2, 0.16, 4), MAT.iron, false), 0, 0.23, 0); cap.rotation.y = PI / 4;
    const gl = glow(0xffc46a, 1.6, 0.0); at(g, gl, 0, 0, 0); lamps.push(gl);
    return g;
  }
  function cottage(w, d, idx) {
    const M = mats(), r = rng(1000 + idx * 31), g = new T.Group();
    const wallH = idx === 4 ? 3.2 : 2.7, base = 0.55, top = base + wallH, roofH = d * 0.5 + 0.35, over = 0.5;
    // stone plinth and plaster walls
    at(g, mk(new T.BoxGeometry(w + 0.25, base, d + 0.25), M.stone, true, true), 0, base / 2, 0);
    at(g, mk(new T.BoxGeometry(w, wallH, d), M.plaster, true, true), 0, base + wallH / 2, 0);
    // timber frame: posts, rails, braces on the long walls
    [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => beam(g, 0.2, wallH, 0.2, sx * (w / 2), base + wallH / 2, sz * (d / 2))));
    [-1, 1].forEach((sz) => {
      [base + 0.08, base + wallH * 0.55, top - 0.08].forEach((y) => beam(g, w + 0.02, 0.14, 0.12, 0, y, sz * (d / 2 + 0.01)));
      [-1, 1].forEach((sx) => { const bx = sx * (w / 2 - 0.55); beam(g, 0.12, wallH * 0.62, 0.11, bx, base + wallH * 0.3, sz * (d / 2 + 0.02), sx * 0.55); });
    });
    [-1, 1].forEach((sx) => { [base + 0.08, top - 0.08].forEach((y) => { const b = beam(g, d + 0.02, 0.14, 0.12, sx * (w / 2 + 0.01), y, 0); b.rotation.y = PI / 2; }); });
    // gable roof: ridge along x, slopes face front/back
    const hd = d / 2 + over, slope = Math.hypot(hd, roofH), ang = Math.atan2(roofH, hd);
    const rm = roofMat(M.roofs[idx % M.roofs.length]);
    [-1, 1].forEach((sz) => { const sl = at(g, mk(new T.BoxGeometry(w + over * 2, 0.16, slope), rm, true, true), 0, top + roofH / 2 + 0.05, sz * hd / 2); sl.rotation.x = sz * ang; });
    const ridge = at(g, mk(new T.CylinderGeometry(0.13, 0.13, w + over * 2 + 0.1, 8), MAT.timber), 0, top + roofH + 0.1, 0); ridge.rotation.z = PI / 2;
    // gable ends (triangles of plaster with a timber king post)
    const tri = new T.Shape(); tri.moveTo(-d / 2, 0); tri.lineTo(d / 2, 0); tri.lineTo(0, roofH); tri.lineTo(-d / 2, 0);
    const triGeo = new T.ExtrudeGeometry(tri, { depth: 0.12, bevelEnabled: false });
    [-1, 1].forEach((sx) => { const gm = at(g, mk(triGeo, M.plaster, true, true), sx > 0 ? w / 2 - 0.12 : -w / 2, top, 0); gm.rotation.y = PI / 2; beam(g, 0.12, roofH * 0.9, 0.12, sx * (w / 2 + 0.04), top + roofH * 0.45, 0).rotation.y = PI / 2; });
    // door with frame, step and lantern
    at(g, mk(new T.BoxGeometry(1.25, 2.0, 0.12), MAT.timber), 0, base + 1.0, d / 2 + 0.03);
    at(g, mk(new T.BoxGeometry(1.0, 1.85, 0.1), M.door), 0, base + 0.93, d / 2 + 0.08);
    at(g, mk(new T.SphereGeometry(0.05, 8, 6), M.brass, false), 0.33, base + 0.95, d / 2 + 0.15);
    at(g, mk(new T.BoxGeometry(1.5, 0.22, 0.6), M.stone, true, true), 0, 0.12, d / 2 + 0.38);
    lantern(g, 0.85, base + 1.75, d / 2 + 0.2);
    // windows (front pair, back pair, one per side)
    const sh = M.shutters[idx % M.shutters.length];
    [-1, 1].forEach((s) => { windowAt(g, s * (w / 4 + 0.15), base + 1.5, d / 2 + 0.05, 0, sh, true, r); windowAt(g, s * (w / 4 + 0.15), base + 1.5, -d / 2 - 0.05, PI, sh, false, r); });
    [-1, 1].forEach((s) => windowAt(g, s * (w / 2 + 0.05), base + 1.5, 0, s * PI / 2, sh, false, r));
    // chimney with smoke
    const cx = w * 0.28, cz = -d * 0.18, ch = mk(new T.BoxGeometry(0.62, roofH + 1.4, 0.62), M.stone);
    at(g, ch, cx, top + (roofH + 1.4) / 2 - 0.2, cz);
    at(g, mk(new T.BoxGeometry(0.78, 0.14, 0.78), M.stone), cx, top + roofH + 1.25, cz);
    smokes.push({ g, x: cx, y: top + roofH + 1.4, z: cz, parts: [], next: r() * 2 });
    // town hall gets a banner and a bell
    if (idx === 4) {
      const pole = at(g, mk(new T.CylinderGeometry(0.05, 0.05, 2.4, 6), MAT.timber), w / 2 - 0.3, top + roofH + 0.9, 0);
      const flag = at(g, mk(new T.PlaneGeometry(1.1, 0.7, 6, 1), Mat(0x2a4a9a, { side: T.DoubleSide, emissive: 0x112244, emissiveIntensity: 0.2 })), w / 2 - 0.3 + 0.58, top + roofH + 1.75, 0);
      onTick(() => { const p = flag.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 0.55; p.setZ(i, sin(windU.value * 4 + x * 5) * 0.08 * x); } p.needsUpdate = true; });
      pole.castShadow = true;
    }
    g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
    return g;
  }
  function replaceHouses() {
    const list = [];
    S.children.forEach((o) => { if (o.userData && o.userData.afHouse && !o.userData.afReplaced) list.push(o); });
    list.forEach((o) => {
      const u = o.userData.afHouse, nh = cottage(u.w, u.d, u.i);
      nh.position.copy(o.position); nh.rotation.copy(o.rotation); S.add(nh);
      o.userData.afReplaced = true; o.visible = false; o.traverse((m) => { if (m.isMesh) m.castShadow = false; });
    });
    return list.length;
  }
  function free(x, z, rad) {
    if (roadDist(x, z) < 2.2 + rad) return false;
    for (const o of S.children) if (o.userData && o.userData.afHouse && Math.hypot(o.position.x - x, o.position.z - z) < 3.6 + rad) return false;
    const pts = [[4, -2, 1.8], [1.5, 5, 1.6], [0, 0, 3], [1, 9, 3.2]];
    const st = window.AF_STORY && window.AF_STORY.NPCS; if (st) Object.keys(st).forEach((k) => pts.push([st[k].x, st[k].z, 1.6]));
    const E = window.AF_EXPLORE; if (E && E.wps) E.wps.forEach((p) => { if (p && p.x != null) pts.push([p.x, p.z, 2.5]); });
    for (const p of pts) if (Math.hypot(p[0] - x, p[1] - z) < p[2] + rad) return false;
    return true;
  }
  function block(x, z, r) { if (G.obstacles) G.obstacles.push({ x, z, r }); }
  function propBarrel(x, z, r) { const g = new T.Group(); at(g, mk(new T.CylinderGeometry(0.34, 0.3, 0.8, 12), MAT.wood), 0, 0.4, 0); [0.12, 0.68].forEach((y) => { const h = at(g, mk(new T.TorusGeometry(0.33, 0.025, 4, 16), MAT.iron, false), 0, y, 0); h.rotation.x = PI / 2; }); at(g, mk(new T.CylinderGeometry(0.29, 0.29, 0.02, 12), MAT.timber, false), 0, 0.8, 0); g.rotation.y = r() * TAU; return g; }
  function propCrate(r) { const g = new T.Group(); const s = 0.6 + r() * 0.25; at(g, mk(new T.BoxGeometry(s, s, s), MAT.wood), 0, s / 2, 0); [-1, 1].forEach((k) => { const b = at(g, mk(new T.BoxGeometry(s * 1.36, 0.06, 0.04), MAT.timber, false), 0, s / 2, k * (s / 2 + 0.01)); b.rotation.z = 0.78; }); g.rotation.y = r() * TAU; return g; }
  function propHay(r) { const g = new T.Group(); at(g, mk(new T.CylinderGeometry(0.5, 0.52, 0.75, 14), MAT.hay), 0, 0.37, 0); const t = at(g, mk(new T.CylinderGeometry(0.42, 0.5, 0.12, 14), MAT.hay), 0, 0.8, 0); t.castShadow = false; [0.2, 0.55].forEach((y) => { const b = at(g, mk(new T.TorusGeometry(0.515, 0.02, 4, 18), MAT.timber, false), 0, y, 0); b.rotation.x = PI / 2; }); return g; }
  function propLamp() {
    const g = new T.Group();
    at(g, mk(new T.CylinderGeometry(0.16, 0.22, 0.3, 8), MAT.stone), 0, 0.15, 0);
    at(g, mk(new T.CylinderGeometry(0.05, 0.07, 2.6, 8), MAT.iron), 0, 1.45, 0);
    const arm = at(g, mk(new T.BoxGeometry(0.6, 0.05, 0.05), MAT.iron, false), 0.25, 2.65, 0); arm.castShadow = false;
    lantern(g, 0.5, 2.38, 0); return g;
  }
  function propStall(r) {
    const g = new T.Group(), awn = Mat(0xffffff, { map: tex('stripes'), side: T.DoubleSide, roughness: 0.9 });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => at(g, mk(new T.CylinderGeometry(0.06, 0.06, 2.3, 6), MAT.timber), sx * 1.2, 1.15, sz * 0.7));
    const top = at(g, mk(new T.BoxGeometry(2.8, 0.06, 1.9), awn), 0, 2.35, 0.15); top.rotation.x = -0.18;
    at(g, mk(new T.BoxGeometry(2.5, 0.9, 1.0), MAT.wood), 0, 0.45, 0.1);
    at(g, mk(new T.BoxGeometry(2.6, 0.08, 1.1), MAT.timber), 0, 0.92, 0.1);
    const prod = [0xff5a3a, 0xffb43a, 0x8fd14a, 0xd94a8a];
    for (let i = 0; i < 4; i++) { const bk = at(g, mk(new T.CylinderGeometry(0.26, 0.2, 0.18, 10), MAT.hay), -0.9 + i * 0.6, 1.04, 0.1); bk.castShadow = false;
      for (let k = 0; k < 5; k++) at(g, mk(new T.SphereGeometry(0.08, 7, 5), Mat(prod[i], { roughness: 0.5 }), false), -0.9 + i * 0.6 + (r() - 0.5) * 0.25, 1.16, 0.1 + (r() - 0.5) * 0.25); }
    return g;
  }
  function propBench() { const g = new T.Group(); at(g, mk(new T.BoxGeometry(1.6, 0.08, 0.42), MAT.wood), 0, 0.45, 0); at(g, mk(new T.BoxGeometry(1.6, 0.36, 0.06), MAT.wood), 0, 0.72, -0.2); [-0.65, 0.65].forEach((x) => at(g, mk(new T.BoxGeometry(0.08, 0.45, 0.4), MAT.iron), x, 0.22, 0)); return g; }
  function fence(x1, z1, x2, z2) {
    const g = new T.Group(), L = Math.hypot(x2 - x1, z2 - z1), n = Math.max(2, Math.round(L / 1.1));
    for (let i = 0; i <= n; i++) { const t = i / n, x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t; const p = at(g, mk(new T.BoxGeometry(0.11, 0.95, 0.11), MAT.timber), x, H.heightAt(x, z) + 0.47, z); const tp = at(g, mk(new T.ConeGeometry(0.09, 0.16, 4), MAT.timber, false), x, H.heightAt(x, z) + 1.02, z); tp.rotation.y = PI / 4; p.receiveShadow = true; }
    const a = Math.atan2(z2 - z1, x2 - x1);
    [0.38, 0.72].forEach((hy) => { const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, rail = at(g, mk(new T.BoxGeometry(L, 0.07, 0.05), MAT.wood), mx, H.heightAt(mx, mz) + hy, mz); rail.rotation.y = -a; });
    S.add(g);
  }
  function flowerBed(x, z, r) { const g = new T.Group(); const bed = at(g, mk(new T.CylinderGeometry(0.75, 0.8, 0.22, 14), MAT.stone, true, true), 0, 0.11, 0); bed.castShadow = false; at(g, mk(new T.CylinderGeometry(0.66, 0.66, 0.05, 14), MAT.dirt, false), 0, 0.22, 0); for (let i = 0; i < 12; i++) { const a = r() * TAU, rd = r() * 0.55; at(g, mk(new T.SphereGeometry(0.1, 6, 5), MAT.leaf, false), cos(a) * rd, 0.3, sin(a) * rd); at(g, mk(new T.SphereGeometry(0.07, 6, 5), MAT.flowers[Math.floor(r() * 5)], false), cos(a) * rd, 0.4, sin(a) * rd); } return at(S, g, x, H.heightAt(x, z), z); }
  function foliage() {
    const c = new T.Color(), hsl = {}, seen = new Set();
    S.traverse((o) => {
      if (!o.isMesh || o === B.grass || o === terrain) return;
      const t = o.geometry && o.geometry.type; if (t !== 'IcosahedronGeometry' && t !== 'DodecahedronGeometry' && t !== 'ConeGeometry' && t !== 'SphereGeometry') return;
      const p = o.geometry.parameters || {}; if (!(p.radius >= 0.9)) return;
      if (o.isInstancedMesh && o.instanceColor) return;
      const m = o.material; if (!m || !m.color || seen.has(m)) return; m.color.getHSL(hsl);
      if (hsl.h > 0.18 && hsl.h < 0.42 && hsl.s > 0.45 && hsl.l > 0.35) { seen.add(m); m.color.setHSL(hsl.h + 0.01, hsl.s * 0.88, hsl.l * 0.78); }
    });
  }
  function buildVillage() {
    mats(); safe('foliage', foliage);
    const n = replaceHouses();
    const r = rng(9090), y0 = H.heightAt(0, 0);
    // cobbled square
    const sq = mk(new T.CircleGeometry(7.6, 48), Mat(0xb0a898, { map: tex('cobble'), roughness: 0.95 }), false, true); sq.rotation.x = -PI / 2; at(S, sq, 0, y0 + 0.025, 0);
    const curb = mk(new T.RingGeometry(7.5, 7.9, 48), Mat(0x8e8a80, { roughness: 1 }), false, true); curb.rotation.x = -PI / 2; at(S, curb, 0, y0 + 0.03, 0);
    // street lamps on the ring of the square
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + 0.2, x = cos(a) * 8.4, z = sin(a) * 8.4; if (!free(x, z, 0.3)) continue; const l = propLamp(); l.rotation.y = -a + PI; at(S, l, x, H.heightAt(x, z), z); block(x, z, 0.25); }
    // market stall, benches, barrels, crates, hay, flower beds
    const spots = [];
    for (let i = 0; i < 200 && spots.length < 18; i++) { const a = r() * TAU, rd = 9.8 + r() * 8, x = cos(a) * rd, z = sin(a) * rd; if (free(x, z, 1.1) && spots.every((s) => Math.hypot(s[0] - x, s[1] - z) > 3.4)) spots.push([x, z, a]); }
    spots.forEach(([x, z, a], i) => {
      const gy = H.heightAt(x, z); let o = null, rad = 0.5;
      if (i === 0) { o = propStall(r); rad = 1.4; } else if (i < 4) { o = propBench(); rad = 0.8; } else if (i < 8) { flowerBed(x, z, r); block(x, z, 0.7); return; }
      else { const k = i % 4; o = k === 0 || k === 2 ? propBarrel(x, z, r) : k === 1 ? propCrate(r) : propHay(r); if (k !== 3 && r() < 0.6) { const o2 = k === 0 ? propBarrel(x, z, r) : propCrate(r); o2.position.set(0.75, 0, 0.2); o.add(o2); } rad = 0.8; }
      o.rotation.y = o.rotation.y || (-a + PI / 2); at(S, o, x, gy, z); block(x, z, rad);
    });
    // fences on the village rim, cut where the roads leave
    const rim = 19, segs = 28;
    for (let i = 0; i < segs; i++) {
      const a1 = i / segs * TAU, a2 = (i + 1) / segs * TAU, x1 = cos(a1) * rim, z1 = sin(a1) * rim, x2 = cos(a2) * rim, z2 = sin(a2) * rim, mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
      if (roadDist(mx, mz) < 3.5 || !free(mx, mz, 0.2) || r() < 0.45) continue;
      fence(x1, z1, x2, z2);
    }
    // the well gets a stone ring texture
    S.children.forEach((o) => { if (o.isGroup && Math.abs(o.position.x - 4) < 0.01 && Math.abs(o.position.z + 2) < 0.01) o.traverse((m) => { if (m.isMesh && m.geometry.type === 'CylinderGeometry' && m.geometry.parameters.radiusTop > 1) { m.material = Mat(0xb3ada3, { map: tex('stone'), side: T.DoubleSide, roughness: 0.95 }); } }); });
    return n;
  }
  /* chimney smoke and night lights */
  let smokeMat = null;
  onTick((dt) => {
    const isN = night();
    lamps.forEach((l) => { const t = isN ? 0.95 : 0.0; l.material.opacity += (t - l.material.opacity) * Math.min(1, dt * 2); l.visible = l.material.opacity > 0.02; });
    if (MAT.glass) { const t = isN ? 0.9 : 0.0; MAT.glass.emissiveIntensity += (t - MAT.glass.emissiveIntensity) * Math.min(1, dt * 2); MAT.lampGlass.emissiveIntensity = 0.4 + MAT.glass.emissiveIntensity * 1.4; }
    if (Q() === 0 || !smokes.length) return;
    if (!smokeMat) smokeMat = new T.SpriteMaterial({ map: glowTex(), color: 0xd8d8d8, transparent: true, depthWrite: false, opacity: 0.5 });
    smokes.forEach((s) => {
      s.next -= dt;
      if (s.next <= 0 && s.parts.length < 9) { s.next = 0.55 + Math.random() * 0.4; const p = new T.Sprite(smokeMat.clone()); p.position.set(s.x, s.y, s.z); p.userData.t = 0; p.scale.setScalar(0.5); s.g.add(p); s.parts.push(p); }
      for (let i = s.parts.length - 1; i >= 0; i--) { const p = s.parts[i]; p.userData.t += dt; const t = p.userData.t; p.position.y += dt * 0.7; p.position.x += dt * 0.25; p.scale.setScalar(0.5 + t * 0.55); p.material.opacity = Math.max(0, 0.45 * (1 - t / 4.5)); if (t > 4.5) { s.g.remove(p); p.material.dispose(); s.parts.splice(i, 1); } }
    });
  });

  /* ================= 4. CHARACTERS ================= */
  const faceMat = { eye: new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 }), mouth: new T.MeshStandardMaterial({ color: 0x7a3530, roughness: 0.6 }), shine: new T.MeshBasicMaterial({ color: 0xffffff }), gold: Mat(0xd9b04c, { metalness: 0.8, roughness: 0.3 }), leather: Mat(0x4a2f1c, { roughness: 0.85 }) };
  function polish(Hm) {
    if (!Hm || Hm.afPolished || !Hm.headG) return;
    Hm.afPolished = true;
    Hm.root.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial && o.material.flatShading) { o.material.flatShading = false; o.material.needsUpdate = true; } });
    const hg = Hm.headG, head = hg.children[0], hair = hg.children[1];
    if (!head || !head.material) return;
    const skin = head.material, hairM = hair && hair.material ? hair.material : faceMat.leather;
    skin.roughness = 0.62;
    const add = (geo, m, x, y, z, sx, sy, sz, rz) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); if (sx) o.scale.set(sx, sy, sz); if (rz) o.rotation.z = rz; hg.add(o); return o; };
    [-1, 1].forEach((s) => {
      add(new T.SphereGeometry(0.1, 12, 10), faceMat.eye, s * 0.17, 0.02, 0.385, 1, 1.15, 0.55);
      add(new T.SphereGeometry(0.022, 6, 5), faceMat.shine, s * 0.17 + 0.025, 0.055, 0.49);
      add(new T.BoxGeometry(0.16, 0.035, 0.04), hairM, s * 0.17, 0.165, 0.435, 0, 0, 0, s * -0.14);
      add(new T.SphereGeometry(0.09, 10, 8), skin, s * 0.465, 0.0, -0.02, 0.45, 1, 0.8);
    });
    add(new T.SphereGeometry(0.05, 8, 6), skin, 0, -0.07, 0.47);
    const m = add(new T.TorusGeometry(0.065, 0.014, 5, 10, PI * 0.85), faceMat.mouth, 0, -0.17, 0.44); m.rotation.z = PI + PI * 0.075;
    const bangs = [];
    if (hair) {
      bangs.push(add(new T.SphereGeometry(0.3, 14, 10), hairM, 0, 0.3, 0.24, 1.42, 0.45, 0.72));
      [-1, 1].forEach((s) => bangs.push(add(new T.SphereGeometry(0.2, 10, 8), hairM, s * 0.4, 0.14, 0.02, 0.5, 0.95, 0.85)));
      bangs.push(add(new T.SphereGeometry(0.34, 12, 10), hairM, 0, 0.12, -0.24, 1.2, 1.0, 0.75));
      bangs.forEach((b) => { b.castShadow = true; });
    }
    Hm.afBangs = bangs; Hm.afHairBase = hair;
    // clothes on the torso (they share the shirt material, so recoloring the shirt recolors them too)
    const torso = Hm.armorSlot && Hm.armorSlot.parent, shirtMesh = torso && torso.children.find((o) => o.isMesh && o.geometry.type === 'CylinderGeometry' && o.geometry.parameters.height > 0.7);
    if (torso && shirtMesh) {
      const sm = shirtMesh.material;
      const col = new T.Mesh(new T.TorusGeometry(0.22, 0.07, 8, 18), sm); col.rotation.x = PI / 2; col.position.y = 0.4; torso.add(col);
      const skirt = new T.Mesh(new T.CylinderGeometry(0.47, 0.58, 0.34, 16, 1, true), sm); skirt.material.side = T.DoubleSide; skirt.position.y = -0.5; skirt.castShadow = true; torso.add(skirt);
      const hem = new T.Mesh(new T.TorusGeometry(0.58, 0.025, 5, 24), faceMat.leather); hem.rotation.x = PI / 2; hem.position.y = -0.67; torso.add(hem);
      const buckle = new T.Mesh(new T.BoxGeometry(0.16, 0.13, 0.05), faceMat.gold); buckle.position.set(0, -0.31, 0.47); torso.add(buckle);
      const strap = new T.Mesh(new T.BoxGeometry(0.07, 0.95, 0.03), faceMat.leather); strap.position.set(0.05, 0.02, 0.43); strap.rotation.z = 0.62; torso.add(strap);
    }
  }
  function polishAll() {
    if (X.PL) { X.PL.root.userData.afH = X.PL.root.userData.afH || X.PL; polish(X.PL); }
    S.children.forEach((o) => { if (o.userData && o.userData.afH) polish(o.userData.afH); });
    if (H.others) H.others.forEach((o) => { if (o && o.H) polish(o.H); });
  }
  onTick(() => {
    const keep = (Hm) => { if (Hm && Hm.afBangs && Hm.afHairBase) { const v = Hm.afHairBase.visible; Hm.afBangs.forEach((b) => { b.visible = v; }); } };
    keep(X.PL); if (H.others) H.others.forEach((o) => keep(o && o.H));
  });

  /* ================= 5. INTERFACE ================= */
  const ICONS = {
    v: '<path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M9.5 6.5L21 18v3h-3L6.5 9.5"/>',
    u: '<path d="M14 13l-8.5 8.5a2.1 2.1 0 0 1-3-3L11 10"/><path d="M16 16l6-6"/><path d="M8 8l6-6"/><path d="M9 7l8 8"/>',
    g: '<circle cx="12" cy="15" r="6"/><path d="M9 3h6l-3 6z"/>',
    y: '<path d="M12 3v6"/><path d="M12 9l-6 6"/><path d="M12 9l6 6"/><circle cx="12" cy="3" r="1.5"/><circle cx="6" cy="16" r="2"/><circle cx="18" cy="16" r="2"/><circle cx="12" cy="20" r="2"/>',
    n: '<path d="M6 3h11l2 3v15H6z"/><path d="M9 9h7M9 13h7M9 17h4"/>',
    p: '<path d="M15 4l5 5-9 9H6v-5z"/><path d="M3 21h18"/>',
    c: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    k: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14a6 6 0 0 1 3.5 6"/>',
    j: '<path d="M8 3l4 2 4-2 4 3-2 4v11H6V10L4 6z"/>',
    h: '<path d="M4 20l3-8 5-2 2-5 3 1-1 4 3 3-2 2-3-1-2 3v3"/><path d="M7 12l-3 2"/>',
    t: '<path d="M6 21V6l6-3 6 3v15"/><path d="M10 21v-5h4v5"/><path d="M4 21h16"/>',
    o: '<path d="M5 3v18"/><path d="M5 4h12l-2 4 2 4H5"/>',
    b: '<path d="M4 4l7 7M4 4v4M4 4h4"/><path d="M20 4l-7 7M20 4v4M20 4h-4"/><path d="M7 14l-3 3 3 3 3-3M17 14l3 3-3 3-3-3"/>',
    q: '<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="M9 12l2 2 4-4"/>'
  };
  safe('ui', () => {
    const css = document.createElement('style');
    css.textContent = `
    :root{--af-gold:#e9c46a;--af-glass:rgba(14,19,32,.78);--af-line:rgba(233,196,106,.28)}
    #afMenu{position:fixed;left:50%;top:max(10px,env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:41;display:flex;gap:4px;padding:5px;border-radius:14px;background:var(--af-glass);border:1px solid var(--af-line);box-shadow:0 8px 24px rgba(0,0,0,.35);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);max-width:calc(100vw - 680px);overflow-x:auto;scrollbar-width:none}
    #afMenu::-webkit-scrollbar{display:none}
    #afMenu[hidden]{display:none!important}
    #afMenu button{all:unset;box-sizing:border-box;position:relative;flex:none;width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#e9e3d4;background:transparent;transition:background .15s,color .15s}
    #afMenu button:hover{background:rgba(255,255,255,.08);color:#fff}
    #afMenu button:focus-visible{outline:2px solid var(--af-gold);outline-offset:1px}
    #afMenu button.on,#afMenu button.afOn{background:var(--af-gold);color:#241a05}
    #afMenu button[hidden]{display:none!important}
    #afMenu svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
    #afMenu .k{position:absolute;right:3px;bottom:1px;font:700 9px/1 system-ui,sans-serif;opacity:.65}
    #afMenu button::after{content:attr(data-tip);position:absolute;left:50%;top:calc(100% + 8px);transform:translateX(-50%);white-space:nowrap;padding:4px 8px;border-radius:6px;background:#0b0f17;color:#f1ebde;font:600 12px system-ui,sans-serif;opacity:0;pointer-events:none;transition:opacity .12s;border:1px solid var(--af-line)}
    #afMenu button:hover::after,#afMenu button:focus-visible::after{opacity:1}
    #afDock{display:none!important}
    #hud .box{background:var(--af-glass)!important;border:1px solid var(--af-line)!important;box-shadow:0 8px 24px rgba(0,0,0,.3)!important;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
    #hud .portrait{box-shadow:0 0 0 3px rgba(0,0,0,.35),0 0 18px rgba(233,196,106,.35)}
    #hud .meter{border-radius:999px!important;box-shadow:inset 0 1px 2px rgba(0,0,0,.6)}
    #hud .meter i{border-radius:999px;background-image:linear-gradient(180deg,rgba(255,255,255,.28),rgba(255,255,255,0) 60%)!important}
    #hud .meter.hp i{background-color:#d9483b!important}
    #hud .meter.mp i{background-color:#3f8fe0!important}
    #hud .sk{background:linear-gradient(180deg,#1b2336,#111827)!important;border-color:rgba(233,196,106,.25)!important}
    #hud .sk.main{border-color:var(--af-gold)!important;box-shadow:0 0 14px rgba(233,196,106,.35)}
    #hud .mm{border:2px solid rgba(233,196,106,.55)!important;box-shadow:0 0 0 4px rgba(0,0,0,.35),0 8px 24px rgba(0,0,0,.4)}
    #hud .quest .k{color:var(--af-gold)!important}
    #hud .expbar i{background:linear-gradient(90deg,#c9932f,#ffd77a)!important}
    .afp,#afUR,#afGR,#afVR,#afQD,#afQJ,#afChar,#afZ,#afMap,#afTR{background:rgba(13,18,30,.95)!important;border:1px solid var(--af-line)!important;border-radius:14px!important;box-shadow:0 24px 60px rgba(0,0,0,.55)!important}
    .afp button,#afUR button,#afGR button,#afVR button,#afChar button{border-width:1px!important;box-shadow:none!important}
    .afp button.g,#afUR button.g,#afGR button.g,#afVR button.g{background:rgba(255,255,255,.08)!important;color:#e9e3d4!important;border-color:rgba(255,255,255,.14)!important}
    .afp button.on{background:var(--af-gold)!important;color:#241a05!important;border-color:var(--af-gold)!important}
    .lbl .nm{font-weight:700!important;letter-spacing:.01em}
    .lbl .bar{border-radius:999px!important}
    @media (max-width:1100px){#afMenu{top:auto;bottom:calc(env(safe-area-inset-bottom,0px) + 116px);max-width:calc(100vw - 32px)}}
    @media (max-width:760px){#afMenu{bottom:calc(env(safe-area-inset-bottom,0px) + 200px)}#afMenu button{width:36px;height:36px}}`;
    document.head.appendChild(css);
    const bar = document.createElement('nav'); bar.id = 'afMenu'; bar.setAttribute('aria-label', 'Menu'); bar.hidden = true; document.body.appendChild(bar);
    ['keydown', 'keyup', 'pointerdown', 'mousedown', 'wheel'].forEach((ev) => bar.addEventListener(ev, (e) => e.stopPropagation()));
    const IDS = ['afCharBtn', 'afTB', 'afQB', 'afZBtn', 'afGB', 'afUB', 'afVB', 'afBtn'];
    const order = ['c', 'j', 'y', 'n', 'p', 'g', 'h', 'u', 'v', 't', 'o', 'b', 'k', 'q'];
    function dress(btn) {
      if (btn.dataset.afMenu) return;
      const txt = btn.textContent.trim(), m = txt.match(/^(.*?)\s*\(([A-Z0-9])\)\s*$/i), label = m ? m[1] : txt, key = m ? m[2].toLowerCase() : '';
      btn.dataset.afMenu = '1'; btn.dataset.k = key; btn.dataset.tip = label + (key ? ' · ' + key.toUpperCase() : ''); btn.setAttribute('aria-label', label);
      btn.removeAttribute('style');
      btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[key] || '<circle cx="12" cy="12" r="7"/>') + '</svg>' + (key ? '<span class="k">' + key.toUpperCase() + '</span>' : '');
      const obs = new MutationObserver(() => { if (btn.textContent.trim() !== key.toUpperCase() && btn.textContent.trim().length > 1) { delete btn.dataset.afMenu; dress(btn); } });
      obs.observe(btn, { childList: true, characterData: true, subtree: true });
    }
    function gather() {
      const list = [];
      IDS.forEach((id) => { const b = document.getElementById(id); if (b) list.push(b); });
      const dock = document.getElementById('afDock'); if (dock) dock.querySelectorAll('button').forEach((b) => list.push(b));
      list.forEach((b) => { dress(b); if (b.parentNode !== bar) bar.appendChild(b); });
      const kids = Array.from(bar.children); kids.sort((a, b) => order.indexOf(a.dataset.k) - order.indexOf(b.dataset.k));
      kids.forEach((k) => bar.appendChild(k));
      // panel state for buttons that do not mark themselves
      const open = { afCharBtn: 'afChar', afUB: 'afUR', afGB: 'afGR', afVB: 'afVR', afQB: 'afQJ', afZBtn: 'afZ', afTB: 'afTR' };
      Object.keys(open).forEach((id) => { const b = document.getElementById(id), p = document.getElementById(open[id]); if (b && p) b.classList.toggle('afOn', !p.hidden); });
      bar.hidden = !H.isRunning() || !!(window.AF_CLASS && window.AF_CLASS.creating);
    }
    setInterval(gather, 500); gather();
  });

  /* ================= frame hook + delayed parts ================= */
  let built = false, lastT = performance.now();
  const sc = S, prev = sc.onBeforeRender;
  sc.onBeforeRender = function () {
    if (prev) prev.apply(this, arguments);
    const now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    for (let i = 0; i < ticks.length; i++) { try { ticks[i](dt); } catch (e) { console.error('[beauty tick]', e); ticks.splice(i, 1); i--; } }
    // the hooks above (mount lift, jump, new poses) run after three.js has already computed this frame's matrices: refresh the characters
    try { if (X.PL && X.PL.root) X.PL.root.updateMatrixWorld(true); if (H.others) H.others.forEach((o) => { if (o && o.H && o.H.root) o.H.root.updateMatrixWorld(true); }); } catch (e) { /* ignore */ }
  };
  setInterval(() => {
    safe('characters', polishAll);
    if (!built && H.isRunning()) { built = true; safe('village', () => { B.houses = buildVillage(); }); }
  }, 700);
  safe('villageEarly', () => { mats(); replaceHouses(); });
  console.log('[beauty] da nap', JSON.stringify(B.parts));
})();
