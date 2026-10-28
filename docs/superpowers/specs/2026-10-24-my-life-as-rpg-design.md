# My Life as RPG — Design

Date: 2026-10-24 · Owner: Rafael · Status: approved by delegation ("continue and create all you think is necessary")

## Intent

A personal web app that turns real-life learning goals into a single-player pixel-art RPG. Each life goal is a **class** (AI Engineer first; later English, Guitar, Singing, Dance, Web Design). Finishing real work — with evidence — levels the character up. The point is motivation over months: small visible progress every study session, big celebrations on milestones, never shame for breaks.

Source material: `AI_Engineer_Quest_Builder_Prompt.md` and `Rafael_AI_Engineer_RPG_Roadmap.docx` (36-week Applied AI + MLOps roadmap, Oct 2026 – Jul 2027, 10 h/week).

## Goals (v1 — usable this week)

1. **Character hub**: original pixel Warlock avatar, display name, one card per class (level, title, XP bar, six stats, next quest).
2. **Pixel world map per class**: top-down medieval overworld (early Zelda / GB-era Pokémon *vibe*, inspiration only), chapters as biomes, road with quest stops, bosses as castles/monsters, side quests as chests, fog over locked chapters, avatar on the current quest.
3. **Quest panel**: description, acceptance criterion, estimated hours, stat, XP/gold, official course links, notes, study sessions (timer or manual hours), evidence (link, written reflection, file), Complete and Undo (with confirmation).
4. **Sync**: Google login via Supabase; local-first (instant, offline-capable), event log synced to Postgres; private evidence file storage; JSON export/import as an extra backup.

## Non-goals (v1)

Reward shop and boss rewards UI (gold is earned and stored from day 1), class-file import and in-app quest editing, other classes, timeline/calendar, resources page, achievements, analytics, avatar customization beyond name. The data model supports all of them.

## Anti-goals

- Progress that feels stuck for a week → solved by time-based progress.
- Guilt mechanics: no breakable streaks, no "you are behind" messages. Dates never gate progress.
- Fake validation: the app never claims to verify GitHub links or diplomas.
- Copyrighted art: only CC0 assets (Kenney) and original edits.
- Losing progress on browser wipe or another PC.

## Decided by Rafael

- Classes like RPG classes: own level, stats, chapters and quests per class; shared character identity.
- 2026-10-28: levels and titles moved from classes to global, uncapped skills driven by quest tags; classes no longer show a level or title. See `2026-10-28-skills-and-growth-design.md`.
- Stack: Vite + React + TypeScript (not Next.js — no server rendering needed and SSR fights browser storage).
- Supabase with Google login for cross-device sync.
- Earned XP is permanent: removing a completed quest or a whole class never removes XP.
- Living roadmap: quests form a graph (forks, side quests); editing comes in v2.
- Home = Character hub (mockup option A). Class view = illustrated pixel map with readable labels.
- Pixel medieval style; Kenney CC0 tiles, only the necessary ones.
- Completion moment scales with effort; bosses get a champion celebration.
- Rewards (v2): re-buyable gold shop items + one-time boss rewards configured by the player.
- Time-based progress: 40 % of a quest's value earned by logged time, 60 % on completion with evidence; time counts up to 1.5× the estimated hours.
- Level curve linear, 220 XP/level for AI Engineer; gold = XP / 2 (normal 50, boss 150).
- Evidence may include uploaded files (e.g. diploma PDF).
- Avatar is a Warlock (Rafael's WoW class) — original pixel art, no Blizzard assets.
- Flows are modeled in Flowdocs project `my-life-as-rpg` before coding (Spanish, matching his other Flowdocs projects).

## Economy (exact rules)

- Quest value: `xp` (normal 100, boss 300), `gold = xp / 2`.
- Time reward rate per hour: `0.4 × value / estimatedHours`; hours counted per quest are capped at `1.5 × estimatedHours` (max time reward = 60 % of value).
- Completion reward: `0.6 × value` XP and gold; stats `+2` primary; boss `+5` primary and `+1` every other stat. Time never gives stats.
- Completion is awarded only on transition to completed, once; repeated completes are no-ops.
- Undo removes only the completion reward; session rewards stay. Gold never goes below 0.
- Dependents already completed stay completed after an undo, flagged "prerequisite reopened".
- Level = `1 + floor(xp / xpPerLevel)`; titles per class (AI Engineer: 5 Python Adept, 10 AI Builder, 15 Cloud Ranger, 20 MLOps Architect).
- Reward values are snapshotted in each event so later class edits never rewrite history.

## Quest state

- `locked`: some prerequisite is not completed.
- `available`: all prerequisites completed, no sessions logged.
- `in_progress`: has logged hours (or was undone).
- `completed`: completion event not undone.
- A chapter is fogged while none of its quests is unlocked (in practice: until the previous chapter's boss is completed).

## Architecture (builder's call, recorded)

- **Domain** (`src/domain/`): pure TypeScript, no React. Class definition schema (zod), event types, `deriveState(classes, events)` → per-class XP, level, title, stats, gold, quest statuses, map progress, next quest. Commands validate and produce events (`logSession`, `addEvidence`, `completeQuest`, `undoQuest`).
- **Event log**: append-only, UUID ids, ordered by `(at, id)`; merge = union by id. This makes multi-device sync conflict-free and XP dedup trivial.
- **Persistence** (`src/infra/`): localStorage repository (versioned envelope, schema-validated, corrupt data recovered without wiping); Supabase repository (table `events`, RLS per user; bucket `evidence` private, path `user_id/…`). Without Supabase env vars the app runs local-only and says so.
- **UI** (`src/ui/`): React; hub, class map, quest drawer, settings. World map rendered on `<canvas>` from a small atlas of only the Kenney tiles used; labels/HUD are DOM (crisp text, accessible, keyboard focusable). Map layout generated deterministically from the class's chapters and quests, so any class gets a map.
- **Content** (`src/content/ai-engineer.ts`): the 36 quests seeded exactly from the build prompt, with acceptance criteria, evidence hints and course links from the official library only.

## Accessibility & polish

Keyboard-navigable map stops and drawer, visible focus, reduced-motion respected (celebrations become summary cards), responsive to phone width, toasts for success/error, empty/loading states.

## Left to the builder

Exact palette/typography (pixel display face + readable body face), copy, animation details, atlas composition, map generation details, Supabase SQL details.

## Open items needing Rafael (non-blocking)

- Create the Supabase project and Google OAuth credentials (steps in README); paste URL and anon key into `.env.local`.
