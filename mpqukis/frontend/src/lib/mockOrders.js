// DATA DUMMY — bukan data toko real. Dipakai buat preview visual sebelum backend
// (Shopee live) disambungkan. Generator deterministik (bukan Math.random) biar
// angka stabil tiap reload, bukan berubah-ubah acak.

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260914);
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

function buildMockOrders() {
  const recs = [];
  for (let i = 1; i <= 230; i++) {
    const orderNo = "SO" + String(2509000 + i).padStart(9, "0");
    const status = pick(STATUS_WEIGHTS);
    const lineCount = rand() < 0.22 ? 2 : 1; // ~22% order multi-SKU: nunjukin Customer != jumlah baris
    const used = new Set();
    for (let l = 0; l < lineCount; l++) {
      const sku = pick(SKU_WEIGHTS);
      if (used.has(sku)) continue;
      used.add(sku);
      const jumlah = 1 + Math.floor(rand() * 3);
      recs.push({ order: orderNo, sku, jumlah, status });
    }
  }
  return recs;
}

export const mockOrders = buildMockOrders();
