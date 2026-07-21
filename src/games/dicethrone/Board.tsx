import React from 'react';
import type { GameBoardProps } from '../../engine/transport/protocol';

import { HAND_LIMIT, type InteractionDescriptor, type PendingBonusDiceSettlement, type TokenResponsePhase } from './domain/types';
import { RESOURCE_IDS } from './domain/resources';
import { STATUS_IDS, TOKEN_IDS } from './domain/ids';
import type { DiceThroneCore, Die } from './domain';
import { getUsableTokenAmountForTiming, getUsableTokensForTiming } from './domain/tokenResponse';
import {
    ATTACK_SNAPSHOT_DIE_ID_OFFSET,
    getPlayableCardsInResponseWindow,
    getAvailableAbilityIds,
    getPendingBonusSettlementDice,
    getPlayerDieFace,
    getSeatingOrder,
    getOpponents,
    areTeammates,
    getUpgradeTargetAbilityId,
    shouldOpenAfterRollConfirmedForBonusSettlement,
} from './domain/rules';
import { useTranslation } from 'react-i18next';
import { OptimizedImage } from '../../components/common/media/OptimizedImage';
import { GameDebugPanel } from '../../components/game/framework/widgets/GameDebugPanel';
import { DiceThroneDebugConfig } from './debug-config';
import { DICETHRONE_MANIFEST } from './manifest';
import { getElementCenter } from '../../components/common/animations/FlyingEffect';
import { usePulseGlow } from '../../components/common/animations/PulseGlow';
import { useImpactFeedback } from '../../components/common/animations';
import { useFxBus, FxLayer } from '../../engine/fx';
import { diceThroneFxRegistry } from './ui/fxSetup';
import { useToast } from '../../contexts/ToastContext';
import { UndoProvider } from '../../contexts/UndoContext';
import { useTutorial, useTutorialBridge } from '../../contexts/TutorialContext';
import { loadStatusAtlases, type StatusAtlases } from './ui/statusEffects';
import { ABILITY_SLOT_MAP, getAbilitySlotIdForCharacter, slotContainsAbilityIdForCharacter } from './ui/abilitySlotMapping';
import type { AbilityOverlaysHandle } from './ui/AbilityOverlays';
import { AbilityChoiceModal, type AbilityChoiceOption } from './ui/AbilityChoiceModal';
import { ConfirmSkipModal } from './ui/ConfirmSkipModal';
import { ConfirmRemoveKnockdownModal } from './ui/ConfirmRemoveKnockdownModal';
import { PurifyModal } from './ui/PurifyModal';
import { findPlayerAbility } from './domain/abilityLookup';
import { HandArea } from './ui/HandArea';
// cardAtlas 模块加载时已同步注册所有英雄图集，无需异步加载
import './ui/cardAtlas';
import './cursor'; // Register cursor themes

import { DiceThroneCharacterSelection } from './ui/CharacterSelectionAdapter';
import { TutorialSelectionGate, useMatchPlayerViewModel } from '../../components/game/framework';
import { OpponentHeader } from './ui/OpponentHeader';
import { LeftSidebar } from './ui/LeftSidebar';
import { CenterBoard } from './ui/CenterBoard';
import { playSound as playSoundFn } from '../../lib/audio/useGameAudio';
import { RightSidebar } from './ui/RightSidebar';
import { BoardDiceStage } from './ui/DiceTray';
import { BoardOverlays } from './ui/BoardOverlays';
import { GameHints } from './ui/GameHints';
import { useGameMode } from '../../contexts/GameModeContext';
import { useEndgame } from '../../hooks/game/useEndgame';
import { useCurrentChoice, useCurrentDefenderChoice, useDiceThroneState } from './hooks/useDiceThroneState';
import { INTERACTION_COMMANDS, asCompareRollChoice } from '../../engine/systems/InteractionSystem';
import { useMultistepInteraction } from '../../engine/systems/useMultistepInteraction';
import { diceModifyReducer, diceModifyToCommands, diceSelectReducer, diceSelectToCommands, type DiceModifyResult, type DiceModifyStep, type DiceSelectResult, type DiceSelectStep } from './domain/systems';
// 引擎层 Hooks
import { useSpectatorMoves } from '../../engine';
// 游戏特定 Hooks
import { useInteractionState } from './hooks/useInteractionState';
import { useAnimationEffects } from './hooks/useAnimationEffects';
import { useCardSpotlight } from './hooks/useCardSpotlight';
import {
    resolveInteractivePendingBonusDiceSettlement,
    shouldSuppressPendingDisplayOnlyBonusOverlay,
    shouldSuppressForegroundBonusDieOverlay,
} from './ui/bonusDiceOverlayVisibility';
import { useActiveModifiers } from './hooks/useActiveModifiers';
import { useUIState } from './hooks/useUIState';
import { useDiceThroneAudio } from './hooks/useDiceThroneAudio';
import { playDeniedSound } from '../../lib/audio/useGameAudio';
import {
    computeViewModeState,
    getResponseViewSuggestionKey,
    resolveManualResponseEnabledForWindow,
    resolveResponseAutoViewTransition,
    shouldAutoPassResponseWindow,
} from './ui/viewMode';
import { isDirectDiceInterferenceActor } from './domain/responseWindowGuards';
import { resolveMoves, type DiceThroneMoveMap } from './ui/resolveMoves';
import { LayoutSaveButton } from './ui/LayoutSaveButton';
import { useAutoSkipSelection } from './hooks/useAutoSkipSelection';
import { useAttackShowcase } from './hooks/useAttackShowcase';
import { AttackShowcaseOverlay } from './ui/AttackShowcaseOverlay';
import { useDieRerollAnimationConsumer } from './hooks/useDieRerollAnimationConsumer';
import { getPlayerPassiveAbilities, isPassiveActionUsable } from './domain/passiveAbility';
import { getAutoResponseEnabled, getBonusDiceResponseEnabled } from './ui/responsePreferences';
import { getAbilityChoiceText } from './ui/abilityChoiceText';
import { useDiceThroneDisplayPreference } from './ui/useDiceThroneDisplayPreference';
import { canInteractDiceForCurrentBoard, getRailDiceForCurrentBoard, shouldShowRailDiceTray, shouldUseBoardDiceStage } from './ui/diceStagePolicy';
import { canInteractHandForCurrentBoard, canPlayHandCardsForCurrentBoard } from './ui/handPlayPolicy';
import { useSyncedModalStackEntry } from '../../hooks/ui/useSyncedModalStackEntry';
import { TokenResponseModal } from './ui/TokenResponseModal';
import { InteractionOverlay } from './ui/InteractionOverlay';
import { ChoiceModal } from './ui/ChoiceModal';
import { CompareRollOverlay } from './ui/CompareRollOverlay';
import { BonusDieOverlay } from './ui/BonusDieOverlay';
import { DefenderChoiceModal } from './ui/DefenderChoiceModal';
import { createScopedLogger } from '../../lib/logger';
import { findMatchPlayerInfo } from '../../engine/transport/matchPlayers';

type DiceThroneBoardProps = GameBoardProps<DiceThroneCore>;
const boardBonusDieLogger = createScopedLogger('DT_BOARD_BONUS_DIE');
const DUEL_ATTACKER_DIE_ID = 1;

const shouldUseRightTrayForPendingBonusDice = (settlement?: PendingBonusDiceSettlement): boolean => (
    Boolean(settlement?.displayOnly && settlement.allowDiceModification)
);

const createPendingBonusDiceTrayDice = (
    G: DiceThroneCore,
    settlement: PendingBonusDiceSettlement,
    displayOnly: boolean,
): Die[] => {
    const attackerCharacterId = G.players[settlement.attackerId]?.characterId;
    const definitionId = attackerCharacterId && attackerCharacterId !== 'unselected'
        ? `${attackerCharacterId}-dice`
        : undefined;

    return getPendingBonusSettlementDice(settlement).map((bonusDie) => {
        const existingDie = G.dice.find((die) => die.id === bonusDie.index) ?? G.dice[bonusDie.index];
        return {
            ...(existingDie ?? {
                id: bonusDie.index,
                value: bonusDie.value,
                isKept: false,
            }),
            id: bonusDie.index,
            definitionId: definitionId ?? existingDie?.definitionId,
            value: bonusDie.value,
            symbol: bonusDie.face ?? existingDie?.symbol ?? null,
            symbols: bonusDie.face ? [bonusDie.face] : (existingDie?.symbols ?? []),
            isKept: false,
            ownerId: settlement.attackerId,
            displayOnly,
        } as Die;
    });
};

const createDuelAttackerDisplayDie = (G: DiceThroneCore, currentPhase: string): Die | null => {
    const pendingAttack = G.pendingAttack;
    if (currentPhase !== 'defensiveRoll' || pendingAttack?.defenseAbilityId !== 'duel') return null;
    const attackerId = pendingAttack.attackerId;
    const attackerCharacterId = G.players[attackerId]?.characterId;
    if (!attackerId || !attackerCharacterId || attackerCharacterId === 'unselected') return null;
    const definitionId = `${attackerCharacterId}-dice`;
    return {
        id: DUEL_ATTACKER_DIE_ID,
        definitionId,
        value: pendingAttack.duelAttackerDieValue ?? 1,
        symbol: null,
        symbols: [],
        isKept: false,
        ownerId: attackerId,
        displayOnly: true,
    };
};

const createDuelDefenderDisplayDie = (G: DiceThroneCore, currentPhase: string): Die | null => {
    const pendingAttack = G.pendingAttack;
    if (currentPhase !== 'defensiveRoll' || pendingAttack?.defenseAbilityId !== 'duel') return null;
    const defenderDie = G.dice[0];
    if (!defenderDie || !pendingAttack.defenderId) return defenderDie ?? null;
    return {
        ...defenderDie,
        ownerId: pendingAttack.defenderId,
    };
};

/** 教程 targetId → 对应的命令类型映射（用于白名单放行） */
const TUTORIAL_TARGET_COMMAND_MAP: Record<string, string[]> = {
    'advance-phase-button': ['ADVANCE_PHASE'],
    'ability-slots': ['SELECT_ABILITY'],
    'dice-roll-button': ['ROLL_DICE'],
    'dice-confirm-button': ['CONFIRM_ROLL'],
    'discard-pile': ['DISCARD_CARD', 'SELL_CARD', 'UNDO_SELL_CARD'],
    'hand-area': ['PLAY_CARD', 'PLAY_UPGRADE_CARD', 'SELL_CARD', 'MODIFY_DIE'],
};

/**
 * 判断同 slot 的多个满足变体是否为"分歧型"（需要玩家选择）
 * - 增量型（如火球 3火/4火/5火）：所有 trigger 都是 diceSet 且骰面 key 集合相同，且 effect 类型集合相同，只是数量递增 → 自动选最高优先级
 * - 分歧型（如燃烧之灵 2火魂 vs 炙热之魂 2岩浆+2火魂；赐死射击 vs 专注）：trigger 类型不同、骰面 key 集合不同、或 effect 类型集合不同 → 弹窗选择
 */
function hasDivergentVariants(state: DiceThroneCore, playerId: string, variantIds: string[]): boolean {
    const matches = variantIds.map(vid => findPlayerAbility(state, playerId, vid));
    const triggers = matches.map(m => m?.variant?.trigger ?? m?.ability.trigger ?? null);

    // 任何 trigger 查不到，保守弹窗
    if (triggers.some(t => !t)) return true;

    // 如果不全是 diceSet 类型 → 分歧型
    if (!triggers.every(t => t!.type === 'diceSet')) return true;

    // 全是 diceSet，比较骰面 key 集合是否一致
    const faceKeySets = triggers.map(t => {
        const faces = (t as { faces: Record<string, number> }).faces;
        return Object.keys(faces).sort().join(',');
    });
    const firstKeySet = faceKeySets[0];
    if (!faceKeySets.every(ks => ks === firstKeySet)) return true;

    // 骰面 key 集合相同时，还需比较 effect 类型集合是否一致
    // 若 effect 类型不同（如一个造伤害、一个施加状态），则为分歧型，需要玩家选择
    const effectTypeSets = matches.map(m => {
        const effects = m?.variant?.effects ?? m?.ability.effects ?? [];
        // 防御性检查：如果 effects 为空或未定义，返回特殊标记
        if (!effects || effects.length === 0) return 'no-effects';
        return effects.map(e => e?.action?.type ?? 'unknown').sort().join(',');
    });
    const firstEffectTypeSet = effectTypeSets[0];
    return !effectTypeSets.every(es => es === firstEffectTypeSet);
}

