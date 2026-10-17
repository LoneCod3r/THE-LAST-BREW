/**
 * The page the QR code leads to: the game's red cup, which can be turned, looked
 * into and drunk. The grounds it leaves hold the last reading; the time it asks for
 * opens the archive's last entry. Room beneath the cup for the quote, and a quiet
 * way back to the game.
 */
import { useEffect, useRef, useState } from 'react';
import { InteractiveCup } from './cup3d/InteractiveCup';
import { ARCHIVE } from './reading/copy';

function Archive() {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: false }), []);
  return (
    <section className="drop__archive" aria-labelledby="drop-archive-title">
      <h1 id="drop-archive-title" ref={heading} tabIndex={-1}>
        {ARCHIVE.title}
      </h1>
      {ARCHIVE.body.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </section>
  );
}

export function SecretPage() {
  const [solved, setSolved] = useState(false);
  return (
    <main className="drop">
      <figure className="drop__figure">
        <InteractiveCup onSolved={() => setSolved(true)} />
        {/* Room for the quote beneath the cup; empty until it is written. */}
        <figcaption className="drop__quote" data-slot="quote" />
      </figure>
      {solved && <Archive />}
      <a className="drop__return" href="../">
        Return
      </a>
    </main>
  );
}
