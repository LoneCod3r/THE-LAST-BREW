import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PUZZLES } from '../data/puzzles';
import { PuzzleInput } from './PuzzleInput';

const noop = () => {};
const submitText = (html: string) => html.match(/<button type="submit" class="btn btn--primary answer__submit">([^<]*)<\/button>/)?.[1];

describe('the answer bar submit button', () => {
  it('reads exactly SUBMIT ANSWER on the COFFEE puzzle (The First Lock)', () => {
    expect(PUZZLES.key.input.submitLabel).toBe('SUBMIT ANSWER');
    const html = renderToString(createElement(PuzzleInput, { spec: PUZZLES.key.input, feedback: null, value: '', onChange: noop, onSubmit: noop }));
    expect(submitText(html)).toBe('SUBMIT ANSWER');
    expect(html).not.toContain('ENGAGE SWITCH');
  });

  it('leaves the other puzzles’ labels as they were', () => {
    expect(PUZZLES.mind.input.submitLabel).toBe('SUBMIT CODE');
    expect(PUZZLES.void.input.submitLabel).toBe('SUBMIT CONCLUSION');
  });
});
