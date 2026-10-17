import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { secretPageUrl } from '../secret/destination';
import { MoreCoffeeKey } from './MoreCoffeeKey';
import { QrReveal } from './QrReveal';

const noop = () => {};
const URL_ = secretPageUrl({ origin: 'https://lastbrew.example', base: '/' });
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('the casing key', () => {
  it('reads MORE COFFEE by default and exactly "Enough?" when asked', () => {
    expect(text(renderToString(createElement(MoreCoffeeKey, { shown: true, onPress: noop })))).toBe('MORE COFFEE');
    expect(text(renderToString(createElement(MoreCoffeeKey, { shown: true, onPress: noop, label: 'Enough?' })))).toBe('Enough?');
  });
});

describe('the QR reveal', () => {
  const html = renderToString(createElement(QrReveal, { href: URL_, onContinue: noop }));

  it('the code is a link to the real secret page, opened in a new tab so the game session is kept', () => {
    expect(html).toContain(`href="${URL_}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener"');
    expect(html).toMatch(/<path d="M4 4h7v1h-7z[^"]*"/);
  });

  it('explains nothing: no caption, no "unlocked", only the key that returns to the machine', () => {
    expect(text(html)).toBe('MORE COFFEE');
    expect(html).not.toMatch(/unlock|secret|level|congrat/i);
  });

  it('MORE COFFEE is not pressable until the code has surfaced', () => {
    expect(html).toMatch(/class="more-key more-key--free qr-reveal__key"/);
    expect(html).not.toContain('is-shown');
  });
});
