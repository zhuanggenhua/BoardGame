import type { RandomFn } from '../../../engine/types';
import type {
    DiceThroneCore,
    DiceThroneEvent,
    AttackResolvedEvent,
    AttackPreDefenseResolvedEvent,
    AttackDefenseResolvedEvent,
    TokenGrantedEvent,
} from './types';
import { resolveEffectsToEvents, type EffectContext } from './effects';
import { getPlayerAbilityEffects } from './abilityLookup';
import { getPendingAttackExpectedDamage } from './utils';

const isBlockingInteractionEvent = (event: DiceThroneEvent): boolean =>
    event.type === 'CHOICE_REQUESTED' || event.type === 'INTERACTION_REQUESTED';

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
    events.push(...resolveEffectsToEvents(effects, 'preDefense', ctx));
    events.push(createPreDefenseResolvedEvent(attackerId, defenderId, sourceAbilityId, timestamp));
    return events;
};

const resolveDefenseEffects = (
    state: DiceThroneCore,
    random: RandomFn,
    timestamp: number
): { defenseEvents: DiceThroneEvent[]; stateAfterDefense: DiceThroneCore } => {
    const pending = state.pendingAttack;
    if (!pending?.defenseAbilityId || !pending.defenderId || pending.defenseResolved) {
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

    const tokenGrantedEvents = defenseEvents.filter((e): e is TokenGrantedEvent => e.type === 'TOKEN_GRANTED');
    if (tokenGrantedEvents.length === 0) {
        return { defenseEvents, stateAfterDefense: state };
    }

    let players = { ...state.players };
    for (const evt of tokenGrantedEvents) {
        const { targetId, tokenId, newTotal } = evt.payload;
        const player = players[targetId];
        if (!player) continue;

        players = {
            ...players,
            [targetId]: {
                ...player,
                tokens: { ...player.tokens, [tokenId]: newTotal },
            },
        };
    }

    return {
        defenseEvents,
        stateAfterDefense: { ...state, players },
    };
};

export const resolveAttack = (
    state: DiceThroneCore,
    random: RandomFn,
    options?: { includePreDefense?: boolean; skipTokenResponse?: boolean },
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
    if (options?.includePreDefense) {
        const preDefenseEvents = resolveOffensivePreDefenseEffects(state, timestamp);
        events.push(...preDefenseEvents);

        const hasChoice = preDefenseEvents.some(isBlockingInteractionEvent);
        if (hasChoice) return events;
    }

    const { attackerId, defenderId, sourceAbilityId, defenseAbilityId } = pending;
    const bonusDamage = pending.bonusDamage ?? 0;
    const { defenseEvents, stateAfterDefense } = resolveDefenseEffects(state, random, timestamp);
    events.push(...defenseEvents);
    const hasDefenseChoice = defenseEvents.some(e => e.type === 'CHOICE_REQUESTED');
    const hasDefenseTokenResponse = defenseEvents.some(e => e.type === 'TOKEN_RESPONSE_REQUESTED');
    const hasDefenseInteractiveBonusDiceReroll = defenseEvents.some(e =>
        e.type === 'BONUS_DICE_REROLL_REQUESTED'
        && !(e as any).payload?.settlement?.displayOnly
    );
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
        const hasInteractiveBonusDiceReroll = withDamageEvents.some(e =>
            e.type === 'BONUS_DICE_REROLL_REQUESTED'
            && !(e as any).payload?.settlement?.displayOnly
        );
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
        const hasBonusDiceRerollInPostDamage = postDamageEvents.some(e =>
            e.type === 'BONUS_DICE_REROLL_REQUESTED'
            && !(e as any).payload?.settlement?.displayOnly
        );
        if (hasChoiceInPostDamage || hasTokenResponseInPostDamage || hasBonusDiceRerollInPostDamage) {
            events.push(...attackEvents);
            return events;
        }

        totalDamage = attackCtx.damageDealt;
    }
    events.push(...attackEvents);

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
            event.type !== 'DAMAGE_DEALT' || event.payload.targetId !== defenderId
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
    timestamp: number = 0
): DiceThroneEvent[] => {
    const pending = state.pendingAttack;
    if (!pending) {
        return [];
    }

    const events: DiceThroneEvent[] = [];
    const { attackerId, defenderId, sourceAbilityId, defenseAbilityId } = pending;
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

        events.push(...resolveEffectsToEvents(effects, 'withDamage', attackCtx, { random, skipDamage: true }));
        events.push(...resolveEffectsToEvents(effects, 'postDamage', attackCtx, { random }));
    }

    const resolvedEvent: AttackResolvedEvent = {
        type: 'ATTACK_RESOLVED',
        payload: {
            attackerId,
            defenderId,
            sourceAbilityId,
            defenseAbilityId,
            totalDamage: damageDealt,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    };
    events.push(resolvedEvent);

    return events;
};
