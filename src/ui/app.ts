// The interface controller. It owns timers, saving, the DOM shell and
// feedback. Every rule lives in src/core; this file calls it and presents
// the results. Screens are pure functions of (state, ui) in ./screens.

import { ITEMS, ITEM_IDS, type ItemId } from '../core/content/items';
import {
  ACHIEVEMENTS,
  CATEGORY_NAMES,
  CHARACTERS,
  DIALOGUE_BY_ID,
  DIALOGUES,
  DISCOVERY_BY_ID,
  type DialogueDef,
  type SpeakerId,
} from '../core/content/story';
import { LOCATIONS, PROJECTS, REPAIRS, SKILL_NAMES, TOOLS, TRAIN_PART_IDS, isTool, type SkillId, type ToolId, type TrainPartId } from '../core/content/world';
import { actionProgress } from '../core/activity';
import {
  autoEquip,
  completeOnboarding,
  equipTool,
  markDialogueRead,
  performRepair,
  startActivity,
  stopActivity,
  tick,
  unequipTool,
  unreadDialogues,
  type TickResult,
} from '../core/game';
import { newSeed } from '../core/rng';
import { activitySkill, actionDuration, ownedTools, repairBlockers, skillLevel, toolAccess, type ActivitySpec } from '../core/rules';
import { deserialize, serialize } from '../core/save';
import { createInitialState, type GameState } from '../core/state';
import { backupCorruptSave, clearSave, readSave, writeSave } from '../platform/storage';
import { artUrl, MARKER_ART, NAV_ART } from './art';
import { byId, formatDuration, h, type Child } from './dom';
import { art, button, fmtAgo, fmtQty, fmtSeconds, rewardChips, stamp } from './kit';
import { HOTSPOTS, StationScene, type FigureSpot, type HotspotId, type SceneState } from './scene';
import { journalScreen } from './screens/journal';
import { satchelScreen } from './screens/satchel';
import {
  activityVerb,
  itemSources,
  itemUses,
  objectiveStatus,
  seen,
  skillEmblem,
  skillMilestones,
  SKILL_LABEL,
  type Actions,
  type ItemLink,
  type JournalSection,
  type RewardEvent,
  type ScreenCtx,
  type Tab,
  type UiState,
} from './screens/shared';
import { skillsScreen } from './screens/skills';
import { stationScreen } from './screens/station';
import { defaultPart, trainScreen } from './screens/train';
import { discoveryIconUrl, itemIconUrl, portraitUrl, tabIconUrl } from './sprites';

const VERSION = '0.4';
const TICK_MS = 250;
const AUTOSAVE_MS = 15_000;
const AWAY_THRESHOLD_MS = 60_000;
const HISTORY_MAX = 60;
const NOTICE_MAX = 2;
const TABS: [Tab, string][] = [
  ['station', 'Station'],
  ['skills', 'Skills'],
  ['train', 'Train'],
  ['satchel', 'Satchel'],
  ['journal', 'Journal'],
];
const TAB_TITLE: Record<Tab, string> = { station: 'Ashvale', skills: 'Skills', train: 'No. 9', satchel: 'Satchel', journal: 'Journal' };

type NoticeKind = 'rare' | 'discovery' | 'research' | 'achievement' | 'talk' | 'warn' | 'info' | 'tool';

interface Notice {
  kind: NoticeKind;
  kicker: string;
  body: string;
  icon?: string;
  round?: boolean;
  onTap?: () => void;
}

export class App {
  private state: GameState;
  private ui: UiState = {
    tab: 'station',
    skill: 'scavenging',
    recipeCat: 'parts',
    journal: 'chapters',
    satchelFilter: 'all',
    satchelSort: 'rarity',
    trainPart: null,
    open: {},
  };
  private history: RewardEvent[] = [];
  private dirty = true;
  private lastRenderedTab: Tab | null = null;
  private lastStop: string | null = null;
  private readonly scene: StationScene;
  private rareAt = 0;
  private readonly actions: Actions;
  private notices: Notice[] = [];
  private noticesShown = 0;
  private drawerOpener: HTMLElement | null = null;
  private drawerOnClose: (() => void) | null = null;
  private readonly desktop = window.matchMedia('(min-width: 1024px)');
  /** The part just restored and when, so the stamp survives screen rebuilds. */
  private celebrate: { id: TrainPartId; at: number } | null = null;
  private static readonly CELEBRATE_MS = 2400;

  constructor() {
    this.scene = new StationScene(byId<HTMLCanvasElement>('scene'));
    this.actions = this.makeActions();
    const { state, notice } = this.load();
    this.state = state;
    this.buildChrome();
    this.bindGlobal();

    // Catch up on time away, then save at once so it can't be credited twice.
    const result = tick(this.state, Date.now());
    this.state = result.state;
    if (result.elapsedMs >= AWAY_THRESHOLD_MS && result.actions > 0) {
      this.state = { ...this.state, stats: { ...this.state.stats, longestAwayMs: Math.max(this.state.stats.longestAwayMs, result.elapsedMs) } };
      this.showAway(result);
    } else {
      this.absorb(result, false);
    }
    this.save();
    if (notice) this.notify({ kind: 'info', kicker: 'Save', body: notice });

    this.render();
    if (!this.state.onboarded) this.showOnboarding();

    window.setInterval(() => this.onTick(), TICK_MS);
    window.setInterval(() => this.save(), AUTOSAVE_MS);
    requestAnimationFrame((t) => this.frame(t));
  }

  // ====================================================================
  // persistence
  // ====================================================================

  private load(): { state: GameState; notice: string | null } {
    const now = Date.now();
    const raw = readSave();
    const loaded = deserialize(raw, now, newSeed());
    if (loaded.status === 'ok') return { state: loaded.state, notice: loaded.migratedFrom ? `Your save was carried over to Ashvale ${VERSION}.` : null };
    if (loaded.status === 'corrupt' && raw) {
      backupCorruptSave(raw);
      return { state: createInitialState(now, newSeed()), notice: 'Your save could not be read. A copy was kept; starting fresh.' };
    }
    return { state: createInitialState(now, newSeed()), notice: null };
  }

  private save(): void {
    const ok = writeSave(serialize(this.state, Date.now()));
    const pip = byId('save-status');
    pip.classList.toggle('is-saved', ok);
    pip.classList.toggle('is-failed', !ok);
    pip.setAttribute('aria-label', ok ? 'Progress saved' : 'Saving failed');
  }

  private settleAndSave(): void {
    this.absorb(tick(this.state, Date.now()), true);
    this.save();
  }

  // ====================================================================
  // game loop
  // ====================================================================

