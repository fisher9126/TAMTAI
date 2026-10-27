/* Aetherfall step 3 (browser side): new zones (scenery, names), gathering nodes, professions panel (P), crafting,
   consumable buffs, the party dungeon HUD, and recolored / resized monster models.
   The server decides everything; this file only sends requests (E = gather / enter dungeon, P = panel) and draws answers. */
(function () {
  'use strict';
  const H = window.AF_CH, X = window.AF_CHX, RU = window.AF_RULES, THREE = window.THREE;
  if (!H || !X || !RU || !THREE || !RU.ZONES || !RU.RECIPES) { console.warn('[zones] thiếu AF_CH/AF_CHX/AF_RULES.ZONES, bỏ qua (hãy chạy apply-zones.js và chép rules.js mới)'); return; }
  const esc = H.esc, send = (m) => H.NET.send(m), W = RU.WORLD, DUN = RU.DUNGEON, S = X.scene;
  const num = (n) => Number(n || 0).toLocaleString('vi-VN');
  const Z = { prof: {}, mats: {}, cons: {}, buffs: {}, dun: null, run: null, open: false, tab: 'prof', filter: 'smith' };
  window.AF_ZONES = Z;
  const rng = (seed) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const M = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85, flatShading: true }, o || {}));
  function put(obj, x, z, dy, ry, shadow) {
    obj.position.set(x, H.heightAt(x, z) + (dy || 0), z); if (ry != null) obj.rotation.y = ry;
    if (shadow) obj.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    S.add(obj); return obj;
  }
  function textSprite(text, color, w) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d');
    g.font = '700 38px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(text, 256, 48); g.fillStyle = color || '#ffd96a'; g.fillText(text, 256, 48);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    sp.scale.set(w || 8, (w || 8) * 0.1875, 1); return sp;
  }

  /* ---------- zone names and enemy look ---------- */
  Z.nameAt = function (x, zz) {
    for (const z of RU.ZONES) if (Math.hypot(x - z.x, zz - z.z) < z.r) return z.name + ' (Lv ' + z.lv + ')';
    return null;
  };
  /* recolor / resize a freshly built monster model (called from spawnEnemyNet before the model joins the scene) */
  Z.skin = function (d, built) {
    if (d.scale && !d._lhs) { d.lh = (d.lh || 2) * d.scale; d._lhs = 1; }
    if (d.tint) {
      const tc = new THREE.Color(d.tint);
      built.g.traverse((o) => {
        if (!o.material) return;
        const tint = (m) => { const c = m.clone(); if (c.color && !(c.emissive && c.emissive.getHex() !== 0)) c.color.lerp(tc, 0.55); return c; };
        o.material = Array.isArray(o.material) ? o.material.map(tint) : tint(o.material);
      });
    }
    if (d.scale) built.g.scale.setScalar(d.scale);
  };

  /* ---------- scenery ---------- */
  function patchTex(col) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 6, 64, 64, 62);
    gr.addColorStop(0, col + 'cc'); gr.addColorStop(0.7, col + '77'); gr.addColorStop(1, col + '00');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  }
  function groundPatch(z) {
    const size = z.r * 2.3, seg = 30, geo = new THREE.PlaneGeometry(size, size, seg, seg); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, H.heightAt(z.x + pos.getX(i), z.z + pos.getZ(i)) + 0.12);
    pos.needsUpdate = true;
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: patchTex(z.col), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.position.set(z.x, 0, z.z); m.renderOrder = 1; S.add(m);
    const sg = textSprite(z.name + ' · Lv ' + z.lv, '#ffe9a8', 10); sg.position.set(z.x, H.heightAt(z.x, z.z) + 9, z.z); S.add(sg);
  }
  function swampProps() {
    const r = rng(11), c = W.SWAMP, caps = [0xd95a5a, 0x9be15d, 0xb48cff, 0xffd95a];
    for (let i = 0; i < 34; i++) {
      const a = r() * 6.283, d = 2 + r() * 17, s = 0.6 + r() * 1.4, g = new THREE.Group(), col = caps[(r() * caps.length) | 0];
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.17 * s, 0.9 * s, 6), M(0xe9e2c8)); st.position.y = 0.45 * s; g.add(st);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.55 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(col, { emissive: col, emissiveIntensity: 0.25 })); cap.position.y = 0.9 * s; g.add(cap);
      put(g, c.x + Math.cos(a) * d, c.z + Math.sin(a) * d, 0, r() * 6.28);
    }
    for (let i = 0; i < 7; i++) {
      const a = r() * 6.283, d = 4 + r() * 15, h = 3 + r() * 2, g = new THREE.Group();
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, h, 6), M(0x3b2e22)); tr.position.y = h / 2; g.add(tr);
      for (let k = 0; k < 2; k++) { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 1.6, 5), M(0x3b2e22)); br.position.set(k ? 0.6 : -0.6, h * 0.7, 0); br.rotation.z = k ? -0.9 : 0.9; g.add(br); }
      put(g, c.x + Math.cos(a) * d, c.z + Math.sin(a) * d, 0, r() * 6.28, true);
    }
  }
  function mineProps() {
    const r = rng(23), c = W.MINE, greys = [0x6e6a66, 0x7d7873, 0x8a8580, 0x5f5b58];
    for (let i = 0; i < 28; i++) {
      const a = r() * 6.283, d = 2 + r() * 18, s = 0.5 + r() * 1.3;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), M(greys[(r() * 4) | 0])); rock.scale.y = 0.7;
      put(rock, c.x + Math.cos(a) * d, c.z + Math.sin(a) * d, s * 0.3, r() * 6.28, s > 1);
    }
    const g = new THREE.Group();
    [-2.2, 2.2].forEach((dx) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.2, 0.5), M(0x6b4a2a)); p.position.set(dx, 2.1, 0); g.add(p); });
    const bm = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.5, 0.6), M(0x6b4a2a)); bm.position.y = 4.2; g.add(bm);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffd36a })); lamp.position.set(0, 3.6, 0.3); g.add(lamp);
    put(g, c.x, c.z + 6, 0, 0, true);
    for (let i = 0; i < 6; i++) { const a = r() * 6.283, d = 3 + r() * 10; put(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), M(0x8a6a3a)), c.x + Math.cos(a) * d, c.z + Math.sin(a) * d, 0.45, r() * 6.28); }
  }
  function frostProps() {
    const r = rng(37), c = W.FROST;
    for (let i = 0; i < 24; i++) {
      const a = r() * 6.283, d = 2 + r() * 15, h = 1 + r() * 2.4;
      const cr = new THREE.Mesh(new THREE.ConeGeometry(0.35 + r() * 0.3, h, 4), M(0x9fd3ff, { emissive: 0x3a7fc0, emissiveIntensity: 0.35, transparent: true, opacity: 0.85 }));
      put(cr, c.x + Math.cos(a) * d, c.z + Math.sin(a) * d, h / 2, r() * 3, true);
    }
    for (let i = 0; i < 16; i++) { const a = r() * 6.283, d = 2 + r() * 16, s = 0.8 + r() * 1.4; const sn = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), M(0xf2f8ff)); sn.scale.y = 0.4; put(sn, c.x + Math.cos(a) * d, c.z + Math.sin(a) * d, 0, 0); }
    for (let i = 0; i < 10; i++) {
      const a = r() * 6.283, d = 5 + r() * 12, g = new THREE.Group();
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.2, 5), M(0x4a3626)); tr.position.y = 0.6; g.add(tr);
      for (let k = 0; k < 3; k++) { const co = new THREE.Mesh(new THREE.ConeGeometry(1.5 - k * 0.4, 1.8, 7), M(k === 2 ? 0xf2f8ff : 0x2f6a4a)); co.position.y = 1.7 + k * 1.1; g.add(co); }
      put(g, c.x + Math.cos(a) * d, c.z + Math.sin(a) * d, 0, 0, true);
    }
  }
  const spin = []; // things animated every frame
  function dungeonProps() {
    const c = W.DUNGEON, R = DUN.roomR;
    for (let i = 0; i < 11; i++) {
      const a = Math.PI * 1.7 + (i / 10) * Math.PI * 1.6; // the arc leaves the south side (toward the village) open
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.5, 6.5, 1.5), M(0x2f2740)); put(p, c.x + Math.cos(a) * R, c.z + Math.sin(a) * R, 3.2, -a, true);
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), new THREE.MeshBasicMaterial({ color: 0xb06bff })); put(fl, c.x + Math.cos(a) * (R - 1.2), c.z + Math.sin(a) * (R - 1.2), 6.8, 0);
    }
    [R * 0.55, R * 0.8].forEach((rad) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(rad - 0.25, rad, 48), new THREE.MeshBasicMaterial({ color: 0x8a4fe0, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(c.x, H.heightAt(c.x, c.z) + 0.25, c.z); S.add(ring);
    });
    const gate = new THREE.Group();
    [-3, 3].forEach((dx) => { const p = new THREE.Mesh(new THREE.BoxGeometry(1.4, 7, 1.4), M(0x3a2f4a)); p.position.set(dx, 3.5, 0); gate.add(p); });
    const lt = new THREE.Mesh(new THREE.BoxGeometry(7.6, 1.2, 1.4), M(0x3a2f4a)); lt.position.y = 7.2; gate.add(lt);
    put(gate, c.x, c.z - R - 1, 0, 0, true);
    const sg = textSprite(DUN.name, '#d9b8ff', 10); sg.position.set(c.x, H.heightAt(c.x, c.z) + 10, c.z); S.add(sg);
  }
  let portalDisc = null;
  function portalProps() {
    const c = W.PORTAL, g = new THREE.Group();
    [-2.6, 2.6].forEach((dx) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 5, 0.9), M(0x4a4060)); p.position.set(dx, 2.5, 0); g.add(p); });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.22, 8, 36), M(0x8a4fe0, { emissive: 0x8a4fe0, emissiveIntensity: 0.9 })); ring.position.y = 2.7; g.add(ring);
    portalDisc = new THREE.Mesh(new THREE.CircleGeometry(2.1, 32), new THREE.MeshBasicMaterial({ color: 0x9a6bff, transparent: true, opacity: 0.45, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    portalDisc.position.y = 2.7; g.add(portalDisc);
    put(g, c.x, c.z, 0, 0, true);
    const sg = textSprite('Cổng ' + DUN.name + ' · Lv ' + DUN.minLv + '+', '#d9b8ff', 9); sg.position.set(c.x, H.heightAt(c.x, c.z) + 6.6, c.z); S.add(sg);
  }
  try {
    RU.ZONES.forEach(groundPatch); swampProps(); mineProps(); frostProps(); dungeonProps(); portalProps();
  } catch (err) { console.error('zones scenery', err); }

  /* ---------- gathering nodes ---------- */
  const nodes = new Map(); // id -> { id, type, x, z, on, g }
  const NCOL = { herb: 0x58c46a, shroom: 0x9be15d, frost: 0x9fd3ff, ore: 0xc48a52, coal: 0x6a6a78 };
  function nodeMesh(type) {
    const g = new THREE.Group(), col = NCOL[type];
    if (type === 'herb') for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.9 + i * 0.1, 5), M(0x58c46a)); m.position.set((i - 1.5) * 0.18, 0.45, (i % 2) * 0.15); m.rotation.z = (i - 1.5) * 0.12; g.add(m); }
    else if (type === 'shroom') { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.7, 6), M(0xe9e2c8)); st.position.y = 0.35; g.add(st); const cp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(col, { emissive: col, emissiveIntensity: 0.6 })); cp.position.y = 0.7; g.add(cp); }
    else if (type === 'frost') { const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), M(col, { emissive: 0x3a7fc0, emissiveIntensity: 0.7 })); cr.position.y = 0.8; cr.scale.y = 1.5; g.add(cr); g.userData.bob = cr; }
    else { const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), M(type === 'ore' ? 0x7d7873 : 0x2c2c34)); rk.scale.y = 0.8; rk.position.y = 0.5; g.add(rk);
      for (let i = 0; i < 3; i++) { const gm = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: type === 'ore' ? 0xffa64a : 0x9aa0ff })); gm.position.set(Math.cos(i * 2.1) * 0.55, 0.6 + i * 0.1, Math.sin(i * 2.1) * 0.55); g.add(gm); } }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.05, 24), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; g.add(ring);
    return g;
  }
  function setNodes(list) {
    nodes.forEach((n) => S.remove(n.g)); nodes.clear();
    list.forEach((r) => { const n = { id: r[0], type: r[1], x: r[2], z: r[3], on: !!r[4], g: nodeMesh(r[1]) }; n.g.position.set(n.x, H.heightAt(n.x, n.z), n.z); n.g.visible = n.on; S.add(n.g); nodes.set(n.id, n); });
  }

  /* ---------- interaction prompt (E) ---------- */
  const css = document.createElement('style');
  css.textContent = `
  #afZPrompt{position:fixed;left:50%;bottom:150px;transform:translateX(-50%);z-index:30;padding:6px 14px;border-radius:999px;background:rgba(13,18,31,.9);border:2px solid #f0bf4c;color:#f1ebde;font:600 13px system-ui,sans-serif;pointer-events:none}
  #afZBtn{position:fixed;left:10px;top:calc(46% - 88px);z-index:40;border:2px solid #241a05;background:#b8e6a0;color:#241a05;font:700 13px system-ui,sans-serif;padding:8px 12px;border-radius:12px;cursor:pointer;box-shadow:0 3px 0 #241a05}
  #afZ{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:55;width:min(96vw,560px);max-height:84vh;overflow:auto;box-sizing:border-box;padding:14px 16px;background:rgba(18,26,52,.97);color:#eef3ff;border:3px solid #241a05;border-radius:16px;box-shadow:0 10px 0 rgba(0,0,0,.35);font:13px/1.45 system-ui,sans-serif}
  #afZ .row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 8px;border-radius:9px;background:rgba(255,255,255,.06);margin:4px 0}
  #afZ .mut{color:#aab6d8}#afZ h4{margin:12px 0 6px;font-size:12px;letter-spacing:.06em;color:#ffd96a}
  #afZ .tabs{display:flex;gap:6px;margin:8px 0;flex-wrap:wrap}
  #afZ button.afz{background:#f0bf4c;color:#241a05;border:2px solid #241a05;border-radius:10px;padding:5px 11px;font:700 12px system-ui,sans-serif;cursor:pointer}
  #afZ button.afz.g{background:#e9edf8}#afZ button.afz[disabled]{opacity:.4;cursor:default}#afZ button.afz.on{background:#fff3c4;box-shadow:0 0 0 2px #f0bf4c}
  #afZ .bar{height:6px;border-radius:4px;background:rgba(0,0,0,.45);overflow:hidden;margin-top:3px}#afZ .bar i{display:block;height:100%;background:#79d08a}
  #afZ .mats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
  #afZ .mat{padding:6px 8px;border-radius:9px;background:rgba(255,255,255,.06)}
  #afZDun{position:fixed;left:50%;top:112px;transform:translateX(-50%);z-index:20;min-width:260px;padding:8px 14px;border-radius:10px;background:rgba(30,18,52,.92);border:2px solid #9a6bff;color:#f1ebde;font:600 13px system-ui,sans-serif;text-align:center;pointer-events:none}
  #afZBuff{position:fixed;left:16px;top:146px;z-index:20;display:flex;gap:6px;flex-wrap:wrap;max-width:260px;pointer-events:none}
  #afZBuff span{padding:2px 8px;border-radius:999px;background:rgba(13,18,31,.85);border:1px solid #ffd96a;color:#ffd96a;font:700 12px system-ui,sans-serif}
  #afZPrompt[hidden],#afZBtn[hidden],#afZ[hidden],#afZDun[hidden],#afZBuff[hidden]{display:none}`;
  document.head.appendChild(css);
  const prompt = document.createElement('div'); prompt.id = 'afZPrompt'; prompt.hidden = true;
  const btn = document.createElement('button'); btn.id = 'afZBtn'; btn.type = 'button'; btn.textContent = 'Nghề (P)'; btn.hidden = true;
  const panel = document.createElement('div'); panel.id = 'afZ'; panel.hidden = true;
  const dunEl = document.createElement('div'); dunEl.id = 'afZDun'; dunEl.hidden = true;
  const buffEl = document.createElement('div'); buffEl.id = 'afZBuff'; buffEl.hidden = true;
  document.body.append(prompt, btn, panel, dunEl, buffEl);
  ['keydown', 'keyup'].forEach((ev) => panel.addEventListener(ev, (e) => e.stopPropagation()));
  [panel, btn].forEach((el) => ['pointerdown', 'mousedown'].forEach((ev) => el.addEventListener(ev, (e) => e.stopPropagation())));

  let target = null; // { kind:'node'|'portal', node }
  function profLv(k) { return (Z.prof[k] && Z.prof[k][0]) || 1; }
  function findTarget() {
    const R = H.R; let best = null, bd = 3.6;
    nodes.forEach((n) => { if (!n.on) return; const d = Math.hypot(n.x - R.x, n.z - R.z); if (d < bd) { bd = d; best = { kind: 'node', node: n }; } });
    if (best) return best;
    if (Math.hypot(W.PORTAL.x - R.x, W.PORTAL.z - R.z) < 6) return { kind: 'portal' };
    return null;
  }
  function refreshPrompt() {
    if (!H.isRunning() || !H.R.alive || (window.AF_CLASS && window.AF_CLASS.creating)) { prompt.hidden = true; target = null; return; }
    target = findTarget();
    if (!target) { prompt.hidden = true; return; }
    if (target.kind === 'node') {
      const d = RU.NODES[target.node.type], ok = profLv(d.prof) >= d.lv;
      prompt.textContent = ok ? 'Nhấn E: lấy ' + d.name : d.name + ' cần ' + RU.PROFS[d.prof].name + ' cấp ' + d.lv;
      prompt.style.opacity = ok ? 1 : 0.7;
    } else { prompt.textContent = Z.run ? 'Nhấn E: quay lại ' + DUN.name : 'Nhấn E: vào ' + DUN.name + ' (Lv ' + DUN.minLv + '+, đội trưởng mở cổng)'; prompt.style.opacity = 1; }
    prompt.hidden = false;
  }
  setInterval(refreshPrompt, 150);
  function interact() {
    if (!target) return;
    if (target.kind === 'node') send({ t: 'zone', op: 'gather', id: target.node.id });
    else send({ t: 'zone', op: 'dun', act: 'enter' });
  }

  /* ---------- panel (P) ---------- */
  const bar = (v, max) => '<div class="bar"><i style="width:' + Math.max(0, Math.min(100, v / Math.max(1, max) * 100)) + '%"></i></div>';
  function recipeRow(rc) {
    const lv = profLv(rc.prof), okLv = lv >= rc.lv, gold = (X.P && X.P.gold) || 0;
    let okMats = true;
    const need = Object.keys(rc.mats).map((k) => { const have = Z.mats[k] || 0, ok = have >= rc.mats[k]; if (!ok) okMats = false; return '<span style="color:' + (ok ? '#9be15d' : '#ff8a78') + '">' + RU.MATS[k].name + ' ' + have + '/' + rc.mats[k] + '</span>'; }).join(' · ');
    const outTxt = rc.out.kind === 'gear' ? 'Trang bị ' + window.AF_ITEMS.RNAME[rc.out.rarity] + ', cấp vật phẩm ' + RU.forgeIlvl((X.P && X.P.level) || 1, lv)
      : rc.out.kind === 'potion' ? '+' + rc.out.n + ' bình máu' : RU.CONS[rc.out.id].desc;
    const can = okLv && okMats && gold >= rc.gold;
    return '<div class="row" style="opacity:' + (okLv ? 1 : 0.55) + '"><span><b>' + esc(rc.name) + '</b> <small class="mut">cấp ' + rc.lv + ' · ' + rc.gold + ' vàng</small><br><small class="mut">' + esc(outTxt) + '</small><br><small>' + need + '</small></span>' +
      '<button class="afz" data-a="craft" data-id="' + rc.id + '"' + (can ? '' : ' disabled') + '>Chế</button></div>';
  }
  function render() {
    if (!Z.open) return;
    const tabs = [['prof', 'Nghề'], ['mats', 'Kho'], ['craft', 'Chế tạo'], ['dun', 'Hầm ngục']];
    let h = '<div class="row"><b style="font-size:18px">Nghề &amp; hầm ngục</b><button class="afz g" data-a="x">Đóng (P)</button></div>';
    h += '<div class="tabs">' + tabs.map((t) => '<button class="afz' + (Z.tab === t[0] ? ' on' : '') + '" data-a="tab" data-v="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>';
    if (Z.tab === 'prof') {
      Object.keys(RU.PROFS).forEach((k) => {
        const d = RU.PROFS[k], lv = profLv(k), xp = (Z.prof[k] && Z.prof[k][1]) || 0, max = lv >= RU.PROF_MAX;
        h += '<div class="row" style="display:block"><b>' + d.name + '</b> <small class="mut">cấp ' + lv + (max ? ' (tối đa)' : ' · ' + xp + '/' + RU.profNeed(lv) + ' kinh nghiệm') + ' · ' + (d.kind === 'gather' ? 'khai thác' : 'chế tạo') + '</small><br><small class="mut">' + d.desc + '</small>' + (max ? '' : bar(xp, RU.profNeed(lv))) + '</div>';
      });
      h += '<h4>CÁCH CHƠI</h4><div class="mut">Nhấn <b>E</b> khi đứng cạnh điểm khai thác (nấm, quặng, hoa băng, cỏ trà) để lấy nguyên liệu; quái cũng rơi nguyên liệu. Mở tab Chế tạo để rèn trang bị, pha thuốc, nấu ăn. Thuốc và món ăn dùng ở tab Kho.</div>';
    } else if (Z.tab === 'mats') {
      h += '<h4>NGUYÊN LIỆU</h4><div class="mats">' + Object.keys(RU.MATS).map((k) => '<div class="mat"><span style="color:' + RU.MATS[k].c + '">' + RU.MATS[k].name + '</span><br><b>' + (Z.mats[k] || 0) + '</b></div>').join('') + '</div>';
      h += '<h4>THUỐC VÀ MÓN ĂN</h4>';
      const have = Object.keys(RU.CONS).filter((k) => (Z.cons[k] || 0) > 0);
      h += have.length ? have.map((k) => '<div class="row"><span><b>' + RU.CONS[k].name + '</b> x' + Z.cons[k] + '<br><small class="mut">' + RU.CONS[k].desc + '</small></span><button class="afz" data-a="use" data-id="' + k + '">Dùng</button></div>').join('') : '<div class="mut">Chưa có món nào. Chế ở tab Chế tạo.</div>';
      const bk = Object.keys(Z.buffs);
      if (bk.length) h += '<h4>ĐANG CÓ HIỆU ỨNG</h4>' + bk.map((k) => '<div class="row"><span><b>' + RU.BUFF_NAME[k] + '</b> ' + (k === 'spd' ? '+' + Z.buffs[k].v + '%' : '+' + Math.round(Z.buffs[k].v * 100) + '%') + '</span><span class="mut">còn ' + Math.max(0, Math.ceil((Z.buffs[k].until - Date.now()) / 1000)) + 's</span></div>').join('');
    } else if (Z.tab === 'craft') {
      h += '<div class="tabs">' + ['smith', 'alchemy', 'cooking'].map((k) => '<button class="afz' + (Z.filter === k ? ' on' : '') + '" data-a="filter" data-v="' + k + '">' + RU.PROFS[k].name + ' (cấp ' + profLv(k) + ')</button>').join('') + '</div>';
      h += RU.RECIPES.filter((r) => r.prof === Z.filter).map(recipeRow).join('');
    } else {
      const d = Z.dun || {};
      h += '<div class="row" style="display:block"><b>' + DUN.name + '</b><br><small class="mut">Cổng ở phía Nam làng (vòng sáng tím). Cấp ' + DUN.minLv + '+, tối đa 4 người trong tổ đội, ' + DUN.waves + ' đợt (đợt cuối là boss Re Tro Đen), giới hạn ' + DUN.minutes + ' phút. Đội đông thì quái mạnh hơn. Đội trưởng nhấn E ở cổng để mở, thành viên đứng gần cổng sẽ vào cùng.</small></div>';
      h += '<div class="row"><span>Lượt hôm nay còn <b>' + (d.left != null ? d.left : '?') + '/' + (d.max || DUN.dailyMax) + '</b> · Đã thắng ' + (d.clears || 0) + ' lần</span></div>';
      h += '<div class="row"><span class="mut">Phần thưởng: kinh nghiệm, vàng, bình máu, nguyên liệu hiếm (Lõi tro, Đá quý). Boss rơi trang bị Sử thi / Huyền thoại.</span></div>';
      h += '<div class="row">' + (Z.run ? '<button class="afz" data-a="enter">Quay lại hầm ngục</button><button class="afz g" data-a="leave">Rời khỏi lượt này</button>' : '<button class="afz" data-a="enter">Vào hầm ngục</button><span class="mut">phải đứng gần cổng</span>') + '</div>';
    }
    panel.innerHTML = h;
  }
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const a = b.dataset.a;
    if (a === 'x') toggle(false);
    else if (a === 'tab') { Z.tab = b.dataset.v; render(); }
    else if (a === 'filter') { Z.filter = b.dataset.v; render(); }
    else if (a === 'craft') send({ t: 'zone', op: 'craft', id: b.dataset.id });
    else if (a === 'use') send({ t: 'zone', op: 'use', id: b.dataset.id });
    else if (a === 'enter') send({ t: 'zone', op: 'dun', act: 'enter' });
    else if (a === 'leave') { if (confirm('Rời khỏi hầm ngục? Bạn sẽ không vào lại được lượt này.')) send({ t: 'zone', op: 'dun', act: 'leave' }); }
  });
  function toggle(v) { Z.open = v === undefined ? !Z.open : v; panel.hidden = !Z.open; if (Z.open) { send({ t: 'zone', op: 'info' }); render(); } }
  btn.addEventListener('click', () => toggle());
  window.addEventListener('keydown', (e) => {
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (!H.isRunning() || e.ctrlKey || e.metaKey || e.altKey || e.repeat || (window.AF_CLASS && window.AF_CLASS.creating)) return;
    const k = (e.code || '').indexOf('Key') === 0 ? e.code.slice(3).toLowerCase() : String(e.key).toLowerCase();
    if (k === 'e') interact(); else if (k === 'p') toggle();
  });
  setInterval(() => { btn.hidden = !H.isRunning() || !!(window.AF_CLASS && window.AF_CLASS.creating); }, 500);

  /* ---------- HUD: buffs, dungeon, zone toasts ---------- */
  function paintBuffs() {
    const t = Date.now(), live = Object.keys(Z.buffs).filter((k) => Z.buffs[k].until > t);
    buffEl.hidden = !live.length || !H.isRunning();
    buffEl.innerHTML = live.map((k) => '<span>' + RU.BUFF_NAME[k] + ' ' + (k === 'spd' ? '+' + Z.buffs[k].v + '%' : '+' + Math.round(Z.buffs[k].v * 100) + '%') + ' · ' + Math.ceil((Z.buffs[k].until - t) / 1000) + 's</span>').join('');
  }
  setInterval(paintBuffs, 1000);
  function paintDun() {
    const r = Z.run; dunEl.hidden = !r || !H.isRunning(); if (!r) return;
    const mm = Math.floor(r.secs / 60), ss = ('0' + (r.secs % 60)).slice(-2);
    dunEl.innerHTML = '<b>' + esc(DUN.name) + '</b> · ' + (r.clear ? 'Hoàn thành! Sắp ra khỏi hầm ngục' : r.wave === 0 || r.wait ? 'Chuẩn bị... ' + r.wait + 's' : 'Đợt ' + r.wave + '/' + r.waves + ' · còn ' + r.left + ' quái') + ' · ' + mm + ':' + ss;
  }
  let lastZone = null;
  setInterval(() => {
    if (!H.isRunning()) return;
    const n = Z.nameAt(H.R.x, H.R.z);
    if (n !== lastZone) { lastZone = n; if (n) H.toast('Bạn vào <b>' + esc(n) + '</b>'); }
  }, 700);

  /* ---------- per-frame animation ---------- */
  (function loop() {
    const t = performance.now() / 1000;
    if (portalDisc) portalDisc.rotation.z = t * 0.8;
    nodes.forEach((n) => { if (n.on && n.g.userData.bob) n.g.userData.bob.rotation.y = t * 1.4; });
    requestAnimationFrame(loop);
  })();

  /* ---------- server messages ---------- */
  const lines = (m) => Object.keys(m).map((k) => '+' + m[k] + ' ' + (RU.MATS[k] ? RU.MATS[k].name : k)).join(', ');
  Z.onNet = function (m) {
    switch (m.t) {
      case 'nodes': setNodes(m.list || []); return true;
      case 'node': { const n = nodes.get(m.id); if (n) { n.on = !!m.on; n.g.visible = n.on; } return true; }
      case 'zinfo': {
        Z.prof = m.prof || {}; Z.mats = m.mats || {}; Z.cons = m.cons || {}; Z.dun = m.dun || null;
        Z.buffs = {}; const t = Date.now(); Object.keys(m.buffs || {}).forEach((k) => { Z.buffs[k] = { v: m.buffs[k][0], until: t + m.buffs[k][1] * 1000 }; });
        if (m.dun && !m.dun.active && Z.run) { Z.run = null; paintDun(); }
        paintBuffs(); render(); return true; }
      case 'zgain': {
        const R = H.R, x = m.prof ? R.x : m.x, z = m.prof ? R.z : m.z;
        H.popNum(x, H.heightAt(x, z) + 2.6, z, lines(m.mats || {}) + (m.xp ? ' · +' + m.xp + ' xp' : ''), 'info');
        if (m.up) H.toast('<b>' + RU.PROFS[m.prof].name + '</b> lên cấp ' + m.up + '!', true);
        return true; }
      case 'zcraft':
        H.toast('Đã chế <b>' + esc(m.name) + '</b>' + (m.item ? ' · ' + esc(m.item.name) : ''));
        if (m.note) H.chatLine('sys', esc(m.note));
        if (m.up) H.toast('<b>' + RU.PROFS[m.prof].name + '</b> lên cấp ' + m.up + '!', true);
        return true;
      case 'erem': (m.ids || []).forEach((id) => { if (window.AF_ENEMIES) window.AF_ENEMIES.remove(id); }); return true;
      case 'dun':
        if (m.st === 'start') { Z.run = { wave: 0, waves: DUN.waves, left: 0, secs: DUN.minutes * 60, wait: 8, clear: false }; H.toast('<b>' + esc(m.name) + '</b>: đội ' + m.n + ' người, ' + m.minutes + ' phút!', true); paintDun(); }
        else if (m.st === 'hud') { Z.run = { wave: m.wave, waves: m.waves, left: m.left, secs: m.secs, wait: m.wait, clear: m.clear }; paintDun(); }
        else if (m.st === 'wave') H.toast(m.boss ? '<b>Boss Re Tro Đen xuất hiện!</b>' : 'Đợt <b>' + m.wave + '/' + m.waves + '</b>', true);
        else if (m.st === 'end') {
          if (m.win) {
            H.toast('<b>Hoàn thành hầm ngục!</b>', true);
            H.chatLine('sys', 'Phần thưởng hầm ngục: ' + num(m.exp) + ' EXP, ' + num(m.gold) + ' vàng, 3 bình máu, ' + esc(lines(m.mats || {})) + (m.lvUp ? '. Lên cấp ' + m.lvUp + '!' : ''));
            if (Z.run) { Z.run.clear = true; paintDun(); }
          } else { H.toast('Hầm ngục thất bại. ' + esc(m.reason || ''), true); Z.run = null; paintDun(); }
        } else if (m.st === 'left') { Z.run = null; paintDun(); }
        return true;
      default: return false;
    }
  };
})();
