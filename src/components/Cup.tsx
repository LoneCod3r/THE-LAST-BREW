import { useEffect, useId, useRef, type CSSProperties } from 'react';
import cupArt from '../assets/cup-hd.png';
import { CUP, CUP_ART, CUP_BASE, CUP_CENTER, CUP_LAYER, PHOTO, SPOUTS, SPOUT_Y } from '../data/machine';

/** Where the cup ends up when it is handed to the viewer, relative to where it stands. */
export interface HandoffTarget {
  /** Translation of the cup's centre, in CSS px. */
  x: number;
  y: number;
  /** Scale about the cup's centre. */
  s: number;
}

/**
 * tray   on the machine;
 * lift   travelling toward the viewer;
 * held   in the foreground, waiting to be picked up (the only interactive stage);
 * picked being lifted away;
 * gone   taken: no longer rendered, so it leaves nothing behind in the layout.
 */
export type CupStage = 'tray' | 'lift' | 'held' | 'picked' | 'gone';

/** Where the sugar cubes land in the cup, relative to its centre (photo px). */
const CUBE_OFFSETS = [-10, 7, -2, 12, -15] as const;
/** A sugar cube's side (photo px); its corner radius and outline scale with it. */
const CUBE = 8;
const CUBE_SCALE = CUBE / 5;

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

interface CupProps {
  sugar: number;
  target: HandoffTarget | null;
  stage: CupStage;
  onPickup?: () => void;
}

/**
 * The cup as its own layer, cut from the photograph. It carries everything that
 * belongs to it (coffee, sugar, the pour, steam and its shadow), so the whole
 * cup can leave the tray while the machine stays still.
 */
export function Cup({ sugar, target, stage, onPickup }: CupProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const ref = (name: string) => `${uid}-${name}`;
  const box = CUP_LAYER;
  const viewBox = `${box.x} ${box.y} ${box.w} ${box.h}`;
  const collectible = stage === 'held';
  const buttonRef = useRef<HTMLButtonElement>(null);

  // When the cup arrives it takes focus, so keyboard users can pick it up straight away.
  useEffect(() => {
    if (collectible) buttonRef.current?.focus({ preventScroll: true });
  }, [collectible]);

  const style = {
    left: pct(box.x, PHOTO.width),
    top: pct(box.y, PHOTO.height),
    width: pct(box.w, PHOTO.width),
    height: pct(box.h, PHOTO.height),
    transformOrigin: `${pct(CUP_CENTER.x - box.x, box.w)} ${pct(CUP_CENTER.y - box.y, box.h)}`,
    ...(target ? { '--hx': `${target.x}px`, '--hy': `${target.y}px`, '--hs': target.s } : {}),
  } as CSSProperties;

  return (
    <div
      className={`vm__cup${target ? ' is-handed' : ''}${stage === 'picked' ? ' is-picked' : ''}`}
      hidden={stage === 'gone'}
      style={style}
      inert={!collectible}
    >
      <svg className="vm__cup-layer" viewBox={viewBox} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <radialGradient id={ref('cast')}>
            <stop offset="0" stopColor="#000" stopOpacity="0.75" />
            <stop offset="0.6" stopColor="#000" stopOpacity="0.35" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse className="vm__cast" cx={CUP_BASE.cx} cy={CUP_BASE.y + 2} rx={CUP_BASE.rx + 8} ry="6" fill={`url(#${ref('cast')})`} />
      </svg>

      <button
        ref={buttonRef}
        type="button"
        className="vm__cup-art"
        aria-label="Pick up your coffee"
        tabIndex={collectible ? 0 : -1}
        onClick={collectible ? onPickup : undefined}
        style={{
          left: pct(CUP_ART.x - box.x, box.w),
          top: pct(CUP_ART.y - box.y, box.h),
          width: pct(CUP_ART.w, box.w),
          height: pct(CUP_ART.h, box.h),
        }}
      >
        <img src={cupArt} alt="" draggable={false} />
      </button>

      <svg className="vm__cup-layer" viewBox={viewBox} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <radialGradient id={ref('inner')} cx="0.5" cy="0.3" r="0.75">
            <stop offset="0" stopColor="#6a110b" />
            <stop offset="0.7" stopColor="#8f1d12" />
            <stop offset="1" stopColor="#b7301f" />
          </radialGradient>
          <radialGradient id={ref('roast')} cx="0.5" cy="0.55" r="0.6">
            <stop offset="0" style={{ stopColor: 'var(--roast)' }} />
            <stop offset="0.82" style={{ stopColor: 'var(--roast)' }} />
            <stop offset="1" stopColor="#b98a58" />
          </radialGradient>
          <filter id={ref('soft')} x="-10%" y="-30%" width="120%" height="160%">
            <feGaussianBlur stdDeviation="0.7" />
          </filter>
        </defs>

        {SPOUTS.map((s) => (
          <g key={s.x1} className="vm__stream">
            <line x1={s.x1} y1={SPOUT_Y} x2={s.x2} y2={CUP.cy} stroke="#3a210f" strokeWidth="2.6" strokeLinecap="round" />
            <line
              className="vm__flow"
              x1={s.x1}
              y1={SPOUT_Y}
              x2={s.x2}
              y2={CUP.cy}
              stroke="#a26c3a"
              strokeWidth="1"
              strokeDasharray="5 6"
            />
          </g>
        ))}

        {Array.from({ length: sugar }, (_, i) => (
          <rect
            key={i}
            className="vm__cube"
            x={CUP.cx + CUBE_OFFSETS[i] - CUBE / 2}
            y={CUP.cy - CUBE}
            width={CUBE}
            height={CUBE}
            rx={1 * CUBE_SCALE}
            fill="#f4efe2"
            stroke="#c9bfa6"
            strokeWidth={0.6 * CUBE_SCALE}
            style={{ animationDelay: `${i * 170}ms` }}
          />
        ))}

        <ellipse
          className="vm__empty"
          cx={CUP.cx}
          cy={CUP.cy}
          rx={CUP.rx}
          ry={CUP.ry}
          fill={`url(#${ref('inner')})`}
          filter={`url(#${ref('soft')})`}
        />
        <ellipse
          className="vm__fill"
          cx={CUP.cx}
          cy={CUP.cy + 0.5}
          rx={CUP.rx - 1.5}
          ry={CUP.ry - 1}
          fill={`url(#${ref('roast')})`}
          filter={`url(#${ref('soft')})`}
        />

        <g className="vm__steam" fill="none" stroke="#f3eee0" strokeWidth="2.2" strokeLinecap="round">
          {[-14, 0, 14].map((dx, i) => (
            <path
              key={dx}
              className="vm__wisp"
              style={{ animationDelay: `${i * 0.7}s` }}
              d={`M${CUP.cx + dx} ${CUP.cy - 14} c-5 -8 5 -13 0 -21 c-5 -8 5 -13 0 -21`}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
