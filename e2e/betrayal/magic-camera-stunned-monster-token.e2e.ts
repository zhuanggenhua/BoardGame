import { expect, test, type Page } from '@playwright/test';
import type { BetrayalCore } from '../../src/games/betrayal/game';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createMagicCameraHauntRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/山屋惊魂-怪物击晕翻正完整链路';
const STUNNED_SCREENSHOT = `${EVIDENCE_DIR}/01-击晕幻影摄影师牌桌状态.jpg`;
const RESTORED_SCREENSHOT = `${EVIDENCE_DIR}/02-开回合翻正跳过后.jpg`;
const MAGIC_CAMERA_TEST_URL = '/play/betrayal?players=3&playerID=1&seat0=human&seat1=human&seat2=human';

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

const activateExplorerInRoom = (
    core: BetrayalCore,
    playerId: string,
    roomId: string,
): void => {
    const explorers = [core.currentExplorer, ...core.otherExplorers].map(cloneExplorer);
    const actor = explorers.find((explorer) => explorer.playerId === playerId);
    if (!actor) {
        throw new Error(`山屋 E2E 夹具缺少玩家 ${playerId}`);
    }
    const activeActor = {
        ...actor,
        roomId,
        inventory: actor.inventory.map((card) => ({ ...card })),
    };
    core.currentPlayer = playerId;
    core.currentExplorer = activeActor;
    core.otherExplorers = explorers.filter((explorer) => explorer.playerId !== playerId);
    core.activeRoomId = roomId;
    core.currentExplorerRoomId = roomId;
    core.currentExplorerTraits = { ...activeActor.traits };
    core.currentExplorerInventory = activeActor.inventory.map((card) => ({ ...card }));
    core.turnStartInventoryCardIds = activeActor.inventory.map((card) => card.id);
};

const createStunnedMagicCameraMonsterCore = (): {
    core: BetrayalCore;
    monsterId: string;
} => {
    const core = createMagicCameraHauntRuntimeCore('1');
    const magicCamera = core.scenarioRuntime.magicCamera;
    const monsterId = magicCamera?.phantomPhotographerIds[0];
    if (!magicCamera || !monsterId) {
        throw new Error('山屋 E2E 夹具缺少魔法相机幻影摄影师');
    }
    if (core.scenarioRuntime.traitorPlayerId !== '1') {
        throw new Error(`魔法相机作祟夹具应由玩家 1 控制摄影师，实际为 ${core.scenarioRuntime.traitorPlayerId ?? '无'}`);
    }

    activateExplorerInRoom(core, '1', 'hallway');
    core.turnEndedByDiscovery = false;
    core.latestDiscovery = null;
    core.latestDiscoveryOwnerPlayerId = null;
    core.pendingEventChoice = null;
    core.recentRoll = null;
    core.scenarioRuntime.magicCamera = {
        ...magicCamera,
        killedPhantomPhotographerIds: magicCamera.killedPhantomPhotographerIds.filter((id) => id !== monsterId),
        stunnedPhantomPhotographerIds: [monsterId],
    };
    core.scenarioRuntime.monsterStatusesById = {
        ...core.scenarioRuntime.monsterStatusesById,
        [monsterId]: 'stunned',
    };
    core.scenarioRuntime.monsterTurn = {
        resolvedStartMonsterIds: [],
        skippedMonsterIdsThisTurn: [],
        movementRollsByGroupId: {},
        moveRemainingById: {},
    };
    core.monsters = core.monsters
        .filter((monster) => monster.id === monsterId)
        .map((monster) => ({ ...monster, roomId: 'hallway' }));
    return { core, monsterId };
};

type StunnedMonsterState = {
    currentPlayer?: string;
    monsterRoomId?: string | null;
    monsterStatus?: string | null;
    stunnedPhantomPhotographerIds?: string[];
    resolvedStartMonsterIds?: string[];
    skippedMonsterIdsThisTurn?: string[];
};

