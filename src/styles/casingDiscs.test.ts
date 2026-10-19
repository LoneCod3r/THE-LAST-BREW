import { describe, expect, it } from 'vitest';

// Vitest serves CSS imports (even ?raw) as an empty string, so the stylesheet is read from disk.
const fs = (await import('node:fs' as string)) as { readFileSync(path: URL, encoding: 'utf8'): string };
const css = fs.readFileSync(new URL('./vending.css', import.meta.url), 'utf8');

/** The declarations of every top-level rule whose whole selector is exactly `selector`, merged in order. */
function rule(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  let found = false;
  for (const [, sel, body] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (sel.trim() !== selector) continue;
    found = true;
    for (const m of body.matchAll(/([a-z-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].replace(/\s+/g, ' ').trim();
  }
  expect(found, `${selector} not found`).toBe(true);
  return out;
}

/** The ring: the spread of the first box-shadow layer (0 0 0 <spread>). */
const ring = (decl: Record<string, string>) => decl['box-shadow'].match(/^0 0 0 (max\([^)]*\)|[^ ,]+)/)?.[1];

describe('the Secret Blend seal and the ? disc', () => {
  it('have the same visible diameter at every size: the same width rule and the same ring', () => {
    const seal = rule('.casing__seal-disc');
    const disc = rule('.casing__puzzle-disc');
    expect(seal.width).toBe('max(18px, 4.2cqw)');
    expect(seal.width).toBe(disc.width);
    expect(seal['aspect-ratio']).toBe('1');
    expect(disc['aspect-ratio']).toBe('1');
    expect(ring(seal)).toBe('max(1px, 0.25cqw)');
    expect(ring(seal)).toBe(ring(disc));
  });

  it('both fit inside their tap boxes, which are not changed', () => {
    expect(rule('.casing__seal')).toMatchObject({ width: 'max(44px, 9cqw)', height: 'max(44px, 9cqw)' });
    expect(rule('.casing__puzzle')).toMatchObject({ width: 'max(28px, 11cqw)', height: 'max(44px, 7.4cqw)' });
  });
});
