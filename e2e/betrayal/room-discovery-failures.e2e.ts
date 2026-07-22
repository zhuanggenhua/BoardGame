import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import type { BetrayalCore } from '../../src/games/betrayal/game';
import {
    BETRAYAL_DISCOVERY_POOLS,
    type BetrayalRoomDiscoveryTemplate,
} from '../../src/games/betrayal/scenarioConfig';
import {
    createRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-core-interactions/room-discovery-failures';
const EXHAUSTED_SCREENSHOT = `${EVIDENCE_DIR}/01-区域房间耗尽提示.jpg`;
const AREA_MISMATCH_SCREENSHOT = `${EVIDENCE_DIR}/02-区域不匹配掩埋提示.jpg`;
const SEALED_REGION_SCREENSHOT = `${EVIDENCE_DIR}/03-封死区域掩埋重抽提示.jpg`;
const TILE_ADJUSTMENT_SCREENSHOT = `${EVIDENCE_DIR}/04-选择调整已有板块并确认.jpg`;

function placeCurrentExplorerInHallway(core: BetrayalCore): void {
    core.drawOrder = ['item'];
    core.currentExplorer = {
        ...core.currentExplorer,
        roomId: 'hallway',
        inventory: [],
    };
    core.activeRoomId = 'hallway';
    core.currentExplorerInventory = [];
    core.movesRemaining = 2;
    core.turnEndedByDiscovery = false;
}

function createAreaMismatchCore(): BetrayalCore {
    const core = createRuntimeCore();
    const upperRoom = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'tower')!;
    const basementRoom = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.find((room) => room.visualId === 'larder')!;
    const groundRoom = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'furnaceRoom')!;
    core.roomDiscoveryDeck = [
        { floor: 'upper', room: upperRoom },
        { floor: 'basement', room: basementRoom },
        { floor: 'ground', room: groundRoom },
    ];
    core.roomDiscoveryOrderByFloor = {
        ground: [groundRoom],
        upper: [upperRoom],
        basement: [basementRoom],
    };
    placeCurrentExplorerInHallway(core);
    return core;
}

function createSealedRegionCore(): BetrayalCore {
    const core = createRuntimeCore();
    const sealedBaseRoom = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'vault')!;
    const openBaseRoom = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'furnaceRoom')!;
    const sealedRoom: BetrayalRoomDiscoveryTemplate = {
        ...sealedBaseRoom,
        name: '测试死路房',
        hint: '测试用：只有入口走廊，会封死当前区域',
        tags: ['测试'],
        doorways: ['south'],
    };
    const openRoom: BetrayalRoomDiscoveryTemplate = {
        ...openBaseRoom,
        name: '测试开放房',
        hint: '测试用：连接入口后仍保留一个开放走廊',
        tags: ['测试'],
        doorways: ['south', 'east'],
    };
    core.roomDiscoveryDeck = [
        { floor: 'ground', room: sealedRoom },
        { floor: 'ground', room: openRoom },
    ];
    core.roomDiscoveryOrderByFloor = {
        ground: [sealedRoom, openRoom],
        upper: [],
        basement: [],
    };
    placeCurrentExplorerInHallway(core);
    core.rooms = core.rooms
        .filter((room) => room.id !== 'ground-south' && room.id !== 'ground-east')
        .map((room) => {
            if (room.id === 'hallway') {
                return {
                    ...room,
                    connectedRoomIds: room.connectedRoomIds.filter((roomId) => roomId !== 'ground-south'),
                    doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'ground-south'),
                };
            }
            if (room.id === 'entrance-hall') {
                return {
                    ...room,
                    connectedRoomIds: room.connectedRoomIds.filter((roomId) => roomId !== 'ground-east'),
                    doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'ground-east'),
                };
            }
            return room;
        });
    return core;
}

