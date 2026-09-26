import { GS } from '../constants.js';
import type { CommandSpec, ParsedCommand, QrErrorCorrectionLevel } from '../types.js';

/** cn: "function type" byte. Only 49 (QR Code) is supported; others (PDF417, MaxiCode, ...) are out of scope. */
const CN_QR_CODE = 0x31;

const FN_SELECT_MODEL = 0x41;
const FN_SET_MODULE_SIZE = 0x43;
const FN_SET_ERROR_CORRECTION = 0x45;
const FN_STORE_DATA = 0x50;
const FN_PRINT_SYMBOL = 0x51;

const ERROR_CORRECTION_MAP: Record<number, QrErrorCorrectionLevel> = {
  0x30: 'L',
  0x31: 'M',
  0x32: 'Q',
  0x33: 'H',
};

/**
 * GS ( k: Epson "2D symbol" command family. Header is [pL, pH] (length of everything from cn
 * onward); only cn=49 (QR Code) is decoded, dispatching on fn to one of five sub-commands
 * (select model, set module size, set error-correction level, store data, print stored symbol).
 */
export const qr2dSpec: CommandSpec = {
  name: 'qr2d',
  prefix: [GS, 0x28, 0x6b],
  headerLength: 2,
  totalLength: (header) => header[0] + 256 * header[1],
  decode: (payload): ParsedCommand => {
    const cn = payload[2];
    const fn = payload[3];

    if (cn !== CN_QR_CODE) {
      return { type: 'unsupported', name: `qr2d:cn${cn}`, bytes: payload };
    }

    switch (fn) {
      case FN_SELECT_MODEL:
        return { type: 'qrSelectModel', model: payload[4] };
      case FN_SET_MODULE_SIZE:
        return { type: 'qrModuleSize', size: payload[4] };
      case FN_SET_ERROR_CORRECTION:
        return { type: 'qrErrorCorrection', level: ERROR_CORRECTION_MAP[payload[4]] ?? 'L' };
      case FN_STORE_DATA:
        return { type: 'qrStoreData', data: Buffer.from(payload.subarray(5)) };
      case FN_PRINT_SYMBOL:
        return { type: 'qrPrint' };
      default:
        return { type: 'unsupported', name: `qr2d:fn${fn}`, bytes: payload };
    }
  },
};
