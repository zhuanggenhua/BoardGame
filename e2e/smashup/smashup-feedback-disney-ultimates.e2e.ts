import { test, expect } from '../framework';
import { hideSmashUpDebugPanelForEvidence } from '../helpers/smashup';

type InteractionOption = {
    id?: string;
    value?: {
        cardUid?: string;
        mode?: string;
        baseIndex?: number;
        triggerId?: string;
    };
};

type SmashUpFeedbackTrigger = {
    id?: string;
    sourceDefId?: string;
};

type SmashUpFeedbackHarnessState = {
    sys?: {
        interaction?: {
            current?: {
                playerId?: string;
                data?: {
                    options?: InteractionOption[];
                };
            };
        };
    };
    core?: {
        triggerQueue?: SmashUpFeedbackTrigger[];
    };
};

type SmashUpFeedbackHarnessWindow = Window & {
    __BG_TEST_HARNESS__?: {
        state?: {
            get?: () => SmashUpFeedbackHarnessState;
        };
        command?: {
            dispatch?: (command: { type: string; playerId: string; payload: Record<string, unknown> }) => Promise<void>;
        };
    };
};

async function waitForCardArtwork(page: import('@playwright/test').Page): Promise<void> {
    await expect.poll(async () => page.evaluate(() => {
        const frames = Array.from(document.querySelectorAll<HTMLElement>('[data-card-atlas-frame="true"]'));
        const previews = Array.from(document.querySelectorAll<HTMLElement>('[data-card-atlas-frame="true"], .atlas-shimmer'));
        const loaded = frames.filter(frame => {
            const image = frame.querySelector<HTMLImageElement>('img[data-card-atlas-img="true"]');
            return !frame.classList.contains('atlas-shimmer') && !!image && image.complete && image.naturalWidth > 0;
        });
        const shimmering = previews.filter(preview => preview.classList.contains('atlas-shimmer')).length;
        const pending = previews
            .filter(preview => preview.classList.contains('atlas-shimmer'))
            .map(preview => ({
                atlasId: preview.dataset.cardAtlasId ?? null,
                index: preview.dataset.cardAtlasIndex ?? null,
                title: preview.closest<HTMLElement>('[title]')?.getAttribute('title') ?? null,
            }));
        return { ready: previews.length > 0 && loaded.length === previews.length && shimmering === 0, total: previews.length, loaded: loaded.length, shimmering, pending };
    }), { timeout: 30000, polling: 250 }).toEqual(expect.objectContaining({
        ready: true,
        total: expect.any(Number),
        loaded: expect.any(Number),
        shimmering: 0,
    }));
}

async function selectReactionBySourceDefId(
    page: import('@playwright/test').Page,
    sourceDefId: string,
): Promise<void> {
    const optionId = await page.evaluate((expectedSourceDefId) => {
        const harness = (window as SmashUpFeedbackHarnessWindow).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        const interaction = state.sys?.interaction?.current;
        const triggerById = new Map((state.core?.triggerQueue ?? []).map(trigger => [trigger.id, trigger]));
        const option = (interaction?.data?.options ?? []).find(candidate => (
            triggerById.get(candidate.value?.triggerId)?.sourceDefId === expectedSourceDefId
        ));
        return option?.id ?? null;
    }, sourceDefId);

    expect(optionId, `未找到 ${sourceDefId} 的反应选项`).not.toBeNull();
    await page.evaluate(async (id) => {
        const harness = (window as SmashUpFeedbackHarnessWindow).__BG_TEST_HARNESS__;
        const interaction = harness?.state?.get?.()?.sys?.interaction?.current;
        if (!interaction?.playerId || !id || !harness?.command?.dispatch) throw new Error('反应交互已消失');
        await harness.command.dispatch({
            type: 'SYS_INTERACTION_RESPOND',
            playerId: interaction.playerId,
            payload: { optionId: id },
        });
    }, optionId);
    await page.waitForTimeout(300);
}

