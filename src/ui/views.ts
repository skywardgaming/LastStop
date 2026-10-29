// Tab views. Each function builds a fresh panel from the current state;
// all rules come from the core.

import { ITEM_IDS, ITEMS, RARITY_ORDER, type ItemId } from '../core/content/items';
import {
  ACHIEVEMENTS,
  CATEGORY_NAMES,
  CHARACTERS,
  DIALOGUE_BY_ID,
  DIALOGUES,
  DISCOVERIES,
  OBJECTIVES,
  type SpeakerId,
} from '../core/content/story';
import {
  LOCATION_IDS,
  LOCATIONS,
  RECIPE_IDS,
  RECIPES,
  REPAIR_IDS,
  REPAIRS,
  SKILL_NAMES,
  type ItemBundle,
  type LocationId,
  type RecipeId,
  type RepairId,
  type SkillId,
} from '../core/content/world';
import { unreadDialogues } from '../core/game';
import {
  actionDuration,
  craftableCount,
  dropChance,
  locationAccess,
  modifiers,
  repairBlockers,
  skillLevel,
} from '../core/rules';
import type { GameState } from '../core/state';
import { levelProgress } from '../core/xp';
import { h, img, pct, seconds, type Child } from './dom';
import { itemIconUrl, portraitUrl } from './sprites';

export type Tab = 'station' | 'skills' | 'train' | 'satchel' | 'journal';
export type JournalTab = 'discoveries' | 'people' | 'feats' | 'progress';
export type SatchelFilter = 'all' | 'material' | 'component';
export type SatchelSort = 'rarity' | 'name' | 'qty';

export interface UiState {
  tab: Tab;
  skillTab: SkillId;
  journalTab: JournalTab;
  filter: SatchelFilter;
  sort: SatchelSort;
}

export interface LogEntry {
  text: string;
  kind: 'find' | 'rare' | 'discovery' | 'level' | 'info' | 'achievement';
  item?: ItemId;
}

export interface Actions {
  scavenge(id: LocationId): void;
  craft(id: RecipeId): void;
  stop(): void;
  repair(id: RepairId): void;
  openItem(id: ItemId): void;
  openDiscovery(id: string): void;
  openDialogue(id: string): void;
  go(tab: Tab, sub?: SkillId | JournalTab): void;
  setUi(patch: Partial<UiState>): void;
}

export interface ViewCtx {
  state: GameState;
  ui: UiState;
  log: LogEntry[];
  act: Actions;
}

// ---------- shared pieces ----------

export function rarityClass(id: ItemId): string {
  return `rarity-${ITEMS[id].rarity}`;
}

function itemChip(id: ItemId, label?: Child, extra = ''): HTMLElement {
  return h('span', { class: `item-chip ${rarityClass(id)} ${extra}` }, img(itemIconUrl(id)), label ?? ITEMS[id].name);
}

function seen(state: GameState, id: ItemId): boolean {
  return (state.stats.obtained[id] ?? 0) > 0 || state.inventory[id] > 0;
}

function bar(fraction: number, cls = '', live = false): HTMLElement {
  return h(
    'div',
    { class: `bar ${cls}`, attrs: { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(fraction * 100) } },
    h('div', { class: 'bar-fill', style: { width: `${(fraction * 100).toFixed(1)}%` }, data: live ? { live: 'activity' } : {} }),
  );
}

function costList(state: GameState, bundle: ItemBundle, act: Actions): HTMLElement {
  return h(
    'ul',
    { class: 'cost-list' },
    (Object.entries(bundle) as [ItemId, number][]).map(([id, need]) => {
      const have = state.inventory[id];
      return h(
        'li',
        { class: have >= need ? 'met' : 'short' },
        h(
          'button',
          { class: 'linkish', attrs: { type: 'button' }, on: { click: () => act.openItem(id) } },
          seen(state, id) ? itemChip(id) : h('span', { class: 'item-chip unknown' }, img(itemIconUrl(id), 'px-icon silhouette'), '???'),
        ),
        h('span', { class: 'cost-count' }, `${Math.min(have, need)}/${need}`),
      );
    }),
  );
}

