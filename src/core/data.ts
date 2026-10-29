// Static game content. Everything here is plain data so new resources,
// locations and repairs can be added without touching the game rules.

export const RESOURCE_IDS = ['scrapIron', 'copperWire', 'brassCog'] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];

export interface ResourceDef {
  id: ResourceId;
  name: string;
  description: string;
}

export const RESOURCES: Record<ResourceId, ResourceDef> = {
  scrapIron: {
    id: 'scrapIron',
    name: 'Scrap Iron',
    description: 'Flaking plate and bent bolts. Heavy, honest metal.',
  },
  copperWire: {
    id: 'copperWire',
    name: 'Copper Wire',
    description: 'Stripped from the old signal boxes. Still bright underneath.',
  },
  brassCog: {
    id: 'brassCog',
    name: 'Brass Cog',
    description: 'A tooth-perfect gear. Someone hid it well.',
  },
};

export interface DropDef {
  resource: ResourceId;
  /** Probability (0–1) that this drop happens on a single search. */
  chance: number;
  min: number;
  max: number;
}

export const LOCATION_IDS = ['derelictPlatform'] as const;
export type LocationId = (typeof LOCATION_IDS)[number];

export interface LocationDef {
  id: LocationId;
  name: string;
  description: string;
  /** Base duration of one search, in milliseconds. */
  actionMs: number;
  xpPerAction: number;
  levelRequired: number;
  drops: DropDef[];
}

export const LOCATIONS: Record<LocationId, LocationDef> = {
  derelictPlatform: {
    id: 'derelictPlatform',
    name: 'Derelict Platform',
    description: 'Siding 9. The lamps still hum, though no one has waited here in years.',
    actionMs: 3000,
    xpPerAction: 10,
    levelRequired: 1,
    drops: [
      { resource: 'scrapIron', chance: 1, min: 1, max: 2 },
      { resource: 'copperWire', chance: 0.35, min: 1, max: 1 },
      { resource: 'brassCog', chance: 0.04, min: 1, max: 1 },
    ],
  },
};

export const REPAIR_IDS = ['fireboxDoor'] as const;
export type RepairId = (typeof REPAIR_IDS)[number];

export interface RepairDef {
  id: RepairId;
  name: string;
  description: string;
  levelRequired: number;
  cost: Partial<Record<ResourceId, number>>;
  /** Multiplier applied to scavenging speed once repaired (0.1 = 10% faster). */
  scavengeSpeedBonus: number;
  rewardText: string;
}

export const REPAIRS: Record<RepairId, RepairDef> = {
  fireboxDoor: {
    id: 'fireboxDoor',
    name: 'Firebox Door',
    description: 'The locomotive’s firebox hangs open, cold and rusted through.',
    levelRequired: 5,
    cost: { scrapIron: 20, copperWire: 8, brassCog: 1 },
    scavengeSpeedBonus: 0.1,
    rewardText: 'The firebox glows again. Searches are 10% faster by its light.',
  },
};

export const MAX_LEVEL = 20;

/** Offline and long-sleep progress is never credited beyond this window. */
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