const readStunnedMonsterState = async (
    page: Page,
    monsterId: string,
): Promise<StunnedMonsterState> =>
    page.evaluate((targetMonsterId) => {
        const state = (window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            currentPlayer?: string;
                            monsters?: Array<{ id: string; roomId: string | null }>;
                            scenarioRuntime?: {
                                magicCamera?: { stunnedPhantomPhotographerIds?: string[] };
                                monsterStatusesById?: Record<string, string>;
                                monsterTurn?: {
                                    resolvedStartMonsterIds?: string[];
                                    skippedMonsterIdsThisTurn?: string[];
                                };
                            };
                        };
                    };
                };
            };
        }).__BG_TEST_HARNESS__?.state?.get?.();
        const core = state?.core;
        const monster = core?.monsters?.find((entry) => entry.id === targetMonsterId);
        const explicitMonsterStatus = core?.scenarioRuntime?.monsterStatusesById?.[targetMonsterId] ?? null;
        const stunnedPhantomPhotographerIds =
            core?.scenarioRuntime?.magicCamera?.stunnedPhantomPhotographerIds ?? [];
        return {
            currentPlayer: core?.currentPlayer,
            monsterRoomId: monster?.roomId ?? null,
            monsterStatus: explicitMonsterStatus ?? (
                stunnedPhantomPhotographerIds.includes(targetMonsterId) ? 'stunned' : 'active'
            ),
            stunnedPhantomPhotographerIds,
            resolvedStartMonsterIds:
                core?.scenarioRuntime?.monsterTurn?.resolvedStartMonsterIds ?? [],
            skippedMonsterIdsThisTurn:
                core?.scenarioRuntime?.monsterTurn?.skippedMonsterIdsThisTurn ?? [],
        };
    }, monsterId);

test.describe('山屋惊魂魔法相机怪物击晕翻正', () => {
    test('击晕幻影摄影师在牌桌显示击晕，开回合后翻正并跳过本怪物回合', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-magic-camera-stunned-monster-token');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(MAGIC_CAMERA_TEST_URL, { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        const { core, monsterId } = createStunnedMagicCameraMonsterCore();
        await injectCore(page, core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/恶兆后|Haunt/i);

        const roomMonsterToken = page.getByTestId(`betrayal-room-monster-hallway-${monsterId}`);
        const boardMonsterToken = page.getByTestId(`betrayal-monster-board-token-${monsterId}`);
        const stunnedStatusLabel = page.getByTestId(`betrayal-monster-board-token-status-${monsterId}`);
        const monsterTurnStartAction = page.getByTestId('betrayal-action-monsterTurnStart');

        await expect(roomMonsterToken).toBeVisible();
        await expect(roomMonsterToken).toHaveAttribute('data-monster-status', 'stunned');
        await expect(boardMonsterToken).toBeVisible();
        await expect(boardMonsterToken).toHaveAttribute('data-monster-status', 'stunned');
        await expect(stunnedStatusLabel).toContainText('击晕');
        await expect(monsterTurnStartAction).toBeVisible();
        await expect(monsterTurnStartAction).toContainText('幻影摄影师开回合');
        expect(await readStunnedMonsterState(page, monsterId)).toMatchObject({
            currentPlayer: '1',
            monsterRoomId: 'hallway',
            monsterStatus: 'stunned',
            stunnedPhantomPhotographerIds: [monsterId],
        });
        await saveScreenshot(page, STUNNED_SCREENSHOT);

        await monsterTurnStartAction.click();
        await expect(roomMonsterToken).toHaveAttribute('data-monster-status', 'active');
        await expect(boardMonsterToken).toHaveAttribute('data-monster-status', 'active');
        await expect(stunnedStatusLabel).toHaveCount(0);
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('翻回正面');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('跳过');
        await expect(page.getByTestId('betrayal-action-monsterMovementRoll')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-action-monsterAttack')).toHaveCount(0);
        expect(await readStunnedMonsterState(page, monsterId)).toMatchObject({
            currentPlayer: '1',
            monsterRoomId: 'hallway',
            monsterStatus: 'active',
            stunnedPhantomPhotographerIds: [],
            resolvedStartMonsterIds: [monsterId],
            skippedMonsterIdsThisTurn: [monsterId],
        });
        await saveScreenshot(page, RESTORED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-magic-camera-stunned-monster-token', diagnostics }]);
    });
});
