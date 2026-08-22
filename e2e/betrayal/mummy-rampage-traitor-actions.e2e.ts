import { expect, test, type Page } from '@playwright/test';
import type { BetrayalCore } from '../../src/games/betrayal/game';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createFirstScenarioHauntRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/山屋惊魂-木乃伊叛徒行动真实入口';
const GIRL_READY_SCREENSHOT = `${EVIDENCE_DIR}/01-拾起女孩前.jpg`;
const GIRL_PICKED_UP_SCREENSHOT = `${EVIDENCE_DIR}/02-拾起女孩成功.jpg`;
const GIRL_GIVEN_SCREENSHOT = `${EVIDENCE_DIR}/03-交出女孩成功.jpg`;
const HOLY_SYMBOL_ENDING_SCREENSHOT = `${EVIDENCE_DIR}/04-交出圣符后叛徒终局朗读.jpg`;
const HOLY_SYMBOL_REPORT_SCREENSHOT = `${EVIDENCE_DIR}/05-交出圣符后叛徒结果报告.jpg`;
const RING_READY_SCREENSHOT = `${EVIDENCE_DIR}/06-指环分支交出前.jpg`;
const RING_ENDING_SCREENSHOT = `${EVIDENCE_DIR}/07-交出指环后叛徒终局朗读.jpg`;
const HUMAN_TRAITOR_TEST_URL = '/play/betrayal?players=3&playerID=2&seat0=human&seat1=human&seat2=human';

type MummyTraitorActionCard = BetrayalCore['currentExplorer']['inventory'][number];
type RoomFloor = BetrayalCore['rooms'][number]['floor'];

