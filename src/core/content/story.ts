// Ashvale's story: discoveries found while scavenging, the two people who
// still live here, what they say as No. 9 comes back to life, and the
// milestones that mark the way.

import type { GameState } from '../state';
import { levelForXp } from '../xp';
import { PROJECT_IDS, PROJECTS, SKILL_IDS, TOOL_IDS, TOOLS, type LocationId, type Modifiers, type SkillId } from './world';

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
    guaranteeAt: 60,
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
    guaranteeAt: 80,
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
    guaranteeAt: 120,
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
    guaranteeAt: 90,
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

export type Mood = 'neutral' | 'concerned' | 'relieved';

export interface DialogueLine {
  speaker: SpeakerId | 'you';
  text: string;
  /** Portrait expression; neutral when omitted. */
  mood?: Mood;
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
      { speaker: 'mara', text: 'And every night at 3:17 that far signal turns cyan. Not red, not green. Cyan.', mood: 'concerned' },
      { speaker: 'you', text: 'What happens if No. 9 runs again?', mood: 'concerned' },
      { speaker: 'mara', text: 'Find out for me. There’s scrap all along the platform — start with the firebox.', mood: 'relieved' },
    ],
  },
  {
    id: 'maraTimetable',
    title: 'Ashvale to nowhere',
    speaker: 'mara',
    when: (s) => found(s, 'tornTimetable'),
    lines: [
      { speaker: 'mara', text: 'The winter timetable. I’ve tried to read that last line a hundred times.' },
      { speaker: 'mara', text: 'My grandfather drove that service. Edric Venn. He never came home and nobody would say where the line went.', mood: 'concerned' },
    ],
  },
  {
    id: 'maraFirebox',
    title: 'First light',
    speaker: 'mara',
    when: (s) => s.repairs.fireboxDoor,
    lines: [
      { speaker: 'mara', text: 'She’s glowing. I haven’t seen a fire in that box my whole life.', mood: 'relieved' },
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
      { speaker: 'tobin', text: 'That’s my key. Took you long enough.', mood: 'relieved' },
      { speaker: 'tobin', text: 'Fifty years I’ve kept that oak dry. You want No. 9 to run, you’ll need it, and rivets, and patience.' },
      { speaker: 'tobin', text: 'Plate first. Then panels. Then the boiler. Don’t skip ahead — boilers remember.', mood: 'concerned' },
    ],
  },
  {
    id: 'tobinHeadlamp',
    title: 'Where the fog stops',
    speaker: 'tobin',
    when: (s) => s.repairs.headlamp,
    lines: [
      { speaker: 'tobin', text: 'Look at that beam. Straight down the line, and it stops dead at the signal. Always has.', mood: 'concerned' },
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
      { speaker: 'mara', text: 'I wrote to the glassworks once. They said no one ever made a cyan signal lens. Not anywhere.', mood: 'concerned' },
    ],
  },
  {
    id: 'tobinLedger',
    title: 'The last run',
    speaker: 'tobin',
    when: (s) => found(s, 'firemansLedger'),
    lines: [
      { speaker: 'tobin', text: 'You read it, then. I saw red that night. I’ll swear it.', mood: 'concerned' },
      { speaker: 'tobin', text: 'Edric saw cyan. Said the line had opened for us. I stopped her at the yard limit and he took the lamp and walked on.', mood: 'concerned' },
      { speaker: 'tobin', text: 'I’ve been waiting for that signal to show me what he saw. Never has.', mood: 'concerned' },
    ],
  },
  {
    id: 'maraDryCab',
    title: 'Out of the rain',
    speaker: 'mara',
    when: (s) => s.repairs.dryCab,
    lines: [
      { speaker: 'mara', text: 'A dry cab. I sat up there out of the rain tonight and wrote the log from the footplate.', mood: 'relieved' },
      { speaker: 'mara', text: 'At 3:17 the hum came through the rail. I felt it in my teeth.', mood: 'concerned' },
    ],
  },
  {
    id: 'tobinTender',
    title: 'Room for a town',
    speaker: 'tobin',
    when: (s) => s.repairs.reinforcedStorage,
    lines: [
      { speaker: 'tobin', text: 'Proper tender, that. Carry coal, tools, people if you had to.', mood: 'relieved' },
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
      { speaker: 'mara', text: 'Tobin. The signal.', mood: 'concerned' },
      { speaker: 'tobin', text: '…It’s cyan. And it isn’t 3:17.' },
      { speaker: 'mara', text: 'It’s not waiting for the time anymore. It’s waiting for us.', mood: 'relieved' },
      { speaker: 'you', text: 'Then No. 9 needs a crew.', mood: 'relieved' },
      { speaker: 'tobin', text: 'Then she needs a driver. Fetch your coat. — End of Chapter One.', mood: 'relieved' },
    ],
  },
  {
    id: 'maraNotes',
    title: 'Pages in the rain',
    speaker: 'mara',
    when: (s) => (s.stats.obtained.waterloggedNotes ?? 0) > 0,
    lines: [
      { speaker: 'mara', text: 'Those are signal box pages. Station files, too \u2014 they blew everywhere when the roof went.' },
      { speaker: 'mara', text: 'Dry them out and read them against what you\u2019ve found. Every scrap in that journal of yours has a story behind it.' },
      { speaker: 'mara', text: 'The Railway Research desk is in the old booking office. Grandad\u2019s reading glass is long gone \u2014 you could make one.' },
    ],
  },
  {
    id: 'tobinSalvage',
    title: 'Nothing is scrap',
    speaker: 'tobin',
    when: (s) => s.stats.salvages >= 1,
    lines: [
      { speaker: 'tobin', text: 'Breaking down the wagon? Good. Every wreck in this yard is somebody\u2019s spare parts.' },
      { speaker: 'tobin', text: 'Lanterns give brass. Telegraphs give springs. Pumps \u2014 bearings, if you\u2019re patient. Bring me the dynamos.', mood: 'relieved' },
    ],
  },
  {
    id: 'tobinTools',
    title: 'A proper kit',
    speaker: 'tobin',
    when: (s) => Object.values(s.equipment).some((t) => t !== null),
    lines: [
      { speaker: 'tobin', text: 'Now you\u2019re working like a fitter. Right tool, half the time.' },
      { speaker: 'tobin', text: 'Better ones come from better drawings. Mara\u2019s papers are full of them, if you can read them.' },
    ],
  },
  {
    id: 'maraMitten',
    title: 'E.V.',
    speaker: 'mara',
    when: (s) => s.research.done.includes('lostProperty'),
    lines: [
      { speaker: 'mara', text: 'E.V. \u2014 Elin Venn. My mother. The ledger says a child\u2019s mitten was handed in on the night of the last service.', mood: 'concerned' },
      { speaker: 'mara', text: 'She was six. She came to see her father off. He waved from the cab, and then the fog took the lamp.' },
      { speaker: 'mara', text: 'She never told me she was here. Thank you for finding it.', mood: 'relieved' },
    ],
  },
  {
    id: 'tobinBoilerPrep',
    title: 'Boilers remember',
    speaker: 'tobin',
    when: (s) => s.research.done.includes('firemansMethods'),
    lines: [
      { speaker: 'tobin', text: 'So you\u2019ve read my methods. Warm her slow. Never cold water on hot plate.' },
      { speaker: 'tobin', text: 'Get me two gauge assemblies and the springs to seat the valves, and we\u2019ll light her properly.', mood: 'relieved' },
    ],
  },
  {
    id: 'nightWorks',
    title: 'Night Works: Something Answers',
    speaker: 'tobin',
    milestone: true,
    when: (s) => s.repairs.signalReceiver,
    lines: [
      { speaker: 'mara', text: 'The receiver\u2019s lit. It\u2019s pulsing with the signal \u2014 exactly with it.', mood: 'concerned' },
      { speaker: 'tobin', text: 'Listen. Under the hum. That\u2019s a whistle. Two short, one long.', mood: 'concerned' },
      { speaker: 'mara', text: 'Grandad\u2019s call sign. It\u2019s in the log a hundred times.', mood: 'concerned' },
      { speaker: 'you', text: 'Then someone down the line is waiting for No. 9.' },
      { speaker: 'tobin', text: 'Then we\u2019d best not keep them. \u2014 End of Night Works.', mood: 'relieved' },
    ],
  },
];

