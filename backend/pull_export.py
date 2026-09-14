#!/usr/bin/env python3
"""Tarik data pesanan Shopee API langsung (TANPA file export Excel) → export_summary.json.

Pengganti alur manual: JMN export Seller Centre → kirim xlsx → parse_export.py.
Sekarang: cukup jalankan script ini, data D-1 (atau tanggal tertentu) ditarik dari
Shopee Open Platform → struktur JSON SAMA dengan parse_export.py (statuses, by_produk,
status_order/status_qty, dll) → UI mp.qukis.id langsung tampil.

Usage:
  python3 pull_export.py                 # default: kemarin (D-1) WIB
  python3 pull_export.py 2026-09-03      # tanggal tertentu
  python3 pull_export.py --write-json    # tulis export_summary.json (default ya)
"""
import argparse
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util
spec = importlib.util.spec_from_file_location("sb", os.path.join(os.path.dirname(os.path.abspath(__file__)), "app.py"))
sb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sb)  # tidak trigger server (guard __main__)

# Reuse _summarize dari parse_export.py
spec2 = importlib.util.spec_from_file_location("pe", os.path.join(os.path.dirname(os.path.abspath(__file__)), "parse_export.py"))
pe = importlib.util.module_from_spec(spec2)
spec2.loader.exec_module(pe)

WIB = timezone(timedelta(hours=7))

# Mapping status API Shopee → label export (konsisten dgn crosstab 3 Sep):
#   SHIPPED/IN_CANCEL → "Sedang Dikirim" (di export IN_CANCEL tampil Sedang Dikirim)
#   TO_CONFIRM_RECEIVE → "Telah Dikirim"
#   COMPLETED → "Pesanan Diterima" (export: "Pesanan diterima, namun ...")
#   CANCELLED/CANCEL → "Batal"
#   PROCESSED/READY_TO_SHIP/RETRY_SHIP → "Perlu Dikirim"
API_TO_EXPORT_STATUS = {
    "UNPAID": "Belum bayar",
    "READY_TO_SHIP": "Perlu Dikirim",
    "RETRY_SHIP": "Perlu Dikirim",
    "PROCESSED": "Perlu Dikirim",
    "SHIPPED": "Sedang Dikirim",
    "IN_CANCEL": "Sedang Dikirim",      # mengikuti export: 2 order IN_CANCEL tampil "Sedang Dikirim"
    "TO_CONFIRM_RECEIVE": "Telah Dikirim",
    "COMPLETED": "Pesanan Diterima",
    "CANCELLED": "Batal",
    "CANCEL": "Batal",
    "TO_RETURN": "Retur",
    "INVOICE_PENDING": "Perlu Dikirim",
}


def parse_day(s):
    parts = s.split("-")
    return datetime(int(parts[0]), int(parts[1]), int(parts[2]), tzinfo=WIB)


def _page(params, tries=4):
    """Satu halaman get_order_list + retry kalau respons kosong (error / rate limit)."""
    last = None
    for i in range(tries):
        r = sb.shopee_get("/api/v2/order/get_order_list", params)
        if isinstance(r.get("response"), dict):
            return r["response"]
        last = r
        time.sleep(1.5 * (i + 1))
    raise RuntimeError("get_order_list gagal %dx (respons kosong): %s" % (tries, str(last)[:200]))


def _details(batch, tries=4):
    """get_order_detail satu batch (maks 50 SN) + retry kalau respons kosong."""
    last = None
    for i in range(tries):
        r = sb.shopee_get("/api/v2/order/get_order_detail", {
            "order_sn_list": ",".join(batch),
            "response_optional_fields": "item_list,total_amount,buyer_user_id,recipient_address,package_list",
        })
        if isinstance(r.get("response"), dict):
            return r["response"].get("order_list") or []
        last = r
        time.sleep(1.5 * (i + 1))
    raise RuntimeError("get_order_detail gagal %dx: %s" % (tries, str(last)[:200]))


