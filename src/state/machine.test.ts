import { describe, expect, it } from 'vitest';
import type { PathId } from '../data/paths';
import { createInitialState, gameReducer, type GameAction, type GameState } from './machine';
import { emptyProgress, parseProgress } from './progress';

const run = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state);

const ANSWERS: Record<PathId, string> = { key: 'C', mind: '042', void: 'WHITE' };

/** Select, solve and brew a coffee, ending on PUZZLE_SOLVED with the cup not yet picked up. */
function brew(state: GameState, id: PathId): GameState {
  let s = state.screen === 'INTRO' ? run(state, { type: 'OPEN_ARCHIVE' }) : state;
  s = run(s, { type: 'SELECT_PATH', pathId: id }, { type: 'SUBMIT_ANSWER', answer: ANSWERS[id] }, { type: 'BEGIN_BREW' });
  return run(s, { type: 'BREW_COMPLETE', run: s.brewRun });
}

/** ...and pick the cup up. */
const drink = (state: GameState, id: PathId) => {
  const s = brew(state, id);
  return run(s, { type: 'DRINK_COMPLETE', run: s.brewRun });
};

/** Press MORE COFFEE until the machine is fresh again (or the secret starts). */
function finish(state: GameState): GameState {
  let s = state;
  while (s.screen === 'PUZZLE_SOLVED' && s.serving && !s.serving.unveiling) s = run(s, { type: 'MORE_COFFEE', page: s.serving.page });
  return s;
}

