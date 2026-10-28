/* Aetherfall step 10 (browser): ranked arena panel (key V): rating, rank, win/loss, queue button, top 10, season reward. */
(function () {
  'use strict';
  const H = window.AF_CH;
  if (!H) { console.warn('[arena] thiếu AF_CH, bỏ qua'); return; }
  const esc = H.esc, send = (m) => H.NET.send(m);
  const A = { i: null, top: [], open: false, since: 0 };
  window.AF_ARENA = A;
  const css = document.createElement('style');
  css.textContent = `
  #afVB{position:fixed;left:10px;top:calc(46% - 308px);z-index:40;border:2px solid #241a05;background:#ff9a8a;color:#241a05;font:700 13px system-ui,sans-serif;padding:8px 12px;border-radius:12px;cursor:pointer;box-shadow:0 3px 0 #241a05}
  #afVR{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:58;width:min(96vw,460px);max-height:84vh;overflow:auto;box-sizing:border-box;padding:14px 16px;background:rgba(18,26,52,.97);color:#eef3ff;border:3px solid #241a05;border-radius:16px;box-shadow:0 10px 0 rgba(0,0,0,.35);font:13px/1.5 system-ui,sans-serif}
  #afVR .row{display:flex;justify-content:space-between;gap:8px;padding:6px 8px;border-radius:9px;background:rgba(255,255,255,.06);margin:4px 0}
  #afVR .mut{color:#aab6d8}#afVR h4{margin:12px 0 4px;font-size:12px;letter-spacing:.06em;color:#ffd96a}
  #afVR button{background:#f0bf4c;color:#241a05;border:2px solid #241a05;border-radius:9px;padding:5px 12px;font:700 12px system-ui,sans-serif;cursor:pointer;margin:2px}
  #afVR button.g{background:#e9edf8}#afVR button[disabled]{opacity:.4;cursor:default}
  #afVB[hidden],#afVR[hidden]{display:none}`;
  document.head.appendChild(css);
  const btn = document.createElement('button'); btn.id = 'afVB'; btn.type = 'button'; btn.textContent = 'Đấu trường (V)'; btn.hidden = true;
  const pn = document.createElement('div'); pn.id = 'afVR'; pn.hidden = true;
  document.body.append(btn, pn);
  [btn, pn].forEach((el) => ['keydown', 'keyup', 'pointerdown', 'mousedown'].forEach((ev) => el.addEventListener(ev, (e) => e.stopPropagation())));
  const tier = (r) => (r >= 1500 ? 'Kim cương' : r >= 1300 ? 'Vàng' : r >= 1150 ? 'Bạc' : 'Đồng');
  function render() {
    if (!A.open) return; const i = A.i;
    let h = '<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:18px">Đấu trường xếp hạng</b><button class="g" data-a="x">Đóng (V)</button></div>';
    if (!i) { pn.innerHTML = h + '<p class="mut">Đang tải...</p>'; return; }
    h += '<div class="mut" style="margin:4px 0">Mùa ' + esc(i.season) + ' · đấu 1v1 công bằng, điểm Elo. Mở từ cấp ' + i.minLv + '.</div>';
    h += '<div class="row"><span>Điểm: <b style="font-size:20px;color:#ffd95a">' + i.rating + '</b> <small class="mut">(' + tier(i.rating) + ')</small></span><span>Hạng: <b>' + (i.rank ? '#' + i.rank : '—') + '</b></span></div>';
    h += '<div class="row"><span>Thắng <b>' + i.wins + '</b> · Thua <b>' + i.losses + '</b> · Chuỗi thắng <b>' + i.streak + '</b></span><span class="mut">cao nhất ' + i.best + '</span></div>';
    h += '<div style="margin:8px 0">' + (i.queued ? '<button data-a="leave">Rời hàng chờ</button> <span class="mut">đang tìm đối thủ... <span id="afVT">0</span>s · ' + i.qn + ' người chờ</span>' : '<button data-a="join">Tìm trận</button> <span class="mut">' + i.qn + ' người đang chờ</span>') + '</div>';
    if (i.pending) h += '<div class="row"><span>Thưởng mùa trước: <b style="color:#ffd95a">' + i.pending + ' vàng</b></span><button data-a="claim">Nhận</button></div>';
    h += '<h4>TOP 10 MÙA NÀY</h4>' + (A.top.length ? A.top.map((r, n) => '<div class="row"><span><b>' + (n + 1) + '.</b> ' + esc(r.name) + '</span><span>' + r.rating + ' <small class="mut">' + r.wins + 'T/' + r.losses + 'B</small></span></div>').join('') : '<div class="mut">Chưa có ai đấu.</div>');
    h += '<h4>THƯỞNG CUỐI MÙA</h4><div class="mut">Mỗi tháng đặt lại: điểm kéo về giữa mức cũ và 1000. Thưởng theo điểm cuối mùa: 1150+ → 1000 vàng, 1300+ → 2500 vàng, 1500+ → 5000 vàng, có đấu thì ít nhất 300 vàng.</div>';
    pn.innerHTML = h;
  }
  pn.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const a = b.dataset.a;
    if (a === 'x') toggle(false); else if (a === 'join') { A.since = Date.now(); send({ t: 'zone', op: 'rqjoin' }); }
    else if (a === 'leave') send({ t: 'zone', op: 'rqleave' }); else if (a === 'claim') send({ t: 'zone', op: 'rqclaim' });
  });
  function toggle(v) { A.open = v === undefined ? !A.open : v; pn.hidden = !A.open; if (A.open) { send({ t: 'zone', op: 'rqinfo' }); send({ t: 'zone', op: 'rqtop' }); render(); } }
  btn.addEventListener('click', () => toggle());
  window.addEventListener('keydown', (e) => {
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (!H.isRunning() || e.ctrlKey || e.metaKey || e.altKey || e.repeat || (window.AF_CLASS && window.AF_CLASS.creating)) return;
    const k = (e.code || '').indexOf('Key') === 0 ? e.code.slice(3).toLowerCase() : String(e.key).toLowerCase();
    if (k === 'v') toggle();
  });
  setInterval(() => { btn.hidden = !H.isRunning() || !!(window.AF_CLASS && window.AF_CLASS.creating); const t = pn.querySelector('#afVT'); if (t && A.since) t.textContent = Math.round((Date.now() - A.since) / 1000); }, 1000);
  A.onNet = function (m) {
    switch (m.t) {
      case 'rqinfo': A.i = m; if (m.queued && !A.since) A.since = Date.now(); if (!m.queued) A.since = 0; render(); return true;
      case 'rqtop': A.top = m.list || []; render(); return true;
      case 'rqmatch': A.since = 0; H.toast('<b>Ghép trận!</b> Đối thủ: ' + esc(m.vs) + ' (' + m.vsRating + ' điểm)', true); return true;
      case 'rqres':
        H.toast(m.win === null ? 'Trận hòa, điểm giữ nguyên' : m.win ? 'Thắng! <b>+' + m.delta + '</b> điểm (' + m.rating + ')' : 'Thua. <b>' + m.delta + '</b> điểm (' + m.rating + ')', true);
        send({ t: 'zone', op: 'rqinfo' }); return true;
      default: return false;
    }
  };
})();
