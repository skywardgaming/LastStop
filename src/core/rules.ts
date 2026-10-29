// Derived rules: every bonus, every unlock check, every action's timing.
// Nothing here mutates state.

import { ITEMS, type ItemId } from './content/items';
import { ACHIEVEMENTS } from './content/story';
import {
  baseModifiers,
  LOCATIONS,
  PROJECTS,
  RECIPES,
  REPAIRS,
  SALVAGE,
  SKILL_IDS,
  SKILL_NAMES,
  TOOLS,
  TRAIN_PART_IDS,
  type LocationId,
  type Modifiers,
  type ProjectId,
  type RecipeId,
  type SalvageId,
  type SkillId,
  type ToolId,
  type TrainPartId,
} from './content/world';
import { hasItems, timesAffordable } from './inventory';
import type { Activity, GameState } from './state';
import { levelForXp } from './xp';

export type Access = { ok: true } | { ok: false; reason: string };

// ---------- modifiers ----------

const modCache = new WeakMap<GameState, Modifiers>();

/** All bonuses from repairs, research, equipped tools and feats. */
export function modifiers(state: GameState): Modifiers {
  const hit = modCache.get(state);
  if (hit) return hit;
  const m = baseModifiers();
  for (const id of TRAIN_PART_IDS) if (state.repairs[id]) REPAIRS[id].apply(m);
  for (const id of state.research.done) PROJECTS[id].apply?.(m);
  for (const skill of SKILL_IDS) {
    const tool = state.equipment[skill];
    if (tool) TOOLS[tool].apply(m);
  }
  for (const a of ACHIEVEMENTS) if (a.reward && a.id in state.achievements) a.reward.apply(m);
  modCache.set(state, m);
  return m;
}

export function skillLevel(state: GameState, skill: SkillId): number {
  return levelForXp(state.skills[skill].xp);
}

export function activitySkill(activity: Pick<Activity, 'kind'>): SkillId {
  switch (activity.kind) {
    case 'scavenge':
      return 'scavenging';
    case 'craft':
      return 'engineering';
    case 'salvage':
      return 'salvaging';
    case 'research':
      return 'research';
  }
}

/** A start request: any activity without its timestamp. */
export type ActivitySpec =
  | { kind: 'scavenge'; locationId: LocationId }
  | { kind: 'craft'; recipeId: RecipeId }
  | { kind: 'salvage'; targetId: SalvageId }
  | { kind: 'research'; projectId: ProjectId };

function baseDuration(spec: ActivitySpec): number {
  switch (spec.kind) {
    case 'scavenge':
      return LOCATIONS[spec.locationId].actionMs;
    case 'craft':
      return RECIPES[spec.recipeId].actionMs;
    case 'salvage':
      return SALVAGE[spec.targetId].actionMs;
    case 'research':
      return PROJECTS[spec.projectId].actionMs;
  }
}

export function actionDuration(state: GameState, spec: ActivitySpec): number {
  const m = modifiers(state);
  let speed = m.speed[activitySkill(spec)];
  if (spec.kind === 'scavenge') speed += m.locationSpeed[spec.locationId] ?? 0;
  return Math.max(250, Math.round(baseDuration(spec) / (1 + speed)));
}

export function durationOf(state: GameState, activity: Activity): number {
  return actionDuration(state, activity);
}

export function baseXp(spec: ActivitySpec): number {
  switch (spec.kind) {
    case 'scavenge':
      return LOCATIONS[spec.locationId].xp;
    case 'craft':
      return RECIPES[spec.recipeId].xp;
    case 'salvage':
      return SALVAGE[spec.targetId].xp;
    case 'research':
      return PROJECTS[spec.projectId].xp;
  }
}

export function xpPerAction(state: GameState, spec: ActivitySpec): number {
  return Math.round(baseXp(spec) * modifiers(state).xp);
}

/** Effective chance of a drop after the rare-find bonus. */
export function dropChance(state: GameState, item: ItemId, base: number): number {
  if (ITEMS[item].rarity !== 'rare') return base;
  return Math.min(1, base * modifiers(state).rareChance);
}

// ---------- access checks ----------

export function locationAccess(state: GameState, id: LocationId): Access {
  const loc = LOCATIONS[id];
  if (loc.repairRequired && !state.repairs[loc.repairRequired]) return { ok: false, reason: loc.lockedHint };
  if (loc.discoveryRequired && !(loc.discoveryRequired in state.discoveries)) return { ok: false, reason: loc.lockedHint };
  if (skillLevel(state, 'scavenging') < loc.levelRequired) return { ok: false, reason: `Requires Scavenging level ${loc.levelRequired}.` };
  return { ok: true };
}

