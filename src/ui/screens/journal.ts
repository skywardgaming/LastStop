// Journal — the conductor's notebook. Cream ruled pages, ink, red stamps.
//
// Sections come from a registry so later chapters (the railway map,
// crew records, long-term history) slot in as new pages without another
// redesign. Everything shown is real game data; nothing is invented.

import {
  ACHIEVEMENTS,
  CATEGORY_NAMES,
  CHAPTERS,
  CHARACTERS,
  DIALOGUES,
  DISCOVERIES,
  OBJECTIVES,
  type SpeakerId,
} from '../../core/content/story';
import { LOCATIONS, PROJECT_IDS, PROJECTS, SKILL_IDS, SKILL_NAMES, TRAIN_PART_IDS } from '../../core/content/world';
import { levelProgress } from '../../core/xp';
import { h, type Child } from '../dom';
import { art, fmtQty, gauge, tabs } from '../kit';
import { discoveryIconUrl, portraitUrl } from '../sprites';
import { objectiveDone, SKILL_LABEL, SKILL_TONE, type JournalSection, type ScreenCtx } from './shared';

interface SectionDef {
  id: JournalSection;
  label: string;
  render: (ctx: ScreenCtx) => Child;
}

/** Add future notebook pages here. */
export const JOURNAL_SECTIONS: SectionDef[] = [
  { id: 'chapters', label: 'Chapters', render: chapters },
  { id: 'finds', label: 'Finds', render: finds },
  { id: 'people', label: 'People', render: people },
  { id: 'feats', label: 'Feats', render: feats },
  { id: 'records', label: 'Records', render: records },
];

export function journalScreen(ctx: ScreenCtx): HTMLElement {
  const { ui, act, state } = ctx;
  const section = JOURNAL_SECTIONS.find((s) => s.id === ui.journal) ?? JOURNAL_SECTIONS[0];
  const badges: Partial<Record<JournalSection, number>> = {
    finds: Object.keys(state.discoveries).length,
  };
  return h(
    'div',
    { class: 'screen-body journal' },
    tabs<JournalSection>(
      JOURNAL_SECTIONS.map((s) => {
        const b = badges[s.id];
        return b !== undefined ? { id: s.id, label: s.label, badge: b } : { id: s.id, label: s.label };
      }),
      ui.journal,
      (v) => act.setUi({ journal: v }),
      'Journal sections',
      'index',
    ),
    h('article', { class: 'notebook', attrs: { 'aria-label': section?.label ?? 'Journal' } }, section ? section.render(ctx) : null),
  );
}

function page(title: string, sub: string | null, ...children: Child[]): Child[] {
  return [h('header', { class: 'page-head' }, h('h2', { class: 'page-title', text: title }), sub ? h('p', { class: 'page-sub', text: sub }) : null), ...children];
}

// ---------- chapters ----------

function chapters(ctx: ScreenCtx): Child {
  const { state, act } = ctx;
  return page(
    'The Journey So Far',
    'Ashvale Station',
    ([1, 2] as const).map((ch) => {
      const list = OBJECTIVES.filter((o) => o.chapter === ch);
      const done = list.filter((o) => objectiveDone(state, o)).length;
      const current = list.find((o) => !objectiveDone(state, o));
      const locked = ch === 2 && !state.repairs.boiler && done === 0;
      return h(
        'section',
        { class: `chapter${locked ? ' is-locked' : ''}` },
        h('header', { class: 'chapter-head' }, h('h3', { class: 'chapter-title', text: CHAPTERS[ch] }), h('span', { class: 'ink-stamp', text: done === list.length ? 'Complete' : `${done} / ${list.length}` })),
        locked
          ? h('p', { class: 'ink-note', text: 'These pages open once No. 9 has steam.' })
          : h(
              'ol',
              { class: 'ledger' },
              list.map((o) => {
                const [c, t] = o.progress(state);
                const isDone = c >= t;
                const isNow = o === current;
                return h(
                  'li',
                  { class: `ledger-row${isDone ? ' is-done' : ''}${isNow ? ' is-now' : ''}` },
                  h('span', { class: 'ledger-mark', attrs: { 'aria-hidden': 'true' }, text: isDone ? '✓' : isNow ? '▸' : '' }),
                  h('span', { class: 'ledger-text' }, o.title, isNow && t > 1 ? h('span', { class: 'ledger-count num', text: ` ${c}/${t}` }) : null, isNow ? h('span', { class: 'ledger-hint', text: o.hint }) : null),
                  h('span', { class: 'sr-only', text: isDone ? 'done' : isNow ? 'current' : 'to do' }),
                );
              }),
            ),
        current && !locked ? h('button', { class: 'ink-link', text: 'Show me the next step', attrs: { type: 'button' }, on: { click: () => act.go('station') } }) : null,
      );
    }),
  );
}

// ---------- finds ----------

