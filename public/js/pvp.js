/* Aetherfall step 13 (browser): PvP panel (key B): free PvP ring, battleground queue and scoreboard, siege (công thành) status, honor shop.
   Also picks the target for PvP hits: the existing hit message carries a single opponent id (AF_COMBAT.duelWith), so while the server says you can
   fight, this file keeps duelWith pointed at the nearest enemy player. The server re-checks everything (range, party / guild / team). */
(function () {
  'use strict';
  const H = window.AF_CH, X = window.AF_CHX, D = window.AF_DOCK, RU = window.AF_RULES;
  if (!H || !D || !RU) { console.warn('[pvp] thiếu AF_CH/AF_DOCK, bỏ qua'); return; }
  const esc = D.esc, send = D.send, num = D.num;
  const P = { info: null, mode: null, active: false, friends: new Set(), bg: null, siege: null, holder: null };
  window.AF_PVP = P;
  const ctl = D.add({ id: 'pvp', label: 'PvP', key: 'b', onOpen: () => send({ op: 'pinfo' }) });
  const pn = ctl.panel;
  const plv = () => (X && X.P && X.P.level) || 1;
  const mmss = (s) => Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  const hms = (s) => { const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return (d ? d + ' ngày ' : '') + h + ' giờ ' + m + ' phút'; };
  const W = RU.WORLD;
  Object.assign(P, { tab: 'free' });

  ctl.render = function () {
    if (!ctl.open) return;
    const i = P.info; let h = ctl.head('PvP') + '<div class="tabs">' + [['free', 'Vùng PvP tự do'], ['bg', 'Chiến trường'], ['siege', 'Công thành'], ['shop', 'Danh dự']].map((t) => '<button class="' + (P.tab === t[0] ? 'on' : 'g') + '" data-a="tab" data-v="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>';
    if (!i) { pn.innerHTML = h + '<div class="mut">Đang tải...</div>'; return; }
    if (P.tab === 'free') {
      h += '<div class="row" style="display:block"><b>Đấu Trường Cát Đỏ</b> <small class="mut">vòng lửa đỏ ở giữa Sa Mạc Huyết Thạch (' + Math.round(W.PVPZ.x) + ', ' + Math.round(W.PVPZ.z) + ') · cấp 10+</small><br><small class="mut">Trong vòng đỏ, mọi người đều đánh được nhau, trừ đồng đội trong tổ và bang. Hạ người khác nhận danh dự và vàng (cùng một người chỉ tính 1 lần mỗi 2 phút). Không mất đồ khi bị hạ nhưng độ bền giảm 8.</small></div>';
      h += '<div class="row"><span>Bạn: <b>' + num(i.me.honor) + '</b> danh dự · ' + i.me.kills + ' hạ · ' + i.me.deaths + ' gục · ' + i.me.bgwins + ' thắng chiến trường</span></div>';
      h += '<h4>BẢNG DANH DỰ</h4>' + (i.top.length ? i.top.map((r, k) => '<div class="row"><span>' + (k + 1) + '. <b>' + esc(r.name) + '</b></span><span>' + num(r.honor) + ' danh dự · ' + r.kills + ' hạ</span></div>').join('') : '<div class="mut">Chưa có ai.</div>');
    } else if (P.tab === 'bg') {
      h += '<div class="row" style="display:block"><b>Chiến trường</b> <small class="mut">cấp ' + i.bg.minLv + '+ · 2-10 người</small><br><small class="mut">Hai đội xanh / đỏ, tự chia cân bằng theo cấp. Đội nào đạt ' + i.bg.win + ' lượt hạ gục trước, hoặc nhiều hơn sau ' + i.bg.mins + ' phút, sẽ thắng. Hồi sinh sau 4 giây tại căn cứ đội. Thắng: 30 danh dự + vàng + EXP.</small></div>';
      if (P.bg && P.bg.state) h += '<div class="row"><span>Đang trong trận · tỉ số ' + P.bg.score[0] + ' - ' + P.bg.score[1] + '</span><button class="g" data-a="bgleave">Rời trận</button></div>';
      else if (i.queued || (P.bg && P.bg.queue)) h += '<div class="row"><span>Đang chờ ghép trận... ' + ((P.bg && P.bg.queue) || '') + '</span><button class="g" data-a="bgleave">Hủy</button></div>';
      else h += '<div class="row"><button data-a="bgjoin"' + (plv() < i.bg.minLv ? ' disabled' : '') + '>Vào hàng chờ</button><span class="mut">có thể bấm ở bất cứ đâu (không phải trong phó bản)</span></div>';
    } else if (P.tab === 'siege') {
      const s = P.siege || i.siege;
      h += '<div class="row" style="display:block"><b>Công thành · Pháo Đài Valdren</b> <small class="mut">cấp ' + s.minLv + '+ · phải ở trong một bang hội</small><br><small class="mut">Mỗi thứ Bảy 20:00-20:30 (giờ Việt Nam). Bang đứng một mình hoặc đông nhất trong vòng pháo đài ghi 1 điểm mỗi giây, hạ người của bang khác +5 điểm. Bang nhiều điểm nhất (tối thiểu 60) chiếm pháo đài: thành viên +5% EXP, quỹ bang +3000 vàng, cho tới trận sau. Pháo đài ở (' + Math.round(W.FORT.x) + ', ' + Math.round(W.FORT.z) + ').</small></div>';
      h += '<div class="row"><span>Chủ pháo đài: <b>' + (P.holder ? esc(P.holder.name) : 'chưa có') + '</b></span><span>' + (s.live ? '<b style="color:#ff9a8a">ĐANG DIỄN RA · còn ' + mmss(s.secs) + '</b>' : 'Trận tiếp theo sau ' + hms(s.nextIn)) + '</span></div>';
      if (s.live) h += '<h4>ĐIỂM</h4>' + (s.pts.length ? s.pts.map((r, k) => '<div class="row"><span>' + (k + 1) + '. <b>' + esc(r.name) + '</b></span><span>' + r.pts + ' điểm</span></div>').join('') : '<div class="mut">Chưa bang nào ghi điểm.</div>');
    } else {
      h += '<div class="row"><span>Danh dự của bạn: <b>' + num(i.me.honor) + '</b></span></div>';
      h += [['gem', 'Đá quý x1', 50], ['core', 'Lõi tro x1', 100], ['ward', 'Bùa bảo hộ x1', 150], ['gear', 'Bánh răng x2', 60]].map((r) => '<div class="row"><span>' + r[1] + '</span><button data-a="ex" data-id="' + r[0] + '"' + (i.me.honor < r[2] ? ' disabled' : '') + '>' + r[2] + ' danh dự</button></div>').join('');
    }
    const keep = pn.scrollTop; pn.innerHTML = h; pn.scrollTop = keep;
  };
  pn.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const a = b.dataset.a;
    if (a === 'tab') { P.tab = b.dataset.v; ctl.render(); }
    else if (a === 'bgjoin') send({ op: 'bgjoin' });
    else if (a === 'bgleave') send({ op: 'bgleave' });
    else if (a === 'ex') send({ op: 'pexchange', id: b.dataset.id });
  });

  /* ---------- HUD ---------- */
  const css = document.createElement('style');
  css.textContent = '#afPvp{position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:22;min-width:260px;padding:6px 14px;border-radius:10px;background:rgba(40,12,12,.92);border:2px solid #ff5a4a;color:#f1ebde;font:600 13px system-ui,sans-serif;text-align:center;pointer-events:none}#afPvp[hidden]{display:none}' +
    '#afPvpZ{position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:19;padding:3px 12px;border-radius:999px;background:rgba(40,12,12,.85);border:1px solid #ff5a4a;color:#ff9a8a;font:700 12px system-ui,sans-serif;pointer-events:none}#afPvpZ[hidden]{display:none}';
  document.head.appendChild(css);
  const hud = document.createElement('div'); hud.id = 'afPvp'; hud.hidden = true;
  const zone = document.createElement('div'); zone.id = 'afPvpZ'; zone.hidden = true;
  document.body.append(hud, zone);
  function paint() {
    const run = H.isRunning();
    const b = P.bg, s = P.siege;
    if (b && b.state && run) {
      hud.hidden = false;
      hud.innerHTML = '<b style="color:#6fb4ff">Xanh ' + b.score[0] + '</b> - <b style="color:#ff7a6a">' + b.score[1] + ' Đỏ</b> · ' + (b.state === 'count' ? 'Bắt đầu sau ' + b.secs + 's' : mmss(b.secs)) + ' · bạn: đội ' + (b.team === 0 ? 'Xanh' : 'Đỏ') +
        (b.top && b.top.length ? '<br><small>' + b.top.map((t) => esc(t.name) + ' ' + t.n).join(' · ') + '</small>' : '');
    } else if (s && s.live && run && (P.mode === 'siege' || P.mode === 'wait')) {
      hud.hidden = false;
      hud.innerHTML = '<b>Công thành</b> · còn ' + mmss(s.secs) + (s.pts.length ? '<br><small>' + s.pts.slice(0, 3).map((r) => esc(r.name) + ' ' + r.pts).join(' · ') + '</small>' : '');
    } else hud.hidden = true;
    zone.hidden = !run || !P.mode || P.mode === 'bg';
    if (!zone.hidden) zone.textContent = P.mode === 'wait' ? 'Vùng PvP (bạn chưa đủ điều kiện bị tấn công)' : P.mode === 'siege' ? 'Pháo đài: PvP giữa các bang' : 'Vùng PvP tự do';
  }
  setInterval(paint, 500);

  /* ---------- target picking for the hit message ---------- */
  setInterval(() => {
    const C = window.AF_COMBAT; if (!C || !H.isRunning()) return;
    if (C.inDuel) return;
    if (!P.active) { if (C.duelWith != null) C.duelWith = null; return; }
    const R = H.R; let best = null, bd = 9;
    H.others.forEach((o, id) => { if (P.friends.has(id) || o.dead) return; const d = Math.hypot(o.x - R.x, o.z - R.z); if (d < bd) { bd = d; best = id; } });
    C.duelWith = best;
  }, 120);

  P.onNet = function (m) {
    switch (m.t) {
      case 'pvpinfo': P.info = m; P.siege = m.siege; if (m.siege && m.siege.holder) P.holder = m.siege.holder; ctl.render(); return true;
      case 'pvpstate': P.mode = m.mode; P.active = !!m.active; P.friends = new Set(m.friends || []); paint(); return true;
      case 'siege':
        if (m.holder !== undefined) { P.holder = m.holder; if (window.AF_WORLD2) window.AF_WORLD2.setFlag('Pháo Đài Valdren · ' + (m.holder ? m.holder.name : 'chưa có chủ'), m.holder ? '#e0b040' : '#777777'); }
        if (m.info) { P.siege = m.info; if (ctl.open && P.tab === 'siege') ctl.render(); }
        paint(); return true;
      case 'bg':
        if (m.st === 'queue') { P.bg = Object.assign(P.bg && P.bg.state ? P.bg : {}, { queue: m.n + ' người chờ · ' + m.waited + 's' }); ctl.render(); }
        else if (m.st === 'start') { P.bg = { state: 'count', score: [0, 0], secs: 8, team: m.team, top: [] }; H.toast('<b>Chiến trường</b>: bạn thuộc đội ' + (m.team === 0 ? 'Xanh' : 'Đỏ'), true); if (ctl.open) ctl.toggle(false); }
        else if (m.st === 'hud') P.bg = Object.assign(P.bg || {}, { state: m.state, score: m.score, secs: m.secs, top: m.top });
        else if (m.st === 'go') H.toast('<b>CHIẾN!</b>', true);
        else if (m.st === 'end') { H.toast(m.draw ? 'Hòa!' : m.win ? '<b>Đội bạn thắng!</b> +' + m.honor + ' danh dự' : 'Đội bạn thua. +' + m.honor + ' danh dự', true); if (P.bg) P.bg.state = 'over'; }
        else if (m.st === 'left') { P.bg = null; }
        paint(); ctl.render(); return true;
      default: return false;
    }
  };
})();
