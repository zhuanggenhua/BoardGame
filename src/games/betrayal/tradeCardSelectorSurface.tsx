import React from "react";
import { Handshake } from "lucide-react";

import type {
  BetrayalDeckKind,
  BetrayalInventoryCard,
  BetrayalTraitKey,
} from "./game";
import {
  BetrayalConfirmButton,
  BetrayalSecondaryButton,
} from "./confirmButtonSurface";
import { BetrayalInventoryCardSurface } from "./inventoryCardSurface";
import type { BetrayalTradeCardStatus } from "./trade";

type BetrayalTradeCardSelectorSurfaceProps = {
  testId: string;
  currentFlowChoice: string;
  label: string;
  cards: readonly BetrayalInventoryCard[];
  selectedCardIds: readonly string[];
  cardTestIdPrefix: string;
  isTradeDraftActive: boolean;
  rollModifierCardIds: ReadonlySet<string>;
  eventRollBookCardIds: ReadonlySet<string>;
  isTutorialUseBookActive: boolean;
  deckAssets: Record<BetrayalDeckKind, string>;
  traitAssets: Record<BetrayalTraitKey, string>;
  locale: string;
  resolveTradeStatus: (card: BetrayalInventoryCard) => BetrayalTradeCardStatus;
  onToggleCard: (cardId: string) => void;
  onUseBookForEventRoll: (cardId: string) => void;
  onPrimarySelect: (cardId: string) => void;
  onPreview: (cardId: string) => void;
};

export function BetrayalTradeCardSelectorSurface({
  testId,
  currentFlowChoice,
  label,
  cards,
  selectedCardIds,
  cardTestIdPrefix,
  isTradeDraftActive,
  rollModifierCardIds,
  eventRollBookCardIds,
  isTutorialUseBookActive,
  deckAssets,
  traitAssets,
  locale,
  resolveTradeStatus,
  onToggleCard,
  onUseBookForEventRoll,
  onPrimarySelect,
  onPreview,
}: BetrayalTradeCardSelectorSurfaceProps) {
  return (
    <div
      data-testid={testId}
      data-current-flow-choice={currentFlowChoice}
      className="pointer-events-auto flex max-w-[min(620px,calc(100vw-2rem))] flex-wrap items-end justify-center gap-1.5 rounded-[8px] border border-[rgba(238,204,126,0.26)] bg-[rgba(12,13,10,0.58)] px-2 py-1.5 shadow-[0_10px_26px_rgba(0,0,0,0.24)] backdrop-blur-sm"
    >
      <span className="self-center px-1 text-[11px] font-semibold text-[#d9c68f]">
        {label}
      </span>
      {cards.map((card, index) => (
        <BetrayalInventoryCardSurface
          key={`${cardTestIdPrefix}-${card.id}-${index}`}
          item={card}
          layout="compact"
          testId={`${cardTestIdPrefix}-${card.id}`}
          compactDenseNoFront={card.kind === "omen"}
          selected={selectedCardIds.includes(card.id)}
          showTurnStatus={false}
          tradeStatus={resolveTradeStatus(card)}
          tradeCompact={isTradeDraftActive}
          canModifyRecentRoll={
            rollModifierCardIds.has(card.id) || eventRollBookCardIds.has(card.id)
          }
          canUseBookForEventRoll={eventRollBookCardIds.has(card.id)}
          tutorialTarget={isTutorialUseBookActive && card.id === "omen-book"}
          deckAssets={deckAssets}
          traitAssets={traitAssets}
          locale={locale}
          onSelect={() => onToggleCard(card.id)}
          onUseBookForEventRoll={onUseBookForEventRoll}
          onPrimarySelect={onPrimarySelect}
          onPreview={onPreview}
        />
      ))}
    </div>
  );
}

type BetrayalSicknessExchangeBannerSurfaceProps = {
  isPendingForViewer: boolean;
  isPendingFromViewer: boolean;
  instructionText: string;
  targetStepText: string;
  acceptLabel: string;
  declineLabel: string;
  waitingLabel: string;
  onAccept: () => void;
  onDecline: () => void;
};

