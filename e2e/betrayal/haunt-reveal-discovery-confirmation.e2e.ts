import { expect, test, type Page } from '@playwright/test';
import {
    BETRAYAL_COMMANDS,
    type BetrayalCore,
} from '../../src/games/betrayal/game';
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
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-haunt-reveal-discovery-confirmation';
const REVEAL_CUE_SCREENSHOT = `${EVIDENCE_DIR}/01-作祟揭示横幅与翻牌确认队列共存.jpg`;
const DISCOVERY_FIRST_STEP_SCREENSHOT = `${EVIDENCE_DIR}/02-关闭横幅后保留获得预兆确认.jpg`;
const DISCOVERY_SECOND_STEP_SCREENSHOT = `${EVIDENCE_DIR}/03-确认获得预兆后保留作祟检定确认.jpg`;
const DISCOVERY_DONE_SCREENSHOT = `${EVIDENCE_DIR}/04-两步确认后回到作祟牌桌.jpg`;
const SAFE_OMEN_FIRST_STEP_SCREENSHOT = `${EVIDENCE_DIR}/05-未触发作祟-获得预兆确认.jpg`;
const SAFE_OMEN_SECOND_STEP_SCREENSHOT = `${EVIDENCE_DIR}/06-未触发作祟-作祟检定确认.jpg`;
const SAFE_OMEN_DONE_SCREENSHOT = `${EVIDENCE_DIR}/07-未触发作祟-确认后回恶兆前牌桌.jpg`;
const SAFE_OMEN_MATRIX_FIRST_CARD_SCREENSHOT = `${EVIDENCE_DIR}/08-当前9张预兆矩阵-首张获得确认.jpg`;
const SAFE_OMEN_MATRIX_DONE_SCREENSHOT = `${EVIDENCE_DIR}/09-当前9张预兆矩阵-末张确认后持有区.jpg`;
const HAUNT_OMEN_MATRIX_REVEAL_SCREENSHOT = `${EVIDENCE_DIR}/10-当前9张预兆触发矩阵-首张作祟揭示.jpg`;
const HAUNT_OMEN_MATRIX_DONE_SCREENSHOT = `${EVIDENCE_DIR}/11-当前9张预兆触发矩阵-末张确认后作祟牌桌.jpg`;
const TEST_URL = '/play/betrayal?players=3&playerID=0&seat0=human&seat1=human&seat2=human&seed=haunt-reveal-discovery-confirmation';

type OmenDiscoveryCard = BetrayalCore['possessionOrderByKind']['omen'][number];

const CURRENT_OMEN_DISCOVERY_CARDS: OmenDiscoveryCard[] =
    BETRAYAL_DISCOVERY_POOLS.possessions.omen.map((omen) => ({ ...omen }));

