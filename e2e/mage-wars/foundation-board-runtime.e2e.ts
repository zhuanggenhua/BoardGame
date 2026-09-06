import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    initContext,
    waitForFrontendAssets,
    waitForTestHarness,
} from '../helpers/common';

const SCREENSHOT_PATH = 'test-results/evidence-screenshots/mage-wars/foundation-board-runtime/e2e-desktop-board.png';
const DEFAULT_MAGE_SPACE_SCREENSHOT_PATH = 'test-results/evidence-screenshots/mage-wars/foundation-board-runtime/e2e-desktop-default-mage-space.png';
const SPELLBOOK_COPY_SELECTION_SCREENSHOT_PATH = 'test-results/evidence-screenshots/mage-wars/foundation-board-runtime/e2e-spellbook-copy-selection.png';
const ATTACK_SETTLEMENT_SCREENSHOT_PATH = 'test-results/evidence-screenshots/mage-wars/foundation-board-runtime/e2e-desktop-attack-settlement.png';
const SIX_PER_SIDE_LANE_WRAP_SCREENSHOT_PATH = 'test-results/evidence-screenshots/mage-wars/foundation-board-runtime/e2e-desktop-six-per-side-lane-wrap.png';
const MOBILE_SCREENSHOT_PATH = 'test-results/evidence-screenshots/mage-wars/foundation-board-runtime/e2e-mobile-landscape-board.png';
const DESKTOP_2560_SCREENSHOT_PATH = 'test-results/evidence-screenshots/mage-wars/foundation-board-runtime/e2e-desktop-2560x1304-board.png';
const DESKTOP_2560_PLANNING_HOVER_SCREENSHOT_PATH = 'test-results/evidence-screenshots/mage-wars/foundation-board-runtime/e2e-desktop-2560x1304-planning-hover.png';
const DESKTOP_2560_DRAGGED_MAP_SCREENSHOT_PATH = 'test-results/evidence-screenshots/mage-wars/foundation-board-runtime/e2e-desktop-2560x1304-map-dragged.png';

type MageWarsHarnessPlayer = {
    mageId: string;
    life: number;
    mageZoneId: string;
    damage: number;
    mana: number;
    channeling: number;
    actionReady: boolean;
    quickcastReady: boolean;
    guarding: boolean;
    spellbookCount: number;
    preparedSpellSlots: number;
    preparedSpellCardIds: number[];
    discardSpellCardIds: number[];
};

type MageWarsHarnessZone = {
    id: string;
    occupantIds: string[];
    objectIds?: string[];
    fieldCardIds?: number[];
    [key: string]: unknown;
};

type MageWarsHarnessState = {
    sys: {
        phase?: string;
        [key: string]: unknown;
    };
    core: {
        playerOrder: string[];
        currentPlayerId: string;
        turnNumber: number;
        players: Record<string, MageWarsHarnessPlayer>;
        arena: MageWarsHarnessZone[];
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

function parseViewportTransformPosition(transform: string): { x: number; y: number } {
    const match = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
    if (!match) return { x: 0, y: 0 };
    return {
        x: Number(match[1]),
        y: Number(match[2]),
    };
}

async function openMageWarsBoard(context: BrowserContext, page: Page, storageKey: string) {
    await initContext(context, {
        storageKey,
        skipImageGate: false,
        blockCdnAssets: false,
        locale: 'zh-CN',
    });
    const diagnostics = attachPageDiagnostics(page);

    await page.goto('/play/mage-wars', { waitUntil: 'domcontentloaded' });
    await waitForFrontendAssets(page, 45_000);
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});

    const board = page.getByTestId('mage-wars-board');
    await expect(board).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('mage-wars-arena-viewport')).toBeVisible();
    await expect(board).toContainText('兽王');
    await expect(board).toContainText('女祭司');
    await expect(board).toContainText('法术书');
    await expect(board).toContainText(/对手(已)?计划/);

    await page.waitForFunction(() => Array.from(document.images)
        .filter((image) => image.getBoundingClientRect().width > 10 && image.getBoundingClientRect().height > 10)
        .every((image) => image.naturalWidth > 0 && image.naturalHeight > 0), undefined, { timeout: 30_000 });

    return diagnostics;
}

async function auditMageWarsImages(page: Page, expectedVisibleAlts: string[] = []) {
    await page.waitForFunction(() => Array.from(document.images)
        .filter((image) => {
            const rect = image.getBoundingClientRect();
            return rect.width > 10 && rect.height > 10;
        })
        .every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0), undefined, { timeout: 30_000 });

    const imageAudit = await page.evaluate(() => {
        const images = Array.from(document.images).map((image) => {
            const rect = image.getBoundingClientRect();
            return {
                alt: image.alt,
                currentSrc: image.currentSrc || image.src,
                naturalWidth: image.naturalWidth,
                naturalHeight: image.naturalHeight,
                complete: image.complete,
                rect: {
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                },
            };
        });
        return {
            images,
            missingPixels: images.filter((image) => image.naturalWidth === 0 || image.naturalHeight === 0),
            viteOverlay: Boolean(document.querySelector('vite-error-overlay')),
        };
    });

    expect(imageAudit.viteOverlay).toBe(false);
    expect(imageAudit.missingPixels, JSON.stringify(imageAudit.missingPixels, null, 2)).toHaveLength(0);
    expect(imageAudit.images.some((image) => image.alt === '隐藏计划')).toBe(true);
    expectedVisibleAlts.forEach((expectedAlt) => {
        expect(
            imageAudit.images.some((image) => image.alt === expectedAlt),
            `缺少期望可见图片 alt="${expectedAlt}"；当前图片 alt=${JSON.stringify(imageAudit.images.map((image) => image.alt))}`,
        ).toBe(true);
    });

    return imageAudit;
}

async function visibleDesktopSpellbookCardIds(page: Page): Promise<string[]> {
    return page.locator('[data-testid="mage-wars-desktop-spellbook-card"]').evaluateAll((cards) => cards
        .map((card) => (card as HTMLElement).dataset.sourceCardId)
        .filter((cardId): cardId is string => cardId != null));
}

async function clickVisibleMageWarsFieldCard(page: Page, objectId: string) {
    const card = page.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${objectId}"]`);
    await expect(card).toBeVisible({ timeout: 5_000 });
    await card.evaluate((element) => {
        const lane = element.closest<HTMLElement>('[data-lane-owner-side]');
        if (lane) {
            lane.scrollTop = element.offsetTop - (lane.clientHeight / 2) + (element.clientHeight / 2);
        }
        element.scrollIntoView({ block: 'center', inline: 'center' });
    });
    const clickablePoint = await card.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const candidateRatios = [
            { x: 0.16, y: 0.5 },
            { x: 0.84, y: 0.5 },
            { x: 0.5, y: 0.5 },
            { x: 0.24, y: 0.28 },
            { x: 0.24, y: 0.72 },
            { x: 0.76, y: 0.28 },
            { x: 0.76, y: 0.72 },
        ];

        for (const ratio of candidateRatios) {
            const x = rect.left + rect.width * ratio.x;
            const y = rect.top + rect.height * ratio.y;
            const hit = document.elementFromPoint(x, y)
                ?.closest<HTMLElement>('[data-testid="mage-wars-zone-field-card"]');
            if (hit === element) {
                return { x, y };
            }
        }
        return null;
    });
    expect(clickablePoint, `${objectId} 必须有露出且可点击的牌面区域`).not.toBeNull();
    await page.mouse.click(clickablePoint!.x, clickablePoint!.y);
}

