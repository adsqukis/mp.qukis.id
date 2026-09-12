# DEPLOY — pindah MP Dashboard ke `mpqukis.web.id` (VPS `43.156.70.224`)

Runbook lengkap untuk menjalankan repo ini di server baru. Dibaca sekali dari
atas ke bawah; tiap langkah ada cara verifikasinya.

---

## 1. Kenapa arsitekturnya diubah

**Sebelum (terpecah 2 host):**

```
mp.qukis.id     -> Hostinger cPanel (static dist/)
api.qukis.id    -> VPS 43.133.57.134:5010 (backend python)
```

Frontend hardcode `https://api.qukis.id` di 9 tempat, dan backend membalas
`Access-Control-Allow-Origin: *` supaya lintas-origin-nya jalan. Artinya: 2 DNS
record, 2 sertifikat, CORS kebuka untuk siapa saja, dan tiap ganti domain harus
edit kode.

**Sesudah (satu origin, satu server):**

```
                    mpqukis.web.id (443)
                            |
                          nginx  ── /            -> /var/www/mpqukis/current  (static dist/)
                            |     ── /api/*      -> 127.0.0.1:5010
                            |     ── /health     -> 127.0.0.1:5010
                            |
                    mp-backend.service (python app.py, bind loopback)
                            |
                    /var/lib/mp-backend  (.env, token.json, cache, export_summary.json)
```

Konsekuensinya:

| | Sebelum | Sesudah |
|---|---|---|
| DNS record | 2 (`mp` + `api`) | 1 (`mpqukis.web.id`) |
| Sertifikat TLS | 2 | 1 |
| CORS | `*` (terbuka) | tidak perlu, default mati |
| Port backend | `0.0.0.0:5010` (terekspos) | `127.0.0.1:5010` (loopback) |
| Ganti domain | edit kode + rebuild | edit nginx saja |
| Data runtime | campur di folder source | terpisah di `/var/lib/mp-backend` |

Frontend sekarang memanggil path relatif (`/api/...`). Kalau suatu saat backend
memang harus beda host, build dengan `VITE_API_BASE=https://api.example.com`
dan set `MP_ALLOW_ORIGIN` di backend — tanpa sentuh kode.

---

## 2. Yang harus disiapkan sebelum mulai

- [ ] SSH root (atau sudo) ke `43.156.70.224`
- [ ] Akses DNS untuk `mpqukis.web.id` (panel registrar)
- [ ] `SHOPEE_PARTNER_ID_LIVE` + `SHOPEE_PARTNER_KEY_LIVE`
- [ ] `token.json` dari server lama **atau** siap OAuth ulang ke Shopee
- [ ] Akses Shopee Open Platform console (buat update redirect URL / IP whitelist)
- [ ] **Security group / firewall cloud** VPS: port `80` dan `443` terbuka.
      Di Tencent Cloud (CVM/Lighthouse) ini diatur di panel, **bukan** di
      `ufw` — paling sering bikin certbot gagal padahal nginx sudah jalan.

---

## 3. Jalankan bootstrap

Di server `43.156.70.224`:

```bash
sudo timedatectl set-timezone Asia/Jakarta      # biar timer harian & log pakai WIB
git clone https://github.com/adsqukis/mp.qukis.id.git /tmp/mp-bootstrap
sudo bash /tmp/mp-bootstrap/deploy/setup-server.sh
```

`setup-server.sh` idempotent (aman diulang) dan melakukan:

1. install `nginx`, `python3` + `python3-requests`, Node 22, `certbot`
2. bikin user sistem `mp`, folder source `/opt/mp`, data `/var/lib/mp-backend`
3. clone/update repo ke `/opt/mp`
4. pasang unit systemd (`mp-backend`, `mp-pull.timer`) + vhost nginx
5. build frontend dan publish ke `/var/www/mpqukis/current`

Yang **sengaja tidak** dia lakukan: mengisi rahasia, menaruh `token.json`, dan
minta sertifikat TLS. Tiga hal itu langkah 4–7 di bawah.

> Override kalau perlu:
> `DOMAIN=... BRANCH=... REPO_URL=... sudo bash deploy/setup-server.sh`

---

## 4. Isi kredensial Shopee

`.env` tinggal di **data dir**, bukan di folder source, supaya `git pull` tidak
pernah menyentuhnya. Contoh lengkap field-nya ada di `backend/.env.example`.

```bash
sudo install -o mp -g mp -m 600 /dev/null /var/lib/mp-backend/.env
sudo -e /var/lib/mp-backend/.env
```

Isi minimal:

```
SHOPEE_PARTNER_ID_LIVE=1234567
SHOPEE_PARTNER_KEY_LIVE=xxxxxxxxxxxxxxxxxxxxxxxx
```

Cek permission-nya benar (`-rw------- mp mp`):

```bash
sudo ls -l /var/lib/mp-backend/.env
```

