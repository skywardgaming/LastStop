// Train — inspect and restore Locomotive No. 9.
//
// The engine sits on an inspection pit with each component tappable over
// its real region. A synchronized selector lists every part (the five
// repairs plus the three improvements). The detail plate shows status,
// requirements and the restore action; the app confirms before spending.

import { ITEMS, type ItemId } from '../../core/content/items';
import {
  IMPROVEMENT_IDS,
  PROJECTS,
  REPAIR_IDS,
  REPAIRS,
  SKILL_IDS,
  TRAIN_PART_IDS,
  type RepairId,
  type TrainPartId,
} from '../../core/content/world';
import { modifiers, repairBlockers, skillLevel, type RepairBlocker } from '../../core/rules';
import type { GameState } from '../../core/state';
import { h } from '../dom';
import { button, requirements, stamp, type Requirement } from '../kit';
import { itemIconUrl } from '../sprites';
import { createInspector, regionPercent } from '../train-inspector';
import { seen, SKILL_LABEL, type ScreenCtx } from './shared';

type PartStatus = 'done' | 'ready' | 'blocked';

function status(state: GameState, id: TrainPartId): PartStatus {
  if (state.repairs[id]) return 'done';
  return repairBlockers(state, id).length === 0 ? 'ready' : 'blocked';
}

export function defaultPart(state: GameState): TrainPartId {
  return TRAIN_PART_IDS.find((id) => status(state, id) === 'ready') ?? TRAIN_PART_IDS.find((id) => !state.repairs[id]) ?? 'fireboxDoor';
}

export function trainScreen(ctx: ScreenCtx): HTMLElement {
  const { state, ui } = ctx;
  const selected = ui.trainPart ?? defaultPart(state);
  return h('div', { class: 'screen-body train' }, inspection(ctx, selected), restoration(state), selector(ctx, selected), detail(ctx, selected), bonuses(ctx));
}

// ---------- inspection pit ----------

function inspection(ctx: ScreenCtx, selected: TrainPartId): HTMLElement {
  const { state, act } = ctx;
  const done = REPAIR_IDS.filter((id) => state.repairs[id]).map((id) => REPAIRS[id].name);
  const view = createInspector(state.repairs, `Locomotive No. 9. Restored: ${done.length ? done.join(', ') : 'nothing yet'}.`);
  for (const id of REPAIR_IDS) {
    const r = regionPercent(id);
    const st = status(state, id);
    const isSel = id === selected;
    view.layer.append(
      h(
        'button',
        {
          class: `part-hotspot is-${st}${isSel ? ' is-selected' : ''}`,
          attrs: { type: 'button', 'aria-label': `${REPAIRS[id].name}: ${st === 'done' ? 'restored' : st === 'ready' ? 'ready to restore' : 'needs work'}`, 'aria-pressed': isSel },
          data: { key: `hot:${id}`, part: id },
          style: { left: `${r.left + r.width / 2}%`, top: `${r.top + r.height / 2}%` },
          on: { click: () => act.setUi({ trainPart: id }) },
        },
        h('span', { class: 'part-pip', attrs: { 'aria-hidden': 'true' }, text: st === 'done' ? '✓' : st === 'ready' ? '★' : '!' }),
      ),
    );
    if (isSel) {
      view.layer.append(h('span', { class: 'part-bracket', attrs: { 'aria-hidden': 'true' }, style: { left: `${r.left}%`, top: `${r.top}%`, width: `${r.width}%`, height: `${r.height}%` } }));
    }
  }
  return h('section', { class: 'pit', attrs: { 'aria-label': 'Inspect Locomotive No. 9' } }, h('div', { class: 'pit-plate' }, h('span', { class: 'label-micro', text: 'Locomotive' }), h('span', { class: 'pit-number', text: 'No. 9' })), view.root, h('p', { class: 'pit-hint', text: 'Tap a part of the engine to inspect it.' }));
}

function restoration(state: GameState): HTMLElement {
  const total = TRAIN_PART_IDS.length;
  const done = TRAIN_PART_IDS.filter((id) => state.repairs[id]).length;
  return h(
    'section',
    { class: 'restoration', attrs: { 'aria-label': `Restoration ${done} of ${total}` } },
    h('div', { class: 'restoration-head' }, h('span', { class: 'label-section', text: 'Restoration' }), h('span', { class: 'restoration-count num' }, h('strong', { text: String(done) }), ` / ${total}`)),
    h(
      'ol',
      { class: 'restoration-track', attrs: { 'aria-hidden': 'true' } },
      TRAIN_PART_IDS.map((id) => h('li', { class: `seg is-${status(state, id)} kind-${REPAIRS[id].kind}` })),
    ),
  );
}

// ---------- selector ----------

function selector(ctx: ScreenCtx, selected: TrainPartId): HTMLElement {
  const { state, act } = ctx;
  const chip = (id: TrainPartId): HTMLElement => {
    const st = status(state, id);
    return h(
      'button',
      {
        class: `part-chip is-${st}${id === selected ? ' is-selected' : ''}`,
        attrs: { type: 'button', 'aria-pressed': id === selected },
        data: { key: `chip:${id}` },
        on: { click: () => act.setUi({ trainPart: id }) },
      },
      h('span', { class: 'part-chip-dot', attrs: { 'aria-hidden': 'true' } }),
      h('span', { text: REPAIRS[id].name }),
      h('span', { class: 'sr-only', text: st === 'done' ? ' (restored)' : st === 'ready' ? ' (ready)' : '' }),
    );
  };
  return h(
    'div',
    { class: 'part-selector', data: { key: 'part-selector', scrollx: '1' } },
    h('div', { class: 'part-group' }, h('span', { class: 'label-micro', text: 'Repairs' }), h('div', { class: 'part-chips' }, REPAIR_IDS.map(chip))),
    h('div', { class: 'part-group' }, h('span', { class: 'label-micro', text: 'Improvements' }), h('div', { class: 'part-chips' }, IMPROVEMENT_IDS.map(chip))),
  );
}

