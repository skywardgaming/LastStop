// Ashvale Station at night, in the rain. Drawn pixel by pixel on a 256×144
// canvas and scaled up with crisp edges. All art is original.
//
// Layers: static backdrop (cached) → animated sky/fog/signal → locomotive
// (cached per repair state) → animated lights, steam, rain and figures.

import type { RepairId } from '../core/content/world';
import { drawSprite, drawText, MARA_FIGURE, SCAVENGER_CROUCH, SCAVENGER_STAND, textWidth, TOBIN_FIGURE } from './sprites';

export const SCENE_W = 256;
export const SCENE_H = 144;

const HORIZON = 86;
const PLATFORM_TOP = 104;
const RAIL_Y = 128;

export type FigureSpot = 'idle' | 'platform' | 'cabinet' | 'shed' | 'engine';

export interface SceneState {
  repairs: Record<RepairId, boolean>;
  spot: FigureSpot;
  working: boolean;
  shedOpen: boolean;
  cabinetOpen: boolean;
  maraHere: boolean;
  tobinHere: boolean;
}

type Ctx = CanvasRenderingContext2D;

// ---------- primitives ----------

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, c: string): void {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function px(ctx: Ctx, x: number, y: number, c: string): void {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

function disc(ctx: Ctx, cx: number, cy: number, r: number, c: string): void {
  ctx.fillStyle = c;
  for (let dy = -r; dy <= r; dy++) {
    const span = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.6));
    ctx.fillRect(Math.round(cx - span), Math.round(cy + dy), span * 2 + 1, 1);
  }
}

function glow(ctx: Ctx, cx: number, cy: number, r: number, c: string, alpha: number): void {
  // Stepped radial glow: concentric discs, pixel-true edges.
  for (let i = 3; i >= 1; i--) {
    ctx.globalAlpha = alpha * (0.45 / i);
    disc(ctx, cx, cy, Math.round((r * i) / 3), c);
  }
  ctx.globalAlpha = 1;
}

function noise(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function dither(x: number, y: number): number {
  const m = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  return ((m[(x % 4) + (y % 4) * 4] ?? 0) + 0.5) / 16;
}

// ---------- static backdrop ----------

const SKY = ['#0b0d18', '#0f1220', '#141629', '#1a1830', '#221a36', '#2d1c3a', '#3a1f3b', '#4c2639', '#6a3236', '#8c4434'];

function drawSky(ctx: Ctx): void {
  for (let y = 0; y < HORIZON; y++) {
    const t = (y / HORIZON) * (SKY.length - 1);
    const i = Math.floor(t);
    const f = t - i;
    for (let x = 0; x < SCENE_W; x++) {
      // Kiln glow warms the horizon in the middle of town.
      const warm = Math.max(0, 1 - Math.abs(x - 120) / 140) * 0.6;
      const idx = Math.min(SKY.length - 1, i + (f > dither(x, y) ? 1 : 0) + (y > HORIZON - 22 && warm > dither(x + 1, y) ? 1 : 0));
      px(ctx, x, y, SKY[idx] ?? '#000');
    }
  }
  // Heavy rain clouds.
  for (let y = 0; y < 40; y++) {
    for (let x = 0; x < SCENE_W; x++) {
      const n = noise(Math.floor(x / 6), Math.floor(y / 3)) * 0.6 + noise(x, y) * 0.4;
      if (n > 0.62 - y * 0.004) px(ctx, x, y, y < 18 ? '#090a12' : '#120f1c');
    }
  }
}

function drawTown(ctx: Ctx): void {
  // Distant rooftops.
  for (let x = 0; x < SCENE_W; x++) {
    const h = 6 + Math.floor(noise(Math.floor(x / 9), 7) * 9) + (Math.floor(x / 9) % 3 === 0 ? 3 : 0);
    rect(ctx, x, HORIZON - h, 1, h, '#18121f');
  }
  // Bottle kilns — Ashvale's pottery-town silhouette.
  const kilns = [
    { x: 58, h: 30, w: 16 },
    { x: 86, h: 36, w: 18 },
    { x: 150, h: 26, w: 14 },
    { x: 196, h: 33, w: 17 },
    { x: 226, h: 24, w: 12 },
  ];
  for (const k of kilns) {
    const base = HORIZON - 2;
    for (let i = 0; i < k.h; i++) {
      const t = i / k.h;
      // Bottle profile: wide belly, narrowing neck, small lip.
      const belly = t < 0.55 ? 1 - Math.pow((t - 0.25) / 0.45, 2) * 0.3 : 1 - (t - 0.55) * 1.6;
      const w = Math.max(3, Math.round(k.w * Math.max(0.22, belly)));
      rect(ctx, k.x - Math.floor(w / 2), base - i, w, 1, i < 3 ? '#140f19' : '#1c1624');
    }
    rect(ctx, k.x - 3, base - k.h - 1, 6, 2, '#1c1624');
    // Glowing firemouths at the base (only where the engine doesn't hide them).
    if (k.x < 120) {
      rect(ctx, k.x - 3, base - 4, 2, 3, '#ff8a3a');
      rect(ctx, k.x + 2, base - 4, 2, 3, '#d4602a');
    }
  }
  // Lit windows scattered in the terraces.
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(noise(i, 41) * SCENE_W);
    const y = HORIZON - 3 - Math.floor(noise(i, 43) * 6);
    if (noise(i, 47) > 0.4) px(ctx, x, y, noise(i, 53) > 0.5 ? '#e8a95a' : '#a87a4a');
  }
}

