/**
 * Puzzle registry: content and validation rules live here, away from
 * the UI. Validators derive the answer from each puzzle's logical model.
 */
import type { PathId } from './paths';
import { countTrueStatements, isSwitch, solveFirstLock, type SwitchStatement } from '../logic/firstLock';
import { firstContradictedClue, solveSafe, type CodeClue } from '../logic/safeCode';
import { deduceColours, enumerateWorlds, type Hat, type Statement } from '../logic/hats';

export type ValidationResult =
  | { verdict: 'correct' }
  | { verdict: 'incorrect'; message: string; detail: string }
  | { verdict: 'malformed'; message: string; detail: string };

export interface ChoiceOption {
  value: string;
  label: string;
}

export type PuzzleInputSpec =
  | { kind: 'choice'; legend: string; options: readonly ChoiceOption[]; submitLabel: string }
  | { kind: 'code'; label: string; length: number; submitLabel: string };

export interface EvidenceLine {
  tag: string;
  text: string;
}

export interface PuzzleDefinition {
  pathId: PathId;
  /** Accessible name of the puzzle; not displayed. */
  title: string;
  briefing: readonly string[];
  evidence: readonly EvidenceLine[];
  question: string;
  input: PuzzleInputSpec;
  validate: (raw: string) => ValidationResult;
}

/** Uppercase, Unicode-normalised, whitespace-collapsed. */
export function normalizeAnswer(raw: string): string {
  return raw.normalize('NFKC').trim().replace(/\s+/g, ' ').toUpperCase();
}

// ── PUZZLE 01 · THE FIRST LOCK ───────────────────────────────────────────────

export const FIRST_LOCK_STATEMENTS: readonly SwitchStatement[] = [
  { speaker: 'A', text: 'The key is not C.', holds: (key) => key !== 'C' },
  { speaker: 'B', text: 'The key is A.', holds: (key) => key === 'A' },
  { speaker: 'C', text: 'The key is not A.', holds: (key) => key !== 'A' },
];
export const FIRST_LOCK_TRUE_COUNT = 1;
const firstLockSolutions = solveFirstLock(FIRST_LOCK_STATEMENTS, FIRST_LOCK_TRUE_COUNT);

const firstLock: PuzzleDefinition = {
  pathId: 'key',
  title: 'The First Lock',
  briefing: [
    'There are three switches labeled A, B, and C. Only one of them holds the key.',
    'Each switch bears a single engraved statement. Exactly one statement below is true.',
  ],
  evidence: FIRST_LOCK_STATEMENTS.map((s) => ({ tag: s.speaker, text: s.text })),
  question: 'Which switch contains the key?',
  input: {
    kind: 'choice',
    legend: 'SELECT SWITCH',
    submitLabel: 'SUBMIT ANSWER',
    options: [
      { value: 'A', label: 'A' },
      { value: 'B', label: 'B' },
      { value: 'C', label: 'C' },
    ],
  },
  validate(raw) {
    const answer = normalizeAnswer(raw).replace(/^SWITCH\s*/, '');
    if (!isSwitch(answer)) {
      return { verdict: 'malformed', message: 'NO SWITCH SELECTED', detail: 'CHOOSE A, B OR C.' };
    }
    if (firstLockSolutions.length === 1 && firstLockSolutions[0] === answer) return { verdict: 'correct' };
    const holding = countTrueStatements(FIRST_LOCK_STATEMENTS, answer);
    return {
      verdict: 'incorrect',
      message: 'ACCESS DENIED',
      detail: `IF THE KEY WERE ${answer}, ${holding} STATEMENT${holding === 1 ? '' : 'S'} WOULD HOLD. THE DOOR REQUIRES ONE.`,
    };
  },
};

// ── PUZZLE 02 · PATTERNS WITHIN PATTERNS ─────────────────────────────────────

export const SAFE_CLUES: readonly CodeClue[] = [
  { guess: '682', inPlace: 1, misplaced: 0, text: 'One digit is correct and in the correct position.' },
  { guess: '614', inPlace: 0, misplaced: 1, text: 'One digit is correct but in the wrong position.' },
  { guess: '206', inPlace: 0, misplaced: 2, text: 'Two digits are correct, but both are in the wrong positions.' },
  { guess: '738', inPlace: 0, misplaced: 0, text: 'No digit is correct.' },
  { guess: '780', inPlace: 0, misplaced: 1, text: 'One digit is correct but in the wrong position.' },
];
const safeSolutions = solveSafe(SAFE_CLUES, 3);

