<!--
Versi PUBLIK (disanitasi) dari dokumen handover MP QuKis.
Yang dihapus dari versi internal: IP server, host & user cPanel, path absolut server.
Nilainya TIDAK boleh ditaruh di repo publik — minta lewat jalur privat.
-->

# HANDOVER — MP QuKis Dashboard (`mp.qukis.id`)

Dokumen operasional penuh. Dibuat untuk agent (Claude) yang akan mengambil alih maintenance.
Disusun: 11 Sep 2026 oleh **Kowalski** (Hermes agent, VPS `<VPS_IP>`).
Sumber kebenaran = file di server. Kalau dokumen ini beda dengan kondisi server → **server yang benar**, update dokumennya.

---

## 1. Arsitektur (3 tempat)

```
                 ┌─────────────────────────── Hostinger (LiteSpeed) ───────────────────────────┐
Browser ────────▶│ mp.qukis.id  →  static hasil `vite build` (React)                          │
   │             │ docroot: /home/<CPANEL_USER>/public_html/mp.qukis.id                          │
   │             └───────────────────────────────────────────────────────────────────────────┘
   │  fetch JSON (HTTPS)
   ▼
┌─────────────────────────── VPS Hermes — <VPS_IP> ───────────────────────────┐
│ api.qukis.id  →  Caddy (:443, reverse_proxy 127.0.0.1:5010)                      │
│                  → python3 app.py  (http.server / ThreadingHTTPServer)           │
│                    ~/shopee-backend                                   │
│                  → Shopee Open Platform (partner.shopeemobile.com)               │
│                                                                                  │
│ Cron harian (Hermes cron) → mp_daily_pull.sh → pull_export.py + pull_range.py    │
└──────────────────────────────────────────────────────────────────────────────────┘

Frontend source : ~/shopee-seller-hub
Repo GitHub     : github.com/adsqukis/mp.qukis.id   (PUBLIC — jangan pernah commit secret)
Shop Shopee     : "Generos Official Store" (region ID, status NORMAL)
```

Alasan desain: **partner key Shopee tidak boleh disimpan di Hostinger** → backend harus di VPS.
Frontend cuma static; semua data ditarik backend dan dilayani sebagai JSON.

---

## 2. Lokasi file (VPS)

**Backend — `~/shopee-backend/`**
- `app.py` — server HTTP + semua endpoint + client Shopee (sign, token refresh, cache). ±53 KB / 1330 baris.
- `pull_export.py` — tarik data pesanan langsung dari Shopee API → `export_summary.json` (D-1 default).
- `pull_range.py` — tarik rentang tanggal → raw + summary range.
- `parse_export.py` — jalur lama (parse file xlsx export Seller Centre). Sudah tidak dipakai untuk harian.
- `cpapi.py` — helper login cPanel + JSON API (ZoneEdit, Fileman).
- `deploy_mp.py` — deploy `dist/` frontend ke docroot mp.qukis.id via cPanel Fileman API.
- `.env` — `SHOPEE_PARTNER_ID_LIVE`, `SHOPEE_PARTNER_KEY_LIVE`.
- `token.json` — `shop_id`, `access_token`, `refresh_token`, `expire_in`, `obtained_at`. **Ditulis ulang otomatis** setiap refresh.
- Cache/data: `export_summary.json`, `export_summary_range_*.json`, `daily_pull_*.json`, `orders_raw_*.json`, `orders_*_cache_*.json`, `ads_*_cache_*.json`, `income_cache.json`.
- `logs_daily_pull.log` — log pull harian (append).

**Frontend — `~/shopee-seller-hub/`**
- `src/ShopeePartnerDashboard.jsx` — **seluruh UI** ada di satu file ini (±87 KB). Semua perbaikan UI di sini.
- `src/main.jsx`, `src/App.jsx`, `index.html`, `vite.config.js`, `package.json`.
- `dist/` — hasil build (yang di-deploy).
- `.env`, `token.json` — duplikat kredensial Shopee (dipakai saat dev).

**Infra**
- Caddy config: `/etc/caddy/Caddyfile` → blok `api.qukis.id` (reverse_proxy ke `127.0.0.1:5010`).
  Reload setelah ubah: `sudo systemctl reload caddy`
- Cron script: `~/.hermes/scripts/mp_daily_pull.sh` (file di Hermes, bukan di repo).
- Referensi endpoint Shopee: `~/shopee_openplatform_endpoints_ID.md`

---

## 3. Operasi harian

