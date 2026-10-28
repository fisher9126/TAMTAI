/* Aetherfall step 8 (browser): accessories panel (key G): equipped rings / necklace / charm, bag of 30, compare arrows, lock, sell, disassemble,
   craft, set progress. The server decides everything; this file only draws and sends requests. */
(function () {
  'use strict';
  const H = window.AF_CH, G = window.AF_GEARDATA, RU = window.AF_RULES;
  if (!H || !G || !RU) { console.warn('[gear] thiếu AF_CH/AF_GEARDATA, bỏ qua (hãy thêm geardata.js trước gear.js trong index.html)'); return; }
  const esc = H.esc, send = (m) => H.NET.send(m);
  const Gr = { st: { bag: [], eq: {}, sets: {}, max: G.BAG }, open: false, sort: true };
  window.AF_GEAR = Gr;
  const plv = () => (window.AF_CHX && window.AF_CHX.P && window.AF_CHX.P.level) || 1;
  const css = document.createElement('style');
  css.textContent = `
  #afGB{position:fixed;left:10px;top:calc(46% - 220px);z-index:40;border:2px solid #241a05;background:#ffe08a;color:#241a05;font:700 13px system-ui,sans-serif;padding:8px 12px;border-radius:12px;cursor:pointer;box-shadow:0 3px 0 #241a05}
  #afGR{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:58;width:min(97vw,720px);max-height:86vh;overflow:auto;box-sizing:border-box;padding:14px 16px;background:rgba(18,26,52,.97);color:#eef3ff;border:3px solid #241a05;border-radius:16px;box-shadow:0 10px 0 rgba(0,0,0,.35);font:13px/1.45 system-ui,sans-serif}
  #afGR .eq{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:8px 0}
  #afGR .box{background:rgba(255,255,255,.06);border-radius:10px;padding:8px;min-height:64px}
  #afGR .row{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:7px 8px;border-radius:9px;background:rgba(255,255,255,.06);margin:5px 0}
  #afGR .mut{color:#aab6d8}#afGR h4{margin:12px 0 4px;font-size:12px;letter-spacing:.06em;color:#ffd96a}
  #afGR button{background:#f0bf4c;color:#241a05;border:2px solid #241a05;border-radius:9px;padding:3px 9px;font:700 12px system-ui,sans-serif;cursor:pointer;margin:2px}
  #afGR button.g{background:#e9edf8}#afGR button[disabled]{opacity:.4;cursor:default}
  #afGR .up{color:#8fe08f}#afGR .dn{color:#ff9a8a}
  #afGB[hidden],#afGR[hidden]{display:none}`;
  document.head.appendChild(css);
  const btn = document.createElement('button'); btn.id = 'afGB'; btn.type = 'button'; btn.textContent = 'Trang sức (G)'; btn.hidden = true;
  const pn = document.createElement('div'); pn.id = 'afGR'; pn.hidden = true;
  document.body.append(btn, pn);
  [btn, pn].forEach((el) => ['keydown', 'keyup', 'pointerdown', 'mousedown'].forEach((ev) => el.addEventListener(ev, (e) => e.stopPropagation())));

  const fmt = (k, v) => (G.PCT[k] ? '+' + v + '%' : '+' + v) + ' ' + G.STAT[k];
  const card = (it) => {
    if (!it) return '<span class="mut">Trống</span>';
    const sp = it.set ? '<br><small style="color:#7ddc8f">' + esc(G.SETS[it.set].name) + '</small>' : '';
    return '<b style="color:' + G.RCOL[it.rarity] + '">' + esc(it.name) + '</b> <small class="mut">cấp ' + it.ilvl + '</small><br><small>' + fmt(it.base.k, it.base.v) + it.aff.map((a) => '<br>' + (a.big ? '<span style="color:#ffa94a">★ ' : '<span>') + fmt(a.k, a.v) + '</span>').join('') + '</small>' + sp;
  };
  const sumOf = (it) => G.stats(it);
  function compare(it) {
    const cur = Gr.st.eq, targets = it.kind === 'ring' ? ['ring1', 'ring2'] : [it.kind];
    const old = targets.map((k) => cur[k]).sort((a, b) => (a ? 1 : 0) - (b ? 1 : 0))[0] || null; // compare with the weaker (or empty) slot
    const a = sumOf(it), b = sumOf(old), keys = Object.keys(G.STAT), out = [];
    keys.forEach((k) => { const d = Math.round(((a[k] || 0) - (b[k] || 0)) * 10) / 10; if (d) out.push('<span class="' + (d > 0 ? 'up' : 'dn') + '">' + (d > 0 ? '▲' : '▼') + ' ' + (G.PCT[k] ? Math.abs(d) + '%' : Math.abs(d)) + ' ' + G.STAT[k] + '</span>'); });
    return out.length ? out.join(' · ') : '<span class="mut">Không đổi</span>';
  }
  const COSTS = { rare: ['150 vàng · 1 Đá quý · 4 Quặng', 5], epic: ['600 vàng · 3 Đá quý · 2 Lõi tro', 12], legend: ['3000 vàng · 8 Đá quý · 6 Lõi tro · 4 Bánh răng', 20] };
  function render() {
    if (!Gr.open) return;
    const s = Gr.st; let h = '<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:18px">Trang sức</b><button class="g" data-a="x">Đóng (G)</button></div>';
    h += '<h4>ĐANG ĐEO</h4><div class="eq">' + ['ring1', 'ring2', 'neck', 'charm'].map((k) => '<div class="box"><small class="mut">' + G.EQ[k] + '</small><br>' + card(s.eq[k]) + (s.eq[k] ? '<br><button class="g" data-a="un" data-s="' + k + '">Tháo</button>' : '') + '</div>').join('') + '</div>';
    const sets = Object.keys(s.sets || {}); if (sets.length) h += '<div class="mut">Bộ trang bị: ' + sets.map((id) => esc(G.SETS[id].name) + ' ' + s.sets[id] + '/3 món (2 món: ' + Object.keys(G.SETS[id].b2).map((k) => fmt(k, G.SETS[id].b2[k])).join(', ') + '; 3 món: ' + Object.keys(G.SETS[id].b3).map((k) => fmt(k, G.SETS[id].b3[k])).join(', ') + ')').join(' · ') + '</div>';
    const bag = s.bag.slice(); if (Gr.sort) bag.sort((a, b) => G.RAR.indexOf(b.rarity) - G.RAR.indexOf(a.rarity) || b.ilvl - a.ilvl);
    h += '<h4>TÚI TRANG SỨC · ' + s.bag.length + '/' + s.max + ' <button class="g" data-a="sort">' + (Gr.sort ? 'Đang sắp xếp' : 'Sắp xếp') + '</button></h4>';
    h += bag.length ? bag.map((it) => '<div class="row"><span>' + card(it) + '<br><small>' + compare(it) + '</small></span><span style="text-align:right;white-space:nowrap"><button data-a="eq" data-id="' + it.id + '"' + (plv() < it.ilvl - 6 ? ' disabled' : '') + '>Đeo</button><button class="g" data-a="lock" data-id="' + it.id + '">' + (it.lock ? '🔒' : 'Khóa') + '</button><br><button class="g" data-a="sell" data-id="' + it.id + '">Bán ' + G.worth(it) + '</button><button class="g" data-a="dis" data-id="' + it.id + '">Rã</button></span></div>').join('') : '<div class="mut">Chưa có trang sức. Quái tinh anh và boss rơi nhiều hơn, hoặc chế tác bên dưới.</div>';
    h += '<h4>CHẾ TÁC (nguyên liệu lấy từ tab Kho trong bảng Nghề, phím P)</h4>';
    h += Object.keys(COSTS).map((r) => '<div class="row"><span><b style="color:' + G.RCOL[r] + '">' + G.RNAME[r] + '</b> <small class="mut">cấp ' + COSTS[r][1] + ' · ' + COSTS[r][0] + '</small></span><span>' + Object.keys(G.KINDS).map((k) => '<button data-a="craft" data-k="' + k + '" data-r="' + r + '"' + (plv() < COSTS[r][1] ? ' disabled' : '') + '>' + G.KINDS[k] + '</button>').join('') + '</span></div>').join('');
    pn.innerHTML = h;
  }
  pn.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const a = b.dataset.a;
    if (a === 'x') toggle(false); else if (a === 'sort') { Gr.sort = !Gr.sort; render(); }
    else if (a === 'eq') send({ t: 'zone', op: 'gequip', id: b.dataset.id });
    else if (a === 'un') send({ t: 'zone', op: 'gunequip', slot: b.dataset.s });
    else if (a === 'lock') send({ t: 'zone', op: 'glock', id: b.dataset.id });
    else if (a === 'sell') { if (confirm('Bán món này?')) send({ t: 'zone', op: 'gsell', id: b.dataset.id }); }
    else if (a === 'dis') { if (confirm('Phân rã món này thành nguyên liệu?')) send({ t: 'zone', op: 'gdis', id: b.dataset.id }); }
    else if (a === 'craft') send({ t: 'zone', op: 'gcraft', kind: b.dataset.k, rarity: b.dataset.r });
  });
  function toggle(v) { Gr.open = v === undefined ? !Gr.open : v; pn.hidden = !Gr.open; if (Gr.open) { send({ t: 'zone', op: 'ginfo' }); render(); } }
  btn.addEventListener('click', () => toggle());
  window.addEventListener('keydown', (e) => {
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (!H.isRunning() || e.ctrlKey || e.metaKey || e.altKey || e.repeat || (window.AF_CLASS && window.AF_CLASS.creating)) return;
    const k = (e.code || '').indexOf('Key') === 0 ? e.code.slice(3).toLowerCase() : String(e.key).toLowerCase();
    if (k === 'g') toggle();
  });
  setInterval(() => { btn.hidden = !H.isRunning() || !!(window.AF_CLASS && window.AF_CLASS.creating); }, 500);
  Gr.onNet = function (m) {
    if (m.t === 'ginfo') { Gr.st = { bag: m.bag || [], eq: m.eq || {}, sets: m.sets || {}, max: m.max || G.BAG }; render(); return true; }
    if (m.t === 'gdrop') { const it = m.item; H.toast((m.from === 'craft' ? 'Chế tác ' : 'Nhặt được ') + '<b style="color:' + G.RCOL[it.rarity] + '">' + esc(it.name) + '</b> (' + G.RNAME[it.rarity] + ') · phím G', it.rarity === 'legend'); return true; }
    return false;
  };
})();
