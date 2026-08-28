import { GS } from '../constants.js';
import type { CommandSpec } from '../types.js';

/** GS v 0: raster bit image. Header is [m, xL, xH, yL, yH]; only mode m=0 (normal) is rendered. */
export const rasterImageSpec: CommandSpec = {
  name: 'rasterImage',
  prefix: [GS, 0x76, 0x30],
  headerLength: 5,
  totalLength: (header) => {
    const widthBytes = header[1] + 256 * header[2];
    const heightDots = header[3] + 256 * header[4];
    return widthBytes * heightDots;
  },
  decode: (payload) => {
    const widthBytes = payload[1] + 256 * payload[2];
    const heightDots = payload[3] + 256 * payload[4];
    const data = payload.subarray(5, 5 + widthBytes * heightDots);
    return { type: 'rasterImage', widthBytes, heightDots, data: Buffer.from(data) };
  },
};
