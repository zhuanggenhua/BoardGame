/** 索尔专属结算：同伴移动、效果骰与逐次选择；不维护影子位置状态。 */
import type { DiceThroneCore, DiceThroneEvent, BonusDieInfo } from '../types';
import type { DamageOrigin } from '../tokenTypes';
import type { ChoiceRequestedEvent } from '../events';
import type { InteractionDescriptor } from '../core-types';
import type { CustomActionContext } from '../effects';
import { createDisplayOnlySettlement, registerCustomActionHandler } from '../effects';
import { buildModifyDieSetInteraction } from './common';
import { registerChoiceResolvedEventHandler } from '../choiceResolvedEvents';
import { registerChoiceEffectHandler } from '../choiceEffects';
import { registerBonusDiceSettlementHandler } from '../bonusDiceSettlement';
import { getActiveDice, getAttackMaxDuplicateValueCount, getOpponents, getPlayerDieFace, getTokenStackLimit } from '../rules';
import { TOKEN_IDS as TOKEN, THOR_DICE_FACE_IDS as FACE } from '../ids';
import { RESOURCE_IDS } from '../resources';
import { maybeCreateDamageResponseEvent } from '../tokenResponse';
import { buildDrawEvents } from '../deckEvents';
import { CP_MAX } from '../types';

type Source = Pick<CustomActionContext, 'state' | 'attackerId' | 'sourceAbilityId' | 'timestamp'>;
type Params = Record<string, string | number | boolean>;
const targetPresentation = (state: DiceThroneCore, id: string) => ({
    targetPlayerId: id, labelParams: { player: `characters.${state.players[id].characterId}` },
});
const event = <T extends DiceThroneEvent['type']>(type: T, payload: Extract<DiceThroneEvent, { type: T }>['payload'], timestamp: number): Extract<DiceThroneEvent, { type: T }> => (
    { type, payload, timestamp, sourceCommandType: 'ABILITY_EFFECT' } as Extract<DiceThroneEvent, { type: T }>
);

export const getMjolnirHolder = (state: DiceThroneCore): string | undefined => (
    Object.keys(state.players).find(id => (state.players[id].tokens[TOKEN.MJOLNIR] ?? 0) === 1)
);

const grant = (ctx: Source, tokenId: string, amount: number, current?: number): DiceThroneEvent[] => {
    const before = current ?? ctx.state.players[ctx.attackerId].tokens[tokenId] ?? 0;
    const total = Math.min(getTokenStackLimit(ctx.state, ctx.attackerId, tokenId), before + amount);
    return total > before ? [event('TOKEN_GRANTED', {
        targetId: ctx.attackerId, tokenId, amount: total - before, newTotal: total, sourceAbilityId: ctx.sourceAbilityId,
    }, ctx.timestamp)] : [];
};
const bonus = (ctx: Source, amount: number): DiceThroneEvent[] => amount > 0 ? [event('BONUS_DAMAGE_ADDED', {
    playerId: ctx.attackerId, amount,
}, ctx.timestamp)] : [];
const cp = (ctx: Source, amount: number): DiceThroneEvent[] => {
    const before = ctx.state.players[ctx.attackerId].resources[RESOURCE_IDS.CP] ?? 0;
    const next = Math.min(CP_MAX, before + amount);
    return next > before ? [event('CP_CHANGED', { playerId: ctx.attackerId, delta: next - before, newValue: next, sourceAbilityId: ctx.sourceAbilityId }, ctx.timestamp)] : [];
};

/** 独立来源：每次移动生成一条正式伤害事实，经共享commit/prevention管线结算。 */
const isolatedDamage = (ctx: Source, targetId: string, amount: number, damageOrigin: DamageOrigin = 'ability'): DiceThroneEvent[] => {
    const damageEvent = event('DAMAGE_DEALT', {
    targetId, amount, actualDamage: Math.min(amount, ctx.state.players[targetId].resources[RESOURCE_IDS.HP] ?? 0),
    sourcePlayerId: ctx.attackerId, sourceAbilityId: ctx.sourceAbilityId,
    damageScope: 'direct', damageOrigin, unblockable: true,
    }, ctx.timestamp);
    if (ctx.state.pendingAttack?.isUltimate) return [damageEvent];
    const response = maybeCreateDamageResponseEvent({ state: ctx.state, damageEvent, attackerId: ctx.attackerId,
        sourceAbilityId: damageEvent.payload.sourceAbilityId, timestamp: ctx.timestamp, allowAttackerBoost: false });
    return [response ?? damageEvent];
};

