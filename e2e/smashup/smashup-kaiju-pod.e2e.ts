import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import { setChineseLocale } from '../helpers/common';

const KAIJU_POD_ATLAS_ID = 'smashup:kaiju-pod-cards';

async function waitForDraftTurn(page: Page, playerId: string, selectedCount: number): Promise<void> {
    await page.waitForFunction(
        ({ playerId, selectedCount }) => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const selection = state?.core?.factionSelection;
            if (!selection) return false;
            const currentPlayerId = state.core.turnOrder?.[state.core.currentPlayerIndex];
            const picks = selection.playerSelections?.[playerId] ?? [];
            return currentPlayerId === playerId && picks.length === selectedCount;
        },
        { playerId, selectedCount },
        { timeout: 20000, polling: 200 },
    );
}

async function assertAtlasLoaded(page: Page): Promise<void> {
    await expect.poll(async () => page.evaluate((atlasId) => {
        const cards = Array.from(document.querySelectorAll<HTMLElement>(`[data-card-atlas-id="${atlasId}"]`));
        return {
            count: cards.length,
            shimmerCount: cards.filter(card => card.classList.contains('atlas-shimmer')).length,
            loadedCount: cards.filter(card => Boolean(card.querySelector('img[data-card-atlas-img="true"]'))).length,
        };
    }, KAIJU_POD_ATLAS_ID), { timeout: 30000 }).toEqual({
        count: 14,
        shimmerCount: 0,
        loadedCount: 14,
    });
}

async function pickFaction(
    page: Page,
    options: {
        playerId: string;
        selectedCount: number;
        groupId: string;
        expectedFactionId: string;
        pod?: boolean;
        beforeConfirm?: () => Promise<void>;
    },
): Promise<void> {
    await waitForDraftTurn(page, options.playerId, options.selectedCount);
    await page.getByTestId(`faction-option-${options.groupId}`).click();
    await expect(page.getByTestId('faction-detail-panel')).toBeVisible({ timeout: 10000 });

    if (options.pod) {
        const podButton = page.getByTestId('faction-variant-pod');
        await expect(podButton).toBeVisible({ timeout: 10000 });
        await podButton.click();
        await assertAtlasLoaded(page);
    }

    await options.beforeConfirm?.();

    const confirm = page.getByTestId('faction-confirm-button');
    await expect(confirm).toBeEnabled({ timeout: 10000 });
    await confirm.click();

    await page.waitForFunction(
        ({ playerId, expectedFactionId }) => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const selected = state?.core?.factionSelection?.playerSelections?.[playerId] ?? [];
            const finalFactions = state?.core?.players?.[playerId]?.factions ?? [];
            return selected.includes(expectedFactionId) || finalFactions.includes(expectedFactionId);
        },
        { playerId: options.playerId, expectedFactionId: options.expectedFactionId },
        { timeout: 20000, polling: 200 },
    );
}

test.describe('大杀四方 Kaiju POD 真实入口', () => {
    test('从派系选秀选择 Kaiju POD 并使用新图集开始对局', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);
        await setChineseLocale(page.context());
        await game.openTestGame('smashup', {
            seed: 20260810,
            seat1ManualSetup: true,
        }, 30000);

        await expect(page.locator('[data-tutorial-id="su-faction-select"]')).toBeVisible({ timeout: 20000 });
        await pickFaction(page, {
            playerId: '0',
            selectedCount: 0,
            groupId: 'kaiju',
            expectedFactionId: 'kaiju_pod',
            pod: true,
            beforeConfirm: () => game.screenshot('01-Kaiju-POD-派系预览', testInfo),
        });
        await pickFaction(page, {
            playerId: '1',
            selectedCount: 0,
            groupId: 'aliens',
            expectedFactionId: 'aliens',
        });
        await pickFaction(page, {
            playerId: '1',
            selectedCount: 1,
            groupId: 'pirates',
            expectedFactionId: 'pirates',
        });
        await pickFaction(page, {
            playerId: '0',
            selectedCount: 1,
            groupId: 'robots',
            expectedFactionId: 'robots',
        });

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => {
            const state = await game.getState();
            return [...(state?.core?.players?.['0']?.factions ?? [])].sort();
        }, { timeout: 20000 }).toEqual(['kaiju_pod', 'robots']);
        await expect(page.locator('.atlas-shimmer')).toHaveCount(0, { timeout: 90000 });
        await expect(page.locator(`[data-card-atlas-id="${KAIJU_POD_ATLAS_ID}"]`).first()).toBeVisible({ timeout: 30000 });
        await game.screenshot('02-Kaiju-POD-开局完成', testInfo);
    });
});
