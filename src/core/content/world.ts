// Locations, recipes and locomotive repairs — the three halves of the loop.
// Scavenging gathers → Engineering refines → Repairs grant bonuses and unlock
// new places to scavenge.

import type { ItemId } from './items';

export type ItemBundle = Partial<Record<ItemId, number>>;
export type SkillId = 'scavenging' | 'engineering';
export const SKILL_IDS: readonly SkillId[] = ['scavenging', 'engineering'];

export const SKILL_NAMES: Record<SkillId, string> = {
  scavenging: 'Scavenging',
  engineering: 'Engineering',
};

export const MAX_LEVEL = 20;
/** Offline and long-sleep progress is never credited beyond this window. */
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;

// ---------- Scavenging locations ----------

export const LOCATION_IDS = ['derelictPlatform', 'signalCabinet', 'maintenanceShed'] as const;
export type LocationId = (typeof LOCATION_IDS)[number];

export interface DropDef {
  item: ItemId;
  /** Probability (0–1) per search. */
  chance: number;
  min: number;
  max: number;
}

export interface LocationDef {
  id: LocationId;
  name: string;
  short: string;
  description: string;
  actionMs: number;
  xp: number;
  levelRequired: number;
  /** Repair that must be complete before this place is reachable. */
  repairRequired?: RepairId;
  /** Discovery (a key item) that must be found first. */
  discoveryRequired?: string;
  lockedHint: string;
  drops: DropDef[];
}

export const LOCATIONS: Record<LocationId, LocationDef> = {
  derelictPlatform: {
    id: 'derelictPlatform',
    name: 'Derelict Platform',
    short: 'Platform',
    description: 'Ashvale’s up platform. The canopy lamps still hum, though no one has waited here in years.',
    actionMs: 3000,
    xp: 10,
    levelRequired: 1,
    lockedHint: '',
    drops: [
      { item: 'scrapIron', chance: 1, min: 1, max: 2 },
      { item: 'coalLump', chance: 0.55, min: 1, max: 2 },
      { item: 'glassShard', chance: 0.4, min: 1, max: 1 },
      { item: 'copperWire', chance: 0.25, min: 1, max: 1 },
      { item: 'brassCog', chance: 0.035, min: 1, max: 1 },
    ],
  },
  signalCabinet: {
    id: 'signalCabinet',
    name: 'Signal Cabinet',
    short: 'Cabinet',
    description: 'A rusted lineside cabinet below the cyan signal. Something inside still ticks.',
    actionMs: 4200,
    xp: 16,
    levelRequired: 3,
    repairRequired: 'fireboxDoor',
    lockedHint: 'Too dark to work the rusted latch. Light the firebox first.',
    drops: [
      { item: 'copperWire', chance: 0.8, min: 1, max: 2 },
      { item: 'glassShard', chance: 0.5, min: 1, max: 2 },
      { item: 'signalRelay', chance: 0.2, min: 1, max: 1 },
      { item: 'brassCog', chance: 0.06, min: 1, max: 1 },
      { item: 'cyanPrism', chance: 0.015, min: 1, max: 1 },
    ],
  },
  maintenanceShed: {
    id: 'maintenanceShed',
    name: 'Maintenance Shed',
    short: 'Shed',
    description: 'Tobin’s shed. Racks of seasoned oak, tins of rivets, and tools hung in careful outlines.',
    actionMs: 5500,
    xp: 26,
    levelRequired: 7,
    discoveryRequired: 'shedKey',
    lockedHint: 'Padlocked. The key must be somewhere near the signal.',
    drops: [
      { item: 'oakTimber', chance: 0.85, min: 1, max: 2 },
      { item: 'scrapIron', chance: 0.6, min: 1, max: 3 },
      { item: 'steelRivets', chance: 0.45, min: 1, max: 2 },
      { item: 'brassCog', chance: 0.12, min: 1, max: 1 },
      { item: 'pressureGauge', chance: 0.035, min: 1, max: 1 },
    ],
  },
};

// ---------- Engineering recipes ----------

export const RECIPE_IDS = [
  'ironPlate',
  'fuelBrick',
  'polishedLens',
  'copperCoil',
  'timberBeam',
  'patchPanel',
  'gaugeAssembly',
] as const;
export type RecipeId = (typeof RECIPE_IDS)[number];

export interface RecipeDef {
  id: RecipeId;
  output: ItemId;
  outputQty: number;
  inputs: ItemBundle;
  actionMs: number;
  xp: number;
  levelRequired: number;
}

