#!/usr/bin/env node
/* Aetherfall (TAMTAI) step 3: new zones with monsters, gathering nodes, professions and crafting, party dungeon.
   Patches server/world.js, server/game.js and public/index.html (a .zones.bak copy of each is made first), and bumps the
   ?v= number on the game's script tags so browsers stop using cached old files.
   Usage (from the repo root):  node apply-zones.js [path-to-repo]
   Copy these files into the repo first: server/zones.js, public/js/zones.js, public/js/rules.js (new version), server/social.js (new version).
   Every edit looks for one exact line; if a line is missing or appears more than once, nothing is written for that file.
   Independent of the other apply-*.js scripts: run it before or after them. Safe to run twice. */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(process.argv[2] || process.cwd());
const MARK = 'AF-ZONES';
const VER = 4; // bump when any shared .js file changes, so browsers reload it
let failed = false;
const read = (rel) => { const fp = path.join(root, rel); return fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : null; };

for (const need of ['server/zones.js', 'public/js/zones.js']) {
  if (!fs.existsSync(path.join(root, need))) { console.error('[loi]  thieu ' + need + ' (hay chep file nay vao repo truoc)'); process.exit(1); }
}
const rules = read('public/js/rules.js');
if (!rules || !rules.includes('DUNGEON') || !rules.includes('RECIPES')) { console.error('[loi]  public/js/rules.js chua phai ban moi (thieu DUNGEON/RECIPES). Hay chep de ban moi vao.'); process.exit(1); }
const soc = read('server/social.js');
if (soc && !soc.includes("require('./zones')")) console.log('[canh bao] server/social.js chua phai ban moi: thuoc tang EXP se khong co tac dung. Hay chep de ban moi vao.');

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
  fs.copyFileSync(fp, fp + '.zones.bak');
  fs.writeFileSync(fp, s);
  console.log('[ok]   ' + rel + ' (' + edits.length + ' cho sua, ban cu: ' + rel + '.zones.bak)');
}

/* ---- server/world.js ---- */
const WORLD_FUNCS = [
  "/* AF-ZONES */ function snapshot() { return enemies.filter((e) => !e.inst).map(pub); }",
  "/* spawn with options: inst = dungeon run id (only that run sees it), arena = clamp centre for bosses, hpMul / atkMul = party scaling */",
  "function spawnAt(type, x, z, o) {",
  "  spawn(type, x, z);",
  "  const e = enemies[enemies.length - 1];",
  "  if (o) {",
  "    if (o.inst) e.inst = o.inst;",
  "    if (o.arena) e.arena = o.arena;",
  "    if (o.hpMul) { e.maxHp = Math.round(e.maxHp * o.hpMul); e.hp = e.maxHp; }",
  "    if (o.atkMul) e.atk = Math.round(e.atk * o.atkMul);",
  "  }",
  "  return e;",
  "}",
  "function despawn(e) { const i = enemies.indexOf(e); if (i >= 0) enemies.splice(i, 1); byId.delete(e.id); }",
  "function setBroadcast(f) { ctx.broadcast = f; }"
].join('\n');
patch('server/world.js', [
  { find: "function snapshot() { return enemies.map(pub); }", repl: WORLD_FUNCS },
  { find: "snapshot, playerHit, enemies, byId, randi };", repl: "snapshot, playerHit, enemies, byId, randi, spawnAt, despawn, setBroadcast };" },
  { find: "spawn('boss', ARENA.x, ARENA.z);", repl: "spawn('boss', ARENA.x, ARENA.z);\n  try { require('./zones').layout(spawnAt); } catch (err) { console.error('zones layout', err.message); }" },
  { find: "e.respawnAt = Date.now() + e.d.respawn * 1000;", repl: "e.respawnAt = e.inst ? Infinity : Date.now() + e.d.respawn * 1000;" },
  { find: "const dc = Math.hypot(e.x - WORLD.ARENA.x, e.z - WORLD.ARENA.z);", repl: "const AR = e.arena || WORLD.ARENA; const dc = Math.hypot(e.x - AR.x, e.z - AR.z);" },
  { find: "if (dc > 15) { e.x = WORLD.ARENA.x + (e.x - WORLD.ARENA.x) / dc * 15; e.z = WORLD.ARENA.z + (e.z - WORLD.ARENA.z) / dc * 15;", repl: "if (dc > 15) { e.x = AR.x + (e.x - AR.x) / dc * 15; e.z = AR.z + (e.z - AR.z) / dc * 15;" }
]);

