import { useEffect, useRef } from 'react';
import { CASING, photoPos } from '../data/machine';
import { EGG_NOTICES, type NoticeId } from '../data/rewards';
import { BARISTA_TAPS, NIGHT_SHIFT_PRESSES, isNightShiftKey, nextPress, nextTap, type TapRun } from '../state/eggs';
import type { Notice } from '../state/machine';

interface CasingDetailsProps {
  onEgg: (egg: NoticeId) => void;
  /** Inert while the cup is travelling or held, so nothing competes with it. */
  disabled?: boolean;
  /** Present once the final reward is unlocked: reopens the Secret Blend. */
  onSecret?: () => void;
  /** The ? disc at the right end of the band: opens the Last Drop. Only on the coffee-selection machine. */
  onLastDrop?: () => void;
}

/**
 * Small parts on the casing that reward a curious visitor: the maker's badge on
 * the drip tray (five quick presses) and a stray bean on the hopper lid.
 */
export function CasingDetails({ onEgg, disabled = false, onSecret, onLastDrop }: CasingDetailsProps) {
  const taps = useRef<TapRun | null>(null);

  const pressBadge = () => {
    taps.current = nextTap(taps.current, performance.now());
    if (taps.current.count >= BARISTA_TAPS) {
      taps.current = null;
      onEgg('curiousBarista');
    }
  };

  return (
    <div className="casing" inert={disabled}>
      <button type="button" className="casing__badge" style={photoPos(CASING.badge)} aria-label="Maker's badge" onClick={pressBadge}>
        <span className="casing__badge-plate" aria-hidden="true">
          <svg viewBox="0 0 40 14" focusable="false">
            <path d="M14 9.5h9.5v-3.2H14zM23.5 7.2h1.6a1.3 1.3 0 0 1 0 2.6h-1.6" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M16.6 4.6c-.8-.9.8-1.5 0-2.6M19.6 4.6c-.8-.9.8-1.5 0-2.6" fill="none" stroke="currentColor" strokeWidth=".8" strokeLinecap="round" />
          </svg>
        </span>
      </button>

      <button type="button" className="casing__bean" style={photoPos(CASING.bean)} aria-label="Coffee bean" onClick={() => onEgg('missingBean')}>
        <svg className="casing__bean-art" viewBox="0 0 12 8" aria-hidden="true" focusable="false">
          <ellipse cx="6" cy="4" rx="5.6" ry="3.6" fill="#3b2412" />
          <ellipse cx="5" cy="2.9" rx="3" ry="1.4" fill="#6b4524" opacity=".55" />
          <path d="M1.4 4.6C3.6 2.6 7.6 5.8 10.6 3.4" fill="none" stroke="#1a0e06" strokeWidth=".9" strokeLinecap="round" />
        </svg>
      </button>

      {onSecret && (
        <button type="button" className="casing__seal" style={photoPos(CASING.seal)} aria-label="The secret blend" onClick={onSecret}>
          <span className="casing__seal-disc" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </button>
      )}

      {onLastDrop && (
        <button
          type="button"
          className="casing__puzzle"
          style={photoPos(CASING.puzzle)}
          aria-label="The last drop (opens in a new tab)"
          onClick={onLastDrop}
        >
          <span className="casing__puzzle-disc" aria-hidden="true">
            ?
          </span>
        </button>
      )}
    </div>
  );
}

/** Night Shift: N three times in quick succession, only while `idle()` and never while typing. */
export function useNightShift(active: boolean, idle: () => boolean, onTrigger: () => void) {
  const presses = useRef<number[]>([]);
  const latest = useRef({ idle, onTrigger });
  latest.current = { idle, onTrigger };

  useEffect(() => {
    if (!active) return;
    presses.current = [];
    const onKey = (e: KeyboardEvent) => {
      if (!isNightShiftKey(e)) return;
      if (!latest.current.idle()) {
        presses.current = [];
        return;
      }
      presses.current = nextPress(presses.current, e.timeStamp);
      if (presses.current.length >= NIGHT_SHIFT_PRESSES) {
        presses.current = [];
        latest.current.onTrigger();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);
}

/** How long an Easter egg's message stays on the display. */
export const NOTICE_MS = 5200;

/** An Easter egg's message, shown over the machine's display; it never takes input. */
export function ScreenNotice({ notice, onDone }: { notice: Notice | null; onDone: (seq: number) => void }) {
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => done.current(notice.seq), NOTICE_MS);
    return () => window.clearTimeout(t);
  }, [notice]);

  const copy = notice ? EGG_NOTICES[notice.id] : null;
  return (
    <div className="vmui-notice-region" role="status" aria-live="polite">
      {notice && copy && (
        <div key={notice.seq} className={`vmui-notice vmui-notice--${notice.id}`}>
          {copy.title && <p className="vmui-notice__title">{copy.title}</p>}
          <p className="vmui-notice__body">{copy.body}</p>
        </div>
      )}
    </div>
  );
}