function appendAfterDamage(events: DiceThroneEvent[], continuation: DiceThroneEvent[]): DiceThroneEvent[] {
    const response = events.find(e => e.type === 'TOKEN_RESPONSE_REQUESTED');
    if (response?.type === 'TOKEN_RESPONSE_REQUESTED') {
        response.payload.pendingDamage.deferredResolutionEvents = continuation;
        return events;
    }
    return [...events, ...continuation];
}

function moveMjolnir(ctx: Source, destination: string): DiceThroneEvent[] {
    const holder = getMjolnirHolder(ctx.state);
    if (!holder || holder === destination) return [];
    const retrieving = destination === ctx.attackerId;
    if (!retrieving && (holder !== ctx.attackerId || !getOpponents(ctx.state, ctx.attackerId).includes(destination))) return [];
    return [
        event('TOKEN_CONSUMED', { playerId: holder, tokenId: TOKEN.MJOLNIR, amount: 1, newTotal: 0, sourceAbilityId: ctx.sourceAbilityId }, ctx.timestamp),
        event('TOKEN_GRANTED', { targetId: destination, tokenId: TOKEN.MJOLNIR, amount: 1, newTotal: 1, sourceAbilityId: ctx.sourceAbilityId }, ctx.timestamp),
        ...(!retrieving ? [event('THOR_MJOLNIR_THROWN', { playerId: ctx.attackerId, targetId: destination }, ctx.timestamp)] : []),
        ...(retrieving ? grant(ctx, TOKEN.ELECTROKINESIS, 1) : isolatedDamage({ ...ctx, sourceAbilityId: TOKEN.MJOLNIR }, destination, 1, 'companion')),
    ];
}

function finishHammerMoves(ctx: Source, params: Params): DiceThroneEvent[] {
    const oldElectro = ctx.state.players[ctx.attackerId].tokens[TOKEN.ELECTROKINESIS] ?? 0;
    const electro = Number(params.electrokinesis ?? 0)
        + (params.duplicateThreshold && getAttackMaxDuplicateValueCount(ctx.state) >= Number(params.duplicateThreshold) ? 1 : 0);
    const total = Math.min(getTokenStackLimit(ctx.state, ctx.attackerId, TOKEN.ELECTROKINESIS), oldElectro + electro);
    return [
        ...grant(ctx, TOKEN.GUARD_BREAK, Number(params.guardBreak ?? 0)),
        ...grant(ctx, TOKEN.ELECTROKINESIS, electro),
        ...(params.electrokinesisDamage ? bonus(ctx, total) : []),
        event('THOR_MJOLNIR_RESOLVED', { playerId: ctx.attackerId, sourceAbilityId: ctx.sourceAbilityId }, ctx.timestamp),
    ];
}

function hammerChoice(ctx: Source, params: Params): DiceThroneEvent[] {
    const holder = getMjolnirHolder(ctx.state);
    const count = Number(params.count ?? 1);
    if (!holder || count <= 0 || (params.throwOnly && holder !== ctx.attackerId)) return finishHammerMoves(ctx, params);
    const destinations = holder === ctx.attackerId ? getOpponents(ctx.state, ctx.attackerId) : [ctx.attackerId];
    const options: ChoiceRequestedEvent['payload']['options'] = destinations.map(targetId => ({
        value: Object.keys(ctx.state.players).indexOf(targetId), customId: 'thor-mjolnir-move',
        labelKey: holder === ctx.attackerId ? 'choices.thor.throwTo' : 'choices.thor.retrieve', ...targetPresentation(ctx.state, targetId),
    }));
    if (params.optional) options.push({ value: -1, customId: 'thor-mjolnir-move', labelKey: 'choices.thor.stop', labelParams: { player: '' } });
    if (options.length === 0) return finishHammerMoves(ctx, params);
    if (destinations.length === 1 && !params.optional) {
        return resolveHammerMove(ctx, { ...params, count }, destinations[0]);
    }
    return [event('CHOICE_REQUESTED', {
        playerId: ctx.attackerId, sourceAbilityId: ctx.sourceAbilityId, titleKey: 'choices.thor.hammerTitle',
        choiceContext: { ...params, count }, options,
    }, ctx.timestamp)];
}

