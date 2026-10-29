// Original pixel art stored as character maps. Each character maps to a
// palette colour; '.' is transparent.

import type { ItemId } from '../core/content/items';
import type { SpeakerId } from '../core/content/story';
import { artUrl, DISCOVERY_ART, ITEM_ART, NAV_ART, portraitArt, type ArtSpeaker, type Mood } from './art';
import { EXTRA_SPRITES } from './sprites-extra';

export type Palette = Record<string, string>;
export interface Sprite {
  rows: string[];
  palette: Palette;
}

export function drawSprite(ctx: CanvasRenderingContext2D, sprite: Sprite, x: number, y: number, flip = false): void {
  const w = sprite.rows[0]?.length ?? 0;
  sprite.rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const colour = sprite.palette[row[dx] ?? '.'];
      if (!colour) continue;
      ctx.fillStyle = colour;
      ctx.fillRect(Math.round(x + (flip ? w - 1 - dx : dx)), Math.round(y + dy), 1, 1);
    }
  });
}

const cache = new Map<string, string>();

/** Renders a sprite once to a data URL for use in <img>. */
export function spriteUrl(key: string, sprite: Sprite): string {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = sprite.rows[0]?.length ?? 1;
  canvas.height = sprite.rows.length;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  drawSprite(ctx, sprite, 0, 0);
  const url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}

// ---------- item icons (12×12) ----------

const METAL = { k: '#2a2530', d: '#4b4652', m: '#8d8794', l: '#c3bdc8' };
const RUST = { r: '#a5502b', R: '#6e3220' };
const BRASS = { y: '#f3d68a', g: '#d4ab4e', G: '#8c6a2b' };
const COPPER = { c: '#e0884a', C: '#a3552a', h: '#f6c08e' };
const CYAN = { a: '#bff7f2', b: '#5fe3d6', B: '#1e8f8c', N: '#0f4c52' };
const WOOD = { w: '#b07a46', W: '#7a4f2a', v: '#d39a5c' };

