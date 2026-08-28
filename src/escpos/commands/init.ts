import { ESC } from '../constants.js';
import type { CommandSpec } from '../types.js';

export const initSpec: CommandSpec = {
  name: 'init',
  prefix: [ESC, 0x40],
  headerLength: 0,
  totalLength: () => 0,
  decode: () => ({ type: 'init' }),
};
