import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { injectCore, initBetrayalContext, saveScreenshot, waitForBetrayalPageReady, warmBetrayalFrontend } from './betrayalTestHelpers';
import { attachPageDiagnostics, assertNoFatalFrontendErrors } from '../helpers/common';
import { BETRAYAL_COMMANDS } from '../../src/games/betrayal/commands';
import { resolveBetrayalMonsterMovementGroups, resolveBetrayalMonsterMoveTargetRooms } from '../../src/games/betrayal/monsterActionReadModel';
import { applyBetrayalCommand, BETRAYAL_FIXED_RANDOM, createMummyMonsterMoveReadyTutorialCore } from '../../src/games/betrayal/testing/firstScenarioTestUtils';

// Independent natural-entry camera contract. Staging is diagnostic until visual review.
const staging = `test-results/betrayal-3d/camera-${Date.now()}`;
test.use({
    viewport: { width: 1600, height: 900 },
    launchOptions: {
        executablePath: process.env.PW_BROWSER_EXECUTABLE,
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
});

async function openMatch(page: Page, context: BrowserContext) {
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, 'betrayal-three-map');
    await warmBetrayalFrontend(context);
    await page.goto('/play/betrayal?players=3&seat0=human&seat1=local-ai&seat2=local-ai&playerID=0');
    await waitForBetrayalPageReady(page);
    const confirm = page.getByTestId('betrayal-character-confirm');
    await confirm.click();
    await page.getByTestId('betrayal-character-scenario-button').click();
    await page.getByTestId('betrayal-scenario-option-mummy-rampage').click();
    await page.getByTestId('betrayal-scenario-select-current').click();
    const opening = page.getByTestId('betrayal-start-scenario-opening-stage');
    for (const label of [/确认此剧本卡/, /开始剧本/]) {
        await expect.poll(async () => await opening.isVisible() || ((await confirm.isVisible()) && await confirm.isEnabled())).toBe(true);
        if (await opening.isVisible()) break;
        if (label.test(await confirm.textContent() ?? '')) await confirm.click();
    }
    await expect(opening).toBeVisible({ timeout: 30000 });
    await page.getByTestId('betrayal-start-scenario-opening-continue').click();
    await expect(opening).toHaveCount(0);
    const intro = page.getByTestId('betrayal-turn-intro-skip');
    if (await intro.isVisible()) await intro.click();
    await expect(intro).toHaveCount(0);
    const canvas = page.getByTestId('betrayal-three-map-canvas');
    await expect(canvas).toBeVisible();
    await expect(canvas.locator('..')).toHaveAttribute('data-map-resource-status', 'ready', { timeout: 30000 });
    const grid = page.getByTestId('betrayal-room-grid');
    await expect(grid).toHaveAttribute('data-visible-explorer-models', '3', { timeout: 30000 });
    await expect(grid).toHaveAttribute('data-detailed-figure-models', '0');
    return { grid, diagnostics };
}

function readPose(grid: ReturnType<Page['getByTestId']>) {
    return grid.evaluate(el => ({
        x: Number(el.dataset.panX), y: Number(el.dataset.panY),
        zoom: Number(el.dataset.zoom), bearing: Number(el.dataset.cameraBearing),
    }));
}

async function expectNearFigures(grid: ReturnType<Page['getByTestId']>, tableTriangles: string) {
    await expect(grid).not.toHaveAttribute('data-detailed-figure-models', '0');
    await expect.poll(async () => Number(await grid.getAttribute('data-rendered-figure-triangles')))
        .toBeGreaterThan(Number(tableTriangles));
}

async function expectSceneMove(page: Page, grid: ReturnType<Page['getByTestId']>) {
    await expect(page.locator('[data-testid="betrayal-visual-transition-blocker"][data-transition-kind="explorer-move"]')).toHaveCount(0);
    await expect(grid).toHaveAttribute('data-visible-explorer-models', '3');
    await expect(page.getByTestId('betrayal-room-occupant-hallway-0')).toBeVisible();
}

