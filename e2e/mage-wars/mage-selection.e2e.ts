import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import {
    clearEvidenceScreenshotsForTest,
    getEvidenceScreenshotPath,
    withJpegEvidenceScreenshotOptions,
} from '../framework/evidenceScreenshots';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    initContext,
    waitForFrontendAssets,
} from '../helpers/common';

async function waitForVisibleImages(page: Page) {
    await page.waitForFunction(() => Array.from(document.images)
        .filter((image) => {
            const rect = image.getBoundingClientRect();
            return rect.width > 10 && rect.height > 10;
        })
        .every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0), undefined, {
        timeout: 30_000,
    });
}

async function saveEvidenceScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<string> {
    const path = getEvidenceScreenshotPath(testInfo, name, { requireChineseName: true });
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot(withJpegEvidenceScreenshotOptions({
        path,
        fullPage: false,
        animations: 'disabled',
        timeout: 20_000,
    }));
    testInfo.annotations.push({
        type: 'evidence-screenshot',
        description: path,
    });
    return path;
}

async function expectAtlasFrameAspectRatioPreserved(locator: Locator, label: string) {
    const metrics = await locator.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const rawExpected = element.getAttribute('data-card-atlas-aspect-ratio');
        const expected = rawExpected == null ? Number.NaN : Number(rawExpected);
        return {
            actual: rect.width / rect.height,
            expected,
            height: rect.height,
            width: rect.width,
        };
    });

    expect(metrics.width, `${label} 宽度必须可见`).toBeGreaterThan(20);
    expect(metrics.height, `${label} 高度必须可见`).toBeGreaterThan(20);
    expect(Number.isFinite(metrics.expected), `${label} 必须声明 atlas frame 原始比例`).toBe(true);
    expect(
        Math.abs(metrics.actual - metrics.expected),
        `${label} 素材比例失真：实际 ${metrics.actual.toFixed(4)}，原始 ${metrics.expected.toFixed(4)}，尺寸 ${metrics.width.toFixed(1)}x${metrics.height.toFixed(1)}`,
    ).toBeLessThan(0.015);
}

async function expectMageSelectionPreviewAspectRatios(page: Page) {
    for (const mageId of [
        'beastmaster_apprentice',
        'priestess_apprentice',
        'warlock_apprentice',
        'wizard_apprentice',
    ]) {
        await expectAtlasFrameAspectRatioPreserved(
            page.getByTestId(`mage-wars-mage-selection-card-${mageId}-preview`).locator('[data-card-atlas-frame="true"]'),
            `选角主卡 ${mageId}`,
        );
    }
}

async function expectNoRepeatedInvariantMageStats(page: Page) {
    const gate = page.getByTestId('mage-wars-mage-selection-gate');
    const visibleText = await gate.evaluate((element) => element.textContent ?? '');
    const forbiddenStatTexts = [
        /生命\s*[:：]?\s*24/u,
        /法力\s*[:：]?\s*10/u,
        /聚魔\s*[:：]?\s*10/u,
    ];

    for (const pattern of forbiddenStatTexts) {
        expect(
            pattern.test(visibleText),
            `选角页不能重复展示全员相同基础属性：${String(pattern)}`,
        ).toBe(false);
    }
}