  private onTick(): void {
    const result = tick(this.state, Date.now());
    if (result.elapsedMs >= AWAY_THRESHOLD_MS && result.actions > 0) {
      this.state = result.state;
      this.showAway(result);
      this.save();
      this.dirty = true;
      return;
    }
    this.absorb(result, true);
  }

  /** Turns a tick result into state, history and feedback. */
  private absorb(r: TickResult, feedback: boolean): void {
    this.state = r.state;
    if (r.actions > 0 && r.skill) {
      const items = ITEM_IDS.filter((id) => r.itemsGained[id] > 0).map((id) => [id, r.itemsGained[id]] as [ItemId, number]);
      this.history = [{ at: Date.now(), skill: r.skill, xp: r.xpGained, actions: r.actions, items }, ...this.history].slice(0, HISTORY_MAX);
      if (feedback && items.length) this.dockGain(items);
      this.dirty = true;
    }
    // New tools go straight into an empty or weaker slot.
    const newTools = ITEM_IDS.filter((id): id is ToolId => isTool(id) && r.itemsGained[id] > 0);
    if (newTools.length > 0) {
      const eq = autoEquip(this.state, newTools, Date.now());
      this.state = eq.state;
      for (const t of eq.equipped) if (feedback) this.notify({ kind: 'tool', kicker: 'Tool equipped', body: `${ITEMS[t].name} · ${TOOLS[t].bonusText}`, icon: itemIconUrl(t) });
      this.dirty = true;
    }
    if (r.stopped) {
      this.lastStop = r.stopped === 'completed' ? 'Research finished' : r.skill === 'research' ? 'Out of notes' : r.skill === 'salvaging' ? 'Nothing left to salvage' : 'Out of materials';
      this.dirty = true;
    }
    if (!feedback) return;
    if (r.rareFinds.length > 0) this.rareAt = performance.now();
    for (const id of [...new Set(r.rareFinds)]) this.notify({ kind: 'rare', kicker: 'Rare find', body: ITEMS[id].name, icon: itemIconUrl(id), onTap: () => this.openItem(id) });
    for (const id of r.discoveries) {
      const d = DISCOVERY_BY_ID[id];
      if (d) this.notify({ kind: 'discovery', kicker: 'New discovery', body: d.name, icon: discoveryIconUrl(id), onTap: () => this.openDiscovery(id) });
    }
    if (r.completedProject) {
      const p = PROJECTS[r.completedProject];
      this.notify({ kind: 'research', kicker: 'Research finished', body: p.unlockText, ...(p.discoveryRequired ? { icon: discoveryIconUrl(p.discoveryRequired) } : {}) });
      this.flashScene();
    }
    if (r.levelUp) this.levelUp(r.levelUp.skill, r.levelUp.to);
    for (const id of r.achievements) {
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (a) this.notify({ kind: 'achievement', kicker: 'Feat earned', body: a.reward ? `${a.name} · ${a.reward.text}` : a.name, onTap: () => this.go('journal', 'feats') });
    }
    for (const id of r.dialogues) {
      const d = DIALOGUE_BY_ID[id];
      if (d && id !== 'maraIntro') this.notify({ kind: 'talk', kicker: `${CHARACTERS[d.speaker].name} wants a word`, body: d.title, icon: portraitUrl(d.speaker, 'concerned'), round: true, onTap: () => this.openCharacter(d.speaker, id) });
    }
    if (r.stopped === 'outOfMaterials') this.notify({ kind: 'warn', kicker: this.lastStop ?? 'Stopped', body: r.skill === 'research' ? 'Scavenge for more Waterlogged Notes.' : 'Gather more, then start again.' });
  }

  private frame(t: number): void {
    const p = actionProgress(this.state, Date.now());
    const s = `scaleX(${p.toFixed(4)})`;
    for (const el of document.querySelectorAll<HTMLElement>('[data-live="activity"]')) el.style.transform = s;
    if (this.dirty) this.render();
    // The scene only draws while it's on screen.
    if (this.desktop.matches || this.ui.tab === 'station') this.scene.draw(this.sceneState(), t);
    requestAnimationFrame((n) => this.frame(n));
  }

  // ====================================================================
  // actions
  // ====================================================================

  private makeActions(): Actions {
    return {
      start: (spec: ActivitySpec) => this.start(spec),
      stop: () => this.stop(),
      requestRepair: (id: TrainPartId) => this.confirmRepair(id),
      equip: (id: ToolId) => this.equip(id),
      unequip: (skill: SkillId) => this.unequip(skill),
      openTools: (skill: SkillId) => this.openTools(skill),
      openItem: (id: ItemId) => this.openItem(id),
      openDiscovery: (id: string) => this.openDiscovery(id),
      openCharacter: (id: SpeakerId) => this.openCharacter(id),
      openDialogue: (id: string) => {
        const d = DIALOGUE_BY_ID[id];
        if (d) this.openCharacter(d.speaker, id);
      },
      openHistory: () => this.openHistory(),
      go: (tab: Tab, sub?: string) => this.go(tab, sub),
      setUi: (patch: Partial<UiState>) => {
        this.ui = { ...this.ui, ...patch };
        this.dirty = true;
      },
      toggle: (key: string) => {
        this.ui = { ...this.ui, open: { ...this.ui.open, [key]: !this.ui.open[key] } };
        this.dirty = true;
      },
    };
  }

