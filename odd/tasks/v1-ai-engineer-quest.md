# Feature: v1 — AI Engineer class playable with sync
Objective: usable v1 of My Life as RPG (hub, pixel map, quests with evidence, sync). Branch: `feature/v1`. Delivery: ask-on-risk. Runner: `npm test` (Vitest).
Design: `docs/superpowers/specs/2026-10-24-my-life-as-rpg-design.md` · Flows: Flowdocs `my-life-as-rpg`.

## Specs

- S1 Hub: "dashboard" — avatar (Warlock), name, class card with level, title, XP bar, six stats, next quest.
- S2 World map: "world map" — pixel medieval overworld, 5 chapters as biomes, bosses at weeks 9, 18, 26, 34, 36, fog over locked chapters, clickable stops open the quest panel.
- S3 Quests: "complete quests with evidence" — evidence (link, reflection, file such as a diploma) required; XP awarded only on transition to complete and never twice; undo with confirmation reverts completion rewards.
- S4 Sync: "sync" — Google login (Supabase), local-first, works offline, JSON export/import with schema validation.
- S5 Time progress: logged sessions (timer or manual hours) give 40 % of value up to estimated hours, counted up to 1.5×; 60 % on completion. Map progress capped at 90 % without evidence.
- S6 Economy: level = 1 + floor(xp/220) for AI Engineer; titles 5/10/15/20; gold = xp/2; +2 primary stat, boss +5 primary +1 others.
- S7 Seed: the 36 quests exactly as in the build prompt, links only from the official library.
- S8 Integrity: never reset data after reload; invalid import recovered gracefully; dependents stay completed after undo with a notice.
- S9 Accessibility: keyboard navigation, reduce motion, responsive.

## Tasks

| ID | Task | Specs | Route | Status | Commit |
|----|------|-------|-------|--------|--------|
| T1 | Scaffold Vite+React+TS+Vitest, docs, gitignore | — | inline | pending | |
| T2 | Domain: class schema, events, deriveState, commands + tests | S3 S5 S6 S8 | inline | pending | |
| T3 | Content: AI Engineer class seed | S7 | inline | pending | |
| T4 | Local persistence + JSON export/import + tests | S4 S8 | inline | pending | |
| T5 | Tile atlas (Kenney CC0, used tiles only) + Warlock recolor + map generator + canvas renderer | S2 | inline | pending | |
| T6 | UI: hub, map screen, quest drawer, celebrations, settings | S1 S2 S3 S9 | inline | pending | |
| T7 | Supabase: auth, event sync, evidence storage, SQL + RLS, README setup | S4 | inline | pending | |
| T8 | Verification: tests, build, browser check | all | inline | pending | |

Route evidence: one coherent app built in sequence; units depend on the domain contract, so no parallel writer reason applies.

## Log

- L1 (2026-10-20, user): "I want to create a website that help me to reach my goals, at moment we have the branch of my proffesional carrer, read this file that is in dowload folder, AI_Engineer_Quest_Builder_Prompt you also for the topic that i want to specialize in the same folder there are a docs named Rafael_AI_Engineer_RPG_Roadmap take a look"
- L2 (2026-10-21, user, MVP scope): "dashboard, world map, complete quests with evidence and sync"
- L3 (2026-10-24, user): "at moment i can't read all the changes please do in auto changes until I say stop continue and create all you ehink is necessary"
- L4: Decisions recorded in the design doc and Flowdocs; undo-dependents decision taken by delegation.