/** Code-drawn fallbacks; Astra's art (ITEM_ART) is used wherever it exists. */
export const ITEM_SPRITES: Partial<Record<ItemId, Sprite>> & Record<string, Sprite> = {
  scrapIron: {
    palette: { ...METAL, ...RUST },
    rows: [
      '............',
      '...dd.......',
      '..dlmd......',
      '..dmmmdd....',
      '...dmmmmd...',
      '....ddmmd.r.',
      '..dd..dmd.rR',
      '.drrd..dd.R.',
      '.drRrd......',
      '..dddd..dmd.',
      '........dd..',
      '............',
    ],
  },
  coalLump: {
    palette: { k: '#141016', d: '#2b2430', m: '#4a4252', l: '#8a7f96', o: '#ff8a3a' },
    rows: [
      '............',
      '............',
      '....ddd.....',
      '...dmlmd....',
      '..dmmdmmd...',
      '..dmdkdmdd..',
      '.ddmkkdmmd..',
      '.dkdkkkdmd..',
      '..dkkokkdd..',
      '...dddddd...',
      '............',
      '............',
    ],
  },
  glassShard: {
    palette: { a: '#e6f6ff', b: '#9fc8de', B: '#5a7f96', d: '#2f4656' },
    rows: [
      '............',
      '......d.....',
      '.....dad....',
      '.....dabd...',
      '....dabbd...',
      '....dabBd...',
      '...dabbBd...',
      '...dabBBd...',
      '..dabbBd....',
      '..dbBBd.....',
      '..ddd.......',
      '............',
    ],
  },
  copperWire: {
    palette: COPPER,
    rows: [
      '............',
      '...cccc.....',
      '..h....c....',
      '.h.cccc.C...',
      '.c.c..C.C...',
      '.c.c..C.C...',
      '.c..CC..C...',
      '..c....C....',
      '...cCCC.c...',
      '.........c..',
      '..........C.',
      '............',
    ],
  },
  brassCog: {
    palette: BRASS,
    rows: [
      '............',
      '....g..g....',
      '...gyyggg...',
      '..gyggGggg..',
      '.ggGG..GGgg.',
      '..gG....Gg..',
      '..gG....Gg..',
      '.ggGG..GGgg.',
      '..gggGGggg..',
      '...gggggg...',
      '....g..g....',
      '............',
    ],
  },
  signalRelay: {
    palette: { ...METAL, s: '#3e6b5a', S: '#24443a', o: '#ffcf6a', c: '#e0884a' },
    rows: [
      '............',
      '..c......c..',
      '..c......c..',
      '.dddddddddd.',
      '.dsssssssSd.',
      '.dsoSssssSd.',
      '.dsSSssssSd.',
      '.dssssssSSd.',
      '.dSSSSSSSSd.',
      '.dddddddddd.',
      '...d....d...',
      '............',
    ],
  },
  cyanPrism: {
    palette: CYAN,
    rows: [
      '............',
      '.....N......',
      '....NaN.....',
      '....Nab.N...',
      '...NabbN....',
      '...NabbBN...',
      '..NabbbBN...',
      '..NabbBBN...',
      '.NabbbBBBN..',
      '.NNNNNNNNN..',
      '..b.....b...',
      '............',
    ],
  },
  oakTimber: {
    palette: WOOD,
    rows: [
      '............',
      '............',
      '.WWWWWWWWW..',
      '.WvvvvvvvwW.',
      '.WwwwwwwwwW.',
      '.WWWWWWWWWW.',
      '..WWWWWWWWW.',
      '..WvvvvvvvwW',
      '..WwwwwwwwwW',
      '..WWWWWWWWWW',
      '............',
      '............',
    ],
  },
  steelRivets: {
    palette: { ...METAL, t: '#5b6e7a', T: '#3a4852' },
    rows: [
      '............',
      '..tttttttt..',
      '.tTTTTTTTTt.',
      '.tT.l..l.Tt.',
      '.tTmm.mm.Tt.',
      '.tT.d..d.Tt.',
      '.tT..l...Tt.',
      '.tT.mm...Tt.',
      '.tT..d...Tt.',
      '.tTTTTTTTTt.',
      '..tttttttt..',
      '............',
    ],
  },
  pressureGauge: {
    palette: { ...BRASS, f: '#efe6cf', n: '#c0392b', k: '#2a2530' },
    rows: [
      '............',
      '....gggg....',
      '...gffffg...',
      '..gfk..kfg..',
      '.gf......fg.',
      '.gf..nn..fg.',
      '.gfk.nk..fg.',
      '.gf......fg.',
      '..gf....fg..',
      '...gggggg...',
      '.....GG.....',
      '....GGGG....',
    ],
  },
  ironPlate: {
    palette: METAL,
    rows: [
      '............',
      '............',
      '.dddddddddd.',
      '.dlllllllmd.',
      '.dlm.mmm.md.',
      '.dlmmmmmmmd.',
      '.dlmmmmmmmd.',
      '.dlm.mmm.md.',
      '.dmmmmmmmmd.',
      '.dddddddddd.',
      '............',
      '............',
    ],
  },
  fuelBrick: {
    palette: { k: '#1a1418', d: '#3a2c2e', m: '#5c4440', o: '#ff8a3a' },
    rows: [
      '............',
      '............',
      '............',
      '...mmmmmmmm.',
      '..mddddddmm.',
      '.mmmmmmmmdm.',
      '.mdkdkdkddm.',
      '.mdkokdkdd..',
      '.mddddddd...',
      '.mmmmmmmm...',
      '............',
      '............',
    ],
  },
  polishedLens: {
    palette: { a: '#ffffff', b: '#cfe9f5', B: '#86b3c9', d: '#3b5566', y: '#d4ab4e', G: '#8c6a2b' },
    rows: [
      '............',
      '....yyyy....',
      '...yGddGy...',
      '..yGabbBGy..',
      '..ydabbBdy..',
      '..ydbbBBdy..',
      '..ydbBBBdy..',
      '..yGbBBdGy..',
      '...yGddGy...',
      '....yyyy....',
      '............',
      '............',
    ],
  },
  copperCoil: {
    palette: { ...COPPER, k: '#2a2530', d: '#4b4652' },
    rows: [
      '............',
      '.....dd.....',
      '...hcccch...',
      '...CCCCCC...',
      '...hcccch...',
      '...CCCCCC...',
      '...hcccch...',
      '...CCCCCC...',
      '...hcccch...',
      '.....dd.....',
      '.....kk.....',
      '............',
    ],
  },
  timberBeam: {
    palette: { ...WOOD, k: '#2a1c14' },
    rows: [
      '............',
      '..........W.',
      '........WvW.',
      '......WvwW..',
      '....WvwwW...',
      '..WvwwWk....',
      '.WvwwW......',
      '.WwwW.......',
      '.kWW........',
      '............',
      '............',
      '............',
    ],
  },
  patchPanel: {
    palette: { ...METAL, y: '#d4ab4e' },
    rows: [
      '............',
      '.dddddddddd.',
      '.dlymmmmlyd.',
      '.dmmmmmmmmd.',
      '.dmmldddmmd.',
      '.dmmdlllmmd.',
      '.dmmdlllmmd.',
      '.dmmmmmmmmd.',
      '.dlymmmmlyd.',
      '.dddddddddd.',
      '............',
      '............',
    ],
  },
  gaugeAssembly: {
    palette: { ...BRASS, ...COPPER, f: '#efe6cf', n: '#c0392b', k: '#2a2530' },
    rows: [
      '...gggg.....',
      '..gffffg....',
      '.gfk.nfg....',
      '.gf.n.fg....',
      '..gffffg.cc.',
      '...gGGgchcC.',
      '....GG.cCCC.',
      '..ggGGGggg..',
      '.gyGkkkGgyg.',
      '.ggGGGGGggg.',
      '..g......g..',
      '............',
    ],
  },
};

