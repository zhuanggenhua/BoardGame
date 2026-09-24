import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
    clearEvidenceScreenshotsForTest,
    getEvidenceScreenshotPath,
} from '../framework/evidenceScreenshots';
import { type BetrayalCore } from '../../src/games/betrayal/game';
import { BETRAYAL_COMMANDS } from '../../src/games/betrayal/commands';
import { resolveRoomExploredCardResolutionRequiredPlayerIds } from '../../src/games/betrayal/acknowledgementReadModel';
import { BETRAYAL_DISCOVERY_POOLS } from '../../src/games/betrayal/scenarioConfig';
import {
    applyBetrayalCommand,
    createBetrayalScriptedRandom,
    createStartedFirstScenarioCore,
} from '../../src/games/betrayal/testing/firstScenarioTestUtils';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    initBetrayalContext,
    dispatchHarnessCommand,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const DISCOVERY_CONFIRM_SCREENSHOT = '01-先翻预兆并同屏显示作祟检定.jpg';
const DISCOVERY_SELF_CONFIRMED_SCREENSHOT = '01b-本人确认后显示已确认1-3.jpg';
const REVEAL_READER_SCREENSHOT = '02-确认预兆后打开剧本书.jpg';
const DISCOVERY_DONE_SCREENSHOT = '03-关闭剧本书后回到作祟牌桌.jpg';
const REMOTE_VIEWER_DISCOVERY_SCREENSHOT = '04-旁观视角先看触发预兆和检定.jpg';
const SAFE_OMEN_CONFIRM_SCREENSHOT = '05-未触发作祟-同屏确认预兆与作祟检定.jpg';
const SAFE_OMEN_SELF_CONFIRMED_SCREENSHOT = '05b-未触发作祟-本人确认后显示已确认1-3.jpg';
const SAFE_OMEN_DONE_SCREENSHOT = '07-未触发作祟-确认后回恶兆前牌桌.jpg';
const SAFE_OMEN_MATRIX_FIRST_CARD_SCREENSHOT = '08-当前9张预兆矩阵-首张同屏确认.jpg';
const SAFE_OMEN_MATRIX_DONE_SCREENSHOT = '09-当前9张预兆矩阵-末张确认后持有区.jpg';
const HAUNT_OMEN_MATRIX_REVEAL_SCREENSHOT = '10-当前9张预兆触发矩阵-首张先翻预兆.jpg';
const HAUNT_OMEN_MATRIX_DONE_SCREENSHOT = '11-当前9张预兆触发矩阵-末张确认后作祟牌桌.jpg';
const TEST_URL = '/play/betrayal?players=3&playerID=0&seat0=human&seat1=human&seat2=human&seed=haunt-reveal-discovery-confirmation';

type OmenDiscoveryCard = BetrayalCore['possessionOrderByKind']['omen'][number];
type ItemDiscoveryCard = BetrayalCore['possessionOrderByKind']['item'][number];

const CURRENT_OMEN_DISCOVERY_CARDS: OmenDiscoveryCard[] =
    BETRAYAL_DISCOVERY_POOLS.possessions.omen.map((omen) => ({ ...omen }));
const CURRENT_ITEM_DISCOVERY_CARDS: ItemDiscoveryCard[] =
    BETRAYAL_DISCOVERY_POOLS.possessions.item.map((item) => ({ ...item }));

const DOG_OMEN_CARD =
    CURRENT_OMEN_DISCOVERY_CARDS.find((omen) => omen.id === 'dog') ??
    ({ id: 'dog', name: '狗', kind: 'omen' } satisfies OmenDiscoveryCard);
const BOOK_OMEN_CARD =
    CURRENT_OMEN_DISCOVERY_CARDS.find((omen) => omen.id === 'omen-book') ??
    ({ id: 'omen-book', name: '书', kind: 'omen' } satisfies OmenDiscoveryCard);
const MASK_OMEN_CARD =
    CURRENT_OMEN_DISCOVERY_CARDS.find((omen) => omen.id === 'mask') ??
    ({ id: 'mask', name: '面具', kind: 'omen' } satisfies OmenDiscoveryCard);
const SKULL_OMEN_CARD =
    CURRENT_OMEN_DISCOVERY_CARDS.find((omen) => omen.id === 'skull') ??
    ({ id: 'skull', name: '骷髅', kind: 'omen' } satisfies OmenDiscoveryCard);
const MEDICAL_KIT_ITEM_CARD =
    CURRENT_ITEM_DISCOVERY_CARDS.find((item) => item.id === 'medical-kit') ??
    ({ id: 'medical-kit', name: '急救包', kind: 'item' } satisfies ItemDiscoveryCard);
const LUCKY_COIN_ITEM_CARD =
    CURRENT_ITEM_DISCOVERY_CARDS.find((item) => item.id === 'lucky-coin') ??
    ({ id: 'lucky-coin', name: '幸运硬币', kind: 'item' } satisfies ItemDiscoveryCard);
const HELD_OMEN_CARDS = [BOOK_OMEN_CARD, MASK_OMEN_CARD, SKULL_OMEN_CARD] as const;

