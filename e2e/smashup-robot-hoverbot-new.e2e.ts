import { mkdir } from 'fs/promises';
import { join } from 'path';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from './framework';

async function saveStableScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
    const dir = join(testInfo.config.rootDir, 'evidence', 'screenshots');
    await mkdir(dir, { recursive: true });
    await page.screenshot({ path: join(dir, `${name}.png`), fullPage: true });
}

test.describe('Smash Up 牌库检索交互', () => {
    test('悬浮机器人应显示可选卡牌并允许打出', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['robot_hoverbot'],
                deck: ['pirate_first_mate', 'pirate_swashbuckler'],
            },
            player1: {
                hand: [],
                deck: [],
            },
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.playCard('robot_hoverbot', { targetBaseIndex: 0 });
        await game.waitForInteraction('robot_hoverbot');

        const cardOptions = page.locator('[data-testid^="prompt-card-"]');
        await expect(cardOptions.first()).toBeVisible();
        await expect(cardOptions).toHaveCount(1);

        const options = await game.getInteractionOptions();
        expect(options.map((option: any) => option.id)).toEqual(expect.arrayContaining(['play', 'skip']));

        const skipButton = page.getByRole('button', { name: /跳过|skip/i });
        await expect(skipButton).toBeVisible();

        await game.screenshot('hoverbot-interaction-visible', testInfo);

        await game.selectOption('play');
        await game.waitForInteraction('robot_hoverbot_base');
        await game.selectBase(0);

        const finalState = await game.getState();
        const base0Minions = finalState.core.bases[0].minions.filter((minion: any) => minion.controller === '0');
        expect(base0Minions.some((minion: any) => minion.defId === 'robot_hoverbot')).toBe(true);
        expect(base0Minions.some((minion: any) => minion.defId === 'pirate_first_mate')).toBe(true);

        await game.screenshot('hoverbot-played-pirate', testInfo);
    });

    test('嫩芽牌库检索交互应显示卡牌选项并允许跳过', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [],
                deck: [
                    { uid: 'sprout-deck-1', defId: 'killer_plant_sprout', type: 'minion' },
                    { uid: 'sprout-deck-2', defId: 'wizard_neophyte', type: 'minion' },
                    { uid: 'sprout-deck-3', defId: 'robot_tech_center', type: 'action' },
                ],
                field: [
                    { uid: 'sprout-field-1', defId: 'killer_plant_sprout', baseIndex: 0, power: 2 },
                ],
            },
            player1: {
                hand: [],
                deck: [],
            },
            bases: [
                {
                    defId: 'base_secret_garden',
                    breakpoint: 20,
                    power: 2,
                    minions: [],
                },
            ],
            currentPlayer: '1',
            phase: 'playCards',
        });

        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                const state = harness?.state?.get?.();
                return (
                    state?.sys?.phase === 'playCards' &&
                    state?.core?.currentPlayerIndex === 1 &&
                    state?.core?.bases?.[0]?.minions?.some((minion: any) => minion.uid === 'sprout-field-1') &&
                    state?.core?.players?.['0']?.deck?.length === 3
                );
            },
            { timeout: 5000, polling: 200 },
        );

        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness.command.dispatch({
                type: 'ADVANCE_PHASE',
                playerId: '1',
                payload: {},
            });
        });

        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                const state = harness?.state?.get?.();
                return state?.sys?.interaction?.current?.data?.sourceId === 'killer_plant_sprout_search';
            },
            { timeout: 10000, polling: 200 },
        );

        const cardOptions = page.locator('[data-testid^="prompt-card-"]');
        await expect(cardOptions.first()).toBeVisible();
        await expect(cardOptions).toHaveCount(2);

        const skipButton = page.getByRole('button', { name: /跳过|skip/i });
        await expect(skipButton).toBeVisible();

        const interactionMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            const current = state?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId,
                targetType: current?.data?.targetType,
                autoRefresh: current?.data?.autoRefresh,
                responseValidationMode: current?.data?.responseValidationMode,
                optionIds: (current?.data?.options ?? []).map((option: any) => option.id),
                optionDisplayModes: (current?.data?.options ?? []).map((option: any) => option.displayMode ?? 'implicit'),
            };
        });

        expect(interactionMeta.sourceId).toBe('killer_plant_sprout_search');
        expect(interactionMeta.targetType).toBe('generic');
        expect(interactionMeta.autoRefresh).toBe('deck');
        expect(interactionMeta.responseValidationMode).toBe('live');
        expect(interactionMeta.optionIds).toEqual(expect.arrayContaining(['minion-0', 'minion-1', 'skip']));
        expect(interactionMeta.optionDisplayModes.filter((mode: string) => mode === 'card')).toHaveLength(2);

        await game.screenshot('sprout-prompt-visible', testInfo);
        await saveStableScreenshot(page, testInfo, 'sprout-prompt-visible');

        await skipButton.click();

        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                const state = harness?.state?.get?.();
                return !state?.sys?.interaction?.current;
            },
            { timeout: 5000, polling: 200 },
        );

        const finalState = await game.getState();
        expect(finalState.core.bases[0].minions.some((minion: any) => minion.uid === 'sprout-field-1')).toBe(false);
        expect(finalState.core.bases[0].minions.some((minion: any) => minion.controller === '0')).toBe(false);
        expect(finalState.core.players['0'].deck).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ defId: 'killer_plant_sprout' }),
                expect.objectContaining({ defId: 'wizard_neophyte' }),
            ]),
        );

        await game.screenshot('sprout-prompt-skipped', testInfo);
        await saveStableScreenshot(page, testInfo, 'sprout-prompt-skipped');
    });
});