async function captureMageWarsSixPerSideLaneWrapScreenshot(page: Page) {
    await expect(page.getByTestId('mage-wars-selected-ability-action-dock')).toHaveCount(0);
    await expect(page.getByTestId('mage-wars-selected-unit-guard')).toHaveCount(0);

    const laneWrapAudit = await page.evaluate(() => {
        const toRect = (element: HTMLElement | null) => {
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

        return {
            selectedActionDockCount: document.querySelectorAll('[data-testid="mage-wars-selected-ability-action-dock"]').length,
            selectedGuardActionCount: document.querySelectorAll('[data-testid="mage-wars-selected-unit-guard"]').length,
            lanes: Array.from(document.querySelectorAll<HTMLElement>('[data-testid="mage-wars-zone-ownership-lanes"]'))
                .flatMap((laneGroup) => Array.from(laneGroup.querySelectorAll<HTMLElement>('[data-lane-owner-side]')).map((lane) => {
                    const style = window.getComputedStyle(lane);
                    return {
                        zoneId: laneGroup.dataset.zoneId ?? null,
                        ownerSide: lane.dataset.laneOwnerSide ?? null,
                        laneAxis: laneGroup.dataset.layoutAxis ?? null,
                        stackAxis: lane.dataset.laneStackAxis ?? null,
                        overflowMode: lane.dataset.laneOverflowMode ?? null,
                        maxRows: lane.dataset.laneMaxRows == null ? null : Number(lane.dataset.laneMaxRows),
                        className: lane.className,
                        overflowX: style.overflowX,
                        overflowY: style.overflowY,
                        rect: toRect(lane),
                        fieldCardCount: lane.querySelectorAll('[data-testid="mage-wars-zone-field-card"]').length,
                        mageEntityCount: lane.querySelectorAll('[data-testid="mage-wars-zone-mage-entity"]').length,
                        items: Array.from(lane.querySelectorAll<HTMLElement>('[data-testid="mage-wars-zone-lane-item"]')).map((item) => {
                            const itemStyle = window.getComputedStyle(item);
                            return {
                                kind: item.dataset.laneItemKind ?? null,
                                index: item.dataset.laneItemIndex == null ? null : Number(item.dataset.laneItemIndex),
                                ownerSide: lane.dataset.laneOwnerSide ?? null,
                                position: itemStyle.position,
                                marginTop: itemStyle.marginTop,
                                transform: itemStyle.transform,
                                rect: toRect(item),
                            };
                        }),
                    };
                }))
                .filter((lane) => lane.zoneId === 'a2' && lane.items.length > 0),
            fieldCards: Array.from(document.querySelectorAll<HTMLElement>('[data-testid="mage-wars-zone-field-card"]')).map((card) => {
                const rect = card.getBoundingClientRect();
                const zone = card.closest<HTMLElement>('[data-testid^="mage-wars-arena-zone-"]');
                return {
                    ownerSide: card.dataset.ownerSide ?? null,
                    zoneId: zone?.getAttribute('data-testid')?.replace('mage-wars-arena-zone-', '') ?? null,
                    rect: toRect(card),
                    centerX: rect.x + rect.width / 2,
                    centerY: rect.y + rect.height / 2,
                    aspectRatio: rect.height > 0 ? rect.width / rect.height : null,
                };
            }).filter((card) => card.zoneId === 'a2'),
        };
    });

    expect(laneWrapAudit.selectedActionDockCount).toBe(0);
    expect(laneWrapAudit.selectedGuardActionCount).toBe(0);
    expect(laneWrapAudit.fieldCards).toHaveLength(10);
    expect(laneWrapAudit.fieldCards.filter((card) => card.ownerSide === 'seat-left')).toHaveLength(5);
    expect(laneWrapAudit.fieldCards.filter((card) => card.ownerSide === 'seat-right')).toHaveLength(5);
    expect(laneWrapAudit.lanes).toHaveLength(2);
    expect(laneWrapAudit.lanes).toMatchObject([
        {
            zoneId: 'a2',
            ownerSide: 'seat-left',
            laneAxis: 'horizontal',
            stackAxis: 'vertical',
            overflowMode: 'wrap-columns',
            maxRows: 3,
            fieldCardCount: 5,
            mageEntityCount: 1,
        },
        {
            zoneId: 'a2',
            ownerSide: 'seat-right',
            laneAxis: 'horizontal',
            stackAxis: 'vertical',
            overflowMode: 'wrap-columns',
            maxRows: 3,
            fieldCardCount: 5,
            mageEntityCount: 1,
        },
    ]);

    type LaneItemRectAudit = {
        rect: {
            x: number;
            y: number;
            width: number;
            height: number;
            right: number;
            bottom: number;
        } | null;
    };
    const groupByApproximateColumn = <T extends LaneItemRectAudit>(items: T[]) => {
        const columns: T[][] = [];
        [...items]
            .filter((item) => item.rect != null)
            .sort((left, right) => left.rect!.x - right.rect!.x || left.rect!.y - right.rect!.y)
            .forEach((item) => {
                const centerX = item.rect!.x + item.rect!.width / 2;
                const existingColumn = columns.find((column) => {
                    const first = column[0];
                    if (!first?.rect) return false;
                    const firstCenterX = first.rect.x + first.rect.width / 2;
                    return Math.abs(firstCenterX - centerX) <= 8;
                });
                if (existingColumn) {
                    existingColumn.push(item);
                } else {
                    columns.push([item]);
                }
            });
        return columns;
    };
    const hasVisibleOverlap = (left: LaneItemRectAudit, right: LaneItemRectAudit) => {
        if (!left.rect || !right.rect) return false;
        return left.rect.x < right.rect.right - 1
            && left.rect.right > right.rect.x + 1
            && left.rect.y < right.rect.bottom - 1
            && left.rect.bottom > right.rect.y + 1;
    };
    const leftOwnerLane = laneWrapAudit.lanes.find((lane) => lane.ownerSide === 'seat-left');
    const rightOwnerLane = laneWrapAudit.lanes.find((lane) => lane.ownerSide === 'seat-right');
    expect(leftOwnerLane?.rect).not.toBeNull();
    expect(rightOwnerLane?.rect).not.toBeNull();
    const leftOwnerLaneCenterX = leftOwnerLane!.rect!.x + leftOwnerLane!.rect!.width / 2;
    const rightOwnerLaneCenterX = rightOwnerLane!.rect!.x + rightOwnerLane!.rect!.width / 2;
    expect(rightOwnerLaneCenterX - leftOwnerLaneCenterX, '同格必须先左右分 owner lane').toBeGreaterThan(40);

    laneWrapAudit.lanes.forEach((lane) => {
        expect(lane.className, `${lane.ownerSide} 压力态必须使用列换行布局`).toContain('grid-flow-col');
        expect(lane.overflowY, `${lane.ownerSide} 不得再用纵向滚动吞掉第 4+ 个单位`).toBe('visible');
        expect(lane.items).toHaveLength(6);
        lane.items.forEach((item) => {
            expect(item.rect, `${lane.ownerSide} 每个单位必须有可见矩形`).not.toBeNull();
            expect(item.position, `${lane.ownerSide} lane item 不得 absolute 压叠`).not.toBe('absolute');
            expect(item.transform, `${lane.ownerSide} lane item 不得 transform 错位压叠`).toBe('none');
            expect(Number.parseFloat(item.marginTop), `${lane.ownerSide} lane item 不得用负 margin 压叠`).toBeGreaterThanOrEqual(0);
        });
        const columns = groupByApproximateColumn(lane.items);
        expect(columns, `${lane.ownerSide} 六个单位必须自动换成两列`).toHaveLength(2);
        columns.forEach((column) => {
            expect(column.length, `${lane.ownerSide} 每列最多三个单位`).toBeLessThanOrEqual(3);
            const sortedColumn = [...column].sort((left, right) => left.rect!.y - right.rect!.y);
            sortedColumn.slice(1).forEach((item, index) => {
                const previous = sortedColumn[index];
                expect(item.rect!.y, `${lane.ownerSide} 同列单位必须上下排列且不重叠`).toBeGreaterThanOrEqual(previous.rect!.bottom - 1);
            });
        });
    });

    const allLaneItems = laneWrapAudit.lanes.flatMap((lane) => lane.items);
    allLaneItems.forEach((item, index) => {
        allLaneItems.slice(index + 1).forEach((other) => {
            expect(hasVisibleOverlap(item, other), '双方各六个单位不得互相重叠').toBe(false);
        });
    });
    laneWrapAudit.fieldCards.forEach((card) => {
        expect(card.rect).not.toBeNull();
        expect(card.rect!.width).toBeGreaterThan(100);
        expect(card.rect!.width).toBeLessThan(114);
        expect(card.rect!.height).toBeGreaterThan(142);
        expect(card.rect!.height).toBeLessThan(160);
        expect(card.aspectRatio).toBeGreaterThan(0.70);
        expect(card.aspectRatio).toBeLessThan(0.72);
    });

    await mkdir(dirname(SIX_PER_SIDE_LANE_WRAP_SCREENSHOT_PATH), { recursive: true });
    await page.screenshot({ path: SIX_PER_SIDE_LANE_WRAP_SCREENSHOT_PATH, fullPage: false });

    return laneWrapAudit;
}

async function expectMageWarsDefaultBrowseInteractions(page: Page) {
    const shelf = page.getByTestId('mage-wars-desktop-spellbook-shelf');
    await expect(shelf).toBeVisible({ timeout: 5_000 });
    await expect(shelf).toHaveAttribute('data-planning-enabled', 'false');

    const firstCard = page.locator('[data-testid="mage-wars-desktop-spellbook-card"][data-source-card-id]').first();
    await expect(firstCard).toBeVisible({ timeout: 5_000 });
    await expect(firstCard).toBeEnabled();
    await expect(firstCard).toHaveAttribute('data-browse-inspectable', 'true');
    const firstCardId = await firstCard.getAttribute('data-source-card-id');
    await firstCard.click();
    await expect(page.getByTestId('mage-wars-card-magnify-overlay')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('mage-wars-card-magnify-content')).toHaveAttribute('data-source-card-id', firstCardId ?? '');
    await page.getByTestId('mage-wars-card-magnify-overlay-close').click();
    await expect(page.getByTestId('mage-wars-card-magnify-overlay')).toBeHidden({ timeout: 5_000 });

    const beforeIds = await visibleDesktopSpellbookCardIds(page);
    const categoryIds = ['attack', 'enchantment', 'creature', 'incantation', 'equipment'];
    let changedCategoryId: string | null = null;
    let changedIds: string[] = [];
    for (const categoryId of categoryIds) {
        const categoryButton = page.getByTestId(`mage-wars-spellbook-category-${categoryId}`);
        await categoryButton.click();
        const nextIds = await visibleDesktopSpellbookCardIds(page);
        if (nextIds.length > 0 && nextIds.join('|') !== beforeIds.join('|')) {
            changedCategoryId = categoryId;
            changedIds = nextIds;
            break;
        }
    }
    expect(changedCategoryId, '至少一个法术书分类标签必须真实改变可见卡牌集合').not.toBeNull();
    await expect(page.getByTestId(`mage-wars-spellbook-category-${changedCategoryId}`)).toHaveAttribute('aria-pressed', 'true');
    expect(changedIds).not.toEqual(beforeIds);

    await page.getByTestId('mage-wars-spellbook-category-all').click();
    await expect(page.getByTestId('mage-wars-spellbook-category-all')).toHaveAttribute('aria-pressed', 'true');
}

async function expectMageWarsArenaFreeViewport(
    page: Page,
    options: { verifySpellbookInspectAfterDrag?: boolean; dragScreenshotPath?: string } = {},
) {
    const verifySpellbookInspectAfterDrag = options.verifySpellbookInspectAfterDrag ?? true;
    const viewport = page.getByTestId('mage-wars-arena-viewport');
    const content = page.getByTestId('mage-wars-arena-viewport-content');
    await expect(viewport).toBeVisible({ timeout: 5_000 });
    await expect(content).toBeVisible({ timeout: 5_000 });

    const defaultAudit = await page.evaluate(() => {
        const viewportElement = document.querySelector<HTMLElement>('[data-testid="mage-wars-arena-viewport"]');
        const shellElement = document.querySelector<HTMLElement>('[data-testid="mage-wars-arena-viewport-shell"]');
        const contentElement = document.querySelector<HTMLElement>('[data-testid="mage-wars-arena-viewport-content"]');
        const bottomGridElement = document.querySelector<HTMLElement>('[data-testid="mage-wars-bottom-viewport-grid"]');
        const arenaZones = Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="mage-wars-arena-zone-"]'));
        const viewportRect = viewportElement?.getBoundingClientRect();
        const shellRect = shellElement?.getBoundingClientRect();
        const contentRect = contentElement?.getBoundingClientRect();
        const bottomGridRect = bottomGridElement?.getBoundingClientRect();
        if (!viewportRect || !shellRect || !contentRect) return null;
        const tolerance = 2;
        const zoneDetails = arenaZones.map((zone) => {
            const rect = zone.getBoundingClientRect();
            return {
                zoneId: zone.getAttribute('data-testid')?.replace('mage-wars-arena-zone-', '') ?? '',
                insideViewport: rect.left >= viewportRect.left - tolerance
                    && rect.top >= viewportRect.top - tolerance
                    && rect.right <= viewportRect.right + tolerance
                    && rect.bottom <= viewportRect.bottom + tolerance,
                aboveBottomUi: !bottomGridRect || rect.bottom <= bottomGridRect.top + tolerance,
            };
        });
        const scaleMatch = contentElement.style.transform.match(/scale\(([^)]+)\)/);
        return {
            windowWidth: window.innerWidth,
            windowHeight: window.innerHeight,
            shellLeft: shellRect.left,
            shellTop: shellRect.top,
            shellRight: shellRect.right,
            shellBottom: shellRect.bottom,
            shellWidth: shellRect.width,
            shellHeight: shellRect.height,
            shellRatio: shellRect.width / shellRect.height,
            contentWidth: contentRect.width,
            contentHeight: contentRect.height,
            contentRatio: contentRect.width / contentRect.height,
            viewportWidth: viewportRect.width,
            viewportHeight: viewportRect.height,
            contentCoversViewport: contentRect.left <= viewportRect.left + tolerance
                && contentRect.top <= viewportRect.top + tolerance
                && contentRect.right >= viewportRect.right - tolerance
                && contentRect.bottom >= viewportRect.bottom - tolerance,
            transform: contentElement.style.transform,
            scale: scaleMatch ? Number(scaleMatch[1]) : 1,
            zoneIds: zoneDetails.map((zone) => zone.zoneId).sort(),
            zonesOutsideViewport: zoneDetails.filter((zone) => !zone.insideViewport).map((zone) => zone.zoneId),
            zonesBehindBottomUi: zoneDetails.filter((zone) => !zone.aboveBottomUi).map((zone) => zone.zoneId),
        };
    });
    expect(defaultAudit, '默认地图验收必须能读取视窗、地图和区域尺寸').not.toBeNull();
    expect(Math.abs(defaultAudit!.shellLeft), '竞技场视窗左边必须贴齐屏幕，不能藏在 16:9 内框里').toBeLessThanOrEqual(1);
    expect(Math.abs(defaultAudit!.shellTop), '竞技场视窗上边必须贴齐屏幕，不能藏在 16:9 内框里').toBeLessThanOrEqual(1);
    expect(defaultAudit!.shellRight, '竞技场视窗右边必须贴齐屏幕，不能留下外层黑带').toBeGreaterThanOrEqual(defaultAudit!.windowWidth - 1);
    expect(defaultAudit!.shellBottom, '竞技场视窗下边必须贴齐屏幕，不能留下外层黑带').toBeGreaterThanOrEqual(defaultAudit!.windowHeight - 1);
    expect(defaultAudit!.shellRatio, '竞技场视窗不能再是 4:3 小框，必须占用整块牌桌地图层').toBeGreaterThan(1.7);
    expect(Math.abs(defaultAudit!.contentRatio - 4 / 3), '默认地图必须保持正式竞技场比例').toBeLessThanOrEqual(0.01);
    expect(defaultAudit!.contentWidth, '默认地图内容宽度必须覆盖真实视口，不能被底部 HUD 避让压成中间小框').toBeGreaterThanOrEqual(defaultAudit!.viewportWidth - 2);
    expect(defaultAudit!.contentHeight, '默认地图内容高度必须覆盖真实视口，不能被底部 HUD 避让压成中间小框').toBeGreaterThanOrEqual(defaultAudit!.viewportHeight - 2);
    expect(defaultAudit!.contentCoversViewport, '默认地图内容必须铺满真实视窗，不能露出外层黑框').toBe(true);
    expect(defaultAudit!.zoneIds).toEqual(['a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'c1', 'c2', 'c3', 'd1', 'd2', 'd3']);

    await viewport.hover();
    for (let wheelIndex = 0; wheelIndex < 14; wheelIndex += 1) {
        await page.mouse.wheel(0, -240);
    }
    await expect.poll(async () => content.evaluate((element) => {
        const transform = (element as HTMLElement).style.transform;
        const match = transform.match(/scale\(([^)]+)\)/);
        return match ? Number(match[1]) : 1;
    })).toBeGreaterThan(defaultAudit!.scale);

    const beforeDragTransform = await content.evaluate((element) => (element as HTMLElement).style.transform);
    const box = await viewport.boundingBox();
    expect(box, '竞技场自由视窗必须有可操作区域').not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2 + 120, box!.y + box!.height / 2 + 60, { steps: 4 });
    await page.mouse.up();
    await expect.poll(async () => content.evaluate((element) => (element as HTMLElement).style.transform))
        .not.toBe(beforeDragTransform);
    const afterDragTransform = await content.evaluate((element) => (element as HTMLElement).style.transform);
    const beforeDragPosition = parseViewportTransformPosition(beforeDragTransform);
    const afterDragPosition = parseViewportTransformPosition(afterDragTransform);
    expect(
        Math.abs(afterDragPosition.x - beforeDragPosition.x),
        `放大拖拽必须产生横向位移，不能只上下移动: ${beforeDragTransform} -> ${afterDragTransform}`,
    ).toBeGreaterThan(30);
    expect(
        Math.abs(afterDragPosition.y - beforeDragPosition.y),
        `放大拖拽必须产生纵向位移: ${beforeDragTransform} -> ${afterDragTransform}`,
    ).toBeGreaterThan(20);

    const zoomedDragAudit = await page.evaluate(() => {
        const viewportElement = document.querySelector<HTMLElement>('[data-testid="mage-wars-arena-viewport"]');
        const contentElement = document.querySelector<HTMLElement>('[data-testid="mage-wars-arena-viewport-content"]');
        const viewportRect = viewportElement?.getBoundingClientRect();
        const contentRect = contentElement?.getBoundingClientRect();
        if (!viewportRect || !contentRect) return null;
        const tolerance = 2;
        return {
            contentWidth: contentRect.width,
            contentHeight: contentRect.height,
            viewportWidth: viewportRect.width,
            viewportHeight: viewportRect.height,
            contentCoversViewport: contentRect.left <= viewportRect.left + tolerance
                && contentRect.top <= viewportRect.top + tolerance
                && contentRect.right >= viewportRect.right - tolerance
                && contentRect.bottom >= viewportRect.bottom - tolerance,
        };
    });
    expect(zoomedDragAudit, '放大拖拽后必须能读取视窗和地图内容尺寸').not.toBeNull();
    expect(zoomedDragAudit!.contentWidth, '放大后地图内容宽度不能小于视窗，否则会露出外层黑框').toBeGreaterThanOrEqual(zoomedDragAudit!.viewportWidth - 2);
    expect(zoomedDragAudit!.contentHeight, '放大后地图内容高度不能小于视窗，否则会露出外层黑框').toBeGreaterThanOrEqual(zoomedDragAudit!.viewportHeight - 2);
    expect(zoomedDragAudit!.contentCoversViewport, '放大拖拽后地图内容仍必须覆盖视窗，不能露出外层黑框').toBe(true);

    if (options.dragScreenshotPath) {
        await mkdir(dirname(options.dragScreenshotPath), { recursive: true });
        await page.screenshot({ path: options.dragScreenshotPath, fullPage: false });
    }

    if (!verifySpellbookInspectAfterDrag) {
        const arenaHotZoneAudit = await page.evaluate(() => {
            const arenaViewport = document.querySelector<HTMLElement>('[data-testid="mage-wars-arena-viewport"]');
            const contentElement = document.querySelector<HTMLElement>('[data-testid="mage-wars-arena-viewport-content"]');
            const arenaZones = Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="mage-wars-arena-zone-"]'));
            const toPoint = (element: HTMLElement | null) => {
                if (!element) return null;
                const rect = element.getBoundingClientRect();
                return {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                };
            };
            const viewportRect = arenaViewport?.getBoundingClientRect();
            const visibleZoneHitCandidate = viewportRect
                ? arenaZones.flatMap((zone) => {
                    const zoneRect = zone.getBoundingClientRect();
                    const intersection = Math.min(viewportRect.right, zoneRect.right) > Math.max(viewportRect.left, zoneRect.left)
                        && Math.min(viewportRect.bottom, zoneRect.bottom) > Math.max(viewportRect.top, zoneRect.top)
                        ? {
                            left: Math.max(viewportRect.left, zoneRect.left),
                            top: Math.max(viewportRect.top, zoneRect.top),
                            right: Math.min(viewportRect.right, zoneRect.right),
                            bottom: Math.min(viewportRect.bottom, zoneRect.bottom),
                        }
                        : null;
                    if (!intersection) return [];
                    return [0.2, 0.35, 0.5, 0.65, 0.8].flatMap((xRatio) => (
                        [0.2, 0.35, 0.5, 0.65, 0.8].map((yRatio) => ({
                            x: intersection.left + (intersection.right - intersection.left) * xRatio,
                            y: intersection.top + (intersection.bottom - intersection.top) * yRatio,
                        }))
                    )).map((point) => {
                        const hit = document.elementFromPoint(point.x, point.y);
                        return {
                            point,
                            hitTestId: hit?.closest<HTMLElement>('[data-testid]')?.dataset.testid ?? null,
                            zoneTestId: hit?.closest<HTMLElement>('[data-testid^="mage-wars-arena-zone-"]')
                                ?.getAttribute('data-testid') ?? null,
                        };
                    });
                }).find((candidate) => candidate.zoneTestId?.startsWith('mage-wars-arena-zone-')) ?? null
                : null;
            const entityZoneAttached = Array.from(document.querySelectorAll<HTMLElement>(
                '[data-testid="mage-wars-zone-field-card"], [data-testid="mage-wars-zone-mage-entity"]',
            )).some((entity) => {
                const zone = entity.closest<HTMLElement>('[data-testid^="mage-wars-arena-zone-"]');
                if (!zone) return false;
                const point = toPoint(entity);
                const zoneRect = zone.getBoundingClientRect();
                return point != null
                    && point.x >= zoneRect.left
                    && point.x <= zoneRect.right
                    && point.y >= zoneRect.top
                    && point.y <= zoneRect.bottom;
            });
            return {
                transform: contentElement?.style.transform ?? '',
                viewportVisible: Boolean(arenaViewport),
                visibleZoneHitTestId: visibleZoneHitCandidate?.zoneTestId ?? null,
                visibleZoneHitCandidate,
                entityZoneAttached,
            };
        });
        expect(arenaHotZoneAudit.viewportVisible).toBe(true);
        expect(arenaHotZoneAudit.transform).toContain('scale(');
        expect(
            arenaHotZoneAudit.visibleZoneHitTestId,
            `拖拽放大后可见竞技场格必须仍有真实无遮挡热区: ${JSON.stringify(arenaHotZoneAudit)}`,
        ).toMatch(/^mage-wars-arena-zone-/);
        expect(arenaHotZoneAudit.entityZoneAttached).toBe(true);
        return;
    }

    const spellbookCard = page.locator('[data-testid="mage-wars-desktop-spellbook-card"][data-source-card-id]').first();
    await spellbookCard.click();
    await expect(page.getByTestId('mage-wars-card-magnify-overlay')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('mage-wars-card-magnify-overlay-close').click();
    await expect(page.getByTestId('mage-wars-card-magnify-overlay')).toBeHidden({ timeout: 5_000 });
}

