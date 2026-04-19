import { describe, expect, it } from 'vitest';
import type { FactionId } from '../domain/types';
import { summonerWarsCriticalImageResolver } from '../criticalImageResolver';

const ALL_HERO_ATLASES = [
    'summonerwars/hero/Necromancer/hero',
    'summonerwars/hero/Trickster/hero',
    'summonerwars/hero/Paladin/hero',
    'summonerwars/hero/Goblin/hero',
    'summonerwars/hero/Frost/hero',
    'summonerwars/hero/Barbaric/hero',
];

const ALL_TIP_IMAGES = [
    'summonerwars/hero/Necromancer/tip',
    'summonerwars/hero/Trickster/tip',
    'summonerwars/hero/Paladin/tip',
    'summonerwars/hero/Goblin/tip',
    'summonerwars/hero/Frost/tip',
    'summonerwars/hero/Barbaric/tip',
];

const SELECTION_CRITICAL = [
    'summonerwars/common/map',
    'summonerwars/common/cardback',
];

const GAMEPLAY_COMMON = [
    'summonerwars/common/Portal',
    'summonerwars/common/dice',
];

function makeState(
    hostStarted: boolean,
    selectedFactions: Partial<Record<'0' | '1', FactionId | 'unselected'>> = {},
    options?: { tutorial?: boolean },
) {
    return {
        core: {
            hostStarted,
            selectedFactions: {
                '0': selectedFactions['0'] ?? 'unselected',
                '1': selectedFactions['1'] ?? 'unselected',
            },
        },
        sys: options?.tutorial ? { tutorial: { active: true } } : undefined,
    };
}

describe('summonerWarsCriticalImageResolver', () => {
    it('无状态时：选角关键图进 critical，gameplay 通用图和 tips 进 warm', () => {
        const result = summonerWarsCriticalImageResolver(undefined, undefined, '0');

        expect(result.phaseKey).toBe('init:0');
        expect(result.critical).toEqual([...SELECTION_CRITICAL, ...ALL_HERO_ATLASES]);
        expect(result.warm).toEqual([...GAMEPLAY_COMMON, ...ALL_TIP_IMAGES]);
    });

    it('选角阶段按 gameplay 通用 -> 自己 -> 对手 -> 其他 排列 warm', () => {
        const result = summonerWarsCriticalImageResolver(
            makeState(false, { '0': 'necromancer', '1': 'paladin' }),
            undefined,
            '0',
        );

        expect(result.phaseKey).toBe('factionSelect:0:0:necromancer|1:paladin');
        const portalIndex = result.warm.indexOf('summonerwars/common/Portal');
        const myCardsIndex = result.warm.indexOf('summonerwars/hero/Necromancer/cards');
        const opponentCardsIndex = result.warm.indexOf('summonerwars/hero/Paladin/cards');
        const unrelatedTipIndex = result.warm.indexOf('summonerwars/hero/Trickster/tip');

        expect(portalIndex).toBe(0);
        expect(myCardsIndex).toBeGreaterThan(portalIndex);
        expect(opponentCardsIndex).toBeGreaterThan(myCardsIndex);
        expect(unrelatedTipIndex).toBeGreaterThan(opponentCardsIndex);
    });

    it('playing 阶段按自己 -> 对手排序 critical，并把未选择阵营留在 warm', () => {
        const result = summonerWarsCriticalImageResolver(
            makeState(true, { '0': 'necromancer', '1': 'paladin' }),
            undefined,
            '0',
        );

        expect(result.phaseKey).toBe('playing:0:0:necromancer|1:paladin');
        expect(result.critical).toContain('summonerwars/common/Portal');
        expect(result.critical).toContain('summonerwars/common/dice');
        expect(result.critical).toContain('summonerwars/hero/Necromancer/hero');
        expect(result.critical).toContain('summonerwars/hero/Necromancer/cards');
        expect(result.critical).toContain('summonerwars/hero/Paladin/hero');
        expect(result.critical).toContain('summonerwars/hero/Paladin/cards');

        const myCardsIndex = result.critical.indexOf('summonerwars/hero/Necromancer/cards');
        const opponentCardsIndex = result.critical.indexOf('summonerwars/hero/Paladin/cards');
        expect(myCardsIndex).toBeGreaterThanOrEqual(0);
        expect(opponentCardsIndex).toBeGreaterThan(myCardsIndex);

        expect(result.warm).toContain('summonerwars/hero/Trickster/cards');
        expect(result.critical).not.toContain('summonerwars/hero/Trickster/cards');
    });

    it('教程模式 playing 阶段不再继续 warm 未选择阵营', () => {
        const result = summonerWarsCriticalImageResolver(
            makeState(true, { '0': 'necromancer', '1': 'necromancer' }, { tutorial: true }),
            undefined,
            '0',
        );

        expect(result.warm).toEqual([]);
        expect(result.critical).toContain('summonerwars/hero/Necromancer/cards');
    });

    it('相同阵营被双方选中时 critical 结果自动去重', () => {
        const result = summonerWarsCriticalImageResolver(
            makeState(true, { '0': 'goblin', '1': 'goblin' }),
            undefined,
            '0',
        );

        const goblinCardsCount = result.critical.filter(
            (path) => path === 'summonerwars/hero/Goblin/cards',
        ).length;
        expect(goblinCardsCount).toBe(1);
    });
});
