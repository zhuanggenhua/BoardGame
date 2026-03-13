import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Check } from 'lucide-react';
import { GameButton } from './components/GameButton';
import type { Die, TurnPhase } from '../types';
import type { InteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import type { MultistepInteractionState } from '../../../engine/systems/useMultistepInteraction';
import type { DiceModifyResult, DiceModifyStep, DiceSelectResult, DiceSelectStep } from '../domain/systems';
import { useMobileViewport } from '../../../hooks/ui/useMobileViewport';
import { Dice3D } from './Dice3D';

// ============================================================================
// DiceThrone 骰子交互元数据类型
// ============================================================================

interface DtDiceModifyMeta {
    dtType: 'modifyDie';
    dieModifyConfig?: {
        mode: 'set' | 'adjust' | 'copy' | 'any';
        targetValue?: number;
        adjustRange?: { min: number; max: number };
    };
    selectCount: number;
    targetOpponentDice: boolean;
}

interface DtDiceSelectMeta {
    dtType: 'selectDie';
    selectCount: number;
    targetOpponentDice: boolean;
}

type DtDiceMeta = DtDiceModifyMeta | DtDiceSelectMeta;

const DESKTOP_DICE_TRAY_TOKENS = {
    diceSize: '4vw',
    containerClassName: 'flex flex-col items-center p-[0.6vw] rounded-[1.5vw] gap-[0.5vw] w-[5.8vw] shrink-0 relative transition-all duration-300',
    glossClassName: 'absolute inset-0 rounded-[1.5vw] bg-gradient-to-tr from-white/0 via-white/5 to-transparent pointer-events-none',
    rimClassName: 'absolute inset-[0.1vw] rounded-[1.4vw] pointer-events-none border-[0.05vw]',
    shadowClassName: 'absolute top-0 left-0 right-0 h-[1.5vw] rounded-t-[1.5vw] bg-gradient-to-b from-black/95 to-transparent pointer-events-none',
    trayInnerClassName: 'flex flex-col gap-[0.5vw] items-center justify-center w-full p-[0.2vw]',
    rowGapClassName: 'gap-[0.3vw]',
    dieGapClassName: 'gap-[0.25vw]',
    adjustButtonClassName: 'w-[1.2vw] h-[1.2vw] text-[0.8vw]',
    lockedLabelClassName: 'text-[0.6vw] px-[0.4vw] py-[0.1vw]',
    selectedBadgeClassName: 'w-[1vw] h-[1vw] -top-[0.3vw] -right-[0.3vw]',
    selectedBadgeIconClassName: '',
};

const MOBILE_DICE_TRAY_TOKENS = {
    diceSize: 'clamp(1.62rem,3vw,1.92rem)',
    containerClassName: 'flex flex-col items-center p-[clamp(0.16rem,0.26vw,0.2rem)] rounded-[clamp(0.62rem,0.9vw,0.82rem)] gap-[clamp(0.1rem,0.14vw,0.16rem)] w-[clamp(4rem,7.8vw,4.55rem)] shrink-0 relative transition-all duration-300',
    glossClassName: 'absolute inset-0 rounded-[clamp(0.62rem,0.9vw,0.82rem)] bg-gradient-to-tr from-white/0 via-white/4 to-transparent pointer-events-none',
    rimClassName: 'absolute inset-px rounded-[clamp(0.58rem,0.82vw,0.76rem)] pointer-events-none border',
    shadowClassName: 'absolute top-0 left-0 right-0 h-[clamp(0.54rem,0.72vw,0.66rem)] rounded-t-[clamp(0.62rem,0.9vw,0.82rem)] bg-gradient-to-b from-black/95 to-transparent pointer-events-none',
    trayInnerClassName: 'flex flex-col gap-[clamp(0.08rem,0.12vw,0.12rem)] items-center justify-center w-full p-[clamp(0.05rem,0.08vw,0.08rem)]',
    rowGapClassName: 'gap-[clamp(0.12rem,0.16vw,0.18rem)]',
    dieGapClassName: 'gap-[clamp(0.06rem,0.1vw,0.1rem)]',
    adjustButtonClassName: 'w-[clamp(0.92rem,1.7vw,1.1rem)] h-[clamp(0.92rem,1.7vw,1.1rem)] text-[clamp(0.56rem,1vw,0.68rem)]',
    lockedLabelClassName: 'text-[clamp(0.38rem,0.52vw,0.48rem)] px-[clamp(0.16rem,0.2vw,0.22rem)] py-[1px]',
    selectedBadgeClassName: 'w-[clamp(0.64rem,0.84vw,0.72rem)] h-[clamp(0.64rem,0.84vw,0.72rem)] -top-[clamp(0.08rem,0.12vw,0.12rem)] -right-[clamp(0.08rem,0.12vw,0.12rem)]',
    selectedBadgeIconClassName: 'h-[clamp(0.42rem,0.52vw,0.5rem)] w-[clamp(0.42rem,0.52vw,0.5rem)]',
};

const DESKTOP_DICE_ACTION_TOKENS = {
    containerClassName: 'w-[10.2vw] grid grid-cols-2 gap-[0.4vw] items-stretch h-[2.5vw]',
    buttonClassName: '!px-[0.5vw] !rounded-[0.5vw]',
    interactionTextClassName: '!text-[0.75vw]',
    rollTextClassName: '!text-[0.7vw] tracking-tighter',
    confirmTextClassName: '!text-[0.7vw]',
    dotClassName: 'w-[0.45vw] h-[0.45vw]',
    dotsContainerClassName: 'flex flex-col flex-wrap gap-[0.15vw] justify-center items-center h-[1.8vw] ml-[0.3vw] shrink-0 content-center',
};

const MOBILE_DICE_ACTION_TOKENS = {
    containerClassName: 'w-[clamp(6rem,13vw,6.8rem)] grid grid-cols-2 gap-[clamp(0.18rem,0.24vw,0.24rem)] items-stretch h-[clamp(2rem,4vw,2.2rem)]',
    buttonClassName: '!px-[clamp(0.26rem,0.38vw,0.34rem)] !min-h-0 !rounded-[0.62rem]',
    interactionTextClassName: '!text-[clamp(0.62rem,1.28vw,0.72rem)] leading-none',
    rollTextClassName: '!text-[clamp(0.56rem,1.18vw,0.66rem)] leading-none tracking-tight',
    confirmTextClassName: '!text-[clamp(0.58rem,1.18vw,0.68rem)] leading-none',
    dotClassName: 'w-[clamp(0.24rem,0.42vw,0.3rem)] h-[clamp(0.24rem,0.42vw,0.3rem)]',
    dotsContainerClassName: 'flex flex-col flex-wrap gap-[clamp(0.08rem,0.12vw,0.1rem)] justify-center items-center h-[clamp(1.3rem,2.6vw,1.45rem)] ml-[clamp(0.16rem,0.22vw,0.2rem)] shrink-0 content-center',
};

/** 从 multistep-choice interaction 中提取 DiceThrone 元数据 */
export function getDtMeta(interaction?: InteractionDescriptor): DtDiceMeta | undefined {
    if (!interaction || interaction.kind !== 'multistep-choice') return undefined;
    const meta = (interaction.data as any)?.meta as DtDiceMeta | undefined;
    if (!meta?.dtType) return undefined;
    return meta;
}

// ============================================================================
// DiceTray 组件
// ============================================================================

export const DiceTray = ({
    dice,
    onToggleLock,
    currentPhase: _currentPhase,
    canInteract,
    isRolling,
    rerollingDiceIds,
    locale,
    interaction,
    multistepInteraction,
    isPassiveRerollMode,
}: {
    dice: Die[];
    onToggleLock: (id: number) => void;
    currentPhase: TurnPhase;
    canInteract: boolean;
    isRolling: boolean;
    rerollingDiceIds?: number[];
    locale?: string;
    /** 当前骰子交互描述符（从 sys.interaction.current 读取） */
    interaction?: InteractionDescriptor;
    /** useMultistepInteraction 返回的状态和操作 */
    multistepInteraction?: MultistepInteractionState<DiceModifyResult | DiceSelectResult>;
    /** 被动重掷选择模式（翡翠色高亮） */
    isPassiveRerollMode?: boolean;
}) => {
    const { t } = useTranslation('game-dicethrone');
    const isMobileNarrowViewport = useMobileViewport();
    const trayTokens = isMobileNarrowViewport ? MOBILE_DICE_TRAY_TOKENS : DESKTOP_DICE_TRAY_TOKENS;
    const {
        diceSize,
        containerClassName,
        glossClassName,
        rimClassName,
        shadowClassName,
        trayInnerClassName,
        rowGapClassName,
        dieGapClassName,
        adjustButtonClassName,
        lockedLabelClassName,
        selectedBadgeClassName,
        selectedBadgeIconClassName,
    } = trayTokens;

    const dtMeta = getDtMeta(interaction);
    const isInteractionMode = Boolean(dtMeta);
    const isModifyMode = dtMeta?.dtType === 'modifyDie';
    const isSelectMode = dtMeta?.dtType === 'selectDie';
    const dieModifyConfig = isModifyMode ? (dtMeta as DtDiceModifyMeta).dieModifyConfig : undefined;
    const isAnyMode = dieModifyConfig?.mode === 'any';
    const isAdjustMode = dieModifyConfig?.mode === 'adjust';
    const adjustRange = dieModifyConfig?.adjustRange ?? { min: -1, max: 1 };

    // 从 multistepInteraction.result 读取当前累积结果
    const modifyResult = (isModifyMode && multistepInteraction?.result) as DiceModifyResult | null | undefined;
    const selectResult = (isSelectMode && multistepInteraction?.result) as DiceSelectResult | null | undefined;

    const totalAdjustment = modifyResult?.totalAdjustment ?? 0;
    const canAdjustDown = isAdjustMode && totalAdjustment > adjustRange.min;
    const canAdjustUp = isAdjustMode && totalAdjustment < adjustRange.max;

    const isSelected = (dieId: number): boolean => {
        if (isSelectMode) return selectResult?.selectedDiceIds.includes(dieId) ?? false;
        if (isModifyMode) return dieId in (modifyResult?.modifications ?? {});
        return false;
    };

    const maxSelectCount = dtMeta?.selectCount ?? 1;
    const currentSelectCount = isSelectMode
        ? (selectResult?.selectedDiceIds.length ?? 0)
        : (modifyResult?.modCount ?? 0);
    const canSelectMore = currentSelectCount < maxSelectCount;

    const handleDieClick = (dieId: number) => {
        if (isRolling) return;

        if (isInteractionMode && !isAnyMode && multistepInteraction) {
            // set / copy / selectDie 模式：点击骰子 = step(select/toggle)
            if (isSelectMode) {
                multistepInteraction.step({ action: 'toggle', dieId } as DiceSelectStep);
            } else if (isModifyMode) {
                const die = dice.find(d => d.id === dieId);
                if (!die) return;
                const alreadySelected = isSelected(dieId);
                if (alreadySelected) {
                    // 取消选择：重置该骰子（通过 select 覆盖为原始值）
                    multistepInteraction.step({ action: 'select', dieId, dieValue: die.value } as DiceModifyStep);
                } else if (canSelectMore) {
                    multistepInteraction.step({ action: 'select', dieId, dieValue: die.value } as DiceModifyStep);
                }
            }
        } else if (canInteract) {
            onToggleLock(dieId);
        }
    };

    const handleAdjust = (dieId: number, delta: number, currentValue: number) => {
        if (!multistepInteraction) return;

        if (isAdjustMode) {
            if (delta < 0 && !canAdjustDown) return;
            if (delta > 0 && !canAdjustUp) return;
            multistepInteraction.step({ action: 'adjust', dieId, delta, currentValue } as DiceModifyStep);
        } else if (isAnyMode) {
            // any 模式：直接设置新值（本地预览）
            const currentPreview = modifyResult?.modifications[dieId] ?? currentValue;
            const newValue = currentPreview + delta;
            if (newValue >= 1 && newValue <= 6) {
                multistepInteraction.step({ action: 'setAny', dieId, newValue } as DiceModifyStep);
            }
        }
    };

    return (
        <div
            className={`
            ${containerClassName}
            border-t-[0.12vw] border-l-[0.1vw] border-b-[0.2vw] border-r-[0.12vw]
            ${isInteractionMode
                ? 'bg-slate-950 border-transparent ring-[0.2vw] ring-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.3)]'
                : isPassiveRerollMode
                    ? 'bg-slate-950 border-transparent ring-[0.2vw] ring-emerald-500 shadow-[0_0_30px_rgba(52,211,153,0.3)]'
                    : 'bg-gradient-to-b from-[#1a1e36] via-[#0d0e1a] to-[#05060a] border-indigo-300/30 border-black/80 shadow-[inset_0_5px_12px_rgba(0,0,0,0.9),0_15px_30px_rgba(0,0,0,0.4)]'}
        `}
            data-tutorial-id="dice-tray"
        >
            {/* Glossy overlay for metallic feel without expensive blur */}
            <div className={glossClassName} />
            {/* Internal rim highlight */}
            <div className={`${rimClassName} ${isInteractionMode ? 'border-amber-400/20' : 'border-t-white/20 border-l-white/10 border-transparent'} `} />
            {/* Deep recess shadow at the top */}
            <div className={shadowClassName} />

            <div className={trayInnerClassName}>
                {dice.map((d, i) => {
                    const selected = isSelected(d.id);
                    const isModified = isModifyMode && d.id in (modifyResult?.modifications ?? {});
                    // 锁定只影响重投保留，不应阻止卡牌/效果对骰子的修改。
                    // 因此 modifyDie 的所有模式（set/copy/any/adjust）都允许选中已锁定骰子。
                    const canModifyDie = true;
                    const showAdjustButtons = isInteractionMode && isAdjustMode && canModifyDie;
                    const showAnyModeButtons = isInteractionMode && isAnyMode && canModifyDie &&
                        (isModified || currentSelectCount < maxSelectCount);
                    const isInactiveDie = isInteractionMode && !canModifyDie;
                    const clickable = isInteractionMode
                        ? (isAnyMode ? false : (!isInactiveDie && (canSelectMore || selected)))
                        : canInteract;
                    // any/adjust 模式下使用本地预览值
                    const displayValue = (isAnyMode || isAdjustMode)
                        ? (modifyResult?.modifications[d.id] ?? d.value)
                        : d.value;

                    return (
                        <div key={d.id} className={`relative flex items-center ${rowGapClassName}`}>
                            {/* 左侧 - 减号按钮 */}
                            {(showAdjustButtons || showAnyModeButtons) && (
                                <button
                                    onClick={() => handleAdjust(d.id, -1, d.value)}
                                    disabled={displayValue <= 1 || (showAdjustButtons && !canAdjustDown)}
                                    className={`${adjustButtonClassName} rounded-full flex items-center justify-center font-bold transition-all duration-150 ${(displayValue <= 1 || (showAdjustButtons && !canAdjustDown))
                                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                        : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg hover:scale-110'
                                        }`}
                                >
                                    −
                                </button>
                            )}

                            {/* 骰子本体 */}
                            <div className={`relative flex flex-col items-center ${dieGapClassName}`} data-testid="die">
                                <div
                                    onClick={() => clickable && handleDieClick(d.id)}
                                    data-testid={`die-button-${d.id}`}
                                    data-selected={selected ? 'true' : 'false'}
                                    data-clickable={clickable ? 'true' : 'false'}
                                    data-display-value={displayValue}
                                    className={`
                                        relative flex-shrink-0 group transition-all duration-200
                                        ${!isInteractionMode && d.isKept ? 'opacity-80' : ''}
                                        ${!clickable && !showAdjustButtons && !showAnyModeButtons ? 'cursor-not-allowed opacity-50' : ''}
                                        ${clickable ? 'cursor-pointer hover:scale-110' : ''}
                                        ${selected ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900 rounded-lg scale-105' : ''}
                                    `}
                                >
                                    <Dice3D
                                        value={displayValue}
                                        isRolling={(isRolling && !d.isKept) || (rerollingDiceIds?.includes(d.id) ?? false)}
                                        index={i}
                                        size={diceSize}
                                        locale={locale}
                                        characterId={d.definitionId?.replace('-dice', '')}
                                        definitionId={d.definitionId}
                                    />
                                    {!isInteractionMode && d.isKept && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                            <div className={`${lockedLabelClassName} font-black text-white bg-black/50 rounded uppercase tracking-wider shadow-sm border border-white/20`}>
                                                {t('dice.locked')}
                                            </div>
                                        </div>
                                    )}
                                    {selected && !showAdjustButtons && !showAnyModeButtons && (
                                        <div className={`absolute ${selectedBadgeClassName} bg-amber-500 rounded-full flex items-center justify-center z-30`}>
                                            <Check size={isMobileNarrowViewport ? 10 : 12} className={`text-white ${selectedBadgeIconClassName}`} strokeWidth={3} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 右侧 - 加号按钮 */}
                            {(showAdjustButtons || showAnyModeButtons) && (
                                <button
                                    onClick={() => handleAdjust(d.id, 1, d.value)}
                                    disabled={displayValue >= 6 || (showAdjustButtons && !canAdjustUp)}
                                    className={`${adjustButtonClassName} rounded-full flex items-center justify-center font-bold transition-all duration-150 ${(displayValue >= 6 || (showAdjustButtons && !canAdjustUp))
                                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                        : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg hover:scale-110'
                                        }`}
                                >
                                    +
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ============================================================================
// DiceActions 组件
// ============================================================================

export const DiceActions = ({
    rollCount,
    rollLimit,
    rollConfirmed,
    onRoll,
    onConfirm,
    currentPhase,
    canInteract,
    isRolling,
    setIsRolling,
    interaction,
    multistepInteraction,
    setRerollingDiceIds,
}: {
    rollCount: number;
    rollLimit: number;
    rollConfirmed: boolean;
    onRoll: () => void;
    onConfirm: () => void;
    currentPhase: TurnPhase;
    canInteract: boolean;
    isRolling: boolean;
    setIsRolling: (isRolling: boolean) => void;
    /** 当前骰子交互描述符（从 sys.interaction.current 读取） */
    interaction?: InteractionDescriptor;
    /** useMultistepInteraction 返回的状态和操作 */
    multistepInteraction?: MultistepInteractionState<DiceModifyResult | DiceSelectResult>;
    /** 设置重掷动画骰子 ID */
    setRerollingDiceIds: (ids: number[]) => void;
}) => {
    const { t } = useTranslation('game-dicethrone');
    const isMobileNarrowViewport = useMobileViewport();
    const actionTokens = isMobileNarrowViewport ? MOBILE_DICE_ACTION_TOKENS : DESKTOP_DICE_ACTION_TOKENS;
    const isRollPhase = currentPhase === 'offensiveRoll' || currentPhase === 'defensiveRoll';
    const dtMeta = getDtMeta(interaction);
    const isInteractionMode = Boolean(dtMeta);

    // 骰子动画最短播放时间保护
    // 乐观更新会瞬间产生新 rollCount，但骰子翻滚动画需要一定时间。
    // 记录 setIsRolling(true) 的时刻，rollCount 变化时检查是否已过最短时间。
    const MIN_ROLL_ANIMATION_MS = 800;
    const rollStartTimeRef = useRef<number>(0);

    // 监听 rollCount 变化停止动画
    const rollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevRollCountRef = useRef(rollCount);

    useEffect(() => {
        if (rollCount !== prevRollCountRef.current) {
            prevRollCountRef.current = rollCount;
            if (isRolling) {
                // 清理之前的安全超时
                if (rollTimeoutRef.current) {
                    clearTimeout(rollTimeoutRef.current);
                    rollTimeoutRef.current = null;
                }
                // 检查动画是否已播放足够时间
                const elapsed = Date.now() - rollStartTimeRef.current;
                const remaining = MIN_ROLL_ANIMATION_MS - elapsed;
                if (remaining <= 0) {
                    // 已过最短时间，立即停止
                    setIsRolling(false);
                } else {
                    // 延迟停止，让动画播放完
                    rollTimeoutRef.current = setTimeout(() => {
                        rollTimeoutRef.current = null;
                        setIsRolling(false);
                    }, remaining);
                }
            }
        }
    }, [rollCount, isRolling, setIsRolling]);

    // 清理定时器
    useEffect(() => {
        return () => {
            if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
        };
    }, []);

    const handleRollClick = () => {
        if (isInteractionMode) {
            multistepInteraction?.cancel();
            return;
        }
        if (!isRollPhase || !canInteract || rollConfirmed || rollCount >= rollLimit) return;
        setIsRolling(true);
        rollStartTimeRef.current = Date.now();
        onRoll();
        // 安全超时：防止服务器长时间无响应时骰子一直转
        if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
        rollTimeoutRef.current = setTimeout(() => {
            rollTimeoutRef.current = null;
            setIsRolling(false);
        }, 5000);
    };

    const handleConfirmClick = () => {
        if (isInteractionMode && multistepInteraction) {
            // selectDie 模式：触发重掷动画
            if (dtMeta?.dtType === 'selectDie') {
                const selectResult = multistepInteraction.result as DiceSelectResult | null;
                if (selectResult && selectResult.selectedDiceIds.length > 0) {
                    setRerollingDiceIds(selectResult.selectedDiceIds);
                    setTimeout(() => setRerollingDiceIds([]), 600);
                }
            }
            multistepInteraction.confirm();
            return;
        }
        onConfirm();
    };

    const renderRollDots = () => {
        const dots = [];
        for (let i = 0; i < rollLimit; i++) {
            const isUsed = i < rollCount;
            dots.push(
                <div
                    key={i}
                    className={`
                        ${actionTokens.dotClassName} rounded-full border border-black/30 shadow-sm transition-all duration-300 flex-shrink-0
                        ${isUsed ? 'bg-slate-900/60' : 'bg-white'}
                    `}
                />
            );
        }
        return (
            <div className={actionTokens.dotsContainerClassName}>
                {dots}
            </div>
        );
    };

    const leftDisabled = isInteractionMode
        ? false
        : (!canInteract || rollConfirmed || rollCount >= rollLimit);
    const leftVariant = isInteractionMode
        ? 'secondary' as const
        : (isRollPhase && canInteract && !rollConfirmed && rollCount < rollLimit ? 'primary' as const : 'secondary' as const);

    const rightDisabled = isInteractionMode
        ? !(multistepInteraction?.canConfirm ?? false)
        : (rollConfirmed || rollCount === 0 || !canInteract || isRolling);
    const rightVariant = isInteractionMode
        ? 'primary' as const
        : (rollConfirmed ? 'glass' as const : 'secondary' as const);

    return (
        <div className={actionTokens.containerClassName}>
            <GameButton
                onClick={handleRollClick}
                disabled={leftDisabled}
                variant={leftVariant}
                size="sm"
                clickSoundKey={isInteractionMode ? undefined : null}
                className={clsx(
                    `!py-0 flex items-center justify-between h-full whitespace-nowrap overflow-hidden ${actionTokens.buttonClassName}`,
                    !isInteractionMode && isRolling && 'animate-pulse'
                )}
                data-tutorial-id={isInteractionMode ? undefined : 'dice-roll-button'}
            >
                {isInteractionMode ? (
                    <span className={`flex-1 text-center font-black ${actionTokens.interactionTextClassName}`}>{t('common.cancel')}</span>
                ) : (
                    <>
                        <div className={`truncate flex-1 text-center font-black ${actionTokens.rollTextClassName}`}>
                            {isRolling ? t('dice.rolling', '投掷中...') : t('dice.roll_action', '投掷')}
                        </div>
                        {!isRolling && renderRollDots()}
                    </>
                )}
            </GameButton>

            <GameButton
                onClick={handleConfirmClick}
                disabled={rightDisabled}
                variant={rightVariant}
                size="sm"
                clickSoundKey={isInteractionMode ? undefined : null}
                className={clsx(
                    `flex items-center justify-center h-full whitespace-nowrap overflow-hidden font-black !py-0 ${actionTokens.buttonClassName} ${actionTokens.confirmTextClassName}`,
                    !isInteractionMode && rollConfirmed && '!text-white/60'
                )}
                data-tutorial-id={isInteractionMode ? undefined : 'dice-confirm-button'}
            >
                {isInteractionMode
                    ? t('common.confirm')
                    : (rollConfirmed ? t('dice.confirmed', '已确认') : t('dice.confirm', '确认'))}
            </GameButton>
        </div>
    );
};
