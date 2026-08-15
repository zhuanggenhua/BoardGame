import React from 'react';
import type { GameBoardProps } from '../../engine/transport/protocol';

import { HAND_LIMIT, type InteractionDescriptor, type PendingBonusDiceSettlement } from './domain/types';
import { RESOURCE_IDS } from './domain/resources';
import { STATUS_IDS, TOKEN_IDS } from './domain/ids';
import type { DiceThroneCore, Die } from './domain';
import { getUsableTokenAmountForTiming, getUsableTokensForTiming } from './domain/tokenResponse';
import { getTokenUseOptions } from './domain/tokenTypes';
import {
    ATTACK_SNAPSHOT_DIE_ID_OFFSET,
    checkPlayCard,
    getPlayableCardsInResponseWindow,
    getAvailableAbilityIds,
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
import { useImpactFeedback, useShake } from '../../components/common/animations';
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
    shouldShowManualPhaseAdvance,
} from './ui/viewMode';
import { isDirectDiceInterferenceActor } from './domain/responseWindowGuards';
import { resolveMoves, type DiceThroneMoveMap } from './ui/resolveMoves';
import { LayoutSaveButton } from './ui/LayoutSaveButton';
import { useAutoSkipSelection } from './hooks/useAutoSkipSelection';
import { useAttackShowcase } from './hooks/useAttackShowcase';
import { AttackShowcaseOverlay } from './ui/AttackShowcaseOverlay';
import { useDieRerollAnimationConsumer } from './hooks/useDieRerollAnimationConsumer';
import { getPlayerPassiveAbilities, isPassiveActionUsable } from './domain/passiveAbility';
import { getCurrentRollDice, isCurrentBonusRollSettlement, isSettledReplayOnlyRollContext } from './domain/rollContext';
import { getAutoResponseEnabled, getBonusDiceResponseEnabled } from './ui/responsePreferences';
import { getAbilityChoiceText } from './ui/abilityChoiceText';
import { canInteractDiceForCurrentBoard, getRailDiceForCurrentBoard, shouldShowRailDiceTray } from './ui/diceStagePolicy';
import {
    canInteractHandForCurrentBoard,
    canPlayHandCardsForCurrentBoard,
    canSellHandCardsForCurrentBoard,
} from './ui/handPlayPolicy';
import { useSyncedModalStackEntry } from '../../hooks/ui/useSyncedModalStackEntry';
import { InteractionOverlay } from './ui/InteractionOverlay';
import { ChoiceModal } from './ui/ChoiceModal';
import { CompareRollOverlay } from './ui/CompareRollOverlay';
import { DefenderChoiceModal } from './ui/DefenderChoiceModal';
import { canRerollBonusDiceSettlement } from './domain/bonusDiceSettlement';

type DiceThroneBoardProps = GameBoardProps<DiceThroneCore>;