async function expectMageWarsDesktop2560Layout(page: Page) {
    const layoutAudit = await page.evaluate(() => {
        const toRect = (element: HTMLElement | null) => {
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
        const rects = {
            board: toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-board"]')),
            arenaStage: toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-arena-stage"]')),
            arenaViewport: toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-arena-viewport"]')),
            hudAnchorLayer: toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-hud-anchor-layer"]')),
            bottomViewportGrid: toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-bottom-viewport-grid"]')),
            lifeToggle: toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-life-toggle"]')),
            selfHud: toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-mage-hud-self"]')),
            opponentHud: toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-mage-hud-opponent"]')),
            opponentPreparedMirror: toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-opponent-prepared-mirror"]')),
            spellbookShelf: toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-desktop-spellbook-shelf"]')),
            preparedArea: toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-desktop-prepared-spells"]')),
            preparedCard: toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-desktop-prepared-card"]')),
            discardPile: toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-discard-pile"]')),
            turnEnd: toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-turn-end"]')),
            previousPage: toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-spellbook-previous-page"]')),
            nextPage: toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-spellbook-next-page"]')),
            firstSpellbookCard: toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-desktop-spellbook-card"]')),
            lastSpellbookCard: toRect(Array.from(
                document.querySelectorAll<HTMLElement>('[data-testid="mage-wars-desktop-spellbook-card"]'),
            ).at(-1) ?? null),
        };
        const categoryButtons = ['all', 'attack', 'enchantment', 'creature', 'incantation', 'equipment'].map((id) => ({
            id,
            rect: toRect(document.querySelector<HTMLElement>(`[data-testid="mage-wars-spellbook-category-${id}"]`)),
            pressed: document.querySelector<HTMLElement>(`[data-testid="mage-wars-spellbook-category-${id}"]`)
                ?.getAttribute('aria-pressed') ?? null,
        }));
        const arenaZones = Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="mage-wars-arena-zone-"]'))
            .map((zone) => {
                const rect = toRect(zone);
                return {
                    zoneId: zone.getAttribute('data-testid')?.replace('mage-wars-arena-zone-', '') ?? null,
                    rect,
                    insideViewport: Boolean(rect
                        && rect.x >= -2
                        && rect.y >= -2
                        && rect.right <= window.innerWidth + 2
                        && rect.bottom <= window.innerHeight + 2),
                    aboveBottomUi: Boolean(rects.bottomViewportGrid == null || (rect && rect.bottom <= rects.bottomViewportGrid.y + 2)),
                };
            });
        const boardCenterX = rects.board ? rects.board.x + rects.board.width / 2 : null;
        const arenaStageCenterDelta = rects.arenaStage && boardCenterX != null
            ? Math.abs(rects.arenaStage.x + rects.arenaStage.width / 2 - boardCenterX)
            : null;
        const lifeToggleLeftGap = rects.lifeToggle && rects.board
            ? rects.lifeToggle.x - rects.board.x
            : null;
        const pageRailGap = rects.lastSpellbookCard && rects.previousPage && rects.nextPage
            ? Math.min(rects.previousPage.x, rects.nextPage.x) - rects.lastSpellbookCard.right
            : null;
        return {
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
            },
            document: {
                scrollWidth: document.documentElement.scrollWidth,
                scrollHeight: document.documentElement.scrollHeight,
            },
            rects,
            hudAnchorLayoutSource: document
                .querySelector<HTMLElement>('[data-testid="mage-wars-hud-anchor-layer"]')
                ?.getAttribute('data-mage-wars-layout-source') ?? null,
            bottomGridLayoutSource: document
                .querySelector<HTMLElement>('[data-testid="mage-wars-bottom-viewport-grid"]')
                ?.getAttribute('data-mage-wars-layout-source') ?? null,
            legacyScaledHudLayerCount: document.querySelectorAll('[data-mage-wars-layout-source="desktop-scaled"]').length,
            categoryButtons,
            arenaZones,
            arenaStageCenterDelta,
            lifeToggleLeftGap,
            pageRailGap,
            overlaps: [
                { name: 'spellbook-prepared', value: intersects(rects.spellbookShelf, rects.preparedArea) },
                { name: 'spellbook-discard', value: intersects(rects.spellbookShelf, rects.discardPile) },
                { name: 'spellbook-turn-end', value: intersects(rects.spellbookShelf, rects.turnEnd) },
                { name: 'prepared-turn-end', value: intersects(rects.preparedArea, rects.turnEnd) },
            ],
        };
    });

    expect(layoutAudit.viewport).toEqual({ width: 2560, height: 1304 });
    expect(layoutAudit.document.scrollWidth).toBeLessThanOrEqual(layoutAudit.viewport.width + 2);
    expect(layoutAudit.document.scrollHeight).toBeLessThanOrEqual(layoutAudit.viewport.height + 2);
    expect(layoutAudit.rects.arenaStage, 'arenaStage must render as the draggable map scene').not.toBeNull();
    expect(layoutAudit.rects.arenaStage!.width, '默认地图内容必须可见').toBeGreaterThan(0);
    expect(layoutAudit.rects.arenaStage!.height, '默认地图内容必须可见').toBeGreaterThan(0);
    expect(Math.abs(layoutAudit.rects.arenaStage!.width / layoutAudit.rects.arenaStage!.height - 4 / 3), '默认地图必须保持正式竞技场比例').toBeLessThanOrEqual(0.01);
    expect(layoutAudit.rects.arenaViewport!.x, 'arena viewport must start at the screen left edge').toBeLessThanOrEqual(1);
    expect(layoutAudit.rects.arenaViewport!.y, 'arena viewport must start at the screen top edge').toBeLessThanOrEqual(1);
    expect(layoutAudit.rects.arenaViewport!.width, 'arena viewport must fill the wide desktop width').toBeGreaterThanOrEqual(layoutAudit.viewport.width - 2);
    expect(layoutAudit.rects.arenaViewport!.height, 'arena viewport must fill the wide desktop height').toBeGreaterThanOrEqual(layoutAudit.viewport.height - 2);
    expect(layoutAudit.rects.arenaStage!.x, '默认地图内容必须覆盖真实视口左边，不得缩在中间框').toBeLessThanOrEqual(1);
    expect(layoutAudit.rects.arenaStage!.y, '默认地图内容必须覆盖真实视口顶部，不得缩在中间框').toBeLessThanOrEqual(1);
    expect(layoutAudit.rects.arenaStage!.right, '默认地图内容必须覆盖真实视口右边').toBeGreaterThanOrEqual(layoutAudit.viewport.width - 1);
    expect(layoutAudit.rects.arenaStage!.bottom, '默认地图内容必须覆盖真实视口底部，底部 UI 作为叠加层而不是地图裁剪边界').toBeGreaterThanOrEqual(layoutAudit.viewport.height - 1);
    expect(layoutAudit.arenaZones.map((zone) => zone.zoneId).sort()).toEqual(['a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'c1', 'c2', 'c3', 'd1', 'd2', 'd3']);

    const screenBoundRects = [
        ['board', layoutAudit.rects.board],
        ['arenaViewport', layoutAudit.rects.arenaViewport],
        ['hudAnchorLayer', layoutAudit.rects.hudAnchorLayer],
        ['bottomViewportGrid', layoutAudit.rects.bottomViewportGrid],
        ['lifeToggle', layoutAudit.rects.lifeToggle],
        ['selfHud', layoutAudit.rects.selfHud],
        ['opponentHud', layoutAudit.rects.opponentHud],
        ['opponentPreparedMirror', layoutAudit.rects.opponentPreparedMirror],
        ['spellbookShelf', layoutAudit.rects.spellbookShelf],
        ['preparedArea', layoutAudit.rects.preparedArea],
        ['preparedCard', layoutAudit.rects.preparedCard],
        ['discardPile', layoutAudit.rects.discardPile],
        ['turnEnd', layoutAudit.rects.turnEnd],
        ['previousPage', layoutAudit.rects.previousPage],
        ['nextPage', layoutAudit.rects.nextPage],
        ['firstSpellbookCard', layoutAudit.rects.firstSpellbookCard],
        ['lastSpellbookCard', layoutAudit.rects.lastSpellbookCard],
    ] as const;
    screenBoundRects.forEach(([name, rect]) => {
        expect(rect, `${name} must be visible in 2560x1304`).not.toBeNull();
        expect(rect!.width, `${name} width`).toBeGreaterThan(0);
        expect(rect!.height, `${name} height`).toBeGreaterThan(0);
        expect(rect!.x, `${name} left`).toBeGreaterThanOrEqual(-1);
        expect(rect!.y, `${name} top`).toBeGreaterThanOrEqual(-1);
        expect(rect!.right, `${name} right`).toBeLessThanOrEqual(layoutAudit.viewport.width + 1);
        expect(rect!.bottom, `${name} bottom`).toBeLessThanOrEqual(layoutAudit.viewport.height + 1);
    });
    expect(layoutAudit.hudAnchorLayoutSource).toBe('viewport-anchored');
    expect(layoutAudit.bottomGridLayoutSource).toBe('viewport-grid-anchored');
    expect(layoutAudit.legacyScaledHudLayerCount).toBe(0);
    expect(layoutAudit.rects.hudAnchorLayer!.x, '玩家界面锚点层必须贴齐屏幕左边，不能套 16:9 内框').toBeLessThanOrEqual(1);
    expect(layoutAudit.rects.hudAnchorLayer!.y, '玩家界面锚点层必须贴齐屏幕顶部，不能套 16:9 内框').toBeLessThanOrEqual(1);
    expect(layoutAudit.rects.hudAnchorLayer!.right, '玩家界面锚点层必须覆盖屏幕右边').toBeGreaterThanOrEqual(layoutAudit.viewport.width - 1);
    expect(layoutAudit.rects.hudAnchorLayer!.bottom, '玩家界面锚点层必须覆盖屏幕底部').toBeGreaterThanOrEqual(layoutAudit.viewport.height - 1);
    const bottomViewportGridGap = layoutAudit.viewport.height - layoutAudit.rects.bottomViewportGrid!.bottom;
    expect(bottomViewportGridGap, '底部法术书牌列和计划区必须锚到真实视口底部，并保留少量安全空隙').toBeGreaterThanOrEqual(6);
    expect(bottomViewportGridGap, '底部法术书牌列和计划区不能被整体上移成底部空带').toBeLessThanOrEqual(16);
    layoutAudit.categoryButtons.forEach((category) => {
        expect(category.rect, `${category.id} category tab`).not.toBeNull();
        expect(category.rect!.width).toBeGreaterThanOrEqual(44);
        expect(category.rect!.height).toBeGreaterThanOrEqual(24);
    });
    const centerDebug = JSON.stringify({
        board: layoutAudit.rects.board,
        arenaStage: layoutAudit.rects.arenaStage,
        arenaStageCenterDelta: layoutAudit.arenaStageCenterDelta,
    });
    expect(layoutAudit.arenaStageCenterDelta, centerDebug).not.toBeNull();
    expect(layoutAudit.arenaStageCenterDelta!, centerDebug).toBeLessThanOrEqual(3);
    expect(layoutAudit.lifeToggleLeftGap).not.toBeNull();
    expect(layoutAudit.lifeToggleLeftGap!).toBeGreaterThanOrEqual(0);
    expect(layoutAudit.lifeToggleLeftGap!).toBeLessThanOrEqual(160);
    expect(Math.abs(layoutAudit.rects.spellbookShelf!.bottom - layoutAudit.rects.preparedArea!.bottom)).toBeLessThanOrEqual(3);
    expect(Math.abs(layoutAudit.rects.firstSpellbookCard!.bottom - layoutAudit.rects.preparedCard!.bottom)).toBeLessThanOrEqual(3);
    expect(layoutAudit.rects.selfHud!.x, '己方 HUD 必须留在左半区，但要避开竞技场首列实体').toBeGreaterThanOrEqual(layoutAudit.viewport.width * 0.24);
    expect(layoutAudit.rects.selfHud!.x, '己方 HUD 不得漂到中场或右侧玩家区').toBeLessThanOrEqual(layoutAudit.viewport.width * 0.36);
    expect(layoutAudit.rects.selfHud!.y, '己方 HUD 必须在左下独立层，不应回到左上角').toBeGreaterThan(layoutAudit.viewport.height * 0.25);
    expect(layoutAudit.rects.selfHud!.bottom, '己方 HUD 应靠近左下桌面区，而不是顶部 HUD 带').toBeGreaterThan(layoutAudit.viewport.height * 0.55);
    expect(layoutAudit.rects.selfHud!.bottom, '己方 HUD 必须离开底部牌区，不能再占法术书列宽度').toBeLessThan(layoutAudit.rects.bottomViewportGrid!.y);
    expect(layoutAudit.rects.opponentHud!.right).toBeGreaterThanOrEqual(layoutAudit.viewport.width - 20);
    expect(layoutAudit.rects.opponentHud!.y).toBeLessThanOrEqual(80);
    expect(layoutAudit.rects.opponentPreparedMirror!.x, '对手已计划卡背必须在右上对手 HUD 左侧，不应留在左上角').toBeGreaterThan(layoutAudit.viewport.width * 0.5);
    expect(layoutAudit.rects.opponentPreparedMirror!.right).toBeLessThanOrEqual(layoutAudit.rects.opponentHud!.x);
    expect(Math.abs(layoutAudit.rects.opponentPreparedMirror!.y - layoutAudit.rects.opponentHud!.y)).toBeLessThanOrEqual(3);
    expect(layoutAudit.rects.spellbookShelf!.x).toBeLessThanOrEqual(24);
    expect(layoutAudit.pageRailGap).not.toBeNull();
    expect(layoutAudit.pageRailGap!).toBeGreaterThanOrEqual(0);
    expect(layoutAudit.pageRailGap!).toBeLessThanOrEqual(160);
    expect(layoutAudit.rects.firstSpellbookCard!.height).toBeGreaterThanOrEqual(220);
    expect(layoutAudit.rects.firstSpellbookCard!.width).toBeGreaterThanOrEqual(150);
    layoutAudit.overlaps.forEach((overlap) => {
        expect(overlap.value, `2560x1304 protected UI overlap: ${overlap.name}`).toBe(false);
    });
}

async function findVisibleDuplicateSpellbookCard(page: Page): Promise<{ cardId: string; copyCount: string }> {
    for (let pageIndex = 0; pageIndex < 12; pageIndex += 1) {
        const duplicate = await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="mage-wars-desktop-spellbook-card"][data-source-card-id]'));
            const card = cards.find((candidate) => Number(candidate.dataset.copyCount ?? 0) > 1);
            return card?.dataset.sourceCardId && card.dataset.copyCount
                ? { cardId: card.dataset.sourceCardId, copyCount: card.dataset.copyCount }
                : null;
        });
        if (duplicate) return duplicate;

        const nextPage = page.getByTestId('mage-wars-spellbook-next-page');
        if (await nextPage.isDisabled()) break;
        await nextPage.click();
    }
    throw new Error('mage-wars planning spellbook did not expose any duplicate-copy spell card');
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
    await expect(page.getByTestId('mage-wars-spellbook-next-page')).toBeEnabled();
}

