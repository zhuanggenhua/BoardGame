import { expect, test, type Page } from '@playwright/test';
import {
    resolveInventoryEffectId,
    type BetrayalCore,
} from '../../src/games/betrayal/game';
import { BETRAYAL_DISCOVERY_POOLS } from '../../src/games/betrayal/scenarioConfig';
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

const EVIDENCE_DIR = 'evidence/山屋惊魂-木乃伊强制关键预兆真实探索';
const HERO_BEFORE_SCREENSHOT = `${EVIDENCE_DIR}/01-英雄探索预兆前.jpg`;
const HERO_FORCED_BOOK_SCREENSHOT = `${EVIDENCE_DIR}/02-英雄强制找到书本.jpg`;
const TRAITOR_BEFORE_SCREENSHOT = `${EVIDENCE_DIR}/03-叛徒探索预兆前.jpg`;
const TRAITOR_FORCED_WEDDING_OMEN_SCREENSHOT = `${EVIDENCE_DIR}/04-叛徒强制找到婚礼预兆.jpg`;
const betrayalHumanTestUrl = (playerId: string) =>
    `/play/betrayal?players=3&playerID=${playerId}&seat0=human&seat1=human&seat2=human`;

type Explorer = BetrayalCore['currentExplorer'];
type InventoryCard = Explorer['inventory'][number];
type RoomTemplate = BetrayalCore['roomDiscoveryDeck'][number]['room'];
type MummyForcedOmenRole = 'hero-book' | 'traitor-wedding-omen';

const cloneExplorer = (explorer: Explorer): Explorer => ({
    ...explorer,
    traits: { ...explorer.traits },
    traitTracks: Object.fromEntries(
        Object.entries(explorer.traitTracks).map(([trait, track]) => [
            trait,
            { ...track, values: [...track.values] },
        ]),
    ) as Explorer['traitTracks'],
    inventory: explorer.inventory.map((card) => ({ ...card })),
});

