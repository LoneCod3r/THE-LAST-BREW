/**
 * The experience as an explicit state machine. Every action is only honoured
 * from the screens listed in its case; anything else returns the state as-is,
 * so invalid progression (e.g. brewing without a correct answer) is impossible.
 */
import { PATHS, PATH_BY_ID, isPathId, type PathId } from '../data/paths';
import { clampSugar } from '../data/machine';
import { PUZZLES } from '../data/puzzles';
import type { NoticeId } from '../data/rewards';
import { awardEgg, emptyProgress, markFinalSeen, recordDrink, recordSolve, type Progress } from './progress';

export type Screen = 'INTRO' | 'PATH_SELECTION' | 'PUZZLE' | 'ACCESS_GRANTED' | 'BREWING' | 'PUZZLE_SOLVED' | 'SECRET_BLEND';

export interface Feedback {
  verdict: 'incorrect' | 'malformed';
  message: string;
  detail: string;
  /** Increments on every submission so the UI can re-trigger its signal. */
  seq: number;
}

export interface AttemptRecord {
  index: number;
  answer: string;
  detail: string;
}

export interface PuzzleSession {
  id: number;
  pathId: PathId;
  attempts: AttemptRecord[];
  feedback: Feedback | null;
  submissions: number;
}

export interface SolveRecord {
  pathId: PathId;
  attempts: number;
  /** Sugar level chosen on the machine before the puzzle (0–5). */
  sugar: number;
}

/**
 * What the display shows after a coffee, one page per MORE COFFEE press. The coffee that
 * completes the full set (the unlock) ends on a 'qr' page, which only ENOUGH opens; later
 * coffees do not. On it the display goes quiet (the silent screen) and the keys read
 * Enough? and Enough.
 */
export type RewardPage = 'message' | 'ritual' | 'qr';

/** After a finished coffee. */
export interface Serving {
  pages: RewardPage[];
  page: number;
  /** The Secret Blend's machine sequence is playing. */
  unveiling: boolean;
}

export interface Notice {
  id: NoticeId;
  seq: number;
}

export interface GameState {
  screen: Screen;
  activePath: PathId | null;
  session: PuzzleSession | null;
  solve: SolveRecord | null;
  brewRun: number;
  sessionCounter: number;
  /** Sugar level set on the machine; carried through the puzzle into the brew. */
  sugar: number;
  /** The coffee last chosen on the machine; still selected after backing out of its puzzle. */
  selection: PathId | null;
  /** Unsubmitted answers, kept when the visitor backs out of a puzzle and comes back. */
  drafts: Partial<Record<PathId, string>>;
  /** Set once the cup of this brew has been picked up; null until then. */
  serving: Serving | null;
  /** An Easter egg message on the machine's display. */
  notice: Notice | null;
  noticeSeq: number;
  /** SECRET_BLEND plays in full the first time only. */
  secretFull: boolean;
  /** Persisted (see progress.ts); saved by the app whenever it changes. */
  progress: Progress;
}

export type GameAction =
  | { type: 'OPEN_ARCHIVE' }
  | { type: 'SET_SUGAR'; level: number }
  | { type: 'SELECT_PATH'; pathId: PathId }
  | { type: 'LEAVE_PUZZLE' }
  | { type: 'SET_DRAFT'; value: string }
  | { type: 'SUBMIT_ANSWER'; answer: string }
  | { type: 'BEGIN_BREW' }
  | { type: 'BREW_COMPLETE'; run: number }
  /** The cup of brew `run` was picked up: the drinking is complete. */
  | { type: 'DRINK_COMPLETE'; run: number }
  /** The MORE COFFEE key, pressed while the display showed `page`. */
  | { type: 'MORE_COFFEE'; page: number }
  /** The same key, labelled Enough?, pressed while the display showed `page`; opens the 'qr' page. */
  | { type: 'ENOUGH'; page: number }
  | { type: 'REVEAL_SECRET' }
  | { type: 'OPEN_SECRET' }
  | { type: 'CLOSE_SECRET' }
  | { type: 'FIND_EGG'; egg: NoticeId }
  | { type: 'DISMISS_NOTICE'; seq: number };

/** Screens where the machine is on view, and so can be poked at. */
const MACHINE_SCREENS: readonly Screen[] = ['PATH_SELECTION', 'ACCESS_GRANTED', 'BREWING', 'PUZZLE_SOLVED'];