function finds(ctx: ScreenCtx): Child {
  const { state, act } = ctx;
  const n = Object.keys(state.discoveries).length;
  return page(
    'Discoveries',
    `${n} of ${DISCOVERIES.length} recorded`,
    h(
      'ul',
      { class: 'specimens' },
      DISCOVERIES.map((d) => {
        const has = d.id in state.discoveries;
        const study = PROJECT_IDS.find((p) => PROJECTS[p].discoveryRequired === d.id);
        const studied = study ? state.research.done.includes(study) : false;
        return h(
          'li',
          null,
          h(
            'button',
            {
              class: `specimen${has ? '' : ' is-unknown'}${d.category === 'mechanism' || d.category === 'clue' ? ' is-anomalous' : ''}`,
              attrs: { type: 'button', disabled: !has, 'aria-label': has ? `${d.name}, ${CATEGORY_NAMES[d.category]}` : `Unrecorded find, ${LOCATIONS[d.location].name}` },
              data: { key: `find:${d.id}` },
              on: { click: () => act.openDiscovery(d.id) },
            },
            h('span', { class: 'specimen-art' }, art(discoveryIconUrl(d.id), 64, { silhouette: !has })),
            h('span', { class: 'specimen-cat', text: has ? CATEGORY_NAMES[d.category] : LOCATIONS[d.location].name }),
            h('span', { class: 'specimen-name', text: has ? d.name : 'Not yet recorded' }),
            has && study ? h('span', { class: `specimen-study${studied ? ' is-done' : ''}`, text: studied ? 'Studied' : 'Can be studied' }) : null,
          ),
        );
      }),
    ),
  );
}

// ---------- people ----------

function people(ctx: ScreenCtx): Child {
  const { state, act } = ctx;
  return page(
    'People of Ashvale',
    null,
    (Object.keys(CHARACTERS) as SpeakerId[]).map((sid) => {
      const c = CHARACTERS[sid];
      const convs = DIALOGUES.filter((d) => d.speaker === sid && state.dialogues.unlocked.includes(d.id));
      const unread = convs.filter((d) => !state.dialogues.read.includes(d.id)).length;
      const met = convs.length > 0;
      return h(
        'button',
        {
          class: `person-card${met ? '' : ' is-unknown'}`,
          attrs: { type: 'button', disabled: !met, 'aria-label': met ? `${c.name}, ${convs.length} conversations${unread ? `, ${unread} new` : ''}` : 'Someone you have not met' },
          data: { key: `person:${sid}` },
          on: { click: () => act.openCharacter(sid) },
        },
        h('span', { class: 'person-frame' }, art(portraitUrl(sid), 96, { silhouette: !met })),
        h(
          'span',
          { class: 'person-text' },
          h('span', { class: 'person-name', text: met ? c.name : 'Unknown' }),
          h('span', { class: 'person-role', text: met ? c.role : 'Not yet met' }),
          met ? h('span', { class: 'person-count', text: `${convs.length} conversation${convs.length === 1 ? '' : 's'} recorded${unread ? ` · ${unread} new` : ''}` }) : null,
        ),
      );
    }),
  );
}

// ---------- feats ----------

function feats(ctx: ScreenCtx): Child {
  const { state } = ctx;
  const earned = ACHIEVEMENTS.filter((a) => a.id in state.achievements).length;
  return page(
    'Feats',
    `${earned} of ${ACHIEVEMENTS.length} earned · most grant a lasting bonus`,
    h(
      'ol',
      { class: 'ledger feats' },
      ACHIEVEMENTS.map((a) => {
        const has = a.id in state.achievements;
        return h(
          'li',
          { class: `ledger-row${has ? ' is-done' : ''}` },
          h('span', { class: 'ledger-mark', attrs: { 'aria-hidden': 'true' }, text: has ? '★' : '☆' }),
          h(
            'span',
            { class: 'ledger-text' },
            h('strong', { text: a.name }),
            h('span', { class: 'ledger-hint', text: a.description }),
            a.reward ? h('span', { class: `ledger-reward${has ? ' is-active' : ''}`, text: `${has ? 'Bonus' : 'Reward'}: ${a.reward.text}` }) : null,
          ),
          h('span', { class: 'sr-only', text: has ? 'earned' : 'not yet earned' }),
        );
      }),
    ),
  );
}

// ---------- records ----------

function records(ctx: ScreenCtx): Child {
  const { state, act } = ctx;
  const totalSearches = Object.values(state.stats.searches).reduce((x, y) => x + (y ?? 0), 0);
  const totalLevel = SKILL_IDS.reduce((s, k) => s + levelProgress(state.skills[k].xp).level, 0);
  return page(
    'Station Records',
    `Combined skill level ${totalLevel} of ${SKILL_IDS.length * 20}`,
    h(
      'div',
      { class: 'record-gauges' },
      SKILL_IDS.map((k) => {
        const p = levelProgress(state.skills[k].xp);
        return h(
          'button',
          { class: 'record-gauge', attrs: { type: 'button', 'aria-label': `${SKILL_NAMES[k]} level ${p.level}` }, on: { click: () => act.go('skills', k) } },
          gauge(p.fraction, String(p.level), SKILL_TONE[k], 56),
          h('span', { text: SKILL_LABEL[k] }),
        );
      }),
    ),
    h(
      'dl',
      { class: 'ink-table' },
      (
        [
          ['Searches made', fmtQty(totalSearches)],
          ['Parts and tools crafted', fmtQty(state.stats.crafts)],
          ['Machines salvaged', fmtQty(state.stats.salvages)],
          ['Pages studied', fmtQty(state.stats.studies)],
          ['Rare finds', fmtQty(state.stats.rareFinds)],
          ['Research projects', `${state.research.done.length} / ${PROJECT_IDS.length - 1}`],
          ['Discoveries', `${Object.keys(state.discoveries).length} / ${DISCOVERIES.length}`],
          ['Feats', `${Object.keys(state.achievements).length} / ${ACHIEVEMENTS.length}`],
          ['No. 9 restored', `${TRAIN_PART_IDS.filter((id) => state.repairs[id]).length} / ${TRAIN_PART_IDS.length}`],
          ['Arrived in Ashvale', new Date(state.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })],
        ] as const
      ).map(([k, v]) => [h('dt', { text: k }), h('dd', { class: 'num', text: v })]),
    ),
  );
}
