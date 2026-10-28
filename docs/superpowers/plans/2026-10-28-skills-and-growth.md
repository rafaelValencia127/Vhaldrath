# Skills & Character Growth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move levels and titles from classes to global, uncapped skills driven by quest tags, and show them on the hub as a character sheet with level-up celebrations.

**Architecture:** Skill XP is derived by `deriveGame` from the event log (never stored). `session_logged` and `quest_completed` events snapshot the skill ids they credited; older events fall back to the quest's tags in the class definition. A pure `src/domain/skills.ts` owns the level curve, area/skill aggregation and level-up diffing. The hub renders a new `CharacterSheet`; the class card and class HUD stop showing class level/title.

**Tech Stack:** TypeScript, React 18, zod, Vitest + Testing Library (existing).

**Spec:** `docs/superpowers/specs/2026-10-28-skills-and-growth-design.md`. Outfits on the avatar (spec goal 7, "Delivery order" step 2) are a separate follow-up plan because they need new pixel art; nothing here depends on them.

## Global Constraints

- Every tag on a quest receives the **full** XP of that quest (session XP and completion XP), never a split.
- **No cap**: no max XP or level for skills or areas; level comes from a formula.
- Level 2 of any skill at **100 XP**; each level costs strictly more than the previous one.
- Skill and area levels are **derived** from events, never stored as counters.
- Events **snapshot** the skill ids credited; changing a quest's tags later must not rewrite XP already earned by events that carry the snapshot.
- Undo removes only the completion share from the tagged skills; session XP stays; XP never below 0.
- The sheet shows **only skills and areas with XP > 0**.
- Domain code stays pure TypeScript (no React). UI copy in English. Reduce-motion respected.
- Test runner: `npm test` (Vitest). Typecheck: `npx tsc --noEmit`. No Supabase migration is needed (events are stored as `payload jsonb`; the new fields are additive and optional).

## Review Focus

1. An event whose `skills` contains an id missing from the catalog (another device, newer content) must not crash; it shows under an "Other" area named by its id (Task 3).
2. A duplicate `quest_completed`, or undo followed by re-complete, must not credit a skill twice (Task 3).
3. Events saved before this feature (no `skills` field) must still load, import and sync, and must still credit skills from the quest's tags (Tasks 2, 3).
4. A quest with no tags must change nothing and create no skill rows (Task 3).
5. Hours beyond the 1.5× cap and non-finite or negative XP must not produce NaN, negative or infinite levels (Tasks 1, 3).

---

### Task 1: Level curve, catalog schema, skill aggregation

**Files:**
- Modify: `src/domain/schema.ts` (add catalog schemas and `skills` on quests)
- Create: `src/domain/skills.ts`
- Create: `src/domain/skills.test.ts`

**Interfaces:**
- Produces in `schema.ts`: `areaSchema`, `skillSchema`, `skillTitleSchema`, `skillCatalogSchema`; types `AreaDef {id; name}`, `SkillDef {id; name; areaId}`, `SkillTitleDef {skillId; level; title}`, `SkillCatalog {areas: AreaDef[]; skills: SkillDef[]; titles: SkillTitleDef[]}`. `questSchema` gains `skills: z.array(z.string().min(1)).default([])`, so `QuestDef.skills: string[]` is always present.
- Produces in `skills.ts`:
  - `xpToNextLevel(level: number): number` → `100 + 30 * (level - 1)`.
  - `xpAtLevel(level: number): number` → total XP at which `level` begins (`xpAtLevel(1) = 0`, `xpAtLevel(2) = 100`, `xpAtLevel(5) = 580`).
  - `skillLevelFor(xp: number): { level: number; xpIntoLevel: number; xpForNextLevel: number }`; non-finite or negative xp counts as 0; xp is floored with the same `+ 1e-9` tolerance as `levelFor`.
  - `OTHER_AREA_ID = 'other'`, `emptyCatalog: SkillCatalog`.
  - Types `SkillState {id; name; areaId; xp; level; xpIntoLevel; xpForNextLevel; title?: string}` and `AreaState {id; name; xp; level; xpIntoLevel; xpForNextLevel; skillIds: string[]}` (`skillIds` ordered by skill XP descending, ties by id).
  - `buildSkills(catalog: SkillCatalog, xpBySkill: ReadonlyMap<string, number>): { skills: Record<string, SkillState>; areas: Record<string, AreaState> }`.
  - `SkillLevelUp {skillId: string; name: string; level: number; title?: string}` and `levelUps(before: { skills: Record<string, SkillState> }, after: { skills: Record<string, SkillState> }): SkillLevelUp[]` (structural parameter type, so `GameState` satisfies it once Task 3 adds `skills`, and Task 1 compiles on its own). A skill absent from `before` counts as level 1; only skills whose level rose appear, `title` set only when the title changed.

