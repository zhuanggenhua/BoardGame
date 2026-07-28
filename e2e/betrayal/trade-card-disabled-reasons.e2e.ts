import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'path';
import type { BetrayalCore } from '../../src/games/betrayal/game';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createDogTradeReadyRuntimeCore,
    createExchangeReadyRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = resolve(process.cwd(), 'evidence/betrayal-core-interactions/trade-card-disabled-reasons');
const NORMAL_GIVE_DISABLED_SCREENSHOT = `${EVIDENCE_DIR}/01-普通交易己方已用牌保留禁用原因.jpg`;
const NORMAL_RETURN_DISABLED_SCREENSHOT = `${EVIDENCE_DIR}/02-普通交易对方已用牌保留禁用原因.jpg`;
const DOG_TRADE_DISABLED_SCREENSHOT = `${EVIDENCE_DIR}/03-狗交易已用牌保留禁用原因.jpg`;

type HarnessWindow = Window & {
    __BG_TEST_HARNESS__?: {
        state?: {
            get?: () => {
                core?: BetrayalCore;
            };
        };
    };
};

async function waitForAtlasByTestIds(page: Page, testIds: string[]) {
    await expect.poll(async () => page.evaluate((ids) => {
        return Object.fromEntries(ids.map((testId) => {
            const image = document.querySelector<HTMLImageElement>(
                `[data-testid="${testId}-front-atlas"]`,
            );
            return [
                testId,
                Boolean(image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0),
            ];
        }));
    }, testIds), {
        message: '交易禁用提示 E2E 必须等真实持有物牌面 atlas 加载完成后再截图',
        timeout: 15000,
    }).toEqual(Object.fromEntries(testIds.map((testId) => [testId, true])));
}

function createNormalTradeDisabledReasonCore(): BetrayalCore {
    const core = createExchangeReadyRuntimeCore();
    core.usedCardIdsThisTurn = ['rope', 'map'];
    core.recommendedAction = 'trade';
    return core;
}

function createDogTradeDisabledReasonCore(): BetrayalCore {
    const core = createDogTradeReadyRuntimeCore();
    core.usedCardIdsThisTurn = ['medical-kit'];
    core.recommendedAction = 'trade';
    return core;
}

async function readTradeDisabledState(page: Page) {
    return page.evaluate(() => {
        const holder = window as HarnessWindow;
        const core = holder.__BG_TEST_HARNESS__?.state?.get?.().core;
        const readButton = (testId: string) => {
            const button = document.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
            const reason = document.querySelector<HTMLElement>(`[data-testid="${testId}-disabled-reason"]`);
            const selectedOutline = document.querySelector<HTMLElement>(`[data-testid="${testId}-selected-outline"]`);
            return {
                exists: Boolean(button),
                disabled: Boolean(button?.disabled),
                status: button?.getAttribute('data-trade-card-status') ?? '',
                reason: reason?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
                selected: Boolean(selectedOutline),
            };
        };
        return {
            usedCardIds: core?.usedCardIdsThisTurn ?? [],
            currentInventoryIds: core?.currentExplorerInventory?.map((card) => card.id) ?? [],
            activePlayerId: core?.activePlayerId ?? null,
            giveRope: readButton('betrayal-inventory-rope'),
            giveBook: readButton('betrayal-inventory-omen-book'),
            returnMap: readButton('betrayal-trade-return-card-map'),
            returnSkull: readButton('betrayal-trade-return-card-skull'),
            dogMedicalKit: readButton('betrayal-dog-trade-card-medical-kit'),
            dogMap: readButton('betrayal-dog-trade-card-map'),
        };
    });
}

