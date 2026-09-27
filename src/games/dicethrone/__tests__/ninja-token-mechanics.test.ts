import { describe, expect, it } from 'vitest';
import type { DiceThroneCommand, DiceThroneCore, DiceThroneEvent } from '../domain/types';
import { execute } from '../domain/execute';
import { DiceThroneDomain } from '../domain';
import { GameTestRunner } from '../../../engine/testing';
import { reduce } from '../domain/reducer';
import { diceThroneFlowHooks } from '../domain/flowHooks';
import { resolveAttack, resolvePostDamageEffects } from '../domain/attack';
import { getCustomActionHandler, resolveEffectsToEvents } from '../domain/effects';
import { RESOURCE_IDS } from '../domain/resources';
import { NINJA_DICE_FACE_IDS, TOKEN_IDS } from '../domain/ids';
import { BLINK_2, DEATH_BLOSSOM_2, SLASH_2 } from '../heroes/ninja/abilities';
import {
    createHeroMatchup,
    createQueuedRandom,
    getSimpleChoicePrompt,
    injectSimpleChoicePrompt,
    respondToPrompt,
    testSystems,
} from './test-utils';

const applyEvents = (core: DiceThroneCore, events: DiceThroneEvent[]): DiceThroneCore =>
    events.reduce((current, event) => reduce(current, event), core);

const command = (type: DiceThroneCommand['type'], playerId: string, payload: Record<string, unknown> = {}): DiceThroneCommand => ({
    type,
    playerId,
    payload,
    timestamp: 100,
} as DiceThroneCommand);

const injectNinjutsuOffensiveRollEndPrompt = (state: ReturnType<ReturnType<typeof createHeroMatchup>>, sourceAbilityId = 'slash') => {
    state.sys.phase = 'offensiveRoll';
    state.sys.flowHalted = true;
    state.core.currentChoiceSourceAbilityId = sourceAbilityId;
    injectSimpleChoicePrompt(state, {
        id: `choice-${sourceAbilityId}-offensive-roll-end`,
        playerId: '0',
        title: 'offensiveRollEndToken.title',
        sourceId: sourceAbilityId,
        options: [
            {
                id: 'option-0',
                label: '使用忍术',
                value: { tokenId: TOKEN_IDS.NINJUTSU, value: 1, customId: 'use-ninjutsu' },
            },
            {
                id: 'option-1',
                label: '跳过',
                value: { value: 0, customId: 'skip' },
            },
        ],
    });
};

const confirmBonusDice = (state: ReturnType<ReturnType<typeof createHeroMatchup>>) => {
    const runner = new GameTestRunner({
        domain: DiceThroneDomain,
        systems: testSystems,
        playerIds: ['0', '1'],
        random: createQueuedRandom([1]),
        setup: () => state,
    });
    runner.setState(state);
    const result = runner.dispatch('SKIP_BONUS_DICE_REROLL', { playerId: '0' });
    expect(result.success).toBe(true);
    return result.finalState;
};