function card(cls: string, ...children: Child[]): HTMLElement {
  return h('section', { class: `card ${cls}` }, ...children);
}

function segmented<T extends string>(options: [T, string][], value: T, onChange: (v: T) => void, label: string): HTMLElement {
  return h(
    'div',
    { class: 'segmented', attrs: { role: 'tablist', 'aria-label': label } },
    options.map(([v, text]) =>
      h('button', {
        class: v === value ? 'active' : '',
        text,
        attrs: { type: 'button', role: 'tab', 'aria-selected': v === value },
        on: { click: () => onChange(v) },
      }),
    ),
  );
}

function isRunning(state: GameState, kind: 'scavenge' | 'craft', id: string): boolean {
  const a = state.activity;
  if (!a) return false;
  return kind === 'scavenge' ? a.kind === 'scavenge' && a.locationId === id : a.kind === 'craft' && a.recipeId === id;
}

export function activityLabel(state: GameState): string {
  const a = state.activity;
  if (!a) return 'Idle';
  return a.kind === 'scavenge' ? `Searching · ${LOCATIONS[a.locationId].name}` : `Crafting · ${ITEMS[RECIPES[a.recipeId].output].name}`;
}

// ---------- Station ----------

const OBJECTIVE_ROUTES: Record<string, [Tab, SkillId?]> = {
  search10: ['skills', 'scavenging'],
  plates: ['skills', 'engineering'],
  firebox: ['train'],
  cabinet: ['skills', 'scavenging'],
  headlamp: ['train'],
  key: ['skills', 'scavenging'],
  shed: ['skills', 'scavenging'],
  dryCab: ['train'],
  tender: ['train'],
  boiler: ['train'],
};

export function objectiveStatus(state: GameState): { done: number; total: number; current: (typeof OBJECTIVES)[number] | null } {
  let done = 0;
  let current: (typeof OBJECTIVES)[number] | null = null;
  for (const o of OBJECTIVES) {
    const [c, t] = o.progress(state);
    if (c >= t) done++;
    else if (!current) current = o;
  }
  return { done, total: OBJECTIVES.length, current };
}

