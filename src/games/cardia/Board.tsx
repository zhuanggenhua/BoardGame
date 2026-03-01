import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameBoardProps } from '../../engine/transport/protocol';
import type { CardiaCore, PlayedCard } from './domain/core-types';
import { EndgameOverlay } from '../../components/game/framework/widgets/EndgameOverlay';
import { GameDebugPanel } from '../../components/game/framework/widgets/GameDebugPanel';
import { OptimizedImage } from '../../components/common/media/OptimizedImage';
import { UndoProvider } from '../../contexts/UndoContext';
import { useGameMode } from '../../contexts/GameModeContext';
import { useTutorialBridge } from '../../contexts/TutorialContext';
import { useEndgame } from '../../hooks/game/useEndgame';
import { useGameAudio } from '../../lib/audio/useGameAudio';
import { useToast } from '../../contexts/ToastContext';
import { cardiaAudioConfig } from './audio.config';
import { CARDIA_MANIFEST } from './manifest';
import { CARDIA_COMMANDS } from './domain/commands';
import { AbilityButton } from './ui/AbilityButton';
import { CardSelectionModal } from './ui/CardSelectionModal';
import { FactionSelectionModal } from './ui/FactionSelectionModal';
import { useAbilityAnimations, AbilityAnimationsLayer } from './ui/AbilityAnimations';
import type { FactionId } from './domain/ids';
import { CARDIA_EVENTS } from './domain/events';
import { exposeDebugTools } from './debug';
import { INTERACTION_COMMANDS } from '../../engine/systems/InteractionSystem';

type Props = GameBoardProps<CardiaCore>;

