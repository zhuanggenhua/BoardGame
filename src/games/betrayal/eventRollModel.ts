import type { RandomFn } from '../../engine/types';
import { rollBetrayalDicePips } from './diceRules';
import type {
    BetrayalAllTraitCheckResult,
    BetrayalCore,
    BetrayalExplorerSummary,
    BetrayalPendingEventChoiceState,
    BetrayalPendingEventRollResolutionState,
    BetrayalTraitKey,
} from './game';
import {
    BETRAYAL_TRAIT_LABEL as TRAIT_LABEL,
    cloneUseEffect,
    eventEffectNeedsPendingEventChoice,
    formatEffectLabel,
    type UseEffectProfile,
} from './possessionEffects';
import type {
    BetrayalEventResultBranch,
    BetrayalEventSeed,
} from './scenarioConfig';
import {
    rollEventTraitCheckWithDice,
    type BetrayalTraitRollResult,
} from './traitRollModel';

export type MaterializeEventEffectOptions = {
    materializeRandomResults?: boolean;
};

export interface BetrayalEventRollPayload {
    kind: 'trait' | 'dice';
    trait?: BetrayalTraitKey;
    total: number;
    label: string;
    eventDescription?: string;
    rollLabel: string;
    dice: number[];
    passiveBonus: number;
    branchThresholds: BetrayalEventResultBranch[];
}

export interface BetrayalEventRollResolution {
    eventEffect: UseEffectProfile;
    deathPrevention?: BetrayalPendingEventRollResolutionState['deathPrevention'];
    eventRoll: BetrayalEventRollPayload;
    nextPendingEventChoice?: BetrayalPendingEventChoiceState;
    resolutionText: string;
}

export function rollEventFixedDice(random: RandomFn, diceCount: number): BetrayalTraitRollResult {
    const dice = rollBetrayalDicePips(random, diceCount);
    return {
        total: dice.reduce((sum, pip) => sum + pip, 0),
        dice,
        passiveBonus: 0,
    };
}

export function resolveEventBranch(
    branches: BetrayalEventResultBranch[],
    rollTotal: number,
): BetrayalEventResultBranch {
    return [...branches]
        .sort((left, right) => right.min - left.min)
        .find((branch) => rollTotal >= branch.min)
        ?? branches[branches.length - 1]!;
}

export function rollAllTraitChecks(
    explorer: BetrayalExplorerSummary,
    traits: BetrayalTraitKey[],
    passMin: number,
    random: RandomFn,
    core?: BetrayalCore,
): BetrayalAllTraitCheckResult[] {
    return traits.map((trait) => {
        const result = rollEventTraitCheckWithDice(random, explorer, trait, core);
        return {
            trait,
            total: result.total,
            dice: result.dice,
            passiveBonus: result.passiveBonus,
            passed: result.total >= passMin,
        };
    });
}

export function materializeEventEffect(
    effect: UseEffectProfile,
    random: RandomFn,
    explorer: BetrayalExplorerSummary,
    core?: BetrayalCore,
    options: MaterializeEventEffectOptions = {},
): UseEffectProfile {
    const materializeRandomResults = options.materializeRandomResults ?? true;
    if (effect.mode === 'compound') {
        return {
            ...effect,
            effects: effect.effects.map((childEffect) => materializeEventEffect(childEffect, random, explorer, core, options)),
        };
    }
    if (effect.mode === 'optionalEventRoll') {
        return cloneUseEffect(effect);
    }
    if (effect.mode === 'optionalHauntRoll') {
        return cloneUseEffect(effect);
    }
    if (effect.mode === 'chooseTraitRoll') {
        return cloneUseEffect(effect);
    }
    if (effect.mode === 'traitRoll') {
        return cloneUseEffect(effect);
    }
    if (effect.mode === 'optionalItemEffect') {
        return cloneUseEffect(effect);
    }
    if (effect.mode === 'allTraitChecks') {
        if (!materializeRandomResults) {
            return cloneUseEffect(effect);
        }
        const results = rollAllTraitChecks(explorer, effect.traits, effect.passMin, random, core);
        const hasFailure = results.some((result) => !result.passed);
        return {
            ...effect,
            traits: [...effect.traits],
            results,
            recommendedAction: hasFailure ? 'endTurn' : effect.allPassEffect.recommendedAction,
            allPassEffect: cloneUseEffect(effect.allPassEffect),
        };
    }
    if (effect.mode === 'generalDamage') {
        return { ...effect, traits: [...effect.traits] };
    }
    if (effect.mode === 'generalDamageChoice') {
        return {
            ...effect,
            allowedTraits: [...effect.allowedTraits],
            selectedTraits: effect.selectedTraits ? [...effect.selectedTraits] : undefined,
        };
    }
    if (effect.mode === 'chosenTrait') {
        return { ...effect, allowedTraits: [...effect.allowedTraits] };
    }
    if (effect.mode === 'healChosenTrait') {
        return { ...effect, allowedTraits: [...effect.allowedTraits] };
    }
    if (effect.mode === 'placeExplorerInDiscoveredRoomByVisualId') {
        return {
            ...effect,
            visualIds: [...effect.visualIds],
            roomNames: [...effect.roomNames],
        };
    }
    if (effect.mode === 'placeExplorerInDiscoveredRoomByFloor') {
        return { ...effect };
    }
    if (effect.mode === 'placeExplorerInFloorStartingRoom') {
        return { ...effect };
    }
    if (effect.mode === 'placeExplorerInNextFloorStartingRoom') {
        const currentRoom = core?.rooms.find((room) => room.id === explorer.roomId);
        if (currentRoom?.floor === 'basement' && effect.basementFallbackDamage) {
            return {
                mode: 'compound',
                effects: [
                    {
                        ...effect,
                        basementFallbackDamage: undefined,
                    },
                    {
                        mode: 'fixedDamage',
                        amount: effect.basementFallbackDamage.amount,
                        damageKind: effect.basementFallbackDamage.damageKind,
                        recommendedAction: effect.recommendedAction,
                    },
                ],
                recommendedAction: effect.recommendedAction,
            };
        }
        return { ...effect };
    }
    if (effect.mode === 'placeExplorerInAdjacentRoom') {
        return { ...effect };
    }
    if (effect.mode === 'rolledDamage' && !effect.rolls) {
        if (!materializeRandomResults) {
            return cloneUseEffect(effect);
        }
        return { ...effect, rolls: rollBetrayalDicePips(random, effect.dice) };
    }
    return { ...effect };
}

