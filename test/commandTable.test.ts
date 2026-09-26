import { describe, expect, it } from 'vitest';
import { boldSpec, underlineSpec, alignSpec, sizeSpec } from '../src/escpos/commands/formatting.js';
import { feedLinesSpec, feedDotsSpec, lineFeedSpec } from '../src/escpos/commands/feed.js';
import { cutSpec } from '../src/escpos/commands/cut.js';
import { rasterImageSpec } from '../src/escpos/commands/image.js';
import { qr2dSpec } from '../src/escpos/commands/qrCode.js';
import { initSpec } from '../src/escpos/commands/init.js';

describe('command decoders', () => {
  it('init', () => {
    expect(initSpec.decode(Buffer.from([]))).toEqual({ type: 'init' });
  });

  it('bold on/off', () => {
    expect(boldSpec.decode(Buffer.from([1]))).toEqual({ type: 'bold', on: true });
    expect(boldSpec.decode(Buffer.from([0]))).toEqual({ type: 'bold', on: false });
  });

  it('underline collapses weight to boolean', () => {
    expect(underlineSpec.decode(Buffer.from([0]))).toEqual({ type: 'underline', on: false });
    expect(underlineSpec.decode(Buffer.from([1]))).toEqual({ type: 'underline', on: true });
    expect(underlineSpec.decode(Buffer.from([2]))).toEqual({ type: 'underline', on: true });
  });

  it('align maps 0/1/2 to left/center/right', () => {
    expect(alignSpec.decode(Buffer.from([0]))).toEqual({ type: 'align', align: 'left' });
    expect(alignSpec.decode(Buffer.from([1]))).toEqual({ type: 'align', align: 'center' });
    expect(alignSpec.decode(Buffer.from([2]))).toEqual({ type: 'align', align: 'right' });
  });

  it('size unpacks width/height nibbles', () => {
    expect(sizeSpec.decode(Buffer.from([0x00]))).toEqual({ type: 'size', widthMultiplier: 1, heightMultiplier: 1 });
    expect(sizeSpec.decode(Buffer.from([0x11]))).toEqual({ type: 'size', widthMultiplier: 2, heightMultiplier: 2 });
    expect(sizeSpec.decode(Buffer.from([0x70]))).toEqual({ type: 'size', widthMultiplier: 8, heightMultiplier: 1 });
  });

  it('line feed', () => {
    expect(lineFeedSpec.decode(Buffer.from([]))).toEqual({ type: 'lineFeed' });
  });

  it('feed n lines / n dots', () => {
    expect(feedLinesSpec.decode(Buffer.from([5]))).toEqual({ type: 'feedLines', lines: 5 });
    expect(feedDotsSpec.decode(Buffer.from([40]))).toEqual({ type: 'feedDots', dots: 40 });
  });

  it('cut: immediate full/partial, and feed-then-cut variants requiring one extra byte', () => {
    expect(cutSpec.totalLength(Buffer.from([0x00]))).toBe(0);
    expect(cutSpec.decode(Buffer.from([0x00]))).toEqual({ type: 'cut', mode: 'full' });
    expect(cutSpec.decode(Buffer.from([0x30]))).toEqual({ type: 'cut', mode: 'full' });
    expect(cutSpec.decode(Buffer.from([0x01]))).toEqual({ type: 'cut', mode: 'partial' });
    expect(cutSpec.decode(Buffer.from([0x31]))).toEqual({ type: 'cut', mode: 'partial' });

    expect(cutSpec.totalLength(Buffer.from([0x41]))).toBe(1);
    expect(cutSpec.decode(Buffer.from([0x41, 5]))).toEqual({ type: 'cut', mode: 'full' });
    expect(cutSpec.totalLength(Buffer.from([0x42]))).toBe(1);
    expect(cutSpec.decode(Buffer.from([0x42, 5]))).toEqual({ type: 'cut', mode: 'partial' });
  });

  it('raster image header math and payload slicing', () => {
    // m=0, width=2 bytes/row, height=3 dots -> 6 data bytes
    const header = Buffer.from([0x00, 2, 0, 3, 0]);
    expect(rasterImageSpec.totalLength(header)).toBe(6);

    const payload = Buffer.from([0x00, 2, 0, 3, 0, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66]);
    expect(rasterImageSpec.decode(payload)).toEqual({
      type: 'rasterImage',
      widthBytes: 2,
      heightDots: 3,
      data: Buffer.from([0x11, 0x22, 0x33, 0x44, 0x55, 0x66]),
    });
  });

  describe('QR code (GS ( k)', () => {
    it('select model', () => {
      const payload = Buffer.from([4, 0, 0x31, 0x41, 50, 0]);
      expect(qr2dSpec.totalLength(payload.subarray(0, 2))).toBe(4);
      expect(qr2dSpec.decode(payload)).toEqual({ type: 'qrSelectModel', model: 50 });
    });

    it('set module size', () => {
      const payload = Buffer.from([3, 0, 0x31, 0x43, 5]);
      expect(qr2dSpec.decode(payload)).toEqual({ type: 'qrModuleSize', size: 5 });
    });

    it('set error correction level maps 48-51 to L/M/Q/H', () => {
      expect(qr2dSpec.decode(Buffer.from([3, 0, 0x31, 0x45, 0x30]))).toEqual({
        type: 'qrErrorCorrection',
        level: 'L',
      });
      expect(qr2dSpec.decode(Buffer.from([3, 0, 0x31, 0x45, 0x31]))).toEqual({
        type: 'qrErrorCorrection',
        level: 'M',
      });
      expect(qr2dSpec.decode(Buffer.from([3, 0, 0x31, 0x45, 0x32]))).toEqual({
        type: 'qrErrorCorrection',
        level: 'Q',
      });
      expect(qr2dSpec.decode(Buffer.from([3, 0, 0x31, 0x45, 0x33]))).toEqual({
        type: 'qrErrorCorrection',
        level: 'H',
      });
    });

    it('store data slices off cn/fn/m and keeps the rest', () => {
      const data = Buffer.from('HELLO');
      const payload = Buffer.concat([Buffer.from([data.length + 3, 0, 0x31, 0x50, 0x30]), data]);
      expect(qr2dSpec.totalLength(payload.subarray(0, 2))).toBe(data.length + 3);
      expect(qr2dSpec.decode(payload)).toEqual({ type: 'qrStoreData', data });
    });

    it('print stored symbol', () => {
      const payload = Buffer.from([3, 0, 0x31, 0x51, 0x30]);
      expect(qr2dSpec.decode(payload)).toEqual({ type: 'qrPrint' });
    });

    it('unrecognized cn/fn decode as unsupported, not a crash', () => {
      const wrongCn = Buffer.from([2, 0, 0x30, 0x41]);
      expect(qr2dSpec.decode(wrongCn)).toEqual({ type: 'unsupported', name: 'qr2d:cn48', bytes: wrongCn });

      const wrongFn = Buffer.from([2, 0, 0x31, 0x52]);
      expect(qr2dSpec.decode(wrongFn)).toEqual({ type: 'unsupported', name: 'qr2d:fn82', bytes: wrongFn });
    });
  });
});
