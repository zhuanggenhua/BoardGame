import { useTranslation } from "react-i18next";

import { HudPortal, UI_Z_INDEX } from "../../core";
import type {
  BetrayalCore,
  BetrayalExplorerSummary,
  BetrayalInventoryCard,
  BetrayalRoomNode,
  BetrayalTraitKey,
} from "./game";
import type { BetrayalAttackWeaponCardStatus } from "./attackRules";
import {
  ExplorerTraitOutcomePreview,
  TRAIT_CHOICE_TONE_CLASS,
  TRAIT_LABEL_LOCAL,
} from "./traitTrackSurface";

type DustHauntTraitSelectorState = {
  actionId: string;
  choices: readonly BetrayalTraitKey[];
  selectedTrait: BetrayalTraitKey | null;
  testIdPrefix: string;
};

type HealTargetOption = {
  playerId: string;
  displayName: string;
  selected: boolean;
};

type MaskTargetToken = {
  id: string;
  name: string;
};

type ExploreDeclarationOptions = {
  label: string;
  canDeclareHolySymbolExplore: boolean;
  useHolySymbolForExplore: boolean;
  canDeclareIdolExplore: boolean;
  useIdolForExplore: boolean;
  canDeclareTraitorEventSkip: boolean;
  ignoreEventSymbolWithTraitorPower: boolean;
};

