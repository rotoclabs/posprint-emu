import type { Align, QrErrorCorrectionLevel } from '../escpos/types.js';

export interface PrinterState {
  bold: boolean;
  underline: boolean;
  align: Align;
  widthMultiplier: number;
  heightMultiplier: number;
  qrModel: number;
  qrModuleSize: number;
  qrErrorCorrection: QrErrorCorrectionLevel;
  qrPendingData: Buffer | null;
}

export function defaultPrinterState(): PrinterState {
  return {
    bold: false,
    underline: false,
    align: 'left',
    widthMultiplier: 1,
    heightMultiplier: 1,
    qrModel: 50,
    qrModuleSize: 3,
    qrErrorCorrection: 'L',
    qrPendingData: null,
  };
}