---

## 5. Pindahkan token OAuth

`token.json` menyimpan `access_token` + `refresh_token` Shopee dan di-refresh
otomatis tiap ~4 jam oleh backend. **Ini bagian paling rawan saat migrasi.**

**Opsi A — copy dari server lama (disarankan, tanpa downtime otorisasi):**

```bash
# dari laptop lu
scp <user>@43.133.57.134:<path>/backend/token.json /tmp/token.json
scp /tmp/token.json <user>@43.156.70.224:/tmp/token.json

# di server baru
sudo install -o mp -g mp -m 600 /tmp/token.json /var/lib/mp-backend/token.json
rm /tmp/token.json
```

> Penting: **matikan backend di server lama** setelah cutover. Dua instance
> yang sama-sama refresh `refresh_token` bisa saling meng-invalidasi token —
> gejalanya dashboard kosong / error auth acak beberapa jam setelah migrasi.

**Opsi B — OAuth ulang:** update redirect URL di Shopee Open Platform ke
`https://mpqukis.web.id`, jalankan flow authorize toko, simpan hasilnya ke
`/var/lib/mp-backend/token.json` dengan struktur yang sama (`shop_id`,
`access_token`, `refresh_token`, `expire_in`, `obtained_at`).

---

## 6. Nyalakan backend

```bash
sudo systemctl enable --now mp-backend mp-pull.timer
sudo systemctl status mp-backend --no-pager
curl -s localhost:5010/health          # -> {"status":"ok","time":...}
curl -s localhost:5010/api/shop | head -c 300
```

Kalau gagal start, pesan error-nya eksplisit di log:

```bash
sudo journalctl -u mp-backend -n 50 --no-pager
```

Backend menolak start dengan pesan jelas kalau `SHOPEE_PARTNER_ID_LIVE` /
`SHOPEE_PARTNER_KEY_LIVE` belum ada — jadi bukan crash misterius.

---

## 7. DNS + TLS

**DNS** — di panel registrar `mpqukis.web.id`:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | `43.156.70.224` | 300 |
| A | `www` | `43.156.70.224` | 300 |

Verifikasi propagasi dulu (jangan jalankan certbot sebelum ini benar):

```bash
dig +short mpqukis.web.id @1.1.1.1        # harus 43.156.70.224
curl -I http://mpqukis.web.id             # harus kena nginx server ini
```

**TLS:**

```bash
sudo certbot --nginx -d mpqukis.web.id -d www.mpqukis.web.id --redirect
sudo systemctl list-timers snap.certbot.renew.timer certbot.timer   # auto-renew aktif?
curl -sI https://mpqukis.web.id | head -3
```

Certbot menambahkan blok `listen 443 ssl` + redirect HTTP→HTTPS ke vhost. Jangan
tulis blok 443 manual sebelum certbot jalan — nanti bentrok.

---

## 8. Verifikasi end-to-end

```bash
curl -sI https://mpqukis.web.id | head -3                      # 200, HTML
curl -s  https://mpqukis.web.id/health                         # {"status":"ok"}
curl -s  https://mpqukis.web.id/api/export/summary | head -c 200
curl -s  "https://mpqukis.web.id/api/ads/overview?days=7" | head -c 200
ss -ltnp | grep 5010                                           # HARUS 127.0.0.1:5010, bukan 0.0.0.0
```

Lalu buka `https://mpqukis.web.id` di browser: cek tab Overview, Pesanan,
Penghasilan, dan Ads sudah menampilkan angka (bukan nol semua). Buka DevTools →
Network, pastikan request-nya ke `mpqukis.web.id/api/...` — kalau masih ada
yang ke `api.qukis.id`, browser masih memakai bundle lama, hard-refresh
(`Ctrl+Shift+R`).

---

## 9. Cutover & rollback

**Cutover:**

1. Server baru sudah hijau di langkah 8.
2. Matikan backend server lama: `sudo systemctl stop <unit-lama>` (wajib —
   lihat peringatan token di langkah 5).
3. Biarkan `mp.qukis.id` lama hidup 1–2 hari sebagai jaring aman, baru
   arahkan/matikan.

**Rollback frontend** (bundle baru bermasalah) — tiap deploy disimpan sebagai
release terpisah:

```bash
ls -1dt /var/www/mpqukis/releases/*/          # daftar release, terbaru di atas
sudo ln -sfn /var/www/mpqukis/releases/<release-lama> /var/www/mpqukis/current.new
sudo mv -Tf /var/www/mpqukis/current.new /var/www/mpqukis/current
```

**Rollback backend:**

```bash
cd /opt/mp && sudo git checkout <commit-lama> && sudo systemctl restart mp-backend
```

---

## 10. Update rutin

```bash
sudo bash /opt/mp/deploy/deploy.sh
```

