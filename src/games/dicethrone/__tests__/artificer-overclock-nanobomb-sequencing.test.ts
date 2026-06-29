import { describe, expect, it } from 'vitest';
import { resolveEffectsToEvents } from '../domain/effects';
import { reduce } from '../domain/reducer';
import { buildHeroAbilitiesForFace } from '../domain/characters';
import { STATUS_IDS } from '../domain/ids';
import { createHeroMatchup, fixedRandom } from './test-utils';

const applyEvents = (core: any, events: any[]) =>
    events.reduce((current, event) => reduce(current, event), core);

describe('DiceThrone 工匠超频运行纳米爆弹顺序', () => {
    it('基础版超频运行会在前段先施加 1 纳米爆弹', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        const ability = state.core.players['0'].abilities.find(entry => entry.id === 'overclock');

        const events = resolveEffectsToEvents(ability?.effects ?? [], 'preDefense', {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'overclock',
            state: state.core,
            damageDealt: 0,
            timestamp: 211,
        }, { random: fixedRandom });
        const next = applyEvents(state.core, events);

        expect(events.find(event => event.type === 'STATUS_APPLIED')?.payload).toMatchObject({
            targetId: '1',
            statusId: STATUS_IDS.NANOBOMB,
            stacks: 1,
            newTotal: 1,
            sourceAbilityId: 'overclock',
        });
        expect(next.players['1'].statusEffects[STATUS_IDS.NANOBOMB]).toBe(1);
    });

    it('超频运行 II 上半区也会在前段先施加 1 纳米爆弹', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].abilityLevels['overclock'] = 2;
        state.core.players['0'].abilities = buildHeroAbilitiesForFace(
            'artificer',
            state.core.players['0'].playerBoardFace,
            state.core.players['0'].abilityLevels,
        );
        const ability = state.core.players['0'].abilities.find(entry => entry.id === 'overclock');
        const variant = ability?.variants?.find(entry => entry.id === 'overclock-2-main');

        const events = resolveEffectsToEvents(variant?.effects ?? [], 'preDefense', {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'overclock',
            state: state.core,
            damageDealt: 0,
            timestamp: 212,
        }, { random: fixedRandom });
        const next = applyEvents(state.core, events);

        expect(events.find(event => event.type === 'STATUS_APPLIED')?.payload).toMatchObject({
            targetId: '1',
            statusId: STATUS_IDS.NANOBOMB,
            stacks: 1,
            newTotal: 1,
            sourceAbilityId: 'overclock',
        });
        expect(next.players['1'].statusEffects[STATUS_IDS.NANOBOMB]).toBe(1);
    });
});