export function stationView(ctx: ViewCtx): HTMLElement {
  const { state, act } = ctx;
  const obj = objectiveStatus(state);
  const panels: Child[] = [];

  // Current goal.
  if (obj.current) {
    const [c, t] = obj.current.progress(state);
    const route = OBJECTIVE_ROUTES[obj.current.id] ?? ['station'];
    panels.push(
      card(
        'objective',
        h('p', { class: 'eyebrow' }, `Chapter One · The Cyan Signal · ${obj.done}/${obj.total}`),
        h('h2', { text: obj.current.title }),
        h('p', { class: 'muted', text: obj.current.hint }),
        t > 1 ? h('div', { class: 'row gap' }, bar(c / t, 'thin amber'), h('span', { class: 'mono small', text: `${c}/${t}` })) : null,
        h('button', {
          class: 'btn btn-secondary',
          text: 'Show me',
          attrs: { type: 'button' },
          on: { click: () => act.go(route[0], route[1]) },
        }),
      ),
    );
  } else {
    panels.push(
      card(
        'objective done',
        h('p', { class: 'eyebrow cyan' }, 'Chapter One complete'),
        h('h2', { text: 'The line is open.' }),
        h('p', { class: 'muted', text: 'No. 9 breathes again and the signal waits for a crew. Keep levelling, fill the journal — the next chapter leaves from here.' }),
      ),
    );
  }

  // People waiting to talk.
  const unread = unreadDialogues(state);
  if (unread.length > 0) {
    panels.push(
      card(
        'people',
        h('p', { class: 'eyebrow' }, 'Ashvale folk'),
        unread.map((id) => {
          const d = DIALOGUE_BY_ID[id];
          if (!d) return null;
          const c = CHARACTERS[d.speaker];
          return h(
            'button',
            { class: `talk-row ${d.milestone ? 'milestone' : ''}`, attrs: { type: 'button' }, on: { click: () => act.openDialogue(id) } },
            img(portraitUrl(d.speaker), 'portrait sm'),
            h('span', { class: 'talk-text' }, h('strong', { text: c.name }), h('span', { class: 'muted', text: d.title })),
            h('span', { class: 'talk-cta', text: 'Listen' }),
          );
        }),
      ),
    );
  }

  // What you're doing now.
  const a = state.activity;
  panels.push(
    card(
      'now',
      h('p', { class: 'eyebrow' }, 'Now'),
      a
        ? [
            h('h3', { text: activityLabel(state) }),
            bar(0, 'amber', true),
            h('p', { class: 'muted small', text: `${seconds(actionDuration(state, a.kind === 'scavenge' ? { kind: 'scavenge', locationId: a.locationId } : { kind: 'craft', recipeId: a.recipeId }))} per action · continues while you’re away (up to 8h)` }),
          ]
        : [
            h('h3', { text: 'Idle on the platform' }),
            h('p', { class: 'muted small', text: 'Nothing happens while idle. Pick an activity — it keeps running when you close the game.' }),
            h('button', { class: 'btn btn-primary', text: 'Search the Derelict Platform', attrs: { type: 'button' }, on: { click: () => act.scavenge('derelictPlatform') } }),
          ],
    ),
  );

  // Recent finds.
  panels.push(
    card(
      'log-card',
      h('p', { class: 'eyebrow' }, 'Recent'),
      ctx.log.length === 0
        ? h('p', { class: 'muted small', text: 'Your finds will be listed here.' })
        : h(
            'ol',
            { class: 'log' },
            ctx.log.map((e) => h('li', { class: `log-${e.kind}` }, e.item ? img(itemIconUrl(e.item)) : null, h('span', { text: e.text }))),
          ),
    ),
  );

  // Locomotive at a glance.
  const done = REPAIR_IDS.filter((id) => state.repairs[id]).length;
  panels.push(
    card(
      'loco-strip',
      h('div', { class: 'row between' }, h('p', { class: 'eyebrow' }, 'Locomotive No. 9'), h('span', { class: 'mono small', text: `${done}/${REPAIR_IDS.length} restored` })),
      h(
        'div',
        { class: 'pips' },
        REPAIR_IDS.map((id) =>
          h('button', {
            class: `pip ${state.repairs[id] ? 'on' : repairBlockers(state, id).length === 0 ? 'ready' : ''}`,
            text: REPAIRS[id].name,
            attrs: { type: 'button' },
            on: { click: () => act.go('train') },
          }),
        ),
      ),
    ),
  );

  return h('div', { class: 'view' }, panels);
}

// ---------- Skills ----------

function skillHeader(state: GameState, skill: SkillId): HTMLElement {
  const p = levelProgress(state.skills[skill].xp);
  const next = nextUnlock(state, skill);
  return card(
    `skill-head skill-${skill}`,
    h(
      'div',
      { class: 'row between' },
      h('div', null, h('p', { class: 'eyebrow' }, 'Skill'), h('h2', { text: SKILL_NAMES[skill] })),
      h('div', { class: 'level-badge' }, h('span', { class: 'level-num', text: String(p.level) }), h('span', { class: 'level-max', text: '/20' })),
    ),
    bar(p.fraction, skill === 'scavenging' ? 'teal' : 'copper'),
    h(
      'div',
      { class: 'row between mono small muted' },
      h('span', { text: p.isMax ? 'Max level' : `${p.current.toLocaleString()} / ${p.needed.toLocaleString()} XP` }),
      next ? h('span', { text: next }) : null,
    ),
  );
}

