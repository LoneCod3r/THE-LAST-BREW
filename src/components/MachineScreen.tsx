import { useEffect, useRef, useState } from 'react';
import type { ArchivePath } from '../data/paths';
import { CASING, HAND_AWAY, SUGAR_MAX, photoPos } from '../data/machine';
import type { BrewPhase } from '../data/brew';
import { COFFEE_RITUAL, MACHINE_SILENT, SECRET_BLEND, postCoffeeMessage } from '../data/rewards';
import { casingControls, casingKey, setCompletedBefore, type GameAction, type Notice, type Screen, type Serving, type SolveRecord } from '../state/machine';
import { useHand } from '../hooks/useHand';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { CasingDetails, ScreenNotice } from './MachineEggs';
import { MoreCoffeeKey } from './MoreCoffeeKey';
import { EnoughKeys } from './EnoughKeys';
import { openLastDrop } from '../secret/destination';
import { VendingMachine } from './VendingMachine';

/** Hold ACCESS GRANTED on the machine's screen this long before it powers up. */
const GRANTED_HOLD_MS = 2400;
/** Reduced motion compresses the brew instead of skipping it. */
const REDUCED_SCALE = 0.15;
/** The cup's journey toward the viewer; must match .vm__cup.is-handed in vending.css. */
const LIFT_MS = 2600;
/** The pickup: the cup lifts away and fades; must match .vm__cup.is-picked in vending.css. */
const PICKUP_MS = 950;
/** The Secret Blend's machine sequence before its archive entry opens; must match .vm.is-unveiling in vending.css. */
const UNVEIL_MS = 3200;

function brewSchedule(pourMs: number): [BrewPhase, number][] {
  const pourAt = 3600;
  return [
    ['power', 0],
    ['grind', 1200],
    ['pressure', 2400],
    ['pour', pourAt],
    ['settle', pourAt + pourMs],
    ['done', pourAt + pourMs + 1400],
  ];
}

const DISPLAY: Record<BrewPhase, string> = {
  granted: 'ACCESS GRANTED',
  power: 'POWERING UP',
  grind: 'GRINDING',
  pressure: 'PRESSURE 9.0 BAR',
  pour: 'DISPENSING',
  settle: 'RESTING',
  done: 'ENJOY YOUR COFFEE',
};

/**
 * none → the cup stands on the tray; lift → travelling; held → in the foreground until
 * the visitor picks it up; pickup → lifting away; ready → the controls return.
 */
type Handoff = 'none' | 'lift' | 'held' | 'pickup' | 'ready';

interface MachineScreenProps {
  path: ArchivePath;
  screen: Extract<Screen, 'ACCESS_GRANTED' | 'BREWING' | 'PUZZLE_SOLVED'>;
  brewRun: number;
  record: SolveRecord;
  /** Set once this brew's cup has been picked up. */
  serving: Serving | null;
  /** Distinct coffees drunk this session; with the serving, picks the post-coffee message. */
  drunk: number;
  notice: Notice | null;
  dispatch: (action: GameAction) => void;
}