### 3.1 Cek backend hidup
```bash
curl -s https://api.qukis.id/health          # → {"status":"ok","time":...}
ps aux | grep "[a]pp.py"                      # proses hidup?
ss -tlnp | grep 5010                          # port listen?
```

### 3.2 Restart backend
Belum ada systemd unit — jalan manual. Selalu verifikasi setelah restart.
```bash
pkill -f "python3 app.py"
cd ~/shopee-backend
nohup python3 app.py > /tmp/mp_backend.log 2>&1 &
sleep 2 && curl -s https://api.qukis.id/health
```

### 3.3 Pull data manual
```bash
# D-1 (kemarin WIB) — sama seperti cron
bash ~/.hermes/scripts/mp_daily_pull.sh

# tanggal tertentu
cd ~/shopee-backend
python3 pull_export.py 2026-09-10
python3 pull_range.py 2026-09-10 2026-09-10

# cek tanggal data terakhir
python3 -c "import json;print(json.load(open('~/shopee-backend/export_summary.json')).get('tanggal_data'))"

# log
tail -60 ~/shopee-backend/logs_daily_pull.log

# VERIFIKASI KELENGKAPAN (raw vs hitung live) — jalankan tiap kali curiga data bolong
cd ~/shopee-backend && python3 verify_raw.py 7     # cek 7 hari terakhir, exit 1 kalau ada yang kurang
```
**Kalau `verify_raw.py` bilang KURANG** → data raw tanggal itu tidak lengkap (kasus 9 Sep 2026: 150 vs 455).
Perbaiki dengan pull ulang tanggal tersebut: `python3 pull_range.py <tgl> <tgl>` (aman, menimpa file raw tanggal itu).
Keluaran `pull_range.py`: `export_summary_range_<from>_<to>.json`, `daily_pull_<from>_<to>.json`, `orders_raw_<from>_<to>.json`.
Endpoint `/api/export/summary?from=&to=` membaca raw yang cocok; kalau range tidak tersedia → fallback D-1 + field `_range_warning`.

### 3.4 Build + deploy frontend
```bash
cd ~/shopee-seller-hub
npm run build                                  # → dist/
python3 ~/shopee-backend/deploy_mp.py   # upload index.html + assets/ via cPanel Fileman API
```
Verifikasi deploy (jangan skip):
```bash
curl -sI https://mp.qukis.id | grep -i last-modified    # harus berubah
curl -s https://mp.qukis.id | grep -o 'index-[A-Za-z0-9_-]*\.js'   # nama bundle
# pastikan bundle itu BENAR-BENAR ada di server, bukan cuma di-refer index.html
```
⚠️ `save_file_content` = **upload teks**. File biner (gambar/font) jangan lewat script ini.

### 3.5 Ubah jadwal pull
Jadwal MP dikelola **Hermes cron**, bukan crontab sistem (`crontab -l` cuma punya webhook reboot).
Job: `MP QuKis Daily Pull 09:00` — id `617dd036fcf5`, script `mp_daily_pull.sh`, mode `no_agent`, deliver `origin`.
Lihat/ubah: tool `cronjob` (`action='list'` / `'update'`).

---

## 4. Endpoint backend (semua GET, JSON)

- `/health` — status server.
- `/api/shop` — info shop (nama, region, status, auth/expire time).
- `/api/orders/summary?range=7d|today|yesterday|30d|custom&from=&to=` — ringkasan pesanan.
- `/api/orders/recent?range=&limit=20` — daftar pesanan terbaru.
- `/api/orders/daily?range=` — jumlah pesanan per hari.
- `/api/export/summary[?from=&to=]` — **sumber card Pesanan**; baca `export_summary.json` / raw range.
- `/api/income/summary?days=30` — ringkasan penghasilan.
- `/api/ads/overview?days=7|30` — agregat iklan 7/30 hari (cache 60 detik).
- `/api/ads/realtime` — **data iklan hari berjalan**: total harian + rincian per jam + saldo iklan + status toggle. Cache 30 detik. Ini endpoint paling "fresh".
- `/api/ads/detail?from=&to=` — detail iklan per kategori/rentang.
- `/api/ads/metric?tab=&card=&start_date=&end_date=&timezone=Asia/Jakarta`.
- `/api/ads/series?metric=&interval=day&tab=&start_date=&end_date=`.
- Path lain → `{"error":"not found"}` 404.

Cache: TTL order 60 menit + warm-up background 15 menit (round-robin range). Cache ditulis ke file `*_cache_*.json`.

### 4.1 Pesanan live untuk tanggal yang raw-nya belum ada (dipasang 14 Sep 2026)

