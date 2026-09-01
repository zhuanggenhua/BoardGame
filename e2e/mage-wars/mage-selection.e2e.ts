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
    waitForTestHarness,
} from '../helpers/common';
import { expectNoDuplicateUiOwners } from '../helpers/uiDuplicateOwners';

type MageWarsHarnessState = {
    sys: {
        phase?: string;
        [key: string]: unknown;
    };
    core: {
        playerOrder: string[];
        currentPlayerId: string;
        phaseActorId?: string;
        players: Record<string, {
            actionReady: boolean;
            quickcastReady: boolean;
            spellbookCount: number;
            spellbookEntries?: Array<{ spellCardId: number; count: number }>;
            preparedSpellSlots: number;
            preparedSpellCardIds: number[];
            [key: string]: unknown;
        }>;
        [key: string]: unknown;
    };
    [key: string]: unknown;
};

type MageWarsHarness = {
    state?: {
        get: () => MageWarsHarnessState | null;
        set: (state: MageWarsHarnessState) => Promise<void> | void;
    };
};

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

async function saveAnnotatedTargetScreenshot(
    page: Page,
    testInfo: TestInfo,
    name: string,
    target: Locator,
    label: string,
): Promise<string> {
    const markerId = `mage-wars-red-circle-${Date.now()}`;
    const rect = await target.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return {
            height: box.height,
            left: box.left,
            top: box.top,
            width: box.width,
        };
    });
    await page.evaluate(({ markerId, rect, label }) => {
        document.getElementById(markerId)?.remove();
        const marker = document.createElement('div');
        marker.id = markerId;
        marker.setAttribute('data-testid', 'mage-wars-evidence-red-circle');
        Object.assign(marker.style, {
            border: '4px solid #ff2d2d',
            borderRadius: '999px',
            boxShadow: '0 0 0 4px rgba(255,45,45,0.18), 0 0 24px rgba(255,45,45,0.55)',
            height: `${rect.height + 18}px`,
            left: `${rect.left - 9}px`,
            pointerEvents: 'none',
            position: 'fixed',
            top: `${rect.top - 9}px`,
            width: `${rect.width + 18}px`,
            zIndex: '2147483647',
        });
        const caption = document.createElement('div');
        caption.textContent = label;
        Object.assign(caption.style, {
            background: '#ff2d2d',
            border: '2px solid rgba(255,255,255,0.88)',
            borderRadius: '999px',
            color: '#fff',
            font: '700 16px/1.1 sans-serif',
            left: '50%',
            padding: '6px 12px',
            position: 'absolute',
            top: 'calc(100% + 8px)',
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
        });
        marker.appendChild(caption);
        document.body.appendChild(marker);
    }, { markerId, rect, label });

    try {
        return await saveEvidenceScreenshot(page, testInfo, name);
    } finally {
        await page.evaluate((id) => document.getElementById(id)?.remove(), markerId);
    }
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
            page.getByTestId(`mage-wars-mage-selection-standard-spellbook-${mageId}-preview`).locator('[data-card-atlas-frame="true"]'),
            `选书标准法术书 ${mageId}`,
        );
    }
}

async function expectSpellbookBuilderCardPoolReadable(builder: Locator) {
    const grid = builder.getByTestId('mage-wars-spellbook-builder-card-pool-grid');
    await expect(grid).toHaveAttribute('data-min-card-width-rem', '10.5');
    const metrics = await builder
        .locator('[data-testid="mage-wars-spellbook-builder-card"][data-source-card-id="2906"]')
        .evaluate((element) => {
            const cardRect = element.getBoundingClientRect();
            const art = element.querySelector('[data-card-atlas-frame="true"], img[data-card-fallback]');
            const artRect = art?.getBoundingClientRect();
            return {
                artHeight: artRect?.height ?? 0,
                artWidth: artRect?.width ?? 0,
                cardHeight: cardRect.height,
                cardWidth: cardRect.width,
            };
        });
    expect(metrics.cardWidth, `组书卡池普通法术卡太窄：${metrics.cardWidth.toFixed(1)}px`).toBeGreaterThanOrEqual(160);
    expect(metrics.artWidth, `组书卡池普通法术牌面太窄：${metrics.artWidth.toFixed(1)}px`).toBeGreaterThanOrEqual(150);
    expect(metrics.artHeight, `组书卡池普通法术牌面太矮：${metrics.artHeight.toFixed(1)}px`).toBeGreaterThanOrEqual(205);
}

