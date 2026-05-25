# World Cup Predictor 🏆

A free-to-play FIFA World Cup 2026 prediction league. Pick scores, compete on a global leaderboard, create private rooms with friends, and see how the crowd is calling the bracket.

Built with **TanStack Start**, **React 19**, **Tailwind CSS v4**, **shadcn/ui**, and **Supabase** for auth, data, and realtime updates.

## Features

- 🔐 **Auth** — Email/password sign-up and login (public, no invite needed)
- ⚽ **Match predictions** — Pick a score for every World Cup 2026 fixture
- 🏅 **Global leaderboard** — 3 pts for correct outcome, +2 bonus for exact score
- 👥 **Private rooms** — Create/join rooms with custom scoring rules
- 📊 **Fan Predictions** — Aggregated crowd picks per knockout stage, live-updated
- 🛠️ **Admin console** — Manage users, seed matches, and save official results
- 🚫 **Account gating** — Deactivated accounts are blocked from game screens

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | TanStack Start v1 (SSR on Cloudflare Workers) |
| UI | React 19 + Tailwind CSS v4 + shadcn/ui |
| Backend | Supabase (Postgres + Auth + Realtime) |
| Routing | TanStack Router (file-based, `src/routes/`) |
| Data | TanStack Query |

## Getting Started

```bash
bun install
bun run dev
```

The app expects a Supabase project with the schema documented in `supabase/migrations/`. Configure the client in `src/integrations/supabase/client.ts`.

## Project Structure

```
src/
├── routes/
│   ├── __root.tsx              # Root layout + nav
│   ├── index.tsx               # Landing
│   ├── login.tsx, signup.tsx   # Public auth
│   └── _authenticated/         # Gated app
│       ├── dashboard.tsx
│       ├── matches.tsx
│       ├── leaderboard.tsx
│       ├── fan-predictions.tsx
│       ├── rooms.index.tsx
│       ├── rooms.$roomId.tsx
│       ├── rules.tsx
│       └── admin.tsx
├── components/                 # MatchCard, PredictionDialog, ui/
├── integrations/supabase/      # Supabase client
├── lib/auth.tsx                # Auth context
└── data/worldcup.json          # Static tournament data
```

## Scoring

**Global (default):**
- Correct winner / draw → **3 pts**
- Exact score → **+2 bonus** (5 pts total)

**Rooms** can override scoring per the room owner's rules.

## Database

Schema lives in `supabase/migrations/`. Key tables:

- `football_profiles` — user profile + `is_active` flag
- `football_matches` — fixtures, stages, official scores
- `football_predictions` — global picks
- `football_rooms`, `football_room_members`, `football_room_predictions` — private leagues
- `football_user_roles` — `admin` / `user` via `has_role()` security-definer fn

All tables use RLS. Users can read public data and write only their own rows.

## Routes

| Path | Purpose |
|---|---|
| `/` | Landing page |
| `/login`, `/signup` | Public auth |
| `/dashboard` | User overview |
| `/matches` | All fixtures + prediction entry |
| `/leaderboard` | Global standings |
| `/fan-predictions` | Crowd picks per stage |
| `/rooms`, `/rooms/$roomId` | Private leagues |
| `/rules` | Scoring & rules |
| `/admin` | Admin console (role-gated) |

## License

MIT
