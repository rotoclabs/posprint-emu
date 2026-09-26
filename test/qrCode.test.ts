import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { renderQrCode } from '../src/receipt/qrCode.js';

/** jsQR needs opaque RGB pixels, not our transparent-quiet-zone PNG convention — composite over white. */
function toOpaqueRgba(png: PNG): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(png.width * png.height * 4);
  for (let i = 0; i < png.width * png.height; i++) {
    const alpha = png.data[i * 4 + 3] / 255;
    const value = Math.round(255 * (1 - alpha));
    rgba[i * 4] = value;
    rgba[i * 4 + 1] = value;
    rgba[i * 4 + 2] = value;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

function decode(pngDataUrl: string): Uint8ClampedArray | null {
  const base64 = pngDataUrl.slice('data:image/png;base64,'.length);
  const png = PNG.sync.read(Buffer.from(base64, 'base64'));
  const result = jsQR(toOpaqueRgba(png), png.width, png.height);
  return result ? Buffer.from(result.binaryData) : null;
}

describe('renderQrCode', () => {
  it('sizes the image as (modules + quiet zone) * moduleSizePx', () => {
    const { widthPx, heightPx } = renderQrCode(Buffer.from('short'), 3, 'L');
    expect(widthPx).toBe(heightPx);
    expect(widthPx % 3).toBe(0);
    expect(widthPx).toBeGreaterThan(3 * 8 * 2); // at least the 8-module quiet zone alone
  });

  it('clamps a zero/negative module size to 1px rather than producing an empty image', () => {
    const { widthPx } = renderQrCode(Buffer.from('x'), 0, 'L');
    expect(widthPx).toBeGreaterThan(0);
  });

  it('renders a genuinely scannable code: decoding it recovers the original bytes', () => {
    const data = Buffer.from('https://cafetops.example/order/12345');
    const { pngDataUrl } = renderQrCode(data, 4, 'M');

    const decoded = decode(pngDataUrl);
    expect(decoded).not.toBeNull();
    expect(decoded).toEqual(data);
  });

  it('a higher error-correction level still decodes correctly', () => {
    const data = Buffer.from('order-98765');
    const { pngDataUrl } = renderQrCode(data, 6, 'H');

    expect(decode(pngDataUrl)).toEqual(data);
  });
});
