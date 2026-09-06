import React from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { OptimizedImage } from "../../components/common/media/OptimizedImage";
import { PossessionAtlasFrame } from "./atlasFrameSurface";
import type { BetrayalInventoryCard } from "./game";
import {
  BETRAYAL_POSSESSION_CARD_SHELL_ASPECT_RATIO,
  resolvePossessionAtlasVisual,
} from "./possessionAtlas";
import {
  resolveInventoryCardAccentAsset,
  resolveInventoryCardBackAsset,
  resolveInventoryFaceTone,
  resolveInventoryRulesSummary,
  type BetrayalTraitAssetMap,
  type InventoryCardBackAssetMap,
} from "./inventoryPresentation";
import type { BetrayalTradeCardStatus } from "./trade";

export const BETRAYAL_COMPACT_INVENTORY_CARD_WIDTH = 62;

export type BetrayalInventoryCardSurfaceLayout =
  | "focus"
  | "compact"
  | "preview";

export interface BetrayalInventoryCardSurfaceProps {
  item: BetrayalInventoryCard;
  layout: BetrayalInventoryCardSurfaceLayout;
  locale: string;
  deckAssets: InventoryCardBackAssetMap;
  traitAssets: BetrayalTraitAssetMap;
  testId?: string;
  compactDenseNoFront?: boolean;
  selected?: boolean;
  showTurnStatus?: boolean;
  usedThisTurn?: boolean;
  availableThisTurn?: boolean;
  tradeStatus?: BetrayalTradeCardStatus | null;
  tradeCompact?: boolean;
  disabled?: boolean;
  disabledReason?: string | null;
  readOnly?: boolean;
  tutorialTarget?: boolean;
  canModifyRecentRoll?: boolean;
  canUseBookForEventRoll?: boolean;
  onUseBookForEventRoll?: (cardId: string) => void;
  onSelect?: () => void;
  onPrimarySelect?: (cardId: string) => void;
  onPreview?: (cardId: string) => void;
}

