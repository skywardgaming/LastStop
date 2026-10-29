// Operation Rebirth asset pack (Astra, v1.0) — registry and loader.
//
// Files live in public/art/rebirth/ and are resolved through Vite's BASE_URL
// so they work under /LastStop/ on GitHub Pages. Every path here exists in
// docs/art-rebirth/manifest.json; checksums were verified on import.

import type { SpeakerId } from '../core/content/story';
import type { RepairId } from '../core/content/world';

export const ART_BASE = `${import.meta.env.BASE_URL}art/rebirth/`;

export function artUrl(path: string): string {
  return ART_BASE + path;
}

/** Inventory icons (32×32). Keys are game item IDs. */
export const ITEM_ART: Record<string, string> = {
  scrapIron: 'items/scrapIron.png',
  coalLump: 'items/coalLump.png',
  glassShard: 'items/glassShard.png',
  copperWire: 'items/copperWire.png',
  brassCog: 'items/brassCog.png',
  signalRelay: 'items/signalRelay.png',
  cyanPrism: 'items/cyanPrism.png',
  oakTimber: 'items/oakTimber.png',
  steelRivets: 'items/steelRivets.png',
  pressureGauge: 'items/pressureGauge.png',
  ironPlate: 'items/ironPlate.png',
  fuelBrick: 'items/fuelBrick.png',
  polishedLens: 'items/polishedLens.png',
  copperCoil: 'items/copperCoil.png',
  timberBeam: 'items/timberBeam.png',
  patchPanel: 'items/patchPanel.png',
  gaugeAssembly: 'items/gaugeAssembly.png',
};

/** Discovery icons (32×32). Journal only — never inventory items. */
export const DISCOVERY_ART: Record<string, string> = {
  tornTimetable: 'items/tornTimetable.png',
  kilnToken: 'items/kilnToken.png',
  knittedMitten: 'items/knittedMitten.png',
  stoppedWatch: 'items/stoppedWatch.png',
  signalLog: 'items/signalLog.png',
  shedKey: 'items/shedKey.png',
  hummingRelay: 'items/hummingRelay.png',
  stationPhoto: 'items/stationPhoto.png',
  firemansLedger: 'items/firemansLedger.png',
  kilnPlans: 'items/kilnPlans.png',
  coldValve: 'items/coldValve.png',
  cyanDisc: 'items/cyanDisc.png',
};

export type Mood = 'neutral' | 'concerned' | 'relieved';
export type ArtSpeaker = SpeakerId | 'conductor';

export function portraitArt(who: ArtSpeaker, mood: Mood = 'neutral'): string {
  return artUrl(`characters/${who}_${mood}.png`);
}

export const NAV_ART: Record<string, string> = {
  station: 'ui/station.png',
  skills: 'ui/skills.png',
  train: 'ui/train.png',
  satchel: 'ui/satchel.png',
  journal: 'ui/journal.png',
  settings: 'ui/settings.png',
};

export const MARKER_ART: Record<string, string> = {
  derelictPlatform: 'ui/marker_derelictPlatform.png',
  signalCabinet: 'ui/marker_signalCabinet.png',
  maintenanceShed: 'ui/marker_maintenanceShed.png',
};

// ---------- scene ----------

export const SCENE_W = 384;
export const SCENE_H = 216;

export const SCENE_LAYERS = [
  'environments/sky.png',
  'environments/skyline.png',
  'environments/station_buildings.png',
  'environments/platform_architecture.png',
  'environments/tracks_ground.png',
] as const;

export const TRAIN_ORIGIN = { x: 99, y: 95 } as const;

export const REPAIR_OVERLAYS: Record<RepairId, string> = {
  fireboxDoor: 'locomotive/repair_fireboxDoor.png',
  headlamp: 'locomotive/repair_headlamp.png',
  dryCab: 'locomotive/repair_dryCab.png',
  reinforcedStorage: 'locomotive/repair_reinforcedStorage.png',
  boiler: 'locomotive/repair_boiler.png',
};

export interface EffectDef {
  path: string;
  w: number;
  h: number;
  frames: number;
  ms: number;
  reduced: 'hide' | 'freeze';
}