Gejala yang dilaporkan: "data pesanan nggak update". Penyebab sebenarnya ada 4, bukan satu:

1. Tab Pesanan default filternya "7 hari terakhir" tapi **tidak mengirim `from`/`to`** ke backend → yang tampil file `export_summary.json` (data **D-1**), bukan 7 hari. Angka kemarin terus.
2. Untuk tanggal yang raw-nya belum ada (termasuk **hari ini**), `_export_summary_for_range` mengembalikan `None` → endpoint fallback ke file D-1. Jadi filter "Hari ini" pun menampilkan angka kemarin.
3. Tab Pesanan **tidak punya auto-refresh** (fetch sekali saat dibuka) → halaman yang sudah terbuka tidak pernah berubah.
4. Chart harian di tab itu **hardcoded `range=7d`**, tidak ikut filter tanggal.

Perbaikan:
- **Backend** (`_live_day_recs` + `_merge_live_recs` di `app.py`): tanggal dalam rentang yang belum punya `orders_raw_*.json` ditarik **langsung dari Shopee API** (`/api/v2/order/get_order_list` + `/api/v2/order/get_order_detail`), dibentuk dengan format recs yang sama, lalu digabung dengan raw. Batas: `LIVE_MAX_DAYS = 7` (maks 7 tanggal terakhir) dan cache `LIVE_ORDERS_TTL = 300` detik per tanggal → file `live_day_cache_<tanggal>.json`.
- Response menandai dirinya: `_live_days: ["2026-09-14"]` + `_live_note`. Frontend menampilkan catatan biru ℹ️ "ditarik live … angka masih bisa berubah".
- **Frontend** (tab Pesanan): semua preset (termasuk 7d) mengirim `from`/`to`; auto-refresh 60 detik; chart harian ikut filter tanggal.

Hasil terverifikasi 14 Sep (bandingkan dengan perilaku lama = selalu 107 order / data 13 Sep):
- "Hari ini" → **68 order**, `tanggal_data 2026-09-14` (live)
- "Kemarin" → 107 order (dari raw, benar)
- "7 hari terakhir" → 1161 order (raw 8–13 Sep + live 14 Sep)
- "Bulan" → 6015 order


### 4.2 Mode realtime iklan (dipasang 12 Sep 2026)

Masalah sebelumnya: `/api/ads/overview` cache-nya 60 menit dan **tidak pernah di-warm**, jadi tab Overview bisa menampilkan angka iklan sampai ±11 jam basi (terukur: cache umur 39.047 detik).

Yang sekarang berlaku:
- `ADS_OVERVIEW_TTL = 60` detik (dari 60 menit) → angka iklan cepat segar.
- `ADS_REALTIME_TTL = 30` detik untuk `/api/ads/realtime`.
- `ADS_WARM_INTERVAL = 60` detik: thread warmer menulis ulang cache **langsung** (`_orders_cache_save`) untuk `ads_realtime` + `ads_overview 7d`, jadi user selalu dapat angka fresh, bukan cache basi yang baru di-refresh di belakang. Cache pesanan tetap di-warm tiap 15 menit.
- Frontend: tab Overview auto-refresh 60 detik; tab Ads auto-refresh 30 detik (sudah ada). Rentang **1 hari** → chart jadi **per jam** (`interval=hour`), rentang >1 hari → harian. Subtitle chart menampilkan jam data terakhir + saldo iklan.

Beban API: ±4 request/menit (realtime) + ±6 request/menit (overview: 116 campaign → 3 batch setting + 2 halaman list + 1 daily) = ±10 request/menit. Masih jauh di bawah limit Shopee.

**Batas fisik "realtime":** sisi kita menyajikan data maksimal **1 menit** dari angka terakhir yang Shopee kasih, tapi angka Shopee-nya sendiri naik **bertahap, bukan kontinu**. Terukur 12 Sep (sampler tiap menit): total harian 1.844.419 (10:11:43 & 10:12:43 — identik dua kali) → 1.882.026 (10:13:43) → tidak berubah sampai 10:16:57 → 1.932.167 (10:18:27). Jadi ada jeda 3–5 menit di mana angkanya diam, lalu naik. Jangan janjikan "per detik" ke user.

Catatan performa: satu panggilan ke Shopee Ads API pernah memakan **45 detik** (biasanya 0,1 detik). Karena warmer jalan 60 detik dan TTL 30 detik, angka baru bisa muncul di siklus berikutnya. Tidak masalah untuk dashboard, tapi jangan bikin script yang mengandalkan timeout <50 detik.

