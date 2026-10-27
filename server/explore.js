'use strict';
/* Aetherfall step 5 (server plugin of zones.js): exploration.
   Fog of war (per player), waypoints + fast travel (costs gold), lookout points (first visit = EXP), 12 hidden ancient steles (lore, the
   "hidden ending" counter), random world events (falling-star shards) and the shared weather. Day/night is computed by the browser
   from the clock (1 real hour = 1 game day). Saved in its own table so game.js never touches it. */
let C = null, API = null;
const GRID = 27, CELL = 8;           // 27 x 27 cells of 8 m cover the 216 m wide world
const OFF = 108;
const WP = [
  { id: 1, name: 'Làng Ashford', x: 0, z: 9 }, { id: 2, name: 'Rừng Bóng Đèn', x: 55, z: 50 }, { id: 3, name: 'Đấu trường', x: 62, z: -58 },
  { id: 4, name: 'Đầm Lầy Nấm Độc', x: -62, z: -30 }, { id: 5, name: 'Mỏ Quặng Gỉ Sét', x: -20, z: -72 }, { id: 6, name: 'Cánh Đồng Tủ Lạnh', x: -55, z: 62 },
  { id: 7, name: 'Bãi Tế Thần', x: 78, z: 2 }, { id: 8, name: 'Cổng Hầm Ngục', x: -6, z: -24 }
];
const LOOK = [
  { id: 1, name: 'Đài quan sát Đông Bắc', x: 36, z: 34, r: 46 }, { id: 2, name: 'Đài quan sát Tây', x: -40, z: 8, r: 46 },
  { id: 3, name: 'Đài quan sát Nam', x: 20, z: -48, r: 46 }, { id: 4, name: 'Đài quan sát Bắc', x: -8, z: 60, r: 46 }
];
const LORE = [
  'Bia khắc: "Sáu vì sao cùng soi, một vì sao sẽ rơi."', 'Bia khắc: "Morvain đã hỏi sao: thần là gì? Sao không trả lời."', 'Bia khắc: "Tro không phải lời nguyền. Tro là trí nhớ của sao."',
  'Bia khắc: "Người mang vết sao sẽ nghe được tiếng sao thì thầm."', 'Bia khắc: "Năm sao ghép phong ấn, một sao giữ chìa."', 'Bia khắc: "Aldric từng hứa chôn mình cùng ngai vàng."',
  'Bia khắc: "Dưới Vực Thẳm có cánh cửa chỉ mở bằng ánh sáng."', 'Bia khắc: "Elf hát cho cây, người lùn gõ vào đá, orc thét cho gió."', 'Bia khắc: "Kẻ phản bội cũng từng là người bảo vệ."',
  'Bia khắc: "Mảnh sao nhỏ nhất nặng nhất khi bị giữ lại."', 'Bia khắc: "Hoàng tử sẽ trở về khi sao đỏ mọc ở phương Đông."', 'Bia khắc: "Mười hai bia, một lời: hãy phong ấn bằng chính mình."'
];
const STELE = (function () { let s = 90210; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; const o = []; for (let i = 0; i < 12; i++) { const a = r() * 6.283, d = 25 + r() * 70; o.push({ id: i + 1, x: +(Math.cos(a) * d).toFixed(1), z: +(Math.sin(a) * d).toFixed(1) }); } return o; })();

/* ---------- weather ---------- */
const WEATHER = { clear: 5, rain: 2, storm: 1, fog: 2 };
let weather = { w: 'clear', until: 0 };
function pickWeather() {
  const tot = Object.keys(WEATHER).reduce((s, k) => s + WEATHER[k], 0); let r = Math.random() * tot, w = 'clear';
  for (const k of Object.keys(WEATHER)) { r -= WEATHER[k]; if (r <= 0) { w = k; break; } }
  weather = { w, until: Date.now() + (5 + Math.random() * 7) * 60000 };
  C.broadcast({ t: 'weather', w: weather.w, left: Math.round((weather.until - Date.now()) / 1000) });
}