export function BetrayalSicknessExchangeBannerSurface({
  isPendingForViewer,
  isPendingFromViewer,
  instructionText,
  targetStepText,
  acceptLabel,
  declineLabel,
  waitingLabel,
  onAccept,
  onDecline,
}: BetrayalSicknessExchangeBannerSurfaceProps) {
  const exchangeState = isPendingForViewer
    ? "incoming"
    : isPendingFromViewer
      ? "waiting"
      : "observing";

  return (
    <div
      data-testid="betrayal-sickness-exchange-banner"
      data-sickness-exchange-state={exchangeState}
      className="pointer-events-auto flex max-w-[760px] flex-wrap items-center justify-center gap-2 rounded-[8px] border border-[rgba(238,204,126,0.38)] bg-[rgba(18,17,13,0.78)] px-3 py-2 text-[12px] font-semibold tracking-[0.05em] text-[#f3e0a6] shadow-[0_12px_28px_rgba(0,0,0,0.30),0_0_22px_rgba(238,204,126,0.16)]"
      style={{
        border: "1px solid rgba(238,204,126,0.38)",
        boxShadow:
          "0 12px 28px rgba(0,0,0,0.30), 0 0 22px rgba(238,204,126,0.16)",
        textShadow:
          "0 1px 2px rgba(0,0,0,0.85), 0 0 12px rgba(238,204,126,0.36)",
      }}
    >
      <Handshake size={15} strokeWidth={2.4} />
      <span data-testid="betrayal-sickness-exchange-step">
        {instructionText}
      </span>
      <span
        data-testid="betrayal-sickness-exchange-target-step"
        className="text-[#fff1b8]"
      >
        {targetStepText}
      </span>
      {isPendingForViewer ? (
        <div
          data-testid="betrayal-sickness-exchange-panel"
          className="ml-1 flex items-center gap-2"
        >
          <BetrayalConfirmButton
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAccept();
            }}
            data-testid="betrayal-sickness-exchange-accept"
            className="min-h-[34px] px-3 py-1 text-[12px] tracking-[0.05em] shadow-[0_0_16px_rgba(215,193,111,0.22)]"
          >
            {acceptLabel}
          </BetrayalConfirmButton>
          <BetrayalSecondaryButton
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDecline();
            }}
            data-testid="betrayal-sickness-exchange-decline"
            className="min-h-[34px] px-3 py-1 text-[12px] tracking-[0.05em]"
          >
            {declineLabel}
          </BetrayalSecondaryButton>
        </div>
      ) : (
        <span
          data-testid="betrayal-sickness-exchange-waiting"
          className="text-[11px] uppercase tracking-[0.14em] text-[#bba979]"
        >
          {waitingLabel}
        </span>
      )}
    </div>
  );
}

type BetrayalTradeActionPanelSurfaceProps = {
  instructionText: string;
  targetStepText: string;
  showInlineTradeConfirm: boolean;
  showTradeAgreementActions: boolean;
  requestLabel: string;
  acceptLabel: string;
  declineLabel: string;
  onRequest: () => void;
  onAccept: () => void;
  onDecline: () => void;
};

