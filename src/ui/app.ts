// The interface controller: owns timers, saving, the DOM and feedback.
// Every rule lives in the core; this file only calls it and shows results.

import { ITEMS, ITEM_IDS, type ItemId } from '../core/content/items';
import { CATEGORY_NAMES, CHARACTERS, DIALOGUE_BY_ID, DISCOVERY_BY_ID, ACHIEVEMENTS, type DialogueLine } from '../core/content/story';
import {
  LOCATIONS,
  PROJECTS,
  RECIPES,
  REPAIRS,
  SALVAGE,
  SKILL_NAMES,
  SKILL_SHORT,
  TOOL_IDS,
  TOOLS,
  TRAIN_PART_IDS,
  isTool,
  type SkillId,
  type ToolId,
  type TrainPartId,
} from '../core/content/world';
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
import { activitySkill, ownedTools, repairBlockers, skillLevel, toolAccess, type ActivitySpec } from '../core/rules';
import { deserialize, serialize } from '../core/save';
import { createInitialState, type GameState } from '../core/state';
import { backupCorruptSave, clearSave, readSave, writeSave } from '../platform/storage';
import { byId, formatDuration, h, img } from './dom';
import { HOTSPOTS, StationScene, type FigureSpot, type HotspotId, type SceneState } from './scene';
import { artUrl, MARKER_ART, SCENE_H, SCENE_W } from './art';
import { discoveryIconUrl, itemIconUrl, portraitUrl, tabIconUrl } from './sprites';
import {
  activityLabel,
  itemSources,
  itemUses,
  journalView,
  objectiveStatus,
  rarityClass,
  seen,
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
  private ui: UiState = { tab: 'station', skillTab: 'scavenging', recipeCat: 'parts', journalTab: 'discoveries', filter: 'all', sort: 'rarity' };
  private log: LogEntry[] = [];
  private dirty = true;
  private lastSaveAt = 0;
  private readonly scene: StationScene;
  private rareAt = 0;
  private readonly actions: Actions;
  private toastQueue: Toast[] = [];
  private toastsShown = 0;

  constructor() {
    this.scene = new StationScene(byId<HTMLCanvasElement>('scene'));
    this.actions = this.makeActions();
    const { state, notice } = this.load();
    this.state = state;
    this.buildTabbar();
    this.buildHotspots();
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
      return { state: loaded.state, notice: loaded.migratedFrom ? 'Your save was carried over to Ashvale 0.3.' : null };
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
      } else if (r.skill === 'research' && gained.length === 0) {
        this.pushLog({ kind: 'find', text: `Studied ${r.actions} page${r.actions === 1 ? '' : 's'}`, item: 'waterloggedNotes' });
      } else if (gained.length > 0) {
        const top = [...gained].sort((a, b) => rank(b) - rank(a))[0] as ItemId;
        const verb = r.skill === 'salvaging' ? (r.doubles > 0 ? 'Salvaged (double!)' : 'Salvaged') : 'Found';
        this.pushLog({ kind: 'find', text: `${verb} ${gained.map((id) => `${r.itemsGained[id]} ${ITEMS[id].name}`).join(', ')}`, item: top });
      }
      this.dirty = true;
    }
    // New tools go straight into an empty or weaker slot.
    const newTools = ITEM_IDS.filter((id): id is ToolId => isTool(id) && r.itemsGained[id] > 0);
    if (newTools.length > 0) {
      const eq = autoEquip(this.state, newTools, Date.now());
      this.state = eq.state;
      for (const t of eq.equipped) {
        this.pushLog({ kind: 'achievement', text: `Equipped ${ITEMS[t].name}` });
        if (feedback) this.toast({ kind: 'achievement', title: 'Tool equipped', body: `${ITEMS[t].name} \u00b7 ${TOOLS[t].bonusText}`, icon: itemIconUrl(t) });
      }
    }
    if (feedback) {
      if (r.rareFinds.length > 0) this.rareAt = performance.now();
      for (const id of r.rareFinds) {
        this.pushLog({ kind: 'rare', text: `Rare find: ${ITEMS[id].name}!`, item: id });
        this.toast({ kind: 'rare', title: 'Rare find', body: ITEMS[id].name, icon: itemIconUrl(id), onTap: () => this.openItem(id) });
      }
      for (const id of r.discoveries) {
        const d = DISCOVERY_BY_ID[id];
        if (!d) continue;
        this.pushLog({ kind: 'discovery', text: `Journal: ${d.name}` });
        this.toast({ kind: 'discovery', title: 'New discovery', body: d.name, icon: discoveryIconUrl(id), onTap: () => this.openDiscovery(id) });
      }
      if (r.completedProject) {
        const p = PROJECTS[r.completedProject];
        this.pushLog({ kind: 'discovery', text: `Research finished: ${p.name}` });
        this.toast({ kind: 'discovery', title: 'Research finished', body: p.unlockText, ...(p.discoveryRequired ? { icon: discoveryIconUrl(p.discoveryRequired) } : {}) });
        this.flashScene();
      }
      if (r.levelUp) {
        this.pushLog({ kind: 'level', text: `${SKILL_NAMES[r.levelUp.skill]} reached level ${r.levelUp.to}` });
        this.toast({ kind: 'level', title: 'Level up', body: `${SKILL_NAMES[r.levelUp.skill]} ${r.levelUp.to}` });
      }
      for (const id of r.achievements) {
        const a = ACHIEVEMENTS.find((x) => x.id === id);
        if (a) this.toast({ kind: 'achievement', title: 'Feat earned', body: a.reward ? `${a.name} \u00b7 ${a.reward.text}` : a.name });
      }
      for (const id of r.dialogues) {
        const d = DIALOGUE_BY_ID[id];
        if (d && id !== 'maraIntro') this.toast({ kind: 'talk', title: `${CHARACTERS[d.speaker].name} wants a word`, body: d.title, icon: portraitUrl(d.speaker, 'concerned'), onTap: () => this.openDialogue(id) });
      }
      if (r.stopped === 'outOfMaterials') {
        const what = r.skill === 'salvaging' ? 'Nothing left to salvage' : r.skill === 'research' ? 'Out of notes' : 'Out of materials';
        this.pushLog({ kind: 'info', text: `${what} \u2014 stopped.` });
        this.toast({ kind: 'warn', title: what, body: r.skill === 'research' ? 'Scavenge for more Waterlogged Notes.' : 'Scavenge for more, then start again.' });
      }
    }
    if (changed && (r.discoveries.length || r.dialogues.length || r.achievements.length || r.stopped || newTools.length)) this.dirty = true;
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
      start: (spec) => this.start(spec),
      stop: () => this.stop(),
      repair: (id) => this.repair(id),
      equip: (id) => this.equip(id),
      unequip: (skill) => this.unequip(skill),
      openTools: (skill) => this.openTools(skill),
      openItem: (id) => this.openItem(id),
      openDiscovery: (id) => this.openDiscovery(id),
      openDialogue: (id) => this.openDialogue(id),
      go: (tab, sub) => {
        this.ui = { ...this.ui, tab };
        if (tab === 'skills' && sub && (SKILL_NAMES as Record<string, string>)[sub]) this.ui.skillTab = sub as SkillId;
        if (tab === 'journal' && sub && !(SKILL_NAMES as Record<string, string>)[sub]) this.ui.journalTab = sub as UiState['journalTab'];
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

  private startMessage(spec: ActivitySpec): string {
    switch (spec.kind) {
      case 'scavenge':
        return `Searching the ${LOCATIONS[spec.locationId].name}.`;
      case 'craft':
        return `Crafting ${ITEMS[RECIPES[spec.recipeId].output].name}.`;
      case 'salvage':
        return `Breaking down the ${SALVAGE[spec.targetId].name}.`;
      case 'research':
        return `Studying ${PROJECTS[spec.projectId].name}.`;
    }
  }

  private start(spec: ActivitySpec): void {
    const r = startActivity(this.state, spec, Date.now());
    this.absorb(r.tick, true);
    if (r.ok) {
      this.state = r.tick.state;
      this.pushLog({ kind: 'info', text: this.startMessage(spec) });
    } else {
      this.toast({ kind: 'warn', title: 'Not yet', body: r.reason });
    }
    this.save();
    this.dirty = true;
  }

  private equip(id: ToolId): void {
    const r = equipTool(this.state, id, Date.now());
    this.absorb(r.settled, true);
    this.state = r.state;
    if (r.ok) this.toast({ kind: 'achievement', title: 'Tool equipped', body: `${ITEMS[id].name} \u00b7 ${TOOLS[id].bonusText}`, icon: itemIconUrl(id) });
    else this.toast({ kind: 'warn', title: 'Can\u2019t equip', body: r.reason });
    this.save();
    this.dirty = true;
    this.closeSheet();
  }

  private unequip(skill: SkillId): void {
    const r = unequipTool(this.state, skill, Date.now());
    this.absorb(r.settled, true);
    this.state = r.state;
    this.save();
    this.dirty = true;
    this.closeSheet();
  }

  private stop(): void {
    this.absorb(stopActivity(this.state, Date.now()), true);
    this.state = { ...this.state, activity: null };
    this.pushLog({ kind: 'info', text: 'You stop and catch your breath.' });
    this.save();
    this.dirty = true;
  }

  private repair(id: TrainPartId): void {
    const r = performRepair(this.state, id, Date.now());
    this.absorb(r.settled, true);
    this.state = r.state;
    if (r.ok) {
      const verb = REPAIRS[id].kind === 'repair' ? 'restored' : 'fitted';
      this.pushLog({ kind: 'achievement', text: `${REPAIRS[id].name} ${verb}.` });
      this.toast({ kind: 'achievement', title: `${REPAIRS[id].name} ${verb}`, body: REPAIRS[id].benefit });
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
    const readyRepairs = TRAIN_PART_IDS.filter((id) => repairBlockers(this.state, id).length === 0).length;
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
    const lvl = a ? `${SKILL_SHORT[activitySkill(a)]} ${skillLevel(this.state, activitySkill(a))}` : '';
    byId('now-level').textContent = lvl;

    // Scene caption.
    const obj = objectiveStatus(this.state);
    byId('scene-caption').textContent = this.caption(obj.current?.title ?? null);
  }

  private caption(goal: string | null): string {
    const s = this.state;
    const a = s.activity;
    if (s.repairs.signalReceiver) return 'The receiver pulses cyan with the signal. Two short, one long.';
    if (a?.kind === 'craft') return 'Hammer ringing on the footplate, sparks hissing out in the rain.';
    if (a?.kind === 'salvage') return 'Spanners and rust in the siding. Every wreck is somebody\u2019s spare parts.';
    if (a?.kind === 'research') return 'Notes drying by the lamp. The ink comes back, line by line.';
    if (a?.kind === 'scavenge') {
      if (a.locationId === 'signalCabinet') return 'Relays tick in the dark cabinet. The cyan light hums overhead.';
      if (a.locationId === 'maintenanceShed') return 'Tobin\u2019s shed smells of tar and oak. Every tool has its outline.';
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
      this.actions.go('skills', a ? activitySkill(a) : 'scavenging');
    });
  }

  private buildHotspots(): void {
    const wrap = byId('scene-wrap');
    for (const hs of HOTSPOTS) {
      const marker = MARKER_ART[hs.id];
      const btn = h(
        'button',
        {
          class: 'scene-hotspot',
          attrs: { type: 'button', 'aria-label': hs.label },
          data: { hotspot: hs.id },
          on: { click: () => this.onHotspot(hs.id) },
        },
        marker ? img(artUrl(marker), '') : null,
      );
      wrap.appendChild(btn);
    }
    this.positionHotspots();
    window.addEventListener('resize', () => this.positionHotspots());
  }

  /** Hotspots are positioned against the canvas box, not the caption below it. */
  private positionHotspots(): void {
    const canvas = byId('scene');
    const w = canvas.clientWidth;
    const hgt = canvas.clientHeight;
    for (const hs of HOTSPOTS) {
      const el = document.querySelector<HTMLElement>(`[data-hotspot="${hs.id}"]`);
      if (!el) continue;
      el.style.left = `${(hs.x / SCENE_W) * w}px`;
      el.style.top = `${(hs.y / SCENE_H) * hgt}px`;
      el.style.width = `${Math.max(44, (hs.w / SCENE_W) * w)}px`;
      el.style.height = `${Math.max(44, (hs.h / SCENE_H) * hgt)}px`;
    }
  }

  private onHotspot(id: HotspotId): void {
    if (id === 'train') this.actions.go('train');
    else if (id === 'salvage') this.actions.go('skills', 'salvaging');
    else this.actions.go('skills', 'scavenging');
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
    const known = seen(this.state, id);
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
        isTool(id) ? this.toolDetails(id) : null,
        sources.length ? [h('h4', { text: isTool(id) ? 'Made by' : 'Found at' }), h('ul', { class: 'plain' }, sources.map((s) => h('li', { text: s })))] : null,
        uses.length ? [h('h4', { text: 'Used for' }), h('ul', { class: 'plain' }, uses.map((s) => h('li', { text: s })))] : null,
        h('button', { class: 'btn btn-secondary', text: 'Close', attrs: { type: 'button' }, on: { click: () => this.closeSheet() } }),
      ),
      def.name,
    );
  }

  private toolDetails(id: ToolId): HTMLElement {
    const t = TOOLS[id];
    const equipped = this.state.equipment[t.skill] === id;
    const access = toolAccess(this.state, id);
    const owned = this.state.inventory[id] > 0;
    return h(
      'div',
      { class: 'tool-details' },
      h('p', { class: 'benefit', text: `${SKILL_NAMES[t.skill]} tool \u00b7 tier ${t.tier} \u00b7 ${t.bonusText}` }),
      h('p', { class: 'muted small', text: t.levelRequired > 1 ? `Equip at ${SKILL_NAMES[t.skill]} level ${t.levelRequired}.` : 'Can be equipped at any level.' }),
      equipped
        ? h('button', { class: 'btn btn-secondary', text: 'Unequip', attrs: { type: 'button' }, on: { click: () => this.unequip(t.skill) } })
        : owned
          ? h('button', { class: 'btn btn-primary', text: access.ok ? 'Equip' : access.reason, attrs: { type: 'button', disabled: !access.ok }, on: { click: () => this.equip(id) } })
          : null,
    );
  }

  private openTools(skill: SkillId): void {
    const tools = ownedTools(this.state, skill);
    const current = this.state.equipment[skill];
    this.openSheet(
      h(
        'div',
        { class: 'tools-sheet' },
        h('p', { class: 'eyebrow', text: 'Tool slot' }),
        h('h2', { text: SKILL_NAMES[skill] }),
        h(
          'ul',
          { class: 'tool-choices' },
          tools.map((t) => {
            const access = toolAccess(this.state, t);
            const isOn = current === t;
            return h(
              'li',
              { class: isOn ? 'on' : '' },
              img(itemIconUrl(t), 'px-icon'),
              h('span', { class: 'tool-text' }, h('strong', { text: ITEMS[t].name }), h('span', { class: 'small muted', text: `Tier ${TOOLS[t].tier} \u00b7 ${TOOLS[t].bonusText}` }), access.ok ? null : h('span', { class: 'small danger', text: access.reason })),
              isOn
                ? h('button', { class: 'btn-chip', text: 'Unequip', attrs: { type: 'button' }, on: { click: () => this.unequip(skill) } })
                : h('button', { class: 'btn-chip primary', text: 'Equip', attrs: { type: 'button', disabled: !access.ok }, on: { click: () => this.equip(t) } }),
            );
          }),
        ),
        h('p', { class: 'muted small', text: `Better tools come from Engineering \u2192 Tools. Some need a research blueprint first. ${TOOL_IDS.filter((t) => TOOLS[t].skill === skill).length} ${SKILL_NAMES[skill]} tools exist.` }),
        h('button', { class: 'btn btn-secondary', text: 'Close', attrs: { type: 'button' }, on: { click: () => this.closeSheet() } }),
      ),
      `${SKILL_NAMES[skill]} tools`,
    );
  }

  private openDiscovery(id: string): void {
    const d = DISCOVERY_BY_ID[id];
    if (!d || !(id in this.state.discoveries)) return;
    this.openSheet(
      h(
        'div',
        { class: 'disc-sheet' },
        img(discoveryIconUrl(id), 'px-icon xl'),
        h('p', { class: 'eyebrow cyan', text: `${CATEGORY_NAMES[d.category]} · ${LOCATIONS[d.location].name}` }),
        h('h2', { text: d.name }),
        h('p', { class: 'lore', text: d.text }),
        this.discoveryResearch(id),
        h('button', { class: 'btn btn-secondary', text: 'Close', attrs: { type: 'button' }, on: { click: () => this.closeSheet() } }),
      ),
      d.name,
    );
  }

  private discoveryResearch(id: string): HTMLElement | null {
    const pid = (Object.keys(PROJECTS) as (keyof typeof PROJECTS)[]).find((p) => PROJECTS[p].discoveryRequired === id);
    if (!pid) return null;
    const p = PROJECTS[pid];
    const done = this.state.research.done.includes(pid);
    return h(
      'div',
      { class: 'disc-research' },
      h('h4', { text: done ? 'Studied' : 'Can be studied' }),
      h('p', { class: done ? 'cyan small' : 'benefit small', text: `${p.name} \u2014 ${p.unlockText}` }),
      done
        ? null
        : h('button', {
            class: 'btn btn-secondary',
            text: 'Open in Railway Research',
            attrs: { type: 'button' },
            on: {
              click: () => {
                this.closeSheet();
                this.actions.go('skills', 'research');
              },
            },
          }),
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
          img(portraitUrl(line.speaker, line.mood ?? 'neutral'), 'portrait', who ? who.name : 'You'),
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
    const verb =
      r.skill === 'engineering' ? 'worked at the engine' : r.skill === 'salvaging' ? 'kept salvaging' : r.skill === 'research' ? 'kept studying' : 'kept searching';
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
        r.completedProject ? h('li', { class: 'disc-line' }, h('span', { text: `Research finished: ${PROJECTS[r.completedProject].name}` })) : null,
        r.doubles > 0 ? h('li', { class: 'muted' }, h('span', { text: `${r.doubles} double yields` })) : null,
        r.stopped === 'outOfMaterials' ? h('li', { class: 'muted' }, h('span', { text: 'Stopped when materials ran out.' })) : null,
      ),
      h('button', { class: 'btn btn-primary', text: 'Back to work', attrs: { type: 'button' }, on: { click: () => this.closeSheet() } }),
    );
    this.openSheet(content, 'While you were away');
  }

  private showOnboarding(): void {
    const steps = [
      { title: 'Welcome to Ashvale', text: 'A pottery town at the end of a closed line. Locomotive No. 9 has waited here, cold, for fifty years.' },
      { title: 'Scavenge', text: 'Search the station for scrap, coal and stranger things. Activities keep running for up to 8 hours while you’re away.' },
      { title: 'Four skills, one engine', text: 'Salvage wrecks for fittings, engineer parts and tools, and study what you find. Every repair shows on No. 9 \u2014 and changes what you can reach.' },
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

