import React from "react";
import { Eye } from "lucide-react";
import { useTranslation } from "react-i18next";

import { OptimizedImage } from "../../components/common/media/OptimizedImage";
import type { MatchPlayerInfo } from "../../engine/transport/protocol";
import type {
  BetrayalExplorerSummary,
  BetrayalRoomNode,
  BetrayalTraitKey,
} from "./game";
import { resolvePlayerName } from "./playerPresentation";
import {
  resolveExplorerBoardMarkerPosition,
  resolveExplorerTraitTrack,
  resolveTraitTrackValueAtPosition,
} from "./traitPresentation";
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
  markerAsset: string;
  locale: string;
  matchData?: MatchPlayerInfo[];
  isObservingOtherExplorer: boolean;
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
  markerAsset,
  locale,
  matchData,
  isObservingOtherExplorer,
}: BetrayalObservedExplorerPanelSurfaceProps) {
  const { t } = useTranslation("game-betrayal");

  return (
    <article className="pointer-events-none relative overflow-visible bg-transparent px-1 py-1">
      <div className="mx-auto flex w-full max-w-[252px] flex-col gap-1 pb-1 pt-1 xl:mx-0">
        <div
          className="relative mx-auto w-full max-w-[188px]"
          data-testid="betrayal-observed-explorer-panel"
          data-panel-asset={explorer.portraitAsset}
          data-player-id={explorer.playerId}
          data-explorer-id={explorer.explorerId}
        >
          <div className="pointer-events-none absolute inset-[12%] rounded-full bg-[rgba(77,138,92,0.18)] blur-3xl" />
          <OptimizedImage
            src={explorer.portraitAsset}
            locale={locale}
            alt={explorer.displayName}
            className="relative z-10 aspect-[1/1.05] h-auto w-full object-contain drop-shadow-[0_16px_30px_rgba(0,0,0,0.38)]"
            draggable={false}
          />
          {BETRAYAL_TRAIT_KEYS.map((key) => {
            const track = resolveExplorerTraitTrack(explorer, key);
            const value = resolveTraitTrackValueAtPosition(
              track,
              track.position,
            );
            const markerPosition = resolveExplorerBoardMarkerPosition(
              key,
              track.position,
              track.maxPosition,
            );
            return (
              <div
                key={`explorer-board-marker-${key}`}
                data-testid={`betrayal-explorer-board-marker-${key}`}
                data-trait-track-position={track.position}
                data-trait-track-value={value}
                data-trait-board-marker-shape="blank-material-marker"
                data-trait-board-marker-asset={markerAsset}
                data-trait-board-marker-visible-value="false"
                aria-label={`${TRAIT_LABEL_LOCAL[key]}当前位置，第 ${track.position} 位，数值 ${value}`}
                title={`${TRAIT_LABEL_LOCAL[key]}当前位置：第 ${track.position} 位，数值 ${value}`}
                className="pointer-events-none absolute z-20 h-[20px] w-[20px] -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_3px_7px_rgba(0,0,0,0.44)]"
                style={markerPosition}
              >
                <OptimizedImage
                  src={markerAsset}
                  locale={locale}
                  alt=""
                  className="h-full w-full object-contain"
                  draggable={false}
                />
              </div>
            );
          })}
        </div>
        <div className="-mt-4 flex justify-center px-2">
          <div className="relative inline-flex min-w-[174px] max-w-[194px] items-center justify-between gap-2 overflow-hidden rounded-[7px] border border-[rgba(103,82,48,0.62)] bg-[linear-gradient(180deg,rgba(14,18,16,0.9),rgba(9,12,10,0.96))] px-2.5 py-1.5 shadow-[0_8px_16px_rgba(0,0,0,0.14)]">
            <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.18),transparent)]" />
            <div className="min-w-0">
              <div className="text-[8px] uppercase tracking-[0.18em] text-[#95876d]">
                {t("board.hud.locationLabel")}
              </div>
              <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-[#efe2c4]">
                {roomName}
              </div>
            </div>
            <div className="shrink-0 self-center rounded-[6px] border border-[rgba(105,83,47,0.58)] bg-[radial-gradient(circle_at_35%_25%,rgba(227,211,168,0.12),rgba(18,15,12,0.95))] px-2 py-0.5 text-center shadow-[0_4px_10px_rgba(0,0,0,0.14)]">
              <div className="text-[7px] uppercase tracking-[0.16em] text-[#98886a]">
                {t("board.hud.holdingLabel")}
              </div>
              <div className="text-[15px] font-semibold leading-none text-[#f0e2c0]">
                {explorer.inventory.length}
              </div>
            </div>
          </div>
        </div>

        <div className="px-1.5">
          <div
            className="relative overflow-hidden rounded-[10px] border border-[rgba(93,79,54,0.42)] bg-[rgba(13,17,15,0.52)] px-3 py-2 shadow-[inset_0_0_0_1px_rgba(214,191,129,0.04)]"
            data-testid="betrayal-current-traits"
            data-tutorial-id="betrayal-current-traits"
            data-player-id={explorer.playerId}
            data-explorer-id={explorer.explorerId}
            data-room-id={explorer.roomId}
            data-observed-player={isObservingOtherExplorer ? "true" : "false"}
            data-observed-player-id={explorer.playerId}
          >
            <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.18),transparent)]" />
            <div className="mb-1 flex items-center justify-between border-b border-[rgba(96,80,54,0.42)] pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d8bf81]">
                {t("board.hud.currentTraitsLabel")}
              </span>
              <span className="inline-flex items-center gap-1 rounded-[4px] border border-[rgba(181,239,66,0.28)] bg-[rgba(40,58,21,0.52)] px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-[#d9ff97]">
                {isObservingOtherExplorer ? <Eye size={11} aria-hidden="true" /> : null}
                {resolvePlayerName(
                  explorer.playerId,
                  explorer.displayName,
                  matchData,
                )}
              </span>
            </div>
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
            <div
              data-testid="betrayal-current-ability"
              className="mt-1.5 border-t border-[rgba(96,80,54,0.34)] pt-1 text-[10px] leading-4 text-[#d9ff97]"
            >
              <span className="font-semibold text-[#d8bf81]">
                {t("board.characterSelect.abilityTitle")}：
              </span>
              <span className="font-semibold">{abilityName}：</span>
              <span className="text-[#c8d8a2]">{abilityText}</span>
            </div>
          </div>
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
                  <div className="truncate text-sm font-medium text-[#f1e8d4]">
                    {playerName}
                  </div>
                  {statusVisible ? (
                    <span
                      data-player-status-tone={statusTone}
                      className={`shrink-0 rounded-[4px] border px-2 py-0.5 text-[10px] font-medium ${
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
                <div className="text-xs text-[#b7aa92]">{roomName}</div>
                <div className="text-[11px] text-[#b7aa92]">
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
                <div className="truncate text-[11px] font-medium tracking-[0.04em] text-[#efe5cf]">
                  {playerName}
                </div>
                {statusVisible ? (
                  <span
                    data-player-status-tone={statusTone}
                    className={`shrink-0 rounded-[4px] border px-1.5 py-0.5 text-[9px] ${
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
              <div className="mt-0.5 truncate text-[10px] text-[#b7aa92]">
                {roomName}
              </div>
              {props.knowledgeOfJackPlayerIds.includes(explorer.playerId) ? (
                <div
                  className="mt-1 truncate text-[9px] font-semibold uppercase tracking-[0.08em] text-[#c5df6b]"
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