const DOG_OMEN_CARD =
    CURRENT_OMEN_DISCOVERY_CARDS.find((omen) => omen.id === 'dog') ??
    ({ id: 'dog', name: '狗', kind: 'omen' } satisfies OmenDiscoveryCard);

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
    omenCard: OmenDiscoveryCard = {
        id: 'omen-crimson-splash',
        name: 'A Splash of Crimson',
        kind: 'omen',
    },
): BetrayalCore {
    let core = createStartedFirstScenarioCore(['0', '1', '2']);
    core.drawOrder = ['omen'];
    core.possessionOrderByKind.omen = [
        { ...omenCard },
    ];
    core.currentExplorer.inventory = [
        { id: 'omen-alpha', name: '预兆A', kind: 'omen' },
    ];
    core.currentExplorerInventory = [...core.currentExplorer.inventory];
    core.otherExplorers = core.otherExplorers.map((explorer, index) => ({
        ...explorer,
        inventory: [
            { id: `omen-${index + 1}`, name: `预兆${index + 1}`, kind: 'omen' },
        ],
    }));

    core = applyBetrayalCommand(
        core,
        BETRAYAL_COMMANDS.EXPLORE_ROOM,
        '0',
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
    if (core.pendingCardResolutionQueue.length !== 2) {
        throw new Error('普通预兆作祟 E2E 夹具缺少两步翻牌确认队列');
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
    if (core.pendingCardResolutionQueue.length !== 2) {
        throw new Error('普通预兆未触发作祟 E2E 夹具缺少两步翻牌确认队列');
    }
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

test('普通预兆触发作祟后关闭揭示横幅仍保留两步翻牌确认', async ({ page, context }) => {
    test.setTimeout(120000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, 'betrayal-haunt-reveal-discovery-confirmation');

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForBetrayalPageReady(page);
    await injectCore(page, createOmenHauntPendingResolutionCore());
    await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });

    await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toBeVisible();
    await expect(page.getByTestId('betrayal-haunt-reveal-source')).toContainText('A Splash of Crimson');
    await expect(page.getByTestId('betrayal-discovery-panel'), '作祟横幅仍在时不应同时显示翻牌确认面板').toHaveCount(0);
    await expect.poll(() => readHauntDiscoveryConfirmationState(page)).toMatchObject({
        phase: 'haunt',
        latestDiscoveryTitle: 'A Splash of Crimson',
        latestDiscoveryKind: 'omen',
        pendingSteps: [
            { stepKind: 'drawn-card', index: 1, total: 2, cardName: 'A Splash of Crimson' },
            { stepKind: 'haunt-roll', index: 2, total: 2, cardName: 'A Splash of Crimson' },
        ],
        rejected: null,
    });
    await saveScreenshot(page, REVEAL_CUE_SCREENSHOT);

    await page.getByTestId('betrayal-haunt-reveal-close').click();
    await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toHaveCount(0);
    await expect(page.getByTestId('betrayal-discovery-panel')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('betrayal-discovery-panel')).toContainText('A Splash of Crimson');
    await expect(page.getByTestId('betrayal-discovery-continue')).toContainText('确认 1/2');
    await expect(page.getByTestId('betrayal-discovery-continue')).toHaveAttribute(
        'data-pending-card-resolution-step',
        '1/2',
    );
    await saveScreenshot(page, DISCOVERY_FIRST_STEP_SCREENSHOT);

    await page.getByTestId('betrayal-discovery-continue').click();
    await expect(page.getByTestId('betrayal-discovery-panel')).toBeVisible();
    await expect(page.getByTestId('betrayal-discovery-continue')).toContainText('确认 2/2');
    await expect(page.getByTestId('betrayal-discovery-continue')).toHaveAttribute(
        'data-pending-card-resolution-step',
        '2/2',
    );
    await expect.poll(() => readHauntDiscoveryConfirmationState(page)).toMatchObject({
        pendingSteps: [
            { stepKind: 'haunt-roll', index: 2, total: 2, cardName: 'A Splash of Crimson' },
        ],
        rejected: null,
    });
    await saveScreenshot(page, DISCOVERY_SECOND_STEP_SCREENSHOT);

    await page.getByTestId('betrayal-discovery-continue').click();
    await expect(page.getByTestId('betrayal-discovery-panel')).toHaveCount(0);
    await expect(page.getByTestId('betrayal-open-scenario')).toBeVisible();
    await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/恶兆后|Haunt/i);
    await expect.poll(() => readHauntDiscoveryConfirmationState(page)).toMatchObject({
        phase: 'haunt',
        pendingSteps: [],
        rejected: null,
    });
    await saveScreenshot(page, DISCOVERY_DONE_SCREENSHOT);

    await assertNoFatalFrontendErrors([
        { label: 'betrayal-haunt-reveal-discovery-confirmation', diagnostics },
    ]);
});

