# Đợt 3: vùng đất mới, nghề và chế tạo, hầm ngục tổ đội

Đợt này không cần Đợt 1 hay Đợt 2 (nhưng nên có đủ). Nó chạy độc lập và vá `server/world.js`, `server/game.js`, `public/index.html` bằng các dòng riêng.

## Cài đặt

1. Chép vào thư mục gốc repo (giữ thư mục con, **ghi đè** các file đã có):
   ```
   apply-zones.js         (mới)
   server/zones.js        (mới)
   public/js/zones.js     (mới)
   public/js/rules.js     (ghi đè, bản mới)
   server/social.js       (ghi đè, bản mới, để thuốc tăng EXP có tác dụng)
   ```
2. Chạy một lần trong thư mục gốc repo:
   ```
   node apply-zones.js
   ```
   Phải thấy 3 dòng `[ok]` cho `world.js`, `game.js`, `index.html` và một dòng `[ok] ... ?v=4`. Mỗi file có bản `.zones.bak`. Nếu có dòng không khớp, file đó không bị ghi gì và script báo rõ.
3. Khởi động lại và tải lại trang:
   ```
   chown -R aetherfall:aetherfall /home/aetherfall/app
   systemctl restart aetherfall
   journalctl -u aetherfall -n 30 --no-pager
   ```
   Tải lại trình duyệt bằng Ctrl/Cmd+Shift+R. Script đã gắn `?v=4` vào các thẻ script nên trình duyệt của bạn bè cũng tự lấy file mới.

Quay lại bản cũ: chép các file `*.zones.bak` về tên cũ.

## 3 vùng đất mới (cùng một bản đồ, đi bộ tới)

| Vùng | Vị trí so với làng | Quái | Quái đầu vùng | Nguyên liệu |
|---|---|---|---|---|
| Đầm Lầy Nấm Độc (cấp 7-12) | Tây Nam | Funghino Tossico, Ragno Pentola | Re Nấm Bùn | Nấm phát sáng, Tuyến độc |
| Mỏ Quặng Gỉ Sét (cấp 10-15) | Nam | Chuột Chũi Búa, Golem Nồi Cơm | Vua Quặng Gỉ | Quặng gỉ, Than đá, Đá quý |
| Cánh Đồng Tủ Lạnh (cấp 13-19) | Tây Bắc | Pinguino Tủ Lạnh, Orso Ghiacciolo | Regina Gelata | Hoa băng, Da lông băng |

Mỗi vùng có nền đổi màu, cảnh vật riêng và biển tên lơ lửng; vào vùng sẽ có thông báo. Quái đầu vùng luôn rơi đồ và hồi sinh sau 2-3 phút.

**Quái mới dùng lại mô hình cũ**, đổi màu và phóng to (ví dụ Re Nấm Bùn là ốc sên đỏ khổng lồ). Mình chưa dựng mô hình 3D riêng cho từng loài.

## Nghề (phím P hoặc nút "Nghề")

5 nghề, mỗi nghề cấp 1 đến 15.

- **Khai thác:** Khai khoáng (quặng, than, đá quý) và Hái thuốc (cỏ trà, nấm, hoa băng). Đứng cạnh điểm khai thác (có vòng sáng dưới đất) và nhấn **E**. Điểm mọc lại sau 40-55 giây. Nghề cao hơn thì được nhiều hơn và dễ có nguyên liệu hiếm.
- **Quái cũng rơi nguyên liệu** (vỏ ốc, lông cú, tuyến độc, bánh răng, lõi tro...). Nguyên liệu không chiếm túi đồ, xem ở tab Kho.
- **Rèn:** 15 công thức, mỗi ô trang bị có Hiếm (cấp 1), Sử thi (cấp 6), Huyền thoại (cấp 12, cần Lõi tro và Đá quý). Cấp vật phẩm = cấp nhân vật, nhưng bị giới hạn bởi cấp nghề (cấp nghề 1 tối đa 8, cấp 6 tối đa 28, cấp 12 tối đa 52). Có cơ hội "chế tác tinh xảo" tặng thêm +1.
- **Giả kim:** bình máu x3 và x10, Tinh chất Tăng EXP, Thuốc Da Đá, Thuốc Cuồng Lực.
- **Nấu ăn:** Bánh Ấm Trà (+máu), Súp Lông Cú (+tốc độ), Thịt Nướng Băng (+sức đánh), Lẩu Quặng Hầm (+30% máu).
- Thuốc và món ăn dùng ở tab Kho, mỗi loại chỉ giữ 1 hiệu ứng (dùng cái mới thì thay cái cũ), kéo dài 10-20 phút. **Hiệu ứng không lưu khi thoát game.**