async function applyMageWarsSaturatedState(page: Page) {
    await waitForTestHarness(page, 10_000);
    await page.evaluate(() => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: MageWarsHarness;
        }).__BG_TEST_HARNESS__;
        const snapshot = harness?.state?.get?.();
        if (!snapshot || !harness?.state?.set) {
            throw new Error('mage-wars test harness state injector unavailable');
        }

        const next = structuredClone(snapshot);
        const [selfId, opponentId] = next.core.playerOrder;
        if (!selfId || !opponentId) {
            throw new Error('mage-wars saturated state requires two players');
        }

        next.sys = {
            ...next.sys,
            phase: 'creatureAction',
        };
        const pressureObjects = [
            { id: 'mw-test-red-hellion', ownerId: selfId, sourceSpellCardId: 2803, sourceObjectId: 'spell-2803', name: '烈焰狱鬼' },
            { id: 'mw-test-red-imp', ownerId: selfId, sourceSpellCardId: 2801, sourceObjectId: 'spell-2801', name: '火烙魔婴' },
            { id: 'mw-test-red-archer', ownerId: selfId, sourceSpellCardId: 2816, sourceObjectId: 'spell-2816', name: '皇家弓手' },
            { id: 'mw-test-red-angel', ownerId: selfId, sourceSpellCardId: 2907, sourceObjectId: 'spell-2907', name: '灰天使' },
            { id: 'mw-test-red-creature', ownerId: selfId, sourceSpellCardId: 2802, sourceObjectId: 'spell-2802', name: '己方生物' },
            { id: 'mw-test-blue-knight', ownerId: opponentId, sourceSpellCardId: 2909, sourceObjectId: 'spell-2909', name: '西锁骑士' },
            { id: 'mw-test-blue-angel', ownerId: opponentId, sourceSpellCardId: 2907, sourceObjectId: 'spell-2907', name: '对方灰天使' },
            { id: 'mw-test-blue-archer', ownerId: opponentId, sourceSpellCardId: 2816, sourceObjectId: 'spell-2816', name: '对方皇家弓手' },
            { id: 'mw-test-blue-creature', ownerId: opponentId, sourceSpellCardId: 2802, sourceObjectId: 'spell-2802', name: '对方生物' },
            { id: 'mw-test-blue-imp', ownerId: opponentId, sourceSpellCardId: 2801, sourceObjectId: 'spell-2801', name: '对方火烙魔婴' },
        ].map((object, index) => ({
            ...object,
            kind: 'creature',
            zoneId: 'a2',
            life: 6,
            damage: index === 7 ? 2 : 0,
            armor: 0,
            actionReady: true,
            guarding: false,
            combatProfilesSource: 'config',
            statusTokens: index === 7 ? { burn: 1 } : {},
            typeLine: '生物',
        }));

        next.core = {
            ...next.core,
            currentPlayerId: selfId,
            phaseActorId: selfId,
            phaseReadyPlayerIds: [],
            turnNumber: 3,
            objects: Object.fromEntries(pressureObjects.map((object) => [object.id, object])),
            players: {
                ...next.core.players,
                [selfId]: {
                    ...next.core.players[selfId],
                    mageId: 'warlock_apprentice',
                    life: 24,
                    mageZoneId: 'a2',
                    damage: 7,
                    mana: 14,
                    channeling: 10,
                    actionReady: true,
                    quickcastReady: true,
                    guarding: false,
                    spellbookCount: 26,
                    preparedSpellSlots: 2,
                    preparedSpellCardIds: [1700, 1804],
                    discardSpellCardIds: [2224, 1903, 1806],
                },
                [opponentId]: {
                    ...next.core.players[opponentId],
                    mageId: 'priestess_apprentice',
                    life: 24,
                    mageZoneId: 'a2',
                    damage: 5,
                    mana: 18,
                    channeling: 10,
                    actionReady: true,
                    quickcastReady: true,
                    guarding: true,
                    spellbookCount: 26,
                    preparedSpellSlots: 2,
                    preparedSpellCardIds: [1901, 3408],
                    discardSpellCardIds: [1706],
                },
            },
            arena: next.core.arena.map((zone: MageWarsHarnessZone) => ({
                ...zone,
                occupantIds: zone.id === 'a2' ? [selfId, opponentId] : [],
                objectIds: zone.id === 'a2' ? pressureObjects.map((object) => object.id) : [],
                fieldCardIds: [],
            })),
        };

        return harness.state.set(next);
    });

    await page.waitForFunction(() => {
        const state = (window as Window & {
            __BG_TEST_HARNESS__?: MageWarsHarness;
        }).__BG_TEST_HARNESS__?.state?.get?.();
        const [selfId, opponentId] = state?.core?.playerOrder ?? [];
        const self = selfId ? state?.core?.players?.[selfId] : null;
        const opponent = opponentId ? state?.core?.players?.[opponentId] : null;
        return state?.sys?.phase === 'creatureAction'
            && state?.core?.phaseActorId === selfId
            && (state?.core?.phaseReadyPlayerIds as string[] | undefined)?.length === 0
            && self?.mageId === 'warlock_apprentice'
            && opponent?.mageId === 'priestess_apprentice'
            && self?.preparedSpellCardIds?.length === 2
            && self?.discardSpellCardIds?.length === 3
            && opponent?.guarding === true
            && self?.mageZoneId === 'a2'
            && opponent?.mageZoneId === 'a2';
    }, undefined, { timeout: 10_000 });
    await page.waitForTimeout(250);
}

async function applyMageWarsCombatFocusState(page: Page) {
    await page.evaluate(() => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: MageWarsHarness;
        }).__BG_TEST_HARNESS__;
        const snapshot = harness?.state?.get?.();
        if (!snapshot || !harness?.state?.set) {
            throw new Error('mage-wars combat focus state injector unavailable');
        }

        const next = structuredClone(snapshot);
        const [selfId, opponentId] = next.core.playerOrder;
        if (!selfId || !opponentId) {
            throw new Error('mage-wars combat focus state requires two players');
        }
        const attacker = {
            id: 'mw-test-focus-red-angel',
            kind: 'creature',
            ownerId: selfId,
            sourceSpellCardId: 2907,
            sourceObjectId: 'spell-2907',
            name: '灰衣天使',
            zoneId: 'a2',
            life: 10,
            damage: 0,
            armor: 0,
            actionReady: true,
            guarding: false,
            combatProfilesSource: 'config',
            typeLine: '生物 / 天使',
            attackOrTraitLine: '利剑：快速近战 4 骰；飞行',
            statusTokens: {},
        };
        const target = {
            id: 'mw-test-focus-blue-archer',
            kind: 'creature',
            ownerId: opponentId,
            sourceSpellCardId: 2816,
            sourceObjectId: 'spell-2816',
            name: '皇家弓手',
            zoneId: 'a2',
            life: 8,
            damage: 2,
            armor: 0,
            actionReady: true,
            guarding: false,
            combatProfilesSource: 'config',
            typeLine: '生物 / 高阶精灵、士兵',
            attackOrTraitLine: '长弓：完整行动远程 1-2 4 骰，穿刺+1；小刀：快速近战 2 骰',
            statusTokens: { burn: 1 },
        };

        next.core = {
            ...next.core,
            currentPlayerId: selfId,
            phaseActorId: selfId,
            phaseReadyPlayerIds: [],
            objects: {
                [attacker.id]: attacker,
                [target.id]: target,
            },
            players: {
                ...next.core.players,
                [selfId]: {
                    ...next.core.players[selfId],
                    mageZoneId: 'a1',
                    actionReady: true,
                },
                [opponentId]: {
                    ...next.core.players[opponentId],
                    mageZoneId: 'd1',
                    actionReady: true,
                },
            },
            arena: next.core.arena.map((zone: MageWarsHarnessZone) => ({
                ...zone,
                occupantIds: zone.id === 'a1' ? [selfId] : zone.id === 'd1' ? [opponentId] : [],
                objectIds: zone.id === 'a2' ? [attacker.id, target.id] : [],
                fieldCardIds: [],
            })),
        };

        return harness.state.set(next);
    });

    await page.waitForFunction(() => {
        const state = (window as Window & {
            __BG_TEST_HARNESS__?: MageWarsHarness;
        }).__BG_TEST_HARNESS__?.state?.get?.();
        return Boolean(
            state?.core?.objects?.['mw-test-focus-red-angel']
            && state?.core?.objects?.['mw-test-focus-blue-archer']
            && state?.core?.phaseActorId === '0'
            && (state?.core?.phaseReadyPlayerIds as string[] | undefined)?.length === 0
            && state?.core?.players?.['0']?.mageZoneId === 'a1'
            && state?.core?.players?.['1']?.mageZoneId === 'd1',
        );
    }, undefined, { timeout: 10_000 });
    await page.waitForTimeout(100);
}