export function MachineScreen({ path, screen, brewRun, record, serving, drunk, notice, dispatch }: MachineScreenProps) {
  const reduced = useReducedMotion();
  const scale = reduced ? REDUCED_SCALE : 1;
  const pourMs = Math.round(path.pourMs * scale);
  const hand = useHand();
  const { moveTo } = hand;
  const [phase, setPhase] = useState<BrewPhase>(screen === 'PUZZLE_SOLVED' ? 'done' : 'granted');
  const [handoff, setHandoff] = useState<Handoff>('none');
  const [seenRun, setSeenRun] = useState(brewRun);

  // A new brew run must never render a single frame with the previous cup.
  if (seenRun !== brewRun) {
    setSeenRun(brewRun);
    setPhase('power');
    setHandoff('none');
  }

  // The hand withdraws once the machine takes over.
  useEffect(() => {
    const t = window.setTimeout(() => moveTo(HAND_AWAY), reduced ? 0 : 500);
    return () => window.clearTimeout(t);
  }, [moveTo, reduced]);

  useEffect(() => {
    if (screen !== 'ACCESS_GRANTED') return;
    setPhase('granted');
    const t = window.setTimeout(() => dispatch({ type: 'BEGIN_BREW' }), GRANTED_HOLD_MS * scale);
    return () => window.clearTimeout(t);
  }, [screen]);

  useEffect(() => {
    if (screen !== 'BREWING') return;
    const timers = brewSchedule(path.pourMs).map(([p, at]) =>
      window.setTimeout(() => {
        setPhase(p);
        if (p === 'done') dispatch({ type: 'BREW_COMPLETE', run: brewRun });
      }, at * scale),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [screen, brewRun]);

  // The pour is finished: the machine hands the cup to the viewer and leaves it there.
  useEffect(() => {
    if (screen !== 'PUZZLE_SOLVED') return;
    setHandoff('lift');
    const t = window.setTimeout(() => setHandoff('held'), reduced ? 450 : LIFT_MS);
    return () => window.clearTimeout(t);
  }, [screen, brewRun, reduced]);

  // Picking the cup up: it lifts away, then the controls return.
  useEffect(() => {
    if (handoff !== 'pickup') return;
    const t = window.setTimeout(() => setHandoff('ready'), reduced ? 350 : PICKUP_MS);
    return () => window.clearTimeout(t);
  }, [handoff, reduced]);

  const ready = handoff === 'ready';

  // The cup is gone: the drinking is complete. The reducer counts each brew once.
  useEffect(() => {
    if (ready) dispatch({ type: 'DRINK_COMPLETE', run: brewRun });
  }, [ready, brewRun]);

  const unveiling = serving?.unveiling ?? false;
  const page = serving && ready ? serving.pages[serving.page] : null;
  /** The 'qr' page: no code any more; the machine goes quiet and the key reads Enough. */
  const quiet = page === 'qr' && !unveiling;
  /** On the silent page, Enough? (the Last Drop) and Enough. (the Secret Blend) stand together. */
  const key = serving ? casingKey(serving) : 'more';
  const band = casingControls(serving, ready);
  const { keyShown } = band;
  const keyRef = useRef<HTMLButtonElement>(null);

  // The key takes focus only if focus would otherwise be lost (it was on the cup, which is gone).
  useEffect(() => {
    if (!keyShown) return;
    const active = document.activeElement;
    const section = keyRef.current?.closest('section');
    if (!active || active === document.body || active === section || active.closest('.vm__cup')) {
      keyRef.current?.focus({ preventScroll: true });
    }
  }, [keyShown, key]);

  // Secret Blend: the machine plays its short sequence, then the archive entry opens.
  useEffect(() => {
    if (!unveiling) return;
    const t = window.setTimeout(() => dispatch({ type: 'REVEAL_SECRET' }), reduced ? 450 : UNVEIL_MS);
    return () => window.clearTimeout(t);
  }, [unveiling, reduced]);

  const cupStage = ({ none: 'tray', lift: 'lift', held: 'held', pickup: 'picked', ready: 'gone' } as const)[handoff];
  const message = postCoffeeMessage(drunk, serving !== null && setCompletedBefore(serving, drunk));

  let after = null;
  if (unveiling) {
    after = (
      <div className="vmui__msg vmui__msg--secret" key="secret">
        <p className="vmui__msg-title">{SECRET_BLEND.title}</p>
        <p className="vmui__msg-body">{SECRET_BLEND.lead}</p>
      </div>
    );
  } else if (page === 'message') {
    after = (
      <div className="vmui__msg" key="message">
        <p className="vmui__msg-title">{message.title}</p>
        <p className="vmui__msg-body">{message.body}</p>
      </div>
    );
  } else if (page === 'qr') {
    // The machine falls silent: one line, and the key reads Enough.
    after = (
      <div className="vmui__msg vmui__msg--silent" key="qr">
        <p className="vmui__msg-title">{MACHINE_SILENT}</p>
      </div>
    );
  } else if (page === 'ritual') {
    after = (
      <div className="vmui__msg vmui__msg--ritual" key="ritual">
        <p className="vmui__msg-title">{COFFEE_RITUAL.title}</p>
        <p className="vmui__badge">{COFFEE_RITUAL.badge}</p>
      </div>
    );
  }

  const display = (
    <div className={`vmui vmui--dispense${phase === 'granted' ? ' is-granted' : ''}${after ? ' is-message' : ''}`}>
      {!after && (
        <>
          <p className="vmui__big" key={phase}>
            {DISPLAY[phase]}
          </p>
          <p className="vmui__sub">
            {path.beverage}
            <span className="vmui__pips" aria-hidden="true">
              {Array.from({ length: SUGAR_MAX }, (_, i) => (
                <i key={i} className={i < record.sugar ? 'is-on' : undefined} />
              ))}
            </span>
          </p>
          <div className="vmui__progress" aria-hidden="true">
            <span />
          </div>
        </>
      )}
      {/* Always mounted, so screen readers announce each message as it arrives. */}
      <div className="vmui__live" role="status" aria-live="polite">
        {after}
      </div>
      <ScreenNotice notice={notice} onDone={(seq) => dispatch({ type: 'DISMISS_NOTICE', seq })} />
    </div>
  );

  return (
    <section
      id="apparatus"
      className={`apparatus apparatus--${path.id}`}
      aria-label="Coffee machine"
      tabIndex={-1}
      data-screen-focus
    >
      <div className="apparatus__machine machine-slot">
        <VendingMachine
          key={brewRun}
          screen={display}
          hand={hand}
          dispense={{ phase, roast: path.roast, pourMs, sugar: record.sugar }}
          cupStage={cupStage}
          onPickup={() => setHandoff((h) => (h === 'held' ? 'pickup' : h))}
          mood={[unveiling && 'is-unveiling', quiet && 'is-quiet', notice && `is-notice-${notice.id}`].filter(Boolean).join(' ') || undefined}
          controls={
            <>
              <CasingDetails
                onEgg={(egg) => dispatch({ type: 'FIND_EGG', egg })}
                disabled={handoff === 'lift' || handoff === 'held' || handoff === 'pickup' || unveiling || quiet}
              />
              {band.keys === 'enough' && serving ? (
                <EnoughKeys
                  ref={keyRef}
                  style={photoPos(CASING.moreCoffee)}
                  onLastDrop={openLastDrop}
                  onSecretBlend={() => dispatch({ type: 'MORE_COFFEE', page: serving.page })}
                />
              ) : (
                <MoreCoffeeKey
                  ref={keyRef}
                  shown={keyShown}
                  className="more-key--casing"
                  style={photoPos(CASING.moreCoffee)}
                  onPress={() => serving && dispatch({ type: key === 'toSilent' ? 'ENOUGH' : 'MORE_COFFEE', page: serving.page })}
                />
              )}
            </>
          }
        />
      </div>
    </section>
  );
}
