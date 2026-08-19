import { test, expect } from '../framework';
import {
    expectRightTrayBonusDiceConfirmation,
    expectRightTrayBonusDiceReadOnlyReview,
    getRightTrayDiceTray,
    getRightTrayDie,
    settleCurrentBonusDice,
    waitForDiceThroneVisualIdle,
} from './bonus-dice-flow';

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

function getCp(player: any): number | null {
    return player?.resources?.CP ?? player?.resources?.cp ?? null;
}

async function closeBoardMagnifyIfVisible(page: any): Promise<void> {
    await page.mouse.move(8, 8);
    const overlay = page.getByTestId('board-magnify-overlay');
    if (!await overlay.first().isVisible({ timeout: 500 }).catch(() => false)) {
        await expect(overlay).toHaveCount(0);
        return;
    }

    const closeButton = page.getByTestId('board-magnify-overlay-close');
    if (await closeButton.first().isVisible({ timeout: 500 }).catch(() => false)) {
        await closeButton.first().click();
    } else {
        await overlay.first().click({ position: { x: 12, y: 12 } });
    }
    await expect(overlay).toHaveCount(0, { timeout: 3000 });
}

test.describe('DiceThrone - 选择骰子重投', () => {
    test('card-i-can-again 分批重掷时确认本批次不关闭整段交互', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-i-can-again'],
                resources: { CP: 2, HP: 50 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'monk', '1': 'barbarian' },
                hostStarted: true,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: false,
                dice: [
                    { id: 0, value: 1, isKept: false },
                    { id: 1, value: 2, isKept: false },
                    { id: 2, value: 3, isKept: false },
                    { id: 3, value: 4, isKept: false },
                    { id: 4, value: 5, isKept: false },
                ],
            },
        });

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                hasCard: !!state?.core?.players?.['0']?.hand?.some((card: any) => card.id === 'card-i-can-again'),
                diceCount: state?.core?.dice?.length ?? 0,
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'offensiveRoll',
            hasCard: true,
            diceCount: 5,
        });

        await dragHandCardToPlay(page, 'card-i-can-again');

        await expect.poll(async () => {
            const interaction = (await game.getState())?.sys?.interaction?.current;
            const meta = interaction?.data?.meta;
            return {
                dtType: meta?.dtType ?? null,
                selectCount: meta?.selectCount ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            dtType: 'selectDie',
            selectCount: 5,
        });

        await game.screenshot('i-can-again-select-dice-overlay', testInfo);

        const diceTray = getRightTrayDiceTray(page);
        const firstDieButton = diceTray.getByTestId('die-button-0').first();
        const secondDieButton = diceTray.getByTestId('die-button-1').first();
        const thirdDieButton = diceTray.getByTestId('die-button-2').first();
        const fourthDieButton = diceTray.getByTestId('die-button-3').first();
        const confirmButton = page.getByTestId('dice-interaction-confirm-button');

        await expect(firstDieButton).toBeVisible({ timeout: 5000 });
        await expect(secondDieButton).toBeVisible({ timeout: 5000 });
        await firstDieButton.click();
        await secondDieButton.click();
        await expect(firstDieButton).toHaveAttribute('data-selected', 'true', { timeout: 5000 });
        await expect(secondDieButton).toHaveAttribute('data-selected', 'true', { timeout: 5000 });

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                dtType: state?.sys?.interaction?.current?.data?.meta?.dtType ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            interactionKind: 'multistep-choice',
            dtType: 'selectDie',
        });

        await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice));
        await page.evaluate(() => {
            window.__BG_TEST_HARNESS__?.dice.setValues([6, 6, 5, 5]);
        });

        await game.screenshot('i-can-again-first-two-dice-selected-before-confirm', testInfo);

        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await confirmButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                diceValues: (state?.core?.dice ?? []).map((die: any) => die.value),
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                completedSteps: state?.sys?.interaction?.current?.data?.completedSteps ?? null,
                completedDieIds: state?.sys?.interaction?.current?.data?.completedDieIds ?? [],
            };
        }, { timeout: 5000 }).toMatchObject({
            diceValues: [6, 6, 3, 4, 5],
            interactionKind: 'multistep-choice',
            completedSteps: 2,
            completedDieIds: [0, 1],
        });

        await expect(page.getByText(/选择骰子\s*[（(]2\/5[）)]/)).toBeVisible({ timeout: 5000 });
        await expect(thirdDieButton).toHaveAttribute('data-clickable', 'true', { timeout: 5000 });
        await game.screenshot('i-can-again-after-first-confirm-shows-2-of-5', testInfo);

        await thirdDieButton.click();
        await fourthDieButton.click();
        await expect(thirdDieButton).toHaveAttribute('data-selected', 'true', { timeout: 5000 });
        await expect(fourthDieButton).toHaveAttribute('data-selected', 'true', { timeout: 5000 });
        await game.screenshot('i-can-again-second-two-dice-selected-before-confirm', testInfo);

        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await confirmButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                diceValues: (state?.core?.dice ?? []).map((die: any) => die.value),
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                completedSteps: state?.sys?.interaction?.current?.data?.completedSteps ?? null,
                completedDieIds: state?.sys?.interaction?.current?.data?.completedDieIds ?? [],
            };
        }, { timeout: 5000 }).toMatchObject({
            diceValues: [6, 6, 5, 5, 5],
            interactionKind: 'multistep-choice',
            completedSteps: 4,
            completedDieIds: [0, 1, 2, 3],
        });

        await expect(page.getByText(/选择骰子\s*[（(]4\/5[）)]/)).toBeVisible({ timeout: 5000 });
        await game.screenshot('i-can-again-after-second-confirm-shows-4-of-5', testInfo);

        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await confirmButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                handIds: (state?.core?.players?.['0']?.hand ?? []).map((card: any) => card.id),
                discardIds: (state?.core?.players?.['0']?.discard ?? []).map((card: any) => card.id),
            };
        }, { timeout: 5000 }).toMatchObject({
            interactionKind: null,
            handIds: [],
            discardIds: ['card-i-can-again'],
        });

        await expect(page.getByTestId('hand-flying-card')).toHaveCount(0, { timeout: 5000 });
        await expect(page.locator('[data-testid="hand-area"] [data-card-id="card-i-can-again"]')).toHaveCount(0);
        await game.screenshot('i-can-again-empty-confirm-settles-card', testInfo);

        const finalState = await game.getState();
        const finalHandIds = (finalState?.core?.players?.['0']?.hand ?? []).map((card: any) => card.id);
        const finalEventTypes = (finalState?.sys?.eventStream?.entries ?? [])
            .slice(-8)
            .map((entry: any) => entry.event?.type);

        expect(finalState?.core?.dice?.map((die: any) => die.value)).toEqual([6, 6, 5, 5, 5]);
        expect(finalHandIds).not.toContain('card-i-can-again');
        expect(finalEventTypes).toContain('CARD_PLAYED');
        expect(finalEventTypes.filter((type: string) => type === 'DIE_REROLLED')).toHaveLength(4);
    });

    test('card-just-this 防御阶段可通过真实骰子入口重掷已锁定防御骰', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone', {
            playerID: '1',
            seat1: 'human',
            disableLocalAiAutomation: true,
        });

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { HP: 50 },
            },
            player1: {
                hand: ['card-just-this'],
                resources: { CP: 2, HP: 50 },
            },
            currentPlayer: '0',
            phase: 'defensiveRoll',
            extra: {
                selectedCharacters: { '0': 'monk', '1': 'barbarian' },
                hostStarted: true,
                activePlayerId: '0',
                rollCount: 1,
                rollLimit: 1,
                rollDiceCount: 3,
                rollConfirmed: false,
                dice: [
                    { id: 0, value: 2, isKept: true, ownerId: '1', definitionId: 'barbarian-dice' },
                    { id: 1, value: 3, isKept: true, ownerId: '1', definitionId: 'barbarian-dice' },
                    { id: 2, value: 4, isKept: true, ownerId: '1', definitionId: 'barbarian-dice' },
                    { id: 3, value: 1, isKept: true, ownerId: '1', definitionId: 'barbarian-dice' },
                    { id: 4, value: 1, isKept: true, ownerId: '1', definitionId: 'barbarian-dice' },
                ],
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: 'fist-technique-3',
                    defenseAbilityId: 'fortitude',
                    isDefendable: true,
                    damage: 5,
                    bonusDamage: 0,
                    attackModifierBonusDamage: 0,
                    damageResolved: false,
                    resolvedDamage: 0,
                    preDefenseResolved: true,
                    offensiveRollEndTokenResolved: true,
                    settlementStage: 'preDamage',
                },
            },
        });

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                defenderId: state?.core?.pendingAttack?.defenderId ?? null,
                hasCard: !!state?.core?.players?.['1']?.hand?.some((card: any) => card.id === 'card-just-this'),
                dice: (state?.core?.dice ?? []).slice(0, 3).map((die: any) => ({
                    value: die.value,
                    kept: die.isKept,
                    ownerId: die.ownerId,
                })),
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'defensiveRoll',
            defenderId: '1',
            hasCard: true,
            dice: [
                { value: 2, kept: true, ownerId: '1' },
                { value: 3, kept: true, ownerId: '1' },
                { value: 4, kept: true, ownerId: '1' },
            ],
        });

        const startDefenseButton = page.getByRole('button', { name: /^开始防御$/ }).first();
        await expect(startDefenseButton).toBeVisible({ timeout: 5000 });
        await startDefenseButton.click();
        await expect(startDefenseButton).toBeHidden({ timeout: 5000 });
        await waitForDiceThroneVisualIdle(page);

        await dragHandCardToPlay(page, 'card-just-this');

        await expect.poll(async () => {
            const interaction = (await game.getState())?.sys?.interaction?.current;
            const meta = interaction?.data?.meta;
            return {
                kind: interaction?.kind ?? null,
                playerId: interaction?.playerId ?? null,
                dtType: meta?.dtType ?? null,
                selectCount: meta?.selectCount ?? null,
                diceOwnerId: meta?.diceOwnerId ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            kind: 'multistep-choice',
            playerId: '1',
            dtType: 'selectDie',
            selectCount: 5,
            diceOwnerId: '1',
        });

        const diceTray = getRightTrayDiceTray(page);
        const firstDieButton = diceTray.getByTestId('die-button-0').first();
        await expect(firstDieButton).toHaveAttribute('data-display-value', '2', { timeout: 5000 });
        await expect(firstDieButton).toHaveAttribute('data-clickable', 'true', { timeout: 5000 });
        await game.screenshot('just-this-locked-defense-dice-select-overlay', testInfo);

        await firstDieButton.click();
        await expect(firstDieButton).toHaveAttribute('data-selected', 'true', { timeout: 5000 });

        await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice));
        await page.evaluate(() => {
            window.__BG_TEST_HARNESS__?.dice.setValues([6]);
        });

        await game.screenshot('just-this-locked-defense-die-selected-before-confirm', testInfo);

        const confirmButton = page.getByRole('button', { name: /^(确认|Confirm)(?:\s*\(\d+\))?$/i }).first();
        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await confirmButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const lastEvents = (state?.sys?.eventStream?.entries ?? []).slice(-8);
            return {
                firstDie: {
                    value: state?.core?.dice?.[0]?.value ?? null,
                    kept: state?.core?.dice?.[0]?.isKept ?? null,
                },
                otherDice: (state?.core?.dice ?? []).slice(1, 3).map((die: any) => die.value),
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                completedSteps: state?.sys?.interaction?.current?.data?.completedSteps ?? null,
                handIds: (state?.core?.players?.['1']?.hand ?? []).map((card: any) => card.id),
                lastEventTypes: lastEvents.map((entry: any) => entry.event?.type),
            };
        }, { timeout: 5000 }).toMatchObject({
            firstDie: { value: 6, kept: true },
            otherDice: [3, 4],
            interactionKind: 'multistep-choice',
            completedSteps: 1,
            handIds: [],
            lastEventTypes: expect.arrayContaining(['CARD_PLAYED', 'DIE_REROLLED']),
        });

        await expect(page.getByText(/选择骰子\s*[（(]1\/5[）)]/)).toBeVisible({ timeout: 5000 });
        await game.screenshot('just-this-locked-defense-die-rerolled-shows-1-of-5', testInfo);

        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await confirmButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                handIds: (state?.core?.players?.['1']?.hand ?? []).map((card: any) => card.id),
                discardIds: (state?.core?.players?.['1']?.discard ?? []).map((card: any) => card.id),
            };
        }, { timeout: 5000 }).toMatchObject({
            interactionKind: null,
            handIds: [],
            discardIds: ['card-just-this'],
        });

        await game.screenshot('just-this-locked-defense-empty-confirm-settles-card', testInfo);
    });

    test('card-worthy-of-me 可重掷两颗不同骰并确认', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-worthy-of-me'],
                resources: { CP: 2, HP: 50 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'monk', '1': 'barbarian' },
                hostStarted: true,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: false,
                dice: [
                    { id: 0, value: 1, isKept: false },
                    { id: 1, value: 2, isKept: false },
                    { id: 2, value: 3, isKept: false },
                    { id: 3, value: 4, isKept: false },
                    { id: 4, value: 5, isKept: false },
                ],
            },
        });

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                hasCard: !!state?.core?.players?.['0']?.hand?.some((card: any) => card.id === 'card-worthy-of-me'),
                diceCount: state?.core?.dice?.length ?? 0,
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'offensiveRoll',
            hasCard: true,
            diceCount: 5,
        });

        await dragHandCardToPlay(page, 'card-worthy-of-me');

        await expect.poll(async () => {
            const interaction = (await game.getState())?.sys?.interaction?.current;
            const meta = interaction?.data?.meta;
            return {
                dtType: meta?.dtType ?? null,
                selectCount: meta?.selectCount ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            dtType: 'selectDie',
            selectCount: 2,
        });

        await game.screenshot('worthy-of-me-select-dice-overlay', testInfo);

        const firstDieButton = page.locator('[data-testid="die-button-0"]');
        const secondDieButton = page.locator('[data-testid="die-button-1"]');
        await expect(firstDieButton).toBeVisible({ timeout: 5000 });
        await firstDieButton.click();
        await expect(secondDieButton).toBeVisible({ timeout: 5000 });
        await secondDieButton.click();
        await expect(firstDieButton).toHaveAttribute('data-selected', 'true', { timeout: 5000 });
        await expect(secondDieButton).toHaveAttribute('data-selected', 'true', { timeout: 5000 });

        await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice));
        await page.evaluate(() => {
            window.__BG_TEST_HARNESS__?.dice.setValues([6, 6]);
        });

        await game.screenshot('worthy-of-me-two-dice-selected-before-confirm', testInfo);

        const confirmButton = page.getByRole('button', { name: /^(确认|Confirm)(?:\s*\(\d+\))?$/i }).first();
        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await confirmButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const lastEvents = (state?.sys?.eventStream?.entries ?? []).slice(-6);
            return {
                diceValues: (state?.core?.dice ?? []).slice(0, 3).map((die: any) => die.value),
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                handIds: (state?.core?.players?.['0']?.hand ?? []).map((card: any) => card.id),
                lastEventTypes: lastEvents.map((entry: any) => entry.event?.type),
            };
        }, { timeout: 5000 }).toMatchObject({
            diceValues: [6, 6, 3],
            interactionKind: null,
            handIds: [],
        });

        await expect(page.getByText(/选择骰子\s*\(0\/2\)/)).toHaveCount(0);
        await game.screenshot('worthy-of-me-two-dice-settled', testInfo);

        const finalState = await game.getState();
        const finalHandIds = (finalState?.core?.players?.['0']?.hand ?? []).map((card: any) => card.id);
        const finalEventTypes = (finalState?.sys?.eventStream?.entries ?? [])
            .slice(-8)
            .map((entry: any) => entry.event?.type);

        expect(finalState?.core?.dice?.slice(0, 3).map((die: any) => die.value)).toEqual([6, 6, 3]);
        expect(finalHandIds).not.toContain('card-worthy-of-me');
        expect(finalEventTypes).toContain('CARD_PLAYED');
        expect(finalEventTypes.filter(type => type === 'DIE_REROLLED')).toHaveLength(2);
    });

    test('card-worthy-of-me 可通过真实骰子入口重掷同一颗骰子两次', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-worthy-of-me'],
                resources: { CP: 2, HP: 50 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'monk', '1': 'barbarian' },
                hostStarted: true,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: false,
                dice: [
                    { id: 0, value: 1, isKept: false },
                    { id: 1, value: 2, isKept: false },
                    { id: 2, value: 3, isKept: false },
                    { id: 3, value: 4, isKept: false },
                    { id: 4, value: 5, isKept: false },
                ],
            },
        });

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                hasCard: !!state?.core?.players?.['0']?.hand?.some((card: any) => card.id === 'card-worthy-of-me'),
                diceValues: (state?.core?.dice ?? []).map((die: any) => die.value),
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'offensiveRoll',
            hasCard: true,
            diceValues: [1, 2, 3, 4, 5],
        });

        await dragHandCardToPlay(page, 'card-worthy-of-me');
        await closeBoardMagnifyIfVisible(page);

        await expect.poll(async () => {
            const interaction = (await game.getState())?.sys?.interaction?.current;
            const meta = interaction?.data?.meta;
            return {
                dtType: meta?.dtType ?? null,
                selectCount: meta?.selectCount ?? null,
                allowRepeatedDieSelection: meta?.allowRepeatedDieSelection ?? false,
            };
        }, { timeout: 5000 }).toMatchObject({
            dtType: 'selectDie',
            selectCount: 2,
            allowRepeatedDieSelection: true,
        });

        const firstDieButton = page.locator('[data-testid="die-button-0"]');
        await expect(firstDieButton).toBeVisible({ timeout: 5000 });
        await firstDieButton.click();
        await firstDieButton.click();
        await expect(firstDieButton).toHaveAttribute('data-selected', 'true', { timeout: 5000 });
        await expect(page.getByText(/^完成$/)).toBeVisible({ timeout: 5000 });
        await expect(page.getByText(/选择骰子\s*[（(]0\/2[）)]/)).toHaveCount(0);
        await game.screenshot('worthy-of-me-same-die-selected-twice-before-confirm', testInfo);

        await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice));
        await page.evaluate(() => {
            window.__BG_TEST_HARNESS__?.dice.setValues([6, 5]);
        });

        const confirmButton = page.getByRole('button', { name: /^(确认|Confirm)(?:\s*\(\d+\))?$/i }).first();
        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await confirmButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const lastEvents = (state?.sys?.eventStream?.entries ?? []).slice(-8);
            return {
                diceValues: (state?.core?.dice ?? []).slice(0, 3).map((die: any) => die.value),
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                handIds: (state?.core?.players?.['0']?.hand ?? []).map((card: any) => card.id),
                rerollEvents: lastEvents
                    .filter((entry: any) => entry.event?.type === 'DIE_REROLLED')
                    .map((entry: any) => ({
                        dieId: entry.event?.payload?.dieId,
                        newValue: entry.event?.payload?.newValue,
                    })),
            };
        }, { timeout: 5000 }).toMatchObject({
            diceValues: [5, 2, 3],
            interactionKind: null,
            handIds: [],
            rerollEvents: [
                { dieId: 0, newValue: 6 },
                { dieId: 0, newValue: 5 },
            ],
        });

        await expect(page.getByText(/选择骰子\s*\(0\/2\)/)).toHaveCount(0);
        await game.screenshot('worthy-of-me-same-die-rerolled-twice-settled', testInfo);
    });

    test('card-worthy-of-me 提交一次重掷后取消不返还 CP 和卡牌', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-worthy-of-me'],
                resources: { CP: 2, HP: 50 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'monk', '1': 'barbarian' },
                hostStarted: true,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: false,
                dice: [
                    { id: 0, value: 1, isKept: false },
                    { id: 1, value: 2, isKept: false },
                    { id: 2, value: 3, isKept: false },
                    { id: 3, value: 4, isKept: false },
                    { id: 4, value: 5, isKept: false },
                ],
            },
        });

        await dragHandCardToPlay(page, 'card-worthy-of-me');

        await expect.poll(async () => {
            const state = await game.getState();
            const player = state?.core?.players?.['0'];
            return {
                cp: getCp(player),
                handIds: (player?.hand ?? []).map((card: any) => card.id),
                discardIds: (player?.discard ?? []).map((card: any) => card.id),
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            cp: 1,
            handIds: [],
            discardIds: ['card-worthy-of-me'],
            interactionKind: 'multistep-choice',
        });

        const diceTray = getRightTrayDiceTray(page);
        const firstDieButton = diceTray.getByTestId('die-button-0').first();
        await expect(firstDieButton).toBeVisible({ timeout: 5000 });
        await firstDieButton.click();
        await expect(firstDieButton).toHaveAttribute('data-selected', 'true', { timeout: 5000 });

        await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice));
        await page.evaluate(() => {
            window.__BG_TEST_HARNESS__?.dice.setValues([6]);
        });

        const confirmButton = page.getByRole('button', { name: /^(确认|Confirm)(?:\s*\(\d+\))?$/i }).first();
        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await confirmButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const player = state?.core?.players?.['0'];
            return {
                cp: getCp(player),
                diceValues: (state?.core?.dice ?? []).slice(0, 3).map((die: any) => die.value),
                completedSteps: state?.sys?.interaction?.current?.data?.completedSteps ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                handIds: (player?.hand ?? []).map((card: any) => card.id),
                discardIds: (player?.discard ?? []).map((card: any) => card.id),
            };
        }, { timeout: 5000 }).toMatchObject({
            cp: 1,
            diceValues: [6, 2, 3],
            completedSteps: 1,
            interactionKind: 'multistep-choice',
            handIds: [],
            discardIds: ['card-worthy-of-me'],
        });

        await game.screenshot('worthy-of-me-after-one-reroll-before-cancel', testInfo);

        const cancelButton = page.getByRole('button', { name: /^取消$/ }).first();
        await expect(cancelButton).toBeEnabled({ timeout: 5000 });
        await cancelButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const player = state?.core?.players?.['0'];
            const lastEvents = (state?.sys?.eventStream?.entries ?? []).slice(-10);
            return {
                cp: getCp(player),
                diceValues: (state?.core?.dice ?? []).slice(0, 3).map((die: any) => die.value),
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                handIds: (player?.hand ?? []).map((card: any) => card.id),
                discardIds: (player?.discard ?? []).map((card: any) => card.id),
                eventTypes: lastEvents.map((entry: any) => entry.event?.type),
            };
        }, { timeout: 5000 }).toMatchObject({
            cp: 1,
            diceValues: [6, 2, 3],
            interactionKind: null,
            handIds: [],
            discardIds: ['card-worthy-of-me'],
            eventTypes: expect.arrayContaining(['DIE_REROLLED', 'INTERACTION_CANCELLED']),
        });

        await expect(page.locator('[data-testid="hand-area"] [data-card-id="card-worthy-of-me"]')).toHaveCount(0);
        await game.screenshot('worthy-of-me-cancel-after-one-reroll-no-refund', testInfo);
    });

    test('card-wild-west 应触发装填奖励骰，不改攻击骰盘', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-wild-west'],
                resources: { CP: 2, HP: 50 },
                tokens: { loaded: 1 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'gunslinger', '1': 'monk' },
                hostStarted: true,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: true,
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
                    // 本用例只验证 Loaded/Wild West 奖励骰确认链路；防御和太极减伤由独立用例覆盖。
                    isDefendable: false,
                    sourceAbilityId: 'revolver-3',
                },
            },
        });

        await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice));
        await page.evaluate(() => {
            window.__BG_TEST_HARNESS__?.dice.setValues([2]);
        });

        const initialState = await game.getState();
        const initialDiceValues = (initialState?.core?.dice ?? []).map((die: any) => die.value);

        await dragHandCardToPlay(page, 'card-wild-west');

        // 断言：攻击修正徽章应在“打出卡牌后”立即出现（徽章是效果提示，不代表数值已生效）
        const modifierBadgeEarly = page.locator('[data-testid="active-modifier-badge"]').first();
        await expect(modifierBadgeEarly).toBeVisible({ timeout: 5000 });
        await expect(modifierBadgeEarly).toHaveAttribute('data-bonus-damage', '0');
        await game.screenshot('gunslinger-wild-west-attack-modifier-badge-pending', testInfo);

        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement ?? null;
            const boostAdds = state?.core?.pendingAttack?.loadedBonusDieBoost?.postSettleBonusDamageAdds?.length ?? 0;
            return {
                settlement,
                boostAdds,
            };
        }, { timeout: 5000 }).toMatchObject({
            settlement: null,
            boostAdds: 1,
        });

        const resolveAttackButton = page.getByRole('button', { name: /^(Resolve Attack|结算攻击)$/i }).first();
        await expect(resolveAttackButton).toBeVisible({ timeout: 5000 });
        await expect(resolveAttackButton).toBeEnabled({ timeout: 5000 });
        await resolveAttackButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const current = state?.sys?.interaction?.current;
            const options = Array.isArray(current?.data?.options) ? current.data.options : [];
            return {
                kind: current?.kind ?? null,
                playerId: current?.playerId ?? null,
                optionIds: options.map((option: any) => option?.value?.customId ?? option?.customId ?? option?.id),
            };
        }, { timeout: 5000 }).toMatchObject({
            kind: 'simple-choice',
            playerId: '0',
            optionIds: expect.arrayContaining(['use-loaded']),
        });
        const loadedOption = page.getByRole('button', { name: /^装填$/ }).first();
        await expect(loadedOption).toBeVisible({ timeout: 5000 });
        await loadedOption.click({ force: true });

        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            return {
                hasSettlement: !!settlement,
                diceCount: settlement?.dice?.length ?? 0,
                displayOnly: settlement?.displayOnly ?? false,
            };
        }, { timeout: 5000 }).toMatchObject({
            hasSettlement: true,
            diceCount: 1,
            displayOnly: false,
        });

        await expectRightTrayBonusDiceConfirmation(page, () => game.getState());
        const diceTray = getRightTrayDiceTray(page);
        await expect(diceTray.getByTestId('dice-2d')).toHaveCount(1, { timeout: 5000 });

        const finalState = await game.getState();
        const finalDiceValues = (finalState?.core?.dice ?? []).map((die: any) => die.value);
        expect(finalDiceValues).toEqual(initialDiceValues);

        // 断言：奖励骰来自 Loaded token；Wild West 的“然后 +1”应在奖励骰收口后才计入攻击修正汇总（徽章提前出现不等于数值提前生效）
        await expect.poll(async () => {
            const state = await game.getState();
            return state?.core?.pendingAttack?.attackModifierBonusDamage ?? null;
        }, { timeout: 5000 }).toBe(null);

        await game.screenshot('gunslinger-wild-west-bonus-die-right-tray', testInfo);

        const bonusDie = getRightTrayDie(page, 0);
        await expect(bonusDie).toBeVisible({ timeout: 5000 });
        await page.evaluate(() => {
            window.__BG_TEST_HARNESS__?.dice.setValues([6]);
        });
        await bonusDie.click({ force: true });

        await expect.poll(async () => {
            const state = await game.getState();
            return state?.core?.pendingBonusDiceSettlement?.dice?.[0]?.value ?? null;
        }, { timeout: 5000 }).toBe(6);
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                postSettleAdds: state?.core?.pendingBonusDiceSettlement?.postSettleBonusDamageAdds ?? [],
            };
        }, { timeout: 5000 }).toMatchObject({
            postSettleAdds: [expect.objectContaining({ amount: 1, sourceCardId: 'card-wild-west' })],
        });

        // 断言：已完成一次重掷后，应进入重掷上限态，而不是“没装填可重掷”的误导状态。
        await expect(bonusDie).toHaveAttribute('data-clickable', 'false', { timeout: 5000 });
        await expect(page.getByText('没有装填标记可用于重掷')).toHaveCount(0);

        // 断言：在奖励骰仍等待右侧骰盘确认时，不应提前计入“然后 +1”
        await expect.poll(async () => {
            const state = await game.getState();
            return state?.core?.pendingAttack?.attackModifierBonusDamage ?? null;
        }, { timeout: 5000 }).toBe(null);

        await game.screenshot('gunslinger-wild-west-bonus-die-rerolled-right-tray', testInfo);

        // 交互式奖励骰现在通过右侧骰盘普通“确认”收口；旧特写点击不再是正式入口。
        await settleCurrentBonusDice(page, () => game.getState(), {});
        await expect.poll(async () => {
            const state = await game.getState();
            const context = state?.core?.currentRollContext;
            return {
                phase: state?.sys?.phase ?? null,
                pendingBonusDiceSettlement: state?.core?.pendingBonusDiceSettlement ?? null,
                pendingAttack: state?.core?.pendingAttack ?? null,
                currentRollContext: context
                    ? {
                        id: context.id,
                        kind: context.kind,
                        status: context.status,
                        replayOnly: context.display?.replayOnly ?? false,
                        diceValues: Array.isArray(context.dice)
                            ? context.dice.map((die: any) => die.value)
                        : [],
                    }
                    : null,
            };
        }, { timeout: 10000 }).toMatchObject({
            pendingBonusDiceSettlement: null,
            pendingAttack: null,
            currentRollContext: null,
        });
        // 临时骰确认后应恢复当前玩家的常态骰子池；不能把右侧骰盘留成空白。
        const settledDicePool = page.locator('[data-testid="dicethrone-2d-dice-tray"]:visible [data-testid="dice-2d"]');
        await expect(settledDicePool).toHaveCount(5);
        await game.screenshot('gunslinger-wild-west-bonus-die-confirmed-normal-dice-pool', testInfo);

        // 断言：右侧骰盘普通确认后，左轮基础 3 + Loaded 半值加伤（6 -> +3）+ Wild West +1 已落到最终血量。
        const modifierBadge = page.locator('[data-testid="active-modifier-badge"]').first();
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                pendingAttack: state?.core?.pendingAttack ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.hp
                    ?? state?.core?.players?.['1']?.resources?.HP
                    ?? null,
                lastResolvedAttackDamage: state?.core?.lastResolvedAttackDamage ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            pendingAttack: null,
            defenderHp: 43,
            lastResolvedAttackDamage: 7,
        });
        await expect(modifierBadge).toHaveCount(0);
        await expect(page.getByTestId('bonus-die-overlay')).toHaveCount(0);
        await expect(page.getByTestId('bonus-dice-confirm-button')).toHaveCount(0);
        await waitForDiceThroneVisualIdle(page);
        await game.screenshot('gunslinger-wild-west-bonus-die-settled', testInfo);
    });

    test('card-wild-west 无装填时应被出牌门禁阻止（requireLoaded）', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-wild-west'],
                resources: { CP: 2, HP: 50 },
                tokens: { loaded: 0 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'gunslinger', '1': 'monk' },
                hostStarted: true,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: true,
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
                    sourceAbilityId: 'revolver-3',
                },
            },
        });

        await game.waitForPhase('offensiveRoll', 10000);

        await dragHandCardToPlay(page, 'card-wild-west');

        // 断言：应提示 requireLoaded，而不是进入右侧奖励骰结算态
        await expect(page.getByText('需要消耗 1 个装填才能打出此卡')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('[data-testid="bonus-die-overlay"]')).toHaveCount(0);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                stillHasCard: !!state?.core?.players?.['0']?.hand?.some((card: any) => card.id === 'card-wild-west'),
                settlement: state?.core?.pendingBonusDiceSettlement ?? null,
                bonusDamage: state?.core?.pendingAttack?.attackModifierBonusDamage ?? 0,
            };
        }, { timeout: 5000 }).toMatchObject({
            stillHasCard: true,
            settlement: null,
            bonusDamage: 0,
        });

        await game.screenshot('gunslinger-wild-west-require-loaded-toast', testInfo);
    });

    test('card-high-noon（bullet）应造成 2 点不可防御伤害，并通过右侧骰盘确认', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-high-noon'],
                resources: { CP: 1, HP: 50 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'main1',
            extra: {
                selectedCharacters: { '0': 'gunslinger', '1': 'monk' },
                hostStarted: true,
            },
        });

        await game.waitForPhase('main1', 10000);
        await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice));
        await page.evaluate(() => {
            // bullet = 1/2/3
            window.__BG_TEST_HARNESS__?.dice.setValues([1]);
        });

        await expect.poll(async () => {
            const state = await game.getState();
            return state?.core?.players?.['1']?.resources?.hp ?? null;
        }, { timeout: 5000 }).toBe(50);

        await dragHandCardToPlay(page, 'card-high-noon');

        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            const targetHp = state?.core?.players?.['1']?.resources?.hp ?? null;
            return {
                hasSettlement: !!settlement,
                displayOnly: settlement?.displayOnly ?? false,
                attackerId: settlement?.attackerId ?? null,
                targetId: settlement?.targetId ?? null,
                face: settlement?.dice?.[0]?.face ?? null,
                // 高正午（bullet）先停在右侧奖励骰盘；伤害必须等普通确认后才结算。
                targetHp,
            };
        }, { timeout: 5000 }).toMatchObject({
            hasSettlement: true,
            displayOnly: true,
            attackerId: '0',
            targetId: '1',
            face: 'bullet',
            targetHp: 50,
        });

        await expectRightTrayBonusDiceConfirmation(page, () => game.getState());
        await expect(getRightTrayDiceTray(page).getByTestId('dice-2d')).toHaveCount(1, { timeout: 5000 });
        await game.screenshot('gunslinger-high-noon-bullet-right-tray', testInfo);

        await settleCurrentBonusDice(page, () => game.getState(), {});
        await expectRightTrayBonusDiceReadOnlyReview(page, { expectedValues: [1] });
        await game.screenshot('gunslinger-high-noon-bullet-confirmed-review', testInfo);

        await expect.poll(async () => {
            const state = await game.getState();
            return state?.core?.players?.['1']?.resources?.hp ?? null;
        }, { timeout: 5000 }).toBe(48);

        await game.screenshot('gunslinger-high-noon-bullet-settled', testInfo);
    });

    test('card-high-noon（dash）应施加 1 层击倒，并通过右侧骰盘确认', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-high-noon'],
                resources: { CP: 1, HP: 50 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'main1',
            extra: {
                selectedCharacters: { '0': 'gunslinger', '1': 'monk' },
                hostStarted: true,
            },
        });

        await game.waitForPhase('main1', 10000);
        await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice));
        await page.evaluate(() => {
            // dash = 4/5
            window.__BG_TEST_HARNESS__?.dice.setValues([4]);
        });

        await dragHandCardToPlay(page, 'card-high-noon');

        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            const knockdown = state?.core?.players?.['1']?.statusEffects?.knockdown ?? 0;
            return {
                hasSettlement: !!settlement,
                displayOnly: settlement?.displayOnly ?? false,
                attackerId: settlement?.attackerId ?? null,
                targetId: settlement?.targetId ?? null,
                face: settlement?.dice?.[0]?.face ?? null,
                // 击倒必须等右侧骰盘普通确认后才施加。
                knockdown,
            };
        }, { timeout: 5000 }).toMatchObject({
            hasSettlement: true,
            displayOnly: true,
            attackerId: '0',
            targetId: '1',
            face: 'dash',
            knockdown: 0,
        });

        await expectRightTrayBonusDiceConfirmation(page, () => game.getState());
        await expect(getRightTrayDiceTray(page).getByTestId('dice-2d')).toHaveCount(1, { timeout: 5000 });
        await game.screenshot('gunslinger-high-noon-dash-right-tray', testInfo);

        await settleCurrentBonusDice(page, () => game.getState(), {});
        await expectRightTrayBonusDiceReadOnlyReview(page, { expectedValues: [4] });
        await game.screenshot('gunslinger-high-noon-dash-confirmed-review', testInfo);

        await expect.poll(async () => {
            const state = await game.getState();
            return state?.core?.players?.['1']?.statusEffects?.knockdown ?? 0;
        }, { timeout: 5000 }).toBe(1);

        await game.screenshot('gunslinger-high-noon-dash-settled', testInfo);
    });

    test('card-high-noon（bullseye）应施加 1 层赏金，并通过右侧骰盘确认', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-high-noon'],
                resources: { CP: 1, HP: 50 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'main1',
            extra: {
                selectedCharacters: { '0': 'gunslinger', '1': 'monk' },
                hostStarted: true,
            },
        });

        await game.waitForPhase('main1', 10000);
        await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice));
        await page.evaluate(() => {
            // bullseye = 6
            window.__BG_TEST_HARNESS__?.dice.setValues([6]);
        });

        await dragHandCardToPlay(page, 'card-high-noon');

        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            const bounty = state?.core?.players?.['1']?.tokens?.bounty ?? 0;
            return {
                hasSettlement: !!settlement,
                displayOnly: settlement?.displayOnly ?? false,
                attackerId: settlement?.attackerId ?? null,
                targetId: settlement?.targetId ?? null,
                face: settlement?.dice?.[0]?.face ?? null,
                // 赏金必须等右侧骰盘普通确认后才施加。
                bounty,
            };
        }, { timeout: 5000 }).toMatchObject({
            hasSettlement: true,
            displayOnly: true,
            attackerId: '0',
            targetId: '1',
            face: 'bullseye',
            bounty: 0,
        });

        await expectRightTrayBonusDiceConfirmation(page, () => game.getState());
        await expect(getRightTrayDiceTray(page).getByTestId('dice-2d')).toHaveCount(1, { timeout: 5000 });
        await game.screenshot('gunslinger-high-noon-bullseye-right-tray', testInfo);

        await settleCurrentBonusDice(page, () => game.getState(), {});
        await expectRightTrayBonusDiceReadOnlyReview(page, { expectedValues: [6] });
        await game.screenshot('gunslinger-high-noon-bullseye-confirmed-review', testInfo);

        await expect.poll(async () => {
            const state = await game.getState();
            return state?.core?.players?.['1']?.tokens?.bounty ?? 0;
        }, { timeout: 5000 }).toBe(1);

        await game.screenshot('gunslinger-high-noon-bullseye-settled', testInfo);
    });

});
