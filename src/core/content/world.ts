// The world of Ashvale as data. Everything connects:
//
//   Scavenging finds materials, machinery and old notes
//   → Salvaging breaks machinery into fittings, bearings, springs, magnets
//   → Engineering turns both into parts and tools
//   → Research reads the journal's discoveries and unlocks blueprints,
//     bonuses and the boiler work
//   → Locomotive repairs and improvements change No. 9, speed everything up
//     and open new places to search.

import type { ItemId } from './items';

export type ItemBundle = Partial<Record<ItemId, number>>;

export const SKILL_IDS = ['scavenging', 'engineering', 'salvaging', 'research'] as const;
export type SkillId = (typeof SKILL_IDS)[number];

export const SKILL_NAMES: Record<SkillId, string> = {
  scavenging: 'Scavenging',
  engineering: 'Engineering',
  salvaging: 'Salvaging',
  research: 'Railway Research',
};

export const SKILL_SHORT: Record<SkillId, string> = {
  scavenging: 'Scav',
  engineering: 'Eng',
  salvaging: 'Salv',
  research: 'Res',
};

export const SKILL_BLURB: Record<SkillId, string> = {
  scavenging: 'Search Ashvale for materials, machinery, old notes and clues.',
  engineering: 'Turn materials into parts and tools for No. 9.',
  salvaging: 'Strip recovered machinery for fittings, bearings, springs and magnets.',
  research: 'Study notes and discoveries to unlock blueprints and better methods.',
};

export const MAX_LEVEL = 20;
/** Offline and long-sleep progress is never credited beyond this window. */
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;

// ---------- modifiers ----------

/** Every bonus in the game lands in one of these numbers. */
export interface Modifiers {
  /** Added speed fraction per skill (0.1 = 10% faster). */
  speed: Record<SkillId, number>;
  /** Extra speed for a single location. */
  locationSpeed: Partial<Record<LocationId, number>>;
  /** Multiplier on the chance of rare drops. */
  rareChance: number;
  /** Multiplier on all XP. */
  xp: number;
  /** Chance a salvage action yields double. */
  doubleChance: number;
  /** Chance an action consumes no inputs. */
  saveChance: { engineering: number; research: number };
  /** Extra output per craft for specific recipes. */
  recipeYield: Partial<Record<RecipeId, number>>;
}

export function baseModifiers(): Modifiers {
  return {
    speed: { scavenging: 0, engineering: 0, salvaging: 0, research: 0 },
    locationSpeed: {},
    rareChance: 1,
    xp: 1,
    doubleChance: 0,
    saveChance: { engineering: 0, research: 0 },
    recipeYield: {},
  };
}

// ---------- Scavenging locations ----------

export const LOCATION_IDS = ['derelictPlatform', 'signalCabinet', 'maintenanceShed'] as const;
export type LocationId = (typeof LOCATION_IDS)[number];

export interface DropDef {
  item: ItemId;
  /** Probability (0–1) per action. */
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
  repairRequired?: RepairId;
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
      { item: 'waterloggedNotes', chance: 0.2, min: 1, max: 1 },
      { item: 'brokenLantern', chance: 0.08, min: 1, max: 1 },
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
      { item: 'waterloggedNotes', chance: 0.3, min: 1, max: 2 },
      { item: 'signalRelay', chance: 0.2, min: 1, max: 1 },
      { item: 'telegraphSet', chance: 0.14, min: 1, max: 1 },
      { item: 'brassCog', chance: 0.06, min: 1, max: 1 },
      { item: 'deadDynamo', chance: 0.02, min: 1, max: 1 },
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
      { item: 'waterloggedNotes', chance: 0.2, min: 1, max: 2 },
      { item: 'seizedPump', chance: 0.14, min: 1, max: 1 },
      { item: 'brassCog', chance: 0.12, min: 1, max: 1 },
      { item: 'pressureGauge', chance: 0.035, min: 1, max: 1 },
      { item: 'deadDynamo', chance: 0.03, min: 1, max: 1 },
    ],
  },
};

// ---------- Salvaging targets ----------

export const SALVAGE_IDS = ['scrapWagon', 'brokenLantern', 'telegraphSet', 'seizedPump', 'deadDynamo'] as const;
export type SalvageId = (typeof SALVAGE_IDS)[number];

