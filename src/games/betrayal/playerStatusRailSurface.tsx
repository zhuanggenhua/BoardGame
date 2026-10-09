import React from "react";
import { useState } from "react";
import { Eye, Maximize2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { OptimizedImage } from "../../components/common/media/OptimizedImage";
import { MagnifyOverlay } from "../../components/common/overlays/MagnifyOverlay";
import type { MatchPlayerInfo } from "../../engine/transport/protocol";
import type {
  BetrayalExplorerSummary,
  BetrayalRoomNode,
  BetrayalTraitKey,
} from "./game";
import { ExplorerFigureToken } from "./entityTokenSurface";
import { resolvePlayerName } from "./playerPresentation";
import {
  ExplorerTraitTrackRail,
  TRAIT_LABEL_LOCAL,
  TRAIT_VALUE_TEXT_CLASS,
} from "./traitTrackSurface";

const BETRAYAL_TRAIT_KEYS: BetrayalTraitKey[] = [
  "might",
  "speed",
  "knowledge",
  "sanity",
];

type BetrayalObservedExplorerPanelSurfaceProps = {
  explorer: BetrayalExplorerSummary;
  roomName: string;
  abilityName: string;
  abilityText: string;
  locale: string;
  matchData?: MatchPlayerInfo[];
  isObservingOtherExplorer: boolean;
  isMobileViewport: boolean;
};

type BetrayalTeammateListSurfaceProps = {
  variant: "compact" | "sidebar";
  explorers: BetrayalExplorerSummary[];
  rooms: BetrayalRoomNode[];
  currentExplorerRoomId: string;
  observedExplorerPlayerId: string;
  activeTradeTargets: BetrayalExplorerSummary[];
  corpseLootTargets: BetrayalExplorerSummary[];
  dogTradeTargets: BetrayalExplorerSummary[];
  dustTargetPlayerIds: ReadonlySet<string>;
  magicCameraPhotoTargetPlayerIds: ReadonlySet<string>;
  phantomPhotographerTargetPlayerIds: ReadonlySet<string>;
  selectedMonsterAttackTargetPlayerIds: ReadonlySet<string>;
  helpingHandsTrollHandAttackTargetPlayerIds: ReadonlySet<string>;
  heroAttackTargetPlayerIds: ReadonlySet<string>;
  knowledgeOfJackPlayerIds: readonly string[];
  isDustSicknessExchangeMode: boolean;
  isHeroAttackTargetingMode: boolean;
  isDustAttackTargetingMode: boolean;
  hauntActionKind: string | null | undefined;
  hauntActionTargetPlayerId: string | null | undefined;
  selectedTradeTargetPlayerId: string | null;
  selectedCorpseLootTargetPlayerId: string | null;
  selectedPreviewTradeTargetPlayerId: string | null;
  selectedDustTargetPlayerId: string | null;
  locale: string;
  matchData?: MatchPlayerInfo[];
  onSelectTarget: (explorer: BetrayalExplorerSummary) => void;
  onObserveExplorer: (playerId: string) => void;
};

function hasPlayerId(
  explorers: readonly Pick<BetrayalExplorerSummary, "playerId">[],
  playerId: string,
) {
  return explorers.some((item) => item.playerId === playerId);
}

function resolveTeammatePresentationState({
  explorer,
  props,
}: {
  explorer: BetrayalExplorerSummary;
  props: BetrayalTeammateListSurfaceProps;
}) {
  const isTradeCandidate = hasPlayerId(props.activeTradeTargets, explorer.playerId);
  const isCorpseLootCandidate = hasPlayerId(
    props.corpseLootTargets,
    explorer.playerId,
  );
  const isDustTarget = props.dustTargetPlayerIds.has(explorer.playerId);
  const isSicknessExchangeTarget =
    props.isDustSicknessExchangeMode && isDustTarget;
  const isMagicCameraPhotoTarget = props.magicCameraPhotoTargetPlayerIds.has(
    explorer.playerId,
  );
  const isPhantomPhotographerTarget =
    props.phantomPhotographerTargetPlayerIds.has(explorer.playerId);
  const isMonsterAttackTarget = props.selectedMonsterAttackTargetPlayerIds.has(
    explorer.playerId,
  );
  const isHelpingHandsTrollHandTarget =
    props.helpingHandsTrollHandAttackTargetPlayerIds.has(explorer.playerId);
  const isAttackTarget =
    (props.isHeroAttackTargetingMode &&
      props.heroAttackTargetPlayerIds.has(explorer.playerId)) ||
    isMagicCameraPhotoTarget ||
    isMonsterAttackTarget ||
    isHelpingHandsTrollHandTarget ||
    (props.isDustAttackTargetingMode && isDustTarget);
  const isSelectedAttackTarget =
    props.isHeroAttackTargetingMode &&
    props.hauntActionKind === "attack-hero" &&
    props.hauntActionTargetPlayerId === explorer.playerId;
  const isSelectedTradeTarget =
    explorer.playerId === props.selectedTradeTargetPlayerId ||
    explorer.playerId === props.selectedCorpseLootTargetPlayerId ||
    (props.selectedPreviewTradeTargetPlayerId === explorer.playerId &&
      (isMagicCameraPhotoTarget ||
        isMonsterAttackTarget ||
        isHelpingHandsTrollHandTarget ||
        isDustTarget)) ||
    isSelectedAttackTarget ||
    (isSicknessExchangeTarget &&
      explorer.playerId === props.selectedDustTargetPlayerId);
  const isSameRoom = props.currentExplorerRoomId === explorer.roomId;
  const isDogTradeTarget = hasPlayerId(props.dogTradeTargets, explorer.playerId);
  const isPassiveSameRoomCue =
    isTradeCandidate &&
    isSameRoom &&
    !isCorpseLootCandidate &&
    !isSicknessExchangeTarget &&
    !isMagicCameraPhotoTarget &&
    !isPhantomPhotographerTarget &&
    !isMonsterAttackTarget &&
    !isHelpingHandsTrollHandTarget &&
    !isDustTarget &&
    !isAttackTarget &&
    !isDogTradeTarget;
  const isObservedExplorer =
    props.observedExplorerPlayerId === explorer.playerId;

  return {
    isAttackTarget,
    isCorpseLootCandidate,
    isDogTradeTarget,
    isMagicCameraPhotoTarget,
    isObservedExplorer,
    isPassiveSameRoomCue,
    isPhantomPhotographerTarget,
    isSelectedTradeTarget,
    isSicknessExchangeTarget,
    isSameRoom,
    isTradeCandidate,
  };
}

function resolveTeammateStatusLabel({
  isAttackTarget,
  isCorpseLootCandidate,
  isDogTradeTarget,
  isMagicCameraPhotoTarget,
  isPhantomPhotographerTarget,
  isSameRoom,
  isSicknessExchangeTarget,
  t,
}: ReturnType<typeof resolveTeammatePresentationState> & {
  t: ReturnType<typeof useTranslation<"game-betrayal">>["t"];
}) {
  if (isSicknessExchangeTarget) return t("board.status.sicknessExchangeShort");
  if (isMagicCameraPhotoTarget) return t("board.actions.takePhoto");
  if (isPhantomPhotographerTarget) {
    return t("board.actions.phantomPhotographerAttack");
  }
  if (isAttackTarget) return t("board.actions.attack");
  if (isCorpseLootCandidate) return t("board.players.corpse");
  if (isSameRoom) return t("board.players.sameRoom");
  if (isDogTradeTarget) return t("board.inventory.dog");
  return t("board.players.tradeTarget");
}

export function BetrayalObservedExplorerPanelSurface({
  explorer,
  roomName,
  abilityName,
  abilityText,
  locale,
  matchData,
  isObservingOtherExplorer,
  isMobileViewport,
}: BetrayalObservedExplorerPanelSurfaceProps) {
  const { t } = useTranslation("game-betrayal");
  const [isAbilityDetailsOpen, setIsAbilityDetailsOpen] = useState(false);
  const playerName = resolvePlayerName(
    explorer.playerId,
    explorer.displayName,
    matchData,
  );
  const abilityContent = (
    <>
      <span className="font-semibold text-[#d8bf81]">
        {t("board.characterSelect.abilityTitle")}：
      </span>
      <span className="font-semibold">{abilityName}：</span>
      <span className="whitespace-normal break-words text-[#c8d8a2]">{abilityText}</span>
    </>
  );

  return (
    <article className="pointer-events-none relative overflow-visible bg-transparent px-1 py-1">
      <div className="mx-auto flex w-full max-w-[252px] flex-col gap-1.5 pb-1 pt-1">
        <div
          className="flex items-center gap-2 px-1"
          data-testid="betrayal-observed-explorer-panel"
          data-panel-asset={explorer.portraitAsset}
          data-token-asset={explorer.tokenAsset ?? ""}
          data-player-id={explorer.playerId}
          data-explorer-id={explorer.explorerId}
          data-room-name={roomName}
        >
          <ExplorerFigureToken
            explorer={explorer}
            locale={locale}
            label={playerName}
            tone={isObservingOtherExplorer ? "ally" : "self"}
            size="panel"
            missingTokenLabel={t("board.hauntTokens.officialTokenMissing")}
            testIdPrefix="betrayal-hud-identity-token"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              {isObservingOtherExplorer ? (
                <Eye size={12} className="shrink-0 text-[#d9ff97]" aria-hidden="true" />
              ) : null}
              <div
                data-testid="betrayal-hud-identity-name"
                className="min-w-0 break-words text-[13px] font-semibold leading-[1.25] tracking-[0.02em] text-[#f1e8d4]"
              >
                {playerName}
              </div>
            </div>
            <div className="mt-0.5 break-words text-[11px] leading-[1.3] text-[#b7aa92]">
              {roomName}
            </div>
          </div>
        </div>

        <div className="px-0.5">
          <div
            className="relative overflow-hidden rounded-[10px] border border-[rgba(93,79,54,0.42)] bg-[rgba(13,17,15,0.52)] px-2 py-1.5 shadow-[inset_0_0_0_1px_rgba(214,191,129,0.04)]"
            data-testid="betrayal-current-traits"
            data-tutorial-id="betrayal-current-traits"
            data-player-id={explorer.playerId}
            data-explorer-id={explorer.explorerId}
            data-room-id={explorer.roomId}
            data-observed-player={isObservingOtherExplorer ? "true" : "false"}
            data-observed-player-id={explorer.playerId}
          >
            <div className="grid gap-0.5">
              {BETRAYAL_TRAIT_KEYS.map((trait) => (
                <div
                  key={trait}
                  data-testid={`betrayal-current-trait-row-${trait}`}
                >
                  <ExplorerTraitTrackRail
                    explorer={explorer}
                    trait={trait}
                    locale={locale}
                    testIdPrefix="betrayal-current-trait-track"
                  />
                </div>
              ))}
            </div>
            {isMobileViewport ? null : (
              <div
                data-testid="betrayal-current-ability"
                data-ability-display="expanded"
                className="mt-1.5 border-t border-[rgba(96,80,54,0.34)] pt-2 text-[16px] leading-[1.45] tracking-[0.02em] text-[#d9ff97]"
              >
                {abilityContent}
              </div>
            )}
          </div>
          {isMobileViewport ? (
            <>
              <button
                type="button"
                data-testid="betrayal-current-ability"
                data-ability-display="compact"
                aria-expanded={isAbilityDetailsOpen}
                aria-label={`${t("board.players.viewAbilityDetails")}：${abilityName}`}
                onClick={() => setIsAbilityDetailsOpen(true)}
                className="pointer-events-auto relative z-10 mt-1 flex items-start gap-1.5 overflow-hidden rounded-[8px] border border-[rgba(96,80,54,0.34)] bg-[rgba(13,17,15,0.72)] px-2 py-1 text-left text-[16px] leading-[1.35] tracking-[0.02em] text-[#d9ff97]"
              >
                <span className="min-w-0 flex-1 whitespace-normal break-words">
                  <span className="font-semibold">
                    <span className="text-[#d8bf81]">
                      {t("board.characterSelect.abilityTitle")}：
                    </span>
                    <span>{abilityName}</span>
                  </span>
                  {abilityText ? (
                    <span
                      data-ability-description="true"
                      className="mt-0.5 block whitespace-normal break-words text-[#c8d8a2]"
                    >
                      {abilityText}
                    </span>
                  ) : null}
                </span>
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] border border-[rgba(214,191,129,0.42)] bg-[rgba(18,23,18,0.72)] text-[#f3e0b4]">
                  <Maximize2 size={12} aria-hidden="true" />
                </span>
              </button>
              <MagnifyOverlay
                isOpen={isAbilityDetailsOpen}
                onClose={() => setIsAbilityDetailsOpen(false)}
                overlayTestId="betrayal-current-ability-dialog"
                closeLabel={t("board.players.closeAbilityDetails")}
                overlayClassName="bg-[rgba(3,6,5,0.82)] p-4"
                containerClassName="w-[min(36rem,calc(100vw-2rem))] rounded-[12px] border border-[rgba(214,191,129,0.44)] bg-[linear-gradient(180deg,rgba(22,28,22,0.98),rgba(8,11,9,0.98))] shadow-[0_24px_56px_rgba(0,0,0,0.58)]"
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  data-testid="betrayal-current-ability-dialog-content"
                  className="max-h-[calc(100vh-6rem)] overflow-y-auto px-5 py-6 text-[16px] leading-7 tracking-[0.02em] text-[#d9ff97]"
                >
                  <div className="mb-3 border-b border-[rgba(96,80,54,0.42)] pb-2 text-[18px] font-semibold text-[#d8bf81]">
                    {t("board.characterSelect.abilityTitle")}：{abilityName}
                  </div>
                  <p data-testid="betrayal-current-ability-dialog-body">
                    {abilityText}
                  </p>
                </div>
              </MagnifyOverlay>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function BetrayalTeammateListSurface(props: BetrayalTeammateListSurfaceProps) {
  const { t } = useTranslation("game-betrayal");

  return (
    <>
      {props.explorers.map((explorer) => {
        const state = resolveTeammatePresentationState({ explorer, props });
        const statusVisible =
          state.isTradeCandidate ||
          state.isCorpseLootCandidate ||
          state.isSicknessExchangeTarget ||
          state.isAttackTarget;
        const statusTone = state.isSelectedTradeTarget
          ? "selected"
          : state.isPassiveSameRoomCue
            ? "neutral"
            : "target";
        const statusLabel = resolveTeammateStatusLabel({ ...state, t });
        const playerName = resolvePlayerName(
          explorer.playerId,
          explorer.displayName,
          props.matchData,
        );
        const roomName =
          props.rooms.find((room) => room.id === explorer.roomId)?.name ||
          t("board.rooms.unknown");
        const handleClick = () => {
          if (state.isAttackTarget || state.isSicknessExchangeTarget) {
            props.onSelectTarget(explorer);
            return;
          }
          props.onObserveExplorer(explorer.playerId);
        };

        if (props.variant === "compact") {
          return (
            <button
              key={explorer.playerId}
              type="button"
              onClick={handleClick}
              data-testid={`betrayal-teammate-panel-${explorer.playerId}`}
              data-player-id={explorer.playerId}
              data-player-seat-anchor={explorer.playerId}
              data-explorer-id={explorer.explorerId}
              data-room-id={explorer.roomId}
              data-observed-player={
                state.isObservedExplorer ? "true" : "false"
              }
              title={`切换观察视角：${playerName}`}
              aria-label={`切换观察视角：${playerName}`}
              className={`group pointer-events-auto grid w-full grid-cols-[50px_minmax(0,1fr)_122px] items-center gap-2 rounded-[8px] border px-1.5 py-2 text-left transition ${
                state.isSelectedTradeTarget
                  ? "border-[#eecc7e] bg-[linear-gradient(180deg,rgba(53,40,20,0.58),rgba(22,19,14,0.70))] shadow-[0_0_0_1px_rgba(24,17,8,0.92),0_0_18px_rgba(238,204,126,0.30)]"
                  : (state.isTradeCandidate && !state.isPassiveSameRoomCue) ||
                      state.isCorpseLootCandidate ||
                      state.isAttackTarget
                    ? "border-[rgba(118,189,153,0.46)] bg-[rgba(12,18,15,0.20)] hover:border-[rgba(159,225,167,0.64)] hover:bg-[rgba(255,224,138,0.06)]"
                    : state.isObservedExplorer
                      ? "border-[rgba(224,189,114,0.62)] bg-[rgba(55,38,21,0.44)] shadow-[0_0_0_1px_rgba(24,17,8,0.80),0_0_15px_rgba(224,189,114,0.22)]"
                      : "border-transparent bg-transparent hover:border-[rgba(117,98,68,0.34)] hover:bg-[rgba(28,24,19,0.5)]"
              }`}
            >
              <div className="relative h-12 w-12 overflow-visible">
                <span className="block h-12 w-12 overflow-hidden">
                  <OptimizedImage
                    src={explorer.portraitAsset}
                    locale={props.locale}
                    alt={explorer.displayName}
                    className="h-full w-full object-contain"
                    draggable={false}
                  />
                </span>
                {state.isObservedExplorer ? (
                  <span
                    data-testid={`betrayal-teammate-observed-${explorer.playerId}`}
                    className="pointer-events-none absolute -right-1 -top-1 z-20 grid h-5 w-5 place-items-center rounded-full border border-[rgba(224,189,114,0.72)] bg-[rgba(20,14,8,0.92)] text-[#f5d993] shadow-[0_4px_9px_rgba(0,0,0,0.34)]"
                    aria-hidden="true"
                  >
                    <Eye size={12} />
                  </span>
                ) : null}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="betrayal-hud-readable-name truncate text-sm font-medium text-[#f1e8d4]">
                    {playerName}
                  </div>
                  {statusVisible ? (
                    <span
                      data-player-status-tone={statusTone}
                      className={`betrayal-hud-readable-status shrink-0 rounded-[4px] border px-2 py-0.5 text-[10px] font-medium ${
                        state.isSelectedTradeTarget
                          ? "border-[#eecc7e] bg-[rgba(238,204,126,0.18)] text-[#ffe4a0]"
                          : state.isPassiveSameRoomCue
                            ? "border-[rgba(117,98,68,0.44)] bg-[rgba(28,24,19,0.54)] text-[#c9bda1]"
                            : "border-[rgba(118,189,153,0.30)] bg-[rgba(40,63,50,0.18)] text-[#bddac2]"
                      }`}
                    >
                      {statusLabel}
                    </span>
                  ) : null}
                </div>
                <div className="betrayal-hud-readable-room text-xs text-[#b7aa92]">{roomName}</div>
                <div className="betrayal-hud-readable-status text-[11px] text-[#b7aa92]">
                  {t("board.players.inventoryCount", {
                    count: explorer.inventory.length,
                  })}
                </div>
              </div>
              <div className="grid min-w-0 gap-0.5 text-[#c8bda4]">
                {BETRAYAL_TRAIT_KEYS.map((key) => (
                  <ExplorerTraitTrackRail
                    key={key}
                    explorer={explorer}
                    trait={key}
                    locale={props.locale}
                    density="compact"
                    testIdPrefix={`betrayal-teammate-trait-track-${explorer.playerId}`}
                  />
                ))}
              </div>
            </button>
          );
        }

        return (
          <button
            key={`sidebar-teammate-${explorer.playerId}`}
            type="button"
            onClick={handleClick}
            data-testid={`betrayal-bottom-teammate-${explorer.playerId}`}
            data-tutorial-id={`betrayal-bottom-teammate-${explorer.playerId}`}
            data-player-id={explorer.playerId}
            data-player-seat-anchor={explorer.playerId}
            data-explorer-id={explorer.explorerId}
            data-room-id={explorer.roomId}
            data-observed-player={state.isObservedExplorer ? "true" : "false"}
            className={`group pointer-events-auto relative grid grid-cols-[34px_minmax(0,1fr)] items-start gap-2 rounded-[8px] border px-1.5 py-1.5 text-left transition ${
              state.isSelectedTradeTarget
                ? "border-[#eecc7e] bg-[linear-gradient(180deg,rgba(53,40,20,0.72),rgba(22,19,14,0.82))] shadow-[0_0_0_1px_rgba(24,17,8,0.92),0_0_18px_rgba(238,204,126,0.34)]"
                : (state.isTradeCandidate && !state.isPassiveSameRoomCue) ||
                    state.isCorpseLootCandidate ||
                    state.isAttackTarget
                  ? "border-[rgba(118,189,153,0.46)] bg-[rgba(12,18,15,0.20)] hover:bg-[rgba(28,24,19,0.5)] hover:border-[rgba(159,225,167,0.64)]"
                  : state.isObservedExplorer
                    ? "border-[rgba(224,189,114,0.62)] bg-[rgba(55,38,21,0.44)] shadow-[0_0_0_1px_rgba(24,17,8,0.80),0_0_15px_rgba(224,189,114,0.22)]"
                    : "border-transparent hover:bg-[rgba(28,24,19,0.5)]"
            }`}
            title={`切换观察视角：${playerName}`}
            aria-label={`切换观察视角：${playerName}`}
          >
            <div
              className={`relative h-[34px] w-[34px] overflow-visible rounded-[6px] border ${
                (state.isTradeCandidate && !state.isPassiveSameRoomCue) ||
                state.isCorpseLootCandidate ||
                state.isSicknessExchangeTarget ||
                state.isAttackTarget
                  ? "border-[rgba(118,189,153,0.42)]"
                  : "border-[rgba(117,98,68,0.34)]"
              } bg-[rgba(12,14,13,0.62)]`}
            >
              <span className="block h-full w-full overflow-hidden rounded-[6px]">
                <OptimizedImage
                  src={explorer.portraitAsset}
                  locale={props.locale}
                  alt={explorer.displayName}
                  className="h-full w-full object-contain"
                  draggable={false}
                />
              </span>
              <span
                className={`pointer-events-none absolute inset-0 rounded-[6px] ring-1 ${
                  state.isObservedExplorer
                    ? "ring-[rgba(224,189,114,0.54)]"
                    : "ring-transparent"
                }`}
              />
              {state.isObservedExplorer ? (
                <span
                  data-testid={`betrayal-bottom-teammate-observed-${explorer.playerId}`}
                  className="pointer-events-none absolute -right-1 -top-1 z-20 grid h-[18px] w-[18px] place-items-center rounded-full border border-[rgba(224,189,114,0.72)] bg-[rgba(20,14,8,0.92)] text-[#f5d993] shadow-[0_4px_9px_rgba(0,0,0,0.34)]"
                  aria-hidden="true"
                >
                  <Eye size={10} />
                </span>
              ) : null}
            </div>
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="betrayal-hud-readable-name truncate text-[11px] font-medium tracking-[0.04em] text-[#efe5cf]">
                  {playerName}
                </div>
                {statusVisible ? (
                  <span
                    data-player-status-tone={statusTone}
                    className={`betrayal-hud-readable-status shrink-0 rounded-[4px] border px-1.5 py-0.5 text-[9px] ${
                      state.isSelectedTradeTarget
                        ? "border-[#eecc7e] bg-[rgba(238,204,126,0.18)] text-[#ffe4a0]"
                        : state.isPassiveSameRoomCue
                          ? "border-[rgba(117,98,68,0.44)] bg-[rgba(28,24,19,0.54)] text-[#c9bda1]"
                          : "border-[rgba(118,189,153,0.30)] bg-[rgba(40,63,50,0.18)] text-[#bddac2]"
                    }`}
                  >
                    {statusLabel}
                  </span>
                ) : null}
              </div>
              <div className="betrayal-hud-readable-room mt-0.5 truncate text-[10px] text-[#b7aa92]">
                {roomName}
              </div>
              {props.knowledgeOfJackPlayerIds.includes(explorer.playerId) ? (
                <div
                  className="betrayal-hud-readable-knowledge mt-1 truncate text-[9px] font-semibold uppercase tracking-[0.08em] text-[#c5df6b]"
                  data-testid={`betrayal-bottom-teammate-knowledge-${explorer.playerId}`}
                >
                  {t("board.players.knowledgeOfJack")}
                </div>
              ) : null}
              <div className="mt-1 flex items-center gap-1">
                {BETRAYAL_TRAIT_KEYS.map((key) => (
                  <span
                    key={`${explorer.playerId}-${key}`}
                    data-trait-value-shape="square"
                    className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] bg-[rgba(21,18,14,0.84)] px-1 text-[9px] font-semibold ${TRAIT_VALUE_TEXT_CLASS[key]}`}
                    title={`${TRAIT_LABEL_LOCAL[key]} ${explorer.traits[key]}`}
                  >
                    {explorer.traits[key]}
                  </span>
                ))}
              </div>
            </div>
          </button>
        );
      })}
    </>
  );
}