describe('DiceThrone Ninja Token 机制', () => {
    it('已有烟雾弹时，瞬身 II 的第二个烟雾弹应延迟到旧烟雾弹使用后获得', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.SMOKE_BOMB] = 1;
        state.core.pendingAttack = {
            attackerId: '1',
            defenderId: '0',
            sourceAbilityId: 'shattering-fist-3',
            defenseAbilityId: 'blink-2',
            isDefendable: true,
            damage: 5,
        };
        state.core.dice = state.core.dice.slice(0, 3).map((die, index) => ({
            ...die,
            value: index < 2 ? 6 : 1,
            symbol: index < 2 ? NINJA_DICE_FACE_IDS.MASK : NINJA_DICE_FACE_IDS.KATANA,
            isKept: false,
        }));
        state.core.rollDiceCount = 3;

        const handler = getCustomActionHandler('ninja-blink-2');
        expect(handler).toBeDefined();
        if (!handler) return;

        const events = handler({
            ctx: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'blink-2',
                state: state.core,
                damageDealt: 0,
                timestamp: 100,
                isDefensiveContext: true,
            },
            targetId: '0',
            attackerId: '0',
            sourceAbilityId: 'blink-2',
            state: state.core,
            timestamp: 100,
            random: createQueuedRandom([1]),
            action: { type: 'custom', target: 'self', customActionId: 'ninja-blink-2' },
        });

        expect(events.some(event => event.type === 'TOKEN_GRANTED' && event.payload.tokenId === TOKEN_IDS.SMOKE_BOMB)).toBe(false);
        expect(events).toContainEqual(expect.objectContaining({
            type: 'PENDING_ATTACK_UPDATED',
            payload: expect.objectContaining({
                patch: expect.objectContaining({
                    deferredTokenGrants: [expect.objectContaining({
                        triggerTokenId: TOKEN_IDS.SMOKE_BOMB,
                        targetId: '0',
                        tokenId: TOKEN_IDS.SMOKE_BOMB,
                        amount: 1,
                    })],
                }),
            }),
        }));
    });

    it('瞬身 II 的延迟烟雾弹会在伤害响应中使用旧烟雾弹后补回 1 个', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.SMOKE_BOMB] = 1;
        state.core.players['0'].abilities = [BLINK_2];
        state.core.players['1'].abilities = [{
            id: 'test-attack',
            name: 'test-attack',
            type: 'offensive',
            effects: [{
                timing: 'withDamage',
                action: { type: 'damage', target: 'opponent', value: 5 },
            }],
        }] as any;
        state.core.pendingAttack = {
            attackerId: '1',
            defenderId: '0',
            sourceAbilityId: 'test-attack',
            defenseAbilityId: 'blink',
            isDefendable: true,
            preDefenseResolved: true,
            damage: 5,
        };
        state.core.dice = state.core.dice.slice(0, 3).map((die, index) => ({
            ...die,
            value: index < 2 ? 6 : 1,
            symbol: index < 2 ? NINJA_DICE_FACE_IDS.MASK : NINJA_DICE_FACE_IDS.KATANA,
            isKept: false,
        }));
        state.core.rollDiceCount = 3;

        const attackEvents = resolveAttack(state.core, createQueuedRandom([1]), undefined, 100);
        const afterAttack = applyEvents(state.core, attackEvents);
        expect(afterAttack.pendingDamage?.deferredTokenGrants).toEqual([
            expect.objectContaining({
                triggerTokenId: TOKEN_IDS.SMOKE_BOMB,
                targetId: '0',
                tokenId: TOKEN_IDS.SMOKE_BOMB,
                amount: 1,
            }),
        ]);

        const useSmokeEvents = execute(
            { core: afterAttack, sys: { phase: 'defensiveRoll' } },
            command('USE_TOKEN', '0', { tokenId: TOKEN_IDS.SMOKE_BOMB, amount: 1 }),
            createQueuedRandom([2]),
        );
        expect(useSmokeEvents).toContainEqual(expect.objectContaining({
            type: 'TOKEN_GRANTED',
            payload: expect.objectContaining({
                targetId: '0',
                tokenId: TOKEN_IDS.SMOKE_BOMB,
                amount: 1,
                newTotal: 1,
            }),
        }));
        const afterUse = applyEvents(afterAttack, useSmokeEvents);
        expect(afterUse.players['0'].tokens[TOKEN_IDS.SMOKE_BOMB]).toBe(1);
    });

    it('烟雾弹改为掷骰 1-3 避免本次伤害，而不是固定减伤', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.SMOKE_BOMB] = 1;
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 30;
        state.core.pendingDamage = {
            id: 'damage-smoke-test',
            sourcePlayerId: '1',
            targetPlayerId: '0',
            originalDamage: 7,
            currentDamage: 7,
            sourceAbilityId: 'test-attack',
            responseType: 'beforeDamageReceived',
            responderId: '0',
            isFullyEvaded: false,
        };

        const events = execute(state, command('USE_TOKEN', '0', { tokenId: TOKEN_IDS.SMOKE_BOMB, amount: 1 }), createQueuedRandom([2]));
        const afterUse = applyEvents(state.core, events);
        const settleEvents = execute(
            { core: afterUse, sys: { phase: 'defensiveRoll' } },
            command('SKIP_TOKEN_RESPONSE', '0'),
            createQueuedRandom([1]),
        );
        const next = applyEvents(afterUse, settleEvents);

        expect(events.find(event => event.type === 'TOKEN_USED')?.payload).toMatchObject({
            tokenId: TOKEN_IDS.SMOKE_BOMB,
            evasionRoll: { value: 2, success: true },
        });
        expect(next.players['0'].tokens[TOKEN_IDS.SMOKE_BOMB]).toBe(0);
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(30);
        expect(next.pendingDamage).toBeUndefined();
    });

    it('忍术会在防御前的攻击掷骰结束选择中掷骰，并把 4-5 结果作为 +2 写入当前攻击', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.NINJUTSU] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'slash',
            isDefendable: true,
            damage: 6,
        };
        injectNinjutsuOffensiveRollEndPrompt(state);

        const result = respondToPrompt(state, 'option-0', '0', createQueuedRandom([5]), ['0', '1']);

        expect(result.success).toBe(true);
        if (!result.success) return;

        expect(result.events.some(event => event.type === 'BONUS_DIE_ROLLED')).toBe(true);
        expect(result.state.core.players['0'].tokens[TOKEN_IDS.NINJUTSU]).toBe(0);
        expect(result.state.core.pendingAttack?.bonusDamage).toBeUndefined();
        expect(result.state.core.pendingAttack?.isDefendable).toBe(true);
        expect(result.state.core.pendingDamage).toBeUndefined();
        expect(result.state.core.pendingAttack?.settlementStage).toBe('preDamage');

        const settledState = confirmBonusDice(result.state);
        expect(settledState.core.pendingAttack?.bonusDamage).toBe(2);
    });

    it('斩击 II postDamage 应使用攻击骰快照判断三个相同数字，防御阶段不读取当前防御骰', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.NINJUTSU] = 0;
        state.core.players['0'].abilities = state.core.players['0'].abilities.map((ability) => (
            ability.id === 'slash' ? SLASH_2 : ability
        ));
        state.core.dice = state.core.dice.map((die, index) => ({
            ...die,
            value: index + 2,
        }));
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'slash-2-4',
            defenseAbilityId: 'splinter',
            isDefendable: true,
            damage: 6,
            damageResolved: true,
            resolvedDamage: 6,
            attackDiceValues: [1, 1, 1, 4, 5],
        };

        const events = resolvePostDamageEffects(state.core, createQueuedRandom([1]), 300);
        const next = applyEvents(state.core, events);

        expect(events.some(event => event.type === 'TOKEN_GRANTED' && event.payload.tokenId === TOKEN_IDS.NINJUTSU)).toBe(true);
        expect(next.players['0'].tokens[TOKEN_IDS.NINJUTSU]).toBe(1);
    });

    it('忍术掷出 6 后选择慢性中毒分支，应在防御前给当前攻击 +2 并给防御者慢性中毒', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.NINJUTSU] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'slash',
            isDefendable: true,
            damage: 6,
        };
        injectNinjutsuOffensiveRollEndPrompt(state);

        const useResult = respondToPrompt(state, 'option-0', '0', createQueuedRandom([6]), ['0', '1']);

        expect(useResult.success).toBe(true);
        if (!useResult.success) return;

        const settledState = confirmBonusDice(useResult.state);
        const followupPrompt = getSimpleChoicePrompt(settledState, 'slash');
        expect(followupPrompt.options.map(option => option.value?.customId)).toContain('ninja-ninjutsu-poison');

        const poisonOption = followupPrompt.options.find(option => option.value?.customId === 'ninja-ninjutsu-poison');
        expect(poisonOption).toBeTruthy();

        const resolveResult = respondToPrompt(settledState, poisonOption!.id, '0', createQueuedRandom([1]), ['0', '1']);

        expect(resolveResult.success).toBe(true);
        if (!resolveResult.success) return;

        expect(resolveResult.state.core.players['0'].tokens[TOKEN_IDS.NINJUTSU]).toBe(0);
        expect(resolveResult.state.core.pendingAttack?.bonusDamage).toBe(2);
        expect(resolveResult.state.core.players['1'].tokens[TOKEN_IDS.DELAYED_POISON]).toBe(1);
        expect(resolveResult.state.core.pendingDamage).toBeUndefined();
        expect(resolveResult.state.core.pendingAttack?.settlementStage).toBe('preDamage');
        expect(resolveResult.state.core.pendingAttack?.isDefendable).toBe(true);
    });

    it('忍术掷出 6 后可以单独选择 +2 伤害，不附加慢性中毒或不可防御', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.NINJUTSU] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'slash',
            isDefendable: true,
            damage: 6,
        };
        injectNinjutsuOffensiveRollEndPrompt(state);

        const useResult = respondToPrompt(state, 'option-0', '0', createQueuedRandom([6]), ['0', '1']);
        expect(useResult.success).toBe(true);
        if (!useResult.success) return;

        const settledState = confirmBonusDice(useResult.state);
        const followupPrompt = getSimpleChoicePrompt(settledState, 'slash');
        const bonusOption = followupPrompt.options.find(option => option.value?.customId === 'ninja-ninjutsu-bonus-damage');
        expect(bonusOption).toBeTruthy();

        const resolveResult = respondToPrompt(settledState, bonusOption!.id, '0', createQueuedRandom([1]), ['0', '1']);
        expect(resolveResult.success).toBe(true);
        if (!resolveResult.success) return;

        expect(resolveResult.state.core.pendingAttack?.bonusDamage).toBe(2);
        expect(resolveResult.state.core.pendingAttack?.isDefendable).toBe(true);
        expect(resolveResult.state.core.players['1'].tokens[TOKEN_IDS.DELAYED_POISON] ?? 0).toBe(0);
    });

    it('忍术掷出 6 后选择不可防御分支，应跳过防御并直接按加成后的伤害结算', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.NINJUTSU] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'slash',
            isDefendable: true,
            damage: 6,
        };
        injectNinjutsuOffensiveRollEndPrompt(state);

        const useResult = respondToPrompt(state, 'option-0', '0', createQueuedRandom([6]), ['0', '1']);

        expect(useResult.success).toBe(true);
        if (!useResult.success) return;

        const settledState = confirmBonusDice(useResult.state);
        const followupPrompt = getSimpleChoicePrompt(settledState, 'slash');
        const undefendableOption = followupPrompt.options.find(option => option.value?.customId === 'ninja-ninjutsu-undefendable');
        expect(undefendableOption).toBeTruthy();

        const resolveResult = respondToPrompt(settledState, undefendableOption!.id, '0', createQueuedRandom([1]), ['0', '1']);

        expect(resolveResult.success).toBe(true);
        if (!resolveResult.success) return;

        expect(resolveResult.state.core.players['0'].tokens[TOKEN_IDS.NINJUTSU]).toBe(0);
        expect(resolveResult.events.some(event => event.type === 'BONUS_DAMAGE_ADDED')).toBe(true);
        expect(resolveResult.events.some(event => event.type === 'ATTACK_MADE_UNDEFENDABLE')).toBe(true);
    });

    it('基础死亡盛放应按卡图结算伤害，并在出现面具时将攻击改为不可防御', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.NINJUTSU] = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'death-blossom',
            isDefendable: true,
            damage: 0,
        };
        state.sys.phase = 'offensiveRoll';
        state.sys.flowHalted = false;
        state.core.rollConfirmed = true;

        const result = diceThroneFlowHooks.onPhaseExit?.({
            state: { core: state.core, sys: state.sys },
            from: 'offensiveRoll',
            to: 'main2',
            command: command('ADVANCE_PHASE', '0'),
            random: createQueuedRandom([6, 6, 4, 4, 1]),
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const events = Array.isArray(result) ? result : (result?.events ?? []);
        const opened = applyEvents(state.core, events as DiceThroneEvent[]);
        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random: createQueuedRandom([1]),
            setup: () => ({ core: opened, sys: state.sys }),
        });
        runner.setState({ core: opened, sys: state.sys });
        const settled = runner.dispatch('SKIP_BONUS_DICE_REROLL', { playerId: '0' });
        expect(settled.success).toBe(true);
        const next = settled.finalState.core;

        expect(events.filter(event => event.type === 'BONUS_DIE_ROLLED')).toHaveLength(5);
        expect(next.pendingAttack?.bonusDamage).toBe(5);
        expect(next.players['0'].tokens[TOKEN_IDS.NINJUTSU]).toBe(0);
        expect(settled.finalState.sys.interaction.current).toBeUndefined();
        expect(settled.finalState.sys.phase).toBe('offensiveRoll');
        expect(next.pendingAttack?.isDefendable).toBe(false);
        expect(settled.events.some(event => event.type === 'ATTACK_MADE_UNDEFENDABLE')).toBe(true);
    });

    it('死亡盛放 II 在奖励骰收口出面具后，应先把当前攻击改成不可防御', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'death-blossom-2',
            isDefendable: true,
            damage: 0,
        };

        const openEvents = resolveEffectsToEvents(
            DEATH_BLOSSOM_2.effects ?? [],
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'death-blossom-2',
                state: state.core,
                damageDealt: 0,
                timestamp: 260,
            },
            { random: createQueuedRandom([6, 6, 4, 4, 1]) },
        );
        const afterOpen = applyEvents(state.core, openEvents);

        expect(afterOpen.pendingBonusDiceSettlement).toBeTruthy();

        const settleEvents = execute(
            { core: afterOpen, sys: { phase: 'offensiveRoll' } },
            command('SKIP_BONUS_DICE_REROLL', '0'),
            createQueuedRandom([1]),
        );
        const afterSettle = applyEvents(afterOpen, settleEvents);

        expect(afterSettle.pendingAttack?.bonusDamage).toBe(5);
        expect(afterSettle.pendingAttack?.isDefendable).toBe(false);
        expect(settleEvents.some(event => event.type === 'ATTACK_MADE_UNDEFENDABLE')).toBe(true);
    });

    it('同一次攻击中应允许连续使用多个忍术，而不是第一次后直接锁死', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.NINJUTSU] = 2;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'slash',
            isDefendable: true,
            damage: 6,
        };
        injectNinjutsuOffensiveRollEndPrompt(state);

        const firstUse = respondToPrompt(state, 'option-0', '0', createQueuedRandom([5]), ['0', '1']);
        expect(firstUse.success).toBe(true);
        if (!firstUse.success) return;

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random: createQueuedRandom([1]),
            setup: () => firstUse.state,
        });
        runner.setState(firstUse.state);
        const firstSettled = runner.dispatch('SKIP_BONUS_DICE_REROLL', { playerId: '0' });
        expect(firstSettled.success).toBe(true);
        const firstSettledState = firstSettled.finalState;

        expect(firstSettledState.core.players['0'].tokens[TOKEN_IDS.NINJUTSU]).toBe(1);
        expect(firstSettledState.core.pendingAttack?.bonusDamage).toBe(2);

        const secondPrompt = getSimpleChoicePrompt(firstSettledState, 'slash');
        const secondUseOption = secondPrompt.options.find(option => option.value?.customId === 'use-ninjutsu');
        expect(secondUseOption).toBeTruthy();

        const secondUse = respondToPrompt(firstSettledState, secondUseOption!.id, '0', createQueuedRandom([4]), ['0', '1']);
        expect(secondUse.success).toBe(true);
        if (!secondUse.success) return;

        runner.setState(secondUse.state);
        const secondSettled = runner.dispatch('SKIP_BONUS_DICE_REROLL', { playerId: '0' });
        expect(secondSettled.success).toBe(true);
        const secondSettledState = secondSettled.finalState;

        expect(secondSettledState.core.players['0'].tokens[TOKEN_IDS.NINJUTSU]).toBe(0);
        expect(secondSettledState.core.pendingAttack?.bonusDamage).toBe(4);
        expect(secondSettledState.sys.interaction.current).toBeUndefined();
    });

    it('忍术掷出 6 并选择不可防御后，若仍有剩余忍术应继续允许再用一次', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.NINJUTSU] = 2;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'slash',
            isDefendable: true,
            damage: 6,
        };
        injectNinjutsuOffensiveRollEndPrompt(state);

        const firstUse = respondToPrompt(state, 'option-0', '0', createQueuedRandom([6]), ['0', '1']);
        expect(firstUse.success).toBe(true);
        if (!firstUse.success) return;

        const firstSettledState = confirmBonusDice(firstUse.state);
        const followupPrompt = getSimpleChoicePrompt(firstSettledState, 'slash');
        const undefendableOption = followupPrompt.options.find(option => option.value?.customId === 'ninja-ninjutsu-undefendable');
        expect(undefendableOption).toBeTruthy();

        const resolveResult = respondToPrompt(firstSettledState, undefendableOption!.id, '0', createQueuedRandom([1]), ['0', '1']);
        expect(resolveResult.success).toBe(true);
        if (!resolveResult.success) return;

        expect(resolveResult.state.core.players['0'].tokens[TOKEN_IDS.NINJUTSU]).toBe(1);
        expect(resolveResult.state.core.pendingAttack?.isDefendable).toBe(false);

        const continuePrompt = getSimpleChoicePrompt(resolveResult.state, 'slash');
        expect(continuePrompt.options.map(option => option.value?.customId)).toContain('use-ninjutsu');
        expect(continuePrompt.options.map(option => option.value?.customId)).toContain('skip');
    });

    it('慢性中毒在拥有者回合结束时移除并按层造成伤害', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['1'].tokens[TOKEN_IDS.DELAYED_POISON] = 2;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 20;
        state.core.activePlayerId = '1';

        const result = diceThroneFlowHooks.onPhaseExit?.({
            state: { core: state.core, sys: { phase: 'discard' } },
            from: 'discard',
            to: 'upkeep',
            command: command('ADVANCE_PHASE', '1'),
            random: createQueuedRandom([1]),
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const events = Array.isArray(result) ? result : (result?.events ?? []);
        const next = applyEvents(state.core, events as DiceThroneEvent[]);

        expect(next.players['1'].tokens[TOKEN_IDS.DELAYED_POISON]).toBe(0);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(14);
    });
});