export interface SalvageDef {
  id: SalvageId;
  name: string;
  description: string;
  /** Consumed per action; absent for fixed wrecks that never run out. */
  input?: ItemBundle;
  actionMs: number;
  xp: number;
  levelRequired: number;
  drops: DropDef[];
}

export const SALVAGE: Record<SalvageId, SalvageDef> = {
  scrapWagon: {
    id: 'scrapWagon',
    name: 'Scrap Wagon',
    description: 'A derailed wagon in the siding. Endless iron, and the odd fitting rattling loose.',
    actionMs: 3500,
    xp: 9,
    levelRequired: 1,
    drops: [
      { item: 'scrapIron', chance: 1, min: 1, max: 2 },
      { item: 'brassFitting', chance: 0.15, min: 1, max: 1 },
      { item: 'steelRivets', chance: 0.1, min: 1, max: 1 },
      { item: 'bearing', chance: 0.06, min: 1, max: 1 },
    ],
  },
  brokenLantern: {
    id: 'brokenLantern',
    name: 'Broken Lantern',
    description: 'Unscrew the chimney, save the glass, keep the brass.',
    input: { brokenLantern: 1 },
    actionMs: 3000,
    xp: 16,
    levelRequired: 2,
    drops: [
      { item: 'glassShard', chance: 1, min: 2, max: 3 },
      { item: 'brassFitting', chance: 0.65, min: 1, max: 1 },
      { item: 'copperWire', chance: 0.4, min: 1, max: 1 },
    ],
  },
  telegraphSet: {
    id: 'telegraphSet',
    name: 'Telegraph Set',
    description: 'Contacts, coils and hair-fine springs from a signal-box sounder.',
    input: { telegraphSet: 1 },
    actionMs: 4000,
    xp: 26,
    levelRequired: 5,
    drops: [
      { item: 'copperWire', chance: 1, min: 2, max: 3 },
      { item: 'brassFitting', chance: 0.45, min: 1, max: 1 },
      { item: 'signalRelay', chance: 0.35, min: 1, max: 1 },
      { item: 'spring', chance: 0.3, min: 1, max: 1 },
    ],
  },
  seizedPump: {
    id: 'seizedPump',
    name: 'Seized Pump',
    description: 'Crack the rust, free the shaft, and the good parts fall out.',
    input: { seizedPump: 1 },
    actionMs: 5000,
    xp: 38,
    levelRequired: 8,
    drops: [
      { item: 'bearing', chance: 1, min: 1, max: 2 },
      { item: 'spring', chance: 0.75, min: 1, max: 2 },
      { item: 'steelRivets', chance: 0.6, min: 1, max: 2 },
      { item: 'pressureGauge', chance: 0.05, min: 1, max: 1 },
    ],
  },
  deadDynamo: {
    id: 'deadDynamo',
    name: 'Dead Dynamo',
    description: 'Unwind the field coils. Mind the magnet — it pulls toward the signal.',
    input: { deadDynamo: 1 },
    actionMs: 6500,
    xp: 60,
    levelRequired: 12,
    drops: [
      { item: 'copperWire', chance: 1, min: 3, max: 4 },
      { item: 'magnet', chance: 0.7, min: 1, max: 1 },
      { item: 'copperCoil', chance: 0.4, min: 1, max: 1 },
      { item: 'cyanPrism', chance: 0.04, min: 1, max: 1 },
    ],
  },
};

// ---------- Railway Research ----------

export const PROJECT_IDS = [
  'catalogue',
  'platformSurvey',
  'lostProperty',
  'signalDiagrams',
  'watchMechanism',
  'kilnRecords',
  'stationPhoto',
  'firemansMethods',
  'spurPlans',
  'relayStudy',
  'coldValve',
  'cyanOptics',
] as const;
export type ProjectId = (typeof PROJECT_IDS)[number];

export interface ProjectDef {
  id: ProjectId;
  name: string;
  description: string;
  levelRequired: number;
  /** Discovery that must be in the journal before this can be studied. */
  discoveryRequired?: string;
  /** Number of actions to finish. Absent for the repeatable catalogue. */
  actions?: number;
  input: ItemBundle;
  actionMs: number;
  xp: number;
  /** Short line describing what finishing it does. */
  unlockText: string;
  apply?: (m: Modifiers) => void;
}

