/* Aetherfall skill effects (browser only, purely visual).
   A small effect engine (GPU-friendly particle pools, slash arcs, shock rings, beams, projectiles, lightning, meteors, ice spikes,
   magic circles, domes, smoke, short light flashes, screen shake) and one effect per attack and skill of every class.
   Hooks: AF_CLASS.fx(kind, ids) is called by every attack that checks for hits; outgoing {t:'skill'} messages start support skills;
   the dash and the dodge are read from the player state; other players' attacks are read from their animation code.
   Nothing here changes damage, range or cooldowns. */
(function () {
  'use strict';
  const H = window.AF_CH, X = window.AF_CHX, T = window.THREE, RU = window.AF_RULES, G = window.AF_GFX;
  if (!H || !X || !T || !RU || !G) { console.warn('[vfx] thiếu AF_CH/THREE, bỏ qua'); return; }
  const S = G.scene, R = H.R, PI = Math.PI, TAU = PI * 2;
  const Q = () => (window.AF_VISUAL && window.AF_VISUAL.quality ? window.AF_VISUAL.quality() : 2);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const col = (c) => new T.Color(c);
  const gy = (x, z) => H.heightAt(x, z);
  const V = window.AF_VFX = { live: [] };

  /* ---------- textures ---------- */
  function cvTex(size, draw) { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); const t = new T.CanvasTexture(c); return t; }
  const TX = {
    soft: cvTex(64, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.7)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); }),
    spark: cvTex(64, (g, s) => { g.translate(s / 2, s / 2); const r = g.createRadialGradient(0, 0, 0, 0, 0, s / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.15, 'rgba(255,255,255,.9)'); r.addColorStop(0.4, 'rgba(255,255,255,.15)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(-s / 2, -s / 2, s, s); g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(-s / 2, -1.5, s, 3); g.fillRect(-1.5, -s / 2, 3, s); }),
    smoke: cvTex(64, (g, s) => { for (let i = 0; i < 9; i++) { const x = s / 2 + rnd(-12, 12), y = s / 2 + rnd(-12, 12), rr = rnd(10, 22), r = g.createRadialGradient(x, y, 0, x, y, rr); r.addColorStop(0, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); } }),
    circle: cvTex(256, (g, s) => {
      const c = s / 2; g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 5; g.beginPath(); g.arc(c, c, c - 6, 0, TAU); g.stroke();
      g.lineWidth = 2.5; g.beginPath(); g.arc(c, c, c - 22, 0, TAU); g.stroke(); g.beginPath(); g.arc(c, c, c * 0.42, 0, TAU); g.stroke();
      g.lineWidth = 3; g.beginPath(); for (let i = 0; i <= 5; i++) { const a = -PI / 2 + i * TAU * 2 / 5, r = c - 24; i ? g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r) : g.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r); } g.stroke();
      g.font = 'bold 18px serif'; g.fillStyle = 'rgba(255,255,255,1)'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊ'; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; g.save(); g.translate(c + Math.cos(a) * (c - 14), c + Math.sin(a) * (c - 14)); g.rotate(a + PI / 2); g.fillText(runes[i], 0, 0); g.restore(); }
    }),
    ring: cvTex(128, (g, s) => { const c = s / 2, r = g.createRadialGradient(c, c, c * 0.55, c, c, c); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.55, 'rgba(255,255,255,.95)'); r.addColorStop(0.75, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); })
  };
  const addMat = (c, o, map, side) => new T.MeshBasicMaterial({ color: col(c), transparent: true, opacity: o == null ? 1 : o, depthWrite: false, blending: T.AdditiveBlending, map: map || null, side: side || T.DoubleSide });

  /* ---------- particle pools (one draw call each) ---------- */
  function Pool(cap, size, map) {
    const g = new T.BufferGeometry();
    this.p = new Float32Array(cap * 3).fill(-9999); this.c = new Float32Array(cap * 3); this.b = new Float32Array(cap * 3);
    this.v = new Float32Array(cap * 3); this.l = new Float32Array(cap); this.m = new Float32Array(cap); this.gr = new Float32Array(cap); this.dr = new Float32Array(cap);
    g.setAttribute('position', new T.BufferAttribute(this.p, 3)); g.setAttribute('color', new T.BufferAttribute(this.c, 3));
    this.pts = new T.Points(g, new T.PointsMaterial({ size, map, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true }));
    this.pts.frustumCulled = false; this.pts.renderOrder = 6; S.add(this.pts); this.cap = cap; this.i = 0; this.alive = 0;
  }
  Pool.prototype.emit = function (x, y, z, vx, vy, vz, c, life, grav, drag) {
    const i = this.i; this.i = (this.i + 1) % this.cap; const k = i * 3;
    this.p[k] = x; this.p[k + 1] = y; this.p[k + 2] = z; this.v[k] = vx; this.v[k + 1] = vy; this.v[k + 2] = vz;
    this.b[k] = c.r; this.b[k + 1] = c.g; this.b[k + 2] = c.b; this.l[i] = life; this.m[i] = life; this.gr[i] = grav || 0; this.dr[i] = drag == null ? 1.5 : drag;
  };
  Pool.prototype.update = function (dt) {
    const p = this.p, v = this.v, c = this.c, b = this.b; let any = false;
    for (let i = 0; i < this.cap; i++) {
      if (this.l[i] <= 0) continue; any = true;
      const k = i * 3; this.l[i] -= dt;
      if (this.l[i] <= 0) { p[k + 1] = -9999; c[k] = c[k + 1] = c[k + 2] = 0; continue; }
      const d = Math.exp(-this.dr[i] * dt); v[k] *= d; v[k + 1] = v[k + 1] * d - this.gr[i] * dt; v[k + 2] *= d;
      p[k] += v[k] * dt; p[k + 1] += v[k + 1] * dt; p[k + 2] += v[k + 2] * dt;
      const f = this.l[i] / this.m[i], a = f * f * (3 - 2 * f); c[k] = b[k] * a; c[k + 1] = b[k + 1] * a; c[k + 2] = b[k + 2] * a;
    }
    if (any || this.dirty) { this.pts.geometry.attributes.position.needsUpdate = true; this.pts.geometry.attributes.color.needsUpdate = true; this.dirty = any; }
  };
  const SP = new Pool(2400, 0.32, TX.spark), GL = new Pool(700, 1.1, TX.soft);
  const lowQ = () => Q() === 0;
  function burst(x, y, z, c, n, spd, life, opt) {
    opt = opt || {}; const cc = col(c), pool = opt.big ? GL : SP; n = Math.round(n * (lowQ() ? 0.45 : 1));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, e = opt.flat ? rnd(-0.15, 0.35) : rnd(-0.6, 1), s = spd * rnd(0.35, 1);
      const dx = opt.dir ? opt.dir[0] + rnd(-opt.spread, opt.spread) : Math.cos(a) * Math.cos(e), dz = opt.dir ? opt.dir[1] + rnd(-opt.spread, opt.spread) : Math.sin(a) * Math.cos(e);
      pool.emit(x + rnd(-0.1, 0.1), y + rnd(-0.1, 0.1), z + rnd(-0.1, 0.1), dx * s, (opt.up != null ? opt.up * rnd(0.5, 1.2) : Math.sin(e) * s), dz * s, cc, life * rnd(0.6, 1.2), opt.grav || 0, opt.drag);
    }
  }

  /* ---------- timed effects ---------- */
  function run(o) { o.t = 0; (o.objs || []).forEach((m) => S.add(m)); V.live.push(o); return o; }
  function dispose(m) { S.remove(m); m.traverse((n) => { if (n.geometry && !n.geometry.userData.keep) n.geometry.dispose(); if (n.material) [].concat(n.material).forEach((mm) => { if (!mm.userData.keep) mm.dispose(); }); }); }
  const ease = { out: (k) => 1 - Math.pow(1 - k, 3), in: (k) => k * k, io: (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2) };

  /* light flashes, at most three at a time */
  const lights = []; for (let i = 0; i < 3; i++) { const L = new T.PointLight(0xffffff, 0, 14, 2); L.userData.afSky = true; L.userData.t = 0; S.add(L); lights.push(L); }
  function flash(x, y, z, c, power, dur) {
    if (Q() === 0) return; const L = lights.reduce((a, b) => (a.userData.t < b.userData.t ? a : b));
    L.position.set(x, y, z); L.color.set(c); L.userData.p = power; L.userData.t = dur; L.userData.d = dur; L.distance = 10 + power * 3;
  }
  /* screen shake through the canvas transform (camera code stays untouched) */
  let shakeT = 0, shakeA = 0;
  function shake(a, dur) { shakeA = Math.max(shakeA, a); shakeT = Math.max(shakeT, dur); }

  /* a glowing crescent; yaw = facing, tilt rolls it (0 horizontal, PI/2 vertical) */
  function slash(x, y, z, yaw, c, o) {
    o = o || {}; const r = o.r || 1.9, w = o.w || 0.55, len = o.len || 2.4, dur = o.dur || 0.28;
    const geo = new T.RingGeometry(r - w, r, 40, 1, -len / 2, len), cl = [], cc = col(c), pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const a = Math.atan2(pos.getY(i), pos.getX(i)), k = (a + len / 2) / len, rad = Math.hypot(pos.getX(i), pos.getY(i)), edge = (rad - (r - w)) / w; const f = Math.pow(Math.max(0, Math.min(1, k)), 1.6) * (0.35 + 0.65 * edge); const wht = f * f * f * 0.45; cl.push(cc.r * f * 1.5 + wht, cc.g * f * 1.5 + wht, cc.b * f * 1.5 + wht); }
    geo.setAttribute('color', new T.Float32BufferAttribute(cl, 3));
    const m = new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
    /* pivot turns to the facing, tilt rolls the blade plane around the forward axis, flat lays the ring down, the mesh sweeps */
    const piv = new T.Group(); piv.position.set(x, y, z); piv.rotation.y = yaw;
    const tiltG = new T.Group(); tiltG.rotation.z = o.tilt || 0; piv.add(tiltG);
    const flat = new T.Group(); flat.rotation.x = -PI / 2; tiltG.add(flat); flat.add(m);
    const from = (o.from != null ? o.from : -1.3) - PI / 2, to = (o.to != null ? o.to : 1.3) - PI / 2; m.rotation.z = from;
    run({ objs: [piv], dur, upd(k) { m.rotation.z = from + (to - from) * ease.out(Math.min(1, k * 1.4)); m.material.opacity = k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45; const s = 1 + k * 0.12; m.scale.set(s, s, s); }, end() { dispose(piv); } });
    /* sparks thrown off the edge */
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    burst(x + fx * r * 0.8, y, z + fz * r * 0.8, c, o.sparks || 10, 4, 0.35, { dir: [fx, fz], spread: 0.9, up: 1.5, grav: 6 });
  }
  /* expanding ring on the ground */
  function shock(x, z, c, r0, r1, dur, o) {
    o = o || {}; const y = gy(x, z) + 0.07;
    const m = new T.Mesh(new T.PlaneGeometry(2, 2), addMat(c, o.op || 1, TX.ring)); m.rotation.x = -PI / 2; m.position.set(x, y, z); m.renderOrder = 4;
    run({ objs: [m], dur, upd(k) { const s = r0 + (r1 - r0) * ease.out(k); m.scale.set(s, s, 1); m.material.opacity = (o.op || 1) * (1 - k); }, end() { dispose(m); } });
  }
  /* glowing sprite */
  function sprite(c, size, op, map) { const s = new T.Sprite(new T.SpriteMaterial({ map: map || TX.soft, color: col(c), transparent: true, opacity: op == null ? 1 : op, depthWrite: false, blending: T.AdditiveBlending })); s.scale.setScalar(size); return s; }
  function pop(x, y, z, c, size, dur) {
    const s = sprite(c, size, 1); s.position.set(x, y, z);
    run({ objs: [s], dur, upd(k) { s.scale.setScalar(size * (0.6 + ease.out(k) * 0.8)); s.material.opacity = 1 - k; }, end() { dispose(s); } });
  }
  /* light column (heal, holy, revive) */
  function column(x, z, c, r, h, dur, o) {
    o = o || {}; const y = gy(x, z), g = new T.Group(); g.position.set(x, y, z);
    const outer = new T.Mesh(new T.CylinderGeometry(r, r * 1.15, h, 28, 1, true), addMat(c, 0.35)); outer.position.y = h / 2; g.add(outer);
    const inner = new T.Mesh(new T.CylinderGeometry(r * 0.35, r * 0.5, h, 16, 1, true), addMat(0xffffff, 0.55)); inner.position.y = h / 2; g.add(inner);
    run({ objs: [g], dur, upd(k) { const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85; outer.material.opacity = 0.4 * a; inner.material.opacity = 0.6 * a; const s = o.shrink ? 1 - k * 0.6 : 1 + Math.sin(k * 20) * 0.04; outer.scale.set(s, 1, s); inner.scale.set(s, 1, s); g.rotation.y += 0.05; }, end() { dispose(g); } });
    for (let i = 0; i < (o.motes || 24); i++) { const a = Math.random() * TAU, rr = Math.random() * r; SP.emit(x + Math.cos(a) * rr, y + rnd(0, 0.8), z + Math.sin(a) * rr, 0, rnd(2, 5), 0, col(c), rnd(0.6, dur), -0.5, 0.3); }
  }
  /* magic circle on the ground */
  function circle(x, z, c, r, dur, o) {
    o = o || {}; const y = gy(x, z) + 0.06;
    const m = new T.Mesh(new T.PlaneGeometry(2, 2), addMat(c, 1, TX.circle)); m.rotation.x = -PI / 2; m.position.set(x, y, z); m.renderOrder = 4;
    const follow = o.follow;
    run({ objs: [m], dur, upd(k, dt) { if (follow) m.position.set(R.x, gy(R.x, R.z) + 0.06, R.z); const s = r * (k < 0.15 ? ease.out(k / 0.15) : 1); m.scale.set(s, s, 1); m.rotation.z += dt * (o.spin || 1.2); m.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3; }, end() { dispose(m); } });
  }
  /* projectile with a trail: onHit(x, y, z) when it lands */
  function shot(x0, y0, z0, x1, y1, z1, c, o) {
    o = o || {}; const d = Math.hypot(x1 - x0, y1 - y0, z1 - z0), dur = Math.max(0.08, d / (o.speed || 26)), g = new T.Group();
    const core = sprite(0xffffff, (o.size || 0.7) * 0.5, 1), halo = sprite(c, o.size || 0.7, 0.9); g.add(halo); g.add(core);
    if (o.arrow) { const a = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 1.1, 5), new T.MeshBasicMaterial({ color: 0xe8dcc0 })); a.rotation.x = PI / 2; a.position.z = -0.45; g.add(a); core.scale.setScalar(0.25); halo.scale.setScalar(0.5); }
    g.position.set(x0, y0, z0); g.lookAt(x1, y1, z1); const cc = col(c);
    run({ objs: [g], dur, upd(k) {
      const arc = o.arc ? Math.sin(k * PI) * o.arc : 0; g.position.set(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k + arc, z0 + (z1 - z0) * k);
      const n = o.arrow ? 1 : 3; for (let i = 0; i < n; i++) (o.arrow ? SP : GL).emit(g.position.x + rnd(-0.08, 0.08), g.position.y + rnd(-0.08, 0.08), g.position.z + rnd(-0.08, 0.08), rnd(-0.4, 0.4), rnd(-0.2, 0.6), rnd(-0.4, 0.4), cc, o.arrow ? 0.25 : 0.4, 0, 2);
      if (o.smoke && Math.random() < 0.5) SP.emit(g.position.x, g.position.y, g.position.z, rnd(-0.5, 0.5), rnd(0.2, 1), rnd(-0.5, 0.5), col(0x553322), 0.6, -0.5, 1);
    }, end() { dispose(g); if (o.onHit) o.onHit(x1, y1, z1); } });
  }
  /* lightning between two points, re-drawn a few times */
  function bolt(x0, y0, z0, x1, y1, z1, c, dur) {
    const mk = () => { const pts = [], n = 12; for (let i = 0; i <= n; i++) { const k = i / n, j = i === 0 || i === n ? 0 : 0.55; pts.push(new T.Vector3(x0 + (x1 - x0) * k + rnd(-j, j), y0 + (y1 - y0) * k + rnd(-j * 0.4, j * 0.4), z0 + (z1 - z0) * k + rnd(-j, j))); } return new T.BufferGeometry().setFromPoints(pts); };
    const L = new T.Line(mk(), new T.LineBasicMaterial({ color: col(c), transparent: true, opacity: 1, blending: T.AdditiveBlending, depthWrite: false })), L2 = new T.Line(mk(), new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: T.AdditiveBlending, depthWrite: false }));
    let re = 0;
    run({ objs: [L, L2], dur: dur || 0.32, upd(k, dt) { re -= dt; if (re <= 0) { re = 0.06; L.geometry.dispose(); L.geometry = mk(); L2.geometry.dispose(); L2.geometry = mk(); } L.material.opacity = L2.material.opacity = (1 - k) * (0.6 + Math.random() * 0.4); }, end() { dispose(L); dispose(L2); } });
  }
  /* ice spikes rising from the ground */
  const spikeGeo = new T.ConeGeometry(0.28, 1.6, 5); spikeGeo.translate(0, 0.8, 0); spikeGeo.userData.keep = true;
  const iceMat = new T.MeshStandardMaterial({ color: 0xbfe8ff, emissive: 0x3fa0ff, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 }); iceMat.userData.keep = true;
  function spike(x, z, delay, s) {
    const m = new T.Mesh(spikeGeo, iceMat); m.position.set(x, gy(x, z) - 0.05, z); m.rotation.set(rnd(-0.35, 0.35), rnd(0, TAU), rnd(-0.35, 0.35)); m.scale.setScalar(0.001);
    run({ objs: [m], dur: 1.3 + delay, upd(k) { const t = k * (1.3 + delay) - delay; if (t < 0) return; const up = Math.min(1, t / 0.12); const sc = (t > 0.95 ? Math.max(0.001, 1 - (t - 0.95) / 0.35) : ease.out(up)) * s; m.scale.set(sc, sc, sc); if (t < 0.13 && t + 0.02 > 0.12) burst(m.position.x, m.position.y + 0.3, m.position.z, 0xbfe8ff, 6, 3, 0.4, { up: 3, grav: 8 }); }, end() { S.remove(m); } });
  }
  /* falling meteor with a fire trail and an impact */
  const rockGeo = new T.DodecahedronGeometry(0.55, 0); rockGeo.userData.keep = true;
  const rockMat = new T.MeshStandardMaterial({ color: 0x3a2418, emissive: 0xff5a1a, emissiveIntensity: 1.2, roughness: 0.8 }); rockMat.userData.keep = true;
  function meteor(x, z, delay) {
    const y1 = gy(x, z), sx = x + 7, sy = y1 + 20, sz = z - 5, m = new T.Mesh(rockGeo, rockMat), h = sprite(0xff7a2a, 2.2, 0.9); m.add(h); m.visible = false;
    let hit = false;
    run({ objs: [m], dur: 0.55 + delay, upd(k) {
      const t = k * (0.55 + delay) - delay; if (t < 0) return; m.visible = true; const p = Math.min(1, t / 0.55);
      m.position.set(sx + (x - sx) * p, sy + (y1 - sy) * p, sz + (z - sz) * p); m.rotation.x += 0.3; m.rotation.y += 0.2;
      for (let i = 0; i < 3; i++) GL.emit(m.position.x, m.position.y, m.position.z, rnd(-0.6, 0.6), rnd(0, 1), rnd(-0.6, 0.6), col(i ? 0xff6a1a : 0xffc060), 0.45, 0, 2);
      if (p >= 1 && !hit) { hit = true; boom(x, y1, z, 0xff6a1a, 1.4); }
    }, end() { S.remove(m); h.material.dispose(); } });
  }
  function boom(x, y, z, c, s) {
    s = s || 1; pop(x, y + 0.6, z, c, 4.5 * s, 0.4); pop(x, y + 0.6, z, 0xffffff, 2 * s, 0.25); shock(x, z, c, 0.4, 4.2 * s, 0.55);
    burst(x, y + 0.4, z, c, 34 * s, 9 * s, 0.7, { grav: 9, up: 7 }); burst(x, y + 0.5, z, 0xffd27a, 14, 3, 0.9, { big: true, grav: -1 });
    for (let i = 0; i < 10; i++) SP.emit(x, y + 0.3, z, rnd(-3, 3), rnd(1, 3), rnd(-3, 3), col(0x2a2420), 1.2, -0.3, 1.2);
    flash(x, y + 1.5, z, c, 5 * s, 0.35); shake(5 * s, 0.25);
  }
  /* translucent dome that follows the player (bulwark) */
  function dome(c, dur) {
    const m = new T.Mesh(new T.SphereGeometry(1.5, 24, 16), addMat(c, 0.22)), w = new T.Mesh(new T.IcosahedronGeometry(1.55, 1), new T.MeshBasicMaterial({ color: col(c), wireframe: true, transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false }));
    run({ objs: [m, w], dur, upd(k, dt) { const y = gy(R.x, R.z) + 1.1; m.position.set(R.x, y, R.z); w.position.copy(m.position); w.rotation.y += dt * 0.6; const a = k < 0.05 ? k / 0.05 : k > 0.9 ? (1 - k) / 0.1 : 1, p = 0.8 + Math.sin(k * 60) * 0.2; m.material.opacity = 0.18 * a * p; w.material.opacity = 0.35 * a; const s = k < 0.05 ? ease.out(k / 0.05) : 1; m.scale.setScalar(s); w.scale.setScalar(s); }, end() { dispose(m); dispose(w); } });
  }
  function smoke(x, y, z, n, c) {
    for (let i = 0; i < n; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: TX.smoke, color: col(c || 0x6a6470), transparent: true, opacity: 0.8, depthWrite: false })); const ox = rnd(-0.8, 0.8), oz = rnd(-0.8, 0.8), sz = rnd(1.2, 2.2);
      s.position.set(x + ox, y + rnd(0, 1.2), z + oz); s.scale.setScalar(sz);
      run({ objs: [s], dur: rnd(0.7, 1.1), upd(k) { s.scale.setScalar(sz * (1 + k * 1.2)); s.position.y += 0.012; s.position.x += ox * 0.01; s.position.z += oz * 0.01; s.material.opacity = 0.8 * (1 - k); }, end() { dispose(s); } });
    }
  }
  /* flying blade (flurry) */
  const bladeGeo = new T.BoxGeometry(0.08, 0.04, 0.55); bladeGeo.userData.keep = true;
  function blade(x, y, z, a, c) {
    const m = new T.Mesh(bladeGeo, new T.MeshBasicMaterial({ color: 0xdcd6ff })), h = sprite(c, 0.8, 0.8); m.add(h); m.position.set(x, y, z);
    const dx = Math.sin(a), dz = Math.cos(a);
    run({ objs: [m], dur: 0.45, upd(k, dt) { m.position.x += dx * 18 * dt; m.position.z += dz * 18 * dt; m.rotation.y += 0.9; SP.emit(m.position.x, m.position.y, m.position.z, 0, 0, 0, col(c), 0.2, 0, 0); h.material.opacity = 0.8 * (1 - k); }, end() { dispose(m); } });
  }

  /* ---------- per-frame update ---------- */
  let last = performance.now();
  function loop() {
    requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (let i = V.live.length - 1; i >= 0; i--) { const o = V.live[i]; o.t += dt; const k = Math.min(1, o.t / o.dur); try { if (o.upd) o.upd(k, dt); } catch (e) { /* ignore */ } if (k >= 1) { V.live.splice(i, 1); try { if (o.end) o.end(); } catch (e) { /* ignore */ } } }
    SP.update(dt); GL.update(dt);
    lights.forEach((L) => { if (L.userData.t > 0) { L.userData.t -= dt; L.intensity = L.userData.p * Math.max(0, L.userData.t / L.userData.d); } else L.intensity = 0; });
    const cv = H.cvs; if (shakeT > 0) { shakeT -= dt; const a = shakeA * Math.max(0, shakeT) * 4; cv.style.transform = 'translate(' + rnd(-a, a).toFixed(1) + 'px,' + rnd(-a, a).toFixed(1) + 'px)'; if (shakeT <= 0) { cv.style.transform = ''; shakeA = 0; } }
    watchSelf(dt); watchOthers();
  }
  requestAnimationFrame(loop);

  /* ---------- the player's own attacks and skills ---------- */
  const clsOf = () => (window.AF_CLASS && window.AF_CLASS.prof && window.AF_CLASS.prof.cls) || 'warrior';
  const CC = { warrior: 0xff8a3a, mage: 0x5aa8ff, archer: 0x7ddc8f, assassin: 0xb07cff, healer: 0xffe27a };
  const me = () => ({ x: R.x, y: gy(R.x, R.z), z: R.z, fx: Math.sin(R.facing), fz: Math.cos(R.facing), yaw: R.facing });
  const enemy = (id) => X.enemyById.get(id);
  const eh = (e) => gy(e.x, e.z) + (e.d && e.d.lh ? e.d.lh * 0.45 : 1);
  function hitSparks(ids, c, delay) {
    const go = () => ids.slice(0, 6).forEach((id) => { const e = enemy(id); if (!e) return; const y = eh(e); burst(e.x, y, e.z, c, 16, 6, 0.4, { grav: 6 }); pop(e.x, y, e.z, c, 1.6, 0.18); });
    if (delay) setTimeout(go, delay * 1000); else go();
  }
  function aimPoint(reach, ids) {
    const e = ids && ids.length ? enemy(ids[0]) : null, m = me();
    if (e) return { x: e.x, y: eh(e), z: e.z };
    return { x: m.x + m.fx * reach, y: m.y + 1.1, z: m.z + m.fz * reach };
  }
  const SKILL_FX = {
    atk(ids) { /* warrior / melee basic: three different swings */
      const m = me(), c = CC[clsOf()] || CC.warrior, cb = R.combo | 0, y = m.y + 1.05, px = m.x + m.fx * 0.4, pz = m.z + m.fz * 0.4;
      if (cb === 0) slash(px, y, pz, m.yaw, c, { tilt: 0.55, from: 1.4, to: -1.4, r: 2.0 });
      else if (cb === 1) slash(px, y - 0.15, pz, m.yaw, c, { tilt: -0.15, from: -1.5, to: 1.5, r: 2.2 });
      else { slash(px, y + 0.2, pz, m.yaw, c, { tilt: PI / 2 - 0.1, from: 1.6, to: -1.2, r: 2.4, w: 0.8, sparks: 18, dur: 0.34 }); setTimeout(() => { shock(m.x + m.fx * 1.8, m.z + m.fz * 1.8, c, 0.3, 2.6, 0.4); burst(m.x + m.fx * 1.8, m.y + 0.2, m.z + m.fz * 1.8, 0xd8c8a8, 14, 4, 0.6, { up: 3, grav: 9 }); shake(2.5, 0.15); }, 110); }
      hitSparks(ids, c, 0.08);
    },
    stab(ids) { /* assassin basic: crossing quick cuts */
      const m = me(), c = CC.assassin, y = m.y + 1.0, px = m.x + m.fx * 0.5, pz = m.z + m.fz * 0.5, cb = R.combo | 0;
      slash(px, y, pz, m.yaw, c, { tilt: 0.8, from: 1.2, to: -1.2, r: 1.5, w: 0.35, len: 2, dur: 0.18 });
      setTimeout(() => slash(px, y, pz, m.yaw, 0xffffff, { tilt: -0.8, from: -1.2, to: 1.2, r: 1.5, w: 0.25, len: 2, dur: 0.16, sparks: 6 }), 60);
      if (cb === 2) setTimeout(() => { pop(px + m.fx, y, pz + m.fz, c, 2.4, 0.25); burst(px + m.fx, y, pz + m.fz, c, 20, 7, 0.4); }, 90);
      hitSparks(ids, c, 0.06);
    },
    bolt(ids) { /* mage basic: arcane orb */
      const m = me(), t = aimPoint(14, ids), c = CC.mage; pop(m.x + m.fx * 0.7, m.y + 1.4, m.z + m.fz * 0.7, c, 1.4, 0.2);
      shot(m.x + m.fx * 0.7, m.y + 1.4, m.z + m.fz * 0.7, t.x, t.y, t.z, c, { speed: 30, size: 0.9, onHit: (x, y, z) => { pop(x, y, z, c, 2.4, 0.3); burst(x, y, z, c, 18, 6, 0.45); } });
    },
    arrow(ids) { /* archer basic */
      const m = me(), t = aimPoint(16, ids), c = CC.archer;
      shot(m.x + m.fx * 0.6, m.y + 1.3, m.z + m.fz * 0.6, t.x, t.y, t.z, c, { speed: 46, arrow: true, onHit: (x, y, z) => { burst(x, y, z, c, 12, 5, 0.35); pop(x, y, z, c, 1.2, 0.15); } });
    },
    smite(ids) { /* healer basic: small sunbeam on the target */
      const t = aimPoint(10, ids), c = CC.healer; column(t.x, t.z, c, 0.45, 6, 0.45, { motes: 10 }); shock(t.x, t.z, c, 0.2, 1.6, 0.35); burst(t.x, t.y, t.z, c, 14, 5, 0.4);
    },
    spin(ids) { /* whirlwind */
      const m = me(), c = CC[clsOf()] || CC.warrior;
      for (let i = 0; i < 3; i++) setTimeout(() => slash(R.x, m.y + 0.9 + i * 0.12, R.z, R.facing + i * 2.1, c, { tilt: 0.05, from: -PI, to: PI, r: 3.2, w: 0.75, len: 3.4, dur: 0.38, sparks: 14 }), i * 70);
      shock(m.x, m.z, c, 0.5, 4, 0.45); burst(m.x, m.y + 0.3, m.z, 0xc8b89a, 26, 6, 0.6, { flat: true, grav: 4 }); shake(1.5, 0.15); hitSparks(ids, c, 0.12);
    },
    quake(ids) {
      const m = me(), c = 0xffa040; shake(7, 0.4); flash(m.x, m.y + 1, m.z, c, 4, 0.4);
      shock(m.x, m.z, c, 0.5, 5.5, 0.55); setTimeout(() => shock(m.x, m.z, 0xffd090, 0.5, 4.5, 0.5), 120);
      for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, r = rnd(1.5, 4.5); burst(m.x + Math.cos(a) * r, m.y + 0.1, m.z + Math.sin(a) * r, 0x8a7a64, 3, 3, 0.9, { up: 6, grav: 14 }); }
      burst(m.x, m.y + 0.2, m.z, c, 30, 8, 0.5, { flat: true }); hitSparks(ids, c, 0.1);
    },
    fireball(ids) {
      const m = me(), t = aimPoint(15, ids), c = 0xff6a1a; pop(m.x + m.fx, m.y + 1.4, m.z + m.fz, c, 2, 0.25);
      shot(m.x + m.fx, m.y + 1.4, m.z + m.fz, t.x, t.y, t.z, c, { speed: 22, size: 1.6, smoke: true, arc: 0.6, onHit: (x, y, z) => boom(x, y - 0.6, z, c, 1.1) });
    },
    frost() {
      const m = me(), c = 0x8fd0ff; flash(m.x + m.fx * 3, m.y + 1, m.z + m.fz * 3, c, 3, 0.4);
      for (let i = 0; i < 16; i++) { const d = rnd(1.5, 9), a = R.facing + rnd(-0.55, 0.55) * (1 - d / 14); spike(m.x + Math.sin(a) * d, m.z + Math.cos(a) * d, d * 0.035, rnd(0.7, 1.3)); }
      burst(m.x + m.fx, m.y + 1, m.z + m.fz, c, 40, 10, 0.6, { dir: [m.fx, m.fz], spread: 0.45, up: 0.5, big: false });
    },
    thunder(ids) {
      const m = me(), c = 0xb8a8ff; flash(m.x, m.y + 6, m.z, 0xd8d0ff, 8, 0.4); shake(3, 0.2); shock(m.x, m.z, c, 0.5, 8, 0.4);
      const tg = (ids || []).slice(0, 6).map(enemy).filter(Boolean);
      while (tg.length < 5) { const a = Math.random() * TAU, r = rnd(2, 7.5); tg.push({ x: m.x + Math.cos(a) * r, z: m.z + Math.sin(a) * r, d: null }); }
      tg.forEach((e, i) => setTimeout(() => { const y = gy(e.x, e.z); bolt(e.x + rnd(-1, 1), y + 16, e.z + rnd(-1, 1), e.x, y + 0.2, e.z, c, 0.32); pop(e.x, y + 0.5, e.z, 0xe8e0ff, 2.4, 0.25); burst(e.x, y + 0.4, e.z, c, 14, 6, 0.35); }, i * 60));
    },
    meteor() {
      const m = me(); circle(m.x, m.z, 0xff6a1a, 12, 1.6, { spin: 0.8 });
      for (let i = 0; i < 8; i++) { const a = Math.random() * TAU, r = rnd(1.5, 10); meteor(m.x + Math.cos(a) * r, m.z + Math.sin(a) * r, 0.15 + i * 0.13); }
    },
    pierce() {
      const m = me(), c = CC.archer, ex = m.x + m.fx * 18, ez = m.z + m.fz * 18, y = m.y + 1.3;
      shot(m.x + m.fx * 0.6, y, m.z + m.fz * 0.6, ex, y, ez, c, { speed: 70, arrow: true, size: 1.4 });
      const beam = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 18, 8, 1, true), addMat(c, 0.7)); beam.rotation.x = PI / 2; const piv = new T.Group(); piv.position.set(m.x + m.fx * 9.6, y, m.z + m.fz * 9.6); piv.rotation.y = R.facing; piv.add(beam);
      run({ objs: [piv], dur: 0.35, upd(k) { beam.material.opacity = 0.7 * (1 - k); beam.scale.set(1 + k * 2, 1, 1 + k * 2); }, end() { dispose(piv); } });
      for (let i = 0; i < 18; i++) SP.emit(m.x + m.fx * i, y, m.z + m.fz * i, rnd(-1, 1), rnd(0, 1.5), rnd(-1, 1), col(c), 0.5, 2, 1);
    },
    volley() {
      const m = me(), c = CC.archer; circle(m.x, m.z, c, 8.5, 1.1, { spin: 2 });
      for (let i = 0; i < 26; i++) { const a = Math.random() * TAU, r = rnd(1, 8), x = m.x + Math.cos(a) * r, z = m.z + Math.sin(a) * r, y = gy(x, z); setTimeout(() => shot(x - 2, y + 14, z - 2, x, y + 0.1, z, c, { speed: 40, arrow: true, onHit: (hx, hy, hz) => burst(hx, hy, hz, c, 5, 3, 0.3, { up: 2, grav: 8 }) }), i * 28); }
    },
    stunshot(ids) {
      const m = me(), t = aimPoint(14, ids), c = 0xffe27a;
      shot(m.x + m.fx * 0.6, m.y + 1.3, m.z + m.fz * 0.6, t.x, t.y, t.z, c, { speed: 40, arrow: true, size: 1.2, onHit: (x, y, z) => {
        pop(x, y, z, c, 2.6, 0.3); burst(x, y, z, c, 18, 6, 0.4);
        const g = new T.Group(); for (let i = 0; i < 4; i++) { const s = sprite(c, 0.45, 1, TX.spark); s.position.set(Math.cos(i / 4 * TAU) * 0.6, 0, Math.sin(i / 4 * TAU) * 0.6); g.add(s); } g.position.set(x, y + 1.1, z);
        run({ objs: [g], dur: 1.5, upd(k, dt) { g.rotation.y += dt * 6; g.children.forEach((s) => { s.material.opacity = 1 - k; }); }, end() { dispose(g); } });
      } });
    },
    barrage() {
      const m = me(), c = 0x9cff9c;
      for (let i = 0; i < 9; i++) setTimeout(() => { const a = R.facing + (i - 4) * 0.07, d = 16; shot(m.x + m.fx * 0.6, m.y + 1.3, m.z + m.fz * 0.6, m.x + Math.sin(a) * d, m.y + 1.2, m.z + Math.cos(a) * d, c, { speed: 55, arrow: true, onHit: (x, y, z) => burst(x, y, z, c, 6, 4, 0.3) }); }, i * 45);
      pop(m.x + m.fx, m.y + 1.3, m.z + m.fz, c, 2.2, 0.4); shake(1.5, 0.3);
    },
    backstab(ids) {
      const t = aimPoint(2.8, ids), c = 0xc070ff, m = me();
      slash(t.x, t.y, t.z, m.yaw, c, { tilt: 0.9, from: 1.3, to: -1.3, r: 1.4, w: 0.5, dur: 0.22 }); setTimeout(() => slash(t.x, t.y, t.z, m.yaw, 0xff4a6a, { tilt: -0.9, from: -1.3, to: 1.3, r: 1.4, w: 0.5, dur: 0.22 }), 70);
      setTimeout(() => { pop(t.x, t.y, t.z, 0xff3a5a, 2.8, 0.3); burst(t.x, t.y, t.z, 0xff3a5a, 26, 7, 0.5, { grav: 8 }); shake(2, 0.15); }, 130);
    },
    flurry(ids) {
      const m = me(), c = CC.assassin; for (let i = 0; i < 14; i++) blade(m.x, m.y + 1.0, m.z, i / 14 * TAU + rnd(-0.1, 0.1), c);
      shock(m.x, m.z, c, 0.4, 3.6, 0.35); hitSparks(ids, c, 0.12);
    },
    execute(ids) {
      const t = aimPoint(3, ids), m = me(), c = 0xff2a3a;
      slash(t.x, t.y + 0.4, t.z, m.yaw, c, { tilt: PI / 2, from: 1.7, to: -1.4, r: 2.8, w: 1.0, dur: 0.4, sparks: 26 });
      setTimeout(() => { boom(t.x, gy(t.x, t.z), t.z, c, 0.9); slash(t.x, t.y, t.z, m.yaw + PI / 2, 0xffffff, { tilt: 0, from: -1.5, to: 1.5, r: 2.2, w: 0.3, dur: 0.25 }); }, 160);
    },
    holy(ids) {
      const t = aimPoint(12, ids), c = 0xffe9a0; column(t.x, t.z, c, 1.1, 14, 0.8, { motes: 30, shrink: true }); circle(t.x, t.z, c, 3, 0.8);
      setTimeout(() => { pop(t.x, gy(t.x, t.z) + 0.6, t.z, 0xffffff, 3.4, 0.3); burst(t.x, gy(t.x, t.z) + 0.4, t.z, c, 30, 7, 0.6, { up: 5, grav: 4 }); flash(t.x, gy(t.x, t.z) + 2, t.z, c, 5, 0.4); }, 120);
    }
  };
  const SUPPORT_FX = {
    bulwark() { const m = me(); dome(0x8fc0ff, 8); shock(m.x, m.z, 0x8fc0ff, 0.5, 3, 0.5); burst(m.x, m.y + 1, m.z, 0xbfe0ff, 26, 5, 0.6); flash(m.x, m.y + 2, m.z, 0x8fc0ff, 3, 0.4); },
    vanish() { const m = me(); smoke(m.x, m.y, m.z, 9, 0x4a4458); burst(m.x, m.y + 1, m.z, 0x9a7cff, 20, 4, 0.6, { big: true }); },
    heal() {
      const m = me(), c = 0x7dffa0; circle(m.x, m.z, c, 14, 1.4, { spin: 0.6 }); column(m.x, m.z, c, 1.0, 7, 1.0, { motes: 40 }); flash(m.x, m.y + 2, m.z, c, 4, 0.5);
      (H.others ? Array.from(H.others.values ? H.others.values() : []) : []).forEach((o) => { if (o && Math.hypot(o.x - m.x, o.z - m.z) < 14) column(o.x, o.z, c, 0.8, 5, 0.9, { motes: 18 }); });
    },
    bless() { const m = me(), c = 0xffd76a; circle(m.x, m.z, c, 14, 1.6, { spin: -1.2 }); circle(m.x, m.z, c, 4, 12, { follow: true, spin: 0.8 }); burst(m.x, m.y + 0.5, m.z, c, 40, 3, 1.4, { up: 5, grav: -1, big: false }); flash(m.x, m.y + 2, m.z, c, 4, 0.5); },
    revive() { const m = me(), c = 0xffffff; column(m.x + m.fx * 3, m.z + m.fz * 3, c, 1.4, 20, 1.6, { motes: 50 }); circle(m.x + m.fx * 3, m.z + m.fz * 3, 0xffe9a0, 4, 1.6); flash(m.x, m.y + 3, m.z, 0xffffff, 6, 0.6); }
  };
  V.SKILL_FX = SKILL_FX; V.SUPPORT_FX = SUPPORT_FX;

  /* replace the old thin tracer */
  const C = window.AF_CLASS;
  function onFx(kind, ids) {
    ids = ids || [];
    const f = SKILL_FX[kind]; if (!f) return;
    const basic = /^(atk|stab|bolt|arrow|smite)$/.test(kind);
    if (!basic && kind !== 'spin' && !ids.length) return; // the skill found no target: classes.js cancels it, so no effect
    try { f(ids); } catch (e) { console.error('[vfx ' + kind + ']', e); }
  }
  if (C) C.fx = onFx; else window.AF_CLASS = { fx: onFx };
  /* support skills leave through the network */
  const N = H.NET;
  if (N && typeof N.send === 'function') { const s0 = N.send; N.send = function (m) { try { if (m && m.t === 'skill' && SUPPORT_FX[m.id]) SUPPORT_FX[m.id](); } catch (e) { /* ignore */ } return s0.apply(this, arguments); }; }

  /* dash trail and dodge dust, read from the player state */
  let wasDash = false, wasDodge = false;
  function watchSelf() {
    if (!H.isRunning()) return;
    const dash = R.dashT >= 0, dodge = R.dodgeT >= 0, m = me(), c = CC[clsOf()] || CC.warrior;
    if (dash) { for (let i = 0; i < 4; i++) GL.emit(m.x + rnd(-0.3, 0.3), m.y + rnd(0.4, 1.6), m.z + rnd(-0.3, 0.3), -m.fx * 2, rnd(0, 0.6), -m.fz * 2, col(c), 0.35, 0, 3); if (!wasDash) { shock(m.x, m.z, c, 0.3, 2.2, 0.3); burst(m.x, m.y + 0.2, m.z, 0xc8b89a, 16, 5, 0.5, { flat: true, grav: 3 }); } }
    if (!dash && wasDash) slash(m.x + m.fx * 0.6, m.y + 1, m.z + m.fz * 0.6, m.yaw, c, { tilt: 0.1, from: -1.4, to: 1.4, r: 2.1 });
    if (dodge && !wasDodge) { burst(m.x, m.y + 0.15, m.z, 0xb8a890, 18, 4, 0.55, { flat: true, grav: 2 }); smoke(m.x, m.y, m.z, 3, 0x8a8070); }
    wasDash = dash; wasDodge = dodge;
  }
  /* other players: effects from their animation codes (2 attack, 3 spin, 7 dash) */
  const seen = new Map();
  function watchOthers() {
    if (!H.isRunning() || !H.others) return;
    H.others.forEach((o) => {
      if (!o) return; const an = o.anim | 0, prev = seen.get(o.id); seen.set(o.id, an);
      if (prev === an || Math.hypot(o.x - R.x, o.z - R.z) > 40) return;
      const y = gy(o.x, o.z), f = o.f != null ? o.f : 0, fx = Math.sin(f), fz = Math.cos(f);
      if (an === 2) slash(o.x + fx * 0.4, y + 1.05, o.z + fz * 0.4, f, 0xffb070, { tilt: rnd(-0.6, 0.6), from: 1.3, to: -1.3, r: 1.8, sparks: 5 });
      else if (an === 3) { slash(o.x, y + 0.9, o.z, f, 0xffb070, { tilt: 0.05, from: -PI, to: PI, r: 3, w: 0.7, len: 3.4, dur: 0.36 }); shock(o.x, o.z, 0xffb070, 0.5, 3.6, 0.4); }
      else if (an === 7) shock(o.x, o.z, 0xffb070, 0.3, 2, 0.3);
    });
  }
  console.log('[vfx] da nap hieu ung ky nang');
})();
