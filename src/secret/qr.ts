import qrcode from 'qrcode-generator';

/** The blank margin scanners need around the code, in modules (the QR standard's minimum). */
export const QUIET_ZONE = 4;

export interface QrCode {
  /** Modules per side, without the quiet zone. */
  size: number;
  isDark: (row: number, col: number) => boolean;
}

/** Encode `text` as a real QR code (byte mode, error correction M, smallest version that fits). */
export function encodeQr(text: string): QrCode {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return { size: qr.getModuleCount(), isDark: (r, c) => qr.isDark(r, c) };
}

/** One SVG path for every dark module, offset by the quiet zone; runs along a row are merged. */
export function qrPath({ size, isDark }: QrCode): string {
  let d = '';
  for (let r = 0; r < size; r += 1) {
    let c = 0;
    while (c < size) {
      if (!isDark(r, c)) {
        c += 1;
        continue;
      }
      const start = c;
      while (c < size && isDark(r, c)) c += 1;
      d += `M${start + QUIET_ZONE} ${r + QUIET_ZONE}h${c - start}v1h${start - c}z`;
    }
  }
  return d;
}
