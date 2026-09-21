export const fmtRp = (n) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");

export const fmtRpShort = (n) => {
  const v = n || 0;
  if (Math.abs(v) >= 1_000_000) return "Rp " + (v / 1_000_000).toFixed(1) + "jt";
  if (Math.abs(v) >= 1_000) return "Rp " + (v / 1_000).toFixed(0) + "rb";
  return fmtRp(v);
};

export const fmtInt = (n) => (n ?? 0).toLocaleString("id-ID");
