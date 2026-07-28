import { expect, test, type Page } from '@playwright/test';
import {
    DEFAULT_BETRAYAL_SCENARIO_CARD_ID,
} from '../../src/games/betrayal/scenarioConfig';
import {
    resolveExplorableRoomSlots,
    type BetrayalCore,
} from '../../src/games/betrayal/game';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/山屋惊魂-作祟后探索与跳过事件完整链路';
const HAUNT_TRAITOR_READY_SCREENSHOT = `${EVIDENCE_DIR}/01-作祟后叛徒牌桌可探索.jpg`;
const TRAITOR_EVENT_SKIP_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/02-跳过事件声明已选中.jpg`;
const HAUNT_EXPLORE_TARGET_SCREENSHOT = `${EVIDENCE_DIR}/03-作祟后探索目标高亮.jpg`;
const TRAITOR_EVENT_SKIPPED_SCREENSHOT = `${EVIDENCE_DIR}/04-跳过事件结果可见.jpg`;
const HAUNT_EXPLORE_DISMISSED_SCREENSHOT = `${EVIDENCE_DIR}/05-关闭结果后仍停留作祟牌桌.jpg`;
const NORMAL_EVENT_READY_SCREENSHOT = `${EVIDENCE_DIR}/06-未选择跳过事件前.jpg`;
const NORMAL_EVENT_RESULT_SCREENSHOT = `${EVIDENCE_DIR}/07-未选择跳过事件时正常结算.jpg`;
const NORMAL_EVENT_DISMISSED_SCREENSHOT = `${EVIDENCE_DIR}/08-正常事件关闭后仍停留作祟牌桌.jpg`;

const cloneExplorer = (
    explorer: BetrayalCore['currentExplorer'],
): BetrayalCore['currentExplorer'] => ({
    ...explorer,
    traits: { ...explorer.traits },
    traitTracks: Object.fromEntries(
        Object.entries(explorer.traitTracks).map(([trait, track]) => [
            trait,
            { ...track, values: [...track.values] },
        ]),
    ) as BetrayalCore['currentExplorer']['traitTracks'],
    inventory: explorer.inventory.map((card) => ({ ...card })),
});

const activateExplorer = (core: BetrayalCore, playerId: string) => {
    const explorers = [core.currentExplorer, ...core.otherExplorers].map(cloneExplorer);
    const actor = explorers.find((explorer) => explorer.playerId === playerId);
    if (!actor) {
        throw new Error(`山屋 E2E 夹具缺少玩家 ${playerId}`);
    }
    core.currentPlayer = playerId;
    core.currentExplorer = actor;
    core.otherExplorers = explorers.filter((explorer) => explorer.playerId !== playerId);
    core.activeRoomId = actor.roomId;
    core.currentExplorerRoomId = actor.roomId;
    core.currentExplorerTraits = { ...actor.traits };
    core.currentExplorerInventory = actor.inventory.map((card) => ({ ...card }));
    core.turnStartInventoryCardIds = actor.inventory.map((card) => card.id);
};

const createTraitorHauntExploreRuntimeCore = (): BetrayalCore => {
    const core = createRuntimeCore();
    core.phase = 'haunt';
    core.scenarioRuntime.hauntTriggered = true;
    core.scenarioRuntime.hauntRevealerPlayerId = '0';
    core.scenarioRuntime.traitorPlayerId = '0';
    core.scenarioRuntime.nextHauntPlayerId = '0';
    core.scenarioRuntime.hauntCardNumber = 1;
    core.scenarioRuntime.hauntTriggerLabel = '测试作祟';
    core.scenarioRuntime.hauntScenarioCardId = DEFAULT_BETRAYAL_SCENARIO_CARD_ID;
    core.scenarioRuntime.hauntScenarioCardTitle = '赤红杰克归来';
    core.scenarioRuntime.hauntScenarioCardLabel = '作祟 1';
    core.scenarioRuntime.triggeringOmenName = '测试恶兆';
    activateExplorer(core, '0');
    core.currentExplorer = {
        ...core.currentExplorer,
        roomId: 'entrance-hall',
        inventory: [],
    };
    core.activeRoomId = 'entrance-hall';
    core.currentExplorerRoomId = 'entrance-hall';
    core.currentExplorerInventory = [];
    core.turnStartInventoryCardIds = [];
    core.drawOrder = ['event'];
    core.eventOrder = [
        {
            name: '阴影扑面',
            text: '阴影扑向你。失去 1 点力量。',
            effect: { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
        },
    ];
    core.deckCounts.event = core.eventOrder.length;
    core.turnEndedByDiscovery = false;
    core.latestDiscovery = null;
    core.latestDiscoveryOwnerPlayerId = null;
    core.pendingEventChoice = null;
    core.recentRoll = null;
    core.turnStartSpeed = Math.max(core.currentExplorer.traits.speed, 1);
    core.movesRemaining = core.turnStartSpeed;
    return core;
};

const confirmPendingRoomPlacement = async (page: Page) => {
    const placementPanel = page.getByTestId('betrayal-room-placement-panel');
    await expect(placementPanel).toBeVisible({ timeout: 30000 });
    await page.getByTestId('betrayal-room-placement-confirm').click();
    await expect(placementPanel).toHaveCount(0);
};

const expectNearViewportCenter = async (
    page: Page,
    testId: string,
    maxDeltaPx = 24,
) => {
    const metrics = await page.evaluate((targetTestId) => {
        const elements = Array.from(document.querySelectorAll(`[data-testid="${targetTestId}"]`));
        const viewportCenterX = window.innerWidth / 2;
        const rects = elements.map((element) => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            const visible = rect.width > 0
                && rect.height > 0
                && style.visibility !== 'hidden'
                && style.display !== 'none'
                && Number(style.opacity) !== 0;
            const centerX = rect.left + rect.width / 2;
            return {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                centerX,
                deltaX: Math.abs(centerX - viewportCenterX),
                visible,
                text: element.textContent?.trim() ?? '',
            };
        });
        const visibleRects = rects.filter((rect) => rect.visible);
        const nearestVisibleRect = visibleRects
            .sort((a, b) => a.deltaX - b.deltaX)[0] ?? null;
        return {
            viewportWidth: window.innerWidth,
            viewportCenterX,
            rects,
            nearestVisibleRect,
        };
    }, testId);
    expect(
        metrics.nearestVisibleRect,
        `${testId} 必须有可见元素以检查居中位置：${JSON.stringify(metrics)}`,
    ).toBeTruthy();
    if (!metrics.nearestVisibleRect) {
        return;
    }
    expect(
        metrics.nearestVisibleRect.deltaX,
        `${testId} 应接近视口中心：${JSON.stringify(metrics)}`,
    ).toBeLessThanOrEqual(maxDeltaPx);
};

const waitForInjectedTraitorHauntCore = async (page: Page, targetRoomId: string) => {
    const readStatus = async () => page.evaluate((expectedRoomId) => {
            const core = (window as Window & {
                __BG_TEST_HARNESS__?: { state?: { get?: () => { core: {
                    currentPlayer: string;
                    currentExplorer: { playerId: string; roomId: string; displayName?: string; inventory: unknown[] };
                    activeRoomId: string;
                    phase: string;
                    scenarioRuntime: { hauntTriggered?: boolean; traitorPlayerId?: string | null };
                    recentRoll: unknown;
                    latestDiscovery: unknown;
                    currentExplorerInventory: unknown[];
                    rooms: Array<{ id: string; state: string }>;
                } } } };
            }).__BG_TEST_HARNESS__?.state?.get?.().core;
            const targetRoom = core?.rooms.find((room) => room.id === expectedRoomId);
            return {
                ok: Boolean(
                core &&
                core.phase === 'haunt' &&
                core.currentPlayer === '0' &&
                core.currentExplorer.playerId === '0' &&
                core.currentExplorer.roomId === 'entrance-hall' &&
                core.activeRoomId === 'entrance-hall' &&
                core.currentExplorer.inventory.length === 0 &&
                core.currentExplorerInventory.length === 0 &&
                core.scenarioRuntime.hauntTriggered &&
                core.scenarioRuntime.traitorPlayerId === '0' &&
                core.recentRoll === null &&
                core.latestDiscovery === null &&
                targetRoom?.state === 'unexplored',
                ),
                core: core
                    ? {
                        phase: core.phase,
                        currentPlayer: core.currentPlayer,
                        explorerPlayerId: core.currentExplorer.playerId,
                        explorerName: core.currentExplorer.displayName,
                        explorerRoomId: core.currentExplorer.roomId,
                        activeRoomId: core.activeRoomId,
                        inventoryCount: core.currentExplorer.inventory.length,
                        projectionInventoryCount: core.currentExplorerInventory.length,
                        hauntTriggered: core.scenarioRuntime.hauntTriggered,
                        traitorPlayerId: core.scenarioRuntime.traitorPlayerId,
                        recentRoll: core.recentRoll,
                        latestDiscovery: core.latestDiscovery,
                        targetRoomState: targetRoom?.state ?? null,
                    }
                    : null,
            };
        }, targetRoomId);
    const deadline = Date.now() + 30000;
    let lastStatus: Awaited<ReturnType<typeof readStatus>> | null = null;
    while (Date.now() < deadline) {
        lastStatus = await readStatus();
        if (lastStatus.ok) {
            return;
        }
        await page.waitForTimeout(100);
    }
    throw new Error(`山屋作祟后探索 E2E 状态注入未落稳：${JSON.stringify(lastStatus, null, 2)}`);
};

test.describe('山屋惊魂作祟后探索', () => {
    test('作祟后仍可探索，叛徒可声明跳过事件符号', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-haunt-after-explore');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        const core = createTraitorHauntExploreRuntimeCore();
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId, '作祟后探索 E2E 起点必须有未探索门位').toBeTruthy();
        await injectCore(page, core);
        await waitForInjectedTraitorHauntCore(page, targetRoomId);

        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText('杰登·琼斯');
        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/恶兆后|Haunt/i);
        await expect(page.getByTestId('betrayal-action-explore')).toContainText('探索');
        await expect(page.getByTestId('betrayal-explore-options')).toBeVisible();
        const skipEventButton = page.getByTestId('betrayal-explore-option-traitor-event-skip');
        await expect(skipEventButton).toContainText('跳过事件');
        await expect(skipEventButton).toHaveClass(/min-h-\[44px\]/);
        await expect(skipEventButton).not.toHaveClass(/bg-transparent/);
        await expectNearViewportCenter(page, 'betrayal-explore-option-traitor-event-skip');
        await saveScreenshot(page, HAUNT_TRAITOR_READY_SCREENSHOT);

        await skipEventButton.click();
        await expect(skipEventButton).toHaveClass(/border-\[#d6b56d\]/);
        await expect(skipEventButton).toHaveClass(/bg-\[rgba\(214,181,109,0\.24\)\]/);
        await saveScreenshot(page, TRAITOR_EVENT_SKIP_SELECTED_SCREENSHOT);

        await page.getByTestId('betrayal-action-explore').click();
        await expect(page.getByTestId(`betrayal-room-explore-target-${targetRoomId}`)).toBeVisible();
        await expect(page.getByTestId(`betrayal-room-${targetRoomId}`)).toHaveAccessibleName(/未探索.*一层.*可探索/);
        await saveScreenshot(page, HAUNT_EXPLORE_TARGET_SCREENSHOT);
        await page.getByTestId(`betrayal-room-${targetRoomId}`).click();
        await expect(page.getByTestId('betrayal-room-placement-panel')).toHaveAttribute('data-room-placement-slot', targetRoomId);
        await confirmPendingRoomPlacement(page);

        await expect(page.getByTestId('betrayal-discovery-panel')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-discovery-detail')).toContainText('没有抽取或结算事件卡');
        await expect(page.getByTestId('betrayal-discovery-detail')).toContainText('跳过事件');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('叛徒跳过了事件符号');
        await saveScreenshot(page, TRAITOR_EVENT_SKIPPED_SCREENSHOT);

        const afterExplore = await page.evaluate(() => {
            const coreAfter = (window as Window & {
                __BG_TEST_HARNESS__?: { state?: { get?: () => { core: {
                    phase: string;
                    eventOrder: Array<{ name: string }>;
                    discardCounts: { event: number };
                    recentRoll: null | { kind: string };
                    currentExplorer: { playerId: string; roomId: string };
                } } } };
            }).__BG_TEST_HARNESS__!.state!.get!().core;
            return {
                phase: coreAfter.phase,
                eventOrder: coreAfter.eventOrder.map((event) => event.name),
                eventDiscardCount: coreAfter.discardCounts.event,
                recentRollKind: coreAfter.recentRoll?.kind ?? null,
                currentExplorerPlayerId: coreAfter.currentExplorer.playerId,
                currentExplorerRoomId: coreAfter.currentExplorer.roomId,
            };
        });
        expect(afterExplore).toMatchObject({
            phase: 'haunt',
            eventOrder: ['阴影扑面'],
            eventDiscardCount: 0,
            recentRollKind: null,
            currentExplorerPlayerId: '0',
            currentExplorerRoomId: targetRoomId,
        });

        await page.getByTestId('betrayal-discovery-continue').click();
        await expect(page.getByTestId('betrayal-discovery-panel')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-action-endTurn')).toBeVisible();
        await expect(page.getByTestId('betrayal-action-explore')).toHaveCount(0);
        await saveScreenshot(page, HAUNT_EXPLORE_DISMISSED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-haunt-after-explore', diagnostics }]);
    });

    test('作祟后叛徒未选择跳过事件符号时正常结算事件', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-haunt-after-explore-normal-event');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        const core = createTraitorHauntExploreRuntimeCore();
        core.eventOrder = [
            {
                name: '阴影扑面',
                text: '阴影扑向你。失去 1 点力量。',
                effect: { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
            },
            {
                name: '远处低语',
                text: '远处传来低语。没有效果。',
                effect: { mode: 'none', recommendedAction: 'endTurn' },
            },
        ];
        core.deckCounts.event = core.eventOrder.length;
        const mightPositionBefore = core.currentExplorer.traitTracks.might.position;
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId, '作祟后正常事件 E2E 起点必须有未探索门位').toBeTruthy();
        await injectCore(page, core);
        await waitForInjectedTraitorHauntCore(page, targetRoomId);

        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/恶兆后|Haunt/i);
        await expect(page.getByTestId('betrayal-action-explore')).toContainText('探索');
        await expect(page.getByTestId('betrayal-explore-options')).toBeVisible();
        const skipEventButton = page.getByTestId('betrayal-explore-option-traitor-event-skip');
        await expect(skipEventButton).toContainText('跳过事件');
        await expect(skipEventButton).toHaveClass(/min-h-\[44px\]/);
        await expect(skipEventButton).not.toHaveClass(/bg-transparent/);
        await expect(skipEventButton).not.toHaveClass(/bg-\[rgba\(214,181,109,0\.24\)\]/);
        await saveScreenshot(page, NORMAL_EVENT_READY_SCREENSHOT);

        await page.getByTestId('betrayal-action-explore').click();
        await expect(page.getByTestId(`betrayal-room-explore-target-${targetRoomId}`)).toBeVisible();
        await page.getByTestId(`betrayal-room-${targetRoomId}`).click();
        await expect(page.getByTestId('betrayal-room-placement-panel')).toHaveAttribute('data-room-placement-slot', targetRoomId);
        await confirmPendingRoomPlacement(page);

        await expect(page.getByTestId('betrayal-discovery-panel')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-discovery-panel')).toContainText('阴影扑面');
        await expect(page.getByTestId('betrayal-discovery-detail')).toContainText('力量 -1');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('事件：阴影扑面');
        await saveScreenshot(page, NORMAL_EVENT_RESULT_SCREENSHOT);

        const afterExplore = await page.evaluate(() => {
            const coreAfter = (window as Window & {
                __BG_TEST_HARNESS__?: { state?: { get?: () => { core: {
                    phase: string;
                    eventOrder: Array<{ name: string }>;
                    discardCounts: { event: number };
                    recentRoll: null | { kind: string };
                    currentExplorer: {
                        playerId: string;
                        roomId: string;
                        traitTracks: { might: { position: number } };
                    };
                    pendingEventChoice: unknown;
                } } } };
            }).__BG_TEST_HARNESS__!.state!.get!().core;
            return {
                phase: coreAfter.phase,
                eventOrder: coreAfter.eventOrder.map((event) => event.name),
                eventDiscardCount: coreAfter.discardCounts.event,
                recentRollKind: coreAfter.recentRoll?.kind ?? null,
                currentExplorerPlayerId: coreAfter.currentExplorer.playerId,
                currentExplorerRoomId: coreAfter.currentExplorer.roomId,
                mightPosition: coreAfter.currentExplorer.traitTracks.might.position,
                hasPendingEventChoice: Boolean(coreAfter.pendingEventChoice),
            };
        });
        expect(afterExplore).toMatchObject({
            phase: 'haunt',
            eventOrder: ['远处低语', '阴影扑面'],
            eventDiscardCount: 0,
            recentRollKind: null,
            currentExplorerPlayerId: '0',
            currentExplorerRoomId: targetRoomId,
            mightPosition: mightPositionBefore - 1,
            hasPendingEventChoice: false,
        });

        await page.getByTestId('betrayal-discovery-continue').click();
        await expect(page.getByTestId('betrayal-discovery-panel')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-action-endTurn')).toBeVisible();
        await saveScreenshot(page, NORMAL_EVENT_DISMISSED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-haunt-after-explore-normal-event', diagnostics }]);
    });
});
