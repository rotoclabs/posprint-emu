import { ESC, LF, CR } from '../constants.js';
import type { CommandSpec } from '../types.js';

export const lineFeedSpec: CommandSpec = {
  name: 'lineFeed',
  prefix: [LF],
  headerLength: 0,
  totalLength: () => 0,
  decode: () => ({ type: 'lineFeed' }),
};

/** Carriage return is a no-op on fixed-width thermal printers (no arbitrary cursor movement). */
export const carriageReturnSpec: CommandSpec = {
  name: 'carriageReturn',
  prefix: [CR],
  headerLength: 0,
  totalLength: () => 0,
  decode: (payload) => ({ type: 'unsupported', name: 'carriageReturn', bytes: payload }),
};

export const feedLinesSpec: CommandSpec = {
  name: 'feedLines',
  prefix: [ESC, 0x64],
  headerLength: 1,
  totalLength: () => 0,
  decode: (payload) => ({ type: 'feedLines', lines: payload[0] }),
};

export const feedDotsSpec: CommandSpec = {
  name: 'feedDots',
  prefix: [ESC, 0x4a],
  headerLength: 1,
  totalLength: () => 0,
  decode: (payload) => ({ type: 'feedDots', dots: payload[0] }),
};
