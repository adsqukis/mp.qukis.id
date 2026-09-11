#!/usr/bin/env python3
"""Parser export Shopee 'Pesanan Saya' -> resume JSON untuk MP dashboard (mp.qukis.id).

Standar: INSTRUKSI PENGOLAHAN DATA PESANAN (Adithia/JMN).
- Group per Status Pesanan, lalu per SKU.
- Customer  = COUNT DISTINCT No. Pesanan (order unik), per (status, sku) dan per status.
- Qty       = SUM(Jumlah x Bundling SKU). Customer != Qty.
- SKU aktual = kolom 'Nomor Referensi SKU' bila 'SKU Induk' kosong (prioritas kode aktual).
- Status 'Pesanan diterima, namun ...' = label 'Pesanan Diterima' (card Selesai).
- Semua SKU master ditampilkan (0 kalau tidak ada transaksi).

Usage: python3 parse_export.py <file.xlsx> [--out export_summary.json]
"""
import argparse
import json
import os
import re
import sys
from collections import Counter, defaultdict

# ---- Master SKU (instruksi resmi) ----
MASTER = [
    # (sku, produk, bundling, group)
    ("QKS-GEN01", "Generos Klasik", 1, "Generos Klasik"),
    ("QKS-GEN02", "Generos Klasik", 2, "Generos Klasik"),
    ("QKS-GEN03", "Generos Klasik", 3, "Generos Klasik"),
    ("QKS-GEN1", "Generos 1 Botol", 1, "Generos 1 Botol"),
    ("GenMilkVnl-01", "Generos Milk Vanilla", 1, "Generos Milk"),
    ("GenMilkMadu-01", "Generos Milk Madu", 1, "Generos Milk"),
    ("GenMilkVnl-02", "Generos Milk Vanilla", 2, "Generos Milk"),
    ("GenMilkMadu-02", "Generos Milk Madu", 2, "Generos Milk"),
    ("GenMilkVnl-03", "Generos Milk Vanilla", 3, "Generos Milk"),
    ("GenMilkMadu-03", "Generos Milk Madu", 3, "Generos Milk"),
]
SKU_INFO = {sku: {"produk": produk, "bundling": bundling, "group": group}
            for sku, produk, bundling, group in MASTER}

# Urutan status tampilan (instruksi)
STATUS_ORDER = ["Sedang Dikirim", "Telah Dikirim", "Perlu Dikirim", "Pesanan Diterima", "Batal"]


def norm_status(raw):
    """Status export -> label kanonik."""
    if not raw:
        return "Lainnya"
    s = str(raw).strip()
    low = s.lower()
    if "diterima" in low:
        return "Pesanan Diterima"
    if "batal" in low or "cancel" in low:
        return "Batal"
    if "perlu dikirim" in low:
        return "Perlu Dikirim"
    if "sedang dikirim" in low:
        return "Sedang Dikirim"
    if "telah dikirim" in low:
        return "Telah Dikirim"
    return s


