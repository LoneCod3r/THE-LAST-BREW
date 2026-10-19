import { describe, expect, it } from 'vitest';
import { preprocessCSS, resolveConfig } from 'vite';
import { SUPPORTS_NOT, containerUnitFallback, toFallback, usesContainerUnits } from './containerUnitFallback';

// Vitest serves CSS imports as an empty string, so the stylesheet is read from disk.
const fs = (await import('node:fs' as string)) as { readFileSync(path: URL, encoding: 'utf8'): string };
const source = fs.readFileSync(new URL('./vending.css', import.meta.url), 'utf8');

/** vending.css through Vite's own CSS pipeline with the plugin, as the dev server and the build run it. */
async function processed(code: string) {
  const config = await resolveConfig({ configFile: false, logLevel: 'silent', css: { postcss: { plugins: [containerUnitFallback()] } } }, 'serve');
  return (await preprocessCSS(code, 'vending.css', config)).code;
}

describe('container-unit fallback: the conversion', () => {
  it('swaps each unit for its custom property, leaving everything else as it was', () => {
    expect(toFallback('7.4cqw')).toBe('calc(7.4 * var(--cqw))');
    expect(toFallback('max(44px, 7.4cqw)')).toBe('max(44px, calc(7.4 * var(--cqw)))');
    expect(toFallback('calc(-1 * max(1px, 0.3cqw))')).toBe('calc(-1 * max(1px, calc(0.3 * var(--cqw))))');
    expect(toFallback('drop-shadow(1.4cqw 2cqw 1cqw rgba(0, 0, 0, 0.3))')).toBe(
      'drop-shadow(calc(1.4 * var(--cqw)) calc(2 * var(--cqw)) calc(1 * var(--cqw)) rgba(0, 0, 0, 0.3))',
    );
    expect(toFallback('min(100cqw, 640px, calc((100cqh - 2px) * 487 / 608))')).toBe(
      'min(calc(100 * var(--cqw)), 640px, calc((calc(100 * var(--cqh)) - 2px) * 487 / 608))',
    );
    expect(toFallback('.5cqw')).toBe('calc(.5 * var(--cqw))');
    // Not container units: untouched.
    expect(toFallback('1.2em 4px 50% var(--fpad)')).toBe('1.2em 4px 50% var(--fpad)');
    expect(usesContainerUnits('max(2px, 0.55cqw)')).toBe(true);
    expect(usesContainerUnits('var(--cqw)')).toBe(false);
  });
});

describe('container-unit fallback: vending.css through Vite', () => {
  it('keeps every original declaration, and adds an @supports-not copy for each one that uses the units', async () => {
    const out = await processed(source);
    const original = [...source.matchAll(/(\d|\.)cq[wh]\b/g)].length;
    expect(original).toBeGreaterThan(100);
    // The originals are all still there (modern browsers keep using them) …
    const kept = [...out.replace(/@supports not \(width: 1cqw\)/g, '').matchAll(/(\d|\.)cq[wh]\b/g)].length;
    expect(kept).toBe(original);
    // … and every unit has its stand-in, only inside the @supports-not copies.
    expect([...out.matchAll(/var\(--cq[wh]\)/g)].length).toBe(original);
    const blocks = out.split(`@supports ${SUPPORTS_NOT}`).slice(1);
    expect(blocks.length).toBeGreaterThan(40);
    for (const block of blocks) expect(block.slice(0, block.indexOf('}'))).not.toMatch(/(\d|\.)cq[wh]\b/);
  });

  it('copies the custom property --depth and the @keyframes that use the units, whole', async () => {
    const out = await processed(source);
    expect(out).toContain('--depth: max(2px, calc(0.55 * var(--cqw)))');
    for (const name of ['vm-alert-a', 'vm-alert-b', 'hand-press']) {
      expect(out).toMatch(new RegExp(`@supports not \\(width: 1cqw\\) \\{\\s*@keyframes ${name}`));
    }
  });

  it('places each copy right after its rule, with the same selector', async () => {
    const out = await processed('.a { color: red; width: max(44px, 7.4cqw); }\n.b { width: 50%; }\n');
    const tidy = (css: string) => css.replace(/\s+/g, ' ').replace(/\s*([{};])\s*/g, '$1').trim();
    expect(tidy(out)).toBe(
      tidy('.a { color: red; width: max(44px, 7.4cqw); } @supports not (width: 1cqw) { .a { width: max(44px, calc(7.4 * var(--cqw))); } } .b { width: 50%; }'),
    );
  });
});
