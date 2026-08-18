import type { GameEvent, MatchState, RandomFn } from '../../../engine/types';
import type { ChoiceRequest, ChoiceRequestCandidate } from '../../../engine/ChoiceRequest';
import { createDamageCalculation } from '../../../engine/primitives/damageCalculation';
import { createSimpleChoiceFromChoiceRequest } from '../../../engine/systems/ChoiceRequestSimpleChoiceAdapter';
import {
    INTERACTION_EVENTS,
    queueInteraction,
    type InteractionDescriptor,
} from '../../../engine/systems/InteractionSystem';
import type { EngineSystem } from '../../../engine/systems/types';
import { RESPONSE_WINDOW_EVENTS } from '../../../engine/systems/ResponseWindowSystem';
import {
    completeResolutionFrame,
    getActiveResolutionFrame,
    upsertActiveResolutionFrame,
} from '../../../engine/systems/resolutionStack';
import {
    MAGE_WARS_EVENTS,
    type MageWarsArenaObjectDefenseRolledEvent,
    type MageWarsCounterstrikeAvailableEvent,
    type MageWarsDefenseAvailableEvent,
    type MageWarsEnchantmentResponseRequiredEvent,
    type MageWarsEvent,
    type MageWarsSpellCastResolvedEvent,
    type MageWarsUpkeepCostAvailableEvent,
} from './events';
import {
    createMageWarsArenaObjectSourceConsumedEvent,
    createMageWarsCounterstrikeSourceConsumedEvent,
    resolveMageWarsBasicAttackEvents,
    resolveMageWarsMageDefenseEvents,
    resolveMageWarsArenaObjectDefenseEvents,
    resolveMageWarsObjectAttackEvents,
} from './execute';
import { resolveMageWarsSpellAttackAfterDefense } from './spellAbilityExecutors';
import {
    getMageWarsPlayerDefenseProfile,
    getMageWarsObjectDefenseProfile,
    isMageWarsObjectDefenseProfileAutomatic,
} from './spellRules';
import type { MageWarsCore } from './types';
import {
    createMageWarsResponseFrame,
    readMageWarsResponseContext,
    type MageWarsResponseContext,
} from './responseResolution';
import { getArenaObject } from './utils';
import { getMageWarsObjectAttackProfile } from './spellRules';

export const MAGE_WARS_INTERACTION_SOURCE_IDS = {
    COUNTERSTRIKE_CHOICE: 'mw.counterstrike.choice',
    DEFENSE_CHOICE: 'mw.defense.choice',
    UPKEEP_COST_CHOICE: 'mw.upkeep-cost.choice',
    ENCHANTMENT_RESPONSE_REVEAL: 'mw.enchantment-response.reveal',
} as const;

type MageWarsEnchantmentResponseChoiceValue = {
    action: 'reveal';
    responseId: string;
    responseObjectId: string;
    responseCardId: 1825 | 1901 | 1904;
};

export type MageWarsUpkeepCostChoiceValue = {
    action: 'pay' | 'destroy';
    playerId: string;
    sourceObjectId: string;
    sourceSpellCardId: number;
    targetObjectId: string;
    amount: number;
};

export type MageWarsCounterstrikeChoiceValue =
    | {
        action: 'counterstrike';
        attackerObjectId: string;
        defenderObjectId: string;
        incomingAttackProfileId: string;
        counterstrikeAttackProfileId: string;
        counterstrikeSourceObjectId?: string;
    }
    | {
        action: 'pass';
        attackerObjectId: string;
        defenderObjectId: string;
        incomingAttackProfileId: string;
        counterstrikeAttackProfileId: string;
    };

export type MageWarsDefenseChoiceValue =
    | {
        action: 'defend';
        attackerObjectId?: string;
        attackerId?: string;
        defenderObjectId?: string;
        defenderId?: string;
        incomingAttackProfileId: string;
        defenseProfileId: string;
        allowCounterstrikeOpportunity: boolean;
        removeGuardAfterMelee: boolean;
        counterstrikeSourceObjectId?: string;
        spellCardId?: number;
    }
    | {
        action: 'pass';
        attackerObjectId?: string;
        attackerId?: string;
        defenderObjectId?: string;
        defenderId?: string;
        incomingAttackProfileId: string;
        allowCounterstrikeOpportunity: boolean;
        removeGuardAfterMelee: boolean;
        counterstrikeSourceObjectId?: string;
        spellCardId?: number;
    };

function isCounterstrikeAvailableEvent(event: GameEvent): event is MageWarsCounterstrikeAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.COUNTERSTRIKE_AVAILABLE;
}

function isDefenseAvailableEvent(event: GameEvent): event is MageWarsDefenseAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.DEFENSE_AVAILABLE;
}

function isUpkeepCostAvailableEvent(event: GameEvent): event is MageWarsUpkeepCostAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.UPKEEP_COST_AVAILABLE;
}

function isEnchantmentResponseRequiredEvent(
    event: GameEvent,
): event is MageWarsEnchantmentResponseRequiredEvent {
    return event.type === MAGE_WARS_EVENTS.ENCHANTMENT_RESPONSE_REQUIRED;
}

