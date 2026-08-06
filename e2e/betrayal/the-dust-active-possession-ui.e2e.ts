import { expect, test, type Page } from '@playwright/test';
import type { BetrayalCore } from '../../src/games/betrayal/game';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createDustActivePossessionRuntimeCore,
    DUST_ACTIVE_POSSESSION_E2E_CARDS,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
    type DustActivePossessionE2ECardId,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-the-dust-active-possession-ui';
const ALL_CARDS_SCREENSHOT = `${EVIDENCE_DIR}/01-十一张主动持有牌入口全集.jpg`;
const MEDICAL_KIT_TARGET_SCREENSHOT = `${EVIDENCE_DIR}/02-急救包选择同房目标.jpg`;
const MEDICAL_KIT_DONE_SCREENSHOT = `${EVIDENCE_DIR}/03-急救包治疗后埋葬.jpg`;
const HOLY_WATER_READY_SCREENSHOT = `${EVIDENCE_DIR}/04-奇怪的药品无需目标.jpg`;
const HOLY_WATER_DONE_SCREENSHOT = `${EVIDENCE_DIR}/05-奇怪的药品治疗后埋葬.jpg`;
const PLACE_READY_SCREENSHOT_PREFIX = `${EVIDENCE_DIR}/06`;
const MIRROR_READY_SCREENSHOT = `${EVIDENCE_DIR}/07-镜子自疗知识神志预览.jpg`;
const MIRROR_DONE_SCREENSHOT = `${EVIDENCE_DIR}/08-镜子自疗后埋葬.jpg`;
const STOPWATCH_DONE_SCREENSHOT = `${EVIDENCE_DIR}/09-神秘秒表使用后等待额外回合.jpg`;
const BOOK_READY_SCREENSHOT = `${EVIDENCE_DIR}/10-书本无需目标准备使用.jpg`;
const BOOK_DONE_SCREENSHOT = `${EVIDENCE_DIR}/11-书本使用后保留下次非战斗检定替换.jpg`;
const MASK_TARGET_SCREENSHOT = `${EVIDENCE_DIR}/12-面具逐目标选择同房玩家和狂热病患.jpg`;
const MASK_DONE_SCREENSHOT = `${EVIDENCE_DIR}/13-面具结算后目标移动到已发现相邻房间.jpg`;
const ANGEL_FEATHER_SELECT_SCREENSHOT = `${EVIDENCE_DIR}/14-天使之羽选择替代投骰结果.jpg`;
const ANGEL_FEATHER_DONE_SCREENSHOT = `${EVIDENCE_DIR}/15-天使之羽使用后保留替代总点数.jpg`;
const TEST_URL = '/play/betrayal?players=3&playerID=1&seat0=human&seat1=human&seat2=human&seed=the-dust-active-possession-ui';

const ACTIVE_CARD_IDS = Object.keys(
    DUST_ACTIVE_POSSESSION_E2E_CARDS,
) as DustActivePossessionE2ECardId[];

type DustActivePossessionState = {
    currentRoomId?: string;
    currentInventoryIds?: string[];
    currentInventoryNames?: string[];
    usedCardIdsThisTurn?: string[];
    currentTraits?: Partial<Record<'might' | 'speed' | 'knowledge' | 'sanity', number>>;
    currentPlayer?: string;
    turnStartInventoryCardIds?: string[];
    playerZeroRoomId?: string;
    playerZeroTraits?: Partial<Record<'might' | 'speed' | 'knowledge' | 'sanity', number>>;
    feverishRoomId?: string | null;
    nextNonCombatTraitReplacement?: {
        playerId?: string;
        sourceCardId?: string;
        replacementTrait?: string;
    } | null;
    nextNonCombatTraitRollTotalReplacement?: {
        playerId?: string;
        sourceCardId?: string;
        sourceCardName?: string;
        selectedTotal?: number;
    } | null;
    pendingExtraTurnAfterCurrentTurn?: {
        playerId?: string;
        sourceCardId?: string;
        sourceCardName?: string;
    } | null;
    latestLog?: string | null;
    rejected?: { commandType?: string; error?: string } | null;
};

