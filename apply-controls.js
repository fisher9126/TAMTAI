#!/usr/bin/env node
/* Aetherfall (TAMTAI) controls fix. Patches public/index.html only.
   1) Keys are read by physical position (e.code), so Vietnamese input methods (Telex/Unikey) can no longer
      leave W "stuck" and make the character walk by itself. Keys are also cleared on Cmd release / tab switch.
   2) Mouse lock: press L (or the button at the bottom centre) to lock the cursor so moving the mouse turns the camera
      without holding a button; left click attacks. Press L or Esc to unlock. The cursor unlocks by itself when you open
      the bag, friends, dialog, chat or the social panel.
   Usage (from the repo root):  node apply-controls.js [path-to-repo]
   Independent of apply-upgrade.js: run it before or after. Safe to run twice. Makes public/index.html.controls.bak first. */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(process.argv[2] || process.cwd());
const rel = 'public/index.html';
const fp = path.join(root, rel);
if (!fs.existsSync(fp)) { console.error('[loi]  khong thay ' + rel + ' (chay lenh trong thu muc goc cua repo)'); process.exit(1); }
let s = fs.readFileSync(fp, 'utf8');
if (s.includes('AF-CONTROLS')) { console.log('[bo qua] ' + rel + ' da duoc sua dieu khien truoc do'); process.exit(0); }

const KEYOF = "/* AF-CONTROLS */ function keyOf(e){ const c=e.code||''; if(c.indexOf('Key')===0) return c.slice(3).toLowerCase(); if(c.indexOf('Digit')===0) return c.slice(5); return e.key.toLowerCase(); }\n";
const LOCK = [
  "/* AF-CONTROLS: mouse lock (L) */",
  "let mouseLocked=false;",
  "const lockBtn=document.createElement('button'); lockBtn.type='button'; lockBtn.id='lockBtn'; lockBtn.hidden=true;",
  "lockBtn.style.cssText='position:fixed;left:50%;bottom:34px;transform:translateX(-50%);z-index:6;padding:6px 12px;border-radius:9px;border:1px solid #2f3a55;background:rgba(13,18,31,.84);color:#f1ebde;font:600 12px system-ui,sans-serif;cursor:pointer';",
  "function lockLabel(){ lockBtn.textContent=mouseLocked?'Mở chuột (L)':'Khóa chuột (L)'; }",
  "document.body.appendChild(lockBtn); lockLabel();",
  "function toggleMouseLock(){ if(isTouch||!running)return; if(document.pointerLockElement===cvs){ document.exitPointerLock(); return; }",
  "  if(invOpen||dialogOpen||frOpen)return; const p=cvs.requestPointerLock&&cvs.requestPointerLock(); if(p&&p.catch) p.catch(()=>{}); }",
  "document.addEventListener('pointerlockchange',()=>{ mouseLocked=document.pointerLockElement===cvs; drag=null; lockLabel(); });",
  "lockBtn.addEventListener('click',toggleMouseLock);",
  "document.addEventListener('mousemove',e=>{ if(!mouseLocked||cam.mode==='top'||invOpen||dialogOpen)return; cam.yaw-=e.movementX*0.0055; cam.pitch=clamp(cam.pitch+e.movementY*0.0045,-0.35,1.25); });",
  "setInterval(()=>{ lockBtn.hidden=!running||isTouch;",
  "  if(document.pointerLockElement===cvs&&(!running||invOpen||dialogOpen||frOpen||document.activeElement===$('chatIn')||(window.AF_SOCIAL&&window.AF_SOCIAL.isOpen&&window.AF_SOCIAL.isOpen()))) document.exitPointerLock(); },150);",
  "document.addEventListener('visibilitychange',()=>{ if(document.hidden) for(const q in keys) keys[q]=false; });",
  ""
].join('\n');

const edits = [
  { find: "window.addEventListener('keydown',e=>{", repl: KEYOF + "window.addEventListener('keydown',e=>{" },
  { find: "const k=e.key.toLowerCase(); keys[k]=true;", repl: "const k=keyOf(e); keys[k]=true;" },
  { find: "window.addEventListener('keyup',e=>{ keys[e.key.toLowerCase()]=false;", repl: "window.addEventListener('keyup',e=>{ keys[e.key.toLowerCase()]=false; keys[keyOf(e)]=false; if(e.key==='Meta') for(const q in keys) keys[q]=false;" },
  { find: "if(k==='v'){ cycleCam(); return; }", repl: "if(k==='l'){ toggleMouseLock(); return; }\n  if(k==='v'){ cycleCam(); return; }" },
  { find: "cvs.addEventListener('wheel',e=>{", repl: LOCK + "cvs.addEventListener('wheel',e=>{" }
];
for (const e of edits) {
  const n = s.split(e.find).length - 1;
  if (n !== 1) { console.error('[loi]  ' + rel + ': tim thay ' + n + ' cho dong "' + e.find.slice(0, 70) + '" (can dung 1). Khong ghi gi ca.'); process.exit(1); }
  s = s.replace(e.find, () => e.repl);
}
fs.copyFileSync(fp, fp + '.controls.bak');
fs.writeFileSync(fp, s);
console.log('[ok]   ' + rel + ' (' + edits.length + ' cho sua, ban cu: ' + rel + '.controls.bak)');
console.log('Xong. Khong can restart server; chi can tai lai trang (Ctrl/Cmd+Shift+R).');
