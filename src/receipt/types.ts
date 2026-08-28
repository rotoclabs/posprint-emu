import type { Align, CutMode } from '../escpos/types.js';

export interface TextSpan {
  text: string;
  bold: boolean;
  underline: boolean;
  widthMultiplier: number;
  heightMultiplier: number;
}

export interface ReceiptLine {
  type: 'line';
  align: Align;
  spans: TextSpan[];
}

export interface ReceiptImage {
  type: 'image';
  align: Align;
  widthPx: number;
  heightPx: number;
  pngDataUrl: string;
}

export interface ReceiptSpacer {
  type: 'spacer';
  heightPx: number;
}

export interface JobMeta {
  connectionId: string;
  remoteAddress: string;
  startedAt: number;
}

/** Marks where a new TCP connection started writing into an in-progress segment (not a cut). */
export interface JobMarker extends JobMeta {
  type: 'jobMarker';
}

export type ReceiptElement = ReceiptLine | ReceiptImage | ReceiptSpacer | JobMarker;

export interface ReceiptSegment {
  id: string;
  elements: ReceiptElement[];
  cut?: { mode: CutMode; timestamp: number };
  jobMeta?: JobMeta;
}

export interface VirtualReceipt {
  columns: number;
  segments: ReceiptSegment[];
}
