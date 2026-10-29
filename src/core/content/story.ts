// Ashvale's story: discoveries found while scavenging, the two people who
// still live here, what they say as No. 9 comes back to life, and the
// milestones that mark the way.

import type { GameState } from '../state';
import { levelForXp } from '../xp';
import type { LocationId } from './world';

// ---------- Discoveries ----------

export type DiscoveryCategory = 'document' | 'belonging' | 'mechanism' | 'clue' | 'history';

export const CATEGORY_NAMES: Record<DiscoveryCategory, string> = {
  document: 'Railway document',
  belonging: 'Lost belonging',
  mechanism: 'Strange mechanism',
  clue: 'Clue',
  history: 'Ashvale history',
};

export interface DiscoveryDef {
  id: string;
  name: string;
  category: DiscoveryCategory;
  location: LocationId;
  /** Chance per search while still unfound. */
  chance: number;
  /** Found for certain on this many searches at the location (keeps key items from stalling progress). */
  guaranteeAt?: number;
  text: string;
}

export const DISCOVERIES: DiscoveryDef[] = [
  {
    id: 'tornTimetable',
    name: 'Torn Timetable',
    category: 'document',
    location: 'derelictPlatform',
    chance: 0.02,
    guaranteeAt: 25,
    text: 'A winter timetable, pasted to the canopy and half eaten by damp. The last service reads “No. 9 — Ashvale to —”. The destination has been scratched out with something sharp, deliberately, many times.',
  },
  {
    id: 'kilnToken',
    name: 'Bottle Works Token',
    category: 'history',
    location: 'derelictPlatform',
    chance: 0.012,
    text: 'A brass pay token: “ASHVALE BOTTLE WORKS — ONE SHIFT.” Kiln workers spent these at the station tea room. Forty kilns once burned here day and night; the soot is still in the brickwork.',
  },
  {
    id: 'knittedMitten',
    name: 'Knitted Mitten',
    category: 'belonging',
    location: 'derelictPlatform',
    chance: 0.012,
    text: 'A child’s mitten in ash-grey wool, dry despite the rain. Initials are stitched inside the cuff: E.V.',
  },
  {
    id: 'stoppedWatch',
    name: 'Stopped Pocket Watch',
    category: 'mechanism',
    location: 'derelictPlatform',
    chance: 0.01,
    text: 'A railwayman’s watch, glass intact, stopped at 3:17. When you wind it, the hands spin forward and settle at 3:17 again.',
  },
  {
    id: 'signalLog',
    name: 'Signal Box Log',
    category: 'document',
    location: 'signalCabinet',
    chance: 0.025,
    guaranteeAt: 18,
    text: 'The final pages repeat one entry in steady handwriting: “03:17 — Signal shows CLEAR. No train booked. Lever not pulled.” The entries continue for years after the line closed.',
  },
  {
    id: 'shedKey',
    name: 'Shed Key',
    category: 'clue',
    location: 'signalCabinet',
    chance: 0.03,
    guaranteeAt: 30,
    text: 'A heavy brass key on a leather tag: “MAINT. SHED — return to T. Harrow.” The Maintenance Shed is open to you now.',
  },
  {
    id: 'hummingRelay',
    name: 'Humming Relay',
    category: 'mechanism',
    location: 'signalCabinet',
    chance: 0.01,
    text: 'A relay with its wires cut clean, humming anyway. Hold it to your ear and the hum has a rhythm — like wheels on rail joints, very far off.',
  },
  {
    id: 'stationPhoto',
    name: 'Faded Photograph',
    category: 'belonging',
    location: 'signalCabinet',
    chance: 0.012,
    text: 'Ashvale’s staff in front of No. 9, everyone squinting into sun. A young fireman grins in the cab. The driver’s face has been rubbed away by a thumb, over and over.',
  },
  {
    id: 'firemansLedger',
    name: 'Fireman’s Ledger',
    category: 'document',
    location: 'maintenanceShed',
    chance: 0.025,
    guaranteeAt: 20,
    text: '“Fired No. 9 for the last run. Driver E. Venn would not wait for the board — said the signal had already cleared for us. I saw red. Stopped at the yard limit. He walked on into the fog with the lamp. 03:17.” — T.H.',
  },
  {
    id: 'kilnPlans',
    name: 'Kiln Spur Plans',
    category: 'history',
    location: 'maintenanceShed',
    chance: 0.012,
    text: 'Survey drawings for a rail spur to the bottle kilns. A later hand has added a second line running off the edge of the paper, labelled only with a small cyan circle.',
  },
  {
    id: 'coldValve',
    name: 'The Cold Valve',
    category: 'mechanism',
    location: 'maintenanceShed',
    chance: 0.01,
    text: 'A steam valve frosted over in a warm shed. Every so often its wheel turns a quarter by itself, as if someone far away were testing the pressure.',
  },
  {
    id: 'cyanDisc',
    name: 'Cyan Signal Disc',
    category: 'clue',
    location: 'maintenanceShed',
    chance: 0.01,
    text: 'A spare signal lens of the same impossible cyan. Railway signals show red, yellow or green. Ashvale’s never should have shown this colour at all.',
  },
];

