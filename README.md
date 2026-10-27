# Aetherfall Online

Game nhập vai 3D chạy trên trình duyệt, có đăng nhập, lưu dữ liệu trên máy chủ, thấy người chơi khác, chat, kết bạn và trang quản trị.

Máy chủ chỉ cần **Node.js 22.13 trở lên**, không cần cài thêm thư viện nào (không cần `npm install`). Database là SQLite có sẵn trong Node, lưu ở một file `data/aetherfall.db`.

## Có gì trong bản này

| Phần | Chức năng |
| --- | --- |
| Tài khoản | Đăng ký, đăng nhập, ghi nhớ đăng nhập 30 ngày, đăng xuất. Mật khẩu được mã hóa (scrypt). |
| Lưu dữ liệu | Cấp, EXP, vàng, túi đồ, trang bị, nhiệm vụ, vị trí nhân vật được lưu trên máy chủ. Đăng nhập máy khác vẫn chơi tiếp được. |
| Chơi online | Thấy người chơi khác di chuyển, đánh, né; thấy bộ trang bị họ đang mặc; tên và cấp trên đầu. |
| Quái và boss chung | Mọi người thấy cùng một bầy quái và cùng đánh một con boss. Máy chủ điều khiển quái, tính sát thương, chí mạng, ai được EXP. Ai góp sát thương đều nhận EXP, vàng và đồ rơi riêng của mình. |
| Kinh tế do máy chủ giữ | EXP, cấp, vàng, đồ rơi, túi đồ, mặc/tháo/bán đồ, bình máu, tiến độ nhiệm vụ đều do máy chủ tính và lưu. Trình duyệt không tự sửa được. |
| Chat | Kênh Thế giới, nhắn riêng `/w tên nội dung`, trả lời `/r`, lọc từ ngữ thô tục, chống spam. |
| Bạn bè | Gửi lời mời, đồng ý/từ chối, xem ai đang online, nhắn tin nhanh, xóa bạn. Có thông báo khi bạn online. |
| Quà | Admin gửi vàng, bình máu, vật phẩm vào hộp thư; người chơi nhận ngay hoặc ở lần đăng nhập sau. |
| Báo cáo | Người chơi gõ `/report tên lý do` để báo cáo vi phạm. |
| Trang Admin | `/admin`: tổng quan, người đang online, tìm người chơi, xem túi đồ và chat, đưa ra khỏi game, cấm chat, khóa tài khoản, đổi vai trò, gửi quà, thông báo, xử lý báo cáo, nhật ký mọi thao tác. |
| Chống gian lận | Máy chủ chặn dịch chuyển tức thời, kiểm tra tầm đánh và thời gian hồi chiêu, tự tính chỉ số vật phẩm, chỉ nhặt được đồ ở gần. |

**Giới hạn hiện tại:** máu của người chơi vẫn do trình duyệt tính (quái gửi đòn đánh, trình duyệt tự trừ máu theo phòng thủ). Chết không mất gì nên ảnh hưởng nhỏ, nhưng đợt sau sẽ chuyển cả máu người chơi lên máy chủ. Mana và thể lực cũng vậy.

## Chạy thử trên máy tính

```bash
cd aetherfall-online
cp .env.example .env
node --disable-warning=ExperimentalWarning server/index.js
```

Mở `http://localhost:3000`. Tài khoản **đầu tiên** bạn tạo sẽ tự là Admin. Trang quản trị ở `http://localhost:3000/admin`.

Muốn thử 2 người chơi: mở thêm một cửa sổ ẩn danh, tạo tài khoản thứ hai.

## Đưa lên VPS (Ubuntu 22.04 hoặc 24.04)

Thay `tengame.com` bằng tên miền của bạn. Nếu chưa có tên miền, dùng IP của VPS và bỏ qua bước 7.

**1. Trỏ tên miền về VPS.** Trong trang quản lý tên miền, tạo bản ghi `A` cho `tengame.com` (và `www`) trỏ về IP của VPS.

**2. Đăng nhập VPS và cập nhật hệ thống**

```bash
ssh root@IP_VPS
apt update && apt upgrade -y
```

