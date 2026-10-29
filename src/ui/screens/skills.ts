// Skills — four gauges across the top, the selected skill's instrument
// plate, then its activities as timetable rows. Rows are compact; tap the
// row to open its details (rewards, requirements, story).

import { ITEMS, type ItemId } from '../../core/content/items';
import { DISCOVERY_BY_ID } from '../../core/content/story';
import {
  LOCATION_IDS,
  LOCATIONS,
  PROJECT_IDS,
  PROJECTS,
  RECIPE_IDS,
  RECIPES,
  SALVAGE,
  SALVAGE_IDS,
  SKILL_BLURB,
  SKILL_IDS,
  SKILL_NAMES,
  TOOLS,
  type DropDef,
  type ItemBundle,
  type LocationId,
  type ProjectId,
  type RecipeCategory,
  type RecipeId,
  type SalvageId,
  type SkillId,
  type ToolId,
} from '../../core/content/world';
import {
  actionDuration,
  activitySkill,
  craftableCount,
  dropChance,
  locationAccess,
  modifiers,
  ownedTools,
  projectProgress,
  projectUnlocked,
  recipeUnlocked,
  salvageCount,
  salvageUnlocked,
  skillLevel,
  xpPerAction,
  type ActivitySpec,
} from '../../core/rules';
import type { GameState } from '../../core/state';
import { levelProgress } from '../../core/xp';
import { h, type Child } from '../dom';
import { art, button, fmtQty, fmtSeconds, gauge, progress, requirements, rewardChips, stamp, tabs, yieldStrip, type Requirement } from '../kit';
import { discoveryIconUrl, itemIconUrl } from '../sprites';
import { aggregate, isRunning, pct, seen, skillEmblem, skillMilestones, SKILL_LABEL, SKILL_TONE, specKey, type ScreenCtx } from './shared';

export function skillsScreen(ctx: ScreenCtx): HTMLElement {
  const { ui } = ctx;
  return h('div', { class: 'screen-body skills' }, skillSelector(ctx), skillPlate(ctx), sessionRewards(ctx), activities(ctx, ui.skill));
}

// ---------- selector ----------

function skillSelector(ctx: ScreenCtx): HTMLElement {
  const { state, ui, act } = ctx;
  const training = state.activity ? activitySkill(state.activity) : null;
  return h(
    'div',
    { class: 'skill-selector', attrs: { role: 'tablist', 'aria-label': 'Skills' } },
    SKILL_IDS.map((k, i) => {
      const p = levelProgress(state.skills[k].xp);
      const selected = ui.skill === k;
      return h(
        'button',
        {
          class: `skill-pick${selected ? ' is-active' : ''}${training === k ? ' is-training' : ''}`,
          attrs: {
            type: 'button',
            role: 'tab',
            'aria-selected': selected,
            tabindex: selected ? 0 : -1,
            'aria-label': `${SKILL_NAMES[k]}, level ${p.level}${training === k ? ', training now' : ''}`,
          },
          data: { key: `skill:${k}` },
          on: {
            click: () => act.setUi({ skill: k }),
            keydown: (e) => {
              const ev = e as KeyboardEvent;
              const d = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
              if (!d) return;
              ev.preventDefault();
              const next = SKILL_IDS[(i + d + SKILL_IDS.length) % SKILL_IDS.length];
              if (next) act.setUi({ skill: next });
            },
          },
        },
        gauge(p.fraction, String(p.level), SKILL_TONE[k], 58),
        h('span', { class: 'skill-pick-name', text: SKILL_LABEL[k] }),
        training === k ? h('span', { class: 'skill-pick-lamp', attrs: { 'aria-hidden': 'true' } }) : null,
      );
    }),
  );
}

// ---------- instrument plate ----------

