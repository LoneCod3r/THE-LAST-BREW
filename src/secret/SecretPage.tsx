/**
 * The page the QR code leads to. For now: the game's red cup, which can be turned
 * and looked into, with its coffee surface kept clear for the visual puzzle; room
 * beneath it for the quote; and a quiet way back to the game. The cipher itself is
 * not designed yet, so nothing here hints at an answer.
 */
import { InteractiveCup } from './cup3d/InteractiveCup';

export function SecretPage() {
  return (
    <main className="drop">
      <figure className="drop__figure">
        <InteractiveCup />
        {/* Room for the quote beneath the cup; empty until it is written. */}
        <figcaption className="drop__quote" data-slot="quote" />
      </figure>
      <a className="drop__return" href="../">
        Return
      </a>
    </main>
  );
}