test('普通预兆未触发作祟时仍显示获得预兆和作祟检定两步确认', async ({ page, context }) => {
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
    await expect(discoveryPanel.getByTestId('betrayal-discovery-resolution-step')).toHaveCount(2);
    await expect(discoveryPanel.getByTestId('betrayal-discovery-resolution-step').nth(0)).toContainText('狗');
    await expect(discoveryPanel.getByTestId('betrayal-discovery-resolution-step').nth(1)).toContainText('作祟检定');
    await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toContainText('确认 1/2');
    await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toHaveAttribute(
        'data-pending-card-resolution-step',
        '1/2',
    );
    await expect.poll(() => readHauntDiscoveryConfirmationState(page)).toMatchObject({
        phase: 'preHaunt',
        latestDiscoveryTitle: '狗',
        latestDiscoveryKind: 'omen',
        pendingSteps: [
            { stepKind: 'drawn-card', index: 1, total: 2, cardName: '狗' },
            { stepKind: 'haunt-roll', index: 2, total: 2, cardName: '狗' },
        ],
        rejected: null,
    });
    await saveScreenshot(page, SAFE_OMEN_FIRST_STEP_SCREENSHOT);

    await discoveryPanel.getByTestId('betrayal-discovery-continue').click();
    await expect(discoveryPanel).toBeVisible();
    await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toContainText('确认 2/2');
    await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toHaveAttribute(
        'data-pending-card-resolution-step',
        '2/2',
    );
    await expect.poll(() => readHauntDiscoveryConfirmationState(page)).toMatchObject({
        phase: 'preHaunt',
        pendingSteps: [
            { stepKind: 'haunt-roll', index: 2, total: 2, cardName: '狗' },
        ],
        rejected: null,
    });
    await saveScreenshot(page, SAFE_OMEN_SECOND_STEP_SCREENSHOT);

    await discoveryPanel.getByTestId('betrayal-discovery-continue').click();
    await expect(discoveryPanel).toHaveCount(0);
    await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toHaveCount(0);
    await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/恶兆前|pre-haunt/i);
    await expect(page.locator('[data-testid="betrayal-inventory-dog-0"]')).toBeVisible();
    const deckLedger = page.getByTestId('betrayal-deck-resolution-ledger');
    await expect(deckLedger).toHaveAttribute('data-discovery-kind', 'omen');
    await expect(deckLedger).toHaveAttribute('data-discovery-title', '狗');
    await expect(deckLedger.getByTestId('betrayal-deck-resolution-ledger-step')).toHaveCount(2);
    await expect.poll(() => readHauntDiscoveryConfirmationState(page)).toMatchObject({
        phase: 'preHaunt',
        pendingSteps: [],
        rejected: null,
    });
    await saveScreenshot(page, SAFE_OMEN_DONE_SCREENSHOT);

    await assertNoFatalFrontendErrors([
        { label: 'betrayal-safe-omen-discovery-confirmation', diagnostics },
    ]);
});

test('当前9张预兆未触发作祟时均保留两步确认并进入持有区', async ({ page, context }) => {
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
        await expect(discoveryPanel.getByTestId('betrayal-discovery-resolution-step')).toHaveCount(2);
        await expect(discoveryPanel.getByTestId('betrayal-discovery-resolution-step').nth(0)).toContainText(
            omenCard.name,
        );
        await expect(discoveryPanel.getByTestId('betrayal-discovery-resolution-step').nth(1)).toContainText(
            '作祟检定',
        );
        await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toContainText('确认 1/2');
        await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toHaveAttribute(
            'data-pending-card-resolution-step',
            '1/2',
        );
        await expect.poll(() => readHauntDiscoveryConfirmationState(page)).toMatchObject({
            phase: 'preHaunt',
            latestDiscoveryTitle: omenCard.name,
            latestDiscoveryKind: 'omen',
            pendingSteps: [
                { stepKind: 'drawn-card', index: 1, total: 2, cardName: omenCard.name },
                { stepKind: 'haunt-roll', index: 2, total: 2, cardName: omenCard.name },
            ],
            rejected: null,
        });

        if (index === 0) {
            await saveScreenshot(page, SAFE_OMEN_MATRIX_FIRST_CARD_SCREENSHOT);
        }

        await discoveryPanel.getByTestId('betrayal-discovery-continue').click();
        await expect(discoveryPanel).toBeVisible();
        await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toContainText('确认 2/2');
        await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toHaveAttribute(
            'data-pending-card-resolution-step',
            '2/2',
        );
        await expect.poll(() => readHauntDiscoveryConfirmationState(page)).toMatchObject({
            phase: 'preHaunt',
            pendingSteps: [
                { stepKind: 'haunt-roll', index: 2, total: 2, cardName: omenCard.name },
            ],
            rejected: null,
        });

        await discoveryPanel.getByTestId('betrayal-discovery-continue').click();
        await expect(discoveryPanel).toHaveCount(0);
        await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/恶兆前|pre-haunt/i);
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
            await saveScreenshot(page, SAFE_OMEN_MATRIX_DONE_SCREENSHOT);
        }
    }

    await assertNoFatalFrontendErrors([
        { label: 'betrayal-safe-omen-discovery-matrix', diagnostics },
    ]);
});