function pickVisibleHeldOmenCards(excludedCardId: string): OmenDiscoveryCard[] {
    const preferredCards = [
        ...HELD_OMEN_CARDS,
        ...CURRENT_OMEN_DISCOVERY_CARDS,
    ].filter((card) => card.id !== excludedCardId);
    const byId = new Map(preferredCards.map((card) => [card.id, card]));
    const cards = [...byId.values()].slice(0, 3);
    if (cards.length < 3) {
        throw new Error('山屋 E2E 缺少足够真实预兆卡来构造作祟检定压力态');
    }
    return cards.map((card) => ({ ...card }));
}

function cloneExplorerForFixture(
    explorer: BetrayalCore['currentExplorer'],
): BetrayalCore['currentExplorer'] {
    return {
        ...explorer,
        traits: { ...explorer.traits },
        traitTracks: Object.fromEntries(
            Object.entries(explorer.traitTracks).map(([trait, track]) => [
                trait,
                { ...track, values: [...track.values] },
            ]),
        ) as BetrayalCore['currentExplorer']['traitTracks'],
        inventory: explorer.inventory.map((card) => ({ ...card })),
    };
}

function focusFixtureOnPlayer(core: BetrayalCore, playerId: string): BetrayalCore {
    const explorers = [core.currentExplorer, ...core.otherExplorers].map(cloneExplorerForFixture);
    const currentExplorer = explorers.find((explorer) => explorer.playerId === playerId);
    if (!currentExplorer) {
        throw new Error(`普通预兆作祟 E2E 夹具缺少玩家：${playerId}`);
    }
    return {
        ...core,
        currentPlayer: playerId,
        currentExplorer,
        otherExplorers: explorers.filter((explorer) => explorer.playerId !== playerId),
        activeRoomId: currentExplorer.roomId,
        currentExplorerRoomId: currentExplorer.roomId,
        currentExplorerTraits: { ...currentExplorer.traits },
        currentExplorerInventory: currentExplorer.inventory.map((card) => ({ ...card })),
        turnStartInventoryCardIds: currentExplorer.inventory.map((card) => card.id),
    };
}

type HauntDiscoveryConfirmationState = {
    phase?: string;
    currentPlayer?: string;
    hauntRevealerPlayerId?: string | null;
    latestDiscoveryTitle?: string | null;
    latestDiscoveryKind?: string | null;
    currentInventory?: Array<{
        id?: string;
        name?: string;
        kind?: string;
    }>;
    explorers?: Array<{
        playerId?: string;
        inventory?: Array<{
            id?: string;
            name?: string;
            kind?: string;
        }>;
    }>;
    pendingSteps?: Array<{
        stepKind?: string;
        index?: number;
        total?: number;
        cardName?: string;
    }>;
    rejected?: { commandType?: string; error?: string } | null;
};

function createOmenHauntPendingResolutionCore(
    omenCard: OmenDiscoveryCard = DOG_OMEN_CARD,
    actorPlayerId = '0',
): BetrayalCore {
    let core = createStartedFirstScenarioCore(['0', '1', '2']);
    core = focusFixtureOnPlayer(core, actorPlayerId);
    core.drawOrder = ['omen'];
    core.possessionOrderByKind.omen = [
        { ...omenCard },
    ];
    const heldOmenCards = pickVisibleHeldOmenCards(omenCard.id);
    core.currentExplorer.inventory = [
        { ...heldOmenCards[0]! },
    ];
    core.currentExplorerInventory = [...core.currentExplorer.inventory];
    core.otherExplorers = core.otherExplorers.map((explorer, index) => ({
        ...explorer,
        inventory: [
            { ...heldOmenCards[index + 1]! },
        ],
    }));

    core = applyBetrayalCommand(
        core,
        BETRAYAL_COMMANDS.EXPLORE_ROOM,
        actorPlayerId,
        { roomId: 'ground-east' },
        100,
        createBetrayalScriptedRandom(3, 3, 3, 3),
    );

    if (core.phase !== 'haunt' || !core.scenarioRuntime.hauntTriggered) {
        throw new Error('普通预兆作祟 E2E 夹具未触发作祟');
    }
    if (core.latestDiscovery?.kind !== 'omen') {
        throw new Error('普通预兆作祟 E2E 夹具缺少预兆发现');
    }
    if (core.latestDiscovery.title !== omenCard.name) {
        throw new Error(`普通预兆作祟 E2E 夹具翻出的不是预期预兆：${omenCard.name}`);
    }
    if (core.latestDiscovery.resolutionSteps?.length !== 2) {
        throw new Error('普通预兆作祟 E2E 夹具必须保留获得预兆和作祟检定两条结果事实');
    }
    if (core.pendingCardResolutionQueue.length !== 1) {
        throw new Error('普通预兆作祟 E2E 夹具必须只保留一次玩家确认');
    }
    if (
        core.pendingCardResolutionQueue[0]?.stepKind !== 'drawn-card'
        || core.pendingCardResolutionQueue[0]?.total !== 1
        || core.pendingCardResolutionQueue[0]?.requiredPlayerIds?.length !== 3
    ) {
        throw new Error('普通预兆作祟 E2E 必须是一个确认步骤，但仍要求 3 名玩家逐一确认');
    }
    return core;
}

