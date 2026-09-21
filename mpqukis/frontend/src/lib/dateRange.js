// Port 1:1 dari frontend/src/ShopeePartnerDashboard.jsx (RANGE_PRESETS, RANGE_FILTERS, fmtDmy).

export const isoDaysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

export const RANGE_PRESETS = {
  today: () => ({ from: isoDaysAgo(0), to: isoDaysAgo(0) }),
  yesterday: () => ({ from: isoDaysAgo(1), to: isoDaysAgo(1) }),
  "7d": () => ({ from: isoDaysAgo(6), to: isoDaysAgo(0) }),
  month: () => ({ from: isoDaysAgo(29), to: isoDaysAgo(0) }),
  year: () => ({ from: isoDaysAgo(364), to: isoDaysAgo(0) }),
};

export const RANGE_FILTERS = [
  { key: "today", label: "Hari ini" },
  { key: "yesterday", label: "Kemarin" },
  { key: "7d", label: "7 hari terakhir" },
  { key: "month", label: "Bulan" },
  { key: "year", label: "Tahun" },
];

export const fmtDmy = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

// recs[i].ts = epoch ms. from/to = 'YYYY-MM-DD' (inklusif, batas hari lokal).
export function filterByDateRange(recs, from, to) {
  if (!from || !to) return recs;
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T23:59:59.999`).getTime();
  return recs.filter((r) => r.ts >= start && r.ts <= end);
}