function drawGround(ctx: Ctx): void {
  rect(ctx, 0, HORIZON, SCENE_W, SCENE_H - HORIZON, '#14111a');
  // Distant track, half lost in fog.
  rect(ctx, 0, 93, SCENE_W, 1, '#2a2533');
  for (let x = 0; x < SCENE_W; x += 5) px(ctx, x, 94, '#1d1924');
  for (let y = HORIZON; y < SCENE_H; y++) {
    for (let x = 0; x < SCENE_W; x++) {
      const n = noise(x, y);
      if (n > 0.94) px(ctx, x, y, '#251f2c');
      else if (n < 0.03) px(ctx, x, y, '#0c0a10');
    }
  }
}

function drawShed(ctx: Ctx, open: boolean): void {
  const x0 = 0;
  const w = 40;
  const top = 72;
  const bottom = 110;
  // Brick walls.
  rect(ctx, x0, top, w, bottom - top, '#2c1f22');
  for (let y = top + 2; y < bottom; y += 3) {
    for (let x = x0 + ((y / 3) % 2 ? 0 : 3); x < x0 + w; x += 6) rect(ctx, x, y, 1, 2, '#22171a');
    rect(ctx, x0, y + 2, w, 1, '#24191c');
  }
  // Pitched roof.
  for (let i = 0; i < 10; i++) rect(ctx, x0 - 2 + i, top - 10 + i, w + 4 - i * 2, 1, i % 3 === 0 ? '#2a2632' : '#1e1b25');
  rect(ctx, x0 - 2, top, w + 4, 2, '#3a3442');
  // Sign plate.
  rect(ctx, x0 + 10, top + 3, 20, 4, '#1c2b2a');
  rect(ctx, x0 + 11, top + 4, 18, 1, '#3a5550');
  // Doors.
  const dx = x0 + 8;
  const dw = 24;
  const dy = top + 10;
  if (open) {
    rect(ctx, dx, dy, dw, bottom - dy, '#3a2414');
    rect(ctx, dx + 4, dy + 2, dw - 8, bottom - dy - 2, '#d48a42');
    rect(ctx, dx + 6, dy + 4, dw - 12, bottom - dy - 4, '#f2b464');
    // Tool silhouettes on the far wall.
    rect(ctx, dx + 7, dy + 6, 1, 6, '#5a3a20');
    rect(ctx, dx + 10, dy + 5, 3, 1, '#5a3a20');
    rect(ctx, dx + 11, dy + 6, 1, 5, '#5a3a20');
    rect(ctx, dx + 15, dy + 7, 2, 2, '#5a3a20');
    // Doors swung open.
    rect(ctx, dx - 2, dy, 4, bottom - dy, '#3e2a1e');
    rect(ctx, dx + dw - 2, dy, 4, bottom - dy, '#3e2a1e');
  } else {
    rect(ctx, dx, dy, dw, bottom - dy, '#3e2a1e');
    for (let x = dx + 2; x < dx + dw; x += 4) rect(ctx, x, dy, 1, bottom - dy, '#2c1d14');
    rect(ctx, dx + dw / 2 - 1, dy + 12, 2, 3, '#8c6a2b'); // padlock
    rect(ctx, dx, dy + 8, dw, 1, '#2c1d14');
  }
}

