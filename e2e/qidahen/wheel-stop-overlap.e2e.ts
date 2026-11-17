import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { disableAudio, disableTutorial, setChineseLocale } from '../helpers/common';
import { getQidahenRuntimeRegionAnchorTargetPoint } from '../../src/games/qidahen/ui/mapGraph';

async function clickVisibleCandidateRegion(page: Page): Promise<string> {
    const overlay = page.getByTestId('qidahen-map-region-mask-overlay');
    await expect(overlay).toHaveAttribute('data-qidahen-candidate-region-ids', /.+/);
    const ids = (await overlay.getAttribute('data-qidahen-candidate-region-ids'))!.split('|');
    const map = page.getByTestId('qidahen-map-content');
    const box = await map.boundingBox();
    const size = await map.evaluate(element => ({ width: element.offsetWidth, height: element.offsetHeight }));
    expect(box).not.toBeNull();
    const points = ids.flatMap(id => {
        const point = getQidahenRuntimeRegionAnchorTargetPoint(id);
        return point ? [{ id, x: box!.x + point.x * box!.width / size.width, y: box!.y + point.y * box!.height / size.height }] : [];
    });
    const target = await page.evaluate(items => items.find(({ x, y }) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight
        && document.elementFromPoint(x, y)?.getAttribute('data-testid') === 'qidahen-map-hitmap-canvas'), points);
    expect(target, `屏幕上应有可点击的合法区域: ${ids.join(', ')}`).toBeTruthy();
    await page.mouse.click(target!.x, target!.y);
    return target!.id;
}

async function selectPaymentCard(page: Page): Promise<void> {
    const cards = page.locator('button[data-testid^="qidahen-hand-card-"]:not([data-testid^="qidahen-hand-card-magnify-"])');
    await expect(cards.first()).toBeVisible();
    for (let i = 0; i < await cards.count(); i++) {
        const card = cards.nth(i);
        if (!await card.isEnabled()) continue;
        const point = await card.evaluate(element => {
            const r = element.getBoundingClientRect();
            for (const y of [0.08, 0.15, 0.25, 0.35]) for (const x of [0.5, 0.25, 0.75]) {
                const hit = document.elementFromPoint(r.left + r.width * x, r.top + r.height * y);
                if (hit && element.contains(hit)) return { x: r.width * x, y: r.height * y };
            }
            return null;
        });
        if (point) { await card.click({ position: point }); return; }
    }
    throw new Error('没有可点击的支付手牌');
}

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
    await page.screenshot({ path: process.env.QIDAHEN_WHEEL_OVERLAP_SCREENSHOT ?? '.tmp/qidahen-wheel-stop-current.png', animations: 'disabled' });
    const label = await page.getByTestId('qidahen-wheel-overlap-label-move-1-free').boundingBox();
    expect(label).not.toBeNull();
    await page.mouse.click(label!.x + label!.width / 2, label!.y + label!.height / 2);
    await expect.poll(async () => page.evaluate(() => (window as any).__BG_TEST_HARNESS__.state.get().core.actionWheelPosition),
        { timeout: 15000 }).toBe('wheel-new-year');
    const branchResults: Array<{ moveId: string; opponent: string | null; position: string; handDeltas: Record<string, number> }> = [];
    for (const [id, opponent, recipients] of [
        ['move-2-one-opponent', 'mongol', ['mongol']],
        ['move-2-one-opponent', 'jin', ['jin']],
        ['move-3-all-opponents', null, ['mongol', 'jin']],
    ] as const) {
        await page.evaluate(async state => (window as any).__BG_TEST_HARNESS__.state.set(state), initial);
        const paidLabel = page.getByTestId(`qidahen-wheel-overlap-label-${id}`);
        await expect(paidLabel).toBeAttached();
        const paidBox = await paidLabel.boundingBox();
        expect(paidBox).not.toBeNull();
        await page.mouse.click(paidBox!.x + paidBox!.width / 2, paidBox!.y + paidBox!.height / 2);
        if (opponent) await page.getByTestId(`qidahen-wheel-opponent-${opponent}`).click();
        await expect.poll(async () => page.evaluate(() => (window as any).__BG_TEST_HARNESS__.state.get().core.actionWheelPosition),
            { timeout: 15000 }).toBe('wheel-new-year');
        const result = await page.evaluate(() => (window as any).__BG_TEST_HARNESS__.state.get().core);
        for (const faction of ['mongol', 'jin'] as const) {
            expect(result.factions[faction].handCount).toBe(initial.core.factions[faction].handCount + (recipients.some(recipient => recipient === faction) ? 2 : 0));
        }
        branchResults.push({ moveId: id, opponent, position: result.actionWheelPosition,
            handDeltas: Object.fromEntries((['mongol', 'jin'] as const).map(faction => [faction, result.factions[faction].handCount - initial.core.factions[faction].handCount])) });
    }
    if (process.env.QIDAHEN_WHEEL_EVIDENCE) writeFileSync(process.env.QIDAHEN_WHEEL_EVIDENCE, JSON.stringify({
        mode: 'injected-representative-state', initialPosition: initial.core.actionWheelPosition, branchResults,
    }, null, 2));
});

