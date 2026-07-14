import { test, expect } from '../framework';

const BOARD_DICE_3D_STORAGE_KEY = 'dicethrone:boardDice3dEnabled';

async function enableBoardDice3d(page: any): Promise<void> {
    await page.addInitScript((key: string) => {
        window.localStorage.setItem(key, 'true');
    }, BOARD_DICE_3D_STORAGE_KEY);
}

async function dragHandCardToPlay(page: any, cardId: string): Promise<void> {
    const handCard = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(handCard).toBeVisible({ timeout: 10000 });
    await expect(handCard).toHaveAttribute('data-is-flipped', 'true', { timeout: 15000 });
    await expect(handCard).toHaveAttribute('data-can-drag', 'true', { timeout: 15000 });
    await page.evaluate(() => {
        (window as any).__BG_LAST_COMMAND_REJECTED__ = null;
    });

    const dragStart = await page.evaluate((nextCardId: string) => {
        const node = document.querySelector(`[data-testid="hand-area"] [data-card-id="${nextCardId}"]`) as HTMLElement | null;
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        const xFractions = [0.5, 0.35, 0.65];
        const yFractions = [0.78, 0.62, 0.46, 0.3];

        for (const yFraction of yFractions) {
            for (const xFraction of xFractions) {
                const x = rect.x + (rect.width * xFraction);
                const y = rect.y + (rect.height * yFraction);
                const hit = document.elementFromPoint(x, y);
                if (hit && (hit === node || node.contains(hit))) {
                    return { x, y };
                }
            }
        }

        return {
            x: rect.x + (rect.width / 2),
            y: rect.y + (rect.height * 0.62),
        };
    }, cardId);
    if (!dragStart) {
        throw new Error(`未能获取手牌 ${cardId} 的拖拽区域`);
    }

    const endY = Math.max(24, dragStart.y - 260);

    await page.mouse.move(dragStart.x, dragStart.y);
    await page.mouse.down();
    await page.mouse.move(dragStart.x, endY, { steps: 16 });
    await page.mouse.up();
    await page.mouse.move(2, 2);
}

async function setupOffensiveRollScene(game: any, cardIds: string[], diceValues: number[] = [1, 2, 3, 4, 5]): Promise<void> {
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            hand: cardIds,
            resources: { CP: 10, HP: 50 },
        },
        player1: {
            resources: { CP: 2, HP: 50 },
        },
        currentPlayer: '0',
        phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'monk', '1': 'barbarian' },
            seatControllers: { '0': { type: 'human' }, '1': { type: 'human' } },
            hostStarted: true,
            rollCount: 1,
            rollLimit: 3,
            rollConfirmed: false,
            dice: diceValues.map((value, id) => ({ id, value, isKept: false })),
        },
    });
}

async function setupDefensiveRollSelfScene(game: any): Promise<void> {
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { CP: 2, HP: 50 },
        },
        player1: {
            hand: ['card-just-this'],
            resources: { CP: 10, HP: 50 },
        },
        currentPlayer: '0',
        phase: 'defensiveRoll',
        extra: {
            selectedCharacters: { '0': 'monk', '1': 'barbarian' },
            seatControllers: { '0': { type: 'human' }, '1': { type: 'human' } },
            hostStarted: true,
            activePlayerId: '0',
            rollCount: 1,
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
                sourceAbilityId: 'harmony',
                defenseAbilityId: 'counterattack',
            },
        },
    });
}

async function setupDuelDefenseOpponentDiceScene(game: any, cardId: string): Promise<void> {
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            hand: [cardId],
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
            seatControllers: { '0': { type: 'human' }, '1': { type: 'human' } },
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
}

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