  private go(tab: Tab, sub?: string): void {
    const patch: Partial<UiState> = { tab };
    if (sub && tab === 'skills' && sub in SKILL_NAMES) patch.skill = sub as SkillId;
    if (sub && tab === 'journal') patch.journal = sub as JournalSection;
    if (sub && tab === 'train' && (TRAIN_PART_IDS as readonly string[]).includes(sub)) patch.trainPart = sub as TrainPartId;
    if (tab === 'train' && !sub) patch.trainPart = this.ui.trainPart ?? defaultPart(this.state);
    const changed = tab !== this.ui.tab;
    this.ui = { ...this.ui, ...patch };
    this.closeDrawer(false);
    this.render();
    if (changed) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      byId('screen').focus({ preventScroll: true });
    }
  }

  private start(spec: ActivitySpec): void {
    const r = startActivity(this.state, spec, Date.now());
    this.absorb(r.tick, true);
    if (r.ok) {
      this.state = r.tick.state;
      this.lastStop = null;
    } else {
      this.notify({ kind: 'warn', kicker: 'Not yet', body: r.reason });
    }
    this.save();
    this.dirty = true;
  }

  private stop(): void {
    this.absorb(stopActivity(this.state, Date.now()), true);
    this.state = { ...this.state, activity: null };
    this.lastStop = 'Stopped';
    this.save();
    this.dirty = true;
  }

  private equip(id: ToolId): void {
    const r = equipTool(this.state, id, Date.now());
    this.absorb(r.settled, true);
    this.state = r.state;
    if (r.ok) this.notify({ kind: 'tool', kicker: 'Tool equipped', body: `${ITEMS[id].name} · ${TOOLS[id].bonusText}`, icon: itemIconUrl(id) });
    else this.notify({ kind: 'warn', kicker: 'Can’t equip', body: r.reason });
    this.save();
    this.closeDrawer();
    this.dirty = true;
  }

  private unequip(skill: SkillId): void {
    const r = unequipTool(this.state, skill, Date.now());
    this.absorb(r.settled, true);
    this.state = r.state;
    this.save();
    this.closeDrawer();
    this.dirty = true;
  }

  private doRepair(id: TrainPartId): void {
    const r = performRepair(this.state, id, Date.now());
    this.absorb(r.settled, true);
    this.state = r.state;
    if (r.ok) {
      const def = REPAIRS[id];
      this.notify({ kind: 'achievement', kicker: `${def.name} ${def.kind === 'repair' ? 'restored' : 'fitted'}`, body: def.benefit });
      for (const a of r.progression.achievements) {
        const ach = ACHIEVEMENTS.find((x) => x.id === a);
        if (ach) this.notify({ kind: 'achievement', kicker: 'Feat earned', body: ach.reward ? `${ach.name} · ${ach.reward.text}` : ach.name });
      }
      this.celebrate = { id, at: performance.now() };
      this.flashScene();
      const beat = r.progression.dialogues[0];
      if (beat) {
        const d = DIALOGUE_BY_ID[beat];
        if (d) window.setTimeout(() => this.openCharacter(d.speaker, beat), 1400);
      }
    } else {
      this.notify({ kind: 'warn', kicker: 'Not yet', body: 'Something changed — check the requirements.' });
    }
    this.save();
    this.dirty = true;
  }

  // ====================================================================
  // rendering
  // ====================================================================

  private ctx(): ScreenCtx {
    return { state: this.state, ui: this.ui, act: this.actions, history: this.history };
  }

  private render(): void {
    this.dirty = false;
    const screen = byId('screen');
    // Remember focus and horizontal scroll by key so rebuilding is invisible.
    const active = document.activeElement instanceof HTMLElement ? document.activeElement.closest<HTMLElement>('[data-key]') : null;
    const focusKey = active && screen.contains(active) ? active.dataset.key : null;
    const scrolls = new Map<string, number>();
    for (const el of screen.querySelectorAll<HTMLElement>('[data-scrollx]')) if (el.dataset.key) scrolls.set(el.dataset.key, el.scrollLeft);

    const ctx = this.ctx();
    const body =
      this.ui.tab === 'station'
        ? stationScreen(ctx)
        : this.ui.tab === 'skills'
          ? skillsScreen(ctx)
          : this.ui.tab === 'train'
            ? trainScreen(ctx)
            : this.ui.tab === 'satchel'
              ? satchelScreen(ctx)
              : journalScreen(ctx);
    if (this.lastRenderedTab !== this.ui.tab) body.classList.add('is-entering');
    this.lastRenderedTab = this.ui.tab;
    screen.replaceChildren(body);

    for (const el of screen.querySelectorAll<HTMLElement>('[data-scrollx]')) {
      const left = el.dataset.key ? scrolls.get(el.dataset.key) : undefined;
      if (left) el.scrollLeft = left;
    }
    if (focusKey) screen.querySelector<HTMLElement>(`[data-key="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
    if (this.celebrate) {
      const elapsed = performance.now() - this.celebrate.at;
      if (elapsed > App.CELEBRATE_MS) this.celebrate = null;
      else if (this.ui.tab === 'train') this.playCelebration(this.celebrate.id, elapsed);
    }
    this.renderChrome();
  }

  private renderChrome(): void {
    const s = this.state;
    byId('shell').dataset.tab = this.ui.tab;

    const obj = objectiveStatus(s);
    byId('mast-title').textContent = TAB_TITLE[this.ui.tab];
    byId('mast-eyebrow').textContent = this.ui.tab === 'station' && obj.current ? (obj.current.chapter === 1 ? 'Chapter One · The Cyan Signal' : 'Night Works') : 'Ashvale Station';
    const done = TRAIN_PART_IDS.filter((id) => s.repairs[id]).length;
    const chip = byId('status-train');
    chip.replaceChildren(art(tabIconUrl('train'), 24), h('strong', { text: `${done}/${TRAIN_PART_IDS.length}` }));
    chip.setAttribute('aria-label', `Locomotive No. 9: ${done} of ${TRAIN_PART_IDS.length} restored`);

    const unread = unreadDialogues(s).length;
    const ready = TRAIN_PART_IDS.filter((id) => repairBlockers(s, id).length === 0).length;
    for (const btn of document.querySelectorAll<HTMLButtonElement>('#nav .nav-btn')) {
      const tab = btn.dataset.tab as Tab;
      const on = tab === this.ui.tab;
      btn.classList.toggle('is-active', on);
      if (on) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
      const n = tab === 'station' ? unread : tab === 'train' ? ready : 0;
      const badge = btn.querySelector<HTMLElement>('.nav-badge');
      if (badge) {
        badge.hidden = n === 0;
        badge.textContent = String(n);
      }
      const label = TABS.find(([t]) => t === tab)?.[1] ?? tab;
      btn.setAttribute('aria-label', n ? `${label}, ${n} ${tab === 'station' ? 'new conversation' : 'ready to restore'}${n > 1 ? 's' : ''}` : label);
    }

    this.renderDock();
    byId('scene-caption').textContent = this.caption(obj.current?.title ?? null);
    this.positionHotspots();
  }

  private renderDock(): void {
    const s = this.state;
    const a = s.activity;
    const dock = byId('dock');
    const stop = byId<HTMLButtonElement>('dock-stop');
    const emblem = byId('dock-emblem');
    if (!a) {
      dock.classList.add('is-idle');
      dock.classList.remove('is-quiet');
      byId('dock-title').textContent = this.lastStop ?? 'Idle';
      byId('dock-sub').textContent = 'Tap to choose an activity';
      emblem.replaceChildren(art(artUrl(NAV_ART.skills ?? ''), 24));
      stop.hidden = true;
      byId('dock-main').setAttribute('aria-label', `${this.lastStop ?? 'Idle'}. Choose an activity.`);
      return;
    }
    const skill = activitySkill(a);
    const { verb, target } = activityVerb(s);
    dock.classList.remove('is-idle');
    // On the skill's own screen the running row shows progress; keep the dock quiet.
    dock.classList.toggle('is-quiet', this.ui.tab === 'skills' && this.ui.skill === skill);
    emblem.replaceChildren(art(skillEmblem(skill), 24));
    byId('dock-title').textContent = `${verb} · ${target}`;
    byId('dock-sub').replaceChildren(`${SKILL_LABEL[skill]} `, h('span', { class: 'num', text: `Lv ${skillLevel(s, skill)}` }), ' · ', h('span', { class: 'num', text: fmtSeconds(actionDuration(s, a)) }), ' each');
    stop.hidden = false;
    stop.setAttribute('aria-label', `Stop: ${verb} ${target}`);
    byId('dock-main').setAttribute('aria-label', `${verb} ${target}. Open ${SKILL_LABEL[skill]}.`);
  }

  private dockGain(items: [ItemId, number][]): void {
    const rank = { rare: 2, uncommon: 1, common: 0 } as const;
    const top = [...items].sort((x, y) => rank[ITEMS[y[0]].rarity] - rank[ITEMS[x[0]].rarity] || y[1] - x[1])[0];
    if (!top) return;
    const el = byId('dock-gain');
    el.replaceChildren(h('span', { text: `+${fmtQty(top[1])}` }), art(itemIconUrl(top[0]), 32));
    el.classList.remove('is-showing');
    void el.offsetWidth;
    el.classList.add('is-showing');
  }

  private caption(goal: string | null): string {
    const s = this.state;
    const a = s.activity;
    if (s.repairs.signalReceiver) return 'The receiver pulses cyan with the signal. Two short, one long.';
    if (a?.kind === 'craft') return 'Hammer ringing on the footplate, sparks hissing out in the rain.';
    if (a?.kind === 'salvage') return 'Spanners and rust in the siding. Every wreck is somebody’s spare parts.';
    if (a?.kind === 'research') return 'Notes drying by the lamp. The ink comes back, line by line.';
    if (a?.kind === 'scavenge') {
      if (a.locationId === 'signalCabinet') return 'Relays tick in the dark cabinet. The cyan light hums overhead.';
      if (a.locationId === 'maintenanceShed') return 'Tobin’s shed smells of tar and oak. Every tool has its outline.';
      return 'Lantern low, you sift the wreckage along the rain-soaked platform.';
    }
    if (s.repairs.boiler) return 'No. 9 breathes. The cyan signal holds steady, waiting.';
    return goal ? `Next: ${goal}` : 'Rain on the canopy. The kilns glow beyond the town.';
  }

  private sceneState(): SceneState {
    const s = this.state;
    const a = s.activity;
    let spot: FigureSpot = 'idle';
    if (a?.kind === 'craft') spot = 'engine';
    else if (a?.kind === 'salvage') spot = 'salvage';
    else if (a?.kind === 'research') spot = 'research';
    else if (a?.kind === 'scavenge') spot = a.locationId === 'derelictPlatform' ? 'platform' : a.locationId === 'signalCabinet' ? 'cabinet' : 'shed';
    const unread = unreadDialogues(s).map((id) => DIALOGUE_BY_ID[id]?.speaker);
    return {
      repairs: s.repairs,
      upgrades: { cabLanterns: s.repairs.cabLanterns, tenderWinch: s.repairs.tenderWinch, signalReceiver: s.repairs.signalReceiver },
      spot,
      working: a !== null,
      shedOpen: 'shedKey' in s.discoveries && skillLevel(s, 'scavenging') >= LOCATIONS.maintenanceShed.levelRequired,
      cabinetOpen: s.repairs.fireboxDoor,
      maraHere: s.dialogues.unlocked.includes('maraIntro'),
      tobinHere: s.dialogues.unlocked.includes('tobinIntro'),
      maraWaiting: unread.includes('mara'),
      tobinWaiting: unread.includes('tobin'),
      rareAt: this.rareAt,
    };
  }

  private flashScene(): void {
    const el = byId('scene-wrap');
    el.classList.remove('scene-flash');
    void el.offsetWidth;
    el.classList.add('scene-flash');
  }

  private playCelebration(id: TrainPartId, elapsed: number): void {
    // Rebuilt screens resume the animation where it was rather than restarting.
    const delay = `${-Math.round(elapsed)}ms`;
    const hot = document.querySelector<HTMLElement>(`.part-hotspot[data-part="${id}"]`);
    const layer = document.querySelector<HTMLElement>('.inspector-layer');
    if (layer && hot) {
      layer.append(h('span', { class: 'restored-stamp', text: 'Restored', style: { left: hot.style.left, top: hot.style.top, 'animation-delay': delay } }));
      hot.classList.add('is-celebrating');
    } else {
      // Improvements have no plate on the engine; celebrate on the detail.
      const d = document.querySelector<HTMLElement>('.part-detail');
      if (d && elapsed < 900) {
        d.style.animationDelay = delay;
        d.classList.add('is-celebrating');
      }
    }
  }

  // ====================================================================
  // chrome
  // ====================================================================

  private buildChrome(): void {
    byId('nav').replaceChildren(
      ...TABS.map(([id, label]) =>
        h(
          'button',
          { class: 'nav-btn', attrs: { type: 'button', 'aria-label': label }, data: { tab: id }, on: { click: () => this.go(id) } },
          art(tabIconUrl(id), 24),
          h('span', { text: label }),
          h('span', { class: 'nav-badge', attrs: { hidden: true, 'aria-hidden': 'true' } }),
        ),
      ),
    );
    byId('menu-btn').replaceChildren(art(artUrl(NAV_ART.settings ?? ''), 24));
    byId('status-train').addEventListener('click', () => this.go('train'));
    byId('dock-stop').addEventListener('click', () => this.stop());
    byId('dock-main').addEventListener('click', () => {
      const a = this.state.activity;
      this.go('skills', a ? activitySkill(a) : this.ui.skill);
    });
    byId('menu-btn').addEventListener('click', (e) => this.openMenu(e.currentTarget as HTMLElement));

    // Scene hotspots: real shortcuts to the matching screens.
    const host = byId('hotspots');
    for (const hs of HOTSPOTS) {
      const marker = (MARKER_ART as Record<string, string | undefined>)[hs.id];
      host.appendChild(
        h(
          'button',
          {
            class: 'hotspot',
            attrs: { type: 'button', 'aria-label': `${hs.label}: open` },
            data: { hotspot: hs.id },
            style: { left: `${(hs.x / 384) * 100}%`, top: `${(hs.y / 216) * 100}%`, width: `${(hs.w / 384) * 100}%`, height: `${(hs.h / 216) * 100}%` },
            on: { click: () => this.onHotspot(hs.id) },
          },
          marker ? art(artUrl(marker), 24) : null,
          h('span', { class: 'hotspot-label', text: hs.label }),
        ),
      );
    }
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.positionHotspots()).observe(byId('scene-wrap'));
    window.addEventListener('resize', () => this.positionHotspots());
  }

  /** Fit the scene and lay the hotspot layer exactly over the drawn canvas. */
  private positionHotspots(): void {
    const wrap = byId('scene-wrap');
    if (wrap.clientWidth === 0) return;
    this.scene.fit(wrap.clientWidth);
    const canvas = byId<HTMLCanvasElement>('scene');
    const host = byId('hotspots');
    host.style.left = `${canvas.offsetLeft}px`;
    host.style.top = `${canvas.offsetTop}px`;
    host.style.width = `${canvas.offsetWidth}px`;
    host.style.height = `${canvas.offsetHeight}px`;
  }

  private onHotspot(id: HotspotId): void {
    if (id === 'train') this.go('train');
    else if (id === 'salvage') this.go('skills', 'salvaging');
    else this.go('skills', 'scavenging');
  }

  private bindGlobal(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.settleAndSave();
      else this.onTick();
    });
    window.addEventListener('pagehide', () => this.settleAndSave());
    window.addEventListener('beforeunload', () => this.settleAndSave());
    byId('drawer-scrim').addEventListener('click', () => this.closeDrawer());
    byId('drawer-close').addEventListener('click', () => this.closeDrawer());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeDrawer();
      if (e.key === 'Tab' && !byId('drawer').hidden) this.trapFocus(e);
    });
    this.desktop.addEventListener?.('change', () => {
      this.dirty = true;
      requestAnimationFrame(() => this.positionHotspots());
    });
  }

  // ====================================================================
  // notices and level-ups
  // ====================================================================

  private notify(n: Notice): void {
    this.notices.push(n);
    // Keep the queue short: drop the oldest routine notices first.
    while (this.notices.length > 5) {
      const i = this.notices.findIndex((x) => x.kind === 'info' || x.kind === 'tool' || x.kind === 'warn');
      this.notices.splice(i >= 0 ? i : 0, 1);
    }
    this.flushNotices();
  }

  private flushNotices(): void {
    const box = byId('notices');
    while (this.noticesShown < NOTICE_MAX && this.notices.length > 0) {
      const n = this.notices.shift();
      if (!n) break;
      this.noticesShown++;
      const el = h(
        'button',
        { class: `notice notice-${n.kind}`, attrs: { type: 'button' } },
        n.icon ? art(n.icon, 32, { cls: n.round ? 'is-round' : '' }) : null,
        h('span', { class: 'notice-text' }, h('span', { class: 'notice-kicker', text: n.kicker }), h('span', { class: 'notice-body', text: n.body })),
      );
      const done = (): void => {
        if (!el.isConnected || el.classList.contains('is-leaving')) return;
        el.classList.add('is-leaving');
        window.setTimeout(() => {
          el.remove();
          this.noticesShown--;
          this.flushNotices();
        }, 220);
      };
      el.addEventListener('click', () => {
        n.onTap?.();
        done();
      });
      box.appendChild(el);
      window.setTimeout(done, n.kind === 'warn' || n.kind === 'info' || n.kind === 'tool' ? 3000 : 4200);
    }
  }

  private levelUp(skill: SkillId, level: number): void {
    const unlocked = skillMilestones(skill).filter((m) => m.level === level);
    const el = h(
      'div',
      { class: 'levelup', attrs: { role: 'status' } },
      h('p', { class: 'levelup-kicker', text: 'Level up' }),
      h('p', { class: 'levelup-title', text: `${SKILL_LABEL[skill]} ${level}` }),
      unlocked.length ? h('p', { class: 'levelup-unlocks', text: `Unlocked: ${unlocked.map((m) => m.text).join(', ')}` }) : null,
    );
    byId('levelup-host').replaceChildren(el);
    window.setTimeout(() => el.remove(), 2900);
  }

  // ====================================================================
  // drawer
  // ====================================================================

  private openDrawer(content: HTMLElement, label: string, opts: { opener?: HTMLElement | null; onClose?: () => void; paper?: boolean } = {}): void {
    const drawer = byId('drawer');
    if (drawer.hidden) this.drawerOpener = opts.opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    this.drawerOnClose = opts.onClose ?? null;
    const body = byId('drawer-body');
    body.classList.toggle('is-paper', !!opts.paper);
    byId('drawer-panel').classList.toggle('is-paper', !!opts.paper);
    body.replaceChildren(content);
    drawer.setAttribute('aria-label', label);
    drawer.hidden = false;
    byId('drawer-panel').scrollTop = 0;
    requestAnimationFrame(() => {
      drawer.classList.add('is-open');
      const first = body.querySelector<HTMLElement>('[data-autofocus]') ?? body.querySelector<HTMLElement>('button:not([disabled])');
      first?.focus({ preventScroll: true });
    });
  }

  private closeDrawer(restoreFocus = true): void {
    const drawer = byId('drawer');
    if (drawer.hidden) return;
    drawer.classList.remove('is-open');
    const cb = this.drawerOnClose;
    this.drawerOnClose = null;
    window.setTimeout(() => {
      if (!drawer.classList.contains('is-open')) drawer.hidden = true;
    }, 220);
    cb?.();
    if (restoreFocus && this.drawerOpener) {
      // The screen may have been rebuilt while the drawer was open; find the
      // opener again by its stable key.
      const key = this.drawerOpener.closest<HTMLElement>('[data-key]')?.dataset.key;
      const target = this.drawerOpener.isConnected ? this.drawerOpener : key ? document.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`) : null;
      target?.focus({ preventScroll: true });
    }
    this.drawerOpener = null;
  }

  private trapFocus(e: KeyboardEvent): void {
    const panel = byId('drawer-panel');
    const focusable = [...panel.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }

  // ====================================================================
  // sheets
  // ====================================================================

  private openItem(id: ItemId): void {
    const def = ITEMS[id];
    const known = seen(this.state, id);
    const qty = this.state.inventory[id];
    const equippedFor = (Object.entries(this.state.equipment) as [SkillId, ToolId | null][]).find(([, t]) => t === id)?.[0];
    const links = (title: string, list: ItemLink[]): Child =>
      list.length
        ? h(
            'section',
            { class: 'group' },
            h('h3', { class: 'label-section', text: title }),
            h(
              'div',
              { class: 'detail-list' },
              list.map((l) => h('button', { class: 'detail-link', attrs: { type: 'button' }, on: { click: () => l.go?.() } }, h('span', { text: l.label }), l.sub ? h('span', { class: 'detail-sub', text: l.sub }) : null)),
            ),
          )
        : null;
    this.openDrawer(
      h(
        'div',
        { class: `item-sheet rarity-${def.rarity}` },
        h(
          'div',
          { class: 'detail-head' },
          h('span', { class: 'detail-art' }, art(itemIconUrl(id), 96, { silhouette: !known })),
          h(
            'div',
            null,
            h('div', { class: 'stamp-row' }, stamp(def.rarity, def.rarity === 'rare' ? 'amber' : def.rarity === 'uncommon' ? 'cyan' : 'muted'), stamp(def.kind === 'component' ? 'part' : def.kind, 'brass')),
            h('h2', { class: 'label-heading detail-title', text: known ? def.name : 'Unknown item' }),
            h('p', { class: 'detail-qty' }, h('span', { class: 'label-micro', text: 'In satchel ' }), h('strong', { class: 'num', text: qty.toLocaleString() }), equippedFor ? h('span', { class: 'text-cyan text-small', text: ` · equipped (${SKILL_LABEL[equippedFor]})` }) : null),
          ),
        ),
        h('p', { class: 'text-story', text: known ? def.description : 'You haven’t found one of these yet.' }),
        isTool(id) ? this.toolBlock(id) : null,
        links('Where to find it', itemSources(id, this.actions)),
        links('Used for', itemUses(id, this.actions)),
      ),
      def.name,
    );
  }

  private toolBlock(id: ToolId): HTMLElement {
    const t = TOOLS[id];
    const equipped = this.state.equipment[t.skill] === id;
    const access = toolAccess(this.state, id);
    const owned = this.state.inventory[id] > 0;
    return h(
      'div',
      { class: 'plate is-flat tool-block' },
      h('p', { class: 'label-section', text: `${SKILL_NAMES[t.skill]} tool · tier ${t.tier}` }),
      h('p', { class: 'text-cyan', text: t.bonusText }),
      h('p', { class: 'text-small text-muted', text: t.levelRequired > 1 ? `Equip at ${SKILL_NAMES[t.skill]} level ${t.levelRequired}.` : 'Can be equipped at any level.' }),
      equipped
        ? button({ label: 'Unequip', variant: 'secondary', block: true, onClick: () => this.unequip(t.skill) })
        : owned
          ? button({ label: access.ok ? 'Equip' : access.reason, variant: 'primary', block: true, disabled: !access.ok, onClick: () => this.equip(id) })
          : null,
    );
  }

  private openTools(skill: SkillId): void {
    const tools = ownedTools(this.state, skill);
    const current = this.state.equipment[skill];
    this.openDrawer(
      h(
        'div',
        { class: 'tools-sheet' },
        h('p', { class: 'label-section', text: 'Tool slot' }),
        h('h2', { class: 'label-heading', text: SKILL_NAMES[skill] }),
        h(
          'ul',
          { class: 'choice-list' },
          tools.map((t) => {
            const access = toolAccess(this.state, t);
            const on = current === t;
            return h(
              'li',
              { class: `choice${on ? ' is-on' : ''}` },
              art(itemIconUrl(t), 32),
              h('span', { class: 'choice-text' }, h('strong', { text: ITEMS[t].name }), h('span', { class: 'text-small text-cyan', text: `Tier ${TOOLS[t].tier} · ${TOOLS[t].bonusText}` }), access.ok ? null : h('span', { class: 'text-small text-danger', text: access.reason })),
              on ? button({ label: 'Unequip', variant: 'secondary', size: 's', onClick: () => this.unequip(skill) }) : button({ label: 'Equip', variant: 'primary', size: 's', disabled: !access.ok, onClick: () => this.equip(t) }),
            );
          }),
        ),
        h('p', { class: 'text-small text-muted', text: 'Better tools come from Engineering → Tools; some need a research blueprint first.' }),
      ),
      `${SKILL_NAMES[skill]} tools`,
    );
  }

  private openDiscovery(id: string): void {
    const d = DISCOVERY_BY_ID[id];
    if (!d || !(id in this.state.discoveries)) return;
    const pid = (Object.keys(PROJECTS) as (keyof typeof PROJECTS)[]).find((p) => PROJECTS[p].discoveryRequired === id);
    const foundAt = this.state.discoveries[id];
    const studied = pid ? this.state.research.done.includes(pid) : false;
    this.openDrawer(
      h(
        'article',
        { class: 'page-sheet' },
        h(
          'div',
          { class: 'page-sheet-head' },
          h('span', { class: 'page-sheet-art' }, art(discoveryIconUrl(id), 96)),
          h(
            'div',
            null,
            h('p', { class: 'page-kicker', text: `${CATEGORY_NAMES[d.category]} · ${LOCATIONS[d.location].name}` }),
            h('h2', { class: 'page-title', text: d.name }),
            foundAt ? h('p', { class: 'page-date', text: `Recorded ${new Date(foundAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}` }) : null,
          ),
        ),
        h('p', { class: 'page-text', text: d.text }),
        pid
          ? h(
              'div',
              { class: 'page-note' },
              h('p', { class: 'page-kicker', text: studied ? 'Studied' : 'Can be studied' }),
              h('p', { text: `${PROJECTS[pid].name} — ${PROJECTS[pid].unlockText}` }),
              studied ? null : h('button', { class: 'ink-link', text: 'Open the reading desk', attrs: { type: 'button' }, on: { click: () => this.go('skills', 'research') } }),
            )
          : null,
      ),
      d.name,
      { paper: true },
    );
  }

  /** A character's page: who they are and every conversation, new ones first. */
  private openCharacter(sid: SpeakerId, playId?: string): void {
    const c = CHARACTERS[sid];
    const convs = DIALOGUES.filter((d) => d.speaker === sid && this.state.dialogues.unlocked.includes(d.id));
    const unread = convs.filter((d) => !this.state.dialogues.read.includes(d.id));
    const toPlay = playId ? DIALOGUE_BY_ID[playId] : undefined;
    if (toPlay) {
      this.playDialogue(toPlay, () => this.openCharacter(sid));
      return;
    }
    // A single new conversation and nothing else: go straight to it.
    if (unread.length === 1 && convs.length === 1 && unread[0]) {
      this.playDialogue(unread[0], () => this.openCharacter(sid));
      return;
    }
    const ordered = [...unread, ...convs.filter((d) => this.state.dialogues.read.includes(d.id)).reverse()];
    this.openDrawer(
      h(
        'div',
        { class: 'character-sheet' },
        h(
          'div',
          { class: 'character-head' },
          h('span', { class: 'dialogue-portrait' }, art(portraitUrl(sid, unread.length ? 'concerned' : 'neutral'), 96)),
          h('div', null, h('p', { class: 'label-micro', text: c.role }), h('h2', { class: 'label-title', text: c.name }), h('p', { class: 'text-small text-muted', text: `${convs.length} conversation${convs.length === 1 ? '' : 's'}${unread.length ? ` · ${unread.length} new` : ''}` })),
        ),
        h(
          'ul',
          { class: 'choice-list' },
          ordered.map((d) => {
            const isNew = !this.state.dialogues.read.includes(d.id);
            return h(
              'li',
              null,
              h(
                'button',
                { class: `conversation${isNew ? ' is-new' : ''}${d.milestone ? ' is-milestone' : ''}`, attrs: { type: 'button' }, on: { click: () => this.playDialogue(d, () => this.openCharacter(sid)) } },
                h('span', { class: 'conversation-title', text: d.title }),
                isNew ? stamp('New', 'amber') : h('span', { class: 'label-micro', text: 'Replay' }),
              ),
            );
          }),
        ),
      ),
      c.name,
    );
  }

  private playDialogue(d: DialogueDef, after: () => void): void {
    let i = 0;
    let typing: number | null = null;
    let full = '';
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const portrait = h('span', { class: 'dialogue-portrait' });
    const name = h('p', { class: 'dialogue-name' });
    const text = h('p', { class: 'dialogue-text' });
    const live = h('p', { class: 'sr-only', attrs: { 'aria-live': 'polite' } });
    const dots = h('div', { class: 'dialogue-dots', attrs: { 'aria-hidden': 'true' } }, d.lines.map(() => h('span')));
    const next = button({ label: 'Continue', variant: 'primary', key: 'dlg-next' });
    next.dataset.autofocus = '';
    const label = next.querySelector('.btn-label');
    const stageEl = h('div', { class: 'dialogue-stage' }, portrait, h('div', { class: 'dialogue-speech' }, name, text));
    const wrap = h('div', { class: `dialogue${d.milestone ? ' is-milestone' : ''}` }, h('p', { class: 'label-section', text: d.title }), stageEl, live, h('div', { class: 'dialogue-foot' }, dots, next));

    const finishTyping = (): void => {
      if (typing !== null) cancelAnimationFrame(typing);
      typing = null;
      text.textContent = full;
    };
    const show = (): void => {
      const line = d.lines[i];
      if (!line) return;
      const who = line.speaker === 'you' ? null : CHARACTERS[line.speaker];
      portrait.classList.toggle('is-you', !who);
      portrait.replaceChildren(art(portraitUrl(line.speaker, line.mood ?? 'neutral'), 96, { alt: who ? who.name : 'You' }));
      name.textContent = who ? who.name : 'You';
      name.classList.toggle('is-you', !who);
      stageEl.classList.remove('dialogue-line-enter');
      void stageEl.offsetWidth;
      stageEl.classList.add('dialogue-line-enter');
      [...dots.children].forEach((dot, k) => dot.classList.toggle('is-on', k <= i));
      if (label) label.textContent = i < d.lines.length - 1 ? 'Continue' : 'Close';
      full = line.text;
      live.textContent = `${who ? who.name : 'You'}: ${full}`;
      if (reduced) {
        text.textContent = full;
        return;
      }
      const startAt = performance.now();
      const perChar = Math.min(22, 900 / Math.max(1, full.length));
      const step = (): void => {
        const n = Math.floor((performance.now() - startAt) / perChar);
        text.textContent = full.slice(0, n);
        typing = n < full.length ? requestAnimationFrame(step) : null;
      };
      typing = requestAnimationFrame(step);
    };
    next.addEventListener('click', () => {
      if (typing !== null) {
        finishTyping();
        return;
      }
      i++;
      if (i < d.lines.length) {
        show();
        return;
      }
      this.state = markDialogueRead(this.state, d.id);
      this.save();
      this.dirty = true;
      const more = DIALOGUES.some((x) => x.speaker === d.speaker && x.id !== d.id && this.state.dialogues.unlocked.includes(x.id));
      if (more) after();
      else this.closeDrawer();
    });
    this.openDrawer(wrap, d.title, { onClose: finishTyping });
    show();
  }

  private openHistory(): void {
    const events = this.history.slice(0, 30);
    const now = Date.now();
    this.openDrawer(
      h(
        'div',
        { class: 'history-sheet' },
        h('p', { class: 'label-section', text: 'This session' }),
        h('h2', { class: 'label-heading', text: 'Recent rewards' }),
        events.length
          ? h(
              'ol',
              { class: 'history' },
              events.map((e) =>
                h(
                  'li',
                  { class: 'history-row' },
                  h('span', { class: 'history-when' }, art(skillEmblem(e.skill), 24), h('span', { class: 'label-micro', text: fmtAgo(now - e.at) })),
                  h(
                    'span',
                    { class: 'history-what' },
                    e.items.length
                      ? rewardChips(e.items.map(([id, n]) => ({ icon: itemIconUrl(id), label: ITEMS[id].name, qty: n, rarity: ITEMS[id].rarity })), 5)
                      : h('span', { class: 'text-small text-muted', text: `${e.actions} action${e.actions === 1 ? '' : 's'}` }),
                    h('span', { class: 'text-small text-muted num', text: `+${fmtQty(e.xp)} ${SKILL_LABEL[e.skill]} XP` }),
                  ),
                ),
              ),
            )
          : h('p', { class: 'text-muted', text: 'Nothing yet this session.' }),
        h('p', { class: 'text-small text-muted', text: 'History covers this session; items and XP are always saved.' }),
      ),
      'Recent rewards',
    );
  }

  private confirmRepair(id: TrainPartId): void {
    const def = REPAIRS[id];
    if (repairBlockers(this.state, id).length > 0) return;
    const cost = (Object.entries(def.cost) as [ItemId, number][]).map(([item, n]) => ({ icon: itemIconUrl(item), label: ITEMS[item].name, qty: n, rarity: ITEMS[item].rarity }));
    const verb = def.kind === 'repair' ? 'Restore' : 'Fit';
    const confirmBtn = button({
      label: verb,
      variant: 'repair',
      key: 'confirm-repair',
      onClick: () => {
        this.closeDrawer(false);
        this.doRepair(id);
      },
    });
    confirmBtn.dataset.autofocus = '';
    this.openDrawer(
      h(
        'div',
        { class: 'confirm-sheet' },
        h('p', { class: 'label-section', text: 'Locomotive No. 9' }),
        h('h2', { class: 'label-heading', text: `${verb} the ${def.name}?` }),
        h('p', { class: 'text-story', text: def.description }),
        h('p', { class: 'label-micro', text: 'This will use' }),
        h('div', { class: 'confirm-cost' }, rewardChips(cost, 8, '×')),
        h('p', { class: 'part-benefit' }, h('span', { class: 'label-micro', text: 'Bonus' }), h('span', { text: def.benefit })),
        h('div', { class: 'confirm-actions' }, button({ label: 'Not yet', variant: 'secondary', onClick: () => this.closeDrawer() }), confirmBtn),
      ),
      `${verb} the ${def.name}`,
    );
  }

  private openMenu(opener: HTMLElement): void {
    let confirming = false;
    const resetBtn = button({ label: 'Reset save…', variant: 'secondary', block: true });
    const warn = h('p', { class: 'text-small text-danger', attrs: { hidden: true }, text: 'This erases everything in Ashvale and cannot be undone. Tap again to confirm.' });
    resetBtn.addEventListener('click', () => {
      if (!confirming) {
        confirming = true;
        warn.hidden = false;
        const l = resetBtn.querySelector('.btn-label');
        if (l) l.textContent = 'Erase all progress';
        resetBtn.classList.replace('btn-secondary', 'btn-repair');
        return;
      }
      clearSave();
      this.state = createInitialState(Date.now(), newSeed());
      this.history = [];
      this.lastStop = null;
      this.save();
      this.closeDrawer(false);
      this.go('station');
      this.showOnboarding();
    });
    this.openDrawer(
      h(
        'div',
        { class: 'menu-sheet' },
        h('p', { class: 'label-section', text: `Ashvale ${VERSION}` }),
        h('h2', { class: 'label-title', text: 'Last Stop' }),
        h('p', { class: 'text-story', text: 'An idle railway mystery. Work continues for up to eight hours while you’re away.' }),
        button({
          label: 'Replay the introduction',
          variant: 'secondary',
          block: true,
          onClick: () => {
            this.closeDrawer(false);
            this.showOnboarding();
          },
        }),
        resetBtn,
        warn,
        h(
          'dl',
          { class: 'kv' },
          h('dt', { text: 'Art' }),
          h('dd', { text: 'Operation Rebirth · Astra' }),
          h('dt', { text: 'Motion' }),
          h('dd', { text: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'Reduced (device setting)' : 'Full (device setting)' }),
          h('dt', { text: 'Progress' }),
          h('dd', { text: 'Saved on this device' }),
        ),
      ),
      'Game menu',
      { opener },
    );
  }

  // ====================================================================
  // away summary and onboarding
  // ====================================================================

  private showAway(r: TickResult): void {
    this.absorb(r, false);
    const credited = r.elapsedMs - r.discardedMs;
    const items = ITEM_IDS.filter((id) => r.itemsGained[id] > 0);
    const spent = ITEM_IDS.filter((id) => r.itemsSpent[id] > 0);
    const skill = r.skill;
    const verb = skill === 'engineering' ? 'worked at the engine' : skill === 'salvaging' ? 'kept salvaging' : skill === 'research' ? 'kept studying' : 'kept searching';
    this.openDrawer(
      h(
        'div',
        { class: 'away-sheet' },
        h('p', { class: 'label-section', text: 'While you were away' }),
        h('h2', { class: 'label-heading', text: `You ${verb} for ${formatDuration(credited)}.` }),
        r.discardedMs > 0 ? h('p', { class: 'text-small text-muted', text: `You were gone ${formatDuration(r.elapsedMs)}; only the last 8 hours count.` }) : null,
        skill
          ? h('div', { class: 'away-xp' }, art(skillEmblem(skill), 24), h('span', null, h('strong', { class: 'num', text: `+${fmtQty(r.xpGained)}` }), ` ${SKILL_LABEL[skill]} XP`), h('span', { class: 'text-muted num', text: `${fmtQty(r.actions)} actions` }))
          : null,
        r.levelUp ? h('p', { class: 'away-level' }, `${SKILL_LABEL[r.levelUp.skill]} `, h('span', { class: 'num', text: `${r.levelUp.from} → ${r.levelUp.to}` })) : null,
        items.length ? h('div', { class: 'group' }, h('p', { class: 'label-micro', text: 'Gathered' }), rewardChips(items.map((id) => ({ icon: itemIconUrl(id), label: ITEMS[id].name, qty: r.itemsGained[id], rarity: ITEMS[id].rarity })), 12)) : null,
        spent.length ? h('p', { class: 'text-small text-muted', text: `Used ${spent.map((id) => `${fmtQty(r.itemsSpent[id])} ${ITEMS[id].name}`).join(', ')}` }) : null,
        r.discoveries.length ? h('p', { class: 'text-cyan', text: `New in the journal: ${r.discoveries.map((id) => DISCOVERY_BY_ID[id]?.name ?? id).join(', ')}` }) : null,
        r.completedProject ? h('p', { class: 'text-cyan', text: `Research finished: ${PROJECTS[r.completedProject].name}` }) : null,
        r.stopped === 'outOfMaterials' ? h('p', { class: 'text-small text-muted', text: 'The work stopped when materials ran out.' }) : null,
        button({ label: 'Back to work', variant: 'primary', block: true, onClick: () => this.closeDrawer() }),
      ),
      'While you were away',
    );
  }

  private showOnboarding(): void {
    const steps = [
      { title: 'Welcome to Ashvale', text: 'A pottery town at the end of a closed line. Locomotive No. 9 has waited here, cold, for fifty years.' },
      { title: 'Work while you’re away', text: 'Pick an activity and it keeps running for up to eight hours, even with the game closed.' },
      { title: 'Four skills, one engine', text: 'Search, salvage, engineer and study. Every repair shows on No. 9 — and changes what you can reach.' },
    ];
    let i = 0;
    const root = byId('onboarding');
    const finish = (): void => {
      root.hidden = true;
      this.state = completeOnboarding(this.state);
      this.save();
      this.dirty = true;
      if (unreadDialogues(this.state).includes('maraIntro')) window.setTimeout(() => this.openCharacter('mara', 'maraIntro'), 300);
    };
    const render = (): void => {
      const s = steps[i];
      if (!s) return;
      const primary = button({
        label: i < steps.length - 1 ? 'Next' : 'Begin',
        variant: 'primary',
        onClick: () => {
          i++;
          if (i < steps.length) render();
          else finish();
        },
      });
      root.replaceChildren(
        h(
          'div',
          { class: 'onboarding-card', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': s.title } },
          h('div', { class: 'onboarding-steps', attrs: { 'aria-hidden': 'true' } }, steps.map((_, k) => h('span', { class: k <= i ? 'is-done' : '' }))),
          h('p', { class: 'label-section', text: `${i + 1} of ${steps.length}` }),
          h('h2', { class: 'label-title', text: s.title }),
          h('p', { class: 'text-story', text: s.text }),
          h('div', { class: 'confirm-actions' }, button({ label: 'Skip', variant: 'secondary', onClick: finish }), primary),
        ),
      );
      primary.focus({ preventScroll: true });
    };
    root.hidden = false;
    render();
  }
}
