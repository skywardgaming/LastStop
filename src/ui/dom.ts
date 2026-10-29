// A tiny hyperscript helper: enough structure to build views without a framework.

export type Child = Node | string | number | null | undefined | false | Child[];

export interface Props {
  class?: string;
  text?: string;
  attrs?: Record<string, string | number | boolean | undefined>;
  data?: Record<string, string | number>;
  style?: Partial<Record<string, string>>;
  on?: Partial<Record<keyof HTMLElementEventMap, (e: Event) => void>>;
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    if (props.class) el.className = props.class;
    if (props.text !== undefined) el.textContent = props.text;
    if (props.attrs) {
      for (const [k, v] of Object.entries(props.attrs)) {
        if (v === undefined || v === false) continue;
        el.setAttribute(k, v === true ? '' : String(v));
      }
    }
    if (props.data) for (const [k, v] of Object.entries(props.data)) el.dataset[k] = String(v);
    if (props.style) for (const [k, v] of Object.entries(props.style)) if (v !== undefined) el.style.setProperty(k, v);
    if (props.on) for (const [k, fn] of Object.entries(props.on)) if (fn) el.addEventListener(k, fn);
  }
  append(el, children);
  return el;
}

function append(el: Element, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

export function img(src: string, cls = 'px-icon', alt = ''): HTMLImageElement {
  const i = document.createElement('img');
  i.src = src;
  i.alt = alt;
  i.className = cls;
  i.decoding = 'async';
  return i;
}

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
}

export function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (totalMin > 0) return `${totalMin}m`;
  return `${Math.max(1, Math.round(ms / 1000))}s`;
}

export function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
}

export function pct(n: number): string {
  if (n >= 1) return 'always';
  const v = n * 100;
  return `${v < 1 ? v.toFixed(1) : v < 10 ? v.toFixed(1).replace(/\.0$/, '') : Math.round(v)}%`;
}