function drawPlatform(ctx: Ctx): void {
  const x0 = 34;
  const x1 = 126;
  // Platform body and wet surface.
  rect(ctx, x0, PLATFORM_TOP, x1 - x0, 2, '#5a4f60');
  rect(ctx, x0, PLATFORM_TOP + 2, x1 - x0, 1, '#3a3142');
  rect(ctx, x0, PLATFORM_TOP + 3, x1 - x0, RAIL_Y - PLATFORM_TOP - 6, '#2a2330');
  for (let y = PLATFORM_TOP + 4; y < RAIL_Y - 4; y += 3) {
    for (let x = x0 + ((y / 3) % 2 ? 0 : 3); x < x1; x += 6) rect(ctx, x, y, 1, 2, '#211b27');
    rect(ctx, x0, y + 2, x1 - x0, 1, '#201a26');
  }
  rect(ctx, x1, PLATFORM_TOP, 1, RAIL_Y - PLATFORM_TOP - 3, '#17121b');
  // Yellow-lined platform edge, faded.
  for (let x = x0; x < x1; x += 2) px(ctx, x, PLATFORM_TOP, noise(x, 9) > 0.3 ? '#8a7a3a' : '#5a4f60');

  // Iron canopy.
  const posts = [42, 72, 102];
  for (const p of posts) {
    rect(ctx, p, 72, 2, PLATFORM_TOP - 72, '#1b1621');
    rect(ctx, p - 1, 72, 4, 2, '#2a2432');
    rect(ctx, p - 3, 74, 1, 1, '#1b1621');
    rect(ctx, p + 4, 74, 1, 1, '#1b1621');
  }
  rect(ctx, 36, 66, 74, 6, '#231d2b');
  rect(ctx, 36, 66, 74, 1, '#3c3446');
  // Valance: the scalloped wooden fringe.
  for (let x = 36; x < 110; x++) {
    const d = x % 4 === 0 ? 3 : x % 4 === 2 ? 1 : 2;
    rect(ctx, x, 72, 1, d, '#2a2230');
  }

  // Station sign hanging from the canopy.
  const label = 'ASHVALE';
  const sw = textWidth(label) + 8;
  const sx = 57 - Math.floor(sw / 2) + 16;
  const sy = 80;
  rect(ctx, sx + 3, 75, 1, sy - 75, '#1b1621');
  rect(ctx, sx + sw - 4, 75, 1, sy - 75, '#1b1621');
  rect(ctx, sx, sy, sw, 9, '#1a2a2c');
  rect(ctx, sx, sy, sw, 1, '#3e5c58');
  rect(ctx, sx, sy + 8, sw, 1, '#0e1718');
  drawText(ctx, label, sx + 4, sy + 2, '#d6e2c8');
  // Rust weeping from the sign's screws.
  px(ctx, sx + 1, sy + 9, '#6e3220');
  px(ctx, sx + sw - 2, sy + 9, '#6e3220');
  px(ctx, sx + sw - 2, sy + 10, '#6e3220');

  // Bench, timetable board and scrap pile.
  rect(ctx, 76, 98, 14, 2, '#3b2c27');
  rect(ctx, 77, 100, 1, 4, '#251c1a');
  rect(ctx, 88, 100, 1, 4, '#251c1a');
  rect(ctx, 76, 94, 14, 1, '#3b2c27');
  rect(ctx, 46, 86, 9, 11, '#2c2420');
  rect(ctx, 47, 87, 7, 9, '#c8bca0');
  for (let i = 0; i < 4; i++) rect(ctx, 48, 88 + i * 2, 4 + (i % 2), 1, '#6a6050');
  rect(ctx, 52, 92, 2, 4, '#2c2420'); // torn corner
  const cols = ['#5b4e57', '#7a3b26', '#8d8794', '#3d343f', '#a5502b'];
  for (let i = 0; i < 60; i++) {
    const x = 58 + Math.floor(noise(i, 71) * 16);
    const h = Math.floor(7 - Math.abs(x - 66) * 0.7);
    if (h <= 0) continue;
    const y = PLATFORM_TOP - 1 - Math.floor(noise(i, 13) * h);
    rect(ctx, x, y, 1 + Math.floor(noise(i, 5) * 2), 1, cols[i % cols.length] ?? '#555');
  }

  // Puddles: darker water that will catch reflections.
  for (const [x, w] of [
    [50, 10],
    [86, 14],
  ] as const) {
    rect(ctx, x, PLATFORM_TOP + 1, w, 1, '#1a2230');
  }
}

function drawCabinet(ctx: Ctx, open: boolean): void {
  const x = 112;
  const y = 92;
  rect(ctx, x, y, 12, 12, '#2f4a3e');
  rect(ctx, x, y, 12, 1, '#4a6e5c');
  rect(ctx, x + 11, y, 1, 12, '#1d2f27');
  rect(ctx, x - 1, y - 1, 14, 1, '#24382f');
  for (let i = 0; i < 6; i++) if (noise(i, 77) > 0.4) px(ctx, x + 1 + Math.floor(noise(i, 3) * 10), y + 2 + Math.floor(noise(i, 5) * 9), '#6e3220');
  if (open) {
    rect(ctx, x + 1, y + 1, 9, 10, '#0e1512');
    rect(ctx, x + 2, y + 3, 3, 2, '#c08a3a');
    rect(ctx, x + 6, y + 3, 3, 2, '#3e6b5a');
    rect(ctx, x + 2, y + 7, 7, 1, '#e0884a');
    rect(ctx, x - 6, y + 1, 6, 10, '#2f4a3e'); // door hanging open
    rect(ctx, x - 6, y + 1, 1, 10, '#4a6e5c');
  } else {
    rect(ctx, x + 2, y + 2, 8, 8, '#2a4237');
    rect(ctx, x + 8, y + 5, 1, 2, '#8c6a2b');
  }
}

