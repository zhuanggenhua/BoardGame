/** PC历史构图与手机等比回归。库存为测试预置，不冒充自然游玩或安卓真机。 */
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import { GameTestContext } from '../framework/GameTestContext';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { initContext } from '../helpers/common';
import { closeDebugPanelIfOpen } from '../helpers/dicethrone';

const states = [
    { id: '无Token常态', tokens: {}, statusEffects: {} },
    { id: '两个Token', tokens: { flight: 1, purify: 1 }, statusEffects: {} },
    { id: '英雄库存与负面状态', tokens: { flight: 1, purify: 1, divine_arrival: 1, blessing_of_divinity: 1 }, statusEffects: { concussion: 1 } },
];
// 旧候选混用其它英雄的6种Token+4种状态；合成容量诊断及历史失败保留于
// .tmp/dt-fit-20261019/runtime，不将其当作本局英雄自然可获得的库存。
const scene = (state: typeof states[number]) => ({
    gameId: 'dicethrone', currentPlayer: '0', phase: 'main1',
    player0: { resources: { hp: 50, cp: 3 }, tokens: state.tokens, statusEffects: state.statusEffects },
    player1: { resources: { hp: 50, cp: 3 }, tokens: {} },
    extra: { selectedCharacters: { '0': 'tianshi', '1': 'barbarian' }, hostStarted: true },
    sys: { phase: 'main1', currentPlayerIndex: 0, interaction: { current: undefined, queue: [] }, responseWindow: { current: undefined } },
});
const selectors = {
    phase: '[data-testid="dt-phase-indicator"]', resources: '[data-testid="dt-player-stats-panel"]',
    deck: '[data-testid="dt-draw-deck-card"]', board: '[data-testid="player-board-surface"]',
    sidebar: '[data-testid="left-sidebar"]', selfPanelGroup: '[data-testid="self-player-panel-group"]',
    statusTokens: '[data-tutorial-id="status-tokens"]',
    tip: '[data-tutorial-id="tip-board"]', opponent: '[data-testid="dt-top-header-1"]',
    hand: '[data-testid="hand-area"] [data-card-id]', action: '[data-tutorial-id="advance-phase-button"]',
    dice: '[data-testid="dicethrone-2d-dice-tray"]',
};
const measure = async (page: Page) => {
    await closeDebugPanelIfOpen(page);
    await page.mouse.move(1, 1);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => {
        const images = Array.from(document.querySelectorAll<HTMLImageElement>('[data-testid="player-board-surface"] img, [data-testid="dt-draw-deck-card"] img'));
        return images.length >= 2 && images.every(image => image.complete && image.naturalWidth > 0);
    });
    await page.waitForTimeout(500);
    return page.evaluate(selectors => {
        const root = getComputedStyle(document.documentElement);
        const rects = Object.fromEntries(Object.entries(selectors).map(([key, selector]) => {
            const r = document.querySelector(selector)?.getBoundingClientRect();
            return [key, r ? { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right } : null];
        }));
        const title = document.querySelector<HTMLElement>('.dt-phase-indicator__title')!;
        const titleStyle = getComputedStyle(title);
        const items = Array.from(document.querySelectorAll<HTMLElement>('[data-dt-phase-item]'));
        const activePhaseCount = document.querySelectorAll('[data-dt-phase-active="true"]').length;
        const tokens = Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="dt-player-0-token-"][data-token-id], [data-testid^="dt-player-0-status-"][data-status-id]'));
        const asRect = (element: Element | null) => {
            if (!element) return null;
            const r = element.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
        };
        const intersects = (a: DOMRect | null, b: DOMRect | null) => Boolean(a && b
            && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
        const phaseRect = document.querySelector(selectors.phase)?.getBoundingClientRect() ?? null;
        const resourcesRect = document.querySelector(selectors.resources)?.getBoundingClientRect() ?? null;
        const deckRect = document.querySelector('[data-tutorial-id="draw-deck"]')?.getBoundingClientRect() ?? null;
        const statusTokensRect = document.querySelector(selectors.statusTokens)?.getBoundingClientRect() ?? null;
        const sidebar = document.querySelector<HTMLElement>(selectors.sidebar);
        const selfPanelGroup = document.querySelector<HTMLElement>(selectors.selfPanelGroup);
        const pageBackground = document.querySelector<HTMLImageElement>('[data-testid="dicethrone-page-background"]');
        const handToggle = document.querySelector('[data-testid="dicethrone-hand-visibility-toggle"]');
        const handToggleHitArea = document.querySelector('[data-testid="dicethrone-hand-visibility-hit-area"]');
        const handToggleVisual = document.querySelector('[data-testid="dicethrone-hand-visibility-visual"]');
        const handToggleRect = handToggle?.getBoundingClientRect();
        const handToggleCenterTarget = handToggleRect
            ? document.elementFromPoint(handToggleRect.left + handToggleRect.width / 2, handToggleRect.top + handToggleRect.height / 2)
            : null;
        return { rects,
            activePhaseCount,
            density: sidebar?.dataset.dicethroneLeftHudDensity ?? null,
            selfPanelDisplay: selfPanelGroup ? getComputedStyle(selfPanelGroup).display : null,
            selfPanelFlexDirection: selfPanelGroup ? getComputedStyle(selfPanelGroup).flexDirection : null,
            selfPanelGridTemplateAreas: selfPanelGroup ? getComputedStyle(selfPanelGroup).gridTemplateAreas : null,
            mobileProfile: document.querySelector<HTMLElement>('[data-game-page="true"]')?.dataset.mobileProfile ?? null,
            mobileLayoutPreset: document.querySelector<HTMLElement>('[data-game-page="true"]')?.dataset.mobileLayoutPreset ?? null,
            pageBackground: asRect(pageBackground),
            pageBackgroundFit: pageBackground ? getComputedStyle(pageBackground).objectFit : null,
            pageBackgroundLoaded: Boolean(pageBackground?.complete && pageBackground.naturalWidth > 0),
            pageBackgroundInsideShell: Boolean(pageBackground?.closest('.mobile-board-shell')),
            scrollWidths: { document: document.documentElement.scrollWidth, body: document.body.scrollWidth },
            shell: asRect(document.querySelector('.mobile-board-shell')),
            handToggle: asRect(handToggle),
            handToggleHitArea: asRect(handToggleHitArea),
            handToggleVisual: asRect(handToggleVisual),
            handToggleCenterHit: Boolean(handToggle && handToggleCenterTarget
                && (handToggle === handToggleCenterTarget || handToggle.contains(handToggleCenterTarget))),
            overlaps: {
                phaseResources: intersects(phaseRect, resourcesRect),
                phaseDeck: intersects(phaseRect, deckRect),
                phaseTokens: intersects(phaseRect, statusTokensRect),
            },
            title: { font: parseFloat(titleStyle.fontSize), marginBottom: parseFloat(titleStyle.marginBottom), marginLeft: parseFloat(titleStyle.marginLeft) },
            items: items.map(item => ({ font: parseFloat(getComputedStyle(item).fontSize), padding: getComputedStyle(item).padding, height: item.getBoundingClientRect().height })),
            tokens: tokens.map(item => { const r = item.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, top: r.top, bottom: r.bottom }; }),
            gap: parseFloat(getComputedStyle(document.querySelector('.dt-phase-indicator__list')!).gap),
            sidebarOverflow: getComputedStyle(document.querySelector('[data-testid="left-sidebar"]')!).overflowY,
            scale: parseFloat(root.getPropertyValue('--mobile-board-shell-scale')) || 1,
            offset: { x: parseFloat(root.getPropertyValue('--mobile-board-shell-offset-x')) || 0, y: parseFloat(root.getPropertyValue('--mobile-board-shell-offset-y')) || 0 },
            fit: document.documentElement.dataset.mobileBoardShellFit };
    }, selectors);
};

