// Port dari PRODUK_OPTIONS/produkMatch (ShopeePartnerDashboard.jsx) — disederhanakan
// karena mock record di sini sudah punya field `sku` langsung (bukan item_list nested).

export const PRODUK_OPTIONS = [
  { key: "", label: "Semua produk", group: null },
  { key: "Klasik", label: "Generos Klasik", group: "Generos Klasik" },
  { key: "Botol", label: "Generos 1 Botol", group: "Generos 1 Botol" },
  { key: "Milk", label: "Generos Milk", group: "Generos Milk" },
];

export const produkMatch = (sku, key) => {
  if (!key) return true;
  if (key === "Milk") return /^genmilk/i.test(sku);
  if (key === "Botol") return sku === "QKS-GEN1";
  if (key === "Klasik") return /^QKS-GEN0\d$/.test(sku);
  return true;
};
