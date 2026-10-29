// Tab views. Each function builds a fresh panel from the current state;
// every rule comes from the core.

import { ITEM_IDS, ITEMS, RARITY_ORDER, type ItemId, type ItemKind } from '../core/content/items';
import {
  ACHIEVEMENTS,
  CATEGORY_NAMES,
  CHAPTERS,
  CHARACTERS,
  DIALOGUE_BY_ID,
  DIALOGUES,
  DISCOVERIES,
  DISCOVERY_BY_ID,
  OBJECTIVES,
  type ObjectiveDef,
  type SpeakerId,
} from '../core/content/story';
import {
  IMPROVEMENT_IDS,
  LOCATION_IDS,
  LOCATIONS,
  PROJECT_IDS,
  PROJECTS,
  RECIPE_IDS,
  RECIPES,
  REPAIR_IDS,
  REPAIRS,
  SALVAGE,
  SALVAGE_IDS,
  SKILL_BLURB,
  SKILL_IDS,
  SKILL_NAMES,
  SKILL_SHORT,
  TOOLS,
  TRAIN_PART_IDS,
  type ItemBundle,
  type LocationId,
  type ProjectId,
  type RecipeCategory,
  type RecipeId,
  type SalvageId,
  type SkillId,
  type ToolId,
  type TrainPartId,
} from '../core/content/world';
import { unreadDialogues } from '../core/game';
import {
  activitySkill,
  actionDuration,
  craftableCount,
  dropChance,
  locationAccess,
  modifiers,
  ownedTools,
  projectProgress,
  projectUnlocked,
  recipeUnlocked,
  repairBlockers,
  salvageCount,
  salvageUnlocked,
  skillLevel,
  xpPerAction,
  type ActivitySpec,
} from '../core/rules';
import type { GameState } from '../core/state';
import { levelProgress } from '../core/xp';
import { h, img, pct, seconds, type Child } from './dom';
import { discoveryIconUrl, itemIconUrl, portraitUrl } from './sprites';

export type Tab = 'station' | 'skills' | 'train' | 'satchel' | 'journal';
export type JournalTab = 'discoveries' | 'people' | 'feats' | 'progress';
export type SatchelFilter = 'all' | ItemKind;
export type SatchelSort = 'rarity' | 'name' | 'qty';

