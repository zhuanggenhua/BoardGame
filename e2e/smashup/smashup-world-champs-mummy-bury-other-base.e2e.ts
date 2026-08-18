import { test, expect } from '../framework';

function makeMinion(
    uid: string,
    defId: string,
    owner: string,
    basePower: number,
) {
    return {
        uid,
        defId,
        owner,
        controller: owner,
        basePower,
        powerModifier: 0,
        powerCounters: 0,
        tempPowerModifier: 0,
        talentUsed: false,
        attachedActions: [],
    };
}

async function advanceToMummyAfterScoringPrompt(game: {
    getState: () => Promise<any>;
    passResponseWindow: (playerId?: string) => Promise<void>;
    selectInteractionOptionBy: (matcher: (option: any) => boolean, description: string) => Promise<void>;
}, page: { waitForTimeout: (ms: number) => Promise<void> }) {
    for (let step = 0; step < 12; step += 1) {
        const state = await game.getState();
        const sourceId = state?.sys?.interaction?.current?.data?.sourceId ?? null;
        const windowType = state?.sys?.responseWindow?.current?.windowType ?? null;

        if (sourceId === 'world_champs_mummy_after_scoring') {
            return;
        }

        if (sourceId === 'smashup_reaction_choose') {
            await game.selectInteractionOptionBy(
                (option: any) => option.id !== 'skip'
                    && option.id !== 'pass'
                    && (option.value?.triggerId?.includes('world_champs_mummy')
                        || String(option.label ?? '').includes('木乃伊')
                        || String(option.label ?? '').toLowerCase().includes('mummy')),
                '木乃伊 afterScoring trigger',
            );
            continue;
        }

        if (windowType === 'meFirst' || windowType === 'afterScoring') {
            await game.passResponseWindow();
            continue;
        }

        await page.waitForTimeout(300);
    }

    throw new Error('未能推进到 world_champs_mummy_after_scoring 交互');
}

