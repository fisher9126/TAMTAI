#!/usr/bin/env node
/* Aetherfall (TAMTAI) step 4: timed events (x2 EXP, drops, gold, gathering, shop sale), scheduled world boss, and a new admin page
   "Hệ thống game" (events, world boss, guilds, market, trades, professions, statistics).
   Patches server/game.js, server/index.js and public/admin.html (a .events.bak copy of each is made first), and bumps the ?v= number on the game's
   script tags so browsers reload the changed files.
   Usage (from the repo root):  node apply-events.js [path-to-repo]
   REQUIRES apply-zones.js to have been run first (the world boss is spawned through it).
   Copy these files into the repo first: server/events.js, public/admin-game.html, public/js/zones.js (new), public/js/rules.js (new),
   server/zones.js (new), server/social.js (new).
   Every edit looks for one exact line; if a line is missing or appears more than once, nothing is written for that file.
   Safe to run twice. */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(process.argv[2] || process.cwd());
const MARK = 'AF-EVENTS';
const VER = 5;
let failed = false;
const read = (rel) => { const fp = path.join(root, rel); return fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : null; };

for (const need of ['server/events.js', 'public/admin-game.html']) {
  if (!fs.existsSync(path.join(root, need))) { console.error('[loi]  thieu ' + need + ' (hay chep file nay vao repo truoc)'); process.exit(1); }
}
const world = read('server/world.js');
if (!world || !world.includes('spawnAt')) { console.error('[loi]  server/world.js chua duoc va bang apply-zones.js. Hay chay: node apply-zones.js truoc.'); process.exit(1); }
const rules = read('public/js/rules.js');
if (!rules || !rules.includes('wboss')) { console.error('[loi]  public/js/rules.js chua phai ban moi (thieu wboss). Hay chep de ban moi vao.'); process.exit(1); }
const zc = read('public/js/zones.js');
if (!zc || !zc.includes('wboss')) console.log('[canh bao] public/js/zones.js chua phai ban moi: se khong thay bang su kien va thanh mau boss trong game. Hay chep de ban moi vao.');
const soc = read('server/social.js');
if (soc && !soc.includes("require('./events')")) console.log('[canh bao] server/social.js chua phai ban moi: su kien nhan doi EXP va giam gia cua hang se khong co tac dung. Hay chep de ban moi vao.');

function patch(rel, edits) {
  const fp = path.join(root, rel);
  if (!fs.existsSync(fp)) { console.error('[loi]  khong thay ' + rel + ' (chay lenh trong thu muc goc cua repo)'); failed = true; return; }
  let s = fs.readFileSync(fp, 'utf8');
  if (s.includes(MARK)) { console.log('[bo qua] ' + rel + ' da duoc nang cap truoc do'); return; }
  for (const e of edits) {
    const n = s.split(e.find).length - 1;
    if (n !== 1) { console.error('[loi]  ' + rel + ': tim thay ' + n + ' cho dong "' + e.find.trim().slice(0, 80) + '" (can dung 1). Khong ghi gi ca.'); failed = true; return; }
    s = s.replace(e.find, () => e.repl);
  }
  fs.copyFileSync(fp, fp + '.events.bak');
  fs.writeFileSync(fp, s);
  console.log('[ok]   ' + rel + ' (' + edits.length + ' cho sua, ban cu: ' + rel + '.events.bak)');
}

/* ---- server/game.js ---- */
patch('server/game.js', [
  { find: "const world = require('./world');", repl: "const world = require('./world');\nconst events = require('./events'); // AF-EVENTS" },
  { find: "if (Math.random() < e.d.drop) add('item',", repl: "if (Math.random() < Math.min(1, e.d.drop * events.dropMult())) add('item'," },
  { find: "gold = world.randi(e.d.gold[0], e.d.gold[1]);", repl: "gold = Math.round(world.randi(e.d.gold[0], e.d.gold[1]) * events.goldMult());" },
  { find: "ws.on('message', (m) => onMessage(p, m));", repl: "events.onConnect(p);\n  ws.on('message', (m) => onMessage(p, m));" },
  { find: "world.init({ online, send, broadcast, onKill });", repl: "world.init({ online, send, broadcast, onKill });\nevents.init({ online, send, broadcast, world, sendMail: typeof sendMail === 'function' ? sendMail : null, logAdmin: typeof logAdmin === 'function' ? logAdmin : null });" }
]);

/* ---- server/index.js: add the new admin routes to the existing list ---- */
patch('server/index.js', [
  { find: "const server = http.createServer(async (req, res) => {", repl: "try { ADMIN_ROUTES.push(...require('./events').adminRoutes(game)); } catch (err) { console.error('events routes', err.message); } // AF-EVENTS\nconst server = http.createServer(async (req, res) => {" }
]);

/* ---- public/admin.html: one link to the new page ---- */
patch('public/admin.html', [
  { find: '<a href="#adminlog">Nhật ký admin</a>', repl: '<a href="#adminlog">Nhật ký admin</a>\n      <!-- AF-EVENTS --><a href="/admin-game.html">Hệ thống game ↗</a>' }
]);

/* ---- make browsers reload the changed .js files (never lowers an existing number) ---- */
if (!failed) {
  const fp = path.join(root, 'public/index.html');
  if (fs.existsSync(fp)) {
    const s = fs.readFileSync(fp, 'utf8');
    let n = 0;
    const out = s.replace(/(js\/(?:items|rules|social|combat|classes|zones)\.js)(?:\?v=(\d+))?"/g, (m0, f, q) => { if (q && Number(q) >= VER) return m0; n++; return f + '?v=' + VER + '"'; });
    if (n) { fs.writeFileSync(fp, out); console.log('[ok]   public/index.html: ?v=' + VER + ' cho ' + n + ' the script (trinh duyet se tai lai file moi)'); }
    else console.log('[bo qua] public/index.html: cac the script da co ?v=' + VER + ' tro len');
  }
}

if (failed) { console.error('\nCo loi o tren. File nao bao loi thi van nguyen ban cu. Gui nguyen thong bao cho minh de chinh lai.'); process.exit(1); }
console.log('\nXong. Khoi dong lai server (systemctl restart aetherfall), tai lai game (Ctrl/Cmd+Shift+R), roi mo /admin va bam "He thong game".');