function skillPlate(ctx: ScreenCtx): HTMLElement {
  const { state, ui, act } = ctx;
  const skill = ui.skill;
  const p = levelProgress(state.skills[skill].xp);
  const ms = skillMilestones(skill);
  const next = ms.find((m) => m.level > p.level);
  const open = !!ui.open[`unlocks:${skill}`];
  const equipped = state.equipment[skill];
  const owned = ownedTools(state, skill);
  return h(
    'section',
    { class: `plate skill-plate tone-${SKILL_TONE[skill]}`, attrs: { 'aria-label': `${SKILL_NAMES[skill]} details` } },
    h(
      'div',
      { class: 'skill-plate-head' },
      h('span', { class: 'skill-plate-emblem' }, art(skillEmblem(skill), 24)),
      h('div', { class: 'skill-plate-id' }, h('h2', { class: 'label-heading', text: SKILL_NAMES[skill] }), h('p', { class: 'text-small text-muted', text: SKILL_BLURB[skill] })),
      h('div', { class: 'skill-plate-level' }, h('span', { class: 'label-micro', text: 'Level' }), h('strong', { class: 'num', text: String(p.level) }), h('span', { class: 'text-muted num', text: '/20' })),
    ),
    progress(p.fraction, SKILL_TONE[skill], { label: `${SKILL_NAMES[skill]} experience` }),
    h(
      'div',
      { class: 'skill-plate-meta' },
      h('span', { class: 'num', text: p.isMax ? 'Mastered' : `${fmtQty(p.current)} / ${fmtQty(p.needed)} XP` }),
      next ? h('span', { class: 'skill-next' }, h('span', { class: 'text-muted', text: `Lv ${next.level} ` }), next.text) : null,
    ),
    // Tool slot — a real equipment slot, not decoration.
    h(
      'div',
      { class: 'tool-slot' },
      equipped ? art(itemIconUrl(equipped), 32) : h('span', { class: 'tool-slot-empty', attrs: { 'aria-hidden': 'true' } }),
      h(
        'div',
        { class: 'tool-slot-text' },
        h('span', { class: 'label-micro', text: 'Tool' }),
        equipped
          ? h('span', null, h('strong', { text: ITEMS[equipped].name }), h('span', { class: 'text-cyan text-small', text: ` · ${TOOLS[equipped].bonusText}` }))
          : h('span', { class: 'text-small text-muted', text: owned.length ? 'A tool is waiting in your satchel' : 'Empty — craft one in Engineering → Tools' }),
      ),
      owned.length ? button({ label: equipped ? 'Change' : 'Equip', variant: 'secondary', size: 's', key: `tool:${skill}`, onClick: () => act.openTools(skill) }) : null,
    ),
    h('button', { class: 'expander', text: `Unlocks · ${ms.filter((m) => m.level <= p.level).length}/${ms.length}`, attrs: { type: 'button', 'aria-expanded': open }, data: { key: `unlocks:${skill}` }, on: { click: () => act.toggle(`unlocks:${skill}`) } }),
    open
      ? h(
          'ol',
          { class: 'unlock-list' },
          ms.map((m) => h('li', { class: m.level <= p.level ? 'is-done' : '' }, h('span', { class: 'num unlock-lv', text: `Lv ${m.level}` }), h('span', { text: m.text }))),
        )
      : null,
  );
}

function sessionRewards(ctx: ScreenCtx): HTMLElement | null {
  const { history, ui, act } = ctx;
  const mine = history.filter((e) => e.skill === ui.skill).slice(0, 12);
  if (mine.length === 0) return null;
  const agg = aggregate(mine);
  return h(
    'section',
    { class: 'session-rewards', attrs: { 'aria-label': 'Recent rewards for this skill' } },
    h('div', { class: 'group-head' }, h('h2', { class: 'label-section', text: 'Recent' }), button({ label: 'History', variant: 'ghost', size: 's', onClick: () => act.openHistory() })),
    agg.items.length
      ? rewardChips(agg.items.map(([id, n]) => ({ icon: itemIconUrl(id), label: ITEMS[id].name, qty: n, rarity: ITEMS[id].rarity })), 6)
      : h('p', { class: 'text-small text-muted', text: `${fmtQty(agg.actions)} actions · +${fmtQty(agg.xp[ui.skill] ?? 0)} XP` }),
  );
}

// ---------- activities ----------

const PLAY = 'M6 4l12 8-12 8z';
const STOP = 'M6 6h12v12H6z';

function svgIcon(path: string): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', path);
  svg.append(p);
  return svg;
}

interface RowOpts {
  spec: ActivitySpec;
  icon: HTMLElement;
  title: string;
  meta: Child[];
  yields?: { icon: string; label: string; unknown?: boolean }[];
  lock?: string | null;
  canStart: boolean;
  startLabel: string;
  detail: () => Child[];
  progress?: [number, number] | null;
  done?: boolean;
}

