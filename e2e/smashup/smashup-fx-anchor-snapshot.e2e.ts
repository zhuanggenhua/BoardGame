/**
 * 大杀四方 - FX 牌桌锚点快照回归
 *
 * 目标：验证真实 Board 注册的无地图牌桌 anchor 能被 EventStream -> FxLayer 消费。
 * 不截图；这里只证明浏览器端链路与锚点合同。
 */

import type { Page } from '@playwright/test';
import { test, expect } from '../framework';

type AnchorAudit = {
    anchorId: string | null;
    surfaceId: string | null;
    position: string;
    actualLeftPct: number | null;
    actualTopPct: number | null;
    leftDeltaPct: number | null;
    topDeltaPct: number | null;
    activeCues: string | null;
};

async function openSmashUpTestBoard(page: Page): Promise<void> {
    await page.goto('/play/smashup');
    await page.waitForFunction(
        () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
        { timeout: 20000, polling: 200 },
    );
}

async function waitForPowerChangeAnchorAudit(page: Page, baseIndex: number): Promise<AnchorAudit> {
    const handle = await page.waitForFunction((targetBaseIndex) => {
        const anchorId = `base:${targetBaseIndex}`;
        const surface = document.querySelector<HTMLElement>('[data-fx-surface-id="smashup:table"]');
        const base = document.querySelector<HTMLElement>(`[data-testid="base-zone-${targetBaseIndex}"]`);
        const layer = document.querySelector<HTMLElement>('[data-testid="smashup-fx-layer"]');
        const fx = Array.from(document.querySelectorAll<HTMLElement>(
            `[data-target-anchor-id="${anchorId}"][data-surface-id="smashup:table"]`,
        )).find((candidate) => candidate.textContent?.includes('+'));

        if (!surface || !base || !fx) return null;

        const surfaceRect = surface.getBoundingClientRect();
        const baseRect = base.getBoundingClientRect();
        if (surfaceRect.width <= 0 || surfaceRect.height <= 0) return null;

        const baseLeftPct = ((baseRect.left - surfaceRect.left) / surfaceRect.width) * 100;
        const baseTopPct = ((baseRect.top - surfaceRect.top) / surfaceRect.height) * 100;
        const baseWidthPct = (baseRect.width / surfaceRect.width) * 100;
        const expectedLeftPct = baseLeftPct + baseWidthPct + 0.7;
        const expectedTopPct = Math.max(0, baseTopPct - 1.2);
        const actualLeftPct = Number.parseFloat(fx.style.left);
        const actualTopPct = Number.parseFloat(fx.style.top);

        return {
            anchorId: fx.getAttribute('data-target-anchor-id'),
            surfaceId: fx.getAttribute('data-surface-id'),
            position: window.getComputedStyle(fx).position,
            actualLeftPct: Number.isFinite(actualLeftPct) ? actualLeftPct : null,
            actualTopPct: Number.isFinite(actualTopPct) ? actualTopPct : null,
            leftDeltaPct: Number.isFinite(actualLeftPct) ? Math.abs(actualLeftPct - expectedLeftPct) : null,
            topDeltaPct: Number.isFinite(actualTopPct) ? Math.abs(actualTopPct - expectedTopPct) : null,
            activeCues: layer?.dataset.fxActiveCues ?? null,
        };
    }, baseIndex, { timeout: 5000, polling: 50 });

    return await handle.jsonValue() as AnchorAudit;
}

async function pushBaseScoredEvent(page: Page, baseIndex: number): Promise<void> {
    await page.evaluate((targetBaseIndex) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        if (!harness?.state?.patch || !state) {
            throw new Error('Smash Up 测试状态入口不可用');
        }

        const currentStream = state.sys?.eventStream ?? { entries: [], maxEntries: 50, nextId: 1 };
        const entries = Array.isArray(currentStream.entries) ? currentStream.entries : [];
        const nextId = typeof currentStream.nextId === 'number'
            ? currentStream.nextId
            : ((entries.at(-1)?.id ?? 0) + 1);

        harness.state.patch({
            sys: {
                eventStream: {
                    ...currentStream,
                    entries: [
                        ...entries,
                        {
                            id: nextId,
                            event: {
                                type: 'su:base_scored',
                                payload: {
                                    baseIndex: targetBaseIndex,
                                    baseDefId: state.core?.bases?.[targetBaseIndex]?.defId ?? 'base_temple_of_goju',
                                    rankings: [{ playerId: '0', power: 7, vp: 3 }],
                                },
                                timestamp: Date.now(),
                            },
                        },
                    ].slice(-(currentStream.maxEntries ?? 50)),
                    nextId: nextId + 1,
                },
            },
        });
    }, baseIndex);
}

