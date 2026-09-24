import React from "react";
import { useTranslation } from "react-i18next";

import type {
  BetrayalExplorerSummary,
  BetrayalInventoryCard,
} from "./game";
import { BetrayalInventoryCardSurface } from "./inventoryCardSurface";
import type {
  BetrayalTraitAssetMap,
  InventoryCardBackAssetMap,
} from "./inventoryPresentation";
import type { BetrayalTradeCardStatus } from "./trade";

type BetrayalInventoryRailSurfaceProps = {
  explorer: BetrayalExplorerSummary;
  cards: BetrayalInventoryCard[];
  isReadOnly: boolean;
  isObservedOther: boolean;
  ownerLabel: string | null;
  selectedDisplayText: string;
  hasSelectedDisplay: boolean;
  lastUsedInventoryCardStillUsed: boolean;
  useStatusText: string;
  isDimmed: boolean;
  elevatedForRollModifier: boolean;
  usedCardIdsThisTurn: readonly string[];
  availableCardIdsThisTurn: readonly string[];
  isTradeDraftActive: boolean;
  rollModifierCardIds: ReadonlySet<string>;
  eventRollBookCardIds: ReadonlySet<string>;
  isTutorialUseBookActive: boolean;
  deckAssets: InventoryCardBackAssetMap;
  traitAssets: BetrayalTraitAssetMap;
  locale: string;
  resolveCardSelected: (cardId: string) => boolean;
  resolveTradeStatus: (cardId: string) => BetrayalTradeCardStatus | null;
  onUseBookForEventRoll: (cardId: string) => void;
  onPrimarySelect: (cardId: string) => void;
  onPreview: (cardId: string) => void;
};

export function BetrayalInventoryRailSurface({
  explorer,
  cards,
  isReadOnly,
  isObservedOther,
  ownerLabel,
  selectedDisplayText,
  hasSelectedDisplay,
  lastUsedInventoryCardStillUsed,
  useStatusText,
  isDimmed,
  elevatedForRollModifier,
  usedCardIdsThisTurn,
  availableCardIdsThisTurn,
  isTradeDraftActive,
  rollModifierCardIds,
  eventRollBookCardIds,
  isTutorialUseBookActive,
  deckAssets,
  traitAssets,
  locale,
  resolveCardSelected,
  resolveTradeStatus,
  onUseBookForEventRoll,
  onPrimarySelect,
  onPreview,
}: BetrayalInventoryRailSurfaceProps) {
  const { t } = useTranslation("game-betrayal");
  const itemCards = cards.filter((item) => item.kind === "item");
  const omenCards = cards.filter((item) => item.kind === "omen");
  const rowClassName = (count: number) =>
    `${count === 0 ? "pointer-events-none flex" : "flex"} max-w-[calc(62px*5.35+0.5rem*4)] min-h-[92px] items-end gap-2 overflow-x-auto overflow-y-hidden px-1 pb-2 pt-1 min-w-0 smashup-h-scrollbar`;
  const renderCards = (
    groupCards: BetrayalInventoryCard[],
    kind: "item" | "omen",
  ) =>
    groupCards.map((item, index) => (
      <BetrayalInventoryCardSurface
        key={`inventory-${kind}-${item.id}-${index}`}
        item={item}
        layout="compact"
        testId={`betrayal-inventory-${item.id}`}
        compactDenseNoFront={kind === "omen"}
        readOnly={isReadOnly}
        selected={resolveCardSelected(item.id)}
        usedThisTurn={usedCardIdsThisTurn.includes(item.id)}
        availableThisTurn={availableCardIdsThisTurn.includes(item.id)}
        tradeStatus={resolveTradeStatus(item.id)}
        tradeCompact={isTradeDraftActive}
        canModifyRecentRoll={
          rollModifierCardIds.has(item.id) || eventRollBookCardIds.has(item.id)
        }
        canUseBookForEventRoll={eventRollBookCardIds.has(item.id)}
        tutorialTarget={isTutorialUseBookActive && item.id === "omen-book"}
        deckAssets={deckAssets}
        traitAssets={traitAssets}
        locale={locale}
        onUseBookForEventRoll={onUseBookForEventRoll}
        onPrimarySelect={onPrimarySelect}
        onPreview={onPreview}
      />
    ));

  return (
    <div
      id="betrayal-inventory-section"
      data-testid="betrayal-inventory-section"
      data-tutorial-id="betrayal-inventory-zone"
      data-player-id={explorer.playerId}
      data-observed-player={isObservedOther ? "true" : "false"}
      className={`pointer-events-none absolute ${
        elevatedForRollModifier ? "z-[150]" : "z-40"
      } bottom-2 left-1 mt-0 w-[calc(62px*5.35+0.5rem*4+0.75rem)] max-w-[calc(62px*5.35+0.5rem*4+0.75rem)] px-0 ${
        isDimmed ? "opacity-[0.72]" : ""
      }`}
    >
      <div
        className="mb-1 flex items-center justify-between gap-3 px-1 pr-4"
      >
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#a89d84]">
          <span className="h-px w-3 bg-[rgba(214,191,129,0.22)]" />
          {t("board.sections.inventory")}
          {ownerLabel ? (
            <span
              data-testid="betrayal-inventory-owner-label"
              className="max-w-[130px] truncate text-[#d8bf81]"
            >
              {ownerLabel}
            </span>
          ) : null}
          <span className="h-px w-8 bg-[rgba(214,191,129,0.12)]" />
        </div>
        <div className="sr-only">
          {hasSelectedDisplay
            ? t("board.status.selectedCard", { card: selectedDisplayText })
            : t("board.status.noSelectedCard")}
        </div>
        <div className="sr-only" data-testid="betrayal-use-status">
          {useStatusText}
        </div>
      </div>
      <div
        className="grid gap-2 px-1 pr-2"
      >
        <section data-testid="betrayal-inventory-group-item">
          <div
            className={rowClassName(itemCards.length)}
            data-testid="betrayal-inventory-row-item"
          >
            {renderCards(itemCards, "item")}
          </div>
        </section>
        <section data-testid="betrayal-inventory-group-omen">
          <div
            className={rowClassName(omenCards.length)}
            data-testid="betrayal-inventory-row-omen"
          >
            {renderCards(omenCards, "omen")}
          </div>
        </section>
      </div>
      {!isReadOnly && (!lastUsedInventoryCardStillUsed || hasSelectedDisplay) ? (
        <div
          className="sr-only"
          data-testid="betrayal-selected-inventory-card-name"
        >
          {hasSelectedDisplay
            ? selectedDisplayText
            : t("board.status.noSelectedCard")}
        </div>
      ) : null}
    </div>
  );
}