function resolveHammerMove(ctx: Source, params: Params, destination: string): DiceThroneEvent[] {
    const moved = moveMjolnir(ctx, destination);
    if (!moved.length) return [];
    const remaining = Number(params.count ?? 1) - 1;
    return appendAfterDamage(moved, [event('THOR_MJOLNIR_STEP_COMPLETED', {
        playerId: ctx.attackerId, sourceAbilityId: ctx.sourceAbilityId, remaining, params,
    }, ctx.timestamp)]);
}

function paidHammerChoice(ctx: CustomActionContext, retrieving: boolean): DiceThroneEvent[] {
    const holder = getMjolnirHolder(ctx.state);
    if (!holder || (retrieving ? holder === ctx.attackerId : holder !== ctx.attackerId)) return [];
    const hand = ctx.state.players[ctx.attackerId].hand;
    if (!hand.length) return [];
    const interaction: InteractionDescriptor = {
        id: `${ctx.sourceAbilityId}-mjolnir-cost-${ctx.timestamp}`,
        playerId: ctx.attackerId,
        sourceCardId: ctx.sourceAbilityId,
        type: 'selectHandCard',
        titleKey: 'interaction.selectHandCardToDiscard',
        selectCount: 1,
        selected: [],
        allowCancel: true,
        resolveCustomActionId: retrieving ? 'thor-mjolnir-paid-retrieve' : 'thor-mjolnir-paid-throw',
    };
    return [event('INTERACTION_REQUESTED', { interaction }, ctx.timestamp)];
}

function rollEffectDice(ctx: CustomActionContext, id: string, count: number, params: Params = {}): DiceThroneEvent[] {
    if (!ctx.random) throw new Error('Thor effect dice require the authoritative random source');
    const dice: BonusDieInfo[] = Array.from({ length: count }, (_, index) => {
        const value = ctx.random!.d(6);
        return { index, value, face: getPlayerDieFace(ctx.state, ctx.attackerId, value)!, effectKey: 'bonusDie.effect.thor.die', effectParams: { value } };
    });
    const request = createDisplayOnlySettlement(ctx.sourceAbilityId, ctx.attackerId, ctx.targetId, dice, ctx.timestamp, {
            customResolutionId: id, customResolutionParams: params,
            continuation: id === 'thor-bifrost-settle' || id === 'thor-undaunted-settle'
                ? { kind: 'complete' }
                : id === 'thor-guard-break-settle'
                ? { kind: 'attack', settlementStage: 'preDamage', markBonusDiceResolved: false }
                : { kind: 'attack', settlementStage: 'preDamage', markBonusDiceResolved: true },
    });
    if (params.groupReroll) Object.assign(request.payload.settlement, { groupReroll: true, maxRerollCount: 1 });
    return [
        ...dice.map(die => event('BONUS_DIE_ROLLED', { ...die, playerId: ctx.attackerId, targetPlayerId: ctx.targetId }, ctx.timestamp)),
        request,
    ];
}

