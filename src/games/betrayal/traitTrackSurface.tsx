import { Minus, Plus, Skull } from "lucide-react";
import type { useTranslation } from "react-i18next";
import { OptimizedImage } from "../../components/common/media/OptimizedImage";
import type {
  BetrayalCore,
  BetrayalExplorerSummary,
  BetrayalTraitKey,
} from "./game";
import { BETRAYAL_TRAIT_MARKER_ASSETS } from "./traitAssets";
import {
  clampTraitTrackPosition,
  resolveExplorerTraitTrack,
  resolveTrackPositionPercent,
  resolveTraitDamageFloorPosition,
  resolveTraitTrackSlots,
  resolveTraitTrackValueAtPosition,
} from "./traitPresentation";

export const TRAIT_LABEL_LOCAL: Record<BetrayalTraitKey, string> = {
  might: "力量",
  speed: "速度",
  knowledge: "知识",
  sanity: "神志",
};

export const TRAIT_SKULL_LABEL = "死亡";

export const TRAIT_TONE_CLASS: Record<
  BetrayalTraitKey,
  { active: string; inactive: string; text: string }
> = {
  might: {
    active: "border-[#cf715f] bg-[#cf715f]",
    inactive: "border-[rgba(207,113,95,0.34)] bg-[rgba(34,19,18,0.68)]",
    text: "text-[#e8b09f]",
  },
  speed: {
    active: "border-[#d6be67] bg-[#d6be67]",
    inactive: "border-[rgba(214,190,103,0.34)] bg-[rgba(35,31,18,0.68)]",
    text: "text-[#ebdca1]",
  },
  knowledge: {
    active: "border-[#8ebac5] bg-[#8ebac5]",
    inactive: "border-[rgba(142,186,197,0.32)] bg-[rgba(17,26,28,0.68)]",
    text: "text-[#cbe4ea]",
  },
  sanity: {
    active: "border-[#9f7bc5] bg-[#9f7bc5]",
    inactive: "border-[rgba(159,123,197,0.32)] bg-[rgba(24,19,31,0.68)]",
    text: "text-[#d9c4ef]",
  },
};

export const TRAIT_CHOICE_TONE_CLASS: Record<
  BetrayalTraitKey,
  { selected: string; idle: string }
> = {
  might: {
    selected:
      "border-[#ff947f] bg-[rgba(207,113,95,0.74)] text-[#ffe1d8] shadow-[0_0_24px_rgba(207,113,95,0.34)]",
    idle: "border-[rgba(207,113,95,0.68)] bg-[rgba(54,22,19,0.66)] text-[#ffc6b8] hover:border-[#ff947f] hover:bg-[rgba(207,113,95,0.22)]",
  },
  speed: {
    selected:
      "border-[#f0d97b] bg-[rgba(214,190,103,0.72)] text-[#fff2b8] shadow-[0_0_24px_rgba(214,190,103,0.32)]",
    idle: "border-[rgba(214,190,103,0.68)] bg-[rgba(48,39,16,0.66)] text-[#ffeaa6] hover:border-[#f0d97b] hover:bg-[rgba(214,190,103,0.20)]",
  },
  knowledge: {
    selected:
      "border-[#a9d7e2] bg-[rgba(142,186,197,0.72)] text-[#e2f8ff] shadow-[0_0_24px_rgba(142,186,197,0.30)]",
    idle: "border-[rgba(142,186,197,0.66)] bg-[rgba(18,35,39,0.66)] text-[#dbf4fb] hover:border-[#a9d7e2] hover:bg-[rgba(142,186,197,0.20)]",
  },
  sanity: {
    selected:
      "border-[#c59af0] bg-[rgba(159,123,197,0.76)] text-[#f0dcff] shadow-[0_0_24px_rgba(159,123,197,0.34)]",
    idle: "border-[rgba(159,123,197,0.66)] bg-[rgba(35,22,48,0.66)] text-[#ead4ff] hover:border-[#c59af0] hover:bg-[rgba(159,123,197,0.20)]",
  },
};

export const TRAIT_VALUE_TEXT_CLASS: Record<BetrayalTraitKey, string> = {
  might: "text-[#f0b29f]",
  speed: "text-[#f2e09e]",
  knowledge: "text-[#cbe7ee]",
  sanity: "text-[#dcc7f1]",
};

type BetrayalTranslator = ReturnType<typeof useTranslation>["t"];
type TraitTrackRailDensity = "panel" | "detail" | "compact";
type TraitOutcomePreviewMode = "damage" | "heal";

