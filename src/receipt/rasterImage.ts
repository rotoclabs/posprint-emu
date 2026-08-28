import { PNG } from 'pngjs';

export interface RasterPng {
  pngDataUrl: string;
  widthPx: number;
  heightPx: number;
}

/**
 * Converts an ESC/POS raster bit image (MSB-first, 1 bit per pixel, row-major) into a PNG
 * data URL. A set bit is rendered as opaque black; a clear bit is transparent so the paper
 * background shows through, matching how a thermal printhead only marks where it fires.
 */
export function rasterToPngDataUrl(widthBytes: number, heightDots: number, data: Buffer): RasterPng {
  const widthPx = widthBytes * 8;
  const heightPx = heightDots;
  const png = new PNG({ width: widthPx, height: heightPx });

  for (let y = 0; y < heightPx; y++) {
    for (let xByte = 0; xByte < widthBytes; xByte++) {
      const byte = data[y * widthBytes + xByte] ?? 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = xByte * 8 + bit;
        const isBlack = ((byte >> (7 - bit)) & 1) === 1;
        const idx = (widthPx * y + x) << 2;
        png.data[idx] = 0;
        png.data[idx + 1] = 0;
        png.data[idx + 2] = 0;
        png.data[idx + 3] = isBlack ? 255 : 0;
      }
    }
  }

  const buf = PNG.sync.write(png);
  return { pngDataUrl: `data:image/png;base64,${buf.toString('base64')}`, widthPx, heightPx };
}
