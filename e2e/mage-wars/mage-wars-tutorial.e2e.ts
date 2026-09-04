import { mkdir, readdir, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    disableNonFlowFabForE2e,
    initContext,
    waitForFrontendAssets,
    waitForTestHarness,
} from '../helpers/common';

const SCREENSHOT_DIR = 'test-results/evidence-screenshots/mage-wars/tutorial-flow-sync';
const INTRO_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/00-intro-board-and-win.png`;
const SELF_HUD_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/01-read-self-hud-life-mana-channeling.png`;
const OPPONENT_HUD_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/02-read-opponent-hud-hidden-plans.png`;
const STAGE_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/03-read-round-stage.png`;
const CHANNEL_RESULT_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/04-channel-result-mana-increased.png`;
const PLAN_OPEN_CREATURE_CATEGORY_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/05-plan-open-creature-category.png`;
const PLAN_CREATURE_NEXT_PAGE_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/06-plan-creature-next-page-wolf-hidden.png`;
const PLAN_SELECT_WOLF_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/07-plan-select-wolf-visible.png`;
const PLAN_OPEN_INCANTATION_CATEGORY_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/08-plan-wolf-in-slot-one-open-incantation-category.png`;
const PLAN_SELECT_ROUSE_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/09-plan-click-incantation-category-rouse-visible.png`;
const PLAN_CONFIRM_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/10-plan-rouse-in-slot-two-confirm.png`;
const PREPARED_HIDDEN_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/11-prepared-and-hidden.png`;
const DEPLOY_SELECT_WOLF_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/12-deploy-select-wolf-prepared-card.png`;
const DEPLOY_TARGET_ZONE_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/13-deploy-target-zone-highlight.png`;
const WOLF_SUMMONED_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/14-wolf-summoned-not-ready.png`;
const ROUSE_SELECT_SPELL_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/15-rouse-select-spell-prepared-card.png`;
const ROUSE_TARGET_WOLF_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/16-rouse-target-wolf-highlight.png`;
const PASS_DEPLOYMENT_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/17-pass-your-deployment-wolf-ready.png`;
const OPPONENT_PUBLIC_VIEW_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/18-opponent-public-view-toggle-highlight.png`;
const DISCARD_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/19-opponent-public-view-same-discard-pile.png`;
const BACK_TO_SELF_VIEW_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/20-back-to-self-view.png`;
const QUICKCAST_PASS_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/21-skip-initiative-quickcast.png`;
const MOVE_SELECT_WOLF_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/22-move-select-wolf.png`;
const MOVE_TARGET_ZONE_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/23-move-target-zone-a2.png`;
const FINISH_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/24-finish-wolf-moved-to-a2.png`;
const RESPONSIVE_PLAN_SCREENSHOT_DIR = 'test-results/evidence-screenshots/mage-wars/tutorial-plan-click-responsive';
const RESPONSIVE_PLAN_ONE_OF_TWO_SCREENSHOT_PATH = `${RESPONSIVE_PLAN_SCREENSHOT_DIR}/00-1366-plan-card-body-click-one-of-two.png`;
const RESPONSIVE_PLAN_SLOT_CANCEL_SCREENSHOT_PATH = `${RESPONSIVE_PLAN_SCREENSHOT_DIR}/01-1366-plan-slot-click-cancels-draft.png`;
const RESPONSIVE_PLAN_RESELECT_SCREENSHOT_PATH = `${RESPONSIVE_PLAN_SCREENSHOT_DIR}/02-1366-plan-card-reselect-after-slot-cancel.png`;

const TUTORIAL_FLOW_SCREENSHOT_PATHS = [
    INTRO_SCREENSHOT_PATH,
    SELF_HUD_SCREENSHOT_PATH,
    OPPONENT_HUD_SCREENSHOT_PATH,
    STAGE_SCREENSHOT_PATH,
    CHANNEL_RESULT_SCREENSHOT_PATH,
    PLAN_OPEN_CREATURE_CATEGORY_SCREENSHOT_PATH,
    PLAN_CREATURE_NEXT_PAGE_SCREENSHOT_PATH,
    PLAN_SELECT_WOLF_SCREENSHOT_PATH,
    PLAN_OPEN_INCANTATION_CATEGORY_SCREENSHOT_PATH,
    PLAN_SELECT_ROUSE_SCREENSHOT_PATH,
    PLAN_CONFIRM_SCREENSHOT_PATH,
    PREPARED_HIDDEN_SCREENSHOT_PATH,
    DEPLOY_SELECT_WOLF_SCREENSHOT_PATH,
    DEPLOY_TARGET_ZONE_SCREENSHOT_PATH,
    WOLF_SUMMONED_SCREENSHOT_PATH,
    ROUSE_SELECT_SPELL_SCREENSHOT_PATH,
    ROUSE_TARGET_WOLF_SCREENSHOT_PATH,
    PASS_DEPLOYMENT_SCREENSHOT_PATH,
    OPPONENT_PUBLIC_VIEW_SCREENSHOT_PATH,
    DISCARD_SCREENSHOT_PATH,
    BACK_TO_SELF_VIEW_SCREENSHOT_PATH,
    QUICKCAST_PASS_SCREENSHOT_PATH,
    MOVE_SELECT_WOLF_SCREENSHOT_PATH,
    MOVE_TARGET_ZONE_SCREENSHOT_PATH,
    FINISH_SCREENSHOT_PATH,
];

type MageWarsTutorialState = {
    sys?: {
        phase?: string;
        tutorial?: {
            active?: boolean;
            step?: {
                id?: string;
                aiActions?: unknown[];
            } | null;
            stepIndex?: number;
        };
    };
    core?: {
        phaseActorId?: string;
        objects?: Record<string, {
            sourceSpellCardId?: number;
            ownerId?: string;
            zoneId?: string;
            actionReady?: boolean;
            guarding?: boolean;
            damage?: number;
            statusTokens?: Record<string, number>;
        }>;
        players?: Record<string, {
            mana?: number;
            preparedSpellCardIds?: number[];
            discardSpellCardIds?: number[];
        }>;
    };
};

async function prepareMageWarsTutorialContext(context: BrowserContext, page: Page) {
    await initContext(context, {
        storageKey: 'mage-wars-tutorial',
        skipTutorial: false,
        locale: 'zh-CN',
        skipImageGate: false,
        blockCdnAssets: false,
    });
    return attachPageDiagnostics(page);
}

async function openMageWarsTutorial(context: BrowserContext, page: Page) {
    const diagnostics = await prepareMageWarsTutorialContext(context, page);

    await page.goto('/play/mage-wars/tutorial', { waitUntil: 'domcontentloaded' });
    await disableNonFlowFabForE2e(page, 'mage-wars');
    await waitForFrontendAssets(page, 45_000);
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await expect(page.locator('[data-game-page][data-game-id="mage-wars"]').first()).toBeVisible({ timeout: 60_000 });
    const board = page.getByTestId('mage-wars-board');
    const catalogEntry = page.getByTestId('tutorial-catalog-entry-mage-wars-basic');
    const entryPoint = await Promise.race([
        board.waitFor({ state: 'visible', timeout: 60_000 }).then(() => 'board' as const),
        catalogEntry.waitFor({ state: 'visible', timeout: 60_000 }).then(() => 'catalog' as const),
    ]);
    if (entryPoint === 'catalog' && !(await board.isVisible().catch(() => false))) {
        await catalogEntry.click();
    }
    await expect(board).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('tutorial-catalog-stage')).toHaveCount(0);
    await expect(page.getByTestId('tutorial-catalog-entry-mage-wars-basic')).toHaveCount(0);
    await waitForTestHarness(page, 20_000);
    await page.waitForFunction(() => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: { state?: { isRegistered?: () => boolean } };
        }).__BG_TEST_HARNESS__;
        return harness?.state?.isRegistered?.() === true;
    }, undefined, { timeout: 20_000 });

    return diagnostics;
}

async function readMageWarsState(page: Page): Promise<MageWarsTutorialState> {
    return page.evaluate(() => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: { state?: { get?: () => unknown } };
        }).__BG_TEST_HARNESS__;
        return (harness?.state?.get?.() ?? {}) as MageWarsTutorialState;
    });
}

async function waitForTutorialStep(page: Page, stepId: string, timeout = 30_000) {
    await expect(page.locator(`[data-tutorial-step="${stepId}"]`)).toBeVisible({ timeout });
    await expect.poll(async () => {
        const state = await readMageWarsState(page);
        return state.sys?.tutorial?.step?.id ?? null;
    }, { timeout }).toBe(stepId);
}

async function expectTutorialStepNotVisible(page: Page, stepId: string) {
    await expect(page.locator(`[data-tutorial-step="${stepId}"]`)).toHaveCount(0);
}

async function clickTutorialNext(page: Page) {
    const button = page.getByTestId('tutorial-next-button');
    await expect(button).toBeVisible({ timeout: 10_000 });
    await button.click({ timeout: 5_000 });
}


async function clickTutorialTarget(page: Page, tutorialId: string) {
    const target = page.locator(`[data-tutorial-id="${tutorialId}"]`).first();
    await expect(target).toBeVisible({ timeout: 15_000 });
    await expect(target).toBeEnabled({ timeout: 10_000 });
    await target.click({ timeout: 5_000 });
}

async function expectMagnifyOverlayHidden(page: Page) {
    await expect(page.getByTestId('mage-wars-card-magnify-overlay')).toBeHidden({ timeout: 5_000 });
    await expect(page.getByTestId('mage-wars-card-magnify-overlay')).toHaveAttribute('aria-hidden', 'true');
}

async function expectLocatorCenterUnblocked(locator: Locator, label: string) {
    const audit = await locator.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(x, y);
        return {
            center: { x, y },
            rect: {
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height,
            },
            containsHit: hit != null && element.contains(hit),
            hitTestId: hit?.closest<HTMLElement>('[data-testid]')?.dataset.testid ?? null,
            hitTutorialId: hit?.closest<HTMLElement>('[data-tutorial-id]')?.dataset.tutorialId ?? null,
            hitTag: hit?.tagName ?? null,
        };
    });
    expect(audit.containsHit, `${label} 中心点必须真实命中自身或子元素，实际命中 ${JSON.stringify(audit)}`).toBe(true);
    return audit;
}

async function expectReferenceSizedInspectButton(card: Locator, inspectButton: Locator, label: string) {
    const [cardBox, buttonBox] = await Promise.all([
        card.boundingBox(),
        inspectButton.boundingBox(),
    ]);
    expect(cardBox, `${label} 所属卡牌必须有可量测尺寸`).not.toBeNull();
    expect(buttonBox, `${label} 放大镜必须有可量测尺寸`).not.toBeNull();
    expect(buttonBox!.width, `${label} 放大镜命中区不应小于 24px`).toBeGreaterThanOrEqual(24);
    expect(buttonBox!.height, `${label} 放大镜命中区不应小于 24px`).toBeGreaterThanOrEqual(24);
    const widthRatio = buttonBox!.width / cardBox!.width;
    expect(
        widthRatio,
        `${label} 放大镜应接近大杀四方手牌 2vw / 8.5vw 的成熟比例，不能退回固定小图标`,
    ).toBeGreaterThanOrEqual(0.2);
    expect(
        widthRatio,
        `${label} 放大镜不能大到抢卡牌本体点击区`,
    ).toBeLessThanOrEqual(0.36);
}

async function clickLocatorCenterAsPlayer(page: Page, locator: Locator, label: string) {
    const audit = await expectLocatorCenterUnblocked(locator, label);
    await page.mouse.click(audit.center.x, audit.center.y);
}

async function expectNoTutorialCardOverlap(locator: Locator, label: string) {
    const overlapAudit = await locator.evaluate((element) => {
        const target = element.getBoundingClientRect();
        const targetRect = {
            left: target.left,
            top: target.top,
            right: target.right,
            bottom: target.bottom,
            width: target.width,
            height: target.height,
        };
        const tutorialCards = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="tutorial-overlay-card"]'))
            .filter((candidate) => {
                const style = window.getComputedStyle(candidate);
                const rect = candidate.getBoundingClientRect();
                return style.visibility !== 'hidden'
                    && style.display !== 'none'
                    && Number.parseFloat(style.opacity || '1') > 0.01
                    && rect.width > 1
                    && rect.height > 1;
            })
            .map((candidate) => {
                const rect = candidate.getBoundingClientRect();
                const intersectionWidth = Math.max(0, Math.min(target.right, rect.right) - Math.max(target.left, rect.left));
                const intersectionHeight = Math.max(0, Math.min(target.bottom, rect.bottom) - Math.max(target.top, rect.top));
                return {
                    rect: {
                        left: rect.left,
                        top: rect.top,
                        right: rect.right,
                        bottom: rect.bottom,
                        width: rect.width,
                        height: rect.height,
                    },
                    intersectionArea: intersectionWidth * intersectionHeight,
                };
            });
        return {
            targetRect,
            tutorialCards,
            overlappingCards: tutorialCards.filter((entry) => entry.intersectionArea > 1),
        };
    });
    expect(overlapAudit.overlappingCards, `${label} 不应被教程卡片视觉遮挡: ${JSON.stringify(overlapAudit)}`).toEqual([]);
}

async function findTutorialSpellbookCard(page: Page, cardId: number) {
    const card = page.locator(`[data-tutorial-id="mw-spellbook-card-${cardId}"]`).first();
    for (let pageIndex = 0; pageIndex < 12; pageIndex += 1) {
        if (await card.isVisible().catch(() => false)) {
            await expect(card).toBeEnabled({ timeout: 10_000 });
            return card;
        }
        const nextPage = page.getByTestId('mage-wars-spellbook-next-page');
        await expect(nextPage).toBeVisible({ timeout: 10_000 });
        if (await nextPage.isDisabled()) break;
        await nextPage.click({ timeout: 5_000 });
    }
    throw new Error(`法术书分页中未找到卡牌 ${cardId}`);
}

async function expectSpellbookInspectIconOpensWithoutPlanning(page: Page, card: Locator, cardId: number) {
    await expect(card).toHaveAttribute('data-secondary-inspect', 'true');
    const inspectButton = card.locator('xpath=..').getByTestId('mage-wars-card-inspect-button');
    await expect(inspectButton).toBeVisible({ timeout: 5_000 });
    await expect(inspectButton.locator('svg')).toHaveCount(1);
    await expectReferenceSizedInspectButton(card, inspectButton, `法术书卡牌 ${cardId}`);
    await expectLocatorCenterUnblocked(inspectButton, `法术书卡牌 ${cardId} 的放大镜`);
    const draftsBefore = await readPlanningDrafts(page);
    await clickLocatorCenterAsPlayer(page, inspectButton, `法术书卡牌 ${cardId} 的放大镜`);
    await expect(page.getByTestId('mage-wars-card-magnify-overlay')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('mage-wars-card-magnify-content')).toHaveAttribute('data-source-card-id', String(cardId));
    expect(await readPlanningDrafts(page)).toEqual(draftsBefore);
    await page.getByTestId('mage-wars-card-magnify-overlay-close').click();
    await expectMagnifyOverlayHidden(page);
}

async function clickTutorialSpellbookCardBody(page: Page, card: Locator, cardId: number) {
    await expectNoTutorialCardOverlap(card, `法术书卡牌 ${cardId}`);
    await expectMagnifyOverlayHidden(page);
    await clickLocatorCenterAsPlayer(page, card, `法术书卡牌 ${cardId} 本体`);
    await expectMagnifyOverlayHidden(page);
}

async function clickPlanningDraftCardBody(page: Page, cardId: number, planSlotIndex: number) {
    const draftCard = page
        .locator(`[data-testid="mage-wars-desktop-prepared-card"][data-planning-draft="true"][data-source-card-id="${cardId}"][data-plan-slot-index="${planSlotIndex}"]`)
        .first();
    await expect(draftCard).toBeVisible({ timeout: 10_000 });
    await expect(draftCard).toBeEnabled({ timeout: 10_000 });
    await expectNoTutorialCardOverlap(draftCard, `计划槽位 ${planSlotIndex} 草稿牌 ${cardId}`);
    await expectMagnifyOverlayHidden(page);
    await clickLocatorCenterAsPlayer(page, draftCard, `计划槽位 ${planSlotIndex} 草稿牌 ${cardId} 本体`);
    await expectMagnifyOverlayHidden(page);
}

async function clickTutorialSpellbookCard(page: Page, cardId: number) {
    const card = await findTutorialSpellbookCard(page, cardId);
    await clickTutorialSpellbookCardBody(page, card, cardId);
}

async function expectPlanControlsUnblocked(page: Page, expectedDraftCount: number) {
    const planButton = page.getByTestId('mage-wars-plan-spells');
    await expect(planButton).toBeVisible({ timeout: 10_000 });
    await expectLocatorCenterUnblocked(planButton, '确认计划按钮');
    await expectNoTutorialCardOverlap(planButton, '确认计划按钮');

    const draftCards = page.locator('[data-testid="mage-wars-desktop-prepared-card"][data-planning-draft="true"]');
    await expect(draftCards).toHaveCount(expectedDraftCount);
    for (let index = 0; index < expectedDraftCount; index += 1) {
        const draft = draftCards.nth(index);
        await expectLocatorCenterUnblocked(draft, `计划槽位 ${index + 1}`);
        await expectNoTutorialCardOverlap(draft, `计划槽位 ${index + 1}`);
    }
}

async function expectMageWars1366ReadableViewport(page: Page, expectedDraftCount = 0) {
    const audit = await page.evaluate(() => {
        const toRect = (element: Element | null) => {
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                right: rect.right,
                bottom: rect.bottom,
            };
        };
        const intersects = (
            left: ReturnType<typeof toRect>,
            right: ReturnType<typeof toRect>,
        ) => Boolean(left && right
            && left.x < right.right
            && left.right > right.x
            && left.y < right.bottom
            && left.bottom > right.y);
        const spellbookCards = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="mage-wars-desktop-spellbook-card"]'));
        const preparedDraftCards = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="mage-wars-desktop-prepared-card"][data-planning-draft="true"]'));
        const bottomGrid = document.querySelector<HTMLElement>('[data-testid="mage-wars-bottom-viewport-grid"]');
        const selfHud = document.querySelector<HTMLElement>('[data-testid="mage-wars-mage-hud-self"]');
        const spellbookShelf = document.querySelector<HTMLElement>('[data-testid="mage-wars-desktop-spellbook-shelf"]');
        const preparedArea = document.querySelector<HTMLElement>('[data-testid="mage-wars-desktop-prepared-spells"]');
        const planButton = document.querySelector<HTMLElement>('[data-testid="mage-wars-plan-spells"]');
        const firstSpellbookCard = spellbookCards[0] ?? null;
        const firstPreparedDraftCard = preparedDraftCards[0] ?? null;
        return {
            viewport: { width: window.innerWidth, height: window.innerHeight },
            desktopScale: document.querySelector<HTMLElement>('[data-testid="mage-wars-desktop-ui-plane"]')
                ?.getAttribute('data-mage-wars-desktop-ui-scale') ?? null,
            visibleSpellbookCardCount: spellbookCards.length,
            bottomGap: bottomGrid ? window.innerHeight - bottomGrid.getBoundingClientRect().bottom : null,
            hudDensity: selfHud?.dataset.mageWarsHudDensity ?? null,
            rects: {
                bottomGrid: toRect(bottomGrid),
                selfHud: toRect(selfHud),
                spellbookShelf: toRect(spellbookShelf),
                preparedArea: toRect(preparedArea),
                planButton: toRect(planButton),
                firstSpellbookCard: toRect(firstSpellbookCard),
                firstPreparedDraftCard: toRect(firstPreparedDraftCard),
            },
            overlaps: [
                { name: 'spellbook-prepared', value: intersects(toRect(spellbookShelf), toRect(preparedArea)) },
                { name: 'spellbook-plan-button', value: intersects(toRect(spellbookShelf), toRect(planButton)) },
                { name: 'hud-spellbook', value: intersects(toRect(selfHud), toRect(spellbookShelf)) },
            ],
        };
    });

    expect(audit.viewport).toEqual({ width: 1366, height: 768 });
    expect(audit.desktopScale, '1366x768 不得再把整层 HUD / 法术书 / 计划区缩到 0.71').toBe('1.000000');
    expect(audit.visibleSpellbookCardCount, '1366x768 仍必须显示 6 张法术书牌，不得为适配减少承载量').toBe(6);
    expect(audit.bottomGap, '底部主交互需要留出少量可见空隙，不能贴到屏幕底边').not.toBeNull();
    expect(audit.bottomGap!).toBeGreaterThanOrEqual(6);
    expect(audit.bottomGap!).toBeLessThanOrEqual(16);
    expect(audit.hudDensity, '1366x768 桌面视口不得把玩家 HUD 自动切成 compact').toBe('full');
    expect(audit.rects.firstSpellbookCard, '法术书牌必须有可量测尺寸').not.toBeNull();
    expect(audit.rects.firstSpellbookCard!.height, '法术书牌不能因为 1366x768 被压成低可读小卡').toBeGreaterThanOrEqual(170);
    if (expectedDraftCount > 0) {
        expect(audit.rects.firstPreparedDraftCard, '计划槽位里的草稿牌必须有可量测尺寸').not.toBeNull();
        expect(audit.rects.firstPreparedDraftCard!.height, '计划槽位不能因为 1366x768 被压成低可读小卡').toBeGreaterThanOrEqual(170);
    }
    expect(audit.rects.bottomGrid!.x).toBeGreaterThanOrEqual(-1);
    expect(audit.rects.bottomGrid!.right).toBeLessThanOrEqual(audit.viewport.width + 1);
    audit.overlaps.forEach((entry) => {
        expect(entry.value, `1366x768 核心底部槽位不应相交: ${JSON.stringify(audit)}`).toBe(false);
    });
}

async function visibleDesktopSpellbookCardIds(page: Page): Promise<string[]> {
    return page.locator('[data-testid="mage-wars-desktop-spellbook-card"]').evaluateAll((cards) => cards
        .map((card) => (card as HTMLElement).dataset.sourceCardId)
        .filter((cardId): cardId is string => cardId != null));
}

async function visibleAtlasFrameLoadFailures(page: Page) {
    return page.evaluate(() => {
        const isVisible = (element: HTMLElement) => {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== 'none'
                && style.visibility !== 'hidden'
                && Number.parseFloat(style.opacity || '1') > 0.01
                && rect.width > 8
                && rect.height > 8;
        };
        const readRect = (element: Element) => {
            const rect = element.getBoundingClientRect();
            return {
                width: rect.width,
                height: rect.height,
            };
        };
        const auditVisibleAtlasPixels = (frame: HTMLElement, image: HTMLImageElement) => {
            try {
                const frameRect = frame.getBoundingClientRect();
                const imageRect = image.getBoundingClientRect();
                const canvas = document.createElement('canvas');
                canvas.width = 1;
                canvas.height = 1;
                const ctx = canvas.getContext('2d');
                if (!ctx) return { status: 'unavailable', reason: 'canvas-context-unavailable' };

                const points = [
                    [0.28, 0.22],
                    [0.5, 0.32],
                    [0.72, 0.46],
                    [0.35, 0.68],
                    [0.62, 0.78],
                ] as const;
                const samples: number[][] = [];
                for (const [px, py] of points) {
                    const viewportX = frameRect.left + frameRect.width * px;
                    const viewportY = frameRect.top + frameRect.height * py;
                    const sourceX = ((viewportX - imageRect.left) / imageRect.width) * image.naturalWidth;
                    const sourceY = ((viewportY - imageRect.top) / imageRect.height) * image.naturalHeight;
                    if (
                        !Number.isFinite(sourceX)
                        || !Number.isFinite(sourceY)
                        || sourceX < 0
                        || sourceY < 0
                        || sourceX >= image.naturalWidth
                        || sourceY >= image.naturalHeight
                    ) {
                        continue;
                    }
                    ctx.clearRect(0, 0, 1, 1);
                    ctx.drawImage(image, Math.floor(sourceX), Math.floor(sourceY), 1, 1, 0, 0, 1, 1);
                    const [r, g, b, a] = Array.from(ctx.getImageData(0, 0, 1, 1).data);
                    if (a > 4) samples.push([r, g, b]);
                }

                if (samples.length < 3) {
                    return { status: 'fail', reason: 'too-few-visible-samples', sampleCount: samples.length };
                }

                const channelRanges = [0, 1, 2].map((channel) => {
                    const values = samples.map((sample) => sample[channel]);
                    return Math.max(...values) - Math.min(...values);
                });
                const averageChannelRange = channelRanges.reduce((sum, value) => sum + value, 0) / channelRanges.length;
                if (averageChannelRange < 8) {
                    return {
                        status: 'fail',
                        reason: 'visible-frame-low-pixel-variance',
                        averageChannelRange: Math.round(averageChannelRange * 10) / 10,
                        sampleCount: samples.length,
                    };
                }

                return {
                    status: 'pass',
                    averageChannelRange: Math.round(averageChannelRange * 10) / 10,
                    sampleCount: samples.length,
                };
            } catch (error) {
                return {
                    status: 'unavailable',
                    reason: error instanceof Error ? error.message : String(error),
                };
            }
        };

        const frames = Array.from(
            document.querySelectorAll<HTMLElement>('[data-card-atlas-frame="true"], .atlas-shimmer'),
        ).filter(isVisible);

        return frames.flatMap((frame) => {
            const image = frame.querySelector<HTMLImageElement>('img[data-card-atlas-img="true"]');
            const base = {
                testId: frame.closest<HTMLElement>('[data-testid]')?.dataset.testid ?? null,
                tutorialId: frame.closest<HTMLElement>('[data-tutorial-id]')?.dataset.tutorialId ?? null,
                sourceCardId: frame.closest<HTMLElement>('[data-source-card-id]')?.dataset.sourceCardId ?? null,
                atlasId: frame.dataset.cardAtlasId ?? null,
                atlasIndex: frame.dataset.cardAtlasIndex ?? null,
                rect: readRect(frame),
                hasShimmer: frame.classList.contains('atlas-shimmer'),
                hasImage: image != null,
                imageComplete: image?.complete ?? false,
                naturalWidth: image?.naturalWidth ?? 0,
                naturalHeight: image?.naturalHeight ?? 0,
            };

            if (frame.classList.contains('atlas-shimmer')) {
                return [{
                    ...base,
                    reason: frame.dataset.cardAtlasFrame === 'true'
                        ? 'atlas-frame-still-shimmering'
                        : 'lazy-atlas-unresolved-shimmer',
                }];
            }
            if (!image) return [{ ...base, reason: 'atlas-frame-missing-image' }];
            if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
                return [{ ...base, reason: 'atlas-image-not-loaded' }];
            }
            const imageRect = image.getBoundingClientRect();
            if (imageRect.width <= 10 || imageRect.height <= 10) {
                return [{ ...base, reason: 'atlas-image-zero-sized' }];
            }
            const pixelAudit = auditVisibleAtlasPixels(frame, image);
            if (pixelAudit.status === 'fail') {
                return [{
                    ...base,
                    reason: pixelAudit.reason ?? 'atlas-frame-pixel-audit-failed',
                    pixelAudit,
                }];
            }
            return [];
        });
    });
}

async function assertVisibleAtlasFramesLoaded(page: Page, label: string) {
    await expect.poll(
        async () => (await visibleAtlasFrameLoadFailures(page)).slice(0, 8),
        {
            timeout: 90_000,
            message: `${label} 截图前可见卡牌必须完成真实图像渲染，不能保留灰色 shimmer 占位`,
        },
    ).toEqual([]);
}

async function screenshot(page: Page, path: string) {
    await mkdir(dirname(path), { recursive: true });
    await assertVisibleAtlasFramesLoaded(page, path);
    await page.screenshot({ path, fullPage: false });
}

async function screenshotTutorialStep(page: Page, stepId: string, path: string) {
    await waitForTutorialStep(page, stepId);
    await expect(page.getByTestId('tutorial-overlay-content')).toBeVisible({ timeout: 10_000 });
    await screenshot(page, path);
}

function basename(path: string) {
    return path.slice(path.lastIndexOf('/') + 1);
}

async function readPlanningDrafts(page: Page) {
    return page.locator('[data-testid="mage-wars-desktop-prepared-card"][data-planning-draft="true"]')
        .evaluateAll((cards) => cards
            .map((card) => ({
                sourceCardId: card.getAttribute('data-source-card-id'),
                planSlotIndex: card.getAttribute('data-plan-slot-index'),
            }))
            .sort((left, right) => String(left.planSlotIndex).localeCompare(String(right.planSlotIndex))));
}

async function assertTutorialScreenshotEvidenceSet() {
    const actual = (await readdir(SCREENSHOT_DIR, { withFileTypes: true }))
        .filter((entry) => entry.isFile() && entry.name.endsWith('.png'))
        .map((entry) => entry.name)
        .sort();
    const expected = TUTORIAL_FLOW_SCREENSHOT_PATHS.map(basename).sort();

    expect(actual, '教程主流程截图必须只包含 00-24 的 25 张当前玩家可见教程卡截图，不能混入专题/代表态/旧图').toEqual(expected);
    expect(actual.filter((name) => /drag|dragged|zoom|map/i.test(name)), '教程主流程截图不得混入地图拖拽/缩放专项图').toEqual([]);
    expect(actual.filter((name) => /wall|guard|heal|restore|burn|transition/i.test(name)), '基础自然主线不得混入墙体/守卫/治疗/复原术代表态专题图').toEqual([]);
}

async function assertAllVisibleImagesLoaded(page: Page) {
    await page.waitForFunction(() => Array.from(document.images)
        .filter((image) => {
            const rect = image.getBoundingClientRect();
            return rect.width > 10 && rect.height > 10;
        })
        .every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0), undefined, { timeout: 30_000 });

    const imageAudit = await page.evaluate(() => {
        const images = Array.from(document.images).map((image) => ({
            alt: image.alt,
            naturalWidth: image.naturalWidth,
            naturalHeight: image.naturalHeight,
        }));
        return {
            missing: images.filter((image) => image.naturalWidth === 0 || image.naturalHeight === 0),
            visibleAltTexts: images.map((image) => image.alt).filter(Boolean),
        };
    });
    expect(imageAudit.missing, JSON.stringify(imageAudit.missing, null, 2)).toHaveLength(0);
    expect(imageAudit.visibleAltTexts).toEqual(expect.arrayContaining([
        '法师战争标准竞技场',
        '兽王',
        '女祭司',
    ]));
}

test.describe('Mage Wars tutorial', () => {
    test('单入口教程按玩家自然流程覆盖读局、计划、召唤、公开弃牌、快速施法窗口和移动', async ({ context, page }) => {
        test.setTimeout(240_000);
        await rm(SCREENSHOT_DIR, { recursive: true, force: true });
        const diagnostics = await openMageWarsTutorial(context, page);

        await waitForTutorialStep(page, 'intro', 60_000);
        await expect(page.getByTestId('tutorial-overlay-content')).toContainText('屹立不倒的法师');
        await expect(page.getByTestId('mage-wars-board')).not.toContainText('正式竞技场');
        await assertAllVisibleImagesLoaded(page);
        await screenshotTutorialStep(page, 'intro', INTRO_SCREENSHOT_PATH);
        await clickTutorialNext(page);

        await waitForTutorialStep(page, 'self-hud');
        await expect(page.getByTestId('tutorial-overlay-content')).toContainText('生命');
        await expect(page.getByTestId('tutorial-overlay-content')).toContainText('法力');
        await expect(page.getByTestId('tutorial-overlay-content')).toContainText('聚魔');
        await screenshotTutorialStep(page, 'self-hud', SELF_HUD_SCREENSHOT_PATH);
        await clickTutorialNext(page);

        await screenshotTutorialStep(page, 'opponent-hud', OPPONENT_HUD_SCREENSHOT_PATH);
        await clickTutorialNext(page);

        await screenshotTutorialStep(page, 'stage', STAGE_SCREENSHOT_PATH);
        await clickTutorialNext(page);

        await waitForTutorialStep(page, 'channel-result');
        await expect.poll(async () => (await readMageWarsState(page)).core?.players?.['0']?.mana).toBe(20);
        await expect(page.locator('[data-testid="mage-wars-desktop-prepared-card"][data-planning-draft="true"]'))
            .toHaveCount(0);
        await screenshotTutorialStep(page, 'channel-result', CHANNEL_RESULT_SCREENSHOT_PATH);
        await clickTutorialNext(page);

        await waitForTutorialStep(page, 'plan-open-creature-category', 45_000);
        await expect.poll(async () => {
            const state = await readMageWarsState(page);
            return { phase: state.sys?.phase ?? null, phaseActorId: state.core?.phaseActorId ?? null };
        }, { timeout: 15_000 }).toEqual({ phase: 'planning', phaseActorId: '0' });
        await expect(page.getByTestId('mage-wars-desktop-spellbook-shelf')).toHaveAttribute('data-planning-enabled', 'true');
        await expectMagnifyOverlayHidden(page);
        await screenshotTutorialStep(page, 'plan-open-creature-category', PLAN_OPEN_CREATURE_CATEGORY_SCREENSHOT_PATH);
        const beforeCreatureCategoryIds = await visibleDesktopSpellbookCardIds(page);
        await clickTutorialTarget(page, 'mw-spellbook-category-creature');
        await waitForTutorialStep(page, 'plan-creature-next-page');
        await expect(page.getByTestId('mage-wars-spellbook-category-creature')).toHaveAttribute('aria-pressed', 'true');
        expect((await visibleDesktopSpellbookCardIds(page)).join('|')).not.toBe(beforeCreatureCategoryIds.join('|'));
        await screenshotTutorialStep(page, 'plan-creature-next-page', PLAN_CREATURE_NEXT_PAGE_SCREENSHOT_PATH);

        await clickTutorialTarget(page, 'mw-spellbook-next-page');
        await waitForTutorialStep(page, 'plan-select-wolf');
        const wolfSpellbookCard = await findTutorialSpellbookCard(page, 2819);
        await screenshotTutorialStep(page, 'plan-select-wolf', PLAN_SELECT_WOLF_SCREENSHOT_PATH);
        await expectSpellbookInspectIconOpensWithoutPlanning(page, wolfSpellbookCard, 2819);
        await clickTutorialSpellbookCardBody(page, wolfSpellbookCard, 2819);
        await waitForTutorialStep(page, 'plan-open-incantation-category');
        await expect(page.getByTestId('mage-wars-plan-spells')).toHaveAttribute('data-plan-progress', '1/2');
        await expect(page.getByTestId('mage-wars-plan-spells')).toContainText('1/2');
        await expect(page.getByTestId('mage-wars-plan-spells')).toBeDisabled();
        await expect(page.locator('[data-testid="mage-wars-desktop-spellbook-card"][data-source-card-id="2819"]')
            .getByTestId('mage-wars-spellbook-selected-count')).toHaveCount(0);
        await expect(page.locator('[data-testid="mage-wars-desktop-prepared-card"][data-planning-draft="true"]'))
            .toHaveCount(1);
        await expect(page.locator('[data-testid="mage-wars-desktop-prepared-card"][data-planning-draft="true"][data-source-card-id="2819"]'))
            .toHaveCount(1);
        await expectPlanControlsUnblocked(page, 1);
        expect(await readPlanningDrafts(page)).toEqual([
            { sourceCardId: '2819', planSlotIndex: '1' },
        ]);
        await screenshotTutorialStep(page, 'plan-open-incantation-category', PLAN_OPEN_INCANTATION_CATEGORY_SCREENSHOT_PATH);
        const beforeIncantationCategoryIds = await visibleDesktopSpellbookCardIds(page);
        await clickTutorialTarget(page, 'mw-spellbook-category-incantation');
        await waitForTutorialStep(page, 'plan-select-rouse');
        await expect(page.getByTestId('mage-wars-spellbook-category-incantation')).toHaveAttribute('aria-pressed', 'true');
        expect((await visibleDesktopSpellbookCardIds(page)).join('|')).not.toBe(beforeIncantationCategoryIds.join('|'));
        const rouseSpellbookCard = await findTutorialSpellbookCard(page, 3403);
        await screenshotTutorialStep(page, 'plan-select-rouse', PLAN_SELECT_ROUSE_SCREENSHOT_PATH);
        await clickTutorialSpellbookCardBody(page, rouseSpellbookCard, 3403);
        await waitForTutorialStep(page, 'plan-confirm');
        await expect(page.getByTestId('mage-wars-plan-spells')).toHaveAttribute('data-plan-progress', '2/2');
        await expect(page.getByTestId('mage-wars-plan-spells')).toContainText('2/2');
        await expect(page.getByTestId('mage-wars-plan-spells')).toBeEnabled();
        await expect(page.locator('[data-testid="mage-wars-desktop-spellbook-card"][data-source-card-id="3403"]')
            .getByTestId('mage-wars-spellbook-selected-count')).toHaveCount(0);
        await expect(page.locator('[data-testid="mage-wars-desktop-prepared-card"][data-planning-draft="true"]'))
            .toHaveCount(2);
        await expect(page.locator('[data-testid="mage-wars-desktop-prepared-card"][data-planning-draft="true"][data-source-card-id="2819"]'))
            .toHaveCount(1);
        await expect(page.locator('[data-testid="mage-wars-desktop-prepared-card"][data-planning-draft="true"][data-source-card-id="3403"]'))
            .toHaveCount(1);
        await expect.poll(async () => page.locator('[data-testid="mage-wars-desktop-prepared-card"][data-planning-draft="true"]')
            .evaluateAll((cards) => cards
                .map((card) => card.getAttribute('data-source-card-id'))
                .filter(Boolean)
                .sort())).toEqual(['2819', '3403']);
        expect(await readPlanningDrafts(page)).toEqual([
            { sourceCardId: '2819', planSlotIndex: '1' },
            { sourceCardId: '3403', planSlotIndex: '2' },
        ]);
        await expectPlanControlsUnblocked(page, 2);
        await screenshotTutorialStep(page, 'plan-confirm', PLAN_CONFIRM_SCREENSHOT_PATH);
        await clickTutorialTarget(page, 'mw-plan-spells');
        await waitForTutorialStep(page, 'prepared-and-hidden');
        await expectTutorialStepNotVisible(page, 'prepare-opponent-spells');
        await expect.poll(async () => (await readMageWarsState(page)).core?.players?.['0']?.preparedSpellCardIds).toEqual([
            2819,
            3403,
        ]);
        await expect(page.locator('[data-tutorial-id="mw-prepared-card-2819"]')).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('[data-tutorial-id="mw-prepared-card-3403"]')).toBeVisible({ timeout: 10_000 });
        await screenshotTutorialStep(page, 'prepared-and-hidden', PREPARED_HIDDEN_SCREENSHOT_PATH);
        await clickTutorialNext(page);

        await waitForTutorialStep(page, 'deploy-select-wolf');
        await screenshotTutorialStep(page, 'deploy-select-wolf', DEPLOY_SELECT_WOLF_SCREENSHOT_PATH);
        await clickTutorialTarget(page, 'mw-prepared-card-2819');
        await waitForTutorialStep(page, 'deploy-target-zone');
        await expect(page.locator('[data-tutorial-id="mw-zone-a3"][data-legal-target-zone="true"]')).toBeVisible({ timeout: 10_000 });
        await screenshotTutorialStep(page, 'deploy-target-zone', DEPLOY_TARGET_ZONE_SCREENSHOT_PATH);
        await clickTutorialTarget(page, 'mw-zone-a3');
        await waitForTutorialStep(page, 'wolf-summoned');
        await expect.poll(async () => {
            const state = await readMageWarsState(page);
            const wolf = Object.values(state.core?.objects ?? {}).find((object) => object.sourceSpellCardId === 2819);
            return { zoneId: wolf?.zoneId ?? null, actionReady: wolf?.actionReady ?? null };
        }, { timeout: 15_000 }).toEqual({ zoneId: 'a3', actionReady: false });
        await expect(page.locator('[data-tutorial-id="mw-field-object-2819"]')).toBeVisible({ timeout: 10_000 });
        await screenshotTutorialStep(page, 'wolf-summoned', WOLF_SUMMONED_SCREENSHOT_PATH);
        await clickTutorialNext(page);

        await waitForTutorialStep(page, 'rouse-select-spell');
        await screenshotTutorialStep(page, 'rouse-select-spell', ROUSE_SELECT_SPELL_SCREENSHOT_PATH);
        await clickTutorialTarget(page, 'mw-prepared-card-3403');
        await waitForTutorialStep(page, 'rouse-target-wolf');
        await expect(page.locator('[data-tutorial-id="mw-field-object-2819"][data-field-card-role="target"]')).toBeVisible({ timeout: 10_000 });
        await screenshotTutorialStep(page, 'rouse-target-wolf', ROUSE_TARGET_WOLF_SCREENSHOT_PATH);
        await clickTutorialTarget(page, 'mw-field-object-2819');
        await waitForTutorialStep(page, 'pass-your-deployment', 45_000);
        await expect.poll(async () => {
            const state = await readMageWarsState(page);
            const wolf = Object.values(state.core?.objects ?? {}).find((object) => object.sourceSpellCardId === 2819);
            return {
                phase: state.sys?.phase ?? null,
                phaseActorId: state.core?.phaseActorId ?? null,
                zoneId: wolf?.zoneId ?? null,
                actionReady: wolf?.actionReady ?? null,
                discard: state.core?.players?.['0']?.discardSpellCardIds ?? [],
            };
        }, { timeout: 15_000 }).toEqual({
            phase: 'deployment',
            phaseActorId: '0',
            zoneId: 'a3',
            actionReady: true,
            discard: [3403, 2819],
        });
        await screenshotTutorialStep(page, 'pass-your-deployment', PASS_DEPLOYMENT_SCREENSHOT_PATH);
        await clickTutorialTarget(page, 'mw-turn-end');
        await expectTutorialStepNotVisible(page, 'opponent-deploy');
        await expectTutorialStepNotVisible(page, 'opponent-attack-spell');
        await expectTutorialStepNotVisible(page, 'opponent-deployment-results');
        await waitForTutorialStep(page, 'opponent-public-view', 60_000);
        await expect.poll(async () => {
            const state = await readMageWarsState(page);
            const cleric = Object.values(state.core?.objects ?? {}).find((object) => object.sourceSpellCardId === 2811);
            return {
                phase: state.sys?.phase ?? null,
                phaseActorId: state.core?.phaseActorId ?? null,
                clericZoneId: cleric?.zoneId ?? null,
                clericDamaged: (cleric?.damage ?? 0) > 0,
                opponentDiscard: state.core?.players?.['1']?.discardSpellCardIds ?? [],
            };
        }, { timeout: 30_000 }).toEqual({
            phase: 'deployment',
            phaseActorId: '1',
            clericZoneId: 'd1',
            clericDamaged: true,
            opponentDiscard: [1706, 2811],
        });
        const mainDiscardPile = page.locator('[data-tutorial-id="mw-discard"]');
        await expect(mainDiscardPile).toBeVisible({ timeout: 10_000 });
        await expect(mainDiscardPile).toHaveAttribute('data-discard-owner-role', 'self');
        await expect(mainDiscardPile).toHaveAttribute('data-discard-owner-id', '0');
        await expect(page.locator('[data-tutorial-id="mw-opponent-discard"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="mage-wars-opponent-discard-pile"]')).toHaveCount(0);
        await screenshotTutorialStep(page, 'opponent-public-view', OPPONENT_PUBLIC_VIEW_SCREENSHOT_PATH);
        await clickTutorialTarget(page, 'mw-opponent-view-toggle');

        await waitForTutorialStep(page, 'discard-reading');
        await expect(page.getByTestId('mage-wars-board')).toHaveAttribute('data-mage-wars-public-view-player-id', '1');
        await expect(page.getByTestId('mage-wars-board')).toHaveAttribute('data-mage-wars-public-view-role', 'opponent');
        const publicViewBanner = page.getByTestId('mage-wars-public-view-banner');
        await expect(publicViewBanner).toBeVisible({ timeout: 10_000 });
        const viewport = page.viewportSize();
        expect(viewport).not.toBeNull();
        const publicViewBannerMetrics = await publicViewBanner.evaluate((node) => {
            const shell = node.getBoundingClientRect();
            const panel = node.firstElementChild?.getBoundingClientRect();
            return {
                shellCenterX: shell.left + shell.width / 2,
                panelCenterX: panel ? panel.left + panel.width / 2 : null,
            };
        });
        expect(Math.abs(publicViewBannerMetrics.shellCenterX - viewport!.width / 2)).toBeLessThanOrEqual(4);
        expect(publicViewBannerMetrics.panelCenterX).not.toBeNull();
        expect(Math.abs((publicViewBannerMetrics.panelCenterX ?? 0) - viewport!.width / 2)).toBeLessThanOrEqual(32);
        await expect(mainDiscardPile).toHaveAttribute('data-discard-owner-role', 'opponent');
        await expect(mainDiscardPile).toHaveAttribute('data-discard-owner-id', '1');
        await expect(mainDiscardPile).toContainText('弃牌 2');
        await expect(page.locator('[data-tutorial-id="mw-opponent-discard"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="mage-wars-opponent-discard-pile"]')).toHaveCount(0);
        await screenshotTutorialStep(page, 'discard-reading', DISCARD_SCREENSHOT_PATH);
        await clickTutorialNext(page);

        await waitForTutorialStep(page, 'back-to-self-view');
        await screenshotTutorialStep(page, 'back-to-self-view', BACK_TO_SELF_VIEW_SCREENSHOT_PATH);
        await clickTutorialTarget(page, 'mw-back-to-self-view');
        await expect(page.getByTestId('mage-wars-board')).toHaveAttribute('data-mage-wars-public-view-player-id', '0');
        await expect(page.getByTestId('mage-wars-board')).toHaveAttribute('data-mage-wars-public-view-role', 'self');
        await expect(mainDiscardPile).toHaveAttribute('data-discard-owner-role', 'self');
        await expect(mainDiscardPile).toHaveAttribute('data-discard-owner-id', '0');

        await expectTutorialStepNotVisible(page, 'opponent-pass-deployment');
        await waitForTutorialStep(page, 'skip-initiative-quickcast', 60_000);
        await expect.poll(async () => {
            const state = await readMageWarsState(page);
            return {
                phase: state.sys?.phase ?? null,
                phaseActorId: state.core?.phaseActorId ?? null,
            };
        }, { timeout: 15_000 }).toEqual({
            phase: 'initiativeQuickcast',
            phaseActorId: '0',
        });
        await expect(page.getByTestId('tutorial-overlay-content')).toContainText('快速施法');
        await screenshotTutorialStep(page, 'skip-initiative-quickcast', QUICKCAST_PASS_SCREENSHOT_PATH);
        await clickTutorialTarget(page, 'mw-turn-end');

        await expectTutorialStepNotVisible(page, 'opponent-pass-initiative-quickcast');
        await waitForTutorialStep(page, 'move-select-wolf', 60_000);
        await expect.poll(async () => {
            const state = await readMageWarsState(page);
            return {
                phase: state.sys?.phase ?? null,
                phaseActorId: state.core?.phaseActorId ?? null,
            };
        }, { timeout: 15_000 }).toEqual({
            phase: 'creatureAction',
            phaseActorId: '0',
        });
        await screenshotTutorialStep(page, 'move-select-wolf', MOVE_SELECT_WOLF_SCREENSHOT_PATH);
        await clickTutorialTarget(page, 'mw-field-object-2819');
        await waitForTutorialStep(page, 'move-target-zone');
        await expect(page.locator('[data-tutorial-id="mw-zone-a2"][data-legal-move-zone="true"]')).toBeVisible({ timeout: 10_000 });
        await screenshotTutorialStep(page, 'move-target-zone', MOVE_TARGET_ZONE_SCREENSHOT_PATH);
        await clickTutorialTarget(page, 'mw-zone-a2');
        await waitForTutorialStep(page, 'finish', 45_000);
        await expect.poll(async () => {
            const state = await readMageWarsState(page);
            const wolf = Object.values(state.core?.objects ?? {}).find((object) => object.sourceSpellCardId === 2819);
            return { zoneId: wolf?.zoneId ?? null, actionReady: wolf?.actionReady ?? null };
        }, { timeout: 15_000 }).toEqual({ zoneId: 'a2', actionReady: false });
        await screenshotTutorialStep(page, 'finish', FINISH_SCREENSHOT_PATH);
        await assertTutorialScreenshotEvidenceSet();

        await assertNoFatalFrontendErrors([{ label: 'mage-wars-tutorial-natural-flow', diagnostics }]);
    });

    test('1366x768 真实卡面点击计划且计划槽位不被遮挡', async ({ context, page }) => {
        test.setTimeout(120_000);
        await page.setViewportSize({ width: 1366, height: 768 });
        await rm(RESPONSIVE_PLAN_SCREENSHOT_DIR, { recursive: true, force: true });
        const diagnostics = await openMageWarsTutorial(context, page);

        await waitForTutorialStep(page, 'intro', 60_000);
        await clickTutorialNext(page);
        await waitForTutorialStep(page, 'self-hud');
        await clickTutorialNext(page);
        for (const stepId of ['opponent-hud', 'stage']) {
            await waitForTutorialStep(page, stepId);
            await clickTutorialNext(page);
        }
        await waitForTutorialStep(page, 'channel-result');
        await clickTutorialNext(page);
        await waitForTutorialStep(page, 'plan-open-creature-category', 45_000);

        await expect(page.getByTestId('mage-wars-desktop-spellbook-shelf')).toHaveAttribute('data-planning-enabled', 'true');
        await expect(page.getByTestId('mage-wars-desktop-spellbook-shelf')).toHaveAttribute('data-visible-card-count', '6');
        await expect(page.getByTestId('mage-wars-desktop-ui-plane')).toHaveAttribute('data-mage-wars-spellbook-visible-card-count', '6');
        await expectMageWars1366ReadableViewport(page);
        await clickTutorialTarget(page, 'mw-spellbook-category-creature');
        await waitForTutorialStep(page, 'plan-creature-next-page');
        await clickTutorialTarget(page, 'mw-spellbook-next-page');
        await waitForTutorialStep(page, 'plan-select-wolf');
        const wolfSpellbookCard = await findTutorialSpellbookCard(page, 2819);
        await expectSpellbookInspectIconOpensWithoutPlanning(page, wolfSpellbookCard, 2819);
        await clickTutorialSpellbookCardBody(page, wolfSpellbookCard, 2819);
        await waitForTutorialStep(page, 'plan-open-incantation-category');

        await expect(page.getByTestId('mage-wars-plan-spells')).toHaveAttribute('data-plan-progress', '1/2');
        await expect(page.getByTestId('mage-wars-plan-spells')).toBeDisabled();
        await expect(page.locator('[data-testid="mage-wars-desktop-prepared-card"][data-planning-draft="true"][data-source-card-id="2819"]'))
            .toHaveCount(1);
        expect(await readPlanningDrafts(page)).toEqual([
            { sourceCardId: '2819', planSlotIndex: '1' },
        ]);
        await expectPlanControlsUnblocked(page, 1);
        await expectMageWars1366ReadableViewport(page, 1);
        await screenshot(page, RESPONSIVE_PLAN_ONE_OF_TWO_SCREENSHOT_PATH);

        await clickPlanningDraftCardBody(page, 2819, 1);
        await expect(page.locator('[data-testid="mage-wars-desktop-prepared-card"][data-planning-draft="true"]'))
            .toHaveCount(0);
        await expect(page.getByTestId('mage-wars-plan-spells')).toHaveCount(0);
        expect(await readPlanningDrafts(page)).toEqual([]);
        await expectMageWars1366ReadableViewport(page);
        await screenshot(page, RESPONSIVE_PLAN_SLOT_CANCEL_SCREENSHOT_PATH);

        await clickTutorialSpellbookCardBody(page, wolfSpellbookCard, 2819);
        await expect(page.getByTestId('mage-wars-plan-spells')).toHaveAttribute('data-plan-progress', '1/2');
        await expect(page.locator('[data-testid="mage-wars-desktop-prepared-card"][data-planning-draft="true"][data-source-card-id="2819"]'))
            .toHaveCount(1);
        expect(await readPlanningDrafts(page)).toEqual([
            { sourceCardId: '2819', planSlotIndex: '1' },
        ]);
        await expectPlanControlsUnblocked(page, 1);
        await expectMageWars1366ReadableViewport(page, 1);
        await screenshot(page, RESPONSIVE_PLAN_RESELECT_SCREENSHOT_PATH);

        await assertNoFatalFrontendErrors([{ label: 'mage-wars-tutorial-1366-plan-click', diagnostics }]);
    });
});