const cloneExplorer = (explorer: BetrayalCore['currentExplorer']) => ({
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

const activateExplorer = (core: BetrayalCore, playerId: string): BetrayalCore => {
    const explorers = [core.currentExplorer, ...core.otherExplorers].map(cloneExplorer);
    const active = explorers.find((explorer) => explorer.playerId === playerId);
    if (!active) {
        throw new Error(`木乃伊横行叛徒线 E2E 夹具缺少玩家 ${playerId}`);
    }
    core.currentPlayer = playerId;
    core.currentExplorer = active;
    core.otherExplorers = explorers.filter((explorer) => explorer.playerId !== playerId);
    core.activeRoomId = active.roomId;
    core.currentExplorerRoomId = active.roomId;
    core.currentExplorerTraits = { ...active.traits };
    core.currentExplorerInventory = active.inventory.map((card) => ({ ...card }));
    core.turnStartInventoryCardIds = active.inventory.map((card) => card.id);
    return core;
};

const syncCurrentExplorerProjection = (core: BetrayalCore): void => {
    core.activeRoomId = core.currentExplorer.roomId;
    core.currentExplorerRoomId = core.currentExplorer.roomId;
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
    core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
};

const dismissBlockingOverlays = (core: BetrayalCore): BetrayalCore => {
    core.latestDiscovery = null;
    core.latestDiscoveryOwnerPlayerId = null;
    core.pendingEventChoice = null;
    core.pendingDamageAllocation = null;
    core.recentRoll = null;
    core.activePlayerId = null;
    return core;
};

const markMonsterActionsDoneForExplorerTurn = (core: BetrayalCore): void => {
    const monsterIds = core.monsters.map((monster) => monster.id);
    core.scenarioRuntime.monsterTurn = {
        ...core.scenarioRuntime.monsterTurn,
        resolvedStartMonsterIds: Array.from(new Set([
            ...(core.scenarioRuntime.monsterTurn?.resolvedStartMonsterIds ?? []),
            ...monsterIds,
        ])),
        skippedMonsterIdsThisTurn: Array.from(new Set([
            ...(core.scenarioRuntime.monsterTurn?.skippedMonsterIdsThisTurn ?? []),
            ...monsterIds,
        ])),
        movementRollsByGroupId: {},
        moveRemainingById: {},
    };
};

const createMummyTraitorActionCore = (options: {
    inventory?: MummyTraitorActionCard[];
    girlHolder?: 'room' | 'traitor' | 'mummy';
    carriedOmenIds?: string[];
} = {}) => {
    let core = createFirstScenarioHauntRuntimeCore();
    const traitorId = core.scenarioRuntime.traitorPlayerId;
    const mummyRuntime = core.scenarioRuntime.mummy;
    if (!traitorId || !mummyRuntime) {
        throw new Error('木乃伊横行叛徒线 E2E 夹具缺少叛徒或木乃伊运行态');
    }
    core = activateExplorer(core, traitorId);
    const traitorRoomId = core.currentExplorer.roomId;
    const traitorRoom = core.rooms.find((room) => room.id === traitorRoomId);
    if (!traitorRoom) {
        throw new Error(`木乃伊横行叛徒线 E2E 夹具缺少叛徒房间 ${traitorRoomId}`);
    }
    const girlHolder = options.girlHolder ?? 'room';
    const inventory = options.inventory ?? [{ id: 'holy-symbol', name: '圣符', kind: 'omen' as const }];

    core.currentExplorer = {
        ...core.currentExplorer,
        roomId: traitorRoomId,
        inventory: inventory.map((card) => ({ ...card })),
    };
    core.otherExplorers = core.otherExplorers.map((explorer) => (
        explorer.playerId === traitorId
            ? explorer
            : { ...explorer, roomId: 'entrance-hall' }
    ));
    core.monsters = core.monsters.map((monster) => (
        monster.id === mummyRuntime.mummyMonsterId || monster.definitionId === 'mummy'
            ? { ...monster, roomId: traitorRoomId }
            : monster
    ));
    core.scenarioRuntime.mummy = {
        ...mummyRuntime,
        sarcophagusRoomId: traitorRoomId,
        girlRoomId: girlHolder === 'room' ? traitorRoomId : null,
        girlHolderPlayerId: girlHolder === 'traitor' ? traitorId : null,
        girlHeldByMummy: girlHolder === 'mummy',
        mummyCarriedOmenIds: [...(options.carriedOmenIds ?? [])],
        mummyCarriedCards: [],
    };
    core.usedCardIdsThisTurn = [];
    core.recommendedAction = 'use';
    markMonsterActionsDoneForExplorerTurn(core);
    syncCurrentExplorerProjection(core);
    return {
        core: dismissBlockingOverlays(core),
        traitorId,
        traitorRoomId,
        traitorRoomFloor: traitorRoom.floor,
    };
};

type MummyTraitorState = {
    currentPlayer?: string;
    phase?: string;
    girlHolderPlayerId?: string | null;
    girlHeldByMummy?: boolean;
    girlRoomId?: string | null;
    mummyCarriedOmenIds?: string[];
    traitorInventoryCardIds?: string[];
    endgameOutcome?: string | null;
};

const readMummyTraitorState = async (page: Page): Promise<MummyTraitorState> =>
    page.evaluate(() => {
        const state = (window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            currentPlayer?: string;
                            phase?: string;
                            currentExplorer?: {
                                inventory?: Array<{ id: string }>;
                            };
                            endgameResult?: { outcome?: string } | null;
                            scenarioRuntime?: {
                                mummy?: {
                                    girlHolderPlayerId?: string | null;
                                    girlHeldByMummy?: boolean;
                                    girlRoomId?: string | null;
                                    mummyCarriedOmenIds?: string[];
                                };
                            };
                        };
                    };
                };
            };
        }).__BG_TEST_HARNESS__?.state?.get?.();
        const core = state?.core;
        const mummy = core?.scenarioRuntime?.mummy;
        return {
            currentPlayer: core?.currentPlayer,
            phase: core?.phase,
            girlHolderPlayerId: mummy?.girlHolderPlayerId ?? null,
            girlHeldByMummy: mummy?.girlHeldByMummy ?? false,
            girlRoomId: mummy?.girlRoomId ?? null,
            mummyCarriedOmenIds: mummy?.mummyCarriedOmenIds ?? [],
            traitorInventoryCardIds: core?.currentExplorer?.inventory?.map((card) => card.id) ?? [],
            endgameOutcome: core?.endgameResult?.outcome ?? null,
        };
    });

const openBetrayalAsTraitor = async (page: Page): Promise<void> => {
    await page.goto(HUMAN_TRAITOR_TEST_URL, { waitUntil: 'domcontentloaded' });
    await waitForBetrayalPageReady(page);
};

const switchRoomMapToFloor = async (page: Page, floor: RoomFloor): Promise<void> => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        if (await page.getByTestId(`betrayal-room-floor-${floor}`).isVisible({ timeout: 500 }).catch(() => false)) {
            return;
        }
        const upperVisible = await page.getByTestId('betrayal-room-floor-upper')
            .isVisible({ timeout: 250 })
            .catch(() => false);
        const basementVisible = await page.getByTestId('betrayal-room-floor-basement')
            .isVisible({ timeout: 250 })
            .catch(() => false);
        if (floor === 'upper' || (floor === 'ground' && basementVisible)) {
            await page.getByTestId('betrayal-room-floor-up').click();
        } else if (floor === 'basement' || (floor === 'ground' && upperVisible)) {
            await page.getByTestId('betrayal-room-floor-down').click();
        }
    }
    await expect(page.getByTestId(`betrayal-room-floor-${floor}`)).toBeVisible();
};

