import { describe, expect, it } from 'vitest';
import { resolveEffectsToEvents } from '../domain/effects';
import { reduce } from '../domain/reducer';
import { buildHeroAbilitiesForFace } from '../domain/characters';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import { createHeroMatchup, fixedRandom } from './test-utils';

const applyEvents = (core: any, events: any[]) =>
    events.reduce((current, event) => reduce(current, event), core);

describe('DiceThrone 工匠唤醒机械回归', () => {
    it('唤醒机械 II 的精密制造分支只获得 5 合成器，不应附带纳米爆弹或挂住攻击链', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].abilityLevels['activate-bots'] = 2;
        state.core.players['0'].abilities = buildHeroAbilitiesForFace(
            'artificer',
            state.core.players['0'].playerBoardFace,
            state.core.players['0'].abilityLevels,
        );
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 0;

        const ability = state.core.players['0'].abilities.find((entry: any) => entry.id === 'activate-bots');
        const variant = ability?.variants?.find((entry: any) => entry.id === 'activate-bots-2-precision-fabrication');

        const events = resolveEffectsToEvents(variant?.effects ?? [], 'preDefense', {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'activate-bots-2-precision-fabrication',
            state: state.core,
            damageDealt: 0,
            timestamp: 301,
        }, { random: fixedRandom });
        const next = applyEvents(state.core, events);

        expect(events.map((event: any) => event.type)).toEqual(['TOKEN_GRANTED']);
        expect(next.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(5);
        expect(next.players['1'].statusEffects[STATUS_IDS.NANOBOMB] ?? 0).toBe(0);
        expect(next.pendingAttack ?? null).toBeNull();
    });
});