function createSafeOmenPendingResolutionCore(
    omenCard: OmenDiscoveryCard = DOG_OMEN_CARD,
): BetrayalCore {
    let core = createStartedFirstScenarioCore(['0', '1', '2']);
    core.drawOrder = ['omen'];
    core.possessionOrderByKind.omen = [
        { ...omenCard },
    ];
    core.currentExplorer.inventory = [];
    core.currentExplorerInventory = [];
    core.otherExplorers = core.otherExplorers.map((explorer) => ({
        ...explorer,
        inventory: [],
    }));

    core = applyBetrayalCommand(
        core,
        BETRAYAL_COMMANDS.EXPLORE_ROOM,
        '0',
        { roomId: 'ground-east' },
        100,
        createBetrayalScriptedRandom(1, 1, 1, 1),
    );

    if (core.phase !== 'preHaunt' || core.scenarioRuntime.hauntTriggered) {
        throw new Error('普通预兆未触发作祟 E2E 夹具不应进入作祟');
    }
    if (core.latestDiscovery?.kind !== 'omen') {
        throw new Error('普通预兆未触发作祟 E2E 夹具缺少预兆发现');
    }
    if (core.latestDiscovery.resolutionSteps?.length !== 2) {
        throw new Error('普通预兆未触发作祟 E2E 夹具必须保留获得预兆和作祟检定两条结果事实');
    }
    if (core.pendingCardResolutionQueue.length !== 1) {
        throw new Error('普通预兆未触发作祟 E2E 夹具必须只保留一次玩家确认');
    }
    if (
        core.pendingCardResolutionQueue[0]?.stepKind !== 'drawn-card'
        || core.pendingCardResolutionQueue[0]?.total !== 1
        || core.pendingCardResolutionQueue[0]?.requiredPlayerIds?.length !== 3
    ) {
        throw new Error('普通预兆未触发作祟 E2E 必须是一个确认步骤，但仍要求 3 名玩家逐一确认');
    }
    return core;
}

function createItemPendingResolutionCore(
    itemCard: ItemDiscoveryCard,
    actorPlayerId = '0',
): BetrayalCore {
    let core = createStartedFirstScenarioCore(['0', '1', '2']);
    core = focusFixtureOnPlayer(core, actorPlayerId);
    core.currentExplorer.inventory = [{ ...itemCard }];
    core.currentExplorerInventory = [{ ...itemCard }];
    core.otherExplorers = core.otherExplorers.map((explorer) => ({
        ...explorer,
        inventory: [],
    }));
    core.latestDiscovery = {
        kind: 'item',
        title: itemCard.name,
        summary: '获得物品',
        detail: '',
        tone: 'accent',
    };
    core.latestDiscoveryOwnerPlayerId = '0';
    const requiredPlayerIds = resolveRoomExploredCardResolutionRequiredPlayerIds(core, {
        payload: {
            playerId: '0',
            deckKind: 'item',
            drawnCard: itemCard,
            roomDiscoveryCards: [],
            buriedRoomDiscoveryCards: [],
        },
    });
    core.pendingCardResolutionQueue = [{
        id: `e2e-item-${itemCard.id}-resolution`,
        playerId: '0',
        requiredPlayerIds: [...requiredPlayerIds],
        acknowledgedPlayerIds: [],
        deckKind: 'item',
        cardId: itemCard.id,
        cardName: itemCard.name,
        discoveryTitle: itemCard.name,
        stepKind: 'drawn-card',
        text: '',
        index: 1,
        total: 1,
    }];
    return core;
}

const readHauntDiscoveryConfirmationState = async (
    page: Page,
): Promise<HauntDiscoveryConfirmationState> =>
    page.evaluate(() => {
        const holder = window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            phase?: string;
                            currentPlayer?: string;
                            currentExplorer?: {
                                inventory?: Array<{
                                    id?: string;
                                    name?: string;
                                    kind?: string;
                                }>;
                            };
                            latestDiscovery?: {
                                title?: string;
                                kind?: string;
                            } | null;
                            scenarioRuntime?: {
                                hauntRevealerPlayerId?: string | null;
                            };
                            pendingCardResolutionQueue?: Array<{
                                stepKind?: string;
                                index?: number;
                                total?: number;
                                cardName?: string;
                            }>;
                            currentExplorer?: {
                                playerId?: string;
                                inventory?: Array<{
                                    id?: string;
                                    name?: string;
                                    kind?: string;
                                }>;
                            };
                            otherExplorers?: Array<{
                                playerId?: string;
                                inventory?: Array<{
                                    id?: string;
                                    name?: string;
                                    kind?: string;
                                }>;
                            }>;
                        };
                    };
                };
            };
            __BG_LAST_COMMAND_REJECTED__?: { commandType?: string; error?: string } | null;
        };
        const core = holder.__BG_TEST_HARNESS__?.state?.get?.()?.core;
        const explorers = [
            core?.currentExplorer,
            ...(core?.otherExplorers ?? []),
        ].filter((explorer): explorer is NonNullable<typeof explorer> => Boolean(explorer));
        return {
            phase: core?.phase,
            currentPlayer: core?.currentPlayer,
            hauntRevealerPlayerId: core?.scenarioRuntime?.hauntRevealerPlayerId ?? null,
            latestDiscoveryTitle: core?.latestDiscovery?.title ?? null,
            latestDiscoveryKind: core?.latestDiscovery?.kind ?? null,
            currentInventory: core?.currentExplorer?.inventory?.map((card) => ({
                id: card.id,
                name: card.name,
                kind: card.kind,
            })) ?? [],
            explorers: explorers.map((explorer) => ({
                playerId: explorer.playerId,
                inventory: explorer.inventory?.map((card) => ({
                    id: card.id,
                    name: card.name,
                    kind: card.kind,
                })) ?? [],
            })),
            pendingSteps: core?.pendingCardResolutionQueue?.map((step) => ({
                stepKind: step.stepKind,
                index: step.index,
                total: step.total,
                cardName: step.cardName,
            })) ?? [],
            rejected: holder.__BG_LAST_COMMAND_REJECTED__ ?? null,
        };
    });

