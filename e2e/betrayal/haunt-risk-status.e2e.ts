import { expect, test } from '@playwright/test';
import { BETRAYAL_DISCOVERY_POOLS } from '../../src/games/betrayal/scenarioConfig';
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
const LAST_OMEN_READY_SCREENSHOT = `${EVIDENCE_DIR}/02-预兆状态-牌堆末张提示.jpg`;
const LAST_OMEN_DISCOVERY_SCREENSHOT = `${EVIDENCE_DIR}/03-抽到触发预兆后先显示来源.jpg`;
const LAST_OMEN_READER_SCREENSHOT = `${EVIDENCE_DIR}/04-确认触发预兆后剧本阅读承接.jpg`;
const LAST_OMEN_TRIGGERED_SCREENSHOT = `${EVIDENCE_DIR}/05-关闭剧本书后作祟牌桌.jpg`;
const PLAYER_ZERO_TEST_URL = '/play/betrayal?players=3&playerID=0&seat0=human&seat1=human&seat2=human';

function requireOmenCard(cardId: string) {
    const card = BETRAYAL_DISCOVERY_POOLS.possessions.omen.find((candidate) => candidate.id === cardId);
    if (!card) {
        throw new Error(`山屋 E2E 缺少真实预兆卡：${cardId}`);
    }
    return { ...card };
}

