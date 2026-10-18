import { useId, type FormEvent } from 'react';
import type { PuzzleInputSpec } from '../data/puzzles';
import type { Feedback } from '../state/machine';

interface PuzzleInputProps {
  spec: PuzzleInputSpec;
  feedback: Feedback | null;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (answer: string) => void;
}

/**
 * The answer bar: the input, the submit button and a one-line verdict. It sits
 * at the bottom of the puzzle screen and never scrolls away.
 */
export function PuzzleInput({ spec, feedback, value, onChange, onSubmit }: PuzzleInputProps) {
  const id = useId();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(value);
  };

  return (
    <form className={`answer answer--${spec.kind}`} onSubmit={submit}>
      <p
        className={`answer__status${feedback ? ` answer__status--${feedback.verdict}` : ''}`}
        role="status"
        aria-live="polite"
      >
        {feedback && <span key={feedback.seq}>{feedback.message}</span>}
      </p>

      {spec.kind === 'choice' ? (
        <fieldset className="answer__control plates">
          <legend className="sr-only">{spec.legend}</legend>
          {spec.options.map((option) => (
            <label key={option.value} className="plate">
              <input
                type="radio"
                name={id}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
              />
              <span className="plate__label">{option.label}</span>
            </label>
          ))}
        </fieldset>
      ) : (
        <div className="answer__control dial">
          <label className="sr-only" htmlFor={id}>
            {spec.label}
          </label>
          <input
            id={id}
            className="dial__input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            enterKeyHint="go"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, spec.length))}
          />
          <span className="dial__cells" aria-hidden="true">
            {Array.from({ length: spec.length }, (_, i) => (
              <span key={i} className={`dial__cell${i === value.length ? ' is-active' : ''}${value[i] ? ' is-filled' : ''}`}>
                {value[i] ?? '·'}
              </span>
            ))}
          </span>
        </div>
      )}

      <button type="submit" className="btn btn--primary answer__submit">
        {spec.submitLabel}
      </button>
    </form>
  );
}
