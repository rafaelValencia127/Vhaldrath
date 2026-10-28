import { completionReward, timeRates } from './economy';
import type { GameState } from './derive';
import type { EventContext } from './events';
import { LINK_PATTERN, type ClassDef, type EventOf, type Evidence, type QuestDef } from './schema';

// Commands validate intent against the current state and return the event to append.
export type CommandResult<T> = { ok: true; event: T } | { ok: false; error: string };

const fail = (error: string) => ({ ok: false as const, error });
const ok = <T>(event: T) => ({ ok: true as const, event });

// Snapshot the credited skills so later tag edits never rewrite earned XP.
function skillsOf(quest: QuestDef) {
  return quest.skills.length > 0 ? { skills: [...quest.skills] } : {};
}

function questOf(state: GameState, classId: string, questId: string) {
  return state.classes[classId]?.quests[questId];
}

export function logSession(
  state: GameState,
  def: ClassDef,
  questId: string,
  hours: number,
  note: string | undefined,
  ctx: EventContext,
): CommandResult<EventOf<'session_logged'>> {
  const quest = def.quests.find((q) => q.id === questId);
  const qs = questOf(state, def.id, questId);
  if (!quest || !qs) return fail('Unknown quest.');
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) return fail('Hours must be between 0 and 24.');
  if (qs.status === 'locked') return fail('This quest is still locked. Finish its prerequisites first.');
  const trimmed = note?.trim();
  return ok({
    id: ctx.id,
    at: ctx.now,
    type: 'session_logged',
    classId: def.id,
    questId,
    hours: Math.round(hours * 100) / 100,
    ...(trimmed ? { note: trimmed } : {}),
    ...timeRates(quest),
    ...skillsOf(quest),
  });
}

export function addEvidence(
  state: GameState,
  classId: string,
  questId: string,
  evidence: Evidence,
  ctx: EventContext,
): CommandResult<EventOf<'evidence_added'>> {
  if (!questOf(state, classId, questId)) return fail('Unknown quest.');
  const value = evidence.value.trim();
  if (!value) return fail('Evidence cannot be empty.');
  if (evidence.kind === 'link' && !LINK_PATTERN.test(value)) {
    return fail('Links must start with http:// or https://');
  }
  return ok({ id: ctx.id, at: ctx.now, type: 'evidence_added', classId, questId, evidence: { ...evidence, value } });
}

export function removeEvidence(
  state: GameState,
  classId: string,
  questId: string,
  evidenceId: string,
  ctx: EventContext,
): CommandResult<EventOf<'evidence_removed'>> {
  const qs = questOf(state, classId, questId);
  if (!qs?.evidence.some((e) => e.id === evidenceId)) return fail('Evidence not found.');
  return ok({ id: ctx.id, at: ctx.now, type: 'evidence_removed', classId, questId, evidenceId });
}

export function completeQuest(
  state: GameState,
  def: ClassDef,
  questId: string,
  notes: string | undefined,
  ctx: EventContext,
): CommandResult<EventOf<'quest_completed'>> {
  const quest = def.quests.find((q) => q.id === questId);
  const qs = questOf(state, def.id, questId);
  if (!quest || !qs) return fail('Unknown quest.');
  if (qs.status === 'completed') return fail('This quest is already completed.');
  if (qs.status === 'locked') return fail('This quest is still locked. Finish its prerequisites first.');
  if (qs.evidence.length === 0) return fail('Add at least one piece of evidence before completing.');
  const trimmed = notes?.trim();
  return ok({
    id: ctx.id,
    at: ctx.now,
    type: 'quest_completed',
    classId: def.id,
    questId,
    ...completionReward(quest, def.stats.map((s) => s.id)),
    ...(trimmed ? { notes: trimmed } : {}),
    ...skillsOf(quest),
  });
}

export function undoQuest(
  state: GameState,
  classId: string,
  questId: string,
  ctx: EventContext,
): CommandResult<EventOf<'quest_undone'>> {
  if (questOf(state, classId, questId)?.status !== 'completed') return fail('Only completed quests can be undone.');
  return ok({ id: ctx.id, at: ctx.now, type: 'quest_undone', classId, questId });
}

export function updateProfile(name: string, ctx: EventContext): CommandResult<EventOf<'profile_updated'>> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 40) return fail('Name must be 1–40 characters.');
  return ok({ id: ctx.id, at: ctx.now, type: 'profile_updated', name: trimmed });
}
