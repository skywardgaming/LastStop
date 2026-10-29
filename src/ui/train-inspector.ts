// Locomotive No. 9 inspection view.
//
// Draws Astra's train exactly as the scene does (base, then each restored
// overlay, at the shared origin) and places a tappable hotspot over each
// repair's manifest region. Hotspot geometry comes from the art pack's
// manifest, so it can't drift from the pixels.

import { REPAIR_IDS, type RepairId } from '../core/content/world';
import { loadSceneArt, type SceneArt } from './art';

/** Crop of the 256×102 train frame that contains every opaque pixel (bbox 3,13 → 253,89). */
export const TRAIN_CROP = { x: 0, y: 8, w: 256, h: 86 } as const;

/** Repair regions in train-local pixels, from docs/art-rebirth/manifest.json. */
export const REPAIR_REGIONS: Record<RepairId, [number, number, number, number]> = {
  fireboxDoor: [93, 52, 16, 20],
  headlamp: [226, 20, 16, 17],
  dryCab: [77, 18, 40, 27],
  reinforcedStorage: [10, 47, 66, 18],
  boiler: [117, 25, 84, 32],
};

export interface InspectorView {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  layer: HTMLElement;
}

/**
 * Creates the inspector. Drawing happens once the art is decoded and again
 * whenever the box is resized, at the largest whole-number scale of device
 * pixels that fits (pixel-perfect), or a smooth fit when that would leave
 * the train much smaller than its box.
 */
export function createInspector(repairs: Record<RepairId, boolean>, label: string): InspectorView {
  const canvas = document.createElement('canvas');
  canvas.className = 'pixel inspector-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', label);
  const layer = document.createElement('div');
  layer.className = 'inspector-layer';
  const frame = document.createElement('div');
  frame.className = 'inspector-frame';
  frame.append(canvas, layer);
  const root = document.createElement('div');
  root.className = 'inspector';
  root.append(frame);

  let art: SceneArt | null = null;
  const draw = (): void => {
    if (!art) return;
    const avail = root.clientWidth || 320;
    const dpr = window.devicePixelRatio || 1;
    const k = Math.floor((avail * dpr) / TRAIN_CROP.w);
    const integerCss = (k * TRAIN_CROP.w) / dpr;
    const integer = k >= 1 && integerCss >= avail * 0.82;
    const scale = integer ? k : Math.max(1, Math.round((avail * dpr) / TRAIN_CROP.w));
    canvas.width = TRAIN_CROP.w * scale;
    canvas.height = TRAIN_CROP.h * scale;
    const cssW = integer ? integerCss : avail;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${(cssW * TRAIN_CROP.h) / TRAIN_CROP.w}px`;
    frame.style.width = canvas.style.width;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, TRAIN_CROP.w, TRAIN_CROP.h);
    ctx.drawImage(art.props.trainBase, -TRAIN_CROP.x, -TRAIN_CROP.y);
    for (const id of REPAIR_IDS) if (repairs[id]) ctx.drawImage(art.repairs[id], -TRAIN_CROP.x, -TRAIN_CROP.y);
    root.dataset.ready = 'true';
  };

  loadSceneArt().then(
    (a) => {
      art = a;
      draw();
    },
    () => {
      root.dataset.ready = 'failed';
    },
  );
  if (typeof ResizeObserver !== 'undefined') {
    let last = 0;
    new ResizeObserver(() => {
      const w = root.clientWidth;
      if (w !== last) {
        last = w;
        draw();
      }
    }).observe(root);
  }
  return { root, canvas, layer };
}

/** Region as percentages of the cropped frame, for CSS positioning. */
export function regionPercent(id: RepairId): { left: number; top: number; width: number; height: number } {
  const [x, y, w, hgt] = REPAIR_REGIONS[id];
  return {
    left: ((x - TRAIN_CROP.x) / TRAIN_CROP.w) * 100,
    top: ((y - TRAIN_CROP.y) / TRAIN_CROP.h) * 100,
    width: (w / TRAIN_CROP.w) * 100,
    height: (hgt / TRAIN_CROP.h) * 100,
  };
}