def _summarize(recs, tanggal, generated_ts):
    """Bangun struktur summary lengkap dari daftar recs (per produk bisa subset)."""
    statuses_present = list(dict.fromkeys(x["status"] for x in recs))
    statuses_out = [s for s in STATUS_ORDER if s in statuses_present]
    statuses_out += [s for s in statuses_present if s not in statuses_out]

    def order_set(rows_iter):
        return {x["order"] for x in rows_iter}

    summary = {
        "tanggal_data": tanggal or "",
        "total_order": len(recs),
        "generated_at": generated_ts,
        "statuses": [],
    }

    grand_customer = set()
    grand_qty = 0

    for st in statuses_out:
        st_rows = [x for x in recs if x["status"] == st]
        st_customers = order_set(st_rows)
        sku_map = {}
        for x in st_rows:
            info = SKU_INFO.get(x["sku"])
            if info is None:
                key = ("UNKNOWN", x["sku"], x["sku"], "")
            else:
                key = (x["sku"], info["produk"], info["group"], info["bundling"])
            e = sku_map.setdefault(key[0], {
                "sku": key[0], "produk": key[1], "group": key[2], "bundling": key[3],
                "orders": set(), "qty": 0, "jumlah": 0,
            })
            e["orders"].add(x["order"])
            e["jumlah"] += x["jumlah"]
            e["qty"] += x["jumlah"] * (key[3] or 1)

        rows_out = []
        known_order = {sku: i for i, (sku, _, _, _) in enumerate(MASTER)}
        for sku_key in sorted(sku_map, key=lambda s: (known_order.get(s, 999), s)):
            e = sku_map[sku_key]
            rows_out.append({
                "sku": e["sku"],
                "produk": e["produk"],
                "customer": len(e["orders"]),
                "qty": e["qty"],
                "jumlah": e["jumlah"],
            })

        st_qty = sum(e["qty"] for e in sku_map.values())
        summary["statuses"].append({
            "status": st,
            "customer": len(st_customers),
            "qty": st_qty,
            "jumlah": sum(e["jumlah"] for e in sku_map.values()),
            "orders": st_rows and len(st_rows),
            "sku_rows": rows_out,
        })
        grand_customer |= st_customers
        grand_qty += st_qty

    summary["total_customer"] = len(grand_customer)
    summary["total_qty"] = grand_qty

    # ---- Kompatibilitas card lama (5 card atas) ----
    # status_order/status_qty pakai label card; order count & qty mentah (Jumlah).
    card_labels = {
        "Perlu Dikirim": "Perlu dikirim",
        "Sedang Dikirim": "Sedang dikirim",
        "Telah Dikirim": "Telah dikirim",
        "Pesanan Diterima": "Selesai",
        "Batal": "Batal",
    }
    status_order = {}
    status_qty = {}
    for st in statuses_out:
        lbl = card_labels.get(st, st)
        st_rows = [x for x in recs if x["status"] == st]
        status_order[lbl] = len({x["order"] for x in st_rows})
        status_qty[lbl] = sum(x["jumlah"] for x in st_rows)
    nonbatal = {x["order"] for x in recs if x["status"] != "Batal"}
    summary["status_order"] = status_order
    summary["status_qty"] = status_qty
    summary["total_qty_nonbatal"] = sum(x["qty"] for x in recs if x["status"] != "Batal")
    summary["customer_nonbatal"] = len(nonbatal)
    return summary


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("xlsx")
    ap.add_argument("--out", default=None)
    ap.add_argument("--tanggal", default=None, help="tanggal data (D-1 export)")
    args = ap.parse_args()

    import openpyxl
    wb = openpyxl.load_workbook(args.xlsx)
    ws = wb[wb.sheetnames[0]]
    rows = ws.iter_rows(values_only=True)
    header = [str(c).strip() if c is not None else "" for c in next(rows)]

    def col(*names):
        for n in names:
            if n in header:
                return header.index(n)
        return None

    i_no = col("No. Pesanan")
    i_status = col("Status Pesanan")
    i_sku_induk = col("SKU Induk")
    i_ref = col("Nomor Referensi SKU")
    i_jumlah = col("Jumlah")
    if i_no is None or i_status is None or i_ref is None:
        print("ERROR: kolom wajib tidak ditemukan:", {n: col(n) for n in
              ["No. Pesanan", "Status Pesanan", "SKU Induk", "Nomor Referensi SKU", "Jumlah"]})
        sys.exit(2)

    # row-level normalized
    recs = []
    for r in rows:
        if r[i_no] is None:
            continue
        raw_status = r[i_status] if i_status is not None and r[i_status] is not None else ""
        # SKU aktual: prioritas ref (kode aktual), fallback induk
        ref = str(r[i_ref]).strip() if i_ref is not None and r[i_ref] is not None else ""
        induk = str(r[i_sku_induk]).strip() if i_sku_induk is not None and r[i_sku_induk] is not None else ""
        sku = ref or induk
        jumlah = 0
        if i_jumlah is not None and r[i_jumlah] is not None:
            try:
                jumlah = int(float(str(r[i_jumlah]).replace(",", ".")))
            except Exception:
                jumlah = 0
        info = SKU_INFO.get(sku)
        bundling = info["bundling"] if info else 1
        recs.append({
            "order": str(r[i_no]).strip(),
            "status": norm_status(raw_status),
            "sku": sku,
            "jumlah": jumlah,
            "qty": jumlah * bundling,
        })

    ts_now = int(__import__("time").time())
    summary = _summarize(recs, args.tanggal, ts_now)

    # ---- Filter per produk (dropdown produk di UI: Semua / Klasik / 1 Botol / Milk) ----
    # SKU aktual = ref atau induk. Produk group diambil dari SKU_INFO (nama produk).
    produk_groups = {
        "Generos Klasik": "Generos Klasik",
        "Generos 1 Botol": "Generos 1 Botol",
        "Generos Milk": "Generos Milk",
    }
    by_produk = {}
    for group_label in produk_groups.values():
        sub = [x for x in recs if SKU_INFO.get(x["sku"], {}).get("group") == group_label]
        if sub:
            by_produk[group_label] = _summarize(sub, args.tanggal, ts_now)
    if by_produk:
        summary["by_produk"] = by_produk

    out_path = args.out or os.path.join(os.path.dirname(os.path.abspath(__file__)), "export_summary.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=1)
    print(json.dumps(summary, ensure_ascii=False, indent=1))
    print(f"\nSAVED -> {out_path}")


if __name__ == "__main__":
    main()
