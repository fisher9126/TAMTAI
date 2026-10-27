#!/usr/bin/env node
/* Aetherfall (TAMTAI) combat upgrade, step 1: the server becomes the authority for player HP/MP, damage, death,
   potions, blocking, status effects and 1v1 duels.
   Patches server/game.js, server/world.js and public/index.html (a .combat.bak copy of each is made first).
   Usage (from the repo root):  node apply-combat.js [path-to-repo]
   Needs server/combat.js and public/js/combat.js to be copied into the repo first.
   Every edit looks for one exact line; if a line is missing or appears more than once, nothing is written for that file.
   Independent of apply-upgrade.js and apply-controls.js: run it before or after them. Safe to run twice. */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(process.argv[2] || process.cwd());
const MARK = 'AF-COMBAT';
let failed = false;

for (const need of ['server/combat.js', 'public/js/combat.js']) {
  if (!fs.existsSync(path.join(root, need))) { console.error('[loi]  thieu ' + need + ' (hay chep file nay vao repo truoc)'); process.exit(1); }
}

function patch(rel, edits, after) {
  const fp = path.join(root, rel);
  if (!fs.existsSync(fp)) { console.error('[loi]  khong thay ' + rel + ' (chay lenh trong thu muc goc cua repo)'); failed = true; return; }
  let s = fs.readFileSync(fp, 'utf8');
  if (s.includes(MARK)) { console.log('[bo qua] ' + rel + ' da duoc nang cap truoc do'); return; }
  for (const e of edits) {
    const n = s.split(e.find).length - 1;
    if (n !== 1) { console.error('[loi]  ' + rel + ': tim thay ' + n + ' cho dong "' + e.find.trim().slice(0, 80) + '" (can dung 1). Khong ghi gi ca.'); failed = true; return; }
    s = s.replace(e.find, () => e.repl);
  }
  if (after) s = after(s);
  if (s === null) { failed = true; return; }
  fs.copyFileSync(fp, fp + '.combat.bak');
  fs.writeFileSync(fp, s);
  console.log('[ok]   ' + rel + ' (' + edits.length + ' cho sua, ban cu: ' + rel + '.combat.bak)');
}

/* ---- server/world.js ---- */
patch('server/world.js', [
  { find: "function hitPlayer(e, p, raw, extra) { ctx.send(",
    repl: "/* AF-COMBAT */ function hitPlayer(e, p, raw, extra) { if (ctx.hurt) return ctx.hurt(p, raw, extra, e); ctx.send(" },
  { find: "if (e.dead) { if (now >= e.respawnAt) reset(e); return; }",
    repl: "if (e.dead) { if (now >= e.respawnAt) reset(e); return; }\n  if (e.stunUntil > now) { e.st = 0; return; }" },
  { find: "module.exports = { init(c) { ctx = c; }, snapshot,",
    repl: "module.exports = { init(c) { ctx = c; }, setHurt(f) { ctx.hurt = f; }, snapshot," }
]);

/* ---- server/game.js ---- */
patch('server/game.js', [
  { find: "const world = require('./world');",
    repl: "const world = require('./world');\nconst combat = require('./combat'); // AF-COMBAT" },
  { find: "case 'hit': return world.playerHit(p, String(m.kind), m.combo, m.ids, rules.playerStats(p.data));",
    repl: "case 'hit': return combat.onHit(p, m, (ids) => world.playerHit(p, String(m.kind), m.combo, ids, rules.playerStats(p.data)));" },
  { find: "case 'ping': return send(p, { t: 'pong', at: m.at, online: online.size });",
    repl: "case 'ping': return send(p, { t: 'pong', at: m.at, online: online.size });\n    case 'act': case 'duel': return combat.handle(p, m);" },
  { find: "ws.on('message', (m) => onMessage(p, m));",
    repl: "combat.onConnect(p);\n  ws.on('message', (m) => onMessage(p, m));" },
  { find: "online.delete(p.id);",
    repl: "online.delete(p.id);\n  combat.onLeave(p);" },
  { find: "if (d > max && !respawn) { send(p, { t: 'correct', x: p.x, z: p.z }); return; }",
    repl: "if (combat.isDead(p) && !respawn) { send(p, { t: 'correct', x: p.x, z: p.z }); return; }\n  if (d > max && !respawn) { send(p, { t: 'correct', x: p.x, z: p.z }); return; }" },
  { find: "p.dead = p.anim === 5;",
    repl: "if (respawn) combat.respawn(p);\n  p.dead = combat.isDead(p);" },
  { find: "if (d.potions <= 0 || (p.potCd || 0) > t + 150) return send(p, { t: 'potion', ok: false });",
    repl: "if (d.potions <= 0 || (p.potCd || 0) > t + 150 || combat.potionBlocked(p)) return send(p, { t: 'potion', ok: false });" },
  { find: "p.potCd = t + rules.POTION_CD * 1000; d.potions--; send(p, { t: 'potion', ok: true }); pushMe(p);",
    repl: "p.potCd = t + rules.POTION_CD * 1000; d.potions--; send(p, { t: 'potion', ok: true }); pushMe(p); combat.heal(p, Math.round(rules.playerStats(d).maxHp * 0.4));" },
  { find: "world.init({ online, send, broadcast, onKill });",
    repl: "world.init({ online, send, broadcast, onKill });\ncombat.init({ online, send, sys });\nworld.setHurt(combat.hurt);" }
]);

