import { supabase, nameKey, noStore } from "../_supabase.js";

export default async function handler(req, res) {
  noStore(res);
  if (!supabase) return res.status(200).json({ save: null, offline: true });
  const key = nameKey(req.query.name);
  const { data, error } = await supabase
    .from("kalum_saves")
    .select("display_name,payload")
    .eq("name_key", key)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(200).json({ save: null });
  res.status(200).json({ save: { playerName: data.display_name, ...(data.payload || {}) } });
}
