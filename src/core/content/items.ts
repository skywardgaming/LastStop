// Every item in Ashvale. Materials are gathered by Scavenging; components
// are made by Engineering. Both feed the locomotive repairs.

export const ITEM_IDS = [
  // materials
  'scrapIron',
  'coalLump',
  'glassShard',
  'copperWire',
  'brassCog',
  'signalRelay',
  'cyanPrism',
  'oakTimber',
  'steelRivets',
  'pressureGauge',
  // components
  'ironPlate',
  'fuelBrick',
  'polishedLens',
  'copperCoil',
  'timberBeam',
  'patchPanel',
  'gaugeAssembly',
] as const;

export type ItemId = (typeof ITEM_IDS)[number];
export type Rarity = 'common' | 'uncommon' | 'rare';
export type ItemKind = 'material' | 'component';

export interface ItemDef {
  id: ItemId;
  name: string;
  kind: ItemKind;
  rarity: Rarity;
  description: string;
}

export const RARITY_ORDER: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2 };

export const ITEMS: Record<ItemId, ItemDef> = {
  scrapIron: {
    id: 'scrapIron',
    name: 'Scrap Iron',
    kind: 'material',
    rarity: 'common',
    description: 'Flaking plate and bent bolts. Heavy, honest metal.',
  },
  coalLump: {
    id: 'coalLump',
    name: 'Coal Lump',
    kind: 'material',
    rarity: 'common',
    description: 'Kiln coal spilled from an old wagon. Still faintly warm, somehow.',
  },
  glassShard: {
    id: 'glassShard',
    name: 'Glass Shard',
    kind: 'material',
    rarity: 'common',
    description: 'From the broken canopy lights. Rain-polished smooth.',
  },
  copperWire: {
    id: 'copperWire',
    name: 'Copper Wire',
    kind: 'material',
    rarity: 'uncommon',
    description: 'Stripped from the signal runs. Bright underneath the green.',
  },
  brassCog: {
    id: 'brassCog',
    name: 'Brass Cog',
    kind: 'material',
    rarity: 'rare',
    description: 'A tooth-perfect gear. Someone hid it well.',
  },
  signalRelay: {
    id: 'signalRelay',
    name: 'Signal Relay',
    kind: 'material',
    rarity: 'uncommon',
    description: 'A sealed relay from the cabinet. It clicks when no one is touching it.',
  },
  cyanPrism: {
    id: 'cyanPrism',
    name: 'Cyan Prism',
    kind: 'material',
    rarity: 'rare',
    description: 'Glass the exact colour of the far signal. No maker’s mark. Cold as river water.',
  },
  oakTimber: {
    id: 'oakTimber',
    name: 'Oak Timber',
    kind: 'material',
    rarity: 'common',
    description: 'Seasoned sleeper wood from the shed racks. Dry, against all odds.',
  },
  steelRivets: {
    id: 'steelRivets',
    name: 'Steel Rivets',
    kind: 'material',
    rarity: 'uncommon',
    description: 'A tin of rivets, each one wrapped in waxed paper by a careful hand.',
  },
  pressureGauge: {
    id: 'pressureGauge',
    name: 'Pressure Gauge',
    kind: 'material',
    rarity: 'rare',
    description: 'Its needle rests at 3, though nothing is connected to it.',
  },
  ironPlate: {
    id: 'ironPlate',
    name: 'Iron Plate',
    kind: 'component',
    rarity: 'common',
    description: 'Scrap hammered flat and trimmed square.',
  },
  fuelBrick: {
    id: 'fuelBrick',
    name: 'Fuel Brick',
    kind: 'component',
    rarity: 'common',
    description: 'Coal packed tight with clay. Burns long and slow.',
  },
  polishedLens: {
    id: 'polishedLens',
    name: 'Polished Lens',
    kind: 'component',
    rarity: 'uncommon',
    description: 'Shards fused over coal heat and ground until clear.',
  },
  copperCoil: {
    id: 'copperCoil',
    name: 'Copper Coil',
    kind: 'component',
    rarity: 'uncommon',
    description: 'Wire wound tight on a cog spindle. Hums faintly near the signal.',
  },
  timberBeam: {
    id: 'timberBeam',
    name: 'Timber Beam',
    kind: 'component',
    rarity: 'uncommon',
    description: 'Oak planed true and tarred against the rain.',
  },
  patchPanel: {
    id: 'patchPanel',
    name: 'Riveted Panel',
    kind: 'component',
    rarity: 'rare',
    description: 'Two plates riveted into one. Strong enough for a boiler jacket.',
  },
  gaugeAssembly: {
    id: 'gaugeAssembly',
    name: 'Gauge Assembly',
    kind: 'component',
    rarity: 'rare',
    description: 'Gauge, coils and cogs married together. The heart of a working boiler.',
  },
};
