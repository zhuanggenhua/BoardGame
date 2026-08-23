import type { GameEvent, MatchState, RandomFn } from '../../../engine/types';
import { INTERACTION_EVENTS } from '../../../engine/systems/InteractionSystem';
import type { EngineSystem } from '../../../engine/systems/types';
import {
    completeResolutionFrame,
    getActiveResolutionFrame,
} from '../../../engine/systems/resolutionStack';
import {
    MAGE_WARS_EVENTS,
    type MageWarsArenaObjectDefenseRolledEvent,
    type MageWarsEvent,
} from './events';
import {
    resolveMageWarsBasicAttackEvents,
    resolveMageWarsMageDefenseEvents,
    resolveMageWarsArenaObjectDefenseEvents,
    resolveMageWarsObjectAttackEvents,
} from './execute';
import {
    createMageWarsArenaObjectSourceConsumeAvailableEvent,
    createMageWarsCounterstrikeSourceConsumeAvailableEvent,
} from './sourceConsumeEvents';
import { resolveMageWarsSpellAttackAfterDefense } from './spellAbilityExecutors';
import {
    getMageWarsPlayerDefenseProfile,
    getMageWarsObjectDefenseProfile,
    getMageWarsObjectAttackProfile,
    isMageWarsObjectDefenseProfileAutomatic,
    isMageWarsLivingArenaObject,
    isMageWarsHiddenResponseCardId,
    isMageWarsTargetSpellCounterResponseCardId,
    type MageWarsHiddenResponseCardId,
} from './spellRules';
import type { MageWarsCore } from './types';
import {
    readMageWarsResponseContext,
    type MageWarsResponseContext,
} from './responseResolution';
import { getArenaObject } from './utils';

export const MAGE_WARS_INTERACTION_SOURCE_IDS = {
    COUNTERSTRIKE_CHOICE: 'mw.counterstrike.choice',
    DEFENSE_CHOICE: 'mw.defense.choice',
    UPKEEP_COST_CHOICE: 'mw.upkeep-cost.choice',
    UPKEEP_HEAL_TRANSFER_CHOICE: 'mw.upkeep-heal-transfer.choice',
    ENCHANTMENT_RESPONSE_REVEAL: 'mw.enchantment-response.reveal',
} as const;

export type MageWarsEnchantmentResponseChoiceValue = {
    action: 'reveal';
    responseId: string;
    responseObjectId: string;
    responseCardId: MageWarsHiddenResponseCardId;
};

export type MageWarsUpkeepCostChoiceValue = {
    action: 'pay' | 'destroy';
    playerId: string;
    sourceObjectId: string;
    sourceSpellCardId: number;
    targetObjectId: string;
    amount: number;
};