const closeScenarioReaderIfPresent = async (page: Page): Promise<void> => {
    const scenarioReader = page.getByTestId('betrayal-scenario-reader-dialog');
    if (!await scenarioReader.isVisible({ timeout: 800 }).catch(() => false)) {
        return;
    }
    await expect(scenarioReader).toContainText(/剧本1|序章/);
    await page.getByTestId('betrayal-scenario-reader-close').click();
    await expect(scenarioReader).toHaveCount(0);
};

async function saveEvidenceScreenshot(page: Page, testInfo: TestInfo, filename: string): Promise<void> {
    await saveScreenshot(
        page,
        getEvidenceScreenshotPath(testInfo, filename, {
            filename,
            requireChineseName: true,
        }),
    );
}

async function acknowledgeRemainingPlayers(page: Page): Promise<void> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const pending = await page.evaluate(() => (
            (window as typeof window & { __BG_TEST_HARNESS__?: { state?: { get?: () => { core?: BetrayalCore } } } })
                .__BG_TEST_HARNESS__?.state?.get?.().core?.pendingCardResolutionQueue?.[0]
        ));
        if (!pending) return;
        const requiredPlayerIds = pending.requiredPlayerIds?.length ? pending.requiredPlayerIds : [pending.playerId];
        const nextPlayerId = requiredPlayerIds.find((playerId) => !(pending.acknowledgedPlayerIds ?? []).includes(playerId));
        if (!nextPlayerId) return;
        await dispatchHarnessCommand(page, BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION, nextPlayerId, { resolutionId: pending.id });
    }
    throw new Error('山屋预兆矩阵确认队列超过安全上限');
}

test.beforeEach(async ({ page: _page }, testInfo) => {
    await clearEvidenceScreenshotsForTest(testInfo);
});

