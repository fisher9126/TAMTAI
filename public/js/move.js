/* Aetherfall step 11 (browser): mounts (panel H, quick key X), jumping (key Z) and swimming visuals.
   The speed bonus of a mount and the swimming slow-down are decided by the server (server/move.js). Jumping is purely visual: the server does not
   track height, so a jump does not dodge anything. The model is lifted / lowered only while the frame is drawn (scene.onBeforeRender / onAfterRender),
   so the game's own movement code never sees the offset. Change KEYS below if a key clashes with something in your game.
   v2: new mount models (horse, war horse, wolf, ash beast, desert lizard) with a gallop animation, and the rider sits with legs spread. */
(function () {
  'use strict';
  const H = window.AF_CH, X = window.AF_CHX, D = window.AF_DOCK, RU = window.AF_RULES, THREE = window.THREE;
  if (!H || !X || !D || !RU || !RU.MOUNTS) { console.warn('[move] thiếu AF_CH/AF_DOCK/rules.js mới, bỏ qua'); return; }
  const KEYS = { jump: 'z', mount: 'x' };
  const esc = D.esc, send = D.send, num = D.num;
  const Mv = { owned: {}, active: null, swim: false, jumpT0: 0 };
  window.AF_MOVE = Mv;

  const ctl = D.add({ id: 'mount', label: 'Thú cưỡi', key: 'h', onOpen: () => send({ op: 'mvinfo' }) });
  const pn = ctl.panel;
  const plv = () => (X.P && X.P.level) || 1, gold = () => (X.P && X.P.gold) || 0;
  ctl.render = function () {
    if (!ctl.open) return;
    let h = ctl.head('Thú cưỡi') + '<div class="mut">Cấp 15 trở lên. Cưỡi để chạy nhanh hơn; phím <b>' + KEYS.mount.toUpperCase() + '</b> cưỡi / xuống nhanh. Tự xuống khi vào hầm ngục, tháp, raid, trận PvP hoặc xuống nước. Phím <b>' + KEYS.jump.toUpperCase() + '</b> để nhảy (chỉ là hiệu ứng).</div>';
    h += Object.keys(RU.MOUNTS).map((id) => {
      const d = RU.MOUNTS[id], own = Mv.owned[id], on = Mv.active === id;
      return '<div class="row"><span><b style="color:#' + ('000000' + d.col.toString(16)).slice(-6) + '">' + esc(d.name) + '</b> <small class="mut">cấp ' + d.lv + ' · +' + d.spd + '% tốc độ' + (d.rep ? ' · cần ' + RU.REP_TIERS[d.rep[1]].name + ' ' + esc(RU.FACTIONS[d.rep[0]].name) : '') + '</small><br><small class="mut">' + esc(d.desc) + '</small></span><span>' +
        (own ? '<button class="' + (on ? 'on' : '') + '" data-a="ride" data-id="' + id + '">' + (on ? 'Xuống' : 'Cưỡi') + '</button>' : '<button data-a="buy" data-id="' + id + '"' + (plv() < d.lv || gold() < d.price ? ' disabled' : '') + '>Mua ' + num(d.price) + '</button>') + '</span></div>';
    }).join('');
    pn.innerHTML = h;
  };
  pn.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    if (b.dataset.a === 'buy') send({ op: 'mvbuy', id: b.dataset.id });
    else if (b.dataset.a === 'ride') send({ op: 'mvtoggle', id: Mv.active === b.dataset.id ? null : b.dataset.id });
  });

  /* ---------- HUD ---------- */
  const css = document.createElement('style');
  css.textContent = '#afMv{position:fixed;left:16px;top:150px;z-index:20;display:flex;gap:6px;pointer-events:none}#afMv span{padding:2px 8px;border-radius:999px;background:rgba(13,18,31,.85);border:1px solid currentColor;font:700 12px system-ui,sans-serif}#afMv[hidden]{display:none}';
  document.head.appendChild(css);
  const hud = document.createElement('div'); hud.id = 'afMv'; hud.hidden = true; document.body.appendChild(hud);
  function paintHud() {
    const parts = [];
    if (Mv.active) parts.push('<span style="color:#ffd96a">Đang cưỡi ' + esc(RU.MOUNTS[Mv.active].name) + '</span>');
    if (Mv.swim) parts.push('<span style="color:#6fc1ff">Đang bơi · chậm hơn</span>');
    hud.innerHTML = parts.join(''); hud.hidden = !parts.length || !H.isRunning();
  }

  /* ---------- keys ---------- */
  window.addEventListener('keydown', (e) => {
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (!H.isRunning() || e.ctrlKey || e.metaKey || e.altKey || e.repeat || (window.AF_CLASS && window.AF_CLASS.creating) || !H.R.alive) return;
    const k = (e.code || '').indexOf('Key') === 0 ? e.code.slice(3).toLowerCase() : String(e.key).toLowerCase();
    if (k === KEYS.jump) { if (performance.now() - Mv.jumpT0 > 800 && !Mv.swim) Mv.jumpT0 = performance.now(); }
    else if (k === KEYS.mount) send({ op: 'mvtoggle', id: Mv.active ? null : undefined });
  });

  /* ---------- mount models (yourself only). Each is built with the ground at y = 0, then lowered by "raise", because the
     rider's root is lifted by the same amount while drawing, so the hooves land exactly on the terrain ---------- */
  const PI = Math.PI, sin = Math.sin;
  const SPH = new THREE.SphereGeometry(1, 14, 10);
  const Mt = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.75 }, o || {}));
  const Em = (c, i) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.4 });
  const add = (p, o, x, y, z, cs) => { o.position.set(x, y, z); o.castShadow = !!cs; p.add(o); return o; };
  const ell = (p, m, rx, ry, rz, x, y, z) => { const o = new THREE.Mesh(SPH, m); o.scale.set(rx, ry, rz); return add(p, o, x, y, z, Math.max(rx, ry, rz) > 0.2); };
  const cyl = (p, m, r1, r2, h, x, y, z) => add(p, new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 7), m), x, y, z, h > 0.4);
  const cone = (p, m, r, h, x, y, z) => add(p, new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), m), x, y, z, false);
  const bx = (p, m, w, h, d, x, y, z) => add(p, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z, false);
  const grp = (p, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; };
  function leg(p, m, hoof, x, y, z, up, lo, r) {
    const h = grp(p, x, y, z); cyl(h, m, r, r * 0.8, up, 0, -up / 2, 0);
    const k = grp(h, 0, -up, 0); cyl(k, m, r * 0.75, r * 0.55, lo, 0, -lo / 2, 0); bx(k, hoof, r * 1.6, 0.08, r * 2.4, 0, -lo + 0.03, r * 0.5);
    return { h, k };
  }
  const trot = (legs, ph, A, K) => legs.forEach((l, i) => { const s = sin(ph + (i === 1 || i === 2 ? PI : 0)); l.h.rotation.x = -s * A; l.k.rotation.x = Math.max(0, s) * K; });

  function horse(col, war) {
    const g = grp(new THREE.Group(), 0, 0, 0), m = Mt(col), dk = Mt(war ? 0xb8b8c8 : 0x2a1d16), mane = Mt(war ? 0xf6f6ff : 0x2a1d16), gold = Mt(0xe0b83a, { metalness: 0.8, roughness: 0.3 });
    const body = grp(g, 0, 0, 0);
    ell(body, m, 0.36, 0.38, 0.9, 0, 1.12, 0); ell(body, m, 0.37, 0.4, 0.42, 0, 1.18, 0.52); ell(body, m, 0.37, 0.4, 0.42, 0, 1.14, -0.52);
    const neck = grp(body, 0, 1.3, 0.8); neck.rotation.x = 0.55; ell(neck, m, 0.17, 0.5, 0.2, 0, 0.35, 0);
    for (let i = 0; i < 5; i++) ell(neck, mane, 0.05, 0.12, 0.09, 0, 0.1 + i * 0.18, -0.2);
    const head = grp(neck, 0, 0.8, 0.05); head.rotation.x = 1.3; ell(head, m, 0.15, 0.36, 0.17, 0, 0.3, 0); ell(head, dk, 0.11, 0.14, 0.13, 0, 0.64, 0.02);
    [-1, 1].forEach((k) => { const ear = cone(head, m, 0.045, 0.2, k * 0.09, 0.05, -0.12); ear.rotation.x = -PI / 2; ell(head, Mt(0x15141c), 0.03, 0.03, 0.03, k * 0.15, 0.3, 0.05); });
    const tail = grp(body, 0, 1.3, -0.9); tail.rotation.x = 0.5; ell(tail, mane, 0.07, 0.45, 0.07, 0, -0.4, 0);
    add(body, new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.5), Mt(0x6b3a22)), 0, 1.53, -0.02); add(body, new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.03, 0.62), Mt(war ? 0x2a4a9a : 0x9a3a2a)), 0, 1.5, -0.02);
    if (war) { ell(body, gold, 0.4, 0.44, 0.13, 0, 1.12, 0.92); const pl = cone(head, gold, 0.05, 0.3, 0, 0.0, -0.1); pl.rotation.x = -PI / 2; ell(body, gold, 0.28, 0.1, 0.36, 0, 1.56, -0.4); }
    const legs = [[-0.2, 0.6], [0.2, 0.6], [-0.2, -0.6], [0.2, -0.6]].map(([x, z]) => leg(body, m, dk, x, 0.95, z, 0.5, 0.45, 0.075));
    return { g, raise: 0.85, legX: -0.9, legZ: 0.32, anim(t, k) { trot(legs, t * (8 + k * 3), 0.75 * k, 0.9 * k); body.position.y = Math.abs(sin(t * (8 + k * 3))) * 0.05 * k + sin(t * 1.5) * 0.008; neck.rotation.x = 0.55 + sin(t * 2 * (8 + k * 3) / 2) * 0.05 * k; tail.rotation.z = sin(t * (2 + k * 5)) * (0.15 + 0.2 * k); } };
  }

  function wolf(col, ash) {
    const g = grp(new THREE.Group(), 0, 0, 0), m = Mt(col, { roughness: 0.9 }), dk = Mt(ash ? 0x120a1c : 0x1c1b24), eyeM = Em(ash ? 0xff7a2a : 0xffd34a, 1.2);
    const body = grp(g, 0, 0, 0);
    ell(body, m, 0.3, 0.32, 0.75, 0, 0.78, 0); ell(body, m, 0.33, 0.36, 0.36, 0, 0.82, 0.45); ell(body, m, 0.3, 0.3, 0.3, 0, 0.76, -0.5);
    const neck = grp(body, 0, 0.9, 0.75); neck.rotation.x = 0.7; ell(neck, m, 0.2, 0.28, 0.22, 0, 0.2, 0);
    const head = grp(neck, 0, 0.45, 0.02); head.rotation.x = 0.9; ell(head, m, 0.19, 0.3, 0.17, 0, 0.12, 0); ell(head, dk, 0.08, 0.16, 0.08, 0, 0.42, 0.02);
    [-1, 1].forEach((k) => { const ear = cone(head, m, 0.06, 0.22, k * 0.11, 0.18, -0.14); ear.rotation.x = -PI / 2; ell(head, eyeM, 0.03, 0.03, 0.03, k * 0.13, 0.22, 0.1); });
    const tail = grp(body, 0, 0.85, -0.8); tail.rotation.x = 0.8; ell(tail, m, 0.1, 0.38, 0.1, 0, -0.32, 0);
    add(body, new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.45), Mt(0x4a2f1c)), 0, 1.1, -0.02);
    if (ash) { for (let i = 0; i < 6; i++) cone(body, Em(0xff7a2a, 1.1), 0.07, 0.38, 0, 1.0, 0.5 - i * 0.26); [-1, 1].forEach((k) => { const h = cone(head, Mt(0xe8e0c8), 0.05, 0.4, k * 0.12, 0.22, -0.2); h.rotation.x = -PI / 2.4; h.rotation.z = -k * 0.4; }); }
    const legs = [[-0.2, 0.5], [0.2, 0.5], [-0.2, -0.5], [0.2, -0.5]].map(([x, z]) => leg(body, m, dk, x, 0.6, z, 0.32, 0.3, 0.07));
    return { g, raise: 0.45, legX: -0.75, legZ: 0.35, anim(t, k) { trot(legs, t * (10 + k * 4), 0.9 * k, 1.0 * k); body.position.y = Math.abs(sin(t * (10 + k * 4))) * 0.06 * k; tail.rotation.z = sin(t * (3 + k * 6)) * (0.1 + 0.3 * k); head.rotation.x = 0.9 + sin(t * 2) * 0.03; } };
  }

  function lizard(col) {
    const g = grp(new THREE.Group(), 0, 0, 0), m = Mt(col, { roughness: 0.6 }), belly = Mt(0xd9d08a), dk = Mt(0x2a3a1a), eyeM = Em(0xffd34a, 1);
    const body = grp(g, 0, 0, 0);
    ell(body, m, 0.4, 0.26, 0.95, 0, 0.55, 0); ell(body, belly, 0.3, 0.14, 0.8, 0, 0.42, 0.05);
    const head = grp(body, 0, 0.58, 1.0); ell(head, m, 0.22, 0.15, 0.42, 0, 0, 0.2); [-1, 1].forEach((k) => ell(head, eyeM, 0.04, 0.04, 0.04, k * 0.16, 0.1, 0.1));
    for (let i = 0; i < 7; i++) cone(body, dk, 0.07, 0.24 - i * 0.015, 0, 0.84, 0.6 - i * 0.22);
    const tails = []; let par = body; [0, 1, 2].forEach((i) => { const j = grp(par, 0, i ? 0 : 0.5, i ? -0.55 : -0.9); ell(j, m, 0.26 - i * 0.07, 0.2 - i * 0.05, 0.4, 0, 0, -0.2); tails.push(j); par = j; });
    add(body, new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.07, 0.5), Mt(0x7a4a22)), 0, 0.8, -0.1);
    const legs = [[-1, 0.55], [1, 0.55], [-1, -0.45], [1, -0.45]].map(([sx, z]) => { const h = grp(body, sx * 0.38, 0.45, z); h.rotation.z = sx * -1.0; cyl(h, m, 0.09, 0.07, 0.45, 0, -0.22, 0); const k2 = grp(h, 0, -0.45, 0); k2.rotation.z = sx * 0.9; cyl(k2, m, 0.07, 0.05, 0.4, 0, -0.2, 0); bx(k2, dk, 0.22, 0.05, 0.3, 0, -0.4, 0.08); return { h, k: k2, sx, z }; });
    return { g, raise: 0.2, legX: -0.35, legZ: 0.7, anim(t, k) { legs.forEach((l, i) => { const s = sin(t * (9 + k * 3) + (i === 1 || i === 2 ? PI : 0)); l.h.rotation.x = -s * 0.5 * k; }); tails.forEach((j, i) => { j.rotation.y = sin(t * (3 + k * 4) + i * 0.8) * (0.2 + 0.2 * k); }); body.position.y = Math.abs(sin(t * (9 + k * 3))) * 0.04 * k; } };
  }

  const MODEL = {
    horse: () => horse(RU.MOUNTS.horse.col, false), warhorse: () => horse(RU.MOUNTS.warhorse.col, true),
    wolf: () => wolf(RU.MOUNTS.wolf.col, false), ashbeast: () => wolf(RU.MOUNTS.ashbeast.col, true), lizard: () => lizard(RU.MOUNTS.lizard.col)
  };
  let shown = null, posed = false;
  function mountMesh(id) {
    const o = (MODEL[id] || MODEL.horse)();
    const g = new THREE.Group(); g.add(o.g); g.position.y = -o.raise;
    g.userData = { afMountId: id, raise: o.raise, anim: o.anim, legX: o.legX, legZ: o.legZ };
    return g;
  }
  function syncMount() {
    const root = X.PL && X.PL.root; if (!root) return;
    if (shown && (!Mv.active || shown.userData.afMountId !== Mv.active)) { root.remove(shown); shown.traverse((o) => { if (o.material && o.material.dispose) o.material.dispose(); if (o.geometry && o.geometry !== SPH && o.geometry.dispose) o.geometry.dispose(); }); shown = null; }
    if (Mv.active && !shown) { shown = mountMesh(Mv.active); root.add(shown); }
  }
  setInterval(() => { try { syncMount(); paintHud(); } catch (err) { console.error('[move]', err); } }, 400);

  /* ---------- per-frame: rider pose + mount animation, then the draw-time lift ---------- */
  let lx = null, lz = null, lastTm = 0, spd = 0;
  function tickMount() {
    const pl = X.PL; if (!pl || !pl.legs) return;
    const now = performance.now() / 1000, dt = Math.min(0.1, now - lastTm); lastTm = now;
    const p = pl.root.position;
    if (lx != null && dt > 0) spd += (Math.hypot(p.x - lx, p.z - lz) / dt - spd) * 0.3;
    lx = p.x; lz = p.z;
    if (shown && Mv.active) {
      const u = shown.userData, rigged = window.AF_VISUAL && !window.AF_VISUAL.off && pl.rig; // visual.js seats the rider itself when the new rig is on
      if (!rigged) { pl.legs[0].rotation.x = u.legX; pl.legs[0].rotation.z = u.legZ; pl.legs[1].rotation.x = u.legX; pl.legs[1].rotation.z = -u.legZ; }
      u.anim(now, Math.min(1, spd / 5)); posed = !rigged;
    } else if (posed) { pl.legs.forEach((l) => { l.rotation.z = 0; }); posed = false; }
  }
  let applied = 0;
  function offset() {
    let y = 0; const now = performance.now();
    if (Mv.active && shown) y += shown.userData.raise;
    const jt = (now - Mv.jumpT0) / 700; if (jt >= 0 && jt < 1) y += 1.7 * 4 * jt * (1 - jt);
    if (Mv.swim) y += -0.5 + Math.sin(now / 320) * 0.06;
    return y;
  }
  if (THREE && X.scene) {
    const sc = X.scene, prevB = sc.onBeforeRender, prevA = sc.onAfterRender;
    sc.onBeforeRender = function () {
      if (prevB) prevB.apply(this, arguments);
      if (X.PL && X.PL.root && !applied) { try { tickMount(); } catch (err) { console.error('[move]', err); } applied = offset(); X.PL.root.position.y += applied; }
    };
    sc.onAfterRender = function () { if (applied && X.PL && X.PL.root) { X.PL.root.position.y -= applied; applied = 0; } if (prevA) prevA.apply(this, arguments); };
  }

  Mv.onNet = function (m) {
    if (m.t === 'mvinfo') { Mv.owned = m.owned || {}; Mv.active = m.active || null; const was = Mv.swim; Mv.swim = !!m.swim; if (Mv.swim && !was) H.toast('Bạn đang bơi, di chuyển chậm hơn'); ctl.render(); syncMount(); paintHud(); return true; }
    return false;
  };
})();
