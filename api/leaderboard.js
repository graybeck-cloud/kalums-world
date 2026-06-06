import { supabase, clamp, sanitizeName, nameKey, readBody, noStore } from "./_supabase.js";

export default async function handler(req, res) {
  noStore(res);

  if (req.method === "GET") {
    if (!supabase) return res.status(200).json({ entries: [], offline: true });
    const { data, error } = await supabase
      .from("kalum_leaderboard")
      .select("display_name,score,level,coins,cores,distance,survived_seconds")
      .order("score", { ascending: false })
      .limit(25);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({
      entries: (data || []).map((r) => ({
        name: r.display_name,
        score: r.score,
        level: r.level,
        coins: r.coins,
        cores: r.cores,
        distance: r.distance,
        survivedSeconds: r.survived_seconds,
      })),
    });
  }

  if (req.method === "POST") {
    if (!supabase) return res.status(200).json({ ok: false, offline: true });
    const b = readBody(req);
    const name = sanitizeName(b.name);
    const key = nameKey(name);
    const score = clamp(b.score, 0, 99999999);
    const row = {
      name_key: key,
      display_name: name,
      score,
      level: clamp(b.level, 1, 9999),
      coins: clamp(b.coins, 0, 99999999),
      cores: clamp(b.cores, 0, 99999999),
      distance: clamp(b.distance, 0, 99999999),
      survived_seconds: clamp(b.survivedSeconds, 0, 99999999),
      updated_at: new Date().toISOString(),
    };
    const { data: existing } = await supabase
      .from("kalum_leaderboard")
      .select("score")
      .eq("name_key", key)
      .maybeSingle();
    if (!existing || score >= Number(existing.score || 0)) {
      const { error } = await supabase.from("kalum_leaderboard").upsert(row, { onConflict: "name_key" });
      if (error) return res.status(500).json({ error: error.message });
    } else {
      await supabase.from("kalum_leaderboard").update({ updated_at: row.updated_at }).eq("name_key", key);
    }
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ error: "method not allowed" });
}
