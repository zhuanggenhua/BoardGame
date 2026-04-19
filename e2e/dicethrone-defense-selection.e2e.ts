import { test, expect } from './framework';
import type { GameTestContext } from './framework';

async function setupDefenseSelectionScene(
    game: GameTestContext,
    defenderCharacter: 'shadow_thief' | 'paladin',
    defenseAbilityId: string | null = null,
): Promise<void> {
    await game.openTestGame('dicethrone', { playerID: 1 });

    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { CP: 2, HP: 50 },
            tokens: { loaded: 0 },
        },
        player1: {
            resources: { CP: 2, HP: 50 },
        },
        currentPlayer: '0',
        phase: 'defensiveRoll',
        extra: {
            selectedCharacters: { '0': 'monk', '1': defenderCharacter },
            hostStarted: true,
            rollCount: 0,
            rollLimit: 1,
            rollConfirmed: false,
            dice: [
                { id: 0, value: 1, isKept: false },
                { id: 1, value: 2, isKept: false },
                { id: 2, value: 3, isKept: false },
                { id: 3, value: 4, isKept: false },
                { id: 4, value: 5, isKept: false },
            ],
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                isDefendable: true,
                damage: 5,
                bonusDamage: 0,
                sourceAbilityId: 'smash',
                defenseAbilityId,
            },
            activePlayerId: '1',
        },
    });

    await expect.poll(async () => {
        const state = await game.getState();
        return {
            phase: state?.sys?.phase ?? null,
            activePlayerId: state?.core?.activePlayerId ?? null,
            defenderId: state?.core?.pendingAttack?.defenderId ?? null,
            defenseAbilityId: state?.core?.pendingAttack?.defenseAbilityId ?? null,
            rollCount: state?.core?.rollCount ?? null,
        };
    }, { timeout: 10000 }).toMatchObject({
        phase: 'defensiveRoll',
        activePlayerId: '1',
        defenderId: '1',
        defenseAbilityId,
        rollCount: 0,
    });
}

async function setupSelfResponseAbilityScene(
    page: import('@playwright/test').Page,
    game: GameTestContext,
): Promise<void> {
    await game.openTestGame('dicethrone');

    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { cp: 2, hp: 50 },
        },
        player1: {
            resources: { cp: 2, hp: 50 },
        },
        currentPlayer: '1',
        phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'barbarian', '1': 'monk' },
            hostStarted: true,
            rollCount: 1,
            rollLimit: 3,
            rollConfirmed: true,
            pendingAttack: null,
            dice: Array.from({ length: 5 }, (_, index) => ({
                id: index,
                definitionId: 'monk-dice',
                value: 1,
                symbol: 'fist',
                symbols: ['fist'],
                isKept: false,
            })),
        },
    });

    await page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        if (typeof harness?.state?.patch !== 'function') {
            throw new Error('TestHarness state.patch 不可用');
        }

        harness.state.patch({
            sys: {
                responseWindow: {
                    current: {
                        id: 'self-response-ability-window',
                        windowType: 'afterRollConfirmed',
                        sourceId: 'after-roll-confirmed',
                        responderQueue: ['0'],
                        currentResponderIndex: 0,
                        passedPlayers: [],
                        actionTakenThisRound: false,
                        consecutivePassRounds: 0,
                    },
                },
            },
        });
    });

    await expect.poll(async () => {
        const state = await game.getState();
        const responseWindow = state?.sys?.responseWindow?.current;
        return {
            phase: state?.sys?.phase ?? null,
            activePlayerId: state?.core?.activePlayerId ?? null,
            rollConfirmed: state?.core?.rollConfirmed ?? null,
            responderId: responseWindow?.responderQueue?.[responseWindow.currentResponderIndex] ?? null,
            responseWindowId: responseWindow?.id ?? null,
        };
    }, { timeout: 5000 }).toMatchObject({
        phase: 'offensiveRoll',
        activePlayerId: '1',
        rollConfirmed: true,
        responderId: '0',
        responseWindowId: 'self-response-ability-window',
    });
}