describe('game state machine', () => {
  it('starts at INTRO and only CHOICE opens the archive', () => {
    const s = createInitialState();
    expect(s.screen).toBe('INTRO');
    expect(run(s, { type: 'SELECT_PATH', pathId: 'key' }).screen).toBe('INTRO');
    expect(run(s, { type: 'OPEN_ARCHIVE' }).screen).toBe('PATH_SELECTION');
  });

  it('cannot brew, drink or continue without a correct answer', () => {
    const s = run(createInitialState(), { type: 'OPEN_ARCHIVE' }, { type: 'SELECT_PATH', pathId: 'key' });
    expect(run(s, { type: 'BEGIN_BREW' }).screen).toBe('PUZZLE');
    expect(run(s, { type: 'BREW_COMPLETE', run: 0 }).screen).toBe('PUZZLE');
    expect(run(s, { type: 'DRINK_COMPLETE', run: 0 })).toBe(s);
    expect(run(s, { type: 'MORE_COFFEE', page: 0 })).toBe(s);
  });

  it('incorrect answers stay on the puzzle, log the attempt, and never unlock', () => {
    let s = run(createInitialState(), { type: 'OPEN_ARCHIVE' }, { type: 'SELECT_PATH', pathId: 'mind' });
    s = run(s, { type: 'SUBMIT_ANSWER', answer: '738' });
    expect(s.screen).toBe('PUZZLE');
    expect(s.session?.attempts).toHaveLength(1);
    expect(s.session?.feedback?.message).toBe('ACCESS DENIED');
    expect(s.progress.solved).toEqual([]);
    s = run(s, { type: 'SUBMIT_ANSWER', answer: '12' });
    expect(s.session?.attempts).toHaveLength(1);
    expect(s.session?.feedback?.verdict).toBe('malformed');
    expect(s.session?.feedback?.seq).toBe(2);
  });

  it('runs the full journey: solve, brew, drink, MORE COFFEE', () => {
    let s = run(
      createInitialState(),
      { type: 'OPEN_ARCHIVE' },
      { type: 'SELECT_PATH', pathId: 'key' },
      { type: 'SUBMIT_ANSWER', answer: 'A' },
      { type: 'SUBMIT_ANSWER', answer: 'C' },
    );
    expect(s.screen).toBe('ACCESS_GRANTED');
    expect(s.session).toBeNull();
    expect(s.solve).toEqual({ pathId: 'key', attempts: 2, sugar: 0 });
    expect(s.progress.solved).toEqual(['key']);

    s = run(s, { type: 'BEGIN_BREW' });
    expect(s.screen).toBe('BREWING');
    const brewRun = s.brewRun;
    expect(run(s, { type: 'BREW_COMPLETE', run: brewRun - 1 }).screen).toBe('BREWING');
    s = run(s, { type: 'BREW_COMPLETE', run: brewRun });
    expect(s.screen).toBe('PUZZLE_SOLVED');
    expect(s.serving).toBeNull();
    expect(s.progress.drunk).toEqual([]);

    s = run(s, { type: 'DRINK_COMPLETE', run: brewRun });
    expect(s.serving).toEqual({ pages: ['message'], page: 0, unveiling: false });
    expect(s.progress).toMatchObject({ drunk: ['key'], coffees: 1 });

    s = run(s, { type: 'MORE_COFFEE', page: 0 });
    expect(s.screen).toBe('PATH_SELECTION');
    expect(s.activePath).toBeNull();
    expect(s.solve).toBeNull();
    expect(s.serving).toBeNull();
  });

  it('reopening a case starts a clean session', () => {
    let s = run(
      createInitialState(),
      { type: 'OPEN_ARCHIVE' },
      { type: 'SELECT_PATH', pathId: 'mind' },
      { type: 'SUBMIT_ANSWER', answer: '111' },
      { type: 'LEAVE_PUZZLE' },
    );
    expect(s.screen).toBe('PATH_SELECTION');
    const prevId = s.sessionCounter;
    s = run(s, { type: 'SELECT_PATH', pathId: 'mind' });
    expect(s.session).toMatchObject({ attempts: [], feedback: null });
    expect(s.session?.id).toBe(prevId + 1);
  });

  it('paths need not be completed in order, and solved cases are remembered', () => {
    const s = finish(drink(createInitialState(), 'void'));
    expect(s.progress.solved).toEqual(['void']);
  });

  it('sugar is set on the machine only, clamped to 0–5, and carried into the brew', () => {
    let s = run(createInitialState(), { type: 'SET_SUGAR', level: 3 });
    expect(s.sugar).toBe(0);
    s = run(s, { type: 'OPEN_ARCHIVE' }, { type: 'SET_SUGAR', level: 9 });
    expect(s.sugar).toBe(5);
    s = run(s, { type: 'SET_SUGAR', level: -2 });
    expect(s.sugar).toBe(0);
    s = run(s, { type: 'SET_SUGAR', level: 3 }, { type: 'SELECT_PATH', pathId: 'mind' });
    expect(run(s, { type: 'SET_SUGAR', level: 1 }).sugar).toBe(3);
    s = run(s, { type: 'LEAVE_PUZZLE' });
    expect(s.sugar).toBe(3);
    s = run(s, { type: 'SELECT_PATH', pathId: 'mind' }, { type: 'SUBMIT_ANSWER', answer: '111' });
    expect(s.screen).toBe('PUZZLE');
    s = run(s, { type: 'SUBMIT_ANSWER', answer: '042' }, { type: 'BEGIN_BREW' });
    expect(s.solve?.sugar).toBe(3);
    s = run(s, { type: 'BREW_COMPLETE', run: s.brewRun }, { type: 'DRINK_COMPLETE', run: s.brewRun });
    s = finish(s);
    expect(s.sugar).toBe(0);
  });

  it('backing out of a puzzle keeps the coffee, the sugar and the half-typed answer', () => {
    let s = run(
      createInitialState(),
      { type: 'OPEN_ARCHIVE' },
      { type: 'SET_SUGAR', level: 2 },
      { type: 'SELECT_PATH', pathId: 'mind' },
      { type: 'SET_DRAFT', value: '04' },
      { type: 'LEAVE_PUZZLE' },
    );
    expect(s.screen).toBe('PATH_SELECTION');
    expect(s).toMatchObject({ selection: 'mind', sugar: 2, drafts: { mind: '04' } });
    expect(run(s, { type: 'SET_DRAFT', value: '9' }).drafts.mind).toBe('04');
    s = run(s, { type: 'SELECT_PATH', pathId: 'mind' }, { type: 'SUBMIT_ANSWER', answer: '042' });
    expect(s.screen).toBe('ACCESS_GRANTED');
    expect(s.drafts.mind).toBeUndefined();
    s = run(s, { type: 'BEGIN_BREW' });
    s = finish(run(s, { type: 'BREW_COMPLETE', run: s.brewRun }, { type: 'DRINK_COMPLETE', run: s.brewRun }));
    expect(s).toMatchObject({ selection: null, sugar: 0 });
  });

  it('progress handed to the machine never opens a puzzle', () => {
    const progress = parseProgress({ version: 1, solved: ['key', 'mind', 'void', 'bogus'], drunk: ['key', 'mind', 'void'], coffees: 3, eggs: [] });
    let s = run(createInitialState(progress), { type: 'OPEN_ARCHIVE' });
    expect(s.progress.solved).toEqual(['key', 'mind', 'void']);
    s = run(s, { type: 'SELECT_PATH', pathId: 'key' });
    expect(s.screen).toBe('PUZZLE');
    expect(run(s, { type: 'BEGIN_BREW' }).screen).toBe('PUZZLE');
    expect(run(s, { type: 'SUBMIT_ANSWER', answer: 'A' }).screen).toBe('PUZZLE');
  });
});