- [ ] **Step 1: Write the failing tests in `src/domain/skills.test.ts`**

Tests (name → assertions):
  - `curve costs`: `xpToNextLevel(1) === 100`, `(2) === 130`, `(10) === 370`; `xpAtLevel(1) === 0`, `xpAtLevel(2) === 100`, `xpAtLevel(5) === 580`; for levels 1–60 `xpToNextLevel(n + 1) > xpToNextLevel(n)`.
  - `skillLevelFor boundaries`: `skillLevelFor(0)` equals `{level: 1, xpIntoLevel: 0, xpForNextLevel: 100}`; `skillLevelFor(99.9).level === 1`; `skillLevelFor(100)` equals `{level: 2, xpIntoLevel: 0, xpForNextLevel: 130}`; `skillLevelFor(229).level === 2` and `skillLevelFor(230).level === 3`.
  - `no cap and bad input`: `skillLevelFor(1e9).level` is finite and greater than 1000; `skillLevelFor(-5)`, `skillLevelFor(NaN)`, `skillLevelFor(Infinity)` all equal `skillLevelFor(0)`.
  - `buildSkills`: with a catalog of area `eng`, skills `python` (eng) and `ml` (eng), title `{skillId: 'python', level: 2, title: 'Pythonista'}`: xp map `python 120, ml 60` gives `skills.python` level 2 with `title 'Pythonista'`, `skills.ml` level 1 without title, `areas.eng.xp === 180`, `areas.eng.skillIds` equals `['python', 'ml']`; a skill with xp 0 or missing from the map is absent from `skills`, and an area with no XP is absent from `areas`; an id not in the catalog (`'zig'`, 50 XP) appears as `skills.zig` with `name 'zig'`, `areaId 'other'`, and `areas.other.name === 'Other'`.
  - `levelUps`: build two `{ skills }` objects of `SkillState` values; python 90 → 100 XP yields `[{skillId: 'python', name: 'Python', level: 2}]` with no `title`; a skill appearing for the first time at level 1 yields nothing; python crossing into a titled level yields `title` set.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/domain/skills.test.ts`
Expected: FAIL (module `./skills` not found).

- [ ] **Step 3: Add catalog schemas and quest `skills` to `src/domain/schema.ts`; implement `src/domain/skills.ts`**

Area XP is the sum of its skills' XP, levelled with `skillLevelFor`. Title for a skill is the entry with the highest `level <= skill level` among catalog titles for that `skillId`. `xpAtLevel` uses the closed form `100*(L-1) + 15*(L-1)*(L-2)`; `skillLevelFor` solves for the level with a loop or the quadratic, floor-safe either way.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/domain/skills.test.ts` → PASS. Run `npx tsc --noEmit`; fix every `ClassDef` literal that now needs `skills` (expect `src/domain/test-fixtures.ts` only; set `skills: []` in its `q()` helper for now).

- [ ] **Step 5: Commit**

```bash
git add src/domain/schema.ts src/domain/skills.ts src/domain/skills.test.ts src/domain/test-fixtures.ts
git commit -m "feat(skills): add uncapped skill level curve and catalog schema"
```

