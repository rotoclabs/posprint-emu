export const ESC = 0x1b;
export const GS = 0x1d;
export const FS = 0x1c;
export const LF = 0x0a;
export const CR = 0x0d;

/** Text runs are flushed at this length even without a control byte, to bound memory use. */
export const MAX_TEXT_RUN_BYTES = 4096;
