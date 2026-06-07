import { test, expect } from '../framework';
import { setChineseLocale } from '../helpers/common';

const DESKTOP_VIEWPORT = { width: 1600, height: 900 } as const;

type SmashUpHarnessState = {
    core: {
        players: Record<string, { discard?: Array<{ uid?: string }> }>;
        bases: Array<{
            minions: Array<{
                uid?: string;
                attachedActions?: Array<{ uid?: string }>;
            }>;
        }>;
    };
    sys?: {
        phase?: string;
    };
};

async function waitForDiscardSceneReady(page: import('@playwright/test').Page, expectedDiscardUid: string) {
    await page.waitForFunction(
        (discardUid) => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.sys?.phase === 'playCards'
                && state?.core?.players?.['0']?.discard?.some((card: any) => card.uid === discardUid);
        },
        expectedDiscardUid,
        { timeout: 10000 },
    );
}

async function readSmashUpState(game: { getState: () => Promise<unknown> }): Promise<SmashUpHarnessState> {
    return await game.getState() as SmashUpHarnessState;
}

test.describe('SmashUp 弃牌堆交互目标族回归', () => {
    test.beforeEach(async ({ page }) => {
        await setChineseLocale(page.context());
        await page.setViewportSize(DESKTOP_VIEWPORT);
    });

    test('紫金宝葫芦从弃牌堆额外打出时应提示选随从，并实际附着到七娃', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', { skipFactionSelect: true }, 45000);
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                factions: ['huluwawa', 'ninjas'],
                discard: [
                    { uid: 'gourd-discard', defId: 'huluwawa_purple_gold_gourd', type: 'action' },
                ],
                field: [
                    { uid: 'qiwa', defId: 'huluwawa_qi_wa', baseIndex: 0, owner: '0', controller: '0' },
                    { uid: 'other-self', defId: 'huluwawa_da_wa', baseIndex: 0, owner: '0', controller: '0' },
                ],
                minionsPlayed: 1,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['aliens', 'robots'],
            },
            bases: [
                { defId: 'base_huluwawa_mountain' },
                { defId: 'base_seven_colored_lotus' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await waitForDiscardSceneReady(page, 'gourd-discard');

        await page.locator('[data-discard-toggle]').click();
        const discardPanel = page.locator('[data-discard-view-panel]');
        await expect(discardPanel).toBeVisible({ timeout: 5000 });
        await expect(page.locator('[data-card-uid="gourd-discard"]')).toBeVisible({ timeout: 5000 });

        await page.locator('[data-card-uid="gourd-discard"]').click({ force: true });
        await expect(page.getByText('请选择一个随从')).toBeVisible({ timeout: 5000 });
        await expect(page.getByText('点击基地埋葬这张牌')).toHaveCount(0);
        await expect(page.getByText('点击基地发动这张牌')).toHaveCount(0);
        await game.screenshot('huluwawa-gourd-discard-selected', testInfo);

        await page.locator('[data-minion-uid="qiwa"]').click({ force: true });

        await expect.poll(async () => {
            const state = await readSmashUpState(game);
            const qiwa = state.core.bases[0]?.minions.find(minion => minion.uid === 'qiwa');
            return {
                gourdStillInDiscard: state.core.players['0']?.discard?.some(card => card.uid === 'gourd-discard') ?? false,
                attachedToQiwa: qiwa?.attachedActions?.some(action => action.uid === 'gourd-discard') ?? false,
            };
        }, { timeout: 8000 }).toEqual({
            gourdStillInDiscard: false,
            attachedToQiwa: true,
        });
    });

    test('赛博守护者弃牌堆入口只高亮合法附着行动，并通过点随从完成打出', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', { skipFactionSelect: true }, 45000);
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                factions: ['cyborg_apes', 'sharks'],
                discard: [
                    { uid: 'evo-a', defId: 'cyborg_apes_cyberevolution', type: 'action' },
                    { uid: 'bananas-a', defId: 'cyborg_apes_going_bananas', type: 'action' },
                ],
                field: [
                    { uid: 'own-cyberback', defId: 'cyborg_apes_cyberback', baseIndex: 0, owner: '0', controller: '0' },
                    { uid: 'own-other', defId: 'sharks_mako', baseIndex: 0, owner: '0', controller: '0' },
                    { uid: 'enemy-cyberback', defId: 'cyborg_apes_cyberback', baseIndex: 0, owner: '1', controller: '1' },
                ],
                minionsPlayed: 1,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['aliens', 'robots'],
            },
            bases: [
                { defId: 'base_monkey_lab' },
                { defId: 'base_the_factory' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await waitForDiscardSceneReady(page, 'evo-a');

        await page.locator('[data-discard-toggle]').click();
        const discardPanel = page.locator('[data-discard-view-panel]');
        await expect(discardPanel).toBeVisible({ timeout: 5000 });
        await expect(page.locator('[data-card-uid="evo-a"]')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('[data-card-uid="bananas-a"]')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('[data-card-uid="evo-a"] .ring-2.ring-amber-300\\/80')).toHaveCount(1);
        await expect(page.locator('[data-card-uid="bananas-a"] .ring-2.ring-amber-300\\/80')).toHaveCount(0);

        await page.locator('[data-card-uid="evo-a"]').click({ force: true });
        await expect(page.getByText('请选择一个随从')).toBeVisible({ timeout: 5000 });
        await game.screenshot('cyberback-discard-action-selected', testInfo);

        await page.locator('[data-minion-uid="own-cyberback"]').click({ force: true });

        await expect.poll(async () => {
            const state = await readSmashUpState(game);
            const cyberback = state.core.bases[0]?.minions.find(minion => minion.uid === 'own-cyberback');
            return {
                evoStillInDiscard: state.core.players['0']?.discard?.some(card => card.uid === 'evo-a') ?? false,
                bananasStillInDiscard: state.core.players['0']?.discard?.some(card => card.uid === 'bananas-a') ?? false,
                evoAttachedToCyberback: cyberback?.attachedActions?.some(action => action.uid === 'evo-a') ?? false,
            };
        }, { timeout: 8000 }).toEqual({
            evoStillInDiscard: false,
            bananasStillInDiscard: true,
            evoAttachedToCyberback: true,
        });
    });

    test('Eh 弃牌堆入口应直接选随从结算，不再先点基地再弹二段 prompt', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', { skipFactionSelect: true }, 45000);
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                factions: ['world_champs', 'ninjas'],
                discard: [
                    { uid: 'eh-discard', defId: 'world_champs_eh', type: 'action' },
                ],
                field: [
                    { uid: 'eh-ally-1', defId: 'robot_microbot_alpha', baseIndex: 0, owner: '0', controller: '0' },
                    { uid: 'eh-ally-2', defId: 'robot_microbot_guard', baseIndex: 1, owner: '0', controller: '0' },
                ],
                minionsPlayed: 1,
                minionLimit: 1,
                actionsPlayed: 1,
                actionLimit: 1,
            },
            player1: {
                factions: ['pirates', 'dinosaurs'],
            },
            bases: [
                { defId: 'base_monkey_lab' },
                { defId: 'base_the_factory' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await waitForDiscardSceneReady(page, 'eh-discard');

        await page.locator('[data-discard-toggle]').click();
        await expect(page.locator('[data-discard-view-panel]')).toBeVisible({ timeout: 5000 });
        await page.locator('[data-card-uid="eh-discard"]').click({ force: true });
        await expect(page.getByText('请选择一个随从')).toBeVisible({ timeout: 5000 });
        await expect(page.getByText('点击基地发动这张牌')).toHaveCount(0);
        await game.screenshot('eh-discard-special-minion-selected', testInfo);

        await page.locator('[data-minion-uid="eh-ally-2"]').click({ force: true });

        await expect.poll(async () => {
            const state = await readSmashUpState(game);
            const allyOne = state.core.bases[0]?.minions.find(minion => minion.uid === 'eh-ally-1') as { tempPowerModifier?: number } | undefined;
            const allyTwo = state.core.bases[1]?.minions.find(minion => minion.uid === 'eh-ally-2') as { tempPowerModifier?: number } | undefined;
            return {
                ehInHand: state.core.players['0']?.discard?.some(card => card.uid === 'eh-discard') === false,
                allyOneBuff: allyOne?.tempPowerModifier ?? 0,
                allyTwoBuff: allyTwo?.tempPowerModifier ?? 0,
            };
        }, { timeout: 8000 }).toEqual({
            ehInHand: true,
            allyOneBuff: 0,
            allyTwoBuff: 1,
        });
    });
});
