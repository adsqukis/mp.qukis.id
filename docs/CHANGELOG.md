# Changelog — MP QuKis Dashboard

## 14 Sep 2026

### Data pesanan live untuk tanggal yang raw-nya belum ada
- Tab Pesanan default ("7 hari terakhir") sebelumnya **tidak mengirim `from`/`to`** → yang tampil file `export_summary.json` (data D-1), bukan 7 hari.
- Tanggal yang raw-nya belum ada (termasuk **hari ini**) selalu fallback ke D-1 → filter "Hari ini" pun menampilkan angka kemarin.
- Sekarang: `app.py::_live_day_recs()` + `_merge_live_recs()` menarik tanggal tsb **langsung dari Shopee API**, digabung dengan raw.
  Batas `LIVE_MAX_DAYS = 7`, cache `LIVE_ORDERS_TTL = 300` detik per tanggal (`live_day_cache_<tgl>.json`).
- Response menandai: `_live_days` + `_live_note` (UI menampilkan catatan ℹ️).
- Frontend: semua preset kirim `from`/`to`; auto-refresh 60 detik; chart harian ikut filter.
- Hasil: "Hari ini" 68 order (sebelumnya selalu 107 = angka kemarin), "7 hari" 1.161 → 1.475.

### Perbaikan data bolong (kasus 9 Sep 2026)
- Ditemukan: raw **9 Sep** cuma 150 order, padahal di Shopee **455** (305 hilang). Audit penuh 1 Jul–13 Sep: hanya 9 Sep & **7 Juli** (430 vs 480) yang bolong — dua-duanya sudah ditarik ulang (455 & 480).
- Penyebab: pola `if not resp.get("more") or not lst: break` — satu halaman balas respons kosong (error/rate limit) → loop berhenti, script tetap dianggap sukses, data kurang tetap ditulis.
- Perbaikan di 3 tempat (`pull_range.pull_day`, `pull_export.pull_orders`, `app._live_day_recs`):
  retry 4x, deteksi halaman kosong berturut-turut → error, verifikasi tiap `order_sn` punya detail.
- Tambah `verify_raw.py` (raw vs hitung live) — dipanggil otomatis di akhir `ops/mp_daily_pull.sh`, `exit 1` kalau ada yang kurang.

### Watchdog pull
- `mp_daily_pull.sh` lama grep `PULL_*_FAIL` ke **seluruh** log → satu kegagalan lama membuat semua run berikutnya `exit 1` walau sukses.
- Sekarang hanya memeriksa output run yang sedang jalan.

## 12 Sep 2026

### Mode realtime iklan
- Masalah: `/api/ads/overview` cache 60 menit dan **tanpa warm-up** → tab Overview bisa menampilkan angka iklan ±11 jam basi (terukur 39.047 detik).
- Sekarang: `ADS_OVERVIEW_TTL = 60` detik, `ADS_REALTIME_TTL = 30` detik, warmer tiap 60 detik yang **langsung menulis cache**.
- Tambah endpoint `/api/ads/realtime`: total hari ini + rincian **per jam** + `get_total_balance` + `get_shop_toggle_info`.
- Frontend: tab Overview auto-refresh 60 detik; rentang 1 hari di tab Ads → chart **per jam**; subtitle menampilkan jam data terakhir + saldo iklan.
- Batas jujur: sisi kita maksimal 1 menit di belakang Shopee; angka Shopee sendiri naik bertahap (ada jeda 3–5 menit diam).
