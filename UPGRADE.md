# Nâng cấp TAMTAI: tổ đội, bang hội, giao dịch, chợ, cường hóa, nhiệm vụ ngày

Bản này chạy trên nền TAMTAI hiện có (Node 22.13+, không thêm thư viện nào). Máy chủ vẫn là nơi quyết định mọi thứ: trình duyệt chỉ gửi yêu cầu.

## Cài đặt (3 bước)

1. Chép các file trong gói này vào thư mục gốc của repo, **ghi đè** `public/js/items.js` và `public/js/rules.js`:

   ```
   apply-upgrade.js
   server/social.js
   public/js/social.js
   public/js/items.js      (ghi đè)
   public/js/rules.js      (ghi đè)
   ```

2. Chạy một lần trong thư mục gốc của repo. Lệnh này sửa `server/game.js` và `public/index.html` (có tạo file `.bak`), và tự bỏ qua nếu đã chạy rồi:

   ```
   node apply-upgrade.js
   ```

   Nếu báo "tìm thấy 0 cho dòng ..." nghĩa là file của bạn khác bản mình đọc. Lệnh sẽ không ghi gì vào file đó. Gửi nguyên thông báo cho mình để chỉnh.

3. Khởi động lại server (`npm start` hoặc `sudo systemctl restart <tên service>`). Bảng dữ liệu mới tự tạo khi khởi động. Dữ liệu cũ giữ nguyên.

Muốn quay lại bản cũ: chép `server/game.js.bak` và `public/index.html.bak` về tên cũ, và xóa `server/social.js`.

## Có gì mới (trong game bấm phím K hoặc nút "Xã hội")

| Tính năng | Chi tiết |
|---|---|
| Tổ đội | Tối đa 4 người. Mời, nhường đội trưởng, mời ra, chat `/p`. Đồng đội đứng trong 60m cùng nhận EXP, vàng, loot, tiến độ nhiệm vụ khi một người hạ quái; +8% EXP mỗi đồng đội. |
| Bang hội | Lập bang (cấp 5, 500 vàng), trưởng/phó/thành viên, mời, phong/hạ chức, nhường bang, mời ra, giải tán, lời nhắn, chat `/g`. Quyên góp vàng nâng cấp bang (6 cấp, tăng sức chứa 15 đến 40 người); mỗi cấp bang +2% EXP cho thành viên. |
| Giao dịch | Hai người đứng gần nhau đặt đồ và vàng, cùng khóa, cùng xác nhận. Máy chủ kiểm tra lại đồ, vàng, chỗ trống rồi đổi trong một bước và ghi log (`trade_log`). |
| Chợ | Đăng bán đồ với giá tự đặt, duyệt theo loại và độ hiếm, mua, gỡ. Thuế 5% khi bán, tiền gửi vào thư. Tối đa 8 món/người, hết hạn sau 72 giờ thì trả đồ qua thư. |
| Cường hóa | +1 đến +10, tốn vàng, có tỉ lệ thất bại; từ +5 thất bại sẽ tụt 1 cấp. Cộng 12% chỉ số gốc mỗi cấp. Nhân vật cũ vẫn dùng bình thường (đồ cũ là +0). |
| Nhiệm vụ ngày, điểm danh, thành tựu | 4 nhiệm vụ ngày làm mới theo giờ Việt Nam (UTC+7), quà đăng nhập theo chuỗi ngày, 11 thành tựu có thưởng. |
| Xếp hạng | Top cấp độ, top vàng, top bang (cập nhật mỗi 30 giây). Tài khoản admin/GM và tài khoản bị khóa không lên bảng. |
| Biểu cảm | `/e wave`, `dance`, `laugh`, `cry`, `cheer`, `bow`, `sleep`: hiện thành dòng chat cho người chơi trong 45m. |

Lệnh chat mới: `/p`, `/g`, `/moi tên`, `/roi`, `/gd tên`, `/cho`, `/top`, `/e biểu_cảm`. Gõ `/help` để xem.

## Những file nào bị đụng tới

- Thêm mới: `server/social.js`, `public/js/social.js`, `apply-upgrade.js`.
- Thay thế: `public/js/items.js` (thêm trường `enh`, hàm `enhChance/enhCost/withEnhName`), `public/js/rules.js` (chỉ số nhân vật tính cả `enh`).
- Sửa nhỏ bằng `apply-upgrade.js`: `server/game.js` (7 chỗ: nạp module, chuyển tin nhắn mới, báo kết nối/ngắt kết nối, chia thưởng khi hạ quái) và `public/index.html` (3 chỗ + 1 thẻ script).
- Bảng DB mới: `guilds`, `guild_members`, `market`, `social_player`, `trade_log`.

## Chưa làm (cần nói thẳng)

- **PvP và đấu tay đôi**: máu người chơi vẫn do trình duyệt tính (đã ghi trong README gốc), nên chưa thể làm PvP công bằng. Cần chuyển máu/mana/thể lực sang máy chủ trước.
- Lớp nhân vật/kỹ năng mới, thú cưng, phó bản riêng, mùa giải, nhà, nhiều bản đồ: chưa có.
- Trang `/admin` chưa có màn hình quản lý bang/chợ/giao dịch. Dữ liệu nằm sẵn trong DB để bạn xem bằng `sqlite3`.
- Chưa có hình 3D mới cho biểu cảm hay tên bang trên đầu nhân vật.
- **Chưa chạy thử**: mình không có Node.js hay trình duyệt trong môi trường làm việc, nên toàn bộ code này chưa được chạy lần nào. Hãy thử trên bản sao trước, với 2 tài khoản trong 2 tab, và gửi mình log (`journalctl -u <service>` hoặc console trình duyệt) nếu có lỗi.

## Gợi ý kiểm thử nhanh (2 tab, 2 tài khoản)

1. Tab A gõ `/moi B`, tab B bấm Đồng ý ở thông báo trên đầu. Cùng hạ 1 con ốc sên: cả hai cùng nhận EXP.
2. Cho A đủ 500 vàng và cấp 5, lập bang, mời B, B quyên góp, xem quỹ tăng.
3. A mời giao dịch B (đứng gần nhau), cùng khóa và xác nhận; kiểm tra túi đồ hai bên.
4. A đăng bán một món ở tab Chợ, B mua; A nhận thư vàng đã trừ 5%.
5. Cường hóa vài lần ở tab Cường hóa, thoát ra vào lại: cấp `+N` phải còn nguyên.