function nextUnlock(state: GameState, skill: SkillId): string | null {
  const lvl = skillLevel(state, skill);
  if (skill === 'scavenging') {
    const loc = LOCATION_IDS.map((id) => LOCATIONS[id]).find((l) => l.levelRequired > lvl);
    return loc ? `Lv ${loc.levelRequired}: ${loc.short}` : null;
  }
  const lv = [...RECIPE_IDS.map((id) => RECIPES[id].levelRequired), ...REPAIR_IDS.map((id) => REPAIRS[id].levelRequired)]
    .filter((l) => l > lvl)
    .sort((a, b) => a - b)[0];
  return lv ? `Next unlock at Lv ${lv}` : null;
}

function locationCard(ctx: ViewCtx, id: LocationId): HTMLElement {
  const { state, act } = ctx;
  const loc = LOCATIONS[id];
  const access = locationAccess(state, id);
  const running = isRunning(state, 'scavenge', id);
  const discTotal = DISCOVERIES.filter((d) => d.location === id);
  const discFound = discTotal.filter((d) => d.id in state.discoveries).length;
  const searches = state.stats.searches[id] ?? 0;
  const dur = actionDuration(state, { kind: 'scavenge', locationId: id });

  return card(
    `place place-${id} ${access.ok ? '' : 'locked'} ${running ? 'running' : ''}`,
    h(
      'div',
      { class: 'row between' },
      h('h3', { text: loc.name }),
      h('span', { class: 'tag', text: access.ok ? `${seconds(dur)} · ${Math.round(loc.xp * modifiers(state).xp)} XP` : `Lv ${loc.levelRequired}` }),
    ),
    h('p', { class: 'muted small', text: loc.description }),
    access.ok
      ? h(
          'ul',
          { class: 'drops' },
          loc.drops.map((d) => {
            const known = seen(state, d.item);
            return h(
              'li',
              { class: `${rarityClass(d.item)} ${known ? '' : 'unknown'}` },
              h('button', { class: 'linkish', attrs: { type: 'button' }, on: { click: () => act.openItem(d.item) } }, img(itemIconUrl(d.item), known ? 'px-icon' : 'px-icon silhouette')),
              h('span', { class: 'drop-name', text: known ? ITEMS[d.item].name : '???' }),
              h('span', { class: 'drop-chance', text: pct(dropChance(state, d.item, d.chance)) }),
            );
          }),
        )
      : h('p', { class: 'lock-reason', text: `\u{1F512} ${access.reason}` }),
    access.ok
      ? h(
          'div',
          { class: 'row between mono small muted' },
          h('span', { text: `${searches.toLocaleString()} searches` }),
          h('span', { class: 'cyan', text: `Journal ${discFound}/${discTotal.length}` }),
        )
      : null,
    running ? bar(0, 'amber thin', true) : null,
    h('button', {
      class: `btn ${running ? 'btn-stop' : 'btn-primary'}`,
      text: running ? 'Stop searching' : access.ok ? `Search the ${loc.short}` : 'Locked',
      attrs: { type: 'button', disabled: !access.ok && !running },
      on: { click: () => (running ? act.stop() : act.scavenge(id)) },
    }),
  );
}

function recipeCard(ctx: ViewCtx, id: RecipeId): HTMLElement {
  const { state, act } = ctx;
  const r = RECIPES[id];
  const lvl = skillLevel(state, 'engineering');
  const unlocked = lvl >= r.levelRequired;
  const running = isRunning(state, 'craft', id);
  const n = craftableCount(state, id);
  const dur = actionDuration(state, { kind: 'craft', recipeId: id });

  return card(
    `recipe ${unlocked ? '' : 'locked'} ${running ? 'running' : ''}`,
    h(
      'div',
      { class: 'row between' },
      h('button', { class: 'linkish recipe-out', attrs: { type: 'button' }, on: { click: () => act.openItem(r.output) } }, itemChip(r.output)),
      h('span', { class: 'tag', text: unlocked ? `${seconds(dur)} · ${Math.round(r.xp * modifiers(state).xp)} XP` : `Lv ${r.levelRequired}` }),
    ),
    unlocked ? costList(state, r.inputs, act) : h('p', { class: 'lock-reason', text: `\u{1F512} Requires Engineering level ${r.levelRequired}.` }),
    running ? bar(0, 'copper thin', true) : null,
    unlocked
      ? h('button', {
          class: `btn ${running ? 'btn-stop' : 'btn-primary'}`,
          text: running ? 'Stop crafting' : n > 0 ? `Craft (can make ${n})` : 'Not enough materials',
          attrs: { type: 'button', disabled: !running && n === 0 },
          on: { click: () => (running ? act.stop() : act.craft(id)) },
        })
      : null,
  );
}