const safe: PuzzleDefinition = {
  pathId: 'mind',
  title: 'Patterns Within Patterns',
  briefing: [
    'A wall safe was recovered from the sealed floor. Five earlier attempts were logged by the lock itself.',
    'Each log entry records how close that attempt came.',
  ],
  evidence: SAFE_CLUES.map((c) => ({ tag: c.guess, text: c.text })),
  question: 'What is the code?',
  input: { kind: 'code', label: 'ENTER CODE', length: 3, submitLabel: 'SUBMIT CODE' },
  validate(raw) {
    const code = normalizeAnswer(raw).replace(/[\s-]/g, '');
    if (!/^\d{3}$/.test(code)) {
      return { verdict: 'malformed', message: 'MALFORMED INPUT', detail: 'THE SAFE ACCEPTS EXACTLY THREE DIGITS.' };
    }
    const contradicted = firstContradictedClue(code, SAFE_CLUES);
    if (contradicted === -1 && safeSolutions.length === 1 && safeSolutions[0] === code) return { verdict: 'correct' };
    const clueNo = String(contradicted + 1).padStart(2, '0');
    return {
      verdict: 'incorrect',
      message: 'ACCESS DENIED',
      detail:
        contradicted === -1
          ? 'THE LOG DOES NOT ISOLATE THAT CODE.'
          : `${code} CONTRADICTS LOG ENTRY ${clueNo} (${SAFE_CLUES[contradicted].guess}).`,
    };
  },
};

// ── PUZZLE 03 · THE FINAL DEDUCTION ──────────────────────────────────────────

export const HAT_POOL = { people: 3, white: 3, black: 2 } as const;
export const HAT_STATEMENTS: readonly Statement[] = [
  { person: 0, knows: false },
  { person: 1, knows: false },
  { person: 2, knows: true },
];
export const HAT_TARGET = 2;
const hatWorlds = enumerateWorlds(HAT_POOL.people, HAT_POOL.white, HAT_POOL.black);
const hatConclusions = deduceColours(hatWorlds, HAT_STATEMENTS, HAT_TARGET);

const HAT_ALIASES: Record<string, Hat> = { WHITE: 'WHITE', W: 'WHITE', BLACK: 'BLACK', B: 'BLACK' };

const hats: PuzzleDefinition = {
  pathId: 'void',
  title: 'The Final Deduction',
  briefing: [
    'Three people, A, B, and C, each wear a hat taken from a set of three white hats and two black hats. The two unused hats are hidden.',
    'Everyone knows which hats exist. Each person sees the other two hats but not their own. All three reason perfectly, speak truthfully, and hear every word.',
  ],
  evidence: [
    { tag: 'A', text: '“I do not know the color of my hat.”' },
    { tag: 'B', text: 'Hears A, looks at C’s hat: “I do not know either.”' },
    { tag: 'C', text: 'Hears both statements: “Now I know the color of my hat.”' },
  ],
  question: 'What color is C’s hat?',
  input: {
    kind: 'choice',
    legend: 'STATE CONCLUSION',
    submitLabel: 'SUBMIT CONCLUSION',
    options: [
      { value: 'WHITE', label: 'WHITE' },
      { value: 'BLACK', label: 'BLACK' },
    ],
  },
  validate(raw) {
    const answer = HAT_ALIASES[normalizeAnswer(raw).replace(/\s*HAT$/, '')];
    if (!answer) {
      return { verdict: 'malformed', message: 'UNREADABLE CONCLUSION', detail: 'ANSWER WHITE OR BLACK.' };
    }
    if (hatConclusions.length === 1 && hatConclusions[0] === answer) return { verdict: 'correct' };
    return {
      verdict: 'incorrect',
      message: 'INCORRECT DEDUCTION',
      detail: 'THE EVIDENCE DOES NOT SUPPORT THAT CONCLUSION.',
    };
  },
};

export const PUZZLES: Readonly<Record<PathId, PuzzleDefinition>> = {
  key: firstLock,
  mind: safe,
  void: hats,
};
