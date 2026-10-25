import type { QuestDef } from './schema';

// Share of a quest's value earned by logged time (at the estimated hours) vs. by completing it.
export const TIME_SHARE = 0.4;
export const COMPLETION_SHARE = 0.6;
// Hours beyond the estimate keep counting up to this multiple (max +20 % bonus).
export const HOUR_CAP_MULTIPLIER = 1.5;
// Map progress stops here until the quest is completed with evidence.
export const MAP_PROGRESS_CAP = 0.9;

export const STAT_GAIN = 2;
export const BOSS_PRIMARY_GAIN = 5;
export const BOSS_OTHER_GAIN = 1;

export function questGold(quest: QuestDef): number {
  return quest.xp / 2;
}

export function timeRates(quest: QuestDef) {
  return {
    xpPerHour: (TIME_SHARE * quest.xp) / quest.estimatedHours,
    goldPerHour: (TIME_SHARE * questGold(quest)) / quest.estimatedHours,
    hourCap: HOUR_CAP_MULTIPLIER * quest.estimatedHours,
  };
}

export function completionReward(quest: QuestDef, statIds: readonly string[]) {
  const stats: Record<string, number> = {};
  if (quest.boss) {
    for (const s of statIds) stats[s] = BOSS_OTHER_GAIN;
    stats[quest.stat] = BOSS_PRIMARY_GAIN;
  } else {
    stats[quest.stat] = STAT_GAIN;
  }
  return {
    xp: Math.round(COMPLETION_SHARE * quest.xp),
    gold: Math.round(COMPLETION_SHARE * questGold(quest)),
    stats,
  };
}

export function levelFor(xp: number, xpPerLevel: number) {
  const whole = Math.floor(xp + 1e-9);
  const level = 1 + Math.floor(whole / xpPerLevel);
  return { level, xpIntoLevel: whole - (level - 1) * xpPerLevel, xpForNextLevel: xpPerLevel };
}