export function BetrayalTradeActionPanelSurface({
  instructionText,
  targetStepText,
  showInlineTradeConfirm,
  showTradeAgreementActions,
  requestLabel,
  acceptLabel,
  declineLabel,
  onRequest,
  onAccept,
  onDecline,
}: BetrayalTradeActionPanelSurfaceProps) {
  return (
    <div
      data-testid="betrayal-trade-action-panel"
      data-prompt-actions-for="betrayal-trade-flow-banner"
      className="pointer-events-auto flex max-w-[760px] flex-wrap items-center justify-center gap-2 rounded-[8px] border border-[rgba(238,204,126,0.34)] bg-[rgba(18,17,13,0.66)] px-3 py-2 text-[12px] font-semibold tracking-[0.05em] text-[#f3e0a6] shadow-[0_12px_26px_rgba(0,0,0,0.24),0_0_18px_rgba(238,204,126,0.12)]"
      style={{
        border: "1px solid rgba(238,204,126,0.34)",
        boxShadow:
          "0 12px 26px rgba(0,0,0,0.24), 0 0 18px rgba(238,204,126,0.12)",
        textShadow:
          "0 1px 2px rgba(0,0,0,0.85), 0 0 12px rgba(238,204,126,0.36)",
      }}
    >
      <div
        data-testid="betrayal-trade-offer-summary"
        data-trade-summary-role="proposal-detail"
        className="flex min-h-[38px] max-w-[460px] items-center gap-2 rounded-[6px] border border-[rgba(238,204,126,0.20)] bg-[rgba(8,9,7,0.36)] px-3 py-1.5"
      >
        <span
          data-testid="betrayal-trade-flow-item-step"
          className="min-w-0 truncate leading-snug text-[#e3d2a1]"
        >
          {instructionText}
        </span>
        <span className="text-[10px] text-[#8f7f5f]" aria-hidden="true">
          |
        </span>
        <span
          data-testid="betrayal-trade-flow-target-step"
          className="shrink-0 font-bold text-[#fff1b8]"
        >
          {targetStepText}
        </span>
      </div>
      {showInlineTradeConfirm ? (
        <BetrayalConfirmButton
          type="button"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onPointerUp={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            onRequest();
          }}
          data-testid="betrayal-action-trade"
          data-trade-confirm-placement="bottom-action-panel"
          data-trade-confirm-role="proposal-submit"
          className="min-w-[132px] px-5 text-[15px] tracking-[0.08em] shadow-[0_0_18px_rgba(215,193,111,0.24)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fff1b8]"
        >
          <Handshake size={17} strokeWidth={2.4} />
          <span>{requestLabel}</span>
        </BetrayalConfirmButton>
      ) : null}
      {showTradeAgreementActions ? (
        <div
          data-testid="betrayal-trade-agreement-panel"
          className="flex items-center gap-2"
        >
          <BetrayalConfirmButton
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAccept();
            }}
            data-testid="betrayal-trade-agreement-accept"
            className="min-w-[112px] px-5 text-[15px] shadow-[0_0_16px_rgba(215,193,111,0.22)]"
          >
            {acceptLabel}
          </BetrayalConfirmButton>
          <BetrayalSecondaryButton
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDecline();
            }}
            data-testid="betrayal-trade-agreement-decline"
            className="min-w-[112px] px-5 text-[15px]"
          >
            {declineLabel}
          </BetrayalSecondaryButton>
        </div>
      ) : null}
    </div>
  );
}

type BetrayalMobileTradeRequestPanelSurfaceProps = {
  instructionText: string;
  targetStepText: string;
  requestLabel: string;
  onRequest: () => void;
};

export function BetrayalMobileTradeRequestPanelSurface({
  instructionText,
  targetStepText,
  requestLabel,
  onRequest,
}: BetrayalMobileTradeRequestPanelSurfaceProps) {
  return (
    <div
      data-testid="betrayal-mobile-trade-action-panel"
      data-prompt-actions-for="betrayal-trade-flow-banner"
      className="mt-2 grid gap-2"
    >
      <div
        data-testid="betrayal-mobile-trade-offer-summary"
        data-trade-summary-role="proposal-detail"
        className="grid gap-1 rounded-[7px] border border-[rgba(238,204,126,0.22)] bg-[rgba(8,9,7,0.34)] px-2.5 py-2 text-[11px] font-semibold text-[#e3d2a1]"
      >
        <span data-testid="betrayal-trade-flow-item-step">
          {instructionText}
        </span>
        <span
          data-testid="betrayal-trade-flow-target-step"
          className="font-bold text-[#fff1b8]"
        >
          {targetStepText}
        </span>
      </div>
      <BetrayalConfirmButton
        type="button"
        onClick={onRequest}
        data-testid="betrayal-mobile-trade-flow-confirm"
        data-trade-confirm-role="proposal-submit"
        className="min-h-[42px] w-full px-3 text-[12px] tracking-[0.06em] shadow-[0_0_16px_rgba(215,193,111,0.20)]"
      >
        {requestLabel}
      </BetrayalConfirmButton>
    </div>
  );
}