export function BetrayalTableActionCueSurface({
  hidden,
  forceVisible,
  phase,
  isPhoneLandscapeLayout,
  roomFocusLabel,
  tradeStatusCueLabel,
  dustHauntTraitSelector,
  inventoryTargetRooms,
  selectedInventoryTargetRoomId,
  healTargetOptions,
  selectedHealCardName,
  rollTotalReplacementOptions,
  selectedInventoryReplacementRollTotal,
  selectedInventoryHealPreviewExplorer,
  selectedInventoryHealPreviewTraits,
  attackWeaponCardStatuses,
  selectedAttackWeaponCardId,
  selectedCorpseLootTarget,
  selectedCorpseLootCardId,
  exploreDeclarationOptions,
  maskTargetTokens,
  maskTargetRooms,
  activeMaskTargetTokenId,
  selectedMaskTargetRoomIdsByTokenId,
  locale,
  onSelectDustHauntTrait,
  onSelectInventoryReplacementRollTotal,
  onSelectAttackWeapon,
  onSelectCorpseLootCard,
  onToggleHolySymbolExplore,
  onToggleIdolExplore,
  onToggleTraitorEventSkip,
}: {
  hidden: boolean;
  forceVisible: boolean;
  phase: BetrayalCore["phase"];
  isPhoneLandscapeLayout: boolean;
  roomFocusLabel: string | null;
  tradeStatusCueLabel: string | null;
  dustHauntTraitSelector: DustHauntTraitSelectorState | null;
  inventoryTargetRooms: BetrayalRoomNode[];
  selectedInventoryTargetRoomId: string | null;
  healTargetOptions: HealTargetOption[];
  selectedHealCardName: string | null;
  rollTotalReplacementOptions: number[];
  selectedInventoryReplacementRollTotal: number | null;
  selectedInventoryHealPreviewExplorer: BetrayalExplorerSummary | null;
  selectedInventoryHealPreviewTraits: BetrayalTraitKey[];
  attackWeaponCardStatuses: BetrayalAttackWeaponCardStatus[];
  selectedAttackWeaponCardId: string | null;
  selectedCorpseLootTarget: BetrayalExplorerSummary | null;
  selectedCorpseLootCardId: string | null;
  exploreDeclarationOptions: ExploreDeclarationOptions | null;
  maskTargetTokens: MaskTargetToken[];
  maskTargetRooms: BetrayalRoomNode[];
  activeMaskTargetTokenId: string | null;
  selectedMaskTargetRoomIdsByTokenId: Record<string, string>;
  locale: string;
  onSelectDustHauntTrait: (
    actionId: string,
    trait: BetrayalTraitKey,
  ) => void;
  onSelectInventoryReplacementRollTotal: (total: number) => void;
  onSelectAttackWeapon: (cardId: string | null) => void;
  onSelectCorpseLootCard: (cardId: string) => void;
  onToggleHolySymbolExplore: () => void;
  onToggleIdolExplore: () => void;
  onToggleTraitorEventSkip: () => void;
}) {
  const { t } = useTranslation("game-betrayal");
  const hasExploreDeclarationOptions = Boolean(exploreDeclarationOptions);
  const shouldShowMaskTargetSelector =
    maskTargetTokens.length > 0 && maskTargetRooms.length > 0;
  const hasVisibleCue =
    forceVisible ||
    Boolean(roomFocusLabel) ||
    Boolean(tradeStatusCueLabel) ||
    Boolean(dustHauntTraitSelector) ||
    inventoryTargetRooms.length > 0 ||
    healTargetOptions.length > 0 ||
    rollTotalReplacementOptions.length > 0 ||
    Boolean(selectedInventoryHealPreviewExplorer) ||
    attackWeaponCardStatuses.length > 0 ||
    Boolean(selectedCorpseLootTarget) ||
    hasExploreDeclarationOptions ||
    shouldShowMaskTargetSelector;

  if (hidden || !hasVisibleCue) {
    return null;
  }

  const content = (
    <div
      className={`${
        hasExploreDeclarationOptions
          ? "pointer-events-none"
          : "pointer-events-auto absolute left-1/2 z-50 -translate-x-1/2"
      } flex w-[min(880px,calc(100vw-2rem))] flex-wrap items-center justify-center gap-1.5 px-2 pb-1 pt-1 ${
        phase === "haunt"
          ? isPhoneLandscapeLayout
            ? "top-[88px]"
            : "top-[204px]"
          : "top-[86px]"
      }`}
      style={
        hasExploreDeclarationOptions
          ? {
              position: "fixed",
              left: "50%",
              top: phase === "haunt" ? (isPhoneLandscapeLayout ? 88 : 204) : 86,
              transform: "translateX(-50%)",
              zIndex: UI_Z_INDEX.hud + 20,
            }
          : undefined
      }
    >
      {roomFocusLabel ? (
        <span
          data-testid="betrayal-room-focus-target"
          data-role="status"
          className="rounded-none border-0 bg-transparent px-0 py-0 text-[12px] font-semibold text-[#eef4a8] underline decoration-[#c9a35e] decoration-2 underline-offset-4 shadow-none transition hover:text-[#f6ffc4]"
        >
          {roomFocusLabel}
        </span>
      ) : null}
      {tradeStatusCueLabel ? (
        <span
          data-testid="betrayal-room-trade-status-cue"
          data-role="status"
          className="rounded-none border-0 bg-transparent px-0 py-0 text-[12px] font-semibold text-[#d4ead0] underline decoration-[#9fe1a7] decoration-2 underline-offset-4 shadow-none transition hover:text-[#e8f7e4]"
        >
          {tradeStatusCueLabel}
        </span>
      ) : null}
      {dustHauntTraitSelector ? (
        <div
          data-testid="betrayal-dust-trait-selector"
          data-action-id={dustHauntTraitSelector.actionId}
          className="inline-flex flex-wrap items-center gap-1 rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
        >
          <span className="px-0 text-[11px] font-semibold text-[#d9c68f]">
            {t("board.sections.traits")}
          </span>
          {dustHauntTraitSelector.choices.map((trait) => {
            const isSelected = dustHauntTraitSelector.selectedTrait === trait;
            return (
              <button
                key={trait}
                type="button"
                onClick={() =>
                  onSelectDustHauntTrait(dustHauntTraitSelector.actionId, trait)
                }
                data-testid={`${dustHauntTraitSelector.testIdPrefix}-${trait}`}
                data-selected={isSelected ? "true" : "false"}
                className={`min-h-[26px] rounded-none border px-1 text-[11px] font-semibold shadow-none transition ${
                  isSelected
                    ? TRAIT_CHOICE_TONE_CLASS[trait].selected
                    : TRAIT_CHOICE_TONE_CLASS[trait].idle
                }`}
              >
                {TRAIT_LABEL_LOCAL[trait]}
              </button>
            );
          })}
        </div>
      ) : null}
      {inventoryTargetRooms.length > 0 ? (
        <div
          data-testid="betrayal-inventory-target-room-selector"
          className="inline-flex max-w-[min(720px,calc(100vw-2rem))] flex-wrap items-center gap-1 rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
        >
          <span className="px-0 text-[11px] font-semibold text-[#d9c68f]">
            {t("board.inventory.map")}
          </span>
          {inventoryTargetRooms.map((room) => {
            const isSelectedRoom = selectedInventoryTargetRoomId === room.id;
            return (
              <span
                key={room.id}
                data-testid={`betrayal-inventory-target-room-${room.id}`}
                className={`inline-flex min-h-[26px] items-center px-1 text-[11px] font-semibold ${
                  isSelectedRoom ? "text-[#eef4a8]" : "text-[#d6c498]"
                }`}
              >
                {room.name}
              </span>
            );
          })}
        </div>
      ) : null}
      {healTargetOptions.length > 0 ? (
        <div
          data-testid="betrayal-inventory-target-player-selector"
          className="inline-flex flex-wrap items-center gap-1 rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
        >
          <span className="px-0 text-[11px] font-semibold text-[#d9c68f]">
            {t("board.inventory.healWithCard", {
              card: selectedHealCardName ?? t("board.inventory.heal"),
            })}
          </span>
          {healTargetOptions.map((option) => (
            <span
              key={option.playerId}
              data-testid={`betrayal-inventory-target-player-${option.playerId}`}
              className={`inline-flex min-h-[26px] items-center px-1 text-[11px] font-semibold ${
                option.selected ? "text-[#eef4a8]" : "text-[#d6c498]"
              }`}
            >
              {option.displayName}
            </span>
          ))}
        </div>
      ) : null}
      {rollTotalReplacementOptions.length > 0 ? (
        <div
          data-testid="betrayal-inventory-roll-total-selector"
          className="inline-grid max-w-[min(360px,calc(100vw-2rem))] grid-cols-[auto_repeat(9,1.5rem)] items-center justify-center gap-1 rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
        >
          <span className="whitespace-nowrap px-0 pr-1 text-[11px] font-semibold text-[#d9c68f]">
            {t("board.inventory.rollTotalReplacement")}
          </span>
          {rollTotalReplacementOptions.map((total) => {
            const isSelected = selectedInventoryReplacementRollTotal === total;
            return (
              <button
                key={total}
                type="button"
                onClick={() => onSelectInventoryReplacementRollTotal(total)}
                data-testid={`betrayal-inventory-roll-total-${total}`}
                data-selected={isSelected ? "true" : "false"}
                className={`flex h-6 w-6 items-center justify-center rounded-none border p-0 text-[11px] font-semibold shadow-none transition ${
                  isSelected
                    ? "border-[#e4d36f] bg-[rgba(228,211,111,0.18)] text-[#fff7b8]"
                    : "border-[rgba(214,196,152,0.32)] bg-transparent text-[#d6c498] hover:text-[#f0dfad]"
                }`}
              >
                {total}
              </button>
            );
          })}
        </div>
      ) : null}
      {selectedInventoryHealPreviewExplorer ? (
        <div
          data-testid="betrayal-inventory-heal-preview"
          data-player-id={selectedInventoryHealPreviewExplorer.playerId}
          className="grid max-w-[min(620px,calc(100vw-2rem))] grid-cols-2 gap-1.5 rounded-[9px] border border-[rgba(211,179,109,0.22)] bg-[rgba(12,14,12,0.58)] p-1.5 shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
        >
          {selectedInventoryHealPreviewTraits.map((trait) => (
            <ExplorerTraitOutcomePreview
              key={`heal-preview-${trait}`}
              explorer={selectedInventoryHealPreviewExplorer}
              trait={trait}
              mode="heal"
              phase={phase}
              stepCount={0}
              locale={locale}
              t={t}
              testIdPrefix="betrayal-inventory-heal-preview"
            />
          ))}
        </div>
      ) : null}
      {attackWeaponCardStatuses.length > 0 ? (
        <div
          data-testid="betrayal-attack-weapon-selector"
          className="inline-flex flex-wrap items-center gap-1 rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
        >
          <span className="px-0 text-[11px] font-semibold text-[#d9c68f]">
            {t("board.inventory.weapon")}
          </span>
          <button
            type="button"
            onClick={() => onSelectAttackWeapon(null)}
            data-testid="betrayal-attack-weapon-none"
            className={`min-h-[26px] rounded-none border-0 bg-transparent px-1 text-[11px] font-semibold shadow-none transition ${
              selectedAttackWeaponCardId === null
                ? "text-[#eef4a8] underline decoration-[#c9a35e] underline-offset-4"
                : "text-[#d6c498] hover:text-[#f0dfad]"
            }`}
          >
            {t("board.inventory.unarmed")}
          </button>
          {attackWeaponCardStatuses.map((status) => {
            const { card } = status;
            const isSelectedWeapon = selectedAttackWeaponCardId === card.id;
            return (
              <span
                key={card.id}
                data-testid={`betrayal-attack-weapon-option-${card.id}`}
                data-attack-weapon-can-use={status.canUse ? "true" : "false"}
                data-action-disabled-reason={status.reason ?? undefined}
                className="inline-flex items-center gap-1"
              >
                <button
                  type="button"
                  onClick={() => onSelectAttackWeapon(card.id)}
                  disabled={!status.canUse}
                  data-testid={`betrayal-attack-weapon-${card.id}`}
                  title={status.reason ?? card.name}
                  className={`min-h-[26px] rounded-none border-0 bg-transparent px-1 text-[11px] font-semibold shadow-none transition disabled:cursor-not-allowed ${
                    isSelectedWeapon
                      ? "text-[#eef4a8] underline decoration-[#c9a35e] underline-offset-4"
                      : status.canUse
                        ? "text-[#d6c498] hover:text-[#f0dfad]"
                        : "text-[#7a6a4a]"
                  }`}
                >
                  {card.name}
                </button>
                {status.reason ? (
                  <span
                    data-testid={`betrayal-attack-weapon-${card.id}-disabled-reason`}
                    className="text-[10px] font-semibold text-[#b28a75]"
                  >
                    {status.reason.replace(/。$/, "")}
                  </span>
                ) : null}
              </span>
            );
          })}
        </div>
      ) : null}
      {selectedCorpseLootTarget ? (
        <div
          data-testid="betrayal-corpse-loot-card-selector"
          className="inline-flex flex-wrap items-center gap-1 rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
        >
          <span className="px-0 text-[11px] font-semibold text-[#d9c68f]">
            {t("board.players.corpse")}
          </span>
          {selectedCorpseLootTarget.inventory.map((card: BetrayalInventoryCard) => {
            const isSelectedLootCard = selectedCorpseLootCardId === card.id;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => onSelectCorpseLootCard(card.id)}
                data-testid={`betrayal-corpse-loot-card-${card.id}`}
                className={`min-h-[26px] rounded-none border-0 bg-transparent px-1 text-[11px] font-semibold shadow-none transition ${
                  isSelectedLootCard
                    ? "text-[#eef4a8] underline decoration-[#c9a35e] underline-offset-4"
                    : "text-[#d6c498] hover:text-[#f0dfad]"
                }`}
              >
                {card.name}
              </button>
            );
          })}
        </div>
      ) : null}
      {exploreDeclarationOptions ? (
        <div
          data-testid="betrayal-explore-options"
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
        >
          <span className="px-0 text-center text-[11px] font-semibold text-[#d9c68f]">
            {exploreDeclarationOptions.label}
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {exploreDeclarationOptions.canDeclareHolySymbolExplore ? (
              <button
                type="button"
                onClick={onToggleHolySymbolExplore}
                data-testid="betrayal-explore-option-holy-symbol"
                className={`pointer-events-auto min-h-[44px] rounded-[10px] border px-3 text-[13px] font-bold shadow-[0_8px_18px_rgba(0,0,0,0.22)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#efd17c] ${
                  exploreDeclarationOptions.useHolySymbolForExplore
                    ? "border-[#d6b56d] bg-[rgba(214,181,109,0.24)] text-[#fff1b8]"
                    : "border-[rgba(214,181,109,0.34)] bg-[rgba(28,24,18,0.72)] text-[#ead7a5] hover:border-[#d6b56d] hover:bg-[rgba(214,181,109,0.16)] hover:text-[#fff1b8]"
                }`}
              >
                {t("board.inventory.holySymbol")}
              </button>
            ) : null}
            {exploreDeclarationOptions.canDeclareIdolExplore ? (
              <button
                type="button"
                onClick={onToggleIdolExplore}
                data-testid="betrayal-explore-option-idol"
                className={`pointer-events-auto min-h-[44px] rounded-[10px] border px-3 text-[13px] font-bold shadow-[0_8px_18px_rgba(0,0,0,0.22)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#efd17c] ${
                  exploreDeclarationOptions.useIdolForExplore
                    ? "border-[#d6b56d] bg-[rgba(214,181,109,0.24)] text-[#fff1b8]"
                    : "border-[rgba(214,181,109,0.34)] bg-[rgba(28,24,18,0.72)] text-[#ead7a5] hover:border-[#d6b56d] hover:bg-[rgba(214,181,109,0.16)] hover:text-[#fff1b8]"
                }`}
              >
                {t("board.inventory.idol")}
              </button>
            ) : null}
            {exploreDeclarationOptions.canDeclareTraitorEventSkip ? (
              <button
                type="button"
                onClick={onToggleTraitorEventSkip}
                data-testid="betrayal-explore-option-traitor-event-skip"
                title={t("board.inventory.traitorEventSkipDescription")}
                className={`pointer-events-auto inline-flex min-h-[44px] flex-col items-start justify-center gap-0.5 rounded-[10px] border px-3 text-left text-[13px] font-bold shadow-[0_8px_18px_rgba(0,0,0,0.22)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#efd17c] ${
                  exploreDeclarationOptions.ignoreEventSymbolWithTraitorPower
                    ? "border-[#d6b56d] bg-[rgba(214,181,109,0.24)] text-[#fff1b8]"
                    : "border-[rgba(214,181,109,0.34)] bg-[rgba(28,24,18,0.72)] text-[#ead7a5] hover:border-[#d6b56d] hover:bg-[rgba(214,181,109,0.16)] hover:text-[#fff1b8]"
                }`}
              >
                <span>{t("board.inventory.traitorEventSkip")}</span>
                <span
                  data-testid="betrayal-explore-option-traitor-event-skip-description"
                  className="text-[10px] font-semibold leading-tight text-[#d9c68f]"
                >
                  {t("board.inventory.traitorEventSkipDescription")}
                </span>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {shouldShowMaskTargetSelector ? (
        <div
          data-testid="betrayal-mask-target-selector"
          className="inline-flex max-w-[min(720px,calc(100vw-2rem))] flex-wrap items-center gap-2 rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
        >
          <span className="px-1 text-[11px] font-semibold text-[#d9c68f]">
            {t("board.inventory.mask")}
          </span>
          {maskTargetTokens.map((token) => (
            <div
              key={token.id}
              data-testid={`betrayal-mask-target-row-${token.id}`}
              className="inline-flex items-center gap-1"
            >
              <span className="max-w-[84px] truncate text-[11px] text-[#ead7a5]">
                {token.name}
              </span>
              <span
                data-testid={`betrayal-mask-active-target-${token.id}`}
                className={`inline-flex min-h-[26px] items-center px-1 text-[11px] font-semibold ${
                  activeMaskTargetTokenId === token.id
                    ? "text-[#eef4a8]"
                    : "text-[#d6c498]"
                }`}
              >
                {selectedMaskTargetRoomIdsByTokenId[token.id]
                  ? maskTargetRooms.find(
                      (room) =>
                        room.id === selectedMaskTargetRoomIdsByTokenId[token.id],
                    )?.name
                  : t("board.status.tradeStepPending")}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );

  return hasExploreDeclarationOptions ? <HudPortal>{content}</HudPortal> : content;
}
