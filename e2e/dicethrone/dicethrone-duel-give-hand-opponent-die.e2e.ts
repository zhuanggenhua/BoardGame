import { test, expect } from '../framework';

const dispatchCommand = async (
    page: any,
    type: string,
    playerId: string,
    payload: Record<string, unknown> = {},
) => {
    await page.evaluate(async ({ commandType, commandPlayerId, commandPayload }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        if (!harness?.command?.dispatch) {
            throw new Error('DiceThrone TestHarness command.dispatch 不可用');
        }
        await harness.command.dispatch({
            type: commandType,
            playerId: commandPlayerId,
            payload: commandPayload,
        });
    }, {
        commandType: type,
        commandPlayerId: playerId,
        commandPayload: payload,
    });
};

const setDiceValues = async (page: any, values: number[]) => {
    await page.evaluate((diceValues) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        if (!harness?.dice?.setValues) {
            throw new Error('DiceThrone TestHarness dice.setValues 不可用');
        }
        harness.dice.setValues(diceValues);
    }, values);
};

async function dragHandCardToPlay(page: any, cardId: string): Promise<void> {
    const handCard = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(handCard).toBeVisible({ timeout: 10000 });
    const cardBox = await page.evaluate((nextCardId: string) => {
        const node = document.querySelector(`[data-testid="hand-area"] [data-card-id="${nextCardId}"]`) as HTMLElement | null;
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }, cardId);
    if (!cardBox || cardBox.width <= 0 || cardBox.height <= 0) {
        throw new Error(`未能获取手牌 ${cardId} 的拖拽区域`);
    }

    const startX = cardBox.x + (cardBox.width / 2);
    const startY = cardBox.y + (cardBox.height * 0.78);
    const endY = Math.max(24, startY - 240);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, endY, { steps: 12 });
    await page.mouse.up();
    await page.mouse.move(2, 2);
}

async function expectBoardDiceStageOpponentSelection(page: any) {
    const boardStage = page.getByTestId('dicethrone-board-dice-stage');
    await expect(boardStage).toBeVisible({ timeout: 5000 });

    const defenderDieButton = boardStage.locator('[data-render-mode="engine"][data-testid="die-button-0"]').first();
    const attackerDieButton = boardStage.locator('[data-render-mode="engine"][data-testid="die-button-1"]').first();
    await expect(defenderDieButton).toBeVisible({ timeout: 5000 });
    await expect(attackerDieButton).toBeVisible({ timeout: 5000 });
    await expect(defenderDieButton).toHaveAttribute('data-owner-id', '1', { timeout: 5000 });
    await expect(attackerDieButton).toHaveAttribute('data-owner-id', '0', { timeout: 5000 });
    await expect(defenderDieButton).toHaveAttribute('data-clickable', 'true', { timeout: 5000 });
    await expect(attackerDieButton).toHaveAttribute('data-clickable', 'false', { timeout: 5000 });
    await expect(defenderDieButton).toHaveAttribute('data-board-dice-operation-anchor', 'true', { timeout: 5000 });
    await expect(attackerDieButton).toHaveAttribute('data-board-dice-operation-anchor', 'true', { timeout: 5000 });
    await expect(defenderDieButton).not.toHaveAttribute('data-projected-width', '');
    await expect(defenderDieButton).not.toHaveAttribute('data-projected-height', '');

    return { boardStage, defenderDieButton, attackerDieButton };
}

