// The train scene: a night-time siding drawn pixel by pixel on a 192×108
// canvas and scaled up with crisp edges. All art is original placeholder work.

import { drawSprite, drawText, SCAVENGER_CROUCH, SCAVENGER_STAND, textWidth } from './sprites';

export const SCENE_W = 192;
export const SCENE_H = 108;

const HORIZON = 64;
const RAIL_Y = 92;

export interface SceneState {
  scavenging: boolean;
  fireboxRepaired: boolean;
}

type Ctx = CanvasRenderingContext2D;

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, colour: string): void {
  ctx.fillStyle = colour;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function disc(ctx: Ctx, cx: number, cy: number, r: number, colour: string): void {
  ctx.fillStyle = colour;
  for (let dy = -r; dy <= r; dy++) {
    const span = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.6));
    ctx.fillRect(Math.round(cx - span), Math.round(cy + dy), span * 2 + 1, 1);
  }
}

/** Deterministic hash noise in [0, 1) so the scene looks identical every frame. */
function noise(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------- static backdrop (rendered once) ----------

const SKY = ['#110e20', '#18132e', '#22173b', '#311c46', '#45214b', '#5f294d', '#7d334c', '#a1444a', '#c45d42'];

function drawSky(ctx: Ctx): void {
  const band = HORIZON / SKY.length;
  for (let y = 0; y < HORIZON; y++) {
    const pos = y / band;
    const i = Math.floor(pos);
    const frac = pos - i;
    for (let x = 0; x < SCENE_W; x++) {
      // Ordered dithering between bands keeps the gradient pixel-true.
      const threshold = ((x % 2) + (y % 2) * 2 + 0.5) / 4;
      const idx = frac > 0.6 && threshold < (frac - 0.6) * 2.5 ? i + 1 : i;
      ctx.fillStyle = SKY[Math.min(idx, SKY.length - 1)] ?? '#000';
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // A low, cold moon behind thin cloud.
  disc(ctx, 34, 18, 6, '#e9dcc3');
  disc(ctx, 36, 17, 5, '#f6ecd6');
  rect(ctx, 22, 20, 30, 1, '#3a2346');
  rect(ctx, 26, 22, 22, 1, '#311c46');
}

function drawHills(ctx: Ctx): void {
  for (let x = 0; x < SCENE_W; x++) {
    const far = HORIZON - 9 - Math.round(4 * Math.sin(x / 17) + 3 * Math.sin(x / 7 + 1.3));
    rect(ctx, x, far, 1, HORIZON - far, '#2b1d3b');
    const near = HORIZON - 3 - Math.round(3 * Math.sin(x / 11 + 2) + 2 * Math.sin(x / 5));
    rect(ctx, x, near, 1, HORIZON - near + 1, '#1f1630');
  }
  // Distant pines on the near ridge.
  for (let x = 4; x < SCENE_W; x += 5 + Math.floor(noise(x, 3) * 6)) {
    const h = 4 + Math.floor(noise(x, 9) * 6);
    const base = HORIZON - 2;
    for (let i = 0; i < h; i++) {
      const w = Math.max(1, Math.floor((h - i) / 2.5));
      rect(ctx, x - Math.floor(w / 2), base - i, w, 1, '#171124');
    }
  }
}

function drawGround(ctx: Ctx): void {
  rect(ctx, 0, HORIZON, SCENE_W, SCENE_H - HORIZON, '#17121d');
  for (let y = HORIZON; y < SCENE_H; y++) {
    for (let x = 0; x < SCENE_W; x++) {
      const n = noise(x, y);
      if (n > 0.93) rect(ctx, x, y, 1, 1, '#2a2231');
      else if (n < 0.03) rect(ctx, x, y, 1, 1, '#0f0b13');
    }
  }
}

function drawPoles(ctx: Ctx): void {
  const poles = [8, 78, 150];
  for (const x of poles) {
    rect(ctx, x, 30, 2, HORIZON - 28, '#150f1b');
    rect(ctx, x - 4, 32, 10, 1, '#150f1b');
    rect(ctx, x - 4, 31, 1, 1, '#4c3d52');
    rect(ctx, x + 5, 31, 1, 1, '#4c3d52');
  }
  // Sagging wires between poles.
  for (let i = 0; i < poles.length - 1; i++) {
    const a = poles[i] ?? 0;
    const b = poles[i + 1] ?? 0;
    for (let x = a; x <= b; x++) {
      const t = (x - a) / (b - a);
      const sag = Math.round(5 * 4 * t * (1 - t));
      rect(ctx, x, 32 + sag, 1, 1, '#120d18');
    }
  }
}

function drawPlatform(ctx: Ctx): void {
  const top = 76;
  rect(ctx, 0, top, 76, 2, '#5a4b5d');
  rect(ctx, 0, top + 2, 76, 1, '#3c3142');
  rect(ctx, 0, top + 3, 76, RAIL_Y - top - 5, '#2b2331');
  // Brick courses on the platform face.
  for (let y = top + 4; y < RAIL_Y - 3; y += 3) {
    for (let x = (y % 2) * 3; x < 76; x += 6) rect(ctx, x, y, 1, 2, '#231c29');
    rect(ctx, 0, y + 2, 76, 1, '#221b28');
  }
  rect(ctx, 76, top, 1, RAIL_Y - top - 2, '#1a141f');

  // Station shelter.
  rect(ctx, 50, 52, 26, 2, '#3e3445');
  rect(ctx, 50, 54, 26, 1, '#1c1621');
  rect(ctx, 52, 55, 2, top - 55, '#221b27');
  rect(ctx, 72, 55, 2, top - 55, '#221b27');
  rect(ctx, 56, 70, 14, 2, '#3b2c27'); // bench
  rect(ctx, 57, 72, 1, 4, '#251c1a');
  rect(ctx, 68, 72, 1, 4, '#251c1a');

  // Station sign: LAST STOP / 9
  const label = 'LAST STOP';
  const w = textWidth(label) + 6;
  const sx = 26;
  const sy = 44;
  rect(ctx, sx + 4, sy - 6, 1, 6, '#1a141f');
  rect(ctx, sx + w - 5, sy - 6, 1, 6, '#1a141f');
  rect(ctx, sx, sy, w, 9, '#1c2b2a');
  rect(ctx, sx, sy, w, 1, '#3a5550');
  rect(ctx, sx, sy + 8, w, 1, '#101917');
  drawText(ctx, label, sx + 3, sy + 2, '#c9d8c0');
}

function drawTrack(ctx: Ctx): void {
  rect(ctx, 0, RAIL_Y + 1, SCENE_W, 5, '#221a24');
  for (let x = 0; x < SCENE_W; x++) {
    for (let y = RAIL_Y + 1; y < RAIL_Y + 6; y++) {
      if (noise(x + 400, y) > 0.7) rect(ctx, x, y, 1, 1, '#3a2f3b');
    }
  }
  for (let x = 2; x < SCENE_W; x += 7) rect(ctx, x, RAIL_Y + 2, 4, 2, '#2e211d');
  rect(ctx, 0, RAIL_Y - 1, SCENE_W, 2, '#5e5263');
  rect(ctx, 0, RAIL_Y - 1, SCENE_W, 1, '#968a98');
}

function drawScrapPile(ctx: Ctx): void {
  const cols = ['#5b4e57', '#7a3b26', '#8d8794', '#3d343f', '#a5502b'];
  for (let i = 0; i < 46; i++) {
    const x = 34 + Math.floor(noise(i, 71) * 14);
    const h = Math.floor(6 - Math.abs(x - 41) * 0.7);
    if (h <= 0) continue;
    const y = 76 - Math.floor(noise(i, 13) * h) - 1;
    rect(ctx, x, y, 1 + Math.floor(noise(i, 5) * 2), 1, cols[i % cols.length] ?? '#555');
  }
  rect(ctx, 43, 68, 1, 8, '#4b4652'); // a bent pipe
  rect(ctx, 44, 67, 2, 1, '#4b4652');
}

// ---------- locomotive ----------

function drawWheel(ctx: Ctx, cx: number, cy: number, r: number): void {
  disc(ctx, cx, cy, r, '#4c3f45');
  disc(ctx, cx, cy, r - 1, '#211a1e');
  rect(ctx, cx - r + 1, cy, (r - 1) * 2 + 1, 1, '#3b3036');
  rect(ctx, cx, cy - r + 1, 1, (r - 1) * 2 + 1, '#3b3036');
  rect(ctx, cx, cy, 1, 1, '#8e7a52');
}

function drawLocomotive(ctx: Ctx, s: SceneState, t: number): void {
  const RUST = '#7a3a24';
  const RUST_D = '#552616';
  const BODY = '#3a2b2d';
  const BODY_D = '#241a1c';
  const BODY_L = '#56403f';
  const BRASS = '#a58a4e';

  // Frame and running board.
  rect(ctx, 92, 79, 92, 3, '#1b1416');
  rect(ctx, 92, 78, 92, 1, '#4a3a3a');

  // Boiler: a shaded cylinder, light from the lamp side.
  const shades = [BODY_L, BODY_L, BODY, BODY, BODY, BODY, BODY, BODY_D, BODY_D, BODY_D, '#1b1416'];
  const boilerTop = 58;
  for (let i = 0; i < 20; i++) {
    const c = shades[Math.min(shades.length - 1, Math.floor((i / 20) * shades.length))] ?? BODY;
    rect(ctx, 122, boilerTop + i, 56, 1, c);
  }
  rect(ctx, 178, boilerTop + 2, 3, 16, '#2c2224'); // smokebox door
  rect(ctx, 181, boilerTop + 5, 1, 10, '#1b1416');
  // Brass boiler bands.
  for (const bx of [134, 152, 168]) rect(ctx, bx, boilerTop, 1, 20, BRASS);

  // Rust streaks.
  for (let x = 122; x < 178; x++) {
    for (let y = boilerTop; y < boilerTop + 20; y++) {
      const n = noise(x, y + 50);
      if (n > 0.86) rect(ctx, x, y, 1, 1, n > 0.95 ? RUST : RUST_D);
    }
  }

  // Steam dome and smokestack.
  rect(ctx, 146, 52, 10, 6, BODY);
  rect(ctx, 147, 51, 8, 1, BODY_L);
  rect(ctx, 148, 50, 6, 1, BRASS);
  rect(ctx, 166, 46, 8, 12, BODY_D);
  rect(ctx, 164, 43, 12, 3, BODY);
  rect(ctx, 164, 43, 12, 1, BODY_L);

  // Headlamp: cold and cracked until the engine has fire.
  rect(ctx, 176, 52, 6, 6, '#2c2224');
  rect(ctx, 177, 53, 4, 4, s.fireboxRepaired ? '#f0c878' : '#3d3a40');
  if (!s.fireboxRepaired) rect(ctx, 178, 54, 1, 2, '#5d5a62');

  // Cowcatcher.
  for (let i = 0; i < 8; i++) rect(ctx, 181 + Math.floor(i / 2), 80 + i, 8 - Math.floor(i / 2), 1, i % 2 ? '#2a2022' : '#4a3a3a');

  // Cab.
  rect(ctx, 94, 48, 28, 30, BODY);
  rect(ctx, 94, 48, 1, 30, BODY_L);
  rect(ctx, 121, 48, 1, 30, BODY_D);
  rect(ctx, 91, 45, 34, 3, '#2a2022');
  rect(ctx, 91, 45, 34, 1, BODY_L);
  // Cab window.
  rect(ctx, 99, 52, 16, 9, '#141017');
  rect(ctx, 99, 52, 16, 1, '#0c090d');
  rect(ctx, 107, 52, 1, 9, '#2a2022');
  if (s.fireboxRepaired) {
    rect(ctx, 100, 57, 6, 4, '#4a2a1c');
    rect(ctx, 108, 57, 6, 4, '#4a2a1c');
  }
  // Number plate.
  rect(ctx, 99, 63, 7, 9, BRASS);
  rect(ctx, 100, 64, 5, 7, '#2a2022');
  drawText(ctx, '9', 101, 65, BRASS);

  // Firebox door.
  const fx = 109;
  const fy = 64;
  if (s.fireboxRepaired) {
    const flicker = Math.sin(t / 130) + Math.sin(t / 47) * 0.5;
    const hot = flicker > 0.4 ? '#ffd27a' : flicker > -0.4 ? '#ffae4a' : '#f08a34';
    rect(ctx, fx, fy, 10, 9, '#2a2022');
    rect(ctx, fx + 1, fy + 1, 8, 7, '#7a3a24');
    for (let i = 0; i < 3; i++) rect(ctx, fx + 2, fy + 2 + i * 2, 6, 1, hot);
    rect(ctx, fx + 8, fy + 4, 1, 2, BRASS);
    // Warm spill onto the cab.
    ctx.globalAlpha = 0.18 + 0.06 * flicker;
    disc(ctx, fx + 5, fy + 4, 10, '#ff9a3c');
    ctx.globalAlpha = 1;
  } else {
    rect(ctx, fx, fy, 10, 9, '#0d0a0e');
    rect(ctx, fx + 1, fy + 6, 3, 1, '#2a1a14'); // cold ash
    // Door hanging off one hinge.
    for (let i = 0; i < 9; i++) rect(ctx, fx + 9 + Math.floor(i / 3), fy + i, 3, 1, i % 3 === 0 ? RUST : RUST_D);
  }

  // Wheels and coupling rod.
  drawWheel(ctx, 110, 85, 6);
  drawWheel(ctx, 128, 85, 6);
  drawWheel(ctx, 146, 85, 6);
  drawWheel(ctx, 168, 87, 4);
  rect(ctx, 110, 85, 37, 1, '#6f6a70');
}

// ---------- animated layers ----------

function drawStars(ctx: Ctx, t: number): void {
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(noise(i, 1) * SCENE_W);
    const y = Math.floor(noise(i, 2) * (HORIZON - 26));
    if (x > 25 && x < 45 && y > 9 && y < 27) continue; // keep the moon clear
    const tw = Math.sin(t / 600 + i * 1.7);
    if (tw < -0.6) continue;
    rect(ctx, x, y, 1, 1, tw > 0.7 ? '#f4ecd8' : '#8f86a8');
  }
}

function drawLamp(ctx: Ctx, t: number): void {
  const x = 16;
  rect(ctx, x, 40, 2, 36, '#140f19');
  rect(ctx, x - 2, 74, 6, 2, '#140f19');
  rect(ctx, x - 2, 36, 6, 4, '#2a2230');
  const flick = Math.sin(t / 90) * Math.sin(t / 370);
  const on = flick > -0.85;
  rect(ctx, x - 1, 37, 4, 2, on ? '#ffe2a0' : '#8a6a40');
  if (on) {
    ctx.globalAlpha = 0.1;
    disc(ctx, x + 1, 42, 16, '#ffd08a');
    ctx.globalAlpha = 0.12;
    disc(ctx, x + 1, 40, 7, '#ffe2a0');
    ctx.globalAlpha = 1;
  }
  // Moths circling the light.
  for (let i = 0; i < 3; i++) {
    const a = t / (700 + i * 230) + i * 2.1;
    rect(ctx, x + 1 + Math.round(Math.cos(a) * (5 + i * 2)), 38 + Math.round(Math.sin(a * 1.3) * 4), 1, 1, '#d8cfb8');
  }
}

function drawScavenger(ctx: Ctx, s: SceneState, t: number): void {
  if (s.scavenging) {
    const frame = Math.floor(t / 420) % 2;
    drawSprite(ctx, frame ? SCAVENGER_CROUCH : SCAVENGER_STAND, 26, 64 + (frame ? 0 : 0));
    // Sparks of found metal.
    if (Math.floor(t / 210) % 5 === 0) rect(ctx, 37 + (Math.floor(t / 210) % 3), 70, 1, 1, '#ffd782');
    ctx.globalAlpha = 0.14;
    disc(ctx, frame ? 26 : 33, 72, 6, '#ffd08a');
    ctx.globalAlpha = 1;
  } else {
    drawSprite(ctx, SCAVENGER_STAND, 26, 64);
  }
}

function drawSteam(ctx: Ctx, t: number): void {
  for (let i = 0; i < 6; i++) {
    const life = ((t / 2600 + i / 6) % 1 + 1) % 1;
    const x = 170 - life * 34 + Math.sin(life * 6 + i) * 2;
    const y = 40 - life * 30;
    const r = 2 + Math.floor(life * 5);
    ctx.globalAlpha = 0.5 * (1 - life);
    disc(ctx, x, y, r, '#cfc6d6');
    ctx.globalAlpha = 1;
  }
}

function drawDrift(ctx: Ctx, t: number): void {
  // Slow drifting dust motes in the cold air.
  for (let i = 0; i < 14; i++) {
    const x = (noise(i, 31) * SCENE_W + t / (90 + i * 13)) % SCENE_W;
    const y = 20 + noise(i, 37) * 60 + Math.sin(t / 900 + i) * 3;
    ctx.globalAlpha = 0.35;
    rect(ctx, x, y, 1, 1, '#b8afc8');
    ctx.globalAlpha = 1;
  }
}

// ---------- public renderer ----------

export class TrainScene {
  private readonly ctx: Ctx;
  private readonly backdrop: HTMLCanvasElement;
  private lastFrame = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.width = SCENE_W;
    canvas.height = SCENE_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;

    this.backdrop = document.createElement('canvas');
    this.backdrop.width = SCENE_W;
    this.backdrop.height = SCENE_H;
    const b = this.backdrop.getContext('2d');
    if (b) {
      drawSky(b);
      drawHills(b);
      drawPoles(b);
      drawGround(b);
      drawPlatform(b);
      drawScrapPile(b);
      drawTrack(b);
    }
  }

  /** Draws at most ~12 fps — a deliberate, low-power pixel-art cadence. */
  draw(state: SceneState, t: number): void {
    if (t - this.lastFrame < 80) return;
    this.lastFrame = t;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, SCENE_W, SCENE_H);
    ctx.drawImage(this.backdrop, 0, 0);
    drawStars(ctx, t);
    drawDrift(ctx, t);
    drawLamp(ctx, t);
    if (state.fireboxRepaired) drawSteam(ctx, t);
    drawLocomotive(ctx, state, t);
    drawScavenger(ctx, state, t);
    this.canvas.dataset.ready = 'true';
  }
}
