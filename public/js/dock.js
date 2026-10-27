/* Aetherfall step 11+ (browser): one column of launcher buttons on the right edge plus a tiny helper for panels and hotkeys, so the many new
   panels (equipment, challenges, factions, PvP, team) do not pile up on the left. Must be loaded before equip.js, instances.js, faction.js, pvp.js, team.js.
   AF_DOCK.add({ id, label, key, wide, onOpen }) -> controller { panel, btn, open, toggle(v), render, head(title) }. */
(function () {
  'use strict';
  const H = window.AF_CH;
  if (!H) { console.warn('[dock] thiếu AF_CH, bỏ qua'); return; }
  const css = document.createElement('style');
  css.textContent = `
  #afDock{position:fixed;right:10px;top:50%;transform:translateY(-50%);z-index:40;display:flex;flex-direction:column;gap:5px;max-height:84vh;overflow:auto}
  #afDock button{border:2px solid #241a05;background:#c9b8ff;color:#241a05;font:700 12px system-ui,sans-serif;padding:6px 10px;border-radius:10px;cursor:pointer;box-shadow:0 2px 0 #241a05;text-align:left}
  #afDock button.on{background:#ffe08a}
  #afDock[hidden]{display:none}
  .afp{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:59;width:min(97vw,760px);max-height:86vh;overflow:auto;box-sizing:border-box;padding:14px 16px;background:rgba(18,26,52,.97);color:#eef3ff;border:3px solid #241a05;border-radius:16px;box-shadow:0 10px 0 rgba(0,0,0,.35);font:13px/1.45 system-ui,sans-serif}
  .afp[hidden]{display:none}
  .afp .hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
  .afp .hd b{font-size:18px}
  .afp h4{margin:12px 0 4px;font-size:12px;letter-spacing:.06em;color:#ffd96a}
  .afp .row{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:7px 8px;border-radius:9px;background:rgba(255,255,255,.06);margin:5px 0}
  .afp .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin:8px 0}
  .afp .box{background:rgba(255,255,255,.06);border-radius:10px;padding:8px;min-height:60px}
  .afp .mut{color:#aab6d8}
  .afp .up{color:#8fe08f}.afp .dn{color:#ff9a8a}
  .afp button{background:#f0bf4c;color:#241a05;border:2px solid #241a05;border-radius:9px;padding:3px 9px;font:700 12px system-ui,sans-serif;cursor:pointer;margin:2px}
  .afp button.g{background:#e9edf8}.afp button.on{background:#9fd3ff}.afp button[disabled]{opacity:.4;cursor:default}
  .afp .tabs{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}
  .afp .bar{height:7px;border-radius:5px;background:rgba(0,0,0,.45);overflow:hidden;margin-top:3px}.afp .bar i{display:block;height:100%;background:#7ddc8f}
  .afp input,.afp select{background:#0e1428;color:#eef3ff;border:2px solid #3a4670;border-radius:8px;padding:3px 6px;font:12px system-ui,sans-serif}`;
  document.head.appendChild(css);
  const dock = document.createElement('div'); dock.id = 'afDock'; dock.hidden = true; document.body.appendChild(dock);
  const stop = (el) => ['keydown', 'keyup', 'pointerdown', 'mousedown', 'wheel'].forEach((ev) => el.addEventListener(ev, (e) => e.stopPropagation()));
  stop(dock);
  const D = { list: [], keys: {}, add };
  window.AF_DOCK = D;

  function add(o) {
    const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = o.label + (o.key ? ' (' + o.key.toUpperCase() + ')' : '');
    const pn = document.createElement('div'); pn.className = 'afp'; pn.id = 'afp_' + o.id; pn.hidden = true;
    if (o.wide) pn.style.width = 'min(97vw,' + o.wide + 'px)';
    dock.appendChild(btn); document.body.appendChild(pn); stop(pn);
    const ctl = { id: o.id, btn, panel: pn, open: false, render: null };
    ctl.head = (title) => '<div class="hd"><b>' + title + '</b><button class="g" data-a="x">Đóng' + (o.key ? ' (' + o.key.toUpperCase() + ')' : '') + '</button></div>';
    ctl.toggle = (v) => {
      const want = v === undefined ? !ctl.open : !!v;
      if (want) D.list.forEach((c) => { if (c !== ctl && c.open) c.toggle(false); });
      ctl.open = want; pn.hidden = !want; btn.classList.toggle('on', want);
      if (want) { if (o.onOpen) { try { o.onOpen(ctl); } catch (err) { console.error('[dock ' + o.id + ']', err); } } if (ctl.render) { try { ctl.render(); } catch (err) { console.error('[dock ' + o.id + ']', err); } } }
    };
    pn.addEventListener('click', (e) => { if (e.target.closest('[data-a="x"]')) ctl.toggle(false); });
    btn.addEventListener('click', () => ctl.toggle());
    if (o.key) D.keys[o.key.toLowerCase()] = ctl;
    D.list.push(ctl);
    return ctl;
  }
  window.addEventListener('keydown', (e) => {
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (!H.isRunning() || e.ctrlKey || e.metaKey || e.altKey || e.repeat || (window.AF_CLASS && window.AF_CLASS.creating)) return;
    const k = (e.code || '').indexOf('Key') === 0 ? e.code.slice(3).toLowerCase() : String(e.key).toLowerCase();
    const c = D.keys[k]; if (c) c.toggle();
  });
  setInterval(() => { dock.hidden = !H.isRunning() || !!(window.AF_CLASS && window.AF_CLASS.creating); }, 500);
  D.esc = H.esc;
  D.send = (m) => H.NET.send(Object.assign({ t: 'zone' }, m));
  D.num = (n) => Number(n || 0).toLocaleString('vi-VN');
})();