test('普通预兆触发作祟时先确认预兆和检定，再承接作祟揭示', async ({ page, context }, testInfo) => {
    test.setTimeout(120000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, 'betrayal-haunt-reveal-discovery-confirmation');

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForBetrayalPageReady(page);
    await injectCore(page, createOmenHauntPendingResolutionCore());
    await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });

    await expect(page.getByTestId('betrayal-haunt-reveal-cue'), '预兆卡确认前作祟揭示横幅不得抢先出现').toHaveCount(0);
    await expect(page.getByTestId('betrayal-scenario-reader-dialog'), '预兆卡确认前不得自动打开剧本书').toHaveCount(0);
    const discoveryPanel = page.getByTestId('betrayal-discovery-panel');
    await expect(discoveryPanel, '触发作祟的预兆卡必须先显示').toBeVisible({ timeout: 10000 });
    await expect(discoveryPanel).toContainText(DOG_OMEN_CARD.name);
    await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toHaveText('确认 0/3');
    await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toHaveAttribute(
        'data-pending-card-resolution-step',
        '1/1',
    );
    await expect(discoveryPanel.getByTestId('betrayal-recent-roll-panel')).toBeVisible();
    await expect(discoveryPanel.getByTestId('betrayal-house-dice-3d-group')).toBeVisible();
    await expect(discoveryPanel.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-count', '4');
    await expect(discoveryPanel.getByTestId('betrayal-recent-roll-total')).toContainText('总点数');
    await expect(discoveryPanel.getByTestId('betrayal-recent-roll-panel')).toContainText('达到 5 点或以上：作祟开始');
    await expect(discoveryPanel.getByTestId('betrayal-recent-roll-panel')).toContainText('低于 5 点：未触发作祟');
    const diceGroup = discoveryPanel.getByTestId('betrayal-house-dice-3d-group');
    await expect.poll(
        () => diceGroup.getAttribute('data-dice-physics-motion'),
        { timeout: 15000 },
    ).toBe('rolling');
    await saveEvidenceScreenshot(page, testInfo, '01a-作祟检定-物理骰子滚动中.jpg');
    await expect.poll(
        () => diceGroup.getAttribute('data-dice-physics-motion'),
        { timeout: 15000 },
    ).toBe('settled');
    await saveEvidenceScreenshot(page, testInfo, '01c-作祟检定-物理骰子停稳后-确认0-3.jpg');
    await expect.poll(() => readHauntDiscoveryConfirmationState(page)).toMatchObject({
        phase: 'haunt',
        latestDiscoveryTitle: DOG_OMEN_CARD.name,
        latestDiscoveryKind: 'omen',
        pendingSteps: [
            { stepKind: 'drawn-card', index: 1, total: 1, cardName: DOG_OMEN_CARD.name },
        ],
        rejected: null,
    });
    await expect.poll(() => readHauntDiscoveryConfirmationState(page)).toMatchObject({
        pendingSteps: [
            { stepKind: 'drawn-card', index: 1, total: 1, cardName: DOG_OMEN_CARD.name },
        ],
        rejected: null,
    });
    await saveEvidenceScreenshot(page, testInfo, DISCOVERY_CONFIRM_SCREENSHOT);

    await discoveryPanel.getByTestId('betrayal-discovery-continue').click();
    await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toHaveText('已确认 1/3');
    await saveEvidenceScreenshot(page, testInfo, DISCOVERY_SELF_CONFIRMED_SCREENSHOT);
    await acknowledgeRemainingPlayers(page);
    await expect(discoveryPanel).toHaveCount(0);
    const scenarioReader = page.getByTestId('betrayal-scenario-reader-dialog');
    await expect(scenarioReader, '确认触发来源后才自动打开一次剧本书').toBeVisible({ timeout: 10000 });
    await expect(scenarioReader).toContainText(/剧本1|序章/);
    await saveEvidenceScreenshot(page, testInfo, REVEAL_READER_SCREENSHOT);
    await page.getByTestId('betrayal-scenario-reader-close').click();
    await expect(scenarioReader).toHaveCount(0);
    await expect(page.getByTestId('betrayal-haunt-reveal-cue'), '剧本书已承接本次作祟开始后，不再追加作祟横幅').toHaveCount(0);
    await expect(page.getByTestId('betrayal-discovery-panel'), '已确认过的预兆卡关闭剧本书后不得重复弹出').toHaveCount(0);
    await expect(page.getByTestId('betrayal-open-scenario')).toBeVisible();
    await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/作祟中|恶兆后|Haunt/i);
    await expect.poll(() => readHauntDiscoveryConfirmationState(page)).toMatchObject({
        phase: 'haunt',
        pendingSteps: [],
        rejected: null,
    });
    await saveEvidenceScreenshot(page, testInfo, DISCOVERY_DONE_SCREENSHOT);

    await assertNoFatalFrontendErrors([
        { label: 'betrayal-haunt-reveal-discovery-confirmation', diagnostics },
    ]);
});

test('旁观视角也先看触发预兆和检定，再本地进入剧本阅读', async ({ page, context }, testInfo) => {
    test.setTimeout(120000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, 'betrayal-haunt-reveal-remote-viewer-confirmation');

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForBetrayalPageReady(page);
    await injectCore(page, createOmenHauntPendingResolutionCore(DOG_OMEN_CARD, '1'));
    await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });

    await expect(page.getByTestId('betrayal-haunt-reveal-cue'), '旁观视角在看完触发预兆结果前不得先显示作祟揭示').toHaveCount(0);
    await expect(page.getByTestId('betrayal-scenario-reader-dialog'), '旁观视角在看完触发预兆结果前不得先打开剧本书').toHaveCount(0);
    const discoveryPanel = page.getByTestId('betrayal-discovery-panel');
    await expect(discoveryPanel, '旁观视角也必须先看到触发作祟的预兆结果').toBeVisible({ timeout: 10000 });
    await expect(discoveryPanel).toContainText(DOG_OMEN_CARD.name);
    await expect(discoveryPanel.getByTestId('betrayal-recent-roll-panel')).toBeVisible();
    await expect(discoveryPanel.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-count', '4');
    await expect.poll(() => readHauntDiscoveryConfirmationState(page)).toMatchObject({
        phase: 'haunt',
        latestDiscoveryTitle: DOG_OMEN_CARD.name,
        latestDiscoveryKind: 'omen',
        pendingSteps: [
            { stepKind: 'drawn-card', index: 1, total: 1, cardName: DOG_OMEN_CARD.name },
        ],
        rejected: null,
    });
    await saveEvidenceScreenshot(page, testInfo, REMOTE_VIEWER_DISCOVERY_SCREENSHOT);

    await discoveryPanel.getByTestId('betrayal-discovery-continue').click();
    await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toHaveText('已确认 1/3');
    await acknowledgeRemainingPlayers(page);
    await expect(discoveryPanel).toHaveCount(0);
    const scenarioReader = page.getByTestId('betrayal-scenario-reader-dialog');
    await expect(scenarioReader, '旁观者本地确认看完结果后才进入剧本阅读').toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('betrayal-scenario-reader-next-zone')).toBeVisible();
    await page.getByTestId('betrayal-scenario-reader-next-zone').click();
    await expect(scenarioReader).toContainText('木乃伊横行');
    await expect.poll(() => readHauntDiscoveryConfirmationState(page)).toMatchObject({
        pendingSteps: [],
        rejected: null,
    });

    await assertNoFatalFrontendErrors([
        { label: 'betrayal-haunt-reveal-remote-viewer-confirmation', diagnostics },
    ]);
});

