/**
 * Puzzle 01 model: three switches, exactly N of the statements are true.
 * The answer is derived by evaluating every statement under every candidate,
 * never by comparing against a stored string.
 */
export type Switch = 'A' | 'B' | 'C';

export const SWITCHES: readonly Switch[] = ['A', 'B', 'C'];

export interface SwitchStatement {
  speaker: Switch;
  text: string;
  holds: (key: Switch) => boolean;
}

export function countTrueStatements(statements: readonly SwitchStatement[], key: Switch): number {
  return statements.filter((statement) => statement.holds(key)).length;
}

/** Every key position under which exactly `requiredTrue` statements hold. */
export function solveFirstLock(statements: readonly SwitchStatement[], requiredTrue: number): Switch[] {
  return SWITCHES.filter((key) => countTrueStatements(statements, key) === requiredTrue);
}

export function isSwitch(value: string): value is Switch {
  return (SWITCHES as readonly string[]).includes(value);
}
