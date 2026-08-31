import { describe, expect, it } from 'vitest';
import type { DiceThroneCommand, DiceThroneCore, DiceThroneEvent } from '../domain/types';
import { execute } from '../domain/execute';
import { buildBonusDiceSettlementEvents } from '../domain/executeTokens';
import { reduce } from '../domain/reducer';
import { diceThroneFlowHooks } from '../domain/flowHooks';
import { validateCommand } from '../domain/commandValidation';
import { RESOURCE_IDS } from '../domain/resources';
import { STATUS_IDS, TOKEN_IDS, TREANT_DICE_FACE_IDS } from '../domain/ids';
import { WILD_GROWTH_2, WILD_ROAR_2 } from '../heroes/treant/abilities';
import { getAvailableAbilityIds } from '../domain/rules';
import { createHeroMatchup, createQueuedRandom } from './test-utils';
import { MAX_HEALTH } from '../domain/types';
import { DiceThroneDomain } from '../domain';
import type { RemoveStatusCommand } from '../domain/types';

const applyEvents = (core: DiceThroneCore, events: DiceThroneEvent[]): DiceThroneCore =>
    events.reduce((current, event) => reduce(current, event), core);

const settlePendingBonusDice = (core: DiceThroneCore, timestamp = 200): DiceThroneEvent[] => {
    const settlement = core.pendingBonusDiceSettlement;
    if (!settlement) return [];
    return buildBonusDiceSettlementEvents({
        state: core,
        settlement,
        random: createQueuedRandom([1]),
        timestamp,
        sourceCommandType: 'TEST_CONFIRM_BONUS_DICE',
    });
};

const command = (type: DiceThroneCommand['type'], playerId: string, payload: Record<string, unknown> = {}): DiceThroneCommand => ({
    type,
    playerId,
    payload,
    timestamp: 100,
} as DiceThroneCommand);