function drawTrack(ctx: Ctx): void {
  rect(ctx, 0, RAIL_Y + 1, SCENE_W, SCENE_H - RAIL_Y - 1, '#1c1720');
  for (let y = RAIL_Y + 1; y < SCENE_H; y++) {
    for (let x = 0; x < SCENE_W; x++) {
      const n = noise(x + 400, y);
      if (n > 0.72) px(ctx, x, y, n > 0.9 ? '#463a48' : '#30283a');
    }
  }
  for (let x = 2; x < SCENE_W; x += 8) rect(ctx, x, RAIL_Y + 2, 5, 3, '#2e211d');
  rect(ctx, 0, RAIL_Y - 1, SCENE_W, 2, '#5e5263');
  rect(ctx, 0, RAIL_Y - 1, SCENE_W, 1, '#a89aa8');
  // Weeds between the sleepers.
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(noise(i, 91) * SCENE_W);
    px(ctx, x, RAIL_Y + 1, '#2d3a2a');
    px(ctx, x + 1, RAIL_Y, '#3a4a32');
  }
}

// ---------- locomotive ----------

interface Livery {
  body: string;
  bodyD: string;
  bodyL: string;
  band: string;
}

const RUSTED: Livery = { body: '#3a2b2d', bodyD: '#241a1c', bodyL: '#56403f', band: '#6a5a3a' };
const RESTORED: Livery = { body: '#1f3a33', bodyD: '#132620', bodyL: '#2f5a4e', band: '#d4ab4e' };

function wheel(ctx: Ctx, cx: number, cy: number, r: number, restored: boolean): void {
  disc(ctx, cx, cy, r, restored ? '#5a4a3a' : '#4c3f45');
  disc(ctx, cx, cy, r - 1, '#1c161a');
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    for (let d = 1; d < r - 1; d++) px(ctx, cx + Math.cos(ang) * d, cy + Math.sin(ang) * d, '#3b3036');
  }
  disc(ctx, cx, cy, 1, restored ? '#d4ab4e' : '#6a5a3a');
}