test('当前9张预兆触发作祟后关闭揭示横幅均保留两步确认并进入持有区', async ({ page, context }) => {
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
        await expect(revealCue, `预兆「${omenCard.name}」触发作祟后应先显示作祟揭示横幅`).toBeVisible({
            timeout: 10000,
        });
        await expect(page.getByTestId('betrayal-haunt-reveal-source')).toContainText(omenCard.name);
        await expect(page.getByTestId('betrayal-discovery-panel'), `预兆「${omenCard.name}」作祟横幅未关闭前不应抢出发现面板`).toHaveCount(0);
        await expect.poll(() => readHauntDiscoveryConfirmationState(page)).toMatchObject({
            phase: 'haunt',
            latestDiscoveryTitle: omenCard.name,
            latestDiscoveryKind: 'omen',
            pendingSteps: [
                { stepKind: 'drawn-card', index: 1, total: 2, cardName: omenCard.name },
                { stepKind: 'haunt-roll', index: 2, total: 2, cardName: omenCard.name },
            ],
            rejected: null,
        });

        if (index === 0) {
            await saveScreenshot(page, HAUNT_OMEN_MATRIX_REVEAL_SCREENSHOT);
        }

        await page.getByTestId('betrayal-haunt-reveal-close').click();
        await expect(revealCue).toHaveCount(0);
        const discoveryPanel = page.getByTestId('betrayal-discovery-panel');
        await expect(discoveryPanel, `预兆「${omenCard.name}」关闭作祟横幅后应显示发现确认面板`).toBeVisible({
            timeout: 10000,
        });
        await expect(discoveryPanel).toContainText(omenCard.name);
        await expect(discoveryPanel.getByTestId('betrayal-discovery-resolution-step')).toHaveCount(2);
        await expect(discoveryPanel.getByTestId('betrayal-discovery-resolution-step').nth(0)).toContainText(
            omenCard.name,
        );
        await expect(discoveryPanel.getByTestId('betrayal-discovery-resolution-step').nth(1)).toContainText(
            '作祟检定',
        );
        await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toContainText('确认 1/2');
        await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toHaveAttribute(
            'data-pending-card-resolution-step',
            '1/2',
        );

        await discoveryPanel.getByTestId('betrayal-discovery-continue').click();
        await expect(discoveryPanel).toBeVisible();
        await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toContainText('确认 2/2');
        await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toHaveAttribute(
            'data-pending-card-resolution-step',
            '2/2',
        );
        await expect.poll(() => readHauntDiscoveryConfirmationState(page)).toMatchObject({
            phase: 'haunt',
            pendingSteps: [
                { stepKind: 'haunt-roll', index: 2, total: 2, cardName: omenCard.name },
            ],
            rejected: null,
        });

        await discoveryPanel.getByTestId('betrayal-discovery-continue').click();
        await expect(discoveryPanel).toHaveCount(0);
        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/恶兆后|Haunt/i);
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
            await saveScreenshot(page, HAUNT_OMEN_MATRIX_DONE_SCREENSHOT);
        }
    }

    await assertNoFatalFrontendErrors([
        { label: 'betrayal-haunt-omen-discovery-matrix', diagnostics },
    ]);
});
