#!/usr/bin/env bash
# Deploy/update mpqukis.web.id di server ini.
#
#   git pull  ->  npm ci  ->  npm run build  ->  publish atomic  ->  restart backend
#
# Publish-nya atomic: build masuk ke release folder baru, lalu symlink
# `current` dipindah. Jadi tidak ada momen user kebuka index.html baru tapi
# asset lama (atau sebaliknya), dan rollback = pindahin symlink balik.
#
# Pakai:
#   sudo bash /opt/mp/deploy/deploy.sh
#   sudo bash /opt/mp/deploy/deploy.sh --skip-pull    # pakai source yang ada
set -euo pipefail

SRC_DIR="${SRC_DIR:-/opt/mp}"
WEB_DIR="${WEB_DIR:-/var/www/mpqukis}"
BRANCH="${BRANCH:-main}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
SKIP_PULL=0
[[ "${1:-}" == "--skip-pull" ]] && SKIP_PULL=1

[[ $EUID -eq 0 ]] || { echo "Harus root: sudo bash $0"; exit 1; }

log() { printf '\n==> %s\n' "$*"; }

if [[ $SKIP_PULL -eq 0 ]]; then
    log "Pull $BRANCH"
    git -C "$SRC_DIR" fetch --prune origin
    git -C "$SRC_DIR" checkout "$BRANCH"
    git -C "$SRC_DIR" reset --hard "origin/$BRANCH"
fi
echo "commit: $(git -C "$SRC_DIR" rev-parse --short HEAD) $(git -C "$SRC_DIR" log -1 --format=%s)"

log "Build frontend"
cd "$SRC_DIR/frontend"
# npm ci = install tepat sesuai package-lock (reproducible), fallback ke
# npm install kalau lockfile-nya out of sync.
npm ci --no-audit --no-fund || npm install --no-audit --no-fund
# VITE_API_BASE dibiarkan kosong: frontend manggil /api di origin yang sama,
# nginx yang nge-proxy ke backend. Jangan diisi kecuali backend beda host.
npm run build

RELEASE="$WEB_DIR/releases/$(date +%Y%m%d-%H%M%S)"
log "Publish -> $RELEASE"
install -d "$RELEASE"
cp -r "$SRC_DIR/frontend/dist/." "$RELEASE/"
chown -R www-data:www-data "$RELEASE"
# symlink sementara + mv -T = pertukaran atomic, tanpa window 404.
ln -sfn "$RELEASE" "$WEB_DIR/current.new"
mv -Tf "$WEB_DIR/current.new" "$WEB_DIR/current"

log "Bersihin release lama (simpan $KEEP_RELEASES terakhir)"
ls -1dt "$WEB_DIR"/releases/*/ 2>/dev/null | tail -n "+$((KEEP_RELEASES + 1))" \
    | xargs -r rm -rf

log "Reload edge proxy + restart backend"
# Deteksi edge proxy yang benar-benar dipakai (bisa Caddy, bisa nginx).
if systemctl is-active --quiet caddy 2>/dev/null; then
    caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
    systemctl reload caddy
    echo "caddy: reloaded"
elif systemctl is-active --quiet nginx 2>/dev/null; then
    nginx -t && systemctl reload nginx
    echo "nginx: reloaded"
else
    echo "PERINGATAN: tidak ada Caddy maupun nginx aktif — skip reload."
fi

if systemctl is-enabled --quiet mp-backend 2>/dev/null; then
    systemctl restart mp-backend
    sleep 2
    systemctl is-active --quiet mp-backend \
        && echo "mp-backend: active" \
        || { echo "mp-backend GAGAL start:"; journalctl -u mp-backend -n 30 --no-pager; exit 1; }
    curl -fsS -m 10 localhost:5010/health && echo
else
    echo "mp-backend belum di-enable — lewati restart."
    echo "  (isi /var/lib/mp-backend/.env dulu, lalu: sudo systemctl enable --now mp-backend)"
fi

log "Selesai."
