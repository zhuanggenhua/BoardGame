import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    BETRAYAL_FLOOR_FLOAT_CENTER_EVIDENCE_DIR,
    createRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalFloatingTextGone,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';
import type { BetrayalCore, BetrayalTraitKey } from '../../src/games/betrayal/game';
import {
    BETRAYAL_EXPLORER_CATALOG,
    type BetrayalExplorerCatalogEntry,
} from '../../src/games/betrayal/scenarioConfig';

const EVIDENCE_DIR = 'evidence/betrayal-core-interactions/trait-track-ui';
const CURRENT_TRACK_SCREENSHOT = `${EVIDENCE_DIR}/01-属性轨角色板-连续轨指针位置.jpg`;
const OBSERVED_TRACK_SCREENSHOT = `${EVIDENCE_DIR}/02-属性轨观察队友-连续轨指针位置.jpg`;
const TRAIT_KEYS = ['might', 'speed', 'knowledge', 'sanity'] as const satisfies readonly BetrayalTraitKey[];

function requireExplorerTemplate(explorerId: string): BetrayalExplorerCatalogEntry {
    const template = BETRAYAL_EXPLORER_CATALOG.find((entry) => entry.explorerId === explorerId);
    if (!template) {
        throw new Error(`缺少山屋惊魂正式角色数据：${explorerId}`);
    }
    return template;
}

function buildOfficialTraitTracks(
    template: BetrayalExplorerCatalogEntry,
    positionOverrides: Partial<Record<BetrayalTraitKey, number>> = {},
): BetrayalCore['currentExplorer']['traitTracks'] {
    return Object.fromEntries(TRAIT_KEYS.map((trait) => {
        const seed = template.traitTracks[trait];
        const maxPosition = seed.values.length - 1;
        const position = Math.max(0, Math.min(maxPosition, positionOverrides[trait] ?? seed.startPosition));
        return [
            trait,
            {
                trackId: `${template.explorerId}-${trait}-official-e2e`,
                values: [...seed.values],
                position,
                startPosition: seed.startPosition,
                criticalPosition: 0,
                skullPosition: -1,
                maxPosition,
            },
        ];
    })) as BetrayalCore['currentExplorer']['traitTracks'];
}

function applyOfficialExplorerTemplate(
    explorer: BetrayalCore['currentExplorer'],
    template: BetrayalExplorerCatalogEntry,
    positionOverrides: Partial<Record<BetrayalTraitKey, number>> = {},
): BetrayalCore['currentExplorer'] {
    const traitTracks = buildOfficialTraitTracks(template, positionOverrides);
    const traits = Object.fromEntries(TRAIT_KEYS.map((trait) => {
        const track = traitTracks[trait];
        return [trait, track.values[track.position] ?? template.traits[trait]];
    })) as BetrayalCore['currentExplorer']['traits'];
    return {
        ...explorer,
        explorerId: template.explorerId,
        displayName: template.displayName,
        portraitAsset: template.portraitAsset,
        tokenAsset: template.tokenAsset,
        traits,
        traitTracks,
    };
}