**3. Cài Node.js 22 và Nginx**

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs nginx
node -v   # phải ra v22.13 trở lên
```

**4. Tạo người dùng riêng cho game và đưa code lên**

```bash
adduser --disabled-password --gecos "" aetherfall
```

Từ máy tính của bạn, gửi thư mục game lên VPS:

```bash
scp -r aetherfall-online root@IP_VPS:/home/aetherfall/app
```

Trên VPS:

```bash
cd /home/aetherfall/app
cp .env.example .env
nano .env          # điền ADMIN_USERNAME là tên tài khoản bạn sẽ dùng làm Admin
chown -R aetherfall:aetherfall /home/aetherfall/app
```

**5. Cho game tự chạy bằng systemd**

```bash
cp deploy/aetherfall.service /etc/systemd/system/aetherfall.service
systemctl daemon-reload
systemctl enable --now aetherfall
systemctl status aetherfall      # thấy "active (running)" là được
journalctl -u aetherfall -f      # xem log trực tiếp (Ctrl+C để thoát)
```

**6. Cấu hình Nginx**

```bash
cp deploy/nginx-aetherfall.conf /etc/nginx/sites-available/aetherfall
nano /etc/nginx/sites-available/aetherfall    # sửa tengame.com thành tên miền của bạn
ln -s /etc/nginx/sites-available/aetherfall /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

Lúc này mở `http://tengame.com` là vào được game.

**7. Bật HTTPS miễn phí**

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d tengame.com -d www.tengame.com
```

Certbot tự sửa cấu hình Nginx và tự gia hạn chứng chỉ. Game tự chuyển sang `wss://` khi chạy HTTPS, không cần sửa code.

**8. Mở tường lửa**

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

Không mở cổng 3000 ra ngoài. Người chơi chỉ đi qua Nginx.

**9. Tạo tài khoản Admin.** Vào `https://tengame.com`, đăng ký đúng tên đã điền ở `ADMIN_USERNAME` (hoặc là tài khoản đầu tiên trên máy chủ). Sau đó vào `https://tengame.com/admin`.

**10. Sao lưu database mỗi ngày**

```bash
chmod +x /home/aetherfall/app/deploy/backup.sh
crontab -u aetherfall -e
```

Thêm dòng này rồi lưu lại:

```
30 3 * * * /home/aetherfall/app/deploy/backup.sh
```

Bản sao lưu nằm ở `/home/aetherfall/app/backups`, giữ 14 ngày gần nhất. Nên tải định kỳ một bản về máy của bạn.

## Cập nhật phiên bản mới

```bash
# trên máy bạn: gửi các thư mục server/ và public/ mới lên (không ghi đè data/ và .env)
scp -r server public root@IP_VPS:/home/aetherfall/app/
# trên VPS
chown -R aetherfall:aetherfall /home/aetherfall/app
systemctl restart aetherfall
```

Khi tắt hoặc khởi động lại, máy chủ tự lưu dữ liệu của mọi người đang online.

## Xem database trực tiếp

Cách dễ nhất là trang `/admin`. Nếu muốn xem bảng dữ liệu thô:

- Cài **DBeaver** trên máy tính, tạo kết nối SQLite, chọn **SSH tunnel** tới VPS và mở file `/home/aetherfall/app/data/aetherfall.db`.
- Hoặc tải bản sao lưu trong `backups/` về máy, giải nén rồi mở bằng DB Browser for SQLite.

Các bảng chính: `users` (tài khoản), `characters` (dữ liệu nhân vật dạng JSON), `friends`, `mail` (quà), `reports`, `chat_log`, `admin_log`, `sessions`.

## Cấu trúc thư mục

```
server/index.js    máy chủ web, API, trang admin, WebSocket
server/game.js     người chơi online, đồng bộ vị trí, EXP, vàng, đồ rơi, túi đồ, nhiệm vụ, chat, bạn bè, quà
server/world.js    quái và boss dùng chung: di chuyển, tấn công, chết, hồi sinh
public/js/rules.js luật chung: quái, đòn đánh, nhiệm vụ, công thức cấp độ
server/auth.js     đăng ký, đăng nhập, phiên đăng nhập
server/db.js       database SQLite và các bảng
server/ws.js       WebSocket tự viết, không cần thư viện
public/index.html  game
public/admin.html  trang quản trị
public/js/items.js luật vật phẩm dùng chung cho game và máy chủ
deploy/            cấu hình Nginx, systemd, script sao lưu
```

## Xử lý sự cố

| Hiện tượng | Cách xử lý |
| --- | --- |
| Vào trang báo 502 Bad Gateway | Game chưa chạy. Xem `systemctl status aetherfall` và `journalctl -u aetherfall -n 50`. |
| Đăng nhập được nhưng không vào game, báo mất kết nối | Kiểm tra khối `location /ws` trong cấu hình Nginx, rồi `nginx -t && systemctl reload nginx`. |
| Lỗi `node:sqlite` khi chạy | Node quá cũ. Chạy `node -v`, cần v22.13 trở lên. |
| Quên mật khẩu Admin | Tạm thời đặt `ADMIN_USERNAME` thành một tên mới trong `.env`, khởi động lại, đăng ký tên đó. |
