import React from "react";
import { useTranslation } from "react-i18next";

import type { BetrayalHelpingHandsTrollHandAttackOption } from "./hauntAttackRewardReadModel";

export type BetrayalAttackRewardActionVariant = "desktop" | "mobile";

export interface BetrayalAttackRewardCardSummary {
  id: string;
  name: string;
}

export interface BetrayalRewardActionSurfaceProps {
  variant: BetrayalAttackRewardActionVariant;
  damage: number;
  stealableCards: readonly BetrayalAttackRewardCardSummary[];
  onResolveDamage: () => void;
  onStealCard: (cardId: string) => void;
}

export interface BetrayalHelpingHandsTrollAttackActionsSurfaceProps {
  variant: BetrayalAttackRewardActionVariant;
  attackOptions: readonly BetrayalHelpingHandsTrollHandAttackOption[];
  attackTargetsByOptionId: ReadonlyMap<string, { playerId: string }>;
  trollHandIds: readonly string[];
  onAttack: (
    option: BetrayalHelpingHandsTrollHandAttackOption,
    targetPlayerId: string,
  ) => void;
}

function stopIfDesktop(
  event: React.MouseEvent<HTMLButtonElement>,
  variant: BetrayalAttackRewardActionVariant,
) {
  if (variant === "desktop") {
    event.stopPropagation();
  }
}

function resolveRewardPanelClassName(
  variant: BetrayalAttackRewardActionVariant,
) {
  return variant === "desktop"
    ? "pointer-events-auto flex max-w-[760px] flex-wrap items-center justify-center gap-2 rounded-[8px] border border-[rgba(238,204,126,0.34)] bg-[rgba(18,17,13,0.66)] px-3 py-2 shadow-[0_12px_26px_rgba(0,0,0,0.24),0_0_18px_rgba(238,204,126,0.12)]"
    : "mt-2 grid gap-2";
}

function resolveDamageButtonClassName(
  variant: BetrayalAttackRewardActionVariant,
) {
  return variant === "desktop"
    ? "min-h-[46px] rounded-[7px] border border-[#d7c16f] bg-[rgba(215,193,111,0.26)] px-5 py-2 text-[15px] font-black text-[#fff4ba] shadow-[0_0_18px_rgba(215,193,111,0.24)] transition hover:bg-[rgba(215,193,111,0.36)]"
    : "min-h-[44px] flex-1 rounded-[8px] border border-[#d7c16f] bg-[rgba(215,193,111,0.24)] px-2.5 text-[13px] font-black text-[#fff4ba]";
}

function resolveStealButtonClassName(
  variant: BetrayalAttackRewardActionVariant,
) {
  return variant === "desktop"
    ? "min-h-[46px] rounded-[7px] border border-[rgba(159,225,167,0.52)] bg-[rgba(40,63,50,0.38)] px-5 py-2 text-[15px] font-bold text-[#d9ffcf] transition hover:bg-[rgba(48,78,58,0.50)]"
    : "min-h-[44px] flex-1 rounded-[8px] border border-[rgba(159,225,167,0.48)] bg-[rgba(40,63,50,0.38)] px-2.5 text-[13px] font-bold text-[#d9ffcf]";
}

function RewardActionButtons({
  variant,
  damage,
  stealableCards,
  onResolveDamage,
  onStealCard,
  rewardKind,
  damageTestId,
  stealTestIdPrefix,
}: BetrayalRewardActionSurfaceProps & {
  rewardKind: "mummy" | "helpingHands";
  damageTestId: string;
  stealTestIdPrefix: string;
}) {
  const { t } = useTranslation("game-betrayal");
  const damageLabel =
    rewardKind === "mummy"
      ? t("board.status.mummyRewardDamage", { damage })
      : t("board.status.helpingHandsRewardDamage", { damage });
  const buttons = (
    <>
      <button
        type="button"
        onClick={(event) => {
          stopIfDesktop(event, variant);
          onResolveDamage();
        }}
        data-testid={damageTestId}
        className={resolveDamageButtonClassName(variant)}
      >
        {damageLabel}
      </button>
      {stealableCards.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={(event) => {
            stopIfDesktop(event, variant);
            onStealCard(card.id);
          }}
          data-testid={`${stealTestIdPrefix}-${card.id}`}
          className={resolveStealButtonClassName(variant)}
        >
          {rewardKind === "mummy"
            ? t("board.status.mummyRewardSteal", { card: card.name })
            : t("board.status.helpingHandsRewardSteal", { card: card.name })}
        </button>
      ))}
    </>
  );

  if (variant === "desktop") {
    return buttons;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {buttons}
    </div>
  );
}

