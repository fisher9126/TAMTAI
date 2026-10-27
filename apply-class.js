#!/usr/bin/env node
/* Aetherfall (TAMTAI) characters upgrade, step 2: character creation (race, gender, appearance), 5 classes with their own
   skills on keys 1-4, stat points with reset, advanced class at level 30.
   REQUIRES step 1 (apply-combat.js) to have been applied first.
   Patches server/game.js, server/world.js and public/index.html (a .class.bak copy of each is made first).
   Usage (from the repo root):  node apply-class.js [path-to-repo]
   Copy these files into the repo first: server/character.js, server/combat.js (new version), server/social.js (new version),
   public/js/classes.js, public/js/combat.js (new version), public/js/rules.js (new version), public/js/items.js.
   Every edit looks for one exact line; if a line is missing or appears more than once, nothing is written for that file.
   Safe to run twice. */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(process.argv[2] || process.cwd());
const MARK = 'AF-CLASS';
let failed = false;
const read = (rel) => { const fp = path.join(root, rel); return fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : null; };

for (const need of ['server/character.js', 'public/js/classes.js']) {
  if (!fs.existsSync(path.join(root, need))) { console.error('[loi]  thieu ' + need + ' (hay chep file nay vao repo truoc)'); process.exit(1); }
}
const rules = read('public/js/rules.js');
if (!rules || !rules.includes('CLASSES')) { console.error('[loi]  public/js/rules.js chua phai ban moi (thieu CLASSES). Hay chep de ban moi vao.'); process.exit(1); }
const combatJs = read('server/combat.js');
if (!combatJs || !combatJs.includes('character')) { console.error('[loi]  server/combat.js chua phai ban moi. Hay chep de ban moi vao.'); process.exit(1); }
for (const rel of ['server/game.js', 'server/world.js', 'public/index.html']) {
  const s = read(rel);
  if (!s) { console.error('[loi]  khong thay ' + rel + ' (chay lenh trong thu muc goc cua repo)'); process.exit(1); }
  if (!s.includes('AF-COMBAT')) { console.error('[loi]  ' + rel + ' chua duoc vá bang apply-combat.js. Hay chay: node apply-combat.js truoc.'); process.exit(1); }
}

function patch(rel, edits, after) {
  const fp = path.join(root, rel);
  let s = fs.readFileSync(fp, 'utf8');
  if (s.includes(MARK)) { console.log('[bo qua] ' + rel + ' da duoc nang cap lop truoc do'); return; }
  for (const e of edits) {
    const n = s.split(e.find).length - 1;
    if (n === 0 && e.optional) continue;
    if (n !== 1) { console.error('[loi]  ' + rel + ': tim thay ' + n + ' cho dong "' + e.find.trim().slice(0, 80) + '" (can dung 1). Khong ghi gi ca.'); failed = true; return; }
    s = s.replace(e.find, () => e.repl);
  }
  if (after) s = after(s);
  if (s === null) { failed = true; return; }
  fs.copyFileSync(fp, fp + '.class.bak');
  fs.writeFileSync(fp, s);
  console.log('[ok]   ' + rel + ' (' + edits.length + ' cho sua, ban cu: ' + rel + '.class.bak)');
}

/* ---- server/world.js ---- */
patch('server/world.js', [
  { find: "const tgtOk = tgt && !tgt.dead;", repl: "/* AF-CLASS */ const tgtOk = tgt && !tgt.dead && !tgt.hidden;" },
  { find: "ctx.online.forEach((p) => { if (!p.dead) out.push(p); });", repl: "ctx.online.forEach((p) => { if (!p.dead && !p.hidden) out.push(p); });" },
  { find: "const d = e.d, sp = d.spd;", repl: "const d = e.d, sp = d.spd * (e.slowUntil > now ? 0.5 : 1);" }
]);

/* ---- server/game.js ---- */
patch('server/game.js', [
  { find: "const world = require('./world');", repl: "const world = require('./world');\nconst character = require('./character'); // AF-CLASS" },
  { find: "case 'act': case 'duel': return combat.handle(p, m);", repl: "case 'act': case 'duel': return combat.handle(p, m);\n    case 'char': case 'skill': return character.handle(p, m);" },
  { find: "combat.onConnect(p);", repl: "combat.onConnect(p);\n  character.onConnect(p);" },
  { find: "combat.onLeave(p);", repl: "combat.onLeave(p);\n  character.onLeave(p);" },
  { find: "anim: p.anim, eq: p.eq }; }", repl: "anim: p.anim, eq: p.eq, app: p.app }; }" },
  { find: "world.setHurt(combat.hurt);", repl: "world.setHurt(combat.hurt);\ncharacter.init({ online, send, broadcast, sys, pushMe, int, saveNow: (pl) => storeChar(pl.id, pl.data, pl.x, pl.z, 0) });" }
]);