test.describe('山屋惊魂交易牌面禁用原因', () => {
    test('真实牌桌保留已用持有物牌面并显示不可交易原因', async ({ page, context }) => {
        test.setTimeout(180000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-trade-card-disabled-reasons');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal?players=3&seat0=human&seat1=human&seat2=human&playerID=0', {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
        });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createNormalTradeDisabledReasonCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await waitForAtlasByTestIds(page, ['betrayal-inventory-rope', 'betrayal-inventory-omen-book']);

        await expect(page.getByTestId('betrayal-inventory-rope'), '已用兔脚仍应保留牌面但不能交易').toBeDisabled();
        await expect(page.getByTestId('betrayal-inventory-rope-disabled-reason')).toContainText('本回合已经使用过的持有物不能交易');
        await page.getByTestId('betrayal-inventory-rope').click({ force: true });
        await expect(page.getByTestId('betrayal-inventory-rope-selected-outline')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-inventory-omen-book'), '未用书本仍可交易').toBeEnabled();
        await page.getByTestId('betrayal-inventory-omen-book').click();
        await expect(page.getByTestId('betrayal-inventory-omen-book-selected-outline')).toBeVisible();
        await expect.poll(() => readTradeDisabledState(page), {
            message: '普通交易发起方已用牌必须禁用并保留可读原因',
            timeout: 10000,
        }).toMatchObject({
            usedCardIds: ['rope', 'map'],
            giveRope: {
                exists: true,
                disabled: true,
                status: 'disabled',
                reason: '本回合已经使用过的持有物不能交易。',
                selected: false,
            },
            giveBook: {
                exists: true,
                disabled: false,
                status: 'available',
                selected: true,
            },
        });
        await saveScreenshot(page, NORMAL_GIVE_DISABLED_SCREENSHOT);

        await page.getByTestId('betrayal-room-occupant-hallway-1').click();
        await expect(page.getByTestId('betrayal-trade-return-selector')).toBeVisible();
        await waitForAtlasByTestIds(page, ['betrayal-trade-return-card-map', 'betrayal-trade-return-card-skull']);
        await expect(page.getByTestId('betrayal-trade-return-card-map'), '对方已用地图仍应保留牌面但不能交易').toBeDisabled();
        await expect(page.getByTestId('betrayal-trade-return-card-map-disabled-reason')).toContainText('本回合已经使用过的持有物不能交易');
        await page.getByTestId('betrayal-trade-return-card-map').click({ force: true });
        await expect(page.getByTestId('betrayal-trade-return-card-map-selected-outline')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-trade-return-card-skull'), '对方未用头骨仍可作为给回对象').toBeEnabled();
        await expect(page.getByTestId('betrayal-trade-flow-item-step')).toContainText(/你给出.*书本/);
        await expect(page.getByTestId('betrayal-trade-flow-item-step')).not.toContainText('对方给出 地图');
        await expect.poll(() => readTradeDisabledState(page), {
            message: '普通交易对方已用牌必须禁用并保留可读原因',
            timeout: 10000,
        }).toMatchObject({
            returnMap: {
                exists: true,
                disabled: true,
                status: 'disabled',
                reason: '本回合已经使用过的持有物不能交易。',
                selected: false,
            },
            returnSkull: {
                exists: true,
                disabled: false,
                status: 'available',
            },
        });
        await saveScreenshot(page, NORMAL_RETURN_DISABLED_SCREENSHOT);

        await injectCore(page, createDogTradeDisabledReasonCore());
        await expect(page.getByTestId('betrayal-dog-trade-selector')).toBeVisible();
        await waitForAtlasByTestIds(page, ['betrayal-dog-trade-card-medical-kit', 'betrayal-dog-trade-card-map']);
        await expect(page.getByTestId('betrayal-dog-trade-card-medical-kit'), '狗交易候选区也必须保留已用急救包牌面但禁用').toBeDisabled();
        await expect(page.getByTestId('betrayal-dog-trade-card-medical-kit-disabled-reason')).toContainText('本回合已经使用过的持有物不能交易');
        await page.getByTestId('betrayal-dog-trade-card-medical-kit').click({ force: true });
        await expect(page.getByTestId('betrayal-dog-trade-card-medical-kit-selected-outline')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-dog-trade-card-map'), '狗交易候选区未用地图仍可选择').toBeEnabled();
        await page.getByTestId('betrayal-dog-trade-card-map').click();
        await expect(page.getByTestId('betrayal-dog-trade-card-map-selected-outline')).toBeVisible();
        await expect.poll(() => readTradeDisabledState(page), {
            message: '狗交易候选区已用牌必须禁用并保留可读原因',
            timeout: 10000,
        }).toMatchObject({
            usedCardIds: ['medical-kit'],
            dogMedicalKit: {
                exists: true,
                disabled: true,
                status: 'disabled',
                reason: '本回合已经使用过的持有物不能交易。',
                selected: false,
            },
            dogMap: {
                exists: true,
                disabled: false,
                status: 'available',
                selected: true,
            },
        });
        await saveScreenshot(page, DOG_TRADE_DISABLED_SCREENSHOT);

        await assertNoFatalFrontendErrors([{ label: 'betrayal-trade-card-disabled-reasons', diagnostics }]);
    });
});
