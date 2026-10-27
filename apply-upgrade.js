#!/usr/bin/env node
/* Aetherfall (TAMTAI) social upgrade: applies small, guarded edits to server/game.js and public/index.html.
   Usage (from the repo root):  node apply-upgrade.js [path-to-repo]
   - Every edit looks for one exact line; if a line is missing or appears more than once, nothing is written for that file.
   - A .bak copy of each file is made first. Running it twice is safe (already patched files are skipped). */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(process.argv[2] || process.cwd());
const MARK = 'AF-SOCIAL';
let failed = false;

function patch(rel, edits) {
  const fp = path.join(root, rel);
  if (!fs.existsSync(fp)) { console.error('[loi]  khong thay ' + rel + ' (chay lenh trong thu muc goc cua repo)'); failed = true; return; }
  let s = fs.readFileSync(fp, 'utf8');
  if (s.includes(MARK)) { console.log('[bo qua] ' + rel + ' da duoc nang cap truoc do'); return; }
  for (const e of edits) {
    const n = s.split(e.find).length - 1;
    if (n !== 1) { console.error('[loi]  ' + rel + ': tim thay ' + n + ' cho dong "' + e.find.trim().slice(0, 70) + '" (can dung 1). Khong ghi gi ca.'); failed = true; return; }
    s = s.replace(e.find, () => e.repl);
  }
  fs.copyFileSync(fp, fp + '.bak');
  fs.writeFileSync(fp, s);
  console.log('[ok]   ' + rel + ' (' + edits.length + ' cho sua, ban cu: ' + rel + '.bak)');
}

patch('server/game.js', [
  { find: "const world = require('./world');",
    repl: "const world = require('./world');\nconst social = require('./social'); // AF-SOCIAL" },
  { find: "    case 'ping': return send(p, { t: 'pong', at: m.at, online: online.size });",
    repl: "    case 'ping': return send(p, { t: 'pong', at: m.at, online: online.size });\n    case 'party': case 'pchat': case 'guild': case 'gchat': case 'trade': case 'market': case 'enhance': case 'rank': case 'daily': case 'emote': return social.handle(p, m);" },
  { find: "  ws.on('message', (m) => onMessage(p, m));",
    repl: "  social.onConnect(p);\n  ws.on('message', (m) => onMessage(p, m));" },
  { find: "  online.delete(p.id);",
    repl: "  online.delete(p.id);\n  social.onLeave(p);" },
  { find: "function onKill(e, contributors) {",
    repl: "function onKill(e, contributors) {\n  contributors = social.expandKill(e, contributors);" },
  { find: "const exp = e.d.exp + e.lv * 2, gold",
    repl: "const exp = Math.round((e.d.exp + e.lv * 2) * social.expMult(p, contributors)), gold" },
  { find: "world.init({ online, send, broadcast, onKill });",
    repl: "world.init({ online, send, broadcast, onKill });\nsocial.init({ online, send, broadcast, sys, pushMe, addExp, userByName, cleanText, sendMail, int, saveNow: (pl) => storeChar(pl.id, pl.data, pl.x, pl.z, 0) });" }
]);

const HOOK = "window.AF_HOOK={ get NET(){return NET;}, get others(){return others;}, esc:(s)=>esc(s), toast:(h)=>toast(h), chatLine:(k,h)=>chatLine(k,h), getP:()=>P, isRunning:()=>running, isFriend:(n)=>isFriend(n) }; /* AF-SOCIAL */\n";
patch('public/index.html', [
  { find: "requestAnimationFrame(t=>{ last=t; requestAnimationFrame(frame); });",
    repl: HOOK + "requestAnimationFrame(t=>{ last=t; requestAnimationFrame(frame); });" },
  { find: "function onNet(m){",
    repl: "function onNet(m){\n  try{ if(window.AF_SOCIAL&&window.AF_SOCIAL.onNet(m)) return; }catch(err){ console.error('social',err); }" },
  { find: "if(c==='online'){",
    repl: "if(window.AF_SOCIAL&&window.AF_SOCIAL.cmd(c,parts)) return; if(c==='online'){" }
]);
// the <script> tag goes just before the last </body>
(function () {
  const rel = 'public/index.html', fp = path.join(root, rel);
  if (failed || !fs.existsSync(fp)) return;
  let s = fs.readFileSync(fp, 'utf8');
  if (s.includes('js/social.js')) return;
  const i = s.lastIndexOf('</body>');
  if (i < 0) { console.error('[loi]  ' + rel + ': khong thay </body>'); failed = true; return; }
  s = s.slice(0, i) + '<script src="js/social.js"></script>\n' + s.slice(i);
  fs.writeFileSync(fp, s);
  console.log('[ok]   ' + rel + ' (them <script src="js/social.js">)');
})();

if (failed) { console.error('\nCo loi o tren. Cac file khong bi sua do loi van nguyen ban cu. Gui moi thong bao loi cho minh de chinh lai.'); process.exit(1); }
console.log('\nXong. Khoi dong lai server: npm start (hoac systemctl restart ten-service).');
