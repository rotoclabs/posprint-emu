import { describe, expect, it } from 'vitest';
import { StreamingTokenizer } from '../src/escpos/tokenizer.js';
import type { ParsedCommand } from '../src/escpos/types.js';

const ESC = 0x1b;
const GS = 0x1d;

function bytes(...values: (number | string)[]): number[] {
  const out: number[] = [];
  for (const v of values) {
    if (typeof v === 'string') {
      for (const ch of v) out.push(ch.charCodeAt(0));
    } else {
      out.push(v);
    }
  }
  return out;
}

// One buffer exercising every MVP command.
const JOB = Buffer.from([
  ...bytes(ESC, 0x40), // init
  ...bytes(ESC, 0x45, 1), // bold on
  ...bytes('Hi'),
  ...bytes(ESC, 0x45, 0), // bold off
  ...bytes(ESC, 0x2d, 1), // underline on
  ...bytes('Yo'),
  ...bytes(ESC, 0x2d, 0), // underline off
  ...bytes(ESC, 0x61, 2), // align right
  ...bytes(GS, 0x21, 0x11), // size 2x2
  0x0a, // LF
  ...bytes(ESC, 0x64, 3), // feed 3 lines
  ...bytes(ESC, 0x4a, 10), // feed 10 dots
  ...bytes(GS, 0x76, 0x30, 0x00, 2, 0, 3, 0), // raster header: width=2 bytes, height=3
  0x11, 0x22, 0x33, 0x44, 0x55, 0x66, // 2*3=6 bytes of image data
  ...bytes(GS, 0x56, 0x00), // full cut
  ...bytes(GS, 0x56, 0x01), // partial cut
]);

function runWhole(buf: Buffer): ParsedCommand[] {
  const tokenizer = new StreamingTokenizer();
  const commands = tokenizer.feed(buf);
  return [...commands, ...tokenizer.end()];
}

function runSplit(buf: Buffer, splitAt: number): ParsedCommand[] {
  const tokenizer = new StreamingTokenizer();
  const first = tokenizer.feed(buf.subarray(0, splitAt));
  const second = tokenizer.feed(buf.subarray(splitAt));
  return [...first, ...second, ...tokenizer.end()];
}

describe('StreamingTokenizer', () => {
  const baseline = runWhole(JOB);

  it('decodes every MVP command from a single feed()', () => {
    const types = baseline.map((c) => c.type);
    expect(types).toEqual([
      'init',
      'bold',
      'text',
      'bold',
      'underline',
      'text',
      'underline',
      'align',
      'size',
      'lineFeed',
      'feedLines',
      'feedDots',
      'rasterImage',
      'cut',
      'cut',
    ]);
  });

  it('produces identical output no matter where the byte stream is split', () => {
    for (let splitAt = 1; splitAt < JOB.length; splitAt++) {
      const result = runSplit(JOB, splitAt);
      expect(result, `split at byte ${splitAt}`).toEqual(baseline);
    }
  });

  it('produces identical output when split into many small random-ish chunks', () => {
    const tokenizer = new StreamingTokenizer();
    const commands: ParsedCommand[] = [];
    let offset = 0;
    let chunkSize = 1;
    while (offset < JOB.length) {
      const end = Math.min(offset + chunkSize, JOB.length);
      commands.push(...tokenizer.feed(JOB.subarray(offset, end)));
      offset = end;
      chunkSize = (chunkSize % 3) + 1; // cycles 1,2,3,1,2,3...
    }
    commands.push(...tokenizer.end());
    expect(commands).toEqual(baseline);
  });

  it('logs and skips an unrecognized control sequence without crashing', () => {
    const tokenizer = new StreamingTokenizer();
    // ESC followed by a byte with no known spec (0x99), then plain text to prove recovery.
    // The trailing text has no subsequent control byte in this chunk, so it stays buffered
    // until end() flushes it -- correct behavior, since more text could still be coming.
    const weird = Buffer.from([ESC, 0x99, ...bytes('ok')]);
    const commands = tokenizer.feed(weird);
    expect(commands[0]).toEqual({ type: 'unsupported', name: 'unknown', bytes: Buffer.from([ESC, 0x99]) });

    const flushed = tokenizer.end();
    expect(flushed[0]).toMatchObject({ type: 'text' });
  });
});
