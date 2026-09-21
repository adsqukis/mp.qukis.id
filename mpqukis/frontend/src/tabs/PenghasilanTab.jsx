import React, { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Wallet, Receipt, TrendingUp, CalendarDays } from "lucide-react";
import { Card, StatCard, Notice } from "../components/ui";
import { mockIncome } from "../lib/mockIncome";
import { fmtRp, fmtRpShort, fmtInt } from "../lib/format";

// Tick sumbu-Y: tanpa prefix "Rp" (judul chart + tooltip udah jelasin konteksnya) —
// dengan prefix, teksnya kepanjangan dan ke-wrap 2 baris di axis yang sempit.
const fmtAxis = (n) => fmtRpShort(n).replace(/^Rp\s?/, "");

function IncomeTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #ECECE7", borderRadius: 8, padding: "8px 12px", boxShadow: "0 4px 14px rgba(11,11,11,0.1)" }}>
      <div style={{ fontSize: 11, color: "#898781", fontFamily: "Inter, sans-serif", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#0b0b0b", fontFamily: "'JetBrains Mono', monospace" }}>{fmtRp(payload[0].value)}</div>
    </div>
  );
}

export default function PenghasilanTab() {
  const { daily, total_payout, payout_count, days } = mockIncome;
  const chartData = useMemo(() => daily.map((x) => ({ date: x.date, v: x.total })), [daily]);
  const avgPerDay = days > 0 ? Math.round(total_payout / days) : 0;

  const last7 = daily.slice(-7).reduce((a, b) => a + b.total, 0);
  const prev7 = daily.slice(-14, -7).reduce((a, b) => a + b.total, 0);
  const pct = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : null;
  const up = pct !== null && pct >= 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        <StatCard icon={Wallet} label="Total payout" value={fmtRpShort(total_payout)} accent="#0ca30c" sub={`${days} hari terakhir`} />
        <StatCard icon={Receipt} label="Transaksi payout" value={fmtInt(payout_count)} accent="#2a78d6" sub="Escrow release" />
        <StatCard icon={TrendingUp} label="Rata-rata per hari" value={fmtRpShort(avgPerDay)} accent="#4a3aa7" sub="Payout ÷ hari" />
        <StatCard icon={CalendarDays} label="Cakupan tren" value={`${days} hari`} accent="#1baf7a" sub="Rentang data" />
      </div>

      <Card
        title="Payout Masuk"
        subtitle={`${days} hari terakhir · sumber: payment.get_escrow_list (uang bersih diterima)`}
        right={
          pct !== null && (
            <span style={{ fontSize: 12.5, fontWeight: 600, color: up ? "#0ca30c" : "#d03b3b", fontFamily: "Inter, sans-serif", whiteSpace: "nowrap" }}>
              {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}% vs 7 hari sebelumnya
            </span>
          )
        }
      >
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2a78d6" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#2a78d6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#e1e0d9" />
            <XAxis dataKey="date" tick={{ fontSize: 10.5, fill: "#898781" }} axisLine={false} tickLine={false} interval={Math.ceil(chartData.length / 8)} />
            <YAxis tick={{ fontSize: 10.5, fill: "#898781" }} axisLine={false} tickLine={false} width={40} tickFormatter={fmtAxis} />
            <Tooltip content={<IncomeTooltip />} cursor={{ stroke: "#c3c2b7", strokeWidth: 1 }} />
            <Area type="monotone" dataKey="v" stroke="#2a78d6" strokeWidth={2} fill="url(#incomeFill)" dot={false} activeDot={{ r: 4, fill: "#2a78d6", stroke: "#fff", strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card title="Saldo Shopee & pencairan">
          <Notice>
            Saldo Shopee, jadwal pencairan, dan tarik saldo tidak tersedia lewat Shopee Open Platform API — hanya
            bisa diakses & ditarik manual di Seller Centre (Seller Centre → Keuangan). Yang ditampilkan di sini
            cuma payout yang sudah masuk (escrow release), bukan saldo mengambang.
          </Notice>
        </Card>
        <Card title="Rincian komponen penghasilan">
          <Notice>
            Rincian komponen (pendapatan produk, ongkir, subsidi, biaya admin, biaya layanan, promo) tidak tersedia
            lewat API partner. Detail itu cuma bisa dilihat di Seller Centre → Laporan Keuangan.
          </Notice>
        </Card>
      </div>

      <div style={{ fontSize: 11.5, color: "#898781", fontStyle: "italic", fontFamily: "Inter, sans-serif" }}>
        * Data dummy untuk preview visual — belum tersambung ke Shopee live. Card "data tidak tersedia" di atas bukan
        bug — itu keterbatasan asli Shopee Open Platform API, sengaja ditampilin jujur, bukan dikarang jadi angka.
      </div>
    </div>
  );
}
