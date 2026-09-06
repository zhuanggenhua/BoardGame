import React from "react";
import { useTranslation } from "react-i18next";

import type { BetrayalRecentRollState } from "./game";
import type { RecentRollRerollSelection } from "./houseDiceSurface";
import { RecentRollPanel, StandardRecentRollOverlay } from "./recentRollSurface";

type BetrayalRecentRollReviewSurfaceProps = {
  roll: BetrayalRecentRollState | null;
  visible: boolean;
  isExorciseRollReview: boolean;
  isEndgameExorciseRollReview: boolean;
  isPhoneLandscapeLayout: boolean;
  canDismissByBackdrop: boolean;
  effectiveLocale: string;
  rerollSelection: RecentRollRerollSelection | null;
  actionSlot: React.ReactNode;
  actorLabel: string;
  onDismiss: () => void;
  onConfirmExorciseRollReview: () => void;
  onDiceSettledChange: (rollId: string, settled: boolean) => void;
};

export function BetrayalRecentRollReviewSurface({
  roll,
  visible,
  isExorciseRollReview,
  isEndgameExorciseRollReview,
  isPhoneLandscapeLayout,
  canDismissByBackdrop,
  effectiveLocale,
  rerollSelection,
  actionSlot,
  actorLabel,
  onDismiss,
  onConfirmExorciseRollReview,
  onDiceSettledChange,
}: BetrayalRecentRollReviewSurfaceProps) {
  const { t } = useTranslation("game-betrayal");

  if (!visible || !roll) {
    return null;
  }

  if (!isExorciseRollReview && roll.kind !== "attackRoll") {
    return (
      <StandardRecentRollOverlay
        roll={roll}
        isPhoneLandscapeLayout={isPhoneLandscapeLayout}
        canDismissByBackdrop={canDismissByBackdrop}
        onDismiss={onDismiss}
        effectiveLocale={effectiveLocale}
        rerollSelection={rerollSelection}
        actionSlot={actionSlot}
        actorLabel={actorLabel}
      />
    );
  }

  return (
    <div
      data-testid="betrayal-roll-review-backdrop"
      data-backdrop-dismiss={canDismissByBackdrop ? "enabled" : "disabled"}
      className={`absolute inset-0 z-50 flex items-center justify-center px-4 py-12 ${
        isPhoneLandscapeLayout ? "bg-[rgba(3,7,6,0.92)]" : ""
      } pointer-events-auto`}
      onClick={
        canDismissByBackdrop
          ? isExorciseRollReview
            ? onConfirmExorciseRollReview
            : onDismiss
          : undefined
      }
    >
      <div
        data-testid={
          isExorciseRollReview
            ? "betrayal-exorcise-roll-review"
            : "betrayal-attack-roll-review"
        }
        data-tutorial-id={
          isExorciseRollReview
            ? "betrayal-exorcise-roll-review"
            : "betrayal-attack-roll-review"
        }
        className="pointer-events-auto flex w-[min(640px,calc(100vw-2rem))] flex-col items-center gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        <RecentRollPanel
          roll={roll}
          className={
            isPhoneLandscapeLayout
              ? "h-[min(72vh,320px)] min-h-[286px] w-full rounded-[18px] border border-[rgba(211,179,109,0.30)] bg-[rgba(8,12,10,0.34)] p-2 shadow-[0_16px_34px_rgba(0,0,0,0.24)]"
              : "h-[min(42vh,360px)] min-h-[300px] w-[min(560px,calc(100vw-2rem))] rounded-[18px] border border-[rgba(211,179,109,0.40)] bg-[rgba(15,24,19,0.54)] p-3 shadow-[0_16px_34px_rgba(0,0,0,0.30)]"
          }
          diceClassName={isPhoneLandscapeLayout ? "min-h-[204px]" : "min-h-[190px]"}
          effectiveLocale={effectiveLocale}
          actorLabel={actorLabel}
          openTable
          compactResult
          resultStageClassName="w-full max-w-[520px] justify-self-center"
          compactRowsClassName="grid-rows-[minmax(150px,1fr)_auto]"
          actionSlot={
            isEndgameExorciseRollReview ? (
              <button
                type="button"
                data-testid="betrayal-exorcise-roll-continue"
                className="inline-flex min-h-[42px] min-w-[168px] items-center justify-center border border-[#d6b56d] bg-[#d6b56d] px-5 py-2 text-[14px] font-bold tracking-[0.12em] text-[#19140d] shadow-[0_10px_22px_rgba(0,0,0,0.34)] transition hover:bg-[#f0d28a]"
                onClick={onConfirmExorciseRollReview}
              >
                {t("board.endgame.enterEndgame")}
              </button>
            ) : (
              actionSlot ?? (
                <button
                  type="button"
                  data-testid="betrayal-roll-continue"
                  className="inline-flex min-h-[42px] min-w-[168px] items-center justify-center border border-[#d6b56d] bg-[#d6b56d] px-5 py-2 text-[14px] font-bold tracking-[0.12em] text-[#19140d] shadow-[0_10px_22px_rgba(0,0,0,0.34)] transition hover:bg-[#f0d28a]"
                  onClick={onDismiss}
                >
                  {t("board.roll.backToBoard")}
                </button>
              )
            )
          }
          onDiceSettledChange={onDiceSettledChange}
        />
      </div>
    </div>
  );
}
