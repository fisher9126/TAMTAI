/* Aetherfall visuals, step 4: "Vương quốc Tro Tàn", a dark fantasy look with real 3D models.
     1. Atmosphere: cold overcast sky, thick grey fog, falling ash, drifting embers, ground mist, vignette, filmic grading.
     2. Ground: a muted, dead-grass terrain grade, dark wind-blown grass, a black pond with mist.
     3. Village: real buildings, trees, rocks and props (KayKit, CC0) replace the shapes; standing torches with real fire light.
     4. Characters: every player and NPC becomes a rigged, animated KayKit hero picked by class
        (Knight / Mage / Rogue / Hooded Rogue / Barbarian), with idle, walk, run, combo attacks, spells, dodge, death and riding.
        Helmet and cape appear when those slots are worn; the weapon glows with its rarity.
     5. Interface: iron-and-ember HUD, one icon menu bar, Cinzel titles.
   Models: /models/*.glb (made from KayKit packs by Kay Lousberg, CC0, www.kaylousberg.com).
   Needs window.AF_GFX (index.html), THREE.GLTFLoader and THREE.SkeletonUtils (js/vendor). Every part is wrapped:
   if one fails, the rest keeps running and the game still works with the old look for that part.
   Quality follows AF_VISUAL.quality(): 0 = low (no grass, ash or fire lights), 1 = medium, 2 = high. */