function row(ctx: ScreenCtx, o: RowOpts): HTMLElement {
  const { state, ui, act } = ctx;
  const key = specKey(o.spec);
  const running = isRunning(state, o.spec);
  const open = !!ui.open[key];
  const title = o.title;
  return h(
    'li',
    { class: `tt-row${running ? ' is-running' : ''}${o.lock ? ' is-locked' : ''}${open ? ' is-open' : ''}${o.done ? ' is-done' : ''}` },
    h(
      'div',
      { class: 'tt-main' },
      h(
        'button',
        { class: 'tt-toggle', attrs: { type: 'button', 'aria-expanded': open, 'aria-controls': `d-${key}` }, data: { key: `row:${key}` }, on: { click: () => act.toggle(key) } },
        h('span', { class: 'tt-icon' }, o.icon),
        h(
          'span',
          { class: 'tt-text' },
          h('span', { class: 'tt-title', text: title }),
          h('span', { class: 'tt-meta' }, o.lock ? h('span', { class: 'tt-lock', text: o.lock }) : o.meta),
          !o.lock && o.yields?.length ? yieldStrip(o.yields) : null,
        ),
        h('span', { class: 'tt-chev', attrs: { 'aria-hidden': 'true' } }),
      ),
      o.done
        ? stamp('Done', 'cyan')
        : h(
            'button',
            {
              class: `act-btn${running ? ' is-stop' : ''}`,
              attrs: { type: 'button', disabled: !running && (!o.canStart || !!o.lock), 'aria-label': running ? `Stop ${title}` : `${o.startLabel}: ${title}` },
              data: { key: `act:${key}` },
              on: { click: () => (running ? act.stop() : act.start(o.spec)) },
            },
            svgIcon(running ? STOP : PLAY),
          ),
    ),
    running ? h('div', { class: 'tt-progress' }, progress(0, 'amber', { live: 'activity', thin: true, label: 'Action progress' })) : null,
    o.progress && !o.done ? h('div', { class: 'tt-progress tt-progress-project' }, progress(o.progress[0] / o.progress[1], 'cyan', { thin: true, label: 'Project progress' }), h('span', { class: 'num text-small', text: `${o.progress[0]}/${o.progress[1]}` })) : null,
    open ? h('div', { class: 'tt-detail', attrs: { id: `d-${key}` } }, ...o.detail()) : null,
  );
}

function metaTiming(state: GameState, spec: ActivitySpec): Child[] {
  return [h('span', null, h('span', { class: 'num', text: fmtSeconds(actionDuration(state, spec)) })), h('span', null, h('span', { class: 'num', text: `${xpPerAction(state, spec)}` }), ' XP')];
}

function yieldsOf(state: GameState, drops: DropDef[]): { icon: string; label: string; unknown?: boolean }[] {
  return drops.map((d) => ({ icon: itemIconUrl(d.item), label: seen(state, d.item) ? ITEMS[d.item].name : 'Unknown item', unknown: !seen(state, d.item) }));
}

function dropTable(state: GameState, drops: DropDef[], act: ScreenCtx['act']): HTMLElement {
  return h(
    'ul',
    { class: 'drop-table', attrs: { 'aria-label': 'Possible rewards' } },
    drops.map((d) => {
      const known = seen(state, d.item);
      return h(
        'li',
        { class: `drop-row rarity-${ITEMS[d.item].rarity}` },
        h('button', { class: 'drop-btn', attrs: { type: 'button', 'aria-label': known ? `${ITEMS[d.item].name}, ${pct(dropChance(state, d.item, d.chance))}` : 'Unknown item' }, on: { click: () => act.openItem(d.item) } }, art(itemIconUrl(d.item), 32, { silhouette: !known })),
        h('span', { class: 'drop-name', text: known ? ITEMS[d.item].name : '???' }),
        h('span', { class: 'drop-chance', text: `${d.min === d.max ? d.min : `${d.min}–${d.max}`} · ${pct(dropChance(state, d.item, d.chance))}` }),
      );
    }),
  );
}

