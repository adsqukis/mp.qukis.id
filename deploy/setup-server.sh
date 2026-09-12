#!/usr/bin/env bash
# Bootstrap VPS untuk mpqukis.web.id (target: 43.156.70.224, Ubuntu/Debian).
#
# Idempotent — aman dijalankan berulang. Yang dilakukan:
#   1. install nginx, python3, node, certbot
#   2. bikin user service `mp`, /opt/mp (source), /var/lib/mp-backend (data)
#   3. clone/update repo, pasang unit systemd + vhost nginx
#   4. build frontend & publish ke /var/www/mpqukis/current
#
# Yang TIDAK dilakukan (sengaja, butuh rahasia/keputusan lu):
#   - ngisi /var/lib/mp-backend/.env  (partner id + key Shopee)
#   - naruh /var/lib/mp-backend/token.json (hasil OAuth Shopee)
#   - request sertifikat TLS (certbot) — jalankan setelah DNS nunjuk ke server
#
# Pakai:
#   sudo bash deploy/setup-server.sh
set -euo pipefail

DOMAIN="${DOMAIN:-mpqukis.web.id}"
REPO_URL="${REPO_URL:-https://github.com/adsqukis/mp.qukis.id.git}"
BRANCH="${BRANCH:-main}"
SRC_DIR="${SRC_DIR:-/opt/mp}"
DATA_DIR="${DATA_DIR:-/var/lib/mp-backend}"
WEB_DIR="${WEB_DIR:-/var/www/mpqukis}"
SVC_USER="${SVC_USER:-mp}"

[[ $EUID -eq 0 ]] || { echo "Harus root: sudo bash $0"; exit 1; }

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

log "1/6 Install paket"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx python3 python3-requests git curl ca-certificates \
    certbot python3-certbot-nginx
if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y -qq nodejs
fi
node -v && python3 -V

log "2/6 User service + direktori"
id -u "$SVC_USER" >/dev/null 2>&1 || useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin "$SVC_USER"
install -d -o "$SVC_USER" -g "$SVC_USER" -m 750 "$DATA_DIR"
install -d -m 755 "$WEB_DIR"

log "3/6 Sync source ke $SRC_DIR"
if [[ -d "$SRC_DIR/.git" ]]; then
    git -C "$SRC_DIR" fetch --prune origin
    git -C "$SRC_DIR" checkout "$BRANCH"
    git -C "$SRC_DIR" reset --hard "origin/$BRANCH"
else
    git clone --branch "$BRANCH" "$REPO_URL" "$SRC_DIR"
fi

log "4/6 Pasang unit systemd"
cp "$SRC_DIR"/deploy/systemd/mp-backend.service /etc/systemd/system/
cp "$SRC_DIR"/deploy/systemd/mp-pull.service    /etc/systemd/system/
cp "$SRC_DIR"/deploy/systemd/mp-pull.timer      /etc/systemd/system/
systemctl daemon-reload

log "5/6 Pasang vhost nginx $DOMAIN"
cp "$SRC_DIR/deploy/nginx/${DOMAIN}.conf" "/etc/nginx/sites-available/$DOMAIN"
ln -sfn "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
# Default vhost nginx suka nyerobot request; matikan kalau masih ada.
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

log "6/6 Build frontend + publish"
bash "$SRC_DIR/deploy/deploy.sh" --skip-pull

SERVER_IP="$(curl -s -m 5 ifconfig.me || echo '<IP server>')"
cat <<EOF

Bootstrap selesai. Sisa langkah manual (butuh rahasia / DNS):

1. Isi kredensial Shopee di $DATA_DIR/.env (chmod 600, owner $SVC_USER):
     sudo install -o $SVC_USER -g $SVC_USER -m 600 /dev/null $DATA_DIR/.env
     sudo -e $DATA_DIR/.env      # isi SHOPEE_PARTNER_ID_LIVE & SHOPEE_PARTNER_KEY_LIVE
                                 # contoh lengkap: backend/.env.example

2. Copy token OAuth dari server lama (kalau nggak mau re-auth Shopee):
     scp <server-lama>:<path>/backend/token.json /tmp/token.json
     sudo install -o $SVC_USER -g $SVC_USER -m 600 /tmp/token.json $DATA_DIR/token.json && rm /tmp/token.json

3. Nyalakan backend + timer harian:
     sudo systemctl enable --now mp-backend mp-pull.timer
     curl -s localhost:5010/health

4. Arahkan DNS A record $DOMAIN -> $SERVER_IP
   (plus www kalau dipakai), tunggu propagasi, lalu terbitkan sertifikat:
     sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --redirect

5. Di Shopee Open Platform: whitelist IP $SERVER_IP (kalau app pakai IP
   whitelist) dan update redirect URL OAuth ke https://$DOMAIN.
EOF
