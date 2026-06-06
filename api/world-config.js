import { noStore } from "./_supabase.js";

function dateKey() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function seedFromDate(day) {
  let h = 2166136261 >>> 0;
  for (const ch of day) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function challengeFromSeed(seed) {
  const list = [
    "Gather 8 runestones and stay above half health.",
    "Defeat 5 frost creatures before sunset.",
    "Explore 250 steps across the snowy wilds.",
    "Collect 12 gold and reach Level 3.",
    "Find 6 runestones hidden in the pine forest.",
    "Defeat the Frost King without being knocked out.",
    "Survive a full night in the Nordic wilds.",
  ];
  return list[seed % list.length];
}

export default function handler(req, res) {
  noStore(res);
  const day = dateKey();
  const seed = seedFromDate(day);
  res.status(200).json({ seed, dailyChallenge: challengeFromSeed(seed), generatedFor: day });
}
