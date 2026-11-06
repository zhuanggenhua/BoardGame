import type { RandomFn } from '../../../engine/types';
import type {
    DiceThroneCore,
    DiceThroneEvent,
    AttackPreDefenseResolvedEvent,
    AttackDefenseResolvedEvent,
    AttackResolvedEvent,
} from './types';
import { resolveEffectsToEvents, type EffectContext, type EffectResolutionCheckpoint } from './effects';
import { getPlayerAbilityEffects } from './abilityLookup';
import { applyEvents, getPendingAttackExpectedDamage } from './utils';
import { reduce } from './reducer';
import { hasPendingBonusDiceSettlement } from './rules';
import { STATUS_IDS } from './ids';
import { getCustomActionMeta } from './effects';
import type { PendingAttackUpdatedEvent, StatusRemovedEvent } from './types';
import {
    attachAttackEffectContinuation,
    isAttackEffectSequenceBlocker,
    type AttackEffectContinuationPayload,
    type AttackEffectContinuationStage,
} from './attackEffectContinuationTypes';

type EffectResumeOptions = NonNullable<AttackEffectContinuationPayload['resolverOptions']>;

function addEffectContinuation(
    event: DiceThroneEvent,
    pending: NonNullable<DiceThroneCore['pendingAttack']>,
    stage: AttackEffectContinuationStage,
    effectSourceAbilityId: string,
    checkpoint: EffectResolutionCheckpoint,
    resolverOptions?: EffectResumeOptions,
): void {
    attachAttackEffectContinuation(event, {
        kind: 'attack-effect-sequence',
        stage,
        attackerId: pending.attackerId,
        defenderId: pending.defenderId,
        attackSourceAbilityId: pending.sourceAbilityId,
        effectSourceAbilityId,
        checkpoint,
        resolverOptions,
    });
}

function hasAttackEffectContinuation(events: DiceThroneEvent[]): boolean {
    return events.some((event) => event.resolutionContinuation?.action === 'resume-attack-effect-sequence');
}