const activateExplorer = (core: BetrayalCore, playerId: string): BetrayalCore => {
    const explorers = [core.currentExplorer, ...core.otherExplorers].map(cloneExplorer);
    const active = explorers.find((explorer) => explorer.playerId === playerId);
    if (!active) {
        throw new Error(`木乃伊强制预兆 E2E 夹具缺少玩家 ${playerId}`);
    }
    core.currentPlayer = playerId;
    core.currentExplorer = active;
    core.otherExplorers = explorers.filter((explorer) => explorer.playerId !== playerId);
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

const card = (id: string, name: string): InventoryCard => ({ id, name, kind: 'omen' });

const cloneRoomTemplate = (room: RoomTemplate): RoomTemplate => ({
    ...room,
    tags: [...room.tags],
    doorways: [...room.doorways],
});

const findGroundOmenRoomTemplate = (): RoomTemplate => {
    const room = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find(
        (candidate) => candidate.visualId === 'specimenRoom',
    );
    if (!room) {
        throw new Error('木乃伊强制预兆 E2E 夹具缺少一层预兆房：标本室');
    }
    return cloneRoomTemplate(room);
};

const seedNextGroundOmenRoom = (core: BetrayalCore): void => {
    const room = findGroundOmenRoomTemplate();
    core.roomDiscoveryDeck = [{ floor: 'ground', room: cloneRoomTemplate(room) }];
    core.roomDiscoveryOrderByFloor = {
        ground: [cloneRoomTemplate(room)],
        upper: [],
        basement: [],
    };
    core.buriedRoomTiles = [];
    core.latestRoomDrawResolution = null;
};

const removeOmensFromExplorers = (core: BetrayalCore, cardIds: string[]): void => {
    const blocked = new Set(cardIds);
    const filterInventory = (explorer: Explorer): Explorer => ({
        ...explorer,
        inventory: explorer.inventory.filter((item) => !blocked.has(item.id)),
    });
    core.currentExplorer = filterInventory(core.currentExplorer);
    core.otherExplorers = core.otherExplorers.map(filterInventory);
};

const placeExplorerAtHauntExplorationDoor = (
    core: BetrayalCore,
    playerId: string,
    inventory: InventoryCard[],
): BetrayalCore => {
    core = activateExplorer(core, playerId);
    core.currentExplorer = {
        ...core.currentExplorer,
        roomId: 'hallway',
        inventory: inventory.map((item) => ({ ...item })),
    };
    core.otherExplorers = core.otherExplorers.map((explorer) => (
        explorer.playerId === playerId
            ? explorer
            : { ...explorer, roomId: explorer.playerId === core.scenarioRuntime.traitorPlayerId ? 'basement-east' : 'entrance-hall' }
    ));
    core.rooms = core.rooms.map((room) => {
        if (room.id === 'ground-south') {
            return {
                ...room,
                state: 'unexplored',
                name: '未探索',
                floor: 'ground',
                discoveryReward: null,
                visualId: 'backGround',
                entryRoomId: 'hallway',
            };
        }
        return room;
    });
    core.drawOrder = ['omen'];
    seedNextGroundOmenRoom(core);
    core.usedCardIdsThisTurn = [];
    core.turnEndedByDiscovery = false;
    core.recommendedAction = 'explore';
    syncCurrentExplorerProjection(core);
    return dismissBlockingOverlays(core);
};

const createMummyForcedOmenCore = (role: MummyForcedOmenRole) => {
    const core = createFirstScenarioHauntRuntimeCore();
    const traitorId = core.scenarioRuntime.traitorPlayerId;
    const heroId = core.playerIds.find((playerId) => playerId !== traitorId);
    if (!traitorId || !heroId || !core.scenarioRuntime.mummy) {
        throw new Error('木乃伊强制预兆 E2E 夹具缺少英雄、叛徒或木乃伊运行态');
    }

    if (role === 'hero-book') {
        removeOmensFromExplorers(core, ['omen-book']);
        core.possessionOrderByKind.omen = [
            card('skull', '头骨'),
            card('omen-book', '书本'),
            card('holy-symbol', '圣符'),
            card('ring', '指环'),
        ];
        return {
            core: placeExplorerAtHauntExplorationDoor(core, heroId, []),
            actorId: heroId,
            expectedCardId: 'omen-book',
            expectedCardName: '书本',
            forcedText: '木乃伊横行：英雄首次需要预兆时，从预兆堆找出书本并洗牌',
        };
    }

    removeOmensFromExplorers(core, ['holy-symbol', 'ring']);
    core.possessionOrderByKind.omen = [
        card('skull', '头骨'),
        card('holy-symbol', '圣符'),
        card('ring', '指环'),
        card('omen-book', '书本'),
    ];
    return {
        core: placeExplorerAtHauntExplorationDoor(core, traitorId, []),
        actorId: traitorId,
        expectedCardId: 'holy-symbol',
        expectedCardName: '圣符',
        forcedText: '木乃伊横行：叛徒首次需要预兆时，从预兆堆找出圣符或指环并洗牌',
    };
};

type MummyForcedOmenState = {
    currentPlayer?: string;
    currentInventoryCardIds?: string[];
    latestDiscoveryTitle?: string | null;
    latestDiscoveryDetail?: string | null;
    forcedOmenSearch?: {
        role?: MummyForcedOmenRole;
        cardId?: string;
        cardName?: string;
        shuffledOmenDeck?: InventoryCard[];
    } | null;
    remainingOmenDeckIds?: string[];
};

type MummyForcedOmenEffectState = MummyForcedOmenState & {
    currentInventoryEffectIds: string[];
    forcedOmenSearchEffectId: string | null;
    remainingOmenDeckEffectIds: string[];
};

const readMummyForcedOmenState = async (page: Page): Promise<MummyForcedOmenState> =>
    page.evaluate(() => {
        const snapshot = (window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            currentPlayer?: string;
                            currentExplorer?: {
                                inventory?: Array<{ id: string }>;
                            };
                            latestDiscovery?: {
                                title?: string;
                                detail?: string;
                            } | null;
                            possessionOrderByKind?: {
                                omen?: Array<{ id: string; name: string; kind: 'omen' }>;
                            };
                            scenarioRuntime?: {
                                mummyForcedOmenSearch?: {
                                    role?: MummyForcedOmenRole;
                                    cardId?: string;
                                    cardName?: string;
                                    shuffledOmenDeck?: Array<{ id: string; name: string; kind: 'omen' }>;
                                };
                            };
                        };
                    };
                };
            };
        }).__BG_TEST_HARNESS__?.state?.get?.();
        const core = snapshot?.core;
        return {
            currentPlayer: core?.currentPlayer,
            currentInventoryCardIds: core?.currentExplorer?.inventory?.map((item) => item.id) ?? [],
            latestDiscoveryTitle: core?.latestDiscovery?.title ?? null,
            latestDiscoveryDetail: core?.latestDiscovery?.detail ?? null,
            forcedOmenSearch: core?.scenarioRuntime?.mummyForcedOmenSearch ?? null,
            remainingOmenDeckIds: core?.possessionOrderByKind?.omen?.map((item) => item.id) ?? [],
        };
    });

const readMummyForcedOmenEffectState = async (page: Page): Promise<MummyForcedOmenEffectState> => {
    const state = await readMummyForcedOmenState(page);
    return {
        ...state,
        currentInventoryEffectIds: (state.currentInventoryCardIds ?? []).map(resolveInventoryEffectId),
        forcedOmenSearchEffectId: state.forcedOmenSearch?.cardId
            ? resolveInventoryEffectId(state.forcedOmenSearch.cardId)
            : null,
        remainingOmenDeckEffectIds: (state.remainingOmenDeckIds ?? []).map(resolveInventoryEffectId),
    };
};

const openBetrayal = async (page: Page, playerId: string): Promise<void> => {
    await page.goto(betrayalHumanTestUrl(playerId), { waitUntil: 'domcontentloaded' });
    await waitForBetrayalPageReady(page);
};