Catatan: `_ads_campaign_list()` + `_ads_campaign_settings()` ikut terpanggil saat warm overview (116 campaign). Kalau nanti Shopee mengeluh rate limit, ubah warm overview jadi tiap 5 menit — realtime (`ads_realtime`) tetap 60 detik.

Contoh uji:
```bash
curl -s https://api.qukis.id/api/shop | head -c 300
curl -s "https://api.qukis.id/api/ads/realtime" | python3 -m json.tool | head -40
curl -s "https://api.qukis.id/api/ads/series?metric=ad_spend&interval=hour&tab=product&start_date=2026-09-12&end_date=2026-09-12" | head -c 300
curl -s "https://api.qukis.id/api/export/summary?from=2026-09-10&to=2026-09-10" | head -c 400
curl -s "https://api.qukis.id/api/ads/overview?days=7" | head -c 400
```

---

## 5. Integrasi Shopee Open Platform (inti sistem)

- Host: `https://partner.shopeemobile.com`
- Kredensial: `SHOPEE_PARTNER_ID_LIVE` + `SHOPEE_PARTNER_KEY_LIVE` (di `~/shopee-backend/.env`). **Jangan** commit, **jangan** simpan di Hostinger.
- **Signature GET:** `base_string = partner_id + path + timestamp + access_token + shop_id` → `HMAC-SHA256(partner_key, base_string)` hex.
- **Signature call auth (tanpa access_token):** `partner_id + path + timestamp`.
- `access_token` umur ±4 jam. `app.py` auto-refresh (`_refresh_access_token()`) dan juga refresh saat error **403**. Setiap refresh → `token.json` ditulis ulang (jadi file ini berubah sendiri; bukan tanda kerusakan).
- `refresh_token` ±30 hari. Kalau expired → **harus OAuth ulang** dari Shopee Open Platform console (authorize → callback `code` → tukar ke token). Tidak bisa di-refresh otomatis.
- Batasan API: `get_order_list` **maksimum 15 hari per request**; `get_order_detail` pakai `order_sn_list` **comma-separated, bukan JSON array**; `get_escrow_detail` = POST.
- Data iklan = **Shopee Ads API** (`get_all_cpc_ads_daily_performance`, `get_product_campaign_daily_performance`, campaign settings) — **bukan Meta Ads**. Sistem ini tidak menyentuh akun Meta sama sekali.
- Mapping status API → label export ada di bagian atas `pull_export.py` (`API_TO_EXPORT_STATUS`) — kalau angka status di UI meleset, cek mapping ini dulu.

---

## 6. Bug & gotcha yang sudah teridentifikasi

**B.1 — Puller bisa "bolong" diam-diam (DIPERBAIKI 14 Sep 2026).**
Kejadian nyata: data **9 Sep 2026** cuma 150 order di file raw, padahal di Shopee ada **455**.
Penyebab: pola `if not resp.get("more") or not lst: break` di `pull_range.pull_day` / `pull_export.pull_orders`.
Kalau satu halaman balas **respons kosong** (error/rate limit), loop berhenti dan script tetap dianggap sukses → data kurang
tertulis ke `orders_raw_*.json` tanpa peringatan.
Perbaikan: helper `_get_order_list_page` / `_get_order_details` dengan retry 4x, deteksi halaman kosong berturut-turut,
verifikasi tiap `order_sn` punya detail, dan **`verify_raw.py`** yang membandingkan jumlah raw vs live
(dipanggil otomatis di akhir `mp_daily_pull.sh` → exit 1 kalau ada yang kurang).
Audit penuh 14 Sep (1 Jul–31 Agu, 62 tanggal + 1–13 Sep): yang bolong cuma **9 Sep** (150→455, sudah ditarik ulang)
dan **7 Juli** (430→480, sudah ditarik ulang). Kalau nanti ada lagi: `python3 pull_range.py <tgl> <tgl>`.

**B.2 — Watchdog pull salah lapor "gagal" (DIPERBAIKI 14 Sep 2026).**
`mp_daily_pull.sh` lama grep `PULL_*_FAIL` ke **seluruh** `logs_daily_pull.log`, jadi satu kegagalan lama bikin semua run
berikutnya `exit 1` walau sukses. Sekarang cuma cek output run yang sedang jalan (file `mktemp`).

**B.3 — `_count_orders_between` vs raw bisa beda sumber.** Grafik harian (`/api/orders/daily`) hitung LIVE dari Shopee,
sedangkan card ringkasan pakai raw file. Kalau raw bolong, dua angka ini berbeda — itu indikasi B.1, bukan bug UI.
(Bandingkan dulu sebelum ubah kode: `python3 verify_raw.py 7`.)