export function recipeUnlocked(state: GameState, id: RecipeId): Access {
  const r = RECIPES[id];
  if (r.research && !state.research.done.includes(r.research)) {
    return { ok: false, reason: `Blueprint needed: research “${PROJECTS[r.research].name}”.` };
  }
  if (skillLevel(state, 'engineering') < r.levelRequired) return { ok: false, reason: `Requires Engineering level ${r.levelRequired}.` };
  return { ok: true };
}

export function recipeAccess(state: GameState, id: RecipeId): Access {
  const u = recipeUnlocked(state, id);
  if (!u.ok) return u;
  if (!hasItems(state.inventory, RECIPES[id].inputs)) return { ok: false, reason: 'Not enough materials.' };
  return { ok: true };
}

export function craftableCount(state: GameState, id: RecipeId): number {
  return timesAffordable(state.inventory, RECIPES[id].inputs);
}

export function salvageUnlocked(state: GameState, id: SalvageId): Access {
  const t = SALVAGE[id];
  if (skillLevel(state, 'salvaging') < t.levelRequired) return { ok: false, reason: `Requires Salvaging level ${t.levelRequired}.` };
  return { ok: true };
}

export function salvageAccess(state: GameState, id: SalvageId): Access {
  const u = salvageUnlocked(state, id);
  if (!u.ok) return u;
  const input = SALVAGE[id].input;
  if (input && !hasItems(state.inventory, input)) return { ok: false, reason: `No ${SALVAGE[id].name} to break down. Find one while scavenging.` };
  return { ok: true };
}

/** How many salvage actions the inventory can feed (Infinity for fixed wrecks). */
export function salvageCount(state: GameState, id: SalvageId): number {
  const input = SALVAGE[id].input;
  return input ? timesAffordable(state.inventory, input) : Infinity;
}

export function projectDone(state: GameState, id: ProjectId): boolean {
  return state.research.done.includes(id);
}

export function projectUnlocked(state: GameState, id: ProjectId): Access {
  const p = PROJECTS[id];
  if (p.discoveryRequired && !(p.discoveryRequired in state.discoveries)) {
    return { ok: false, reason: 'Needs a discovery you haven’t made yet.' };
  }
  if (skillLevel(state, 'research') < p.levelRequired) return { ok: false, reason: `Requires Railway Research level ${p.levelRequired}.` };
  return { ok: true };
}

export function researchAccess(state: GameState, id: ProjectId): Access {
  if (projectDone(state, id)) return { ok: false, reason: 'Already finished.' };
  const u = projectUnlocked(state, id);
  if (!u.ok) return u;
  if (!hasItems(state.inventory, PROJECTS[id].input)) return { ok: false, reason: 'Not enough notes to study.' };
  return { ok: true };
}

export function projectProgress(state: GameState, id: ProjectId): [number, number] | null {
  const total = PROJECTS[id].actions;
  if (total === undefined) return null;
  if (projectDone(state, id)) return [total, total];
  return [Math.min(total, state.research.progress[id] ?? 0), total];
}

export function startAccess(state: GameState, spec: ActivitySpec): Access {
  switch (spec.kind) {
    case 'scavenge':
      return locationAccess(state, spec.locationId);
    case 'craft':
      return recipeAccess(state, spec.recipeId);
    case 'salvage':
      return salvageAccess(state, spec.targetId);
    case 'research':
      return researchAccess(state, spec.projectId);
  }
}

// ---------- train ----------

export type RepairBlocker = 'alreadyRepaired' | 'levelTooLow' | 'missingResources' | 'needsPart' | 'needsResearch';

export function repairBlockers(state: GameState, id: TrainPartId): RepairBlocker[] {
  const def = REPAIRS[id];
  const out: RepairBlocker[] = [];
  if (state.repairs[id]) out.push('alreadyRepaired');
  if (def.requires?.some((r) => !state.repairs[r])) out.push('needsPart');
  if (def.research && !state.research.done.includes(def.research)) out.push('needsResearch');
  if (skillLevel(state, 'engineering') < def.levelRequired) out.push('levelTooLow');
  if (!hasItems(state.inventory, def.cost)) out.push('missingResources');
  return out;
}

// ---------- tools ----------

export function toolAccess(state: GameState, id: ToolId): Access {
  const t = TOOLS[id];
  if (skillLevel(state, t.skill) < t.levelRequired) return { ok: false, reason: `Requires ${SKILL_NAMES[t.skill]} level ${t.levelRequired}.` };
  return { ok: true };
}

/** Tools for a skill the player owns (equipped or in the satchel). */
export function ownedTools(state: GameState, skill: SkillId): ToolId[] {
  return (Object.keys(TOOLS) as ToolId[]).filter((id) => TOOLS[id].skill === skill && (state.inventory[id] > 0 || state.equipment[skill] === id));
}
