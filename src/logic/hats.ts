/**
 * Puzzle 03 model: possible-worlds reasoning about hats.
 *
 * A world assigns a hat to each person. A person "knows" their colour in a
 * world when every still-possible world that looks identical to them (same
 * hats on the others) gives them the same colour. A public statement
 * ("I know" / "I do not know") removes every world in which it would be false.
 */
export type Hat = 'WHITE' | 'BLACK';
export type World = readonly Hat[];

export interface Statement {
  person: number;
  knows: boolean;
}

/** All hat assignments for `people` drawn from a pool of `white` + `black` hats. */
export function enumerateWorlds(people: number, white: number, black: number): World[] {
  const worlds: World[] = [];
  const total = 2 ** people;
  for (let mask = 0; mask < total; mask += 1) {
    const world: Hat[] = [];
    for (let p = 0; p < people; p += 1) world.push(mask & (1 << p) ? 'BLACK' : 'WHITE');
    const blacks = world.filter((h) => h === 'BLACK').length;
    if (blacks <= black && people - blacks <= white) worlds.push(world);
  }
  return worlds;
}

function looksIdenticalTo(person: number, a: World, b: World): boolean {
  return a.every((hat, i) => i === person || hat === b[i]);
}

export function knowsOwnHat(person: number, world: World, possible: readonly World[]): boolean {
  return possible
    .filter((candidate) => looksIdenticalTo(person, world, candidate))
    .every((candidate) => candidate[person] === world[person]);
}

/** Apply a sequence of public, truthful statements. */
export function applyStatements(worlds: readonly World[], statements: readonly Statement[]): World[] {
  return statements.reduce<World[]>(
    (possible, s) => possible.filter((w) => knowsOwnHat(s.person, w, possible) === s.knows),
    [...worlds],
  );
}

/** The set of colours `person` can have in the worlds that survive the statements. */
export function deduceColours(worlds: readonly World[], statements: readonly Statement[], person: number): Hat[] {
  const surviving = applyStatements(worlds, statements);
  return [...new Set(surviving.map((w) => w[person]))].sort();
}
