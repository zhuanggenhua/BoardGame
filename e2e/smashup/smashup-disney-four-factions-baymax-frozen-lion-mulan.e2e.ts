import { test, expect } from '../framework';
import type { Page } from '@playwright/test';

type InteractionOption = {
    id: string;
    value?: {
        baseIndex?: number;
        minionUid?: string;
        mode?: string;
    };
};

type SmashUpCardSnapshot = {
    uid: string;
    defId: string;
};

type SmashUpMinionSnapshot = {
    uid: string;
    powerCounters?: number;
    tempPowerModifier?: number;
    metadata?: Record<string, unknown>;
};

type SmashUpHarnessState = {
    sys?: {
        phase?: string;
        interaction?: {
            current?: {
                data?: {
                    sourceId?: string;
                    targetType?: string;
                    options?: InteractionOption[];
                };
            };
        };
    };
    core: {
        turnNumber?: number;
        players: Record<string, {
            hand: SmashUpCardSnapshot[];
            deck: SmashUpCardSnapshot[];
            discard: SmashUpCardSnapshot[];
            actionsPlayed: number;
            actionLimit: number;
        }>;
        bases: Array<{
            minions: SmashUpMinionSnapshot[];
        }>;
    };
};

type SmashUpHarnessWindow = Window & {
    __BG_TEST_HARNESS__?: {
        state?: {
            get?: () => SmashUpHarnessState;
            set?: (state: SmashUpHarnessState) => void | Promise<void>;
        };
        command?: {
            dispatch?: (command: { type: string; playerId: string; payload: Record<string, unknown> }) => Promise<void>;
        };
    };
};

async function markMulanReceivedCounterThisTurn(page: Page, minionUid: string): Promise<void> {
    await page.evaluate((uid) => {
        const harness = (window as SmashUpHarnessWindow).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        if (!state || !harness?.state?.set) {
            throw new Error('TestHarness state is not available');
        }

        const next = structuredClone(state) as SmashUpHarnessState;
        next.core.turnNumber = next.core.turnNumber ?? 1;
        const minion = next.core.bases.flatMap(base => base.minions).find(candidate => candidate.uid === uid);
        if (!minion) {
            throw new Error(`Mulan minion not found: ${uid}`);
        }
        minion.powerCounters = Math.max(1, minion.powerCounters ?? 0);
        minion.metadata = {
            ...(minion.metadata ?? {}),
            mulan_mulan_power_counter_turn: next.core.turnNumber,
        };
        return harness.state.set(next);
    }, minionUid);
}

async function dispatchSmashUpCommand(
    page: Page,
    type: string,
    payload: Record<string, unknown>,
    playerId = '0',
): Promise<void> {
    await page.evaluate(async ({ commandType, commandPayload, commandPlayerId }) => {
        const harness = (window as SmashUpHarnessWindow).__BG_TEST_HARNESS__;
        if (!harness?.command?.dispatch) {
            throw new Error('TestHarness command dispatcher is not available');
        }
        await harness.command.dispatch({
            type: commandType,
            playerId: commandPlayerId,
            payload: commandPayload,
        });
    }, { commandType: type, commandPayload: payload, commandPlayerId: playerId });
    await page.waitForTimeout(300);
}

