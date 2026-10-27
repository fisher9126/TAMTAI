# Đợt 2: tạo nhân vật, chủng tộc, 5 lớp, điểm chỉ số, lớp nâng cao

**Cần Đợt 1 (`apply-combat.js`) đã chạy trước.** Đợt này dùng máu/mana do máy chủ giữ.

## Cài đặt

1. Chép vào thư mục gốc repo (giữ thư mục con, **ghi đè** các file đã có):
   ```
   apply-class.js                (mới)
   server/character.js           (mới)
   public/js/classes.js          (mới)
   server/combat.js              (ghi đè, bản mới)
   server/social.js              (ghi đè, bản mới)
   public/js/combat.js           (ghi đè, bản mới)
   public/js/rules.js            (ghi đè, bản mới)
   ```
2. Chạy một lần trong thư mục gốc repo. Lệnh sửa `server/game.js`, `server/world.js`, `public/index.html` (mỗi file có bản `.class.bak`), dừng và không ghi gì vào file nào có dòng không khớp:
   ```
   node apply-class.js
   ```
   Phải thấy 3 dòng `[ok]`. Nếu báo "chưa được vá bằng apply-combat.js" thì chạy `node apply-combat.js` trước.
3. Khởi động lại và tải lại trang:
   ```
   chown -R aetherfall:aetherfall /home/aetherfall/app
   systemctl restart aetherfall
   journalctl -u aetherfall -n 30 --no-pager
   ```
   Tải lại trình duyệt bằng Ctrl/Cmd+Shift+R.

Quay lại bản cũ: chép các file `*.class.bak` về tên cũ.

## Lần đầu vào game

Mọi nhân vật hiện có (kể cả đã chơi) sẽ thấy **màn hình tạo nhân vật** ở bên phải. Mô hình của bạn ở giữa màn hình, quay mặt về phía bạn và đổi theo từng lựa chọn. Cấp, vàng, đồ giữ nguyên. Bạn chưa tạo xong thì chưa đánh được và quái chưa đánh được bạn.

- **Chủng tộc** (4): Con người +5% EXP; Elf +15% mana, hồi mana nhanh hơn 50%; Người lùn +10% máu, +10% giáp, chịu độc giảm 50%; Orc +8% sức đánh và cuồng nộ khi máu dưới 30% (thêm 25% sức đánh).
- **Giới tính, ngoại hình:** nam/nữ, 6 màu da, 4 kiểu tóc (ngắn, dài, nhọn, trọc), 8 màu tóc, 8 màu áo. Người chơi khác thấy đúng ngoại hình, kích cỡ theo chủng tộc (lùn thấp, orc to).
- **Chủng tộc, giới tính, lớp không đổi được sau này** (chưa có tính năng đổi). Ngoại hình cũng chưa đổi được sau khi tạo.

## 5 lớp nhân vật

Phím **1-4** dùng 4 kỹ năng của lớp, mở dần theo cấp. Đánh thường là **J** hoặc click chuột trái. Hồi chiêu và mana do máy chủ kiểm tra.

| Lớp | Đặc điểm | Đánh thường | Kỹ năng 1 / 2 / 3 / 4 (cấp mở) |
|---|---|---|---|
| Chiến binh | +25% máu, +20% giáp, ít mana | Chém cận chiến | Chém xoáy (1) · Lao tới (3) · Chấn động, choáng quái (10) · Giáp sắt, giảm 40% sát thương 8 giây (20) |
| Pháp sư | +25% sức đánh, +60% mana, mỏng máu | Phép bắn tầm 14m | Cầu lửa (1) · Băng giá, làm chậm (5) · Sấm sét, choáng ngắn (12) · Thiên thạch (20) |
| Cung thủ | +15% sức đánh, nhanh, chí mạng | Bắn cung tầm 16m | Tên xuyên (1) · Mưa tên (5) · Tên choáng (12) · Loạt tên (20) |
| Sát thủ | +20% sức đánh, +10% chí mạng, +8% tốc độ | Đâm nhanh | Đâm lén (1) · Ẩn thân, quái mất dấu 5 giây (5) · Loạt dao (12) · Hạ sát (20) |
| Hồi máu | +50% mana, tấn công yếu | Thánh kích tầm 10m | Chữa lành bạn và đồng đội 30% máu (1) · Thánh quang (5) · Ban phước, +15% sức đánh đồng đội 12 giây (12) · Hồi sinh đồng đội ngã (20) |

Kỹ năng tầm xa sẽ vẽ một tia sáng từ bạn tới mục tiêu. Kỹ năng đánh vùng quanh người vẽ vòng sóng.

## Điểm chỉ số và lớp nâng cao (phím **C** hoặc nút "Nhân vật")

- Mỗi cấp được 3 điểm. Sức mạnh +2 sức đánh; Nhanh nhẹn +0.4% chí mạng và +0.25% tốc độ; Trí tuệ +5 mana; Thể lực +12 máu, +0.5 giáp; Tinh thần +4 mana, +0.3 giáp.
- **Tẩy điểm:** miễn phí dưới cấp 10, từ cấp 10 tốn cấp × 50 vàng.
- **Lớp nâng cao ở cấp 30**, chọn 1 trong 2 nhánh mỗi lớp (ví dụ Chiến binh → Hiệp sĩ thánh hoặc Kẻ hủy diệt). Chỉ số được cộng thêm, không đổi được sau khi chọn.

## Chưa làm / hạn chế (nói thẳng)

- **Một nhân vật mỗi tài khoản.** Nhiều nhân vật cần đổi cách lưu của cả trò chơi.
- **Chưa đổi được lớp, chủng tộc, ngoại hình** sau khi tạo.
- Lớp nâng cao **chưa có kỹ năng riêng**, chỉ cộng chỉ số.
- Chưa có cây kỹ năng 3 nhánh, nâng bậc kỹ năng, bộ kỹ năng lưu sẵn. Mỗi lớp chỉ có 1 đánh thường + 4 kỹ năng.
- Tài nguyên của mọi lớp là **mana** (chưa có Nộ, Năng lượng riêng).
- Kỹ năng đánh theo vùng/tầm xa hiện trúng tức thì, không có đạn bay thật. Ẩn thân chỉ làm quái mất dấu, chưa tăng sát thương đòn đầu. Hạ sát chưa mạnh hơn khi mục tiêu yếu máu.
- Ngoại hình chỉ gồm màu và kiểu tóc đơn giản; Elf chưa có tai nhọn, chưa có xăm hay sẹo.
- Thể lực vẫn do trình duyệt tính.
- **Chưa chạy thử lần nào.** Đây là đợt sửa nhiều nhất; hãy thử trên bản sao với 2 tài khoản trước.

## Gợi ý kiểm thử

1. Vào game bằng tài khoản có sẵn: thấy màn hình tạo nhân vật; đổi lựa chọn thì mô hình ở giữa đổi theo.
2. Bấm "Bắt đầu phiêu lưu": hết khóa, phím 1-4 hiện tên kỹ năng ở thanh dưới, bấm C xem bảng nhân vật.
3. Tạo Pháp sư: click chuột trái bắn từ xa, thấy tia sáng; phím 1 là Cầu lửa.
4. Lên cấp, vào bảng C cộng điểm, tẩy điểm; mở lại trang xem điểm còn nguyên.
5. Hai tài khoản: thấy nhau đúng màu da/tóc/áo; Hồi máu dùng phím 1 chữa lành đồng đội trong tổ đội.
