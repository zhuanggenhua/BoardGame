import React from 'react';
import type { BoardProps } from 'boardgame.io/react';

import { HAND_LIMIT, type TokenResponsePhase } from './domain/types';
import type { MatchState } from '../../engine/types';
import { RESOURCE_IDS } from './domain/resources';
import { STATUS_IDS, TOKEN_IDS, DICETHRONE_CARD_ATLAS_IDS } from './domain/ids';
import type { DiceThroneCore } from './domain';
import { useTranslation } from 'react-i18next';
import { OptimizedImage } from '../../components/common/media/OptimizedImage';
import { GameDebugPanel } from '../../components/GameDebugPanel';
import { DiceThroneDebugConfig } from './debug-config';
import {
    FlyingEffectsLayer,
    useFlyingEffects,
    getViewportCenter,
    getElementCenter,
} from '../../components/common/animations/FlyingEffect';
import { useShake } from '../../components/common/animations/ShakeContainer';
import { usePulseGlow } from '../../components/common/animations/PulseGlow';
import {
    useHitStop,
    useSlashEffect,
    getSlashPresetByDamage,
    getHitStopPresetByDamage,
} from '../../components/common/animations';
import { getLocalizedAssetPath } from '../../core';
import { useToast } from '../../contexts/ToastContext';
import { UndoProvider } from '../../contexts/UndoContext';
import { useTutorial, useTutorialBridge } from '../../contexts/TutorialContext';
import { loadStatusIconAtlasConfig, type StatusIconAtlasConfig } from './ui/statusEffects';
import { getAbilitySlotId } from './ui/AbilityOverlays';
import { HandArea } from './ui/HandArea';
import { loadCardAtlasConfig } from './ui/cardAtlas';
import { DiceThroneCharacterSelection } from './ui/CharacterSelectionAdapter';
import { OpponentHeader } from './ui/OpponentHeader';
import { LeftSidebar } from './ui/LeftSidebar';
import { CenterBoard } from './ui/CenterBoard';
import { RightSidebar } from './ui/RightSidebar';
import { BoardOverlays } from './ui/BoardOverlays';
import { GameHints } from './ui/GameHints';
import { ASSETS } from './ui/assets';
import { registerCardAtlasSource } from '../../components/common/media/CardPreview';
import { useRematch } from '../../contexts/RematchContext';
import { useGameMode } from '../../contexts/GameModeContext';
import { useCurrentChoice, useDiceThroneState } from './hooks/useDiceThroneState';
import { PROMPT_COMMANDS } from '../../engine/systems/PromptSystem';
// 引擎层 Hooks
import { useSpectatorMoves } from '../../engine';
// 游戏特定 Hooks
import { useInteractionState } from './hooks/useInteractionState';
import { useAnimationEffects } from './hooks/useAnimationEffects';
import { useDiceInteractionConfig } from './hooks/useDiceInteractionConfig';
import { useCardSpotlight } from './hooks/useCardSpotlight';
import { useUIState } from './hooks/useUIState';
import { useDiceThroneAudio } from './hooks/useDiceThroneAudio';
import { computeViewModeState } from './ui/viewMode';

type DiceThroneMatchState = MatchState<DiceThroneCore>;
type DiceThroneBoardProps = BoardProps<DiceThroneMatchState>;
type DiceThroneMoveMap = {
    advancePhase: () => void;
    rollDice: () => void;
    toggleDieLock: (id: number) => void;
    confirmRoll: () => void;
    selectAbility: (abilityId: string) => void;
    playCard: (cardId: string) => void;
    sellCard: (cardId: string) => void;
    undoSellCard?: () => void;
    resolveChoice: (statusId: string) => void;
    responsePass: (forPlayerId?: string) => void;
    // 卡牌交互相关
    modifyDie: (dieId: number, newValue: number) => void;
    rerollDie: (dieId: number) => void;
    removeStatus: (targetPlayerId: string, statusId?: string) => void;
    transferStatus: (fromPlayerId: string, toPlayerId: string, statusId: string) => void;
    confirmInteraction: (interactionId: string, selectedDiceIds?: number[]) => void;
    cancelInteraction: () => void;
    // Token 响应相关
    useToken: (tokenId: string, amount: number) => void;
    skipTokenResponse: () => void;
    usePurify: (statusId: string) => void;
    // 击倒移除
    payToRemoveKnockdown: () => void;
    // 奖励骰重掷
    rerollBonusDie: (dieIndex: number) => void;
    skipBonusDiceReroll: () => void;
    // 选角相关
    selectCharacter: (characterId: string) => void;
    hostStartGame: () => void;
    playerReady: () => void;
};

const requireMove = <T extends (...args: unknown[]) => void>(value: unknown, name: string): T => {
    if (typeof value !== 'function') {
        throw new Error(`[DiceThroneBoard] 缺少 move: ${name}`);
    }
    return value as T;
};

