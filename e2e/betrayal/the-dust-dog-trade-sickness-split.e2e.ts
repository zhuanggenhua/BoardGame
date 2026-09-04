import { expect, test, type Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createDustDogTradeSicknessSplitRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-the-dust-dog-trade-sickness-split';
const INITIAL_SCREENSHOT = `${EVIDENCE_DIR}/01-灰尘交易入口默认交换疾病.jpg`;
const CARD_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/02-选中狗交易持有物.jpg`;
const TARGET_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/03-狗交易目标选中后按钮变为确认交易方案.jpg`;
const REQUEST_SENT_SCREENSHOT = `${EVIDENCE_DIR}/04-狗交易请求等待同意且未进入疾病交换.jpg`;
const SETTLED_SCREENSHOT = `${EVIDENCE_DIR}/05-狗交易同意后结算且未生成疾病交换.jpg`;
const TEST_URL = '/play/betrayal?players=3&seat0=human&seat1=human&seat2=human&seed=the-dust-dog-trade-sickness-split';

type DustDogTradeSplitState = {
    activePlayerId?: string | null;
    currentInventory?: string[];
    targetInventory?: string[];
    pendingTradeAgreement?: {
        targetPlayerId?: string;
        cardIds?: string[];
        targetCardIds?: string[];
        useDog?: boolean;
    } | null;
    pendingSicknessExchange?: unknown | null;
    usedCardIdsThisTurn?: string[];
    latestLog?: string | null;
    rejected?: { commandType?: string; error?: string } | null;
};

const readDustDogTradeSplitState = async (page: Page): Promise<DustDogTradeSplitState> =>
    page.evaluate(() => {
        const holder = window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            activePlayerId?: string | null;
                            currentExplorer?: { inventory?: Array<{ id: string; name: string }> };
                            otherExplorers?: Array<{ playerId: string; inventory?: Array<{ id: string; name: string }> }>;
                            pendingTradeAgreement?: DustDogTradeSplitState['pendingTradeAgreement'];
                            usedCardIdsThisTurn?: string[];
                            activityLog?: Array<{ text?: string }>;
                            scenarioRuntime?: {
                                dust?: {
                                    pendingSicknessExchange?: unknown | null;
                                };
                            };
                        };
                    };
                };
            };
            __BG_LAST_COMMAND_REJECTED__?: { commandType?: string; error?: string } | null;
        };
        const core = holder.__BG_TEST_HARNESS__?.state?.get?.()?.core;
        return {
            activePlayerId: core?.activePlayerId ?? null,
            currentInventory: core?.currentExplorer?.inventory?.map((item) => item.name) ?? [],
            targetInventory: core?.otherExplorers?.find((explorer) => explorer.playerId === '0')?.inventory?.map((item) => item.name) ?? [],
            pendingTradeAgreement: core?.pendingTradeAgreement ?? null,
            pendingSicknessExchange: core?.scenarioRuntime?.dust?.pendingSicknessExchange ?? null,
            usedCardIdsThisTurn: core?.usedCardIdsThisTurn ?? [],
            latestLog: core?.activityLog?.[0]?.text ?? null,
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

test('灰尘态下选中狗交易目标后不会被交换疾病入口抢走', async ({ page, context }) => {
    test.setTimeout(180000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, 'betrayal-the-dust-dog-trade-sickness-split');

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto(TEST_URL, { waitUntil: 'commit', timeout: 30000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
    await waitForBetrayalPageReady(page);
    await injectCore(page, createDustDogTradeSicknessSplitRuntimeCore());
    await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
    await dismissHauntRevealCueIfVisible(page);

    await expect(page.getByTestId('betrayal-action-trade'), '同房探索者存在且未选狗交易目标时，灰尘交易入口默认是交换疾病').toContainText('交换疾病');
    await expect(page.getByTestId('betrayal-dog-trade-selector'), '灰尘态仍应显示狗交易候选区').toBeVisible();
    await expect(page.getByTestId('betrayal-room-occupant-entrance-hall-2'), '同房探索者 token 必须仍是交换疾病主路径目标').toBeVisible();
    await expect.poll(() => readDustDogTradeSplitState(page)).toMatchObject({
        activePlayerId: null,
        pendingTradeAgreement: null,
        pendingSicknessExchange: null,
    });
    await saveScreenshot(page, INITIAL_SCREENSHOT);

    await page.getByTestId('betrayal-dog-trade-card-medical-kit').click();
    await expect(page.getByTestId('betrayal-dog-trade-card-medical-kit-selected-outline'), '急救包被选作狗交易给出物时必须有选中外框').toBeVisible();
    await expect(page.getByTestId('betrayal-action-trade'), '只选中狗交易牌但未选远距目标时不能直接确认交易方案').toContainText('交易');
    await expect(page.getByTestId('betrayal-action-trade'), '只选中狗交易牌但未选远距目标时不能提前进入确认交易方案态').not.toContainText('提交方案');
    await expect.poll(() => readDustDogTradeSplitState(page)).toMatchObject({
        pendingTradeAgreement: null,
        pendingSicknessExchange: null,
    });
    await saveScreenshot(page, CARD_SELECTED_SCREENSHOT);

    await page.getByTestId('betrayal-room-floor-up').click();
    await expect(page.getByTestId('betrayal-room-occupant-upper-landing-0'), '狗交易目标必须从地图上的远距队友 token 本体选择').toBeVisible();
    await expect(page.getByTestId('betrayal-room-occupant-target-outline-upper-landing-0'), '狗交易目标高亮必须贴合远距队友 token').toHaveAttribute('data-highlight-shape', 'pentagon');
    await page.getByTestId('betrayal-room-occupant-upper-landing-0').click();
    await expect(page.getByTestId('betrayal-action-trade'), '狗交易牌和远距目标都已选中后，底部按钮必须切为确认交易方案').toContainText('提交方案');
    await expect(page.getByTestId('betrayal-action-trade')).toBeEnabled();
    await saveScreenshot(page, TARGET_SELECTED_SCREENSHOT);

    await page.getByTestId('betrayal-action-trade').click();
    await expect.poll(() => readDustDogTradeSplitState(page), {
        message: '点击提交交易方案后必须生成狗交易请求，而不是进入疾病交换等待态',
        timeout: 10000,
    }).toMatchObject({
        activePlayerId: '0',
        pendingTradeAgreement: {
            targetPlayerId: '0',
            cardIds: ['medical-kit'],
            targetCardIds: [],
            useDog: true,
        },
        pendingSicknessExchange: null,
        usedCardIdsThisTurn: expect.not.arrayContaining(['dog']),
        latestLog: expect.stringMatching(/狗交易|急救包|同意/),
        rejected: null,
    });
    await expect(page.getByTestId('betrayal-trade-agreement-panel'), '接收方必须看到狗交易同意面板').toBeVisible();
    await expect(page.getByTestId('betrayal-sickness-exchange-banner'), '狗交易请求发出后不能出现疾病交换等待横幅').toHaveCount(0);
    await saveScreenshot(page, REQUEST_SENT_SCREENSHOT);

    await page.getByTestId('betrayal-trade-agreement-accept').click();
    await expect.poll(() => readDustDogTradeSplitState(page), {
        message: '接收方同意后必须结算狗交易，并继续保持没有疾病交换等待态',
        timeout: 10000,
    }).toMatchObject({
        activePlayerId: null,
        currentInventory: expect.arrayContaining(['狗', '地图']),
        targetInventory: expect.arrayContaining(['急救包']),
        pendingTradeAgreement: null,
        pendingSicknessExchange: null,
        usedCardIdsThisTurn: expect.arrayContaining(['dog']),
        latestLog: expect.stringMatching(/同意交易|使用狗|急救包/),
        rejected: null,
    });
    await expect(page.getByTestId('betrayal-dog-trade-card-medical-kit'), '急救包交易结算后不能继续留在狗交易候选区').toHaveCount(0);
    await expect(page.getByTestId('betrayal-sickness-exchange-banner'), '狗交易结算后仍不能残留疾病交换横幅').toHaveCount(0);
    await saveScreenshot(page, SETTLED_SCREENSHOT);

    await assertNoFatalFrontendErrors([{ label: 'betrayal-the-dust-dog-trade-sickness-split', diagnostics }]);
});
