import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import type { BetrayalCore, BetrayalInventoryCard } from '../../src/games/betrayal/game';
import {
    createRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-omen-atlas';
const RUNTIME_SCREENSHOT = `${EVIDENCE_DIR}/01-山屋惊魂-预兆图集-运行时对照.png`;
const PREVIEW_SCREENSHOT = `${EVIDENCE_DIR}/02-山屋惊魂-预兆图集-正面预览.png`;
const INVENTORY_SECTION_SCREENSHOT = `${EVIDENCE_DIR}/03-山屋惊魂-预兆图集-持有区局部.png`;

function createFullOmenAtlasCore(): BetrayalCore {
    const core = createRuntimeCore();
    const inventory: BetrayalInventoryCard[] = [
        { id: 'rope', name: '绳索', kind: 'item' },
        { id: 'omen-book', name: '预兆书', kind: 'omen' },
        { id: 'dog', name: '狗', kind: 'omen' },
        { id: 'mask', name: '面具', kind: 'omen' },
        { id: 'skull', name: '头骨', kind: 'omen' },
        { id: 'holy-symbol', name: '圣符', kind: 'omen' },
        { id: 'dagger', name: '匕首', kind: 'omen' },
        { id: 'ring', name: '指环', kind: 'omen' },
        { id: 'armor', name: '盔甲', kind: 'omen' },
        { id: 'idol', name: '雕像', kind: 'omen' },
    ];

    core.currentExplorer.inventory = inventory.map((card) => ({ ...card }));
    core.currentExplorerInventory = inventory.map((card) => ({ ...card }));
    core.usedCardIdsThisTurn = [];
    core.recommendedAction = 'use';

    return core;
}

test.describe('山屋惊魂预兆图集真相', () => {
    test('真实预兆牌会使用 candidate-06 真 atlas，而不是牌背或错图', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-omen-atlas');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createFullOmenAtlasCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });

        const omenCards = [
            { id: 'omen-book', name: '预兆书' },
            { id: 'dog', name: '狗' },
            { id: 'mask', name: '面具' },
            { id: 'skull', name: '头骨' },
            { id: 'holy-symbol', name: '圣符' },
            { id: 'dagger', name: '匕首' },
            { id: 'ring', name: '指环' },
            { id: 'armor', name: '盔甲' },
            { id: 'idol', name: '雕像' },
        ] as const;

        for (const omen of omenCards) {
            const omenCard = page.getByTestId(`betrayal-inventory-${omen.id}`);
            await expect(omenCard).toBeVisible();
            await expect(omenCard).toContainText(omen.name);
            await expect(omenCard).not.toContainText('缺正面');
            await expect(omenCard.locator('img').first()).toHaveAttribute('data-debug-current-src', /cards\/compressed\/omen-front-atlas\.webp/);
        }

        await saveScreenshot(page, RUNTIME_SCREENSHOT);
        await page.locator('#betrayal-inventory-section').screenshot({ path: INVENTORY_SECTION_SCREENSHOT });

        const dogOmen = page.getByTestId('betrayal-inventory-dog');
        await dogOmen.click();
        await expect(page.getByTestId('betrayal-inventory-preview-overlay')).toBeVisible();
        await expect(page.getByTestId('betrayal-inventory-preview-card')).toContainText('狗');
        await expect(page.getByTestId('betrayal-inventory-preview-card')).not.toContainText('缺正面');
        await expect(page.getByTestId('betrayal-inventory-preview-card').locator('img').first()).toHaveAttribute('data-debug-current-src', /cards\/compressed\/omen-front-atlas\.webp/);
        await saveScreenshot(page, PREVIEW_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-omen-atlas', diagnostics }]);
    });
});
