/* Aetherfall social panel (browser side). Loaded after the main game script.
   It only sends requests and draws what the server answers; all rules are checked on the server.
   Open with the "Xã hội" button or the K key. */
(function () {
  'use strict';
  const H = window.AF_HOOK, IT = window.AF_ITEMS;
  if (!H || !IT) { console.warn('[social] thiếu AF_HOOK hoặc AF_ITEMS, bảng xã hội không bật.'); return; }
  const esc = H.esc;
  const RC = { common: '#d3dae8', rare: '#62bcff', epic: '#cb92ff', legend: '#ffb84d' };
  const STN = { atk: 'ATK', def: 'DEF', hp: 'HP', crit: 'CRIT%', spd: 'SPD%' };
  const TABS = [['party', 'Tổ đội'], ['guild', 'Bang hội'], ['trade', 'Giao dịch'], ['market', 'Chợ'], ['forge', 'Cường hóa'], ['daily', 'Nhiệm vụ'], ['rank', 'Xếp hạng']];
  const S = { open: false, tab: 'party', party: null, guild: undefined, trade: null, tsel: new Set(), tgold: 0,
    market: { browse: null, mine: [], slot: '', rarity: '', page: 0 }, rank: null, daily: null, forgeMsg: '' };

  const send = (m) => H.NET.send(m);
  const myName = () => { const n = H.NET.me || {}; return n.name || n.username || ''; };
  const P = () => H.getP() || { inv: [], eq: {}, gold: 0, level: 1 };
  const statTxt = (it) => Object.keys(it.stats || {}).map((k) => (STN[k] || k) + '+' + it.stats[k]).join(' ');
  const itemHtml = (it) => '<b style="color:' + RC[it.rarity] + '">' + esc(it.name) + '</b> <small>' + esc(IT.SLOTNAME[it.slot]) + ' · Lv' + it.ilvl + ' · ' + esc(statTxt(it)) + '</small>';
  const num = (n) => Number(n || 0).toLocaleString('vi-VN');

  /* ---------- styles + DOM ---------- */
  const css = document.createElement('style');
  css.textContent = `
  #afBtn{position:fixed;left:10px;top:46%;z-index:40;border:2px solid #241a05;background:#f0bf4c;color:#241a05;font:700 13px system-ui,sans-serif;padding:8px 12px;border-radius:12px;cursor:pointer;box-shadow:0 3px 0 #241a05}
  #afBtn[hidden],#afParty[hidden],#afSoc[hidden]{display:none}
  #afParty{position:fixed;left:10px;top:calc(46% + 48px);z-index:40;min-width:150px;background:rgba(20,28,56,.86);color:#eef3ff;border:2px solid #241a05;border-radius:12px;padding:8px 10px;font:12px system-ui,sans-serif}
  #afParty b.l{color:#ffd96a}
  #afNotes{position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:60;display:grid;gap:8px;width:min(92vw,360px)}
  .afnote{background:#fff7da;color:#241a05;border:2px solid #241a05;border-radius:12px;padding:10px 12px;font:13px system-ui,sans-serif;box-shadow:0 4px 0 rgba(0,0,0,.35)}
  .afnote .acts{display:flex;gap:8px;margin-top:8px}
  #afSoc{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:55;width:min(96vw,600px);max-height:84vh;display:flex;flex-direction:column;background:rgba(18,26,52,.97);color:#eef3ff;border:3px solid #241a05;border-radius:16px;box-shadow:0 10px 0 rgba(0,0,0,.35);font:13px/1.45 system-ui,sans-serif}
  #afSoc header{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.14)}
  #afSoc header h3{margin:0;font-size:16px}
  #afTabs{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.1)}
  #afTabs button{background:rgba(255,255,255,.08);color:#eef3ff;border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:5px 12px;cursor:pointer;font:600 12px system-ui,sans-serif}
  #afTabs button[aria-pressed=true]{background:#f0bf4c;color:#241a05;border-color:#241a05}
  #afBody{padding:12px 14px;overflow:auto}
  #afSoc button.af,.afnote button{background:#f0bf4c;color:#241a05;border:2px solid #241a05;border-radius:9px;padding:5px 11px;font:700 12px system-ui,sans-serif;cursor:pointer}
  #afSoc button.af.g,.afnote button.g{background:#e9edf8}
  #afSoc button.af.r{background:#ff8c82}
  #afSoc button.af:disabled{opacity:.45;cursor:default}
  #afSoc input[type=text],#afSoc input[type=number],#afSoc select{background:#0c1330;color:#eef3ff;border:1px solid rgba(255,255,255,.25);border-radius:8px;padding:6px 8px;font:13px system-ui,sans-serif;min-width:0}
  #afSoc h4{margin:14px 0 6px;font-size:13px;color:#ffd96a;letter-spacing:.04em}
  #afSoc h4:first-child{margin-top:0}
  .afrow{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:6px 0}
  .afrow>input{flex:1;min-width:110px}
  .afit{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:6px 8px;border-radius:9px;background:rgba(255,255,255,.06);margin:4px 0}
  .afit>span{min-width:0}
  .afit label{display:flex;gap:8px;align-items:center}
  .afn{color:#aab6d8;margin:6px 0}
  .afbar{height:8px;border-radius:6px;background:rgba(255,255,255,.14);overflow:hidden;margin-top:4px}
  .afbar i{display:block;height:100%;background:#79d08a}
  .afdot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#667;margin-right:6px}
  .afdot.on{background:#79d08a}
  .afcols{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  @media(max-width:520px){.afcols{grid-template-columns:1fr}}
  .cl.party{color:#7be3ff}.cl.guild{color:#8dff9a}.cl.emote{color:#ffd96a;font-style:italic}`;
  document.head.appendChild(css);

  const root = document.createElement('div'); root.id = 'afSoc'; root.hidden = true;
  root.innerHTML = '<header><h3>Xã hội</h3><button class="af g" data-act="close" type="button">Đóng (K)</button></header><div id="afTabs"></div><div id="afBody"></div>';
  const btn = document.createElement('button'); btn.id = 'afBtn'; btn.type = 'button'; btn.textContent = 'Xã hội (K)'; btn.hidden = true;
  const partyHud = document.createElement('div'); partyHud.id = 'afParty'; partyHud.hidden = true;
  const notes = document.createElement('div'); notes.id = 'afNotes';
  document.body.append(root, btn, partyHud, notes);
  const body = root.querySelector('#afBody'), tabsEl = root.querySelector('#afTabs');
  ['keydown', 'keyup'].forEach((ev) => root.addEventListener(ev, (e) => e.stopPropagation()));
  [root, partyHud, notes, btn].forEach((el) => ['pointerdown', 'mousedown'].forEach((ev) => el.addEventListener(ev, (e) => e.stopPropagation())));

  /* ---------- views ---------- */
  const val = (id) => { const e = body.querySelector('#' + id); return e ? e.value.trim() : ''; };
  const rankName = ['Thành viên', 'Phó bang', 'Trưởng bang'];

  function vParty() {
    const pt = S.party; let h = '<h4>TỔ ĐỘI</h4>';
    if (!pt) h += '<p class="afn">Bạn chưa có tổ đội. Tối đa 4 người; đánh quái gần nhau sẽ chia chung EXP, vàng, đồ và nhận thêm 8% EXP cho mỗi đồng đội. Nhiệm vụ boss cũng tính cho cả tổ.</p>';
    else {
      const lead = pt.leader === meId();
      pt.members.forEach((m) => {
        h += '<div class="afit"><span><span class="afdot on"></span><b>' + esc(m.name) + '</b> <small>cấp ' + m.level + (m.id === pt.leader ? ' · đội trưởng' : '') + '</small></span><span>' +
          (lead && m.id !== pt.leader ? '<button class="af g" data-act="p-lead" data-name="' + esc(m.name) + '">Nhường</button> <button class="af r" data-act="p-kick" data-name="' + esc(m.name) + '">Mời ra</button>' : '') + '</span></div>';
      });
      h += '<div class="afrow"><button class="af r" data-act="p-leave">Rời tổ đội</button></div>';
    }
    if (!pt || pt.leader === meId()) h += '<div class="afrow"><input type="text" id="afPInv" data-keep placeholder="Tên người chơi online" maxlength="20"><button class="af" data-act="p-invite">Mời vào tổ đội</button></div>';
    h += '<p class="afn">Chat tổ đội: gõ <b>/p nội dung</b> trong khung chat.</p>';
    return h;
  }
  function meId() { const n = H.NET.me || {}; return n.id; }

  function vGuild() {
    const g = S.guild;
    if (g === undefined) return '<p class="afn">Đang tải...</p>';
    if (!g) return '<h4>BANG HỘI</h4><p class="afn">Bạn chưa ở trong bang nào. Lập bang cần cấp 5 và 500 vàng, hoặc nhờ trưởng bang mời bạn (lời mời sẽ hiện ở đầu màn hình).</p>' +
      '<div class="afrow"><input type="text" id="afGName" data-keep placeholder="Tên bang (3-16 ký tự)" maxlength="16"><button class="af" data-act="g-create">Lập bang (500 vàng)</button></div>';
    const me = g.members.find((m) => m.name === myName()) || { rank: 0 };
    let h = '<h4>BANG ' + esc(g.name.toUpperCase()) + ' · CẤP ' + g.level + '</h4>';
    h += '<div class="afn">Quỹ bang: <b>' + num(g.funds) + '</b>' + (g.next ? ' / ' + num(g.next) + ' để lên cấp ' + (g.level + 1) : ' (cấp tối đa)') + ' · Thành viên ' + g.members.length + '/' + g.cap + ' · Thưởng EXP +' + g.level * 2 + '%</div>';
    if (g.next) h += '<div class="afbar"><i style="width:' + Math.min(100, g.funds / g.next * 100).toFixed(0) + '%"></i></div>';
    h += '<div class="afn">Lời nhắn: ' + (g.motd ? esc(g.motd) : '<i>chưa có</i>') + '</div>';
    if (me.rank >= 1) h += '<div class="afrow"><input type="text" id="afGMotd" data-keep placeholder="Đặt lời nhắn bang" maxlength="100"><button class="af g" data-act="g-motd">Lưu</button></div>';
    h += '<h4>THÀNH VIÊN</h4>';
    g.members.forEach((m) => {
      let acts = '';
      if (m.name !== myName()) {
        if (me.rank === 2) acts += (m.rank === 0 ? '<button class="af g" data-act="g-promote" data-name="' + esc(m.name) + '">Phong phó</button> ' : m.rank === 1 ? '<button class="af g" data-act="g-demote" data-name="' + esc(m.name) + '">Hạ</button> ' : '') +
          '<button class="af g" data-act="g-lead" data-name="' + esc(m.name) + '">Nhường</button> ';
        if (me.rank > m.rank) acts += '<button class="af r" data-act="g-kick" data-name="' + esc(m.name) + '">Mời ra</button>';
      }
      h += '<div class="afit"><span><span class="afdot' + (m.online ? ' on' : '') + '"></span><b>' + esc(m.name) + '</b> <small>cấp ' + m.level + ' · ' + rankName[m.rank] + ' · góp ' + num(m.contrib) + '</small></span><span>' + acts + '</span></div>';
    });
    h += '<h4>HOẠT ĐỘNG</h4><div class="afrow"><input type="number" id="afGDon" data-keep min="1" placeholder="Số vàng quyên góp"><button class="af" data-act="g-donate">Quyên góp</button></div>';
    if (me.rank >= 1) h += '<div class="afrow"><input type="text" id="afGInv" data-keep placeholder="Tên người chơi online" maxlength="20"><button class="af" data-act="g-invite">Mời vào bang</button></div>';
    h += '<div class="afrow"><button class="af r" data-act="g-leave">Rời bang</button>' + (me.rank === 2 ? '<button class="af r" data-act="g-disband">Giải tán bang</button>' : '') + '</div>';
    h += '<p class="afn">Chat bang: gõ <b>/g nội dung</b> trong khung chat.</p>';
    return h;
  }

  function vTrade() {
    const t = S.trade;
    if (!t) return '<h4>GIAO DỊCH</h4><p class="afn">Mời một người chơi đứng gần bạn (trong 20m). Hai bên cùng đặt đồ và vàng, cùng khóa, rồi cùng xác nhận thì máy chủ mới đổi.</p>' +
      '<div class="afrow"><input type="text" id="afTName" data-keep placeholder="Tên người chơi" maxlength="20"><button class="af" data-act="t-req">Mời giao dịch</button></div>';
    const inv = P().inv || [];
    let h = '<h4>GIAO DỊCH VỚI ' + esc(t.with.toUpperCase()) + '</h4><div class="afcols"><div><h4>ĐỀ NGHỊ CỦA BẠN' + (t.mine.lock ? ' (đã khóa)' : '') + '</h4>';
    h += '<div class="afrow"><label>Vàng <input type="number" id="afTGold" data-keep min="0" value="' + S.tgold + '" style="width:110px"></label></div>';
    h += inv.length ? inv.map((it) => '<div class="afit"><label><input type="checkbox" data-sel="' + esc(it.id) + '"' + (S.tsel.has(it.id) ? ' checked' : '') + '><span>' + itemHtml(it) + '</span></label></div>').join('') : '<p class="afn">Túi đồ trống.</p>';
    h += '<div class="afrow"><button class="af g" data-act="t-offer">Cập nhật đề nghị</button></div></div>';
    h += '<div><h4>ĐỀ NGHỊ CỦA ' + esc(t.with.toUpperCase()) + (t.theirs.lock ? ' (đã khóa)' : '') + '</h4><div class="afn">Vàng: <b>' + num(t.theirs.gold) + '</b></div>';
    h += t.theirs.items.length ? t.theirs.items.map((it) => '<div class="afit"><span>' + itemHtml(it) + '</span></div>').join('') : '<p class="afn">(chưa có đồ)</p>';
    h += '</div></div>';
    h += '<div class="afrow"><button class="af" data-act="t-lock"' + (t.mine.lock ? ' disabled' : '') + '>Khóa đề nghị</button><button class="af" data-act="t-confirm"' + (t.mine.lock && t.theirs.lock && !t.mine.ok ? '' : ' disabled') + '>' + (t.mine.ok ? 'Đã xác nhận, chờ đối phương' : 'Xác nhận') + '</button><button class="af r" data-act="t-cancel">Hủy</button></div>';
    h += '<p class="afn">Mỗi lần đổi đề nghị, hai bên phải khóa và xác nhận lại.</p>';
    return h;
  }

  function vMarket() {
    const mk = S.market; let h = '<h4>CHỢ NGƯỜI CHƠI</h4><p class="afn">Giá thấp lên trước. Người bán chịu thuế 5%, tiền gửi về thư (nhận ngay khi bạn online). Đồ hết hạn sau 72 giờ sẽ được trả lại.</p>';
    h += '<div class="afrow"><select id="afMSlot" data-keep><option value="">Mọi loại</option>' + IT.SLOTS.map((s) => '<option value="' + s + '"' + (mk.slot === s ? ' selected' : '') + '>' + IT.SLOTNAME[s] + '</option>').join('') + '</select>' +
      '<select id="afMRar" data-keep><option value="">Mọi độ hiếm</option>' + IT.RAR.map((r) => '<option value="' + r + '"' + (mk.rarity === r ? ' selected' : '') + '>' + IT.RNAME[r] + '</option>').join('') + '</select><button class="af g" data-act="m-filter">Lọc</button></div>';
    const b = mk.browse;
    if (!b) h += '<p class="afn">Đang tải...</p>';
    else {
      h += b.list.length ? b.list.map((r) => '<div class="afit"><span>' + itemHtml(r.item) + '<br><small>Người bán: ' + esc(r.seller) + '</small></span><span><b>' + num(r.price) + '</b> vàng <button class="af" data-act="m-buy" data-id="' + r.id + '">Mua</button></span></div>').join('') : '<p class="afn">Chưa có món nào.</p>';
      h += '<div class="afrow"><button class="af g" data-act="m-prev"' + (b.page <= 0 ? ' disabled' : '') + '>Trước</button> Trang ' + (b.page + 1) + '/' + b.pages + ' <button class="af g" data-act="m-next"' + (b.page + 1 >= b.pages ? ' disabled' : '') + '>Sau</button></div>';
    }
    h += '<h4>ĐĂNG BÁN</h4><div class="afrow"><select id="afMItem" data-keep>' + ((P().inv || []).map((it) => '<option value="' + esc(it.id) + '">' + esc(it.name) + ' (Lv' + it.ilvl + ')</option>').join('') || '<option value="">Túi trống</option>') + '</select>' +
      '<input type="number" id="afMPrice" data-keep min="1" placeholder="Giá (vàng)" style="max-width:130px"><button class="af" data-act="m-sell">Đăng bán</button></div>';
    h += '<h4>MÓN ĐANG ĐĂNG CỦA BẠN</h4>' + (mk.mine.length ? mk.mine.map((r) => '<div class="afit"><span>' + itemHtml(r.item) + '</span><span><b>' + num(r.price) + '</b> <button class="af g" data-act="m-cancel" data-id="' + r.id + '">Gỡ</button></span></div>').join('') : '<p class="afn">Chưa đăng món nào.</p>');
    return h;
  }

  function vForge() {
    const pl = P(); const rows = [];
    IT.SLOTS.forEach((s) => { if (pl.eq && pl.eq[s]) rows.push(['Đang mặc', pl.eq[s]]); });
    (pl.inv || []).forEach((it) => rows.push(['Trong túi', it]));
    let h = '<h4>CƯỜNG HÓA</h4><p class="afn">Vàng hiện có: <b>' + num(pl.gold) + '</b>. Tốn vàng mỗi lần, dù thành công hay không. Từ +5 trở lên, thất bại sẽ tụt 1 cấp. Tối đa +' + IT.MAX_ENH + '.</p>';
    if (S.forgeMsg) h += '<div class="afnote" style="margin:6px 0">' + S.forgeMsg + '</div>';
    if (!rows.length) return h + '<p class="afn">Bạn chưa có trang bị nào.</p>';
    rows.forEach(([where, it]) => {
      const e = it.enh || 0, max = e >= IT.MAX_ENH;
      const nx = max ? '' : '<br><small>Lên +' + (e + 1) + ': ' + esc(statTxt({ stats: IT.statsFor(it.slot, it.rarity, it.ilvl, e + 1) })) + ' · tỉ lệ ' + Math.round(IT.enhChance(e) * 100) + '% · ' + num(IT.enhCost(it)) + ' vàng</small>';
      h += '<div class="afit"><span><small>' + where + '</small><br>' + itemHtml(it) + nx + '</span><span>' + (max ? '<small>Tối đa</small>' : '<button class="af" data-act="f-enh" data-id="' + esc(it.id) + '"' + (pl.gold < IT.enhCost(it) ? ' disabled' : '') + '>Cường hóa</button>') + '</span></div>';
    });
    return h;
  }

  function vDaily() {
    const d = S.daily; if (!d) return '<p class="afn">Đang tải...</p>';
    let h = '<h4>ĐIỂM DANH · CHUỖI ' + d.streak + ' NGÀY</h4><div class="afit"><span>Quà hôm nay: ' + num(d.loginReward.gold) + ' vàng, ' + d.loginReward.potions + ' bình máu</span><span><button class="af" data-act="d-login"' + (d.loginClaimed ? ' disabled' : '') + '>' + (d.loginClaimed ? 'Đã nhận' : 'Nhận quà') + '</button></span></div>';
    h += '<h4>NHIỆM VỤ NGÀY (làm mới 00:00 giờ Việt Nam)</h4>';
    d.dq.forEach((q) => {
      const rw = [q.reward.exp ? q.reward.exp + ' EXP' : '', q.reward.gold ? q.reward.gold + ' vàng' : '', q.reward.potions ? q.reward.potions + ' bình máu' : ''].filter(Boolean).join(', ');
      h += '<div class="afit"><span><b>' + esc(q.title) + '</b> <small>' + esc(q.desc) + ' · ' + q.prog + '/' + q.need + ' · thưởng ' + rw + '</small><div class="afbar"><i style="width:' + (q.prog / q.need * 100) + '%"></i></div></span><span><button class="af" data-act="d-claim" data-id="' + q.id + '"' + (q.claimed || q.prog < q.need ? ' disabled' : '') + '>' + (q.claimed ? 'Đã nhận' : 'Nhận') + '</button></span></div>';
    });
    h += '<h4>THÀNH TỰU · ' + d.ach.filter((a) => a.done).length + '/' + d.ach.length + '</h4>';
    d.ach.forEach((a) => { h += '<div class="afit"><span style="opacity:' + (a.done ? 1 : .6) + '"><b>' + (a.done ? '✔ ' : '') + esc(a.title) + '</b> <small>' + esc(a.desc) + '</small></span></div>'; });
    return h;
  }

  function vRank() {
    const r = S.rank; if (!r) return '<p class="afn">Đang tải...</p>';
    const list = (arr, f) => arr.length ? arr.map((x, i) => '<div class="afit"><span>' + (i + 1) + '. <b>' + esc(x.name) + '</b></span><span><small>' + f(x) + '</small></span></div>').join('') : '<p class="afn">Chưa có dữ liệu.</p>';
    return '<h4>TOP CẤP ĐỘ</h4>' + list(r.level, (x) => 'cấp ' + x.level) + '<h4>TOP GIÀU NHẤT</h4>' + list(r.gold, (x) => num(x.gold) + ' vàng') + '<h4>TOP BANG HỘI</h4>' + list(r.guilds, (x) => 'cấp ' + x.level + ' · ' + x.members + ' người · quỹ ' + num(x.funds));
  }

  const VIEWS = { party: vParty, guild: vGuild, trade: vTrade, market: vMarket, forge: vForge, daily: vDaily, rank: vRank };
  function render() {
    renderHud();
    if (!S.open) return;
    tabsEl.innerHTML = TABS.map(([k, n]) => '<button type="button" data-act="tab" data-tab="' + k + '" aria-pressed="' + (S.tab === k) + '">' + n + '</button>').join('');
    const keep = {}; body.querySelectorAll('[data-keep]').forEach((e) => { keep[e.id] = e.value; });
    const act = document.activeElement && document.activeElement.id;
    const st = body.scrollTop;
    body.innerHTML = VIEWS[S.tab]();
    body.querySelectorAll('[data-keep]').forEach((e) => { if (keep[e.id] !== undefined && keep[e.id] !== '' && e.tagName === 'INPUT') e.value = keep[e.id]; if (keep[e.id] !== undefined && e.tagName === 'SELECT' && e.id === 'afMItem') e.value = keep[e.id]; });
    if (act) { const e = body.querySelector('#' + act); if (e) e.focus(); }
    body.scrollTop = st;
  }
  function renderHud() {
    const running = H.isRunning();
    btn.hidden = !running;
    if (!running || !S.party) { partyHud.hidden = true; return; }
    partyHud.hidden = false;
    partyHud.innerHTML = '<b>Tổ đội</b>' + S.party.members.map((m) => '<div>' + (m.id === S.party.leader ? '<b class="l">★</b> ' : '') + esc(m.name) + ' <small>Lv' + m.level + '</small></div>').join('');
  }

  /* ---------- open / tabs ---------- */
  function load(tab) {
    if (tab === 'market') { send({ t: 'market', op: 'browse', page: S.market.page, slot: S.market.slot, rarity: S.market.rarity }); send({ t: 'market', op: 'mine' }); }
    else if (tab === 'rank') send({ t: 'rank' });
    else if (tab === 'daily') send({ t: 'daily', op: 'info' });
    else if (tab === 'guild' && S.guild === undefined) send({ t: 'guild', op: 'info' });
  }
  function open(tab) { if (tab) S.tab = tab; S.open = true; root.hidden = false; load(S.tab); render(); }
  function close() { S.open = false; root.hidden = true; }
  btn.addEventListener('click', () => (S.open ? close() : open()));
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'k' && e.key !== 'K') return;
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (!H.isRunning() || e.ctrlKey || e.metaKey || e.altKey) return;
    S.open ? close() : open();
  });

  /* ---------- actions ---------- */
  function toNum(id) { const v = Number(val(id)); return Number.isFinite(v) ? Math.floor(v) : 0; }
  const ACTIONS = {
    close, tab: (d) => { S.tab = d.tab; load(d.tab); render(); },
    'p-invite': () => { const n = val('afPInv'); if (n) send({ t: 'party', op: 'invite', name: n }); },
    'p-leave': () => send({ t: 'party', op: 'leave' }),
    'p-kick': (d) => send({ t: 'party', op: 'kick', name: d.name }),
    'p-lead': (d) => send({ t: 'party', op: 'lead', name: d.name }),
    'g-create': () => { const n = val('afGName'); if (n) send({ t: 'guild', op: 'create', name: n }); },
    'g-invite': () => { const n = val('afGInv'); if (n) send({ t: 'guild', op: 'invite', name: n }); },
    'g-leave': () => { if (confirm('Rời bang hội?')) send({ t: 'guild', op: 'leave' }); },
    'g-disband': () => { if (confirm('Giải tán bang? Không thể hoàn tác.')) send({ t: 'guild', op: 'disband' }); },
    'g-kick': (d) => { if (confirm('Mời ' + d.name + ' ra khỏi bang?')) send({ t: 'guild', op: 'kick', name: d.name }); },
    'g-promote': (d) => send({ t: 'guild', op: 'promote', name: d.name }),
    'g-demote': (d) => send({ t: 'guild', op: 'demote', name: d.name }),
    'g-lead': (d) => { if (confirm('Nhường chức trưởng bang cho ' + d.name + '?')) send({ t: 'guild', op: 'lead', name: d.name }); },
    'g-donate': () => { const a = toNum('afGDon'); if (a > 0) send({ t: 'guild', op: 'donate', amount: a }); },
    'g-motd': () => send({ t: 'guild', op: 'motd', text: val('afGMotd') }),
    't-req': () => { const n = val('afTName'); if (n) send({ t: 'trade', op: 'request', name: n }); },
    't-offer': () => { S.tgold = Math.max(0, toNum('afTGold')); send({ t: 'trade', op: 'offer', gold: S.tgold, items: [...S.tsel] }); },
    't-lock': () => send({ t: 'trade', op: 'lock' }),
    't-confirm': () => send({ t: 'trade', op: 'confirm' }),
    't-cancel': () => send({ t: 'trade', op: 'cancel' }),
    'm-filter': () => { S.market.slot = val('afMSlot'); S.market.rarity = val('afMRar'); S.market.page = 0; load('market'); },
    'm-prev': () => { S.market.page = Math.max(0, S.market.page - 1); load('market'); },
    'm-next': () => { S.market.page++; load('market'); },
    'm-buy': (d) => send({ t: 'market', op: 'buy', id: Number(d.id), page: S.market.page, slot: S.market.slot, rarity: S.market.rarity }),
    'm-cancel': (d) => send({ t: 'market', op: 'cancel', id: Number(d.id) }),
    'm-sell': () => { const id = val('afMItem'), price = toNum('afMPrice'); if (id && price > 0) send({ t: 'market', op: 'list', id, price }); },
    'f-enh': (d) => send({ t: 'enhance', id: d.id }),
    'd-login': () => send({ t: 'daily', op: 'login' }),
    'd-claim': (d) => send({ t: 'daily', op: 'claim', id: d.id })
  };
  root.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; const f = ACTIONS[b.dataset.act]; if (f) f(b.dataset); });
  body.addEventListener('change', (e) => {
    const c = e.target; if (c.dataset && c.dataset.sel !== undefined) { if (c.checked) S.tsel.add(c.dataset.sel); else S.tsel.delete(c.dataset.sel); }
  });

  /* ---------- invitations ---------- */
  function note(html, yes, no) {
    const d = document.createElement('div'); d.className = 'afnote';
    d.innerHTML = '<div>' + html + '</div><div class="acts"><button type="button" data-y>Đồng ý</button><button type="button" class="g" data-n>Từ chối</button></div>';
    const done = () => d.remove();
    d.querySelector('[data-y]').onclick = () => { send(yes); done(); };
    d.querySelector('[data-n]').onclick = () => { send(no); done(); };
    notes.appendChild(d); setTimeout(done, 45000);
  }
  function banner(html) {
    const d = document.createElement('div'); d.className = 'afnote'; d.innerHTML = html; notes.appendChild(d); setTimeout(() => d.remove(), 5000);
  }

  /* ---------- network ---------- */
  function onNet(m) {
    switch (m.t) {
      case 'me': setTimeout(render, 0); return false; // let the game update its state first
      case 'party': S.party = m.party; render(); return true;
      case 'pinv': note('<b>' + esc(m.from) + '</b> mời bạn vào tổ đội.', { t: 'party', op: 'accept' }, { t: 'party', op: 'decline' }); return true;
      case 'pchat': H.chatLine('party', '<b>[Tổ đội] ' + esc(m.from) + '</b>: ' + esc(m.text)); return true;
      case 'guild': S.guild = m.guild; render(); return true;
      case 'ginv': note('<b>' + esc(m.from) + '</b> mời bạn vào bang <b>' + esc(m.guild) + '</b>.', { t: 'guild', op: 'accept' }, { t: 'guild', op: 'decline' }); return true;
      case 'gchat': H.chatLine('guild', '<b>[Bang] ' + esc(m.from) + '</b>: ' + esc(m.text)); return true;
      case 'treq': note('<b>' + esc(m.from) + '</b> muốn giao dịch với bạn.', { t: 'trade', op: 'accept' }, { t: 'trade', op: 'decline' }); return true;
      case 'trade': {
        S.trade = m.st;
        if (m.st) { S.tsel = new Set(m.st.mine.items.map((i) => i.id)); S.tgold = m.st.mine.gold; if (!S.open || S.tab !== 'trade') open('trade'); }
        else { S.tsel = new Set(); S.tgold = 0; }
        render(); return true; }
      case 'market':
        if (m.kind === 'browse') { S.market.browse = m; S.market.page = m.page; } else S.market.mine = m.list;
        render(); return true;
      case 'enh':
        S.forgeMsg = m.ok ? 'Thành công! <b>' + esc(m.name) + '</b> (+' + m.enh + ')' : 'Thất bại' + (m.lost ? ', tụt xuống +' + m.enh : '') + '. Mất ' + num(m.cost) + ' vàng.';
        render(); return true;
      case 'rank': S.rank = m; render(); return true;
      case 'daily': S.daily = m; render(); return true;
      case 'ach': banner('<b>Thành tựu mới:</b> ' + esc(m.title) + '<br><small>+' + esc(m.reward) + '</small>'); return true;
      case 'emote': H.chatLine('emote', '* ' + esc(m.name) + ' ' + esc(m.text)); return true;
      default: return false;
    }
  }

  /* ---------- chat commands ---------- */
  const EMOTES = ['wave', 'dance', 'laugh', 'cry', 'cheer', 'bow', 'sleep'];
  function cmd(c, parts) {
    const text = parts.join(' ');
    switch (c) {
      case 'p': case 'party': if (!text) { open('party'); return true; } send({ t: 'pchat', text }); return true;
      case 'g': case 'guild': if (!text) { open('guild'); return true; } send({ t: 'gchat', text }); return true;
      case 'moi': case 'invite': if (parts[0]) send({ t: 'party', op: 'invite', name: parts[0] }); else H.chatLine('sys', 'Cách dùng: /moi tên'); return true;
      case 'roi': send({ t: 'party', op: 'leave' }); return true;
      case 'trade': case 'gd': if (parts[0]) send({ t: 'trade', op: 'request', name: parts[0] }); else open('trade'); return true;
      case 'cho': case 'market': open('market'); return true;
      case 'top': case 'rank': open('rank'); return true;
      case 'e': case 'emote':
        if (EMOTES.includes(parts[0])) send({ t: 'emote', e: parts[0] }); else H.chatLine('sys', 'Biểu cảm: ' + EMOTES.join(', ') + ' (ví dụ /e wave)'); return true;
      case 'help': H.chatLine('sys', 'Xã hội (phím K): /p chat tổ đội · /g chat bang · /moi tên · /roi · /gd tên (giao dịch) · /cho · /top · /e wave'); return false;
      default: return false;
    }
  }

  window.AF_SOCIAL = { onNet, cmd, open, close };
  setInterval(renderHud, 1000);
  renderHud();
})();