export const DISCOVERY_BY_ID: Record<string, DiscoveryDef> = Object.fromEntries(DISCOVERIES.map((d) => [d.id, d]));

// ---------- Characters and dialogue ----------

export type SpeakerId = 'mara' | 'tobin';

export interface CharacterDef {
  id: SpeakerId;
  name: string;
  role: string;
}

export const CHARACTERS: Record<SpeakerId, CharacterDef> = {
  mara: { id: 'mara', name: 'Mara Venn', role: 'Night signalwoman' },
  tobin: { id: 'tobin', name: 'Tobin Harrow', role: 'Retired fireman' },
};

export interface DialogueLine {
  speaker: SpeakerId | 'you';
  text: string;
}

export interface DialogueDef {
  id: string;
  title: string;
  speaker: SpeakerId;
  milestone?: boolean;
  when: (s: GameState) => boolean;
  lines: DialogueLine[];
}

const found = (s: GameState, id: string): boolean => id in s.discoveries;

export const DIALOGUES: DialogueDef[] = [
  {
    id: 'maraIntro',
    title: 'The night signalwoman',
    speaker: 'mara',
    when: () => true,
    lines: [
      { speaker: 'mara', text: 'You walked here? Nobody walks to Ashvale. The road ends at the kilns.' },
      { speaker: 'mara', text: 'I’m Mara. I keep the signal box lit. Habit, mostly — the line closed before I was born.' },
      { speaker: 'mara', text: 'That engine is No. 9. Last train out of Ashvale. Except it never left.' },
      { speaker: 'mara', text: 'And every night at 3:17 that far signal turns cyan. Not red, not green. Cyan.' },
      { speaker: 'you', text: 'What happens if No. 9 runs again?' },
      { speaker: 'mara', text: 'Find out for me. There’s scrap all along the platform — start with the firebox.' },
    ],
  },
  {
    id: 'maraTimetable',
    title: 'Ashvale to nowhere',
    speaker: 'mara',
    when: (s) => found(s, 'tornTimetable'),
    lines: [
      { speaker: 'mara', text: 'The winter timetable. I’ve tried to read that last line a hundred times.' },
      { speaker: 'mara', text: 'My grandfather drove that service. Edric Venn. He never came home and nobody would say where the line went.' },
    ],
  },
  {
    id: 'maraFirebox',
    title: 'First light',
    speaker: 'mara',
    when: (s) => s.repairs.fireboxDoor,
    lines: [
      { speaker: 'mara', text: 'She’s glowing. I haven’t seen a fire in that box my whole life.' },
      { speaker: 'mara', text: 'With that light you could get the lineside cabinet open. Grandad’s things are still in there, I think.' },
    ],
  },
  {
    id: 'maraShedKey',
    title: 'Return to T. Harrow',
    speaker: 'mara',
    when: (s) => found(s, 'shedKey'),
    lines: [
      { speaker: 'mara', text: 'T. Harrow — that’s Tobin. He was Grandad’s fireman. Still sleeps in the shed.' },
      { speaker: 'mara', text: 'He’ll grumble. Let him. Once you’re a better scavenger, he’ll let you into those racks.' },
    ],
  },
  {
    id: 'tobinIntro',
    title: 'The fireman',
    speaker: 'tobin',
    when: (s) => found(s, 'shedKey') && levelForXp(s.skills.scavenging.xp) >= 7,
    lines: [
      { speaker: 'tobin', text: 'That’s my key. Took you long enough.' },
      { speaker: 'tobin', text: 'Fifty years I’ve kept that oak dry. You want No. 9 to run, you’ll need it, and rivets, and patience.' },
      { speaker: 'tobin', text: 'Plate first. Then panels. Then the boiler. Don’t skip ahead — boilers remember.' },
    ],
  },
  {
    id: 'tobinHeadlamp',
    title: 'Where the fog stops',
    speaker: 'tobin',
    when: (s) => s.repairs.headlamp,
    lines: [
      { speaker: 'tobin', text: 'Look at that beam. Straight down the line, and it stops dead at the signal. Always has.' },
      { speaker: 'tobin', text: 'Light doesn’t stop. Fog doesn’t make walls. Remember that.' },
    ],
  },
  {
    id: 'maraPrism',
    title: 'Glass that shouldn’t exist',
    speaker: 'mara',
    when: (s) => (s.stats.obtained.cyanPrism ?? 0) > 0,
    lines: [
      { speaker: 'mara', text: 'Let me see that. It’s the signal’s colour exactly.' },
      { speaker: 'mara', text: 'I wrote to the glassworks once. They said no one ever made a cyan signal lens. Not anywhere.' },
    ],
  },
  {
    id: 'tobinLedger',
    title: 'The last run',
    speaker: 'tobin',
    when: (s) => found(s, 'firemansLedger'),
    lines: [
      { speaker: 'tobin', text: 'You read it, then. I saw red that night. I’ll swear it.' },
      { speaker: 'tobin', text: 'Edric saw cyan. Said the line had opened for us. I stopped her at the yard limit and he took the lamp and walked on.' },
      { speaker: 'tobin', text: 'I’ve been waiting for that signal to show me what he saw. Never has.' },
    ],
  },
  {
    id: 'maraDryCab',
    title: 'Out of the rain',
    speaker: 'mara',
    when: (s) => s.repairs.dryCab,
    lines: [
      { speaker: 'mara', text: 'A dry cab. I sat up there out of the rain tonight and wrote the log from the footplate.' },
      { speaker: 'mara', text: 'At 3:17 the hum came through the rail. I felt it in my teeth.' },
    ],
  },
  {
    id: 'tobinTender',
    title: 'Room for a town',
    speaker: 'tobin',
    when: (s) => s.repairs.reinforcedStorage,
    lines: [
      { speaker: 'tobin', text: 'Proper tender, that. Carry coal, tools, people if you had to.' },
      { speaker: 'tobin', text: 'A town is only the people who stay. Maybe a town can travel.' },
    ],
  },
  {
    id: 'finale',
    title: 'Chapter One: The Line Is Open',
    speaker: 'mara',
    milestone: true,
    when: (s) => s.repairs.boiler,
    lines: [
      { speaker: 'tobin', text: 'Pressure’s rising. Hear that? She’s breathing.' },
      { speaker: 'mara', text: 'Tobin. The signal.' },
      { speaker: 'tobin', text: '…It’s cyan. And it isn’t 3:17.' },
      { speaker: 'mara', text: 'It’s not waiting for the time anymore. It’s waiting for us.' },
      { speaker: 'you', text: 'Then No. 9 needs a crew.' },
      { speaker: 'tobin', text: 'Then she needs a driver. Fetch your coat. — End of Chapter One.' },
    ],
  },
];

