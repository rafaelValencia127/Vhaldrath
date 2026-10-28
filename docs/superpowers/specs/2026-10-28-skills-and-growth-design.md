# Skills & Character Growth — Design

Date: 2026-10-28 · Owner: Rafael · Status: draft for review · Extends `2026-10-24-my-life-as-rpg-design.md`

## Intent

Rafael wants to *see* himself advance. Finishing a quest should visibly grow the character in the thing he actually practiced (Python, guitar, English, finance), the way an RPG character grows in Intelligence or Endurance. Progress must stay legible over years: new projects appear all the time, most of them overlap existing ones (many projects involve Python), and learning never ends.

Today levels and titles belong to a *class* (a project such as AI Engineer). That does not scale: one project may never touch Python, another touches it for a week, and a recurrently created project would each start from zero. This feature moves growth from the project to the **skill**.

## Vocabulary

- **Skill**: a concrete thing practiced (Python, LLM, Architecture, Guitar, Vocal technique, English, Budgeting). Has XP and a level. Global: shared by every project.
- **Area**: a broad character stat that groups skills (initial: Engineering, Arts, Languages, Finance). Its level is derived from its skills. Rafael described these as RPG stats ("intellect, strength, endurance").
- **Class / project**: unchanged container of chapters, quests and a map.
- **Tag**: a skill id attached to a quest.

## Goals

1. **Quest tags drive growth.** A quest carries one or more skill tags. Completing it (and logging study time, as today) raises every tagged skill. The rule is deliberately simple: *the tag says the course/book/exercise is about that skill, so that skill levels up.*
2. **No cap.** Skills have no maximum XP or level. Level comes from a formula, not a table, so a new skill works without configuring a curve.
3. **Each level costs more than the previous one.** Early levels must come fast: the first level-up should arrive within the first one or two quests of a new skill, so progress is felt in week 1.
4. **Character sheet (mockup option B, chosen by Rafael).** The hub shows areas with their level, and under each area its skills with level and progress bar. Finance and English appear the same way once they have XP. The sheet shows only areas and skills that already have XP (no list of empty zero-level skills).
5. **Level-up moment.** When a skill levels up, show sparkles/confetti and a toast naming the skill and new level. Respect reduce-motion (summary card instead).
6. **Titles by skill level.** Titles unlock from a skill's level, from any project. Existing AI Engineer titles move over: Python Adept, AI Builder, Cloud Ranger, MLOps Architect, each attached to a skill (see Open calls).
7. **Unlocks show on the avatar.** Reaching certain levels in a skill unlocks an outfit piece for that skill (for example a guitar for Guitar, a hat for LLM) shown on the Warlock. See Delivery order.

## Non-goals

- A global "character level" number. Not requested; areas and skills are the progress surface.
- In-app editing of quests or tags (already v2 in the base design).
- Penalties, decay or streaks. Skills never lose XP.
- Weighting tags (splitting a quest's XP across tags). Every tag gets the full XP.
- Starter content for Arts and Finance (guitar, vocal technique, budgeting classes or quests). This release ships the system only; those areas appear on the sheet when Rafael later adds quests that use them.

## Anti-goals

- Anything that makes progress feel capped or "finished" while the person is still learning.
- Per-project curves or per-skill hand-tuned tables that must be edited before a new skill can level.
- Rewriting history: XP already earned must not change when tags or curves are edited later.
- Invented validation or fake precision: levels are motivation, not certification.

## Decided by Rafael

- Growth lives on **skills**, not classes; a quest tagged Python raises Python regardless of project.
- Sum is simple; **no XP or level limit**.
- Titles hang from **skill level**, from any project.
- Option **B** (character sheet) for showing growth.
- Level-up shows lights/confetti; unlocks show as outfits; each level is harder than the last.
- This release ships the skill system only, with no starter music or finance classes, because there are no quests for them yet. The sheet shows only skills that already have XP.
- Examples of areas given: software (code, documentation, devops, deployment, AI, LLM), music (guitar, vocal technique), finance, English.

## Rules (builder to implement exactly)

- Skill XP for a quest = the XP the quest awards, from both study sessions and completion, exactly as the existing economy computes them (40 % time, 60 % completion). **Each tag receives the full amount** (a quest tagged Python and LLM gives both the full XP).
- Undo of a completion removes only the completion portion from the tagged skills, mirroring the existing rule; session XP stays. Skill XP never goes below 0.
- Skill and area levels are **derived** from the event log, never stored as counters, so edits and sync stay conflict-free (same principle as the base design).
- Reward values are **snapshotted in events** (as today). The completion and session events must record which skills received XP, so changing a quest's tags later does not rewrite past XP.
- Level function: strictly increasing cost per level, integer, deterministic, unbounded. Constraints: level 2 of any skill within about 100–150 XP (one normal quest is 100 XP); noticeably slower by level 10; no ceiling. Exact formula is the builder's call.
- Area level is derived from the XP/levels of its skills; the formula is the builder's call, but it must not require stored state and must rise whenever a contained skill rises.
- Titles: a data table of `(skillId, level, title)`. A title is earned when that skill's level reaches `level`. New titles are added as data.
- Quests reference skills by id from a skill catalog (id, name, area). A class definition that references an unknown skill id must not crash the app.

## Existing data this touches (from the current code)

- `src/domain/schema.ts`: quests have one `stat` (one of six per-class stats INT/CODE/CLOUD/DATA/OPS/CHA, awarded +2 / boss +5), and classes own `xpPerLevel` and `titles`.
- Events `session_logged` and `quest_completed` already snapshot rewards; neither records skills yet.
- Events are synced to Supabase; rows already stored have no skill information.
- The hub (`src/ui/Hub.tsx`) shows one card per class with level/title/XP bar/stats; the celebration component exists.
- The 36 AI Engineer quests are seeded in `src/content/ai-engineer.ts`; the 36 titles are the roadmap's definitions of done and must not change.

## Open calls (my proposals, for the builder to challenge)

These are my calls, not Rafael's:

- **Initial areas**: Engineering, Arts, Languages, Finance; more are added as data.
- **Initial skill catalog for the 36 quests** (to be proposed by the builder and shown to Rafael to adjust): Python, FastAPI/APIs, Data (pandas, SQL), ML fundamentals, LLM/RAG, Cloud (AWS, Docker, Terraform), MLOps, Testing, Documentation, Architecture, English. Titles proposed: Python Adept (Python), AI Builder (LLM), Cloud Ranger (Cloud), MLOps Architect (MLOps), with initial thresholds chosen by the builder so each is reachable inside the 36-week roadmap (the roadmap is not the only source of XP, so they need not be maxed there).
- **What happens to the six per-class stats (INT, CODE, CLOUD, DATA, OPS, CHA)**: proposal is to leave them untouched in this feature and decide their fate separately.
- **Class level and class title**: the class keeps its map and project progress, and stops showing its own level and title once skills exist.
- **Existing progress**: users already have events without skill data; the builder decides how old events are credited (for example by looking up the quest's tags in the class definition when the event has none).

## Delivery order (my call)

1. Skill model, tags on the 36 quests, derived levels, areas, character sheet, level-up celebration, titles.
2. Outfit pieces on the avatar. This needs new pixel art (CC0 or original); only the first piece or two ship at first, the system is built so more can be added as data.

## Left to the builder

Level formula and constants, area aggregation formula, exact tag assignments for the 36 quests, catalog and title data shape, how old events are credited, visual layout details of the sheet within the existing pixel style, celebration details, migration of the Supabase rows and local save format.
