// The interface layer. It owns timers and the DOM, and asks the pure core
// for every rule. No gameplay maths lives here.

import { LOCATIONS, REPAIRS, RESOURCE_IDS, RESOURCES, type LocationId, type RepairId } from '../core/data';
import type { Inventory } from '../core/inventory';
import { repairBlockers, performRepair } from '../core/repair';
import { deserialize, serialize } from '../core/save';
import {
  actionDurationMs,
  actionProgress,
  advance,
  startScavenging,
  stopScavenging,
  type AdvanceResult,
} from '../core/scavenging';
import { createInitialState, type GameState } from '../core/state';
import { newSeed } from '../core/rng';
import { levelForXp, levelProgress } from '../core/xp';
import { backupCorruptSave, clearSave, readSave, writeSave } from '../platform/storage';
import { iconUrl } from './sprites';
import { TrainScene } from './scene';

const LOCATION: LocationId = 'derelictPlatform';
const REPAIR: RepairId = 'fireboxDoor';
const TICK_MS = 250;
const AUTOSAVE_MS = 15_000;
/** Gaps longer than this (tab asleep, app closed) get a "while you were away" summary. */
const AWAY_THRESHOLD_MS = 60_000;
const LOG_LINES = 4;

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (totalMin > 0) return `${totalMin}m`;
  return `${Math.max(1, Math.round(ms / 1000))}s`;
}

function icon(id: (typeof RESOURCE_IDS)[number], cls = 'icon'): HTMLImageElement {
  const img = document.createElement('img');
  img.className = cls;
  img.src = iconUrl(id);
  img.alt = '';
  img.width = 10;
  img.height = 10;
  return img;
}

export class App {
  private state: GameState;
  private readonly scene: TrainScene;
  private readonly invCounts = new Map<string, HTMLElement>();
  private log: { text: string; cls?: string }[] = [];
  private lastSaveAt = 0;

  constructor() {
    this.scene = new TrainScene($('scene') as HTMLCanvasElement);
    this.state = this.load();
    this.buildStaticUi();
    this.bindEvents();

    // Catch up on time spent away, then save at once so the same
    // offline window can never be credited twice.
    const result = advance(this.state, Date.now());
    this.state = result.state;
    if (result.elapsedMs >= AWAY_THRESHOLD_MS) this.showAway(result);
    this.save();

    this.renderAll();
    window.setInterval(() => this.tick(), TICK_MS);
    window.setInterval(() => this.save(), AUTOSAVE_MS);
    requestAnimationFrame((t) => this.frame(t));
  }

  // ---------- persistence ----------

  private load(): GameState {
    const now = Date.now();
    const raw = readSave();
    const loaded = deserialize(raw, now, newSeed());
    if (loaded.status === 'ok') return loaded.state;
    if (loaded.status === 'corrupt' && raw) {
      backupCorruptSave(raw);
      console.warn(`Save could not be read (${loaded.reason}); starting fresh. A copy was kept.`);
    }
    return createInitialState(now, newSeed());
  }

  private save(): void {
    const now = Date.now();
    const ok = writeSave(serialize(this.state, now));
    this.lastSaveAt = now;
    const status = $('save-status');
    status.textContent = ok ? 'saved' : 'save failed';
    status.style.opacity = '1';
    window.setTimeout(() => {
      if (Date.now() - this.lastSaveAt >= 1400) status.style.opacity = '0';
    }, 1500);
  }

  /** Settle progress to now and save — used whenever the page may go away. */
  private settleAndSave(): void {
    this.applyAdvance(advance(this.state, Date.now()));
    this.save();
  }

  // ---------- loop ----------

  private tick(): void {
    const result = advance(this.state, Date.now());
    if (result.elapsedMs >= AWAY_THRESHOLD_MS && result.actions > 0) {
      // The tab slept (phone locked, app switched). Treat it like offline time.
      this.state = result.state;
      this.showAway(result);
      this.save();
      this.renderAll();
      return;
    }
    this.applyAdvance(result);
  }

  private applyAdvance(result: AdvanceResult): void {
    this.state = result.state;
    if (result.actions === 0) return;
    const found = RESOURCE_IDS.filter((id) => result.itemsGained[id] > 0)
      .map((id) => `${result.itemsGained[id]} ${RESOURCES[id].name}`)
      .join(', ');
    this.pushLog(found ? `Found ${found}` : 'Nothing worth keeping');
    if (result.levelAfter > result.levelBefore) {
      this.pushLog(`Scavenging reached level ${result.levelAfter}`, 'level-up');
    }
    this.renderAll(result.itemsGained);
  }

