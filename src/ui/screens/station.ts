// Station — the home screen. The scene above is the star; this column holds
// only what helps you act: the current objective, who wants to talk, what
// is ready on the engine, your skills at a glance, and what you just earned.

import { ITEMS } from '../../core/content/items';
import { CHAPTERS, CHARACTERS, DIALOGUE_BY_ID, DIALOGUES, OBJECTIVES, type SpeakerId } from '../../core/content/story';
import { REPAIRS, SKILL_IDS, TRAIN_PART_IDS } from '../../core/content/world';
import { unreadDialogues } from '../../core/game';
import { repairBlockers } from '../../core/rules';
import { levelProgress } from '../../core/xp';
import { h } from '../dom';
import { art, button, emptyState, fmtQty, gauge, group, progress, rewardChips } from '../kit';
import { itemIconUrl, portraitUrl } from '../sprites';
import { aggregate, objectiveDone, objectiveStatus, OBJECTIVE_ROUTES, SKILL_LABEL, SKILL_TONE, type ScreenCtx } from './shared';

export function stationScreen(ctx: ScreenCtx): HTMLElement {
  return h('div', { class: 'screen-body station' }, objectiveTracker(ctx), platform(ctx), readyCallout(ctx), skillGauges(ctx), recentRewards(ctx));
}

// ---------- objective tracker ----------

function objectiveTracker(ctx: ScreenCtx): HTMLElement {
  const { state, ui, act } = ctx;
  const obj = objectiveStatus(state);
  const o = obj.current;
  if (!o) {
    return h(
      'section',
      { class: 'tracker is-complete', attrs: { 'aria-label': 'Objectives' } },
      h('p', { class: 'tracker-kicker', text: 'Every objective complete' }),
      h('h2', { class: 'tracker-title', text: 'Something down the line is answering.' }),
      h('p', { class: 'tracker-hint', text: 'Ashvale’s work is done. Keep levelling and filling the journal — the next station is coming.' }),
    );
  }
  const [c, t] = o.progress(state);
  const chapter = OBJECTIVES.filter((x) => x.chapter === o.chapter);
  const doneInChapter = chapter.filter((x) => objectiveDone(state, x)).length;
  const route = OBJECTIVE_ROUTES[o.id] ?? ['station'];
  const open = !!ui.open['tracker'];
  const upcoming = chapter.filter((x) => !objectiveDone(state, x) && x.id !== o.id).slice(0, 3);
  return h(
    'section',
    { class: `tracker${open ? ' is-open' : ''}`, attrs: { 'aria-label': 'Current objective' } },
    h(
      'div',
      { class: 'tracker-row' },
      h(
        'div',
        { class: 'tracker-main' },
        h('p', { class: 'tracker-kicker' }, CHAPTERS[o.chapter], h('span', { class: 'num', text: ` · ${doneInChapter}/${chapter.length}` })),
        h('h2', { class: 'tracker-title', text: o.title }),
        t > 1 ? h('div', { class: 'tracker-progress' }, progress(c / t, 'amber', { thin: true, label: `${c} of ${t}` }), h('span', { class: 'num', text: `${c}/${t}` })) : null,
      ),
      button({ label: 'Go', variant: 'primary', size: 's', key: 'tracker-go', ariaLabel: `Go to: ${o.title}`, onClick: () => act.go(route[0], route[1]) }),
    ),
    h('button', { class: 'expander', text: open ? 'Hide details' : 'Details', attrs: { type: 'button', 'aria-expanded': open }, data: { key: 'tracker-more' }, on: { click: () => act.toggle('tracker') } }),
    open
      ? h(
          'div',
          { class: 'tracker-detail' },
          h('p', { class: 'tracker-hint', text: o.hint }),
          upcoming.length
            ? h(
                'div',
                null,
                h('p', { class: 'label-micro', text: 'After this' }),
                h('ol', { class: 'tracker-next' }, upcoming.map((u) => h('li', { text: u.title }))),
              )
            : null,
          button({ label: 'All objectives', variant: 'ghost', size: 's', onClick: () => act.go('journal', 'chapters') }),
        )
      : null,
  );
}

// ---------- characters on the platform ----------

