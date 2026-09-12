// Basis URL backend.
//
// Default KOSONG = same-origin: nginx di mpqukis.web.id yang nge-proxy
// /api/* dan /health ke backend python di 127.0.0.1:5010. Jadi frontend
// tidak pernah hardcode host — pindah server/domain cukup ubah nginx.
//
// Override hanya kalau backend beda origin (misal dev lokal atau split host):
//   VITE_API_BASE=http://localhost:5010 npm run dev
//   VITE_API_BASE=https://api.qukis.id npm run build
export const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "");