test('整屏沿用001构图：字号留白同倍率、Token及牌堆同时可见', async ({ page, game, browser, baseURL, workerPorts }, testInfo) => {
    test.setTimeout(180000);
    const pc = new Map<string, Awaited<ReturnType<typeof measure>>>();
    const shot = async (target: Page, name: string) => {
        const path = getEvidenceScreenshotPath(testInfo, name, { filename: `${name}.png`, requireChineseName: true });
        await mkdir(dirname(path), { recursive: true });
        await target.screenshot({ path, fullPage: false });
    };
    await page.setViewportSize({ width: 1920, height: 960 });
    await game.openTestGame('dicethrone', { playerID: '0', disableLocalAiAutomation: true }, 60000);
    for (const state of states) {
        await game.setupScene(scene(state));
        for (const viewport of [
            { label: 'PC1920x960', width: 1920, height: 960 },
            { label: 'PC1920x1080', width: 1920, height: 1080 },
            { label: '桌面压力2560x1304', width: 2560, height: 1304 },
        ]) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            const layout = await measure(page);
            expect(layout.pageBackground, `${viewport.label} 背景图必须占满游戏页面视口`).toMatchObject({ x: 0, y: 0, width: viewport.width, height: viewport.height });
            expect(layout.pageBackgroundFit).toBe('cover');
            expect(layout.pageBackgroundLoaded).toBe(true);
            expect(layout.pageBackgroundInsideShell).toBe(false);
            expect(layout.items).toHaveLength(7);
            expect(layout.activePhaseCount).toBe(1);
            expect(layout.density).toBe('normal');
            expect(layout.selfPanelDisplay).toBe('flex');
            expect(layout.selfPanelFlexDirection).toBe('column');
            expect(layout.selfPanelGridTemplateAreas).toBe('none');
            expect(layout.overlaps.phaseResources, `${viewport.label} 阶段提示不得压住生命/CP面板`).toBe(false);
            expect(layout.overlaps.phaseDeck, `${viewport.label} 阶段提示不得压住牌堆`).toBe(false);
            if (state.tokens && Object.keys(state.tokens).length + Object.keys(state.statusEffects).length > 0) {
                expect(layout.overlaps.phaseTokens, `${viewport.label} 阶段提示不得压住Token/状态`).toBe(false);
            }
            expect(layout.scrollWidths.document).toBeLessThanOrEqual(viewport.width + 1);
            expect(layout.scrollWidths.body).toBeLessThanOrEqual(viewport.width + 1);
            for (const [key, rect] of Object.entries(layout.rects)) {
                expect(rect, key).not.toBeNull();
                expect(rect!.x, `${viewport.label} ${key}.x`).toBeGreaterThanOrEqual(-1);
                expect(rect!.right, `${viewport.label} ${key}.right`).toBeLessThanOrEqual(viewport.width + 1);
                expect(rect!.y, `${viewport.label} ${key}.y`).toBeGreaterThanOrEqual(-1);
                if (key !== 'hand') expect(rect!.bottom, `${viewport.label} ${key}.bottom`).toBeLessThanOrEqual(viewport.height + 1);
            }
            if (viewport.width === 1920 && viewport.height === 960) {
                pc.set(state.id, layout);
                expect(layout.title.font).toBeCloseTo(17, 1);
                expect(layout.title.marginBottom).toBeCloseTo(7.68, 1);
                expect(layout.title.marginLeft).toBeCloseTo(5.76, 1);
                for (const item of layout.items) expect(item.font).toBeCloseTo(15, 1);
                // 001 及已通过截图的实测值，避免两端一起改小后仍因“等比”通过。
                expect(layout.rects.phase!.height).toBeCloseTo(370.375, 0);
                if (state.id === '两个Token') {
                    const activePhase = page.locator('[data-testid="dt-phase-indicator"] [data-dt-phase-active="true"]');
                    await activePhase.hover();
                    const tooltipRoot = page.getByTestId('info-tooltip');
                    await expect(tooltipRoot).toBeVisible();
                    await expect(tooltipRoot).toHaveCSS('opacity', '1');
                    const tooltip = await page.evaluate(() => {
                        const title = document.querySelector<HTMLElement>('[data-testid="info-tooltip-title"]');
                        const line = document.querySelector<HTMLElement>('[data-testid="info-tooltip-content-line"]');
                        const root = document.querySelector<HTMLElement>('[data-testid="info-tooltip"]');
                        const rect = root?.getBoundingClientRect();
                        return {
                            titleFont: title ? parseFloat(getComputedStyle(title).fontSize) : 0,
                            bodyFont: line ? parseFloat(getComputedStyle(line).fontSize) : 0,
                            visibility: root ? getComputedStyle(root).visibility : 'missing',
                            opacity: root ? parseFloat(getComputedStyle(root).opacity) : 0,
                            width: rect?.width ?? 0,
                            height: rect?.height ?? 0,
                            x: rect?.x ?? -1,
                            y: rect?.y ?? -1,
                            right: rect?.right ?? -1,
                            bottom: rect?.bottom ?? -1,
                        };
                    });
                    expect(tooltip.titleFont).toBeCloseTo(17.28, 1);
                    expect(tooltip.bodyFont).toBeCloseTo(13.44, 1);
                    expect(tooltip.visibility).toBe('visible');
                    expect(tooltip.opacity).toBe(1);
                    expect(tooltip.width).toBeGreaterThan(100);
                    expect(tooltip.height).toBeGreaterThan(50);
                    expect(tooltip.x).toBeGreaterThanOrEqual(0);
                    expect(tooltip.y).toBeGreaterThanOrEqual(0);
                    expect(tooltip.right).toBeLessThanOrEqual(1920);
                    expect(tooltip.bottom).toBeLessThanOrEqual(960);
                    await shot(page, 'PC1920x960-回合顺序阶段说明');
                    await page.mouse.move(1, 1);
                }
            }
            await shot(page, `${viewport.label}-${state.id}`);
        }
    }
    const context = await browser.newContext({ baseURL, viewport: { width: 936, height: 432 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true });
    await initContext(context, { skipImageGate: true, gameServerBaseURL: `http://127.0.0.1:${workerPorts.gameServer}`, apiServerBaseURL: `http://127.0.0.1:${workerPorts.apiServer}` });
    const mobile = await context.newPage();
    const mobileGame = new GameTestContext(mobile);
    try {
        await mobileGame.openTestGame('dicethrone', { playerID: '0', disableLocalAiAutomation: true }, 60000);
        for (const state of states) {
            await mobileGame.setupScene(scene(state));
            for (const [width, height] of [[936, 432], [812, 375], [1000, 432], [800, 450]]) {
                await mobile.setViewportSize({ width, height });
                const layout = await measure(mobile), baseline = pc.get(state.id)!;
                const scale = Math.min(width / 1920, height / 960);
                expect(layout.fit).toBe('contain');
                expect(layout.scale).toBeCloseTo(scale, 5);
                expect(layout.mobileProfile).toBe('landscape-adapted');
                expect(layout.mobileLayoutPreset).toBe('board-shell');
                expect(layout.items).toHaveLength(7);
                expect(layout.activePhaseCount).toBe(1);
                expect(layout.density).toBe('normal');
                expect(layout.selfPanelDisplay).toBe('flex');
                expect(layout.selfPanelFlexDirection).toBe('column');
                expect(layout.selfPanelGridTemplateAreas).toBe('none');
                expect(layout.sidebarOverflow).toBe('visible');
                expect(layout.overlaps.phaseResources, `${state.id} ${width} 阶段提示不得压住生命/CP面板`).toBe(false);
                expect(layout.overlaps.phaseDeck, `${state.id} ${width} 阶段提示不得压住牌堆`).toBe(false);
                if (state.tokens && Object.keys(state.tokens).length + Object.keys(state.statusEffects).length > 0) {
                    expect(layout.overlaps.phaseTokens, `${state.id} ${width} 阶段提示不得压住Token/状态`).toBe(false);
                }
                expect(layout.scrollWidths.document).toBeLessThanOrEqual(width + 1);
                expect(layout.scrollWidths.body).toBeLessThanOrEqual(width + 1);
                expect(layout.shell).not.toBeNull();
                expect(layout.shell!.x).toBeGreaterThanOrEqual(-1);
                expect(layout.shell!.y).toBeGreaterThanOrEqual(-1);
                expect(layout.shell!.right).toBeLessThanOrEqual(width + 1);
                expect(layout.shell!.bottom).toBeLessThanOrEqual(height + 1);
                expect(layout.handToggle).not.toBeNull();
                expect(layout.handToggleHitArea?.width).toBeGreaterThanOrEqual(42);
                expect(layout.handToggleHitArea?.height).toBeGreaterThanOrEqual(42);
                expect(layout.handToggleVisual).not.toBeNull();
                expect(layout.handToggleVisual!.width).toBeLessThan(layout.handToggle!.width);
                expect(layout.handToggleCenterHit).toBe(true);
                expect(layout.handToggle!.x).toBeGreaterThanOrEqual(-1);
                expect(layout.handToggle!.y).toBeGreaterThanOrEqual(-1);
                expect(layout.handToggle!.right).toBeLessThanOrEqual(width + 1);
                expect(layout.handToggle!.bottom).toBeLessThanOrEqual(height + 1);
                expect(layout.gap).toBeCloseTo(baseline.gap, 2);
                expect(layout.title.font).toBeCloseTo(baseline.title.font, 1);
                expect(layout.title.marginBottom).toBeCloseTo(baseline.title.marginBottom, 1);
                expect(layout.title.marginLeft).toBeCloseTo(baseline.title.marginLeft, 1);
                for (const [index, item] of layout.items.entries()) {
                    expect(item.font).toBe(baseline.items[index].font);
                    expect(item.padding).toBe(baseline.items[index].padding);
                    expect(item.height).toBeCloseTo(baseline.items[index].height * scale, 0);
                }
                for (const [key, rect] of Object.entries(layout.rects)) {
                    expect(rect, key).not.toBeNull();
                    for (const dimension of ['width', 'height'] as const) expect(Math.abs(rect![dimension] - baseline.rects[key]![dimension] * scale), `${state.id} ${width} ${key}.${dimension}`).toBeLessThan(1);
                    expect(Math.abs((rect!.x - layout.offset.x) / scale - baseline.rects[key]!.x), `${state.id} ${width} ${key}.x`).toBeLessThan(4);
                    // 手牌继承PC扇形边缘；其余主对象必须同时完整可见。
                    if (key !== 'hand') {
                        expect(Math.abs((rect!.y - layout.offset.y) / scale - baseline.rects[key]!.y), `${state.id} ${width} ${key}.y`).toBeLessThan(4);
                        expect(rect!.x, key).toBeGreaterThanOrEqual(-1);
                        expect(rect!.y, key).toBeGreaterThanOrEqual(-1);
                        expect(rect!.right, key).toBeLessThanOrEqual(width + 1);
                        expect(rect!.bottom, key).toBeLessThanOrEqual(height + 1);
                    } else {
                        // contain 在较窄视口会留下上下留白；手牌应贴着参考画布底边，而非视口底边。
                        expect(rect!.bottom).toBeCloseTo(layout.offset.y + 960 * scale, 0);
                    }
                }
                expect(layout.tokens).toHaveLength(Object.keys(state.tokens).length + Object.keys(state.statusEffects).length);
                for (const [tokenIndex, token] of layout.tokens.entries()) {
                    expect(token.width).toBeCloseTo(48 * scale, 0);
                    expect(token.x).toBeGreaterThanOrEqual(-1);
                    expect(token.x + token.width).toBeLessThanOrEqual(width + 1);
                    expect(token.y).toBeGreaterThanOrEqual(-1);
                    expect(token.bottom).toBeLessThanOrEqual(height + 1);
                    expect(token.top).toBeGreaterThanOrEqual(layout.rects.phase!.bottom - 0.1);
                    expect(token.bottom).toBeLessThan(layout.rects.resources!.y);
                    expect(Math.abs((token.x - layout.offset.x) / scale - baseline.tokens[tokenIndex].x)).toBeLessThan(4);
                    expect(Math.abs((token.y - layout.offset.y) / scale - baseline.tokens[tokenIndex].y)).toBeLessThan(4);
                }
                await shot(mobile, `手机${width}x${height}-${state.id}`);
                console.info(JSON.stringify({ evidence: 'dicethrone-fixed-composition', state: state.id, viewport: { width, height, dpr: 2.5 }, layout }));
            }
        }
    } finally { await context.close(); }

    // V2314A 真机实测 CSS 视口为 796x360、DPR 3；把浏览器截图固定到同尺寸，
    // 让真机整屏图与可控的两个 Token 场景有同分辨率对照。
    const deviceViewportContext = await browser.newContext({ baseURL, viewport: { width: 796, height: 360 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    try {
        await initContext(deviceViewportContext, { skipImageGate: true, gameServerBaseURL: `http://127.0.0.1:${workerPorts.gameServer}`, apiServerBaseURL: `http://127.0.0.1:${workerPorts.apiServer}` });
        const deviceViewportPage = await deviceViewportContext.newPage();
        const deviceViewportGame = new GameTestContext(deviceViewportPage);
        await deviceViewportGame.openTestGame('dicethrone', { playerID: '0', disableLocalAiAutomation: true }, 60000);
        const state = states.find(candidate => candidate.id === '两个Token')!;
        await deviceViewportGame.setupScene(scene(state));
        const layout = await measure(deviceViewportPage);
        const baseline = pc.get(state.id)!;
        expect(layout.pageBackground, '真机等效浏览器背景必须铺满整个视口').toMatchObject({ x: 0, y: 0, width: 796, height: 360 });
        expect(layout.pageBackgroundFit).toBe('cover');
        expect(layout.pageBackgroundLoaded).toBe(true);
        expect(layout.pageBackgroundInsideShell).toBe(false);
        expect(layout.fit).toBe('contain');
        expect(layout.scale).toBeCloseTo(0.375, 5);
        expect(layout.title.font).toBeCloseTo(baseline.title.font, 1);
        expect(layout.items).toHaveLength(7);
        expect(layout.tokens).toHaveLength(2);
        for (const [key, rect] of Object.entries(layout.rects)) {
            expect(rect, key).not.toBeNull();
            expect(Math.abs(rect!.width - baseline.rects[key]!.width * 0.375), `${key}.width`).toBeLessThan(1);
            expect(Math.abs(rect!.height - baseline.rects[key]!.height * 0.375), `${key}.height`).toBeLessThan(1);
        }
        await shot(deviceViewportPage, `真机等效796x360-DPR3-${state.id}`);
        const phaseItem = deviceViewportPage.locator('[data-testid="dt-phase-indicator"] [data-dt-phase-active="true"]');
        await phaseItem.tap();
        const tooltipRoot = deviceViewportPage.getByTestId('info-tooltip');
        await expect(tooltipRoot).toBeVisible();
        await expect(tooltipRoot).toHaveCSS('opacity', '1');
        const tooltip = await deviceViewportPage.evaluate(() => {
            const title = document.querySelector<HTMLElement>('[data-testid="info-tooltip-title"]');
            const line = document.querySelector<HTMLElement>('[data-testid="info-tooltip-content-line"]');
            const root = document.querySelector<HTMLElement>('[data-testid="info-tooltip"]');
            const rect = root?.getBoundingClientRect();
            return {
                titleFont: title ? parseFloat(getComputedStyle(title).fontSize) : 0,
                bodyFont: line ? parseFloat(getComputedStyle(line).fontSize) : 0,
                visibility: root ? getComputedStyle(root).visibility : 'missing',
                opacity: root ? parseFloat(getComputedStyle(root).opacity) : 0,
                rect: rect ? { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } : null,
            };
        });
        expect(tooltip.titleFont).toBeGreaterThanOrEqual(12);
        expect(tooltip.bodyFont).toBeGreaterThanOrEqual(11);
        expect(tooltip.visibility).toBe('visible');
        expect(tooltip.opacity).toBe(1);
        expect(tooltip.rect).not.toBeNull();
        expect(tooltip.rect!.width).toBeGreaterThan(80);
        expect(tooltip.rect!.x).toBeGreaterThanOrEqual(0);
        expect(tooltip.rect!.right).toBeLessThanOrEqual(796);
        expect(tooltip.rect!.y).toBeGreaterThanOrEqual(0);
        expect(tooltip.rect!.bottom).toBeLessThanOrEqual(360);
        console.info(JSON.stringify({ evidence: 'dicethrone-round-order-tooltip-mobile', viewport: { width: 796, height: 360, dpr: 3 }, tooltip }));
        await shot(deviceViewportPage, '真机等效796x360-DPR3-点按回合顺序阶段说明');
        const fabMetrics = await deviceViewportPage.evaluate(() => {
            const root = document.querySelector<HTMLElement>('[data-testid="fab-menu"]');
            const visual = root?.querySelector<HTMLElement>('[data-fab-visual-id]');
            const icon = visual?.querySelector('svg');
            const rootRect = root?.getBoundingClientRect();
            const visualRect = visual?.getBoundingClientRect();
            const iconRect = icon?.getBoundingClientRect();
            return {
                hit: rootRect ? { width: rootRect.width, height: rootRect.height } : null,
                visual: visualRect ? { width: visualRect.width, height: visualRect.height } : null,
                icon: iconRect ? { width: iconRect.width, height: iconRect.height } : null,
            };
        });
        // Motion/FAB 亚像素合成会让 44px 命中区在 DOMRect 中读成 43.998px。
        expect(fabMetrics.hit?.width).toBeGreaterThanOrEqual(43.5);
        expect(fabMetrics.hit?.height).toBeGreaterThanOrEqual(43.5);
        expect(fabMetrics.visual?.width).toBeGreaterThanOrEqual(40);
        expect(fabMetrics.visual?.height).toBeGreaterThanOrEqual(40);
        expect(fabMetrics.icon?.width).toBeGreaterThanOrEqual(18);
        expect(fabMetrics.icon?.height).toBeGreaterThanOrEqual(18);
        console.info(JSON.stringify({ evidence: 'dicethrone-device-viewport-match', state: state.id, viewport: { width: 796, height: 360, dpr: 3 }, layout }));
    } finally { await deviceViewportContext.close(); }
});
