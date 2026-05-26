import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { setChineseLocale } from '../helpers/common';

const DESKTOP_VIEWPORT = { width: 1920, height: 1080 } as const;

function createPlayerState(playerId: string, factions: [string, string]) {
    return {
        id: playerId,
        vp: 0,
        hand: [],
        deck: [],
        discard: [],
        factions,
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
    };
}

function buildFactionSelectionScene() {
    return {
        gameId: 'smashup',
        currentPlayer: '0',
        phase: 'factionSelect',
        extra: {
            core: {
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                turnNumber: 1,
                nextUid: 1000,
                players: {
                    '0': createPlayerState('0', ['huluwawa', 'ninjas']),
                    '1': createPlayerState('1', ['aliens', 'robots']),
                },
                factionSelection: {
                    takenFactions: [],
                    playerSelections: {
                        '0': [],
                        '1': [],
                    },
                    completedPlayers: [],
                },
            },
        },
    };
}

async function saveEvidenceScreenshot(
    page: Page,
    testInfo: TestInfo,
    subdir: string,
    filename: string,
): Promise<string> {
    const path = getEvidenceScreenshotPath(testInfo, filename, { subdir, filename });
    mkdirSync(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: true });
    return path;
}

async function waitForFactionSelectionReady(page: Page) {
    const title = page.locator('h1').filter({ hasText: /Draft Your Factions|选择你的派系/i });
    await expect(title).toBeVisible({ timeout: 15000 });
    await page.waitForFunction(() => {
        const bodyText = document.body?.innerText ?? '';
        return !bodyText.includes('Loading match resources...')
            && !bodyText.includes('正在加载对局资源...');
    }, { timeout: 15000 });
}

async function expectBackgroundImageLoaded(locator: ReturnType<Page['locator']>) {
    await expect
        .poll(
            async () =>
                locator.first().evaluate((node) => {
                    const previewNode = Array.from(node.querySelectorAll<HTMLElement>('div')).find((candidate) => {
                        const { backgroundImage } = window.getComputedStyle(candidate);
                        return backgroundImage.includes('url(') && !backgroundImage.includes('none');
                    });
                    return previewNode
                        ? window.getComputedStyle(previewNode).backgroundImage
                        : '';
                }),
            { timeout: 10000 },
        )
        .toContain('url(');
}