// --- Main Layout ---
export const DiceThroneBoard: React.FC<DiceThroneBoardProps> = ({ G: rawG, dispatch, playerID, reset, matchData, isMultiplayer }) => {
    const G = rawG.core;
    const access = useDiceThroneState(rawG);
    const choice = useCurrentChoice(access);
    const defenderChoice = useCurrentDefenderChoice(access);
    const gameMode = useGameMode();
    const isSpectator = !!gameMode?.isSpectator;
    const isTutorialMode = gameMode?.mode === 'tutorial';

    // 使用引擎层 useSpectatorMoves Hook 自动拦截观察者操作
    const engineMoves = useSpectatorMoves(
        resolveMoves(dispatch),
        isSpectator,
        playerID || undefined,
        { logPrefix: 'Spectate[DiceThrone]' }
    ) as DiceThroneMoveMap;
    const { t, i18n } = useTranslation('game-dicethrone');
    const { boardDice3dEnabled } = useDiceThroneDisplayPreference();
    useTutorialBridge(rawG.sys.tutorial, dispatch);
    const { isActive: isTutorialActive, currentStep: tutorialStep, nextStep: nextTutorialStep } = useTutorial();
    const toast = useToast();
    const locale = i18n.resolvedLanguage ?? i18n.language;
    const [autoResponseEnabled, setAutoResponseEnabled] = React.useState(() => getAutoResponseEnabled());
    const [bonusDiceResponseEnabled, setBonusDiceResponseEnabled] = React.useState(() => (
        getBonusDiceResponseEnabled(getAutoResponseEnabled())
    ));

    const isGameOver = rawG.sys.gameover;
    const resolveMatchFallbackName = React.useCallback((playerId: string) => `P${Number(playerId) + 1}`, []);
    const resolveMatchPreferredOrder = React.useCallback(
        ({ core: dtCore }: { core?: typeof G | null }) => (dtCore ? getSeatingOrder(dtCore) : undefined),
        [],
    );
    const resolveMatchTurnPlayerId = React.useCallback(
        ({ core: dtCore }: { core?: typeof G | null }) => dtCore?.activePlayerId,
        [],
    );
    const playerViewOptions = React.useMemo(() => ({
        state: rawG,
        core: G,
        playerID,
        matchData,
        getFallbackName: resolveMatchFallbackName,
        resolvePreferredOrder: resolveMatchPreferredOrder,
        resolveTurnPlayerId: resolveMatchTurnPlayerId,
    }), [
        G,
        matchData,
        playerID,
        rawG,
        resolveMatchFallbackName,
        resolveMatchPreferredOrder,
        resolveMatchTurnPlayerId,
    ]);
    const playerView = useMatchPlayerViewModel(playerViewOptions);
    const rootPid = playerView.selfPlayerId ?? '0';
    const player = G.players[rootPid] || G.players['0'];
    const currentPhase = access.turnPhase;
    const playerNames = playerView.playerNames;
    const isResponseWindowOpen = !!rawG.sys.responseWindow?.current;
    const currentResponseWindow = rawG.sys.responseWindow?.current;
    const currentResponderIndex = rawG.sys.responseWindow?.current?.currentResponderIndex;
    const currentResponderId = rawG.sys.responseWindow?.current
        ? rawG.sys.responseWindow.current.responderQueue[rawG.sys.responseWindow.current.currentResponderIndex]
        : undefined;
    const isDirectDiceActor = React.useMemo(
        () => isDirectDiceInterferenceActor(G, currentResponseWindow, rootPid),
        [G, currentResponseWindow, rootPid],
    );
    const isResponseActorOnMyTeam = Boolean(
        isResponseWindowOpen && currentResponderId && (currentResponderId === rootPid || isDirectDiceActor),
    );
    const isBonusDiceResponseWindow = Boolean(
        currentResponseWindow?.windowType === 'afterRollConfirmed'
        && shouldOpenAfterRollConfirmedForBonusSettlement(G.pendingBonusDiceSettlement),
    );
    const manualResponseEnabledForCurrentWindow = resolveManualResponseEnabledForWindow({
        autoResponseEnabled,
        bonusDiceResponseEnabled,
        isBonusDiceResponseWindow,
    });
    const isManualSelfResponseWindow = Boolean(
        isResponseWindowOpen && currentResponderId === rootPid && manualResponseEnabledForCurrentWindow,
    );
    const playerOrder = playerView.orderedPlayerIds;
    const otherPids = React.useMemo(() => playerOrder.filter(pid => pid !== rootPid), [playerOrder, rootPid]);
    const defaultFocusedPid = React.useMemo(() => {
        const defensiveTargetPid = G.pendingAttack?.defenderId;
        if (defensiveTargetPid && defensiveTargetPid !== rootPid) {
            return defensiveTargetPid;
        }

        if (isResponseWindowOpen && isResponseActorOnMyTeam) {
            const responseSourcePid = G.pendingDamage?.sourcePlayerId ?? G.pendingAttack?.sourcePlayerId;
            if (responseSourcePid && responseSourcePid !== rootPid) {
                return responseSourcePid;
            }
        }

        const activeOpponentPid = G.activePlayerId !== rootPid && !areTeammates(G, rootPid, G.activePlayerId)
            ? G.activePlayerId
            : undefined;

        return activeOpponentPid ?? getOpponents(G, rootPid)[0] ?? otherPids[0] ?? rootPid;
    }, [G, rootPid, isResponseWindowOpen, isResponseActorOnMyTeam, otherPids]);
    const [focusedPid, setFocusedPid] = React.useState(() => defaultFocusedPid);
    const otherPid = focusedPid;
    const opponent = G.players[otherPid];
    const opponentName = playerNames[otherPid] ?? t('common.opponent');

    React.useEffect(() => {
        if (otherPids.length === 0) {
            return;
        }

        if (!otherPids.includes(focusedPid)) {
            setFocusedPid(defaultFocusedPid);
            return;
        }

        const defensiveTargetPid = currentPhase === 'defensiveRoll' && G.pendingAttack?.defenderId !== rootPid
            ? G.pendingAttack?.defenderId
            : undefined;
        const responseTargetPid = isResponseWindowOpen && isResponseActorOnMyTeam
            ? defaultFocusedPid
            : undefined;
        const nextFocusedPid = defensiveTargetPid ?? responseTargetPid;

        if (nextFocusedPid && nextFocusedPid !== focusedPid) {
            setFocusedPid(nextFocusedPid);
        }
    }, [
        otherPids,
        focusedPid,
        defaultFocusedPid,
        currentPhase,
        G.pendingAttack?.defenderId,
        rootPid,
        isResponseWindowOpen,
        isResponseActorOnMyTeam,
    ]);
    // 获取对手用户名

    // 从 access.turnPhase 读取阶段（单一权威：来自 sys.phase）

    // 重赛系统（通用 hook）
    const { overlayProps: _endgameProps, rematchState, vote: handleRematchVote } = useEndgame({
        result: isGameOver || undefined,
        playerID,
        reset,
        matchData,
        isMultiplayer,
    });

    useAutoSkipSelection({
        currentPhase,
        isSpectator,
        gameMode,
        rootPid,
        selectedCharacters: G.selectedCharacters,
        hostPlayerId: G.hostPlayerId,
        hostStarted: G.hostStarted,
        readyPlayers: G.readyPlayers,
        engineMoves,
    });


    // 判断游戏结果
    const isWinner = !!isGameOver && (
        isGameOver.winners?.includes(rootPid)
        ?? isGameOver.winner === rootPid
    );

    // 获取所有玩家名称映射
    // 音频系统
    useDiceThroneAudio({
        G,
        rawState: rawG,
        currentPlayerId: playerID ?? undefined,
        currentPhase,
        isGameOver: !!isGameOver,
        isWinner,
    });

    // 使用 useUIState Hook 整合20+个分散的UI状态
    const {
        magnify,
        isMagnifyOpen,
        setMagnifiedImage,
        setMagnifiedCard,
        setMagnifiedCards,
        closeMagnify,
        modals,
        openModal: openUiModal,
        closeModal: closeUiModal,
        viewMode: manualViewMode,
        setViewMode,
        toggleViewMode,
        isLayoutEditing,
        toggleLayoutEditing,
        isTipOpen,
        toggleTip,
        headerError,
        showHeaderError,
        isRolling,
        setIsRolling,
        rerollingDiceIds,
        setRerollingDiceIds,
        rerollAnimationSeq,
        setRerollAnimationSeq,
        activatingAbilityId,
        setActivatingAbilityId,
        discardHighlighted,
        setDiscardHighlighted,
        sellButtonVisible,
        setSellButtonVisible,
        coreAreaHighlighted,
        setCoreAreaHighlighted,
        lastUndoCardId,
        setLastUndoCardId,
    } = useUIState();

    // 防御方/观察者关闭 displayOnly 奖励骰面板后，不再重复弹出
    const [dismissedBonusDiceId, setDismissedBonusDiceId] = React.useState<string | null>(null);
    // settlement 变化时自动重置（新一轮奖励骰）
    const currentSettlementId = G.pendingBonusDiceSettlement?.id;
    React.useEffect(() => {
        if (currentSettlementId && currentSettlementId !== dismissedBonusDiceId) {
            setDismissedBonusDiceId(null);
        }
    }, [currentSettlementId, dismissedBonusDiceId]);

    // Atlas 配置（状态图标仍需异步加载）
    const [statusIconAtlas, setStatusIconAtlas] = React.useState<StatusAtlases | null>(null);

    // 使用 useCardSpotlight Hook 管理卡牌和额外骰子特写
    const {
        cardSpotlightQueue,
        handleCardSpotlightClose,
        bonusDie,
        handleBonusDieClose,
    } = useCardSpotlight({
        eventStreamEntries: rawG.sys.eventStream?.entries ?? [],
        currentPlayerId: rootPid,
        opponentName,
        isSpectator,
        selectedCharacters: G.selectedCharacters,
        cacheScope: rawG.sys.matchId
            ?? `${Object.entries(G.selectedCharacters ?? {})
                .map(([pid, characterId]) => `${pid}:${characterId}`)
                .sort()
                .join('|') || 'unselected'}`,
        suppressStandaloneBonusDie: Boolean(
            G.pendingBonusDiceSettlement
            && (
                shouldUseRightTrayForPendingBonusDice(G.pendingBonusDiceSettlement)
                || !G.pendingBonusDiceSettlement.displayOnly
            )
            && G.pendingBonusDiceSettlement.attackerId === rootPid
        ),
        suppressBonusDiceInCardSpotlight: shouldUseRightTrayForPendingBonusDice(G.pendingBonusDiceSettlement),
    });

    const shouldHidePendingDisplayOnlyBonusOverlay = shouldSuppressPendingDisplayOnlyBonusOverlay({
        settlement: G.pendingBonusDiceSettlement,
        cardSpotlightQueue,
        viewerPlayerId: rootPid,
    });
    const displayOnlyBonusDiceSettlement = React.useMemo(() => {
        const settlement = G.pendingBonusDiceSettlement;
        if (!settlement) {
            return undefined;
        }
        if (dismissedBonusDiceId === settlement.id) {
            return undefined;
        }
        if (shouldUseRightTrayForPendingBonusDice(settlement)) {
            return undefined;
        }
        if (settlement.displayOnly) {
            if (shouldHidePendingDisplayOnlyBonusOverlay) {
                return undefined;
            }
            return settlement;
        }
        if (settlement.attackerId === rootPid) {
            return undefined;
        }
        if (shouldHidePendingDisplayOnlyBonusOverlay) {
            return undefined;
        }
        return { ...settlement, displayOnly: true };
    }, [G.pendingBonusDiceSettlement, dismissedBonusDiceId, rootPid, shouldHidePendingDisplayOnlyBonusOverlay]);
    const foregroundBonusDiceSettlement = React.useMemo(() => {
        if (displayOnlyBonusDiceSettlement) {
            return displayOnlyBonusDiceSettlement;
        }

        const settlement = G.pendingBonusDiceSettlement;
        if (!settlement?.displayOnly || dismissedBonusDiceId === settlement.id || shouldUseRightTrayForPendingBonusDice(settlement)) {
            return undefined;
        }
        return settlement;
    }, [G.pendingBonusDiceSettlement, dismissedBonusDiceId, displayOnlyBonusDiceSettlement]);
    const interactiveBonusDiceSettlement = React.useMemo(() => (
        resolveInteractivePendingBonusDiceSettlement({
            settlement: G.pendingBonusDiceSettlement,
            viewerPlayerId: rootPid,
            interactionState: rawG.sys.interaction,
            responseWindowState: rawG.sys.responseWindow,
        })
    ), [G.pendingBonusDiceSettlement, rawG.sys.interaction, rawG.sys.responseWindow, rootPid]);

    useDieRerollAnimationConsumer({
        eventStreamEntries: rawG.sys.eventStream?.entries ?? [],
        setRerollingDiceIds,
        setRerollAnimationSeq,
    });

    // 追踪已激活的攻击修正卡
    const { activeModifiers } = useActiveModifiers({
        eventStreamEntries: rawG.sys.eventStream?.entries ?? [],
    });

    // 防御阶段进攻技能特写
    const attackerAbilityLevels = React.useMemo(() => {
        const result: Record<string, Record<string, number>> = {};
        for (const pid of Object.keys(G.players)) {
            result[pid] = G.players[pid]?.abilityLevels ?? {};
        }
        return result;
    }, [G.players]);

    const {
        isShowcaseVisible: isAttackShowcaseVisible,
        showcaseData: attackShowcaseData,
        mode: attackShowcaseMode,
        autoDismissMs: attackShowcaseAutoDismissMs,
        dismissShowcase: dismissAttackShowcase,
    } = useAttackShowcase({
        currentPhase,
        currentPlayerId: rootPid,
        isSpectator,
        selectedCharacters: G.selectedCharacters,
        abilityLevels: attackerAbilityLevels,
        pendingAttack: G.pendingAttack ?? null,
        state: G,
    });

    // 使用 FX 引擎
    const fxBus = useFxBus(diceThroneFxRegistry, {
        playSound: (key) => {
            // 音效由 FeedbackPack 自动触发，这里只是注入播放函数
            playSoundFn(key);
        },
        triggerShake: (_intensity, _type) => {
            // 受击反馈现在由 onEffectImpact 根据目标 playerId 精确触发，
            // 不再在全局 triggerShake 中触发（无法区分目标）
        },
    });
    const opponentImpact = useImpactFeedback();
    const selfImpact = useImpactFeedback();
    const { triggerGlow: triggerAbilityGlow } = usePulseGlow(800);

    // DOM 引用
    const opponentHpRef = React.useRef<HTMLDivElement>(null);
    const selfHpRef = React.useRef<HTMLDivElement>(null);
    const opponentCpRef = React.useRef<HTMLDivElement>(null);
    const selfCpRef = React.useRef<HTMLDivElement>(null);
    const opponentBuffRef = React.useRef<HTMLDivElement>(null);
    const opponentHeaderRef = React.useRef<HTMLDivElement>(null);
    const selfBuffRef = React.useRef<HTMLDivElement>(null);
    const drawDeckRef = React.useRef<HTMLDivElement>(null);
    const discardPileRef = React.useRef<HTMLDivElement>(null);
    const abilityOverlaysRef = React.useRef<AbilityOverlaysHandle>(null);

    // 使用 useInteractionState Hook 管理交互状态（从 sys.interaction 读取）
    const sysInteraction = rawG.sys.interaction?.current;
    const activeResolutionFrameId = rawG.sys.resolution?.activeFrameId;
    const compareRollInteraction = asCompareRollChoice(sysInteraction);
    const pendingInteraction: InteractionDescriptor | undefined = sysInteraction?.kind === 'dt:card-interaction'
        ? sysInteraction.data as InteractionDescriptor
        : undefined;
    const { localState: localInteraction, handlers: interactionHandlers } = useInteractionState(pendingInteraction);

    // 骰子多步交互（multistep-choice，替代旧的 dt:card-interaction 骰子类型）
    // 注意：MultistepChoiceData 里的函数（localReducer/toCommands）经过 JSON 序列化后会丢失，
    // 必须在客户端根据 meta 重新注入，不能依赖从服务端传来的 data 字段。
    const diceMultistepInteraction = React.useMemo(() => {
        if (sysInteraction?.kind !== 'multistep-choice') return undefined;
        const meta = (sysInteraction.data as Record<string, unknown>)?.meta as Record<string, unknown> | undefined;
        if (!meta) return undefined;

        if (meta.dtType === 'modifyDie') {
            const config = meta.dieModifyConfig as DiceModifyConfig | undefined;
            const isManualConfirmMode = config?.mode === 'any' || config?.mode === 'adjust';
            const originalData = sysInteraction.data as Record<string, unknown>;
            const selectCount = Number(meta.selectCount) || 1;
            return {
                ...sysInteraction,
                data: {
                    ...sysInteraction.data,
                    initialResult: (originalData.initialResult as DiceModifyResult | undefined)
                        ?? { modifications: {}, modCount: 0, totalAdjustment: 0 },
                    localReducer: (current: unknown, step: unknown) =>
                        diceModifyReducer(current as DiceModifyResult, step as DiceModifyStep, config, selectCount),
                    toCommands: (result: DiceModifyResult) => diceModifyToCommands(result, selectCount),
                    getCompletedSteps: (result: DiceModifyResult) => result.modCount,
                    // any/adjust 模式：手动确认，禁用 auto-confirm
                    maxSteps: isManualConfirmMode ? undefined : originalData.maxSteps,
                    minSteps: isManualConfirmMode ? 1 : originalData.minSteps,
                },
            };
        }

        if (meta.dtType === 'selectDie') {
            const originalData = sysInteraction.data as Record<string, unknown>;
            const selectCount = Number(meta.selectCount) || 1;
            return {
                ...sysInteraction,
                data: {
                    ...sysInteraction.data,
                    initialResult: { selectedDiceIds: [] } as DiceSelectResult,
                    localReducer: (current: unknown, step: unknown) =>
                        diceSelectReducer(current as DiceSelectResult, step as DiceSelectStep, selectCount),
                    toCommands: (result: DiceSelectResult) => diceSelectToCommands(result, selectCount),
                    getCompletedSteps: (result: DiceSelectResult) => result.selectedDiceIds.length,
                    maxSteps: undefined,
                    minSteps: 1,
                    allowedDieIds: originalData.allowedDieIds,
                    completedDieIds: originalData.completedDieIds,
                },
            };
        }

        return undefined;
    }, [sysInteraction]);
    const diceMultistepState = useMultistepInteraction<DiceModifyStep | DiceSelectStep, DiceModifyResult | DiceSelectResult>(
        diceMultistepInteraction,
        dispatch,
    );
    // 追踪取消交互时返回的卡牌ID
    const prevInteractionRef = React.useRef<typeof pendingInteraction>(undefined);
    React.useEffect(() => {
        if (prevInteractionRef.current && !pendingInteraction) {
            setLastUndoCardId(prevInteractionRef.current.sourceCardId);
        }
        prevInteractionRef.current = pendingInteraction;
    }, [pendingInteraction, setLastUndoCardId]);

    // Token 响应状态
    const pendingDamage = G.pendingDamage;
    const isTokenResponseInteraction = sysInteraction?.kind === 'dt:token-response';
    const tokenResponsePhase: TokenResponsePhase | null = pendingDamage
        ? (pendingDamage.responderId === pendingDamage.sourcePlayerId ? 'attackerBoost' : 'defenderMitigation')
        : null;
    const isTokenResponder = pendingDamage && (pendingDamage.responderId === rootPid);

    // 领域层计算当前阶段可用的 Token 列表（唯一数据源）
    const usableTokens = React.useMemo(() => {
        if (!pendingDamage) return [];
        return getUsableTokensForTiming(G, pendingDamage.responderId, pendingDamage.responseType);
    }, [G, pendingDamage]);

    const tokenUsableOverrides = React.useMemo(() => {
        if (!pendingDamage) return undefined;
        const pid = pendingDamage.responderId;
        const overrides: Record<string, number> = {};

        for (const tokenDef of usableTokens) {
            const total = G.players[pid]?.tokens[tokenDef.id] ?? 0;
            const usable = getUsableTokenAmountForTiming(G, pid, tokenDef.id, pendingDamage.responseType);
            if (usable < total) {
                overrides[tokenDef.id] = usable;
            }
        }

        return Object.keys(overrides).length > 0 ? overrides : undefined;
    }, [G, pendingDamage, usableTokens]);

    const isActivePlayer = G.activePlayerId === rootPid;

    // 响应窗口状态
    // 自动跳过逻辑：
    // - 总响应关闭：所有响应窗口自动让过
    // - 奖励骰响应关闭：仅奖励骰 afterRollConfirmed 响应窗口自动让过
    React.useEffect(() => {
        const shouldAutoPass = shouldAutoPassResponseWindow({
            autoResponseEnabled,
            bonusDiceResponseEnabled,
            isBonusDiceResponseWindow,
        });
        if (!shouldAutoPass || !isResponseWindowOpen || !currentResponderId || currentResponderId !== rootPid) return;
        // 延迟一小段时间确保 UI 状态同步
        const timer = setTimeout(() => {
            engineMoves.responsePass(currentResponderId);
        }, 300);
        return () => clearTimeout(timer);
    }, [
        autoResponseEnabled,
        bonusDiceResponseEnabled,
        isBonusDiceResponseWindow,
        isResponseWindowOpen,
        currentResponderId,
        rootPid,
        engineMoves,
    ]);

    const { rollerId, shouldAutoObserve, viewMode, isSelfView } = computeViewModeState({
        currentPhase,
        pendingAttack: G.pendingAttack,
        activePlayerId: G.activePlayerId,
        rootPlayerId: rootPid,
        manualViewMode,
        isResponseWindowOpen,
        currentResponderId,
        pendingDamage,
        isTeamDirectActor: isDirectDiceActor,
    });

    const responseViewSuggestionKey = getResponseViewSuggestionKey({
        rootPlayerId: rootPid,
        isResponseWindowOpen,
        currentResponderId,
        currentResponderIndex,
        pendingDamage,
        isTeamDirectActor: isDirectDiceActor,
    });
    const responseAutoViewSessionRef = React.useRef<{
        suggestionKey: string;
        restoreMode: 'self' | 'opponent';
    } | null>(null);

    React.useEffect(() => {
        const transition = resolveResponseAutoViewTransition({
            currentSuggestionKey: responseViewSuggestionKey,
            autoResponseEnabled: manualResponseEnabledForCurrentWindow,
            manualViewMode,
            session: responseAutoViewSessionRef.current,
        });

        responseAutoViewSessionRef.current = transition.nextSession;

        if (transition.nextViewMode && transition.nextViewMode !== manualViewMode) {
            setViewMode(transition.nextViewMode);
        }
    }, [responseViewSuggestionKey, manualResponseEnabledForCurrentWindow, manualViewMode, setViewMode]);

    const isFourPlayerView = otherPids.length > 1;
    const handleOpponentHeaderSelect = React.useCallback((targetPid: string) => {
        if (shouldAutoObserve) return;

        if (targetPid !== focusedPid || isSelfView) {
            setFocusedPid(targetPid);
            setViewMode('opponent');
            return;
        }

        if (isFourPlayerView) {
            setViewMode('self');
            return;
        }

        toggleViewMode();
    }, [shouldAutoObserve, focusedPid, isSelfView, isFourPlayerView, setViewMode, toggleViewMode]);

    const viewPid = isSelfView ? rootPid : otherPid;
    const viewPlayer = (isSelfView ? player : opponent) || player;
    const isRollPhase = currentPhase === 'offensiveRoll' || currentPhase === 'targetingRoll' || currentPhase === 'defensiveRoll';
    const isViewRolling = viewPid === rollerId;
    const rollConfirmed = G.rollConfirmed;
    
    // availableAbilityIds 计算：
    // 1. 响应窗口打开时，显示响应者的可用技能（不限于掷骰阶段）
    // 2. 掷骰阶段，显示掷骰者的可用技能
    // 3. 其他情况，不显示技能
    const availableAbilityIds = React.useMemo(() => {
        // 响应窗口打开时，显示当前响应者的可用技能
        if (isResponseWindowOpen && currentResponderId) {
            // 如果当前视角是响应者，显示响应者的可用技能
            if (viewPid === currentResponderId) {
                // 响应窗口期间，使用 getAvailableAbilityIds 计算可用技能
                // 注意：这里需要传入响应者的 ID 和当前阶段
                return getAvailableAbilityIds(G, currentResponderId, currentPhase);
            }
            return [];
        }
        // 掷骰阶段，显示掷骰者的可用技能
        return isViewRolling ? access.availableAbilityIds : [];
    }, [isResponseWindowOpen, currentResponderId, viewPid, isViewRolling, access.availableAbilityIds, G, currentPhase]);
    
    const availableAbilityIdsForRoller = access.availableAbilityIds;
    const selectedAbilityId = currentPhase === 'defensiveRoll'
        ? (isViewRolling ? G.pendingAttack?.defenseAbilityId : undefined)
        : currentPhase === 'offensiveRoll'
            ? (isViewRolling ? G.pendingAttack?.sourceAbilityId : undefined)
            : undefined;
    const canOperateView = isSelfView && !isSpectator;
    const hasRolled = G.rollCount > 0;
    const [rerollSelectingAction, setRerollSelectingAction] = React.useState<{ passiveId: string; actionIndex: number } | null>(null);

    // 焦点玩家判断（统一的操作权判断）
    const isFocusPlayer = !isSpectator && access.focusPlayerId === rootPid;
    const _hasPendingInteraction = Boolean(pendingInteraction);
    // 阶段推进权限：从 useDiceThroneState 获取（领域校验 + 交互判断），叠加焦点玩家判断
    // 进攻技能特写期间阻止所有操作
    const canAdvancePhase = isFocusPlayer && access.canAdvancePhase && !isAttackShowcaseVisible;
    const canResolveChoice = Boolean(choice.hasChoice && choice.playerId === rootPid);
    const isDuelDirectDefenseOnly = false;
    const diceInteractionPlayerId = diceMultistepInteraction?.playerId != null
        ? String(diceMultistepInteraction.playerId)
        : undefined;
    const canInteractDice = canInteractDiceForCurrentBoard({
        isSpectator,
        isSelfView,
        isViewRolling,
        isAttackShowcaseVisible,
        isDuelDirectDefenseOnly,
        isManualSelfResponseWindow,
        isDirectDiceActor,
        currentResponderId,
        rootPid,
        diceInteractionPlayerId,
        boardDice3dEnabled,
        isRollPhase,
        rollCount: G.rollCount,
        isRolling,
        hasPassiveRerollSelection: !!rerollSelectingAction,
        hasDiceMultistepInteraction: !!diceMultistepInteraction,
    });

    // 防御阶段进入时就应高亮可用的防御技能，不需要等投骰
    // 响应窗口打开时，如果本地玩家是响应者，也应该高亮可用技能
    const canHighlightAbility = (
        (canOperateView && isViewRolling && isRollPhase && (currentPhase === 'defensiveRoll' || hasRolled))
        || isManualSelfResponseWindow
    ) && !isAttackShowcaseVisible;
    const canSelectAbility = (
        (canOperateView && isViewRolling && isRollPhase && (currentPhase === 'defensiveRoll' ? true : G.rollConfirmed))
        || isManualSelfResponseWindow
    ) && !isAttackShowcaseVisible;

    // 同一 slot 多 variant 选择：玩家点击 slot 时，如果该 slot 有多个 variant 同时满足，弹窗让玩家选
    const [abilityChoiceOptions, setAbilityChoiceOptions] = React.useState<AbilityChoiceOption[]>([]);

    // 响应窗口状态已在上方声明（380-381行），这里直接使用
    const responseWindow = access.responseWindow;
    const isResponder = isManualSelfResponseWindow;
    const canPlayHandCards = canPlayHandCardsForCurrentBoard({
        isSpectator,
        isActivePlayer,
        isResponder,
        isDirectDiceActor,
        currentPhase,
        rootPid,
        rollerId,
    });
    const canInteractHand = canInteractHandForCurrentBoard({ isSpectator });

    // （variant 选择弹窗由 onSelectAbility 回调触发，不需要自动弹出）

    // 自己的手牌永远显示
    const handOwner = player;

    // 计算响应窗口中可响应的卡牌 ID 集合（用于高亮）
    const respondableCardIds = React.useMemo(() => {
        if (!isResponseWindowOpen || !responseWindow?.windowType) return undefined;
        
        // 如果本地玩家是响应者，高亮本地玩家的可响应卡牌（无论当前视角是谁）
        // 修复：使用 rootPid 而不是 viewPid，因为响应时视角会自动切换到对手
        if (currentResponderId && (rootPid === currentResponderId || isDirectDiceActor)) {
            const cardIds = new Set(
                getPlayableCardsInResponseWindow(G, rootPid, responseWindow.windowType, currentPhase)
                    .map((card) => card.id),
            );
            return cardIds.size > 0 ? cardIds : undefined;
        }
        
        return undefined;
    }, [isResponseWindowOpen, currentResponderId, rootPid, isDirectDiceActor, responseWindow?.windowType, G, currentPhase]);

    // 检测当前响应者是否离线，如果离线则自动跳过
    const isResponderOffline = React.useMemo(() => {
        if (!isResponseWindowOpen || !currentResponderId) return false;
        const responderData = findMatchPlayerInfo(matchData, currentResponderId);
        // 如果找不到或者 isConnected 为 false，认为离线
        return responderData ? responderData.isConnected === false : false;
    }, [isResponseWindowOpen, currentResponderId, matchData]);

    // 当检测到当前响应者离线时，自动代替他跳过响应
    // 注：只有当自己是活跃玩家时才执行（避免双方都发送 pass）
    React.useEffect(() => {
        if (isResponderOffline && isActivePlayer && currentResponderId && currentResponderId !== rootPid) {
            console.warn('[Board] offline auto-pass triggered', { isResponderOffline, isActivePlayer, currentResponderId, rootPid });
            // 延迟一小段时间确保 UI 状态同步
            const timer = setTimeout(() => {
                engineMoves.responsePass(currentResponderId);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isResponderOffline, isActivePlayer, currentResponderId, rootPid, engineMoves]);

    // 教学模式：若响应窗口轮到“非本地玩家”，自动跳过，避免卡在对手思考中
    React.useEffect(() => {
        if (gameMode?.mode !== 'tutorial') return;
        if (!isResponseWindowOpen || !currentResponderId || currentResponderId === rootPid) return;
        console.warn('[Board] 🔴 AUTO-SKIP TRIGGERED (Tutorial)', {
            gameMode: gameMode?.mode,
            currentResponderId,
            rootPid,
            reason: '教学模式下对手自动跳过'
        });
        const timer = setTimeout(() => {
            engineMoves.responsePass(currentResponderId);
        }, 100);
        return () => clearTimeout(timer);
    }, [gameMode?.mode, isResponseWindowOpen, currentResponderId, rootPid, engineMoves]);
    // 切换到对手视角时也显示下一阶段按钮（禁用状态），保持 UI 一致性
    const showAdvancePhaseButton = !isSpectator;
    const handleCancelInteraction = React.useCallback(() => {
        if (pendingInteraction?.sourceCardId) {
            setLastUndoCardId(pendingInteraction.sourceCardId);
        }
        // 使用 InteractionSystem 的 CANCEL 命令取消当前交互
        dispatch(INTERACTION_COMMANDS.CANCEL, { interactionId: pendingInteraction?.id });
    }, [dispatch, pendingInteraction, setLastUndoCardId]);
    const handlePendingBonusSettlementClose = React.useCallback((settlement?: PendingBonusDiceSettlement) => {
        boardBonusDieLogger.info('overlay-close-request', {
            hasSettlement: !!settlement,
            settlementId: settlement?.id,
            settlementAttackerId: settlement?.attackerId,
            settlementDisplayOnly: settlement?.displayOnly,
            currentPlayerId: rootPid,
            rerollCount: settlement?.rerollCount,
            maxRerollCount: settlement?.maxRerollCount,
            diceValues: settlement ? getPendingBonusSettlementDice(settlement).map(die => die.value) : undefined,
        });
        handleBonusDieClose();

        if (!settlement) {
            boardBonusDieLogger.info('overlay-close-no-settlement');
            return;
        }

        const canSettleFromCurrentView = String(settlement.attackerId) === String(rootPid);
        if (canSettleFromCurrentView) {
            boardBonusDieLogger.info('overlay-close-settle-dispatch', {
                settlementId: settlement.id,
                reason: settlement.displayOnly ? 'attacker-display-only-close' : 'attacker-close',
            });
            engineMoves.skipBonusDiceReroll();
            return;
        }

        boardBonusDieLogger.info('overlay-close-local-only', {
            settlementId: settlement.id,
            reason: settlement.displayOnly ? 'display-only-close' : 'non-attacker-close',
        });
        setDismissedBonusDiceId(settlement.id);
    }, [engineMoves, handleBonusDieClose, rootPid]);

    // 骰子交互配置（需要在 waitingReason 之前定义）
    // 骰子交互现在走 multistep-choice，不再走 dt:card-interaction
    const isDiceInteraction = !!diceMultistepInteraction;
    // 只有交互所有者才能看到交互 UI
    const isInteractionOwner = !isSpectator && (
        pendingInteraction?.playerId === rootPid ||
        diceMultistepInteraction?.playerId === rootPid
    );

    // 等待对方思考（isFocusPlayer 已在上方定义）
    // 响应窗口期间不显示"对手思考中"提示，避免暴露对方有响应牌
    const isWaitingOpponent = !isFocusPlayer && !isResponseWindowOpen;
    const thinkingOffsetClass = 'bottom-[12vw]';

    // 可被净化移除的负面状态：由定义驱动（支持扩展）
    const purifiableStatusIds = (G.tokenDefinitions ?? [])
        .filter(def => def.category === 'debuff' && (def.passiveTrigger?.removable ?? true))
        .map(def => def.id);

    // 是否可以使用净化（有净化 Token 且有可移除的负面状态）
    const canUsePurify = !isSpectator && (player.tokens?.[TOKEN_IDS.PURIFY] ?? 0) > 0 &&
        (
            Object.entries(player.statusEffects ?? {}).some(([id, stacks]) => purifiableStatusIds.includes(id) && stacks > 0)
            || Object.entries(player.tokens ?? {}).some(([id, stacks]) => purifiableStatusIds.includes(id) && stacks > 0)
        );

    // 是否可以移除击倒（有击倒状态且 CP >= 2 且在 offensiveRoll 前的阶段）
    const canRemoveKnockdown = !isSpectator && isActivePlayer &&
        (currentPhase === 'upkeep' || currentPhase === 'income' || currentPhase === 'main1') &&
        (player.statusEffects?.[STATUS_IDS.KNOCKDOWN] ?? 0) > 0 &&
        (player.resources?.[RESOURCE_IDS.CP] ?? 0) >= 2;

    const handleCloseConfirmSkipModal = React.useCallback(() => {
        closeUiModal('confirmSkip');
    }, [closeUiModal]);

    const handleConfirmSkipModal = React.useCallback(() => {
        closeUiModal('confirmSkip');
        engineMoves.advancePhase();
    }, [closeUiModal, engineMoves]);

    const handleCancelPurifyModal = React.useCallback(() => {
        closeUiModal('purify');
    }, [closeUiModal]);

    const handleConfirmPurifyModal = React.useCallback((statusId: string) => {
        engineMoves.usePurify(statusId);
        closeUiModal('purify');
    }, [closeUiModal, engineMoves]);

    const handleCancelRemoveKnockdownModal = React.useCallback(() => {
        closeUiModal('removeKnockdown');
    }, [closeUiModal]);

    const handleConfirmRemoveKnockdownModal = React.useCallback(() => {
        closeUiModal('removeKnockdown');
        engineMoves.payToRemoveKnockdown();
    }, [closeUiModal, engineMoves]);

    const handleCloseAbilityChoiceModal = React.useCallback(() => {
        closeUiModal('abilityChoice');
        setAbilityChoiceOptions([]);
    }, [closeUiModal]);

    const handleSelectAbilityChoice = React.useCallback((abilityId: string) => {
        closeUiModal('abilityChoice');
        setAbilityChoiceOptions([]);
        engineMoves.selectAbility(abilityId);
    }, [closeUiModal, engineMoves]);
    const confirmSkipModalEntry = React.useMemo(() => ({
        onClose: handleCloseConfirmSkipModal,
        render: () => (
            <ConfirmSkipModal
                isOpen
                onCancel={handleCloseConfirmSkipModal}
                onConfirm={handleConfirmSkipModal}
            />
        ),
    }), [handleCloseConfirmSkipModal, handleConfirmSkipModal]);

    const purifyModalEntry = React.useMemo(() => ({
        closeOnBackdrop: false,
        closeOnEsc: false,
        onClose: handleCancelPurifyModal,
        render: () => (
            <PurifyModal
                playerState={player}
                purifiableStatusIds={purifiableStatusIds}
                onConfirm={handleConfirmPurifyModal}
                onCancel={handleCancelPurifyModal}
                locale={locale}
                statusIconAtlas={statusIconAtlas}
            />
        ),
    }), [
        handleCancelPurifyModal,
        handleConfirmPurifyModal,
        locale,
        player,
        purifiableStatusIds,
        statusIconAtlas,
    ]);

    const removeKnockdownModalEntry = React.useMemo(() => ({
        onClose: handleCancelRemoveKnockdownModal,
        render: () => (
            <ConfirmRemoveKnockdownModal
                isOpen
                onCancel={handleCancelRemoveKnockdownModal}
                onConfirm={handleConfirmRemoveKnockdownModal}
            />
        ),
    }), [handleCancelRemoveKnockdownModal, handleConfirmRemoveKnockdownModal]);

    const abilityChoiceModalEntry = React.useMemo(() => ({
        closeOnBackdrop: false,
        closeOnEsc: false,
        onClose: handleCloseAbilityChoiceModal,
        render: () => (
            <AbilityChoiceModal
                isOpen
                options={abilityChoiceOptions}
                onSelect={handleSelectAbilityChoice}
                onSkip={handleCloseAbilityChoiceModal}
            />
        ),
    }), [abilityChoiceOptions, handleCloseAbilityChoiceModal, handleSelectAbilityChoice]);

    useSyncedModalStackEntry({
        enabled: modals.confirmSkip,
        entryId: 'dicethrone_confirm_skip',
        entry: confirmSkipModalEntry,
    });
    useSyncedModalStackEntry({
        enabled: modals.purify,
        entryId: 'dicethrone_purify',
        entry: purifyModalEntry,
    });
    useSyncedModalStackEntry({
        enabled: modals.removeKnockdown,
        entryId: 'dicethrone_remove_knockdown',
        entry: removeKnockdownModalEntry,
    });
    useSyncedModalStackEntry({
        enabled: modals.abilityChoice,
        entryId: 'dicethrone_ability_choice',
        entry: abilityChoiceModalEntry,
    });

    // ========== 被动能力（如教皇税）==========
    const playerPassives = React.useMemo(
        () => getPlayerPassiveAbilities(G, rootPid),
        [G, rootPid]
    );

    const passiveActionUsability = React.useMemo(() => {
        const map = new Map<string, boolean[]>();
        for (const passive of playerPassives) {
            const usability = passive.actions.map((_, idx) =>
                !isSpectator && isPassiveActionUsable(G, rootPid, passive.id, idx, currentPhase)
            );
            map.set(passive.id, usability);
        }
        return map;
    }, [playerPassives, G, rootPid, currentPhase, isSpectator]);

    const handlePassiveActionClick = React.useCallback((passiveId: string, actionIndex: number) => {
        const passive = playerPassives.find(p => p.id === passiveId);
        if (!passive) return;
        const action = passive.actions[actionIndex];
        if (!action) return;

        if (action.type === 'rerollDie') {
            // 进入骰子选择模式
            setRerollSelectingAction({ passiveId, actionIndex });
        } else if (action.type === 'drawCard' || action.type === 'custom') {
            // 直接执行抽牌 / 自定义被动动作（如树精生命源泉、木苗树灵）
            engineMoves.usePassiveAbility(passiveId, actionIndex);
        }
    }, [playerPassives, engineMoves]);

    // 被动重掷：骰子选择回调
    const handlePassiveRerollDieSelect = React.useCallback((dieId: number) => {
        if (!rerollSelectingAction) return;
        // 不能重掷被锁定的骰子
        const die = G.dice.find(d => d.id === dieId);
        if (!die || die.isKept) return;
        engineMoves.usePassiveAbility(
            rerollSelectingAction.passiveId,
            rerollSelectingAction.actionIndex,
            dieId
        );
        setRerollSelectingAction(null);
    }, [rerollSelectingAction, engineMoves, G.dice]);

    const passiveAbilityProps = React.useMemo(() => {
        if (playerPassives.length === 0) return null;
        return {
            passives: playerPassives,
            actionUsability: passiveActionUsability,
            currentCp: player.resources[RESOURCE_IDS.CP] ?? 0,
            rerollSelectingAction,
            onActionClick: handlePassiveActionClick,
            onCancelRerollSelect: () => setRerollSelectingAction(null),
        };
    }, [playerPassives, passiveActionUsability, player.resources, rerollSelectingAction, handlePassiveActionClick]);
    const useBoardDiceStage = shouldUseBoardDiceStage({
        isSpectator,
        isSelfView,
        isViewRolling,
        isAttackShowcaseVisible,
        isDuelDirectDefenseOnly,
        isManualSelfResponseWindow,
        isDirectDiceActor,
        currentResponderId,
        rootPid,
        diceInteractionPlayerId,
        boardDice3dEnabled,
        isRollPhase,
        rollCount: G.rollCount,
        isRolling,
        hasPassiveRerollSelection: !!rerollSelectingAction,
        hasDiceMultistepInteraction: !!diceMultistepInteraction,
    });
    const showRailDiceTray = shouldShowRailDiceTray({
        useBoardDiceStage,
        hasKeptDice: G.dice.some((die) => die.isKept),
    });
    const duelAttackerDisplayDie = React.useMemo(() => createDuelAttackerDisplayDie(G, currentPhase), [G, currentPhase]);
    const duelDefenderDisplayDie = React.useMemo(() => createDuelDefenderDisplayDie(G, currentPhase), [G, currentPhase]);
    const pendingBonusDiceRoutedToRightTray = shouldUseRightTrayForPendingBonusDice(G.pendingBonusDiceSettlement);
    const bonusDiceTrayDice = React.useMemo(() => {
        const settlement = G.pendingBonusDiceSettlement;
        if (!settlement?.allowDiceModification) {
            return null;
        }

        if (!pendingBonusDiceRoutedToRightTray && !diceMultistepInteraction) {
            return null;
        }

        return createPendingBonusDiceTrayDice(G, settlement, !diceMultistepInteraction);
    }, [G, diceMultistepInteraction, pendingBonusDiceRoutedToRightTray]);
    const attackSnapshotInteractionDice = React.useMemo(() => {
        if (!diceMultistepInteraction || currentPhase !== 'defensiveRoll') return null;
        const data = diceMultistepInteraction.data as { allowedDieIds?: number[] } | undefined;
        const allowedDieIds = Array.isArray(data?.allowedDieIds) ? data.allowedDieIds : [];
        if (!allowedDieIds.some(dieId => dieId >= ATTACK_SNAPSHOT_DIE_ID_OFFSET)) return null;

        const pendingAttack = G.pendingAttack;
        const attackerId = pendingAttack?.attackerId;
        const attackDiceValues = pendingAttack?.attackDiceValues;
        const attackerCharacterId = attackerId ? G.players[attackerId]?.characterId : undefined;
        if (!attackerId || !Array.isArray(attackDiceValues) || !attackerCharacterId || attackerCharacterId === 'unselected') {
            return null;
        }

        const definitionId = `${attackerCharacterId}-dice`;
        return attackDiceValues.map((value, index) => {
            const symbol = getPlayerDieFace(G, attackerId, value);
            return {
                id: ATTACK_SNAPSHOT_DIE_ID_OFFSET + index,
                definitionId,
                value,
                symbol,
                symbols: symbol ? [symbol] : [],
                isKept: false,
                ownerId: attackerId,
                displayOnly: true,
            } as Die;
        });
    }, [G, currentPhase, diceMultistepInteraction]);
    const interactionDice = React.useMemo(() => {
        if (bonusDiceTrayDice) return bonusDiceTrayDice;
        if (attackSnapshotInteractionDice) return [...G.dice, ...attackSnapshotInteractionDice];
        return G.dice;
    }, [G.dice, attackSnapshotInteractionDice, bonusDiceTrayDice]);
    const rightSidebarDice = React.useMemo(() => {
        if (bonusDiceTrayDice) return bonusDiceTrayDice;
        const baseDice = getRailDiceForCurrentBoard(interactionDice, useBoardDiceStage);
        return duelAttackerDisplayDie ? [duelDefenderDisplayDie ?? baseDice[0] ?? G.dice[0], duelAttackerDisplayDie].filter(Boolean) : baseDice;
    }, [G.dice, bonusDiceTrayDice, duelAttackerDisplayDie, duelDefenderDisplayDie, interactionDice, useBoardDiceStage]);
    const boardStageDice = React.useMemo(() => {
        return duelAttackerDisplayDie ? [duelDefenderDisplayDie ?? interactionDice[0] ?? G.dice[0], duelAttackerDisplayDie].filter(Boolean) : interactionDice;
    }, [G.dice, duelAttackerDisplayDie, duelDefenderDisplayDie, interactionDice]);
    const rightTrayBonusDiceSettlement = pendingBonusDiceRoutedToRightTray
        ? G.pendingBonusDiceSettlement
        : undefined;
    const canConfirmBonusDiceFromRightTray = Boolean(
        rightTrayBonusDiceSettlement
        && !isSpectator
        && String(rightTrayBonusDiceSettlement.attackerId) === String(rootPid)
        && !rawG.sys.responseWindow?.current
        && !rawG.sys.interaction?.current
    );
    const handleConfirmBonusDiceFromRightTray = React.useCallback(() => {
        if (!canConfirmBonusDiceFromRightTray || !rightTrayBonusDiceSettlement) {
            return;
        }
        handlePendingBonusSettlementClose(rightTrayBonusDiceSettlement);
    }, [canConfirmBonusDiceFromRightTray, handlePendingBonusSettlementClose, rightTrayBonusDiceSettlement]);
    // 状态效果/玩家交互配置
    const isStatusInteraction = pendingInteraction && (
        pendingInteraction.type === 'selectStatus' ||
        pendingInteraction.type === 'selectPlayer' ||
        pendingInteraction.type === 'selectTargetStatus' ||
        pendingInteraction.type === 'selectHandCard'
    );

    const handleSelectStatus = interactionHandlers.selectStatus;
    const handleSelectPlayer = interactionHandlers.selectPlayer;
    const handleSelectHandCard = interactionHandlers.selectHandCard;

    const statusInteraction = React.useMemo(() => {
        if (!pendingInteraction || !isStatusInteraction) return pendingInteraction;

        let interaction = pendingInteraction;
        if (pendingInteraction.type === 'selectStatus' && pendingInteraction.transferConfig && localInteraction.selectedStatus) {
            interaction = {
                ...pendingInteraction,
                type: 'selectTargetStatus',
                transferConfig: {
                    ...pendingInteraction.transferConfig,
                    sourcePlayerId: localInteraction.selectedStatus.playerId,
                    statusId: localInteraction.selectedStatus.statusId,
                },
            };
        }

        const selected = (() => {
            if (interaction.type === 'selectPlayer') {
                return localInteraction.selectedPlayers.length > 0
                    ? localInteraction.selectedPlayers
                    : (interaction.selected ?? []);
            }
            if (interaction.type === 'selectHandCard') {
                return localInteraction.selectedCardIds.length > 0
                    ? localInteraction.selectedCardIds
                    : (interaction.selected ?? []);
            }
            if (interaction.type === 'selectTargetStatus' && interaction.transferConfig?.statusId) {
                return localInteraction.selectedPlayers.length > 0
                    ? localInteraction.selectedPlayers
                    : (interaction.selected ?? []);
            }
            if (interaction.type === 'selectStatus' || interaction.type === 'selectTargetStatus') {
                return localInteraction.selectedStatus
                    ? [localInteraction.selectedStatus.statusId]
                    : (interaction.selected ?? []);
            }
            return interaction.selected ?? [];
        })();

        return {
            ...interaction,
            selected,
        };
    }, [
        pendingInteraction,
        isStatusInteraction,
        localInteraction.selectedPlayers,
        localInteraction.selectedCardIds,
        localInteraction.selectedStatus,
    ]);

    const handleStatusInteractionConfirm = React.useCallback(() => {
        const activeInteraction = statusInteraction ?? pendingInteraction;
        if (!activeInteraction) return;

        if (activeInteraction.type === 'selectStatus') {
            // 移除单个状态
            if (localInteraction.selectedStatus) {
                engineMoves.removeStatus(
                    localInteraction.selectedStatus.playerId,
                    localInteraction.selectedStatus.statusId
                );
            }
        } else if (activeInteraction.type === 'selectPlayer') {
            // 根据交互意图决定操作
            if (localInteraction.selectedPlayers.length > 0) {
                engineMoves.resolveInteraction(localInteraction.selectedPlayers);
            }
        } else if (activeInteraction.type === 'selectHandCard') {
            if (localInteraction.selectedCardIds.length > 0) {
                engineMoves.resolveInteraction([], localInteraction.selectedCardIds);
            }
        } else if (activeInteraction.type === 'selectTargetStatus') {
            // 转移状态
            const transferConfig = activeInteraction.transferConfig;
            const selectedPlayerId = localInteraction.selectedPlayers[0];
            if (transferConfig?.sourcePlayerId && transferConfig?.statusId && selectedPlayerId) {
                engineMoves.transferStatus(
                    transferConfig.sourcePlayerId,
                    selectedPlayerId,
                    transferConfig.statusId
                );
            } else {
                return;
            }
        }
        // 交互命令执行后，systems.ts 会在状态/指示物事件到达时自动清理当前交互
    }, [
        engineMoves,
        localInteraction.selectedPlayers,
        localInteraction.selectedCardIds,
        localInteraction.selectedStatus,
        pendingInteraction,
        statusInteraction,
    ]);

    const tokenResponseModalEntry = React.useMemo(() => ({
        owner: {
            system: currentResponseWindow?.id ? 'response-window' : 'interaction',
            id: currentResponseWindow?.id ?? sysInteraction?.id ?? 'dicethrone_token_response',
            kind: currentResponseWindow?.windowType ?? sysInteraction?.kind,
            gameId: 'dicethrone',
            namespace: 'dicethrone',
            resolutionFrameId: currentResponseWindow?.resolutionFrameId ?? sysInteraction?.resolutionFrameId ?? activeResolutionFrameId,
            blocksProgress: true,
        },
        closeOnBackdrop: false,
        closeOnEsc: false,
        onClose: () => undefined,
        render: () => (
            <TokenResponseModal
                pendingDamage={pendingDamage!}
                responsePhase={tokenResponsePhase!}
                responderState={G.players[pendingDamage!.responderId]}
                usableTokens={usableTokens}
                tokenUsableOverrides={tokenUsableOverrides}
                onUseToken={(tokenId, amount) => engineMoves.useToken(tokenId, amount)}
                onSkip={() => engineMoves.skipTokenResponse()}
                locale={locale}
                lastEvasionRoll={pendingDamage!.lastEvasionRoll}
                statusIconAtlas={statusIconAtlas}
            />
        ),
    }), [G.players, activeResolutionFrameId, currentResponseWindow?.id, currentResponseWindow?.resolutionFrameId, currentResponseWindow?.windowType, engineMoves, locale, pendingDamage, statusIconAtlas, sysInteraction?.id, sysInteraction?.kind, sysInteraction?.resolutionFrameId, tokenResponsePhase, tokenUsableOverrides, usableTokens]);

    const statusInteractionModalEntry = React.useMemo(() => ({
        owner: statusInteraction ? {
            system: 'interaction',
            id: sysInteraction?.id ?? 'dicethrone_status_interaction',
            kind: statusInteraction.type,
            gameId: 'dicethrone',
            namespace: 'dicethrone',
            resolutionFrameId: sysInteraction?.resolutionFrameId ?? activeResolutionFrameId,
            blocksProgress: true,
        } : undefined,
        closeOnBackdrop: false,
        closeOnEsc: false,
        onClose: () => undefined,
        render: () => (
            <InteractionOverlay
                interaction={statusInteraction!}
                players={G.players}
                tokenDefinitions={G.tokenDefinitions}
                currentPlayerId={rootPid}
                playerNames={playerNames}
                seatingOrder={G.seatingOrder}
                teamIdByPlayerId={G.teamIdByPlayerId}
                onSelectStatus={handleSelectStatus}
                onSelectPlayer={handleSelectPlayer}
                onSelectHandCard={handleSelectHandCard}
                onConfirm={handleStatusInteractionConfirm}
                onCancel={handleCancelInteraction}
                statusIconAtlas={statusIconAtlas}
                locale={locale}
            />
        ),
    }), [
        G.players,
        G.seatingOrder,
        G.teamIdByPlayerId,
        G.tokenDefinitions,
        handleCancelInteraction,
        handleStatusInteractionConfirm,
        handleSelectPlayer,
        handleSelectHandCard,
        handleSelectStatus,
        locale,
        playerNames,
        rootPid,
        statusIconAtlas,
        sysInteraction?.id,
        sysInteraction?.resolutionFrameId,
        statusInteraction,
        activeResolutionFrameId,
    ]);

    const choiceModalEntry = React.useMemo(() => ({
        owner: choice.hasChoice ? {
            system: 'interaction',
            id: sysInteraction?.kind === 'simple-choice' ? sysInteraction.id : 'dicethrone_choice',
            kind: sysInteraction?.kind === 'simple-choice' ? sysInteraction.kind : 'simple-choice',
            gameId: 'dicethrone',
            namespace: 'dicethrone',
            resolutionFrameId: sysInteraction?.kind === 'simple-choice'
                ? (sysInteraction.resolutionFrameId ?? activeResolutionFrameId)
                : activeResolutionFrameId,
            blocksProgress: true,
        } : undefined,
        closeOnBackdrop: false,
        closeOnEsc: false,
        onClose: () => undefined,
        render: () => (
            <ChoiceModal
                choice={choice.hasChoice
                    ? {
                        title: choice.title ?? '',
                        options: choice.options,
                        slider: choice.slider,
                    }
                    : null}
                canResolve={canResolveChoice}
                onResolve={(optionId) => {
                    dispatch(INTERACTION_COMMANDS.RESPOND, { optionId, interactionId: sysInteraction?.id });
                }}
                onResolveWithValue={(optionId, mergedValue) => {
                    dispatch(INTERACTION_COMMANDS.RESPOND, { optionId, mergedValue, interactionId: sysInteraction?.id });
                }}
                locale={locale}
                statusIconAtlas={statusIconAtlas}
            />
        ),
    }), [activeResolutionFrameId, canResolveChoice, choice, dispatch, locale, statusIconAtlas, sysInteraction]);

    const defenderChoiceModalEntry = React.useMemo(() => ({
        owner: defenderChoice ? {
            system: 'interaction',
            id: defenderChoice.id,
            kind: 'dt:defender-choice',
            gameId: 'dicethrone',
            namespace: 'dicethrone',
            resolutionFrameId: sysInteraction?.kind === 'dt:defender-choice'
                ? (sysInteraction.resolutionFrameId ?? activeResolutionFrameId)
                : activeResolutionFrameId,
            blocksProgress: true,
        } : undefined,
        closeOnBackdrop: false,
        closeOnEsc: false,
        onClose: () => undefined,
        render: () => (
            <DefenderChoiceModal
                choice={defenderChoice}
                canSelect={Boolean(defenderChoice && defenderChoice.playerId === rootPid && !isSpectator)}
                onSelect={(defenderId) => engineMoves.selectDefenderTarget(defenderId)}
                players={G.players}
                playerNames={playerNames}
                currentPlayerId={rootPid}
                teamIdByPlayerId={G.teamIdByPlayerId}
                locale={locale}
            />
        ),
    }), [G.players, G.teamIdByPlayerId, activeResolutionFrameId, defenderChoice, engineMoves, isSpectator, locale, playerNames, rootPid, sysInteraction]);

    const compareRollModalEntry = React.useMemo(() => ({
        owner: compareRollInteraction ? {
            system: 'interaction',
            id: sysInteraction?.kind === 'compare-roll-choice' ? sysInteraction.id : compareRollInteraction.id,
            kind: 'compare-roll-choice',
            gameId: 'dicethrone',
            namespace: 'dicethrone',
            resolutionFrameId: sysInteraction?.kind === 'compare-roll-choice'
                ? (sysInteraction.resolutionFrameId ?? activeResolutionFrameId)
                : activeResolutionFrameId,
            blocksProgress: true,
        } : undefined,
        closeOnBackdrop: false,
        closeOnEsc: false,
        onClose: () => undefined,
        render: () => (
            <CompareRollOverlay
                compareRoll={compareRollInteraction}
                isVisible={true}
                canResolve={Boolean(compareRollInteraction && compareRollInteraction.playerId === rootPid && !isSpectator)}
                locale={locale}
                onResolveOption={(optionId) => {
                    dispatch(INTERACTION_COMMANDS.RESPOND, { optionId, interactionId: sysInteraction?.id });
                }}
                onConfirm={() => {
                    dispatch(INTERACTION_COMMANDS.CONFIRM, { interactionId: compareRollInteraction.id });
                }}
                usePortal={false}
            />
        ),
    }), [activeResolutionFrameId, compareRollInteraction, dispatch, isSpectator, locale, rootPid, sysInteraction]);

    const bonusDiceModalEntry = React.useMemo(() => ({
        owner: interactiveBonusDiceSettlement ? {
            system: 'interaction',
            id: sysInteraction?.kind === 'dt:bonus-dice' ? sysInteraction.id : `dt-bonus-dice-${interactiveBonusDiceSettlement.id}`,
            kind: 'dt:bonus-dice',
            gameId: 'dicethrone',
            namespace: 'dicethrone',
            resolutionFrameId: sysInteraction?.kind === 'dt:bonus-dice'
                ? (sysInteraction.resolutionFrameId ?? activeResolutionFrameId)
                : activeResolutionFrameId,
            blocksProgress: true,
        } : undefined,
        closeOnBackdrop: false,
        closeOnEsc: false,
        allowPointerThrough: Boolean(interactiveBonusDiceSettlement?.allowDiceModification),
        onClose: () => undefined,
        render: () => (
            <BonusDieOverlay
                isVisible={true}
                onClose={() => handlePendingBonusSettlementClose(interactiveBonusDiceSettlement)}
                locale={locale}
                bonusDice={interactiveBonusDiceSettlement ? getPendingBonusSettlementDice(interactiveBonusDiceSettlement) : undefined}
                canReroll={Boolean(
                    interactiveBonusDiceSettlement &&
                    (player.tokens?.[interactiveBonusDiceSettlement.rerollCostTokenId] ?? 0) >= (interactiveBonusDiceSettlement.rerollCostAmount ?? 1) &&
                    (interactiveBonusDiceSettlement.maxRerollCount === undefined
                        || interactiveBonusDiceSettlement.rerollCount < interactiveBonusDiceSettlement.maxRerollCount)
                )}
                rerollLimitReached={Boolean(
                    interactiveBonusDiceSettlement &&
                    interactiveBonusDiceSettlement.maxRerollCount !== undefined &&
                    interactiveBonusDiceSettlement.rerollCount >= interactiveBonusDiceSettlement.maxRerollCount
                )}
                onReroll={interactiveBonusDiceSettlement
                    ? (dieIndex) => {
                        boardBonusDieLogger.info('reroll-dispatch', {
                            settlementId: interactiveBonusDiceSettlement.id,
                            dieIndex,
                            rerollCount: interactiveBonusDiceSettlement.rerollCount,
                            maxRerollCount: interactiveBonusDiceSettlement.maxRerollCount,
                        });
                        engineMoves.rerollBonusDie(dieIndex);
                    }
                    : undefined}
                onSkipReroll={interactiveBonusDiceSettlement
                    ? () => {
                        boardBonusDieLogger.info('skip-reroll-dispatch', {
                            settlementId: interactiveBonusDiceSettlement.id,
                            rerollCount: interactiveBonusDiceSettlement.rerollCount,
                            maxRerollCount: interactiveBonusDiceSettlement.maxRerollCount,
                        });
                        engineMoves.skipBonusDiceReroll();
                    }
                    : undefined}
                showTotal={interactiveBonusDiceSettlement?.showTotal ?? !interactiveBonusDiceSettlement?.displayOnly}
                rerollCostAmount={interactiveBonusDiceSettlement?.rerollCostAmount}
                rerollCostTokenId={interactiveBonusDiceSettlement?.rerollCostTokenId}
                displayOnly={interactiveBonusDiceSettlement?.displayOnly}
                presentationKey={interactiveBonusDiceSettlement
                    ? `${interactiveBonusDiceSettlement.id}:reroll-${interactiveBonusDiceSettlement.rerollCount}`
                    : undefined}
                lastRerolledDieIndex={interactiveBonusDiceSettlement?.lastRerolledDieIndex}
                rerollPresentationKey={
                    interactiveBonusDiceSettlement && interactiveBonusDiceSettlement.rerollCount > 0
                        ? `${interactiveBonusDiceSettlement.id}:reroll-${interactiveBonusDiceSettlement.rerollCount}`
                        : undefined
                }
                summaryEffectKey={interactiveBonusDiceSettlement?.summaryEffectKey}
                summaryEffectParams={interactiveBonusDiceSettlement?.summaryEffectParams}
                characterId={interactiveBonusDiceSettlement ? G.selectedCharacters[interactiveBonusDiceSettlement.attackerId] : undefined}
                forceAutoCloseDelay={isTutorialMode ? 3000 : undefined}
                manualCloseOnly={!isTutorialMode}
                allowBackgroundInteraction={Boolean(interactiveBonusDiceSettlement?.allowDiceModification)}
                usePortal={false}
            />
        ),
    }), [G.selectedCharacters, activeResolutionFrameId, engineMoves, handlePendingBonusSettlementClose, interactiveBonusDiceSettlement, isTutorialMode, locale, player.tokens, sysInteraction]);

    useSyncedModalStackEntry({
        enabled: Boolean(
            isTokenResponseInteraction
            && pendingDamage
            && tokenResponsePhase
            && isTokenResponder
            && (
                usableTokens.length > 0
                || !!pendingDamage.lastEvasionRoll
                || Object.keys(pendingDamage.tokenUsageTotals ?? {}).length > 0
            ),
        ),
        entryId: 'dicethrone_token_response',
        entry: tokenResponseModalEntry,
    });

    useSyncedModalStackEntry({
        enabled: Boolean(isStatusInteraction && statusInteraction && (
            statusInteraction?.type !== 'selectHandCard' || isInteractionOwner
        )),
        entryId: 'dicethrone_status_interaction',
        entry: statusInteractionModalEntry,
    });

    useSyncedModalStackEntry({
        enabled: Boolean(compareRollInteraction),
        entryId: 'dicethrone_compare_roll',
        entry: compareRollModalEntry,
    });

    useSyncedModalStackEntry({
        enabled: Boolean(interactiveBonusDiceSettlement),
        entryId: 'dicethrone_bonus_dice',
        entry: bonusDiceModalEntry,
    });

    useSyncedModalStackEntry({
        enabled: Boolean(defenderChoice),
        entryId: 'dicethrone_defender_choice',
        entry: defenderChoiceModalEntry,
    });

    useSyncedModalStackEntry({
        enabled: Boolean(choice.hasChoice),
        entryId: 'dicethrone_choice',
        entry: choiceModalEntry,
    });

    const getAbilityStartPos = React.useCallback((abilityId?: string) => {
        if (!abilityId) return getElementCenter(opponentHeaderRef.current);

        // 防御阶段的 activePlayerId 仍是进攻方，不能只按 activePlayerId 查技能归属；
        // 否则防御技能（如 stand-tall / elusive-step / holy-defense / fearless-riposte）
        // 产生伤害时会找不到自己的技能槽位，退回到 opponentHeader。
        let baseAbilityId = abilityId;
        let ownerCharacterId: string | undefined;
        let ownerPlayerBoardFace: (typeof G.players)[string]['playerBoardFace'] | undefined;
        for (const pid of Object.keys(G.players)) {
            const match = findPlayerAbility(G, pid, abilityId);
            if (match) {
                baseAbilityId = match.ability.id;
                ownerCharacterId = G.selectedCharacters?.[pid];
                ownerPlayerBoardFace = G.players[pid]?.playerBoardFace;
                break;
            }
        }

        const slotId = getAbilitySlotIdForCharacter(ownerCharacterId, baseAbilityId, ownerPlayerBoardFace);
        if (!slotId) return getElementCenter(opponentHeaderRef.current);
        const element = document.querySelector(
            `[data-ability-slot-scope="main-board"][data-ability-slot="${slotId}"]`,
        ) as HTMLElement | null;
        // 技能槽在 DOM 中存在 → 从技能槽飞出（自己的技能）
        // 技能槽不存在 → 说明是对手的技能，从对手悬浮窗飞出
        return element ? getElementCenter(element) : getElementCenter(opponentHeaderRef.current);
    }, [G, opponentHeaderRef]);

    // 获取效果动画的起点位置（优先从技能槽位置获取）
    const getEffectStartPos = React.useCallback(
        (targetId?: string) => {
            // 优先级：lastEffectSourceByPlayerId > activatingAbilityId > pendingAttack.sourceAbilityId
            const sourceAbilityId =
                (targetId && access.lastEffectSourceByPlayerId?.[targetId]) ||
                G.activatingAbilityId ||
                G.pendingAttack?.sourceAbilityId;
            return getAbilityStartPos(sourceAbilityId);
        },
        [access.lastEffectSourceByPlayerId, G.activatingAbilityId, G.pendingAttack?.sourceAbilityId, getAbilityStartPos]
    );

    // 卡牌图集已在 cardAtlas.ts 模块顶层同步注册，无需异步加载

    React.useEffect(() => {
        let isActive = true;
        loadStatusAtlases(locale)
            .then((config) => {
                if (isActive) setStatusIconAtlas(config);
            })
            .catch(() => {
                if (isActive) setStatusIconAtlas(null);
            });
        return () => {
            isActive = false;
        };
    }, [locale]);

    const shouldBlockTutorialAction = React.useCallback((targetId: string) => {
        if (!isTutorialActive || !tutorialStep?.requireAction) return false;
        // highlightTarget 匹配 → 不拦截
        if (!tutorialStep.highlightTarget || tutorialStep.highlightTarget === targetId) return false;
        // allowedCommands 白名单包含该 targetId 对应的命令 → 不拦截
        const commands = TUTORIAL_TARGET_COMMAND_MAP[targetId];
        if (commands && tutorialStep.allowedCommands?.some(cmd => commands.includes(cmd))) return false;
        return true;
    }, [isTutorialActive, tutorialStep]);

    const advanceTutorialIfNeeded = React.useCallback((targetId: string) => {
        if (
            isTutorialActive
            && tutorialStep?.requireAction
            && tutorialStep.highlightTarget === targetId
        ) {
            nextTutorialStep();
        }
    }, [isTutorialActive, tutorialStep, nextTutorialStep]);

    const handleBoardAbilitySelect = React.useCallback((abilityId: string) => {
        if (shouldBlockTutorialAction('ability-slots')) return;
        if (currentPhase === 'offensiveRoll' && G.rollConfirmed) {
            const match = findPlayerAbility(G, rollerId, abilityId);
            const baseAbilityId = match?.ability.id ?? abilityId;
            const rollerCharacterId = G.selectedCharacters?.[rollerId];
            const rollerPlayerBoardFace = G.players[rollerId]?.playerBoardFace;
            const slotId = getAbilitySlotIdForCharacter(rollerCharacterId, baseAbilityId, rollerPlayerBoardFace);
            if (slotId) {
                const mapping = ABILITY_SLOT_MAP[slotId];
                if (mapping) {
                    const slotVariants = availableAbilityIdsForRoller.filter(id => {
                        const abilityMatch = findPlayerAbility(G, rollerId, id);
                        if (!abilityMatch) {
                            return false;
                        }
                        return slotContainsAbilityIdForCharacter(
                            rollerCharacterId,
                            slotId,
                            abilityMatch.ability.id,
                            rollerPlayerBoardFace,
                        );
                    });
                    if (slotVariants.length >= 2 && hasDivergentVariants(G, rollerId, slotVariants)) {
                        const options: AbilityChoiceOption[] = [];
                        for (const variantId of slotVariants) {
                            const abilityMatch = findPlayerAbility(G, rollerId, variantId);
                            if (!abilityMatch) continue;
                            const text = getAbilityChoiceText(variantId, abilityMatch, {
                                t: (key, options) => t(key, options),
                                exists: (key) => i18n.exists(key, { ns: 'game-dicethrone' }),
                            });
                            options.push({
                                abilityId: variantId,
                                name: text.name,
                                description: text.description,
                                slotId,
                            });
                        }

                        options.sort((a, b) => {
                            const leftMatch = findPlayerAbility(G, rollerId, a.abilityId);
                            const rightMatch = findPlayerAbility(G, rollerId, b.abilityId);
                            if (!leftMatch?.variant || !rightMatch?.variant) return 0;
                            const variants = leftMatch.ability.variants ?? [];
                            const leftIndex = variants.indexOf(leftMatch.variant);
                            const rightIndex = variants.indexOf(rightMatch.variant);
                            return leftIndex - rightIndex;
                        });

                        if (options.length >= 2) {
                            setAbilityChoiceOptions(options);
                            openUiModal('abilityChoice');
                            advanceTutorialIfNeeded('ability-slots');
                            return;
                        }
                    }
                }
            }
        }
        engineMoves.selectAbility(abilityId);
        advanceTutorialIfNeeded('ability-slots');
    }, [
        G,
        advanceTutorialIfNeeded,
        availableAbilityIdsForRoller,
        currentPhase,
        engineMoves,
        i18n,
        openUiModal,
        rollerId,
        shouldBlockTutorialAction,
        t,
    ]);

    const handleBoardHighlightedAbilityClick = React.useCallback(() => {
        if (currentPhase === 'offensiveRoll' && !G.rollConfirmed) {
            playDeniedSound();
            toast.warning(t('error.confirmRoll'), undefined, { dedupeKey: 'dicethrone.confirmRoll' });
        }
    }, [G.rollConfirmed, currentPhase, t, toast]);

    const handleAdvancePhase = () => {
        if (!canAdvancePhase) {
            if ((currentPhase === 'offensiveRoll' || currentPhase === 'targetingRoll') && !G.rollConfirmed) {
                showHeaderError(t('error.confirmRoll'));
            } else if (currentPhase === 'defensiveRoll' && !G.rollConfirmed) {
                showHeaderError(t('error.confirmDefenseRoll'));
            }
            return;
        }
        if (shouldBlockTutorialAction('advance-phase-button')) return;
        if (currentPhase === 'offensiveRoll') {
            const hasSelectedAbility = Boolean(G.pendingAttack?.sourceAbilityId);
            const hasAvailableAbilities = availableAbilityIdsForRoller.length > 0;
            // 只有已经投过骰子后才弹出确认跳过弹窗
            // 未投骰子时直接跳过（如眩晕状态），不需要确认
            const shouldConfirmSkip = hasRolled && !hasSelectedAbility && (!G.rollConfirmed || hasAvailableAbilities);
            if (shouldConfirmSkip) {
                openUiModal('confirmSkip');
                return;
            }
        }
        engineMoves.advancePhase();
        advanceTutorialIfNeeded('advance-phase-button');
    };

    // 弃牌阶段：只有手牌不超限时才自动推进（upkeep/income 已由引擎层 onAutoContinueCheck 处理）
    React.useEffect(() => {
        if (isActivePlayer && currentPhase === 'discard' && player.hand.length <= HAND_LIMIT) {
            const timer = setTimeout(() => engineMoves.advancePhase(), 800);
            return () => clearTimeout(timer);
        }
    }, [currentPhase, isActivePlayer, engineMoves, player.hand.length]);

    React.useEffect(() => {
        if (currentPhase === 'defensiveRoll') {
            // 防御掷骰时如果自己是掷骰者，强制切回自己视角
            // 若不是掷骰者，交给 shouldAutoObserve 临时切换，不改变手动视角
            if (rollerId && rollerId === rootPid) {
                setViewMode('self');
            }
            return;
        }
        if ((currentPhase === 'offensiveRoll' || currentPhase === 'targetingRoll') && isActivePlayer) {
            setViewMode('self');
            return;
        }
        // 防御阶段结束后（进入 main2/discard 等阶段），如果是自己的回合，切换回自己视角
        if (isActivePlayer && (currentPhase === 'main2' || currentPhase === 'discard')) {
            setViewMode('self');
        }
    }, [currentPhase, isActivePlayer, rollerId, rootPid, setViewMode]);

    React.useEffect(() => {
        const sourceAbilityId = G.activatingAbilityId ?? G.pendingAttack?.sourceAbilityId;
        if (!sourceAbilityId) return;
        setActivatingAbilityId(sourceAbilityId);
        triggerAbilityGlow();
        const timer = setTimeout(() => setActivatingAbilityId(undefined), 800);
        return () => clearTimeout(timer);
    }, [G.activatingAbilityId, G.pendingAttack?.sourceAbilityId, triggerAbilityGlow, setActivatingAbilityId]);

    // 使用 useAnimationEffects Hook 管理飞行动画效果（基于 FX 引擎）
    // 事件流消费采用模式 A（单一游标），统一处理伤害/治疗等事件
    const { damageBuffer, fxImpactMapRef, advanceQueue } = useAnimationEffects({
        fxBus,
        players: { player, opponent },
        currentPlayerId: rootPid,
        opponentId: otherPid,
        refs: {
            opponentHp: opponentHpRef,
            selfHp: selfHpRef,
            opponentCp: opponentCpRef,
            selfCp: selfCpRef,
            opponentBuff: opponentBuffRef,
            selfBuff: selfBuffRef,
            opponentHeader: opponentHeaderRef,
        },
        getEffectStartPos,
        getAbilityStartPos,
        locale,
        statusIconAtlas,
        eventStreamEntries: rawG.sys.eventStream?.entries ?? [],
    });

    const advanceLabel = currentPhase === 'offensiveRoll'
        ? t('actions.resolveAttack')
        : currentPhase === 'targetingRoll'
            ? '确认目标'
        : currentPhase === 'defensiveRoll'
            ? t('actions.endDefense')
            : t('actions.nextPhase');

    if (!player) return <div className="p-10 text-white">{t('status.loadingGameState', { playerId: rootPid })}</div>;

    // --- Setup 阶段：仅渲染全屏选角界面 ---
    if (currentPhase === 'setup') {
        return (
            <TutorialSelectionGate
                isTutorialMode={gameMode?.mode === 'tutorial'}
                isTutorialActive={isTutorialActive}
                containerClassName="bg-[#0F0F23] text-white"
                textClassName="text-[1.5vw] font-bold"
            >
                <UndoProvider value={{ G: rawG, dispatch, playerID, isGameOver: !!isGameOver, isLocalMode: !isMultiplayer }}>
                    <div className="relative w-full h-full bg-[#0a0a0c] overflow-hidden font-sans select-none">
                        <DiceThroneCharacterSelection
                            isOpen={true}
                            currentPlayerId={rootPid}
                            hostPlayerId={G.hostPlayerId}
                            selectedCharacters={G.selectedCharacters}
                            readyPlayers={G.readyPlayers ?? {}}
                            playerNames={playerNames}
                            seatingOrder={G.seatingOrder}
                            seatControllers={G.seatControllers}
                            seatSwapRequest={G.seatSwapRequest}
                            onSelect={engineMoves.selectCharacter}
                            onReady={engineMoves.playerReady}
                            onUnready={engineMoves.playerUnready}
                            onRequestSeatSwap={engineMoves.requestSeatSwap}
                            onRespondSeatSwap={engineMoves.respondSeatSwap}
                            onCancelSeatSwap={engineMoves.cancelSeatSwap}
                            onStart={engineMoves.hostStartGame}
                            locale={locale}
                        />
                    </div>
                </UndoProvider>
            </TutorialSelectionGate>
        );
    }

    // --- 游戏进行阶段：渲染完整棋盘 UI ---
    return (
        <UndoProvider value={{ G: rawG, dispatch, playerID, isGameOver: !!isGameOver, isLocalMode: !isMultiplayer }}>
            <div className="relative w-full h-full bg-black overflow-hidden font-sans select-none text-slate-200">
                {!isSpectator && (
                    <GameDebugPanel
                        G={rawG}
                        dispatch={dispatch}
                        playerID={playerID}
                        aiSupport={DICETHRONE_MANIFEST.ai}
                        playerOptions={DICETHRONE_MANIFEST.playerOptions}
                    >
                        {/* DiceThrone 专属作弊工具 */}
                        <DiceThroneDebugConfig G={rawG} dispatch={dispatch} playerNames={playerNames} />

                        {/* 测试工具 */}
                        <div className="pt-4 border-t border-gray-200 mt-4 space-y-3">
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('debug.testingTools')}</h4>
                            <button
                                onClick={toggleLayoutEditing}
                                className={`w-full py-2 rounded font-bold text-xs border transition-[background-color] duration-200 ${isLayoutEditing ? 'bg-amber-600 border-amber-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                            >
                                {isLayoutEditing ? t('layout.exitEdit') : t('layout.enterEdit')}
                            </button>
                            {isLayoutEditing && (
                                <LayoutSaveButton
                                    abilityOverlaysRef={abilityOverlaysRef}
                                    characterId={viewPlayer.characterId}
                                />
                            )}
                        </div>
                    </GameDebugPanel>
                )}

                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-black/40 z-10 pointer-events-none" />
                    <OptimizedImage
                        src="dicethrone/images/Common/background"
                        locale={locale}
                        className="w-full h-full object-cover"
                        alt={t('imageAlt.background')}
                    />
                </div>

                {otherPids.length > 0 && (
                    <div className="absolute top-[0.9vw] inset-x-0 z-50 flex items-start justify-center gap-[0.6vw] pointer-events-none">
                        {otherPids.map((pid) => {
                            const headerPlayer = G.players[pid];
                            if (!headerPlayer) return null;
                            const headerIndex = otherPids.indexOf(pid);

                            const isFocusedHeader = pid === otherPid;
                            const isTeammateHeader = areTeammates(G, rootPid, pid);

                            return (
                                <OpponentHeader
                                    key={pid}
                                    opponent={headerPlayer}
                                    playerId={pid}
                                    opponentName={playerNames[pid] ?? t('common.opponent')}
                                    viewMode={viewMode}
                                    tone={isTeammateHeader ? 'ally' : 'enemy'}
                                    testId={`dt-top-header-${headerIndex + 1}`}
                                    compact={isFourPlayerView}
                                    selected={isFocusedHeader}
                                    observed={!isSelfView && isFocusedHeader}
                                    isOpponentShaking={isFocusedHeader && opponentImpact.shake.isShaking}
                                    hitStopActive={isFocusedHeader ? opponentImpact.hitStop.isActive : false}
                                    hitStopConfig={isFocusedHeader ? opponentImpact.hitStop.config : undefined}
                                    shouldAutoObserve={shouldAutoObserve}
                                    onToggleView={() => {
                                        handleOpponentHeaderSelect(pid);
                                    }}
                                    headerError={isFocusedHeader ? headerError : null}
                                    opponentBuffRef={isFocusedHeader ? opponentBuffRef : undefined}
                                    opponentHpRef={isFocusedHeader ? opponentHpRef : undefined}
                                    opponentCpRef={isFocusedHeader ? opponentCpRef : undefined}
                                    statusIconAtlas={statusIconAtlas}
                                    locale={locale}
                                    containerRef={isFocusedHeader ? opponentHeaderRef : undefined}
                                    layout="inline"
                                    allowPointerEvents
                                    tokenDefinitions={G.tokenDefinitions}
                                    damageFlashActive={isFocusedHeader && opponentImpact.flash.isActive}
                                    damageFlashDamage={isFocusedHeader ? opponentImpact.flash.damage : undefined}
                                    overrideHp={isFocusedHeader
                                        ? damageBuffer.get(`hp-${pid}`, headerPlayer.resources[RESOURCE_IDS.HP] ?? 0)
                                        : undefined}
                                />
                            );
                        })}
                    </div>
                )}

                <FxLayer
                    bus={fxBus}
                    getCellPosition={() => ({ left: 0, top: 0, width: 0, height: 0 })}
                    onEffectImpact={(id) => {
                        // 飞行动画到达目标：释放对应 HP 冻结 + 触发受击反馈。
                        // DiceThrone 伤害现已允许在 impact 时推进下一段，避免 3 秒飘字把后续伤害/HP 更新卡死。
                        const info = fxImpactMapRef.current.get(id);
                        if (info) {
                            // CP 步骤 bufferKey 为空，无需释放缓冲
                            if (info.bufferKey) {
                                damageBuffer.release([info.bufferKey]);
                            }
                            // 根据 bufferKey 判断目标，触发对应面板的受击反馈
                            if (info.damage > 0) {
                                const isOpponentHit = info.bufferKey === `hp-${otherPid}`;
                                if (isOpponentHit) {
                                    opponentImpact.trigger(info.damage);
                                } else {
                                    selfImpact.trigger(info.damage);
                                }
                            }
                            fxImpactMapRef.current.delete(id);
                        }
                        advanceQueue(id);
                    }}
                    onEffectComplete={(id) => {
                        // 动画完成：若 impact 回调被跳过，仍必须释放 HP 冻结，避免血条延迟到下一回合才刷新。
                        const info = fxImpactMapRef.current.get(id);
                        if (info) {
                            if (info.bufferKey) {
                                damageBuffer.release([info.bufferKey]);
                            }
                            fxImpactMapRef.current.delete(id);
                        }
                        advanceQueue(id);
                    }}
                />
                <div className="absolute inset-x-0 top-[2vw] bottom-0 z-10 pointer-events-none">
                    <LeftSidebar
                        currentPhase={currentPhase}
                        viewPlayer={player} // Always show own stats
                        playerId={rootPid}
                        locale={locale}
                        statusIconAtlas={statusIconAtlas}
                        selfBuffRef={selfBuffRef}
                        selfHpRef={selfHpRef}
                        selfCpRef={selfCpRef}
                        hitStopActive={selfImpact.hitStop.isActive}
                        hitStopConfig={selfImpact.hitStop.config}
                        drawDeckRef={drawDeckRef}
                        onPurifyClick={() => openUiModal('purify')}
                        canUsePurify={canUsePurify}
                        tokenDefinitions={G.tokenDefinitions}
                        onKnockdownClick={() => openUiModal('removeKnockdown')}
                        canRemoveKnockdown={canRemoveKnockdown}
                        isSelfShaking={selfImpact.shake.isShaking}
                        selfDamageFlashActive={selfImpact.flash.isActive}
                        selfDamageFlashDamage={selfImpact.flash.damage}
                        overrideHp={damageBuffer.get(`hp-${rootPid}`, player.resources[RESOURCE_IDS.HP] ?? 0)}
                        onAutoResponseToggle={setAutoResponseEnabled}
                        onBonusDiceResponseToggle={setBonusDiceResponseEnabled}
                    />

                    <CenterBoard
                        coreAreaHighlighted={coreAreaHighlighted}
                        isTipOpen={isTipOpen}
                        onToggleTip={toggleTip}
                        isLayoutEditing={isLayoutEditing}
                        isSelfView={isSelfView}
                        availableAbilityIds={availableAbilityIds}
                        canSelectAbility={canSelectAbility}
                        canHighlightAbility={canHighlightAbility}
                        onSelectAbility={handleBoardAbilitySelect}
                        onHighlightedAbilityClick={handleBoardHighlightedAbilityClick}
                        selectedAbilityId={selectedAbilityId}
                        activatingAbilityId={activatingAbilityId}
                        abilityLevels={viewPlayer.abilityLevels}
                        characterId={viewPlayer.characterId}
                        playerBoardFace={viewPlayer.playerBoardFace}
                        locale={locale}
                        onMagnifyImage={(image) => setMagnifiedImage(image)}
                        onMagnifyCard={(card) => setMagnifiedCard(card)}
                        abilityOverlaysRef={abilityOverlaysRef}
                        playerTokens={viewPlayer.tokens}
                        diceStage={useBoardDiceStage && !bonusDiceTrayDice ? (
                            <BoardDiceStage
                                dice={boardStageDice}
                                rollCount={G.rollCount}
                                currentPhase={currentPhase}
                                canInteract={canInteractDice || !!rerollSelectingAction}
                                isRolling={isRolling}
                                rerollingDiceIds={rerollingDiceIds}
                                rerollAnimationSeq={rerollAnimationSeq}
                                locale={locale}
                            onToggleLock={(id) => {
                                if (rerollSelectingAction) {
                                    handlePassiveRerollDieSelect(id);
                                    return;
                                }
                                engineMoves.toggleDieLock(id);
                            }}
                                interaction={diceMultistepInteraction}
                                multistepInteraction={diceMultistepState}
                                isPassiveRerollMode={!!rerollSelectingAction}
                            />
                        ) : null}
                    />

                    <RightSidebar
                        dice={rightSidebarDice}
                        rollCount={G.rollCount}
                        rollLimit={G.rollLimit}
                        rollConfirmed={rollConfirmed}
                        currentPhase={currentPhase}
                        canInteractDice={canInteractDice || !!rerollSelectingAction}
                        isRolling={isRolling}
                        setIsRolling={(rolling: boolean) => setIsRolling(rolling)}
                        rerollingDiceIds={rerollingDiceIds}
                        rerollAnimationSeq={rerollAnimationSeq}
                        locale={locale}
                        onToggleLock={(id) => {
                            // 被动重掷选择模式：点击骰子直接执行重掷
                            if (rerollSelectingAction) {
                                handlePassiveRerollDieSelect(id);
                                return;
                            }
                            engineMoves.toggleDieLock(id);
                        }}
                        onRoll={() => {
                            if (!canInteractDice) return;
                            if (shouldBlockTutorialAction('dice-roll-button')) return;
                            engineMoves.rollDice();
                            advanceTutorialIfNeeded('dice-roll-button');
                        }}
                        onConfirm={() => {
                            if (!canInteractDice) return;
                            if (shouldBlockTutorialAction('dice-confirm-button')) return;
                            engineMoves.confirmRoll();
                            advanceTutorialIfNeeded('dice-confirm-button');
                        }}
                        showAdvancePhaseButton={showAdvancePhaseButton}
                        advanceLabel={advanceLabel}
                        isAdvanceButtonEnabled={canAdvancePhase}
                        onAdvance={handleAdvancePhase}
                        discardPileRef={discardPileRef}
                        discardCards={viewPlayer.discard}
                        onInspectRecentCards={(cards) => setMagnifiedCards(cards)}
                        canUndoDiscard={canOperateView && !!G.lastSoldCardId && (currentPhase === 'main1' || currentPhase === 'main2')}
                        onUndoDiscard={() => {
                            setLastUndoCardId(G.lastSoldCardId);
                            engineMoves.undoSellCard?.();
                        }}
                        discardHighlighted={discardHighlighted}
                        sellButtonVisible={sellButtonVisible}
                        interaction={diceMultistepInteraction ?? pendingInteraction}
                        multistepInteraction={diceMultistepState}
                        showDiceTray={showRailDiceTray || Boolean(bonusDiceTrayDice)}
                        showDiceActions={!rightTrayBonusDiceSettlement || Boolean(diceMultistepInteraction)}
                        showBonusDiceConfirm={Boolean(
                            rightTrayBonusDiceSettlement
                            && String(rightTrayBonusDiceSettlement.attackerId) === String(rootPid)
                        )}
                        canConfirmBonusDice={canConfirmBonusDiceFromRightTray}
                        onConfirmBonusDice={handleConfirmBonusDiceFromRightTray}
                        activeModifiers={activeModifiers}
                        attackModifierBonusDamage={
                            G.pendingAttack?.attackModifierBonusDamage ?? G.players[G.activePlayerId]?.pendingBonusDamage
                        }
                        passiveAbilityProps={passiveAbilityProps}
                        rootPlayerId={rootPid}
                        teamIdByPlayerId={G.teamIdByPlayerId}
                    />
                </div>

                {/* HandArea：图集已同步注册，始终可渲染 */}
                {(() => {
                    const mustDiscardCount = Math.max(0, handOwner.hand.length - HAND_LIMIT);
                    const isDiscardMode = currentPhase === 'discard' && mustDiscardCount > 0 && canOperateView;
                    return (
                        <>
                            <div className="absolute bottom-0 left-0 right-0 z-40 pointer-events-none bg-gradient-to-t from-black/90 via-black/40 to-transparent h-[15vw]" />
                            {/* 游戏提示统一组件 */}
                            <GameHints
                                isDiscardMode={isDiscardMode}
                                mustDiscardCount={mustDiscardCount}
                                isDiceInteraction={!!isDiceInteraction}
                                isInteractionOwner={isInteractionOwner}
                                pendingInteraction={pendingInteraction}
                                isWaitingOpponent={isWaitingOpponent}
                                opponentName={opponentName}
                                isResponder={isResponder}
                                thinkingOffsetClass={thinkingOffsetClass}
                                onResponsePass={() => engineMoves.responsePass()}
                                currentPhase={currentPhase}
                                isPassiveRerollSelecting={!!rerollSelectingAction}
                            />
                            <HandArea
                                hand={handOwner.hand}
                                locale={locale}
                                currentPhase={currentPhase}
                                playerCp={handOwner.resources[RESOURCE_IDS.CP] ?? 0}
                                onPlayCard={(card) => {
                                    const targetAbilityId = card.type === 'upgrade'
                                        ? getUpgradeTargetAbilityId(card)
                                        : null;
                                    if (targetAbilityId) {
                                        dispatch('PLAY_UPGRADE_CARD', { cardId: card.id, targetAbilityId });
                                        return;
                                    }
                                    engineMoves.playCard(card.id);
                                }}
                                onSellCard={(cardId) => {
                                    const blocked = shouldBlockTutorialAction('discard-pile');
                                    if (blocked) return;
                                    engineMoves.sellCard(cardId);
                                    advanceTutorialIfNeeded('discard-pile');
                                }}
                                onError={(msg) => { playDeniedSound(); toast.warning(msg, undefined, { dedupeKey: 'dicethrone.handArea.error' }); }}
                                canInteract={canInteractHand}
                                canPlayCards={canPlayHandCards}
                                drawDeckRef={drawDeckRef}
                                discardPileRef={discardPileRef}
                                undoCardId={lastUndoCardId}
                                onSellHintChange={setDiscardHighlighted}
                                onPlayHintChange={setCoreAreaHighlighted}
                                onSellButtonChange={setSellButtonVisible}
                                isDiscardMode={isDiscardMode}
                                onDiscardCard={(cardId) => {
                                    if (shouldBlockTutorialAction('discard-pile')) return;
                                    engineMoves.discardCard(cardId);
                                    advanceTutorialIfNeeded('discard-pile');
                                }}
                                onMagnifyCard={(card) => setMagnifiedCard(card)}
                                respondableCardIds={respondableCardIds}
                                characterId={handOwner.characterId}
                                playerBoardFace={handOwner.playerBoardFace}
                                disableCardPointerEvents={Boolean(diceMultistepInteraction)}
                            />
                        </>
                    );
                })()}

                {/* 进攻技能特写（防御阶段入口） */}
                {isAttackShowcaseVisible && attackShowcaseData && (
                    <AttackShowcaseOverlay
                        data={attackShowcaseData}
                        mode={attackShowcaseMode}
                        locale={locale}
                        opponentName={opponentName}
                        autoDismissMs={attackShowcaseAutoDismissMs}
                        onDismiss={dismissAttackShowcase}
                    />
                )}

                <BoardOverlays
                    // 放大预览
                    isMagnifyOpen={isMagnifyOpen}
                    magnifiedImage={magnify.image}
                    magnifiedCard={magnify.card}
                    magnifiedCards={magnify.cards}
                    onCloseMagnify={closeMagnify}
                    availableAbilityIds={availableAbilityIds}
                    canSelectAbility={canSelectAbility}
                    canHighlightAbility={canHighlightAbility}
                    onSelectAbility={handleBoardAbilitySelect}
                    onHighlightedAbilityClick={handleBoardHighlightedAbilityClick}
                    selectedAbilityId={selectedAbilityId}
                    activatingAbilityId={activatingAbilityId}
                    abilityLevels={viewPlayer.abilityLevels}
                    viewCharacterId={viewPlayer.characterId}
                    viewPlayerBoardFace={viewPlayer.playerBoardFace}

                    // 卡牌特写
                    cardSpotlightQueue={cardSpotlightQueue}
                    onCardSpotlightClose={handleCardSpotlightClose}
                    opponentHeaderRef={opponentHeaderRef}

                    // 额外骰子
                    bonusDie={bonusDie}
                    onBonusDieClose={() => handlePendingBonusSettlementClose(foregroundBonusDiceSettlement)}
                    suppressBonusDieOverlay={shouldSuppressForegroundBonusDieOverlay({
                        hasChoice: choice.hasChoice,
                        interactiveSettlement: interactiveBonusDiceSettlement,
                        bonusDie,
                    })}

                    // 奖励骰展示态只留在 overlay，阻塞式重投交互改走 modal stack
                    pendingBonusDiceSettlement={displayOnlyBonusDiceSettlement}
                    canRerollBonusDie={false}
                    onRerollBonusDie={undefined}
                    onSkipBonusDiceReroll={
                        foregroundBonusDiceSettlement
                        && String(foregroundBonusDiceSettlement.attackerId) === String(rootPid)
                            ? () => handlePendingBonusSettlementClose(foregroundBonusDiceSettlement)
                            : undefined
                    }

                    // Token 响应
                    // 游戏结束
                    isGameOver={!!isGameOver}
                    gameoverResult={isGameOver}
                    playerID={playerID || undefined}
                    reset={reset}
                    rematchState={rematchState}
                    onRematchVote={handleRematchVote}

                    // 其他
                    players={G.players}
                    currentPlayerId={rootPid}
                    playerNames={playerNames}
                    seatingOrder={G.seatingOrder}
                    teamIdByPlayerId={G.teamIdByPlayerId}
                    statusIconAtlas={statusIconAtlas}
                    locale={locale}
                    currentPhase={currentPhase}

                    // 选角相关
                    selectedCharacters={G.selectedCharacters}
                    hostPlayerId={G.hostPlayerId}
                    tutorialSpotlightAutoCloseDelayMs={isTutorialMode ? 3000 : undefined}
                    bonusDieManualCloseOnly={!isTutorialMode}
                />
            </div>
        </UndoProvider>
    );
};

export default DiceThroneBoard;
