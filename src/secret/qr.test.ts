import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { secretPageUrl } from './destination';
import { QUIET_ZONE, encodeQr, qrPath, type QrCode } from './qr';

/** Rasterise the code the way QrReveal draws it (quiet zone included) and read it back with a real decoder. */
function scan(code: QrCode, px = 6): string | null {
  const side = (code.size + 2 * QUIET_ZONE) * px;
  const rgba = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let r = 0; r < code.size; r += 1) {
    for (let c = 0; c < code.size; c += 1) {
      if (!code.isDark(r, c)) continue;
      for (let y = 0; y < px; y += 1) {
        for (let x = 0; x < px; x += 1) {
          const i = (((r + QUIET_ZONE) * px + y) * side + (c + QUIET_ZONE) * px + x) * 4;
          rgba[i] = rgba[i + 1] = rgba[i + 2] = 0;
        }
      }
    }
  }
  return jsQR(rgba, side, side)?.data ?? null;
}

/** Rebuild the module grid from the SVG path QrReveal renders, so the drawn code itself is checked. */
function fromPath(d: string, size: number): QrCode {
  const dark = new Set<string>();
  for (const [, x, y, w] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let i = 0; i < Number(w); i += 1) dark.add(`${Number(y) - QUIET_ZONE},${Number(x) - QUIET_ZONE + i}`);
  }
  return { size, isDark: (r, c) => dark.has(`${r},${c}`) };
}

describe('the QR code', () => {
  const destinations = [
    secretPageUrl({ origin: 'https://lastbrew.example', base: '/' }),
    secretPageUrl({ origin: 'https://lonecod3r.github.io', base: '/THE-LAST-BREW/' }),
    secretPageUrl({ origin: 'http://192.168.1.20:5173', base: '/' }),
  ];

  it('round-trips: a real decoder reads back exactly the secret page URL', () => {
    for (const url of destinations) expect(scan(encodeQr(url))).toBe(url);
  });

  it('the drawn SVG path is the same code, and decodes to the same URL', () => {
    for (const url of destinations) {
      const code = encodeQr(url);
      expect(scan(fromPath(qrPath(code), code.size))).toBe(url);
    }
  });

  it('is a small, easily scanned version with the standard quiet zone', () => {
    const code = encodeQr(destinations[1]);
    // Version 4 (33 modules) or below for these addresses: large modules at phone-scanning sizes.
    expect(code.size).toBeLessThanOrEqual(33);
    expect(QUIET_ZONE).toBe(4);
    expect(qrPath(code)).toMatch(/^M4 4h7v1h-7z/);
  });
});
