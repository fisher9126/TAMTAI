'use strict';
/* Aetherfall game server: static files + REST API + WebSocket on one port. Run: node server/index.js */
const fs = require('fs');
const path = require('path');
const http = require('http');

(function loadEnv() {
  const f = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(f)) return;
  fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
})();

const db = require('./db');
const auth = require('./auth');
const game = require('./game');
const items = require('../public/js/items.js');
const { handleUpgrade } = require('./ws');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const TRUST_PROXY = process.env.TRUST_PROXY !== '0';
const PUBLIC = path.join(__dirname, '..', 'public');
const STARTED = Date.now();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2' };

function ipOf(req) {
  const xf = TRUST_PROXY && req.headers['x-forwarded-for'];
  return (xf ? String(xf).split(',')[0] : req.socket.remoteAddress || '').trim();
}
function json(res, code, obj) {
  const b = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(b) });
  res.end(b);
}
function body(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > (limit || 64 * 1024)) { reject(Object.assign(new Error('Dữ liệu gửi lên quá lớn.'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { if (!chunks.length) return resolve({}); try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(Object.assign(new Error('Dữ liệu không hợp lệ.'), { status: 400 })); } });
    req.on('error', reject);
  });
}
const hits = new Map();
function limited(key, max, windowMs) {
  const t = Date.now(); const arr = (hits.get(key) || []).filter((x) => t - x < windowMs); arr.push(t); hits.set(key, arr);
  return arr.length > max;
}
setInterval(() => { const t = Date.now(); hits.forEach((v, k) => { if (!v.length || t - v[v.length - 1] > 3600e3) hits.delete(k); }); }, 600e3).unref();
function bearer(req) { const h = req.headers.authorization || ''; return h.startsWith('Bearer ') ? h.slice(7) : ''; }
function requireStaff(req, adminOnly) {
  const u = auth.userFromToken(bearer(req));
  if (!u) throw Object.assign(new Error('Phiên đăng nhập đã hết hạn. Đăng nhập lại.'), { status: 401 });
  if (u.role !== 'admin' && (adminOnly || u.role !== 'gm')) throw Object.assign(new Error('Tài khoản này không có quyền quản trị.'), { status: 403 });
  return u;
}

function serveStatic(req, res, pathname) {
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/admin' || pathname === '/admin/') pathname = '/admin.html';
  let file;
  try { file = path.join(PUBLIC, path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '')); } catch (e) { res.writeHead(400); return res.end(); }
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Không tìm thấy trang.'); }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

