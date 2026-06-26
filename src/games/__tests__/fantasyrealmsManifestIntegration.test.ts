/* @vitest-environment happy-dom */

import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getGameById } from '../../config/games.config';
import { GAME_CLIENT_MANIFEST_BY_ID } from '../manifest.client';
import { GAME_MANIFEST_BY_ID } from '../manifest';
import { GAME_SERVER_MANIFEST_BY_ID } from '../manifest.server';
import { hasGameImplementation, loadGameImplementation } from '../registry';

describe('fantasyrealms manifest integration', () => {
    it('fantasyrealms 已进入生成清单，并作为 enabled 游戏暴露本地入口', () => {
        expect(GAME_MANIFEST_BY_ID.fantasyrealms).toBeDefined();
        expect(GAME_MANIFEST_BY_ID.fantasyrealms?.enabled).toBe(true);
        expect(GAME_MANIFEST_BY_ID.fantasyrealms?.thumbnailPath).toBe('fantasyrealms/thumbnails/cover');
        expect(existsSync('public/assets/i18n/zh-CN/fantasyrealms/thumbnails/compressed/cover.webp')).toBe(true);
        expect(existsSync('public/assets/i18n/en/fantasyrealms/thumbnails/compressed/cover.webp')).toBe(true);

        expect(GAME_CLIENT_MANIFEST_BY_ID.fantasyrealms).toBeDefined();
        expect(GAME_CLIENT_MANIFEST_BY_ID.fantasyrealms?.manifest.enabled).toBe(true);
        expect(typeof GAME_CLIENT_MANIFEST_BY_ID.fantasyrealms?.loadRuntime).toBe('function');
        expect(typeof GAME_CLIENT_MANIFEST_BY_ID.fantasyrealms?.loadCriticalImageResolver).toBe('function');

        expect(GAME_SERVER_MANIFEST_BY_ID.fantasyrealms).toBeDefined();
        expect(GAME_SERVER_MANIFEST_BY_ID.fantasyrealms?.manifest.enabled).toBe(true);
        expect(GAME_SERVER_MANIFEST_BY_ID.fantasyrealms?.engineConfig.gameId).toBe('fantasyrealms');
    });

    it('fantasyrealms 启用后会进入大厅 registry、客户端 loaderMap，并可加载运行时', async () => {
        const game = getGameById('fantasyrealms');
        expect(game).toBeDefined();
        expect(game?.enabled).toBe(true);
        expect(game?.allowLocalMode).toBe(true);
        expect(game?.playerOptions).toEqual([2, 3, 4, 5, 6]);

        expect(hasGameImplementation('fantasyrealms')).toBe(true);

        const implementation = await loadGameImplementation('fantasyrealms');
        expect(implementation).not.toBeNull();
        expect(implementation?.engineConfig.gameId).toBe('fantasyrealms');
        expect(typeof implementation?.board).toBe('function');
    });

    it('fantasyrealms 首屏关键素材已配置关键图解析器', async () => {
        const resolver = await GAME_CLIENT_MANIFEST_BY_ID.fantasyrealms?.loadCriticalImageResolver?.();

        expect(resolver).toBeDefined();
        const result = resolver?.();
        expect(result?.critical).toEqual(expect.arrayContaining([
            'fantasyrealms/cards/atlases/fantasyrealms-base-cards-atlas.png',
            'fantasyrealms/cards/backs/fantasyrealms-base-card-back.png',
        ]));
        expect(result?.critical).not.toContain('fantasyrealms/cards/atlases/compressed/fantasyrealms-base-cards-atlas.webp');
        expect(result?.phaseKey).toBe('fantasyrealms:first-paint');
    });
});