test.describe('SmashUp - 迪士尼四派系代表性交互', () => {
    test('超能陆战队升级应从真实打牌入口打开 Disney 选择并给角色放力量标记', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', {
            p0: 'big_hero_6,frozen',
            p1: 'lion_king,mulan',
            skipFactionSelect: true,
            skipInitialization: false,
        }, 45000);

        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['big_hero_6', 'frozen'],
                hand: [
                    { uid: 'hand-upgrades', defId: 'big_hero_6_upgrades', type: 'action', owner: '0' },
                ],
                deck: [
                    { uid: 'draw-after-counter', defId: 'frozen_snowgie', type: 'minion', owner: '0' },
                ],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['lion_king', 'mulan'],
                hand: [],
                deck: [],
                discard: [],
            },
            bases: [
                {
                    defId: 'base_sfit_robotics_lab',
                    minions: [
                        {
                            uid: 'microbot-target',
                            defId: 'big_hero_6_microbot_swarm',
                            owner: '0',
                            controller: '0',
                            basePower: 2,
                            powerCounters: 0,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                        {
                            uid: 'enemy-anchor',
                            defId: 'mulan_mushu',
                            owner: '1',
                            controller: '1',
                            basePower: 2,
                            powerCounters: 0,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                    ],
                    ongoingActions: [],
                },
            ],
        });

        await page.waitForFunction(
            () => {
                const state = (window as SmashUpHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.sys?.phase === 'playCards'
                    && state?.core?.players?.['0']?.hand?.some(card => card.uid === 'hand-upgrades')
                    && state?.core?.bases?.[0]?.minions?.some(minion => minion.uid === 'microbot-target');
            },
            { timeout: 5000 },
        );
        await game.screenshot('disney-upgrades-ready', testInfo);

        await game.playCard('big_hero_6_upgrades');
        await game.waitForInteraction('disney_four_factions_prompt', 10000);

        await page.waitForFunction(
            () => {
                const state = (window as SmashUpHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                const current = state?.sys?.interaction?.current;
                return current?.data?.sourceId === 'disney_four_factions_prompt'
                    && current?.data?.targetType === 'minion'
                    && current?.data?.options?.some(option => option?.value?.minionUid === 'microbot-target');
            },
            { timeout: 5000 },
        );
        await game.screenshot('disney-upgrades-prompt', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'microbot-target',
            '升级目标微型机器群',
        );
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as SmashUpHarnessState;
            const player0 = state.core.players['0'];
            const microbot = state.core.bases[0].minions.find(minion => minion.uid === 'microbot-target');
            return {
                microbotCounters: microbot?.powerCounters ?? 0,
                cardStillInHand: player0.hand.some(card => card.uid === 'hand-upgrades'),
                drewSeedCard: player0.hand.some(card => card.uid === 'draw-after-counter'),
                discardHasUpgrades: player0.discard.some(card => card.defId === 'big_hero_6_upgrades'),
                actionsPlayed: player0.actionsPlayed,
                actionLimit: player0.actionLimit,
                interactionOpen: Boolean(state.sys.interaction?.current),
            };
        }, { timeout: 10000 }).toEqual({
            microbotCounters: 2,
            cardStillInHand: false,
            drewSeedCard: true,
            discardHasUpgrades: true,
            actionsPlayed: 1,
            actionLimit: 2,
            interactionOpen: false,
        });

        await game.screenshot('disney-upgrades-resolved', testInfo);
    });

    test('花木兰二选一效果必须在真实页面等待玩家选择分支', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', {
            p0: 'mulan,frozen',
            p1: 'lion_king,aladdin',
            skipFactionSelect: true,
            skipInitialization: false,
        }, 45000);

        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['mulan', 'frozen'],
                hand: [],
                deck: [
                    { uid: 'mulan-draw-card', defId: 'frozen_snowgie', type: 'minion', owner: '0' },
                ],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['lion_king', 'aladdin'],
                hand: [],
                deck: [],
                discard: [],
            },
            bases: [
                {
                    defId: 'base_training_camp',
                    minions: [
                        {
                            uid: 'mulan-choice',
                            defId: 'mulan_mulan',
                            owner: '0',
                            controller: '0',
                            basePower: 5,
                            powerCounters: 1,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                    ],
                    ongoingActions: [],
                },
            ],
        });
        await markMulanReceivedCounterThisTurn(page, 'mulan-choice');

        await expect(page.locator('[data-minion-uid="mulan-choice"]')).toBeVisible({ timeout: 15000 });
        await game.screenshot('mulan-mode-choice-ready', testInfo);

        await dispatchSmashUpCommand(page, 'su:use_talent', { minionUid: 'mulan-choice', baseIndex: 0 });
        await game.waitForInteraction('disney_four_factions_prompt', 10000);
        await expect(page.getByText('木兰：选择效果')).toBeVisible({ timeout: 10000 });
        await game.screenshot('mulan-mode-choice-prompt', testInfo);

        const modeOptions = await game.getInteractionOptions() as InteractionOption[];
        expect(modeOptions.map(option => option.value?.mode).sort()).toEqual(['draw_card', 'extra_action']);
        const beforeChoice = await game.getState() as SmashUpHarnessState;
        expect(beforeChoice.core.players['0'].hand.map(card => card.uid)).toEqual([]);
        expect(beforeChoice.core.players['0'].deck.map(card => card.uid)).toEqual(['mulan-draw-card']);
        expect(beforeChoice.core.players['0'].actionLimit).toBe(1);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.mode === 'draw_card',
            '木兰选择抽一张牌',
        );
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as SmashUpHarnessState;
            const player0 = state.core.players['0'];
            return {
                handUids: player0.hand.map(card => card.uid),
                deckUids: player0.deck.map(card => card.uid),
                actionLimit: player0.actionLimit,
                interactionOpen: Boolean(state.sys?.interaction?.current),
            };
        }, { timeout: 10000 }).toEqual({
            handUids: ['mulan-draw-card'],
            deckUids: [],
            actionLimit: 1,
            interactionOpen: false,
        });

        await game.screenshot('mulan-mode-choice-draw-resolved', testInfo);
    });

    test('冰雪奇缘艾莎天赋必须在真实页面提供额外打出雪宝/迷你雪人或取回棉花糖', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', {
            p0: 'frozen,big_hero_6',
            p1: 'lion_king,mulan',
            skipFactionSelect: true,
            skipInitialization: false,
        }, 45000);

        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['frozen', 'big_hero_6'],
                hand: [
                    { uid: 'elsa-snowgie-hand', defId: 'frozen_snowgie', type: 'minion', owner: '0' },
                ],
                deck: [],
                discard: [
                    { uid: 'elsa-marshmallow-discard', defId: 'frozen_marshmallow', type: 'minion', owner: '0' },
                ],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['lion_king', 'mulan'],
                hand: [],
                deck: [],
                discard: [],
            },
            bases: [
                {
                    defId: 'base_arendelle',
                    minions: [
                        {
                            uid: 'elsa-talent-source',
                            defId: 'frozen_elsa',
                            owner: '0',
                            controller: '0',
                            basePower: 5,
                            powerCounters: 0,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_ice_palace',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        await expect(page.locator('[data-minion-uid="elsa-talent-source"]')).toBeVisible({ timeout: 15000 });
        await game.screenshot('frozen-elsa-talent-ready', testInfo);

        const elsaFrame = page.getByTestId('su-minion-frame-elsa-talent-source');
        const elsaBox = await elsaFrame.boundingBox();
        expect(elsaBox, '艾莎牌面应有可点击的真实几何区域').not.toBeNull();
        if (!elsaBox) throw new Error('艾莎牌面缺少可点击几何区域');
        const elsaClickPoint = {
            x: elsaBox.x + elsaBox.width / 2,
            y: elsaBox.y + elsaBox.height / 2,
        };
        const foregroundHit = await page.evaluate(({ x, y }) => {
            const element = document.elementFromPoint(x, y);
            return element?.closest<HTMLElement>('[data-testid]')?.dataset.testid ?? null;
        }, elsaClickPoint);
        expect(foregroundHit, '艾莎点击中心必须命中艾莎牌面本体，而不是透明遮罩或其它入口').toBe('su-minion-frame-elsa-talent-source');
        await page.mouse.click(elsaClickPoint.x, elsaClickPoint.y);
        await game.waitForInteraction('disney_four_factions_prompt', 10000);
        await expect(page.getByText('艾莎：选择天赋效果')).toBeVisible({ timeout: 10000 });

        const modeOptions = await game.getInteractionOptions() as InteractionOption[];
        expect(modeOptions.map(option => option.value?.mode).sort()).toEqual([
            'elsa_extra_minion',
            'elsa_recover_marshmallow',
        ]);
        await game.screenshot('frozen-elsa-mode-choice-prompt', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.mode === 'elsa_extra_minion',
            '艾莎选择额外打出雪宝或迷你雪人',
        );
        await game.waitForInteraction('disney_four_factions_prompt', 10000);

        const extraMinionOptions = await game.getInteractionOptions() as InteractionOption[];
        expect(extraMinionOptions.map(option => option.value?.cardUid)).toEqual(['elsa-snowgie-hand']);
        await game.screenshot('frozen-elsa-extra-minion-choice', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.cardUid === 'elsa-snowgie-hand',
            '艾莎选择额外打出迷你雪人',
        );
        await game.waitForInteraction('smashup_immediate_extra_minion', 10000);

        const grantedMinionOptions = await game.getInteractionOptions() as InteractionOption[];
        expect(grantedMinionOptions.map(option => option.value?.cardUid)).toEqual(['elsa-snowgie-hand']);
        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.cardUid === 'elsa-snowgie-hand',
            '艾莎确认立即打出迷你雪人',
        );
        await game.waitForInteraction('smashup_immediate_extra_minion_base', 10000);
        const baseOptions = await game.getInteractionOptions() as InteractionOption[];
        expect(baseOptions
            .map(option => option.value?.baseIndex)
            .filter((baseIndex): baseIndex is number => typeof baseIndex === 'number'))
            .toEqual([0, 1, 2]);
        expect(baseOptions.some(option => option.id === 'skip')).toBe(true);
        await game.screenshot('frozen-elsa-extra-minion-base-choice', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.baseIndex === 1,
            '艾莎选择第二基地打出迷你雪人',
        );
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as SmashUpHarnessState;
            const sourceBase = state.core.bases[0];
            const targetBase = state.core.bases[1];
            return {
                sourceMinionUids: sourceBase.minions.map(minion => minion.uid),
                targetMinionUids: targetBase.minions.map(minion => minion.uid),
                handUids: state.core.players['0'].hand.map(card => card.uid),
                interactionOpen: Boolean(state.sys?.interaction?.current),
            };
        }, { timeout: 10000 }).toEqual({
            sourceMinionUids: ['elsa-talent-source'],
            targetMinionUids: ['elsa-snowgie-hand'],
            handUids: [],
            interactionOpen: false,
        });

        await game.screenshot('frozen-elsa-talent-resolved', testInfo);
    });

    test('冰雪奇缘堆雪人从真实页面只允许弃牌堆中的指定角色', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', {
            p0: 'frozen,big_hero_6',
            p1: 'lion_king,mulan',
            skipFactionSelect: true,
            skipInitialization: false,
        }, 45000);

        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['frozen', 'big_hero_6'],
                hand: [
                    { uid: 'snowman-card', defId: 'frozen_do_you_want_to_build_a_snowman', type: 'action', owner: '0' },
                ],
                deck: [],
                discard: [
                    { uid: 'snowman-snowgie', defId: 'frozen_snowgie', type: 'minion', owner: '0' },
                    { uid: 'snowman-olaf', defId: 'frozen_olaf', type: 'minion', owner: '0' },
                    { uid: 'snowman-anna', defId: 'frozen_anna', type: 'minion', owner: '0' },
                ],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['lion_king', 'mulan'],
                hand: [],
                deck: [],
                discard: [],
            },
            bases: [
                {
                    defId: 'base_arendelle',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        await expect(page.locator('[data-card-uid="snowman-card"]')).toBeVisible({ timeout: 15000 });
        await game.screenshot('frozen-snowman-ready', testInfo);

        await game.playCard('frozen_do_you_want_to_build_a_snowman');
        await game.waitForInteraction('disney_four_factions_prompt', 10000);
        await expect(page.getByText('你想和我堆个雪人吗：选择要额外打出的角色')).toBeVisible({ timeout: 10000 });

        const options = await game.getInteractionOptions() as InteractionOption[];
        expect(options.map(option => option.value?.cardUid)).toEqual(['snowman-snowgie', 'snowman-olaf']);
        expect(options.some(option => option.value?.cardUid === 'snowman-anna')).toBe(false);
        await game.screenshot('frozen-snowman-prompt', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.cardUid === 'snowman-snowgie',
            '堆雪人选择迷你雪人',
        );

        await game.waitForInteraction('smashup_immediate_extra_minion', 10000);
        const grantedMinionOptions = await game.getInteractionOptions() as InteractionOption[];
        expect(grantedMinionOptions.map(option => option.value?.cardUid)).toEqual(['snowman-snowgie']);
        await game.screenshot('frozen-snowman-extra-minion-confirmation', testInfo);
        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.cardUid === 'snowman-snowgie',
            '堆雪人确认立即打出迷你雪人',
        );

        await game.waitForInteraction('smashup_immediate_extra_minion_base', 10000);
        const baseOptions = await game.getInteractionOptions() as InteractionOption[];
        expect(baseOptions
            .map(option => option.value?.baseIndex)
            .filter((baseIndex): baseIndex is number => typeof baseIndex === 'number'))
            .toEqual([0, 1, 2]);
        expect(baseOptions.some(option => option.id === 'skip')).toBe(true);
        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.baseIndex === 0,
            '堆雪人选择打出基地',
        );
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as SmashUpHarnessState;
            return {
                snowgieOnBase: state.core.bases[0].minions.some(minion => minion.uid === 'snowman-snowgie'),
                olafInDiscard: state.core.players['0'].discard.some(card => card.uid === 'snowman-olaf'),
                annaInDiscard: state.core.players['0'].discard.some(card => card.uid === 'snowman-anna'),
                interactionOpen: Boolean(state.sys?.interaction?.current),
            };
        }, { timeout: 10000 }).toEqual({
            snowgieOnBase: true,
            olafInDiscard: true,
            annaInDiscard: true,
            interactionOpen: false,
        });

        await game.screenshot('frozen-snowman-resolved', testInfo);
    });
});