export function registerThorCustomActions(): void {
    registerCustomActionHandler('thor-grant-guard-break', ctx => grant(ctx, TOKEN.GUARD_BREAK, Number((ctx.action.params as Params | undefined)?.amount ?? 1)), { categories: ['token'] });
    registerCustomActionHandler('thor-grant-electrokinesis', ctx => grant(ctx, TOKEN.ELECTROKINESIS, Number((ctx.action.params as Params | undefined)?.amount ?? 1)), { categories: ['token'] });
    registerCustomActionHandler('thor-hammer-moves', ctx => hammerChoice(ctx, (ctx.action.params ?? {}) as Params), { categories: ['choice'], requiresInteraction: true });
    registerCustomActionHandler('thor-paid-throw', ctx => paidHammerChoice(ctx, false), { categories: ['choice'], requiresInteraction: true });
    registerCustomActionHandler('thor-paid-retrieve', ctx => paidHammerChoice(ctx, true), { categories: ['choice'], requiresInteraction: true });
    registerCustomActionHandler('thor-mjolnir-paid-throw', ctx => hammerChoice(ctx, { count: 1 }), { categories: ['choice'], requiresInteraction: true });
    registerCustomActionHandler('thor-mjolnir-paid-retrieve', ctx => moveMjolnir(ctx, ctx.attackerId), { categories: ['choice'], requiresInteraction: true });
    registerChoiceResolvedEventHandler('thor-mjolnir-move', ({ state, playerId, sourceAbilityId, value, timestamp }) => {
        if (!sourceAbilityId || value === undefined) return [];
        const ctx: Source = { state, attackerId: playerId, sourceAbilityId, timestamp };
        const params = state.currentChoiceContext ?? { count: 1 };
        if (value === -1) return finishHammerMoves(ctx, params);
        const destination = Object.keys(state.players)[value];
        if (!destination) return [];
        return resolveHammerMove(ctx, params, destination);
    });

    registerCustomActionHandler('thor-mighty-summon', ctx => {
        const holder = getMjolnirHolder(ctx.state);
        const params = (ctx.action.params ?? {}) as Params;
        return [
            ...grant(ctx, TOKEN.GUARD_BREAK, Number(params.guardBreak ?? 2)),
            event('HEAL_APPLIED', { targetId: ctx.attackerId, amount: Number(params.heal ?? 2), sourceAbilityId: ctx.sourceAbilityId }, ctx.timestamp),
            ...(holder === ctx.attackerId ? grant(ctx, TOKEN.ELECTROKINESIS, 3) : holder ? [
                ...moveMjolnir(ctx, ctx.attackerId), ...isolatedDamage(ctx, holder, Number(params.collateral ?? 3)),
            ] : []),
        ];
    }, { categories: ['token', 'resource'] });

    registerCustomActionHandler('thor-thunder-strike', ctx => {
        const target = ctx.state.pendingAttack?.defenderId ?? ctx.targetId;
        return getMjolnirHolder(ctx.state) === target ? bonus(ctx, 2) : grant(ctx, TOKEN.ELECTROKINESIS, 1);
    }, { categories: ['token', 'damage'] });

    registerCustomActionHandler('thor-odinforce-roll', ctx => rollEffectDice(ctx, 'thor-odinforce-settle', Number((ctx.action.params as Params | undefined)?.count ?? 5), (ctx.action.params ?? {}) as Params), { categories: ['dice'], usesAttackDiceSnapshot: false });
    registerBonusDiceSettlementHandler('thor-odinforce-settle', ({ state, settlement, timestamp }) => {
        const ctx: Source = { state, attackerId: settlement.attackerId, sourceAbilityId: settlement.sourceAbilityId, timestamp };
        const count = (face: string) => settlement.dice.filter(d => d.face === face).length;
        const thunder = count(FACE.THUNDER);
        const total = Math.min(getTokenStackLimit(state, ctx.attackerId, TOKEN.ELECTROKINESIS), (state.players[ctx.attackerId].tokens[TOKEN.ELECTROKINESIS] ?? 0) + thunder);
        const cp = state.players[ctx.attackerId].resources[RESOURCE_IDS.CP] ?? 0;
        const followupEvents: DiceThroneEvent[] = [
            ...grant(ctx, TOKEN.ELECTROKINESIS, thunder),
            ...(count(FACE.WORTHY) >= 2 ? [event('CP_CHANGED', { playerId: ctx.attackerId, delta: Math.min(1, CP_MAX - cp), newValue: Math.min(CP_MAX, cp + 1), sourceAbilityId: ctx.sourceAbilityId }, timestamp)] : []),
        ];
        if (count(FACE.HAMMER) >= 2) followupEvents.push(...hammerChoice(ctx, { count: 1, electrokinesisDamage: true }));
        else followupEvents.push(...bonus(ctx, total));
        return { totalDamage: 0, followupEvents };
    });

    registerCustomActionHandler('thor-chain-roll', ctx => rollEffectDice(ctx, 'thor-chain-settle', Number((ctx.action.params as Params | undefined)?.count ?? 3), (ctx.action.params ?? {}) as Params), { categories: ['dice', 'damage'], estimateDamage: () => 8 });
    registerBonusDiceSettlementHandler('thor-chain-settle', ({ state, settlement, timestamp }) => {
        const choices = [];
        for (let i = 0; i < settlement.dice.length; i++) for (let j = i + 1; j < settlement.dice.length; j++) {
            choices.push({ customId: 'thor-chain-pair', value: settlement.dice[i].value + settlement.dice[j].value,
                dicePreview: { characterId: state.players[settlement.attackerId].characterId, dice: [settlement.dice[i], settlement.dice[j]].map(die => ({ index: die.index, value: die.value })) },
                labelKey: 'choices.thor.dicePair', labelParams: { first: i + 1, second: j + 1, damage: settlement.dice[i].value + settlement.dice[j].value } });
        }
        return { totalDamage: 0, followupEvents: [event('CHOICE_REQUESTED', {
            playerId: settlement.attackerId, sourceAbilityId: settlement.sourceAbilityId,
            titleKey: 'choices.thor.chainTitle', options: choices,
            choiceContext: { collateral: Number(settlement.customResolutionParams?.collateral ?? 2) },
        }, timestamp)] };
    });
    registerChoiceResolvedEventHandler('thor-chain-pair', ({ state, playerId, sourceAbilityId, value, timestamp }) => {
        if (!sourceAbilityId || value === undefined) return [];
        const ctx: Source = { state, attackerId: playerId, sourceAbilityId, timestamp };
        const opponents = getOpponents(state, playerId);
        if (opponents.length <= 1) {
            return [...bonus(ctx, value), ...(opponents.length === 1
                ? isolatedDamage(ctx, opponents[0], Number(state.currentChoiceContext?.collateral ?? 2))
                : [])];
        }
        return [...bonus(ctx, value), event('CHOICE_REQUESTED', {
            playerId, sourceAbilityId, titleKey: 'choices.thor.collateralTitle',
            choiceContext: { collateral: Number(state.currentChoiceContext?.collateral ?? 2) },
            options: opponents.map(id => ({ value: Object.keys(state.players).indexOf(id), customId: 'thor-chain-target', labelKey: 'choices.thor.target', ...targetPresentation(state, id) })),
        }, timestamp)];
    });
    registerChoiceResolvedEventHandler('thor-chain-target', ({ state, playerId, sourceAbilityId, value, timestamp }) => {
        const targetId = value === undefined ? undefined : Object.keys(state.players)[value];
        if (!sourceAbilityId || !targetId || !getOpponents(state, playerId).includes(targetId)) return [];
        return isolatedDamage({ state, attackerId: playerId, sourceAbilityId, timestamp }, targetId, Number(state.currentChoiceContext?.collateral ?? 2));
    });

    registerCustomActionHandler('thor-thunder-wheel', ctx => {
        const faces = getActiveDice(ctx.state, 'defensiveRoll').map(d => getPlayerDieFace(ctx.state, ctx.attackerId, d.value));
        const hammers = faces.filter(face => face === FACE.HAMMER).length;
        const worthy = faces.filter(face => face === FACE.WORTHY).length;
        const upgraded = (ctx.action.params as Params | undefined)?.upgraded === true;
        return [
            ...(worthy ? [event('DAMAGE_SHIELD_GRANTED', { targetId: ctx.attackerId, value: worthy * 2, sourceId: ctx.sourceAbilityId }, ctx.timestamp)] : []),
            ...(faces.includes(FACE.THUNDER) ? grant(ctx, TOKEN.ELECTROKINESIS, upgraded ? faces.filter(face => face === FACE.THUNDER).length : 1) : []),
            ...(hammers >= 2 ? hammerChoice(ctx, { count: upgraded ? Math.floor(hammers / 2) : 1 }) : []),
        ];
    }, { categories: ['defense', 'token', 'choice'] });

    registerCustomActionHandler('thor-guard-break', ctx => rollEffectDice(ctx, 'thor-guard-break-settle', 1), { categories: ['dice'] });
    registerChoiceEffectHandler('use-guard_break', ({ state, playerId }) => {
        const player = state.players[playerId];
        if (!state.pendingAttack || !player || (player.tokens[TOKEN.GUARD_BREAK] ?? 0) < 1) return undefined;
        return { players: { ...state.players, [playerId]: { ...player, tokens: { ...player.tokens, [TOKEN.GUARD_BREAK]: player.tokens[TOKEN.GUARD_BREAK] - 1 } } },
            pendingAttack: { ...state.pendingAttack, offensiveRollEndTokenResolved: false } };
    });
    registerChoiceResolvedEventHandler('use-guard_break', ({ state, playerId, sourceAbilityId, timestamp, random }) => {
        if (!sourceAbilityId || (state.players[playerId].tokens[TOKEN.GUARD_BREAK] ?? 0) < 1) return [];
        return rollEffectDice({ state, attackerId: playerId, sourceAbilityId, timestamp, random,
            targetId: state.pendingAttack?.defenderId ?? playerId, ctx: {} as CustomActionContext['ctx'], action: { type: 'custom', target: 'self' } }, 'thor-guard-break-settle', 1);
    });
    registerBonusDiceSettlementHandler('thor-guard-break-settle', ({ settlement, timestamp }) => ({
        totalDamage: 0,
        followupEvents: [event('PENDING_ATTACK_UPDATED', {
            attackerId: settlement.attackerId,
            patch: { offensiveRollEndTokenResolved: false, ...([4, 5].includes(settlement.dice[0]?.value) ? { isDefendable: false } : {}) },
        }, timestamp)],
    }));

    registerCustomActionHandler('thor-worthy', ctx => buildModifyDieSetInteraction(ctx, { allowedValues: [4, 5] }), { categories: ['dice'], requiresInteraction: true });
    registerCustomActionHandler('thor-impenetrable', ctx => {
        const pending = ctx.state.pendingDamage;
        const amount = ctx.state.players[ctx.attackerId].tokens[TOKEN.ELECTROKINESIS] ?? 0;
        if (!pending || pending.targetPlayerId !== ctx.attackerId || amount < 2) return [];
        return [event('TOKEN_CONSUMED', { playerId: ctx.attackerId, tokenId: TOKEN.ELECTROKINESIS, amount: 2, newTotal: amount - 2, sourceAbilityId: ctx.sourceAbilityId }, ctx.timestamp),
            event('PREVENT_DAMAGE', { targetId: ctx.attackerId, amount: pending.currentDamage, sourceAbilityId: ctx.sourceAbilityId, applyImmediately: true }, ctx.timestamp)];
    }, { categories: ['defense', 'token'] });
    registerCustomActionHandler('thor-undaunted', ctx => rollEffectDice(ctx, 'thor-undaunted-settle', 1), { categories: ['defense', 'dice'] });
    registerBonusDiceSettlementHandler('thor-undaunted-settle', ({ state, settlement, timestamp }) => {
        const pending = state.pendingDamage;
        const hp = state.players[settlement.attackerId].resources[RESOURCE_IDS.HP] ?? 0;
        return { totalDamage: 0, followupEvents: pending && pending.damageScope === 'attack'
            && pending.targetPlayerId === settlement.attackerId && pending.currentDamage >= hp
            && settlement.dice[0]?.face === FACE.WORTHY
            ? [event('PREVENT_DAMAGE', { targetId: settlement.attackerId, amount: pending.currentDamage - Math.max(0, hp - 1), sourceAbilityId: settlement.sourceAbilityId, applyImmediately: true }, timestamp)] : [] };
    });
    registerCustomActionHandler('thor-hammer-time', ctx => {
        const retrieving = getMjolnirHolder(ctx.state) !== ctx.attackerId;
        const movement = retrieving ? moveMjolnir(ctx, ctx.attackerId).filter(e => !(e.type === 'TOKEN_GRANTED' && e.payload.tokenId === TOKEN.ELECTROKINESIS)) : [];
        return [...movement, ...cp(ctx, 1), ...grant(ctx, TOKEN.ELECTROKINESIS, retrieving ? 2 : 1)];
    }, { categories: ['token', 'resource'] });
    registerCustomActionHandler('thor-thunderous', ctx => [
        ...buildDrawEvents(ctx.state, ctx.attackerId, 1, ctx.random!, 'PLAY_CARD', ctx.timestamp, ctx.sourceAbilityId), ...grant(ctx, TOKEN.ELECTROKINESIS, 2),
    ], { categories: ['card', 'token'] });
    registerCustomActionHandler('thor-storm-brewing', ctx => [
        ...buildDrawEvents(ctx.state, ctx.attackerId, 1, ctx.random!, 'PLAY_CARD', ctx.timestamp, ctx.sourceAbilityId),
        ...cp(ctx, 1), ...grant(ctx, TOKEN.GUARD_BREAK, 1), ...grant(ctx, TOKEN.ELECTROKINESIS, 1),
    ], { categories: ['card', 'token', 'resource'] });
    registerCustomActionHandler('thor-bifrost', ctx => rollEffectDice(ctx, 'thor-bifrost-settle', 1), { categories: ['card', 'dice'] });
    registerBonusDiceSettlementHandler('thor-bifrost-settle', ({ state, settlement, timestamp, random }) => {
        const ctx = { state, attackerId: settlement.attackerId, sourceAbilityId: settlement.sourceAbilityId, timestamp };
        return { totalDamage: 0, followupEvents: [
            ...buildDrawEvents(state, ctx.attackerId, 1, random!, 'PLAY_CARD', timestamp, ctx.sourceAbilityId),
            ...(settlement.dice[0]?.face === FACE.THUNDER ? [...grant(ctx, TOKEN.GUARD_BREAK, 1), ...grant(ctx, TOKEN.ELECTROKINESIS, 2)] : []),
        ] };
    });
}

