import type { BetrayalAttackLineOfSightSegment } from "./attackLineOfSightPresentation";

export function BetrayalAttackLineOfSightOverlay({
  segments,
  width,
  height,
}: {
  segments: readonly BetrayalAttackLineOfSightSegment[];
  width: number;
  height: number;
}) {
  if (segments.length === 0) {
    return null;
  }

  return (
    <svg
      data-testid="betrayal-line-of-sight-overlay"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-visible"
      style={{
        width,
        height,
        zIndex: 42,
      }}
      viewBox={`0 0 ${width} ${height}`}
    >
      {segments.map((segment) => (
        <g
          key={`${segment.sourceRoomId}-${segment.targetRoomId}-${segment.targetPlayerId}`}
          data-testid={`betrayal-line-of-sight-line-${segment.sourceRoomId}-${segment.targetRoomId}-${segment.targetPlayerId}`}
          data-line-of-sight-source-room={segment.sourceRoomId}
          data-line-of-sight-target-room={segment.targetRoomId}
          data-line-of-sight-target-player={segment.targetPlayerId}
          data-line-of-sight-source-monster={segment.sourceMonsterId}
          data-line-of-sight-kind={segment.kind}
          data-line-of-sight-weapon={segment.weaponCardId}
        >
          <line
            x1={segment.x1}
            y1={segment.y1}
            x2={segment.x2}
            y2={segment.y2}
            stroke="rgba(8, 12, 8, 0.72)"
            strokeWidth={10}
            strokeLinecap="round"
          />
          <line
            x1={segment.x1}
            y1={segment.y1}
            x2={segment.x2}
            y2={segment.y2}
            stroke="rgba(238, 244, 168, 0.86)"
            strokeWidth={6}
            strokeDasharray="12 8"
            strokeLinecap="round"
          />
          <circle
            cx={segment.x2}
            cy={segment.y2}
            r={9}
            fill="rgba(238, 244, 168, 0.18)"
            stroke="rgba(238, 244, 168, 0.68)"
            strokeWidth={2}
          />
        </g>
      ))}
    </svg>
  );
}
