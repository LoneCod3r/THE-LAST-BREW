/**
 * Puzzle 02 model: Mastermind-style code clues.
 * A code is accepted only if it is consistent with every clue and the clue set
 * admits exactly one such code.
 */
export interface CodeClue {
  guess: string;
  /** Digits correct and in the correct position. */
  inPlace: number;
  /** Digits correct but in the wrong position. */
  misplaced: number;
  text: string;
}

export interface Score {
  inPlace: number;
  misplaced: number;
}

/** Standard Mastermind scoring, correct for repeated digits. */
export function scoreGuess(secret: string, guess: string): Score {
  let inPlace = 0;
  const secretRest: Record<string, number> = {};
  const guessRest: Record<string, number> = {};
  for (let i = 0; i < secret.length; i += 1) {
    if (secret[i] === guess[i]) {
      inPlace += 1;
    } else {
      secretRest[secret[i]] = (secretRest[secret[i]] ?? 0) + 1;
      guessRest[guess[i]] = (guessRest[guess[i]] ?? 0) + 1;
    }
  }
  let misplaced = 0;
  for (const digit of Object.keys(guessRest)) {
    misplaced += Math.min(guessRest[digit], secretRest[digit] ?? 0);
  }
  return { inPlace, misplaced };
}

export function satisfiesClue(code: string, clue: CodeClue): boolean {
  const score = scoreGuess(code, clue.guess);
  return score.inPlace === clue.inPlace && score.misplaced === clue.misplaced;
}

/** Index of the first clue the code contradicts, or -1 when consistent with all. */
export function firstContradictedClue(code: string, clues: readonly CodeClue[]): number {
  return clues.findIndex((clue) => !satisfiesClue(code, clue));
}

/** Brute-force every code of the given length (repeated digits allowed). */
export function solveSafe(clues: readonly CodeClue[], length = 3): string[] {
  const solutions: string[] = [];
  const total = 10 ** length;
  for (let n = 0; n < total; n += 1) {
    const code = String(n).padStart(length, '0');
    if (firstContradictedClue(code, clues) === -1) solutions.push(code);
  }
  return solutions;
}
