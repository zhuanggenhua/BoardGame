import { describe, it, expect } from 'vitest';
import { smashUpCriticalImageResolver } from '../criticalImageResolver';

const BASE_ATLAS_PATHS = [
    'smashup/base/base1',
    'smashup/base/base2',
    'smashup/base/base3',
    'smashup/base/base4',
];

const CARD_ATLAS_PATHS = [
    'smashup/cards/cards1',
    'smashup/cards/cards2',
    'smashup/cards/cards3',
    'smashup/cards/cards4',
];

/** 构造最小 MatchState 结构 */
function makeState(phase: string, extra?: Record<string, unknown>) {
    return { sys: { phase }, core: {}, ...extra };
}

describe('smashUpCriticalImageResolver', () => {
    it('无 state 时（playing 路径）：卡牌+基地都是关键图片', () => {
        const result = smashUpCriticalImageResolver(undefined);
        expect(result.critical).toEqual([...CARD_ATLAS_PATHS, ...BASE_ATLAS_PATHS]);
        expect(result.warm).toEqual([]);
        expect(result.phaseKey).toBe('playing');
    });

    it('派系选择阶段：卡牌关键、基地暖加载', () => {
        const state = makeState('factionSelect');
        const result = smashUpCriticalImageResolver(state);
        expect(result.critical).toEqual(CARD_ATLAS_PATHS);
        expect(result.warm).toEqual(BASE_ATLAS_PATHS);
        expect(result.phaseKey).toBe('factionSelect');
    });

    it('playCards 阶段：卡牌+基地都是关键图片', () => {
        const state = makeState('playCards');
        const result = smashUpCriticalImageResolver(state);
        expect(result.critical).toEqual([...CARD_ATLAS_PATHS, ...BASE_ATLAS_PATHS]);
        expect(result.warm).toEqual([]);
        expect(result.phaseKey).toBe('playing');
    });

    it('教程模式（playing 阶段）：卡牌+基地都是关键图片', () => {
        const state = {
            sys: { phase: 'playCards', tutorial: { active: true } },
            core: {},
        };
        const result = smashUpCriticalImageResolver(state);
        expect(result.critical).toEqual([...CARD_ATLAS_PATHS, ...BASE_ATLAS_PATHS]);
        expect(result.warm).toEqual([]);
    });

    it('关键列表和暖列表无重叠', () => {
        const result = smashUpCriticalImageResolver(makeState('factionSelect'));
        const criticalSet = new Set(result.critical);
        for (const warm of result.warm) {
            expect(criticalSet.has(warm)).toBe(false);
        }
    });

    it('派系选择阶段关键列表包含全部 4 个卡牌图集', () => {
        const result = smashUpCriticalImageResolver(makeState('factionSelect'));
        for (const atlas of CARD_ATLAS_PATHS) {
            expect(result.critical).toContain(atlas);
        }
        expect(result.critical).toHaveLength(4);
    });

    it('playing 阶段关键列表包含全部 8 个图集（4 卡牌 + 4 基地）', () => {
        const result = smashUpCriticalImageResolver(makeState('playCards'));
        expect(result.critical).toHaveLength(8);
        for (const atlas of [...CARD_ATLAS_PATHS, ...BASE_ATLAS_PATHS]) {
            expect(result.critical).toContain(atlas);
        }
    });
});
