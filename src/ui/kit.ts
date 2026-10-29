// LAST STOP design system — DOM primitives.
//
// Every screen is composed from these. They encode the visual language
// (brass, plum, signal cyan; signage type for labels, a serif for story)
// so future screens — crew, expeditions, the railway map — look like they
// belong. See docs/DESIGN_SYSTEM.md.

import { h, type Child } from './dom';

// ---------- formatting ----------

/** Compact counts for tiles: 9,876 · 12.3k · 1.2M. Full values belong in detail views. */
export function fmtQty(n: number): string {
  if (n < 10_000) return n.toLocaleString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 100_000 ? 1 : 0).replace(/\.0$/, '')}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

export function fmtSeconds(ms: number): string {
  const s = ms / 1000;
  return s < 10 ? `${s.toFixed(1)}s` : `${Math.round(s)}s`;
}

export function fmtAgo(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const hr = Math.round(m / 60);
  return `${hr}h ago`;
}

// ---------- pixel art ----------

export type ArtSize = 24 | 32 | 48 | 64 | 96;

/** A pixel-art image at an exact CSS size, rendered with nearest-neighbour. */
export function art(src: string, size: ArtSize, opts: { alt?: string; cls?: string; silhouette?: boolean } = {}): HTMLImageElement {
  const i = document.createElement('img');
  i.src = src;
  i.alt = opts.alt ?? '';
  i.width = size;
  i.height = size;
  i.decoding = 'async';
  i.className = `px px-${size}${opts.silhouette ? ' is-unknown' : ''}${opts.cls ? ` ${opts.cls}` : ''}`;
  if (!opts.alt) i.setAttribute('aria-hidden', 'true');
  return i;
}

// ---------- controls ----------

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'stop' | 'repair' | 'signal';

export interface ButtonOpts {
  label: Child;
  variant?: ButtonVariant;
  size?: 'm' | 's';
  icon?: HTMLElement | null;
  disabled?: boolean;
  ariaLabel?: string;
  key?: string;
  block?: boolean;
  onClick?: () => void;
}

export function button(o: ButtonOpts): HTMLButtonElement {
  const b = h(
    'button',
    {
      class: `btn btn-${o.variant ?? 'primary'} btn-${o.size ?? 'm'}${o.block ? ' btn-block' : ''}`,
      attrs: { type: 'button', disabled: o.disabled, 'aria-label': o.ariaLabel },
      data: o.key ? { key: o.key } : {},
      on: o.onClick ? { click: () => o.onClick?.() } : {},
    },
    o.icon ?? null,
    h('span', { class: 'btn-label' }, o.label),
  );
  return b;
}

export interface TabItem<T extends string> {
  id: T;
  label: string;
  badge?: number | string;
  icon?: HTMLElement;
}

/** Segmented tabs. `variant` picks the motif: pill (default) or notebook index. */
export function tabs<T extends string>(items: TabItem<T>[], value: T, onChange: (v: T) => void, label: string, variant: 'pill' | 'index' = 'pill', key = label): HTMLElement {
  return h(
    'div',
    { class: `tabs tabs-${variant}`, attrs: { role: 'tablist', 'aria-label': label }, data: { key: `tabs:${key}`, scrollx: '1' } },
    items.map((it) =>
      h(
        'button',
        {
          class: `tab${it.id === value ? ' is-active' : ''}`,
          attrs: { type: 'button', role: 'tab', 'aria-selected': it.id === value, tabindex: it.id === value ? 0 : -1 },
          data: { key: `tab:${key}:${it.id}` },
          on: { click: () => onChange(it.id), keydown: (e) => tabKeys(e as KeyboardEvent, items.map((x) => x.id), it.id, onChange) },
        },
        it.icon ?? null,
        h('span', { text: it.label }),
        it.badge !== undefined && it.badge !== 0 ? h('span', { class: 'tab-badge', text: String(it.badge) }) : null,
      ),
    ),
  );
}

/** Arrow-key navigation between tabs (WAI-ARIA tabs pattern). */
function tabKeys<T extends string>(e: KeyboardEvent, ids: T[], current: T, onChange: (v: T) => void): void {
  const i = ids.indexOf(current);
  let next = -1;
  if (e.key === 'ArrowRight') next = (i + 1) % ids.length;
  else if (e.key === 'ArrowLeft') next = (i - 1 + ids.length) % ids.length;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = ids.length - 1;
  if (next < 0) return;
  e.preventDefault();
  const id = ids[next];
  if (id !== undefined) onChange(id);
}

// ---------- progress ----------

export type Tone = 'amber' | 'brass' | 'cyan' | 'copper' | 'teal' | 'rust';

/** A horizontal progress rail. `live` bars are driven every frame by the app. */
export function progress(fraction: number, tone: Tone = 'amber', opts: { live?: string; label?: string; thin?: boolean } = {}): HTMLElement {
  const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  return h(
    'div',
    {
      class: `rail-bar tone-${tone}${opts.thin ? ' is-thin' : ''}`,
      attrs: { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'aria-label': opts.label },
    },
    h('span', { class: 'rail-fill', style: { transform: `scaleX(${Math.max(0, Math.min(1, fraction))})` }, data: opts.live ? { live: opts.live } : {} }),
  );
}