**B.4 — Backend tanpa supervisor.** `app.py` mati = dashboard mati sampai ada yang restart manual. Kandidat: systemd unit `mp-backend.service`.

**B.5 — Upload Fileman = teks.** Asset biner lewat `deploy_mp.py` bisa rusak.

**B.6 — Repo GitHub PUBLIC.** Secret/cache/data pesanan jangan pernah masuk repo (`.gitignore` sudah menutup `.env`, `token.json`, `*_cache_*.json`, `orders_raw_*.json`). Cek ulang sebelum push.

**B.7 — Zona waktu.** Semua perhitungan harian pakai **WIB (UTC+7)**; "D-1" = kemarin WIB, bukan UTC.

**B.8 — Data "basi" biasanya bukan bug UI.** Cek `tanggal_data` di `export_summary.json` + log pull sebelum mengubah kode frontend.

---

## 7. Manifest akses & kredensial

Ringkas: apa yang dibutuhkan agent, di mana, dan siapa yang berwenang menyerahkan.

**A. Isi kode & repo (boleh)**
- GitHub `adsqukis/mp.qukis.id` — read/write dengan PAT. Repo **public**, jadi push aman-aman saja tapi jangan commit secret.

**B. Akses server (bukan MP-only → wajib izin pemilik aset)**
- SSH VPS `ubuntu@<VPS_IP>` → dipakai untuk: restart/ubah backend, jalankan pull manual, edit frontend + build, akses Hermes cron.
- cPanel Hostinger (user + password) → deploy frontend via Fileman API (`deploy_mp.py` lewat `cpapi.py`).
  ⚠️ Akun ini memegang **semua** `public_html` milik Generos, bukan cuma `mp.qukis.id`.
- Kredensial tersimpan di VPS pada `~/.hermes/.env` (`CPANEL_USER`, `CPANEL_PASS`) dan di `~/shopee-backend/.env` (Shopee).

**C. Shopee Open Platform (aset shop "Generos Official Store")**
- `SHOPEE_PARTNER_ID_LIVE` + `SHOPEE_PARTNER_KEY_LIVE`, dan `token.json` (`shop_id` + access/refresh token).
- Akses console Shopee Open Platform hanya diperlukan kalau `refresh_token` expired (harus OAuth ulang).

**D. Cara mengambil nilai kredensial** (hanya setelah diizinkan pemilik)
```bash
grep -E "SHOPEE_PARTNER|CPANEL_" ~/shopee-backend/.env ~/.hermes/.env
python3 -c "import json;d=json.load(open('~/shopee-backend/token.json'));print(d.get('shop_id'), d.get('obtained_at'), d.get('expire_in'))"
```

**E. Larangan keras**
- Jangan taruh secret/token/DB di file Hostinger.
- Jangan commit secret ke repo (public).
- Jangan sebarkan kredensial di dokumen yang dibagikan publik / chat grup.

---

## 8. Batas wewenang (jangan disentuh)

- Akun & campaign **Meta Ads Generos** (G1–G4), GIGAS, `report_generos`, LP generos, AFF, CPAS — semuanya di luar scope MP.
- Domain/blok Caddy selain `api.qukis.id`.
- File di luar `~/shopee-backend`, `~/shopee-seller-hub`, dan `public_html/mp.qukis.id`.
- Konfigurasi cron Hermes milik domain lain.

---

## 9. Checklist verifikasi sebelum bilang "beres"

- **Backend:** `/health` 200 **dan** endpoint yang diubah balikin data yang benar (bukan cuma 200).
- **Frontend:** `last-modified` berubah, nama bundle baru ada di server, halaman dirender di browser (bukan cuma "deploy sukses").
- **Pull data:** `tanggal_data` == tanggal yang diminta, jumlah pesanan > 0 atau alasannya jelas (mis. memang tidak ada order).
- **Cron:** `next_run_at` benar + log run terakhir bersih.
- Kalau tidak bisa diverifikasi penuh → laporkan **PARTIAL/BLOCKED**, jangan klaim DONE.

---

## 10. Eskalasi

- **Skipper (Gilang)** — pemilik aset, hosting, dan kredensial. Semua pemberian akses server/cPanel/Shopee lewat dia.
- **Adithia (JMN)** — PIC proyek MP.
- **Kowalski** — agent Hermes yang jalan di VPS ini; bisa dipanggil dari Telegram grup (topic MP).
