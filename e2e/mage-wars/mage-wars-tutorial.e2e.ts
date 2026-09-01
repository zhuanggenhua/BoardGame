import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
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
const DRAGGED_MAP_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/00b-dragged-map-full-viewport.png`;
const HUD_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/01-read-mage-hud-life-mana-channeling.png`;
const CHANNEL_RESULT_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/02-channel-result-mana-increased.png`;
const PLAN_ONE_OF_TWO_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/03-plan-selected-one-of-two.png`;
const PLAN_TWO_OF_TWO_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/04-plan-selected-two-of-two-confirm.png`;
const PREPARED_HIDDEN_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/05-prepared-and-hidden.png`;
const SUMMON_TARGET_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/06-summon-target-zone-highlight.png`;
const WOLF_SUMMONED_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/07-wolf-summoned-not-ready.png`;
const ROUSE_TARGET_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/08-rouse-target-wolf-highlight.png`;
const WOLF_READY_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/09-roused-wolf-ready-and-end-deployment.png`;
const OPPONENT_DEPLOY_PROMPT_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/10-opponent-deploy-prompt.png`;
const DISCARD_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/11-opponent-spell-result-and-discard-reading.png`;
const OPPONENT_PASS_DEPLOYMENT_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/12-opponent-pass-deployment.png`;
const QUICKCAST_PASS_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/13-skip-initiative-quickcast.png`;
const MOVE_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/14-wolf-moved-to-a2.png`;
const WALL_READY_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/15-wall-prepared.png`;
const WALL_TARGET_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/16-wall-edge-target-highlight.png`;
const WALL_CARD_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/17-wall-card-on-edge.png`;
const WALL_LOS_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/18-wall-line-of-sight-and-passage.png`;
const GUARD_SOURCE_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/19-guard-action-dock.png`;
const GUARD_RESULT_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/20-guard-token-result.png`;
const HEALING_BUTTON_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/21-healing-light-action-dock.png`;
const HEALING_TARGET_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/22-healing-target-highlight.png`;
const HEALING_RESULT_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/23-healing-result-life-readout.png`;
const LIFE_TOGGLE_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/24-life-toggle-all-readouts.png`;
const RESTORE_BUTTON_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/25-restore-action-dock.png`;
const RESTORE_TARGET_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/26-restore-burn-target-highlight.png`;
const RESTORE_RESULT_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/27-restore-burn-removed.png`;

const GUARD_CLERIC_OBJECT_ID = 'mw-tutorial-guard-cleric';
const HEALING_CLERIC_OBJECT_ID = 'mw-tutorial-healing-cleric';
const WOUNDED_BOBCAT_OBJECT_ID = 'mw-tutorial-wounded-bobcat';
const BURNING_CLERIC_OBJECT_ID = 'mw-tutorial-burning-cleric';

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

type RectSnapshot = {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
};

type ArenaViewportPoseSnapshot = {
    originalStyle: string | null;
    transform: string;
    board: RectSnapshot;
    viewport: RectSnapshot;
    content: RectSnapshot;
    selfHud: RectSnapshot;
    bottomGrid: RectSnapshot;
};

function assertRectsNearlyEqual(
    actual: RectSnapshot,
    expected: RectSnapshot,
    tolerancePx: number,
) {
    expect(Math.abs(actual.left - expected.left)).toBeLessThanOrEqual(tolerancePx);
    expect(Math.abs(actual.top - expected.top)).toBeLessThanOrEqual(tolerancePx);
    expect(Math.abs(actual.right - expected.right)).toBeLessThanOrEqual(tolerancePx);
    expect(Math.abs(actual.bottom - expected.bottom)).toBeLessThanOrEqual(tolerancePx);
}

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
    if (!(await board.isVisible({ timeout: 1_000 }).catch(() => false))) {
        await expect(catalogEntry).toBeVisible({ timeout: 60_000 });
        await catalogEntry.click();
    }
    await expect(board).toBeVisible({ timeout: 60_000 });
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

