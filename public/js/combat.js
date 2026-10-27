/* Aetherfall combat (browser side). The server owns HP/MP, damage, death, blocking, status effects and duels;
   this file only draws what the server reports and sends the player's actions.
   Controls: right mouse button = block (a block in the first ~0.35s is a parry that stuns the monster), Space = dodge.
   Duel: /duel <name>, /duel ok, /duel no, /duel stop, /duel top. */
(function () {
  'use strict';
  const H = window.AF_CH;
  if (!H) { console.warn('[combat] thiếu AF_CH, bỏ qua (hãy chạy apply-combat.js)'); return; }
  const esc = H.esc;
  const S = { stunUntil: 0, slowUntil: 0, duelWith: null, duelName: '', oppHp: 0, oppMax: 0, fx: [], startAt: 0 };
  const FXN = { burn: ['Bỏng', '#ff8a4c'], poison: ['Độc', '#9be15d'], slow: ['Chậm', '#6fc1ff'], stun: ['Choáng', '#ffd95a'] };
  const send = (m) => H.NET.send(m);

  /* ---------- HUD ---------- */
  const css = document.createElement('style');
  css.textContent = '#afFx{position:fixed;left:16px;top:112px;z-index:20;display:flex;gap:6px;flex-wrap:wrap;max-width:240px;pointer-events:none}' +
    '#afFx span{padding:2px 8px;border-radius:999px;background:rgba(13,18,31,.85);border:1px solid currentColor;font:700 12px system-ui,sans-serif}' +
    '#afDuel{position:fixed;left:50%;top:76px;transform:translateX(-50%);z-index:20;min-width:240px;padding:8px 14px;border-radius:10px;background:rgba(13,18,31,.9);border:2px solid #ff6a55;color:#f1ebde;font:600 13px system-ui,sans-serif;text-align:center;pointer-events:none}' +
    '#afDuel .b{height:8px;border-radius:5px;background:rgba(0,0,0,.5);overflow:hidden;margin-top:5px}#afDuel .b i{display:block;height:100%;background:#e0533f}' +
    '#afDuel[hidden],#afFx[hidden]{display:none}';
  document.head.appendChild(css);
  const fxEl = document.createElement('div'); fxEl.id = 'afFx'; fxEl.hidden = true;
  const duelEl = document.createElement('div'); duelEl.id = 'afDuel'; duelEl.hidden = true;
  document.body.append(fxEl, duelEl);

  function renderFx() {
    const t = H.time; const live = S.fx.filter((f) => f.until > t);
    fxEl.hidden = !live.length || !H.isRunning();
    fxEl.innerHTML = live.map((f) => { const n = FXN[f.id] || [f.id, '#fff']; return '<span style="color:' + n[1] + '">' + n[0] + ' ' + Math.ceil(f.until - t) + 's</span>'; }).join('');
    if (S.duelWith != null) {
      const wait = Math.ceil(S.startAt - t);
      duelEl.hidden = false;
      duelEl.innerHTML = 'Thách đấu với <b>' + esc(S.duelName) + '</b>' + (wait > 0 ? ' · bắt đầu sau ' + wait + 's' : '') +
        '<div class="b"><i style="width:' + Math.max(0, Math.min(100, S.oppHp / Math.max(1, S.oppMax) * 100)) + '%"></i></div><small>Đối thủ ' + Math.max(0, S.oppHp) + ' / ' + S.oppMax + ' · /duel stop để đầu hàng</small>';
    } else duelEl.hidden = true;
  }
  setInterval(renderFx, 200);

  /* ---------- block (right mouse button) ---------- */
  let blockLocal = 0;
  H.cvs.addEventListener('pointerdown', (e) => {
    if (e.button !== 2 || !H.isRunning() || !H.R.alive) return;
    const t = performance.now(); if (t < blockLocal) return; blockLocal = t + 1500;
    send({ t: 'act', k: 'block' });
    H.popNum(H.R.x, H.heightAt(H.R.x, H.R.z) + 2.2, H.R.z, 'Thủ thế', 'info');
  });

  /* ---------- server messages ---------- */
  function onNet(m) {
    const R = H.R;
    switch (m.t) {
      case 'vit':
        R.hp = m.hp; R.mp = m.mp;
        if (m.hp <= 0 && R.alive) H.die();
        return true;
      case 'hurt': {
        const y = H.heightAt(R.x, R.z) + 2.4;
        if (m.kind === 'miss') { H.popNum(R.x, y, R.z, 'Né!', 'info'); return true; }
        if (m.kind === 'parry') { H.popNum(R.x, y, R.z, 'Đỡ hoàn hảo!', 'heal'); return true; }
        R.hp = m.hp; R.lastHurt = H.time;
        H.popNum(R.x, y, R.z, (m.kind === 'block' ? 'Đỡ -' : '-') + m.dmg, m.kind === 'burn' || m.kind === 'poison' ? 'other' : 'hurt');
        if (m.label) H.popNum(R.x, y + 0.6, R.z, m.label, 'hurt');
        if (m.kbx != null && R.invuln <= 0) { R.kbx = m.kbx; R.kbz = m.kbz; }
        if (m.hp <= 0 && R.alive) H.die();
        return true; }
      case 'fx': {
        const t = H.time; S.fx = (m.list || []).map((f) => ({ id: f.id, until: t + f.left }));
        S.stunUntil = 0; S.slowUntil = 0;
        S.fx.forEach((f) => { if (f.id === 'stun') S.stunUntil = f.until; if (f.id === 'slow') S.slowUntil = f.until; });
        renderFx(); return true; }
      case 'duel':
        if (m.st === 'start') { S.duelWith = m.with; S.duelName = m.name; S.oppHp = m.oppHp; S.oppMax = m.oppMax; S.startAt = H.time + m.startIn; H.toast('<b>Thách đấu</b> với ' + esc(m.name) + '! Chuẩn bị...'); }
        else if (m.st === 'hp') { S.oppHp = m.oppHp; S.oppMax = m.oppMax; }
        else if (m.st === 'end') { S.duelWith = null; H.toast(m.draw ? 'Trận đấu hòa' : m.win ? 'Bạn <b>thắng</b> trận đấu!' : 'Bạn <b>thua</b> trận đấu.', true); }
        else if (m.st === 'invite') H.toast('<b>' + esc(m.from) + '</b> thách đấu bạn! Gõ <b>/duel ok</b> để nhận.');
        renderFx(); return true;
      default: return false;
    }
  }

  /* ---------- chat commands ---------- */
  function cmd(c, parts) {
    if (c !== 'duel' && c !== 'thachdau') return false;
    const a = (parts[0] || '').toLowerCase();
    if (a === 'ok' || a === 'dongy') send({ t: 'duel', op: 'accept' });
    else if (a === 'no') send({ t: 'duel', op: 'decline' });
    else if (a === 'stop') send({ t: 'duel', op: 'stop' });
    else if (a === 'top') send({ t: 'duel', op: 'top' });
    else if (a) send({ t: 'duel', op: 'invite', name: parts[0] });
    else H.chatLine('sys', 'Thách đấu: /duel tên · /duel ok · /duel no · /duel stop · /duel top');
    return true;
  }

  Object.assign(S, { onNet, cmd });
  window.AF_COMBAT = S;
})();
