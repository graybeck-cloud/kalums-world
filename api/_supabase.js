import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

// Single shared client. Falls back to null if env is missing so the API can
// still respond gracefully (offline mode) instead of crashing.
export const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

export function clamp(v, a, b) {
  v = Number(v);
  if (!Number.isFinite(v)) v = a;
  return Math.max(a, Math.min(b, v));
}

export function sanitizeName(n) {
  const c = String(n || "").replace(/[^a-zA-Z0-9 _-]/g, "").trim().slice(0, 18);
  return c || "Explorer";
}

export function nameKey(n) {
  return sanitizeName(n).toLowerCase();
}

export function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return {};
    }
  }
  return req.body;
}

export function noStore(res) {
  res.setHeader("Cache-Control", "no-store");
}