  private frame(t: number): void {
    const now = Date.now();
    const running = this.state.activity !== null;
    const progress = actionProgress(this.state, now);
    ($('action-fill') as HTMLElement).style.width = `${(progress * 100).toFixed(1)}%`;
    if (running) {
      const duration = actionDurationMs(this.state, LOCATION);
      $('action-time').textContent = `${((duration * (1 - progress)) / 1000).toFixed(1)}s`;
    }
    this.scene.draw({ scavenging: running, fireboxRepaired: this.state.repairs.fireboxDoor }, t);
    requestAnimationFrame((next) => this.frame(next));
  }

  // ---------- actions ----------

  private toggle(): void {
    const now = Date.now();
    if (this.state.activity) {
      const result = stopScavenging(this.state, now);
      this.applyAdvance(result);
      this.pushLog('You stop and catch your breath.');
    } else {
      this.state = startScavenging(this.state, LOCATION, now);
      this.pushLog('You lift the lantern and start searching.');
    }
    this.save();
    this.renderAll();
  }

  private repair(): void {
    const result = performRepair(this.state, REPAIR, Date.now());
    this.state = result.state;
    if (result.ok) {
      this.pushLog(`${REPAIRS[REPAIR].name} restored.`, 'level-up');
      this.save();
    }
    this.renderAll();
  }

  private reset(): void {
    if (!window.confirm('Erase all progress and start over? This cannot be undone.')) return;
    clearSave();
    this.state = createInitialState(Date.now(), newSeed());
    this.log = [];
    this.save();
    this.renderAll();
  }