describe('DiceThrone Treant Token 机制', () => {
    it('树灵培养资源不能被通用移除状态卡移除', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 1;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 1;

        const command: RemoveStatusCommand = {
            type: 'REMOVE_STATUS',
            playerId: '1',
            payload: { targetPlayerId: '0' },
            timestamp: 100,
        };

        const events = DiceThroneDomain.execute(state, command, createQueuedRandom([1]));
        expect(events.filter(event => event.type === 'TOKEN_CONSUMED')).toHaveLength(0);

        const validationState = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        validationState.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
        validationState.sys.interaction.current = {
            id: 'dt-interaction-remove',
            kind: 'dt:card-interaction',
            playerId: '1',
            data: {
                id: 'pending-remove',
                playerId: '1',
                sourceCardId: 'card-bye-bye',
                type: 'selectStatus',
                titleKey: 'interaction.removeStatus',
                selectCount: 1,
                selected: [],
                targetPlayerIds: ['0'],
                requiresTargetWithStatus: true,
            },
        };

        const validation: RemoveStatusCommand = {
            type: 'REMOVE_STATUS',
            playerId: '1',
            payload: { targetPlayerId: '0', statusId: TOKEN_IDS.TREANT_SEEDLING },
            timestamp: 101,
        };
        expect(DiceThroneDomain.validate(validationState, validation).valid).toBe(false);
    });

    it('幼种树灵可在自己的掷骰阶段消耗并重掷 1 颗已锁定骰子', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.sys.phase = 'offensiveRoll';
        state.core.rollCount = 1;
        state.core.rollDiceCount = 5;
        state.core.dice[0] = { ...state.core.dice[0], id: 0, value: 1, isKept: true };
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;

        const events = execute(state, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'treant-seedling-cultivation',
            actionIndex: 0,
            targetDieId: 0,
        }), createQueuedRandom([6]));
        const next = applyEvents(state.core, events);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.dice[0].value).toBe(6);
        expect(next.dice[0].isKept).toBe(true);
    });

    it('幼种树灵重掷应拒绝缺失或越界的目标骰且不消耗 token', () => {
        const base = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        base.sys.phase = 'offensiveRoll';
        base.core.rollCount = 1;
        base.core.rollDiceCount = 5;
        base.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
        base.core.dice[0] = { ...base.core.dice[0], id: 0, value: 1, isKept: false };
        base.core.dice[1] = { ...base.core.dice[1], id: 1, value: 2, isKept: false };

        let events = execute(base, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'treant-seedling-cultivation',
            actionIndex: 0,
        }), createQueuedRandom([6]));
        expect(events).toHaveLength(0);

        events = execute(base, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'treant-seedling-cultivation',
            actionIndex: 0,
            targetDieId: 99,
        }), createQueuedRandom([6]));
        expect(events).toHaveLength(0);

        const next = applyEvents(base.core, events);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(1);
        expect(next.dice[0].value).toBe(1);
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

    it('木苗树灵可在其他玩家的主要阶段花费，且同回合两种动作仍只允许一次', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.sys.phase = 'main1';
        state.core.activePlayerId = '1';
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 2;
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 40;
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 1;

        const healCommand = command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'treant-sapling-cultivation',
            actionIndex: 0,
        });
        expect(validateCommand(state.core, healCommand, state.sys.phase).valid).toBe(true);
        let events = execute(state, healCommand, createQueuedRandom([1]));
        const next = applyEvents(state.core, events);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(1);
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(41);
        expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(2);

        const drawCommand = command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'treant-sapling-cultivation',
            actionIndex: 1,
        });
        expect(validateCommand(next, drawCommand, 'main2').valid).toBe(false);
        events = execute({ core: next, sys: { phase: 'main2' } }, drawCommand, createQueuedRandom([1]));
        expect(events).toHaveLength(0);

        const nextTurn = reduce(next, {
            type: 'TURN_CHANGED',
            payload: { previousPlayerId: '1', nextPlayerId: '0', turnNumber: next.turnNumber + 1 },
            sourceCommandType: 'ADVANCE_PHASE',
            timestamp: 200,
        } as DiceThroneEvent);
        expect(validateCommand(nextTurn, drawCommand, 'main1').valid).toBe(true);
    });

    it('野性怒吼 II 升级后 12345 大顺子应可选择，野蛮生长 II 仍只吃 2 树枝 + 3 树叶', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollConfirmed = true;
        state.core.players['0'].abilities = state.core.players['0'].abilities.map(ability =>
            ability.id === 'wild-growth' ? { ...WILD_GROWTH_2, id: 'wild-growth' } :
            ability.id === 'wild-roar' ? { ...WILD_ROAR_2, id: 'wild-roar' } :
            ability
        );
        state.core.players['0'].abilityLevels = {
            ...state.core.players['0'].abilityLevels,
            'wild-growth': 2,
            'wild-roar': 2,
        };
        state.core.dice = state.core.dice.map((die, index) => ({
            ...die,
            ownerId: '0',
            value: index + 1,
            symbol: index < 3 ? TREANT_DICE_FACE_IDS.BRANCH : TREANT_DICE_FACE_IDS.LEAF,
            symbols: [index < 3 ? TREANT_DICE_FACE_IDS.BRANCH : TREANT_DICE_FACE_IDS.LEAF],
        }));

        const largeStraightAvailable = getAvailableAbilityIds(state.core, '0', 'offensiveRoll');
        expect(largeStraightAvailable).toContain('wild-roar-2-main');
        expect(largeStraightAvailable).not.toContain('wild-growth-2-main');
        expect(largeStraightAvailable).not.toContain('wild-roar-2-dazzle');
        expect(validateCommand(
            state.core,
            command('SELECT_ABILITY', '0', { abilityId: 'wild-roar-2-main' }),
            'offensiveRoll',
        ).valid).toBe(true);
        expect(validateCommand(
            state.core,
            command('SELECT_ABILITY', '0', { abilityId: 'wild-growth-2-main' }),
            'offensiveRoll',
        ).valid).toBe(false);

        state.core.dice = state.core.dice.map((die, index) => {
            const values = [1, 2, 4, 4, 5];
            return {
                ...die,
                ownerId: '0',
                value: values[index] ?? 1,
                symbol: index < 2 ? TREANT_DICE_FACE_IDS.BRANCH : TREANT_DICE_FACE_IDS.LEAF,
                symbols: [index < 2 ? TREANT_DICE_FACE_IDS.BRANCH : TREANT_DICE_FACE_IDS.LEAF],
            };
        });

        const wildGrowthAvailable = getAvailableAbilityIds(state.core, '0', 'offensiveRoll');
        expect(wildGrowthAvailable).toContain('wild-growth-2-main');
        expect(wildGrowthAvailable).not.toContain('wild-roar');
        expect(validateCommand(
            state.core,
            command('SELECT_ABILITY', '0', { abilityId: 'wild-growth-2-main' }),
            'offensiveRoll',
        ).valid).toBe(true);

        state.core.dice = state.core.dice.map((die, index) => {
            const values = [1, 2, 4, 6, 6];
            const symbols = [
                TREANT_DICE_FACE_IDS.BRANCH,
                TREANT_DICE_FACE_IDS.BRANCH,
                TREANT_DICE_FACE_IDS.LEAF,
                TREANT_DICE_FACE_IDS.SPIRIT,
                TREANT_DICE_FACE_IDS.SPIRIT,
            ];
            return {
                ...die,
                ownerId: '0',
                value: values[index] ?? 1,
                symbol: symbols[index] ?? TREANT_DICE_FACE_IDS.BRANCH,
                symbols: [symbols[index] ?? TREANT_DICE_FACE_IDS.BRANCH],
            };
        });

        const dazzleAvailable = getAvailableAbilityIds(state.core, '0', 'offensiveRoll');
        expect(dazzleAvailable).toContain('wild-roar-2-dazzle');
        expect(dazzleAvailable).not.toContain('wild-growth-2-main');
        expect(validateCommand(
            state.core,
            command('SELECT_ABILITY', '0', { abilityId: 'wild-roar-2-dazzle' }),
            'offensiveRoll',
        ).valid).toBe(true);
    });

    it('树灵主动动作应拒绝非法 actionIndex 或未知 passive 且不消耗 token', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.sys.phase = 'main1';
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 1;
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 40;

        const invalidPayloads = [
            { passiveId: 'treant-sapling-cultivation', actionIndex: '0' },
            { passiveId: 'treant-sapling-cultivation', actionIndex: 1.5 },
            { passiveId: 'treant-sapling-cultivation', actionIndex: -1 },
            { passiveId: 'treant-sapling-cultivation', actionIndex: 99 },
            { passiveId: 'missing-passive', actionIndex: 0 },
        ];

        for (const payload of invalidPayloads) {
            const passiveCommand = command('USE_PASSIVE_ABILITY', '0', payload);
            expect(validateCommand(state.core, passiveCommand, state.sys.phase).valid).toBe(false);
            expect(execute(state, passiveCommand, createQueuedRandom([1]))).toHaveLength(0);
        }

        const next = applyEvents(state.core, []);
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(40);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(1);
    });

    it('CHOICE_RESOLVED 通用 token/status 增量应拒绝字符串或 NaN value', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
        state.core.players['0'].statusEffects[STATUS_IDS.ENTANGLE] = 1;

        const nextTokenState = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                tokenId: TOKEN_IDS.TREANT_SEEDLING,
                value: '2' as unknown as number,
                customId: 'forged-token-choice',
                sourceAbilityId: 'forged-token-choice',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 100,
        });
        expect(nextTokenState.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(1);

        const nextStatusState = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                statusId: STATUS_IDS.ENTANGLE,
                value: Number.NaN,
                customId: 'forged-status-choice',
                sourceAbilityId: 'forged-status-choice',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        });
        expect(nextStatusState.players['0'].statusEffects[STATUS_IDS.ENTANGLE]).toBe(1);
    });

    it('木苗树灵治疗加 CP 在 CP 满时不应超过上限', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.sys.phase = 'main1';
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 1;
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 49;
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 15;

        const events = execute(state, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'treant-sapling-cultivation',
            actionIndex: 0,
        }), createQueuedRandom([1]));
        const next = applyEvents(state.core, events);

        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(0);
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(50);
        expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(15);
        expect(events.find(event => event.type === 'CP_CHANGED')?.payload.delta).toBe(0);
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

    it('木苗树灵抽牌动作在 CP 不足时不得消耗木苗', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.sys.phase = 'main1';
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING] = 1;
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 0;
        state.core.players['0'].hand = [];
        const deckBefore = state.core.players['0'].deck.length;

        const events = execute(state, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'treant-sapling-cultivation',
            actionIndex: 1,
        }), createQueuedRandom([1]));
        const next = applyEvents(state.core, events);

        expect(events).toHaveLength(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_SAPLING]).toBe(1);
        expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(0);
        expect(next.players['0'].hand).toHaveLength(0);
        expect(next.players['0'].deck).toHaveLength(deckBefore);
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
        const rolled = applyEvents(state.core, events);
        const next = applyEvents(rolled, settlePendingBonusDice(rolled));

        expect(events.some(event => event.type === 'BONUS_DIE_ROLLED')).toBe(true);
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(38);
    });

    it('生命源泉的主阶段奖励骰只能等待普通确认，不能被幼种树灵当作自己的掷骰阶段重掷', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.sys.phase = 'main1';
        state.core.players['0'].tokens[TOKEN_IDS.LIFE_SAP] = 1;
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 1;
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 35;

        const lifeSapEvents = execute(state, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'treant-life-sap',
            actionIndex: 0,
        }), createQueuedRandom([5]));
        const rolled = applyEvents(state.core, lifeSapEvents);

        expect(rolled.pendingBonusDiceSettlement?.dice).toHaveLength(1);
        expect(rolled.currentRollContext?.kind).toBe('bonus');
        expect(rolled.players['0'].resources[RESOURCE_IDS.HP]).toBe(35);

        const seedlingEvents = execute({ core: rolled, sys: state.sys }, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'treant-seedling-cultivation',
            actionIndex: 0,
            targetDieId: 0,
        }), createQueuedRandom([6]));

        expect(seedlingEvents).toHaveLength(0);
        expect(rolled.players['0'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(1);

        const next = applyEvents(rolled, settlePendingBonusDice(rolled));
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(38);
    });

    it('攻击中的奖励骰不应写入普通攻击额外骰，也不应改变刺藤读取的普通掷骰次数', () => {
        const cases = [
            { rollCount: 1, expectedHp: 30, expectedThornDamage: 0 },
            { rollCount: 3, expectedHp: 28, expectedThornDamage: 2 },
        ];

        for (const { rollCount, expectedHp, expectedThornDamage } of cases) {
            const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
            state.core.players['0'].tokens[TOKEN_IDS.THORN] = 1;
            state.core.players['0'].resources[RESOURCE_IDS.HP] = 30;
            state.core.rollCount = rollCount;
            state.core.pendingAttack = {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'ninja-test-attack',
                isDefendable: true,
                damage: 1,
                extraRoll: { value: 99, resolved: false },
            };

            const rolled = applyEvents(state.core, [{
                type: 'BONUS_DIE_ROLLED',
                payload: {
                    value: 6,
                    face: 'mask',
                    playerId: '0',
                    targetPlayerId: '1',
                    effectKey: 'bonusDie.effect.test',
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: 101,
            } as DiceThroneEvent]);

            expect(rolled.rollCount).toBe(rollCount);
            expect(rolled.pendingAttack?.extraRoll).toEqual({ value: 99, resolved: false });

            const result = diceThroneFlowHooks.onPhaseExit?.({
                state: { core: rolled, sys: { phase: 'offensiveRoll' } },
                from: 'offensiveRoll',
                to: 'main2',
                command: command('ADVANCE_PHASE', '0'),
                random: createQueuedRandom([1]),
            } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
            const events = Array.isArray(result) ? result : (result?.events ?? []);
            const next = applyEvents(rolled, events as DiceThroneEvent[]);

            expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(expectedHp);
            expect(next.players['0'].tokens[TOKEN_IDS.THORN]).toBe(0);
            expect((events as DiceThroneEvent[]).find(event => event.type === 'DAMAGE_DEALT')?.payload.amount ?? 0)
                .toBe(expectedThornDamage);
        }
    });

    it('奖励骰确认阶段不触发刺藤，随后正常进攻阶段才按普通投掷次数扣血并消费 token', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.THORN] = 1;
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 30;
        state.core.rollCount = 3;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'test-bonus-attack',
            isDefendable: false,
            damage: 0,
            settlementStage: 'preDamage',
        };

        const settlement = {
            id: 'test-bonus-attack-roll',
            sourceAbilityId: 'test-bonus-attack',
            attackerId: '0',
            targetId: '1',
            dice: [{ index: 0, value: 6, face: 'mask' }],
            rerollCostTokenId: '',
            rerollCostAmount: 0,
            rerollCount: 0,
            maxRerollCount: 0,
            readyToSettle: false,
            displayOnly: true,
            resolutionMode: 'none' as const,
            continuation: { kind: 'attack' as const, settlementStage: 'preDamage' as const, markBonusDiceResolved: false },
        };
        const opened = reduce(state.core, {
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: { settlement },
            sourceCommandType: 'TEST_BONUS_DICE',
            timestamp: 100,
        } as DiceThroneEvent);
        const settled = buildBonusDiceSettlementEvents({
            state: opened,
            settlement: opened.pendingBonusDiceSettlement!,
            random: createQueuedRandom([1]),
            timestamp: 101,
            sourceCommandType: 'CONFIRM_ROLL',
        });
        const afterBonusConfirm = applyEvents(opened, settled);

        expect(afterBonusConfirm.players['0'].resources[RESOURCE_IDS.HP]).toBe(30);
        expect(afterBonusConfirm.players['0'].tokens[TOKEN_IDS.THORN]).toBe(1);

        const exitResult = diceThroneFlowHooks.onPhaseExit?.({
            state: { core: afterBonusConfirm, sys: { phase: 'offensiveRoll' } },
            from: 'offensiveRoll',
            to: 'main2',
            command: command('ADVANCE_PHASE', '0'),
            random: createQueuedRandom([1]),
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const exitEvents = Array.isArray(exitResult) ? exitResult : (exitResult?.events ?? []);
        const final = applyEvents(afterBonusConfirm, exitEvents as DiceThroneEvent[]);

        expect(final.players['0'].resources[RESOURCE_IDS.HP]).toBe(28);
        expect(final.players['0'].tokens[TOKEN_IDS.THORN]).toBe(0);
    });

    it('生命源泉治疗按骰面半值向上取整，低点和高点边界都应正确', () => {
        const low = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        low.sys.phase = 'main1';
        low.core.players['0'].tokens[TOKEN_IDS.LIFE_SAP] = 1;
        low.core.players['0'].resources[RESOURCE_IDS.HP] = 30;
        let events = execute(low, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'treant-life-sap',
            actionIndex: 0,
        }), createQueuedRandom([1]));
        let rolled = applyEvents(low.core, events);
        let next = applyEvents(rolled, settlePendingBonusDice(rolled));
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(31);

        const high = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        high.sys.phase = 'main1';
        high.core.players['0'].tokens[TOKEN_IDS.LIFE_SAP] = 1;
        high.core.players['0'].resources[RESOURCE_IDS.HP] = 30;
        events = execute(high, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'treant-life-sap',
            actionIndex: 0,
        }), createQueuedRandom([6]));
        rolled = applyEvents(high.core, events);
        next = applyEvents(rolled, settlePendingBonusDice(rolled));
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(33);
    });

    it('生命源泉治疗可超过初始 HP 但不得超过 MAX_HEALTH', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.sys.phase = 'main1';
        state.core.players['0'].tokens[TOKEN_IDS.LIFE_SAP] = 1;
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 50;

        const events = execute(state, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'treant-life-sap',
            actionIndex: 0,
        }), createQueuedRandom([6]));
        const rolled = applyEvents(state.core, events);
        const next = applyEvents(rolled, settlePendingBonusDice(rolled));

        expect(events.filter(event => event.type === 'BONUS_DIE_ROLLED')).toHaveLength(1);
        expect(next.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(53);

        const capped = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        capped.sys.phase = 'main1';
        capped.core.players['0'].tokens[TOKEN_IDS.LIFE_SAP] = 1;
        capped.core.players['0'].resources[RESOURCE_IDS.HP] = 59;

        const cappedEvents = execute(capped, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'treant-life-sap',
            actionIndex: 0,
        }), createQueuedRandom([6]));
        const cappedRolled = applyEvents(capped.core, cappedEvents);
        const cappedNext = applyEvents(cappedRolled, settlePendingBonusDice(cappedRolled));

        expect(cappedNext.players['0'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
        expect(cappedNext.players['0'].resources[RESOURCE_IDS.HP]).toBe(MAX_HEALTH);
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

    it('刺藤在没有额外进攻投掷时只移除 token，不造成伤害', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.THORN] = 1;
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 30;
        state.core.rollCount = 1;

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
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(30);
        expect((events as DiceThroneEvent[]).some(event => event.type === 'DAMAGE_DEALT')).toBe(false);
    });

    it('战争贩子的额外进攻阶段不结算刺藤，最终 HP 和 token 都保持到正常进攻阶段', () => {
        const state = createHeroMatchup('treant', 'zhanshujia')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.THORN] = 1;
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 30;
        state.core.rollCount = 3;
        state.core.extraAttackInProgress = {
            attackerId: '0',
            originalActivePlayerId: '0',
            phaseEntered: true,
            sourceStatusId: 'war-monger',
        } as any;

        const result = diceThroneFlowHooks.onPhaseExit?.({
            state: { core: state.core, sys: { phase: 'offensiveRoll' } },
            from: 'offensiveRoll',
            to: 'main2',
            command: command('ADVANCE_PHASE', '0'),
            random: createQueuedRandom([1]),
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const events = Array.isArray(result) ? result : (result?.events ?? []);
        const next = applyEvents(state.core, events as DiceThroneEvent[]);

        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(30);
        expect(next.players['0'].tokens[TOKEN_IDS.THORN]).toBe(1);
        expect((events as DiceThroneEvent[]).some(event => event.type === 'DAMAGE_DEALT')).toBe(false);
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
        let next = applyEvents(state.core, events as DiceThroneEvent[]);
        next = reduce(next, {
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
        next = applyEvents(preventState.core, ((Array.isArray(result) ? result : (result?.events ?? [])) as DiceThroneEvent[]));
        next = reduce(next, {
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

    it('树精神圣防负面应拒绝合法 customId 但错误来源的 CHOICE_RESOLVED', () => {
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

        const result = diceThroneFlowHooks.onPhaseExit?.({
            state: { core: state.core, sys: { phase: 'offensiveRoll' } },
            from: 'offensiveRoll',
            to: 'defensiveRoll',
            command: command('ADVANCE_PHASE', '0'),
            random: createQueuedRandom([1]),
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const events = Array.isArray(result) ? result : (result?.events ?? []);
        const choiceEvent = events.find(event => event.type === 'CHOICE_REQUESTED') as Extract<DiceThroneEvent, { type: 'CHOICE_REQUESTED' }> | undefined;
        const skipOption = choiceEvent?.payload.options.find(option => option.customId === 'treant-divine-skip-debuff');
        expect(skipOption).toBeDefined();

        const withChoice = applyEvents(state.core, events as DiceThroneEvent[]);
        const next = reduce(withChoice, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '1',
                sourceAbilityId: 'forged-source',
                customId: skipOption?.customId,
                value: skipOption?.value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as unknown as DiceThroneEvent);

        expect(next.pendingAttack?.treantDivinePreventDebuffChoice).toBeUndefined();
        expect(next.players['1'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(1);
    });

    it('树精神圣防负面应拒绝合法 customId 但错误玩家的 CHOICE_RESOLVED', () => {
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

        const result = diceThroneFlowHooks.onPhaseExit?.({
            state: { core: state.core, sys: { phase: 'offensiveRoll' } },
            from: 'offensiveRoll',
            to: 'defensiveRoll',
            command: command('ADVANCE_PHASE', '0'),
            random: createQueuedRandom([1]),
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const events = Array.isArray(result) ? result : (result?.events ?? []);
        const choiceEvent = events.find(event => event.type === 'CHOICE_REQUESTED') as Extract<DiceThroneEvent, { type: 'CHOICE_REQUESTED' }> | undefined;
        const preventOption = choiceEvent?.payload.options.find(option => option.customId === 'treant-divine-prevent-debuff');
        expect(preventOption).toBeDefined();

        const withChoice = applyEvents(state.core, events as DiceThroneEvent[]);
        const next = reduce(withChoice, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                sourceAbilityId: TOKEN_IDS.TREANT_DIVINE,
                customId: preventOption?.customId,
                value: preventOption?.value,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as unknown as DiceThroneEvent);

        expect(next.pendingAttack?.treantDivinePreventDebuffChoice).toBeUndefined();
        expect(next.players['1'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(1);
    });

    it('树精神圣防负面应拒绝 source 正确但没有当前 choice 锚点的 CHOICE_RESOLVED', () => {
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

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '1',
                sourceAbilityId: TOKEN_IDS.TREANT_DIVINE,
                customId: 'treant-divine-skip-debuff',
                value: 0,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as unknown as DiceThroneEvent);

        expect(next.pendingAttack?.treantDivinePreventDebuffChoice).toBeUndefined();
        expect(next.players['1'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(1);
    });

    it('树精神圣防负面在一次选择结算后应清掉旧锚点，不能再次吃到 forged CHOICE_RESOLVED', () => {
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
        state.core.activatingAbilityId = TOKEN_IDS.TREANT_DIVINE;
        state.core.currentChoiceSourceAbilityId = TOKEN_IDS.TREANT_DIVINE;

        const first = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '1',
                sourceAbilityId: TOKEN_IDS.TREANT_DIVINE,
                customId: 'treant-divine-skip-debuff',
                value: 0,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 102,
        } as unknown as DiceThroneEvent);

        expect(first.pendingAttack?.treantDivinePreventDebuffChoice).toBe('skip');
        expect(first.activatingAbilityId).toBeUndefined();

        const second = reduce(first, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '1',
                sourceAbilityId: TOKEN_IDS.TREANT_DIVINE,
                customId: 'treant-divine-prevent-debuff',
                value: 1,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 103,
        } as unknown as DiceThroneEvent);

        expect(second.pendingAttack?.treantDivinePreventDebuffChoice).toBe('skip');
        expect(second.activatingAbilityId).toBeUndefined();
        expect(second.players['1'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(1);
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

    it('树精神圣攻击加伤应拒绝错误玩家、错误数量和错误响应时机', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 2;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shattering-fist',
            isDefendable: true,
            damage: 6,
        };
        state.core.pendingDamage = {
            id: 'damage-treant-divine-invalid-test',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: 6,
            currentDamage: 6,
            sourceAbilityId: 'shattering-fist',
            responseType: 'beforeDamageDealt',
            responderId: '0',
            isFullyEvaded: false,
        };

        let events = execute(state, command('USE_TOKEN', '1', { tokenId: TOKEN_IDS.TREANT_DIVINE, amount: 1 }), createQueuedRandom([1]));
        expect(events).toHaveLength(0);

        events = execute(state, command('USE_TOKEN', '0', { tokenId: TOKEN_IDS.TREANT_DIVINE, amount: 2 }), createQueuedRandom([1]));
        expect(events).toHaveLength(0);

        const wrongTimingState = {
            core: {
                ...state.core,
                pendingDamage: {
                    ...state.core.pendingDamage,
                    responseType: 'beforeDamageReceived' as const,
                    responderId: '1',
                },
            },
            sys: state.sys,
        };
        wrongTimingState.core.players['1'].tokens[TOKEN_IDS.TREANT_DIVINE] = 1;
        events = execute(wrongTimingState, command('USE_TOKEN', '1', { tokenId: TOKEN_IDS.TREANT_DIVINE, amount: 1 }), createQueuedRandom([1]));
        expect(events).toHaveLength(0);

        const next = applyEvents(state.core, events);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(2);
        expect(next.pendingDamage?.currentDamage).toBe(6);
    });

    it('树精神圣攻击响应窗口应拒绝错误玩家代替跳过', () => {
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
            id: 'damage-treant-divine-skip-owner-test',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: 6,
            currentDamage: 6,
            sourceAbilityId: 'shattering-fist',
            responseType: 'beforeDamageDealt',
            responderId: '0',
            isFullyEvaded: false,
        };

        const events = execute(state, command('SKIP_TOKEN_RESPONSE', '1'), createQueuedRandom([1]));

        expect(events).toHaveLength(0);
        const next = applyEvents(state.core, events);
        expect(next.pendingDamage?.responderId).toBe('0');
        expect(next.pendingDamage?.currentDamage).toBe(6);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(1);
    });

    it('树精神圣同回合已用于攻击加伤后不得再次花费', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE] = 2;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shattering-fist',
            isDefendable: true,
            damage: 6,
        };
        state.core.pendingDamage = {
            id: 'damage-treant-divine-once-test',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: 6,
            currentDamage: 6,
            sourceAbilityId: 'shattering-fist',
            responseType: 'beforeDamageDealt',
            responderId: '0',
            isFullyEvaded: false,
        };

        let events = execute(state, command('USE_TOKEN', '0', { tokenId: TOKEN_IDS.TREANT_DIVINE, amount: 1 }), createQueuedRandom([1]));
        let next = applyEvents(state.core, events);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(1);
        expect(next.pendingDamage?.currentDamage).toBe(9);

        events = execute({ core: next, sys: state.sys }, command('USE_TOKEN', '0', { tokenId: TOKEN_IDS.TREANT_DIVINE, amount: 1 }), createQueuedRandom([1]));
        expect(events).toHaveLength(0);
        expect(next.players['0'].tokens[TOKEN_IDS.TREANT_DIVINE]).toBe(1);
        expect(next.pendingDamage?.currentDamage).toBe(9);
    });
});
