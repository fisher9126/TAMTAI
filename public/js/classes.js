/* Aetherfall characters (browser side): creation screen with live preview on your own model, class skill bar (keys 1-4),
   character panel (key C) with stat points / reset / advanced class, appearance of other players.
   The server validates everything; this file only sends requests and draws the answers. */
(function () {
  'use strict';
  const H = window.AF_CH, X = window.AF_CHX, RU = window.AF_RULES;
  if (!H || !X || !RU || !RU.CLASSES) { console.warn('[class] thiếu AF_CH/AF_CHX/AF_RULES.CLASSES, bỏ qua (hãy chạy apply-class.js và chép rules.js mới)'); return; }
  const A = RU.APPEARANCE, esc = H.esc, send = (m) => H.NET.send(m);
  const hex = (n) => '#' + ('000000' + n.toString(16)).slice(-6);
  const num = (n) => Number(n || 0).toLocaleString('vi-VN');
  const C = { creating: false, prof: null, basicKind: 'atk', basicCos: 0.35, autoRange: 4.5, cd: {} };
  window.AF_CLASS = C;

  /* ---------- appearance ---------- */
  function styleHair(Hm, app) {
    const THREE = window.THREE, hg = Hm.headG;
    hg.children.filter((c) => c.userData && c.userData.afHair).forEach((c) => { hg.remove(c); if (c.geometry) c.geometry.dispose(); });
    const base = hg.children[1]; if (base) base.visible = app.hs !== 3;
    const mat = new THREE.MeshStandardMaterial({ color: A.HAIRS[app.hair], roughness: 0.8 });
    const add = (geo, x, y, z, rx, rz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx || 0; m.rotation.z = rz || 0; m.castShadow = true; m.userData.afHair = true; hg.add(m); };
    if (app.hs === 1) add(new THREE.CylinderGeometry(0.36, 0.2, 0.95, 10), 0, -0.3, -0.3);
    if (app.hs === 2) for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; add(new THREE.ConeGeometry(0.11, 0.42, 6), Math.cos(a) * 0.26, 0.5, Math.sin(a) * 0.26 - 0.04, Math.sin(a) * 0.5, -Math.cos(a) * 0.5); }
  }
  function shapeScale(Hm, app) { Hm.root.scale.setScalar((RU.RACES[app.race] ? RU.RACES[app.race].scale : 1) * (app.gender === 'f' ? 0.96 : 1)); }
  let tagged = false;
  function tagRoles() {
    if (tagged) return; tagged = true;
    const defs = { skin: 0xf2c9a0, shirt: 0x3f5a8c, hair: 0x5a3a22 };
    X.PL.root.traverse((o) => { const m = o.material; if (!m || !m.color) return; const hx = m.color.getHex();
      for (const r in defs) if (hx === defs[r]) { m.userData = m.userData || {}; m.userData.afRole = r; } });
  }
  function applyOwn(app) {
    tagRoles();
    const cols = { skin: A.SKINS[app.skin], shirt: A.SHIRTS[app.shirt], hair: A.HAIRS[app.hair] };
    X.PL.root.traverse((o) => { const m = o.material, r = m && m.userData && m.userData.afRole; if (r) m.color.setHex(cols[r]); });
    styleHair(X.PL, app); shapeScale(X.PL, app);
  }
  C.colorsFor = (p) => { const a = p && p.app; return a ? { skin: A.SKINS[a.skin], shirt: A.SHIRTS[a.shirt], pants: 0x3a3348, hair: A.HAIRS[a.hair] } : null; };
  C.shape = (Hm, app) => { if (!app) return; styleHair(Hm, app); shapeScale(Hm, app); };

  /* ---------- styles ---------- */
  const css = document.createElement('style');
  css.textContent = `
  #afCharBtn{position:fixed;left:10px;top:calc(46% - 44px);z-index:40;border:2px solid #241a05;background:#9fd3ff;color:#241a05;font:700 13px system-ui,sans-serif;padding:8px 12px;border-radius:12px;cursor:pointer;box-shadow:0 3px 0 #241a05}
  #afCharBtn[hidden],#afCreate[hidden],#afChar[hidden]{display:none}
  #afCreate{position:fixed;top:0;right:0;bottom:0;width:min(420px,100%);z-index:70;overflow:auto;box-sizing:border-box;padding:14px 16px 22px;background:rgba(14,20,40,.94);color:#eef3ff;border-left:3px solid #241a05;font:13px/1.45 system-ui,sans-serif}
  #afCreate h2,#afChar h3{margin:0 0 4px;font-size:20px}
  #afCreate h4,#afChar h4{margin:14px 0 6px;font-size:12px;letter-spacing:.06em;color:#ffd96a}
  .afopts{display:grid;gap:6px}
  .afopt{display:block;text-align:left;width:100%;background:rgba(255,255,255,.07);color:#eef3ff;border:2px solid rgba(255,255,255,.14);border-radius:10px;padding:8px 10px;cursor:pointer;font:inherit}
  .afopt b{display:block;font-size:14px}.afopt small{color:#b8c4e6}
  .afopt[aria-pressed=true]{border-color:#f0bf4c;background:rgba(240,191,76,.16)}
  .afsw{display:flex;flex-wrap:wrap;gap:8px}
  .afsw button{width:30px;height:30px;border-radius:50%;border:3px solid transparent;cursor:pointer;padding:0}
  .afsw button[aria-pressed=true]{border-color:#fff;box-shadow:0 0 0 2px #241a05}
  .afrow2{display:flex;gap:8px;flex-wrap:wrap}
  .afrow2 .afopt{width:auto;flex:1;min-width:70px;text-align:center}
  #afCreate .go,#afChar button.af{background:#f0bf4c;color:#241a05;border:2px solid #241a05;border-radius:10px;padding:8px 14px;font:700 13px system-ui,sans-serif;cursor:pointer}
  #afCreate .go{width:100%;margin-top:16px;padding:12px;font-size:15px}
  #afChar{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:55;width:min(96vw,520px);max-height:84vh;overflow:auto;box-sizing:border-box;padding:14px 16px;background:rgba(18,26,52,.97);color:#eef3ff;border:3px solid #241a05;border-radius:16px;box-shadow:0 10px 0 rgba(0,0,0,.35);font:13px/1.45 system-ui,sans-serif}
  #afChar .row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 8px;border-radius:9px;background:rgba(255,255,255,.06);margin:4px 0}
  #afChar button.af{padding:4px 10px;font-size:12px}#afChar button.af.g{background:#e9edf8}#afChar button.af:disabled{opacity:.4;cursor:default}
  #afChar .mut{color:#aab6d8}
  .sk .nm{position:absolute;left:0;right:0;bottom:2px;text-align:center;font:600 9px system-ui,sans-serif;color:#eef3ff;text-shadow:0 1px 2px #000;pointer-events:none}
  .sk.dim{opacity:.4}`;
  document.head.appendChild(css);

  /* ---------- creation screen ---------- */
  const L = { race: 'human', gender: 'm', cls: 'warrior', skin: 0, hs: 0, hair: 0, shirt: 0 };
  const cr = document.createElement('div'); cr.id = 'afCreate'; cr.hidden = true; document.body.appendChild(cr);
  const swatches = (key, arr) => '<div class="afsw">' + arr.map((c, i) => '<button type="button" data-k="' + key + '" data-v="' + i + '" aria-pressed="' + (L[key] === i) + '" style="background:' + hex(c) + '"></button>').join('') + '</div>';
  function renderCreate() {
    let h = '<h2>Tạo nhân vật</h2><p class="mut" style="color:#aab6d8;margin:0 0 4px">Mô hình ở giữa màn hình đổi theo lựa chọn của bạn. Chủng tộc, giới tính và lớp không đổi được sau này.</p>';
    h += '<h4>CHỦNG TỘC</h4><div class="afopts">' + Object.keys(RU.RACES).map((k) => '<button type="button" class="afopt" data-k="race" data-v="' + k + '" aria-pressed="' + (L.race === k) + '"><b>' + RU.RACES[k].name + '</b><small>' + RU.RACES[k].desc + '</small></button>').join('') + '</div>';
    h += '<h4>GIỚI TÍNH</h4><div class="afrow2"><button type="button" class="afopt" data-k="gender" data-v="m" aria-pressed="' + (L.gender === 'm') + '"><b>Nam</b></button><button type="button" class="afopt" data-k="gender" data-v="f" aria-pressed="' + (L.gender === 'f') + '"><b>Nữ</b></button></div>';
    h += '<h4>LỚP NHÂN VẬT</h4><div class="afopts">' + Object.keys(RU.CLASSES).map((k) => { const c = RU.CLASSES[k];
      return '<button type="button" class="afopt" data-k="cls" data-v="' + k + '" aria-pressed="' + (L.cls === k) + '"><b style="color:' + c.color + '">' + c.name + '</b><small>' + c.role + '. ' + c.desc + '<br>Kỹ năng: ' + c.skills.map((s) => RU.SKILLS[s.id].name).join(' · ') + '</small></button>'; }).join('') + '</div>';
    h += '<h4>NGOẠI HÌNH</h4><small class="mut" style="color:#aab6d8">Màu da</small>' + swatches('skin', A.SKINS);
    h += '<small class="mut" style="color:#aab6d8">Kiểu tóc</small><div class="afrow2">' + A.STYLES.map((n, i) => '<button type="button" class="afopt" data-k="hs" data-v="' + i + '" aria-pressed="' + (L.hs === i) + '"><b>' + n + '</b></button>').join('') + '</div>';
    h += '<small class="mut" style="color:#aab6d8">Màu tóc</small>' + swatches('hair', A.HAIRS) + '<small class="mut" style="color:#aab6d8">Màu áo</small>' + swatches('shirt', A.SHIRTS);
    h += '<button type="button" class="go" data-go>Bắt đầu phiêu lưu</button>';
    const keep = cr.scrollTop; cr.innerHTML = h; cr.scrollTop = keep;
  }
  function previewLook() { applyOwn(L); }
  cr.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) { go.disabled = true; send({ t: 'char', op: 'create', race: L.race, gender: L.gender, cls: L.cls, skin: L.skin, hs: L.hs, hair: L.hair, shirt: L.shirt }); setTimeout(() => { go.disabled = false; }, 2500); return; }
    const b = e.target.closest('[data-k]'); if (!b) return;
    const k = b.dataset.k; L[k] = ['skin', 'hs', 'hair', 'shirt'].includes(k) ? Number(b.dataset.v) : b.dataset.v;
    renderCreate(); previewLook();
  });
  const camSave = {};
  function showCreate() {
    if (C.creating) return;
    C.creating = true; if (window.AF_COMBAT) window.AF_COMBAT.stunUntil = Infinity;
    const cam = X.cam; Object.assign(camSave, { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist });
    cam.yaw = Math.PI; cam.pitch = 0.18; cam.dist = 5.4;
    cr.hidden = false; renderCreate(); previewLook();
  }
  function closeCreate() {
    if (!C.creating) return;
    C.creating = false; cr.hidden = true; if (window.AF_COMBAT) window.AF_COMBAT.stunUntil = 0;
    const cam = X.cam; cam.yaw = 0; cam.pitch = camSave.pitch || 0.42; cam.dist = camSave.dist || 8;
  }
  window.addEventListener('keydown', (e) => { if (C.creating) e.stopImmediatePropagation(); }, true);

  /* ---------- class skill bar ---------- */
  const sks = () => (C.prof ? RU.CLASSES[C.prof.cls].skills : []);
  function ensureBtn(id, key) {
    let b = document.getElementById(id); if (b) return b;
    b = document.createElement('button'); b.className = 'sk'; b.id = id; b.type = 'button';
    b.innerHTML = '<span class="key">' + key + '</span><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 3l2.4 6.2L21 10l-5 4.3L17.5 21 12 17.6 6.5 21 8 14.3 3 10l6.6-.8z"/></svg><span class="cd"></span><span class="cdt"></span>';
    document.getElementById('sk2').after(b); b.addEventListener('click', () => useKey(key)); return b;
  }
  function paintBar() {
    const prof = C.prof; if (!prof) return;
    const cls = RU.CLASSES[prof.cls], lvl = X.P.level || 1;
    cls.skills.forEach((s, i) => {
      const b = i < 2 ? document.getElementById(i ? 'sk2' : 'sk1') : ensureBtn('sk' + (i + 1), i + 1); if (!b) return;
      const def = RU.SKILLS[s.id], a = RU.ATTACKS[s.id], cost = def.support ? def.support.mp : (a && a.mp) || 0, cd = def.support ? def.support.cd : (a && a.cd) || 0;
      b.title = def.name + ' (phím ' + (i + 1) + ') · ' + (def.desc || '') + ' · Mana ' + cost + ' · Hồi ' + cd + 's' + (lvl < s.lv ? ' · Mở ở cấp ' + s.lv : '');
      b.setAttribute('aria-label', def.name);
      let nm = b.querySelector('.nm'); if (!nm) { nm = document.createElement('span'); nm.className = 'nm'; b.appendChild(nm); }
      nm.textContent = def.name; b.classList.toggle('dim', lvl < s.lv);
      const svg = b.querySelector('svg'); if (svg) svg.setAttribute('stroke', cls.color);
    });
    const main = document.getElementById('skA'); if (main) main.title = RU.SKILLS[cls.basic].name + ' (J hoặc click chuột trái)';
  }
  function setBasics() {
    const cls = RU.CLASSES[C.prof.cls], a = RU.ATTACKS[cls.basic];
    C.basicKind = cls.basic; C.basicCos = a.cos != null ? a.cos : 0.35; C.autoRange = cls.autoRange;
  }
  C.basicRange = (combo) => (C.basicKind === 'atk' ? (combo === 2 ? 2.9 : 2.5) : RU.ATTACKS[C.basicKind].reach);

  function toastMana() { H.toast('Không đủ mana'); }
  function cast(sk, n) {
    const R = H.R; if (!X.canAct()) return true;
    const t = H.time; if ((C.cd[sk.id] || 0) > t) return true;
    const def = RU.SKILLS[sk.id];
    if (def.support) {
      if (R.mp < def.support.mp) { toastMana(); return true; }
      R.mp -= def.support.mp; C.cd[sk.id] = t + def.support.cd; if (n <= 2) R[n === 1 ? 'sk1Cd' : 'sk2Cd'] = def.support.cd;
      send({ t: 'skill', id: sk.id });
      H.popNum(R.x, H.heightAt(R.x, R.z) + 2.8, R.z, def.name, 'info');
      R.combo = 0; R.atkT = 0; R.atkHit = true; return true;
    }
    const a = RU.ATTACKS[sk.id]; if (!a) return true;
    if (R.mp < (a.mp || 0)) { toastMana(); return true; }
    const tg = X.nearestEnemy(a.reach); if (tg) X.faceToward(tg);
    if (!X.hitCone(sk.id, 0, a.reach, a.cos != null ? a.cos : 0.35)) { H.toast('Không có mục tiêu trong tầm'); return true; }
    R.mp -= a.mp || 0; C.cd[sk.id] = t + a.cd; if (n <= 2) R[n === 1 ? 'sk1Cd' : 'sk2Cd'] = a.cd;
    if (a.cos != null && a.cos < -1) { R.spinT = 0; R.spinHit = true; X.spinRing(); } else { R.combo = 0; R.atkT = 0; R.atkHit = true; R.atkCd = 0.4; }
    return true;
  }
  /* returns true when the class system handled the key; false lets the original spin / dash code run (warrior) */
  C.useKey = function (n) {
    if (!C.prof) return true;
    const sk = sks()[n - 1]; if (!sk) return true;
    const def = RU.SKILLS[sk.id];
    if ((X.P.level || 1) < sk.lv) { H.toast('<b>' + def.name + '</b> mở ở cấp ' + sk.lv); return true; }
    if (sk.id === 'spin' || sk.id === 'dash') return false;
    return cast(sk, n);
  };
  const useKey = C.useKey;
  ['sk1', 'sk2'].forEach((id, i) => { const b = document.getElementById(id); if (b) b.addEventListener('click', (e) => { if (useKey(i + 1)) e.stopImmediatePropagation(); }, true); });
  setInterval(() => {
    if (!C.prof) return; const t = H.time;
    sks().forEach((s, i) => { if (i < 2) return; const b = document.getElementById('sk' + (i + 1)); if (!b) return;
      const def = RU.SKILLS[s.id], a = RU.ATTACKS[s.id], max = def.support ? def.support.cd : (a && a.cd) || 1, rem = (C.cd[s.id] || 0) - t;
      const cd = b.querySelector('.cd'), tx = b.querySelector('.cdt'); if (cd) cd.style.height = (rem > 0 ? Math.min(100, rem / max * 100) : 0) + '%'; if (tx) tx.textContent = rem > 0 ? Math.ceil(rem) : ''; });
  }, 120);

  /* tracer for ranged skills */
  function beam(x1, y1, z1, x2, y2, z2, color) {
    const THREE = window.THREE, len = Math.hypot(x2 - x1, y2 - y1, z2 - z1) || 0.01;
    const g = new THREE.CylinderGeometry(0.07, 0.07, 1, 6); g.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.85 }));
    m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2); m.lookAt(x2, y2, z2); m.scale.set(1, 1, len); X.scene.add(m);
    setTimeout(() => { X.scene.remove(m); g.dispose(); m.material.dispose(); }, 160);
  }
  C.fx = function (kind, ids) {
    const a = RU.ATTACKS[kind]; if (!a || !C.prof || a.reach < 6) return;
    const R = H.R, color = RU.CLASSES[C.prof.cls].color, sy = H.heightAt(R.x, R.z) + 1.6;
    ids.slice(0, 4).forEach((id) => { const e = X.enemyById.get(id); if (e) beam(R.x, sy, R.z, e.x, H.heightAt(e.x, e.z) + 1.2, e.z, color); });
  };

  /* ---------- character panel (C) ---------- */
  const panel = document.createElement('div'); panel.id = 'afChar'; panel.hidden = true; document.body.appendChild(panel);
  const btn = document.createElement('button'); btn.id = 'afCharBtn'; btn.type = 'button'; btn.textContent = 'Nhân vật (C)'; btn.hidden = true; document.body.appendChild(btn);
  ['keydown', 'keyup'].forEach((ev) => panel.addEventListener(ev, (e) => e.stopPropagation()));
  [panel, btn].forEach((el) => ['pointerdown', 'mousedown'].forEach((ev) => el.addEventListener(ev, (e) => e.stopPropagation())));
  let open = false;
  function renderPanel() {
    if (!open) return;
    const pr = C.prof; if (!pr) { panel.innerHTML = '<p>Chưa có nhân vật.</p>'; return; }
    const P = X.P, lvl = P.level || 1, cls = RU.CLASSES[pr.cls], race = RU.RACES[pr.race], adv = pr.adv ? RU.ADV[pr.adv] : null, st = RU.playerStats(P);
    let h = '<div class="row"><h3 style="margin:0">' + esc(H.NET.me ? (H.NET.me.name || H.NET.me.username || '') : '') + '</h3><button class="af g" data-act="x">Đóng (C)</button></div>';
    h += '<div class="mut">' + race.name + (pr.gender === 'f' ? ' nữ' : ' nam') + ' · <b style="color:' + cls.color + '">' + cls.name + '</b>' + (adv ? ' · ' + adv.name : '') + ' · cấp ' + lvl + '</div>';
    h += '<h4>ĐIỂM CHỈ SỐ · CÒN ' + pr.points + ' ĐIỂM</h4>';
    Object.keys(RU.STATS).forEach((k) => {
      h += '<div class="row"><span><b>' + RU.STATS[k].name + ' ' + (pr.alloc[k] || 0) + '</b><br><small class="mut">' + RU.STATS[k].desc + '</small></span><span><button class="af" data-act="alloc" data-s="' + k + '" data-n="1"' + (pr.points < 1 ? ' disabled' : '') + '>+1</button> <button class="af" data-act="alloc" data-s="' + k + '" data-n="5"' + (pr.points < 1 ? ' disabled' : '') + '>+5</button></span></div>';
    });
    const cost = lvl < 10 ? 0 : lvl * 50;
    h += '<div class="row"><span>Tẩy điểm <small class="mut">' + (cost ? '(tốn ' + num(cost) + ' vàng)' : '(miễn phí dưới cấp 10)') + '</small></span><button class="af g" data-act="reset">Tẩy điểm</button></div>';
    h += '<h4>CHỈ SỐ HIỆN TẠI</h4><div class="row"><span>Máu ' + num(st.maxHp) + ' · Mana ' + num(st.maxMp) + ' · Sức đánh ' + num(st.atk) + '</span><span>Giáp ' + st.def + ' · Chí mạng ' + st.crit + '% · Tốc độ +' + st.spd + '%</span></div>';
    h += '<h4>KỸ NĂNG</h4><div class="row"><span><b>' + RU.SKILLS[cls.basic].name + '</b> <small class="mut">đánh thường · J / click</small></span></div>';
    cls.skills.forEach((s, i) => { const d = RU.SKILLS[s.id], ok = lvl >= s.lv;
      h += '<div class="row" style="opacity:' + (ok ? 1 : 0.55) + '"><span><b>' + (i + 1) + '. ' + d.name + '</b> <small class="mut">' + (d.desc || '') + '</small></span><span><small>' + (ok ? 'đã mở' : 'cấp ' + s.lv) + '</small></span></div>'; });
    h += '<h4>LỚP NÂNG CAO (CẤP ' + RU.ADV_LEVEL + ')</h4>';
    if (adv) h += '<div class="row"><span><b>' + adv.name + '</b> <small class="mut">' + adv.desc + '</small></span></div>';
    else Object.keys(RU.ADV).filter((k) => RU.ADV[k].cls === pr.cls).forEach((k) => {
      h += '<div class="row"><span><b>' + RU.ADV[k].name + '</b><br><small class="mut">' + RU.ADV[k].desc + '</small></span><button class="af" data-act="adv" data-a="' + k + '"' + (lvl < RU.ADV_LEVEL ? ' disabled' : '') + '>' + (lvl < RU.ADV_LEVEL ? 'Cấp ' + RU.ADV_LEVEL : 'Chọn') + '</button></div>'; });
    panel.innerHTML = h;
  }
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; const a = b.dataset.act;
    if (a === 'x') toggle(false);
    else if (a === 'alloc') send({ t: 'char', op: 'alloc', stat: b.dataset.s, n: Number(b.dataset.n) });
    else if (a === 'reset') { if (confirm('Tẩy toàn bộ điểm chỉ số?')) send({ t: 'char', op: 'reset' }); }
    else if (a === 'adv') { const d = RU.ADV[b.dataset.a]; if (confirm('Lên lớp nâng cao "' + d.name + '"? Không đổi được sau này.')) send({ t: 'char', op: 'advance', adv: b.dataset.a }); }
  });
  function toggle(v) { open = v === undefined ? !open : v; panel.hidden = !open; if (open) renderPanel(); }
  btn.addEventListener('click', () => toggle());
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'c' && e.key !== 'C') return;
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (!H.isRunning() || C.creating || e.ctrlKey || e.metaKey || e.altKey) return;
    toggle();
  });
  setInterval(() => { btn.hidden = !H.isRunning() || !C.prof; }, 500);

  /* ---------- server messages ---------- */
  C.onNet = function (m) {
    switch (m.t) {
      case 'char':
        if (m.st === 'create') { showCreate(); return true; }
        { const prof = { race: m.race, gender: m.gender, cls: m.cls, adv: m.adv, app: m.app, alloc: m.alloc, points: m.points };
          const bar = { race: m.race, gender: m.gender, skin: m.app.skin, hs: m.app.hs, hair: m.app.hair, shirt: m.app.shirt };
          C.prof = prof; setBasics(); applyOwn(bar); closeCreate(); paintBar(); renderPanel();
          if (m.st === 'ok') H.toast('<b>' + esc(RU.CLASSES[m.cls].name) + '</b>: phím 1-4 dùng kỹ năng, C mở bảng nhân vật'); }
        return true;
      case 'app': { const o = H.others.get(m.id); if (o) X.addOther({ id: o.id, name: o.name, role: o.role, level: o.level, x: o.x, z: o.z, f: o.f, anim: o.anim, eq: o.eq, app: m.app }); return true; }
      case 'revived': X.revive(); H.toast('Bạn đã được hồi sinh!'); return true;
      case 'me': setTimeout(() => { paintBar(); renderPanel(); }, 0); return false;
      default: return false;
    }
  };
  /* the game calls AF_CLASS.onNet from its message handler (see apply-class.js) */
})();
