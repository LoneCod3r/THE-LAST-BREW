import { useEffect, useRef, useState } from 'react';
import { PATHS, PATH_BY_ID, type PathId } from '../data/paths';
import { SCREEN_BUTTONS, SUGAR_DISPLAY, SUGAR_MAX, type ScreenButtonId } from '../data/machine';
import type { NoticeId } from '../data/rewards';
import type { Notice } from '../state/machine';
import { HAND_PRESS_MS, HAND_TRAVEL_MS, useHand } from '../hooks/useHand';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { PathSymbol } from './Glyphs';
import { CasingDetails, ScreenNotice, useNightShift } from './MachineEggs';
import { SugarParticles, SugarSigil, useSugarEffects } from './SugarEffects';
import { VendingMachine, rectStyle } from './VendingMachine';

export interface MachineSelectProps {
  /** Puzzles solved this session: each gets a small mark. */
  solved: readonly PathId[];
  /** Coffee already chosen, e.g. before backing out of its puzzle. */
  selection: PathId | null;
  sugar: number;
  onSugar: (level: number) => void;
  onStart: (id: PathId) => void;
  notice: Notice | null;
  onEgg: (egg: NoticeId) => void;
  onDismissNotice: (seq: number) => void;
  /** Only once the Secret Blend is unlocked. */
  onSecret?: () => void;
  /** The ? disc (the Last Drop); likewise only once all three distinct coffees are drunk. */
  onLastDrop?: () => void;
}

export function MachineSelect({ solved, selection, sugar, onSugar, onStart, notice, onEgg, onDismissNotice, onSecret, onLastDrop }: MachineSelectProps) {
  const reduced = useReducedMotion();
  const hand = useHand();
  const fx = useSugarEffects();
  const [selected, setSelected] = useState<PathId | null>(selection);
  /** Screen-reader announcements only; the screen itself carries no instructions. */
  const [announce, setAnnounce] = useState('');
  const [flash, setFlash] = useState<{ id: ScreenButtonId; n: number } | null>(null);
  const [alert, setAlert] = useState(0);
  const [starting, setStarting] = useState(false);
  const startTimer = useRef<number | undefined>(undefined);
  /** The hand is busy until this time (performance.now()). */
  const busyUntil = useRef(0);

  useEffect(() => () => window.clearTimeout(startTimer.current), []);

  // The machine is idle when nothing is starting and the hand is back at rest.
  useNightShift(true, () => !starting && performance.now() >= busyUntil.current, () => onEgg('nightShift'));

  const contact = (id: ScreenButtonId) => setFlash((f) => ({ id, n: (f?.n ?? 0) + 1 }));

  /** Every press on the screen: the hand gets busy and any Easter egg message makes way. */
  const touch = () => {
    busyUntil.current = performance.now() + (reduced ? 0 : HAND_TRAVEL_MS + HAND_PRESS_MS) + 400;
    if (notice) onDismissNotice(notice.seq);
  };

  const choose = (id: PathId) => {
    if (starting) return;
    touch();
    setSelected(id);
    setAnnounce(`${PATH_BY_ID[id].beverage} selected`);
    hand.press(id, {
      onContact: () => contact(id),
    });
  };

  const changeSugar = (step: 1 | -1) => {
    const level = Math.min(SUGAR_MAX, Math.max(0, sugar + step));
    if (starting || level === sugar) return;
    touch();
    const button: ScreenButtonId = step > 0 ? 'sugarUp' : 'sugarDown';
    onSugar(level);
    hand.press(button, {
      onContact: () => {
        contact(button);
        fx.trigger(step > 0 ? 'up' : 'down', level);
      },
    });
  };

  const start = () => {
    if (starting) return;
    touch();
    if (!selected) {
      hand.press('start', {
        onContact: () => {
          contact('start');
          setAlert((n) => n + 1);
          setAnnounce('No beverage selected');
        },
      });
      return;
    }
    const id = selected;
    setStarting(true);
    hand.press('start', {
      retract: false,
      onContact: () => {
        contact('start');
        setAnnounce('Locked');
        startTimer.current = window.setTimeout(() => onStart(id), reduced ? 250 : 1100);
      },
    });
  };

  const flashClass = (id: ScreenButtonId) => (flash?.id === id ? ` is-contact-${flash.n % 2}` : '');

  const screen = (
    <div className={`vmui${fx.flicker > 0 ? ` is-flicker-${fx.flicker % 2}` : ''}`}>
      <div role="group" aria-label="Beverage" className={alert > 0 ? `vmui__choices is-alert-${alert % 2}` : 'vmui__choices'}>
        {PATHS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`vmui__btn${selected === p.id ? ' is-selected' : ''}${flashClass(p.id)}`}
            style={rectStyle(SCREEN_BUTTONS[p.id])}
            aria-pressed={selected === p.id}
            disabled={starting}
            onClick={() => choose(p.id)}
          >
            <PathSymbol id={p.id} className="vmui__glyph" />
            <span className="vmui__label">{p.beverage}</span>
            {solved.includes(p.id) && (
              <>
                <span className="vmui__seal" aria-hidden="true" />
                <span className="sr-only">, case closed</span>
              </>
            )}
          </button>
        ))}
      </div>

      <div role="group" aria-label="Sugar">
        <button
          type="button"
          className={`vmui__sugar${flashClass('sugarDown')}`}
          style={rectStyle(SCREEN_BUTTONS.sugarDown)}
          aria-label="Less sugar"
          disabled={starting || sugar === 0}
          onClick={() => changeSugar(-1)}
        >
          −
        </button>
        <output className="vmui__level" style={rectStyle(SUGAR_DISPLAY)} aria-live="polite">
          <span className="sr-only">
            Sugar {sugar} of {SUGAR_MAX}
          </span>
          {Array.from({ length: SUGAR_MAX }, (_, i) => (
            <i key={i} className={i < sugar ? 'is-on' : undefined} aria-hidden="true" />
          ))}
        </output>
        <button
          type="button"
          className={`vmui__sugar${flashClass('sugarUp')}`}
          style={rectStyle(SCREEN_BUTTONS.sugarUp)}
          aria-label="More sugar"
          disabled={starting || sugar === SUGAR_MAX}
          onClick={() => changeSugar(1)}
        >
          +
        </button>
      </div>

      <button
        type="button"
        className={`vmui__start${flashClass('start')}`}
        style={rectStyle(SCREEN_BUTTONS.start)}
        disabled={starting}
        onClick={start}
      >
        START
      </button>

      <SugarSigil trigger={fx.sigil} />
      <ScreenNotice notice={notice} onDone={onDismissNotice} />
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
    </div>
  );

  return (
    <section id="dispenser" className="dispenser" aria-label="Coffee machine" tabIndex={-1} data-screen-focus>
      <div className="dispenser__grid">
        <div className="machine-slot">
          <VendingMachine
            screen={screen}
            hand={hand}
            mood={notice ? `is-notice-${notice.id}` : undefined}
            around={<SugarParticles bursts={fx.bursts} />}
            controls={<CasingDetails onEgg={onEgg} disabled={starting} onSecret={onSecret} onLastDrop={onLastDrop} />}
          />
        </div>
      </div>
    </section>
  );
}
