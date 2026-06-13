import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import { getEvidenceScreenshotPath, clearEvidenceScreenshotsForTest } from '../framework/evidenceScreenshots';
import { setChineseLocale } from '../helpers/common';

const HAND_CARD_UID = 'bear-necessities-hand';
const ENEMY_MINION_UID = 'enemy-minion';
const ENEMY_BASE_ACTION_UID = 'enemy-base-action';

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
                    { uid: HAND_CARD_UID, defId: 'bear_cavalry_bear_necessities', type: 'action', owner: '0' },
                ],
                deck: [],
                discard: [],
                factions: ['bear_cavalry', 'aliens'],
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
                factions: ['pirates', 'robots'],
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
                        uid: ENEMY_MINION_UID,
                        defId: 'pirate_first_mate',
                        controller: '1',
                        owner: '1',
                        basePower: 2,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [
                            { uid: 'attached-action', defId: 'dino_upgrade', ownerId: '1' },
                        ],
                    },
                ],
                ongoingActions: [],
            },
            {
                defId: 'base_the_factory',
                breakpoint: 25,
                minions: [],
                ongoingActions: [
                    { uid: ENEMY_BASE_ACTION_UID, defId: 'time_travelers_stasis_field', ownerId: '1' },
                ],
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

async function openBearNecessitiesScene(page: Page, game: any): Promise<void> {
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
    await expect(page.locator(`[data-minion-uid="${ENEMY_MINION_UID}"]`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`[data-ongoing-uid="${ENEMY_BASE_ACTION_UID}"]`)).toBeVisible({ timeout: 10000 });
    await expect.poll(async () => {
        const state = await game.getState();
        return state?.sys?.interaction?.current?.data?.sourceId ?? null;
    }, { timeout: 10000 }).toBe(null);
}

async function waitForBoardInteraction(game: any): Promise<void> {
    await expect.poll(async () => {
        const state = await game.getState();
        return {
            sourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
            targetType: state?.sys?.interaction?.current?.data?.targetType ?? null,
        };
    }, { timeout: 10000 }).toEqual({
        sourceId: 'bear_cavalry_bear_necessities',
        targetType: 'board',
    });
}

async function waitForSelectableMinion(page: Page, minionUid: string, timeout = 8000): Promise<void> {
    await page.waitForFunction((targetUid) => {
        const minion = document.querySelector<HTMLElement>(`[data-minion-uid="${targetUid}"]`);
        if (!minion) return false;
        const nodes = [minion, ...Array.from(minion.querySelectorAll<HTMLElement>('*'))];
        return nodes.some((node) => {
            const className = node.getAttribute('class') ?? '';
            return className.includes('ring-green-400') || className.includes('ring-green-300');
        });
    }, minionUid, { timeout });
}

async function waitForSelectableOngoing(page: Page, ongoingUid: string, timeout = 8000): Promise<void> {
    await page.waitForFunction((targetUid) => {
        const ongoing = document.querySelector<HTMLElement>(`[data-ongoing-uid="${targetUid}"]`);
        if (!ongoing) return false;
        const nodes = [ongoing, ...Array.from(ongoing.querySelectorAll<HTMLElement>('*'))];
        return nodes.some((node) => {
            const className = node.getAttribute('class') ?? '';
            return className.includes('ring-green-400') || className.includes('ring-green-300');
        });
    }, ongoingUid, { timeout });
}

async function clickMinion(page: Page, minionUid: string): Promise<void> {
    await page.locator(`[data-minion-uid="${minionUid}"]`).click({ force: true });
}

async function clickOngoing(page: Page, ongoingUid: string): Promise<void> {
    await page.locator(`[data-ongoing-uid="${ongoingUid}"]`).click({ force: true });
}

test.describe('SmashUp 黑熊口粮棋盘直选', () => {
    test.setTimeout(120000);

    test('黑熊口粮应在棋盘上同时高亮随从和基地行动卡，并可直点消灭随从', async ({ page, game }, testInfo) => {
        await clearEvidenceScreenshotsForTest(testInfo);
        await openBearNecessitiesScene(page, game);

        await game.playCard('bear_cavalry_bear_necessities');
        await waitForBoardInteraction(game);
        await expect(page.getByTestId('prompt-overlay')).toHaveCount(0);
        await waitForSelectableMinion(page, ENEMY_MINION_UID);
        await waitForSelectableOngoing(page, ENEMY_BASE_ACTION_UID);

        const highlightShot = getEvidenceScreenshotPath(testInfo, 'board-highlight-before-destroy-minion', {
            filename: 'bear-necessities-board-highlight-before-destroy-minion.png',
        });
        await page.screenshot({ path: highlightShot, fullPage: false });

        await clickMinion(page, ENEMY_MINION_UID);
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                minionGone: !(state?.core?.bases?.[0]?.minions?.some((minion: any) => minion.uid === ENEMY_MINION_UID) ?? false),
                ongoingStillThere: state?.core?.bases?.[1]?.ongoingActions?.some((action: any) => action.uid === ENEMY_BASE_ACTION_UID) ?? false,
                promptSourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            minionGone: true,
            ongoingStillThere: true,
            promptSourceId: null,
        });

        const resolvedShot = getEvidenceScreenshotPath(testInfo, 'after-destroy-minion', {
            filename: 'bear-necessities-after-destroy-minion.png',
        });
        await page.screenshot({ path: resolvedShot, fullPage: false });
    });

    test('黑熊口粮应在棋盘上同时高亮随从和基地行动卡，并可直点消灭基地行动卡', async ({ page, game }, testInfo) => {
        await clearEvidenceScreenshotsForTest(testInfo);
        await openBearNecessitiesScene(page, game);

        await game.playCard('bear_cavalry_bear_necessities');
        await waitForBoardInteraction(game);
        await expect(page.getByTestId('prompt-overlay')).toHaveCount(0);
        await waitForSelectableMinion(page, ENEMY_MINION_UID);
        await waitForSelectableOngoing(page, ENEMY_BASE_ACTION_UID);

        const highlightShot = getEvidenceScreenshotPath(testInfo, 'board-highlight-before-destroy-ongoing', {
            filename: 'bear-necessities-board-highlight-before-destroy-ongoing.png',
        });
        await page.screenshot({ path: highlightShot, fullPage: false });

        await clickOngoing(page, ENEMY_BASE_ACTION_UID);
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                minionStillThere: state?.core?.bases?.[0]?.minions?.some((minion: any) => minion.uid === ENEMY_MINION_UID) ?? false,
                ongoingGone: !(state?.core?.bases?.[1]?.ongoingActions?.some((action: any) => action.uid === ENEMY_BASE_ACTION_UID) ?? false),
                promptSourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            minionStillThere: true,
            ongoingGone: true,
            promptSourceId: null,
        });

        const resolvedShot = getEvidenceScreenshotPath(testInfo, 'after-destroy-ongoing', {
            filename: 'bear-necessities-after-destroy-ongoing.png',
        });
        await page.screenshot({ path: resolvedShot, fullPage: false });
    });
});