function drawLocomotive(ctx: Ctx, r: Record<RepairId, boolean>): void {
  const L = r.boiler ? RESTORED : RUSTED;

  // ---- Tender (storage) x 128–154 ----
  const tx = 128;
  const ty = 92;
  if (r.reinforcedStorage) {
    rect(ctx, tx, ty, 26, 24, L.body);
    rect(ctx, tx, ty, 26, 1, L.bodyL);
    rect(ctx, tx, ty + 23, 26, 1, L.bodyD);
    for (let x = tx + 2; x < tx + 26; x += 4) {
      px(ctx, x, ty + 2, L.band);
      px(ctx, x, ty + 21, L.band);
    }
    rect(ctx, tx + 2, ty + 10, 22, 1, L.bodyD);
    // Coal heap, crates and a lashed tarp.
    for (let i = 0; i < 22; i++) rect(ctx, tx + 2 + i, ty - 3 + Math.abs(i - 11) / 4, 1, 4, i % 3 ? '#151216' : '#2a2430');
    rect(ctx, tx + 15, ty - 9, 9, 7, '#6a4a2a');
    rect(ctx, tx + 15, ty - 9, 9, 1, '#8a6a3a');
    rect(ctx, tx + 19, ty - 9, 1, 7, '#4a321c');
    rect(ctx, tx + 3, ty - 7, 7, 5, '#3a4a5a');
    rect(ctx, tx + 3, ty - 7, 7, 1, '#5a6a7a');
  } else {
    // Rust-eaten shell with gaps.
    rect(ctx, tx, ty + 6, 26, 18, '#2a1f20');
    for (let x = tx; x < tx + 26; x++) {
      for (let y = ty + 6; y < ty + 24; y++) {
        const n = noise(x, y + 900);
        if (n > 0.78) px(ctx, x, y, n > 0.92 ? '#7a3a24' : '#552616');
        if (n < 0.12) px(ctx, x, y, '#100c10');
      }
    }
    rect(ctx, tx + 6, ty + 10, 5, 6, '#0d0a0e');
    rect(ctx, tx + 16, ty + 14, 4, 5, '#0d0a0e');
    rect(ctx, tx, ty + 6, 2, 18, '#3a2b2d');
    rect(ctx, tx + 24, ty + 6, 2, 18, '#3a2b2d');
    rect(ctx, tx, ty + 6, 26, 1, '#56403f');
  }
  rect(ctx, tx - 1, ty + 24, 28, 3, '#1b1416');

  // ---- Running board / frame ----
  rect(ctx, 154, 113, 96, 3, '#1b1416');
  rect(ctx, 154, 112, 96, 1, r.boiler ? '#5a4a3a' : '#4a3a3a');

  // ---- Boiler x 184–240 ----
  const bx = 184;
  const by = 86;
  const bw = 56;
  const bh = 26;
  const shades = [L.bodyL, L.bodyL, L.body, L.body, L.body, L.body, L.body, L.bodyD, L.bodyD, L.bodyD, '#140f12'];
  for (let i = 0; i < bh; i++) {
    const c = shades[Math.min(shades.length - 1, Math.floor((i / bh) * shades.length))] ?? L.body;
    rect(ctx, bx, by + i, bw, 1, c);
  }
  if (r.boiler) {
    // Clean jacket with a lining stripe and polished bands.
    rect(ctx, bx, by + 3, bw, 1, '#3f7a6a');
    for (const x of [bx + 10, bx + 28, bx + 46]) rect(ctx, x, by, 2, bh, L.band);
    for (const x of [bx + 10, bx + 28, bx + 46]) rect(ctx, x, by, 1, bh, '#f3d68a');
  } else {
    for (let x = bx; x < bx + bw; x++) {
      for (let y = by; y < by + bh; y++) {
        const n = noise(x, y + 50);
        if (n > 0.84) px(ctx, x, y, n > 0.95 ? '#7a3a24' : '#552616');
      }
    }
    // Snapped band and a hole in the jacket.
    rect(ctx, bx + 10, by, 1, 12, L.band);
    rect(ctx, bx + 10, by + 15, 1, 11, L.band);
    rect(ctx, bx + 28, by, 1, bh, L.band);
    rect(ctx, bx + 36, by + 9, 5, 4, '#0d0a0e');
    rect(ctx, bx + 37, by + 10, 3, 2, '#1a1216');
  }

  // Smokebox and door.
  rect(ctx, 240, by - 1, 8, bh + 2, '#1e1719');
  rect(ctx, 247, by + 3, 2, bh - 6, '#141012');
  rect(ctx, 243, by + 10, 1, 6, r.boiler ? '#d4ab4e' : '#4a3a3a');

  // Chimney and dome.
  rect(ctx, 228, 72, 8, 14, L.bodyD);
  rect(ctx, 226, 69, 12, 3, L.body);
  rect(ctx, 226, 69, 12, 1, L.bodyL);
  rect(ctx, 204, 80, 12, 6, L.body);
  rect(ctx, 205, 79, 10, 1, L.bodyL);
  rect(ctx, 207, 78, 6, 1, r.boiler ? '#f3d68a' : L.band);
  // Safety valve and whistle.
  rect(ctx, 192, 82, 3, 4, r.boiler ? '#d4ab4e' : '#4a3a3a');
  rect(ctx, 193, 80, 1, 2, r.boiler ? '#f3d68a' : '#3a2e2e');

  // ---- Headlamp ----
  rect(ctx, 241, 78, 7, 7, '#2c2224');
  rect(ctx, 241, 78, 7, 1, '#4a3a3a');
  if (r.headlamp) {
    rect(ctx, 242, 79, 5, 5, '#fff1c8');
    rect(ctx, 243, 80, 3, 3, '#ffffff');
  } else {
    rect(ctx, 242, 79, 5, 5, '#2e2c34');
    px(ctx, 243, 80, '#5d5a62');
    px(ctx, 244, 81, '#5d5a62');
    px(ctx, 245, 82, '#4a4752');
  }

  // Cowcatcher.
  for (let i = 0; i < 12; i++) rect(ctx, 246 + Math.floor(i / 2), 114 + i, Math.max(1, 10 - Math.floor(i / 2)), 1, i % 2 ? '#2a2022' : r.boiler ? '#8a2f2f' : '#4a3a3a');

  // ---- Cab x 154–184 ----
  const cx = 154;
  const cy = 74;
  rect(ctx, cx, cy, 30, 39, L.body);
  rect(ctx, cx, cy, 1, 39, L.bodyL);
  rect(ctx, cx + 29, cy, 1, 39, L.bodyD);
  if (r.boiler) rect(ctx, cx + 2, cy + 30, 26, 1, L.band);

  // Roof.
  if (r.dryCab) {
    rect(ctx, cx - 3, cy - 4, 36, 4, '#3a2a1e');
    rect(ctx, cx - 3, cy - 4, 36, 1, '#6a4a2a');
    for (let x = cx - 1; x < cx + 33; x += 5) px(ctx, x, cy - 2, '#2a1c12');
  } else {
    // Broken roof: missing slats and a torn tarp.
    for (let x = cx - 3; x < cx + 33; x++) {
      const gap = (x > cx + 6 && x < cx + 12) || (x > cx + 19 && x < cx + 23);
      if (!gap) rect(ctx, x, cy - 4 + (x > cx + 24 ? 1 : 0), 1, 3, x % 3 ? '#2a2022' : '#3a2e2e');
    }
    rect(ctx, cx + 24, cy - 1, 9, 2, '#4a5a4a');
    rect(ctx, cx + 30, cy + 1, 3, 3, '#4a5a4a');
  }

  // Cab window.
  rect(ctx, cx + 5, cy + 4, 20, 12, '#0f0c12');
  rect(ctx, cx + 14, cy + 4, 1, 12, L.bodyD);
  if (r.dryCab) {
    rect(ctx, cx + 6, cy + 9, 7, 6, '#7a4a24');
    rect(ctx, cx + 15, cy + 9, 9, 6, '#7a4a24');
    rect(ctx, cx + 6, cy + 11, 7, 4, '#c87a3a');
    rect(ctx, cx + 15, cy + 11, 9, 4, '#c87a3a');
  } else {
    px(ctx, cx + 7, cy + 6, '#2a2e3a');
    px(ctx, cx + 20, cy + 8, '#2a2e3a');
  }

  // Number plate "9".
  rect(ctx, cx + 4, cy + 19, 7, 9, r.boiler ? '#d4ab4e' : '#8a7448');
  rect(ctx, cx + 5, cy + 20, 5, 7, '#1a1214');
  drawText(ctx, '9', cx + 6, cy + 21, r.boiler ? '#f3d68a' : '#8a7448');

  // Firebox door (lit layer is animated separately).
  const fx = cx + 15;
  const fy = cy + 19;
  if (r.fireboxDoor) {
    rect(ctx, fx, fy, 11, 10, '#2a2022');
    rect(ctx, fx + 1, fy + 1, 9, 8, '#5a2a1a');
    rect(ctx, fx + 9, fy + 4, 1, 2, '#d4ab4e');
  } else {
    rect(ctx, fx, fy, 11, 10, '#0b080c');
    rect(ctx, fx + 1, fy + 7, 4, 1, '#2a1a14');
    for (let i = 0; i < 10; i++) rect(ctx, fx + 10 + Math.floor(i / 3), fy + i, 3, 1, i % 3 === 0 ? '#7a3a24' : '#552616');
  }

  // ---- Wheels and motion ----
  wheel(ctx, 166, 120, 8, r.boiler);
  wheel(ctx, 188, 120, 8, r.boiler);
  wheel(ctx, 210, 120, 8, r.boiler);
  wheel(ctx, 236, 123, 5, r.boiler);
  wheel(ctx, 134, 123, 5, r.boiler);
  wheel(ctx, 148, 123, 5, r.boiler);
  rect(ctx, 166, 120, 45, 2, r.boiler ? '#a0a0aa' : '#5a555c');
  rect(ctx, 210, 117, 18, 1, r.boiler ? '#8a8a94' : '#4a454c');
}