async function readMageWarsState(page: Page): Promise<MageWarsHarnessState | null> {
    await waitForTestHarness(page, 10_000);
    return page.evaluate(() => (window as Window & {
        __BG_TEST_HARNESS__?: MageWarsHarness;
    }).__BG_TEST_HARNESS__?.state?.get?.() ?? null);
}

async function applyMageWarsPlanningState(page: Page) {
    await waitForTestHarness(page, 10_000);
    await page.evaluate(() => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: MageWarsHarness;
        }).__BG_TEST_HARNESS__;
        const snapshot = harness?.state?.get?.();
        if (!snapshot || !harness?.state?.set) {
            throw new Error('mage-wars planning state injector unavailable');
        }

        const next = structuredClone(snapshot);
        const [selfId] = next.core.playerOrder;
        if (!selfId) {
            throw new Error('mage-wars planning state requires a self player');
        }

        next.sys = {
            ...next.sys,
            phase: 'planning',
        };
        next.core = {
            ...next.core,
            currentPlayerId: selfId,
            phaseActorId: selfId,
            players: {
                ...next.core.players,
                [selfId]: {
                    ...next.core.players[selfId],
                    actionReady: true,
                    quickcastReady: true,
                    preparedSpellSlots: 0,
                    preparedSpellCardIds: [],
                },
            },
        };

        return harness.state.set(next);
    });

    await page.waitForFunction(() => {
        const state = (window as Window & {
            __BG_TEST_HARNESS__?: MageWarsHarness;
        }).__BG_TEST_HARNESS__?.state?.get?.();
        const [selfId] = state?.core?.playerOrder ?? [];
        const self = selfId ? state?.core?.players?.[selfId] : null;
        return state?.sys?.phase === 'planning'
            && state?.core?.currentPlayerId === selfId
            && state?.core?.phaseActorId === selfId
            && self?.preparedSpellCardIds?.length === 0;
    }, undefined, { timeout: 10_000 });
    await expect(page.getByTestId('mage-wars-board')).toHaveAttribute('data-mage-wars-phase', 'planning');
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
            `选书页不能重复展示全员相同基础属性：${String(pattern)}`,
        ).toBe(false);
    }
}