async function setupGunslingerDuelCompareRollScene(game: GameTestContext): Promise<void> {
    await game.openTestGame('dicethrone', { playerID: 1 });

    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { CP: 2, HP: 50 },
        },
        player1: {
            resources: { CP: 2, HP: 50 },
        },
        currentPlayer: '1',
        phase: 'defensiveRoll',
        sys: {
            interaction: {
                current: {
                    id: 'gunslinger-duel-compare-roll',
                    kind: 'compare-roll-choice',
                    playerId: '1',
                    data: {
                        title: 'compareRoll.gunslinger.duel.title',
                        sourceId: 'duel',
                        contestants: [
                            {
                                playerId: '1',
                                label: 'compareRoll.gunslinger.duel.defenderLabel',
                                labelKey: 'compareRoll.gunslinger.duel.defenderLabel',
                                roll: 6,
                                face: 'bullet',
                                characterId: 'gunslinger',
                                effectKey: 'compareRoll.rolled',
                                effectParams: { value: 6 },
                            },
                            {
                                playerId: '0',
                                label: 'compareRoll.gunslinger.duel.attackerLabel',
                                labelKey: 'compareRoll.gunslinger.duel.attackerLabel',
                                roll: 1,
                                face: 'fist',
                                characterId: 'monk',
                                effectKey: 'compareRoll.rolled',
                                effectParams: { value: 1 },
                            },
                        ],
                        resultText: 'compareRoll.gunslinger.duel.win',
                        resultTextKey: 'compareRoll.gunslinger.duel.win',
                        resultTone: 'success',
                        options: [
                            {
                                id: 'option-0',
                                label: 'choices.gunslingerDuel.deal3',
                                labelKey: 'choices.gunslingerDuel.deal3',
                                value: { value: 3, customId: 'gunslinger-duel-deal-3' },
                            },
                            {
                                id: 'option-1',
                                label: 'choices.gunslingerDuel.preventHalf',
                                labelKey: 'choices.gunslingerDuel.preventHalf',
                                value: { value: 50, customId: 'gunslinger-duel-prevent-half' },
                            },
                        ],
                    },
                },
                queue: [],
            },
        },
        extra: {
            selectedCharacters: { '0': 'monk', '1': 'gunslinger' },
            hostStarted: true,
            activePlayerId: '1',
            rollCount: 1,
            rollLimit: 1,
            rollConfirmed: true,
            dice: [
                { id: 0, definitionId: 'gunslinger-dice', value: 6, symbol: 'bullet', symbols: ['bullet'], isKept: false },
                { id: 1, definitionId: 'gunslinger-dice', value: 2, symbol: 'dash', symbols: ['dash'], isKept: false },
                { id: 2, definitionId: 'gunslinger-dice', value: 3, symbol: 'bullseye', symbols: ['bullseye'], isKept: false },
                { id: 3, definitionId: 'gunslinger-dice', value: 4, symbol: 'bullet', symbols: ['bullet'], isKept: false },
                { id: 4, definitionId: 'gunslinger-dice', value: 5, symbol: 'dash', symbols: ['dash'], isKept: false },
            ],
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                isDefendable: true,
                damage: 8,
                bonusDamage: 0,
                sourceAbilityId: 'fist-technique-5',
                defenseAbilityId: 'duel',
            },
        },
    });

    await expect.poll(async () => {
        const state = await game.getState();
        return {
            phase: state?.sys?.phase ?? null,
            defenseAbilityId: state?.core?.pendingAttack?.defenseAbilityId ?? null,
            rollConfirmed: state?.core?.rollConfirmed ?? null,
            dieValue: state?.core?.dice?.[0]?.value ?? null,
            interactionKind: state?.sys?.interaction?.current?.kind ?? null,
        };
    }, { timeout: 5000 }).toMatchObject({
        phase: 'defensiveRoll',
        defenseAbilityId: 'duel',
        rollConfirmed: true,
        dieValue: 6,
        interactionKind: 'compare-roll-choice',
    });
}

