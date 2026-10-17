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