const dismissHauntRevealCueIfVisible = async (page: Page): Promise<void> => {
    const closeButton = page.getByTestId('betrayal-haunt-reveal-close');
    if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
        await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toHaveCount(0);
    }
};

const exploreGroundSouthOmenRoom = async (page: Page): Promise<void> => {
    await page.getByTestId('betrayal-action-explore').click();
    await expect(page.getByTestId('betrayal-room-explore-target-ground-south')).toBeVisible();
    await page.getByTestId('betrayal-room-ground-south').click();
    const placementPanel = page.getByTestId('betrayal-room-placement-panel');
    await expect(placementPanel).toBeVisible({ timeout: 30000 });
    const confirmButton = page.getByTestId('betrayal-room-placement-confirm');
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();
    await expect(placementPanel).toBeHidden({ timeout: 30000 });
};

test.describe('山屋惊魂木乃伊横行强制关键预兆真实探索', () => {
    test('英雄作祟后探索预兆房会强制从预兆堆找出书本', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-mummy-rampage-forced-hero-book');
        const fixture = createMummyForcedOmenCore('hero-book');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await openBetrayal(page, fixture.actorId);
        await injectCore(page, fixture.core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await dismissHauntRevealCueIfVisible(page);
        await expect.poll(() => readMummyForcedOmenEffectState(page)).toMatchObject({
            currentPlayer: fixture.actorId,
            currentInventoryEffectIds: expect.not.arrayContaining([fixture.expectedCardId]),
            remainingOmenDeckEffectIds: expect.arrayContaining([fixture.expectedCardId]),
        });
        await expect(page.getByTestId('betrayal-action-explore')).toBeEnabled();
        await saveScreenshot(page, HERO_BEFORE_SCREENSHOT);

        await exploreGroundSouthOmenRoom(page);
        const discoveryPanel = page.getByTestId('betrayal-discovery-panel');
        await expect(discoveryPanel).toBeVisible({ timeout: 30000 });
        await expect(discoveryPanel).toHaveAttribute('aria-label', new RegExp(`预兆牌 ${fixture.expectedCardName}`));
        await expect(page.getByTestId('betrayal-discovery-detail')).toContainText(fixture.forcedText);
        await expect(page.getByTestId('betrayal-discovery-resolution-step')).toContainText(`已加入持有区：${fixture.expectedCardName}`);
        await expect.poll(() => readMummyForcedOmenEffectState(page)).toMatchObject({
            currentInventoryEffectIds: expect.arrayContaining([fixture.expectedCardId]),
            latestDiscoveryTitle: fixture.expectedCardName,
            forcedOmenSearch: {
                role: 'hero-book',
                cardName: fixture.expectedCardName,
            },
            forcedOmenSearchEffectId: fixture.expectedCardId,
        });
        await saveScreenshot(page, HERO_FORCED_BOOK_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-mummy-rampage-forced-hero-book', diagnostics }]);
    });

    test('叛徒作祟后探索预兆房会强制从预兆堆找出圣符或指环', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-mummy-rampage-forced-traitor-wedding-omen');
        const fixture = createMummyForcedOmenCore('traitor-wedding-omen');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await openBetrayal(page, fixture.actorId);
        await injectCore(page, fixture.core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await dismissHauntRevealCueIfVisible(page);
        await expect.poll(() => readMummyForcedOmenEffectState(page)).toMatchObject({
            currentPlayer: fixture.actorId,
            currentInventoryEffectIds: expect.not.arrayContaining([fixture.expectedCardId]),
            remainingOmenDeckEffectIds: expect.arrayContaining([fixture.expectedCardId]),
        });
        await expect(page.getByTestId('betrayal-action-explore')).toBeEnabled();
        await saveScreenshot(page, TRAITOR_BEFORE_SCREENSHOT);

        await exploreGroundSouthOmenRoom(page);
        const discoveryPanel = page.getByTestId('betrayal-discovery-panel');
        await expect(discoveryPanel).toBeVisible({ timeout: 30000 });
        await expect(discoveryPanel).toHaveAttribute('aria-label', new RegExp(`预兆牌 ${fixture.expectedCardName}`));
        await expect(page.getByTestId('betrayal-discovery-detail')).toContainText(fixture.forcedText);
        await expect(page.getByTestId('betrayal-discovery-resolution-step')).toContainText(`已加入持有区：${fixture.expectedCardName}`);
        await expect.poll(() => readMummyForcedOmenEffectState(page)).toMatchObject({
            currentInventoryEffectIds: expect.arrayContaining([fixture.expectedCardId]),
            latestDiscoveryTitle: fixture.expectedCardName,
            forcedOmenSearch: {
                role: 'traitor-wedding-omen',
                cardName: fixture.expectedCardName,
            },
            forcedOmenSearchEffectId: fixture.expectedCardId,
        });
        await saveScreenshot(page, TRAITOR_FORCED_WEDDING_OMEN_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-mummy-rampage-forced-traitor-wedding-omen', diagnostics }]);
    });
});