describe('MORE COFFEE and the post-coffee message', () => {
  it('is unavailable before the cup is picked up', () => {
    const s = brew(createInitialState(), 'key');
    expect(s.screen).toBe('PUZZLE_SOLVED');
    expect(run(s, { type: 'MORE_COFFEE', page: 0 })).toBe(s);
  });

  it('the message comes only from the drinking, not from the solve or the brew', () => {
    let s = run(createInitialState(), { type: 'OPEN_ARCHIVE' }, { type: 'SELECT_PATH', pathId: 'mind' }, { type: 'SUBMIT_ANSWER', answer: '042' });
    expect(s.serving).toBeNull();
    s = run(s, { type: 'BEGIN_BREW' }, { type: 'BREW_COMPLETE', run: s.brewRun + 1 });
    expect(s.serving).toBeNull();
    s = run(s, { type: 'DRINK_COMPLETE', run: s.brewRun });
    expect(s.serving?.pages).toEqual(['message']);
  });

  it('a repeated or stale drinking event never counts twice', () => {
    let s = brew(createInitialState(), 'key');
    expect(run(s, { type: 'DRINK_COMPLETE', run: s.brewRun - 1 })).toBe(s);
    s = run(s, { type: 'DRINK_COMPLETE', run: s.brewRun });
    const again = run(s, { type: 'DRINK_COMPLETE', run: s.brewRun });
    expect(again).toBe(s);
    expect(again.progress.coffees).toBe(1);
  });

  it('a double activation advances only once', () => {
    let s = createInitialState();
    s = finish(drink(s, 'key'));
    s = finish(drink(s, 'mind'));
    s = drink(s, 'key');
    expect(s.serving?.pages).toEqual(['message', 'ritual']);
    const once = run(s, { type: 'MORE_COFFEE', page: 0 });
    const twice = run(once, { type: 'MORE_COFFEE', page: 0 });
    expect(once.serving?.page).toBe(1);
    expect(twice).toBe(once);
  });

  it('MORE COFFEE does nothing outside the served machine', () => {
    const s = run(createInitialState(), { type: 'OPEN_ARCHIVE' });
    expect(run(s, { type: 'MORE_COFFEE', page: 0 })).toBe(s);
  });
});

