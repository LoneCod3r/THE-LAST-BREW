import type { CSSProperties, Ref } from 'react';
import { ENOUGH_LABELS, MoreCoffeeKey } from './MoreCoffeeKey';

interface EnoughKeysProps {
  ref?: Ref<HTMLButtonElement>;
  /** Where the casing key sits; Enough. stands beneath it. */
  style: CSSProperties;
  onLastDrop: () => void;
  onSecretBlend: () => void;
}

/**
 * The silent machine: two keys at once, one above the other, and nothing else.
 * Each does only its own thing.
 */
export function EnoughKeys({ ref, style, onLastDrop, onSecretBlend }: EnoughKeysProps) {
  return (
    <>
      <MoreCoffeeKey ref={ref} shown className="more-key--casing" style={style} label={ENOUGH_LABELS.lastDrop} onPress={onLastDrop} />
      <MoreCoffeeKey
        shown
        className="more-key--casing more-key--below"
        style={style}
        label={ENOUGH_LABELS.secretBlend}
        onPress={onSecretBlend}
      />
    </>
  );
}