test.describe('DiceThrone - 枪手决斗后抬一手改对手骰子', () => {
    test('枪手 Duel 确认防御骰后，进攻方可用抬一手重掷枪手防御骰', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);

        await page.addInitScript(() => {
            window.localStorage.setItem('dicethrone:boardDice3dEnabled', 'true');
        });
        await game.openTestGame('dicethrone', { playerID: '0' });

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-give-hand'],
                resources: { CP: 10, HP: 50 },
            },
            player1: {
                resources: { CP: 2, HP: 50 },
            },
            currentPlayer: '0',
            phase: 'defensiveRoll',
            sys: {
                interaction: {
                    current: null,
                    queue: [],
                },
                responseWindow: {
                    current: null,
                },
            },
            extra: {
                selectedCharacters: { '0': 'monk', '1': 'gunslinger' },
                hostStarted: true,
                activePlayerId: '1',
                rollCount: 0,
                rollLimit: 1,
                rollConfirmed: false,
                pendingDamage: null,
                dice: [
                    { id: 0, definitionId: 'gunslinger-dice', value: 1, isKept: false },
                ],
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                    isDefendable: true,
                    damage: 5,
                    bonusDamage: 0,
                    sourceAbilityId: 'harmony',
                    defenseAbilityId: 'duel',
                },
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
                rollConfirmed: state?.core?.rollConfirmed ?? null,
                handIds: (state?.core?.players?.['0']?.hand ?? []).map((card: any) => card.id),
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'defensiveRoll',
            activePlayerId: '1',
            defenderId: '1',
            defenseAbilityId: 'duel',
            rollCount: 0,
            rollConfirmed: false,
            handIds: ['card-give-hand'],
        });

        await game.screenshot('01-duel-defense-before-roll', testInfo);

        await setDiceValues(page, [6, 2]);
        await dispatchCommand(page, 'ROLL_DICE', '1');
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                rollCount: state?.core?.rollCount ?? null,
                firstDie: state?.core?.dice?.[0]?.value ?? null,
                duelAttackerDieValue: state?.core?.pendingAttack?.duelAttackerDieValue ?? null,
                rollConfirmed: state?.core?.rollConfirmed ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            rollCount: 1,
            firstDie: 6,
            duelAttackerDieValue: 2,
        });

        const afterRollState = await game.getState();
        if (afterRollState?.core?.rollConfirmed !== true) {
            await dispatchCommand(page, 'CONFIRM_ROLL', '1');
        }
        await expect.poll(async () => {
            const state = await game.getState();
            const responseWindow = state?.sys?.responseWindow?.current;
            return {
                phase: state?.sys?.phase ?? null,
                rollConfirmed: state?.core?.rollConfirmed ?? null,
                firstDie: state?.core?.dice?.[0]?.value ?? null,
                duelAttackerDieValue: state?.core?.pendingAttack?.duelAttackerDieValue ?? null,
                windowType: responseWindow?.windowType ?? null,
                responderQueue: responseWindow?.responderQueue ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            phase: 'defensiveRoll',
            rollConfirmed: true,
            firstDie: 6,
            duelAttackerDieValue: 2,
            windowType: 'afterRollConfirmed',
            responderQueue: ['0'],
        });

        await game.screenshot('02-duel-defense-confirmed-response-window', testInfo);

        const giveHandCard = page
            .locator('[data-card-id="card-give-hand"], [data-card-key^="card-give-hand-"]')
            .first();
        await expect(giveHandCard).toBeVisible({ timeout: 5000 });
        await dragHandCardToPlay(page, 'card-give-hand');

        await expect.poll(async () => {
            const state = await game.getState();
            const interaction = state?.sys?.interaction?.current;
            const meta = interaction?.data?.meta;
            return {
                interactionKind: interaction?.kind ?? null,
                interactionPlayerId: interaction?.playerId ?? null,
                dtType: meta?.dtType ?? null,
                targetOpponentDice: meta?.targetOpponentDice ?? null,
                diceOwnerId: meta?.diceOwnerId ?? null,
                allowedDieIds: interaction?.data?.allowedDieIds ?? null,
                pendingInteractionId: state?.sys?.responseWindow?.current?.pendingInteractionId ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            interactionKind: 'multistep-choice',
            interactionPlayerId: '0',
            dtType: 'selectDie',
            targetOpponentDice: true,
            diceOwnerId: '1',
            allowedDieIds: [0, 1],
        });

        const { boardStage, defenderDieButton } = await expectBoardDiceStageOpponentSelection(page);
        await expect(page.locator('[data-tutorial-id="dice-tray"] [data-testid^="die-button-"]:not([data-render-mode="engine"])')).toHaveCount(0);
        await game.screenshot('03-give-hand-select-opponent-die', testInfo);

        await expect(defenderDieButton).toBeVisible({ timeout: 5000 });
        await defenderDieButton.click();
        await expect(defenderDieButton).toHaveAttribute('data-selected', 'true', { timeout: 5000 });
        await expect(boardStage.getByTestId('die-selected-operation-ring-0')).toBeVisible({ timeout: 5000 });
        await game.screenshot('04-give-hand-opponent-die-selected', testInfo);

        const confirmSelectionButton = page
            .locator('[data-player-seat-anchor="0"]')
            .getByRole('button', { name: /确认/ })
            .last();
        await expect(confirmSelectionButton).toBeEnabled({ timeout: 5000 });
        await confirmSelectionButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const rerollEvent = (state?.sys?.eventStream?.entries ?? [])
                .map((entry: any) => entry.event)
                .reverse()
                .find((event: any) => event?.type === 'DIE_REROLLED');
            const rerollPayload = rerollEvent?.payload;
            return {
                firstDie: state?.core?.dice?.[0]?.value ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                discardIds: (state?.core?.players?.['0']?.discard ?? []).map((card: any) => card.id),
                rerollEvent: rerollEvent ? {
                    type: rerollEvent.type,
                    dieId: rerollPayload?.dieId ?? null,
                    oldValue: rerollPayload?.oldValue ?? null,
                    newValueInRange: Number.isInteger(rerollPayload?.newValue)
                        && rerollPayload.newValue >= 1
                        && rerollPayload.newValue <= 6,
                    playerId: rerollPayload?.playerId ?? null,
                    ownerId: rerollPayload?.ownerId ?? null,
                    stateMatchesEvent: state?.core?.dice?.[0]?.value === rerollPayload?.newValue,
                } : null,
            };
        }, { timeout: 5000 }).toMatchObject({
            interactionKind: null,
            discardIds: ['card-give-hand'],
            rerollEvent: {
                type: 'DIE_REROLLED',
                dieId: 0,
                oldValue: 6,
                newValueInRange: true,
                playerId: '0',
                ownerId: '1',
                stateMatchesEvent: true,
            },
        });

        await game.screenshot('05-give-hand-rerolled-opponent-die', testInfo);
    });

    test('枪手 Duel 确认防御骰后，进攻方可用弹一手修改枪手防御骰', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);

        await page.addInitScript(() => {
            window.localStorage.setItem('dicethrone:boardDice3dEnabled', 'true');
        });
        await game.openTestGame('dicethrone', { playerID: '0' });

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-flick'],
                resources: { CP: 10, HP: 50 },
            },
            player1: {
                resources: { CP: 2, HP: 50 },
            },
            currentPlayer: '0',
            phase: 'defensiveRoll',
            sys: {
                interaction: {
                    current: null,
                    queue: [],
                },
                responseWindow: {
                    current: null,
                },
            },
            extra: {
                selectedCharacters: { '0': 'monk', '1': 'gunslinger' },
                hostStarted: true,
                activePlayerId: '1',
                rollCount: 0,
                rollLimit: 1,
                rollConfirmed: false,
                pendingDamage: null,
                dice: [
                    { id: 0, definitionId: 'gunslinger-dice', value: 1, isKept: false },
                ],
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                    isDefendable: true,
                    damage: 5,
                    bonusDamage: 0,
                    sourceAbilityId: 'harmony',
                    defenseAbilityId: 'duel',
                },
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
                rollConfirmed: state?.core?.rollConfirmed ?? null,
                handIds: (state?.core?.players?.['0']?.hand ?? []).map((card: any) => card.id),
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'defensiveRoll',
            activePlayerId: '1',
            defenderId: '1',
            defenseAbilityId: 'duel',
            rollCount: 0,
            rollConfirmed: false,
            handIds: ['card-flick'],
        });

        await game.screenshot('06-flick-duel-defense-before-roll', testInfo);

        await setDiceValues(page, [6, 2]);
        await dispatchCommand(page, 'ROLL_DICE', '1');
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                rollCount: state?.core?.rollCount ?? null,
                firstDie: state?.core?.dice?.[0]?.value ?? null,
                duelAttackerDieValue: state?.core?.pendingAttack?.duelAttackerDieValue ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            rollCount: 1,
            firstDie: 6,
            duelAttackerDieValue: 2,
        });

        const afterRollState = await game.getState();
        if (afterRollState?.core?.rollConfirmed !== true) {
            await dispatchCommand(page, 'CONFIRM_ROLL', '1');
        }
        await expect.poll(async () => {
            const state = await game.getState();
            const responseWindow = state?.sys?.responseWindow?.current;
            return {
                phase: state?.sys?.phase ?? null,
                rollConfirmed: state?.core?.rollConfirmed ?? null,
                firstDie: state?.core?.dice?.[0]?.value ?? null,
                windowType: responseWindow?.windowType ?? null,
                responderQueue: responseWindow?.responderQueue ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            phase: 'defensiveRoll',
            rollConfirmed: true,
            firstDie: 6,
            windowType: 'afterRollConfirmed',
            responderQueue: ['0'],
        });

        await game.screenshot('07-flick-duel-defense-confirmed-response-window', testInfo);

        const flickCard = page
            .locator('[data-card-id="card-flick"], [data-card-key^="card-flick-"]')
            .first();
        await expect(flickCard).toBeVisible({ timeout: 5000 });
        await dragHandCardToPlay(page, 'card-flick');

        await expect.poll(async () => {
            const state = await game.getState();
            const interaction = state?.sys?.interaction?.current;
            const meta = interaction?.data?.meta;
            return {
                interactionKind: interaction?.kind ?? null,
                interactionPlayerId: interaction?.playerId ?? null,
                dtType: meta?.dtType ?? null,
                targetOpponentDice: meta?.targetOpponentDice ?? null,
                diceOwnerId: meta?.diceOwnerId ?? null,
                mode: meta?.dieModifyConfig?.mode ?? null,
                allowedDieIds: interaction?.data?.allowedDieIds ?? null,
                pendingInteractionId: state?.sys?.responseWindow?.current?.pendingInteractionId ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            interactionKind: 'multistep-choice',
            interactionPlayerId: '0',
            dtType: 'modifyDie',
            targetOpponentDice: true,
            diceOwnerId: '1',
            mode: 'adjust',
            allowedDieIds: [0, 1],
        });

        const { defenderDieButton } = await expectBoardDiceStageOpponentSelection(page);
        await expect(page.locator('[data-tutorial-id="dice-tray"] [data-testid^="die-button-"]:not([data-render-mode="engine"])')).toHaveCount(0);
        await game.screenshot('08-flick-select-opponent-die', testInfo);

        const decrementButton = page.getByTestId('die-adjust-decrement-0');
        await expect(decrementButton).toBeEnabled({ timeout: 5000 });
        await expect(decrementButton.locator('xpath=ancestor::*[@data-board-dice-operation-anchor="true"][1]')).toHaveCount(1);
        await decrementButton.click();
        await expect(defenderDieButton).toHaveAttribute('data-display-value', '5', { timeout: 5000 });
        await expect(defenderDieButton).toHaveAttribute('data-selected', 'true', { timeout: 5000 });
        await expect(page.getByTestId('dicethrone-board-dice-stage').getByTestId('die-selected-operation-ring-0')).toBeVisible({ timeout: 5000 });
        await game.screenshot('09-flick-opponent-die-selected', testInfo);

        const confirmSelectionButton = page
            .locator('[data-player-seat-anchor="0"]')
            .getByRole('button', { name: /确认/ })
            .last();
        await expect(confirmSelectionButton).toBeEnabled({ timeout: 5000 });
        await confirmSelectionButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                firstDie: state?.core?.dice?.[0]?.value ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                discardIds: (state?.core?.players?.['0']?.discard ?? []).map((card: any) => card.id),
                lastEventTypes: (state?.sys?.eventStream?.entries ?? [])
                    .slice(-8)
                    .map((entry: any) => entry.event?.type),
            };
        }, { timeout: 5000 }).toMatchObject({
            firstDie: 5,
            interactionKind: null,
            discardIds: ['card-flick'],
        });

        await game.screenshot('10-flick-modified-opponent-die', testInfo);
    });
});
