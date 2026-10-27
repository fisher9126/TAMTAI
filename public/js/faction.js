/* Aetherfall step 13 (browser): factions and reputation panel (key O): standing with the four factions, donating materials, faction shop. */
(function () {
  'use strict';
  const H = window.AF_CH, X = window.AF_CHX, D = window.AF_DOCK, RU = window.AF_RULES;
  if (!H || !D || !RU || !RU.FACTIONS) { console.warn('[faction] thiếu AF_CH/AF_DOCK/rules.js mới, bỏ qua'); return; }
  const esc = D.esc, send = D.send, num = D.num;
  const Fc = { rep: {}, tiers: {}, mats: {}, bonus: {} };
  window.AF_FACTION = Fc;
  const ctl = D.add({ id: 'faction', label: 'Phe phái', key: 'o', onOpen: () => send({ op: 'finfo' }) });
  const pn = ctl.panel;
  const DONATE = { knight: { ore: 3, coal: 3, gear: 8 }, mage: { shroom: 3, frost: 3, void: 8, core: 10 }, trader: { herb: 2, shell: 2, feather: 3, pelt: 3, sand: 4 }, cult: { venom: 4, void: 10, bone: 6, core: 10 } };
  const SHOP = [['pot', 2, 'Bình máu x10', 150], ['rare', 3, 'Trang bị phụ Hiếm', 600], ['gem', 3, 'Ngọc bậc 2 ngẫu nhiên', 900], ['epic', 4, 'Trang bị phụ Sử thi', 3000]];
  const gold = () => (X && X.P && X.P.gold) || 0;
  const NEXT = [0, 0, 500, 2000, 6000];
  ctl.render = function () {
    if (!ctl.open) return;
    let h = ctl.head('Phe phái & danh tiếng') + '<div class="mut">Hạ quái để tăng danh tiếng với phe tương ứng; cống hiến nguyên liệu để tăng nhanh. Giúp một phe sẽ làm phe đối địch (Hiệp Sĩ ↔ Giáo phái Tro Tàn) giảm một phần. Thân thiện: +chỉ số nhỏ, Kính trọng, Tôn kính: thêm chỉ số, cửa hàng và thú cưỡi riêng.</div>';
    h += Object.keys(RU.FACTIONS).map((k) => {
      const f = RU.FACTIONS[k], pts = Fc.rep[k] | 0, t = Fc.tiers[k] == null ? 1 : Fc.tiers[k], nx = NEXT[Math.min(4, t + 1)], prev = NEXT[t];
      const mats = Object.keys(DONATE[k]).filter((m) => (Fc.mats[m] | 0) > 0);
      return '<div class="row" style="display:block"><div><b style="color:' + f.col + '">' + esc(f.name) + '</b> <small class="mut">' + esc(f.desc) + '</small></div>' +
        '<div>' + RU.REP_TIERS[t].name + ' · ' + num(pts) + (t < 4 ? ' / ' + num(nx) : ' (tối đa)') + '</div>' + (t < 4 ? '<div class="bar"><i style="width:' + Math.max(0, Math.min(100, (pts - prev) / Math.max(1, nx - prev) * 100)) + '%;background:' + f.col + '"></i></div>' : '') +
        '<div style="margin-top:4px"><small class="mut">Cống hiến: </small>' + (mats.length ? mats.map((m) => '<button class="g" data-a="don" data-f="' + k + '" data-m="' + m + '">' + esc(RU.MATS[m].name) + ' x' + Fc.mats[m] + ' → +' + DONATE[k][m] + '/cái</button>').join('') : '<small class="mut">bạn chưa có nguyên liệu phù hợp (' + Object.keys(DONATE[k]).map((m) => esc(RU.MATS[m].name)).join(', ') + ')</small>') + '</div>' +
        '<div style="margin-top:4px"><small class="mut">Cửa hàng: </small>' + SHOP.map((s) => '<button data-a="buy" data-f="' + k + '" data-id="' + s[0] + '"' + (t < s[1] || gold() < s[3] ? ' disabled' : '') + '>' + esc(s[2]) + ' · ' + num(s[3]) + ' (' + RU.REP_TIERS[s[1]].name + ')</button>').join('') + '</div></div>';
    }).join('');
    const b = Fc.bonus, ks = Object.keys(b);
    h += '<div class="row"><span>Chỉ số cộng thêm từ danh tiếng: ' + (ks.length ? ks.map((k) => '+' + b[k] + ' ' + ({ atk: 'Sức đánh', def: 'Giáp', hp: 'Máu', mp: 'Mana', crit: 'Chí mạng', spd: 'Tốc độ' }[k] || k)).join(', ') : '<span class="mut">chưa có</span>') + '</span></div>';
    const keep = pn.scrollTop; pn.innerHTML = h; pn.scrollTop = keep;
  };
  pn.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    if (b.dataset.a === 'don') { const n = e.shiftKey ? 10 : 1; send({ op: 'fdonate', f: b.dataset.f, mat: b.dataset.m, n }); }
    else if (b.dataset.a === 'buy') send({ op: 'fbuy', f: b.dataset.f, id: b.dataset.id });
  });
  Fc.onNet = function (m) {
    if (m.t === 'finfo') { Fc.rep = m.rep || {}; Fc.tiers = m.tiers || {}; Fc.mats = m.mats || {}; Fc.bonus = m.bonus || {}; ctl.render(); return true; }
    if (m.t === 'fup') { H.toast('Danh tiếng với <b>' + esc(RU.FACTIONS[m.f].name) + '</b>: ' + RU.REP_TIERS[m.tier].name, true); return true; }
    return false;
  };
})();
