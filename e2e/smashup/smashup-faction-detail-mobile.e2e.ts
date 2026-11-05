import { test, expect } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { ensureGameServerAvailable, initContext } from '../helpers/common';
import { createSmashUpRoomViaAPI, hideSmashUpDebugPanelForEvidence } from '../helpers/smashup';

for (const viewport of [{ width: 1920, height: 1080 }, { width: 796, height: 360 }, { width: 720, height: 360 }]) {
    test(`${viewport.width}×${viewport.height} 派系详情保留基础版与POD版并排`, async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL;
        const mobile = viewport.width < 1024;
        const rotatesFromPortrait = viewport.width === 796;
        const initialViewport = rotatesFromPortrait
            ? { width: viewport.height, height: viewport.width }
            : viewport;
        const context = await browser.newContext({ baseURL, viewport: initialViewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1 });
        await initContext(context);
        const page = await context.newPage();
        try {
            await page.goto('/', { waitUntil: 'domcontentloaded' });
            expect(await ensureGameServerAvailable(page)).toBe(true);
            const matchId = await createSmashUpRoomViaAPI(page);
            expect(matchId, '正式在线房间创建及房主入座应成功').not.toBeNull();
            await page.goto(`/play/smashup/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
            const faction = page.getByTestId('faction-option-robots');
            await expect(faction).toBeVisible({ timeout: 30000 });
            if (rotatesFromPortrait) {
                expect(await page.evaluate(() => matchMedia('(orientation: portrait)').matches), '796 横屏用例必须先从竖屏实际进入').toBe(true);
                await page.setViewportSize(viewport);
                await expect.poll(() => page.evaluate(() => ({
                    width: innerWidth,
                    height: innerHeight,
                    landscape: matchMedia('(orientation: landscape)').matches,
                })), { message: '正式牌桌应在视口转为横屏后完成布局更新' }).toEqual({
                    width: 796,
                    height: 360,
                    landscape: true,
                });
            }
            if (mobile) await faction.tap(); else await faction.click();
            const base = page.getByTestId('faction-variant-base');
            const pod = page.getByTestId('faction-variant-pod');
            await expect(base).toBeVisible();
            await expect(pod).toBeVisible();
            const panel = page.getByTestId('faction-detail-panel');
            await expect(panel).toHaveCSS('transform', 'none');
            await expect.poll(async () => {
                const a = await base.boundingBox();
                const b = await pod.boundingBox();
                return a && b ? Math.abs(a.y - b.y) : 100;
            }, { message: '基础版与 POD 版应在同一行' }).toBeLessThan(2);
            const before = await panel.boundingBox();
            // API仅准备房间和房主凭据；详情与版本切换走正式在线页面，不注入选择状态。
            await expect(page.getByRole('button', { name: '确认选择', exact: true })).toBeVisible();
            const expectDetailAssetsReady = async (targetPanel: typeof panel) => expect.poll(() => targetPanel.evaluate(element => {
                const cards = [...element.querySelectorAll('[data-testid="faction-preview-card"]')];
                return cards.length > 0 && cards.every(card => {
                    const image = card.querySelector('img');
                    return image?.complete && image.naturalWidth > 0 && !card.querySelector('.atlas-shimmer');
                });
            }), { message: '派系详情素材应完整加载', timeout: 30000 }).toBe(true);
            const captureDetailState = async (targetPanel: typeof panel, variant: typeof base, filename: string) => {
                await expectDetailAssetsReady(targetPanel);
                await variant.evaluate(async element => {
                    getComputedStyle(element).getPropertyValue('background-color');
                    await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {})));
                });
                await hideSmashUpDebugPanelForEvidence(page);
                await page.screenshot({ path: getEvidenceScreenshotPath(testInfo, filename) });
            };
            if (!mobile) await page.mouse.move(0, 0);
            if (rotatesFromPortrait || !mobile) {
                await expect(base).toHaveClass(/bg-slate-900/);
                await captureDetailState(
                    panel,
                    base,
                    mobile ? '手机-796x360-基础版详情并排-首次进入' : `PC-${viewport.width}x${viewport.height}-基础版详情并排-首次进入`,
                );
            }
            if (mobile) await pod.tap(); else await pod.click();
            await expect(pod).toHaveClass(/bg-slate-900/);
            const after = await panel.boundingBox();
            expect(after?.width).toBeCloseTo(before!.width, 0);
            await captureDetailState(panel, pod, `${mobile ? '手机' : 'PC'}-${viewport.width}x${viewport.height}-POD详情并排`);
            await page.reload();
            const reloadedFaction = page.getByTestId('faction-option-robots');
            await expect(reloadedFaction).toBeVisible({ timeout: 30000 });
            if (mobile) await reloadedFaction.tap(); else await reloadedFaction.click();
            const refreshedBase = page.getByTestId('faction-variant-base');
            const refreshedPod = page.getByTestId('faction-variant-pod');
            const refreshedPanel = page.getByTestId('faction-detail-panel');
            await expect(refreshedBase).toBeVisible();
            await expect(refreshedPod).toBeVisible();
            await expect(refreshedBase).toHaveClass(/bg-slate-900/);
            await expect.poll(async () => {
                const a = await refreshedBase.boundingBox();
                const b = await refreshedPod.boundingBox();
                return a && b ? Math.abs(a.y - b.y) : 100;
            }, { message: '刷新后基础版与 POD 版仍应并排' }).toBeLessThan(2);
            await expect(page.getByRole('button', { name: '确认选择', exact: true })).toBeVisible();
            await captureDetailState(
                refreshedPanel,
                refreshedBase,
                mobile ? '手机-796x360-刷新后基础版详情并排' : `PC-${viewport.width}x${viewport.height}-刷新后基础版详情并排`,
            );
        } catch (error) {
            await page.screenshot({ path: testInfo.outputPath(`actual-${viewport.width}x${viewport.height}-failure.png`) });
            console.log('实际详情页诊断', await page.evaluate(() => ({
                viewport: [innerWidth, innerHeight],
                details: document.querySelector('[data-testid="faction-detail-panel"]')?.getBoundingClientRect().toJSON(),
                variants: [...document.querySelectorAll('[data-testid^="faction-variant-"]')].map(element => ({
                    testId: element.getAttribute('data-testid'),
                    rect: element.getBoundingClientRect().toJSON(),
                })),
            })));
            throw error;
        } finally {
            await context.close();
        }
    });
}