function createTileAdjustmentRequiredCore(): BetrayalCore {
    const core = createRuntimeCore();
    const sealedBaseRoom = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'vault')!;
    const sealedRoom: BetrayalRoomDiscoveryTemplate = {
        ...sealedBaseRoom,
        name: '测试最后死路房',
        hint: '测试用：最后一张同区域房间仍会封死当前区域',
        tags: ['测试'],
        doorways: ['south'],
    };
    core.roomDiscoveryDeck = [
        { floor: 'ground', room: sealedRoom },
    ];
    core.roomDiscoveryOrderByFloor = {
        ground: [sealedRoom],
        upper: [],
        basement: [],
    };
    placeCurrentExplorerInHallway(core);
    core.rooms = core.rooms
        .filter((room) => room.id !== 'ground-south' && room.id !== 'ground-east')
        .map((room) => {
            if (room.id === 'hallway') {
                return {
                    ...room,
                    connectedRoomIds: room.connectedRoomIds.filter((roomId) => roomId !== 'ground-south'),
                    doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'ground-south'),
                };
            }
            if (room.id === 'entrance-hall') {
                return {
                    ...room,
                    connectedRoomIds: room.connectedRoomIds.filter((roomId) => roomId !== 'ground-east'),
                    doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'ground-east'),
                };
            }
            return room;
        });
    return core;
}

async function openInjectedBoard(
    page: Page,
    context: BrowserContext,
    core: BetrayalCore,
    diagnosticsLabel: string,
) {
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, diagnosticsLabel);

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
    await waitForBetrayalPageReady(page);

    await injectCore(page, core);
    await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
    return diagnostics;
}

