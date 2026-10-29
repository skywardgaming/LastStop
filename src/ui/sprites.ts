// Original placeholder pixel art, stored as character maps.
// Each character maps to a palette colour; '.' is transparent.

import type { ResourceId } from '../core/data';

export type Palette = Record<string, string>;

export interface Sprite {
  rows: string[];
  palette: Palette;
}

export function drawSprite(ctx: CanvasRenderingContext2D, sprite: Sprite, x: number, y: number): void {
  sprite.rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const colour = sprite.palette[row[dx] ?? '.'];
      if (!colour) continue;
      ctx.fillStyle = colour;
      ctx.fillRect(x + dx, y + dy, 1, 1);
    }
  });
}

const FIGURE_PALETTE: Palette = {
  h: '#3d4c63',
  H: '#2a3446',
  s: '#e3b58c',
  c: '#6b4f3a',
  C: '#4a3628',
  b: '#1d1719',
  l: '#8e7a52',
  L: '#ffd782',
};

/** The scavenger: a hooded traveller with a lantern. */
export const SCAVENGER_STAND: Sprite = {
  palette: FIGURE_PALETTE,
  rows: [
    '..hhh...',
    '.hhhhh..',
    '.hHssh..',
    '..hhh...',
    '.cccccc.',
    'cCcccCcl',
    'c.cccC.l',
    '..cccC.L',
    '..ccccC.',
    '..cC.cC.',
    '..cC.cC.',
    '..bb.bb.',
  ],
};

export const SCAVENGER_CROUCH: Sprite = {
  palette: FIGURE_PALETTE,
  rows: [
    '........',
    '........',
    '...hhh..',
    '..hhhhh.',
    '..hHssh.',
    '.ccchh..',
    'cCcccccl',
    'L.cccCcl',
    '..cccCC.',
    '.cCccCc.',
    '.cC..cC.',
    '.bb..bb.',
  ],
};

const ICONS: Record<ResourceId, Sprite> = {
  scrapIron: {
    palette: { '#': '#4b4652', o: '#8d8794', O: '#b3adb8', r: '#a5502b', R: '#6e3220' },
    rows: [
      '..........',
      '..##......',
      '.#Oo#.....',
      '.#ooo##...',
      '..#ooo##..',
      '...##oo#..',
      '.##..#o#..',
      '#rr#..##..',
      '#rRr#.....',
      '.###......',
    ],
  },
  copperWire: {
    palette: { w: '#d9874a', W: '#f2b57a', d: '#8a4a26' },
    rows: [
      '...wwww...',
      '..W....w..',
      '.W.wwww.d.',
      '.w.w..w.d.',
      '.w.w..d.d.',
      '.w..dd..d.',
      '..w....d..',
      '...wddd.w.',
      '.........w',
      '..........',
    ],
  },
  brassCog: {
    palette: { g: '#d4ab4e', G: '#8c6a2b', y: '#f3d68a' },
    rows: [
      '...g..g...',
      '..gyyggg..',
      '.gyggGggg.',
      'ggGG..GGgg',
      '.gG....Gg.',
      '.gG....Gg.',
      'ggGG..GGgg',
      '.gggGGggg.',
      '..gggggg..',
      '...g..g...',
    ],
  },
};

const iconCache = new Map<ResourceId, string>();

/** Renders a resource icon once and returns it as a data URL for <img>. */
export function iconUrl(id: ResourceId): string {
  const cached = iconCache.get(id);
  if (cached) return cached;
  const sprite = ICONS[id];
  const canvas = document.createElement('canvas');
  canvas.width = 10;
  canvas.height = 10;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  drawSprite(ctx, sprite, 0, 0);
  const url = canvas.toDataURL();
  iconCache.set(id, url);
  return url;
}

/** A tiny 3×5 pixel font with just the glyphs the station sign needs. */
export const GLYPHS: Record<string, string[]> = {
  L: ['#..', '#..', '#..', '#..', '###'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  S: ['###', '#..', '###', '..#', '###'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  P: ['###', '#.#', '###', '#..', '#..'],
  '9': ['###', '#.#', '###', '..#', '###'],
  ' ': ['..', '..', '..', '..', '..'],
};

export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, colour: string): void {
  let cx = x;
  for (const ch of text) {
    const glyph = GLYPHS[ch];
    if (!glyph) continue;
    drawSprite(ctx, { rows: glyph, palette: { '#': colour } }, cx, y);
    cx += (glyph[0]?.length ?? 3) + 1;
  }
}

export function textWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += (GLYPHS[ch]?.[0]?.length ?? 3) + 1;
  return Math.max(0, w - 1);
}
