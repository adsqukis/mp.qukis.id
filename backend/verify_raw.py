#!/usr/bin/env python3
"""Verifikasi kelengkapan data pesanan: jumlah order di file RAW vs hitung LIVE dari Shopee.

Dipakai oleh mp_daily_pull.sh (deteksi dini data bolong — kasus 9 Sep 2026: raw 150 vs live 455).

Usage:
  python3 verify_raw.py [n_hari=2]

Exit 0 = semua lengkap. Exit 1 + cetak tanggal yang kurang.
"""
import glob
import importlib.util
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone

BASE = os.path.dirname(os.path.abspath(__file__))
WIB = timezone(timedelta(hours=7))

spec = importlib.util.spec_from_file_location('sb', os.path.join(BASE, 'app.py'))
sb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sb)


def raw_counts():
    """{tanggal: jumlah order unik} dari semua orders_raw_*.json."""
    per_date = {}
    for fp in sorted(glob.glob(os.path.join(BASE, 'orders_raw_*.json'))):
        if fp.endswith('.bak') or '.bak_' in fp:
            continue
        try:
            recs = json.load(open(fp, encoding='utf-8'))
        except Exception:
            continue
        for r in recs:
            d = r.get('tanggal')
            if d:
                per_date.setdefault(d, set()).add(r.get('order'))
    return {d: len(s) for d, s in per_date.items()}


def live_count(day_iso):
    """Jumlah order unik (create_time) untuk satu tanggal, langsung dari Shopee API."""
    d0 = datetime.strptime(day_iso, '%Y-%m-%d').replace(tzinfo=WIB)
    f = int(d0.timestamp())
    t = f + 86400
    sns, cursor, pages = set(), '', 0
    while True:
        r = sb.shopee_get('/api/v2/order/get_order_list', {
            'time_range_field': 'create_time', 'time_from': f, 'time_to': t,
            'page_size': 100, 'cursor': cursor})
        resp = r.get('response')
        if not isinstance(resp, dict):
            time.sleep(2)
            pages += 1
            if pages > 8:
                raise RuntimeError('Shopee API tidak balas (respons kosong)')
            continue
        lst = resp.get('order_list') or []
        sns.update([o.get('order_sn') for o in lst if o.get('order_sn')])
        if not resp.get('more', False):
            break
        nxt = resp.get('next_cursor') or ''
        if not nxt or nxt == cursor:
            break
        cursor = nxt
        pages += 1
        if pages > 60:
            break
    return len(sns)


def main():
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 2
    today = datetime.now(WIB).date()
    rc = raw_counts()
    bad = []
    for i in range(1, days + 1):
        d = (today - timedelta(days=i)).isoformat()
        rn = rc.get(d, 0)
        try:
            lv = live_count(d)
        except Exception as e:
            print(f'{d}: ERROR cek live ({e})')
            bad.append((d, rn, -1))
            continue
        status = 'OK' if rn >= lv else f'KURANG {lv - rn}'
        print(f'{d}: raw={rn} live={lv} -> {status}')
        if rn < lv:
            bad.append((d, rn, lv))
        time.sleep(0.3)

    if bad:
        print('\nDATA TIDAK LENGKAP:')
        for d, rn, lv in bad:
            print(f'  {d}: raw {rn} vs live {lv}')
        print('\nPerbaiki: python3 pull_range.py <tanggal> <tanggal>')
        return 1
    print('\nSemua tanggal lengkap.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
