const WORDS = ['FREEDOM', 'IS', 'YOUR'] as const;

/**
 * The landing screen: one line of text and nothing else. The last word,
 * CHOICE, is the way in; it is set in the same type as the rest of the line.
 */
export function IntroScreen({ onChoose }: { onChoose: () => void }) {
  return (
    <section className="landing" aria-labelledby="landing-line">
      <h1 id="landing-line" className="landing__line">
        {WORDS.map((word, i) => (
          <span key={word}>
            <span className="landing__word" style={{ animationDelay: `${300 + i * 450}ms` }}>
              {word}
            </span>{' '}
          </span>
        ))}
        <button
          type="button"
          className="landing__word landing__choice"
          style={{ animationDelay: `${300 + WORDS.length * 450 + 250}ms` }}
          onClick={onChoose}
        >
          CHOICE
        </button>
      </h1>
    </section>
  );
}