async function setupGunslingerShowdownCompareRollScene(game: GameTestContext): Promise<void> {
    await game.openTestGame('dicethrone', { playerID: 0 });

    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { CP: 2, HP: 50 },
            tokens: { loaded: 0 },
        },
        player1: {
            resources: { CP: 2, HP: 50 },
        },
        currentPlayer: '0',
        phase: 'offensiveRoll',
        sys: {
            interaction: {
                current: {
                    id: 'gunslinger-showdown-compare-roll',
                    kind: 'compare-roll-choice',
                    playerId: '0',
                    data: {
                        title: 'compareRoll.gunslinger.showdown.title',
                        sourceId: 'showdown',
                        contestants: [
                            {
                                playerId: '0',
                                label: 'compareRoll.gunslinger.showdown.attackerLabel',
                                labelKey: 'compareRoll.gunslinger.showdown.attackerLabel',
                                roll: 6,
                                face: 'bullet',
                                characterId: 'gunslinger',
                                effectKey: 'compareRoll.rolled',
                                effectParams: { value: 6 },
                            },
                            {
                                playerId: '1',
                                label: 'compareRoll.gunslinger.showdown.defenderLabel',
                                labelKey: 'compareRoll.gunslinger.showdown.defenderLabel',
                                roll: 1,
                                face: 'fist',
                                characterId: 'monk',
                                effectKey: 'compareRoll.rolled',
                                effectParams: { value: 1 },
                            },
                        ],
                        resultText: 'compareRoll.gunslinger.showdown.win',
                        resultTextKey: 'compareRoll.gunslinger.showdown.win',
                        resultTextParams: { bonus: 2 },
                        resultTone: 'success',
                        confirmValue: { value: 2, customId: 'gunslinger-showdown-apply-bonus' },
                        autoConfirmDelayMs: 400,
                    },
                },
                queue: [],
            },
        },
        extra: {
            selectedCharacters: { '0': 'gunslinger', '1': 'monk' },
            hostStarted: true,
            activePlayerId: '0',
            rollCount: 1,
            rollLimit: 3,
            rollConfirmed: true,
            dice: [
                { id: 0, definitionId: 'gunslinger-dice', value: 1, symbol: 'bullet', symbols: ['bullet'], isKept: false },
                { id: 1, definitionId: 'gunslinger-dice', value: 2, symbol: 'dash', symbols: ['dash'], isKept: false },
                { id: 2, definitionId: 'gunslinger-dice', value: 3, symbol: 'bullseye', symbols: ['bullseye'], isKept: false },
                { id: 3, definitionId: 'gunslinger-dice', value: 4, symbol: 'bullet', symbols: ['bullet'], isKept: false },
                { id: 4, definitionId: 'gunslinger-dice', value: 5, symbol: 'dash', symbols: ['dash'], isKept: false },
            ],
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                isDefendable: true,
                damage: 5,
                bonusDamage: 0,
                sourceAbilityId: 'showdown',
                preDefenseResolved: false,
            },
        },
    });

    await expect.poll(async () => {
        const state = await game.getState();
        return {
            phase: state?.sys?.phase ?? null,
            sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
            bonusDamage: state?.core?.pendingAttack?.bonusDamage ?? null,
            interactionKind: state?.sys?.interaction?.current?.kind ?? null,
        };
    }, { timeout: 5000 }).toMatchObject({
        phase: 'offensiveRoll',
        sourceAbilityId: 'showdown',
        bonusDamage: 0,
        interactionKind: 'compare-roll-choice',
    });
}

