# MP Marketplace Dashboard

Dashboard monitoring marketplace Shopee untuk toko **Generos Official Store**
(data pesanan, penghasilan, dan performa iklan), plus backend proxy ke
Shopee Open Platform API.

- **Live:** https://mpqukis.web.id — VPS `43.156.70.224`, satu origin:
  nginx serve `dist/` di `/` dan proxy `/api/*` + `/health` ke `127.0.0.1:5010`.
- **Deploy / migrasi server:** lihat [DEPLOY.md](DEPLOY.md).
- Host lama (`mp.qukis.id` di Hostinger + `api.qukis.id`) sudah digantikan;
  script cPanel di `backend/deploy_mp.py` & `backend/cpapi.py` ditinggal
  sebagai legacy.

## Struktur

```
frontend/          React + Vite dashboard (recharts, lucide-react)
  src/ShopeePartnerDashboard.jsx   seluruh UI (tab Overview/Pesanan/Penghasilan/Ads)
  src/api.js       resolusi base URL API (VITE_API_BASE, default same-origin)
  src/App.jsx, src/main.jsx
backend/           Python HTTP server (ThreadingHTTPServer) — proxy Shopee Open Platform
  app.py           server utama + semua endpoint /api/*
  parse_export.py  parser export xlsx Seller Centre → export_summary.json
  pull_export.py   tarik data pesanan 1 hari (D-1) dari Shopee API → export_summary.json
  pull_range.py    tarik rentang tanggal (per hari) → orders_raw_<from>_<to>.json
  .env.example     contoh konfigurasi (kredensial + runtime)
  deploy_mp.py     LEGACY: upload dist/ ke Hostinger (cPanel API)
  cpapi.py         LEGACY: helper login cPanel
deploy/            infra sebagai code
  setup-server.sh  bootstrap VPS (paket, user, systemd, nginx, build)
  deploy.sh        update rutin: pull → build → publish atomic → restart
  nginx/           vhost mpqukis.web.id
  systemd/         mp-backend.service + mp-pull.{service,timer}
```

## Frontend

```bash
cd frontend
npm ci
npm run build          # output ke dist/
npm run dev            # dev server; backend di origin lain? lihat VITE_API_BASE
```

Frontend memanggil API lewat path relatif (`/api/...`), jadi tidak ada host
yang di-hardcode. Untuk dev dengan backend lokal:

```bash
VITE_API_BASE=http://localhost:5010 npm run dev
```

Deploy ke server: `sudo bash /opt/mp/deploy/deploy.sh` (lihat [DEPLOY.md](DEPLOY.md)).

Tab yang tersedia: **Overview · Pesanan · Penghasilan · Ads · Affiliate · Live**.

- Filter tanggal (Pesanan & Ads): Hari ini · Kemarin · 7 hari terakhir · Bulan · Tahun · Custom
  (popup kalender punya side panel preset; klik tanggal awal & akhir langsung terapkan).
- Tab Pesanan: 6 card status (Perlu dikirim / Sedang dikirim / Selesai / Batal / Customer / Total),
  card status bisa diklik untuk akumulasi ke Total, resume per status & SKU, download CSV.
- Tab Ads: sub-tab Iklan Produk & Iklan Toko+, 8 card metrik (dilihat, klik, CTR, pesanan,
  produk terjual, penjualan, biaya, ROAS) + chart tren harian, auto-refresh 30 detik.

## Backend

```bash
cd backend
cp .env.example .env   # isi SHOPEE_PARTNER_ID_LIVE & SHOPEE_PARTNER_KEY_LIVE
python3 app.py         # default bind 127.0.0.1:5010
```

Konfigurasi lewat `.env` **atau** environment variable (environment menang,
supaya systemd jadi sumber kebenaran di server) — daftar lengkapnya di
`backend/.env.example`. Yang penting:

| Env | Default | Fungsi |
|---|---|---|
| `SHOPEE_PARTNER_ID_LIVE` / `SHOPEE_PARTNER_KEY_LIVE` | — | **wajib** |
| `HOST` / `PORT` | `127.0.0.1` / `5010` | bind; loopback karena di balik nginx |
| `MP_DATA_DIR` | folder `backend/` | lokasi `token.json`, cache, `export_summary.json` |
| `MP_ALLOW_ORIGIN` | *(kosong)* | origin CORS; kosong = header CORS tidak dikirim |

Di server, data dir dipisah dari source (`/var/lib/mp-backend`) supaya `git pull`
tidak menyentuh state. Butuh juga `token.json` (access/refresh token hasil OAuth,
auto-refresh tiap ~4 jam) di data dir tersebut.

### Endpoint utama

- `GET /api/shop` — info toko
- `GET /api/orders/summary?range=...` · `/api/orders/daily` · `/api/orders/recent`
- `GET /api/income/summary?days=30` — escrow/payout
- `GET /api/export/summary[?from&to]` — rangkuman pesanan dari raw (D-1 default)
- `GET /api/ads/overview?days=7|30` · `/api/ads/metric?tab=product&card=...` · `/api/ads/series?...`

Catatan: Shopee Ads API (`get_all_cpc_ads_daily_performance`) dibatasi ~30 hari/request —
`_ads_daily_performance_range()` otomatis memecah rentang panjang jadi chunk 30 hari.

## Update data pesanan harian

```bash
cd backend
python3 pull_export.py            # tarik D-1 → export_summary.json
python3 pull_range.py 2026-09-05 2026-09-07   # tarik rentang → orders_raw_*.json
```

Di server hal ini otomatis lewat `mp-pull.timer` (harian 06:15 WIB):

```bash
sudo systemctl list-timers mp-pull.timer    # jadwal berikutnya
sudo systemctl start mp-pull.service        # jalankan sekarang
```

Output-nya masuk ke `MP_DATA_DIR`, folder yang sama yang dibaca `app.py`.
