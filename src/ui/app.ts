// The interface controller: owns timers, saving, the DOM and feedback.
// Every rule lives in the core; this file only calls it and shows results.

import { ITEMS, ITEM_IDS, type ItemId } from '../core/content/items';
import { CATEGORY_NAMES, CHARACTERS, DIALOGUE_BY_ID, DISCOVERY_BY_ID, ACHIEVEMENTS, type DialogueLine } from '../core/content/story';
import { LOCATIONS, RECIPES, REPAIRS, REPAIR_IDS, SKILL_NAMES, type LocationId, type RecipeId, type RepairId } from '../core/content/world';
import { actionProgress } from '../core/activity';
import {
  completeOnboarding,
  markDialogueRead,
  performRepair,
  startCrafting,
  startScavenging,
  stopActivity,
  tick,
  unreadDialogues,
  type TickResult,
} from '../core/game';
import { newSeed } from '../core/rng';
import { repairBlockers, skillLevel } from '../core/rules';
import { deserialize, serialize } from '../core/save';
import { createInitialState, type GameState } from '../core/state';
import { backupCorruptSave, clearSave, readSave, writeSave } from '../platform/storage';
import { byId, formatDuration, h, img } from './dom';
import { AshvaleScene, type FigureSpot, type SceneState } from './scene';
import { itemIconUrl, portraitUrl, tabIconUrl } from './sprites';
import {
  activityLabel,
  itemSources,
  itemUses,
  journalView,
  objectiveStatus,
  rarityClass,
  satchelView,
  skillsView,
  stationView,
  trainView,
  type Actions,
  type LogEntry,
  type Tab,
  type UiState,
} from './views';

const TICK_MS = 250;
const AUTOSAVE_MS = 15_000;
const AWAY_THRESHOLD_MS = 60_000;
const LOG_MAX = 8;
const TABS: [Tab, string][] = [
  ['station', 'Station'],
  ['skills', 'Skills'],
  ['train', 'Train'],
  ['satchel', 'Satchel'],
  ['journal', 'Journal'],
];

interface Toast {
  kind: 'rare' | 'discovery' | 'level' | 'achievement' | 'talk' | 'info' | 'warn';
  title: string;
  body?: string;
  icon?: string;
  onTap?: () => void;
}

export class App {
  private state: GameState;
  private ui: UiState = { tab: 'station', skillTab: 'scavenging', journalTab: 'discoveries', filter: 'all', sort: 'rarity' };
  private log: LogEntry[] = [];
  private dirty = true;
  private lastSaveAt = 0;
  private readonly scene: AshvaleScene;
  private readonly actions: Actions;
  private toastQueue: Toast[] = [];
  private toastsShown = 0;

  constructor() {
    this.scene = new AshvaleScene(byId<HTMLCanvasElement>('scene'));
    this.actions = this.makeActions();
    const { state, notice } = this.load();
    this.state = state;
    this.buildTabbar();
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
    if (notice) this.toast({ kind: 'info', title: notice });

    this.render();
    if (!this.state.onboarded) this.showOnboarding();

    window.setInterval(() => this.onTick(), TICK_MS);
    window.setInterval(() => this.save(), AUTOSAVE_MS);
    requestAnimationFrame((t) => this.frame(t));
  }

  // ---------- persistence ----------

  private load(): { state: GameState; notice: string | null } {
    const now = Date.now();
    const raw = readSave();
    const loaded = deserialize(raw, now, newSeed());
    if (loaded.status === 'ok') {
      return { state: loaded.state, notice: loaded.migratedFrom ? 'Your save was carried over to Ashvale 0.2.' : null };
    }
    if (loaded.status === 'corrupt' && raw) {
      backupCorruptSave(raw);
      return { state: createInitialState(now, newSeed()), notice: 'Your save could not be read. A copy was kept; starting fresh.' };
    }
    return { state: createInitialState(now, newSeed()), notice: null };
  }

  private save(): void {
    const now = Date.now();
    const ok = writeSave(serialize(this.state, now));
    this.lastSaveAt = now;
    const el = byId('save-status');
    el.textContent = ok ? 'saved' : 'save failed';
    el.classList.add('show');
    window.setTimeout(() => {
      if (Date.now() - this.lastSaveAt >= 1400) el.classList.remove('show');
    }, 1500);
  }

