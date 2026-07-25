import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createMedicalKitUseReadyRuntimeCore,
    createRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-core-interactions/trait-outcome-preview';
const DAMAGE_PREVIEW_SCREENSHOT = `${EVIDENCE_DIR}/01-伤害分配属性轨预览.jpg`;
const HEAL_PREVIEW_SCREENSHOT = `${EVIDENCE_DIR}/02-治疗目标属性轨预览.jpg`;

const openBetrayalBoard = async (
    page: Parameters<typeof attachPageDiagnostics>[0],
    context: Parameters<typeof initBetrayalContext>[0],
    label: string,
) => {
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, label);

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
    await waitForBetrayalPageReady(page);

    return diagnostics;
};

test.describe('山屋惊魂属性后果预览', () => {
    test('真实牌桌入口的通用伤害可把多点分配到同一属性轨并显示后果', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openBetrayalBoard(
            page,
            context,
            'betrayal-trait-outcome-damage',
        );

        const core = createRuntimeCore();
        core.pendingEventChoice = {
            id: 'e2e-repeat-damage-choice',
            playerId: '0',
            sourceTitle: '伤害预览测试',
            effect: {
                mode: 'generalDamageChoice',
                amount: 2,
                allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
                recommendedAction: 'endTurn',
            },
        };

        await injectCore(page, core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-event-choice-panel')).toBeVisible();

        await page.getByTestId('betrayal-event-choice-damage-might').click();
        await expect(page.getByTestId('betrayal-event-choice-damage-might')).toHaveAttribute(
            'data-damage-selected-count',
            '1',
        );
        const mightPreview = page.getByTestId('betrayal-event-damage-preview-might');
        await expect(mightPreview).toHaveAttribute('data-trait-preview-mode', 'damage');
        await expect(mightPreview).toHaveAttribute('data-trait-preview-step-count', '1');
        await expect(mightPreview).toHaveAttribute('data-trait-preview-locked', 'false');
        await expect(page.getByTestId('betrayal-event-choice-confirm')).toHaveCount(0);

        await saveScreenshot(page, DAMAGE_PREVIEW_SCREENSHOT);

        await page.getByTestId('betrayal-event-choice-damage-might').click();
        await expect(page.getByTestId('betrayal-event-choice-panel')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-current-trait-track-might')).toHaveAttribute(
            'data-trait-track-position',
            '1',
        );

        assertNoFatalFrontendErrors([{ label: 'betrayal-trait-outcome-damage', diagnostics }]);
    });

    test('真实牌桌入口的急救包目标选择会预览治疗回绿色起点', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openBetrayalBoard(
            page,
            context,
            'betrayal-trait-outcome-heal',
        );

        const core = createMedicalKitUseReadyRuntimeCore();
        core.otherExplorers = core.otherExplorers.map((explorer) => {
            if (explorer.playerId !== '1') {
                return explorer;
            }

            const mightTrack = explorer.traitTracks.might;
            const speedTrack = explorer.traitTracks.speed;
            const mightPosition = Math.max(mightTrack.criticalPosition, mightTrack.startPosition - 1);
            const speedPosition = Math.max(speedTrack.criticalPosition, speedTrack.startPosition - 1);

            return {
                ...explorer,
                traits: {
                    ...explorer.traits,
                    might: mightTrack.values[mightPosition] ?? explorer.traits.might,
                    speed: speedTrack.values[speedPosition] ?? explorer.traits.speed,
                },
                traitTracks: {
                    ...explorer.traitTracks,
                    might: { ...mightTrack, position: mightPosition },
                    speed: { ...speedTrack, position: speedPosition },
                },
            };
        });

        await injectCore(page, core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-inventory-medical-kit')).toBeVisible();

        await page.getByTestId('betrayal-inventory-medical-kit').click();
        await expect(page.getByTestId('betrayal-inventory-target-player-selector')).toBeVisible();
        await expect(page.getByTestId('betrayal-room-occupant-target-outline-hallway-1')).toHaveAttribute(
            'data-highlight-shape',
            'pentagon',
        );
        await page.getByTestId('betrayal-room-occupant-hallway-1').click();

        const healPreview = page.getByTestId('betrayal-inventory-heal-preview');
        await expect(healPreview).toBeVisible();
        await expect(healPreview).toHaveAttribute('data-player-id', '1');

        const mightPreview = page.getByTestId('betrayal-inventory-heal-preview-might');
        await expect(mightPreview).toHaveAttribute('data-trait-preview-mode', 'heal');
        await expect(mightPreview).toHaveAttribute('data-trait-preview-step-count', '1');
        await expect(mightPreview).toHaveAttribute(
            'data-trait-preview-target-position',
            String(
                core.otherExplorers.find((explorer) => explorer.playerId === '1')!.traitTracks.might
                    .startPosition,
            ),
        );

        await saveScreenshot(page, HEAL_PREVIEW_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-trait-outcome-heal', diagnostics }]);
    });
});
