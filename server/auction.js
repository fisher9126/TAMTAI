'use strict';
/* Aetherfall step 9 (server plugin of zones.js): auction house with real bidding.
   Sellers list an item from their bag with a start price and an optional buy-out price for 6/12/24/48 hours. Bidders' gold is held while they lead;
   when someone outbids them it goes back to their auction box. Anti-sniping: a bid in the last minute extends the auction by one minute.
   Sold items, gold (minus 5% tax), refunds and returned items go into the player's auction box (table auction_box) and are claimed with one
   click, so nothing depends on the mail system and nothing is lost if the bag is full. */
let C = null, API = null;
const now = () => Date.now();
const TAX = 0.05, MAX_ACTIVE = 6, MAX_PRICE = 50000000;
const HOURS = [6, 12, 24, 48];

function init(ctx, api) {
  C = ctx; API = api;
  API.db.exec(`CREATE TABLE IF NOT EXISTS auction (id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL, seller_name TEXT NOT NULL, item TEXT NOT NULL, rarity TEXT NOT NULL, slot TEXT NOT NULL,
    start INTEGER NOT NULL, buyout INTEGER NOT NULL DEFAULT 0, bid INTEGER NOT NULL DEFAULT 0, bidder_id INTEGER, bidder_name TEXT, ends_at INTEGER NOT NULL, created_at INTEGER NOT NULL)`);
  API.db.exec('CREATE TABLE IF NOT EXISTS auction_box (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, gold INTEGER NOT NULL DEFAULT 0, item TEXT, note TEXT NOT NULL, created_at INTEGER NOT NULL)');
  API.db.exec('CREATE INDEX IF NOT EXISTS auction_box_user ON auction_box (user_id)');
}
const ival = (v, a, b) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : a; };
const price = (r) => (r.bid > 0 ? r.bid : r.start);
const minBid = (r) => (r.bid > 0 ? r.bid + Math.max(1, Math.ceil(r.bid * 0.05)) : r.start);
const fee = (start) => Math.max(10, Math.round(start * 0.03));
function box(uid, gold, item, note) { API.db.run('INSERT INTO auction_box (user_id, gold, item, note, created_at) VALUES (?, ?, ?, ?, ?)', uid, gold | 0, item ? JSON.stringify(item) : null, note, now()); const o = C.online.get(uid); if (o) { boxCount(o); } }
function boxCount(p) { const n = API.db.get('SELECT COUNT(*) AS n FROM auction_box WHERE user_id = ?', p.id).n; C.send(p, { t: 'abox', n }); }
function row(r, p) {
  let it = null; try { it = JSON.parse(r.item); } catch (e) { /* ignore */ }
  return { id: r.id, item: it, seller: r.seller_name, mine: r.seller_id === p.id, leading: r.bidder_id === p.id, start: r.start, buyout: r.buyout, bid: r.bid, price: price(r), next: minBid(r), bidder: r.bidder_name || '', left: Math.max(0, Math.round((r.ends_at - now()) / 1000)) };
}