test('小黑屋正式对局加载角色模型，旋转、平移和缩放后仍能进房', async ({ page, context }) => {
    test.setTimeout(180000);
    const { grid, diagnostics } = await openMatch(page, context);
    const pose = () => readPose(grid);
    const tableTriangles = (await grid.getAttribute('data-rendered-figure-triangles'))!;
    expect(Number(tableTriangles)).toBeGreaterThan(20_900);
    expect(Number(tableTriangles)).toBeLessThanOrEqual(21_000);
    await expect.poll(async () => (await pose()).zoom).toBeGreaterThan(0);
    await saveScreenshot(page, `${staging}/01-开局房间与棋子.png`);
    const before = await pose();
    await page.mouse.move(860, 280);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(820, 310, { steps: 5 });
    await page.mouse.up({ button: 'right' });
    await expect.poll(async () => Math.abs((await pose()).bearing - before.bearing)).toBeGreaterThan(.15);
    const beforePan = await pose();
    await page.mouse.move(860, 300);
    await page.mouse.down();
    await page.mouse.move(965, 380, { steps: 12 });
    await page.mouse.up();
    await expect.poll(async () => (await pose()).x - beforePan.x).toBeGreaterThan(80);
    await expect.poll(async () => (await pose()).y - beforePan.y).toBeGreaterThan(60);
    await saveScreenshot(page, `${staging}/02-旋转并平移.png`);
    const beforeZoom = await pose();
    const hallway = page.getByTestId('betrayal-room-hallway');
    const hallwayRect = await hallway.boundingBox();
    expect(hallwayRect).not.toBeNull();
    const anchor = { x: hallwayRect!.x + hallwayRect!.width / 2, y: hallwayRect!.y + hallwayRect!.height / 2 };
    await page.mouse.move(anchor.x, anchor.y);
    await page.mouse.wheel(0, -650);
    await expect.poll(async () => (await pose()).zoom).toBeGreaterThan(beforeZoom.zoom + 0.03);
    await expectNearFigures(grid, tableTriangles);
    const zoomedRect = (await hallway.boundingBox())!;
    expect(Math.abs(zoomedRect.x + zoomedRect.width / 2 - anchor.x)).toBeLessThan(2);
    expect(Math.abs(zoomedRect.y + zoomedRect.height / 2 - anchor.y)).toBeLessThan(2);
    await saveScreenshot(page, `${staging}/03-放大后显示近景网格.png`);
    await page.mouse.wheel(0, 255);
    await expect.poll(async () => (await pose()).zoom).toBeLessThan(1.65);
    expect((await pose()).zoom).toBeGreaterThan(1.45);
    await expect(grid).toHaveAttribute('data-detailed-figure-models', '3');
    await page.mouse.wheel(0, 230);
    await expect(grid).toHaveAttribute('data-detailed-figure-models', '0');
    await expect(grid).toHaveAttribute('data-rendered-figure-triangles', tableTriangles);
    await hallway.click();
    await expectSceneMove(page, grid);
    await saveScreenshot(page, `${staging}/04-缩回棋桌后移动.png`);
    assertNoFatalFrontendErrors([{ label: 'betrayal-three-map', diagnostics }]);
});

test.describe('手机横屏', () => {
    test.use({ viewport: { width: 936, height: 432 }, hasTouch: true, deviceScaleFactor: 2 });

    test('双指转桌和缩放后，用触屏选择房间', async ({ page, context }) => {
        test.setTimeout(180000);
        const { grid, diagnostics } = await openMatch(page, context);
        const before = await readPose(grid);
        const tableTriangles = (await grid.getAttribute('data-rendered-figure-triangles'))!;
        await saveScreenshot(page, `${staging}/05-横屏开局.png`);
        const hallway = page.getByTestId('betrayal-room-hallway');
        const box = (await hallway.boundingBox())!;
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        const touch = await context.newCDPSession(page);
        await touch.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: x - 30, y, id: 1 }, { x: x + 30, y, id: 2 }],
        });
        for (const distance of [40, 65, 100]) {
            await touch.send('Input.dispatchTouchEvent', {
                type: 'touchMove',
                touchPoints: [{ x: x - distance, y: y - distance / 4, id: 1 }, { x: x + distance, y: y + distance / 4, id: 2 }],
            });
        }
        await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await expect.poll(async () => (await readPose(grid)).zoom).toBeGreaterThan(before.zoom + .1);
        await expect.poll(async () => Math.abs((await readPose(grid)).bearing - before.bearing)).toBeGreaterThan(.12);
        await expectNearFigures(grid, tableTriangles);
        const zoomed = (await hallway.boundingBox())!;
        expect(Math.abs(zoomed.x + zoomed.width / 2 - x)).toBeLessThan(3);
        expect(Math.abs(zoomed.y + zoomed.height / 2 - y)).toBeLessThan(3);
        await hallway.tap();
        await expectSceneMove(page, grid);
        await saveScreenshot(page, `${staging}/06-横屏近景触控移动.png`);
        assertNoFatalFrontendErrors([{ label: 'betrayal-three-map-touch', diagnostics }]);
    });
});

