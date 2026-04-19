import { test, expect } from '../framework';

const ATLAS_IDS = [
    'smashup:cards1',
    'smashup:cards2',
    'smashup:cards3',
    'smashup:cards4',
] as const;

test('大杀四方卡牌图集应完成注册', async ({ page, game }) => {
    test.setTimeout(60000);

    await game.openTestGame('smashup', { skipInitialization: true }, 20000);

    await expect.poll(async () => {
        return await page.evaluate(async (atlasIds) => {
            const { getCardAtlasSource, getLazyRegistration } = await import('/src/components/common/media/cardAtlasRegistry.ts');

            return atlasIds.every((atlasId) => {
                return Boolean(getCardAtlasSource(atlasId, 'zh-CN') || getLazyRegistration(atlasId));
            });
        }, [...ATLAS_IDS]);
    }, { timeout: 10000 }).toBe(true);

    const registrationStatus = await page.evaluate(async (atlasIds) => {
        const { getCardAtlasSource, getLazyRegistration } = await import('/src/components/common/media/cardAtlasRegistry.ts');
        const { SMASHUP_ATLAS_DEFINITIONS } = await import('/src/games/smashup/domain/atlasCatalog.ts');

        return atlasIds.map((atlasId) => {
            const expected = SMASHUP_ATLAS_DEFINITIONS.find((entry) => entry.id === atlasId);
            const resolved = getCardAtlasSource(atlasId, 'zh-CN');
            const lazy = getLazyRegistration(atlasId);

            return {
                atlasId,
                mode: resolved ? 'resolved' : lazy ? 'lazy' : 'missing',
                registeredImage: resolved?.image ?? lazy?.image ?? null,
                expectedImage: expected?.image ?? null,
                lazyGrid: lazy?.grid ?? null,
                expectedGrid: expected?.grid ?? null,
            };
        });
    }, [...ATLAS_IDS]);

    expect(registrationStatus).toHaveLength(ATLAS_IDS.length);

    for (const status of registrationStatus) {
        expect(status.expectedImage, `${status.atlasId} 缺少 atlasCatalog 定义`).toBeTruthy();
        expect(status.mode, `${status.atlasId} 未注册`).not.toBe('missing');
        expect(status.registeredImage, `${status.atlasId} 注册图片路径不匹配`).toBe(status.expectedImage);

        if (status.mode === 'lazy') {
            expect(status.expectedGrid, `${status.atlasId} 缺少 atlasCatalog grid`).toBeTruthy();
            expect(status.lazyGrid, `${status.atlasId} lazy grid 不匹配`).toEqual(status.expectedGrid);
        }
    }
});