test('普通预兆未触发作祟时同屏显示获得预兆和作祟检定且所有玩家完成一个确认步骤', async ({ page, context }, testInfo) => {
    test.setTimeout(120000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, 'betrayal-safe-omen-discovery-confirmation');

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForBetrayalPageReady(page);
    await injectCore(page, createSafeOmenPendingResolutionCore());
    await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });

    await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toHaveCount(0);
    const discoveryPanel = page.getByTestId('betrayal-discovery-panel');
    await expect(discoveryPanel).toBeVisible({ timeout: 10000 });
    await expect(discoveryPanel).toContainText('狗');
    await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toHaveText('确认 0/3');
    await expect(discoveryPanel.getByTestId('betrayal-recent-roll-panel')).toContainText('低于 5 点：未触发作祟');
    await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toHaveAttribute(
        'data-pending-card-resolution-step',
        '1/1',
    );
    await expect.poll(() => readHauntDiscoveryConfirmationState(page)).toMatchObject({
        phase: 'preHaunt',
        latestDiscoveryTitle: '狗',
        latestDiscoveryKind: 'omen',
        pendingSteps: [
            { stepKind: 'drawn-card', index: 1, total: 1, cardName: '狗' },
        ],
        rejected: null,
    });
    await saveEvidenceScreenshot(page, testInfo, SAFE_OMEN_CONFIRM_SCREENSHOT);

    await discoveryPanel.getByTestId('betrayal-discovery-continue').click();
    await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toHaveText('已确认 1/3');
    await saveEvidenceScreenshot(page, testInfo, SAFE_OMEN_SELF_CONFIRMED_SCREENSHOT);
    await acknowledgeRemainingPlayers(page);
    await expect(discoveryPanel).toHaveCount(0);
    await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toHaveCount(0);
    await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/作祟前|恶兆前|pre-haunt/i);
    await expect(page.locator('[data-testid="betrayal-inventory-dog-0"]')).toBeVisible();
    await expect(page.getByTestId('betrayal-deck-resolution-ledger')).toHaveCount(0);
    await expect(page.getByTestId('betrayal-deck-resolution-ledger-step')).toHaveCount(0);
    await expect.poll(() => readHauntDiscoveryConfirmationState(page)).toMatchObject({
        phase: 'preHaunt',
        pendingSteps: [],
        rejected: null,
    });
    await saveEvidenceScreenshot(page, testInfo, SAFE_OMEN_DONE_SCREENSHOT);

    await assertNoFatalFrontendErrors([
        { label: 'betrayal-safe-omen-discovery-confirmation', diagnostics },
    ]);
});

test('普通物品停留三秒后自动飞入持有区，未来可改写骰子的物品也不额外扩大确认', async ({ page, context }, testInfo) => {
    test.setTimeout(120000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, 'betrayal-item-discovery-confirmation-rules');

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForBetrayalPageReady(page);

    await injectCore(page, createItemPendingResolutionCore(MEDICAL_KIT_ITEM_CARD));
    const ordinaryPanel = page.getByTestId('betrayal-discovery-panel');
    await expect(ordinaryPanel).toBeVisible({ timeout: 10000 });
    await expect(ordinaryPanel).toContainText(MEDICAL_KIT_ITEM_CARD.name);
    await expect(ordinaryPanel.getByTestId('betrayal-discovery-continue')).toHaveText('确认 0/1');
    await saveEvidenceScreenshot(page, testInfo, '物品-普通物品-三秒等待中.jpg');
    await page.waitForTimeout(2500);
    await expect(ordinaryPanel).toBeVisible();
    await expect(ordinaryPanel.getByTestId('betrayal-discovery-continue')).toHaveText('确认 0/1');
    await expect.poll(
        () => readHauntDiscoveryConfirmationState(page),
        { timeout: 10000 },
    ).toMatchObject({ pendingSteps: [] });
    await expect(ordinaryPanel).toHaveCount(0);
    await expect(page.getByTestId('betrayal-inventory-medical-kit')).toBeVisible();
    await saveEvidenceScreenshot(page, testInfo, '物品-普通物品-三秒后进入持有区.jpg');

    await injectCore(page, createItemPendingResolutionCore(LUCKY_COIN_ITEM_CARD));
    const diceModifierPanel = page.getByTestId('betrayal-discovery-panel');
    await expect(diceModifierPanel).toBeVisible({ timeout: 10000 });
    await expect(diceModifierPanel).toContainText(LUCKY_COIN_ITEM_CARD.name);
    await expect(diceModifierPanel.getByTestId('betrayal-discovery-continue')).toHaveText('确认 0/1');
    await page.waitForTimeout(2500);
    await expect(diceModifierPanel).toBeVisible();
    await expect(diceModifierPanel.getByTestId('betrayal-discovery-continue')).toHaveText('确认 0/1');
    await saveEvidenceScreenshot(page, testInfo, '物品-幸运硬币-三秒等待中.jpg');
    await expect.poll(
        () => readHauntDiscoveryConfirmationState(page),
        { timeout: 10000 },
    ).toMatchObject({ pendingSteps: [] });
    await expect(diceModifierPanel).toHaveCount(0);
    await expect(page.getByTestId('betrayal-inventory-lucky-coin')).toBeVisible();
    await saveEvidenceScreenshot(page, testInfo, '物品-幸运硬币-三秒后进入持有区.jpg');

    await assertNoFatalFrontendErrors([
        { label: 'betrayal-item-discovery-confirmation-rules', diagnostics },
    ]);
});

