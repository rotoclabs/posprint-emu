import type { Align } from '../escpos/types.js';

export interface PrinterState {
  bold: boolean;
  underline: boolean;
  align: Align;
  widthMultiplier: number;
  heightMultiplier: number;
}

export function defaultPrinterState(): PrinterState {
  return {
    bold: false,
    underline: false,
    align: 'left',
    widthMultiplier: 1,
    heightMultiplier: 1,
  };
}
