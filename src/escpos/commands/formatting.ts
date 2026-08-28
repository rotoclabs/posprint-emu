import { ESC, GS } from '../constants.js';
import type { Align, CommandSpec } from '../types.js';

const fixedArg = (prefix: number[], name: string, decode: (n: number) => ReturnType<CommandSpec['decode']>): CommandSpec => ({
  name,
  prefix,
  headerLength: 1,
  totalLength: () => 0,
  decode: (payload) => decode(payload[0]),
});

export const boldSpec = fixedArg([ESC, 0x45], 'bold', (n) => ({ type: 'bold', on: (n & 1) === 1 }));

export const underlineSpec = fixedArg([ESC, 0x2d], 'underline', (n) => ({
  type: 'underline',
  on: n === 1 || n === 2 || n === 0x31 || n === 0x32,
}));

const ALIGN_MAP: Record<number, Align> = { 0: 'left', 1: 'center', 2: 'right' };

export const alignSpec = fixedArg([ESC, 0x61], 'align', (n) => ({
  type: 'align',
  align: ALIGN_MAP[n] ?? 'left',
}));

export const sizeSpec = fixedArg([GS, 0x21], 'size', (n) => ({
  type: 'size',
  widthMultiplier: ((n >> 4) & 0x07) + 1,
  heightMultiplier: (n & 0x07) + 1,
}));
