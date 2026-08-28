import { COMMAND_TABLE, CONTROL_START_BYTES } from './commandTable.js';
import { MAX_TEXT_RUN_BYTES } from './constants.js';
import { makeTextCommand } from './commands/text.js';
import type { CommandSpec, ParsedCommand } from './types.js';

type MatchResult = { spec: CommandSpec; prefixLength: number } | 'incomplete' | 'unknown';

function matchesPrefix(buffer: Buffer, prefix: number[], length: number): boolean {
  for (let i = 0; i < length; i++) {
    if (buffer[i] !== prefix[i]) return false;
  }
  return true;
}

/**
 * Turns a raw ESC/POS byte stream into ParsedCommands, correctly handling commands split
 * across multiple TCP packets: nothing is consumed from the internal buffer until a full
 * command (prefix + header + any variable-length payload) is present.
 */
export class StreamingTokenizer {
  private buffer: Buffer = Buffer.alloc(0);

  feed(chunk: Buffer): ParsedCommand[] {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : Buffer.from(chunk);
    return this.drain();
  }

  /** Call when the connection closes: flushes any trailing text run still buffered. */
  end(): ParsedCommand[] {
    if (this.buffer.length === 0) return [];
    const commands: ParsedCommand[] = [];
    if (!CONTROL_START_BYTES.has(this.buffer[0])) {
      commands.push(makeTextCommand(this.buffer));
    }
    // A dangling incomplete control sequence at connection close is truncated input; drop it.
    this.buffer = Buffer.alloc(0);
    return commands;
  }

  private drain(): ParsedCommand[] {
    const commands: ParsedCommand[] = [];

    for (;;) {
      if (this.buffer.length === 0) break;

      if (CONTROL_START_BYTES.has(this.buffer[0])) {
        const result = this.matchControl();
        if (result === 'incomplete') break;

        if (result === 'unknown') {
          commands.push({ type: 'unsupported', name: 'unknown', bytes: this.buffer.subarray(0, 2) });
          this.buffer = this.buffer.subarray(2);
          continue;
        }

        const { spec, prefixLength } = result;
        const need = prefixLength + spec.headerLength;
        if (this.buffer.length < need) break; // wait for header bytes

        const header = this.buffer.subarray(prefixLength, need);
        const total = need + spec.totalLength(header);
        if (this.buffer.length < total) break; // wait for full variable-length payload

        const payload = this.buffer.subarray(prefixLength, total);
        commands.push(spec.decode(payload));
        this.buffer = this.buffer.subarray(total);
        continue;
      }

      const textEnd = this.scanTextRun();
      if (textEnd === null) break; // might still be mid-run; wait for more data
      commands.push(makeTextCommand(this.buffer.subarray(0, textEnd)));
      this.buffer = this.buffer.subarray(textEnd);
    }

    return commands;
  }

  /** Finds the extent of a plain-text run. Returns null if more data is needed to be sure. */
  private scanTextRun(): number | null {
    let end = 1;
    while (end < this.buffer.length && end < MAX_TEXT_RUN_BYTES && !CONTROL_START_BYTES.has(this.buffer[end])) {
      end++;
    }
    if (end === MAX_TEXT_RUN_BYTES) return end;
    if (end === this.buffer.length) return null; // ran off the end without finding a boundary
    return end;
  }

  private matchControl(): MatchResult {
    let sawIncomplete = false;
    for (const spec of COMMAND_TABLE) {
      const { prefix } = spec;
      if (this.buffer.length < prefix.length) {
        if (matchesPrefix(this.buffer, prefix, this.buffer.length)) sawIncomplete = true;
        continue;
      }
      if (matchesPrefix(this.buffer, prefix, prefix.length)) {
        return { spec, prefixLength: prefix.length };
      }
    }
    return sawIncomplete ? 'incomplete' : 'unknown';
  }
}