// ---------- animated layers ----------

function drawSignal(ctx: Ctx, t: number, restored: boolean): void {
  const x = 126;
  rect(ctx, x, 62, 1, 32, '#141019');
  rect(ctx, x - 3, 60, 7, 6, '#141019');
  // The mysterious cyan aspect: breathes slowly; steady once No. 9 is whole.
  const pulse = restored ? 1 : 0.55 + 0.45 * Math.sin(t / 900) * Math.sin(t / 2300);
  const on = pulse > 0.25;
  rect(ctx, x - 1, 62, 3, 3, on ? '#bff7f2' : '#1e5a5a');
  if (on) {
    glow(ctx, x, 63, restored ? 14 : 10, '#5fe3d6', 0.9 * pulse);
  }
}

function drawSmoke(ctx: Ctx, t: number): void {
  // Kiln smoke rising and leaning in the wind.
  const stacks = [58, 86, 196];
  stacks.forEach((sx, k) => {
    for (let i = 0; i < 5; i++) {
      const life = ((t / 7000 + i / 5 + k * 0.31) % 1 + 1) % 1;
      const x = sx - life * 26 + Math.sin(life * 5 + k) * 2;
      const y = 50 - k * 3 - life * 30;
      ctx.globalAlpha = 0.22 * (1 - life);
      disc(ctx, x, y, 2 + Math.floor(life * 5), '#3a3346');
    }
  });
  ctx.globalAlpha = 1;
}

function drawFog(ctx: Ctx, t: number): void {
  // Low drifting fog, dithered so it never shows hard edges.
  ctx.fillStyle = '#8a82a6';
  for (let band = 0; band < 3; band++) {
    const yc = 84 + band * 6;
    const off = (t / (26000 + band * 8000)) * SCENE_W;
    const density = 0.32 - band * 0.06;
    for (let x = 0; x < SCENE_W; x++) {
      const wx = x + off;
      const h = 2.5 + 2 * Math.sin(wx / 17 + band) + Math.sin(wx / 6.3);
      for (let dy = -3; dy <= 3; dy++) {
        const fall = 1 - Math.abs(dy) / Math.max(1, h);
        if (fall <= 0) continue;
        if (noise(Math.floor(wx) + band * 977, yc + dy) < fall * density) {
          ctx.globalAlpha = 0.28;
          ctx.fillRect(x, yc + dy, 1, 1);
        }
      }
    }
  }
  ctx.globalAlpha = 1;
}