async function waitForBaseScoredAnchorAudit(page: Page, baseIndex: number): Promise<AnchorAudit> {
    const handle = await page.waitForFunction((targetBaseIndex) => {
        const readPercent = (value: string): number => {
            const percentMatch = value.match(/-?\d+(?:\.\d+)?(?=%)/);
            if (percentMatch) return Number.parseFloat(percentMatch[0]);
            return Number.parseFloat(value);
        };
        const anchorId = `base:${targetBaseIndex}`;
        const surface = document.querySelector<HTMLElement>('[data-fx-surface-id="smashup:table"]');
        const base = document.querySelector<HTMLElement>(`[data-testid="base-zone-${targetBaseIndex}"]`);
        const layer = document.querySelector<HTMLElement>('[data-testid="smashup-fx-layer"]');
        const fx = document.querySelector<HTMLElement>(
            `[data-testid="su-vp-gain-feedback-0"][data-target-anchor-id="${anchorId}"]`,
        );

        if (!surface || !base || !fx) return null;

        const surfaceRect = surface.getBoundingClientRect();
        const baseRect = base.getBoundingClientRect();
        if (surfaceRect.width <= 0 || surfaceRect.height <= 0) return null;

        const expectedLeftPct = ((baseRect.left - surfaceRect.left + baseRect.width / 2) / surfaceRect.width) * 100;
        const expectedTopPct = ((baseRect.top - surfaceRect.top + baseRect.height / 2) / surfaceRect.height) * 100;
        const actualLeftPct = readPercent(fx.style.left);
        const actualTopPct = readPercent(fx.style.top);

        return {
            anchorId: fx.getAttribute('data-target-anchor-id'),
            surfaceId: fx.closest<HTMLElement>('[data-surface-id]')?.getAttribute('data-surface-id') ?? null,
            position: window.getComputedStyle(fx).position,
            actualLeftPct: Number.isFinite(actualLeftPct) ? actualLeftPct : null,
            actualTopPct: Number.isFinite(actualTopPct) ? actualTopPct : null,
            leftDeltaPct: Number.isFinite(actualLeftPct) ? Math.abs(actualLeftPct - expectedLeftPct) : null,
            topDeltaPct: Number.isFinite(actualTopPct) ? Math.abs(actualTopPct - expectedTopPct) : null,
            activeCues: layer?.dataset.fxActiveCues ?? null,
        };
    }, baseIndex, { timeout: 5000, polling: 50 });

    return await handle.jsonValue() as AnchorAudit;
}

test.describe('大杀四方 FX 牌桌锚点快照', () => {
    test('打出随从的力量浮字应使用目标基地的 table-local anchor snapshot', async ({ page, game }) => {
        test.setTimeout(60000);
        await openSmashUpTestBoard(page);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['pirate_first_mate'],
                deck: [],
                factions: ['pirates', 'wizards'],
                minionsPlayed: 0,
                minionLimit: 1,
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['ninjas', 'robots'],
            },
            bases: [
                { defId: 'base_pirate_cove' },
                { defId: 'base_temple_of_goju' },
                { defId: 'base_the_mothership' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await expect(page.locator('[data-fx-surface-id="smashup:table"]').first()).toBeVisible({ timeout: 5000 });
        await expect(page.getByTestId('base-zone-1')).toBeVisible({ timeout: 5000 });
        const auditPromise = waitForPowerChangeAnchorAudit(page, 1);

        await game.playCard('pirate_first_mate', { targetBaseIndex: 1 });

        const audit = await auditPromise;
        expect(audit.anchorId).toBe('base:1');
        expect(audit.surfaceId).toBe('smashup:table');
        expect(audit.position).toBe('absolute');
        expect(audit.activeCues).toContain('fx.power-change');
        expect(audit.leftDeltaPct ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);
        expect(audit.topDeltaPct ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);
    });

    test('基地计分 VP 反馈应使用目标基地的 table-local anchor snapshot', async ({ page, game }) => {
        test.setTimeout(60000);
        await openSmashUpTestBoard(page);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [],
                deck: [],
                factions: ['pirates', 'wizards'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['ninjas', 'robots'],
            },
            bases: [
                { defId: 'base_pirate_cove' },
                { defId: 'base_temple_of_goju' },
                { defId: 'base_the_mothership' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await expect(page.locator('[data-fx-surface-id="smashup:table"]').first()).toBeVisible({ timeout: 5000 });
        await expect(page.getByTestId('base-zone-2')).toBeVisible({ timeout: 5000 });
        const auditPromise = waitForBaseScoredAnchorAudit(page, 2);

        await pushBaseScoredEvent(page, 2);

        const audit = await auditPromise;
        expect(audit.anchorId).toBe('base:2');
        expect(audit.surfaceId).toBe('smashup:table');
        expect(audit.position).toBe('absolute');
        expect(audit.activeCues).toContain('fx.base-scored');
        expect(audit.leftDeltaPct ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);
        expect(audit.topDeltaPct ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);

        await page.setViewportSize({ width: 960, height: 720 });
        await page.waitForTimeout(100);

        const afterResizeAudit = await waitForBaseScoredAnchorAudit(page, 2);
        expect(afterResizeAudit.anchorId).toBe('base:2');
        expect(afterResizeAudit.surfaceId).toBe('smashup:table');
        expect(afterResizeAudit.actualLeftPct).toBeCloseTo(audit.actualLeftPct ?? -1, 3);
        expect(afterResizeAudit.actualTopPct).toBeCloseTo(audit.actualTopPct ?? -1, 3);
    });
});
