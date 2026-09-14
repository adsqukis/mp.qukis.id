import React, { useMemo, useState } from "react";
import { Users2, Boxes, ListOrdered } from "lucide-react";
import { Card, StatCard, Pill } from "../components/ui";
import { summarize } from "../lib/summarize";
import { mockOrders } from "../lib/mockOrders";
import { STATUS_COLOR, PRODUCT_GROUPS } from "../lib/skuMaster";

const fmtInt = (n) => (n ?? 0).toLocaleString("id-ID");

export default function PesananTab() {
  const summary = useMemo(() => summarize(mockOrders), []);
  const [selected, setSelected] = useState("Semua");

  const view = selected === "Semua" ? summary.all : summary.statuses.find((s) => s.status === selected);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        <StatCard icon={Users2} label="Total Customer" value={fmtInt(summary.totalCustomer)} accent="#4a3aa7" sub="Distinct nomor pesanan" />
        <StatCard icon={Boxes} label="Total Qty" value={fmtInt(summary.totalQty)} accent="#2a78d6" sub="Unit produk × bundling SKU" />
        <StatCard icon={ListOrdered} label="Baris Pesanan" value={fmtInt(summary.totalOrderLines)} accent="#1baf7a" sub="Baris SKU mentah, bukan customer" />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Pill active={selected === "Semua"} color="#0b0b0b" label="Semua Status" count={fmtInt(summary.totalCustomer)} onClick={() => setSelected("Semua")} />
        {summary.statuses.map((s) => (
          <Pill
            key={s.status}
            active={selected === s.status}
            color={STATUS_COLOR[s.status] || "#898781"}
            label={s.status}
            count={fmtInt(s.customer)}
            onClick={() => setSelected(s.status)}
          />
        ))}
      </div>

      <Card title="Resume Pesanan per SKU" subtitle={selected === "Semua" ? "Seluruh status" : selected}>
        {PRODUCT_GROUPS.map((group) => {
          const rows = view.skuRows.filter((r) => r.group === group);
          if (rows.length === 0) return null;
          const sub = view.groupSubtotals[group] || { customer: 0, qty: 0 };
          return (
            <div key={group} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#52514e", textTransform: "uppercase", letterSpacing: ".3px", marginBottom: 6, fontFamily: "Inter, sans-serif" }}>
                {group}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "Inter, sans-serif" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#898781", fontSize: 11.5, borderBottom: "1px solid #e1e0d9" }}>
                    <th style={{ padding: "7px 0", fontWeight: 500 }}>SKU</th>
                    <th style={{ padding: "7px 0", fontWeight: 500 }}>Produk</th>
                    <th style={{ padding: "7px 0", fontWeight: 500, textAlign: "right" }}>Customer</th>
                    <th style={{ padding: "7px 0", fontWeight: 500, textAlign: "right" }}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.sku} style={{ borderBottom: "1px solid #F1F1F0" }}>
                      <td style={{ padding: "8px 0", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#52514e" }}>{r.sku}</td>
                      <td style={{ padding: "8px 0", color: "#0b0b0b" }}>{r.produk}</td>
                      <td style={{ padding: "8px 0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtInt(r.customer)}</td>
                      <td style={{ padding: "8px 0", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{fmtInt(r.qty)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={2} style={{ padding: "8px 0", fontWeight: 700, fontSize: 12.5, color: "#0b0b0b" }}>Subtotal {group}</td>
                    <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtInt(sub.customer)}</td>
                    <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtInt(sub.qty)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: "2px solid #0b0b0b", fontWeight: 700, fontSize: 13.5, fontFamily: "Inter, sans-serif" }}>
          <span>TOTAL {selected === "Semua" ? "SEMUA STATUS" : selected.toUpperCase()}</span>
          <span style={{ display: "flex", gap: 28 }}>
            <span>Customer: {fmtInt(view.customer)}</span>
            <span>Qty: {fmtInt(view.qty)}</span>
          </span>
        </div>
      </Card>

      <div style={{ fontSize: 11.5, color: "#898781", fontStyle: "italic", fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}>
        * Data dummy untuk preview visual — belum tersambung ke Shopee live. Satu definisi Qty dipakai
        konsisten di semua tabel (jumlah × bundling SKU); subtotal Customer per grup & per status
        dihitung distinct-order, bukan dijumlah dari baris SKU — sesuai aturan Cron Pesanan yang lu kasih.
      </div>
    </div>
  );
}