const resolveMoves = (raw: Record<string, unknown>): DiceThroneMoveMap => {
    // 统一把 payload 包装成领域命令结构，避免 die_not_found 等校验失败
    const advancePhase = requireMove(raw.advancePhase ?? raw.ADVANCE_PHASE, 'advancePhase');
    const rollDice = requireMove(raw.rollDice ?? raw.ROLL_DICE, 'rollDice');
    const toggleDieLock = requireMove(raw.toggleDieLock ?? raw.TOGGLE_DIE_LOCK, 'toggleDieLock');
    const confirmRoll = requireMove(raw.confirmRoll ?? raw.CONFIRM_ROLL, 'confirmRoll');
    const selectAbility = requireMove(raw.selectAbility ?? raw.SELECT_ABILITY, 'selectAbility');
    const playCard = requireMove(raw.playCard ?? raw.PLAY_CARD, 'playCard');
    const sellCard = requireMove(raw.sellCard ?? raw.SELL_CARD, 'sellCard');
    const undoSellCardRaw = (raw.undoSellCard ?? raw.UNDO_SELL_CARD) as ((payload?: unknown) => void) | undefined;
    const resolveChoice = requireMove(raw.resolveChoice ?? raw.RESOLVE_CHOICE, 'resolveChoice');

    const responsePassRaw = (raw.responsePass ?? raw.RESPONSE_PASS) as ((payload?: unknown) => void) | undefined;
    // 卡牌交互 moves
    const modifyDieRaw = (raw.modifyDie ?? raw.MODIFY_DIE) as ((payload: unknown) => void) | undefined;
    const rerollDieRaw = (raw.rerollDie ?? raw.REROLL_DIE) as ((payload: unknown) => void) | undefined;
    const removeStatusRaw = (raw.removeStatus ?? raw.REMOVE_STATUS) as ((payload: unknown) => void) | undefined;
    const transferStatusRaw = (raw.transferStatus ?? raw.TRANSFER_STATUS) as ((payload: unknown) => void) | undefined;
    const confirmInteractionRaw = (raw.confirmInteraction ?? raw.CONFIRM_INTERACTION) as ((payload: unknown) => void) | undefined;
    const cancelInteractionRaw = (raw.cancelInteraction ?? raw.CANCEL_INTERACTION) as ((payload: unknown) => void) | undefined;
    // Token 响应 moves
    const useTokenRaw = (raw.useToken ?? raw.USE_TOKEN) as ((payload: unknown) => void) | undefined;
    const skipTokenResponseRaw = (raw.skipTokenResponse ?? raw.SKIP_TOKEN_RESPONSE) as ((payload: unknown) => void) | undefined;
    const usePurifyRaw = (raw.usePurify ?? raw.USE_PURIFY) as ((payload: unknown) => void) | undefined;
    const payToRemoveKnockdownRaw = (raw.payToRemoveKnockdown ?? raw.PAY_TO_REMOVE_KNOCKDOWN) as ((payload: unknown) => void) | undefined;
    // 奖励骰重掷 moves
    const rerollBonusDieRaw = (raw.rerollBonusDie ?? raw.REROLL_BONUS_DIE) as ((payload: unknown) => void) | undefined;
    const skipBonusDiceRerollRaw = (raw.skipBonusDiceReroll ?? raw.SKIP_BONUS_DICE_REROLL) as ((payload: unknown) => void) | undefined;
    const selectCharacterRaw = (raw.selectCharacter ?? raw.SELECT_CHARACTER) as ((payload: unknown) => void) | undefined;
    const hostStartGameRaw = (raw.hostStartGame ?? raw.HOST_START_GAME) as ((payload: unknown) => void) | undefined;
    const playerReadyRaw = (raw.playerReady ?? raw.PLAYER_READY) as ((payload: unknown) => void) | undefined;

    return {
        advancePhase: () => advancePhase({}),
        rollDice: () => rollDice({}),
        toggleDieLock: (id) => toggleDieLock({ dieId: id }),
        confirmRoll: () => confirmRoll({}),
        selectAbility: (abilityId) => selectAbility({ abilityId }),
        playCard: (cardId) => playCard({ cardId }),
        sellCard: (cardId) => sellCard({ cardId }),
        undoSellCard: undoSellCardRaw ? () => undoSellCardRaw({}) : undefined,
        resolveChoice: (statusId) => resolveChoice({ statusId }),
        responsePass: (forPlayerId) => responsePassRaw?.(forPlayerId ? { forPlayerId } : {}),
        // 卡牌交互
        modifyDie: (dieId, newValue) => modifyDieRaw?.({ dieId, newValue }),
        rerollDie: (dieId) => rerollDieRaw?.({ dieId }),
        removeStatus: (targetPlayerId, statusId) => removeStatusRaw?.({ targetPlayerId, statusId }),
        transferStatus: (fromPlayerId, toPlayerId, statusId) => transferStatusRaw?.({ fromPlayerId, toPlayerId, statusId }),
        confirmInteraction: (interactionId, selectedDiceIds) => confirmInteractionRaw?.({ interactionId, selectedDiceIds }),
        cancelInteraction: () => cancelInteractionRaw?.({}),
        // Token 响应
        useToken: (tokenId, amount) => useTokenRaw?.({ tokenId, amount }),
        skipTokenResponse: () => skipTokenResponseRaw?.({}),
        usePurify: (statusId) => usePurifyRaw?.({ statusId }),
        // 击倒移除
        payToRemoveKnockdown: () => payToRemoveKnockdownRaw?.({}),
        // 奖励骰重掷
        rerollBonusDie: (dieIndex) => rerollBonusDieRaw?.({ dieIndex }),
        skipBonusDiceReroll: () => skipBonusDiceRerollRaw?.({}),
        selectCharacter: (characterId) => selectCharacterRaw?.({ characterId }),
        hostStartGame: () => hostStartGameRaw?.({}),
        playerReady: () => playerReadyRaw?.({}),
    };
};