export function BetrayalMummyRewardActionsSurface({
  variant,
  damage,
  stealableCards,
  onResolveDamage,
  onStealCard,
}: BetrayalRewardActionSurfaceProps) {
  return (
    <div
      data-testid={
        variant === "desktop"
          ? "betrayal-mummy-reward-actions"
          : "betrayal-mobile-mummy-reward-panel"
      }
      data-prompt-actions-for="betrayal-mummy-reward-banner"
      className={resolveRewardPanelClassName(variant)}
    >
      <RewardActionButtons
        variant={variant}
        damage={damage}
        stealableCards={stealableCards}
        onResolveDamage={onResolveDamage}
        onStealCard={onStealCard}
        rewardKind="mummy"
        damageTestId={
          variant === "desktop"
            ? "betrayal-mummy-reward-damage"
            : "betrayal-mobile-mummy-reward-damage"
        }
        stealTestIdPrefix={
          variant === "desktop"
            ? "betrayal-mummy-reward-steal"
            : "betrayal-mobile-mummy-reward-steal"
        }
      />
    </div>
  );
}

export function BetrayalHelpingHandsRewardActionsSurface({
  variant,
  damage,
  stealableCards,
  onResolveDamage,
  onStealCard,
}: BetrayalRewardActionSurfaceProps) {
  return (
    <div
      data-testid={
        variant === "desktop"
          ? "betrayal-helping-hands-reward-actions"
          : "betrayal-mobile-helping-hands-reward-panel"
      }
      data-prompt-actions-for="betrayal-helping-hands-reward-banner"
      className={resolveRewardPanelClassName(variant)}
    >
      <RewardActionButtons
        variant={variant}
        damage={damage}
        stealableCards={stealableCards}
        onResolveDamage={onResolveDamage}
        onStealCard={onStealCard}
        rewardKind="helpingHands"
        damageTestId={
          variant === "desktop"
            ? "betrayal-helping-hands-reward-damage"
            : "betrayal-mobile-helping-hands-reward-damage"
        }
        stealTestIdPrefix={
          variant === "desktop"
            ? "betrayal-helping-hands-reward-steal"
            : "betrayal-mobile-helping-hands-reward-steal"
        }
      />
    </div>
  );
}

export function BetrayalHelpingHandsTrollAttackActionsSurface({
  variant,
  attackOptions,
  attackTargetsByOptionId,
  trollHandIds,
  onAttack,
}: BetrayalHelpingHandsTrollAttackActionsSurfaceProps) {
  const { t } = useTranslation("game-betrayal");

  return (
    <div
      data-testid={
        variant === "desktop"
          ? "betrayal-helping-hands-troll-attack-actions"
          : "betrayal-mobile-helping-hands-troll-attack-actions"
      }
      data-prompt-actions-for={
        variant === "desktop"
          ? "betrayal-helping-hands-troll-attack-banner"
          : undefined
      }
      className={
        variant === "desktop"
          ? "pointer-events-auto flex max-w-[560px] flex-wrap items-center justify-center gap-2 rounded-[8px] border border-[rgba(159,225,167,0.34)] bg-[rgba(10,18,14,0.62)] px-3 py-2 shadow-[0_12px_26px_rgba(0,0,0,0.24),0_0_18px_rgba(159,225,167,0.12)]"
          : "mt-2 grid w-full grid-cols-1 gap-2"
      }
    >
      {attackOptions.map((option) => {
        const target = attackTargetsByOptionId.get(option.id);
        if (!target) {
          return null;
        }
        const singleAttackIndex = option.combined
          ? 0
          : trollHandIds.indexOf(option.trollHandIds[0] ?? "") + 1;
        const buttonTestId =
          variant === "desktop"
            ? option.combined
              ? "betrayal-helping-hands-troll-combined"
              : `betrayal-helping-hands-troll-single-${option.trollHandIds[0] ?? "unknown"}`
            : option.combined
              ? "betrayal-mobile-helping-hands-troll-combined"
              : `betrayal-mobile-helping-hands-troll-single-${option.trollHandIds[0] ?? "unknown"}`;

        return (
          <button
            key={option.id}
            type="button"
            onClick={(event) => {
              stopIfDesktop(event, variant);
              onAttack(option, target.playerId);
            }}
            data-testid={buttonTestId}
            className={
              variant === "desktop"
                ? "min-h-[46px] rounded-[7px] border border-[rgba(159,225,167,0.60)] bg-[rgba(40,78,58,0.40)] px-5 py-2 text-[15px] font-black text-[#e5ffd8] shadow-[0_0_18px_rgba(159,225,167,0.18)] transition hover:bg-[rgba(48,88,66,0.52)]"
                : "min-h-[44px] w-full rounded-[9px] border border-[rgba(159,225,167,0.48)] bg-[rgba(40,63,50,0.36)] px-3 text-[13px] font-black tracking-[0.06em] text-[#d9ffcf]"
            }
          >
            {option.combined
              ? t("board.status.helpingHandsTrollCombinedAttack")
              : singleAttackIndex > 0
                ? t("board.status.helpingHandsTrollSingleAttackWithIndex", {
                    index: singleAttackIndex,
                  })
                : t("board.status.helpingHandsTrollSingleAttack")}
          </button>
        );
      })}
    </div>
  );
}
