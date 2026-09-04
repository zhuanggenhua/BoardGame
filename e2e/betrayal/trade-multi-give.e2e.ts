import { expect, test, type Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createExchangeReadyRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-core-interactions/trade-multi-give';
const MULTI_GIVE_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/01-普通交易选择多张己方持有物.jpg`;
const MULTI_GIVE_RETURN_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/02-普通交易选择对方地图.jpg`;
const MULTI_GIVE_REQUEST_SENT_SCREENSHOT = `${EVIDENCE_DIR}/03-普通交易等待接收方同意.jpg`;
const MULTI_GIVE_SETTLED_SCREENSHOT = `${EVIDENCE_DIR}/04-普通交易同意后结算.jpg`;

async function waitForTradeInventoryAtlas(page: Page) {
    await expect.poll(async () => page.evaluate(() => {
        const ropeImage = document.querySelector<HTMLImageElement>('[data-testid="betrayal-inventory-rope-front-atlas"]');
        const omenBookImage = document.querySelector<HTMLImageElement>('[data-testid="betrayal-inventory-omen-book-front-atlas"]');
        return {
            ropeLoaded: Boolean(ropeImage?.complete && ropeImage.naturalWidth > 0 && ropeImage.naturalHeight > 0),
            omenBookLoaded: Boolean(omenBookImage?.complete && omenBookImage.naturalWidth > 0 && omenBookImage.naturalHeight > 0),
        };
    }), {
        message: '交易持有区正式牌面 atlas 必须加载完成后再验 UI',
        timeout: 15000,
    }).toEqual({
        ropeLoaded: true,
        omenBookLoaded: true,
    });
}

test('真实页面普通同房交易支持发起方一次给出多张持有物', async ({ page, context }) => {
    test.setTimeout(180000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, 'betrayal-trade-multi-give');

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto('/play/betrayal?players=3&seat0=human&seat1=human&seat2=human', { waitUntil: 'commit', timeout: 30000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
    await waitForBetrayalPageReady(page);
    await injectCore(page, createExchangeReadyRuntimeCore());
    await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
    await waitForTradeInventoryAtlas(page);

    await page.getByTestId('betrayal-inventory-rope').click();
    await page.getByTestId('betrayal-inventory-omen-book').click();
    await expect(page.getByTestId('betrayal-inventory-rope-selected-outline'), '兔脚必须保持选中').toBeVisible();
    await expect(page.getByTestId('betrayal-inventory-omen-book-selected-outline'), '书本必须保持选中').toBeVisible();
    await expect(page.getByTestId('betrayal-selected-inventory-card-name'), '发起方已选持有物应显示为多张').toContainText('兔脚、书本');

    await page.getByTestId('betrayal-room-occupant-hallway-1').click();
    await expect(page.getByTestId('betrayal-trade-return-selector'), '选中同房间队友后必须显示对方持有物').toBeVisible();
    await expect(page.locator('[data-testid="betrayal-trade-action-panel"] [data-testid="betrayal-trade-flow-item-step"]'), '未选对方物品前摘要必须列出两张己方给出物').toContainText(/你给出.*兔脚.*书本/);
    await saveScreenshot(page, MULTI_GIVE_SELECTED_SCREENSHOT);

    await page.getByTestId('betrayal-trade-return-card-map').click();
    await expect(page.locator('[data-testid="betrayal-trade-action-panel"] [data-testid="betrayal-trade-flow-item-step"]'), '选择对方地图后摘要必须同时显示两张给出物和地图').toContainText(/你给出.*兔脚.*书本.*对方给出.*地图/);
    await saveScreenshot(page, MULTI_GIVE_RETURN_SELECTED_SCREENSHOT);

    await page.getByTestId('betrayal-action-trade').click();
    await expect.poll(async () => page.evaluate(() => {
        const holder = window as unknown as {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            activePlayerId?: string | null;
                            pendingTradeAgreement?: { targetPlayerId?: string; cardIds?: string[]; targetCardIds?: string[] } | null;
                            currentExplorer?: { inventory?: Array<{ name: string }> };
                            otherExplorers?: Array<{ playerId: string; inventory?: Array<{ name: string }> }>;
                            activityLog?: Array<{ text: string }>;
                        };
                    };
                };
            };
            __BG_LAST_COMMAND_REJECTED__?: { error: string; commandType: string };
        };
        const state = holder.__BG_TEST_HARNESS__?.state?.get?.();
        return {
            currentInventory: state?.core?.currentExplorer?.inventory?.map((item) => item.name) ?? [],
            teammateInventory: state?.core?.otherExplorers?.find((explorer) => explorer.playerId === '1')?.inventory?.map((item) => item.name) ?? [],
            activePlayerId: state?.core?.activePlayerId ?? null,
            pendingTarget: state?.core?.pendingTradeAgreement?.targetPlayerId ?? null,
            pendingCards: state?.core?.pendingTradeAgreement?.cardIds ?? [],
            pendingReturnCards: state?.core?.pendingTradeAgreement?.targetCardIds ?? [],
            latestLog: state?.core?.activityLog?.[0]?.text ?? null,
            rejected: holder.__BG_LAST_COMMAND_REJECTED__ ?? null,
        };
    }), {
        message: '提交交易方案后必须等待接收方同意，双方持有物暂不转移',
        timeout: 10000,
    }).toMatchObject({
        currentInventory: expect.arrayContaining(['兔脚', '书本']),
        teammateInventory: expect.arrayContaining(['地图', '头骨']),
        activePlayerId: '1',
        pendingTarget: '1',
        pendingCards: ['rope', 'omen-book'],
        pendingReturnCards: ['map'],
        latestLog: expect.stringMatching(/同意|交易请求|兔脚|书本|地图/),
        rejected: null,
    });
    await expect(page.getByTestId('betrayal-trade-agreement-panel'), '接收方必须看到同意/拒绝面板').toBeVisible();
    await saveScreenshot(page, MULTI_GIVE_REQUEST_SENT_SCREENSHOT);

    await page.getByTestId('betrayal-trade-agreement-accept').click();
    await expect.poll(async () => page.evaluate(() => {
        const holder = window as unknown as {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            activePlayerId?: string | null;
                            pendingTradeAgreement?: unknown | null;
                            currentExplorer?: { inventory?: Array<{ name: string }> };
                            otherExplorers?: Array<{ playerId: string; inventory?: Array<{ name: string }> }>;
                            activityLog?: Array<{ text: string }>;
                        };
                    };
                };
            };
            __BG_LAST_COMMAND_REJECTED__?: { error: string; commandType: string };
        };
        const state = holder.__BG_TEST_HARNESS__?.state?.get?.();
        return {
            currentInventory: state?.core?.currentExplorer?.inventory?.map((item) => item.name) ?? [],
            teammateInventory: state?.core?.otherExplorers?.find((explorer) => explorer.playerId === '1')?.inventory?.map((item) => item.name) ?? [],
            activePlayerId: state?.core?.activePlayerId ?? null,
            pendingTradeAgreement: state?.core?.pendingTradeAgreement ?? null,
            latestLog: state?.core?.activityLog?.[0]?.text ?? null,
            rejected: holder.__BG_LAST_COMMAND_REJECTED__ ?? null,
        };
    }), {
        message: '接收方同意后必须双向结算：发起方得到地图，接收方得到兔脚和书本',
        timeout: 10000,
    }).toMatchObject({
        currentInventory: expect.arrayContaining(['地图']),
        teammateInventory: expect.arrayContaining(['头骨', '兔脚', '书本']),
        activePlayerId: null,
        pendingTradeAgreement: null,
        latestLog: expect.stringMatching(/同意交易|兔脚|书本|地图/),
        rejected: null,
    });
    await expect(page.getByTestId('betrayal-inventory-rope'), '交易后兔脚应从发起方持有区消失').toHaveCount(0);
    await expect(page.getByTestId('betrayal-inventory-omen-book'), '交易后书本应从发起方持有区消失').toHaveCount(0);
    await saveScreenshot(page, MULTI_GIVE_SETTLED_SCREENSHOT);

    await assertNoFatalFrontendErrors([{ label: 'betrayal-trade-multi-give', diagnostics }]);
});
