import React from "react";
import { Handshake, Skull } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface BetrayalTopPromptDustProgressItem {
  id: string;
  label: string;
  value: string;
}

export interface BetrayalTopPromptRewardSummary {
  isChooser: boolean;
  chooserTargetName: string;
  waitingPlayerName: string;
  damage: number;
  unavailableStealTargetCount?: number;
}

export interface BetrayalTopPromptMonsterTurnSummary {
  active: boolean;
  controllerName: string;
}

export interface BetrayalTopPromptStackSurfaceProps {
  enabled: boolean;
  dustProgressItems: readonly BetrayalTopPromptDustProgressItem[];
  showDustProgress: boolean;
  dustProgressDimmed: boolean;
  activeHauntCaseLabel: string;
  activeHauntTitle: string;
  showTradeFlowPrompt: boolean;
  tradeAgreementState: string;
  tradeBannerStatusText: string;
  mummyReward: BetrayalTopPromptRewardSummary | null;
  helpingHandsReward: BetrayalTopPromptRewardSummary | null;
  helpingHandsMonsterTurnStatus: BetrayalTopPromptMonsterTurnSummary | null;
  showHelpingHandsTrollAttack: boolean;
  helpingHandsTrollAttackTargetName: string;
}

function resolveStackClassName() {
  return "pointer-events-none absolute inset-x-0 top-[84px] z-[58] flex flex-col items-center gap-2 px-4";
}

function resolveDustProgressClassName(
  dimmed: boolean,
) {
  return `pointer-events-none flex min-h-[70px] w-[960px] flex-wrap items-center justify-center gap-2.5 rounded-[12px] border border-[rgba(211,179,109,0.42)] bg-[rgba(10,13,10,0.82)] px-5 py-3 text-[16px] font-bold tracking-[0.05em] text-[#e6d8a8] shadow-[0_20px_42px_rgba(0,0,0,0.36),0_0_34px_rgba(211,179,109,0.18)] backdrop-blur-sm ${dimmed ? "opacity-[0.72]" : ""}`;
}

function resolveRewardBannerClassName() {
  return "pointer-events-none flex min-h-[78px] w-[960px] flex-wrap items-center justify-center gap-3.5 rounded-[12px] border border-[rgba(238,204,126,0.56)] bg-[rgba(18,17,13,0.90)] px-6 py-4 text-[17px] font-bold tracking-[0.05em] text-[#f3e0a6] shadow-[0_22px_46px_rgba(0,0,0,0.40),0_0_34px_rgba(238,204,126,0.24)] backdrop-blur-sm";
}

function resolveRewardTextShadow() {
  return "0 1px 2px rgba(0,0,0,0.85), 0 0 14px rgba(238,204,126,0.38)";
}

function resolveMonsterTurnClassName() {
  return "pointer-events-none inline-flex min-h-[66px] w-[860px] items-center justify-center gap-3 rounded-[12px] border border-[rgba(159,225,167,0.38)] bg-[rgba(10,18,14,0.82)] px-5 py-3 text-[16px] font-bold tracking-[0.05em] text-[#d9ffcf] shadow-[0_20px_42px_rgba(0,0,0,0.36),0_0_30px_rgba(159,225,167,0.18)] backdrop-blur-sm";
}

function resolveTrollAttackClassName() {
  return "pointer-events-none flex min-h-[76px] w-[940px] flex-wrap items-center justify-center gap-3.5 rounded-[12px] border border-[rgba(159,225,167,0.52)] bg-[rgba(10,18,14,0.86)] px-6 py-4 text-[17px] font-bold tracking-[0.05em] text-[#d9ffcf] shadow-[0_22px_46px_rgba(0,0,0,0.38),0_0_32px_rgba(159,225,167,0.22)] backdrop-blur-sm";
}

function TradeFlowBanner({
  tradeAgreementState,
  tradeBannerStatusText,
}: {
  tradeAgreementState: string;
  tradeBannerStatusText: string;
}) {
  return (
    <div
      data-testid="betrayal-trade-flow-banner"
      data-trade-agreement-state={tradeAgreementState}
      data-trade-summary-role="status-summary"
      data-trade-progress-visible="status-only"
      data-prompt-placement="top"
      className="pointer-events-none inline-flex min-h-[30px] max-w-full items-center justify-center gap-1.5 rounded-[5px] border border-[rgba(238,204,126,0.22)] bg-[rgba(18,17,13,0.52)] px-3 py-1 text-center text-[12px] font-semibold tracking-[0.02em] text-[#f3e0a6] shadow-[0_6px_14px_rgba(0,0,0,0.22)] backdrop-blur-sm"
      style={{
        border: "1px solid rgba(238,204,126,0.22)",
        boxShadow: "0 6px 14px rgba(0,0,0,0.22)",
        textShadow: "0 1px 2px rgba(0,0,0,0.78)",
      }}
    >
      <Handshake size={14} strokeWidth={2.3} />
      <span
        data-testid="betrayal-trade-banner-status"
        className={`min-w-0 truncate leading-snug ${
          "max-w-[460px]"
        }`}
      >
        {tradeBannerStatusText}
      </span>
    </div>
  );
}