export function ExplorerTraitTrackRail({
  explorer,
  trait,
  locale,
  density = "panel",
  testIdPrefix = "betrayal-trait-track",
}: {
  explorer: BetrayalExplorerSummary;
  trait: BetrayalTraitKey;
  locale: string;
  density?: TraitTrackRailDensity;
  testIdPrefix?: string;
}) {
  const track = resolveExplorerTraitTrack(explorer, trait);
  const currentPosition = clampTraitTrackPosition(track);
  const slots = resolveTraitTrackSlots(track);
  const currentValue = explorer.traits[trait] ?? 0;
  const isCompact = density === "compact";
  const isDetail = density === "detail";
  const currentSlotIndex = Math.max(0, slots.indexOf(currentPosition));
  const railHeightClass = isCompact
    ? "h-[30px]"
    : isDetail
      ? "h-[44px]"
      : "h-[38px]";
  const trackBodyClass = isCompact
    ? "h-[22px]"
    : isDetail
      ? "h-[32px]"
      : "h-[28px]";
  const slotLabelClass = isCompact
    ? "relative z-10 flex h-full w-full items-center justify-center text-[9px] leading-none tabular-nums"
    : isDetail
      ? "relative z-10 flex h-full w-full items-center justify-center text-[13px] leading-none tabular-nums"
      : "relative z-10 flex h-full w-full items-center justify-center text-[12px] leading-none tabular-nums";

  return (
    <div
      data-testid={`${testIdPrefix}-${trait}`}
      data-player-id={explorer.playerId}
      data-explorer-id={explorer.explorerId}
      data-trait={trait}
      data-trait-track-id={track.trackId}
      data-trait-track-position={currentPosition}
      data-trait-track-start-position={track.startPosition}
      data-trait-track-critical-position={track.criticalPosition}
      data-trait-track-skull-position={track.skullPosition}
      data-trait-track-value={currentValue}
      className={`grid items-center gap-1.5 ${
        isCompact
          ? "grid-cols-[42px_minmax(0,1fr)] text-[9px]"
          : isDetail
            ? "grid-cols-[74px_minmax(0,1fr)] text-[12px]"
            : "grid-cols-[66px_minmax(0,1fr)] text-[12px]"
      }`}
    >
      <span
        className={`inline-flex min-w-0 items-center gap-1.5 font-semibold ${TRAIT_TONE_CLASS[trait].text}`}
      >
        {!isCompact ? (
          <OptimizedImage
            src={BETRAYAL_TRAIT_MARKER_ASSETS[trait]}
            locale={locale}
            alt=""
            className={`${isDetail ? "h-[18px] w-[18px]" : "h-4 w-4"} object-contain opacity-86`}
            draggable={false}
          />
        ) : null}
        <span className="truncate">{TRAIT_LABEL_LOCAL[trait]}</span>
      </span>
      <div
        data-trait-track-rail="true"
        data-trait-track-rail-shape="continuous-segmented"
        data-trait-track-repeat-value-policy="separate-physical-slots"
        data-trait-track-current-index={currentSlotIndex}
        className={`relative ${railHeightClass} min-w-0`}
        title={`${TRAIT_LABEL_LOCAL[trait]}属性轨：骷髅为死亡端点，当前指针在第 ${currentPosition} 位，数值 ${currentValue}`}
        aria-label={`${TRAIT_LABEL_LOCAL[trait]}属性轨，骷髅为死亡端点，当前指针在第 ${currentPosition} 位，数值 ${currentValue}`}
      >
        <div
          data-trait-track-segmented-rail="true"
          data-trait-track-visual-separation="continuous-rail-internal-dividers"
          className={`absolute inset-x-0 top-1/2 grid ${trackBodyClass} -translate-y-1/2 gap-0 overflow-hidden rounded-[7px] border border-[rgba(181,128,70,0.62)] bg-[linear-gradient(180deg,rgba(47,31,20,0.96)_0%,rgba(25,21,15,0.94)_50%,rgba(18,15,12,0.96)_100%)] p-[2px] shadow-[inset_0_0_0_1px_rgba(255,224,159,0.16),inset_0_0_12px_rgba(0,0,0,0.44),0_3px_10px_rgba(0,0,0,0.24)]`}
          style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))` }}
        >
          {slots.map((position, slotIndex) => {
            const isSkull = position === track.skullPosition;
            const isCurrent = position === currentPosition;
            const isStart = position === track.startPosition;
            const isCritical = position === track.criticalPosition;
            const hasInternalDivider = slotIndex > 0;
            const slotValue = isSkull ? null : track.values[position];
            return (
              <span
                key={`${trait}-${position}`}
                data-trait-track-slot="true"
                data-trait-track-position={position}
                data-trait-track-current={isCurrent ? "true" : "false"}
                data-trait-track-pointer={isCurrent ? "true" : undefined}
                data-trait-track-pointer-shape={isCurrent ? "material-slot-highlight" : undefined}
                data-trait-track-start={isStart ? "true" : "false"}
                data-trait-track-start-indicator={isStart ? "in-slot-green-band" : undefined}
                data-trait-track-critical={isCritical ? "true" : "false"}
                data-trait-track-skull={isSkull ? "true" : "false"}
                data-trait-track-death={isSkull ? "true" : "false"}
                data-trait-track-slot-boundary={hasInternalDivider ? "internal-divider" : "rail-start"}
                data-trait-track-value={isSkull ? undefined : slotValue}
                data-trait-track-color={
                  isCurrent
                    ? "current-green"
                    : isSkull
                      ? "death-red"
                      : isCritical
                        ? "critical-red"
                        : isStart
                          ? "start-green"
                          : "neutral"
                }
                title={`${TRAIT_LABEL_LOCAL[trait]} ${isSkull ? "死亡格（不是数值）" : slotValue}${isStart ? "，初始格" : ""}${isCurrent ? "，当前位置" : ""}`}
                aria-label={`${TRAIT_LABEL_LOCAL[trait]} ${isSkull ? "死亡格，不是数值" : slotValue}${isStart ? "，初始格" : ""}${isCurrent ? "，当前位置" : ""}`}
                className={`relative grid min-w-0 place-items-center border-0 text-center font-semibold leading-none ${
                  isCurrent
                    ? "bg-[linear-gradient(180deg,rgba(111,169,72,0.82)_0%,rgba(70,129,57,0.78)_52%,rgba(47,97,42,0.78)_100%)] text-[#f7ffd8] shadow-[inset_0_0_0_1px_rgba(231,255,172,0.30),inset_0_0_11px_rgba(236,255,177,0.18),0_0_13px_rgba(155,214,103,0.34)]"
                    : isSkull
                      ? "bg-[linear-gradient(180deg,rgba(86,26,21,0.58)_0%,rgba(53,18,15,0.46)_100%)] text-[#ffd0c6]"
                      : isCritical
                        ? "bg-[linear-gradient(180deg,rgba(97,41,33,0.34)_0%,rgba(55,22,18,0.26)_100%)] text-[#ffd7cd]"
                        : isStart
                          ? "bg-transparent text-[#e8ffd2]"
                          : "bg-transparent text-[rgba(238,220,176,0.84)]"
                } ${
                  hasInternalDivider
                    ? "before:pointer-events-none before:absolute before:bottom-[2px] before:left-0 before:top-[2px] before:z-20 before:w-px before:bg-[rgba(255,230,178,0.46)] before:shadow-[1px_0_0_rgba(0,0,0,0.30)] before:content-['']"
                    : ""
                } ${
                  isStart
                    ? "after:pointer-events-none after:absolute after:inset-x-[5px] after:bottom-[3px] after:z-10 after:h-[3px] after:rounded-full after:bg-[rgba(199,255,150,0.74)] after:shadow-[0_0_8px_rgba(199,255,150,0.48)] after:content-['']"
                    : ""
                }`}
              >
                {isSkull ? (
                  <>
                    <Skull
                      className={`${isCompact ? "h-3 w-3" : "h-4 w-4"} ${
                        isCurrent ? "text-[#fff0bf]" : "text-[#ffd0c6]"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="sr-only">{TRAIT_SKULL_LABEL}</span>
                  </>
                ) : (
                  <span
                    data-trait-track-slot-label="true"
                    data-trait-track-slot-label-align="center"
                    className={slotLabelClass}
                  >
                    {slotValue}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ExplorerTraitOutcomePreview({
  explorer,
  trait,
  mode,
  phase,
  stepCount,
  locale,
  t,
  testIdPrefix,
  selected = false,
  disabled = false,
  selectedCount,
  locked,
  ariaLabel,
  onClick,
  onIncrement,
  onDecrement,
  canIncrement,
  canDecrement,
}: {
  explorer: BetrayalExplorerSummary;
  trait: BetrayalTraitKey;
  mode: TraitOutcomePreviewMode;
  phase: BetrayalCore["phase"];
  stepCount: number;
  locale: string;
  t: BetrayalTranslator;
  testIdPrefix: string;
  selected?: boolean;
  disabled?: boolean;
  selectedCount?: number;
  locked?: boolean;
  ariaLabel?: string;
  onClick?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
  canIncrement?: boolean;
  canDecrement?: boolean;
}) {
  const track = resolveExplorerTraitTrack(explorer, trait);
  const currentPosition = clampTraitTrackPosition(track);
  const floorPosition = resolveTraitDamageFloorPosition(track, phase);
  const requestedSteps = Math.max(0, stepCount);
  const targetPosition =
    mode === "heal"
      ? currentPosition < track.startPosition
        ? Math.min(track.startPosition, track.maxPosition)
        : currentPosition
      : Math.max(floorPosition, currentPosition - requestedSteps);
  const actualSteps = Math.abs(targetPosition - currentPosition);
  const currentValue = resolveTraitTrackValueAtPosition(track, currentPosition);
  const targetValue = resolveTraitTrackValueAtPosition(track, targetPosition);
  const slots = resolveTraitTrackSlots(track);
  const currentPercent = resolveTrackPositionPercent(slots, currentPosition);
  const targetPercent = resolveTrackPositionPercent(slots, targetPosition);
  const isLockedForDamage = mode === "damage" && currentPosition <= floorPosition;
  const hasAdjustControls =
    mode === "damage" &&
    (typeof onIncrement === "function" || typeof onDecrement === "function");
  const isCardInteractive =
    typeof onClick === "function" && !hasAdjustControls;
  const safeSelectedCount = selectedCount ?? 0;
  const outcomeLabel =
    mode === "heal"
      ? actualSteps > 0
        ? t("game-betrayal:board.traitPreview.healToStart")
        : t("game-betrayal:board.traitPreview.noChange")
      : actualSteps > 0
        ? t("game-betrayal:board.traitPreview.damageSteps", { count: actualSteps })
        : isLockedForDamage
          ? t("game-betrayal:board.traitPreview.locked")
          : t("game-betrayal:board.traitPreview.noChange");
  const valueFlowLabel = t("game-betrayal:board.traitPreview.valueFlow", {
    from: currentValue,
    to: targetValue,
  });
  const shouldShowOutcomeLabel = mode !== "damage" || isLockedForDamage;
  const ariaSummaryLabel =
    mode === "damage"
      ? valueFlowLabel
      : `${valueFlowLabel}，${outcomeLabel}`;
  const previewClassName = `grid gap-1.5 rounded-[8px] border px-2.5 py-2 text-left transition ${
    isLockedForDamage
      ? "border-[rgba(115,54,47,0.56)] bg-[rgba(48,19,18,0.48)]"
      : selected
        ? `${TRAIT_CHOICE_TONE_CLASS[trait].selected} shadow-[0_0_18px_rgba(214,181,109,0.20)]`
        : "border-[rgba(211,179,109,0.28)] bg-[rgba(13,16,13,0.46)]"
  } ${
    isCardInteractive
      ? "pointer-events-auto w-full min-w-0 cursor-pointer hover:border-[rgba(211,179,109,0.54)] hover:bg-[rgba(209,176,95,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4df9a] data-[disabled=true]:cursor-not-allowed data-[disabled=true]:border-[rgba(123,106,74,0.24)] data-[disabled=true]:bg-[rgba(13,15,11,0.28)] data-[disabled=true]:text-[#7a6a4a] data-[disabled=true]:shadow-none"
      : hasAdjustControls
        ? "pointer-events-auto w-full min-w-0"
        : ""
  }`;
  const previewAttributes = {
    "data-testid": `${testIdPrefix}-${trait}`,
    "data-trait-preview-mode": mode,
    "data-trait-preview-current-position": currentPosition,
    "data-trait-preview-target-position": targetPosition,
    "data-trait-preview-step-count": actualSteps,
    "data-trait-preview-current-value": currentValue,
    "data-trait-preview-target-value": targetValue,
    "data-trait-preview-locked": isLockedForDamage ? "true" : "false",
  };
  const previewContent = (
    <>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className={`inline-flex min-w-0 items-center gap-1.5 text-[11px] font-bold ${TRAIT_TONE_CLASS[trait].text}`}>
          <OptimizedImage
            src={BETRAYAL_TRAIT_MARKER_ASSETS[trait]}
            locale={locale}
            alt=""
            className="h-3.5 w-3.5 object-contain opacity-86"
            draggable={false}
          />
          <span className="truncate">{TRAIT_LABEL_LOCAL[trait]}</span>
        </span>
        {shouldShowOutcomeLabel ? (
          <span className="shrink-0 text-[11px] font-semibold text-[#e8d59b]">
            {outcomeLabel}
          </span>
        ) : null}
        {hasAdjustControls ? (
          <span
            data-testid={`${testIdPrefix}-${trait}-adjust-controls`}
            className="ml-auto inline-flex shrink-0 items-center overflow-hidden rounded-[999px] border border-[rgba(214,181,109,0.30)] bg-[rgba(5,8,7,0.46)]"
          >
            <button
              type="button"
              data-testid={`${testIdPrefix}-${trait}-decrease`}
              aria-label={`减少${TRAIT_LABEL_LOCAL[trait]}分配`}
              disabled={!canDecrement}
              onClick={(event) => {
                event.stopPropagation();
                onDecrement?.();
              }}
              className="grid h-7 w-7 place-items-center text-[#f1d58d] transition hover:bg-[rgba(214,181,109,0.14)] disabled:cursor-not-allowed disabled:text-[rgba(214,181,109,0.28)]"
            >
              <Minus size={14} strokeWidth={2.4} aria-hidden="true" />
            </button>
            <span
              data-testid={`${testIdPrefix}-${trait}-selected-count`}
              data-damage-selected-count={safeSelectedCount}
              className="grid h-7 min-w-[1.75rem] place-items-center border-x border-[rgba(214,181,109,0.22)] px-1 text-[12px] font-black tabular-nums text-[#fff4c7]"
              aria-label={`${TRAIT_LABEL_LOCAL[trait]}已分配${safeSelectedCount}`}
            >
              {safeSelectedCount}
            </span>
            <button
              type="button"
              data-testid={`${testIdPrefix}-${trait}-increase`}
              aria-label={`增加${TRAIT_LABEL_LOCAL[trait]}分配`}
              disabled={!canIncrement}
              onClick={(event) => {
                event.stopPropagation();
                onIncrement?.();
              }}
              className="grid h-7 w-7 place-items-center text-[#f1d58d] transition hover:bg-[rgba(214,181,109,0.14)] disabled:cursor-not-allowed disabled:text-[rgba(214,181,109,0.28)]"
            >
              <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </span>
        ) : null}
      </div>
      <div
        data-trait-preview-rail="true"
        className="relative h-[38px] min-w-0"
        title={`${TRAIT_LABEL_LOCAL[trait]}预览：从第 ${currentPosition} 位到第 ${targetPosition} 位，骷髅为死亡端点`}
        aria-label={`${TRAIT_LABEL_LOCAL[trait]}预览，从第 ${currentPosition} 位到第 ${targetPosition} 位，骷髅为死亡端点`}
      >
        <span className="pointer-events-none absolute left-0 right-0 top-1/2 h-[5px] -translate-y-1/2 rounded-full border border-[rgba(214,191,129,0.20)] bg-[linear-gradient(90deg,rgba(89,30,29,0.78),rgba(77,68,39,0.84),rgba(22,32,24,0.92))] shadow-[inset_0_0_8px_rgba(0,0,0,0.42)]" />
        <span
          data-trait-preview-pointer="current"
          data-trait-preview-position={currentPosition}
          data-trait-preview-current="true"
          className="pointer-events-none absolute top-1/2 z-20 flex h-[24px] w-[16px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center"
          style={{ left: `${currentPercent}%` }}
          title={`当前：${currentValue}`}
          aria-label={`当前${TRAIT_LABEL_LOCAL[trait]} ${currentValue}`}
        >
          <span className="h-0 w-0 border-l-[6px] border-r-[6px] border-t-[9px] border-l-transparent border-r-transparent border-t-[#f2cf82] drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)]" />
          <span className="-mt-[1px] h-[10px] w-[4px] rounded-full bg-[#f2cf82] shadow-[0_0_10px_rgba(242,207,130,0.64)]" />
        </span>
        {targetPosition !== currentPosition ? (
          <span
            data-trait-preview-pointer="target"
            data-trait-preview-position={targetPosition}
            data-trait-preview-target="true"
            className="pointer-events-none absolute top-1/2 z-20 flex h-[24px] w-[16px] -translate-x-1/2 translate-y-[2px] flex-col items-center justify-center"
            style={{ left: `${targetPercent}%` }}
            title={`目标：${targetValue}`}
            aria-label={`目标${TRAIT_LABEL_LOCAL[trait]} ${targetValue}`}
          >
            <span className="h-[10px] w-[4px] rounded-full bg-[#c85f50] shadow-[0_0_10px_rgba(200,95,80,0.54)]" />
            <span className="-mt-[1px] h-0 w-0 border-b-[9px] border-l-[6px] border-r-[6px] border-b-[#c85f50] border-l-transparent border-r-transparent drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)]" />
          </span>
        ) : null}
        {slots.map((position) => {
          const isSkull = position === track.skullPosition;
          const isCurrent = position === currentPosition;
          const isTarget = position === targetPosition;
          const slotValue = isSkull
            ? null
            : resolveTraitTrackValueAtPosition(track, position);
          return (
            <span
              key={`${trait}-preview-${position}`}
              data-trait-preview-slot="true"
              data-trait-preview-position={position}
              data-trait-preview-current="false"
              data-trait-preview-target="false"
              data-trait-preview-skull={isSkull ? "true" : "false"}
              title={`${TRAIT_LABEL_LOCAL[trait]} ${isSkull ? "死亡格（不是数值）" : slotValue}`}
              aria-label={`${TRAIT_LABEL_LOCAL[trait]} ${isSkull ? "死亡格，不是数值" : slotValue}`}
              className="absolute top-1/2 z-10 flex min-w-[14px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center text-center text-[9px] font-semibold leading-none"
              style={{ left: `${resolveTrackPositionPercent(slots, position)}%` }}
            >
              {isSkull ? (
                <>
                  <span className={`grid h-[16px] w-[16px] place-items-center rounded-full border border-[#9a4038] bg-[rgba(91,31,28,0.88)] text-[#ffd0c6] ${isTarget || isCurrent ? "shadow-[0_0_10px_rgba(207,72,62,0.42)]" : ""}`}>
                    <Skull className="h-3 w-3" />
                  </span>
                  <span className="sr-only">{TRAIT_SKULL_LABEL}</span>
                </>
              ) : (
                <>
                  <span
                    data-trait-preview-tick="true"
                    className={`block ${position === track.criticalPosition ? "h-[13px] bg-[#c05b4d]" : "h-[9px] bg-[rgba(214,191,129,0.62)]"} w-px rounded-full`}
                  />
                  <span
                    className={`absolute top-[24px] ${
                      isTarget
                        ? "text-[#f0d27f]"
                        : isCurrent
                          ? TRAIT_VALUE_TEXT_CLASS[trait]
                          : position === track.criticalPosition
                            ? "text-[#d88f82]"
                            : "text-[rgba(232,216,174,0.72)]"
                    }`}
                  >
                    {slotValue}
                  </span>
                </>
              )}
            </span>
          );
        })}
      </div>
      <div className="text-[10px] font-semibold text-[#cbb37d]">
        {valueFlowLabel}
      </div>
    </>
  );

  if (hasAdjustControls) {
    return (
      <div
        {...previewAttributes}
        data-damage-selected-count={safeSelectedCount}
        data-damage-locked={(locked ?? isLockedForDamage) ? "true" : "false"}
        data-disabled={disabled ? "true" : "false"}
        aria-label={
          ariaLabel ??
          `${TRAIT_LABEL_LOCAL[trait]}：${ariaSummaryLabel}`
        }
        className={previewClassName}
      >
        {previewContent}
      </div>
    );
  }

  if (isCardInteractive) {
    return (
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        {...previewAttributes}
        data-damage-selected-count={safeSelectedCount}
        data-damage-locked={(locked ?? isLockedForDamage) ? "true" : "false"}
        data-disabled={disabled ? "true" : "false"}
        aria-label={
          ariaLabel ??
          `${TRAIT_LABEL_LOCAL[trait]}：${ariaSummaryLabel}`
        }
        aria-pressed={selected}
        onClick={() => {
          if (!disabled) {
            onClick?.();
          }
        }}
        onKeyDown={(event) => {
          if (disabled || !onClick) {
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick();
          }
        }}
        className={previewClassName}
      >
        {previewContent}
      </div>
    );
  }

  return (
    <div {...previewAttributes} className={previewClassName}>
      {previewContent}
    </div>
  );
}
