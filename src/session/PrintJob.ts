import { randomUUID } from 'node:crypto';
import { StreamingTokenizer } from '../escpos/tokenizer.js';
import type { ParsedCommand } from '../escpos/types.js';
import { defaultPrinterState, type PrinterState } from '../receipt/PrinterState.js';
import type { ReceiptModel } from '../receipt/ReceiptModel.js';

/**
 * Owns per-connection parsing state (tokenizer + PrinterState) so concurrent connections
 * can never corrupt each other's parse state, while writing into the one shared ReceiptModel.
 */
export class PrintJob {
  readonly connectionId = randomUUID();
  private readonly tokenizer = new StreamingTokenizer();
  private state: PrinterState = defaultPrinterState();

  constructor(
    private readonly receipt: ReceiptModel,
    readonly remoteAddress: string,
    private readonly onUnsupported: (name: string, job: PrintJob) => void = () => {},
  ) {
    this.receipt.startJob({
      connectionId: this.connectionId,
      remoteAddress: this.remoteAddress,
      startedAt: Date.now(),
    });
  }

  feed(chunk: Buffer): void {
    for (const cmd of this.tokenizer.feed(chunk)) {
      this.apply(cmd);
    }
  }

  end(): void {
    for (const cmd of this.tokenizer.end()) {
      this.apply(cmd);
    }
  }

  private apply(cmd: ParsedCommand): void {
    switch (cmd.type) {
      case 'init':
        this.state = defaultPrinterState();
        break;
      case 'bold':
        this.state.bold = cmd.on;
        break;
      case 'underline':
        this.state.underline = cmd.on;
        break;
      case 'align':
        this.state.align = cmd.align;
        break;
      case 'size':
        this.state.widthMultiplier = cmd.widthMultiplier;
        this.state.heightMultiplier = cmd.heightMultiplier;
        break;
      case 'qrSelectModel':
        this.state.qrModel = cmd.model;
        break;
      case 'qrModuleSize':
        this.state.qrModuleSize = cmd.size;
        break;
      case 'qrErrorCorrection':
        this.state.qrErrorCorrection = cmd.level;
        break;
      case 'qrStoreData':
        this.state.qrPendingData = cmd.data;
        break;
      case 'unsupported':
        this.onUnsupported(cmd.name, this);
        break;
      default:
        break;
    }
    this.receipt.applyCommand(cmd, this.state);
    // Cleared only after ReceiptModel has read it above, so PrintJob stays the sole owner of PrinterState mutation.
    if (cmd.type === 'qrPrint') this.state.qrPendingData = null;
  }
}
