import { describe, expect, it } from 'vitest';
import type { DiceThroneCommand, DiceThroneCore, DiceThroneEvent } from '../domain/types';
import { execute } from '../domain/execute';
import { reduce } from '../domain/reducer';
import { diceThroneFlowHooks } from '../domain/flowHooks';
import { RESOURCE_IDS } from '../domain/resources';
import { TOKEN_IDS } from '../domain/ids';
import { createHeroMatchup, createQueuedRandom } from './test-utils';

const applyEvents = (core: DiceThroneCore, events: DiceThroneEvent[]): DiceThroneCore =>
    events.reduce((current, event) => reduce(current, event), core);

const command = (type: DiceThroneCommand['type'], playerId: string, payload: Record<string, unknown> = {}): DiceThroneCommand => ({
    type,
    playerId,
    payload,
    timestamp: 100,
} as DiceThroneCommand);

describe('DiceThrone Treant Token 机制', () => {
    it('幼种树灵可在自己的掷骰阶段消耗并重掷 1 颗骰子', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.sys.phase = 'offensiveRoll';
        state.core.rollCount = 1;
        state.core.rollDiceCount = 5;
        state.core.dice[0] = { ...state.core.dice[0], id: 0, value: 1, isKept: false };
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;

        const events = execute(state, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'treant-seedling-cultivation',
            actionIndex: 0,
            targetDieId: 0,
        }), createQueuedRandom([6]));
        const next = applyEvents(state.core, events);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.dice[0].value).toBe(6);
    });

    it('树灵主动效果每回合每种只能花费 1 次，回合切换后重置', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.sys.phase = 'offensiveRoll';
        state.core.rollCount = 1;
        state.core.rollDiceCount = 5;
        state.core.dice[0] = { ...state.core.dice[0], id: 0, value: 1, isKept: false };
        state.core.dice[1] = { ...state.core.dice[1], id: 1, value: 2, isKept: false };
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 2;

        let events = execute(state, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'treant-seedling-cultivation',
            actionIndex: 0,
            targetDieId: 0,
        }), createQueuedRandom([6]));
        let next = applyEvents(state.core, events);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(1);
        expect(next.dice[0].value).toBe(6);

        events = execute({ core: next, sys: { phase: 'offensiveRoll' } }, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'treant-seedling-cultivation',
            actionIndex: 0,
            targetDieId: 1,
        }), createQueuedRandom([5]));
        expect(events).toHaveLength(0);

        next = reduce(next, {
            type: 'TURN_CHANGED',
            payload: { previousPlayerId: '1', nextPlayerId: '0', turnNumber: next.turnNumber + 1 },
            sourceCommandType: 'ADVANCE_PHASE',
            timestamp: 200,
        } as DiceThroneEvent);
        events = execute({ core: next, sys: { phase: 'offensiveRoll' } }, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'treant-seedling-cultivation',
            actionIndex: 0,
            targetDieId: 1,
        }), createQueuedRandom([5]));
        next = applyEvents(next, events);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.dice[1].value).toBe(5);
    });

    it('木苗树灵主阶段动作可消耗 token 治疗 1 并获得 1CP', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.sys.phase = 'main1';
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 1;
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 40;
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 1;

        const events = execute(state, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'treant-sapling-cultivation',
            actionIndex: 0,
        }), createQueuedRandom([1]));
        const next = applyEvents(state.core, events);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(41);
        expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(2);
    });

    it('木苗树灵主阶段第二动作可额外花费 1CP 抽 1 张牌', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.sys.phase = 'main1';
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 1;
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 2;
        state.core.players['0'].hand = [];

        const deckBefore = state.core.players['0'].deck.length;
        const events = execute(state, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'treant-sapling-cultivation',
            actionIndex: 1,
        }), createQueuedRandom([1]));
        const next = applyEvents(state.core, events);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(1);
        expect(next.players['0'].hand).toHaveLength(1);
        expect(next.players['0'].deck).toHaveLength(deckBefore - 1);
    });

    it('生命源泉主阶段动作会掷骰并按半值向上治疗', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.sys.phase = 'main1';
        state.core.players['0'].tokens[TOKEN_IDS.LIFE_SAP] = 1;
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 35;

        const events = execute(state, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'treant-life-sap',
            actionIndex: 0,
        }), createQueuedRandom([5]));
        const next = applyEvents(state.core, events);

        expect(events.some(event => event.type === 'BONUS_DIE_ROLLED')).toBe(true);
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(38);
    });

    it('刺藤在进攻掷骰阶段结束时按额外投掷次数造成伤害并移除', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.THORN] = 1;
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 30;
        state.core.rollCount = 3;

        const result = diceThroneFlowHooks.onPhaseExit?.({
            state: { core: state.core, sys: { phase: 'offensiveRoll' } },
            from: 'offensiveRoll',
            to: 'main2',
            command: command('ADVANCE_PHASE', '0'),
            random: createQueuedRandom([1]),
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const events = Array.isArray(result) ? result : (result?.events ?? []);
        const next = applyEvents(state.core, events as DiceThroneEvent[]);

        expect(next.players['0'].tokens[TOKEN_IDS.THORN]).toBe(0);
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(28);
    });

    it('刺藤造成的额外投掷伤害每回合最多为 2', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.THORN] = 1;
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 30;
        state.core.rollCount = 5;

        const result = diceThroneFlowHooks.onPhaseExit?.({
            state: { core: state.core, sys: { phase: 'offensiveRoll' } },
            from: 'offensiveRoll',
            to: 'main2',
            command: command('ADVANCE_PHASE', '0'),
            random: createQueuedRandom([1]),
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const events = Array.isArray(result) ? result : (result?.events ?? []);
        const next = applyEvents(state.core, events as DiceThroneEvent[]);

        expect(next.players['0'].tokens[TOKEN_IDS.THORN]).toBe(0);
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(28);
        expect((events as DiceThroneEvent[]).find(event => event.type === 'DAMAGE_DEALT')?.payload.amount).toBe(2);
    });

    it('树精神圣防止即将受到的负面状态必须由玩家选择，可跳过或消耗防止', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.sys.phase = 'offensiveRoll';
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'poison-blade',
            isDefendable: true,
            damage: 5,
        };
        state.core.players['1'].tokens[TOKEN_IDS.TREANT_DIVINE] = 1;

        let result = diceThroneFlowHooks.onPhaseExit?.({
            state: { core: state.core, sys: { phase: 'offensiveRoll' } },
            from: 'offensiveRoll',
            to: 'defensiveRoll',
            command: command('ADVANCE_PHASE', '0'),
            random: createQueuedRandom([1]),
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const events = Array.isArray(result) ? result : (result?.events ?? []);
        const choiceEvent = events.find(event => event.type === 'CHOICE_REQUESTED') as Extract<DiceThroneEvent, { type: 'CHOICE_REQUESTED' }> | undefined;
        expect(choiceEvent).toBeDefined();
        expect(choiceEvent?.payload.playerId).toBe('1');
        expect(events.some(event => event.type === 'TOKEN_GRANTED' && event.payload.tokenId === TOKEN_IDS.DELAYED_POISON)).toBe(false);
        expect(events.some(event => event.type === 'TOKEN_CONSUMED')).toBe(false);

        const skipOption = choiceEvent?.payload.options.find(option => option.customId === 'treant-divine-skip-debuff');
        expect(skipOption).toBeDefined();
        let next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '1',
                sourceAbilityId: TOKEN_IDS.TREANT_DIVINE,
                customId: skipOption?.customId,
                value: skipOption?.value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as unknown as DiceThroneEvent);
        result = diceThroneFlowHooks.onPhaseExit?.({
            state: { core: next, sys: { phase: 'offensiveRoll' } },
            from: 'offensiveRoll',
            to: 'defensiveRoll',
            command: command('ADVANCE_PHASE', '0'),
            random: createQueuedRandom([1]),
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        let followUpEvents = (Array.isArray(result) ? result : (result?.events ?? [])) as DiceThroneEvent[];
        next = applyEvents(next, followUpEvents);
        expect(followUpEvents.some(event => event.type === 'TOKEN_GRANTED' && event.payload.tokenId === TOKEN_IDS.DELAYED_POISON)).toBe(true);
        expect(next.players['1'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(1);
        expect(next.players['1'].tokens[TOKEN_IDS.DELAYED_POISON]).toBe(1);

        const preventState = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        preventState.sys.phase = 'offensiveRoll';
        preventState.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'poison-blade',
            isDefendable: true,
            damage: 5,
        };
        preventState.core.players['1'].tokens[TOKEN_IDS.TREANT_DIVINE] = 1;
        result = diceThroneFlowHooks.onPhaseExit?.({
            state: { core: preventState.core, sys: { phase: 'offensiveRoll' } },
            from: 'offensiveRoll',
            to: 'defensiveRoll',
            command: command('ADVANCE_PHASE', '0'),
            random: createQueuedRandom([1]),
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const preventChoice = ((Array.isArray(result) ? result : (result?.events ?? [])) as DiceThroneEvent[])
            .find(event => event.type === 'CHOICE_REQUESTED') as Extract<DiceThroneEvent, { type: 'CHOICE_REQUESTED' }> | undefined;
        const preventOption = preventChoice?.payload.options.find(option => option.customId === 'treant-divine-prevent-debuff');
        expect(preventOption).toBeDefined();
        next = reduce(preventState.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '1',
                sourceAbilityId: TOKEN_IDS.TREANT_DIVINE,
                customId: preventOption?.customId,
                value: preventOption?.value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);
        result = diceThroneFlowHooks.onPhaseExit?.({
            state: { core: next, sys: { phase: 'offensiveRoll' } },
            from: 'offensiveRoll',
            to: 'defensiveRoll',
            command: command('ADVANCE_PHASE', '0'),
            random: createQueuedRandom([1]),
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        followUpEvents = (Array.isArray(result) ? result : (result?.events ?? [])) as DiceThroneEvent[];
        next = applyEvents(next, followUpEvents);
        expect(followUpEvents.some(event => event.type === 'TOKEN_GRANTED' && event.payload.tokenId === TOKEN_IDS.DELAYED_POISON)).toBe(false);
        expect(followUpEvents.find(event => event.type === 'TOKEN_CONSUMED')?.payload).toMatchObject({
            playerId: '1',
            tokenId: TOKEN_IDS.TREANT_DIVINE,
            amount: 1,
        });
        expect(next.players['1'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);
        expect(next.players['1'].tokens[TOKEN_IDS.DELAYED_POISON] ?? 0).toBe(0);
    });

    it('树精神圣在造成伤害前可消耗自身为本次攻击 +3 伤害', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shattering-fist',
            isDefendable: true,
            damage: 6,
        };
        state.core.pendingDamage = {
            id: 'damage-treant-divine-test',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: 6,
            currentDamage: 6,
            sourceAbilityId: 'shattering-fist',
            responseType: 'beforeDamageDealt',
            responderId: '0',
            isFullyEvaded: false,
        };

        const events = execute(state, command('USE_TOKEN', '0', { tokenId: TOKEN_IDS.TREANT_DIVINE, amount: 1 }), createQueuedRandom([1]));
        const next = applyEvents(state.core, events);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(0);
        expect(next.pendingDamage?.currentDamage).toBe(9);
        expect(next.pendingAttack?.bonusDamage).toBe(3);
    });
});
