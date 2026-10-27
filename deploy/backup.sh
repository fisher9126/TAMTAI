#!/usr/bin/env bash
# Sao lưu database mỗi ngày, giữ 14 bản gần nhất.
# Cài: chmod +x deploy/backup.sh && crontab -e  rồi thêm dòng:
#   30 3 * * * /home/aetherfall/app/deploy/backup.sh
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB="${DB_FILE:-$APP_DIR/data/aetherfall.db}"
OUT="$APP_DIR/backups"
mkdir -p "$OUT"
STAMP="$(date +%Y%m%d-%H%M)"
# Dùng chính Node để sao lưu an toàn khi game đang chạy
node --disable-warning=ExperimentalWarning -e "
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(process.argv[1]);
db.exec(\"VACUUM INTO '\" + process.argv[2].replace(/'/g,\"''\") + \"'\");
" "$DB" "$OUT/aetherfall-$STAMP.db"
gzip -f "$OUT/aetherfall-$STAMP.db"
ls -1t "$OUT"/aetherfall-*.db.gz | tail -n +15 | xargs -r rm --
echo "Đã sao lưu: $OUT/aetherfall-$STAMP.db.gz"
