import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import { getEvidenceScreenshotPath, clearEvidenceScreenshotsForTest } from '../framework/evidenceScreenshots';
import { setChineseLocale } from '../helpers/common';

const HAND_CARD_UID = 'playful-tricks-hand';
const HOST_MINION_UID = 'host-minion';
const BASE_ONGOING_UID = 'base-ongoing';
const ATTACHED_ONGOING_UID = 'attached-ongoing';

function createSceneCore() {
    return {
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        turnNumber: 1,
        nextUid: 1000,
        players: {
            '0': {
                id: '0',
                vp: 0,
                hand: [
                    { uid: HAND_CARD_UID, defId: 'fairies_playful_tricks', type: 'action', owner: '0' },
                ],
                deck: [],
                discard: [],
                factions: ['fairies', 'robots'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                sameNameMinionDefId: null,
            },
            '1': {
                id: '1',
                vp: 0,
                hand: [],
                deck: [],
                discard: [],
                factions: ['kaiju', 'dinosaurs'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                sameNameMinionDefId: null,
            },
        },
        bases: [
            {
                defId: 'base_the_homeworld',
                breakpoint: 21,
                minions: [
                    {
                        uid: HOST_MINION_UID,
                        defId: 'pirate_first_mate',
                        controller: '1',
                        owner: '1',
                        basePower: 2,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [
                            { uid: ATTACHED_ONGOING_UID, defId: 'fairies_enchantment', ownerId: '1', talentUsed: false },
                        ],
                    },
                ],
                ongoingActions: [
                    { uid: BASE_ONGOING_UID, defId: 'kaiju_stomp', ownerId: '1' },
                ],
            },
            {
                defId: 'base_the_factory',
                breakpoint: 25,
                minions: [],
                ongoingActions: [],
            },
            {
                defId: 'base_great_library',
                breakpoint: 20,
                minions: [],
                ongoingActions: [],
            },
        ],
        titans: [],
        enabledExpansions: [],
        baseDeck: ['base_mushroom_kingdom'],
        baseDiscard: [],
        cardsPlayedThisTurn: 0,
        powerCountersPlacedOnMinionsThisTurn: 0,
        turnDestroyedMinions: [],
    };
}

async function openScene(page: Page, game: any): Promise<void> {
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
        gameId: 'smashup',
        currentPlayer: '0',
        phase: 'playCards',
        extra: {
            core: createSceneCore(),
        },
    });

    await game.waitForPhase('playCards', 10000);
    await expect(page.locator(`[data-card-uid="${HAND_CARD_UID}"]`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`[data-minion-uid="${HOST_MINION_UID}"]`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`[data-ongoing-uid="${BASE_ONGOING_UID}"]`)).toBeVisible({ timeout: 10000 });
    await expect.poll(async () => {
        const state = await game.getState();
        return state?.sys?.interaction?.current?.data?.sourceId ?? null;
    }, { timeout: 10000 }).toBe(null);
}

async function waitForOngoingInteraction(game: any): Promise<void> {
    await expect.poll(async () => {
        const state = await game.getState();
        return {
            sourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
            targetType: state?.sys?.interaction?.current?.data?.targetType ?? null,
        };
    }, { timeout: 10000 }).toEqual({
        sourceId: 'fairies_playful_tricks_destroy',
        targetType: 'ongoing',
    });
}

async function waitForSelectableOngoing(page: Page, selector: string, timeout = 8000): Promise<void> {
    await page.waitForFunction((targetSelector) => {
        const ongoing = document.querySelector<HTMLElement>(targetSelector);
        if (!ongoing) return false;
        const nodes = [ongoing, ...Array.from(ongoing.querySelectorAll<HTMLElement>('*'))];
        return nodes.some((node) => {
            const className = node.getAttribute('class') ?? '';
            return className.includes('ring-green-400') || className.includes('ring-green-300');
        });
    }, selector, { timeout });
}

async function waitForSelectedOngoing(page: Page, selector: string, timeout = 8000): Promise<void> {
    await page.waitForFunction((targetSelector) => {
        const ongoing = document.querySelector<HTMLElement>(targetSelector);
        if (!ongoing) return false;
        const nodes = [ongoing, ...Array.from(ongoing.querySelectorAll<HTMLElement>('*'))];
        return nodes.some((node) => {
            const className = node.getAttribute('class') ?? '';
            return className.includes('ring-4 ring-green-400');
        });
    }, selector, { timeout });
}

async function revealAttachedAction(page: Page): Promise<void> {
    await page.locator(`[data-minion-uid="${HOST_MINION_UID}"]`).hover();
    await expect(page.locator(`[data-attached-action-uid="${ATTACHED_ONGOING_UID}"]`)).toBeVisible({ timeout: 8000 });
}

test.describe('SmashUp 有趣的把戏场上行动卡直选', () => {
    test.setTimeout(120000);

    test('有趣的把戏应在棋盘上直选基地行动卡和附着行动卡，并允许多选后一起摧毁', async ({ page, game }, testInfo) => {
        await clearEvidenceScreenshotsForTest(testInfo);
        await openScene(page, game);

        await game.playCard('fairies_playful_tricks');
        await waitForOngoingInteraction(game);
        await expect(page.getByTestId('prompt-overlay')).toHaveCount(0);

        await waitForSelectableOngoing(page, `[data-ongoing-uid="${BASE_ONGOING_UID}"]`);
        await revealAttachedAction(page);
        await waitForSelectableOngoing(page, `[data-attached-action-uid="${ATTACHED_ONGOING_UID}"]`);

        const highlightShot = getEvidenceScreenshotPath(testInfo, 'ongoing-highlight-before-select', {
            filename: 'playful-tricks-ongoing-highlight-before-select.png',
        });
        await page.screenshot({ path: highlightShot, fullPage: false });

        await page.locator(`[data-ongoing-uid="${BASE_ONGOING_UID}"]`).click({ force: true });
        await waitForSelectedOngoing(page, `[data-ongoing-uid="${BASE_ONGOING_UID}"]`);

        await revealAttachedAction(page);
        await page.locator(`[data-attached-action-uid="${ATTACHED_ONGOING_UID}"]`).click({ force: true });
        await waitForSelectedOngoing(page, `[data-attached-action-uid="${ATTACHED_ONGOING_UID}"]`);

        const selectedShot = getEvidenceScreenshotPath(testInfo, 'ongoing-selected-before-confirm', {
            filename: 'playful-tricks-ongoing-selected-before-confirm.png',
        });
        await page.screenshot({ path: selectedShot, fullPage: false });

        await page.getByRole('button', { name: '确认选择' }).click();
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                baseOngoingGone: !(state?.core?.bases?.[0]?.ongoingActions?.some((action: any) => action.uid === BASE_ONGOING_UID) ?? false),
                attachedOngoingGone: !(state?.core?.bases?.[0]?.minions?.some((minion: any) =>
                    minion.uid === HOST_MINION_UID
                    && minion.attachedActions?.some((action: any) => action.uid === ATTACHED_ONGOING_UID)) ?? false),
                promptSourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            baseOngoingGone: true,
            attachedOngoingGone: true,
            promptSourceId: null,
        });

        const resolvedShot = getEvidenceScreenshotPath(testInfo, 'after-destroy-two-ongoings', {
            filename: 'playful-tricks-after-destroy-two-ongoings.png',
        });
        await page.screenshot({ path: resolvedShot, fullPage: false });
    });
});