function platform(ctx: ScreenCtx): HTMLElement | null {
  const { state, act } = ctx;
  const unread = unreadDialogues(state);
  const met = (Object.keys(CHARACTERS) as SpeakerId[]).filter((sid) => DIALOGUES.some((d) => d.speaker === sid && state.dialogues.unlocked.includes(d.id)));
  if (met.length === 0) return null;
  return group(
    'On the platform',
    null,
    h(
      'div',
      { class: 'medallions' },
      met.map((sid) => {
        const c = CHARACTERS[sid];
        const news = unread.filter((id) => DIALOGUE_BY_ID[id]?.speaker === sid).length;
        return h(
          'button',
          {
            class: `medallion${news ? ' has-news' : ''}`,
            attrs: { type: 'button', 'aria-label': `${c.name}, ${c.role}${news ? `, ${news} new conversation${news > 1 ? 's' : ''}` : ''}` },
            data: { key: `npc:${sid}` },
            on: { click: () => act.openCharacter(sid) },
          },
          h('span', { class: 'medallion-ring' }, art(portraitUrl(sid, news ? 'concerned' : 'neutral'), 64)),
          news ? h('span', { class: 'medallion-badge', text: String(news) }) : null,
          h('span', { class: 'medallion-name', text: c.name.split(' ')[0] ?? c.name }),
          h('span', { class: 'medallion-role', text: news ? 'Wants a word' : c.role }),
        );
      }),
    ),
  );
}

// ---------- ready repairs ----------

function readyCallout(ctx: ScreenCtx): HTMLElement | null {
  const { state, act } = ctx;
  const ready = TRAIN_PART_IDS.filter((id) => repairBlockers(state, id).length === 0);
  if (ready.length === 0) return null;
  const first = ready[0];
  if (!first) return null;
  return h(
    'button',
    { class: 'callout', attrs: { type: 'button' }, data: { key: 'ready-callout' }, on: { click: () => act.go('train', first) } },
    h('span', { class: 'callout-lamp', attrs: { 'aria-hidden': 'true' } }),
    h(
      'span',
      { class: 'callout-text' },
      h('span', { class: 'label-micro text-brass', text: ready.length > 1 ? `${ready.length} ready on No. 9` : 'Ready on No. 9' }),
      h('strong', { text: `${REPAIRS[first].kind === 'repair' ? 'Restore' : 'Fit'} the ${REPAIRS[first].name}` }),
    ),
    h('span', { class: 'callout-chev', attrs: { 'aria-hidden': 'true' } }),
  );
}

// ---------- skills at a glance ----------

function skillGauges(ctx: ScreenCtx): HTMLElement {
  const { state, act } = ctx;
  const training = state.activity?.kind;
  const kindSkill = { scavenge: 'scavenging', craft: 'engineering', salvage: 'salvaging', research: 'research' } as const;
  const active = training ? kindSkill[training] : null;
  return group(
    'Skills',
    button({ label: 'Train', variant: 'ghost', size: 's', onClick: () => act.go('skills') }),
    h(
      'div',
      { class: 'gauge-strip' },
      SKILL_IDS.map((k) => {
        const p = levelProgress(state.skills[k].xp);
        return h(
          'button',
          {
            class: `gauge-btn${active === k ? ' is-training' : ''}`,
            attrs: { type: 'button', 'aria-label': `${SKILL_LABEL[k]} level ${p.level}${active === k ? ', training' : ''}` },
            data: { key: `gauge:${k}` },
            on: { click: () => act.go('skills', k) },
          },
          gauge(p.fraction, String(p.level), SKILL_TONE[k], 56),
          h('span', { class: 'gauge-label', text: SKILL_LABEL[k] }),
        );
      }),
    ),
  );
}

// ---------- recent rewards ----------

function recentRewards(ctx: ScreenCtx): HTMLElement {
  const { history, act } = ctx;
  const recent = history.slice(0, 12);
  const agg = aggregate(recent);
  return group(
    'Recent rewards',
    history.length ? button({ label: 'History', variant: 'ghost', size: 's', onClick: () => act.openHistory() }) : null,
    agg.items.length
      ? h(
          'div',
          { class: 'rewards-card' },
          rewardChips(
            agg.items.map(([id, n]) => ({ icon: itemIconUrl(id), label: ITEMS[id].name, qty: n, rarity: ITEMS[id].rarity })),
            8,
          ),
          h('p', { class: 'text-small text-muted', text: `${fmtQty(agg.actions)} actions this session${Object.entries(agg.xp).length ? ` · ${Object.entries(agg.xp).map(([k, v]) => `+${fmtQty(v ?? 0)} ${SKILL_LABEL[k as keyof typeof SKILL_LABEL]} XP`).join(' · ')}` : ''}` }),
        )
      : emptyState({ title: 'Nothing yet tonight', text: 'Start an activity and what you find will gather here.', action: button({ label: 'Choose an activity', variant: 'secondary', size: 's', onClick: () => act.go('skills') }) }),
  );
}
