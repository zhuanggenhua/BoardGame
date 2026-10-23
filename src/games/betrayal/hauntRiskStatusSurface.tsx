import React from "react";
import { useTranslation } from "react-i18next";

import { OptimizedImage } from "../../components/common/media/OptimizedImage";
import type {
  BetrayalHauntRiskStatus,
  BetrayalNumberTrackStatus,
} from "./hauntProgress";

type BetrayalHauntRiskSurfaceProps = {
  hauntRisk: BetrayalHauntRiskStatus;
  hauntRiskTrack: BetrayalNumberTrackStatus | null;
  hauntRiskTrackAsset: string;
  locale: string;
};

function resolveHauntRiskCopy(
  hauntRisk: BetrayalHauntRiskStatus,
  t: ReturnType<typeof useTranslation<"game-betrayal">>["t"],
) {
  if (hauntRisk.hauntStarted) {
    return {
      text: t("board.status.hauntRiskStarted"),
      detailText: t("board.status.hauntRiskStartedDetail"),
    };
  }

  if (hauntRisk.nextOmenAutomatic) {
    return {
      text: t("board.status.hauntRiskLastOmenShort", {
        omenCount: hauntRisk.omenCount,
      }),
      detailText: t("board.status.hauntRiskLastOmenDetail", {
        omenCount: hauntRisk.omenCount,
      }),
    };
  }

  return {
    text: t("board.status.hauntRiskShort", {
      omenCount: hauntRisk.omenCount,
    }),
    detailText: t("board.status.hauntRiskRuleDetail", {
      omenCount: hauntRisk.omenCount,
      diceCount: hauntRisk.nextRollDiceCount,
      threshold: hauntRisk.threshold,
    }),
  };
}

export function BetrayalHauntRiskSurface({
  hauntRisk,
  hauntRiskTrack,
  hauntRiskTrackAsset,
  locale,
}: BetrayalHauntRiskSurfaceProps) {
  const { t } = useTranslation("game-betrayal");
  const hauntRiskTrackMin = hauntRiskTrack?.min ?? 0;
  const hauntRiskTrackMax = hauntRiskTrack?.max ?? 9;
  const hauntRiskTrackValue = Math.max(
    hauntRiskTrackMin,
    Math.min(hauntRiskTrackMax, hauntRiskTrack?.value ?? hauntRisk.omenCount),
  );
  const hauntRiskTrackPositionPercent = hauntRiskTrack?.progressPercent ?? 0;
  const hauntRiskTrackSlots = Array.from(
    { length: Math.max(1, hauntRiskTrackMax - hauntRiskTrackMin + 1) },
    (_, index) => hauntRiskTrackMin + index,
  );
  const hauntRiskCopy = resolveHauntRiskCopy(hauntRisk, t);

  return (
    <article
      id="betrayal-haunt-risk-section"
      className="relative ml-auto w-full max-w-[198px] overflow-visible bg-transparent px-0 pb-2 pt-3"
    >
      <div
        data-testid="betrayal-haunt-risk-status"
        data-tutorial-id="betrayal-haunt-risk-status"
        data-haunt-started={hauntRisk.hauntStarted ? "true" : "false"}
        data-omen-count={hauntRisk.omenCount}
        data-next-dice-count={hauntRisk.nextRollDiceCount}
        data-threshold={hauntRisk.threshold}
        data-next-omen-automatic={
          hauntRisk.nextOmenAutomatic ? "true" : "false"
        }
        title={hauntRiskCopy.detailText}
        aria-label={hauntRiskCopy.detailText}
        className="mt-3 rounded-[7px] border border-[rgba(169,42,46,0.42)] bg-[linear-gradient(180deg,rgba(72,20,24,0.44),rgba(18,12,12,0.60))] px-2.5 py-2 shadow-[0_10px_18px_rgba(0,0,0,0.14)]"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-black uppercase tracking-[0.08em] text-[#d99a72]">
            {t("board.status.hauntRiskLabel")}
          </span>
          <span className="rounded-[4px] border border-[rgba(245,211,137,0.20)] bg-[rgba(245,211,137,0.08)] px-1.5 py-0.5 text-[12px] font-bold leading-none text-[#f7df9d]">
            {hauntRisk.hauntStarted
              ? t("board.status.hauntRiskPhaseHaunt")
              : t("board.status.hauntRiskPhasePreHaunt")}
          </span>
        </div>
        <div className="mt-1 text-[12px] font-semibold leading-snug text-[#f4e8c6]">
          {hauntRiskCopy.text}
        </div>
        <div
          data-testid="betrayal-haunt-risk-progress"
          data-number-track-id={hauntRiskTrack?.id ?? "haunt-risk"}
          data-track-min={hauntRiskTrackMin}
          data-track-max={hauntRiskTrackMax}
          data-current-omen-count={hauntRisk.omenCount}
          data-track-value={hauntRiskTrackValue}
          data-progress-percent={hauntRiskTrackPositionPercent}
          data-track-position-percent={hauntRiskTrackPositionPercent}
          data-current-display="material-slot-highlight"
          data-haunt-risk-style="official-asset-track"
          data-haunt-risk-track-shape="material-0-9-bar"
          role="progressbar"
          aria-label={hauntRiskCopy.detailText}
          aria-valuemin={hauntRiskTrackMin}
          aria-valuemax={hauntRiskTrackMax}
          aria-valuenow={hauntRiskTrackValue}
          className="relative mt-2 w-full overflow-visible rounded-[7px]"
        >
          <div
            aria-hidden="true"
            className="relative min-h-[36px] w-full overflow-hidden rounded-[7px] shadow-[0_8px_16px_rgba(0,0,0,0.22)]"
            style={{ aspectRatio: "1794 / 349" }}
          >
            <OptimizedImage
              data-testid="betrayal-haunt-risk-track-image"
              data-haunt-risk-track-image="official-0-9"
              src={hauntRiskTrackAsset}
              locale={locale}
              alt=""
              className="absolute inset-0 h-full w-full object-fill"
              draggable={false}
            />
            <div
              data-haunt-risk-slot-grid="true"
              className="absolute inset-0 grid"
              style={{
                gridTemplateColumns: `repeat(${hauntRiskTrackSlots.length}, minmax(0, 1fr))`,
              }}
            >
              {hauntRiskTrackSlots.map((slot) => {
                const isCurrentSlot = slot === hauntRiskTrackValue;
                return (
                  <span
                    key={`haunt-risk-slot-${slot}`}
                    data-testid="betrayal-haunt-risk-slot"
                    data-haunt-risk-slot={slot}
                    data-haunt-risk-segment="true"
                    data-haunt-risk-current-slot={
                      isCurrentSlot ? "true" : "false"
                    }
                    data-haunt-risk-cell="true"
                    data-haunt-risk-current-cell={
                      isCurrentSlot ? "true" : "false"
                    }
                    className={`min-w-0 rounded-[4px] transition-[background-color,box-shadow] duration-200 ${
                      isCurrentSlot
                        ? "bg-[rgba(103,185,93,0.30)] shadow-[inset_0_0_0_2px_rgba(213,255,153,0.82),0_0_14px_rgba(103,185,93,0.52)]"
                        : "bg-transparent shadow-none"
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

    </article>
  );
}