/* ---- server/game.js ---- */
patch('server/game.js', [
  { find: "const world = require('./world');", repl: "const world = require('./world');\nconst zones = require('./zones'); // AF-ZONES" },
  { find: "case 'ping': return send(p, { t: 'pong', at: m.at, online: online.size });", repl: "case 'ping': return send(p, { t: 'pong', at: m.at, online: online.size });\n    case 'zone': return zones.handle(p, m);" },
  { find: "ws.on('message', (m) => onMessage(p, m));", repl: "zones.onConnect(p);\n  ws.on('message', (m) => onMessage(p, m));" },
  { find: "online.delete(p.id);", repl: "online.delete(p.id);\n  zones.onLeave(p);" },
  { find: "if (d > max && !respawn) { send(p, { t: 'correct', x: p.x, z: p.z }); return; }", repl: "if (zones.blocked(p, x, z) && !respawn) { send(p, { t: 'correct', x: p.x, z: p.z }); return; }\n  if (d > max && !respawn) { send(p, { t: 'correct', x: p.x, z: p.z }); return; }" },
  { find: "giveLoot(p, e);", repl: "giveLoot(p, e);\n    zones.onKill(p, e);" },
  { find: "world.init({ online, send, broadcast, onKill });", repl: "world.init({ online, send, broadcast, onKill });\nzones.init({ online, send, broadcast, sys, pushMe, addExp, world });\nworld.setBroadcast(zones.wrapBroadcast(broadcast, world));" }
]);

/* ---- public/index.html ---- */
const ENEMIES_API = "/* AF-ZONES */ window.AF_ENEMIES={ remove(id){ const e=enemyById.get(id); if(!e) return; scene.remove(e.obj); e.lab.remove(); enemyById.delete(id); const i=enemies.indexOf(e); if(i>=0) enemies.splice(i,1); if(R.target===e) R.target=null; } };\n";
patch('public/index.html', [
  { find: "function onNet(m){", repl: "function onNet(m){\n  try{ if(window.AF_ZONES&&window.AF_ZONES.onNet&&window.AF_ZONES.onNet(m)) return; }catch(err){ console.error('zones',err); }" },
  { find: "function zoneName(x,z){", repl: "function zoneName(x,z){\n  { const zz=window.AF_ZONES&&window.AF_ZONES.nameAt&&window.AF_ZONES.nameAt(x,z); if(zz) return zz; }" },
  { find: "Object.assign({},AF_RULES.ENEMIES[k],VIS[k])", repl: "Object.assign({},AF_RULES.ENEMIES[k],VIS[k]||VIS[AF_RULES.ENEMIES[k].look])" },
  { find: "const built=d.build(); scene.add(built.g);", repl: "const built=d.build(); if(window.AF_ZONES&&window.AF_ZONES.skin) window.AF_ZONES.skin(d,built); scene.add(built.g);" },
  { find: "function clearEnemies(){", repl: ENEMIES_API + "function clearEnemies(){" }
], (s) => {
  if (s.includes('js/zones.js')) return s;
  const i = s.lastIndexOf('</body>');
  if (i < 0) { console.error('[loi]  public/index.html: khong thay </body>'); return null; }
  return s.slice(0, i) + '<script src="js/zones.js"></script>\n' + s.slice(i);
});

/* ---- make browsers reload the shared .js files: ?v=N on every game script tag ---- */
if (!failed) {
  const fp = path.join(root, 'public/index.html');
  if (fs.existsSync(fp)) {
    const s = fs.readFileSync(fp, 'utf8');
    let n = 0;
    const out = s.replace(/(js\/(?:items|rules|social|combat|classes|zones)\.js)(\?v=\d+)?"/g, (m0, f, q) => { if (q === '?v=' + VER) return m0; n++; return f + '?v=' + VER + '"'; });
    if (n) { fs.writeFileSync(fp, out); console.log('[ok]   public/index.html: ?v=' + VER + ' cho ' + n + ' the script (trinh duyet se tai lai file moi)'); }
    else console.log('[bo qua] public/index.html: cac the script da co ?v=' + VER);
  }
}

if (failed) { console.error('\nCo loi o tren. File nao bao loi thi van nguyen ban cu. Gui nguyen thong bao cho minh de chinh lai.'); process.exit(1); }
console.log('\nXong. Khoi dong lai server (systemctl restart aetherfall) roi tai lai trang (Ctrl/Cmd+Shift+R).');
