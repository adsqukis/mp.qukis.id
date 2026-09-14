# CLAUDE.md — panduan kerja di repo ini

Dokumen ini untuk agent (Claude) yang memelihara **MP QuKis Dashboard** (`mp.qukis.id`).
Baca ini dulu, lalu `docs/HANDOVER_MP_QUKIS.md` untuk detail teknis penuh.

## Apa ini

Dashboard monitoring marketplace Shopee untuk toko **Generos Official Store** — data pesanan,
penghasilan, dan performa iklan — plus backend proxy ke Shopee Open Platform.

- Frontend live: https://mp.qukis.id (static hasil `vite build`, di hosting cPanel)
- Backend live: https://api.qukis.id (Python `ThreadingHTTPServer`, listen `:5010`, di belakang Caddy)
- Sumber data: **Shopee Open Platform** (`partner.shopeemobile.com`). Sistem ini **tidak menyentuh Meta Ads sama sekali**.

## Peta file

```
frontend/src/ShopeePartnerDashboard.jsx   SELURUH UI ada di file ini (tab Overview/Pesanan/Penghasilan/Ads)
backend/app.py                            server + semua endpoint /api/* + client Shopee (sign, token, cache)
backend/pull_export.py                    tarik 1 hari (D-1) → export_summary.json
backend/pull_range.py                     tarik rentang tanggal → orders_raw_<from>_<to>.json
backend/verify_raw.py                     verifikasi kelengkapan: jumlah raw vs hitung live Shopee
backend/parse_export.py                   parser xlsx export Seller Centre (jalur lama) + _summarize()
backend/deploy_mp.py + cpapi.py           upload dist/ ke hosting via cPanel API
ops/mp_daily_pull.sh                      script cron harian (pull D-1 + verifikasi)
docs/HANDOVER_MP_QUKIS.md                 handover lengkap: arsitektur, ops, bug, manifest akses
```

## Perintah penting

```bash
# Frontend
cd frontend && npm install && npm run build          # → dist/
python3 ../backend/deploy_mp.py                      # upload ke hosting (butuh kredensial cPanel)

# Backend (TIDAK ada supervisor — restart manual, verifikasi setelahnya)
pkill -f "python3 app.py"; cd backend && nohup python3 app.py > /tmp/mp_backend.log 2>&1 &
curl -s https://api.qukis.id/health

# Data
python3 backend/pull_export.py 2026-09-10            # 1 tanggal → export_summary.json
python3 backend/pull_range.py 2026-09-09 2026-09-09  # rentang → raw + range summary
python3 backend/verify_raw.py 7                      # cek raw vs live, exit 1 kalau ada yang kurang
```

## Aturan wajib

1. **Jangan pernah commit kredensial** ke repo ini — repo ini **PUBLIC**.
   `.env`, `token.json`, `*_cache_*.json`, `orders_raw_*.json`, `export_summary*.json` sudah di `.gitignore`. Jangan dimatikan.
2. Kredensial dibaca dari file di server (`backend/.env`, `token.json`), bukan dari kode. Jangan hardcode.
3. Jangan taruh secret/token/DB di file hosting (sudah pernah jadi masalah).
4. Semua perhitungan harian pakai **WIB (UTC+7)**. "D-1" = kemarin WIB.
5. Data iklan & pesanan datang dari Shopee — angka **hari berjalan masih bisa berubah** sampai hari selesai.
6. Jangan ubah perilaku endpoint lain tanpa alasan. Kalau perlu ubah, backup dulu (`cp app.py app.py.bak_<alasan>_<tgl>`).
7. Kalau Shopee API balas error/kosong: **retry**, jangan tulis data kurang lalu anggap sukses (lihat B.1 di handover — sudah pernah kejadian).

## Endpoint

`/health` · `/api/shop` · `/api/orders/{summary,recent,daily}` · `/api/export/summary[?from&to]` ·
`/api/income/summary` · `/api/ads/{overview,realtime,detail,metric,series}`

- `/api/ads/realtime` — iklan hari ini: total + rincian per jam + saldo (cache 30 detik, di-warm tiap 60 detik)
- `/api/export/summary?from=&to=` — agregasi raw; tanggal yang raw-nya belum ada (mis. hari ini) **ditarik live** dari Shopee

## Checklist sebelum bilang "selesai"

- Backend: `/health` 200 **dan** endpoint yang diubah balikin angka yang benar (bukan cuma status 200)
- Frontend: `last-modified` berubah, nama bundle baru di `index.html` **benar-benar ada** di server (kalau tidak → halaman blank)
- Data: `python3 backend/verify_raw.py 2` bersih
- Kalau tidak bisa diverifikasi penuh → laporkan apa adanya, jangan klaim selesai

## Batas wewenang

Hanya file di `backend/`, `frontend/`, `ops/`, `docs/`, dan docroot `mp.qukis.id`.
Jangan sentuh akun Meta Ads, hostname/blok domain lain, cron milik project lain, atau folder `public_html` lain.

## Akses & kredensial

Kredensial **sengaja tidak ada** di repo ini. Yang dibutuhkan untuk operasi penuh:
akses server (backend + cron + build), akses deploy frontend (cPanel/FTP), dan kredensial Shopee
(partner id/key + token OAuth). Minta lewat jalur privat ke pemilik aset — jangan tempel di repo, issue, atau commit.