/* ---------- admin helpers ---------- */
function playerRow(r) {
  return { id: r.id, username: r.username, role: r.role, level: r.level || 1, gold: r.gold || 0, online: game.isOnline(r.id), created_at: r.created_at, last_login: r.last_login,
    banned_until: r.banned_until, ban_reason: r.ban_reason, muted_until: r.muted_until, play_seconds: r.play_seconds || 0 };
}
const ADMIN_ROUTES = [
  ['GET', /^\/api\/admin\/overview$/, false, () => {
    const day = Date.now() - 864e5;
    return {
      online: game.online.size,
      totalUsers: db.get('SELECT COUNT(*) AS n FROM users').n,
      newToday: db.get('SELECT COUNT(*) AS n FROM users WHERE created_at > ?', day).n,
      activeToday: db.get('SELECT COUNT(*) AS n FROM users WHERE last_login > ?', day).n,
      reportsNew: db.get("SELECT COUNT(*) AS n FROM reports WHERE status = 'new'").n,
      suspects: db.all("SELECT l.id, l.detail, l.created_at, u.username FROM admin_log l LEFT JOIN users u ON u.id = l.target_id WHERE l.action = 'suspect' ORDER BY l.id DESC LIMIT 5"),
      uptime: Math.round((Date.now() - STARTED) / 1000), memoryMB: Math.round(process.memoryUsage().rss / 1048576),
      onlineList: game.onlineList()
    };
  }],
  ['GET', /^\/api\/admin\/players$/, false, (req, u, m, q) => {
    const s = String(q.get('q') || '').trim();
    const rows = s
      ? db.all('SELECT u.*, c.level, c.gold, c.play_seconds FROM users u LEFT JOIN characters c ON c.user_id = u.id WHERE u.username LIKE ? OR u.id = ? ORDER BY u.last_login DESC LIMIT 100', '%' + s.replace(/[%_]/g, '') + '%', Number(s) || -1)
      : db.all('SELECT u.*, c.level, c.gold, c.play_seconds FROM users u LEFT JOIN characters c ON c.user_id = u.id ORDER BY u.last_login DESC LIMIT 100');
    return { players: rows.map(playerRow) };
  }],
  ['GET', /^\/api\/admin\/player\/(\d+)$/, false, (req, u, m) => {
    const id = Number(m[1]);
    const r = db.get('SELECT u.*, c.level, c.gold, c.play_seconds, c.data, c.x, c.z FROM users u LEFT JOIN characters c ON c.user_id = u.id WHERE u.id = ?', id);
    if (!r) throw Object.assign(new Error('Không tìm thấy người chơi.'), { status: 404 });
    let data = game.liveData(id); if (!data && r.data) { try { data = JSON.parse(r.data); } catch (e) { data = null; } }
    return {
      player: Object.assign(playerRow(r), { last_ip: r.last_ip }), data,
      friends: db.all("SELECT u.username FROM friends f JOIN users u ON u.id = f.friend_id WHERE f.user_id = ? AND f.status = 'accepted'", id).map((x) => x.username),
      chat: db.all('SELECT channel, target, text, created_at FROM chat_log WHERE user_id = ? ORDER BY id DESC LIMIT 30', id),
      mail: db.all('SELECT id, from_name, message, created_at, claimed_at FROM mail WHERE user_id = ? ORDER BY id DESC LIMIT 20', id),
      reports: db.all('SELECT r.id, r.reason, r.status, r.created_at, u.username AS reporter FROM reports r JOIN users u ON u.id = r.reporter_id WHERE r.target_id = ? ORDER BY r.id DESC LIMIT 20', id)
    };
  }],
  ['POST', /^\/api\/admin\/player\/(\d+)\/kick$/, false, (req, u, m, q, b) => {
    const id = Number(m[1]); const ok = game.kick(id, b.reason ? 'Bạn bị đưa ra khỏi game: ' + game.cleanText(b.reason) : null);
    game.logAdmin(u.id, 'kick', id, b.reason); return { ok, message: ok ? 'Đã đưa người chơi ra khỏi game.' : 'Người chơi không online.' };
  }],
  ['POST', /^\/api\/admin\/player\/(\d+)\/mute$/, false, (req, u, m, q, b) => {
    const id = Number(m[1]); const min = Math.max(0, Math.min(43200, Math.round(Number(b.minutes) || 0)));
    game.setMute(id, min); game.logAdmin(u.id, min ? 'mute' : 'unmute', id, min ? min + ' phút' : null);
    return { ok: true, message: min ? 'Đã cấm chat ' + min + ' phút.' : 'Đã bỏ cấm chat.' };
  }],
  ['POST', /^\/api\/admin\/player\/(\d+)\/ban$/, false, (req, u, m, q, b) => {
    const id = Number(m[1]); const target = db.get('SELECT role FROM users WHERE id = ?', id);
    if (!target) throw Object.assign(new Error('Không tìm thấy người chơi.'), { status: 404 });
    if (target.role === 'admin') throw Object.assign(new Error('Không thể khóa tài khoản quản trị viên.'), { status: 400 });
    const days = Math.max(0, Math.min(36500, Number(b.days) || 0));
    game.setBan(id, days, b.reason ? game.cleanText(b.reason) : null); game.logAdmin(u.id, days ? 'ban' : 'unban', id, days ? days + ' ngày. ' + (b.reason || '') : null);
    return { ok: true, message: days ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.' };
  }],
  ['POST', /^\/api\/admin\/player\/(\d+)\/role$/, true, (req, u, m, q, b) => {
    const id = Number(m[1]); const role = ['player', 'gm', 'admin'].includes(b.role) ? b.role : null;
    if (!role) throw Object.assign(new Error('Vai trò không hợp lệ.'), { status: 400 });
    if (id === u.id) throw Object.assign(new Error('Không thể tự đổi vai trò của chính mình.'), { status: 400 });
    db.run('UPDATE users SET role = ? WHERE id = ?', role, id); game.logAdmin(u.id, 'role', id, role); return { ok: true, message: 'Đã đổi vai trò thành ' + role + '.' };
  }],
  ['POST', /^\/api\/admin\/gift$/, false, (req, u, m, q, b) => {
    const gift = game.buildGift(b);
    if (!gift.gold && !gift.potions && !gift.items.length) throw Object.assign(new Error('Quà đang trống. Thêm vàng, bình máu hoặc vật phẩm.'), { status: 400 });
    let ids;
    if (b.target === 'all') {
      if (u.role !== 'admin') throw Object.assign(new Error('Chỉ quản trị viên cấp cao được gửi quà cho toàn máy chủ.'), { status: 403 });
      ids = db.all('SELECT id FROM users').map((r) => r.id);
    } else if (b.target === 'online') ids = game.onlineList().map((p) => p.id);
    else { const id = Number(b.target); if (!db.get('SELECT id FROM users WHERE id = ?', id)) throw Object.assign(new Error('Không tìm thấy người nhận.'), { status: 404 }); ids = [id]; }
    if (u.role === 'gm' && (gift.gold > 5000 || gift.items.some((it) => it.rarity === 'legend'))) throw Object.assign(new Error('GM chỉ được gửi tối đa 5.000 vàng và không gửi đồ Huyền thoại.'), { status: 403 });
    const msg = game.cleanText(b.message) || 'Quà từ ban quản trị';
    const n = game.sendMail(ids, u.username, msg, gift);
    game.logAdmin(u.id, 'gift', ids.length === 1 ? ids[0] : null, 'Gửi ' + n + ' người: ' + gift.gold + ' vàng, ' + gift.potions + ' bình máu, ' + gift.items.map((i) => i.name + ' (' + items.RNAME[i.rarity] + ')').join(', '));
    return { ok: true, message: 'Đã gửi quà tới ' + n + ' người chơi.' };
  }],
  ['POST', /^\/api\/admin\/announce$/, false, (req, u, m, q, b) => {
    const text = game.cleanText(b.text); if (!text) throw Object.assign(new Error('Nhập nội dung thông báo.'), { status: 400 });
    game.announce(text); game.logAdmin(u.id, 'announce', null, text); return { ok: true, message: 'Đã gửi thông báo tới ' + game.online.size + ' người đang online.' };
  }],
  ['GET', /^\/api\/admin\/reports$/, false, () => ({
    reports: db.all("SELECT r.id, r.reason, r.status, r.created_at, a.username AS reporter, t.username AS target, t.id AS target_id FROM reports r JOIN users a ON a.id = r.reporter_id JOIN users t ON t.id = r.target_id ORDER BY (r.status = 'new') DESC, r.id DESC LIMIT 100")
  })],
  ['POST', /^\/api\/admin\/reports\/(\d+)\/close$/, false, (req, u, m) => { db.run("UPDATE reports SET status = 'done' WHERE id = ?", Number(m[1])); game.logAdmin(u.id, 'report_close', null, '#' + m[1]); return { ok: true, message: 'Đã đánh dấu đã xử lý.' }; }],
  ['GET', /^\/api\/admin\/log$/, false, () => ({ log: db.all('SELECT l.*, a.username AS admin, t.username AS target FROM admin_log l LEFT JOIN users a ON a.id = l.admin_id LEFT JOIN users t ON t.id = l.target_id ORDER BY l.id DESC LIMIT 150') })],
  ['GET', /^\/api\/admin\/chat$/, false, () => ({ chat: db.all('SELECT c.channel, c.target, c.text, c.created_at, u.username FROM chat_log c JOIN users u ON u.id = c.user_id ORDER BY c.id DESC LIMIT 150') })]
];

try { ADMIN_ROUTES.push(...require('./events').adminRoutes(game)); } catch (err) { console.error('events routes', err.message); } // AF-EVENTS
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  const ip = ipOf(req);
  try {
    if (p === '/api/health') return json(res, 200, { ok: true, online: game.online.size, uptime: Math.round((Date.now() - STARTED) / 1000) });
    if (p === '/api/register' && req.method === 'POST') {
      if (limited('reg:' + ip, 5, 3600e3)) return json(res, 429, { error: 'Bạn tạo quá nhiều tài khoản. Thử lại sau một giờ.' });
      const b = await body(req); return json(res, 200, auth.register(b.username, b.password, ip));
    }
    if (p === '/api/login' && req.method === 'POST') {
      if (limited('login:' + ip, 15, 600e3)) return json(res, 429, { error: 'Đăng nhập sai quá nhiều lần. Đợi 10 phút rồi thử lại.' });
      const b = await body(req); return json(res, 200, auth.login(b.username, b.password, ip));
    }
    if (p === '/api/logout' && req.method === 'POST') { auth.logout(bearer(req)); return json(res, 200, { ok: true }); }
    if (p === '/api/me' && req.method === 'GET') {
      const u = auth.userFromToken(bearer(req)); if (!u) return json(res, 401, { error: 'Phiên đăng nhập đã hết hạn.' });
      if (u.banned_until > Date.now()) return json(res, 403, { error: auth.banMessage(u) });
      return json(res, 200, { user: { id: u.id, username: u.username, role: u.role } });
    }
    if (p === '/api/password' && req.method === 'POST') {
      const u = auth.userFromToken(bearer(req)); if (!u) return json(res, 401, { error: 'Phiên đăng nhập đã hết hạn.' });
      const b = await body(req); auth.changePassword(u.id, b.old, b.new); return json(res, 200, { ok: true, message: 'Đã đổi mật khẩu. Đăng nhập lại với mật khẩu mới.' });
    }
    if (p.startsWith('/api/admin/')) {
      for (const [method, re, adminOnly, fn] of ADMIN_ROUTES) {
        const m = p.match(re);
        if (m && req.method === method) {
          const u = requireStaff(req, adminOnly);
          const b = method === 'POST' ? await body(req) : {};
          return json(res, 200, fn(req, u, m, url.searchParams, b));
        }
      }
      return json(res, 404, { error: 'Không có chức năng này.' });
    }
    if (p.startsWith('/api/')) return json(res, 404, { error: 'Không có chức năng này.' });
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    return serveStatic(req, res, p);
  } catch (e) {
    if (!e.status) console.error(e);
    return json(res, e.status || 500, { error: e.status ? e.message : 'Máy chủ gặp lỗi. Thử lại sau.' });
  }
});

server.on('upgrade', (req, socket) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/ws') { socket.destroy(); return; }
  const u = auth.userFromToken(url.searchParams.get('token'));
  if (!u) { socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n'); return; }
  if (u.banned_until > Date.now()) { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return; }
  handleUpgrade(req, socket, (ws) => game.connect(ws, u));
});

setInterval(() => { auth.cleanupSessions(); db.run('DELETE FROM chat_log WHERE created_at < ?', Date.now() - 30 * 864e5); }, 3600e3).unref();
setInterval(() => game.saveAll(), 60e3).unref();

server.listen(PORT, HOST, () => {
  console.log('Aetherfall đang chạy tại http://' + HOST + ':' + PORT + '  (database: ' + db.file + ')');
});
function shutdown() {
  console.log('Đang lưu dữ liệu và tắt máy chủ...');
  try { game.saveAll(); } catch (e) { console.error(e); }
  server.close(); try { db.close(); } catch (e) { /* ignore */ }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