function isSpellCastResolvedEvent(event: GameEvent): event is MageWarsSpellCastResolvedEvent {
    return event.type === MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED;
}

function isInteractionResolvedEvent(event: GameEvent): event is GameEvent<typeof INTERACTION_EVENTS.RESOLVED, {
    sourceId?: string;
    value?: unknown;
}> {
    return event.type === INTERACTION_EVENTS.RESOLVED;
}

function isCounterstrikeChoiceValue(value: unknown): value is MageWarsCounterstrikeChoiceValue {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<MageWarsCounterstrikeChoiceValue>;
    if (candidate.action !== 'counterstrike' && candidate.action !== 'pass') return false;
    return typeof candidate.attackerObjectId === 'string'
        && typeof candidate.defenderObjectId === 'string'
        && typeof candidate.incomingAttackProfileId === 'string'
        && typeof candidate.counterstrikeAttackProfileId === 'string';
}

function isDefenseChoiceValue(value: unknown): value is MageWarsDefenseChoiceValue {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<MageWarsDefenseChoiceValue>;
    const defenseCandidate = candidate as { defenseProfileId?: unknown };
    if (candidate.action !== 'defend' && candidate.action !== 'pass') return false;
    if (
        (typeof candidate.attackerObjectId !== 'string' && typeof candidate.attackerId !== 'string')
        || (typeof candidate.defenderObjectId !== 'string' && typeof candidate.defenderId !== 'string')
        || typeof candidate.incomingAttackProfileId !== 'string'
        || typeof candidate.allowCounterstrikeOpportunity !== 'boolean'
        || typeof candidate.removeGuardAfterMelee !== 'boolean'
    ) {
        return false;
    }
    return candidate.action === 'pass' || typeof defenseCandidate.defenseProfileId === 'string';
}

function isUpkeepCostChoiceValue(value: unknown): value is MageWarsUpkeepCostChoiceValue {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<MageWarsUpkeepCostChoiceValue>;
    return (candidate.action === 'pay' || candidate.action === 'destroy')
        && typeof candidate.playerId === 'string'
        && typeof candidate.sourceObjectId === 'string'
        && typeof candidate.sourceSpellCardId === 'number'
        && typeof candidate.targetObjectId === 'string'
        && typeof candidate.amount === 'number'
        && Number.isInteger(candidate.amount)
        && candidate.amount > 0;
}

function isEnchantmentResponseChoiceValue(value: unknown): value is MageWarsEnchantmentResponseChoiceValue {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<MageWarsEnchantmentResponseChoiceValue>;
    return candidate.action === 'reveal'
        && typeof candidate.responseId === 'string'
        && typeof candidate.responseObjectId === 'string'
        && (candidate.responseCardId === 1825 || candidate.responseCardId === 1901 || candidate.responseCardId === 1904);
}

function counterstrikeInteractionId(event: MageWarsCounterstrikeAvailableEvent): string {
    return [
        'mw-counterstrike',
        event.payload.defenderObjectId,
        event.payload.attackerObjectId,
        event.payload.counterstrikeAttackProfileId,
        event.timestamp ?? 0,
    ].join('-');
}

function defenseInteractionId(event: MageWarsDefenseAvailableEvent): string {
    return [
        'mw-defense',
        event.payload.defenderObjectId ?? event.payload.defenderId,
        event.payload.attackerObjectId ?? event.payload.attackerId,
        event.payload.incomingAttackProfileId,
        event.timestamp ?? 0,
    ].join('-');
}

function upkeepCostInteractionId(event: MageWarsUpkeepCostAvailableEvent): string {
    return [
        'mw-upkeep-cost',
        event.payload.sourceObjectId,
        event.payload.targetObjectId,
        event.timestamp ?? 0,
    ].join('-');
}

function hasInteractionQueued(
    state: MatchState<MageWarsCore>,
    interactionId: string,
): boolean {
    const interactionState = state.sys.interaction;
    return interactionState.current?.id === interactionId
        || interactionState.queue.some((interaction) => interaction.id === interactionId);
}

