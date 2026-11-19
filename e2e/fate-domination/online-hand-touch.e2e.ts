import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { initContext } from '../helpers/common';
import { getMatchState, patchMatchState } from '../helpers/state-injection';
import { createEvidenceScreenshotRun, getEvidenceScreenshotPathInDirectory, promoteEvidenceScreenshotRun } from '../framework/evidenceScreenshots';
import { chooseFateIdentity } from './identitySelection';
import type { MatchState } from '../../src/engine/types';
import type { FateDominationCore } from '../../src/games/fate-domination/domain';

async function enterFateOutpost(page: Page, context: BrowserContext) {
    await initContext(context, { skipImageGate: false });
    await page.goto('/');
    await page.locator('[data-game-id="fate-domination"] .platform-game-open').first().click();
    await page.getByTestId('game-details-open-create-room').first().click();
    const room = page.getByTestId('create-room-modal').last();
    await room.getByRole('button', { name: '3人', exact: true }).click();
    await room.getByRole('button', { name: /^加入 AI/ }).click();
    await room.getByTestId('create-room-confirm-button').click();
    await page.waitForURL(/\/play\/fate-domination\/match\/[^/?]+\?playerID=0/);
    const matchId = decodeURIComponent(new URL(page.url()).pathname.split('/').at(-1)!);
    const read = async () => await getMatchState(matchId, page) as MatchState<FateDominationCore>;
    await chooseFateIdentity(page, 'master', 'm_waver');
    await chooseFateIdentity(page, 'servant', 'servant-rider');
    await page.getByTestId('fate-domination-primary-action').click();
    await expect.poll(async () => (await read()).core.phase, { timeout: 25000 }).toBe('outpost');
    await expect(page.getByTestId('fate-domination-location-workshop')).toBeVisible();
    return { matchId, read };
}

test('受限桌面在线房：空手牌保留正式牌区，玩家详情不重复显示即时威力', async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width: 1169, height: 719 });
    const { matchId, read } = await enterFateOutpost(page, context);
    const run = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true, subdir: '在线代表态诊断' });
    const capture = (name: string) => page.screenshot({
        path: getEvidenceScreenshotPathInDirectory(run.stagingDir, name + '.png', { requireChineseName: true }),
        animations: 'disabled',
    });
    const stage = page.locator('.fd-phase-control');
    const skillZone = page.locator('.fd-skill-hand-zone');
    const stageBefore = (await stage.boundingBox())!;
    const skillsBefore = (await skillZone.boundingBox())!;
    const state = await read();
    const self = state.core.players['0'];
    await patchMatchState(matchId, {
        core: { players: { '0': { ...self, hand: [], deck: [...self.hand, ...self.deck] } } },
        sys: { ...state.sys, turnOrder: state.core.turnOrder, currentPlayerIndex: state.core.currentTurnIndex },
    }, page);
    await expect(page.getByText('暂无攻击手牌', { exact: true })).toBeVisible();
    await expect(page.locator('[data-card-zone="hand"]')).toHaveCount(0);
    expect((await stage.boundingBox())!.y).toBeCloseTo(stageBefore.y, 0);
    expect((await skillZone.boundingBox())!.x).toBeCloseTo(skillsBefore.x, 0);
    expect((await skillZone.boundingBox())!.width).toBeCloseTo(skillsBefore.width, 0);
    await page.mouse.move(12, 12);
    await capture('空手牌与固定技能区');

    const opponentAvatar = page.locator('[data-tutorial-id="fate-player-1"] .fd-runtime-avatar');
    await opponentAvatar.hover();
    await expect(page.locator('.fd-runtime-opponent-cards')).toHaveCount(0);
    await opponentAvatar.click();
    const detail = page.locator('.fd-player-detail');
    await expect(detail).toBeVisible();
    await expect(detail.locator('.fd-player-detail-stats')).not.toContainText(/威力|战力/);
    await expect(detail.getByRole('button', { name: /^切换到玩家2/ })).toHaveAttribute('aria-current', 'page');
    await capture('对手详情隐藏的从者及技能');
    await detail.getByRole('button', { name: /^切换到玩家1/ }).click();
    await expect(detail.getByRole('button', { name: /^切换到玩家1/ })).toHaveAttribute('aria-current', 'page');
    await expect(detail.getByRole('button', { name: /发动/ })).toHaveCount(0);
    await expect(detail.getByText('战略部署', { exact: true })).toHaveCount(0);
    await expect(detail.locator('.fd-player-detail-skills button')).toHaveCount(3);
    await capture('本人详情与紧凑关联牌');
    await detail.getByRole('button', { name: '关闭玩家详情' }).click();
    await expect(detail).toHaveCount(0);
    await promoteEvidenceScreenshotRun(run);
    console.log('[Fate online desk]', run.stableDir);
});

test.describe('在线触控检视', () => {
    test.use({ viewport: { width: 936, height: 432 }, screen: { width: 936, height: 432 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    test('真实长按、抬手和关闭不提前提交攻击', async ({ page, context }, testInfo) => {
        const { read } = await enterFateOutpost(page, context);
        const before = (await read()).core.players['0'];
        const hand = page.locator('[data-card-zone="hand"]').first();
        await expect(hand).toBeVisible();
        const box = (await hand.boundingBox())!;
        const point = { x: box.x + box.width / 3, y: box.y + box.height / 3 };
        const cardId = await hand.getAttribute('data-card-id');
        expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-card-id]')?.getAttribute('data-card-id'), point)).toBe(cardId);
        const touch = await context.newCDPSession(page);
        try {
            await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
            await expect(page.getByTestId('fate-runtime-inspection')).toBeVisible();
        } finally {
            await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            await touch.detach();
        }
        await expect(page.getByTestId('fate-runtime-inspection')).toBeVisible();
        const run = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true, subdir: '在线触控诊断' });
        await page.screenshot({ path: getEvidenceScreenshotPathInDirectory(run.stagingDir, '长按后完整卡面.png', { requireChineseName: true }), animations: 'disabled' });
        await page.getByTestId('fate-inspection-close').tap();
        await expect(page.getByTestId('fate-runtime-inspection')).toHaveCount(0);
        const after = (await read()).core.players['0'];
        expect(after).toMatchObject({ mana: before.mana, hand: before.hand, selectedAttackIds: [], activeAttackIds: [] });
        await page.getByTestId('fate-domination-location-workshop').tap();
        await expect.poll(async () => (await read()).core.players['0'].locationId).toBe('workshop');
        await promoteEvidenceScreenshotRun(run);
        console.log('[Fate online touch]', run.stableDir);
    });
});
