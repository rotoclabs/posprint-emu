import { describe, expect, it } from 'vitest';
import { ReceiptModel } from '../src/receipt/ReceiptModel.js';
import { defaultPrinterState, type PrinterState } from '../src/receipt/PrinterState.js';
import type { ReceiptLine } from '../src/receipt/types.js';

function text(s: string) {
  return { type: 'text' as const, bytes: Buffer.from(s, 'ascii') };
}

function state(overrides: Partial<PrinterState> = {}): PrinterState {
  return { ...defaultPrinterState(), ...overrides };
}

function lines(model: ReceiptModel) {
  return model
    .getSnapshot()
    .segments.flatMap((s) => s.elements)
    .filter((e): e is ReceiptLine => e.type === 'line');
}

describe('ReceiptModel', () => {
  it('hard-wraps plain text at the exact column boundary', () => {
    const model = new ReceiptModel(5);
    model.applyCommand(text('ABCDEFGHIJ'), state());

    const wrapped = lines(model).map((l) => l.spans.map((s) => s.text).join(''));
    expect(wrapped).toEqual(['ABCDE', 'FGHIJ']);
  });

  it('wraps double-width text where each character consumes two cells', () => {
    const model = new ReceiptModel(5);
    model.applyCommand(text('ABC'), state({ widthMultiplier: 2 }));

    const wrapped = lines(model).map((l) => l.spans.map((s) => s.text).join(''));
    expect(wrapped).toEqual(['AB', 'C']);
  });

  it('merges consecutive same-formatting characters into one span', () => {
    const model = new ReceiptModel(48);
    model.applyCommand(text('Hello'), state({ bold: true }));

    const [line] = lines(model);
    expect(line.spans).toEqual([{ text: 'Hello', bold: true, underline: false, widthMultiplier: 1, heightMultiplier: 1 }]);
  });

  it('cut closes the current segment and opens a new one', () => {
    const model = new ReceiptModel(48);
    model.applyCommand(text('first'), state());
    model.applyCommand({ type: 'cut', mode: 'full' }, state());
    model.applyCommand(text('second'), state());

    const snapshot = model.getSnapshot();
    expect(snapshot.segments).toHaveLength(2);
    expect(snapshot.segments[0].cut).toEqual(expect.objectContaining({ mode: 'full' }));
    expect(snapshot.segments[1].cut).toBeUndefined();
  });

  it('init is a no-op on the receipt (formatting reset happens upstream in PrintJob)', () => {
    const model = new ReceiptModel(48);
    model.applyCommand(text('kept'), state());
    const before = JSON.stringify(model.getSnapshot());

    model.applyCommand({ type: 'init' }, state());

    expect(JSON.stringify(model.getSnapshot())).toBe(before);
  });

  it('two consecutive line feeds render one blank line between text blocks', () => {
    const model = new ReceiptModel(48);
    model.applyCommand(text('top'), state());
    model.applyCommand({ type: 'lineFeed' }, state());
    model.applyCommand({ type: 'lineFeed' }, state());
    model.applyCommand(text('bottom'), state());

    const wrapped = lines(model).map((l) => l.spans.map((s) => s.text).join(''));
    expect(wrapped).toEqual(['top', '', 'bottom']);
  });
});