export const PROJECTS: Record<ProjectId, ProjectDef> = {
  catalogue: {
    id: 'catalogue',
    name: 'Catalogue the Archive',
    description: 'Dry, flatten and file loose pages. Slow, steady practice.',
    levelRequired: 1,
    input: { waterloggedNotes: 1 },
    actionMs: 3500,
    xp: 9,
    unlockText: 'Repeatable — Research XP for every page filed.',
  },
  platformSurvey: {
    id: 'platformSurvey',
    name: 'Platform Survey',
    description: 'Map the platform against the old timetable’s notes on where things were kept.',
    levelRequired: 1,
    discoveryRequired: 'tornTimetable',
    actions: 10,
    input: { waterloggedNotes: 1 },
    actionMs: 4000,
    xp: 14,
    unlockText: 'Derelict Platform searches 20% faster.',
    apply: (m) => {
      m.locationSpeed.derelictPlatform = (m.locationSpeed.derelictPlatform ?? 0) + 0.2;
    },
  },
  lostProperty: {
    id: 'lostProperty',
    name: 'Lost Property Ledger',
    description: 'Trace the initials E.V. through the station’s lost-property book.',
    levelRequired: 2,
    discoveryRequired: 'knittedMitten',
    actions: 10,
    input: { waterloggedNotes: 1 },
    actionMs: 4000,
    xp: 16,
    unlockText: 'Scavenging 5% faster · Mara has something to tell you.',
    apply: (m) => {
      m.speed.scavenging += 0.05;
    },
  },
  signalDiagrams: {
    id: 'signalDiagrams',
    name: 'Signal Wiring Diagrams',
    description: 'Rebuild the box’s wiring diagrams from the log’s margins.',
    levelRequired: 3,
    discoveryRequired: 'signalLog',
    actions: 14,
    input: { waterloggedNotes: 1 },
    actionMs: 4500,
    xp: 20,
    unlockText: 'Blueprint: Brass Lantern (Scavenging tool, tier 2).',
  },
  watchMechanism: {
    id: 'watchMechanism',
    name: 'Watchmaker’s Escapement',
    description: 'Take the stopped watch apart on paper and learn why it always returns to 3:17.',
    levelRequired: 4,
    discoveryRequired: 'stoppedWatch',
    actions: 14,
    input: { waterloggedNotes: 1 },
    actionMs: 4500,
    xp: 22,
    unlockText: 'Blueprint: Precision Tools (Engineering tool, tier 2).',
  },
  kilnRecords: {
    id: 'kilnRecords',
    name: 'Bottle Works Records',
    description: 'How the kiln men packed fuel to burn all night.',
    levelRequired: 5,
    discoveryRequired: 'kilnToken',
    actions: 16,
    input: { waterloggedNotes: 1 },
    actionMs: 4500,
    xp: 24,
    unlockText: 'Fuel Bricks: each craft makes 2.',
    apply: (m) => {
      m.recipeYield.fuelBrick = (m.recipeYield.fuelBrick ?? 0) + 1;
    },
  },
  stationPhoto: {
    id: 'stationPhoto',
    name: 'The Faded Photograph',
    description: 'Name every face in the staff photograph. All but one.',
    levelRequired: 6,
    discoveryRequired: 'stationPhoto',
    actions: 16,
    input: { waterloggedNotes: 1 },
    actionMs: 5000,
    xp: 26,
    unlockText: 'All XP +5% · Blueprint: Surveyor’s Kit (Research tool, tier 2).',
    apply: (m) => {
      m.xp *= 1.05;
    },
  },
  firemansMethods: {
    id: 'firemansMethods',
    name: 'The Fireman’s Methods',
    description: 'Tobin’s ledger, read properly: how to bring a cold boiler back without cracking it.',
    levelRequired: 7,
    discoveryRequired: 'firemansLedger',
    actions: 20,
    input: { waterloggedNotes: 2 },
    actionMs: 5000,
    xp: 30,
    unlockText: 'Required to rebuild the boiler · Engineering 10% faster.',
    apply: (m) => {
      m.speed.engineering += 0.1;
    },
  },
  spurPlans: {
    id: 'spurPlans',
    name: 'Kiln Spur Plans',
    description: 'Survey drawings for the spur line, and the second line that runs off the page.',
    levelRequired: 8,
    discoveryRequired: 'kilnPlans',
    actions: 20,
    input: { waterloggedNotes: 2 },
    actionMs: 5500,
    xp: 34,
    unlockText: 'Blueprint: Cutting Torch (Salvaging tool, tier 3).',
  },
  relayStudy: {
    id: 'relayStudy',
    name: 'The Humming Relay',
    description: 'Record the relay’s rhythm for a week of nights. It is counting something.',
    levelRequired: 10,
    discoveryRequired: 'hummingRelay',
    actions: 22,
    input: { waterloggedNotes: 2, copperWire: 1 },
    actionMs: 6000,
    xp: 40,
    unlockText: 'Rare finds ×1.15 · enables the Signal Receiver improvement.',
    apply: (m) => {
      m.rareChance *= 1.15;
    },
  },
  coldValve: {
    id: 'coldValve',
    name: 'The Cold Valve',
    description: 'Measure the valve’s quarter-turns against the 3:17 hum.',
    levelRequired: 11,
    discoveryRequired: 'coldValve',
    actions: 22,
    input: { waterloggedNotes: 2 },
    actionMs: 6000,
    xp: 44,
    unlockText: 'Salvaging: +10% chance of a double yield.',
    apply: (m) => {
      m.doubleChance += 0.1;
    },
  },
  cyanOptics: {
    id: 'cyanOptics',
    name: 'Cyan Optics',
    description: 'Grind a test lens from the spare disc and see what the colour is for.',
    levelRequired: 12,
    discoveryRequired: 'cyanDisc',
    actions: 26,
    input: { waterloggedNotes: 2, glassShard: 1 },
    actionMs: 6500,
    xp: 50,
    unlockText: 'Blueprint: Cyan Lantern (Scavenging tool, tier 3).',
  },
};

