import { randomUUID } from 'node:crypto';
import type { ParsedCommand } from '../escpos/types.js';
import { decodeText } from '../escpos/codepage.js';
import { rasterToPngDataUrl } from './rasterImage.js';
import type { PrinterState } from './PrinterState.js';
import type { JobMeta, ReceiptLine, ReceiptSegment, TextSpan, VirtualReceipt } from './types.js';

function spanMatches(span: TextSpan, state: PrinterState): boolean {
  return (
    span.bold === state.bold &&
    span.underline === state.underline &&
    span.widthMultiplier === state.widthMultiplier &&
    span.heightMultiplier === state.heightMultiplier
  );
}

function lineCellWidth(line: ReceiptLine): number {
  return line.spans.reduce((sum, span) => sum + span.text.length * span.widthMultiplier, 0);
}

/**
 * Pure, framework-free accumulator for the shared "virtual paper roll". Formatting commands
 * (bold/underline/align/size/init) are applied to a per-connection PrinterState by the caller
 * (PrintJob) before reaching here — this model only turns content-producing commands into
 * rendered elements, using whatever PrinterState is passed alongside each command.
 */
export class ReceiptModel {
  private receipt: VirtualReceipt;
  private lineOpen = false;

  constructor(columns: number) {
    this.receipt = { columns, segments: [this.newSegment()] };
  }

  getSnapshot(): VirtualReceipt {
    return this.receipt;
  }

  clear(): void {
    this.receipt = { columns: this.receipt.columns, segments: [this.newSegment()] };
    this.lineOpen = false;
  }

  /** Records that a new TCP connection has started writing into the shared roll. */
  startJob(jobMeta: JobMeta): void {
    const segment = this.currentSegment();
    if (segment.elements.length === 0 && !segment.jobMeta) {
      segment.jobMeta = jobMeta;
    } else {
      segment.elements.push({ type: 'jobMarker', ...jobMeta });
      this.lineOpen = false;
    }
  }

  applyCommand(cmd: ParsedCommand, state: PrinterState): void {
    switch (cmd.type) {
      case 'text':
        this.appendText(decodeText(cmd.bytes), state);
        break;
      case 'lineFeed':
        this.breakLine();
        break;
      case 'feedLines':
        for (let i = 0; i < cmd.lines; i++) this.breakLine();
        break;
      case 'feedDots':
        this.currentSegment().elements.push({ type: 'spacer', heightPx: cmd.dots });
        this.lineOpen = false;
        break;
      case 'cut':
        this.currentSegment().cut = { mode: cmd.mode, timestamp: Date.now() };
        this.receipt.segments.push(this.newSegment());
        this.lineOpen = false;
        break;
      case 'rasterImage':
        this.appendImage(cmd.widthBytes, cmd.heightDots, cmd.data, state);
        break;
      case 'init':
      case 'bold':
      case 'underline':
      case 'align':
      case 'size':
        // State-only commands: PrintJob already applied these to PrinterState.
        break;
      case 'unsupported':
        // No visual effect; the caller is responsible for logging.
        break;
    }
  }

  private newSegment(jobMeta?: JobMeta): ReceiptSegment {
    return { id: randomUUID(), elements: [], jobMeta };
  }

  private currentSegment(): ReceiptSegment {
    return this.receipt.segments[this.receipt.segments.length - 1];
  }

  private currentLine(): ReceiptLine {
    const segment = this.currentSegment();
    const last = segment.elements[segment.elements.length - 1];
    if (last?.type === 'line') return last;
    throw new Error('currentLine() called with no open line');
  }

  private breakLine(): void {
    if (this.lineOpen) {
      this.lineOpen = false;
      return;
    }
    // Already closed (or nothing printed yet on this segment) — an explicit blank line feed.
    this.currentSegment().elements.push({ type: 'line', align: 'left', spans: [] });
  }

  private appendText(text: string, state: PrinterState): void {
    for (const ch of text) {
      this.appendChar(ch, state);
    }
  }

  private appendChar(ch: string, state: PrinterState): void {
    if (!this.lineOpen) {
      this.currentSegment().elements.push({ type: 'line', align: state.align, spans: [] });
      this.lineOpen = true;
    }

    const charCells = state.widthMultiplier;
    if (lineCellWidth(this.currentLine()) + charCells > this.receipt.columns && lineCellWidth(this.currentLine()) > 0) {
      this.currentSegment().elements.push({ type: 'line', align: state.align, spans: [] });
    }

    const line = this.currentLine();
    const lastSpan = line.spans[line.spans.length - 1];
    if (lastSpan && spanMatches(lastSpan, state)) {
      lastSpan.text += ch;
    } else {
      line.spans.push({
        text: ch,
        bold: state.bold,
        underline: state.underline,
        widthMultiplier: state.widthMultiplier,
        heightMultiplier: state.heightMultiplier,
      });
    }
  }

  private appendImage(widthBytes: number, heightDots: number, data: Buffer, state: PrinterState): void {
    this.lineOpen = false;
    const { pngDataUrl, widthPx, heightPx } = rasterToPngDataUrl(widthBytes, heightDots, data);
    this.currentSegment().elements.push({ type: 'image', align: state.align, widthPx, heightPx, pngDataUrl });
  }
}
