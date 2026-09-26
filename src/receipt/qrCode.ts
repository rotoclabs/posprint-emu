import { PNG } from 'pngjs';
import QRCode from 'qrcode';
import type { QrErrorCorrectionLevel } from '../escpos/types.js';
import type { RasterPng } from './rasterImage.js';

const ERROR_CORRECTION_LEVEL_MAP: Record<QrErrorCorrectionLevel, 'low' | 'medium' | 'quartile' | 'high'> = {
  L: 'low',
  M: 'medium',
  Q: 'quartile',
  H: 'high',
};

/** QR spec's recommended minimum quiet zone; Epson's command set has no separate control for it. */
const QUIET_ZONE_MODULES = 4;

/**
 * Renders raw ESC/POS-stored QR data (byte mode, exactly as stored — no charset assumptions)
 * into a PNG, at `moduleSizePx` pixels per module (matching the printer's own dots-per-module
 * convention, and this project's existing 1-dot-per-pixel raster image rendering). A clear
 * module is transparent, same convention as `rasterToPngDataUrl`, so the paper background
 * shows through the quiet zone and light modules.
 */
export function renderQrCode(
  data: Buffer,
  moduleSizePx: number,
  errorCorrectionLevel: QrErrorCorrectionLevel,
): RasterPng {
  const qr = QRCode.create([{ mode: 'byte', data }], {
    errorCorrectionLevel: ERROR_CORRECTION_LEVEL_MAP[errorCorrectionLevel],
  });

  const scale = Math.max(1, moduleSizePx);
  const moduleCount = qr.modules.size;
  const sizePx = (moduleCount + QUIET_ZONE_MODULES * 2) * scale;

  const png = new PNG({ width: sizePx, height: sizePx });
  for (let y = 0; y < sizePx; y++) {
    const moduleRow = Math.floor(y / scale) - QUIET_ZONE_MODULES;
    for (let x = 0; x < sizePx; x++) {
      const moduleCol = Math.floor(x / scale) - QUIET_ZONE_MODULES;
      const inSymbol = moduleRow >= 0 && moduleRow < moduleCount && moduleCol >= 0 && moduleCol < moduleCount;
      const isDark = inSymbol && qr.modules.get(moduleRow, moduleCol) === 1;

      const idx = (sizePx * y + x) << 2;
      png.data[idx] = 0;
      png.data[idx + 1] = 0;
      png.data[idx + 2] = 0;
      png.data[idx + 3] = isDark ? 255 : 0;
    }
  }

  const buf = PNG.sync.write(png);
  return { pngDataUrl: `data:image/png;base64,${buf.toString('base64')}`, widthPx: sizePx, heightPx: sizePx };
}