export const DIALOGUE_BY_ID: Record<string, DialogueDef> = Object.fromEntries(DIALOGUES.map((d) => [d.id, d]));

// ---------- Achievements ----------

export interface AchievementReward {
  text: string;
  apply: (m: Modifiers) => void;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  when: (s: GameState) => boolean;
  /** A small permanent bonus, so feats are worth chasing. */
  reward?: AchievementReward;
}

const totalSearches = (s: GameState): number => Object.values(s.stats.searches).reduce((a, b) => a + (b ?? 0), 0);
const lvl = (s: GameState, skill: SkillId): number => levelForXp(s.skills[skill].xp);
const ownsToolFor = (s: GameState, skill: SkillId): boolean =>
  s.equipment[skill] !== null || TOOL_IDS.some((t) => TOOLS[t].skill === skill && s.inventory[t] > 0);
const RESEARCHABLE = PROJECT_IDS.filter((id) => PROJECTS[id].actions !== undefined);

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'firstSearch', name: 'Lantern Lit', description: 'Search anywhere in Ashvale.', when: (s) => totalSearches(s) >= 1 },
  { id: 'firstCraft', name: 'Hammer and Anvil', description: 'Complete your first Engineering recipe.', when: (s) => s.stats.crafts >= 1 },
  {
    id: 'firstRare',
    name: 'Something Glinted',
    description: 'Find a rare item.',
    when: (s) => s.stats.rareFinds >= 1,
    reward: { text: 'Rare finds \u00d71.05', apply: (m) => void (m.rareChance *= 1.05) },
  },
  { id: 'firebox', name: 'Kindling', description: 'Repair the Firebox Door.', when: (s) => s.repairs.fireboxDoor },
  {
    id: 'firstSalvage',
    name: 'Stripped Down',
    description: 'Salvage anything.',
    when: (s) => s.stats.salvages >= 1,
    reward: { text: 'Salvaging +5% speed', apply: (m) => void (m.speed.salvaging += 0.05) },
  },
  {
    id: 'firstProject',
    name: 'Footnotes',
    description: 'Finish a research project.',
    when: (s) => s.research.done.length >= 1,
    reward: { text: 'Railway Research +5% speed', apply: (m) => void (m.speed.research += 0.05) },
  },
  {
    id: 'allPlaces',
    name: 'Every Corner',
    description: 'Search all three places in Ashvale.',
    when: (s) => (s.stats.searches.maintenanceShed ?? 0) > 0 && (s.stats.searches.signalCabinet ?? 0) > 0,
    reward: { text: 'Scavenging +5% speed', apply: (m) => void (m.speed.scavenging += 0.05) },
  },
  {
    id: 'fullKit',
    name: 'Full Kit',
    description: 'Own a tool for every skill.',
    when: (s) => SKILL_IDS.every((k) => ownsToolFor(s, k)),
    reward: { text: 'Every skill +5% speed', apply: (m) => SKILL_IDS.forEach((k) => (m.speed[k] += 0.05)) },
  },
  {
    id: 'searches500',
    name: 'Night Shift',
    description: 'Search 500 times.',
    when: (s) => totalSearches(s) >= 500,
    reward: { text: 'Scavenging +5% speed', apply: (m) => void (m.speed.scavenging += 0.05) },
  },
  {
    id: 'crafts100',
    name: 'Steady Hands',
    description: 'Complete 100 Engineering recipes.',
    when: (s) => s.stats.crafts >= 100,
    reward: { text: 'Engineering +5% speed', apply: (m) => void (m.speed.engineering += 0.05) },
  },
  {
    id: 'salvage250',
    name: 'Breaker\u2019s Yard',
    description: 'Salvage 250 times.',
    when: (s) => s.stats.salvages >= 250,
    reward: { text: 'Salvaging +5% double yield', apply: (m) => void (m.doubleChance += 0.05) },
  },
  {
    id: 'journalHalf',
    name: 'Archivist',
    description: 'Record 6 discoveries in the journal.',
    when: (s) => Object.keys(s.discoveries).length >= 6,
    reward: { text: 'Railway Research +10% speed', apply: (m) => void (m.speed.research += 0.1) },
  },
  {
    id: 'journalFull',
    name: 'Keeper of Ashvale',
    description: 'Record all 12 discoveries.',
    when: (s) => Object.keys(s.discoveries).length >= DISCOVERIES.length,
    reward: { text: 'All XP +5%', apply: (m) => void (m.xp *= 1.05) },
  },
  {
    id: 'scav10',
    name: 'Sharp Eyes',
    description: 'Reach Scavenging level 10.',
    when: (s) => lvl(s, 'scavenging') >= 10,
    reward: { text: 'Rare finds \u00d71.1', apply: (m) => void (m.rareChance *= 1.1) },
  },
  {
    id: 'eng10',
    name: 'Fitter',
    description: 'Reach Engineering level 10.',
    when: (s) => lvl(s, 'engineering') >= 10,
    reward: { text: 'Engineering +5% speed', apply: (m) => void (m.speed.engineering += 0.05) },
  },
  {
    id: 'salv10',
    name: 'Breaker',
    description: 'Reach Salvaging level 10.',
    when: (s) => lvl(s, 'salvaging') >= 10,
    reward: { text: 'Salvaging +5% double yield', apply: (m) => void (m.doubleChance += 0.05) },
  },
  {
    id: 'res10',
    name: 'Scholar',
    description: 'Reach Railway Research level 10.',
    when: (s) => lvl(s, 'research') >= 10,
    reward: { text: '5% chance to keep notes', apply: (m) => void (m.saveChance.research += 0.05) },
  },
  {
    id: 'everyPage',
    name: 'Every Page',
    description: 'Finish every research project.',
    when: (s) => RESEARCHABLE.every((id) => s.research.done.includes(id)),
    reward: { text: 'All XP +5%', apply: (m) => void (m.xp *= 1.05) },
  },
  {
    id: 'chapterOne',
    name: 'The Line Is Open',
    description: 'Restore No. 9\u2019s boiler.',
    when: (s) => s.repairs.boiler,
    reward: { text: 'All XP +5%', apply: (m) => void (m.xp *= 1.05) },
  },
  {
    id: 'nightWorks',
    name: 'Something Answers',
    description: 'Fit the Signal Receiver.',
    when: (s) => s.repairs.signalReceiver,
  },
  {
    id: 'master',
    name: 'Ashvale\u2019s Own',
    description: 'Reach level 20 in every skill.',
    when: (s) => SKILL_IDS.every((k) => lvl(s, k) >= 20),
  },
];

