import { afterEach, describe, expect, it, vi } from 'vitest';
import { FROM_GAME, SECRET_PATH, openLastDrop, openSecretPage, returnToGame, secretPageUrl } from './destination';

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

describe('Enough? opens the Last Drop puzzle', () => {
  it('opens the real secret page in a new tab, so the game session is kept', () => {
    const calls: unknown[][] = [];
    const href = secretPageUrl({ origin: 'https://lastbrew.example', base: '/' });
    openSecretPage(href, (...args) => calls.push(args));
    expect(calls).toEqual([['https://lastbrew.example/last-drop/', '_blank', 'noopener']]);
  });

  it("the machine's shared handler (Enough? and the ? disc) opens this game's Last Drop in a new tab, marked as the game's", () => {
    const open = vi.fn();
    vi.stubGlobal('window', { location: { origin: 'https://lastbrew.example' }, open });
    openLastDrop();
    expect(FROM_GAME).toBe('#from-game');
    expect(open.mock.calls).toEqual([['https://lastbrew.example/last-drop/#from-game', '_blank', 'noopener']]);
  });

  afterEach(() => vi.unstubAllGlobals());
});

describe('Return on the Last Drop page', () => {
  /** A stand-in for the Last Drop tab: its address hash, and whether the browser lets it close. */
  function tab(hash: string, closable: boolean) {
    const here = {
      closed: false,
      close: vi.fn(() => {
        if (closable) here.closed = true;
      }),
      location: { hash, assign: vi.fn() },
    };
    return here;
  }
  const event = () => ({ preventDefault: vi.fn() });
  const GAME = 'https://lastbrew.example/';

  it('in a tab the game opened: closes it, back to the game tab, with no navigation, reload or new tab', () => {
    const here = tab('#from-game', true);
    const e = event();
    returnToGame(e, GAME, here);
    expect(e.preventDefault).toHaveBeenCalledTimes(1);
    expect(here.close).toHaveBeenCalledTimes(1);
    expect(here.location.assign).not.toHaveBeenCalled();
  });

  it('should the browser refuse to close it, the link opens the game instead', () => {
    const here = tab('#from-game', false);
    returnToGame(event(), GAME, here);
    expect(here.close).toHaveBeenCalledTimes(1);
    expect(here.location.assign.mock.calls).toEqual([[GAME]]);
  });

  it('reached any other way (typed or bookmarked): the link opens the game as before, and nothing is closed', () => {
    for (const hash of ['', '#elsewhere']) {
      const here = tab(hash, true);
      const e = event();
      returnToGame(e, GAME, here);
      expect(e.preventDefault).not.toHaveBeenCalled();
      expect(here.close).not.toHaveBeenCalled();
      expect(here.location.assign).not.toHaveBeenCalled();
    }
  });
});