async function expectInitialState(game: any, phase: string, cardId: string, playerId = '0'): Promise<void> {
    await expect.poll(async () => {
        const state = await game.getState();
        return {
            phase: state?.sys?.phase ?? null,
            hasCard: !!state?.core?.players?.[playerId]?.hand?.some((card: any) => card.id === cardId),
            diceCount: state?.core?.dice?.length ?? 0,
        };
    }, { timeout: 10000 }).toMatchObject({
        phase,
        hasCard: true,
    });
}

async function expectInteractionMeta(game: any, expected: Record<string, unknown>): Promise<void> {
    await expect.poll(async () => {
        const state = await game.getState();
        const interaction = state?.sys?.interaction?.current;
        const meta = interaction?.data?.meta;
        return {
            interactionKind: interaction?.kind ?? null,
            interactionPlayerId: interaction?.playerId ?? null,
            dtType: meta?.dtType ?? null,
            mode: meta?.dieModifyConfig?.mode ?? null,
            targetValue: meta?.dieModifyConfig?.targetValue ?? null,
            selectCount: meta?.selectCount ?? null,
            targetOpponentDice: meta?.targetOpponentDice ?? null,
            diceOwnerId: meta?.diceOwnerId ?? null,
            allowedDieIds: interaction?.data?.allowedDieIds ?? null,
        };
    }, { timeout: 5000 }).toMatchObject({
        interactionKind: 'multistep-choice',
        ...expected,
    });
}

async function expectBoardDie(page: any, dieId: number, options: { ownerId?: string; clickable?: boolean } = {}) {
    const boardStage = page.getByTestId('dicethrone-board-dice-stage');
    await expect(boardStage).toBeVisible({ timeout: 5000 });
    const dieButton = boardStage.locator(`[data-render-mode="engine"][data-testid="die-button-${dieId}"]`).first();
    await expect(dieButton).toBeVisible({ timeout: 5000 });
    await expect(dieButton).toHaveAttribute('data-board-dice-operation-anchor', 'true', { timeout: 5000 });
    await expect(dieButton).not.toHaveAttribute('data-projected-width', '');
    await expect(dieButton).not.toHaveAttribute('data-projected-height', '');
    if (options.ownerId !== undefined) {
        await expect(dieButton).toHaveAttribute('data-owner-id', options.ownerId, { timeout: 5000 });
    }
    if (options.clickable !== undefined) {
        await expect(dieButton).toHaveAttribute('data-clickable', options.clickable ? 'true' : 'false', { timeout: 5000 });
    }
    return { boardStage, dieButton };
}

async function expectNoLegacyDiceButtons(page: any): Promise<void> {
    await expect(page.locator('[data-tutorial-id="dice-tray"] [data-testid^="die-button-"]:not([data-render-mode="engine"])')).toHaveCount(0);
}

async function enterDefenseControlsIfShowcaseVisible(page: any): Promise<void> {
    const startDefenseButton = page.getByRole('button', { name: /开始防御|Start Defense/i }).first();
    if (await startDefenseButton.isVisible().catch(() => false)) {
        await startDefenseButton.click();
        await expect(startDefenseButton).toBeHidden({ timeout: 5000 });
    }
}

async function expectSelectedRing(page: any, dieId: number): Promise<void> {
    await expect(page.getByTestId('dicethrone-board-dice-stage').getByTestId(`die-selected-operation-ring-${dieId}`)).toBeVisible({ timeout: 5000 });
}

async function clickConfirmForPlayer(page: any, playerId = '0'): Promise<void> {
    const confirmSelectionButton = page
        .locator(`[data-player-seat-anchor="${playerId}"]`)
        .getByRole('button', { name: /确认|Confirm/i })
        .last();
    await expect(confirmSelectionButton).toBeEnabled({ timeout: 5000 });
    await confirmSelectionButton.click();
}