export const EFFECTS = {
  rain: { path: 'effects/rain.png', w: 32, h: 32, frames: 4, ms: 140, reduced: 'hide' },
  steam: { path: 'effects/steam.png', w: 32, h: 32, frames: 6, ms: 160, reduced: 'hide' },
  lantern: { path: 'effects/lantern_glow.png', w: 32, h: 32, frames: 4, ms: 240, reduced: 'freeze' },
  signal: { path: 'effects/signal_pulse.png', w: 32, h: 32, frames: 4, ms: 240, reduced: 'freeze' },
  window: { path: 'effects/window_light.png', w: 16, h: 16, frames: 4, ms: 300, reduced: 'freeze' },
  rare: { path: 'effects/rare_discovery.png', w: 32, h: 32, frames: 6, ms: 100, reduced: 'hide' },
  headlamp: { path: 'effects/headlamp_glow.png', w: 48, h: 48, frames: 4, ms: 250, reduced: 'freeze' },
} as const satisfies Record<string, EffectDef>;

export type EffectId = keyof typeof EFFECTS;

export const PROP_PATHS = {
  shedClosed: 'environments/shed_closed.png',
  shedOpen: 'environments/shed_open.png',
  signal: 'environments/cyanSignal.png',
  bench: 'environments/bench.png',
  luggage: 'environments/luggage.png',
  planter: 'environments/ashPlanter.png',
  sign: 'environments/stationSign.png',
  cabinetClosed: 'environments/cabinet_closed.png',
  cabinetOpen: 'environments/cabinet_open.png',
  toolBag: 'environments/toolBag.png',
  lantern: 'environments/lantern.png',
  trainBase: 'locomotive/no9_base_damaged.png',
} as const;

export type PropId = keyof typeof PROP_PATHS;

export const FIGURE_PATHS = {
  conductor: ['characters/conductor_figure_0.png', 'characters/conductor_figure_1.png', 'characters/conductor_figure_2.png'],
  mara: ['characters/mara_figure_0.png', 'characters/mara_figure_1.png', 'characters/mara_figure_2.png'],
  tobin: ['characters/tobin_figure_0.png', 'characters/tobin_figure_1.png', 'characters/tobin_figure_2.png'],
} as const;

export type FigureId = keyof typeof FIGURE_PATHS;

export interface SceneArt {
  layers: HTMLImageElement[];
  props: Record<PropId, HTMLImageElement>;
  repairs: Record<RepairId, HTMLImageElement>;
  effects: Record<EffectId, HTMLImageElement>;
  figures: Record<FigureId, HTMLImageElement[]>;
}

function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      // decode() guarantees the bitmap is ready before first draw.
      if (typeof img.decode === 'function') img.decode().then(() => resolve(img), () => resolve(img));
      else resolve(img);
    };
    img.onerror = () => reject(new Error(`Failed to load ${path}`));
    img.src = artUrl(path);
  });
}

async function loadRecord<K extends string>(paths: Record<K, string>): Promise<Record<K, HTMLImageElement>> {
  const entries = await Promise.all(
    (Object.entries(paths) as [K, string][]).map(async ([k, p]) => [k, await loadImage(p)] as const),
  );
  return Object.fromEntries(entries) as Record<K, HTMLImageElement>;
}

let pending: Promise<SceneArt> | null = null;

/** Loads and decodes every scene image once. Rejects if any file fails. */
export function loadSceneArt(): Promise<SceneArt> {
  if (!pending) {
    pending = (async () => {
      const [layers, props, repairs, effects, conductor, mara, tobin] = await Promise.all([
        Promise.all(SCENE_LAYERS.map(loadImage)),
        loadRecord(PROP_PATHS),
        loadRecord(REPAIR_OVERLAYS),
        loadRecord(Object.fromEntries(Object.entries(EFFECTS).map(([k, v]) => [k, v.path])) as Record<EffectId, string>),
        Promise.all(FIGURE_PATHS.conductor.map(loadImage)),
        Promise.all(FIGURE_PATHS.mara.map(loadImage)),
        Promise.all(FIGURE_PATHS.tobin.map(loadImage)),
      ]);
      return { layers, props, repairs, effects, figures: { conductor, mara, tobin } };
    })();
  }
  return pending;
}
