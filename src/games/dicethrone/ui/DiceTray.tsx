import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Check } from 'lucide-react';
import { GameButton } from './components/GameButton';
import type { Die, PlayerId, TurnPhase } from '../types';
import type { InteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import type { MultistepInteractionState } from '../../../engine/systems/useMultistepInteraction';
import type { DiceModifyResult, DiceModifyStep, DiceSelectResult, DiceSelectStep } from '../domain/systems';
import { Dice2D } from './Dice2D';
import { resolveCharacterIdFromDiceDefinitionId } from './assets';
import { buildBoardShellInlineUnitValue } from '../../../shared/runtimeLayoutUnits';

interface DtDiceModifyMeta {
    dtType: 'modifyDie';
    dieModifyConfig?: {
        mode: 'set' | 'adjust' | 'copy' | 'any';
        targetValue?: number;
        adjustRange?: { min: number; max: number };
    };
    selectCount: number;
    diceOwnerId?: PlayerId;
    targetOpponentDice: boolean;
}

interface DtDiceSelectMeta {
    dtType: 'selectDie';
    selectCount: number;
    diceOwnerId?: PlayerId;
    targetOpponentDice: boolean;
    allowRepeatedDieSelection?: boolean;
}

type DtDiceMeta = DtDiceModifyMeta | DtDiceSelectMeta;

const INTERACTION_CONFIRM_CLICK_SUPPRESS_MS = 350;
const dtUnit = buildBoardShellInlineUnitValue;
const buildBoardShellShadow = (...parts: string[]) => parts.join(', ');

const DESKTOP_DICE_TRAY_TOKENS = {
    diceSize: dtUnit(4),
    containerClassName: 'flex flex-col items-center shrink-0 relative transition-all duration-300 border',
    containerStyle: {
        width: dtUnit(5.8),
        padding: dtUnit(0.6),
        borderRadius: dtUnit(1.5),
        gap: dtUnit(0.5),
        borderWidth: dtUnit(0.18),
    } satisfies React.CSSProperties,
    glossClassName: 'hidden',
    rimClassName: 'absolute pointer-events-none border',
    rimStyle: {
        inset: dtUnit(0.2),
        borderRadius: dtUnit(1.25),
        borderWidth: dtUnit(0.1),
    } satisfies React.CSSProperties,
    shadowClassName: 'hidden',
    trayInnerClassName: 'flex flex-col items-center justify-center w-full',
    trayInnerStyle: {
        gap: dtUnit(0.5),
        padding: dtUnit(0.2),
    } satisfies React.CSSProperties,
    rowStyle: { gap: dtUnit(0.3) } satisfies React.CSSProperties,
    dieStyle: { gap: dtUnit(0.25) } satisfies React.CSSProperties,
    adjustButtonClassName: 'rounded-full flex items-center justify-center font-bold transition-all duration-150',
    adjustButtonStyle: {
        width: dtUnit(1.2),
        height: dtUnit(1.2),
        fontSize: dtUnit(0.8),
    } satisfies React.CSSProperties,
    lockedLabelClassName: 'min-w-max whitespace-nowrap font-black text-white bg-black/65 rounded uppercase tracking-wider shadow-sm border border-white/20',
    lockedLabelStyle: {
        fontSize: dtUnit(0.6),
        paddingInline: dtUnit(0.4),
        paddingBlock: dtUnit(0.1),
    } satisfies React.CSSProperties,
    selectedBadgeClassName: 'absolute bg-amber-500 rounded-full flex items-center justify-center z-30',
    selectedBadgeStyle: {
        width: dtUnit(1),
        height: dtUnit(1),
        top: dtUnit(-0.3),
        right: dtUnit(-0.3),
    } satisfies React.CSSProperties,
    selectedBadgeIconClassName: '',
};

const DESKTOP_DICE_ACTION_TOKENS = {
    containerClassName: 'grid grid-cols-2 items-stretch',
    containerStyle: {
        width: dtUnit(10.2),
        gap: dtUnit(0.4),
        height: dtUnit(2.5),
    } satisfies React.CSSProperties,
    buttonClassName: '!py-0 !min-h-0 flex items-center justify-center',
    buttonStyle: {
        paddingInline: dtUnit(0.5),
        borderRadius: dtUnit(0.5),
    } satisfies React.CSSProperties,
    interactionTextStyle: { fontSize: dtUnit(0.75) } satisfies React.CSSProperties,
    rollTextStyle: { fontSize: dtUnit(0.7) } satisfies React.CSSProperties,
    confirmTextStyle: { fontSize: dtUnit(0.7) } satisfies React.CSSProperties,
    dotClassName: 'rounded-full border border-black/30 shadow-sm transition-all duration-300 flex-shrink-0',
    dotStyle: {
        width: dtUnit(0.45),
        height: dtUnit(0.45),
    } satisfies React.CSSProperties,
    dotsContainerClassName: 'flex flex-col flex-wrap justify-center items-center shrink-0 content-center',
    dotsContainerStyle: {
        gap: dtUnit(0.15),
        height: dtUnit(1.8),
        marginLeft: dtUnit(0.3),
    } satisfies React.CSSProperties,
};

function getDtMeta(interaction?: InteractionDescriptor): DtDiceMeta | undefined {
    if (!interaction || interaction.kind !== 'multistep-choice') return undefined;
    const meta = (interaction.data as { meta?: DtDiceMeta } | undefined)?.meta;
    if (!meta?.dtType) return undefined;
    return meta;
}

function getCompletedDiceStepCount(interaction?: InteractionDescriptor, meta?: DtDiceMeta): number {
    if (!interaction || interaction.kind !== 'multistep-choice') return 0;
    const data = interaction.data as { completedSteps?: unknown; completedDieIds?: unknown } | undefined;
    if (typeof data?.completedSteps === 'number' && Number.isFinite(data.completedSteps)) {
        return Math.max(0, Math.floor(data.completedSteps));
    }
    if (!Array.isArray(data?.completedDieIds)) return 0;
    const completedDieIds = data.completedDieIds.filter((dieId): dieId is number => typeof dieId === 'number');
    if (meta?.dtType === 'selectDie' && meta.allowRepeatedDieSelection === true) {
        return completedDieIds.length;
    }
    return Array.from(new Set(completedDieIds)).length;
}

export const DiceTray = ({
    dice,
    rollCount,
    onToggleLock,
    currentPhase: _currentPhase,
    canInteract,
    isRolling,
    rerollingDiceIds,
    locale,
    interaction,
    multistepInteraction,
    isPassiveRerollMode,
    bonusDiceReroll,
}: {
    dice: Die[];
    rollCount: number;
    onToggleLock: (id: number) => void;
    currentPhase: TurnPhase;
    canInteract: boolean;
    isRolling: boolean;
    rerollingDiceIds?: number[];
    rerollAnimationSeq?: number;
    locale?: string;
    interaction?: InteractionDescriptor;
    multistepInteraction?: MultistepInteractionState<DiceModifyResult | DiceSelectResult>;
    isPassiveRerollMode?: boolean;
    bonusDiceReroll?: {
        canReroll: boolean;
        onReroll: (dieIndex: number) => void;
    };
}) => {
    const { t } = useTranslation('game-dicethrone');
    const decreaseLabel = t('decrease', { ns: 'common' });
    const increaseLabel = t('increase', { ns: 'common' });
    const {
        diceSize,
        containerClassName,
        containerStyle,
        glossClassName,
        rimClassName,
        rimStyle,
        shadowClassName,
        trayInnerClassName,
        trayInnerStyle,
        rowStyle,
        dieStyle,
        adjustButtonClassName,
        adjustButtonStyle,
        lockedLabelClassName,
        lockedLabelStyle,
        selectedBadgeClassName,
        selectedBadgeStyle,
        selectedBadgeIconClassName,
    } = DESKTOP_DICE_TRAY_TOKENS;

    const dtMeta = getDtMeta(interaction);
    const isInteractionMode = Boolean(dtMeta);
    const isModifyMode = dtMeta?.dtType === 'modifyDie';
    const isSelectMode = dtMeta?.dtType === 'selectDie';
    const dieModifyConfig = isModifyMode ? dtMeta.dieModifyConfig : undefined;
    const allowRepeatedDieSelection = isSelectMode && dtMeta?.allowRepeatedDieSelection === true;
    const diceOwnerId = dtMeta?.diceOwnerId;
    const isAnyMode = dieModifyConfig?.mode === 'any';
    const isAdjustMode = dieModifyConfig?.mode === 'adjust';
    const isBonusRerollMode = Boolean(bonusDiceReroll);
    const canRerollBonusDie = bonusDiceReroll?.canReroll === true;
    const adjustRange = dieModifyConfig?.adjustRange ?? { min: -1, max: 1 };

    const canInteractWithDie = (die: Die): boolean => {
        if (!isInteractionMode || !diceOwnerId) return true;
        return die.ownerId === undefined || die.ownerId === diceOwnerId;
    };

    const modifyResult = (isModifyMode && multistepInteraction?.result) as DiceModifyResult | null | undefined;
    const selectResult = (isSelectMode && multistepInteraction?.result) as DiceSelectResult | null | undefined;
    const totalAdjustment = modifyResult?.totalAdjustment ?? 0;
    const canAdjustDown = isAdjustMode && totalAdjustment > adjustRange.min;
    const canAdjustUp = isAdjustMode && totalAdjustment < adjustRange.max;

    const isSelected = React.useCallback((dieId: number): boolean => {
        if (isSelectMode) return selectResult?.selectedDiceIds.includes(dieId) ?? false;
        if (isModifyMode) return dieId in (modifyResult?.modifications ?? {});
        return false;
    }, [isModifyMode, isSelectMode, modifyResult?.modifications, selectResult?.selectedDiceIds]);

    const maxSelectCount = dtMeta?.selectCount ?? 1;
    const completedInteractionCount = getCompletedDiceStepCount(interaction, dtMeta);
    const currentSelectCount = isSelectMode
        ? completedInteractionCount + (selectResult?.selectedDiceIds.length ?? 0)
        : completedInteractionCount + (modifyResult?.modCount ?? 0);
    const canSelectMore = currentSelectCount < maxSelectCount;
    const canToggleDieLock = canInteract && rollCount > 0;
    const diceTrayStyle = isInteractionMode
        ? {
            ...containerStyle,
            backgroundColor: '#131820',
            boxShadow: buildBoardShellShadow(
                `0 ${dtUnit(0.26)} 0 #05070b`,
                `0 ${dtUnit(0.62)} 0 #5c3f0b`,
                `0 ${dtUnit(0.9)} ${dtUnit(1.25)} rgba(0,0,0,0.5)`,
            ),
        }
        : isPassiveRerollMode
            ? {
                ...containerStyle,
                backgroundColor: '#131820',
                boxShadow: buildBoardShellShadow(
                    `0 ${dtUnit(0.26)} 0 #05070b`,
                    `0 ${dtUnit(0.62)} 0 #0b4d38`,
                    `0 ${dtUnit(0.9)} ${dtUnit(1.25)} rgba(0,0,0,0.5)`,
                ),
            }
            : {
                ...containerStyle,
                backgroundColor: '#131820',
                boxShadow: buildBoardShellShadow(
                    `inset 0 0 0 ${dtUnit(0.1)} #53616f`,
                    `inset 0 ${dtUnit(-0.38)} 0 #07090d`,
                    `0 ${dtUnit(0.26)} 0 #05070b`,
                    `0 ${dtUnit(0.72)} 0 #080b10`,
                    `0 ${dtUnit(0.95)} ${dtUnit(1.3)} rgba(0,0,0,0.48)`,
                ),
            };

    const handleRailDieClick = (dieId: number) => {
        if (isRolling && !isInteractionMode && !isPassiveRerollMode && rollCount === 0) return;

        if (isPassiveRerollMode) {
            if (canInteract) {
                onToggleLock(dieId);
            }
            return;
        }

        if (isBonusRerollMode) {
            if (canRerollBonusDie) {
                bonusDiceReroll?.onReroll(dieId);
            }
            return;
        }

        if (isInteractionMode && !isAnyMode && multistepInteraction) {
            if (isSelectMode) {
                multistepInteraction.step({ action: 'toggle', dieId } as DiceSelectStep);
            } else if (isModifyMode) {
                const die = dice.find((candidate) => candidate.id === dieId);
                if (!die) return;
                const alreadySelected = isSelected(dieId);
                if (alreadySelected || canSelectMore) {
                    multistepInteraction.step({ action: 'select', dieId, dieValue: die.value } as DiceModifyStep);
                }
            }
        } else if (canToggleDieLock) {
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
                ${isInteractionMode
                    ? 'bg-[#131820] border-amber-300 ring-2 ring-amber-500'
                    : isPassiveRerollMode
                        ? 'bg-[#131820] border-emerald-300 ring-2 ring-emerald-500'
                        : 'bg-[#131820] border-[#c8d3df]'}
            `}
            data-tutorial-id="dice-tray"
            data-testid="dicethrone-2d-dice-tray"
            data-current-phase={_currentPhase}
            data-dice-count={dice.length}
            style={diceTrayStyle}
        >
            <div className={glossClassName} />
            <div
                className={`${rimClassName} ${isInteractionMode ? 'border-amber-100/80' : 'border-slate-50/60'} `}
                style={rimStyle}
            />
            <div className={shadowClassName} />

            <div className={trayInnerClassName} style={trayInnerStyle}>
                {dice.map((die) => {
                    const selected = isSelected(die.id);
                    const isModified = isModifyMode && die.id in (modifyResult?.modifications ?? {});
                    const canModifyDie = canInteractWithDie(die);
                    const showAdjustButtons = isInteractionMode && isAdjustMode && canModifyDie;
                    const showAnyModeButtons = isInteractionMode && isAnyMode && canModifyDie
                        && (isModified || currentSelectCount < maxSelectCount);
                    const isInactiveDie = isInteractionMode && !canModifyDie;
                    const isReadOnlyDisplayDie = !isInteractionMode
                        && Boolean(die.displayOnly)
                        && !isBonusRerollMode;
                    const canClickInteractionDie = isAnyMode
                        ? false
                        : !isInactiveDie && (
                            allowRepeatedDieSelection
                                ? canSelectMore
                                : (canSelectMore || selected)
                        );
                    const clickable = isReadOnlyDisplayDie
                        ? false
                        : isInteractionMode
                        ? canClickInteractionDie
                        : (isPassiveRerollMode
                            ? canInteract
                            : isBonusRerollMode
                                ? canRerollBonusDie
                                : canToggleDieLock);
                    const displayValue = (isAnyMode || isAdjustMode)
                        ? (modifyResult?.modifications[die.id] ?? die.value)
                        : die.value;

                    return (
                        <div key={die.id} className="relative flex items-center" style={rowStyle}>
                            {(showAdjustButtons || showAnyModeButtons) && (
                                <button
                                    type="button"
                                    data-testid={`die-adjust-decrement-${die.id}`}
                                    aria-label={`${decreaseLabel} ${displayValue}`}
                                    onClick={() => handleAdjust(die.id, -1, die.value)}
                                    disabled={displayValue <= 1 || (showAdjustButtons && !canAdjustDown)}
                                    className={`${adjustButtonClassName} ${(displayValue <= 1 || (showAdjustButtons && !canAdjustDown))
                                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                        : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg hover:scale-110'
                                        }`}
                                    style={adjustButtonStyle}
                                >
                                    -
                                </button>
                            )}

                            <div className="relative flex flex-col items-center" style={dieStyle} data-testid="die">
                                <div
                                    onClick={() => clickable && handleRailDieClick(die.id)}
                                    data-testid={`die-button-${die.id}`}
                                    data-selected={selected ? 'true' : 'false'}
                                    data-clickable={clickable ? 'true' : 'false'}
                                    data-display-value={displayValue}
                                    data-definition-id={die.definitionId ?? ''}
                                    data-owner-id={die.ownerId ?? ''}
                                    data-display-only={die.displayOnly ? 'true' : 'false'}
                                    className={`
                                        relative flex-shrink-0 group transition-all duration-200
                                        ${!isInteractionMode && die.isKept ? 'opacity-80' : ''}
                                        ${!clickable && !showAdjustButtons && !showAnyModeButtons ? (isReadOnlyDisplayDie ? 'cursor-default' : 'cursor-not-allowed opacity-50') : ''}
                                        ${clickable ? 'cursor-pointer hover:scale-110' : ''}
                                        ${selected ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900 rounded-full scale-105' : ''}
                                    `}
                                >
                                    <div className="pointer-events-none">
                                        <Dice2D
                                            value={displayValue}
                                            isRolling={(isRolling && !die.isKept) || (rerollingDiceIds?.includes(die.id) ?? false)}
                                            size={diceSize}
                                            locale={locale}
                                            characterId={resolveCharacterIdFromDiceDefinitionId(die.definitionId)}
                                            definitionId={die.definitionId}
                                        />
                                    </div>
                                    {!isInteractionMode && die.isKept && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                            <div className={lockedLabelClassName} style={lockedLabelStyle}>
                                                {t('dice.locked')}
                                            </div>
                                        </div>
                                    )}
                                    {selected && !showAdjustButtons && !showAnyModeButtons && (
                                        <div className={selectedBadgeClassName} style={selectedBadgeStyle}>
                                            <Check size={12} className={`text-white ${selectedBadgeIconClassName}`} strokeWidth={3} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {(showAdjustButtons || showAnyModeButtons) && (
                                <button
                                    type="button"
                                    data-testid={`die-adjust-increment-${die.id}`}
                                    aria-label={`${increaseLabel} ${displayValue}`}
                                    onClick={() => handleAdjust(die.id, 1, die.value)}
                                    disabled={displayValue >= 6 || (showAdjustButtons && !canAdjustUp)}
                                    className={`${adjustButtonClassName} ${(displayValue >= 6 || (showAdjustButtons && !canAdjustUp))
                                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                        : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg hover:scale-110'
                                        }`}
                                    style={adjustButtonStyle}
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
    isCompareRoll = false,
    onRoll,
    onConfirm,
    currentPhase,
    canInteract,
    isRolling,
    setIsRolling,
    interaction,
    multistepInteraction,
    isBonusDiceSettlement = false,
}: {
    rollCount: number;
    rollLimit: number;
    rollConfirmed: boolean;
    isCompareRoll?: boolean;
    onRoll: () => void;
    onConfirm: () => void;
    currentPhase: TurnPhase;
    canInteract: boolean;
    isRolling: boolean;
    setIsRolling: (isRolling: boolean) => void;
    interaction?: InteractionDescriptor;
    multistepInteraction?: MultistepInteractionState<DiceModifyResult | DiceSelectResult>;
    isBonusDiceSettlement?: boolean;
}) => {
    const { t } = useTranslation('game-dicethrone');
    const actionTokens = DESKTOP_DICE_ACTION_TOKENS;
    const isRollPhase = currentPhase === 'offensiveRoll' || currentPhase === 'targetingRoll' || currentPhase === 'defensiveRoll';
    const dtMeta = getDtMeta(interaction);
    const isInteractionMode = Boolean(dtMeta);

    const MIN_ROLL_ANIMATION_MS = 800;
    const rollStartTimeRef = useRef<number>(0);
    const rollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevRollCountRef = useRef(rollCount);
    const suppressPlainConfirmUntilRef = useRef(0);

    useEffect(() => {
        if (rollCount !== prevRollCountRef.current) {
            prevRollCountRef.current = rollCount;
            if (isRolling) {
                if (rollTimeoutRef.current) {
                    clearTimeout(rollTimeoutRef.current);
                    rollTimeoutRef.current = null;
                }
                const elapsed = Date.now() - rollStartTimeRef.current;
                const remaining = MIN_ROLL_ANIMATION_MS - elapsed;
                if (remaining <= 0) {
                    setIsRolling(false);
                } else {
                    rollTimeoutRef.current = setTimeout(() => {
                        rollTimeoutRef.current = null;
                        setIsRolling(false);
                    }, remaining);
                }
            }
        }
    }, [rollCount, isRolling, setIsRolling]);

    useEffect(() => () => {
        if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
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
        if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
        rollTimeoutRef.current = setTimeout(() => {
            rollTimeoutRef.current = null;
            setIsRolling(false);
        }, 5000);
    };

    const handleConfirmClick = () => {
        if (isInteractionMode && multistepInteraction) {
            suppressPlainConfirmUntilRef.current = Date.now() + INTERACTION_CONFIRM_CLICK_SUPPRESS_MS;
            multistepInteraction.confirm();
            return;
        }
        if (Date.now() < suppressPlainConfirmUntilRef.current) {
            return;
        }
        onConfirm();
    };

    const renderRollDots = () => {
        const dots = [];
        for (let i = 0; i < rollLimit; i += 1) {
            dots.push(
                <div
                    key={i}
                    className={`${actionTokens.dotClassName} ${i < rollCount ? 'bg-slate-900/60' : 'bg-white'}`}
                    style={actionTokens.dotStyle}
                />
            );
        }
        return <div className={actionTokens.dotsContainerClassName} style={actionTokens.dotsContainerStyle}>{dots}</div>;
    };

    const leftDisabled = isInteractionMode
        ? false
        : (!isRollPhase || !canInteract || rollConfirmed || rollCount >= rollLimit);
    const leftVariant = isInteractionMode
        ? 'secondary' as const
        : (isRollPhase && canInteract && !rollConfirmed && rollCount < rollLimit ? 'primary' as const : 'secondary' as const);
    const rightDisabled = isBonusDiceSettlement
        ? !canInteract
        : isInteractionMode
        ? !(multistepInteraction?.canConfirm ?? false)
        : isCompareRoll
        ? (!canInteract || isRolling)
        : (rollConfirmed || rollCount === 0 || !canInteract || isRolling);
    const rightVariant = isBonusDiceSettlement
        ? (canInteract ? 'primary' as const : 'secondary' as const)
        : isInteractionMode
        ? 'primary' as const
        : isCompareRoll
        ? (canInteract ? 'primary' as const : 'secondary' as const)
        : (rollConfirmed ? 'glass' as const : 'secondary' as const);

    return (
        <div
            className={isBonusDiceSettlement ? `${actionTokens.containerClassName} grid-cols-1` : actionTokens.containerClassName}
            style={actionTokens.containerStyle}
        >
            {!isBonusDiceSettlement && (
            <GameButton
                onClick={handleRollClick}
                disabled={leftDisabled}
                variant={leftVariant}
                size="sm"
                clickSoundKey={isInteractionMode ? undefined : null}
                className={clsx(
                    `!py-0 flex items-center justify-between h-full whitespace-nowrap overflow-hidden ${actionTokens.buttonClassName}`,
                    !isInteractionMode && isRolling && 'animate-pulse',
                )}
                style={actionTokens.buttonStyle}
                data-tutorial-id={isInteractionMode ? undefined : 'dice-roll-button'}
            >
                {isInteractionMode ? (
                    <span className="flex-1 text-center font-black" style={actionTokens.interactionTextStyle}>{t('common.cancel')}</span>
                ) : (
                    <>
                        <div className="flex-1 truncate text-center font-black tracking-tighter" style={actionTokens.rollTextStyle}>
                            {isRolling ? t('dice.rolling') : t('dice.roll_action')}
                        </div>
                        {!isRolling && renderRollDots()}
                    </>
                )}
            </GameButton>
            )}

            <GameButton
                onClick={handleConfirmClick}
                disabled={rightDisabled}
                variant={rightVariant}
                size="sm"
                icon={<Check className="h-[1em] w-[1em] shrink-0" />}
                clickSoundKey={isInteractionMode ? undefined : null}
                className={clsx(
                    `flex items-center justify-center h-full whitespace-nowrap overflow-hidden font-black !py-0 ${actionTokens.buttonClassName}`,
                    !isBonusDiceSettlement && !isInteractionMode && rollConfirmed && '!text-white/60',
                )}
                style={{ ...actionTokens.buttonStyle, ...actionTokens.confirmTextStyle }}
                data-testid={isInteractionMode ? 'dice-interaction-confirm-button' : undefined}
                data-tutorial-id={isInteractionMode ? undefined : 'dice-confirm-button'}
            >
                {isBonusDiceSettlement || isInteractionMode || isCompareRoll
                    ? t('common.confirm')
                    : (rollConfirmed ? t('dice.confirmed') : t('dice.confirm'))}
            </GameButton>
        </div>
    );
};