function createCounterstrikeChoice(event: MageWarsCounterstrikeAvailableEvent): InteractionDescriptor {
    const baseValue = {
        attackerObjectId: event.payload.attackerObjectId,
        defenderObjectId: event.payload.defenderObjectId,
        incomingAttackProfileId: event.payload.incomingAttackProfileId,
        counterstrikeAttackProfileId: event.payload.counterstrikeAttackProfileId,
        ...(event.payload.counterstrikeSourceObjectId
            ? { counterstrikeSourceObjectId: event.payload.counterstrikeSourceObjectId }
            : {}),
    };
    const requestId = counterstrikeInteractionId(event);
    const candidates: ChoiceRequestCandidate<MageWarsCounterstrikeChoiceValue>[] = [{
        id: 'counterstrike',
        label: 'interaction.counterstrike.options.counterstrike',
        labelKey: 'interaction.counterstrike.options.counterstrike',
        value: {
            action: 'counterstrike',
            ...baseValue,
        },
        displayMode: 'button',
    }, {
        id: 'pass',
        label: 'interaction.counterstrike.options.pass',
        labelKey: 'interaction.counterstrike.options.pass',
        value: {
            action: 'pass',
            ...baseValue,
        },
        displayMode: 'button',
    }];
    const request: ChoiceRequest<MageWarsCounterstrikeChoiceValue> = {
        requestId,
        gameId: 'mage-wars',
        playerId: event.payload.ownerId,
        kind: 'choose-option',
        sourceId: MAGE_WARS_INTERACTION_SOURCE_IDS.COUNTERSTRIKE_CHOICE,
        candidates,
        selection: { min: 1, max: 1 },
        skipPolicy: 'forbidden',
        resolution: { type: 'interaction-response', interactionId: requestId },
        ai: { status: 'shared-policy', policyId: 'mage-wars-button-options' },
    };

    return createSimpleChoiceFromChoiceRequest(request, {
        title: 'interaction.counterstrike.title',
        titleKey: 'interaction.counterstrike.title',
        titleParams: {
            attackerObjectId: event.payload.attackerObjectId,
            defenderObjectId: event.payload.defenderObjectId,
        },
        targetType: 'button',
        autoResolveIfSingle: false,
    });
}

function createDefenseChoice(event: MageWarsDefenseAvailableEvent): InteractionDescriptor {
    const baseValue = {
        ...(event.payload.attackerObjectId ? { attackerObjectId: event.payload.attackerObjectId } : {}),
        ...(event.payload.attackerId ? { attackerId: event.payload.attackerId } : {}),
        ...(event.payload.defenderObjectId ? { defenderObjectId: event.payload.defenderObjectId } : {}),
        ...(event.payload.defenderId ? { defenderId: event.payload.defenderId } : {}),
        incomingAttackProfileId: event.payload.incomingAttackProfileId,
        allowCounterstrikeOpportunity: event.payload.allowCounterstrikeOpportunity,
        removeGuardAfterMelee: event.payload.removeGuardAfterMelee,
        ...(event.payload.counterstrikeSourceObjectId
            ? { counterstrikeSourceObjectId: event.payload.counterstrikeSourceObjectId }
            : {}),
        ...(event.payload.spellCardId ? { spellCardId: event.payload.spellCardId } : {}),
    };
    const defenseOptions: ChoiceRequestCandidate<MageWarsDefenseChoiceValue>[] = event.payload.defenseProfileIds
        .filter((defenseProfileId) => (
            !event.payload.requiredDefenseProfileId
            || defenseProfileId === event.payload.requiredDefenseProfileId
        ))
        .map((defenseProfileId) => ({
        id: `defend-${defenseProfileId}`,
        label: 'interaction.defense.options.defend',
        labelKey: 'interaction.defense.options.defend',
        value: {
            action: 'defend',
            defenseProfileId,
            ...baseValue,
        },
        displayMode: 'button',
    }));
    const candidates: ChoiceRequestCandidate<MageWarsDefenseChoiceValue>[] = event.payload.requiredDefenseProfileId
        ? defenseOptions
        : [
            ...defenseOptions,
            {
                id: 'pass',
                label: 'interaction.defense.options.pass',
                labelKey: 'interaction.defense.options.pass',
                value: {
                    action: 'pass',
                    ...baseValue,
                },
                displayMode: 'button',
            },
        ];

    const requestId = defenseInteractionId(event);
    const request: ChoiceRequest<MageWarsDefenseChoiceValue> = {
        requestId,
        gameId: 'mage-wars',
        playerId: event.payload.ownerId,
        kind: 'choose-option',
        sourceId: MAGE_WARS_INTERACTION_SOURCE_IDS.DEFENSE_CHOICE,
        candidates,
        selection: { min: 1, max: 1 },
        skipPolicy: 'forbidden',
        resolution: { type: 'interaction-response', interactionId: requestId },
        ai: { status: 'shared-policy', policyId: 'mage-wars-button-options' },
    };

    return createSimpleChoiceFromChoiceRequest(request, {
        title: 'interaction.defense.title',
        titleKey: 'interaction.defense.title',
        titleParams: {
            ...(event.payload.attackerObjectId ? { attackerObjectId: event.payload.attackerObjectId } : {}),
            ...(event.payload.defenderObjectId ? { defenderObjectId: event.payload.defenderObjectId } : {}),
            ...(event.payload.attackerId ? { attackerId: event.payload.attackerId } : {}),
            ...(event.payload.defenderId ? { defenderId: event.payload.defenderId } : {}),
        },
        targetType: 'button',
        autoResolveIfSingle: false,
    });
}

