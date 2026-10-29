import { describe, expect, it } from 'vitest';
import { execute } from '../domain/execute';
import { executePipeline } from '../../../engine/pipeline';
import { DiceThroneDomain } from '../domain';
import { resolveEffectsToEvents } from '../domain/effects';
import { reduce } from '../domain/reducer';
import type { DiceThroneCore, DiceThroneEvent } from '../domain/types';
import { NINJA_ABILITIES } from '../heroes/ninja/abilities';
import { NINJA_DICE_FACE_IDS } from '../domain/ids';
import { createHeroMatchup, createQueuedRandom, testSystems } from './test-utils';
import zhCN from '../../../../public/locales/zh-CN/game-dicethrone.json';
import en from '../../../../public/locales/en/game-dicethrone.json';

const reduceEvents = (core: DiceThroneCore, events: DiceThroneEvent[]) =>
    events.reduce((state, event) => reduce(state, event), core);

describe('忍者基础一往无前的玩家面板合同', () => {
    it('反馈骰面 2、1 确认前不能进入防御，确认后也不能触发防御', () => {
        let match = createHeroMatchup('ninja', 'barbarian')(['0', '1'], createQueuedRandom([1]));
        match.sys.phase = 'offensiveRoll';
        match.core.turnPhase = 'offensiveRoll';
        match.core.activePlayerId = '0';
        match.core.rollCount = 1;
        match.core.rollConfirmed = true;
        match.core.dice = [4, 5, 5, 6, 5].map((value, id) => ({
            id, value, definitionId: 'ninja-dice', isKept: false,
            symbol: value === 6 ? NINJA_DICE_FACE_IDS.MASK : NINJA_DICE_FACE_IDS.SHURIKEN,
            symbols: [value === 6 ? NINJA_DICE_FACE_IDS.MASK : NINJA_DICE_FACE_IDS.SHURIKEN],
        }));
        const run = (type: string, values: number[], payload: Record<string, unknown> = {}) => {
            const result = executePipeline(
                { domain: DiceThroneDomain, systems: testSystems }, match,
                { type, playerId: '0', payload, timestamp: 100 } as any,
                createQueuedRandom(values), ['0', '1'],
            );
            expect(result.success).toBe(true);
            if (result.success) match = result.state;
            return result;
        };
        run('SELECT_ABILITY', [1], { abilityId: 'going-forward' });
        run('ADVANCE_PHASE', [2, 1]);
        expect(match.core.pendingBonusDiceSettlement?.dice.map(die => die.value)).toEqual([2, 1]);
        expect(match.sys.phase).toBe('offensiveRoll');
        const confirmed = run('SKIP_BONUS_DICE_REROLL', [1]);
        expect(confirmed.events.some(event => event.type === 'SYS_PHASE_CHANGED' && (event.payload as any)?.to === 'defensiveRoll')).toBe(false);
        expect(match.sys.phase).not.toBe('defensiveRoll');
        expect(match.core.players['1'].resources.hp).toBe(47);
    });
    it('中英文描述包含奖励骰总和与不超过 6 时不可防御', () => {
        expect(zhCN.abilities['going-forward'].description).toContain('小于等于 6');
        expect(zhCN.abilities['going-forward'].description).toContain('不可防御');
        expect(en.abilities['going-forward'].description).toContain('6 or less');
        expect(en.abilities['going-forward'].description).not.toContain('deal 7 damage');
    });

    it.each([
        { dice: [2, 4], total: 6, defendable: false },
        { dice: [3, 4], total: 7, defendable: true },
    ])('奖励骰总和 $total 时保留对应防御权限', ({ dice, total, defendable }) => {
        const match = createHeroMatchup('ninja', 'barbarian')(['0', '1'], createQueuedRandom([1]));
        const ability = NINJA_ABILITIES.find(entry => entry.id === 'going-forward');
        expect(ability).toBeDefined();
        match.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'going-forward',
            isDefendable: true,
            damage: 0,
        };

        const rolled = resolveEffectsToEvents(ability!.effects ?? [], 'preDefense', {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'going-forward',
            state: match.core,
            damageDealt: 0,
            timestamp: 100,
        }, { random: createQueuedRandom(dice) });
        const waiting = reduceEvents(match.core, rolled);
        expect(waiting.pendingBonusDiceSettlement?.dice.map(die => die.value)).toEqual(dice);

        const confirmed = execute(
            { core: waiting, sys: { phase: 'offensiveRoll' } },
            { type: 'SKIP_BONUS_DICE_REROLL', playerId: '0', payload: {}, timestamp: 101 } as any,
            createQueuedRandom([1]),
        );
        const result = reduceEvents(waiting, confirmed);
        expect(result.pendingBonusDiceSettlement).toBeUndefined();
        expect(result.pendingAttack?.bonusDamage).toBe(total);
        expect(result.pendingAttack?.isDefendable).toBe(defendable);
    });
});
