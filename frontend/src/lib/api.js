import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// Attach token from localStorage as Bearer fallback (cookies are preferred but
// cross-site cookies can be blocked in preview, so we also pass the bearer).
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("spice_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: when the PWA service worker is offline, it responds with
// HTTP 202 and `{ queued: true, message }` after enqueueing the mutation in
// IndexedDB. Surface that as a rejection so callers can toast the user instead
// of crashing while trying to read a normal payload (e.g. bill.id).
api.interceptors.response.use(
  (resp) => {
    if (resp?.status === 202 && resp?.data?.queued) {
      const err = new Error(resp.data.message || "Saved offline — will sync when online");
      err.offlineQueued = true;
      err.response = resp;
      return Promise.reject(err);
    }
    return resp;
  },
  (err) => Promise.reject(err),
);

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export const money = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n || 0);
