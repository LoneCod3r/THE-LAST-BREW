import { Fragment, useEffect, useReducer, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { Vector3 } from 'three';
import cupArt from '../../assets/cup-hd.png';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { INITIAL, keyCommand, runCommand, type Part, type Pose } from './views';
import type { BaseOnScreen, CupScene } from './CupScene';
import { DWELL_MS, START, baseInView, cluesInView, isEmpty, reading, stampOpen, type ReadingState } from '../reading/state';
import { AFTER_SIP, SEEN, WRONG } from '../reading/copy';
import { checkTime } from '../reading/puzzle';

type Status = 'loading' | 'ready' | 'fallback';

/** Looking into the full cup this long brings up the one word of help. */
const HINT_MS = 2000;
/** A wrong time stays in the slots this long before they clear. */
const WRONG_MS = 1100;

type Watch = 'clock' | 'word' | 'hint';
const WATCHES: readonly Watch[] = ['clock', 'word', 'hint'];

/** Whether a watched view holds: the hint while gazing into the full cup; each clue once the grounds have surfaced. */
function holds(w: Watch, p: Pose, s: ReadingState, settling: boolean): boolean {
  if (w === 'hint') return s.sips === 0 && p.depth > 0.95;
  if (!isEmpty(s) || settling) return false;
  const seen = cluesInView(p);
  return w === 'clock' ? !s.sawClock && seen.clock : !s.sawWord && seen.word;
}

/**
 * The slots as they read with some digits typed: H, M, M (shown H:MM), a leading zero on the
 * hour dropped; and which slot the next digit goes into (-1 once all three are filled).
 */
function slots(digits: string): { cells: string[]; next: number } {
  const d = digits[0] === '0' ? digits.slice(1) : digits;
  return { cells: [0, 1, 2].map((i) => d[i] ?? '_'), next: d.length < 3 ? d.length : -1 };
}

interface Props {
  /** The time was given: the archive can open. */
  onSolved?: () => void;
}

/**
 * The red cup from the game, in 3D. three.js is loaded only here, on demand; if it
 * or WebGL is unavailable, the game's own picture of the cup stands in.
 *
 * It can be drunk: three sips (hold the coffee, or press D) leave the grounds, and
 * the grounds hold the reading. Its progress lasts for this page load only.
 */
export function InteractiveCup({ onSolved }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<CupScene | null>(null);
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  const [status, setStatus] = useState<Status>('loading');
  const [said, setSaid] = useState('');

  const [state, dispatch] = useReducer(reading, START);
  const stateRef = useRef(state);
  const poseRef = useRef<Pose>(INITIAL);
  const timers = useRef<Partial<Record<Watch, number>>>({});
  const settlingRef = useRef(false);
  const [hint, setHint] = useState(false);
  const [baseShown, setBaseShown] = useState(false);
  const baseShownRef = useRef(false);
  const stampRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [digits, setDigits] = useState('');
  const [wrong, setWrong] = useState(false);
  const wrongTimer = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /** What the live region says for a view: the view itself, and any clue it shows plainly. */
  const tell = (text: string, p: Pose, s: ReadingState = stateRef.current): string => {
    if (!isEmpty(s) || settlingRef.current) return text;
    const seen = cluesInView(p);
    const extra: string[] = [];
    if (seen.clock) extra.push(SEEN.clock);
    if (seen.word) extra.push(SEEN.word);
    if (baseInView(p)) extra.push(SEEN.stamp);
    return extra.length ? `${[text, ...extra].map((t) => t.replace(/\.$/, '')).join('. ')}.` : text;
  };

  const drink = (at: Vector3 | null) => {
    const scene = sceneRef.current;
    const s = stateRef.current;
    if (!scene || isEmpty(s) || !scene.sip(at)) return;
    dispatch({ type: 'sip' });
    setHint(false);
    const next = reading(s, { type: 'sip' });
    // With reduced motion the grounds are there at once: say what is in view straight away.
    settlingRef.current = scene.grounds.busy;
    setSaid(tell(AFTER_SIP[next.sips], poseRef.current, next));
  };

  const watch = (w: Watch) => {
    const t = timers.current;
    if (!holds(w, poseRef.current, stateRef.current, settlingRef.current)) {
      if (t[w] !== undefined) {
        clearTimeout(t[w]);
        delete t[w];
      }
      if (w === 'hint') setHint(false);
      return;
    }
    if (t[w] !== undefined) return;
    t[w] = window.setTimeout(
      () => {
        delete t[w];
        // Still in view after the dwell: it was looked at, not swept past.
        if (!holds(w, poseRef.current, stateRef.current, settlingRef.current)) return;
        if (w === 'hint') setHint(true);
        else dispatch({ type: 'saw', clue: w });
      },
      w === 'hint' ? HINT_MS : DWELL_MS,
    );
  };

  const onFrame = (pose: Pose, base: BaseOnScreen) => {
    poseRef.current = pose;
    const el = stampRef.current;
    if (el) {
      el.style.setProperty('--bx', `${base.x.toFixed(1)}px`);
      el.style.setProperty('--by', `${base.y.toFixed(1)}px`);
      el.style.setProperty('--br', `${base.r.toFixed(1)}px`);
    }
    const shown = baseInView(pose);
    if (shown !== baseShownRef.current) {
      baseShownRef.current = shown;
      setBaseShown(shown);
    }
    const settling = !!sceneRef.current?.grounds.busy;
    if (settlingRef.current && !settling && isEmpty(stateRef.current)) {
      // The grounds have just surfaced: describe what is now in view.
      settlingRef.current = false;
      setSaid(tell(AFTER_SIP[3], pose));
    }
    settlingRef.current = settling;
    WATCHES.forEach(watch);
  };

  /** Typing always continues at the first empty slot, wherever the field was clicked. */
  const caretToEnd = () => {
    const el = inputRef.current;
    if (el && document.activeElement === el && (el.selectionStart !== el.value.length || el.selectionEnd !== el.value.length)) {
      el.setSelectionRange(el.value.length, el.value.length);
    }
  };

  /** A tap on the base, once the field is open and facing the viewer, goes straight to the field. */
  const onTap = (part: Part): boolean => {
    if (part !== 'base' || !fieldShown || !inputRef.current) return false;
    inputRef.current.focus({ preventScroll: true });
    caretToEnd();
    return true;
  };

  // The scene keeps the first callbacks it is given; these forward to the latest render's.
  const latest = useRef({ drink, onFrame, tell, onTap });
  useEffect(() => {
    latest.current = { drink, onFrame, tell, onTap };
  });

  useEffect(() => {
    let cancelled = false;
    const pending = timers.current;
    import('./CupScene')
      .then(({ CupScene }) => {
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        try {
          sceneRef.current = new CupScene(canvas, {
            reduced: reducedRef.current,
            onView: (text, pose) => setSaid(latest.current.tell(text, pose)),
            onFrame: (pose, base) => latest.current.onFrame(pose, base),
            onHold: (at) => latest.current.drink(at),
            onTap: (part) => latest.current.onTap(part),
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
      Object.values(pending).forEach((t) => clearTimeout(t));
      clearTimeout(wrongTimer.current);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    reducedRef.current = reduced;
    sceneRef.current?.setReduced(reduced);
  }, [reduced]);

  const fieldShown = stampOpen(state) && baseShown && status === 'ready';

  // The stamp under the base: hidden until the cup is empty; its slots give way to the field; then the time.
  useEffect(() => {
    sceneRef.current?.setStamp(state.solved ? 'solved' : !isEmpty(state) ? 'hidden' : fieldShown ? 'field' : 'slots');
  }, [state, fieldShown, status]);

  // Turned away while typing: focus goes back to the cup rather than nowhere.
  useEffect(() => {
    if (!fieldShown && document.activeElement === inputRef.current) canvasRef.current?.focus({ preventScroll: true });
  }, [fieldShown]);

  const submit = (value: string) => {
    const verdict = checkTime(value);
    if (verdict === 'malformed') return;
    if (verdict === 'correct') {
      setDigits('');
      dispatch({ type: 'solve' });
      onSolved?.();
      return;
    }
    setWrong(true);
    clearTimeout(wrongTimer.current);
    wrongTimer.current = window.setTimeout(() => {
      setWrong(false);
      setDigits('');
    }, WRONG_MS);
  };

  const onType = (e: ChangeEvent<HTMLInputElement>) => {
    if (wrong) return;
    const raw = e.target.value.replace(/\D/g, '');
    // Three slots: H, M, M. A leading zero on the hour may be typed, and takes a fourth digit.
    const d = raw.slice(0, raw[0] === '0' ? 4 : 3);
    setDigits(d);
    if (d.length === (d[0] === '0' ? 4 : 3)) submit(d);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!wrong) submit(digits);
  };

  const slot = slots(digits);

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
          if (e.altKey || e.ctrlKey || e.metaKey || !sceneRef.current) return;
          if (e.key === 'd' || e.key === 'D') {
            e.preventDefault();
            if (!e.repeat) drink(null);
            return;
          }
          const cmd = keyCommand(e.key);
          if (!cmd) return;
          e.preventDefault();
          sceneRef.current.act((c, now) => runCommand(c, cmd, now));
        }}
      />
      <p className="drop__hint" data-shown={hint && state.sips === 0 ? '' : undefined} aria-hidden="true">
        hold
      </p>
      <form
        ref={stampRef}
        className={`drop__stamp${wrong ? ' is-wrong' : ''}`}
        hidden={!fieldShown}
        onSubmit={onSubmit}
        autoComplete="off"
      >
        <span className="drop__slots" aria-hidden="true">
          {slot.cells.map((c, i) => (
            <Fragment key={i}>
              {i === 1 && ':'}
              <span className={`drop__slot${i === slot.next ? ' is-next' : i >= slot.next && slot.next >= 0 ? ' is-empty' : ''}`}>{c}</span>
            </Fragment>
          ))}
        </span>
        <input
          ref={inputRef}
          className="drop__time"
          type="text"
          inputMode="numeric"
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={5}
          aria-label="The time pressed into the base"
          value={digits}
          onChange={onType}
          onFocus={caretToEnd}
          onSelect={caretToEnd}
        />
        <p className="drop__verdict" role="status" aria-live="polite">
          {wrong ? WRONG : ''}
        </p>
      </form>
      <p id="drop-cup-keys" className="sr-only">
        Drag, or use the arrow keys, to turn it. Enter looks into the cup and back out. R turns it by the rim. Home looks
        inside. Escape returns to the first view. D takes a sip.
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}
