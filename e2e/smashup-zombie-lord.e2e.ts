import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from './framework';
import { getEvidenceScreenshotPath } from './framework/evidenceScreenshots';

const SMASHUP_TEST_QUERY = {
    p0: 'zombies,ghosts',
    p1: 'aliens,ninjas',
    skipFactionSelect: true,
    skipInitialization: false,
};

const NINJA_DIRECT_CLICK_QUERY = {
    p0: 'ninjas,pirates',
    p1: 'robots,zombies',
    skipFactionSelect: true,
    skipInitialization: false,
};

async function saveEvidenceScreenshot(page: Page, testInfo: TestInfo, subdir: string, filename: string): Promise<void> {
    const path = getEvidenceScreenshotPath(testInfo, filename, { subdir, filename });
    mkdirSync(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: true });
}

test.describe('SmashUp 僵尸领主直点交互', () => {
    test('僵尸领主：弃牌堆选随从后直接点击基地部署', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', SMASHUP_TEST_QUERY, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'hand-zombie-lord', defId: 'zombie_lord', type: 'minion' },
                ],
                discard: [
                    { uid: 'discard-zombie-tenacious-z', defId: 'zombie_tenacious_z', type: 'minion' },
                    { uid: 'discard-zombie-grave-digger', defId: 'zombie_grave_digger', type: 'minion' },
                ],
                factions: ['zombies', 'ghosts'],
                minionsPlayed: 0,
                minionLimit: 1,
            },
            player1: {
                factions: ['aliens', 'ninjas'],
            },
            bases: [
                { defId: 'base_the_mothership' },
                { defId: 'base_jungle_oasis' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.sys?.phase === 'playCards'
                    && state?.core?.players?.['0']?.hand?.some((card: any) => card.uid === 'hand-zombie-lord')
                    && state?.core?.players?.['0']?.discard?.some((card: any) => card.uid === 'discard-zombie-tenacious-z');
            },
            { timeout: 5000 }
        );

        await game.playCard('zombie_lord', { targetBaseIndex: 0 });
        await game.waitForInteraction('zombie_lord_pick', 10000);

        const discardPanel = page.locator('[data-discard-view-panel]');
        await expect(discardPanel).toBeVisible();
        await expect(page.locator('[data-discard-view-panel] [data-card-uid="discard-zombie-tenacious-z"]')).toBeVisible();
        await game.screenshot('zombie-lord-discard-panel', testInfo);
        await saveEvidenceScreenshot(page, testInfo, 'smashup-zombie-lord', '01-discard-panel.png');

        await page.click('[data-discard-view-panel] [data-card-uid="discard-zombie-tenacious-z"]');
        await expect(discardPanel).toBeVisible();
        await game.screenshot('zombie-lord-card-selected', testInfo);
        await saveEvidenceScreenshot(page, testInfo, 'smashup-zombie-lord', '02-card-selected.png');

        await game.selectBase(1);

        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return !state?.sys?.interaction?.current;
            },
            { timeout: 5000 }
        );

        const finalState = await game.getState();
        expect(finalState.core.bases[0].minions.some((minion: any) =>
            minion.defId === 'zombie_lord' && minion.owner === '0'
        )).toBe(true);
        expect(finalState.core.bases[1].minions.some((minion: any) =>
            minion.uid === 'discard-zombie-tenacious-z'
                && minion.defId === 'zombie_tenacious_z'
                && minion.owner === '0'
        )).toBe(true);
        expect(finalState.core.players['0'].discard.some((card: any) => card.uid === 'discard-zombie-tenacious-z')).toBe(false);

        await game.screenshot('zombie-lord-after-deploy', testInfo);
        await saveEvidenceScreenshot(page, testInfo, 'smashup-zombie-lord', '03-after-deploy.png');
    });

    test('僵尸领主：弃牌堆没有力量 2 以下随从时不打开直点面板', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', SMASHUP_TEST_QUERY, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'hand-zombie-lord', defId: 'zombie_lord', type: 'minion' },
                ],
                discard: [
                    { uid: 'discard-zombie-grave-digger', defId: 'zombie_grave_digger', type: 'minion' },
                ],
                factions: ['zombies', 'ghosts'],
                minionsPlayed: 0,
                minionLimit: 1,
            },
            player1: {
                factions: ['aliens', 'ninjas'],
            },
            bases: [
                { defId: 'base_the_mothership' },
                { defId: 'base_jungle_oasis' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.sys?.phase === 'playCards'
                    && state?.core?.players?.['0']?.discard?.length === 1
                    && state?.core?.players?.['0']?.discard?.[0]?.uid === 'discard-zombie-grave-digger';
            },
            { timeout: 5000 }
        );

        await game.playCard('zombie_lord', { targetBaseIndex: 0 });
        await page.waitForTimeout(1000);

        const finalState = await game.getState();
        expect(finalState.sys.interaction?.current?.data?.sourceId).not.toBe('zombie_lord_pick');
        await expect(page.locator('[data-discard-view-panel]')).not.toBeVisible();
        expect(finalState.core.bases[0].minions.some((minion: any) =>
            minion.defId === 'zombie_lord' && minion.owner === '0'
        )).toBe(true);
        expect(finalState.core.bases[1].minions.length).toBe(0);
        expect(finalState.core.players['0'].discard.some((card: any) => card.uid === 'discard-zombie-grave-digger')).toBe(true);

        await game.screenshot('zombie-lord-no-eligible-discard', testInfo);
        await saveEvidenceScreenshot(page, testInfo, 'smashup-zombie-lord', '04-no-eligible-discard.png');
    });

    test('ninja_acolyte_play 应该直接点击手牌而不是弹 PromptOverlay', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', NINJA_DIRECT_CLICK_QUERY, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'hand-shinobi', defId: 'ninja_shinobi', type: 'minion' },
                    { uid: 'hand-first-mate', defId: 'pirate_first_mate', type: 'minion' },
                ],
                field: [
                    { uid: 'acolyte-direct', defId: 'ninja_acolyte', baseIndex: 0, owner: '0', controller: '0', power: 2 },
                ],
                factions: ['ninjas', 'pirates'],
                minionsPlayed: 0,
                minionLimit: 1,
            },
            player1: {
                factions: ['robots', 'zombies'],
            },
            bases: [
                { defId: 'base_the_mothership' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.sys?.phase === 'playCards'
                    && state?.core?.bases?.[0]?.minions?.some((minion: any) => minion.uid === 'acolyte-direct')
                    && state?.core?.players?.['0']?.hand?.some((card: any) => card.uid === 'hand-shinobi');
            },
            { timeout: 5000 }
        );

        const acolyte = page.locator('[data-minion-uid="acolyte-direct"]');
        await expect(acolyte).toBeVisible({ timeout: 5000 });
        await acolyte.click({ force: true });
        await game.waitForInteraction('ninja_acolyte_play', 10000);

        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.sys?.interaction?.current?.data?.sourceId === 'ninja_acolyte_play'
                    && state?.sys?.interaction?.current?.data?.targetType === 'hand';
            },
            { timeout: 5000 }
        );
        await expect(page.locator('[data-card-uid="hand-shinobi"]')).toBeVisible();
        await expect(page.getByTestId('prompt-card-0')).not.toBeVisible();
        await game.screenshot('hand-direct-click-prompt', testInfo);
        await saveEvidenceScreenshot(page, testInfo, 'smashup-hand-direct-click', '01-hand-direct-prompt.png');

        await page.click('[data-card-uid="hand-shinobi"]');

        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return !state?.sys?.interaction?.current;
            },
            { timeout: 5000 }
        );

        const finalState = await game.getState();
        expect(finalState.core.bases[0].minions.some((minion: any) =>
            minion.defId === 'ninja_shinobi' && minion.owner === '0'
        )).toBe(true);
        expect(finalState.core.bases[0].minions.some((minion: any) => minion.uid === 'acolyte-direct')).toBe(false);
        expect(finalState.core.players['0'].hand.some((card: any) => card.uid === 'acolyte-direct')).toBe(true);
        expect(finalState.core.players['0'].minionsPlayed).toBe(0);

        await game.screenshot('hand-direct-click-after', testInfo);
        await saveEvidenceScreenshot(page, testInfo, 'smashup-hand-direct-click', '02-hand-direct-after.png');
    });
});
