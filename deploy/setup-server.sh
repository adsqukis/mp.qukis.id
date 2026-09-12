#!/usr/bin/env bash
# Bootstrap VPS untuk mpqukis.web.id (Ubuntu/Debian).
#
# Idempotent — aman dijalankan berulang. Cerdas soal edge proxy: kalau server
# sudah punya Caddy (misal untuk site lain), skrip TIDAK memasang nginx dan
# TIDAK ngambil port 80/443; site MP dipasang sebagai import file di
# /etc/caddy/sites/. Kalau tidak ada, skrip pakai jalur nginx + certbot.
#
# Yang selalu dilakukan:
#   1. deteksi edge proxy yang sudah ada
#   2. install python3, node, dan (tergantung jalur) nginx+certbot
#   3. bikin user service `mp`, /opt/mp (source), /var/lib/mp-backend (data)
#   4. clone/update repo, pasang unit systemd
#   5. pasang vhost/site block di edge proxy yang aktif
#   6. build frontend & publish ke /var/www/mpqukis/current
#
# Yang sengaja TIDAK dilakukan (butuh rahasia/keputusan lu):
#   - ngisi /var/lib/mp-backend/.env (partner id + key Shopee)
#   - naruh /var/lib/mp-backend/token.json (hasil OAuth Shopee)
#   - request sertifikat TLS di jalur nginx (jalankan certbot setelah DNS)
#
# Pakai:
#   sudo bash deploy/setup-server.sh
#   PROXY=caddy sudo bash deploy/setup-server.sh   # paksa jalur Caddy
#   PROXY=nginx sudo bash deploy/setup-server.sh   # paksa jalur nginx
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

log "1/6 Deteksi edge proxy + install paket"
export DEBIAN_FRONTEND=noninteractive

# Cek siapa sekarang pegang port 80/443. Kalau Caddy sudah edge, kita ikuti
# dia — jangan pernah maksa nginx masuk dan matiin Caddy dari site lain.
detect_proxy() {
    if [[ -n "${PROXY:-}" ]]; then echo "$PROXY"; return; fi
    if command -v caddy >/dev/null 2>&1 \
       && systemctl is-active --quiet caddy 2>/dev/null; then
        echo caddy; return
    fi
    if ss -ltn 'sport = :80' 2>/dev/null | awk 'NR>1{exit 0} END{exit 1}'; then
        # Ada yang listen port 80 tapi bukan Caddy aktif — bahaya, minta manusia.
        local owner
        owner=$(ss -ltnp 'sport = :80' 2>/dev/null | awk 'NR>1{print $NF; exit}')
        echo "ERROR: port 80 sudah dipakai proses lain ($owner)." >&2
        echo "Hentikan proses itu dulu, atau set PROXY=caddy/PROXY=nginx eksplisit." >&2
        exit 1
    fi
    echo nginx
}
PROXY_KIND=$(detect_proxy)
echo "edge proxy: $PROXY_KIND"

apt-get update -qq
apt-get install -y -qq python3 python3-requests git curl ca-certificates
if [[ "$PROXY_KIND" == "nginx" ]]; then
    apt-get install -y -qq nginx certbot python3-certbot-nginx
fi
if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y -qq nodejs
fi
node -v && python3 -V

# Nginx yang tidak dipakai HARUS di-disable, biar tiap reboot tidak nyoba start
# dan gagal — atau lebih parah, ambil port dari Caddy kalau Caddy sempat mati.
if [[ "$PROXY_KIND" != "nginx" ]] \
   && systemctl list-unit-files nginx.service >/dev/null 2>&1; then
    systemctl disable --now nginx 2>/dev/null || true
    echo "nginx.service di-disable (edge proxy: $PROXY_KIND)."
fi

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

log "5/6 Pasang site di edge proxy ($PROXY_KIND)"
if [[ "$PROXY_KIND" == "caddy" ]]; then
    bash "$SRC_DIR/deploy/setup-caddy-site.sh"
else
    cp "$SRC_DIR/deploy/nginx/${DOMAIN}.conf" "/etc/nginx/sites-available/$DOMAIN"
    ln -sfn "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
    # Default vhost nginx suka nyerobot request; matikan kalau masih ada.
    rm -f /etc/nginx/sites-enabled/default
    nginx -t
    systemctl reload nginx
fi

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

4. Arahkan DNS A record $DOMAIN -> $SERVER_IP (plus www kalau dipakai).
   $( [[ "$PROXY_KIND" == "caddy" ]] \
      && echo "TLS diterbitkan Caddy otomatis saat request pertama ke https://$DOMAIN." \
      || echo "Lalu terbitkan sertifikat: sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --redirect" )

5. Di Shopee Open Platform: whitelist IP $SERVER_IP (kalau app pakai IP
   whitelist) dan update redirect URL OAuth ke https://$DOMAIN.
EOF
