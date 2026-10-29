/* Aetherfall skill bar (browser): painted icons for every attack, skill and potion, a cleaner bar layout and slot order.
   Icons are painted once on a canvas (gradients, glow, highlights) and cached as images: window.AF_ICONS.skill(id, size).
   Pure display: the buttons keep their ids and click handlers from index.html and classes.js. */
(function () {
  'use strict';
  const H = window.AF_CH, RU = window.AF_RULES;
  if (!H || !RU) return;
  const PI = Math.PI, TAU = PI * 2;
  const cache = {};
  const PAL = {
    atk: ['#5a2a10', '#e07a3a'], stab: ['#2a1640', '#a06aff'], bolt: ['#0c2050', '#4a9aff'], arrow: ['#10301a', '#5ac87a'], smite: ['#4a3a0a', '#ffd25a'],
    spin: ['#4a1e0a', '#ff9a4a'], dash: ['#0e2a4a', '#62aaf0'], quake: ['#3a2410', '#c8904a'], bulwark: ['#10284a', '#8fc0ff'],
    fireball: ['#4a0e04', '#ff6a1a'], frost: ['#0a2a44', '#8fd8ff'], thunder: ['#1e1450', '#b8a8ff'], meteor: ['#3a0c04', '#ff7a2a'],
    pierce: ['#0e3a20', '#7dffa0'], volley: ['#12301c', '#7ddc8f'], stunshot: ['#3a3208', '#ffe27a'], barrage: ['#0e3a1a', '#9cff9c'],
    backstab: ['#3a0a1e', '#ff4a6a'], vanish: ['#1a1428', '#8a7ab0'], flurry: ['#24103e', '#c07cff'], execute: ['#400608', '#ff2a3a'],
    heal: ['#0a3a1e', '#6dff9a'], holy: ['#3e3210', '#ffe9a0'], bless: ['#3e2e08', '#ffd76a'], revive: ['#2e2e3a', '#ffffff'],
    dodge: ['#0e3020', '#79d08a'], hp: ['#3a0806', '#e0533f'], mp: ['#061a3e', '#4a8aff']
  };
  function paint(id, S) {
    const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), k = S / 64, p = PAL[id] || ['#222', '#888'];
    /* background: deep radial with a bright core and a dark rim */
    let r = g.createRadialGradient(S * 0.5, S * 0.42, S * 0.05, S * 0.5, S * 0.5, S * 0.72); r.addColorStop(0, p[1]); r.addColorStop(0.45, p[0]); r.addColorStop(1, '#050403');
    g.fillStyle = r; g.fillRect(0, 0, S, S);
    g.globalAlpha = 0.18; for (let i = 0; i < 40; i++) { g.fillStyle = i % 2 ? '#fff' : '#000'; g.fillRect(Math.random() * S, Math.random() * S, k * 1.2, k * 1.2); } g.globalAlpha = 1;
    g.save(); g.scale(k, k); g.lineJoin = 'round'; g.lineCap = 'round';
    const glow = (col, b) => { g.shadowColor = col; g.shadowBlur = (b || 10) * k; };
    const noGlow = () => { g.shadowBlur = 0; };
    const lin = (x0, y0, x1, y1, stops) => { const l = g.createLinearGradient(x0, y0, x1, y1); stops.forEach((s, i) => l.addColorStop(i / (stops.length - 1), s)); return l; };
    const rad = (x, y, r0, r1, stops) => { const l = g.createRadialGradient(x, y, r0, x, y, r1); stops.forEach((s, i) => l.addColorStop(i / (stops.length - 1), s)); return l; };
    const poly = (pts, fill, stroke, w) => { g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = w || 1.5; g.stroke(); } };
    const circ = (x, y, rr, fill) => { g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fillStyle = fill; g.fill(); };
    const steel = (x0, y0, x1, y1) => lin(x0, y0, x1, y1, ['#ffffff', '#c8d0dc', '#6a7484', '#e8eef6']);
    function sword(cx, cy, ang, len, wide, col) {
      g.save(); g.translate(cx, cy); g.rotate(ang);
      poly([[0, -len], [wide, -len + 7], [wide * 0.8, 6], [-wide * 0.8, 6], [-wide, -len + 7]], col || steel(-wide, 0, wide, 0), '#1a1a22', 1.2);
      g.fillStyle = '#ffffff99'; g.fillRect(-0.6, -len + 6, 1.2, len - 4);
      poly([[-wide * 2.4, 6], [wide * 2.4, 6], [wide * 2.4, 9.5], [-wide * 2.4, 9.5]], lin(0, 6, 0, 10, ['#ffd27a', '#a0601a']), '#2a1806', 1);
      g.fillStyle = '#4a2a14'; g.fillRect(-1.6, 9.5, 3.2, 9); circ(0, 20, 2.6, '#ffd27a');
      g.restore();
    }
    function arrowShape(x0, y0, x1, y1, col, w) {
      const a = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0); g.save(); g.translate(x0, y0); g.rotate(a);
      g.strokeStyle = '#d8c09a'; g.lineWidth = w || 2.4; g.beginPath(); g.moveTo(0, 0); g.lineTo(L - 6, 0); g.stroke();
      poly([[L, 0], [L - 9, -4.5], [L - 7, 0], [L - 9, 4.5]], col || steel(L - 9, -4, L, 4), '#1a1a22', 1);
      poly([[0, 0], [5, -4], [9, -4], [5, 0], [9, 4], [5, 4]], '#e8e0d0', null); g.restore();
    }
    function bottle(fill1, fill2) {
      g.fillStyle = '#7a5030'; g.fillRect(27, 8, 10, 7); g.fillStyle = '#a07040'; g.fillRect(27, 8, 10, 2);
      g.beginPath(); g.moveTo(28, 15); g.lineTo(36, 15); g.lineTo(36, 22); g.bezierCurveTo(50, 27, 52, 54, 32, 56); g.bezierCurveTo(12, 54, 14, 27, 28, 22); g.closePath();
      g.fillStyle = 'rgba(220,235,255,.25)'; g.fill(); g.strokeStyle = 'rgba(240,248,255,.85)'; g.lineWidth = 1.6; g.stroke();
      g.save(); g.clip(); g.fillStyle = lin(0, 30, 0, 56, [fill1, fill2]); g.fillRect(10, 31, 44, 30);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(32, 31, 16, 2.5, 0, 0, TAU); g.fill(); g.restore();
      g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(24, 36, 2.2, 7, 0.3, 0, TAU); g.fill();
      glow(fill1, 14); circ(40, 44, 1.6, '#fff'); circ(29, 49, 1.1, '#fff'); noGlow();
    }
    switch (id) {
      case 'atk': glow('#ffb066', 8); sword(32, 36, 0.78, 30, 4); break;
      case 'stab': glow('#c09aff', 8); sword(26, 36, 0.55, 22, 3); sword(38, 36, -0.55, 22, 3); break;
      case 'bolt': glow('#6ab0ff', 18); circ(32, 32, 14, rad(28, 28, 2, 16, ['#ffffff', '#9ad0ff', '#2a6aff'])); noGlow(); g.strokeStyle = '#cfe8ff'; g.lineWidth = 1.5; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(32, 32, 19 + i * 2, i, i + 1.6); g.stroke(); } break;
      case 'arrow': glow('#8dffaa', 8); arrowShape(12, 52, 54, 10); break;
      case 'smite': glow('#ffe27a', 20); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; poly([[32 + Math.cos(a) * 9, 32 + Math.sin(a) * 9], [32 + Math.cos(a + 0.12) * 26, 32 + Math.sin(a + 0.12) * 26], [32 + Math.cos(a - 0.12) * 26, 32 + Math.sin(a - 0.12) * 26]], '#ffe9a0'); } circ(32, 32, 10, rad(30, 30, 1, 11, ['#ffffff', '#ffd25a'])); break;
      case 'spin': glow('#ffb066', 14); for (let i = 0; i < 3; i++) { g.save(); g.translate(32, 32); g.rotate(i * TAU / 3); g.beginPath(); g.arc(0, 0, 22, -0.2, 1.6); g.arc(0, 0, 13, 1.4, -0.1, true); g.closePath(); g.fillStyle = lin(-20, 0, 20, 0, ['#fff1d0', '#ff9a4a']); g.fill(); g.restore(); } circ(32, 32, 5, '#fff'); break;
      case 'dash': glow('#9ad0ff', 10); for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(200,230,255,' + (0.35 + i * 0.15) + ')'; g.fillRect(8 + i * 3, 20 + i * 7, 20 - i * 2, 3); } poly([[30, 16], [54, 32], [30, 48], [34, 32]], lin(30, 16, 54, 48, ['#ffffff', '#62aaf0']), '#0a1a30', 1.2); break;
      case 'quake': glow('#ffb066', 10); poly([[6, 46], [58, 46], [58, 58], [6, 58]], lin(0, 46, 0, 58, ['#8a6a44', '#3a2a18'])); noGlow(); g.strokeStyle = '#ffcf7a'; g.lineWidth = 2.2; glow('#ff9a3a', 12); [[32, 46, 20, 58], [32, 46, 44, 58], [32, 46, 8, 52], [32, 46, 56, 51]].forEach((l) => { g.beginPath(); g.moveTo(l[0], l[1]); g.lineTo((l[0] + l[2]) / 2 + 3, (l[1] + l[3]) / 2); g.lineTo(l[2], l[3]); g.stroke(); });
        noGlow(); [[18, 26, 6], [44, 22, 5], [30, 14, 4], [50, 36, 3.5], [12, 38, 3]].forEach((q) => poly([[q[0] - q[2], q[1]], [q[0], q[1] - q[2]], [q[0] + q[2], q[1] + 1], [q[0] + 1, q[1] + q[2]]], lin(q[0], q[1] - q[2], q[0], q[1] + q[2], ['#c8a878', '#5a4028']), '#2a1a0a', 1)); break;
      case 'bulwark': glow('#8fc0ff', 14); poly([[32, 8], [52, 15], [50, 34], [32, 56], [14, 34], [12, 15]], lin(12, 8, 52, 56, ['#e8f2ff', '#7aa0d8', '#2a4a80']), '#0a1430', 2); noGlow(); poly([[32, 14], [46, 19], [45, 33], [32, 49], [19, 33], [18, 19]], null, '#ffffffaa', 1.4); circ(32, 30, 5, rad(31, 29, 0, 6, ['#fff', '#8fc0ff'])); break;
      case 'fireball': glow('#ff7a2a', 20); g.beginPath(); g.moveTo(52, 10); g.quadraticCurveTo(40, 22, 40, 26); g.quadraticCurveTo(26, 14, 22, 18); g.quadraticCurveTo(30, 26, 22, 30); g.lineTo(34, 44); g.closePath(); g.fillStyle = lin(52, 10, 30, 40, ['#ff3a0a00', '#ff6a1a', '#ffd06a']); g.fill(); circ(28, 38, 13, rad(25, 35, 1, 14, ['#ffffff', '#ffe06a', '#ff6a1a', '#a0200a'])); break;
      case 'frost': glow('#bfe8ff', 14); for (let i = 0; i < 6; i++) { g.save(); g.translate(32, 32); g.rotate(i * PI / 3); poly([[0, -26], [4, -10], [0, -4], [-4, -10]], lin(0, -26, 0, 0, ['#ffffff', '#8fd8ff']), '#2a6aa0', 1); g.strokeStyle = '#e8f8ff'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, -17); g.lineTo(5, -21); g.moveTo(0, -17); g.lineTo(-5, -21); g.stroke(); g.restore(); } circ(32, 32, 4, '#fff'); break;
      case 'thunder': glow('#d8ccff', 18); poly([[36, 6], [18, 34], [30, 34], [24, 58], [46, 26], [34, 26], [42, 6]], lin(20, 6, 46, 58, ['#ffffff', '#fff6a0', '#b8a8ff']), '#2a1e60', 1.5); break;
      case 'meteor': glow('#ff7a2a', 16); g.beginPath(); g.moveTo(58, 4); g.lineTo(30, 30); g.lineTo(40, 36); g.closePath(); g.fillStyle = lin(58, 4, 34, 32, ['#ff6a1a00', '#ffb04a']); g.fill(); g.beginPath(); g.moveTo(48, 2); g.lineTo(24, 26); g.lineTo(32, 32); g.closePath(); g.fill();
        poly([[22, 30], [34, 28], [42, 38], [38, 52], [22, 54], [14, 42]], rad(26, 38, 2, 22, ['#ffd06a', '#c04a1a', '#3a1a10']), '#1a0a04', 1.5); break;
      case 'pierce': glow('#7dffa0', 14); g.strokeStyle = 'rgba(125,255,160,.55)'; g.lineWidth = 7; g.beginPath(); g.moveTo(6, 58); g.lineTo(58, 6); g.stroke(); arrowShape(8, 56, 58, 6, null, 2.6); break;
      case 'volley': glow('#8dffaa', 8); [[14, 6, 18, 40], [30, 4, 32, 44], [46, 6, 44, 40]].forEach((a) => arrowShape(a[0], a[1], a[2], a[3])); noGlow(); g.fillStyle = 'rgba(125,220,143,.35)'; g.beginPath(); g.ellipse(32, 52, 24, 6, 0, 0, TAU); g.fill(); break;
      case 'stunshot': glow('#ffe27a', 10); arrowShape(10, 50, 48, 18); for (let i = 0; i < 3; i++) { const a = i * 2.1, x = 44 + Math.cos(a) * 11, y = 16 + Math.sin(a) * 6; poly(Array.from({ length: 10 }, (_, j) => { const rr = j % 2 ? 2 : 5; return [x + Math.cos(j * PI / 5 - PI / 2) * rr, y + Math.sin(j * PI / 5 - PI / 2) * rr]; }), '#ffe27a'); } break;
      case 'barrage': glow('#9cff9c', 8); for (let i = -2; i <= 2; i++) { const a = -PI / 4 + i * 0.22; arrowShape(32 - Math.cos(a) * 22, 32 - Math.sin(a) * 22 + 10, 32 + Math.cos(a) * 24, 32 + Math.sin(a) * 24 + 4, null, 1.8); } break;
      case 'backstab': glow('#ff4a6a', 10); sword(30, 34, -0.7, 26, 3.2); noGlow(); for (let i = 0; i < 3; i++) { glow('#ff2a3a', 8); g.beginPath(); g.ellipse(44 + i * 4, 40 + i * 6, 2.2, 3.4, 0, 0, TAU); g.fillStyle = '#d0102a'; g.fill(); } break;
      case 'vanish': for (let i = 0; i < 7; i++) { const x = 18 + Math.random() * 28, y = 18 + Math.random() * 28, rr = 8 + Math.random() * 8; circ(x, y, rr, rad(x, y, 1, rr, ['rgba(200,190,230,.55)', 'rgba(80,70,110,0)'])); } glow('#c0a8ff', 12); poly([[18, 30], [32, 24], [46, 30], [42, 36], [32, 33], [22, 36]], '#1a1428', '#c0a8ff', 1.5); circ(26, 30, 2.2, '#e8d8ff'); circ(38, 30, 2.2, '#e8d8ff'); break;
      case 'flurry': glow('#c07cff', 10); for (let i = 0; i < 8; i++) { g.save(); g.translate(32, 32); g.rotate(i * PI / 4); poly([[0, -26], [3, -14], [0, -11], [-3, -14]], steel(-3, -26, 3, -11), '#1a1028', 1); g.restore(); } circ(32, 32, 6, rad(32, 32, 0, 7, ['#fff', '#c07cff'])); break;
      case 'execute': glow('#ff2a3a', 16); g.fillStyle = '#4a2a14'; g.save(); g.translate(32, 32); g.rotate(0.6); g.fillRect(-2, -8, 4, 34); g.beginPath(); g.moveTo(2, -8); g.quadraticCurveTo(22, -4, 20, 14); g.quadraticCurveTo(10, 4, 2, 6); g.closePath(); g.fillStyle = lin(2, -8, 20, 14, ['#ffffff', '#c8ccd8', '#ff3a4a']); g.fill(); g.restore(); noGlow(); g.strokeStyle = '#ff3a4a'; g.lineWidth = 3; g.beginPath(); g.moveTo(8, 56); g.quadraticCurveTo(30, 40, 56, 8); g.stroke(); break;
      case 'heal': glow('#6dff9a', 18); poly([[26, 10], [38, 10], [38, 26], [54, 26], [54, 38], [38, 38], [38, 54], [26, 54], [26, 38], [10, 38], [10, 26], [26, 26]], lin(10, 10, 54, 54, ['#ffffff', '#6dff9a', '#1a9a4a']), '#0a3a1a', 1.5); break;
      case 'holy': glow('#ffe9a0', 18); poly([[24, 0], [40, 0], [44, 64], [20, 64]], lin(0, 0, 0, 64, ['rgba(255,250,220,.95)', 'rgba(255,220,120,.15)'])); poly([[29, 14], [35, 14], [35, 22], [43, 22], [43, 28], [35, 28], [35, 44], [29, 44], [29, 28], [21, 28], [21, 22], [29, 22]], '#fff8e0', '#a07a10', 1); break;
      case 'bless': glow('#ffd76a', 16); g.strokeStyle = '#ffe9a0'; g.lineWidth = 3; g.beginPath(); g.ellipse(32, 14, 12, 4, 0, 0, TAU); g.stroke(); [-1, 1].forEach((s) => { g.beginPath(); g.moveTo(32, 30); g.bezierCurveTo(32 + s * 10, 18, 32 + s * 26, 18, 32 + s * 28, 30); g.bezierCurveTo(32 + s * 22, 34, 32 + s * 24, 42, 32 + s * 16, 44); g.bezierCurveTo(32 + s * 14, 50, 32 + s * 6, 48, 32, 40); g.closePath(); g.fillStyle = lin(32, 20, 32 + s * 28, 44, ['#fffbe8', '#ffd76a']); g.fill(); }); break;
      case 'revive': glow('#ffffff', 20); g.beginPath(); g.moveTo(32, 58); g.bezierCurveTo(10, 40, 18, 18, 32, 6); g.bezierCurveTo(46, 18, 54, 40, 32, 58); g.fillStyle = lin(32, 6, 32, 58, ['#ffffff', '#ffe9a0', '#ff9a4a']); g.fill(); g.strokeStyle = '#a0601a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(32, 58); g.lineTo(32, 12); for (let i = 0; i < 6; i++) { g.moveTo(32, 20 + i * 6); g.lineTo(24 + i, 14 + i * 6); g.moveTo(32, 20 + i * 6); g.lineTo(40 - i, 14 + i * 6); } g.stroke(); break;
      case 'dodge': glow('#9affb0', 12); for (let i = 0; i < 3; i++) { g.strokeStyle = 'rgba(200,255,215,' + (0.9 - i * 0.25) + ')'; g.lineWidth = 4 - i; g.beginPath(); g.arc(30, 40 - i * 2, 18 - i * 4, PI * 1.05, PI * 1.85); g.stroke(); } poly([[44, 18], [56, 24], [46, 32]], '#d8ffe0'); break;
      case 'hp': bottle('#ff6a5a', '#8a0a0a'); break;
      case 'mp': bottle('#7ab0ff', '#0a2a8a'); break;
      default: glow('#fff', 10); circ(32, 32, 12, p[1]);
    }
    g.restore(); noGlow();
    /* bevel: light top edge, dark bottom edge */
    g.strokeStyle = 'rgba(255,240,220,.35)'; g.lineWidth = 2 * k; g.strokeRect(k, k, S - 2 * k, S - 2 * k);
    return c.toDataURL();
  }
  function skill(id, size) { const key = id + ':' + (size || 96); if (!cache[key]) cache[key] = paint(id, size || 96); return cache[key]; }
  window.AF_ICONS = Object.assign(window.AF_ICONS || {}, { skill, paint });

  /* ---------- the bar ---------- */
  const css = document.createElement('style');
  css.textContent = `
  #hud .skills{gap:6px!important;padding:8px 10px!important;align-items:center!important;background:linear-gradient(180deg,rgba(28,20,16,.92),rgba(10,8,7,.94))!important;border:1px solid rgba(224,122,58,.4)!important;border-radius:10px!important;box-shadow:0 0 0 1px #000,0 12px 30px rgba(0,0,0,.6)!important}
  #hud .sk{width:56px!important;height:56px!important;border-radius:9px!important;border:1px solid rgba(255,200,140,.28)!important;background-size:cover!important;background-position:center!important;box-shadow:inset 0 0 0 1px rgba(0,0,0,.7),0 3px 8px rgba(0,0,0,.5)!important;transition:transform .08s,filter .15s}
  #hud .sk:hover{transform:translateY(-2px);filter:brightness(1.15)}
  #hud .sk:active{transform:translateY(1px)}
  #hud .sk.main{width:66px!important;height:66px!important;border:2px solid #e07a3a!important;box-shadow:0 0 18px rgba(224,122,58,.45),inset 0 0 0 1px rgba(0,0,0,.7)!important}
  #hud .sk.afPainted>svg{display:none}
  #hud .sk.afPainted{background-image:var(--ic)!important;background-size:cover!important;background-position:center!important}
  #hud .sk .key{left:auto!important;right:3px!important;top:3px!important;padding:1px 4px;border-radius:4px;background:rgba(0,0,0,.72);color:#ffe0b0!important;font:800 10px system-ui,sans-serif!important;z-index:2}
  #hud .sk .cnt{right:4px!important;bottom:3px!important;padding:0 4px;border-radius:4px;background:rgba(0,0,0,.72);color:#fff!important;font:800 12px system-ui,sans-serif!important;z-index:2}
  #hud .sk .nm{display:none!important}
  #hud .sk .cd{background:rgba(5,4,3,.72)!important;z-index:1}
  #hud .sk .cdt{z-index:2;font-size:18px!important;color:#fff}
  #hud .sk.dim{filter:grayscale(.85) brightness(.6)}
  #hud .sk .afMana{position:absolute;left:3px;bottom:2px;font:800 9.5px system-ui;color:#9ac8ff;text-shadow:0 1px 2px #000;z-index:2}
  #hud .skills .afSep{width:1px;align-self:stretch;margin:4px 3px;background:linear-gradient(180deg,transparent,rgba(224,122,58,.5),transparent)}`;
  document.head.appendChild(css);
  const BASIC = { warrior: 'atk', mage: 'bolt', archer: 'arrow', assassin: 'stab', healer: 'smite' };
  let lastKey = '';
  function sync() {
    const bar = document.querySelector('#hud .skills'); if (!bar) return;
    const C = window.AF_CLASS, cls = (C && C.prof && C.prof.cls) || 'warrior', list = (RU.CLASSES[cls] || RU.CLASSES.warrior).skills;
    const ids = { skA: BASIC[cls] || 'atk', sk1: list[0] && list[0].id, sk2: list[1] && list[1].id, sk3: list[2] && list[2].id, sk4: list[3] && list[3].id, skD: 'dodge', skP: 'hp', skM: 'mp' };
    /* order: basic, 1, 2, 3, 4 | dodge | potions */
    const order = ['skA', 'sk1', 'sk2', 'sk3', 'sk4', '|', 'skD', '|', 'skP', 'skM'];
    let sepN = 0;
    order.forEach((k) => {
      if (k === '|') { let s = bar.querySelectorAll('.afSep')[sepN]; if (!s) { s = document.createElement('i'); s.className = 'afSep'; } sepN++; bar.appendChild(s); return; }
      const b = document.getElementById(k); if (b) bar.appendChild(b);
    });
    const key = cls + JSON.stringify(ids);
    Object.keys(ids).forEach((k) => {
      const b = document.getElementById(k); if (!b || !ids[k]) return;
      if (b.dataset.icon !== ids[k]) { b.dataset.icon = ids[k]; b.style.setProperty('--ic', 'url(' + skill(ids[k]) + ')'); b.classList.add('afPainted'); }
      if (k === 'skA') { const kk = b.querySelector('.key'); if (kk && kk.textContent !== 'Chuột') kk.textContent = 'Chuột'; }
      const a = RU.ATTACKS[ids[k]], sp = RU.SKILLS[ids[k]], mp = sp && sp.support ? sp.support.mp : a && a.mp;
      let m = b.querySelector('.afMana'); if (mp && k !== 'skA') { if (!m) { m = document.createElement('span'); m.className = 'afMana'; b.appendChild(m); } m.textContent = mp; } else if (m) m.remove();
      if (sp && !b.title) b.title = sp.name + (sp.desc ? ' · ' + sp.desc : '');
    });
    lastKey = key;
  }
  setInterval(() => { if (H.isRunning()) sync(); }, 700);
})();
