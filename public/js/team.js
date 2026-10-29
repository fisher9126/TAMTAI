/* Aetherfall step 14 (browser): party health frame, guild storage and voice chat (panel Q).
   Voice is peer to peer (WebRTC): the server only relays the connection messages. The microphone needs a secure page (https:// or localhost);
   on plain http://IP the browser refuses, so the panel says so. Without a TURN relay some home networks cannot connect to each other (STUN only). */
(function () {
  'use strict';
  const H = window.AF_CH, X = window.AF_CHX, D = window.AF_DOCK, RU = window.AF_RULES, IT = window.AF_ITEMS;
  if (!H || !D || !RU) { console.warn('[team] thiếu AF_CH/AF_DOCK, bỏ qua'); return; }
  const esc = D.esc, send = D.send, num = D.num;
  const T = { frame: [], bank: null, tab: 'voice', vc: { room: null, peers: new Map(), mic: false, muted: false, err: '' } };
  window.AF_TEAM = T;
  const ctl = D.add({ id: 'team', label: 'Đội & Bang', onOpen: () => send({ op: 'gbinfo' }) });
  const pn = ctl.panel;
  const rc = (r) => ({ common: '#c8c8d0', rare: '#6fb4ff', epic: '#c58cff', legend: '#ffa94a' }[r] || '#fff');
  const RANK = ['Thành viên', 'Phó bang', 'Trưởng bang'];

  /* ---------- party frame ---------- */
  const css = document.createElement('style');
  css.textContent = '#afPF{position:fixed;left:12px;top:210px;z-index:19;display:flex;flex-direction:column;gap:4px;width:190px;pointer-events:none}' +
    '#afPF .m{padding:4px 8px;border-radius:8px;background:rgba(13,18,31,.82);border:1px solid rgba(255,255,255,.18);color:#eef3ff;font:600 12px system-ui,sans-serif}' +
    '#afPF .m.dead{opacity:.5}#afPF .m.speak{border-color:#7ddc8f;box-shadow:0 0 6px #7ddc8f}#afPF .b{height:6px;border-radius:4px;background:rgba(0,0,0,.5);overflow:hidden;margin-top:3px}#afPF .b i{display:block;height:100%}' +
    '#afPF[hidden]{display:none}';
  document.head.appendChild(css);
  const pf = document.createElement('div'); pf.id = 'afPF'; pf.hidden = true; document.body.appendChild(pf);
  const speaking = new Set();
  function paintFrame() {
    const list = T.frame; pf.hidden = !list.length || !H.isRunning();
    pf.innerHTML = list.map((m) => '<div class="m' + (m.dead ? ' dead' : '') + (speaking.has(m.id) ? ' speak' : '') + '">' + (m.lead ? '★ ' : '') + esc(m.name) + ' <small style="color:#aab6d8">Lv ' + m.lv + '</small>' +
      '<div class="b"><i style="width:' + Math.max(0, Math.min(100, m.hp / Math.max(1, m.max) * 100)) + '%;background:' + (m.hp / Math.max(1, m.max) < 0.3 ? '#ff5a4a' : '#7ddc8f') + '"></i></div>' +
      '<div class="b" style="height:4px"><i style="width:' + Math.max(0, Math.min(100, m.mp / Math.max(1, m.mmax) * 100)) + '%;background:#6fb4ff"></i></div></div>').join('');
  }
  setInterval(paintFrame, 400);

  /* ---------- panel ---------- */
  ctl.render = function () {
    if (!ctl.open) return;
    let h = ctl.head('Đội & Bang hội') + '<div class="tabs">' + [['voice', 'Thoại'], ['bank', 'Kho bang']].map((t) => '<button class="' + (T.tab === t[0] ? 'on' : 'g') + '" data-a="tab" data-v="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>';
    if (T.tab === 'voice') {
      const v = T.vc;
      h += '<div class="mut">Thoại nói chuyện trực tiếp giữa trình duyệt của các thành viên (không qua máy chủ). Cần mở game bằng <b>https://</b> hoặc localhost mới dùng được micro; ' + (window.isSecureContext ? '<span style="color:#7ddc8f">trang này hợp lệ.</span>' : '<b style="color:#ff9a8a">trang này đang là http thường nên trình duyệt sẽ chặn micro.</b>') + '</div>';
      if (v.err) h += '<div class="row" style="color:#ff9a8a">' + esc(v.err) + '</div>';
      if (v.room) {
        h += '<div class="row"><span>Đang ở kênh <b>' + (v.room[0] === 'g' ? 'Bang hội' : 'Tổ đội') + '</b> · ' + (v.peers.size + 1) + ' người</span><span><button class="' + (v.muted ? 'on' : 'g') + '" data-a="mute">' + (v.muted ? 'Đang tắt mic' : 'Tắt mic') + '</button><button class="g" data-a="vleave">Rời kênh</button></span></div>';
        h += [...v.peers.values()].map((p) => '<div class="row"><span>' + esc(p.name) + (speaking.has(p.id) ? ' <span style="color:#7ddc8f">● đang nói</span>' : '') + ' <small class="mut">' + esc(p.state || '') + '</small></span><input type="range" min="0" max="1" step="0.1" value="' + p.vol + '" data-a="vol" data-id="' + p.id + '"></div>').join('') || '<div class="mut">Chưa có ai khác trong kênh.</div>';
      } else h += '<div class="row"><span>Tham gia kênh thoại</span><span><button data-a="vjoin" data-r="party">Tổ đội</button><button data-a="vjoin" data-r="guild">Bang hội</button></span></div>';
    } else {
      const b = T.bank, inv = (X && X.P && X.P.inv) || [];
      if (!b || b.none) h += '<div class="mut">Bạn chưa ở trong bang hội.</div>';
      else {
        h += '<div class="mut">Mọi thành viên gửi đồ vào kho. Phó bang lấy tối đa 5 món mỗi ngày, trưởng bang không giới hạn. Bạn là: <b>' + (RANK[b.rank] || '?') + '</b>' + (b.rank === 1 ? ' · còn ' + b.left + ' lượt lấy hôm nay' : '') + '</div>';
        h += '<h4>KHO BANG · ' + b.items.length + '/' + b.cap + '</h4>' + (b.items.length ? b.items.map((e) => '<div class="row"><span><b style="color:' + rc(e.item.rarity) + '">' + esc(e.item.name) + '</b> <small class="mut">' + (IT ? IT.SLOTNAME[e.item.slot] : '') + ' · cấp ' + e.item.ilvl + ' · gửi bởi ' + esc(e.by) + '</small></span><button data-a="gget" data-id="' + e.item.id + '"' + (b.rank < 1 || (b.rank === 1 && b.left <= 0) ? ' disabled' : '') + '>Lấy</button></div>').join('') : '<div class="mut">Kho trống.</div>');
        h += '<h4>GỬI TỪ TÚI CỦA BẠN</h4>' + (inv.length ? inv.map((it) => '<div class="row"><span><b style="color:' + rc(it.rarity) + '">' + esc(it.name) + '</b> <small class="mut">cấp ' + it.ilvl + '</small></span><button class="g" data-a="gput" data-id="' + it.id + '">Gửi vào kho</button></div>').join('') : '<div class="mut">Túi trống.</div>');
        if (b.log.length) h += '<h4>NHẬT KÝ</h4><div class="mut">' + b.log.slice().reverse().map(esc).join('<br>') + '</div>';
      }
    }
    const keep = pn.scrollTop; pn.innerHTML = h; pn.scrollTop = keep;
  };
  pn.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const a = b.dataset.a;
    if (a === 'tab') { T.tab = b.dataset.v; if (T.tab === 'bank') send({ op: 'gbinfo' }); ctl.render(); }
    else if (a === 'gget') send({ op: 'gbget', id: b.dataset.id });
    else if (a === 'gput') send({ op: 'gbput', id: b.dataset.id });
    else if (a === 'vjoin') joinVoice(b.dataset.r);
    else if (a === 'vleave') send({ op: 'vcleave' });
    else if (a === 'mute') { T.vc.muted = !T.vc.muted; if (stream) stream.getAudioTracks().forEach((t) => { t.enabled = !T.vc.muted; }); ctl.render(); }
  });
  pn.addEventListener('input', (e) => { const el = e.target.closest('[data-a="vol"]'); if (!el) return; const p = T.vc.peers.get(Number(el.dataset.id)); if (p) { p.vol = Number(el.value); if (p.audio) p.audio.volume = p.vol; } });

  /* ---------- voice (WebRTC mesh) ---------- */
  let stream = null, actx = null;
  const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
  async function joinVoice(room) {
    T.vc.err = '';
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { T.vc.err = 'Trình duyệt không cho dùng micro ở trang này (cần https:// hoặc localhost).'; return ctl.render(); }
    try { if (!stream) stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }); }
    catch (err) { T.vc.err = 'Không mở được micro: ' + (err && err.message ? err.message : err); return ctl.render(); }
    stream.getAudioTracks().forEach((t) => { t.enabled = !T.vc.muted; });
    send({ op: 'vcjoin', room });
  }
  function watch(id, strm) { // speaking indicator from the audio level
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const an = actx.createAnalyser(); an.fftSize = 512; actx.createMediaStreamSource(strm).connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      const iv = setInterval(() => { an.getByteTimeDomainData(buf); let mx = 0; for (let i = 0; i < buf.length; i++) mx = Math.max(mx, Math.abs(buf[i] - 128)); if (mx > 12 && !(id === 'me' && T.vc.muted)) speaking.add(id === 'me' ? T.meId : id); else speaking.delete(id === 'me' ? T.meId : id); }, 200);
      return iv;
    } catch (err) { return null; }
  }
  function sigTo(id, data) { send({ op: 'vcsig', to: id, data }); }
  function peerOf(id, name, initiator) {
    let p = T.vc.peers.get(id); if (p) return p;
    p = { id, name: name || '#' + id, vol: 1, state: 'đang kết nối', pc: new RTCPeerConnection(ICE), audio: null, iv: null, pend: [] };
    T.vc.peers.set(id, p);
    stream.getTracks().forEach((t) => p.pc.addTrack(t, stream));
    p.pc.onicecandidate = (e) => { if (e.candidate) sigTo(id, { c: e.candidate }); };
    p.pc.ontrack = (e) => {
      if (!p.audio) { p.audio = new Audio(); p.audio.autoplay = true; p.audio.volume = p.vol; }
      p.audio.srcObject = e.streams[0]; p.audio.play().catch(() => { /* needs a user gesture: the join click already counts */ });
      if (!p.iv) p.iv = watch(id, e.streams[0]);
    };
    p.pc.onconnectionstatechange = () => { p.state = ({ connected: 'đã kết nối', connecting: 'đang kết nối', failed: 'lỗi mạng (có thể cần máy chủ TURN)', disconnected: 'mất kết nối' })[p.pc.connectionState] || p.pc.connectionState; ctl.render(); };
    if (initiator) p.pc.onnegotiationneeded = async () => { try { const o = await p.pc.createOffer(); await p.pc.setLocalDescription(o); sigTo(id, { d: p.pc.localDescription }); } catch (err) { console.error('[voice] offer', err); } };
    return p;
  }
  function dropPeer(id) {
    const p = T.vc.peers.get(id); if (!p) return;
    try { p.pc.close(); } catch (err) { /* closed */ } if (p.audio) { p.audio.srcObject = null; } if (p.iv) clearInterval(p.iv);
    speaking.delete(id); T.vc.peers.delete(id);
  }
  function leaveAll() { [...T.vc.peers.keys()].forEach(dropPeer); T.vc.room = null; if (T.selfIv) { clearInterval(T.selfIv); T.selfIv = null; } speaking.clear(); }
  async function onSig(from, data) {
    if (!stream || !T.vc.room) return;
    const p = peerOf(from, null, false);
    try {
      if (data.d) {
        await p.pc.setRemoteDescription(data.d);
        while (p.pend.length) await p.pc.addIceCandidate(p.pend.shift());
        if (data.d.type === 'offer') { const a = await p.pc.createAnswer(); await p.pc.setLocalDescription(a); sigTo(from, { d: p.pc.localDescription }); }
      } else if (data.c) { if (p.pc.remoteDescription) await p.pc.addIceCandidate(data.c); else p.pend.push(data.c); }
    } catch (err) { console.error('[voice] signal', err); }
  }

  T.onNet = function (m) {
    switch (m.t) {
      case 'pframe': T.frame = m.list || []; paintFrame(); return true;
      case 'gbank': T.bank = m; if (ctl.open) ctl.render(); return true;
      case 'vc':
        if (m.st === 'joined') { leaveAll(); T.vc.room = m.room; (m.peers || []).forEach((p) => peerOf(p.id, p.name, true)); H.toast('Đã vào kênh thoại'); }
        else if (m.st === 'peer') { const p = peerOf(m.id, m.name, false); p.name = m.name; }
        else if (m.st === 'gone') dropPeer(m.id);
        else if (m.st === 'left') leaveAll();
        else if (m.st === 'sig') onSig(m.from, m.data || {});
        if (ctl.open) ctl.render(); return true;
      default: return false;
    }
  };
})();
