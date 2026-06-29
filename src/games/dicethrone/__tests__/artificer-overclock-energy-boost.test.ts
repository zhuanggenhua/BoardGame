import { describe, expect, it } from 'vitest';
import { resolveEffectsToEvents } from '../domain/effects';
import { reduce } from '../domain/reducer';
import { buildHeroAbilitiesForFace } from '../domain/characters';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import { createHeroMatchup, fixedRandom } from './test-utils';

const applyEvents = (core: any, events: any[]) =>
    events.reduce((current, event) => reduce(current, event), core);

describe('DiceThrone 工匠超频运行能量提升', () => {
    it('超频运行 II 的能量提升只施加 3 纳米爆弹，不应附带伤害、合成器或挂住攻击链', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].abilityLevels['overclock'] = 2;
        state.core.players['0'].abilities = buildHeroAbilitiesForFace(
            'artificer',
            state.core.players['0'].playerBoardFace,
            state.core.players['0'].abilityLevels,
        );
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 0;

        const ability = state.core.players['0'].abilities.find((entry: any) => entry.id === 'overclock');
        const variant = ability?.variants?.find((entry: any) => entry.id === 'overclock-2-energy-boost');

        const events = resolveEffectsToEvents(variant?.effects ?? [], 'preDefense', {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'overclock-2-energy-boost',
            state: state.core,
            damageDealt: 0,
            timestamp: 302,
        }, { random: fixedRandom });
        const next = applyEvents(state.core, events);

        expect(events.map((event: any) => event.type)).toEqual(['STATUS_APPLIED']);
        expect(next.players['1'].statusEffects[STATUS_IDS.NANOBOMB]).toBe(3);
        expect(next.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(0);
        expect(next.pendingAttack ?? null).toBeNull();
    });
});