describe('Easter eggs', () => {
  it('each machine egg is awarded once and shows its notice once', () => {
    let s = run(createInitialState(), { type: 'OPEN_ARCHIVE' }, { type: 'FIND_EGG', egg: 'curiousBarista' });
    expect(s.progress.eggs).toEqual(['curiousBarista']);
    expect(s.notice).toEqual({ id: 'curiousBarista', seq: 1 });
    s = run(s, { type: 'DISMISS_NOTICE', seq: 1 });
    expect(s.notice).toBeNull();
    const again = run(s, { type: 'FIND_EGG', egg: 'curiousBarista' });
    expect(again).toBe(s);
    s = run(s, { type: 'FIND_EGG', egg: 'missingBean' }, { type: 'FIND_EGG', egg: 'nightShift' });
    expect(s.progress.eggs).toEqual(['curiousBarista', 'missingBean', 'nightShift']);
  });

  it('a stale dismissal leaves a newer notice alone', () => {
    let s = run(createInitialState(), { type: 'OPEN_ARCHIVE' }, { type: 'FIND_EGG', egg: 'missingBean' }, { type: 'FIND_EGG', egg: 'curiousBarista' });
    s = run(s, { type: 'DISMISS_NOTICE', seq: 1 });
    expect(s.notice?.id).toBe('curiousBarista');
  });

  it('Night Shift only counts on the idle machine, never on the puzzle', () => {
    const intro = createInitialState();
    expect(run(intro, { type: 'FIND_EGG', egg: 'nightShift' })).toBe(intro);
    const puzzle = run(intro, { type: 'OPEN_ARCHIVE' }, { type: 'SELECT_PATH', pathId: 'mind' });
    expect(run(puzzle, { type: 'FIND_EGG', egg: 'nightShift' })).toBe(puzzle);
    expect(run(puzzle, { type: 'FIND_EGG', egg: 'missingBean' })).toBe(puzzle);
    const brewing = run(puzzle, { type: 'SUBMIT_ANSWER', answer: '042' }, { type: 'BEGIN_BREW' });
    expect(run(brewing, { type: 'FIND_EGG', egg: 'nightShift' })).toBe(brewing);
    expect(run(brewing, { type: 'FIND_EGG', egg: 'missingBean' }).progress.eggs).toEqual(['missingBean']);
  });

  it('Coffee Ritual: three distinct finished coffees, any puzzles, once', () => {
    let s = finish(drink(createInitialState(), 'key'));
    s = finish(drink(s, 'key'));
    expect(s.progress.eggs).not.toContain('coffeeRitual');
    s = drink(s, 'key');
    expect(s.progress.coffees).toBe(3);
    expect(s.progress.eggs).toContain('coffeeRitual');
    expect(s.serving?.pages).toEqual(['message', 'ritual']);
    s = finish(s);
    s = drink(s, 'key');
    expect(s.progress.coffees).toBe(4);
    expect(s.serving?.pages).toEqual(['message']);
    expect(s.progress.eggs.filter((e) => e === 'coffeeRitual')).toHaveLength(1);
  });

  it('brewing without drinking does not count toward the ritual', () => {
    let s = brew(createInitialState(), 'key');
    // Leaving the cup is not possible (MORE COFFEE is unavailable), so the count stays at zero.
    s = run(s, { type: 'MORE_COFFEE', page: 0 });
    expect(s.progress.coffees).toBe(0);
  });
});

describe('the Secret Blend', () => {
  const allThree = () => {
    let s = finish(drink(createInitialState(), 'key'));
    s = finish(drink(s, 'mind'));
    return drink(s, 'void');
  };

  it('needs every puzzle solved and drunk; Easter eggs are not required', () => {
    let s = finish(drink(createInitialState(), 'key'));
    s = finish(drink(s, 'mind'));
    expect(s.progress.finalUnlocked).toBe(false);
    expect(run(s, { type: 'OPEN_SECRET' })).toBe(s);
    // Solving the third without drinking it is not enough.
    s = brew(s, 'void');
    expect(s.progress.finalUnlocked).toBe(false);
    s = run(s, { type: 'DRINK_COMPLETE', run: s.brewRun });
    expect(s.progress.finalUnlocked).toBe(true);
    expect(s.progress.eggs).toContain('coffeeRitual');
  });

  it('follows the third message (and the ritual), plays once, then reveals', () => {
    let s = allThree();
    expect(s.serving?.pages).toEqual(['message', 'ritual']);
    s = run(s, { type: 'MORE_COFFEE', page: 0 });
    expect(s.serving?.unveiling).toBe(false);
    s = run(s, { type: 'MORE_COFFEE', page: 1 });
    expect(s.serving?.unveiling).toBe(true);
    expect(run(s, { type: 'MORE_COFFEE', page: 1 })).toBe(s);
    s = run(s, { type: 'REVEAL_SECRET' });
    expect(s.screen).toBe('SECRET_BLEND');
    expect(s.secretFull).toBe(true);
    expect(s.progress.finalSeen).toBe(true);
    s = run(s, { type: 'CLOSE_SECRET' });
    expect(s.screen).toBe('PATH_SELECTION');
  });

  it('is not replayed in full, but stays reachable from the machine', () => {
    let s = run(finish(allThree()), { type: 'REVEAL_SECRET' }, { type: 'CLOSE_SECRET' });
    s = finish(drink(s, 'mind'));
    expect(s.screen).toBe('PATH_SELECTION');
    s = run(s, { type: 'OPEN_SECRET' });
    expect(s).toMatchObject({ screen: 'SECRET_BLEND', secretFull: false });
  });

  it('an unlocked but unseen reward plays in full when opened from the machine', () => {
    const p = allThree().progress;
    expect(p.finalSeen).toBe(false);
    const opened = run(createInitialState(p), { type: 'OPEN_ARCHIVE' }, { type: 'OPEN_SECRET' });
    expect(opened).toMatchObject({ screen: 'SECRET_BLEND', secretFull: true });
    const again = run(opened, { type: 'CLOSE_SECRET' }, { type: 'OPEN_SECRET' });
    expect(again.secretFull).toBe(false);
  });

  it('REVEAL_SECRET cannot be forced', () => {
    const s = run(createInitialState(emptyProgress()), { type: 'OPEN_ARCHIVE' });
    expect(run(s, { type: 'REVEAL_SECRET' })).toBe(s);
    const served = drink(createInitialState(), 'key');
    expect(run(served, { type: 'REVEAL_SECRET' })).toBe(served);
  });
});

