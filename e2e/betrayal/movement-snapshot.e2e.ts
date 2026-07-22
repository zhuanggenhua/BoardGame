import { expect, test, type Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import type { BetrayalCore, BetrayalTraitKey } from '../../src/games/betrayal/game';
import {
    createRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-core-interactions/movement-snapshot';
const TURN_START_SCREENSHOT = `${EVIDENCE_DIR}/01-回合开始移动力快照.jpg`;
const SPEED_HEALED_SCREENSHOT = `${EVIDENCE_DIR}/02-速度变化后移动力不回填.jpg`;
const NEXT_TURN_SCREENSHOT = `${EVIDENCE_DIR}/03-下个玩家回合重新锁定移动力.jpg`;

type BetrayalHarnessWindow = Window & {
    __BG_TEST_HARNESS__?: {
        state?: {
            get?: () => {
                core?: BetrayalCore;
            };
        };
    };
    __BG_LAST_COMMAND_REJECTED__?: { commandType: string; error: string };
};

function findExplorer(core: BetrayalCore, playerId: string): BetrayalCore['currentExplorer'] {
    const explorer = [core.currentExplorer, ...core.otherExplorers].find(
        (candidate) => candidate.playerId === playerId,
    );
    if (!explorer) {
        throw new Error(`山屋移动力快照 E2E 缺少玩家 ${playerId}`);
    }
    return explorer;
}

function setTraitTrack(
    core: BetrayalCore,
    playerId: string,
    trait: BetrayalTraitKey,
    values: number[],
    position: number,
    startPosition = 3,
): void {
    const explorer = findExplorer(core, playerId);
    explorer.traitTracks[trait] = {
        trackId: `e2e-movement-${playerId}-${trait}`,
        values: [...values],
        position,
        startPosition,
        criticalPosition: 0,
        skullPosition: -1,
        maxPosition: values.length - 1,
    };
    explorer.traits[trait] = values[position] ?? 0;
    if (core.currentExplorer.playerId === playerId) {
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
    }
}

function createMovementSnapshotCore(): BetrayalCore {
    const core = createRuntimeCore();
    setTraitTrack(core, '0', 'speed', [1, 2, 3, 4, 5], 2, 3);
    setTraitTrack(core, '1', 'speed', [1, 2, 3, 4, 5], 4, 4);
    core.currentExplorer.inventory = [
        ...core.currentExplorer.inventory.filter((item) => item.id !== 'holy-water'),
        { id: 'holy-water', name: '奇怪的药品', kind: 'item' },
    ];
    core.currentExplorerInventory = [...core.currentExplorer.inventory];
    core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((item) => item.id);
    core.usedCardIdsThisTurn = [];
    core.turnStartSpeed = core.currentExplorer.traits.speed;
    core.movesRemaining = core.turnStartSpeed;
    core.recommendedAction = 'move';
    core.latestDiscovery = null;
    core.latestDiscoveryOwnerPlayerId = null;
    return core;
}

async function readMovementSnapshot(page: Page) {
    return page.evaluate(() => {
        const holder = window as BetrayalHarnessWindow;
        const core = holder.__BG_TEST_HARNESS__?.state?.get?.().core;
        const hud = document.querySelector<HTMLElement>('[data-testid="betrayal-movement-snapshot"]');
        const currentExplorer = core?.currentExplorer;
        return {
            hudText: hud?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
            hudMovesRemaining: hud?.dataset.movesRemaining ?? null,
            hudTurnStartSpeed: hud?.dataset.turnStartSpeed ?? null,
            currentPlayer: core?.currentPlayer ?? null,
            currentRoomId: currentExplorer?.roomId ?? null,
            currentSpeed: currentExplorer?.traits.speed ?? null,
            turnStartSpeed: core?.turnStartSpeed ?? null,
            movesRemaining: core?.movesRemaining ?? null,
            inventoryIds: currentExplorer?.inventory.map((item) => item.id) ?? [],
            usedCardIds: core?.usedCardIdsThisTurn ?? [],
            latestLog: core?.activityLog[0]?.text ?? '',
            rejected: holder.__BG_LAST_COMMAND_REJECTED__ ?? null,
        };
    });
}

async function expectMovementSnapshot(
    page: Page,
    expected: {
        currentPlayer: string;
        currentSpeed: number;
        movesRemaining: number;
        turnStartSpeed: number;
    },
) {
    await expect
        .poll(async () => readMovementSnapshot(page), {
            message: '右上角移动力 HUD 必须显示本回合锁定移动力和当前剩余移动',
            timeout: 10000,
        })
        .toMatchObject({
            currentPlayer: expected.currentPlayer,
            currentSpeed: expected.currentSpeed,
            movesRemaining: expected.movesRemaining,
            turnStartSpeed: expected.turnStartSpeed,
            hudMovesRemaining: String(expected.movesRemaining),
            hudTurnStartSpeed: String(expected.turnStartSpeed),
            rejected: null,
        });
    await expect(page.getByTestId('betrayal-movement-snapshot')).toContainText(
        `${expected.movesRemaining}/${expected.turnStartSpeed}`,
    );
}

test.describe('山屋惊魂移动力快照', () => {
    test('真实牌桌入口显示回合开始锁定移动力，回合中速度变化不回填剩余移动', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-movement-snapshot');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createMovementSnapshotCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });

        await expectMovementSnapshot(page, {
            currentPlayer: '0',
            currentSpeed: 3,
            movesRemaining: 3,
            turnStartSpeed: 3,
        });
        await saveScreenshot(page, TURN_START_SCREENSHOT);

        await page.getByTestId('betrayal-action-move').click();
        await page.getByTestId('betrayal-room-hallway').click();
        await expectMovementSnapshot(page, {
            currentPlayer: '0',
            currentSpeed: 3,
            movesRemaining: 2,
            turnStartSpeed: 3,
        });

        await page.getByTestId('betrayal-inventory-holy-water').click();
        await expect(page.getByTestId('betrayal-selected-inventory-card-name')).toContainText('奇怪的药品');
        await expect(page.getByTestId('betrayal-action-use')).toBeEnabled();
        await page.getByTestId('betrayal-action-use').click();

        await expectMovementSnapshot(page, {
            currentPlayer: '0',
            currentSpeed: 4,
            movesRemaining: 2,
            turnStartSpeed: 3,
        });
        await expect
            .poll(async () => readMovementSnapshot(page), {
                message: '奇怪的药品应埋葬并记录已使用，但不能改写本回合移动力快照',
                timeout: 10000,
            })
            .toMatchObject({
                inventoryIds: expect.not.arrayContaining(['holy-water']),
                usedCardIds: expect.arrayContaining(['holy-water']),
                latestLog: expect.stringMatching(/埋葬奇怪的药品/),
            });
        await saveScreenshot(page, SPEED_HEALED_SCREENSHOT);

        await page.getByTestId('betrayal-action-endTurn').click();
        await expectMovementSnapshot(page, {
            currentPlayer: '1',
            currentSpeed: 5,
            movesRemaining: 5,
            turnStartSpeed: 5,
        });
        await saveScreenshot(page, NEXT_TURN_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-movement-snapshot', diagnostics }]);
    });
});
