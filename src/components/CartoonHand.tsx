import { useId, type CSSProperties } from 'react';
import handArt from '../assets/hand-clean.png';
import { armAngle, buttonTarget, type Point } from '../data/machine';

/** hand-clean.png: 463×648, the supplied hand with its baked-in tap rings removed. */
const ART = { width: 463, height: 648 } as const;
/** The artwork box extends below the image to carry the sleeve toward the viewer. */
const BOX = { width: 463, height: 1600 } as const;
/** Touch point: the centre of the tap rings in the original hand.png. */
const TOUCH = { x: 65.5, y: 65 } as const;

/** Fingertip position inside the artwork box, as a fraction of it. */
export const FINGERTIP = { x: TOUCH.x / BOX.width, y: TOUCH.y / BOX.height } as const;

/**
 * The image is drawn with the forearm already leaning down-right, so only the
 * difference from the middle button's arm angle is applied as rotation.
 */
const NEUTRAL_ARM = armAngle(buttonTarget('mind'));

interface CartoonHandProps {
  /** Fingertip target as a fraction of the machine photo. */
  tip: Point;
  /** Depth: 1 at the screen, larger when closer to the viewer. */
  scale: number;
  /** Increment to play one press. */
  pressId: number;
}

/**
 * The supplied hand illustration, reaching up to the screen. The wrapper sits on
 * the target point; the inner layer is offset by the fingertip's own position
 * and pivots/scales around it, so the fingertip lands exactly on the target at
 * any size and depth. A shirt cuff and jacket sleeve continue the forearm off
 * the bottom of the frame, toward the viewer.
 */
export function CartoonHand({ tip, scale, pressId }: CartoonHandProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const id = (name: string) => `${uid}-${name}`;
  const position = { left: `${tip.x * 100}%`, top: `${tip.y * 100}%` };
  const style = {
    ...position,
    '--arm': `${armAngle(tip) - NEUTRAL_ARM}deg`,
    '--depth': scale,
    '--tip-x': `${FINGERTIP.x * 100}%`,
    '--tip-y': `${FINGERTIP.y * 100}%`,
  } as CSSProperties;

  return (
    <>
      {pressId > 0 && (
        <span key={pressId} className="tap" style={position}>
          <i />
          <i />
          <i />
        </span>
      )}
      <div className="hand" style={style}>
        <div className="hand__aim">
          <div key={pressId} className={`hand__press${pressId > 0 ? ' is-pressing' : ''}`}>
            <svg className="hand__art" viewBox={`0 0 ${BOX.width} ${BOX.height}`} focusable="false">
              <defs>
                <linearGradient id={id('jacket')} gradientUnits="userSpaceOnUse" x1="243" y1="678" x2="440" y2="575">
                  <stop offset="0" stopColor="#4b4f4a" />
                  <stop offset="0.45" stopColor="#323632" />
                  <stop offset="1" stopColor="#1f2220" />
                </linearGradient>
                <linearGradient id={id('cuff')} gradientUnits="userSpaceOnUse" x1="233" y1="642" x2="416" y2="547">
                  <stop offset="0" stopColor="#f7f3eb" />
                  <stop offset="1" stopColor="#d8d0c1" />
                </linearGradient>
              </defs>

              <image href={handArt} x="0" y="0" width={ART.width} height={ART.height} preserveAspectRatio="none" />

              {/* shirt cuff over the wrist, then the jacket sleeve running toward the viewer */}
              <path d="M233 642 L416 547 L440 593 L257 688 Z" fill={`url(#${id('cuff')})`} stroke="#b3aa99" strokeWidth="1.5" strokeLinejoin="round" />
              <path
                d="M242.5 677.6 L439.7 575.2 L1005.4 1576.8 L737.2 1716 Z"
                fill={`url(#${id('jacket')})`}
                stroke="#141614"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path d="M300 660 C420 900 520 1150 640 1420" fill="none" stroke="#5a5f59" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
              <path d="M392 606 C500 820 640 1080 800 1380" fill="none" stroke="#151715" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />

              <circle className="hand__tip" cx={TOUCH.x} cy={TOUCH.y} r="1" fill="none" />
            </svg>
          </div>
        </div>
      </div>
    </>
  );
}
