// Master SKU + bundling — sumber tunggal, harus sinkron sama backend/parse_export.py::SKU_INFO
// di mp.qukis.id. Jangan diubah di sini doang tanpa ubah juga di backend.

export const STATUS_ORDER = ["Perlu Dikirim", "Sedang Dikirim", "Telah Dikirim", "Pesanan Diterima", "Batal"];

// (sku, produk, bundling, group)
export const SKU_MASTER = [
  ["QKS-GEN01", "Generos Klasik", 1, "Generos Klasik"],
  ["QKS-GEN02", "Generos Klasik", 2, "Generos Klasik"],
  ["QKS-GEN03", "Generos Klasik", 3, "Generos Klasik"],
  ["QKS-GEN1", "Generos 1 Botol", 1, "Generos 1 Botol"],
  ["GenMilkVnl-01", "Generos Milk Vanilla", 1, "Generos Milk"],
  ["GenMilkMadu-01", "Generos Milk Madu", 1, "Generos Milk"],
  ["GenMilkVnl-02", "Generos Milk Vanilla", 2, "Generos Milk"],
  ["GenMilkMadu-02", "Generos Milk Madu", 2, "Generos Milk"],
  ["GenMilkVnl-03", "Generos Milk Vanilla", 3, "Generos Milk"],
  ["GenMilkMadu-03", "Generos Milk Madu", 3, "Generos Milk"],
];

export const SKU_INFO = Object.fromEntries(
  SKU_MASTER.map(([sku, produk, bundling, group]) => [sku, { produk, bundling, group }])
);

export const PRODUCT_GROUPS = ["Generos Klasik", "Generos 1 Botol", "Generos Milk"];

// Divalidasi via dataviz skill validate_palette.js (CVD ΔE 13.0 / normal-vision ΔE 16.3,
// worst pair blue↔violet — di atas ambang 8/15). fab219 tetap warna status "warning" resmi
// dari palette reference (kontras sub-3:1 memang dikompensasi selalu tampil bareng label teks).
export const STATUS_COLOR = {
  "Perlu Dikirim": "#fab219",
  "Sedang Dikirim": "#2a78d6",
  "Telah Dikirim": "#4a3aa7",
  "Pesanan Diterima": "#0ca30c",
  "Batal": "#898781",
};
