import { describe, expect, it } from 'vitest';
import { advance } from '../src/core/activity';
import { PROJECTS } from '../src/core/content/world';
import { evaluate, startCrafting, startResearch } from '../src/core/game';
import { actionDuration, modifiers, projectProgress, recipeUnlocked, repairBlockers, researchAccess } from '../src/core/rules';
import { atLevel, fresh, HOUR, MIN, T0, withItems } from './helpers';

const survey = PROJECTS.platformSurvey;

describe('Railway Research', () => {
  it('projects need their discovery first', () => {
    const s = withItems(fresh(), { waterloggedNotes: 20 });
    expect(researchAccess(s, 'platformSurvey').ok).toBe(false);
    expect(researchAccess({ ...s, discoveries: { tornTimetable: T0 } }, 'platformSurvey').ok).toBe(true);
  });

  it('a project consumes notes per action, completes, applies its bonus and stops', () => {
    const s = withItems(fresh({ discoveries: { tornTimetable: T0 } }), { waterloggedNotes: 30 });
    const r = startResearch(s, 'platformSurvey', T0);
    if (!r.ok) throw new Error(r.reason);
    const after = advance(r.tick.state, T0 + HOUR);
    expect(after.actions).toBe(survey.actions);
    expect(after.completedProject).toBe('platformSurvey');
    expect(after.stopped).toBe('completed');
    expect(after.state.activity).toBeNull();
    expect(after.state.inventory.waterloggedNotes).toBe(30 - (survey.actions ?? 0));
    expect(after.state.research.done).toEqual(['platformSurvey']);
    expect(after.state.research.progress.platformSurvey).toBeUndefined();
    expect(modifiers(after.state).locationSpeed.derelictPlatform).toBeCloseTo(0.2);
    expect(actionDuration(after.state, { kind: 'scavenge', locationId: 'derelictPlatform' })).toBe(2500);
  });

  it('partial progress is kept when notes run out, and resumes later', () => {
    const s = withItems(fresh({ discoveries: { tornTimetable: T0 } }), { waterloggedNotes: 4 });
    const r = startResearch(s, 'platformSurvey', T0);
    if (!r.ok) throw new Error(r.reason);
    const mid = advance(r.tick.state, T0 + HOUR);
    expect(mid.stopped).toBe('outOfMaterials');
    expect(projectProgress(mid.state, 'platformSurvey')).toEqual([4, survey.actions]);
    const refilled = withItems(mid.state, { waterloggedNotes: 20 });
    const r2 = startResearch(refilled, 'platformSurvey', T0 + HOUR);
    if (!r2.ok) throw new Error(r2.reason);
    const done = advance(r2.tick.state, T0 + 2 * HOUR);
    expect(done.actions).toBe((survey.actions ?? 0) - 4);
    expect(done.state.research.done).toContain('platformSurvey');
  });

  it('a finished project cannot be studied again', () => {
    const s = withItems(fresh({ discoveries: { tornTimetable: T0 } }), { waterloggedNotes: 30 });
    const done = { ...s, research: { progress: {}, done: ['platformSurvey' as const] } };
    expect(researchAccess(done, 'platformSurvey').ok).toBe(false);
  });

  it('the archive catalogue is repeatable and never completes', () => {
    const s = withItems(fresh(), { waterloggedNotes: 500 });
    const r = startResearch(s, 'catalogue', T0);
    if (!r.ok) throw new Error(r.reason);
    const after = advance(r.tick.state, T0 + 10 * MIN);
    expect(after.completedProject).toBeNull();
    expect(after.actions).toBe(Math.floor((10 * MIN) / PROJECTS.catalogue.actionMs));
    expect(after.state.research.done).toEqual([]);
  });

  it('blueprints unlock tool recipes', () => {
    const s = atLevel(withItems(fresh(), { polishedLens: 2, brassFitting: 3, copperCoil: 1 }), 'engineering', 6);
    expect(recipeUnlocked(s, 'brassLantern').ok).toBe(false);
    expect(startCrafting(s, 'brassLantern', T0).ok).toBe(false);
    const studied = { ...s, research: { progress: {}, done: ['signalDiagrams' as const] } };
    expect(recipeUnlocked(studied, 'brassLantern').ok).toBe(true);
    expect(startCrafting(studied, 'brassLantern', T0).ok).toBe(true);
  });

  it('the boiler needs The Fireman’s Methods', () => {
    const s = atLevel(withItems(fresh(), { gaugeAssembly: 2, patchPanel: 4, fuelBrick: 10, cyanPrism: 1, spring: 4 }), 'engineering', 12);
    expect(repairBlockers(s, 'boiler')).toEqual(['needsResearch']);
    expect(repairBlockers({ ...s, research: { progress: {}, done: ['firemansMethods'] } }, 'boiler')).toEqual([]);
  });

  it('Bottle Works Records make Fuel Bricks come out in pairs', () => {
    const s = withItems(fresh(), { coalLump: 9 });
    const studied = { ...s, research: { progress: {}, done: ['kilnRecords' as const] } };
    const r = startCrafting(studied, 'fuelBrick', T0);
    if (!r.ok) throw new Error(r.reason);
    const after = advance(r.tick.state, T0 + HOUR);
    expect(after.actions).toBe(3);
    expect(after.state.inventory.fuelBrick).toBe(6);
  });

  it('finishing the Lost Property Ledger unlocks Mara’s story', () => {
    const s = { ...fresh(), research: { progress: {}, done: ['lostProperty' as const] } };
    expect(evaluate(s, T0).dialogues).toContain('maraMitten');
  });
});