function RewardBanner({
  kind,
  reward,
}: {
  kind: "mummy" | "helpingHands";
  reward: BetrayalTopPromptRewardSummary;
}) {
  const { t } = useTranslation("game-betrayal");
  const isMummy = kind === "mummy";
  const titleKey = isMummy
    ? "board.status.mummyRewardTitle"
    : "board.status.helpingHandsRewardTitle";
  const chooserKey = isMummy
    ? "board.status.mummyRewardChoose"
    : "board.status.helpingHandsRewardChoose";
  const waitingKey = isMummy
    ? "board.status.mummyRewardWaiting"
    : "board.status.helpingHandsRewardWaiting";

  return (
    <div
      data-testid={
        isMummy
          ? "betrayal-mummy-reward-banner"
          : "betrayal-helping-hands-reward-banner"
      }
      data-mummy-reward-state={
        isMummy ? (reward.isChooser ? "choose" : "waiting") : undefined
      }
      data-helping-hands-reward-state={
        !isMummy ? (reward.isChooser ? "choose" : "waiting") : undefined
      }
      data-prompt-placement="top"
      className={resolveRewardBannerClassName()}
      style={{
        textShadow: resolveRewardTextShadow(),
      }}
    >
      <Skull size={24} strokeWidth={2.4} />
      <span className="text-[22px] text-[#fff1b8]">
        {t(titleKey)}
      </span>
      <span
        data-testid={
          isMummy
            ? "betrayal-mummy-reward-step"
            : "betrayal-helping-hands-reward-step"
        }
        className="text-[17px] text-[#e3d2a1]"
      >
        {reward.isChooser
          ? t(chooserKey, {
              player: reward.chooserTargetName,
              damage: reward.damage,
            })
          : t(waitingKey, {
              player: reward.waitingPlayerName,
            })}
      </span>
      {isMummy && reward.unavailableStealTargetCount ? (
        <span
          data-testid="betrayal-mummy-reward-invalid-targets"
          className="rounded-full border border-[rgba(245,155,92,0.44)] bg-[rgba(92,42,24,0.44)] px-3 py-1.5 text-[13px] font-bold text-[#ffd0a6]"
        >
          {t("board.status.mummyRewardInvalidTargets", {
            count: reward.unavailableStealTargetCount,
          })}
        </span>
      ) : null}
    </div>
  );
}

export function BetrayalTopPromptStackSurface({
  enabled,
  dustProgressItems,
  showDustProgress,
  dustProgressDimmed,
  activeHauntCaseLabel,
  activeHauntTitle,
  showTradeFlowPrompt,
  tradeAgreementState,
  tradeBannerStatusText,
  mummyReward,
  helpingHandsReward,
  helpingHandsMonsterTurnStatus,
  showHelpingHandsTrollAttack,
  helpingHandsTrollAttackTargetName,
}: BetrayalTopPromptStackSurfaceProps) {
  const { t } = useTranslation("game-betrayal");

  if (!enabled) {
    return null;
  }

  return (
    <div
      data-testid="betrayal-top-prompt-stack"
      data-prompt-placement="top"
      className={resolveStackClassName()}
    >
      {showDustProgress && dustProgressItems.length > 0 ? (
        <div
          data-testid="betrayal-dust-progress-strip"
          data-haunt-progress-kind="dust"
          data-prompt-placement="top"
          className={resolveDustProgressClassName(dustProgressDimmed)}
        >
          <span className="text-[17px] text-[#fff1b8]">
            {activeHauntCaseLabel}
          </span>
          <span className="text-[21px] text-[#d1b05f]">
            {activeHauntTitle}
          </span>
          {dustProgressItems.map((item) => (
            <span
              key={item.id}
              data-testid={`betrayal-dust-progress-item-${item.id}`}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[7px] bg-[rgba(211,179,109,0.16)] px-3 py-1"
            >
              <span className="text-[#efe1b5]">{item.label}</span>
              <span className="text-[#f6ffc4]">{item.value}</span>
            </span>
          ))}
        </div>
      ) : null}
      {showTradeFlowPrompt ? (
        <TradeFlowBanner
          tradeAgreementState={tradeAgreementState}
          tradeBannerStatusText={tradeBannerStatusText}
        />
      ) : null}
      {mummyReward ? (
        <RewardBanner kind="mummy" reward={mummyReward} />
      ) : null}
      {helpingHandsReward ? (
        <RewardBanner
          kind="helpingHands"
          reward={helpingHandsReward}
        />
      ) : null}
      {helpingHandsMonsterTurnStatus ? (
        <div
          data-testid="betrayal-helping-hands-monster-turn-status"
          data-helping-hands-monster-state={
            helpingHandsMonsterTurnStatus.active
              ? "controlled"
              : "skipped-no-amulet"
          }
          data-prompt-placement="top"
          className={resolveMonsterTurnClassName()}
        >
          <span className="text-[21px] text-[#fff1b8]">
            {t("board.status.helpingHandsTrollAttackTitle")}
          </span>
          <span className="text-[#d8c692]">
            {helpingHandsMonsterTurnStatus.active
              ? t("board.status.helpingHandsMonsterControlledBy", {
                  player: helpingHandsMonsterTurnStatus.controllerName,
                })
              : t("board.status.helpingHandsMonsterSkippedNoAmulet")}
          </span>
        </div>
      ) : null}
      {showHelpingHandsTrollAttack ? (
        <div
          data-testid="betrayal-helping-hands-troll-attack-banner"
          data-prompt-placement="top"
          className={resolveTrollAttackClassName()}
        >
          <span className="text-[22px] text-[#fff1b8]">
            {t("board.status.helpingHandsTrollAttackTitle")}
          </span>
          <span
            data-testid="betrayal-helping-hands-troll-target"
            className="text-[17px] text-[#d8c692]"
          >
            {t("board.status.helpingHandsTrollAttackTarget", {
              player: helpingHandsTrollAttackTargetName,
            })}
          </span>
        </div>
      ) : null}
    </div>
  );
}
