# mp.qukis.id — MP Marketplace Dashboard

Dashboard monitoring marketplace Shopee untuk toko **Generos Official Store**
(data pesanan, penghasilan, dan performa iklan), plus backend proxy ke
Shopee Open Platform API.

- **Frontend (live):** https://mp.qukis.id (static, Hostinger cPanel)
- **Backend (live):** https://api.qukis.id (VPS, reverse proxy ke `127.0.0.1:5010`)

📚 **Mulai dari sini kalau baru pegang project ini:**
- `CLAUDE.md` — panduan kerja untuk agent (aturan, perintah, checklist verifikasi)
- `docs/HANDOVER_MP_QUKIS.md` — handover lengkap (arsitektur, ops, bug, manifest akses)
- `docs/CHANGELOG.md` — riwayat perubahan

## Struktur

```
frontend/          React + Vite dashboard (recharts, lucide-react)
  src/ShopeePartnerDashboard.jsx   seluruh UI (tab Overview/Pesanan/Penghasilan/Ads)
  src/App.jsx, src/main.jsx
backend/           Python HTTP server (ThreadingHTTPServer) — proxy Shopee Open Platform
  app.py           server utama + semua endpoint /api/*
  parse_export.py  parser export xlsx Seller Centre → export_summary.json
  pull_export.py   tarik data pesanan 1 hari (D-1) dari Shopee API → export_summary.json
  pull_range.py    tarik rentang tanggal (per hari) → orders_raw_<from>_<to>.json
  verify_raw.py    cek kelengkapan data: jumlah raw vs hitung live Shopee
  deploy_mp.py     upload dist/ ke Hostinger (cPanel API)
  cpapi.py         helper login cPanel (cPanel API session)
ops/               script operasional (cron harian)
docs/              handover + changelog
```

## Frontend

```bash
cd frontend
npm install
npm run build          # output ke dist/
```

Deploy: `python3 backend/deploy_mp.py frontend/dist` (upload `index.html` + `assets/`).

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
python3 app.py         # listen :5010
```

Butuh `.env` di folder backend (TIDAK di-commit):

```
SHOPEE_PARTNER_ID_LIVE=...
SHOPEE_PARTNER_KEY_LIVE=...
SHOPEE_PARTNER_ID_TEST=...
SHOPEE_PARTNER_KEY_TEST=...
```

dan `token.json` (access/refresh token hasil OAuth, auto-refresh tiap ~4 jam).

### Endpoint utama

- `GET /api/shop` — info toko
- `GET /api/orders/summary?range=...` · `/api/orders/daily` · `/api/orders/recent`
- `GET /api/income/summary?days=30` — escrow/payout
- `GET /api/export/summary[?from&to]` — rangkuman pesanan dari raw; tanggal tanpa raw (mis. hari ini) ditarik **live** dari Shopee
- `GET /api/ads/overview?days=7|30` · `/api/ads/realtime` (hari ini per jam + saldo) · `/api/ads/metric?tab=product&card=...` · `/api/ads/series?...`

Catatan: Shopee Ads API (`get_all_cpc_ads_daily_performance`) dibatasi ~30 hari/request —
`_ads_daily_performance_range()` otomatis memecah rentang panjang jadi chunk 30 hari.

## Update data pesanan harian

```bash
cd backend
python3 pull_export.py            # tarik D-1 → export_summary.json
python3 pull_range.py 2026-09-05 2026-09-07   # tarik rentang → orders_raw_*.json
python3 verify_raw.py 7           # WAJIB: cek raw vs live (exit 1 kalau ada tanggal yang kurang)
```

Dijalankan otomatis tiap hari (09:00 WIB) oleh `ops/mp_daily_pull.sh` — pull D-1 + verifikasi kelengkapan.
Kalau verifikasi gagal, pull ulang tanggalnya: `python3 pull_range.py <tgl> <tgl>`.