/* ---------- per-player data ---------- */
function blank() { return { fog: new Array(GRID).fill(0), wp: [1], lk: [], st: [], dirty: false, sent: 0 }; }
function load(p) {
  const z = blank();
  try {
    const r = API.db.get('SELECT data FROM explore_player WHERE user_id = ?', p.id);
    if (r) {
      const d = JSON.parse(r.data);
      if (Array.isArray(d.fog)) for (let i = 0; i < GRID; i++) z.fog[i] = (d.fog[i] | 0) >>> 0;
      const ids = (a, max) => (Array.isArray(a) ? [...new Set(a.map(Number).filter((x) => x >= 1 && x <= max))] : []);
      z.wp = [...new Set([1, ...ids(d.wp, WP.length)])]; z.lk = ids(d.lk, LOOK.length); z.st = ids(d.st, 12);
    }
  } catch (err) { console.error('explore load', err.message); }
  p.ex = z;
}
function save(p) {
  if (!p.ex) return;
  API.db.run('INSERT INTO explore_player (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data', p.id, JSON.stringify({ fog: p.ex.fog, wp: p.ex.wp, lk: p.ex.lk, st: p.ex.st }));
  p.ex.dirty = false;
}
const cellOf = (v) => Math.max(0, Math.min(GRID - 1, Math.floor((v + OFF) / CELL)));
function reveal(p, x, z, r) {
  let changed = false; const e = p.ex;
  for (let cz = cellOf(z - r); cz <= cellOf(z + r); cz++) for (let cx = cellOf(x - r); cx <= cellOf(x + r); cx++) {
    const px = cx * CELL - OFF + CELL / 2, pz = cz * CELL - OFF + CELL / 2;
    if (Math.hypot(px - x, pz - z) > r + CELL * 0.5) continue;
    if (!(e.fog[cz] & (1 << cx))) { e.fog[cz] = (e.fog[cz] | (1 << cx)) >>> 0; changed = true; }
  }
  if (changed) e.dirty = true;
  return changed;
}
const pct = (e) => { let n = 0; for (let z = 0; z < GRID; z++) for (let x = 0; x < GRID; x++) if (e.fog[z] & (1 << x)) n++; return Math.round(n / (GRID * GRID) * 100); };
const sendFog = (p) => { p.ex.sent = Date.now(); API.C.send(p, { t: 'fog', rows: p.ex.fog, pct: pct(p.ex) }); };
const sendState = (p) => API.C.send(p, { t: 'xinfo', wp: p.ex.wp, lk: p.ex.lk, st: p.ex.st, wps: WP, looks: LOOK.map((l) => ({ id: l.id, name: l.name, x: l.x, z: l.z })), steles: STELE, tm: Date.now(), weather: { w: weather.w, left: Math.round((weather.until - Date.now()) / 1000) } });

/* ---------- random world event: falling-star shard ---------- */
let rev = null, nextRev = Date.now() + 6 * 60000;
function spawnRev() {
  const a = Math.random() * 6.283, d = 20 + Math.random() * 75;
  rev = { id: Date.now(), x: +(Math.cos(a) * d).toFixed(1), z: +(Math.sin(a) * d).toFixed(1), until: Date.now() + 5 * 60000 };
  C.broadcast({ t: 'rev', on: 1, id: rev.id, x: rev.x, z: rev.z, left: 300 });
  C.broadcast({ t: 'announce', text: 'Một mảnh sao vừa rơi xuống gần (' + Math.round(rev.x) + ', ' + Math.round(rev.z) + ')! Ai đến trước nhận nguyên liệu quý trong 5 phút.' });
}

