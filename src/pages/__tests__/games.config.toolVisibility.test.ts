import { describe, expect, it } from 'vitest';
import { getGamesByCategory } from '../../config/games.config';
import { sortGamesForLobbyDirectory } from '../../components/home-v2/lobbyDirectorySorting';

describe('games.config 工具入口可见性', () => {
    it('全部分类隐藏工具，工具分类保留项目工具', () => {
        const allIds = getGamesByCategory('All').map((game) => game.id);
        const toolIds = getGamesByCategory('tools').map((game) => game.id);

        expect(allIds).not.toContain('assetslicer');
        expect(allIds).not.toContain('fxpreview');
        expect(allIds).not.toContain('audiobrowser');
        expect(allIds).not.toContain('archview');
        expect(allIds).not.toContain('qidahenregionmask');

        expect(toolIds).toEqual(expect.arrayContaining([
            'assetslicer',
            'fxpreview',
            'audiobrowser',
            'archview',
            'qidahenregionmask',
        ]));
    });

    it('工具分类不应混入带 tools 标签的普通游戏或 UGC', () => {
        const toolIds = sortGamesForLobbyDirectory([
            {
                id: 'archview',
                type: 'tool',
                category: 'tools',
                tags: [],
            },
            {
                id: 'ugc-tools-tagged',
                type: 'game',
                category: 'casual',
                tags: ['ugc', 'tools'],
            },
            {
                id: 'normal-tools-tagged',
                type: 'game',
                category: 'card',
                tags: ['tools'],
            },
        ] as any, 'tools').map((game) => game.id);

        expect(toolIds).toEqual(['archview']);
    });

    it('经典首页无热度数据时应复用 HomeV2 的固定精选顺序', () => {
        const orderedIds = sortGamesForLobbyDirectory(
            getGamesByCategory('All'),
            'all',
        ).map((game) => game.id);

        expect(orderedIds.slice(0, 3)).toEqual(['dicethrone', 'cardia', 'smashup']);
    });
});
