import type { TextCommand } from '../types.js';

export function makeTextCommand(bytes: Buffer): TextCommand {
  return { type: 'text', bytes: Buffer.from(bytes) };
}