## Hầm ngục Tro Đen (tổ đội)

- Cổng ở phía Nam làng, có biển tên và vòng sáng tím. Cấp 12 trở lên, mỗi ngày 4 lượt (tính theo giờ Việt Nam).
- **Đội trưởng nhấn E ở cổng**: các thành viên đứng trong 20 mét quanh cổng vào cùng. Chơi một mình cũng được. Nếu một người chưa đủ cấp hoặc hết lượt, cả đội chưa vào được và game nói rõ tên người đó.
- 3 đợt: 4 Cinderino, rồi 3 Cinderino + 3 Gufo Ombra, rồi boss **Re Tro Đen** (có chiêu húc giống Lavatricio). 15 phút. Đội càng đông quái càng nhiều máu (+65% mỗi người thêm) và đánh mạnh hơn (+10%).
- **Quái trong hầm ngục chỉ thành viên thấy và đánh được.** Người ngoài không vào được phòng (máy chủ đẩy ra).
- Thắng: kinh nghiệm, vàng, 3 bình máu, Lõi tro / Đá quý / Bánh răng; boss còn rơi trang bị Sử thi / Huyền thoại cho từng người như boss đấu trường. 25 giây sau cả đội được đưa ra cổng.
- Chết giữa chừng: bấm Hồi sinh ở làng rồi nhấn E ở cổng để quay lại (không tốn thêm lượt). Cả đội ra khỏi hầm ngục 40 giây hoặc hết 15 phút thì thất bại và quái biến mất.

## Chưa làm / hạn chế (nói thẳng)

- **Chưa chạy thử lần nào.** Đây là đợt thêm nhiều nhất; hãy thử với 2 tài khoản trước khi mời bạn bè.
- Không có bản đồ nhỏ cho vùng mới, không có đường đi hay hang động thật; mọi vùng là bãi đất mở trên cùng địa hình, chỉ khác màu nền và cảnh vật.
- Hầm ngục là một căn phòng tròn trên bản đồ chính (gần mép phía Bắc), không phải bản đồ riêng. Người ngoài thấy cột đá nhưng không vào được.
- Boss hầm ngục dùng mô hình bò máy giặt đổi màu. Chưa có cơ chế boss mới.
- Nghề chưa có chuyên môn hóa, không bán nguyên liệu cho người khác, chưa có chợ nguyên liệu và chưa thể rã đồ lấy nguyên liệu.
- Phần thưởng và độ khó là con số mình ước lượng, chưa cân bằng bằng cách chơi thật. Nếu quá dễ hoặc quá khó, báo mình số liệu để chỉnh.
- Hiệu ứng thuốc và món ăn mất khi thoát game.

## Gợi ý kiểm thử

1. Sau khi cài, vào game: thấy nút "Nghề (P)" ở bên trái, thấy cổng tím phía Nam làng.
2. Đi tới Đầm Lầy (Tây Nam): thấy thông báo vào vùng, nền xanh, nấm lớn, quái màu xanh/tím. Đứng cạnh cụm nấm phát sáng, nhấn E (cần Hái thuốc cấp 3; cỏ trà cấp 1 ở quanh làng).
3. Mở P: tab Chế tạo, chọn Nấu ăn, chế Bánh Ấm Trà (cần Vỏ ấm trà từ ốc sên và Cỏ trà), rồi dùng ở tab Kho: góc trái trên có chip hiệu ứng.
4. Hai tài khoản lập tổ đội (K), cả hai cấp 12+, đội trưởng nhấn E ở cổng: cả hai vào hầm ngục, thanh tiến độ hiện ở giữa trên. Tài khoản thứ ba đứng ngoài không thấy quái trong phòng.
5. Hạ boss: có bảng phần thưởng, 25 giây sau ra cổng. Mở P tab Hầm ngục xem số lượt còn lại giảm.