test.describe('SmashUp 葫芦娃 PR 级交付链路', () => {
    test.beforeEach(async ({ page }, testInfo) => {
        test.setTimeout(90000);
        await setChineseLocale(page.context());
        await page.setViewportSize(DESKTOP_VIEWPORT);
        await page.goto('about:blank');
        await page.waitForTimeout(50);
        testInfo.setTimeout(90000);
    });

    test('中文选派可见、详情预览与进局卡牌/基地/泰坦资源应渲染', async ({ page, game }, testInfo) => {
        await game.openTestGame('smashup', { skipInitialization: true }, 45000);
        await game.setupScene(buildFactionSelectionScene());
        await waitForFactionSelectionReady(page);

        const huluwawaOption = page.getByTestId('faction-option-huluwawa');
        await expect(huluwawaOption).toBeVisible({ timeout: 10000 });
        await expect(huluwawaOption).toContainText('葫芦娃');
        await saveEvidenceScreenshot(page, testInfo, 'smashup-huluwawa-pr', '01-zh-faction-visible.png');

        await huluwawaOption.click();
        await expect(page.getByTestId('faction-detail-panel')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('faction-preview-grid')).toBeVisible();
        await expect(page.getByTestId('faction-titan-section')).toBeVisible();
        await expect(page.getByTestId('faction-preview-card').first()).toContainText('大娃');
        await expectBackgroundImageLoaded(page.getByTestId('faction-preview-card').first());
        await expectBackgroundImageLoaded(page.getByTestId('faction-titan-card').first());
        await saveEvidenceScreenshot(page, testInfo, 'smashup-huluwawa-pr', '02-zh-faction-detail-preview.png');

        await page.getByTestId('faction-preview-tab-bases').click();
        await expect(page.getByTestId('faction-base-grid')).toBeVisible();
        await expectBackgroundImageLoaded(page.getByTestId('faction-base-card').first());
        await saveEvidenceScreenshot(page, testInfo, 'smashup-huluwawa-pr', '02b-zh-faction-base-preview.png');

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                factions: ['huluwawa', 'ninjas'],
                hand: [{ uid: 'hand-huluwawa-da-wa', defId: 'huluwawa_da_wa', type: 'minion' }],
                field: [
                    { uid: 'board-huluwawa-er-wa', defId: 'huluwawa_er_wa', baseIndex: 0, owner: '0', controller: '0' },
                ],
            },
            player1: { factions: ['aliens', 'robots'] },
            bases: [
                { defId: 'base_huluwawa_mountain' },
                { defId: 'base_seven_colored_lotus' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
            extra: {
                core: {
                    titans: [{
                        uid: 'board-huluwawa-titan',
                        defId: 'huluwawa_little_king_kong',
                        faction: 'huluwawa',
                        ownerId: '0',
                        controllerId: '0',
                        powerCounters: 0,
                        talentUsed: false,
                        location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                    }],
                },
            },
        });

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-card-uid="hand-huluwawa-da-wa"]')).toBeVisible();
        await expect(page.locator('[data-minion-uid="board-huluwawa-er-wa"]')).toBeVisible();
        await expect(page.getByTestId('su-base-titan-board-huluwawa-titan')).toBeVisible();
        await saveEvidenceScreenshot(page, testInfo, 'smashup-huluwawa-pr', '03-in-game-huluwawa-resources.png');
    });

    test('二娃真实天赋入口应展示顶三张、额外打出并落实顶/底重排', async ({ page, game }, testInfo) => {
        await game.openTestGame('smashup', { skipFactionSelect: true }, 45000);
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                factions: ['huluwawa', 'ninjas'],
                deck: [
                    { uid: 'erwa-top-minion', defId: 'huluwawa_da_wa', type: 'minion' },
                    { uid: 'erwa-top-action', defId: 'huluwawa_pop', type: 'action' },
                    { uid: 'erwa-top-minion-2', defId: 'huluwawa_san_wa', type: 'minion' },
                    { uid: 'erwa-rest-card', defId: 'huluwawa_wu_wa', type: 'minion' },
                ],
                field: [
                    { uid: 'erwa-talent-source', defId: 'huluwawa_er_wa', baseIndex: 0, owner: '0', controller: '0' },
                ],
                minionsPlayed: 1,
                minionLimit: 1,
            },
            player1: { factions: ['aliens', 'robots'] },
            bases: [
                { defId: 'base_huluwawa_mountain' },
                { defId: 'base_seven_colored_lotus' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await expect(page.locator('[data-minion-uid="erwa-talent-source"]')).toBeVisible({ timeout: 10000 });
        await page.locator('[data-minion-uid="erwa-talent-source"]').click({ force: true });
        await game.waitForInteraction('huluwawa_er_wa', 10000);
        await saveEvidenceScreenshot(page, testInfo, 'smashup-huluwawa-pr', '04-erwa-top-three-prompt.png');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.cardUid === 'erwa-top-minion',
            '二娃选择顶牌大娃',
        );
        await game.waitForInteraction('huluwawa_extra_minion_base', 10000);
        await game.selectInteractionOptionBy(
            (option: any) => option.value?.baseIndex === 1,
            '二娃额外打出到七彩莲蓬',
        );
        await game.waitForInteraction('huluwawa_er_wa_reorder', 10000);
        await saveEvidenceScreenshot(page, testInfo, 'smashup-huluwawa-pr', '05-erwa-reorder-prompt.png');

        await game.selectInteractionOptionBy(
            (option: any) =>
                option.value?.topUids?.join(',') === 'erwa-top-action'
                && option.value?.bottomUids?.join(',') === 'erwa-top-minion-2',
            '二娃将行动放顶、三娃放底',
        );
        await game.waitForNoInteraction(10000);

        const finalState = await game.getState();
        expect(finalState.core.bases[1].minions.some((minion: any) =>
            minion.uid === 'erwa-top-minion' && minion.defId === 'huluwawa_da_wa'
        )).toBe(true);
        expect(finalState.core.players['0'].deck.map((card: any) => card.uid)).toEqual([
            'erwa-top-action',
            'erwa-rest-card',
            'erwa-top-minion-2',
        ]);
        await saveEvidenceScreenshot(page, testInfo, 'smashup-huluwawa-pr', '06-erwa-resolved.png');
    });

    test('七彩莲蓬真实基地入口应额外打出同印刷力量仆从且本回合只触发一次', async ({ page, game }, testInfo) => {
        await game.openTestGame('smashup', { skipFactionSelect: true }, 45000);
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                factions: ['huluwawa', 'ninjas'],
                hand: [
                    { uid: 'lotus-hand-da-wa', defId: 'huluwawa_da_wa', type: 'minion' },
                    { uid: 'lotus-hand-er-wa', defId: 'huluwawa_er_wa', type: 'minion' },
                    { uid: 'lotus-hand-san-wa', defId: 'huluwawa_san_wa', type: 'minion' },
                ],
                minionsPlayed: 0,
                minionLimit: 1,
            },
            player1: { factions: ['aliens', 'robots'] },
            bases: [
                { defId: 'base_seven_colored_lotus' },
                { defId: 'base_huluwawa_mountain' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.playCard('huluwawa_da_wa', { targetBaseIndex: 0 });
        await game.waitForInteraction('base_seven_colored_lotus', 10000);
        await saveEvidenceScreenshot(page, testInfo, 'smashup-huluwawa-pr', '07-lotus-extra-minion-prompt.png');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.cardUid === 'lotus-hand-er-wa',
            '七彩莲蓬选择二娃',
        );
        await game.waitForNoInteraction(10000);

        const finalState = await game.getState();
        const baseMinionIds = finalState.core.bases[0].minions.map((minion: any) => minion.defId);
        expect(baseMinionIds).toContain('huluwawa_da_wa');
        expect(baseMinionIds).toContain('huluwawa_er_wa');
        expect(finalState.core.players['0'].hand.some((card: any) => card.uid === 'lotus-hand-er-wa')).toBe(false);
        expect(finalState.core.players['0'].hand.some((card: any) => card.uid === 'lotus-hand-san-wa')).toBe(true);
        expect(finalState.sys.interaction?.current).toBeUndefined();
        await saveEvidenceScreenshot(page, testInfo, 'smashup-huluwawa-pr', '08-lotus-resolved-once.png');
    });
});
