import { useEffect, useRef, useState } from 'react';
import { BOARD_H, BOARD_W, CARD_H, CARD_W, type Card } from '../game/engine';

const COLORS = ['#e85d3f', '#3aa17e', '#5aa7e0', '#9b7ede', '#df8a2e'];

function colorOf(ch: string): string {
  let h = 0;
  for (let i = 0; i < ch.length; i++) h = (h * 31 + ch.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

export interface FloatScore {
  id: number;
  x: number;
  y: number;
  text: string;
  combo?: boolean;
}

export default function Board({
  cards,
  exposed,
  leavingIds,
  showPinyin,
  floats,
  onCardTap,
}: {
  cards: Card[];
  exposed: Set<number>;
  leavingIds: Set<number>;
  showPinyin: boolean;
  floats: FloatScore[];
  onCardTap: (c: Card) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const s = Math.min(el.clientWidth / BOARD_W, el.clientHeight / BOARD_H);
      setScale(Math.max(0.3, s));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="relative flex w-full flex-1 items-center justify-center overflow-hidden">
      {/* 牌桌底托 */}
      <div
        className="absolute rounded-[36px] bg-cinnabar/8 shadow-inner"
        style={{ width: BOARD_W * scale + 18, height: BOARD_H * scale + 18 }}
      />
      <div
        style={{
          width: BOARD_W,
          height: BOARD_H,
          transform: `scale(${scale})`,
          transformOrigin: 'center',
          position: 'relative',
        }}
      >
        {cards.map((c) => {
          const isOpen = exposed.has(c.id);
          const leaving = leavingIds.has(c.id);
          const color = colorOf(c.info.char);
          return (
            <button
              key={c.id}
              aria-label={isOpen ? `可读字卡 ${c.info.char}` : '被压住的字卡'}
              onClick={(e) => {
                e.stopPropagation();
                onCardTap(c);
              }}
              className={`absolute flex flex-col items-center justify-center rounded-2xl outline-none ${
                leaving ? 'animate-pop' : c.quiet ? '' : 'animate-dropIn'
              }`}
              style={{
                left: c.x,
                top: c.y,
                width: CARD_W,
                height: CARD_H,
                transform: `translate(-50%, -50%) rotate(${c.rot}deg)`,
                zIndex: c.layer * 100000 + c.id,
                background: isOpen ? 'linear-gradient(160deg,#ffffff,#ffeeba)' : '#c7b48d',
                border: `4px solid ${isOpen ? color : 'rgba(46,42,36,0.16)'}`,
                boxShadow: isOpen
                  ? '0 4px 0 rgba(46,42,36,0.16), 0 9px 16px rgba(46,42,36,0.20)'
                  : 'inset 0 3px 8px rgba(46,42,36,0.38)',
                padding: 0,
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            >
              {!isOpen && <span className="pointer-events-none absolute inset-0 rounded-xl bg-ink/35" />}
              {showPinyin && isOpen && (
                <span
                  className="pointer-events-none font-kid leading-none"
                  style={{ fontSize: 10, letterSpacing: '0.04em', color, marginTop: -2 }}
                >
                  {c.info.spell}
                </span>
              )}
              <span
                className="pointer-events-none font-kai leading-none"
                style={{
                  fontSize: 31,
                  fontWeight: 700,
                  color: isOpen ? '#2e2a24' : 'rgba(46,42,36,0.4)',
                  marginTop: showPinyin && isOpen ? 1 : 0,
                }}
              >
                {c.info.char}
              </span>
              {isOpen && (
                <span className="pointer-events-none absolute bottom-0.5 right-1.5 text-[8px] font-bold text-ink/35">
                  {c.info.strokes}画
                </span>
              )}
            </button>
          );
        })}

        {floats.map((f) => (
          <span
            key={f.id}
            className="pointer-events-none absolute animate-floatUp font-kid"
            style={{
              left: f.x,
              top: f.y,
              transform: 'translate(-50%,-50%)',
              zIndex: 9999,
              fontSize: f.combo ? 26 : 19,
              color: f.combo ? '#3aa17e' : '#e85d3f',
              textShadow: '0 2px 0 #fff, 0 3px 6px rgba(0,0,0,.18)',
            }}
          >
            {f.text}
          </span>
        ))}
      </div>
    </div>
  );
}
