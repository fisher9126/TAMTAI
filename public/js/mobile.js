/* Aetherfall mobile layout. Runs only on touch devices (or with ?mobile=1); the desktop layout is untouched.
   - HUD: small player frame top-left, quest tracker under it, minimap top-right, a short top bar (bag, quests, map, chat, menu)
   - left thumb: joystick; right thumb: attack button (hold to keep attacking) with the four skills on an arc, dodge and potions
   - extra round buttons for talk (E), mount (X), jump (Z) and block (F)
   - "Menu" opens a full-screen launcher with every panel; every panel opens full screen with room to scroll
   Panels are opened by sending the same key presses the desktop uses, so every plugin keeps its own logic. */
(function () {
  'use strict';
  const q = location.search;
  const coarse = !!(window.matchMedia && matchMedia('(pointer:coarse)').matches);
  const small = Math.min(screen.width || 9999, screen.height || 9999) <= 900;
  const touch = coarse || (('ontouchstart' in window) && small); // phones and tablets; a touch-screen laptop keeps the desktop layout
  let force = null; try { force = localStorage.getItem('af-mobile'); } catch (e) { /* ignore */ }
  if (/[?&]mobile=1/.test(q)) force = '1'; if (/[?&]mobile=0/.test(q)) force = '0';
  if (force === '0' && touch) { // a phone that chose the desktop layout gets a small button to come back
    const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Giao diện điện thoại';
    b.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;padding:8px 12px;border-radius:9px;border:1px solid rgba(224,122,58,.5);background:rgba(14,11,10,.85);color:#ffd9a8;font:600 12px system-ui';
    b.addEventListener('click', () => { try { localStorage.removeItem('af-mobile'); } catch (e) { /* ignore */ } location.reload(); });
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(b)); if (document.body) document.body.appendChild(b);
  }
  if (force === '0' || (!touch && force !== '1')) return;
  document.documentElement.classList.add('af-m');

  const $ = (id) => document.getElementById(id);
  const H = () => window.AF_CH;
  const running = () => { const h = H(); return !!(h && h.isRunning && h.isRunning()); };

  /* ---------- send a desktop key press (keydown + keyup) ---------- */
  const CODE = { ' ': 'Space', escape: 'Escape' };
  function key(k, hold) {
    const ae = document.activeElement; if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) ae.blur();
    const kk = k === 'escape' ? 'Escape' : k, code = CODE[k] || (/^[a-z]$/.test(k) ? 'Key' + k.toUpperCase() : /^[0-9]$/.test(k) ? 'Digit' + k : k);
    const opt = { key: kk, code, bubbles: true, cancelable: true };
    window.dispatchEvent(new KeyboardEvent('keydown', opt));
    if (!hold) window.dispatchEvent(new KeyboardEvent('keyup', opt));
    return () => window.dispatchEvent(new KeyboardEvent('keyup', opt));
  }
  /* close whatever panel is open (Esc a few times covers stacked dialogs) */
  function closeAll() { hideMenu(); for (let i = 0; i < 3; i++) key('escape'); document.documentElement.classList.remove('af-chat'); }

  const ICO = {
    i: '<path d="M6 8h12l-1 13H7z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    n: '<path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    m: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    e: '<path d="M4 5h16v11H9l-5 4z"/><path d="M9 10h6"/>',
    x: '<path d="M4 16c3-1 4-5 8-6s7 2 8 6"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M12 10V5l3-1"/>',
    z: '<path d="M12 19V5M6 11l6-6 6 6"/><path d="M5 21h14"/>',
    f: '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/>',
    fr: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    adm: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
    out: '<path d="M14 4h6v16h-6"/><path d="M10 8l-4 4 4 4M6 12h11"/>',
    pc: '<path d="M3 5h18v11H3zM8 20h8M12 16v4"/>'
  };
  const svg = (p) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + p + '</svg>';

  /* ---------- styles ---------- */
  const css = document.createElement('style'); css.id = 'afMobileCss';
  css.textContent = `
  html.af-m{--sl:env(safe-area-inset-left,0px);--sr:env(safe-area-inset-right,0px);--st:env(safe-area-inset-top,0px);--sb:env(safe-area-inset-bottom,0px)}
  html.af-m body{-webkit-text-size-adjust:100%;overscroll-behavior:none}
  html.af-m button{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
  /* hide desktop-only pieces */
  html.af-m #afMenu,html.af-m #hud .rbtns,html.af-m #zone,html.af-m #lockBtn,html.af-m #afHint,html.af-m #cross,html.af-m .sk .key{display:none!important}
  /* player frame */
  html.af-m #hud .pframe{position:fixed!important;left:calc(6px + var(--sl));top:calc(6px + var(--st));transform:scale(.74);transform-origin:0 0;z-index:30;pointer-events:auto}
  /* quest tracker under the player frame */
  html.af-m #afQT{position:fixed!important;left:calc(6px + var(--sl))!important;right:auto!important;top:calc(70px + var(--st))!important;width:196px!important;min-width:0!important;max-height:30vh;overflow:hidden;font-size:11px!important;padding:6px 9px!important;z-index:28!important;background:rgba(14,11,10,.72)!important}
  html.af-m #afQT.afQTsmall > :not(:first-child){display:none}
  html.af-m #afNavTag{left:50%!important;right:auto!important;top:calc(58px + var(--st))!important;bottom:auto!important;transform:translateX(-50%) scale(.9)!important;z-index:27!important}
  /* minimap + clock */
  html.af-m #hud .right{position:fixed!important;right:calc(6px + var(--sr));top:calc(6px + var(--st));z-index:30;gap:4px!important}
  html.af-m #hud .mm{width:92px!important;height:92px!important}
  html.af-m #afXTime{top:calc(102px + var(--st))!important;right:calc(6px + var(--sr))!important;font-size:10px!important;padding:2px 7px!important;z-index:29!important}
  /* target frame */
  html.af-m #hud .tgt{display:flex!important;position:fixed!important;left:50%;top:calc(84px + var(--st));transform:translateX(-50%) scale(.85);z-index:26}
  html.af-m #hud .tgt .meter{width:180px}
  /* top bar */
  #afMTop{position:fixed;left:50%;top:calc(6px + var(--st));transform:translateX(-50%);z-index:31;display:flex;gap:4px;padding:4px;border-radius:12px;background:rgba(14,11,10,.72);border:1px solid rgba(224,122,58,.28);pointer-events:auto}
  #afMTop button,#afMAct button{all:unset;box-sizing:border-box;position:relative;width:46px;height:44px;border-radius:9px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;color:#e3d6bd;cursor:pointer}
  #afMTop button:active,#afMAct button:active{background:rgba(224,122,58,.3)}
  #afMTop svg,#afMAct svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
  #afMTop span,#afMAct span{font:600 9px/1 system-ui,sans-serif;white-space:nowrap}
  #afMTop .dot{position:absolute;right:6px;top:5px;width:8px;height:8px;border-radius:50%;background:#e0533f;display:none}
  html.af-m.af-unread #afMTop .dot{display:block}
  /* joystick */
  html.af-m #joy{display:block!important;position:fixed!important;left:calc(22px + var(--sl));bottom:calc(22px + var(--sb));width:136px!important;height:136px!important;z-index:25;background:radial-gradient(circle,rgba(255,255,255,.05),rgba(255,255,255,.12))!important;border:2px solid rgba(255,214,160,.25)!important}
  html.af-m #joy i{width:60px!important;height:60px!important;margin:-30px 0 0 -30px!important;background:radial-gradient(circle at 40% 35%,rgba(255,236,210,.55),rgba(224,122,58,.45))!important;box-shadow:0 2px 8px rgba(0,0,0,.5)}
  /* skills: attack button in the corner, skills on an arc around it */
  html.af-m #hud .skills{position:fixed!important;right:calc(10px + var(--sr));bottom:calc(10px + var(--sb));width:250px!important;height:250px!important;padding:0!important;margin:0!important;background:none!important;border:0!important;box-shadow:none!important;display:block!important;z-index:25;pointer-events:none;transform:none!important}
  html.af-m #hud .skills > *{pointer-events:auto}
  html.af-m #hud .skills .afSep{display:none!important}
  html.af-m #hud .skills .sk{position:absolute!important;margin:0!important;border-radius:50%!important;width:54px!important;height:54px!important;transform:none!important}
  html.af-m #hud .skills .sk svg{width:24px;height:24px}
  html.af-m #hud .skills .sk .afMana{font-size:9px!important;bottom:-3px!important}
  html.af-m #hud .skills #skA{width:86px!important;height:86px!important;right:12px;bottom:12px}
  html.af-m #hud .skills #skA svg{width:36px;height:36px}
  html.af-m #hud .skills #sk1{right:128px;bottom:28px}
  html.af-m #hud .skills #sk2{right:114px;bottom:90px}
  html.af-m #hud .skills #sk3{right:72px;bottom:138px}
  html.af-m #hud .skills #sk4{right:14px;bottom:154px}
  html.af-m #hud .skills #skD{right:192px;bottom:12px;width:50px!important;height:50px!important}
  html.af-m #hud .skills #skP{right:178px;bottom:120px;width:44px!important;height:44px!important}
  html.af-m #hud .skills #skM{right:136px;bottom:168px;width:44px!important;height:44px!important}
  html.af-m #hud .skills .sk .cnt{font-size:10px!important}
  /* talk / mount / jump / block */
  #afMAct{position:fixed;left:calc(176px + var(--sl));bottom:calc(14px + var(--sb));z-index:25;display:flex;gap:6px;pointer-events:auto}
  #afMAct button{width:50px;height:50px;border-radius:50%;background:rgba(14,11,10,.66);border:1px solid rgba(224,122,58,.32);box-shadow:0 3px 10px rgba(0,0,0,.45)}
  #afMAct button.on{background:rgba(224,122,58,.45);color:#fff}
  /* chat: hidden until opened from the top bar */
  html.af-m #chat{position:fixed!important;left:calc(8px + var(--sl));top:calc(66px + var(--st));bottom:auto;width:min(360px,58vw)!important;max-height:52vh;z-index:40;display:none!important}
  html.af-m.af-chat #chat{display:flex!important;flex-direction:column}
  html.af-m #chatLog{height:auto!important;max-height:calc(52vh - 60px);overflow-y:auto}
  html.af-m #chatIn{font-size:16px!important}
  /* bottom exp line */
  html.af-m #hud .expbar{position:fixed!important;left:0;right:0;bottom:0;height:4px!important;margin:0!important;z-index:24}
  html.af-m #hud .expbar i{top:0!important;height:4px!important}
  html.af-m #hud .expbar span{display:none}
  /* toasts and NPC dialog */
  html.af-m #toasts{position:fixed!important;left:50%;top:calc(120px + var(--st));transform:translateX(-50%);width:min(440px,70vw);z-index:45}
  html.af-m #dialog{position:fixed!important;left:50%;bottom:calc(12px + var(--sb));transform:translateX(-50%);width:min(560px,94vw);max-height:60vh;overflow:auto;z-index:46}
  html.af-m #dialog .btn{min-height:46px}
  /* every panel opens full screen */
  html.af-m :is(#afChar,[id^="afp_"],#afTR,#afQJ,#afQD,#afZ,#afGR,#afUR,#afVR,#afSoc,#afMap,#friends,#inv,#afSkill,#afShop,#afTrade,#afGuild,#afTeam){position:fixed!important;inset:0!important;left:0!important;top:0!important;right:0!important;bottom:0!important;width:auto!important;height:auto!important;max-width:none!important;max-height:none!important;min-width:0!important;transform:none!important;margin:0!important;border-radius:0!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y;padding-top:max(12px,var(--st))!important;padding-left:max(12px,var(--sl))!important;padding-right:max(12px,var(--sr))!important;padding-bottom:max(16px,var(--sb))!important;box-sizing:border-box!important}
  html.af-m :is(#afChar,[id^="afp_"],#afTR,#afQJ,#afQD,#afZ,#afGR,#afUR,#afVR,#afSoc,#afMap,#friends,#inv) *{touch-action:pan-y}
  html.af-m #afMap canvas{width:min(78vh,92vw)!important;height:min(78vh,92vw)!important;margin:0 auto;touch-action:none!important}
  html.af-m :is(#afChar,[id^="afp_"],#afTR,#afQJ,#afQD,#afZ,#afGR,#afUR,#afVR,#afSoc,#afMap,#friends) button{min-height:36px}
  /* the armoury: bag on the right, character on the left, item details slide in as a sheet */
  html.af-m #afArm .win{width:100vw!important;height:100%!important;max-height:none!important;border-radius:0!important;grid-template-columns:minmax(196px,30%) 1fr!important;position:relative}
  html.af-m #afArm{align-items:stretch!important}
  html.af-m #afArm header{padding:6px 10px calc(6px) max(10px,var(--sl))!important}
  html.af-m #afArm header .hint{display:none}
  html.af-m #afArm .col{padding:8px!important;-webkit-overflow-scrolling:touch;touch-action:pan-y}
  html.af-m #afArm .col *{touch-action:pan-y}
  html.af-m #afArm .col.r{position:absolute;right:0;top:0;bottom:0;width:min(360px,94vw);z-index:5;background:#120e0c!important;box-shadow:-14px 0 34px rgba(0,0,0,.7);transform:translateX(105%);transition:transform .2s ease;padding-right:max(10px,var(--sr))!important}
  html.af-m #afArm.hasR .col.r{transform:none}
  html.af-m #afArm .mclose{display:flex!important}
  html.af-m #afArm .doll{grid-template-columns:44px 1fr 44px!important;gap:5px!important}
  html.af-m #afArm .doll2 .slot{width:44px!important}
  html.af-m #afArm .slot small{font-size:8.5px!important}
  html.af-m #afArm .grid{grid-template-columns:repeat(auto-fill,minmax(56px,1fr))!important}
  html.af-m #afArm .tabs .chip,html.af-m #afArm .bar .chip{padding:8px 11px!important}
  /* launcher */
  #afMMenu{position:fixed;inset:0;z-index:90;background:rgba(6,5,4,.92);display:flex;flex-direction:column;padding:max(12px,var(--st)) max(14px,var(--sr)) max(14px,var(--sb)) max(14px,var(--sl));box-sizing:border-box;overflow-y:auto;color:#e3d6bd;font:13px system-ui,sans-serif}
  #afMMenu[hidden]{display:none}
  #afMMenu .hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
  #afMMenu h2{margin:0;font:800 20px 'Cinzel','Times New Roman',serif;color:#ffb066;letter-spacing:.06em}
  #afMMenu .x{all:unset;box-sizing:border-box;width:46px;height:46px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.06);font-size:20px;cursor:pointer}
  #afMMenu .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px}
  #afMMenu .t{all:unset;box-sizing:border-box;min-height:78px;border-radius:10px;padding:10px 6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;background:linear-gradient(180deg,rgba(224,122,58,.12),rgba(255,255,255,.03));border:1px solid rgba(224,122,58,.25);cursor:pointer}
  #afMMenu .t:active{background:rgba(224,122,58,.35)}
  #afMMenu .t svg{width:26px;height:26px;fill:none;stroke:#ffcf9a;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  #afMMenu .t span{font-weight:600;font-size:12px;line-height:1.2}
  #afMMenu .sub{margin:14px 0 8px;font:700 11px system-ui;letter-spacing:.12em;color:#ffb066;text-transform:uppercase}
  /* turn the phone hint */
  #afMTurn{position:fixed;left:50%;bottom:calc(290px + var(--sb));transform:translateX(-50%);z-index:60;padding:9px 14px;border-radius:10px;background:rgba(14,11,10,.9);border:1px solid rgba(224,122,58,.4);color:#ffd9a8;font:600 13px system-ui;display:none;pointer-events:auto}
  @media (orientation:portrait){
    #afMTurn.show{display:block}
    #afMTop{top:calc(76px + var(--st));left:auto;right:calc(6px + var(--sr));transform:none;flex-direction:column}
    html.af-m #hud .right{top:calc(6px + var(--st))}
    html.af-m #afXTime{display:none!important}
    html.af-m #afQT{top:calc(70px + var(--st))!important}
    html.af-m #afNavTag{top:calc(170px + var(--st))!important}
    #afMAct{left:auto;right:calc(12px + var(--sr));bottom:calc(270px + var(--sb));flex-direction:column}
    html.af-m #afArm .win{grid-template-columns:1fr!important;grid-template-rows:auto auto 1fr!important}
    html.af-m #afArm .col.l{max-height:40vh;grid-column:1!important;grid-row:2!important;overflow:auto!important}
    html.af-m #afArm .col.m,html.af-m #afArm #afArmM{grid-column:1!important;grid-row:3!important;min-height:0}
  }
  @media (max-height:360px){
    html.af-m #hud .skills{transform:scale(.88)!important;transform-origin:100% 100%}
    html.af-m #joy{width:118px!important;height:118px!important}
    #afMAct{left:calc(150px + var(--sl))}
  }`;
  document.head.appendChild(css);

  /* ---------- top bar ---------- */
  const top = document.createElement('nav'); top.id = 'afMTop'; top.setAttribute('aria-label', 'Thanh nhanh'); top.hidden = true;
  const TOP = [['i', 'Túi đồ'], ['n', 'Nhiệm vụ'], ['m', 'Bản đồ'], ['chat', 'Chat'], ['menu', 'Menu']];
  top.innerHTML = TOP.map((t) => '<button type="button" data-m="' + t[0] + '" aria-label="' + t[1] + '">' + svg(ICO[t[0]]) + '<span>' + t[1] + '</span>' + (t[0] === 'chat' ? '<i class="dot"></i>' : '') + '</button>').join('');
  document.body.appendChild(top);
  top.addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]'); if (!b) return; const m = b.dataset.m;
    if (m === 'menu') return showMenu();
    if (m === 'chat') { const on = document.documentElement.classList.toggle('af-chat'); document.documentElement.classList.remove('af-unread'); if (on) { const c = $('chat'); if (c) c.hidden = false; const l = $('chatLog'); if (l) l.scrollTop = l.scrollHeight; } return; }
    open(m);
  });

  /* ---------- talk / mount / jump / block ---------- */
  const act = document.createElement('div'); act.id = 'afMAct'; act.hidden = true;
  const ACT = [['e', 'Nói'], ['x', 'Cưỡi'], ['z', 'Nhảy'], ['f', 'Đỡ']];
  act.innerHTML = ACT.map((a) => '<button type="button" data-k="' + a[0] + '" aria-label="' + a[1] + '">' + svg(ICO[a[0]]) + '<span>' + a[1] + '</span></button>').join('');
  document.body.appendChild(act);
  act.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-k]'); if (!b) return; e.preventDefault();
    b.classList.add('on'); const up = key(b.dataset.k, true);
    const end = () => { b.classList.remove('on'); up(); b.removeEventListener('pointerup', end); b.removeEventListener('pointercancel', end); b.removeEventListener('pointerleave', end); };
    b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end); b.addEventListener('pointerleave', end);
  });

  /* ---------- hold the attack button to keep attacking ---------- */
  let holdT = null;
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest && e.target.closest('#skA'); if (!b) return;
    clearInterval(holdT); holdT = setInterval(() => { if (running()) b.click(); }, 260);
    const stop = () => { clearInterval(holdT); holdT = null; window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); };
    window.addEventListener('pointerup', stop); window.addEventListener('pointercancel', stop);
  }, true);

  /* ---------- launcher ---------- */
  const menu = document.createElement('div'); menu.id = 'afMMenu'; menu.hidden = true; menu.setAttribute('role', 'dialog'); menu.setAttribute('aria-label', 'Menu');
  document.body.appendChild(menu);
  const MAIN = [['c', 'Nhân vật'], ['i', 'Túi đồ'], ['j', 'Trang bị+'], ['g', 'Trang sức'], ['y', 'Kỹ năng'], ['n', 'Nhiệm vụ'], ['m', 'Bản đồ'], ['h', 'Thú cưỡi'], ['p', 'Nghề']];
  const PLAY = [['u', 'Đấu giá'], ['v', 'Đấu trường'], ['t', 'Thử thách'], ['o', 'Phe phái'], ['b', 'PvP'], ['k', 'Xã hội'], ['team', 'Đội & Bang'], ['fr', 'Bạn bè']];
  function iconFor(k) {
    if (ICO[k]) return svg(ICO[k]);
    const s = document.querySelector('#afMenu [data-k="' + k + '"] svg'); if (s) return s.outerHTML;
    if (k === 'team') { const t = [...document.querySelectorAll('#afMenu button')].find((b) => /Đội|Bang/.test(b.getAttribute('aria-label') || b.textContent)); const sv = t && t.querySelector('svg'); if (sv) return sv.outerHTML; }
    return svg('<circle cx="12" cy="12" r="7"/>');
  }
  function tile(k, label) { return '<button class="t" type="button" data-o="' + k + '">' + iconFor(k) + '<span>' + label + '</span></button>'; }
  function showMenu() {
    const me = H() && H().NET && H().NET.me, staff = me && (me.role === 'admin' || me.role === 'gm');
    menu.innerHTML = '<div class="hd"><h2>Menu</h2><button class="x" type="button" data-o="close" aria-label="Đóng">✕</button></div>' +
      '<div class="sub">Nhân vật</div><div class="grid">' + MAIN.map((t) => tile(t[0], t[1])).join('') + '</div>' +
      '<div class="sub">Thế giới</div><div class="grid">' + PLAY.map((t) => tile(t[0], t[1])).join('') + '</div>' +
      '<div class="sub">Khác</div><div class="grid">' + tile('full', document.fullscreenElement ? 'Thoát toàn màn hình' : 'Toàn màn hình') + (staff ? tile('adm', 'Quản trị') : '') + tile('pc', 'Giao diện máy tính') + tile('out', 'Đăng xuất') + '</div>';
    menu.hidden = false;
  }
  function hideMenu() { menu.hidden = true; }
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-o]'); if (!b) return; const o = b.dataset.o;
    if (o === 'close') return hideMenu();
    hideMenu();
    if (o === 'full') { try { if (document.fullscreenElement) document.exitFullscreen(); else (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen).call(document.documentElement); } catch (err) { /* iOS Safari has no fullscreen for pages */ } return; }
    if (o === 'adm') { window.open('/admin.html', '_blank', 'noopener'); return; }
    if (o === 'pc') { try { localStorage.setItem('af-mobile', '0'); } catch (err) { /* ignore */ } location.reload(); return; }
    if (o === 'out') { const lo = $('logoutBtn'); if (lo) lo.click(); return; }
    if (o === 'fr') { const f = $('frBtn'); if (f) f.click(); return; }
    if (o === 'team') { const t = [...document.querySelectorAll('#afMenu button')].find((x) => /Đội|Bang/.test(x.getAttribute('aria-label') || x.textContent)); if (t) t.click(); return; }
    open(o);
  });

  /* open one panel (closing the others first, the same way the desktop does) */
  function open(k) {
    if (!running()) return;
    document.documentElement.classList.remove('af-chat');
    key(k);
  }

  /* ---------- armoury: show the detail sheet when a piece is picked ---------- */
  function armSync() {
    const a = $('afArm'); if (!a || a.hidden) return;
    const r = a.querySelector('.col.r'); if (!r) return;
    if (!r.querySelector('.mclose')) { const c = document.createElement('button'); c.type = 'button'; c.className = 'mclose'; c.textContent = '✕ Đóng chi tiết'; c.style.cssText = 'all:unset;box-sizing:border-box;display:none;align-items:center;justify-content:center;width:100%;min-height:40px;margin-bottom:8px;border-radius:6px;background:rgba(255,255,255,.07);font:600 13px system-ui;color:#e3d6bd;cursor:pointer'; c.addEventListener('click', (e) => { e.stopPropagation(); const A = window.AF_ARMORY; if (A) { A.sel = null; if (A.tab === 'forge') A.tab = 'bag'; A.render && A.render(); } a.classList.remove('hasR'); }); r.prepend(c); }
    const A = window.AF_ARMORY, has = !!(A && (A.tab === 'forge' || (A.sel && !A.multi)));
    a.classList.toggle('hasR', has);
  }

  /* ---------- show the mobile HUD only while playing ---------- */
  let turnShown = false;
  const turn = document.createElement('div'); turn.id = 'afMTurn'; turn.textContent = 'Xoay ngang điện thoại để chơi dễ hơn'; document.body.appendChild(turn);
  turn.addEventListener('click', () => { turn.classList.remove('show'); });
  let lastChat = 0;
  setInterval(() => {
    const on = running(); top.hidden = !on; act.hidden = !on;
    if (on && !turnShown && innerHeight > innerWidth) { turnShown = true; turn.classList.add('show'); setTimeout(() => turn.classList.remove('show'), 6000); }
    const l = $('chatLog'); if (l) { const n = l.childElementCount; if (n > lastChat && lastChat && !document.documentElement.classList.contains('af-chat')) document.documentElement.classList.add('af-unread'); lastChat = n; }
    const qt = $('afQT'); if (qt && !qt.dataset.mTap) { qt.dataset.mTap = '1'; qt.addEventListener('click', (e) => { if (e.target.closest('a,button,[data-q],[data-id]')) return; qt.classList.toggle('afQTsmall'); }); }
    armSync();
  }, 300);
  document.addEventListener('click', () => setTimeout(armSync, 30), true);

  window.AF_MOBILE = { open, closeAll, key, showMenu };
})();