describe('sessions: progress lasts until the page is reloaded', () => {
  /** Everything: three puzzles, three coffees, the ritual, the eggs and the final reward, seen. */
  function completeSession(): GameState {
    let s = run(createInitialState(), { type: 'OPEN_ARCHIVE' }, { type: 'FIND_EGG', egg: 'curiousBarista' }, { type: 'FIND_EGG', egg: 'nightShift' }, { type: 'FIND_EGG', egg: 'missingBean' });
    s = finish(drink(s, 'key'));
    s = finish(drink(s, 'mind'));
    s = finish(drink(s, 'void'));
    return run(s, { type: 'REVEAL_SECRET' }, { type: 'CLOSE_SECRET' });
  }

  it('nothing resets during play: leaving puzzles, MORE COFFEE and the secret screen all keep progress', () => {
    let s = completeSession();
    const done = s.progress;
    expect(done).toMatchObject({ solved: ['key', 'mind', 'void'], drunk: ['key', 'mind', 'void'], coffees: 3, finalUnlocked: true, finalSeen: true });
    expect([...done.eggs].sort()).toEqual(['coffeeRitual', 'curiousBarista', 'missingBean', 'nightShift']);
    s = run(s, { type: 'SELECT_PATH', pathId: 'mind' }, { type: 'SET_DRAFT', value: '0' }, { type: 'LEAVE_PUZZLE' }, { type: 'OPEN_SECRET' }, { type: 'CLOSE_SECRET' });
    expect(s.progress).toBe(done);
  });

  it('a page load starts a brand-new session: the same start the app uses', () => {
    // The app builds its state with createInitialState() on every page load; no progress is restored.
    expect(completeSession().progress.finalSeen).toBe(true);
    const fresh = run(createInitialState(), { type: 'OPEN_ARCHIVE' });
    expect(fresh.progress).toEqual(emptyProgress());
    expect(fresh).toMatchObject({ sugar: 0, selection: null, drafts: {}, serving: null, notice: null });
  });

  it('after a fresh start every reward has to be earned again', () => {
    let s = run(createInitialState(), { type: 'OPEN_ARCHIVE' });
    // The Secret Blend is locked again.
    expect(run(s, { type: 'OPEN_SECRET' })).toBe(s);
    // Each machine egg can be found again, with its message.
    s = run(s, { type: 'FIND_EGG', egg: 'missingBean' });
    expect(s.notice?.id).toBe('missingBean');
    // The Coffee Ritual counts from zero: three new coffees.
    s = finish(drink(s, 'key'));
    s = finish(drink(s, 'key'));
    expect(s.progress.eggs).not.toContain('coffeeRitual');
    s = drink(s, 'key');
    expect(s.serving?.pages).toEqual(['message', 'ritual']);
    // And the final reward plays in full again once all three are drunk.
    s = finish(drink(finish(s), 'mind'));
    s = drink(s, 'void');
    s = finish(s);
    expect(s.serving?.unveiling).toBe(true);
    expect(run(s, { type: 'REVEAL_SECRET' }).secretFull).toBe(true);
  });
});