export function skillsView(ctx: ViewCtx): HTMLElement {
  const { state, ui, act } = ctx;
  const sub = ui.skillTab;
  return h(
    'div',
    { class: 'view' },
    segmented<SkillId>(
      [
        ['scavenging', `Scavenging ${skillLevel(state, 'scavenging')}`],
        ['engineering', `Engineering ${skillLevel(state, 'engineering')}`],
      ],
      sub,
      (v) => act.setUi({ skillTab: v }),
      'Skills',
    ),
    skillHeader(state, sub),
    sub === 'scavenging'
      ? LOCATION_IDS.map((id) => locationCard(ctx, id))
      : [
          h('p', { class: 'muted small pad', text: 'Engineering turns scavenged materials into parts for No. 9. Crafting keeps going until materials run out — even offline.' }),
          RECIPE_IDS.map((id) => recipeCard(ctx, id)),
        ],
  );
}

// ---------- Train ----------

export function trainView(ctx: ViewCtx): HTMLElement {
  const { state, act } = ctx;
  const done = REPAIR_IDS.filter((id) => state.repairs[id]).length;
  const m = modifiers(state);
  const bonuses = [
    m.speed.scavenging > 0 ? `Scavenging +${Math.round(m.speed.scavenging * 100)}% speed` : null,
    m.speed.engineering > 0 ? `Engineering +${Math.round(m.speed.engineering * 100)}% speed` : null,
    m.rareChance > 1 ? `Rare finds ×${m.rareChance}` : null,
    m.xp > 1 ? `XP +${Math.round((m.xp - 1) * 100)}%` : null,
  ].filter((b): b is string => b !== null);

  return h(
    'div',
    { class: 'view' },
    card(
      'train-head',
      h('p', { class: 'eyebrow' }, 'Locomotive No. 9'),
      h('h2', { text: done === REPAIR_IDS.length ? 'Restored' : `${done} of ${REPAIR_IDS.length} systems restored` }),
      bar(done / REPAIR_IDS.length, 'amber'),
      bonuses.length
        ? h('ul', { class: 'bonus-list' }, bonuses.map((b) => h('li', { text: b })))
        : h('p', { class: 'muted small', text: 'Every repair shows on the engine above and makes your work easier.' }),
    ),
    REPAIR_IDS.map((id) => {
      const r = REPAIRS[id];
      const isDone = state.repairs[id];
      const blockers = repairBlockers(state, id);
      const ready = blockers.length === 0;
      const lvlOk = !blockers.includes('levelTooLow');
      return card(
        `repair ${isDone ? 'done' : ready ? 'ready' : ''}`,
        h(
          'div',
          { class: 'row between' },
          h('h3', { text: r.name }),
          h('span', { class: `tag ${isDone ? 'tag-done' : ready ? 'tag-ready' : ''}`, text: isDone ? 'Restored' : ready ? 'Ready' : `Eng ${r.levelRequired}` }),
        ),
        h('p', { class: 'muted small', text: isDone ? r.doneText : r.description }),
        h('p', { class: 'benefit', text: r.benefit }),
        isDone
          ? null
          : [
              h(
                'ul',
                { class: 'cost-list' },
                h('li', { class: lvlOk ? 'met' : 'short' }, h('span', { class: 'item-chip', text: 'Engineering level' }), h('span', { class: 'cost-count', text: `${Math.min(skillLevel(state, 'engineering'), r.levelRequired)}/${r.levelRequired}` })),
              ),
              costList(state, r.cost, act),
              h('button', {
                class: 'btn btn-repair',
                text: ready ? `Repair the ${r.name}` : !lvlOk ? `Reach Engineering ${r.levelRequired}` : 'Gather the parts',
                attrs: { type: 'button', disabled: !ready },
                on: { click: () => act.repair(id) },
              }),
            ],
      );
    }),
  );
}