type BetrayalMobileSicknessExchangePanelSurfaceProps = {
  isPendingForViewer: boolean;
  acceptLabel: string;
  declineLabel: string;
  waitingLabel: string;
  onAccept: () => void;
  onDecline: () => void;
};

export function BetrayalMobileSicknessExchangePanelSurface({
  isPendingForViewer,
  acceptLabel,
  declineLabel,
  waitingLabel,
  onAccept,
  onDecline,
}: BetrayalMobileSicknessExchangePanelSurfaceProps) {
  return (
    <div
      data-testid="betrayal-mobile-sickness-exchange-panel"
      className="mt-2 flex items-center gap-2"
    >
      {isPendingForViewer ? (
        <>
          <BetrayalConfirmButton
            type="button"
            onClick={onAccept}
            data-testid="betrayal-mobile-sickness-exchange-accept"
            className="min-h-[42px] flex-1 px-2 text-[12px]"
          >
            {acceptLabel}
          </BetrayalConfirmButton>
          <BetrayalSecondaryButton
            type="button"
            onClick={onDecline}
            data-testid="betrayal-mobile-sickness-exchange-decline"
            className="min-h-[42px] flex-1 px-2 text-[12px]"
          >
            {declineLabel}
          </BetrayalSecondaryButton>
        </>
      ) : (
        <span
          data-testid="betrayal-mobile-sickness-exchange-waiting"
          className="text-[11px] font-semibold text-[#d9c68d]"
        >
          {waitingLabel}
        </span>
      )}
    </div>
  );
}

type BetrayalMobileTradeAgreementPanelSurfaceProps = {
  instructionText: string;
  targetStepText: string;
  isPendingForViewer: boolean;
  acceptLabel: string;
  declineLabel: string;
  waitingLabel: string;
  onAccept: () => void;
  onDecline: () => void;
};

export function BetrayalMobileTradeAgreementPanelSurface({
  instructionText,
  targetStepText,
  isPendingForViewer,
  acceptLabel,
  declineLabel,
  waitingLabel,
  onAccept,
  onDecline,
}: BetrayalMobileTradeAgreementPanelSurfaceProps) {
  return (
    <div
      data-testid="betrayal-mobile-trade-agreement-panel"
      className="mt-2 grid gap-2"
    >
      <div
        data-testid="betrayal-mobile-trade-offer-summary"
        data-trade-summary-role="proposal-detail"
        className="grid gap-1 rounded-[7px] border border-[rgba(238,204,126,0.22)] bg-[rgba(8,9,7,0.34)] px-2.5 py-2 text-[11px] font-semibold text-[#e3d2a1]"
      >
        <span data-testid="betrayal-trade-flow-item-step">
          {instructionText}
        </span>
        <span
          data-testid="betrayal-trade-flow-target-step"
          className="font-bold text-[#fff1b8]"
        >
          {targetStepText}
        </span>
      </div>
      {isPendingForViewer ? (
        <div className="flex items-center gap-2">
          <BetrayalConfirmButton
            type="button"
            onClick={onAccept}
            data-testid="betrayal-mobile-trade-agreement-accept"
            className="flex-1 px-2 text-[12px]"
          >
            {acceptLabel}
          </BetrayalConfirmButton>
          <BetrayalSecondaryButton
            type="button"
            onClick={onDecline}
            data-testid="betrayal-mobile-trade-agreement-decline"
            className="min-h-[42px] flex-1 px-2 text-[12px]"
          >
            {declineLabel}
          </BetrayalSecondaryButton>
        </div>
      ) : (
        <span
          data-testid="betrayal-mobile-trade-agreement-waiting"
          className="text-[11px] font-semibold text-[#d9c68d]"
        >
          {waitingLabel}
        </span>
      )}
    </div>
  );
}