for (const branch of [
    { moveId: 'move-2-one-opponent', opponent: 'ming', destination: 'wheel-recruit-train', deltas: { ming: 2, jin: 0 } },
    { moveId: 'move-2-one-opponent', opponent: 'jin', destination: 'wheel-recruit-train', deltas: { ming: 0, jin: 2 } },
    { moveId: 'move-3-all-opponents', opponent: null, destination: 'wheel-military-farm', deltas: { ming: 2, jin: 2 } },
] as const) {
    test(`教学开局局面独立验证 ${branch.moveId} ${branch.opponent ?? 'all'} 的落点和抽牌`, async ({ page }) => {
        test.setTimeout(90_000);
        await setChineseLocale(page); await disableAudio(page); await disableTutorial(page);
        await page.addInitScript(() => { (window as any).__E2E_TEST_MODE__ = true; });
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen?tutorialSetup=basic-opening&players=3&seat0=human&seat1=human&seat2=human&playerID=1');
        await expect(page.getByTestId('qidahen-board')).toBeVisible({ timeout: 30_000 });
        await page.waitForFunction(() => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.());
        const initial = await page.evaluate(() => structuredClone((window as any).__BG_TEST_HARNESS__.state.get().core));
        expect(initial.actionWheelPosition).toBe('wheel-new-year');
        expect(initial.currentPlayer).toBe(initial.factions.mongol.playerId);
        await page.getByTestId(`qidahen-wheel-move-target-${branch.moveId}`).click();
        if (branch.opponent) await page.getByTestId(`qidahen-wheel-opponent-${branch.opponent}`).click();
        await expect.poll(() => page.evaluate(() => (window as any).__BG_TEST_HARNESS__.state.get().core.actionWheelPosition))
            .toBe(branch.destination);
        const result = await page.evaluate(() => structuredClone((window as any).__BG_TEST_HARNESS__.state.get().core));
        for (const faction of ['ming', 'jin'] as const) {
            expect(result.factions[faction].handCount - initial.factions[faction].handCount).toBe(branch.deltas[faction]);
        }
        const availableActions = branch.destination === 'wheel-recruit-train' ? ['recruit-train'] : ['reclaim', 'military-farm'];
        for (const action of availableActions) await expect(page.getByTestId(`qidahen-turn-option-${action}`)).toBeVisible();
        let actionResult: Record<string, unknown>;
        if (branch.destination === 'wheel-recruit-train') {
            await page.getByTestId('qidahen-turn-option-recruit-train').click();
            await selectPaymentCard(page);
            await page.getByTestId('qidahen-wheel-recruit-train-payment-confirm').click();
            await page.getByTestId('qidahen-wheel-recruit-train-choice-action%3Arecruit').click();
            const target = await clickVisibleCandidateRegion(page);
            await expect.poll(() => page.evaluate(() => (window as any).__BG_TEST_HARNESS__.state.get().core.wheelRecruitTrainProgress?.actionsCompleted)).toBe(1);
            const recruited = await page.evaluate(() => structuredClone((window as any).__BG_TEST_HARNESS__.state.get().core));
            expect(recruited.factions.mongol.handCount).toBe(result.factions.mongol.handCount - 1);
            expect(recruited.factions.mongol.troops).toBe(result.factions.mongol.troops + 1);
            expect(recruited.regions.find((region: { id: string }) => region.id === target).troops)
                .toBe(result.regions.find((region: { id: string }) => region.id === target).troops + 1);
            const levelTwoInTarget = (core: typeof result) => core.pieces.filter((piece: { faction: string; regionId: string; level: number }) =>
                piece.faction === 'mongol' && piece.regionId === target && piece.level === 2).length;
            expect(levelTwoInTarget(recruited)).toBe(levelTwoInTarget(result) + 1);
            await page.getByTestId('qidahen-wheel-recruit-train-choice-finish').click();
            await expect.poll(() => page.evaluate(() => (window as any).__BG_TEST_HARNESS__.state.get().core.wheelRecruitTrainProgress)).toBeNull();
            actionResult = { action: 'recruit', target, handDelta: -1, troopDelta: 1 };
        } else {
            await page.getByTestId('qidahen-turn-option-military-farm').click();
            const target = await clickVisibleCandidateRegion(page);
            const confirm = page.getByTestId('qidahen-turn-confirm');
            if (await confirm.isVisible()) await confirm.click();
            await expect.poll(() => page.evaluate(({ target, original }) => {
                const region = (window as any).__BG_TEST_HARNESS__.state.get().core.regions.find((item: { id: string }) => item.id === target);
                return region.troops - original;
            }, { target, original: result.regions.find((region: { id: string }) => region.id === target).troops })).toBe(1);
            actionResult = { action: 'military-farm', target, troopDelta: 1 };
        }
        await page.getByTestId('qidahen-turn-option-finish-slot').click();
        // 剩余手牌行动要先处理，之后才完成轮盘并交接回合。
        await expect(page.getByTestId('qidahen-turn-option-skip-hand')).toBeVisible();
        await page.getByTestId('qidahen-turn-option-skip-hand').click();
        await expect.poll(() => page.evaluate(() => (window as any).__BG_TEST_HARNESS__.state.get().core.currentPlayer)).not.toBe(initial.currentPlayer);
        if (process.env.QIDAHEN_WHEEL_OPENING_EVIDENCE) {
            mkdirSync(process.env.QIDAHEN_WHEEL_OPENING_EVIDENCE, { recursive: true });
            writeFileSync(`${process.env.QIDAHEN_WHEEL_OPENING_EVIDENCE}/${branch.moveId}-${branch.opponent ?? 'all'}.json`, JSON.stringify({
                mode: 'tutorial-setup-without-tutorial', actor: 'mongol', initialPosition: initial.actionWheelPosition,
                moveId: branch.moveId, opponent: branch.opponent, position: result.actionWheelPosition,
                availableActions, actionResult,
                handDeltas: Object.fromEntries((['ming', 'jin'] as const).map(faction => [faction, result.factions[faction].handCount - initial.factions[faction].handCount])),
            }, null, 2));
        }
    });
}
