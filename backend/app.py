#!/usr/bin/env python3
"""
Shopee Open Platform proxy backend — serve data real buat dashboard MP.
Jalan di VPS Hermes (43.133.57.134:5010). Secret partner key TIDAK boleh di Hostinger.

VERIFIED 02 Sep 2026:
- Signature GET data: base = pid + path + ts + access_token + shop_id
- get_order_list: cuma balikin order_sn (filter per status untuk hitung distribusi)
- get_order_detail: GET dengan order_sn_list=comma-separated (BUKAN JSON array)
- get_escrow_detail: POST
- get_order_list max 15 hari per request
"""
import json, os, time, hmac, hashlib, urllib.request, urllib.parse, threading, re
import datetime
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from collections import Counter

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# TTL cache order: 60 menit. Auto-refresh background tiap 15 menit per range (round-robin).
ORDERS_TTL = 60 * 60
WARM_INTERVAL = 15 * 60
ENV_FILE = os.path.join(BASE_DIR, '.env')
TOKEN_FILE = os.path.join(BASE_DIR, 'token.json')
API_HOST = 'https://partner.shopeemobile.com'

def load_env():
    env = {}
    with open(ENV_FILE) as f:
        for line in f:
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                env[k] = v
    return env

ENV = load_env()
PARTNER_ID = int(ENV['SHOPEE_PARTNER_ID_LIVE'])
PARTNER_KEY = ENV['SHOPEE_PARTNER_KEY_LIVE']

def _sign_get(path, ts, at, shop_id):
    base = f"{PARTNER_ID}{path}{ts}{at}{shop_id}"
    return hmac.new(PARTNER_KEY.encode(), base.encode(), hashlib.sha256).hexdigest()

def load_token():
    with open(TOKEN_FILE) as f:
        return json.load(f)

def _save_token(tok):
    with open(TOKEN_FILE, 'w') as f:
        json.dump(tok, f, indent=2)

_token_lock = threading.Lock()

def _refresh_access_token():
    """Refresh access_token via /api/v2/auth/access_token/get. Response token di TOP-LEVEL
    (bukan di key 'response') — jangan salah parse. Return True kalau berhasil."""
    with _token_lock:
        tok = load_token()
        now = int(time.time())
        # double-check di dalam lock: kalau thread lain udah refresh, skip
        if tok.get('obtained_at', 0) + tok.get('expire_in', 0) > now + 120:
            return True
        ts = now
        path = '/api/v2/auth/access_token/get'
        sign = hmac.new(PARTNER_KEY.encode(), f"{PARTNER_ID}{path}{ts}".encode(), hashlib.sha256).hexdigest()
        body = json.dumps({
            'partner_id': PARTNER_ID,
            'shop_id': tok['shop_id'],
            'refresh_token': tok['refresh_token'],
        }).encode()
        req = urllib.request.Request(
            f"{API_HOST}{path}?partner_id={PARTNER_ID}&timestamp={ts}&sign={sign}",
            data=body, headers={'Content-Type': 'application/json'})
        try:
            d = json.loads(urllib.request.urlopen(req, timeout=30).read())
        except Exception:
            return False
        new_at = d.get('access_token') or (d.get('response') or {}).get('access_token')
        new_rt = d.get('refresh_token') or (d.get('response') or {}).get('refresh_token')
        if not new_at:
            return False
        tok['access_token'] = new_at
        if new_rt:
            tok['refresh_token'] = new_rt
        tok['expire_in'] = d.get('expire_in') or 14400
        tok['obtained_at'] = int(time.time())
        _save_token(tok)
        return True

def _token_fresh():
    tok = load_token()
    now = int(time.time())
    return tok.get('obtained_at', 0) + tok.get('expire_in', 0) > now + 120

def shopee_get(path, params=None):
    if not _token_fresh():
        _refresh_access_token()
    tok = load_token()
    at = tok['access_token']
    shop_id = tok['shop_id']
    ts = int(time.time())
    sign = _sign_get(path, ts, at, shop_id)
    all_params = {
        "partner_id": PARTNER_ID, "timestamp": ts, "sign": sign,
        "access_token": at, "shop_id": shop_id,
    }
    if params:
        all_params.update(params)
    url = f"{API_HOST}{path}?{urllib.parse.urlencode(all_params)}"
    req = urllib.request.Request(url)
    try:
        resp = urllib.request.urlopen(req, timeout=25)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        # 429 rate limit → tunggu & retry (maks 3x)
        if e.code == 429:
            for attempt in range(3):
                time.sleep(15 * (attempt + 1))
                try:
                    resp2 = urllib.request.urlopen(req, timeout=25)
                    return json.loads(resp2.read())
                except urllib.error.HTTPError as e2:
                    if e2.code != 429:
                        raise
            raise
        # 403 kemungkinan token expire → refresh sekali + retry
        if e.code == 403 and _refresh_access_token():
            tok = load_token()
            at = tok['access_token']
            shop_id = tok['shop_id']
            ts = int(time.time())
            sign = _sign_get(path, ts, at, shop_id)
            all_params = {
                "partner_id": PARTNER_ID, "timestamp": ts, "sign": sign,
                "access_token": at, "shop_id": shop_id,
            }
            if params:
                all_params.update(params)
            url = f"{API_HOST}{path}?{urllib.parse.urlencode(all_params)}"
            resp = urllib.request.urlopen(urllib.request.Request(url), timeout=25)
            return json.loads(resp.read())
        raise

STATUS_LABEL = {
    'UNPAID': 'Belum bayar',
    'READY_TO_SHIP': 'Perlu dikirim',
    'PROCESSED': 'Diproses',
    'SHIPPED': 'Dikirim',
    'COMPLETED': 'Selesai',
    'IN_CANCEL': 'Dibatalkan',
    'CANCELLED': 'Dibatalkan',
    'CANCEL': 'Dibatalkan',
    'RETRY_SHIP': 'Perlu dikirim',
    'TO_RETURN': 'Retur',
    'INVOICE_PENDING': 'Diproses',
}

def _load_raw_recs(from_iso, to_iso):
    """Gabung recs dari SEMUA file orders_raw_*.json yang tanggalnya dalam [from_iso, to_iso].
    Return (recs_filtered, tanggal_label) atau (None, None) kalau nggak ada data sama sekali."""
    import glob
    merged = []
    seen = set()
    wanted = sorted(glob.glob(os.path.join(BASE_DIR, 'orders_raw_*.json')))
    for fp in wanted:
        m = re.match(r'orders_raw_(\d{8})_(\d{8})\.json$', os.path.basename(fp))
        if not m:
            continue
        f8, t8 = m.group(1), m.group(2)
        f_iso = f"{f8[:4]}-{f8[4:6]}-{f8[6:]}"
        t_iso = f"{t8[:4]}-{t8[4:6]}-{t8[6:]}"
        # file nggak overlap sama range → skip
        if f_iso > to_iso or t_iso < from_iso:
            continue
        try:
            with open(fp, encoding='utf-8') as f:
                recs = json.load(f)
        except Exception:
            continue
        for r in recs:
            d = r.get('tanggal') or ''
            if from_iso <= d <= to_iso:
                # dedup kalau range di-pull 2x (order+sku+status+tanggal sama)
                k = (d, r.get('order'), r.get('sku'), r.get('status'), r.get('jumlah'))
                if k not in seen:
                    seen.add(k)
                    merged.append(r)
    if not merged:
        return None, None
    return merged, f"{from_iso}_s.d._{to_iso}"

