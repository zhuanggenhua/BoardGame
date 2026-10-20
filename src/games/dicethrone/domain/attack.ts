import type { RandomFn } from '../../../engine/types';
import type {
    DiceThroneCore,
    DiceThroneEvent,
    AttackPreDefenseResolvedEvent,
    AttackDefenseResolvedEvent,
    AttackResolvedEvent,
} from './types';
import { resolveEffectsToEvents, type EffectContext } from './effects';
import { getPlayerAbilityEffects } from './abilityLookup';
import { applyEvents, getPendingAttackExpectedDamage } from './utils';
import { reduce } from './reducer';
import { hasPendingBonusDiceSettlement } from './rules';
import { STATUS_IDS } from './ids';
import { getCustomActionMeta } from './effects';
import type { PendingAttackUpdatedEvent, StatusRemovedEvent } from './types';

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

const isBlockingInteractionEvent = (event: DiceThroneEvent): boolean =>
    event.type === 'CHOICE_REQUESTED'
    || event.type === 'COMPARE_ROLL_REQUESTED'
    || event.type === 'INTERACTION_REQUESTED';

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
    timestamp: number = 0
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
    events.push(...resolveEffectsToEvents(effects, 'preDefense', ctx, { random }));
    if (events.some(isBlockingInteractionEvent) || events.some(isInteractiveBonusDiceRerollEvent)) {
        // 记录已完成的前置位置，但不能继续进入防御或主伤害。
        // 奖励骰确认后从这个位置恢复，既不会重掷，也不会提前结算父攻击。
        events.push(createPreDefenseResolvedEvent(attackerId, defenderId, sourceAbilityId, timestamp));
        return events;
    }
    events.push(createPreDefenseResolvedEvent(attackerId, defenderId, sourceAbilityId, timestamp));
    return events;
};

const resolveDefenseEffects = (
    state: DiceThroneCore,
    random: RandomFn,
    timestamp: number
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
    defenseEvents.push(...resolveEffectsToEvents(defenseEffects, 'withDamage', defenseCtx, { random }));
    defenseEvents.push(...resolveEffectsToEvents(defenseEffects, 'postDamage', defenseCtx, { random }));
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
            events.push(...resolveEffectsToEvents(effects, 'withDamage', attackCtx, {
                bonusDamage: pending.bonusDamage ?? 0,
                bonusDamageOnce: true,
                random,
                skipDamage: true,
            }));
            events.push(...resolveEffectsToEvents(effects, 'postDamage', attackCtx, { random }));
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

        const hasChoice = preDefenseEvents.some(isBlockingInteractionEvent);
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
    const hasDefenseChoice = defenseEvents.some(isBlockingInteractionEvent);
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
        });

        const hasTokenResponse = withDamageEvents.some(e => e.type === 'TOKEN_RESPONSE_REQUESTED');
        const hasInteractiveBonusDiceReroll = withDamageEvents.some(isInteractiveBonusDiceRerollEvent);
        const hasChoiceInWithDamage = withDamageEvents.some(isBlockingInteractionEvent);
        if (hasTokenResponse || hasInteractiveBonusDiceReroll || hasChoiceInWithDamage) {
            attackEvents.push(...withDamageEvents);
            events.push(...attackEvents);
            return events;
        }

        attackEvents.push(...withDamageEvents);
        attackEvents.push(...resolveEffectsToEvents(effects, 'postDamage', attackCtx, { random }));

        const postDamageEvents = attackEvents.slice(withDamageEvents.length);
        const hasChoiceInPostDamage = postDamageEvents.some(isBlockingInteractionEvent);
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
        });
        const postDamageEvents = resolveEffectsToEvents(effects, 'postDamage', attackCtx, { random });
        events.push(...[...withDamageEvents, ...postDamageEvents].filter((event) => (
            event.type !== 'DAMAGE_DEALT'
            || event.payload.targetId !== defenderId
            || event.payload.damageScope === 'direct'
        )));
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
            events.push(...resolveEffectsToEvents(effects, 'withDamage', attackCtx, {
                random,
                skipDamage: true,
                continueAfterFirstDamage: options?.continueWithDamageAfterFirstDamage,
            }));
        }
        events.push(...resolveEffectsToEvents(effects, 'postDamage', attackCtx, { random }));
    }

    return events;
};
