#!/usr/bin/env node
/* Aetherfall (TAMTAI) step 5-10: exploration, story and quests, skill tree, accessories, auction house, ranked arena, 42-slot bag.
   These are PLUGINS of server/zones.js (Dot 3): each server/<name>.js is loaded when the file exists and skipped (with a log line) if it throws.
   This script only touches public/index.html (a .plugins.bak copy is made first):
     1. adds a <script> tag for every plugin file that exists, in the right order,
     2. bumps the ?v= number on every game script tag so browsers reload the changed files,
     3. changes the bag from 24 to 42 slots at the 4 places where the browser has the number 24 written in (all-or-nothing).
   Usage (from the repo root):  node apply-plugins.js [path-to-repo]
   REQUIRES apply-zones.js to have been run first. Safe to run twice and to run again when you add more plugin files. */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(process.argv[2] || process.cwd());
const VER = 9;
const MARK = 'AF-PLUGINS-BAG';
const ORDER = ['story', 'tree', 'geardata', 'explore', 'quests', 'skilltree', 'gear', 'auction', 'arena', 'dock', 'equipdata', 'equip', 'world2', 'move', 'instances', 'faction', 'pvp', 'team', 'visual', 'monsters'];
const SERVER = ['explore', 'quests', 'skilltree', 'gear', 'auction', 'arena', 'equip', 'world2', 'move', 'instances', 'faction', 'pvp', 'team'];
const exists = (rel) => fs.existsSync(path.join(root, rel));

if (!exists('server/zones.js') || !fs.readFileSync(path.join(root, 'server/zones.js'), 'utf8').includes('loadPlugins')) {
  console.error('[loi]  server/zones.js chua phai ban moi (thieu bo nap plugin). Hay chep server/zones.js moi vao, roi chay lai.'); process.exit(1);
}
const fp = path.join(root, 'public/index.html');
if (!fs.existsSync(fp)) { console.error('[loi]  khong thay public/index.html (chay lenh trong thu muc goc cua repo)'); process.exit(1); }
let s = fs.readFileSync(fp, 'utf8');
if (!s.includes('js/zones.js')) { console.error('[loi]  public/index.html chua co js/zones.js. Hay chay node apply-zones.js truoc.'); process.exit(1); }

const missing = ORDER.filter((n) => !exists('public/js/' + n + '.js'));
if (missing.length) console.log('[canh bao] thieu file trong public/js: ' + missing.map((n) => n + '.js').join(', ') + ' (cac plugin dung chung se bo qua)');
const missingS = SERVER.filter((n) => !exists('server/' + n + '.js'));
if (missingS.length) console.log('[canh bao] thieu file trong server: ' + missingS.map((n) => n + '.js').join(', '));
if (!exists('public/js/rules.js') || !fs.readFileSync(path.join(root, 'public/js/rules.js'), 'utf8').includes('xgear')) console.log('[canh bao] public/js/rules.js chua phai ban moi: trang suc va cay ky nang se khong cong chi so. Hay chep de ban moi vao.');

// 1. script tags
let added = 0;
const tags = ORDER.filter((n) => exists('public/js/' + n + '.js') && !new RegExp('js/' + n + '\\.js').test(s)).map((n) => '<script src="js/' + n + '.js"></script>');
if (tags.length) {
  const i = s.lastIndexOf('</body>');
  if (i < 0) { console.error('[loi]  public/index.html: khong thay </body>'); process.exit(1); }
  s = s.slice(0, i) + tags.join('\n') + '\n' + s.slice(i); added = tags.length;
}
// 2. cache-busting number on every game script tag (never lowers an existing number)
let bumped = 0;
s = s.replace(/(js\/(?:items|rules|social|combat|classes|zones|story|tree|geardata|explore|quests|skilltree|gear|auction|arena|dock|equipdata|equip|world2|move|instances|faction|pvp|team|visual|monsters)\.js)(?:\?v=(\d+))?"/g, (m0, f, q) => { if (q && Number(q) >= VER) return m0; bumped++; return f + '?v=' + VER + '"'; });
// 3. bag size: only when all four spots are found exactly once
let bag = 'bo qua';
if (s.includes(MARK)) bag = 'da lam truoc do';
else {
  const edits = [
    ["+' / 24 · '+", "+' / '+AF_RULES.INV_SIZE+' · '+"],
    ["for(let i=0;i<24;i++){ const it=P.inv[i];", "for(let i=0;i<AF_RULES.INV_SIZE;i++){ const it=P.inv[i];"],
    ["if(P.inv.length>=24){", "if(P.inv.length>=AF_RULES.INV_SIZE){"],
    ["P.inv.length+'/24'", "P.inv.length+'/'+AF_RULES.INV_SIZE"]
  ];
  const counts = edits.map((e) => s.split(e[0]).length - 1);
  if (counts.every((n) => n === 1)) { edits.forEach((e) => { s = s.replace(e[0], () => e[1]); }); s = s.replace(/<\/body>/, () => '<!-- ' + MARK + ' -->\n</body>'); bag = 'da doi tui sang 42 o'; }
  else bag = 'KHONG doi duoc (tim thay ' + counts.join('/') + ' cho 4 cho can sua, can dung 1/1/1/1). Tui van la 24 o tren man hinh; gui minh thong bao nay neu muon sua';
}
// 4. the pond: the original movement code pushes you back whenever the ground is lower than -0.9, so nobody can ever enter the water
//    and the swimming of step 12 never happens. The deepest part of the pond is about -2.6 below the shore, so -3.4 lets you wade in.
const WA = 'if(heightAt(R.x,R.z)<-0.9){', WB = 'if(heightAt(R.x,R.z)<-3.4){';
let walk;
if (s.includes(WB)) walk = 'da lam truoc do';
else if (s.split(WA).length === 2) { s = s.replace(WA, () => WB); walk = 'da cho phep di vao ao (boi)'; }
else walk = 'KHONG tim thay dong chan nuoc trong index.html (ao van chan duong, gui minh neu muon sua)';
const walked = walk.startsWith('da cho');
if (added || bumped || bag.startsWith('da doi') || walked) { fs.copyFileSync(fp, fp + '.plugins.bak'); fs.writeFileSync(fp, s); }
console.log('[ok]   public/index.html: them ' + added + ' the script, ?v=' + VER + ' cho ' + bumped + ' the, tui: ' + bag + ', ao: ' + walk + (added || bumped || walked || bag.startsWith('da doi') ? ' (ban cu: public/index.html.plugins.bak)' : ''));

// the server also has to allow 42 items: warn about any hard-coded 24 next to the bag in game.js
const gj = path.join(root, 'server/game.js');
if (fs.existsSync(gj)) {
  const hits = fs.readFileSync(gj, 'utf8').split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /\binv\b/.test(l) && /(?<![\w.])24(?![\w.])/.test(l));
  if (hits.length) { console.log('[canh bao] server/game.js co so 24 ghi cung gan tui do, gui minh cac dong nay:'); hits.slice(0, 6).forEach(([n, l]) => console.log('   dong ' + n + ': ' + l.trim().slice(0, 140))); }
}
console.log('\nXong. Khoi dong lai server (systemctl restart aetherfall), roi xem 6 dong "[plugin] da nap ..." trong journalctl va tai lai game (Ctrl/Cmd+Shift+R).');
