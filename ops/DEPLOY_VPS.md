# Deploy `mpqukis.web.id` ke VPS (auto-deploy via GitHub Actions)

Dokumen ini setup deploy otomatis: **push ke `main` → GitHub Actions build + kirim ke VPS**.
Claude nggak bisa nyentuh VPS langsung (diblok + nggak boleh pegang kredensial),
jadi jalur resminya lewat GitHub Actions. Kredensial VPS **cuma** kamu yang isi,
di GitHub Secrets — nggak pernah masuk repo.

Arsitektur di VPS:

```
Browser ─HTTPS─▶ Nginx :443
                  ├─ /        → static dist/         (FRONTEND)
                  └─ /api/*   → 127.0.0.1:5010       (BACKEND app.py, systemd)
```

---

## A. Sekali di awal (bootstrap di VPS) — dilakukan manual olehmu

SSH ke VPS, lalu:

### 1. Siapkan folder
```bash
sudo mkdir -p /var/www/mpqukis.web.id          # docroot frontend
mkdir -p ~/mpqukis-backend                      # folder backend
sudo chown -R $USER:$USER /var/www/mpqukis.web.id
```

### 2. Taruh secret backend (JANGAN lewat git)
Buat `~/mpqukis-backend/.env` + `token.json` (partner id/key + token OAuth Shopee).
File ini tetap di VPS selamanya; deploy **tidak** akan menimpanya.

### 3. Pasang systemd service backend
```bash
# salin file dari repo (edit User & WorkingDirectory dulu):
sudo cp ~/mpqukis-backend/mpqukis-backend.service /etc/nginx/... # (contoh)
sudo cp <repo>/ops/vps/mpqukis-backend.service /etc/systemd/system/mpqukis-backend.service
sudo nano /etc/systemd/system/mpqukis-backend.service   # ganti REPLACE_WITH_VPS_USER + path
sudo systemctl daemon-reload
sudo systemctl enable --now mpqukis-backend
systemctl status mpqukis-backend --no-pager
curl -s http://127.0.0.1:5010/health            # harus balas 200
```

### 4. Pasang Nginx site
```bash
sudo cp <repo>/ops/vps/nginx-mpqukis.web.id.conf /etc/nginx/sites-available/mpqukis.web.id
sudo nano /etc/nginx/sites-available/mpqukis.web.id     # cek root path sama dgn docroot
sudo ln -s /etc/nginx/sites-available/mpqukis.web.id /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 5. HTTPS (Let's Encrypt)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d mpqukis.web.id
```
> Pastikan DNS A record `mpqukis.web.id` sudah menunjuk ke IP VPS **sebelum** langkah ini.

### 6. Izinkan deploy me-restart backend tanpa password
GitHub Actions perlu `sudo systemctl restart mpqukis-backend` tanpa prompt password:
```bash
echo "$USER ALL=(ALL) NOPASSWD: /bin/systemctl restart mpqukis-backend, /bin/systemctl is-active mpqukis-backend" | sudo tee /etc/sudoers.d/mpqukis-deploy
sudo chmod 440 /etc/sudoers.d/mpqukis-deploy
```
> Cek path `systemctl` di VPS-mu (`which systemctl`) — bisa `/usr/bin/systemctl`. Samakan.

### 7. Buat SSH key khusus deploy
Di laptop/VPS:
```bash
ssh-keygen -t ed25519 -f ~/.ssh/mpqukis_deploy -N "" -C "gh-actions-deploy"
# daftarkan public key ke VPS:
ssh-copy-id -i ~/.ssh/mpqukis_deploy.pub $USER@<IP_VPS>
# isi private key (~/.ssh/mpqukis_deploy) nanti ditaruh di GitHub Secret VPS_SSH_KEY
```

---

## B. Sekali di awal (di GitHub) — Settings repo

**Settings → Secrets and variables → Actions**

### Secrets (rahasia):
| Nama | Isi |
|---|---|
| `VPS_HOST` | IP atau hostname VPS |
| `VPS_USER` | user SSH (sama dgn `User=` di service) |
| `VPS_SSH_KEY` | isi file **private** `~/.ssh/mpqukis_deploy` (seluruhnya) |
| `VPS_PORT` | *(opsional)* port SSH, default 22 |

### Variables (bukan rahasia):
| Nama | Contoh |
|---|---|
| `FRONTEND_DOCROOT` | `/var/www/mpqukis.web.id` |
| `BACKEND_DIR` | `/home/USER/mpqukis-backend` |

---

## C. Deploy

- **Otomatis:** merge/push ke `main` yang mengubah `frontend/` atau `backend/`.
- **Manual:** tab **Actions → Deploy ke VPS → Run workflow**.

Workflow akan: build frontend → rsync `dist/` ke docroot → rsync `*.py` backend
(tanpa menyentuh `.env`/`token.json`/data) → restart backend → cek `/health`.

Selesai → buka https://mpqukis.web.id

---

## D. Kalau gagal / dashboard nggak kebuka — urutan cek

1. DNS: `dig +short mpqukis.web.id` → harus IP VPS.
2. Nginx: `sudo systemctl status nginx` + `sudo nginx -t`.
3. Docroot ada isi: `ls /var/www/mpqukis.web.id` → harus ada `index.html` + `assets/`.
4. Backend: `systemctl status mpqukis-backend` + `curl 127.0.0.1:5010/health`.
5. Log Actions: tab Actions → run terakhir → step mana yang merah.
