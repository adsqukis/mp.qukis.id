#!/usr/bin/env bash
# Pasang site mpqukis.web.id di server yang SUDAH punya Caddy (edge proxy).
#
# Aman untuk server multi-tenant: tidak menyentuh Caddyfile milik site lain,
# cuma nambahin `import /etc/caddy/sites/*.caddy` (kalau belum ada) dan
# menaruh site block MP di folder itu. Validasi config sebelum reload; kalau
# gagal, rollback perubahan Caddyfile supaya site lain tidak ikut down.
#
# Idempotent.
set -euo pipefail

DOMAIN="${DOMAIN:-mpqukis.web.id}"
CADDYFILE="${CADDYFILE:-/etc/caddy/Caddyfile}"
SITES_DIR="${SITES_DIR:-/etc/caddy/sites}"
SRC_DIR="${SRC_DIR:-/opt/mp}"

[[ $EUID -eq 0 ]] || { echo "Harus root: sudo bash $0"; exit 1; }
command -v caddy >/dev/null || { echo "Caddy tidak terpasang di server ini."; exit 1; }

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

log "Pasang site block $DOMAIN"
install -d -m 755 "$SITES_DIR"
install -d -m 755 /var/log/caddy && chown -R caddy:caddy /var/log/caddy 2>/dev/null || true
install -m 644 "$SRC_DIR/deploy/caddy/${DOMAIN}.caddy" "$SITES_DIR/${DOMAIN}.caddy"

log "Pastikan Caddyfile utama import $SITES_DIR/*.caddy"
if ! grep -qE "^\s*import\s+${SITES_DIR}/\*\.caddy" "$CADDYFILE"; then
    cp -a "$CADDYFILE" "${CADDYFILE}.bak-mp-$(date +%Y%m%d-%H%M%S)"
    # Import ditaruh di paling bawah — global options harus tetap di atas.
    printf '\n# Tambahan otomatis oleh MP setup — site block per file.\nimport %s/*.caddy\n' \
        "$SITES_DIR" >> "$CADDYFILE"
    ADDED_IMPORT=1
else
    ADDED_IMPORT=0
fi

log "Validasi config gabungan"
if ! caddy validate --config "$CADDYFILE" --adapter caddyfile; then
    echo "Config Caddy gabungan invalid — rollback."
    if [[ $ADDED_IMPORT -eq 1 ]]; then
        # Balikin Caddyfile ke backup terbaru yang kita buat barusan.
        latest_bak=$(ls -1t "${CADDYFILE}.bak-mp-"* | head -1)
        cp -a "$latest_bak" "$CADDYFILE"
    fi
    rm -f "$SITES_DIR/${DOMAIN}.caddy"
    exit 1
fi

log "Reload Caddy tanpa downtime"
systemctl reload caddy
sleep 1
systemctl is-active --quiet caddy && echo "caddy: active" \
    || { echo "caddy gagal reload:"; journalctl -u caddy -n 30 --no-pager; exit 1; }

echo
echo "Site $DOMAIN terpasang di Caddy."
echo "TLS diterbitkan otomatis oleh Caddy saat request pertama ke https://$DOMAIN"
echo "(butuh DNS A record $DOMAIN sudah mengarah ke IP publik server ini)."