export const DIALOGUE_BY_ID: Record<string, DialogueDef> = Object.fromEntries(DIALOGUES.map((d) => [d.id, d]));

// ---------- Achievements ----------

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  when: (s: GameState) => boolean;
}

const totalSearches = (s: GameState): number =>
  Object.values(s.stats.searches).reduce((a, b) => a + (b ?? 0), 0);

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'firstSearch', name: 'Lantern Lit', description: 'Search anywhere in Ashvale.', when: (s) => totalSearches(s) >= 1 },
  { id: 'firstCraft', name: 'Hammer and Anvil', description: 'Complete your first Engineering recipe.', when: (s) => s.stats.crafts >= 1 },
  { id: 'firstRare', name: 'Something Glinted', description: 'Find a rare item.', when: (s) => s.stats.rareFinds >= 1 },
  { id: 'firebox', name: 'Kindling', description: 'Repair the Firebox Door.', when: (s) => s.repairs.fireboxDoor },
  { id: 'allPlaces', name: 'Every Corner', description: 'Search all three places in Ashvale.', when: (s) => (s.stats.searches.maintenanceShed ?? 0) > 0 && (s.stats.searches.signalCabinet ?? 0) > 0 },
  { id: 'searches500', name: 'Night Shift', description: 'Search 500 times.', when: (s) => totalSearches(s) >= 500 },
  { id: 'crafts100', name: 'Steady Hands', description: 'Complete 100 Engineering recipes.', when: (s) => s.stats.crafts >= 100 },
  { id: 'journalHalf', name: 'Archivist', description: 'Record 6 discoveries in the journal.', when: (s) => Object.keys(s.discoveries).length >= 6 },
  { id: 'journalFull', name: 'Keeper of Ashvale', description: 'Record all 12 discoveries.', when: (s) => Object.keys(s.discoveries).length >= DISCOVERIES.length },
  { id: 'scav10', name: 'Sharp Eyes', description: 'Reach Scavenging level 10.', when: (s) => levelForXp(s.skills.scavenging.xp) >= 10 },
  { id: 'eng10', name: 'Fitter', description: 'Reach Engineering level 10.', when: (s) => levelForXp(s.skills.engineering.xp) >= 10 },
  { id: 'chapterOne', name: 'The Line Is Open', description: 'Restore No. 9’s boiler.', when: (s) => s.repairs.boiler },
];

