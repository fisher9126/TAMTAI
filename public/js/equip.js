/* Aetherfall step 11 (browser): extended equipment panel (key J) and the visible look of equipment on the 3D models.
   Tabs: worn gear and durability, bag of gloves / pants / off-hand, gems, crafting, appearance (transmog), personal storage.
   The server decides everything; this file draws and sends requests. The 3D look is an overlay built from simple shapes sized from each model's
   own height, so it is a best-effort visual: if a piece sits in the wrong place, change the OFF table below. */
(function () {
  'use strict';
  const H = window.AF_CH, X = window.AF_CHX, D = window.AF_DOCK, E = window.AF_EQUIPDATA, RU = window.AF_RULES, IT = window.AF_ITEMS, THREE = window.THREE;
  if (!H || !D || !E || !RU || !IT) { console.warn('[equip] thiếu AF_CH/AF_DOCK/AF_EQUIPDATA, bỏ qua (dock.js và equipdata.js phải đứng trước equip.js trong index.html)'); return; }
  const esc = D.esc, send = D.send, num = D.num;
  const Q = { st: { bag: [], eq: {}, gems: {}, cos: {}, hide: {}, unlocked: [], store: [], main: [], cap: { bag: E.BAG, store: E.STORE } }, tab: 'eq', sel: null, show3d: localStorage.getItem('af-show3d') !== '0' };
  window.AF_EQUIP = Q;
  const mats = () => (window.AF_ZONES && window.AF_ZONES.mats) || {};
  const plv = () => (X && X.P && X.P.level) || 1;
  const gold = () => (X && X.P && X.P.gold) || 0;
  const rc = (r) => E.RCOL[r] || '#fff';
  const fmt = (k, v) => (E.PCT[k] ? '+' + v + '%' : '+' + v) + ' ' + E.STAT[k];

  const ctl = D.add({ id: 'equip', label: 'Trang bị+', key: 'j', wide: 820, onOpen: () => send({ op: 'einfo' }) });
  const pn = ctl.panel;

  /* ---------- cards ---------- */
  function durBar(cur) { const c = cur <= 0 ? '#ff5a4a' : cur < 30 ? '#ffb347' : '#7ddc8f'; return '<div class="bar" title="Độ bền ' + cur + '/' + E.MAX_DUR + '"><i style="width:' + cur + '%;background:' + c + '"></i></div>'; }
  function card(it) {
    if (!it) return '<span class="mut">Trống</span>';
    const st = E.stats(it), base = E.base(it.slot, it.sub, it.rarity, it.ilvl, it.enh);
    const sub = it.slot === 'offhand' ? ' · ' + E.SUBNAME[it.sub] : '';
    return '<b style="color:' + rc(it.rarity) + '">' + esc(E.nameOf(it)) + '</b> <small class="mut">' + E.RNAME[it.rarity] + ' · cấp ' + it.ilvl + sub + (it.lock ? ' · 🔒' : '') + '</small><br><small>' +
      Object.keys(base).map((k) => fmt(k, base[k])).join(' · ') + it.aff.map((a) => '<br><span style="color:#cfe0ff">' + fmt(a.k, a.v) + '</span>').join('') + '</small>' +
      (it.sock.length ? '<br><small>' + it.sock.map((g) => g ? '<span style="color:' + E.GEMS[E.parseGem(g).type].c + '">◆ ' + esc(E.gemName(g)) + ' ' + E.gemText(g) + '</span>' : '<span class="mut">◇ ô trống</span>').join(' · ') + '</small>' : '') +
      (it.cur != null ? '<br><small class="mut">Độ bền ' + it.cur + '/' + E.MAX_DUR + (it.cur <= 0 ? ' · HỎNG, không còn tác dụng' : '') + '</small>' + durBar(it.cur) : '');
  }
  function compare(it) {
    const old = Q.st.eq[it.slot], a = E.stats(it), b = E.stats(old), out = [];
    Object.keys(E.STAT).forEach((k) => { const d = Math.round(((a[k] || 0) - (b[k] || 0)) * 10) / 10; if (d) out.push('<span class="' + (d > 0 ? 'up' : 'dn') + '">' + (d > 0 ? '▲' : '▼') + ' ' + Math.abs(d) + (E.PCT[k] ? '%' : '') + ' ' + E.STAT[k] + '</span>'); });
    return out.length ? out.join(' · ') : '<span class="mut">Không đổi</span>';
  }
  /* enhancement, sockets and reforge of one extra piece */
  function manage(it) {
    const wards = mats().ward | 0, e = it.enh | 0;
    let h = '<div class="box" style="margin-top:6px">';
    if (e >= E.MAX_ENH) h += '<div><b>Cường hóa</b> <span class="mut">đã tối đa +' + E.MAX_ENH + '</span></div>';
    else h += '<div><b>Cường hóa +' + (e + 1) + '</b> <small class="mut">tỉ lệ ' + Math.round(E.enhChance(e) * 100) + '% · ' + num(E.enhCost(it)) + ' vàng' + (e >= 5 ? ' · thất bại sẽ tụt 1 cấp' + (e >= 7 ? ', trừ khi dùng Bùa bảo hộ (đang có ' + wards + ')' : '') : '') + '</small> <button data-a="enh" data-id="' + it.id + '"' + (gold() < E.enhCost(it) ? ' disabled' : '') + '>Cường hóa</button></div>';
    if (it.sock.length) {
      const owned = Object.keys(Q.st.gems).filter((k) => Q.st.gems[k] > 0);
      h += '<div style="margin-top:6px"><b>Ổ ngọc</b> <small class="mut">tháo ngọc tốn Lõi tro + vàng</small></div>';
      it.sock.forEach((g, i) => {
        h += '<div style="margin:3px 0">' + (g ? '<span style="color:' + E.GEMS[E.parseGem(g).type].c + '">◆ ' + esc(E.gemName(g)) + ' ' + E.gemText(g) + '</span> <button class="g" data-a="unsock" data-id="' + it.id + '" data-i="' + i + '">Tháo (50×bậc vàng + 1 Lõi tro)</button>'
          : '◇ ô ' + (i + 1) + ' trống ' + (owned.length ? '<select data-sel="' + i + '">' + owned.map((k) => '<option value="' + k + '">' + esc(E.gemName(k)) + ' ' + E.gemText(k) + ' (x' + Q.st.gems[k] + ')</option>').join('') + '</select> <button data-a="sock" data-id="' + it.id + '" data-i="' + i + '">Khảm</button>' : '<span class="mut">(bạn chưa có ngọc, xem tab Ngọc)</span>')) + '</div>';
      });
    }
    if (it.aff.length) {
      h += '<div style="margin-top:6px"><b>Tẩy luyện</b> <small class="mut">' + (120 + it.ilvl * 25) + ' vàng + 1 Lõi tro, đổi ngẫu nhiên một dòng</small></div>';
      h += it.aff.map((a, i) => '<button class="g" data-a="refo" data-id="' + it.id + '" data-i="' + i + '">Đổi: ' + esc(fmt(a.k, a.v)) + '</button>').join('');
    }
    return h + '</div>';
  }

  /* ---------- tabs ---------- */
  function tabEq(s) {
    let h = '<h4>TRANG BỊ PHỤ ĐANG MẶC</h4><div class="grid">' + E.SLOTS.map((sl) => '<div class="box"><small class="mut">' + E.SLOTNAME[sl] + '</small><br>' + card(s.eq[sl]) +
      (s.eq[sl] ? '<br><button class="g" data-a="un" data-s="' + sl + '">Tháo</button><button class="g" data-a="lock" data-id="' + s.eq[sl].id + '">' + (s.eq[sl].lock ? 'Mở khóa' : 'Khóa') + '</button><button class="g" data-a="sel" data-id="' + s.eq[sl].id + '">' + (Q.sel === s.eq[sl].id ? 'Ẩn quản lý' : 'Quản lý') + '</button>' + (Q.sel === s.eq[sl].id ? manage(s.eq[sl]) : '') : '') + '</div>').join('') + '</div>';
    h += '<h4>TRANG BỊ GỐC · ĐỘ BỀN</h4><div class="grid">' + s.main.map((m) => '<div class="box"><small class="mut">' + E.ALLNAME[m.slot] + '</small><br>' + (m.id ? '<b style="color:' + rc(m.rarity) + '">' + esc(m.name) + '</b> <small class="mut">cấp ' + m.ilvl + '</small>' + durBar(m.cur) + '<small class="mut">' + m.cur + '/' + E.MAX_DUR + (m.cur <= 0 ? ' · HỎNG: giảm sức đánh và giáp' : '') + '</small>' : '<span class="mut">Trống</span>') + '</div>').join('') + '</div>';
    h += '<div class="row"><span>Độ bền giảm <b>8</b> mỗi lần bạn bị hạ gục. Đồ hỏng (0): món phụ mất tác dụng, món gốc làm giảm 8% sức đánh và giáp mỗi món.<br><small class="mut">Sửa ở thợ rèn trong làng' + (s.inVillage ? ' (bạn đang ở trong làng)' : ' (bạn đang ở xa làng)') + '. Cường hóa trang bị gốc ở bảng Xã hội (K), tối đa +' + E.MAX_ENH + '.</small></span>' +
      '<button data-a="repair"' + (s.repair <= 0 || !s.inVillage || gold() < s.repair ? ' disabled' : '') + '>Sửa tất cả ' + num(s.repair) + ' vàng</button></div>';
    return h;
  }
  function tabBag(s) {
    let h = '<h4>TÚI TRANG BỊ PHỤ · ' + s.bag.length + '/' + s.cap.bag + '</h4>';
    const bag = s.bag.slice().sort((a, b) => E.RAR.indexOf(b.rarity) - E.RAR.indexOf(a.rarity) || b.ilvl - a.ilvl);
    h += bag.length ? bag.map((it) => '<div class="row" style="display:block"><div style="display:flex;justify-content:space-between;gap:8px"><span>' + card(it) + '<br><small>' + compare(it) + '</small></span><span style="text-align:right;white-space:nowrap"><button data-a="eq" data-id="' + it.id + '"' + (plv() < it.ilvl - 6 ? ' disabled' : '') + '>Mặc</button><button class="g" data-a="lock" data-id="' + it.id + '">' + (it.lock ? '🔒' : 'Khóa') + '</button><br><button class="g" data-a="sell" data-id="' + it.id + '">Bán ' + E.worth(it) + '</button><button class="g" data-a="dis" data-id="' + it.id + '">Rã</button><br><button class="g" data-a="sel" data-id="' + it.id + '">' + (Q.sel === it.id ? 'Ẩn' : 'Quản lý') + '</button></span></div>' + (Q.sel === it.id ? manage(it) : '') + '</div>').join('') : '<div class="mut">Chưa có món nào. Quái tinh anh và boss rơi nhiều hơn, hoặc chế tác ở tab Chế tác.</div>';
    return h;
  }
  function tabGems(s) {
    const have = Object.keys(s.gems).filter((k) => s.gems[k] > 0), m = mats();
    let h = '<h4>NGỌC ĐANG CÓ</h4>' + (have.length ? have.map((k) => { const g = E.parseGem(k); return '<div class="row"><span style="color:' + E.GEMS[g.type].c + '">◆ <b>' + esc(E.gemName(k)) + '</b> x' + s.gems[k] + ' <small class="mut">' + E.gemText(k) + '</small></span>' +
      (g.tier < 3 ? '<button data-a="upg" data-t="' + g.type + '" data-r="' + g.tier + '"' + (s.gems[k] < 3 || gold() < 100 * g.tier ? ' disabled' : '') + '>Ghép 3 → bậc ' + (g.tier + 1) + ' (' + 100 * g.tier + ' vàng)</button>' : '<span class="mut">tối đa</span>') + '</div>'; }).join('') : '<div class="mut">Bạn chưa có ngọc nào.</div>');
    h += '<h4>MÀI NGỌC (2 Đá quý + 30 vàng, ra ngọc thô) · Đá quý đang có: ' + (m.gem | 0) + '</h4><div>' + Object.keys(E.GEMS).map((t) => '<button data-a="cut" data-t="' + t + '"' + ((m.gem | 0) < 2 || gold() < 30 ? ' disabled' : '') + ' style="border-color:' + E.GEMS[t].c + '">' + esc(E.GEMS[t].name) + ' · ' + E.STAT[E.GEMS[t].stat] + '</button>').join('') + '</div>';
    h += '<div class="mut" style="margin-top:6px">Ngọc có chỉ số: ' + Object.keys(E.GEMS).map((t) => esc(E.GEMS[t].name) + ' ' + E.STAT[E.GEMS[t].stat]).join(', ') + '. Ngọc cũng rơi từ quái tinh anh và boss. Ô khảm có ở trang bị phụ Sử thi (có thể có 1) và Huyền thoại (2).</div>';
    return h;
  }
  const CR = { rare: ['140 vàng · 4 Quặng · 2 Than', 5], epic: ['550 vàng · 2 Đá quý · 2 Lõi tro · 3 Cát huyết thạch', 12], legend: ['2800 vàng · 6 Đá quý · 5 Lõi tro · 4 Bánh răng · 3 Xương cổ', 20] };
  function tabCraft() {
    return '<h4>CHẾ TÁC TRANG BỊ PHỤ (nguyên liệu ở bảng Nghề, phím P)</h4>' + Object.keys(CR).map((r) => '<div class="row"><span><b style="color:' + rc(r) + '">' + E.RNAME[r] + '</b> <small class="mut">cấp ' + CR[r][1] + ' · ' + CR[r][0] + '</small></span><span>' + E.SLOTS.map((sl) => '<button data-a="craft" data-s="' + sl + '" data-r="' + r + '"' + (plv() < CR[r][1] ? ' disabled' : '') + '>' + E.SLOTNAME[sl] + '</button>').join('') + '</span></div>').join('') +
      '<div class="mut">Cát huyết thạch và Xương cổ rơi ở Sa Mạc Huyết Thạch (phía Nam làng, tọa độ 22, -84).</div>';
  }
  function tabLook(s) {
    let h = '<div class="row"><span><b>Hiển thị trang bị trên mô hình 3D</b><br><small class="mut">Tắt nếu thấy món nào đặt sai chỗ trên mô hình của bạn (chỉ ảnh hưởng máy bạn).</small></span><button data-a="show3d">' + (Q.show3d ? 'Đang bật' : 'Đang tắt') + '</button></div>';
    h += '<div class="row"><span>Ẩn mũ / áo choàng với mọi người</span><span><button class="' + (s.hide.helmet ? 'on' : 'g') + '" data-a="hide" data-w="helmet">' + (s.hide.helmet ? 'Mũ: đang ẩn' : 'Ẩn mũ') + '</button><button class="' + (s.hide.cape ? 'on' : 'g') + '" data-a="hide" data-w="cape">' + (s.hide.cape ? 'Áo choàng: đang ẩn' : 'Ẩn áo choàng') + '</button></span></div>';
    h += '<h4>Ô NGOẠI HÌNH · mặc đồ mạnh nhưng hiển thị như đồ khác</h4><div class="mut">Kiểu ngoại hình mở khóa khi bạn từng sở hữu một món độ hiếm đó ở ô tương ứng.</div>';
    h += E.ALL.map((sl) => '<div class="row"><span><b>' + E.ALLNAME[sl] + '</b>' + (s.cos[sl] ? ' <small style="color:' + rc(s.cos[sl]) + '">đang hiển thị kiểu ' + E.RNAME[s.cos[sl]] + '</small>' : ' <small class="mut">mặc định (theo món đang mặc)</small>') + '</span><span>' +
      '<button class="' + (!s.cos[sl] ? 'on' : 'g') + '" data-a="cos" data-s="' + sl + '" data-l="">Mặc định</button>' + E.RAR.map((r) => { const un = s.unlocked.includes(sl + '_' + r); return '<button class="' + (s.cos[sl] === r ? 'on' : 'g') + '" data-a="cos" data-s="' + sl + '" data-l="' + r + '"' + (un ? '' : ' disabled') + ' style="color:' + rc(r) + '">' + E.RNAME[r] + '</button>'; }).join('') + '</span></div>').join('');
    return h;
  }
  function tabStore(s) {
    const inv = (X && X.P && X.P.inv) || [];
    let h = '<h4>KHO CÁ NHÂN · ' + s.store.length + '/' + s.cap.store + '</h4><div class="mut">Cất đồ gốc từ túi chính vào kho, lấy ra ở bất cứ đâu. Kho không bị mất khi chết.</div>';
    h += s.store.length ? s.store.map((it) => '<div class="row"><span><b style="color:' + rc(it.rarity) + '">' + esc(it.name) + '</b> <small class="mut">' + IT.SLOTNAME[it.slot] + ' · cấp ' + it.ilvl + '</small></span><button data-a="get" data-id="' + it.id + '">Lấy ra</button></div>').join('') : '<div class="mut">Kho trống.</div>';
    h += '<h4>TÚI ĐỒ CHÍNH · ' + inv.length + '/' + RU.INV_SIZE + '</h4>';
    h += inv.length ? inv.map((it) => '<div class="row"><span><b style="color:' + rc(it.rarity) + '">' + esc(it.name) + '</b> <small class="mut">' + IT.SLOTNAME[it.slot] + ' · cấp ' + it.ilvl + '</small></span><button data-a="put" data-id="' + it.id + '"' + (s.store.length >= s.cap.store ? ' disabled' : '') + '>Cất vào kho</button></div>').join('') : '<div class="mut">Túi trống (hoặc chưa đọc được túi từ giao diện, hãy mở lại bảng).</div>';
    return h;
  }
  ctl.render = function () {
    if (!ctl.open) return;
    const s = Q.st, tabs = [['eq', 'Đang mặc'], ['bag', 'Túi phụ'], ['gems', 'Ngọc'], ['craft', 'Chế tác'], ['look', 'Ngoại hình'], ['store', 'Kho cá nhân']];
    let h = ctl.head('Trang bị mở rộng') + '<div class="tabs">' + tabs.map((t) => '<button class="' + (Q.tab === t[0] ? 'on' : 'g') + '" data-a="tab" data-v="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>';
    h += Q.tab === 'eq' ? tabEq(s) : Q.tab === 'bag' ? tabBag(s) : Q.tab === 'gems' ? tabGems(s) : Q.tab === 'craft' ? tabCraft() : Q.tab === 'look' ? tabLook(s) : tabStore(s);
    const keep = pn.scrollTop; pn.innerHTML = h; pn.scrollTop = keep;
  };
  pn.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const a = b.dataset.a, id = b.dataset.id;
    if (a === 'x') return;
    if (a === 'tab') { Q.tab = b.dataset.v; ctl.render(); }
    else if (a === 'sel') { Q.sel = Q.sel === id ? null : id; ctl.render(); }
    else if (a === 'eq') send({ op: 'eequip', id });
    else if (a === 'un') send({ op: 'eunequip', slot: b.dataset.s });
    else if (a === 'lock') send({ op: 'elock', id });
    else if (a === 'sell') { if (confirm('Bán món này?')) send({ op: 'esell', id }); }
    else if (a === 'dis') { if (confirm('Phân rã món này thành nguyên liệu?')) send({ op: 'edis', id }); }
    else if (a === 'enh') send({ op: 'eenh', id });
    else if (a === 'sock') { const sel = pn.querySelector('select[data-sel="' + b.dataset.i + '"]'); if (sel) send({ op: 'esocket', id, idx: Number(b.dataset.i), gem: sel.value }); }
    else if (a === 'unsock') send({ op: 'eunsocket', id, idx: Number(b.dataset.i) });
    else if (a === 'refo') { if (confirm('Đổi ngẫu nhiên dòng chỉ số này? (không hoàn lại)')) send({ op: 'erefo', id, idx: Number(b.dataset.i) }); }
    else if (a === 'repair') send({ op: 'erepair' });
    else if (a === 'craft') send({ op: 'ecraft', slot: b.dataset.s, rarity: b.dataset.r });
    else if (a === 'cut') send({ op: 'ecut', type: b.dataset.t });
    else if (a === 'upg') send({ op: 'eupg', type: b.dataset.t, tier: Number(b.dataset.r) });
    else if (a === 'cos') send({ op: 'ecos', slot: b.dataset.s, look: b.dataset.l });
    else if (a === 'hide') send({ op: 'ehide', what: b.dataset.w });
    else if (a === 'put') send({ op: 'stput', id });
    else if (a === 'get') send({ op: 'stget', id });
    else if (a === 'show3d') { Q.show3d = !Q.show3d; localStorage.setItem('af-show3d', Q.show3d ? '1' : '0'); ctl.render(); syncLooks(true); }
  });

  /* ---------- 3D look overlay ---------- */
  const LOOKS = new Map(); // player id -> { v, self }
  const COL = { common: 0x8a7a66, rare: 0x4f86d6, epic: 0x9a5fe0, legend: 0xe09a2a };
  const EMI = { common: 0, rare: 0.05, epic: 0.35, legend: 0.7 };
  const OFF = { /* fractions of the model's height; x is sideways, z is forward (the back is -z, like the ponytail in classes.js) */
    chest: { y: 0.62, w: 0.36, h: 0.26, d: 0.2 }, cape: { y: 0.62, w: 0.34, h: 0.55, z: -0.11 }, glove: { x: 0.2, y: 0.46, r: 0.045 },
    boot: { x: 0.07, y: 0.05, w: 0.1, h: 0.09, d: 0.16 }, leg: { x: 0.07, y: 0.28, w: 0.09, h: 0.4, d: 0.1 }, off: { x: -0.24, y: 0.48, z: 0.07 }, helmetY: 0.12
  };
  const pulsers = [];
  function mat(r) { const m = new THREE.MeshStandardMaterial({ color: COL[r] || COL.common, roughness: 0.55, metalness: 0.3, emissive: COL[r] || 0, emissiveIntensity: EMI[r] || 0, side: THREE.DoubleSide }); if (r === 'legend' || r === 'epic') pulsers.push(m); return m; }
  function heightOf(Hm) {
    const root = Hm.root; if (root.userData.afH) return root.userData.afH;
    let h = 1.8;
    try {
      root.updateMatrixWorld(true);
      const box = new THREE.Box3(); let any = false;
      root.traverse((o) => { if (o.isMesh && !(o.userData && (o.userData.afLookPart || o.userData.afHair))) { box.expandByObject(o); any = true; } });
      if (any) {
        const a = root.worldToLocal(box.min.clone()), b = root.worldToLocal(box.max.clone());
        const hh = Math.abs(b.y - a.y); if (hh > 0.8 && hh < 4) { h = hh; root.userData.afMinY = Math.min(a.y, b.y); }
      }
    } catch (err) { /* keep the default */ }
    root.userData.afH = h; if (root.userData.afMinY == null) root.userData.afMinY = 0;
    return h;
  }
  function clearLook(Hm) {
    const lp = Hm.root.userData.afLookParts;
    if (lp) { lp.forEach((q) => { q.parent.remove(q.obj); q.obj.geometry.dispose(); const i = pulsers.indexOf(q.obj.material); if (i >= 0) pulsers.splice(i, 1); q.obj.material.dispose(); }); Hm.root.userData.afLookParts = null; }
    const g = Hm.root.userData.afLookG;
    if (g) { Hm.root.remove(g); g.traverse((o) => { if (o.geometry) o.geometry.dispose(); const i = pulsers.indexOf(o.material); if (i >= 0) pulsers.splice(i, 1); if (o.material) o.material.dispose(); }); }
    Hm.root.userData.afLookG = null;
    if (Hm.headG) { const hc = Hm.headG.userData.afLookHelmet; if (hc) { Hm.headG.remove(hc); hc.geometry.dispose(); hc.material.dispose(); Hm.headG.userData.afLookHelmet = null; } }
    Hm.root.traverse((o) => { const m = o.material; if (m && m.userData && m.userData.afPants) { m.color.setHex(m.userData.afPants); } });
  }
  /* with the new rig (public/js/visual.js) the pieces are fixed to the body parts, so gloves follow the hands and boots follow the feet */
  function buildRigLook(Hm, v, R) {
    const rar = (s) => (v[s] ? String(v[s]).split(':')[0] : null), parts = [];
    const add = (parent, geo, r, x, y, z, rx) => { const m = new THREE.Mesh(geo, mat(r)); m.position.set(x, y, z); if (rx) m.rotation.x = rx; m.userData.afLookPart = true; m.castShadow = true; parent.add(m); parts.push({ obj: m, parent }); return m; };
    const torso = (Hm.armorSlot && Hm.armorSlot.parent) || R.upper;
    if (rar('armor')) add(torso, new THREE.CylinderGeometry(0.45, 0.53, 0.7, 12), rar('armor'), 0, 0.02, 0);
    if (rar('cape')) add(torso, new THREE.PlaneGeometry(0.86, 1.1), rar('cape'), 0, -0.2, -0.43, -0.08);
    if (rar('gloves')) R.el.forEach((e) => add(e, new THREE.SphereGeometry(0.16, 8, 6), rar('gloves'), 0, -0.34, 0.01));
    if (rar('boots')) R.an.forEach((a) => add(a, new THREE.BoxGeometry(0.29, 0.2, 0.4), rar('boots'), 0, 0, 0.06));
    if (rar('pants')) Hm.root.traverse((o) => { const m = o.material; if (m && m.color && !(o.userData && o.userData.afLookPart) && (m.userData && m.userData.afPants || m.color.getHex() === 0x3a3348)) { m.userData = m.userData || {}; if (!m.userData.afPants) m.userData.afPants = m.color.getHex(); m.color.setHex(COL[rar('pants')]); } });
    if (v.offhand) {
      const [r, t] = String(v.offhand).split(':');
      if (t === 't') add(R.el[0], new THREE.BoxGeometry(0.34, 0.46, 0.1), r, 0.14, -0.2, 0.2);
      else { const s = add(R.el[0], new THREE.CylinderGeometry(0.4, 0.4, 0.07, 18), r, 0.1, -0.2, 0.2); s.rotation.x = Math.PI / 2; }
    }
    if (rar('helmet') && Hm.headG) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(rar('helmet'))); m.userData.afLookPart = true; m.position.set(0, OFF.helmetY + 0.1, 0); Hm.headG.add(m); Hm.headG.userData.afLookHelmet = m; }
    Hm.root.userData.afLookParts = parts;
  }
  function buildLook(Hm, v) {
    clearLook(Hm);
    if (!v || !Q.show3d || !THREE) return;
    const AFV = window.AF_VISUAL, RG = AFV && AFV.rigOf ? AFV.rigOf(Hm) : null;
    if (RG) return buildRigLook(Hm, v, RG);
    const root = Hm.root, h = heightOf(Hm), y0 = root.userData.afMinY || 0, g = new THREE.Group(); g.userData.afLookPart = true;
    const add = (geo, r, x, y, z, rx) => { const m = new THREE.Mesh(geo, mat(r)); m.position.set(x * h, y0 + y * h, z * h); if (rx) m.rotation.x = rx; m.userData.afLookPart = true; m.castShadow = true; g.add(m); return m; };
    const rar = (s) => (v[s] ? String(v[s]).split(':')[0] : null);
    if (rar('armor')) { const c = OFF.chest; add(new THREE.BoxGeometry(c.w * h, c.h * h, c.d * h), rar('armor'), 0, c.y, 0); }
    if (rar('cape')) { const c = OFF.cape; add(new THREE.PlaneGeometry(c.w * h, c.h * h), rar('cape'), 0, c.y, c.z, -0.08); }
    if (rar('gloves')) { const c = OFF.glove; [-1, 1].forEach((sd) => add(new THREE.SphereGeometry(c.r * h, 8, 6), rar('gloves'), sd * c.x, c.y, 0.02)); }
    if (rar('boots')) { const c = OFF.boot; [-1, 1].forEach((sd) => add(new THREE.BoxGeometry(c.w * h, c.h * h, c.d * h), rar('boots'), sd * c.x, c.y, 0.02)); }
    if (rar('pants')) {
      let found = 0;
      root.traverse((o) => { const m = o.material; if (m && m.color && !(o.userData && o.userData.afLookPart) && (m.userData && m.userData.afPants || m.color.getHex() === 0x3a3348)) { m.userData = m.userData || {}; if (!m.userData.afPants) m.userData.afPants = m.color.getHex(); m.color.setHex(COL[rar('pants')]); found++; } });
      if (!found) { const c = OFF.leg; [-1, 1].forEach((sd) => add(new THREE.BoxGeometry(c.w * h, c.h * h, c.d * h), rar('pants'), sd * c.x, c.y, 0)); }
    }
    if (v.offhand) {
      const [r, t] = String(v.offhand).split(':'), c = OFF.off;
      if (t === 't') add(new THREE.BoxGeometry(0.09 * h, 0.12 * h, 0.025 * h), r, c.x, c.y, c.z);
      else { const s = add(new THREE.CylinderGeometry(0.11 * h, 0.11 * h, 0.02 * h, 16), r, c.x, c.y, c.z); s.rotation.z = Math.PI / 2; }
    }
    root.add(g); root.userData.afLookG = g;
    if (rar('helmet')) {
      const hg = Hm.headG; const geo = new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55); const m = new THREE.Mesh(geo, mat(rar('helmet')));
      m.userData.afLookPart = true;
      if (hg) { m.position.set(0, OFF.helmetY + 0.1, 0); hg.add(m); hg.userData.afLookHelmet = m; }
      else { m.scale.setScalar(h * 0.6); m.position.set(0, y0 + h * 0.88, 0); g.add(m); }
    }
  }
  function modelOf(id) {
    if (!X) return null;
    for (const k of Object.keys(X)) {
      const v = X[k];
      if (v instanceof Map) { const o = v.get(id); if (o) { if (o.root) return o; if (o.m && o.m.root) return o.m; if (o.model && o.model.root) return o.model; if (o.h && o.h.root) return o.h; } }
    }
    return null;
  }
  const keyOf = (L) => JSON.stringify(L.v) + (Q.show3d ? '1' : '0');
  function syncLooks(force) {
    if (!THREE || !X) return;
    LOOKS.forEach((L, id) => {
      const Hm = L.self ? X.PL : modelOf(id);
      if (!Hm || !Hm.root) return;
      const k = keyOf(L);
      if (force || Hm.root.userData.afLookKey !== k || (L.v && Object.keys(L.v).length && !Hm.root.userData.afLookG && Q.show3d)) { try { buildLook(Hm, L.v); } catch (err) { console.error('[equip] look', err); } Hm.root.userData.afLookKey = k; }
    });
  }
  setInterval(() => { if (H.isRunning()) syncLooks(false); }, 1500);
  (function loop() { const t = performance.now() / 1000; pulsers.forEach((m, i) => { if (m.emissiveIntensity != null) m.emissiveIntensity = (m.color && m.color.getHex() === COL.legend ? 0.55 : 0.28) + Math.sin(t * 2 + i) * 0.15; }); requestAnimationFrame(loop); })();

  /* ---------- server messages ---------- */
  Q.onNet = function (m) {
    switch (m.t) {
      case 'einfo': Q.st = Object.assign(Q.st, { bag: m.bag || [], eq: m.eq || {}, gems: m.gems || {}, cos: m.cos || {}, hide: m.hide || {}, unlocked: m.unlocked || [], store: m.store || [], main: m.main || [], cap: m.cap || Q.st.cap, inVillage: !!m.inVillage, repair: m.repair | 0 }); ctl.render(); return true;
      case 'elook': LOOKS.set(m.id, { v: m.v || {}, self: !!m.self }); setTimeout(() => syncLooks(false), 50); return true;
      case 'edrop':
        if (m.gem) H.toast('Nhặt được <b style="color:' + E.GEMS[E.parseGem(m.gem).type].c + '">' + esc(E.gemName(m.gem)) + '</b> · phím J', false);
        else { const it = m.item; H.toast((m.from === 'craft' ? 'Chế tác ' : 'Nhặt được ') + '<b style="color:' + rc(it.rarity) + '">' + esc(E.nameOf(it)) + '</b> (' + E.RNAME[it.rarity] + ') · phím J', it.rarity === 'legend'); }
        return true;
      case 'eenh':
        H.toast(m.ok ? 'Cường hóa thành công: <b>' + esc(m.name) + '</b>' : m.warded ? 'Thất bại, Bùa bảo hộ đã giữ nguyên cấp.' : m.lost ? 'Thất bại! ' + esc(m.name) + ' tụt 1 cấp.' : 'Thất bại, cấp giữ nguyên.', m.ok);
        return true;
      default: return false;
    }
  };
})();