function drawCanopyLamps(ctx: Ctx, t: number): void {
  for (const [i, x] of [
    [0, 57],
    [1, 87],
  ] as const) {
    rect(ctx, x, 72, 1, 4, '#1b1621');
    rect(ctx, x - 2, 76, 5, 3, '#2a2432');
    const flick = Math.sin(t / 97 + i * 3) * Math.sin(t / 411 + i);
    const on = flick > -0.9;
    rect(ctx, x - 1, 77, 3, 2, on ? '#ffe2a0' : '#8a6a40');
    if (on) {
      glow(ctx, x, 80, 11, '#ffcf80', 0.32);
      // Reflection in the puddle below.
      ctx.globalAlpha = 0.35;
      for (let k = 0; k < 4; k++) rect(ctx, x - 1 + ((t / 300 + k) % 2 > 1 ? 1 : 0), PLATFORM_TOP + 1 + k, 2, 1, '#ffd890');
      ctx.globalAlpha = 1;
    }
  }
}

function drawLocoLights(ctx: Ctx, r: Record<RepairId, boolean>, t: number): void {
  if (r.fireboxDoor) {
    const f = Math.sin(t / 130) + Math.sin(t / 47) * 0.5;
    const hot = f > 0.4 ? '#ffd27a' : f > -0.4 ? '#ffae4a' : '#f08a34';
    for (let i = 0; i < 3; i++) rect(ctx, 171, 95 + i * 2, 7, 1, hot);
    glow(ctx, 174, 98, 12, '#ff9a3c', 0.55 + 0.1 * f);
  }
  if (r.dryCab) glow(ctx, 169, 85, 10, '#ffb060', 0.35);
  if (r.headlamp) {
    // Beam into the rain and fog, stopping short as if hitting a wall.
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#fff1c8';
    for (let i = 0; i < 9; i++) ctx.fillRect(248 + i, 81 - Math.floor(i / 2), 1, 1 + i);
    ctx.globalAlpha = 1;
    glow(ctx, 245, 81, 8, '#fff1c8', 0.6);
  }
  if (r.boiler) {
    // Gauge glint and steam from the safety valve and chimney.
    for (let i = 0; i < 7; i++) {
      const life = ((t / 2400 + i / 7) % 1 + 1) % 1;
      ctx.globalAlpha = 0.55 * (1 - life);
      disc(ctx, 232 - life * 40 + Math.sin(life * 6 + i) * 2, 64 - life * 34, 2 + Math.floor(life * 6), '#d8d0e0');
    }
    for (let i = 0; i < 3; i++) {
      const life = ((t / 1300 + i / 3) % 1 + 1) % 1;
      ctx.globalAlpha = 0.4 * (1 - life);
      disc(ctx, 193 - life * 8, 78 - life * 12, 1 + Math.floor(life * 3), '#ffffff');
    }
    ctx.globalAlpha = 1;
  }
}

interface Drop {
  x: number;
  y: number;
  speed: number;
  len: number;
}

function makeRain(): Drop[] {
  const drops: Drop[] = [];
  for (let i = 0; i < 110; i++) {
    drops.push({ x: noise(i, 1) * (SCENE_W + 60), y: noise(i, 2) * SCENE_H, speed: 0.11 + noise(i, 3) * 0.07, len: 3 + Math.floor(noise(i, 4) * 4) });
  }
  return drops;
}

function drawRain(ctx: Ctx, drops: Drop[], t: number, dryCab: boolean): void {
  ctx.fillStyle = '#7d8aa8';
  for (const d of drops) {
    const y = (d.y + t * d.speed) % (SCENE_H + 20) - 10;
    const x = (d.x - (t * d.speed) / 4) % (SCENE_W + 60);
    // Shelter: no rain under the canopy roof.
    const underCanopy = x > 36 && x < 110 && y > 66 && y < PLATFORM_TOP;
    if (underCanopy) continue;
    ctx.globalAlpha = 0.35;
    for (let k = 0; k < d.len; k++) ctx.fillRect(Math.round(x - k / 4), Math.round(y - k), 1, 1);
  }
  ctx.globalAlpha = 1;
  // Splashes on the platform edge and on the rail.
  for (let i = 0; i < 6; i++) {
    const phase = Math.floor(t / 180 + i * 7);
    const sx = Math.floor(noise(phase, i) * SCENE_W);
    const sy = sx > 34 && sx < 126 && noise(phase, 9) > 0.5 && (sx < 36 || sx > 110) ? PLATFORM_TOP - 1 : RAIL_Y - 2;
    px(ctx, sx, sy, '#aab4cc');
    px(ctx, sx - 1, sy - 1, '#6a7490');
    px(ctx, sx + 1, sy - 1, '#6a7490');
  }
  // Rain dripping off the canopy edge.
  for (let i = 0; i < 8; i++) {
    const x = 38 + i * 9;
    const y = 75 + ((t / 9 + i * 13) % 29);
    px(ctx, x, y, '#8a96b4');
  }
  // Leaking cab roof.
  if (!dryCab) {
    for (let i = 0; i < 3; i++) {
      const x = [163, 165, 175][i] ?? 163;
      const y = 71 + ((t / 7 + i * 11) % 16);
      px(ctx, x, y, '#8a96b4');
    }
  }
}