export const CardiaBoard: React.FC<Props> = ({ G, dispatch, playerID, reset, matchData, isMultiplayer }) => {
    const core = G.core;
    const phase = core.phase;
    const isGameOver = G.sys.gameover;
    const gameMode = useGameMode();
    const isLocalMatch = gameMode ? !gameMode.isMultiplayer : !isMultiplayer;
    const { t } = useTranslation('game-cardia');
    const toast = useToast();
    
    // 交互状态
    const [showCardSelection, setShowCardSelection] = useState(false);
    const [showFactionSelection, setShowFactionSelection] = useState(false);
    const [currentInteraction, setCurrentInteraction] = useState<any>(null);
    
    // 动画状态
    const animations = useAbilityAnimations();
    
    // 卡牌元素引用（用于动画定位）
    const cardRefs = React.useRef<Map<string, HTMLElement>>(new Map());
    const setCardRef = React.useCallback((cardUid: string, element: HTMLElement | null) => {
        if (element) {
            cardRefs.current.set(cardUid, element);
        } else {
            cardRefs.current.delete(cardUid);
        }
    }, []);
    
    useTutorialBridge(G.sys.tutorial, dispatch as any);
    
    // 用于追踪已处理的事件 ID（必须在组件顶层声明）
    const lastProcessedIdRef = React.useRef<number>(-1);
    
    // 监听事件流，触发动画
    React.useEffect(() => {
        if (!G.sys.eventStream) return;
        
        const stream = G.sys.eventStream;
        
        // 初始化 lastProcessedId（仅在首次有事件时）
        if (lastProcessedIdRef.current === -1 && stream.entries.length > 0) {
            lastProcessedIdRef.current = stream.entries[stream.entries.length - 1].id;
            return; // 首次挂载时跳过历史事件
        }
        
        // 处理新事件
        const newEntries = stream.entries.filter(entry => entry.id > lastProcessedIdRef.current);
        
        newEntries.forEach(entry => {
            const event = entry.event;
            
            // 能力激活闪光
            if (event.type === CARDIA_EVENTS.ABILITY_ACTIVATED) {
                animations.triggerAbilityFlash();
            }
            
            // 能力无有效目标提示
            if (event.type === CARDIA_EVENTS.ABILITY_NO_VALID_TARGET) {
                const payload = event.payload as any;
                if (payload.reason === 'no_markers') {
                    toast.warning(t('ability.noValidTarget.noMarkers', '场上没有带有修正标记或持续标记的卡牌'));
                }
            }
            
            // 修正标记放置动画
            if (event.type === CARDIA_EVENTS.MODIFIER_TOKEN_PLACED) {
                const payload = event.payload as any;
                const targetElement = cardRefs.current.get(payload.cardId);
                if (targetElement) {
                    // 从屏幕中心飞向目标卡牌
                    animations.addModifierToken(null, targetElement, payload.value);
                }
            }
            
            // 持续标记放置动画
            if (event.type === CARDIA_EVENTS.ONGOING_ABILITY_PLACED) {
                const payload = event.payload as any;
                const targetElement = cardRefs.current.get(payload.cardId);
                if (targetElement) {
                    animations.addOngoingMarker(targetElement);
                }
            }
            
            // 印戒移动动画
            if (event.type === CARDIA_EVENTS.SIGNET_MOVED) {
                const payload = event.payload as any;
                const fromElement = cardRefs.current.get(payload.fromCardId);
                const toElement = cardRefs.current.get(payload.toCardId);
                if (fromElement && toElement) {
                    animations.addSignetMove(fromElement, toElement);
                }
            }
        });
        
        // 更新最后处理的事件 ID
        if (newEntries.length > 0) {
            lastProcessedIdRef.current = newEntries[newEntries.length - 1].id;
        }
    }, [G.sys.eventStream, animations, toast, t]);
    
    const { overlayProps: endgameProps } = useEndgame({
        result: isGameOver || undefined,
        playerID,
        matchData,
        reset,
    });
    
    useGameAudio({
        config: cardiaAudioConfig,
        gameId: CARDIA_MANIFEST.id,
        G: core,
        ctx: {
            currentPlayer: core.currentPlayerId,
            phase: phase,
            gameover: isGameOver,
        },
    });
    
    // 暴露状态给 E2E 测试
    useEffect(() => {
        if (typeof window !== 'undefined') {
            (window as any).__BG_STATE__ = G;
            (window as any).__BG_DISPATCH__ = dispatch;
        }
    }, [G, dispatch]);
    
    // 暴露调试工具
    useEffect(() => {
        exposeDebugTools();
    }, []);
    
    const myPlayerId = playerID || '0';
    const opponentId = core.playerOrder.find(id => id !== myPlayerId) || core.playerOrder[1];
    const myPlayer = core.players[myPlayerId];
    const opponent = core.players[opponentId];
    
    // 监听交互状态变化
    useEffect(() => {
        const interaction = G.sys.interaction?.current;
        if (interaction && interaction.playerId === myPlayerId) {
            setCurrentInteraction(interaction);
            
            // 根据交互类型显示对应的弹窗
            const data = interaction.data as any;
            if (data.interactionType === 'card-selection') {
                setShowCardSelection(true);
            } else if (data.interactionType === 'faction-selection') {
                setShowFactionSelection(true);
            }
        } else {
            setCurrentInteraction(null);
            setShowCardSelection(false);
            setShowFactionSelection(false);
        }
    }, [G.sys.interaction, myPlayerId]);
    
    const getTotalSignets = (player: any) => {
        return player.playedCards.reduce((sum: number, card: any) => sum + card.signets, 0);
    };
    const mySignets = getTotalSignets(myPlayer);
    const opponentSignets = getTotalSignets(opponent);
    
    const isAbilityPhase = phase === 'ability';
    
    // 能力阶段时，从 playedCards 中获取当前遭遇的卡牌
    // （currentCard 在遭遇解析后被清空）
    const myCurrentCard = isAbilityPhase 
        ? myPlayer.playedCards.find(card => card.encounterIndex === core.turnNumber)
        : myPlayer.currentCard;
    
    const canActivateAbility = isAbilityPhase && core.currentEncounter?.loserId === myPlayerId;
    
    const handlePlayCard = (cardUid: string) => {
        if (phase !== 'play') {
            console.log('[Cardia] handlePlayCard blocked: not in play phase', { phase });
            return;
        }
        if (myPlayer.hasPlayed) {
            console.log('[Cardia] handlePlayCard blocked: already played');
            return;
        }
        console.log('[Cardia] Dispatching PLAY_CARD', { cardUid });
        dispatch(CARDIA_COMMANDS.PLAY_CARD, { cardUid });
    };
    
    const handleActivateAbility = () => {
        if (!canActivateAbility || !myCurrentCard) return;
        const abilityId = myCurrentCard.abilityIds[0];
        if (!abilityId) return;
        dispatch(CARDIA_COMMANDS.ACTIVATE_ABILITY, {
            abilityId,
            sourceCardUid: myCurrentCard.uid,
        });
    };
    
    const handleSkipAbility = () => {
        if (!canActivateAbility) return;
        dispatch(CARDIA_COMMANDS.SKIP_ABILITY, {});
    };
    
    // 处理卡牌选择确认
    const handleCardSelectionConfirm = (selectedCardUids: string[]) => {
        if (!currentInteraction) {
            console.error('[Cardia] handleCardSelectionConfirm: no current interaction');
            return;
        }
        
        // 找到对应的选项
        const data = currentInteraction.data as any;
        const selectedCard = data.cards?.find((c: any) => c.uid === selectedCardUids[0]);
        
        console.log('[Cardia] handleCardSelectionConfirm:', {
            selectedCardUids,
            selectedCard,
            hasOptionId: !!selectedCard?.optionId,
            interactionId: currentInteraction.id,
        });
        
        if (selectedCard && selectedCard.optionId) {
            // 使用标准的交互响应命令
            console.log('[Cardia] Dispatching INTERACTION_COMMANDS.RESPOND with optionId:', selectedCard.optionId);
            dispatch(INTERACTION_COMMANDS.RESPOND, { optionId: selectedCard.optionId });
        } else {
            console.error('[Cardia] No optionId found for selected card');
        }
        
        setShowCardSelection(false);
    };
    
    // 处理卡牌选择取消
    const handleCardSelectionCancel = () => {
        setShowCardSelection(false);
        // 可选：dispatch SKIP_ABILITY 或其他取消命令
    };
    
    // 处理派系选择确认
    const handleFactionSelectionConfirm = (factionId: FactionId) => {
        if (!currentInteraction) return;
        dispatch(CARDIA_COMMANDS.CHOOSE_FACTION, {
            interactionId: currentInteraction.id,
            factionId,
        });
        setShowFactionSelection(false);
    };
    
    // 处理派系选择取消
    const handleFactionSelectionCancel = () => {
        setShowFactionSelection(false);
        // 可选：dispatch SKIP_ABILITY 或其他取消命令
    };
    
    return (
        <UndoProvider value={{ G, dispatch, playerID, isGameOver: !!isGameOver, isLocalMode: isLocalMatch }}>
            <div className="relative w-full h-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden">
                <div className="relative w-full h-full flex flex-col p-4 gap-4">
                    {/* 对手信息栏（顶部） */}
                    <div className="flex-shrink-0">
                        <PlayerInfoBar
                            player={opponent}
                            isOpponent={true}
                            totalSignets={opponentSignets}
                        />
                    </div>
                    
                    {/* 中央战场区域 - 遭遇序列 */}
                    <div data-testid="cardia-battlefield" className="flex-1 flex items-center justify-center overflow-x-auto px-4">
                        <EncounterSequence
                            myPlayer={myPlayer}
                            opponent={opponent}
                            myPlayerId={myPlayerId}
                            opponentId={opponentId}
                            core={core}
                            setCardRef={setCardRef}
                        />
                    </div>
                    
                    {/* 我的区域 */}
                    <div className="flex-shrink-0">
                        <PlayerArea
                            player={myPlayer}
                            core={core}
                            onPlayCard={handlePlayCard}
                            canPlay={phase === 'play' && !myPlayer.hasPlayed}
                            totalSignets={mySignets}
                            setCardRef={setCardRef}
                        />
                    </div>
                    
                    {/* 阶段指示器和操作按钮 */}
                    <div className="absolute top-4 right-4 flex flex-col gap-2">
                        <div data-testid="cardia-phase-indicator" className="bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2 text-white">
                            <div className="text-xs text-gray-400">{t('phase')}</div>
                            <div className="text-lg font-bold">{t(`phases.${phase}`)}</div>
                        </div>
                        
                        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2 text-white">
                            <div className="text-xs text-gray-400">{t('turn')}</div>
                            <div data-testid="cardia-turn-number" className="text-lg font-bold">{core.turnNumber}</div>
                        </div>
                    </div>
                    
                    {/* 能力按钮（居中显示） */}
                    {canActivateAbility && (
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
                            {myCurrentCard && myCurrentCard.abilityIds[0] ? (
                                <AbilityButton
                                    abilityId={myCurrentCard.abilityIds[0]}
                                    onActivate={handleActivateAbility}
                                    onSkip={handleSkipAbility}
                                />
                            ) : (
                                // 没有能力时，只显示跳过按钮
                                <button
                                    data-testid="cardia-skip-ability-btn"
                                    onClick={handleSkipAbility}
                                    className="bg-gray-600 hover:bg-gray-700 text-white font-bold px-8 py-4 rounded-lg shadow-lg transition-colors text-xl"
                                >
                                    {t('skip')}
                                </button>
                            )}
                        </div>
                    )}
                    
                    {/* 结束回合按钮（结束阶段显示） */}
                    {phase === 'end' && core.currentPlayerId === myPlayerId && (
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
                            <button
                                data-testid="cardia-end-turn-btn"
                                onClick={() => dispatch(CARDIA_COMMANDS.END_TURN, {})}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-4 rounded-lg shadow-lg transition-colors text-xl"
                            >
                                {t('endTurn')}
                            </button>
                        </div>
                    )}
                </div>
                
                {/* 卡牌选择弹窗 */}
                {showCardSelection && currentInteraction && (
                    <CardSelectionModal
                        title={(currentInteraction.data as any).title || t('selectOneCard')}
                        cards={(currentInteraction.data as any).cards || []}
                        minSelect={(currentInteraction.data as any).minSelect || 1}
                        maxSelect={(currentInteraction.data as any).maxSelect || 1}
                        onConfirm={handleCardSelectionConfirm}
                        onCancel={handleCardSelectionCancel}
                    />
                )}
                
                {/* 派系选择弹窗 */}
                {showFactionSelection && currentInteraction && (
                    <FactionSelectionModal
                        title={(currentInteraction.data as any).title || t('selectFaction')}
                        onConfirm={handleFactionSelectionConfirm}
                        onCancel={handleFactionSelectionCancel}
                    />
                )}
                
                {isGameOver && <EndgameOverlay {...endgameProps} />}
                <GameDebugPanel G={G} dispatch={dispatch} playerID={myPlayerId} />
                
                {/* 动画层 */}
                <AbilityAnimationsLayer
                    state={animations.state}
                    onAbilityFlashComplete={animations.clearAbilityFlash}
                    onModifierTokenComplete={animations.removeModifierToken}
                    onOngoingMarkerComplete={animations.removeOngoingMarker}
                    onSignetMoveComplete={animations.removeSignetMove}
                />
            </div>
        </UndoProvider>
    );
};

