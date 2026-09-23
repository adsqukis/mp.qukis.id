#!/usr/bin/env python3
"""Diagnosa sekali jalan: backend mana yang hidup, setting apa yang dia punya,
dan kredensial Affiliate Open API bisa ambil data apa.

Satu kali jalan, satu output, semua pertanyaan terjawab. Nilai secret TIDAK
pernah dicetak — hanya nama variabel dan panjangnya.

    python3 diag_affiliate.py
"""
import os
import sys
import glob
import json
import time
import hashlib
import hmac
import urllib.request
import urllib.error


def line(t=""):
    print(t, flush=True)


def head(t):
    line()
    line(t)
    line("─" * len(t))


def mask(v):
    return "(kosong)" if not v else f"{v[:4]}…{v[-4:]} [{len(v)} char]"


# ── 1. Backend mana yang hidup ───────────────────────────────────────────────
head("1. BACKEND YANG SEDANG JALAN")

live_dirs = []
for pid in filter(str.isdigit, os.listdir("/proc")):
    try:
        with open(f"/proc/{pid}/cmdline", "rb") as f:
            raw = f.read()
        # argv, bukan satu string gabungan — supaya "app.py" harus jadi SATU
        # argumen utuh (atau diakhiri "/app.py"), bukan sekadar substring di
        # suatu tempat. Substring longgar bisa ke-tangkep proses lain yang
        # argumennya kebetulan memuat teks itu (nama file lain, path log, dll).
        argv = [a for a in raw.decode(errors="replace").split("\0") if a]
        script = next((a for a in argv if a == "app.py" or a.endswith("/app.py")), None)
        if not script:
            continue
        cwd = os.path.realpath(f"/proc/{pid}/cwd")
        d = os.path.dirname(os.path.abspath(os.path.join(cwd, script)))
        live_dirs.append((pid, d, " ".join(argv)[:90]))
    except (PermissionError, FileNotFoundError, ProcessLookupError):
        continue

if live_dirs:
    for pid, d, cmd in live_dirs:
        line(f"  PID {pid}  →  {d}")
        line(f"      {cmd}")
else:
    line("  Tidak terdeteksi (mungkin butuh sudo, atau nama prosesnya beda).")
    line("  Coba ulangi dengan: sudo python3 diag_affiliate.py")

# Kandidat lain untuk dibandingkan.
cands = sorted({os.path.dirname(p) for p in
                glob.glob("/opt/**/app.py", recursive=True) +
                glob.glob("/home/*/**/app.py", recursive=True) +
                glob.glob("/srv/**/app.py", recursive=True) +
                glob.glob("/tmp/**/app.py", recursive=True)})
if cands:
    head("2. SEMUA SALINAN app.py DI SERVER INI")
    live_set = {d for _, d, _ in live_dirs}
    for d in cands:
        env_ok = "ada .env" if os.path.exists(os.path.join(d, ".env")) else "TIDAK ada .env"
        tag = "  ← INI YANG HIDUP" if d in live_set else ""
        line(f"  {d:46} {env_ok}{tag}")

# ── 3. Isi .env (nama saja) ──────────────────────────────────────────────────
target = live_dirs[0][1] if live_dirs else None
if not target:
    for d in cands:
        if os.path.exists(os.path.join(d, ".env")):
            target = d
            line(f"\n  (proses tidak terdeteksi — pakai {d} karena punya .env)")
            break

env = {}
if target:
    head(f"3. SETTING DI {target}/.env")
    p = os.path.join(target, ".env")
    if not os.path.exists(p):
        line("  File .env TIDAK ADA di folder ini.")
    else:
        for ln in open(p):
            ln = ln.strip()
            if "=" in ln and not ln.startswith("#"):
                k, v = ln.split("=", 1)
                env[k.strip()] = v.strip()
        for k in sorted(env):
            line(f"  {k:34} {mask(env[k])}")
        line()
        line(f"  Izin file: {oct(os.stat(p).st_mode)[-3:]}  (yang aman: 600)")

# ── 4. Tes kredensial affiliate ──────────────────────────────────────────────
head("4. TES KREDENSIAL AFFILIATE OPEN API")


def pick(*names):
    for n in names:
        if env.get(n):
            return env[n]
        if os.environ.get(n):
            return os.environ[n]
    return None


# Terima beberapa gaya penamaan supaya tidak gagal hanya karena beda nama.
APP_ID = pick("SHOPEE_AFFILIATE_APP_ID_LIVE", "SHOPEE_AFFILIATE_APP_ID",
              "AFFILIATE_APP_ID", "SHOPEE_AMS_APP_ID")
SECRET = pick("SHOPEE_AFFILIATE_SECRET_LIVE", "SHOPEE_AFFILIATE_SECRET",
              "AFFILIATE_SECRET", "SHOPEE_AMS_SECRET", "SHOPEE_AMS_KEY")

