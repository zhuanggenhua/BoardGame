import type { Page } from '@playwright/test';
import { expect, test } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { initContext, joinMatchViaAPI, seedMatchCredentials } from '../helpers/common';
import { createSmashUpRoomViaAPI } from '../helpers/smashup';

const grid = (page: Page) => page.getByTestId('faction-virtual-window');
const gridScrollTop = (page: Page) => grid(page).evaluate(node => node.parentElement!.scrollTop);

for (const mobile of [false, true]) {
    test(`联机选派保留浏览位置（${mobile ? '手机横屏' : '桌面'}）`, async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL;
        const context = await browser.newContext({
            baseURL,
            viewport: mobile ? { width: 936, height: 432 } : { width: 1440, height: 900 },
            hasTouch: mobile,
            isMobile: mobile,
        });
        const guestContext = await browser.newContext({ baseURL });
        try {
            await initContext(context);
            await initContext(guestContext);
            const page = await context.newPage();
            const guest = await guestContext.newPage();
            const matchId = await createSmashUpRoomViaAPI(page);
            expect(matchId).toBeTruthy();
            const credentials = await joinMatchViaAPI(guest, 'smashup', matchId!, '1', 'Guest');
            expect(credentials).toBeTruthy();
            await seedMatchCredentials(guest, 'smashup', matchId!, '1', credentials!);
            await Promise.all([
                page.goto(`/play/smashup/match/${matchId}?playerID=0`),
                guest.goto(`/play/smashup/match/${matchId}?playerID=1`),
            ]);
            const hostList = grid(page);
            await hostList.waitFor({ timeout: 60000 });
            await grid(guest).waitFor({ timeout: 60000 });
            await hostList.evaluate(node => node.parentElement!.scrollTo({ top: 290 }));
            const readVisibleFaction = () => hostList.evaluate(node => {
                const viewport = node.parentElement!.getBoundingClientRect();
                return [...node.querySelectorAll<HTMLElement>('[data-testid^="faction-option-"]')]
                    .find(option => {
                        const card = option.getBoundingClientRect();
                        const centerY = (card.top + card.bottom) / 2;
                        return option.dataset.testid !== 'faction-option-pirates'
                            && option.dataset.testid !== 'faction-option-random'
                            && centerY > viewport.top + 30 && centerY < viewport.bottom - 45;
                    })?.dataset.testid;
            });
            await expect.poll(readVisibleFaction).toMatch(/^faction-option-/);
            const ownFaction = page.getByTestId((await readVisibleFaction())!);
            const before = await gridScrollTop(page);
            expect(before).toBeGreaterThan(0);
            const timeOrigin = await page.evaluate(() => performance.timeOrigin);
            const tapOrClick = async (target: typeof ownFaction) => {
                await expect(target).toBeVisible();
                const box = (await target.boundingBox())!;
                const x = box.x + box.width / 2;
                const y = box.y + box.height / 2;
                if (mobile) await page.touchscreen.tap(x, y);
                else await page.mouse.click(x, y);
            };

            const screenshot = (name: string) => page.screenshot({
                path: getEvidenceScreenshotPath(testInfo, name, { format: 'png' }),
            });
            await screenshot('01-打开前');
            await tapOrClick(ownFaction);
            const close = page.getByTestId('faction-detail-close');
            await expect(close).toBeVisible();
            expect(await gridScrollTop(page), '打开详情后列表位置').toBe(before);
            await tapOrClick(close);
            await expect(page.getByTestId('faction-detail-panel')).toHaveCount(0);
            expect(await gridScrollTop(page), '关闭详情后列表位置').toBe(before);
            await expect(ownFaction).toHaveAttribute('aria-pressed', 'false');
            await screenshot('02-关闭后');

            await tapOrClick(ownFaction);
            const hostConfirm = page.getByTestId('faction-confirm-button');
            await expect(hostConfirm).toBeEnabled();
            await tapOrClick(hostConfirm);
            await expect(page.getByTestId('faction-detail-panel')).toHaveCount(0);
            await expect(ownFaction).toHaveAttribute('aria-pressed', 'true');
            expect(await gridScrollTop(page), '确认选择后列表位置').toBe(before);

            const opponentFaction = guest.getByTestId('faction-option-pirates');
            await opponentFaction.click();
            const confirm = guest.getByTestId('faction-confirm-button');
            await expect(confirm).toBeEnabled();
            await confirm.click();
            const opponentRail = page.getByTestId('faction-selection-player-card-1');
            await expect(opponentRail.locator('.smashup-card-inner[title]')).toHaveCount(1);
            expect(await gridScrollTop(page), '收到对手选择后列表位置').toBe(before);
            expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
            await screenshot('03-双方选择后');
        } finally {
            await Promise.all([context.close(), guestContext.close()]);
        }
    });
}