async function waitForTutorialStateStep(page: Page, stepId: string, timeout = 30_000) {
    await expect.poll(async () => {
        const state = await readMageWarsState(page);
        return {
            active: state.sys?.tutorial?.active ?? false,
            stepId: state.sys?.tutorial?.step?.id ?? null,
            aiActionCount: state.sys?.tutorial?.step?.aiActions?.length ?? 0,
        };
    }, { timeout }).toEqual({
        active: true,
        stepId,
        aiActionCount: 0,
    });
    await expect(page.locator(`[data-tutorial-step="${stepId}"]`)).toBeVisible({ timeout });
}

async function clickTutorialNext(page: Page) {
    const button = page.getByTestId('tutorial-next-button');
    await expect(button).toBeVisible({ timeout: 10_000 });
    await button.click({ timeout: 5_000 });
}

async function finishSegmentAndWaitFor(page: Page, nextStepId: string) {
    await clickTutorialNext(page);
    await waitForTutorialStateStep(page, nextStepId, 60_000);
}

async function clickTutorialTarget(page: Page, tutorialId: string) {
    const target = page.locator(`[data-tutorial-id="${tutorialId}"]`).first();
    await expect(target).toBeVisible({ timeout: 15_000 });
    await expect(target).toBeEnabled({ timeout: 10_000 });
    await target.click({ timeout: 5_000 });
}

async function clickTutorialObject(page: Page, objectId: string) {
    const target = page.locator(`[data-tutorial-object-id="mw-arena-object-${objectId}"]`).first();
    await expect(target).toBeVisible({ timeout: 15_000 });
    await expect(target).toBeEnabled({ timeout: 10_000 });
    await target.click({ timeout: 5_000 });
}

async function clickTutorialSpellbookCard(page: Page, cardId: number) {
    const card = page.locator(`[data-tutorial-id="mw-spellbook-card-${cardId}"]`).first();
    for (let pageIndex = 0; pageIndex < 12; pageIndex += 1) {
        if (await card.isVisible().catch(() => false)) {
            await expect(card).toBeEnabled({ timeout: 10_000 });
            await card.click({ timeout: 5_000 });
            return;
        }
        const nextPage = page.getByTestId('mage-wars-spellbook-next-page');
        await expect(nextPage).toBeVisible({ timeout: 10_000 });
        if (await nextPage.isDisabled()) break;
        await nextPage.click({ timeout: 5_000 });
    }
    throw new Error(`法术书分页中未找到卡牌 ${cardId}`);
}

async function screenshot(page: Page, path: string) {
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: false });
}