export function createInitialState(progress: Progress = emptyProgress()): GameState {
  return {
    screen: 'INTRO',
    activePath: null,
    session: null,
    solve: null,
    brewRun: 0,
    sessionCounter: 0,
    sugar: 0,
    selection: null,
    drafts: {},
    serving: null,
    notice: null,
    noticeSeq: 0,
    secretFull: false,
    progress,
  };
}

function toArchive(state: GameState): GameState {
  return { ...state, screen: 'PATH_SELECTION', activePath: null, session: null, solve: null, serving: null };
}

/** After a finished coffee the machine starts over: no selection, no sugar. */
function toFreshMachine(state: GameState): GameState {
  return { ...toArchive(state), sugar: 0, selection: null, notice: null };
}

/** The next page is the silent ('qr') page: MORE COFFEE dispatches ENOUGH to reach it. */
export function offersEnough(state: GameState): boolean {
  const serving = state.serving;
  return state.screen === 'PUZZLE_SOLVED' && !!serving && !serving.unveiling && serving.pages[serving.page + 1] === 'qr';
}

/**
 * What the casing keys do on the current page. Once the full set has been drunk, MORE
 * COFFEE on the page before the 'qr' page dispatches ENOUGH to reach it; there, two keys
 * stand together: Enough? (the screen opens the Last Drop in a new tab; no action) and
 * Enough. (MORE_COFFEE: into the Secret Blend). The silent page, and so these two keys,
 * comes once per session, after the coffee that completes the set.
 */
export type CasingKey = 'more' | 'toSilent' | 'both';

export function casingKey(serving: Serving): CasingKey {
  if (serving.pages[serving.page + 1] === 'qr') return 'toSilent';
  if (serving.pages[serving.page] === 'qr') return 'both';
  return 'more';
}

/**
 * Whether every distinct coffee had already been drunk before the one being served. The coffee
 * that completes the set is the only one whose pages end on the silent ('qr') page.
 */
export function setCompletedBefore(serving: Serving, distinctDrunk: number): boolean {
  return distinctDrunk >= PATHS.length && !serving.pages.includes('qr');
}

/**
 * The band under the screen once the cup is gone (`ready`): which key stands there and whether
 * it shows. Whenever the silent page is on view, both Enough keys are. (The ? disc is never
 * here: it stands only on the coffee-selection machine; see machineSelectProps.)
 */
export interface CasingControls {
  keys: 'enough' | 'more';
  keyShown: boolean;
}

