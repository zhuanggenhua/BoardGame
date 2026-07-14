import { test, expect } from '../framework';

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

test.describe('DiceThrone - 选择骰子修改', () => {
    test('card-me-too 复制骰面时重复点源骰不会提前完成，点目标骰后才结算', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-me-too'],
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
                    { id: 0, value: 6, isKept: false },
                    { id: 1, value: 5, isKept: false },
                    { id: 2, value: 4, isKept: false },
                    { id: 3, value: 2, isKept: false },
                    { id: 4, value: 3, isKept: false },
                ],
            },
        });

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                hasCard: !!state?.core?.players?.['0']?.hand?.some((card: any) => card.id === 'card-me-too'),
                diceCount: state?.core?.dice?.length ?? 0,
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'offensiveRoll',
            hasCard: true,
            diceCount: 5,
        });

        await dragHandCardToPlay(page, 'card-me-too');

        await expect.poll(async () => {
            const interaction = (await game.getState())?.sys?.interaction?.current;
            const meta = interaction?.data?.meta;
            return {
                dtType: meta?.dtType ?? null,
                mode: meta?.dieModifyConfig?.mode ?? null,
                selectCount: meta?.selectCount ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            dtType: 'modifyDie',
            mode: 'copy',
            selectCount: 2,
        });

        await game.screenshot('me-too-copy-source-ready', testInfo);

        const sourceDieButton = page.locator('[data-testid="die-button-0"]');
        await expect(sourceDieButton).toBeVisible({ timeout: 5000 });
        await sourceDieButton.click();
        await sourceDieButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const lastEvents = (state?.sys?.eventStream?.entries ?? []).slice(-8);
            return {
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                dtType: state?.sys?.interaction?.current?.data?.meta?.dtType ?? null,
                diceValues: (state?.core?.dice ?? []).map((die: any) => die.value),
                modifiedCount: lastEvents.filter((entry: any) => entry.event?.type === 'DIE_MODIFIED').length,
            };
        }, { timeout: 5000 }).toMatchObject({
            interactionKind: 'multistep-choice',
            dtType: 'modifyDie',
            diceValues: [6, 5, 4, 2, 3],
            modifiedCount: 0,
        });

        await game.screenshot('me-too-copy-duplicate-source-still-waiting', testInfo);

        const targetDieButton = page.locator('[data-testid="die-button-3"]');
        await expect(targetDieButton).toBeVisible({ timeout: 5000 });
        await targetDieButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const lastEvents = (state?.sys?.eventStream?.entries ?? []).slice(-8);
            return {
                targetDie: state?.core?.dice?.[3]?.value ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                handIds: (state?.core?.players?.['0']?.hand ?? []).map((card: any) => card.id),
                lastEventTypes: lastEvents.map((entry: any) => entry.event?.type),
            };
        }, { timeout: 5000 }).toMatchObject({
            targetDie: 6,
            interactionKind: null,
            handIds: [],
        });

        await game.screenshot('me-too-copy-settled', testInfo);

        const finalState = await game.getState();
        const finalHandIds = (finalState?.core?.players?.['0']?.hand ?? []).map((card: any) => card.id);
        const finalEventTypes = (finalState?.sys?.eventStream?.entries ?? [])
            .slice(-8)
            .map((entry: any) => entry.event?.type);

        expect(finalState?.core?.dice?.[3]?.value ?? null).toBe(6);
        expect(finalHandIds).not.toContain('card-me-too');
        expect(finalEventTypes).toContain('CARD_PLAYED');
        expect(finalEventTypes).toContain('DIE_MODIFIED');
    });

    test('card-play-six 应通过 framework 场景完成改骰到 6', async ({ page, game }) => {
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-play-six'],
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
                    { id: 0, value: 2, isKept: false },
                    { id: 1, value: 3, isKept: false },
                    { id: 2, value: 4, isKept: false },
                    { id: 3, value: 5, isKept: false },
                    { id: 4, value: 1, isKept: false },
                ],
            },
        });

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                hasCard: !!state?.core?.players?.['0']?.hand?.some((card: any) => card.id === 'card-play-six'),
                diceCount: state?.core?.dice?.length ?? 0,
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'offensiveRoll',
            hasCard: true,
            diceCount: 5,
        });

        await dragHandCardToPlay(page, 'card-play-six');

        await expect.poll(async () => {
            const interaction = (await game.getState())?.sys?.interaction?.current;
            const meta = interaction?.data?.meta;
            return {
                dtType: meta?.dtType ?? null,
                mode: meta?.dieModifyConfig?.mode ?? null,
                targetValue: meta?.dieModifyConfig?.targetValue ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            dtType: 'modifyDie',
            mode: 'set',
            targetValue: 6,
        });

        const dieButton = page.locator('[data-testid="die-button-0"]');
        await expect(dieButton).toBeVisible({ timeout: 5000 });
        await dieButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const lastEvents = (state?.sys?.eventStream?.entries ?? []).slice(-6);
            return {
                firstDie: state?.core?.dice?.[0]?.value ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                handIds: (state?.core?.players?.['0']?.hand ?? []).map((card: any) => card.id),
                lastEventTypes: lastEvents.map((entry: any) => entry.event?.type),
            };
        }, { timeout: 5000 }).toMatchObject({
            firstDie: 6,
            interactionKind: null,
            handIds: [],
        });

        const finalState = await game.getState();
        const finalHandIds = (finalState?.core?.players?.['0']?.hand ?? []).map((card: any) => card.id);
        const finalEventTypes = (finalState?.sys?.eventStream?.entries ?? [])
            .slice(-6)
            .map((entry: any) => entry.event?.type);

        expect(finalState?.core?.dice?.[0]?.value ?? null).toBe(6);
        expect(finalHandIds).not.toContain('card-play-six');
        expect(finalEventTypes).toContain('CARD_PLAYED');
        expect(finalEventTypes).toContain('DIE_MODIFIED');
    });

    test('主要阶段待结算奖励骰应允许红牌打出并修改奖励骰', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-play-six'],
                resources: { CP: 2, HP: 50 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'main1',
            extra: {
                selectedCharacters: { '0': 'monk', '1': 'barbarian' },
                hostStarted: true,
                rollCount: 0,
                rollLimit: 3,
                rollConfirmed: true,
                dice: [],
                pendingBonusDiceSettlement: {
                    id: 'e2e-main1-bonus-die-modification',
                    sourceAbilityId: 'e2e-bonus-die',
                    attackerId: '0',
                    targetId: '1',
                    dice: [
                        {
                            index: 0,
                            value: 3,
                            face: 'palm',
                            effectKey: 'bonusDie.effect.damage',
                            effectParams: { value: 3 },
                            presentationKind: 'choice',
                        },
                    ],
                    rerollCostTokenId: 'taiji',
                    rerollCostAmount: 1,
                    rerollCount: 0,
                    maxRerollCount: 0,
                    readyToSettle: false,
                    showTotal: true,
                    resolutionMode: 'damage',
                    allowDiceModification: true,
                },
            },
        });

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                hasCard: !!state?.core?.players?.['0']?.hand?.some((card: any) => card.id === 'card-play-six'),
                bonusDieValue: state?.core?.pendingBonusDiceSettlement?.dice?.[0]?.value ?? null,
                allowDiceModification: state?.core?.pendingBonusDiceSettlement?.allowDiceModification ?? false,
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'main1',
            hasCard: true,
            bonusDieValue: 3,
            allowDiceModification: true,
        });

        await game.screenshot('main1-bonus-die-before-red-card', testInfo);

        await dragHandCardToPlay(page, 'card-play-six');

        await expect.poll(async () => {
            const interaction = (await game.getState())?.sys?.interaction?.current;
            const meta = interaction?.data?.meta;
            return {
                dtType: meta?.dtType ?? null,
                mode: meta?.dieModifyConfig?.mode ?? null,
                targetValue: meta?.dieModifyConfig?.targetValue ?? null,
                allowedDieIds: interaction?.data?.allowedDieIds ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            dtType: 'modifyDie',
            mode: 'set',
            targetValue: 6,
            allowedDieIds: [0],
        });

        await game.screenshot('main1-bonus-die-red-card-selecting-die', testInfo);

        const dieButton = page.locator('[data-testid="die-button-0"]').first();
        await expect(dieButton).toBeVisible({ timeout: 5000 });
        await expect(dieButton).toHaveAttribute('data-clickable', 'true');
        await dieButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const lastEvents = (state?.sys?.eventStream?.entries ?? []).slice(-8);
            return {
                bonusDieValue: state?.core?.pendingBonusDiceSettlement?.dice?.[0]?.value ?? null,
                bonusDieFace: state?.core?.pendingBonusDiceSettlement?.dice?.[0]?.face ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                handIds: (state?.core?.players?.['0']?.hand ?? []).map((card: any) => card.id),
                lastEventTypes: lastEvents.map((entry: any) => entry.event?.type),
            };
        }, { timeout: 5000 }).toMatchObject({
            bonusDieValue: 6,
            bonusDieFace: 'lotus',
            interactionKind: null,
            handIds: [],
        });

        await game.screenshot('main1-bonus-die-red-card-modified', testInfo);

        const finalState = await game.getState();
        const finalHandIds = (finalState?.core?.players?.['0']?.hand ?? []).map((card: any) => card.id);
        const finalEventTypes = (finalState?.sys?.eventStream?.entries ?? [])
            .slice(-8)
            .map((entry: any) => entry.event?.type);

        expect(finalState?.sys?.phase ?? null).toBe('main1');
        expect(finalState?.core?.pendingBonusDiceSettlement?.dice?.[0]?.value ?? null).toBe(6);
        expect(finalState?.core?.pendingBonusDiceSettlement?.dice?.[0]?.face ?? null).toBe('lotus');
        expect(finalHandIds).not.toContain('card-play-six');
        expect(finalEventTypes).toContain('CARD_PLAYED');
        expect(finalEventTypes).toContain('DIE_MODIFIED');
    });
});
