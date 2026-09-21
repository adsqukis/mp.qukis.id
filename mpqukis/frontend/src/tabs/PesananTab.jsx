import React, { useMemo, useState } from "react";
import { Package, Users2 } from "lucide-react";
import { Card, StatCard, Badge } from "../components/ui";
import RangeCalendar from "../components/RangeCalendar";
import { summarize } from "../lib/summarize";
import { mockOrders } from "../lib/mockOrders";
import { STATUS_COLOR, SKU_INFO } from "../lib/skuMaster";
import { fmtInt, fmtRp } from "../lib/format";
import { RANGE_FILTERS, RANGE_PRESETS, fmtDmy, filterByDateRange } from "../lib/dateRange";
import { PRODUK_OPTIONS, produkMatch } from "../lib/productFilter";
import { downloadCsv } from "../lib/csv";

const fmtDateShort = (ts) => new Date(ts).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });

// Grouping buat kartu aditif & "Distribusi status": Perlu Dikirim / (Sedang+Telah Dikirim) / Pesanan
// Diterima / Batal. Port dari grouping "cards" di ShopeePartnerDashboard.jsx.
function cardGroups(recs) {
  const custOf = (pred) => new Set(recs.filter(pred).map((r) => r.order)).size;
  return [
    { key: "Perlu Dikirim", label: "Perlu Dikirim", value: custOf((r) => r.status === "Perlu Dikirim"), accent: STATUS_COLOR["Perlu Dikirim"] },
    { key: "Sedang Dikirim", label: "Sedang Dikirim", value: custOf((r) => r.status === "Sedang Dikirim" || r.status === "Telah Dikirim"), accent: STATUS_COLOR["Sedang Dikirim"] },
    { key: "Selesai", label: "Selesai", value: custOf((r) => r.status === "Pesanan Diterima"), accent: STATUS_COLOR["Pesanan Diterima"] },
    { key: "Batal", label: "Batal", value: custOf((r) => r.status === "Batal"), accent: STATUS_COLOR["Batal"] },
  ];
}

// Grouping LAIN buat "Resume Pesanan" (qty MENTAH, belum dikali bundling) — port apa adanya dari
// ShopeePartnerDashboard.jsx baris ~915: di sana "Sedang Dikirim" berdiri sendiri dan "Selesai" =
// gabungan Telah Dikirim + Pesanan Diterima. Ini beda dari grouping cardGroups() di atas (yang
// menggabung Sedang+Telah). Dua pengelompokan berbeda ini SAMA-SAMA ada di versi live — bukan
// salah ketik gua, itu memang begitu adanya di sana, direplikasi sesuai instruksi "ikuti fitur ini".
function resumeRows(recs) {
  const cust = (pred) => new Set(recs.filter(pred).map((r) => r.order)).size;
  const qtyMentah = (pred) => recs.filter(pred).reduce((s, r) => s + r.jumlah, 0);
  return [
    { label: "Perlu Dikirim", cust: cust((r) => r.status === "Perlu Dikirim"), qty: qtyMentah((r) => r.status === "Perlu Dikirim") },
    { label: "Sedang Dikirim", cust: cust((r) => r.status === "Sedang Dikirim"), qty: qtyMentah((r) => r.status === "Sedang Dikirim") },
    { label: "Selesai", cust: cust((r) => r.status === "Telah Dikirim" || r.status === "Pesanan Diterima"), qty: qtyMentah((r) => r.status === "Telah Dikirim" || r.status === "Pesanan Diterima") },
    { label: "Batal", cust: cust((r) => r.status === "Batal"), qty: qtyMentah((r) => r.status === "Batal") },
  ];
}

function orderRows(recs) {
  const byOrder = new Map();
  for (const r of recs) if (!byOrder.has(r.order)) byOrder.set(r.order, r);
  return [...byOrder.values()].sort((a, b) => b.ts - a.ts);
}

