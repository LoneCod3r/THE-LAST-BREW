import { PUZZLES } from '../data/puzzles';
import type { GameAction, PuzzleSession } from '../state/machine';
import { PuzzleInput } from './PuzzleInput';

interface PuzzleScreenProps {
  session: PuzzleSession;
  draft: string;
  dispatch: (action: GameAction) => void;
  onLeave: () => void;
}

/**
 * Only the puzzle and its answer. The puzzle text scrolls inside its own area
 * when it is taller than the screen; the answer bar always stays visible.
 */
export function PuzzleScreen({ session, draft, dispatch, onLeave }: PuzzleScreenProps) {
  const puzzle = PUZZLES[session.pathId];

  return (
    <section className={`inquiry inquiry--${session.pathId}`} aria-label={puzzle.title}>
      <button type="button" className="icon-btn inquiry__back" aria-label="Back to the machine" onClick={onLeave}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
          <path d="M10.5 6.5 5 12l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
          <path d="M5.8 12H19" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M19 9.5v5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
      <article className="dossier paper" tabIndex={-1} data-screen-focus aria-label="Puzzle">
        {puzzle.briefing.map((para) => (
          <p key={para} className="dossier__text">
            {para}
          </p>
        ))}
        <ol className={`dossier__evidence dossier__evidence--${session.pathId}`}>
          {puzzle.evidence.map((line, i) => (
            <li key={i}>
              <span className="dossier__tag">{line.tag}</span>
              <span className="dossier__line">{line.text}</span>
            </li>
          ))}
        </ol>
        <p className="dossier__question">{puzzle.question}</p>
      </article>

      <PuzzleInput
        spec={puzzle.input}
        feedback={session.feedback}
        value={draft}
        onChange={(value) => dispatch({ type: 'SET_DRAFT', value })}
        onSubmit={(answer) => dispatch({ type: 'SUBMIT_ANSWER', answer })}
      />
    </section>
  );
}