// ---------- Chapter objectives ----------

export interface ObjectiveDef {
  id: string;
  title: string;
  hint: string;
  /** Returns [current, target] so the UI can show progress. */
  progress: (s: GameState) => [number, number];
}

const lvl = (s: GameState, skill: 'scavenging' | 'engineering'): number => levelForXp(s.skills[skill].xp);
const flag = (b: boolean): [number, number] => [b ? 1 : 0, 1];

export const OBJECTIVES: ObjectiveDef[] = [
  {
    id: 'search10',
    title: 'Search the Derelict Platform',
    hint: 'Skills → Scavenging → Derelict Platform. Searching continues while you’re away.',
    progress: (s) => [Math.min(10, s.stats.searches.derelictPlatform ?? 0), 10],
  },
  {
    id: 'plates',
    title: 'Hammer out 4 Iron Plates',
    hint: 'Skills → Engineering. Each plate takes 3 Scrap Iron.',
    progress: (s) => [Math.min(4, (s.stats.obtained.ironPlate ?? 0)), 4],
  },
  {
    id: 'firebox',
    title: 'Repair the Firebox Door',
    hint: 'Train tab. You’ll need a Brass Cog — a rare platform find.',
    progress: (s) => flag(s.repairs.fireboxDoor),
  },
  {
    id: 'cabinet',
    title: 'Reach Scavenging 3 and open the Signal Cabinet',
    hint: 'The cabinet holds relays, wire and stranger things.',
    progress: (s) => [Math.min(1, s.stats.searches.signalCabinet ?? 0), 1],
  },
  {
    id: 'headlamp',
    title: 'Restore the Headlamp',
    hint: 'Lenses from glass and coal, coils from copper wire, a relay from the cabinet.',
    progress: (s) => flag(s.repairs.headlamp),
  },
  {
    id: 'key',
    title: 'Find the Shed Key',
    hint: 'It’s somewhere in the Signal Cabinet.',
    progress: (s) => flag(found(s, 'shedKey')),
  },
  {
    id: 'shed',
    title: 'Reach Scavenging 7 and enter the Maintenance Shed',
    hint: 'Tobin keeps timber, rivets and gauges there.',
    progress: (s) => [Math.min(7, lvl(s, 'scavenging')), 7],
  },
  {
    id: 'dryCab',
    title: 'Mend the Dry Cab',
    hint: 'Timber Beams need Engineering 4.',
    progress: (s) => flag(s.repairs.dryCab),
  },
  {
    id: 'tender',
    title: 'Reinforce the Tender',
    hint: 'Riveted Panels need Engineering 6 and Steel Rivets from the shed.',
    progress: (s) => flag(s.repairs.reinforcedStorage),
  },
  {
    id: 'boiler',
    title: 'Rebuild the Boiler',
    hint: 'A Gauge Assembly, panels, fuel — and a Cyan Prism.',
    progress: (s) => flag(s.repairs.boiler),
  },
];
