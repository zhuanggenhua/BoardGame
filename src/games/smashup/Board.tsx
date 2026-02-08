/**
 * 大杀四方 (Smash Up) - "Paper Chaos" Aesthetic
 * 
 * Style Guide:
 * - Theme: "Basement Board Game Night" / American Comic Spoof
 * - Background: Warm wooden table surface, cluttered but cozy.
 * - Cards: Physical objects with white printed borders, slight imperfections (rotations).
 * - UI: "Sticky notes", "Scrap paper", "Tokens" - nothing digital.
 * - Font: Thick, bold, informal.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import type { MatchState } from '../../engine/types';
import type { SmashUpCore, BaseInPlay, CardInstance, MinionOnBase } from './domain/types';
import { SU_COMMANDS, HAND_LIMIT, getCurrentPlayerId, getTotalPowerOnBase } from './domain/types';
import { getBaseDef, getMinionDef, getCardDef } from './data/cards';
import type { ActionCardDef } from './domain/types';
import { CardPreview, registerCardAtlasSource } from '../../components/common/media/CardPreview';
import { AnimatePresence, motion } from 'framer-motion';
import { loadCardAtlasConfig } from './ui/cardAtlas';
import { SMASHUP_ATLAS_IDS } from './domain/ids';
import { HandArea } from './ui/HandArea';
import { useGameEvents } from './ui/useGameEvents';
import { SmashUpEffectsLayer } from './ui/BoardEffects';
import { FactionSelection } from './ui/FactionSelection';
import { PromptOverlay } from './ui/PromptOverlay';
import { getFactionMeta } from './ui/factionMeta';
import { DeckDiscardZone } from './ui/DeckDiscardZone';

type Props = BoardProps<MatchState<SmashUpCore>>;

const getPhaseNameKey = (phase: string) => `phases.${phase}`;

// Player "Chips" Colors - Bright, opaque, acrylic feel
const PLAYER_CONFIG = [
    {
        border: 'border-red-600',
        ring: 'ring-red-500',
        shadow: 'shadow-red-500/50',
        bg: 'bg-red-500'
    },
    {
        border: 'border-blue-600',
        ring: 'ring-blue-500',
        shadow: 'shadow-blue-500/50',
        bg: 'bg-blue-500'
    },
    {
        border: 'border-green-600',
        ring: 'ring-green-500',
        shadow: 'shadow-green-500/50',
        bg: 'bg-green-500'
    },
    {
        border: 'border-yellow-600',
        ring: 'ring-yellow-500',
        shadow: 'shadow-yellow-500/50',
        bg: 'bg-yellow-500'
    },
];

const SmashUpBoard: React.FC<Props> = ({ G, moves, playerID }) => {
    const { t } = useTranslation('game-smashup');
    const core = G.core;
    const phase = G.sys.phase;
    const currentPid = getCurrentPlayerId(core);
    const isMyTurn = playerID === currentPid;
    const myPlayer = playerID ? core.players[playerID] : undefined;

    const [selectedCardUid, setSelectedCardUid] = useState<string | null>(null);
    const [discardSelection, setDiscardSelection] = useState<Set<string>>(new Set());
    const autoAdvancePhaseRef = useRef<string | null>(null);
    const needDiscard = isMyTurn && phase === 'draw' && myPlayer && myPlayer.hand.length > HAND_LIMIT;
    const discardCount = needDiscard ? myPlayer!.hand.length - HAND_LIMIT : 0;

    // 事件流消费 → 动画驱动
    const myPid = playerID || '0';
    const gameEvents = useGameEvents({ G, myPlayerId: myPid });

    // 基地 DOM 引用（用于力量浮字定位）
    const baseRefsMap = useRef<Map<number, HTMLElement>>(new Map());

    // 回合切换提示
    const [showTurnNotice, setShowTurnNotice] = useState(false);
    const prevCurrentPidRef = useRef(currentPid);
    useEffect(() => {
        if (prevCurrentPidRef.current !== currentPid) {
            prevCurrentPidRef.current = currentPid;
            if (currentPid === playerID) {
                setShowTurnNotice(true);
                const timer = setTimeout(() => setShowTurnNotice(false), 1500);
                return () => clearTimeout(timer);
            }
        }
    }, [currentPid, playerID]);

    // --- State Management ---
    useEffect(() => {
        if (isMyTurn && phase === 'draw' && myPlayer && myPlayer.hand.length <= HAND_LIMIT) {
            moves['ADVANCE_PHASE']?.();
        }
    }, [isMyTurn, phase, myPlayer?.hand.length]);

    useEffect(() => {
        if (!isMyTurn) {
            autoAdvancePhaseRef.current = null;
            return;
        }
        const shouldAutoAdvance = phase === 'startTurn' || phase === 'scoreBases' || phase === 'endTurn';
        if (!shouldAutoAdvance) {
            autoAdvancePhaseRef.current = null;
            return;
        }
        if (autoAdvancePhaseRef.current === phase) return;
        autoAdvancePhaseRef.current = phase;
        moves['ADVANCE_PHASE']?.();
    }, [isMyTurn, phase, moves]);

    useEffect(() => {
        setSelectedCardUid(null);
        setDiscardSelection(new Set());
    }, [phase, currentPid]);

    useEffect(() => {
        const load = async (id: string, path: string, defaultGrid?: { rows: number; cols: number }) => {
            try {
                const config = await loadCardAtlasConfig(path, undefined, defaultGrid);
                registerCardAtlasSource(id, { image: path, config });
            } catch (e) {
                console.error(`Atlas load failed: ${id}`, e);
            }
        };
        // 基地图集：横向 4 列
        load(SMASHUP_ATLAS_IDS.BASE1, 'smashup/base/base1', { rows: 4, cols: 4 });
        load(SMASHUP_ATLAS_IDS.BASE2, 'smashup/base/base2', { rows: 2, cols: 4 });
        load(SMASHUP_ATLAS_IDS.BASE3, 'smashup/base/base3', { rows: 2, cols: 4 });
        load(SMASHUP_ATLAS_IDS.BASE4, 'smashup/base/base4', { rows: 3, cols: 4 });
        // 卡牌图集
        load(SMASHUP_ATLAS_IDS.CARDS1, 'smashup/cards/cards1', { rows: 7, cols: 8 });
        load(SMASHUP_ATLAS_IDS.CARDS2, 'smashup/cards/cards2', { rows: 7, cols: 8 });
        load(SMASHUP_ATLAS_IDS.CARDS3, 'smashup/cards/cards3', { rows: 7, cols: 8 });
        load(SMASHUP_ATLAS_IDS.CARDS4, 'smashup/cards/cards4', { rows: 7, cols: 8 });
    }, []);

    // --- Handlers ---
    const handlePlayMinion = useCallback((cardUid: string, baseIndex: number) => {
        moves[SU_COMMANDS.PLAY_MINION]?.({ cardUid, baseIndex });
        setSelectedCardUid(null);
    }, [moves]);

    // VIEWING STATE
    const [viewingCard, setViewingCard] = useState<{ defId: string; type: 'minion' | 'base' | 'action' } | null>(null);

    const handleBaseClick = useCallback((index: number) => {
        const base = core.bases[index];
        if (selectedCardUid) {
            handlePlayMinion(selectedCardUid, index);
        } else {
            setViewingCard({ defId: base.defId, type: 'base' });
        }
    }, [selectedCardUid, handlePlayMinion, core.bases]);

    const handleCardClick = useCallback((card: CardInstance) => {
        // Validation for play phase / turn
        if (!isMyTurn || phase !== 'playCards') {
            toast(t('ui.invalid_play'), { icon: '🚫' });
            return;
        }

        // Normal play logic
        if (card.type === 'action') {
            moves[SU_COMMANDS.PLAY_ACTION]?.({ cardUid: card.uid });
        } else {
            setSelectedCardUid(curr => curr === card.uid ? null : card.uid);
        }
    }, [isMyTurn, phase, moves]);

    const handleViewCardDetail = useCallback((card: CardInstance) => {
        setViewingCard({ defId: card.defId, type: card.type === 'minion' ? 'minion' : 'action' });
    }, []);

    const handleViewAction = useCallback((defId: string) => {
        setViewingCard({ defId, type: 'action' });
    }, []);

    // EARLY RETURN: Faction Selection
    if (phase === 'factionSelect') {
        return (
            <div className="relative w-full h-screen bg-[#3e2723] overflow-hidden font-sans select-none">
                <div className="absolute inset-0 z-0 pointer-events-none opacity-40 mix-blend-multiply">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]" />
                </div>
                <FactionSelection core={core} moves={moves} playerID={playerID} />
            </div>
        );
    }

    return (
        // BACKGROUND: A warm, dark wooden table texture. 
        <div className="relative w-full h-screen bg-[#3e2723] overflow-hidden font-sans select-none">

            {/* Table Texture Layer */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-40 mix-blend-multiply">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]" />
            </div>
            {/* Vignette for focus */}
            <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]" />

            {/* --- TOP HUD: "Sticky Notes" Style --- */}
            <div className="relative z-20 flex justify-between items-start pt-6 px-[2vw] pointer-events-none">

                {/* Left: Turn Tracker (Yellow Notepad) */}
                <div className="bg-[#fef3c7] text-slate-800 p-3 pt-4 shadow-[2px_3px_5px_rgba(0,0,0,0.2)] -rotate-1 pointer-events-auto min-w-[140px] clip-path-jagged">
                    <div className="w-3 h-3 rounded-full bg-red-400 absolute top-1 left-1/2 -translate-x-1/2 opacity-50 shadow-inner" /> {/* Pin */}
                    <motion.div
                        key={`turn-${core.turnNumber}`}
                        initial={{ scale: 0.9, rotate: -3 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        className="text-center font-black uppercase text-xl leading-none tracking-tighter mb-1 border-b-2 border-slate-800/20 pb-1"
                    >
                        {t('ui.turn')} {core.turnNumber}
                    </motion.div>
                    <div className="flex justify-between items-center text-sm font-bold font-mono">
                        <span>{isMyTurn ? t('ui.you') : t('ui.opp')}</span>
                        <motion.span
                            key={phase}
                            initial={{ scale: 0.7, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                            className="text-blue-600 bg-blue-100 px-1 rounded transform rotate-2 inline-block"
                        >
                            {t(getPhaseNameKey(phase))}
                        </motion.span>
                    </div>
                </div>

                {/* Right: Score Sheet + Player Info */}
                <div className="bg-white text-slate-900 p-4 shadow-[3px_4px_10px_rgba(0,0,0,0.3)] rotate-1 max-w-[500px] pointer-events-auto rounded-sm">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center mb-2 border-b border-slate-200">{t('ui.score_sheet')}</div>
                    <div className="flex gap-5">
                        {core.turnOrder.map(pid => {
                            const conf = PLAYER_CONFIG[parseInt(pid) % PLAYER_CONFIG.length];
                            const isCurrent = pid === currentPid;
                            const player = core.players[pid];
                            const isMe = pid === playerID;
                            // 派系图标
                            const factionIcons = player.factions
                                .map(fid => getFactionMeta(fid))
                                .filter(Boolean);
                            return (
                                <motion.div
                                    key={pid}
                                    className={`flex flex-col items-center relative ${isCurrent ? 'scale-110' : 'opacity-60 grayscale'}`}
                                    animate={isCurrent ? { scale: 1.1 } : { scale: 1 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                >
                                    <span className="text-xs font-black uppercase mb-1">{isMe ? 'YOU' : `P${pid}`}</span>
                                    <motion.div
                                        key={`vp-${pid}-${player.vp}`}
                                        className={`w-10 h-10 rounded-full flex items-center justify-center text-xl font-black text-white shadow-md border-2 border-white ${conf.bg}`}
                                        initial={{ scale: 1 }}
                                        animate={{ scale: [1, 1.3, 1] }}
                                        transition={{ duration: 0.4, ease: 'easeOut' }}
                                    >
                                        {player.vp}
                                    </motion.div>
                                    {/* 派系图标 */}
                                    <div className="flex gap-0.5 mt-1">
                                        {factionIcons.map(meta => (
                                            <span key={meta!.id} className="text-sm" title={meta!.name}>{meta!.icon}</span>
                                        ))}
                                    </div>
                                    {/* 自己的牌库/弃牌信息已移至下方 DeckDiscardZone */}
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* --- FINISH TURN BUTTON: Fixed Position (Right Edge) --- */}
            <div className="fixed right-[8vw] bottom-[35vh] z-50 flex pointer-events-none">
                <AnimatePresence>
                    {isMyTurn && phase === 'playCards' && (
                        <motion.div
                            initial={{ y: 100, opacity: 0, scale: 0.5 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: 100, opacity: 0, scale: 0.5 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                            className="pointer-events-auto"
                        >
                            <button
                                onClick={() => moves['ADVANCE_PHASE']?.()}
                                className="group w-24 h-24 rounded-full bg-slate-900 border-4 border-white shadow-[0_10px_20px_rgba(0,0,0,0.4)] flex flex-col items-center justify-center hover:scale-110 hover:rotate-3 transition-all active:scale-95 text-white relative overflow-hidden"
                            >
                                <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/pinstriped-suit.png')]" />

                                {t('ui.finish_turn').includes(' ') ? (
                                    <>
                                        <span className="text-[10px] font-bold opacity-70 uppercase tracking-tighter leading-tight">
                                            {t('ui.finish_turn').split(' ')[0]}
                                        </span>
                                        <span className="text-lg font-black uppercase italic leading-none">
                                            {t('ui.finish_turn').split(' ')[1]}
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-lg font-black uppercase italic leading-none tracking-tighter">
                                        {t('ui.finish_turn')}
                                    </span>
                                )}

                                <div className="absolute -inset-1 bg-white/5 blur-xl group-hover:bg-white/10 transition-colors" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* --- MAIN BOARD --- */}
            {/* Scrollable table area */}
            <div className="absolute inset-0 flex items-center justify-center overflow-x-auto overflow-y-hidden z-10 no-scrollbar pt-12 pb-60">
                <div className="flex items-start gap-12 px-20 min-w-max">
                    {core.bases.map((base, idx) => (
                        <BaseZone
                            key={`${base.defId}-${idx}`}
                            base={base}
                            baseIndex={idx}
                            turnOrder={core.turnOrder}
                            isDeployMode={!!selectedCardUid}
                            isMyTurn={isMyTurn}
                            myPlayerId={playerID}
                            moves={moves}
                            onClick={() => handleBaseClick(idx)}
                            onViewMinion={(defId) => setViewingCard({ defId, type: 'minion' })}
                            onViewAction={handleViewAction}
                            tokenRef={(el) => {
                                if (el) baseRefsMap.current.set(idx, el);
                                else baseRefsMap.current.delete(idx);
                            }}
                        />

                    ))}
                </div>
            </div>

            {/* --- BOTTOM: HAND & CONTROLS --- */}
            {/* Not a bar, but floating elements */}
            {
                myPlayer && (
                    <div className="absolute bottom-0 inset-x-0 h-[220px] z-30 pointer-events-none">

                        {/* Discard Overlay (Messy Pile) */}
                        {needDiscard && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center pointer-events-auto">
                                <div className="bg-white p-6 rotate-1 shadow-2xl max-w-md text-center border-4 border-red-500 border-dashed">
                                    <h2 className="text-2xl font-black text-red-600 uppercase mb-2 transform -rotate-1">{t('ui.too_many_cards')}</h2>
                                    <p className="font-bold text-slate-700 mb-4">{t('ui.discard_desc', { count: discardCount })}</p>
                                    <button
                                        onClick={() => {
                                            if (discardSelection.size === discardCount) {
                                                moves[SU_COMMANDS.DISCARD_TO_LIMIT]?.({ cardUids: Array.from(discardSelection) });
                                                setDiscardSelection(new Set());
                                            }
                                        }}
                                        disabled={discardSelection.size !== discardCount}
                                        className="bg-slate-800 text-white font-black px-6 py-3 rounded shadow-lg hover:bg-black hover:scale-105 transition-all uppercase tracking-widest disabled:opacity-50"
                                    >
                                        {t('ui.throw_away')}
                                    </button>
                                </div>
                            </div>
                        )}

                        <HandArea
                            hand={myPlayer.hand}
                            selectedCardUid={selectedCardUid}
                            onCardSelect={handleCardClick}
                            isDiscardMode={needDiscard}
                            discardSelection={discardSelection}
                            // If not my turn, hand is "put down" (lower opacity or stylized)
                            // Even if not my turn, interaction is enabled for viewing. 
                            // Visual feedback (shaking) is handled inside HandArea if we wanted to block it, 
                            // but now we handle the click in the parent to show details.
                            disableInteraction={false}
                            onCardView={handleViewCardDetail}
                        />



                        {/* NEW: Deck & Discard Zone */}
                        <DeckDiscardZone
                            deckCount={myPlayer.deck.length}
                            discard={myPlayer.discard}
                            myPlayerId={playerID || ''}
                            isMyTurn={isMyTurn}
                        />
                    </div>
                )
            }

            {/* 特效层 */}
            <SmashUpEffectsLayer
                powerChanges={gameEvents.powerChanges}
                onPowerChangeComplete={gameEvents.removePowerChange}
                actionShows={gameEvents.actionShows}
                onActionShowComplete={gameEvents.removeActionShow}
                baseScored={gameEvents.baseScored}
                onBaseScoredComplete={gameEvents.removeBaseScored}
                baseRefs={baseRefsMap}
            />

            {/* 回合切换提示 */}
            <AnimatePresence>
                {showTurnNotice && (
                    <motion.div
                        className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <motion.div
                            className="bg-[#fef3c7] text-slate-900 px-8 py-4 shadow-2xl border-4 border-dashed border-slate-800/30"
                            initial={{ scale: 0.5, rotate: -10 }}
                            animate={{ scale: 1, rotate: 2 }}
                            exit={{ scale: 0.5, rotate: 10, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                            style={{ fontFamily: "'Caveat', 'Comic Sans MS', cursive" }}
                        >
                            <span className="text-[3vw] font-black uppercase tracking-tight">{t('ui.your_turn')}</span>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* PREVIEW OVERLAY */}
            <AnimatePresence>
                {viewingCard && (
                    <CardDetailOverlay
                        defId={viewingCard.defId}
                        type={viewingCard.type}
                        onClose={() => setViewingCard(null)}
                    />
                )}
            </AnimatePresence>

            {/* PROMPT OVERLAY */}
            <PromptOverlay
                prompt={core.activePrompt}
                moves={moves}
                playerID={playerID}
            />

            {/* ME FIRST! 响应窗口 */}
            <MeFirstOverlay
                G={G}
                moves={moves}
                playerID={playerID}
            />
        </div >
    );
};

// ============================================================================
// Base Zone: The "Battlefield"
// ============================================================================

const BaseZone: React.FC<{
    base: BaseInPlay;
    baseIndex: number;
    turnOrder: string[];
    isDeployMode: boolean;
    isMyTurn: boolean;
    myPlayerId: string | null;
    moves: Record<string, any>;
    onClick: () => void;
    onViewMinion: (defId: string) => void;
    onViewAction: (defId: string) => void;
    tokenRef?: (el: HTMLDivElement | null) => void;
}> = ({ base, baseIndex, turnOrder, isDeployMode, isMyTurn, myPlayerId, moves, onClick, onViewMinion, onViewAction, tokenRef }) => {
    const baseDef = getBaseDef(base.defId);
    const totalPower = getTotalPowerOnBase(base);
    const breakpoint = baseDef?.breakpoint || 20;
    const ratio = totalPower / breakpoint;
    const isNearBreak = ratio >= 0.8 && ratio < 1;
    const isAtBreak = ratio >= 1;

    // 分组
    const minionsByController: Record<string, MinionOnBase[]> = {};
    base.minions.forEach(m => {
        if (!minionsByController[m.controller]) minionsByController[m.controller] = [];
        minionsByController[m.controller].push(m);
    });

    const actionsByOwner: Record<string, typeof base.ongoingActions> = {};
    base.ongoingActions?.forEach(oa => {
        if (!actionsByOwner[oa.ownerId]) actionsByOwner[oa.ownerId] = [];
        actionsByOwner[oa.ownerId].push(oa);
    });

    return (
        <div className="relative flex flex-col items-center group/base mx-[1vw]">

            {/* --- BASE CARD --- */}
            {/* z-20 ensures it sits on top of the 'tucked' persistent effects */}
            <div
                onClick={onClick}
                className={`
                    relative w-[14vw] aspect-[1.43] bg-white p-[0.4vw] shadow-sm rounded-sm transition-all duration-300 z-20
                    ${isDeployMode
                        ? 'cursor-pointer rotate-0 scale-105 shadow-[0_0_2vw_rgba(255,255,255,0.4)] ring-4 ring-green-400'
                        : 'rotate-1 hover:rotate-0 hover:shadow-xl cursor-zoom-in'}
                `}
                style={{
                    backgroundImage: 'repeating-linear-gradient(45deg, #fff 0px, #fff 2px, #fdfdfd 2px, #fdfdfd 4px)',
                }}
            >
                {/* Inner Art Area */}
                <div className="w-full h-full bg-slate-200 border border-slate-300 overflow-hidden relative">
                    <CardPreview
                        previewRef={baseDef?.previewRef}
                        className="w-full h-full object-cover"
                        title={baseDef?.name}
                    />

                    {/* Fallback Text */}
                    {!baseDef?.previewRef && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-[0.5vw]">
                            <h3 className="font-black text-[1.2vw] text-slate-800 uppercase tracking-tighter rotate-[-2deg] leading-tight mb-[0.5vw]">
                                {baseDef?.name || base.defId}
                            </h3>
                            <div className="bg-white/90 p-[0.3vw] shadow-sm transform rotate-1 border border-slate-200">
                                <p className="font-mono text-[0.6vw] text-slate-700 leading-tight">
                                    {baseDef?.abilityText}
                                </p>
                            </div>
                            <div className="absolute bottom-[0.5vw] right-[0.5vw] font-black text-[1.5vw] text-slate-900/20">
                                {breakpoint}
                            </div>
                        </div>
                    )}
                </div>

                {/* Power Token */}
                <div className="absolute -top-[1.5vw] -right-[1.5vw] w-[4vw] h-[4vw] pointer-events-none z-30 flex items-center justify-center"
                    ref={tokenRef}
                >
                    <motion.div
                        className={`w-[3.5vw] h-[3.5vw] rounded-full flex items-center justify-center border-[0.2vw] border-dashed shadow-xl transform rotate-12 group-hover/base:scale-110 transition-transform ${isAtBreak
                            ? 'bg-green-600 border-green-300'
                            : isNearBreak
                                ? 'bg-amber-600 border-amber-300'
                                : 'bg-slate-900 border-white'
                            }`}
                        animate={
                            isAtBreak
                                ? { scale: [1, 1.15, 1], boxShadow: ['0 0 0px rgba(74,222,128,0)', '0 0 20px rgba(74,222,128,0.6)', '0 0 0px rgba(74,222,128,0)'] }
                                : isNearBreak
                                    ? { scale: [1, 1.06, 1] }
                                    : {}
                        }
                        transition={
                            isAtBreak
                                ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
                                : isNearBreak
                                    ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' }
                                    : {}
                        }
                    >
                        <div className={`text-[1.2vw] font-black ${isAtBreak ? 'text-white' : isNearBreak ? 'text-amber-100' : 'text-white'}`}>
                            {totalPower}
                        </div>
                        <div className="absolute -bottom-[0.5vw] bg-white text-slate-900 text-[0.6vw] font-bold px-[0.4vw] py-[0.1vw] rounded shadow-sm border border-slate-300 whitespace-nowrap">
                            / {breakpoint}
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* --- PLAYER COLUMNS CONTAINER --- */}
            <div className="flex items-start justify-center gap-[0.5vw] w-full pt-[0.5vw]">
                {turnOrder.map(pid => {
                    const minions = minionsByController[pid] || [];
                    const actions = actionsByOwner[pid] || [];

                    // Calc Power
                    const total = minions.reduce((sum, m) => sum + m.basePower + m.powerModifier, 0);
                    const basePowerTotal = minions.reduce((sum, m) => sum + m.basePower, 0);
                    const modifierDelta = total - basePowerTotal;

                    const pConf = PLAYER_CONFIG[parseInt(pid) % PLAYER_CONFIG.length];

                    return (
                        <div key={pid} className="flex flex-col items-center min-w-[5.5vw] relative">

                            {/* --- PERSISTENT EFFECTS (Bucket/Tucked) --- */}
                            {/* 
                                Positioned absolute relative to the top of column? 
                                No, simply rendered before minions with negative margin to tuck under base.
                                Since Base is z-20 and we are z-0 (default), negative margin pulls it under.
                            */}
                            {actions.length > 0 ? (
                                <div className="flex flex-col items-center mb-1 -mt-[2vw] z-0 space-y-[-1.2vw]">
                                    {actions.map((oa) => {
                                        const actionDef = getCardDef(oa.defId);
                                        return (
                                            <motion.div
                                                key={oa.uid}
                                                onClick={() => onViewAction(oa.defId)}
                                                className={`
                                                    relative w-[5vw] h-[2vw] bg-white rounded-t-md shadow-md cursor-pointer border-t-[0.15vw] border-x-[0.15vw] ${pConf.border}
                                                    flex items-center justify-center overflow-hidden hover:z-30 hover:-translate-y-2 transition-transform
                                                `}
                                                initial={{ y: 0, opacity: 0 }}
                                                animate={{ y: 0, opacity: 1 }}
                                            >
                                                {/* Background Strip */}
                                                <div className={`absolute top-0 inset-x-0 h-[0.3vw] ${pConf.bg}`} />
                                                <span className="text-[0.55vw] font-bold uppercase tracking-tight text-slate-700 px-1 truncate mt-1">
                                                    {actionDef?.name || oa.defId}
                                                </span>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            ) : (
                                /* Spacer to prevent layout jump if other columns have effects? 
                                   Actually, we want them tucked, so no spacer needed usually. 
                                   But if we want perfect alignment? 
                                   Let's keep it natural flow.
                                */
                                null
                            )}

                            {/* --- MINIONS --- */}
                            {minions.length > 0 ? (
                                <div className="flex flex-col items-center isolate z-10">
                                    {minions.map((m, i) => (
                                        <MinionCard
                                            key={m.uid}
                                            minion={m}
                                            index={i}
                                            pid={pid}
                                            baseIndex={baseIndex}
                                            isMyTurn={isMyTurn}
                                            myPlayerId={myPlayerId}
                                            moves={moves}
                                            onView={() => onViewMinion(m.defId)}
                                        />
                                    ))}
                                </div>
                            ) : (
                                /* Empty Placeholder for Layout Stability */
                                <div className={`w-[5.5vw] h-[2vw] rounded-sm border md-2 border-dashed border-slate-300/30 ${isDeployMode && isMyTurn ? 'animate-pulse bg-white/5' : ''}`}>
                                    {isDeployMode && isMyTurn && myPlayerId === pid && minions.length === 0 && (
                                        <div className="w-full h-full flex items-center justify-center text-white/50 text-[0.8vw]">+</div>
                                    )}
                                </div>
                            )}

                            {/* --- SCORE (POWER) --- */}
                            <div className="mt-2 flex items-center justify-center gap-1 z-10 bg-slate-900/40 rounded-full px-2 py-0.5 backdrop-blur-sm">
                                <div className={`w-[0.6vw] h-[0.6vw] rounded-full ${pConf.bg}`} />
                                <span className={`text-[0.7vw] font-black leading-none ${modifierDelta > 0 ? 'text-green-300' :
                                    modifierDelta < 0 ? 'text-red-300' :
                                        'text-white'
                                    }`}>
                                    {total}
                                </span>
                            </div>

                        </div>
                    );
                })}
            </div>

        </div>
    );
};

const MinionCard: React.FC<{
    minion: MinionOnBase;
    index: number;
    pid: string;
    baseIndex: number;
    isMyTurn: boolean;
    myPlayerId: string | null;
    moves: Record<string, any>;
    onView: () => void;
}> = ({ minion, index, pid, baseIndex, isMyTurn, myPlayerId, moves, onView }) => {
    const def = getMinionDef(minion.defId);
    const conf = PLAYER_CONFIG[parseInt(pid) % PLAYER_CONFIG.length];

    // 天赋判定：有 talent 标签 + 本回合未使用 + 是我的随从 + 轮到我
    const hasTalent = def?.abilityTags?.includes('talent') ?? false;
    const canUseTalent = hasTalent && !minion.talentUsed && isMyTurn && minion.controller === myPlayerId;

    const seed = minion.uid.charCodeAt(0) + index;
    const rotation = (seed % 6) - 3;

    const style = {
        marginTop: index === 0 ? 0 : '-5.5vw',
        zIndex: index + 1,
        transform: `rotate(${rotation}deg)`,
    };

    const handleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (canUseTalent) {
            moves[SU_COMMANDS.USE_TALENT]?.({ minionUid: minion.uid, baseIndex });
        } else {
            onView();
        }
    }, [canUseTalent, moves, minion.uid, baseIndex, onView]);

    return (
        <motion.div
            onClick={handleClick}
            className={`
                relative w-[5.5vw] aspect-[0.714] bg-white p-[0.2vw] rounded-[0.2vw] 
                transition-shadow duration-200 group hover:z-50 hover:scale-110 hover:rotate-0
                border-[0.15vw] ${conf.border} ${conf.shadow} shadow-md
                ${canUseTalent ? 'cursor-pointer ring-2 ring-amber-400/80 shadow-[0_0_12px_rgba(251,191,36,0.5)]' : 'cursor-zoom-in'}
            `}
            style={style}
            initial={{ scale: 0.3, y: -60, opacity: 0, rotate: -15 }}
            animate={canUseTalent
                ? { scale: 1, y: 0, opacity: 1, rotate: [rotation - 2, rotation + 2, rotation - 2], transition: { rotate: { repeat: Infinity, duration: 1.5, ease: 'easeInOut' } } }
                : { scale: 1, y: 0, opacity: 1, rotate: rotation }
            }
            transition={{ type: 'spring', stiffness: 350, damping: 20, delay: index * 0.05 }}
        >
            <div className="w-full h-full bg-slate-100 relative overflow-hidden">
                <CardPreview
                    previewRef={def?.previewRef}
                    className="w-full h-full object-cover"
                />

                {!def?.previewRef && (
                    <div className="absolute inset-0 p-[0.2vw] flex items-center justify-center text-center bg-slate-50">
                        <p className="text-[0.6vw] font-bold leading-none text-slate-800 line-clamp-4">{def?.name}</p>
                    </div>
                )}

                {/* 天赋可用时的发光叠层 */}
                {canUseTalent && (
                    <motion.div
                        className="absolute inset-0 pointer-events-none z-20 rounded-[0.1vw]"
                        animate={{ opacity: [0.15, 0.35, 0.15] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.6) 0%, transparent 70%)' }}
                    />
                )}
            </div>

            {/* 力量徽章 - 增益绿色/减益红色 */}
            {((minion.powerModifier !== 0) || !def?.previewRef) && (
                <div className={`absolute -top-[0.4vw] -right-[0.4vw] w-[1.2vw] h-[1.2vw] rounded-full flex items-center justify-center text-[0.7vw] font-black text-white shadow-sm border border-white ${minion.powerModifier > 0 ? 'bg-green-600' : (minion.powerModifier < 0 ? 'bg-red-600' : 'bg-slate-700')} z-10`}>
                    {minion.basePower + minion.powerModifier}
                </div>
            )}

            {/* 天赋已使用标记 */}
            {hasTalent && minion.talentUsed && (
                <div className="absolute -bottom-[0.3vw] left-1/2 -translate-x-1/2 bg-slate-600 text-white text-[0.45vw] font-bold px-[0.3vw] py-[0.05vw] rounded-sm shadow-sm border border-white z-10 whitespace-nowrap">
                    已用
                </div>
            )}
        </motion.div>
    );
};

export default SmashUpBoard;

// ============================================================================
// Me First! Response Window Overlay
// ============================================================================
const MeFirstOverlay: React.FC<{
    G: MatchState<SmashUpCore>;
    moves: Record<string, any>;
    playerID: string | null;
}> = ({ G, moves, playerID }) => {
    const { t } = useTranslation('game-smashup');
    const responseWindow = G.sys.responseWindow?.current;

    if (!responseWindow || responseWindow.windowType !== 'meFirst') return null;

    const currentResponderId = responseWindow.responderQueue[responseWindow.currentResponderIndex];
    const isMyResponse = playerID === currentResponderId;
    const core = G.core;

    // 检查手牌中是否有特殊行动卡
    const myPlayer = playerID ? core.players[playerID] : undefined;
    const specialCards = myPlayer?.hand.filter(c => {
        if (c.type !== 'action') return false;
        const def = getCardDef(c.defId) as ActionCardDef | undefined;
        return def?.subtype === 'special';
    }) ?? [];

    const handlePass = useCallback(() => {
        moves['RESPONSE_PASS']?.({});
    }, [moves]);

    const handlePlaySpecial = useCallback((cardUid: string) => {
        moves[SU_COMMANDS.PLAY_ACTION]?.({ cardUid });
    }, [moves]);

    return (
        <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-testid="me-first-overlay"
        >
            <motion.div
                className="bg-[#fef3c7] text-slate-900 p-5 shadow-2xl border-4 border-dashed border-amber-600/50 max-w-md pointer-events-auto -rotate-1"
                initial={{ scale: 0.7, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
                <div className="text-center mb-3">
                    <h3 className="text-xl font-black uppercase tracking-tight text-amber-800 transform rotate-1">
                        ⚡ Me First!
                    </h3>
                    <p className="text-sm font-bold text-slate-600 mt-1" data-testid="me-first-status">
                        {isMyResponse
                            ? t('ui.me_first_your_turn', '轮到你响应 — 打出特殊牌或让过')
                            : t('ui.me_first_waiting', { player: `P${currentResponderId}` })
                        }
                    </p>
                </div>

                {isMyResponse && (
                    <div className="flex flex-col gap-2">
                        {/* 特殊牌列表 */}
                        {specialCards.length > 0 && (
                            <div className="flex flex-wrap gap-2 justify-center mb-2" data-testid="me-first-special-cards">
                                {specialCards.map(card => {
                                    const def = getCardDef(card.defId);
                                    return (
                                        <button
                                            key={card.uid}
                                            onClick={() => handlePlaySpecial(card.uid)}
                                            className="bg-purple-600 text-white px-3 py-2 rounded shadow-md font-bold text-sm hover:bg-purple-700 hover:scale-105 transition-all border-2 border-purple-300"
                                            data-testid={`me-first-card-${card.uid}`}
                                        >
                                            {def?.name || card.defId}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* 让过按钮 */}
                        <button
                            onClick={handlePass}
                            className="bg-slate-700 text-white px-6 py-3 rounded shadow-lg font-black uppercase tracking-wider hover:bg-slate-800 hover:scale-105 transition-all mx-auto"
                            data-testid="me-first-pass-button"
                        >
                            {t('ui.me_first_pass', '让过')}
                        </button>
                    </div>
                )}

                {/* 响应进度 */}
                <div className="flex justify-center gap-2 mt-3">
                    {responseWindow.responderQueue.map((pid, idx) => {
                        const isPassed = responseWindow.passedPlayers.includes(pid);
                        const isCurrent = idx === responseWindow.currentResponderIndex;
                        const conf = PLAYER_CONFIG[parseInt(pid) % PLAYER_CONFIG.length];
                        return (
                            <div
                                key={pid}
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white border-2 ${conf.bg} ${
                                    isCurrent ? 'ring-2 ring-amber-400 scale-125' : isPassed ? 'opacity-40' : ''
                                }`}
                            >
                                {isPassed ? '✓' : pid === playerID ? 'Y' : pid}
                            </div>
                        );
                    })}
                </div>
            </motion.div>
        </motion.div>
    );
};

// ============================================================================
// Overlay: Click-to-View Details
// ============================================================================
const CardDetailOverlay: React.FC<{
    defId: string;
    type: 'minion' | 'base' | 'action';
    onClose: () => void;
}> = ({ defId, type, onClose }) => {
    const def = type === 'base' ? getBaseDef(defId) : getCardDef(defId);
    if (!def) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 cursor-pointer"
        >
            <motion.div
                initial={{ scale: 0.8, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: 50 }}
                className={`
                    relative rounded-xl shadow-2xl bg-transparent
                    ${type === 'base' ? 'w-[40vw] max-w-[600px] aspect-[1.43]' : 'w-[25vw] max-w-[400px] aspect-[0.714]'}
                `}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button Mobile-ish */}
                <button onClick={onClose} className="absolute -top-4 -right-4 bg-white text-black rounded-full w-8 h-8 font-black border-2 border-black z-50 hover:scale-110">X</button>

                <CardPreview
                    previewRef={def.previewRef}
                    className="w-full h-full object-contain rounded-xl shadow-2xl"
                    title={def.name}
                />

                {/* Detail Box if no preview */}
                {!def.previewRef && (
                    <div className="absolute inset-0 bg-white rounded-xl p-6 border-4 border-slate-800 flex flex-col items-center justify-center text-center">
                        <h2 className="text-3xl font-black uppercase mb-4">{def.name}</h2>
                        <p className="font-mono text-lg">{type === 'base' ? (def as any).abilityText : ((def as any).text || (def as any).abilityText || (def as any).effectText)}</p>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
};