export interface UiState {
  tab: Tab;
  skillTab: SkillId;
  recipeCat: RecipeCategory;
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
  start(spec: ActivitySpec): void;
  stop(): void;
  repair(id: TrainPartId): void;
  equip(id: ToolId): void;
  unequip(skill: SkillId): void;
  openTools(skill: SkillId): void;
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

function itemChip(id: ItemId, label?: Child): HTMLElement {
  return h('span', { class: `item-chip ${rarityClass(id)}` }, img(itemIconUrl(id)), label ?? ITEMS[id].name);
}

export function seen(state: GameState, id: ItemId): boolean {
  return (state.stats.obtained[id] ?? 0) > 0 || state.inventory[id] > 0 || Object.values(state.equipment).includes(id as ToolId);
}

function bar(fraction: number, cls = '', live = false): HTMLElement {
  return h(
    'div',
    { class: `bar ${cls}`, attrs: { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(fraction * 100) } },
    h('div', { class: 'bar-fill', style: { width: `${(fraction * 100).toFixed(1)}%` }, data: live ? { live: 'activity' } : {} }),
  );
}

function costList(state: GameState, bundle: ItemBundle, act: Actions, label?: string): HTMLElement {
  return h(
    'ul',
    { class: 'cost-list', attrs: label ? { 'aria-label': label } : {} },
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

function dropList(state: GameState, drops: { item: ItemId; chance: number }[], act: Actions): HTMLElement {
  return h(
    'ul',
    { class: 'drops' },
    drops.map((d) => {
      const known = seen(state, d.item);
      return h(
        'li',
        { class: `${rarityClass(d.item)} ${known ? '' : 'unknown'}` },
        h('button', { class: 'linkish', attrs: { type: 'button', 'aria-label': known ? ITEMS[d.item].name : 'Unknown item' }, on: { click: () => act.openItem(d.item) } }, img(itemIconUrl(d.item), known ? 'px-icon' : 'px-icon silhouette')),
        h('span', { class: 'drop-name', text: known ? ITEMS[d.item].name : '???' }),
        h('span', { class: 'drop-chance', text: pct(dropChance(state, d.item, d.chance)) }),
      );
    }),
  );
}

function card(cls: string, ...children: Child[]): HTMLElement {
  return h('section', { class: `card ${cls}` }, ...children);
}

function segmented<T extends string>(options: [T, string][], value: T, onChange: (v: T) => void, label: string, extra = ''): HTMLElement {
  return h(
    'div',
    { class: `segmented ${extra}`, attrs: { role: 'tablist', 'aria-label': label } },
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

function isRunning(state: GameState, spec: ActivitySpec): boolean {
  const a = state.activity;
  if (!a || a.kind !== spec.kind) return false;
  switch (spec.kind) {
    case 'scavenge':
      return a.kind === 'scavenge' && a.locationId === spec.locationId;
    case 'craft':
      return a.kind === 'craft' && a.recipeId === spec.recipeId;
    case 'salvage':
      return a.kind === 'salvage' && a.targetId === spec.targetId;
    case 'research':
      return a.kind === 'research' && a.projectId === spec.projectId;
  }
}

export function activityLabel(state: GameState): string {
  const a = state.activity;
  if (!a) return 'Idle';
  switch (a.kind) {
    case 'scavenge':
      return `Searching · ${LOCATIONS[a.locationId].name}`;
    case 'craft':
      return `Crafting · ${ITEMS[RECIPES[a.recipeId].output].name}`;
    case 'salvage':
      return `Salvaging · ${SALVAGE[a.targetId].name}`;
    case 'research': {
      const p = projectProgress(state, a.projectId);
      return `Studying · ${PROJECTS[a.projectId].name}${p ? ` ${p[0]}/${p[1]}` : ''}`;
    }
  }
}

function meta(state: GameState, spec: ActivitySpec): string {
  return `${seconds(actionDuration(state, spec))} · ${xpPerAction(state, spec)} XP`;
}

function runButton(state: GameState, spec: ActivitySpec, act: Actions, label: string, enabled: boolean, stopLabel = 'Stop'): HTMLElement {
  const running = isRunning(state, spec);
  return h('button', {
    class: `btn ${running ? 'btn-stop' : 'btn-primary'}`,
    text: running ? stopLabel : label,
    attrs: { type: 'button', disabled: !running && !enabled },
    on: { click: () => (running ? act.stop() : act.start(spec)) },
  });
}

// ---------- objectives ----------

const OBJECTIVE_ROUTES: Record<string, [Tab, SkillId?]> = {
  search10: ['skills', 'scavenging'],
  plates: ['skills', 'engineering'],
  firebox: ['train'],
  salvage: ['skills', 'salvaging'],
  study: ['skills', 'research'],
  tool: ['skills', 'engineering'],
  cabinet: ['skills', 'scavenging'],
  headlamp: ['train'],
  key: ['skills', 'scavenging'],
  shed: ['skills', 'scavenging'],
  dryCab: ['train'],
  tender: ['train'],
  methods: ['skills', 'research'],
  boiler: ['train'],
  lanterns: ['train'],
  winch: ['train'],
  tier3: ['skills', 'engineering'],
  research8: ['skills', 'research'],
  receiver: ['train'],
  all15: ['journal'],
};

export function objectiveStatus(state: GameState): { done: number; total: number; current: ObjectiveDef | null } {
  let done = 0;
  let current: ObjectiveDef | null = null;
  for (const o of OBJECTIVES) {
    const [c, t] = o.progress(state);
    if (c >= t) done++;
    else if (!current) current = o;
  }
  return { done, total: OBJECTIVES.length, current };
}

// ---------- Station ----------

export function stationView(ctx: ViewCtx): HTMLElement {
  const { state, act } = ctx;
  const obj = objectiveStatus(state);
  const panels: Child[] = [];

  if (obj.current) {
    const o = obj.current;
    const [c, t] = o.progress(state);
    const inChapter = OBJECTIVES.filter((x) => x.chapter === o.chapter);
    const doneInChapter = inChapter.filter((x) => {
      const [a, b] = x.progress(state);
      return a >= b;
    }).length;
    const route = OBJECTIVE_ROUTES[o.id] ?? ['station'];
    panels.push(
      card(
        'objective',
        h('p', { class: 'eyebrow' }, `${CHAPTERS[o.chapter]} · ${doneInChapter}/${inChapter.length}`),
        h('h2', { text: o.title }),
        h('p', { class: 'muted', text: o.hint }),
        t > 1 ? h('div', { class: 'row gap' }, bar(c / t, 'thin amber'), h('span', { class: 'mono small', text: `${c}/${t}` })) : null,
        h('button', { class: 'btn btn-secondary', text: 'Show me', attrs: { type: 'button' }, on: { click: () => act.go(route[0], route[1]) } }),
      ),
    );
  } else {
    panels.push(
      card(
        'objective done',
        h('p', { class: 'eyebrow cyan' }, 'Night Works complete'),
        h('h2', { text: 'Something down the line is answering.' }),
        h('p', { class: 'muted', text: 'Every goal in Ashvale is done. Keep levelling and filling the journal — the next station is coming.' }),
      ),
    );
  }

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
            img(portraitUrl(d.speaker, d.milestone ? 'relieved' : 'neutral'), 'portrait sm'),
            h('span', { class: 'talk-text' }, h('strong', { text: c.name }), h('span', { class: 'muted', text: d.title })),
            h('span', { class: 'talk-cta', text: 'Listen' }),
          );
        }),
      ),
    );
  }

  // Skills at a glance — tap to manage.
  panels.push(skillGrid(state, null, (k) => act.go('skills', k)));

  panels.push(
    card(
      'log-card',
      h('p', { class: 'eyebrow' }, 'Recent'),
      ctx.log.length === 0
        ? h('p', { class: 'muted small', text: 'Your finds will be listed here.' })
        : h('ol', { class: 'log' }, ctx.log.map((e) => h('li', { class: `log-${e.kind}` }, e.item ? img(itemIconUrl(e.item), 'px-icon sm') : null, h('span', { text: e.text })))),
    ),
  );

  const done = TRAIN_PART_IDS.filter((id) => state.repairs[id]).length;
  panels.push(
    card(
      'loco-strip',
      h('div', { class: 'row between' }, h('p', { class: 'eyebrow' }, 'Locomotive No. 9'), h('span', { class: 'mono small', text: `${done}/${TRAIN_PART_IDS.length}` })),
      h(
        'div',
        { class: 'pips' },
        TRAIN_PART_IDS.map((id) =>
          h('button', {
            class: `pip ${state.repairs[id] ? 'on' : repairBlockers(state, id).length === 0 ? 'ready' : ''} ${REPAIRS[id].kind}`,
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

/** 2×2 grid: every skill's level and progress, plus what's training now. */
function skillGrid(state: GameState, selected: SkillId | null, onPick: (k: SkillId) => void): HTMLElement {
  const training = state.activity ? activitySkill(state.activity) : null;
  return h(
    'div',
    { class: 'skill-grid', attrs: { role: selected ? 'tablist' : 'list', 'aria-label': 'Skills' } },
    SKILL_IDS.map((k) => {
      const p = levelProgress(state.skills[k].xp);
      return h(
        'button',
        {
          class: `skill-tile skill-${k} ${selected === k ? 'active' : ''} ${training === k ? 'training' : ''}`,
          attrs: { type: 'button', role: selected ? 'tab' : 'listitem', 'aria-selected': selected ? selected === k : undefined, 'aria-label': `${SKILL_NAMES[k]}, level ${p.level}${training === k ? ', training' : ''}` },
          on: { click: () => onPick(k) },
        },
        h('span', { class: 'skill-tile-top' }, h('span', { class: 'skill-tile-name', text: SKILL_NAMES[k] }), h('span', { class: 'skill-tile-level', text: String(p.level) })),
        bar(p.fraction, `thin ${skillBarClass(k)}`),
        training === k ? h('span', { class: 'skill-tile-status', text: 'Training' }) : h('span', { class: 'skill-tile-status muted', text: p.isMax ? 'Mastered' : `${Math.round(p.fraction * 100)}%` }),
      );
    }),
  );
}

function skillBarClass(k: SkillId): string {
  return k === 'scavenging' ? 'teal' : k === 'engineering' ? 'copper' : k === 'research' ? 'cyan' : 'amber';
}

export interface Milestone {
  level: number;
  text: string;
}

/** Everything a skill unlocks, by level. */
export function skillMilestones(skill: SkillId): Milestone[] {
  const out: Milestone[] = [];
  if (skill === 'scavenging') {
    for (const l of LOCATION_IDS) out.push({ level: LOCATIONS[l].levelRequired, text: LOCATIONS[l].name });
  }
  if (skill === 'engineering') {
    for (const r of RECIPE_IDS) out.push({ level: RECIPES[r].levelRequired, text: `${ITEMS[RECIPES[r].output].name}${RECIPES[r].research ? ' (blueprint)' : ''}` });
    for (const t of TRAIN_PART_IDS) out.push({ level: REPAIRS[t].levelRequired, text: `${REPAIRS[t].name} ${REPAIRS[t].kind}` });
  }
  if (skill === 'salvaging') {
    for (const t of SALVAGE_IDS) out.push({ level: SALVAGE[t].levelRequired, text: SALVAGE[t].name });
  }
  if (skill === 'research') {
    for (const p of PROJECT_IDS) out.push({ level: PROJECTS[p].levelRequired, text: PROJECTS[p].name });
  }
  for (const t of Object.keys(TOOLS) as ToolId[]) {
    if (TOOLS[t].skill === skill && TOOLS[t].levelRequired > 1) out.push({ level: TOOLS[t].levelRequired, text: `Equip ${ITEMS[t].name}` });
  }
  return out.sort((a, b) => a.level - b.level || a.text.localeCompare(b.text));
}

function skillHeader(state: GameState, skill: SkillId): HTMLElement {
  const p = levelProgress(state.skills[skill].xp);
  const lvl = p.level;
  const ms = skillMilestones(skill);
  const next = ms.find((m) => m.level > lvl);
  const upcoming = ms.filter((m) => m.level > lvl).slice(0, 3);
  const reached = ms.filter((m) => m.level <= lvl).length;
  return card(
    `skill-head skill-${skill}`,
    h(
      'div',
      { class: 'row between' },
      h('div', null, h('p', { class: 'eyebrow' }, 'Skill'), h('h2', { text: SKILL_NAMES[skill] })),
      h('div', { class: 'level-badge' }, h('span', { class: 'level-num', text: String(lvl) }), h('span', { class: 'level-max', text: '/20' })),
    ),
    h('p', { class: 'muted small', text: SKILL_BLURB[skill] }),
    bar(p.fraction, skillBarClass(skill)),
    h(
      'div',
      { class: 'row between mono small muted' },
      h('span', { text: p.isMax ? 'Max level' : `${p.current.toLocaleString()} / ${p.needed.toLocaleString()} XP` }),
      next ? h('span', { class: 'next-unlock', text: `Lv ${next.level}: ${next.text}` }) : null,
    ),
    h(
      'details',
      { class: 'milestones' },
      h('summary', null, `Unlocks · ${reached}/${ms.length} reached`),
      h(
        'ol',
        { class: 'milestone-list' },
        ms.map((m) => h('li', { class: m.level <= lvl ? 'done' : upcoming.includes(m) ? 'soon' : '' }, h('span', { class: 'ms-level mono', text: `Lv ${m.level}` }), h('span', { text: m.text }))),
      ),
    ),
  );
}

function toolSlot(state: GameState, skill: SkillId, act: Actions): HTMLElement {
  const equipped = state.equipment[skill];
  const owned = ownedTools(state, skill);
  return card(
    'tool-slot',
    h('div', { class: 'row between' }, h('p', { class: 'eyebrow' }, 'Tool slot'), owned.length > 0 ? h('button', { class: 'btn-chip', text: equipped ? 'Change' : 'Equip', attrs: { type: 'button' }, on: { click: () => act.openTools(skill) } }) : null),
    equipped
      ? h(
          'button',
          { class: 'tool-row linkish', attrs: { type: 'button' }, on: { click: () => act.openItem(equipped) } },
          img(itemIconUrl(equipped), `px-icon ${rarityClass(equipped)}`),
          h('span', { class: 'tool-text' }, h('strong', { text: ITEMS[equipped].name }), h('span', { class: 'cyan small', text: `Tier ${TOOLS[equipped].tier} · ${TOOLS[equipped].bonusText}` })),
        )
      : h('p', { class: 'muted small', text: owned.length > 0 ? 'You have a tool for this skill — equip it.' : 'Empty. Craft one in Engineering → Tools, then equip it here.' }),
  );
}

function locationCard(ctx: ViewCtx, id: LocationId): HTMLElement {
  const { state, act } = ctx;
  const loc = LOCATIONS[id];
  const spec: ActivitySpec = { kind: 'scavenge', locationId: id };
  const access = locationAccess(state, id);
  const running = isRunning(state, spec);
  const discTotal = DISCOVERIES.filter((d) => d.location === id);
  const discFound = discTotal.filter((d) => d.id in state.discoveries).length;
  return card(
    `place place-${id} ${access.ok ? '' : 'locked'} ${running ? 'running' : ''}`,
    h('div', { class: 'row between' }, h('h3', { text: loc.name }), h('span', { class: 'tag', text: access.ok ? meta(state, spec) : `Lv ${loc.levelRequired}` })),
    h('p', { class: 'muted small', text: loc.description }),
    access.ok ? dropList(state, loc.drops, act) : h('p', { class: 'lock-reason', text: `\u{1F512} ${access.reason}` }),
    access.ok
      ? h('div', { class: 'row between mono small muted' }, h('span', { text: `${(state.stats.searches[id] ?? 0).toLocaleString()} searches` }), h('span', { class: 'cyan', text: `Journal ${discFound}/${discTotal.length}` }))
      : null,
    running ? bar(0, 'amber thin', true) : null,
    runButton(state, spec, act, access.ok ? `Search the ${loc.short}` : 'Locked', access.ok, 'Stop searching'),
  );
}

function recipeCard(ctx: ViewCtx, id: RecipeId): HTMLElement {
  const { state, act } = ctx;
  const r = RECIPES[id];
  const spec: ActivitySpec = { kind: 'craft', recipeId: id };
  const unlocked = recipeUnlocked(state, id);
  const running = isRunning(state, spec);
  const n = craftableCount(state, id);
  const isToolRecipe = r.category === 'tools';
  const owned = isToolRecipe && (state.inventory[r.output] > 0 || Object.values(state.equipment).includes(r.output as ToolId));
  return card(
    `recipe ${unlocked.ok ? '' : 'locked'} ${running ? 'running' : ''}`,
    h(
      'div',
      { class: 'row between' },
      h('button', { class: 'linkish recipe-out', attrs: { type: 'button' }, on: { click: () => act.openItem(r.output) } }, itemChip(r.output)),
      h('span', { class: 'tag', text: unlocked.ok ? meta(state, spec) : `Lv ${r.levelRequired}` }),
    ),
    isToolRecipe
      ? h('p', { class: 'benefit small', text: `${SKILL_NAMES[TOOLS[r.output as ToolId].skill]} tool · tier ${r.tier} · ${TOOLS[r.output as ToolId].bonusText}${owned ? ' · owned' : ''}` })
      : h('p', { class: 'muted small', text: `Tier ${r.tier} part${(modifiers(state).recipeYield[id] ?? 0) > 0 ? ` · makes ${r.outputQty + (modifiers(state).recipeYield[id] ?? 0)}` : ''}` }),
    unlocked.ok ? costList(state, r.inputs, act, 'Needs') : h('p', { class: 'lock-reason', text: `\u{1F512} ${unlocked.reason}` }),
    running ? bar(0, 'copper thin', true) : null,
    unlocked.ok ? runButton(state, spec, act, n > 0 ? `Craft (can make ${n})` : 'Not enough materials', n > 0, 'Stop crafting') : null,
  );
}

function salvageCard(ctx: ViewCtx, id: SalvageId): HTMLElement {
  const { state, act } = ctx;
  const t = SALVAGE[id];
  const spec: ActivitySpec = { kind: 'salvage', targetId: id };
  const unlocked = salvageUnlocked(state, id);
  const running = isRunning(state, spec);
  const count = salvageCount(state, id);
  const machine = t.input ? (Object.keys(t.input)[0] as ItemId) : null;
  return card(
    `salvage ${unlocked.ok ? '' : 'locked'} ${running ? 'running' : ''}`,
    h('div', { class: 'row between' }, h('h3', { class: 'row gap' }, machine ? img(itemIconUrl(machine), 'px-icon') : null, t.name), h('span', { class: 'tag', text: unlocked.ok ? meta(state, spec) : `Lv ${t.levelRequired}` })),
    h('p', { class: 'muted small', text: t.description }),
    unlocked.ok ? dropList(state, t.drops, act) : h('p', { class: 'lock-reason', text: `\u{1F512} ${unlocked.reason}` }),
    unlocked.ok && machine
      ? h('p', { class: `mono small ${count > 0 ? '' : 'muted'}`, text: count > 0 ? `${count} ${ITEMS[machine].name} to break down` : `No ${ITEMS[machine].name} — found while scavenging` })
      : unlocked.ok
        ? h('p', { class: 'mono small muted', text: 'Never runs out' })
        : null,
    running ? bar(0, 'amber thin', true) : null,
    unlocked.ok ? runButton(state, spec, act, machine ? (count > 0 ? `Break down (${count})` : 'Nothing to break down') : 'Strip the wagon', count > 0, 'Stop salvaging') : null,
  );
}

function projectCard(ctx: ViewCtx, id: ProjectId): HTMLElement {
  const { state, act } = ctx;
  const p = PROJECTS[id];
  const spec: ActivitySpec = { kind: 'research', projectId: id };
  const done = state.research.done.includes(id);
  const unlocked = projectUnlocked(state, id);
  const running = isRunning(state, spec);
  const prog = projectProgress(state, id);
  const disc = p.discoveryRequired ? DISCOVERY_BY_ID[p.discoveryRequired] : undefined;
  const hasDisc = !disc || disc.id in state.discoveries;
  const canStudy = !done && unlocked.ok && Object.entries(p.input).every(([k, n]) => state.inventory[k as ItemId] >= (n ?? 0));
  return card(
    `project ${done ? 'done' : unlocked.ok ? '' : 'locked'} ${running ? 'running' : ''}`,
    h(
      'div',
      { class: 'row between' },
      h('h3', { class: 'row gap' }, disc ? img(discoveryIconUrl(disc.id), hasDisc ? 'px-icon' : 'px-icon silhouette') : null, hasDisc ? p.name : 'Unknown subject'),
      h('span', { class: `tag ${done ? 'tag-done' : ''}`, text: done ? 'Finished' : unlocked.ok ? meta(state, spec) : `Lv ${p.levelRequired}` }),
    ),
    h('p', { class: 'muted small', text: hasDisc ? p.description : `Find something in the ${disc ? LOCATIONS[disc.location].name : 'station'} to study.` }),
    hasDisc ? h('p', { class: done ? 'cyan small' : 'benefit small', text: p.unlockText }) : null,
    prog && !done ? h('div', { class: 'row gap' }, bar(prog[0] / prog[1], 'cyan thin'), h('span', { class: 'mono small', text: `${prog[0]}/${prog[1]}` })) : null,
    !done && unlocked.ok ? costList(state, p.input, act, 'Each study uses') : null,
    !done && !unlocked.ok && hasDisc ? h('p', { class: 'lock-reason', text: `\u{1F512} ${unlocked.reason}` }) : null,
    running ? bar(0, 'cyan thin', true) : null,
    !done && unlocked.ok ? runButton(state, spec, act, canStudy ? (prog ? 'Study' : 'Study (repeatable)') : 'Not enough notes', canStudy, 'Stop studying') : null,
  );
}

export function skillsView(ctx: ViewCtx): HTMLElement {
  const { state, ui, act } = ctx;
  const skill = ui.skillTab;
  let body: Child;
  if (skill === 'scavenging') body = LOCATION_IDS.map((id) => locationCard(ctx, id));
  else if (skill === 'engineering') {
    body = [
      segmented<RecipeCategory>(
        [
          ['parts', 'Parts'],
          ['tools', 'Tools'],
        ],
        ui.recipeCat,
        (v) => act.setUi({ recipeCat: v }),
        'Recipe type',
      ),
      RECIPE_IDS.filter((r) => RECIPES[r].category === ui.recipeCat).map((id) => recipeCard(ctx, id)),
    ];
  } else if (skill === 'salvaging') body = SALVAGE_IDS.map((id) => salvageCard(ctx, id));
  else {
    const notes = state.inventory.waterloggedNotes;
    const ordered = [...PROJECT_IDS].sort((a, b) => Number(state.research.done.includes(a)) - Number(state.research.done.includes(b)));
    body = [
      h('p', { class: 'muted small pad', text: `${notes.toLocaleString()} Waterlogged Notes · ${state.research.done.length}/${PROJECT_IDS.length - 1} projects finished` }),
      ordered.map((id) => projectCard(ctx, id)),
    ];
  }
  return h('div', { class: 'view' }, skillGrid(state, skill, (k) => act.setUi({ skillTab: k })), skillHeader(state, skill), toolSlot(state, skill, act), body);
}

// ---------- Train ----------

function partCard(state: GameState, id: TrainPartId, act: Actions): HTMLElement {
  const r = REPAIRS[id];
  const isDone = state.repairs[id];
  const blockers = repairBlockers(state, id);
  const ready = blockers.length === 0;
  const needs: Child[] = [];
  if (!isDone) {
    for (const p of r.requires ?? []) {
      needs.push(h('li', { class: state.repairs[p] ? 'met' : 'short' }, h('span', { class: 'item-chip', text: `${REPAIRS[p].name} restored` }), h('span', { class: 'cost-count', text: state.repairs[p] ? '✓' : '✗' })));
    }
    if (r.research) {
      const ok = state.research.done.includes(r.research);
      needs.push(h('li', { class: ok ? 'met' : 'short' }, h('span', { class: 'item-chip', text: `Research: ${PROJECTS[r.research].name}` }), h('span', { class: 'cost-count', text: ok ? '✓' : '✗' })));
    }
    const lvlOk = skillLevel(state, 'engineering') >= r.levelRequired;
    needs.push(h('li', { class: lvlOk ? 'met' : 'short' }, h('span', { class: 'item-chip', text: 'Engineering level' }), h('span', { class: 'cost-count', text: `${Math.min(skillLevel(state, 'engineering'), r.levelRequired)}/${r.levelRequired}` })));
  }
  const label = ready
    ? `${r.kind === 'repair' ? 'Repair' : 'Fit'} the ${r.name}`
    : blockers.includes('needsPart')
      ? 'Needs an earlier repair'
      : blockers.includes('needsResearch')
        ? 'Needs research'
        : blockers.includes('levelTooLow')
          ? `Reach Engineering ${r.levelRequired}`
          : 'Gather the parts';
  return card(
    `repair ${isDone ? 'done' : ready ? 'ready' : ''}`,
    h('div', { class: 'row between' }, h('h3', { text: r.name }), h('span', { class: `tag ${isDone ? 'tag-done' : ready ? 'tag-ready' : ''}`, text: isDone ? 'Done' : ready ? 'Ready' : `Eng ${r.levelRequired}` })),
    h('p', { class: 'muted small', text: isDone ? r.doneText : r.description }),
    h('p', { class: 'benefit', text: r.benefit }),
    isDone ? null : [h('ul', { class: 'cost-list' }, needs), costList(state, r.cost, act), h('button', { class: 'btn btn-repair', text: label, attrs: { type: 'button', disabled: !ready }, on: { click: () => act.repair(id) } })],
  );
}

export function trainView(ctx: ViewCtx): HTMLElement {
  const { state, act } = ctx;
  const repaired = REPAIR_IDS.filter((id) => state.repairs[id]).length;
  const improved = IMPROVEMENT_IDS.filter((id) => state.repairs[id]).length;
  const m = modifiers(state);
  const bonuses = [
    ...SKILL_IDS.filter((k) => m.speed[k] > 0.001).map((k) => `${SKILL_SHORT[k]} +${Math.round(m.speed[k] * 100)}% speed`),
    m.rareChance > 1.001 ? `Rare ×${m.rareChance.toFixed(2)}` : null,
    m.xp > 1.001 ? `XP +${Math.round((m.xp - 1) * 100)}%` : null,
    m.doubleChance > 0 ? `Double yield ${Math.round(m.doubleChance * 100)}%` : null,
  ].filter((b): b is string => b !== null);

  return h(
    'div',
    { class: 'view' },
    card(
      'train-head',
      h('p', { class: 'eyebrow' }, 'Locomotive No. 9'),
      h('h2', { text: repaired === REPAIR_IDS.length ? 'Restored — now make her a home' : `${repaired} of ${REPAIR_IDS.length} systems restored` }),
      bar((repaired + improved) / TRAIN_PART_IDS.length, 'amber'),
      bonuses.length ? h('ul', { class: 'bonus-list', attrs: { 'aria-label': 'Total bonuses from repairs, research, tools and feats' } }, bonuses.map((b) => h('li', { text: b }))) : h('p', { class: 'muted small', text: 'Every repair shows on the engine above and makes your work easier.' }),
    ),
    h('h3', { class: 'section-title', text: `Repairs · ${repaired}/${REPAIR_IDS.length}` }),
    REPAIR_IDS.map((id) => partCard(state, id, act)),
    h('h3', { class: 'section-title', text: `Improvements · ${improved}/${IMPROVEMENT_IDS.length}` }),
    IMPROVEMENT_IDS.map((id) => partCard(state, id, act)),
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
  const emptyText: Record<SatchelFilter, string> = {
    all: 'Your satchel is empty. Start scavenging to fill it.',
    material: 'No materials yet. Scavenge and salvage to find them.',
    component: 'No parts yet. Engineering turns materials into parts.',
    machinery: 'No machinery yet. Lanterns, telegraphs, pumps and dynamos turn up while scavenging.',
    tool: 'No spare tools. Equipped tools live in their skill’s tool slot.',
  };

  return h(
    'div',
    { class: 'view' },
    card(
      'satchel-head',
      h('div', { class: 'row between' }, h('h2', { text: 'Satchel' }), h('span', { class: 'mono small muted', text: `${known}/${ITEM_IDS.length} found` })),
      segmented<SatchelFilter>(
        [
          ['all', 'All'],
          ['material', 'Materials'],
          ['component', 'Parts'],
          ['machinery', 'Machines'],
          ['tool', 'Tools'],
        ],
        ui.filter,
        (v) => act.setUi({ filter: v }),
        'Filter',
        'compact',
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
      ? card('empty', h('p', { class: 'muted', text: emptyText[ui.filter] }))
      : h(
          'ul',
          { class: 'item-grid' },
          ids.map((id) =>
            h(
              'li',
              null,
              h(
                'button',
                { class: `item-tile ${rarityClass(id)}`, attrs: { type: 'button', 'aria-label': `${ITEMS[id].name}, ${state.inventory[id]}, ${ITEMS[id].rarity}` }, on: { click: () => act.openItem(id) } },
                img(itemIconUrl(id), 'px-icon'),
                h('span', { class: 'tile-count', text: state.inventory[id].toLocaleString() }),
                h('span', { class: 'tile-name', text: ITEMS[id].name }),
                h('span', { class: 'tile-rarity', text: ITEMS[id].rarity }),
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
        const studied = PROJECT_IDS.find((p) => PROJECTS[p].discoveryRequired === d.id);
        return h(
          'li',
          null,
          h(
            'button',
            { class: `disc ${has ? 'found' : 'unknown'}`, attrs: { type: 'button', disabled: !has }, on: { click: () => act.openDiscovery(d.id) } },
            img(discoveryIconUrl(d.id), has ? 'px-icon' : 'px-icon silhouette'),
            h('span', { class: 'disc-cat', text: has ? CATEGORY_NAMES[d.category] : LOCATIONS[d.location].name }),
            h('span', { class: 'disc-name', text: has ? d.name : '???' }),
            has && studied ? h('span', { class: `disc-study ${state.research.done.includes(studied) ? 'done' : ''}`, text: state.research.done.includes(studied) ? 'Studied' : 'Can be studied' }) : null,
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
        h('div', { class: 'row gap' }, img(portraitUrl(sid), convs.length ? 'portrait md' : 'portrait md silhouette'), h('div', null, h('h3', { text: convs.length ? c.name : '???' }), h('p', { class: 'muted small', text: convs.length ? c.role : 'Not yet met' }))),
        convs.length
          ? h('ul', { class: 'conv-list' }, convs.map((d) => h('li', null, h('button', { class: `conv ${state.dialogues.read.includes(d.id) ? '' : 'unread'}`, text: d.title, attrs: { type: 'button' }, on: { click: () => act.openDialogue(d.id) } }))))
          : null,
      );
    });
  } else if (ui.journalTab === 'feats') {
    const earned = ACHIEVEMENTS.filter((a) => a.id in state.achievements).length;
    body = [
      h('p', { class: 'muted small pad', text: `${earned}/${ACHIEVEMENTS.length} earned · most feats grant a permanent bonus` }),
      h(
        'ul',
        { class: 'feats' },
        ACHIEVEMENTS.map((a) => {
          const has = a.id in state.achievements;
          return h(
            'li',
            { class: has ? 'earned' : '' },
            h('span', { class: 'feat-mark', text: has ? '★' : '☆', attrs: { 'aria-hidden': 'true' } }),
            h('div', null, h('strong', { text: a.name }), h('span', { class: 'muted small', text: a.description }), a.reward ? h('span', { class: has ? 'cyan small' : 'small reward-locked', text: `Reward: ${a.reward.text}` }) : null),
          );
        }),
      ),
    ];
  } else {
    body = progressOverview(state, act);
  }
  return h('div', { class: 'view' }, segmented(tabs, ui.journalTab, (v) => act.setUi({ journalTab: v }), 'Journal sections'), body);
}

function progressOverview(state: GameState, act: Actions): Child {
  const totalSearches = Object.values(state.stats.searches).reduce((x, y) => x + (y ?? 0), 0);
  const total = SKILL_IDS.reduce((sum, k) => sum + skillLevel(state, k), 0);
  return [
    card('overview', h('div', { class: 'row between' }, h('p', { class: 'eyebrow' }, 'Skills'), h('span', { class: 'mono small muted', text: `Total level ${total}/${SKILL_IDS.length * 20}` })), skillGrid(state, null, (k) => act.go('skills', k))),
    ([1, 2] as const).map((ch) =>
      card(
        'objectives',
        h('p', { class: 'eyebrow' }, CHAPTERS[ch]),
        h(
          'ol',
          { class: 'checklist' },
          OBJECTIVES.filter((o) => o.chapter === ch).map((o) => {
            const [c, t] = o.progress(state);
            return h('li', { class: c >= t ? 'done' : '' }, h('span', { class: 'check', text: c >= t ? '✓' : '' }), h('span', { text: o.title }), t > 1 && c < t ? h('span', { class: 'mono small muted', text: ` ${c}/${t}` }) : null);
          }),
        ),
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
          ['Parts & tools crafted', state.stats.crafts],
          ['Machines salvaged', state.stats.salvages],
          ['Pages studied', state.stats.studies],
          ['Rare finds', state.stats.rareFinds],
          ['Research projects', `${state.research.done.length}/${PROJECT_IDS.length - 1}`],
          ['Discoveries', `${Object.keys(state.discoveries).length}/${DISCOVERIES.length}`],
          ['Feats', `${Object.keys(state.achievements).length}/${ACHIEVEMENTS.length}`],
          ['Train', `${TRAIN_PART_IDS.filter((id) => state.repairs[id]).length}/${TRAIN_PART_IDS.length}`],
        ].map(([k, v]) => [h('dt', { text: String(k) }), h('dd', { text: typeof v === 'number' ? v.toLocaleString() : String(v) })]),
      ),
    ),
  ];
}

// ---------- item details ----------

export function itemSources(id: ItemId): string[] {
  const out: string[] = [];
  for (const loc of LOCATION_IDS) {
    const d = LOCATIONS[loc].drops.find((x) => x.item === id);
    if (d) out.push(`Scavenging · ${LOCATIONS[loc].name} · ${pct(d.chance)}`);
  }
  for (const t of SALVAGE_IDS) {
    const d = SALVAGE[t].drops.find((x) => x.item === id);
    if (d) out.push(`Salvaging · ${SALVAGE[t].name} · ${pct(d.chance)}`);
  }
  for (const r of RECIPE_IDS) if (RECIPES[r].output === id) out.push(`Engineering · Lv ${RECIPES[r].levelRequired}${RECIPES[r].research ? ` · blueprint: ${PROJECTS[RECIPES[r].research as ProjectId].name}` : ''}`);
  return out;
}

export function itemUses(id: ItemId): string[] {
  const out: string[] = [];
  for (const r of RECIPE_IDS) if (RECIPES[r].inputs[id]) out.push(`${ITEMS[RECIPES[r].output].name} (×${RECIPES[r].inputs[id]})`);
  for (const r of TRAIN_PART_IDS) if (REPAIRS[r].cost[id]) out.push(`${REPAIRS[r].name} (×${REPAIRS[r].cost[id]})`);
  for (const t of SALVAGE_IDS) if (SALVAGE[t].input?.[id]) out.push(`Salvaging · ${SALVAGE[t].name}`);
  for (const p of PROJECT_IDS) if (PROJECTS[p].input[id]) out.push(`Research · ${PROJECTS[p].name}`);
  return out;
}