Satu perintah: pull → `npm ci` → build → publish atomic → reload nginx →
restart backend → healthcheck. Symlink `current` ditukar secara atomic, jadi
tidak ada window di mana `index.html` baru ketemu asset lama.

---

## 11. Operasional harian

```bash
sudo journalctl -u mp-backend -f                 # log backend
sudo systemctl list-timers mp-pull.timer         # kapan pull harian berikutnya
sudo systemctl start mp-pull.service             # pull D-1 manual sekarang
sudo journalctl -u mp-pull -n 50 --no-pager      # hasil pull terakhir
ls -la /var/lib/mp-backend/                      # state: token, cache, export
tail -f /var/log/nginx/mpqukis.error.log
```

Tarik rentang tanggal tertentu:

```bash
sudo -u mp MP_DATA_DIR=/var/lib/mp-backend \
  python3 /opt/mp/backend/pull_range.py 2026-09-01 2026-09-07
```

**Backup yang penting cuma satu folder:** `/var/lib/mp-backend`
(`.env` + `token.json`; sisanya cache yang bisa dibangun ulang).

```bash
sudo tar czf ~/mp-data-$(date +%F).tgz -C /var/lib mp-backend
```

---

## 12. Shopee Open Platform — jangan kelewat

Pindah server berarti **IP publik berubah** (`43.133.57.134` → `43.156.70.224`).
Di console Shopee Open Platform:

1. **IP whitelist** — kalau app-nya mengaktifkan whitelist, tambahkan
   `43.156.70.224`. Gejala kalau lupa: semua call Shopee balas error
   auth/permission walau `.env` dan token sudah benar.
2. **Redirect URL** — update ke `https://mpqukis.web.id`. Ini hanya dipakai saat
   authorize toko; token yang sudah ada tetap jalan, tapi kalau nanti perlu
   re-auth dan URL-nya masih yang lama, flow-nya mentok.

---

## 13. Troubleshooting

| Gejala | Penyebab yang paling sering | Cek / fix |
|---|---|---|
| `502 Bad Gateway` di `/api/*` | backend mati atau bind salah | `systemctl status mp-backend`; `ss -ltnp \| grep 5010` |
| Halaman putih, asset `404` | symlink `current` rusak / permission | `ls -l /var/www/mpqukis/current`; jalankan ulang `deploy.sh` |
| Dashboard tampil, semua angka `0` | `token.json` belum ada / expired | `sudo journalctl -u mp-backend \| grep -i token` |
| Error auth Shopee acak tiap beberapa jam | dua instance refresh token bareng | matikan backend server lama |
| `certbot` gagal validasi | port 80 ditutup security group, atau DNS belum propagasi | buka 80/443 di panel cloud; `dig +short mpqukis.web.id` |
| Backend nolak start, pesan "Config kurang" | `.env` kosong / salah path | `sudo ls -l /var/lib/mp-backend/.env` |
| Browser masih hit `api.qukis.id` | cache bundle lama | hard refresh; pastikan `/index.html` dikirim `no-store` |
| `npm ci` gagal resolve tarball | registry npm diblok / mirror | `npm config set registry https://registry.npmjs.org` |
| Timer harian jalan di jam ngawur | TZ server masih UTC | `sudo timedatectl set-timezone Asia/Jakarta` |

---

## 14. Ringkasan konfigurasi

**Backend** (env, semua opsional kecuali kredensial):

| Env | Default | Fungsi |
|---|---|---|
| `SHOPEE_PARTNER_ID_LIVE` | — | **wajib** |
| `SHOPEE_PARTNER_KEY_LIVE` | — | **wajib** |
| `HOST` | `127.0.0.1` | bind address (loopback karena di balik nginx) |
| `PORT` | `5010` | port backend |
| `MP_DATA_DIR` | folder `backend/` | lokasi token, cache, export |
| `MP_ENV_FILE` | `<MP_DATA_DIR>/.env` | path file kredensial |
| `MP_TOKEN_FILE` | `<MP_DATA_DIR>/token.json` | path token OAuth |
| `MP_ALLOW_ORIGIN` | *(kosong)* | origin CORS; kosong = header CORS tidak dikirim |

**Frontend** (build-time):

| Env | Default | Fungsi |
|---|---|---|
| `VITE_API_BASE` | *(kosong)* | base URL API; kosong = same-origin `/api` |

**Lokasi di server:**

| Path | Isi |
|---|---|
| `/opt/mp` | source (git checkout) |
| `/var/lib/mp-backend` | state: `.env`, `token.json`, cache, `export_summary.json` |
| `/var/www/mpqukis/releases/<ts>` | hasil build per deploy |
| `/var/www/mpqukis/current` | symlink ke release aktif (root nginx) |
| `/etc/systemd/system/mp-backend.service` | unit backend |
| `/etc/systemd/system/mp-pull.{service,timer}` | pull data harian D-1 |
| `/etc/nginx/sites-available/mpqukis.web.id` | vhost |
