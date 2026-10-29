// Ashvale Station, drawn from Astra's Operation Rebirth art (384×216).
//
// Composition follows docs/art-rebirth/README.md: five full-canvas layers,
// props, No. 9 at (99,95) with per-repair overlays, figures, then effects.
// Static layers and every repair combination are cached; only effects and
// figures are drawn per frame. Until the art has loaded (or if it fails),
// the procedural scene from 0.2 is shown instead.

import type { RepairId } from '../core/content/world';
import { REPAIR_IDS } from '../core/content/world';
import { EFFECTS, loadSceneArt, SCENE_H, SCENE_W, TRAIN_ORIGIN, type EffectId, type FigureId, type SceneArt } from './art';
import { FallbackScene, type FigureSpot as FallbackSpot } from './scene-fallback';
import { drawText, textWidth } from './sprites';

export type FigureSpot = 'idle' | 'platform' | 'cabinet' | 'shed' | 'engine' | 'salvage' | 'research';

export interface SceneState {
  repairs: Record<RepairId, boolean>;
  /** Train improvements beyond the five repairs (shown with effects/props). */
  upgrades: Record<string, boolean>;
  spot: FigureSpot;
  working: boolean;
  shedOpen: boolean;
  cabinetOpen: boolean;
  maraHere: boolean;
  tobinHere: boolean;
  maraWaiting: boolean;
  tobinWaiting: boolean;
  /** performance.now() of the latest rare find, for the one-shot sparkle. */
  rareAt: number;
}

type Ctx = CanvasRenderingContext2D;

interface Spot {
  x: number;
  y: number;
  work: 0 | 1 | 2;
  rest: 0 | 1 | 2;
  glow?: [number, number];
}

/** Top-left of the 32×48 conductor figure, and poses for working/resting. */
const SPOTS: Record<FigureSpot, Spot> = {
  idle: { x: 78, y: 112, work: 0, rest: 0 },
  platform: { x: 84, y: 113, work: 1, rest: 0, glow: [102, 146] },
  cabinet: { x: 318, y: 146, work: 1, rest: 0, glow: [338, 176] },
  shed: { x: 4, y: 112, work: 1, rest: 0, glow: [22, 146] },
  engine: { x: 164, y: 140, work: 1, rest: 0, glow: [199, 154] },
  salvage: { x: 42, y: 150, work: 1, rest: 0, glow: [36, 184] },
  research: { x: 78, y: 112, work: 0, rest: 2, glow: [96, 138] },
};

const MARA_AT = { x: 52, y: 110 };
const TOBIN_AT = { x: 24, y: 112 };

const ANCHORS = {
  signal: [361, 112],
  headlamp: [334, 123],
  firebox: [199, 154],
  stack: [310, 99],
  windows: [
    [190, 128],
    [205, 128],
  ],
  signLabel: [70, 108],
} as const;

function reducedMotionQuery(): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
}

