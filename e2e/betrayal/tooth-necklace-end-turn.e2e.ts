import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import type { BetrayalCore, BetrayalTraitKey } from '../../src/games/betrayal/game';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createToothNecklaceEndTurnRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/山屋惊魂-牙齿项链结束回合完整链路';
const READY_SCREENSHOT = `${EVIDENCE_DIR}/01-牙齿项链结束回合前力量濒死.jpg`;
const CHOICE_SCREENSHOT = `${EVIDENCE_DIR}/02-牙齿项链结束回合濒死属性选择.jpg`;
const SETTLED_SCREENSHOT = `${EVIDENCE_DIR}/03-牙齿项链选择力量后交给下一位.jpg`;
const TEST_URL = '/play/betrayal?players=3&playerID=0&seat0=human&seat1=human&seat2=human&seed=tooth-necklace-end-turn';

type ToothNecklaceState = {
    currentPlayer?: string;
    activePlayerId?: string | null;
    pendingChoice?: {
        sourceTitle?: string;
        itemResolution?: string;
        itemCardId?: string;
        allowedTraits?: string[];
    } | null;
    playerZeroInventoryIds: string[];
    playerZeroTraitPositions: Partial<Record<BetrayalTraitKey, number>>;
    playerZeroTraits: Partial<Record<BetrayalTraitKey, number>>;
    activityLogTexts: string[];
};

const readToothNecklaceState = async (page: Page): Promise<ToothNecklaceState> =>
    page.evaluate(() => {
        const holder = window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => { core?: BetrayalCore };
                };
            };
        };
        const core = holder.__BG_TEST_HARNESS__?.state?.get?.()?.core;
        const playerZero = [core?.currentExplorer, ...(core?.otherExplorers ?? [])]
            .find((explorer) => explorer?.playerId === '0');
        return {
            currentPlayer: core?.currentPlayer,
            activePlayerId: core?.activePlayerId ?? null,
            pendingChoice: core?.pendingEventChoice
                ? {
                    sourceTitle: core.pendingEventChoice.sourceTitle,
                    itemResolution: core.pendingEventChoice.itemResolution,
                    itemCardId: core.pendingEventChoice.itemCardId,
                    allowedTraits: core.pendingEventChoice.effect.mode === 'chosenTrait'
                        ? core.pendingEventChoice.effect.allowedTraits
                        : [],
                }
                : null,
            playerZeroInventoryIds: playerZero?.inventory.map((card) => card.id) ?? [],
            playerZeroTraitPositions: {
                might: playerZero?.traitTracks.might.position,
                speed: playerZero?.traitTracks.speed.position,
                knowledge: playerZero?.traitTracks.knowledge.position,
                sanity: playerZero?.traitTracks.sanity.position,
            },
            playerZeroTraits: playerZero?.traits ?? {},
            activityLogTexts: core?.activityLog.map((entry) => entry.text).slice(0, 5) ?? [],
        };
    });

const openToothNecklaceBoard = async (
    page: Page,
    context: BrowserContext,
) => {
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, 'betrayal-tooth-necklace-end-turn');
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForBetrayalPageReady(page);
    await injectCore(page, createToothNecklaceEndTurnRuntimeCore());
    await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('betrayal-inventory-tooth-necklace')).toBeVisible();
    return diagnostics;
};

test.describe('山屋惊魂牙齿项链结束回合真实入口', () => {
    test('真实牌桌结束回合会弹出濒死属性选择，选择后提升并交给下一位', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openToothNecklaceBoard(page, context);

        await expect.poll(() => readToothNecklaceState(page)).toMatchObject({
            currentPlayer: '0',
            pendingChoice: null,
            playerZeroInventoryIds: ['tooth-necklace'],
            playerZeroTraitPositions: {
                might: 0,
                speed: 1,
                knowledge: 1,
                sanity: 1,
            },
            playerZeroTraits: {
                might: 1,
                speed: 2,
                knowledge: 2,
                sanity: 2,
            },
        });
        await saveScreenshot(page, READY_SCREENSHOT);

        await page.getByTestId('betrayal-action-endTurn').click();

        const choicePanel = page.getByTestId('betrayal-event-choice-panel');
        await expect(choicePanel).toBeVisible({ timeout: 30000 });
        await expect(choicePanel).toHaveAttribute('aria-label', '牙齿项链');
        await expect(page.getByTestId('betrayal-event-choice-trait-might')).toBeVisible();
        await expect(page.getByTestId('betrayal-event-choice-trait-might')).toContainText('力量');
        await expect(page.getByTestId('betrayal-event-choice-trait-speed')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-event-choice-confirm')).toBeDisabled();
        await expect(page.getByTestId('betrayal-event-choice-decline')).toBeEnabled();
        await expect.poll(() => readToothNecklaceState(page)).toMatchObject({
            currentPlayer: '0',
            activePlayerId: '0',
            pendingChoice: {
                sourceTitle: '牙齿项链',
                itemResolution: 'tooth-necklace-end-turn',
                itemCardId: 'tooth-necklace',
                allowedTraits: ['might'],
            },
            playerZeroTraitPositions: {
                might: 0,
            },
        });
        await saveScreenshot(page, CHOICE_SCREENSHOT);

        await page.getByTestId('betrayal-event-choice-trait-might').click();
        await expect(page.getByTestId('betrayal-event-choice-confirm')).toBeEnabled();
        await page.getByTestId('betrayal-event-choice-confirm').click();
        await expect(choicePanel).toHaveCount(0);

        await expect.poll(() => readToothNecklaceState(page)).toMatchObject({
            currentPlayer: '1',
            activePlayerId: null,
            pendingChoice: null,
            playerZeroInventoryIds: ['tooth-necklace'],
            playerZeroTraitPositions: {
                might: 1,
                speed: 1,
                knowledge: 1,
                sanity: 1,
            },
            playerZeroTraits: {
                might: 2,
                speed: 2,
                knowledge: 2,
                sanity: 2,
            },
            activityLogTexts: expect.arrayContaining([
                expect.stringContaining('使用牙齿项链'),
            ]),
        });
        await expect(page.getByTestId('betrayal-board')).toBeVisible();
        await saveScreenshot(page, SETTLED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-tooth-necklace-end-turn', diagnostics }]);
    });
});
