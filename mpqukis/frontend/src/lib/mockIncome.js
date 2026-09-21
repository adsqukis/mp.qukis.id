// DATA DUMMY — bentuk persis samain sama backend/app.py::build_income_summary()
// (daily[].{date,d,total,count}, total_payout, payout_count) supaya tinggal ganti
// sumbernya nanti tanpa ubah UI. Generator deterministik, bukan Math.random.

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260921);
const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function buildMockIncome(days = 30) {
  const daily = [];
  const today = new Date();
  let total_payout = 0;
  let payout_count = 0;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dow = d.getDay();
    const weekendBoost = dow === 0 || dow === 6 ? 1.22 : 1;
    const total = Math.round((14_000_000 + rand() * 9_000_000) * weekendBoost);
    const count = 6 + Math.floor(rand() * 10);
    daily.push({
      date: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
      d: DAY_LABELS[dow],
      total,
      count,
    });
    total_payout += total;
    payout_count += count;
  }

  return { days, total_payout, payout_count, daily, source: "payment.get_escrow_list" };
}

export const mockIncome = buildMockIncome(30);