export function itemIconUrl(id: ItemId): string {
  const art = ITEM_ART[id];
  if (art) return artUrl(art);
  const sprite = EXTRA_SPRITES[id] ?? ITEM_SPRITES[id];
  return sprite ? spriteUrl(`item:${id}`, sprite) : '';
}

export function discoveryIconUrl(id: string): string {
  const art = DISCOVERY_ART[id];
  return art ? artUrl(art) : '';
}

// ---------- tab icons (12×12) ----------

const UI = { o: '#f2a541', O: '#ffd27a', d: '#8a7f96', D: '#5a4f66', c: '#5fe3d6' };

export const TAB_SPRITES: Record<string, Sprite> = {
  station: {
    palette: UI,
    rows: [
      '.....dd.....',
      '....dddd....',
      '...dOOOOd...',
      '...dOooOd...',
      '...dOooOd...',
      '...ddddd....',
      '.....dd.....',
      '.....dd.....',
      '.....dd.....',
      '.....dd.....',
      '...dddddd...',
      '..dddddddd..',
    ],
  },
  skills: {
    palette: UI,
    rows: [
      '.........dd.',
      '........dDd.',
      '.......dDd..',
      '..oo..dDd...',
      '.oOOodDd....',
      '..oOOOd.....',
      '...oOOo.....',
      '..dDoOOo....',
      '.dDd.oOOo...',
      'dDd...oOo...',
      'dd.....o....',
      '............',
    ],
  },
  train: {
    palette: UI,
    rows: [
      '............',
      '.dd......dd.',
      '.dd......dd.',
      '.ddddd.dddd.',
      '.dOOdddddddo',
      '.dOOddddddd.',
      '.ddddddddddd',
      '.ddddddddddd',
      '..D.D..D..D.',
      '.DdD.DdD.DdD',
      '..D.D..D..D.',
      'oooooooooooo',
    ],
  },
  satchel: {
    palette: UI,
    rows: [
      '............',
      '....dddd....',
      '...d....d...',
      '..dddddddd..',
      '.dooooooood.',
      '.doOOOOOOod.',
      '.dooooooood.',
      '.dooodOoood.',
      '.dooooooood.',
      '.dooooooood.',
      '..dddddddd..',
      '............',
    ],
  },
  journal: {
    palette: UI,
    rows: [
      '............',
      '.dddddddddd.',
      '.dooooodoOd.',
      '.dooooodoOd.',
      '.doOOOodoOd.',
      '.dooooodoOd.',
      '.doOOOodoOd.',
      '.dooooodoOd.',
      '.dooooodoOd.',
      '.dddddddcdd.',
      '........c...',
      '............',
    ],
  },
};

export function tabIconUrl(id: string): string {
  const art = NAV_ART[id];
  if (art) return artUrl(art);
  const s = TAB_SPRITES[id];
  return s ? spriteUrl(`tab:${id}`, s) : '';
}

// ---------- portraits (20×20) ----------