export default function PesananTab() {
  const [rangeKey, setRangeKey] = useState("7d");
  const [customRange, setCustomRange] = useState(null);
  const [produk, setProduk] = useState("");
  const [activeCards, setActiveCards] = useState([]);
  const [calOpen, setCalOpen] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);

  const { from, to } = customRange || RANGE_PRESETS[rangeKey]();
  const isCustom = !!customRange;
  const rangeLabel = isCustom ? `${fmtDmy(from)} – ${fmtDmy(to)}` : (RANGE_FILTERS.find((f) => f.key === rangeKey) || {}).label || "7 hari terakhir";
  const produkOpt = PRODUK_OPTIONS.find((p) => p.key === produk) || PRODUK_OPTIONS[0];

  const clickPreset = (key) => {
    setCalOpen(false);
    setCustomRange(null);
    setRangeKey(key);
  };

  const scoped = useMemo(() => {
    const byDate = filterByDateRange(mockOrders, from, to);
    return produk ? byDate.filter((r) => produkMatch(r.sku, produk)) : byDate;
  }, [from, to, produk]);

  const summary = useMemo(() => summarize(scoped), [scoped]);
  const cards = useMemo(() => cardGroups(scoped), [scoped]);
  const resume = useMemo(() => resumeRows(scoped), [scoped]);
  const rows = useMemo(() => orderRows(scoped), [scoped]);

  const custNonBatal = useMemo(() => new Set(scoped.filter((r) => r.status !== "Batal").map((r) => r.order)).size, [scoped]);
  const qtyNonBatal = summary.statuses.filter((s) => s.status !== "Batal").reduce((a, s) => a + s.qty, 0);

  const toggleCard = (key) => setActiveCards((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  const totalSelected = cards.filter((c) => activeCards.includes(c.key)).reduce((s, c) => s + c.value, 0);
  const anyActive = activeCards.length > 0;

  const csvDownload = () => {
    if (csvBusy) return;
    setCsvBusy(true);
    try {
      const out = [
        ["No. pesanan", "Tanggal", "Pembeli", "Produk", "SKU", "Qty", "Total", "Status"],
        ...rows.slice(0, 500).map((o) => [o.order, fmtDateShort(o.ts), o.buyer, (SKU_INFO[o.sku] || {}).produk || "", o.sku, o.jumlah, o.total, o.status]),
      ];
      downloadCsv(`pesanan_${produk || "semua"}_${from}_${to}.csv`, out);
    } finally {
      setCsvBusy(false);
    }
  };

  const filterRow = (
    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
      {RANGE_FILTERS.map((f) => (
        <button
          key={f.key}
          onClick={() => clickPreset(f.key)}
          style={{
            padding: "7px 16px", borderRadius: 9, border: !isCustom && rangeKey === f.key ? "1px solid #4a3aa7" : "1px solid #ECECE7",
            background: !isCustom && rangeKey === f.key ? "#4a3aa7" : "#fff", color: !isCustom && rangeKey === f.key ? "#fff" : "#52514e",
            fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif",
          }}
        >
          {f.label}
        </button>
      ))}
      <span style={{ fontSize: 12, color: "#898781", margin: "0 2px 0 8px", fontFamily: "Inter, sans-serif" }}>Custom:</span>
      <div style={{ position: "relative", display: "inline-block" }}>
        <button
          onClick={() => setCalOpen((v) => !v)}
          style={{
            padding: "7px 14px", borderRadius: 9, border: isCustom ? "1px solid #2a78d6" : "1px solid #ECECE7",
            background: isCustom ? "#2a78d6" : "#fff", color: isCustom ? "#fff" : "#2a78d6",
            fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {fmtDmy(from)} – {fmtDmy(to)}
        </button>
        {calOpen && (
          <RangeCalendar
            from={from}
            to={to}
            maxDate={RANGE_PRESETS.today().from}
            onApply={(f, t) => setCustomRange({ from: f, to: t })}
            onClose={() => setCalOpen(false)}
          />
        )}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {filterRow}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={produk}
          onChange={(e) => setProduk(e.target.value)}
          style={{ padding: "7px 12px", borderRadius: 9, border: "1px solid #ECECE7", background: "#fff", fontSize: 12.5, fontWeight: 600, color: "#52514e", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
        >
          {PRODUK_OPTIONS.map((p) => (
            <option key={p.key || "all"} value={p.key}>{p.label}</option>
          ))}
        </select>
        <button
          onClick={csvDownload}
          disabled={csvBusy}
          style={{ padding: "7px 16px", borderRadius: 9, border: "1px solid #0ca30c", background: "#0ca30c", color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: csvBusy ? "default" : "pointer", opacity: csvBusy ? 0.6 : 1, fontFamily: "Inter, sans-serif" }}
        >
          {csvBusy ? "Menyiapkan CSV…" : "⬇ Download CSV"}
        </button>
        <span style={{ fontSize: 12, color: "#898781", fontFamily: "Inter, sans-serif" }}>{produkOpt.label} · {rangeLabel}</span>
      </div>

      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 10 }}>
          {cards.map((c) => (
            <StatCard key={c.key} icon={Package} label={c.label} value={fmtInt(c.value)} accent={c.accent} toggle active={activeCards.includes(c.key)} onClick={() => toggleCard(c.key)} />
          ))}
          <StatCard icon={Users2} label="Customer" value={fmtInt(custNonBatal)} accent="#b8860b" sub="Non-batal" />
          <StatCard icon={Package} label="Total" value={fmtInt(totalSelected)} accent="#0b0b0b" />
        </div>
        <div style={{ fontSize: 11.5, color: "#898781", fontFamily: "Inter, sans-serif" }}>
          Total mulai dari 0 — klik card status buat menambahkan nilainya ke Total.
          {anyActive && (
            <span onClick={() => setActiveCards([])} style={{ marginLeft: 8, color: "#4a3aa7", cursor: "pointer", fontWeight: 600, textDecoration: "underline" }}>
              Reset (0)
            </span>
          )}
        </div>
      </div>

      <Card title="Resume Pesanan" subtitle={`${produkOpt.label} · ${rangeLabel} · qty mentah (belum dikali bundling)`}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "Inter, sans-serif" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#898781", fontSize: 11.5, borderBottom: "1px solid #ECECE7" }}>
              <th style={{ padding: "8px 0", fontWeight: 500 }}>Status</th>
              <th style={{ padding: "8px 0", fontWeight: 500, textAlign: "right" }}>Customer</th>
              <th style={{ padding: "8px 0", fontWeight: 500, textAlign: "right" }}>Qty</th>
            </tr>
          </thead>
          <tbody>
            {resume.map((r) => (
              <tr key={r.label} style={{ borderBottom: "1px solid #F1F1F0" }}>
                <td style={{ padding: "9px 0", color: "#0b0b0b" }}>{r.label}</td>
                <td style={{ padding: "9px 0", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{fmtInt(r.cust)}</td>
                <td style={{ padding: "9px 0", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{fmtInt(r.qty)}</td>
              </tr>
            ))}
            <tr style={{ background: "#F5F5F2" }}>
              <td style={{ padding: "10px 0", fontWeight: 700 }}>TOTAL</td>
              <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{fmtInt(resume.reduce((a, r) => a + r.cust, 0))}</td>
              <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{fmtInt(resume.reduce((a, r) => a + r.qty, 0))}</td>
            </tr>
          </tbody>
        </table>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
        <Card title={`Pesanan masuk — ${rangeLabel}`} subtitle="Rentang tanggal terpilih">
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <div><span style={{ fontSize: 11.5, color: "#898781", display: "block" }}>Total order</span><span style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{fmtInt(summary.totalCustomer)}</span></div>
            <div><span style={{ fontSize: 11.5, color: "#898781", display: "block" }}>Total qty (produk)</span><span style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{fmtInt(summary.totalQty)}</span></div>
            <div><span style={{ fontSize: 11.5, color: "#898781", display: "block" }}>Qty non-batal</span><span style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#0ca30c" }}>{fmtInt(qtyNonBatal)}</span></div>
          </div>
        </Card>

        <Card title="Distribusi status" subtitle={`Total ${fmtInt(summary.totalCustomer)} pesanan`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 2 }}>
            {cards.map((c) => (
              <div key={c.key}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                  <span style={{ color: "#52514e" }}>{c.label}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{fmtInt(c.value)}</span>
                </div>
                <div style={{ background: "#F1F1EE", borderRadius: 4, height: 6, overflow: "hidden" }}>
                  <div style={{ width: `${summary.totalCustomer > 0 ? (c.value / summary.totalCustomer) * 100 : 0}%`, height: "100%", background: c.accent, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {summary.statuses.length > 0 && (
        <Card title="Rincian per Status & SKU" subtitle={`Customer = order unik · Qty = jumlah × bundling SKU · ${rangeLabel}`}>
          {summary.statuses.map((st) => (
            <div key={st.status} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "#0b0b0b", fontFamily: "'Space Grotesk', sans-serif" }}>{st.status}</span>
                <span style={{ fontSize: 11.5, color: "#898781" }}>
                  Customer <b style={{ fontFamily: "'JetBrains Mono', monospace", color: "#0b0b0b" }}>{fmtInt(st.customer)}</b>
                  {" · "}Qty <b style={{ fontFamily: "'JetBrains Mono', monospace", color: "#0b0b0b" }}>{fmtInt(st.qty)}</b>
                </span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, fontFamily: "Inter, sans-serif" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#898781", fontSize: 11 }}>
                    <th style={{ padding: "5px 0", fontWeight: 500, width: 130 }}>SKU</th>
                    <th style={{ padding: "5px 0", fontWeight: 500 }}>Produk</th>
                    <th style={{ padding: "5px 0", fontWeight: 500, textAlign: "right", width: 90 }}>Customer</th>
                    <th style={{ padding: "5px 0", fontWeight: 500, textAlign: "right", width: 90 }}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {st.skuRows.map((r) => (
                    <tr key={r.sku} style={{ borderTop: "1px solid #F1F1F0" }}>
                      <td style={{ padding: "7px 0", fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: "#52514e" }}>{r.sku}</td>
                      <td style={{ padding: "7px 0", color: "#3A3A40" }}>{r.produk}</td>
                      <td style={{ padding: "7px 0", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{fmtInt(r.customer)}</td>
                      <td style={{ padding: "7px 0", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{fmtInt(r.qty)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: "2px solid #ECECE7", background: "#F5F5F2" }}>
                    <td colSpan={2} style={{ padding: "7px 0", fontWeight: 700, color: "#0b0b0b" }}>TOTAL {st.status.toUpperCase()}</td>
                    <td style={{ padding: "7px 0", textAlign: "right", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{fmtInt(st.customer)}</td>
                    <td style={{ padding: "7px 0", textAlign: "right", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{fmtInt(st.qty)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </Card>
      )}

      <Card title="Pesanan terbaru" subtitle={`${fmtInt(rows.length)} transaksi · ${produkOpt.label} · ${rangeLabel}`}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "Inter, sans-serif" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#898781", fontSize: 11.5 }}>
              <th style={{ paddingBottom: 8, fontWeight: 500 }}>No. pesanan</th>
              <th style={{ paddingBottom: 8, fontWeight: 500 }}>Tanggal</th>
              <th style={{ paddingBottom: 8, fontWeight: 500 }}>Pembeli</th>
              <th style={{ paddingBottom: 8, fontWeight: 500 }}>Produk</th>
              <th style={{ paddingBottom: 8, fontWeight: 500 }}>SKU</th>
              <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: "right" }}>Qty</th>
              <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: "right" }}>Total</th>
              <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: "right" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 15).map((o) => (
              <tr key={o.order} style={{ borderTop: "1px solid #F1F1F0" }}>
                <td style={{ padding: "9px 0", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#52514e" }}>{o.order}</td>
                <td style={{ padding: "9px 0", fontSize: 12, color: "#52514e" }}>{fmtDateShort(o.ts)}</td>
                <td style={{ padding: "9px 0", color: "#0b0b0b" }}>{o.buyer}</td>
                <td style={{ padding: "9px 0", color: "#52514e", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(SKU_INFO[o.sku] || {}).produk || "-"}</td>
                <td style={{ padding: "9px 0", fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: "#52514e" }}>{o.sku}</td>
                <td style={{ padding: "9px 0", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{o.jumlah}</td>
                <td style={{ padding: "9px 0", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{fmtRp(o.total)}</td>
                <td style={{ padding: "9px 0", textAlign: "right" }}>
                  <Badge text={o.status} color={STATUS_COLOR[o.status]} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} style={{ padding: "14px 0", color: "#898781", textAlign: "center" }}>Belum ada pesanan{produk ? ` untuk ${produkOpt.label}` : ""} di rentang ini.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <div style={{ fontSize: 11.5, color: "#898781", fontStyle: "italic", fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}>
        * Data dummy untuk preview visual — belum tersambung ke Shopee live. Tabel "Pesanan terbaru" di
        sini ditampilin fungsional (di versi live section ini selalu kosong karena belum ke-wire ke data
        detail — CSV-nya sendiri sebenarnya sudah bisa, tabelnya yang belum).
      </div>
    </div>
  );
}
