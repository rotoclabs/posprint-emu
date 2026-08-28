import type { VirtualReceipt } from '../receipt/types.js';

export type ServerMessage =
  | { type: 'snapshot'; receipt: VirtualReceipt }
  | { type: 'connection-event'; event: 'connected' | 'disconnected'; connectionId: string; remoteAddress: string; timestamp: number }
  | { type: 'error'; message: string };

export type ClientMessage = { type: 'clear' } | { type: 'request-snapshot' };
