import { describe, it, expect } from 'vitest';
import { smashUpCriticalImageResolver } from '../criticalImageResolver';
import { getSmashUpAtlasImagesByKind } from '../domain/atlasCatalog';

const ALL_BASE_ATLAS = getSmashUpAtlasImagesByKind('base');
const ALL_CARD_ATLAS = getSmashUpAtlasImagesByKind('card');

/** 构造最小 MatchState 结构 */
function makeState(phase: string, extra?: Record<string, unknown>) {
    return { sys: { phase }, core: {}, ...extra };
}

/** 构造带玩家派系的 playing 状态 */
function makePlayingState(
    factions: Record<string, [string, string]>,
    options?: { tutorial?: boolean },
) {
    return {
        sys: {
            phase: 'playCards',
            ...(options?.tutorial ? { tutorial: { active: true } } : {}),
        },
        core: {
            players: Object.fromEntries(
                Object.entries(factions).map(([pid, f]) => [pid, { factions: f }]),
            ),
        },
    };
}

describe('smashUpCriticalImageResolver', () => {
    it('无 state 时（playing 路径）：卡牌+基地都是关键图片', () => {
        const result = smashUpCriticalImageResolver(undefined);
        expect(result.critical).toEqual([...ALL_CARD_ATLAS, ...ALL_BASE_ATLAS]);
        expect(result.warm).toEqual([]);
        expect(result.phaseKey).toBe('playing');
    });

    it('派系选择阶段：卡牌关键、基地暖加载', () => {
        const state = makeState('factionSelect');
        const result = smashUpCriticalImageResolver(state);
        expect(result.critical).toEqual(ALL_CARD_ATLAS);
        expect(result.warm).toEqual(ALL_BASE_ATLAS);
        expect(result.phaseKey).toBe('factionSelect');
    });

    it('playCards 阶段（非教程）：卡牌+基地都是关键图片', () => {
        const state = makeState('playCards');
        const result = smashUpCriticalImageResolver(state);
        expect(result.critical).toEqual([...ALL_CARD_ATLAS, ...ALL_BASE_ATLAS]);
        expect(result.warm).toEqual([]);
        expect(result.phaseKey).toBe('playing');
    });

    it('关键列表和暖列表无重叠', () => {
        const result = smashUpCriticalImageResolver(makeState('factionSelect'));
        const criticalSet = new Set(result.critical);
        for (const warm of result.warm) {
            expect(criticalSet.has(warm)).toBe(false);
        }
    });

    it('派系选择阶段关键列表包含全部卡牌图集', () => {
        const result = smashUpCriticalImageResolver(makeState('factionSelect'));
        for (const atlas of ALL_CARD_ATLAS) {
            expect(result.critical).toContain(atlas);
        }
        expect(result.critical).toHaveLength(ALL_CARD_ATLAS.length);
    });

    it('playing 阶段（非教程）关键列表包含全部卡牌+基地图集', () => {
        const result = smashUpCriticalImageResolver(makeState('playCards'));
        expect(result.critical).toHaveLength(ALL_CARD_ATLAS.length + ALL_BASE_ATLAS.length);
        for (const atlas of [...ALL_CARD_ATLAS, ...ALL_BASE_ATLAS]) {
            expect(result.critical).toContain(atlas);
        }
    });

    // ========================================================================
    // 教程模式：只加载已选派系对应的图集
    // ========================================================================

    it('教程模式 playing 阶段：只加载已选派系的图集', () => {
        // 教程预设：恐龙+米斯卡塔尼克 vs 机器人+巫师
        const state = makePlayingState(
            {
                '0': ['dinosaurs', 'miskatonic_university'],
                '1': ['robots', 'wizards'],
            },
            { tutorial: true },
        );
        const result = smashUpCriticalImageResolver(state);

        // 恐龙 → cards1, 米斯卡塔尼克 → cards2, 机器人+巫师 → cards4
        expect(result.critical).toContain('smashup/cards/cards1');
        expect(result.critical).toContain('smashup/cards/cards2');
        expect(result.critical).toContain('smashup/cards/cards4');
        // cards3 不应加载（无幽灵/熊骑兵/蒸汽朋克/食人花）
        expect(result.critical).not.toContain('smashup/cards/cards3');

        // 基地：恐龙/机器人/巫师 → base1, 米斯卡塔尼克 → base4
        expect(result.critical).toContain('smashup/base/base1');
        expect(result.critical).toContain('smashup/base/base4');
        // base2/base3 不应加载
        expect(result.critical).not.toContain('smashup/base/base2');
        expect(result.critical).not.toContain('smashup/base/base3');

        expect(result.warm).toEqual([]);
        expect(result.phaseKey).toBe('playing');
    });

    it('教程模式 factionSelect 阶段：返回空资源快速通过（aiActions 会自动推进）', () => {
        const state = {
            sys: { phase: 'factionSelect', tutorial: { active: true } },
            core: { players: {} },
        };
        const result = smashUpCriticalImageResolver(state);
        // 教程 factionSelect 阶段不需要展示派系选择 UI，返回空资源
        expect(result.critical).toEqual([]);
        expect(result.warm).toEqual([]);
        expect(result.phaseKey).toBe('tutorial-factionSelect');
    });

    it('教程模式 playing 阶段：不同派系组合只加载对应图集', () => {
        // 幽灵+海盗 vs 丧尸+忍者
        const state = makePlayingState(
            {
                '0': ['ghosts', 'pirates'],
                '1': ['zombies', 'ninjas'],
            },
            { tutorial: true },
        );
        const result = smashUpCriticalImageResolver(state);

        // 海盗+忍者 → cards1, 幽灵 → cards3, 丧尸 → cards4
        expect(result.critical).toContain('smashup/cards/cards1');
        expect(result.critical).toContain('smashup/cards/cards3');
        expect(result.critical).toContain('smashup/cards/cards4');
        expect(result.critical).not.toContain('smashup/cards/cards2');

        // 基地：海盗/忍者/丧尸 → base1, 幽灵 → base2
        expect(result.critical).toContain('smashup/base/base1');
        expect(result.critical).toContain('smashup/base/base2');
        expect(result.critical).not.toContain('smashup/base/base3');
        expect(result.critical).not.toContain('smashup/base/base4');
    });

    it('教程模式 playing 阶段：Monster Smash 派系会加载 cards5', () => {
        const state = makePlayingState(
            {
                '0': ['frankenstein', 'werewolves'],
                '1': ['vampires', 'giant_ants'],
            },
            { tutorial: true },
        );
        const result = smashUpCriticalImageResolver(state);

        expect(result.critical).toContain('smashup/cards/cards5');
        expect(result.critical).not.toContain('smashup/cards/cards1');
        expect(result.critical).not.toContain('smashup/cards/cards2');
        expect(result.critical).not.toContain('smashup/cards/cards3');
        expect(result.critical).not.toContain('smashup/cards/cards4');
    });

    it('非教程 playing 阶段（有派系数据）：仍然全量加载', () => {
        // 正常联机模式，即使有派系数据也全量加载（对手可能打出任何牌）
        const state = makePlayingState(
            {
                '0': ['dinosaurs', 'miskatonic_university'],
                '1': ['robots', 'wizards'],
            },
            { tutorial: false },
        );
        const result = smashUpCriticalImageResolver(state);
        expect(result.critical).toEqual([...ALL_CARD_ATLAS, ...ALL_BASE_ATLAS]);
    });
});
