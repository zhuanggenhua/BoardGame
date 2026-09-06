import React from "react";
import { useTranslation } from "react-i18next";

import { OptimizedImage } from "../../components/common/media/OptimizedImage";
import { ResourceTraySkeleton } from "../../components/game/framework";
import type { BetrayalDeckKind } from "./game";
import type { DeckTrayItem } from "./deckPresentation";
import type {
  BetrayalHauntRiskStatus,
  BetrayalNumberTrackStatus,
} from "./hauntProgress";

type BetrayalDeckStatusRailSurfaceProps = {
  deckItems: DeckTrayItem[];
  discardItems: DeckTrayItem[];
  hauntRisk: BetrayalHauntRiskStatus;
  hauntRiskTrack: BetrayalNumberTrackStatus | null;
  highlightedDeckKind?: BetrayalDeckKind | null;
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

export function BetrayalDeckStatusRailSurface({
  deckItems,
  discardItems,
  hauntRisk,
  hauntRiskTrack,
  highlightedDeckKind,
  hauntRiskTrackAsset,
  locale,
}: BetrayalDeckStatusRailSurfaceProps) {
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
      id="betrayal-decks-section"
      className="relative ml-auto w-full max-w-[198px] overflow-visible bg-transparent px-0 pb-2 pt-3"
    >
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(196,162,101,0.32))]" />
        <div className="text-[11px] uppercase tracking-[0.24em] text-[#c4a265]">
          {t("board.sections.decks")}
        </div>
        <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(196,162,101,0.32),transparent)]" />
      </div>
      <ResourceTraySkeleton
        items={deckItems}
        canInteract={false}
        layout="column"
        className="mt-3 grid grid-cols-3 gap-2.5"
        renderItem={(item) => {
          const isHighlighted = item.id === `deck-${highlightedDeckKind}`;
          const deckTiltClass =
            item.kind === "omen"
              ? "-rotate-[1.25deg]"
              : item.kind === "item"
                ? "rotate-[0.85deg]"
                : "-rotate-[0.55deg]";
          return (
            <div className="relative pt-2 text-center">
              <span className="pointer-events-none absolute left-1/2 top-[10px] h-[122px] w-[70%] -translate-x-1/2 translate-x-[2px] bg-[rgba(12,10,8,0.18)]" />
              <span className="pointer-events-none absolute left-1/2 top-[6px] h-[122px] w-[70%] -translate-x-1/2 -translate-x-[2px] bg-[rgba(18,14,11,0.16)]" />
              <div
                className={`relative overflow-hidden bg-[rgba(28,20,15,0.34)] shadow-[0_10px_18px_rgba(0,0,0,0.16)] ${deckTiltClass} ${
                  isHighlighted
                    ? "shadow-[0_0_0_1px_rgba(210,171,97,0.38),0_10px_20px_rgba(0,0,0,0.2)]"
                    : ""
                }`}
              >
                <OptimizedImage
                  src={item.asset}
                  locale={locale}
                  alt={item.label}
                  className="h-[124px] w-full object-cover"
                  draggable={false}
                />
                <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,0.9))] px-2 py-2">
                  <div className="truncate text-[8px] uppercase tracking-[0.12em] text-[#d8c596]">
                    {item.label}
                  </div>
                </div>
              </div>
              <div
                data-resource-count-shape="square"
                className="-mt-2.5 inline-flex h-9 min-w-9 items-center justify-center rounded-[6px] border border-[#6f5933] bg-[radial-gradient(circle_at_35%_25%,rgba(229,210,174,0.14),rgba(21,18,14,0.92))] px-2 text-[20px] font-semibold text-[#e3d2ae] shadow-[0_6px_12px_rgba(0,0,0,0.16)]"
              >
                {item.count}
              </div>
            </div>
          );
        }}
      />

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

      <div className="mt-5 flex items-center gap-2">
        <div className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(196,162,101,0.24))]" />
        <div className="text-[11px] uppercase tracking-[0.24em] text-[#c4a265]">
          {t("board.sections.discard")}
        </div>
        <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(196,162,101,0.24),transparent)]" />
      </div>
      <ResourceTraySkeleton
        items={discardItems}
        canInteract={false}
        layout="column"
        className="mt-3 grid grid-cols-3 gap-2.5"
        renderItem={(item) => (
          <div className="relative pt-1 text-center">
            <span className="pointer-events-none absolute left-1/2 top-[8px] h-[94px] w-[70%] -translate-x-1/2 translate-x-[2px] bg-[rgba(16,13,11,0.12)]" />
            <div
              className="relative overflow-hidden bg-[rgba(31,23,18,0.28)] shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
              title={
                item.count > 0
                  ? t("board.decks.faceUp")
                  : t("board.decks.emptySlot")
              }
            >
              <OptimizedImage
                src={item.asset}
                locale={locale}
                alt={item.label}
                className={`h-[96px] w-full object-cover ${item.count === 0 ? "grayscale opacity-22" : "opacity-38"}`}
                draggable={false}
              />
            </div>
            <div className="mt-1 text-[10px] text-[#c5b693]">
              {item.count}
            </div>
          </div>
        )}
      />
    </article>
  );
}
