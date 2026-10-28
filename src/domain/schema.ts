import { z } from 'zod';

// Class definitions: the content of a "class" (AI Engineer, Guitar, ...).
// Kept as data so later versions can import them from LLM-generated files.

export const BIOMES = ['meadow', 'forest', 'peaks', 'citadel', 'harbor'] as const;
export type Biome = (typeof BIOMES)[number];

export const resourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
});

export const statSchema = z.object({
  id: z.string().regex(/^[A-Z]{2,6}$/),
  name: z.string().min(1),
  description: z.string(),
});

export const chapterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  subtitle: z.string(),
  biome: z.enum(BIOMES),
});

export const questSchema = z.object({
  id: z.string().min(1),
  chapterId: z.string().min(1),
  week: z.number().int().positive().optional(),
  title: z.string().min(1),
  stat: z.string().min(1),
  xp: z.number().int().positive(),
  boss: z.boolean(),
  side: z.boolean().default(false),
  estimatedHours: z.number().positive(),
  prerequisites: z.array(z.string()),
  acceptance: z.string().min(1),
  evidenceHint: z.string().min(1),
  resources: z.array(resourceSchema),
  // Skill ids this quest trains; each one receives the quest's full XP.
  skills: z.array(z.string().min(1)).default([]),
});

// Skills are global (shared by every class); areas group them on the character sheet.
export const areaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

export const skillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  areaId: z.string().min(1),
});

export const skillTitleSchema = z.object({
  skillId: z.string().min(1),
  level: z.number().int().positive(),
  title: z.string().min(1),
});

export const skillCatalogSchema = z.object({
  areas: z.array(areaSchema),
  skills: z.array(skillSchema),
  titles: z.array(skillTitleSchema),
});

export type AreaDef = z.infer<typeof areaSchema>;
export type SkillDef = z.infer<typeof skillSchema>;
export type SkillTitleDef = z.infer<typeof skillTitleSchema>;
export type SkillCatalog = z.infer<typeof skillCatalogSchema>;

export const titleSchema = z.object({
  level: z.number().int().positive(),
  title: z.string().min(1),
});

export const classSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    icon: z.string().min(1),
    xpPerLevel: z.number().int().positive(),
    titles: z.array(titleSchema),
    stats: z.array(statSchema).min(1),
    chapters: z.array(chapterSchema).min(1),
    quests: z.array(questSchema).min(1),
  })
  .superRefine((def, ctx) => {
    const questIds = new Set(def.quests.map((q) => q.id));
    const chapterIds = new Set(def.chapters.map((c) => c.id));
    const statIds = new Set(def.stats.map((s) => s.id));
    if (questIds.size !== def.quests.length) ctx.addIssue({ code: 'custom', message: 'Duplicate quest id' });
    for (const q of def.quests) {
      if (!chapterIds.has(q.chapterId)) ctx.addIssue({ code: 'custom', message: `Quest ${q.id}: unknown chapter ${q.chapterId}` });
      if (!statIds.has(q.stat)) ctx.addIssue({ code: 'custom', message: `Quest ${q.id}: unknown stat ${q.stat}` });
      for (const p of q.prerequisites) {
        if (!questIds.has(p)) ctx.addIssue({ code: 'custom', message: `Quest ${q.id}: unknown prerequisite ${p}` });
      }
    }
  });

export type ClassDef = z.infer<typeof classSchema>;
export type QuestDef = z.infer<typeof questSchema>;
export type ChapterDef = z.infer<typeof chapterSchema>;
export type StatDef = z.infer<typeof statSchema>;

// Events: the append-only log that is the single source of truth for progress.
// Reward values are snapshotted so later class edits never rewrite history.

const base = {
  id: z.string().min(1),
  at: z.string().datetime(),
};

export const LINK_PATTERN = /^https?:\/\/\S+\.\S+/;

// The link rule lives in the schema so imported backups and synced rows obey it too.
export const evidenceSchema = z
  .object({
    kind: z.enum(['link', 'text', 'file']),
    value: z.string().min(1).max(4000),
    name: z.string().max(200).optional(),
  })
  .refine((e) => e.kind !== 'link' || LINK_PATTERN.test(e.value), { message: 'Links must start with http:// or https://' });
export type Evidence = z.infer<typeof evidenceSchema>;

export const eventSchema = z.discriminatedUnion('type', [
  z.object({
    ...base,
    type: z.literal('session_logged'),
    classId: z.string(),
    questId: z.string(),
    hours: z.number().positive().max(24),
    note: z.string().optional(),
    xpPerHour: z.number().nonnegative(),
    goldPerHour: z.number().nonnegative(),
    hourCap: z.number().positive(),
  }),
  z.object({
    ...base,
    type: z.literal('evidence_added'),
    classId: z.string(),
    questId: z.string(),
    evidence: evidenceSchema,
  }),
  z.object({
    ...base,
    type: z.literal('evidence_removed'),
    classId: z.string(),
    questId: z.string(),
    evidenceId: z.string(),
  }),
  z.object({
    ...base,
    type: z.literal('quest_completed'),
    classId: z.string(),
    questId: z.string(),
    xp: z.number().nonnegative(),
    gold: z.number().nonnegative(),
    stats: z.record(z.string(), z.number()),
    notes: z.string().optional(),
  }),
  z.object({
    ...base,
    type: z.literal('quest_undone'),
    classId: z.string(),
    questId: z.string(),
  }),
  z.object({
    ...base,
    type: z.literal('profile_updated'),
    name: z.string().min(1).max(40),
  }),
]);

export type GameEvent = z.infer<typeof eventSchema>;
export type EventOf<T extends GameEvent['type']> = Extract<GameEvent, { type: T }>;
