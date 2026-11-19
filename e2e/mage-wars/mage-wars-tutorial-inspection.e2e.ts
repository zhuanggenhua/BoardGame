import { expect, test, type Locator, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { captureEvidenceSourceIdentity, startSourceSession } from '../framework/sourceIdentity';
import { initContext, waitForFrontendAssets, waitForTestHarness } from '../helpers/common';
import { expectReadableMageWarsPreview } from './helpers/cardPreview';

const guardStep = '[data-tutorial-step="guard-wolf"]';
const healStep = '[data-tutorial-step="heal-wolf"]';
const wolf = '[data-testid="mage-wars-zone-field-card"][data-object-id="mwobj-0-2819-1"]';
const spell = '[data-tutorial-id="mw-prepared-card-3402"]';

test.setTimeout(120_000);

type Action = (element: Locator) => Promise<void>;

async function reachHeal(page: Page, act: Action) {
    await page.goto('/play/mage-wars/tutorial', { waitUntil: 'domcontentloaded' });
    await waitForFrontendAssets(page, 45_000);
    const board = page.getByTestId('mage-wars-board');
    const entry = page.getByTestId('tutorial-catalog-entry-mage-wars-basic');
    await expect(board.or(entry).first()).toBeVisible({ timeout: 60_000 });
    if (await entry.isVisible()) await act(entry);
    await expect(page.locator(guardStep)).toBeVisible({ timeout: 60_000 });
    await waitForTestHarness(page, 20_000);
    await act(page.locator(wolf));
    await act(page.getByTestId('mage-wars-selected-unit-guard'));
    await expect(page.locator(healStep)).toBeVisible();
}

async function readHealingState(page: Page) {
    return page.evaluate(() => {
        const harness = (window as Window & { __BG_TEST_HARNESS__?: { state?: { get?: () => unknown } } }).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.() as {
            core?: {
                turnNumber: number;
                players: Record<string, { mana: number }>;
                objects: Record<string, { damage: number }>;
            };
        } | undefined;
        return {
            round: state?.core?.turnNumber,
            mana: state?.core?.players['0']?.mana,
            damage: state?.core?.objects['mwobj-0-2819-1']?.damage,
        };
    });
}


test.describe('触屏检视', () => {
    test.use({ viewport: { width: 932, height: 430 }, hasTouch: true, isMobile: true });

    test('长按治疗牌，松手后可阅读并关闭，另一次背景轻点可关闭', async ({ context, page, baseURL }, info) => {
        if (!baseURL) throw new Error('检视用例需要正式页面基址');
        await initContext(context, { storageKey: 'mage-wars-tutorial-touch-inspection', skipTutorial: false });
        const release = await startSourceSession(context, baseURL);
        await reachHeal(page, (element) => element.tap());
        expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
        const before = await readHealingState(page);
        expect(before).toMatchObject({ round: 5, damage: 3, mana: expect.any(Number) });
        const card = page.locator(spell);
        const preview = page.getByTestId('mage-wars-card-magnify-content');
        const close = page.getByTestId('mage-wars-card-magnify-overlay-close');
        const touch = await context.newCDPSession(page);
        const inspect = async () => {
            const bounds = await card.boundingBox();
            if (!bounds) throw new Error('准备区次级治疗牌不可见');
            await touch.send('Input.dispatchTouchEvent', {
                type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }],
            });
            await expect(preview).toHaveAttribute('data-source-card-id', '3402');
            await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            await expect(close).toHaveCSS('opacity', '1');
        };
        await inspect();
        await expectReadableMageWarsPreview(preview);
        await page.screenshot({ path: info.outputPath('01-触屏松手后仍可查看次级治疗.png') });
        await close.tap();
        await expect(preview).toHaveCount(0);
        await expect(page.locator(healStep)).toBeVisible();
        expect(await readHealingState(page)).toEqual(before);
        await page.screenshot({ path: info.outputPath('02-关闭后仍在原治疗步骤.png') });
        await inspect();
        await page.touchscreen.tap(40, 40);
        await expect(preview).toHaveCount(0);
        expect(await readHealingState(page)).toEqual(before);
        await writeFile(info.outputPath('source-identity.json'), JSON.stringify(await captureEvidenceSourceIdentity(page, 'mage-wars'), null, 2));
        await release();
    });
});

test('桌面默认隐藏叉号，悬浮放大牌才可关闭，主动点击遮罩仍可关闭', async ({ context, page, baseURL }, info) => {
    if (!baseURL) throw new Error('检视用例需要正式页面基址');
    await page.setViewportSize({ width: 1366, height: 768 });
    await initContext(context, { storageKey: 'mage-wars-tutorial-desktop-inspection', skipTutorial: false });
    const release = await startSourceSession(context, baseURL);
    await reachHeal(page, (element) => element.click());
    const card = page.locator(spell);
    const inspect = card.locator('xpath=..').getByTestId('mage-wars-card-inspect-button');
    const preview = page.getByTestId('mage-wars-card-magnify-content');
    const close = page.getByTestId('mage-wars-card-magnify-overlay-close');
    await card.hover();
    await expect(inspect).toHaveCSS('opacity', '1');
    await inspect.click();
    await expect(close).toHaveCSS('opacity', '0');
    await expectReadableMageWarsPreview(preview);
    await page.screenshot({ path: info.outputPath('01-桌面初次放大没有常驻叉号.png') });
    await preview.hover();
    await expect(close).toHaveCSS('opacity', '1');
    await page.screenshot({ path: info.outputPath('02-桌面悬浮放大牌显示叉号.png') });
    await close.click();
    await expect(preview).toHaveCount(0);
    await card.hover();
    await inspect.click();
    await page.mouse.click(40, 40);
    await expect(preview).toHaveCount(0);
    await expect(page.locator(healStep)).toBeVisible();
    await writeFile(info.outputPath('source-identity.json'), JSON.stringify(await captureEvidenceSourceIdentity(page, 'mage-wars'), null, 2));
    await release();
});
