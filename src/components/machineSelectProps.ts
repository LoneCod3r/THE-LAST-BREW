import type { GameAction, GameState } from '../state/machine';
import type { MachineSelectProps } from './MachineSelect';

/**
 * Everything the selection screen needs, taken from the game state. Kept apart from
 * App so the wiring can be tested: every field comes from data the state guarantees
 * (progress.solved is always an array; see parseProgress).
 */
export function machineSelectProps(state: GameState, dispatch: (action: GameAction) => void): MachineSelectProps {
  return {
    solved: state.progress.solved,
    selection: state.selection,
    sugar: state.sugar,
    onSugar: (level) => dispatch({ type: 'SET_SUGAR', level }),
    onStart: (pathId) => dispatch({ type: 'SELECT_PATH', pathId }),
    notice: state.notice,
    onEgg: (egg) => dispatch({ type: 'FIND_EGG', egg }),
    onDismissNotice: (seq) => dispatch({ type: 'DISMISS_NOTICE', seq }),
    onSecret: state.progress.finalUnlocked ? () => dispatch({ type: 'OPEN_SECRET' }) : undefined,
  };
}