  private settleAndSave(): void {
    this.absorb(tick(this.state, Date.now()), true);
    this.save();
  }

  // ---------- game loop ----------

  private onTick(): void {
    const result = tick(this.state, Date.now());
    if (result.elapsedMs >= AWAY_THRESHOLD_MS && result.actions > 0) {
      // The tab slept (phone locked, app switched): treat as time away.
      this.state = result.state;
      this.showAway(result);
      this.save();
      this.dirty = true;
      return;
    }
    this.absorb(result, true);
  }

  /** Turns a tick result into state, log lines and feedback. */
  private absorb(r: TickResult, feedback: boolean): void {
    const changed = r.state !== this.state;
    this.state = r.state;
    if (r.actions > 0) {
      const gained = ITEM_IDS.filter((id) => r.itemsGained[id] > 0);
      if (r.skill === 'engineering') {
        for (const id of gained) this.pushLog({ kind: 'find', text: `Made ${r.itemsGained[id]} ${ITEMS[id].name}`, item: id });
      } else if (gained.length > 0) {
        const top = [...gained].sort((a, b) => rank(b) - rank(a))[0] as ItemId;
        this.pushLog({ kind: 'find', text: `Found ${gained.map((id) => `${r.itemsGained[id]} ${ITEMS[id].name}`).join(', ')}`, item: top });
      }
      this.dirty = true;
    }
    if (feedback) {
      for (const id of r.rareFinds) {
        this.pushLog({ kind: 'rare', text: `Rare find: ${ITEMS[id].name}!`, item: id });
        this.toast({ kind: 'rare', title: 'Rare find', body: ITEMS[id].name, icon: itemIconUrl(id), onTap: () => this.openItem(id) });
      }
      for (const id of r.discoveries) {
        const d = DISCOVERY_BY_ID[id];
        if (!d) continue;
        this.pushLog({ kind: 'discovery', text: `Journal: ${d.name}` });
        this.toast({ kind: 'discovery', title: 'New discovery', body: d.name, onTap: () => this.openDiscovery(id) });
      }
      if (r.levelUp) {
        this.pushLog({ kind: 'level', text: `${SKILL_NAMES[r.levelUp.skill]} reached level ${r.levelUp.to}` });
        this.toast({ kind: 'level', title: 'Level up', body: `${SKILL_NAMES[r.levelUp.skill]} ${r.levelUp.to}` });
      }
      for (const id of r.achievements) {
        const a = ACHIEVEMENTS.find((x) => x.id === id);
        if (a) this.toast({ kind: 'achievement', title: 'Feat earned', body: a.name });
      }
      for (const id of r.dialogues) {
        const d = DIALOGUE_BY_ID[id];
        if (d && id !== 'maraIntro') this.toast({ kind: 'talk', title: `${CHARACTERS[d.speaker].name} wants a word`, body: d.title, icon: portraitUrl(d.speaker), onTap: () => this.openDialogue(id) });
      }
      if (r.stopped === 'outOfMaterials') {
        this.pushLog({ kind: 'info', text: 'Out of materials — crafting stopped.' });
        this.toast({ kind: 'warn', title: 'Out of materials', body: 'Crafting stopped. Scavenge for more.' });
      }
    }
    if (changed && (r.discoveries.length || r.dialogues.length || r.achievements.length || r.stopped)) this.dirty = true;
  }

  private frame(t: number): void {
    const now = Date.now();
    const p = actionProgress(this.state, now);
    for (const el of document.querySelectorAll<HTMLElement>('[data-live="activity"]')) el.style.width = `${(p * 100).toFixed(1)}%`;
    if (this.dirty) this.render();
    this.scene.draw(this.sceneState(), t);
    requestAnimationFrame((n) => this.frame(n));
  }

  // ---------- actions ----------