function costReqs(state: GameState, bundle: ItemBundle, act: ScreenCtx['act']): Requirement[] {
  return (Object.entries(bundle) as [ItemId, number][]).map(([id, need]) => ({
    label: seen(state, id) ? ITEMS[id].name : '???',
    icon: itemIconUrl(id),
    unknown: !seen(state, id),
    have: state.inventory[id],
    need,
    onClick: () => act.openItem(id),
  }));
}

function activities(ctx: ScreenCtx, skill: SkillId): HTMLElement {
  const { state, ui, act } = ctx;
  let head: Child = null;
  let rows: HTMLElement[] = [];
  if (skill === 'scavenging') rows = LOCATION_IDS.map((id) => locationRow(ctx, id));
  else if (skill === 'engineering') {
    head = tabs<RecipeCategory>(
      [
        { id: 'parts', label: 'Parts' },
        { id: 'tools', label: 'Tools' },
      ],
      ui.recipeCat,
      (v) => act.setUi({ recipeCat: v }),
      'Recipe type',
    );
    rows = RECIPE_IDS.filter((r) => RECIPES[r].category === ui.recipeCat).map((id) => recipeRow(ctx, id));
  } else if (skill === 'salvaging') rows = SALVAGE_IDS.map((id) => salvageRow(ctx, id));
  else {
    const order = [...PROJECT_IDS].sort((a, b) => Number(state.research.done.includes(a)) - Number(state.research.done.includes(b)));
    head = h('p', { class: 'text-small text-muted' }, art(itemIconUrl('waterloggedNotes'), 32), h('span', { class: 'num', text: ` ${fmtQty(state.inventory.waterloggedNotes)}` }), ' Waterlogged Notes · ', h('span', { class: 'num', text: `${state.research.done.length}/${PROJECT_IDS.length - 1}` }), ' projects finished');
    rows = order.map((id) => projectRow(ctx, id));
  }
  const titles: Record<SkillId, string> = { scavenging: 'Places to search', engineering: 'Workbench', salvaging: 'Salvage yard', research: 'Reading desk' };
  return h('section', { class: 'group activities' }, h('header', { class: 'group-head' }, h('h2', { class: 'label-section', text: titles[skill] })), head, h('ul', { class: 'timetable' }, rows));
}

function locationRow(ctx: ScreenCtx, id: LocationId): HTMLElement {
  const { state, act } = ctx;
  const loc = LOCATIONS[id];
  const spec: ActivitySpec = { kind: 'scavenge', locationId: id };
  const access = locationAccess(state, id);
  return row(ctx, {
    spec,
    icon: art(skillEmblem('scavenging'), 24),
    title: loc.name,
    meta: [...metaTiming(state, spec), h('span', null, h('span', { class: 'num', text: fmtQty(state.stats.searches[id] ?? 0) }), ' searches')],
    yields: yieldsOf(state, loc.drops),
    lock: access.ok ? null : access.reason,
    canStart: access.ok,
    startLabel: 'Search',
    detail: () => [h('p', { class: 'tt-desc', text: loc.description }), access.ok ? dropTable(state, loc.drops, act) : h('p', { class: 'lock-note', text: access.reason })],
  });
}

function recipeRow(ctx: ScreenCtx, id: RecipeId): HTMLElement {
  const { state, act } = ctx;
  const r = RECIPES[id];
  const spec: ActivitySpec = { kind: 'craft', recipeId: id };
  const unlocked = recipeUnlocked(state, id);
  const n = craftableCount(state, id);
  const isTool = r.category === 'tools';
  const extra = modifiers(state).recipeYield[id] ?? 0;
  const ownsTool = isTool && (state.inventory[r.output] > 0 || Object.values(state.equipment).includes(r.output as ToolId));
  return row(ctx, {
    spec,
    icon: art(itemIconUrl(r.output), 32),
    title: ITEMS[r.output].name,
    meta: [
      ...metaTiming(state, spec),
      h('span', null, `Tier ${r.tier}`),
      h('span', { class: n > 0 ? 'text-good' : 'text-danger' }, n > 0 ? `Can make ${fmtQty(n)}` : 'Missing materials'),
      ownsTool ? h('span', { class: 'text-cyan', text: 'Owned' }) : null,
    ],
    lock: unlocked.ok ? null : unlocked.reason,
    canStart: n > 0,
    startLabel: 'Craft',
    detail: () => [
      h('p', { class: 'tt-desc', text: ITEMS[r.output].description }),
      isTool ? h('p', { class: 'text-small text-cyan', text: `${SKILL_NAMES[TOOLS[r.output as ToolId].skill]} tool · ${TOOLS[r.output as ToolId].bonusText} · equip at level ${TOOLS[r.output as ToolId].levelRequired}` }) : null,
      extra ? h('p', { class: 'text-small text-cyan', text: `Research bonus: makes ${r.outputQty + extra} per craft` }) : null,
      h('p', { class: 'label-micro', text: 'Uses per craft' }),
      requirements(costReqs(state, r.inputs, act), 'Materials per craft'),
    ],
  });
}