test('Mage Wars 法术书选择：双方直接选择法术书后进入对应开局牌桌', async ({ context, page }, testInfo) => {
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
    await expect(page.getByRole('heading', { name: '选择双方法术书' })).toBeVisible();
    await expect(page.getByTestId('mage-wars-mage-selection-spellbook-library')).toBeVisible();
    await expect(page.getByTestId('mage-wars-mage-selection-standard-spellbook')).toHaveCount(4);
    await expect(page.getByTestId('mage-wars-mage-selection-card-beastmaster_apprentice')).toHaveCount(0);
    await expect(page.getByTestId('mage-wars-mage-selection-card-priestess_apprentice')).toHaveCount(0);
    await expect(page.getByTestId('mage-wars-mage-selection-card-warlock_apprentice')).toHaveCount(0);
    await expect(page.getByTestId('mage-wars-mage-selection-card-wizard_apprentice')).toHaveCount(0);
    await expect(page.getByTestId('mage-wars-mage-selection-new-spellbook-entry')).toBeVisible();
    await expect(page.getByTestId('mage-wars-mage-selection-new-spellbook-entry')).toHaveAttribute('data-saved-spellbook-limit', '10');
    await expect(page.getByTestId('mage-wars-mage-selection-standard-spellbook-beastmaster_apprentice')).toContainText('标准起始书');
    await expect(page.getByTestId('mage-wars-mage-selection-standard-spellbook-priestess_apprentice')).toContainText('标准起始书');
    await expect(page.getByTestId('mage-wars-mage-selection-standard-spellbook-warlock_apprentice')).toContainText('标准起始书');
    await expect(page.getByTestId('mage-wars-mage-selection-standard-spellbook-wizard_apprentice')).toContainText('标准起始书');
    await expect(page.locator('[data-testid^="mage-wars-mage-selection-edit-standard-spellbook-"]')).toHaveCount(0);
    const initialSelectionText = await page.getByTestId('mage-wars-mage-selection-gate')
        .evaluate((element) => element.textContent ?? '');
    expect(initialSelectionText).not.toMatch(/编辑并另存|Edit and save copy|点击使用|Click to use|已使用|In use/u);
    await expectNoDuplicateUiOwners(
        page.getByTestId('mage-wars-mage-selection-gate'),
        testInfo,
        'selection-library',
        'temp/mage-wars-spellbook-selection-default-dom.html',
    );
    await waitForVisibleImages(page);
    await expectMageSelectionPreviewAspectRatios(page);
    await expectNoRepeatedInvariantMageStats(page);
    const initialScreenshot = await saveEvidenceScreenshot(page, testInfo, '01-选书界面-四本标准书和双方选择目标可见');

    await page.getByTestId('mage-wars-mage-selection-seat-0').click();
    await page.getByTestId('mage-wars-mage-selection-standard-spellbook-warlock_apprentice').click();
    await expect(page.getByTestId('mage-wars-mage-selection-summary-0')).toHaveAttribute('data-mage-id', 'warlock_apprentice');

    await page.getByTestId('mage-wars-mage-selection-seat-1').click();
    await page.getByTestId('mage-wars-mage-selection-standard-spellbook-wizard_apprentice').click();
    await expect(page.getByTestId('mage-wars-mage-selection-summary-1')).toHaveAttribute('data-mage-id', 'wizard_apprentice');
    await expect(page.getByTestId('mage-wars-mage-selection-summary-0')).toContainText('邪术师');
    await expect(page.getByTestId('mage-wars-mage-selection-summary-1')).toContainText('巫师');
    await expectMageSelectionPreviewAspectRatios(page);
    await expectNoRepeatedInvariantMageStats(page);
    await expectAtlasFrameAspectRatioPreserved(
        page.getByTestId('mage-wars-mage-selection-summary-0-preview').locator('[data-card-atlas-frame="true"]'),
        '选书摘要 P1 绑定法师卡',
    );
    await expectAtlasFrameAspectRatioPreserved(
        page.getByTestId('mage-wars-mage-selection-summary-1-preview').locator('[data-card-atlas-frame="true"]'),
        '选书摘要 P2 绑定法师卡',
    );
    const selectedScreenshot = await saveEvidenceScreenshot(page, testInfo, '02-选书界面-P1邪术师书-P2巫师书已选中');

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
    const boardScreenshot = await saveEvidenceScreenshot(page, testInfo, '03-确认后牌桌-场上法师使用所选法术书绑定');

    await assertNoFatalFrontendErrors([{ label: 'mage-selection', diagnostics }]);
    testInfo.annotations.push({
        type: 'mage-wars-spellbook-selection-screenshots',
        description: JSON.stringify([initialScreenshot, selectedScreenshot, boardScreenshot]),
    });
});

