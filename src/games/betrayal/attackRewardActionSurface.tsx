import React from "react";
import { useTranslation } from "react-i18next";

import type { BetrayalHelpingHandsTrollHandAttackOption } from "./hauntAttackRewardReadModel";

export interface BetrayalAttackRewardCardSummary {
  id: string;
  name: string;
}

export interface BetrayalRewardActionSurfaceProps {
  damage: number;
  stealableCards: readonly BetrayalAttackRewardCardSummary[];
  defenderName?: string | null;
  onResolveDamage: () => void;
  onStealCard: (cardId: string) => void;
}

export interface BetrayalHelpingHandsTrollAttackActionsSurfaceProps {
  attackOptions: readonly BetrayalHelpingHandsTrollHandAttackOption[];
  attackTargetsByOptionId: ReadonlyMap<string, { playerId: string }>;
  trollHandIds: readonly string[];
  onAttack: (
    option: BetrayalHelpingHandsTrollHandAttackOption,
    targetPlayerId: string,
  ) => void;
}

function stopEventPropagation(event: React.MouseEvent<HTMLButtonElement>) {
  event.stopPropagation();
}

function resolveRewardPanelClassName() {
  return "pointer-events-auto flex max-w-[760px] flex-wrap items-center justify-center gap-2 rounded-[8px] border border-[rgba(238,204,126,0.34)] bg-[rgba(18,17,13,0.66)] px-3 py-2 shadow-[0_12px_26px_rgba(0,0,0,0.24),0_0_18px_rgba(238,204,126,0.12)]";
}

function resolveDamageButtonClassName() {
  return "min-h-[46px] rounded-[7px] border border-[#d7c16f] bg-[rgba(215,193,111,0.26)] px-5 py-2 text-[15px] font-black text-[#fff4ba] shadow-[0_0_18px_rgba(215,193,111,0.24)] transition hover:bg-[rgba(215,193,111,0.36)]";
}

function resolveStealButtonClassName() {
  return "min-h-[46px] rounded-[7px] border border-[rgba(159,225,167,0.52)] bg-[rgba(40,63,50,0.38)] px-5 py-2 text-[15px] font-bold text-[#d9ffcf] transition hover:bg-[rgba(48,78,58,0.50)]";
}

function RewardActionButtons({
  damage,
  stealableCards,
  defenderName,
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
      {rewardKind === "mummy" && defenderName ? (
        <span
          data-testid="betrayal-mummy-reward-defender-holdings"
          className="basis-full text-center text-[12px] font-semibold tracking-[0.04em] text-[#f1ddb0]"
        >
          {t("board.status.mummyRewardDefenderHoldings", { player: defenderName })}
        </span>
      ) : null}
      <button
        type="button"
        onClick={(event) => {
          stopEventPropagation(event);
          onResolveDamage();
        }}
        data-testid={damageTestId}
        className={resolveDamageButtonClassName()}
      >
        {damageLabel}
      </button>
      {stealableCards.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={(event) => {
            stopEventPropagation(event);
            onStealCard(card.id);
          }}
          data-testid={`${stealTestIdPrefix}-${card.id}`}
          className={resolveStealButtonClassName()}
        >
          {rewardKind === "mummy"
            ? t("board.status.mummyRewardSteal", { card: card.name })
            : t("board.status.helpingHandsRewardSteal", { card: card.name })}
        </button>
      ))}
    </>
  );

  return buttons;
}

export function BetrayalMummyRewardActionsSurface({
  damage,
  stealableCards,
  defenderName,
  onResolveDamage,
  onStealCard,
}: BetrayalRewardActionSurfaceProps) {
  return (
    <div
      data-testid={
        "betrayal-mummy-reward-actions"
      }
      data-prompt-actions-for="betrayal-mummy-reward-banner"
      className={resolveRewardPanelClassName()}
    >
      <RewardActionButtons
        damage={damage}
        stealableCards={stealableCards}
        defenderName={defenderName}
        onResolveDamage={onResolveDamage}
        onStealCard={onStealCard}
        rewardKind="mummy"
        damageTestId="betrayal-mummy-reward-damage"
        stealTestIdPrefix="betrayal-mummy-reward-steal"
      />
    </div>
  );
}

export function BetrayalHelpingHandsRewardActionsSurface({
  damage,
  stealableCards,
  onResolveDamage,
  onStealCard,
}: BetrayalRewardActionSurfaceProps) {
  return (
    <div
      data-testid={
        "betrayal-helping-hands-reward-actions"
      }
      data-prompt-actions-for="betrayal-helping-hands-reward-banner"
      className={resolveRewardPanelClassName()}
    >
      <RewardActionButtons
        damage={damage}
        stealableCards={stealableCards}
        onResolveDamage={onResolveDamage}
        onStealCard={onStealCard}
        rewardKind="helpingHands"
        damageTestId="betrayal-helping-hands-reward-damage"
        stealTestIdPrefix="betrayal-helping-hands-reward-steal"
      />
    </div>
  );
}

export function BetrayalHelpingHandsTrollAttackActionsSurface({
  attackOptions,
  attackTargetsByOptionId,
  trollHandIds,
  onAttack,
}: BetrayalHelpingHandsTrollAttackActionsSurfaceProps) {
  const { t } = useTranslation("game-betrayal");

  return (
    <div
      data-testid={
        "betrayal-helping-hands-troll-attack-actions"
      }
      data-prompt-actions-for="betrayal-helping-hands-troll-attack-banner"
      className="pointer-events-auto flex max-w-[560px] flex-wrap items-center justify-center gap-2 rounded-[8px] border border-[rgba(159,225,167,0.34)] bg-[rgba(10,18,14,0.62)] px-3 py-2 shadow-[0_12px_26px_rgba(0,0,0,0.24),0_0_18px_rgba(159,225,167,0.12)]"
    >
      {attackOptions.map((option) => {
        const target = attackTargetsByOptionId.get(option.id);
        if (!target) {
          return null;
        }
        const singleAttackIndex = option.combined
          ? 0
          : trollHandIds.indexOf(option.trollHandIds[0] ?? "") + 1;
        const buttonTestId = option.combined
          ? "betrayal-helping-hands-troll-combined"
          : `betrayal-helping-hands-troll-single-${option.trollHandIds[0] ?? "unknown"}`;

        return (
          <button
            key={option.id}
            type="button"
            onClick={(event) => {
              stopEventPropagation(event);
              onAttack(option, target.playerId);
            }}
            data-testid={buttonTestId}
            className="min-h-[46px] rounded-[7px] border border-[rgba(159,225,167,0.60)] bg-[rgba(40,78,58,0.40)] px-5 py-2 text-[15px] font-black text-[#e5ffd8] shadow-[0_0_18px_rgba(159,225,167,0.18)] transition hover:bg-[rgba(48,88,66,0.52)]"
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