export function resolveEventRollResolution(
    core: BetrayalCore,
    eventCard: BetrayalEventSeed,
    random: RandomFn,
): BetrayalEventRollResolution {
    if (!eventCard.roll) {
        throw new Error(`event ${eventCard.name} has no roll to resolve`);
    }
    const eventRollKind = eventCard.roll.kind ?? 'trait';
    const eventRollResult = eventRollKind === 'dice'
        ? rollEventFixedDice(random, eventCard.roll.dice)
        : rollEventTraitCheckWithDice(random, core.currentExplorer, eventCard.roll.trait, core);
    const eventRollTotal = eventRollResult.total;
    const eventBranch = resolveEventBranch(eventCard.roll.branches, eventRollTotal);
    const materializedEventEffect = materializeEventEffect(
        eventBranch.effect,
        random,
        core.currentExplorer,
        core,
        { materializeRandomResults: false },
    );
    const eventRollLabel = eventRollKind === 'dice'
        ? eventCard.roll.label
        : `${TRAIT_LABEL[eventCard.roll.trait]}检定`;
    const resolutionText = `${eventRollLabel} ${eventRollTotal}：${eventBranch.label}；${formatEffectLabel(materializedEventEffect)}`;
    const nextPendingEventChoice = eventEffectNeedsPendingEventChoice(materializedEventEffect)
        ? {
            id: `${core.pendingEventRollStart?.playerId ?? core.currentExplorer.playerId}-${eventCard.name}-choice`,
            playerId: core.pendingEventRollStart?.playerId ?? core.currentExplorer.playerId,
            sourceTitle: eventCard.name,
            eventDescription: eventCard.description,
            sourceKind: 'event' as const,
            acceptLabel: materializedEventEffect.mode === 'optionalEventRoll'
                || materializedEventEffect.mode === 'optionalEffect'
                || materializedEventEffect.mode === 'optionalItemEffect'
                || materializedEventEffect.mode === 'optionalHauntRoll'
                ? materializedEventEffect.acceptLabel
                : undefined,
            declineLabel: materializedEventEffect.mode === 'optionalEventRoll'
                || materializedEventEffect.mode === 'optionalEffect'
                || materializedEventEffect.mode === 'optionalItemEffect'
                || materializedEventEffect.mode === 'optionalHauntRoll'
                ? materializedEventEffect.declineLabel
                : undefined,
            effect: cloneUseEffect(materializedEventEffect),
        } satisfies BetrayalPendingEventChoiceState
        : undefined;
    return {
        eventEffect: materializedEventEffect,
        eventRoll: {
            kind: eventRollKind,
            trait: eventRollKind === 'dice' ? undefined : eventCard.roll.trait,
            total: eventRollTotal,
            label: eventBranch.label,
            eventDescription: eventCard.description,
            rollLabel: eventRollLabel,
            dice: eventRollResult.dice,
            passiveBonus: eventRollResult.passiveBonus,
            branchThresholds: eventCard.roll.branches.map((branch) => ({
                min: branch.min,
                label: branch.label,
                effect: { ...branch.effect },
            })),
        },
        nextPendingEventChoice,
        resolutionText,
    };
}
