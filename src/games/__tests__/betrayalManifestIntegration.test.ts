/* @vitest-environment happy-dom */

import { describe, expect, it } from 'vitest';
import { getGameById } from '../../config/games.config';
import { GAME_MANIFEST_BY_ID } from '../manifest';
import { hasGameImplementation, loadGameImplementation } from '../registry';

describe('betrayal manifest integration', () => {
    it('betrayal 会以本地预演入口暴露，并声明手机纵向适配', async () => {
        const game = getGameById('betrayal');
        expect(game).toBeDefined();
        expect(game?.enabled).toBe(true);
        expect(game?.allowLocalMode).toBe(true);
        expect(game?.playerOptions).toEqual([3, 4, 5, 6]);
        expect(game?.mobileProfile).toBe('portrait-adapted');

        expect(GAME_MANIFEST_BY_ID.betrayal).toBeDefined();
        expect(GAME_MANIFEST_BY_ID.betrayal?.allowLocalMode).toBe(true);

        expect(hasGameImplementation('betrayal')).toBe(true);
        const implementation = await loadGameImplementation('betrayal');
        expect(implementation?.engineConfig.gameId).toBe('betrayal');
        expect(typeof implementation?.board).toBe('function');
    });
});