async function setArenaViewportPoseForScreenshot(page: Page): Promise<ArenaViewportPoseSnapshot> {
    return page.evaluate(() => {
        const toRect = (rect: DOMRect): RectSnapshot => ({
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
        });
        const board = document.querySelector<HTMLElement>('[data-testid="mage-wars-board"]');
        const viewport = document.querySelector<HTMLElement>('[data-testid="mage-wars-arena-viewport"]');
        const content = document.querySelector<HTMLElement>('[data-testid="mage-wars-arena-viewport-content"]');
        const selfHud = document.querySelector<HTMLElement>('[data-testid="mage-wars-mage-hud-self"]');
        const bottomGrid = document.querySelector<HTMLElement>('[data-testid="mage-wars-bottom-viewport-grid"]');
        if (!board || !viewport || !content || !selfHud || !bottomGrid) {
            throw new Error('Mage Wars 拖拽地图截图缺少必要视口或 HUD 节点');
        }

        const originalStyle = content.getAttribute('style');
        const transform = content.style.transform || '';
        const viewportRect = viewport.getBoundingClientRect();
        content.style.transition = 'none';
        content.style.transform = 'translate(0px, 0px) scale(1)';
        const baseContentRect = content.getBoundingClientRect();
        const currentScale = Number(transform.match(/scale\(([^)]+)\)/)?.[1] ?? '1');
        const minCoverScale = Math.max(
            (viewportRect.width + 16) / Math.max(1, baseContentRect.width),
            (viewportRect.height + 16) / Math.max(1, baseContentRect.height),
        );
        const targetScale = Math.min(2.6, Math.max(1.08, minCoverScale, currentScale * 1.12));
        const maxOffsetX = Math.max(0, ((baseContentRect.width * targetScale) - viewportRect.width) / 2);
        const maxOffsetY = Math.max(0, ((baseContentRect.height * targetScale) - viewportRect.height) / 2);
        let targetX = -Math.min(180, Math.max(1, maxOffsetX * 0.72));
        let targetY = -Math.min(120, Math.max(1, maxOffsetY * 0.62));

        content.style.transform = `translate(${targetX}px, ${targetY}px) scale(${targetScale})`;
        const draggedRect = content.getBoundingClientRect();
        if (draggedRect.left > viewportRect.left + 2) {
            targetX -= draggedRect.left - viewportRect.left + 8;
        }
        if (draggedRect.right < viewportRect.right - 2) {
            targetX += viewportRect.right - draggedRect.right + 8;
        }
        if (draggedRect.top > viewportRect.top + 2) {
            targetY -= draggedRect.top - viewportRect.top + 8;
        }
        if (draggedRect.bottom < viewportRect.bottom - 2) {
            targetY += viewportRect.bottom - draggedRect.bottom + 8;
        }

        content.style.transform = `translate(${targetX}px, ${targetY}px) scale(${targetScale})`;
        content.setAttribute('data-e2e-direct-viewport-pose', 'dragged-map-full-viewport');

        return {
            originalStyle,
            transform: content.style.transform,
            board: toRect(board.getBoundingClientRect()),
            viewport: toRect(viewport.getBoundingClientRect()),
            content: toRect(content.getBoundingClientRect()),
            selfHud: toRect(selfHud.getBoundingClientRect()),
            bottomGrid: toRect(bottomGrid.getBoundingClientRect()),
        };
    });
}

