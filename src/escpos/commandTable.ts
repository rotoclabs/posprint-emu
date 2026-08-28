import type { CommandSpec } from './types.js';
import { initSpec } from './commands/init.js';
import { boldSpec, underlineSpec, alignSpec, sizeSpec } from './commands/formatting.js';
import { lineFeedSpec, carriageReturnSpec, feedLinesSpec, feedDotsSpec } from './commands/feed.js';
import { cutSpec } from './commands/cut.js';
import { rasterImageSpec } from './commands/image.js';

export type { CommandSpec };

/**
 * All known control-byte-prefixed commands, longest prefix first so a more specific
 * match (e.g. "GS v 0", 3 bytes) is checked before a shorter one that starts the same way.
 */
export const COMMAND_TABLE: CommandSpec[] = [
  rasterImageSpec,
  initSpec,
  boldSpec,
  underlineSpec,
  alignSpec,
  sizeSpec,
  feedLinesSpec,
  feedDotsSpec,
  cutSpec,
  lineFeedSpec,
  carriageReturnSpec,
].sort((a, b) => b.prefix.length - a.prefix.length);

/** First byte of every known control prefix — used by the tokenizer to end a text run early. */
export const CONTROL_START_BYTES = new Set(COMMAND_TABLE.map((spec) => spec.prefix[0]));
