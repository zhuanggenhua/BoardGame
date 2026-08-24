import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';
import type { BetrayalCore, BetrayalTraitKey } from '../../src/games/betrayal/game';
import {
    BETRAYAL_EXPLORER_CATALOG,
    type BetrayalExplorerCatalogEntry,
} from '../../src/games/betrayal/scenarioConfig';

const EVIDENCE_DIR = 'evidence/betrayal-core-interactions/trait-track-ui';
const CURRENT_TRACK_SCREENSHOT = `${EVIDENCE_DIR}/01-左上角色属性读数卡-无属性夹子.jpg`;
const OBSERVED_TRACK_SCREENSHOT = `${EVIDENCE_DIR}/02-观察队友后左上属性读数卡同步切换.jpg`;
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
    test('真实牌桌入口常驻属性读数不显示属性夹子，并保留轨道位置数据', async ({ page, context }) => {
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
        await expect(page.getByTestId('betrayal-focus-self-room')).toBeVisible();
        await expect(page.getByTestId('betrayal-focus-self-room')).toHaveAttribute('data-room-focus-action', 'self-room');
        await expect(page.getByTestId('betrayal-focus-self-room')).toHaveAttribute('data-room-focus-icon', 'locate-fixed');
        await expect(page.getByTestId('betrayal-focus-self-room')).toHaveAttribute('data-room-focus-target-id', core.currentExplorer.roomId);
        await expect(page.getByTestId('betrayal-focus-self-room')).toHaveAttribute('title', '聚焦到我的房间');

        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as const) {
            const track = page.getByTestId(`betrayal-current-trait-track-${trait}`);
            await expect(track).toHaveAttribute('data-trait-display', 'hud-current-value');
            await expect(track).toHaveAttribute('data-trait-value-shape', 'hud-tile');
            await expect(track.locator('[data-trait-track-rail="true"]')).toHaveCount(0);
            await expect(track.locator('[data-trait-track-slot="true"]')).toHaveCount(0);
        }

        const speedTrack = page.getByTestId('betrayal-current-trait-track-speed');
        await expect(speedTrack).toBeVisible();
        await expect(speedTrack).toHaveAttribute('data-trait-track-position', '2');
        await expect(speedTrack).toHaveAttribute('data-trait-track-value', '3');
        await expect(speedTrack.locator('[data-trait-current-value="true"]')).toHaveText('3');
        await expect(speedTrack.locator('[data-trait-track-rail="true"]')).toHaveCount(0);
        await expect(speedTrack.locator('[data-trait-track-segmented-rail="true"]')).toHaveCount(0);
        await expect(speedTrack.locator('[data-trait-track-tick="true"]')).toHaveCount(0);
        await expect(speedTrack.locator('[data-trait-track-pointer="true"]')).toHaveCount(0);
        await expect(speedTrack.locator('[data-trait-track-marker-asset]')).toHaveCount(0);

        const currentExplorerPanel = page.getByTestId('betrayal-observed-explorer-panel');
        await expect(currentExplorerPanel).toBeVisible();
        await expect(currentExplorerPanel).toHaveAttribute('data-player-id', '0');
        await expect(currentExplorerPanel).toHaveAttribute('data-panel-asset', core.currentExplorer.portraitAsset);
        await expect(currentExplorerPanel).toHaveAttribute('data-panel-crop', 'hud-identity-portrait');
        await expect(currentExplorerPanel).not.toHaveAttribute('data-token-asset', /.*/);
        await expect(page.getByTestId('betrayal-explorer-board-marker-speed')).toHaveCount(0);
        await expect(page.locator('[data-testid^="betrayal-bottom-teammate-"] [data-player-status-tone="neutral"]').filter({ hasText: '同房间' }).first()).toBeVisible();
        await expect(page.locator('[data-player-status-tone="target"]').filter({ hasText: '同房间' })).toHaveCount(0);
        await saveScreenshot(page, CURRENT_TRACK_SCREENSHOT);

        await page.getByTestId('betrayal-bottom-teammate-1').click();
        await expect(page.getByTestId('betrayal-explorer-detail-dialog-1')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-bottom-teammate-1')).toHaveAttribute('data-observed-player', 'true');
        await expect(page.getByTestId('betrayal-bottom-teammate-observed-1')).toBeVisible();
        await expect(page.getByTestId('betrayal-current-traits')).toHaveAttribute('data-observed-player', 'true');
        await expect(page.getByTestId('betrayal-current-traits')).toHaveAttribute('data-player-id', '1');
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as const) {
            const track = page.getByTestId(`betrayal-current-trait-track-${trait}`);
            await expect(track).toHaveAttribute('data-trait-display', 'hud-current-value');
            await expect(track).toHaveAttribute('data-trait-value-shape', 'hud-tile');
            await expect(track.locator('[data-trait-track-rail="true"]')).toHaveCount(0);
            await expect(track.locator('[data-trait-track-slot="true"]')).toHaveCount(0);
        }
        const observedSpeedTrack = page.getByTestId('betrayal-current-trait-track-speed');
        await expect(observedSpeedTrack).toHaveAttribute('data-trait-track-position', '2');
        await expect(observedSpeedTrack).toHaveAttribute('data-trait-track-value', '3');
        await expect(observedSpeedTrack.locator('[data-trait-current-value="true"]')).toHaveText('3');
        await expect(observedSpeedTrack.locator('[data-trait-track-rail="true"]')).toHaveCount(0);
        await expect(observedSpeedTrack.locator('[data-trait-track-segmented-rail="true"]')).toHaveCount(0);
        await expect(observedSpeedTrack.locator('[data-trait-track-tick="true"]')).toHaveCount(0);
        await expect(observedSpeedTrack.locator('[data-trait-track-pointer="true"]')).toHaveCount(0);
        await expect(observedSpeedTrack.locator('[data-trait-track-marker-asset]')).toHaveCount(0);
        const observedExplorerPanel = page.getByTestId('betrayal-observed-explorer-panel');
        await expect(observedExplorerPanel).toBeVisible();
        await expect(observedExplorerPanel).toHaveAttribute('data-player-id', '1');
        await expect(observedExplorerPanel).toHaveAttribute('data-panel-asset', requireExplorerTemplate('stephanie-richter').portraitAsset);
        await expect(observedExplorerPanel).not.toHaveAttribute('data-token-asset', /.*/);
        await saveScreenshot(page, OBSERVED_TRACK_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-trait-track-ui', diagnostics }]);
    });
});
