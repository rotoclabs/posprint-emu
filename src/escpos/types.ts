export type Align = 'left' | 'center' | 'right';
export type CutMode = 'full' | 'partial';

export interface TextCommand {
  type: 'text';
  bytes: Buffer;
}

export interface InitCommand {
  type: 'init';
}

export interface BoldCommand {
  type: 'bold';
  on: boolean;
}

export interface UnderlineCommand {
  type: 'underline';
  on: boolean;
}

export interface AlignCommand {
  type: 'align';
  align: Align;
}

export interface SizeCommand {
  type: 'size';
  widthMultiplier: number;
  heightMultiplier: number;
}

export interface LineFeedCommand {
  type: 'lineFeed';
}

export interface FeedLinesCommand {
  type: 'feedLines';
  lines: number;
}

export interface FeedDotsCommand {
  type: 'feedDots';
  dots: number;
}

export interface CutCommand {
  type: 'cut';
  mode: CutMode;
}

export interface RasterImageCommand {
  type: 'rasterImage';
  widthBytes: number;
  heightDots: number;
  data: Buffer;
}

/** Emitted for a recognized-but-unsupported control sequence, so it can be logged and skipped. */
export interface UnsupportedCommand {
  type: 'unsupported';
  name: string;
  bytes: Buffer;
}

/**
 * Declarative description of one ESC/POS opcode, used by the table-driven tokenizer.
 * Adding a new command means adding one CommandSpec — no tokenizer changes.
 */
export interface CommandSpec {
  name: string;
  /** Bytes that identify this command, e.g. [ESC, 0x45] for "ESC E". */
  prefix: number[];
  /** Number of fixed argument bytes immediately after the prefix. */
  headerLength: number;
  /** Additional payload bytes beyond the header (0 for fixed-length commands), computed from the header. */
  totalLength(header: Buffer): number;
  /** header + any additional payload bytes. */
  decode(payload: Buffer): ParsedCommand;
}

export type ParsedCommand =
  | TextCommand
  | InitCommand
  | BoldCommand
  | UnderlineCommand
  | AlignCommand
  | SizeCommand
  | LineFeedCommand
  | FeedLinesCommand
  | FeedDotsCommand
  | CutCommand
  | RasterImageCommand
  | UnsupportedCommand;
