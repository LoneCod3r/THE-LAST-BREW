/**
 * Where the QR code leads: the separate secret page, built as its own HTML entry
 * (last-drop/index.html, see vite.config.ts). The address is derived from where the
 * game itself is served, so nothing is hardcoded: a deployed game encodes its own
 * public address, and a dev server opened on its network URL encodes that.
 */

/** The secret page, relative to the game's root. */
export const SECRET_PATH = 'last-drop/';

interface Where {
  /** The origin the game is served from, e.g. https://example.com. */
  origin: string;
  /** Vite's base path, e.g. / or /THE-LAST-BREW/. */
  base: string;
  /** Optional VITE_PUBLIC_URL: the game's full public address, when it differs from the served origin. */
  publicUrl?: string;
}

function asRoot(url: string): URL | null {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!u.pathname.endsWith('/')) u.pathname += '/';
    u.search = '';
    u.hash = '';
    return u;
  } catch {
    return null;
  }
}

export function secretPageUrl({ origin, base, publicUrl }: Where): string {
  const root = (publicUrl && asRoot(publicUrl)) || new URL(base.endsWith('/') ? base : `${base}/`, origin);
  return new URL(SECRET_PATH, root).href;
}

/** The secret page's address for this running game. */
export function currentSecretPageUrl(): string {
  return secretPageUrl({
    origin: window.location.origin,
    base: import.meta.env.BASE_URL,
    publicUrl: import.meta.env.VITE_PUBLIC_URL,
  });
}

type Opener = (url: string, target: string, features: string) => unknown;

/**
 * Enough?: the secret page (the Last Drop puzzle) opens in a new tab, as the QR code's
 * link did, so the game session in this tab is kept.
 */
export function openSecretPage(href: string, open: Opener = (url, target, features) => window.open(url, target, features)): void {
  open(href, '_blank', 'noopener');
}

/** Marks a Last Drop tab the game opened itself, so that its Return can go back to the game's tab. */
export const FROM_GAME = '#from-game';

/** The Last Drop from the machine: Enough? and the ? disc both open it through here. */
export function openLastDrop(): void {
  openSecretPage(currentSecretPageUrl() + FROM_GAME);
}

type Here = { readonly closed: boolean; close(): void; location: { hash: string; assign(url: string): void } };

/**
 * Return on the Last Drop page. When the game opened this tab, the game is still running in the
 * tab it came from, session and all: this tab closes and the browser goes back to it, with no
 * reload. Otherwise (the address typed or bookmarked) there is no game to go back to, and the
 * link opens it; that is also the fallback should the browser refuse to close the tab.
 */
export function returnToGame(event: { preventDefault(): void }, href: string, here: Here = window): void {
  if (here.location.hash !== FROM_GAME) return;
  event.preventDefault();
  here.close();
  if (!here.closed) here.location.assign(href);
}