export const RECIPES: Record<RecipeId, RecipeDef> = {
  ironPlate: { id: 'ironPlate', output: 'ironPlate', outputQty: 1, inputs: { scrapIron: 3 }, actionMs: 3000, xp: 8, levelRequired: 1 },
  fuelBrick: { id: 'fuelBrick', output: 'fuelBrick', outputQty: 1, inputs: { coalLump: 3 }, actionMs: 3000, xp: 8, levelRequired: 1 },
  polishedLens: {
    id: 'polishedLens',
    output: 'polishedLens',
    outputQty: 1,
    inputs: { glassShard: 3, coalLump: 1 },
    actionMs: 4000,
    xp: 14,
    levelRequired: 2,
  },
  copperCoil: { id: 'copperCoil', output: 'copperCoil', outputQty: 1, inputs: { copperWire: 4 }, actionMs: 4000, xp: 14, levelRequired: 2 },
  timberBeam: { id: 'timberBeam', output: 'timberBeam', outputQty: 1, inputs: { oakTimber: 3 }, actionMs: 4500, xp: 20, levelRequired: 4 },
  patchPanel: {
    id: 'patchPanel',
    output: 'patchPanel',
    outputQty: 1,
    inputs: { ironPlate: 2, steelRivets: 3 },
    actionMs: 5500,
    xp: 30,
    levelRequired: 6,
  },
  gaugeAssembly: {
    id: 'gaugeAssembly',
    output: 'gaugeAssembly',
    outputQty: 1,
    inputs: { pressureGauge: 1, copperCoil: 2, brassCog: 2 },
    actionMs: 8000,
    xp: 60,
    levelRequired: 8,
  },
};

// ---------- Locomotive repairs ----------

export const REPAIR_IDS = ['fireboxDoor', 'headlamp', 'dryCab', 'reinforcedStorage', 'boiler'] as const;
export type RepairId = (typeof REPAIR_IDS)[number];

export interface Modifiers {
  /** Added speed fraction for each skill (0.1 = 10% faster). */
  speed: Record<SkillId, number>;
  /** Multiplier on the chance of rare drops. */
  rareChance: number;
  /** Multiplier on all XP. */
  xp: number;
}

export interface RepairDef {
  id: RepairId;
  name: string;
  description: string;
  doneText: string;
  benefit: string;
  levelRequired: number;
  cost: ItemBundle;
  apply: (m: Modifiers) => void;
}

export const REPAIRS: Record<RepairId, RepairDef> = {
  fireboxDoor: {
    id: 'fireboxDoor',
    name: 'Firebox Door',
    description: 'The firebox hangs open on one hinge, cold and rusted through.',
    doneText: 'Hinged, sealed and glowing. You can see your hands again.',
    benefit: 'Scavenging 10% faster · lights the way to the Signal Cabinet',
    levelRequired: 1,
    cost: { ironPlate: 4, brassCog: 1 },
    apply: (m) => {
      m.speed.scavenging += 0.1;
    },
  },
  headlamp: {
    id: 'headlamp',
    name: 'Headlamp',
    description: 'A cracked lamp housing, its reflector black with soot.',
    doneText: 'A clean white beam runs down the line and stops dead at the fog.',
    benefit: 'Rare finds 50% more likely',
    levelRequired: 3,
    cost: { polishedLens: 2, copperCoil: 2, signalRelay: 1 },
    apply: (m) => {
      m.rareChance *= 1.5;
    },
  },
  dryCab: {
    id: 'dryCab',
    name: 'Dry Cab',
    description: 'Rain pours through the cab roof onto the footplate.',
    doneText: 'Tarred oak overhead. The footplate is dry enough to work on.',
    benefit: 'Engineering 20% faster',
    levelRequired: 5,
    cost: { timberBeam: 4, ironPlate: 3 },
    apply: (m) => {
      m.speed.engineering += 0.2;
    },
  },
  reinforcedStorage: {
    id: 'reinforcedStorage',
    name: 'Reinforced Tender',
    description: 'The tender is a rust-eaten shell. Nothing could be carried in it.',
    doneText: 'Riveted panels, a tarp and stacked crates. No. 9 could carry a town.',
    benefit: 'All XP +15%',
    levelRequired: 7,
    cost: { patchPanel: 3, timberBeam: 2 },
    apply: (m) => {
      m.xp *= 1.15;
    },
  },
  boiler: {
    id: 'boiler',
    name: 'Boiler Components',
    description: 'Seized valves, a dead gauge and a jacket full of holes.',
    doneText: 'Steam. Pressure. A heartbeat in the iron.',
    benefit: 'Every activity 10% faster · completes Chapter One',
    levelRequired: 9,
    cost: { gaugeAssembly: 1, patchPanel: 2, fuelBrick: 6, cyanPrism: 1 },
    apply: (m) => {
      m.speed.scavenging += 0.1;
      m.speed.engineering += 0.1;
    },
  },
};