/**
 * 玩家信息栏组件（简化版，不显示手牌）
 */
interface PlayerInfoBarProps {
    player: any;
    isOpponent: boolean;
    totalSignets: number;
}

const PlayerInfoBar: React.FC<PlayerInfoBarProps> = ({ player, totalSignets }) => {
    const { t } = useTranslation('game-cardia');
    
    return (
        <div className="bg-black/30 backdrop-blur-sm rounded-lg px-4 py-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="text-white font-bold">{player.name}</div>
                    <div data-testid="cardia-signet-display" className="text-sm text-yellow-400">
                        🏆 {t('signets')}: {totalSignets}
                    </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                    <div>✋ {t('hand')}: {player.hand.length}</div>
                    <div>📚 {t('deck')}: {player.deck.length}</div>
                    <div>🗑️ {t('discard')}: {player.discard.length}</div>
                </div>
            </div>
        </div>
    );
};

/**
 * 遭遇序列组件（参考图片设计）
 */
interface EncounterSequenceProps {
    myPlayer: any;
    opponent: any;
    myPlayerId: string;
    opponentId: string;
    core: CardiaCore;
    setCardRef: (cardUid: string, element: HTMLElement | null) => void;
}

const EncounterSequence: React.FC<EncounterSequenceProps> = ({ myPlayer, opponent, myPlayerId, opponentId, core, setCardRef }) => {
    const { t } = useTranslation('game-cardia');
    
    // 合并双方的场上卡牌，按遭遇序号排序
    const encounters: Array<{
        encounterIndex: number;
        myCard?: PlayedCard;
        opponentCard?: PlayedCard;
    }> = [];
    
    // 收集所有遭遇序号
    const allEncounterIndices = new Set<number>();
    myPlayer.playedCards.forEach((card: PlayedCard) => allEncounterIndices.add(card.encounterIndex));
    opponent.playedCards.forEach((card: PlayedCard) => allEncounterIndices.add(card.encounterIndex));
    
    // 构建遭遇对
    Array.from(allEncounterIndices).sort((a, b) => a - b).forEach(index => {
        const myCard = myPlayer.playedCards.find((c: PlayedCard) => c.encounterIndex === index);
        const opponentCard = opponent.playedCards.find((c: PlayedCard) => c.encounterIndex === index);
        encounters.push({ encounterIndex: index, myCard, opponentCard });
    });
    
    // 添加当前遭遇（如果有）
    if (myPlayer.currentCard || opponent.currentCard) {
        encounters.push({
            encounterIndex: core.turnNumber,
            myCard: myPlayer.currentCard,
            opponentCard: opponent.currentCard,
        });
    }
    
    if (encounters.length === 0) {
        return (
            <div className="text-gray-400 text-center">
                <div className="text-2xl mb-2">⚔️</div>
                <div>{t('waiting')}</div>
            </div>
        );
    }
    
    return (
        <div className="flex gap-6 items-center">
            {encounters.map((encounter, idx) => (
                <EncounterPair
                    key={encounter.encounterIndex}
                    encounter={encounter}
                    isLatest={idx === encounters.length - 1}
                    myPlayerId={myPlayerId}
                    opponentId={opponentId}
                    core={core}
                    setCardRef={setCardRef}
                />
            ))}
        </div>
    );
};

