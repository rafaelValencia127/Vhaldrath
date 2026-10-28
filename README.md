# My Life as RPG

Turn real learning goals into a pixel-art RPG. Each life goal is a **class** with its own quests, stats and world map. The first class is **AI Engineer**: a 36-week roadmap toward Applied AI and MLOps. You log study time, attach real evidence, complete quests, and your Warlock's **skills** level up.

- **Hub**: your Warlock, a character sheet with your skills grouped by area, and each class's XP, stats and next quest.
- **Skills**: every quest is tagged with the skills it trains (Python, LLMs, Cloud…). Skills are shared by every class, so Python grows from any project that uses it.
- **World map**: a top-down pixel overworld per class. Chapters are biomes, bosses guard castles, side quests are chests, and locked chapters hide under fog.
- **Quests**: acceptance criterion, official course links, study timer or manual hours, and evidence (link, written reflection, or file such as a diploma). Complete and undo both ask for confirmation.
- **Sync**: works offline in the browser. Sign in with Google to sync across devices. JSON backup export/import.

## Rules of the game

| Rule | Value |
|---|---|
| Quest value | normal 100 XP / 50 gold, boss 300 XP / 150 gold |
| Logged time | 40 % of the value at the estimated hours; counted up to 1.5× the estimate |
| Completion (needs evidence) | the other 60 %, plus +2 to the quest's stat (boss: +5 and +1 to every other stat) |
| Skill XP | each tag on a quest receives the quest's full XP (time and completion) |
| Skill level | no cap; level 2 at 100 XP and each level costs 30 XP more than the previous one |
| Areas | Engineering, Arts, Languages, Finance; an area's level comes from the total XP of its skills |
| Titles | earned by skill level, from any class: Python Adept (Python 5), AI Builder (LLMs 5), Cloud Ranger (Cloud 5), MLOps Architect (MLOps 5) |
| Undo | removes only the completion reward; study time and evidence stay |
| Permanence | earned XP is never lost, even if a quest is later removed from the class |

Progress is stored as an append-only list of events with unique ids. Merging two devices is a union of those events, so XP can never be counted twice.

## Run it

Requires Node 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit + UI tests (Vitest)
npm run build      # static site in dist/
```

Without Supabase settings, the app runs in **local-only mode**: progress stays in this browser. Use Settings → Download backup now and then.

## Connect cloud sync (Supabase + Google)

1. Create a free project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run `supabase/migrations/001_init.sql`. It creates the `game_events` table with row-level security (each user reads and appends only their own events) and the private `evidence` storage bucket.
3. In Google Cloud Console, create an **OAuth client ID** (type *Web application*). Add this as an authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`.
4. In Supabase → **Authentication → Sign In / Providers → Google**, enable Google and paste the client ID and secret.
5. In Supabase → **Authentication → URL Configuration**, set the Site URL to where the app runs (for example `http://localhost:5173`, later your deployed URL) and add it to the redirect URLs.
6. Create `.env.local` in the project root:

   ```
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon public key from Project Settings → API>
   ```

7. Restart `npm run dev` and use **Sign in with Google**. Progress you made before signing in is uploaded to your account.

The anon key is meant to be public. Row-level security is what protects your data. Never put the `service_role` key in the app.

## Deploy

`npm run build` produces a static site in `dist/` (hash routing, so no server rewrites are needed). Vercel, Netlify, Cloudflare Pages and GitHub Pages all work. Set the two `VITE_SUPABASE_*` variables in the host and add the deployed URL to Supabase's redirect URLs.

## Project layout

```
src/domain/    pure game rules: schemas, events, deriveGame, commands (no React)
src/content/   class definitions (AI Engineer seed)
src/infra/     local save, JSON backup, Supabase adapter
src/app/       store, sync engine, React services
src/ui/        hub, world map (canvas + DOM labels), quest drawer, settings
scripts/       build-atlas.mjs (tile atlas), preview-map.ts (map PNG preview)
supabase/      SQL migration
```

Design: `docs/superpowers/specs/2026-10-24-my-life-as-rpg-design.md`. Flows: Flowdocs project `my-life-as-rpg`.

## Art credits

Pixel tiles from **Tiny Town** and **Tiny Dungeon** by [Kenney](https://kenney.nl), CC0. Only the tiles the game uses are packed into `public/tiles/atlas.png`. The Warlock is a recolor made for this game. To rebuild the atlas, download both packs, unzip them into `town/` and `dungeon/` folders, then run `npm run atlas -- <that folder>`.

## Roadmap

- Next: outfit pieces on the Warlock unlocked by skill levels.
- v2: reward shop (re-buyable treats bought with gold) and one-time boss rewards; class files generated with any LLM and imported; editing quests, forks and side quests in the app.
- Later: more classes (English, Guitar, Singing, Dance, Web Design), timeline, achievements, analytics.