test.describe('山屋惊魂属性轨 UI', () => {
    test('真实牌桌入口按属性轨位置显示夹子，重复数值不吞掉位置变化', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-trait-track-ui');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        const core = createRuntimeCore();
        core.currentExplorer = applyOfficialExplorerTemplate(
            core.currentExplorer,
            requireExplorerTemplate('beat-box-bowen'),
            { speed: 2 },
        );
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartSpeed = core.currentExplorer.traits.speed;
        core.movesRemaining = core.currentExplorer.traits.speed;
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            String(explorer.playerId) === '1'
                ? applyOfficialExplorerTemplate(
                    explorer,
                    requireExplorerTemplate('stephanie-richter'),
                    { speed: 2 },
                )
                : explorer
        ));

        await injectCore(page, core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await waitForBetrayalFloatingTextGone(page);
        await expect(page.getByTestId('betrayal-focus-self-room')).toBeVisible();
        await expect(page.getByTestId('betrayal-focus-self-room')).toHaveAttribute('data-room-focus-action', 'self-room');
        await expect(page.getByTestId('betrayal-focus-self-room')).toHaveAttribute('data-room-focus-icon', 'locate-fixed');
        await expect(page.getByTestId('betrayal-focus-self-room')).toHaveAttribute('data-room-focus-target-id', core.currentExplorer.roomId);
        await expect(page.getByTestId('betrayal-focus-self-room')).toHaveAttribute('title', '聚焦到我的房间');

        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as const) {
            const track = page.getByTestId(`betrayal-current-trait-track-${trait}`);
            await expect(track.locator('[data-trait-track-start="true"]')).toHaveCount(1);
            await expect(track.locator('[data-trait-track-start="true"]')).toHaveAttribute('data-trait-track-start-indicator', 'in-slot-green-band');
        }

        const speedTrack = page.getByTestId('betrayal-current-trait-track-speed');
        await expect(speedTrack).toBeVisible();
        await expect(speedTrack).toHaveAttribute('data-trait-track-position', '2');
        await expect(speedTrack).toHaveAttribute('data-trait-track-value', '3');
        await expect(speedTrack.locator('[data-trait-track-rail="true"]')).toBeVisible();
        await expect(speedTrack.locator('[data-trait-track-rail="true"]')).toHaveAttribute('data-trait-track-rail-shape', 'continuous-segmented');
        await expect(speedTrack.locator('[data-trait-track-segmented-rail="true"]')).toBeVisible();
        await expect(speedTrack.locator('[data-trait-track-segmented-rail="true"]')).toHaveAttribute('data-trait-track-visual-separation', 'equal-cell-gaps');
        await expect(speedTrack.locator('[data-trait-track-tick="true"]')).toHaveCount(0);
        await expect(speedTrack.locator('[data-trait-track-pointer="true"]')).toHaveCount(1);
        await expect(speedTrack.locator('[data-trait-track-pointer="true"]')).toHaveAttribute('data-trait-track-position', '2');
        await expect(speedTrack.locator('[data-trait-track-pointer="true"]')).toHaveAttribute('data-trait-track-current', 'true');
        await expect(speedTrack.locator('[data-trait-track-pointer="true"]')).toHaveAttribute('data-trait-track-pointer-shape', 'material-slot-highlight');
        await expect(speedTrack.locator('[data-trait-track-position="2"]')).toHaveAttribute('data-trait-track-color', 'current-green');
        await expect(speedTrack.locator('[data-trait-track-position="1"]')).toHaveAttribute('data-trait-track-color', 'start-green');
        await expect(speedTrack.locator('[data-trait-track-position="1"]')).toHaveAttribute('data-trait-track-start-indicator', 'in-slot-green-band');
        await expect(speedTrack.locator('[data-trait-track-position="2"] [data-trait-track-slot-label="true"]')).toHaveAttribute('data-trait-track-slot-label-align', 'center');
        await expect(speedTrack.locator('[data-trait-track-marker-asset]')).toHaveCount(0);
        await expect(speedTrack.locator('[data-trait-track-position="1"][data-trait-track-current="false"]')).toHaveText('3');
        await expect(speedTrack.locator('[data-trait-track-position="2"][data-trait-track-current="true"]')).toHaveText('3');
        const currentDuplicateSlotGap = await speedTrack.locator('[data-trait-track-position="1"], [data-trait-track-position="2"]').evaluateAll((slots) => {
            const boxes = slots.map((slot) => slot.getBoundingClientRect());
            return Math.round(boxes[1].left - boxes[0].right);
        });
        expect(currentDuplicateSlotGap).toBeGreaterThanOrEqual(0);
        expect(currentDuplicateSlotGap).toBeLessThanOrEqual(1);
        const currentSlotWidths = await speedTrack.locator('[data-trait-track-slot="true"]').evaluateAll((slots) =>
            slots.map((slot) => slot.getBoundingClientRect().width),
        );
        expect(currentSlotWidths.length).toBe(9);
        expect(Math.max(...currentSlotWidths) - Math.min(...currentSlotWidths)).toBeLessThanOrEqual(1);
        const currentSlotVerticalCenterDelta = await speedTrack.locator('[data-trait-track-position="2"] [data-trait-track-slot-label="true"]').evaluate((label) => {
            const slot = label.closest('[data-trait-track-slot="true"]');
            if (!slot) {
                return Number.POSITIVE_INFINITY;
            }
            const labelBox = label.getBoundingClientRect();
            const slotBox = slot.getBoundingClientRect();
            return Math.abs((labelBox.top + labelBox.height / 2) - (slotBox.top + slotBox.height / 2));
        });
        expect(currentSlotVerticalCenterDelta).toBeLessThanOrEqual(1);

        const currentSlotEdgeAlignment = await speedTrack.locator('[data-trait-track-segmented-rail="true"]').evaluate((rail) => {
            const slots = [...rail.querySelectorAll('[data-trait-track-slot="true"]')];
            const railBox = rail.getBoundingClientRect();
            const firstBox = slots[0]?.getBoundingClientRect();
            const currentBox = rail.querySelector('[data-trait-track-current="true"]')?.getBoundingClientRect();
            const currentIndex = slots.findIndex((slot) => slot.getAttribute('data-trait-track-current') === 'true');
            const nextBox = currentIndex >= 0 ? slots[currentIndex + 1]?.getBoundingClientRect() : undefined;
            return {
                firstLeftInset: firstBox ? firstBox.left - railBox.left : Number.POSITIVE_INFINITY,
                firstTopInset: firstBox ? firstBox.top - railBox.top : Number.POSITIVE_INFINITY,
                currentRight: currentBox?.right ?? Number.NaN,
                nextLeft: nextBox?.left ?? Number.NaN,
            };
        });
        expect(currentSlotEdgeAlignment.firstLeftInset).toBeLessThanOrEqual(2);
        expect(currentSlotEdgeAlignment.firstTopInset).toBeLessThanOrEqual(2);
        expect(Math.abs(currentSlotEdgeAlignment.nextLeft - currentSlotEdgeAlignment.currentRight)).toBeLessThanOrEqual(1);

        const currentExplorerPanel = page.getByTestId('betrayal-observed-explorer-panel');
        await expect(currentExplorerPanel).toBeVisible();
        await expect(currentExplorerPanel).toHaveAttribute('data-player-id', '0');
        await expect(currentExplorerPanel).toHaveAttribute('data-panel-asset', core.currentExplorer.portraitAsset);
        await expect(currentExplorerPanel).not.toHaveAttribute('data-panel-crop', /.*/);
        await expect(currentExplorerPanel).toHaveAttribute('data-token-asset', core.currentExplorer.tokenAsset ?? '');
        await expect(page.getByTestId('betrayal-hud-identity-token-0')).toBeVisible();
        await expect(page.getByTestId('betrayal-explorer-board-marker-speed')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-current-traits')).not.toContainText('当前属性');
        await expect(page.locator('[data-testid^="betrayal-bottom-teammate-"] [data-player-status-tone="neutral"]').filter({ hasText: '同房间' }).first()).toBeVisible();
        await expect(page.locator('[data-player-status-tone="target"]').filter({ hasText: '同房间' })).toHaveCount(0);
        await saveScreenshot(page, CURRENT_TRACK_SCREENSHOT);
        await page.setViewportSize({ width: 1920, height: 1080 });
        await expect(speedTrack).toBeVisible();

        await page.getByTestId('betrayal-bottom-teammate-1').click();
        await expect(page.getByTestId('betrayal-explorer-detail-dialog-1')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-bottom-teammate-1')).toHaveAttribute('data-observed-player', 'true');
        await expect(page.getByTestId('betrayal-bottom-teammate-observed-1')).toBeVisible();
        await expect(page.getByTestId('betrayal-current-traits')).toHaveAttribute('data-observed-player', 'true');
        await expect(page.getByTestId('betrayal-current-traits')).toHaveAttribute('data-player-id', '1');
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as const) {
            const track = page.getByTestId(`betrayal-current-trait-track-${trait}`);
            await expect(track.locator('[data-trait-track-start="true"]')).toHaveCount(1);
            await expect(track.locator('[data-trait-track-start="true"]')).toHaveAttribute('data-trait-track-start-indicator', 'in-slot-green-band');
        }
        const observedSpeedTrack = page.getByTestId('betrayal-current-trait-track-speed');
        await expect(observedSpeedTrack).toHaveAttribute('data-trait-track-position', '2');
        await expect(observedSpeedTrack).toHaveAttribute('data-trait-track-value', '3');
        await expect(observedSpeedTrack.locator('[data-trait-track-rail="true"]')).toBeVisible();
        await expect(observedSpeedTrack.locator('[data-trait-track-rail="true"]')).toHaveAttribute('data-trait-track-rail-shape', 'continuous-segmented');
        await expect(observedSpeedTrack.locator('[data-trait-track-segmented-rail="true"]')).toBeVisible();
        await expect(observedSpeedTrack.locator('[data-trait-track-segmented-rail="true"]')).toHaveAttribute('data-trait-track-visual-separation', 'equal-cell-gaps');
        await expect(observedSpeedTrack.locator('[data-trait-track-tick="true"]')).toHaveCount(0);
        await expect(observedSpeedTrack.locator('[data-trait-track-pointer="true"]')).toHaveCount(1);
        await expect(observedSpeedTrack.locator('[data-trait-track-pointer="true"]')).toHaveAttribute('data-trait-track-position', '2');
        await expect(observedSpeedTrack.locator('[data-trait-track-pointer="true"]')).toHaveAttribute('data-trait-track-current', 'true');
        await expect(observedSpeedTrack.locator('[data-trait-track-pointer="true"]')).toHaveAttribute('data-trait-track-pointer-shape', 'material-slot-highlight');
        await expect(observedSpeedTrack.locator('[data-trait-track-position="2"]')).toHaveAttribute('data-trait-track-color', 'current-green');
        await expect(observedSpeedTrack.locator('[data-trait-track-position="1"]')).toHaveAttribute('data-trait-track-color', 'start-green');
        await expect(observedSpeedTrack.locator('[data-trait-track-position="2"] [data-trait-track-slot-label="true"]')).toHaveAttribute('data-trait-track-slot-label-align', 'center');
        await expect(observedSpeedTrack.locator('[data-trait-track-marker-asset]')).toHaveCount(0);
        await expect(observedSpeedTrack.locator('[data-trait-track-position="1"][data-trait-track-current="false"]')).toHaveText('3');
        await expect(observedSpeedTrack.locator('[data-trait-track-position="2"][data-trait-track-current="true"]')).toHaveText('3');
        const observedDuplicateSlotGap = await observedSpeedTrack.locator('[data-trait-track-position="1"], [data-trait-track-position="2"]').evaluateAll((slots) => {
            const boxes = slots.map((slot) => slot.getBoundingClientRect());
            return Math.round(boxes[1].left - boxes[0].right);
        });
        expect(observedDuplicateSlotGap).toBeGreaterThanOrEqual(0);
        expect(observedDuplicateSlotGap).toBeLessThanOrEqual(1);
        const observedSlotWidths = await observedSpeedTrack.locator('[data-trait-track-slot="true"]').evaluateAll((slots) =>
            slots.map((slot) => slot.getBoundingClientRect().width),
        );
        expect(observedSlotWidths.length).toBe(9);
        expect(Math.max(...observedSlotWidths) - Math.min(...observedSlotWidths)).toBeLessThanOrEqual(1);
        const observedSlotVerticalCenterDelta = await observedSpeedTrack.locator('[data-trait-track-position="2"] [data-trait-track-slot-label="true"]').evaluate((label) => {
            const slot = label.closest('[data-trait-track-slot="true"]');
            if (!slot) {
                return Number.POSITIVE_INFINITY;
            }
            const labelBox = label.getBoundingClientRect();
            const slotBox = slot.getBoundingClientRect();
            return Math.abs((labelBox.top + labelBox.height / 2) - (slotBox.top + slotBox.height / 2));
        });
        expect(observedSlotVerticalCenterDelta).toBeLessThanOrEqual(1);
        const observedExplorerPanel = page.getByTestId('betrayal-observed-explorer-panel');
        await expect(observedExplorerPanel).toBeVisible();
        await expect(observedExplorerPanel).toHaveAttribute('data-player-id', '1');
        await expect(observedExplorerPanel).toHaveAttribute('data-panel-asset', requireExplorerTemplate('stephanie-richter').portraitAsset);
        await expect(observedExplorerPanel).not.toHaveAttribute('data-panel-crop', /.*/);
        await expect(observedExplorerPanel).toHaveAttribute('data-token-asset', requireExplorerTemplate('stephanie-richter').tokenAsset ?? '');
        await expect(page.getByTestId('betrayal-hud-identity-token-1')).toBeVisible();
        await saveScreenshot(page, OBSERVED_TRACK_SCREENSHOT);

        await page.getByTestId('betrayal-focus-self-room').click();
        await expect(page.getByTestId('betrayal-current-traits')).toHaveAttribute('data-player-id', '0');
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'hallway',
        };
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            String(explorer.playerId) === '1'
                ? { ...explorer, roomId: 'hallway' }
                : explorer
        ));
        core.activeRoomId = 'hallway';
        await injectCore(page, core);
        await waitForBetrayalFloatingTextGone(page);
        await page.getByTestId('betrayal-focus-self-room').click();
        await expect(page.getByTestId('betrayal-room-occupant-hallway-0')).toBeVisible();
        await expect(page.getByTestId('betrayal-room-occupant-hallway-1')).toBeVisible();
        await saveScreenshot(
            page,
            `${BETRAYAL_FLOOR_FLOAT_CENTER_EVIDENCE_DIR}/04-PC-1920x1080-属性飘字出现前.jpg`,
        );

        const previousMight = core.currentExplorer.traits.might;
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: Math.max(1, previousMight - 1),
            },
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        await injectCore(page, core);
        const traitChangeFloating = page.getByTestId('betrayal-room-occupant-trait-change-hallway-0');
        await expect(traitChangeFloating).toBeVisible();
        await expect(traitChangeFloating).toContainText('力量');
        await expect(page.getByTestId('betrayal-room-occupant-trait-change-hallway-1')).toHaveCount(0);
        const floatingAlignment = await page.evaluate(() => {
            const floating = document.querySelector('[data-testid="betrayal-room-occupant-trait-change-hallway-0"]');
            const token = document.querySelector('[data-testid="betrayal-explorer-figure-token-0"]');
            if (!(floating instanceof HTMLElement) || !(token instanceof HTMLElement)) {
                throw new Error('缺少属性飘字或当前玩家棋子');
            }
            const floatingBox = floating.getBoundingClientRect();
            const tokenBox = token.getBoundingClientRect();
            return {
                floatingCenterX: floatingBox.left + floatingBox.width / 2,
                tokenCenterX: tokenBox.left + tokenBox.width / 2,
            };
        });
        expect(
            Math.abs(floatingAlignment.floatingCenterX - floatingAlignment.tokenCenterX),
            '属性飘字必须相对当前棋子水平居中',
        ).toBeLessThanOrEqual(8);
        await saveScreenshot(
            page,
            `${BETRAYAL_FLOOR_FLOAT_CENTER_EVIDENCE_DIR}/05-PC-1920x1080-属性飘字贴棋子居中.jpg`,
        );
        await waitForBetrayalFloatingTextGone(page, 5000);
        await saveScreenshot(
            page,
            `${BETRAYAL_FLOOR_FLOAT_CENTER_EVIDENCE_DIR}/06-PC-1920x1080-属性飘字消退后.jpg`,
        );

        assertNoFatalFrontendErrors([{ label: 'betrayal-trait-track-ui', diagnostics }]);
    });
});
