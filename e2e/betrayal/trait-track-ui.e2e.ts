import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-core-interactions/trait-track-ui';
const CURRENT_TRACK_SCREENSHOT = `${EVIDENCE_DIR}/01-属性轨角色板-连续轨指针位置.jpg`;
const DETAIL_TRACK_SCREENSHOT = `${EVIDENCE_DIR}/02-属性轨详情-队友连续轨.jpg`;

test.describe('山屋惊魂属性轨 UI', () => {
    test('真实牌桌入口按属性轨位置显示夹子，重复数值不吞掉位置变化', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-trait-track-ui');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        const core = createRuntimeCore();
        core.currentExplorer.traitTracks.speed = {
            trackId: 'e2e-current-speed-nonlinear',
            values: [1, 3, 3, 4, 5],
            position: 1,
            startPosition: 3,
            criticalPosition: 0,
            skullPosition: -1,
            maxPosition: 4,
        };
        core.currentExplorer.traits.speed = 3;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.otherExplorers = core.otherExplorers.map((explorer, index) => (
            index === 0
                ? {
                    ...explorer,
                    traits: { ...explorer.traits, speed: 3 },
                    traitTracks: {
                        ...explorer.traitTracks,
                        speed: {
                            trackId: 'e2e-teammate-speed-nonlinear',
                            values: [1, 3, 3, 4, 5],
                            position: 1,
                            startPosition: 3,
                            criticalPosition: 0,
                            skullPosition: -1,
                            maxPosition: 4,
                        },
                    },
                }
                : explorer
        ));

        await injectCore(page, core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });

        const speedTrack = page.getByTestId('betrayal-current-trait-track-speed');
        await expect(speedTrack).toBeVisible();
        await expect(speedTrack).toHaveAttribute('data-trait-track-position', '1');
        await expect(speedTrack).toHaveAttribute('data-trait-track-value', '3');
        await expect(speedTrack.locator('[data-trait-track-rail="true"]')).toBeVisible();
        await expect(speedTrack.locator('[data-trait-track-pointer="true"]')).toHaveAttribute('data-trait-track-position', '1');
        await expect(speedTrack.locator('[data-trait-track-pointer="true"]')).toHaveAttribute('data-trait-track-current', 'true');
        await expect(speedTrack.locator('[data-trait-track-position="2"][data-trait-track-current="false"]')).toHaveText('3');

        const boardMarker = page.getByTestId('betrayal-explorer-board-marker-speed');
        await expect(boardMarker).toHaveAttribute('data-trait-track-position', '1');
        await expect(boardMarker).toHaveAttribute('data-trait-track-value', '3');
        await saveScreenshot(page, CURRENT_TRACK_SCREENSHOT);

        await page.getByTestId('betrayal-bottom-teammate-1').click();
        await expect(page.getByTestId('betrayal-explorer-detail-dialog-1')).toBeVisible();
        const detailSpeedTrack = page.getByTestId('betrayal-explorer-detail-trait-track-1-speed');
        await expect(detailSpeedTrack).toHaveAttribute('data-trait-track-position', '1');
        await expect(detailSpeedTrack.locator('[data-trait-track-rail="true"]')).toBeVisible();
        await expect(detailSpeedTrack.locator('[data-trait-track-pointer="true"]')).toHaveAttribute('data-trait-track-position', '1');
        await expect(detailSpeedTrack.locator('[data-trait-track-pointer="true"]')).toHaveAttribute('data-trait-track-current', 'true');
        await expect(detailSpeedTrack.locator('[data-trait-track-position="2"][data-trait-track-current="false"]')).toHaveText('3');
        await saveScreenshot(page, DETAIL_TRACK_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-trait-track-ui', diagnostics }]);
    });
});
