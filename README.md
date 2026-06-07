# Kalum's World

A realistic Nordic 3D adventure built with Three.js, deployed on **Vercel** with a **Supabase** Postgres backend for saves and a global leaderboard.

Play: visit the village by the campfire and talk to its folk (**E** / 💬), buy armor from Bjorn the Smith and health potions from Sigrid the Trader, gather glowing runestones, hunt frost creatures across the wilds (deer roam and flee, birds circle overhead), watch the aurora at night, and defeat the Frost King. The village is a safe haven — foes won't spawn inside it, and it's where you respawn.

## Stack

- **Frontend**: static `index.html` + `game.js` (Three.js r128), served by Vercel.
- **API**: Vercel serverless functions in `/api` using `@supabase/supabase-js`.
- **Database**: Supabase Postgres (`kalum_leaderboard`, `kalum_saves`).

## API

- `GET  /api/world-config` — daily seed + quest (computed, no DB)
- `GET  /api/leaderboard` — top scores
- `POST /api/leaderboard` — submit a score
- `GET  /api/save/:name` — load a player's save
- `POST /api/save` — save progress
- `GET  /api/profile/:name` — best score + rank + save

## Environment variables (set in Vercel)

- `SUPABASE_URL` — your project URL
- `SUPABASE_ANON_KEY` — publishable/anon key (safe for public use behind RLS)

## Local development

The original Express version (file-based storage) lives separately for offline play.
For this Vercel version, run with the Vercel CLI:

```bash
npm install
vercel dev
```

## Database setup

Apply `supabase/schema.sql` to your Supabase project (via the SQL editor or MCP).

## Controls

WASD move · Mouse look · Left-Click sword · Space jump (stomp foes) · Shift sprint · F5 camera · M music

Tap the **🛡️ Armor** button to open the Armorsmith and trade gold (earned from kills, runestones, and quests) for armor. Each suit reduces incoming damage and raises your max health.

Walk up to a villager and press **E** (or tap 💬 on touch) to talk. Bjorn the Smith opens the armor shop; Sigrid the Trader sells health potions. Drink a potion with **Q** or the **🧪** button to restore health.