async function restoreArenaViewportPose(page: Page, originalStyle: string | null) {
    await page.evaluate((style) => {
        const content = document.querySelector<HTMLElement>('[data-testid="mage-wars-arena-viewport-content"]');
        if (!content) return;
        if (style === null) {
            content.removeAttribute('style');
        } else {
            content.setAttribute('style', style);
        }
        content.removeAttribute('data-e2e-direct-viewport-pose');
    }, originalStyle);
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
    test('单入口教程按玩家流程覆盖读局、计划、召唤、墙体、守卫、治疗和复原术', async ({ context, page }) => {
        test.setTimeout(240_000);
        const diagnostics = await openMageWarsTutorial(context, page);

        await waitForTutorialStep(page, 'intro', 60_000);
        await expect(page.getByTestId('tutorial-overlay-content')).toContainText('屹立不倒的法师');
        await expect(page.getByTestId('mage-wars-board')).not.toContainText('正式竞技场');
        await assertAllVisibleImagesLoaded(page);
        await screenshot(page, INTRO_SCREENSHOT_PATH);
        const hudBeforeMapPose = await page.evaluate(() => {
            const toRect = (rect: DOMRect): RectSnapshot => ({
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height,
            });
            const selfHud = document.querySelector<HTMLElement>('[data-testid="mage-wars-mage-hud-self"]');
            const bottomGrid = document.querySelector<HTMLElement>('[data-testid="mage-wars-bottom-viewport-grid"]');
            if (!selfHud || !bottomGrid) throw new Error('Mage Wars 拖拽地图截图缺少 HUD 锚点');
            return {
                selfHud: toRect(selfHud.getBoundingClientRect()),
                bottomGrid: toRect(bottomGrid.getBoundingClientRect()),
            };
        });
        const draggedMapPose = await setArenaViewportPoseForScreenshot(page);
        expect(draggedMapPose.transform).toContain('translate(');
        expect(draggedMapPose.transform).toContain('scale(');
        assertRectsNearlyEqual(draggedMapPose.viewport, draggedMapPose.board, 2);
        expect(draggedMapPose.content.left).toBeLessThanOrEqual(draggedMapPose.viewport.left + 2);
        expect(draggedMapPose.content.top).toBeLessThanOrEqual(draggedMapPose.viewport.top + 2);
        expect(draggedMapPose.content.right).toBeGreaterThanOrEqual(draggedMapPose.viewport.right - 2);
        expect(draggedMapPose.content.bottom).toBeGreaterThanOrEqual(draggedMapPose.viewport.bottom - 2);
        assertRectsNearlyEqual(draggedMapPose.selfHud, hudBeforeMapPose.selfHud, 1);
        assertRectsNearlyEqual(draggedMapPose.bottomGrid, hudBeforeMapPose.bottomGrid, 1);
        await screenshot(page, DRAGGED_MAP_SCREENSHOT_PATH);
        await restoreArenaViewportPose(page, draggedMapPose.originalStyle);
        await clickTutorialNext(page);

        await waitForTutorialStep(page, 'self-hud');
        await expect(page.getByTestId('tutorial-overlay-content')).toContainText('生命');
        await expect(page.getByTestId('tutorial-overlay-content')).toContainText('法力');
        await expect(page.getByTestId('tutorial-overlay-content')).toContainText('聚魔');
        await screenshot(page, HUD_SCREENSHOT_PATH);
        await clickTutorialNext(page);

        for (const stepId of ['opponent-hud', 'stage']) {
            await waitForTutorialStep(page, stepId);
            await clickTutorialNext(page);
        }

        await waitForTutorialStep(page, 'channel-result');
        await expect.poll(async () => (await readMageWarsState(page)).core?.players?.['0']?.mana).toBe(20);
        await screenshot(page, CHANNEL_RESULT_SCREENSHOT_PATH);
        await clickTutorialNext(page);

        await waitForTutorialStep(page, 'plan-wolf', 45_000);
        await expect.poll(async () => {
            const state = await readMageWarsState(page);
            return { phase: state.sys?.phase ?? null, phaseActorId: state.core?.phaseActorId ?? null };
        }, { timeout: 15_000 }).toEqual({ phase: 'planning', phaseActorId: '0' });
        await expect(page.getByTestId('mage-wars-desktop-spellbook-shelf')).toHaveAttribute('data-planning-enabled', 'true');
        await clickTutorialTarget(page, 'mw-spellbook-category-creature');
        await clickTutorialSpellbookCard(page, 2819);
        await expect(page.getByTestId('mage-wars-plan-spells')).toHaveAttribute('data-plan-progress', '1/2');
        await expect(page.getByTestId('mage-wars-plan-spells')).toContainText('1/2');
        await screenshot(page, PLAN_ONE_OF_TWO_SCREENSHOT_PATH);
        await clickTutorialTarget(page, 'mw-spellbook-category-incantation');
        await clickTutorialSpellbookCard(page, 3403);
        await expect(page.getByTestId('mage-wars-plan-spells')).toHaveAttribute('data-plan-progress', '2/2');
        await expect(page.getByTestId('mage-wars-plan-spells')).toContainText('2/2');
        await screenshot(page, PLAN_TWO_OF_TWO_SCREENSHOT_PATH);
        await clickTutorialTarget(page, 'mw-plan-spells');
        await waitForTutorialStep(page, 'prepared-and-hidden');
        await expect.poll(async () => (await readMageWarsState(page)).core?.players?.['0']?.preparedSpellCardIds).toEqual([
            2819,
            3403,
        ]);
        await expect(page.locator('[data-tutorial-id="mw-prepared-card-2819"]')).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('[data-tutorial-id="mw-prepared-card-3403"]')).toBeVisible({ timeout: 10_000 });
        await screenshot(page, PREPARED_HIDDEN_SCREENSHOT_PATH);
        await clickTutorialNext(page);

        await waitForTutorialStep(page, 'deploy-wolf');
        await clickTutorialTarget(page, 'mw-prepared-card-2819');
        await expect(page.locator('[data-tutorial-id="mw-zone-a3"][data-legal-target-zone="true"]')).toBeVisible({ timeout: 10_000 });
        await screenshot(page, SUMMON_TARGET_SCREENSHOT_PATH);
        await clickTutorialTarget(page, 'mw-zone-a3');
        await waitForTutorialStep(page, 'wolf-summoned');
        await expect.poll(async () => {
            const state = await readMageWarsState(page);
            const wolf = Object.values(state.core?.objects ?? {}).find((object) => object.sourceSpellCardId === 2819);
            return { zoneId: wolf?.zoneId ?? null, actionReady: wolf?.actionReady ?? null };
        }, { timeout: 15_000 }).toEqual({ zoneId: 'a3', actionReady: false });
        await expect(page.locator('[data-tutorial-id="mw-field-object-2819"]')).toBeVisible({ timeout: 10_000 });
        await screenshot(page, WOLF_SUMMONED_SCREENSHOT_PATH);
        await clickTutorialNext(page);

        await waitForTutorialStep(page, 'rouse-wolf');
        await clickTutorialTarget(page, 'mw-prepared-card-3403');
        await expect(page.locator('[data-tutorial-id="mw-field-object-2819"][data-field-card-role="target"]')).toBeVisible({ timeout: 10_000 });
        await screenshot(page, ROUSE_TARGET_SCREENSHOT_PATH);
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
        await screenshot(page, WOLF_READY_SCREENSHOT_PATH);
        await clickTutorialTarget(page, 'mw-turn-end');
        await waitForTutorialStateStep(page, 'opponent-deploy', 45_000);
        await expect.poll(async () => {
            const state = await readMageWarsState(page);
            return {
                phase: state.sys?.phase ?? null,
                phaseActorId: state.core?.phaseActorId ?? null,
            };
        }, { timeout: 15_000 }).toEqual({
            phase: 'deployment',
            phaseActorId: '1',
        });
        await screenshot(page, OPPONENT_DEPLOY_PROMPT_SCREENSHOT_PATH);
        await clickTutorialNext(page);

        await waitForTutorialStep(page, 'opponent-attack-spell');
        await expect.poll(async () => {
            const state = await readMageWarsState(page);
            const cleric = Object.values(state.core?.objects ?? {}).find((object) => object.sourceSpellCardId === 2811);
            return {
                zoneId: cleric?.zoneId ?? null,
                damaged: (cleric?.damage ?? 0) > 0,
                opponentDiscard: state.core?.players?.['1']?.discardSpellCardIds ?? [],
            };
        }, { timeout: 15_000 }).toEqual({
            zoneId: 'd1',
            damaged: true,
            opponentDiscard: [1706, 2811],
        });
        await clickTutorialNext(page);

        await waitForTutorialStep(page, 'discard-reading');
        await expect(page.locator('[data-tutorial-id="mw-discard"]')).toBeVisible({ timeout: 10_000 });
        await screenshot(page, DISCARD_SCREENSHOT_PATH);
        await clickTutorialNext(page);

        await waitForTutorialStateStep(page, 'opponent-pass-deployment', 45_000);
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
        await screenshot(page, OPPONENT_PASS_DEPLOYMENT_SCREENSHOT_PATH);
        await clickTutorialNext(page);

        await waitForTutorialStep(page, 'skip-initiative-quickcast', 45_000);
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
        await screenshot(page, QUICKCAST_PASS_SCREENSHOT_PATH);
        await clickTutorialTarget(page, 'mw-turn-end');

        await waitForTutorialStateStep(page, 'opponent-pass-initiative-quickcast', 45_000);
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
        await clickTutorialNext(page);

        await waitForTutorialStep(page, 'move-wolf', 45_000);
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
        await clickTutorialTarget(page, 'mw-field-object-2819');
        await expect(page.locator('[data-tutorial-id="mw-zone-a2"][data-legal-move-zone="true"]')).toBeVisible({ timeout: 10_000 });
        await clickTutorialTarget(page, 'mw-zone-a2');
        await waitForTutorialStep(page, 'finish');
        await expect.poll(async () => {
            const state = await readMageWarsState(page);
            const wolf = Object.values(state.core?.objects ?? {}).find((object) => object.sourceSpellCardId === 2819);
            return { zoneId: wolf?.zoneId ?? null, actionReady: wolf?.actionReady ?? null };
        }, { timeout: 15_000 }).toEqual({ zoneId: 'a2', actionReady: false });
        await screenshot(page, MOVE_SCREENSHOT_PATH);
        await finishSegmentAndWaitFor(page, 'wall-purpose');

        await expect(page.locator('[data-tutorial-id="mw-prepared-card-25700"]')).toBeVisible({ timeout: 15_000 });
        await expect.poll(async () => (await readMageWarsState(page)).core?.players?.['0']?.preparedSpellCardIds)
            .toEqual([25700]);
        await screenshot(page, WALL_READY_SCREENSHOT_PATH);
        await clickTutorialNext(page);

        await waitForTutorialStep(page, 'cast-thorns-wall');
        await clickTutorialTarget(page, 'mw-prepared-card-25700');
        const wallEdge = page.locator('[data-tutorial-id="mw-wall-edge-a3-b3"]');
        await expect(wallEdge).toBeVisible({ timeout: 10_000 });
        await expect(wallEdge).toHaveAttribute('data-legal-target-wall-edge', 'true', { timeout: 10_000 });
        await screenshot(page, WALL_TARGET_SCREENSHOT_PATH);
        await clickTutorialTarget(page, 'mw-wall-edge-a3-b3');

        await waitForTutorialStep(page, 'wall-card-on-edge');
        const wallCard = page.locator('[data-tutorial-id="mw-wall-card-25700"]');
        await expect(wallCard).toBeVisible({ timeout: 15_000 });
        await expect(wallCard).toHaveAttribute('data-source-card-id', '25700');
        await expect(wallCard).toHaveAttribute('data-wall-visual', 'spell-card');
        await expect(wallEdge).toHaveAttribute('data-wall-object', 'true', { timeout: 10_000 });
        await screenshot(page, WALL_CARD_SCREENSHOT_PATH);
        await clickTutorialNext(page);

        await waitForTutorialStep(page, 'line-of-sight-and-passage');
        await expect(page.getByTestId('tutorial-overlay-content')).toContainText('阻挡');
        await screenshot(page, WALL_LOS_SCREENSHOT_PATH);
        await finishSegmentAndWaitFor(page, 'guard-rule');

        await clickTutorialNext(page);
        await waitForTutorialStep(page, 'guard-cleric');
        await clickTutorialObject(page, GUARD_CLERIC_OBJECT_ID);
        const guardActionButton = page.locator('[data-tutorial-id="mw-selected-unit-guard"]');
        await expect(guardActionButton).toBeVisible({ timeout: 10_000 });
        await expect(guardActionButton).toHaveAttribute('data-action-kind', 'guard');
        await expect(guardActionButton).toHaveAttribute('data-action-visual', 'text-action');
        await expect(guardActionButton).toHaveAttribute('data-action-placement', 'source-card-below');
        await expect(guardActionButton).toContainText(/进行守卫|guard/i);
        await expect(guardActionButton.locator('img')).toHaveCount(0);
        await expect(guardActionButton.locator('svg')).toHaveCount(0);
        await expect(page.locator('[data-tutorial-id="mw-ability-action-dock"]').locator('[data-tutorial-id="mw-selected-unit-guard"]'))
            .toBeVisible();
        await screenshot(page, GUARD_SOURCE_SCREENSHOT_PATH);
        await clickTutorialTarget(page, 'mw-selected-unit-guard');
        await waitForTutorialStep(page, 'guard-token-result');
        await expect.poll(async () => (
            (await readMageWarsState(page)).core?.objects?.[GUARD_CLERIC_OBJECT_ID]?.guarding ?? false
        ), { timeout: 15_000 }).toBe(true);
        await screenshot(page, GUARD_RESULT_SCREENSHOT_PATH);
        await finishSegmentAndWaitFor(page, 'healing-rule');

        await clickTutorialNext(page);
        await waitForTutorialStep(page, 'heal-wounded-bobcat');
        const bobcatDamageBefore = await readMageWarsState(page)
            .then((state) => state.core?.objects?.[WOUNDED_BOBCAT_OBJECT_ID]?.damage ?? 0);
        await clickTutorialObject(page, HEALING_CLERIC_OBJECT_ID);
        await expect(page.locator('[data-tutorial-id="mw-ability-action-dock"]')).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('[data-tutorial-id="mw-ability-healing-light"]')).toBeVisible({ timeout: 10_000 });
        await screenshot(page, HEALING_BUTTON_SCREENSHOT_PATH);
        await clickTutorialTarget(page, 'mw-ability-healing-light');
        const woundedBobcat = page.locator(`[data-tutorial-object-id="mw-arena-object-${WOUNDED_BOBCAT_OBJECT_ID}"]`).first();
        await expect(woundedBobcat.locator('[data-testid="mage-wars-field-card-target-frame"]')).toBeVisible({ timeout: 10_000 });
        await screenshot(page, HEALING_TARGET_SCREENSHOT_PATH);
        await clickTutorialObject(page, WOUNDED_BOBCAT_OBJECT_ID);
        await waitForTutorialStep(page, 'healing-result-and-life-readout');
        await expect.poll(async () => (
            (await readMageWarsState(page)).core?.objects?.[WOUNDED_BOBCAT_OBJECT_ID]?.damage ?? 999
        ), { timeout: 15_000 }).toBeLessThan(bobcatDamageBefore);
        await screenshot(page, HEALING_RESULT_SCREENSHOT_PATH);
        await clickTutorialNext(page);

        await waitForTutorialStep(page, 'life-toggle');
        await clickTutorialTarget(page, 'mw-life-toggle');
        await expect(page.locator('[data-tutorial-id="mw-life-toggle"]')).toHaveAttribute('data-life-visible', 'true');
        await screenshot(page, LIFE_TOGGLE_SCREENSHOT_PATH);
        await finishSegmentAndWaitFor(page, 'burn-rule');

        await clickTutorialNext(page);
        await waitForTutorialStep(page, 'restore-burning-cleric');
        await clickTutorialTarget(page, 'mw-mage-entity-0');
        await expect(page.locator('[data-tutorial-id="mw-ability-restore"]')).toBeVisible({ timeout: 10_000 });
        await screenshot(page, RESTORE_BUTTON_SCREENSHOT_PATH);
        await clickTutorialTarget(page, 'mw-ability-restore');
        const burningCleric = page.locator(`[data-tutorial-object-id="mw-arena-object-${BURNING_CLERIC_OBJECT_ID}"]`).first();
        await expect(burningCleric.locator('[data-testid="mage-wars-field-card-target-frame"]')).toBeVisible({ timeout: 10_000 });
        await screenshot(page, RESTORE_TARGET_SCREENSHOT_PATH);
        await clickTutorialObject(page, BURNING_CLERIC_OBJECT_ID);
        await waitForTutorialStep(page, 'restore-result');
        await expect.poll(async () => (
            (await readMageWarsState(page)).core?.objects?.[BURNING_CLERIC_OBJECT_ID]?.statusTokens?.burn ?? 0
        ), { timeout: 15_000 }).toBe(0);
        await screenshot(page, RESTORE_RESULT_SCREENSHOT_PATH);

        await assertNoFatalFrontendErrors([{ label: 'mage-wars-tutorial-natural-flow', diagnostics }]);
    });
});
