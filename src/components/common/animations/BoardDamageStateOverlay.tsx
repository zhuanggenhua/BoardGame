import type { CSSProperties } from 'react';

export interface BoardDamageStateOverlayProps {
  damage: number;
  life: number;
  testId?: string;
  showValueBadge?: boolean;
  className?: string;
}

export function BoardDamageStateOverlay({
  damage,
  life,
  testId = 'board-damage-state-overlay',
  showValueBadge = true,
  className = '',
}: BoardDamageStateOverlayProps) {
  if (damage <= 0 || life <= 0) return null;

  const damageRatio = Math.min(1, Math.max(0, damage / life));
  const overlayHeightPct = Math.min(damageRatio * 100, 100);

  const style: CSSProperties = {
    height: `${overlayHeightPct}%`,
    background: `linear-gradient(to top, rgba(220,38,38,${0.25 + damageRatio * 0.45}) 0%, rgba(185,28,28,${0.05 + damageRatio * 0.15}) 100%)`,
    transition: 'height 0.3s ease-out',
  };

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] ${className}`}
      data-testid={testId}
      data-damage={damage}
      data-life={life}
      data-damage-ratio={damageRatio.toFixed(3)}
    >
      <div
        className="absolute inset-x-0 bottom-0 rounded-[inherit]"
        style={style}
      />
      {showValueBadge ? (
        <span
          className="absolute bottom-1 right-1 grid h-5 min-w-5 place-items-center rounded-full border border-red-200/70 bg-red-950/82 px-1 text-[0.68rem] font-black leading-none text-red-50 shadow-[0_0_14px_rgba(127,29,29,0.58)]"
          data-testid={`${testId}-value`}
        >
          {damage}
        </span>
      ) : null}
    </div>
  );
}