### Task 2: Events snapshot the credited skills

**Files:**
- Modify: `src/domain/schema.ts` (events), `src/domain/commands.ts`
- Modify: `src/domain/test-fixtures.ts` (tags on the test class, `testCatalog`)
- Modify: `src/domain/game.test.ts` (new `describe('skill snapshots')`)

**Interfaces:**
- Consumes: `QuestDef.skills` (Task 1).
- Produces: optional `skills?: string[]` on `session_logged` and `quest_completed` events. `logSession` and `completeQuest` set `skills: quest.skills` only when `quest.skills.length > 0`. `test-fixtures.ts` exports `testCatalog: SkillCatalog` with area `eng` ("Engineering"), skills `python`, `ml`, `ops` (all `eng`), and title `{skillId: 'python', level: 2, title: 'Pythonista'}`; test class quest tags: `a: ['python']`, `b: ['python', 'ml']`, `boss1: ['ml']`, `c: ['ops']`, `side: ['python']`. Make the `q()` helper take a `skills: string[]` argument.

- [ ] **Step 1: Write the failing tests** (in `game.test.ts`, using the existing `play`/`completeWithEvidence`/`must`/`tick` helpers)
  - `logSession snapshots the quest tags`: the event from `logSession(g, testClass, 'b', 2, undefined, tick())` has `skills` equal `['python', 'ml']`.
  - `completeQuest snapshots the quest tags`: after evidence on `boss1`'s prerequisites, the `quest_completed` event for `boss1` has `skills` equal `['ml']`.
  - `quests without tags leave the field out`: build a copy of `testClass` whose quest `a` has `skills: []`; the `session_logged` event has no `skills` key (`'skills' in event === false`).
  - `old events still validate`: `eventSchema.safeParse` succeeds for a `quest_completed` object without `skills`, and fails when `skills` is `[""]`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/domain/game.test.ts -t "skill snapshots"` → FAIL.

- [ ] **Step 3: Implement**

Add `skills: z.array(z.string().min(1)).optional()` to both event objects; spread `...(quest.skills.length > 0 ? { skills: quest.skills } : {})` in `logSession` and `completeQuest`; update fixtures.

- [ ] **Step 4: Run the whole domain suite**

Run: `npx vitest run src/domain` → PASS; `npx tsc --noEmit` → no errors.

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "feat(skills): snapshot credited skill ids in session and completion events"
```

### Task 3: Derive skills and areas from the event log

**Files:**
- Modify: `src/domain/derive.ts`
- Modify: `src/domain/game.test.ts` (new `describe('skills')`)

**Interfaces:**
- Consumes: `buildSkills`, `emptyCatalog`, `SkillState`, `AreaState` (Task 1); `skills?` on events and `testCatalog` (Task 2).
- Produces: `deriveGame(classes: readonly ClassDef[], events: readonly GameEvent[], catalog: SkillCatalog = emptyCatalog): GameState`, and `GameState` gains `skills: Record<string, SkillState>` and `areas: Record<string, AreaState>`.

Rules to implement: for `session_logged`, each tag (`e.skills`, else the tags of that quest in the class definition, else none) gains `credited * e.xpPerHour` where `credited` is the existing capped-hours value. For a valid `quest_completed` (the existing guards stay: not already completed, evidence present, prerequisites met), remember the tags on the completion; after the replay, every quest that still has a completion adds `completion.xp` to each of its tags. `quest_undone` already clears the completion, which removes only that share. Then `buildSkills(catalog, xpBySkill)`. Iterate the working state, not the class definitions, so XP of removed classes survives.

