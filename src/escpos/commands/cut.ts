import { GS } from '../constants.js';
import type { CommandSpec, CutMode } from '../types.js';

// m values: 0/48 = full, 1/49 = partial (immediate); 65 ('A')/66 ('B') = feed-then-cut full/partial,
// which carry one extra trailing "feed n" byte.
const PARTIAL_CUT = new Set([0x01, 0x31, 0x42]);
const FEED_THEN_CUT = new Set([0x41, 0x42]);

function modeFor(m: number): CutMode {
  return PARTIAL_CUT.has(m) ? 'partial' : 'full';
}

export const cutSpec: CommandSpec = {
  name: 'cut',
  prefix: [GS, 0x56],
  headerLength: 1,
  totalLength: (header) => (FEED_THEN_CUT.has(header[0]) ? 1 : 0),
  decode: (payload) => ({ type: 'cut', mode: modeFor(payload[0]) }),
};