const SPOTS: Record<FigureSpot, { x: number; y: number; flip: boolean }> = {
  idle: { x: 92, y: PLATFORM_TOP - 12, flip: false },
  platform: { x: 60, y: PLATFORM_TOP - 12, flip: false },
  cabinet: { x: 100, y: PLATFORM_TOP - 12, flip: false },
  shed: { x: 38, y: 110 - 12, flip: true },
  engine: { x: 140, y: RAIL_Y - 13, flip: false },
};

function drawFigures(ctx: Ctx, s: SceneState, t: number): void {
  if (s.tobinHere) drawSprite(ctx, TOBIN_FIGURE, 22, 98, false);
  if (s.maraHere) {
    drawSprite(ctx, MARA_FIGURE, 74, PLATFORM_TOP - 12, true);
    glow(ctx, 77, PLATFORM_TOP - 6, 6, '#5fe3d6', 0.5 + 0.1 * Math.sin(t / 500));
  }
  const spot = SPOTS[s.spot];
  const crouch = s.working && Math.floor(t / 420) % 2 === 1;
  drawSprite(ctx, crouch ? SCAVENGER_CROUCH : SCAVENGER_STAND, spot.x, spot.y, spot.flip);
  glow(ctx, spot.x + (spot.flip ? 1 : 7), spot.y + 8, 7, '#ffd08a', 0.45);
  if (s.working) {
    const step = Math.floor(t / 160);
    if (s.spot === 'engine') {
      // Sparks from the hammer.
      for (let i = 0; i < 4; i++) if ((step + i) % 3 === 0) px(ctx, spot.x + 9 + i, spot.y + 4 - ((step + i * 2) % 4), i % 2 ? '#ffd782' : '#ff9a3c');
    } else if (step % 6 === 0) {
      px(ctx, spot.x + 9, spot.y + 9, '#ffd782');
    }
  }
}

// ---------- renderer ----------

export class FallbackScene {
  private readonly ctx: Ctx;
  private readonly backdrop: HTMLCanvasElement;
  private readonly loco: HTMLCanvasElement;
  private backdropKey = '';
  private locoKey = '';
  private readonly rain = makeRain();
  private last = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.width = SCENE_W;
    canvas.height = SCENE_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
    this.backdrop = offscreen();
    this.loco = offscreen();
  }

  /** ~12 fps: a deliberate, battery-friendly pixel-art cadence. */
  draw(s: SceneState, t: number, force = false): void {
    if (!force && t - this.last < 80) return;
    this.last = t;
    this.refreshCaches(s);
    const ctx = this.ctx;
    ctx.clearRect(0, 0, SCENE_W, SCENE_H);
    ctx.drawImage(this.backdrop, 0, 0);
    drawSmoke(ctx, t);
    drawSignal(ctx, t, s.repairs.boiler);
    drawFog(ctx, t);
    drawCanopyLamps(ctx, t);
    ctx.drawImage(this.loco, 0, 0);
    drawLocoLights(ctx, s.repairs, t);
    drawFigures(ctx, s, t);
    drawRain(ctx, this.rain, t, s.repairs.dryCab);
    this.canvas.dataset.ready = 'true';
  }

  private refreshCaches(s: SceneState): void {
    const bKey = `${s.shedOpen}|${s.cabinetOpen}`;
    if (bKey !== this.backdropKey) {
      this.backdropKey = bKey;
      const b = this.backdrop.getContext('2d');
      if (b) {
        b.clearRect(0, 0, SCENE_W, SCENE_H);
        drawSky(b);
        drawTown(b);
        drawGround(b);
        drawShed(b, s.shedOpen);
        drawPlatform(b);
        drawCabinet(b, s.cabinetOpen);
        drawTrack(b);
      }
    }
    const lKey = JSON.stringify(s.repairs);
    if (lKey !== this.locoKey) {
      this.locoKey = lKey;
      const l = this.loco.getContext('2d');
      if (l) {
        l.clearRect(0, 0, SCENE_W, SCENE_H);
        drawLocomotive(l, s.repairs);
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