// ---------- Tools and equipment ----------

/** One tool slot per skill. */
export type ToolId = Extract<
  ItemId,
  'pryBar' | 'hacksaw' | 'readingGlass' | 'benchVice' | 'brassLantern' | 'spannerSet' | 'precisionTools' | 'surveyorsKit' | 'cuttingTorch' | 'cyanLantern'
>;

export interface ToolDef {
  id: ToolId;
  skill: SkillId;
  tier: 1 | 2 | 3;
  /** Skill level needed to equip. */
  levelRequired: number;
  bonusText: string;
  apply: (m: Modifiers) => void;
}

export const TOOLS: Record<ToolId, ToolDef> = {
  pryBar: { id: 'pryBar', skill: 'scavenging', tier: 1, levelRequired: 1, bonusText: '+10% speed', apply: (m) => void (m.speed.scavenging += 0.1) },
  brassLantern: {
    id: 'brassLantern',
    skill: 'scavenging',
    tier: 2,
    levelRequired: 6,
    bonusText: '+15% speed · rare finds ×1.25',
    apply: (m) => {
      m.speed.scavenging += 0.15;
      m.rareChance *= 1.25;
    },
  },
  cyanLantern: {
    id: 'cyanLantern',
    skill: 'scavenging',
    tier: 3,
    levelRequired: 12,
    bonusText: '+25% speed · rare finds ×1.5',
    apply: (m) => {
      m.speed.scavenging += 0.25;
      m.rareChance *= 1.5;
    },
  },
  hacksaw: { id: 'hacksaw', skill: 'salvaging', tier: 1, levelRequired: 1, bonusText: '+10% speed', apply: (m) => void (m.speed.salvaging += 0.1) },
  spannerSet: {
    id: 'spannerSet',
    skill: 'salvaging',
    tier: 2,
    levelRequired: 6,
    bonusText: '+20% speed · 10% double yield',
    apply: (m) => {
      m.speed.salvaging += 0.2;
      m.doubleChance += 0.1;
    },
  },
  cuttingTorch: {
    id: 'cuttingTorch',
    skill: 'salvaging',
    tier: 3,
    levelRequired: 12,
    bonusText: '+30% speed · 20% double yield',
    apply: (m) => {
      m.speed.salvaging += 0.3;
      m.doubleChance += 0.2;
    },
  },
  benchVice: { id: 'benchVice', skill: 'engineering', tier: 1, levelRequired: 1, bonusText: '+10% speed', apply: (m) => void (m.speed.engineering += 0.1) },
  precisionTools: {
    id: 'precisionTools',
    skill: 'engineering',
    tier: 2,
    levelRequired: 8,
    bonusText: '+20% speed · 10% chance to keep materials',
    apply: (m) => {
      m.speed.engineering += 0.2;
      m.saveChance.engineering += 0.1;
    },
  },
  readingGlass: { id: 'readingGlass', skill: 'research', tier: 1, levelRequired: 1, bonusText: '+15% speed', apply: (m) => void (m.speed.research += 0.15) },
  surveyorsKit: {
    id: 'surveyorsKit',
    skill: 'research',
    tier: 2,
    levelRequired: 7,
    bonusText: '+25% speed · 15% chance to keep notes',
    apply: (m) => {
      m.speed.research += 0.25;
      m.saveChance.research += 0.15;
    },
  },
};

