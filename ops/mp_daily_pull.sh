#!/bin/bash
# Daily MP QuKis pull (09:00 WIB) — update export_summary.json (D-1) + raw untuk filter range.
# Silent kalau sukses; stdout tail log + exit 1 kalau gagal (cron watchdog alert).
#
# 14 Sep 2026: watchdog lama salah lapor — dia grep "FAIL" ke SELURUH logs_daily_pull.log,
# jadi sekali ada kegagalan di masa lalu semua run berikutnya dianggap gagal. Sekarang cek
# hanya output run ini (file sementara). Tambah juga verifikasi kelengkapan raw vs live.
cd /home/ubuntu/shopee-backend || exit 1
D1=$(date -d "yesterday" +%Y-%m-%d)
LOG=/home/ubuntu/shopee-backend/logs_daily_pull.log
RUN=$(mktemp)

{
  echo "=== $(date '+%F %T') pull_export $D1 ==="
  python3 pull_export.py "$D1" || echo "PULL_EXPORT_FAIL"
  echo "--- pull_range $D1 ---"
  python3 pull_range.py "$D1" "$D1" || echo "PULL_RANGE_FAIL"
  echo "--- verifikasi kelengkapan (2 hari terakhir) ---"
  python3 verify_raw.py 2 || echo "VERIFY_FAIL"
} > "$RUN" 2>&1

cat "$RUN" >> "$LOG"

if grep -q "PULL_EXPORT_FAIL\|PULL_RANGE_FAIL\|VERIFY_FAIL" "$RUN"; then
  echo "MP daily pull GAGAL (lihat log):"
  tail -60 "$RUN"
  rm -f "$RUN"
  exit 1
fi

rm -f "$RUN"
exit 0