/**
 * 单个遭遇对组件
 */
interface EncounterPairProps {
    encounter: {
        encounterIndex: number;
        myCard?: any;
        opponentCard?: any;
    };
    isLatest: boolean;
    myPlayerId: string;
    opponentId: string;
    core: CardiaCore;
    setCardRef: (cardUid: string, element: HTMLElement | null) => void;
}

const EncounterPair: React.FC<EncounterPairProps> = ({ encounter, isLatest, myPlayerId, opponentId, core, setCardRef }) => {
    const { t } = useTranslation('game-cardia');
    const { myCard, opponentCard } = encounter;
    
    // 判断是否已翻开
    const myPlayer = core.players[myPlayerId];
    const opponent = core.players[opponentId];
    const myRevealed = isLatest ? myPlayer.cardRevealed : true;
    const opponentRevealed = isLatest ? opponent.cardRevealed : true;
    
    return (
        <div className="flex flex-col items-center gap-2">
            {/* 对手卡牌 */}
            <div>
                {opponentCard ? (
                    opponentRevealed ? (
                        <CardDisplay 
                            card={opponentCard} 
                            core={core}
                            size="normal"
                            onRef={(el) => setCardRef(opponentCard.uid, el)}
                        />
                    ) : (
                        <CardBack />
                    )
                ) : (
                    <EmptySlot />
                )}
            </div>
            
            {/* VS 指示器 */}
            <div className="flex flex-col items-center">
                <div className="text-2xl font-bold text-purple-400">VS</div>
                {isLatest && core.currentEncounter && (
                    <div className="text-xs text-gray-400">
                        {core.currentEncounter.player1Influence} : {core.currentEncounter.player2Influence}
                    </div>
                )}
            </div>
            
            {/* 我的卡牌 */}
            <div>
                {myCard ? (
                    myRevealed ? (
                        <CardDisplay 
                            card={myCard} 
                            core={core}
                            size="normal"
                            onRef={(el) => setCardRef(myCard.uid, el)}
                        />
                    ) : (
                        <CardBack />
                    )
                ) : (
                    <EmptySlot />
                )}
            </div>
        </div>
    );
};

