/* @vitest-environment happy-dom */

import { describe, expect, it } from 'vitest';
import { getAllGames, getGameById } from '../../config/games.config';
import { GAME_CLIENT_MANIFEST_BY_ID } from '../manifest.client';
import { GAME_MANIFEST_BY_ID } from '../manifest';
import { GAME_SERVER_MANIFEST_BY_ID } from '../manifest.server';
import { hasGameImplementation, loadGameImplementation } from '../registry';

describe('fantasyrealms manifest integration', () => {
    it('fantasyrealms 已进入生成清单，并保持 enabled 运行时入口', () => {
        expect(GAME_MANIFEST_BY_ID.fantasyrealms).toBeDefined();
        expect(GAME_MANIFEST_BY_ID.fantasyrealms?.enabled).toBe(true);
        expect(GAME_MANIFEST_BY_ID.fantasyrealms?.listed).toBe(false);

        expect(GAME_CLIENT_MANIFEST_BY_ID.fantasyrealms).toBeDefined();
        expect(GAME_CLIENT_MANIFEST_BY_ID.fantasyrealms?.manifest.enabled).toBe(true);
        expect(GAME_CLIENT_MANIFEST_BY_ID.fantasyrealms?.manifest.listed).toBe(false);
        expect(typeof GAME_CLIENT_MANIFEST_BY_ID.fantasyrealms?.loadRuntime).toBe('function');

        expect(GAME_SERVER_MANIFEST_BY_ID.fantasyrealms).toBeDefined();
        expect(GAME_SERVER_MANIFEST_BY_ID.fantasyrealms?.manifest.enabled).toBe(true);
        expect(GAME_SERVER_MANIFEST_BY_ID.fantasyrealms?.manifest.listed).toBe(false);
        expect(GAME_SERVER_MANIFEST_BY_ID.fantasyrealms?.engineConfig.gameId).toBe('fantasyrealms');
    });

    it('fantasyrealms 不进入公开游戏列表，但仍保留 registry 与运行时加载能力', async () => {
        const game = getGameById('fantasyrealms');
        expect(game).toBeDefined();
        expect(game?.enabled).toBe(true);
        expect(game?.listed).toBe(false);
        expect(game?.allowLocalMode).toBe(true);
        expect(game?.playerOptions).toEqual([2, 3, 4, 5, 6]);
        expect(getAllGames().some((entry) => entry.id === 'fantasyrealms')).toBe(false);

        expect(hasGameImplementation('fantasyrealms')).toBe(true);

        const implementation = await loadGameImplementation('fantasyrealms');
        expect(implementation).not.toBeNull();
        expect(implementation?.engineConfig.gameId).toBe('fantasyrealms');
        expect(typeof implementation?.board).toBe('function');
    });
});
