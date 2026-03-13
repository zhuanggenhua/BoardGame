import React, { useMemo } from 'react';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { MousePointerClick } from 'lucide-react';
import type { AbilityCard, Die, TurnPhase } from '../types';
import type { InteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import type { MultistepChoiceData } from '../../../engine/systems/InteractionSystem';
import { useMultistepInteraction } from '../../../engine/systems/useMultistepInteraction';
import type { DiceModifyResult, DiceModifyStep, DiceSelectResult, DiceSelectStep } from '../domain/systems';
import {
    diceModifyReducer, diceModifyToCommands,
    diceSelectReducer, diceSelectToCommands,
} from '../domain/systems';
import { DiceActions, DiceTray, getDtMeta } from './DiceTray';
import { DiscardPile } from './DiscardPile';
import { GameButton } from './components/GameButton';
import { UI_Z_INDEX } from '../../../core';
import { ActiveModifierBadge } from './ActiveModifierBadge';
import { AttackBonusDamageDisplay } from './AttackBonusDamageDisplay';
import type { ActiveModifier } from '../hooks/useActiveModifiers';
import { PassiveAbilityPanel, type PassiveAbilityPanelProps } from './PassiveAbilityPanel';
import { useMobileViewport } from '../../../hooks/ui/useMobileViewport';

export const RightSidebar = ({
    dice,
    rollCount,
    rollLimit,
    rollConfirmed,
    currentPhase,
    canInteractDice,
    isRolling,
    setIsRolling,
    rerollingDiceIds,
    setRerollingDiceIds,
    locale,
    onToggleLock,
    onRoll,
    onConfirm,
    showAdvancePhaseButton,
    advanceLabel,
    isAdvanceButtonEnabled,
    onAdvance,
    discardPileRef,
    discardCards,
    onInspectRecentCards,
    canUndoDiscard,
    onUndoDiscard,
    discardHighlighted,
    sellButtonVisible,
    interaction,
    dispatch,
    activeModifiers,
    attackModifierBonusDamage,
    passiveAbilityProps,
}: {
    dice: Die[];
    rollCount: number;
    rollLimit: number;
    rollConfirmed: boolean;
    currentPhase: TurnPhase;
    canInteractDice: boolean;
    isRolling: boolean;
    setIsRolling: (isRolling: boolean) => void;
    rerollingDiceIds?: number[];
    setRerollingDiceIds: (ids: number[]) => void;
    locale?: string;
    onToggleLock: (id: number) => void;
    onRoll: () => void;
    onConfirm: () => void;
    showAdvancePhaseButton: boolean;
    advanceLabel: string;
    isAdvanceButtonEnabled: boolean;
    onAdvance: () => void;
    discardPileRef: RefObject<HTMLDivElement | null>;
    discardCards: AbilityCard[];
    onInspectRecentCards?: (cards: AbilityCard[]) => void;
    canUndoDiscard: boolean;
    onUndoDiscard: () => void;
    discardHighlighted: boolean;
    sellButtonVisible: boolean;
    interaction?: InteractionDescriptor;
    dispatch: (type: string, payload?: unknown) => void;
    activeModifiers?: ActiveModifier[];
    attackModifierBonusDamage?: number;
    passiveAbilityProps?: Omit<PassiveAbilityPanelProps, never> | null;
}) => {
    const isDiceMultistep = interaction?.kind === 'multistep-choice' &&
        ((interaction.data as any)?.meta?.dtType === 'modifyDie' ||
         (interaction.data as any)?.meta?.dtType === 'selectDie');

    const diceInteraction = useMemo(() => {
        if (!isDiceMultistep || !interaction) return undefined;
        const data = interaction.data as MultistepChoiceData<DiceModifyStep | DiceSelectStep, DiceModifyResult | DiceSelectResult>;
        if (typeof data?.localReducer === 'function' && typeof data?.toCommands === 'function') {
            return interaction as InteractionDescriptor<MultistepChoiceData<DiceModifyStep | DiceSelectStep, DiceModifyResult | DiceSelectResult>>;
        }
        const meta = (data as any)?.meta;
        if (!meta) return undefined;
        let hydratedData: MultistepChoiceData<DiceModifyStep | DiceSelectStep, DiceModifyResult | DiceSelectResult>;
        if (meta.dtType === 'modifyDie') {
            const config = meta.dieModifyConfig;
            const isManualConfirmMode = config?.mode === 'any' || config?.mode === 'adjust';
            hydratedData = {
                ...data,
                initialResult: data.initialResult ?? { modifications: {}, modCount: 0, totalAdjustment: 0 },
                localReducer: (current: any, step: any) => diceModifyReducer(current, step, config),
                toCommands: diceModifyToCommands as any,
                maxSteps: isManualConfirmMode ? undefined : data.maxSteps,
                minSteps: isManualConfirmMode ? 1 : data.minSteps,
            };
        } else {
            hydratedData = {
                ...data,
                initialResult: data.initialResult ?? { selectedDiceIds: [] },
                localReducer: diceSelectReducer as any,
                toCommands: diceSelectToCommands as any,
            };
        }
        return {
            ...interaction,
            data: hydratedData,
        } as InteractionDescriptor<MultistepChoiceData<DiceModifyStep | DiceSelectStep, DiceModifyResult | DiceSelectResult>>;
    }, [isDiceMultistep, interaction]);

    const multistepInteraction = useMultistepInteraction(diceInteraction, dispatch);

    const { t } = useTranslation('game-dicethrone');
    const isMobileNarrowViewport = useMobileViewport();
    const actionRailWidthClassName = isMobileNarrowViewport
        ? 'w-[clamp(6rem,13vw,6.8rem)]'
        : 'w-[10.2vw]';
    const sidebarFrameClassName = isMobileNarrowViewport
        ? `absolute right-[clamp(0.58rem,0.75vw,0.8rem)] top-0 bottom-[clamp(0.62rem,0.82vw,0.8rem)] ${actionRailWidthClassName} flex flex-col items-center pointer-events-auto`
        : 'absolute right-[1.5vw] top-0 bottom-[1.5vw] w-[15vw] flex flex-col items-center pointer-events-auto';
    const advanceButtonSizeClassName = isMobileNarrowViewport
        ? '!text-[clamp(0.58rem,1.28vw,0.72rem)] !py-[clamp(0.38rem,0.56vw,0.48rem)] !px-[clamp(0.24rem,0.36vw,0.34rem)] !min-h-[clamp(2rem,4vw,2.2rem)] !rounded-[0.65rem] leading-tight'
        : '!text-[0.75vw] !py-[0.7vw]';
    const stackGapClassName = isMobileNarrowViewport ? 'gap-[clamp(0.22rem,0.3vw,0.28rem)]' : 'gap-[0.75vw]';
    const modifierTopClassName = isMobileNarrowViewport ? '-top-[1.45vw]' : '-top-[2.2vw]';
    const bonusTopClassName = isMobileNarrowViewport ? '-top-[2.45vw]' : '-top-[3.8vw]';
    const hintOffsetClassName = isMobileNarrowViewport ? 'mr-[0.32vw]' : 'mr-[0.6vw]';
    const hintBubbleClassName = isMobileNarrowViewport
        ? 'flex items-center gap-[0.22vw] bg-amber-950/90 border border-amber-500/35 rounded-[0.34vw] px-[0.34vw] py-[0.2vw] shadow-lg shadow-amber-900/25 backdrop-blur-sm whitespace-nowrap'
        : 'flex items-center gap-[0.4vw] bg-amber-950/95 border border-amber-500/50 rounded-[0.5vw] px-[0.6vw] py-[0.4vw] shadow-lg shadow-amber-900/40 backdrop-blur-sm whitespace-nowrap';
    const hintIconClassName = isMobileNarrowViewport ? 'w-[0.64vw] h-[0.64vw] text-amber-400 shrink-0' : 'w-[1vw] h-[1vw] text-amber-400 shrink-0';
    const hintTextClassName = isMobileNarrowViewport ? 'text-[0.52vw] text-amber-200 font-medium leading-snug tracking-[0.04em]' : 'text-[0.75vw] text-amber-200 font-medium leading-snug';

    const interactionHint = useMemo(() => {
        if (!isDiceMultistep || !interaction) return null;
        const dtMeta = getDtMeta(interaction);
        if (!dtMeta) return null;

        const isModifyMode = dtMeta.dtType === 'modifyDie';
        const isSelectMode = dtMeta.dtType === 'selectDie';
        const config = isModifyMode ? (dtMeta as any).dieModifyConfig : undefined;
        const mode = config?.mode as string | undefined;

        const result = multistepInteraction?.result as any;
        const modCount = result?.modCount ?? 0;
        const selectCount = result?.selectedDiceIds?.length ?? 0;
        const currentCount = isSelectMode ? selectCount : modCount;
        const maxCount = dtMeta.selectCount ?? 1;

        if (isModifyMode && mode === 'copy') {
            if (currentCount === 0) return t('interaction.hint_copy_step1');
            if (currentCount === 1) {
                const sourceValue = Object.values(result?.modifications ?? {})[0];
                return t('interaction.hint_copy_step2', { value: sourceValue });
            }
            return t('interaction.hint_done');
        }
        if (isModifyMode && mode === 'set') {
            if (currentCount >= maxCount) return t('interaction.hint_done');
            return t('interaction.hint_set', { value: config?.targetValue ?? '?' });
        }
        if (isModifyMode && mode === 'adjust') return t('interaction.hint_adjust');
        if (isModifyMode && mode === 'any') {
            if (currentCount >= maxCount) return t('interaction.hint_done');
            return t('interaction.hint_any');
        }
        if (isSelectMode) {
            if (currentCount >= maxCount) return t('interaction.hint_done');
            const key = dtMeta.targetOpponentDice ? 'interaction.hint_select_opponent' : 'interaction.hint_select';
            return t(key, { current: currentCount, max: maxCount });
        }
        return null;
    }, [isDiceMultistep, interaction, multistepInteraction?.result, t]);

    return (
        <div
            className={sidebarFrameClassName}
            style={{ zIndex: UI_Z_INDEX.hud }}
        >
            <div className="flex-grow" />
            <div className={`relative w-full flex flex-col items-center ${stackGapClassName}`}>
                {activeModifiers && activeModifiers.length > 0 && (
                    <div className={`absolute ${modifierTopClassName} left-1/2 -translate-x-1/2 z-10`}>
                        <ActiveModifierBadge modifiers={activeModifiers} />
                    </div>
                )}
                {attackModifierBonusDamage && attackModifierBonusDamage > 0 && (
                    <div className={`absolute ${bonusTopClassName} left-1/2 -translate-x-1/2 z-10`}>
                        <AttackBonusDamageDisplay bonusDamage={attackModifierBonusDamage} />
                    </div>
                )}
                <div className="relative">
                    {isDiceMultistep && interactionHint && (
                        <div className={`absolute right-full top-1/2 -translate-y-1/2 ${hintOffsetClassName} z-10 pointer-events-none`}>
                            <div className={hintBubbleClassName}>
                                <MousePointerClick className={hintIconClassName} />
                                <span className={hintTextClassName}>
                                    {interactionHint}
                                </span>
                            </div>
                        </div>
                    )}
                    <DiceTray
                        dice={dice}
                        onToggleLock={(id) => {
                            if (!canInteractDice) return;
                            onToggleLock(id);
                        }}
                        currentPhase={currentPhase}
                        canInteract={canInteractDice}
                        isRolling={isRolling}
                        rerollingDiceIds={rerollingDiceIds}
                        locale={locale}
                        interaction={isDiceMultistep ? interaction : undefined}
                        multistepInteraction={isDiceMultistep ? multistepInteraction : undefined}
                        isPassiveRerollMode={!!passiveAbilityProps?.rerollSelectingAction}
                    />
                </div>
                <DiceActions
                    rollCount={rollCount}
                    rollLimit={rollLimit}
                    rollConfirmed={rollConfirmed}
                    onRoll={onRoll}
                    onConfirm={onConfirm}
                    currentPhase={currentPhase}
                    canInteract={canInteractDice}
                    isRolling={isRolling}
                    setIsRolling={setIsRolling}
                    interaction={isDiceMultistep ? interaction : undefined}
                    multistepInteraction={isDiceMultistep ? multistepInteraction : undefined}
                    setRerollingDiceIds={setRerollingDiceIds}
                />
                <div className={`w-full flex justify-center ${showAdvancePhaseButton ? '' : 'invisible pointer-events-none'}`}>
                    <GameButton
                        onClick={onAdvance}
                        disabled={!isAdvanceButtonEnabled}
                        variant={isAdvanceButtonEnabled ? "primary" : "secondary"}
                        clickSoundKey={null}
                        className={`${actionRailWidthClassName} ${advanceButtonSizeClassName}`}
                        size="sm"
                        data-tutorial-id="advance-phase-button"
                    >
                        {advanceLabel}
                    </GameButton>
                </div>
                {passiveAbilityProps && passiveAbilityProps.passives.length > 0 && (
                    <PassiveAbilityPanel {...passiveAbilityProps} />
                )}
                <div className={`${actionRailWidthClassName} flex justify-center`}>
                    <DiscardPile
                        ref={discardPileRef}
                        cards={discardCards}
                        locale={locale}
                        onInspectRecent={onInspectRecentCards}
                        canUndo={canUndoDiscard}
                        onUndo={onUndoDiscard}
                        isHighlighted={discardHighlighted}
                        showSellButton={sellButtonVisible}
                    />
                </div>
            </div>
        </div>
    );
};
