import fs from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';

function loadFeedbackSnapshot(): Record<string, unknown> {
    const packetPath = 'temp/feedback-closeout/2026-06-27T01-17-05-889Z/6a3ec70e6ee79f45eb0a7691.md';
    const text = fs.readFileSync(packetPath, 'utf8');
    const match = text.match(/## 状态快照\s*```text\s*([\s\S]*?)\s*```/);
    if (!match) {
        throw new Error('未找到反馈状态快照');
    }
    return JSON.parse(match[1]) as Record<string, unknown>;
}

async function setHarnessState(page: Page, nextState: Record<string, unknown>): Promise<void> {
    await page.evaluate(async (state) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        if (!harness?.state?.set) {
            throw new Error('TestHarness state.set 不可用');
        }
        await harness.state.set(state);
    }, nextState);
    await page.waitForTimeout(800);
}

test.describe('SmashUp 反馈 6a3ec70 让过点不了复现', () => {
    test.beforeEach(async ({ page: _page }, testInfo) => {
        await clearEvidenceScreenshotsForTest(testInfo);
    });

    test('真实反馈状态直注入后，已有统一响应交互承接时不应再出现中间让过窗', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);

        const snapshot = loadFeedbackSnapshot();

        await game.openTestGame('smashup');
        await setHarnessState(page, snapshot);

        await expect.poll(async () => {
            return await page.evaluate(() => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return {
                    sourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
                    targetType: state?.sys?.interaction?.current?.data?.targetType ?? null,
                    responseWindowType: state?.sys?.responseWindow?.current?.windowType ?? null,
                    resolutionStep: state?.sys?.resolution?.frames?.find(
                        (frame: any) => frame?.id === state?.sys?.resolution?.activeFrameId,
                    )?.step ?? null,
                };
            });
        }, { timeout: 10000 }).toEqual({
            sourceId: 'smashup_reaction_choose',
            targetType: 'button',
            responseWindowType: 'afterScoring',
            resolutionStep: 'mandatory',
        });

        const promptSummary = await page.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const interaction = state?.sys?.interaction?.current ?? null;
            const optionIds = Array.isArray(interaction?.data?.options)
                ? interaction.data.options.map((option: any) => option?.id ?? null)
                : [];
            const optionLabels = Array.isArray(interaction?.data?.options)
                ? interaction.data.options.map((option: any) => option?.label ?? null)
                : [];

            const meFirstOverlay = document.querySelector('[data-testid="me-first-overlay"]');
            const meFirstPassButton = document.querySelector('[data-testid="me-first-pass-button"]');
            const promptCardBanner = document.querySelector('[data-testid="prompt-card-banner"]');
            const promptCardGrid = document.querySelector('[data-testid="prompt-card-grid"]');
            const promptContextCard = document.querySelector('[data-testid="prompt-context-card"]');

            const allVisibleButtons = Array.from(document.querySelectorAll('button'))
                .map((button) => ({
                    text: (button.textContent ?? '').replace(/\s+/g, ' ').trim(),
                    testId: button.getAttribute('data-testid'),
                    className: button.className,
                    rect: {
                        x: Math.round(button.getBoundingClientRect().x),
                        y: Math.round(button.getBoundingClientRect().y),
                        width: Math.round(button.getBoundingClientRect().width),
                        height: Math.round(button.getBoundingClientRect().height),
                    },
                }))
                .filter((button) => button.text || button.testId);

            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            const centerElement = document.elementFromPoint(centerX, centerY) as HTMLElement | null;

            return {
                interactionSourceId: interaction?.data?.sourceId ?? null,
                interactionTargetType: interaction?.data?.targetType ?? null,
                optionIds,
                optionLabels,
                meFirstOverlayVisible: !!meFirstOverlay,
                meFirstPassButtonVisible: !!meFirstPassButton,
                promptCardBannerVisible: !!promptCardBanner,
                promptCardGridVisible: !!promptCardGrid,
                promptContextCardVisible: !!promptContextCard,
                visibleButtons: allVisibleButtons,
                centerElement: centerElement ? {
                    tag: centerElement.tagName,
                    text: (centerElement.textContent ?? '').replace(/\s+/g, ' ').trim(),
                    testId: centerElement.getAttribute('data-testid'),
                    className: centerElement.className,
                } : null,
            };
        });

        const screenshotPath = getEvidenceScreenshotPath(testInfo, '01-反馈6a3ec70-真实状态直注入现场', {
            filename: '01-反馈6a3ec70-真实状态直注入现场.png',
        });
        await page.screenshot({ path: screenshotPath, fullPage: true });

        console.log('[feedback-6a3ec70-repro]', JSON.stringify({
            screenshotPath,
            promptSummary,
        }, null, 2));

        expect(promptSummary.interactionSourceId).toBe('smashup_reaction_choose');
        expect(promptSummary.interactionTargetType).toBe('button');
        expect(promptSummary.optionIds).toEqual([
            'trigger:afterScoring:base_pirate_cove:0:0',
            'trigger:afterScoring:pirate_first_mate:score-after:0:0:c7:0',
        ]);

        // 这条反馈的快照本体已经有统一响应交互承接，中央 Me First 壳层不应再并列出现。
        expect(promptSummary.meFirstOverlayVisible).toBe(false);
        expect(promptSummary.meFirstPassButtonVisible).toBe(false);
    });
});
