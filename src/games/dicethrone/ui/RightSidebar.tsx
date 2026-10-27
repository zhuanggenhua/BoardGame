import React, { useMemo } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { HeartCrack, MousePointerClick } from 'lucide-react';
import type { AbilityCard, Die, TurnPhase } from '../types';
import type { PlayerId } from '../../../engine/types';
import type { InteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import type { MultistepInteractionState } from '../../../engine/systems/useMultistepInteraction';
import type { DiceModifyResult, DiceSelectResult } from '../domain/systems';
import { DiceActions, DiceTray } from './DiceTray';
import { getDiceInteractionHint, getDiceInteractionMeta, type GroupBonusReroll } from './diceInteractionContract';
import { DiscardPile } from './DiscardPile';
import { GameButton } from './components/GameButton';
import { UI_Z_INDEX } from '../../../core';
import { ActiveModifierBadge } from './ActiveModifierBadge';
import type { ActiveModifier } from '../hooks/useActiveModifiers';
import { PassiveAbilityPanel, type PassiveAbilityPanelProps } from './PassiveAbilityPanel';
import { resolveCharacterIdFromDiceDefinitionId } from './assets';
import {
    buildBoardShellInlineUnitValue,
} from '../../../shared/runtimeLayoutUnits';

type DamageSummary = {
    currentDamage: number;
    originalDamage?: number;
};

export const RightSidebar = ({
    dice,
    rollCount,
    rollLimit,
    rollConfirmed,
    isCompareRoll = false,
    currentPhase,
    canInteractDice,
    isResponseWindowOpen = false,
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
    groupBonusReroll,
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
    isResponseWindowOpen?: boolean;
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
    groupBonusReroll?: GroupBonusReroll;
    activeModifiers?: ActiveModifier[];
    attackModifierBonusDamage?: number;
    damageSummary?: DamageSummary;
    passiveAbilityProps?: Omit<PassiveAbilityPanelProps, never> | null;
    rootPlayerId: PlayerId;
    teamIdByPlayerId?: Record<PlayerId, string>;
}) => {
    const isDiceMultistep = Boolean(getDiceInteractionMeta(interaction));

    const { t } = useTranslation('game-dicethrone');
    const sidebarFrameStyle: CSSProperties = {
        zIndex: UI_Z_INDEX.hud,
        right: buildBoardShellInlineUnitValue(1.5),
        bottom: buildBoardShellInlineUnitValue(1.5),
        width: buildBoardShellInlineUnitValue(15),
        overflow: 'visible',
    };
    const stackStyle: CSSProperties = {
        gap: buildBoardShellInlineUnitValue(0.75),
        overflow: 'visible',
    };
    const diceTrayFrameStyle: CSSProperties = {
        width: buildBoardShellInlineUnitValue(5.8),
        overflow: 'visible',
        pointerEvents: 'auto',
    };
    const actionRailStyle: CSSProperties = {
        width: buildBoardShellInlineUnitValue(10.2),
        pointerEvents: 'auto',
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
        zIndex: UI_Z_INDEX.hint,
        marginBottom: buildBoardShellInlineUnitValue(0.6),
        right: 0,
        bottom: '100%',
        maxWidth: 'calc(100vw - 1rem)',
        overflow: 'visible',
    };
    const hintBubbleStyle: CSSProperties = {
        width: 'max-content',
        maxWidth: 'min(calc(100vw - 2rem), 22rem)',
        boxSizing: 'border-box',
        gap: buildBoardShellInlineUnitValue(0.4),
        borderRadius: buildBoardShellInlineUnitValue(0.5),
        paddingInline: buildBoardShellInlineUnitValue(0.6),
        paddingBlock: buildBoardShellInlineUnitValue(0.4),
        overflow: 'visible',
    };
    const hintIconStyle: CSSProperties = {
        width: buildBoardShellInlineUnitValue(1),
        height: buildBoardShellInlineUnitValue(1),
    };
    const hintTextStyle: CSSProperties = {
        fontSize: buildBoardShellInlineUnitValue(0.75),
        maxWidth: '100%',
        whiteSpace: 'normal',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
    };
    const bonusDiceOwnerLabelStyle: CSSProperties = {
        zIndex: UI_Z_INDEX.hint,
        top: buildBoardShellInlineUnitValue(0.15),
        right: `calc(100% + ${buildBoardShellInlineUnitValue(0.35)})`,
        maxWidth: buildBoardShellInlineUnitValue(8.8),
        gap: buildBoardShellInlineUnitValue(0.35),
        borderRadius: buildBoardShellInlineUnitValue(0.5),
        paddingInline: buildBoardShellInlineUnitValue(0.55),
        paddingBlock: buildBoardShellInlineUnitValue(0.3),
        fontSize: buildBoardShellInlineUnitValue(0.68),
    };
    const hasCurrentDamageSummary = typeof damageSummary?.currentDamage === 'number' && Number.isFinite(damageSummary.currentDamage);
    const hasModifierBadgeRow = Boolean(
        (activeModifiers && activeModifiers.length > 0)
        || (attackModifierBonusDamage && attackModifierBonusDamage > 0),
    );
    const bonusDiceOwner = useMemo(() => {
        if (!isBonusDiceSettlement) return null;
        const ownerDie = dice.find((die) => die.ownerId || die.definitionId);
        const characterId = resolveCharacterIdFromDiceDefinitionId(ownerDie?.definitionId);
        if (!ownerDie || !characterId) return null;
        const ownerName = t(`characters.${characterId}`);
        return {
            ownerId: ownerDie.ownerId,
            definitionId: ownerDie.definitionId,
            label: t('dice.bonusRollOwner', { owner: ownerName }),
        };
    }, [dice, isBonusDiceSettlement, t]);
    const interactionHint = getDiceInteractionHint({
        interaction, result: multistepInteraction?.result ?? undefined, groupBonusReroll, rootPlayerId, teamIdByPlayerId,
    });

    return (
        <div
            className="absolute top-0 flex flex-col items-center pointer-events-none"
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
                    {bonusDiceOwner && (
                        <div
                            className="pointer-events-none absolute flex min-w-max items-center overflow-hidden border border-sky-400/55 bg-slate-950/95 font-semibold leading-tight text-sky-100 shadow-lg shadow-slate-950/45 backdrop-blur-sm whitespace-nowrap"
                            style={bonusDiceOwnerLabelStyle}
                            data-testid="bonus-dice-owner-label"
                            data-bonus-dice-owner-id={bonusDiceOwner.ownerId ?? ''}
                            data-bonus-dice-definition-id={bonusDiceOwner.definitionId ?? ''}
                        >
                            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                                {bonusDiceOwner.label}
                            </span>
                        </div>
                    )}
                    {hasCurrentDamageSummary && (
                        <div
                            className="pointer-events-none absolute top-0 z-20"
                            data-testid="current-total-damage-badge-anchor"
                            data-placement="dice-tray-right-top-outside"
                            style={{
                                zIndex: UI_Z_INDEX.hint,
                                left: `calc(100% + ${buildBoardShellInlineUnitValue(0.35)})`,
                            }}
                        >
                            <CurrentTotalDamageBadge summary={damageSummary} />
                        </div>
                    )}
                    {interactionHint && (
                        <div
                            className="absolute z-10 pointer-events-none"
                            style={hintContainerStyle}
                        >
                            <div
                                className="flex min-w-0 items-start border border-amber-500/50 bg-amber-950/95 shadow-lg shadow-amber-900/40 backdrop-blur-sm whitespace-normal"
                                style={hintBubbleStyle}
                                data-testid="dice-interaction-hint"
                            >
                                <MousePointerClick className="text-amber-400 shrink-0" style={hintIconStyle} />
                                <span
                                    className="min-w-0 overflow-wrap-anywhere break-words text-amber-200 font-medium leading-snug"
                                    style={hintTextStyle}
                                >
                                    {t(interactionHint.key, interactionHint.params)}
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
                            selectedIds: groupBonusReroll?.selectedIds,
                        } : undefined}
                    />
                </div>
                )}
                {showDiceActions && (
                    <div className="pointer-events-auto">
                    <DiceActions
                        rollCount={rollCount}
                        rollLimit={rollLimit}
                        rollConfirmed={rollConfirmed}
                        isCompareRoll={isCompareRoll}
                        onRoll={onRoll}
                        onConfirm={onConfirm}
                        currentPhase={currentPhase}
                        canInteract={canInteractDice}
                        isResponseWindowOpen={isResponseWindowOpen}
                        isRolling={isRolling}
                        setIsRolling={setIsRolling}
                        interaction={isDiceMultistep ? interaction : undefined}
                        multistepInteraction={isDiceMultistep ? multistepInteraction : undefined}
                        isBonusDiceSettlement={isBonusDiceSettlement}
                        groupBonusReroll={groupBonusReroll}
                    />
                    </div>
                )}
                <div className={`w-full flex justify-center ${showAdvancePhaseButton ? '' : 'invisible pointer-events-none'}`}>
                    <GameButton
                        onClick={onAdvance}
                        disabled={!isAdvanceButtonEnabled}
                        variant={isAdvanceButtonEnabled ? "primary" : "secondary"}
                        clickSoundKey={null}
                        className="!py-0 !min-h-0 pointer-events-auto"
                        style={advanceButtonStyle}
                        size="sm"
                        data-tutorial-id="advance-phase-button"
                    >
                        {advanceLabel}
                    </GameButton>
                </div>
                {passiveAbilityProps && passiveAbilityProps.passives.length > 0 && (
                    <div className="pointer-events-auto">
                    <PassiveAbilityPanel {...passiveAbilityProps} />
                    </div>
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
    const damageSummaryLabel = Array.from(t('damageSummary.label').replace(/\s+/g, ''));
    const title = hasChanged
        ? t('damageSummary.changed', { original: originalDamage, current: currentDamage })
        : `${t('damageSummary.label')} ${currentDamage}`;

    return (
        <div
            className="pointer-events-auto flex flex-col items-center justify-center rounded-none border border-rose-400/55 bg-gradient-to-b from-rose-950/95 to-red-900/90 backdrop-blur-sm"
            data-testid="current-total-damage-badge"
            data-current-damage={currentDamage}
            data-original-damage={originalDamage}
            aria-label={title}
            title={title}
            style={{
                width: 'max-content',
                minWidth: 0,
                minHeight: buildBoardShellInlineUnitValue(3.6),
                gap: buildBoardShellInlineUnitValue(0.24),
                paddingInline: buildBoardShellInlineUnitValue(0.38),
                paddingBlock: buildBoardShellInlineUnitValue(0.28),
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
                className="flex flex-col items-center whitespace-nowrap leading-none"
                style={{ gap: buildBoardShellInlineUnitValue(0.22) }}
            >
                <span
                    className="flex flex-col items-center font-black uppercase tracking-[0.08em] text-rose-100 leading-none"
                    data-testid="current-total-damage-label"
                    aria-hidden="true"
                    style={{
                        gap: buildBoardShellInlineUnitValue(0.02),
                        fontSize: `max(16px, ${buildBoardShellInlineUnitValue(0.82)})`,
                    }}
                >
                    {damageSummaryLabel.map((character, index) => (
                        <span key={`${character}-${index}`}>{character}</span>
                    ))}
                </span>
                {hasChanged ? (
                    <span
                        className="flex flex-col items-center font-black text-rose-100 leading-none"
                        style={{ gap: buildBoardShellInlineUnitValue(0.08) }}
                        data-testid="current-total-damage-change"
                        aria-label={`${originalDamage}→${currentDamage}`}
                    >
                        <span
                            className="font-black tracking-wide text-slate-300"
                            style={{ fontSize: `max(16px, ${buildBoardShellInlineUnitValue(1.15)})` }}
                        >
                            {originalDamage}
                        </span>
                        <span
                            className="text-rose-300/85"
                            aria-hidden="true"
                            style={{ fontSize: `max(16px, ${buildBoardShellInlineUnitValue(1.15)})` }}
                        >
                            ↓
                        </span>
                        <span
                            className="font-black tracking-wide text-amber-200"
                            style={{ fontSize: `max(16px, ${buildBoardShellInlineUnitValue(1.15)})` }}
                        >
                            {currentDamage}
                        </span>
                    </span>
                ) : (
                    <span
                        className="font-black tracking-wide text-rose-100"
                        style={{ fontSize: `max(16px, ${buildBoardShellInlineUnitValue(1.15)})` }}
                    >
                        {currentDamage}
                    </span>
                )}
            </div>
        </div>
    );
};