// ---------- Satchel ----------

export function satchelView(ctx: ViewCtx): HTMLElement {
  const { state, ui, act } = ctx;
  let ids = ITEM_IDS.filter((id) => state.inventory[id] > 0);
  if (ui.filter !== 'all') ids = ids.filter((id) => ITEMS[id].kind === ui.filter);
  ids = [...ids].sort((a, b) => {
    if (ui.sort === 'name') return ITEMS[a].name.localeCompare(ITEMS[b].name);
    if (ui.sort === 'qty') return state.inventory[b] - state.inventory[a];
    return RARITY_ORDER[ITEMS[b].rarity] - RARITY_ORDER[ITEMS[a].rarity] || ITEMS[a].name.localeCompare(ITEMS[b].name);
  });
  const known = ITEM_IDS.filter((id) => seen(state, id)).length;

  return h(
    'div',
    { class: 'view' },
    card(
      'satchel-head',
      h('div', { class: 'row between' }, h('h2', { text: 'Satchel' }), h('span', { class: 'mono small muted', text: `${known}/${ITEM_IDS.length} item types found` })),
      segmented<SatchelFilter>(
        [
          ['all', 'All'],
          ['material', 'Materials'],
          ['component', 'Parts'],
        ],
        ui.filter,
        (v) => act.setUi({ filter: v }),
        'Filter',
      ),
      h(
        'div',
        { class: 'row gap sort-row' },
        h('span', { class: 'muted small', text: 'Sort' }),
        segmented<SatchelSort>(
          [
            ['rarity', 'Rarity'],
            ['name', 'Name'],
            ['qty', 'Amount'],
          ],
          ui.sort,
          (v) => act.setUi({ sort: v }),
          'Sort',
        ),
      ),
    ),
    ids.length === 0
      ? card('empty', h('p', { class: 'muted', text: ui.filter === 'component' ? 'No parts yet. Engineering turns materials into parts.' : 'Your satchel is empty. Start scavenging to fill it.' }))
      : h(
          'ul',
          { class: 'item-grid' },
          ids.map((id) =>
            h(
              'li',
              null,
              h(
                'button',
                { class: `item-tile ${rarityClass(id)}`, attrs: { type: 'button', 'aria-label': `${ITEMS[id].name}, ${state.inventory[id]}` }, on: { click: () => act.openItem(id) } },
                img(itemIconUrl(id), 'px-icon lg'),
                h('span', { class: 'tile-count', text: state.inventory[id].toLocaleString() }),
                h('span', { class: 'tile-name', text: ITEMS[id].name }),
              ),
            ),
          ),
        ),
  );
}

// ---------- Journal ----------

