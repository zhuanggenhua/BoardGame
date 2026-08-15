import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import { setChineseLocale } from '../helpers/common';

const ACTION_HEROES_POD_ATLAS_ID = 'smashup:action-heroes-pod-cards';

type SmashUpSelectionState = {
    core?: {
        factionSelection?: {
            playerSelections?: Record<string, string[]>;
        };
        players?: Record<string, { factions?: string[] }>;
    };
};

async function waitForFactionSelection(page: Page): Promise<void> {
    await expect(page.locator('[data-tutorial-id="su-faction-select"]')).toBeVisible({ timeout: 20000 });
}

async function assertAtlasLoaded(page: Page, atlasId: string, expectedCardCount: number): Promise<void> {
    await expect.poll(async () => page.evaluate((expectedAtlasId) => {
        const nodes = Array.from(document.querySelectorAll<HTMLElement>(
            `[data-card-atlas-id="${expectedAtlasId}"]`,
        ));
        return {
            count: nodes.length,
            shimmerCount: nodes.filter(node => node.classList.contains('atlas-shimmer')).length,
            loadedCount: nodes.filter((node) => {
                const image = node.querySelector<HTMLImageElement>('img[data-card-atlas-img="true"]');
                return Boolean(image?.complete && image.naturalWidth > 0);
            }).length,
        };
    }, atlasId), { timeout: 30000 }).toEqual({
        count: expectedCardCount,
        shimmerCount: 0,
        loadedCount: expectedCardCount,
    });
}

test.describe('大杀四方动作英雄 POD 图集真实入口', () => {
    test('派系选择详情应加载 Action Heroes POD 卡牌图集', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);

        await setChineseLocale(page.context());
        await game.openTestGame('smashup', {
            seed: 20260811,
            seat1ManualSetup: true,
        }, 30000);
        await waitForFactionSelection(page);

        await page.getByTestId('faction-option-action_heroes').click();
        await expect(page.getByTestId('faction-detail-panel')).toBeVisible({ timeout: 10000 });

        const podButton = page.getByTestId('faction-variant-pod');
        await expect(podButton).toBeVisible({ timeout: 10000 });
        await podButton.click();

        await assertAtlasLoaded(page, ACTION_HEROES_POD_ATLAS_ID, 17);
        await game.screenshot('action-heroes-pod-faction-preview-atlas', testInfo);

        const confirmButton = page.getByTestId('faction-confirm-button');
        await expect(confirmButton).toBeVisible({ timeout: 10000 });
        await expect(confirmButton).toBeEnabled({ timeout: 10000 });
        await confirmButton.click();

        await page.waitForFunction(() => {
            const harnessWindow = window as typeof window & {
                __BG_TEST_HARNESS__?: {
                    state?: { get?: () => SmashUpSelectionState };
                };
            };
            const state = harnessWindow.__BG_TEST_HARNESS__?.state?.get?.();
            return state?.core?.factionSelection?.playerSelections?.['0']?.includes('action_heroes_pod')
                || state?.core?.players?.['0']?.factions?.includes('action_heroes_pod');
        }, undefined, { timeout: 20000, polling: 200 });
    });
});
