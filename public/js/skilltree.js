/* Aetherfall step 7 (browser): skill tree panel (key Y). Three branches per class, three saved builds, reset, ultimate nodes.
   The server validates every click; this file only draws the tree and sends requests. */
(function () {
  'use strict';
  const H = window.AF_CH, T = window.AF_TREE, RU = window.AF_RULES;
  if (!H || !T || !RU) { console.warn('[skilltree] thiếu AF_CH/AF_TREE, bỏ qua (hãy thêm tree.js trước skilltree.js trong index.html)'); return; }
  const esc = H.esc, send = (m) => H.NET.send(m);
  const K = { st: { cls: null, sets: [{}, {}, {}], cur: 0, total: 0, resetCost: 0 }, open: false };
  window.AF_SKILLTREE = K;
  const plv = () => (window.AF_CHX && window.AF_CHX.P && window.AF_CHX.P.level) || 1;
  const css = document.createElement('style');
  css.textContent = `
  #afTB{position:fixed;left:10px;top:calc(46% - 176px);z-index:40;border:2px solid #241a05;background:#c9b8ff;color:#241a05;font:700 13px system-ui,sans-serif;padding:8px 12px;border-radius:12px;cursor:pointer;box-shadow:0 3px 0 #241a05}
  #afTR{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:58;width:min(97vw,760px);max-height:86vh;overflow:auto;box-sizing:border-box;padding:14px 16px;background:rgba(18,26,52,.97);color:#eef3ff;border:3px solid #241a05;border-radius:16px;box-shadow:0 10px 0 rgba(0,0,0,.35);font:13px/1.45 system-ui,sans-serif}
  #afTR .cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-top:8px}
  #afTR .col{background:rgba(255,255,255,.05);border-radius:10px;padding:8px}
  #afTR .nd{display:flex;justify-content:space-between;align-items:center;gap:6px;padding:5px 6px;border-radius:8px;margin:4px 0;background:rgba(255,255,255,.06)}
  #afTR .nd.lock{opacity:.45}#afTR .nd.u{border:1px solid #ffd95a}#afTR .mut{color:#aab6d8}
  #afTR button{background:#f0bf4c;color:#241a05;border:2px solid #241a05;border-radius:9px;padding:3px 9px;font:700 12px system-ui,sans-serif;cursor:pointer}
  #afTR button.g{background:#e9edf8}#afTR button.on{background:#fff3c4;box-shadow:0 0 0 2px #f0bf4c}#afTR button[disabled]{opacity:.4;cursor:default}
  #afTB[hidden],#afTR[hidden]{display:none}`;
  document.head.appendChild(css);
  const btn = document.createElement('button'); btn.id = 'afTB'; btn.type = 'button'; btn.textContent = 'Kỹ năng (Y)'; btn.hidden = true;
  const pn = document.createElement('div'); pn.id = 'afTR'; pn.hidden = true;
  document.body.append(btn, pn);
  [btn, pn].forEach((el) => ['keydown', 'keyup', 'pointerdown', 'mousedown'].forEach((ev) => el.addEventListener(ev, (e) => e.stopPropagation())));

  const effText = (n) => {
    const bits = [];
    if (n.eff) Object.keys(n.eff).forEach((k) => bits.push('+' + (k === 'crit' || k === 'spd' ? (n.eff[k] * 100).toFixed(0) + '%' : (n.eff[k] * 100).toFixed(0) + '%') + ' ' + T.STAT[k].toLowerCase() + (n.kind === 'u' ? '' : '/bậc')));
    if (n.skill) bits.push('+' + Math.round(n.per * 100) + '% sát thương ' + (T.SK[n.skill] || n.skill) + (n.kind === 'u' ? '' : '/bậc'));
    return bits.join(', ');
  };
  function render() {
    if (!K.open) return;
    const s = K.st, cls = s.cls; let h = '<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:18px">Cây kỹ năng' + (cls && RU.CLASSES[cls] ? ' · ' + esc(RU.CLASSES[cls].name) : '') + '</b><button class="g" data-a="x">Đóng (Y)</button></div>';
    if (!cls) { pn.innerHTML = h + '<p class="mut">Hãy tạo nhân vật trước để mở cây kỹ năng.</p>'; return; }
    const a = s.sets[s.cur] || {}, used = Object.keys(a).reduce((n, id) => n + a[id], 0), left = Math.max(0, s.total - used), lv = plv();
    h += '<div style="margin:8px 0">Điểm còn lại: <b style="color:#ffd95a">' + left + '</b> / ' + s.total + ' · Bộ kỹ năng: ' + [0, 1, 2].map((i) => '<button class="' + (i === s.cur ? 'on' : 'g') + '" data-a="set" data-i="' + i + '">' + (i + 1) + '</button>').join(' ') +
      ' <button class="g" data-a="reset" style="float:right">Tẩy điểm' + (s.resetCost ? ' (' + s.resetCost + ' vàng)' : ' (miễn phí)') + '</button></div>';
    h += '<div class="mut">Mỗi cấp được 1 điểm. Kỹ năng tối thượng (viền vàng) mở ở cấp 20 / 40 / 60 và cần ' + T.ULT_NEED + ' điểm trong nhánh. Mỗi bộ kỹ năng có điểm riêng, đổi được để chuyển giữa lối chơi PvE và PvP.</div><div class="cols">';
    T.TREE[cls].forEach((b, bi) => {
      const bp = b.nodes.reduce((n, nd) => n + (nd.kind !== 'u' ? (a[nd.id] | 0) : 0), 0);
      h += '<div class="col"><b>' + esc(b.name) + '</b> <span class="mut">(' + bp + ' điểm)</span><div class="mut" style="font-size:12px">' + esc(b.desc) + '</div>';
      b.nodes.forEach((n) => {
        const r = a[n.id] | 0, locked = lv < n.lv || (n.kind === 'u' && bp < T.ULT_NEED), full = r >= n.max;
        h += '<div class="nd' + (locked ? ' lock' : '') + (n.kind === 'u' ? ' u' : '') + '"><span><b>' + esc(n.name) + '</b> <span class="mut">' + r + '/' + n.max + (lv < n.lv ? ' · cấp ' + n.lv : '') + '</span><br><small class="mut">' + esc(effText(n)) + '</small></span><button data-a="up" data-id="' + n.id + '"' + (locked || full || !left ? ' disabled' : '') + '>+</button></div>';
      });
      h += '</div>';
    });
    pn.innerHTML = h + '</div>';
  }
  pn.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const a = b.dataset.a;
    if (a === 'x') toggle(false); else if (a === 'up') send({ t: 'zone', op: 'tup', id: b.dataset.id });
    else if (a === 'set') send({ t: 'zone', op: 'tset', i: Number(b.dataset.i) });
    else if (a === 'reset') { if (confirm('Tẩy toàn bộ điểm của bộ kỹ năng này?')) send({ t: 'zone', op: 'treset' }); }
  });
  function toggle(v) { K.open = v === undefined ? !K.open : v; pn.hidden = !K.open; if (K.open) { send({ t: 'zone', op: 'tinfo' }); render(); } }
  btn.addEventListener('click', () => toggle());
  window.addEventListener('keydown', (e) => {
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (!H.isRunning() || e.ctrlKey || e.metaKey || e.altKey || e.repeat || (window.AF_CLASS && window.AF_CLASS.creating)) return;
    const k = (e.code || '').indexOf('Key') === 0 ? e.code.slice(3).toLowerCase() : String(e.key).toLowerCase();
    if (k === 'y') toggle();
  });
  setInterval(() => { btn.hidden = !H.isRunning() || !!(window.AF_CLASS && window.AF_CLASS.creating); }, 500);
  K.onNet = function (m) {
    if (m.t !== 'tinfo') return false;
    K.st = { cls: m.cls, sets: m.sets, cur: m.cur, total: m.total, resetCost: m.resetCost }; render(); return true;
  };
})();