  private bindEvents(): void {
    $('toggle').addEventListener('click', () => this.toggle());
    $('repair-btn').addEventListener('click', () => this.repair());
    $('reset').addEventListener('click', () => this.reset());

    // iOS Safari does not reliably fire beforeunload, so save on every
    // signal that the page may be frozen or discarded.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.settleAndSave();
      else this.tick();
    });
    window.addEventListener('pagehide', () => this.settleAndSave());
    window.addEventListener('beforeunload', () => this.settleAndSave());
  }

  // ---------- rendering ----------

  private pushLog(text: string, cls?: string): void {
    this.log = [cls ? { text, cls } : { text }, ...this.log].slice(0, LOG_LINES);
    const ol = $('log');
    ol.replaceChildren(
      ...this.log.map((entry) => {
        const li = document.createElement('li');
        li.textContent = entry.text;
        if (entry.cls) li.className = entry.cls;
        return li;
      }),
    );
  }

  private buildStaticUi(): void {
    const loc = LOCATIONS[LOCATION];
    $('location-name').textContent = loc.name;
    $('location-desc').textContent = loc.description;
    $('drop-list').replaceChildren(
      ...loc.drops.map((drop) => {
        const li = document.createElement('li');
        const chance = drop.chance >= 1 ? 'always' : `${Math.round(drop.chance * 100)}%`;
        li.append(icon(drop.resource), `${RESOURCES[drop.resource].name} · ${chance}`);
        return li;
      }),
    );

    $('inventory').replaceChildren(
      ...RESOURCE_IDS.map((id) => {
        const li = document.createElement('li');
        const count = document.createElement('span');
        count.className = 'inv-count';
        const name = document.createElement('span');
        name.className = 'inv-name';
        name.textContent = RESOURCES[id].name;
        li.title = RESOURCES[id].description;
        li.append(icon(id), count, name);
        this.invCounts.set(id, count);
        return li;
      }),
    );

    const def = REPAIRS[REPAIR];
    $('repair-name').textContent = def.name;
    $('repair-desc').textContent = def.description;
  }

  private renderAll(gained?: Inventory): void {
    this.renderSkill();
    this.renderInventory(gained);
    this.renderRepair();
    this.renderActivity();
  }

  private renderSkill(): void {
    const xp = this.state.skills.scavenging.xp;
    const p = levelProgress(xp);
    $('skill-level').textContent = String(p.level);
    $('xp-fill').style.width = `${(p.fraction * 100).toFixed(1)}%`;
    $('xp-bar').setAttribute('aria-valuenow', String(Math.round(p.fraction * 100)));
    $('xp-text').textContent = p.isMax ? `${xp.toLocaleString()} XP · max level` : `${p.current} / ${p.needed} XP`;
    $('search-count').textContent = `${this.state.stats.totalSearches.toLocaleString()} searches`;
  }

  private renderInventory(gained?: Inventory): void {
    for (const id of RESOURCE_IDS) {
      const el = this.invCounts.get(id);
      if (!el) continue;
      el.textContent = this.state.inventory[id].toLocaleString();
      if (gained && gained[id] > 0) {
        el.classList.remove('bump');
        void el.offsetWidth; // restart the animation
        el.classList.add('bump');
      }
    }
  }

  private renderRepair(): void {
    const def = REPAIRS[REPAIR];
    const done = this.state.repairs[REPAIR];
    const level = levelForXp(this.state.skills.scavenging.xp);

    const reqs: HTMLLIElement[] = [];
    const levelLi = document.createElement('li');
    levelLi.className = level >= def.levelRequired ? 'met' : '';
    const dot = document.createElement('span');
    dot.className = 'req-dot';
    dot.textContent = 'Lv';
    const have = document.createElement('span');
    have.className = 'req-have';
    have.textContent = `${Math.min(level, def.levelRequired)} / ${def.levelRequired}`;
    levelLi.append(dot, 'Scavenging level', have);
    reqs.push(levelLi);

    for (const id of RESOURCE_IDS) {
      const need = def.cost[id];
      if (!need) continue;
      const owned = this.state.inventory[id];
      const li = document.createElement('li');
      li.className = owned >= need ? 'met' : '';
      const h = document.createElement('span');
      h.className = 'req-have';
      h.textContent = `${Math.min(owned, need)} / ${need}`;
      li.append(icon(id), RESOURCES[id].name, h);
      reqs.push(li);
    }

    const btn = $('repair-btn') as HTMLButtonElement;
    const doneEl = $('repair-done');
    if (done) {
      $('repair-reqs').replaceChildren();
      btn.hidden = true;
      doneEl.hidden = false;
      doneEl.textContent = def.rewardText;
      $('repair-desc').textContent = 'Patched, sealed and burning low.';
      return;
    }
    $('repair-reqs').replaceChildren(...reqs);
    const blockers = repairBlockers(this.state, REPAIR);
    btn.disabled = blockers.length > 0;
    btn.textContent = blockers.includes('levelTooLow')
      ? `Reach level ${def.levelRequired} to repair`
      : blockers.includes('missingResources')
        ? 'Not enough materials'
        : `Repair the ${def.name}`;
  }

  private renderActivity(): void {
    const running = this.state.activity !== null;
    const btn = $('toggle') as HTMLButtonElement;
    btn.textContent = running ? 'Stop scavenging' : 'Start scavenging';
    btn.dataset.active = String(running);
    btn.setAttribute('aria-pressed', String(running));
    $('action-text').textContent = running ? 'Searching the platform…' : 'Idle';
    if (!running) $('action-time').textContent = '';
    $('scene-caption').textContent = this.state.repairs.fireboxDoor
      ? 'No. 9 breathes again. Somewhere down the line, a signal changes.'
      : running
        ? 'Lantern low, you sift the wreckage by the tracks.'
        : 'Locomotive No. 9 sits cold at the end of the line.';
  }

  private showAway(result: AdvanceResult): void {
    const dialog = $('away') as HTMLDialogElement;
    const credited = result.elapsedMs - result.discardedMs;
    $('away-time').textContent = `You searched for ${formatDuration(credited)} while you were gone.`;
    const items: HTMLLIElement[] = [];
    const xpLi = document.createElement('li');
    xpLi.textContent = `+${result.xpGained.toLocaleString()} Scavenging XP (${result.actions.toLocaleString()} searches)`;
    items.push(xpLi);
    if (result.levelAfter > result.levelBefore) {
      const li = document.createElement('li');
      li.textContent = `Level ${result.levelBefore} → ${result.levelAfter}`;
      items.push(li);
    }
    for (const id of RESOURCE_IDS) {
      if (result.itemsGained[id] <= 0) continue;
      const li = document.createElement('li');
      li.append(icon(id), `+${result.itemsGained[id].toLocaleString()} ${RESOURCES[id].name}`);
      items.push(li);
    }
    $('away-gains').replaceChildren(...items);
    const cap = $('away-cap');
    cap.hidden = result.discardedMs <= 0;
    cap.textContent = `You were away ${formatDuration(result.elapsedMs)}; only the last 8 hours count.`;
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
  }
}