function createUpkeepCostChoice(
    state: MatchState<MageWarsCore>,
    event: MageWarsUpkeepCostAvailableEvent,
): InteractionDescriptor {
    const baseValue = {
        playerId: event.payload.playerId,
        sourceObjectId: event.payload.sourceObjectId,
        sourceSpellCardId: event.payload.sourceSpellCardId,
        targetObjectId: event.payload.targetObjectId,
        amount: event.payload.amount,
    };
    const player = state.core.players[event.payload.playerId];
    const canPay = (player?.mana ?? 0) >= event.payload.amount;
    const candidates: ChoiceRequestCandidate<MageWarsUpkeepCostChoiceValue>[] = [
        ...(canPay ? [{
            id: 'pay',
            label: 'interaction.upkeep.options.pay',
            labelKey: 'interaction.upkeep.options.pay',
            value: { action: 'pay' as const, ...baseValue },
            displayMode: 'button' as const,
        }] : []),
        {
            id: 'destroy',
            label: 'interaction.upkeep.options.destroy',
            labelKey: 'interaction.upkeep.options.destroy',
            value: { action: 'destroy' as const, ...baseValue },
            displayMode: 'button' as const,
        },
    ];

    const requestId = upkeepCostInteractionId(event);
    const request: ChoiceRequest<MageWarsUpkeepCostChoiceValue> = {
        requestId,
        gameId: 'mage-wars',
        playerId: event.payload.playerId,
        kind: 'choose-option',
        sourceId: MAGE_WARS_INTERACTION_SOURCE_IDS.UPKEEP_COST_CHOICE,
        candidates,
        selection: { min: 1, max: 1 },
        skipPolicy: 'forbidden',
        resolution: { type: 'interaction-response', interactionId: requestId },
        ai: { status: 'shared-policy', policyId: 'mage-wars-button-options' },
    };

    return createSimpleChoiceFromChoiceRequest(request, {
        title: 'interaction.upkeep.title',
        titleKey: 'interaction.upkeep.title',
        titleParams: {
            targetObjectId: event.payload.targetObjectId,
            amount: event.payload.amount,
        },
        targetType: 'button',
        autoResolveIfSingle: true,
    });
}

function createEnchantmentResponseChoice(
    event: MageWarsEnchantmentResponseRequiredEvent,
): InteractionDescriptor {
    const context = event.payload.context;
    const value: MageWarsEnchantmentResponseChoiceValue = {
        action: 'reveal',
        responseId: context.responseId,
        responseObjectId: context.responseObjectId,
        responseCardId: context.responseCardId,
    };

    const revealCandidate: ChoiceRequestCandidate<MageWarsEnchantmentResponseChoiceValue> = {
        id: 'reveal',
        label: 'interaction.enchantmentResponse.options.reveal',
        labelKey: 'interaction.enchantmentResponse.options.reveal',
        value,
        displayMode: 'button',
    };

    const createLiveRevealOption = (
        state: { core: MageWarsCore; sys: MatchState<MageWarsCore>['sys'] },
    ): ChoiceRequestCandidate<MageWarsEnchantmentResponseChoiceValue> => {
        const frame = getActiveResolutionFrame(state as MatchState<MageWarsCore>);
        const activeContext = readMageWarsResponseContext(frame);
        const isCurrentResponse = frame?.id === context.responseId
            && activeContext?.responseId === context.responseId
            && activeContext.responseObjectId === context.responseObjectId
            && activeContext.responseCardId === context.responseCardId;

        return {
            ...revealCandidate,
            ...(isCurrentResponse
                ? {}
                : {
                    disabled: true,
                    disabledReason: '响应窗口已过期或响应来源已变化',
                }),
        };
    };

    const request: ChoiceRequest<MageWarsEnchantmentResponseChoiceValue> = {
        requestId: event.payload.interactionId,
        gameId: 'mage-wars',
        playerId: context.responseOwnerId,
        ownerFrameId: context.responseId,
        kind: 'choose-option',
        sourceId: MAGE_WARS_INTERACTION_SOURCE_IDS.ENCHANTMENT_RESPONSE_REVEAL,
        candidates: [revealCandidate],
        selection: { min: 1, max: 1 },
        skipPolicy: 'forbidden',
        resolution: { type: 'interaction-response', interactionId: event.payload.interactionId },
        ai: { status: 'shared-policy', policyId: 'mage-wars-button-options' },
    };

    return createSimpleChoiceFromChoiceRequest(request, {
        title: 'interaction.enchantmentResponse.title',
        titleKey: 'interaction.enchantmentResponse.title',
        titleParams: {
            responseCardId: context.responseCardId,
            responseObjectId: context.responseObjectId,
        },
        targetType: 'button',
        autoResolveIfSingle: false,
        responseValidationMode: 'live',
        optionsGenerator: <TCore>(state: { core: TCore; sys: unknown }) =>
            [createLiveRevealOption(state as unknown as { core: MageWarsCore; sys: MatchState<MageWarsCore>['sys'] })],
    });
}