- [ ] **Step 1: Write the failing tests** (all with `classes = [testClass]` and `deriveGame(classes, log, testCatalog)`)
  - `completion credits every tag in full`: complete `a` (60 XP) → `skills.python.xp === 60`, level 1; complete `b` (tags python, ml) → `skills.python.xp === 120`, `level === 2`, `xpIntoLevel === 20`, `xpForNextLevel === 130`, `title === 'Pythonista'`; `skills.ml.xp === 60`; `areas.eng.xp === 180`.
  - `boss completion`: after `a`, `b`, `boss1` → `skills.ml.xp === 240`, `level === 3`, `xpIntoLevel === 10`.
  - `sessions credit tags and respect the hour cap`: log 5 h on `a` (xpPerHour 4) → `skills.python.xp === 20`; log 20 h more → total credited hours stop at 15 so `skills.python.xp === 60`.
  - `undo removes only the completion share`: log 5 h on `a`, complete `a`, undo → `skills.python.xp === 20`; complete again → 80; XP never negative.
  - `duplicate completion does not double-credit`: append a second `quest_completed` event for `a` with a new id → `skills.python.xp` unchanged from the single completion.
  - `old events without skills fall back to the quest tags`: build the log with `quest_completed` for `a` having its `skills` key deleted → `skills.python.xp === 60`.
  - `snapshot wins over current tags`: a `quest_completed` for `a` with `skills: ['ml']` → `skills.ml.xp === 60` and `skills.python` is absent.
  - `unknown skill ids do not crash`: a completion with `skills: ['zig']` → `skills.zig.areaId === 'other'`, `areas.other.xp === 60`.
  - `untagged quests change nothing`: with `a` retagged `[]` and no `skills` on the event, `Object.keys(game.skills)` is `[]`.
  - `no catalog, no crash`: `deriveGame(classes, log)` (default catalog) still returns class state identical to before and tags appear under `other`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/domain/game.test.ts -t "skills"` → FAIL.

- [ ] **Step 3: Implement in `derive.ts`**

Extend `ClassWorking` with a map of time XP per skill and `Working.completion` with `skills: string[]`. Keep class XP/gold/stats behavior byte-for-byte unchanged.

- [ ] **Step 4: Run the full suite**

Run: `npm test` → all previous tests plus the new ones PASS; `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "feat(skills): derive skill and area levels from the event log"
```

### Task 4: Content — catalog, tags for the 36 quests, titles

**Files:**
- Create: `src/content/skills.ts`
- Modify: `src/content/ai-engineer.ts`
- Modify: `src/content/ai-engineer.test.ts`

**Interfaces:**
- Consumes: `skillCatalogSchema`, `SkillCatalog` (Task 1).
- Produces: `builtInCatalog: SkillCatalog` (parsed with `skillCatalogSchema.parse`) exported from `src/content/skills.ts`.

Catalog data. Areas: `engineering` "Engineering", `arts` "Arts", `languages` "Languages", `finance` "Finance". Skills (id → name, area): `python` Python, `apis` APIs, `data` Data, `ml` Machine Learning, `llm` LLMs, `cloud` Cloud, `devops` DevOps, `mlops` MLOps, `testing` Testing, `docs` Documentation, `architecture` Architecture, `security` Security (all `engineering`); `english` English (`languages`). Titles (all at level 5): `python` "Python Adept", `llm` "AI Builder", `cloud` "Cloud Ranger", `mlops` "MLOps Architect". Do not touch the class's own `titles` or `xpPerLevel`.

Tags per week (add as `const TAGS: Record<number, string[]>` in `ai-engineer.ts` and set `skills: TAGS[week]` on each quest; a missing week must throw at module load):

| Weeks | Tags |
|---|---|
| 1 | python, testing |
| 2 | python, docs |
| 3 | python, apis, testing |
| 4 | python, data |
| 5 | python, ml |
| 6 | ml, data |
| 7 | ml |
| 8 | ml, docs |
| 9 | python, apis, ml, testing |
| 10 | llm, apis |
| 11 | llm, ml |
| 12, 13 | llm, data |
| 14 | llm, ml |
| 15 | llm, security |
| 16 | llm, apis |
| 17 | apis, security |
| 18 | llm, architecture, docs |
| 19, 22, 23 | cloud, devops |
| 20, 21 | cloud, security |
| 24 | devops, security |
| 25 | devops, docs |
| 26 | cloud, architecture, docs |
| 27, 29 | mlops, data |
| 28, 31, 33 | mlops |
| 30 | mlops, devops |
| 32 | mlops, apis, testing |
| 34 | mlops, architecture, docs |
| 35 | english, docs, architecture |
| 36 | english |

- [ ] **Step 1: Write the failing tests** (in `ai-engineer.test.ts`)
  - `every quest has at least one tag and every tag is in the catalog`.
  - `every catalog title points to an existing skill and every skill points to an existing area`.
  - `each title is reachable from the roadmap alone`: for each of `python`, `llm`, `cloud`, `mlops`, the sum of `q.xp` over quests tagged with it is `>= xpAtLevel(5)` (580). (Expected sums: 800, 1000, 800, 1000.)
  - `week 1 and week 36 tags`: `week-01` skills equal `['python', 'testing']`; `week-36` equals `['english']`.
  - Keep the existing tests untouched (they assert 36 quests, 4,600 XP, official links).

- [ ] **Step 2: Run to verify failure** → `npx vitest run src/content` FAIL.
- [ ] **Step 3: Implement** the catalog file and the tag map.
- [ ] **Step 4: Run** `npx vitest run src/content` → PASS.
- [ ] **Step 5: Commit**

```bash
git add src/content
git commit -m "feat(skills): add skill catalog, titles and tags for the 36 quests"
```

### Task 5: Wire the catalog into the store

**Files:**
- Modify: `src/app/store.ts`, `src/app/services.tsx:48`
- Modify: `src/app/store.test.ts`

**Interfaces:**
- Consumes: `deriveGame(..., catalog)` (Task 3), `builtInCatalog` (Task 4).
- Produces: `new GameStore(classes, storage, catalog: SkillCatalog = emptyCatalog)`; the snapshot's `game` includes `skills` and `areas`. `ServicesProvider` constructs it with `builtInCatalog`.

- [ ] **Step 1: Write the failing test** in `store.test.ts` (follow its existing pattern for completing a quest with `commands`): with `new GameStore([aiEngineerClass], memoryStorage(), builtInCatalog)`, after adding evidence and completing `week-01`, `store.getSnapshot().game.skills.python.xp === 60`, `skills.testing.xp === 60`, `areas.engineering.xp === 120`; a reloaded store over the same storage reports the same values.
- [ ] **Step 2: Run** `npx vitest run src/app/store.test.ts` → FAIL.
- [ ] **Step 3: Implement** (store constructor parameter passed to `deriveGame`; services passes `builtInCatalog`).
- [ ] **Step 4: Run** `npm test` → PASS (existing store and sync tests keep the 2-argument constructor).
- [ ] **Step 5: Commit**

```bash
git add src/app
git commit -m "feat(skills): pass the skill catalog through the game store"
```

### Task 6: Character sheet and level-up moments

**Files:**
- Create: `src/ui/CharacterSheet.tsx`
- Modify: `src/ui/Hub.tsx`, `src/ui/ClassView.tsx:37-38`, `src/ui/Celebration.tsx`, `src/ui/QuestDrawer.tsx` (`log`, `doComplete`), `src/ui/styles.css`
- Modify: `src/ui/App.test.tsx`

**Interfaces:**
- Consumes: `useGame().game.areas/skills` (Task 5), `levelUps` and `SkillLevelUp` (Task 1), existing `XpBar({into, of, label})` from `components.tsx`, `toast(kind, message)` from services.
- Produces: `CharacterSheet()` (no props). `CelebrationData` drops `levelBefore`, `levelAfter`, `newTitle` and gains `skillGains: { name: string; xp: number }[]` and `skillLevelUps: SkillLevelUp[]`.

Behavior:
- `CharacterSheet`: section titled "Character sheet". For each area in `game.areas`, ordered by XP descending: an `h3` with `"{name} · Lv {level}"`, then each of its skills (via `skillIds`) as a row with the name, `Lv {level}`, a progress bar using `xpIntoLevel / xpForNextLevel`, and the title as a chip when present. With no areas: the text "Complete your first quest to start growing skills." Mount it in `Hub` between the hero and the class grid.
- `Hub` class card: remove the level badge, the title line and the "To level" `XpBar`; keep XP total, gold, quests count, stats and the buttons. `ClassView` HUD: replace the badge and `XpBar` with `<span className="chip">{cls.completedCount}/{def.quests.length} quests</span>`. Remove imports left unused.
- `Celebration`: remove the class-level line; render one chip `+{xp} {name}` per `skillGains` entry next to the existing reward chips, and one line `▲ {name} Lv {level}` (plus ` — new title: {title}` when set) per `skillLevelUps` entry, using the existing level-up paragraph style. Sparks and reduce-motion behavior stay as they are.
- `QuestDrawer.doComplete`: snapshot `store.getSnapshot().game` before and after `run(...)`; `skillLevelUps = levelUps(beforeGame, afterGame)`; `skillGains` = for each tag of the quest, `{name: skill display name from afterGame.skills[tag]?.name ?? tag, xp: ev.xp}`. `QuestDrawer.log`: after a successful `run`, call `levelUps` the same way and `toast('success', "{name} reached level {level}")` once per level-up (plus the new title when present).

- [ ] **Step 1: Write the failing tests** in `App.test.tsx`
  - In `renders the hub…`: `screen.getByText('Complete your first quest to start growing skills.')` is present and `screen.queryByText(/^Lv /)` is null.
  - Extend `completes a quest through the UI…`: after clicking Complete, `screen.getByText('+60 Python')` and `screen.getByText('+60 Testing')` are present. After the remount, `screen.getByRole('heading', { name: /Engineering · Lv 1/ })` and `screen.getByText('Python')` are present, and the empty-state text is gone.
  - New test `levels a skill up and tells the player`: through the UI, complete `week-01` (Python 60 XP) and then `week-02` (Python 120 XP); after the second completion assert `screen.getByText(/▲ Python Lv 2/)`.
  - New test `session toast`: complete `week-01` (Python 60 XP), then log 15 manual hours on `week-01` (credited cap 15 h × 4 XP/h = 60 XP, so Python reaches 120) and assert a toast containing `Python reached level 2`.
- [ ] **Step 2: Run** `npx vitest run src/ui/App.test.tsx` → FAIL.
- [ ] **Step 3: Implement** the component, the Hub/ClassView/Celebration/QuestDrawer changes and the styles (`.sheet-area`, `.sheet-skill`, reuse `.bar`, `.chip`, `.level-badge` look; contrast follows the palette in `styles.css`).
- [ ] **Step 4: Run** `npm test` and `npx tsc --noEmit` → PASS / clean.
- [ ] **Step 5: Commit**

```bash
git add src/ui
git commit -m "feat(skills): add hub character sheet and skill level-up celebrations"
```

### Task 7: Docs and end-to-end verification

**Files:**
- Modify: `README.md` (short "Skills" section and roadmap line), `docs/superpowers/specs/2026-10-24-my-life-as-rpg-design.md` (add one line under "Decided by Rafael" pointing to the skills design and noting class level/title are superseded)

- [ ] **Step 1: Update the README and the design pointer.**
- [ ] **Step 2: Run the full checks**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: all tests pass, no type errors, build succeeds.

- [ ] **Step 3: Manual check (the player runs it)**

Run `npm run dev`, complete week 1 with a reflection, and confirm: the celebration shows `+60 Python` and `+60 Testing`; the hub shows an Engineering section with Python and Testing; completing week 2 (python, docs) takes Python to level 2 with the `▲ Python Lv 2` line; the class card and class HUD no longer show a level.

- [ ] **Step 4: Commit**

```bash
git add README.md docs
git commit -m "docs: document skills and character sheet"
```
