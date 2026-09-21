// DATA DUMMY — bukan data toko real. Generator deterministik (bukan Math.random),
// mencakup 370 hari ke belakang biar semua preset filter (termasuk "Tahun") punya
// data buat ditampilin. Harga per SKU (PRICE_MAP) juga angka contoh, bukan harga
// katalog asli — cuma buat isi kolom "Total" di tabel/CSV.

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(918273645);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const STATUS_WEIGHTS = [
  "Perlu Dikirim", "Perlu Dikirim",
  "Sedang Dikirim", "Sedang Dikirim", "Sedang Dikirim",
  "Telah Dikirim", "Telah Dikirim", "Telah Dikirim", "Telah Dikirim",
  "Pesanan Diterima", "Pesanan Diterima", "Pesanan Diterima", "Pesanan Diterima", "Pesanan Diterima", "Pesanan Diterima",
  "Batal",
];

const SKU_WEIGHTS = [
  "QKS-GEN01", "QKS-GEN01", "QKS-GEN01",
  "QKS-GEN02", "QKS-GEN02", "QKS-GEN02",
  "QKS-GEN03",
  "QKS-GEN1", "QKS-GEN1",
  "GenMilkVnl-01", "GenMilkMadu-01",
  "GenMilkVnl-02", "GenMilkMadu-02",
  "GenMilkVnl-03", "GenMilkMadu-03",
];

export const PRICE_MAP = {
  "QKS-GEN01": 85000,
  "QKS-GEN02": 155000,
  "QKS-GEN03": 215000,
  "QKS-GEN1": 150000,
  "GenMilkVnl-01": 45000,
  "GenMilkMadu-01": 45000,
  "GenMilkVnl-02": 85000,
  "GenMilkMadu-02": 85000,
  "GenMilkVnl-03": 120000,
  "GenMilkMadu-03": 120000,
};

const FIRST_NAMES = ["Rina", "Dimas", "Nadia", "Budi", "Alya", "Fajar", "Sinta", "Yoga", "Putri", "Andi", "Maya", "Rian", "Dewi", "Bayu", "Citra", "Eko", "Farah", "Galih", "Hana", "Irfan"];
const INITIALS = ["A.", "B.", "D.", "F.", "H.", "K.", "M.", "N.", "P.", "R.", "S.", "T.", "W."];
const buyerName = (idx) => `${FIRST_NAMES[idx % FIRST_NAMES.length]} ${INITIALS[(idx * 7) % INITIALS.length]}`;

const DAYS_BACK = 370;

function buildMockOrders() {
  const recs = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let n = 1;

  for (let i = DAYS_BACK - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    const dow = day.getDay();
    const boost = dow === 0 || dow === 6 ? 1.3 : 1;
    const ordersToday = Math.max(1, Math.round((4 + rand() * 5) * boost));

    for (let k = 0; k < ordersToday; k++) {
      const orderNo = "SO" + String(2400000 + n).padStart(9, "0");
      const status = pick(STATUS_WEIGHTS);
      const ts = new Date(day);
      ts.setHours(Math.floor(rand() * 24), Math.floor(rand() * 60), 0, 0);
      const lineCount = rand() < 0.18 ? 2 : 1;
      const used = new Set();
      const buyer = buyerName(n);

      for (let l = 0; l < lineCount; l++) {
        const sku = pick(SKU_WEIGHTS);
        if (used.has(sku)) continue;
        used.add(sku);
        const jumlah = 1 + Math.floor(rand() * 3);
        recs.push({
          order: orderNo,
          sku,
          jumlah,
          status,
          ts: ts.getTime(),
          buyer,
          total: jumlah * (PRICE_MAP[sku] || 50000),
        });
      }
      n++;
    }
  }
  return recs;
}

export const mockOrders = buildMockOrders();
