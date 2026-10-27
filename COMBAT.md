# Đợt 1: chiến đấu do máy chủ quyết định

Trước đây trình duyệt tự trừ máu khi quái đánh trúng, tự hồi máu, tự quyết định lúc chết. Bây giờ **máy chủ giữ máu và mana của người chơi**, tính sát thương, trạng thái, chết và hồi sinh. Trình duyệt chỉ gửi hành động (đánh, né, đỡ) và vẽ kết quả máy chủ báo về.

## Cài đặt

1. Chép vào thư mục gốc repo (giữ nguyên thư mục con):
   ```
   apply-combat.js
   server/combat.js
   public/js/combat.js
   ```
2. Chạy một lần trong thư mục gốc repo. Lệnh này sửa `server/game.js`, `server/world.js`, `public/index.html` (mỗi file có bản `.combat.bak`), bỏ qua nếu đã chạy rồi, và không ghi gì vào file nào có dòng không khớp:
   ```
   node apply-combat.js
   ```
   Phải thấy 3 dòng `[ok]`. Chạy trước hay sau `apply-upgrade.js` và `apply-controls.js` đều được.
3. Khởi động lại server, tải lại trang (Ctrl/Cmd+Shift+R):
   ```
   chown -R aetherfall:aetherfall /home/aetherfall/app
   systemctl restart aetherfall
   journalctl -u aetherfall -n 30 --no-pager
   ```

Quay lại bản cũ: chép các file `*.combat.bak` về tên cũ, rồi xóa `server/combat.js` và `public/js/combat.js`.

**Lưu ý:** phải vá cả máy chủ lẫn trình duyệt trong cùng một lần. Máy chủ mới không còn gửi tin `ehit` cũ, nên nếu chỉ vá một nửa thì quái đánh không trừ máu.

## Có gì mới

| Tính năng | Chi tiết |
|---|---|
| Máu/mana do máy chủ giữ | Quái đánh: máy chủ tính sát thương = (sức đánh − 0.6 × giáp) ± 10%. Máy chủ tự hồi máu (2%/giây sau 6 giây không bị đánh), hồi mana (3/giây), hồi đầy khi lên cấp. Chết do máy chủ quyết định; người chết không đánh, không di chuyển được cho tới khi bấm hồi sinh. |
| Mana kỹ năng | Chém xoáy 15, Lao tới 10: máy chủ trừ và từ chối nếu không đủ, kể cả khi trình duyệt cố gửi. |
| Bình máu | Hồi 40% máu tối đa do máy chủ cộng; không dùng được khi đã đầy máu hoặc đang chết. |
| Né (Space) | Báo lên máy chủ; máy chủ cho 0.5 giây bất tử, tối đa mỗi 0.7 giây một lần. Hiện "Né!" khi tránh được. |
| Đỡ đòn (chuột phải) | Giữ thế 0.6 giây, hồi 1.5 giây. Đòn trúng khi đang đỡ giảm 60% sát thương. Nếu đỡ trong 0.37 giây đầu là **đỡ hoàn hảo**: không mất máu, quái bị choáng 1.2 giây. |
| Trạng thái | Bỏng (ốc sên, 35%): trừ máu mỗi nửa giây trong 4 giây. Chậm (cú mèo, 40%): đi chậm 40% trong 3 giây. Độc (boss, 50%): trừ máu 5 giây. Choáng (boss húc trúng): đứng yên 1 giây, không đánh, không né. Hiện chip có đếm giờ dưới khung nhân vật. |
| Thách đấu 1v1 | `/duel tên` mời người đứng gần (trong 40m). Đối phương gõ `/duel ok`. Đếm 3 giây rồi đánh: sát thương lên người ×0.6, có né, đỡ, đỡ hoàn hảo. Thua không mất đồ, không chết (hồi 30% máu). Thanh máu đối thủ hiện giữa màn hình. `/duel stop` để đầu hàng, `/duel top` xem xếp hạng thắng thua. Hết 5 phút hoặc đi quá xa nhau thì hòa. |
| Kết nối lại | Rớt mạng và vào lại trong 60 giây thì giữ nguyên máu và mana, không "hồi máu miễn phí" bằng cách thoát vào lại. |

## Chưa làm trong đợt này

- Thể lực (chạy nhanh, né) vẫn do trình duyệt tính; máy chủ chỉ giới hạn tần suất né.
- Tốc độ chậm/choáng được áp dụng ở trình duyệt; máy chủ chỉ chặn đòn đánh của người đang choáng. Người sửa trình duyệt vẫn có thể đi khi bị chậm.
- Chưa có hiệu ứng nguyên tố, boss nhiều giai đoạn, khóa mục tiêu.
- PvP ngoài thách đấu (đấu trường xếp hạng, vùng PvP tự do, công thành) chưa có.
- **Chưa chạy thử lần nào.** Đây là đợt sửa sâu nhất vào code cũ, hãy thử trên bản sao với 2 tài khoản trước.

## Gợi ý kiểm thử

1. Đứng cạnh ốc sên và để nó đánh: máu giảm, có thể bị bỏng (chip "Bỏng" hiện). Đứng yên 6 giây: máu tự hồi.
2. Bấm chuột phải ngay trước khi quái vung: phải ra "Đỡ hoàn hảo!" và quái đứng khựng.
3. Bấm Space đúng lúc quái đánh: ra "Né!".
4. Với người dùng thường, thanh máu bị máy chủ ghi đè mỗi 0.5 giây, nên sửa số máu ở trình duyệt không giúp sống sót.
5. Hai tài khoản: `/duel tên`, `/duel ok`, đánh nhau, kiểm tra thắng thua và `/duel top`.
