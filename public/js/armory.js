/* Aetherfall armory (browser): one inventory screen (keys I / B) for every kind of equipment.
   Shows all worn pieces (main gear, gloves / pants / off-hand, rings / necklace / charm) around the character, every piece in all three bags
   in one grid with filters, a detail card with stat comparison and actions, and a catalogue of weapon kinds and armour styles per class.
   The server still decides everything: this file only draws and sends the same requests the older panels send. */
(function () {
  'use strict';
  const H = window.AF_CH, X = window.AF_CHX, IT = window.AF_ITEMS, RU = window.AF_RULES;
  if (!H || !X || !IT || !RU) { console.warn('[armory] thiếu AF_CH/AF_ITEMS, bỏ qua'); return; }
  const E = window.AF_EQUIPDATA, G = window.AF_GEARDATA;
  const esc = H.esc, net = (m) => H.NET.send(m), zone = (m) => H.NET.send(Object.assign({ t: 'zone' }, m));
  const num = (n) => Number(n || 0).toLocaleString('vi-VN');
  const RCOL = { common: '#b9b2a6', rare: '#5aa2ff', epic: '#b77cff', legend: '#ff9f3a' };
  const STAT = { atk: 'Sức đánh', def: 'Giáp', hp: 'Máu', mp: 'Mana', crit: 'Chí mạng', spd: 'Tốc độ' };
  const PCT = { crit: 1, spd: 1 };
  const fmtv = (k, v) => (v > 0 ? '+' : '') + (Math.round(v * 10) / 10) + (PCT[k] ? '%' : '');
  const A = { open: false, tab: 'bag', filter: 'all', sort: 'best', mine: false, sel: null, arm: null, cat: null, multi: false, pick: new Set() };
  window.AF_ARMORY = A;

  /* ---------- icons ---------- */
  const IC = {
    sword: 'M20 4L9 15M20 4h-4M20 4v4M7 13l4 4M8.5 15.5L4 20', greatsword: 'M21 3L8.5 15.5M21 3h-5M21 3v5M5.5 12.5l6 6M8 16l-5 5M18 6l-9 9',
    axe: 'M5 20L16 9M13.5 5.5c3-2.5 6.5-.5 6 4-3.5 1.5-6 .5-6-4z', greataxe: 'M4 21L16 9M12 4c4-3 9 0 8 6-4 2-8 0-8-6zM15 4.5L9.5 2',
    staff: 'M5 21L16 10M16 10a3 3 0 1 0 4-4 3 3 0 0 0-4 4M19 3l1-1', wand: 'M5 19L15 9M18 2v4M20 4h-4M20 9l-1-1M13 3l1 1',
    orb: 'M12 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12M8 21h8M10 16l-1 5M14 16l1 5M10 8a2.5 2.5 0 0 1 2.5-1.5', runeblade: 'M19 5L8 16M19 5h-4M19 5v4M6 14l4 4M7.5 16.5L4 20M3 4l2 2M5 4L3 6',
    bow: 'M7 3c8 4 8 14 0 18M7 3v18M3 12h15M15 9l3 3-3 3', longbow: 'M8 1.5c10 5 10 16 0 21M8 1.5v21M3 12h16M16 9l3 3-3 3',
    crossbow: 'M3 11h18M12 5v14M5 7c4 3 10 3 14 0M18 8l3 3-3 3', heavycrossbow: 'M2 11h20M12 3v18M4 6c5 4 11 4 16 0M19 8l3 3-3 3M9 15h6',
    daggers: 'M4 20l7-7M11 13l2-6 3 3-6 2M20 20l-7-7M13 13l-2-6-3 3 6 2', shortsword: 'M18 6L8 16M18 6h-3M18 6v3M6 14l4 4M7.5 16.5L4 20',
    throwing: 'M12 2l3 7-3 3-3-3zM12 12v9M8 18h8', twinaxe: 'M4 21l7-7M7 8c2-3 6-2 6 2-3 1-5 0-6-2M20 21l-7-7M17 8c-2-3-6-2-6 2 3 1 5 0 6-2',
    scepter: 'M12 22V9M12 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6M8 13h8', holystaff: 'M12 22V7M8 4h8M12 1v7M9 22h6', mace: 'M6 21l7-7M16 3a4 4 0 1 1-2.5 7.5A4 4 0 0 1 16 3M18 1v2M22 6h-2',
    lantern: 'M9 4h6M8 6h8l-1 12H9zM12 1v3M10 11h4M9 21h6',
    helmet: 'M4 14a8 8 0 0 1 16 0v5H4zM12 6v8M8 14v5M16 14v5', armor: 'M8 3l4 2 4-2 4 3-2 4v11H6V10L4 6z', boots: 'M7 3h6v9l6 3v5H7zM7 16h12',
    cape: 'M8 3h8l3 18-7-3-7 3zM10 3v4M14 3v4', gloves: 'M8 21v-8l-3-4 2-1 3 3V4h2v7h1V3h2v8h1V5h2v10l-2 6z', pants: 'M7 3h10l1 18h-4l-2-11-2 11H6zM7 7h10',
    shield: 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6zM12 7v10', tome: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM8 4v13M11 9h5',
    ring: 'M12 9a6 6 0 1 1 0 12 6 6 0 0 1 0-12M9 3h6l-3 5z', neck: 'M5 3c0 8 14 8 14 0M12 11v3M12 14a3 3 0 1 1 0 6 3 3 0 0 1 0-6', charm: 'M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z',
    lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z', x: 'M6 6l12 12M18 6L6 18'
  };
  const pic = (o) => { const I = window.AF_ICONS; let u = null; try { u = I && I.forItem ? I.forItem(o.src, o.it) : null; } catch (e) { u = null; } return u; };
  const picOr = (o, c) => { const u = o && pic(o); return u ? '<img class="pic" src="' + u + '" alt="">' : svg(o ? o.icon : 'sword', c); };
  const svg = (k, c) => '<svg viewBox="0 0 24 24" aria-hidden="true" style="stroke:' + (c || 'currentColor') + '"><path d="' + (IC[k] || IC.charm) + '"/></svg>';

  /* ---------- styles ---------- */
  const css = document.createElement('style');
  css.textContent = `
  #afArm{position:fixed;inset:0;z-index:62;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 40%,rgba(10,8,7,.55),rgba(4,3,3,.86));font:13px/1.45 Inter,system-ui,sans-serif;color:#e3d6bd}
  #afArm[hidden]{display:none}
  #afArm .win{width:min(1240px,97vw);height:min(820px,94vh);display:grid;grid-template-columns:330px 1fr 330px;grid-template-rows:auto 1fr;background:rgba(14,11,10,.97);border:1px solid rgba(224,122,58,.32);border-radius:8px;box-shadow:0 0 0 1px #000,0 30px 80px rgba(0,0,0,.75);overflow:hidden}
  #afArm header{grid-column:1/-1;display:flex;align-items:center;gap:14px;padding:10px 14px;border-bottom:1px solid rgba(224,122,58,.18);background:linear-gradient(180deg,rgba(224,122,58,.08),transparent)}
  #afArm header h2{margin:0;font:800 19px 'Cinzel','Times New Roman',serif;letter-spacing:.06em;color:#ffb066}
  #afArm header .gold{margin-left:auto;font-weight:700;color:#f0bf4c;font-variant-numeric:tabular-nums}
  #afArm header .hint{font-size:11.5px;color:#9a8f80}
  #afArm .x{all:unset;cursor:pointer;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:4px;color:#cdbfa6}
  #afArm .x:hover{background:rgba(224,122,58,.18);color:#fff}
  #afArm svg{width:22px;height:22px;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  #afArm .col{overflow:auto;padding:12px;min-height:0}
  #afArm .col.l{border-right:1px solid rgba(255,255,255,.06);background:rgba(0,0,0,.18)}
  #afArm .col.r{border-left:1px solid rgba(255,255,255,.06);background:rgba(0,0,0,.18)}
  #afArm h4{margin:12px 0 6px;font:700 11px system-ui,sans-serif;letter-spacing:.12em;color:#ffb066;text-transform:uppercase}
  #afArm h4:first-child{margin-top:0}
  #afArm .doll{display:grid;grid-template-columns:62px 1fr 62px;gap:7px}
  #afArm .doll2{display:flex;justify-content:center;gap:7px;margin-top:7px}#afArm .doll2 .slot{width:62px}
  #afArm .hero{grid-column:2;grid-row:1/6;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border-radius:6px;background:radial-gradient(circle at 50% 35%,rgba(224,122,58,.22),rgba(0,0,0,0) 70%);padding:6px}
  #afArm .hero .em{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1px solid rgba(224,122,58,.5);box-shadow:0 0 22px rgba(224,122,58,.3)}
  #afArm .hero .em svg{width:34px;height:34px}
  #afArm .hero b{font:800 13px 'Cinzel',serif;margin-top:6px;color:#fff1dc}
  #afArm .hero small{color:#9a8f80}
  #afArm .slot,#afArm .cell{all:unset;box-sizing:border-box;position:relative;cursor:pointer;aspect-ratio:1;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;
    background:linear-gradient(160deg,rgba(255,255,255,.07),rgba(0,0,0,.25));border:1px solid rgba(255,255,255,.1);transition:transform .08s,border-color .12s}
  #afArm .slot:hover,#afArm .cell:hover{transform:translateY(-1px);border-color:rgba(255,190,120,.6)}
  #afArm .slot.sel,#afArm .cell.sel{outline:2px solid #ffb066;outline-offset:1px}
  #afArm .slot small{font-size:9.5px;color:#9a8f80;line-height:1}
  #afArm .slot.empty svg{opacity:.35}
  #afArm .cell .en,#afArm .slot .en{position:absolute;right:3px;top:2px;font:800 10px system-ui;color:#ffe0a0;text-shadow:0 1px 2px #000}
  #afArm .cell .lv{position:absolute;left:4px;bottom:2px;font:700 9.5px system-ui;color:#cdbfa6;opacity:.85}
  #afArm .cell .up{position:absolute;right:3px;bottom:1px;font:900 11px system-ui;color:#7ddc8f;text-shadow:0 1px 2px #000}
  #afArm .cell .no{position:absolute;inset:0;border-radius:6px;background:repeating-linear-gradient(135deg,rgba(168,50,42,.28) 0 6px,rgba(0,0,0,0) 6px 12px)}
  #afArm .cell .lk{position:absolute;left:3px;top:2px;opacity:.8}
  #afArm .cell .lk svg{width:11px;height:11px}
  #afArm .stats{display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;margin-top:4px}
  #afArm .stats div{display:flex;justify-content:space-between;padding:4px 7px;border-radius:4px;background:rgba(255,255,255,.04)}
  #afArm .stats span:last-child{font-weight:700;color:#fff1dc;font-variant-numeric:tabular-nums}
  #afArm .bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:10px}
  #afArm .chip.qsb{background:rgba(224,122,58,.14);border-color:rgba(224,122,58,.5);color:#ffcf9a}
  #afArm .chip.qsb.on{background:#e07a3a;color:#1a0f08}
  #afArm .qs{display:flex;flex-direction:column;gap:8px;margin:-2px 0 10px;padding:10px;border-radius:6px;background:rgba(224,122,58,.07);border:1px solid rgba(224,122,58,.28)}
  #afArm .qs .row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
  #afArm .qs .lbl{font-size:12px;color:#cdbfa6;margin-right:2px}
  #afArm .qs .sum{font-size:12.5px;color:#e3d6bd;margin-right:auto}
  #afArm .qs .warnx{font-size:12px;color:#ffb08a}
  #afArm .qs .go{all:unset;cursor:pointer;padding:7px 14px;border-radius:4px;background:#c8433a;color:#fff;font-weight:700;font-size:12.5px}
  #afArm .qs .go.arm{background:#ff6a3a;box-shadow:0 0 0 2px #ffd0a0}
  #afArm .qs .go[disabled]{opacity:.45;cursor:default}
  #afArm .cell.pk{outline:2px solid #ff7a4a;outline-offset:1px}
  #afArm .cell .tick{position:absolute;right:3px;top:3px;width:15px;height:15px;border-radius:3px;border:1.5px solid rgba(255,255,255,.55);background:rgba(0,0,0,.45);font:900 11px/13px system-ui;color:#fff;text-align:center}
  #afArm .cell.pk .tick{background:#ff6a3a;border-color:#ffd0a0}
  #afArm.multi .cell.lockd{opacity:.4;cursor:not-allowed}
  #afArm .chip{all:unset;cursor:pointer;padding:5px 10px;border-radius:4px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);font-weight:600;font-size:12px}
  #afArm .chip:hover{border-color:rgba(255,190,120,.45)}
  #afArm .chip.on{background:linear-gradient(180deg,#c4642c,#7d3418);color:#fff1dc;border-color:#2a1206}
  #afArm .tabs{display:flex;gap:4px;margin-bottom:10px}
  #afArm .tabs .chip{font:700 13px 'Cinzel',serif;letter-spacing:.03em;padding:7px 14px}
  #afArm select{background:#0e0b0a;color:#e3d6bd;border:1px solid rgba(255,255,255,.14);border-radius:4px;padding:4px 6px;font:12px system-ui}
  #afArm label.ck{display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer}
  #afArm .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(62px,1fr));gap:7px}
  #afArm .cnt{font-size:11.5px;color:#9a8f80;margin:-4px 0 8px}
  #afArm .empty-note{color:#9a8f80;padding:20px 6px;text-align:center}
  #afArm .det h3{margin:0;font:800 17px 'Cinzel',serif;letter-spacing:.02em}
  #afArm .det .sub{font-size:12px;color:#9a8f80;margin:2px 0 8px}
  #afArm .det .perk{padding:8px 10px;border-left:2px solid #e07a3a;background:rgba(224,122,58,.08);border-radius:0 4px 4px 0;margin:8px 0;font-size:12.5px}
  #afArm .det table{width:100%;border-collapse:collapse;margin:6px 0}
  #afArm .det td{padding:4px 2px;border-bottom:1px solid rgba(255,255,255,.05)}
  #afArm .det td:nth-child(2){text-align:right;font-weight:700;color:#fff1dc}
  #afArm .det td:nth-child(3){text-align:right;width:70px;font-size:12px}
  #afArm .upc{color:#7ddc8f}#afArm .dnc{color:#ff8f80}
  #afArm .warn{color:#ff8f80;font-size:12px;margin:6px 0}
  #afArm .acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
  #afArm .btn{all:unset;box-sizing:border-box;cursor:pointer;padding:7px 12px;border-radius:4px;font:700 12.5px system-ui;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}
  #afArm .btn:hover{border-color:rgba(255,190,120,.6)}
  #afArm .btn.p{background:linear-gradient(180deg,#c4642c,#7d3418);color:#fff1dc;border-color:#2a1206}
  #afArm .btn.d{color:#ffb0a6}
  #afArm .btn[disabled]{opacity:.4;pointer-events:none}
  #afArm .btn.arm{background:#a8322a;color:#fff}
  #afArm .lines{font-size:12px;margin:4px 0}
  #afArm .lines div{padding:2px 0}
  #afArm .pic{width:86%;height:86%;object-fit:contain;filter:drop-shadow(0 3px 4px rgba(0,0,0,.6));pointer-events:none}
  #afArm .slot .pic{width:70%;height:70%}
  #afArm .hero{padding:0!important;min-height:330px}
  #afArm .pv{width:100%;flex:1;min-height:260px}
  #afArm .pv .em{margin:90px auto 0}
  #afArm .bigpic{position:relative;height:150px;margin:-4px 0 10px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 45%,color-mix(in srgb,var(--rc) 35%,transparent),rgba(0,0,0,0) 65%),rgba(0,0,0,.25);border:1px solid color-mix(in srgb,var(--rc) 40%,transparent)}
  #afArm .bigpic img{height:140px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.7))}
  #afArm .bigpic span{position:absolute;right:10px;top:8px;font:900 22px 'Cinzel',serif;color:#ffe0a0;text-shadow:0 2px 6px #000}
  #afArm .forge{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
  #afArm .fcard{all:unset;box-sizing:border-box;cursor:pointer;display:flex;gap:8px;align-items:center;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}
  #afArm .fcard:hover{border-color:rgba(255,190,120,.5)}#afArm .fcard.sel{outline:2px solid #ffb066}
  #afArm .fcard img,#afArm .fcard svg{width:44px;height:44px;object-fit:contain;flex:none}
  #afArm .fcard b{display:block;font-size:12px;line-height:1.25}#afArm .fcard small{color:#ffe0a0;font-weight:800}
  #afArm .fstage{position:relative;height:190px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 60%,rgba(255,140,60,.35),rgba(0,0,0,0) 60%),linear-gradient(180deg,#1a120c,#0a0705);border:1px solid rgba(224,122,58,.35);overflow:hidden}
  #afArm .fstage img{height:150px;filter:drop-shadow(0 8px 12px rgba(0,0,0,.8));transition:transform .2s}
  #afArm .fstage .lv{position:absolute;left:12px;top:10px;font:900 26px 'Cinzel',serif;color:#ffe0a0;text-shadow:0 2px 8px #000}
  #afArm .fstage .res{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:900 30px 'Cinzel',serif;letter-spacing:.08em;opacity:0;pointer-events:none}
  #afArm .fstage.ok .res{animation:afFok 1.4s ease-out;color:#ffe08a;text-shadow:0 0 20px #ff9a2a,0 2px 6px #000}
  #afArm .fstage.ok{animation:afFglow 1.2s ease-out}
  #afArm .fstage.bad .res{animation:afFok 1.4s ease-out;color:#ff6a5a;text-shadow:0 0 18px #a01010,0 2px 6px #000}
  #afArm .fstage.bad img{animation:afFshake .45s}
  #afArm .fstage.hit img{animation:afFhit .35s}
  @keyframes afFok{0%{opacity:0;transform:scale(.6)}20%{opacity:1;transform:scale(1.15)}70%{opacity:1;transform:scale(1)}100%{opacity:0}}
  @keyframes afFglow{0%{box-shadow:inset 0 0 0 rgba(255,200,90,0)}30%{box-shadow:inset 0 0 80px rgba(255,200,90,.9)}100%{box-shadow:inset 0 0 0 rgba(255,200,90,0)}}
  @keyframes afFshake{0%,100%{transform:translateX(0)}20%{transform:translateX(-10px) rotate(-4deg)}40%{transform:translateX(9px) rotate(3deg)}60%{transform:translateX(-6px)}80%{transform:translateX(4px)}}
  @keyframes afFhit{0%{transform:scale(1)}40%{transform:scale(.9) rotate(-6deg)}100%{transform:scale(1)}}
  #afArm .chance{position:relative;height:18px;border-radius:9px;background:rgba(0,0,0,.5);overflow:hidden;margin:8px 0}
  #afArm .chance i{display:block;height:100%;background:linear-gradient(90deg,#a8322a,#e0a040,#7ddc8f)}
  #afArm .chance span{position:absolute;inset:0;text-align:center;font:800 11px/18px system-ui}
  #afArm .btn.big{width:100%;padding:12px;font-size:15px;text-align:center;margin-top:6px}
  #afArm .cat{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px}
  #afArm .card{padding:10px;border-radius:6px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)}
  #afArm .card .t{display:flex;align-items:center;gap:8px;font-weight:700;color:#fff1dc}
  #afArm .card .t svg{width:26px;height:26px;stroke:#ffb066}
  #afArm .card p{margin:5px 0 4px;font-size:12px;color:#cdbfa6}
  #afArm .card .s{font-size:11.5px;color:#9a8f80}
  #afArm .vt{width:100%;border-collapse:collapse;font-size:12px}
  #afArm .vt td,#afArm .vt th{padding:5px 6px;border-bottom:1px solid rgba(255,255,255,.06);text-align:left}
  @media (max-width:980px){#afArm .win{grid-template-columns:1fr;grid-template-rows:auto auto auto auto;height:96vh;overflow:auto}#afArm .col{overflow:visible}#afArm .col.l,#afArm .col.r{border:0}}`;
  document.head.appendChild(css);

  const root = document.createElement('div'); root.id = 'afArm'; root.hidden = true;
  root.innerHTML = '<div class="win" role="dialog" aria-label="Kho đồ"><header><h2>Kho đồ</h2><span class="hint">Bấm một món để xem, bấm đúp để mặc · Esc để đóng</span><span class="gold" id="afArmGold"></span>' +
    '<button class="x" type="button" data-a="close" aria-label="Đóng kho đồ">' + svg('x') + '</button></header>' +
    '<div class="col l" id="afArmL"></div><div class="col m" id="afArmM"></div><div class="col r det" id="afArmR"></div></div>';
  document.body.appendChild(root);
  const $L = root.querySelector('#afArmL'), $M = root.querySelector('#afArmM'), $R = root.querySelector('#afArmR'), $gold = root.querySelector('#afArmGold');
  ['pointerdown', 'mousedown', 'wheel', 'contextmenu'].forEach((ev) => root.addEventListener(ev, (e) => e.stopPropagation()));
  root.addEventListener('keydown', (e) => { const t = e.target; if (t && (t.tagName === 'SELECT' || t.tagName === 'INPUT')) e.stopPropagation(); });

  /* ---------- data: every piece from the three systems, in one shape ---------- */
  const P = () => X.P || { inv: [], eq: {}, level: 1, gold: 0 };
  const myCls = () => (window.AF_CLASS && window.AF_CLASS.prof && window.AF_CLASS.prof.cls) || (P().prof && P().prof.cls) || null;
  const extSt = () => (window.AF_EQUIP && window.AF_EQUIP.st) || { bag: [], eq: {}, cap: { bag: E ? E.BAG : 40 } };
  const accSt = () => (window.AF_GEAR && window.AF_GEAR.st) || { bag: [], eq: {}, max: G ? G.BAG : 30 };
  const EQSLOTS = [
    ['helmet', 'main', 'Mũ', 'helmet'], ['armor', 'main', 'Giáp', 'armor'], ['gloves', 'ext', 'Găng', 'gloves'], ['pants', 'ext', 'Quần', 'pants'], ['boots', 'main', 'Giày', 'boots'],
    ['cape', 'main', 'Áo choàng', 'cape'], ['neck', 'acc', 'Dây chuyền', 'neck'], ['ring1', 'acc', 'Nhẫn 1', 'ring'], ['ring2', 'acc', 'Nhẫn 2', 'ring'], ['charm', 'acc', 'Bùa', 'charm'],
    ['weapon', 'main', 'Vũ khí', 'sword'], ['offhand', 'ext', 'Tay trái', 'shield']
  ];
  function iconOf(src, it) {
    if (src === 'main') return it.slot === 'weapon' ? (IT.typeOk(it.slot, it.type) ? it.type : 'sword') : it.slot;
    if (src === 'ext') return it.slot === 'offhand' ? (it.sub === 'tome' ? 'tome' : 'shield') : it.slot;
    return it.kind;
  }
  function wrap(src, it, worn, slotKey) {
    if (!it) return null;
    const o = { src, it, worn: !!worn, id: it.id, slotKey, rarity: it.rarity, ilvl: it.ilvl | 0, enh: it.enh | 0, lock: !!it.lock, icon: iconOf(src, it) };
    if (src === 'main') {
      o.name = it.name; o.stats = IT.restat ? IT.restat(it) : (it.stats || {}); o.kind = IT.typeName(it.slot, it.type); o.slotName = IT.SLOTNAME[it.slot];
      o.cls = IT.itemClass(it); o.desc = IT.describe(it); o.group = it.slot === 'weapon' ? 'weapon' : 'armor'; o.eqSlot = it.slot; o.value = IT.itemValue(it);
    } else if (src === 'ext') {
      o.name = E.nameOf(it); o.stats = E.stats(it); o.kind = it.slot === 'offhand' ? E.SUBNAME[it.sub] : E.SLOTNAME[it.slot]; o.slotName = E.SLOTNAME[it.slot];
      o.cls = null; o.group = it.slot === 'offhand' ? 'weapon' : 'armor'; o.eqSlot = it.slot; o.value = E.worth(it); o.dur = it.cur;
      o.lines = (it.aff || []).map((a) => STAT[a.k] + ' ' + fmtv(a.k, a.v)).concat((it.sock || []).map((g) => (g ? '◆ ' + E.gemName(g) + ' ' + E.gemText(g) : '◇ ô ngọc trống')));
    } else {
      o.name = it.name; o.stats = G.stats(it); o.kind = G.KINDS[it.kind]; o.slotName = G.KINDS[it.kind]; o.cls = null; o.group = 'acc';
      o.eqSlot = it.kind === 'ring' ? 'ring' : it.kind; o.value = G.worth(it); o.set = it.set ? G.SETS[it.set].name : null;
      o.lines = (it.aff || []).map((a) => (a.big ? '★ ' : '') + STAT[a.k] + ' ' + fmtv(a.k, a.v));
    }
    o.usable = !o.cls || !myCls() || o.cls === myCls();
    return o;
  }
  function worn() {
    const out = {}, p = P(), ex = extSt(), ac = accSt();
    IT.SLOTS.forEach((s) => { out[s] = wrap('main', p.eq && p.eq[s], true, s); });
    ['gloves', 'pants', 'offhand'].forEach((s) => { out[s] = E ? wrap('ext', ex.eq && ex.eq[s], true, s) : null; });
    ['ring1', 'ring2', 'neck', 'charm'].forEach((s) => { out[s] = G ? wrap('acc', ac.eq && ac.eq[s], true, s) : null; });
    return out;
  }
  function bagItems() {
    const list = [], p = P();
    (p.inv || []).forEach((it) => list.push(wrap('main', it, false)));
    if (E) (extSt().bag || []).forEach((it) => list.push(wrap('ext', it, false)));
    if (G) (accSt().bag || []).forEach((it) => list.push(wrap('acc', it, false)));
    return list.filter(Boolean);
  }
  const W = { atk: 2, def: 1.6, hp: 0.22, mp: 0.12, crit: 3, spd: 1.6 };
  const score = (st) => Object.keys(st || {}).reduce((a, k) => a + (W[k] || 0) * st[k], 0);
  /* the worn piece a bag piece would replace (rings: the weaker ring) */
  function rival(o, wn) {
    if (o.eqSlot === 'ring') { const a = wn.ring1, b = wn.ring2; if (!a || !b) return null; return score(a.stats) <= score(b.stats) ? a : b; }
    return wn[o.eqSlot] || null;
  }
  function find(key) {
    if (!key) return null;
    const wn = worn();
    for (const k in wn) if (wn[k] && wn[k].src + ':' + wn[k].id === key) return wn[k];
    return bagItems().find((o) => o.src + ':' + o.id === key) || null;
  }

  /* ---------- left column: character ---------- */
  function renderLeft() {
    const wn = worn(), p = P(), cls = myCls();
    const slotBtn = (s) => {
      const o = wn[s[0]], c = o ? RCOL[o.rarity] : '#7a7066', key = o ? o.src + ':' + o.id : '';
      return '<button class="slot' + (o ? '' : ' empty') + (A.sel && A.sel === key ? ' sel' : '') + '" type="button" data-a="sel" data-k="' + key + '" style="' + (o ? 'border-color:' + c + ';box-shadow:inset 0 0 18px ' + c + '33' : '') + '" title="' + esc(o ? o.name : s[2] + ': trống') + '">' +
        (o ? picOr(o, c) : svg(s[3], c)) + (o && o.enh ? '<span class="en">+' + o.enh + '</span>' : '') + '<small>' + s[2] + '</small></button>';
    };
    const L = EQSLOTS.slice(0, 5), Rr = EQSLOTS.slice(5, 10);
    let h = '<h4>Đang mặc</h4><div class="doll">';
    for (let i = 0; i < 5; i++) { h += slotBtn(L[i]); if (i === 0) h += '<div class="hero"><div class="pv" id="afArmPv" title="Kéo để xoay · bấm đúp để xem đòn đánh"></div><b>' + esc(cls ? IT.CLSNAME[cls] : 'Chưa chọn class') + '</b><small>Cấp ' + (p.level || 1) + '</small></div>'; h += slotBtn(Rr[i]); }
    h += '</div><div class="doll2">' + slotBtn(EQSLOTS[10]) + slotBtn(EQSLOTS[11]) + '</div>';
    let st = null; try { st = RU.playerStats(p); } catch (e) { st = null; }
    if (st) {
      h += '<h4>Chỉ số</h4><div class="stats">' + [['Máu', st.maxHp], ['Mana', st.maxMp], ['Sức đánh', st.atk], ['Giáp', st.def], ['Chí mạng', st.crit + '%'], ['Tốc độ', (100 + st.spd) + '%']].map((r) => '<div><span>' + r[0] + '</span><span>' + r[1] + '</span></div>').join('') + '</div>';
      h += '<div class="cnt" style="margin-top:8px">Chỉ số từ trang bị phụ, trang sức và cây kỹ năng được máy chủ cộng thêm khi chiến đấu.</div>';
    }
    $L.innerHTML = h;
    /* the dressed hero, rebuilt only when what you wear changes */
    const I = window.AF_ICONS, Dk = window.AF_DARK, pv = $L.querySelector('#afArmPv');
    if (I && I.preview && pv && Dk && Dk.api && Dk.ready) {
      const eq = p.eq || {}, w = eq.weapon, wt = w && w.type && IT.canUse(w, cls) ? w.type : null;
      const pr = window.AF_CLASS && window.AF_CLASS.prof, ext = extSt().eq || {}, look = pr ? Dk.api.lookOf(pr.race, pr.gender, pr.app) : {}, gear = Dk.api.gearOf(eq, ext);
      const key = JSON.stringify([cls, wt, w && w.rarity, gear, look]);
      I.preview(pv, key, () => Dk.api.hero(cls || 'warrior', eq, wt, w ? w.rarity : 'common', look, gear));
    } else if (pv) pv.innerHTML = '<div class="em">' + svg(wn.weapon ? wn.weapon.icon : 'sword', '#ffb066') + '</div>';
  }

  /* ---------- middle column: bag grid or catalogue ---------- */
  const FILTERS = [['all', 'Tất cả'], ['weapon', 'Vũ khí'], ['armor', 'Giáp'], ['acc', 'Trang sức']];
  function sorted(list, wn) {
    const ri = (r) => IT.RAR.indexOf(r);
    const by = {
      best: (a, b) => (b.usable - a.usable) || (ri(b.rarity) - ri(a.rarity)) || (b.ilvl - a.ilvl),
      lvl: (a, b) => (b.ilvl - a.ilvl) || (ri(b.rarity) - ri(a.rarity)),
      up: (a, b) => (gain(b, wn) - gain(a, wn)),
      type: (a, b) => String(a.eqSlot).localeCompare(String(b.eqSlot)) || (ri(b.rarity) - ri(a.rarity))
    }[A.sort] || (() => 0);
    return list.slice().sort(by);
  }
  function gain(o, wn) { if (!o.usable) return -1e9; const r = rival(o, wn); return score(o.stats) - (r ? score(r.stats) : 0); }
  /* ---------- quick sell: tick pieces or pick a whole rarity, then sell them in one go (locked pieces are skipped) ---------- */
  function quickBar(list) {
    const all = bagItems(), byKey = new Map(all.map((o) => [o.src + ':' + o.id, o]));
    [...A.pick].forEach((k) => { const o = byKey.get(k); if (!o || o.lock) A.pick.delete(k); });
    const picked = [...A.pick].map((k) => byKey.get(k)), gold = picked.reduce((a, o) => a + (o.value || 0), 0);
    const hi = picked.filter((o) => o.rarity === 'epic' || o.rarity === 'legend').length;
    const cnt = (r) => list.filter((o) => o.rarity === r && !o.lock).length;
    let h = '<div class="qs"><div class="row"><span class="lbl">Chọn nhanh theo độ hiếm:</span>' +
      IT.RAR.map((r) => '<button class="chip" type="button" data-a="qsr" data-v="' + r + '" style="color:' + RCOL[r] + ';border-color:' + RCOL[r] + '55"' + (cnt(r) ? '' : ' disabled') + '>' + IT.RNAME[r] + ' (' + cnt(r) + ')</button>').join('') +
      '<button class="chip" type="button" data-a="qsall">Chọn hết</button><button class="chip" type="button" data-a="qsnone">Bỏ chọn</button></div>';
    h += '<div class="row"><span class="sum">Đã chọn <b>' + picked.length + '</b> món · nhận <b style="color:#ffd27a">' + num(gold) + '</b> vàng. Bấm vào ô để tích chọn, món đã khóa không bán được.</span>' +
      '<button class="go' + (A.arm === 'qs' ? ' arm' : '') + '" type="button" data-a="qsgo"' + (picked.length ? '' : ' disabled') + '>' + (A.arm === 'qs' ? 'Bấm lần nữa để bán ' + picked.length + ' món' : 'Bán ' + picked.length + ' món') + '</button></div>';
    if (hi) h += '<div class="warnx">Có ' + hi + ' món Sử thi/Huyền thoại trong danh sách bán. Kiểm tra lại trước khi bấm.</div>';
    return h + '</div>';
  }
  function quickSell() {
    const all = bagItems(), byKey = new Map(all.map((o) => [o.src + ':' + o.id, o])), ids = { main: [], ext: [], acc: [] };
    A.pick.forEach((k) => { const o = byKey.get(k); if (o && !o.lock) ids[o.src].push(o.id); });
    if (ids.main.length) net({ t: 'sellmany', ids: ids.main });
    if (ids.ext.length) { zone({ op: 'esellmany', ids: ids.ext }); setTimeout(() => zone({ op: 'einfo' }), 400); }
    if (ids.acc.length) { zone({ op: 'gsellmany', ids: ids.acc }); setTimeout(() => zone({ op: 'ginfo' }), 400); }
    A.pick.clear(); A.arm = null; A.sel = null; setTimeout(render, 120); setTimeout(render, 600);
  }
  function renderBag() {
    const wn = worn(), p = P(); let list = bagItems();
    if (A.filter !== 'all') list = list.filter((o) => o.group === A.filter);
    if (A.mine) list = list.filter((o) => o.usable);
    list = sorted(list, wn);
    const ex = extSt(), ac = accSt();
    let h = '<div class="bar">' + FILTERS.map((f) => '<button class="chip' + (A.filter === f[0] ? ' on' : '') + '" type="button" data-a="flt" data-v="' + f[0] + '">' + f[1] + '</button>').join('') +
      '<select data-a="sort" aria-label="Sắp xếp"><option value="best"' + (A.sort === 'best' ? ' selected' : '') + '>Độ hiếm</option><option value="up"' + (A.sort === 'up' ? ' selected' : '') + '>Mạnh hơn đồ đang mặc</option><option value="lvl"' + (A.sort === 'lvl' ? ' selected' : '') + '>Cấp đồ</option><option value="type"' + (A.sort === 'type' ? ' selected' : '') + '>Theo ô</option></select>' +
      '<label class="ck"><input type="checkbox" data-a="mine"' + (A.mine ? ' checked' : '') + '> Chỉ đồ class mình</label>' +
      '<button class="chip qsb' + (A.multi ? ' on' : '') + '" type="button" data-a="multi">' + (A.multi ? 'Thoát bán nhanh' : 'Bán nhanh') + '</button></div>';
    if (A.multi) h += quickBar(list);
    h += '<div class="cnt">Túi chính ' + (p.inv || []).length + '/' + RU.INV_SIZE + (E ? ' · Túi phụ ' + (ex.bag || []).length + '/' + ((ex.cap && ex.cap.bag) || E.BAG) : '') + (G ? ' · Trang sức ' + (ac.bag || []).length + '/' + (ac.max || G.BAG) : '') + '</div>';
    if (!list.length) h += '<div class="empty-note">Không có món nào ở mục này. Đánh quái, làm nhiệm vụ hoặc mua ở cửa hàng trong làng.</div>';
    else h += '<div class="grid">' + list.map((o) => {
      const c = RCOL[o.rarity], key = o.src + ':' + o.id, up = o.usable && gain(o, wn) > 0.5;
      const pk = A.multi && A.pick.has(key);
      return '<button class="cell' + (!A.multi && A.sel === key ? ' sel' : '') + (pk ? ' pk' : '') + (A.multi && o.lock ? ' lockd' : '') + '" type="button" data-a="' + (A.multi ? 'pick' : 'sel') + '" data-k="' + key + '" title="' + esc(o.name) + '" style="border-color:' + c + ';background:linear-gradient(160deg,' + c + '22,rgba(0,0,0,.3))">' +
        picOr(o, c) + (o.enh ? '<span class="en">+' + o.enh + '</span>' : '') + '<span class="lv">' + o.ilvl + '</span>' + (up ? '<span class="up">▲</span>' : '') + (o.lock ? '<span class="lk">' + svg('lock', '#cdbfa6') + '</span>' : '') + (o.usable ? '' : '<span class="no"></span>') + (A.multi && !o.lock ? '<span class="tick">' + (pk ? '✓' : '') + '</span>' : '') + '</button>';
    }).join('') + '</div>';
    return h;
  }
  function renderCatalog() {
    const cls = A.cat || myCls() || 'warrior', lv = Math.max(1, P().level || 1);
    let h = '<div class="bar">' + IT.CLS.map((c) => '<button class="chip' + (cls === c ? ' on' : '') + '" type="button" data-a="cat" data-v="' + c + '">' + IT.CLSNAME[c] + '</button>').join('') + '</div>';
    const stTxt = (s) => Object.keys(s).map((k) => STAT[k] + ' ' + fmtv(k, s[k])).join(' · ');
    h += '<h4>Vũ khí của ' + IT.CLSNAME[cls] + '</h4><div class="cat">' + IT.typesFor('weapon', cls).map((t) => {
      const w = IT.WTYPES[t]; return '<div class="card"><div class="t">' + svg(t) + esc(w.name) + '</div><p>' + esc(w.perk) + '</p><div class="s">Mẫu Hiếm cấp ' + lv + ': ' + stTxt(IT.statsFor('weapon', 'rare', lv, 0, t, 0)) + '</div></div>';
    }).join('') + '</div>';
    h += '<h4>Kiểu giáp của ' + IT.CLSNAME[cls] + '</h4><div class="cat">' + IT.typesFor('armor', cls).map((t) => {
      const a = IT.ATYPES[t]; return '<div class="card"><div class="t">' + svg('armor') + esc(a.name) + '</div><p>' + esc(a.perk) + '</p><div class="s">Bộ gồm: ' + ['helmet', 'armor', 'boots', 'cape'].map((s) => esc(IT.ANAME[s][t])).join(', ') + '</div><div class="s">Giáp Hiếm cấp ' + lv + ': ' + stTxt(IT.statsFor('armor', 'rare', lv, 0, t, 0)) + '</div></div>';
    }).join('') + '</div>';
    h += '<h4>Biến thể theo bậc</h4><table class="vt"><tr><th>Bậc</th><th>Biến thể và điểm mạnh</th></tr>' + IT.RAR.map((r) => '<tr><td style="color:' + RCOL[r] + ';font-weight:700">' + IT.RNAME[r] + '</td><td>' + IT.VARIANTS[r].map((v) => '<b>' + esc(v.n) + '</b> <span style="color:#9a8f80">(' + Object.keys(v.b).map((k) => STAT[k]).join(', ') + ')</span>').join(' · ') + '</td></tr>').join('') + '</table>';
    h += '<div class="cnt" style="margin-top:8px">Mỗi món rơi ra có một loại (theo class) và một biến thể của bậc đó. Quái rơi đồ hợp class của bạn nhiều hơn; đồ class khác vẫn bán hoặc trao đổi được. Đồ cũ từ trước bản này dùng được cho mọi class.</div>';
    return h;
  }
  /* ---------- forge (enhancement) ---------- */
  function forgeItems() { const out = [], wn = worn(); Object.keys(wn).forEach((k) => { const o = wn[k]; if (o && o.src !== 'acc') out.push(o); }); bagItems().forEach((o) => { if (o.src !== 'acc') out.push(o); }); return out; }
  function renderForge() {
    const list = forgeItems();
    if (!A.fsel && list.length) A.fsel = list[0].src + ':' + list[0].id;
    return '<div class="cnt">Chọn món để cường hóa (tối đa +' + IT.MAX_ENH + '). Món đang mặc nằm đầu danh sách. Mỗi cấp tăng khoảng 12% chỉ số gốc.</div><div class="forge">' + list.map((o) => {
      const key = o.src + ':' + o.id, u = pic(o);
      return '<button class="fcard' + (A.fsel === key ? ' sel' : '') + '" type="button" data-a="fsel" data-k="' + key + '" style="border-left:3px solid ' + RCOL[o.rarity] + '">' + (u ? '<img src="' + u + '" alt="">' : svg(o.icon, RCOL[o.rarity])) + '<span><b style="color:' + RCOL[o.rarity] + '">' + esc(o.name.replace(/\s*\+\d+$/, '')) + '</b><small>+' + o.enh + '</small>' + (o.worn ? ' <span style="color:#7ddc8f;font-size:10.5px">đang mặc</span>' : '') + '</span></button>';
    }).join('') + '</div>';
  }
  function forgeView() {
    const o = find(A.fsel), p = P();
    if (!o) return '<h4>Lò rèn</h4><div class="empty-note">Chọn một món ở giữa để cường hóa.</div>';
    const main = o.src === 'main', e = o.enh, maxE = main ? IT.MAX_ENH : E.MAX_ENH, max = e >= maxE;
    const cost = main ? IT.enhCost(o.it) : E.enhCost(o.it), ch = main ? IT.enhChance(e) : E.enhChance(e);
    const next = max ? null : main ? IT.statsFor(o.it.slot, o.rarity, o.ilvl, e + 1, o.it.type, o.it.v) : E.stats(Object.assign({}, o.it, { enh: e + 1 }));
    const wards = (window.AF_ZONES && window.AF_ZONES.mats && window.AF_ZONES.mats.ward) | 0, res = A.forgeRes && performance.now() - A.forgeRes.t < 1500 ? A.forgeRes : null;
    const u = pic(o);
    let h = '<h4>Lò rèn</h4><div class="fstage' + (res ? (res.ok ? ' ok' : ' bad') : A.forgeHit ? ' hit' : '') + '">' + (u ? '<img src="' + u + '" alt="">' : '') + '<span class="lv">+' + e + '</span><span class="res">' + (res ? (res.ok ? 'THÀNH CÔNG' : res.warded ? 'BÙA ĐÃ GIỮ CẤP' : res.lost ? 'THẤT BẠI · TỤT CẤP' : 'THẤT BẠI') : '') + '</span></div>';
    h += '<h3 style="color:' + RCOL[o.rarity] + ';margin-top:10px">' + esc(o.name) + '</h3>';
    if (max) return h + '<div class="cnt">Đã đạt cấp tối đa +' + maxE + '.</div>';
    h += '<div class="sub">+' + e + ' → <b style="color:#ffe0a0">+' + (e + 1) + '</b></div><table>' + Object.keys(STAT).filter((k) => (o.stats[k] || next[k])).map((k) => { const a1 = o.stats[k] || 0, b1 = next[k] || 0, d = Math.round((b1 - a1) * 10) / 10; return '<tr><td>' + STAT[k] + '</td><td>' + fmtv(k, a1) + ' → ' + fmtv(k, b1) + '</td><td>' + (d > 0 ? '<span class="upc">▲ ' + fmtv(k, d).replace('+', '') + '</span>' : '') + '</td></tr>'; }).join('') + '</table>';
    h += '<div class="chance"><i style="width:' + Math.round(ch * 100) + '%"></i><span>Tỉ lệ thành công ' + Math.round(ch * 100) + '%</span></div>';
    h += '<div class="cnt">Chi phí <b style="color:#f0bf4c">' + num(cost) + ' vàng</b> · bạn có ' + num(p.gold) + ' vàng</div>';
    if (e >= 5) h += '<div class="warn">Thất bại từ +5 sẽ tụt 1 cấp.' + (e >= 7 ? ' Bùa bảo hộ (đang có ' + wards + ') tự dùng để giữ cấp.' : '') + '</div>';
    h += actBtn('fdo', 'Cường hóa lên +' + (e + 1), 'p big', p.gold < cost);
    return h;
  }
  function renderMid() {
    $M.innerHTML = '<div class="tabs"><button class="chip' + (A.tab === 'bag' ? ' on' : '') + '" type="button" data-a="tab" data-v="bag">Túi đồ</button><button class="chip' + (A.tab === 'forge' ? ' on' : '') + '" type="button" data-a="tab" data-v="forge">Cường hóa</button><button class="chip' + (A.tab === 'cat' ? ' on' : '') + '" type="button" data-a="tab" data-v="cat">Sách trang bị</button></div>' +
      (A.tab === 'cat' ? renderCatalog() : A.tab === 'forge' ? renderForge() : renderBag());
  }

  /* ---------- right column: details and actions ---------- */
  function statTable(o, other) {
    const a = o.stats || {}, b = other ? other.stats || {} : null, keys = Object.keys(STAT).filter((k) => a[k] || (b && b[k]));
    if (!keys.length) return '';
    return '<table>' + keys.map((k) => {
      const v = a[k] || 0; let d = '';
      if (b) { const df = Math.round((v - (b[k] || 0)) * 10) / 10; d = df > 0 ? '<span class="upc">▲ ' + fmtv(k, df).replace('+', '') + '</span>' : df < 0 ? '<span class="dnc">▼ ' + fmtv(k, -df).replace('+', '') + '</span>' : ''; }
      return '<tr><td>' + STAT[k] + '</td><td>' + (v ? fmtv(k, v) : '—') + '</td><td>' + d + '</td></tr>';
    }).join('') + '</table>';
  }
  const actBtn = (a, label, cls, dis, extra) => '<button class="btn' + (cls ? ' ' + cls : '') + '" type="button" data-a="' + a + '"' + (dis ? ' disabled' : '') + (extra || '') + '>' + label + '</button>';
  function renderRight() {
    const o = find(A.sel), p = P();
    $gold.textContent = num(p.gold) + ' vàng';
    if (A.tab === 'forge') { $R.innerHTML = forgeView(); return; }
    if (!o) { $R.innerHTML = '<h4>Chi tiết</h4><div class="empty-note">Chọn một món trong túi hoặc trên người để xem chỉ số, so sánh và các thao tác.<br><br>▲ xanh: mạnh hơn món bạn đang mặc.<br>Sọc đỏ: món của class khác.</div>'; return; }
    const wn = worn(), other = o.worn ? null : rival(o, wn), c = RCOL[o.rarity];
    const big = pic(o);
    let h = (big ? '<div class="bigpic" style="--rc:' + c + '"><img src="' + big + '" alt="">' + (o.enh ? '<span>+' + o.enh + '</span>' : '') + '</div>' : '') + '<h3 style="color:' + c + '">' + esc(o.name) + '</h3><div class="sub">' + IT.RNAME[o.rarity] + ' · ' + esc(o.kind || o.slotName) + ' · cấp đồ ' + o.ilvl + (o.cls ? ' · <span style="color:' + (o.usable ? '#cdbfa6' : '#ff8f80') + '">' + IT.CLSNAME[o.cls] + '</span>' : ' · mọi class') + (o.worn ? ' · <b style="color:#7ddc8f">đang mặc</b>' : '') + '</div>';
    if (o.desc) h += '<div class="perk">' + esc(o.desc) + '</div>';
    h += statTable(o, other);
    if (other) h += '<div class="cnt">So với ' + esc(other.name) + '</div>';
    if (o.lines && o.lines.length) h += '<div class="lines">' + o.lines.map((l) => '<div>' + esc(l) + '</div>').join('') + '</div>';
    if (o.set) h += '<div class="lines" style="color:#7ddc8f">' + esc(o.set) + '</div>';
    if (o.dur != null) h += '<div class="lines" style="color:' + (o.dur <= 0 ? '#ff8f80' : '#9a8f80') + '">Độ bền ' + o.dur + '/' + E.MAX_DUR + (o.dur <= 0 ? ' · hỏng' : '') + '</div>';
    if (!o.usable) h += '<div class="warn">Class của bạn không mặc được món này. Bạn vẫn bán, cất kho hoặc đổi với người chơi khác được.</div>';
    const lvlLock = (o.src !== 'main') && (p.level || 1) < o.ilvl - 6;
    if (lvlLock) h += '<div class="warn">Cần cấp ' + (o.ilvl - 6) + ' để mặc.</div>';
    h += '<div class="acts">';
    if (o.worn) h += actBtn('un', 'Tháo ra', '', false);
    else h += actBtn('eq', o.src === 'acc' ? 'Đeo' : 'Mặc', 'p', !o.usable || lvlLock);
    const confirmKey = (a) => A.arm === a + ':' + o.src + ':' + o.id;
    if (o.src === 'main') {
      const e = o.enh, max = e >= IT.MAX_ENH, cost = IT.enhCost(o.it);
      h += actBtn('enh', max ? 'Cường hóa tối đa' : 'Cường hóa +' + (e + 1) + ' · ' + Math.round(IT.enhChance(e) * 100) + '% · ' + num(cost) + ' vàng', '', max || p.gold < cost);
      if (!o.worn) h += actBtn('sell', confirmKey('sell') ? 'Bấm lần nữa để bán' : 'Bán · ' + num(o.value) + ' vàng', confirmKey('sell') ? 'arm' : 'd', false);
    } else {
      if (o.src === 'ext') { const cost = E.enhCost(o.it), max = o.enh >= E.MAX_ENH; h += actBtn('enh', max ? 'Cường hóa tối đa' : 'Cường hóa +' + (o.enh + 1) + ' · ' + Math.round(E.enhChance(o.enh) * 100) + '% · ' + num(cost) + ' vàng', '', max || p.gold < cost); }
      h += actBtn('lock', o.lock ? 'Mở khóa' : 'Khóa', '', false);
      if (!o.worn) {
        h += actBtn('sell', confirmKey('sell') ? 'Bấm lần nữa để bán' : 'Bán · ' + num(o.value) + ' vàng', confirmKey('sell') ? 'arm' : 'd', o.lock);
        h += actBtn('dis', confirmKey('dis') ? 'Bấm lần nữa để rã' : 'Rã lấy nguyên liệu', confirmKey('dis') ? 'arm' : 'd', o.lock);
      }
    }
    h += '</div>';
    if (o.src === 'ext') h += '<div class="cnt" style="margin-top:10px">Khảm ngọc, tẩy luyện, sửa đồ: bảng Trang bị+ (phím J).</div>';
    if (o.src === 'main' && o.enh >= 5) h += '<div class="cnt" style="margin-top:10px">Từ +5, cường hóa thất bại sẽ tụt 1 cấp (từ +7 có thể dùng Bùa bảo hộ).</div>';
    $R.innerHTML = h;
  }
  function render() { if (!A.open) return; try { renderLeft(); renderMid(); renderRight(); } catch (e) { console.error('[armory]', e); } }
  A.render = render;

  /* ---------- actions ---------- */
  function act(a) {
    const o = find(A.sel); if (!o) return;
    const armKey = a + ':' + o.src + ':' + o.id;
    if ((a === 'sell' || a === 'dis') && A.arm !== armKey) { A.arm = armKey; clearTimeout(A.armT); A.armT = setTimeout(() => { A.arm = null; render(); }, 3000); render(); return; }
    A.arm = null;
    if (o.src === 'main') {
      if (a === 'eq') { net({ t: 'equip', id: o.id }); A.sel = 'main:' + o.id; }
      else if (a === 'un') { if ((P().inv || []).length >= RU.INV_SIZE) { H.toast('Túi đồ đã đầy'); return; } net({ t: 'unequip', slot: o.it.slot }); }
      else if (a === 'sell') { net({ t: 'sell', id: o.id }); A.sel = null; }
      else if (a === 'enh') net({ t: 'enhance', id: o.id });
    } else if (o.src === 'ext') {
      const m = { eq: 'eequip', un: 'eunequip', lock: 'elock', sell: 'esell', dis: 'edis', enh: 'eenh' }[a]; if (!m) return;
      zone(a === 'un' ? { op: m, slot: o.it.slot } : { op: m, id: o.id }); if (a === 'sell' || a === 'dis') A.sel = null;
      setTimeout(() => zone({ op: 'einfo' }), 350);
    } else {
      const m = { eq: 'gequip', un: 'gunequip', lock: 'glock', sell: 'gsell', dis: 'gdis' }[a]; if (!m) return;
      zone(a === 'un' ? { op: m, slot: o.slotKey } : { op: m, id: o.id }); if (a === 'sell' || a === 'dis') A.sel = null;
      setTimeout(() => zone({ op: 'ginfo' }), 350);
    }
    setTimeout(render, 60);
  }
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const a = b.dataset.a;
    if (a === 'close') { const x = document.getElementById('invX'); if (x) x.click(); else A.close(); return; }
    if (a === 'multi') { A.multi = !A.multi; A.pick.clear(); A.arm = null; root.classList.toggle('multi', A.multi); render(); return; }
    if (a === 'pick') { const k = b.dataset.k, o = find(k); if (!o || o.lock) return; if (A.pick.has(k)) A.pick.delete(k); else A.pick.add(k); A.arm = null; render(); return; }
    if (a === 'qsr' || a === 'qsall') {
      let list = bagItems(); if (A.filter !== 'all') list = list.filter((o) => o.group === A.filter); if (A.mine) list = list.filter((o) => o.usable);
      list = list.filter((o) => !o.lock && (a === 'qsall' || o.rarity === b.dataset.v)); const keys = list.map((o) => o.src + ':' + o.id);
      const allOn = keys.length && keys.every((k) => A.pick.has(k)); keys.forEach((k) => (allOn ? A.pick.delete(k) : A.pick.add(k))); A.arm = null; render(); return;
    }
    if (a === 'qsnone') { A.pick.clear(); A.arm = null; render(); return; }
    if (a === 'qsgo') { if (!A.pick.size) return; if (A.arm !== 'qs') { A.arm = 'qs'; clearTimeout(A.armT); A.armT = setTimeout(() => { A.arm = null; render(); }, 5000); render(); return; } quickSell(); return; }
    if (a === 'sel') { if (!b.dataset.k) return; A.sel = A.sel === b.dataset.k ? null : b.dataset.k; A.arm = null; render(); return; }
    if (a === 'flt') { A.filter = b.dataset.v; render(); return; }
    if (a === 'tab') { A.tab = b.dataset.v; render(); return; }
    if (a === 'cat') { A.cat = b.dataset.v; render(); return; }
    if (a === 'mine' || a === 'sort') return;
    if (a === 'fsel') { A.fsel = b.dataset.k; A.forgeRes = null; render(); return; }
    if (a === 'fdo') { const o = find(A.fsel); if (!o) return; if (o.src === 'main') net({ t: 'enhance', id: o.id }); else { zone({ op: 'eenh', id: o.id }); setTimeout(() => zone({ op: 'einfo' }), 350); } A.forgeHit = true; A.forgeRes = null; render(); setTimeout(() => { A.forgeHit = false; }, 400); return; }
    act(a);
  });
  root.addEventListener('change', (e) => {
    const t = e.target; if (!t.dataset) return;
    if (t.dataset.a === 'sort') { A.sort = t.value; render(); }
    if (t.dataset.a === 'mine') { A.mine = t.checked; render(); }
  });
  /* double click a piece: wear it or take it off */
  root.addEventListener('dblclick', (e) => { const b = e.target.closest('[data-a="sel"]'); if (!b || !b.dataset.k) return; A.sel = b.dataset.k; const o = find(A.sel); if (!o) return; if (o.worn) act('un'); else if (o.usable) act('eq'); });

  A.open = false;
  A.isOpen = () => A.open;
  A.show = function () {
    A.open = true; root.hidden = false;
    if (E) zone({ op: 'einfo' }); if (G) zone({ op: 'ginfo' });
    render();
  };
  A.close = function () { A.open = false; root.hidden = true; A.arm = null; A.multi = false; A.pick.clear(); root.classList.remove('multi'); };
  /* index.html calls these through openInv / closeInv */
  A.openPanel = A.show; A.closePanel = A.close;

  /* refresh when the other systems receive their data */
  ['AF_EQUIP', 'AF_GEAR', 'AF_SOCIAL'].forEach((k) => {
    const mod = window[k]; if (!mod || typeof mod.onNet !== 'function') return;
    const f0 = mod.onNet;
    mod.onNet = function (m) {
      const r = f0.apply(this, arguments);
      if (A.open && m && (m.t === 'enh' && k === 'AF_SOCIAL' || m.t === 'eenh' && k === 'AF_EQUIP')) { A.forgeRes = { ok: !!m.ok, lost: !!m.lost, warded: !!m.warded, t: performance.now() }; setTimeout(render, 0); setTimeout(render, 1600); }
      if (k === 'AF_SOCIAL' && m && m.t === 'enh' && A.open && A.tab !== 'forge') H.toast(m.ok ? 'Cường hóa thành công: <b>' + esc(m.name) + '</b>' : 'Cường hóa thất bại' + (m.lost ? ', tụt xuống +' + m.enh : '') + '.', !!m.ok);
      if (A.open && m && /^(einfo|ginfo|enh|eenh|me)$/.test(m.t)) setTimeout(render, 0);
      return r;
    };
  });
})();
