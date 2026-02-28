/**
 * 大杀四方 (Smash Up) - 基地区域 + 随从卡片组件
 */

import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Paperclip } from 'lucide-react';
import type { SmashUpCore, BaseInPlay, MinionOnBase } from '../domain/types';
import { SU_COMMANDS } from '../domain/types';
import { getTotalEffectivePowerOnBase, getEffectivePower, getEffectivePowerBreakdown, getEffectiveBreakpoint, getOngoingCardPowerContribution } from '../domain/ongoingModifiers';
import { getBaseDef, getMinionDef, getCardDef, resolveCardName, resolveCardText } from '../data/cards';
import { isSpecialLimitBlocked } from '../domain/abilityHelpers';
import { getScoringEligibleBaseIndices } from '../domain/ongoingModifiers';
import { getBaseRestrictions } from '../domain/ongoingEffects';
import { FACTION_DISPLAY_NAMES } from '../domain/ids';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { PLAYER_CONFIG } from './playerConfig';
import { UI_Z_INDEX } from '../../../core';

// ============================================================================
// Base Zone: The "Battlefield"
// ============================================================================

export const BaseZone: React.FC<{
    base: BaseInPlay;
    baseIndex: number;
    core: SmashUpCore;
    turnOrder: string[];
    isDeployMode: boolean;
    isMinionSelectMode?: boolean;
    /** 交互驱动的随从选择：只有这些 UID 的随从可被选中 */
    selectableMinionUids?: Set<string>;
    /** 多选随从模式：已选中的随从 UID 集合 */
    multiSelectedMinionUids?: Set<string>;
    /** 基地选择交互模式：该基地可被直接点击选中 */
    isSelectable?: boolean;
    /** 选择模式下该基地不可选（置灰） */
    isDimmed?: boolean;
    /** 交互驱动的持续行动卡选择：只有这些 UID 的行动卡可被选中 */
    selectableOngoingUids?: Set<string>;
    isMyTurn: boolean;
    myPlayerId: string | null;
    dispatch: (type: string, payload?: unknown) => void;
    onClick: () => void;
    onMinionSelect?: (minionUid: string, baseIndex: number) => void;
    onOngoingSelect?: (ongoingUid: string) => void;
    onViewMinion: (defId: string) => void;
    onViewAction: (defId: string) => void;
    onViewBase: (defId: string) => void;
    tokenRef?: (el: HTMLDivElement | null) => void;
    isTutorialTargetAllowed?: (targetId: string) => boolean;
    /** 当前游戏阶段（用于限制 scoreBases 阶段的 special 高亮范围） */
    phase?: string;
}> = ({ base, baseIndex, core, turnOrder, isDeployMode, isMinionSelectMode, selectableMinionUids, multiSelectedMinionUids, isSelectable, isDimmed, selectableOngoingUids, isMyTurn, myPlayerId, dispatch, onClick, onMinionSelect, onOngoingSelect, onViewMinion, onViewAction, onViewBase, tokenRef, isTutorialTargetAllowed, phase }) => {
    const { t } = useTranslation('game-smashup');
    
    const baseDef = getBaseDef(base.defId);
    const baseName = resolveCardName(baseDef, t) || base.defId;
    const baseText = resolveCardText(baseDef, t);
    const totalPower = getTotalEffectivePowerOnBase(core, base, baseIndex);
    const breakpoint = getEffectiveBreakpoint(core, baseIndex);
    const ratio = totalPower / breakpoint;
    const isNearBreak = ratio >= 0.8 && ratio < 1;
    const isAtBreak = ratio >= 1;

    // 获取基地限制信息
    const restrictions = getBaseRestrictions(core, baseIndex);

    // 分组
    const minionsByController: Record<string, MinionOnBase[]> = {};
    base.minions.forEach(m => {
        if (!minionsByController[m.controller]) minionsByController[m.controller] = [];
        minionsByController[m.controller].push(m);
    });


    return (
        <div className="relative flex flex-col items-center group/base mx-[1vw]">

            {/* --- BASE RESTRICTIONS (above ongoing actions) --- */}
            {restrictions.length > 0 && (
                <div className="absolute -top-[8vw] left-1/2 -translate-x-1/2 flex flex-col items-center gap-[0.3vw] z-40">
                    {restrictions.map((restriction, idx) => {
                        if (restriction.type === 'blocked_faction') {
                            const factionDisplayName = FACTION_DISPLAY_NAMES[restriction.displayText] || restriction.displayText;
                            return (
                                <motion.div
                                    key={`${restriction.sourceDefId}-${idx}`}
                                    className="relative flex items-center gap-[0.3vw] bg-red-600/90 backdrop-blur-sm px-[0.6vw] py-[0.3vw] rounded-md shadow-lg border-[0.15vw] border-red-400"
                                    initial={{ y: -20, opacity: 0, scale: 0.8 }}
                                    animate={{ y: 0, opacity: 1, scale: 1 }}
                                    transition={{ type: 'spring', stiffness: 350, damping: 20, delay: idx * 0.1 }}
                                    title={`${factionDisplayName} 派系随从不能打出到此基地`}
                                >
                                    {/* 斜杠图标 */}
                                    <div className="relative w-[1.2vw] h-[1.2vw] flex items-center justify-center">
                                        <svg className="w-full h-full text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                                            <line x1="4" y1="4" x2="20" y2="20" />
                                        </svg>
                                    </div>
                                    {/* 派系名称 */}
                                    <span className="text-[0.8vw] font-black text-white leading-none whitespace-nowrap">
                                        {factionDisplayName}
                                    </span>
                                </motion.div>
                            );
                        }
                        // 未来可以添加其他限制类型的渲染
                        return null;
                    })}
                </div>
            )}

            {/* --- ONGOING EFFECTS (above base card, absolute positioned) --- */}
            {base.ongoingActions && base.ongoingActions.length > 0 && (
                <div className="absolute -top-[6vw] left-1/2 -translate-x-1/2 flex items-center gap-[0.4vw] z-30">
                    {base.ongoingActions.map((oa, idx) => {
                        const actionDef = getCardDef(oa.defId);
                        const actionName = resolveCardName(actionDef, t) || oa.defId;
                        const actionText = resolveCardText(actionDef, t);
                        const actionTitle = actionText ? `${actionName}\n${actionText}` : actionName;
                        const pConf = PLAYER_CONFIG[parseInt(oa.ownerId) % PLAYER_CONFIG.length];
                        // ongoing 行动卡天赋判定
                        const hasOngoingTalent = actionDef?.abilityTags?.includes('talent') ?? false;
                        const canUseOngoingTalent = hasOngoingTalent && !oa.talentUsed && isMyTurn && oa.ownerId === myPlayerId;
                        // 交互驱动的行动卡选择
                        const isSelectableOngoing = !!selectableOngoingUids?.has(oa.uid);
                        const isDimmedOngoing = !!selectableOngoingUids && !selectableOngoingUids.has(oa.uid);
                        return (
                            <motion.div
                                key={oa.uid}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (isSelectableOngoing && onOngoingSelect) {
                                        onOngoingSelect(oa.uid);
                                    } else if (canUseOngoingTalent) {
                                        dispatch(SU_COMMANDS.USE_TALENT, { ongoingCardUid: oa.uid, baseIndex });
                                    } else {
                                        onViewAction(oa.defId);
                                    }
                                }}
                                className={`relative w-[3.8vw] aspect-[0.714] bg-white rounded-[0.15vw] shadow-lg cursor-pointer
                                    hover:z-50 hover:scale-125 hover:-translate-y-[0.3vw] transition-all
                                    border-[0.12vw] ${isDimmedOngoing
                                        ? 'opacity-40 grayscale cursor-not-allowed'
                                        : isSelectableOngoing
                                        ? 'border-purple-400 ring-2 ring-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.6)]'
                                        : canUseOngoingTalent ? 'border-amber-400 ring-2 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]' : `${pConf.border} ${pConf.shadow}`}`}
                                initial={{ y: 20, opacity: 0, scale: 0.6 }}
                                animate={isSelectableOngoing
                                    ? { y: 0, opacity: 1, scale: 1, rotate: [-1, 1, -1], transition: { rotate: { repeat: Infinity, duration: 1.2, ease: 'easeInOut' } } }
                                    : canUseOngoingTalent
                                    ? { y: 0, opacity: 1, scale: 1, rotate: [-1, 1, -1], transition: { rotate: { repeat: Infinity, duration: 1.5, ease: 'easeInOut' } } }
                                    : { y: 0, opacity: 1, scale: 1 }}
                                transition={{ type: 'spring', stiffness: 350, damping: 20, delay: idx * 0.06 }}
                            >
                                <div className="w-full h-full overflow-hidden rounded-[0.1vw]">
                                    <CardPreview
                                        previewRef={actionDef?.previewRef}
                                        className="w-full h-full object-cover"
                                        title={actionTitle}
                                    />
                                    {!actionDef?.previewRef && (
                                        <div className="absolute inset-0 flex items-center justify-center p-[0.15vw] bg-gradient-to-br from-purple-100 to-purple-50">
                                            <span className="text-[0.5vw] font-bold text-center text-slate-700 leading-tight line-clamp-2">
                                                {actionName}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {/* 天赋可用发光叠层 */}
                                {canUseOngoingTalent && (
                                    <motion.div
                                        className="absolute inset-0 pointer-events-none z-20 rounded-[0.1vw]"
                                        animate={{ opacity: [0.3, 0.7, 0.3] }}
                                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                                        style={{ background: 'radial-gradient(ellipse at center, rgba(251,191,36,0.4) 0%, transparent 70%)' }}
                                    />
                                )}
                                {/* 天赋已使用标记 */}
                                {hasOngoingTalent && oa.talentUsed && (
                                    <div className="absolute -bottom-[0.3vw] left-1/2 -translate-x-1/2 bg-slate-600 text-white text-[0.35vw] font-bold px-[0.2vw] py-[0.02vw] rounded-sm shadow-sm border border-white z-10 whitespace-nowrap">
                                        {t('ui.talent_used')}
                                    </div>
                                )}
                                {/* ongoing 卡上的力量指示物（如召唤狼群） */}
                                {((oa.metadata?.powerCounters as number) ?? 0) > 0 && (
                                    <div
                                        className="absolute -top-[0.3vw] -right-[0.3vw] min-w-[1.1vw] h-[1.1vw] rounded-full flex items-center justify-center text-[0.5vw] font-black text-amber-900 bg-gradient-to-br from-amber-300 to-amber-500 shadow-md border-[0.1vw] border-white z-40 px-[0.08vw]"
                                        title={`+1${t('ui.power_counter', '力量指示物')} ×${oa.metadata?.powerCounters}`}
                                    >
                                        +{oa.metadata?.powerCounters as number}
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* --- BASE CARD --- */}
            <div
                onClick={onClick}
                ref={tokenRef}
                className={`
                    relative w-[14vw] aspect-[1.43] bg-white p-[0.4vw] shadow-sm rounded-sm transition-all duration-300 z-20
                    ${isDimmed
                        ? 'opacity-40 grayscale cursor-not-allowed rotate-1'
                        : isSelectable
                        ? 'cursor-pointer rotate-0 scale-105 shadow-[0_0_2.5vw_rgba(251,191,36,0.6)] ring-4 ring-amber-400'
                        : isDeployMode && !isMinionSelectMode
                        ? 'cursor-pointer rotate-0 scale-105 shadow-[0_0_2vw_rgba(255,255,255,0.4)] ring-4 ring-green-400'
                        : 'rotate-1 hover:rotate-0 hover:shadow-xl cursor-zoom-in'}
                `}
                style={{
                    backgroundImage: 'repeating-linear-gradient(45deg, #fff 0px, #fff 2px, #fdfdfd 2px, #fdfdfd 4px)',
                }}
            >
                {/* Inner Art Area — AnimatePresence 实现基地替换过渡 */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={base.defId}
                        className="w-full h-full bg-slate-200 border border-slate-300 overflow-hidden relative"
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        transition={{ duration: 0.4, ease: 'easeInOut' }}
                    >
                    <CardPreview
                        previewRef={baseDef?.previewRef}
                        className="w-full h-full object-cover"
                        title={baseName}
                    />

                    {/* Fallback Text (no card art) */}
                    {!baseDef?.previewRef && (
                        <div className="absolute inset-0 flex flex-col items-center justify-between p-[0.6vw] bg-gradient-to-br from-slate-100 via-slate-50 to-amber-50">
                            {/* 基地名称 */}
                            <h3 className="font-black text-[1vw] text-slate-800 uppercase tracking-tight leading-tight text-center border-b border-slate-300 pb-[0.2vw] w-full">
                                {baseName}
                            </h3>
                            {/* 能力文本 */}
                            <div className="flex-1 flex items-center px-[0.2vw]">
                                <p className="text-[0.55vw] text-slate-600 leading-snug text-center">
                                    {baseText}
                                </p>
                            </div>
                            {/* VP 奖励 */}
                            {baseDef?.vpAwards && (
                                <div className="flex items-center gap-[0.3vw] border-t border-slate-300 pt-[0.2vw] w-full justify-center">
                                    {baseDef.vpAwards.map((vp, i) => (
                                        <span key={i} className={`font-black text-[0.7vw] ${i === 0 ? 'text-amber-600' : i === 1 ? 'text-slate-500' : 'text-amber-800/50'}`}>
                                            {vp}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    </motion.div>
                </AnimatePresence>

                {/* 基地可选时的脉冲发光叠层 */}
                {isSelectable && (
                    <motion.div
                        className="absolute inset-0 pointer-events-none z-25 rounded-sm"
                        animate={{ opacity: [0.1, 0.3, 0.1] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.4) 0%, transparent 70%)' }}
                    />
                )}

                {/* 放大镜按钮 - hover 时显示，部署模式下也能预览基地 */}
                <button
                    onClick={(e) => { e.stopPropagation(); onViewBase(base.defId); }}
                    className="absolute top-[0.6vw] left-[0.6vw] w-[1.6vw] h-[1.6vw] flex items-center justify-center bg-black/60 hover:bg-amber-500/80 text-white rounded-full opacity-0 group-hover/base:opacity-100 transition-[opacity,background-color] duration-200 shadow-lg border border-white/20 z-30 cursor-zoom-in"
                >
                    <svg className="w-[0.9vw] h-[0.9vw] fill-current" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                </button>

                {/* Power Token */}
                <div className="absolute -top-[1.5vw] -right-[1.5vw] w-[4vw] h-[4vw] pointer-events-none z-30 flex items-center justify-center"
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

                    // Calc Power（使用 getEffectivePower 包含 ongoing 修正和临时修正 + ongoing 卡力量贡献）
                    const minionTotal = minions.reduce((sum, m) => sum + getEffectivePower(core, m, baseIndex), 0);
                    const ongoingBonus = getOngoingCardPowerContribution(base, pid);
                    const total = minionTotal + ongoingBonus;
                    const basePowerTotal = minions.reduce((sum, m) => sum + m.basePower, 0);
                    const modifierDelta = total - basePowerTotal;

                    const pConf = PLAYER_CONFIG[parseInt(pid) % PLAYER_CONFIG.length];

                    return (
                        <div key={pid} className="flex flex-col items-center min-w-[5.5vw] relative">

                            {/* --- MINIONS --- */}
                            {minions.length > 0 ? (
                                <div className="flex flex-col items-center isolate z-10 hover:z-[100]">
                                    {minions.map((m, i) => (
                                        <MinionCard
                                            key={m.uid}
                                            minion={m}
                                            effectivePower={getEffectivePower(core, m, baseIndex)}
                                            core={core}
                                            index={i}
                                            pid={pid}
                                            baseIndex={baseIndex}
                                            isMyTurn={isMyTurn}
                                            myPlayerId={myPlayerId}
                                            dispatch={dispatch}
                                            isMinionSelectMode={isMinionSelectMode && (!selectableMinionUids || selectableMinionUids.has(m.uid))}
                                            isMultiSelected={!!multiSelectedMinionUids?.has(m.uid)}
                                            isDimmed={!!isMinionSelectMode && !!selectableMinionUids && !selectableMinionUids.has(m.uid)}
                                            onMinionSelect={onMinionSelect}
                                            onView={() => onViewMinion(m.defId)}
                                            onViewAction={onViewAction}
                                            selectableOngoingUids={selectableOngoingUids}
                                            onOngoingSelect={onOngoingSelect}
                                            isTutorialTargetAllowed={isTutorialTargetAllowed}
                                            phase={phase}
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

// ============================================================================
// Minion Card
// ============================================================================

// ============================================================================
// 附着行动卡角标 + 悬浮预览
// ============================================================================

/** 附着行动卡角标（纯视觉提示，不含交互） */
const AttachedBadge: React.FC<{ count: number }> = ({ count }) => (
    <div className="absolute -top-[0.3vw] -right-[0.3vw] w-[1.1vw] h-[1.1vw] rounded-full
        bg-purple-600 border-[0.1vw] border-white shadow-md
        flex items-center justify-center pointer-events-none z-30">
        <Paperclip className="w-[0.6vw] h-[0.6vw] text-white" strokeWidth={3} />
        {count > 1 && (
            <span className="absolute -top-[0.15vw] -right-[0.15vw] w-[0.5vw] h-[0.5vw] rounded-full
                bg-amber-400 text-[0.3vw] font-black text-slate-900 flex items-center justify-center border border-white">
                {count}
            </span>
        )}
    </div>
);

// ============================================================================
// Minion Card
// ============================================================================

const MinionCard: React.FC<{
    minion: MinionOnBase;
    effectivePower: number;
    core: SmashUpCore;
    index: number;
    pid: string;
    baseIndex: number;
    isMyTurn: boolean;
    myPlayerId: string | null;
    dispatch: (type: string, payload?: unknown) => void;
    isMinionSelectMode?: boolean;
    /** 多选随从模式下已选中 */
    isMultiSelected?: boolean;
    /** 随从选择模式下该随从不可选（置灰） */
    isDimmed?: boolean;
    onMinionSelect?: (minionUid: string, baseIndex: number) => void;
    onView: () => void;
    onViewAction: (defId: string) => void;
    /** 交互驱动的持续行动卡选择：只有这些 UID 的行动卡可被选中 */
    selectableOngoingUids?: Set<string>;
    onOngoingSelect?: (ongoingUid: string) => void;
    isTutorialTargetAllowed?: (targetId: string) => boolean;
    /** 当前游戏阶段 */
    phase?: string;
}> = ({ minion, effectivePower, core, index, pid, baseIndex, isMyTurn, myPlayerId, dispatch, isMinionSelectMode, isMultiSelected, isDimmed, onMinionSelect, onView, onViewAction, selectableOngoingUids, onOngoingSelect, isTutorialTargetAllowed, phase }) => {
    const { t } = useTranslation('game-smashup');
    const def = getMinionDef(minion.defId);
    const resolvedName = resolveCardName(def, t) || minion.defId;
    const resolvedText = resolveCardText(def, t);
    const minionTitle = resolvedText ? `${resolvedName}\n${resolvedText}` : resolvedName;
    const conf = PLAYER_CONFIG[parseInt(pid) % PLAYER_CONFIG.length];

    // 天赋判定：有 talent 标签 + 我方随从 + 轮到我 + 教程允许
    // 巨石阵例外：允许一个随从每回合第 2 次使用天赋（名额未占用时）
    const hasTalent = def?.abilityTags?.includes('talent') ?? false;
    const tutorialAllowed = isTutorialTargetAllowed ? isTutorialTargetAllowed(minion.uid) : true;
    const canUseSecondTalentOnStandingStones =
        core.bases[baseIndex]?.defId === 'base_standing_stones' &&
        !core.standingStonesDoubleTalentMinionUid;
    const canUseTalent = hasTalent
        && isMyTurn
        && minion.controller === myPlayerId
        && tutorialAllowed
        && (!minion.talentUsed || canUseSecondTalentOnStandingStones);

    // 场上随从 special 能力判定（如忍者侍从）
    const hasSpecial = def?.abilityTags?.includes('special') ?? false;
    const canActivateSpecial = hasSpecial
        && isMyTurn
        && minion.controller === myPlayerId
        && tutorialAllowed
        && !isSpecialLimitBlocked(core, minion.defId, baseIndex)
        // scoreBases 阶段：仅在达标基地上高亮
        && (phase !== 'scoreBases' || getScoringEligibleBaseIndices(core).includes(baseIndex))
        // 忍者侍从额外条件：本回合未打出随从
        && (minion.defId !== 'ninja_acolyte' || (myPlayerId != null && core.players[myPlayerId]?.minionsPlayed === 0));

    // 合并：天赋或 special 都可以激活
    const canActivate = canUseTalent || canActivateSpecial;

    const seed = minion.uid.charCodeAt(0) + index;
    const rotation = (seed % 6) - 3;

    const style = {
        marginTop: index === 0 ? 0 : '-5.5vw',
        zIndex: index + 1,
        transform: `rotate(${rotation}deg)`,
    };

    const handleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        // 随从选择模式：点击随从附着 ongoing 行动卡
        if (isMinionSelectMode && onMinionSelect) {
            onMinionSelect(minion.uid, baseIndex);
            return;
        }
        if (canUseTalent) {
            dispatch(SU_COMMANDS.USE_TALENT, { minionUid: minion.uid, baseIndex });
        } else if (canActivateSpecial) {
            dispatch(SU_COMMANDS.ACTIVATE_SPECIAL, { minionUid: minion.uid, baseIndex });
        } else {
            onView();
        }
    }, [isMinionSelectMode, onMinionSelect, canUseTalent, canActivateSpecial, dispatch, minion.uid, baseIndex, onView]);

    // 随从选择模式下的高亮
    const isSelectableMinion = !!isMinionSelectMode;

    return (
        <motion.div
            onClick={handleClick}
            className={`
                relative w-[5.5vw] aspect-[0.714] bg-white p-[0.2vw] rounded-[0.2vw] 
                transition-shadow duration-200 group hover:!z-[999] hover:scale-110 hover:rotate-0
                border-[0.15vw] shadow-md
                ${isDimmed
                    ? 'opacity-40 grayscale cursor-not-allowed'
                    : isMultiSelected
                    ? 'cursor-pointer border-green-400 ring-2 ring-green-400 shadow-[0_0_15px_rgba(74,222,128,0.6),0_0_30px_rgba(74,222,128,0.3)]'
                    : isSelectableMinion
                    ? 'cursor-pointer border-purple-400 ring-2 ring-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.6),0_0_30px_rgba(168,85,247,0.3)]'
                    : canActivate
                    ? 'cursor-pointer border-amber-400 ring-2 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6),0_0_30px_rgba(251,191,36,0.3)]'
                    : `cursor-zoom-in ${conf.border} ${conf.shadow}`}
            `}
            style={style}
            initial={{ scale: 0.3, y: -60, opacity: 0, rotate: -15 }}
            animate={isSelectableMinion
                ? { scale: 1, y: 0, opacity: 1, rotate: [rotation - 1, rotation + 1, rotation - 1], transition: { rotate: { repeat: Infinity, duration: 1.2, ease: 'easeInOut' } } }
                : canActivate
                ? { scale: 1, y: 0, opacity: 1, rotate: [rotation - 2, rotation + 2, rotation - 2], transition: { rotate: { repeat: Infinity, duration: 1.5, ease: 'easeInOut' } } }
                : { scale: 1, y: 0, opacity: 1, rotate: rotation }
            }
            transition={{ type: 'spring', stiffness: 350, damping: 20, delay: index * 0.05 }}
        >
            <div className="w-full h-full bg-slate-100 relative overflow-hidden">
                <CardPreview
                    previewRef={def?.previewRef}
                    className="w-full h-full object-cover"
                    title={minionTitle}
                />

                {!def?.previewRef && (
                    <div className="absolute inset-0 p-[0.2vw] flex items-center justify-center text-center bg-slate-50">
                        <p className="text-[0.6vw] font-bold leading-none text-slate-800 line-clamp-4">{resolvedName}</p>
                    </div>
                )}

                {/* 多选已选中勾选标记 */}
                {isMultiSelected && (
                    <div className="absolute top-[0.15vw] left-[0.15vw] w-[1.4vw] h-[1.4vw] bg-green-500 rounded-full flex items-center justify-center shadow-lg border-[0.1vw] border-white z-30">
                        <svg className="w-[0.8vw] h-[0.8vw] text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    </div>
                )}

                {/* 天赋/特殊能力可用时的发光叠层 */}
                {canActivate && (
                    <motion.div
                        className="absolute inset-0 pointer-events-none z-20 rounded-[0.1vw]"
                        animate={{ opacity: [0.15, 0.35, 0.15] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.6) 0%, transparent 70%)' }}
                    />
                )}
            </div>

            {/* 放大镜按钮 - hover 时显示在右上角，z-40 确保不被力量徽章遮挡 */}
            <button
                onClick={(e) => { e.stopPropagation(); onView(); }}
                className="absolute top-[0.15vw] right-[0.15vw] w-[1.4vw] h-[1.4vw] flex items-center justify-center bg-black/60 hover:bg-amber-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-[opacity,background-color] duration-200 shadow-lg border border-white/20 z-40 cursor-zoom-in"
            >
                <svg className="w-[0.8vw] h-[0.8vw] fill-current" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
            </button>

            {/* 力量增幅徽章 - 增益绿色/减益红色（左上角），仅有变化时显示 */}
            {((effectivePower !== minion.basePower) || !def?.previewRef) && (
                <div
                    className={`absolute -top-[0.4vw] -left-[0.4vw] min-w-[1.2vw] h-[1.2vw] rounded-full flex items-center justify-center text-[0.7vw] font-black text-white shadow-sm border border-white px-[0.15vw] z-30 ${
                        effectivePower > minion.basePower ? 'bg-green-600' :
                        effectivePower < minion.basePower ? 'bg-red-600' :
                        'bg-slate-700'
                    }`}
                    title={(() => {
                        const bd = getEffectivePowerBreakdown(core, minion, baseIndex);
                        const parts = [`基础: ${bd.basePower}`];
                        if (bd.powerCounters !== 0) parts.push(`力量指示物: ${bd.powerCounters > 0 ? '+' : ''}${bd.powerCounters}`);
                        if (bd.permanentModifier !== 0) parts.push(`永久修正: ${bd.permanentModifier > 0 ? '+' : ''}${bd.permanentModifier}`);
                        if (bd.tempModifier !== 0) parts.push(`临时: ${bd.tempModifier > 0 ? '+' : ''}${bd.tempModifier}`);
                        if (bd.ongoingDetails.length > 0) {
                            for (const d of bd.ongoingDetails) parts.push(`${d.sourceName}: ${d.value > 0 ? '+' : ''}${d.value}`);
                        }
                        parts.push(`= ${bd.finalPower}`);
                        return parts.join('\n');
                    })()}
                >
                    {effectivePower === minion.basePower
                        ? effectivePower
                        : `${effectivePower > minion.basePower ? '+' : ''}${effectivePower - minion.basePower}`}
                </div>
            )}

            {/* +1力量指示物徽章（左侧，力量增幅下方） */}
            {(minion.powerCounters ?? 0) > 0 && (
                <motion.div
                    className={`absolute -left-[0.4vw] min-w-[1.2vw] h-[1.2vw] rounded-full flex items-center justify-center text-[0.55vw] font-black text-amber-900 bg-gradient-to-br from-amber-300 to-amber-500 shadow-md border-[0.1vw] border-white px-[0.1vw] z-30 ${
                        (effectivePower !== minion.basePower) || !def?.previewRef ? 'top-[1vw]' : '-top-[0.4vw]'
                    }`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                    title={`+1力量指示物 ×${minion.powerCounters}`}
                >
                    +{minion.powerCounters}
                </motion.div>
            )}

            {/* 天赋已使用标记 */}
            {hasTalent && minion.talentUsed && !canUseTalent && (
                <div className="absolute -bottom-[0.3vw] left-1/2 -translate-x-1/2 bg-slate-600 text-white text-[0.45vw] font-bold px-[0.3vw] py-[0.05vw] rounded-sm shadow-sm border border-white z-10 whitespace-nowrap">
                    {t('ui.talent_used')}
                </div>
            )}

            {/* 附着的 ongoing 行动卡 - 角标 + hover 时右侧弹出小卡片 */}
            {minion.attachedActions && minion.attachedActions.length > 0 && (
                <>
                    <AttachedBadge count={minion.attachedActions.length} />
                    {/* hover 随从时显示的小卡片列，高 z-index 避免被相邻随从遮挡 */}
                    {/* 行动卡选择模式下始终显示（不需要 hover） */}
                    {/* right-0 + pl 桥接：容器左边界与随从卡右边界重叠，消除鼠标移动死区 */}
                    <div
                        className={`absolute top-0 left-full flex flex-col gap-[0.2vw] pl-[0.6vw]
                            ${selectableOngoingUids
                                ? 'opacity-100 scale-100 pointer-events-auto'
                                : 'opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all duration-150 pointer-events-none group-hover:pointer-events-auto'
                            }`}
                        style={{ zIndex: UI_Z_INDEX.tooltip }}
                    >
                        {minion.attachedActions.map((aa) => {
                            const actionDef = getCardDef(aa.defId);
                            const actionName = resolveCardName(actionDef, t) || aa.defId;
                            const actionText = resolveCardText(actionDef, t);
                            const actionTitle = actionText ? `${actionName}\n${actionText}` : actionName;
                            const isSelectableAA = !!selectableOngoingUids?.has(aa.uid);
                            const isDimmedAA = !!selectableOngoingUids && !selectableOngoingUids.has(aa.uid);
                            const hasAATalent = actionDef?.abilityTags?.includes('talent') ?? false;
                            const canUseAATalent = hasAATalent && !aa.talentUsed && isMyTurn && aa.ownerId === myPlayerId;
                            return (
                                <motion.div
                                    key={aa.uid}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (isSelectableAA && onOngoingSelect) {
                                            onOngoingSelect(aa.uid);
                                        } else if (canUseAATalent) {
                                            dispatch(SU_COMMANDS.USE_TALENT, { ongoingCardUid: aa.uid, baseIndex });
                                        } else {
                                            onViewAction(aa.defId);
                                        }
                                    }}
                                    className={`w-[1.8vw] aspect-[0.714] bg-white rounded-[0.1vw] shadow-lg cursor-pointer
                                        hover:scale-[2] hover:translate-x-[0.8vw] transition-transform duration-150
                                        border-[0.08vw] ${isDimmedAA
                                            ? 'opacity-40 grayscale cursor-not-allowed border-slate-400'
                                            : isSelectableAA
                                            ? 'border-purple-400 ring-2 ring-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.6)]'
                                            : canUseAATalent
                                            ? 'border-amber-400 ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)]'
                                            : 'border-purple-400 ring-1 ring-purple-300/50'
                                        }`}
                                    title={actionTitle}
                                >
                                    <div className="w-full h-full overflow-hidden rounded-[0.06vw]">
                                        <CardPreview
                                            previewRef={actionDef?.previewRef}
                                            className="w-full h-full object-cover"
                                            title={actionName}
                                        />
                                        {!actionDef?.previewRef && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-purple-50 p-[0.05vw]">
                                                <span className="text-[0.3vw] font-bold text-purple-800 leading-tight text-center line-clamp-2">
                                                    {actionName}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </>
            )}
        </motion.div>
    );
};