const readDustActivePossessionState = async (
    page: Page,
): Promise<DustActivePossessionState> =>
    page.evaluate(() => {
        const holder = window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: BetrayalCore;
                    };
                };
            };
            __BG_LAST_COMMAND_REJECTED__?: { commandType?: string; error?: string } | null;
        };
        const core = holder.__BG_TEST_HARNESS__?.state?.get?.()?.core;
        const playerZero = core?.otherExplorers.find((explorer) => explorer.playerId === '0');
        const feverish = core?.monsters.find(
            (monster) => monster.id === 'feverish-active-possession-1',
        );
        return {
            currentRoomId: core?.currentExplorer.roomId,
            currentInventoryIds: core?.currentExplorer.inventory.map((card) => card.id) ?? [],
            currentInventoryNames: core?.currentExplorer.inventory.map((card) => card.name) ?? [],
            usedCardIdsThisTurn: core?.usedCardIdsThisTurn ?? [],
            currentTraits: core?.currentExplorer.traits,
            currentPlayer: core?.currentPlayer,
            turnStartInventoryCardIds: core?.turnStartInventoryCardIds ?? [],
            playerZeroRoomId: playerZero?.roomId,
            playerZeroTraits: playerZero?.traits,
            feverishRoomId: feverish?.roomId ?? null,
            nextNonCombatTraitReplacement: core?.nextNonCombatTraitReplacement ?? null,
            nextNonCombatTraitRollTotalReplacement: core?.nextNonCombatTraitRollTotalReplacement ?? null,
            pendingExtraTurnAfterCurrentTurn: core?.pendingExtraTurnAfterCurrentTurn ?? null,
            latestLog: core?.activityLog[0]?.text ?? null,
            rejected: holder.__BG_LAST_COMMAND_REJECTED__ ?? null,
        };
    });

const dismissHauntRevealCueIfVisible = async (page: Page) => {
    const closeButton = page.getByTestId('betrayal-haunt-reveal-close');
    if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
        await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toHaveCount(0);
    }
};

const openDustActivePossessionBoard = async (
    page: Page,
    context: Parameters<typeof initBetrayalContext>[0],
    core = createDustActivePossessionRuntimeCore(),
    label = 'betrayal-the-dust-active-possession-ui',
) => {
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, label);
    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForBetrayalPageReady(page);
    await injectCore(page, core);
    await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
    await dismissHauntRevealCueIfVisible(page);
    await expect(page.getByTestId('betrayal-dust-progress-strip')).toContainText('灰尘');
    return diagnostics;
};

const injectActiveCard = async (
    page: Page,
    cardId: DustActivePossessionE2ECardId,
) => {
    await injectCore(page, createDustActivePossessionRuntimeCore([cardId]));
    await expect(page.getByTestId(`betrayal-inventory-${cardId}`)).toBeVisible();
};

const selectCard = async (page: Page, cardId: DustActivePossessionE2ECardId) => {
    await page.getByTestId(`betrayal-inventory-${cardId}`).click();
    await expect(page.getByTestId(`betrayal-inventory-${cardId}-selected-outline`)).toBeVisible();
    await expect(page.getByTestId('betrayal-selected-inventory-card-name')).toContainText(
        DUST_ACTIVE_POSSESSION_E2E_CARDS[cardId].name,
    );
};