const ops = {
  alist(p, m) {
    if (!API.thr(p, 'alist', 400)) return;
    const q = String(m.q || '').toLowerCase().slice(0, 30), slot = String(m.slot || ''), rar = String(m.rarity || ''), mine = !!m.mine;
    let rows = API.db.all('SELECT * FROM auction WHERE ends_at > ? ORDER BY ends_at ASC LIMIT 300', now());
    rows = rows.filter((r) => (!slot || r.slot === slot) && (!rar || r.rarity === rar) && (!mine || r.seller_id === p.id || r.bidder_id === p.id));
    if (q) rows = rows.filter((r) => { try { return JSON.parse(r.item).name.toLowerCase().includes(q); } catch (e) { return false; } });
    C.send(p, { t: 'alist', list: rows.slice(0, 60).map((r) => row(r, p)), gold: p.data.gold });
    boxCount(p);
  },
  apost(p, m) {
    if (!API.thr(p, 'apost', 800)) return;
    const d = p.data, i = d.inv.findIndex((it) => it.id === String(m.id || ''));
    if (i < 0) return API.sys(p, 'Không tìm thấy món đó trong túi.');
    const startP = ival(m.start, 1, MAX_PRICE), buy = m.buyout ? ival(m.buyout, 0, MAX_PRICE) : 0, hours = HOURS.includes(m.hours | 0) ? (m.hours | 0) : 24;
    if (buy && buy <= startP) return API.sys(p, 'Giá mua đứt phải lớn hơn giá khởi điểm.');
    if (API.db.get('SELECT COUNT(*) AS n FROM auction WHERE seller_id = ? AND ends_at > ?', p.id, now()).n >= MAX_ACTIVE) return API.sys(p, 'Bạn đang đăng tối đa ' + MAX_ACTIVE + ' món.');
    const f = fee(startP); if (d.gold < f) return API.sys(p, 'Không đủ vàng đặt cọc phí đăng (' + f + ').');
    const it = API.items.validItem(d.inv[i]); if (!it) return;
    d.inv.splice(i, 1); d.gold -= f;
    API.db.run('INSERT INTO auction (seller_id, seller_name, item, rarity, slot, start, buyout, ends_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', p.id, p.name, JSON.stringify(it), it.rarity, it.slot, startP, buy, now() + hours * 3600e3, now());
    C.pushMe(p); API.sys(p, 'Đã đăng ' + it.name + ' lên đấu giá (phí ' + f + ' vàng).'); ops.alist(p, {});
  },
  abid(p, m) {
    if (!API.thr(p, 'abid', 500)) return;
    const r = API.db.get('SELECT * FROM auction WHERE id = ?', ival(m.id, 0, 1e9)); if (!r || r.ends_at <= now()) return API.sys(p, 'Phiên đấu giá đã kết thúc.');
    if (r.seller_id === p.id) return API.sys(p, 'Bạn không thể tự trả giá món của mình.');
    if (r.bidder_id === p.id) return API.sys(p, 'Bạn đang dẫn đầu rồi.');
    const amount = ival(m.amount, 0, MAX_PRICE);
    if (amount < minBid(r)) return API.sys(p, 'Giá tối thiểu là ' + minBid(r) + ' vàng.');
    if (p.data.gold < amount) return API.sys(p, 'Không đủ vàng (cần ' + amount + ').');
    const buy = r.buyout > 0 && amount >= r.buyout;
    const res = API.db.run('UPDATE auction SET bid = ?, bidder_id = ?, bidder_name = ?, ends_at = CASE WHEN ends_at - ? < 60000 THEN ends_at + 60000 ELSE ends_at END WHERE id = ? AND bid = ? AND ends_at > ?', amount, p.id, p.name, now(), r.id, r.bid, now());
    if (res.changes !== 1) return API.sys(p, 'Có người vừa trả giá trước bạn, hãy thử lại.');
    p.data.gold -= amount;
    if (r.bidder_id) { box(r.bidder_id, r.bid, null, 'Hoàn tiền: có người trả giá cao hơn cho ' + (JSON.parse(r.item).name)); const o = C.online.get(r.bidder_id); if (o) API.sys(o, 'Bạn bị trả giá cao hơn ở món ' + JSON.parse(r.item).name + '. Vàng đã hoàn về hộp đấu giá.'); }
    C.pushMe(p); API.sys(p, 'Đã trả giá ' + amount + ' vàng.');
    if (buy) settle(API.db.get('SELECT * FROM auction WHERE id = ?', r.id)); else ops.alist(p, {});
  },
  abuy(p, m) {
    const r = API.db.get('SELECT * FROM auction WHERE id = ?', ival(m.id, 0, 1e9)); if (!r || !r.buyout || r.ends_at <= now()) return API.sys(p, 'Món này không có giá mua đứt hoặc đã kết thúc.');
    ops.abid(p, { id: r.id, amount: r.buyout });
  },
  acancel(p, m) {
    const r = API.db.get('SELECT * FROM auction WHERE id = ?', ival(m.id, 0, 1e9)); if (!r || r.seller_id !== p.id) return;
    if (r.bidder_id) return API.sys(p, 'Đã có người trả giá nên không hủy được.');
    API.db.run('DELETE FROM auction WHERE id = ? AND bidder_id IS NULL', r.id);
    box(p.id, 0, JSON.parse(r.item), 'Bạn đã hủy đấu giá'); API.sys(p, 'Đã hủy. Món đồ về hộp đấu giá.'); ops.alist(p, {});
  },
  abox(p) {
    const rows = API.db.all('SELECT * FROM auction_box WHERE user_id = ? ORDER BY id ASC LIMIT 60', p.id);
    C.send(p, { t: 'abox', n: rows.length, list: rows.map((r) => { let it = null; try { it = r.item ? JSON.parse(r.item) : null; } catch (e) { /* ignore */ } return { id: r.id, gold: r.gold, item: it ? { name: it.name, rarity: it.rarity, ilvl: it.ilvl, enh: it.enh || 0 } : null, note: r.note }; }) });
  },
  aclaim(p) {
    if (!API.thr(p, 'aclaim', 600)) return;
    const rows = API.db.all('SELECT * FROM auction_box WHERE user_id = ? ORDER BY id ASC LIMIT 60', p.id); let gold = 0, items = 0, left = 0;
    rows.forEach((r) => {
      let it = null; if (r.item) { try { it = API.items.validItem(JSON.parse(r.item)); } catch (e) { it = null; } }
      if (it && p.data.inv.length >= API.rules.INV_SIZE) { left++; return; } // keep it until there is room
      if (API.db.run('DELETE FROM auction_box WHERE id = ? AND user_id = ?', r.id, p.id).changes !== 1) return;
      if (r.gold) { p.data.gold += r.gold; gold += r.gold; }
      if (it) { p.data.inv.push(it); items++; }
    });
    C.pushMe(p); API.sys(p, 'Đã nhận ' + gold + ' vàng và ' + items + ' món đồ' + (left ? ' (còn ' + left + ' món chờ vì túi đầy)' : '') + '.'); ops.abox(p);
  }
};

