// Satchel — a slot grid of everything you carry, using the original icons
// in Astra's rarity frames. Tap a slot for the full item sheet.

import { ITEM_IDS, ITEMS, RARITY_ORDER, type ItemId } from '../../core/content/items';
import { SKILL_IDS, TOOLS, type ToolId } from '../../core/content/world';
import { h } from '../dom';
import { art, button, emptyState, fmtQty, tabs } from '../kit';
import { artUrl } from '../art';
import { itemIconUrl } from '../sprites';
import { inventoryKinds, seen, skillEmblem, SKILL_LABEL, type SatchelFilter, type SatchelSort, type ScreenCtx } from './shared';

const FILTER_LABEL: Record<SatchelFilter, string> = { all: 'All', material: 'Materials', component: 'Parts', machinery: 'Machines', tool: 'Tools' };

export function satchelScreen(ctx: ScreenCtx): HTMLElement {
  const { state, ui, act } = ctx;
  const counts = inventoryKinds(state.inventory);
  let ids = ITEM_IDS.filter((id) => state.inventory[id] > 0);
  if (ui.satchelFilter !== 'all') ids = ids.filter((id) => ITEMS[id].kind === ui.satchelFilter);
  ids = [...ids].sort((a, b) => {
    if (ui.satchelSort === 'name') return ITEMS[a].name.localeCompare(ITEMS[b].name);
    if (ui.satchelSort === 'qty') return state.inventory[b] - state.inventory[a];
    return RARITY_ORDER[ITEMS[b].rarity] - RARITY_ORDER[ITEMS[a].rarity] || ITEMS[a].name.localeCompare(ITEMS[b].name);
  });
  const found = ITEM_IDS.filter((id) => seen(state, id)).length;

  return h(
    'div',
    { class: 'screen-body satchel' },
    h(
      'header',
      { class: 'satchel-head' },
      h('div', null, h('p', { class: 'label-micro', text: 'Carried' }), h('p', { class: 'satchel-count' }, h('strong', { class: 'num', text: String(counts.all) }), ' kinds of item')),
      h('p', { class: 'satchel-found text-small text-muted' }, h('span', { class: 'num', text: `${found}/${ITEM_IDS.length}` }), ' ever found'),
    ),
    tabs<SatchelFilter>(
      (Object.keys(FILTER_LABEL) as SatchelFilter[]).map((f) => ({ id: f, label: FILTER_LABEL[f], badge: counts[f] })),
      ui.satchelFilter,
      (v) => act.setUi({ satchelFilter: v }),
      'Item category',
    ),
    h(
      'div',
      { class: 'sort-row' },
      h('span', { class: 'label-micro', text: 'Sort' }),
      tabs<SatchelSort>(
        [
          { id: 'rarity', label: 'Rarity' },
          { id: 'name', label: 'Name' },
          { id: 'qty', label: 'Amount' },
        ],
        ui.satchelSort,
        (v) => act.setUi({ satchelSort: v }),
        'Sort items',
        'pill',
        'sort',
      ),
    ),
    ui.satchelFilter === 'tool' || ui.satchelFilter === 'all' ? equippedStrip(ctx) : null,
    ids.length === 0
      ? emptyState({
          icon: art(artUrl('items/satchel.png'), 64),
          title: ui.satchelFilter === 'all' ? 'An empty satchel' : `No ${FILTER_LABEL[ui.satchelFilter].toLowerCase()} yet`,
          text: emptyText(ui.satchelFilter),
          action: button({ label: ui.satchelFilter === 'component' || ui.satchelFilter === 'tool' ? 'Open the workbench' : 'Go scavenging', variant: 'secondary', size: 's', onClick: () => act.go('skills', ui.satchelFilter === 'component' || ui.satchelFilter === 'tool' ? 'engineering' : 'scavenging') }),
        })
      : h(
          'ul',
          { class: 'slot-grid', attrs: { 'aria-label': `${FILTER_LABEL[ui.satchelFilter]} items` } },
          ids.map((id) =>
            h(
              'li',
              null,
              h(
                'button',
                {
                  class: `slot rarity-${ITEMS[id].rarity}`,
                  attrs: { type: 'button', 'aria-label': `${ITEMS[id].name}, ${state.inventory[id].toLocaleString()}, ${ITEMS[id].rarity}` },
                  data: { key: `slot:${id}`, slot: id },
                  on: { click: () => act.openItem(id) },
                },
                art(itemIconUrl(id), 64),
                h('span', { class: 'slot-qty num', text: fmtQty(state.inventory[id]) }),
                h('span', { class: 'slot-name', text: ITEMS[id].name }),
              ),
            ),
          ),
        ),
  );
}

function equippedStrip(ctx: ScreenCtx): HTMLElement {
  const { state, act } = ctx;
  return h(
    'section',
    { class: 'equipped', attrs: { 'aria-label': 'Equipped tools' } },
    h('p', { class: 'label-section', text: 'Equipped' }),
    h(
      'ul',
      { class: 'equipped-row' },
      SKILL_IDS.map((k) => {
        const t: ToolId | null = state.equipment[k];
        return h(
          'li',
          null,
          h(
            'button',
            {
              class: `equip-slot${t ? ' is-filled' : ''}`,
              attrs: { type: 'button', 'aria-label': `${SKILL_LABEL[k]} tool: ${t ? ITEMS[t].name : 'empty'}` },
              data: { key: `equip:${k}` },
              on: { click: () => (t ? act.openItem(t) : act.openTools(k)) },
            },
            t ? art(itemIconUrl(t), 32) : art(skillEmblem(k), 24, { cls: 'equip-ghost' }),
            h('span', { class: 'equip-skill', text: SKILL_LABEL[k] }),
            h('span', { class: 'equip-name', text: t ? `T${TOOLS[t].tier}` : 'Empty' }),
          ),
        );
      }),
    ),
  );
}

function emptyText(f: SatchelFilter): string {
  switch (f) {
    case 'all':
      return 'Search the platform and whatever you find will come back here.';
    case 'material':
      return 'Scavenging and salvaging both bring in materials.';
    case 'component':
      return 'Engineering turns materials into parts for No. 9.';
    case 'machinery':
      return 'Lanterns, telegraphs, pumps and dynamos turn up while scavenging. Salvage them for parts.';
    case 'tool':
      return 'Spare tools appear here. Equipped tools live in each skill’s tool slot.';
  }
}

export type { ItemId };
