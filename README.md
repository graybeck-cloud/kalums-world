# Kalum's World

A realistic Nordic 3D adventure built with Three.js, deployed on **Vercel** with a **Supabase** Postgres backend for saves and a global leaderboard.

Play: visit the village by the campfire and talk to its folk (**E** / 💬), buy armor from Bjorn the Smith and health potions from Sigrid the Trader, gather glowing runestones, hunt frost creatures across the wilds (deer roam and flee, birds circle overhead), watch the aurora at night, and defeat the Frost King. The village is a safe haven — foes won't spawn inside it, and it's where you respawn.

## Stack

- **Frontend**: ES-module `game.js` (Three.js **r0.184**) bundled with **Vite**, served by Vercel.
- **Rendering**: PBR materials with procedural normal/roughness maps, atmospheric `Sky`
  (Rayleigh/Mie scattering), reflective `Water`, and a post-processing stack
  (SSAO ambient occlusion → UnrealBloom → FXAA → ACES tone mapping). A Low/High
  graphics tier is auto-detected and toggleable in-game (✨ button).
- **API**: Vercel serverless functions in `/api` using `@supabase/supabase-js`.
- **Database**: Supabase Postgres (`kalum_leaderboard`, `kalum_saves`).

## Build

```bash
npm install
npm run dev      # local dev server (Vite) at http://localhost:5173
npm run build    # production build → dist/
```

On Vercel the build runs `vite build` (output `dist/`); the `/api` serverless
functions deploy alongside it. Note: `npm run dev` serves only the front-end, so
the backend (saves/leaderboard) shows offline locally — use `vercel dev` if you
need the API while developing.

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

## Database setup

Apply `supabase/schema.sql` to your Supabase project (via the SQL editor or MCP).

## Controls

WASD move · **Right-drag to look** · **Wheel to zoom** · Left-Click sword · Space jump (stomp foes) · Shift sprint · F5 camera · M music

The mouse cursor stays visible for clicking HUD/shop/dialogue. A live **minimap** (top-right) shows the village (gold), runestones (cyan), villagers (yellow), enemies (red), and the boss (purple), with your heading at the centre.

Tap the **🛡️ Armor** button to open the Armorsmith and trade gold (earned from kills, runestones, and quests) for armor. Each suit reduces incoming damage and raises your max health.

Walk up to a villager and press **E** (or tap 💬 on touch) to talk. Bjorn the Smith opens the armor shop; Sigrid the Trader sells health potions. Drink a potion with **Q** or the **🧪** button to restore health.

Use the **✨** button to switch graphics quality between High (full post-FX, MSAA, 4K shadows) and Low (faster, for touch/weaker GPUs).
