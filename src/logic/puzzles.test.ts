import { describe, expect, it } from 'vitest';
import { countTrueStatements, solveFirstLock } from './firstLock';
import { scoreGuess, solveSafe } from './safeCode';
import { applyStatements, deduceColours, enumerateWorlds, knowsOwnHat } from './hats';
import {
  FIRST_LOCK_STATEMENTS,
  FIRST_LOCK_TRUE_COUNT,
  HAT_POOL,
  HAT_STATEMENTS,
  HAT_TARGET,
  PUZZLES,
  SAFE_CLUES,
  normalizeAnswer,
} from '../data/puzzles';

describe('Puzzle 01 — THE FIRST LOCK', () => {
  it('has exactly one key position yielding exactly one true statement: C', () => {
    expect(solveFirstLock(FIRST_LOCK_STATEMENTS, FIRST_LOCK_TRUE_COUNT)).toEqual(['C']);
  });

  it('truth table matches the hand derivation', () => {
    expect(countTrueStatements(FIRST_LOCK_STATEMENTS, 'A')).toBe(2);
    expect(countTrueStatements(FIRST_LOCK_STATEMENTS, 'B')).toBe(2);
    expect(countTrueStatements(FIRST_LOCK_STATEMENTS, 'C')).toBe(1);
  });

  it('the originally briefed wording would have produced B, not C', () => {
    const original = [
      { speaker: 'A' as const, text: '', holds: (k: string) => k !== 'B' },
      { speaker: 'B' as const, text: '', holds: (k: string) => k === 'A' },
      { speaker: 'C' as const, text: '', holds: (k: string) => k !== 'A' },
    ];
    expect(solveFirstLock(original, 1)).toEqual(['B']);
  });

  it('validates answers with normalisation', () => {
    const { validate } = PUZZLES.key;
    expect(validate('C').verdict).toBe('correct');
    expect(validate('  c ').verdict).toBe('correct');
    expect(validate('switch c').verdict).toBe('correct');
    expect(validate('A').verdict).toBe('incorrect');
    expect(validate('B').verdict).toBe('incorrect');
    expect(validate('').verdict).toBe('malformed');
    expect(validate('D').verdict).toBe('malformed');
  });
});

describe('Puzzle 02 — PATTERNS WITHIN PATTERNS', () => {
  it('scores guesses Mastermind-style, including repeated digits', () => {
    expect(scoreGuess('042', '682')).toEqual({ inPlace: 1, misplaced: 0 });
    expect(scoreGuess('042', '206')).toEqual({ inPlace: 0, misplaced: 2 });
    expect(scoreGuess('112', '211')).toEqual({ inPlace: 1, misplaced: 2 });
    expect(scoreGuess('100', '011')).toEqual({ inPlace: 0, misplaced: 2 });
  });

  it('has exactly one solution across all 1000 codes (repeats allowed): 042', () => {
    expect(solveSafe(SAFE_CLUES, 3)).toEqual(['042']);
  });

  it('validates codes with normalisation and reports the contradicted clue', () => {
    const { validate } = PUZZLES.mind;
    expect(validate('042').verdict).toBe('correct');
    expect(validate(' 0 4 2 ').verdict).toBe('correct');
    expect(validate('0-4-2').verdict).toBe('correct');
    const wrong = validate('738');
    expect(wrong.verdict).toBe('incorrect');
    if (wrong.verdict === 'incorrect') expect(wrong.detail).toContain('LOG ENTRY');
    expect(validate('42').verdict).toBe('malformed');
    expect(validate('abc').verdict).toBe('malformed');
    expect(validate('0421').verdict).toBe('malformed');
  });
});

describe('Puzzle 03 — THE FINAL DEDUCTION', () => {
  const worlds = enumerateWorlds(HAT_POOL.people, HAT_POOL.white, HAT_POOL.black);

  it('enumerates the 7 worlds allowed by 3 white and 2 black hats', () => {
    expect(worlds).toHaveLength(7);
    expect(worlds.some((w) => w.every((h) => h === 'BLACK'))).toBe(false);
  });

  it('A can only know when B and C are both black', () => {
    const knowing = worlds.filter((w) => knowsOwnHat(0, w, worlds));
    expect(knowing).toEqual([['WHITE', 'BLACK', 'BLACK']]);
  });

  it('every world surviving the transcript has C wearing white, and C truly knows in each', () => {
    const afterAB = applyStatements(worlds, HAT_STATEMENTS.slice(0, 2));
    expect(afterAB.length).toBeGreaterThan(0);
    expect(afterAB.every((w) => w[HAT_TARGET] === 'WHITE')).toBe(true);
    expect(afterAB.every((w) => knowsOwnHat(HAT_TARGET, w, afterAB))).toBe(true);
    expect(deduceColours(worlds, HAT_STATEMENTS, HAT_TARGET)).toEqual(['WHITE']);
  });

  it('the scenario is consistent (the transcript can actually happen)', () => {
    expect(applyStatements(worlds, HAT_STATEMENTS).length).toBeGreaterThan(0);
  });

  it('validates conclusions with normalisation', () => {
    const { validate } = PUZZLES.void;
    expect(validate('WHITE').verdict).toBe('correct');
    expect(validate(' white ').verdict).toBe('correct');
    expect(validate('w').verdict).toBe('correct');
    expect(validate('White hat').verdict).toBe('correct');
    expect(validate('BLACK').verdict).toBe('incorrect');
    expect(validate('grey').verdict).toBe('malformed');
  });
});

describe('normalizeAnswer', () => {
  it('collapses whitespace and case', () => {
    expect(normalizeAnswer('  wHite \n hat ')).toBe('WHITE HAT');
  });
});
