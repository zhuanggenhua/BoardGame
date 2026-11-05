/**
 * DiceThrone 蜘蛛侠真实入口与卡图审计证据。
 *
 * 覆盖：在线双玩家选角/开局、九个技能槽位、正式 33 张卡图中的专属槽位、
 * 以及蜘蛛侠升级牌从真实手牌入口打出后的技能替换。
 */

import type { Browser, Page, TestInfo } from '@playwright/test';
import { dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { getGameServerBaseURL, waitForTestHarness } from '../helpers/common';
import {
    cleanupDTMatch,
    closeDebugPanelIfOpen,
    dragDiceThroneHandCardToPlay,
    readyAndStartGame,
    selectCharacter,
    setupOnlineMatch,
    waitForDiceThroneHarness,
    waitForGameBoard,
} from '../helpers/dicethrone';

type MatchSetup = NonNullable<Awaited<ReturnType<typeof setupOnlineMatch>>>;

const ZHIZHUXIA_SLOT_ABILITIES = {
    fist: 'heavy-punch',
    chi: 'combo-strike',
    sky: 'trap',
    lotus: 'venom-punch',
    combo: 'wall-crawl',
    lightning: 'spider-reflex',
    calm: 'counter',
    meditate: 'spider-sense',
    ultimate: 'ultimate-spider',
} as const;

const ZHIZHUXIA_PROOF_HAND = [
    { id: 'upgrade-zhizhuxia-heavy-punch-2', atlasIndex: 18 },
    { id: 'upgrade-zhizhuxia-combo-strike-2', atlasIndex: 19 },
    { id: 'card-zhizhuxia-praise', atlasIndex: 25 },
    { id: 'card-zhizhuxia-flying-escape', atlasIndex: 26 },
    { id: 'card-zhizhuxia-ambush', atlasIndex: 27 },
] as const;

const saveEvidenceScreenshot = async (page: Page, testInfo: TestInfo, name: string): Promise<string> => {
    const path = getEvidenceScreenshotPath(testInfo, name, {
        filename: `${name}.png`,
        format: 'png',
        requireChineseName: true,
    });
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: false });
    return path;
};

const setupZhizhuxiaOnlineMatch = async (
    browser: Browser,
    baseURL: string | undefined,
): Promise<MatchSetup> => {
    const match = await setupOnlineMatch(browser, baseURL, {
        skipImageGate: true,
        characterSelectionTimeout: 240000,
    });
    if (!match) {
        test.skip(true, '游戏服务器不可用或创建 Dice Throne 房间失败');
        throw new Error('Dice Throne online setup failed');
    }

    await selectCharacter(match.hostPage, 'zhizhuxia');
    await selectCharacter(match.guestPage, 'monk');
    return match;
};

const waitForHeroHandAtlas = async (page: Page): Promise<void> => {
    await page.waitForFunction((proofHand) => {
        const hand = document.querySelector('[data-testid="hand-area"]');
        if (!hand || hand.querySelectorAll('.atlas-shimmer').length > 0) return false;

        return (proofHand as Array<{ id: string; atlasIndex: number }>).every(({ id, atlasIndex }) => {
            const card = hand.querySelector(`[data-card-id="${id}"]`);
            const frame = card?.querySelector('[data-card-atlas-frame="true"]');
            const image = card?.querySelector('[data-card-atlas-img="true"]') as HTMLImageElement | null;
            return frame?.getAttribute('data-card-atlas-index') === String(atlasIndex)
                && image?.complete === true
                && image.naturalWidth > 16
                && image.naturalHeight > 16;
        });
    }, ZHIZHUXIA_PROOF_HAND, { timeout: 20000, polling: 100 });
};

