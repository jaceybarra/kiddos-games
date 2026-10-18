import { MISSION_ORDER, REWARD_OF, missionById, type DiscoveryId, type MissionId, type RewardId } from '../content/missions';
import type { MissionSummary } from '../core/missionState';
import { COIN_IDS, DISCOVERY_IDS, type SaveData } from './schema';

/**
 * Pure, idempotent changes to the save. Applying the same result twice gives
 * the same save, and the second time reports nothing new — so a refresh, a
 * double tap or a replay can never duplicate a reward or a coin.
 */
export interface Earned {
  newMission: boolean;
  newReward: RewardId | null;
  newDiscovery: DiscoveryId | null;
  newCoins: string[];
}

export function clone(s: SaveData): SaveData {
  return JSON.parse(JSON.stringify(s)) as SaveData;
}

/** Coins found along the way (saved at checkpoints too, so a quit mid-run keeps them). */
export function addCoins(save: SaveData, ids: Iterable<string>): { save: SaveData; added: string[] } {
  const next = clone(save);
  const added: string[] = [];
  for (const id of ids) {
    if (!COIN_IDS.includes(id) || next.progress.coins.includes(id)) continue;
    next.progress.coins.push(id);
    added.push(id);
  }
  return { save: added.length ? next : save, added };
}

export function addDiscovery(save: SaveData, id: string | null): { save: SaveData; added: DiscoveryId | null } {
  if (!id || !(DISCOVERY_IDS as string[]).includes(id) || save.progress.discoveries.includes(id as DiscoveryId)) return { save, added: null };
  const next = clone(save);
  next.progress.discoveries.push(id as DiscoveryId);
  return { save: next, added: id as DiscoveryId };
}

export function applyMissionResult(save: SaveData, result: MissionSummary): { save: SaveData; earned: Earned } {
  const earned: Earned = { newMission: false, newReward: null, newDiscovery: null, newCoins: [] };
  const def = missionById(result.missionId);
  if (!def) return { save, earned };
  let next = clone(save);
  const id = def.id as MissionId;
  if (!next.progress.completed.includes(id)) {
    next.progress.completed = MISSION_ORDER.filter((m) => m === id || next.progress.completed.includes(m));
    earned.newMission = true;
  }
  const reward = REWARD_OF[id];
  if (!next.progress.rewards.includes(reward)) {
    next.progress.rewards.push(reward);
    earned.newReward = reward;
  }
  const c = addCoins(next, result.coins);
  next = c.save;
  earned.newCoins = c.added;
  const d = addDiscovery(next, result.discovery);
  next = d.save;
  earned.newDiscovery = d.added;
  next.progress.started = true;
  // the mission is finished: nothing to continue
  if (next.resume?.missionId === id) next.resume = null;
  return { save: next, earned };
}

/** Which missions can be started: in order, or all of them with the grown-up "open all" setting. */
export function unlockedMissions(save: SaveData): MissionId[] {
  if (save.settings.openAll) return MISSION_ORDER.slice();
  const out: MissionId[] = [];
  for (const m of MISSION_ORDER) {
    out.push(m);
    if (!save.progress.completed.includes(m)) break;
  }
  return out;
}

export function nextMission(save: SaveData): MissionId {
  return MISSION_ORDER.find((m) => !save.progress.completed.includes(m)) ?? MISSION_ORDER[0];
}

export function creatorUnlocked(save: SaveData): boolean {
  return save.settings.openAll || MISSION_ORDER.every((m) => save.progress.completed.includes(m));
}

export function chapterComplete(save: SaveData): boolean {
  return MISSION_ORDER.every((m) => save.progress.completed.includes(m));
}