test.describe('Smash Up 线上反馈代表态', () => {
    test('野兽在多张可弃手牌时必须等待玩家选择指定弃牌，并触发玫瑰花瓣的牌库顶交互', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 30000);
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['beauty_and_the_beast', 'aladdin'],
                hand: [
                    { uid: 'petals-cost', defId: 'beauty_and_the_beast_petals_of_the_rose', type: 'action', owner: '0' },
                    { uid: 'keep-card', defId: 'aladdin_wish', type: 'action', owner: '0' },
                ],
                deck: [
                    { uid: 'rose-top-a', defId: 'beauty_and_the_beast_belle', type: 'minion', owner: '0' },
                    { uid: 'rose-top-b', defId: 'beauty_and_the_beast_beast', type: 'minion', owner: '0' },
                    { uid: 'rose-tail', defId: 'aladdin_abu', type: 'minion', owner: '0' },
                ],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['pirates', 'ninjas'],
                hand: [],
                deck: [],
                discard: [],
            },
            bases: [
                {
                    defId: 'base_agrabah_bazaar',
                    minions: [
                        { uid: 'beast-feedback', defId: 'beauty_and_the_beast_beast', owner: '0', controller: '0', basePower: 4 },
                    ],
                },
                { defId: 'base_halloween_town', minions: [] },
            ],
        });

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="beast-feedback"]')).toBeVisible({ timeout: 15000 });
        await waitForCardArtwork(page);
        await hideSmashUpDebugPanelForEvidence(page);

        await page.locator('[data-minion-uid="beast-feedback"]').click({ force: true });
        await game.waitForInteraction('beauty_and_the_beast_discard_hand', 15000);
        await expect(page.getByText('选择 1 张手牌弃掉')).toBeVisible({ timeout: 10000 });
        await game.screenshot('01-野兽天赋-手动选择弃牌', testInfo);

        const discardOptions = await game.getInteractionOptions() as InteractionOption[];
        expect(discardOptions.map(option => option.value?.cardUid).sort()).toEqual(['keep-card', 'petals-cost']);
        const beforeChoiceState = await game.getState();
        expect(beforeChoiceState.core.players['0'].hand.map((card: { uid: string }) => card.uid).sort()).toEqual([
            'keep-card',
            'petals-cost',
        ]);
        expect(beforeChoiceState.core.players['0'].discard.map((card: { uid: string }) => card.uid)).toEqual([]);
        expect(beforeChoiceState.core.bases[0].minions.find((minion: { uid: string }) => minion.uid === 'beast-feedback')?.powerCounters ?? 0).toBe(0);

        const petalsOption = discardOptions.find(option => option.value?.cardUid === 'petals-cost');
        expect(petalsOption).toBeDefined();
        await game.selectOption(petalsOption!.id!);
        await game.waitForInteraction('smashup_reaction_choose', 15000);
        const reactionOptions = await game.getInteractionOptions() as InteractionOption[];
        expect(reactionOptions.some(option => typeof option.value?.triggerId === 'string')).toBe(true);
        const afterDiscardState = await game.getState();
        expect(afterDiscardState.core.players['0'].hand.map((card: { uid: string }) => card.uid)).toEqual(['keep-card']);
        expect(afterDiscardState.core.players['0'].discard.map((card: { uid: string }) => card.uid)).toContain('petals-cost');
        expect(afterDiscardState.core.bases[0].minions.find((minion: { uid: string }) => minion.uid === 'beast-feedback')?.powerCounters ?? 0).toBe(1);
        await game.screenshot('02-玫瑰花瓣-弃牌后可选反应', testInfo);

        await selectReactionBySourceDefId(page, 'beauty_and_the_beast_petals_of_the_rose');
        await game.waitForInteraction('beauty_and_the_beast_petals_of_the_rose', 15000);
        await expect(page.getByText(/查看并重排牌库顶/)).toBeVisible({ timeout: 10000 });
        await game.screenshot('03-玫瑰花瓣-查看并重排牌库顶', testInfo);

        const petalsOptions = await game.getInteractionOptions() as InteractionOption[];
        const swapOption = petalsOptions.find(option => option.value?.mode === 'swap');
        expect(swapOption).toBeDefined();
        await game.selectOption(swapOption!.id!);
        await game.waitForNoInteraction(15000);

        const finalState = await game.getState();
        expect(finalState.core.players['0'].discard.map((card: { uid: string }) => card.uid)).toContain('petals-cost');
        expect(finalState.core.players['0'].hand.map((card: { uid: string }) => card.uid)).toContain('keep-card');
        expect(finalState.core.bases[0].minions.find((minion: { uid: string }) => minion.uid === 'beast-feedback')?.powerCounters ?? 0).toBe(1);
        expect(finalState.core.players['0'].deck.slice(0, 2).map((card: { uid: string }) => card.uid)).toEqual([
            'rose-top-b',
            'rose-top-a',
        ]);
        await game.screenshot('04-玫瑰花瓣-交换牌库顶后收口', testInfo);
    });

    test('搬运从真实手牌出牌后进入目标基地选择并完成移动', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 30000);
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['ultimates_pod', 'pirates'],
                hand: [
                    { uid: 'lift-and-carry-card', defId: 'ultimates_lift_and_carry_pod', type: 'action', owner: '0' },
                ],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['ninjas', 'aliens'],
                hand: [],
                deck: [],
                discard: [],
            },
            bases: [
                {
                    defId: 'base_agrabah_bazaar',
                    minions: [
                        { uid: 'lift-target', defId: 'pirate_first_mate', owner: '0', controller: '0', basePower: 2 },
                    ],
                },
                { defId: 'base_halloween_town', minions: [] },
                { defId: 'base_the_mothership', minions: [] },
            ],
        });

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="lift-and-carry-card"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="lift-target"]')).toBeVisible({ timeout: 15000 });
        await waitForCardArtwork(page);
        await hideSmashUpDebugPanelForEvidence(page);

        await game.playCard('ultimates_lift_and_carry_pod', { targetMinionUid: 'lift-target' });
        await game.waitForInteraction('ultimates_lift_and_carry_destination', 15000);
        await expect(page.getByText('选择目标基地')).toBeVisible({ timeout: 10000 });
        await game.screenshot('01-搬运-选择目标基地', testInfo);

        const destinationOptions = await game.getInteractionOptions() as InteractionOption[];
        const destination = destinationOptions.find(option => option.value?.baseIndex === 1);
        expect(destination).toBeDefined();
        await game.selectOption(destination!.id!);
        await game.waitForNoInteraction(15000);

        const finalState = await game.getState();
        expect(finalState.core.bases[0].minions.map((minion: { uid: string }) => minion.uid)).not.toContain('lift-target');
        expect(finalState.core.bases[1].minions.map((minion: { uid: string }) => minion.uid)).toContain('lift-target');
        expect(finalState.core.players['0'].discard.map((card: { uid: string }) => card.uid)).toContain('lift-and-carry-card');
        const moveEffect = page.getByTestId('smashup-triggered-fx-target');
        // SmashUp 搬运动效默认最长约 2.6 秒；留出挂载延迟后再截最终状态，避免抓到过程帧。
        await page.waitForTimeout(3500);
        await expect(moveEffect).toHaveCount(0, { timeout: 15000 });
        await game.screenshot('02-搬运-移动到目标基地后收口', testInfo);
    });
});
