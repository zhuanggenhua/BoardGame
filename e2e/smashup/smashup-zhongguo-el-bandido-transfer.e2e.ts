import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        mode?: string;
        actionUid?: string;
        baseIndex?: number;
    };
};

type ElBandidoTransferState = {
    core: {
        bases: Array<{
            minions: Array<{ uid: string; talentUsed?: boolean }>;
            ongoingActions: Array<{
                uid: string;
                defId: string;
                ownerId?: string;
                metadata?: { sourceControllerId?: string };
            }>;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 埃尔班迪多天赋转移链路', () => {
    test('真实点击埃尔班迪多后，应把基地战术转移到另一基地', async ({ game, page }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['truckers', 'vigilantes'],
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['disco_dancers', 'kung_fu_fighters'],
                hand: [],
                deck: [],
                discard: [],
            },
            bases: [
                {
                    defId: 'base_the_greasy_spoon',
                    minions: [
                        {
                            uid: 'bandido',
                            defId: 'truckers_el_bandido',
                            owner: '0',
                            controller: '0',
                            basePower: 5,
                            powerModifier: 0,
                            powerCounters: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                    ],
                    ongoingActions: [
                        { uid: 'enemy-convoy', defId: 'truckers_convoy', ownerId: '1', controllerId: '1', talentUsed: false },
                    ],
                },
                {
                    defId: 'base_truck_stop',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        const bandido = page.locator('[data-minion-uid="bandido"]').first();
        await expect(bandido).toBeVisible({ timeout: 15000 });
        await game.screenshot('zhongguo-el-bandido-transfer-ready', testInfo);

        await bandido.click({ force: true });
        await page.waitForTimeout(200);
        await bandido.click({ force: true });

        await game.waitForInteraction('truckers_el_bandido_talent_mode', 10000);
        await game.screenshot('zhongguo-el-bandido-transfer-mode', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.mode === 'transfer',
            '埃尔班迪多选择转移模式',
        );

        await game.waitForInteraction('truckers_el_bandido_transfer_action', 10000);
        await game.screenshot('zhongguo-el-bandido-transfer-action', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.actionUid === 'enemy-convoy',
            '埃尔班迪多选择转移战术',
        );

        await game.waitForInteraction('truckers_el_bandido_transfer_base', 10000);
        await game.screenshot('zhongguo-el-bandido-transfer-base', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.baseIndex === 1,
            '埃尔班迪多目标基地',
        );

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as ElBandidoTransferState;
            const sourceBase = state.core.bases[0];
            const targetBase = state.core.bases[1];
            const movedAction = targetBase.ongoingActions.find(action => action.uid === 'enemy-convoy');
            const bandidoMinion = sourceBase.minions.find(minion => minion.uid === 'bandido');
            return {
                sourceHasAction: sourceBase.ongoingActions.some(action => action.uid === 'enemy-convoy'),
                targetHasAction: Boolean(movedAction),
                targetActionOwner: movedAction?.ownerId ?? null,
                targetActionController: movedAction?.metadata?.sourceControllerId ?? null,
                bandidoTalentUsed: bandidoMinion?.talentUsed ?? false,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            sourceHasAction: false,
            targetHasAction: true,
            targetActionOwner: '1',
            targetActionController: null,
            bandidoTalentUsed: true,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-el-bandido-transfer-resolved', testInfo);
    });
});
