import { describe, expect, it } from 'vitest';
import type { PathId } from '../data/paths';
import { HEART_RATE_CRITICAL, postCoffeeMessage } from '../data/rewards';
import { casingControls, casingKey, createInitialState, gameReducer, offersEnough, setCompletedBefore, type GameAction, type GameState } from './machine';
import { emptyProgress, parseProgress } from './progress';
import { machineSelectProps } from '../components/machineSelectProps';
import { openLastDrop } from '../secret/destination';

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

/** Press the key (MORE COFFEE, or Enough? when it reads so) until the machine is fresh again (or the secret starts). */
function finish(state: GameState): GameState {
  let s = state;
  while (s.screen === 'PUZZLE_SOLVED' && s.serving && !s.serving.unveiling) {
    s = run(s, { type: offersEnough(s) ? 'ENOUGH' : 'MORE_COFFEE', page: s.serving.page });
  }
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
    s = drink(s, 'void');
    expect(s.serving?.pages).toEqual(['message', 'ritual', 'qr']);
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

describe('post-coffee message follows the coffees actually drunk', () => {
  /** The title the machine shows for the coffee just drunk. */
  const title = (s: GameState) => postCoffeeMessage(s.progress.drunk.length).title;

  it('first then third coffee counts two, not "Three down"', () => {
    let s = drink(createInitialState(), 'key');
    expect(title(s)).toBe('WELL PLAYED.');
    s = drink(finish(s), 'void');
    expect(s.progress.drunk).toEqual(['key', 'void']);
    expect(title(s)).toBe('ANOTHER ONE.');
    expect(s.serving?.pages).not.toContain('qr');
  });

  it('shows "Three down" only once all three distinct coffees are drunk, in any order', () => {
    const orders: PathId[][] = [
      ['key', 'void', 'mind'],
      ['void', 'mind', 'key'],
      ['mind', 'key', 'void'],
    ];
    for (const order of orders) {
      let s = createInitialState();
      const titles = order.map((id, i) => {
        s = drink(i ? finish(s) : s, id);
        return title(s);
      });
      expect(titles).toEqual(['WELL PLAYED.', 'ANOTHER ONE.', 'THREE DOWN.']);
      expect(s.progress.finalUnlocked).toBe(true);
    }
  });

  it('drinking the same coffee again does not advance the distinct count', () => {
    let s = drink(createInitialState(), 'void');
    s = drink(finish(s), 'void');
    expect(s.progress.drunk).toEqual(['void']);
    expect(title(s)).toBe('WELL PLAYED.');
    s = drink(finish(s), 'key');
    expect(title(s)).toBe('ANOTHER ONE.');
    // Three coffees, two distinct: no REGULAR CUSTOMER yet.
    expect(s.progress.coffees).toBe(3);
    expect(s.serving?.pages).toEqual(['message']);
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
    s = drink(s, 'key');
    // Three of the same coffee are not three distinct ones.
    expect(s.progress.coffees).toBe(3);
    expect(s.progress.eggs).not.toContain('coffeeRitual');
    expect(s.serving?.pages).toEqual(['message']);
    s = finish(drink(finish(s), 'mind'));
    expect(s.progress.eggs).not.toContain('coffeeRitual');
    s = drink(s, 'void');
    expect(s.progress.eggs).toContain('coffeeRitual');
    expect(s.serving?.pages).toEqual(['message', 'ritual', 'qr']);
    s = run(finish(s), { type: 'REVEAL_SECRET' }, { type: 'CLOSE_SECRET' });
    s = drink(s, 'key');
    expect(s.progress.coffees).toBe(6);
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

  it('follows the third message, the ritual and the silent page, plays once, then reveals', () => {
    let s = allThree();
    expect(s.serving?.pages).toEqual(['message', 'ritual', 'qr']);
    s = run(s, { type: 'MORE_COFFEE', page: 0 });
    expect(s.serving?.unveiling).toBe(false);
    s = run(s, { type: 'ENOUGH', page: 1 });
    expect(s.serving?.unveiling).toBe(false);
    s = run(s, { type: 'MORE_COFFEE', page: 2 });
    expect(s.serving?.unveiling).toBe(true);
    expect(run(s, { type: 'MORE_COFFEE', page: 2 })).toBe(s);
    s = run(s, { type: 'REVEAL_SECRET' });
    expect(s.screen).toBe('SECRET_BLEND');
    expect(s.secretFull).toBe(true);
    expect(s.progress.finalSeen).toBe(true);
    s = run(s, { type: 'CLOSE_SECRET' });
    expect(s.screen).toBe('PATH_SELECTION');
  });

  it('is not replayed in full, but stays reachable from the machine', () => {
    let s = run(finish(allThree()), { type: 'REVEAL_SECRET' }, { type: 'CLOSE_SECRET' });
    // A later coffee ends as usual, back at the machine: no silent page, no sequence.
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
    // The Coffee Ritual counts from zero: three new distinct coffees.
    s = finish(drink(s, 'key'));
    s = finish(drink(s, 'key'));
    s = finish(drink(s, 'mind'));
    expect(s.progress.eggs).not.toContain('coffeeRitual');
    s = drink(s, 'void');
    expect(s.serving?.pages).toEqual(['message', 'ritual', 'qr']);
    // And the final reward plays in full again once all three are drunk.
    s = finish(s);
    expect(s.serving?.unveiling).toBe(true);
    expect(run(s, { type: 'REVEAL_SECRET' }).secretFull).toBe(true);
  });
});

describe('Enough? / Enough. and the silent page', () => {
  /** Two coffees finished; the third is solved, brewed and picked up: the full set is drunk. */
  const third = () => {
    let s = finish(drink(createInitialState(), 'key'));
    s = finish(drink(s, 'mind'));
    return drink(s, 'void');
  };
  const enough = (s: GameState): GameAction => ({ type: 'ENOUGH', page: s.serving?.page ?? -1 });
  const more = (s: GameState): GameAction => ({ type: 'MORE_COFFEE', page: s.serving?.page ?? -1 });

  it('the first two coffees are unchanged: MORE COFFEE only, no code', () => {
    let s = drink(createInitialState(), 'key');
    expect(s.serving?.pages).toEqual(['message']);
    expect(offersEnough(s)).toBe(false);
    expect(run(s, enough(s))).toBe(s);
    s = finish(s);
    s = drink(s, 'mind');
    expect(s.serving?.pages).toEqual(['message']);
    expect(offersEnough(s)).toBe(false);
    expect(run(s, enough(s))).toBe(s);
    expect(run(s, more(s)).screen).toBe('PATH_SELECTION');
  });

  it('never appears before the full set: three coffees of two puzzles are not enough', () => {
    let s = finish(drink(createInitialState(), 'key'));
    s = finish(drink(s, 'mind'));
    s = drink(s, 'key');
    expect(s.progress.coffees).toBe(3);
    expect(s.serving?.pages).toEqual(['message']);
    for (; s.screen === 'PUZZLE_SOLVED'; s = run(s, more(s))) expect(offersEnough(s)).toBe(false);
    // Solved but not yet drunk is not enough either.
    s = brew(s, 'void');
    expect(offersEnough(s)).toBe(false);
    expect(run(s, { type: 'ENOUGH', page: 0 })).toBe(s);
  });

  it('after the third coffee ENOUGH opens the silent page from the page before it only, and MORE COFFEE cannot skip it', () => {
    let s = third();
    expect(s.serving?.pages).toEqual(['message', 'ritual', 'qr']);
    expect(offersEnough(s)).toBe(false);
    expect(run(s, enough(s))).toBe(s);
    s = run(s, more(s));
    expect(s.serving?.page).toBe(1);
    expect(offersEnough(s)).toBe(true);
    // MORE COFFEE is refused while the key reads Enough?: no skipping straight to the Secret Blend.
    expect(run(s, more(s))).toBe(s);
    expect(run(s, { type: 'REVEAL_SECRET' })).toBe(s);
  });

  it('ENOUGH opens the silent page once; a double press, keyboard repeat or stale press changes nothing', () => {
    const s = run(third(), { type: 'MORE_COFFEE', page: 0 });
    const shown = run(s, { type: 'ENOUGH', page: 1 });
    expect(shown.serving).toEqual({ pages: ['message', 'ritual', 'qr'], page: 2, unveiling: false });
    expect(offersEnough(shown)).toBe(false);
    // The second press of a double click (or a repeated Enter/Space) carries the old page.
    expect(run(shown, { type: 'ENOUGH', page: 1 })).toBe(shown);
    expect(run(shown, { type: 'ENOUGH', page: 2 })).toBe(shown);
    // A stale MORE COFFEE from the page before the silent page does nothing either.
    expect(run(shown, { type: 'MORE_COFFEE', page: 1 })).toBe(shown);
    expect(shown.progress).toBe(s.progress);
  });

  it('the full sequence: ENOUGH, the silent page, Enough., then the Secret Blend exactly once', () => {
    let s = third();
    s = run(s, more(s));
    s = run(s, enough(s));
    expect(s.serving?.pages[s.serving.page]).toBe('qr');
    const unveil = run(s, more(s));
    expect(unveil.serving?.unveiling).toBe(true);
    // Double press of Enough. on the silent page: the sequence starts once and nothing is skipped.
    expect(run(unveil, more(s))).toBe(unveil);
    expect(run(unveil, enough(s))).toBe(unveil);
    s = run(unveil, { type: 'REVEAL_SECRET' });
    expect(s).toMatchObject({ screen: 'SECRET_BLEND', secretFull: true });
    expect(s.progress.finalSeen).toBe(true);
    expect(run(s, { type: 'REVEAL_SECRET' })).toBe(s);
    s = run(s, { type: 'CLOSE_SECRET' });
    expect(s).toMatchObject({ screen: 'PATH_SELECTION', serving: null });
  });

  it('after the unlock, later coffees end as usual; the seal still opens the Secret Blend', () => {
    let s = run(finish(third()), { type: 'REVEAL_SECRET' }, { type: 'CLOSE_SECRET' });
    s = drink(s, 'key');
    expect(s.serving?.pages).toEqual(['message']);
    expect(offersEnough(s)).toBe(false);
    // MORE COFFEE goes straight back to a fresh machine.
    s = run(s, more(s));
    expect(s).toMatchObject({ screen: 'PATH_SELECTION', serving: null, sugar: 0, selection: null });
    expect(run(s, { type: 'OPEN_SECRET' })).toMatchObject({ screen: 'SECRET_BLEND', secretFull: false });
  });

  it('the ? disc: only on the coffee-selection machine, and only once all three distinct coffees are drunk', () => {
    const disc = (s: GameState) => machineSelectProps(s, () => {}).onLastDrop;
    // The selection machine, before and between the first two coffees: no disc.
    let s = run(createInitialState(), { type: 'OPEN_ARCHIVE' });
    expect(disc(s)).toBeUndefined();
    s = finish(drink(s, 'key'));
    expect(s.screen).toBe('PATH_SELECTION');
    expect(disc(s)).toBeUndefined();
    s = finish(drink(s, 'mind'));
    expect(disc(s)).toBeUndefined();
    // The third: brewing, THREE DOWN., REGULAR CUSTOMER and the silent page are the machine screen,
    // whose band has the keys only (MachineScreen passes no disc handler; see PuzzleDisc.test.ts).
    s = drink(s, 'void');
    while (s.serving && !s.serving.unveiling) {
      expect(casingControls(s.serving, true)).not.toHaveProperty('disc');
      s = run(s, casingKey(s.serving) === 'toSilent' ? enough(s) : more(s));
    }
    // Back on the selection machine after the Secret Blend: the disc, with the shared handler.
    s = run(s, { type: 'REVEAL_SECRET' }, { type: 'CLOSE_SECRET' });
    expect(s.screen).toBe('PATH_SELECTION');
    expect(disc(s)).toBe(openLastDrop);
  });

  it('is part of the session: after a page load it must be earned again', () => {
    const fresh = drink(createInitialState(), 'void');
    expect(fresh.serving?.pages).toEqual(['message']);
    expect(offersEnough(fresh)).toBe(false);
  });

  it('MORE COFFEE leads to the silent page, where Enough. (MORE_COFFEE) reaches the Secret Blend', () => {
    let s = finish(drink(createInitialState(), 'key'));
    s = finish(drink(s, 'void'));
    s = drink(s, 'mind');
    expect(postCoffeeMessage(s.progress.drunk.length).title).toBe('THREE DOWN.');
    const keys = [];
    while (s.serving && !s.serving.unveiling) {
      const k = casingKey(s.serving);
      keys.push(k);
      // The UI's mapping: MORE COFFEE before the silent page dispatches ENOUGH; Enough. dispatches MORE_COFFEE.
      s = run(s, k === 'toSilent' ? enough(s) : more(s));
    }
    expect(keys).toEqual(['more', 'toSilent', 'both']);
    // Enough. has carried on into the Secret Blend, in full, in this tab.
    s = run(s, { type: 'REVEAL_SECRET' });
    expect(s).toMatchObject({ screen: 'SECRET_BLEND', secretFull: true });
    expect(s.progress).toMatchObject({ drunk: ['key', 'mind', 'void'], finalUnlocked: true, finalSeen: true });
  });

  it('reaching the silent page starts nothing; both keys are offered there, and only there', () => {
    let s = run(third(), more(third()));
    expect(casingKey(s.serving!)).toBe('toSilent');
    s = run(s, enough(s));
    expect(s.serving?.unveiling).toBe(false);
    expect(s.screen).toBe('PUZZLE_SOLVED');
    expect(casingKey(s.serving!)).toBe('both');
    // Enough? dispatches nothing, so the game stays here; Enough. is the only way on.
    expect(run(s, enough(s))).toBe(s);
    // Before the full set, the key is only ever MORE COFFEE.
    let early = drink(createInitialState(), 'key');
    expect(casingKey(early.serving!)).toBe('more');
    early = drink(finish(early), 'void');
    expect(casingKey(early.serving!)).toBe('more');
  });

  it('regression: the silent page always carries both Enough keys', () => {
    const toSilent = (start: GameState) => {
      let s = start;
      while (s.serving && casingKey(s.serving) !== 'both') s = run(s, casingKey(s.serving) === 'toSilent' ? enough(s) : more(s));
      return s;
    };
    // The silent page comes once per session, after the unlocking coffee, whichever coffee that is.
    const viaMind = toSilent(third());
    const viaKey = toSilent(drink(finish(drink(finish(drink(createInitialState(), 'mind')), 'void')), 'key'));
    for (const silent of [viaMind, viaKey]) {
      expect(silent.serving?.pages[silent.serving.page]).toBe('qr');
      // Once the cup is gone, both keys stand and show.
      expect(casingControls(silent.serving, true)).toEqual({ keys: 'enough', keyShown: true });
      // Enough? dispatches nothing: the same state, so the same two keys.
      expect(casingControls(silent.serving, true).keys).toBe('enough');
      // Enough. starts the sequence; the keys step aside while it plays.
      const unveiling = run(silent, more(silent));
      expect(unveiling.serving?.unveiling).toBe(true);
      expect(casingControls(unveiling.serving, true)).toMatchObject({ keyShown: false });
      expect(run(unveiling, { type: 'REVEAL_SECRET' }).screen).toBe('SECRET_BLEND');
    }
    // The regular pages: one MORE COFFEE key.
    const regular = third();
    expect(casingControls(regular.serving, true)).toEqual({ keys: 'more', keyShown: true });
    // While the cup is still in hand, no key shows yet.
    expect(casingControls(regular.serving, false).keyShown).toBe(false);
  });

  it('ENOUGH does nothing anywhere else', () => {
    const intro = createInitialState();
    expect(run(intro, { type: 'ENOUGH', page: 0 })).toBe(intro);
    const machine = run(intro, { type: 'OPEN_ARCHIVE' });
    expect(run(machine, { type: 'ENOUGH', page: 0 })).toBe(machine);
    const unveiling = finish(third());
    expect(unveiling.serving?.unveiling).toBe(true);
    expect(run(unveiling, { type: 'ENOUGH', page: 2 })).toBe(unveiling);
  });
});

describe('regression: Strong coffee does not unlock the final progression early', () => {
  const more = (s: GameState): GameAction => ({ type: 'MORE_COFFEE', page: s.serving?.page ?? -1 });
  /** What the band under the screen offers on each page after a coffee, until the machine is fresh. */
  function band(start: GameState) {
    const out: { page: string; key: string }[] = [];
    let s = start;
    while (s.screen === 'PUZZLE_SOLVED' && s.serving && casingKey(s.serving) === 'more') {
      out.push({ page: s.serving.pages[s.serving.page], key: casingKey(s.serving) });
      s = run(s, more(s));
    }
    return { out, next: s };
  }
  /** Before the full set: one message page, MORE COFFEE only goes back to the machine, and no ? disc there. */
  function expectEarly(s: GameState) {
    expect(s.progress.finalUnlocked).toBe(false);
    expect(s.serving?.pages).toEqual(['message']);
    expect(offersEnough(s)).toBe(false);
    const { out, next } = band(s);
    expect(out).toEqual([{ page: 'message', key: 'more' }]);
    expect(next.screen).toBe('PATH_SELECTION');
    expect(machineSelectProps(next, () => {}).onLastDrop).toBeUndefined();
    return next;
  }

  it('Strong coffee first', () => {
    const s = drink(createInitialState(), 'void');
    expect(postCoffeeMessage(s.progress.drunk.length).title).toBe('WELL PLAYED.');
    expectEarly(s);
  });

  it('Strong coffee after another coffee', () => {
    let s = expectEarly(drink(createInitialState(), 'key'));
    s = drink(s, 'void');
    expect(postCoffeeMessage(s.progress.drunk.length).title).toBe('ANOTHER ONE.');
    expectEarly(s);
  });

  it('the same coffee again and again never completes the set', () => {
    let s = createInitialState();
    for (let i = 0; i < 4; i++) {
      s = drink(s, 'void');
      expect(s.progress.drunk).toEqual(['void']);
      expect(postCoffeeMessage(s.progress.drunk.length).title).toBe('WELL PLAYED.');
      expect(s.progress.eggs).not.toContain('coffeeRitual');
      s = expectEarly(s);
    }
    // Two distinct, five coffees: still not the set.
    s = drink(s, 'key');
    expect(s.progress.coffees).toBe(5);
    expectEarly(s);
  });

  it('the third distinct coffee, in any order: THREE DOWN., REGULAR CUSTOMER, then the silent screen; then the ? disc on the selection machine', () => {
    for (const order of [['void', 'key', 'mind'], ['key', 'void', 'mind'], ['mind', 'key', 'void']] as PathId[][]) {
      let s = expectEarly(drink(createInitialState(), order[0]));
      s = expectEarly(drink(s, order[1]));
      s = drink(s, order[2]);
      expect(postCoffeeMessage(s.progress.drunk.length).title).toBe('THREE DOWN.');
      expect(s.progress.finalUnlocked).toBe(true);
      expect(s.serving?.pages).toEqual(['message', 'ritual', 'qr']);
      // THREE DOWN. (MORE COFFEE), then REGULAR CUSTOMER (MORE COFFEE into the silent screen).
      expect(casingKey(s.serving!)).toBe('more');
      s = run(s, more(s));
      expect(s.serving?.pages[s.serving.page]).toBe('ritual');
      expect(casingKey(s.serving!)).toBe('toSilent');
      s = run(s, { type: 'ENOUGH', page: s.serving!.page });
      expect(casingControls(s.serving, true)).toEqual({ keys: 'enough', keyShown: true });
      // Back at the selection machine after the Secret Blend, the disc stands there.
      s = run(s, more(s), { type: 'REVEAL_SECRET' }, { type: 'CLOSE_SECRET' });
      expect(machineSelectProps(s, () => {}).onLastDrop).toBe(openLastDrop);
    }
  });
});

describe('regression: the silent screen follows only the unlocking coffee', () => {
  const more = (s: GameState): GameAction => ({ type: 'MORE_COFFEE', page: s.serving?.page ?? -1 });
  const enough = (s: GameState): GameAction => ({ type: 'ENOUGH', page: s.serving?.page ?? -1 });
  /** Play the pages after a coffee the way the casing keys do, recording each one, until the machine moves on. */
  function pagesAfter(start: GameState) {
    const seen: string[] = [];
    let s = start;
    while (s.screen === 'PUZZLE_SOLVED' && s.serving && !s.serving.unveiling) {
      const page = s.serving.pages[s.serving.page];
      seen.push(page);
      if (page === 'qr') break;
      s = run(s, casingKey(s.serving) === 'toSilent' ? enough(s) : more(s));
    }
    return { seen, s };
  }
  /** The first three distinct coffees, ending on the silent page of the third. */
  function unlock() {
    let s = finish(drink(createInitialState(), 'void'));
    s = finish(drink(s, 'key'));
    s = drink(s, 'mind');
    expect(s.progress.finalUnlocked).toBe(true);
    const { seen, s: silent } = pagesAfter(s);
    expect(seen).toEqual(['message', 'ritual', 'qr']);
    return silent;
  }

  it('the unlocking coffee: THREE DOWN., REGULAR CUSTOMER, then the silent screen with both keys', () => {
    const silent = unlock();
    expect(postCoffeeMessage(silent.progress.drunk.length).title).toBe('THREE DOWN.');
    expect(casingKey(silent.serving!)).toBe('both');
    expect(casingControls(silent.serving, true)).toEqual({ keys: 'enough', keyShown: true });
  });

  it('Enough? leaves the game exactly where it is; Enough. plays the Secret Blend', () => {
    const silent = unlock();
    // Enough? dispatches nothing in the game (the page opens the Last Drop in a new tab):
    // any game action from the keys other than Enough. leaves the state untouched.
    expect(run(silent, enough(silent))).toBe(silent);
    const unveiling = run(silent, more(silent));
    expect(unveiling.serving?.unveiling).toBe(true);
    const secret = run(unveiling, { type: 'REVEAL_SECRET' });
    expect(secret).toMatchObject({ screen: 'SECRET_BLEND', secretFull: true });
    expect(secret.progress.finalSeen).toBe(true);
  });

  it('a fourth coffee after the unlock ends as usual: no silent screen, MORE COFFEE back to the machine', () => {
    let s = run(unlock(), { type: 'MORE_COFFEE', page: 2 }, { type: 'REVEAL_SECRET' }, { type: 'CLOSE_SECRET' });
    expect(s.screen).toBe('PATH_SELECTION');
    s = drink(s, 'key');
    expect(s.progress.finalUnlocked).toBe(true);
    expect(s.serving?.pages).toEqual(['message']);
    expect(offersEnough(s)).toBe(false);
    expect(casingKey(s.serving!)).toBe('more');
    s = run(s, more(s));
    expect(s).toMatchObject({ screen: 'PATH_SELECTION', serving: null });
    // The unlock stays: the selection machine still offers the seal and the ? disc.
    const props = machineSelectProps(s, () => {});
    expect(props.onSecret).toBeTypeOf('function');
    expect(props.onLastDrop).toBe(openLastDrop);
    expect(run(s, { type: 'OPEN_SECRET' })).toMatchObject({ screen: 'SECRET_BLEND', secretFull: false });
  });

  it('repeated coffees after the unlock never bring the silent screen back', () => {
    let s = run(unlock(), { type: 'MORE_COFFEE', page: 2 }, { type: 'REVEAL_SECRET' }, { type: 'CLOSE_SECRET' });
    for (const id of ['key', 'key', 'void', 'mind', 'mind'] as PathId[]) {
      s = drink(s, id);
      const { seen, s: after } = pagesAfter(s);
      expect(seen).toEqual(['message']);
      s = after;
      expect(s.screen).toBe('PATH_SELECTION');
    }
    expect(s.progress.coffees).toBe(8);
    expect(machineSelectProps(s, () => {}).onLastDrop).toBe(openLastDrop);
  });

  it('before the full set nothing changes: repeats never unlock, and no silent screen', () => {
    let s = createInitialState();
    for (const id of ['void', 'void', 'key', 'key'] as PathId[]) {
      s = drink(s, id);
      expect(s.progress.finalUnlocked).toBe(false);
      const { seen, s: after } = pagesAfter(s);
      expect(seen).toEqual(['message']);
      s = after;
    }
    expect(machineSelectProps(s, () => {}).onLastDrop).toBeUndefined();
  });
});

describe('post-coffee messages after the third distinct coffee: HEART RATE: CRITICAL.', () => {
  const more = (s: GameState): GameAction => ({ type: 'MORE_COFFEE', page: s.serving?.page ?? -1 });
  const enough = (s: GameState): GameAction => ({ type: 'ENOUGH', page: s.serving?.page ?? -1 });
  /** The message the machine shows for the coffee just drunk, exactly as MachineScreen picks it. */
  const shown = (s: GameState) => postCoffeeMessage(s.progress.drunk.length, setCompletedBefore(s.serving!, s.progress.drunk.length));
  const THREE_DOWN = { title: 'THREE DOWN.', body: 'Three puzzles. Three coffees. But the archive has one more secret.' };
  const HEART = { title: 'HEART RATE: CRITICAL.', body: 'Three coffees were a puzzle. The next one is a medical decision.' };
  /** Leave the pages the way the keys do; through the silent page with Enough., then the Secret Blend, back to the machine. */
  function leave(start: GameState) {
    let s = start;
    while (s.screen === 'PUZZLE_SOLVED' && s.serving && !s.serving.unveiling) {
      s = run(s, casingKey(s.serving) === 'toSilent' ? enough(s) : more(s));
    }
    if (s.serving?.unveiling) s = run(s, { type: 'REVEAL_SECRET' }, { type: 'CLOSE_SECRET' });
    expect(s.screen).toBe('PATH_SELECTION');
    return s;
  }

  it('the exact copy', () => {
    expect(HEART_RATE_CRITICAL).toEqual(HEART);
    expect(postCoffeeMessage(3)).toEqual(THREE_DOWN);
    expect(postCoffeeMessage(3, true)).toEqual(HEART);
  });

  it('every order: THREE DOWN. on the third distinct coffee, HEART RATE: CRITICAL. on the fourth and every one after', () => {
    const orders: PathId[][] = [
      ['key', 'mind', 'void'], ['key', 'void', 'mind'], ['mind', 'key', 'void'],
      ['mind', 'void', 'key'], ['void', 'key', 'mind'], ['void', 'mind', 'key'],
    ];
    for (const order of orders) {
      let s = drink(createInitialState(), order[0]);
      expect(shown(s).title).toBe('WELL PLAYED.');
      s = drink(leave(s), order[1]);
      expect(shown(s).title).toBe('ANOTHER ONE.');
      s = drink(leave(s), order[2]);
      expect(shown(s)).toEqual(THREE_DOWN);
      // The unlocking coffee still leads to the silent screen.
      expect(s.serving?.pages).toEqual(['message', 'ritual', 'qr']);
      // Fourth coffee, of each kind, and on and on: always the heart rate, never the silent screen again.
      s = leave(s);
      for (const id of [...order, order[0], order[0]]) {
        s = drink(s, id);
        expect(shown(s)).toEqual(HEART);
        expect(s.serving?.pages).toEqual(['message']);
        s = leave(s);
      }
      expect(s.progress.coffees).toBe(8);
    }
  });

  it('repeats before the set are counted once: the third distinct coffee is THREE DOWN., not the heart rate', () => {
    let s = drink(createInitialState(), 'void');
    s = drink(leave(s), 'void');
    expect(shown(s).title).toBe('WELL PLAYED.');
    s = drink(leave(s), 'key');
    s = drink(leave(s), 'key');
    expect(shown(s).title).toBe('ANOTHER ONE.');
    // Fifth drink, third distinct: the set is completed now, not before.
    s = drink(leave(s), 'mind');
    expect(s.progress.coffees).toBe(5);
    expect(setCompletedBefore(s.serving!, s.progress.drunk.length)).toBe(false);
    expect(shown(s)).toEqual(THREE_DOWN);
    // The next one, a repeat: the heart rate.
    s = drink(leave(s), 'void');
    expect(setCompletedBefore(s.serving!, s.progress.drunk.length)).toBe(true);
    expect(shown(s)).toEqual(HEART);
  });
});
