import { test, expect } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';

const SMASHUP_GAMEPLAY_QUERY = {
    p0: 'aliens,pirates',
    p1: 'ninjas,robots',
    skipFactionSelect: true,
    skipInitialization: false,
    seed: 12345,
};

const NINJA_DIRECT_CLICK_QUERY = {
    p0: 'ninjas,pirates',
    p1: 'robots,zombies',
    skipFactionSelect: true,
    skipInitialization: false,
    seed: 67890,
};

const WEREWOLF_STANDING_STONES_QUERY = {
    p0: 'werewolves,ghosts',
    p1: 'aliens,pirates',
    skipFactionSelect: true,
    skipInitialization: false,
    seed: 24680,
};

const INNSMOUTH_DAGON_QUERY = {
    p0: 'innsmouth,robots',
    p1: 'wizards,aliens',
    skipFactionSelect: true,
    skipInitialization: false,
    seed: 13579,
};

const FAIRIES_OR_QUERY = {
    p0: 'fairies,robots',
    p1: 'pirates,aliens',
    skipFactionSelect: true,
    skipInitialization: false,
    seed: 424242,
};

const WIZARDS_OR_QUERY = {
    p0: 'wizards,pirates',
    p1: 'aliens,robots',
    skipFactionSelect: true,
    skipInitialization: false,
    seed: 515151,
};

const ZOMBIES_OR_QUERY = {
    p0: 'zombies,pirates',
    p1: 'aliens,robots',
    skipFactionSelect: true,
    skipInitialization: false,
    seed: 616161,
};

const ALIENS_OR_QUERY = {
    p0: 'aliens,wizards',
    p1: 'wizards,robots',
    skipFactionSelect: true,
    skipInitialization: false,
    seed: 717171,
};

