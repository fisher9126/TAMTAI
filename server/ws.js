'use strict';
/* Minimal WebSocket server (RFC 6455) with no dependencies: text frames, ping/pong, close, fragmentation. */
const crypto = require('crypto');
const { EventEmitter } = require('events');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_MESSAGE = 256 * 1024; // 256 KB is plenty for a save file

class WSConn extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.closed = false;
    this.frags = null;
    this.fragOp = 0;
    this.lastSeen = Date.now();
    socket.on('data', (d) => this._onData(d));
    socket.on('close', () => this._closed());
    socket.on('error', () => this._closed());
  }
  _header(op, len) {
    if (len < 126) return Buffer.from([0x80 | op, len]);
    if (len < 65536) { const h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = 126; h.writeUInt16BE(len, 2); return h; }
    const h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(len), 2); return h;
  }
  _frame(op, payload) {
    if (this.closed || this.socket.destroyed) return;
    try { this.socket.write(Buffer.concat([this._header(op, payload.length), payload])); } catch (e) { this._closed(); }
  }
  send(text) { this._frame(0x1, Buffer.from(String(text), 'utf8')); }
  ping() { this._frame(0x9, Buffer.alloc(0)); }
  close(code, reason) {
    if (this.closed) return;
    const r = Buffer.from(reason || '', 'utf8').subarray(0, 120);
    const p = Buffer.alloc(2 + r.length); p.writeUInt16BE(code || 1000, 0); r.copy(p, 2);
    this._frame(0x8, p);
    try { this.socket.end(); } catch (e) { /* ignore */ }
    setTimeout(() => { try { this.socket.destroy(); } catch (e) { /* ignore */ } }, 2000).unref();
    this._closed();
  }
  _closed() {
    if (this.closed) return;
    this.closed = true;
    this.emit('close');
  }
  _onData(d) {
    this.lastSeen = Date.now();
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    if (this.buf.length > MAX_MESSAGE + 14) { this.close(1009, 'too big'); return; }
    for (;;) {
      const buf = this.buf;
      if (buf.length < 2) return;
      const fin = (buf[0] & 0x80) !== 0, op = buf[0] & 0x0f, masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) {
        if (buf.length < 10) return;
        const big = buf.readBigUInt64BE(2);
        if (big > BigInt(MAX_MESSAGE)) { this.close(1009, 'too big'); return; }
        len = Number(big); off = 10;
      }
      if (!masked) { this.close(1002, 'unmasked'); return; }
      if (buf.length < off + 4 + len) return;
      const mask = buf.subarray(off, off + 4); off += 4;
      const payload = Buffer.allocUnsafe(len);
      for (let i = 0; i < len; i++) payload[i] = buf[off + i] ^ mask[i & 3];
      this.buf = buf.subarray(off + len);
      if (op === 0x8) { this.close(1000); return; }
      if (op === 0x9) { this._frame(0xA, payload); continue; }
      if (op === 0xA) continue;
      if (op === 0x1 || op === 0x2) { this.fragOp = op; this.frags = [payload]; }
      else if (op === 0x0 && this.frags) { this.frags.push(payload); }
      else { this.close(1002, 'bad frame'); return; }
      if (fin) {
        const msg = Buffer.concat(this.frags); this.frags = null;
        if (msg.length > MAX_MESSAGE) { this.close(1009, 'too big'); return; }
        if (this.fragOp === 0x1) this.emit('message', msg.toString('utf8'));
      }
    }
  }
}

function handleUpgrade(req, socket, onConn) {
  const key = req.headers['sec-websocket-key'];
  if (!key || String(req.headers.upgrade || '').toLowerCase() !== 'websocket') {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    return;
  }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  onConn(new WSConn(socket));
}

module.exports = { handleUpgrade };