/**
 * 玩家手牌区域组件
 */
interface PlayerAreaProps {
    player: any;
    core: CardiaCore;
    onPlayCard: (cardUid: string) => void;
    canPlay: boolean;
    totalSignets: number;
    setCardRef: (cardUid: string, element: HTMLElement | null) => void;
}

const PlayerArea: React.FC<PlayerAreaProps> = ({ player, core, onPlayCard, canPlay, totalSignets, setCardRef }) => {
    const { t } = useTranslation('game-cardia');
    
    return (
        <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                    <div className="text-white font-bold">{player.name}</div>
                    <div data-testid="cardia-signet-display" className="text-sm text-yellow-400">
                        🏆 {t('signets')}: {totalSignets}
                    </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                    <div>✋ {t('hand')}: {player.hand.length}</div>
                    <div>📚 {t('deck')}: {player.deck.length}</div>
                    <div>🗑️ {t('discard')}: {player.discard.length}</div>
                </div>
            </div>
            
            {/* 手牌区 */}
            <div data-testid="cardia-hand-area" className="flex gap-2 overflow-x-auto">
                {player.hand.map((card: any) => (
                    <button
                        key={card.uid}
                        data-testid={`card-${card.uid}`}
                        onClick={() => onPlayCard(card.uid)}
                        disabled={!canPlay}
                        className={`flex-shrink-0 ${canPlay ? 'hover:scale-105 cursor-pointer' : 'opacity-50 cursor-not-allowed'} transition-transform`}
                    >
                        <CardDisplay 
                            card={card} 
                            core={core}
                            size="normal"
                            onRef={(el) => setCardRef(card.uid, el)}
                        />
                    </button>
                ))}
            </div>
        </div>
    );
};

