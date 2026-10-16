import { PATHS } from '../data/paths';
import { SECRET_BLEND } from '../data/rewards';
import { MoreCoffeeKey } from './MoreCoffeeKey';

interface SecretBlendProps {
  /** The first time it unfolds line by line; afterwards it is simply there. */
  full: boolean;
  onContinue: () => void;
}

/** The final reward: the three roasts become one, and the archive's last entry. */
export function SecretBlend({ full, onContinue }: SecretBlendProps) {
  return (
    <section
      className={`secret${full ? ' is-full' : ''}`}
      aria-labelledby="secret-title"
      tabIndex={-1}
      data-screen-focus
    >
      <div className="secret__blend" aria-hidden="true">
        {PATHS.map((p, i) => (
          <i key={p.id} style={{ background: p.roast, ['--i' as string]: i }} />
        ))}
      </div>
      <h1 id="secret-title" className="secret__title">
        {SECRET_BLEND.title}
      </h1>
      <p className="secret__lead">{SECRET_BLEND.lead}</p>
      <article className="secret__entry" aria-labelledby="secret-entry">
        <h2 id="secret-entry" className="secret__label">
          {SECRET_BLEND.entryLabel}
        </h2>
        {SECRET_BLEND.entry.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </article>
      <p className="secret__achievement">{SECRET_BLEND.achievement}</p>
      <MoreCoffeeKey shown onPress={onContinue} className="more-key--free" />
    </section>
  );
}