/* ---------- ops ---------- */
const ops = {
  xinfo(p) { if (p.ex) { sendState(p); sendFog(p); } },
  tp(p, m) {
    const e = p.ex, w = WP.find((x) => x.id === (m.id | 0)); if (!e || !w) return;
    if (!API.thr(p, 'tp', 8000)) return API.sys(p, 'Dịch chuyển vừa dùng, đợi vài giây.');
    if (!e.wp.includes(w.id)) return API.sys(p, 'Bạn chưa mở điểm dịch chuyển này. Hãy đi tới đó trước.');
    if (p.dead || p.run || (p.duelWith != null)) return API.sys(p, 'Không dịch chuyển được lúc này.');
    const cost = 15 + Math.round(Math.hypot(w.x - p.x, w.z - p.z) * 0.5);
    if (p.data.gold < cost) return API.sys(p, 'Không đủ vàng (cần ' + cost + ').');
    p.data.gold -= cost; p.x = w.x + 1.5; p.z = w.z + 1.5; p.dirty = true;
    C.send(p, { t: 'correct', x: p.x, z: p.z }); C.pushMe(p);
    API.sys(p, 'Đã dịch chuyển tới ' + w.name + ' (' + cost + ' vàng).');
  },
  stele(p, m) {
    const e = p.ex, s = STELE.find((x) => x.id === (m.id | 0)); if (!e || !s) return;
    if (Math.hypot(p.x - s.x, p.z - s.z) > 4.5) return API.sys(p, 'Bạn đứng quá xa tấm bia.');
    const first = !e.st.includes(s.id);
    if (first) { e.st.push(s.id); e.dirty = true; }
    C.send(p, { t: 'xstele', id: s.id, text: LORE[s.id - 1], n: e.st.length, first });
    if (first && e.st.length === 12) API.sys(p, 'Bạn đã tìm đủ 12 bia đá cổ! Đây là chìa khóa của kết thúc ẩn trong cốt truyện.');
    if (first) { const lv = p.data.level || 1; C.addExp(p, Math.round(API.rules.expNeed(lv) * 0.04)); C.pushMe(p); }
  },
  rev(p, m) {
    if (!rev || rev.id !== (m.id | 0) || rev.until < Date.now()) return API.sys(p, 'Mảnh sao này đã có người lấy hoặc đã tan.');
    if (Math.hypot(p.x - rev.x, p.z - rev.z) > 4.5) return API.sys(p, 'Bạn đứng quá xa.');
    const got = { gem: API.rint(2, 3), core: API.rint(1, 2) }; rev = null;
    if (p.zn) API.giveMats(p.zn, got);
    C.broadcast({ t: 'rev', on: 0 });
    C.broadcast({ t: 'announce', text: p.name + ' đã nhặt được mảnh sao rơi!' });
    C.send(p, { t: 'zgain', mats: got, x: p.x, z: p.z }); API.info(p);
  }
};

function tick() {
  const t = Date.now();
  if (weather.until <= t) pickWeather();
  if (rev && rev.until <= t) { rev = null; C.broadcast({ t: 'rev', on: 0 }); }
  if (!rev && t >= nextRev) { nextRev = t + (10 + Math.random() * 10) * 60000; if (C.online.size) spawnRev(); }
  C.online.forEach((p) => {
    const e = p.ex; if (!e || p.dead) return;
    if (!p.run) reveal(p, p.x, p.z, 14);
    WP.forEach((w) => { if (!e.wp.includes(w.id) && Math.hypot(p.x - w.x, p.z - w.z) < 8) { e.wp.push(w.id); e.dirty = true; API.sys(p, 'Đã mở điểm dịch chuyển: ' + w.name + '.'); C.send(p, { t: 'xwp', id: w.id, name: w.name }); } });
    LOOK.forEach((l) => {
      if (Math.hypot(p.x - l.x, p.z - l.z) < 5) {
        reveal(p, l.x, l.z, l.r);
        if (!e.lk.includes(l.id)) { e.lk.push(l.id); e.dirty = true; const lv = p.data.level || 1; C.addExp(p, Math.round(API.rules.expNeed(lv) * 0.06)); C.pushMe(p); API.sys(p, 'Bạn đã mở ' + l.name + ': bản đồ khu vực hiện ra!'); }
      }
    });
    if (e.dirty && t - e.sent > 4000) { sendFog(p); }
  });
  if (t % 15000 < 1000) C.online.forEach((p) => { if (p.ex && p.ex.dirty) save(p); });
}

function init(ctx, api) {
  C = ctx; API = api;
  API.db.exec('CREATE TABLE IF NOT EXISTS explore_player (user_id INTEGER PRIMARY KEY, data TEXT NOT NULL)');
  pickWeather();
}
function onConnect(p) {
  load(p); sendState(p); sendFog(p);
  if (rev && rev.until > Date.now()) C.send(p, { t: 'rev', on: 1, id: rev.id, x: rev.x, z: rev.z, left: Math.round((rev.until - Date.now()) / 1000) });
}
function onLeave(p) { try { save(p); } catch (err) { console.error('explore save', err.message); } }

module.exports = { init, onConnect, onLeave, tick, ops, pct, WP };
