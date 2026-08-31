import type { Page } from '@playwright/test';
import { expect } from '../framework';

type JsonRecord = Record<string, any>;
type ReadGameState = () => Promise<JsonRecord>;

type RightTrayBonusDiceOptions = {
    sourceAbilityId?: string;
};

type RightTrayBonusDiceReviewOptions = {
    expectedValues?: number[];
};

type NoCentralBonusDicePresentationOptions = {
    /** 纯卡牌预览可以与右侧奖励骰并存；只有其中的骰子/汇总内容应被禁止。 */
    allowCardSpotlight?: boolean;
};

const readPendingBonusSettlement = async (readState: ReadGameState) => {
    const state = await readState();
    return state?.pendingBonusDiceSettlement
        ?? state?.core?.pendingBonusDiceSettlement
        ?? state?.G?.core?.pendingBonusDiceSettlement
        ?? null;
};

const closeDebugPanelIfVisible = async (page: Page): Promise<void> => {
    const panel = page.getByTestId('debug-panel');
    if (!await panel.isVisible().catch(() => false)) return;

    await page.getByTestId('debug-toggle').click({ timeout: 5000 });
    await expect(panel).toBeHidden({ timeout: 5000 });
};

const rightTrayRail = (page: Page) => {
    const diceTray = page.locator('[data-testid="dicethrone-2d-dice-tray"]:visible').first();
    return {
        diceTray,
        rail: diceTray.locator('xpath=ancestor::*[@data-player-seat-anchor][1]'),
    };
};

/**
 * 奖励骰 / 临时骰流程不能再由中央特写承接。
 * 玩家要改的骰子必须留在右侧 2D 骰盘，不能被中间浮层抢焦点。
 */
export const expectNoCentralBonusDicePresentation = async (
    page: Page,
    { allowCardSpotlight = true }: NoCentralBonusDicePresentationOptions = {},
): Promise<void> => {
    await expect(page.getByTestId('compare-roll-overlay')).toHaveCount(0);
    await expect(page.getByTestId('bonus-die-overlay')).toHaveCount(0);
    await expect(page.getByTestId('bonus-dice-confirm-button')).toHaveCount(0);
    await expect(page.getByTestId('roll-spotlight-dice-content')).toHaveCount(0);
    await expect(page.locator('[data-testid="card-spotlight-die"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="card-spotlight-summary-text"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="card-spotlight-overlay"] [data-testid="dice-2d"]')).toHaveCount(0);
    if (!allowCardSpotlight) {
        await expect(page.getByTestId('card-spotlight-overlay')).toHaveCount(0);
    }
};

/**
 * 返回当前页面真实可见的右侧 2D 骰盘。
 * 奖励骰的所有者由页面视角决定，调用方不应再用领域 playerId 猜 DOM 容器。
 */
export const getRightTrayDiceTray = (page: Page) => rightTrayRail(page).diceTray;

export const getRightTrayDie = (page: Page, dieId: number | string) => (
    getRightTrayDiceTray(page).locator(`[data-testid="die-button-${dieId}"]`).first()
);

/**
 * 截图前等待玩家实际看见的骰盘静置。
 * 领域结算已完成不代表视觉结算已完成：飞行特效和 2D 骰子翻滚都必须退场，
 * 否则证据会截到伤害飘字或翻转残影，不能证明最终玩家画面。
 */
export const waitForDiceThroneVisualIdle = async (page: Page): Promise<void> => {
    await expect(page.locator('[data-testid^="flying-effect-"]')).toHaveCount(0, { timeout: 10000 });
    await expect(page.locator('[data-floating-text-preset="impact-damage"]')).toHaveCount(0, { timeout: 10000 });
    await expect.poll(async () => {
        return page.locator('[data-testid="dice-2d"]').evaluateAll((dice) => (
            dice.every((die) => (
                die.getAttribute('data-roll-animation') === 'settled'
                && die.getAnimations({ subtree: true }).every((animation) => animation.playState !== 'running')
            ))
        ));
    }, { timeout: 10000 }).toBe(true);
};

/**
 * 奖励骰只能由右侧 2D 骰盘确认。这里仅承接所有来源共有的 UI 生命周期；
 * 调用方仍负责断言各自的改骰、伤害、资源、目标和阶段结果。
 */
