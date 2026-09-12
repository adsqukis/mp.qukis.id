#!/usr/bin/env python3
"""Tarik SEMUA order dalam rentang tanggal (default 2026-07-01 s.d. 2026-09-02) per hari.

Output:
  - export_summary_range_<from>_<to>.json   = summary agregat seluruh range
  - daily_pull_<from>_<to>.json             = ringkasan per hari (total_order, status_order, qty)
  - orders_raw_<from>_<to>.json             = RAW recs per tanggal (untuk agregasi range custom akurat)
"""
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util
spec = importlib.util.spec_from_file_location("sb", os.path.join(os.path.dirname(os.path.abspath(__file__)), "app.py"))
sb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sb)

spec2 = importlib.util.spec_from_file_location("pe", os.path.join(os.path.dirname(os.path.abspath(__file__)), "parse_export.py"))
pe = importlib.util.module_from_spec(spec2)
spec2.loader.exec_module(pe)

spec3 = importlib.util.spec_from_file_location("px", os.path.join(os.path.dirname(os.path.abspath(__file__)), "pull_export.py"))
px = importlib.util.module_from_spec(spec3)
spec3.loader.exec_module(px)

WIB = timezone(timedelta(hours=7))


def pull_day(day_start):
    f = int(day_start.timestamp())
    t = int((day_start + timedelta(days=1)).timestamp())
    all_sns = []
    cursor = ""
    while True:
        r = sb.shopee_get("/api/v2/order/get_order_list", {
            "time_range_field": "create_time", "time_from": f, "time_to": t,
            "page_size": 100, "cursor": cursor,
        })
        resp = r.get("response", {})
        lst = resp.get("order_list", [])
        for o in lst:
            all_sns.append(o["order_sn"])
        if not resp.get("more", False) or not lst:
            break
        cursor = resp.get("next_cursor", "")
    all_sns = list(dict.fromkeys(all_sns))
    details = []
    for i in range(0, len(all_sns), 50):
        batch = all_sns[i:i + 50]
        r = sb.shopee_get("/api/v2/order/get_order_detail", {
            "order_sn_list": ",".join(batch),
            "response_optional_fields": "item_list,total_amount,buyer_user_id,recipient_address,package_list",
        })
        details.extend(r.get("response", {}).get("order_list", []))
        time.sleep(0.2)
    return details


def build_recs(details):
    recs = []
    for o in details:
        status_raw = o.get("order_status") or ""
        status = px.API_TO_EXPORT_STATUS.get(status_raw, status_raw or "Lainnya")
        for it in (o.get("item_list") or []):
            order_sn = str(o.get("order_sn") or "").strip()
            if not order_sn:
                continue
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
    argv = sys.argv[1:]
    if len(argv) >= 2:
        from_d = datetime.strptime(argv[0], "%Y-%m-%d").replace(tzinfo=WIB)
        to_d = datetime.strptime(argv[1], "%Y-%m-%d").replace(tzinfo=WIB)
    else:
        from_d = datetime(2026, 7, 1, tzinfo=WIB)
        to_d = datetime(2026, 9, 2, tzinfo=WIB)  # inclusive
    # data dir yang sama dengan app.py (MP_DATA_DIR), bukan folder source
    base = sb.DATA_DIR
    all_recs = []
    daily = []
    day = from_d
    total_days = (to_d - from_d).days + 1
    idx = 0
    while day <= to_d:
        idx += 1
        label = day.strftime("%Y-%m-%d")
        print(f"[{idx}/{total_days}] {label} ...", flush=True)
        try:
            details = pull_day(day)
            recs = build_recs(details)
            for r in recs:
                r["tanggal"] = label
            if recs:
                sub = pe._summarize(recs, label, int(time.time()))
                daily.append({
                    "tanggal": label,
                    "total_order": sub["total_order"],
                    "total_qty": sub["total_qty"],
                    "customer_nonbatal": sub["customer_nonbatal"],
                    "status_order": sub["status_order"],
                })
                all_recs.extend(recs)
            else:
                daily.append({"tanggal": label, "total_order": 0, "note": "no data"})
        except Exception as e:
            print(f"  ERROR {label}: {e}", flush=True)
            daily.append({"tanggal": label, "total_order": -1, "error": str(e)})
        day += timedelta(days=1)
        time.sleep(0.3)

    ts = int(time.time())
    summary = pe._summarize(all_recs, f"{from_d.strftime('%Y-%m-%d')}_s.d._{to_d.strftime('%Y-%m-%d')}", ts)
    by_produk = {}
    for group_label in ["Generos Klasik", "Generos 1 Botol", "Generos Milk"]:
        sub = [x for x in all_recs if pe.SKU_INFO.get(x["sku"], {}).get("group") == group_label]
        if sub:
            by_produk[group_label] = pe._summarize(sub, summary["tanggal_data"], ts)
    if by_produk:
        summary["by_produk"] = by_produk

    tag = f"{from_d.strftime('%Y%m%d')}_{to_d.strftime('%Y%m%d')}"
    out_sum = os.path.join(base, f"export_summary_range_{tag}.json")
    out_daily = os.path.join(base, f"daily_pull_{tag}.json")
    out_raw = os.path.join(base, f"orders_raw_{tag}.json")
    with open(out_sum, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=1)
    with open(out_daily, "w", encoding="utf-8") as f:
        json.dump(daily, f, ensure_ascii=False, indent=1)
    with open(out_raw, "w", encoding="utf-8") as f:
        json.dump(all_recs, f, ensure_ascii=False)
    print(json.dumps(summary, ensure_ascii=False, indent=1))
    print(f"\nSAVED -> {out_sum}")
    print(f"DAILY -> {out_daily}")
    print(f"RAW   -> {out_raw}")


if __name__ == "__main__":
    main()