/* ---- public/index.html ---- */
const CHX = "/* AF-CLASS */ window.AF_CHX={ get P(){return P;}, get scene(){return scene;}, get cam(){return cam;}, PL:PL, get enemyById(){return enemyById;}, nearestEnemy:(d)=>nearestEnemy(d), faceToward:(e)=>faceToward(e), hitCone:(k,c,r,a)=>hitCone(k,c,r,a), canAct:()=>canAct(), spinRing:()=>spinRing(), addOther:(p)=>addOther(p), revive:()=>{ R.alive=true; $('death').hidden=true; } };\n";
const BUILD_OLD = "const H=buildHumanoid({skin:SKINS[p.id%SKINS.length],shirt:SHIRTS[p.id%SHIRTS.length],pants:0x3a3348,hair:HAIRS[(p.id*7)%HAIRS.length]});";
const BUILD_NEW = "const H=buildHumanoid((window.AF_CLASS&&window.AF_CLASS.colorsFor&&window.AF_CLASS.colorsFor(p))||{skin:SKINS[p.id%SKINS.length],shirt:SHIRTS[p.id%SHIRTS.length],pants:0x3a3348,hair:HAIRS[(p.id*7)%HAIRS.length]}); if(window.AF_CLASS&&window.AF_CLASS.shape) window.AF_CLASS.shape(H,p.app);";
patch('public/index.html', [
  { find: "cvs.addEventListener('wheel',e=>{", repl: CHX + "cvs.addEventListener('wheel',e=>{" },
  { find: "function onNet(m){", repl: "function onNet(m){\n  try{ if(window.AF_CLASS&&window.AF_CLASS.onNet&&window.AF_CLASS.onNet(m)) return; }catch(err){ console.error('class',err); }" },
  { find: "NET.send({t:'hit',kind,combo,ids,pids});", repl: "NET.send({t:'hit',kind,combo,ids,pids}); if(window.AF_CLASS&&window.AF_CLASS.fx) window.AF_CLASS.fx(kind,ids);" },
  { find: "&&(kind==='atk'||kind==='spin')){", repl: "){", optional: true },
  { find: "hitCone('atk',R.combo,R.combo===2?2.9:2.5,0.35);", repl: "hitCone(window.AF_CLASS?window.AF_CLASS.basicKind:'atk',R.combo,window.AF_CLASS?window.AF_CLASS.basicRange(R.combo):(R.combo===2?2.9:2.5),window.AF_CLASS?window.AF_CLASS.basicCos:0.35);" },
  { find: "if(!canAct()||R.atkCd>0)return; const t=nearestEnemy(4.5);", repl: "if(!canAct()||R.atkCd>0)return; const t=nearestEnemy(window.AF_CLASS?window.AF_CLASS.autoRange:4.5);" },
  { find: "if(k==='1') doSpin();", repl: "if(k==='1'&&!(window.AF_CLASS&&window.AF_CLASS.useKey(1))) doSpin();\n  if(k==='3'&&window.AF_CLASS) window.AF_CLASS.useKey(3);\n  if(k==='4'&&window.AF_CLASS) window.AF_CLASS.useKey(4);" },
  { find: "if(k==='2') doDash();", repl: "if(k==='2'&&!(window.AF_CLASS&&window.AF_CLASS.useKey(2))) doDash();" },
  { find: "function stats(){", repl: "function stats(){ if(window.AF_RULES&&window.AF_RULES.CLASSES&&P&&P.prof) return window.AF_RULES.playerStats(P);" },
  { find: BUILD_OLD, repl: BUILD_NEW }
], (s) => {
  if (s.includes('js/classes.js')) return s;
  const i = s.lastIndexOf('</body>');
  if (i < 0) { console.error('[loi]  public/index.html: khong thay </body>'); return null; }
  return s.slice(0, i) + '<script src="js/classes.js"></script>\n' + s.slice(i);
});

if (failed) { console.error('\nCo loi o tren. File nao bao loi thi van nguyen ban cu. Gui nguyen thong bao cho minh de chinh lai.'); process.exit(1); }
console.log('\nXong. Khoi dong lai server (systemctl restart aetherfall) roi tai lai trang (Ctrl/Cmd+Shift+R).');
