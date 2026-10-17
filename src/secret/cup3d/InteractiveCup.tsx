import { useEffect, useRef, useState } from 'react';
import cupArt from '../../assets/cup-hd.png';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { keyCommand, runCommand } from './views';
import type { CupScene } from './CupScene';

type Status = 'loading' | 'ready' | 'fallback';

/**
 * The red cup from the game, in 3D. three.js is loaded only here, on demand; if it
 * or WebGL is unavailable, the game's own picture of the cup stands in.
 */
export function InteractiveCup() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<CupScene | null>(null);
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  const [status, setStatus] = useState<Status>('loading');
  const [said, setSaid] = useState('');

  useEffect(() => {
    let cancelled = false;
    import('./CupScene')
      .then(({ CupScene }) => {
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        try {
          sceneRef.current = new CupScene(canvas, {
            reduced: reducedRef.current,
            onView: setSaid,
            onLost: () => setStatus('fallback'),
          });
          setStatus('ready');
        } catch {
          setStatus('fallback');
        }
      })
      .catch(() => !cancelled && setStatus('fallback'));
    return () => {
      cancelled = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    reducedRef.current = reduced;
    sceneRef.current?.setReduced(reduced);
  }, [reduced]);

  if (status === 'fallback') {
    return (
      <div className="drop__cup drop__cup--still">
        <img src={cupArt} alt="A red coffee cup, filled with black coffee" draggable={false} />
      </div>
    );
  }

  return (
    <div className={`drop__cup${status === 'ready' ? ' is-ready' : ''}`}>
      <canvas
        ref={canvasRef}
        className="drop__canvas"
        tabIndex={0}
        role="application"
        aria-roledescription="3D object"
        aria-label="A red coffee cup"
        aria-describedby="drop-cup-keys"
        onKeyDown={(e) => {
          const cmd = keyCommand(e.key);
          if (!cmd || e.altKey || e.ctrlKey || e.metaKey || !sceneRef.current) return;
          e.preventDefault();
          sceneRef.current.act((c, now) => runCommand(c, cmd, now));
        }}
      />
      <p id="drop-cup-keys" className="sr-only">
        Drag, or use the arrow keys, to turn it. Enter looks into the cup and back out. R turns it by the rim. Home looks
        inside. Escape returns to the first view.
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}
