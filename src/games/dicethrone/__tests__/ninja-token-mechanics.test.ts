import { describe, expect, it } from 'vitest';
import type { DiceThroneCommand, DiceThroneCore, DiceThroneEvent } from '../domain/types';
import { execute } from '../domain/execute';
import { reduce } from '../domain/reducer';
import { diceThroneFlowHooks } from '../domain/flowHooks';
import { resolvePostDamageEffects } from '../domain/attack';
import { getChoiceResolvedEventHandler } from '../domain/choiceResolvedEvents';
import { RESOURCE_IDS } from '../domain/resources';
import { TOKEN_IDS } from '../domain/ids';
import { SLASH_2 } from '../heroes/ninja/abilities';
import { createHeroMatchup, createQueuedRandom } from './test-utils';

const applyEvents = (core: DiceThroneCore, events: DiceThroneEvent[]): DiceThroneCore =>
    events.reduce((current, event) => reduce(current, event), core);

const command = (type: DiceThroneCommand['type'], playerId: string, payload: Record<string, unknown> = {}): DiceThroneCommand => ({
    type,
    playerId,
    payload,
    timestamp: 100,
} as DiceThroneCommand);

describe('DiceThrone Ninja Token 机制', () => {
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
        const next = applyEvents(state.core, events);

        expect(events.find(event => event.type === 'TOKEN_USED')?.payload).toMatchObject({
            tokenId: TOKEN_IDS.SMOKE_BOMB,
            evasionRoll: { value: 2, success: true },
        });
        expect(next.players['0'].tokens[TOKEN_IDS.SMOKE_BOMB]).toBe(0);
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(30);
        expect(next.pendingDamage).toBeUndefined();
    });

    it('忍术会掷骰并把 4-5 结果作为 +2 写入当前 pendingDamage', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.NINJUTSU] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'slash',
            isDefendable: true,
            damage: 6,
        };
        state.core.pendingDamage = {
            id: 'damage-ninjutsu-test',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: 6,
            currentDamage: 6,
            sourceAbilityId: 'slash',
            responseType: 'beforeDamageDealt',
            responderId: '0',
            isFullyEvaded: false,
        };

        const events = execute(state, command('USE_TOKEN', '0', { tokenId: TOKEN_IDS.NINJUTSU, amount: 1 }), createQueuedRandom([5]));
        const next = applyEvents(state.core, events);

        expect(events.some(event => event.type === 'BONUS_DIE_ROLLED')).toBe(true);
        expect(next.players['0'].tokens[TOKEN_IDS.NINJUTSU]).toBe(0);
        expect(next.pendingDamage?.currentDamage).toBe(8);
        expect(next.pendingAttack?.bonusDamage).toBe(2);
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

    it('忍术掷出 6 后选择慢性中毒分支，应 +2 伤害并给防御者慢性中毒', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.NINJUTSU] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'slash',
            isDefendable: true,
            damage: 6,
        };
        state.core.pendingDamage = {
            id: 'damage-ninjutsu-choice-test',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: 6,
            currentDamage: 6,
            sourceAbilityId: 'slash',
            responseType: 'beforeDamageDealt',
            responderId: '0',
            isFullyEvaded: false,
        };

        const tokenEvents = execute(state, command('USE_TOKEN', '0', { tokenId: TOKEN_IDS.NINJUTSU, amount: 1 }), createQueuedRandom([6]));
        const afterRoll = applyEvents(state.core, tokenEvents);
        const choiceEvent = tokenEvents.find(event => event.type === 'CHOICE_REQUESTED');
        const handler = getChoiceResolvedEventHandler('ninja-ninjutsu-poison');

        expect(choiceEvent?.payload.options.map(option => option.customId)).toContain('ninja-ninjutsu-poison');
        expect(handler).toBeDefined();

        const followupEvents = handler?.({
            state: afterRoll,
            playerId: '0',
            customId: 'ninja-ninjutsu-poison',
            sourceAbilityId: 'slash',
            value: 1,
            timestamp: 200,
        }) ?? [];
        const next = applyEvents(afterRoll, followupEvents);

        expect(next.players['0'].tokens[TOKEN_IDS.NINJUTSU]).toBe(0);
        expect(next.pendingDamage?.currentDamage).toBe(8);
        expect(next.pendingAttack?.bonusDamage).toBe(2);
        expect(next.players['1'].tokens[TOKEN_IDS.DELAYED_POISON]).toBe(1);
    });

    it('忍术掷出 6 后选择不可防御分支，应 +2 伤害并使攻击不可防御', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.NINJUTSU] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'slash',
            isDefendable: true,
            damage: 6,
        };
        state.core.pendingDamage = {
            id: 'damage-ninjutsu-undefendable-test',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: 6,
            currentDamage: 6,
            sourceAbilityId: 'slash',
            responseType: 'beforeDamageDealt',
            responderId: '0',
            isFullyEvaded: false,
        };

        const tokenEvents = execute(state, command('USE_TOKEN', '0', { tokenId: TOKEN_IDS.NINJUTSU, amount: 1 }), createQueuedRandom([6]));
        const afterRoll = applyEvents(state.core, tokenEvents);
        const handler = getChoiceResolvedEventHandler('ninja-ninjutsu-undefendable');

        expect(handler).toBeDefined();

        const followupEvents = handler?.({
            state: afterRoll,
            playerId: '0',
            customId: 'ninja-ninjutsu-undefendable',
            sourceAbilityId: 'slash',
            value: 1,
            timestamp: 200,
        }) ?? [];
        const next = applyEvents(afterRoll, followupEvents);

        expect(next.pendingDamage?.currentDamage).toBe(8);
        expect(next.pendingAttack?.bonusDamage).toBe(2);
        expect(next.pendingAttack?.isDefendable).toBe(false);
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