test('物品展示手机横屏不越界且默认保留本地玩家持有区', async ({ page, context }, testInfo) => {
    test.setTimeout(120000);
    await initBetrayalContext(context);
    await warmBetrayalFrontend(context);

    await page.setViewportSize({ width: 936, height: 432 });
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForBetrayalPageReady(page);

    const core = createItemPendingResolutionCore(MEDICAL_KIT_ITEM_CARD, '1');
    core.otherExplorers = core.otherExplorers.map((explorer) => (
        explorer.playerId === '0'
            ? { ...explorer, inventory: [{ id: 'map', name: '地图', kind: 'item' }] }
            : explorer
    ));
    await injectCore(page, core);

    await expect(page.getByTestId('betrayal-discovery-panel')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('betrayal-observed-explorer-panel')).toHaveAttribute('data-player-id', '0');
    await expect(page.getByTestId('betrayal-inventory-section')).toHaveAttribute('data-player-id', '0');
    await expect(page.getByTestId('betrayal-inventory-map')).toBeVisible();
    await expect(page.getByTestId('betrayal-inventory-section')).not.toContainText('急救包');
    await page.waitForTimeout(500);
    await saveEvidenceScreenshot(page, testInfo, '物品展示-手机横屏-本地持有区与顶部边界稳定.jpg');

    const metrics = await page.evaluate(() => {
        const selectors = [
            '[data-testid="betrayal-runtime-header-grid"]',
            '[data-testid="betrayal-status-chip"]',
            '[data-testid="betrayal-discovery-panel"]',
            '[data-testid="betrayal-discovery-panel-content"]',
            '[data-testid="betrayal-discovery-card-front-atlas"]',
            '[data-testid="betrayal-left-status-rail"]',
            '[data-testid="betrayal-inventory-section"]',
        ];
        const rect = (selector: string) => {
            const element = document.querySelector<HTMLElement>(selector);
            if (!element) return null;
            const box = element.getBoundingClientRect();
            return {
                left: Number(box.left.toFixed(2)),
                top: Number(box.top.toFixed(2)),
                right: Number(box.right.toFixed(2)),
                bottom: Number(box.bottom.toFixed(2)),
            };
        };
        return {
            viewport: { width: window.innerWidth, height: window.innerHeight },
            documentWidth: document.documentElement.scrollWidth,
            bodyWidth: document.body.scrollWidth,
            elements: Object.fromEntries(selectors.map((selector) => [selector, rect(selector)])),
        };
    });

    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewport.width + 1);
    expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewport.width + 1);
    for (const [selector, box] of Object.entries(metrics.elements)) {
        expect(box, `${selector} 应存在`).not.toBeNull();
        expect(box!.left, `${selector} 左侧越界`).toBeGreaterThanOrEqual(-1);
        expect(box!.top, `${selector} 顶部越界`).toBeGreaterThanOrEqual(-1);
        expect(box!.right, `${selector} 右侧越界`).toBeLessThanOrEqual(metrics.viewport.width + 1);
        expect(box!.bottom, `${selector} 底部越界`).toBeLessThanOrEqual(metrics.viewport.height + 1);
    }
});

test('当前9张预兆未触发作祟时均需所有玩家完成一个确认步骤并进入持有区', async ({ page, context }, testInfo) => {
    test.setTimeout(240000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, 'betrayal-safe-omen-discovery-matrix');

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForBetrayalPageReady(page);

    for (const [index, omenCard] of CURRENT_OMEN_DISCOVERY_CARDS.entries()) {
        await injectCore(page, createSafeOmenPendingResolutionCore(omenCard));
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toHaveCount(0);

        const discoveryPanel = page.getByTestId('betrayal-discovery-panel');
        await expect(discoveryPanel, `预兆「${omenCard.name}」应显示发现确认面板`).toBeVisible({
            timeout: 10000,
        });
        await expect(discoveryPanel).toContainText(omenCard.name);
        await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toHaveText('确认 0/3');
        await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toHaveAttribute(
            'data-pending-card-resolution-step',
            '1/1',
        );
        await expect.poll(() => readHauntDiscoveryConfirmationState(page)).toMatchObject({
            phase: 'preHaunt',
            latestDiscoveryTitle: omenCard.name,
            latestDiscoveryKind: 'omen',
            pendingSteps: [
                { stepKind: 'drawn-card', index: 1, total: 1, cardName: omenCard.name },
            ],
            rejected: null,
        });

        if (index === 0) {
            await saveEvidenceScreenshot(page, testInfo, SAFE_OMEN_MATRIX_FIRST_CARD_SCREENSHOT);
        }

        await discoveryPanel.getByTestId('betrayal-discovery-continue').click();
        await acknowledgeRemainingPlayers(page);
        await expect(discoveryPanel).toHaveCount(0);
        await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/作祟前|恶兆前|pre-haunt/i);
        await expect(page.getByTestId('betrayal-inventory-row-omen')).toContainText(omenCard.name);
        await expect.poll(async () => {
            const state = await readHauntDiscoveryConfirmationState(page);
            return Boolean(
                state.currentInventory?.some((card) => (
                    card.kind === 'omen' &&
                    card.id?.startsWith(omenCard.id) &&
                    card.name === omenCard.name
                )),
            );
        }).toBe(true);
        await expect.poll(() => readHauntDiscoveryConfirmationState(page)).toMatchObject({
            phase: 'preHaunt',
            pendingSteps: [],
            rejected: null,
        });

        if (index === CURRENT_OMEN_DISCOVERY_CARDS.length - 1) {
            await saveEvidenceScreenshot(page, testInfo, SAFE_OMEN_MATRIX_DONE_SCREENSHOT);
        }
    }

    await assertNoFatalFrontendErrors([
        { label: 'betrayal-safe-omen-discovery-matrix', diagnostics },
    ]);
});