def pull_orders(day_start: datetime):
    """Tarik SEMUA order dgn create_time dalam [day_start, day_start+1) via pagination.
    Retry kalau respons kosong + verifikasi tiap order_sn punya detail (anti data bolong)."""
    f = int(day_start.timestamp())
    t = int((day_start + timedelta(days=1)).timestamp())
    all_sns = []
    cursor = ""
    done = False
    empty_streak = 0
    for _ in range(300):
        resp = _page({
            "time_range_field": "create_time",
            "time_from": f, "time_to": t,
            "page_size": 100, "cursor": cursor,
        })
        lst = resp.get("order_list") or []
        if not lst and resp.get("more"):
            empty_streak += 1
            if empty_streak >= 3:
                raise RuntimeError("halaman kosong berturut-turut padahal more=true — data tidak lengkap")
            time.sleep(1.0)
            continue
        empty_streak = 0
        all_sns.extend([o["order_sn"] for o in lst])
        if not resp.get("more", False):
            done = True
            break
        nxt = resp.get("next_cursor") or ""
        if not nxt or nxt == cursor:
            done = True
            break
        cursor = nxt
    if not done:
        raise RuntimeError("pagination tidak selesai (>300 halaman) — data kemungkinan tidak lengkap")
    # unik & urut
    all_sns = list(dict.fromkeys(all_sns))

    details = []
    for i in range(0, len(all_sns), 50):
        details.extend(_details(all_sns[i:i + 50]))
        time.sleep(0.2)

    got = {str(o.get("order_sn") or "") for o in details}
    missed = [s for s in all_sns if s not in got]
    if missed:
        print("WARN %s: %d dari %d order_sn tidak kembali detail-nya (contoh: %s) — data bisa kurang"
              % (day_start.strftime("%Y-%m-%d"), len(missed), len(all_sns), missed[:3]), flush=True)
    return details


def build_recs(details):
    """Detail order API → recs (order, status label export, sku aktual, jumlah, qty bundling)."""
    recs = []
    for o in details:
        status_raw = o.get("order_status") or ""
        status = API_TO_EXPORT_STATUS.get(status_raw, status_raw or "Lainnya")
        for it in (o.get("item_list") or []):
            order_sn = str(o.get("order_sn") or "").strip()
            if not order_sn:
                continue
            # SKU aktual: item_sku dulu; kosong (Milk) → model_sku (GenMilkVnl-01 dsb)
            sku = str(it.get("item_sku") or "").strip() or str(it.get("model_sku") or "").strip()
            try:
                jumlah = int(it.get("model_quantity_purchased") or 0)
            except Exception:
                jumlah = 0
            info = pe.SKU_INFO.get(sku)
            bundling = info["bundling"] if info else 1
            recs.append({
                "order": order_sn,
                "status": pe.norm_status(status),
                "sku": sku,
                "jumlah": jumlah,
                "qty": jumlah * bundling,
            })
    return recs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("tanggal", nargs="?", default=None, help="YYYY-MM-DD (default: kemarin WIB)")
    args = ap.parse_args()

    if args.tanggal:
        day = parse_day(args.tanggal)
        tanggal_label = args.tanggal
    else:
        now = datetime.now(WIB)
        day = now - timedelta(days=1)
        tanggal_label = day.strftime("%Y-%m-%d")

    print(f"Tarik order untuk tanggal: {tanggal_label} (WIB)")
    details = pull_orders(day)
    print(f"Order ditarik: {len(details)}")
    if not details:
        print("Tidak ada data — batal tulis JSON.")
        sys.exit(1)

    recs = build_recs(details)
    ts_now = int(time.time())
    summary = pe._summarize(recs, tanggal_label, ts_now)

    # by_produk (sama seperti parse_export.py)
    by_produk = {}
    for group_label in ["Generos Klasik", "Generos 1 Botol", "Generos Milk"]:
        sub = [x for x in recs if pe.SKU_INFO.get(x["sku"], {}).get("group") == group_label]
        if sub:
            by_produk[group_label] = pe._summarize(sub, tanggal_label, ts_now)
    if by_produk:
        summary["by_produk"] = by_produk

    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "export_summary.json")
    # backup dulu
    if os.path.exists(out_path):
        bak = out_path + ".bak_pull"
        try:
            os.replace(out_path, bak)
        except Exception:
            pass
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=1)

    print(json.dumps(summary, ensure_ascii=False, indent=1))
    print(f"\nSAVED -> {out_path}")


if __name__ == "__main__":
    main()
