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

const EVIDENCE_DIR = 'evidence/betrayal-core-interactions/haunt-risk-status';
const THREE_OMEN_SCREENSHOT = `${EVIDENCE_DIR}/01-作祟风险条-三预兆下次四骰.jpg`;
const LAST_OMEN_READY_SCREENSHOT = `${EVIDENCE_DIR}/02-作祟风险条-最后预兆自动作祟提示.jpg`;
const LAST_OMEN_TRIGGERED_SCREENSHOT = `${EVIDENCE_DIR}/03-最后预兆自动作祟后.jpg`;

test.describe('山屋惊魂作祟风险条', () => {
    test('真实牌桌入口按全员预兆总数显示下次作祟检定风险', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-haunt-risk-status');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        const core = createRuntimeCore();
        core.currentExplorer.inventory = [
            { id: 'omen-current', name: '黑暗预兆', kind: 'omen' },
            { id: 'item-current', name: '幸运石', kind: 'item' },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.otherExplorers = core.otherExplorers.map((explorer, index) => ({
            ...explorer,
            inventory: [
                {
                    id: `omen-other-${index + 1}`,
                    name: `队友预兆${index + 1}`,
                    kind: 'omen',
                },
            ],
        }));

        await injectCore(page, core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });

        const riskStatus = page.getByTestId('betrayal-haunt-risk-status');
        await expect(riskStatus).toBeVisible();
        await expect(riskStatus).toHaveAttribute('data-omen-count', '3');
        await expect(riskStatus).toHaveAttribute('data-next-dice-count', '4');
        await expect(riskStatus).toHaveAttribute('data-threshold', '5');
        await expect(riskStatus).toHaveAttribute('data-haunt-started', 'false');
        await expect(riskStatus).toHaveText(/作祟风险/);
        await expect(riskStatus).toHaveText(/预兆 3/);
        await expect(riskStatus).toHaveText(/下次掷 4 颗/);
        await expect(riskStatus).toHaveText(/5\+ 作祟/);
        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/恶兆前|Pre-Haunt/i);

        await saveScreenshot(page, THREE_OMEN_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-haunt-risk-status', diagnostics }]);
    });

    test('真实探索动作抽到最后一张预兆时自动进入作祟', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-last-omen-auto-haunt');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        const core = createRuntimeCore();
        core.drawOrder = ['omen'];
        core.deckCounts.omen = 1;
        core.possessionOrderByKind.omen = [
            { id: 'omen-final', name: '最后预兆', kind: 'omen' },
        ];
        core.currentExplorer.inventory = [
            { id: 'omen-current', name: '黑暗预兆', kind: 'omen' },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.otherExplorers = core.otherExplorers.map((explorer, index) => ({
            ...explorer,
            inventory: [
                {
                    id: `omen-other-${index + 1}`,
                    name: `队友预兆${index + 1}`,
                    kind: 'omen',
                },
            ],
        }));

        await injectCore(page, core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });

        const riskStatus = page.getByTestId('betrayal-haunt-risk-status');
        await expect(riskStatus).toBeVisible();
        await expect(riskStatus).toHaveAttribute('data-omen-count', '3');
        await expect(riskStatus).toHaveAttribute('data-next-omen-automatic', 'true');
        await expect(riskStatus).toHaveAttribute('data-haunt-started', 'false');
        await expect(riskStatus).toHaveText(/下张预兆自动作祟/);
        await saveScreenshot(page, LAST_OMEN_READY_SCREENSHOT);

        await page.getByTestId('betrayal-action-move').click();
        await page.getByTestId('betrayal-room-hallway').click();
        await expect(page.getByTestId('betrayal-action-explore')).toBeEnabled();
        await page.getByTestId('betrayal-action-explore').click();
        await page.getByTestId('betrayal-room-ground-north').click();

        await expect(page.getByTestId('betrayal-discovery-panel')).toBeVisible();
        await expect(page.getByTestId('betrayal-discovery-panel-content')).toContainText(/最后一张预兆|自动触发作祟|作祟/);
        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/恶兆后|Haunt/i);
        await expect(riskStatus).toHaveAttribute('data-haunt-started', 'true');
        await expect(riskStatus).toHaveText(/作祟已开始/);
        await page.getByTestId('betrayal-discovery-continue').click();
        await expect(page.getByTestId('betrayal-discovery-panel')).toBeHidden();
        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/恶兆后|Haunt/i);
        await expect(riskStatus).toHaveAttribute('data-haunt-started', 'true');
        await expect(riskStatus).toHaveText(/作祟已开始/);
        await saveScreenshot(page, LAST_OMEN_TRIGGERED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-last-omen-auto-haunt', diagnostics }]);
    });
});