test('当前9张预兆触发作祟时均先确认预兆和检定，再进入作祟承接', async ({ page, context }, testInfo) => {
    test.setTimeout(300000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, 'betrayal-haunt-omen-discovery-matrix');

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForBetrayalPageReady(page);

    for (const [index, omenCard] of CURRENT_OMEN_DISCOVERY_CARDS.entries()) {
        await injectCore(page, createOmenHauntPendingResolutionCore(omenCard));
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });

        const revealCue = page.getByTestId('betrayal-haunt-reveal-cue');
        await expect(revealCue, `预兆「${omenCard.name}」确认前作祟揭示横幅不得抢先出现`).toHaveCount(0);
        await expect(page.getByTestId('betrayal-scenario-reader-dialog'), `预兆「${omenCard.name}」确认前不得自动打开剧本书`).toHaveCount(0);
        await expect.poll(() => readHauntDiscoveryConfirmationState(page)).toMatchObject({
            phase: 'haunt',
            latestDiscoveryTitle: omenCard.name,
            latestDiscoveryKind: 'omen',
            pendingSteps: [
                { stepKind: 'drawn-card', index: 1, total: 1, cardName: omenCard.name },
            ],
            rejected: null,
        });

        const discoveryPanel = page.getByTestId('betrayal-discovery-panel');
        await expect(discoveryPanel, `预兆「${omenCard.name}」触发作祟时应先显示发现确认面板`).toBeVisible({
            timeout: 10000,
        });
        await expect(discoveryPanel).toContainText(omenCard.name);
        await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toHaveText('确认 0/3');
        await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toHaveAttribute(
            'data-pending-card-resolution-step',
            '1/1',
        );
        await expect(discoveryPanel.getByTestId('betrayal-recent-roll-panel')).toBeVisible();
        await expect(discoveryPanel.getByTestId('betrayal-house-dice-3d-group')).toBeVisible();
        await expect(discoveryPanel.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-count', '4');
        await expect(discoveryPanel.getByTestId('betrayal-recent-roll-total')).toContainText('总点数');
        if (index === 0) {
            await saveEvidenceScreenshot(page, testInfo, HAUNT_OMEN_MATRIX_REVEAL_SCREENSHOT);
        }

        await discoveryPanel.getByTestId('betrayal-discovery-continue').click();
        await acknowledgeRemainingPlayers(page);
        await expect(discoveryPanel).toHaveCount(0);
        await expect(page.getByTestId('betrayal-scenario-reader-dialog'), `预兆「${omenCard.name}」确认后才打开剧本书承接`).toBeVisible({
            timeout: 10000,
        });
        await closeScenarioReaderIfPresent(page);
        await expect(revealCue, `预兆「${omenCard.name}」剧本书承接后不得再显示作祟揭示横幅`).toHaveCount(0);
        await expect(page.getByTestId('betrayal-discovery-panel'), `预兆「${omenCard.name}」确认过后关闭剧本书不得重复弹出`).toHaveCount(0);
        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/作祟中|恶兆后|Haunt/i);
        await expect.poll(async () => {
            const state = await readHauntDiscoveryConfirmationState(page);
            const revealer = state.explorers?.find((explorer) => (
                explorer.playerId === state.hauntRevealerPlayerId
            ));
            return Boolean(
                revealer?.inventory?.some((card) => (
                    card.kind === 'omen' &&
                    card.id?.startsWith(omenCard.id) &&
                    card.name === omenCard.name
                )),
            );
        }).toBe(true);
        await expect.poll(() => readHauntDiscoveryConfirmationState(page)).toMatchObject({
            phase: 'haunt',
            pendingSteps: [],
            rejected: null,
        });

        if (index === CURRENT_OMEN_DISCOVERY_CARDS.length - 1) {
            await saveEvidenceScreenshot(page, testInfo, HAUNT_OMEN_MATRIX_DONE_SCREENSHOT);
        }
    }

    await assertNoFatalFrontendErrors([
        { label: 'betrayal-haunt-omen-discovery-matrix', diagnostics },
    ]);
});
