import { STATUS_ORDER, SKU_MASTER, SKU_INFO } from "./skuMaster";

// Port 1:1 dari backend/parse_export.py::_summarize() (mp.qukis.id).
// Aturan (lihat docs Cron_Pesanan): Customer = COUNT DISTINCT Nomor Pesanan,
// Qty = SUM(Jumlah x Bundling SKU). Customer di level manapun (SKU, grup produk,
// status, grand total) SELALU distinct-order — tidak pernah dijumlahkan dari level
// yang lebih detail, karena 1 customer bisa beli beberapa SKU/grup dalam 1 order.

const knownOrder = new Map(SKU_MASTER.map(([sku], i) => [sku, i]));

function groupBySku(rows) {
  const skuMap = new Map();
  for (const r of rows) {
    const info = SKU_INFO[r.sku];
    const bundling = info ? info.bundling : 1;
    if (!skuMap.has(r.sku)) {
      skuMap.set(r.sku, {
        sku: r.sku,
        produk: info ? info.produk : r.sku,
        group: info ? info.group : r.sku,
        orders: new Set(),
        qty: 0,
      });
    }
    const e = skuMap.get(r.sku);
    e.orders.add(r.order);
    e.qty += r.jumlah * bundling;
  }
  return [...skuMap.values()]
    .sort((a, b) => (knownOrder.get(a.sku) ?? 999) - (knownOrder.get(b.sku) ?? 999))
    .map((e) => ({ sku: e.sku, produk: e.produk, group: e.group, customer: e.orders.size, qty: e.qty }));
}

// Subtotal per grup produk — DISTINCT order per grup, bukan sum customer per-SKU
// (kalau di-sum, customer yang beli 2 SKU dalam grup yang sama bakal double count).
function groupSubtotals(rows) {
  const map = new Map();
  for (const r of rows) {
    const info = SKU_INFO[r.sku];
    const group = info ? info.group : r.sku;
    const bundling = info ? info.bundling : 1;
    if (!map.has(group)) map.set(group, { orders: new Set(), qty: 0 });
    const e = map.get(group);
    e.orders.add(r.order);
    e.qty += r.jumlah * bundling;
  }
  return Object.fromEntries([...map.entries()].map(([group, e]) => [group, { customer: e.orders.size, qty: e.qty }]));
}

function buildView(rows) {
  return {
    skuRows: groupBySku(rows),
    groupSubtotals: groupSubtotals(rows),
    customer: new Set(rows.map((r) => r.order)).size,
    qty: groupBySku(rows).reduce((s, r) => s + r.qty, 0),
  };
}

export function summarize(recs) {
  const present = [...new Set(recs.map((r) => r.status))];
  const statusOrder = [...STATUS_ORDER.filter((s) => present.includes(s)), ...present.filter((s) => !STATUS_ORDER.includes(s))];

  const statuses = statusOrder.map((status) => ({
    status,
    ...buildView(recs.filter((r) => r.status === status)),
  }));

  return {
    statuses,
    all: buildView(recs),
    totalCustomer: new Set(recs.map((r) => r.order)).size,
    totalQty: statuses.reduce((s, st) => s + st.qty, 0),
    totalOrderLines: recs.length,
  };
}
