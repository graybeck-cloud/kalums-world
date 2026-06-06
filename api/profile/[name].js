import { supabase, sanitizeName, nameKey, noStore } from "../_supabase.js";

export default async function handler(req, res) {
  noStore(res);
  const name = sanitizeName(req.query.name);
  const key = nameKey(name);
  if (!supabase) return res.status(200).json({ name, rank: null, bestScore: 0, save: null });

  const { data: rows } = await supabase
    .from("kalum_leaderboard")
    .select("name_key,score")
    .order("score", { ascending: false });

  let rank = null;
  let best = 0;
  if (rows) {
    const idx = rows.findIndex((r) => r.name_key === key);
    rank = idx >= 0 ? idx + 1 : null;
    const mine = rows.find((r) => r.name_key === key);
    best = mine ? Number(mine.score || 0) : 0;
  }

  const { data: sv } = await supabase
    .from("kalum_saves")
    .select("display_name,payload")
    .eq("name_key", key)
    .maybeSingle();
  const save = sv ? { playerName: sv.display_name, ...(sv.payload || {}) } : null;

  res.status(200).json({ name, rank, bestScore: best, save });
}