export class StationScene {
  private art: SceneArt | null = null;
  private failed = false;
  private fallback: FallbackScene;
  private ctx: Ctx | null = null;
  private staticLayer: HTMLCanvasElement | null = null;
  private staticKey = '';
  private readonly trainCache = new Map<string, HTMLCanvasElement>();
  private last = 0;
  private reduced = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.fallback = new FallbackScene(canvas);
    const mq = reducedMotionQuery();
    if (mq) {
      this.reduced = mq.matches;
      mq.addEventListener?.('change', (e) => {
        this.reduced = e.matches;
      });
    }
    canvas.dataset.art = 'loading';
    loadSceneArt().then(
      (art) => {
        this.art = art;
        this.canvas.width = SCENE_W;
        this.canvas.height = SCENE_H;
        const ctx = this.canvas.getContext('2d');
        if (!ctx) throw new Error('2D canvas unavailable');
        ctx.imageSmoothingEnabled = false;
        this.ctx = ctx;
        this.canvas.dataset.art = 'rebirth';
        this.last = 0;
      },
      (err: unknown) => {
        this.failed = true;
        this.canvas.dataset.art = 'fallback';
        console.warn('Scene art unavailable; using the built-in scene.', err);
      },
    );
  }

  get ready(): boolean {
    return this.art !== null;
  }

  get artFailed(): boolean {
    return this.failed;
  }

  /** ~12 fps cadence, plenty for pixel art and kind to batteries. */
  draw(s: SceneState, t: number, force = false): void {
    if (!this.art || !this.ctx) {
      this.fallback.draw(toFallback(s), t, force);
      return;
    }
    if (!force && t - this.last < 80) return;
    this.last = t;
    const ctx = this.ctx;
    const art = this.art;

    ctx.drawImage(this.staticFor(s), 0, 0);
    this.drawSignal(ctx, t);
    ctx.drawImage(this.trainFor(s.repairs), 0, 0);
    this.drawTrainEffects(ctx, s, t);

    // Lineside foreground props.
    ctx.drawImage(s.cabinetOpen ? art.props.cabinetOpen : art.props.cabinetClosed, 343, 146);
    ctx.drawImage(art.props.toolBag, 2, 158);
    if (s.upgrades.tenderWinch) ctx.drawImage(art.props.luggage, 106, 120);

    this.drawFigures(ctx, s, t);
    this.drawRain(ctx, t);
    this.canvas.dataset.ready = 'true';
  }

  // ---------- caches ----------

  private staticFor(s: SceneState): HTMLCanvasElement {
    const key = `${s.shedOpen}`;
    if (this.staticLayer && key === this.staticKey) return this.staticLayer;
    const art = this.art as SceneArt;
    const c = this.staticLayer ?? offscreen();
    const g = c.getContext('2d') as Ctx;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, SCENE_W, SCENE_H);
    for (const layer of art.layers) g.drawImage(layer, 0, 0);
    g.drawImage(s.shedOpen ? art.props.shedOpen : art.props.shedClosed, 0, 108);
    g.drawImage(art.props.signal, 334, 100);
    g.drawImage(art.props.planter, 41, 113);
    g.drawImage(art.props.bench, 73, 113);
    g.drawImage(art.props.luggage, 127, 116);
    // Station sign is blank by design; the name is live text.
    g.drawImage(art.props.sign, 47, 74);
    const label = 'ASHVALE';
    const [lx, ly] = ANCHORS.signLabel;
    drawText(g, label, lx - Math.floor(textWidth(label) / 2) + 1, ly + 1, '#1a1410');
    drawText(g, label, lx - Math.floor(textWidth(label) / 2), ly, '#e8dcbc');
    this.staticLayer = c;
    this.staticKey = key;
    return c;
  }

  /** One cached canvas per repair combination (at most 32). */
  private trainFor(repairs: Record<RepairId, boolean>): HTMLCanvasElement {
    const key = REPAIR_IDS.map((id) => (repairs[id] ? '1' : '0')).join('');
    const hit = this.trainCache.get(key);
    if (hit) return hit;
    const art = this.art as SceneArt;
    const c = offscreen();
    const g = c.getContext('2d') as Ctx;
    g.imageSmoothingEnabled = false;
    g.drawImage(art.props.trainBase, TRAIN_ORIGIN.x, TRAIN_ORIGIN.y);
    for (const id of REPAIR_IDS) if (repairs[id]) g.drawImage(art.repairs[id], TRAIN_ORIGIN.x, TRAIN_ORIGIN.y);
    this.trainCache.set(key, c);
    return c;
  }

  // ---------- effects ----------

  private frameOf(id: EffectId, t: number): number | null {
    const fx = EFFECTS[id];
    if (this.reduced) return fx.reduced === 'hide' ? null : 0;
    return Math.floor(t / fx.ms) % fx.frames;
  }

  private effect(ctx: Ctx, id: EffectId, cx: number, cy: number, t: number, alpha = 1): void {
    const f = this.frameOf(id, t);
    if (f === null) return;
    const fx = EFFECTS[id];
    const img = (this.art as SceneArt).effects[id];
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, f * fx.w, 0, fx.w, fx.h, Math.round(cx - fx.w / 2), Math.round(cy - fx.h / 2), fx.w, fx.h);
    ctx.globalAlpha = 1;
  }

  private drawSignal(ctx: Ctx, t: number): void {
    const [x, y] = ANCHORS.signal;
    this.effect(ctx, 'signal', x, y, t);
  }

  private drawTrainEffects(ctx: Ctx, s: SceneState, t: number): void {
    const r = s.repairs;
    if (r.fireboxDoor) this.effect(ctx, 'lantern', ANCHORS.firebox[0], ANCHORS.firebox[1], t);
    if (r.dryCab || s.upgrades.cabLanterns) {
      for (const [x, y] of ANCHORS.windows) this.effect(ctx, 'window', x, y, t + x * 37);
    }
    if (s.upgrades.cabLanterns) this.effect(ctx, 'lantern', 197, 128, t + 120, 0.8);
    if (r.headlamp) this.effect(ctx, 'headlamp', ANCHORS.headlamp[0], ANCHORS.headlamp[1], t);
    if (r.boiler) {
      this.effect(ctx, 'steam', ANCHORS.stack[0], ANCHORS.stack[1], t);
      this.effect(ctx, 'steam', ANCHORS.stack[0] - 9, ANCHORS.stack[1] - 14, t + 480, 0.6);
    }
    if (s.upgrades.signalReceiver) this.effect(ctx, 'signal', 236, 118, t + 120, 0.9);
  }

  private drawRain(ctx: Ctx, t: number): void {
    if (this.reduced) return;
    const fx = EFFECTS.rain;
    const img = (this.art as SceneArt).effects.rain;
    ctx.globalAlpha = 0.6;
    for (let ty = 0; ty < SCENE_H; ty += fx.h) {
      for (let tx = 0; tx < SCENE_W; tx += fx.w) {
        // Offset frames per tile so the rain doesn't pulse in sync.
        const f = (Math.floor(t / fx.ms) + tx / fx.w + (ty / fx.h) * 2) % fx.frames;
        ctx.drawImage(img, f * fx.w, 0, fx.w, fx.h, tx, ty, fx.w, fx.h);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- figures ----------

  private figure(ctx: Ctx, who: FigureId, pose: number, x: number, y: number): void {
    const frames = (this.art as SceneArt).figures[who];
    const img = frames[pose] ?? frames[0];
    if (img) ctx.drawImage(img, x, y);
  }

  private drawFigures(ctx: Ctx, s: SceneState, t: number): void {
    if (s.tobinHere) this.figure(ctx, 'tobin', s.tobinWaiting ? 2 : 0, TOBIN_AT.x, TOBIN_AT.y);
    if (s.maraHere) this.figure(ctx, 'mara', s.maraWaiting ? 2 : 0, MARA_AT.x, MARA_AT.y);

    const spot = SPOTS[s.spot];
    let pose: number = s.working ? spot.work : spot.rest;
    // Working poses alternate with standing for a little life; held still
    // when the player prefers reduced motion.
    if (s.working && !this.reduced && spot.work === 1 && Math.floor(t / 650) % 3 === 2) pose = 0;
    this.figure(ctx, 'conductor', pose, spot.x, spot.y);
    if (s.working && spot.glow) this.effect(ctx, 'lantern', spot.glow[0], spot.glow[1], t, 0.85);

    if (s.rareAt > 0) {
      const since = performance.now() - s.rareAt;
      const fx = EFFECTS.rare;
      if (since >= 0 && since < fx.frames * fx.ms && !this.reduced) {
        const f = Math.floor(since / fx.ms);
        const img = (this.art as SceneArt).effects.rare;
        ctx.drawImage(img, f * fx.w, 0, fx.w, fx.h, spot.x, spot.y - 6, fx.w, fx.h);
      }
    }
  }
}

function offscreen(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = SCENE_W;
  c.height = SCENE_H;
  return c;
}

function toFallback(s: SceneState): Parameters<FallbackScene['draw']>[0] {
  const map: Record<FigureSpot, FallbackSpot> = {
    idle: 'idle',
    platform: 'platform',
    cabinet: 'cabinet',
    shed: 'shed',
    engine: 'engine',
    salvage: 'platform',
    research: 'idle',
  };
  return {
    repairs: s.repairs,
    spot: map[s.spot],
    working: s.working,
    shedOpen: s.shedOpen,
    cabinetOpen: s.cabinetOpen,
    maraHere: s.maraHere,
    tobinHere: s.tobinHere,
  };
}

/** Scene hotspots in logical coordinates, for tappable DOM shortcuts. */
export const HOTSPOTS = [
  { id: 'platform', x: 72, y: 104, w: 34, h: 56, label: 'Derelict Platform' },
  { id: 'shed', x: 0, y: 108, w: 48, h: 48, label: 'Maintenance Shed' },
  { id: 'cabinet', x: 340, y: 146, w: 44, h: 50, label: 'Signal Cabinet' },
  { id: 'salvage', x: 0, y: 160, w: 60, h: 48, label: 'Salvage yard' },
  { id: 'train', x: 180, y: 108, w: 150, h: 80, label: 'Locomotive No. 9' },
] as const;

export type HotspotId = (typeof HOTSPOTS)[number]['id'];
