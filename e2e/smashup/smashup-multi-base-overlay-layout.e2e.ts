import type { Page } from '@playwright/test';
import { test, expect } from '../framework';

/**
 * 状态注入 E2E：
 * 这里默认验证的是 multi_base_scoring prompt 在浏览器里的布局与可见结果，
 * 不是从真实 scoreBases 链路自然走到该 prompt 的“真实链路 E2E”。
 */
function buildFourPlayerLayoutScene() {
    return {
        gameId: 'smashup',
        currentPlayer: '0',
        phase: 'playCards',
        bases: [
            {
                defId: 'base_the_jungle_oasis',
                minions: [
                    { uid: 'm1', defId: 'zombie_grave_digger', owner: '0', controller: '0' },
                    { uid: 'm2', defId: 'alien_invader', owner: '1', controller: '1' },
                    { uid: 'm3', defId: 'ghost_ghost', owner: '2', controller: '2' },
                ],
            },
            {
                defId: 'base_dread_lookout',
                minions: [
                    { uid: 'm4', defId: 'zombie_grave_digger', owner: '0', controller: '0' },
                    { uid: 'm5', defId: 'ninja_tiger_assassin', owner: '1', controller: '1' },
                    { uid: 'm6', defId: 'wizard_chronomage', owner: '2', controller: '2' },
                    { uid: 'm7', defId: 'dino_king_rex', owner: '3', controller: '3' },
                ],
            },
            {
                defId: 'base_tsars_palace',
                minions: [
                    { uid: 'm8', defId: 'dino_king_rex', owner: '0', controller: '0' },
                    { uid: 'm9', defId: 'ninja_tiger_assassin', owner: '1', controller: '1' },
                    { uid: 'm10', defId: 'ghost_servitor', owner: '2', controller: '2' },
                ],
            },
            { defId: 'base_the_homeworld', minions: [] },
            { defId: 'base_the_mothership', minions: [] },
        ],
        extra: {
            core: {
                turnOrder: ['0', '1', '2', '3'],
                turnNumber: 5,
                nextUid: 100,
                players: {
                    '0': {
                        id: '0',
                        vp: 1,
                        hand: [],
                        deck: [],
                        discard: [],
                        minionsPlayed: 1,
                        minionLimit: 1,
                        actionsPlayed: 1,
                        actionLimit: 1,
                        factions: ['dinosaurs', 'zombies'],
                    },
                    '1': {
                        id: '1',
                        vp: 2,
                        hand: [],
                        deck: [],
                        discard: [],
                        minionsPlayed: 1,
                        minionLimit: 1,
                        actionsPlayed: 1,
                        actionLimit: 1,
                        factions: ['aliens', 'ninjas'],
                    },
                    '2': {
                        id: '2',
                        vp: 3,
                        hand: [],
                        deck: [],
                        discard: [],
                        minionsPlayed: 1,
                        minionLimit: 1,
                        actionsPlayed: 1,
                        actionLimit: 1,
                        factions: ['ghosts', 'wizards'],
                    },
                    '3': {
                        id: '3',
                        vp: 4,
                        hand: [],
                        deck: [],
                        discard: [],
                        minionsPlayed: 1,
                        minionLimit: 1,
                        actionsPlayed: 1,
                        actionLimit: 1,
                        factions: ['dinosaurs', 'ghosts'],
                    },
                },
            },
        },
    };
}

async function openSmashupHarness(page: Page) {
    await page.goto('/play/smashup');
    await page.waitForFunction(
        () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
        { timeout: 120000, polling: 200 },
    );
}

test.describe('大杀四方多基地展示面板布局（状态注入）', () => {
    test('状态注入：multi_base_scoring 展示面板应一排显示两个基地', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await openSmashupHarness(page);
        await game.setupScene(buildFourPlayerLayoutScene());

        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness.state.patch({
                core: {
                    phase: 'scoreBases',
                },
                sys: {
                    phase: 'scoreBases',
                    interaction: {
                        queue: [],
                        current: {
                            id: 'multi_base_scoring_layout_test',
                            kind: 'simple-choice',
                            playerId: '0',
                            data: {
                                title: '选择先计分的基地',
                                sourceId: 'multi_base_scoring',
                                targetType: 'base',
                                options: [
                                    {
                                        id: 'base-0',
                                        label: '绿洲丛林',
                                        value: { baseIndex: 0, baseDefId: 'base_the_jungle_oasis' },
                                        displayMode: 'card',
                                    },
                                    {
                                        id: 'base-1',
                                        label: '恐怖眺望台',
                                        value: { baseIndex: 1, baseDefId: 'base_dread_lookout' },
                                        displayMode: 'card',
                                    },
                                    {
                                        id: 'base-2',
                                        label: '沙皇宫殿',
                                        value: { baseIndex: 2, baseDefId: 'base_tsars_palace' },
                                        displayMode: 'card',
                                    },
                                ],
                            },
                        },
                    },
                },
            });
        });

        await expect(page.getByText('选择先计分的基地')).toBeVisible();

        const promptBaseGrid = page.getByTestId('prompt-base-grid');
        await expect(promptBaseGrid).toBeVisible();
        await expect(page.locator('[data-testid^="prompt-card-"]')).toHaveCount(3);

        const [firstCardBox, secondCardBox, thirdCardBox] = await Promise.all([
            page.getByTestId('prompt-card-0').boundingBox(),
            page.getByTestId('prompt-card-1').boundingBox(),
            page.getByTestId('prompt-card-2').boundingBox(),
        ]);

        expect(firstCardBox, '第一个基地卡片应提供布局坐标').not.toBeNull();
        expect(secondCardBox, '第二个基地卡片应提供布局坐标').not.toBeNull();
        expect(thirdCardBox, '第三个基地卡片应提供布局坐标').not.toBeNull();
        expect(
            Math.abs((firstCardBox?.y ?? 0) - (secondCardBox?.y ?? 0)),
            '前两个基地应落在同一行',
        ).toBeLessThan(12);
        expect(
            (secondCardBox?.x ?? 0) - (firstCardBox?.x ?? 0),
            '第二个基地应排在第一行右侧',
        ).toBeGreaterThan(120);
        expect(
            (thirdCardBox?.y ?? 0) - (firstCardBox?.y ?? 0),
            '第三个基地应换到下一行',
        ).toBeGreaterThan(80);

        const screenshotPath = testInfo.outputPath('smashup-multi-base-grid-two-per-row.png');
        await promptBaseGrid.screenshot({ path: screenshotPath });
        await page.screenshot({ path: testInfo.outputPath('smashup-multi-base-grid-scene.png') });
    });
});