function salvageRow(ctx: ScreenCtx, id: SalvageId): HTMLElement {
  const { state, act } = ctx;
  const t = SALVAGE[id];
  const spec: ActivitySpec = { kind: 'salvage', targetId: id };
  const unlocked = salvageUnlocked(state, id);
  const count = salvageCount(state, id);
  const machine = t.input ? (Object.keys(t.input)[0] as ItemId) : null;
  return row(ctx, {
    spec,
    icon: machine ? art(itemIconUrl(machine), 32) : art(skillEmblem('salvaging'), 24),
    title: t.name,
    meta: [...metaTiming(state, spec), machine ? h('span', { class: count > 0 ? 'text-good' : 'text-danger' }, count > 0 ? `${fmtQty(count)} to break down` : 'None in satchel') : h('span', { text: 'Never runs out' })],
    yields: yieldsOf(state, t.drops),
    lock: unlocked.ok ? null : unlocked.reason,
    canStart: count > 0,
    startLabel: 'Salvage',
    detail: () => [
      h('p', { class: 'tt-desc', text: t.description }),
      dropTable(state, t.drops, act),
      machine ? h('p', { class: 'text-small text-muted', text: `${ITEMS[machine].name} turns up while scavenging.` }) : null,
      modifiers(state).doubleChance > 0 ? h('p', { class: 'text-small text-cyan', text: `${Math.round(modifiers(state).doubleChance * 100)}% chance of a double yield` }) : null,
    ],
  });
}

function projectRow(ctx: ScreenCtx, id: ProjectId): HTMLElement {
  const { state, act } = ctx;
  const p = PROJECTS[id];
  const spec: ActivitySpec = { kind: 'research', projectId: id };
  const done = state.research.done.includes(id);
  const unlocked = projectUnlocked(state, id);
  const disc = p.discoveryRequired ? DISCOVERY_BY_ID[p.discoveryRequired] : undefined;
  const known = !disc || disc.id in state.discoveries;
  const affordable = (Object.entries(p.input) as [ItemId, number][]).every(([k, n]) => state.inventory[k] >= n);
  return row(ctx, {
    spec,
    icon: disc ? art(discoveryIconUrl(disc.id), 32, { silhouette: !known }) : art(itemIconUrl('waterloggedNotes'), 32),
    title: known ? p.name : 'Unknown subject',
    meta: done ? [h('span', { class: 'text-cyan', text: p.unlockText })] : [...metaTiming(state, spec), h('span', { class: affordable ? '' : 'text-danger' }, p.actions === undefined ? 'Repeatable' : affordable ? 'Ready to study' : 'Needs notes')],
    lock: done ? null : !known ? `Find it first: ${disc ? LOCATIONS[disc.location].name : ''}` : unlocked.ok ? null : unlocked.reason,
    canStart: affordable,
    startLabel: 'Study',
    progress: projectProgress(state, id),
    done,
    detail: () =>
      known
        ? [
            h('p', { class: 'tt-desc', text: p.description }),
            h('p', { class: done ? 'text-small text-cyan' : 'text-small text-brass', text: p.unlockText }),
            done ? null : h('p', { class: 'label-micro', text: 'Each study uses' }),
            done ? null : requirements(costReqs(state, p.input, act), 'Each study uses'),
            disc ? button({ label: `Read: ${disc.name}`, variant: 'ghost', size: 's', onClick: () => act.openDiscovery(disc.id) }) : null,
          ]
        : [h('p', { class: 'tt-desc', text: `Something in the ${disc ? LOCATIONS[disc.location].name : 'station'} is worth studying. Keep searching there.` })],
  });
}

export function skillLevelOf(state: GameState, skill: SkillId): number {
  return skillLevel(state, skill);
}