// --- Main Layout ---
export const DiceThroneBoard: React.FC<DiceThroneBoardProps> = ({ G: rawG, ctx, moves, playerID, reset, matchData, isMultiplayer }) => {
    const G = rawG.core;
    const access = useDiceThroneState(rawG);
    const choice = useCurrentChoice(access);
    const gameMode = useGameMode();
    const isSpectator = !!gameMode?.isSpectator;

    // 使用引擎层 useSpectatorMoves Hook 自动拦截观察者操作（消除88行重复代码）
    const engineMoves = useSpectatorMoves(
        resolveMoves(moves as Record<string, unknown>),
        isSpectator,
        playerID || undefined,
        { logPrefix: 'Spectate[DiceThrone]' }
    ) as DiceThroneMoveMap;
    const { t, i18n } = useTranslation('game-dicethrone');
    useTutorialBridge(rawG.sys.tutorial, moves as Record<string, unknown>);
    const { isActive: isTutorialActive, currentStep: tutorialStep, nextStep: nextTutorialStep } = useTutorial();
    const toast = useToast();
    const locale = i18n.resolvedLanguage ?? i18n.language;
    const shouldAutoSkipSelection = React.useMemo(() => {
        if (typeof window === 'undefined') return false;
        try {
            return window.localStorage.getItem('tutorial_skip') === '1';
        } catch {
            return false;
        }
    }, []);
    const autoSkipStageRef = React.useRef<'idle' | 'selected' | 'completed'>('idle');

    const isGameOver = ctx.gameover;
    const rootPid = playerID || '0';
    const player = G.players[rootPid] || G.players['0'];
    const otherPid = Object.keys(G.players).find(id => id !== rootPid) || '1';
    const opponent = G.players[otherPid];
    // 获取对手用户名
    const opponentName = matchData?.find(p => String(p.id) === otherPid)?.name ?? t('common.opponent');

    // 从 access.turnPhase 读取阶段（单一权威：来自 sys.phase）
    const currentPhase = access.turnPhase;

    // 重赛系统（socket）
    const { state: rematchState, vote: handleRematchVote, registerReset } = useRematch();

    // 注册 reset 回调（当双方都投票后由 socket 触发）
    React.useEffect(() => {
        if (!isSpectator && reset) {
            registerReset(reset);
        }
    }, [reset, registerReset, isSpectator]);

    React.useEffect(() => {
        if (!shouldAutoSkipSelection) return;
        if (isSpectator) return;
        if (gameMode?.mode === 'tutorial') return;
        if (currentPhase !== 'setup') return;

        const isAutoSkipDone = () => {
            const selectedCharacter = G.selectedCharacters[rootPid];
            const hasSelected = selectedCharacter && selectedCharacter !== 'unselected';
            if (!hasSelected) return false;
            if (gameMode?.mode === 'online') {
                if (rootPid === G.hostPlayerId) {
                    return G.hostStarted;
                }
                return !!G.readyPlayers?.[rootPid];
            }
            if (gameMode?.mode === 'local') {
                return G.hostStarted;
            }
            return false;
        };

        let timer: number | undefined;
        const attemptAutoSkip = () => {
            if (isAutoSkipDone()) {
                autoSkipStageRef.current = 'completed';
                if (timer !== undefined) {
                    window.clearInterval(timer);
                }
                return;
            }

            const selectedCharacter = G.selectedCharacters[rootPid];
            const hasSelected = selectedCharacter && selectedCharacter !== 'unselected';

            if (!hasSelected) {
                const defaultCharacter = rootPid === '1' ? 'barbarian' : 'monk';
                engineMoves.selectCharacter(defaultCharacter);
                autoSkipStageRef.current = 'selected';
                return;
            }

            if (gameMode?.mode === 'online') {
                if (rootPid === G.hostPlayerId) {
                    if (!G.hostStarted) {
                        engineMoves.hostStartGame();
                    }
                } else if (!G.readyPlayers?.[rootPid]) {
                    engineMoves.playerReady();
                }
                return;
            }

            if (gameMode?.mode === 'local') {
                if (!G.hostStarted) {
                    engineMoves.hostStartGame();
                }
            }
        };

        attemptAutoSkip();
        timer = window.setInterval(attemptAutoSkip, 800);

        return () => {
            if (timer !== undefined) {
                window.clearInterval(timer);
            }
        };
    }, [
        G.hostPlayerId,
        G.hostStarted,
        G.readyPlayers,
        G.selectedCharacters,
        currentPhase,
        engineMoves,
        gameMode?.mode,
        isSpectator,
        rootPid,
        shouldAutoSkipSelection,
    ]);

    // 判断游戏结果
    const isWinner = isGameOver && ctx.gameover?.winner === rootPid;

    // 获取所有玩家名称映射
    const playerNames = React.useMemo(() => {
        const names: Record<string, string> = {};
        Object.keys(G.players).forEach(pid => {
            names[pid] = matchData?.find(p => String(p.id) === pid)?.name ?? t('common.opponent');
        });
        return names;
    }, [G.players, matchData, t]);

    // 音频系统
    useDiceThroneAudio({
        G,
        rawState: rawG,
        currentPlayerId: rootPid,
        currentPhase,
        isGameOver: !!isGameOver,
        isWinner,
    });

    // 使用 useUIState Hook 整合20+个分散的UI状态
    const {
        magnify,
        isMagnifyOpen,
        setMagnifiedImage,
        setMagnifiedCards,
        closeMagnify,
        modals,
        openModal,
        closeModal,
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

    // Atlas 配置（保持独立，用于资源加载）
    const [_cardAtlasRevision, setCardAtlasRevision] = React.useState(0);
    const [statusIconAtlas, setStatusIconAtlas] = React.useState<StatusIconAtlasConfig | null>(null);

    // 使用 useCardSpotlight Hook 管理卡牌和额外骰子特写
    const {
        cardSpotlightQueue,
        handleCardSpotlightClose,
        bonusDie,
        handleBonusDieClose,
    } = useCardSpotlight({
        lastPlayedCard: G.lastPlayedCard,
        lastBonusDieRoll: G.lastBonusDieRoll,
        currentPlayerId: rootPid,
        opponentName,
        isSpectator,
    });

    // 使用动画库 Hooks
    const { effects: flyingEffects, pushEffect: pushFlyingEffect, removeEffect: handleEffectComplete } = useFlyingEffects();
    const { isShaking: isOpponentShaking, triggerShake: triggerOpponentShake } = useShake(500);
    const { triggerGlow: triggerAbilityGlow } = usePulseGlow(800);
    const {
        isActive: isOpponentHitStopActive,
        config: opponentHitStopConfig,
        triggerHitStop: triggerOpponentHitStop,
    } = useHitStop(80);
    const {
        isActive: isOpponentSlashActive,
        config: opponentSlashConfig,
        triggerSlash: triggerOpponentSlash,
    } = useSlashEffect();
    const {
        isActive: isSelfHitStopActive,
        config: selfHitStopConfig,
        triggerHitStop: triggerSelfHitStop,
    } = useHitStop(80);
    const {
        isActive: isSelfSlashActive,
        config: selfSlashConfig,
        triggerSlash: triggerSelfSlash,
    } = useSlashEffect();

    // DOM 引用
    const opponentHpRef = React.useRef<HTMLDivElement>(null);
    const selfHpRef = React.useRef<HTMLDivElement>(null);
    const opponentBuffRef = React.useRef<HTMLDivElement>(null);
    const opponentHeaderRef = React.useRef<HTMLDivElement>(null);
    const selfBuffRef = React.useRef<HTMLDivElement>(null);
    const drawDeckRef = React.useRef<HTMLDivElement>(null);
    const discardPileRef = React.useRef<HTMLDivElement>(null);

    // 使用 useInteractionState Hook 管理交互状态
    const pendingInteraction = G.pendingInteraction;
    const { localState: localInteraction, handlers: interactionHandlers } = useInteractionState(pendingInteraction);

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
    const tokenResponsePhase: TokenResponsePhase | null = pendingDamage
        ? (pendingDamage.responderId === pendingDamage.sourcePlayerId ? 'attackerBoost' : 'defenderMitigation')
        : null;
    const isTokenResponder = pendingDamage && (pendingDamage.responderId === rootPid);

    const isActivePlayer = G.activePlayerId === rootPid;
    const { rollerId, shouldAutoObserve, viewMode, isSelfView } = computeViewModeState({
        currentPhase,
        pendingAttack: G.pendingAttack,
        activePlayerId: G.activePlayerId,
        rootPlayerId: rootPid,
        manualViewMode,
    });
    const viewPid = isSelfView ? rootPid : otherPid;
    const viewPlayer = (isSelfView ? player : opponent) || player;
    const isRollPhase = currentPhase === 'offensiveRoll' || currentPhase === 'defensiveRoll';
    const isViewRolling = viewPid === rollerId;
    const rollConfirmed = G.rollConfirmed;
    // availableAbilityIds 现在是派生状态，从 useDiceThroneState hook 中获取
    const availableAbilityIds = isViewRolling ? access.availableAbilityIds : [];
    const availableAbilityIdsForRoller = access.availableAbilityIds;
    const selectedAbilityId = currentPhase === 'defensiveRoll'
        ? (isViewRolling ? G.pendingAttack?.defenseAbilityId : undefined)
        : (isViewRolling ? G.pendingAttack?.sourceAbilityId : undefined);
    const canOperateView = isSelfView && !isSpectator;
    const hasRolled = G.rollCount > 0;

    // 焦点玩家判断（统一的操作权判断）
    const isFocusPlayer = !isSpectator && access.focusPlayerId === rootPid;
    const hasPendingInteraction = Boolean(pendingInteraction);

    // 防御阶段进入时就应高亮可用的防御技能，不需要等投骰
    const canHighlightAbility = canOperateView && isViewRolling && isRollPhase
        && (currentPhase === 'defensiveRoll' || hasRolled);
    const canSelectAbility = canOperateView && isViewRolling && isRollPhase
        && (currentPhase === 'defensiveRoll' ? true : G.rollConfirmed);
    // 阶段推进权限：由焦点玩家控制，防御阶段需要验证 rollConfirmed
    const canAdvancePhase = isFocusPlayer && !hasPendingInteraction && (currentPhase === 'defensiveRoll' ? rollConfirmed : true);
    const canResolveChoice = Boolean(choice.hasChoice && choice.playerId === rootPid);
    const canInteractDice = canOperateView && isViewRolling;
    // 响应窗口状态
    const responseWindow = access.responseWindow;
    const isResponseWindowOpen = !!responseWindow;
    // 当前响应者 ID（从队列中获取）
    const currentResponderId = responseWindow?.responderQueue[responseWindow.currentResponderIndex];
    const isResponder = isResponseWindowOpen && currentResponderId === rootPid;

    // 检测当前响应者是否离线，如果离线则自动跳过
    const isResponderOffline = React.useMemo(() => {
        if (!isResponseWindowOpen || !currentResponderId) return false;
        // 找到当前响应者的 matchData
        const responderData = matchData?.find(p => String(p.id) === currentResponderId);
        // 如果找不到或者 isConnected 为 false，认为离线
        return responderData ? responderData.isConnected === false : false;
    }, [isResponseWindowOpen, currentResponderId, matchData]);

    // 当检测到当前响应者离线时，自动代替他跳过响应
    // 注：只有当自己是活跃玩家时才执行（避免双方都发送 pass）
    React.useEffect(() => {
        if (isResponderOffline && isActivePlayer && currentResponderId && currentResponderId !== rootPid) {
            console.log('[DiceThrone] 检测到响应者离线，自动跳过:', currentResponderId);
            // 延迟一小段时间确保 UI 状态同步
            const timer = setTimeout(() => {
                engineMoves.responsePass(currentResponderId);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isResponderOffline, isActivePlayer, currentResponderId, rootPid, engineMoves]);

    // 自己的手牌永远显示
    const handOwner = player;
    const showAdvancePhaseButton = isSelfView && !isSpectator;
    const handleCancelInteraction = React.useCallback(() => {
        if (pendingInteraction?.sourceCardId) {
            setLastUndoCardId(pendingInteraction.sourceCardId);
        }
        engineMoves.cancelInteraction();
    }, [engineMoves, pendingInteraction, setLastUndoCardId]);

    // 骰子交互配置（需要在 waitingReason 之前定义）
    const isDiceInteraction = pendingInteraction && (
        pendingInteraction.type === 'selectDie' || pendingInteraction.type === 'modifyDie'
    );
    // 只有交互所有者才能看到交互 UI
    const isInteractionOwner = !isSpectator && pendingInteraction?.playerId === rootPid;

    // 等待对方思考（isFocusPlayer 已在上方定义）
    const isWaitingOpponent = !isFocusPlayer;
    const thinkingOffsetClass = 'bottom-[12vw]';

    // 可被净化移除的负面状态：由定义驱动（支持扩展）
    const purifiableStatusIds = (G.tokenDefinitions ?? [])
        .filter(def => def.category === 'debuff' && def.passiveTrigger?.removable)
        .map(def => def.id);

    // 是否可以使用净化（有净化 Token 且有可移除的负面状态）
    const canUsePurify = !isSpectator && (player.tokens?.[TOKEN_IDS.PURIFY] ?? 0) > 0 &&
        Object.entries(player.statusEffects ?? {}).some(([id, stacks]) => purifiableStatusIds.includes(id) && stacks > 0);

    // 是否可以移除击倒（有击倒状态且 CP >= 2 且在 offensiveRoll 前的阶段）
    const canRemoveKnockdown = !isSpectator && isActivePlayer &&
        (currentPhase === 'upkeep' || currentPhase === 'income' || currentPhase === 'main1') &&
        (player.statusEffects?.[STATUS_IDS.KNOCKDOWN] ?? 0) > 0 &&
        (player.resources?.[RESOURCE_IDS.CP] ?? 0) >= 2;

    // 使用 useDiceInteractionConfig Hook 生成骰子交互配置（简化132行代码）
    const diceInteractionConfig = useDiceInteractionConfig({
        pendingInteraction,
        isInteractionOwner,
        localState: localInteraction,
        dice: G.dice,
        engineMoves: {
            modifyDie: engineMoves.modifyDie,
            confirmInteraction: engineMoves.confirmInteraction,
        },
        onCancel: handleCancelInteraction,
        setRerollingDiceIds,
        onSelectDieLocal: interactionHandlers.selectDie,
        onModifyDieLocal: (dieId, newValue) => {
            interactionHandlers.modifyDie(dieId, newValue, G.dice);
            engineMoves.modifyDie(dieId, newValue);
        },
    });

    // 状态效果/玩家交互配置
    const isStatusInteraction = pendingInteraction && (
        pendingInteraction.type === 'selectStatus' ||
        pendingInteraction.type === 'selectPlayer' ||
        pendingInteraction.type === 'selectTargetStatus'
    );

    const handleSelectStatus = interactionHandlers.selectStatus;
    const handleSelectPlayer = interactionHandlers.selectPlayer;

    const statusInteraction = React.useMemo(() => {
        if (!pendingInteraction || !isStatusInteraction) return pendingInteraction;

        const selected = (() => {
            if (pendingInteraction.type === 'selectPlayer') {
                return localInteraction.selectedPlayer
                    ? [localInteraction.selectedPlayer]
                    : (pendingInteraction.selected ?? []);
            }
            if (pendingInteraction.type === 'selectTargetStatus' && pendingInteraction.transferConfig?.statusId) {
                return localInteraction.selectedPlayer
                    ? [localInteraction.selectedPlayer]
                    : (pendingInteraction.selected ?? []);
            }
            if (pendingInteraction.type === 'selectStatus' || pendingInteraction.type === 'selectTargetStatus') {
                return localInteraction.selectedStatus
                    ? [localInteraction.selectedStatus.statusId]
                    : (pendingInteraction.selected ?? []);
            }
            return pendingInteraction.selected ?? [];
        })();

        return {
            ...pendingInteraction,
            selected,
        };
    }, [
        pendingInteraction,
        isStatusInteraction,
        localInteraction.selectedPlayer,
        localInteraction.selectedStatus,
    ]);

    const handleStatusInteractionConfirm = () => {
        if (!pendingInteraction) return;

        if (pendingInteraction.type === 'selectStatus') {
            // 移除单个状态
            if (localInteraction.selectedStatus) {
                engineMoves.removeStatus(
                    localInteraction.selectedStatus.playerId,
                    localInteraction.selectedStatus.statusId
                );
            }
        } else if (pendingInteraction.type === 'selectPlayer') {
            // 移除玩家所有状态
            if (localInteraction.selectedPlayer) {
                engineMoves.removeStatus(localInteraction.selectedPlayer);
            }
        } else if (pendingInteraction.type === 'selectTargetStatus') {
            // 转移状态
            const transferConfig = pendingInteraction.transferConfig;
            if (transferConfig?.sourcePlayerId && transferConfig?.statusId && localInteraction.selectedPlayer) {
                engineMoves.transferStatus(
                    transferConfig.sourcePlayerId,
                    localInteraction.selectedPlayer,
                    transferConfig.statusId
                );
            } else if (localInteraction.selectedStatus) {
                // 第一阶段：选择要转移的状态
                // TODO: 这里需要更新 pendingInteraction.transferConfig
            }
        }
        engineMoves.confirmInteraction(pendingInteraction.id);
    };

    const getAbilityStartPos = React.useCallback((abilityId?: string) => {
        if (!abilityId) return getViewportCenter();
        const slotId = getAbilitySlotId(abilityId);
        if (!slotId) return getViewportCenter();
        const element = document.querySelector(`[data-ability-slot="${slotId}"]`) as HTMLElement | null;
        return getElementCenter(element);
    }, []);

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

    React.useEffect(() => {
        let isActive = true;
        const loadAtlas = async (atlasId: string, imageBase: string, imageOverride?: string) => {
            try {
                const config = await loadCardAtlasConfig(imageBase, locale);
                if (!isActive) return;
                registerCardAtlasSource(atlasId, {
                    image: imageOverride ?? imageBase,
                    config,
                });
                setCardAtlasRevision(prev => prev + 1);
            } catch {
                // 忽略单个图集加载失败
            }
        };

        const monkAtlasBase = ASSETS.CARDS_ATLAS('monk');
        const barbarianAtlasBase = ASSETS.CARDS_ATLAS('barbarian');
        void loadAtlas(DICETHRONE_CARD_ATLAS_IDS.MONK, monkAtlasBase);
        void loadAtlas(DICETHRONE_CARD_ATLAS_IDS.BARBARIAN, barbarianAtlasBase, `${barbarianAtlasBase}.png`);

        return () => {
            isActive = false;
        };
    }, [locale]);

    React.useEffect(() => {
        let isActive = true;
        loadStatusIconAtlasConfig()
            .then((config) => {
                if (isActive) setStatusIconAtlas(config);
            })
            .catch(() => {
                if (isActive) setStatusIconAtlas(null);
            });
        return () => {
            isActive = false;
        };
    }, []);

    const shouldBlockTutorialAction = React.useCallback((targetId: string) => {
        return Boolean(
            isTutorialActive
            && tutorialStep?.requireAction
            && tutorialStep.highlightTarget
            && tutorialStep.highlightTarget !== targetId
        );
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

    const handleAdvancePhase = () => {
        if (!canAdvancePhase) {
            if (currentPhase === 'offensiveRoll' && !G.rollConfirmed) {
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
            const shouldConfirmSkip = !hasSelectedAbility && (!G.rollConfirmed || hasAvailableAbilities);
            if (shouldConfirmSkip) {
                openModal('confirmSkip');
                return;
            }
        }
        engineMoves.advancePhase();
        advanceTutorialIfNeeded('advance-phase-button');
    };

    React.useEffect(() => {
        if (isActivePlayer && ['upkeep', 'income'].includes(currentPhase)) {
            const timer = setTimeout(() => engineMoves.advancePhase(), 800);
            return () => clearTimeout(timer);
        }
        // 弃牌阶段：只有手牌不超限时才自动推进
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
        if (currentPhase === 'offensiveRoll' && isActivePlayer) setViewMode('self');
    }, [currentPhase, isActivePlayer, rollerId, rootPid, setViewMode]);

    React.useEffect(() => {
        const sourceAbilityId = G.activatingAbilityId ?? G.pendingAttack?.sourceAbilityId;
        if (!sourceAbilityId) return;
        setActivatingAbilityId(sourceAbilityId);
        triggerAbilityGlow();
        const timer = setTimeout(() => setActivatingAbilityId(undefined), 800);
        return () => clearTimeout(timer);
    }, [G.activatingAbilityId, G.pendingAttack?.sourceAbilityId, triggerAbilityGlow]);



    const damageStreamEntry = React.useMemo(() => {
        const entries = rawG.sys?.eventStream?.entries ?? [];
        for (let i = entries.length - 1; i >= 0; i -= 1) {
            const entry = entries[i];
            if ((entry.event as { type?: string }).type === 'DAMAGE_DEALT') {
                return entry;
            }
        }
        return undefined;
    }, [rawG.sys?.eventStream?.entries]);

    // 使用 useAnimationEffects Hook 管理飞行动画效果（替代170行重复代码）
    useAnimationEffects({
        players: { player, opponent },
        currentPlayerId: rootPid,
        opponentId: otherPid,
        refs: {
            opponentHp: opponentHpRef,
            selfHp: selfHpRef,
            opponentBuff: opponentBuffRef,
            selfBuff: selfBuffRef,
        },
        getEffectStartPos,
        pushFlyingEffect,
        triggerOpponentShake,
        triggerSlash: triggerOpponentSlash,
        triggerHitStop: triggerOpponentHitStop,
        triggerSelfImpact: (damage) => {
            triggerSelfSlash(getSlashPresetByDamage(damage));
            triggerSelfHitStop(getHitStopPresetByDamage(damage));
        },
        locale,
        statusIconAtlas,
        damageStreamEntry,
    });

    const advanceLabel = currentPhase === 'offensiveRoll'
        ? t('actions.resolveAttack')
        : currentPhase === 'defensiveRoll'
            ? t('actions.endDefense')
            : t('actions.nextPhase');

    if (!player) return <div className="p-10 text-white">{t('status.loadingGameState', { playerId: rootPid })}</div>;

    // --- Setup 阶段：仅渲染全屏选角界面 ---
    if (currentPhase === 'setup') {
        // 教学模式下不显示选角界面，教程清单会通过 AI 动作自动选角
        // 但需要等待 AI 动作执行完成（约 1 秒），期间显示加载提示
        if (isTutorialActive) {
            return (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F0F23] text-white">
                    <div className="text-[1.5vw] font-bold animate-pulse">{t('status.loadingGameState', { playerId: rootPid })}</div>
                </div>
            );
        }
        
        return (
            <UndoProvider value={{ G: rawG, ctx, moves, playerID, isGameOver: !!isGameOver, isLocalMode: !isMultiplayer }}>
                <div className="relative w-full h-dvh bg-[#0a0a0c] overflow-hidden font-sans select-none">
                    <DiceThroneCharacterSelection
                        isOpen={true}
                        currentPlayerId={rootPid}
                        hostPlayerId={G.hostPlayerId}
                        selectedCharacters={G.selectedCharacters}
                        readyPlayers={G.readyPlayers ?? {}}
                        playerNames={playerNames}
                        onSelect={engineMoves.selectCharacter}
                        onReady={engineMoves.playerReady}
                        onStart={engineMoves.hostStartGame}
                        locale={locale}
                    />
                </div>
            </UndoProvider>
        );
    }

    // --- 游戏进行阶段：渲染完整棋盘 UI ---
    return (
        <UndoProvider value={{ G: rawG, ctx, moves, playerID, isGameOver: !!isGameOver, isLocalMode: !isMultiplayer }}>
            <div className="relative w-full h-dvh bg-black overflow-hidden font-sans select-none text-slate-200">
                {!isSpectator && (
                    <GameDebugPanel G={rawG} ctx={ctx} moves={moves} playerID={playerID}>
                        {/* DiceThrone 专属作弊工具 */}
                        <DiceThroneDebugConfig G={rawG} ctx={ctx} moves={moves} />

                        {/* 测试工具 */}
                        <div className="pt-4 border-t border-gray-200 mt-4 space-y-3">
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">测试工具</h4>
                            <button
                                onClick={toggleLayoutEditing}
                                className={`w-full py-2 rounded font-bold text-xs border transition-[background-color] duration-200 ${isLayoutEditing ? 'bg-amber-600 border-amber-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                            >
                                {isLayoutEditing ? t('layout.exitEdit') : t('layout.enterEdit')}
                            </button>
                        </div>
                    </GameDebugPanel>
                )}

                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-black/40 z-10 pointer-events-none" />
                    <OptimizedImage
                        src={getLocalizedAssetPath('dicethrone/images/Common/background', locale)}
                        fallbackSrc="dicethrone/images/Common/background"
                        className="w-full h-full object-cover"
                        alt={t('imageAlt.background')}
                    />
                </div>

                {opponent && (
                    <OpponentHeader
                        opponent={opponent}
                        opponentName={opponentName}
                        viewMode={viewMode}
                        isOpponentShaking={isOpponentShaking}
                        hitStopActive={isOpponentHitStopActive}
                        hitStopConfig={opponentHitStopConfig}
                        slashActive={isOpponentSlashActive}
                        slashConfig={opponentSlashConfig}
                        shouldAutoObserve={shouldAutoObserve}
                        onToggleView={() => {
                            toggleViewMode();
                        }}
                        headerError={headerError}
                        opponentBuffRef={opponentBuffRef}
                        opponentHpRef={opponentHpRef}
                        statusIconAtlas={statusIconAtlas}
                        locale={locale}
                        containerRef={opponentHeaderRef}
                    />
                )}

                <FlyingEffectsLayer effects={flyingEffects} onEffectComplete={handleEffectComplete} />
                <div className="absolute inset-x-0 top-[2vw] bottom-0 z-10 pointer-events-none">
                    <LeftSidebar
                        currentPhase={currentPhase}
                        viewPlayer={player} // Always show own stats
                        locale={locale}
                        statusIconAtlas={statusIconAtlas}
                        selfBuffRef={selfBuffRef}
                        selfHpRef={selfHpRef}
                        hitStopActive={isSelfHitStopActive}
                        hitStopConfig={selfHitStopConfig}
                        slashActive={isSelfSlashActive}
                        slashConfig={selfSlashConfig}
                        drawDeckRef={drawDeckRef}
                        onPurifyClick={() => openModal('purify')}
                        canUsePurify={canUsePurify}
                        tokenDefinitions={G.tokenDefinitions}
                        onKnockdownClick={() => openModal('removeKnockdown')}
                        canRemoveKnockdown={canRemoveKnockdown}
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
                        onSelectAbility={(abilityId) => {
                            if (shouldBlockTutorialAction('ability-slots')) return;
                            engineMoves.selectAbility(abilityId);
                            advanceTutorialIfNeeded('ability-slots');
                        }}
                        onHighlightedAbilityClick={() => {
                            if (currentPhase === 'offensiveRoll' && !G.rollConfirmed) {
                                toast.warning(t('error.confirmRoll'));
                            }
                        }}
                        selectedAbilityId={selectedAbilityId}
                        activatingAbilityId={activatingAbilityId}
                        abilityLevels={viewPlayer.abilityLevels}
                        characterId={viewPlayer.characterId}
                        locale={locale}
                        onMagnifyImage={(image) => setMagnifiedImage(image)}
                    />

                    <RightSidebar
                        dice={G.dice}
                        rollCount={G.rollCount}
                        rollLimit={G.rollLimit}
                        rollConfirmed={rollConfirmed}
                        currentPhase={currentPhase}
                        canInteractDice={canInteractDice}
                        isRolling={isRolling}
                        setIsRolling={(rolling: boolean) => setIsRolling(rolling)}
                        rerollingDiceIds={rerollingDiceIds}
                        locale={locale}
                        onToggleLock={(id) => engineMoves.toggleDieLock(id)}
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
                        canUndoDiscard={canOperateView && !!G.lastSoldCardId && (currentPhase === 'main1' || currentPhase === 'main2' || currentPhase === 'discard')}
                        onUndoDiscard={() => {
                            setLastUndoCardId(G.lastSoldCardId);
                            engineMoves.undoSellCard?.();
                        }}
                        discardHighlighted={discardHighlighted}
                        sellButtonVisible={sellButtonVisible}
                        diceInteractionConfig={diceInteractionConfig}
                    />
                </div>

                {/* HandArea 不再依赖 cardAtlasRevision，确保手牌始终渲染 */}
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
                            />
                            <HandArea
                                hand={handOwner.hand}
                                locale={locale}
                                currentPhase={currentPhase}
                                playerCp={handOwner.resources[RESOURCE_IDS.CP] ?? 0}
                                onPlayCard={(cardId) => engineMoves.playCard(cardId)}
                                onSellCard={(cardId) => {
                                    if (shouldBlockTutorialAction('discard-pile')) return;
                                    engineMoves.sellCard(cardId);
                                    advanceTutorialIfNeeded('discard-pile');
                                }}
                                onError={(msg) => toast.warning(msg)}
                                canInteract={isResponder || isSelfView}
                                canPlayCards={isActivePlayer || isResponder}
                                drawDeckRef={drawDeckRef}
                                discardPileRef={discardPileRef}
                                undoCardId={lastUndoCardId}
                                onSellHintChange={setDiscardHighlighted}
                                onPlayHintChange={setCoreAreaHighlighted}
                                onSellButtonChange={setSellButtonVisible}
                                isDiscardMode={isDiscardMode}
                                onDiscardCard={(cardId) => {
                                    if (shouldBlockTutorialAction('discard-pile')) return;
                                    engineMoves.sellCard(cardId);
                                    advanceTutorialIfNeeded('discard-pile');
                                }}
                            />
                        </>
                    );
                })()}

                <BoardOverlays
                    // 放大预览
                    isMagnifyOpen={isMagnifyOpen}
                    magnifiedImage={magnify.image}
                    magnifiedCard={magnify.card}
                    magnifiedCards={magnify.cards}
                    onCloseMagnify={closeMagnify}

                    // 弹窗状态
                    isConfirmingSkip={modals.confirmSkip}
                    onConfirmSkip={() => {
                        closeModal('confirmSkip');
                        engineMoves.advancePhase();
                    }}
                    onCancelSkip={() => closeModal('confirmSkip')}

                    isPurifyModalOpen={modals.purify}
                    onConfirmPurify={(statusId) => {
                        engineMoves.usePurify(statusId);
                        closeModal('purify');
                    }}
                    onCancelPurify={() => closeModal('purify')}

                    isConfirmRemoveKnockdownOpen={modals.removeKnockdown}
                    onConfirmRemoveKnockdown={() => {
                        closeModal('removeKnockdown');
                        engineMoves.payToRemoveKnockdown();
                    }}
                    onCancelRemoveKnockdown={() => closeModal('removeKnockdown')}

                    // 选择弹窗
                    choice={choice}
                    canResolveChoice={canResolveChoice}
                    onResolveChoice={(optionId) => {
                        const promptMove = (moves as Record<string, unknown>)[PROMPT_COMMANDS.RESPOND];
                        if (typeof promptMove === 'function') {
                            (promptMove as (payload: { optionId: string }) => void)({ optionId });
                        }
                    }}

                    // 卡牌特写
                    cardSpotlightQueue={cardSpotlightQueue}
                    onCardSpotlightClose={handleCardSpotlightClose}
                    opponentHeaderRef={opponentHeaderRef}

                    // 额外骰子
                    bonusDie={bonusDie}
                    onBonusDieClose={handleBonusDieClose}

                    // 奖励骰重掷交互
                    pendingBonusDiceSettlement={G.pendingBonusDiceSettlement}
                    canRerollBonusDie={Boolean(
                        G.pendingBonusDiceSettlement &&
                        G.pendingBonusDiceSettlement.attackerId === rootPid &&
                        (player.tokens?.[TOKEN_IDS.TAIJI] ?? 0) >= (G.pendingBonusDiceSettlement?.rerollCostAmount ?? 1) &&
                        (G.pendingBonusDiceSettlement.maxRerollCount === undefined ||
                            G.pendingBonusDiceSettlement.rerollCount < G.pendingBonusDiceSettlement.maxRerollCount)
                    )}
                    onRerollBonusDie={(dieIndex) => engineMoves.rerollBonusDie(dieIndex)}
                    onSkipBonusDiceReroll={() => engineMoves.skipBonusDiceReroll()}

                    // Token 响应
                    pendingDamage={pendingDamage}
                    tokenResponsePhase={tokenResponsePhase}
                    isTokenResponder={!!isTokenResponder}
                    tokenDefinitions={G.tokenDefinitions}
                    onUseToken={(tokenId, amount) => engineMoves.useToken(tokenId, amount)}
                    onSkipTokenResponse={() => engineMoves.skipTokenResponse()}

                    // 交互覆盖层
                    isStatusInteraction={!!isStatusInteraction}
                    pendingInteraction={statusInteraction}
                    players={G.players}
                    currentPlayerId={rootPid}
                    onSelectStatus={handleSelectStatus}
                    onSelectPlayer={handleSelectPlayer}
                    onConfirmStatusInteraction={handleStatusInteractionConfirm}
                    onCancelInteraction={handleCancelInteraction}

                    // 净化相关（始终作用于自己）
                    viewPlayer={player}
                    purifiableStatusIds={purifiableStatusIds}

                    // 游戏结束
                    isGameOver={!!isGameOver}
                    gameoverResult={isGameOver}
                    playerID={playerID || undefined}
                    reset={reset}
                    rematchState={rematchState}
                    onRematchVote={handleRematchVote}

                    // 其他
                    statusIconAtlas={statusIconAtlas}
                    locale={locale}
                    moves={moves as Record<string, unknown>}
                    currentPhase={currentPhase}

                    // 选角相关
                    selectedCharacters={G.selectedCharacters}
                    playerNames={playerNames}
                    hostPlayerId={G.hostPlayerId}
                />
            </div>
        </UndoProvider>
    );
};

export default DiceThroneBoard;