test.describe('SmashUp 世界冠军木乃伊埋葬流程', () => {
    test('计分后可以把世界冠军木乃伊埋到其他基地', async ({ game, page }, testInfo) => {
        test.setTimeout(180000);

        await page.goto('/play/smashup', { waitUntil: 'commit', timeout: 60000 });
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 60000, polling: 200 },
        );
        await game.setupScene({
            gameId: 'smashup',
            phase: 'playCards',
            currentPlayer: '0',
            player0: {
                hand: [],
                factions: ['world_champs', 'ancient_egyptians'],
            },
            player1: {
                hand: [],
                factions: ['pirates', 'ninjas'],
            },
            bases: [
                {
                    defId: 'base_the_jungle',
                    minions: [
                        makeMinion('wc-mummy', 'world_champs_mummy', '0', 4),
                        makeMinion('wc-ally', 'test_minion', '0', 8),
                        makeMinion('enemy-body', 'test_minion', '1', 5),
                    ],
                },
                {
                    defId: 'base_secret_garden',
                    minions: [],
                },
                {
                    defId: 'base_central_brain',
                    minions: [],
                },
            ],
            extra: {
                core: {
                    baseDeck: ['base_tar_pits'],
                },
            },
        });

        await game.waitForPhase('playCards', 10000);
        await game.waitForCurrentPlayer('0', 10000);
        await game.screenshot('world-champs-mummy-01-scene-ready', testInfo);

        await game.advancePhase();
        await game.waitForPhase('scoreBases', 10000);
        await advanceToMummyAfterScoringPrompt(game, page);

        const promptState = await game.getState();
        const prompt = promptState?.sys?.interaction?.current;
        expect(prompt?.data?.sourceId).toBe('world_champs_mummy_after_scoring');

        const targetOptions = prompt?.data?.options ?? [];
        expect(targetOptions.some((option: any) => option.value?.baseIndex === 0)).toBe(false);
        expect(targetOptions.some((option: any) => option.value?.baseIndex === 1)).toBe(true);
        const mummyCard = page.locator('[data-minion-uid="wc-mummy"]').first();
        const mummyFrame = page.getByTestId('su-minion-frame-wc-mummy');
        const sourceBase = page.getByTestId('base-zone-0');
        const targetBase = page.getByTestId('base-zone-1');
        const otherTargetBase = page.getByTestId('base-zone-2');
        const sourceBaseHighlight = page.getByTestId('su-base-target-highlight-0');
        const targetBaseHighlight = page.getByTestId('su-base-target-highlight-1');
        const otherTargetBaseHighlight = page.getByTestId('su-base-target-highlight-2');

        await expect(mummyCard).toHaveAttribute('data-highlighted', 'true');
        await expect(mummyFrame).toHaveAttribute('data-highlighted', 'true');
        await expect(sourceBase).toHaveAttribute('data-selectable', 'false');
        await expect(targetBase).toHaveAttribute('data-selectable', 'false');
        await expect(otherTargetBase).toHaveAttribute('data-selectable', 'false');
        await expect(targetBase).toHaveAttribute('data-deploy-mode', 'false');
        await expect(sourceBaseHighlight).toHaveCount(0);
        await expect(targetBaseHighlight).toHaveCount(0);
        await expect(otherTargetBaseHighlight).toHaveCount(0);
        await game.screenshot('world-champs-mummy-02-source-highlight', testInfo);

        await mummyCard.click({ force: true });
        await expect(mummyCard).toHaveAttribute('data-selected', 'true');
        await expect(mummyFrame).toHaveAttribute('data-selected', 'true');
        await expect(sourceBase).toHaveAttribute('data-selectable', 'false');
        await expect(targetBase).toHaveAttribute('data-selectable', 'true');
        await expect(targetBase).toHaveAttribute('data-deploy-mode', 'true');
        await expect(targetBase).toHaveAttribute('data-dimmed', 'false');
        await expect(otherTargetBase).toHaveAttribute('data-selectable', 'true');
        await expect(otherTargetBase).toHaveAttribute('data-deploy-mode', 'true');
        await expect(sourceBaseHighlight).toHaveCount(0);
        await expect(targetBaseHighlight).toBeVisible();
        await expect(otherTargetBaseHighlight).toBeVisible();
        await expect(targetBaseHighlight).toHaveCSS('border-top-color', 'rgba(134, 239, 172, 0.98)');
        await expect(otherTargetBaseHighlight).toHaveCSS('border-top-color', 'rgba(134, 239, 172, 0.98)');
        await game.screenshot('world-champs-mummy-03-target-base-highlight', testInfo);

        await targetBase.click({ force: true });

        for (let step = 0; step < 8; step += 1) {
            const state = await game.getState();
            const windowType = state?.sys?.responseWindow?.current?.windowType ?? null;
            const currentInteraction = state?.sys?.interaction?.current?.data?.sourceId ?? null;

            if (!windowType && !currentInteraction) {
                break;
            }

            if (windowType === 'meFirst' || windowType === 'afterScoring') {
                await game.passResponseWindow();
                continue;
            }

            await page.waitForTimeout(300);
        }

        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.sys?.phase === 'playCards'
                    && state?.core?.turnOrder?.[state?.core?.currentPlayerIndex] === '1'
                    && !state?.sys?.interaction?.current
                    && !state?.sys?.responseWindow?.current;
            },
            { timeout: 15000, polling: 200 },
        );

        const finalState = await game.getState();
        const targetBaseBuried = finalState?.core?.bases?.[1]?.buriedCards ?? [];
        const player0Discard = finalState?.core?.players?.['0']?.discard ?? [];

        expect(targetBaseBuried.some((card: any) => card.uid === 'wc-mummy' && card.defId === 'world_champs_mummy')).toBe(true);
        expect(player0Discard.some((card: any) => card.uid === 'wc-mummy')).toBe(false);
        await game.screenshot('world-champs-mummy-04-final-state', testInfo);
    });
});
