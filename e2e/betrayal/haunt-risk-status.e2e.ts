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
const THREE_OMEN_SCREENSHOT = `${EVIDENCE_DIR}/01-预兆状态-三预兆待检定.jpg`;
const LAST_OMEN_READY_SCREENSHOT = `${EVIDENCE_DIR}/02-预兆状态-最后预兆提示.jpg`;
const LAST_OMEN_TRIGGERED_SCREENSHOT = `${EVIDENCE_DIR}/03-最后预兆触发后.jpg`;
const PLAYER_ZERO_TEST_URL = '/play/betrayal?players=3&playerID=0&seat0=human&seat1=human&seat2=human';

test.describe('山屋惊魂预兆状态条', () => {
    test('真实牌桌入口用预兆进度条承载作祟检定信息', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-haunt-risk-status');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(PLAYER_ZERO_TEST_URL, { waitUntil: 'domcontentloaded' });
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
        await expect(riskStatus).toHaveText(/预兆状态/);
        await expect(riskStatus).toHaveText(/预兆 3/);
        await expect(riskStatus).not.toHaveText(/再抽预兆时检定/);
        await expect(riskStatus).toHaveAttribute('title', /抽预兆后作祟检定/);
        await expect(riskStatus).toHaveAttribute('title', /5\+ 作祟/);
        const riskProgress = page.getByTestId('betrayal-haunt-risk-progress');
        await expect(riskProgress).toHaveAttribute('data-track-min', '0');
        await expect(riskProgress).toHaveAttribute('data-track-max', '9');
        await expect(riskProgress).toHaveAttribute('data-current-omen-count', '3');
        await expect(riskProgress).toHaveAttribute('data-progress-percent', '33');
        await expect(riskProgress).toHaveAttribute('aria-valuenow', '3');
        await expect(page.getByTestId('betrayal-haunt-risk-slot')).toHaveCount(10);
        await expect(page.getByTestId('betrayal-haunt-risk-pointer')).toHaveAttribute('data-progress-percent', '33');
        const oldRiskCopy = new RegExp(['下次' + '掷', `${5}\\+ 作祟`].join('|'));
        await expect(riskStatus).not.toHaveText(oldRiskCopy);
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
        await page.goto(PLAYER_ZERO_TEST_URL, { waitUntil: 'domcontentloaded' });
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
        await expect(riskStatus).toHaveText(/再抽即作祟/);
        await expect(riskStatus).toHaveAttribute('title', /最后一张/);
        await saveScreenshot(page, LAST_OMEN_READY_SCREENSHOT);

        await page.getByTestId('betrayal-action-move').click();
        await page.getByTestId('betrayal-room-hallway').click();
        await expect(page.getByTestId('betrayal-action-explore')).toBeEnabled();
        await page.getByTestId('betrayal-action-explore').click();
        await page.getByTestId('betrayal-room-ground-north').click();
        await expect(page.getByTestId('betrayal-room-placement-panel')).toBeVisible();
        await page.getByTestId('betrayal-room-placement-confirm').click();

        await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toBeVisible();
        await expect(page.getByTestId('betrayal-discovery-panel')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/恶兆后|Haunt/i);
        await expect(riskStatus).toHaveAttribute('data-haunt-started', 'true');
        await expect(riskStatus).toHaveText(/作祟已开始/);
        await expect(riskStatus).toHaveAttribute('title', /不再进行作祟检定/);
        await page.getByTestId('betrayal-haunt-reveal-close').click();
        await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-discovery-panel')).toBeVisible();
        await expect(page.getByTestId('betrayal-discovery-panel-content')).toContainText(/最后一张预兆|自动触发作祟|作祟/);
        for (let safety = 0; safety < 4; safety += 1) {
            if (!await page.getByTestId('betrayal-discovery-continue').isVisible().catch(() => false)) {
                break;
            }
            await page.getByTestId('betrayal-discovery-continue').click();
        }
        await expect(page.getByTestId('betrayal-discovery-panel')).toBeHidden();
        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/恶兆后|Haunt/i);
        await expect(riskStatus).toHaveAttribute('data-haunt-started', 'true');
        await expect(riskStatus).toHaveText(/作祟已开始/);
        await saveScreenshot(page, LAST_OMEN_TRIGGERED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-last-omen-auto-haunt', diagnostics }]);
    });
});
