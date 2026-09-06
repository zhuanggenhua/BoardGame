import React from "react";
import { Handshake, Skull } from "lucide-react";
import { useTranslation } from "react-i18next";

export type BetrayalTopPromptStackVariant = "mobile" | "desktop";

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
  variant: BetrayalTopPromptStackVariant;
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

function resolveStackClassName(variant: BetrayalTopPromptStackVariant) {
  return variant === "mobile"
    ? "pointer-events-none absolute left-[10.5rem] right-[8.25rem] top-[2.25rem] z-[58] flex flex-col items-center gap-1.5"
    : "pointer-events-none absolute left-[248px] right-[232px] top-[84px] z-[58] hidden flex-col items-center gap-2 md:flex";
}

function resolveDustProgressClassName(
  variant: BetrayalTopPromptStackVariant,
  dimmed: boolean,
) {
  return `pointer-events-none flex flex-wrap items-center justify-center border border-[rgba(211,179,109,0.42)] bg-[rgba(10,13,10,0.82)] font-bold tracking-[0.05em] text-[#e6d8a8] shadow-[0_20px_42px_rgba(0,0,0,0.36),0_0_34px_rgba(211,179,109,0.18)] backdrop-blur-sm ${
    variant === "mobile"
      ? "min-h-[50px] w-full gap-2 rounded-[9px] px-3 py-2 text-[12px]"
      : "min-h-[70px] w-[min(960px,calc(100vw-31rem))] gap-2.5 rounded-[12px] px-5 py-3 text-[16px]"
  } ${dimmed ? "opacity-[0.72]" : ""}`;
}

function resolveRewardBannerClassName(variant: BetrayalTopPromptStackVariant) {
  return variant === "mobile"
    ? "pointer-events-none flex min-h-[56px] w-full flex-wrap items-center justify-center gap-2.5 rounded-[9px] border border-[rgba(238,204,126,0.52)] bg-[rgba(18,17,13,0.90)] px-4 py-2.5 text-center text-[13px] font-bold tracking-[0.045em] text-[#f3e0a6] shadow-[0_16px_34px_rgba(0,0,0,0.38),0_0_24px_rgba(238,204,126,0.20)] backdrop-blur-sm"
    : "pointer-events-none flex min-h-[78px] w-[min(960px,calc(100vw-31rem))] flex-wrap items-center justify-center gap-3.5 rounded-[12px] border border-[rgba(238,204,126,0.56)] bg-[rgba(18,17,13,0.90)] px-6 py-4 text-[17px] font-bold tracking-[0.05em] text-[#f3e0a6] shadow-[0_22px_46px_rgba(0,0,0,0.40),0_0_34px_rgba(238,204,126,0.24)] backdrop-blur-sm";
}

function resolveRewardTextShadow(variant: BetrayalTopPromptStackVariant) {
  return variant === "mobile"
    ? "0 1px 2px rgba(0,0,0,0.86), 0 0 12px rgba(238,204,126,0.34)"
    : "0 1px 2px rgba(0,0,0,0.85), 0 0 14px rgba(238,204,126,0.38)";
}

function resolveMonsterTurnClassName(variant: BetrayalTopPromptStackVariant) {
  return variant === "mobile"
    ? "pointer-events-none flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[9px] border border-[rgba(159,225,167,0.36)] bg-[rgba(10,18,14,0.82)] px-3 py-2 text-[12px] font-bold tracking-[0.045em] text-[#d9ffcf] shadow-[0_14px_30px_rgba(0,0,0,0.34),0_0_22px_rgba(159,225,167,0.16)] backdrop-blur-sm"
    : "pointer-events-none inline-flex min-h-[66px] w-[min(860px,calc(100vw-31rem))] items-center justify-center gap-3 rounded-[12px] border border-[rgba(159,225,167,0.38)] bg-[rgba(10,18,14,0.82)] px-5 py-3 text-[16px] font-bold tracking-[0.05em] text-[#d9ffcf] shadow-[0_20px_42px_rgba(0,0,0,0.36),0_0_30px_rgba(159,225,167,0.18)] backdrop-blur-sm";
}

function resolveTrollAttackClassName(variant: BetrayalTopPromptStackVariant) {
  return variant === "mobile"
    ? "pointer-events-none flex min-h-[56px] w-full flex-wrap items-center justify-center gap-2.5 rounded-[9px] border border-[rgba(159,225,167,0.48)] bg-[rgba(10,18,14,0.84)] px-4 py-2.5 text-[13px] font-bold tracking-[0.045em] text-[#d9ffcf] shadow-[0_16px_34px_rgba(0,0,0,0.36),0_0_24px_rgba(159,225,167,0.18)] backdrop-blur-sm"
    : "pointer-events-none flex min-h-[76px] w-[min(940px,calc(100vw-31rem))] flex-wrap items-center justify-center gap-3.5 rounded-[12px] border border-[rgba(159,225,167,0.52)] bg-[rgba(10,18,14,0.86)] px-6 py-4 text-[17px] font-bold tracking-[0.05em] text-[#d9ffcf] shadow-[0_22px_46px_rgba(0,0,0,0.38),0_0_32px_rgba(159,225,167,0.22)] backdrop-blur-sm";
}