async function expectCardSettled(game: any, cardId: string, expectedDiceValues: number[], playerId = '0'): Promise<void> {
    await expect.poll(async () => {
        const state = await game.getState();
        return {
            diceValues: (state?.core?.dice ?? []).map((die: any) => die.value),
            interactionKind: state?.sys?.interaction?.current?.kind ?? null,
            handIds: (state?.core?.players?.[playerId]?.hand ?? []).map((card: any) => card.id),
            discardIds: (state?.core?.players?.[playerId]?.discard ?? []).map((card: any) => card.id),
        };
    }, { timeout: 5000 }).toMatchObject({
        diceValues: expectedDiceValues,
        interactionKind: null,
        handIds: [],
        discardIds: [cardId],
    });
}

async function countRecentEvents(game: any, eventType: string, take = 12): Promise<number> {
    const state = await game.getState();
    return (state?.sys?.eventStream?.entries ?? [])
        .slice(-take)
        .filter((entry: any) => entry.event?.type === eventType)
        .length;
}

test.describe('DiceThrone - 3D 骰台改骰交互全流程', () => {
    test('抬一手：防御响应窗口改对方骰子时走 3D 骰台重掷完整流程', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await enableBoardDice3d(page);
        await game.openTestGame('dicethrone', { playerID: '0' });
        await setupDuelDefenseOpponentDiceScene(game, 'card-give-hand');

        await game.screenshot('01-give-hand-before-defense-roll', testInfo);
        await setDiceValues(page, [6, 2]);
        await dispatchCommand(page, 'ROLL_DICE', '1');
        const afterRollState = await game.getState();
        if (afterRollState?.core?.rollConfirmed !== true) {
            await dispatchCommand(page, 'CONFIRM_ROLL', '1');
        }

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                rollConfirmed: state?.core?.rollConfirmed ?? null,
                windowType: state?.sys?.responseWindow?.current?.windowType ?? null,
                responderQueue: state?.sys?.responseWindow?.current?.responderQueue ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            phase: 'defensiveRoll',
            rollConfirmed: true,
            windowType: 'afterRollConfirmed',
            responderQueue: ['0'],
        });

        await game.screenshot('02-give-hand-response-window-ready', testInfo);
        await dragHandCardToPlay(page, 'card-give-hand');
        await expectInteractionMeta(game, {
            interactionPlayerId: '0',
            dtType: 'selectDie',
            targetOpponentDice: true,
            diceOwnerId: '1',
            allowedDieIds: [0, 1],
        });

        const { boardStage, dieButton } = await expectBoardDie(page, 0, { ownerId: '1', clickable: true });
        await expectBoardDie(page, 1, { ownerId: '0', clickable: false });
        await expectNoLegacyDiceButtons(page);
        await game.screenshot('03-give-hand-3d-select-opponent-die', testInfo);

        await dieButton.click();
        await expect(dieButton).toHaveAttribute('data-selected', 'true', { timeout: 5000 });
        await expect(boardStage.getByTestId('die-selected-operation-ring-0')).toBeVisible({ timeout: 5000 });
        await game.screenshot('04-give-hand-3d-opponent-die-selected', testInfo);

        await clickConfirmForPlayer(page, '0');
        await expect.poll(async () => {
            const state = await game.getState();
            const rerollEvent = (state?.sys?.eventStream?.entries ?? [])
                .map((entry: any) => entry.event)
                .reverse()
                .find((event: any) => event?.type === 'DIE_REROLLED');
            return {
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                discardIds: (state?.core?.players?.['0']?.discard ?? []).map((card: any) => card.id),
                rerollEvent: rerollEvent ? {
                    dieId: rerollEvent.payload?.dieId ?? null,
                    ownerId: rerollEvent.payload?.ownerId ?? null,
                    playerId: rerollEvent.payload?.playerId ?? null,
                    stateMatchesEvent: state?.core?.dice?.[0]?.value === rerollEvent.payload?.newValue,
                } : null,
            };
        }, { timeout: 5000 }).toMatchObject({
            interactionKind: null,
            discardIds: ['card-give-hand'],
            rerollEvent: {
                dieId: 0,
                ownerId: '1',
                playerId: '0',
                stateMatchesEvent: true,
            },
        });
        await game.screenshot('05-give-hand-3d-opponent-die-rerolled', testInfo);
    });

    test('弹一手：防御响应窗口改对方骰子时加减按钮挂在 3D 骰台锚点内', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await enableBoardDice3d(page);
        await game.openTestGame('dicethrone', { playerID: '0' });
        await setupDuelDefenseOpponentDiceScene(game, 'card-flick');

        await setDiceValues(page, [6, 2]);
        await dispatchCommand(page, 'ROLL_DICE', '1');
        const afterRollState = await game.getState();
        if (afterRollState?.core?.rollConfirmed !== true) {
            await dispatchCommand(page, 'CONFIRM_ROLL', '1');
        }

        await game.screenshot('06-flick-response-window-ready', testInfo);
        await dragHandCardToPlay(page, 'card-flick');
        await expectInteractionMeta(game, {
            interactionPlayerId: '0',
            dtType: 'modifyDie',
            mode: 'adjust',
            targetOpponentDice: true,
            diceOwnerId: '1',
            allowedDieIds: [0, 1],
        });

        const { dieButton } = await expectBoardDie(page, 0, { ownerId: '1', clickable: true });
        await expectBoardDie(page, 1, { ownerId: '0', clickable: false });
        await expectNoLegacyDiceButtons(page);
        await game.screenshot('07-flick-3d-select-opponent-die', testInfo);

        const decrementButton = page.getByTestId('die-adjust-decrement-0');
        await expect(decrementButton).toBeEnabled({ timeout: 5000 });
        await expect(decrementButton.locator('xpath=ancestor::*[@data-board-dice-operation-anchor="true"][1]')).toHaveCount(1);
        await decrementButton.click();
        await expect(dieButton).toHaveAttribute('data-display-value', '5', { timeout: 5000 });
        await expect(dieButton).toHaveAttribute('data-selected', 'true', { timeout: 5000 });
        await expectSelectedRing(page, 0);
        await game.screenshot('08-flick-3d-opponent-die-adjusted', testInfo);

        await clickConfirmForPlayer(page, '0');
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                diceValues: (state?.core?.dice ?? []).map((die: any) => die.value),
                duelAttackerDieValue: state?.core?.pendingAttack?.duelAttackerDieValue ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                discardIds: (state?.core?.players?.['0']?.discard ?? []).map((card: any) => card.id),
            };
        }, { timeout: 5000 }).toMatchObject({
            diceValues: [5],
            duelAttackerDieValue: 2,
            interactionKind: null,
            discardIds: ['card-flick'],
        });
        await game.screenshot('09-flick-3d-opponent-die-settled', testInfo);
    });

    test('我又行了：自己骰子至多 5 颗重掷可少选并用 3D 骰台确认', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await enableBoardDice3d(page);
        await game.openTestGame('dicethrone', { playerID: '0' });
        await setupOffensiveRollScene(game, ['card-i-can-again']);
        await expectInitialState(game, 'offensiveRoll', 'card-i-can-again');

        await dragHandCardToPlay(page, 'card-i-can-again');
        await expectInteractionMeta(game, {
            interactionPlayerId: '0',
            dtType: 'selectDie',
            selectCount: 5,
            targetOpponentDice: false,
            diceOwnerId: '0',
        });
        const { dieButton } = await expectBoardDie(page, 0, { clickable: true });
        await expectNoLegacyDiceButtons(page);
        await game.screenshot('10-i-can-again-3d-select-dice', testInfo);

        await dieButton.click();
        await expect(dieButton).toHaveAttribute('data-selected', 'true', { timeout: 5000 });
        await expectSelectedRing(page, 0);
        await setDiceValues(page, [6]);
        await game.screenshot('11-i-can-again-3d-one-die-selected-before-confirm', testInfo);

        await clickConfirmForPlayer(page, '0');
        await expectCardSettled(game, 'card-i-can-again', [6, 2, 3, 4, 5]);
        expect(await countRecentEvents(game, 'DIE_REROLLED')).toBeGreaterThanOrEqual(1);
        await game.screenshot('12-i-can-again-3d-settled', testInfo);
    });

    test('不愧是我：自己骰子至多 2 颗重掷可选两颗并用 3D 骰台确认', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await enableBoardDice3d(page);
        await game.openTestGame('dicethrone', { playerID: '0' });
        await setupOffensiveRollScene(game, ['card-worthy-of-me']);
        await expectInitialState(game, 'offensiveRoll', 'card-worthy-of-me');

        await dragHandCardToPlay(page, 'card-worthy-of-me');
        await expectInteractionMeta(game, {
            interactionPlayerId: '0',
            dtType: 'selectDie',
            selectCount: 2,
            targetOpponentDice: false,
            diceOwnerId: '0',
        });

        const first = await expectBoardDie(page, 0, { clickable: true });
        const second = await expectBoardDie(page, 1, { clickable: true });
        await expectNoLegacyDiceButtons(page);
        await game.screenshot('13-worthy-of-me-3d-select-dice', testInfo);

        await first.dieButton.click();
        await second.dieButton.click();
        await expectSelectedRing(page, 0);
        await expectSelectedRing(page, 1);
        await setDiceValues(page, [6, 6]);
        await game.screenshot('14-worthy-of-me-3d-two-dice-selected', testInfo);

        await clickConfirmForPlayer(page, '0');
        await expect.poll(async () => {
            const state = await game.getState();
            const diceValues = (state?.core?.dice ?? []).map((die: any) => die.value);
            return {
                firstTwoDiceInRange: diceValues.slice(0, 2).every((value: number) => Number.isInteger(value) && value >= 1 && value <= 6),
                untouchedDice: diceValues.slice(2),
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                handIds: (state?.core?.players?.['0']?.hand ?? []).map((card: any) => card.id),
                discardIds: (state?.core?.players?.['0']?.discard ?? []).map((card: any) => card.id),
            };
        }, { timeout: 5000 }).toMatchObject({
            firstTwoDiceInRange: true,
            untouchedDice: [3, 4, 5],
            interactionKind: null,
            handIds: [],
            discardIds: ['card-worthy-of-me'],
        });
        expect(await countRecentEvents(game, 'DIE_REROLLED')).toBeGreaterThanOrEqual(2);
        await game.screenshot('15-worthy-of-me-3d-settled', testInfo);
    });

    test('就这：防御者自己的防御骰至多 5 颗重掷也走 3D 骰台完整流程', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await enableBoardDice3d(page);
        await game.openTestGame('dicethrone', { playerID: '1' });
        await setupDefensiveRollSelfScene(game);
        await expectInitialState(game, 'defensiveRoll', 'card-just-this', '1');

        await enterDefenseControlsIfShowcaseVisible(page);
        await dragHandCardToPlay(page, 'card-just-this');
        await expectInteractionMeta(game, {
            interactionPlayerId: '1',
            dtType: 'selectDie',
            selectCount: 5,
            targetOpponentDice: false,
            diceOwnerId: '1',
        });

        const { dieButton } = await expectBoardDie(page, 0, { clickable: true });
        await expectNoLegacyDiceButtons(page);
        await game.screenshot('16-just-this-defense-3d-select-dice', testInfo);

        await dieButton.click();
        await expectSelectedRing(page, 0);
        await setDiceValues(page, [6]);
        await game.screenshot('17-just-this-defense-3d-selected-before-confirm', testInfo);

        await clickConfirmForPlayer(page, '1');
        await expectCardSettled(game, 'card-just-this', [6, 2, 3, 4, 5], '1');
        expect(await countRecentEvents(game, 'DIE_REROLLED')).toBeGreaterThanOrEqual(1);
        await game.screenshot('18-just-this-defense-3d-settled', testInfo);
    });

    test('改 6：自己骰子设为 6 时直接点击 3D 骰台结算', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await enableBoardDice3d(page);
        await game.openTestGame('dicethrone', { playerID: '0' });
        await setupOffensiveRollScene(game, ['card-play-six'], [2, 3, 4, 5, 1]);
        await expectInitialState(game, 'offensiveRoll', 'card-play-six');

        await dragHandCardToPlay(page, 'card-play-six');
        await expectInteractionMeta(game, {
            interactionPlayerId: '0',
            dtType: 'modifyDie',
            mode: 'set',
            targetValue: 6,
            targetOpponentDice: false,
            diceOwnerId: '0',
        });

        const { dieButton } = await expectBoardDie(page, 0, { clickable: true });
        await expectNoLegacyDiceButtons(page);
        await game.screenshot('19-play-six-3d-select-die', testInfo);
        await dieButton.click();

        await expectCardSettled(game, 'card-play-six', [6, 3, 4, 5, 1]);
        expect(await countRecentEvents(game, 'DIE_MODIFIED')).toBeGreaterThanOrEqual(1);
        await game.screenshot('20-play-six-3d-settled', testInfo);
    });

    test('惊不惊喜：任意改 1 颗时加减按钮在 3D 骰台锚点内并可确认结算', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await enableBoardDice3d(page);
        await game.openTestGame('dicethrone', { playerID: '0' });
        await setupOffensiveRollScene(game, ['card-surprise']);
        await expectInitialState(game, 'offensiveRoll', 'card-surprise');

        await dragHandCardToPlay(page, 'card-surprise');
        await expectInteractionMeta(game, {
            interactionPlayerId: '0',
            dtType: 'modifyDie',
            mode: 'any',
            selectCount: 1,
            targetOpponentDice: false,
            diceOwnerId: '0',
        });

        const { dieButton } = await expectBoardDie(page, 0, { clickable: true });
        const incrementButton = page.getByTestId('die-adjust-increment-0');
        await expect(incrementButton).toBeEnabled({ timeout: 5000 });
        await expect(incrementButton.locator('xpath=ancestor::*[@data-board-dice-operation-anchor="true"][1]')).toHaveCount(1);
        await expectNoLegacyDiceButtons(page);
        await game.screenshot('21-surprise-3d-select-die', testInfo);

        await incrementButton.click();
        await expect(dieButton).toHaveAttribute('data-display-value', '2', { timeout: 5000 });
        await expect(dieButton).toHaveAttribute('data-selected', 'true', { timeout: 5000 });
        await expectSelectedRing(page, 0);
        await game.screenshot('22-surprise-3d-die-modified-before-confirm', testInfo);

        await clickConfirmForPlayer(page, '0');
        await expectCardSettled(game, 'card-surprise', [2, 2, 3, 4, 5]);
        expect(await countRecentEvents(game, 'DIE_MODIFIED')).toBeGreaterThanOrEqual(1);
        await game.screenshot('23-surprise-3d-settled', testInfo);
    });

    test('意不意外：一次流程能修改两颗不同 3D 骰子，不能用重复同骰冒充', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await enableBoardDice3d(page);
        await game.openTestGame('dicethrone', { playerID: '0' });
        await setupOffensiveRollScene(game, ['card-unexpected'], [6, 6, 6, 4, 4]);
        await expectInitialState(game, 'offensiveRoll', 'card-unexpected');

        await dragHandCardToPlay(page, 'card-unexpected');
        await expectInteractionMeta(game, {
            interactionPlayerId: '0',
            dtType: 'modifyDie',
            mode: 'any',
            selectCount: 2,
            targetOpponentDice: false,
            diceOwnerId: '0',
        });

        const fourth = await expectBoardDie(page, 3, { clickable: true });
        const fifth = await expectBoardDie(page, 4, { clickable: true });
        await expectNoLegacyDiceButtons(page);
        await game.screenshot('24-unexpected-3d-select-two-dice', testInfo);

        const fourthIncrement = page.getByTestId('die-adjust-increment-3');
        await expect(fourthIncrement.locator('xpath=ancestor::*[@data-board-dice-operation-anchor="true"][1]')).toHaveCount(1);
        await fourthIncrement.click();
        await fourthIncrement.click();
        await expect(fourth.dieButton).toHaveAttribute('data-display-value', '6', { timeout: 5000 });
        await expectSelectedRing(page, 3);
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                diceValues: (state?.core?.dice ?? []).map((die: any) => die.value),
                modifiedEvents: (state?.sys?.eventStream?.entries ?? [])
                    .slice(-8)
                    .filter((entry: any) => entry.event?.type === 'DIE_MODIFIED')
                    .length,
            };
        }, { timeout: 5000 }).toMatchObject({
            interactionKind: 'multistep-choice',
            diceValues: [6, 6, 6, 4, 4],
            modifiedEvents: 0,
        });

        const fifthIncrement = page.getByTestId('die-adjust-increment-4');
        await expect(fifthIncrement.locator('xpath=ancestor::*[@data-board-dice-operation-anchor="true"][1]')).toHaveCount(1);
        await fifthIncrement.click();
        await fifthIncrement.click();
        await expect(fifth.dieButton).toHaveAttribute('data-display-value', '6', { timeout: 5000 });
        await expectSelectedRing(page, 4);
        await game.screenshot('25-unexpected-3d-two-different-dice-modified', testInfo);

        await clickConfirmForPlayer(page, '0');
        await expectCardSettled(game, 'card-unexpected', [6, 6, 6, 6, 6]);
        expect(await countRecentEvents(game, 'DIE_MODIFIED')).toBeGreaterThanOrEqual(2);
        await game.screenshot('26-unexpected-3d-settled-five-sixes', testInfo);
    });

    test('俺也一样：复制骰面分源骰和目标骰两步，重复点源骰不会提前完成', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await enableBoardDice3d(page);
        await game.openTestGame('dicethrone', { playerID: '0' });
        await setupOffensiveRollScene(game, ['card-me-too'], [6, 5, 4, 2, 3]);
        await expectInitialState(game, 'offensiveRoll', 'card-me-too');

        await dragHandCardToPlay(page, 'card-me-too');
        await expectInteractionMeta(game, {
            interactionPlayerId: '0',
            dtType: 'modifyDie',
            mode: 'copy',
            selectCount: 2,
            targetOpponentDice: false,
            diceOwnerId: '0',
        });

        const source = await expectBoardDie(page, 0, { clickable: true });
        const target = await expectBoardDie(page, 3, { clickable: true });
        await expectNoLegacyDiceButtons(page);
        await game.screenshot('27-me-too-3d-copy-source-ready', testInfo);

        await source.dieButton.click();
        await source.dieButton.click();
        await expect(source.dieButton).toHaveAttribute('data-selected', 'true', { timeout: 5000 });
        await expectSelectedRing(page, 0);
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                diceValues: (state?.core?.dice ?? []).map((die: any) => die.value),
                modifiedEvents: (state?.sys?.eventStream?.entries ?? [])
                    .slice(-8)
                    .filter((entry: any) => entry.event?.type === 'DIE_MODIFIED')
                    .length,
            };
        }, { timeout: 5000 }).toMatchObject({
            interactionKind: 'multistep-choice',
            diceValues: [6, 5, 4, 2, 3],
            modifiedEvents: 0,
        });
        await game.screenshot('28-me-too-3d-duplicate-source-still-waiting', testInfo);

        await target.dieButton.click();
        await expectCardSettled(game, 'card-me-too', [6, 5, 4, 6, 3]);
        expect(await countRecentEvents(game, 'DIE_MODIFIED')).toBeGreaterThanOrEqual(1);
        await game.screenshot('29-me-too-3d-copy-settled', testInfo);
    });
});
