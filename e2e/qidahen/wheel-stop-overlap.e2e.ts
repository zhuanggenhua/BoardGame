import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { disableAudio, disableTutorial, setChineseLocale } from '../helpers/common';

test('轮盘停格前同一落点的三种步数均可选择并按代价结算', async ({ page }) => {
    test.setTimeout(90000);
    await setChineseLocale(page);
    await disableAudio(page);
    await disableTutorial(page);
    await page.addInitScript(() => { (window as any).__E2E_TEST_MODE__ = true; });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/play/qidahen?tutorialSetup=basic-opening&players=3&seat0=human&seat1=human&seat2=human&playerID=0');
    await expect(page.getByTestId('qidahen-board')).toBeVisible({ timeout: 30000 });
    await page.waitForFunction(() => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.());
    await page.evaluate(async () => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = structuredClone(harness.state.get());
        state.core.actionWheelPosition = 'wheel-diplomacy-hire-2';
        state.core.wheelActionUsed = false;
        state.core.selectedWheelMoveId = 'move-1-free';
        state.core.currentPlayer = state.core.factions.ming.playerId;
        await harness.state.set(state);
    });
    const initial = await page.evaluate(() => structuredClone((window as any).__BG_TEST_HARNESS__.state.get()));
    const choices = ['move-1-free', 'move-2-one-opponent', 'move-3-all-opponents'];
    const labels = ['免费走 1', '一名对手抽 2，走 2', '所有对手抽 2，走 3'];
    await expect(page.getByTestId('qidahen-wheel-overlap-legend')).toContainText('1 免费');
    await expect(page.getByTestId('qidahen-wheel-overlap-legend')).toContainText('2 一人抽2');
    await expect(page.getByTestId('qidahen-wheel-overlap-legend')).toContainText('3 对手各抽2');
    const paths = await Promise.all(choices.map(id => page.getByTestId(`qidahen-wheel-move-target-${id}`).getAttribute('d')));
    expect(new Set(paths).size, '同一落点的三个行动应有不同点击区域').toBe(3);
    for (const [index, id] of choices.entries()) {
        const target = page.getByTestId(`qidahen-wheel-move-target-${id}`);
        await expect(target).toBeVisible();
        const label = page.getByTestId(`qidahen-wheel-overlap-label-${id}`);
        await expect(label).toBeAttached({ timeout: 10000 });
        const box = await label.boundingBox();
        expect(box).not.toBeNull();
        const x = box!.x + box!.width / 2, y = box!.y + box!.height / 2;
        await page.mouse.move(x, y);
        expect(await page.evaluate(({ x: pointX, y: pointY }) => document.elementFromPoint(pointX, pointY)?.getAttribute('data-testid'), { x, y })).toBe(`qidahen-wheel-move-target-${id}`);
        await expect(page.getByTestId('qidahen-wheel-tip')).toContainText(labels[index]);
    }
    await page.mouse.move(20, 20);
    mkdirSync('.tmp', { recursive: true });
    await page.screenshot({ path: '.tmp/qidahen-wheel-stop-current.png', animations: 'disabled' });
    const label = await page.getByTestId('qidahen-wheel-overlap-label-move-1-free').boundingBox();
    expect(label).not.toBeNull();
    await page.mouse.click(label!.x + label!.width / 2, label!.y + label!.height / 2);
    await expect.poll(async () => page.evaluate(() => (window as any).__BG_TEST_HARNESS__.state.get().core.actionWheelPosition),
        { timeout: 15000 }).toBe('wheel-new-year');
    for (const [id, recipients] of [
        ['move-2-one-opponent', ['mongol']],
        ['move-3-all-opponents', ['mongol', 'jin']],
    ] as const) {
        await page.evaluate(async state => (window as any).__BG_TEST_HARNESS__.state.set(state), initial);
        const paidLabel = page.getByTestId(`qidahen-wheel-overlap-label-${id}`);
        await expect(paidLabel).toBeAttached();
        const paidBox = await paidLabel.boundingBox();
        expect(paidBox).not.toBeNull();
        await page.mouse.click(paidBox!.x + paidBox!.width / 2, paidBox!.y + paidBox!.height / 2);
        if (id === 'move-2-one-opponent') await page.getByTestId('qidahen-wheel-opponent-mongol').click();
        await expect.poll(async () => page.evaluate(() => (window as any).__BG_TEST_HARNESS__.state.get().core.actionWheelPosition),
            { timeout: 15000 }).toBe('wheel-new-year');
        const result = await page.evaluate(() => (window as any).__BG_TEST_HARNESS__.state.get().core);
        for (const faction of ['mongol', 'jin'] as const) {
            expect(result.factions[faction].handCount).toBe(initial.core.factions[faction].handCount + (recipients.some(recipient => recipient === faction) ? 2 : 0));
        }
    }
});