const FINAL_DRAW_OMEN_CARD = requireOmenCard('dog');
const CURRENT_PLAYER_OMEN_CARD = requireOmenCard('omen-book');
const TEAMMATE_OMEN_CARDS = [
    requireOmenCard('mask'),
    requireOmenCard('skull'),
];

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
            { ...CURRENT_PLAYER_OMEN_CARD },
            { id: 'item-current', name: '幸运石', kind: 'item' },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.otherExplorers = core.otherExplorers.map((explorer, index) => ({
            ...explorer,
            inventory: [
                { ...TEAMMATE_OMEN_CARDS[index % TEAMMATE_OMEN_CARDS.length]! },
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
        await expect(riskStatus).toHaveAttribute('title', /抽到预兆后/);
        await expect(riskStatus).toHaveAttribute('title', /总点数达到 5 点/);
        const riskProgress = page.getByTestId('betrayal-haunt-risk-progress');
        await expect(riskProgress).toHaveAttribute('data-track-min', '0');
        await expect(riskProgress).toHaveAttribute('data-track-max', '9');
        await expect(riskProgress).toHaveAttribute('data-current-omen-count', '3');
        await expect(riskProgress).toHaveAttribute('data-progress-percent', '33');
        await expect(riskProgress).toHaveAttribute('data-current-display', 'material-slot-highlight');
        await expect(riskProgress).toHaveAttribute('data-haunt-risk-style', 'official-asset-track');
        await expect(riskProgress).toHaveAttribute('data-haunt-risk-track-shape', 'material-0-9-bar');
        await expect(page.getByTestId('betrayal-haunt-risk-track-image')).toHaveAttribute('data-haunt-risk-track-image', 'official-0-9');
        await expect(riskProgress.locator('[data-haunt-risk-slot-grid="true"]')).toBeVisible();
        await expect(riskProgress).toHaveAttribute('aria-valuenow', '3');
        const riskSlots = page.getByTestId('betrayal-haunt-risk-slot');
        await expect(riskSlots).toHaveCount(10);
        await expect(riskSlots.nth(3)).toHaveAttribute('data-haunt-risk-slot', '3');
        await expect(riskSlots.nth(3)).toHaveAttribute('data-haunt-risk-current-slot', 'true');
        await expect(riskSlots.nth(3)).toHaveAttribute('data-haunt-risk-current-cell', 'true');
        await expect(riskSlots.nth(2)).toHaveAttribute('data-haunt-risk-current-slot', 'false');
        await expect(riskSlots.nth(2)).toHaveAttribute('data-haunt-risk-current-cell', 'false');
        await expect(riskSlots.nth(2)).toHaveText('');
        await expect(page.getByTestId('betrayal-haunt-risk-pointer')).toHaveCount(0);
        const oldRiskCopy = new RegExp(['下次' + '掷', `${5}\\+ 作祟`].join('|'));
        await expect(riskStatus).not.toHaveText(oldRiskCopy);
        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/作祟前|Pre-Haunt/i);

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
            { ...FINAL_DRAW_OMEN_CARD },
        ];
        core.currentExplorer.inventory = [
            { ...CURRENT_PLAYER_OMEN_CARD },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.otherExplorers = core.otherExplorers.map((explorer, index) => ({
            ...explorer,
            inventory: [
                { ...TEAMMATE_OMEN_CARDS[index % TEAMMATE_OMEN_CARDS.length]! },
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
        await expect(riskStatus).toHaveAttribute('title', /最后一张预兆/);
        await saveScreenshot(page, LAST_OMEN_READY_SCREENSHOT);

        await page.getByTestId('betrayal-action-move').click();
        await page.getByTestId('betrayal-room-hallway').click();
        await expect(page.getByTestId('betrayal-action-explore')).toBeEnabled();
        await page.getByTestId('betrayal-action-explore').click();
        await page.getByTestId('betrayal-room-ground-north').click();
        await expect(page.getByTestId('betrayal-room-placement-panel')).toBeVisible();
        await page.getByTestId('betrayal-room-placement-confirm').click();

        await expect(page.getByTestId('betrayal-haunt-reveal-cue'), '触发预兆来源确认前作祟揭示横幅不得抢先出现').toHaveCount(0);
        await expect(page.getByTestId('betrayal-scenario-reader-dialog'), '触发预兆来源确认前不得自动打开剧本书').toHaveCount(0);
        await expect(page.getByTestId('betrayal-discovery-panel')).toBeVisible();
        await expect(page.getByTestId('betrayal-discovery-panel-content')).toContainText(FINAL_DRAW_OMEN_CARD.name);
        await expect(page.getByTestId('betrayal-discovery-panel-content')).toContainText(/自动触发作祟|作祟/);
        await expect(page.getByTestId('betrayal-discovery-panel-content')).not.toContainText('最后预兆');
        await saveScreenshot(page, LAST_OMEN_DISCOVERY_SCREENSHOT);
        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/作祟中|Haunt/i);
        await expect(riskStatus).toHaveAttribute('data-haunt-started', 'true');
        await expect(riskStatus).toHaveText(/作祟已开始/);
        await expect(riskStatus).toHaveAttribute('title', /不再进行作祟检定/);
        for (let safety = 0; safety < 4; safety += 1) {
            if (!await page.getByTestId('betrayal-discovery-continue').isVisible().catch(() => false)) {
                break;
            }
            await page.getByTestId('betrayal-discovery-continue').click();
        }
        await expect(page.getByTestId('betrayal-discovery-panel')).toBeHidden();
        const scenarioReaderDialog = page.getByTestId('betrayal-scenario-reader-dialog');
        await expect(
            scenarioReaderDialog,
            '触发预兆导致作祟这个状态变化后必须承接一次剧本阅读',
        ).toBeVisible();
        await expect(scenarioReaderDialog.getByTestId('betrayal-scenario-opening-stage')).toBeVisible();
        await expect(scenarioReaderDialog).toContainText(/木乃伊横行|剧本1/);
        await saveScreenshot(page, LAST_OMEN_READER_SCREENSHOT);
        await page.getByTestId('betrayal-scenario-reader-close').click();
        await expect(scenarioReaderDialog).toHaveCount(0);
        await expect(page.getByTestId('betrayal-haunt-reveal-cue'), '触发预兆已经由剧本书承接后，不再追加作祟横幅').toHaveCount(0);
        await expect(page.getByTestId('betrayal-discovery-panel'), '已确认过的触发预兆关闭剧本书后不得重复弹出').toHaveCount(0);
        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/作祟中|Haunt/i);
        await expect(riskStatus).toHaveAttribute('data-haunt-started', 'true');
        await expect(riskStatus).toHaveText(/作祟已开始/);
        await saveScreenshot(page, LAST_OMEN_TRIGGERED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-last-omen-auto-haunt', diagnostics }]);
    });
});
