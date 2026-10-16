import { useCallback, useEffect, useReducer, type ReactNode } from 'react';
import { PATH_BY_ID } from './data/paths';
import { createInitialState, gameReducer, type GameState } from './state/machine';
import { loadProgress, saveProgress } from './state/progress';
import { IntroScreen } from './components/IntroScreen';
import { MachineSelect } from './components/MachineSelect';
import { machineSelectProps } from './components/machineSelectProps';
import { PuzzleScreen } from './components/PuzzleScreen';
import { MachineScreen } from './components/MachineScreen';
import { ScanlineOverlay } from './components/ScanlineOverlay';
import { SecretBlend } from './components/SecretBlend';

/** Screens that share a mounted view (the machine spans three states). */
function viewKey(state: GameState): string {
  switch (state.screen) {
    case 'PUZZLE':
      return `puzzle-${state.session?.id}`;
    case 'ACCESS_GRANTED':
    case 'BREWING':
    case 'PUZZLE_SOLVED':
      return `machine-${state.activePath}`;
    default:
      return state.screen;
  }
}

export function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => createInitialState(loadProgress()));
  const key = viewKey(state);

  // Progress only changes on real events (a solve, a finished coffee, an egg), so save on change.
  useEffect(() => saveProgress(state.progress), [state.progress]);

  // Follow the visible viewport so an on-screen keyboard never covers the answer bar.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      if (Math.abs(vv.scale - 1) > 0.01) {
        root.style.removeProperty('--app-h');
        return;
      }
      root.style.setProperty('--app-h', `${Math.round(vv.height)}px`);
      if (window.scrollY !== 0 && vv.height >= window.innerHeight - 1) window.scrollTo(0, 0);
    };
    update();
    vv.addEventListener('resize', update);
    return () => {
      vv.removeEventListener('resize', update);
      root.style.removeProperty('--app-h');
    };
  }, []);

  // Leaving a puzzle always goes through history, so the back icon, Esc and the
  // browser/phone back gesture behave identically.
  const leavePuzzle = useCallback(() => {
    if (window.history.state?.choicePuzzle !== undefined) window.history.back();
    else dispatch({ type: 'LEAVE_PUZZLE' });
  }, []);

  const puzzleId = state.screen === 'PUZZLE' ? state.session?.id : undefined;
  useEffect(() => {
    if (puzzleId === undefined) return;
    let popped = false;
    window.history.pushState({ choicePuzzle: puzzleId }, '');
    const onPop = () => {
      popped = true;
      dispatch({ type: 'LEAVE_PUZZLE' });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') leavePuzzle();
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', onKey);
      // Left by solving: neutralise our history entry so a later back does nothing odd.
      if (!popped && window.history.state?.choicePuzzle === puzzleId) window.history.replaceState(null, '');
    };
  }, [puzzleId, leavePuzzle]);

  useEffect(() => {
    if (state.screen === 'INTRO') return;
    window.scrollTo({ top: 0 });
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-screen-focus]')?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [key]);

  let view: ReactNode = null;
  switch (state.screen) {
    case 'INTRO':
      view = <IntroScreen onChoose={() => dispatch({ type: 'OPEN_ARCHIVE' })} />;
      break;
    case 'PATH_SELECTION':
      view = (
        <MachineSelect {...machineSelectProps(state, dispatch)} />
      );
      break;
    case 'PUZZLE':
      if (state.session)
        view = (
          <PuzzleScreen
            session={state.session}
            draft={state.drafts[state.session.pathId] ?? ''}
            dispatch={dispatch}
            onLeave={leavePuzzle}
          />
        );
      break;
    case 'ACCESS_GRANTED':
    case 'BREWING':
    case 'PUZZLE_SOLVED':
      if (state.activePath && state.solve)
        view = (
          <MachineScreen
            path={PATH_BY_ID[state.activePath]}
            screen={state.screen}
            brewRun={state.brewRun}
            record={state.solve}
            serving={state.serving}
            notice={state.notice}
            dispatch={dispatch}
          />
        );
      break;
    case 'SECRET_BLEND':
      view = <SecretBlend full={state.secretFull} onContinue={() => dispatch({ type: 'CLOSE_SECRET' })} />;
      break;
  }

  return (
    <>
      <main key={key} className={`stage stage--${state.screen.toLowerCase()}`}>
        {view}
      </main>
      <ScanlineOverlay />
    </>
  );
}