/* ---- public/index.html ---- */
const CH = "/* AF-COMBAT */ window.AF_CH={ R:R, get time(){return time;}, popNum:(x,y,z,t,c)=>popNum(x,y,z,t,c), heightAt:(x,z)=>heightAt(x,z), toast:(h,b)=>toast(h,b), chatLine:(k,h)=>chatLine(k,h), get others(){return others;}, get NET(){return NET;}, cvs:cvs, esc:(s)=>esc(s), die:()=>{ R.alive=false; $('death').hidden=false; closeInv(); }, isRunning:()=>running };\n";
const HIT = "const pids=[]; if(window.AF_COMBAT&&window.AF_COMBAT.duelWith!=null&&(kind==='atk'||kind==='spin')){ const o=others.get(window.AF_COMBAT.duelWith); if(o){ const dx=o.x-R.x, dz=o.z-R.z, d=Math.hypot(dx,dz)||0.001; if(d<=range+0.6&&((dx*fx+dz*fz)/d>cosA||d<1.3)) pids.push(o.id); } }\n  if(ids.length||pids.length) NET.send({t:'hit',kind,combo,ids,pids}); return ids.length+pids.length; }";
patch('public/index.html', [
  { find: "cvs.addEventListener('wheel',e=>{", repl: CH + "cvs.addEventListener('wheel',e=>{" },
  { find: "function onNet(m){", repl: "function onNet(m){\n  try{ if(window.AF_COMBAT&&window.AF_COMBAT.onNet&&window.AF_COMBAT.onNet(m)) return; }catch(err){ console.error('combat',err); }" },
  { find: "if(c==='online'){", repl: "if(window.AF_COMBAT&&window.AF_COMBAT.cmd&&window.AF_COMBAT.cmd(c,parts)) return; if(c==='online'){" },
  { find: "if(ids.length) NET.send({t:'hit',kind,combo,ids}); return ids.length; }", repl: HIT },
  { find: "let speed=5.4*(1+s.spd/100);", repl: "let speed=5.4*(1+s.spd/100)*(window.AF_COMBAT&&time<window.AF_COMBAT.slowUntil?0.6:1);" },
  { find: "const im=Math.hypot(ix,iy); if(im>1){ ix/=im; iy/=im; }", repl: "if(window.AF_COMBAT&&time<window.AF_COMBAT.stunUntil){ ix=0; iy=0; }\n  const im=Math.hypot(ix,iy); if(im>1){ ix/=im; iy/=im; }" },
  { find: "function canAct(){ return running&&R.alive&&!invOpen&&!dialogOpen&&R.dodgeT<0&&R.dashT<0; }", repl: "function canAct(){ return running&&R.alive&&!invOpen&&!dialogOpen&&R.dodgeT<0&&R.dashT<0&&!(window.AF_COMBAT&&time<window.AF_COMBAT.stunUntil); }" },
  { find: "function doDodge(){ if(!running||!R.alive||", repl: "function doDodge(){ if(window.AF_COMBAT&&time<window.AF_COMBAT.stunUntil)return; if(!running||!R.alive||" },
  { find: "R.st-=25; R.dodgeCd=0.7; R.dodgeT=0; R.invuln=0.4;", repl: "R.st-=25; R.dodgeCd=0.7; R.dodgeT=0; R.invuln=0.4; NET.send({t:'act',k:'dodge'});" }
], (s) => {
  if (s.includes('js/combat.js')) return s;
  const i = s.lastIndexOf('</body>');
  if (i < 0) { console.error('[loi]  public/index.html: khong thay </body>'); return null; }
  return s.slice(0, i) + '<script src="js/combat.js"></script>\n' + s.slice(i);
});

if (failed) { console.error('\nCo loi o tren. File nao bao loi thi van nguyen ban cu. Gui nguyen thong bao cho minh de chinh lai.'); process.exit(1); }
console.log('\nXong. Khoi dong lai server (systemctl restart aetherfall) roi tai lai trang (Ctrl/Cmd+Shift+R).');