function resolveAttackAfterDefenseChoice(
    state: MatchState<MageWarsCore>,
    commandType: string,
    timestamp: number | undefined,
    random: RandomFn,
    value: MageWarsDefenseChoiceValue,
): GameEvent[] {
    if (value.attackerId && value.defenderId && !value.spellCardId) {
        return resolveMageWarsBasicAttackEvents({
            state,
            sourceCommandType: commandType,
            timestamp: timestamp ?? 0,
            random,
            attackerId: value.attackerId,
            defenderId: value.defenderId,
        });
    }
    if (value.attackerId && value.defenderId && value.spellCardId) {
        return resolveMageWarsSpellAttackAfterDefense({
            state,
            sourceCommandType: commandType,
            timestamp: timestamp ?? 0,
            random,
            attackerId: value.attackerId,
            defenderId: value.defenderId,
            spellCardId: value.spellCardId,
        });
    }
    if (value.attackerObjectId && value.defenderId) {
        return resolveMageWarsObjectAttackEvents({
            state,
            sourceCommandType: commandType,
            timestamp: timestamp ?? 0,
            random,
            attackerObjectId: value.attackerObjectId,
            attackProfileId: value.incomingAttackProfileId,
            targetPlayerId: value.defenderId,
            actionCost: 'none',
            allowDefenseOpportunity: false,
            allowCounterstrikeOpportunity: value.allowCounterstrikeOpportunity,
            removeGuardAfterMelee: value.removeGuardAfterMelee,
            counterstrikeSourceObjectId: value.counterstrikeSourceObjectId,
            skipPreDefenseEffects: true,
        });
    }
    if (!value.attackerObjectId || !value.defenderObjectId) return [];
    return resolveMageWarsObjectAttackEvents({
        state,
        sourceCommandType: commandType,
        timestamp: timestamp ?? 0,
        random,
        attackerObjectId: value.attackerObjectId,
        attackProfileId: value.incomingAttackProfileId,
        targetPlayerId: value.defenderId,
        targetObjectId: value.defenderObjectId,
        actionCost: 'none',
        allowDefenseOpportunity: false,
        allowCounterstrikeOpportunity: value.allowCounterstrikeOpportunity,
        removeGuardAfterMelee: value.removeGuardAfterMelee,
        counterstrikeSourceObjectId: value.counterstrikeSourceObjectId,
        skipPreDefenseEffects: true,
    });
}

function resolveMageWarsEnchantmentResponse(
    state: MatchState<MageWarsCore>,
    context: MageWarsResponseContext,
    random: RandomFn,
    timestamp: number,
): { state: MatchState<MageWarsCore>; events: MageWarsEvent[] } {
    const responseObject = getArenaObject(state.core, context.responseObjectId);
    if (
        !responseObject
        || responseObject.kind !== 'enchantment'
        || responseObject.sourceSpellCardId !== context.responseCardId
        || responseObject.revealed === true
    ) {
        return { state, events: [] };
    }

    const events: MageWarsEvent[] = [{
        type: MAGE_WARS_EVENTS.ENCHANTMENT_REVEALED,
        payload: {
            objectId: responseObject.id,
            sourceSpellCardId: responseObject.sourceSpellCardId,
        },
        sourceCommandType: context.sourceCommandType,
        timestamp,
    }];

    if (context.kind === 'spell-counter') {
        events.push({
            type: MAGE_WARS_EVENTS.SPELL_COUNTERED,
            payload: {
                responseCardId: context.responseCardId,
                responseObjectId: context.responseObjectId,
                spellCardId: context.spellCardId,
                spellOwnerId: context.triggeringPlayerId,
                manaCost: context.manaCost,
                caster: context.caster,
                ...(context.objectManaCost === undefined ? {} : { objectManaCost: context.objectManaCost }),
                ...(context.playerManaCost === undefined ? {} : { playerManaCost: context.playerManaCost }),
            },
            sourceCommandType: context.sourceCommandType,
            timestamp,
        }, ...(context.responseCardId === 1901 && context.caster.kind === 'mage' ? [{
            type: MAGE_WARS_EVENTS.SPELL_DISCARDED,
            payload: {
                playerId: context.triggeringPlayerId,
                spellCardId: context.spellCardId,
                reason: 'cast-countered' as const,
            },
            sourceCommandType: context.sourceCommandType,
            timestamp,
        }] : []), {
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
            payload: {
                objectId: responseObject.id,
                ownerId: responseObject.ownerId,
                sourceAbilityId: `mw.spell.${context.responseCardId}.response`,
                spellCardId: context.responseCardId,
            },
            sourceCommandType: context.sourceCommandType,
            timestamp,
        }, {
            type: MAGE_WARS_EVENTS.SPELL_DISCARDED,
            payload: {
                playerId: responseObject.ownerId,
                spellCardId: responseObject.sourceSpellCardId,
                reason: 'enchantment-destroyed',
            },
            sourceCommandType: context.sourceCommandType,
            timestamp,
        });

        return {
            state: completeResolutionFrame(state, context.responseId),
            events,
        };
    }

    const originalAttacker = getArenaObject(state.core, context.attackerObjectId);
    const originalDefender = getArenaObject(state.core, context.defenderObjectId);
    const originalAttackProfile = originalAttacker
        ? getMageWarsObjectAttackProfile(originalAttacker, context.attackProfileId)
        : undefined;
    if (!originalAttacker || !originalDefender || !originalAttackProfile) {
        events.push({
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
            payload: {
                objectId: responseObject.id,
                ownerId: responseObject.ownerId,
                sourceAbilityId: 'mw.spell.1904.response',
                spellCardId: 1904,
            },
            sourceCommandType: context.sourceCommandType,
            timestamp,
        }, {
            type: MAGE_WARS_EVENTS.SPELL_DISCARDED,
            payload: {
                playerId: responseObject.ownerId,
                spellCardId: responseObject.sourceSpellCardId,
                reason: 'enchantment-destroyed',
            },
            sourceCommandType: context.sourceCommandType,
            timestamp,
        });
        return {
            state: completeResolutionFrame(state, context.responseId),
            events,
        };
    }

    events.push({
        type: MAGE_WARS_EVENTS.ATTACK_REVERSED,
        payload: {
            responseObjectId: context.responseObjectId,
            attackerObjectId: context.attackerObjectId,
            defenderObjectId: context.defenderObjectId,
            attackProfileId: context.attackProfileId,
            unavoidable: context.unavoidable,
            reversed: !context.unavoidable,
        },
        sourceCommandType: context.sourceCommandType,
        timestamp,
    }, {
        type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
        payload: {
            objectId: responseObject.id,
            ownerId: responseObject.ownerId,
            sourceAbilityId: 'mw.spell.1904.response',
            spellCardId: 1904,
        },
        sourceCommandType: context.sourceCommandType,
        timestamp,
    }, {
        type: MAGE_WARS_EVENTS.SPELL_DISCARDED,
        payload: {
            playerId: responseObject.ownerId,
            spellCardId: responseObject.sourceSpellCardId,
            reason: 'enchantment-destroyed',
        },
        sourceCommandType: context.sourceCommandType,
        timestamp,
    });

    const continuation = context.unavoidable
        ? resolveMageWarsObjectAttackEvents({
            state,
            sourceCommandType: context.sourceCommandType,
            timestamp,
            random,
            attackerObjectId: originalAttacker.id,
            attackProfileId: context.attackProfileId,
            targetObjectId: originalDefender.id,
            actionCost: 'none',
            allowDefenseOpportunity: false,
            allowCounterstrikeOpportunity: context.allowCounterstrikeOpportunity,
            removeGuardAfterMelee: context.removeGuardAfterMelee,
            counterstrikeSourceObjectId: context.counterstrikeSourceObjectId,
            isCounterstrike: context.isCounterstrike,
            skipPreDefenseEffects: true,
        })
        : resolveMageWarsObjectAttackEvents({
            state,
            sourceCommandType: context.sourceCommandType,
            timestamp,
            random,
            attackerObjectId: originalDefender.id,
            attackProfileId: context.attackProfileId,
            targetObjectId: originalAttacker.id,
            actionCost: 'none',
            allowDefenseOpportunity: false,
            allowCounterstrikeOpportunity: context.allowCounterstrikeOpportunity,
            removeGuardAfterMelee: context.removeGuardAfterMelee,
            counterstrikeSourceObjectId: context.counterstrikeSourceObjectId,
            isCounterstrike: context.isCounterstrike,
            skipPreDefenseEffects: true,
            attackProfileOverride: originalAttackProfile,
            ignoreTargetLegality: true,
        });

    events.push(...continuation);
    return {
        state: completeResolutionFrame(state, context.responseId),
        events,
    };
}

