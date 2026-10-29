import { describe, expect, it } from 'vitest';
import { advance } from '../src/core/activity';
import { DISCOVERIES, OBJECTIVES } from '../src/core/content/story';
import { LOCATIONS, RECIPE_IDS, RECIPES, REPAIR_IDS, REPAIRS } from '../src/core/content/world';
import { ITEMS, type ItemId } from '../src/core/content/items';
import { evaluate, markDialogueRead, startScavenging, unreadDialogues } from '../src/core/game';
import { locationAccess } from '../src/core/rules';
import { atLevel, fresh, HOUR, running, scavenging, T0 } from './helpers';

describe('unlock progression', () => {
  it('the platform is open from the start; the others are locked', () => {
    const s = fresh();
    expect(locationAccess(s, 'derelictPlatform').ok).toBe(true);
    expect(locationAccess(s, 'signalCabinet').ok).toBe(false);
    expect(locationAccess(s, 'maintenanceShed').ok).toBe(false);
  });

  it('the Signal Cabinet needs the Firebox Door and Scavenging 3', () => {
    const lit = fresh({ repairs: { ...fresh().repairs, fireboxDoor: true } });
    expect(locationAccess(lit, 'signalCabinet').ok).toBe(false);
    expect(locationAccess(atLevel(lit, 'scavenging', 3), 'signalCabinet').ok).toBe(true);
    expect(startScavenging(atLevel(fresh(), 'scavenging', 3), 'signalCabinet', T0).ok).toBe(false);
  });

  it('the Maintenance Shed needs the Shed Key and Scavenging 7', () => {
    const keyed = fresh({ discoveries: { shedKey: T0 } });
    expect(locationAccess(atLevel(keyed, 'scavenging', 6), 'maintenanceShed').ok).toBe(false);
    expect(locationAccess(atLevel(keyed, 'scavenging', 7), 'maintenanceShed').ok).toBe(true);
  });

  it('the Shed Key is guaranteed by the 30th cabinet search, so progress cannot stall', () => {
    const s = atLevel(fresh({ repairs: { ...fresh().repairs, fireboxDoor: true } }), 'scavenging', 3);
    const r = advance({ ...s, activity: scavenging('signalCabinet') }, T0 + LOCATIONS.signalCabinet.actionMs * 30);
    expect('shedKey' in r.state.discoveries).toBe(true);
  });

  it('every repair and recipe input can be obtained from a location or a recipe (no dead ends)', () => {
    const gatherable = new Set<ItemId>(Object.values(LOCATIONS).flatMap((l) => l.drops.map((d) => d.item)));
    const craftable = new Set<ItemId>(RECIPE_IDS.map((r) => RECIPES[r].output));
    const needed = [
      ...RECIPE_IDS.flatMap((r) => Object.keys(RECIPES[r].inputs)),
      ...REPAIR_IDS.flatMap((r) => Object.keys(REPAIRS[r].cost)),
    ] as ItemId[];
    for (const id of needed) expect(gatherable.has(id) || craftable.has(id), id).toBe(true);
    for (const id of Object.keys(ITEMS) as ItemId[]) expect(gatherable.has(id) || craftable.has(id), id).toBe(true);
  });
});

describe('discoveries', () => {
  it('each discovery is found at most once and stamped with a time', () => {
    const r = advance(running(scavenging()), T0 + 8 * HOUR);
    const platform = DISCOVERIES.filter((d) => d.location === 'derelictPlatform');
    const found = Object.keys(r.state.discoveries);
    expect(found.length).toBeGreaterThan(0);
    expect(new Set(r.discoveries).size).toBe(r.discoveries.length);
    for (const id of found) {
      expect(platform.some((d) => d.id === id)).toBe(true);
      expect(r.state.discoveries[id]).toBeGreaterThan(T0);
    }
  });

  it('the Torn Timetable is guaranteed by search 25', () => {
    const r = advance(running(scavenging()), T0 + 3000 * 25);
    expect('tornTimetable' in r.state.discoveries).toBe(true);
  });

  it('discoveries are deterministic for a given seed', () => {
    const a = advance(running(scavenging()), T0 + 2 * HOUR).state.discoveries;
    const b = advance(running(scavenging()), T0 + 2 * HOUR).state.discoveries;
    expect(a).toEqual(b);
  });
});

describe('story, achievements and objectives', () => {
  it('Mara introduces herself on a new game and a discovery unlocks her next line', () => {
    const first = evaluate(fresh(), T0);
    expect(first.dialogues).toEqual(['maraIntro']);
    const withTimetable = evaluate({ ...first.state, discoveries: { tornTimetable: T0 } }, T0);
    expect(withTimetable.dialogues).toContain('maraTimetable');
  });

  it('dialogues unlock once, and reading clears them from the unread list', () => {
    const s = evaluate(fresh(), T0).state;
    expect(evaluate(s, T0).dialogues).toEqual([]);
    expect(unreadDialogues(s)).toEqual(['maraIntro']);
    expect(unreadDialogues(markDialogueRead(s, 'maraIntro'))).toEqual([]);
  });

  it('achievements are awarded once', () => {
    const r = advance(running(scavenging()), T0 + 3000);
    const e1 = evaluate(r.state, T0 + 3000);
    expect(e1.achievements).toContain('firstSearch');
    expect(evaluate(e1.state, T0 + 3000).achievements).not.toContain('firstSearch');
  });

  it('a migrated player who already lit the firebox is not sent back to make plates', () => {
    const lit = fresh({ repairs: { ...fresh().repairs, fireboxDoor: true } });
    const plates = OBJECTIVES.find((o) => o.id === 'plates');
    expect(plates?.progress(lit)).toEqual([4, 4]);
  });

  it('objectives start incomplete and report progress', () => {
    const s = fresh();
    for (const o of OBJECTIVES) {
      const [cur, target] = o.progress(s);
      expect(cur).toBeLessThan(target);
    }
  });
});