test('木乃伊模型随正式移动入口从仪式室到地下室起始处', async ({ page, context }) => {
    test.setTimeout(120000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, 'betrayal-three-monster');
    let core = createMummyMonsterMoveReadyTutorialCore();
    const mummyId = core.scenarioRuntime.mummy!.mummyMonsterId;
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START, core.currentPlayer, { monsterId: mummyId });
    const [movementGroup] = resolveBetrayalMonsterMovementGroups(core);
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP, core.currentPlayer,
        { groupId: movementGroup.groupId }, 200, { ...BETRAYAL_FIXED_RANDOM, random: () => 0 });

    await page.goto(`/play/betrayal?players=3&seat0=human&seat1=human&seat2=human&playerID=${core.currentPlayer}`);
    await waitForBetrayalPageReady(page);
    await injectCore(page, core);
    const grid = page.getByTestId('betrayal-room-grid');
    await expect(grid).toHaveAttribute('data-map-renderer', 'three');
    await expect(grid).toHaveAttribute('data-visible-monster-models', '1', { timeout: 30000 });
    await expect(grid).toHaveAttribute('data-detailed-figure-models', '0');
    const tableTriangles = (await grid.getAttribute('data-rendered-figure-triangles'))!;
    await expect(page.getByTestId('betrayal-turn-intro-skip')).toHaveCount(0, { timeout: 10000 });
    const confirmRoll = page.getByTestId('betrayal-roll-continue');
    await expect(confirmRoll).toBeEnabled({ timeout: 20000 });
    await confirmRoll.click();
    await expect(page.getByTestId('betrayal-roll-result-dock')).toHaveCount(0);

    const sourceId = core.monsters.find(monster => monster.id === mummyId)!.roomId;
    const floor = core.rooms.find(room => room.id === sourceId)!.floor;
    const destination = resolveBetrayalMonsterMoveTargetRooms(core, mummyId)
        .find(room => room.floor === floor && room.id !== sourceId)!;
    const source = page.getByTestId(`betrayal-room-monster-${sourceId}-${mummyId}`);
    await expect(source).toBeVisible();
    const room = (await page.getByTestId(`betrayal-room-${sourceId}`).boundingBox())!;
    await page.mouse.move(room.x + room.width / 2, room.y + room.height / 2);
    await page.mouse.wheel(0, -480);
    await expect.poll(async () => Number(await grid.getAttribute('data-zoom'))).toBeGreaterThan(1.5);
    await expectNearFigures(grid, tableTriangles);
    await saveScreenshot(page, `${staging}/07-木乃伊近景.png`);

    const moveTarget = page.getByTestId(`betrayal-room-monster-move-target-${destination.id}`);
    if (!(await moveTarget.isVisible())) {
        const move = page.getByTestId('betrayal-action-monsterMove');
        if (await move.isVisible()) await move.click();
        if (!(await moveTarget.isVisible())) await source.click();
    }
    await expect(moveTarget).toBeVisible();
    await page.getByTestId(`betrayal-room-${destination.id}`).click();
    await expect(source).toHaveCount(0);
    await expect(page.getByTestId(`betrayal-room-monster-${destination.id}-${mummyId}`)).toBeVisible();
    await expect(grid).toHaveAttribute('data-visible-monster-models', '1');
    await saveScreenshot(page, `${staging}/08-木乃伊模型移动后.png`, { waitMs: 500 });
    assertNoFatalFrontendErrors([{ label: 'betrayal-three-monster', diagnostics }]);
});