export function journalView(ctx: ViewCtx): HTMLElement {
  const { state, ui, act } = ctx;
  const found = Object.keys(state.discoveries).length;
  const tabs: [JournalTab, string][] = [
    ['discoveries', `Finds ${found}/${DISCOVERIES.length}`],
    ['people', 'People'],
    ['feats', 'Feats'],
    ['progress', 'Progress'],
  ];
  let body: Child;
  if (ui.journalTab === 'discoveries') {
    body = h(
      'ul',
      { class: 'disc-grid' },
      DISCOVERIES.map((d) => {
        const has = d.id in state.discoveries;
        return h(
          'li',
          null,
          h(
            'button',
            {
              class: `disc ${has ? 'found' : 'unknown'}`,
              attrs: { type: 'button', disabled: !has },
              on: { click: () => act.openDiscovery(d.id) },
            },
            h('span', { class: 'disc-cat', text: has ? CATEGORY_NAMES[d.category] : LOCATIONS[d.location].name }),
            h('span', { class: 'disc-name', text: has ? d.name : '???' }),
          ),
        );
      }),
    );
  } else if (ui.journalTab === 'people') {
    body = (Object.keys(CHARACTERS) as SpeakerId[]).map((sid) => {
      const c = CHARACTERS[sid];
      const convs = DIALOGUES.filter((d) => d.speaker === sid && state.dialogues.unlocked.includes(d.id));
      return card(
        'person',
        h('div', { class: 'row gap' }, img(portraitUrl(sid), 'portrait'), h('div', null, h('h3', { text: convs.length ? c.name : '???' }), h('p', { class: 'muted small', text: convs.length ? c.role : 'Not yet met' }))),
        convs.length
          ? h(
              'ul',
              { class: 'conv-list' },
              convs.map((d) =>
                h(
                  'li',
                  null,
                  h('button', { class: `conv ${state.dialogues.read.includes(d.id) ? '' : 'unread'}`, text: d.title, attrs: { type: 'button' }, on: { click: () => act.openDialogue(d.id) } }),
                ),
              ),
            )
          : null,
      );
    });
  } else if (ui.journalTab === 'feats') {
    body = h(
      'ul',
      { class: 'feats' },
      ACHIEVEMENTS.map((a) => {
        const has = a.id in state.achievements;
        return h('li', { class: has ? 'earned' : '' }, h('span', { class: 'feat-mark', text: has ? '★' : '☆' }), h('div', null, h('strong', { text: a.name }), h('span', { class: 'muted small', text: a.description })));
      }),
    );
  } else {
    const totalSearches = Object.values(state.stats.searches).reduce((x, y) => x + (y ?? 0), 0);
    body = [
      card(
        'objectives',
        h('p', { class: 'eyebrow' }, 'Chapter One · The Cyan Signal'),
        h(
          'ol',
          { class: 'checklist' },
          OBJECTIVES.map((o) => {
            const [c, t] = o.progress(state);
            return h('li', { class: c >= t ? 'done' : '' }, h('span', { class: 'check', text: c >= t ? '✓' : '' }), h('span', { text: o.title }));
          }),
        ),
      ),
      card(
        'stats',
        h('p', { class: 'eyebrow' }, 'Records'),
        h(
          'dl',
          { class: 'stat-grid' },
          [
            ['Searches', totalSearches],
            ['Parts crafted', state.stats.crafts],
            ['Rare finds', state.stats.rareFinds],
            ['Discoveries', `${found}/${DISCOVERIES.length}`],
            ['Feats', `${Object.keys(state.achievements).length}/${ACHIEVEMENTS.length}`],
            ['Repairs', `${REPAIR_IDS.filter((id) => state.repairs[id]).length}/${REPAIR_IDS.length}`],
          ].map(([k, v]) => [h('dt', { text: String(k) }), h('dd', { text: typeof v === 'number' ? v.toLocaleString() : String(v) })]),
        ),
      ),
    ];
  }
  return h('div', { class: 'view' }, segmented(tabs, ui.journalTab, (v) => act.setUi({ journalTab: v }), 'Journal sections'), body);
}

export function itemSources(id: ItemId): string[] {
  const out: string[] = [];
  for (const loc of LOCATION_IDS) {
    const d = LOCATIONS[loc].drops.find((x) => x.item === id);
    if (d) out.push(`${LOCATIONS[loc].name} · ${pct(d.chance)}`);
  }
  for (const r of RECIPE_IDS) if (RECIPES[r].output === id) out.push(`Engineering · Lv ${RECIPES[r].levelRequired}`);
  return out;
}

export function itemUses(id: ItemId): string[] {
  const out: string[] = [];
  for (const r of RECIPE_IDS) if (RECIPES[r].inputs[id]) out.push(`${ITEMS[RECIPES[r].output].name} (×${RECIPES[r].inputs[id]})`);
  for (const r of REPAIR_IDS) if (REPAIRS[r].cost[id]) out.push(`${REPAIRS[r].name} repair (×${REPAIRS[r].cost[id]})`);
  return out;
}