test.describe('山屋惊魂作祟3灰尘主动持有牌玩家可见代表链', () => {
    test('十一张当前主动持有牌都显示入口、选中状态和正确目标要求', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openDustActivePossessionBoard(
            page,
            context,
            createDustActivePossessionRuntimeCore(),
            'betrayal-the-dust-active-possession-ui-all-cards',
        );

        for (const cardId of ACTIVE_CARD_IDS) {
            await expect(page.getByTestId(`betrayal-inventory-${cardId}`)).toBeVisible();
        }

        await selectCard(page, 'medical-kit');
        await expect(page.getByTestId('betrayal-inventory-target-player-selector')).toBeVisible();
        await expect(page.getByTestId('betrayal-action-use')).toBeDisabled();
        await expect(page.getByTestId('betrayal-room-occupant-target-outline-hallway-0')).toHaveAttribute(
            'data-highlight-shape',
            'pentagon',
        );

        await selectCard(page, 'holy-water');
        await expect(page.getByTestId('betrayal-inventory-target-player-selector')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-action-use')).toBeEnabled();

        await selectCard(page, 'mirror');
        await expect(page.getByTestId('betrayal-inventory-target-player-selector')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-inventory-heal-preview')).toContainText('知识');
        await expect(page.getByTestId('betrayal-inventory-heal-preview')).toContainText('神志');
        await expect(page.getByTestId('betrayal-action-use')).toBeEnabled();

        for (const cardId of ['map', 'notebook', 'journal', 'manuscript'] as const) {
            await selectCard(page, cardId);
            await expect(page.getByTestId('betrayal-inventory-target-room-selector')).toBeVisible();
            await expect(page.getByTestId('betrayal-room-inventory-target-card-highlight-entrance-hall')).toBeVisible();
            await expect(page.getByTestId('betrayal-action-use')).toBeDisabled();
        }

        await selectCard(page, 'mysterious-stopwatch');
        await expect(page.getByTestId('betrayal-inventory-target-room-selector')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-action-use')).toBeEnabled();

        await selectCard(page, 'angel-feather');
        await expect(page.getByTestId('betrayal-inventory-roll-total-selector')).toBeVisible();
        await expect(page.getByTestId('betrayal-action-use')).toBeDisabled();
        await page.getByTestId('betrayal-inventory-roll-total-6').click();
        await expect(page.getByTestId('betrayal-inventory-roll-total-6')).toHaveAttribute('data-selected', 'true');
        await expect(page.getByTestId('betrayal-action-use')).toBeEnabled();

        await selectCard(page, 'omen-book');
        await expect(page.getByTestId('betrayal-inventory-target-room-selector')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-action-use')).toBeEnabled();

        await selectCard(page, 'mask');
        await expect(page.getByTestId('betrayal-mask-target-selector')).toBeVisible();
        await expect(page.getByTestId('betrayal-mask-target-row-0')).toBeVisible();
        await expect(page.getByTestId('betrayal-mask-target-row-feverish-active-possession-1')).toBeVisible();
        await expect(page.getByTestId('betrayal-room-monster-hallway-feverish-active-possession-1')).toBeVisible();
        await expect(page.getByTestId('betrayal-action-use')).toBeDisabled();
        await saveScreenshot(page, ALL_CARDS_SCREENSHOT);

        await assertNoFatalFrontendErrors([
            { label: 'betrayal-the-dust-active-possession-ui-all-cards', diagnostics },
        ]);
    });

    test('治疗类主动牌从真实页面选择目标并按灰尘状态埋葬', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openDustActivePossessionBoard(
            page,
            context,
            createDustActivePossessionRuntimeCore(['medical-kit']),
            'betrayal-the-dust-active-possession-ui-heal',
        );

        await selectCard(page, 'medical-kit');
        await page.getByTestId('betrayal-room-occupant-hallway-0').click();
        await expect(page.getByTestId('betrayal-inventory-target-player-0')).toBeVisible();
        await expect(page.getByTestId('betrayal-inventory-heal-preview')).toBeVisible();
        await expect(page.getByTestId('betrayal-action-use')).toBeEnabled();
        await saveScreenshot(page, MEDICAL_KIT_TARGET_SCREENSHOT);
        await page.getByTestId('betrayal-action-use').click();
        await expect.poll(() => readDustActivePossessionState(page)).toMatchObject({
            currentInventoryIds: [],
            usedCardIdsThisTurn: expect.arrayContaining(['medical-kit']),
            playerZeroTraits: {
                might: 4,
                speed: 4,
                knowledge: 4,
                sanity: 4,
            },
            rejected: null,
        });
        await saveScreenshot(page, MEDICAL_KIT_DONE_SCREENSHOT);

        await injectActiveCard(page, 'holy-water');
        await selectCard(page, 'holy-water');
        await expect(page.getByTestId('betrayal-action-use')).toBeEnabled();
        await saveScreenshot(page, HOLY_WATER_READY_SCREENSHOT);
        await page.getByTestId('betrayal-action-use').click();
        await expect.poll(() => readDustActivePossessionState(page)).toMatchObject({
            currentInventoryIds: [],
            currentTraits: {
                might: 4,
                speed: 4,
                knowledge: 2,
                sanity: 2,
            },
            usedCardIdsThisTurn: expect.arrayContaining(['holy-water']),
            rejected: null,
        });
        await saveScreenshot(page, HOLY_WATER_DONE_SCREENSHOT);

        await injectActiveCard(page, 'mirror');
        await selectCard(page, 'mirror');
        await expect(page.getByTestId('betrayal-inventory-heal-preview-knowledge')).toHaveAttribute(
            'data-trait-preview-target-value',
            '4',
        );
        await expect(page.getByTestId('betrayal-inventory-heal-preview-sanity')).toHaveAttribute(
            'data-trait-preview-target-value',
            '4',
        );
        await expect(page.getByTestId('betrayal-action-use')).toBeEnabled();
        await saveScreenshot(page, MIRROR_READY_SCREENSHOT);
        await page.getByTestId('betrayal-action-use').click();
        await expect.poll(() => readDustActivePossessionState(page)).toMatchObject({
            currentInventoryIds: [],
            currentTraits: {
                might: 2,
                speed: 2,
                knowledge: 4,
                sanity: 4,
            },
            usedCardIdsThisTurn: expect.arrayContaining(['mirror']),
            rejected: null,
        });
        await saveScreenshot(page, MIRROR_DONE_SCREENSHOT);

        await assertNoFatalFrontendErrors([
            { label: 'betrayal-the-dust-active-possession-ui-heal', diagnostics },
        ]);
    });

    test('地图、笔记本、日记和手稿都从真实房间板块选择已发现目标', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openDustActivePossessionBoard(
            page,
            context,
            createDustActivePossessionRuntimeCore(['map']),
            'betrayal-the-dust-active-possession-ui-place',
        );

        const cards = [
            ['map', '地图'],
            ['notebook', '笔记本'],
            ['journal', '日记'],
            ['manuscript', '手稿'],
        ] as const;

        for (const [index, [cardId, cardName]] of cards.entries()) {
            await injectActiveCard(page, cardId);
            await selectCard(page, cardId);
            await expect(page.getByTestId('betrayal-inventory-target-room-selector')).toBeVisible();
            await expect(page.getByTestId('betrayal-action-use')).toBeDisabled();
            await page.getByTestId('betrayal-room-entrance-hall').click();
            await expect(page.getByTestId('betrayal-inventory-target-room-entrance-hall')).toContainText('入口大厅');
            await expect(page.getByTestId('betrayal-action-use')).toBeEnabled();
            await saveScreenshot(
                page,
                `${PLACE_READY_SCREENSHOT_PREFIX + index}-${cardName}选择已发现入口大厅.jpg`,
            );
            await page.getByTestId('betrayal-action-use').click();
            await expect.poll(() => readDustActivePossessionState(page)).toMatchObject({
                currentRoomId: 'entrance-hall',
                currentInventoryIds: [],
                usedCardIdsThisTurn: expect.arrayContaining([cardId]),
                latestLog: expect.stringContaining(`埋葬${cardName}`),
                rejected: null,
            });
        }

        await assertNoFatalFrontendErrors([
            { label: 'betrayal-the-dust-active-possession-ui-place', diagnostics },
        ]);
    });

    test('神秘秒表从真实页面埋葬并在结束回合后给当前玩家额外行动', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openDustActivePossessionBoard(
            page,
            context,
            createDustActivePossessionRuntimeCore(['mysterious-stopwatch']),
            'betrayal-the-dust-active-possession-ui-stopwatch',
        );

        await selectCard(page, 'mysterious-stopwatch');
        await expect(page.getByTestId('betrayal-action-use')).toBeEnabled();
        await page.getByTestId('betrayal-action-use').click();
        await expect.poll(() => readDustActivePossessionState(page)).toMatchObject({
            currentInventoryIds: [],
            usedCardIdsThisTurn: expect.arrayContaining(['mysterious-stopwatch']),
            pendingExtraTurnAfterCurrentTurn: {
                playerId: '1',
                sourceCardId: 'mysterious-stopwatch',
                sourceCardName: '神秘秒表',
            },
            rejected: null,
        });
        await saveScreenshot(page, STOPWATCH_DONE_SCREENSHOT);

        await page.getByTestId('betrayal-action-endTurn').click();
        await expect.poll(() => readDustActivePossessionState(page)).toMatchObject({
            currentPlayer: '1',
            currentInventoryIds: [],
            usedCardIdsThisTurn: [],
            turnStartInventoryCardIds: [],
            pendingExtraTurnAfterCurrentTurn: null,
            rejected: null,
        });

        await assertNoFatalFrontendErrors([
            { label: 'betrayal-the-dust-active-possession-ui-stopwatch', diagnostics },
        ]);
    });

    test('天使之羽要求页面选择0-8总点数并写入下一次非战斗检定替代状态', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openDustActivePossessionBoard(
            page,
            context,
            createDustActivePossessionRuntimeCore(['angel-feather']),
            'betrayal-the-dust-active-possession-ui-angel-feather',
        );

        await selectCard(page, 'angel-feather');
        await expect(page.getByTestId('betrayal-inventory-roll-total-selector')).toBeVisible();
        await expect(page.getByTestId('betrayal-action-use')).toBeDisabled();
        await page.getByTestId('betrayal-inventory-roll-total-6').click();
        await expect(page.getByTestId('betrayal-inventory-roll-total-6')).toHaveAttribute('data-selected', 'true');
        await expect(page.getByTestId('betrayal-action-use')).toBeEnabled();
        await saveScreenshot(page, ANGEL_FEATHER_SELECT_SCREENSHOT);

        await page.getByTestId('betrayal-action-use').click();
        await expect.poll(() => readDustActivePossessionState(page)).toMatchObject({
            currentInventoryIds: [],
            usedCardIdsThisTurn: expect.arrayContaining(['angel-feather']),
            nextNonCombatTraitRollTotalReplacement: {
                playerId: '1',
                sourceCardId: 'angel-feather',
                sourceCardName: '天使之羽',
                selectedTotal: 6,
            },
            rejected: null,
        });
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(
            '下一次属性检定使用 6 作为投骰结果',
        );
        await saveScreenshot(page, ANGEL_FEATHER_DONE_SCREENSHOT);

        await assertNoFatalFrontendErrors([
            { label: 'betrayal-the-dust-active-possession-ui-angel-feather', diagnostics },
        ]);
    });

    test('书本可从真实页面使用并保留下次非战斗检定替换状态', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openDustActivePossessionBoard(
            page,
            context,
            createDustActivePossessionRuntimeCore(['omen-book']),
            'betrayal-the-dust-active-possession-ui-book',
        );

        await selectCard(page, 'omen-book');
        await expect(page.getByTestId('betrayal-action-use')).toBeEnabled();
        await saveScreenshot(page, BOOK_READY_SCREENSHOT);
        await page.getByTestId('betrayal-action-use').click();
        await expect.poll(() => readDustActivePossessionState(page)).toMatchObject({
            currentInventoryIds: ['omen-book'],
            currentTraits: {
                sanity: 1,
            },
            usedCardIdsThisTurn: expect.arrayContaining(['omen-book']),
            nextNonCombatTraitReplacement: {
                playerId: '1',
                sourceCardId: 'omen-book',
                replacementTrait: 'knowledge',
            },
            rejected: null,
        });
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(
            '本回合下一次非战斗检定可用知识替换',
        );
        await saveScreenshot(page, BOOK_DONE_SCREENSHOT);

        await assertNoFatalFrontendErrors([
            { label: 'betrayal-the-dust-active-possession-ui-book', diagnostics },
        ]);
    });

    test('面具要求使用者逐个给同房探索者和狂热病患指定已发现相邻房间', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openDustActivePossessionBoard(
            page,
            context,
            createDustActivePossessionRuntimeCore(['mask']),
            'betrayal-the-dust-active-possession-ui-mask',
        );

        await selectCard(page, 'mask');
        await expect(page.getByTestId('betrayal-mask-target-selector')).toBeVisible();
        await expect(page.getByTestId('betrayal-mask-target-row-0')).toContainText(/待选|待处理|请选择/);
        await expect(page.getByTestId('betrayal-mask-target-row-feverish-active-possession-1')).toContainText(/待选|待处理|请选择/);
        await expect(page.getByTestId('betrayal-action-use')).toBeDisabled();
        await page.getByTestId('betrayal-room-entrance-hall').click();
        await expect(page.getByTestId('betrayal-mask-target-row-0')).toContainText('入口大厅');
        await expect(page.getByTestId('betrayal-action-use')).toBeDisabled();
        await page.getByTestId('betrayal-room-entrance-hall').click();
        await expect(page.getByTestId('betrayal-mask-target-row-feverish-active-possession-1')).toContainText('入口大厅');
        await expect(page.getByTestId('betrayal-action-use')).toBeEnabled();
        await saveScreenshot(page, MASK_TARGET_SCREENSHOT);

        await page.getByTestId('betrayal-action-use').click();
        await expect.poll(() => readDustActivePossessionState(page)).toMatchObject({
            currentRoomId: 'hallway',
            currentInventoryIds: ['mask'],
            playerZeroRoomId: 'entrance-hall',
            feverishRoomId: 'entrance-hall',
            usedCardIdsThisTurn: expect.arrayContaining(['mask']),
            rejected: null,
        });
        await expect(page.getByTestId('betrayal-room-occupant-entrance-hall-0')).toBeVisible();
        await expect(page.getByTestId('betrayal-room-monster-entrance-hall-feverish-active-possession-1')).toBeVisible();
        await saveScreenshot(page, MASK_DONE_SCREENSHOT);

        await assertNoFatalFrontendErrors([
            { label: 'betrayal-the-dust-active-possession-ui-mask', diagnostics },
        ]);
    });
});