function settle(r) {
  if (!r) return;
  if (API.db.run('DELETE FROM auction WHERE id = ?', r.id).changes !== 1) return;
  const it = JSON.parse(r.item);
  if (r.bidder_id) {
    const net = Math.round(r.bid * (1 - TAX));
    box(r.bidder_id, 0, it, 'Bạn thắng đấu giá ' + it.name + ' với giá ' + r.bid + ' vàng');
    box(r.seller_id, net, null, 'Đã bán ' + it.name + ' giá ' + r.bid + ' (thuế 5%)');
    const b = C.online.get(r.bidder_id), s = C.online.get(r.seller_id);
    if (b) API.sys(b, 'Bạn thắng đấu giá ' + it.name + '! Nhận ở phím U (hộp đấu giá).');
    if (s) API.sys(s, 'Món ' + it.name + ' đã bán được ' + net + ' vàng. Nhận ở phím U (hộp đấu giá).');
  } else {
    box(r.seller_id, 0, it, 'Không ai mua ' + it.name + ', đã hết hạn');
    const s = C.online.get(r.seller_id); if (s) API.sys(s, 'Món ' + it.name + ' không có người mua. Nhận lại ở phím U.');
  }
}
function tick() {
  if (now() % 5000 >= 1000) return;
  API.db.all('SELECT * FROM auction WHERE ends_at <= ? LIMIT 20', now()).forEach((r) => { try { settle(r); } catch (err) { console.error('auction settle', err.message); } });
}
function onConnect(p) { try { boxCount(p); } catch (err) { console.error('auction connect', err.message); } }

module.exports = { init, onConnect, tick, ops };
