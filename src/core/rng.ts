// Deterministic pseudo-random numbers (mulberry32).
// The generator state lives in the save, so the same save advanced to the
// same timestamp always produces the same drops — online or offline.

export interface RngResult {
  value: number; // [0, 1)
  state: number; // next uint32 state
}

export function nextRandom(state: number): RngResult {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: s };
}

/** Integer in [min, max], inclusive. */
export function nextInt(state: number, min: number, max: number): { value: number; state: number } {
  const r = nextRandom(state);
  return { value: min + Math.floor(r.value * (max - min + 1)), state: r.state };
}

export function newSeed(): number {
  return (Math.random() * 4294967296) >>> 0;
}