function updateAttackStageForContinuation(
    pending: NonNullable<DiceThroneCore['pendingAttack']>,
    timestamp: number,
): PendingAttackUpdatedEvent {
    return {
        type: 'PENDING_ATTACK_UPDATED',
        payload: {
            attackerId: pending.attackerId,
            patch: { settlementStage: 'readyToResolve' },
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    };
}

export const orderPowderKegExplosionBeforeAttackDamage = (
    events: DiceThroneEvent[],
): DiceThroneEvent[] => {
    const ordered = [...events];

    while (true) {
        let movedExplosion = false;

        for (let index = 0; index + 2 < ordered.length; index += 1) {
            const removed = ordered[index];
            const explosion = ordered[index + 1];
            const reapplied = ordered[index + 2];
            if (
                removed.type !== 'STATUS_REMOVED'
                || removed.payload.statusId !== STATUS_IDS.POWDER_KEG
                || explosion.type !== 'DAMAGE_DEALT'
                || explosion.payload.targetId !== removed.payload.targetId
                || explosion.payload.sourceAbilityId === undefined
                || explosion.payload.damageScope !== 'direct'
                || reapplied.type !== 'STATUS_APPLIED'
                || reapplied.payload.statusId !== STATUS_IDS.POWDER_KEG
                || reapplied.payload.targetId !== removed.payload.targetId
                || reapplied.payload.sourceAbilityId !== explosion.payload.sourceAbilityId
            ) {
                continue;
            }

            const attackDamageIndex = ordered.findIndex(event => (
                event.type === 'DAMAGE_DEALT'
                && event.payload.targetId === removed.payload.targetId
                && event.payload.sourceAbilityId === explosion.payload.sourceAbilityId
                && event.payload.damageScope === 'attack'
            ));
            if (attackDamageIndex < 0 || attackDamageIndex >= index) continue;

            const [removedEvent, explosionEvent, reappliedEvent] = ordered.splice(index, 3);
            ordered.splice(attackDamageIndex, 0, removedEvent, explosionEvent, reappliedEvent);
            movedExplosion = true;
            break;
        }

        if (!movedExplosion) return ordered;
    }
};

const pendingAttackHasAttackScopedDamage = (state: DiceThroneCore): boolean => {
    const pending = state.pendingAttack;
    if (!pending?.sourceAbilityId) return false;
    const effects = getPlayerAbilityEffects(state, pending.attackerId, pending.sourceAbilityId);
    return effects.some(effect => {
        const action = effect.action;
        if (!action) return false;
        if (action.type === 'damage') {
            return (action.damageScope ?? 'attack') === 'attack'
                && (action.damageOrigin ?? 'ability') === 'ability';
        }
        if (action.type === 'custom' && action.customActionId) {
            return (action.damageOrigin ?? 'ability') === 'ability'
                && (getCustomActionMeta(action.customActionId)?.categories.includes('damage') ?? false);
        }
        return false;
    });
};

const buildZhizhuxiaWebbedTriggerEvents = (
    state: DiceThroneCore,
    timestamp: number,
): DiceThroneEvent[] => {
    const pending = state.pendingAttack;
    if (
        !pending
        || !pending.defenderId
        || pending.zhizhuxiaWebbedTriggeredThisAttack
        || !pendingAttackHasAttackScopedDamage(state)
    ) {
        return [];
    }

    const defender = state.players[pending.defenderId];
    const webbedStacks = defender?.statusEffects[STATUS_IDS.WEBBED] ?? 0;
    if (webbedStacks <= 0) return [];

    return [
        {
            type: 'PENDING_ATTACK_UPDATED',
            payload: {
                attackerId: pending.attackerId,
                patch: {
                    isDefendable: false,
                    zhizhuxiaWebbedTriggeredThisAttack: true,
                    zhizhuxiaWebbedWasPresentAtStart: true,
                },
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as PendingAttackUpdatedEvent,
        {
            type: 'STATUS_REMOVED',
            payload: {
                targetId: pending.defenderId,
                statusId: STATUS_IDS.WEBBED,
                stacks: webbedStacks,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 0.001,
        } as StatusRemovedEvent,
    ];
};

const isInteractiveBonusDiceRerollEvent = (event: DiceThroneEvent): boolean =>
    event.type === 'BONUS_DICE_REROLL_REQUESTED' && hasPendingBonusDiceSettlement(event.payload.settlement);

const createPreDefenseResolvedEvent = (
    attackerId: string,
    defenderId: string | undefined,
    sourceAbilityId: string | undefined,
    timestamp: number
): AttackPreDefenseResolvedEvent => ({
    type: 'ATTACK_PRE_DEFENSE_RESOLVED',
    payload: {
        attackerId,
        defenderId,
        sourceAbilityId,
    },
    sourceCommandType: 'ABILITY_EFFECT',
    timestamp,
});

const createDefenseResolvedEvent = (
    attackerId: string,
    defenderId: string,
    defenseAbilityId: string | undefined,
    timestamp: number
): AttackDefenseResolvedEvent => ({
    type: 'ATTACK_DEFENSE_RESOLVED',
    payload: {
        attackerId,
        defenderId,
        defenseAbilityId,
    },
    sourceCommandType: 'ABILITY_EFFECT',
    timestamp,
});

export const resolveOffensivePreDefenseEffects = (
    state: DiceThroneCore,
    random?: RandomFn,
    timestamp: number = 0,
    startEffectIndex = 0,
    checkpoint?: EffectResolutionCheckpoint,
): DiceThroneEvent[] => {
    const pending = state.pendingAttack;
    if (!pending || pending.preDefenseResolved) return [];

    const { attackerId, defenderId, sourceAbilityId } = pending;
    const effectDefenderId = defenderId ?? attackerId;
    if (!sourceAbilityId) {
        return [createPreDefenseResolvedEvent(attackerId, defenderId, sourceAbilityId, timestamp)];
    }

    const effects = getPlayerAbilityEffects(state, attackerId, sourceAbilityId);
    const ctx: EffectContext = {
        attackerId,
        // 4 人 / 2v2 下存在“无伤害、无默认 defender”的进攻技能；
        // 这类技能的 self-target preDefense 效果仍必须执行，不能因为 defenderId 缺失被整段跳过。
        defenderId: effectDefenderId,
        sourceAbilityId,
        state,
        damageDealt: 0,
        timestamp,
    };

    const events: DiceThroneEvent[] = [];
    events.push(...buildZhizhuxiaWebbedTriggerEvents(state, timestamp));
    events.push(...resolveEffectsToEvents(effects, 'preDefense', ctx, {
        random,
        startEffectIndex,
        checkpoint,
        onEffectSuspended: (effectCheckpoint, event) => {
            addEffectContinuation(event, pending, 'preDefense', sourceAbilityId, effectCheckpoint);
        },
    }));
    if (hasAttackEffectContinuation(events)) return events;
    events.push(createPreDefenseResolvedEvent(attackerId, defenderId, sourceAbilityId, timestamp));
    return events;
};

const resolveDefenseEffects = (
    state: DiceThroneCore,
    random: RandomFn,
    timestamp: number,
    resume?: {
        stage: 'defenseWithDamage' | 'defensePostDamage';
        checkpoint: EffectResolutionCheckpoint;
    },
): { defenseEvents: DiceThroneEvent[]; stateAfterDefense: DiceThroneCore } => {
    const pending = state.pendingAttack;
    if (!pending?.defenseAbilityId || !pending.defenderId || pending.defenseResolved || pending.isDefendable === false) {
        return { defenseEvents: [], stateAfterDefense: state };
    }

    const { attackerId, defenderId, defenseAbilityId } = pending;
    const defenseEffects = getPlayerAbilityEffects(state, defenderId, defenseAbilityId);
    const defenseCtx: EffectContext = {
        attackerId: defenderId,
        defenderId: attackerId,
        sourceAbilityId: defenseAbilityId,
        state,
        damageDealt: 0,
        timestamp,
        isDefensiveContext: true,
    };

    const defenseEvents: DiceThroneEvent[] = [];
    const shouldResumeWithDamage = resume?.stage === 'defenseWithDamage';
    const withDamageEvents = resume?.stage === 'defensePostDamage'
        ? []
        : resolveEffectsToEvents(defenseEffects, 'withDamage', defenseCtx, {
            random,
            ...(shouldResumeWithDamage ? { startEffectIndex: resume.checkpoint.nextEffectIndex, checkpoint: resume.checkpoint } : {}),
            onEffectSuspended: (checkpoint, event) => {
                addEffectContinuation(event, pending, 'defenseWithDamage', defenseAbilityId, checkpoint);
            },
        });
    defenseEvents.push(...withDamageEvents);
    if (hasAttackEffectContinuation(withDamageEvents)) {
        return { defenseEvents, stateAfterDefense: applyEvents(state, defenseEvents, reduce) };
    }

    const shouldResumePostDamage = resume?.stage === 'defensePostDamage';
    const postDamageEvents = resolveEffectsToEvents(defenseEffects, 'postDamage', defenseCtx, {
        random,
        ...(shouldResumePostDamage ? { startEffectIndex: resume.checkpoint.nextEffectIndex, checkpoint: resume.checkpoint } : {}),
        onEffectSuspended: (checkpoint, event) => {
            addEffectContinuation(event, pending, 'defensePostDamage', defenseAbilityId, checkpoint);
        },
    });
    defenseEvents.push(...postDamageEvents);
    if (hasAttackEffectContinuation(postDamageEvents)) {
        return { defenseEvents, stateAfterDefense: applyEvents(state, defenseEvents, reduce) };
    }

    defenseEvents.push(createDefenseResolvedEvent(attackerId, defenderId, defenseAbilityId, timestamp));

    if (defenseEvents.length === 0) {
        return { defenseEvents, stateAfterDefense: state };
    }

    const stateAfterDefense = applyEvents(state, defenseEvents, reduce);
    return { defenseEvents, stateAfterDefense };
};

export const resolveAttack = (
    state: DiceThroneCore,
    random: RandomFn,
    options?: { includePreDefense?: boolean; skipTokenResponse?: boolean; skipDefense?: boolean },
    timestamp: number = 0
): DiceThroneEvent[] => {
    const pending = state.pendingAttack;
    if (!pending) {
        return [];
    }

    if (!pending.defenderId) {
        const { attackerId, sourceAbilityId, defenseAbilityId } = pending;
        const events: DiceThroneEvent[] = [];

        if (sourceAbilityId) {
            const effects = getPlayerAbilityEffects(state, attackerId, sourceAbilityId);
            const attackCtx: EffectContext = {
                attackerId,
                defenderId: attackerId,
                sourceAbilityId,
                state,
                damageDealt: 0,
                timestamp,
            };
            const withDamageEvents = resolveEffectsToEvents(effects, 'withDamage', attackCtx, {
                bonusDamage: pending.bonusDamage ?? 0,
                bonusDamageOnce: true,
                random,
                skipDamage: true,
                onEffectSuspended: (checkpoint, event) => {
                    addEffectContinuation(event, pending, 'attackWithDamage', sourceAbilityId, checkpoint, {
                        bonusDamageOnce: true,
                        skipDamage: true,
                    });
                },
            });
            events.push(...withDamageEvents);
            if (hasAttackEffectContinuation(withDamageEvents)) return events;

            const postDamageEvents = resolveEffectsToEvents(effects, 'postDamage', attackCtx, {
                random,
                onEffectSuspended: (checkpoint, event) => {
                    addEffectContinuation(event, pending, 'attackPostDamage', sourceAbilityId, checkpoint);
                },
            });
            events.push(...postDamageEvents);
            if (hasAttackEffectContinuation(postDamageEvents)) return events;
        }

        events.push({
            type: 'ATTACK_RESOLVED',
            payload: {
                attackerId,
                defenderId: undefined,
                sourceAbilityId,
                defenseAbilityId,
                totalDamage: 0,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as AttackResolvedEvent);
        return events;
    }

    const events: DiceThroneEvent[] = [];
    let stateAfterPreDefense = state;
    if (options?.includePreDefense) {
        const preDefenseEvents = resolveOffensivePreDefenseEffects(state, random, timestamp);
        events.push(...preDefenseEvents);

        const hasChoice = preDefenseEvents.some(isAttackEffectSequenceBlocker);
        const hasInteractiveBonusDiceReroll = preDefenseEvents.some(isInteractiveBonusDiceRerollEvent);
        if (hasChoice || hasInteractiveBonusDiceReroll) return events;

        stateAfterPreDefense = applyEvents(state, preDefenseEvents as DiceThroneEvent[], reduce);
    }

    const { attackerId, defenderId, sourceAbilityId, defenseAbilityId } = pending;
    // 奖励骰可以在防御效果中暂停。确认后恢复到 afterDefense，
    // 防御已经生效，不能再掷一次或重复授予防御结果。
    const shouldSkipDefense = options?.skipDefense === true || pending.settlementStage === 'afterDefense';
    const { defenseEvents, stateAfterDefense } = shouldSkipDefense
        ? { defenseEvents: [] as DiceThroneEvent[], stateAfterDefense: stateAfterPreDefense }
        : resolveDefenseEffects(stateAfterPreDefense, random, timestamp);
    const bonusDamage = stateAfterDefense.pendingAttack?.bonusDamage ?? pending.bonusDamage ?? 0;
    events.push(...defenseEvents);
    const hasDefenseChoice = defenseEvents.some(isAttackEffectSequenceBlocker);
    const hasDefenseTokenResponse = defenseEvents.some(e => e.type === 'TOKEN_RESPONSE_REQUESTED');
    const hasDefenseInteractiveBonusDiceReroll = defenseEvents.some(isInteractiveBonusDiceRerollEvent);
    if (hasDefenseChoice || hasDefenseTokenResponse || hasDefenseInteractiveBonusDiceReroll) {
        return events;
    }

    const attackEvents: DiceThroneEvent[] = [];
    let totalDamage = 0;
    if (sourceAbilityId) {
        const effects = getPlayerAbilityEffects(state, attackerId, sourceAbilityId);
        const attackCtx: EffectContext = {
            attackerId,
            defenderId,
            sourceAbilityId,
            state: stateAfterDefense,
            damageDealt: 0,
            timestamp,
        };

        const withDamageEvents = resolveEffectsToEvents(effects, 'withDamage', attackCtx, {
            bonusDamage,
            bonusDamageOnce: true,
            random,
            onEffectSuspended: (checkpoint, event) => {
                addEffectContinuation(event, stateAfterDefense.pendingAttack ?? pending, 'attackWithDamage', sourceAbilityId, checkpoint, {
                    bonusDamageOnce: true,
                });
            },
        });

        const hasTokenResponse = withDamageEvents.some(e => e.type === 'TOKEN_RESPONSE_REQUESTED');
        const hasInteractiveBonusDiceReroll = withDamageEvents.some(isInteractiveBonusDiceRerollEvent);
        const hasChoiceInWithDamage = withDamageEvents.some(isAttackEffectSequenceBlocker);
        if (hasTokenResponse || hasInteractiveBonusDiceReroll || hasChoiceInWithDamage) {
            attackEvents.push(...withDamageEvents);
            events.push(...attackEvents);
            return events;
        }

        attackEvents.push(...withDamageEvents);
        const resolvedPostDamageEvents = resolveEffectsToEvents(effects, 'postDamage', attackCtx, {
            random,
            onEffectSuspended: (checkpoint, event) => {
                addEffectContinuation(event, stateAfterDefense.pendingAttack ?? pending, 'attackPostDamage', sourceAbilityId, checkpoint);
            },
        });
        attackEvents.push(...resolvedPostDamageEvents);

        const postDamageEvents = attackEvents.slice(withDamageEvents.length);
        const hasChoiceInPostDamage = postDamageEvents.some(isAttackEffectSequenceBlocker);
        const hasTokenResponseInPostDamage = postDamageEvents.some(e => e.type === 'TOKEN_RESPONSE_REQUESTED');
        const hasBonusDiceRerollInPostDamage = postDamageEvents.some(isInteractiveBonusDiceRerollEvent);
        if (hasChoiceInPostDamage || hasTokenResponseInPostDamage || hasBonusDiceRerollInPostDamage) {
            events.push(...orderPowderKegExplosionBeforeAttackDamage(attackEvents));
            return events;
        }

        totalDamage = attackCtx.damageDealt;
    }
    events.push(...orderPowderKegExplosionBeforeAttackDamage(attackEvents));

    const resolvedEvent: AttackResolvedEvent = {
        type: 'ATTACK_RESOLVED',
        payload: {
            attackerId,
            defenderId,
            sourceAbilityId,
            defenseAbilityId,
            totalDamage,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    };
    events.push(resolvedEvent);

    return events;
};

export function resumeAttackEffectSequence(
    state: DiceThroneCore,
    cursor: AttackEffectContinuationPayload,
    random: RandomFn,
    timestamp: number,
): DiceThroneEvent[] {
    const pending = state.pendingAttack;
    if (!pending
        || pending.attackerId !== cursor.attackerId
        || pending.defenderId !== cursor.defenderId
        || pending.sourceAbilityId !== cursor.attackSourceAbilityId) {
        throw new Error('[DiceThrone] 攻击效果游标与当前攻击不匹配');
    }

    if (cursor.stage === 'preDefense') {
        return resolveOffensivePreDefenseEffects(
            state,
            random,
            timestamp,
            cursor.checkpoint.nextEffectIndex,
            cursor.checkpoint,
        );
    }

    if (cursor.stage === 'defenseWithDamage' || cursor.stage === 'defensePostDamage') {
        return resolveDefenseEffects(state, random, timestamp, {
            stage: cursor.stage,
            checkpoint: cursor.checkpoint,
        }).defenseEvents;
    }

    const effectAbilityId = cursor.effectSourceAbilityId;
    const isDefensiveContext = cursor.stage.startsWith('defense');
    if (isDefensiveContext) {
        throw new Error(`[DiceThrone] 不支持的防御效果游标阶段 ${cursor.stage}`);
    }
    const effects = getPlayerAbilityEffects(state, pending.attackerId, effectAbilityId);
    const effectContext: EffectContext = {
        attackerId: pending.attackerId,
        defenderId: pending.defenderId ?? pending.attackerId,
        sourceAbilityId: effectAbilityId,
        state,
        damageDealt: cursor.checkpoint.damageDealt,
        timestamp,
    };

    if (cursor.stage === 'attackWithDamage') {
        const resolverOptions = cursor.resolverOptions ?? {};
        const withDamageEvents = resolveEffectsToEvents(effects, 'withDamage', effectContext, {
            bonusDamage: resolverOptions.skipDamage ? undefined : pending.bonusDamage ?? 0,
            bonusDamageOnce: resolverOptions.bonusDamageOnce ?? true,
            random,
            skipDamage: resolverOptions.skipDamage,
            skipNonDamage: resolverOptions.skipNonDamage,
            continueAfterFirstDamage: resolverOptions.continueAfterFirstDamage,
            startEffectIndex: cursor.checkpoint.nextEffectIndex,
            checkpoint: cursor.checkpoint,
            onEffectSuspended: (checkpoint, event) => {
                addEffectContinuation(event, pending, 'attackWithDamage', effectAbilityId, checkpoint, resolverOptions);
            },
        });
        if (hasAttackEffectContinuation(withDamageEvents)) return withDamageEvents;

        const postDamageEvents = resolveEffectsToEvents(effects, 'postDamage', effectContext, {
            random,
            onEffectSuspended: (checkpoint, event) => {
                addEffectContinuation(event, pending, 'attackPostDamage', effectAbilityId, checkpoint);
            },
        });
        if (hasAttackEffectContinuation(postDamageEvents)) return [...withDamageEvents, ...postDamageEvents];
        const events = [...withDamageEvents, ...postDamageEvents];
        if (!pending.defenderId) {
            events.push({
                type: 'ATTACK_RESOLVED',
                payload: {
                    attackerId: pending.attackerId,
                    defenderId: undefined,
                    sourceAbilityId: pending.sourceAbilityId,
                    defenseAbilityId: pending.defenseAbilityId,
                    totalDamage: 0,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp,
            } as AttackResolvedEvent);
        } else {
            events.push(updateAttackStageForContinuation(pending, timestamp));
        }
        return events;
    }

    const postDamageEvents = resolveEffectsToEvents(effects, 'postDamage', effectContext, {
        random,
        startEffectIndex: cursor.checkpoint.nextEffectIndex,
        checkpoint: cursor.checkpoint,
        onEffectSuspended: (checkpoint, event) => {
            addEffectContinuation(event, pending, 'attackPostDamage', effectAbilityId, checkpoint);
        },
    });
    if (hasAttackEffectContinuation(postDamageEvents)) return postDamageEvents;
    if (!pending.defenderId) {
        return [...postDamageEvents, {
            type: 'ATTACK_RESOLVED',
            payload: {
                attackerId: pending.attackerId,
                defenderId: undefined,
                sourceAbilityId: pending.sourceAbilityId,
                defenseAbilityId: pending.defenseAbilityId,
                totalDamage: 0,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as AttackResolvedEvent];
    }
    return [...postDamageEvents, updateAttackStageForContinuation(pending, timestamp)];
}

export const resolveWithDamageAfterChoice = (
    state: DiceThroneCore,
    random: RandomFn,
    timestamp: number = 0
): DiceThroneEvent[] => {
    const pending = state.pendingAttack;
    if (!pending?.sourceAbilityId || !pending.defenderId) {
        return [];
    }

    const effects = getPlayerAbilityEffects(state, pending.attackerId, pending.sourceAbilityId);
    const attackCtx: EffectContext = {
        attackerId: pending.attackerId,
        defenderId: pending.defenderId,
        sourceAbilityId: pending.sourceAbilityId,
        state,
        damageDealt: pending.resolvedDamage ?? 0,
        timestamp,
    };

    return resolveEffectsToEvents(effects, 'withDamage', attackCtx, {
        bonusDamage: pending.bonusDamage ?? 0,
        bonusDamageOnce: true,
        random,
        skipNonDamage: true,
        onEffectSuspended: (checkpoint, event) => {
            addEffectContinuation(event, pending, 'attackWithDamage', pending.sourceAbilityId!, checkpoint, {
                bonusDamageOnce: true,
                skipNonDamage: true,
            });
        },
    });
};

export const resolveAttackWithSneakImmunityAfterDefense = (
    state: DiceThroneCore,
    random: RandomFn,
    timestamp: number = 0
): DiceThroneEvent[] => {
    const pending = state.pendingAttack;
    if (!pending || !pending.defenderId) {
        return [];
    }

    const { attackerId, defenderId, sourceAbilityId, defenseAbilityId } = pending;
    const { defenseEvents, stateAfterDefense } = resolveDefenseEffects(state, random, timestamp);
    const events: DiceThroneEvent[] = [...defenseEvents];
    if (hasAttackEffectContinuation(defenseEvents)) return events;
    const totalDamage = getPendingAttackExpectedDamage(stateAfterDefense, pending, 1);

    if (sourceAbilityId) {
        const effects = getPlayerAbilityEffects(state, attackerId, sourceAbilityId);
        const attackCtx: EffectContext = {
            attackerId,
            defenderId,
            sourceAbilityId,
            state: stateAfterDefense,
            damageDealt: totalDamage,
            timestamp,
        };

        const withDamageEvents = resolveEffectsToEvents(effects, 'withDamage', attackCtx, {
            bonusDamage: pending.bonusDamage ?? 0,
            bonusDamageOnce: true,
            random,
            skipDamage: true,
            onEffectSuspended: (checkpoint, event) => {
                addEffectContinuation(event, pending, 'attackWithDamage', sourceAbilityId, checkpoint, {
                    bonusDamageOnce: true,
                    skipDamage: true,
                });
            },
        });
        events.push(...withDamageEvents.filter((event) => (
            event.type !== 'DAMAGE_DEALT'
            || event.payload.targetId !== defenderId
            || event.payload.damageScope === 'direct'
        )));
        if (hasAttackEffectContinuation(withDamageEvents)) return events;
        const postDamageEvents = resolveEffectsToEvents(effects, 'postDamage', attackCtx, {
            random,
            onEffectSuspended: (checkpoint, event) => {
                addEffectContinuation(event, pending, 'attackPostDamage', sourceAbilityId, checkpoint);
            },
        });
        events.push(...postDamageEvents.filter((event) => (
            event.type !== 'DAMAGE_DEALT'
            || event.payload.targetId !== defenderId
            || event.payload.damageScope === 'direct'
        )));
        if (hasAttackEffectContinuation(postDamageEvents)) return events;
    }

    const resolvedEvent: AttackResolvedEvent = {
        type: 'ATTACK_RESOLVED',
        payload: {
            attackerId,
            defenderId,
            sourceAbilityId,
            defenseAbilityId,
            totalDamage,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    };
    events.push(resolvedEvent);

    return events;
};

export const resolvePostDamageEffects = (
    state: DiceThroneCore,
    random: RandomFn,
    timestamp: number = 0,
    options?: { includeWithDamage?: boolean; continueWithDamageAfterFirstDamage?: boolean }
): DiceThroneEvent[] => {
    const pending = state.pendingAttack;
    if (!pending) {
        return [];
    }

    const events: DiceThroneEvent[] = [];
    const { attackerId, defenderId, sourceAbilityId } = pending;
    const damageDealt = pending.resolvedDamage ?? pending.damage ?? 0;

    if (sourceAbilityId) {
        const effects = getPlayerAbilityEffects(state, attackerId, sourceAbilityId);
        const attackCtx: EffectContext = {
            attackerId,
            defenderId: defenderId ?? attackerId,
            sourceAbilityId,
            state,
            damageDealt,
            timestamp,
        };

        if (options?.includeWithDamage !== false) {
            const withDamageEvents = resolveEffectsToEvents(effects, 'withDamage', attackCtx, {
                random,
                skipDamage: true,
                continueAfterFirstDamage: options?.continueWithDamageAfterFirstDamage,
                onEffectSuspended: (checkpoint, event) => {
                    addEffectContinuation(event, pending, 'attackWithDamage', sourceAbilityId, checkpoint, {
                        bonusDamageOnce: true,
                        skipDamage: true,
                        continueAfterFirstDamage: options?.continueWithDamageAfterFirstDamage,
                    });
                },
            });
            events.push(...withDamageEvents);
            if (hasAttackEffectContinuation(withDamageEvents)) return events;
        }
        const postDamageEvents = resolveEffectsToEvents(effects, 'postDamage', attackCtx, {
            random,
            onEffectSuspended: (checkpoint, event) => {
                addEffectContinuation(event, pending, 'attackPostDamage', sourceAbilityId, checkpoint);
            },
        });
        events.push(...postDamageEvents);
    }

    return events;
};
