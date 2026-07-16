import { resolve } from 'path';
import { expect, test, type Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import { createStartedFirstScenarioCore } from '../../src/games/betrayal/testing/firstScenarioTestUtils';
import {
    expectVisiblePhysicalDiceBox,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    waitForPhysicalDiceSettled,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = resolve(process.cwd(), 'evidence/山屋惊魂-圣符作祟判定');
const BEFORE_EXPLORE_SCREENSHOT = `${EVIDENCE_DIR}/01-圣符作祟判定-探索前.jpg`;
const TARGET_SELECTION_SCREENSHOT = `${EVIDENCE_DIR}/02-圣符作祟判定-选择未知房间.jpg`;
const OMEN_REVEALED_SCREENSHOT = `${EVIDENCE_DIR}/03-圣符作祟判定-圣符翻出.jpg`;
const HAUNT_ROLL_DICE_SCREENSHOT = `${EVIDENCE_DIR}/04-圣符作祟判定-作祟骰盘停稳.jpg`;
const HAUNT_ROLL_RESULT_SCREENSHOT = `${EVIDENCE_DIR}/05-圣符作祟判定-结果可见.jpg`;
const DISMISSED_SCREENSHOT = `${EVIDENCE_DIR}/06-圣符作祟判定-关闭后回牌桌.jpg`;
const OMEN_SAMPLE_EVIDENCE_DIR = resolve(process.cwd(), 'evidence/山屋惊魂-预兆作祟判定抽样完整链路');
const BOOK_BEFORE_EXPLORE_SCREENSHOT = `${OMEN_SAMPLE_EVIDENCE_DIR}/书本作祟判定-01-探索前.jpg`;
const BOOK_TARGET_SELECTION_SCREENSHOT = `${OMEN_SAMPLE_EVIDENCE_DIR}/书本作祟判定-02-选择未知房间.jpg`;
const BOOK_OMEN_REVEALED_SCREENSHOT = `${OMEN_SAMPLE_EVIDENCE_DIR}/书本作祟判定-03-书本翻出.jpg`;
const BOOK_HAUNT_ROLL_DICE_SCREENSHOT = `${OMEN_SAMPLE_EVIDENCE_DIR}/书本作祟判定-04-作祟骰盘停稳.jpg`;
const BOOK_HAUNT_ROLL_RESULT_SCREENSHOT = `${OMEN_SAMPLE_EVIDENCE_DIR}/书本作祟判定-05-结果可见.jpg`;
const BOOK_DISMISSED_SCREENSHOT = `${OMEN_SAMPLE_EVIDENCE_DIR}/书本作祟判定-06-关闭后回牌桌.jpg`;

const dismissDiscoveryPanel = async (page: Page) => {
    const discoveryPanel = page.getByTestId('betrayal-discovery-panel');
    const blankPoint = await discoveryPanel.evaluate((panel) => {
        const panelRect = panel.getBoundingClientRect();
        const content = panel.querySelector('[data-testid="betrayal-discovery-panel-content"]');
        const contentRect = content?.getBoundingClientRect();
        const candidates = [
            { x: panelRect.left + 16, y: panelRect.top + 16 },
            { x: panelRect.right - 16, y: panelRect.top + 16 },
            { x: panelRect.left + 16, y: panelRect.bottom - 16 },
            { x: panelRect.right - 16, y: panelRect.bottom - 16 },
        ];
        const outsideContent = candidates.find((point) => !contentRect || (
            point.x < contentRect.left
            || point.x > contentRect.right
            || point.y < contentRect.top
            || point.y > contentRect.bottom
        ));
        return outsideContent ?? { x: panelRect.left + 8, y: panelRect.top + 8 };
    });
    await page.mouse.click(blankPoint.x, blankPoint.y);
    await expect(discoveryPanel).toBeHidden();
};

const createOmenHauntRollCore = (omen: { id: string; name: string; kind: 'omen' }) => {
    const core = createStartedFirstScenarioCore(['0', '1', '2', '3']);
    core.drawOrder = ['omen'];
    core.possessionOrderByKind.omen = [
        omen,
    ];
    core.currentExplorer = {
        ...core.currentExplorer,
        roomId: 'hallway',
        inventory: [],
    };
    core.activeRoomId = 'hallway';
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = [];
    return core;
};

const createHolySymbolHauntRollCore = () => createOmenHauntRollCore({ id: 'holy-symbol', name: '圣符', kind: 'omen' });
const createBookHauntRollCore = () => createOmenHauntRollCore({ id: 'omen-book', name: '书本', kind: 'omen' });

const countTeamOmensAfterDiscovery = (core: ReturnType<typeof createOmenHauntRollCore>) => (
    1 + [core.currentExplorer, ...core.otherExplorers]
        .reduce((count, explorer) => count + explorer.inventory.filter((card) => card.kind === 'omen').length, 0)
);

test.describe('山屋惊魂圣符作祟判定完整链路', () => {
    test('预兆圣符从探索翻出到作祟检定和关闭回牌桌', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-holy-symbol-haunt-roll-full-chain');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        const core = createHolySymbolHauntRollCore();
        const expectedDiceCount = countTeamOmensAfterDiscovery(core);

        await injectCore(page, core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-action-explore')).toBeEnabled();
        await expect(page.getByTestId('betrayal-room-ground-north')).toHaveAccessibleName(/未探索.*一层.*可探索/);
        await saveScreenshot(page, BEFORE_EXPLORE_SCREENSHOT);

        await page.getByTestId('betrayal-action-explore').click();
        await expect(page.getByTestId('betrayal-room-explore-target-ground-north')).toBeVisible();
        await expect(page.getByTestId('betrayal-room-explore-target-ground-south')).toBeVisible();
        await saveScreenshot(page, TARGET_SELECTION_SCREENSHOT);

        await setHarnessRandomQueue(page, Array.from({ length: expectedDiceCount }, () => 0.6));
        await page.getByTestId('betrayal-room-ground-north').click();

        const discoveryPanel = page.getByTestId('betrayal-discovery-panel');
        await expect(discoveryPanel).toHaveAttribute('aria-label', /预兆牌 圣符/);
        await expect(page.getByTestId('betrayal-discovery-card-front-atlas')).toHaveAttribute('data-atlas-frame-index', '4');
        await expect(page.getByTestId('betrayal-discovery-detail')).toContainText('作祟检定');
        await saveScreenshot(page, OMEN_REVEALED_SCREENSHOT);

        const rollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(rollPanel).toBeVisible();
        await expect(rollPanel).toHaveAttribute('data-roll-panel-style', 'open-table-transparent');
        await expect(rollPanel).toContainText('圣符');
        await expect(rollPanel).toContainText('作祟检定');
        await expect(page.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-count', String(expectedDiceCount));
        await expect(page.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-rule-subtotal', String(expectedDiceCount));
        await expectVisiblePhysicalDiceBox(rollPanel);
        await waitForPhysicalDiceSettled(rollPanel);
        await saveScreenshot(page, HAUNT_ROLL_DICE_SCREENSHOT);

        await expect(page.getByTestId('betrayal-discovery-detail')).toContainText(`作祟检定 ${expectedDiceCount}`);
        await expect(rollPanel).toContainText('未触发作祟');
        await expect(page.getByTestId('betrayal-event-choice-panel')).toHaveCount(0);
        await saveScreenshot(page, HAUNT_ROLL_RESULT_SCREENSHOT);

        await dismissDiscoveryPanel(page);
        await expect(page.getByTestId('betrayal-board')).toBeVisible();
        await expect(page.getByTestId('betrayal-discovery-panel')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-event-choice-panel')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-room-ground-north')).toBeVisible();
        await saveScreenshot(page, DISMISSED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-holy-symbol-haunt-roll-full-chain', diagnostics }]);
    });

    test('非圣符预兆书本从探索翻出到作祟检定和关闭回牌桌', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-book-omen-haunt-roll-sample-full-chain');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        const core = createBookHauntRollCore();
        const expectedDiceCount = countTeamOmensAfterDiscovery(core);

        await injectCore(page, core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-action-explore')).toBeEnabled();
        await expect(page.getByTestId('betrayal-room-ground-north')).toHaveAccessibleName(/未探索.*一层.*可探索/);
        await saveScreenshot(page, BOOK_BEFORE_EXPLORE_SCREENSHOT);

        await page.getByTestId('betrayal-action-explore').click();
        await expect(page.getByTestId('betrayal-room-explore-target-ground-north')).toBeVisible();
        await expect(page.getByTestId('betrayal-room-explore-target-ground-south')).toBeVisible();
        await saveScreenshot(page, BOOK_TARGET_SELECTION_SCREENSHOT);

        await setHarnessRandomQueue(page, Array.from({ length: expectedDiceCount }, () => 0.6));
        await page.getByTestId('betrayal-room-ground-north').click();

        const discoveryPanel = page.getByTestId('betrayal-discovery-panel');
        await expect(discoveryPanel).toHaveAttribute('aria-label', /预兆牌 书本/);
        await expect(page.getByTestId('betrayal-discovery-card-front-atlas')).toHaveAttribute('data-atlas-frame-index', '0');
        await expect(page.getByTestId('betrayal-discovery-detail')).toContainText('作祟检定');
        await saveScreenshot(page, BOOK_OMEN_REVEALED_SCREENSHOT);

        const rollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(rollPanel).toBeVisible();
        await expect(rollPanel).toHaveAttribute('data-roll-panel-style', 'open-table-transparent');
        await expect(rollPanel).toContainText('书本');
        await expect(rollPanel).toContainText('作祟检定');
        await expect(page.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-count', String(expectedDiceCount));
        await expect(page.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-rule-subtotal', String(expectedDiceCount));
        await expectVisiblePhysicalDiceBox(rollPanel);
        await waitForPhysicalDiceSettled(rollPanel);
        await saveScreenshot(page, BOOK_HAUNT_ROLL_DICE_SCREENSHOT);

        await expect(page.getByTestId('betrayal-discovery-detail')).toContainText(`作祟检定 ${expectedDiceCount}`);
        await expect(rollPanel).toContainText('未触发作祟');
        await expect(page.getByTestId('betrayal-event-choice-panel')).toHaveCount(0);
        await saveScreenshot(page, BOOK_HAUNT_ROLL_RESULT_SCREENSHOT);

        await dismissDiscoveryPanel(page);
        await expect(page.getByTestId('betrayal-board')).toBeVisible();
        await expect(page.getByTestId('betrayal-discovery-panel')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-event-choice-panel')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-room-ground-north')).toBeVisible();
        await saveScreenshot(page, BOOK_DISMISSED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-book-omen-haunt-roll-sample-full-chain', diagnostics }]);
    });
});