// ---------- detail ----------

const BLOCK_TEXT: Record<RepairBlocker, string> = {
  alreadyRepaired: 'Restored',
  needsPart: 'Needs an earlier repair',
  needsResearch: 'Needs research',
  levelTooLow: 'Engineering level too low',
  missingResources: 'Gather the parts',
};

function detail(ctx: ScreenCtx, id: TrainPartId): HTMLElement {
  const { state, act } = ctx;
  const r = REPAIRS[id];
  const st = status(state, id);
  const blockers = repairBlockers(state, id);
  const reqs: Requirement[] = [];
  if (st !== 'done') {
    for (const p of r.requires ?? []) reqs.push({ label: `${REPAIRS[p].name} restored`, have: 0, need: 1, flag: state.repairs[p], onClick: () => act.setUi({ trainPart: p }) });
    if (r.research) reqs.push({ label: `Research: ${PROJECTS[r.research].name}`, have: 0, need: 1, flag: state.research.done.includes(r.research), onClick: () => act.go('skills', 'research') });
    reqs.push({ label: 'Engineering level', have: skillLevel(state, 'engineering'), need: r.levelRequired, onClick: () => act.go('skills', 'engineering') });
    for (const [item, need] of Object.entries(r.cost) as [ItemId, number][]) {
      reqs.push({ label: seen(state, item) ? ITEMS[item].name : '???', icon: itemIconUrl(item), unknown: !seen(state, item), have: state.inventory[item], need, onClick: () => act.openItem(item) });
    }
  }
  const firstBlock = blockers.find((b) => b !== 'alreadyRepaired');
  const verb = r.kind === 'repair' ? 'Restore' : 'Fit';
  return h(
    'section',
    { class: `plate part-detail is-${st}`, attrs: { 'aria-live': 'polite', 'aria-label': `${r.name} details` } },
    h(
      'div',
      { class: 'part-detail-head' },
      h('div', null, h('p', { class: 'label-micro', text: r.kind === 'repair' ? 'Component' : 'Improvement' }), h('h2', { class: 'label-heading', text: r.name })),
      st === 'done' ? stamp(r.kind === 'repair' ? 'Restored' : 'Fitted', 'cyan') : st === 'ready' ? stamp('Ready', 'amber') : stamp(firstBlock ? BLOCK_TEXT[firstBlock] : 'Locked', 'rust'),
    ),
    h('p', { class: 'text-story part-desc', text: st === 'done' ? r.doneText : r.description }),
    h('p', { class: `part-benefit${st === 'done' ? ' is-active' : ''}` }, h('span', { class: 'label-micro', text: st === 'done' ? 'Active bonus' : 'When restored' }), h('span', { text: r.benefit })),
    r.kind === 'improvement' ? h('p', { class: 'text-small text-muted', text: 'Improvements show in the station scene rather than on the engine’s plates.' }) : null,
    st !== 'done' ? requirements(reqs, `${r.name} requirements`) : null,
    st !== 'done'
      ? button({
          label: st === 'ready' ? `${verb} the ${r.name}` : firstBlock ? BLOCK_TEXT[firstBlock] : 'Locked',
          variant: 'repair',
          block: true,
          disabled: st !== 'ready',
          key: `repair:${id}`,
          onClick: () => act.requestRepair(id),
        })
      : null,
  );
}

function bonuses(ctx: ScreenCtx): HTMLElement {
  const { state, ui, act } = ctx;
  const m = modifiers(state);
  const lines = [
    ...SKILL_IDS.filter((k) => m.speed[k] > 0.001).map((k) => `${SKILL_LABEL[k]} +${Math.round(m.speed[k] * 100)}% speed`),
    m.rareChance > 1.001 ? `Rare finds ×${m.rareChance.toFixed(2)}` : null,
    m.xp > 1.001 ? `All XP +${Math.round((m.xp - 1) * 100)}%` : null,
    m.doubleChance > 0 ? `Double salvage ${Math.round(m.doubleChance * 100)}%` : null,
  ].filter((x): x is string => x !== null);
  const open = !!ui.open['bonuses'];
  return h(
    'section',
    { class: 'group' },
    h('button', { class: 'expander', text: `Your bonuses · ${lines.length}`, attrs: { type: 'button', 'aria-expanded': open }, data: { key: 'bonuses' }, on: { click: () => act.toggle('bonuses') } }),
    open
      ? lines.length
        ? h('ul', { class: 'bonus-lines' }, lines.map((l) => h('li', { text: l })))
        : h('p', { class: 'text-small text-muted', text: 'Repairs, research, tools and feats add bonuses here.' })
      : null,
    h('p', { class: 'sr-only', text: 'Totals include repairs, research, equipped tools and feats.' }),
  );
}

export type { RepairId };