test('Mage Wars 角色选择：双方选择法师后进入对应开局牌桌', async ({ context, page }, testInfo) => {
    await clearEvidenceScreenshotsForTest(testInfo);
    await initContext(context, {
        storageKey: 'mage-wars-mage-selection',
        skipImageGate: false,
        blockCdnAssets: false,
        locale: 'zh-CN',
    });
    const diagnostics = attachPageDiagnostics(page);

    await page.goto('/play/mage-wars?setupGate=true&seed=mage-selection-e2e&disableLocalAiAutomation=true', {
        waitUntil: 'domcontentloaded',
    });
    await waitForFrontendAssets(page, 45_000);
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});

    await expect(page.getByTestId('mage-wars-mage-selection-gate')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('heading', { name: '选择双方学徒法师' })).toBeVisible();
    await expect(page.getByTestId('mage-wars-mage-selection-card-beastmaster_apprentice')).toBeVisible();
    await expect(page.getByTestId('mage-wars-mage-selection-card-priestess_apprentice')).toBeVisible();
    await expect(page.getByTestId('mage-wars-mage-selection-card-warlock_apprentice')).toBeVisible();
    await expect(page.getByTestId('mage-wars-mage-selection-card-wizard_apprentice')).toBeVisible();
    await waitForVisibleImages(page);
    await expectMageSelectionPreviewAspectRatios(page);
    await expectNoRepeatedInvariantMageStats(page);
    const initialScreenshot = await saveEvidenceScreenshot(page, testInfo, '01-选角界面-四名法师和双方席位可见');

    await page.getByTestId('mage-wars-mage-selection-seat-0').click();
    await page.getByTestId('mage-wars-mage-selection-card-warlock_apprentice').click();
    await expect(page.getByTestId('mage-wars-mage-selection-summary-0')).toHaveAttribute('data-mage-id', 'warlock_apprentice');

    await page.getByTestId('mage-wars-mage-selection-seat-1').click();
    await page.getByTestId('mage-wars-mage-selection-card-wizard_apprentice').click();
    await expect(page.getByTestId('mage-wars-mage-selection-summary-1')).toHaveAttribute('data-mage-id', 'wizard_apprentice');
    await expect(page.getByTestId('mage-wars-mage-selection-summary-0')).toContainText('邪术师');
    await expect(page.getByTestId('mage-wars-mage-selection-summary-1')).toContainText('巫师');
    await expectMageSelectionPreviewAspectRatios(page);
    await expectNoRepeatedInvariantMageStats(page);
    await expectAtlasFrameAspectRatioPreserved(
        page.getByTestId('mage-wars-mage-selection-summary-0-preview').locator('[data-card-atlas-frame="true"]'),
        '选角摘要 P1 法师卡',
    );
    await expectAtlasFrameAspectRatioPreserved(
        page.getByTestId('mage-wars-mage-selection-summary-1-preview').locator('[data-card-atlas-frame="true"]'),
        '选角摘要 P2 法师卡',
    );
    const selectedScreenshot = await saveEvidenceScreenshot(page, testInfo, '02-选角界面-P1邪术师-P2巫师已选中');

    await page.getByTestId('mage-wars-mage-selection-confirm').click();

    await expect(page.getByTestId('mage-wars-board')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('mage-wars-mage-selection-gate')).toBeHidden({ timeout: 10_000 });
    await expect(page.locator('[data-testid="mage-wars-zone-mage-entity"][data-player-id="0"]'))
        .toHaveAttribute('data-mage-id', 'warlock_apprentice');
    await expect(page.locator('[data-testid="mage-wars-zone-mage-entity"][data-player-id="1"]'))
        .toHaveAttribute('data-mage-id', 'wizard_apprentice');
    await expect(page.getByTestId('mage-wars-board')).toContainText('邪术师');
    await expect(page.getByTestId('mage-wars-board')).toContainText('巫师');
    await waitForVisibleImages(page);
    await expectAtlasFrameAspectRatioPreserved(
        page.locator('[data-testid="mage-wars-zone-mage-entity"][data-player-id="0"] [data-card-atlas-frame="true"]'),
        '牌桌 P1 法师场上实体',
    );
    await expectAtlasFrameAspectRatioPreserved(
        page.locator('[data-testid="mage-wars-zone-mage-entity"][data-player-id="1"] [data-card-atlas-frame="true"]'),
        '牌桌 P2 法师场上实体',
    );
    const boardScreenshot = await saveEvidenceScreenshot(page, testInfo, '03-确认后牌桌-场上法师和HUD使用所选角色');

    await assertNoFatalFrontendErrors([{ label: 'mage-selection', diagnostics }]);
    testInfo.annotations.push({
        type: 'mage-wars-mage-selection-screenshots',
        description: JSON.stringify([initialScreenshot, selectedScreenshot, boardScreenshot]),
    });
});