test.describe('DiceThrone 蜘蛛侠真实入口', () => {
    test('真实在线双玩家应完成蜘蛛侠选角并看到完整玩家板', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const baseURL = testInfo.project.use.baseURL as string | undefined ?? getGameServerBaseURL();
        const match = await setupZhizhuxiaOnlineMatch(browser, baseURL);

        try {
            await expect(match.hostPage.locator('[data-character-id="zhizhuxia"]')).toContainText(/P1/i);
            await expect(match.guestPage.locator('[data-character-id="monk"]')).toContainText(/P2/i);
            await expect(match.hostPage.getByTestId('character-badge-zhizhuxia-implementation_in_progress')).toHaveCount(1);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '01-蜘蛛侠选角-实施中状态');

            await readyAndStartGame(match.hostPage, match.guestPage);
            await waitForGameBoard(match.hostPage);
            await waitForGameBoard(match.guestPage);
            await waitForDiceThroneHarness(match.hostPage);
            await waitForDiceThroneHarness(match.guestPage);
            await closeDebugPanelIfOpen(match.hostPage);
            await closeDebugPanelIfOpen(match.guestPage);

            const hostDiceTray = match.hostPage.getByTestId('dicethrone-2d-dice-tray');
            await expect(hostDiceTray).toBeVisible();
            await expect(hostDiceTray).toHaveAttribute('data-dice-count', '5');
            await expect(hostDiceTray.locator('[data-testid^="die-button-"]')).toHaveCount(5);
            await expect(hostDiceTray.locator('[data-definition-id="zhizhuxia-dice"]')).toHaveCount(5);

            const hostBoard = match.hostPage.getByTestId('player-board-surface');
            await expect(hostBoard).toHaveAttribute('data-character-id', 'zhizhuxia', { timeout: 10000 });
            for (const [slotId, abilityId] of Object.entries(ZHIZHUXIA_SLOT_ABILITIES)) {
                await expect(hostBoard.locator(`[data-ability-slot="${slotId}"]`).first())
                    .toHaveAttribute('data-base-ability-id', abilityId);
            }
            await expect(match.hostPage.locator('[data-testid="hand-area"] [data-card-id]')).toHaveCount(4, { timeout: 10000 });
            await expect(match.hostPage.locator('img[alt="玩家面板"], img[alt="Player Board"]').first()).toBeVisible();
            await saveEvidenceScreenshot(match.hostPage, testInfo, '02-蜘蛛侠牌桌-玩家板与手牌');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('正式蜘蛛侠卡图槽位可见，升级牌可从真实手牌入口打出', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);
        await clearEvidenceScreenshotsForTest(testInfo);
        await game.openTestGame('dicethrone', { playerID: '0', seat1: 'human' }, 180000);
        await waitForTestHarness(page, 40000);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ZHIZHUXIA_PROOF_HAND.map((card) => card.id),
                discard: [],
                resources: { cp: 10, hp: 50 },
            },
            player1: {
                hand: [],
                resources: { cp: 2, hp: 50 },
            },
            currentPlayer: '0',
            phase: 'main1',
            extra: {
                selectedCharacters: { '0': 'zhizhuxia', '1': 'monk' },
                hostStarted: true,
                pendingAttack: null,
                pendingDamage: undefined,
                rollCount: 0,
                rollLimit: 3,
                rollConfirmed: false,
                dice: [],
            },
        });

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                characterId: state?.core?.selectedCharacters?.['0'] ?? null,
                handIds: (state?.core?.players?.['0']?.hand ?? []).map((card: { id: string }) => card.id),
            };
        }, { timeout: 10000 }).toEqual({
            phase: 'main1',
            characterId: 'zhizhuxia',
            handIds: ZHIZHUXIA_PROOF_HAND.map((card) => card.id),
        });

        await waitForHeroHandAtlas(page);
        const diceTray = page.getByTestId('dicethrone-2d-dice-tray');
        await expect(diceTray).toBeVisible();
        await expect(diceTray).toHaveAttribute('data-dice-count', '5');
        await expect(diceTray.locator('[data-testid^="die-button-"]')).toHaveCount(5);
        await expect(diceTray.locator('[data-definition-id="zhizhuxia-dice"]')).toHaveCount(5);
        const atlasSnapshot = await page.evaluate((proofHand) => Object.fromEntries(
            (proofHand as Array<{ id: string; atlasIndex: number }>).map(({ id }) => {
                const card = document.querySelector(`[data-testid="hand-area"] [data-card-id="${id}"]`);
                const frame = card?.querySelector('[data-card-atlas-frame="true"]');
                const image = card?.querySelector('[data-card-atlas-img="true"]') as HTMLImageElement | null;
                return [id, {
                    atlasIndex: frame?.getAttribute('data-card-atlas-index') ?? null,
                    imageReady: Boolean(image?.complete && image.naturalWidth > 16 && image.naturalHeight > 16),
                }];
            }),
        ), ZHIZHUXIA_PROOF_HAND);
        for (const card of ZHIZHUXIA_PROOF_HAND) {
            expect(atlasSnapshot[card.id]).toMatchObject({
                atlasIndex: String(card.atlasIndex),
                imageReady: true,
            });
        }
        await saveEvidenceScreenshot(page, testInfo, '03-蜘蛛侠正式专属卡图槽位');

        await dragDiceThroneHandCardToPlay(page, 'upgrade-zhizhuxia-heavy-punch-2');
        await expect.poll(async () => {
            const state = await game.getState();
            const player = state?.core?.players?.['0'];
            return {
                reject: await page.evaluate(() => (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null),
                level: player?.abilityLevels?.['heavy-punch'] ?? 0,
                handIds: (player?.hand ?? []).map((card: { id: string }) => card.id),
                discardIds: (player?.discard ?? []).map((card: { id: string }) => card.id),
                upgradeCardId: player?.upgradeCardByAbilityId?.['heavy-punch']?.cardId ?? null,
            };
        }, { timeout: 15000 }).toMatchObject({
            reject: null,
            level: 2,
            handIds: [
                'upgrade-zhizhuxia-combo-strike-2',
                'card-zhizhuxia-praise',
                'card-zhizhuxia-flying-escape',
                'card-zhizhuxia-ambush',
            ],
            discardIds: [],
            upgradeCardId: 'upgrade-zhizhuxia-heavy-punch-2',
        });
        await saveEvidenceScreenshot(page, testInfo, '04-蜘蛛侠重拳二级升级后');
    });
});