// 所有奖励骰都由右侧骰盘承接；是否允许重投或改骰由结算自身的规则决定，
// 而不是由中央展示层决定。
const shouldUseRightTrayForPendingBonusDice = (settlement?: PendingBonusDiceSettlement): boolean => (
    Boolean(settlement)
);

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
    const currentRollDice = React.useMemo(() => getCurrentRollDice(G, currentPhase), [G, currentPhase]);
    const replayOnlyRollDice = React.useMemo(() => (
        G.currentRollContext && isSettledReplayOnlyRollContext(G.currentRollContext)
            ? G.currentRollContext.dice
            : null
    ), [G.currentRollContext]);
    const bonusDiceReplayOnlyDice = React.useMemo(() => (
        G.currentRollContext?.kind === 'bonus'
            ? replayOnlyRollDice
            : null
    ), [G.currentRollContext?.kind, replayOnlyRollDice]);
    const playerNames = playerView.playerNames;
    const isResponseWindowOpen = !!rawG.sys.responseWindow?.current;
    const currentResponseWindow = rawG.sys.responseWindow?.current;
    const currentResponderIndex = rawG.sys.responseWindow?.current?.currentResponderIndex;
    const currentResponderId = rawG.sys.responseWindow?.current
        ? rawG.sys.responseWindow.current.responderQueue[rawG.sys.responseWindow.current.currentResponderIndex]
        : undefined;
    const currentPendingBonusDiceSettlement = isCurrentBonusRollSettlement(G)
        ? G.pendingBonusDiceSettlement
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
        && shouldOpenAfterRollConfirmedForBonusSettlement(currentPendingBonusDiceSettlement),
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

    // Atlas 配置（状态图标仍需异步加载）
    const [statusIconAtlas, setStatusIconAtlas] = React.useState<StatusAtlases | null>(null);

    // 卡牌特写只承接卡牌；所有奖励骰始终由右侧 2D 骰盘承接。
    const {
        cardSpotlightQueue,
        handleCardSpotlightClose,
    } = useCardSpotlight({
        eventStreamEntries: rawG.sys.eventStream?.entries ?? [],
        currentPlayerId: rootPid,
        opponentName,
        isSpectator,
        selectedCharacters: G.selectedCharacters,
        suppressStandaloneBonusDie: true,
        suppressBonusDiceInCardSpotlight: true,
        cacheScope: rawG.sys.matchId
            ?? `${Object.entries(G.selectedCharacters ?? {})
                .map(([pid, characterId]) => `${pid}:${characterId}`)
                .sort()
                .join('|') || 'unselected'}`,
    });

    useDieRerollAnimationConsumer({
        eventStreamEntries: rawG.sys.eventStream?.entries ?? [],
        setRerollingDiceIds,
        setRerollAnimationSeq,
        bonusDiceIds: G.currentRollContext?.kind === 'bonus'
            ? G.currentRollContext.dice.map((die) => die.id)
            : [],
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
    const opponentCpShake = useShake();
    const selfCpShake = useShake();
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
    // 进攻特写只是进入防御的阅读层。一旦已恢复到 Token 响应，响应本体优先，
    // 否则本地重新挂载的特写遮罩会把可用 Token 留在画面里却无法点击。
    const hasBlockingAttackShowcase = isAttackShowcaseVisible && !isTokenResponseInteraction;
    const isTokenResponder = pendingDamage && (pendingDamage.responderId === rootPid);

    // 领域层计算当前阶段可用的 Token 列表（唯一数据源）
    const usableTokens = React.useMemo(() => {
        if (!pendingDamage) return [];
        return getUsableTokensForTiming(G, pendingDamage.responderId, pendingDamage.responseType);
    }, [G, pendingDamage]);

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
    const isCompareRoll = G.currentRollContext?.kind === 'compare';
    const isCurrentBonusDiceSettlementActive = isCurrentBonusRollSettlement(G, G.pendingBonusDiceSettlement);
    
    // availableAbilityIds 计算：
    // 1. 响应窗口打开时，显示响应者的可用技能（不限于掷骰阶段）
    // 2. 掷骰阶段，显示掷骰者的可用技能
    // 3. 其他情况，不显示技能
    const availableAbilityIds = React.useMemo(() => {
        // 奖励骰结算期由右侧 2D 骰盘承接；不能用奖励骰面重新点亮普通攻击技能。
        if (isCurrentBonusDiceSettlementActive) {
            return [];
        }
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
    }, [isCurrentBonusDiceSettlementActive, isResponseWindowOpen, currentResponderId, viewPid, isViewRolling, access.availableAbilityIds, G, currentPhase]);
    
    const availableAbilityIdsForRoller = React.useMemo(
        () => isCurrentBonusDiceSettlementActive ? [] : access.availableAbilityIds,
        [access.availableAbilityIds, isCurrentBonusDiceSettlementActive],
    );
    const selectedAbilityId = (() => {
        if (isCurrentBonusDiceSettlementActive && G.pendingBonusDiceSettlement) {
            return G.pendingBonusDiceSettlement.sourceAbilityId;
        }
        if (currentPhase === 'defensiveRoll') {
            return isViewRolling ? G.pendingAttack?.defenseAbilityId : undefined;
        }
        if (currentPhase === 'offensiveRoll') {
            return isViewRolling ? G.pendingAttack?.sourceAbilityId : undefined;
        }
        return undefined;
    })();
    const canOperateView = isSelfView && !isSpectator;
    const hasRolled = G.rollCount > 0;
    const [rerollSelectingAction, setRerollSelectingAction] = React.useState<{ passiveId: string; actionIndex: number } | null>(null);

    // 焦点玩家判断（统一的操作权判断）
    const isFocusPlayer = !isSpectator && access.focusPlayerId === rootPid;
    const _hasPendingInteraction = Boolean(pendingInteraction);
    // 阶段推进权限：从 useDiceThroneState 获取（领域校验 + 交互判断），叠加焦点玩家判断
    // 进攻技能特写期间阻止所有操作
    const canAdvancePhase = isFocusPlayer && access.canAdvancePhase && !hasBlockingAttackShowcase;
    const canResolveChoice = Boolean(choice.hasChoice && choice.playerId === rootPid);

    const directTokenResponseIds = React.useMemo(() => {
        if (!isTokenResponseInteraction || !pendingDamage || !isTokenResponder) return [];

        return usableTokens
            .filter((tokenDef) => {
                const available = getUsableTokenAmountForTiming(
                    G,
                    pendingDamage.responderId,
                    tokenDef.id,
                    pendingDamage.responseType,
                );
                return getTokenUseOptions(tokenDef, available).length > 0;
            })
            .map((tokenDef) => tokenDef.id);
    }, [G, isTokenResponder, isTokenResponseInteraction, pendingDamage, usableTokens]);

    const directTokenChoiceOptions = React.useMemo(() => {
        if (!canResolveChoice || !choice.hasChoice || choice.options.length === 0) return [];

        const tokenOptions = choice.options.filter(option => option.tokenId && !option.disabled);
        const hasOnlyTokenChoices = choice.options.every(option => (
            (option.tokenId && !option.disabled) || option.customId === 'skip'
        ));

        return tokenOptions.length > 0 && hasOnlyTokenChoices ? tokenOptions : [];
    }, [canResolveChoice, choice]);

    const directTokenChoiceSkip = React.useMemo(
        () => choice.options.find(option => !option.tokenId && option.customId === 'skip'),
        [choice.options],
    );
    const shouldUseDirectTokenChoice = directTokenChoiceOptions.length > 0 && Boolean(directTokenChoiceSkip);

    const handleDirectTokenResponse = React.useCallback((tokenId: string) => {
        if (!isTokenResponseInteraction || !pendingDamage || !isTokenResponder) return;

        const tokenDef = usableTokens.find(def => def.id === tokenId);
        if (!tokenDef) return;

        const available = getUsableTokenAmountForTiming(
            G,
            pendingDamage.responderId,
            tokenId,
            pendingDamage.responseType,
        );
        const amount = getTokenUseOptions(tokenDef, available)[0];
        if (!amount) return;

        engineMoves.useToken(tokenId, amount);
    }, [G, engineMoves, isTokenResponder, isTokenResponseInteraction, pendingDamage, usableTokens]);

    const handleDirectTokenChoice = React.useCallback((tokenId: string) => {
        if (!canResolveChoice) return;
        const option = directTokenChoiceOptions.find(candidate => candidate.tokenId === tokenId);
        if (!option) return;

        dispatch(INTERACTION_COMMANDS.RESPOND, {
            optionId: option.id,
            interactionId: sysInteraction?.id,
        });
    }, [canResolveChoice, directTokenChoiceOptions, dispatch, sysInteraction?.id]);

    const tokenInteraction = React.useMemo(() => {
        if (isTokenResponseInteraction && pendingDamage && isTokenResponder) {
            return {
                tokenIds: directTokenResponseIds,
                onTokenClick: handleDirectTokenResponse,
                onSkip: engineMoves.skipTokenResponse,
                passLabel: t(pendingDamage.isFullyEvaded ? 'tokenResponse.confirm' : 'tokenResponse.skip'),
            };
        }

        if (shouldUseDirectTokenChoice) {
            return {
                tokenIds: directTokenChoiceOptions.map(option => option.tokenId!).filter(Boolean),
                onTokenClick: handleDirectTokenChoice,
                onSkip: directTokenChoiceSkip
                    ? () => dispatch(INTERACTION_COMMANDS.RESPOND, {
                        optionId: directTokenChoiceSkip.id,
                        interactionId: sysInteraction?.id,
                    })
                    : undefined,
                passLabel: directTokenChoiceSkip
                    ? t(directTokenChoiceSkip.label, directTokenChoiceSkip.labelParams)
                    : undefined,
            };
        }

        return undefined;
    }, [
        directTokenChoiceOptions,
        directTokenChoiceSkip,
        directTokenResponseIds,
        dispatch,
        engineMoves.skipTokenResponse,
        handleDirectTokenChoice,
        handleDirectTokenResponse,
        isTokenResponder,
        isTokenResponseInteraction,
        pendingDamage,
        shouldUseDirectTokenChoice,
        sysInteraction?.id,
        t,
    ]);
    const isDuelDirectDefenseOnly = false;
    const diceInteractionPlayerId = diceMultistepInteraction?.playerId != null
        ? String(diceMultistepInteraction.playerId)
        : undefined;
    const canOperateOwnedCompareRoll = Boolean(
        G.currentRollContext?.kind === 'compare'
        && G.currentRollContext.status !== 'settled'
        && G.currentRollContext.ownerPlayerId === rootPid
    );
    const canInteractDice = canInteractDiceForCurrentBoard({
        isSpectator,
        isSelfView,
        isViewRolling,
        isAttackShowcaseVisible: hasBlockingAttackShowcase,
        isDuelDirectDefenseOnly,
        isManualSelfResponseWindow,
        isDirectDiceActor,
        currentResponderId,
        rootPid,
        diceInteractionPlayerId,
        canOperateOwnedCompareRoll,
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
    ) && !hasBlockingAttackShowcase && !isCurrentBonusDiceSettlementActive;
    const canSelectAbility = (
        (canOperateView && isViewRolling && isRollPhase && (currentPhase === 'defensiveRoll' ? true : G.rollConfirmed))
        || isManualSelfResponseWindow
    ) && !hasBlockingAttackShowcase && !isCurrentBonusDiceSettlementActive;

    // 同一 slot 多 variant 选择：玩家点击 slot 时，如果该 slot 有多个 variant 同时满足，弹窗让玩家选
    const [abilityChoiceOptions, setAbilityChoiceOptions] = React.useState<AbilityChoiceOption[]>([]);

    // 响应窗口状态已在上方声明（380-381行），这里直接使用
    const responseWindow = access.responseWindow;
    const isResponder = isManualSelfResponseWindow;
    const sharedResponsePrompt = tokenInteraction
        ? (tokenInteraction.onSkip
            ? { onPass: tokenInteraction.onSkip, kind: 'token' as const, passLabel: tokenInteraction.passLabel }
            : undefined)
        : isResponder
            ? { onPass: () => engineMoves.responsePass(currentResponderId), kind: 'card' as const }
            : undefined;
    const canPlayHandCards = canPlayHandCardsForCurrentBoard({
        isSpectator,
        isActivePlayer,
        isResponder,
        isDirectDiceActor,
        currentPhase,
        rootPid,
        rollerId,
    });
    const canSellHandCards = canSellHandCardsForCurrentBoard({
        isSpectator,
        isActivePlayer,
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
    // upkeep/income 是规则自动阶段，玩家不应取得阶段推进入口。
    const showAdvancePhaseButton = shouldShowManualPhaseAdvance(currentPhase, isSpectator) && !isResponseWindowOpen;
    const handleCancelInteraction = React.useCallback(() => {
        if (pendingInteraction?.sourceCardId) {
            setLastUndoCardId(pendingInteraction.sourceCardId);
        }
        // 使用 InteractionSystem 的 CANCEL 命令取消当前交互
        dispatch(INTERACTION_COMMANDS.CANCEL, { interactionId: pendingInteraction?.id });
    }, [dispatch, pendingInteraction, setLastUndoCardId]);
    const settleRightTrayBonusDice = React.useCallback(() => {
        engineMoves.skipBonusDiceReroll();
    }, [engineMoves]);

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

    const canUseFlight = !isSpectator
        && !G.pendingDamage
        && (currentPhase === 'offensiveRoll' || currentPhase === 'defensiveRoll')
        && rollerId === rootPid
        && Boolean(G.pendingAttack)
        && (player.tokens?.[TOKEN_IDS.FLIGHT] ?? 0) > 0;

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
        const die = currentRollDice.find(d => d.id === dieId);
        if (!die || die.isKept) return;
        engineMoves.usePassiveAbility(
            rerollSelectingAction.passiveId,
            rerollSelectingAction.actionIndex,
            dieId
        );
        setRerollSelectingAction(null);
    }, [rerollSelectingAction, engineMoves, currentRollDice]);

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
    const showRailDiceTray = shouldShowRailDiceTray({
        hasKeptDice: currentRollDice.some((die) => die.isKept),
    });
    const pendingBonusDiceRoutedToRightTray = shouldUseRightTrayForPendingBonusDice(currentPendingBonusDiceSettlement);
    const isCurrentBonusDiceContext = G.currentRollContext?.kind === 'bonus';
    const suppressCardSpotlightForBonusDiceSurface = Boolean(isCurrentBonusDiceContext || G.pendingBonusDiceSettlement);
    React.useEffect(() => {
        if (!suppressCardSpotlightForBonusDiceSurface || cardSpotlightQueue.length === 0) {
            return;
        }
        for (const item of cardSpotlightQueue) {
            handleCardSpotlightClose(item.id);
        }
    }, [cardSpotlightQueue, handleCardSpotlightClose, suppressCardSpotlightForBonusDiceSurface]);
    const bonusDiceTrayDice = React.useMemo(() => {
        // 普通确认结算会清掉 pending settlement，但当前 bonus 上下文仍负责右侧只读回看。
        // 这里必须按当前骰上下文路由，不能把 pending 是否存在当成显示资格。
        if (!isCurrentBonusDiceContext) {
            return null;
        }

        const dice = bonusDiceReplayOnlyDice ?? currentRollDice;
        if (dice.length === 0) {
            return null;
        }

        return dice.map((die) => ({
            ...die,
            displayOnly: Boolean(bonusDiceReplayOnlyDice) || !diceMultistepInteraction || die.displayOnly === true,
        }));
    }, [bonusDiceReplayOnlyDice, currentRollDice, diceMultistepInteraction, isCurrentBonusDiceContext]);
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
        const visibleRollDice = replayOnlyRollDice ?? currentRollDice;
        if (attackSnapshotInteractionDice) return [...visibleRollDice, ...attackSnapshotInteractionDice];
        return visibleRollDice;
    }, [currentRollDice, replayOnlyRollDice, attackSnapshotInteractionDice, bonusDiceTrayDice]);
    const rightSidebarDice = React.useMemo(() => {
        if (bonusDiceTrayDice) return bonusDiceTrayDice;
        const baseDice = getRailDiceForCurrentBoard(interactionDice);
        return baseDice;
    }, [bonusDiceTrayDice, interactionDice]);
    const rightTrayBonusDiceSettlement = pendingBonusDiceRoutedToRightTray
        ? currentPendingBonusDiceSettlement
        : undefined;
    const isBonusDiceResponseWindowForOwner = Boolean(
        G.pendingBonusDiceSettlement
        && rawG.sys.responseWindow?.current?.windowType === 'afterRollConfirmed'
        && String(G.pendingBonusDiceSettlement.attackerId) === String(rootPid)
    );
    const canUseRightTrayBonusDiceActions = Boolean(
        rightTrayBonusDiceSettlement
        && !isSpectator
        && String(rightTrayBonusDiceSettlement.attackerId) === String(rootPid)
        && !rawG.sys.responseWindow?.current
        && (
            !rawG.sys.interaction?.current
            || rawG.sys.interaction.current.kind === 'dt:bonus-dice'
        )
    );
    const requiresManualBonusDiceSettlement = Boolean(rightTrayBonusDiceSettlement);
    const isRightTrayBonusDiceSettlementActive = Boolean(
        canUseRightTrayBonusDiceActions
        && requiresManualBonusDiceSettlement
    );
    const canRerollBonusDiceFromRightTray = Boolean(
        canUseRightTrayBonusDiceActions
        && requiresManualBonusDiceSettlement
        && canRerollBonusDiceSettlement(rightTrayBonusDiceSettlement, player.tokens)
    );
    const completeRightTrayBonusDiceSettlement = React.useCallback(() => {
        if (!isRightTrayBonusDiceSettlementActive || !rightTrayBonusDiceSettlement) {
            return;
        }
        settleRightTrayBonusDice();
    }, [isRightTrayBonusDiceSettlementActive, rightTrayBonusDiceSettlement, settleRightTrayBonusDice]);
    const handleRerollBonusDiceFromRightTray = React.useCallback((dieIndex: number) => {
        if (!canRerollBonusDiceFromRightTray) {
            return;
        }
        engineMoves.rerollBonusDie(dieIndex);
    }, [canRerollBonusDiceFromRightTray, engineMoves]);
    const isReplayOnlyRollContextActive = Boolean(replayOnlyRollDice);
    const canInteractRightSidebarDice = !isReplayOnlyRollContextActive
        && (canInteractDice || !!rerollSelectingAction || isRightTrayBonusDiceSettlementActive);
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
            } else if (activeInteraction.minSelectCount === 0) {
                // 可选状态移除允许确认空选；这不是取消整张卡牌/整段交互。
                engineMoves.resolveInteraction([], []);
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
                    dispatch(INTERACTION_COMMANDS.RESPOND, { optionId, interactionId: compareRollInteraction.id });
                }}
                onConfirm={() => {
                    dispatch(INTERACTION_COMMANDS.CONFIRM, { interactionId: compareRollInteraction.id });
                }}
                usePortal={false}
            />
        ),
    }), [activeResolutionFrameId, compareRollInteraction, dispatch, isSpectator, locale, rootPid, sysInteraction]);

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
        enabled: Boolean(defenderChoice),
        entryId: 'dicethrone_defender_choice',
        entry: defenderChoiceModalEntry,
    });

    useSyncedModalStackEntry({
        enabled: Boolean(choice.hasChoice && !shouldUseDirectTokenChoice),
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
            <div
                className="relative w-full h-full bg-black overflow-hidden font-sans select-none text-slate-200"
                data-testid="dicethrone-board-root"
            >
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
                                    isOpponentCpShaking={isFocusedHeader && opponentCpShake.isShaking}
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
                            // 根据命中资源精确触发对应条：HP 只震血条，CP 只震 CP 条。
                            if (info.impactTarget?.resource === 'cp') {
                                if (info.impactTarget.playerId === otherPid) {
                                    opponentCpShake.triggerShake();
                                } else if (info.impactTarget.playerId === rootPid) {
                                    selfCpShake.triggerShake();
                                }
                            } else if (info.damage > 0 && info.impactTarget?.resource === 'hp') {
                                if (info.impactTarget.playerId === otherPid) {
                                    opponentImpact.trigger(info.damage);
                                } else if (info.impactTarget.playerId === rootPid) {
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
                        onFlightClick={() => engineMoves.useToken(TOKEN_IDS.FLIGHT, 1)}
                        canUseFlight={canUseFlight}
                        tokenDefinitions={G.tokenDefinitions}
                        responseTokenIds={tokenInteraction?.tokenIds}
                        onResponseTokenClick={tokenInteraction?.onTokenClick}
                        onKnockdownClick={() => openUiModal('removeKnockdown')}
                        canRemoveKnockdown={canRemoveKnockdown}
                        isSelfShaking={selfImpact.shake.isShaking}
                        isSelfCpShaking={selfCpShake.isShaking}
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
                    />

                    <RightSidebar
                        dice={rightSidebarDice}
                        rollCount={G.rollCount}
                        rollLimit={G.rollLimit}
                        rollConfirmed={rollConfirmed}
                        isCompareRoll={isCompareRoll}
                        currentPhase={currentPhase}
                        canInteractDice={canInteractRightSidebarDice}
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
                            if (isRightTrayBonusDiceSettlementActive) {
                                completeRightTrayBonusDiceSettlement();
                                return;
                            }
                            if (!canInteractRightSidebarDice) return;
                            if (isCompareRoll) {
                                engineMoves.confirmCompareRoll();
                                return;
                            }
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
                        showDiceActions={!isReplayOnlyRollContextActive && !isBonusDiceResponseWindowForOwner && (
                            !rightTrayBonusDiceSettlement
                            || Boolean(diceMultistepInteraction)
                            || isRightTrayBonusDiceSettlementActive
                        )}
                        isBonusDiceSettlement={isRightTrayBonusDiceSettlementActive}
                        canRerollBonusDice={canRerollBonusDiceFromRightTray}
                        onRerollBonusDice={isRightTrayBonusDiceSettlementActive
                            ? handleRerollBonusDiceFromRightTray
                            : undefined}
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
                                responsePrompt={sharedResponsePrompt}
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
                                        return true;
                                    }

                                    const cardCheck = checkPlayCard(
                                        G,
                                        rootPid,
                                        card,
                                        currentPhase,
                                        currentResponseWindow?.windowType,
                                    );
                                    if (!cardCheck.ok) {
                                        playDeniedSound();
                                        toast.warning(t(`error.${cardCheck.reason}`), undefined, {
                                            dedupeKey: `dicethrone.play-card.${cardCheck.reason}`,
                                        });
                                        return false;
                                    }

                                    engineMoves.playCard(card.id);
                                    return true;
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
                                canSellCards={canSellHandCards}
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
                {hasBlockingAttackShowcase && attackShowcaseData && (
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
                    cardSpotlightQueue={suppressCardSpotlightForBonusDiceSurface ? [] : cardSpotlightQueue}
                    onCardSpotlightClose={handleCardSpotlightClose}
                    opponentHeaderRef={opponentHeaderRef}

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
                />
            </div>
        </UndoProvider>
    );
};

export default DiceThroneBoard;
