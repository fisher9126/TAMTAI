'use strict';
const crypto = require('crypto');
const db = require('./db');

const SESSION_DAYS = 30;
const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
}
function fail(msg, code) { const e = new Error(msg); e.status = code || 400; throw e; }

function register(username, password, ip) {
  username = String(username || '').trim();
  password = String(password || '');
  if (!NAME_RE.test(username)) fail('Tên tài khoản cần 3–16 ký tự, chỉ gồm chữ không dấu, số và dấu gạch dưới.');
  if (password.length < 6 || password.length > 72) fail('Mật khẩu cần từ 6 đến 72 ký tự.');
  if (db.get('SELECT id FROM users WHERE username = ?', username)) fail('Tên tài khoản này đã có người dùng.', 409);
  const salt = crypto.randomBytes(16).toString('hex');
  const count = db.get('SELECT COUNT(*) AS n FROM users').n;
  const adminName = (process.env.ADMIN_USERNAME || '').trim().toLowerCase();
  const role = count === 0 || (adminName && adminName === username.toLowerCase()) ? 'admin' : 'player';
  db.run('INSERT INTO users (username, pass_hash, salt, role, created_at) VALUES (?, ?, ?, ?, ?)',
    username, hashPassword(password, salt), salt, role, Date.now());
  return login(username, password, ip);
}

function login(username, password, ip) {
  const u = db.get('SELECT * FROM users WHERE username = ?', String(username || '').trim());
  const ok = u && crypto.timingSafeEqual(Buffer.from(hashPassword(String(password || ''), u.salt), 'hex'), Buffer.from(u.pass_hash, 'hex'));
  if (!ok) fail('Sai tên tài khoản hoặc mật khẩu.', 401);
  if (u.banned_until > Date.now()) fail(banMessage(u), 403);
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  db.run('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', token, u.id, now, now + SESSION_DAYS * 864e5);
  db.run('UPDATE users SET last_login = ?, last_ip = ? WHERE id = ?', now, ip || null, u.id);
  return { token, user: { id: u.id, username: u.username, role: u.role } };
}

function banMessage(u) {
  const forever = u.banned_until > Date.now() + 3650 * 864e5;
  const until = forever ? 'vĩnh viễn' : 'đến ' + new Date(u.banned_until).toLocaleString('vi-VN', { timeZone: process.env.TZ_DISPLAY || 'Asia/Ho_Chi_Minh' });
  return 'Tài khoản đang bị khóa ' + until + (u.ban_reason ? '. Lý do: ' + u.ban_reason : '.');
}

function userFromToken(token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
  const r = db.get('SELECT u.id, u.username, u.role, u.banned_until, u.ban_reason, u.muted_until, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?', token);
  if (!r || r.expires_at < Date.now()) return null;
  return r;
}

function logout(token) { if (typeof token === 'string') db.run('DELETE FROM sessions WHERE token = ?', token); }
function changePassword(userId, oldPw, newPw) {
  const u = db.get('SELECT * FROM users WHERE id = ?', userId);
  if (!u || hashPassword(String(oldPw || ''), u.salt) !== u.pass_hash) fail('Mật khẩu hiện tại không đúng.', 401);
  newPw = String(newPw || '');
  if (newPw.length < 6 || newPw.length > 72) fail('Mật khẩu mới cần từ 6 đến 72 ký tự.');
  const salt = crypto.randomBytes(16).toString('hex');
  db.run('UPDATE users SET pass_hash = ?, salt = ? WHERE id = ?', hashPassword(newPw, salt), salt, userId);
  db.run('DELETE FROM sessions WHERE user_id = ?', userId);
}
function cleanupSessions() { db.run('DELETE FROM sessions WHERE expires_at < ?', Date.now()); }

module.exports = { register, login, logout, userFromToken, banMessage, changePassword, cleanupSessions, NAME_RE };