// ---------- Chapter objectives ----------

export interface ObjectiveDef {
  id: string;
  chapter: 1 | 2;
  title: string;
  hint: string;
  /** Returns [current, target] so the UI can show progress. */
  progress: (s: GameState) => [number, number];
}

export const CHAPTERS: Record<1 | 2, string> = {
  1: 'Chapter One \u00b7 The Cyan Signal',
  2: 'Night Works',
};

const flag = (b: boolean): [number, number] => [b ? 1 : 0, 1];
const capped = (n: number, target: number): [number, number] => [Math.min(target, n), target];
const anyTool = (s: GameState): boolean => SKILL_IDS.some((k) => ownsToolFor(s, k));

export const OBJECTIVES: ObjectiveDef[] = [
  {
    id: 'search10',
    chapter: 1,
    title: 'Search the Derelict Platform',
    hint: 'Skills \u2192 Scavenging \u2192 Derelict Platform. Searching continues while you\u2019re away.',
    progress: (s) => capped(s.stats.searches.derelictPlatform ?? 0, 10),
  },
  {
    id: 'plates',
    chapter: 1,
    title: 'Hammer out 4 Iron Plates',
    hint: 'Skills \u2192 Engineering. Each plate takes 3 Scrap Iron.',
    // Saves from 0.1 repaired the firebox without plates; count that as done.
    progress: (s) => [s.repairs.fireboxDoor ? 4 : Math.min(4, s.stats.obtained.ironPlate ?? 0), 4],
  },
  {
    id: 'firebox',
    chapter: 1,
    title: 'Repair the Firebox Door',
    hint: 'Train tab. You\u2019ll need a Brass Cog \u2014 a rare platform find.',
    progress: (s) => flag(s.repairs.fireboxDoor),
  },
  {
    id: 'salvage',
    chapter: 1,
    title: 'Break down the Scrap Wagon',
    hint: 'Skills \u2192 Salvaging. Brass Fittings and Bearings come from wrecks, not the ground.',
    progress: (s) => capped(s.stats.salvages, 5),
  },
  {
    id: 'study',
    chapter: 1,
    title: 'Finish a research project',
    hint: 'Collect Waterlogged Notes while scavenging, then study a discovery in Skills \u2192 Railway Research.',
    progress: (s) => capped(s.research.done.length, 1),
  },
  {
    id: 'tool',
    chapter: 1,
    title: 'Make your first tool',
    hint: 'Engineering \u2192 Tools. A Pry Bar or Hacksaw speeds up its skill as soon as it\u2019s equipped.',
    progress: (s) => flag(anyTool(s)),
  },
  {
    id: 'cabinet',
    chapter: 1,
    title: 'Reach Scavenging 3 and open the Signal Cabinet',
    hint: 'The cabinet holds relays, telegraphs, notes and stranger things.',
    progress: (s) => capped(s.stats.searches.signalCabinet ?? 0, 1),
  },
  {
    id: 'headlamp',
    chapter: 1,
    title: 'Restore the Headlamp',
    hint: 'Lenses, coils, relays from the cabinet and Brass Fittings from salvage.',
    progress: (s) => flag(s.repairs.headlamp),
  },
  {
    id: 'key',
    chapter: 1,
    title: 'Find the Shed Key',
    hint: 'It\u2019s somewhere in the Signal Cabinet.',
    progress: (s) => flag(found(s, 'shedKey')),
  },
  {
    id: 'shed',
    chapter: 1,
    title: 'Reach Scavenging 7 and enter the Maintenance Shed',
    hint: 'Tobin keeps timber, rivets, pumps and gauges there.',
    progress: (s) => capped(lvl(s, 'scavenging'), 7),
  },
  {
    id: 'dryCab',
    chapter: 1,
    title: 'Mend the Dry Cab',
    hint: 'Engineering 6, Timber Beams, Iron Plates and Brass Fittings.',
    progress: (s) => flag(s.repairs.dryCab),
  },
  {
    id: 'tender',
    chapter: 1,
    title: 'Reinforce the Tender',
    hint: 'Engineering 9, Riveted Panels, Timber Beams and Bearings from salvaged pumps.',
    progress: (s) => flag(s.repairs.reinforcedStorage),
  },
  {
    id: 'methods',
    chapter: 1,
    title: 'Study The Fireman\u2019s Methods',
    hint: 'Find the Fireman\u2019s Ledger in the shed, then research it.',
    progress: (s) => flag(s.research.done.includes('firemansMethods')),
  },
  {
    id: 'boiler',
    chapter: 1,
    title: 'Rebuild the Boiler',
    hint: 'Engineering 12, two Gauge Assemblies, panels, fuel, springs \u2014 and a Cyan Prism.',
    progress: (s) => flag(s.repairs.boiler),
  },
  {
    id: 'lanterns',
    chapter: 2,
    title: 'Hang the Cab Lanterns',
    hint: 'Train \u2192 Improvements. A reading room on the footplate speeds up Research.',
    progress: (s) => flag(s.repairs.cabLanterns),
  },
  {
    id: 'winch',
    chapter: 2,
    title: 'Fit the Tender Winch',
    hint: 'Bearings, springs and rivets \u2014 mostly from salvaged pumps.',
    progress: (s) => flag(s.repairs.tenderWinch),
  },
  {
    id: 'tier3',
    chapter: 2,
    title: 'Equip a tier 3 tool',
    hint: 'Research the Kiln Spur Plans or Cyan Optics for the blueprints.',
    progress: (s) => flag(SKILL_IDS.some((k) => { const t = s.equipment[k]; return t !== null && TOOLS[t].tier === 3; })),
  },
  {
    id: 'research8',
    chapter: 2,
    title: 'Finish 8 research projects',
    hint: 'Every discovery in the journal can be studied.',
    progress: (s) => capped(s.research.done.length, 8),
  },
  {
    id: 'receiver',
    chapter: 2,
    title: 'Fit the Signal Receiver',
    hint: 'Study the Humming Relay, then wire magnets, coils and relays into the cab.',
    progress: (s) => flag(s.repairs.signalReceiver),
  },
  {
    id: 'all15',
    chapter: 2,
    title: 'Reach level 15 in every skill',
    hint: 'Long-term goal. Offline time counts.',
    progress: (s) => capped(Math.min(...SKILL_IDS.map((k) => lvl(s, k))), 15),
  },
];
