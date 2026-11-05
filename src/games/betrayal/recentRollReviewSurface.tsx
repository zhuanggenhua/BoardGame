import React from "react";
import { useTranslation } from "react-i18next";

import type { BetrayalRecentRollState } from "./game";
import type { RecentRollRerollSelection } from "./houseDiceSurface";
import { BetrayalConfirmButton } from "./confirmButtonSurface";
import { RecentRollPanel, StandardRecentRollOverlay } from "./recentRollSurface";

type BetrayalRecentRollReviewSurfaceProps = {
  roll: BetrayalRecentRollState | null;
  visible: boolean;
  isExorciseRollReview: boolean;
  isEndgameExorciseRollReview: boolean;
  canDismissByBackdrop: boolean;
  effectiveLocale: string;
  rerollSelection: RecentRollRerollSelection | null;
  actionSlot: React.ReactNode;
  actorLabel: string;
  onDismiss: () => void;
  onConfirmExorciseRollReview: () => void;
  onDiceSettledChange: (rollId: string, settled: boolean) => void;
  resultReadable?: boolean;
};

export function BetrayalRecentRollReviewSurface({
  roll,
  visible,
  isExorciseRollReview,
  isEndgameExorciseRollReview,
  canDismissByBackdrop,
  effectiveLocale,
  rerollSelection,
  actionSlot,
  actorLabel,
  onDismiss,
  onConfirmExorciseRollReview,
  onDiceSettledChange,
  resultReadable = true,
}: BetrayalRecentRollReviewSurfaceProps) {
  const { t } = useTranslation("game-betrayal");

  if (!visible || !roll) {
    return null;
  }

  if (!isExorciseRollReview && roll.kind !== "attackRoll") {
    return (
      <StandardRecentRollOverlay
        roll={roll}
        canDismissByBackdrop={canDismissByBackdrop}
        onDismiss={onDismiss}
        effectiveLocale={effectiveLocale}
        rerollSelection={rerollSelection}
        actionSlot={actionSlot}
        actorLabel={actorLabel}
        onDiceSettledChange={onDiceSettledChange}
        resultReadable={resultReadable}
      />
    );
  }

  return (
    <div
      data-testid="betrayal-roll-review-backdrop"
      data-backdrop-dismiss={canDismissByBackdrop ? "enabled" : "disabled"}
      className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center px-4 py-12"
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
        className="pointer-events-auto flex w-[640px] flex-col items-center gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        <RecentRollPanel
          roll={roll}
          className="h-[360px] min-h-[300px] w-[560px] rounded-[18px] border border-[rgba(211,179,109,0.40)] bg-[rgba(15,24,19,0.54)] p-3 shadow-[0_16px_34px_rgba(0,0,0,0.30)]"
          diceClassName="min-h-[190px]"
          effectiveLocale={effectiveLocale}
          actorLabel={actorLabel}
          openTable
          compactResult
          resultStageClassName="w-full max-w-[520px] justify-self-center"
          compactRowsClassName="grid-rows-[minmax(150px,1fr)_auto]"
          actionSlot={
            isEndgameExorciseRollReview ? (
              <BetrayalConfirmButton
                type="button"
                data-testid="betrayal-exorcise-roll-continue"
                className="min-w-[168px] shadow-[0_10px_22px_rgba(0,0,0,0.34)]"
                onClick={onConfirmExorciseRollReview}
              >
                {t("board.endgame.enterEndgame")}
              </BetrayalConfirmButton>
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
          resultReadable={resultReadable}
        />
      </div>
    </div>
  );
}