  private makeActions(): Actions {
    return {
      scavenge: (id) => this.start(() => startScavenging(this.state, id, Date.now()), `Searching the ${LOCATIONS[id].name}.`),
      craft: (id) => this.start(() => startCrafting(this.state, id, Date.now()), `Crafting ${ITEMS[RECIPES[id].output].name}.`),
      stop: () => this.stop(),
      repair: (id) => this.repair(id),
      openItem: (id) => this.openItem(id),
      openDiscovery: (id) => this.openDiscovery(id),
      openDialogue: (id) => this.openDialogue(id),
      go: (tab, sub) => {
        this.ui = { ...this.ui, tab };
        if (tab === 'skills' && (sub === 'scavenging' || sub === 'engineering')) this.ui.skillTab = sub;
        if (tab === 'journal' && sub && sub !== 'scavenging' && sub !== 'engineering') this.ui.journalTab = sub;
        this.dirty = true;
        this.render();
        byId('panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      setUi: (patch) => {
        this.ui = { ...this.ui, ...patch };
        this.dirty = true;
      },
    };
  }

  private start(fn: () => ReturnType<typeof startScavenging>, msg: string): void {
    const r = fn();
    this.absorb(r.tick, true);
    if (r.ok) {
      this.state = r.tick.state;
      this.pushLog({ kind: 'info', text: msg });
    } else {
      this.toast({ kind: 'warn', title: 'Not yet', body: r.reason });
    }
    this.save();
    this.dirty = true;
  }

  private stop(): void {
    this.absorb(stopActivity(this.state, Date.now()), true);
    this.state = { ...this.state, activity: null };
    this.pushLog({ kind: 'info', text: 'You stop and catch your breath.' });
    this.save();
    this.dirty = true;
  }

  private repair(id: RepairId): void {
    const r = performRepair(this.state, id, Date.now());
    this.absorb(r.settled, true);
    this.state = r.state;
    if (r.ok) {
      this.pushLog({ kind: 'achievement', text: `${REPAIRS[id].name} restored.` });
      this.toast({ kind: 'achievement', title: `${REPAIRS[id].name} restored`, body: REPAIRS[id].benefit });
      for (const a of r.progression.achievements) {
        const def = ACHIEVEMENTS.find((x) => x.id === a);
        if (def) this.toast({ kind: 'achievement', title: 'Feat earned', body: def.name });
      }
      // Story beats tied to repairs open straight away; they're the payoff.
      const beat = r.progression.dialogues[0];
      if (beat) window.setTimeout(() => this.openDialogue(beat), 900);
      this.flashScene();
    }
    this.save();
    this.dirty = true;
  }

  // ---------- rendering ----------

  private render(): void {
    this.dirty = false;
    const ctx = { state: this.state, ui: this.ui, log: this.log, act: this.actions };
    const view =
      this.ui.tab === 'station'
        ? stationView(ctx)
        : this.ui.tab === 'skills'
          ? skillsView(ctx)
          : this.ui.tab === 'train'
            ? trainView(ctx)
            : this.ui.tab === 'satchel'
              ? satchelView(ctx)
              : journalView(ctx);
    byId('panel').replaceChildren(view);
    this.renderChrome();
  }

  private renderChrome(): void {
    // Tab bar state and badges.
    const unread = unreadDialogues(this.state).length;
    const readyRepairs = REPAIR_IDS.filter((id) => repairBlockers(this.state, id).length === 0).length;
    for (const btn of document.querySelectorAll<HTMLButtonElement>('#tabbar button')) {
      const tab = btn.dataset.tab as Tab;
      btn.classList.toggle('active', tab === this.ui.tab);
      btn.setAttribute('aria-current', tab === this.ui.tab ? 'page' : 'false');
      const badge = btn.querySelector('.badge');
      const n = tab === 'station' ? unread : tab === 'train' ? readyRepairs : 0;
      if (badge) {
        badge.textContent = n > 0 ? String(n) : '';
        badge.classList.toggle('show', n > 0);
      }
    }
    // Now-playing bar.
    const a = this.state.activity;
    byId('now-label').textContent = activityLabel(this.state);
    byId('nowbar').classList.toggle('idle', !a);
    const stop = byId<HTMLButtonElement>('now-stop');
    stop.hidden = !a;
    const lvl = a ? (a.kind === 'scavenge' ? `Scav ${skillLevel(this.state, 'scavenging')}` : `Eng ${skillLevel(this.state, 'engineering')}`) : '';
    byId('now-level').textContent = lvl;

    // Scene caption.
    const obj = objectiveStatus(this.state);
    byId('scene-caption').textContent = this.caption(obj.current?.title ?? null);
  }

  private caption(goal: string | null): string {
    const s = this.state;
    if (s.repairs.boiler) return 'No. 9 breathes. The cyan signal holds steady, waiting.';
    const a = s.activity;
    if (a?.kind === 'craft') return 'Hammer ringing on the footplate, sparks hissing out in the rain.';
    if (a?.kind === 'scavenge') {
      if (a.locationId === 'signalCabinet') return 'Relays tick in the dark cabinet. The cyan light hums overhead.';
      if (a.locationId === 'maintenanceShed') return 'Tobin’s shed smells of tar and oak. Every tool has its outline.';
      return 'Lantern low, you sift the wreckage along the rain-soaked platform.';
    }
    return goal ? `Next: ${goal}` : 'Rain on the canopy. The kilns glow beyond the town.';
  }

  private sceneState(): SceneState {
    const s = this.state;
    const a = s.activity;
    let spot: FigureSpot = 'idle';
    if (a?.kind === 'craft') spot = 'engine';
    else if (a?.kind === 'scavenge') spot = a.locationId === 'derelictPlatform' ? 'platform' : a.locationId === 'signalCabinet' ? 'cabinet' : 'shed';
    return {
      repairs: s.repairs,
      spot,
      working: a !== null,
      shedOpen: 'shedKey' in s.discoveries && skillLevel(s, 'scavenging') >= LOCATIONS.maintenanceShed.levelRequired,
      cabinetOpen: s.repairs.fireboxDoor,
      maraHere: s.dialogues.unlocked.includes('maraIntro'),
      tobinHere: s.dialogues.unlocked.includes('tobinIntro'),
    };
  }

  private flashScene(): void {
    const el = byId('scene-wrap');
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  private pushLog(e: LogEntry): void {
    this.log = [e, ...this.log].slice(0, LOG_MAX);
    if (this.ui.tab === 'station') this.dirty = true;
  }

  // ---------- chrome ----------

  private buildTabbar(): void {
    byId('tabbar').replaceChildren(
      ...TABS.map(([id, label]) =>
        h(
          'button',
          { attrs: { type: 'button' }, data: { tab: id }, on: { click: () => this.actions.go(id) } },
          img(tabIconUrl(id), 'tab-icon'),
          h('span', { text: label }),
          h('span', { class: 'badge' }),
        ),
      ),
    );
    byId('now-stop').addEventListener('click', () => this.stop());
    byId('nowbar-main').addEventListener('click', () => {
      const a = this.state.activity;
      this.actions.go('skills', a?.kind === 'craft' ? 'engineering' : 'scavenging');
    });
  }

  private bindGlobal(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.settleAndSave();
      else this.onTick();
    });
    window.addEventListener('pagehide', () => this.settleAndSave());
    window.addEventListener('beforeunload', () => this.settleAndSave());
    byId('reset').addEventListener('click', () => {
      if (!window.confirm('Erase all progress in Ashvale and start over? This cannot be undone.')) return;
      clearSave();
      this.state = createInitialState(Date.now(), newSeed());
      this.log = [];
      this.save();
      this.dirty = true;
      this.showOnboarding();
    });
    byId('sheet-backdrop').addEventListener('click', () => this.closeSheet());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeSheet();
    });
  }

  // ---------- toasts ----------

  private toast(t: Toast): void {
    this.toastQueue.push(t);
    this.flushToasts();
  }

  private flushToasts(): void {
    const box = byId('toasts');
    while (this.toastsShown < 3 && this.toastQueue.length > 0) {
      const t = this.toastQueue.shift();
      if (!t) break;
      this.toastsShown++;
      const el = h(
        'button',
        { class: `toast toast-${t.kind}`, attrs: { type: 'button' } },
        t.icon ? img(t.icon, t.kind === 'talk' ? 'portrait xs' : 'px-icon') : null,
        h('span', { class: 'toast-text' }, h('strong', { text: t.title }), t.body ? h('span', { text: t.body }) : null),
      );
      const done = (): void => {
        if (!el.isConnected) return;
        el.classList.add('out');
        window.setTimeout(() => {
          el.remove();
          this.toastsShown--;
          this.flushToasts();
        }, 250);
      };
      el.addEventListener('click', () => {
        t.onTap?.();
        done();
      });
      box.appendChild(el);
      window.setTimeout(done, t.kind === 'info' || t.kind === 'warn' ? 3200 : 4200);
    }
  }

  // ---------- sheets ----------

  private openSheet(content: HTMLElement, label: string): void {
    const sheet = byId('sheet');
    byId('sheet-body').replaceChildren(content);
    sheet.setAttribute('aria-label', label);
    sheet.hidden = false;
    requestAnimationFrame(() => sheet.classList.add('open'));
    const focus = sheet.querySelector<HTMLElement>('button');
    focus?.focus({ preventScroll: true });
  }

  private closeSheet(): void {
    const sheet = byId('sheet');
    if (sheet.hidden) return;
    sheet.classList.remove('open');
    window.setTimeout(() => {
      sheet.hidden = true;
    }, 200);
  }

  private openItem(id: ItemId): void {
    const def = ITEMS[id];
    const known = (this.state.stats.obtained[id] ?? 0) > 0 || this.state.inventory[id] > 0;
    const sources = itemSources(id);
    const uses = itemUses(id);
    this.openSheet(
      h(
        'div',
        { class: `item-sheet ${rarityClass(id)}` },
        h(
          'div',
          { class: 'row gap' },
          img(itemIconUrl(id), `px-icon xl ${known ? '' : 'silhouette'}`),
          h(
            'div',
            null,
            h('p', { class: 'eyebrow', text: `${def.rarity} ${def.kind}` }),
            h('h2', { text: known ? def.name : 'Unknown item' }),
            h('p', { class: 'mono small', text: `In satchel: ${this.state.inventory[id].toLocaleString()}` }),
          ),
        ),
        h('p', { class: 'desc', text: known ? def.description : 'You haven’t found one of these yet.' }),
        sources.length ? [h('h4', { text: 'Found at' }), h('ul', { class: 'plain' }, sources.map((s) => h('li', { text: s })))] : null,
        uses.length ? [h('h4', { text: 'Used for' }), h('ul', { class: 'plain' }, uses.map((s) => h('li', { text: s })))] : null,
        h('button', { class: 'btn btn-secondary', text: 'Close', attrs: { type: 'button' }, on: { click: () => this.closeSheet() } }),
      ),
      def.name,
    );
  }

  private openDiscovery(id: string): void {
    const d = DISCOVERY_BY_ID[id];
    if (!d || !(id in this.state.discoveries)) return;
    this.openSheet(
      h(
        'div',
        { class: 'disc-sheet' },
        h('p', { class: 'eyebrow cyan', text: `${CATEGORY_NAMES[d.category]} · ${LOCATIONS[d.location].name}` }),
        h('h2', { text: d.name }),
        h('p', { class: 'lore', text: d.text }),
        h('button', { class: 'btn btn-secondary', text: 'Close', attrs: { type: 'button' }, on: { click: () => this.closeSheet() } }),
      ),
      d.name,
    );
  }

  private openDialogue(id: string): void {
    const d = DIALOGUE_BY_ID[id];
    if (!d) return;
    let i = 0;
    const body = h('div', { class: 'dialogue-body' });
    const next = h('button', { class: 'btn btn-primary', attrs: { type: 'button' } });
    const wrap = h('div', { class: `dialogue ${d.milestone ? 'milestone' : ''}` }, h('p', { class: 'eyebrow', text: d.title }), body, next);
    const show = (line: DialogueLine): void => {
      const who = line.speaker === 'you' ? null : CHARACTERS[line.speaker];
      body.replaceChildren(
        h(
          'div',
          { class: `line ${line.speaker === 'you' ? 'you' : ''}` },
          who ? img(portraitUrl(line.speaker as 'mara' | 'tobin'), 'portrait') : h('span', { class: 'you-mark', text: 'You' }),
          h('div', null, h('strong', { text: who ? who.name : 'You' }), h('p', { text: line.text })),
        ),
      );
      next.textContent = i < d.lines.length - 1 ? 'Continue' : 'Close';
    };
    next.addEventListener('click', () => {
      i++;
      const line = d.lines[i];
      if (line) show(line);
      else {
        this.state = markDialogueRead(this.state, id);
        this.save();
        this.dirty = true;
        this.closeSheet();
      }
    });
    const first = d.lines[0];
    if (first) show(first);
    this.openSheet(wrap, d.title);
  }

  // ---------- away summary and onboarding ----------

  private showAway(r: TickResult): void {
    this.absorb(r, false);
    const credited = r.elapsedMs - r.discardedMs;
    const items = ITEM_IDS.filter((id) => r.itemsGained[id] > 0);
    const spent = ITEM_IDS.filter((id) => r.itemsSpent[id] > 0);
    const verb = r.skill === 'engineering' ? 'worked at the engine' : 'kept searching';
    const content = h(
      'div',
      { class: 'away-sheet' },
      h('p', { class: 'eyebrow', text: 'While you were away' }),
      h('h2', { text: `You ${verb} for ${formatDuration(credited)}.` }),
      r.discardedMs > 0 ? h('p', { class: 'muted small', text: `You were gone ${formatDuration(r.elapsedMs)}; only the last 8 hours count.` }) : null,
      h(
        'ul',
        { class: 'away-list' },
        r.skill ? h('li', null, h('span', { text: `+${r.xpGained.toLocaleString()} ${SKILL_NAMES[r.skill]} XP` }), h('span', { class: 'muted', text: `${r.actions.toLocaleString()} actions` })) : null,
        r.levelUp ? h('li', { class: 'lvl' }, h('span', { text: `${SKILL_NAMES[r.levelUp.skill]} ${r.levelUp.from} → ${r.levelUp.to}` })) : null,
        items.map((id) => h('li', { class: rarityClass(id) }, img(itemIconUrl(id)), h('span', { text: `+${r.itemsGained[id].toLocaleString()} ${ITEMS[id].name}` }))),
        spent.map((id) => h('li', { class: 'spent' }, img(itemIconUrl(id)), h('span', { text: `−${r.itemsSpent[id].toLocaleString()} ${ITEMS[id].name}` }))),
        r.discoveries.map((id) => h('li', { class: 'disc-line' }, h('span', { text: `Journal: ${DISCOVERY_BY_ID[id]?.name ?? id}` }))),
        r.stopped ? h('li', { class: 'muted' }, h('span', { text: 'Crafting stopped when materials ran out.' })) : null,
      ),
      h('button', { class: 'btn btn-primary', text: 'Back to work', attrs: { type: 'button' }, on: { click: () => this.closeSheet() } }),
    );
    this.openSheet(content, 'While you were away');
  }

  private showOnboarding(): void {
    const steps = [
      { title: 'Welcome to Ashvale', text: 'A pottery town at the end of a closed line. Locomotive No. 9 has waited here, cold, for fifty years.' },
      { title: 'Scavenge', text: 'Search the station for scrap, coal and stranger things. Activities keep running for up to 8 hours while you’re away.' },
      { title: 'Engineer and restore', text: 'Turn materials into parts, then repair No. 9 piece by piece. Every repair shows on the engine — and changes what you can reach.' },
    ];
    let i = 0;
    const root = byId('onboarding');
    const render = (): void => {
      const s = steps[i];
      if (!s) return;
      root.replaceChildren(
        h(
          'div',
          { class: 'onb-card', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': s.title } },
          h('p', { class: 'eyebrow', text: `${i + 1} / ${steps.length}` }),
          h('h2', { text: s.title }),
          h('p', { text: s.text }),
          h(
            'div',
            { class: 'row gap' },
            h('button', { class: 'btn btn-secondary', text: 'Skip', attrs: { type: 'button' }, on: { click: finish } }),
            h('button', {
              class: 'btn btn-primary',
              text: i < steps.length - 1 ? 'Next' : 'Begin',
              attrs: { type: 'button' },
              on: {
                click: () => {
                  i++;
                  if (i < steps.length) render();
                  else finish();
                },
              },
            }),
          ),
        ),
      );
    };
    const finish = (): void => {
      root.hidden = true;
      this.state = completeOnboarding(this.state);
      this.save();
      this.dirty = true;
      if (unreadDialogues(this.state).includes('maraIntro')) window.setTimeout(() => this.openDialogue('maraIntro'), 300);
    };
    root.hidden = false;
    render();
  }
}

function rank(id: ItemId): number {
  return { common: 0, uncommon: 1, rare: 2 }[ITEMS[id].rarity];
}

export type { LocationId, RecipeId };