test.describe('山屋惊魂木乃伊横行叛徒行动真实入口', () => {
    test('叛徒可从真实牌桌入口拾起女孩、交给木乃伊并交出圣符进入叛徒终局', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-mummy-rampage-traitor-holy-symbol');
        const fixture = createMummyTraitorActionCore();
        const girlToken = () => page.getByTestId(`betrayal-room-haunt-token-${fixture.traitorRoomId}-mummy-girl-token`);
        const sarcophagusToken = () => page.getByTestId(`betrayal-room-haunt-token-${fixture.traitorRoomId}-mummy-sarcophagus`);

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await openBetrayalAsTraitor(page);
        await injectCore(page, fixture.core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readMummyTraitorState(page)).toMatchObject({
            currentPlayer: fixture.traitorId,
            girlRoomId: fixture.traitorRoomId,
            girlHeldByMummy: false,
            traitorInventoryCardIds: expect.arrayContaining(['holy-symbol']),
        });
        await switchRoomMapToFloor(page, fixture.traitorRoomFloor);
        await expect(sarcophagusToken()).toContainText('棺');
        await expect(girlToken()).toHaveAttribute('data-token-status', 'placed');
        await expect(page.getByTestId('betrayal-action-use')).toContainText('拾起女孩');
        await expect(page.getByTestId('betrayal-action-cue')).toContainText('点拾起女孩');
        await saveScreenshot(page, GIRL_READY_SCREENSHOT);

        await page.getByTestId('betrayal-action-use').click();
        await expect(girlToken()).toHaveAttribute('data-token-status', 'held-by-player');
        await expect(girlToken()).toHaveAttribute('data-token-owner-player-id', fixture.traitorId);
        await expect(page.getByTestId('betrayal-action-use')).toContainText('交出女孩');
        await expect.poll(() => readMummyTraitorState(page)).toMatchObject({
            girlHolderPlayerId: fixture.traitorId,
            girlHeldByMummy: false,
        });
        await saveScreenshot(page, GIRL_PICKED_UP_SCREENSHOT);

        await page.getByTestId('betrayal-action-use').click();
        await expect(girlToken()).toHaveAttribute('data-token-status', 'held-by-mummy');
        await expect(page.getByTestId('betrayal-action-use')).toContainText('交出圣符');
        await expect.poll(() => readMummyTraitorState(page)).toMatchObject({
            girlHolderPlayerId: null,
            girlHeldByMummy: true,
        });
        await saveScreenshot(page, GIRL_GIVEN_SCREENSHOT);

        await page.getByTestId('betrayal-action-use').click();
        const endgame = page.getByTestId('betrayal-endgame-screen');
        await expect(endgame).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readMummyTraitorState(page)).toMatchObject({
            phase: 'endgame',
            endgameOutcome: 'traitor',
            mummyCarriedOmenIds: expect.arrayContaining(['holy-symbol']),
            traitorInventoryCardIds: expect.not.arrayContaining(['holy-symbol']),
        });
        await expect(endgame.getByTestId('betrayal-endgame-ending-narration')).toContainText('小女孩瑟缩于角落');
        await saveScreenshot(page, HOLY_SYMBOL_ENDING_SCREENSHOT);
        await endgame.getByTestId('betrayal-endgame-ending-continue').click();
        await expect(endgame.getByTestId('betrayal-endgame-result-report')).toBeVisible();
        await saveScreenshot(page, HOLY_SYMBOL_REPORT_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-mummy-rampage-traitor-holy-symbol', diagnostics }]);
    });

    test('叛徒可从真实牌桌入口把指环交给木乃伊并进入叛徒终局', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-mummy-rampage-traitor-ring');
        const fixture = createMummyTraitorActionCore({
            inventory: [{ id: 'ring', name: '指环', kind: 'omen' }],
            girlHolder: 'mummy',
        });

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await openBetrayalAsTraitor(page);
        await injectCore(page, fixture.core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readMummyTraitorState(page)).toMatchObject({
            currentPlayer: fixture.traitorId,
            girlHeldByMummy: true,
            traitorInventoryCardIds: expect.arrayContaining(['ring']),
        });
        await switchRoomMapToFloor(page, fixture.traitorRoomFloor);
        await expect(page.getByTestId('betrayal-action-use')).toContainText('交出指环');
        await expect(page.getByTestId('betrayal-action-cue')).toContainText('点交出指环');
        await saveScreenshot(page, RING_READY_SCREENSHOT);

        await page.getByTestId('betrayal-action-use').click();
        const endgame = page.getByTestId('betrayal-endgame-screen');
        await expect(endgame).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readMummyTraitorState(page)).toMatchObject({
            phase: 'endgame',
            endgameOutcome: 'traitor',
            mummyCarriedOmenIds: expect.arrayContaining(['ring']),
            traitorInventoryCardIds: expect.not.arrayContaining(['ring']),
        });
        await expect(endgame.getByTestId('betrayal-endgame-ending-narration')).toContainText('木乃伊怀中的小女孩');
        await saveScreenshot(page, RING_ENDING_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-mummy-rampage-traitor-ring', diagnostics }]);
    });
});
