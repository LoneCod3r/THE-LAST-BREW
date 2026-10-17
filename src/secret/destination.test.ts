import { describe, expect, it } from 'vitest';
import { SECRET_PATH, secretPageUrl } from './destination';

describe('the QR destination', () => {
  it('is the secret page under the address the game is served from', () => {
    expect(secretPageUrl({ origin: 'https://lastbrew.example', base: '/' })).toBe('https://lastbrew.example/last-drop/');
    expect(SECRET_PATH).toBe('last-drop/');
  });

  it('follows a base path, e.g. a GitHub Pages project site', () => {
    expect(secretPageUrl({ origin: 'https://lonecod3r.github.io', base: '/THE-LAST-BREW/' })).toBe(
      'https://lonecod3r.github.io/THE-LAST-BREW/last-drop/',
    );
    expect(secretPageUrl({ origin: 'https://lonecod3r.github.io', base: '/THE-LAST-BREW' })).toBe(
      'https://lonecod3r.github.io/THE-LAST-BREW/last-drop/',
    );
  });

  it('in development it is whatever address the dev server was opened on, e.g. its network URL', () => {
    expect(secretPageUrl({ origin: 'http://192.168.1.20:5173', base: '/' })).toBe('http://192.168.1.20:5173/last-drop/');
  });

  it('a deployed game never encodes localhost: nothing is hardcoded', () => {
    for (const origin of ['https://lastbrew.example', 'https://lonecod3r.github.io', 'http://192.168.1.20:4173']) {
      const url = new URL(secretPageUrl({ origin, base: '/' }));
      expect(url.origin).toBe(origin);
      expect(url.hostname).not.toMatch(/^(localhost|127\.0\.0\.1)$/);
    }
  });

  it('VITE_PUBLIC_URL, when set, is the public address instead (path kept; query and hash dropped)', () => {
    const where = { origin: 'http://localhost:5173', base: '/' };
    expect(secretPageUrl({ ...where, publicUrl: 'https://lastbrew.example' })).toBe('https://lastbrew.example/last-drop/');
    expect(secretPageUrl({ ...where, publicUrl: ' https://lastbrew.example/game?x=1#y ' })).toBe('https://lastbrew.example/game/last-drop/');
  });

  it('an unusable VITE_PUBLIC_URL is ignored rather than encoded', () => {
    const where = { origin: 'https://lastbrew.example', base: '/' };
    for (const publicUrl of ['', '   ', 'not a url', 'javascript:alert(1)', 'ftp://lastbrew.example/']) {
      expect(secretPageUrl({ ...where, publicUrl })).toBe('https://lastbrew.example/last-drop/');
    }
  });
});