export const PORTRAITS: Record<SpeakerId, Sprite> = {
  mara: {
    palette: {
      k: '#141018',
      h: '#2a1f2e',
      H: '#3e2c40',
      s: '#e7bb93',
      S: '#c48f6c',
      e: '#2a1f2e',
      c: '#2e4a5c',
      C: '#1f3442',
      l: '#5fe3d6',
      L: '#bff7f2',
      r: '#b84a4a',
    },
    rows: [
      '....................',
      '......hhhhhhh.......',
      '.....hHHHHHHHh......',
      '....hHHHHHHHHHh.....',
      '....hHhhhhhhhHh.....',
      '....hhssssssshh.....',
      '....hsssssssssh.....',
      '....hseesssessh.....',
      '....hsssssssssh.....',
      '.....ssssSssss......',
      '.....sssrrsss.......',
      '......SsssssS.......',
      '.......SSSSS........',
      '....cccSSSSccc......',
      '...cCcccccccccc..L..',
      '..cCccccccccccc.lLl.',
      '..cCcccccccccccc.l..',
      '.cCccccccccccccc.k..',
      '.cCccccccccccccckk..',
      '.cCccccccccccccc....',
    ],
  },
  tobin: {
    palette: {
      k: '#141018',
      g: '#9a9aa6',
      G: '#cfcfd8',
      s: '#d9a07a',
      S: '#ad7556',
      e: '#2a1f2e',
      b: '#3a3a52',
      B: '#262638',
      m: '#7a5a3a',
      w: '#e8e2d0',
      r: '#8a2f2f',
    },
    rows: [
      '....................',
      '.......bbbbbb.......',
      '.....bbbbbbbbbb.....',
      '....BBBBBBBBBBBB....',
      '...BBBBBBBBBBBBBB...',
      '.....gssssssssg.....',
      '.....gssssssssg.....',
      '.....seesssseess....',
      '.....ssssssssss.....',
      '.....ssssSSssss.....',
      '.....GGGGGGGGGG.....',
      '.....GGGwwwwGGG.....',
      '......GGGGGGGG......',
      '.......GGGGGG.......',
      '...mmmmmrrrrmmmmm...',
      '..mmmmmmmrrmmmmmmm..',
      '..mmmmmmmmmmmmmmmm..',
      '.mmmmmmmmmmmmmmmmmm.',
      '.mmmmkmmmmmmmmkmmmm.',
      '.mmmmkmmmmmmmmkmmmm.',
    ],
  },
};

export function portraitUrl(id: SpeakerId | 'you', mood: Mood = 'neutral'): string {
  const who: ArtSpeaker = id === 'you' ? 'conductor' : id;
  return portraitArt(who, mood);
}

/** Code-drawn portrait, used only if the art fails to load. */
export function fallbackPortraitUrl(id: SpeakerId): string {
  return spriteUrl(`portrait:${id}`, PORTRAITS[id]);
}

// ---------- tiny 3×5 pixel font for signs ----------

const GLYPHS: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  S: ['###', '#..', '###', '..#', '###'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  L: ['#..', '#..', '#..', '#..', '###'],
  E: ['###', '#..', '##.', '#..', '###'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  P: ['###', '#.#', '###', '#..', '#..'],
  N: ['#.#', '###', '###', '#.#', '#.#'],
  '9': ['###', '#.#', '###', '..#', '###'],
  ' ': ['..', '..', '..', '..', '..'],
};

export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, colour: string): void {
  let cx = x;
  for (const ch of text) {
    const g = GLYPHS[ch];
    if (!g) continue;
    drawSprite(ctx, { rows: g, palette: { '#': colour } }, cx, y);
    cx += (g[0]?.length ?? 3) + 1;
  }
}

export function textWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += (GLYPHS[ch]?.[0]?.length ?? 3) + 1;
  return Math.max(0, w - 1);
}

// ---------- the scavenger (8×12) ----------

const FIGURE: Palette = {
  h: '#3d4c63',
  H: '#2a3446',
  s: '#e3b58c',
  c: '#6b4f3a',
  C: '#4a3628',
  b: '#1d1719',
  l: '#8e7a52',
  L: '#ffd782',
};

export const SCAVENGER_STAND: Sprite = {
  palette: FIGURE,
  rows: ['..hhh...', '.hhhhh..', '.hHssh..', '..hhh...', '.cccccc.', 'cCcccCcl', 'c.cccC.l', '..cccC.L', '..ccccC.', '..cC.cC.', '..cC.cC.', '..bb.bb.'],
};

export const SCAVENGER_CROUCH: Sprite = {
  palette: FIGURE,
  rows: ['........', '........', '...hhh..', '..hhhhh.', '..hHssh.', '.ccchh..', 'cCcccccl', 'L.cccCcl', '..cccCC.', '.cCccCc.', '.cC..cC.', '.bb..bb.'],
};

export const MARA_FIGURE: Sprite = {
  palette: { h: '#2a1f2e', s: '#e7bb93', c: '#2e4a5c', C: '#1f3442', l: '#5fe3d6', b: '#141018' },
  rows: ['..hhh...', '.hhhhh..', '.hssh...', '..hh....', '.cccc...', 'cCcccl..', 'c.cccl..', '..ccc...', '..cccC..', '..cCcC..', '..c.c...', '..b.b...'],
};

export const TOBIN_FIGURE: Sprite = {
  palette: { b: '#3a3a52', g: '#cfcfd8', s: '#d9a07a', m: '#7a5a3a', M: '#5a4028', k: '#141018' },
  rows: ['..bbb...', '.bbbbb..', '..sss...', '..ggg...', '.mmmmm..', 'mmMmmMm.', 'm.mmm.m.', '..mmm...', '..mMm...', '..m.m...', '..m.m...', '..k.k...'],
};