export function casingControls(serving: Serving | null, ready: boolean): CasingControls {
  const keyShown = ready && serving !== null && !serving.unveiling;
  return {
    keys: keyShown && casingKey(serving!) === 'both' ? 'enough' : 'more',
    keyShown,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'OPEN_ARCHIVE':
      return state.screen === 'INTRO' ? { ...state, screen: 'PATH_SELECTION' } : state;

    case 'SET_SUGAR': {
      if (state.screen !== 'PATH_SELECTION') return state;
      const sugar = clampSugar(action.level);
      return sugar === state.sugar ? state : { ...state, sugar };
    }

    case 'SELECT_PATH': {
      if (state.screen !== 'PATH_SELECTION' || !isPathId(action.pathId)) return state;
      const sessionCounter = state.sessionCounter + 1;
      return {
        ...state,
        screen: 'PUZZLE',
        activePath: action.pathId,
        selection: action.pathId,
        solve: null,
        notice: null,
        sessionCounter,
        session: {
          id: sessionCounter,
          pathId: action.pathId,
          attempts: [],
          feedback: null,
          submissions: 0,
        },
      };
    }

    case 'LEAVE_PUZZLE':
      return state.screen === 'PUZZLE' ? toArchive(state) : state;

    case 'SET_DRAFT': {
      if (state.screen !== 'PUZZLE' || !state.session) return state;
      const pathId = state.session.pathId;
      if ((state.drafts[pathId] ?? '') === action.value) return state;
      return { ...state, drafts: { ...state.drafts, [pathId]: action.value } };
    }

    case 'SUBMIT_ANSWER': {
      if (state.screen !== 'PUZZLE' || !state.session) return state;
      const session = state.session;
      const result = PUZZLES[session.pathId].validate(action.answer);
      const submissions = session.submissions + 1;

      if (result.verdict === 'correct') {
        const drafts = { ...state.drafts };
        delete drafts[session.pathId];
        return {
          ...state,
          screen: 'ACCESS_GRANTED',
          session: null,
          drafts,
          solve: {
            pathId: session.pathId,
            attempts: session.attempts.length + 1,
            sugar: state.sugar,
          },
          progress: recordSolve(state.progress, session.pathId),
        };
      }

      const feedback: Feedback = { verdict: result.verdict, message: result.message, detail: result.detail, seq: submissions };
      if (result.verdict === 'malformed') {
        return { ...state, session: { ...session, feedback, submissions } };
      }
      const attempt: AttemptRecord = {
        index: session.attempts.length + 1,
        answer: action.answer.trim().toUpperCase(),
        detail: result.message,
      };
      return { ...state, session: { ...session, feedback, submissions, attempts: [...session.attempts, attempt] } };
    }

    case 'BEGIN_BREW':
      return state.screen === 'ACCESS_GRANTED' && state.solve
        ? { ...state, screen: 'BREWING', brewRun: state.brewRun + 1 }
        : state;

    case 'BREW_COMPLETE':
      if (state.screen !== 'BREWING' || action.run !== state.brewRun || !state.solve) return state;
      return { ...state, screen: 'PUZZLE_SOLVED', serving: null };

    case 'DRINK_COMPLETE': {
      // Once per brew: a repeated or stale event never counts a second coffee.
      if (state.screen !== 'PUZZLE_SOLVED' || action.run !== state.brewRun || !state.solve || state.serving) return state;
      const drink = recordDrink(state.progress, state.solve.pathId);
      const pages: RewardPage[] = ['message'];
      if (drink.ritual) pages.push('ritual');
      // The silent page follows only the coffee that completes the set (the unlock itself); later
      // coffees end as usual, and the selection machine keeps the seal and the ? disc.
      if (drink.final) pages.push('qr');
      return { ...state, progress: drink.progress, serving: { pages, page: 0, unveiling: false } };
    }

    case 'MORE_COFFEE': {
      const serving = state.serving;
      // The page token makes a double activation advance only once.
      if (state.screen !== 'PUZZLE_SOLVED' || !serving || serving.unveiling || action.page !== serving.page) return state;
      // The silent page is never skipped: only ENOUGH moves on to it.
      if (offersEnough(state)) return state;
      if (serving.page < serving.pages.length - 1) return { ...state, serving: { ...serving, page: serving.page + 1 } };
      // Enough. on the silent page plays the Secret Blend on the machine.
      if (serving.pages[serving.page] === 'qr') return { ...state, serving: { ...serving, unveiling: true } };
      return toFreshMachine(state);
    }

    case 'ENOUGH': {
      const serving = state.serving;
      // Same page token as MORE COFFEE: a double activation opens the silent page once.
      if (!offersEnough(state) || !serving || action.page !== serving.page) return state;
      return { ...state, serving: { ...serving, page: serving.page + 1 } };
    }

    case 'REVEAL_SECRET':
      if (state.screen !== 'PUZZLE_SOLVED' || !state.serving?.unveiling) return state;
      return { ...toFreshMachine(state), screen: 'SECRET_BLEND', secretFull: !state.progress.finalSeen, progress: markFinalSeen(state.progress) };

    case 'OPEN_SECRET':
      if (state.screen !== 'PATH_SELECTION' || !state.progress.finalUnlocked) return state;
      return {
        ...state,
        screen: 'SECRET_BLEND',
        notice: null,
        secretFull: !state.progress.finalSeen,
        progress: markFinalSeen(state.progress),
      };

    case 'CLOSE_SECRET':
      return state.screen === 'SECRET_BLEND' ? toFreshMachine(state) : state;

    case 'FIND_EGG': {
      if (!MACHINE_SCREENS.includes(state.screen)) return state;
      if (action.egg === 'nightShift' && state.screen !== 'PATH_SELECTION') return state;
      if (state.progress.eggs.includes(action.egg)) return state;
      const noticeSeq = state.noticeSeq + 1;
      return { ...state, progress: awardEgg(state.progress, action.egg), notice: { id: action.egg, seq: noticeSeq }, noticeSeq };
    }

    case 'DISMISS_NOTICE':
      return state.notice?.seq === action.seq ? { ...state, notice: null } : state;

    default:
      return state;
  }
}

export function pathForState(state: GameState) {
  return state.activePath ? PATH_BY_ID[state.activePath] : null;
}
