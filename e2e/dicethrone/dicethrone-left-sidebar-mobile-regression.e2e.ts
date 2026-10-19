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
    await page.setViewportSize({ width: 1920, height: 1080 });
    await game.openTestGame('dicethrone', { playerID: '0', disableLocalAiAutomation: true }, 60000);
    for (const state of states) {
        await game.setupScene(scene(state));
        for (const viewport of [
            { label: 'PC1920x1080', width: 1920, height: 1080 },
            { label: '桌面压力2560x1304', width: 2560, height: 1304 },
        ]) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            const layout = await measure(page);
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
            if (viewport.width === 1920) {
                pc.set(state.id, layout);
                expect(layout.title.font).toBeCloseTo(19.2, 1);
                expect(layout.title.marginBottom).toBeCloseTo(7.68, 1);
                expect(layout.title.marginLeft).toBeCloseTo(5.76, 1);
                for (const item of layout.items) expect(item.font).toBeCloseTo(14.4, 1);
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
                const scale = Math.min(width / 1920, height / 1080);
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
                        expect(rect!.bottom).toBeCloseTo(height, 0);
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
});
