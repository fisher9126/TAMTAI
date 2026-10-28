/* Aetherfall step 11 (browser): scenery of the desert, the free-PvP ring, the abyss and the siege fortress. Zone names and ground patches come from
   rules.js ZONES through zones.js; this file only adds the props. Exposes AF_WORLD2.setFlag(text, color) for the fortress banner (used by pvp.js). */
(function () {
  'use strict';
  const H = window.AF_CH, X = window.AF_CHX, RU = window.AF_RULES, THREE = window.THREE;
  if (!H || !X || !RU || !THREE || !RU.WORLD || !RU.WORLD.DESERT) { console.warn('[world2] thiếu AF_CH/AF_CHX/rules.js mới, bỏ qua'); return; }
  const W = RU.WORLD, S = X.scene;
  const W2 = {};
  window.AF_WORLD2 = W2;
  const M = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85, flatShading: true }, o || {}));
  const rng = (seed) => { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const put = (obj, x, z, yOff, rotY) => { obj.position.set(x, H.heightAt(x, z) + (yOff || 0), z); if (rotY) obj.rotation.y = rotY; S.add(obj); return obj; };
  function label(text, color, size) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d');
    g.font = 'bold 44px system-ui,sans-serif'; g.textAlign = 'center'; g.lineWidth = 8; g.strokeStyle = '#1a0f05'; g.strokeText(text, 256, 62); g.fillStyle = color || '#ffe9a8'; g.fillText(text, 256, 62);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })); sp.scale.set(size || 10, (size || 10) * 96 / 512, 1); return sp;
  }
  const anim = [];

  function desert() {
    const r = rng(51), c = W.DESERT;
    // cacti
    for (let i = 0; i < 22; i++) {
      const a = r() * 6.283, d = 13 + r() * 9, s = 0.7 + r() * 1.0, g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.26 * s, 2.2 * s, 7), M(0x4f8a4a)); body.position.y = 1.1 * s; g.add(body);
      for (let k = 0; k < 2; k++) { const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * s, 0.15 * s, 0.9 * s, 6), M(0x4f8a4a)); arm.position.set(k ? 0.4 * s : -0.4 * s, 1.4 * s, 0); arm.rotation.z = k ? -0.7 : 0.7; g.add(arm); }
      put(g, c.x + Math.cos(a) * d, c.z + Math.sin(a) * d, 0, r() * 6.28);
    }
    // sand dunes and sun-baked stones
    for (let i = 0; i < 14; i++) {
      const a = r() * 6.283, d = 13 + r() * 10, s = 1.5 + r() * 2.2, m = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 6), M(0xd9a75a)); m.scale.y = 0.35;
      put(m, c.x + Math.cos(a) * d, c.z + Math.sin(a) * d, 0, 0);
    }
    // ancient ruins: broken pillars and a gate
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * 6.283 + r() * 0.3, d = 20 + r() * 3, h = 2.5 + r() * 3, g = new THREE.Group();
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.1, h, 1.1), M(0xb99a6a)); p.position.y = h / 2; g.add(p);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 1.5), M(0xcdae7c)); cap.position.y = h; g.add(cap);
      put(g, c.x + Math.cos(a) * d, c.z + Math.sin(a) * d, 0, r() * 6.28);
    }
    // blood-red stones around the pharaoh
    for (let i = 0; i < 6; i++) {
      const a = r() * 6.283, d = 2 + r() * 3, cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.5 + r() * 0.5, 0), M(0xc03a3a, { emissive: 0x801818, emissiveIntensity: 0.6 }));
      cr.scale.y = 1.8; put(cr, c.x - 14 + Math.cos(a) * d, c.z + 14 + Math.sin(a) * d, 0.8, 0);
    }
  }
  function pvpRing() {
    const c = W.PVPZ, ring = new THREE.Mesh(new THREE.RingGeometry(c.r - 0.5, c.r, 64), new THREE.MeshBasicMaterial({ color: 0xff3b2e, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(c.x, H.heightAt(c.x, c.z) + 0.25, c.z); ring.renderOrder = 2; S.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(c.r, 48), new THREE.MeshBasicMaterial({ color: 0x8a1a12, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.set(c.x, H.heightAt(c.x, c.z) + 0.2, c.z); S.add(disc);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 6.283, g = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 2.6, 6), M(0x3a2a22)); post.position.y = 1.3; g.add(post);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 6), new THREE.MeshBasicMaterial({ color: 0xff7a2e })); fl.position.y = 3; g.add(fl); anim.push(fl);
      put(g, c.x + Math.cos(a) * c.r, c.z + Math.sin(a) * c.r, 0, 0);
    }
    const lb = label('Đấu Trường Cát Đỏ · PvP tự do', '#ff9a8a', 12); lb.position.set(c.x, H.heightAt(c.x, c.z) + 6, c.z); S.add(lb);
  }
  function abyss() {
    const r = rng(77), c = W.ABYSS;
    for (let i = 0; i < 20; i++) { // twisted dead trees
      const a = r() * 6.283, d = 3 + r() * 14, h = 3 + r() * 3, g = new THREE.Group();
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.28, h, 5), M(0x1f1428)); tr.position.y = h / 2; tr.rotation.z = (r() - 0.5) * 0.4; g.add(tr);
      for (let k = 0; k < 3; k++) { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.1, 1.5, 4), M(0x1f1428)); br.position.set((k - 1) * 0.5, h * (0.55 + k * 0.12), 0); br.rotation.z = (k - 1) * 0.9; g.add(br); }
      put(g, c.x + Math.cos(a) * d, c.z + Math.sin(a) * d, 0, r() * 6.28);
    }
    for (let i = 0; i < 12; i++) { // floating void crystals
      const a = r() * 6.283, d = 2 + r() * 14, cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.4 + r() * 0.5, 0), M(0xa070ff, { emissive: 0x6a30d0, emissiveIntensity: 0.9, transparent: true, opacity: 0.9 }));
      cr.scale.y = 1.7; put(cr, c.x + Math.cos(a) * d, c.z + Math.sin(a) * d, 2 + r() * 2.5, 0); cr.userData.bob = r() * 6.28; anim.push(cr);
    }
    for (let i = 0; i < 10; i++) { // black spikes
      const a = r() * 6.283, d = 6 + r() * 11, sp = new THREE.Mesh(new THREE.ConeGeometry(0.5 + r() * 0.4, 2.5 + r() * 2.5, 5), M(0x120a1c));
      put(sp, c.x + Math.cos(a) * d, c.z + Math.sin(a) * d, 1.2, 0);
    }
    const hole = new THREE.Mesh(new THREE.CircleGeometry(3.2, 28), new THREE.MeshBasicMaterial({ color: 0x050010, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    hole.rotation.x = -Math.PI / 2; hole.position.set(c.x, H.heightAt(c.x, c.z) + 0.2, c.z); S.add(hole);
  }
  let flagSprite = null, flagPole = null;
  function fort() {
    const c = W.FORT, R = c.r;
    for (let i = 0; i < 16; i++) { // wall with four gaps (N, E, S, W)
      const a = (i / 16) * 6.283; if (i % 4 === 0) continue;
      const w = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.2, 1), M(0x7d7d8c)); put(w, c.x + Math.cos(a) * R, c.z + Math.sin(a) * R, 1.6, -a + Math.PI / 2);
    }
    for (let i = 0; i < 4; i++) { // corner towers
      const a = (i / 4) * 6.283 + Math.PI / 4, g = new THREE.Group();
      const t = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.7, 6, 8), M(0x6d6d7c)); t.position.y = 3; g.add(t);
      const top = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.8, 8), M(0x8a3a3a)); top.position.y = 6.9; g.add(top);
      put(g, c.x + Math.cos(a) * R, c.z + Math.sin(a) * R, 0, 0);
    }
    flagPole = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 7, 6), M(0x5a4a3a)); pole.position.y = 3.5; flagPole.add(pole);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), new THREE.MeshBasicMaterial({ color: 0x777777, side: THREE.DoubleSide })); banner.position.set(1.3, 6.2, 0); flagPole.add(banner); flagPole.userData.banner = banner;
    put(flagPole, c.x, c.z, 0, 0);
    flagSprite = label('Pháo Đài Valdren · chưa có chủ', '#ffe9a8', 12); flagSprite.position.set(c.x, H.heightAt(c.x, c.z) + 9.5, c.z); S.add(flagSprite);
  }
  W2.setFlag = function (text, color) {
    if (!flagSprite) return;
    const sp = label(text, '#ffe9a8', 12); sp.position.copy(flagSprite.position); S.remove(flagSprite); if (flagSprite.material.map) flagSprite.material.map.dispose(); flagSprite.material.dispose(); flagSprite = sp; S.add(sp);
    if (flagPole && flagPole.userData.banner) flagPole.userData.banner.material.color.set(color || '#777777');
  };
  /* The Tower, the Raid hall and the battleground are rooms the server keeps closed to anyone who is not inside (server/instances.js, server/pvp.js).
     Before this they were invisible walls: open ground that pushed you back. Now each one has a visible barrier and a sign.
     Keep the numbers equal to TOWER / RAID in server/instances.js and BG in server/pvp.js (the server blocks up to r + 1). */
  const ROOMS = [
    { x: -80, z: 30, r: 12, col: 0x6fa8ff, text: 'Tháp Thử Thách · phím T để vào' },
    { x: 86, z: 34, r: 13, col: 0xff5a4a, text: 'Raid Morvain · phím T để vào' },
    { x: -72, z: -56, r: 10, col: 0xffb347, text: 'Chiến Trường · phím B để xếp hàng' }
  ];
  function rooms() {
    ROOMS.forEach((c) => {
      const R = c.r + 1, y = H.heightAt(c.x, c.z);
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 7, 40, 1, true), new THREE.MeshBasicMaterial({ color: c.col, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      wall.position.set(c.x, y + 3, c.z); S.add(wall);
      const ring = new THREE.Mesh(new THREE.RingGeometry(R - 0.45, R, 64), new THREE.MeshBasicMaterial({ color: c.col, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(c.x, y + 0.3, c.z); ring.renderOrder = 2; S.add(ring);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * 6.283, g = new THREE.Group();
        const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 5, 6), M(0x4a4a5a)); pil.position.y = 2.5; g.add(pil);
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ color: c.col })); orb.position.y = 5.3; g.add(orb);
        put(g, c.x + Math.cos(a) * R, c.z + Math.sin(a) * R, 0, 0);
      }
      const lb = label(c.text, '#ffffff', 14); lb.position.set(c.x, y + 9, c.z); S.add(lb);
    });
  }
  try { desert(); pvpRing(); abyss(); fort(); rooms(); } catch (err) { console.error('[world2] scenery', err); }
  (function loop() {
    const t = performance.now() / 1000;
    anim.forEach((o, i) => { if (o.userData && o.userData.bob != null) { o.rotation.y = t * 1.2; o.position.y += Math.sin(t * 1.5 + o.userData.bob) * 0.004; } else o.scale.y = 1 + Math.sin(t * 8 + i) * 0.2; });
    requestAnimationFrame(loop);
  })();
  W2.onNet = function () { return false; };
})();
