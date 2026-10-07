import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    initBetrayalContext,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-core-interactions/scenario-card-selection';
const CANDIDATES_SCREENSHOT = `${EVIDENCE_DIR}/01-七张剧本卡候选.jpg`;
const PENDING_BLOCKED_SCREENSHOT = `${EVIDENCE_DIR}/02-待接入剧本卡不能开始.jpg`;
const STARTED_RUNTIME_SCREENSHOT = `${EVIDENCE_DIR}/03-确认木乃伊横行后进入牌桌.jpg`;

test.describe('山屋惊魂剧本卡候选选择', () => {
    test('真实入口必须先从七张剧本卡候选中确认可运行木乃伊横行', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-scenario-card-selection');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await expect(page.getByTestId('betrayal-character-select-screen')).toBeVisible({ timeout: 30000 });
        await page
            .getByTestId('betrayal-character-selection-grid')
            .getByTestId('betrayal-character-card-jaden-jones')
            .click();
        await page.getByTestId('betrayal-character-confirm').click();
        await expect(page.getByTestId('betrayal-character-scenario-button')).toContainText('木乃伊横行');
        await expect(page.getByTestId('betrayal-character-confirm')).toHaveText(/确认此剧本卡/);
        await expect(page.getByTestId('betrayal-scenario-confirmation-count')).toHaveText(/剧本确认 0\/1/);

        await page.getByTestId('betrayal-character-scenario-button').click();
        await expect(page.getByTestId('betrayal-scenario-select-dialog')).toBeVisible();
        await expect(page.getByTestId('betrayal-scenario-select-dialog')).not.toContainText('翻阅候选剧本卡');
        await expect(page.getByTestId('betrayal-scenario-candidate-count')).toHaveText(/7 张候选/);
        await expect(page.getByTestId('betrayal-scenario-dialog-confirmation-count')).toHaveText(/剧本确认 0\/1/);
        await expect(page.getByTestId('betrayal-scenario-candidate-list').locator('button')).toHaveCount(7);
        await expect(page.getByTestId('betrayal-scenario-option-mummy-rampage')).toContainText('木乃伊横行');
        await expect(page.getByTestId('betrayal-scenario-option-mummy-rampage')).toContainText('当前提议');
        await expect(page.getByTestId('betrayal-scenario-option-mummy-rampage')).toHaveAttribute('data-scenario-card-status', 'implemented');
        await expect(page.getByTestId('betrayal-scenario-option-crimson-jack-returns')).toContainText('赤红杰克归来');
        await expect(page.getByTestId('betrayal-scenario-option-crimson-jack-returns')).toContainText('暂不可选');
        await expect(page.getByTestId('betrayal-scenario-option-crimson-jack-returns')).toHaveAttribute('data-scenario-card-status', 'contract-pending');
        await expect(page.getByTestId('betrayal-scenario-option-friends-forever')).toContainText('永远的朋友');
        await expect(page.getByTestId('betrayal-scenario-option-friends-forever')).toContainText('暂不可选');
        await expect(page.getByTestId('betrayal-scenario-option-friends-forever')).toHaveAttribute('data-scenario-card-status', 'contract-pending');
        const candidateListMetrics = await page.getByTestId('betrayal-scenario-candidate-list').evaluate((element) => {
            const list = element.getBoundingClientRect();
            const fullyVisibleCount = Array.from(element.querySelectorAll<HTMLElement>('button[data-testid^="betrayal-scenario-option-"]'))
                .filter((candidate) => {
                    const box = candidate.getBoundingClientRect();
                    return box.width > 0 && box.height > 0 && box.top >= list.top - 1 && box.bottom <= list.bottom + 1;
                }).length;
            return { fullyVisibleCount };
        });
        expect(candidateListMetrics.fullyVisibleCount, '候选滚动列表默认至少显示两条完整候选卡').toBeGreaterThanOrEqual(2);
        await saveScreenshot(page, CANDIDATES_SCREENSHOT);

        await page.getByTestId('betrayal-scenario-option-crimson-jack-returns').click();
        await expect(page.getByTestId('betrayal-scenario-option-crimson-jack-returns')).toContainText('当前提议');
        await page.getByTestId('betrayal-scenario-select-current').click();
        await expect(page.getByTestId('betrayal-scenario-select-dialog')).toBeHidden();
        await expect(page.getByTestId('betrayal-character-scenario-button')).toContainText('赤红杰克归来');
        await expect(page.getByTestId('betrayal-character-scenario-button')).toContainText('已确认');
        await expect(page.getByTestId('betrayal-scenario-confirmation-count')).toHaveText(/剧本确认 1\/1/);
        await expect(page.getByTestId('betrayal-character-confirm')).toBeDisabled();
        await expect(page.getByTestId('betrayal-character-confirm')).toHaveText(/这个剧本现在不能开始/);
        await saveScreenshot(page, PENDING_BLOCKED_SCREENSHOT);

        await page.getByTestId('betrayal-character-scenario-button').click();
        await page.getByTestId('betrayal-scenario-option-mummy-rampage').click();
        await page.getByTestId('betrayal-scenario-select-current').click();
        await expect(page.getByTestId('betrayal-scenario-select-dialog')).toBeHidden();
        const openingStage = page.getByTestId('betrayal-start-scenario-opening-stage');
        await expect(openingStage).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-start-scenario-opening-cinematic')).toContainText('英雄开场过场');
        await page.getByTestId('betrayal-start-scenario-opening-continue').click();
        await expect(openingStage).toHaveCount(0);

        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-room-grid')).toBeVisible();
        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/作祟前|Pre-Haunt/i);
        await saveScreenshot(page, STARTED_RUNTIME_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-scenario-card-selection', diagnostics }]);
    });
});