/**
 * 卡牌展示组件
 */
interface CardDisplayProps {
    card: any;
    core: CardiaCore;
    size?: 'normal' | 'small';
    onRef?: (element: HTMLElement | null) => void;
}

const CardDisplay: React.FC<CardDisplayProps> = ({ card, core, size = 'normal', onRef }) => {
    const { t } = useTranslation('game-cardia');
    const [imageError, setImageError] = React.useState(false);
    
    const factionColors = {
        swamp: 'from-green-700 to-green-900',
        academy: 'from-yellow-700 to-yellow-900',
        guild: 'from-red-700 to-red-900',
        dynasty: 'from-blue-700 to-blue-900',
    };
    
    const bgColor = factionColors[card.faction as keyof typeof factionColors] || 'from-gray-700 to-gray-900';
    const imagePath = card.imagePath || (card.imageIndex ? `cardia/cards/${card.imageIndex}.jpg` : undefined);
    
    const sizeClasses = size === 'small' ? 'w-24 h-36' : 'w-32 h-48';
    
    // 计算修正标记总和（从 core.modifierTokens 中过滤）
    const modifierTotal = core.modifierTokens
        .filter(token => token.cardId === card.uid)
        .reduce((sum, token) => sum + token.value, 0);
    
    // 计算当前影响力（基础影响力 + 修正标记）
    const displayInfluence = card.baseInfluence + modifierTotal;
    
    return (
        <div 
            ref={onRef}
            data-testid={`card-${card.uid}`}
            className={`relative ${sizeClasses} rounded-lg border-2 border-white/20 shadow-lg overflow-hidden`}
        >
            {imagePath && !imageError ? (
                <OptimizedImage
                    src={imagePath}
                    alt={t(card.defId)}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={() => setImageError(true)}
                />
            ) : (
                <div className={`absolute inset-0 bg-gradient-to-br ${bgColor}`} />
            )}
            
            {/* 影响力显示（左上角） */}
            <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm rounded-full w-10 h-10 flex items-center justify-center">
                <span className="text-white font-bold text-sm">{displayInfluence}</span>
            </div>
            
            {/* 修正标记显示（右上角） */}
            {modifierTotal !== 0 && (
                <div className={`absolute top-2 right-2 ${
                    modifierTotal > 0 ? 'bg-green-500' : 'bg-red-500'
                } text-white font-bold text-xs px-2 py-1 rounded-full shadow-lg`}>
                    {modifierTotal > 0 ? '+' : ''}{modifierTotal}
                </div>
            )}
            
            {/* 持续能力标记（右上角，如果没有修正标记则显示在这里） */}
            {card.ongoingMarkers && card.ongoingMarkers.length > 0 && (
                <div className={`absolute ${modifierTotal !== 0 ? 'top-12' : 'top-2'} right-2 bg-purple-500 text-white text-xs px-2 py-1 rounded-full shadow-lg flex items-center gap-1`}>
                    <span>🔄</span>
                    {card.ongoingMarkers.length > 1 && (
                        <span className="font-bold">×{card.ongoingMarkers.length}</span>
                    )}
                </div>
            )}
            
            {/* 印戒标记（底部） */}
            {card.signets > 0 && (
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                    {Array.from({ length: card.signets }).map((_, i) => (
                        <div key={i} className="w-4 h-4 bg-yellow-400 rounded-full border border-yellow-600 shadow" />
                    ))}
                </div>
            )}
        </div>
    );
};

/**
 * 卡背组件
 */
const CardBack: React.FC = () => {
    return (
        <div className="w-32 h-48 bg-gradient-to-br from-purple-800 to-blue-800 rounded-lg border-2 border-purple-600 flex items-center justify-center shadow-lg">
            <div className="text-6xl">🎴</div>
        </div>
    );
};

/**
 * 空槽位组件
 */
const EmptySlot: React.FC = () => {
    return (
        <div className="w-32 h-48 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center text-gray-500">
            <div className="text-xs">等待中...</div>
        </div>
    );
};

// 默认导出（用于客户端清单）
export default CardiaBoard;
