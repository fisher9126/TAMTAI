/* Aetherfall step 12 (browser): Thử thách panel (key T): Tháp Thử Thách, Raid Morvain lobby, and the in-instance HUD (floor / boss bar / timer / revive button).
   The server decides everything; this file draws and sends requests. */
(function () {
  'use strict';
  const H = window.AF_CH, X = window.AF_CHX, D = window.AF_DOCK, RU = window.AF_RULES;
  if (!H || !D || !RU) { console.warn('[instances] thiếu AF_CH/AF_DOCK, bỏ qua'); return; }
  const esc = D.esc, send = D.send, num = D.num;
  const I = { lobby: null, me: { firstDone: false, clears: 0 }, top: [], mine: 0, run: null, tab: 'tower' };
  window.AF_INSTANCES = I;
  const plv = () => (X && X.P && X.P.level) || 1;
  const ctl = D.add({ id: 'inst', label: 'Thử thách', key: 't', onOpen: () => send({ op: 'rinfo' }) });
  const pn = ctl.panel;
  const mmss = (s) => Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);

  ctl.render = function () {
    if (!ctl.open) return;
    let h = ctl.head('Thử thách') + '<div class="tabs"><button class="' + (I.tab === 'tower' ? 'on' : 'g') + '" data-a="tab" data-v="tower">Tháp Thử Thách</button><button class="' + (I.tab === 'raid' ? 'on' : 'g') + '" data-a="tab" data-v="raid">Raid Morvain</button><button class="' + (I.tab === 'dun' ? 'on' : 'g') + '" data-a="tab" data-v="dun">Hầm ngục</button></div>';
    if (I.tab === 'tower') {
      h += '<div class="row" style="display:block"><b>Tháp Thử Thách</b> <small class="mut">cấp 12+ · 1-4 người (tổ đội) · đứng trong làng</small><br><small class="mut">Mỗi tầng có nhiều quái và mạnh hơn tầng trước, mỗi 10 tầng có boss. Hạ hết quái trong 4 phút để lên tầng tiếp. Thưởng vàng và nguyên liệu mỗi tầng; tầng 5, 10... có ngọc hoặc trang bị phụ. Kỷ lục của bạn: <b>tầng ' + I.mine + '</b>.</small></div>';
      h += '<div class="row">' + (I.run && I.run.kind === 'tower' ? '<button data-a="tleave">Rời tháp</button>' : '<button data-a="tenter"' + (plv() < 12 ? ' disabled' : '') + '>Vào tháp</button>') + '<span class="mut">Đội trưởng nhấn nút này để cả đội vào.</span></div>';
      h += '<h4>BẢNG XẾP HẠNG THÁP</h4>' + (I.top.length ? I.top.map((r, i) => '<div class="row"><span>' + (i + 1) + '. <b>' + esc(r.name) + '</b></span><span>tầng ' + r.best + '</span></div>').join('') : '<div class="mut">Chưa có ai leo tháp.</div>');
    } else if (I.tab === 'raid') {
      const lb = I.lobby;
      h += '<div class="row" style="display:block"><b>Raid Morvain, Kẻ Nuốt Sao</b> <small class="mut">cấp 25+ · 1-10 người · đứng trong làng</small><br><small class="mut">Boss 3 giai đoạn: gọi quỷ bóng tối ở 75% máu, rồng con ở 50% và 25%, nổi điên ở 12 phút. Giới hạn 20 phút, mỗi raid có 3 lượt hồi sinh chung. Lần hạ đầu tiên mỗi tuần nhận đầy đủ phần thưởng (trang bị phụ Sử thi hoặc Huyền thoại, ngọc bậc 2, nguyên liệu); các lần sau chỉ nhận ít. ' + (I.me.firstDone ? '<b style="color:#ffb347">Tuần này bạn đã nhận thưởng đầy đủ.</b>' : '<b style="color:#7ddc8f">Tuần này bạn chưa nhận thưởng đầy đủ.</b>') + '</small></div>';
      if (lb) {
        h += '<h4>SẢNH RAID · ' + lb.members.length + '/' + lb.max + '</h4>' + lb.members.map((m) => '<div class="row"><span><b>' + esc(m.name) + '</b> <small class="mut">cấp ' + m.lv + '</small>' + (m.id === lb.leader ? ' <small style="color:#ffd96a">chủ sảnh</small>' : '') + '</span></div>').join('');
        h += '<div class="row"><button class="g" data-a="rleave">Rời sảnh</button><button data-a="rstart">Bắt đầu raid (chỉ chủ sảnh)</button></div>';
      } else h += '<div class="row"><button data-a="rjoin"' + (plv() < 25 ? ' disabled' : '') + '>Vào sảnh raid</button><span class="mut">Người đầu tiên vào sẽ là chủ sảnh; người khác bấm cùng nút để tham gia.</span></div>';
      if (I.run && I.run.kind === 'raid') h += '<div class="row"><button class="g" data-a="rleave">Rời raid</button></div>';
    } else {
      const Z = window.AF_ZONES, d = (Z && Z.dun) || {}, DN = RU.DUNGEON;
      h += '<div class="row" style="display:block"><b>' + esc(DN.name) + ' · chọn độ khó</b><br><small class="mut">Cổng ở phía Nam làng. Thắng một độ khó để mở độ khó kế tiếp. Quái và phần thưởng tăng theo độ khó. Đội trưởng đứng cạnh cổng và bấm E (hoặc nút bên dưới).</small></div>';
      h += DN.diffs.map((nm, i) => { const open = i <= ((d.best | 0) + 1), sel = (Z && Z.diff | 0) === i; return '<div class="row"><span><b>' + nm + '</b> <small class="mut">cấp ' + DN.diffMinLv[i] + '+ · máu x' + DN.diffHp[i] + ' · sát thương x' + DN.diffAtk[i] + ' · thưởng x' + DN.diffRew[i] + '</small></span><button class="' + (sel ? 'on' : '') + '" data-a="diff" data-v="' + i + '"' + (open && plv() >= DN.diffMinLv[i] ? '' : ' disabled') + '>' + (sel ? 'Đang chọn' : open ? 'Chọn' : 'Khóa') + '</button></div>'; }).join('');
      h += '<div class="row"><span class="mut">Lượt hôm nay còn ' + (d.left != null ? d.left : '?') + '/' + (d.max || DN.dailyMax) + '</span><button data-a="denter">Vào hầm ngục</button></div>';
    }
    const keep = pn.scrollTop; pn.innerHTML = h; pn.scrollTop = keep;
  };
  pn.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const a = b.dataset.a;
    if (a === 'tab') { I.tab = b.dataset.v; ctl.render(); }
    else if (a === 'tenter') send({ op: 'tenter' });
    else if (a === 'tleave') send({ op: 'tleave' });
    else if (a === 'rjoin') send({ op: 'rjoin' });
    else if (a === 'rleave') send({ op: 'rleave' });
    else if (a === 'rstart') send({ op: 'rstart' });
    else if (a === 'diff') { if (window.AF_ZONES) window.AF_ZONES.diff = Number(b.dataset.v); ctl.render(); }
    else if (a === 'denter') send({ op: 'dun', act: 'enter', diff: (window.AF_ZONES && window.AF_ZONES.diff) | 0 });
  });

  /* ---------- in-instance HUD ---------- */
  const css = document.createElement('style');
  css.textContent = '#afInst{position:fixed;left:50%;top:44px;transform:translateX(-50%);z-index:21;min-width:300px;padding:8px 14px;border-radius:10px;background:rgba(30,18,52,.92);border:2px solid #c58cff;color:#f1ebde;font:600 13px system-ui,sans-serif;text-align:center}' +
    '#afInst .b{height:9px;border-radius:5px;background:rgba(0,0,0,.5);overflow:hidden;margin:5px 0 3px}#afInst .b i{display:block;height:100%;background:#c0439a}' +
    '#afInst button{background:#f0bf4c;color:#241a05;border:2px solid #241a05;border-radius:9px;padding:3px 9px;font:700 12px system-ui,sans-serif;cursor:pointer;margin-top:4px}#afInst[hidden]{display:none}';
  document.head.appendChild(css);
  const hud = document.createElement('div'); hud.id = 'afInst'; hud.hidden = true; document.body.appendChild(hud);
  ['keydown', 'keyup', 'pointerdown', 'mousedown'].forEach((ev) => hud.addEventListener(ev, (e) => e.stopPropagation()));
  hud.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (!b) return; if (b.dataset.a === 'rrev') send({ op: 'rrevive' }); else if (b.dataset.a === 'leave') send({ op: I.run && I.run.kind === 'raid' ? 'rleave' : 'tleave' }); });
  function paint() {
    const r = I.run; hud.hidden = !r || !H.isRunning(); if (!r) return;
    const secs = Math.max(0, Math.round((r.until - Date.now()) / 1000));
    let h;
    if (r.kind === 'tower') h = '<b>Tháp Thử Thách</b> · ' + (r.state === 'between' ? 'Chuẩn bị tầng ' + (r.floor + 1) + (r.wait ? ' · ' + r.wait + 's' : '') : r.state === 'over' ? 'Kết thúc' : 'Tầng ' + r.floor + ' · còn ' + r.left + ' quái · ' + mmss(secs)) + ' · ' + r.n + ' người';
    else {
      const b = r.boss;
      h = '<b>Raid Morvain</b> · ' + (r.state === 'prep' ? 'Chuẩn bị... ' + r.wait + 's' : r.state === 'over' ? 'Kết thúc' : 'Giai đoạn ' + Math.min(4, (r.phase | 0) + 1) + ' · ' + mmss(secs)) + ' · ' + r.n + ' người · hồi sinh còn ' + (r.revives | 0);
      if (b) h += '<div class="b"><i style="width:' + Math.max(0, Math.min(100, b.hp / Math.max(1, b.max) * 100)) + '%"></i></div><small>' + esc(b.name) + ' ' + num(b.hp) + ' / ' + num(b.max) + '</small>';
      if (r.kind === 'raid' && H.R && !H.R.alive) h += '<br><button data-a="rrev">Hồi sinh trong raid</button>';
    }
    hud.innerHTML = h + (r.state !== 'over' ? '<br><button data-a="leave" style="background:#e9edf8">Rời</button>' : '');
  }
  setInterval(paint, 500);

  I.onNet = function (m) {
    switch (m.t) {
      case 'raidlobby': I.lobby = m.lobby || null; if (m.me) I.me = m.me; ctl.render(); return true;
      case 'tower': I.top = m.top || []; I.mine = m.mine | 0; ctl.render(); return true;
      case 'inst':
        if (m.st === 'start') { I.run = { kind: m.kind, state: m.kind === 'raid' ? 'prep' : 'between', floor: 0, left: 0, until: Date.now() + 60000, n: m.n, wait: 0 }; H.toast('<b>' + esc(m.name) + '</b>: ' + m.n + ' người', true); if (ctl.open) ctl.toggle(false); paint(); }
        else if (m.st === 'hud') { I.run = Object.assign(I.run || {}, { kind: m.kind, state: m.state, floor: m.floor, left: m.left, until: Date.now() + m.secs * 1000, n: m.n, wait: m.wait | 0, phase: m.phase, revives: m.revives, boss: m.boss || null }); paint(); }
        else if (m.st === 'floor') H.toast(m.boss ? '<b>Tầng ' + m.floor + ': BOSS!</b>' : 'Tầng <b>' + m.floor + '</b>', !!m.boss);
        else if (m.st === 'phase') H.toast(esc(m.text), true);
        else if (m.st === 'reward') {
          if (m.kind === 'tower') H.chatLine('sys', 'Tầng ' + m.floor + ' xong: +' + num(m.gold) + ' vàng, ' + esc(Object.keys(m.mats || {}).map((k) => '+' + m.mats[k] + ' ' + (RU.MATS[k] ? RU.MATS[k].name : k)).join(', ')));
          else H.chatLine('sys', 'Phần thưởng raid' + (m.first ? ' (lần đầu trong tuần)' : '') + ': ' + num(m.gold) + ' vàng, ' + num(m.exp) + ' EXP, ' + esc(Object.keys(m.mats || {}).map((k) => '+' + m.mats[k] + ' ' + (RU.MATS[k] ? RU.MATS[k].name : k)).join(', ')) + (m.got && m.got.length ? ', ' + esc(m.got.join(', ')) : ''));
        } else if (m.st === 'end') { H.toast(m.win ? '<b>Chiến thắng!</b> ' + esc(m.reason) : 'Thất bại. ' + esc(m.reason), true); if (I.run) I.run.state = 'over'; paint(); send({ op: 'ttop' }); }
        else if (m.st === 'left') { I.run = null; paint(); if (m.why) H.toast(esc(m.why)); }
        return true;
      default: return false;
    }
  };
})();