export const TOOL_IDS = Object.keys(TOOLS) as ToolId[];

export function isTool(id: ItemId): id is ToolId {
  return id in TOOLS;
}

// ---------- Engineering recipes ----------

export const RECIPE_IDS = [
  'ironPlate',
  'fuelBrick',
  'polishedLens',
  'copperCoil',
  'timberBeam',
  'patchPanel',
  'gaugeAssembly',
  'pryBar',
  'hacksaw',
  'readingGlass',
  'benchVice',
  'brassLantern',
  'spannerSet',
  'surveyorsKit',
  'precisionTools',
  'cuttingTorch',
  'cyanLantern',
] as const;
export type RecipeId = (typeof RECIPE_IDS)[number];

export type RecipeCategory = 'parts' | 'tools';

export interface RecipeDef {
  id: RecipeId;
  category: RecipeCategory;
  tier: 1 | 2 | 3;
  output: ItemId;
  outputQty: number;
  inputs: ItemBundle;
  actionMs: number;
  xp: number;
  levelRequired: number;
  /** Research project that must be finished first (blueprints). */
  research?: ProjectId;
}

export const RECIPES: Record<RecipeId, RecipeDef> = {
  // Parts
  ironPlate: { id: 'ironPlate', category: 'parts', tier: 1, output: 'ironPlate', outputQty: 1, inputs: { scrapIron: 3 }, actionMs: 3000, xp: 8, levelRequired: 1 },
  fuelBrick: { id: 'fuelBrick', category: 'parts', tier: 1, output: 'fuelBrick', outputQty: 1, inputs: { coalLump: 3 }, actionMs: 3000, xp: 8, levelRequired: 1 },
  polishedLens: { id: 'polishedLens', category: 'parts', tier: 1, output: 'polishedLens', outputQty: 1, inputs: { glassShard: 3, coalLump: 1 }, actionMs: 4000, xp: 14, levelRequired: 2 },
  copperCoil: { id: 'copperCoil', category: 'parts', tier: 1, output: 'copperCoil', outputQty: 1, inputs: { copperWire: 4 }, actionMs: 4000, xp: 14, levelRequired: 2 },
  timberBeam: { id: 'timberBeam', category: 'parts', tier: 2, output: 'timberBeam', outputQty: 1, inputs: { oakTimber: 3 }, actionMs: 4500, xp: 20, levelRequired: 4 },
  patchPanel: { id: 'patchPanel', category: 'parts', tier: 2, output: 'patchPanel', outputQty: 1, inputs: { ironPlate: 2, steelRivets: 3 }, actionMs: 5500, xp: 30, levelRequired: 7 },
  gaugeAssembly: {
    id: 'gaugeAssembly',
    category: 'parts',
    tier: 3,
    output: 'gaugeAssembly',
    outputQty: 1,
    inputs: { pressureGauge: 1, copperCoil: 2, brassCog: 2, spring: 1 },
    actionMs: 8000,
    xp: 60,
    levelRequired: 10,
  },
  // Tools
  pryBar: { id: 'pryBar', category: 'tools', tier: 1, output: 'pryBar', outputQty: 1, inputs: { ironPlate: 2, scrapIron: 4 }, actionMs: 4000, xp: 15, levelRequired: 2 },
  hacksaw: { id: 'hacksaw', category: 'tools', tier: 1, output: 'hacksaw', outputQty: 1, inputs: { ironPlate: 2, brassFitting: 1 }, actionMs: 4000, xp: 15, levelRequired: 2 },
  readingGlass: { id: 'readingGlass', category: 'tools', tier: 1, output: 'readingGlass', outputQty: 1, inputs: { polishedLens: 1, brassFitting: 2 }, actionMs: 4500, xp: 18, levelRequired: 3 },
  benchVice: { id: 'benchVice', category: 'tools', tier: 1, output: 'benchVice', outputQty: 1, inputs: { ironPlate: 4, bearing: 1 }, actionMs: 4500, xp: 18, levelRequired: 4 },
  brassLantern: {
    id: 'brassLantern',
    category: 'tools',
    tier: 2,
    output: 'brassLantern',
    outputQty: 1,
    inputs: { polishedLens: 2, brassFitting: 3, copperCoil: 1 },
    actionMs: 6000,
    xp: 40,
    levelRequired: 6,
    research: 'signalDiagrams',
  },
  spannerSet: {
    id: 'spannerSet',
    category: 'tools',
    tier: 2,
    output: 'spannerSet',
    outputQty: 1,
    inputs: { ironPlate: 3, bearing: 2, spring: 2 },
    actionMs: 6000,
    xp: 40,
    levelRequired: 7,
  },
  surveyorsKit: {
    id: 'surveyorsKit',
    category: 'tools',
    tier: 2,
    output: 'surveyorsKit',
    outputQty: 1,
    inputs: { polishedLens: 2, timberBeam: 2, brassFitting: 3 },
    actionMs: 6000,
    xp: 44,
    levelRequired: 8,
    research: 'stationPhoto',
  },
  precisionTools: {
    id: 'precisionTools',
    category: 'tools',
    tier: 2,
    output: 'precisionTools',
    outputQty: 1,
    inputs: { spring: 3, brassCog: 2, bearing: 2 },
    actionMs: 7000,
    xp: 50,
    levelRequired: 9,
    research: 'watchMechanism',
  },
  cuttingTorch: {
    id: 'cuttingTorch',
    category: 'tools',
    tier: 3,
    output: 'cuttingTorch',
    outputQty: 1,
    inputs: { fuelBrick: 6, copperCoil: 2, pressureGauge: 1, brassFitting: 4 },
    actionMs: 9000,
    xp: 90,
    levelRequired: 13,
    research: 'spurPlans',
  },
  cyanLantern: {
    id: 'cyanLantern',
    category: 'tools',
    tier: 3,
    output: 'cyanLantern',
    outputQty: 1,
    inputs: { cyanPrism: 2, brassFitting: 4, copperCoil: 2, magnet: 1 },
    actionMs: 9000,
    xp: 100,
    levelRequired: 15,
    research: 'cyanOptics',
  },
};

