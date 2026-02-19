import React from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Check } from 'lucide-react';
import { GameButton } from './components/GameButton';
import type { Die, TurnPhase } from '../types';
import type { InteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import type { MultistepInteractionState } from '../../../engine/systems/useMultistepInteraction';
import type { DiceModifyResult, DiceModifyStep, DiceSelectResult, DiceSelectStep } from '../domain/systems';
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

/** 从 multistep-choice interaction 中提取 DiceThrone 元数据 */
function getDtMeta(interaction?: InteractionDescriptor): DtDiceMeta | undefined {
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
    const diceSize = '4vw';

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
            flex flex-col items-center p-[0.6vw] rounded-[1.5vw] gap-[0.5vw] w-[5.8vw] shrink-0 relative transition-all duration-300
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
            <div className="absolute inset-0 rounded-[1.5vw] bg-gradient-to-tr from-white/0 via-white/5 to-transparent pointer-events-none" />
            {/* Internal rim highlight */}
            <div className={`absolute inset-[0.1vw] rounded-[1.4vw] pointer-events-none border-[0.05vw] ${isInteractionMode ? 'border-amber-400/20' : 'border-t-white/20 border-l-white/10 border-transparent'} `} />
            {/* Deep recess shadow at the top */}
            <div className="absolute top-0 left-0 right-0 h-[1.5vw] rounded-t-[1.5vw] bg-gradient-to-b from-black/95 to-transparent pointer-events-none" />

            <div className="flex flex-col gap-[0.5vw] items-center justify-center w-full p-[0.2vw]">
                {dice.map((d, i) => {
                    const selected = isSelected(d.id);
                    const isModified = isModifyMode && d.id in (modifyResult?.modifications ?? {});
                    // adjust 模式：对所有未锁定骰子显示 +/- 按钮（不依赖 selected，因为 adjust 模式下骰子无需先"选中"）
                    const showAdjustButtons = isInteractionMode && isAdjustMode && !d.isKept;
                    const showAnyModeButtons = isInteractionMode && isAnyMode && !d.isKept &&
                        (isModified || currentSelectCount < maxSelectCount);
                    const isInactiveDie = isInteractionMode && d.isKept;
                    const clickable = isInteractionMode
                        ? (isAnyMode ? false : (!isInactiveDie && (canSelectMore || selected)))
                        : canInteract;
                    // any/adjust 模式下使用本地预览值
                    const displayValue = (isAnyMode || isAdjustMode)
                        ? (modifyResult?.modifications[d.id] ?? d.value)
                        : d.value;

                    return (
                        <div key={d.id} className="relative flex items-center gap-[0.3vw]">
                            {/* 左侧 - 减号按钮 */}
                            {(showAdjustButtons || showAnyModeButtons) && (
                                <button
                                    onClick={() => handleAdjust(d.id, -1, d.value)}
                                    disabled={displayValue <= 1 || (showAdjustButtons && !canAdjustDown)}
                                    className={`w-[1.2vw] h-[1.2vw] rounded-full flex items-center justify-center font-bold text-[0.8vw] transition-all duration-150 ${(displayValue <= 1 || (showAdjustButtons && !canAdjustDown))
                                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                        : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg hover:scale-110'
                                        }`}
                                >
                                    −
                                </button>
                            )}

                            {/* 骰子本体 */}
                            <div className="relative flex flex-col items-center gap-[0.25vw]" data-testid="die">
                                <div
                                    onClick={() => clickable && handleDieClick(d.id)}
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
                                    />
                                    {!isInteractionMode && d.isKept && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                            <div className="text-[0.6vw] font-black text-white bg-black/50 px-[0.4vw] py-[0.1vw] rounded uppercase tracking-wider shadow-sm border border-white/20">
                                                {t('dice.locked')}
                                            </div>
                                        </div>
                                    )}
                                    {selected && !showAdjustButtons && !showAnyModeButtons && (
                                        <div className="absolute -top-[0.3vw] -right-[0.3vw] w-[1vw] h-[1vw] bg-amber-500 rounded-full flex items-center justify-center z-30">
                                            <Check size={12} className="text-white" strokeWidth={3} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 右侧 - 加号按钮 */}
                            {(showAdjustButtons || showAnyModeButtons) && (
                                <button
                                    onClick={() => handleAdjust(d.id, 1, d.value)}
                                    disabled={displayValue >= 6 || (showAdjustButtons && !canAdjustUp)}
                                    className={`w-[1.2vw] h-[1.2vw] rounded-full flex items-center justify-center font-bold text-[0.8vw] transition-all duration-150 ${(displayValue >= 6 || (showAdjustButtons && !canAdjustUp))
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
    const isRollPhase = currentPhase === 'offensiveRoll' || currentPhase === 'defensiveRoll';
    const dtMeta = getDtMeta(interaction);
    const isInteractionMode = Boolean(dtMeta);

    const handleRollClick = () => {
        if (isInteractionMode) {
            multistepInteraction?.cancel();
            return;
        }
        if (!isRollPhase || !canInteract || rollConfirmed || rollCount >= rollLimit) return;
        setIsRolling(true);
        onRoll();
        setTimeout(() => setIsRolling(false), 600);
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
                        w-[0.45vw] h-[0.45vw] rounded-full border border-black/30 shadow-sm transition-all duration-300 flex-shrink-0
                        ${isUsed ? 'bg-slate-900/60' : 'bg-white'}
                    `}
                />
            );
        }
        return (
            <div className="flex flex-col flex-wrap gap-[0.15vw] justify-center items-center h-[1.8vw] ml-[0.3vw] shrink-0 content-center">
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
        <div className="w-[10.2vw] grid grid-cols-2 gap-[0.4vw] items-stretch h-[2.5vw]">
            <GameButton
                onClick={handleRollClick}
                disabled={leftDisabled}
                variant={leftVariant}
                size="sm"
                clickSoundKey={isInteractionMode ? undefined : null}
                className={clsx(
                    "!px-[0.5vw] !py-0 flex items-center justify-between h-full whitespace-nowrap overflow-hidden !rounded-[0.5vw]",
                    !isInteractionMode && isRolling && 'animate-pulse'
                )}
                data-tutorial-id={isInteractionMode ? undefined : 'dice-roll-button'}
            >
                {isInteractionMode ? (
                    <span className="flex-1 text-center font-black !text-[0.75vw]">{t('common.cancel')}</span>
                ) : (
                    <>
                        <div className="truncate flex-1 text-center font-black !text-[0.7vw] tracking-tighter">
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
                    "flex items-center justify-center h-full whitespace-nowrap overflow-hidden font-black !text-[0.7vw] !rounded-[0.5vw] !py-0",
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