def _export_summary_for_range(from_iso, to_iso):
    """Agregasi summary lengkap (termasuk by_produk) untuk range custom dari raw recs."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("pe", os.path.join(BASE_DIR, "parse_export.py"))
    pe = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(pe)

    recs, label = _load_raw_recs(from_iso, to_iso)
    if recs is None:
        return None
    ts = int(time.time())
    summary = pe._summarize(recs, label, ts)
    # Kalau range diminta lebih tua dari data yang tersedia → tandai partial
    # (mis. preset "Tahun" padahal raw baru mulai 2026-07-01).
    try:
        dmin = min(r["tanggal"] for r in recs if r.get("tanggal"))
        if from_iso < dmin:
            summary["_range_warning"] = (
                f"Data pesanan baru tersedia mulai {dmin} — "
                f"rentang {from_iso} s.d. {dmin} tidak termasuk."
            )
    except Exception:
        pass
    by_produk = {}
    for group_label in ["Generos Klasik", "Generos 1 Botol", "Generos Milk"]:
        sub = [x for x in recs if pe.SKU_INFO.get(x["sku"], {}).get("group") == group_label]
        if sub:
            by_produk[group_label] = pe._summarize(sub, summary["tanggal_data"], ts)
    if by_produk:
        summary["by_produk"] = by_produk
    return summary

def parse_date(s):
    """Parse 'YYYY-MM-DD' → epoch local midnight. Return None kalau invalid."""
    try:
        parts = s.split('-')
        if len(parts) != 3:
            return None
        y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
        return int(time.mktime((y, m, d, 0, 0, 0, 0, 0, -1)))
    except Exception:
        return None

def resolve_range(range_key, from_ts=None, to_ts=None):
    """Map range_key → (from_ts, to_ts, label). Waktu lokal server (WIB).
    range_key 'custom' pakai from_ts/to_ts eksplisit (epoch).
    """
    if range_key == 'custom' and from_ts is not None and to_ts is not None:
        return from_ts, to_ts, 'Custom'
    now = int(time.time())
    lt = time.localtime(now)
    start_today = int(time.mktime((lt.tm_year, lt.tm_mon, lt.tm_mday, 0, 0, 0, 0, 0, -1)))
    if range_key == 'today':
        return start_today, now, 'Hari ini'
    if range_key == 'yesterday':
        return start_today - 86400, start_today, 'Kemarin'
    if range_key == '30d':
        return now - 30 * 86400, now, '30 hari'
    return now - 7 * 86400, now, '7 hari'

def count_orders_by_status(from_ts, to_ts, statuses=None):
    """Hitung total order per status antara from_ts..to_ts (filter per status)."""
    if statuses is None:
        statuses = ['UNPAID', 'READY_TO_SHIP', 'PROCESSED', 'SHIPPED', 'COMPLETED',
                    'IN_CANCEL', 'CANCELLED', 'CANCEL', 'RETRY_SHIP', 'TO_RETURN', 'INVOICE_PENDING']
    results = {}
    for st in statuses:
        count = 0
        cursor = ''
        # Bagi per 15 hari
        t_end = to_ts
        t_start = from_ts
        while t_end > t_start:
            seg_start = max(t_start, t_end - 15 * 86400)
            cursor = ''
            while True:
                r = shopee_get('/api/v2/order/get_order_list', {
                    'time_range_field': 'create_time',
                    'time_from': seg_start,
                    'time_to': t_end,
                    'page_size': 100,
                    'cursor': cursor,
                    'order_status': st,
                })
                resp = r.get('response', {})
                orders = resp.get('order_list', [])
                count += len(orders)
                if resp.get('more') and resp.get('next_cursor') and resp.get('next_cursor') != cursor:
                    cursor = resp.get('next_cursor')
                else:
                    break
            t_end = seg_start - 1
        results[st] = count
    return results

def fetch_recent_orders(from_ts, to_ts, limit=30):
    """Ambil order_sn terbaru (create_time) dalam rentang from_ts..to_ts."""
    sns = []
    cursor = ''
    r = shopee_get('/api/v2/order/get_order_list', {
        'time_range_field': 'create_time',
        'time_from': from_ts,
        'time_to': to_ts,
        'page_size': min(limit, 100),
        'cursor': cursor,
    })
    resp = r.get('response', {})
    for o in resp.get('order_list', []):
        sns.append(o['order_sn'])
    return sns

def fetch_order_details(sns):
    """Ambil detail order via GET order_sn_list=comma-separated + optional fields."""
    if not sns:
        return []
    # API batas: potong per 50
    details = []
    for i in range(0, len(sns), 50):
        batch = sns[i:i+50]
        r = shopee_get('/api/v2/order/get_order_detail', {
            'order_sn_list': ','.join(batch),
            'response_optional_fields': 'item_list,total_amount,buyer_user_id,recipient_address,package_list'
        })
        details.extend(r.get('response', {}).get('order_list', []))
    return details

def _custom_key(range_key, from_ts, to_ts):
    if range_key == 'custom':
        return f'custom_{from_ts}_{to_ts}'
    return range_key

def _daily_builder(range_key, from_ts, to_ts):
    """Hitung order per bucket (tanpa cache). today/yesterday → per jam. lainnya → per hari."""
    f_ts, t_ts, label = resolve_range(range_key, from_ts, to_ts)
    out = []
    label_map = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
    _BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

    def _dt_indo(ts, with_hour=False):
        lt = time.localtime(ts)
        s = f"{lt.tm_mday:02d} {_BULAN[lt.tm_mon - 1]}"
        if with_hour:
            s += f" {lt.tm_hour:02d}:00"
        return s

    if range_key in ('today', 'yesterday') and not (from_ts and to_ts):
        # bucket per jam
        h = f_ts
        while h < t_ts:
            h_end = min(h + 3600, t_ts)
            count = _count_orders_between(h, h_end)
            out.append({'d': time.strftime('%H', time.localtime(h)), 'total': count,
                        'date_label': _dt_indo(h, with_hour=True)})
            h = h_end
    else:
        # bucket per hari
        day = f_ts
        while day < t_ts:
            day_end = min(day + 86400, t_ts)
            count = _count_orders_between(day, day_end)
            wd = time.localtime(day).tm_wday
            out.append({'d': label_map[wd], 'total': count,
                        'date_label': _dt_indo(day)})
            day = day_end
    return out

def daily_order_counts(range_key='7d', from_ts=None, to_ts=None):
    """Jumlah order per bucket dalam range. Cache 60 menit + auto-refresh background."""
    key = _custom_key(range_key, from_ts, to_ts)
    return _orders_get('orders_daily', key, lambda: _daily_builder(range_key, from_ts, to_ts))

def _count_orders_between(from_ts, to_ts):
    """Hitung semua order antara from_ts..to_ts (tanpa filter status)."""
    count = 0
    cursor = ''
    while True:
        r = shopee_get('/api/v2/order/get_order_list', {
            'time_range_field': 'create_time',
            'time_from': from_ts,
            'time_to': to_ts,
            'page_size': 100,
            'cursor': cursor,
        })
        resp = r.get('response', {})
        count += len(resp.get('order_list', []))
        if resp.get('more') and resp.get('next_cursor') and resp.get('next_cursor') != cursor:
            cursor = resp.get('next_cursor')
        else:
            break
    return count

INCOME_CACHE = os.path.join(BASE_DIR, 'income_cache.json')
INCOME_TTL = 60 * 60  # 60 menit

def fetch_escrow_payouts(days=30):
    """Semua payout escrow (uang bersih masuk) dalam N hari terakhir.
    Pagination: page_no loop sampai more=False.
    """
    now = int(time.time())
    payouts = []
    page = 1
    while True:
        r = shopee_get('/api/v2/payment/get_escrow_list', {
            'release_time_from': now - days * 86400,
            'release_time_to': now,
            'page_size': 100,
            'page_no': page,
        })
        resp = r.get('response', {})
        lst = resp.get('escrow_list', [])
        if not lst:
            break
        payouts.extend(lst)
        if not resp.get('more'):
            break
        page += 1
        if page > 300:  # pengaman
            break
    return payouts

def _load_income_cache():
    try:
        with open(INCOME_CACHE) as f:
            return json.load(f)
    except Exception:
        return None

def _save_income_cache(data):
    try:
        with open(INCOME_CACHE, 'w') as f:
            json.dump(data, f, ensure_ascii=False)
    except Exception:
        pass

def build_income_summary(days=30):
    """Tren payout harian + total dalam N hari. Cache 60 menit."""
    now = int(time.time())
    cache = _load_income_cache()
    if cache and cache.get('days') == days and now - cache.get('generated_at', 0) < INCOME_TTL:
        return cache

    payouts = fetch_escrow_payouts(days=days)

    per_day = {}
    label_map = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
    for i in range(days - 1, -1, -1):
        day_end = now - i * 86400
        day_start = day_end - 86400
        per_day[day_start] = {'date': time.strftime('%d %b', time.localtime(day_start)),
                              'd': label_map[time.localtime(day_start).tm_wday],
                              'total': 0, 'count': 0}

    total_payout = 0
    for p in payouts:
        ts = p.get('escrow_release_time') or 0
        amt = p.get('payout_amount') or 0
        total_payout += amt
        # bucket per hari lokal (UTC offset dari server)
        day_start = ts - (ts % 86400)
        if day_start in per_day:
            per_day[day_start]['total'] += amt
            per_day[day_start]['count'] += 1
        else:
            # cari bucket terdekat (perbedaan timezone)
            for bucket in per_day:
                if abs(bucket - day_start) < 86400:
                    per_day[bucket]['total'] += amt
                    per_day[bucket]['count'] += 1
                    break

    daily = [per_day[k] for k in sorted(per_day.keys())]

    data = {
        'days': days,
        'total_payout': total_payout,
        'payout_count': sum(d['count'] for d in daily),
        'daily': daily,
        'generated_at': int(time.time()),
        'source': 'payment.get_escrow_list',
    }
    _save_income_cache(data)
    return data

# ================= ADS (Shopee Ads API) =================
# Module Ads aktif di app mp qukis (verified 05 Sep 2026):
#   - /api/v2/ads/get_product_level_campaign_id_list → list campaign
#   - /api/v2/ads/get_product_level_campaign_setting_info?campaign_id_list=..&info_type_list=1
#       → nama campaign + campaign_placement (search/discovery/all)
#   - /api/v2/ads/get_all_cpc_ads_daily_performance → performa harian shop (expense/clicks/order/gmv)
#   - /api/v2/ads/get_product_campaign_daily_performance → performa per campaign
# Signature GET sama seperti endpoint lain (pid+path+ts+at+shop_id).

def _ads_daily_performance(days=7):
    """Performa CPC ads harian shop-level. Return list per tanggal (Shopee format)."""
    end = datetime.date.today()
    start = end - datetime.timedelta(days=days - 1)
    r = shopee_get('/api/v2/ads/get_all_cpc_ads_daily_performance', {
        'start_date': start.strftime('%d-%m-%Y'),
        'end_date': end.strftime('%d-%m-%Y'),
    })
    return (r.get('response') or []) if isinstance(r.get('response'), list) else []

def _ads_campaign_list():
    """Semua campaign id + tipe. Loop pagination offset."""
    out = []
    offset = 0
    while True:
        r = shopee_get('/api/v2/ads/get_product_level_campaign_id_list', {
            'ad_type': 'all', 'offset': offset, 'limit': 100,
        })
        resp = r.get('response') or {}
        lst = resp.get('campaign_list') or []
        out.extend(lst)
        if not resp.get('has_next_page') or not lst:
            break
        offset += len(lst)
        if offset > 2000:
            break
    return out

def _ads_campaign_settings(campaign_ids):
    """Detail setting campaign (nama, placement, status). Batch 50 per request."""
    out = []
    for i in range(0, len(campaign_ids), 50):
        batch = campaign_ids[i:i + 50]
        r = shopee_get('/api/v2/ads/get_product_level_campaign_setting_info', {
            'campaign_id_list': ','.join(str(x) for x in batch),
            'info_type_list': '1',
        })
        cl = ((r.get('response') or {}).get('campaign_list')) or []
        for c in cl:
            ci = c.get('common_info') or {}
            out.append({
                'campaign_id': c.get('campaign_id'),
                'name': ci.get('ad_name'),
                'placement': ci.get('campaign_placement'),
                'status': ci.get('campaign_status'),
                'budget': ci.get('campaign_budget'),
                'ad_type': ci.get('ad_type'),
            })
    return out

def _ads_product_daily(campaign_id, days=7):
    """Performa harian satu campaign. Return list per tanggal."""
    end = datetime.date.today()
    start = end - datetime.timedelta(days=days - 1)
    r = shopee_get('/api/v2/ads/get_product_campaign_daily_performance', {
        'campaign_id': campaign_id,
        'start_date': start.strftime('%d-%m-%Y'),
        'end_date': end.strftime('%d-%m-%Y'),
    })
    resp = r.get('response') or {}
    return resp.get('performance_list') or resp.get('daily') or (resp if isinstance(resp, list) else [])

def _ads_overview_builder(days=7):
    """Data Ads buat Overview: agregat harian shop + jumlah campaign per placement."""
    daily = _ads_daily_performance(days)
    cams = _ads_campaign_list()
    ids = [c.get('campaign_id') for c in cams if c.get('campaign_id')]
    settings = _ads_campaign_settings(ids) if ids else []
    from collections import Counter
    placement_c = Counter(s.get('placement') for s in settings)
    status_c = Counter(s.get('status') for s in settings)

    total = {
        'expense': sum(float(d.get('expense') or 0) for d in daily),
        'clicks': sum(int(d.get('clicks') or 0) for d in daily),
        'impressions': sum(int(d.get('impression') or 0) for d in daily),
        'direct_order': sum(int(d.get('direct_order') or 0) for d in daily),
        'broad_order': sum(int(d.get('broad_order') or 0) for d in daily),
        'direct_gmv': sum(float(d.get('direct_gmv') or 0) for d in daily),
        'broad_gmv': sum(float(d.get('broad_gmv') or 0) for d in daily),
        'direct_roas': None,
        'broad_roas': None,
    }
    if total['expense'] > 0:
        total['direct_roas'] = round(total['direct_gmv'] / total['expense'], 2)
        total['broad_roas'] = round(total['broad_gmv'] / total['expense'], 2)
    return {
        'days': days,
        'total': total,
        'daily': daily,
        'campaigns': {
            'count': len(cams),
            'by_placement': dict(placement_c),
            'by_status': dict(status_c),
        },
        'generated_at': int(time.time()),
        'source': 'ads get_all_cpc_ads_daily_performance + campaign settings',
    }

def ads_overview(days=7):
    """Wrapper cache 60 menit. Days di-allow: 7/30."""
    key = f'adso_{days}d'
    return _orders_get('ads_overview', key, lambda: _ads_overview_builder(days))


# ============ ADS DETAIL per kategori (Tab Ads MP) ============
# Grouping sesuai UI MP: "Iklan Pencarian" = placement search,
# "Iklan Toko" = placement discovery + all, "CPAS" = belum aktif (AMS 403).
# Total (incl. Box/item_sold) dari get_all_cpc_ads_daily_performance (shop-level);
# per kategori di-agregat dari get_product_campaign_daily_performance
# (catatan: endpoint per-campaign TIDAK menyediakan item_sold → box per kategori = null).
_ADS_PLACEMENT_GROUPS = {
    'search': 'search',
    'toko': ('discovery', 'all'),
}

def _ads_daily_performance_range(from_iso, to_iso):
    """Performa harian shop-level untuk rentang tanggal (ISO).

    Shopee Ads API batasi maks ~30 hari per request → rentang lebih panjang
    dipecah per 30 hari & digabung (dedup per tanggal)."""
    from datetime import datetime as _dt, timedelta as _td
    sd = _dt.strptime(from_iso, '%Y-%m-%d').date()
    ed = _dt.strptime(to_iso, '%Y-%m-%d').date()
    out = []
    seen = set()
    cur = sd
    while cur <= ed:
        chunk_end = min(cur + _td(days=29), ed)  # maks 30 hari per chunk
        r = shopee_get('/api/v2/ads/get_all_cpc_ads_daily_performance', {
            'start_date': cur.strftime('%d-%m-%Y'),
            'end_date': chunk_end.strftime('%d-%m-%Y'),
        })
        lst = (r.get('response') or []) if isinstance(r.get('response'), list) else []
        for d in lst:
            k = d.get('date')
            if k and k not in seen:
                seen.add(k)
                out.append(d)
        cur = chunk_end + _td(days=1)
    return out

def _ads_campaign_perf_batch(campaign_ids, from_iso, to_iso):
    """Performa harian per campaign (dict campaign_id → list metrics). Batch max 100.
    Kalau batch kena error_param (ada campaign id yg sudah dihapus/invalid), pecah
    per id dan skip yg error — biar satu id jelek nggak bikin data lain hilang."""
    from datetime import datetime as _dt
    sd = _dt.strptime(from_iso, '%Y-%m-%d').date()
    ed = _dt.strptime(to_iso, '%Y-%m-%d').date()
    out = {}
    bad = []

    def fetch_batch(batch):
        r = shopee_get('/api/v2/ads/get_product_campaign_daily_performance', {
            'campaign_id_list': ','.join(str(x) for x in batch),
            'start_date': sd.strftime('%d-%m-%Y'),
            'end_date': ed.strftime('%d-%m-%Y'),
        })
        if r.get('error'):
            return None
        cl = ((r.get('response') or {}).get('campaign_list')) or []
        for c in cl:
            out[c.get('campaign_id')] = c.get('metrics_list') or []
        return True

    # batch gagal → coba setengah-setengah (rekursif) utk isolasi id jelek.
    # Didefinisikan sekali di luar loop (sebelumnya re-defined tiap iterasi).
    def split_fetch(lst):
        if len(lst) == 1:
            if fetch_batch(lst) is None:
                bad.append(lst[0])
            return
        mid = len(lst) // 2
        a, b = lst[:mid], lst[mid:]
        if fetch_batch(a) is None:
            split_fetch(a)
        if fetch_batch(b) is None:
            split_fetch(b)

    for i in range(0, len(campaign_ids), 100):
        batch = campaign_ids[i:i + 100]
        if len(batch) <= 1:
            if fetch_batch(batch) is None:
                bad.extend(batch)
            continue
        if fetch_batch(batch) is not None:
            continue
        split_fetch(batch)
    return out

def _ads_detail_builder(from_iso, to_iso):
    """Data lengkap Tab Ads: total shop-level + agregasi per kategori placement.

    Catatan: endpoint ini (/api/ads/detail) TIDAK dipanggil frontend saat ini
    (Tab Ads pakai /api/ads/metric + /api/ads/series, arsitektur card-based).
    Dibiarkan aktif kalau ada konsumen lain (laporan terpisah, dsb) — kalau
    memang gak dipakai, aman dihapus bareng ads_detail() & handler di do_GET."""
    daily = _ads_daily_performance_range(from_iso, to_iso)
    cams = _ads_campaign_list()
    ids = [c.get('campaign_id') for c in cams if c.get('campaign_id')]
    settings = _ads_campaign_settings(ids) if ids else []
    pmap = {}
    for s in settings:
        if s.get('campaign_id'):
            pmap[s['campaign_id']] = s.get('placement') or 'all'
    perf_map = _ads_campaign_perf_batch(ids, from_iso, to_iso) if ids else {}

    # Total shop-level (satu-satunya sumber Box/item_sold)
    t_budget = sum(float(d.get('expense') or 0) for d in daily)
    t_klik = sum(int(d.get('clicks') or 0) for d in daily)
    t_closing = sum(int(d.get('broad_order') or 0) for d in daily)
    t_box = sum(int(d.get('broad_item_sold') or 0) for d in daily)
    t_gmv = sum(float(d.get('broad_gmv') or 0) for d in daily)
    total = {
        'budget': round(t_budget),
        'klik': int(t_klik),
        'closing': int(t_closing),
        'box': int(t_box),
        'gmv': round(t_gmv),
        'roas': round(t_gmv / t_budget, 2) if t_budget > 0 else None,
    }

    # Iklan Produk = product ads keseluruhan (sama dgn total shop-level,
    # sumbernya get_all_cpc_ads_daily_performance → box/item_sold TERSEDIA).
    categories = [
        {
            'key': 'produk', 'label': 'Iklan Produk', 'icon': 'package',
            'placement': 'product ads (all)', 'count': len(ids),
            'budget': total['budget'], 'klik': total['klik'], 'closing': total['closing'],
            'box': total['box'], 'gmv': total['gmv'], 'roas': total['roas'],
            'note': None,
        },
        {
            'key': 'toko', 'label': 'Iklan Toko', 'icon': 'store',
            'placement': 'shop ads', 'count': 0,
            'budget': 0, 'klik': 0, 'closing': 0, 'box': 0, 'gmv': 0,
            'roas': None, 'note': 'Data Iklan Toko (Shop Ads) tidak tersedia di Open Platform API',
        },
        {
            'key': 'cpas', 'label': 'CPAS', 'icon': 'megaphone',
            'placement': 'ams (403)', 'count': 0,
            'budget': 0, 'klik': 0, 'closing': 0, 'box': 0, 'gmv': 0,
            'roas': None, 'note': 'Belum aktif — AMS (afiliasi) belum di-approve (HTTP 403)',
        },
    ]
    return {
        'from': from_iso, 'to': to_iso,
        'total': total,
        'categories': categories,
        'campaign_count': len(ids),
        'generated_at': int(time.time()),
        'source': 'ads get_all_cpc_ads_daily_performance (total) + get_product_campaign_daily_performance (per kategori)',
    }

def ads_detail(from_iso, to_iso):
    # TTL pendek (90 detik) supaya data iklan terasa realtime, tapi tetap
    # nggak membanjiri Shopee API tiap render.
    key = f'adsd_{from_iso}_{to_iso}'
    return _orders_get('ads_detail', key, lambda: _ads_detail_builder(from_iso, to_iso), ttl=90)


# ============ ShopeeAdsService — metric card realtime (Cron Iklan spec) ============
# Arsitektur card-based:
#   getDashboardMetric(tab, card, start_date, end_date) → response seragam.
# Semua data dari endpoint resmi get_all_cpc_ads_daily_performance (harian) &
# get_all_cpc_ads_hourly_performance (per jam). Per-card TIDAK memanggil API
# terpisah — metric dihitung dari data harian yang sama (cache 30 detik),
# sesuai prinsip: jangan ambil seluruh data tiap buka, jangan dummy.
# CTR  = clicks / impressions × 100 ; ROAS = sales / ad_spend (0 kalau pembagi 0)
ADS_METRIC_TTL = 30

_METRIC_KIND = {
    'impressions': 'count', 'clicks': 'count', 'orders': 'count', 'sold': 'count',
    'sales': 'money', 'ad_spend': 'money', 'ctr': 'percent', 'roas': 'roas',
}

# tab → {CARD_ID: (metric, kind)}
_ADS_CARDS = {
    'product': {
        'PRODUCT_IMPRESSIONS': ('impressions', 'count'),
        'PRODUCT_CLICKS': ('clicks', 'count'),
        'PRODUCT_CTR': ('ctr', 'percent'),
        'PRODUCT_ORDERS': ('orders', 'count'),
        'PRODUCT_SOLD': ('sold', 'count'),
        'PRODUCT_SALES': ('sales', 'money'),
        'PRODUCT_AD_SPEND': ('ad_spend', 'money'),
        'PRODUCT_ROAS': ('roas', 'roas'),
    },
    # Iklan Toko+ tidak punya API terpisah di Open Platform. Data "shop" di sini
    # dihitung dari SELISIH: total iklan (get_all_cpc_ads_daily_performance, yang
    # mencakup product + jenis lain) dikurangi Iklan Produk (agregat campaign product).
    'shop': {
        'SHOP_SOV': ('sov', 'percent'),
        'SHOP_IMPRESSIONS': ('impressions', 'count'),
        'SHOP_CLICKS': ('clicks', 'count'),
        'SHOP_CTR': ('ctr', 'percent'),
        'SHOP_ORDERS': ('orders', 'count'),
        'SHOP_SOLD': ('sold', 'count'),
        'SHOP_SALES': ('sales', 'money'),
        'SHOP_AD_SPEND': ('ad_spend', 'money'),
    },
}

def _fmt_metric_value(value, kind):
    if kind == 'money':
        return "Rp" + f"{int(round(value)):,}".replace(',', '.')
    if kind == 'percent':
        return f"{value:.2f}".replace('.', ',') + "%"
    if kind == 'roas':
        return f"{value:.2f}".replace('.', ',')
    # count
    v = int(round(value))
    if v >= 1_000_000:
        return f"{(v / 1_000_000):.1f}".replace('.', ',') + "jt"
    if v >= 1_000:
        return f"{(v / 1_000):.1f}".replace('.', ',') + "rb"
    return f"{v:,}".replace(',', '.')

def _sum_daily(daily_list):
    """Jumlahkan list harian (get_all_cpc_ads_daily_performance) jadi satu item
    agregat berbentuk sama seperti 1 baris Shopee — biar bisa dipakai ulang oleh
    _series_metric_value (rumus ctr/roas/dst jadi satu-satunya sumber, gak ke-copy)."""
    return {
        'impression': sum(int(d.get('impression') or 0) for d in daily_list),
        'clicks': sum(int(d.get('clicks') or 0) for d in daily_list),
        'broad_order': sum(int(d.get('broad_order') or 0) for d in daily_list),
        'broad_item_sold': sum(int(d.get('broad_item_sold') or 0) for d in daily_list),
        'broad_gmv': sum(float(d.get('broad_gmv') or 0) for d in daily_list),
        'expense': sum(float(d.get('expense') or 0) for d in daily_list),
    }

def _daily_metric_value(daily_list, metric):
    """Hitung nilai metric dari list harian (get_all_cpc_ads_daily_performance)."""
    return _series_metric_value(_sum_daily(daily_list), metric)

def _ads_daily_cached(from_iso, to_iso):
    """List harian metric dengan cache 30 detik (realtime-friendly)."""
    key = f'adsdly_{from_iso}_{to_iso}'
    return _orders_get('ads_daily_metric', key, lambda: _ads_daily_performance_range(from_iso, to_iso), ttl=ADS_METRIC_TTL)

# ============ Iklan Toko+ (Shop Ads) — ESTIMASI via selisih ============
# Open Platform TIDAK punya endpoint shop-ads terpisah. Estimasi = total iklan
# shop-level (get_all_cpc_ads_daily_performance, mencakup semua jenis ads) DIKURANGI
# Iklan Produk (agregat get_product_campaign_daily_performance per campaign, semua
# campaign product ads). Hasilnya SELALU dilabeli is_estimate=True di response API
# supaya frontend wajib nampilin badge "Estimasi" — jangan pernah ditampilkan
# seolah data resmi Shopee.
#
# Keterbatasan yang JUJUR ditolak (bukan dikarang jadi 0), lihat pemakaian di
# get_dashboard_metric/get_metric_series:
#   - SOV (share of voice): Shopee sama sekali gak expose data impression-share.
#   - sold/box (item terjual): get_product_campaign_daily_performance TIDAK
#     mengembalikan field ini per campaign, jadi gak ada apa pun buat dikurangkan
#     dari total → tidak bisa dipisah, bukan berarti nol.
#   - interval per jam: get_product_campaign_daily_performance cuma harian, gak
#     ada versi per-jam → estimasi shop gak bisa dipecah per jam.
def _ads_shop_estimate_daily(from_iso, to_iso):
    """Selisih harian (total - Iklan Produk) per tanggal, di-clamp ke 0.

    Clamp per-hari (bukan cuma di total akhir) supaya chart gak pernah nunjukkin
    garis negatif kalau ada mismatch kecil waktu sync antar dua endpoint Shopee —
    lalu semua turunan (card total, dsb) dihitung dari hasil harian yang sama ini
    (via _sum_daily/_daily_metric_value) biar chart & card selalu konsisten satu
    sama lain, gak dihitung dua cara terpisah yang bisa beda angka."""
    total = _ads_daily_performance_range(from_iso, to_iso)
    cams = _ads_campaign_list()
    ids = [c.get('campaign_id') for c in cams if c.get('campaign_id')]
    perf = _ads_campaign_perf_batch(ids, from_iso, to_iso) if ids else {}
    prod_by_date = {}
    for metrics_list in perf.values():
        for m in metrics_list:
            key = m.get('date')
            a = prod_by_date.setdefault(key, {
                'impression': 0, 'clicks': 0, 'broad_order': 0,
                'broad_gmv': 0.0, 'expense': 0.0,
            })
            a['impression'] += int(m.get('impression') or 0)
            a['clicks'] += int(m.get('clicks') or 0)
            a['broad_order'] += int(m.get('broad_order') or 0)
            a['broad_gmv'] += float(m.get('broad_gmv') or 0)
            a['expense'] += float(m.get('expense') or 0)
    out = []
    for d in total:
        key = d.get('date')
        p = prod_by_date.get(key) or {
            'impression': 0, 'clicks': 0, 'broad_order': 0,
            'broad_gmv': 0.0, 'expense': 0.0,
        }
        # Sengaja TANPA 'broad_item_sold' — lihat catatan di atas kenapa 'sold'
        # gak bisa diestimasi, dan sengaja ditolak sebelum sampai ke sini.
        out.append({
            'date': key,
            'impression': max(0, int(d.get('impression') or 0) - p['impression']),
            'clicks': max(0, int(d.get('clicks') or 0) - p['clicks']),
            'broad_order': max(0, int(d.get('broad_order') or 0) - p['broad_order']),
            'broad_gmv': max(0.0, float(d.get('broad_gmv') or 0) - p['broad_gmv']),
            'expense': max(0.0, float(d.get('expense') or 0) - p['expense']),
        })
    return out

def _ads_shop_estimate_cached(from_iso, to_iso):
    """Cache 30 detik, pola sama seperti _ads_daily_cached."""
    key = f'adsshopest_{from_iso}_{to_iso}'
    return _orders_get('ads_shop_estimate', key, lambda: _ads_shop_estimate_daily(from_iso, to_iso), ttl=ADS_METRIC_TTL)

_ADS_ESTIMATE_NOTE = ('Estimasi: dihitung dari selisih total iklan dikurangi Iklan Produk — '
                      'Shopee Open Platform tidak menyediakan data Iklan Toko (Shop Ads) secara terpisah.')

# Metric yang TIDAK bisa dihitung sama sekali untuk tab shop, walau via estimasi selisih
# (lihat penjelasan di atas _ads_shop_estimate_daily) — jangan dikarang jadi 0.
_SHOP_UNAVAILABLE_METRICS = {'sov', 'sold'}

def _iso_to_dmy(iso):
    try:
        return datetime.datetime.strptime(iso, '%Y-%m-%d').strftime('%d-%m-%Y')
    except Exception:
        return None

def get_dashboard_metric(tab, card, start_date, end_date, timezone='Asia/Jakarta'):
    """Router utama: tab+card → metric → nilai realtime (response seragam)."""
    now_wib = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7)))
    def ok_resp(metric, value, kind):
        return {
            'success': True, 'tab': tab, 'card': card, 'metric': metric,
            'value': value, 'formatted_value': _fmt_metric_value(value, kind),
            'date': {'start': start_date, 'end': end_date},
            'timezone': timezone,
            'updated_at': now_wib.strftime('%Y-%m-%dT%H:%M:%S+07:00'),
        }
    def err_resp(code):
        return {
            'success': False, 'tab': tab, 'card': card, 'error': code,
            'date': {'start': start_date, 'end': end_date},
            'timezone': timezone,
            'updated_at': now_wib.strftime('%Y-%m-%dT%H:%M:%S+07:00'),
        }

    # tab 'shop' (Iklan Toko+) = ESTIMASI selisih (lihat _ads_shop_estimate_daily).
    # tab lain di luar 'product'/'shop' tidak dikenal sama sekali.
    if tab not in ('product', 'shop'):
        return err_resp('ENDPOINT_NOT_CONFIGURED')
    cards = _ADS_CARDS.get(tab)
    if card not in cards:
        return err_resp('ENDPOINT_NOT_CONFIGURED')
    metric, kind = cards[card]
    if tab == 'shop' and metric in _SHOP_UNAVAILABLE_METRICS:
        # SOV & sold/box gak bisa diestimasi sama sekali — lihat catatan di
        # _ads_shop_estimate_daily. Jangan dikarang jadi 0.
        return err_resp('METRIC_NOT_AVAILABLE')
    try:
        daily = _ads_shop_estimate_cached(start_date, end_date) if tab == 'shop' else _ads_daily_cached(start_date, end_date)
    except Exception as e:
        return _map_exc_to_err(e, err_resp)
    if not daily:
        return err_resp('INVALID_API_RESPONSE')
    if metric == 'sov':
        return err_resp('METRIC_NOT_AVAILABLE')
    value = _daily_metric_value(daily, metric)
    if value is None:
        return err_resp('INVALID_API_RESPONSE')
    resp = ok_resp(metric, value, kind)
    if tab == 'shop':
        resp['is_estimate'] = True
        resp['estimate_note'] = _ADS_ESTIMATE_NOTE
    return resp

def _map_exc_to_err(e, err_resp):
    msg = str(e)
    if '429' in msg:
        return err_resp('API_RATE_LIMIT')
    if '403' in msg:
        return err_resp('TOKEN_EXPIRED')
    if 'timeout' in msg.lower() or 'timed out' in msg.lower() or 'Timeout' in msg:
        return err_resp('API_TIMEOUT')
    if '404' in msg:
        return err_resp('ENDPOINT_NOT_CONFIGURED')
    return err_resp('INVALID_API_RESPONSE')

def _series_metric_value(item, metric):
    """Nilai metric dari satu item (harian/jam)."""
    if metric == 'impressions':
        return int(item.get('impression') or 0)
    if metric == 'clicks':
        return int(item.get('clicks') or 0)
    if metric == 'orders':
        return int(item.get('broad_order') or 0)
    if metric == 'sold':
        return int(item.get('broad_item_sold') or 0)
    if metric == 'sales':
        return int(item.get('broad_gmv') or 0)
    if metric == 'ad_spend':
        return int(item.get('expense') or 0)
    if metric == 'ctr':
        imp = int(item.get('impression') or 0)
        clk = int(item.get('clicks') or 0)
        return round((clk / imp * 100.0) if imp else 0.0, 2)
    if metric == 'roas':
        spend = float(item.get('expense') or 0)
        sales = float(item.get('broad_gmv') or 0)
        return round((sales / spend) if spend else 0.0, 2)
    return None

def get_metric_series(metric, start_date, end_date, interval='day', tab='product'):
    """Time-series metric (chart) — Iklan Produk (tab='product', get_all_cpc_ads_daily_performance)
    atau Iklan Toko+ ESTIMASI (tab='shop', selisih total-produk, lihat _ads_shop_estimate_daily).

    tab di luar 'product'/'shop' ditolak eksplisit (ENDPOINT_NOT_CONFIGURED) — sebelum
    fix ini, endpoint diam-diam menghitung dari data 'product' tapi tetap label
    tab:'product' di response, jadi consumer yang minta tab=shop bakal dapet angka
    Iklan Produk yang dikira Iklan Toko. Sekarang tab=shop dihitung & dilabel jujur
    sebagai estimasi (is_estimate=True), bukan lagi ditolak mentah-mentah."""
    if tab not in ('product', 'shop'):
        return {'success': False, 'error': 'ENDPOINT_NOT_CONFIGURED', 'tab': tab}
    valid = metric in _METRIC_KIND
    if not valid:
        return {'success': False, 'error': 'INVALID_METRIC'}
    if tab == 'shop' and metric in _SHOP_UNAVAILABLE_METRICS:
        return {'success': False, 'error': 'METRIC_NOT_AVAILABLE', 'tab': tab}
    if tab == 'shop' and interval == 'hour':
        # get_product_campaign_daily_performance cuma harian → estimasi shop gak
        # bisa dipecah per jam (gak ada apa pun buat dikurangkan dari total per jam).
        return {'success': False, 'error': 'METRIC_NOT_AVAILABLE', 'tab': tab}
    try:
        if interval == 'hour':
            items = _orders_get('ads_hourly_metric', f'adsh_{start_date}',
                                lambda: _ads_hourly_for_date(start_date), ttl=ADS_METRIC_TTL)
        elif tab == 'shop':
            items = _ads_shop_estimate_cached(start_date, end_date)
        else:
            items = _ads_daily_cached(start_date, end_date)
    except Exception:
        return {'success': False, 'error': 'INVALID_API_RESPONSE'}
    out = []
    for it in items or []:
        v = _series_metric_value(it, metric)
        if interval == 'hour':
            hh = int(it.get('hour') or 0)
            out.append({'time': f'{hh:02d}:00', 'value': v})
        else:
            dd = (it.get('date') or '')
            try:
                iso = datetime.datetime.strptime(dd, '%d-%m-%Y').strftime('%Y-%m-%d')
            except Exception:
                iso = dd
            out.append({'date': iso, 'value': v})
    result = {'success': True, 'metric': metric, 'interval': interval, 'tab': tab, 'points': out}
    if tab == 'shop':
        result['is_estimate'] = True
        result['estimate_note'] = _ADS_ESTIMATE_NOTE
    return result

def _ads_hourly_for_date(date_iso):
    dmy = _iso_to_dmy(date_iso)
    if not dmy:
        return []
    r = shopee_get('/api/v2/ads/get_all_cpc_ads_hourly_performance', {'performance_date': dmy})
    resp = r.get('response')
    return resp if isinstance(resp, list) else []


def _orders_cache_file(name, key):
    return os.path.join(BASE_DIR, f'{name}_cache_{key}.json')

def _orders_cache_read(name, key):
    """Baca file cache → {'generated_at', 'data'} atau None."""
    try:
        with open(_orders_cache_file(name, key)) as f:
            return json.load(f)
    except Exception:
        return None

def _orders_cache_save(name, key, data):
    try:
        with open(_orders_cache_file(name, key), 'w') as f:
            json.dump({'generated_at': int(time.time()), 'data': data}, f, ensure_ascii=False)
    except Exception:
        pass

# Lock + set buat auto-refresh: hindari 2 thread refresh key yang sama barengan
_refresh_lock = threading.Lock()
_refreshing = set()

def _refresh_async(name, key, builder):
    """Refresh cache di background. Kalau lagi jalan buat key ini, skip."""
    with _refresh_lock:
        if key in _refreshing:
            return
        _refreshing.add(key)

    def worker():
        try:
            data = builder()
            _orders_cache_save(name, key, data)
        except Exception:
            pass
        finally:
            with _refresh_lock:
                _refreshing.discard(key)

    t = threading.Thread(target=worker, daemon=True)
    t.start()

def _orders_get(name, key, builder, ttl=None):
    """Ambil data: cache fresh → langsung. cache stale → balikin lama + refresh bg.
    Nggak ada cache → hitung sync (sekali). ttl detik (default ORDERS_TTL)."""
    if ttl is None:
        ttl = ORDERS_TTL
    obj = _orders_cache_read(name, key)
    now = int(time.time())
    if obj is not None and now - obj.get('generated_at', 0) < ttl:
        return obj.get('data')
    if obj is not None:
        # stale: balikin dulu, refresh di background biar user nggak nunggu
        _refresh_async(name, key, builder)
        return obj.get('data')
    # belum pernah ada: hitung sync
    data = builder()
    _orders_cache_save(name, key, data)
    return data

def _summary_builder(range_key, from_ts, to_ts):
    """Susun data dashboard Pesanan (tanpa cache). Fetch berat: 11 status."""
    f_ts, t_ts, range_label = resolve_range(range_key, from_ts, to_ts)
    status_counts = count_orders_by_status(f_ts, t_ts)

    # Group status ke label Indonesia
    label_counter = Counter()
    for st, count in status_counts.items():
        lbl = STATUS_LABEL.get(st, st or 'Lainnya')
        label_counter[lbl] += count

    # Recent orders + detail
    sns = fetch_recent_orders(f_ts, t_ts, limit=20)
    details = fetch_order_details(sns)
    recent = []
    for d in details:
        items = d.get('item_list') or []
        first_item = items[0] if items else {}
        recipient = d.get('recipient_address') or {}
        recent.append({
            'order_sn': d.get('order_sn'),
            'status': STATUS_LABEL.get(d.get('order_status'), d.get('order_status') or 'Lainnya'),
            'create_time': d.get('create_time'),
            'total': (d.get('total_amount') or {}).get('value') if isinstance(d.get('total_amount'), dict) else d.get('total_amount'),
            'currency': d.get('currency'),
            'buyer': recipient.get('name') or '',
            'produk': first_item.get('item_name') or '',
            'sku': first_item.get('item_sku') or '',
            'qty': first_item.get('model_quantity_purchased') or 0,
        })
    recent.sort(key=lambda x: x.get('create_time') or 0, reverse=True)
    recent = recent[:10]

    return {
        'range': range_key,
        'label': range_label,
        'total_orders': sum(label_counter.values()),
        'status_distribution': dict(label_counter),
        'recent_orders': recent,
        'generated_at': int(time.time()),
    }

def build_dashboard_summary(range_key='7d', from_ts=None, to_ts=None):
    """Summary dashboard Pesanan. Cache 60 menit + auto-refresh background."""
    key = _custom_key(range_key, from_ts, to_ts)
    return _orders_get('orders_summary', key, lambda: _summary_builder(range_key, from_ts, to_ts))

def warm_orders_caches():
    """Pre-warm semua range default di background (dipanggil thread daemon)."""
    for rk in ('7d', '30d', 'today', 'yesterday'):
        try:
            daily_order_counts(range_key=rk)
        except Exception:
            pass
        time.sleep(0.5)
        try:
            build_dashboard_summary(range_key=rk)
        except Exception:
            pass

def _warm_loop():
    while True:
        time.sleep(WARM_INTERVAL)
        warm_orders_caches()

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def _send_json(self, data, code=200):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)
        try:
            if path == '/health':
                return self._send_json({'status': 'ok', 'time': int(time.time())})
            elif path == '/api/shop':
                r = shopee_get('/api/v2/shop/get_shop_info')
                return self._send_json(r)
            elif path == '/api/orders/summary':
                rk = qs.get('range', ['7d'])[0]
                fts = parse_date(qs.get('from', [''])[0]) if qs.get('from', [''])[0] else None
                tts = parse_date(qs.get('to', [''])[0]) if qs.get('to', [''])[0] else None
                if fts is not None and tts is not None:
                    tts = tts + 86400  # sampai akhir hari to
                    if tts > fts:
                        rk = 'custom'
                if rk not in ('today', 'yesterday', '7d', '30d', 'custom'):
                    rk = '7d'
                data = build_dashboard_summary(range_key=rk, from_ts=fts, to_ts=tts)
                return self._send_json(data)
            elif path == '/api/orders/recent':
                rk = qs.get('range', ['7d'])[0]
                fts = parse_date(qs.get('from', [''])[0]) if qs.get('from', [''])[0] else None
                tts = parse_date(qs.get('to', [''])[0]) if qs.get('to', [''])[0] else None
                if fts is not None and tts is not None:
                    tts = tts + 86400
                    if tts > fts:
                        rk = 'custom'
                if rk not in ('today', 'yesterday', '7d', '30d', 'custom'):
                    rk = '7d'
                f_ts, t_ts, _ = resolve_range(rk, fts, tts)
                limit = int(qs.get('limit', ['20'])[0])
                sns = fetch_recent_orders(f_ts, t_ts, limit=limit)
                details = fetch_order_details(sns)
                return self._send_json({'orders': details})
            elif path == '/api/orders/daily':
                rk = qs.get('range', ['7d'])[0]
                fts = parse_date(qs.get('from', [''])[0]) if qs.get('from', [''])[0] else None
                tts = parse_date(qs.get('to', [''])[0]) if qs.get('to', [''])[0] else None
                if fts is not None and tts is not None:
                    tts = tts + 86400
                    if tts > fts:
                        rk = 'custom'
                if rk not in ('today', 'yesterday', '7d', '30d', 'custom'):
                    rk = '7d'
                data = daily_order_counts(range_key=rk, from_ts=fts, to_ts=tts)
                return self._send_json({'daily': data})
            elif path == '/api/export/summary':
                # Data dari file export Shopee (Pesanan Saya → export). Bukan realtime.
                # Dukung from/to (YYYY-MM-DD) → agregasi dari raw recs per tanggal.
                f_iso = qs.get('from', [''])[0]
                t_iso = qs.get('to', [''])[0]
                if f_iso and t_iso:
                    try:
                        data = _export_summary_for_range(f_iso, t_iso)
                        if data is not None:
                            return self._send_json(data)
                        # range di luar raw yang tersedia → fallback D-1 + catatan
                        with open(os.path.join(BASE_DIR, 'export_summary.json')) as f:
                            base = json.load(f)
                        base['_range_warning'] = f"Data detail {f_iso} s.d. {t_iso} belum tersedia — menampilkan D-1"
                        return self._send_json(base)
                    except Exception as e:
                        return self._send_json({'error': str(e)}, 500)
                try:
                    with open(os.path.join(BASE_DIR, 'export_summary.json')) as f:
                        return self._send_json(json.load(f))
                except Exception as e:
                    return self._send_json({'error': str(e)}, 500)
            elif path == '/api/income/summary':
                days = int(qs.get('days', ['30'])[0])
                data = build_income_summary(days=days)
                return self._send_json(data)
            elif path == '/api/ads/overview':
                days = int(qs.get('days', ['7'])[0])
                if days not in (7, 30):
                    days = 7
                data = ads_overview(days=days)
                return self._send_json(data)
            elif path == '/api/ads/detail':
                from_iso = qs.get('from', [''])[0]
                to_iso = qs.get('to', [''])[0]
                if not (from_iso and to_iso):
                    today = datetime.date.today()
                    to_iso = today.strftime('%Y-%m-%d')
                    from_iso = (today - datetime.timedelta(days=6)).strftime('%Y-%m-%d')
                data = ads_detail(from_iso, to_iso)
                return self._send_json(data)
            elif path == '/api/ads/metric':
                tab = qs.get('tab', ['product'])[0]
                card = qs.get('card', ['PRODUCT_SALES'])[0]
                sd = qs.get('start_date', [''])[0]
                ed = qs.get('end_date', [''])[0]
                tz = qs.get('timezone', ['Asia/Jakarta'])[0]
                if not (sd and ed):
                    today = datetime.date.today()
                    sd = ed = today.strftime('%Y-%m-%d')
                data = get_dashboard_metric(tab, card, sd, ed, tz)
                return self._send_json(data)
            elif path == '/api/ads/series':
                metric = qs.get('metric', ['sales'])[0]
                interval = qs.get('interval', ['day'])[0]
                tab = qs.get('tab', ['product'])[0]
                sd = qs.get('start_date', [''])[0]
                ed = qs.get('end_date', [''])[0]
                if not (sd and ed):
                    today = datetime.date.today()
                    ed = today.strftime('%Y-%m-%d')
                    sd = (today - datetime.timedelta(days=6)).strftime('%Y-%m-%d')
                data = get_metric_series(metric, sd, ed, interval, tab)
                return self._send_json(data)
            else:
                return self._send_json({'error': 'not found', 'path': path}, 404)
        except Exception as e:
            return self._send_json({'error': str(e)}, 500)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', '5010'))
    # Auto-refresh background: warm semua range default tiap 15 menit (daemon)
    threading.Thread(target=_warm_loop, daemon=True).start()
    print(f"Shopee proxy backend on :{port} (warm loop aktif, cache {ORDERS_TTL//60} menit)")
    ThreadingHTTPServer(('0.0.0.0', port), Handler).serve_forever()