test.describe('山屋惊魂探索失败边界', () => {
    test('区域房间耗尽时真实牌桌显示短提示且不打开放置面板', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-room-discovery-failures');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        const core = createRuntimeCore();
        core.drawOrder = ['item'];
        core.roomDiscoveryDeck = [];
        core.roomDiscoveryOrderByFloor = {
            ground: [],
            upper: [],
            basement: [],
        };
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'hallway',
            inventory: [],
        };
        core.activeRoomId = 'hallway';
        core.currentExplorerInventory = [];
        core.turnEndedByDiscovery = false;
        await injectCore(page, core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });

        await expect(page.getByTestId('betrayal-action-explore')).toBeEnabled();
        await page.getByTestId('betrayal-action-explore').click();
        await expect(page.getByTestId('betrayal-room-explore-target-ground-north')).toBeVisible();
        await page.getByTestId('betrayal-room-ground-north').click();

        await expect(page.getByTestId('betrayal-room-placement-failure')).toContainText('一层房间已耗尽');
        await expect(page.getByTestId('betrayal-room-placement-panel')).toHaveCount(0);
        await saveScreenshot(page, EXHAUSTED_SCREENSHOT);

        const stateAfterFailedPreview = await page.evaluate(() => {
            const snapshot = window.__BG_TEST_HARNESS__?.state?.get?.();
            return {
                movesRemaining: snapshot?.core?.movesRemaining ?? null,
                turnEndedByDiscovery: snapshot?.core?.turnEndedByDiscovery ?? null,
                groundNorthState: snapshot?.core?.rooms?.find((room) => room.id === 'ground-north')?.state ?? null,
            };
        });

        expect(stateAfterFailedPreview).toEqual({
            movesRemaining: core.movesRemaining,
            turnEndedByDiscovery: false,
            groundNorthState: 'unexplored',
        });

        assertNoFatalFrontendErrors([{ label: 'betrayal-room-discovery-failures', diagnostics }]);
    });

    test('区域不匹配房间会在真实牌桌提示已掩埋并继续翻到当前区域', async ({ page, context }) => {
        test.setTimeout(120000);
        const core = createAreaMismatchCore();
        const diagnostics = await openInjectedBoard(
            page,
            context,
            core,
            'betrayal-room-discovery-area-mismatch',
        );

        await expect(page.getByTestId('betrayal-action-explore')).toBeEnabled();
        await page.getByTestId('betrayal-action-explore').click();
        await expect(page.getByTestId('betrayal-room-explore-target-ground-north')).toBeVisible();
        await page.getByTestId('betrayal-room-ground-north').click();

        const placementPanel = page.getByTestId('betrayal-room-placement-panel');
        await expect(placementPanel).toBeVisible();
        await expect(placementPanel).toContainText('火炉房');
        await expect(page.getByTestId('betrayal-room-placement-buried-rooms')).toContainText('已掩埋：塔楼、储物间');
        await saveScreenshot(page, AREA_MISMATCH_SCREENSHOT);

        await page.getByTestId('betrayal-room-placement-confirm').click();
        const stateAfterPlacement = await page.evaluate(() => {
            const snapshot = window.__BG_TEST_HARNESS__?.state?.get?.();
            const room = snapshot?.core?.rooms?.find((candidate) => candidate.id === 'ground-north');
            return {
                placedRoomName: room?.name ?? null,
                latestBuriedRoomNames: snapshot?.core?.latestRoomDrawResolution?.buriedRoomTiles.map((item) => item.name) ?? [],
                buriedRoomNames: snapshot?.core?.buriedRoomTiles.map((item) => item.name) ?? [],
                remainingDeck: snapshot?.core?.roomDiscoveryDeck.map((entry) => `${entry.floor}:${entry.room.name}`) ?? [],
                turnEndedByDiscovery: snapshot?.core?.turnEndedByDiscovery ?? null,
            };
        });

        expect(stateAfterPlacement).toEqual({
            placedRoomName: '火炉房',
            latestBuriedRoomNames: ['塔楼', '储物间'],
            buriedRoomNames: ['塔楼', '储物间'],
            remainingDeck: ['upper:塔楼', 'basement:储物间'],
            turnEndedByDiscovery: true,
        });

        assertNoFatalFrontendErrors([{ label: 'betrayal-room-discovery-area-mismatch', diagnostics }]);
    });

    test('会封死区域的房间会在真实牌桌提示已掩埋并继续重抽', async ({ page, context }) => {
        test.setTimeout(120000);
        const core = createSealedRegionCore();
        const diagnostics = await openInjectedBoard(
            page,
            context,
            core,
            'betrayal-room-discovery-sealed-region',
        );

        await expect(page.getByTestId('betrayal-action-explore')).toBeEnabled();
        await page.getByTestId('betrayal-action-explore').click();
        await expect(page.getByTestId('betrayal-room-explore-target-ground-north')).toBeVisible();
        await page.getByTestId('betrayal-room-ground-north').click();

        const placementPanel = page.getByTestId('betrayal-room-placement-panel');
        await expect(placementPanel).toBeVisible();
        await expect(placementPanel).toContainText('测试开放房');
        await expect(page.getByTestId('betrayal-room-placement-buried-rooms')).toContainText('已掩埋：测试死路房');
        await saveScreenshot(page, SEALED_REGION_SCREENSHOT);

        await page.getByTestId('betrayal-room-placement-confirm').click();
        const stateAfterPlacement = await page.evaluate(() => {
            const snapshot = window.__BG_TEST_HARNESS__?.state?.get?.();
            const room = snapshot?.core?.rooms?.find((candidate) => candidate.id === 'ground-north');
            return {
                placedRoomName: room?.name ?? null,
                latestBuriedRooms: snapshot?.core?.latestRoomDrawResolution?.buriedRoomTiles.map((item) => `${item.name}:${item.reason}`) ?? [],
                buriedRooms: snapshot?.core?.buriedRoomTiles.map((item) => `${item.name}:${item.reason}`) ?? [],
                remainingDeck: snapshot?.core?.roomDiscoveryDeck.map((entry) => `${entry.floor}:${entry.room.name}`) ?? [],
                hasGroundFrontier: snapshot?.core?.rooms.some((candidate) => candidate.floor === 'ground' && candidate.state === 'unexplored') ?? false,
            };
        });

        expect(stateAfterPlacement).toEqual({
            placedRoomName: '测试开放房',
            latestBuriedRooms: ['测试死路房:sealedRegion'],
            buriedRooms: ['测试死路房:sealedRegion'],
            remainingDeck: ['ground:测试死路房'],
            hasGroundFrontier: true,
        });

        assertNoFatalFrontendErrors([{ label: 'betrayal-room-discovery-sealed-region', diagnostics }]);
    });

    test('最后一张同区域房间会封死区域时真实牌桌选择调整已有板块后放置', async ({ page, context }) => {
        test.setTimeout(120000);
        const core = createTileAdjustmentRequiredCore();
        const diagnostics = await openInjectedBoard(
            page,
            context,
            core,
            'betrayal-room-discovery-tile-adjustment-required',
        );

        await expect(page.getByTestId('betrayal-action-explore')).toBeEnabled();
        await page.getByTestId('betrayal-action-explore').click();
        await expect(page.getByTestId('betrayal-room-explore-target-ground-north')).toBeVisible();
        await page.getByTestId('betrayal-room-ground-north').click();

        const placementPanel = page.getByTestId('betrayal-room-placement-panel');
        await expect(placementPanel).toBeVisible();
        await expect(placementPanel).toContainText('测试最后死路房');
        await expect(page.getByTestId('betrayal-room-placement-adjustment-required')).toContainText('需先最小调整本区域已有板块，保留开放走廊');
        await expect(page.getByTestId('betrayal-room-tile-adjustment-options')).toContainText('选择调整板块');
        const adjustmentOption = page.getByTestId('betrayal-room-tile-adjustment-option').first();
        await expect(adjustmentOption).toBeVisible();
        await expect(adjustmentOption).toContainText('调整');
        await expect(adjustmentOption).toContainText('开放走廊');
        await expect(page.getByTestId('betrayal-room-placement-confirm')).toBeDisabled();
        await expect(page.getByTestId('betrayal-room-placement-buried-rooms')).toHaveCount(0);

        const stateAfterBlockedPlacement = await page.evaluate(() => {
            const snapshot = window.__BG_TEST_HARNESS__?.state?.get?.();
            const room = snapshot?.core?.rooms?.find((candidate) => candidate.id === 'ground-north');
            return {
                roomState: room?.state ?? null,
                roomName: room?.name ?? null,
                movesRemaining: snapshot?.core?.movesRemaining ?? null,
                turnEndedByDiscovery: snapshot?.core?.turnEndedByDiscovery ?? null,
                latestRoomDrawResolution: snapshot?.core?.latestRoomDrawResolution ?? null,
            };
        });

        expect(stateAfterBlockedPlacement).toEqual({
            roomState: 'unexplored',
            roomName: '未探索',
            movesRemaining: core.movesRemaining,
            turnEndedByDiscovery: false,
            latestRoomDrawResolution: null,
        });

        await adjustmentOption.click();
        await expect(adjustmentOption).toHaveAttribute('data-selected', 'true');
        await expect(page.getByTestId('betrayal-room-placement-confirm')).toBeEnabled();
        await saveScreenshot(page, TILE_ADJUSTMENT_SCREENSHOT);
        await page.getByTestId('betrayal-room-placement-confirm').click();

        await expect(placementPanel).toHaveCount(0);
        await expect(page.getByTestId('betrayal-room-ground-north')).toContainText('测试最后死路房');

        const stateAfterPlacement = await page.evaluate(() => {
            const snapshot = window.__BG_TEST_HARNESS__?.state?.get?.();
            const rooms = snapshot?.core?.rooms ?? [];
            const roomById = new Map(rooms.map((room) => [room.id, room]));
            const placedRoom = roomById.get('ground-north');
            const hasGroundFrontier = rooms.some((room) => (
                room.floor === 'ground'
                && room.state === 'discovered'
                && room.doorways.some((doorway) => {
                    const connectedRoom = doorway.connectsToRoomId
                        ? roomById.get(doorway.connectsToRoomId)
                        : null;
                    return connectedRoom?.floor === 'ground' && connectedRoom.state === 'unexplored';
                })
            ));
            return {
                placedRoomName: placedRoom?.name ?? null,
                placedRoomState: placedRoom?.state ?? null,
                hasGroundFrontier,
                turnEndedByDiscovery: snapshot?.core?.turnEndedByDiscovery ?? null,
                requiresTileAdjustment: snapshot?.core?.latestRoomDrawResolution?.requiresTileAdjustment ?? null,
                latestLog: snapshot?.core?.activityLog?.[0]?.text ?? null,
            };
        });

        expect(stateAfterPlacement).toEqual({
            placedRoomName: '测试最后死路房',
            placedRoomState: 'discovered',
            hasGroundFrontier: true,
            turnEndedByDiscovery: true,
            requiresTileAdjustment: true,
            latestLog: expect.stringContaining('先调整房间板块'),
        });

        assertNoFatalFrontendErrors([{ label: 'betrayal-room-discovery-tile-adjustment-required', diagnostics }]);
    });
});