/** A pressure-gauge dial: the level in the middle, XP as the needle sweep. */
export function gauge(fraction: number, value: string, tone: Tone = 'brass', size = 56, label?: string): HTMLElement {
  const r = 22;
  const c = 2 * Math.PI * r;
  const sweep = 0.75; // 270° dial
  const f = Math.max(0, Math.min(1, fraction));
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 56 56');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  const mk = (cls: string, dash: string): SVGCircleElement => {
    const el = document.createElementNS(ns, 'circle');
    el.setAttribute('cx', '28');
    el.setAttribute('cy', '28');
    el.setAttribute('r', String(r));
    el.setAttribute('class', cls);
    el.setAttribute('stroke-dasharray', dash);
    el.setAttribute('transform', 'rotate(135 28 28)');
    return el;
  };
  svg.append(mk('gauge-track', `${c * sweep} ${c}`), mk('gauge-fill', `${c * sweep * f} ${c}`));
  // Tick marks around the dial, like a boiler gauge.
  for (let i = 0; i <= 6; i++) {
    const a = ((135 + (270 * i) / 6) * Math.PI) / 180;
    const t = document.createElementNS(ns, 'line');
    t.setAttribute('x1', String(28 + Math.cos(a) * 26));
    t.setAttribute('y1', String(28 + Math.sin(a) * 26));
    t.setAttribute('x2', String(28 + Math.cos(a) * 24));
    t.setAttribute('y2', String(28 + Math.sin(a) * 24));
    t.setAttribute('class', 'gauge-tick');
    svg.append(t);
  }
  return h('span', { class: `gauge tone-${tone}`, attrs: label ? { role: 'img', 'aria-label': label } : {}, style: { width: `${size}px`, height: `${size}px` } }, svg, h('span', { class: 'gauge-value', text: value }));
}

// ---------- surfaces ----------

/** The primary surface: a plum plate with a brass edge and rivets. */
export function plate(cls: string, ...children: Child[]): HTMLElement {
  return h('section', { class: `plate ${cls}` }, ...children);
}

/** A labelled group: signage-style heading, optional trailing element. */
export function group(title: string, aside: Child, ...children: Child[]): HTMLElement {
  return h('section', { class: 'group' }, h('header', { class: 'group-head' }, h('h2', { class: 'label-section', text: title }), aside ?? null), ...children);
}

export function stamp(text: string, tone: 'brass' | 'cyan' | 'rust' | 'muted' | 'amber' = 'brass'): HTMLElement {
  return h('span', { class: `stamp stamp-${tone}`, text });
}

export function emptyState(o: { icon?: HTMLElement; title: string; text: string; action?: HTMLElement }): HTMLElement {
  return h('div', { class: 'empty' }, o.icon ?? null, h('p', { class: 'empty-title', text: o.title }), h('p', { class: 'empty-text', text: o.text }), o.action ?? null);
}

// ---------- requirements ----------

export interface Requirement {
  label: string;
  icon?: string;
  unknown?: boolean;
  have: number;
  need: number;
  /** For boolean requirements (a repair done, a project finished). */
  flag?: boolean;
  onClick?: () => void;
}

export function requirements(list: Requirement[], label = 'Requirements'): HTMLElement {
  return h(
    'ul',
    { class: 'reqs', attrs: { 'aria-label': label } },
    list.map((r) => {
      const met = r.flag !== undefined ? r.flag : r.have >= r.need;
      const content: Child[] = [
        r.icon ? art(r.icon, 32, { silhouette: !!r.unknown }) : h('span', { class: 'req-glyph', attrs: { 'aria-hidden': 'true' }, text: met ? '✓' : '•' }),
        h('span', { class: 'req-name', text: r.label }),
        h('span', { class: 'req-count', text: r.flag !== undefined ? (met ? 'Done' : 'Needed') : `${fmtQty(Math.min(r.have, r.need))}/${fmtQty(r.need)}` }),
      ];
      return h(
        'li',
        { class: `req ${met ? 'is-met' : 'is-short'}`, attrs: { 'aria-label': `${r.label}: ${r.flag !== undefined ? (met ? 'done' : 'needed') : `${r.have} of ${r.need}`}` } },
        r.onClick ? h('button', { class: 'req-btn', attrs: { type: 'button' }, on: { click: () => r.onClick?.() } }, ...content) : content,
      );
    }),
  );
}

// ---------- rewards ----------

export interface RewardChip {
  icon: string;
  label: string;
  qty: number;
  rarity?: string;
}

export function rewardChips(list: RewardChip[], max = 6, sign: '+' | '×' = '+'): HTMLElement {
  const shown = list.slice(0, max);
  return h(
    'ul',
    { class: 'reward-chips' },
    shown.map((r) => h('li', { class: `reward-chip ${r.rarity ? `rarity-${r.rarity}` : ''}`, attrs: { 'aria-label': `${r.qty} ${r.label}` } }, art(r.icon, 32), h('span', { class: 'reward-qty', text: `${sign}${fmtQty(r.qty)}` }))),
    list.length > max ? h('li', { class: 'reward-more', text: `+${list.length - max}` }) : null,
  );
}

/** Small icon strip for an activity's possible rewards. */
export function yieldStrip(list: { icon: string; label: string; unknown?: boolean }[], max = 5): HTMLElement {
  return h(
    'span',
    { class: 'yield-strip', attrs: { 'aria-label': `Rewards: ${list.map((l) => l.label).join(', ')}` } },
    list.slice(0, max).map((l) => art(l.icon, 32, { silhouette: !!l.unknown })),
    list.length > max ? h('span', { class: 'yield-more', text: `+${list.length - max}` }) : null,
  );
}