test('Mage Wars 组书编辑器：从选中标准书保存命名副本、使用、编辑、删除，再进入计划代表态', async ({ context, page }, testInfo) => {
    testInfo.setTimeout(180_000);
    await clearEvidenceScreenshotsForTest(testInfo);
    await initContext(context, {
        storageKey: 'mage-wars-spellbook-builder',
        skipImageGate: false,
        blockCdnAssets: false,
        locale: 'zh-CN',
    });
    const diagnostics = attachPageDiagnostics(page);

    await page.goto('/play/mage-wars?setupGate=true&seed=mage-spellbook-builder-e2e&disableLocalAiAutomation=true', {
        waitUntil: 'domcontentloaded',
    });
    await waitForFrontendAssets(page, 45_000);
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});

    await expect(page.getByTestId('mage-wars-mage-selection-gate')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('mage-wars-mage-selection-seat-0').click();
    await page.getByTestId('mage-wars-mage-selection-standard-spellbook-beastmaster_apprentice').click();
    await expect(page.getByTestId('mage-wars-mage-selection-summary-0')).toHaveAttribute('data-mage-id', 'beastmaster_apprentice');
    await expect(page.getByTestId('mage-wars-mage-selection-summary-0')).toContainText('兽王');
    await waitForVisibleImages(page);
    const selectedSpellbookScreenshot = await saveEvidenceScreenshot(page, testInfo, '01-直接选法术书-兽王标准书绑定构筑对象');

    await expect(page.getByTestId('mage-wars-mage-selection-new-spellbook-entry')).toBeVisible();
    await expect(page.getByTestId('mage-wars-mage-selection-new-spellbook-entry')).toHaveAttribute('data-saved-spellbook-limit', '10');
    await page.getByTestId('mage-wars-mage-selection-new-spellbook-entry').click();

    const magePicker = page.getByTestId('mage-wars-new-spellbook-mage-picker');
    await expect(magePicker).toBeVisible({ timeout: 10_000 });
    await expect(magePicker).toContainText('选择新书绑定法师');
    await expect(page.locator('[data-testid^="mage-wars-new-spellbook-mage-option-"]')).toHaveCount(4);
    for (const mageId of [
        'beastmaster_apprentice',
        'priestess_apprentice',
        'warlock_apprentice',
        'wizard_apprentice',
    ]) {
        await expectAtlasFrameAspectRatioPreserved(
            page.getByTestId(`mage-wars-new-spellbook-mage-option-${mageId}`).locator('[data-card-atlas-frame="true"]'),
            `新建法术书绑定法师候选 ${mageId}`,
        );
    }
    const newSpellbookMagePickerScreenshot = await saveEvidenceScreenshot(page, testInfo, '02-新建法术书-先选择绑定法师');
    await page.getByTestId('mage-wars-new-spellbook-mage-option-beastmaster_apprentice').click();

    const builder = page.getByTestId('mage-wars-spellbook-builder');
    await expect(builder).toBeVisible({ timeout: 10_000 });
    await expect(builder).toHaveAttribute('data-mage-id', 'beastmaster_apprentice');
    await expect(builder).toHaveAttribute('data-saved-spellbook-limit', '10');
    await expect(builder.getByTestId('mage-wars-spellbook-builder-mage-context')).toBeVisible();
    await expect(builder.locator('[data-testid^="mage-wars-spellbook-builder-mage-option-"]')).toHaveCount(0);
    await expect(builder.getByTestId('mage-wars-spellbook-builder-saved-library')).toBeVisible();
    await expect(builder.getByTestId('mage-wars-spellbook-builder-filter-type')).toBeVisible();
    await expect(builder.getByTestId('mage-wars-spellbook-builder-filter-school')).toBeVisible();
    await expect(builder.getByTestId('mage-wars-spellbook-builder-filter-level')).toBeVisible();
    await expect(builder.getByTestId('mage-wars-spellbook-builder-filter-mana')).toBeVisible();
    await expect(builder.getByTestId('mage-wars-spellbook-builder-filter-legality')).toBeVisible();

    const builderVisibleText = await builder.evaluate((element) => element.textContent ?? '');
    expect(builderVisibleText).not.toMatch(/席位|\bP1\b|\bP2\b|xN|兽王标准书|当前法师：|当前法术书|当前法师法术书库|编辑当前书|更新当前副本|给当前书取名|新书从当前书|当前书内|详情|缺图|DIY 法术书|空白自组|还没有 DIY/u);
    expect(builderVisibleText).not.toMatch(/标准起始书和命名副本同级|真实缩略、数量上限|滚动查看整本书|数量：1级|成本：受训/u);
    expect(builderVisibleText).not.toMatch(/全部卡牌/u);
    expect(builderVisibleText).not.toMatch(/点击查看能力牌/u);
    expect(Array.from(builderVisibleText.matchAll(/法术点/g))).toHaveLength(1);
    expect(Array.from(builderVisibleText.matchAll(/120\s*\/\s*120/g))).toHaveLength(1);
    await expect(builder.getByTestId('mage-wars-spellbook-builder-scope-filters')).toHaveCount(0);
    const typeOptions = await builder.getByTestId('mage-wars-spellbook-builder-filter-type').locator('option').evaluateAll((options) => (
        options.map((option) => option.textContent ?? '')
    ));
    expect(typeOptions).toEqual(expect.arrayContaining(['类型：全部', '攻击', '结界', '生物', '魔物', '咒语', '装备', '墙体']));
    const manaOptions = await builder.getByTestId('mage-wars-spellbook-builder-filter-mana').locator('option').evaluateAll((options) => (
        options.map((option) => option.textContent ?? '')
    ));
    expect(manaOptions).toEqual(expect.arrayContaining(['法力：全部', '法力：0-2', '法力：3-5', '法力：6-8', '法力：9+', '法力：X']));
    const schoolOptions = await builder.getByTestId('mage-wars-spellbook-builder-filter-school').locator('option').evaluateAll((options) => (
        options.map((option) => option.textContent ?? '')
    ));
    expect(schoolOptions).toEqual(expect.arrayContaining(['自然', '火焰', '圣光', '黑暗']));
    expect(schoolOptions).not.toEqual(expect.arrayContaining(['蝙蝠', '手套', '靴子', '传送门', '胸甲']));
    await expect(builder.getByTestId('mage-wars-spellbook-builder-deck-row')).toHaveCount(50);
    await expect(builder.getByTestId('mage-wars-spellbook-builder-saved-list')).toHaveCount(0);
    await expect(builder.getByTestId('mage-wars-spellbook-builder-new-spellbook')).toBeVisible();
    await builder.getByTestId('mage-wars-spellbook-builder-saved-library-toggle').click();
    await expect(builder.getByTestId('mage-wars-spellbook-builder-saved-list')).toContainText('标准起始书');
    await expect(builder.getByTestId('mage-wars-spellbook-builder-saved-list')).not.toContainText('暂无命名副本');
    await expect(builder.getByTestId('mage-wars-spellbook-builder-standard')).toHaveAttribute('data-active', 'false');
    await expect(builder.getByTestId('mage-wars-spellbook-builder-new-spellbook-entry')).toHaveAttribute('data-active', 'true');
    await expect(builder.getByTestId('mage-wars-spellbook-builder-new-spellbook-entry')).toHaveAttribute('data-saved-spellbook-limit', '10');
    await builder.getByTestId('mage-wars-spellbook-builder-saved-library-toggle').click();
    await expect(builder.getByTestId('mage-wars-spellbook-builder-blank')).toHaveCount(0);
    await expectAtlasFrameAspectRatioPreserved(
        builder.locator('[data-testid="mage-wars-spellbook-builder-card"][data-source-card-id="2906"] [data-card-atlas-frame="true"]'),
        '组书卡池野性山猫牌面',
    );
    await expectSpellbookBuilderCardPoolReadable(builder);
    await expectNoDuplicateUiOwners(
        builder,
        testInfo,
        'deck-builder',
        'temp/mage-wars-spellbook-builder-default-dom.html',
    );
    const builderDefaultScreenshot = await saveAnnotatedTargetScreenshot(
        page,
        testInfo,
        '03-进入组书-红圈标出法师详情入口',
        builder.getByTestId('mage-wars-spellbook-builder-mage-context'),
        '点这里看法师能力牌',
    );
    await builder.getByTestId('mage-wars-spellbook-builder-filter-type').selectOption('墙体');
    const wallFilterScreenshot = await saveEvidenceScreenshot(page, testInfo, '04-类型筛选墙体-横向墙牌保真');
    await expectAtlasFrameAspectRatioPreserved(
        builder.locator('[data-testid="mage-wars-spellbook-builder-card"][data-source-card-id="25700"] [data-card-atlas-frame="true"]'),
        '组书卡池荆棘之墙横向牌面',
    );
    const wallCardBox = await builder
        .locator('[data-testid="mage-wars-spellbook-builder-card"][data-source-card-id="25700"]')
        .evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return { width: rect.width, height: rect.height };
    });
    expect(wallCardBox.width / wallCardBox.height, '墙体牌在组书页必须按横向比例显示').toBeGreaterThan(1);

    await builder.getByTestId('mage-wars-spellbook-builder-filter-type').selectOption('all');
    await builder.getByTestId('mage-wars-spellbook-builder-mage-context').click();
    const mageDetail = builder.getByTestId('mage-wars-spellbook-builder-mage-detail');
    await expect(mageDetail).toBeVisible();
    await expect(mageDetail.locator('[data-card-atlas-frame="true"]')).toBeVisible();
    await expect(mageDetail).toContainText('受训方向');
    await expect(mageDetail).toContainText('相斥方向');
    const mageDetailScreenshot = await saveEvidenceScreenshot(page, testInfo, '05-法师详情-点击已选法师主控打开');
    await builder.getByTestId('mage-wars-spellbook-builder-mage-detail-close').click();

    await builder.getByTestId('mage-wars-spellbook-builder-save-name').fill('兽王标准命名书');
    await builder.getByTestId('mage-wars-spellbook-builder-save-new').click();
    await expect(builder.getByTestId('mage-wars-spellbook-builder-save-status')).toContainText('已保存 兽王标准命名书');
    await builder.getByTestId('mage-wars-spellbook-builder-saved-library-toggle').click();
    await expect(builder.getByTestId('mage-wars-spellbook-builder-saved-spellbook')).toContainText('兽王标准命名书');
    await expect(builder.getByTestId('mage-wars-spellbook-builder-saved-spellbook-diy-badge')).toHaveText('DIY');
    await expectNoDuplicateUiOwners(
        builder,
        testInfo,
        'deck-builder',
        'temp/mage-wars-spellbook-builder-with-saved-dom.html',
    );
    await expect.poll(async () => page.evaluate(() => {
        const raw = localStorage.getItem('mage-wars:saved-spellbooks:v1');
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Array<{
            mageId?: string;
            name?: string;
            entries?: Array<{ spellCardId: number; count: number }>;
        }>;
        return parsed.map((spellbook) => ({
            mageId: spellbook.mageId,
            name: spellbook.name,
            entryCount: spellbook.entries?.length ?? 0,
            cardCount: spellbook.entries?.reduce((total, entry) => total + entry.count, 0) ?? 0,
            lynxCount: spellbook.entries?.find((entry) => entry.spellCardId === 2906)?.count ?? 0,
            tanglevineCount: spellbook.entries?.find((entry) => entry.spellCardId === 2224)?.count ?? 0,
        }));
    })).toEqual([{
        mageId: 'beastmaster_apprentice',
        name: '兽王标准命名书',
        entryCount: 50,
        cardCount: 67,
        lynxCount: 2,
        tanglevineCount: 3,
    }]);
    const originalSavedId = await page.evaluate(() => {
        const raw = localStorage.getItem('mage-wars:saved-spellbooks:v1');
        if (!raw) return null;
        const [first] = JSON.parse(raw) as Array<{ id?: string }>;
        return first?.id ?? null;
    });
    if (!originalSavedId) {
        throw new Error('保存新法术书后没有写入可复用 id');
    }
    const savedSpellbookScreenshot = await saveEvidenceScreenshot(page, testInfo, '06-保存命名副本-标准起始书完整进入同库');

    await builder.getByTestId('mage-wars-spellbook-builder-confirm').click();
    await expect(page.getByTestId('mage-wars-spellbook-builder')).toHaveCount(0);
    const selectionSavedList = page.getByTestId('mage-wars-mage-selection-saved-spellbook-list');
    await expect(selectionSavedList).toContainText('标准起始书');
    await expect(selectionSavedList).toContainText('兽王标准命名书');
    await expect(selectionSavedList.getByTestId('mage-wars-mage-selection-saved-spellbook-diy-badge')).toHaveText('DIY');
    await expect(page.getByTestId('mage-wars-mage-selection-summary-0')).toContainText('法术书 67 张');
    await expect(page.getByTestId('mage-wars-mage-selection-summary-0')).toHaveAttribute(
        'data-saved-spellbook-id',
        originalSavedId,
    );
    await expectNoDuplicateUiOwners(
        page.getByTestId('mage-wars-mage-selection-gate'),
        testInfo,
        'selection-library',
        'temp/mage-wars-spellbook-selection-with-saved-dom.html',
    );
    const selectionLibraryScreenshot = await saveEvidenceScreenshot(page, testInfo, '07-回到选书页-标准书和命名副本同库可见');

    await page.getByTestId('mage-wars-mage-selection-standard-spellbook-priestess_apprentice').click();
    await page.getByTestId('mage-wars-mage-selection-standard-spellbook-beastmaster_apprentice').click();
    await expect(page.getByTestId('mage-wars-mage-selection-summary-0')).toHaveAttribute('data-saved-spellbook-id', '');
    await expect(page.locator('[data-testid="mage-wars-mage-selection-standard-spellbook"][data-mage-id="beastmaster_apprentice"]')).toHaveAttribute('data-active', 'true');
    const savedSpellbookCard = selectionSavedList
        .getByTestId('mage-wars-mage-selection-saved-spellbook')
        .filter({ hasText: '兽王标准命名书' });
    await savedSpellbookCard.getByTestId('mage-wars-mage-selection-use-saved-spellbook').click();
    await expect(page.getByTestId('mage-wars-mage-selection-summary-0')).toContainText('法术书 67 张');
    await expect(page.getByTestId('mage-wars-mage-selection-summary-0')).toHaveAttribute(
        'data-saved-spellbook-id',
        originalSavedId,
    );
    const directUseScreenshot = await saveEvidenceScreenshot(page, testInfo, '08-选书页直接使用-命名副本绑定P1');

    await savedSpellbookCard.getByTestId('mage-wars-mage-selection-edit-saved-spellbook').click();
    await expect(builder).toBeVisible({ timeout: 10_000 });
    await expect(builder.getByTestId('mage-wars-spellbook-builder-save-name')).toHaveValue('兽王标准命名书');
    await expect(builder.getByTestId('mage-wars-spellbook-builder-deck-row')).toHaveCount(50);
    const tanglevineDeckRow = builder.locator('[data-testid="mage-wars-spellbook-builder-deck-row"][data-source-card-id="2224"]');
    await expect(tanglevineDeckRow).toContainText('3 / 6');
    await tanglevineDeckRow.getByTestId('mage-wars-spellbook-builder-remove-card').click();
    await expect(tanglevineDeckRow).toContainText('2 / 6');
    await builder.getByTestId('mage-wars-spellbook-builder-save-name').fill('兽王命名更新书');
    await builder.getByTestId('mage-wars-spellbook-builder-update-saved').click();
    await expect(builder.getByTestId('mage-wars-spellbook-builder-save-status')).toContainText('已更新 兽王命名更新书');
    await expect.poll(async () => page.evaluate(() => {
        const raw = localStorage.getItem('mage-wars:saved-spellbooks:v1');
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Array<{
            id?: string;
            mageId?: string;
            name?: string;
            entries?: Array<{ spellCardId: number; count: number }>;
        }>;
        return parsed.map((spellbook) => ({
            id: spellbook.id,
            mageId: spellbook.mageId,
            name: spellbook.name,
            entryCount: spellbook.entries?.length ?? 0,
            cardCount: spellbook.entries?.reduce((total, entry) => total + entry.count, 0) ?? 0,
            lynxCount: spellbook.entries?.find((entry) => entry.spellCardId === 2906)?.count ?? 0,
            tanglevineCount: spellbook.entries?.find((entry) => entry.spellCardId === 2224)?.count ?? 0,
        }));
    })).toEqual([{
        id: originalSavedId,
        mageId: 'beastmaster_apprentice',
        name: '兽王命名更新书',
        entryCount: 50,
        cardCount: 66,
        lynxCount: 2,
        tanglevineCount: 2,
    }]);
    const updatedSpellbookScreenshot = await saveEvidenceScreenshot(page, testInfo, '09-编辑已有命名副本-更新名称和数量');

    await builder.getByTestId('mage-wars-spellbook-builder-save-name').fill('待删除法术书');
    await builder.getByTestId('mage-wars-spellbook-builder-save-new').click();
    await expect(builder.getByTestId('mage-wars-spellbook-builder-save-status')).toContainText('已保存 待删除法术书');
    const disposableSavedId = await page.evaluate(() => {
        const raw = localStorage.getItem('mage-wars:saved-spellbooks:v1');
        if (!raw) return null;
        const match = (JSON.parse(raw) as Array<{ id?: string; name?: string }>)
            .find((spellbook) => spellbook.name === '待删除法术书');
        return match?.id ?? null;
    });
    if (!disposableSavedId) {
        throw new Error('用于删除验证的法术书没有保存成功');
    }
    await builder.getByTestId('mage-wars-spellbook-builder-confirm').click();
    await expect(page.getByTestId('mage-wars-spellbook-builder')).toHaveCount(0);
    await expect(selectionSavedList).toContainText('兽王命名更新书');
    await expect(selectionSavedList).toContainText('待删除法术书');
    const disposableSpellbookCard = selectionSavedList
        .getByTestId('mage-wars-mage-selection-saved-spellbook')
        .filter({ hasText: '待删除法术书' });
    await disposableSpellbookCard.getByTestId('mage-wars-mage-selection-delete-saved-spellbook').click();
    await expect(disposableSpellbookCard).toHaveCount(0);
    await expect(selectionSavedList).toContainText('兽王命名更新书');
    await expect.poll(async () => page.evaluate(() => {
        const raw = localStorage.getItem('mage-wars:saved-spellbooks:v1');
        if (!raw) return [];
        return (JSON.parse(raw) as Array<{ name?: string }>).map((spellbook) => spellbook.name);
    })).toEqual(['兽王命名更新书']);
    const deleteSpellbookScreenshot = await saveEvidenceScreenshot(page, testInfo, '10-选书页删除-法术书库只保留一个命名副本');

    const updatedSavedSpellbookCard = selectionSavedList
        .getByTestId('mage-wars-mage-selection-saved-spellbook')
        .filter({ hasText: '兽王命名更新书' });
    await updatedSavedSpellbookCard.getByTestId('mage-wars-mage-selection-use-saved-spellbook').click();
    await expect(page.getByTestId('mage-wars-mage-selection-summary-0')).toContainText('法术书 66 张');
    await expect(page.getByTestId('mage-wars-mage-selection-summary-0')).toHaveAttribute(
        'data-saved-spellbook-id',
        originalSavedId,
    );
    await page.getByTestId('mage-wars-mage-selection-confirm').click();

    await expect(page.getByTestId('mage-wars-board')).toBeVisible({ timeout: 60_000 });
    const setupState = await readMageWarsState(page);
    const [selfId] = setupState?.core.playerOrder ?? [];
    expect(selfId).toBeTruthy();
    const submittedSpellbookEntries = setupState?.core.players[selfId!]?.spellbookEntries ?? [];
    expect(submittedSpellbookEntries).toHaveLength(50);
    expect(submittedSpellbookEntries.find((entry) => entry.spellCardId === 2906)?.count).toBe(2);
    expect(submittedSpellbookEntries.find((entry) => entry.spellCardId === 2224)?.count).toBe(2);
    expect(setupState?.core.players[selfId!]?.spellbookCount).toBe(66);

    await applyMageWarsPlanningState(page);
    await page.getByTestId('mage-wars-spellbook-category-creature').click();
    await expect(page.getByTestId('mage-wars-desktop-spellbook-card')).toHaveCount(6);
    const runtimeSpellbookCard = page.locator('[data-testid="mage-wars-desktop-spellbook-card"][data-source-card-id="2224"]').first();
    await expect(runtimeSpellbookCard).toBeVisible({ timeout: 10_000 });
    await expect(runtimeSpellbookCard).toHaveAttribute('data-copy-count', '2');
    await expect(runtimeSpellbookCard.getByTestId('mage-wars-spellbook-copy-count')).toHaveText('x2');
    await expectAtlasFrameAspectRatioPreserved(
        runtimeSpellbookCard.locator('[data-card-atlas-frame="true"]'),
        '牌桌法术书缠绕藤蔓牌面',
    );
    await runtimeSpellbookCard.click();
    await expect(runtimeSpellbookCard).toHaveAttribute('data-selected-count', '1');
    await runtimeSpellbookCard.click();
    await expect(runtimeSpellbookCard).toHaveAttribute('data-selected-count', '2');
    await expect(page.getByTestId('mage-wars-plan-spells')).toHaveText('确认计划 2/2');
    await expect(page.getByTestId('mage-wars-plan-spells')).toHaveAttribute('data-plan-progress', '2/2');
    await page.getByTestId('mage-wars-plan-spells').click();
    await expect.poll(async () => {
        const state = await readMageWarsState(page);
        const [playerId] = state?.core.playerOrder ?? [];
        return playerId ? state?.core.players[playerId]?.preparedSpellCardIds : null;
    }).toEqual([2224, 2224]);
    await expect(page.locator('[data-testid="mage-wars-desktop-prepared-card"][data-source-card-id="2224"]'))
        .toHaveCount(2);
    const runtimePlanningScreenshot = await saveEvidenceScreenshot(page, testInfo, '11-牌桌计划态-命名副本进入可计划牌列');

    await assertNoFatalFrontendErrors([{ label: 'mage-wars-spellbook-builder', diagnostics }]);
    testInfo.annotations.push({
        type: 'mage-wars-spellbook-builder-screenshots',
        description: JSON.stringify([
            selectedSpellbookScreenshot,
            newSpellbookMagePickerScreenshot,
            builderDefaultScreenshot,
            wallFilterScreenshot,
            mageDetailScreenshot,
            savedSpellbookScreenshot,
            selectionLibraryScreenshot,
            directUseScreenshot,
            updatedSpellbookScreenshot,
            deleteSpellbookScreenshot,
            runtimePlanningScreenshot,
        ]),
    });
});