export function BetrayalInventoryCardSurface({
  item,
  layout,
  locale,
  deckAssets,
  traitAssets,
  testId,
  compactDenseNoFront = false,
  selected = false,
  showTurnStatus,
  usedThisTurn = false,
  availableThisTurn = true,
  tradeStatus = null,
  tradeCompact = false,
  disabled,
  disabledReason,
  readOnly = false,
  tutorialTarget = false,
  canModifyRecentRoll = false,
  canUseBookForEventRoll = false,
  onUseBookForEventRoll,
  onSelect,
  onPrimarySelect,
  onPreview,
}: BetrayalInventoryCardSurfaceProps) {
  const { t } = useTranslation("game-betrayal");
  const isFocus = layout === "focus";
  const isPreview = layout === "preview";
  const isCompact = layout === "compact";
  const resolvedTradeStatus = readOnly ? null : tradeStatus;
  const resolvedDisabledReason =
    disabledReason ?? resolvedTradeStatus?.reason ?? null;
  const isCardDisabled = Boolean(
    disabled ?? (resolvedTradeStatus && !resolvedTradeStatus.canTrade),
  );
  const isSelected = !readOnly && !isPreview && selected;
  const shouldShowTurnStatus = showTurnStatus ?? (!readOnly && !isPreview);
  const isUsedThisTurn = shouldShowTurnStatus && usedThisTurn;
  const isAvailableThisTurn = !shouldShowTurnStatus || availableThisTurn;
  const isUnavailableThisTurn = !isUsedThisTurn && !isAvailableThisTurn;
  const tone = resolveInventoryFaceTone(item.kind);
  const frontVisual = resolvePossessionAtlasVisual(item);
  const backAsset = resolveInventoryCardBackAsset(item, deckAssets);
  const accentAsset = resolveInventoryCardAccentAsset(item, traitAssets);
  const rulesSummary = resolveInventoryRulesSummary(item, t);
  const showTutorialTarget = !isPreview && tutorialTarget;
  const showRollModifierTarget =
    !readOnly && !isPreview && canModifyRecentRoll;
  const showEventRollBookTarget =
    !readOnly && !isPreview && canUseBookForEventRoll;
  const isTradeCompact = isCompact && Boolean(frontVisual) && tradeCompact;
  const isDenseNoFrontCompact = isCompact && !frontVisual && compactDenseNoFront;
  const isCompactDenseOmen = isDenseNoFrontCompact && item.kind === "omen";
  const shellRadiusClass = isPreview
    ? "rounded-[16px]"
    : isFocus
      ? "rounded-[10px]"
      : "rounded-[6px]";
  const cardWidthStyle = isPreview
    ? { width: "100%" }
    : isCompact
      ? { width: `${BETRAYAL_COMPACT_INVENTORY_CARD_WIDTH}px` }
      : undefined;
  const showSelectedState = !isPreview && isSelected;
  const showActionTargetOutline =
    !showSelectedState && (showTutorialTarget || showRollModifierTarget);
  const titleClass = isPreview
    ? `min-h-[52px] text-[18px] font-semibold leading-[22px] ${frontVisual ? "text-[#f7ecd4] drop-shadow-[0_1px_2px_rgba(0,0,0,0.68)]" : "text-[#f3ead8] drop-shadow-[0_1px_2px_rgba(0,0,0,0.76)]"}`
    : isFocus
      ? `min-h-[34px] text-[13px] font-semibold leading-[16px] ${frontVisual ? "text-[#f7ecd4] drop-shadow-[0_1px_2px_rgba(0,0,0,0.68)]" : "text-[#f3ead8] drop-shadow-[0_1px_2px_rgba(0,0,0,0.76)]"}`
      : `min-h-[16px] text-[8px] font-semibold leading-[9px] ${frontVisual ? "text-[#f7ecd4] drop-shadow-[0_1px_2px_rgba(0,0,0,0.68)]" : "text-[#f3ead8] drop-shadow-[0_1px_2px_rgba(0,0,0,0.76)]"}`;

  const compactStackStyle = isCompact
    ? {
        zIndex: showSelectedState ? 12 : 2,
      }
    : undefined;
  const buttonOutlineClass = showSelectedState
    ? "z-30 -translate-y-0.5 shadow-[0_0_20px_rgba(238,204,126,0.48)]"
    : showRollModifierTarget
      ? "z-30"
      : isPreview
        ? "z-10"
        : "z-10 hover:-translate-y-0.5";
  const outerRingClass = "";

  return (
    <div
      className={`group relative isolate ${isCompact ? "shrink-0" : "w-full"}`}
      style={{ ...cardWidthStyle, ...compactStackStyle }}
    >
      <button
        type="button"
        onClick={() => {
          if (isPreview) {
            return;
          }
          if (readOnly) {
            onPreview?.(item.id);
            return;
          }
          if (showEventRollBookTarget) {
            onUseBookForEventRoll?.(item.id);
            return;
          }
          if (onSelect) {
            onSelect();
            return;
          }
          onPrimarySelect?.(item.id);
        }}
        data-testid={testId}
        data-inventory-read-only={readOnly ? "true" : undefined}
        data-roll-modifier-available={
          showRollModifierTarget ? "true" : "false"
        }
        data-event-roll-book-available={
          showEventRollBookTarget ? "true" : "false"
        }
        data-trade-card-status={
          resolvedTradeStatus?.canTrade === false
            ? "disabled"
            : resolvedTradeStatus
              ? "available"
              : undefined
        }
        data-trade-card-disabled-reason={resolvedDisabledReason ?? undefined}
        title={
          readOnly
            ? `${item.name} · ${rulesSummary} · 点击查看`
            : resolvedDisabledReason
              ? `${item.name} · ${resolvedDisabledReason}`
              : `${item.name} · ${rulesSummary} · 点击选择`
        }
        disabled={isCardDisabled}
        className={`pointer-events-auto relative w-full overflow-visible text-left outline-none transition focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed ${showSelectedState ? "" : "focus-visible:ring-0"} ${isCardDisabled ? "cursor-not-allowed" : buttonOutlineClass}`}
        aria-pressed={isPreview || readOnly ? undefined : isSelected}
      >
        {showSelectedState ? (
          <span
            data-testid={testId ? `${testId}-selected-outline` : undefined}
            data-highlight-shape="card"
            aria-hidden="true"
            className={`pointer-events-none absolute z-20 ${shellRadiusClass} ${
              isCompact
                ? "-inset-[3px]"
                : isFocus
                  ? "-inset-[4px]"
                  : "-inset-[6px]"
            }`}
            style={{
              border: "2px solid #eecc7e",
              boxShadow:
                "0 0 0 1px rgba(238, 204, 126, 0.32), 0 0 20px rgba(238, 204, 126, 0.48)",
            }}
          />
        ) : showActionTargetOutline ? (
          <span
            data-testid={
              testId
                ? `${testId}-${
                    showTutorialTarget
                      ? "tutorial-target"
                      : showEventRollBookTarget
                        ? "event-roll-book"
                        : "roll-modifier"
                  }`
                : undefined
            }
            data-highlight-shape="card"
            aria-hidden="true"
            className={`pointer-events-none absolute z-20 ${shellRadiusClass} shadow-[0_0_20px_rgba(159,225,167,0.48)] ${
              isCompact
                ? "inset-[3px]"
                : isFocus
                  ? "inset-[4px]"
                  : "inset-[6px]"
            }`}
            style={{
              border: "2px solid #9fe1a7",
            }}
          />
        ) : null}
        {isUsedThisTurn || isUnavailableThisTurn ? (
          <div
            className={`pointer-events-none absolute right-2 top-2 z-10 border border-[#7c5941] bg-[rgba(58,31,24,0.82)] ${isFocus ? "px-2 py-1 text-[10px]" : "px-1.5 py-0.5 text-[9px]"} font-medium text-[#f0c1a2]`}
          >
            {t(
              isUsedThisTurn
                ? "board.status.cardUsedTag"
                : "board.status.cardUnavailableTag",
            )}
          </div>
        ) : null}
        <div
          data-testid={testId ? `${testId}-shell` : undefined}
          data-selected-outline={showSelectedState ? "true" : undefined}
          data-tutorial-target-outline={
            showTutorialTarget ? "true" : undefined
          }
          data-modifier-outline={
            showRollModifierTarget && !showSelectedState ? "true" : undefined
          }
          data-event-roll-book-outline={
            showEventRollBookTarget && !showSelectedState ? "true" : undefined
          }
          data-rules-summary={rulesSummary}
          className={`relative flex w-full flex-col overflow-hidden ${shellRadiusClass} ${outerRingClass} border ${
            showSelectedState
              ? "border-[#eecc7e] bg-transparent"
              : frontVisual
                ? isCompact
                  ? "border-[rgba(120,105,76,0.18)] bg-[rgba(10,8,6,0.18)]"
                  : "border-[rgba(60,47,32,0.82)] bg-[rgba(10,8,6,0.96)]"
                : isCompact
                  ? "border-[rgba(98,92,71,0.18)] bg-[rgba(13,15,11,0.18)]"
                  : tone.cardSurfaceClass
          } ${!isPreview && (isUsedThisTurn || isUnavailableThisTurn || isCardDisabled) ? "opacity-60" : ""}`}
          style={{
            aspectRatio: BETRAYAL_POSSESSION_CARD_SHELL_ASPECT_RATIO,
            ...(showSelectedState
              ? {
                  borderColor: "#eecc7e",
                  borderStyle: "solid",
                  borderWidth: "1px",
                }
              : {}),
          }}
        >
          {frontVisual ? (
            <>
              <div
                className={`absolute overflow-hidden ${
                  isCompact
                    ? "inset-[3px] rounded-[5px] bg-transparent"
                    : "inset-0 bg-[rgba(10,8,6,0.96)]"
                }`}
              >
                <PossessionAtlasFrame
                  visual={frontVisual}
                  locale={locale}
                  alt={item.name}
                  testId={testId ? `${testId}-front-atlas` : undefined}
                />
                {isTradeCompact ? null : (
                  <div
                    className={`pointer-events-none absolute inset-0 ${
                      isCompact
                        ? "bg-[linear-gradient(180deg,rgba(0,0,0,0.02),rgba(0,0,0,0.02)_50%,rgba(7,6,5,0.1)_78%,rgba(7,6,5,0.54))]"
                        : "bg-[linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.02)_30%,rgba(0,0,0,0.08)_66%,rgba(7,6,5,0.72))]"
                    }`}
                  />
                )}
              </div>
              <div
                className={`pointer-events-none absolute inset-0 ring-1 ring-inset ${
                  isCompact
                    ? "ring-[rgba(227,206,170,0.04)]"
                    : "ring-[rgba(227,206,170,0.14)]"
                }`}
              />
            </>
          ) : (
            <>
              <div
                className={`absolute overflow-hidden ${
                  isCompact ? "inset-[3px] rounded-[5px]" : "inset-0"
                }`}
              >
                {isCompact ? (
                  <>
                    <OptimizedImage
                      src={backAsset}
                      locale={locale}
                      alt=""
                      className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.16]"
                      draggable={false}
                    />
                    <div
                      className={`pointer-events-none absolute inset-0 ${
                        item.kind === "item"
                          ? "bg-[radial-gradient(circle_at_50%_24%,rgba(230,186,159,0.12),transparent_34%),linear-gradient(180deg,rgba(42,22,18,0.94),rgba(17,11,10,0.98))]"
                          : "bg-[radial-gradient(circle_at_50%_24%,rgba(194,232,178,0.1),transparent_34%),linear-gradient(180deg,rgba(24,40,25,0.94),rgba(12,20,13,0.98))]"
                      }`}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.01),rgba(255,255,255,0.01)_40%,rgba(7,7,6,0.16)_58%,rgba(7,7,6,0.78))]" />
                  </>
                ) : (
                  <>
                    <div className="pointer-events-none absolute inset-0 bg-[rgba(11,12,10,0.96)]" />
                    <OptimizedImage
                      src={backAsset}
                      locale={locale}
                      alt=""
                      className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.18]"
                      draggable={false}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(239,226,188,0.1),transparent_34%),linear-gradient(180deg,rgba(14,15,11,0.5),rgba(8,10,7,0.82)_54%,rgba(7,6,5,0.94))]" />
                  </>
                )}
              </div>
              <div
                className={`pointer-events-none absolute border ${tone.frameClass} ${
                  isCompact
                    ? "inset-[3px] rounded-[5px] opacity-36"
                    : "inset-[8px] rounded-[8px] opacity-90"
                }`}
              />
              {isPreview || isFocus ? (
                <div
                  className={`pointer-events-none absolute inset-x-[14px] top-1/2 -translate-y-1/2 text-center font-semibold ${isPreview ? "text-[24px] leading-[28px]" : "text-[18px] leading-[22px]"} ${tone.nameClass} drop-shadow-[0_2px_4px_rgba(0,0,0,0.72)]`}
                >
                  {item.name}
                </div>
              ) : null}
            </>
          )}
          {isCompact ? (
            <>
              <div className="relative flex-1" />
              <div
                className={`relative mt-auto ${isTradeCompact && frontVisual ? "px-1 pb-1" : isCompactDenseOmen ? "px-1 pb-1" : "px-2 pb-2"} ${
                  frontVisual
                    ? "pt-2"
                    : isCompactDenseOmen
                      ? "pt-0.5"
                      : isDenseNoFrontCompact
                        ? "pt-1.5"
                        : "pt-2.5"
                } ${
                  frontVisual
                    ? isTradeCompact
                      ? "bg-transparent"
                      : "bg-[linear-gradient(180deg,rgba(8,7,6,0),rgba(8,7,6,0.08)_56%,rgba(8,7,6,0.7))]"
                    : "bg-[linear-gradient(180deg,rgba(8,7,6,0),rgba(8,7,6,0.18)_46%,rgba(8,7,6,0.82))]"
                }`}
              >
                <div className="min-w-0">
                  <div
                    className={`${
                      isTradeCompact && frontVisual
                        ? "sr-only"
                        : isCompactDenseOmen
                          ? "min-h-[26px] rounded-[4px] border border-[rgba(177,201,161,0.14)] bg-[rgba(234,226,206,0.92)] px-1 py-[3px] text-[8px] leading-[9px] line-clamp-2 text-[#2f291e] drop-shadow-none"
                          : isDenseNoFrontCompact
                            ? "min-h-[18px] truncate whitespace-nowrap text-[9px] leading-[10px]"
                            : "min-h-[26px] text-[11px] leading-[12px]"
                    } font-semibold ${isCompactDenseOmen ? "" : "text-[#ede2c8] drop-shadow-[0_1px_2px_rgba(0,0,0,0.62)]"}`}
                  >
                    {item.name}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div
                className={`relative flex items-center justify-between ${isPreview ? "px-4 pt-4" : "px-3 pt-3"}`}
              >
                <span
                  className={`inline-flex rounded-full border ${isPreview ? "px-2.5 py-1 text-[10px]" : isFocus ? "px-2.5 py-1 text-[10px]" : "px-2 py-0.5 text-[9px]"} uppercase tracking-[0.12em] ${tone.badgeClass}`}
                >
                  {item.kind === "item"
                    ? t("board.inventory.item")
                    : t("board.inventory.omen")}
                </span>
                <span
                  className={`inline-flex ${isPreview ? "h-8 w-8" : isFocus ? "h-7 w-7" : "h-6 w-6"} items-center justify-center rounded-full border ${
                    frontVisual
                      ? "border-[rgba(227,206,170,0.28)] bg-[rgba(14,12,10,0.78)]"
                      : tone.frameClass
                  }`}
                >
                  <OptimizedImage
                    src={accentAsset}
                    locale={locale}
                    alt=""
                    className={
                      isPreview
                        ? "h-5 w-5 object-contain opacity-90"
                        : isFocus
                          ? "h-[18px] w-[18px] object-contain opacity-90"
                          : "h-4 w-4 object-contain opacity-90"
                    }
                    draggable={false}
                  />
                </span>
              </div>
              <div
                className={`relative flex flex-1 items-end justify-start ${isPreview ? "px-6 py-5" : isFocus ? "px-4 py-4" : "px-4 py-3"}`}
              />
              <div
                className={`${isPreview ? "px-4 pb-4 pt-2" : isFocus ? "px-4 pb-4 pt-2.5" : "px-3 pb-3 pt-1.5"} relative`}
              >
                <div className={titleClass}>{item.name}</div>
                {frontVisual ? null : (
                  <div
                    className={`${isPreview ? "mt-2 text-[11px]" : isFocus ? "mt-2 text-[11px]" : "mt-1.5 text-[10px]"} uppercase tracking-[0.1em] ${tone.accentClass}`}
                  >
                    {item.kind === "item"
                      ? t("board.inventory.item")
                      : t("board.inventory.omen")}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </button>
      {!isPreview && resolvedDisabledReason && testId ? (
        <div
          data-testid={`${testId}-disabled-reason`}
          className={`pointer-events-none mt-1 rounded-[4px] border border-[rgba(196,112,78,0.42)] bg-[rgba(58,31,24,0.72)] px-1.5 py-1 text-center font-semibold leading-tight text-[#f0c1a2] shadow-[0_4px_10px_rgba(0,0,0,0.20)] ${
            isCompact ? "text-[9px]" : "text-[11px]"
          }`}
        >
          {resolvedDisabledReason}
        </div>
      ) : null}
      {!isPreview && testId ? (
        <button
          type="button"
          data-testid={`${testId}-magnify`}
          aria-label={`放大查看${item.name}`}
          title={`放大查看${item.name}`}
          onClick={(event) => {
            event.stopPropagation();
            onPreview?.(item.id);
          }}
          className={`pointer-events-auto absolute ${isCompact ? "right-1 top-1 h-7 w-7" : "right-2 top-2 h-8 w-8"} z-[80] inline-flex items-center justify-center rounded-[5px] border border-[rgba(238,204,126,0.52)] bg-[rgba(18,15,12,0.86)] text-[#f3dfab] opacity-100 shadow-[0_8px_18px_rgba(0,0,0,0.34)] transition hover:border-[#f1d68d] hover:bg-[rgba(35,27,18,0.94)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#efd17c] md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100`}
        >
          <Search size={isCompact ? 13 : 16} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