async function advanceToAlienScoutReturnPrompt(
    page: { waitForTimeout: (ms: number) => Promise<void>; waitForFunction: (...args: any[]) => Promise<any> },
    game: {
        getState: () => Promise<any>;
        waitForInteraction: (sourceId: string, timeout?: number) => Promise<void>;
        selectOption: (optionId: string) => Promise<void>;
    },
    scoutUid: string,
) {
    for (let step = 0; step < 12; step += 1) {
        const state = await game.getState();
        const sourceId = state?.sys?.interaction?.current?.data?.sourceId ?? null;

        if (sourceId === 'alien_scout_return') {
            await page.waitForFunction(
                (expectedScoutUid) => {
                    const current = (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current;
                    const options = current?.data?.options ?? [];
                    return current?.data?.sourceId === 'alien_scout_return'
                        && options.some((option: any) => (
                            option?.value?.sourceUid === expectedScoutUid
                            || option?.value?.minionUid === expectedScoutUid
                        ));
                },
                scoutUid,
                { timeout: 5000, polling: 200 },
            );
            return;
        }

        if (sourceId === 'smashup_reaction_choose') {
            const triggerOptionId = await page.waitForFunction(
                (expectedScoutUid) => {
                    const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                    const current = state?.sys?.interaction?.current;
                    if (current?.data?.sourceId !== 'smashup_reaction_choose') return null;
                    const triggers = state?.core?.triggerQueue ?? [];
                    const options = current?.data?.options ?? [];
                    const match = options.find((option: any) => {
                        const triggerId = option?.value?.triggerId;
                        const trigger = triggers.find((candidate: any) => candidate?.id === triggerId);
                        return option?.value?.kind === 'trigger'
                            && trigger?.sourceDefId === 'alien_scout'
                            && trigger?.sourceCardUid === expectedScoutUid;
                    });
                    return match?.id ?? null;
                },
                scoutUid,
                { timeout: 5000, polling: 200 },
            );
            await game.selectOption(await triggerOptionId.jsonValue());
            await game.waitForInteraction('alien_scout_return', 10000);
            continue;
        }

        await page.waitForTimeout(300);
    }

    throw new Error(`未能推进到侦察兵 ${scoutUid} 的返回手牌交互`);
}

test.describe('SmashUp - 核心流程与交互稳定性', () => {
    test('主流程：打出随从到基地后结束回合，应切到对手的出牌阶段', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', SMASHUP_GAMEPLAY_QUERY, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'hand-pirate-first-mate', defId: 'pirate_first_mate', type: 'minion' },
                    { uid: 'hand-alien-scout', defId: 'alien_scout', type: 'minion' },
                ],
                factions: ['aliens', 'pirates'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                hand: [
                    { uid: 'opponent-hand-ninja-shinobi', defId: 'ninja_shinobi', type: 'minion' },
                ],
                factions: ['ninjas', 'robots'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                { defId: 'base_the_homeworld' },
                { defId: 'base_the_mothership' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        const handArea = page.getByTestId('su-hand-area');
        await expect(handArea.locator('[data-card-uid="hand-pirate-first-mate"]')).toBeVisible();
        await expect(page.locator('[data-base-index="0"]')).toBeVisible();
        await expect(page.getByRole('button', { name: /^(结束回合|Finish Turn|End)$/i })).toBeVisible();

        await game.playCard('pirate_first_mate', { targetBaseIndex: 0 });
        await game.waitForNoInteraction();
        await page.waitForFunction(
            (cardUid) => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                const state = harness?.state?.get?.();
                return state?.core?.bases?.[0]?.minions?.some((minion: any) => minion.uid === cardUid) === true;
            },
            'hand-pirate-first-mate',
            { timeout: 5000, polling: 200 },
        );

        await expect(handArea.locator('[data-card-uid="hand-pirate-first-mate"]')).toHaveCount(0);
        await expect(page.locator('[data-minion-uid="hand-pirate-first-mate"]')).toBeVisible();
        const stateAfterPlay = await game.getState();
        expect(stateAfterPlay.core.bases[0]?.defId).toBe('base_the_homeworld');
        expect(stateAfterPlay.core.bases[0]?.minions?.some((minion: any) => minion.uid === 'hand-pirate-first-mate')).toBe(true);
        await game.screenshot('main-flow-after-play-minion', testInfo);

        await game.advancePhase();
        await game.waitForCurrentPlayer('1', 10000);
        await game.waitForPhase('playCards', 10000);

        const currentPlayerId = await game.getCurrentPlayerId();
        expect(currentPlayerId).toBe('1');

        const player0 = await game.getPlayerState('0');
        expect(player0.hand.some((card: any) => card.uid === 'hand-alien-scout')).toBe(true);

        await game.screenshot('main-flow-next-player-turn', testInfo);
    });

    test('老派系 OR：Wizard Neophyte 可选放入手牌或作为额外行动打出，并能走完整额外行动链路', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', WIZARDS_OR_QUERY, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'hand-neophyte', defId: 'wizard_neophyte', type: 'minion' },
                ],
                deck: [
                    { uid: 'deck-mystic', defId: 'wizard_mystic_studies', type: 'action' },
                    { uid: 'deck-first-mate', defId: 'pirate_first_mate', type: 'minion' },
                    { uid: 'deck-invader', defId: 'alien_invader', type: 'minion' },
                ],
                factions: ['wizards', 'pirates'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['aliens', 'robots'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                { defId: 'base_the_homeworld' },
                { defId: 'base_tortuga' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        await game.playCard('wizard_neophyte', { targetBaseIndex: 0 });
        await game.waitForInteraction('wizard_neophyte', 10000);

        await expect(page.getByRole('button', { name: /放入手牌/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /作为额外行动打出/i })).toBeVisible();
        await game.screenshot('legacy-or-wizard-neophyte-prompt-visible', testInfo);

        await page.getByRole('button', { name: /作为额外行动打出/i }).click();
        await game.waitForNoInteraction(10000);

        const finalState = await game.getState();
        expect(finalState.core.players['0'].hand.map((card: any) => card.uid)).toEqual(
            expect.arrayContaining(['deck-first-mate', 'deck-invader']),
        );
        expect(finalState.core.players['0'].hand.some((card: any) => card.uid === 'deck-mystic')).toBe(false);
        expect(finalState.core.players['0'].deck).toHaveLength(0);
        await game.screenshot('legacy-or-wizard-neophyte-play-extra-resolved', testInfo);
    });

    test('老派系 OR：Zombie Walker 可选弃掉或放回牌库顶，并能走完整弃牌分支', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', ZOMBIES_OR_QUERY, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'hand-walker', defId: 'zombie_walker', type: 'minion' },
                ],
                deck: [
                    { uid: 'deck-first-mate', defId: 'pirate_first_mate', type: 'minion' },
                    { uid: 'deck-invader', defId: 'alien_invader', type: 'minion' },
                ],
                factions: ['zombies', 'pirates'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['aliens', 'robots'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                { defId: 'base_the_mothership' },
                { defId: 'base_tortuga' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        await game.playCard('zombie_walker', { targetBaseIndex: 0 });
        await game.waitForInteraction('zombie_walker', 10000);

        await expect(page.getByTestId('prompt-context-card')).toBeVisible();
        await expect(page.getByRole('button', { name: /^弃掉$/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /放回牌库顶/i })).toBeVisible();
        await game.screenshot('legacy-or-zombie-walker-prompt-visible', testInfo);

        await page.getByRole('button', { name: /^弃掉$/ }).click();
        await game.waitForNoInteraction(10000);

        const finalState = await game.getState();
        expect(finalState.core.players['0'].discard.some((card: any) => card.uid === 'deck-first-mate')).toBe(true);
        expect(finalState.core.players['0'].deck.some((card: any) => card.uid === 'deck-first-mate')).toBe(false);
        await game.screenshot('legacy-or-zombie-walker-discard-resolved', testInfo);
    });

    test('老派系 OR：Alien Scout 计分后可选返回手牌或留在基地，并能走完整返回手牌链路', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', ALIENS_OR_QUERY, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['aliens', 'wizards'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['wizards', 'robots'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                {
                    defId: 'base_the_homeworld',
                    minions: [
                        { uid: 'score-scout', defId: 'alien_scout', owner: '0', controller: '0', basePower: 2 },
                        { uid: 'score-scout-b', defId: 'alien_scout', owner: '0', controller: '0', basePower: 2 },
                        { uid: 'score-archmage', defId: 'wizard_archmage', owner: '1', controller: '1', basePower: 20 },
                    ],
                },
                { defId: 'base_tortuga' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');
        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const base = state?.core?.bases?.[0];
            const totalPower = (base?.minions ?? []).reduce((sum: number, minion: any) => sum + (minion?.basePower ?? 0), 0);
            return totalPower >= 24
                && (state?.core?.players?.['0']?.hand?.length ?? 99) === 0
                && (state?.core?.players?.['1']?.hand?.length ?? 99) === 0;
        }, { timeout: 10000 });

        await game.advancePhase();
        await advanceToAlienScoutReturnPrompt(page, game, 'score-scout');

        await expect(page.getByText(/侦察兵：基地记分后，是否将此侦察兵返回手牌/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /留在基地/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /返回手牌/i })).toHaveCount(0);
        const firstScoutSource = page.locator('[data-minion-uid="score-scout"][data-highlighted="true"]');
        await expect(firstScoutSource).toBeVisible();
        await game.screenshot('legacy-or-alien-scout-source-highlighted', testInfo);

        await firstScoutSource.click();
        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.core?.players?.['0']?.hand?.some((card: any) => card.uid === 'score-scout') === true;
        }, { timeout: 5000 });
        await expect(page.locator('[data-card-uid="score-scout"]')).toBeVisible({ timeout: 5000 });
        await page.locator('[data-card-uid="score-scout"]').screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'legacy-or-alien-scout-return-in-hand', {
                filename: 'legacy-or-alien-scout-return-in-hand.png',
            }),
        });

        await advanceToAlienScoutReturnPrompt(page, game, 'score-scout-b');
        await expect(page.getByText(/侦察兵：基地记分后，是否将此侦察兵返回手牌/i)).toBeVisible();
        await expect(page.locator('[data-minion-uid="score-scout-b"][data-highlighted="true"]')).toBeVisible();
        await expect(page.getByRole('button', { name: /返回手牌/i })).toHaveCount(0);
        await page.getByRole('button', { name: /留在基地/i }).click();
        await game.waitForNoInteraction(20000);

        const finalState = await game.getState();
        expect(finalState.core.players['0'].hand.some((card: any) => card.uid === 'score-scout')).toBe(true);
        expect(finalState.core.bases.every((base: any) => !(base.minions ?? []).some((minion: any) => minion.uid === 'score-scout'))).toBe(true);
        await game.screenshot('legacy-or-alien-scout-return-resolved', testInfo);
    });

    test('交互稳定性：ninja_acolyte_play 应直点手牌，不应退化成 PromptOverlay 卡牌面板', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', NINJA_DIRECT_CLICK_QUERY, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'hand-shinobi', defId: 'ninja_shinobi', type: 'minion' },
                    { uid: 'hand-first-mate', defId: 'pirate_first_mate', type: 'minion' },
                ],
                field: [
                    { uid: 'acolyte-direct', defId: 'ninja_acolyte', baseIndex: 0, owner: '0', controller: '0', power: 2 },
                ],
                factions: ['ninjas', 'pirates'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['robots', 'zombies'],
            },
            bases: [
                { defId: 'base_the_mothership' },
                { defId: 'base_tortuga' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.waitForPhase('playCards');
        await expect(page.locator('[data-minion-uid="acolyte-direct"]')).toBeVisible();

        await page.locator('[data-minion-uid="acolyte-direct"]').click({ force: true });
        await game.waitForInteraction('ninja_acolyte_play', 10000);

        await expect(page.locator('[data-card-uid="hand-shinobi"]')).toBeVisible();
        await expect(page.getByTestId('prompt-card-0')).not.toBeVisible();
        await game.screenshot('ninja-acolyte-hand-direct-click', testInfo);

        await page.click('[data-card-uid="hand-shinobi"]');
        await game.waitForNoInteraction();

        const finalState = await game.getState();
        expect(finalState.core.bases[0].minions.some((minion: any) =>
            minion.defId === 'ninja_shinobi' && minion.owner === '0'
        )).toBe(true);
        expect(finalState.core.bases[0].minions.some((minion: any) => minion.uid === 'acolyte-direct')).toBe(false);
        expect(finalState.core.players['0'].hand.some((card: any) => card.uid === 'acolyte-direct')).toBe(true);
        expect(finalState.core.players['0'].minionsPlayed).toBe(0);

        await game.screenshot('ninja-acolyte-after-direct-click', testInfo);
    });

    test('本地反馈：额外随从额度显示 +2 时，选中手牌随从后对应基地应高亮并可打出', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', INNSMOUTH_DAGON_QUERY, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'hand-zapbot', defId: 'robot_zapbot_pod', type: 'minion' },
                ],
                factions: ['innsmouth_pod', 'robots_pod'],
                minionsPlayed: 1,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['wizards', 'aliens'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                {
                    defId: 'base_ritual_site',
                    minions: [
                        { uid: 'locals-a', defId: 'innsmouth_the_locals_pod', owner: '0', controller: '0', basePower: 2 },
                        { uid: 'locals-b', defId: 'innsmouth_the_locals_pod', owner: '0', controller: '0', basePower: 2 },
                    ],
                    ongoingActions: [
                        { uid: 'oa-sacred-circle', defId: 'innsmouth_sacred_circle_pod', ownerId: '0', talentUsed: true },
                    ],
                },
                { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
            ],
            currentPlayer: '0',
            phase: 'playCards',
            extra: {
                core: {
                    enabledExpansions: ['titans'],
                    titans: [
                        {
                            uid: 'titan-dagon',
                            defId: 'innsmouth_dagon',
                            faction: 'innsmouth',
                            ownerId: '0',
                            controllerId: '0',
                            powerCounters: 0,
                            talentUsed: true,
                            location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                        },
                    ],
                },
            },
        });

        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            if (!harness?.state?.patch || !state?.core?.players?.['0']) {
                throw new Error('测试工具未就绪，无法补丁大衮额外随从额度');
            }
            harness.state.patch({
                core: {
                    players: {
                        ...state.core.players,
                        '0': {
                            ...state.core.players['0'],
                            baseLimitedMinionQuota: { 0: 2 },
                            baseLimitedSameNameRequired: undefined,
                            baseLimitedSameNameDefId: undefined,
                        },
                    },
                },
            });
        });
        await page.waitForTimeout(500);

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        const initialState = await game.getState();
        expect(initialState.core.players['0'].baseLimitedMinionQuota?.[0]).toBe(2);
        expect(initialState.core.players['0'].baseLimitedSameNameRequired?.[0]).toBeUndefined();

        const handCard = page.locator('[data-card-uid="hand-zapbot"]');
        const targetBase = page.locator('[data-base-index="0"]');
        const quotaBadge = page.locator('[data-testid="su-end-turn-minion-quota"]');

        await expect(handCard).toBeVisible();
        await expect(targetBase).toBeVisible();
        await expect(quotaBadge).toBeVisible();

        await quotaBadge.hover();
        await expect(page.getByText(/\+2\s*→/)).toBeVisible();
        await game.screenshot('dagon-extra-minion-quota-tooltip', testInfo);

        await handCard.click();
        await page.waitForTimeout(300);

        const baseVisualState = await page.evaluate(() => {
            const inspectBase = (baseIndex: number) => {
                const zone = document.querySelector<HTMLElement>(`[data-testid="base-zone-${baseIndex}"]`);
                if (!zone) {
                    return { exists: false, selectable: false, dimmed: false };
                }
                const nodes = [zone, ...Array.from(zone.querySelectorAll<HTMLElement>('*'))];
                const classText = nodes.map((node) => node.getAttribute('class') ?? '').join(' ');
                return {
                    exists: true,
                    selectable: /ring-green-300|ring-green-400|ring-emerald-400/.test(classText),
                    dimmed: /cursor-not-allowed/.test(classText) && /grayscale/.test(classText),
                };
            };

            return {
                base0: inspectBase(0),
                base1: inspectBase(1),
            };
        });

        expect(baseVisualState.base0).toEqual({
            exists: true,
            selectable: true,
            dimmed: false,
        });
        expect(baseVisualState.base1.exists).toBe(true);

        await game.screenshot('dagon-extra-minion-before-base-select', testInfo);

        await targetBase.click();

        await page.waitForFunction(
            (cardUid) => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                const state = harness?.state?.get?.();
                return state?.core?.bases?.[0]?.minions?.some((minion: any) => minion.uid === cardUid) === true;
            },
            'hand-zapbot',
            { timeout: 5000, polling: 200 },
        );

        const finalState = await game.getState();
        expect(finalState.core.bases[0].minions.some((minion: any) => minion.uid === 'hand-zapbot')).toBe(true);
        expect(finalState.core.players['0'].hand.some((card: any) => card.uid === 'hand-zapbot')).toBe(false);
        expect(finalState.core.players['0'].baseLimitedMinionQuota?.[0] ?? 0).toBe(1);

        await game.screenshot('dagon-extra-minion-after-play', testInfo);
    });

    test('巨石阵应允许己方随从上的附着天赋第2次发动，并占用基地双才能名额', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', WEREWOLF_STANDING_STONES_QUERY, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                factions: ['werewolves', 'ghosts'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['aliens', 'pirates'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                {
                    defId: 'base_standing_stones',
                    minions: [
                        {
                            uid: 'wolf-host',
                            defId: 'werewolf_pack_alpha',
                            owner: '0',
                            controller: '0',
                            attachedActions: [
                                { uid: 'oa1', defId: 'werewolf_leader_of_the_pack', ownerId: '0', talentUsed: true },
                            ],
                        },
                        {
                            uid: 'enemy-minion',
                            defId: 'ghosts_spectre',
                            owner: '1',
                            controller: '1',
                        },
                    ],
                    ongoingActions: [],
                },
                { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
            ],
            currentPlayer: '0',
            phase: 'playCards',
            extra: {
                core: {
                    standingStonesDoubleTalentMinionUid: undefined,
                },
            },
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        const hostMinion = page.locator('[data-minion-uid="wolf-host"]');
        const attachedAction = page.locator('[data-attached-action-uid="oa1"]');

        await expect.poll(async () => {
            const state = await game.getState();
            return state.core.bases[0].minions.some((minion: any) => minion.uid === 'wolf-host');
        }, { timeout: 5000 }).toBe(true);

        await page.waitForFunction(
            (uid) => !!document.querySelector(`[data-minion-uid="${uid}"]`),
            'wolf-host',
            { timeout: 10000, polling: 200 },
        );
        await expect(hostMinion).toBeVisible({ timeout: 5000 });
        await hostMinion.hover();
        await expect(attachedAction).toBeVisible({ timeout: 5000 });

        const beforeState = await game.getState();
        const beforeHost = beforeState.core.bases[0].minions.find((minion: any) => minion.uid === 'wolf-host');
        expect(beforeHost?.attachedActions?.find((action: any) => action.uid === 'oa1')?.talentUsed).toBe(true);
        expect(beforeState.core.standingStonesDoubleTalentMinionUid).toBeUndefined();
        expect(beforeState.core.players['0'].extraTalentUsesConsumed).toBeUndefined();
        expect(beforeState.core.players['0'].actionLimit).toBe(1);

        await game.screenshot('werewolf-standing-stones-before-second-talent', testInfo);

        await attachedAction.click({ force: true });

        await expect.poll(async () => {
            const state = await game.getState();
            const player0 = state.core.players['0'];
            const host = state.core.bases[0].minions.find((minion: any) => minion.uid === 'wolf-host');
            const attached = host?.attachedActions?.find((action: any) => action.uid === 'oa1');
            return {
                actionLimit: player0.actionLimit,
                extraTalentUsesConsumed: player0.extraTalentUsesConsumed ?? null,
                standingStonesDoubleTalentMinionUid: state.core.standingStonesDoubleTalentMinionUid ?? null,
                attachedTalentUsed: attached?.talentUsed ?? false,
            };
        }, { timeout: 5000 }).toEqual({
            actionLimit: 2,
            extraTalentUsesConsumed: null,
            standingStonesDoubleTalentMinionUid: 'wolf-host',
            attachedTalentUsed: true,
        });

        await hostMinion.hover();
        await expect(attachedAction).toBeVisible({ timeout: 5000 });
        await game.screenshot('werewolf-standing-stones-after-second-talent', testInfo);
    });

    test('PC 端 hover 随从时，附着行动卡应至少放大到宿主随从宽度的一半', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', WEREWOLF_STANDING_STONES_QUERY, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                factions: ['werewolves', 'ghosts'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['aliens', 'pirates'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                {
                    defId: 'base_standing_stones',
                    minions: [
                        {
                            uid: 'wolf-host-preview',
                            defId: 'werewolf_pack_alpha',
                            owner: '0',
                            controller: '0',
                            attachedActions: [
                                { uid: 'oa-preview', defId: 'werewolf_leader_of_the_pack', ownerId: '0', talentUsed: true },
                            ],
                        },
                    ],
                    ongoingActions: [],
                },
                { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        const hostMinion = page.locator('[data-minion-uid="wolf-host-preview"]');
        const attachedAction = page.locator('[data-attached-action-uid="oa-preview"]');

        await expect(hostMinion).toBeVisible({ timeout: 10000 });
        await hostMinion.hover();
        await expect(attachedAction).toBeVisible({ timeout: 5000 });

        const hostMinionBox = await hostMinion.boundingBox();
        const attachedActionBox = await attachedAction.boundingBox();
        expect(hostMinionBox, 'PC 端宿主随从应提供尺寸').not.toBeNull();
        expect(attachedActionBox, 'PC 端附着行动卡应提供尺寸').not.toBeNull();
        expect(
            attachedActionBox!.width,
            'PC 端附着行动卡宽度应至少达到宿主随从宽度的一半，避免过小',
        ).toBeGreaterThan((hostMinionBox?.width ?? 0) * 0.45);

        await game.screenshot('smashup-pc-attached-action-size', testInfo);
    });

    test('主动基地能力徽记应保持底部居中，不再向右偏', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', SMASHUP_GAMEPLAY_QUERY, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'hand-bury-card', defId: 'ancient_egyptians_you_can_take_it_with_you', type: 'action' },
                ],
                factions: ['ancient_egyptians', 'robots'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['ninjas', 'pirates'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                { defId: 'base_pyramids' },
                { defId: 'base_the_homeworld' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        const baseCard = page.getByTestId('base-zone-0');
        const badge = page.getByTestId('base-ability-badge-0');

        await expect(baseCard).toBeVisible({ timeout: 5000 });
        await expect(badge).toBeVisible({ timeout: 5000 });

        const centerOffsetPx = await page.evaluate(() => {
            const base = document.querySelector<HTMLElement>('[data-testid="base-zone-0"]');
            const badgeEl = document.querySelector<HTMLElement>('[data-testid="base-ability-badge-0"]');
            if (!base || !badgeEl) return null;
            const baseRect = base.getBoundingClientRect();
            const badgeRect = badgeEl.getBoundingClientRect();
            const baseCenter = baseRect.left + baseRect.width / 2;
            const badgeCenter = badgeRect.left + badgeRect.width / 2;
            return Math.abs(baseCenter - badgeCenter);
        });

        expect(centerOffsetPx).not.toBeNull();
        expect(centerOffsetPx!).toBeLessThan(2);

        await game.screenshot('active-base-ability-badge-centered', testInfo);
    });

    test('适者生存无需选择基地；全局结算后若最低力量平局则进入平局选择', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', {
            numPlayers: 2,
            skipInitialization: true,
        });

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'p0-sotf', defId: 'dino_survival_of_the_fittest_pod', type: 'action' },
                ],
                factions: ['dinosaurs_pod', 'innsmouth_pod'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['robots', 'wizards'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                {
                    defId: 'base_innsmouth_base',
                    minions: [
                        { uid: 'b0-strong', defId: 'dino_king_rex_pod', owner: '0', controller: '0', basePower: 7 },
                        { uid: 'b0-weak', defId: 'innsmouth_the_locals_pod', owner: '0', controller: '0', basePower: 1 },
                        { uid: 'b0-enemy', defId: 'robot_microbot_guard', owner: '1', controller: '1', basePower: 1 },
                    ],
                },
                {
                    defId: 'base_wizard_academy',
                    minions: [
                        { uid: 'b1-weak', defId: 'robot_microbot_guard', owner: '1', controller: '1', basePower: 1 },
                        { uid: 'b1-mid-a', defId: 'innsmouth_the_locals_pod', owner: '0', controller: '0', basePower: 2 },
                        { uid: 'b1-mid-b', defId: 'innsmouth_the_locals_pod', owner: '0', controller: '0', basePower: 2 },
                    ],
                },
                {
                    defId: 'base_the_factory',
                    minions: [
                        { uid: 'b2-only', defId: 'robot_microbot_alpha', owner: '1', controller: '1', basePower: 1 },
                    ],
                },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        const handCard = page.locator('[data-card-uid="p0-sotf"]');
        const base1 = page.locator('[data-base-index="1"]');

        await expect(handCard).toBeVisible();
        await expect(base1).toBeVisible();

        await handCard.click();
        await page.waitForTimeout(300);

        await expect(handCard, '点卡后应进入无目标行动的确认态，不能直接弹“场上没有符合条件的目标”').toBeVisible();
        await expect(page.getByText('场上没有符合条件的目标')).toHaveCount(0);
        await expect(page.getByText('请先完成当前选择')).toHaveCount(0);
        await game.screenshot('sotf-after-card-click-selected-global-action', testInfo);

        await handCard.click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                inHand: state.core.players['0'].hand.some((card: any) => card.uid === 'p0-sotf'),
                base1WeakAlive: state.core.bases[1].minions.some((minion: any) => minion.uid === 'b1-weak'),
                base2OnlyAlive: state.core.bases[2].minions.some((minion: any) => minion.uid === 'b2-only'),
                interactionSourceId: state.sys.interaction?.current?.data?.sourceId ?? null,
                tieBreakOptions: (state.sys.interaction?.current?.data?.options ?? []).map((option: any) => option?.value?.minionUid ?? null),
            };
        }, { timeout: 5000 }).toEqual({
            inHand: false,
            base1WeakAlive: false,
            base2OnlyAlive: true,
            interactionSourceId: 'dino_survival_tiebreak',
            tieBreakOptions: expect.arrayContaining(['b0-weak', 'b0-enemy']),
        });

        await expect(page.getByText('场上没有符合条件的目标')).toHaveCount(0);
        await expect(page.getByText('请先完成当前选择')).toHaveCount(0);
        await expect(page.getByText('选择要消灭的最低力量随从')).toBeVisible();
        await game.screenshot('sotf-after-global-action-awaiting-tiebreak', testInfo);

        await expect(page.locator('[data-minion-uid="b0-weak"]')).toBeVisible();
        await expect(page.locator('[data-minion-uid="b0-enemy"]')).toBeVisible();
        await game.screenshot('sotf-tiebreak-candidates-visible', testInfo);
    });

    test('Fairies OR 分支：Titania 会先执行已选分支，再给剩余分支与跳过', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', FAIRIES_OR_QUERY, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'hand-titania', defId: 'fairies_titania', type: 'minion' },
                ],
                factions: ['fairies', 'robots'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                hand: [],
                factions: ['pirates', 'aliens'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                {
                    defId: 'base_the_mothership',
                    minions: [
                        { uid: 'enemy-first-mate', defId: 'pirate_first_mate', owner: '1', controller: '1', basePower: 2 },
                    ],
                },
                { defId: 'base_tortuga' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
            extra: {
                core: {
                    enabledExpansions: ['titans'],
                    titans: [
                        {
                            uid: 'spirit-1',
                            defId: 'fairies_spirit_of_the_forest',
                            faction: 'fairies',
                            ownerId: '0',
                            controllerId: '0',
                            powerCounters: 0,
                            talentUsed: false,
                            location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                        },
                    ],
                },
            },
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');
        const initialState = await game.getState();

        await game.playCard('fairies_titania', { targetBaseIndex: 0 });
        await game.waitForInteraction('fairies_titania', 10000);

        const promptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                optionCount: current?.data?.options?.length ?? 0,
                optionLabels: (current?.data?.options ?? []).map((option: any) => option?.label ?? null),
                returnBranchOptionId: (current?.data?.options ?? []).find((option: any) => option?.value?.branchId === 'return_minion')?.id ?? null,
                extraMinionOptionId: (current?.data?.options ?? []).find((option: any) => option?.value?.branchId === 'extra_minion')?.id ?? null,
            };
        });
        expect(promptMeta.sourceId).toBe('fairies_titania');
        expect(promptMeta.optionCount).toBeGreaterThanOrEqual(2);
        expect(promptMeta.optionLabels).toEqual(expect.arrayContaining([
            '额外打出一个随从',
            '将一个随从移回其拥有者手牌',
        ]));
        expect(promptMeta.returnBranchOptionId).toBeTruthy();
        expect(promptMeta.extraMinionOptionId).toBeTruthy();
        expect(promptMeta.optionLabels).not.toEqual(expect.arrayContaining(['First Mate @ The Mothership']));

        const returnBranchButton = page.getByRole('button', { name: /将一个随从移回其拥有者手牌/i });
        const extraMinionButton = page.getByRole('button', { name: /额外打出一个随从/i });
        await expect(returnBranchButton).toBeVisible();
        await expect(extraMinionButton).toBeVisible();
        await game.screenshot('fairies-titania-branch-prompt-visible', testInfo);

        await returnBranchButton.click();
        await game.waitForInteraction('fairies_titania_return_minion', 10000);

        const targetPromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                targetType: current?.data?.targetType ?? null,
                optionLabels: (current?.data?.options ?? []).map((option: any) => option?.label ?? null),
            };
        });
        expect(targetPromptMeta.sourceId).toBe('fairies_titania_return_minion');
        expect(targetPromptMeta.targetType).toBe('minion');
        expect(targetPromptMeta.optionLabels).toEqual(expect.arrayContaining(['大副 @ 母舰']));
        await expect(page.getByTestId('prompt-overlay')).toHaveCount(0);
        const returnTargetCard = page.locator('[data-minion-uid="enemy-first-mate"]');
        await expect(returnTargetCard).toBeVisible();
        await game.screenshot('fairies-titania-target-prompt-visible', testInfo);

        await returnTargetCard.click();
        await game.waitForInteraction('fairies_titania', 10000);
        await page.waitForTimeout(1200);

        const followUpMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            const state = harness?.state?.get?.();
            return {
                sourceId: current?.data?.sourceId ?? null,
                optionLabels: (current?.data?.options ?? []).map((option: any) => option?.label ?? null),
                extraMinionOptionId: (current?.data?.options ?? []).find((option: any) => option?.value?.branchId === 'extra_minion')?.id ?? null,
                skipOptionId: (current?.data?.options ?? []).find((option: any) => option?.value?.skip === true)?.id ?? null,
                spiritUsedTurn: state?.core?.titans?.find((titan: any) => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn ?? null,
            };
        });
        expect(followUpMeta.sourceId).toBe('fairies_titania');
        expect(followUpMeta.optionLabels).toEqual(expect.arrayContaining(['额外打出一个随从', '跳过']));
        expect(followUpMeta.optionLabels).not.toEqual(expect.arrayContaining(['将一个随从移回其拥有者手牌']));
        expect(followUpMeta.extraMinionOptionId).toBeTruthy();
        expect(followUpMeta.skipOptionId).toBeTruthy();
        expect(followUpMeta.spiritUsedTurn).toBeNull();
        await game.screenshot('fairies-titania-follow-up-prompt-visible', testInfo);

        await page.getByRole('button', { name: /额外打出一个随从/i }).click();
        await game.waitForNoInteraction(10000);

        const finalState = await game.getState();
        expect(finalState.core.bases[0].minions.some((minion: any) => minion.uid === 'hand-titania')).toBe(true);
        expect(finalState.core.bases[0].minions.some((minion: any) => minion.uid === 'enemy-first-mate')).toBe(false);
        expect(finalState.core.players['1'].hand.some((card: any) => card.uid === 'enemy-first-mate')).toBe(true);
        expect(finalState.core.players['0'].minionLimit).toBe(initialState.core.players['0'].minionLimit + 1);
        expect(finalState.core.titans?.find((titan: any) => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn).toBe(1);
        await game.screenshot('fairies-titania-sequential-resolved', testInfo);
    });

    test('Fairies OR 分支：同 frame 插队交互会先于剩余分支收口', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', FAIRIES_OR_QUERY, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'hand-titania', defId: 'fairies_titania', type: 'minion' },
                ],
                factions: ['fairies', 'robots'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                hand: [],
                factions: ['pirates', 'aliens'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                {
                    defId: 'base_the_mothership',
                    minions: [
                        { uid: 'enemy-first-mate', defId: 'pirate_first_mate', owner: '1', controller: '1', basePower: 2 },
                    ],
                },
                { defId: 'base_tortuga' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
            extra: {
                core: {
                    enabledExpansions: ['titans'],
                    titans: [
                        {
                            uid: 'spirit-1',
                            defId: 'fairies_spirit_of_the_forest',
                            faction: 'fairies',
                            ownerId: '0',
                            controllerId: '0',
                            powerCounters: 0,
                            talentUsed: false,
                            location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                        },
                    ],
                },
            },
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        await game.playCard('fairies_titania', { targetBaseIndex: 0 });
        await game.waitForInteraction('fairies_titania', 10000);
        await page.getByRole('button', { name: /将一个随从移回其拥有者手牌/i }).click();
        await game.waitForInteraction('fairies_titania_return_minion', 10000);

        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            const frameId = state?.sys?.interaction?.current?.resolutionFrameId;
            if (!state || !frameId) {
                throw new Error('未找到 Titania 分支 frameId');
            }

            const nextState = JSON.parse(JSON.stringify(state));
            nextState.sys.interaction.current = {
                id: 'synthetic_inserted',
                kind: 'simple-choice',
                playerId: '0',
                resolutionFrameId: frameId,
                data: {
                    title: '模拟返回时插队交互',
                    sourceId: 'synthetic_inserted',
                    targetType: 'button',
                    autoResolveIfSingle: false,
                    options: [
                        { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' },
                    ],
                },
            };
            nextState.sys.interaction.queue = [];
            harness.state.set(nextState);
        });

        await game.waitForInteraction('synthetic_inserted', 10000);
        await expect(page.getByText('模拟返回时插队交互')).toBeVisible();
        await expect(page.getByRole('button', { name: /^跳过$/ })).toBeVisible();

        const insertedMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                optionLabels: (current?.data?.options ?? []).map((option: any) => option?.label ?? null),
            };
        });
        expect(insertedMeta.sourceId).toBe('synthetic_inserted');
        expect(insertedMeta.optionLabels).toEqual(['跳过']);
        await game.screenshot('fairies-titania-inserted-interaction-visible', testInfo);

        await page.getByRole('button', { name: /^跳过$/ }).click();
        await game.waitForInteraction('fairies_titania', 10000);

        const followUpMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                optionLabels: (current?.data?.options ?? []).map((option: any) => option?.label ?? null),
            };
        });
        expect(followUpMeta.sourceId).toBe('fairies_titania');
        expect(followUpMeta.optionLabels).toEqual(expect.arrayContaining(['额外打出一个随从', '跳过']));
        expect(followUpMeta.optionLabels).not.toEqual(expect.arrayContaining(['将一个随从移回其拥有者手牌']));
        await game.screenshot('fairies-titania-follow-up-after-inserted-visible', testInfo);

        await page.getByRole('button', { name: /额外打出一个随从/i }).click();
        await game.waitForNoInteraction(10000);

        const finalState = await game.getState();
        expect(finalState.core.players['0'].minionLimit).toBe(2);
        expect(finalState.core.titans?.find((titan: any) => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn).toBe(1);
        await game.screenshot('fairies-titania-inserted-interaction-resolved', testInfo);
    });

    test('Fairies OR 分支：Fairy Ring 单分支确认会先执行该分支，再允许跳过剩余分支', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', FAIRIES_OR_QUERY, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'hand-alpha', defId: 'robot_microbot_alpha', type: 'minion' },
                ],
                factions: ['fairies', 'robots'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                hand: [],
                factions: ['pirates', 'aliens'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                {
                    defId: 'base_fairy_ring',
                    minions: [],
                    ongoingActions: [],
                },
                { defId: 'base_the_mothership' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
            extra: {
                core: {
                    enabledExpansions: ['titans'],
                    titans: [
                        {
                            uid: 'spirit-1',
                            defId: 'fairies_spirit_of_the_forest',
                            faction: 'fairies',
                            ownerId: '0',
                            controllerId: '0',
                            powerCounters: 0,
                            talentUsed: false,
                            location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                        },
                    ],
                },
            },
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        await game.playCard('robot_microbot_alpha', { targetBaseIndex: 0 });
        await game.waitForInteraction('base_fairy_ring', 10000);

        const promptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                optionLabels: (current?.data?.options ?? []).map((option: any) => option?.label ?? null),
            };
        });
        expect(promptMeta.sourceId).toBe('base_fairy_ring');
        expect(promptMeta.optionLabels).toEqual(expect.arrayContaining(['额外打出一个随从到这里', '额外打出一张行动卡', '跳过']));

        const extraActionButton = page.getByRole('button', { name: /额外打出一张行动卡/i });
        await expect(extraActionButton).toBeVisible();
        await game.screenshot('fairy-ring-branch-prompt-visible', testInfo);

        await extraActionButton.click();
        await game.waitForInteraction('base_fairy_ring', 10000);

        const followUpMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            const state = harness?.state?.get?.();
            return {
                sourceId: current?.data?.sourceId ?? null,
                optionLabels: (current?.data?.options ?? []).map((option: any) => option?.label ?? null),
                spiritUsedTurn: state?.core?.titans?.find((titan: any) => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn ?? null,
                actionLimit: state?.core?.players?.['0']?.actionLimit ?? null,
            };
        });
        expect(followUpMeta.sourceId).toBe('base_fairy_ring');
        expect(followUpMeta.optionLabels).toEqual(expect.arrayContaining(['额外打出一个随从到这里', '跳过']));
        expect(followUpMeta.optionLabels).not.toEqual(expect.arrayContaining(['额外打出一张行动卡']));
        expect(followUpMeta.actionLimit).toBe(2);
        expect(followUpMeta.spiritUsedTurn).toBeNull();
        await game.screenshot('fairy-ring-follow-up-prompt-visible', testInfo);

        await page.getByRole('button', { name: /跳过/i }).click();
        await game.waitForNoInteraction(10000);

        const finalState = await game.getState();
        expect(finalState.core.players['0'].actionLimit).toBe(2);
        expect(finalState.core.players['0'].minionLimit).toBe(1);
        expect(finalState.core.players['0'].baseLimitedMinionQuota).toBeUndefined();
        expect(finalState.core.titans?.find((titan: any) => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn).toBeUndefined();
        await game.screenshot('fairy-ring-sequential-resolved', testInfo);
    });
});