test.describe('DiceThrone - 防御技能选择', () => {
    test('影贼防御选择场景应高亮可选技能', async ({ page, game }, testInfo) => {
        await setupDefenseSelectionScene(game, 'shadow_thief', null);

        const highlightedSlots = page
            .locator('[data-ability-slot]')
            .filter({ has: page.locator('div.animate-pulse[class*="border-"]') });
        await expect(highlightedSlots.first()).toBeVisible({ timeout: 5000 });
        expect(await highlightedSlots.count()).toBeGreaterThanOrEqual(2);
        await game.screenshot('shadow-thief-defense-selectable-abilities', testInfo);
    });

    test('圣骑防御场景应显示 holy-defense 并允许投骰', async ({ page, game }) => {
        await setupDefenseSelectionScene(game, 'paladin', 'holy-defense');

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                defenseAbilityId: state?.core?.pendingAttack?.defenseAbilityId ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            phase: 'defensiveRoll',
            defenseAbilityId: 'holy-defense',
        });

        const state = await game.getState();
        expect(state.core.pendingAttack?.defenseAbilityId).toBe('holy-defense');
        await expect(page.locator('[data-tutorial-id="dice-roll-button"]')).toBeEnabled({ timeout: 5000 });
    });

    test('自己处于响应窗口时应高亮对方可选技能', async ({ page, game }, testInfo) => {
        await setupSelfResponseAbilityScene(page, game);

        const highlightedSlots = page
            .locator('[data-ability-slot]')
            .filter({ has: page.locator('div.animate-pulse[class*="border-"]') });

        await expect(highlightedSlots.first()).toBeVisible({ timeout: 5000 });
        expect(await highlightedSlots.count()).toBeGreaterThan(0);
        await game.screenshot('self-response-window-opponent-highlight', testInfo);

        await game.passResponseWindow('0');

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                responseWindowId: state?.sys?.responseWindow?.current?.id ?? null,
                phase: state?.sys?.phase ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            responseWindowId: null,
            phase: 'offensiveRoll',
        });
    });

    test('枪手 Duel 应展示双方对掷 UI，并在选择抵挡一半后结算', async ({ page, game }, testInfo) => {
        await setupGunslingerDuelCompareRollScene(game);

        const overlay = page.getByTestId('compare-roll-overlay');
        await expect(overlay).toBeVisible({ timeout: 5000 });
        await expect(page.getByTestId('compare-roll-participant-0')).toBeVisible();
        await expect(page.getByTestId('compare-roll-participant-1')).toBeVisible();
        await expect(page.getByTestId('compare-roll-result')).toContainText('你赢下对决');
        await expect(page.getByRole('button', { name: /抵挡 1\/2 进攻伤害/i })).toBeVisible();

        await game.screenshot('gunslinger-duel-compare-roll-choice', testInfo);

        await page.getByRole('button', { name: /抵挡 1\/2 进攻伤害/i }).click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                phase: state?.sys?.phase ?? null,
                defenderShieldReduction: state?.core?.players?.['1']?.damageShields?.[0]?.reductionPercent ?? null,
                defenderShieldSource: state?.core?.players?.['1']?.damageShields?.[0]?.sourceId ?? null,
                defenseAbilityId: state?.core?.pendingAttack?.defenseAbilityId ?? null,
            };
        }, { timeout: 8000 }).toMatchObject({
            interactionKind: null,
            phase: 'defensiveRoll',
            defenderShieldReduction: 50,
            defenderShieldSource: 'duel',
            defenseAbilityId: 'duel',
        });

        await expect(overlay).toBeHidden();
    });

    test('枪手 Showdown 应展示双方对掷 UI，并在自动确认后继续结算链路', async ({ page, game }, testInfo) => {
        await setupGunslingerShowdownCompareRollScene(game);

        const overlay = page.getByTestId('compare-roll-overlay');
        await expect(overlay).toBeVisible({ timeout: 5000 });
        await expect(page.getByTestId('compare-roll-participant-0')).toBeVisible();
        await expect(page.getByTestId('compare-roll-participant-1')).toBeVisible();
        await expect(page.getByTestId('compare-roll-result')).toContainText('本次攻击伤害 +2');
        await expect(page.getByTestId('compare-roll-autoconfirm')).toContainText('正在确认对掷结果');

        await game.screenshot('gunslinger-showdown-compare-roll-auto-confirm', testInfo);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                phase: state?.sys?.phase ?? null,
                bonusDamage: state?.core?.pendingAttack?.bonusDamage ?? null,
                sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
            };
        }, { timeout: 8000 }).toMatchObject({
            interactionKind: null,
            phase: 'offensiveRoll',
            bonusDamage: 2,
            sourceAbilityId: 'showdown',
        });

        await expect(overlay).toBeHidden();
    });
});
