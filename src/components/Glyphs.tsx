import type { PathId } from '../data/paths';

/** The archive's sigil: an incomplete circle, three marks, one centre. */
export function Sigil({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <circle cx="60" cy="60" r="44" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="230 46" transform="rotate(-62 60 60)" />
      <circle cx="60" cy="60" r="30" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.6" />
      <path d="M60 8v22M60 90v22M8 60h22" stroke="currentColor" strokeWidth="1" />
      <path d="M38 76 60 40l22 36Z" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="60" cy="62" r="3" fill="currentColor" />
    </svg>
  );
}

/** One distinct symbol per path, drawn in the same line language. */
export function PathSymbol({ id, className }: { id: PathId; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      {id === 'key' && (
        <g fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="20" cy="32" r="10" />
          <circle cx="20" cy="32" r="3.5" />
          <path d="M30 32h26M48 32v8M54 32v6M42 32v5" strokeLinecap="square" />
        </g>
      )}
      {id === 'mind' && (
        <g fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="10" y="10" width="44" height="44" />
          <rect x="18" y="18" width="28" height="28" transform="rotate(45 32 32)" />
          <rect x="24" y="24" width="16" height="16" />
          <rect x="28.5" y="28.5" width="7" height="7" transform="rotate(45 32 32)" fill="currentColor" />
        </g>
      )}
      {id === 'void' && (
        <g fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="32" cy="32" r="22" strokeDasharray="4 3" />
          <circle cx="32" cy="32" r="12" />
          <path d="M8 56 56 8" />
          <circle cx="41" cy="27" r="1.8" fill="currentColor" stroke="none" />
        </g>
      )}
    </svg>
  );
}
