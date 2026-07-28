import { describe, expect, it } from 'vitest';
import { getSmashUpAtlasImagesByKind } from '../domain/atlasCatalog';
import { smashUpCriticalImageResolver } from '../criticalImageResolver';

const ALL_BASE_ATLAS = getSmashUpAtlasImagesByKind('base');
const ALL_CARD_ATLAS = getSmashUpAtlasImagesByKind('card');

function makeFactionSelectState(factions?: Record<string, [string, string]>) {
    return {
        sys: { phase: 'factionSelect' },
        core: factions
            ? {
                players: Object.fromEntries(
                    Object.entries(factions).map(([pid, picked]) => [pid, { factions: picked }]),
                ),
            }
            : {},
    };
}

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
                Object.entries(factions).map(([pid, picked]) => [pid, { factions: picked }]),
            ),
        },
    };
}

describe('smashUpCriticalImageResolver', () => {
    it('无 state 时不主动预热全量图集', () => {
        const result = smashUpCriticalImageResolver(undefined, undefined, '0');

        expect(result.critical).toEqual([]);
        expect(result.warm).toEqual([]);
        expect(result.phaseKey).toBe('init:0');
    });

    it('factionSelect 阶段保留全部卡图为 critical，但让已选派系底图先 warm', () => {
        const result = smashUpCriticalImageResolver(
            makeFactionSelectState({
                '0': ['dinosaurs', 'miskatonic_university'],
                '1': ['robots', 'wizards'],
            }),
            undefined,
            '0',
        );

        expect(result.critical).toEqual(ALL_CARD_ATLAS);
        expect(result.phaseKey).toBe('factionSelect');

        const base1Index = result.warm.indexOf('smashup/base/base1');
        const base4Index = result.warm.indexOf('smashup/base/base4');
        const base2Index = result.warm.indexOf('smashup/base/base2');
        const base3Index = result.warm.indexOf('smashup/base/base3');

        expect(base1Index).toBeGreaterThanOrEqual(0);
        expect(base4Index).toBeGreaterThan(base1Index);
        expect(base2Index).toBeGreaterThan(base4Index);
        expect(base3Index).toBeGreaterThan(base4Index);
    });

    it('教程 factionSelect 阶段返回空资源，直接等待后续 playing 阶段', () => {
        const result = smashUpCriticalImageResolver({
            sys: { phase: 'factionSelect', tutorial: { active: true } },
            core: { players: {} },
        }, undefined, '0');

        expect(result.critical).toEqual([]);
        expect(result.warm).toEqual([]);
        expect(result.phaseKey).toBe('tutorial-factionSelect:0');
    });

    it('playing 阶段按共享底图 -> 自己派系卡图 -> 对手派系卡图排序 critical', () => {
        const result = smashUpCriticalImageResolver(
            makePlayingState({
                '0': ['dinosaurs', 'miskatonic_university'],
                '1': ['robots', 'wizards'],
            }),
            undefined,
            '0',
        );

        expect(result.phaseKey).toBe('playing:0:0:dinosaurs,miskatonic_university|1:robots,wizards');
        expect(result.critical).toContain('smashup/base/base1');
        expect(result.critical).toContain('smashup/base/base4');
        expect(result.critical).toContain('smashup/cards/cards1');
        expect(result.critical).toContain('smashup/cards/cards2');
        expect(result.critical).toContain('smashup/cards/cards4');

        const myCards2Index = result.critical.indexOf('smashup/cards/cards2');
        const opponentCardsIndex = result.critical.indexOf('smashup/cards/cards4');
        expect(myCards2Index).toBeGreaterThanOrEqual(0);
        expect(opponentCardsIndex).toBeGreaterThan(myCards2Index);
        expect(result.warm).toEqual([]);
    });

    it('新接入的 Oops 四派系会命中新卡图与新基地图集', () => {
        const result = smashUpCriticalImageResolver(
            makePlayingState({
                '0': ['ancient_egyptians', 'cowboys'],
                '1': ['samurai', 'vikings'],
            }),
            undefined,
            '0',
        );

        expect(result.critical).toContain('smashup/cards/aiji');
        expect(result.critical).toContain('smashup/base/aiji_base');
    });

    it('国际事件四派系会命中新卡图与新基地图集', () => {
        const result = smashUpCriticalImageResolver(
            makePlayingState({
                '0': ['sumo_wrestlers', 'musketeers'],
                '1': ['mounties', 'luchadors'],
            }),
            undefined,
            '0',
        );

        expect(result.critical).toContain('smashup/cards/international_incident');
        expect(result.critical).toContain('smashup/base/international_incident_bases');
    });

    it('漫威四派系会共享预热 marvel_wave_one 卡图', () => {
        const result = smashUpCriticalImageResolver(
            makePlayingState({
                '0': ['avengers', 'shield'],
                '1': ['spider_verse', 'ultimates'],
            }),
            undefined,
            '0',
        );

        expect(result.critical).toContain('smashup/cards/marvel_wave_one');
        expect(result.critical.filter(path => path === 'smashup/cards/marvel_wave_one')).toHaveLength(1);
    });

    it('我们到底在想什么四派系会命中新卡图与新基地图集', () => {
        const result = smashUpCriticalImageResolver(
            makePlayingState({
                '0': ['rock_stars', 'teddy_bears'],
                '1': ['grannies', 'explorers'],
            }),
            undefined,
            '0',
        );

        expect(result.critical).toContain('smashup/cards/what_were_we_thinking');
        expect(result.critical).toContain('smashup/base/what_were_we_thinking_bases');
    });

    it('半场战争扩四派系会命中各自卡图与共享基地 atlas', () => {
        const result = smashUpCriticalImageResolver(
            makePlayingState({
                '0': ['adolescent_epic_geckos', 'gi_gerald'],
                '1': ['rulers_of_the_cosmos', 'pearl_and_the_images'],
            }),
            undefined,
            '0',
        );

        expect(result.critical).toContain('smashup/cards/half_the_battle_geckos');
        expect(result.critical).toContain('smashup/cards/half_the_battle_gerald');
        expect(result.critical).toContain('smashup/cards/half_the_battle_cosmos');
        expect(result.critical).toContain('smashup/cards/half_the_battle_pearl_images');
        expect(result.critical).toContain('smashup/base/half_the_battle_bases');
        expect(result.critical.filter(path => path === 'smashup/base/half_the_battle_bases')).toHaveLength(1);
    });

    it('Promo 绵羊与全明星共享预热同一张新卡图并命中 BASE4 基地图集', () => {
        const result = smashUpCriticalImageResolver(
            makePlayingState({
                '0': ['sheep', 'all_stars'],
                '1': ['robots', 'wizards'],
            }),
            undefined,
            '0',
        );

        expect(result.critical).toContain('smashup/cards/promos_sheep_all_stars');
        expect(result.critical.filter(path => path === 'smashup/cards/promos_sheep_all_stars')).toHaveLength(1);
        expect(result.critical).toContain('smashup/base/base4');
    });

    it('本轮 POD 卡图派系会预热各自 4x5 卡图', () => {
        const result = smashUpCriticalImageResolver(
            makePlayingState({
                '0': ['astroknights', 'kung_fu_fighters'],
                '1': ['anansi_tales', 'russian_fairy_tales'],
            }),
            undefined,
            '0',
        );

        expect(result.critical).toContain('smashup/cards/astroknights_pod');
        expect(result.critical).toContain('smashup/cards/kung_fu_fighters_pod');
        expect(result.critical).toContain('smashup/cards/anansi_tales_pod');
        expect(result.critical).toContain('smashup/cards/russian_fairy_tales_pod');
        expect(result.critical.filter(path => path === 'smashup/cards/astroknights_pod')).toHaveLength(1);
        expect(result.critical.filter(path => path === 'smashup/cards/kung_fu_fighters_pod')).toHaveLength(1);
        expect(result.critical.filter(path => path === 'smashup/cards/anansi_tales_pod')).toHaveLength(1);
        expect(result.critical.filter(path => path === 'smashup/cards/russian_fairy_tales_pod')).toHaveLength(1);
    });

    it('文化冲击剩余派系会继续预热文化冲击卡图与基地 atlas', () => {
        const result = smashUpCriticalImageResolver(
            makePlayingState({
                '0': ['anansi_tales', 'grimms_fairy_tales'],
                '1': ['russian_fairy_tales', 'ancient_incas'],
            }),
            undefined,
            '0',
        );

        expect(result.critical).toContain('smashup/cards/culture_shock/atlas');
        expect(result.critical).toContain('smashup/base/polynesian_voyagers/atlas');
        expect(result.critical.filter(path => path === 'smashup/cards/culture_shock/atlas')).toHaveLength(1);
        expect(result.critical.filter(path => path === 'smashup/base/polynesian_voyagers/atlas')).toHaveLength(1);
    });

    it('Disney 四派系会共享预热 Disney 卡图与基地 atlas', () => {
        const result = smashUpCriticalImageResolver(
            makePlayingState({
                '0': ['aladdin', 'beauty_and_the_beast'],
                '1': ['nightmare_before_christmas', 'wreck_it_ralph'],
            }),
            undefined,
            '0',
        );

        expect(result.critical).toContain('smashup/cards/disney');
        expect(result.critical).toContain('smashup/base/disney_bases');
        expect(result.critical.filter(path => path === 'smashup/cards/disney')).toHaveLength(1);
        expect(result.critical.filter(path => path === 'smashup/base/disney_bases')).toHaveLength(1);
    });

    it('Disney Four Factions 四派系会共享预热独立 Disney 卡图与基地 atlas', () => {
        const result = smashUpCriticalImageResolver(
            makePlayingState({
                '0': ['big_hero_6', 'frozen'],
                '1': ['lion_king', 'mulan'],
            }),
            undefined,
            '0',
        );

        expect(result.critical).toContain('smashup/cards/disney_four_factions');
        expect(result.critical).toContain('smashup/base/disney_four_faction_bases');
        expect(result.critical.filter(path => path === 'smashup/cards/disney_four_factions')).toHaveLength(1);
        expect(result.critical.filter(path => path === 'smashup/base/disney_four_faction_bases')).toHaveLength(1);
    });

    it('fairies 会命中 Pretty Pretty card atlas 与共享 Pretty Pretty base atlas', () => {
        const result = smashUpCriticalImageResolver(
            makePlayingState({
                '0': ['fairies', 'kitty_cats'],
                '1': ['princesses', 'mythic_horses'],
            }),
            undefined,
            '0',
        );

        expect(result.critical).toContain('smashup/cards/pretty_pretty');
        expect(result.critical).toContain('smashup/base/base3');
        expect(result.critical).toContain('smashup/taitan/taitan1');
    });

    it('教程 playing 阶段仍只加载已选派系对应图集', () => {
        const result = smashUpCriticalImageResolver(
            makePlayingState(
                {
                    '0': ['ghosts', 'pirates'],
                    '1': ['zombies', 'ninjas'],
                },
                { tutorial: true },
            ),
            undefined,
            '0',
        );

        expect(result.critical).toContain('smashup/cards/cards1');
        expect(result.critical).toContain('smashup/cards/cards3');
        expect(result.critical).toContain('smashup/cards/cards4');
        expect(result.critical).not.toContain('smashup/cards/cards2');
    });

    it('POD faction 会预热对应的本地 POD 基地图集路径', () => {
        const result = smashUpCriticalImageResolver(
            makePlayingState({
                '0': ['killer_plants_pod', 'giant_ants_pod'],
                '1': ['elder_things_pod', 'miskatonic_university_pod'],
            }),
            undefined,
            '0',
        );

        expect(result.critical).toContain('smashup/cards/tts_atlas_9aed5872d2');
        expect(result.critical).toContain('smashup/cards/tts_atlas_0b888d02fd');
    });

    it('普通版远古物种也会预热修正后的南极基地图集', () => {
        const result = smashUpCriticalImageResolver(
            makePlayingState({
                '0': ['elder_things', 'pirates'],
                '1': ['dinosaurs', 'wizards'],
            }),
            undefined,
            '0',
        );

        expect(result.critical).toContain('smashup/cards/tts_atlas_0b888d02fd');
    });

    it('playing 阶段缺少派系数据时回退到全量图集', () => {
        const result = smashUpCriticalImageResolver(
            { sys: { phase: 'playCards' }, core: {} },
            undefined,
            '0',
        );

        expect(result.critical).toEqual([...ALL_CARD_ATLAS, ...ALL_BASE_ATLAS]);
        expect(result.warm).toEqual([]);
        expect(result.phaseKey).toBe('playing:0:fallback-all');
    });
});