if not APP_ID or not SECRET:
    line("  Kredensial affiliate belum ada di .env itu.")
    line("  Tambahkan dua baris ini ke file .env di folder yang ditandai INI YANG HIDUP:")
    line()
    line("    SHOPEE_AFFILIATE_APP_ID_LIVE=<app id>")
    line("    SHOPEE_AFFILIATE_SECRET_LIVE=<secret>")
    line()
    line("  Lalu jalankan ulang perintah ini. Backend TIDAK perlu di-restart untuk tes ini.")
    sys.exit(0)

line(f"  App ID : {APP_ID}")
line(f"  Secret : {mask(SECRET)}")

ENDPOINTS = ["https://open-api.affiliate.shopee.co.id/graphql",
             "https://open-api.affiliate.shopee.com/graphql"]
SCHEMES = [
    ("SHA256(appId+ts+payload+secret)",
     lambda ts, pl: hashlib.sha256(f"{APP_ID}{ts}{pl}{SECRET}".encode()).hexdigest()),
    ("HMAC-SHA256(secret, appId+ts+payload)",
     lambda ts, pl: hmac.new(SECRET.encode(), f"{APP_ID}{ts}{pl}".encode(), hashlib.sha256).hexdigest()),
]


def gql(endpoint, signer, query):
    payload = json.dumps({"query": query})
    ts = int(time.time())
    sig = signer(ts, payload)
    req = urllib.request.Request(
        endpoint, data=payload.encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"SHA256 Credential={APP_ID}, Timestamp={ts}, Signature={sig}",
        },
    )
    try:
        # Timeout pendek (8 detik) — server yang diam-diam tidak membalas
        # ("silently blocked") tidak boleh bikin skrip ini terlihat macet.
        with urllib.request.urlopen(req, timeout=8) as r:
            return r.status, r.read().decode(errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")
    except Exception as e:
        return 0, str(e)


def auth_failed(body):
    try:
        j = json.loads(body)
    except Exception:
        return True
    blob = json.dumps(j).lower()
    return any(w in blob for w in (
        "invalid signature", "invalid credential", "invalid app",
        "unauthor", "forbidden", "auth fail", "authentication",
    ))


line()
working = None
for ep in ENDPOINTS:
    for name, signer in SCHEMES:
        tag = f"{ep.split('//')[1].split('/')[0]}  {name}"
        line(f"  … mencoba {tag} (maks 8 detik)")
        code, body = gql(ep, signer, "{ __typename }")
        if code == 0:
            line(f"  ✗ {tag}\n      gagal jaringan: {body[:80]}")
        elif not body.strip().startswith("{"):
            line(f"  ? {tag}\n      HTTP {code}, balasan bukan JSON — kemungkinan diblokir. Tidak konklusif.")
        elif auth_failed(body):
            line(f"  ✗ {tag}\n      ditolak: {body[:110]}")
        else:
            line(f"  ✓ {tag}  ← DITERIMA")
            working = (ep, signer)
            break
    if working:
        break

if not working:
    line()
    line("  Tidak ada kombinasi yang diterima.")
    line("  Semua 'tidak konklusif'  → jaringan server memblokir; coba dari jaringan lain.")
    line("  Semua 'ditolak'          → kredensial bukan untuk platform ini, atau app belum aktif.")
    sys.exit(0)

# ── 5. Tanya API-nya sendiri data apa yang tersedia ──────────────────────────
head("5. DATA YANG BISA DIAMBIL KREDENSIAL INI")
line("  … menanyakan skema data ke server (maks 8 detik)")
INTROSPECT = (
    "{ __schema { queryType { name fields { name description args { name } "
    "type { kind name ofType { kind name ofType { kind name } } } } } } }"
)
code, body = gql(working[0], working[1], INTROSPECT)
try:
    fields = json.loads(body)["data"]["__schema"]["queryType"]["fields"]
except Exception:
    line("  Introspeksi ditolak / kosong. Balasan mentah:")
    line("  " + body[:700])
    sys.exit(0)


def tname(t):
    if not t:
        return "?"
    return t.get("name") or tname(t.get("ofType"))


line(f"  Tersedia {len(fields)} query:")
line()
for f in fields:
    arg_names = [a["name"] for a in (f.get("args") or [])]
    args = f"({', '.join(arg_names)})" if arg_names else ""
    label = f"  {f['name']}{args}"
    line(label[:62].ljust(64) + f"→ {tname(f.get('type'))}")
    if f.get("description"):
        line("      " + f["description"][:96])

hits = [f["name"] for f in fields
        if any(w in f["name"].lower() for w in ("shop", "seller", "merchant", "store"))]

head("KESIMPULAN")
if hits:
    line("  Ada query yang menyinggung sisi toko/penjual:")
    for h in hits:
        line(f"    • {h}")
    line("  Perlu dicek isinya: metrik toko, atau sekadar identitas toko pada konversi.")
else:
    line("  Tidak ada query bernuansa toko/penjual — daftar di atas kemungkinan seluruhnya")
    line("  laporan konversi milik akun affiliate itu sendiri, bukan performa toko dari")
    line("  semua affiliate. Kalau begitu, jalur import file export tetap yang dipakai.")
line()