export type MageWarsUpkeepHealTransferChoiceValue =
    | {
        action: 'heal';
        playerId: string;
        sourceObjectId: string;
        sourceSpellCardId: number;
        targetObjectId: string;
        maxHealing: number;
        amount: number;
    }
    | {
        action: 'skip';
        playerId: string;
        sourceObjectId: string;
        sourceSpellCardId: number;
        targetObjectId: string;
        maxHealing: number;
        amount: 0;
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

function isUpkeepHealTransferChoiceValue(value: unknown): value is MageWarsUpkeepHealTransferChoiceValue {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<MageWarsUpkeepHealTransferChoiceValue>;
    if (candidate.action !== 'heal' && candidate.action !== 'skip') return false;
    if (
        typeof candidate.playerId !== 'string'
        || typeof candidate.sourceObjectId !== 'string'
        || typeof candidate.sourceSpellCardId !== 'number'
        || typeof candidate.targetObjectId !== 'string'
        || typeof candidate.maxHealing !== 'number'
        || !Number.isInteger(candidate.maxHealing)
        || candidate.maxHealing <= 0
        || typeof candidate.amount !== 'number'
        || !Number.isInteger(candidate.amount)
    ) {
        return false;
    }
    return candidate.action === 'skip'
        ? candidate.amount === 0
        : candidate.amount > 0;
}

function isEnchantmentResponseChoiceValue(value: unknown): value is MageWarsEnchantmentResponseChoiceValue {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<MageWarsEnchantmentResponseChoiceValue>;
    return candidate.action === 'reveal'
        && typeof candidate.responseId === 'string'
        && typeof candidate.responseObjectId === 'string'
        && isMageWarsHiddenResponseCardId(candidate.responseCardId);
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
    const responseSourceConsumed = createMageWarsArenaObjectSourceConsumeAvailableEvent(
        state.core,
        responseObject.id,
        context.sourceCommandType,
        timestamp,
        `mw.spell.${context.responseCardId}.response`,
    );

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
        }, ...(isMageWarsTargetSpellCounterResponseCardId(context.responseCardId) && context.caster.kind === 'mage' ? [{
            type: MAGE_WARS_EVENTS.SPELL_DISCARDED,
            payload: {
                playerId: context.triggeringPlayerId,
                spellCardId: context.spellCardId,
                reason: 'cast-countered' as const,
            },
            sourceCommandType: context.sourceCommandType,
            timestamp,
        }] : []), ...(responseSourceConsumed ? [responseSourceConsumed] : []), {
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
        events.push(...(responseSourceConsumed ? [responseSourceConsumed] : []), {
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
    }, ...(responseSourceConsumed ? [responseSourceConsumed] : []), {
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
                            const consumedSource = createMageWarsArenaObjectSourceConsumeAvailableEvent(
                                nextState.core,
                                source.id,
                                ctx.command.type,
                                event.timestamp,
                                `mw.spell.${source.sourceSpellCardId}.upkeep`,
                            );
                            if (consumedSource) events.push(consumedSource);
                        }
                        continue;
                    }
                    if (event.payload.sourceId === MAGE_WARS_INTERACTION_SOURCE_IDS.UPKEEP_HEAL_TRANSFER_CHOICE) {
                        if (!isUpkeepHealTransferChoiceValue(event.payload.value)) continue;
                        if (event.payload.value.action === 'skip') continue;

                        const source = nextState.core.objects[event.payload.value.sourceObjectId];
                        const player = nextState.core.players[event.payload.value.playerId];
                        const target = getArenaObject(nextState.core, event.payload.value.targetObjectId);
                        if (
                            !source
                            || !player
                            || !target
                            || source.kind !== 'enchantment'
                            || source.sourceSpellCardId !== event.payload.value.sourceSpellCardId
                            || source.anchoredToObjectId !== target.id
                            || source.ownerId !== player.id
                            || !isMageWarsLivingArenaObject(target)
                        ) {
                            continue;
                        }

                        const maxAllowedHealing = Math.min(event.payload.value.maxHealing, player.damage);
                        if (event.payload.value.amount > maxAllowedHealing) continue;

                        const actualHealing = event.payload.value.amount;
                        if (actualHealing <= 0) continue;

                        const sourceAbilityId = `mw.spell.${source.sourceSpellCardId}.upkeep`;
                        events.push({
                            type: MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
                            payload: {
                                playerId: player.id,
                                spellCardId: source.sourceSpellCardId,
                                sourceAbilityId,
                                targetPlayerId: player.id,
                                diceResults: [],
                                healing: event.payload.value.amount,
                                actualHealing,
                            },
                            sourceCommandType: ctx.command.type,
                            timestamp: event.timestamp,
                        });

                        events.push({
                            type: MAGE_WARS_EVENTS.UPKEEP_HEAL_TRANSFER_DAMAGE_AVAILABLE,
                            payload: {
                                playerId: player.id,
                                sourceObjectId: source.id,
                                sourceSpellCardId: source.sourceSpellCardId,
                                targetObjectId: target.id,
                                amount: actualHealing,
                            },
                            sourceCommandType: ctx.command.type,
                            timestamp: event.timestamp,
                        });
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
                            ? createMageWarsArenaObjectSourceConsumeAvailableEvent(
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
                            ? createMageWarsCounterstrikeSourceConsumeAvailableEvent(
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

            }

            if (!changed && events.length === 0) return undefined;
            return {
                ...(changed ? { state: nextState } : {}),
                ...(events.length > 0 ? { events } : {}),
            };
        },
    };
}
