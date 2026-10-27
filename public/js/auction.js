/* Aetherfall step 9 (browser): auction house panel (key U): browse and bid, list an item from the bag, my auctions, claim box. */
(function () {
  'use strict';
  const H = window.AF_CH, RU = window.AF_RULES, IT = window.AF_ITEMS;
  if (!H || !RU || !IT) { console.warn('[auction] thiếu AF_CH/AF_ITEMS, bỏ qua'); return; }
  const esc = H.esc, send = (m) => H.NET.send(m);
  const A = { list: [], gold: 0, boxN: 0, box: [], open: false, tab: 'browse', f: { q: '', slot: '', rarity: '' } };
  window.AF_AUCTION = A;
  const num = (n) => Number(n || 0).toLocaleString('vi-VN');
  const RCOL = { common: '#c8c8d0', rare: '#6fb4ff', epic: '#c58cff', legend: '#ffa94a' };
  const css = document.createElement('style');
  css.textContent = `
  #afUB{position:fixed;left:10px;top:calc(46% - 264px);z-index:40;border:2px solid #241a05;background:#a0e6c8;color:#241a05;font:700 13px system-ui,sans-serif;padding:8px 12px;border-radius:12px;cursor:pointer;box-shadow:0 3px 0 #241a05}
  #afUR{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:58;width:min(97vw,720px);max-height:86vh;overflow:auto;box-sizing:border-box;padding:14px 16px;background:rgba(18,26,52,.97);color:#eef3ff;border:3px solid #241a05;border-radius:16px;box-shadow:0 10px 0 rgba(0,0,0,.35);font:13px/1.45 system-ui,sans-serif}
  #afUR .row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 8px;border-radius:9px;background:rgba(255,255,255,.06);margin:5px 0}
  #afUR .mut{color:#aab6d8}#afUR input,#afUR select{height:30px;border-radius:7px;border:1px solid #3a4560;background:#0d1322;color:#eef3ff;padding:0 7px;max-width:130px}
  #afUR button{background:#f0bf4c;color:#241a05;border:2px solid #241a05;border-radius:9px;padding:3px 9px;font:700 12px system-ui,sans-serif;cursor:pointer;margin:2px}
  #afUR button.g{background:#e9edf8}#afUR button.on{background:#fff3c4;box-shadow:0 0 0 2px #f0bf4c}#afUR button[disabled]{opacity:.4;cursor:default}
  #afUB[hidden],#afUR[hidden]{display:none}`;
  document.head.appendChild(css);
  const btn = document.createElement('button'); btn.id = 'afUB'; btn.type = 'button'; btn.textContent = 'Đấu giá (U)'; btn.hidden = true;
  const pn = document.createElement('div'); pn.id = 'afUR'; pn.hidden = true;
  document.body.append(btn, pn);
  [btn, pn].forEach((el) => ['keydown', 'keyup', 'pointerdown', 'mousedown', 'input'].forEach((ev) => el.addEventListener(ev, (e) => e.stopPropagation())));

  const itName = (it) => it ? '<b style="color:' + (RCOL[it.rarity] || '#fff') + '">' + esc(it.name) + (it.enh ? ' +' + it.enh : '') + '</b> <small class="mut">cấp ' + it.ilvl + ' · ' + esc(IT.SLOTNAME[it.slot] || it.slot) + '</small>' : '?';
  const left = (s) => (s >= 3600 ? Math.floor(s / 3600) + 'g ' + Math.floor(s % 3600 / 60) + 'p' : Math.floor(s / 60) + 'p ' + (s % 60) + 's');
  function render() {
    if (!A.open) return;
    const tabs = [['browse', 'Duyệt'], ['sell', 'Đăng bán'], ['mine', 'Của tôi'], ['box', 'Hộp đấu giá' + (A.boxN ? ' (' + A.boxN + ')' : '')]];
    let h = '<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:18px">Đấu giá</b><span class="mut">Vàng: <b style="color:#ffd95a">' + num((window.AF_CHX && window.AF_CHX.P && window.AF_CHX.P.gold) || A.gold) + '</b> <button class="g" data-a="x">Đóng (U)</button></span></div>';
    h += '<div>' + tabs.map((t) => '<button class="' + (A.tab === t[0] ? 'on' : 'g') + '" data-a="tab" data-v="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>';
    if (A.tab === 'browse' || A.tab === 'mine') {
      if (A.tab === 'browse') h += '<div style="margin:6px 0">Tìm: <input id="afUq" value="' + esc(A.f.q) + '" placeholder="tên món"> Loại: <select id="afUs"><option value="">Tất cả</option>' + IT.SLOTS.map((s) => '<option value="' + s + '"' + (A.f.slot === s ? ' selected' : '') + '>' + IT.SLOTNAME[s] + '</option>').join('') + '</select> Độ hiếm: <select id="afUr"><option value="">Tất cả</option>' + IT.RAR.map((r) => '<option value="' + r + '"' + (A.f.rarity === r ? ' selected' : '') + '>' + IT.RNAME[r] + '</option>').join('') + '</select> <button data-a="search">Tìm</button></div>';
      const L = A.list; h += L.length ? L.map((r) => '<div class="row"><span>' + itName(r.item) + '<br><small class="mut">' + (r.bid ? 'Giá hiện tại ' + num(r.bid) + ' (' + esc(r.bidder) + (r.leading ? ' · bạn' : '') + ')' : 'Khởi điểm ' + num(r.start)) + (r.buyout ? ' · mua đứt ' + num(r.buyout) : '') + ' · ' + esc(r.seller) + ' · còn ' + left(r.left) + '</small></span><span style="white-space:nowrap">' +
        (r.mine ? (r.bid ? '<small class="mut">đã có người trả giá</small>' : '<button class="g" data-a="cancel" data-id="' + r.id + '">Hủy</button>') : '<input type="number" min="' + r.next + '" value="' + r.next + '" data-bid="' + r.id + '" style="width:92px"><button data-a="bid" data-id="' + r.id + '">Trả giá</button>' + (r.buyout ? '<button class="g" data-a="buy" data-id="' + r.id + '">Mua đứt</button>' : '')) + '</span></div>').join('') : '<div class="mut" style="margin:8px 0">Không có phiên đấu giá nào.</div>';
    } else if (A.tab === 'sell') {
      const inv = (window.AF_CHX && window.AF_CHX.P && window.AF_CHX.P.inv) || [];
      h += '<div class="mut" style="margin:6px 0">Chọn món từ túi đồ. Phí đăng 3% giá khởi điểm (tối thiểu 10 vàng). Khi bán được trừ thuế 5%. Tối đa 6 món cùng lúc.</div>';
      h += inv.length ? inv.map((it) => '<div class="row"><span>' + itName(it) + '</span><span style="white-space:nowrap">Khởi điểm <input type="number" min="1" value="' + Math.max(1, IT.itemValue(it)) + '" data-st="' + it.id + '" style="width:80px"> Mua đứt <input type="number" min="0" value="0" data-bo="' + it.id + '" style="width:80px"> <select data-hr="' + it.id + '"><option value="6">6g</option><option value="12">12g</option><option value="24" selected>24g</option><option value="48">48g</option></select><button data-a="post" data-id="' + it.id + '">Đăng</button></span></div>').join('') : '<div class="mut">Túi đồ trống.</div>';
    } else {
      h += '<div style="margin:6px 0"><button data-a="claim"' + (A.box.length ? '' : ' disabled') + '>Nhận tất cả</button> <span class="mut">Đồ thắng, vàng bán được, vàng hoàn lại đều nằm ở đây.</span></div>';
      h += A.box.length ? A.box.map((b) => '<div class="row"><span>' + esc(b.note) + '</span><span>' + (b.gold ? '<b style="color:#ffd95a">' + num(b.gold) + ' vàng</b> ' : '') + (b.item ? itName(b.item) : '') + '</span></div>').join('') : '<div class="mut">Hộp trống.</div>';
    }
    pn.innerHTML = h;
  }
  function search() { const q = pn.querySelector('#afUq'), s = pn.querySelector('#afUs'), r = pn.querySelector('#afUr'); if (q) A.f = { q: q.value, slot: s.value, rarity: r.value }; send({ t: 'zone', op: 'alist', q: A.f.q, slot: A.f.slot, rarity: A.f.rarity, mine: A.tab === 'mine' }); }
  pn.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const a = b.dataset.a, id = b.dataset.id;
    if (a === 'x') toggle(false);
    else if (a === 'tab') { A.tab = b.dataset.v; if (A.tab === 'box') send({ t: 'zone', op: 'abox' }); else if (A.tab !== 'sell') search(); render(); }
    else if (a === 'search') search();
    else if (a === 'bid') { const v = pn.querySelector('[data-bid="' + id + '"]'); send({ t: 'zone', op: 'abid', id: Number(id), amount: Number(v.value) }); }
    else if (a === 'buy') { if (confirm('Mua đứt món này?')) send({ t: 'zone', op: 'abuy', id: Number(id) }); }
    else if (a === 'cancel') { if (confirm('Hủy phiên đấu giá này?')) send({ t: 'zone', op: 'acancel', id: Number(id) }); }
    else if (a === 'post') { const g = (k) => pn.querySelector('[' + k + '="' + id + '"]'); send({ t: 'zone', op: 'apost', id, start: Number(g('data-st').value), buyout: Number(g('data-bo').value), hours: Number(g('data-hr').value) }); }
    else if (a === 'claim') send({ t: 'zone', op: 'aclaim' });
  });
  function toggle(v) { A.open = v === undefined ? !A.open : v; pn.hidden = !A.open; if (A.open) { search(); send({ t: 'zone', op: 'abox' }); render(); } }
  btn.addEventListener('click', () => toggle());
  window.addEventListener('keydown', (e) => {
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (!H.isRunning() || e.ctrlKey || e.metaKey || e.altKey || e.repeat || (window.AF_CLASS && window.AF_CLASS.creating)) return;
    const k = (e.code || '').indexOf('Key') === 0 ? e.code.slice(3).toLowerCase() : String(e.key).toLowerCase();
    if (k === 'u') toggle();
  });
  setInterval(() => { btn.hidden = !H.isRunning() || !!(window.AF_CLASS && window.AF_CLASS.creating); if (A.open && A.tab !== 'sell' && !pn.contains(document.activeElement)) render(); }, 1000);
  A.onNet = function (m) {
    if (m.t === 'alist') { A.list = m.list || []; A.gold = m.gold; render(); return true; }
    if (m.t === 'abox') { A.boxN = m.n || 0; if (m.list) A.box = m.list; if (A.boxN && !A.open) H.toast('Hộp đấu giá có <b>' + A.boxN + '</b> mục chờ nhận (phím U)'); render(); return true; }
    return false;
  };
})();
