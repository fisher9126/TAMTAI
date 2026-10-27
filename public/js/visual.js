/* Aetherfall visuals, step 1 (v2): a proper character rig + class weapons + full animation set.
   The game's character is a stiff doll: one-piece arms and legs, no elbows or knees. This file upgrades every humanoid it sees
   (you and other players) WITHOUT touching the game's own files:
     - adds elbows, knees, ankles, and a waist (the upper body can lean and twist on its own),
     - replaces the pose every frame (scene.onBeforeRender, same trick as move.js) with real cycles:
       idle breathing, walk, run, attack combos per class, skills, dash, dodge tuck, death slump, riding a mount,
     - keeps the feet on the ground when the knees bend (the body lowers automatically),
     - gives each class its own weapon: Warrior sword+shield, Mage orb staff, Archer bow+quiver, Assassin dual daggers, Healer halo staff.
   Rules are untouched. If anything throws, this file switches itself off and the old look comes back.
   Other players: the class comes from app.cls (server/character.js). Quality: window.AF_VISUAL.setQuality(0|1|2). */
(function () {
  'use strict';
  const H = window.AF_CH, X = window.AF_CHX, T = window.THREE, C = window.AF_CLASS;
  if (!H || !X || !T || !C) { console.warn('[visual] thieu AF_CH/AF_CHX/THREE/AF_CLASS, bo qua'); return; }
  const V = window.AF_VISUAL = { vis: new WeakMap(), off: false, rigOf: (Hm) => rigOf(Hm) };
  const PI = Math.PI, sin = Math.sin, cos = Math.cos, lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  let Q = 2; try { const s = localStorage.getItem('af-q'); if (s != null) Q = clamp(+s | 0, 0, 2); } catch (e) { /* no storage */ }
  V.setQuality = (n) => { Q = clamp(n | 0, 0, 2); try { localStorage.setItem('af-q', String(Q)); } catch (e) { /* ignore */ } };
  V.quality = () => Q;

  const RC = { common: 0x9ea5b0, rare: 0x3f8ad6, epic: 0x8f60d4, legend: 0xe08a2a };
  const RI = { common: 0.12, rare: 0.4, epic: 0.8, legend: 1.3 };
  const CLSCOL = { warrior: 0xe0733f, mage: 0x6fa8ff, archer: 0x79d08a, assassin: 0xb48cff, healer: 0xffe27a };

  /* ---------- small helpers ---------- */
  const mat = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.55, metalness: 0.35 }, o || {}));
  const mesh = (g, m) => { const x = new T.Mesh(g, m); x.castShadow = true; return x; };
  const put = (parent, m, x, y, z) => { m.position.set(x || 0, y || 0, z || 0); parent.add(m); return m; };
  const Yv = new T.Vector3(0, 1, 0), _d = new T.Vector3();
  function unitSeg(r, m, sides) { return mesh(new T.CylinderGeometry(r, r, 1, sides || 5), m); }
  function place(s, a, b) { _d.subVectors(b, a); const len = _d.length() || 1e-4; s.position.copy(a).addScaledVector(_d, 0.5); s.quaternion.setFromUnitVectors(Yv, _d.divideScalar(len)); s.scale.set(1, len, 1); }
  let gt = null;
  function glowTex() {
    if (gt) return gt; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); gt = new T.CanvasTexture(c); return gt;
  }
  function accent(k) { const m = mat(0x9ea5b0, { emissive: 0x9ea5b0, emissiveIntensity: 0.12, metalness: 0.6, roughness: 0.3 }); k.acc.push(m); return m; }
  function glowAdd(k, parent, x, y, z, size, always) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: 0xffffff, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.85 }));
    s.scale.setScalar(size); s.position.set(x, y, z); parent.add(s); k.glows.push({ s, base: size, always: !!always }); return s;
  }

  /* ---------- RIG: add elbows / knees / ankles / waist to the game's one-piece doll ---------- */
  function rigOf(Hm) {
    if (Hm.rig !== undefined) return Hm.rig;
    Hm.rig = null;
    const inner = Hm.inner, torso = Hm.armorSlot && Hm.armorSlot.parent;
    if (!inner || !torso || !Hm.arms || !Hm.legs || Hm.arms.length < 2 || Hm.legs.length < 2 || !Hm.headG) return null;
    const isGeo = (o, t) => o.isMesh && o.geometry && o.geometry.type === t;
    const upper = new T.Group(); upper.position.y = 1.0; inner.add(upper);
    [torso, Hm.headG].forEach((o) => { inner.remove(o); o.position.y -= 1.0; upper.add(o); });
    const R = { upper, el: [], kn: [], an: [] };
    for (let i = 0; i < 2; i++) {
      const a = Hm.arms[i]; inner.remove(a); a.position.y -= 1.0; upper.add(a);
      const kids = a.children.slice(), top = kids.find((o) => isGeo(o, 'CylinderGeometry')), hand = kids.find((o) => isGeo(o, 'SphereGeometry'));
      const el = new T.Group(); el.position.y = -0.3; a.add(el);
      if (top) { top.scale.y = 0.5; top.position.y = -0.15; }
      if (hand) {
        const fa = mesh(new T.CylinderGeometry(0.105, 0.085, 0.31, 8), hand.material); fa.position.y = -0.155; el.add(fa);
        a.remove(hand); hand.position.set(0, -0.34, 0); el.add(hand);
      }
      if (i === 1 && Hm.weaponSlot) { a.remove(Hm.weaponSlot); Hm.weaponSlot.position.y = -0.34; el.add(Hm.weaponSlot); }
      R.el.push(el);
    }
    for (let i = 0; i < 2; i++) {
      const l = Hm.legs[i], kids = l.children.slice(), thigh = kids.find((o) => isGeo(o, 'CylinderGeometry')), foot = kids.find((o) => isGeo(o, 'BoxGeometry'));
      const kn = new T.Group(); kn.position.y = -0.31; l.add(kn);
      if (thigh) { thigh.scale.y = 0.5; thigh.position.y = -0.155; const sh = mesh(new T.CylinderGeometry(0.125, 0.105, 0.33, 8), thigh.material); sh.position.y = -0.165; kn.add(sh); }
      const an = new T.Group(); an.position.y = -0.33; kn.add(an);
      if (foot) { l.remove(foot); foot.position.set(0, -0.015, 0.05); an.add(foot); }
      const bs = Hm.bootSlots && Hm.bootSlots[i]; if (bs) { l.remove(bs); bs.position.set(0, -0.25, 0); kn.add(bs); }
      R.kn.push(kn); R.an.push(an);
    }
    Hm.rig = R; return R;
  }

  /* ---------- weapon builders: each fills k.rh (right hand) and/or k.lh (left hand); +y is the weapon direction ---------- */
  const BUILD = {
    warrior(k) {
      const steel = mat(0xd5dbe5, { metalness: 0.85, roughness: 0.25 }), gold = mat(0xd9b04c, { metalness: 0.8, roughness: 0.3 }), leather = mat(0x4a2f1c, { roughness: 0.9, metalness: 0 }), acc = accent(k), g = k.rh;
      put(g, mesh(new T.CylinderGeometry(0.045, 0.045, 0.3, 8), leather), 0, -0.02, 0);
      put(g, mesh(new T.SphereGeometry(0.07, 10, 8), gold), 0, -0.2, 0);
      put(g, mesh(new T.BoxGeometry(0.58, 0.08, 0.13), gold), 0, 0.15, 0);
      [-1, 1].forEach((s) => put(g, mesh(new T.SphereGeometry(0.06, 8, 6), gold), s * 0.29, 0.15, 0));
      put(g, mesh(new T.BoxGeometry(0.15, 1.3, 0.045), steel), 0, 0.84, 0);
      put(g, mesh(new T.BoxGeometry(0.04, 1.05, 0.055), acc), 0, 0.82, 0);
      const tip = put(g, mesh(new T.ConeGeometry(0.075, 0.24, 4), steel), 0, 1.6, 0); tip.rotation.y = PI / 4; tip.scale.z = 0.35;
      glowAdd(k, g, 0, 0.9, 0.05, 1.5, false);
      const sh = new T.Group(); k.lh.add(sh); sh.position.set(0.1, 0.15, 0.22);
      const disc = put(sh, mesh(new T.CylinderGeometry(0.42, 0.42, 0.07, 22), mat(0x2b3a5c, { metalness: 0.5 })), 0, 0, 0); disc.rotation.x = PI / 2;
      put(sh, mesh(new T.TorusGeometry(0.42, 0.04, 6, 24), gold), 0, 0, 0.02);
      put(sh, mesh(new T.SphereGeometry(0.1, 10, 8), gold), 0, 0, 0.07);
      put(sh, mesh(new T.BoxGeometry(0.09, 0.56, 0.03), acc), 0, 0, 0.045);
      put(sh, mesh(new T.BoxGeometry(0.56, 0.09, 0.03), acc), 0, 0.02, 0.045);
    },
    mage(k) {
      const wood = mat(0x5a3a22, { roughness: 0.85, metalness: 0 }), gold = mat(0xd9b04c, { metalness: 0.8, roughness: 0.3 }), acc = accent(k), g = k.rh;
      put(g, mesh(new T.CylinderGeometry(0.04, 0.052, 2.15, 8), wood), 0, 0.5, 0);
      [-0.5, 0.2, 1.4].forEach((y) => { const r = put(g, mesh(new T.TorusGeometry(0.058, 0.014, 5, 10), gold), 0, y, 0); r.rotation.x = PI / 2; });
      for (let i = 0; i < 4; i++) { const a = i * PI / 2, c = put(g, mesh(new T.ConeGeometry(0.035, 0.46, 5), wood), cos(a) * 0.1, 1.62, sin(a) * 0.1); c.rotation.x = sin(a) * 0.32; c.rotation.z = -cos(a) * 0.32; }
      put(g, mesh(new T.SphereGeometry(0.14, 16, 12), acc), 0, 1.63, 0);
      glowAdd(k, g, 0, 1.63, 0, 1.0, true);
      for (let i = 0; i < 3; i++) { const m = put(g, mesh(new T.SphereGeometry(0.032, 8, 6), acc), 0, 1.63, 0); k.spin.push({ m, r: 0.27, ph: i * 2.09, sp: 2.6, y: 1.63 }); }
    },
    healer(k, Hm) {
      const wood = mat(0xe8e0c8, { roughness: 0.6, metalness: 0.1 }), gold = mat(0xe3bf5a, { metalness: 0.85, roughness: 0.25 }), acc = accent(k), g = k.rh;
      put(g, mesh(new T.CylinderGeometry(0.04, 0.05, 1.95, 8), wood), 0, 0.4, 0);
      put(g, mesh(new T.TorusGeometry(0.21, 0.032, 8, 24), gold), 0, 1.5, 0);
      put(g, mesh(new T.BoxGeometry(0.07, 0.3, 0.05), acc), 0, 1.5, 0);
      put(g, mesh(new T.BoxGeometry(0.22, 0.07, 0.05), acc), 0, 1.54, 0);
      [-1, 1].forEach((s) => { const w = put(g, mesh(new T.ConeGeometry(0.06, 0.4, 4), gold), s * 0.3, 1.36, 0); w.rotation.z = s * 1.25; });
      glowAdd(k, g, 0, 1.5, 0, 1.2, true);
      const halo = new T.Mesh(new T.TorusGeometry(0.4, 0.022, 6, 28), new T.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false }));
      halo.rotation.x = PI / 2; Hm.headG.add(halo); halo.position.y = 0.88; k.extras.push({ obj: halo, parent: Hm.headG });
      k.tickExtra = (s) => { halo.rotation.z = s.t * 0.9; halo.position.y = 0.88 + sin(s.t * 2) * 0.03; halo.visible = Q > 0; };
    },
    archer(k, Hm) {
      const wood = mat(0x7a5232, { roughness: 0.8, metalness: 0 }), leather = mat(0x4a2f1c, { roughness: 0.9, metalness: 0 }), acc = accent(k), g = k.lh;
      const N = 12, pts = [];
      for (let i = 0; i <= N; i++) { const s = (i / N) * 2 - 1; pts.push(new T.Vector3(0, s * 0.85, 0.2 * (1 - s * s) - 0.2)); }
      for (let i = 0; i < N; i++) { const s = unitSeg(0.036 * (1 - Math.abs(i / N * 2 - 1) * 0.35), wood, 6); place(s, pts[i], pts[i + 1]); g.add(s); }
      put(g, mesh(new T.CylinderGeometry(0.052, 0.052, 0.3, 8), leather), 0, 0, 0);
      [0, N].forEach((i) => put(g, mesh(new T.SphereGeometry(0.045, 8, 6), acc), pts[i].x, pts[i].y, pts[i].z));
      const strM = new T.MeshBasicMaterial({ color: 0xf2ead0 });
      const s1 = unitSeg(0.008, strM, 3), s2 = unitSeg(0.008, strM, 3); g.add(s1); g.add(s2);
      const arrow = new T.Group(); g.add(arrow);
      const sh = unitSeg(0.014, mat(0xcaa66a, { roughness: 0.8, metalness: 0 })); arrow.add(sh);
      const head = mesh(new T.ConeGeometry(0.04, 0.14, 4), mat(0xd5dbe5, { metalness: 0.8 })); head.rotation.x = PI / 2; arrow.add(head);
      const fl = mesh(new T.BoxGeometry(0.1, 0.002, 0.14), acc); arrow.add(fl);
      k.bow = { top: pts[N], bot: pts[0], s1, s2, sh, head, fl, arrow, zs: -0.2, P: new T.Vector3() };
      const torso = Hm.armorSlot && Hm.armorSlot.parent;
      if (torso) {
        const qv = new T.Group(); qv.position.set(-0.16, 0.08, -0.5); qv.rotation.z = 0.35; torso.add(qv);
        qv.add(mesh(new T.CylinderGeometry(0.1, 0.085, 0.72, 10), leather));
        for (let i = 0; i < 3; i++) { const a = put(qv, mesh(new T.CylinderGeometry(0.012, 0.012, 0.3, 4), wood), (i - 1) * 0.04, 0.5, 0); const f = put(qv, mesh(new T.BoxGeometry(0.05, 0.12, 0.004), acc), (i - 1) * 0.04, 0.62, 0); a.rotation.z = (i - 1) * 0.08; f.rotation.z = a.rotation.z; }
        k.extras.push({ obj: qv, parent: torso });
      }
    },
    assassin(k) {
      const steel = mat(0xb8c0cc, { metalness: 0.9, roughness: 0.2 }), dark = mat(0x23202c, { roughness: 0.6, metalness: 0.4 }), acc = accent(k);
      [k.rh, k.lh].forEach((g) => {
        put(g, mesh(new T.CylinderGeometry(0.036, 0.036, 0.22, 8), dark), 0, -0.02, 0);
        put(g, mesh(new T.SphereGeometry(0.05, 8, 6), dark), 0, -0.14, 0);
        put(g, mesh(new T.BoxGeometry(0.22, 0.05, 0.075), dark), 0, 0.1, 0);
        put(g, mesh(new T.BoxGeometry(0.085, 0.62, 0.03), steel), 0, 0.43, 0);
        put(g, mesh(new T.BoxGeometry(0.022, 0.55, 0.036), acc), 0, 0.43, 0);
        const t = put(g, mesh(new T.ConeGeometry(0.044, 0.2, 4), steel), 0, 0.84, 0); t.rotation.y = PI / 4; t.scale.z = 0.4;
        glowAdd(k, g, 0, 0.5, 0.03, 0.8, false);
      });
    }
  };

  /* ---------- animation: targets are written every frame, then smoothed ---------- */
  const KEYS = ['lsx', 'lsz', 'lex', 'rsx', 'rsz', 'rex', 'ltx', 'ltz', 'lkx', 'rtx', 'rtz', 'rkx', 'twist', 'lean', 'hx', 'hy', 'tz', 'air', 'rr', 'lr', 'aimR', 'aimL'];
  const newJ = () => { const J = {}; KEYS.forEach((k) => { J[k] = 0; }); return J; };
  function resetT(t) { KEYS.forEach((k) => { t[k] = 0; }); t.mR = 0; t.mL = 0; t.pull = 0; t.nock = false; }
  function kf(p, pts) {
    if (p <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (p <= pts[i][0]) { const a = pts[i - 1], b = pts[i], u = (p - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * u * u * (3 - 2 * u); }
    return pts[pts.length - 1][1];
  }

  /* walk / run / idle for everybody */
  function loco(v, s, t, tm) {
    const sp = s.spd, mv = sp > 0.8, run = sp > 7.2, ph = v.ph, S = sin(ph), Cc = cos(ph);
    if (!mv) {
      const b = sin(tm * 1.6 + v.seed);
      t.lsx = 0.04 + b * 0.02; t.rsx = 0.04 - b * 0.02; t.lsz = 0.07; t.rsz = -0.07; t.lex = -0.2 - b * 0.03; t.rex = -0.2 - b * 0.03;
      t.ltx = -0.03; t.rtx = 0.03; t.lkx = 0.06; t.rkx = 0.06; t.hy = sin(tm * 0.45 + v.seed) * 0.25; t.hx = sin(tm * 0.3 + v.seed) * 0.04; t.lean = 0.02 + b * 0.01; t.twist = sin(tm * 0.8 + v.seed) * 0.03;
    } else {
      const A = clamp(0.28 + sp * 0.055, 0.3, 0.95), B = A * (run ? 1.15 : 0.8), K = run ? 1.55 : 0.95;
      t.ltx = -S * A; t.rtx = S * A; t.lkx = 0.08 + Math.max(0, Cc) * K; t.rkx = 0.08 + Math.max(0, -Cc) * K;
      t.lsx = S * B; t.rsx = -S * B; t.lsz = 0.08; t.rsz = -0.08;
      if (run) { t.lex = -1.3 + S * 0.25; t.rex = -1.3 - S * 0.25; } else { t.lex = -0.25 - Math.max(0, -S) * 0.4; t.rex = -0.25 - Math.max(0, S) * 0.4; }
      t.twist = S * (run ? 0.24 : 0.1); t.lean = run ? 0.28 : 0.07; t.hy = -t.twist * 0.8; t.tz = -S * 0.03;
    }
  }
  function dodgePose(t) { t.lsx = t.rsx = -1.3; t.lex = t.rex = -2.0; t.ltx = t.rtx = -1.4; t.lkx = t.rkx = 1.8; t.lean = 0.5; }
  function deadPose(t) { t.lsx = 0.25; t.rsx = 0.15; t.lsz = 0.3; t.rsz = -0.3; t.lex = -0.3; t.rex = -0.4; t.ltx = -0.2; t.rtx = 0.1; t.lkx = 0.3; t.rkx = 0.2; t.hx = 0.3; }
  function mountedPose(t, fast) {
    t.ltx = t.rtx = -0.85; t.lkx = t.rkx = 0.95; t.ltz = 0.32; t.rtz = -0.32;
    t.lsx = t.rsx = -0.8; t.lex = t.rex = -0.9; t.lsz = 0.1; t.rsz = -0.1; t.lean = 0.04 + fast * 0.12; t.twist = 0; t.tz = 0;
  }

  /* class poses: hold() = how the weapon is carried; atk() = basic attack p in 0..1; skill() = spin / dash */
  const CP = {
    warrior: {
      hold(t, s) { t.rr = 1.1; t.lsx = -0.45; t.lex = -1.0; t.lsz = 0.15; if (s.spd <= 0.8) { t.rsx = -0.3; t.rex = -0.55; } },
      atk(t, p, c) {
        if (c === 0) {
          t.rsx = kf(p, [[0, -0.5], [0.28, -2.8], [0.5, -0.15], [1, -0.4]]); t.rex = kf(p, [[0, -0.6], [0.28, -0.8], [0.5, -0.1], [1, -0.5]]); t.rsz = -0.12;
          t.twist = kf(p, [[0, 0], [0.28, -0.45], [0.5, 0.5], [1, 0]]); t.lean = kf(p, [[0, 0], [0.28, -0.12], [0.5, 0.4], [1, 0.05]]);
          t.ltx = kf(p, [[0, 0], [0.28, 0.15], [0.5, -0.6], [1, 0]]); t.lkx = kf(p, [[0, 0.1], [0.5, 0.5], [1, 0.1]]); t.rtx = kf(p, [[0, 0], [0.5, 0.4], [1, 0]]); t.rkx = kf(p, [[0, 0.1], [0.5, 0.6], [1, 0.1]]);
          t.lsx = -0.9; t.lex = -1.0;
        } else if (c === 1) {
          t.rsx = -1.5; t.rsz = kf(p, [[0, -1.3], [0.25, -1.7], [0.55, 1.2], [1, 0.4]]); t.rex = kf(p, [[0, -0.5], [0.55, -0.15], [1, -0.4]]);
          t.twist = kf(p, [[0, 0], [0.25, 0.65], [0.55, -0.75], [1, 0]]); t.lean = 0.18; t.ltx = kf(p, [[0, 0], [0.55, -0.4], [1, 0]]); t.rtx = kf(p, [[0, 0], [0.55, 0.3], [1, 0]]); t.lkx = t.rkx = 0.35; t.lsx = -0.6; t.lex = -1.2;
        } else {
          t.rsx = kf(p, [[0, -0.4], [0.35, -3.0], [0.6, -0.1], [1, -0.3]]); t.rex = kf(p, [[0, -0.5], [0.35, -0.5], [0.6, -0.05], [1, -0.4]]);
          t.lsx = kf(p, [[0, -0.9], [0.35, -2.7], [0.6, -0.4], [1, -0.9]]); t.lex = kf(p, [[0, -1.0], [0.35, -0.5], [0.6, -0.5], [1, -1.0]]);
          t.air = sin(clamp(p / 0.7, 0, 1) * PI) * 0.4; t.lkx = t.rkx = kf(p, [[0, 0.1], [0.35, 1.0], [0.65, 0.6], [1, 0.1]]);
          t.ltx = kf(p, [[0, 0], [0.35, -0.9], [0.65, -0.3], [1, 0]]); t.rtx = kf(p, [[0, 0], [0.35, -0.5], [0.65, 0.2], [1, 0]]); t.lean = kf(p, [[0, 0], [0.35, -0.15], [0.65, 0.45], [1, 0.05]]);
        }
      },
      skill(t, s) {
        if (s.dash) { t.lean = 0.5; t.rsx = -1.7; t.rex = -0.1; t.lsx = -0.5; t.lex = -1.0; t.ltx = -0.7; t.rtx = 0.6; t.lkx = 0.4; t.rkx = 1.0; }
        else { t.rsx = -1.5; t.rsz = -1.3; t.rex = -0.1; t.lsx = -1.5; t.lsz = 1.3; t.lex = -0.1; t.lkx = t.rkx = 0.5; t.ltx = t.rtx = -0.2; }
      }
    },
    mage: {
      hold(t, s) { t.mR = 1; t.aimR = 0.08; t.rsx = -0.35; t.rex = -0.6; t.rsz = -0.1; },
      atk(t, p) {
        t.mR = 1;
        t.rsx = kf(p, [[0, -0.7], [0.3, -1.0], [0.55, -1.5], [1, -0.4]]); t.rex = kf(p, [[0, -1.0], [0.3, -1.5], [0.55, -0.12], [1, -0.6]]);
        t.lsx = kf(p, [[0, -0.5], [0.3, -1.1], [0.55, -1.5], [1, -0.4]]); t.lsz = kf(p, [[0, 0.2], [0.4, -0.3], [1, 0.2]]); t.lex = kf(p, [[0, -0.8], [0.55, -0.15], [1, -0.7]]);
        t.lean = kf(p, [[0, 0], [0.3, -0.12], [0.55, 0.18], [1, 0]]); t.twist = kf(p, [[0, 0.2], [0.55, -0.15], [1, 0]]);
        t.aimR = kf(p, [[0, 0.1], [0.3, 0.2], [0.55, 1.2], [1, 0.1]]);
      },
      skill(t) { t.mR = 1; t.aimR = 0; t.rsx = t.lsx = -2.7; t.rsz = -0.35; t.lsz = 0.35; t.rex = t.lex = -0.2; t.lean = -0.12; t.lkx = t.rkx = 0.2; }
    },
    healer: {
      hold(t) { t.mR = 1; t.aimR = 0.05; t.rsx = -0.35; t.rex = -0.6; t.rsz = -0.1; },
      atk(t, p) {
        t.mR = 1;
        t.rsx = kf(p, [[0, -0.4], [0.4, -2.5], [0.65, -2.2], [1, -0.4]]); t.rex = kf(p, [[0, -0.6], [0.4, -0.5], [1, -0.6]]);
        t.lsx = kf(p, [[0, -0.4], [0.4, -1.5], [1, -0.4]]); t.lsz = 0.5; t.lex = -0.6; t.aimR = kf(p, [[0, 0.05], [0.4, 0.1], [0.65, 0.9], [1, 0.05]]);
        t.lean = kf(p, [[0, 0], [0.4, -0.15], [0.65, 0.12], [1, 0]]);
      },
      skill(t) { t.mR = 1; t.aimR = 0; t.rsx = t.lsx = -2.4; t.rsz = -0.8; t.lsz = 0.8; t.rex = t.lex = -0.3; t.lean = -0.1; t.lkx = t.rkx = 0.15; }
    },
    archer: {
      hold(t) { t.mL = 1; t.aimL = 0; t.lsx = -0.7; t.lex = -0.5; t.lsz = 0.1; },
      atk(t, p) {
        const d = clamp(p / 0.68, 0, 1), rel = p >= 0.7, rr = clamp((p - 0.7) / 0.3, 0, 1);
        t.mL = 1; t.aimL = 0; t.lsx = -1.55; t.lsz = -0.2; t.lex = -0.08;
        t.rsx = -1.35; t.rsz = rel ? lerp(1.0, 0.3, rr) : lerp(0.2, 1.0, d); t.rex = rel ? lerp(-0.9, -0.3, rr) : lerp(-0.2, -0.9, d);
        t.twist = -0.3; t.hy = 0.35; t.lean = 0.03; t.ltx = -0.25; t.rtx = 0.25; t.lkx = t.rkx = 0.15;
        t.pull = rel ? Math.max(0, 0.15 * sin((p - 0.7) * 60)) : d * 0.5; t.nock = !rel;
      },
      skill(t) { this.atk(t, 0.55); }
    },
    assassin: {
      hold(t, s) {
        t.lean = 0.22; t.rr = 1.3; t.lr = 1.3; t.lsx = t.rsx = -0.8; t.lex = t.rex = -1.4; t.lsz = 0.1; t.rsz = -0.1;
        if (s.spd <= 0.8) { t.ltx = -0.15; t.rtx = 0.15; t.lkx = t.rkx = 0.35; }
      },
      atk(t, p, c) {
        if (c === 0) {
          t.rsx = kf(p, [[0, -0.6], [0.2, -0.3], [0.45, -1.6], [1, -0.7]]); t.rex = kf(p, [[0, -1.3], [0.2, -1.9], [0.45, -0.08], [1, -1.3]]);
          t.twist = kf(p, [[0, 0], [0.2, 0.4], [0.45, -0.35], [1, 0]]); t.lean = kf(p, [[0, 0.2], [0.45, 0.5], [1, 0.22]]);
        } else if (c === 1) {
          t.lsx = kf(p, [[0, -0.6], [0.2, -0.3], [0.45, -1.6], [1, -0.7]]); t.lex = kf(p, [[0, -1.3], [0.2, -1.9], [0.45, -0.08], [1, -1.3]]);
          t.twist = kf(p, [[0, 0], [0.2, -0.4], [0.45, 0.35], [1, 0]]); t.lean = kf(p, [[0, 0.2], [0.45, 0.5], [1, 0.22]]);
        } else {
          t.rsx = t.lsx = -1.4; t.rsz = kf(p, [[0, -1.0], [0.2, -1.3], [0.5, 0.8], [1, 0.1]]); t.lsz = kf(p, [[0, 1.0], [0.2, 1.3], [0.5, -0.8], [1, -0.1]]);
          t.rex = t.lex = -0.5; t.twist = kf(p, [[0, 0.6], [0.5, -0.7], [1, 0]]); t.lean = 0.4;
        }
        t.ltx = kf(p, [[0, -0.15], [0.45, -0.6], [1, -0.15]]); t.rtx = kf(p, [[0, 0.15], [0.45, 0.4], [1, 0.15]]); t.lkx = t.rkx = 0.5;
      },
      skill(t, s, tm) {
        if (s.dash) { t.lean = 0.6; t.rsx = t.lsx = 0.6; t.rex = t.lex = -0.3; t.ltx = -0.9; t.rtx = 0.7; t.lkx = 0.5; t.rkx = 1.2; return; }
        const f = sin(tm * 22);
        t.rsx = -0.9 - 0.7 * Math.max(0, f); t.rex = -1.3 + 1.1 * Math.max(0, f); t.lsx = -0.9 - 0.7 * Math.max(0, -f); t.lex = -1.3 + 1.1 * Math.max(0, -f);
        t.lean = 0.35; t.twist = f * 0.25; t.lkx = t.rkx = 0.5;
      }
    }
  };

  /* ---------- build / destroy / rarity ---------- */
  function destroy(v, Hm) {
    const k = v.k;
    [k.rh, k.lh].forEach((g) => { if (g.parent) g.parent.remove(g); g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); });
    k.extras.forEach((e) => { if (e.parent) e.parent.remove(e.obj); e.obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); });
    if (v.slash) { if (v.slash.parent) v.slash.parent.remove(v.slash); v.slash.geometry.dispose(); }
    V.vis.delete(Hm);
  }
  function build(Hm, cls) {
    const old = V.vis.get(Hm); if (old) destroy(old, Hm);
    const R = rigOf(Hm);
    const k = { rh: new T.Group(), lh: new T.Group(), acc: [], glows: [], spin: [], extras: [], bow: null, tickExtra: null };
    if (cls && BUILD[cls]) {
      if (R) { R.el[1].add(k.rh); k.rh.position.set(0, -0.34, 0); R.el[0].add(k.lh); k.lh.position.set(0, -0.34, 0); }
      else { Hm.arms[1].add(k.rh); k.rh.position.set(0, -0.64, 0); Hm.arms[0].add(k.lh); k.lh.position.set(0, -0.64, 0); }
      BUILD[cls](k, Hm);
      if (Hm.weaponSlot) Hm.weaponSlot.visible = false;
    }
    const col = CLSCOL[cls] || 0xffffff;
    const sl = new T.Mesh(new T.RingGeometry(0.5, 1.35, 28, 1, 0, 2.0), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: T.AdditiveBlending, side: T.DoubleSide, depthWrite: false }));
    sl.visible = false; Hm.root.add(sl);
    const v = { cls, k, col, rar: undefined, flash: 0, lastAtk: -1, lastSpin: false, px: null, pz: null, spd: 0, ph: 0, seed: Math.random() * 6, J: newJ(), T: {}, slash: sl };
    resetT(v.T); V.vis.set(Hm, v); return v;
  }
  function setRarity(v, r) {
    if (r && typeof r === 'object') r = r.rarity;
    if (r === v.rar) return; v.rar = r;
    v.k.rh.visible = v.k.lh.visible = !!r || !v.cls;
    const c = r ? RC[r] || RC.common : RC.common;
    v.k.acc.forEach((m) => { m.color.setHex(c); m.emissive.setHex(c); m.emissiveIntensity = RI[r] != null ? RI[r] : 0.12; });
    const gc = r && r !== 'common' ? c : v.col;
    v.k.glows.forEach((g) => g.s.material.color.setHex(gc));
  }

  /* ---------- per-frame ---------- */
  function stateOf(Hm, v, own, o, dt, time) {
    const s = { atk: -1, combo: 0, spin: false, dash: false, dead: false, dodge: false, mounted: false, spd: 0, t: time };
    const pos = Hm.root.position;
    if (v.px != null && dt > 0) v.spd = lerp(v.spd, Math.hypot(pos.x - v.px, pos.z - v.pz) / dt, 0.3);
    v.px = pos.x; v.pz = pos.z; s.spd = v.spd;
    if (own) {
      const R = H.R; s.dead = !R.alive; s.dodge = R.dodgeT >= 0; s.spin = R.spinT >= 0; s.dash = R.dashT >= 0;
      if (R.atkT >= 0) { s.atk = clamp(R.atkT / 0.3, 0, 1); s.combo = R.combo | 0; }
      s.mounted = !!(window.AF_MOVE && window.AF_MOVE.active);
    } else {
      const an = o.anim; s.dead = an === 5; s.dodge = an === 4; s.spin = an === 3; s.dash = an === 7;
      if (an === 2) { s.atk = (time % 0.4) / 0.4; s.combo = Math.floor(time / 0.4) % 3; }
    }
    return s;
  }
  const _a = new T.Vector3(), _b = new T.Vector3();
  const ext = (th, kn) => 0.31 * cos(th) + 0.33 * cos(th + kn);
  function drive(Hm, v, s, dt, tm) {
    const R = Hm.rig, k = v.k, t = v.T, J = v.J, P = v.cls && CP[v.cls];
    if (!R) return;
    resetT(t);
    if (s.dead) deadPose(t);
    else {
      if (s.spd > 0.8) v.ph += dt * clamp(s.spd * 1.45, 0, 15);
      loco(v, s, t, tm);
      if (P) P.hold(t, s, tm);
      const act = s.dodge ? 'dodge' : s.atk >= 0 ? 'atk' : (s.spin || s.dash) ? 'skill' : '';
      if (act === 'dodge') dodgePose(t); else if (act === 'atk' && P) P.atk(t, s.atk, s.combo, s); else if (act === 'skill' && P) P.skill(t, s, tm);
      if (s.mounted) mountedPose(t, clamp(s.spd / 12, 0, 1));
      v.act = act;
    }
    const rate = s.dead ? 8 : (v.act ? 40 : 14), a = 1 - Math.exp(-rate * dt);
    KEYS.forEach((key) => { J[key] += (t[key] - J[key]) * a; });
    R.upper.rotation.set(J.lean, J.twist, J.tz);
    R.upper.scale.y = 1 + sin(tm * 1.6 + v.seed) * 0.01;
    Hm.headG.rotation.set(J.hx - J.lean * 0.6, J.hy, 0);
    Hm.arms[0].rotation.set(J.lsx, 0, J.lsz); R.el[0].rotation.set(J.lex, 0, 0);
    Hm.arms[1].rotation.set(J.rsx, 0, J.rsz); R.el[1].rotation.set(J.rex, 0, 0);
    Hm.legs[0].rotation.set(J.ltx, 0, J.ltz); R.kn[0].rotation.x = J.lkx; R.an[0].rotation.x = clamp(-(J.ltx + J.lkx) * 0.7, -0.8, 0.8);
    Hm.legs[1].rotation.set(J.rtx, 0, J.rtz); R.kn[1].rotation.x = J.rkx; R.an[1].rotation.x = clamp(-(J.rtx + J.rkx) * 0.7, -0.8, 0.8);
    Hm.inner.position.y = -1.0 - (0.64 - Math.max(ext(J.ltx, J.lkx), ext(J.rtx, J.rkx))) + J.air;
    k.rh.rotation.x = t.mR ? J.aimR - (J.rsx + J.rex) : J.rr;
    k.lh.rotation.x = t.mL ? J.aimL - (J.lsx + J.lex) : J.lr;

    // glow flash on a new attack / skill
    const spinNow = s.spin || s.dash, newAtk = s.atk >= 0 && v.lastAtk < 0, newSpin = spinNow && !v.lastSpin;
    if (newAtk || newSpin) v.flash = 1;
    v.lastAtk = s.atk; v.lastSpin = spinNow; v.flash = Math.max(0, v.flash - dt * 3);
    const rar = v.rar === 'epic' || v.rar === 'legend';
    k.glows.forEach((g, i) => { g.s.visible = Q > 0 && (g.always || rar); g.s.scale.setScalar(g.base * (1 + v.flash * 1.4 + 0.08 * sin(tm * 3 + i))); });
    k.spin.forEach((o) => { o.m.visible = Q > 0; o.m.position.set(cos(tm * o.sp + o.ph) * o.r, o.y + sin(tm * o.sp * 1.3 + o.ph) * 0.05, sin(tm * o.sp + o.ph) * o.r); });
    if (k.tickExtra) k.tickExtra(s);

    // bow string and arrow
    const b = k.bow;
    if (b) {
      b.P.set(0, 0, b.zs - t.pull); place(b.s1, b.top, b.P); place(b.s2, b.bot, b.P);
      b.arrow.visible = t.nock; if (t.nock) { _a.copy(b.P); _b.set(0, 0, b.P.z + 1.05); place(b.sh, _a, _b); b.head.position.set(0, 0, b.P.z + 1.12); b.fl.position.set(0, 0, b.P.z + 0.1); }
    }

    // swing trail for the melee classes
    const sl = v.slash;
    if (Q > 1 && (v.cls === 'warrior' || v.cls === 'assassin') && s.atk >= 0) {
      sl.visible = true; const am = sin(s.atk * PI), big = v.cls === 'warrior' ? 1 : 0.7;
      sl.position.set(0, 1.45, 0.75); sl.rotation.set(0, 0, 0);
      if (s.combo === 0) sl.rotation.z = -0.9; else if (s.combo === 1) { sl.rotation.x = -PI / 2; sl.position.y = 1.2; } else sl.rotation.z = 0.5;
      sl.scale.setScalar((0.85 + 0.3 * s.atk) * big * (s.combo === 2 ? 1.3 : 1)); sl.material.opacity = am * 0.75;
    } else if (sl.visible) { sl.visible = false; sl.material.opacity = 0; }
  }

  const CLS = new WeakMap();
  const shape0 = C.shape;
  C.shape = function (Hm, app) { if (shape0) shape0.apply(this, arguments); if (app && app.cls) CLS.set(Hm, app.cls); };

  let lastT = 0, warned = false;
  function frame() {
    if (V.off) return;
    const time = H.time; let dt = time - lastT; lastT = time; if (!(dt > 0)) return; dt = Math.min(dt, 0.1);
    const pr = C.prof;
    if (pr && pr.cls && X.PL) {
      let v = V.vis.get(X.PL); if (!v || v.cls !== pr.cls) v = build(X.PL, pr.cls);
      if (v) { const w = X.P && X.P.eq && X.P.eq.weapon; setRarity(v, w ? w.rarity : null); drive(X.PL, v, stateOf(X.PL, v, true, null, dt, time), dt, time); }
    }
    const R = H.R;
    H.others.forEach((o) => {
      if (Math.hypot(o.x - R.x, o.z - R.z) > 70) return;
      const cls = CLS.get(o.H) || null;
      let v = V.vis.get(o.H); if (!v || v.cls !== cls) v = build(o.H, cls);
      if (v) { setRarity(v, o.eq && o.eq.weapon); drive(o.H, v, stateOf(o.H, v, false, o, dt, time), dt, time); }
    });
  }
  const sc = X.scene, prev = sc.onBeforeRender;
  sc.onBeforeRender = function () {
    try { frame(); } catch (e) { if (!warned) { warned = true; V.off = true; console.warn('[visual] tat do loi:', e); } }
    if (prev) prev.apply(this, arguments);
  };
  console.log('[visual] da nap: bo khung moi (khuyu, goi), hoat anh di/chay/danh/ky nang, vu khi theo lop');
})();
