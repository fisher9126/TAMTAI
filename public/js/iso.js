/* Aetherfall: Dungeons-style play and mouse focus (browser).
   - Camera mode 'iso' (index.html): fixed diagonal camera. The mouse aims: the character turns to the cursor, holding the left button
     attacks again and again, the right button fires skill 1 toward the cursor. Enemies under the cursor are targeted first.
   - Mouse focus for every camera mode: while any panel (bag, map, shop, quests...) is open the normal cursor shows; Esc closes the
     panel and returns to play (in 'iso' the cursor turns into the game reticle, in third person the mouse is locked again).
   - Buildings between the camera and the player fade out, and a ring under the player stays visible through trees. */
(function () {
  'use strict';
  const H = window.AF_CH, X = window.AF_CHX, G = window.AF_GFX, T = window.THREE;
  if (!H || !X || !G || !T) { console.warn('[iso] thiếu AF_CH/AF_GFX, bỏ qua'); return; }
  const cvs = H.cvs, R = H.R;
  const isTouch = ('ontouchstart' in window) || (window.matchMedia && matchMedia('(pointer:coarse)').matches);
  const I = { mouse: { x: 0, y: 0, ok: false, over: false }, held: false, heldR: false, aim: new T.Vector3(), aimOk: false, hover: null, lastAim: 0 };
  window.AF_ISO = I;
  const iso = () => X.cam && X.cam.mode === 'iso';

  /* ---------- panels: which are open, how to close them ---------- */
  const PANELS = ['#afArm', '#inv', '#friends', '#dialog', '.afp', '#afUR', '#afGR', '#afVR', '#afQD', '#afQJ', '#afChar', '#afZ', '#afMap', '#afTR', '#afSoc', '#afCreate', '#death', '#kicked', '#start'];
  const CLOSE = '[data-a="x"],[data-act="x"],[data-act="close"],[data-a="close"],[data-x],#invX,#frX,#dOk';
  const vis = (el) => !!el && !el.hidden && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  function openPanels() {
    const out = [];
    PANELS.forEach((sel) => document.querySelectorAll(sel).forEach((el) => { if (vis(el)) out.push(el); }));
    return out;
  }
  const typing = () => { const a = document.activeElement; return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT'); };
  function uiBusy() { return !H.isRunning() || typing() || openPanels().length > 0 || !!(window.AF_SOCIAL && window.AF_SOCIAL.isOpen && window.AF_SOCIAL.isOpen()); }
  I.busy = uiBusy;
  /* close every open panel that has a close button; returns true when something was closed */
  function closeAll() {
    let n = 0;
    openPanels().forEach((el) => {
      if (/^(death|kicked|start|afCreate)$/.test(el.id)) return;
      if (el.id === 'afArm' || el.id === 'inv') { if (X.invOpen) { X.closeInv(); n++; } return; }
      if (el.id === 'dialog') { if (X.dialogOpen) { X.closeDialog(); n++; } return; }
      if (el.id === 'friends') { X.closeFriends(); n++; return; }
      const b = Array.from(el.querySelectorAll(CLOSE)).find(vis) || el.querySelector(CLOSE);
      if (b) { b.click(); n++; }
    });
    if (window.AF_SOCIAL && window.AF_SOCIAL.isOpen && window.AF_SOCIAL.isOpen()) { const b = document.querySelector('#afSoc [data-act="close"]'); if (b) { b.click(); n++; } }
    if (window.AF_DOCK) window.AF_DOCK.list.forEach((c) => { if (c.open) { c.toggle(false); n++; } });
    return n > 0;
  }
  I.closeAll = closeAll;

  /* ---------- mouse lock for the classic third-person camera ---------- */
  let relock = false;
  function lockNow() { if (isTouch || iso() || !H.isRunning() || uiBusy() || document.pointerLockElement === cvs) return; try { const p = cvs.requestPointerLock && cvs.requestPointerLock(); if (p && p.catch) p.catch(() => { relock = true; }); } catch (e) { relock = true; } }
  /* Esc: close the open panels (capture phase, so panels that swallow key events still get closed) and go back to play */
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !H.isRunning()) return;
    const a = document.activeElement;
    if (a && a.id === 'chatIn') return; // index.html blurs the chat box
    if (closeAll()) {
      e.preventDefault(); e.stopPropagation();
      if (a && a.blur && a !== document.body) a.blur();
      if (!iso()) { relock = true; lockNow(); }
      hint('Đã trở lại trận đấu');
    }
  }, true);
  /* when a panel opens: release the mouse so the cursor shows */
  setInterval(() => {
    const busy = uiBusy();
    document.body.classList.toggle('af-ui', busy);
    document.body.classList.toggle('af-iso', iso() && !isTouch);
    if (busy && document.pointerLockElement === cvs) document.exitPointerLock();
    if (busy) { I.held = false; I.heldR = false; }
  }, 120);
  /* first click into the world (third person) locks the mouse */
  cvs.addEventListener('pointerdown', () => { if (!iso() && !isTouch && (relock || !document.pointerLockElement) && !uiBusy()) { relock = false; lockNow(); } }, true);

  /* ---------- reticle (iso) ---------- */
  const css = document.createElement('style');
  css.textContent = `
  body.af-iso:not(.af-ui) canvas{cursor:none}
  #afAim{position:fixed;left:0;top:0;width:34px;height:34px;margin:-17px 0 0 -17px;pointer-events:none;z-index:30;display:none}
  #afAim i{position:absolute;inset:0;border:2px solid rgba(255,176,102,.95);border-radius:50%;box-shadow:0 0 10px rgba(224,122,58,.8),inset 0 0 6px rgba(224,122,58,.5);transition:transform .08s,border-color .1s}
  #afAim b{position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;border-radius:50%;background:#fff1dc;box-shadow:0 0 6px #ffb066}
  #afAim.foe i{border-color:#ff5a46;box-shadow:0 0 12px rgba(255,70,50,.9),inset 0 0 8px rgba(255,70,50,.6);transform:scale(.82)}
  #afAim.fire i{transform:scale(.7)}
  #afHint{position:fixed;left:50%;bottom:150px;transform:translateX(-50%);z-index:70;padding:6px 14px;border-radius:4px;background:rgba(12,10,9,.88);border:1px solid rgba(224,122,58,.4);color:#e3d6bd;font:600 12.5px system-ui,sans-serif;pointer-events:none;opacity:0;transition:opacity .25s}
  #afHint.on{opacity:1}`;
  document.head.appendChild(css);
  const ret = document.createElement('div'); ret.id = 'afAim'; ret.innerHTML = '<i></i><b></b>'; document.body.appendChild(ret);
  const hintEl = document.createElement('div'); hintEl.id = 'afHint'; document.body.appendChild(hintEl);
  let hintT = 0;
  function hint(t) { hintEl.textContent = t; hintEl.classList.add('on'); clearTimeout(hintT); hintT = setTimeout(() => hintEl.classList.remove('on'), 1100); }
  I.hint = hint;

  document.addEventListener('mousemove', (e) => { I.mouse.x = e.clientX; I.mouse.y = e.clientY; I.mouse.ok = true; I.mouse.over = e.target === cvs; I.lastAim = performance.now(); }, true);
  document.addEventListener('mouseleave', () => { I.mouse.over = false; });
  cvs.addEventListener('pointerdown', (e) => {
    if (!iso() || isTouch || e.pointerType === 'touch' || uiBusy()) return;
    I.mouse.x = e.clientX; I.mouse.y = e.clientY; I.mouse.ok = true; I.mouse.over = true;
    if (e.button === 0) { I.held = true; fire(); }
    if (e.button === 2) { I.heldR = true; aimFace(); X.skill(1); }
  });
  window.addEventListener('pointerup', (e) => { if (e.button === 0) I.held = false; if (e.button === 2) I.heldR = false; });
  window.addEventListener('blur', () => { I.held = false; I.heldR = false; });

  /* ---------- aiming ---------- */
  const ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(new T.Vector3(0, 1, 0), 0), hit = new T.Vector3();
  function updateAim() {
    I.aimOk = false;
    if (!I.mouse.ok) return;
    const cam = G.camera, rc = cvs.getBoundingClientRect();
    ndc.set(((I.mouse.x - rc.left) / rc.width) * 2 - 1, -((I.mouse.y - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    /* intersect the ground: start with the player's height, refine twice with the terrain height at the hit point */
    let y = H.heightAt(R.x, R.z);
    for (let k = 0; k < 3; k++) { plane.constant = -y; if (!ray.ray.intersectPlane(plane, hit)) return; y = H.heightAt(hit.x, hit.z); }
    I.aim.set(hit.x, y, hit.z); I.aimOk = true;
  }
  function enemyAt(px, pz, extra) {
    let best = null, bd = Infinity;
    X.enemyById.forEach((e) => { if (e.dead) return; const d = Math.hypot(e.x - px, e.z - pz) - e.d.radius; if (d < (extra || 0.9) && d < bd) { bd = d; best = e; } });
    return best;
  }
  function aimFace() {
    if (!I.aimOk) return;
    const t = I.hover;
    const tx = t ? t.x : I.aim.x, tz = t ? t.z : I.aim.z;
    if (Math.hypot(tx - R.x, tz - R.z) > 0.3) R.facing = Math.atan2(tx - R.x, tz - R.z);
  }
  /* used by nearestEnemy() in index.html while the camera is 'iso'. undefined = no mouse (touch): use the old nearest-enemy rule */
  I.pick = function (maxD) {
    if (isTouch || !I.mouse.ok || !I.aimOk) return undefined;
    const t = I.hover;
    if (t && !t.dead && Math.hypot(t.x - R.x, t.z - R.z) - t.d.radius <= maxD) return t;
    aimFace();
    /* melee helper: an enemy right in front of the aimed direction still counts */
    const fx = Math.sin(R.facing), fz = Math.cos(R.facing); let best = null, bd = maxD;
    X.enemyById.forEach((e) => { if (e.dead) return; const dx = e.x - R.x, dz = e.z - R.z, d = Math.hypot(dx, dz) || 1e-3, dd = d - e.d.radius; if (dd < bd && dd < 3.2 && (dx * fx + dz * fz) / d > 0.6) { bd = dd; best = e; } });
    return best;
  };
  I.aiming = () => iso() && !isTouch && (I.held || I.heldR) && !uiBusy();
  function fire() { if (!X.canAct()) return; aimFace(); X.attack(); }

  /* ground marker at the aim point and a ring under the player that shows through trees and walls */
  const mk = new T.Mesh(new T.RingGeometry(0.42, 0.58, 40), new T.MeshBasicMaterial({ color: 0xffb066, transparent: true, opacity: 0.85, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
  mk.rotation.x = -Math.PI / 2; mk.renderOrder = 5; mk.visible = false; G.scene.add(mk);
  const me = new T.Mesh(new T.RingGeometry(0.62, 0.78, 48), new T.MeshBasicMaterial({ color: 0xffd08a, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false, side: T.DoubleSide }));
  me.rotation.x = -Math.PI / 2; me.renderOrder = 999; me.visible = false; G.scene.add(me);
  const arrow = new T.Mesh(new T.ConeGeometry(0.16, 0.42, 3), new T.MeshBasicMaterial({ color: 0xffd08a, transparent: true, opacity: 0.7, depthTest: false, depthWrite: false }));
  arrow.rotation.x = Math.PI / 2; arrow.renderOrder = 999; const arrowG = new T.Group(); arrowG.add(arrow); arrow.position.z = 1.05; G.scene.add(arrowG); arrowG.visible = false;

  /* ---------- buildings in front of the player fade out ---------- */
  const occ = { list: [], faded: new Map(), t: 0 };
  function occluders() {
    if (occ.list.length && occ.t++ % 50) return occ.list;
    const L = [];
    G.scene.children.forEach((o) => { if (o.userData && o.userData.afOcc && o.visible) L.push(o); });
    occ.list = L; return L;
  }
  function ghost(mesh) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const g = mats.map((m) => { const c = m.clone(); c.transparent = true; c.opacity = 0.22; c.depthWrite = false; return c; });
    return Array.isArray(mesh.material) ? g : g[0];
  }
  const oRay = new T.Raycaster(), oDir = new T.Vector3();
  function fadeOccluders() {
    const want = new Set();
    if (iso() && H.isRunning()) {
      const cam = G.camera.position, py = H.heightAt(R.x, R.z) + 1.1;
      [[0, 0], [0.6, 0], [-0.6, 0]].forEach(([ox]) => {
        const tx = R.x + ox * Math.cos(Math.PI * 0.25), tz = R.z - ox * Math.sin(Math.PI * 0.25);
        oDir.set(tx - cam.x, py - cam.y, tz - cam.z); const len = oDir.length(); oDir.normalize();
        oRay.set(cam, oDir); oRay.far = len - 0.6;
        oRay.intersectObjects(occluders(), true).forEach((h) => { let r = h.object; while (r && !(r.userData && r.userData.afOcc)) r = r.parent; if (r) want.add(r); });
      });
    }
    occ.faded.forEach((rec, root) => {
      if (want.has(root)) return;
      rec.forEach((r) => { r.mesh.material = r.orig; }); occ.faded.delete(root);
    });
    want.forEach((root) => {
      if (occ.faded.has(root)) return;
      const rec = []; root.traverse((m) => { if (m.isMesh) { rec.push({ mesh: m, orig: m.material }); m.material = ghost(m); } });
      occ.faded.set(root, rec);
    });
  }
  setInterval(() => { try { fadeOccluders(); } catch (e) { /* ignore */ } }, 120);

  /* ---------- trees between the camera and the player get a see-through hole (like Minecraft Dungeons) ---------- */
  const CUT = { uCut: { value: new T.Vector3(0, 0, 0) }, uCutZ: { value: 0 } };
  const patched = new WeakSet();
  function patchCut() {
    G.scene.traverse((o) => {
      if (!o.isMesh || !(o.userData && o.userData.afCut)) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
        if (patched.has(m)) return; patched.add(m);
        const prev = m.onBeforeCompile;
        m.onBeforeCompile = function (sh, r) {
          if (prev) prev.call(this, sh, r);
          sh.uniforms.uCut = CUT.uCut; sh.uniforms.uCutZ = CUT.uCutZ;
          sh.fragmentShader = 'uniform vec3 uCut;\nuniform float uCutZ;\n' + sh.fragmentShader.replace('void main() {',
            'void main() {\n  if (uCut.z > 0.0 && gl_FragCoord.z < uCutZ) { float dd = distance(gl_FragCoord.xy, uCut.xy); if (dd < uCut.z) { float ck = mod(floor(gl_FragCoord.x * 0.5) + floor(gl_FragCoord.y * 0.5), 2.0); if (dd < uCut.z * 0.72 || ck < 0.5) discard; } }');
        };
        m.needsUpdate = true;
      });
    });
  }
  setInterval(() => { try { patchCut(); } catch (e) { /* ignore */ } }, 1500);
  const cutV = new T.Vector3();
  function updateCut() {
    if (!(iso() && H.isRunning())) { CUT.uCut.value.z = 0; return; }
    const r = G.renderer, pr = r.getPixelRatio(), w = r.domElement.width, h = r.domElement.height;
    cutV.set(R.x, H.heightAt(R.x, R.z) + 1.0, R.z).project(G.camera);
    CUT.uCut.value.set((cutV.x + 1) / 2 * w, (cutV.y + 1) / 2 * h, 120 * pr * (h / pr / 720 + 0.25));
    CUT.uCutZ.value = cutV.z * 0.5 + 0.5;
  }

  /* ---------- frame loop ---------- */
  function loop() {
    requestAnimationFrame(loop);
    const on = iso() && H.isRunning() && !isTouch;
    const busy = on ? uiBusy() : true;
    if (on) updateAim();
    updateCut();
    I.hover = on && I.aimOk ? enemyAt(I.aim.x, I.aim.z, 1.0) : null;
    const showRet = on && !busy && I.mouse.ok && I.mouse.over && R.alive;
    ret.style.display = showRet ? 'block' : 'none';
    if (showRet) { ret.style.transform = 'translate(' + I.mouse.x + 'px,' + I.mouse.y + 'px)'; ret.classList.toggle('foe', !!I.hover); ret.classList.toggle('fire', I.held); }
    mk.visible = showRet && I.aimOk;
    if (mk.visible) {
      const t = I.hover; if (t) { mk.position.set(t.x, H.heightAt(t.x, t.z) + 0.06, t.z); mk.scale.setScalar(Math.max(1, t.d.radius * 1.5)); mk.material.color.setHex(0xff5a46); }
      else { mk.position.set(I.aim.x, I.aim.y + 0.06, I.aim.z); mk.scale.setScalar(1); mk.material.color.setHex(0xffb066); }
      mk.material.opacity = 0.55 + Math.sin(performance.now() / 160) * 0.25;
    }
    me.visible = iso() && H.isRunning() && R.alive; arrowG.visible = me.visible;
    if (me.visible) { const y = H.heightAt(R.x, R.z) + 0.05; me.position.set(R.x, y, R.z); arrowG.position.set(R.x, y + 0.02, R.z); arrowG.rotation.y = R.facing; }
    if (on && !busy) {
      if (I.held) { fire(); }
      else if (I.heldR) aimFace();
    }
  }
  requestAnimationFrame(loop);
  /* the right mouse button must not open the browser menu over the game */
  window.addEventListener('contextmenu', (e) => { if (H.isRunning() && iso() && !uiBusy()) e.preventDefault(); });
  /* tell the player once how to play */
  let told = false;
  setInterval(() => { if (told || !H.isRunning() || !iso() || isTouch) return; told = true; setTimeout(() => H.toast('Góc nhìn chéo: di chuột để ngắm, giữ chuột trái để đánh, chuột phải dùng kỹ năng 1. Esc đóng mọi bảng. Z đổi góc nhìn.'), 2500); }, 1000);
})();