function TradeFlowBanner({
  variant,
  tradeAgreementState,
  tradeBannerStatusText,
}: {
  variant: BetrayalTopPromptStackVariant;
  tradeAgreementState: string;
  tradeBannerStatusText: string;
}) {
  const isMobile = variant === "mobile";

  return (
    <div
      data-testid="betrayal-trade-flow-banner"
      data-trade-agreement-state={tradeAgreementState}
      data-trade-summary-role="status-summary"
      data-trade-progress-visible="status-only"
      data-prompt-placement="top"
      className={`pointer-events-none inline-flex max-w-full items-center justify-center gap-1.5 rounded-[5px] border border-[rgba(238,204,126,0.22)] bg-[rgba(18,17,13,0.52)] text-center font-semibold tracking-[0.02em] text-[#f3e0a6] shadow-[0_6px_14px_rgba(0,0,0,0.22)] backdrop-blur-sm ${
        isMobile
          ? "min-h-[30px] px-2.5 py-1 text-[11px]"
          : "min-h-[30px] w-auto px-3 py-1 text-[12px]"
      }`}
      style={{
        border: "1px solid rgba(238,204,126,0.22)",
        boxShadow: "0 6px 14px rgba(0,0,0,0.22)",
        textShadow: "0 1px 2px rgba(0,0,0,0.78)",
      }}
    >
      <Handshake size={isMobile ? 13 : 14} strokeWidth={2.3} />
      <span
        data-testid="betrayal-trade-banner-status"
        className={`min-w-0 truncate leading-snug ${
          isMobile ? "max-w-[min(460px,calc(100vw-24rem))]" : "max-w-[460px]"
        }`}
      >
        {tradeBannerStatusText}
      </span>
    </div>
  );
}

function RewardBanner({
  variant,
  kind,
  reward,
}: {
  variant: BetrayalTopPromptStackVariant;
  kind: "mummy" | "helpingHands";
  reward: BetrayalTopPromptRewardSummary;
}) {
  const { t } = useTranslation("game-betrayal");
  const isMobile = variant === "mobile";
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
      className={resolveRewardBannerClassName(variant)}
      style={{
        textShadow: resolveRewardTextShadow(variant),
      }}
    >
      <Skull size={isMobile ? 18 : 24} strokeWidth={2.4} />
      <span className={isMobile ? "text-[16px] text-[#fff1b8]" : "text-[22px] text-[#fff1b8]"}>
        {t(titleKey)}
      </span>
      <span
        data-testid={
          isMummy
            ? "betrayal-mummy-reward-step"
            : "betrayal-helping-hands-reward-step"
        }
        className={isMobile ? "text-[13px] text-[#e3d2a1]" : "text-[17px] text-[#e3d2a1]"}
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
          className={
            isMobile
              ? "rounded-full border border-[rgba(245,155,92,0.42)] bg-[rgba(92,42,24,0.42)] px-2.5 py-1 text-[12px] font-bold text-[#ffd0a6]"
              : "rounded-full border border-[rgba(245,155,92,0.44)] bg-[rgba(92,42,24,0.44)] px-3 py-1.5 text-[13px] font-bold text-[#ffd0a6]"
          }
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
  variant,
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
  const isMobile = variant === "mobile";

  if (!enabled) {
    return null;
  }

  return (
    <div
      data-testid="betrayal-top-prompt-stack"
      data-mobile-role={isMobile ? "top-prompt-stack" : undefined}
      data-prompt-placement="top"
      className={resolveStackClassName(variant)}
    >
      {showDustProgress && dustProgressItems.length > 0 ? (
        <div
          data-testid="betrayal-dust-progress-strip"
          data-haunt-progress-kind="dust"
          data-prompt-placement="top"
          className={resolveDustProgressClassName(variant, dustProgressDimmed)}
        >
          <span className={isMobile ? "text-[#fff1b8]" : "text-[17px] text-[#fff1b8]"}>
            {activeHauntCaseLabel}
          </span>
          <span className={isMobile ? "text-[15px] text-[#d1b05f]" : "text-[21px] text-[#d1b05f]"}>
            {activeHauntTitle}
          </span>
          {dustProgressItems.map((item) => (
            <span
              key={item.id}
              data-testid={`betrayal-dust-progress-item-${item.id}`}
              className={
                isMobile
                  ? "inline-flex min-h-[28px] items-center gap-1 rounded-[6px] bg-[rgba(211,179,109,0.16)] px-2 py-0.5"
                  : "inline-flex min-h-[36px] items-center gap-1.5 rounded-[7px] bg-[rgba(211,179,109,0.16)] px-3 py-1"
              }
            >
              <span className="text-[#efe1b5]">{item.label}</span>
              <span className="text-[#f6ffc4]">{item.value}</span>
            </span>
          ))}
        </div>
      ) : null}
      {showTradeFlowPrompt ? (
        <TradeFlowBanner
          variant={variant}
          tradeAgreementState={tradeAgreementState}
          tradeBannerStatusText={tradeBannerStatusText}
        />
      ) : null}
      {mummyReward ? (
        <RewardBanner variant={variant} kind="mummy" reward={mummyReward} />
      ) : null}
      {helpingHandsReward ? (
        <RewardBanner
          variant={variant}
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
          className={resolveMonsterTurnClassName(variant)}
        >
          <span className={isMobile ? "text-[15px] text-[#fff1b8]" : "text-[21px] text-[#fff1b8]"}>
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
          className={resolveTrollAttackClassName(variant)}
        >
          <span className={isMobile ? "text-[16px] text-[#fff1b8]" : "text-[22px] text-[#fff1b8]"}>
            {t("board.status.helpingHandsTrollAttackTitle")}
          </span>
          <span
            data-testid="betrayal-helping-hands-troll-target"
            className={isMobile ? "text-[13px] text-[#d8c692]" : "text-[17px] text-[#d8c692]"}
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