// ---------- Locomotive: repairs and improvements ----------

export const REPAIR_IDS = ['fireboxDoor', 'headlamp', 'dryCab', 'reinforcedStorage', 'boiler'] as const;
export type RepairId = (typeof REPAIR_IDS)[number];

export const IMPROVEMENT_IDS = ['cabLanterns', 'tenderWinch', 'signalReceiver'] as const;
export type ImprovementId = (typeof IMPROVEMENT_IDS)[number];

export const TRAIN_PART_IDS = [...REPAIR_IDS, ...IMPROVEMENT_IDS] as const;
export type TrainPartId = (typeof TRAIN_PART_IDS)[number];

export interface RepairDef {
  id: TrainPartId;
  kind: 'repair' | 'improvement';
  name: string;
  description: string;
  doneText: string;
  benefit: string;
  /** Engineering level. */
  levelRequired: number;
  cost: ItemBundle;
  /** Train parts that must be done first. */
  requires?: TrainPartId[];
  /** Research project that must be finished first. */
  research?: ProjectId;
  apply: (m: Modifiers) => void;
}

export const REPAIRS: Record<TrainPartId, RepairDef> = {
  fireboxDoor: {
    id: 'fireboxDoor',
    kind: 'repair',
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
    kind: 'repair',
    name: 'Headlamp',
    description: 'A cracked lamp housing, its reflector black with soot.',
    doneText: 'A clean white beam runs down the line and stops dead at the fog.',
    benefit: 'Rare finds 50% more likely',
    levelRequired: 3,
    cost: { polishedLens: 3, copperCoil: 3, signalRelay: 2, brassFitting: 2 },
    apply: (m) => {
      m.rareChance *= 1.5;
    },
  },
  dryCab: {
    id: 'dryCab',
    kind: 'repair',
    name: 'Dry Cab',
    description: 'Rain pours through the cab roof onto the footplate.',
    doneText: 'Tarred oak overhead. The footplate is dry enough to work on.',
    benefit: 'Engineering 20% faster',
    levelRequired: 6,
    cost: { timberBeam: 6, ironPlate: 6, brassFitting: 2 },
    apply: (m) => {
      m.speed.engineering += 0.2;
    },
  },
  reinforcedStorage: {
    id: 'reinforcedStorage',
    kind: 'repair',
    name: 'Reinforced Tender',
    description: 'The tender is a rust-eaten shell. Nothing could be carried in it.',
    doneText: 'Riveted panels, a tarp and stacked crates. No. 9 could carry a town.',
    benefit: 'All XP +15%',
    levelRequired: 9,
    cost: { patchPanel: 5, timberBeam: 4, bearing: 4 },
    apply: (m) => {
      m.xp *= 1.15;
    },
  },
  boiler: {
    id: 'boiler',
    kind: 'repair',
    name: 'Boiler Components',
    description: 'Seized valves, a dead gauge and a jacket full of holes.',
    doneText: 'Steam. Pressure. A heartbeat in the iron.',
    benefit: 'Every activity 10% faster · completes Chapter One',
    levelRequired: 12,
    cost: { gaugeAssembly: 2, patchPanel: 4, fuelBrick: 10, cyanPrism: 1, spring: 4 },
    research: 'firemansMethods',
    apply: (m) => {
      m.speed.scavenging += 0.1;
      m.speed.engineering += 0.1;
      m.speed.salvaging += 0.1;
      m.speed.research += 0.1;
    },
  },
  cabLanterns: {
    id: 'cabLanterns',
    kind: 'improvement',
    name: 'Cab Lanterns',
    description: 'Brass lamps hung in the dry cab, so the footplate can be a reading room at night.',
    doneText: 'Warm light in every window. Mara has started leaving her log up here.',
    benefit: 'Research 20% faster',
    levelRequired: 7,
    cost: { brassFitting: 4, polishedLens: 2, fuelBrick: 3 },
    requires: ['dryCab'],
    apply: (m) => {
      m.speed.research += 0.2;
    },
  },
  tenderWinch: {
    id: 'tenderWinch',
    kind: 'improvement',
    name: 'Tender Winch',
    description: 'A hand winch on the tender to haul wrecks and crates aboard.',
    doneText: 'Crates and cases lashed down. Heavy machinery comes aboard in one lift.',
    benefit: 'Salvaging 20% faster · +5% double yield',
    levelRequired: 10,
    cost: { bearing: 4, spring: 4, steelRivets: 8, timberBeam: 2 },
    requires: ['reinforcedStorage'],
    apply: (m) => {
      m.speed.salvaging += 0.2;
      m.doubleChance += 0.05;
    },
  },
  signalReceiver: {
    id: 'signalReceiver',
    kind: 'improvement',
    name: 'Signal Receiver',
    description: 'A relay, coils and magnets wired to the cab — tuned to the cyan signal’s hum.',
    doneText: 'The receiver lights cyan in time with the signal. Something down the line answers.',
    benefit: 'Rare finds ×1.25 · all XP +10% · completes Night Works',
    levelRequired: 14,
    cost: { magnet: 3, copperCoil: 4, signalRelay: 4, cyanPrism: 1 },
    requires: ['boiler'],
    research: 'relayStudy',
    apply: (m) => {
      m.rareChance *= 1.25;
      m.xp *= 1.1;
    },
  },
};