export function createMageWarsInteractionSystem(): EngineSystem<MageWarsCore> {
    return {
        id: 'mage-wars-interactions',
        name: '法师战争交互系统',
        priority: 30,

        afterEvents: (ctx) => {
            let nextState = ctx.state;
            let changed = false;
            const events: GameEvent[] = [];

            for (const event of ctx.events) {
                if (isSpellCastResolvedEvent(event)) {
                    if (event.payload.caster.kind !== 'arena-object') continue;
                    const caster = nextState.core.objects[event.payload.caster.objectId];
                    if (
                        !caster
                        || caster.kind !== 'creature'
                        || caster.ownerId !== event.payload.caster.ownerId
                        || !caster.spellcastingSource
                    ) continue;

                    const curseSources = Object.values(nextState.core.objects).filter((object) => (
                        object.kind === 'enchantment'
                        && object.sourceSpellCardId === 1804
                        && object.anchoredToObjectId === caster.id
                    ));
                    for (const _source of curseSources) {
                        events.push(...createDamageCalculation({
                            state: nextState,
                            source: { playerId: caster.ownerId, abilityId: 'mw.spell.1804' },
                            target: { playerId: caster.id },
                            baseDamage: 1,
                            autoCollectTokens: false,
                            autoCollectStatus: false,
                            autoCollectBonusDamage: false,
                            damageScope: 'direct',
                            timestamp: event.timestamp ?? 0,
                        }).toEvents() as MageWarsEvent[]);
                    }
                    continue;
                }

                if (isInteractionResolvedEvent(event)) {
                    if (event.payload.sourceId === MAGE_WARS_INTERACTION_SOURCE_IDS.ENCHANTMENT_RESPONSE_REVEAL) {
                        if (!isEnchantmentResponseChoiceValue(event.payload.value)) continue;
                        const frame = getActiveResolutionFrame(nextState);
                        const context = readMageWarsResponseContext(frame);
                        if (
                            !context
                            || context.responseId !== event.payload.value.responseId
                            || context.responseObjectId !== event.payload.value.responseObjectId
                            || context.responseCardId !== event.payload.value.responseCardId
                        ) {
                            continue;
                        }

                        const resolved = resolveMageWarsEnchantmentResponse(
                            nextState,
                            context,
                            ctx.random,
                            event.timestamp ?? 0,
                        );
                        nextState = resolved.state;
                        changed = true;
                        events.push(...resolved.events);
                        continue;
                    }
                    if (event.payload.sourceId === MAGE_WARS_INTERACTION_SOURCE_IDS.UPKEEP_COST_CHOICE) {
                        if (!isUpkeepCostChoiceValue(event.payload.value)) continue;

                        const source = nextState.core.objects[event.payload.value.sourceObjectId];
                        const player = nextState.core.players[event.payload.value.playerId];
                        if (
                            !source
                            || source.kind !== 'enchantment'
                            || source.sourceSpellCardId !== event.payload.value.sourceSpellCardId
                            || source.anchoredToObjectId !== event.payload.value.targetObjectId
                            || event.payload.value.playerId !== nextState.core.objects[event.payload.value.targetObjectId]?.ownerId
                        ) {
                            continue;
                        }

                        if (event.payload.value.action === 'pay' && player && player.mana >= event.payload.value.amount) {
                            events.push({
                                type: MAGE_WARS_EVENTS.MANA_SPENT,
                                payload: {
                                    playerId: player.id,
                                    amount: event.payload.value.amount,
                                    sourceAbilityId: `mw.spell.${source.sourceSpellCardId}.upkeep`,
                                    spellCardId: source.sourceSpellCardId,
                                    targetObjectId: event.payload.value.targetObjectId,
                                },
                                sourceCommandType: ctx.command.type,
                                timestamp: event.timestamp,
                            });
                        } else {
                            events.push({
                                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
                                payload: {
                                    objectId: source.id,
                                    ownerId: source.ownerId,
                                    sourceAbilityId: `mw.spell.${source.sourceSpellCardId}.upkeep`,
                                    spellCardId: source.sourceSpellCardId,
                                },
                                sourceCommandType: ctx.command.type,
                                timestamp: event.timestamp,
                            });
                        }
                        continue;
                    }
                    if (event.payload.sourceId === MAGE_WARS_INTERACTION_SOURCE_IDS.COUNTERSTRIKE_CHOICE) {
                        if (!isCounterstrikeChoiceValue(event.payload.value)) continue;
                        if (event.payload.value.action === 'pass') continue;

                        events.push(...resolveMageWarsObjectAttackEvents({
                            state: nextState,
                            sourceCommandType: ctx.command.type,
                            timestamp: event.timestamp,
                            random: ctx.random,
                            attackerObjectId: event.payload.value.defenderObjectId,
                            attackProfileId: event.payload.value.counterstrikeAttackProfileId,
                            targetObjectId: event.payload.value.attackerObjectId,
                            actionCost: 'none',
                            allowCounterstrikeOpportunity: false,
                            removeGuardAfterMelee: false,
                            counterstrikeSourceObjectId: event.payload.value.counterstrikeSourceObjectId,
                            isCounterstrike: true,
                        }));
                        continue;
                    }
                    if (event.payload.sourceId !== MAGE_WARS_INTERACTION_SOURCE_IDS.DEFENSE_CHOICE) continue;
                    if (!isDefenseChoiceValue(event.payload.value)) continue;

                    if (event.payload.value.action === 'pass') {
                        events.push(...resolveAttackAfterDefenseChoice(
                            nextState,
                            ctx.command.type,
                            event.timestamp,
                            ctx.random,
                            event.payload.value,
                        ));
                        continue;
                    }

                    const defenseProfile = event.payload.value.defenderObjectId
                        ? getMageWarsObjectDefenseProfile(
                            nextState.core.objects[event.payload.value.defenderObjectId],
                            event.payload.value.defenseProfileId,
                            nextState.core,
                        )
                        : event.payload.value.defenderId
                            ? getMageWarsPlayerDefenseProfile(
                                nextState.core,
                                nextState.core.players[event.payload.value.defenderId] ?? { id: event.payload.value.defenderId },
                                event.payload.value.defenseProfileId,
                            )
                            : undefined;
                    if (defenseProfile && isMageWarsObjectDefenseProfileAutomatic(defenseProfile)) {
                        events.push({
                            type: MAGE_WARS_EVENTS.ATTACK_MISSED,
                            payload: {
                                attackerObjectId: event.payload.value.attackerObjectId,
                                targetPlayerId: event.payload.value.defenderId,
                                targetObjectId: event.payload.value.defenderObjectId,
                                sourceAbilityId: `mw.defense.${event.payload.value.defenseProfileId}`,
                                defenseProfileId: event.payload.value.defenseProfileId,
                            },
                            sourceCommandType: ctx.command.type,
                            timestamp: event.timestamp,
                        });
                        const consumedSource = defenseProfile.consumesSource && defenseProfile.sourceObjectId
                            ? createMageWarsArenaObjectSourceConsumedEvent(
                                nextState.core,
                                defenseProfile.sourceObjectId,
                                ctx.command.type,
                                event.timestamp,
                                'mw.enchantment.block.consume',
                            )
                            : undefined;
                        if (consumedSource) events.push(consumedSource);
                        continue;
                    }

                    const defenseEvents = event.payload.value.defenderObjectId
                        ? resolveMageWarsArenaObjectDefenseEvents({
                            state: nextState,
                            sourceCommandType: ctx.command.type,
                            timestamp: event.timestamp,
                            random: ctx.random,
                            defenderObjectId: event.payload.value.defenderObjectId,
                            defenseProfileId: event.payload.value.defenseProfileId,
                        })
                        : event.payload.value.defenderId
                            ? resolveMageWarsMageDefenseEvents({
                                state: nextState,
                                sourceCommandType: ctx.command.type,
                                timestamp: event.timestamp,
                                random: ctx.random,
                                defenderId: event.payload.value.defenderId,
                                defenseProfileId: event.payload.value.defenseProfileId,
                            })
                            : [];
                    events.push(...defenseEvents);
                    const defenseRoll = defenseEvents.find((candidate) => (
                        candidate.type === MAGE_WARS_EVENTS.ARENA_OBJECT_DEFENSE_ROLLED
                        || candidate.type === MAGE_WARS_EVENTS.MAGE_DEFENSE_ROLLED
                    )) as MageWarsArenaObjectDefenseRolledEvent | undefined;
                    if (defenseRoll?.payload.success) {
                        events.push({
                            type: MAGE_WARS_EVENTS.ATTACK_MISSED,
                            payload: {
                                attackerObjectId: event.payload.value.attackerObjectId,
                                targetPlayerId: event.payload.value.defenderId,
                                targetObjectId: event.payload.value.defenderObjectId,
                                sourceAbilityId: `mw.defense.${event.payload.value.defenseProfileId}`,
                                defenseProfileId: event.payload.value.defenseProfileId,
                                effectDieResult: defenseRoll.payload.rawEffectDieResult,
                            },
                            sourceCommandType: ctx.command.type,
                            timestamp: event.timestamp,
                        });
                        const consumedSource = event.payload.value.counterstrikeSourceObjectId
                            ? createMageWarsCounterstrikeSourceConsumedEvent(
                                nextState.core,
                                event.payload.value.counterstrikeSourceObjectId,
                                ctx.command.type,
                                event.timestamp,
                            )
                            : undefined;
                        if (consumedSource) events.push(consumedSource);
                    } else {
                        events.push(...resolveAttackAfterDefenseChoice(
                            nextState,
                            ctx.command.type,
                            event.timestamp,
                            ctx.random,
                            event.payload.value,
                        ));
                    }
                    continue;
                }

                if (isEnchantmentResponseRequiredEvent(event)) {
                    const context = event.payload.context;
                    if (hasInteractionQueued(nextState, event.payload.interactionId)) continue;

                    nextState = upsertActiveResolutionFrame(
                        nextState,
                        createMageWarsResponseFrame(context),
                    );
                    nextState = queueInteraction(nextState, createEnchantmentResponseChoice(event));
                    changed = true;
                    events.push({
                        type: RESPONSE_WINDOW_EVENTS.OPENED,
                        payload: {
                            windowId: context.responseId,
                            responderQueue: [context.responseOwnerId],
                            windowType: event.payload.windowType,
                            sourceId: context.responseId,
                            resolutionFrameId: context.responseId,
                            requiredInteractionId: event.payload.interactionId,
                        },
                        sourceCommandType: ctx.command.type,
                        timestamp: event.timestamp,
                    }, {
                        type: MAGE_WARS_EVENTS.RESPONSE_INTERACTION_REQUESTED,
                        payload: {
                            interaction: {
                                id: event.payload.interactionId,
                                playerId: context.responseOwnerId,
                            },
                        },
                        sourceCommandType: ctx.command.type,
                        timestamp: event.timestamp,
                    });
                    continue;
                }

                if (isDefenseAvailableEvent(event)) {
                    const interaction = createDefenseChoice(event);
                    if (hasInteractionQueued(nextState, interaction.id)) continue;

                    nextState = queueInteraction(nextState, interaction);
                    changed = true;
                    continue;
                }

                if (isUpkeepCostAvailableEvent(event)) {
                    if (!nextState.core.objects[event.payload.sourceObjectId]) continue;
                    const interaction = createUpkeepCostChoice(nextState, event);
                    if (hasInteractionQueued(nextState, interaction.id)) continue;

                    nextState = queueInteraction(nextState, interaction);
                    changed = true;
                    continue;
                }

                if (!isCounterstrikeAvailableEvent(event)) continue;

                const interaction = createCounterstrikeChoice(event);
                if (hasInteractionQueued(nextState, interaction.id)) continue;

                nextState = queueInteraction(nextState, interaction);
                changed = true;
            }

            if (!changed && events.length === 0) return undefined;
            return {
                ...(changed ? { state: nextState } : {}),
                ...(events.length > 0 ? { events } : {}),
            };
        },
    };
}