test.describe('Mage Wars foundation runtime board', () => {
    test('真实入口加载正式牌桌素材并落桌面验收截图', async ({ context, page }) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width: 1920, height: 1080 });
        const diagnostics = await openMageWarsBoard(context, page, 'mage-wars-foundation-runtime-board');
        const defaultMageLayout = await page.evaluate(() => Array.from(
            document.querySelectorAll<HTMLElement>('[data-testid="mage-wars-zone-mage-entity"]'),
        ).map((mage) => {
            const laneGroup = mage.closest<HTMLElement>('[data-testid="mage-wars-zone-ownership-lanes"]');
            const lane = mage.closest<HTMLElement>('[data-lane-owner-side]');
            const lanes = laneGroup
                ? Array.from(laneGroup.querySelectorAll<HTMLElement>('[data-lane-owner-side]')).map((entry) => ({
                    ownerSide: entry.dataset.laneOwnerSide ?? null,
                    stackAxis: entry.dataset.laneStackAxis ?? null,
                    mageEntityCount: entry.querySelectorAll('[data-testid="mage-wars-zone-mage-entity"]').length,
                }))
                : [];
            return {
                playerId: mage.dataset.playerId ?? null,
                mageId: mage.dataset.mageId ?? null,
                zoneId: mage.closest<HTMLElement>('[data-testid^="mage-wars-arena-zone-"]')?.dataset.testid ?? null,
                laneAxis: laneGroup?.dataset.layoutAxis ?? null,
                ownerSide: lane?.dataset.laneOwnerSide ?? null,
                laneStackAxis: lane?.dataset.laneStackAxis ?? null,
                lanePlayerId: lane?.dataset.lanePlayerId ?? null,
                laneCount: lanes.length,
                ownLaneMageCount: lanes.find((entry) => entry.ownerSide === lane?.dataset.laneOwnerSide)?.mageEntityCount ?? 0,
                otherLaneMageCount: lanes
                    .filter((entry) => entry.ownerSide !== lane?.dataset.laneOwnerSide)
                    .reduce((total, entry) => total + entry.mageEntityCount, 0),
            };
        }));
        expect(defaultMageLayout).toHaveLength(2);
        defaultMageLayout.forEach((mage) => {
            expect(mage.zoneId).not.toBeNull();
            expect(mage.ownerSide).not.toBeNull();
            expect(mage.laneAxis).toBe('horizontal');
            expect(mage.laneStackAxis).toBe('vertical');
            expect(mage.ownerSide).toBe(mage.playerId === '0' ? 'seat-left' : 'seat-right');
            expect(mage.lanePlayerId).toBe(mage.playerId);
            expect(mage.laneCount).toBe(2);
            expect(mage.ownLaneMageCount).toBe(1);
            expect(mage.otherLaneMageCount).toBe(0);
        });
        await expectMageWarsDefaultBrowseInteractions(page);
        await mkdir(dirname(DEFAULT_MAGE_SPACE_SCREENSHOT_PATH), { recursive: true });
        await page.screenshot({ path: DEFAULT_MAGE_SPACE_SCREENSHOT_PATH, fullPage: false });
        await applyMageWarsPlanningState(page);
        const initialPlanningMainAction = page.getByTestId('mage-wars-turn-end');
        await expect(initialPlanningMainAction).toBeVisible({ timeout: 5_000 });
        await expect(initialPlanningMainAction).toHaveAttribute('data-main-action-mode', 'advance-phase');
        const duplicateSpellbookCardInfo = await findVisibleDuplicateSpellbookCard(page);
        const duplicateSpellbookCard = page.locator(
            `[data-testid="mage-wars-desktop-spellbook-card"][data-source-card-id="${duplicateSpellbookCardInfo.cardId}"]`,
        );
        await expect(duplicateSpellbookCard).toBeVisible({ timeout: 5_000 });
        await expect(duplicateSpellbookCard).toHaveAttribute('data-copy-count', duplicateSpellbookCardInfo.copyCount);
        await expect(duplicateSpellbookCard.getByTestId('mage-wars-spellbook-copy-count')).toHaveText(`x${duplicateSpellbookCardInfo.copyCount}`);
        const copyCountPlacement = await duplicateSpellbookCard.evaluate((card) => {
            const badge = card.querySelector<HTMLElement>('[data-testid="mage-wars-spellbook-copy-count"]');
            if (!badge) return null;
            const cardRect = card.getBoundingClientRect();
            const badgeRect = badge.getBoundingClientRect();
            const row = card.parentElement;
            return {
                badgeCenterX: badgeRect.left + badgeRect.width / 2,
                badgeCenterY: badgeRect.top + badgeRect.height / 2,
                cardCenterX: cardRect.left + cardRect.width / 2,
                cardBottom: cardRect.bottom,
                badgeTop: badgeRect.top,
                badgeBottom: badgeRect.bottom,
                rowOverflowY: row ? getComputedStyle(row).overflowY : null,
            };
        });
        expect(copyCountPlacement).not.toBeNull();
        expect(Math.abs(copyCountPlacement!.badgeCenterX - copyCountPlacement!.cardCenterX)).toBeLessThanOrEqual(2);
        expect(copyCountPlacement!.badgeTop).toBeLessThan(copyCountPlacement!.cardBottom);
        expect(copyCountPlacement!.badgeBottom).toBeLessThanOrEqual(copyCountPlacement!.cardBottom);
        expect(copyCountPlacement!.badgeBottom).toBeGreaterThanOrEqual(copyCountPlacement!.cardBottom - 6);
        expect(copyCountPlacement!.rowOverflowY).not.toBe('hidden');

        const duplicateInspectButton = duplicateSpellbookCard.locator('xpath=..').getByTestId('mage-wars-card-inspect-button');
        await expect(duplicateInspectButton).toBeVisible({ timeout: 5_000 });
        await expect(duplicateSpellbookCard).toHaveAttribute('data-secondary-inspect', 'true');
        await duplicateInspectButton.click();
        await expect(page.getByTestId('mage-wars-card-magnify-overlay')).toBeVisible({ timeout: 5_000 });
        await expect(page.getByTestId('mage-wars-card-magnify-content')).toHaveAttribute('data-source-card-id', duplicateSpellbookCardInfo.cardId);
        expect(await duplicateSpellbookCard.getAttribute('data-selected-count')).toBeNull();
        await page.getByTestId('mage-wars-card-magnify-overlay-close').click();
        await expect(page.getByTestId('mage-wars-card-magnify-overlay')).toBeHidden({ timeout: 5_000 });

        await duplicateSpellbookCard.click();
        await expect(duplicateSpellbookCard).toHaveAttribute('data-selected-count', '1');
        await expect(duplicateSpellbookCard.getByTestId('mage-wars-spellbook-selected-count')).toHaveCount(0);
        const oneDraftSlot = page.locator(
            `[data-testid="mage-wars-desktop-prepared-card"][data-planning-draft="true"][data-source-card-id="${duplicateSpellbookCardInfo.cardId}"]`,
        );
        await expect(oneDraftSlot).toHaveCount(1);
        await duplicateSpellbookCard.click();
        await expect(duplicateSpellbookCard).toHaveAttribute('data-selected-count', '2');
        await expect(duplicateSpellbookCard.getByTestId('mage-wars-spellbook-selected-count')).toHaveCount(0);
        const draftSlots = page.locator(
            `[data-testid="mage-wars-desktop-prepared-card"][data-planning-draft="true"][data-source-card-id="${duplicateSpellbookCardInfo.cardId}"]`,
        );
        await expect(draftSlots).toHaveCount(2);
        expect((await draftSlots.evaluateAll((slots) => slots.map((slot) => slot.getAttribute('data-plan-slot-index')).sort())))
            .toEqual(['1', '2']);
        const planSpellsButton = page.getByTestId('mage-wars-plan-spells');
        await expect(planSpellsButton).toBeVisible({ timeout: 5_000 });
        await expect(planSpellsButton).toHaveText('确认计划 2/2');
        await expect(planSpellsButton).toHaveAttribute('data-plan-progress', '2/2');
        await expect(planSpellsButton).toHaveAttribute('data-main-action-mode', 'plan-spells');
        await expect.poll(() => planSpellsButton.evaluate((button) => ({
            whiteSpace: getComputedStyle(button).whiteSpace,
            lineCount: Math.round((button.scrollHeight
                - Number.parseFloat(getComputedStyle(button).paddingTop)
                - Number.parseFloat(getComputedStyle(button).paddingBottom))
                / Number.parseFloat(getComputedStyle(button).lineHeight)),
        }))).toEqual(expect.objectContaining({ whiteSpace: 'nowrap', lineCount: 1 }));
        const planButtonTextMetrics = await planSpellsButton.evaluate((button) => ({
            clientWidth: button.clientWidth,
            scrollWidth: button.scrollWidth,
        }));
        expect(planButtonTextMetrics.scrollWidth).toBeLessThanOrEqual(planButtonTextMetrics.clientWidth);
        const planButtonPlacement = await page.evaluate(() => {
            const dock = document.querySelector<HTMLElement>('[data-testid="mage-wars-turn-end-dock"]');
            const shelf = document.querySelector<HTMLElement>('[data-testid="mage-wars-desktop-spellbook-shelf"]');
            const button = document.querySelector<HTMLElement>('[data-testid="mage-wars-plan-spells"]');
            const toRect = (element: HTMLElement | null) => {
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
            return {
                dockContainsButton: Boolean(dock && button && dock.contains(button)),
                shelfContainsButton: Boolean(shelf && button && shelf.contains(button)),
                button: toRect(button),
                dock: toRect(dock),
                shelf: toRect(shelf),
                prepared: toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-desktop-prepared-spells"]')),
                viewportHeight: window.innerHeight,
            };
        });
        expect(planButtonPlacement.dockContainsButton).toBe(true);
        expect(planButtonPlacement.shelfContainsButton).toBe(false);
        expect(planButtonPlacement.button).not.toBeNull();
        expect(planButtonPlacement.dock).not.toBeNull();
        expect(planButtonPlacement.shelf).not.toBeNull();
        expect(planButtonPlacement.prepared).not.toBeNull();
        expect(planButtonPlacement.button!.bottom).toBeLessThan(planButtonPlacement.prepared!.y);
        expect(planButtonPlacement.button!.y).toBeGreaterThan(0);
        expect(planButtonPlacement.button!.x).toBeGreaterThan(planButtonPlacement.shelf!.right);
        await page.screenshot({ path: SPELLBOOK_COPY_SELECTION_SCREENSHOT_PATH, fullPage: false });
        await planSpellsButton.click();
        await expect.poll(async () => page.evaluate(() => (window as Window & {
            __BG_TEST_HARNESS__?: MageWarsHarness;
        }).__BG_TEST_HARNESS__?.state?.get?.()?.core?.players?.['0']?.preparedSpellCardIds ?? null)).toEqual([
            Number(duplicateSpellbookCardInfo.cardId),
            Number(duplicateSpellbookCardInfo.cardId),
        ]);
        await applyMageWarsSaturatedState(page);
        const board = page.getByTestId('mage-wars-board');
        await expect(page.getByTestId('mage-wars-prepared-source-badge')).toHaveCount(0);
        await expect(page.getByTestId('mage-wars-prepared-source-frame').first()).toBeVisible();
        await expect(page.getByTestId('mage-wars-mage-hud-current-badge')).toHaveText(/行动中/);
        await expect(page.getByTestId('mage-wars-mage-hud-active-hint')).toHaveCount(0);
        await expect(page.getByTestId('mage-wars-desktop-settlement-overlay')).toHaveCount(0);
        await expect(page.getByTestId('mage-wars-dice-tray')).toHaveCount(0);
        await expect(page.getByText('掷骰预备')).toHaveCount(0);
        await captureMageWarsSixPerSideLaneWrapScreenshot(page);
        await clickVisibleMageWarsFieldCard(page, 'mw-test-red-angel');
        await expect(page.locator('[data-testid="mage-wars-zone-field-card"][data-object-id="mw-test-red-angel"][data-field-card-role="source"]')).toBeVisible();
        await expect(page.locator('[data-testid="mage-wars-zone-field-card"][data-object-id="mw-test-blue-angel"][data-field-card-role="target"]')).toBeVisible();
        const guardActionButton = page.getByTestId('mage-wars-selected-unit-guard');
        await expect(guardActionButton).toBeVisible();
        await expect(guardActionButton).toHaveAttribute('data-action-kind', 'guard');
        await expect(guardActionButton).toHaveAttribute('data-action-visual', 'text-action');
        await expect(guardActionButton).toHaveAttribute('data-action-placement', 'source-card-below');
        await expect(guardActionButton.locator('img')).toHaveCount(0);
        await expect(guardActionButton.locator('svg')).toHaveCount(0);
        await expect(guardActionButton).toContainText(/守卫|guard/i);
        await expect(guardActionButton).not.toContainText('进行守卫');
        const selectedAbilityButton = page.locator('[data-testid^="mage-wars-selected-object-ability-"]').first();
        await expect(selectedAbilityButton).toBeVisible();
        await expect(selectedAbilityButton).toHaveAttribute('data-ability-visual', 'text-action');
        await expect(selectedAbilityButton.locator('img')).toHaveCount(0);
        await expect(selectedAbilityButton.locator('svg')).toHaveCount(0);
        await expect(selectedAbilityButton).toContainText(/救赎献祭|治疗之光|迅捷传送|群兽法杖/);
        const guardPlacementAudit = await page.evaluate(() => {
            const dock = document.querySelector<HTMLElement>('[data-testid="mage-wars-selected-ability-action-dock"]');
            const guard = document.querySelector<HTMLElement>('[data-testid="mage-wars-selected-unit-guard"]');
            if (!dock || !guard) return null;
            const dockRect = dock.getBoundingClientRect();
            const guardRect = guard.getBoundingClientRect();
            return {
                insideActionDock: Boolean(guard.closest('[data-testid="mage-wars-selected-ability-action-dock"]')),
                centerDelta: Math.abs((guardRect.left + guardRect.width / 2) - (dockRect.left + dockRect.width / 2)),
                nestedInsideFieldCard: Boolean(guard.closest('[data-testid="mage-wars-zone-field-card"]')),
                className: guard.className,
            };
        });
        expect(guardPlacementAudit).not.toBeNull();
        expect(guardPlacementAudit!.insideActionDock).toBe(true);
        expect(guardPlacementAudit!.centerDelta).toBeLessThanOrEqual(180);
        expect(guardPlacementAudit!.nestedInsideFieldCard).toBe(false);
        expect(guardPlacementAudit!.className).toContain('bg-emerald-200');
        expect(guardPlacementAudit!.className).not.toContain('rounded-[0.22rem]');
        await expect(page.getByTestId('mage-wars-field-card-target-badge')).toHaveCount(0);
        await expect(page.getByTestId('mage-wars-field-card-source-badge')).toHaveCount(0);
        await expect(page.getByTestId('mage-wars-mage-hud-target-badge')).toHaveCount(0);
        const lifeToggle = page.getByTestId('mage-wars-life-toggle');
        await expect(lifeToggle).toBeVisible();
        await expect(lifeToggle).toHaveAttribute('aria-pressed', 'false');
        await expect(page.locator('[data-testid="mage-wars-field-card-life-readout"]').first()).toHaveAttribute('data-life-visible', 'false');
        await lifeToggle.click();
        await expect(lifeToggle).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('[data-testid="mage-wars-field-card-life-readout"]').first()).toHaveAttribute('data-life-visible', 'true');
        await expect(board).toContainText('己方已计划');
        await expect(board).toContainText('弃牌 3');
        const imageAudit = await auditMageWarsImages(page, [
            '火球术',
            '法师祸咒',
            '烈焰狱鬼',
            '西锁骑士',
            '火烙魔婴',
            '缠绕藤蔓',
            '邪术师',
            '女祭司',
        ]);
        expect(imageAudit.images.some((image) => image.alt === '法师战争标准竞技场' && image.rect.width > 0 && image.rect.height > 0)).toBe(true);
        const desktopLayoutAudit = await page.evaluate(() => {
            const arenaStage = document.querySelector<HTMLElement>('[data-testid="mage-wars-arena-stage"]');
            const arenaViewport = document.querySelector<HTMLElement>('[data-testid="mage-wars-arena-viewport"]');
            const boardRoot = document.querySelector<HTMLElement>('[data-testid="mage-wars-board"]');
            const hudAnchorLayer = document.querySelector<HTMLElement>('[data-testid="mage-wars-hud-anchor-layer"]');
            const lifeToggle = document.querySelector<HTMLElement>('[data-testid="mage-wars-life-toggle"]');
            const arenaImage = document.querySelector<HTMLImageElement>('img[alt="法师战争标准竞技场"]');
            const selfHud = document.querySelector<HTMLElement>('[data-testid="mage-wars-mage-hud-self"]');
            const opponentHud = document.querySelector<HTMLElement>('[data-testid="mage-wars-mage-hud-opponent"]');
            const mageHudHintCards = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="mage-wars-mage-hud-hint-card"]'));
            const mageHudStatGrids = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="mage-wars-mage-hud-stat-grid"]'));
            const mageHudStatBars = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="mage-wars-mage-hud-stat-bar"]'));
            const opponentPreparedMirror = document.querySelector<HTMLElement>('[data-testid="mage-wars-opponent-prepared-mirror"]');
            const spellbookShelf = document.querySelector<HTMLElement>('[data-testid="mage-wars-desktop-spellbook-shelf"]');
            const preparedArea = document.querySelector<HTMLElement>('[data-testid="mage-wars-desktop-prepared-spells"]');
            const preparedCard = document.querySelector<HTMLElement>('[data-testid="mage-wars-desktop-prepared-card"]');
            const spellbookCard = document.querySelector<HTMLElement>('[data-testid="mage-wars-desktop-spellbook-card"]');
            const discardPile = document.querySelector<HTMLElement>('[data-testid="mage-wars-discard-pile"]');
            const turnEnd = document.querySelector<HTMLElement>('[data-testid="mage-wars-turn-end"]');
            const arenaZones = Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="mage-wars-arena-zone-"]'));
            const fieldCards = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="mage-wars-zone-field-card"]'));
            const zoneMageEntities = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="mage-wars-zone-mage-entity"]'));
            const ownershipLanes = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="mage-wars-zone-ownership-lanes"]'))
                .flatMap((laneGroup) => Array.from(laneGroup.querySelectorAll<HTMLElement>('[data-lane-owner-side]')).map((lane) => ({
                    zoneId: laneGroup.dataset.zoneId ?? null,
                    ownerSide: lane.dataset.laneOwnerSide ?? null,
                    laneAxis: laneGroup.dataset.layoutAxis ?? null,
                    stackAxis: lane.dataset.laneStackAxis ?? null,
                    overflowMode: lane.dataset.laneOverflowMode ?? null,
                    maxRows: lane.dataset.laneMaxRows == null ? null : Number(lane.dataset.laneMaxRows),
                    className: lane.className,
                    overflowX: getComputedStyle(lane).overflowX,
                    overflowY: getComputedStyle(lane).overflowY,
                    rect: (() => {
                        const rect = lane.getBoundingClientRect();
                        return {
                            x: rect.x,
                            y: rect.y,
                            width: rect.width,
                            height: rect.height,
                            right: rect.right,
                            bottom: rect.bottom,
                        };
                    })(),
                    scrollHeight: lane.scrollHeight,
                    clientHeight: lane.clientHeight,
                    fieldCardCount: lane.querySelectorAll('[data-testid="mage-wars-zone-field-card"]').length,
                    mageEntityCount: lane.querySelectorAll('[data-testid="mage-wars-zone-mage-entity"]').length,
                    items: Array.from(lane.querySelectorAll<HTMLElement>('[data-testid="mage-wars-zone-lane-item"]')).map((item) => {
                        const style = window.getComputedStyle(item);
                        const rect = item.getBoundingClientRect();

                        return {
                            kind: item.dataset.laneItemKind ?? null,
                            index: item.dataset.laneItemIndex == null ? null : Number(item.dataset.laneItemIndex),
                            position: style.position,
                            marginTop: style.marginTop,
                            transform: style.transform,
                            rect: {
                                x: rect.x,
                                y: rect.y,
                                width: rect.width,
                                height: rect.height,
                                right: rect.right,
                                bottom: rect.bottom,
                            },
                        };
                    }),
                })));
            const settlementOverlay = document.querySelector<HTMLElement>('[data-testid="mage-wars-desktop-settlement-overlay"]');
            const settlementAttackDice = Array.from(
                settlementOverlay?.querySelectorAll<HTMLElement>('[data-testid="mage-wars-attack-die-face"]') ?? [],
            );
            const settlementEffectDice = Array.from(
                settlementOverlay?.querySelectorAll<HTMLElement>('[data-testid="mage-wars-effect-die-face"]') ?? [],
            );
            const attackDice = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="mage-wars-attack-die-face"]'));
            const effectDice = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="mage-wars-effect-die-face"]'));
            const visibleArenaText = arenaZones.map((zone) => zone.innerText).join('\n');
            const toRect = (element: HTMLElement | null) => {
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
            const overlapArea = (left: DOMRect, right: DOMRect) => {
                const width = Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left));
                const height = Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
                return width * height;
            };
            const overlaps = (left: HTMLElement, right: HTMLElement) => {
                const leftRect = left.getBoundingClientRect();
                const rightRect = right.getBoundingClientRect();
                return leftRect.left < rightRect.right
                    && leftRect.right > rightRect.left
                    && leftRect.top < rightRect.bottom
                    && leftRect.bottom > rightRect.top;
            };
            const zoneMageEntityDetails = zoneMageEntities.map((occupant) => {
                const zone = occupant.closest<HTMLElement>('[data-testid^="mage-wars-arena-zone-"]');
                const rect = occupant.getBoundingClientRect();
                const zoneRect = zone?.getBoundingClientRect();
                const ownershipLane = occupant.closest<HTMLElement>('[data-lane-owner-side]');
                const ownershipLaneRect = ownershipLane?.getBoundingClientRect();
                const sameZoneFieldCards = zone
                    ? Array.from(zone.querySelectorAll<HTMLElement>('[data-testid="mage-wars-zone-field-card"]'))
                    : [];
                const lifeReadout = occupant.querySelector<HTMLElement>('[data-testid="mage-wars-mage-entity-life-readout"]');
                const centerX = rect.x + rect.width / 2;
                const centerY = rect.y + rect.height / 2;
                const topElement = document.elementFromPoint(centerX, centerY);

                return {
                    playerId: occupant.dataset.playerId,
                    mageId: occupant.dataset.mageId,
                    previewKind: occupant.dataset.magePreviewKind,
                    uiRole: occupant.dataset.mageUiRole,
                    ownerSide: ownershipLane?.dataset.laneOwnerSide ?? null,
                    laneAxis: ownershipLane
                        ?.closest<HTMLElement>('[data-testid="mage-wars-zone-ownership-lanes"]')
                        ?.dataset.layoutAxis ?? null,
                    laneStackAxis: ownershipLane?.dataset.laneStackAxis ?? null,
                    rect: toRect(occupant),
                    aspectRatio: rect.height > 0 ? rect.width / rect.height : null,
                    centerX,
                    centerY,
                    zoneTestId: zone?.getAttribute('data-testid') ?? null,
                    centerInsideZone: zoneRect
                        ? centerX >= zoneRect.left
                            && centerX <= zoneRect.right
                            && centerY >= zoneRect.top
                            && centerY <= zoneRect.bottom
                        : false,
                    centerInsideLaneViewport: ownershipLaneRect
                        ? centerX >= ownershipLaneRect.left
                            && centerX <= ownershipLaneRect.right
                            && centerY >= ownershipLaneRect.top
                            && centerY <= ownershipLaneRect.bottom
                        : false,
                    topTestId: topElement?.closest<HTMLElement>('[data-testid]')?.dataset.testid ?? null,
                    overlapsSameZoneFieldCard: sameZoneFieldCards.some((fieldCard) => overlaps(occupant, fieldCard)),
                    overlapsSpellbookShelf: spellbookShelf ? overlaps(occupant, spellbookShelf) : false,
                    hasDamageOverlay: Boolean(occupant.querySelector('[data-testid="mage-wars-mage-entity-damage-overlay"]')),
                    hasDamageValueBadge: Boolean(occupant.querySelector('[data-testid="mage-wars-mage-entity-damage-overlay-value"]')),
                    lifeReadoutText: lifeReadout?.textContent ?? null,
                    lifeRemaining: lifeReadout?.dataset.lifeRemaining ?? null,
                    lifeVisible: lifeReadout?.dataset.lifeVisible ?? null,
                };
            });
            const arenaZoneDetails = arenaZones.map((zone) => ({
                zoneId: zone.getAttribute('data-testid')?.replace('mage-wars-arena-zone-', '') ?? null,
                rect: toRect(zone),
            }));
            const fieldCardDetails = fieldCards.map((card) => {
                const cardRect = card.getBoundingClientRect();
                const zone = card.closest<HTMLElement>('[data-testid^="mage-wars-arena-zone-"]');
                const zoneRect = zone?.getBoundingClientRect();
                const cardArea = cardRect.width * cardRect.height;
                const ownZoneArea = zoneRect ? overlapArea(cardRect, zoneRect) : 0;
                const lifeReadout = card.querySelector<HTMLElement>('[data-testid="mage-wars-field-card-life-readout"]');
                const maxOtherZoneCoverage = Math.max(0, ...arenaZones
                    .filter((candidate) => candidate !== zone)
                    .map((candidate) => {
                        const candidateRect = candidate.getBoundingClientRect();
                        return cardArea > 0 ? overlapArea(cardRect, candidateRect) / cardArea : 0;
                    }));

                return {
                    sourceCardId: card.dataset.sourceCardId ? Number(card.dataset.sourceCardId) : null,
                    ownerSide: card.dataset.ownerSide ?? null,
                    role: card.dataset.fieldCardRole ?? null,
                    zoneId: zone?.getAttribute('data-testid')?.replace('mage-wars-arena-zone-', '') ?? null,
                    laneAxis: card.closest<HTMLElement>('[data-testid="mage-wars-zone-ownership-lanes"]')?.dataset.layoutAxis ?? null,
                    laneStackAxis: card.closest<HTMLElement>('[data-lane-owner-side]')?.dataset.laneStackAxis ?? null,
                    rect: toRect(card),
                    aspectRatio: cardRect.height > 0 ? cardRect.width / cardRect.height : null,
                    centerX: cardRect.x + cardRect.width / 2,
                    centerY: cardRect.y + cardRect.height / 2,
                    zoneCoverage: cardArea > 0 ? ownZoneArea / cardArea : 0,
                    maxOtherZoneCoverage,
                    visualDamage: Number(card.dataset.visualDamage ?? 0),
                    hasDamageOverlay: Boolean(card.querySelector('[data-testid="mage-wars-field-card-damage-overlay"]')),
                    hasDamageValueBadge: Boolean(card.querySelector('[data-testid="mage-wars-field-card-damage-overlay-value"]')),
                    lifeReadoutText: lifeReadout?.textContent ?? null,
                    lifeRemaining: lifeReadout?.dataset.lifeRemaining ?? null,
                    lifeVisible: lifeReadout?.dataset.lifeVisible ?? null,
                };
            });
            return {
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                arenaStage: toRect(arenaStage),
                arenaViewport: toRect(arenaViewport),
                hudAnchorLayer: toRect(hudAnchorLayer),
                bottomViewportGrid: toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-bottom-viewport-grid"]')),
                hudAnchorLayoutSource: hudAnchorLayer?.getAttribute('data-mage-wars-layout-source') ?? null,
                bottomGridLayoutSource: document
                    .querySelector<HTMLElement>('[data-testid="mage-wars-bottom-viewport-grid"]')
                    ?.getAttribute('data-mage-wars-layout-source') ?? null,
                legacyScaledHudLayerCount: document.querySelectorAll('[data-mage-wars-layout-source="desktop-scaled"]').length,
                lifeToggle: lifeToggle
                    ? {
                        rect: toRect(lifeToggle),
                        pressed: lifeToggle.getAttribute('aria-pressed'),
                        lifeVisible: lifeToggle.dataset.lifeVisible ?? null,
                    }
                    : null,
                arenaImage: toRect(arenaImage),
                arenaZones: arenaZoneDetails,
                selfHud: toRect(selfHud),
                opponentHud: toRect(opponentHud),
                selfHudDensity: selfHud?.dataset.mageWarsHudDensity ?? null,
                opponentHudDensity: opponentHud?.dataset.mageWarsHudDensity ?? null,
                mageHudHintCards: mageHudHintCards.map((hintCard) => ({
                    owner: hintCard.closest('[data-testid="mage-wars-mage-hud-self"]')
                        ? 'self'
                        : hintCard.closest('[data-testid="mage-wars-mage-hud-opponent"]')
                            ? 'opponent'
                            : 'unknown',
                    rect: toRect(hintCard),
                    aspectRatio: (() => {
                        const rect = hintCard.getBoundingClientRect();
                        return rect.height > 0 ? rect.width / rect.height : null;
                    })(),
                    previewKind: hintCard.dataset.magePreviewKind,
                    uiRole: hintCard.dataset.mageUiRole,
                })),
                mageHudStatGrids: mageHudStatGrids.map((grid) => {
                    const style = getComputedStyle(grid);
                    const rect = grid.getBoundingClientRect();
                    return {
                        fontSize: Number.parseFloat(style.fontSize),
                        width: rect.width,
                        height: rect.height,
                    };
                }),
                mageHudStatBars: mageHudStatBars.map((bar) => {
                    const rect = bar.getBoundingClientRect();
                    return {
                        stat: bar.dataset.stat ?? null,
                        width: rect.width,
                        height: rect.height,
                    };
                }),
                opponentPreparedMirror: toRect(opponentPreparedMirror),
                spellbookShelf: toRect(spellbookShelf),
                preparedArea: toRect(preparedArea),
                preparedCard: toRect(preparedCard),
                spellbookCard: toRect(spellbookCard),
                discardPile: toRect(discardPile),
                turnEnd: toRect(turnEnd),
                fieldCards: fieldCardDetails,
                settlementOverlay: toRect(settlementOverlay),
                zoneMageEntities: zoneMageEntityDetails,
                ownershipLanes,
                settlementAttackDice: settlementAttackDice.map(toRect),
                settlementEffectDice: settlementEffectDice.map(toRect),
                attackDice: attackDice.map(toRect),
                effectDice: effectDice.map(toRect),
                visibleArenaText,
                visibleBoardText: boardRoot?.innerText ?? '',
                sourceZoneCount: arenaZones.filter((zone) => zone.dataset.sourceZone === 'true').length,
                legalTargetZoneCount: arenaZones.filter((zone) => zone.dataset.legalTargetZone === 'true').length,
                legalMoveZoneCount: arenaZones.filter((zone) => zone.dataset.legalMoveZone === 'true').length,
                damageTokenImageCount: Array.from(document.images)
                    .filter((image) => image.currentSrc.includes('/tokens/damage/') || image.src.includes('/tokens/damage/'))
                    .length,
            };
        });
        expect(desktopLayoutAudit.preparedArea).not.toBeNull();
        expect(desktopLayoutAudit.preparedCard).not.toBeNull();
        expect(desktopLayoutAudit.spellbookCard).not.toBeNull();
        expect(desktopLayoutAudit.arenaStage).not.toBeNull();
        expect(desktopLayoutAudit.hudAnchorLayer).not.toBeNull();
        expect(desktopLayoutAudit.hudAnchorLayoutSource).toBe('viewport-anchored');
        expect(desktopLayoutAudit.bottomViewportGrid).not.toBeNull();
        expect(desktopLayoutAudit.bottomGridLayoutSource).toBe('viewport-grid-anchored');
        expect(desktopLayoutAudit.legacyScaledHudLayerCount).toBe(0);
        expect(desktopLayoutAudit.lifeToggle).not.toBeNull();
        expect(desktopLayoutAudit.lifeToggle!.pressed).toBe('true');
        expect(desktopLayoutAudit.lifeToggle!.lifeVisible).toBe('true');
        expect(desktopLayoutAudit.selfHud).not.toBeNull();
        expect(desktopLayoutAudit.opponentHud).not.toBeNull();
        expect(desktopLayoutAudit.selfHudDensity).toBe('full');
        expect(desktopLayoutAudit.opponentHudDensity).toBe('full');
        expect(desktopLayoutAudit.mageHudHintCards).toHaveLength(2);
        expect(desktopLayoutAudit.mageHudStatGrids).toHaveLength(2);
        desktopLayoutAudit.mageHudStatGrids.forEach((grid) => {
            expect(grid.fontSize, `2560 桌面 HUD 属性文字必须保持放大后的可读尺寸，不能回退到旧小字: ${JSON.stringify(desktopLayoutAudit)}`).toBeGreaterThanOrEqual(34);
            expect(grid.width, `2560 桌面 HUD 属性区必须随 HUD 扩宽: ${JSON.stringify(desktopLayoutAudit)}`).toBeGreaterThanOrEqual(390);
        });
        expect(desktopLayoutAudit.mageHudStatBars).toHaveLength(6);
        desktopLayoutAudit.mageHudStatBars.forEach((bar) => {
            expect(bar.height, `2560 桌面 ${bar.stat} 属性条必须保持放大后的可读高度: ${JSON.stringify(desktopLayoutAudit)}`).toBeGreaterThanOrEqual(30);
            expect(bar.width, `2560 桌面 ${bar.stat} 属性条不能继续保持旧窄宽度: ${JSON.stringify(desktopLayoutAudit)}`).toBeGreaterThanOrEqual(200);
        });
        const mageCardAspectRatio = (4096 / 7) / (3302 / 4);
        expect(desktopLayoutAudit.opponentPreparedMirror).not.toBeNull();
        expect(desktopLayoutAudit.spellbookShelf).not.toBeNull();
        expect(desktopLayoutAudit.discardPile).not.toBeNull();
        expect(desktopLayoutAudit.turnEnd).not.toBeNull();
        expect(desktopLayoutAudit.settlementOverlay).toBeNull();
        expect(desktopLayoutAudit.settlementAttackDice).toHaveLength(0);
        expect(desktopLayoutAudit.settlementEffectDice).toHaveLength(0);
        expect(desktopLayoutAudit.attackDice).toHaveLength(0);
        expect(desktopLayoutAudit.effectDice).toHaveLength(0);
        desktopLayoutAudit.mageHudHintCards.forEach((hintCard) => {
            expect(hintCard.rect).not.toBeNull();
            expect(hintCard.rect!.height).toBeGreaterThan(210);
            expect(hintCard.rect!.width).toBeGreaterThan(145);
            expect(hintCard.aspectRatio).not.toBeNull();
            expect(Math.abs(hintCard.aspectRatio! - mageCardAspectRatio)).toBeLessThanOrEqual(0.003);
            expect(hintCard.previewKind).toBe('card');
            expect(hintCard.uiRole).toBe('player-hint-card');
        });
        expect(desktopLayoutAudit.zoneMageEntities).toHaveLength(2);
        expect(desktopLayoutAudit.zoneMageEntities.map((occupant) => occupant.mageId).sort()).toEqual([
            'priestess_apprentice',
            'warlock_apprentice',
        ]);
        desktopLayoutAudit.zoneMageEntities.forEach((occupant) => {
            expect(occupant.rect).not.toBeNull();
            expect(occupant.aspectRatio).not.toBeNull();
            expect(Math.abs(occupant.aspectRatio! - mageCardAspectRatio)).toBeLessThanOrEqual(0.003);
            expect(occupant.overlapsSpellbookShelf).toBe(false);
            expect(occupant.previewKind).toBe('portrait');
            expect(occupant.uiRole).toBe('mage-battle-entity');
            expect(occupant.laneAxis).toBe('horizontal');
            expect(occupant.laneStackAxis).toBe('vertical');
            expect(occupant.rect!.height).toBeGreaterThan(85);
        });
        const warlockEntity = desktopLayoutAudit.zoneMageEntities.find((occupant) => occupant.mageId === 'warlock_apprentice');
        const priestessEntity = desktopLayoutAudit.zoneMageEntities.find((occupant) => occupant.mageId === 'priestess_apprentice');
        expect(warlockEntity?.rect).not.toBeNull();
        expect(priestessEntity?.rect).not.toBeNull();
        expect(desktopLayoutAudit.zoneMageEntities.find((occupant) => occupant.mageId === 'warlock_apprentice')?.zoneTestId).toBe('mage-wars-arena-zone-a2');
        expect(desktopLayoutAudit.zoneMageEntities.find((occupant) => occupant.mageId === 'priestess_apprentice')?.zoneTestId).toBe('mage-wars-arena-zone-a2');
        expect(desktopLayoutAudit.zoneMageEntities.find((occupant) => occupant.mageId === 'warlock_apprentice')?.ownerSide).toBe('seat-left');
        expect(desktopLayoutAudit.zoneMageEntities.find((occupant) => occupant.mageId === 'priestess_apprentice')?.ownerSide).toBe('seat-right');
        desktopLayoutAudit.zoneMageEntities
            .filter((occupant) => occupant.centerInsideLaneViewport)
            .forEach((occupant) => {
                expect(occupant.centerInsideZone).toBe(true);
                expect(
                    occupant.topTestId,
                    `场上法师中心点被其它层遮挡: ${JSON.stringify({
                        occupant,
                        selfHud: desktopLayoutAudit.selfHud,
                        opponentHud: desktopLayoutAudit.opponentHud,
                        mageHudHintCards: desktopLayoutAudit.mageHudHintCards,
                        mageHudStatGrids: desktopLayoutAudit.mageHudStatGrids,
                        bottomViewportGrid: desktopLayoutAudit.bottomViewportGrid,
                    })}`,
                ).toBe('mage-wars-zone-mage-entity');
            });
        expect(desktopLayoutAudit.zoneMageEntities.every((occupant) => occupant.hasDamageOverlay)).toBe(true);
        expect(desktopLayoutAudit.zoneMageEntities.every((occupant) => occupant.hasDamageValueBadge === false)).toBe(true);
        expect(desktopLayoutAudit.zoneMageEntities.every((occupant) => occupant.lifeVisible === 'true')).toBe(true);
        expect(desktopLayoutAudit.zoneMageEntities.map((occupant) => occupant.lifeReadoutText).sort()).toEqual(['17/24', '19/24']);
        expect(desktopLayoutAudit.fieldCards.some((card) => card.visualDamage > 0 && card.hasDamageOverlay)).toBe(true);
        expect(desktopLayoutAudit.fieldCards.every((card) => card.hasDamageValueBadge === false)).toBe(true);
        expect(desktopLayoutAudit.fieldCards.every((card) => card.lifeVisible === 'true')).toBe(true);
        expect(desktopLayoutAudit.fieldCards.some((card) => card.visualDamage > 0 && card.lifeReadoutText === '4/6')).toBe(true);
        expect(desktopLayoutAudit.damageTokenImageCount).toBe(0);
        expect(desktopLayoutAudit.visibleArenaText).not.toContain('来源');
        expect(desktopLayoutAudit.visibleArenaText).not.toContain('可选目标');
        expect(desktopLayoutAudit.visibleArenaText).not.toContain('可移动');
        expect(desktopLayoutAudit.visibleArenaText).not.toContain('你');
        expect(desktopLayoutAudit.visibleArenaText).not.toContain('对手');
        expect(desktopLayoutAudit.visibleBoardText).not.toContain('可选目标');
        expect(desktopLayoutAudit.visibleBoardText).not.toContain('来源');
        expect(desktopLayoutAudit.visibleBoardText).not.toContain('选择目标');
        expect(desktopLayoutAudit.sourceZoneCount).toBe(1);
        expect(desktopLayoutAudit.legalTargetZoneCount).toBeGreaterThan(0);
        expect(desktopLayoutAudit.legalMoveZoneCount).toBeGreaterThan(0);
        expect(desktopLayoutAudit.preparedArea!.right).toBeLessThanOrEqual(desktopLayoutAudit.viewportWidth - 8);
        expect(desktopLayoutAudit.preparedCard!.right).toBeLessThanOrEqual(desktopLayoutAudit.viewportWidth - 8);
        expect(desktopLayoutAudit.hudAnchorLayer!.x, '玩家界面锚点层必须贴齐屏幕左边，不能套 16:9 内框').toBeLessThanOrEqual(1);
        expect(desktopLayoutAudit.hudAnchorLayer!.y, '玩家界面锚点层必须贴齐屏幕顶部，不能套 16:9 内框').toBeLessThanOrEqual(1);
        expect(desktopLayoutAudit.hudAnchorLayer!.right, '玩家界面锚点层必须覆盖屏幕右边').toBeGreaterThanOrEqual(desktopLayoutAudit.viewportWidth - 1);
        expect(desktopLayoutAudit.hudAnchorLayer!.bottom, '玩家界面锚点层必须覆盖屏幕底部').toBeGreaterThanOrEqual(desktopLayoutAudit.viewportHeight - 1);
        const desktopBottomViewportGridGap = desktopLayoutAudit.viewportHeight - desktopLayoutAudit.bottomViewportGrid!.bottom;
        expect(desktopBottomViewportGridGap, '底部法术书牌列和计划区必须锚到真实视口底部，并保留少量安全空隙').toBeGreaterThanOrEqual(6);
        expect(desktopBottomViewportGridGap, '底部法术书牌列和计划区不能被整体上移成底部空带').toBeLessThanOrEqual(16);
        expect(desktopLayoutAudit.arenaViewport).not.toBeNull();
        expect(desktopLayoutAudit.arenaViewport!.x, '地图视窗必须贴齐屏幕左边，不能再被 16:9 内框限制').toBeLessThanOrEqual(1);
        expect(desktopLayoutAudit.arenaViewport!.y, '地图视窗必须贴齐屏幕顶部，不能再被 16:9 内框限制').toBeLessThanOrEqual(1);
        expect(desktopLayoutAudit.arenaViewport!.right, '地图视窗必须覆盖屏幕右边').toBeGreaterThanOrEqual(desktopLayoutAudit.viewportWidth - 1);
        expect(desktopLayoutAudit.arenaViewport!.bottom, '地图视窗必须覆盖屏幕底部').toBeGreaterThanOrEqual(desktopLayoutAudit.viewportHeight - 1);
        expect(desktopLayoutAudit.arenaStage!.x, '默认地图内容必须覆盖真实视口左边，不得缩在中间框').toBeLessThanOrEqual(1);
        expect(desktopLayoutAudit.arenaStage!.y, '默认地图内容必须覆盖真实视口顶部，不得缩在中间框').toBeLessThanOrEqual(1);
        expect(desktopLayoutAudit.arenaStage!.right, '默认地图内容必须覆盖真实视口右边').toBeGreaterThanOrEqual(desktopLayoutAudit.viewportWidth - 1);
        expect(desktopLayoutAudit.arenaStage!.bottom, '默认地图内容必须覆盖真实视口底部，底部 UI 作为叠加层而不是地图裁剪边界').toBeGreaterThanOrEqual(desktopLayoutAudit.viewportHeight - 1);
        expect(Math.abs(
            desktopLayoutAudit.arenaStage!.width / desktopLayoutAudit.arenaStage!.height
            - 4 / 3,
        )).toBeLessThanOrEqual(0.01);
        expect(desktopLayoutAudit.arenaImage).not.toBeNull();
        expect(Math.abs(desktopLayoutAudit.arenaImage!.x - desktopLayoutAudit.arenaStage!.x)).toBeLessThanOrEqual(2);
        expect(Math.abs(desktopLayoutAudit.arenaImage!.y - desktopLayoutAudit.arenaStage!.y)).toBeLessThanOrEqual(2);
        expect(Math.abs(desktopLayoutAudit.arenaImage!.width - desktopLayoutAudit.arenaStage!.width)).toBeLessThanOrEqual(2);
        expect(Math.abs(desktopLayoutAudit.arenaImage!.height - desktopLayoutAudit.arenaStage!.height)).toBeLessThanOrEqual(2);
        const expectedArenaZones = {
            a1: { column: 0, row: 0 },
            b1: { column: 1, row: 0 },
            c1: { column: 2, row: 0 },
            d1: { column: 3, row: 0 },
            a2: { column: 0, row: 1 },
            b2: { column: 1, row: 1 },
            c2: { column: 2, row: 1 },
            d2: { column: 3, row: 1 },
            a3: { column: 0, row: 2 },
            b3: { column: 1, row: 2 },
            c3: { column: 2, row: 2 },
            d3: { column: 3, row: 2 },
        } as const;
        expect(desktopLayoutAudit.arenaZones.map((zone) => zone.zoneId).sort()).toEqual(Object.keys(expectedArenaZones).sort());
        desktopLayoutAudit.arenaZones.forEach((zone) => {
            expect(zone.rect).not.toBeNull();
            const expected = zone.zoneId ? expectedArenaZones[zone.zoneId as keyof typeof expectedArenaZones] : undefined;
            expect(expected).toBeDefined();
            expect(Math.abs(zone.rect!.x - (desktopLayoutAudit.arenaStage!.x + desktopLayoutAudit.arenaStage!.width * 0.25 * expected!.column))).toBeLessThanOrEqual(2);
            expect(Math.abs(zone.rect!.y - (desktopLayoutAudit.arenaStage!.y + desktopLayoutAudit.arenaStage!.height / 3 * expected!.row))).toBeLessThanOrEqual(2);
            expect(Math.abs(zone.rect!.width - desktopLayoutAudit.arenaStage!.width * 0.25)).toBeLessThanOrEqual(2);
            expect(Math.abs(zone.rect!.height - desktopLayoutAudit.arenaStage!.height / 3)).toBeLessThanOrEqual(2);
        });
        expect(desktopLayoutAudit.opponentHud!.right).toBeGreaterThanOrEqual(desktopLayoutAudit.viewportWidth - 20);
        expect(desktopLayoutAudit.opponentHud!.y).toBeLessThanOrEqual(80);
        expect(desktopLayoutAudit.opponentPreparedMirror!.x, '对手已计划卡背必须在右上对手 HUD 左侧，不应留在左上角').toBeGreaterThan(desktopLayoutAudit.viewportWidth * 0.5);
        expect(desktopLayoutAudit.opponentPreparedMirror!.right).toBeLessThanOrEqual(desktopLayoutAudit.opponentHud!.x);
        expect(Math.abs(desktopLayoutAudit.opponentPreparedMirror!.y - desktopLayoutAudit.opponentHud!.y)).toBeLessThanOrEqual(3);
        expect(desktopLayoutAudit.selfHud!.x, '己方 HUD 必须留在左半区，但要避开竞技场首列实体').toBeGreaterThanOrEqual(desktopLayoutAudit.viewportWidth * 0.24);
        expect(desktopLayoutAudit.selfHud!.x, '己方 HUD 不得漂到中场或右侧玩家区').toBeLessThanOrEqual(desktopLayoutAudit.viewportWidth * 0.36);
        expect(desktopLayoutAudit.selfHud!.y, '己方 HUD 必须在左下独立层，不应回到左上角').toBeGreaterThan(desktopLayoutAudit.viewportHeight * 0.25);
        expect(desktopLayoutAudit.selfHud!.bottom, '己方 HUD 应靠近左下桌面区，而不是顶部 HUD 带').toBeGreaterThan(desktopLayoutAudit.viewportHeight * 0.55);
        expect(desktopLayoutAudit.selfHud!.bottom, '己方 HUD 必须上移离开底部牌区').toBeLessThan(desktopLayoutAudit.bottomViewportGrid!.y);
        expect(Math.abs(desktopLayoutAudit.spellbookShelf!.bottom - desktopLayoutAudit.preparedArea!.bottom)).toBeLessThanOrEqual(3);
        expect(Math.abs(desktopLayoutAudit.spellbookCard!.bottom - desktopLayoutAudit.preparedCard!.bottom)).toBeLessThanOrEqual(3);
        expect(desktopLayoutAudit.spellbookShelf!.x).toBeLessThanOrEqual(24);
        expect(desktopLayoutAudit.discardPile!.right).toBeLessThanOrEqual(desktopLayoutAudit.viewportWidth - 44);
        expect(desktopLayoutAudit.preparedCard!.height).toBeGreaterThanOrEqual(215);
        expect(desktopLayoutAudit.spellbookCard!.height).toBeGreaterThanOrEqual(280);
        expect(desktopLayoutAudit.preparedCard!.width).toBeGreaterThanOrEqual(150);
        expect(desktopLayoutAudit.spellbookCard!.width).toBeGreaterThanOrEqual(195);
        expect(desktopLayoutAudit.preparedArea!.y).toBeGreaterThan(desktopLayoutAudit.turnEnd!.bottom);
        expect(Math.abs(
            desktopLayoutAudit.turnEnd!.x + desktopLayoutAudit.turnEnd!.width / 2
            - (desktopLayoutAudit.preparedArea!.x + desktopLayoutAudit.preparedArea!.width / 2),
        )).toBeLessThanOrEqual(2);
        expect(desktopLayoutAudit.fieldCards).toHaveLength(10);
        expect(desktopLayoutAudit.fieldCards.every((card) => card.zoneId === 'a2')).toBe(true);
        expect(desktopLayoutAudit.fieldCards.filter((card) => card.role === 'target').length).toBeGreaterThan(0);
        expect(desktopLayoutAudit.fieldCards.filter((card) => card.ownerSide === 'seat-left')).toHaveLength(5);
        expect(desktopLayoutAudit.fieldCards.filter((card) => card.ownerSide === 'seat-right')).toHaveLength(5);
        expect(desktopLayoutAudit.ownershipLanes).toHaveLength(2);
        expect(desktopLayoutAudit.ownershipLanes).toMatchObject([
            {
                zoneId: 'a2',
                ownerSide: 'seat-left',
                laneAxis: 'horizontal',
                stackAxis: 'vertical',
                overflowMode: 'wrap-columns',
                maxRows: 3,
                fieldCardCount: 5,
                mageEntityCount: 1,
            },
            {
                zoneId: 'a2',
                ownerSide: 'seat-right',
                laneAxis: 'horizontal',
                stackAxis: 'vertical',
                overflowMode: 'wrap-columns',
                maxRows: 3,
                fieldCardCount: 5,
                mageEntityCount: 1,
            },
        ]);
        const leftOwnerLane = desktopLayoutAudit.ownershipLanes.find((lane) => lane.ownerSide === 'seat-left');
        const rightOwnerLane = desktopLayoutAudit.ownershipLanes.find((lane) => lane.ownerSide === 'seat-right');
        expect(leftOwnerLane?.rect).not.toBeNull();
        expect(rightOwnerLane?.rect).not.toBeNull();
        const leftOwnerLaneCenterX = leftOwnerLane!.rect!.x + leftOwnerLane!.rect!.width / 2;
        const rightOwnerLaneCenterX = rightOwnerLane!.rect!.x + rightOwnerLane!.rect!.width / 2;
        const ownerLaneHorizontalSeparation = rightOwnerLaneCenterX - leftOwnerLaneCenterX;
        const ownerLaneVerticalSeparation = Math.abs(
            (rightOwnerLane!.rect!.y + rightOwnerLane!.rect!.height / 2)
            - (leftOwnerLane!.rect!.y + leftOwnerLane!.rect!.height / 2),
        );
        expect(ownerLaneHorizontalSeparation, '同格必须先按席位左右分 lane，不能回到整体上下分区').toBeGreaterThan(ownerLaneVerticalSeparation);
        type LaneItemRectAudit = {
            rect: {
                x: number;
                y: number;
                width: number;
                height: number;
                right: number;
                bottom: number;
            };
        };
        const groupByApproximateColumn = <T extends LaneItemRectAudit>(items: T[]) => {
            const columns: T[][] = [];
            [...items]
                .sort((left, right) => left.rect.x - right.rect.x || left.rect.y - right.rect.y)
                .forEach((item) => {
                    const centerX = item.rect.x + item.rect.width / 2;
                    const existingColumn = columns.find((column) => {
                        const first = column[0];
                        if (!first) return false;
                        const firstCenterX = first.rect.x + first.rect.width / 2;
                        return Math.abs(firstCenterX - centerX) <= 8;
                    });
                    if (existingColumn) {
                        existingColumn.push(item);
                    } else {
                        columns.push([item]);
                    }
                });
            return columns;
        };
        const hasVisibleOverlap = (left: LaneItemRectAudit, right: LaneItemRectAudit) => (
            left.rect.x < right.rect.right - 1
            && left.rect.right > right.rect.x + 1
            && left.rect.y < right.rect.bottom - 1
            && left.rect.bottom > right.rect.y + 1
        );
        desktopLayoutAudit.ownershipLanes.forEach((lane) => {
            expect(lane.className, `${lane.ownerSide} 压力态必须使用列换行布局`).toContain('grid-flow-col');
            expect(lane.overflowMode).toBe('wrap-columns');
            expect(lane.maxRows).toBe(3);
            expect(lane.overflowY, `${lane.ownerSide} 不得再用纵向滚动吞掉第 4+ 个单位`).toBe('visible');
            expect(lane.items).toHaveLength(6);
            lane.items.forEach((item) => {
                expect(item.position, `${lane.ownerSide} lane item 不得 absolute 压叠`).not.toBe('absolute');
                expect(item.transform, `${lane.ownerSide} lane item 不得 transform 错位压叠`).toBe('none');
                expect(Number.parseFloat(item.marginTop), `${lane.ownerSide} lane item 不得用负 margin 压叠`).toBeGreaterThanOrEqual(0);
            });
            lane.items.forEach((item, index) => {
                lane.items.slice(index + 1).forEach((other) => {
                    expect(hasVisibleOverlap(item, other), `${lane.ownerSide} 同阵营单位不得互相重叠`).toBe(false);
                });
            });
            const columns = groupByApproximateColumn(lane.items);
            expect(columns, `${lane.ownerSide} 六个单位必须自动换成两列`).toHaveLength(2);
            columns.forEach((column) => {
                expect(column.length, `${lane.ownerSide} 每列最多三个单位`).toBeLessThanOrEqual(3);
                const sortedColumn = [...column].sort((left, right) => left.rect.y - right.rect.y);
                sortedColumn.slice(1).forEach((item, index) => {
                    const previous = sortedColumn[index];
                    expect(item.rect.y, `${lane.ownerSide} 同列单位必须上下排列且不重叠`).toBeGreaterThanOrEqual(previous.rect.bottom - 1);
                });
            });
        });
        desktopLayoutAudit.fieldCards.forEach((card) => {
            expect(card.rect).not.toBeNull();
            expect(card.laneAxis).toBe('horizontal');
            expect(card.laneStackAxis).toBe('vertical');
            expect(card.rect!.width).toBeGreaterThan(100);
            expect(card.rect!.width).toBeLessThan(114);
            expect(card.rect!.height).toBeGreaterThan(142);
            expect(card.rect!.height).toBeLessThan(160);
            expect(card.aspectRatio).toBeGreaterThan(0.70);
            expect(card.aspectRatio).toBeLessThan(0.72);
        });
        const fieldCardsBySide = ['seat-left', 'seat-right'].map((ownerSide) => ({
            ownerSide,
            cards: desktopLayoutAudit.fieldCards.filter((card) => card.ownerSide === ownerSide),
        }));
        fieldCardsBySide.forEach(({ ownerSide, cards }) => {
            const centerXRange = Math.max(...cards.map((card) => card.centerX)) - Math.min(...cards.map((card) => card.centerX));
            const centerYRange = Math.max(...cards.map((card) => card.centerY)) - Math.min(...cards.map((card) => card.centerY));
            expect(centerYRange, `${ownerSide} 同阵营多个单位必须在自己的 lane 内上下排列`).toBeGreaterThan(centerXRange);
        });
        const leftLaneCenterX = desktopLayoutAudit.fieldCards
            .filter((card) => card.ownerSide === 'seat-left')
            .reduce((total, card) => total + card.centerX, 0) / 5;
        const rightLaneCenterX = desktopLayoutAudit.fieldCards
            .filter((card) => card.ownerSide === 'seat-right')
            .reduce((total, card) => total + card.centerX, 0) / 5;
        expect(rightLaneCenterX - leftLaneCenterX, '左右席位 lane 必须在同格内水平分离').toBeGreaterThan(40);
        await applyMageWarsCombatFocusState(page);
        await clickVisibleMageWarsFieldCard(page, 'mw-test-focus-red-angel');
        await expect(page.locator('[data-testid="mage-wars-zone-field-card"][data-object-id="mw-test-focus-red-angel"][data-field-card-role="source"]')).toBeVisible();
        await expect(page.locator('[data-testid="mage-wars-zone-field-card"][data-object-id="mw-test-focus-blue-archer"][data-field-card-role="target"]')).toBeVisible();
        const focusGuardActionButton = page.getByTestId('mage-wars-selected-unit-guard');
        await expect(focusGuardActionButton).toBeVisible();
        await expect(focusGuardActionButton).toHaveAttribute('data-action-kind', 'guard');
        await expect(focusGuardActionButton).toHaveAttribute('data-action-visual', 'text-action');
        await expect(focusGuardActionButton).toHaveAttribute('data-action-placement', 'source-card-below');
        await expect(focusGuardActionButton.locator('img')).toHaveCount(0);
        await expect(focusGuardActionButton.locator('svg')).toHaveCount(0);
        await expect(focusGuardActionButton).toContainText(/守卫|guard/i);
        await expect(focusGuardActionButton).not.toContainText('进行守卫');
        await expect(page.getByTestId('mage-wars-desktop-settlement-overlay')).toHaveCount(0);
        const combatFocusAudit = await page.evaluate(() => {
            const zone = document.querySelector<HTMLElement>('[data-testid="mage-wars-arena-zone-a2"]')?.getBoundingClientRect();
            const target = document.querySelector<HTMLElement>('[data-object-id="mw-test-focus-blue-archer"]')?.getBoundingClientRect();
            if (!zone || !target) return null;
            const targetCenter = {
                x: target.left + target.width / 2,
                y: target.top + target.height / 2,
            };
            const hit = document.elementFromPoint(targetCenter.x, targetCenter.y)
                ?.closest<HTMLElement>('[data-testid="mage-wars-zone-field-card"]');
            return {
                targetInsideA2: target.left >= zone.left
                    && target.right <= zone.right
                    && target.top >= zone.top
                    && target.bottom <= zone.bottom,
                targetCenterHitsTarget: hit?.dataset.objectId === 'mw-test-focus-blue-archer',
            };
        });
        expect(combatFocusAudit).not.toBeNull();
        expect(combatFocusAudit!.targetInsideA2).toBe(true);
        expect(combatFocusAudit!.targetCenterHitsTarget).toBe(true);
        const interactionVisualAudit = await page.evaluate(() => {
            const source = document.querySelector<HTMLElement>('[data-object-id="mw-test-focus-red-angel"]');
            const target = document.querySelector<HTMLElement>('[data-object-id="mw-test-focus-blue-archer"]');
            const sourceFrame = source?.querySelector<HTMLElement>('[data-testid="mage-wars-field-card-source-frame"]');
            const targetFrame = target?.querySelector<HTMLElement>('[data-testid="mage-wars-field-card-target-frame"]');
            const targetZone = target?.closest<HTMLElement>('[data-testid^="mage-wars-arena-zone-"]');
            const legalMoveZone = document.querySelector<HTMLElement>('[data-legal-move-zone="true"]');
            const readRect = (element?: HTMLElement | null) => {
                if (!element) return null;
                const rect = element.getBoundingClientRect();
                return {
                    left: rect.left,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                    width: rect.width,
                    height: rect.height,
                };
            };
            const readFrameDelta = (host?: HTMLElement | null, frame?: HTMLElement | null) => {
                const hostRect = readRect(host);
                const frameRect = readRect(frame);
                if (!hostRect || !frameRect) return null;
                return {
                    left: Math.abs(frameRect.left - hostRect.left),
                    top: Math.abs(frameRect.top - hostRect.top),
                    right: Math.abs(frameRect.right - hostRect.right),
                    bottom: Math.abs(frameRect.bottom - hostRect.bottom),
                    width: Math.abs(frameRect.width - hostRect.width),
                    height: Math.abs(frameRect.height - hostRect.height),
                };
            };
            return {
                sourceClassName: source?.className ?? '',
                targetClassName: target?.className ?? '',
                sourceFrameClassName: sourceFrame?.className ?? '',
                targetFrameClassName: targetFrame?.className ?? '',
                sourceFrameDelta: readFrameDelta(source, sourceFrame),
                targetFrameDelta: readFrameDelta(target, targetFrame),
                targetZoneScope: targetZone?.dataset.zoneTargetScope ?? '',
                targetZoneClassName: targetZone?.className ?? '',
                legalMoveClassName: legalMoveZone?.className ?? '',
            };
        });
        expect(interactionVisualAudit.sourceClassName).toContain('-translate-y-2');
        expect(interactionVisualAudit.sourceFrameClassName).toContain('border-cyan-100');
        expect(interactionVisualAudit.sourceFrameClassName).toContain('border-2');
        expect(interactionVisualAudit.targetFrameClassName).toContain('border-emerald-300/95');
        expect(interactionVisualAudit.targetFrameClassName).toContain('border-2');
        expect(interactionVisualAudit.sourceFrameClassName).toContain('inset-0');
        expect(interactionVisualAudit.targetFrameClassName).toContain('inset-0');
        expect(interactionVisualAudit.sourceFrameClassName).not.toContain('-inset');
        expect(interactionVisualAudit.targetFrameClassName).not.toContain('-inset');
        expect(interactionVisualAudit.sourceFrameDelta).not.toBeNull();
        expect(interactionVisualAudit.targetFrameDelta).not.toBeNull();
        Object.entries(interactionVisualAudit.sourceFrameDelta!).forEach(([edge, delta]) => {
            expect(delta, `来源描边必须贴来源本体 ${edge}`).toBeLessThanOrEqual(2);
        });
        Object.entries(interactionVisualAudit.targetFrameDelta!).forEach(([edge, delta]) => {
            expect(delta, `目标描边必须贴目标本体 ${edge}`).toBeLessThanOrEqual(2);
        });
        expect(['', 'object']).toContain(interactionVisualAudit.targetZoneScope);
        expect(interactionVisualAudit.targetZoneClassName).not.toContain('outline-emerald');
        expect(interactionVisualAudit.targetZoneClassName).not.toContain('rgba(110,231,183');
        expect(interactionVisualAudit.legalMoveClassName).toContain('bg-sky-300/8');
        await mkdir(dirname(SCREENSHOT_PATH), { recursive: true });
        await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });

        const attackDiceVisibleFrame = page.waitForFunction(() => {
            const dice = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-attack-dice"]');
            if (!dice) return false;
            const rect = dice.getBoundingClientRect();
            return rect.width > 0
                && rect.height > 0
                && Number.parseFloat(getComputedStyle(dice).opacity) >= 0.65;
        }, undefined, { timeout: 5_000 });
        await clickVisibleMageWarsFieldCard(page, 'mw-test-focus-blue-archer');
        await attackDiceVisibleFrame;
        await expect.poll(async () => page.evaluate(() => {
            const state = (window as Window & {
                __BG_TEST_HARNESS__?: MageWarsHarness;
            }).__BG_TEST_HARNESS__?.state?.get?.();
            return (state?.sys as { eventStream?: { entries?: Array<{ event?: { type?: string } }> } } | undefined)
                ?.eventStream?.entries?.some((entry) => entry.event?.type === 'MW_ARENA_OBJECT_ATTACK_DECLARED') ?? false;
        }), { timeout: 5_000 }).toBe(true);
        await expect(page.getByTestId('mage-wars-fx-attack-dice')).toBeVisible({ timeout: 5_000 });
        await expect(page.getByTestId('mage-wars-fx-attack-die-face').first()).toBeVisible();
        const settlementAudit = await page.evaluate(() => {
            const stage = document.querySelector<HTMLElement>('[data-testid="mage-wars-arena-stage"]')?.getBoundingClientRect();
            const dice = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-attack-dice"]')?.getBoundingClientRect();
            return stage && dice ? {
                diceInsideArena: dice.left >= stage.left && dice.right <= stage.right && dice.top >= stage.top && dice.bottom <= stage.bottom,
                diceCenterX: dice.left + dice.width / 2,
                stageCenterX: stage.left + stage.width / 2,
            } : null;
        });
        expect(settlementAudit).not.toBeNull();
        expect(settlementAudit!.diceInsideArena).toBe(true);
        await page.screenshot({ path: ATTACK_SETTLEMENT_SCREENSHOT_PATH, fullPage: false });
        await expectMageWarsArenaFreeViewport(page);

        await assertNoFatalFrontendErrors([{ label: 'mage-wars', diagnostics }]);
    });

    test('2560x1304 真实入口验证放大镜悬浮、宽屏布局和地图自由查看', async ({ context, page }) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width: 2560, height: 1304 });
        const diagnostics = await openMageWarsBoard(context, page, 'mage-wars-foundation-runtime-board-2560x1304');

        await expect(page.getByTestId('mage-wars-board')).toHaveAttribute('data-mage-wars-current-player-id', '0');
        await expectMageWarsDefaultBrowseInteractions(page);
        await expectMageWarsDesktop2560Layout(page);
        await auditMageWarsImages(page, ['法师魔杖', '巨熊皮甲', '群兽法杖', '元素斗篷', '重生腰带']);

        await applyMageWarsPlanningState(page);
        const duplicateSpellbookCardInfo = await findVisibleDuplicateSpellbookCard(page);
        const duplicateSpellbookCard = page.locator(
            `[data-testid="mage-wars-desktop-spellbook-card"][data-source-card-id="${duplicateSpellbookCardInfo.cardId}"]`,
        );
        await expect(duplicateSpellbookCard).toBeVisible({ timeout: 5_000 });
        await expect(duplicateSpellbookCard).toHaveAttribute('data-secondary-inspect', 'true');
        await expect(duplicateSpellbookCard).toHaveAttribute('data-copy-count', duplicateSpellbookCardInfo.copyCount);

        const duplicateInspectButton = duplicateSpellbookCard.locator('xpath=..').getByTestId('mage-wars-card-inspect-button');
        await expect(duplicateInspectButton).toBeVisible({ timeout: 5_000 });
        await expect(duplicateInspectButton.locator('svg')).toHaveCount(1);
        const initialInspectStyle = await duplicateInspectButton.evaluate((button) => {
            const style = getComputedStyle(button);
            const rect = button.getBoundingClientRect();
            const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
            return {
                backgroundColor: style.backgroundColor,
                color: style.color,
                borderTopColor: style.borderTopColor,
                width: rect.width,
                height: rect.height,
                hitButton: hit?.closest('[data-testid="mage-wars-card-inspect-button"]') === button,
            };
        });
        expect(initialInspectStyle.width).toBeGreaterThanOrEqual(24);
        expect(initialInspectStyle.height).toBeGreaterThanOrEqual(24);
        expect(initialInspectStyle.width).toBeLessThanOrEqual(34);
        expect(initialInspectStyle.height).toBeLessThanOrEqual(34);
        expect(initialInspectStyle.hitButton).toBe(true);
        await duplicateInspectButton.hover();
        await expect.poll(async () => duplicateInspectButton.evaluate((button) => getComputedStyle(button).backgroundColor))
            .not.toBe(initialInspectStyle.backgroundColor);
        const hoveredInspectStyle = await duplicateInspectButton.evaluate((button) => {
            const style = getComputedStyle(button);
            return {
                backgroundColor: style.backgroundColor,
                color: style.color,
                borderTopColor: style.borderTopColor,
            };
        });
        expect(hoveredInspectStyle.color).not.toBe(initialInspectStyle.color);
        expect(hoveredInspectStyle.borderTopColor).not.toBe(initialInspectStyle.borderTopColor);

        await mkdir(dirname(DESKTOP_2560_PLANNING_HOVER_SCREENSHOT_PATH), { recursive: true });
        await page.screenshot({ path: DESKTOP_2560_PLANNING_HOVER_SCREENSHOT_PATH, fullPage: false });
        await duplicateInspectButton.click();
        await expect(page.getByTestId('mage-wars-card-magnify-overlay')).toBeVisible({ timeout: 5_000 });
        await expect(page.getByTestId('mage-wars-card-magnify-content')).toHaveAttribute('data-source-card-id', duplicateSpellbookCardInfo.cardId);
        expect(await duplicateSpellbookCard.getAttribute('data-selected-count')).toBeNull();
        await page.getByTestId('mage-wars-card-magnify-overlay-close').click();
        await expect(page.getByTestId('mage-wars-card-magnify-overlay')).toBeHidden({ timeout: 5_000 });

        await duplicateSpellbookCard.click();
        await expect(duplicateSpellbookCard).toHaveAttribute('data-selected-count', '1');
        await expect(duplicateSpellbookCard.getByTestId('mage-wars-spellbook-selected-count')).toHaveCount(0);
        await duplicateSpellbookCard.click();
        await expect(duplicateSpellbookCard).toHaveAttribute('data-selected-count', '2');
        await expect(duplicateSpellbookCard.getByTestId('mage-wars-spellbook-selected-count')).toHaveCount(0);
        await expect(page.locator(
            `[data-testid="mage-wars-desktop-prepared-card"][data-planning-draft="true"][data-source-card-id="${duplicateSpellbookCardInfo.cardId}"]`,
        )).toHaveCount(2);
        const planSpellsButton = page.getByTestId('mage-wars-plan-spells');
        await expect(planSpellsButton).toBeVisible({ timeout: 5_000 });
        await expect(planSpellsButton).toHaveText('确认计划 2/2');
        await expect(planSpellsButton).toHaveAttribute('data-plan-progress', '2/2');
        await page.screenshot({ path: DESKTOP_2560_SCREENSHOT_PATH, fullPage: false });

        await expectMageWarsArenaFreeViewport(page, {
            verifySpellbookInspectAfterDrag: false,
            dragScreenshotPath: DESKTOP_2560_DRAGGED_MAP_SCREENSHOT_PATH,
        });
        await assertNoFatalFrontendErrors([{ label: 'mage-wars-2560x1304', diagnostics }]);
    });

    test('移动横屏真实入口加载正式牌桌素材并落验收截图', async ({ context, page }) => {
        test.setTimeout(60_000);
        await page.setViewportSize({ width: 844, height: 390 });
        const diagnostics = await openMageWarsBoard(context, page, 'mage-wars-foundation-runtime-board-mobile');
        const imageAudit = await auditMageWarsImages(page);
        expect(imageAudit.images.some((image) => image.alt === '法师战争标准竞技场' && image.rect.width > 0 && image.rect.height > 0)).toBe(true);

        const layoutAudit = await page.evaluate(() => {
            const board = document.querySelector<HTMLElement>('[data-testid="mage-wars-board"]');
            const boardRect = board?.getBoundingClientRect();
            return {
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight,
                },
                document: {
                    scrollWidth: document.documentElement.scrollWidth,
                    scrollHeight: document.documentElement.scrollHeight,
                },
                board: boardRect
                    ? {
                        x: boardRect.x,
                        y: boardRect.y,
                        width: boardRect.width,
                        height: boardRect.height,
                        right: boardRect.right,
                        bottom: boardRect.bottom,
                    }
                    : null,
            };
        });
        expect(layoutAudit.board).not.toBeNull();
        expect(layoutAudit.board!.width).toBeGreaterThanOrEqual(820);
        expect(layoutAudit.board!.height).toBeGreaterThanOrEqual(370);
        expect(layoutAudit.document.scrollWidth).toBeLessThanOrEqual(layoutAudit.viewport.width + 2);

        await mkdir(dirname(MOBILE_SCREENSHOT_PATH), { recursive: true });
        await page.screenshot({ path: MOBILE_SCREENSHOT_PATH, fullPage: false });

        await assertNoFatalFrontendErrors([{ label: 'mage-wars-mobile', diagnostics }]);
    });
});
