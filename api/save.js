import { supabase, clamp, sanitizeName, nameKey, readBody, noStore } from "./_supabase.js";

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  if (!supabase) return res.status(200).json({ ok: false, offline: true });

  const b = readBody(req);
  const name = sanitizeName(b.playerName);
  const key = nameKey(name);
  const pos = b.position || {};
  const st = b.stats || {};

  const payload = {
    worldSeed: Number(b.worldSeed || 0) || 0,
    cameraMode: Number(b.cameraMode || 0) === 1 ? 1 : 0,
    position: {
      x: clamp(pos.x, -99999, 99999),
      y: clamp(pos.y, -99999, 99999),
      z: clamp(pos.z, -99999, 99999),
    },
    stats: {
      health: clamp(st.health ?? 100, 0, 9999),
      energy: clamp(st.energy ?? 100, 0, 100),
      coins: clamp(st.coins ?? 0, 0, 99999999),
      cores: clamp(st.cores ?? 0, 0, 99999999),
      xp: clamp(st.xp ?? 0, 0, 99999999),
      level: clamp(st.level ?? 1, 1, 99999999),
      distance: clamp(st.distance ?? 0, 0, 99999999),
      survivedSeconds: clamp(st.survivedSeconds ?? 0, 0, 99999999),
      score: clamp(st.score ?? 0, 0, 99999999),
      armorTier: clamp(st.armorTier ?? 0, 0, 99),
    },
  };

  const { error } = await supabase
    .from("kalum_saves")
    .upsert({ name_key: key, display_name: name, payload, updated_at: new Date().toISOString() }, { onConflict: "name_key" });
  if (error) return res.status(500).json({ error: error.message });

  res.status(200).json({ ok: true, save: { playerName: name, ...payload } });
}