export const expectRightTrayBonusDiceConfirmation = async (
    page: Page,
    readState: ReadGameState,
    { sourceAbilityId }: RightTrayBonusDiceOptions = {},
): Promise<void> => {
    const settlement = async () => {
        return readPendingBonusSettlement(readState);
    };
    if (sourceAbilityId) {
        await expect.poll(async () => {
            const pending = await settlement();
            return pending?.sourceAbilityId ?? null;
        }, { timeout: 10000 }).toBe(sourceAbilityId);
    } else {
        await expect.poll(settlement, { timeout: 10000 }).not.toBeNull();
    }
    await closeDebugPanelIfVisible(page);

    const { diceTray, rail } = rightTrayRail(page);
    const confirmButton = rail.locator('[data-tutorial-id="dice-confirm-button"]').first();
    await expectNoCentralBonusDicePresentation(page);
    await expect(diceTray).toBeVisible({ timeout: 10000 });
    await expect(confirmButton).toBeVisible({ timeout: 10000 });
    await expect(confirmButton).toBeEnabled();
    await expect(confirmButton).toHaveText(/^(确认|Confirm)$/);
};

/**
 * 奖励骰处于可介入窗口时，对方视角也必须能看见右侧骰盘。
 * 骰主确认按钮只出现在骰主视角；介入方通过手牌 / Token / 技能直接发起改骰。
 */
export const expectRightTrayBonusDiceInterferenceView = async (
    page: Page,
    readState: ReadGameState,
    { sourceAbilityId }: RightTrayBonusDiceOptions = {},
): Promise<void> => {
    if (sourceAbilityId) {
        await expect.poll(async () => {
            const settlement = await readPendingBonusSettlement(readState);
            return settlement?.sourceAbilityId ?? null;
        }, { timeout: 10000 }).toBe(sourceAbilityId);
    } else {
        await expect.poll(() => readPendingBonusSettlement(readState), { timeout: 10000 }).not.toBeNull();
    }
    await closeDebugPanelIfVisible(page);

    const { diceTray, rail } = rightTrayRail(page);
    await expectNoCentralBonusDicePresentation(page);
    await expect(diceTray).toBeVisible({ timeout: 10000 });
    await expect(rail.locator('[data-tutorial-id="dice-confirm-button"]')).toHaveCount(0);
};

/**
 * 独立展示 / complete 奖励骰普通确认后，右侧骰盘必须留下最终骰面只读回看。
 *
 * 父链临时骰确认后会恢复攻击 / 防御等父骰盘；调用方只有在该奖励骰确认为
 * 独立展示型时才应使用这个断言。
 */
export const expectRightTrayBonusDiceReadOnlyReview = async (
    page: Page,
    { expectedValues }: RightTrayBonusDiceReviewOptions = {},
): Promise<void> => {
    await closeDebugPanelIfVisible(page);

    const { diceTray } = rightTrayRail(page);
    await expectNoCentralBonusDicePresentation(page);
    await expect(diceTray).toBeVisible({ timeout: 10000 });

    if (expectedValues) {
        await expect.poll(async () => (
            diceTray.locator('[data-testid^="die-button-"]').evaluateAll((nodes) => (
                nodes.map((node) => Number((node as HTMLElement).dataset.displayValue))
            ))
        ), { timeout: 10000 }).toEqual(expectedValues);
    }

    await expect.poll(async () => (
        diceTray.locator('[data-testid^="die-button-"]').evaluateAll((nodes) => (
            nodes.every((node) => (node as HTMLElement).dataset.clickable === 'false')
        ))
    ), { timeout: 10000 }).toBe(true);
};

/**
 * 走完当前临时骰的正式玩家入口。
 *
 * 卡牌/技能 E2E 只声明“哪一个效果已产生临时骰”和“收口后的专属结果”；
 * 右侧骰盘、确认按钮和 pending 清理由这里统一承接。确认后的去向由 settlement
 * continuation 决定：父链临时骰恢复父骰盘，独立展示型保留只读回看。
 */
export const settleCurrentBonusDice = async (
    page: Page,
    readState: ReadGameState,
    options: RightTrayBonusDiceOptions,
): Promise<void> => {
    await expectRightTrayBonusDiceConfirmation(page, readState, options);
    const { rail } = rightTrayRail(page);
    const confirmButton = rail.locator('[data-tutorial-id="dice-confirm-button"]').first();
    await confirmButton.click();

    await expect.poll(async () => {
        return readPendingBonusSettlement(readState);
    }, { timeout: 10000 }).toBeNull();
    await closeDebugPanelIfVisible(page);
};