/** 仅从已经提交的伤害事实触发败北召回；所有权和位置仍只有tokens一份。 */
export function collectThorCompanionFollowups(state: DiceThroneCore, events: readonly { type: string; timestamp?: number; payload?: unknown }[]): DiceThroneEvent[] {
    const owner = Object.keys(state.players).find(id => state.players[id].characterId === 'thor');
    const holder = getMjolnirHolder(state);
    const steps = events.filter(e => e.type === 'THOR_MJOLNIR_STEP_COMPLETED') as Extract<DiceThroneEvent, { type: 'THOR_MJOLNIR_STEP_COMPLETED' }>[];
    if (owner && holder && owner !== holder && (state.players[holder].resources[RESOURCE_IDS.HP] ?? 0) <= 0
        && events.some(e => e.type === 'DAMAGE_DEALT')) {
        return [...moveMjolnir({ state, attackerId: owner, sourceAbilityId: TOKEN.MJOLNIR, timestamp: events[events.length - 1]?.timestamp ?? 0 }, owner), ...steps];
    }
    return steps.flatMap(step => {
        const { playerId: attackerId, sourceAbilityId, remaining, params } = step.payload;
        const ctx = { state, attackerId, sourceAbilityId, timestamp: step.timestamp ?? 0 };
        return remaining > 0 ? hammerChoice(ctx, { ...params, count: remaining }) : finishHammerMoves(ctx, params);
    });
}
