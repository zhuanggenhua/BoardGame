import React, { useMemo } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { HeartCrack, MousePointerClick } from 'lucide-react';
import type { AbilityCard, Die, PlayerId, TurnPhase } from '../types';
import type { InteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import type { MultistepInteractionState } from '../../../engine/systems/useMultistepInteraction';
import type { DiceModifyResult, DiceSelectResult } from '../domain/systems';
import { DiceActions, DiceTray } from './DiceTray';
import { DiscardPile } from './DiscardPile';
import { GameButton } from './components/GameButton';
import { UI_Z_INDEX } from '../../../core';
import { ActiveModifierBadge } from './ActiveModifierBadge';
import type { ActiveModifier } from '../hooks/useActiveModifiers';
import { PassiveAbilityPanel, type PassiveAbilityPanelProps } from './PassiveAbilityPanel';
import { buildBoardShellInlineUnitValue } from '../../../shared/runtimeLayoutUnits';

type SidebarDiceMeta = {
    dtType?: 'modifyDie' | 'selectDie';
    selectCount?: number;
    diceOwnerId?: PlayerId;
    targetOpponentDice?: boolean;
    allowRepeatedDieSelection?: boolean;
    dieModifyConfig?: {
        mode?: 'set' | 'adjust' | 'copy' | 'any';
        targetValue?: number;
    };
};

type DamageSummary = {
    currentDamage: number;
    originalDamage?: number;
};

const getSidebarDiceMeta = (interaction?: InteractionDescriptor): SidebarDiceMeta | undefined => {
    if (!interaction || interaction.kind !== 'multistep-choice') return undefined;
    const meta = (interaction.data as { meta?: SidebarDiceMeta } | undefined)?.meta;
    if (!meta?.dtType) return undefined;
    return meta;
};

const getCompletedDiceStepCount = (interaction?: InteractionDescriptor, meta?: SidebarDiceMeta): number => {
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
};

export const RightSidebar = ({
    dice,
    rollCount,
    rollLimit,
    rollConfirmed,
    isCompareRoll = false,
    currentPhase,
    canInteractDice,
    isRolling,
    setIsRolling,
    rerollingDiceIds,
    rerollAnimationSeq,
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
    multistepInteraction,
    showDiceTray = true,
    showDiceActions = true,
    isBonusDiceSettlement = false,
    canRerollBonusDice = false,
    onRerollBonusDice,
    activeModifiers,
    attackModifierBonusDamage,
    damageSummary,
    passiveAbilityProps,
    rootPlayerId,
    teamIdByPlayerId,
}: {
    dice: Die[];
    rollCount: number;
    rollLimit: number;
    rollConfirmed: boolean;
    isCompareRoll?: boolean;
    currentPhase: TurnPhase;
    canInteractDice: boolean;
    isRolling: boolean;
    setIsRolling: (isRolling: boolean) => void;
    rerollingDiceIds?: number[];
    rerollAnimationSeq?: number;
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
    multistepInteraction?: MultistepInteractionState<DiceModifyResult | DiceSelectResult>;
    showDiceTray?: boolean;
    showDiceActions?: boolean;
    isBonusDiceSettlement?: boolean;
    canRerollBonusDice?: boolean;
    onRerollBonusDice?: (dieIndex: number) => void;
    activeModifiers?: ActiveModifier[];
    attackModifierBonusDamage?: number;
    damageSummary?: DamageSummary;
    passiveAbilityProps?: Omit<PassiveAbilityPanelProps, never> | null;
    rootPlayerId: PlayerId;
    teamIdByPlayerId?: Record<PlayerId, string>;
}) => {
    const isDiceMultistep = Boolean(getSidebarDiceMeta(interaction));

    const { t } = useTranslation('game-dicethrone');
    const sidebarFrameStyle: CSSProperties = {
        zIndex: UI_Z_INDEX.hud,
        right: buildBoardShellInlineUnitValue(1.5),
        bottom: buildBoardShellInlineUnitValue(1.5),
        width: buildBoardShellInlineUnitValue(15),
    };
    const stackStyle: CSSProperties = {
        gap: buildBoardShellInlineUnitValue(0.75),
    };
    const diceTrayFrameStyle: CSSProperties = {
        width: buildBoardShellInlineUnitValue(5.8),
    };
    const actionRailStyle: CSSProperties = {
        width: buildBoardShellInlineUnitValue(10.2),
    };
    const advanceButtonStyle: CSSProperties = {
        width: buildBoardShellInlineUnitValue(10.2),
        height: buildBoardShellInlineUnitValue(2.5),
        minHeight: 0,
        paddingInline: buildBoardShellInlineUnitValue(0.5),
        paddingBlock: 0,
        borderRadius: buildBoardShellInlineUnitValue(0.5),
        fontSize: buildBoardShellInlineUnitValue(0.75),
    };
    const modifierBadgeRowStyle: CSSProperties = {
        zIndex: UI_Z_INDEX.hint,
        marginBottom: buildBoardShellInlineUnitValue(0.55),
        gap: buildBoardShellInlineUnitValue(0.35),
    };
    const hintContainerStyle: CSSProperties = {
        marginRight: buildBoardShellInlineUnitValue(0.6),
    };
    const hintBubbleStyle: CSSProperties = {
        maxWidth: buildBoardShellInlineUnitValue(8.8),
        gap: buildBoardShellInlineUnitValue(0.4),
        borderRadius: buildBoardShellInlineUnitValue(0.5),
        paddingInline: buildBoardShellInlineUnitValue(0.6),
        paddingBlock: buildBoardShellInlineUnitValue(0.4),
    };
    const hintIconStyle: CSSProperties = {
        width: buildBoardShellInlineUnitValue(1),
        height: buildBoardShellInlineUnitValue(1),
    };
    const hintTextStyle: CSSProperties = {
        fontSize: buildBoardShellInlineUnitValue(0.75),
    };
    const hasCurrentDamageSummary = typeof damageSummary?.currentDamage === 'number' && Number.isFinite(damageSummary.currentDamage);
    const hasModifierBadgeRow = Boolean(
        (activeModifiers && activeModifiers.length > 0)
        || (attackModifierBonusDamage && attackModifierBonusDamage > 0),
    );
    const interactionHint = useMemo(() => {
        if (!isDiceMultistep || !interaction) return null;
        const dtMeta = getSidebarDiceMeta(interaction);
        if (!dtMeta) return null;

        const isModifyMode = dtMeta.dtType === 'modifyDie';
        const isSelectMode = dtMeta.dtType === 'selectDie';
        const config = isModifyMode ? dtMeta.dieModifyConfig : undefined;
        const mode = config?.mode;

        const modifyResult = multistepInteraction?.result as DiceModifyResult | undefined;
        const selectResult = multistepInteraction?.result as DiceSelectResult | undefined;
        const modCount = modifyResult?.modCount ?? 0;
        const selectCount = selectResult?.selectedDiceIds?.length ?? 0;
        const completedCount = getCompletedDiceStepCount(interaction, dtMeta);
        const currentCount = completedCount + (isSelectMode ? selectCount : modCount);
        const maxCount = dtMeta.selectCount ?? 1;

        if (isModifyMode && mode === 'copy') {
            if (currentCount === 0) return t('interaction.hint_copy_step1');
            if (currentCount === 1) {
                const sourceValue = Object.values(modifyResult?.modifications ?? {})[0];
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
            let key = dtMeta.targetOpponentDice ? 'interaction.hint_select_opponent' : 'interaction.hint_select';
            if (dtMeta.diceOwnerId) {
                const ownerTeamId = teamIdByPlayerId?.[dtMeta.diceOwnerId];
                const rootTeamId = teamIdByPlayerId?.[rootPlayerId];
                if (dtMeta.diceOwnerId === rootPlayerId) {
                    key = 'interaction.hint_select';
                } else if (ownerTeamId && rootTeamId && ownerTeamId === rootTeamId) {
                    key = 'interaction.hint_select_ally';
                } else {
                    key = 'interaction.hint_select_opponent';
                }
            }
            return t(key, { current: currentCount, max: maxCount });
        }
        return null;
    }, [interaction, isDiceMultistep, multistepInteraction?.result, rootPlayerId, t, teamIdByPlayerId]);

    return (
        <div
            className="absolute top-0 flex flex-col items-center pointer-events-auto"
            style={sidebarFrameStyle}
            data-player-seat-anchor={rootPlayerId}
        >
            <div className="flex-grow" />
            <div className="relative w-full flex flex-col items-center" style={stackStyle}>
                {showDiceTray && (
                <div className="relative" style={diceTrayFrameStyle}>
                    {hasModifierBadgeRow ? (
                        <div
                            className="pointer-events-none absolute inset-x-0 bottom-full flex items-center justify-center whitespace-nowrap"
                            style={modifierBadgeRowStyle}
                        >
                            {activeModifiers && activeModifiers.length > 0 && (
                                <ActiveModifierBadge
                                    modifiers={activeModifiers}
                                    bonusDamage={attackModifierBonusDamage ?? 0}
                                />
                            )}
                        </div>
                    ) : null}
                    {hasCurrentDamageSummary && (
                        <div
                            className="pointer-events-none absolute top-0 z-20"
                            data-testid="current-total-damage-badge-anchor"
                            data-placement="dice-tray-left-top-outside"
                            style={{
                                zIndex: UI_Z_INDEX.hint,
                                right: `calc(100% + ${buildBoardShellInlineUnitValue(0.35)})`,
                            }}
                        >
                            <CurrentTotalDamageBadge summary={damageSummary} />
                        </div>
                    )}
                    {isDiceMultistep && interactionHint && (
                        <div
                            className="absolute right-full top-1/2 -translate-y-1/2 z-10 pointer-events-none"
                            style={hintContainerStyle}
                        >
                            <div
                                className="flex min-w-0 items-center overflow-hidden border border-amber-500/50 bg-amber-950/95 shadow-lg shadow-amber-900/40 backdrop-blur-sm whitespace-nowrap"
                                style={hintBubbleStyle}
                            >
                                <MousePointerClick className="text-amber-400 shrink-0" style={hintIconStyle} />
                                <span
                                    className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-amber-200 font-medium leading-snug"
                                    style={hintTextStyle}
                                >
                                    {interactionHint}
                                </span>
                            </div>
                        </div>
                    )}
                    <DiceTray
                        dice={dice}
                        rollCount={rollCount}
                        onToggleLock={(id) => {
                            if (!canInteractDice) return;
                            onToggleLock(id);
                        }}
                        currentPhase={currentPhase}
                        canInteract={canInteractDice}
                        isRolling={isRolling}
                        rerollingDiceIds={rerollingDiceIds}
                        rerollAnimationSeq={rerollAnimationSeq}
                        locale={locale}
                        interaction={isDiceMultistep ? interaction : undefined}
                        multistepInteraction={isDiceMultistep ? multistepInteraction : undefined}
                        isPassiveRerollMode={!!passiveAbilityProps?.rerollSelectingAction}
                        bonusDiceReroll={onRerollBonusDice ? {
                            canReroll: canRerollBonusDice,
                            onReroll: onRerollBonusDice,
                        } : undefined}
                    />
                </div>
                )}
                {showDiceActions && (
                    <DiceActions
                        rollCount={rollCount}
                        rollLimit={rollLimit}
                        rollConfirmed={rollConfirmed}
                        isCompareRoll={isCompareRoll}
                        onRoll={onRoll}
                        onConfirm={onConfirm}
                        currentPhase={currentPhase}
                        canInteract={canInteractDice}
                        isRolling={isRolling}
                        setIsRolling={setIsRolling}
                        interaction={isDiceMultistep ? interaction : undefined}
                        multistepInteraction={isDiceMultistep ? multistepInteraction : undefined}
                        isBonusDiceSettlement={isBonusDiceSettlement}
                    />
                )}
                <div className={`w-full flex justify-center ${showAdvancePhaseButton ? '' : 'invisible pointer-events-none'}`}>
                    <GameButton
                        onClick={onAdvance}
                        disabled={!isAdvanceButtonEnabled}
                        variant={isAdvanceButtonEnabled ? "primary" : "secondary"}
                        clickSoundKey={null}
                        className="!py-0 !min-h-0"
                        style={advanceButtonStyle}
                        size="sm"
                        data-tutorial-id="advance-phase-button"
                    >
                        {advanceLabel}
                    </GameButton>
                </div>
                {passiveAbilityProps && passiveAbilityProps.passives.length > 0 && (
                    <PassiveAbilityPanel {...passiveAbilityProps} />
                )}
                <div className="flex justify-center" style={actionRailStyle}>
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

const CurrentTotalDamageBadge = ({ summary }: { summary: DamageSummary }) => {
    const { t } = useTranslation('game-dicethrone');
    const currentDamage = Math.max(0, summary.currentDamage);
    const originalDamage = summary.originalDamage !== undefined
        ? Math.max(0, summary.originalDamage)
        : undefined;
    const hasChanged = originalDamage !== undefined && originalDamage !== currentDamage;
    const title = hasChanged
        ? t('damageSummary.changed', { original: originalDamage, current: currentDamage })
        : `${t('damageSummary.label')} ${currentDamage}`;

    return (
        <div
            className="pointer-events-auto flex items-center justify-center rounded-full border border-rose-400/55 bg-gradient-to-r from-rose-950/95 to-red-900/90 backdrop-blur-sm"
            data-testid="current-total-damage-badge"
            data-current-damage={currentDamage}
            data-original-damage={originalDamage}
            aria-label={title}
            title={title}
            style={{
                height: buildBoardShellInlineUnitValue(1.75),
                gap: buildBoardShellInlineUnitValue(0.32),
                paddingInline: buildBoardShellInlineUnitValue(0.58),
                boxShadow: `0 0 ${buildBoardShellInlineUnitValue(1)} rgba(244,63,94,0.32)`,
            }}
        >
            <HeartCrack
                className="shrink-0 text-rose-300"
                style={{
                    width: buildBoardShellInlineUnitValue(0.78),
                    height: buildBoardShellInlineUnitValue(0.78),
                }}
            />
            <div
                className="flex items-baseline whitespace-nowrap leading-none"
                style={{ gap: buildBoardShellInlineUnitValue(0.22) }}
            >
                <span
                    className="font-semibold uppercase tracking-[0.08em] text-rose-100/85"
                    style={{ fontSize: buildBoardShellInlineUnitValue(0.55) }}
                >
                    {t('damageSummary.label')}
                </span>
                <span
                    className="font-black tracking-wide text-rose-100"
                    style={{ fontSize: buildBoardShellInlineUnitValue(0.8) }}
                >
                    {currentDamage}
                </span>
                {hasChanged && (
                    <span
                        className="font-semibold text-rose-200/75"
                        style={{ fontSize: buildBoardShellInlineUnitValue(0.5) }}
                    >
                        {originalDamage}→{currentDamage}
                    </span>
                )}
            </div>
        </div>
    );
};