(function () {
  'use strict';
  const T = window.THREE, G = window.AF_GFX, H = window.AF_CH, X = window.AF_CHX, RU = window.AF_RULES;
  if (!T || !G || !H || !X || !RU) { console.warn('[dark] thieu AF_GFX/AF_CH/AF_CHX, bo qua'); return; }
  const S = G.scene, W = RU.WORLD, PI = Math.PI, TAU = PI * 2, sin = Math.sin, cos = Math.cos;
  const D = window.AF_DARK = { parts: {}, models: {}, clips: {} };
  const Q = () => (window.AF_VISUAL && window.AF_VISUAL.quality ? window.AF_VISUAL.quality() : 2);
  const night = () => !!(window.AF_EXPLORE && window.AF_EXPLORE.isNight && window.AF_EXPLORE.isNight());
  function safe(name, fn) { try { fn(); D.parts[name] = 'ok'; } catch (e) { D.parts[name] = 'loi: ' + e.message; console.error('[dark ' + name + ']', e); } }
  const ticks = [], onTick = (f) => ticks.push(f);
  function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  const Mat = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.9, metalness: 0 }, o || {}));
  function canvasTex(w, h, draw, rx, ry) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); return t; }
  let glowT = null;
  function glowTex() { if (!glowT) glowT = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }); return glowT; }
  function glow(color, size, op) { const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: op == null ? 0.8 : op })); s.scale.setScalar(size); return s; }
  const roads = [W.FOREST, W.ARENA, W.POND];
  function segDist(px, pz, ax, az, bx, bz) { const vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz))); return Math.hypot(px - (ax + vx * t), pz - (az + vz * t)); }
  const roadDist = (x, z) => Math.min.apply(null, roads.map((p) => segDist(x, z, 0, 0, p.x, p.z)));
  function lum(c) { return c.r * 0.3 + c.g * 0.59 + c.b * 0.11; }

  /* ================= 1. ATMOSPHERE ================= */
  const PAL = { top: new T.Color(0x3a5272), hor: new T.Color(0x8c949a), fog: new T.Color(0x666e74), night: new T.Color(0x16203a), sun: new T.Color(0xffc690) };
  let skyMat = null, baseLum = 1, envDim = 1;
  safe('atmosphere', () => {
    const r = G.renderer;
    r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    G.sun.color.setHex(0xfff0dc); G.sun.intensity = 1.45;
    S.traverse((o) => { if (o.isHemisphereLight) { o.color.setHex(0xb8c6dc); o.groundColor.setHex(0x5a4a38); o.intensity = 0.62; } });
    if (S.fog) { S.fog.color.copy(PAL.fog); S.fog.near = 30; S.fog.far = 140; }
    if (S.background && S.background.isColor) S.background.copy(PAL.fog);
    baseLum = lum(PAL.fog);
    skyMat = new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: PAL.top.clone() }, hor: { value: PAL.hor.clone() }, nightC: { value: PAL.night.clone() }, sunC: { value: PAL.sun.clone() }, sunDir: { value: new T.Vector3(0.5, 0.4, 0.3) }, dim: { value: 1 }, time: { value: 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
      fragmentShader: [
        'uniform vec3 top; uniform vec3 hor; uniform vec3 nightC; uniform vec3 sunC; uniform vec3 sunDir; uniform float dim; uniform float time; varying vec3 vP;',
        'float h2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }',
        'float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y); }',
        'float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*n2(p); p*=2.03; a*=0.5; } return v; }',
        'void main(){ vec3 d=normalize(vP-cameraPosition); float h=d.y; float t=pow(clamp(h,0.0,1.0),0.6);',
        ' vec3 c=mix(hor,top,t);',
        ' vec2 uv=d.xz/max(h+0.12,0.05)*0.55+vec2(time*0.006,time*0.002); float cl=fbm(uv*1.4);',
        ' float cover=smoothstep(0.38,0.82,cl)*smoothstep(-0.02,0.25,h); c=mix(c, mix(hor*0.82,top*1.25,0.4), cover*0.85);',
        ' float s=max(dot(d,normalize(sunDir)),0.0); vec3 glowc=sunC*(pow(s,14.0)*0.35+pow(s,3.0)*0.08)*(1.0-cover*0.6); c+=glowc*dim;',
        ' c=mix(c,hor,clamp(1.0-h*6.0,0.0,1.0)*0.55);',
        ' vec3 n=mix(nightC*1.8,nightC*0.6,t); float st=step(0.9985,h2(floor(d.xz/max(h,0.05)*90.0)))*smoothstep(0.1,0.4,h)*(1.0-cover);',
        ' n+=vec3(st)*0.8; c=mix(n,c,clamp(dim,0.0,1.0));',
        ' gl_FragColor=vec4(c,1.0); }'].join('\n')
    });
    G.sky.material = skyMat;
    // hide the old low-poly clouds: the sky shader draws a cloud deck now
    S.children.forEach((g) => { if (g.isGroup && g.position.y > 45 && g.children.length === 4) g.visible = false; });
    if (T.PMREMGenerator) {
      const es = new T.Scene(), geo = new T.SphereGeometry(10, 32, 16), cols = [], p = geo.attributes.position, c = new T.Color();
      for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 10; if (y > 0) c.copy(PAL.hor).lerp(PAL.top, Math.pow(y, 0.6)); else c.setHex(0x1e1a14).lerp(new T.Color(0x3a3a34), 1 + y); cols.push(c.r, c.g, c.b); }
      geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
      es.add(new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
      const pm = new T.PMREMGenerator(r); S.environment = pm.fromScene(es, 0.04).texture; pm.dispose();
    }
  });
  onTick((dt) => {
    if (!skyMat) return;
    const bg = S.background && S.background.isColor ? S.background : PAL.fog;
    const dim = Math.max(0, Math.min(1.1, lum(bg) / baseLum));
    skyMat.uniforms.dim.value = dim; skyMat.uniforms.hor.value.copy(bg).lerp(PAL.hor, 0.35 * dim); skyMat.uniforms.time.value += dt;
    skyMat.uniforms.sunDir.value.subVectors(G.sun.position, G.sun.target.position).normalize();
    G.renderer.toneMappingExposure = 1.3 - 0.3 * Math.min(1, dim); /* night is pushed up so the world stays readable */
    envDim = 0.4 + 0.6 * Math.min(1, dim);
  });
  let envList = [], envT = 0;
  onTick((dt) => {
    envT -= dt; if (envT > 0 || !S.environment) return; envT = 1;
    if (!envList.length || Math.random() < 0.2) { envList = []; const seen = new Set(); S.traverse((o) => { const m = o.material; if (m && m.isMeshStandardMaterial && !seen.has(m)) { seen.add(m); envList.push(m); } }); }
    envList.forEach((m) => { m.envMapIntensity = envDim * (m.metalness > 0.4 ? 0.9 : 0.35); });
  });
  /* a soft lantern light that follows the player, stronger at night, so the area around you is always readable */
  safe('lantern', () => {
    const L = new T.PointLight(0xffd8a8, 0, 22, 1.6); L.castShadow = false; S.add(L);
    const fill = new T.DirectionalLight(0xaebfe0, 0); S.add(fill); S.add(fill.target);
    L.userData.afSky = true; fill.userData.afSky = true; /* explore.js leaves these two alone */
    onTick((dt) => {
      if (!H.isRunning()) return;
      const R = H.R, y = H.heightAt(R.x, R.z), n = night() ? 1 : 0;
      L.position.set(R.x, y + 4.2, R.z); L.intensity += ((n ? 2.6 : 0.6) - L.intensity) * Math.min(1, dt * 2);
      fill.position.set(R.x - 20, y + 30, R.z + 25); fill.target.position.set(R.x, y, R.z); fill.intensity += ((n ? 0.7 : 0.25) - fill.intensity) * Math.min(1, dt * 2);
    });
  });
  /* ash falling and embers rising around the camera */
  safe('ash', () => {
    if (Q() === 0) return;
    const N = Q() === 2 ? 1400 : 600, A = new Float32Array(N * 3), V = new Float32Array(N);
    for (let i = 0; i < N; i++) { A[i * 3] = (Math.random() - 0.5) * 60; A[i * 3 + 1] = Math.random() * 26; A[i * 3 + 2] = (Math.random() - 0.5) * 60; V[i] = 0.4 + Math.random() * 0.8; }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(A, 3));
    const ash = new T.Points(g, new T.PointsMaterial({ color: 0xb9b4ad, size: 0.09, transparent: true, opacity: 0.75, depthWrite: false })); ash.frustumCulled = false; S.add(ash);
    const M = Q() === 2 ? 160 : 70, E = new Float32Array(M * 3), EV = new Float32Array(M);
    for (let i = 0; i < M; i++) { E[i * 3] = (Math.random() - 0.5) * 40; E[i * 3 + 1] = Math.random() * 10; E[i * 3 + 2] = (Math.random() - 0.5) * 40; EV[i] = 0.6 + Math.random(); }
    const eg = new T.BufferGeometry(); eg.setAttribute('position', new T.BufferAttribute(E, 3));
    const emb = new T.Points(eg, new T.PointsMaterial({ color: 0xff8a3a, size: 0.16, transparent: true, opacity: 0.9, depthWrite: false, blending: T.AdditiveBlending, map: glowTex() })); emb.frustumCulled = false; S.add(emb);
    let tt = 0;
    onTick((dt) => {
      if (!H.isRunning()) return; tt += dt;
      const px = H.R.x, pz = H.R.z, gy = H.heightAt(px, pz);
      ash.position.set(px, gy, pz); emb.position.set(px, gy, pz);
      const a = g.attributes.position;
      for (let i = 0; i < N; i++) { let y = A[i * 3 + 1] - V[i] * dt * 1.4; A[i * 3] += sin(tt * 0.7 + i) * dt * 0.35 + dt * 0.4; if (y < 0) { y = 26; A[i * 3] = (Math.random() - 0.5) * 60; A[i * 3 + 2] = (Math.random() - 0.5) * 60; } A[i * 3 + 1] = y; }
      a.needsUpdate = true;
      const e = eg.attributes.position;
      for (let i = 0; i < M; i++) { let y = E[i * 3 + 1] + EV[i] * dt * 0.8; E[i * 3] += sin(tt * 2 + i * 3) * dt * 0.4; if (y > 12) { y = 0; E[i * 3] = (Math.random() - 0.5) * 40; E[i * 3 + 2] = (Math.random() - 0.5) * 40; } E[i * 3 + 1] = y; }
      e.needsUpdate = true; emb.material.opacity = 0.55 + 0.35 * (night() ? 1 : 0.4);
    });
  });
  /* ================= 2. GROUND ================= */
  let terrain = null;
  safe('terrain', () => {
    S.children.forEach((o) => { if (o.isMesh && o.geometry && o.geometry.type === 'PlaneGeometry' && o.geometry.parameters.width >= 200 && o.material.vertexColors) terrain = o; });
    if (!terrain) return;
    const col = terrain.geometry.attributes.color, pos = terrain.geometry.attributes.position, c = new T.Color(), hsl = {};
    for (let i = 0; i < col.count; i++) {
      c.setRGB(col.getX(i), col.getY(i), col.getZ(i)); c.getHSL(hsl);
      const x = pos.getX(i), z = pos.getZ(i), n = sin(x * 0.09 + cos(z * 0.07) * 2) * 0.5 + sin(z * 0.11 - x * 0.05) * 0.5;
      const green = hsl.h > 0.15 && hsl.h < 0.45 && hsl.s > 0.2;
      if (green) { hsl.h = 0.2 + (hsl.h - 0.2) * 0.6 + n * 0.012; hsl.s *= 0.55; hsl.l = hsl.l * 0.66 + n * 0.03; }
      else { hsl.s *= 0.75; hsl.l = hsl.l * 0.74 + n * 0.02; }
      c.setHSL(hsl.h, Math.max(0, Math.min(1, hsl.s)), Math.max(0.02, Math.min(1, hsl.l)));
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true; terrain.material.flatShading = false; terrain.material.roughness = 1; terrain.material.needsUpdate = true;
  });
  function groundColorAt(x, z) {
    if (!terrain) return null;
    const step = 260 / 150, cc = Math.round((x + 130) / step), row = Math.round((z + 130) / step);
    if (cc < 0 || row < 0 || cc > 150 || row > 150) return null;
    const a = terrain.geometry.attributes.color, i = row * 151 + cc; return new T.Color(a.getX(i), a.getY(i), a.getZ(i));
  }
  const windU = { value: 0 };
  onTick((dt) => { windU.value += dt; });
  safe('grass', () => {
    // the old cone grass and bright flowers go away
    S.children.forEach((o) => { if (o.isInstancedMesh && ((o.geometry.type === 'ConeGeometry' && o.geometry.parameters.radius < 0.2) || (o.geometry.type === 'IcosahedronGeometry' && o.geometry.parameters.radius < 0.2))) o.visible = false; });
    if (Q() === 0 || !terrain) return;
    const N = Q() === 2 ? 14000 : 6000, geo = new T.BufferGeometry(), P = [], Cc = [];
    for (let k = 0; k < 4; k++) { const a = k * PI / 4, ca = cos(a), sa = sin(a), w = 0.07; [[-w, 0], [w, 0], [(k % 2 ? 0.05 : -0.05), 0.55 + k * 0.06]].forEach(([u, y], j) => { P.push(u * ca, y, u * sa); const s = j === 2 ? 1.35 : 0.6; Cc.push(s, s, s); }); }
    geo.setAttribute('position', new T.Float32BufferAttribute(P, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(Cc, 3)); geo.computeVertexNormals();
    const mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: T.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uWind = windU;
      sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat wph = instanceMatrix[3].x * 0.21 + instanceMatrix[3].z * 0.17;\nfloat sway = sin(uWind * 1.6 + wph) * 0.6 + sin(uWind * 3.3 + wph * 1.7) * 0.25;\ntransformed.x += sway * 0.16 * position.y; transformed.z += cos(uWind * 1.1 + wph) * 0.08 * position.y;');
    };
    const im = new T.InstancedMesh(geo, mat, N); im.receiveShadow = true;
    const r = rng(4242), d = new T.Object3D(), c = new T.Color(); let n = 0, tries = 0;
    while (n < N && tries < N * 6) {
      tries++; const a = r() * TAU, rad = Math.sqrt(r()) * 100, x = cos(a) * rad, z = sin(a) * rad;
      if (Math.hypot(x, z) < 8.6 || roadDist(x, z) < 1.8 || Math.hypot(x - W.POND.x, z - W.POND.z) < 12.6) continue;
      const g = groundColorAt(x, z); if (!g) continue; const hsl = {}; g.getHSL(hsl); if (!(hsl.h > 0.12 && hsl.h < 0.4 && hsl.s > 0.08)) continue;
      d.position.set(x, H.heightAt(x, z) - 0.02, z); d.rotation.set(0, r() * TAU, 0); const s = 0.7 + r() * 0.7; d.scale.set(s, s * (0.8 + r() * 0.7), s); d.updateMatrix();
      im.setMatrixAt(n, d.matrix); c.copy(g).offsetHSL(r() * 0.03 - 0.01, 0.05, 0.03 + r() * 0.05); if (r() < 0.25) c.lerp(new T.Color(0x6a5a3a), 0.5); im.setColorAt(n, c); n++;
    }
    im.count = n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.frustumCulled = false; S.add(im); D.grass = im;
  });
  safe('pond', () => {
    let water = null;
    S.children.forEach((o) => { if (o.isMesh && o.geometry && o.geometry.type === 'CircleGeometry' && Math.abs(o.position.x - W.POND.x) < 0.5 && Math.abs(o.position.z - W.POND.z) < 0.5) water = o; });
    if (!water) return;
    water.material = new T.MeshStandardMaterial({ color: 0x0f1c22, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.92 });
    const fog = glow(0xb0b8bc, 26, 0.18); fog.material.blending = T.NormalBlending; fog.position.set(W.POND.x, water.position.y + 1.2, W.POND.z); S.add(fog);
  });

  /* ================= 3. MODELS ================= */
  const loader = T.GLTFLoader ? new T.GLTFLoader() : null;
  function loadGLB(url) { return new Promise((res, rej) => loader.load(url, res, undefined, rej)); }
  function byName(root, name) { let f = null; root.traverse((o) => { if (!f && o.name === name) f = o; }); return f; }
  function prep(o, shadows) { o.traverse((m) => { if (m.isMesh) { m.castShadow = shadows !== false; m.receiveShadow = true; } }); return o; }
  function fitTo(o, size, axis) { const b = new T.Box3().setFromObject(o), s = new T.Vector3(); b.getSize(s); const k = size / Math.max(1e-3, axis === 'y' ? s.y : axis === 'all' ? Math.max(s.x, s.y, s.z) : Math.max(s.x, s.z)); o.scale.multiplyScalar(k); return k; }
  function ground(o, x, z, ry) { o.position.set(x, H.heightAt(x, z), z); if (ry != null) o.rotation.y = ry; const b = new T.Box3().setFromObject(o); o.position.y -= (b.min.y - H.heightAt(x, z)); return o; }
  function block(x, z, r) { if (G.obstacles) G.obstacles.push({ x, z, r }); }
  /* the KayKit atlas is bright and candy-colored: every model gets its own copy of the material, tinted toward
     soot-brown (a multiply that cuts green and blue more than red reads as weathered, not just darker) */
  const tintCache = new Map();
  function darken(root, k) {
    root.traverse((m) => {
      if (!m.isMesh) return;
      const key = m.material.uuid + ':' + k;
      if (!tintCache.has(key)) { const c = m.material.clone(); c.color.setRGB(Math.min(1, 0.98 * k + 0.12), Math.min(1, 0.92 * k + 0.1), Math.min(1, 0.86 * k + 0.08)); c.roughness = 0.9; tintCache.set(key, c); }
      m.material = tintCache.get(key);
    });
  }
  function part(lib, name) { const n = byName(lib, name); return n ? n.clone(true) : null; }

  /* ---------- village built from models ---------- */
  const torches = [];
  function fire(parent, x, y, z, big, withLight) {
    const g = new T.Group(); g.position.set(x, y, z); parent.add(g);
    const core = glow(0xffb04a, big ? 1.4 : 0.8, 0.95), halo = glow(0xff5a1a, big ? 3.6 : 2.2, 0.5); g.add(core); g.add(halo);
    let light = null;
    if (withLight && Q() > 0) { light = new T.PointLight(0xff8a3a, 2.2, big ? 16 : 11, 2); light.position.y = 0.3; g.add(light); }
    torches.push({ core, halo, light, seed: Math.random() * 100, big });
    return g;
  }
  onTick((dt) => {
    const t = performance.now() / 1000, n = night();
    torches.forEach((f) => {
      const fl = 0.82 + sin(t * 13 + f.seed) * 0.08 + sin(t * 7.3 + f.seed * 2) * 0.07 + Math.random() * 0.05;
      f.core.material.opacity = 0.95 * fl; f.halo.material.opacity = (n ? 0.6 : 0.35) * fl;
      if (f.light) f.light.intensity = (n ? 3.2 : 1.4) * fl;
    });
  });
  const BUILD = [['building_home_A_red', 5.0, 0], ['building_blacksmith_red', 5.4, 0], ['building_tavern_red', 5.6, 0], ['building_home_B_red', 5.0, 0], ['building_church_red', 6.6, 0]];
  function buildVillage(V, P) {
    const r = rng(777);
    // replace the five houses
    const houses = []; S.children.forEach((o) => { if (o.userData && o.userData.afHouse) houses.push(o); });
    houses.forEach((o) => {
      const u = o.userData.afHouse, spec = BUILD[u.i % BUILD.length], src = part(V, spec[0]); if (!src) return;
      const g = new T.Group(); g.add(src); prep(src); fitTo(src, spec[1]); darken(src, 0.78, 0.7);
      const face = Math.atan2(-o.position.x, -o.position.z) + spec[2];
      ground(g, o.position.x, o.position.z, face); g.userData.afOcc = true; S.add(g);
      o.visible = false; o.traverse((m) => { if (m.isMesh) m.castShadow = false; });
      // a mounted torch beside every door
      const fx = o.position.x + sin(face) * (spec[1] * 0.42), fz = o.position.z + cos(face) * (spec[1] * 0.42);
      const tr = part(P, 'torch_mounted'); if (tr) { prep(tr, false); fitTo(tr, 0.9, 'y'); const tg = new T.Group(); tg.add(tr); ground(tg, fx + cos(face) * 1.1, fz - sin(face) * 1.1, face); tg.position.y += 1.6; S.add(tg); fire(tg, 0, 0.55, 0.05, false, false); }
    });
    // the well
    S.children.forEach((o) => { if (o.isGroup && Math.abs(o.position.x - 4) < 0.01 && Math.abs(o.position.z + 2) < 0.01) { const w = part(V, 'building_well_red'); if (w) { o.visible = false; const g = new T.Group(); g.add(w); prep(w); fitTo(w, 3.0); darken(w, 0.78, 0.7); ground(g, 4, -2, 0.4); g.userData.afOcc = true; S.add(g); } } });
    // dark cobbles on the square
    const cob = canvasTex(512, 512, (g, w, h) => { const rr = rng(5); g.fillStyle = '#2a2826'; g.fillRect(0, 0, w, h); for (let i = 0; i < 520; i++) { const x = rr() * w, y = rr() * h, s = 10 + rr() * 14, v = 70 + Math.floor(rr() * 50); g.fillStyle = 'rgb(' + v + ',' + (v - 2) + ',' + (v - 6) + ')'; g.beginPath(); g.ellipse(x, y, s, s * (0.7 + rr() * 0.3), rr() * 3, 0, TAU); g.fill(); } }, 3, 3);
    const sq = new T.Mesh(new T.CircleGeometry(7.6, 48), Mat(0x8a8580, { map: cob })); sq.rotation.x = -PI / 2; sq.receiveShadow = true; sq.position.set(0, H.heightAt(0, 0) + 0.025, 0); S.add(sq);
    // standing torches around the square (the first four carry real light)
    let lit = 0;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU + 0.35, x = cos(a) * 8.4, z = sin(a) * 8.4; if (!free(x, z, 0.4)) continue;
      const t = part(P, 'torch_lit'); if (!t) break;
      const g = new T.Group(); prep(t, true); fitTo(t, 2.2, 'y'); g.add(t); ground(g, x, z, -a); S.add(g); block(x, z, 0.25);
      const b = new T.Box3().setFromObject(g); fire(S, x, b.max.y + 0.1, z, true, lit++ < 4);
    }
    // landmarks outside the square
    const marks = [['building_tower_A_red', 6.5, -17, -15], ['building_windmill_red', 8, -24, 6], ['building_market_red', 4.5, 13, -12], ['building_barracks_red', 6.5, 17, 14], ['tent', 3, -15, 15], ['tent', 3, 20, -2]];
    marks.forEach(([n, size, x, z]) => { if (!free(x, z, size * 0.45)) return; const m = part(V, n); if (!m) return; const g = new T.Group(); prep(m); fitTo(m, size); darken(m, 0.75, 0.7); g.add(m); ground(g, x, z, Math.atan2(-x, -z)); g.userData.afOcc = true; S.add(g); block(x, z, size * 0.42); });
    // props: barrels, crates, sacks, lumber, weapon racks, kegs, chests, banners
    const props = [['barrel', V, 1.0], ['crate_A_big', V, 1.0], ['sack', V, 0.8], ['resource_lumber', V, 1.6], ['weaponrack', V, 1.6], ['wheelbarrow', V, 1.5], ['keg', P, 1.0], ['crates_stacked', P, 1.6], ['chest', P, 1.0], ['barrel_large', P, 1.2], ['box_stacked', P, 1.3]];
    const spots = [];
    for (let i = 0; i < 220 && spots.length < 22; i++) { const a = r() * TAU, rd = 9.8 + r() * 8, x = cos(a) * rd, z = sin(a) * rd; if (free(x, z, 1.0) && spots.every((s) => Math.hypot(s[0] - x, s[1] - z) > 3.0)) spots.push([x, z, a]); }
    spots.forEach(([x, z, a], i) => { const [n, lib, size] = props[i % props.length]; const m = part(lib, n); if (!m) return; const g = new T.Group(); prep(m); fitTo(m, size, 'all'); darken(m, 0.8); g.add(m); ground(g, x, z, r() * TAU); S.add(g); block(x, z, size * 0.4); });
    // red banners on poles at the road gates
    roads.forEach((p, i) => { const L = Math.hypot(p.x, p.z), dx = p.x / L, dz = p.z / L; [-1, 1].forEach((s) => { const x = dx * 17 - dz * 3.2 * s, z = dz * 17 + dx * 3.2 * s; const b = part(P, 'banner_thin_red'); if (!b) return; const g = new T.Group(); prep(b); fitTo(b, 2.8, 'y'); darken(b, 0.7, 0.8); g.add(b); ground(g, x, z, Math.atan2(dx, dz)); S.add(g); block(x, z, 0.3); const tc = part(P, 'torch_lit'); if (tc && i === 0) { /* keep it light */ } }); });
    // ruins on the hill side: broken pillars and rubble
    [[-30, -8], [-34, -4], [26, 30], [30, 26], [-6, -30], [6, -34]].forEach(([x, z], i) => { if (!free(x, z, 1)) return; const n = ['pillar', 'column', 'rubble_large', 'barrier_column', 'sword_shield_broken', 'trunk_large_A'][i % 6]; const m = part(P, n); if (!m) return; const g = new T.Group(); prep(m); fitTo(m, i % 3 === 2 ? 2.4 : 3.4, i % 3 === 2 ? null : 'y'); darken(m, 0.7, 0.6); g.add(m); ground(g, x, z, r() * TAU); g.rotation.z = (r() - 0.5) * 0.25; S.add(g); block(x, z, 0.8); });
    // fences of wood on the village rim
    for (let i = 0; i < 26; i++) { const a = i / 26 * TAU, x = cos(a) * 19, z = sin(a) * 19; if (roadDist(x, z) < 3.5 || !free(x, z, 0.3) || r() < 0.35) continue; const f = part(V, 'fence_wood_straight'); if (!f) continue; const g = new T.Group(); prep(f); fitTo(f, 4.2); { const b = new T.Box3().setFromObject(f), sz = new T.Vector3(); b.getSize(sz); if (sz.y > 1.3) f.scale.y *= 1.3 / sz.y; } darken(f, 0.75, 0.7); g.add(f); ground(g, x, z, -a); S.add(g); }
  }
  function free(x, z, rad) {
    if (roadDist(x, z) < 2.2 + rad) return false;
    for (const o of S.children) if (o.userData && o.userData.afHouse && Math.hypot(o.position.x - x, o.position.z - z) < 4.2 + rad) return false;
    const pts = [[4, -2, 2], [1.5, 5, 1.6], [0, 0, 3], [1, 9, 3.2]];
    const st = window.AF_STORY && window.AF_STORY.NPCS; if (st) Object.keys(st).forEach((k) => pts.push([st[k].x, st[k].z, 1.8]));
    const E = window.AF_EXPLORE; if (E && E.wps) E.wps.forEach((p) => { if (p && p.x != null) pts.push([p.x, p.z, 2.8]); });
    if (Math.hypot(x - W.POND.x, z - W.POND.z) < 13 + rad) return false;
    for (const p of pts) if (Math.hypot(p[0] - x, p[1] - z) < p[2] + rad) return false;
    return true;
  }
  /* ---------- trees and rocks from models, instanced on the old positions ---------- */
  function instFrom(src, mats) {
    const parts = []; src.updateMatrixWorld(true);
    src.traverse((m) => { if (m.isMesh) parts.push({ geo: m.geometry, mat: m.material, mw: m.matrixWorld.clone() }); });
    return parts;
  }
  function replaceTrees(V) {
    const old = []; S.children.forEach((o) => { if (o.isInstancedMesh && o.visible) { const t = o.geometry.type, p = o.geometry.parameters || {}; if ((t === 'CylinderGeometry' && p.height > 2 && p.radiusTop < 0.3) || (t === 'IcosahedronGeometry' && p.radius > 1) || (t === 'ConeGeometry' && p.radius >= 1)) old.push(o); } });
    const trunk = old.find((o) => o.geometry.type === 'CylinderGeometry'); if (!trunk) return 0;
    const kinds = ['tree_single_A', 'tree_single_B', 'trees_A_medium', 'trees_B_medium', 'tree_single_A', 'trees_B_large'].map((n) => { const m = part(V, n); if (!m) return null; const g = new T.Group(); g.add(m); fitTo(m, n.indexOf('trees_') === 0 ? 6.2 : 5.0, 'y'); return instFrom(g); }).filter(Boolean);
    if (!kinds.length) return 0;
    const darkMat = new Map();
    const dm = (mt) => { if (!darkMat.has(mt)) { const c = mt.clone(); c.color.setRGB(0.5, 0.48, 0.4); c.roughness = 0.95; darkMat.set(mt, c); } return darkMat.get(mt); };
    const buckets = kinds.map(() => []), M4 = new T.Matrix4(), pos = new T.Vector3(), q = new T.Quaternion(), sc = new T.Vector3(), r = rng(31);
    for (let i = 0; i < trunk.count; i++) { trunk.getMatrixAt(i, M4); M4.decompose(pos, q, sc); const k = Math.floor(r() * kinds.length); buckets[k].push({ x: pos.x, z: pos.z, s: sc.x, ry: r() * TAU }); }
    const d = new T.Object3D();
    kinds.forEach((parts, k) => {
      const list = buckets[k]; if (!list.length) return;
      parts.forEach((pt) => {
        const im = new T.InstancedMesh(pt.geo, dm(pt.mat), list.length); im.castShadow = true; im.receiveShadow = true; im.userData.afCut = true;
        list.forEach((t, i) => { d.position.set(t.x, H.heightAt(t.x, t.z) - 0.1, t.z); d.rotation.set(0, t.ry, 0); d.scale.setScalar(0.6 + t.s * 0.3); d.updateMatrix(); M4.multiplyMatrices(d.matrix, pt.mw); im.setMatrixAt(i, M4); });
        im.instanceMatrix.needsUpdate = true; S.add(im);
      });
    });
    old.forEach((o) => { o.visible = false; });
    return trunk.count;
  }
  function darkenRocks() { S.children.forEach((o) => { if (o.isInstancedMesh && o.geometry.type === 'DodecahedronGeometry') { o.material.color.setHex(0x55534f); o.material.roughness = 1; } }); }

  /* ================= 4. CHARACTERS ================= */
  const KIND = { warrior: 'knight', mage: 'mage', healer: 'mage', archer: 'rogue_hooded', assassin: 'rogue' };
  const SHOW = {
    warrior: ['1H_Sword'], mage: ['2H_Staff'], healer: ['1H_Wand', 'Spellbook_open'], archer: ['2H_Crossbow'], assassin: ['Knife', 'Knife_Offhand'],
    elder: ['2H_Staff'], smith: ['2H_Axe'], trader: ['Mug'], hunter: ['2H_Crossbow'], none: []
  };
  const SHIELD = { common: 'Round_Shield', rare: 'Rectangle_Shield', epic: 'Badge_Shield', legend: 'Spike_Shield' };
  const ATK = { warrior: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Stab'], assassin: ['Dualwield_Melee_Attack_Chop', 'Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Stab'], mage: ['Spellcast_Shoot'], healer: ['Spellcast_Shoot'], archer: ['2H_Ranged_Shoot'] };
  const SPIN = { warrior: '2H_Melee_Attack_Spin', assassin: '2H_Melee_Attack_Spin', mage: 'Spellcast_Raise', healer: 'Spellcast_Raise', archer: '2H_Ranged_Shoot' };
  const ALWAYS = ['Mage_Hat', 'Barbarian_Hat', 'Rogue_Head_Hooded'];
  const NPC = { 0xf2a6c0: ['rogue', 'none'], 0x8ec5f2: ['mage', 'mage'], 0xc48a52: ['barbarian', 'smith'], 0xd9d9e6: ['knight', 'warrior', true], 0x7ddc8f: ['rogue_hooded', 'hunter'], 0xffd95a: ['barbarian', 'trader'], 0xb48cff: ['mage', 'healer'], 0x9a8f7a: ['rogue_hooded', 'none'], 0x6a9a5a: ['rogue_hooded', 'assassin'] };
  const RC = { common: 0x9ea5b0, rare: 0x3f8ad6, epic: 0x8f60d4, legend: 0xe08a2a };
  const skins = new Map(); // Hm -> skin
  /* weapon kinds (items.js WTYPES) -> what each hand holds and which attack animations play. Names are KayKit meshes from any of the
     five character files (all rigs share the hand bones); 'proc:' pieces are built here because KayKit has no bow, orb, mace or lantern. */
  const WSPEC = {
    sword: { r: '1H_Sword', l: 'SHIELD', set: '1h' }, greatsword: { r: '2H_Sword', set: '2h' }, axe: { r: '1H_Axe', l: 'Barbarian_Round_Shield', set: '1h' }, greataxe: { r: '2H_Axe', set: '2h' },
    staff: { r: '2H_Staff', set: 'cast' }, wand: { r: '1H_Wand', set: 'cast' }, orb: { r: 'proc:orb', set: 'cast' }, runeblade: { r: '1H_Sword', l: 'Spellbook_open', tint: 0x86b4ff, set: '1h' },
    bow: { l: 'proc:bow', set: 'bow' }, longbow: { l: 'proc:longbow', set: 'bow' }, crossbow: { r: '1H_Crossbow', set: 'xbow1' }, heavycrossbow: { r: '2H_Crossbow', set: 'xbow' },
    daggers: { r: 'Knife', l: 'Knife_Offhand', set: 'dual' }, shortsword: { r: '1H_Sword', l: 'Knife_Offhand', set: 'dual' }, throwing: { r: 'Throwable', l: 'Knife_Offhand', set: 'dual' }, twinaxe: { r: '1H_Axe', l: '1H_Axe_Offhand', set: 'dual' },
    scepter: { r: '1H_Wand', l: 'Spellbook_open', set: 'cast' }, holystaff: { r: '2H_Staff', tint: 0xffe0a0, set: 'cast' }, mace: { r: 'proc:mace', l: 'Spellbook', set: '1h' }, lantern: { r: '1H_Wand', l: 'proc:lantern', set: 'cast' }
  };
  const WDEF = { warrior: 'sword', mage: 'staff', healer: 'scepter', archer: 'heavycrossbow', assassin: 'daggers' };
  const ATKSET = {
    '1h': ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Stab'], '2h': ['2H_Melee_Attack_Slice', '1H_Melee_Attack_Chop', '2H_Melee_Attack_Slice'],
    dual: ['Dualwield_Melee_Attack_Chop', 'Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Stab'], cast: ['Spellcast_Shoot'], bow: ['2H_Ranged_Shoot'], xbow1: ['1H_Ranged_Shoot'], xbow: ['2H_Ranged_Shoot']
  };
  const WLIB = {};
  function wlib(name) {
    if (WLIB[name] !== undefined) return WLIB[name];
    let src = null;
    if (D.models) for (const k in D.models) { const n = byName(D.models[k], name); if (n && n.isMesh) { src = n; break; } }
    WLIB[name] = src; return src;
  }
  function procPiece(kind) {
    const g = new T.Group(); g.name = 'proc_' + kind;
    const wood = Mat(0x5a3a22, { roughness: 0.8 }), metal = Mat(0x9aa0aa, { roughness: 0.35, metalness: 0.85 }), gold = Mat(0xd8a84a, { roughness: 0.35, metalness: 0.8 });
    if (kind === 'bow' || kind === 'longbow') {
      /* long axis along the hand's Y (up when held), the limbs bend toward -X (forward), the string sits behind the grip */
      const L = kind === 'longbow' ? 1.0 : 0.72, A = Math.PI * 0.62, c = L * Math.cos(A / 2), sy = L * Math.sin(A / 2);
      const arc = new T.Mesh(new T.TorusGeometry(L, kind === 'longbow' ? 0.04 : 0.035, 6, 28, A), wood); arc.rotation.z = Math.PI - A / 2; arc.position.x = L; g.add(arc);
      const str = new T.Mesh(new T.CylinderGeometry(0.007, 0.007, sy * 2, 4), Mat(0xe8e0c8)); str.position.x = L - c; g.add(str);
      const grip = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, 0.24, 8), Mat(0x2a1a10)); g.add(grip);
      g.rotation.z = -Math.PI / 2; /* KayKit hand slots: X is up and Y points forward while the arm hangs */
    } else if (kind === 'orb') {
      const h = new T.Mesh(new T.CylinderGeometry(0.04, 0.05, 0.3, 8), gold); h.position.y = 0.05; g.add(h);
      const o = new T.Mesh(new T.SphereGeometry(0.16, 18, 12), new T.MeshStandardMaterial({ color: 0x7fb8ff, emissive: 0x3a7aff, emissiveIntensity: 1.4, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.9 })); o.position.y = 0.34; g.add(o);
      const gl = glow(0x6aa8ff, 0.9, 0.55); gl.position.y = 0.34; g.add(gl); g.scale.setScalar(1.4);
    } else if (kind === 'mace') {
      const h = new T.Mesh(new T.CylinderGeometry(0.04, 0.05, 0.8, 8), wood); h.position.y = 0.28; g.add(h);
      const hd = new T.Mesh(new T.DodecahedronGeometry(0.21, 0), Mat(0xb08a3a, { roughness: 0.4, metalness: 0.85 })); hd.position.y = 0.78; g.add(hd);
      for (let i = 0; i < 6; i++) { const sp = new T.Mesh(new T.ConeGeometry(0.055, 0.17, 5), metal); const a = i / 6 * Math.PI * 2; sp.position.set(Math.cos(a) * 0.21, 0.78, Math.sin(a) * 0.21); sp.rotation.z = -Math.cos(a) * Math.PI / 2; sp.rotation.x = Math.sin(a) * Math.PI / 2; g.add(sp); }
      g.scale.setScalar(1.45);
    } else if (kind === 'lantern') {
      const fr = new T.Mesh(new T.CylinderGeometry(0.11, 0.13, 0.26, 6, 1, true), new T.MeshStandardMaterial({ color: 0x3a3028, roughness: 0.6, metalness: 0.6, wireframe: true })); fr.position.y = -0.18; g.add(fr);
      const core = new T.Mesh(new T.SphereGeometry(0.08, 10, 8), new T.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffb050, emissiveIntensity: 2 })); core.position.y = -0.18; g.add(core);
      const gl = glow(0xffc070, 1.1, 0.6); gl.position.y = -0.18; g.add(gl);
      const top = new T.Mesh(new T.ConeGeometry(0.13, 0.1, 6), gold); top.position.y = -0.02; g.add(top);
      g.rotation.z = -Math.PI / 2; g.scale.setScalar(1.4);
    }
    g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    return g;
  }
  function makePiece(name, rarity, tint) {
    if (!name) return null;
    if (name === 'SHIELD') name = SHIELD[rarity] || 'Round_Shield';
    if (name.indexOf('proc:') === 0) return procPiece(name.slice(5));
    const src = wlib(name); if (!src) return null;
    const m = src.clone(true); m.visible = true; m.castShadow = true;
    if (tint) { m.material = m.material.clone(); m.material.color.setHex(tint); m.material.emissive = new T.Color(tint); m.material.emissiveIntensity = 0.25; }
    return m;
  }
  const RIGHT = ['1H_Sword', '2H_Sword', '1H_Axe', '2H_Axe', '1H_Wand', '2H_Staff', 'Knife', '1H_Crossbow', '2H_Crossbow', 'Throwable', 'Mug'];
  const LEFT = ['Round_Shield', 'Badge_Shield', 'Rectangle_Shield', 'Spike_Shield', 'Barbarian_Round_Shield', 'Spellbook', 'Spellbook_open', 'Knife_Offhand', '1H_Axe_Offhand', '1H_Sword_Offhand'];
  function hands(sk) {
    if (sk.hands) return sk.hands;
    let r = null, l = null;
    RIGHT.forEach((n) => { if (!r && sk.meshes[n]) r = sk.meshes[n].parent; });
    LEFT.forEach((n) => { if (!l && sk.meshes[n]) l = sk.meshes[n].parent; });
    sk.o.traverse((b) => { if (!r && /^handslot\.?r$/i.test(b.name)) r = b; if (!l && /^handslot\.?l$/i.test(b.name)) l = b; });
    sk.hands = { r, l }; return sk.hands;
  }
  /* wear the model of a weapon kind; returns the animation set */
  function arm(sk, wtype, rarity) {
    const spec = WSPEC[wtype] || WSPEC.sword, key = wtype + ':' + (spec.l === 'SHIELD' ? rarity : '');
    if (sk.wkey === key) return spec.set;
    (sk.extra || []).forEach((m) => { if (m.parent) m.parent.remove(m); });
    sk.extra = []; sk.wkey = key; sk.main = null;
    Object.keys(sk.meshes).forEach((n) => { const base = n.replace(/_\d+$/, ''); if (/Sword|Shield|Staff|Wand|Spellbook|Crossbow|Knife|Throwable|Axe|Mug/.test(base)) sk.meshes[n].visible = false; });
    const hd = hands(sk);
    const r = makePiece(spec.r, rarity, spec.tint), l = makePiece(spec.l, rarity, spec.tint && spec.l && spec.l.indexOf('Spellbook') < 0 ? spec.tint : null);
    if (r && hd.r) { hd.r.add(r); sk.extra.push(r); sk.main = r; }
    if (l && hd.l) { hd.l.add(l); sk.extra.push(l); if (!sk.main) sk.main = l; }
    return spec.set;
  }
  function makeSkin(kind) {
    const src = D.models[kind]; if (!src || !T.SkeletonUtils) return null;
    const o = T.SkeletonUtils.clone(src);
    o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.material = m.material.clone(); m.material.roughness = 0.75; } });
    const wrap = new T.Group(); wrap.add(o); fitTo(o, 2.35, 'y');
    const mixer = new T.AnimationMixer(o), actions = {};
    const sk = { kind, wrap, o, mixer, actions, cur: null, once: false, meshes: {}, glow: null, lastAtk: -1, lastAtkT: 0, cls: null, dead: false };
    o.traverse((m) => { if (m.isMesh || m.isSkinnedMesh) sk.meshes[m.name] = m; });
    return sk;
  }
  function act(sk, name) {
    if (sk.actions[name]) return sk.actions[name];
    const clip = D.clips[name]; if (!clip) return null;
    const a = sk.mixer.clipAction(clip); sk.actions[name] = a; return a;
  }
  function play(sk, name, opt) {
    opt = opt || {}; const a = act(sk, name); if (!a) return;
    if (sk.cur === name && !opt.restart) { a.timeScale = opt.ts || 1; return; }
    const prev = sk.cur ? sk.actions[sk.cur] : null;
    a.reset(); a.timeScale = opt.ts || 1; a.setLoop(opt.once ? T.LoopOnce : T.LoopRepeat, Infinity); a.clampWhenFinished = !!opt.once; a.enabled = true; a.setEffectiveWeight(1);
    if (prev && prev !== a) a.crossFadeFrom(prev, opt.fade != null ? opt.fade : 0.18, false);
    a.play(); sk.cur = name; sk.once = !!opt.once;
  }
  function dress(sk, role, eq, shieldRarity, forceHelm, wtype) {
    if (WDEF[role]) {
      sk.set = arm(sk, WSPEC[wtype] ? wtype : WDEF[role], shieldRarity || 'common');
      Object.keys(sk.meshes).forEach((n) => {
        const m = sk.meshes[n], base = n.replace(/_\d+$/, '');
        if (/Helmet/.test(base)) m.visible = !!(forceHelm || (eq && eq.helmet));
        else if (/Cape/.test(base)) m.visible = !!(forceHelm || (eq && eq.cape));
        else if (ALWAYS.includes(base)) m.visible = true;
      });
      return;
    }
    const show = new Set(SHOW[role] || []);
    if (role === 'warrior' && sk.kind === 'knight') show.add(SHIELD[shieldRarity] || 'Round_Shield');
    Object.keys(sk.meshes).forEach((n) => {
      const m = sk.meshes[n], base = n.replace(/_\d+$/, '');
      const weaponLike = /Sword|Shield|Staff|Wand|Spellbook|Crossbow|Knife|Throwable|Axe|Mug/.test(base);
      if (weaponLike) m.visible = show.has(base);
      else if (/Helmet/.test(base)) m.visible = !!(forceHelm || (eq && eq.helmet));
      else if (/Cape/.test(base)) m.visible = !!(forceHelm || (eq && eq.cape));
      else if (ALWAYS.includes(base)) m.visible = true;
    });
  }
  function weaponGlow(sk, rarity) {
    if (!rarity || rarity === 'common') { if (sk.glow) sk.glow.visible = false; return; }
    let hand = sk.main || null; if (!hand) Object.keys(sk.meshes).forEach((n) => { const m = sk.meshes[n]; if (m.visible && /Sword|Staff|Wand|Crossbow|Knife/.test(n) && !/Offhand/.test(n) && !hand) hand = m; });
    if (!hand) return;
    if (!sk.glow) { sk.glow = glow(0xffffff, 1.2, 0.7); }
    if (sk.glow.parent !== hand) hand.add(sk.glow);
    sk.glow.visible = true; sk.glow.material.color.setHex(RC[rarity] || 0xffffff); sk.glow.scale.setScalar(rarity === 'legend' ? 1.6 : 1.1);
  }
  function attach(Hm, kind) {
    const sk = makeSkin(kind); if (!sk) return null;
    Hm.root.add(sk.wrap); skins.set(Hm, sk); play(sk, 'Idle'); sk.mixer.update(Math.random() * 2);
    return sk;
  }
  function hideOld(Hm) { if (Hm.model && Hm.model.visible) Hm.model.visible = false; }
  const APPS = new WeakMap();
  const C = window.AF_CLASS;
  if (C) { const shape0 = C.shape; C.shape = function (Hm, app) { if (shape0) shape0.apply(this, arguments); if (app) APPS.set(Hm, app); }; }
  function classOfOwn() { return (C && C.prof && C.prof.cls) || 'warrior'; }
  function syncChars() {
    if (!D.ready) return;
    // you
    if (X.PL) {
      const cls = classOfOwn(), kind = KIND[cls] || 'knight';
      let sk = skins.get(X.PL);
      if (sk && sk.kind !== kind) { X.PL.root.remove(sk.wrap); skins.delete(X.PL); sk = null; }
      if (!sk) sk = attach(X.PL, kind);
      if (sk) { sk.cls = cls; const eq = X.P && X.P.eq, w = eq && eq.weapon; dress(sk, cls, eq, w ? w.rarity : 'common', false, w && w.type && (!window.AF_ITEMS || window.AF_ITEMS.canUse(w, cls)) ? w.type : null); weaponGlow(sk, eq && eq.weapon ? eq.weapon.rarity : null); if (cls === 'healer') sk.o.traverse((m) => { if (m.isMesh && !m.userData.tint) { m.userData.tint = 1; m.material.color.setRGB(1.0, 0.97, 0.88); } }); }
      hideOld(X.PL);
    }
    // other players
    if (H.others) H.others.forEach((o) => {
      if (!o || !o.H) return; const app = APPS.get(o.H), cls = (app && app.cls) || 'warrior', kind = KIND[cls] || 'knight';
      let sk = skins.get(o.H); if (sk && sk.kind !== kind) { o.H.root.remove(sk.wrap); skins.delete(o.H); sk = null; }
      if (!sk) sk = attach(o.H, kind);
      if (sk) { sk.cls = cls; const eq = { helmet: o.eq && o.eq.helmet, cape: o.eq && o.eq.cape }; dress(sk, cls, eq, o.eq && o.eq.weapon || 'common', false, o.eq && o.eq.wt); weaponGlow(sk, o.eq && o.eq.weapon); }
      hideOld(o.H);
    });
    // NPCs (story NPCs and the village chief)
    S.children.forEach((r) => {
      const Hm = r.userData && r.userData.afH; if (!Hm || Hm === X.PL || skins.has(Hm)) { if (Hm && skins.has(Hm)) hideOld(Hm); return; }
      let spec = null;
      if (r.userData.afNpc) spec = NPC[r.userData.afNpcColor] || ['rogue', 'none'];
      else if (Math.abs(r.position.x - 1.5) < 0.1 && Math.abs(r.position.z - 5) < 0.1) spec = ['mage', 'elder'];
      if (!spec) return;
      const sk = attach(Hm, spec[0]); if (!sk) return; sk.npc = true; sk.cls = spec[1];
      dress(sk, spec[1], null, 'epic', !!spec[2]); hideOld(Hm);
      if (spec[1] === 'elder') sk.o.traverse((m) => { if (m.isMesh && !m.userData.tint) { m.userData.tint = 1; m.material.color.setRGB(0.82, 0.86, 0.78); } });
    });
  }
  function driveOwn(sk, dt) {
    const R = H.R, pos = X.PL.root.position;
    sk.spd = sk.px == null ? 0 : sk.spd * 0.7 + (Math.hypot(pos.x - sk.px, pos.z - sk.pz) / Math.max(dt, 1e-3)) * 0.3; sk.px = pos.x; sk.pz = pos.z;
    const cls = sk.cls || 'warrior';
    if (!R.alive) { if (sk.cur !== 'Death_A') play(sk, 'Death_A', { once: true, fade: 0.1 }); return; }
    if (R.dodgeT >= 0) { if (sk.cur !== 'Dodge_Forward') play(sk, 'Dodge_Forward', { once: true, ts: 1.9, fade: 0.08 }); return; }
    if (R.spinT >= 0) { const n = SPIN[cls]; if (sk.cur !== n) play(sk, n, { once: true, ts: 1.8, fade: 0.08 }); return; }
    if (R.atkT >= 0) {
      const fresh = sk.lastAtk < 0 || R.atkT < sk.lastAtkT - 0.02; sk.lastAtk = R.atkT; sk.lastAtkT = R.atkT;
      const list = ATKSET[sk.set] || ATK[cls] || ATK.warrior, n = list[(R.combo | 0) % list.length];
      if (fresh || sk.cur !== n) { const clip = D.clips[n]; play(sk, n, { once: true, restart: true, ts: clip ? clip.duration / 0.5 : 2, fade: 0.06 }); }
      return;
    }
    sk.lastAtk = -1;
    if (sk.once && sk.cur && sk.actions[sk.cur] && sk.actions[sk.cur].isRunning() && sk.cur !== 'Death_A') return;
    const mounted = !!(window.AF_MOVE && window.AF_MOVE.active); sk.wrap.position.y = mounted ? 0.28 : 0;
    if (mounted) { play(sk, 'Sit_Chair_Idle'); return; }
    if (R.dashT >= 0) { play(sk, 'Running_A', { ts: 1.8 }); return; }
    if (sk.spd > 7.2) play(sk, 'Running_A', { ts: Math.min(1.5, sk.spd / 7.5) });
    else if (sk.spd > 0.6) play(sk, 'Walking_A', { ts: Math.min(1.6, 0.5 + sk.spd / 4.5) });
    else play(sk, sk.set === '2h' ? '2H_Melee_Idle' : 'Idle');
  }
  function driveOther(sk, o, dt) {
    const cls = sk.cls || 'warrior', an = o.anim | 0;
    if (an === 5) { if (sk.cur !== 'Death_A') play(sk, 'Death_A', { once: true }); return; }
    if (an === 4) { if (sk.cur !== 'Dodge_Forward') play(sk, 'Dodge_Forward', { once: true, ts: 1.9 }); return; }
    if (an === 3) { play(sk, SPIN[cls], { ts: 1.6 }); return; }
    if (an === 2) { const list = ATKSET[sk.set] || ATK[cls] || ATK.warrior; if (!list.includes(sk.cur) || !sk.actions[sk.cur].isRunning()) play(sk, list[Math.floor(Math.random() * list.length)], { once: true, restart: true, ts: 2 }); return; }
    if (an === 7) { play(sk, 'Running_A', { ts: 1.8 }); return; }
    if (an === 6) { play(sk, 'Running_A', { ts: 1.2 }); return; }
    if (an === 1) { play(sk, 'Walking_A', { ts: 1.2 }); return; }
    play(sk, sk.set === '2h' ? '2H_Melee_Idle' : 'Idle');
  }
  onTick((dt) => {
    if (!D.ready) return;
    const R = H.R;
    skins.forEach((sk, Hm) => {
      if (!sk.wrap.parent) return;
      const far = Math.hypot(Hm.root.position.x - R.x, Hm.root.position.z - R.z) > 70;
      if (far) return;
      if (Hm === X.PL) driveOwn(sk, dt);
      else if (sk.npc) { if (!sk.cur) play(sk, 'Idle'); }
      else { let o = null; H.others.forEach((x) => { if (x.H === Hm) o = x; }); if (o) driveOther(sk, o, dt); }
      sk.mixer.update(dt);
      hideOld(Hm);
    });
    if (X.PL) { const sk = skins.get(X.PL); if (sk) sk.wrap.visible = !(X.cam && X.cam.mode === 'first'); }
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
    const fl = document.createElement('link'); fl.rel = 'stylesheet'; fl.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@600;800&display=swap'; document.head.appendChild(fl);
    const css = document.createElement('style');
    css.textContent = `
    :root{--ember:#e07a3a;--ember-2:#ffb066;--bone:#e3d6bd;--iron:rgba(14,12,11,.86);--iron-line:rgba(224,122,58,.32);--blood:#a8322a;--display-dark:'Cinzel','Trajan Pro','Times New Roman',serif}
    #afVig{position:fixed;inset:0;pointer-events:none;z-index:1;background:radial-gradient(ellipse at 50% 55%,rgba(0,0,0,0) 60%,rgba(0,0,0,.3) 100%)}
    #afMenu{position:fixed;left:50%;top:max(10px,env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:41;display:flex;gap:3px;padding:5px;border-radius:6px;background:var(--iron);border:1px solid var(--iron-line);box-shadow:0 0 0 1px #000,0 10px 28px rgba(0,0,0,.6);max-width:calc(100vw - 680px);overflow-x:auto;scrollbar-width:none}
    #afMenu::-webkit-scrollbar{display:none}
    #afMenu[hidden]{display:none!important}
    #afMenu button{all:unset;box-sizing:border-box;position:relative;flex:none;width:40px;height:40px;border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#cdbfa6;transition:background .15s,color .15s}
    #afMenu button:hover{background:rgba(224,122,58,.14);color:#fff1dc}
    #afMenu button:focus-visible{outline:2px solid var(--ember);outline-offset:1px}
    #afMenu button.on,#afMenu button.afOn{background:linear-gradient(180deg,#c4642c,#7d3418);color:#fff1dc;box-shadow:inset 0 0 0 1px rgba(255,190,120,.4)}
    #afMenu button[hidden]{display:none!important}
    #afMenu svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    #afMenu .k{position:absolute;right:3px;bottom:1px;font:700 9px/1 system-ui,sans-serif;opacity:.6}
    #afMenu button::after{content:attr(data-tip);position:absolute;left:50%;top:calc(100% + 8px);transform:translateX(-50%);white-space:nowrap;padding:4px 8px;border-radius:4px;background:#0c0a09;color:var(--bone);font:600 12px system-ui,sans-serif;opacity:0;pointer-events:none;transition:opacity .12s;border:1px solid var(--iron-line)}
    #afMenu button:hover::after,#afMenu button:focus-visible::after{opacity:1}
    #afDock{display:none!important}
    #hud .box{background:var(--iron)!important;border:1px solid var(--iron-line)!important;border-radius:6px!important;box-shadow:0 0 0 1px #000,0 10px 26px rgba(0,0,0,.55)!important}
    #hud .portrait{border-color:var(--ember)!important;box-shadow:0 0 0 3px #000,0 0 18px rgba(224,122,58,.45)}
    #hud .lvl{background:linear-gradient(180deg,#e08a44,#8a3a18)!important;color:#fff1dc!important}
    #hud .meter{border-radius:2px!important;box-shadow:inset 0 0 0 1px #000,inset 0 2px 3px rgba(0,0,0,.7)}
    #hud .meter i{border-radius:1px;background-image:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,0) 55%)!important}
    #hud .meter.hp i{background-color:#9c2a22!important}
    #hud .meter.mp i{background-color:#2c5a8e!important}
    #hud .meter.st i{background-color:#6b8a3a!important}
    #hud .sk{background:linear-gradient(180deg,#1d1815,#0e0b0a)!important;border:1px solid rgba(224,122,58,.28)!important;border-radius:4px!important}
    #hud .sk.main{border-color:var(--ember)!important;box-shadow:0 0 16px rgba(224,122,58,.4)}
    #hud .mm{border:2px solid #6b4a2e!important;box-shadow:0 0 0 3px #000,0 0 22px rgba(0,0,0,.7)!important;filter:saturate(.6) brightness(.85)}
    #hud .quest .k,#hud .row1 span:last-child{color:var(--ember-2)!important}
    #hud .quest .t{font-family:var(--display-dark);letter-spacing:.02em}
    #hud .expbar i{background:linear-gradient(90deg,#8a3a18,#e08a44)!important}
    #hud .cams button[aria-pressed="true"]{background:linear-gradient(180deg,#c4642c,#7d3418)!important;color:#fff1dc!important}
    #hud .bag{background:var(--iron)!important;border:1px solid var(--iron-line)!important;border-radius:6px!important}
    .toast.big{font-family:var(--display-dark)!important;color:var(--ember-2)!important;letter-spacing:.04em}
    .afp,#afUR,#afGR,#afVR,#afQD,#afQJ,#afChar,#afZ,#afMap,#afTR,#afCreate{background:rgba(12,10,9,.96)!important;border:1px solid var(--iron-line)!important;border-radius:6px!important;box-shadow:0 0 0 1px #000,0 24px 60px rgba(0,0,0,.7)!important;color:var(--bone)!important}
    .afp .hd b,#afChar b:first-child{font-family:var(--display-dark);letter-spacing:.03em}
    .afp h4{color:var(--ember-2)!important}
    .afp button,#afUR button,#afGR button,#afVR button,#afChar button{background:linear-gradient(180deg,#c4642c,#7d3418)!important;color:#fff1dc!important;border:1px solid #2a1206!important;box-shadow:none!important;border-radius:3px!important}
    .afp button.g,#afUR button.g,#afGR button.g,#afVR button.g{background:rgba(255,255,255,.06)!important;color:var(--bone)!important;border-color:rgba(255,255,255,.12)!important}
    .afp button.on{background:var(--bone)!important;color:#1a120c!important}
    .afp .row,.afp .box{background:rgba(255,255,255,.04)!important;border:1px solid rgba(255,255,255,.05)}
    #start .card,#death .card,#kicked .card{background:rgba(12,10,9,.9)!important;border:1px solid var(--iron-line)!important;border-radius:8px!important;box-shadow:0 0 0 1px #000,0 30px 80px rgba(0,0,0,.8)!important}
    #start h1,#death h1,#kicked h1{font-family:var(--display-dark)!important;color:var(--ember-2)!important;letter-spacing:.06em;text-shadow:0 0 30px rgba(224,122,58,.45)}
    #start .btn.primary,#death .btn.primary,#kicked .btn.primary,#dialog .btn.primary{background:linear-gradient(180deg,#c4642c,#7d3418)!important;border-color:#2a1206!important;color:#fff1dc!important}
    #dialog{background:rgba(12,10,9,.92)!important;border:1px solid var(--iron-line)!important}
    #dialog .who{color:var(--ember-2)!important;font-family:var(--display-dark);letter-spacing:.06em}
    .lbl .nm{font-weight:700!important;text-shadow:0 1px 2px #000,0 0 8px #000!important}
    .lbl .bar{border-radius:1px!important}
    .lbl .bar i{background:#b0302a!important}
    @media (max-width:1100px){#afMenu{top:auto;bottom:calc(env(safe-area-inset-bottom,0px) + 116px);max-width:calc(100vw - 32px)}}
    @media (max-width:760px){#afMenu{bottom:calc(env(safe-area-inset-bottom,0px) + 200px)}#afMenu button{width:36px;height:36px}}`;
    document.head.appendChild(css);
    const vig = document.createElement('div'); vig.id = 'afVig'; document.body.appendChild(vig);
    const bar = document.createElement('nav'); bar.id = 'afMenu'; bar.setAttribute('aria-label', 'Menu'); bar.hidden = true; document.body.appendChild(bar);
    ['keydown', 'keyup', 'pointerdown', 'mousedown', 'wheel'].forEach((ev) => bar.addEventListener(ev, (e) => e.stopPropagation()));
    const IDS = ['afCharBtn', 'afTB', 'afQB', 'afZBtn', 'afGB', 'afUB', 'afVB', 'afBtn'];
    const order = ['c', 'j', 'y', 'n', 'p', 'g', 'h', 'u', 'v', 't', 'o', 'b', 'k', 'q'];
    function dressBtn(btn) {
      if (btn.dataset.afMenu) return;
      const txt = btn.textContent.trim(), m = txt.match(/^(.*?)\s*\(([A-Z0-9])\)\s*$/i), label = m ? m[1] : txt, key = m ? m[2].toLowerCase() : '';
      btn.dataset.afMenu = '1'; btn.dataset.k = key; btn.dataset.tip = label + (key ? ' · ' + key.toUpperCase() : ''); btn.setAttribute('aria-label', label); btn.removeAttribute('style');
      btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[key] || '<circle cx="12" cy="12" r="7"/>') + '</svg>' + (key ? '<span class="k">' + key.toUpperCase() + '</span>' : '');
      new MutationObserver(() => { if (btn.textContent.trim() !== key.toUpperCase() && btn.textContent.trim().length > 1) { delete btn.dataset.afMenu; dressBtn(btn); } }).observe(btn, { childList: true, characterData: true, subtree: true });
    }
    function gather() {
      const list = []; IDS.forEach((id) => { const b = document.getElementById(id); if (b) list.push(b); });
      const dock = document.getElementById('afDock'); if (dock) dock.querySelectorAll('button').forEach((b) => list.push(b));
      list.forEach((b) => { dressBtn(b); if (b.parentNode !== bar) bar.appendChild(b); });
      Array.from(bar.children).sort((a, b) => order.indexOf(a.dataset.k) - order.indexOf(b.dataset.k)).forEach((k) => bar.appendChild(k));
      const open = { afCharBtn: 'afChar', afUB: 'afUR', afGB: 'afGR', afVB: 'afVR', afQB: 'afQJ', afZBtn: 'afZ', afTB: 'afTR' };
      Object.keys(open).forEach((id) => { const b = document.getElementById(id), p = document.getElementById(open[id]); if (b && p) b.classList.toggle('afOn', !p.hidden); });
      bar.hidden = !H.isRunning() || !!(C && C.creating);
    }
    setInterval(gather, 500); gather();
  });

  /* ================= loading + frame hook ================= */
  let lastT = performance.now();
  const prev = S.onBeforeRender;
  S.onBeforeRender = function () {
    if (prev) prev.apply(this, arguments);
    const now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    for (let i = 0; i < ticks.length; i++) { try { ticks[i](dt); } catch (e) { console.error('[dark tick]', e); ticks.splice(i, 1); i--; } }
    try { if (X.PL && X.PL.root) X.PL.root.updateMatrixWorld(true); if (H.others) H.others.forEach((o) => { if (o && o.H && o.H.root) o.H.root.updateMatrixWorld(true); }); skins.forEach((sk, Hm) => { if (Hm.root.parent === S) Hm.root.updateMatrixWorld(true); }); } catch (e) { /* ignore */ }
  };
  if (!loader) { console.warn('[dark] thieu THREE.GLTFLoader: giu mo hinh cu'); return; }
  const V = '?v=1';
  Promise.all([
    loadGLB('/models/anims.glb' + V), loadGLB('/models/knight.glb' + V), loadGLB('/models/mage.glb' + V), loadGLB('/models/rogue.glb' + V),
    loadGLB('/models/rogue_hooded.glb' + V), loadGLB('/models/barbarian.glb' + V), loadGLB('/models/village.glb' + V), loadGLB('/models/props.glb' + V)
  ]).then(([an, kn, mg, ro, rh, ba, vi, pr]) => {
    an.animations.forEach((c) => { D.clips[c.name] = c; });
    D.models = { knight: kn.scene, mage: mg.scene, rogue: ro.scene, rogue_hooded: rh.scene, barbarian: ba.scene };
    D.village = vi.scene; D.props = pr.scene; D.ready = true;
    safe('trees', () => { D.trees = replaceTrees(vi.scene); darkenRocks(); });
    const tryVillage = () => { if (D.built) return; if (!H.isRunning()) { setTimeout(tryVillage, 600); return; } D.built = true; safe('village', () => buildVillage(vi.scene, pr.scene)); };
    tryVillage();
    safe('characters', syncChars);
    setInterval(() => safe('characters', syncChars), 700);
    console.log('[dark] da nap mo hinh', JSON.stringify(D.parts));
  }).catch((e) => { D.parts.load = 'loi: ' + (e && e.message ? e.message : e); console.error('[dark] khong tai duoc mo hinh', e); });
  console.log('[dark] da nap', JSON.stringify(D.parts));
})();
