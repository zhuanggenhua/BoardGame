import { test, expect } from '../framework';

const PYROMANCER = 'pyromancer';
const ARTIFICER = 'artificer';

async function dragHandCardToPlay(page: any, cardId: string): Promise<void> {
    const handCard = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(handCard).toBeVisible({ timeout: 10000 });
    const cardBox = await handCard.boundingBox();
    if (!cardBox) {
        throw new Error(`未能获取手牌 ${cardId} 的拖拽区域`);
    }

    const startX = cardBox.x + cardBox.width / 2;
    const startY = cardBox.y + cardBox.height * 0.78;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, Math.max(24, startY - 240), { steps: 12 });
    await page.mouse.up();
    await page.mouse.move(2, 2);
}

test.describe('DiceThrone - 火法改奖励骰与发明家面板验收', () => {
    test('惊不惊喜应通过真实手牌把炎爆术奖励骰改为流星并按新骰面结算', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone');
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-surprise'],
                resources: { CP: 10, HP: 50 },
                tokens: { fire_mastery: 0 },
            },
            player1: {
                resources: { CP: 5, HP: 50 },
            },
            currentPlayer: '0',
            phase: 'main1',
            extra: {
                selectedCharacters: { '0': PYROMANCER, '1': 'barbarian' },
                hostStarted: true,
                rollCount: 1,
                rollLimit: 3,
                rollDiceCount: 1,
                rollConfirmed: true,
                dice: [
                    { id: 0, value: 1, isKept: false },
                ],
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: 'pyro-blast-2-4',
                    damage: 6,
                    bonusDamage: 0,
                    isDefendable: true,
                },
                pendingBonusDiceSettlement: {
                    id: 'pyro-blast-e2e-settlement',
                    sourceAbilityId: 'pyro-blast-2-4',
                    attackerId: '0',
                    targetId: '1',
                    dice: [
                        {
                            index: 0,
                            value: 1,
                            face: 'fire',
                            effectKey: 'bonusDie.effect.pyroBlast2Die',
                            effectParams: { value: 1, index: 0 },
                        },
                    ],
                    rerollCostTokenId: 'fire_mastery',
                    rerollCostAmount: 999,
                    rerollCount: 0,
                    maxRerollCount: 0,
                    readyToSettle: false,
                    displayOnly: true,
                    showTotal: false,
                    customResolutionId: 'pyro-blast-roll',
                    allowDiceModification: true,
                },
            },
            sys: {
                phase: 'main1',
                currentPlayerIndex: 0,
                interaction: { current: undefined, queue: [] },
                responseWindow: { current: undefined },
            },
        });

        const bonusOverlay = page.getByTestId('bonus-die-overlay').first();
        const surpriseCard = page.locator('[data-testid="hand-area"] [data-card-id="card-surprise"]').first();

        await expect(bonusOverlay).toBeVisible({ timeout: 10000 });
        await expect(bonusOverlay).toContainText('烈焰：伤害 +3');
        await expect(bonusOverlay).not.toContainText('bonusDie.effect');
        await expect(surpriseCard).toBeVisible({ timeout: 10000 });
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                face: state?.core?.pendingBonusDiceSettlement?.dice?.[0]?.face ?? null,
                allowDiceModification: state?.core?.pendingBonusDiceSettlement?.allowDiceModification ?? false,
                hasSurprise: state?.core?.players?.['0']?.hand?.some((card: any) => card.id === 'card-surprise') ?? false,
            };
        }, { timeout: 10000 }).toEqual({
            face: 'fire',
            allowDiceModification: true,
            hasSurprise: true,
        });

        await dragHandCardToPlay(page, 'card-surprise');

        await expect.poll(async () => {
            const state = await game.getState();
            const interaction = state?.sys?.interaction?.current;
            return {
                kind: interaction?.kind ?? null,
                dtType: interaction?.data?.meta?.dtType ?? null,
                sourceId: interaction?.data?.sourceId ?? null,
                diceOwnerId: interaction?.data?.meta?.diceOwnerId ?? null,
                allowedDieIds: interaction?.data?.allowedDieIds ?? [],
                hasSurprise: state?.core?.players?.['0']?.hand?.some((card: any) => card.id === 'card-surprise') ?? false,
            };
        }, { timeout: 10000 }).toEqual({
            kind: 'multistep-choice',
            dtType: 'modifyDie',
            sourceId: 'card-surprise',
            diceOwnerId: '0',
            allowedDieIds: [0],
            hasSurprise: false,
        });

        const dieButton = page.getByTestId('die-button-0').first();
        await expect(dieButton).toBeVisible({ timeout: 10000 });
        await expect(dieButton).toHaveAttribute('data-display-value', '1');
        await expect(dieButton).toHaveAttribute('data-owner-id', '0');

        const dieControlRow = dieButton.locator('xpath=../..');
        const incrementButton = dieControlRow.getByRole('button', { name: /^\+$/ }).first();
        await expect(incrementButton).toBeVisible({ timeout: 10000 });

        for (let value = 2; value <= 6; value += 1) {
            await incrementButton.click();
            await expect(dieButton).toHaveAttribute('data-display-value', String(value));
        }
        await expect(page.getByTestId('die-selected-ring-0')).toHaveCount(0);
        await page.waitForTimeout(450);

        await game.screenshot('火法-惊不惊喜-奖励骰改为流星-确认前', testInfo);

        const confirmModifyButton = page.getByRole('button', { name: /^(确认|Confirm)(?:\s*\(\d+\))?$/i }).first();
        await expect(confirmModifyButton).toBeEnabled({ timeout: 10000 });
        await confirmModifyButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                value: state?.core?.pendingBonusDiceSettlement?.dice?.[0]?.value ?? null,
                face: state?.core?.pendingBonusDiceSettlement?.dice?.[0]?.face ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            interactionKind: null,
            value: 6,
            face: 'meteor',
        });

        await expect(bonusOverlay).toBeVisible({ timeout: 10000 });
        await expect(bonusOverlay).toContainText('陨石：施加击倒');
        await expect(bonusOverlay).not.toContainText('bonusDie.effect');
        const changedBonusDieContent = bonusOverlay.getByTestId('bonus-die-spotlight-content').first();
        await expect(changedBonusDieContent).toHaveAttribute('data-is-rolling', 'false', { timeout: 10000 });
        // 文案揭示完成后，WebGL 骰体仍需完成落地阻尼与结果面回正，避免截图抓到中间骰面。
        await page.waitForTimeout(1800);
        await expect(page.getByTestId('die-button-0').first()).toHaveAttribute('data-display-value', '6');
        await game.screenshot('火法-惊不惊喜-奖励骰已改为流星', testInfo);

        const settleBonusDieButton = page.getByRole('button', { name: /^(关闭特写|Close Spotlight)$/i }).first();
        await expect(settleBonusDieButton).toBeVisible({ timeout: 10000 });
        await settleBonusDieButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                settlement: state?.core?.pendingBonusDiceSettlement ?? null,
                knockdown: state?.core?.players?.['1']?.statusEffects?.knockdown ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            settlement: null,
            knockdown: 1,
        });

        await game.screenshot('火法-惊不惊喜-流星击倒结算完成', testInfo);
    });

    test('发明家升级后打开角色面板应显示扳手攻击 II', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone');
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['upgrade-artificer-wrench-strike-2'],
                resources: { CP: 9, HP: 50 },
                tokens: { synth: 1 },
            },
            player1: {
                resources: { CP: 5, HP: 50 },
            },
            currentPlayer: '0',
            phase: 'main1',
            extra: {
                selectedCharacters: { '0': ARTIFICER, '1': 'monk' },
                hostStarted: true,
                rollCount: 1,
                rollLimit: 3,
                rollDiceCount: 5,
                rollConfirmed: false,
                dice: [
                    { id: 0, value: 1, isKept: false },
                    { id: 1, value: 1, isKept: false },
                    { id: 2, value: 1, isKept: false },
                    { id: 3, value: 1, isKept: false },
                    { id: 4, value: 1, isKept: false },
                ],
            },
            sys: {
                phase: 'main1',
                currentPlayerIndex: 0,
                interaction: { current: undefined, queue: [] },
                responseWindow: { current: undefined },
            },
        });

        const board = page.getByTestId('player-board-surface');
        const magnifyButton = page.getByTestId('player-board-magnify-button');
        await expect(board).toHaveAttribute('data-character-id', ARTIFICER, { timeout: 10000 });

        await dragHandCardToPlay(page, 'upgrade-artificer-wrench-strike-2');
        await expect.poll(async () => {
            const state = await game.getState();
            const artificer = state?.core?.players?.['0'];
            return {
                handIds: artificer?.hand?.map((card: any) => card.id) ?? [],
                abilityLevel: artificer?.abilityLevels?.['wrench-strike'] ?? null,
                upgradeCardId: artificer?.upgradeCardByAbilityId?.['wrench-strike']?.cardId ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            handIds: [],
            abilityLevel: 2,
            upgradeCardId: 'upgrade-artificer-wrench-strike-2',
        });

        const boardWrenchSlot = board.locator('[data-ability-slot="fist"]').first();
        await expect(boardWrenchSlot).toHaveAttribute('data-base-ability-id', 'wrench-strike', { timeout: 10000 });
        await expect(boardWrenchSlot).toHaveAttribute('data-upgrade-card-interactive', 'true', { timeout: 10000 });

        await expect(magnifyButton).toBeVisible({ timeout: 10000 });
        await magnifyButton.click();

        const overlay = page.getByTestId('board-magnify-overlay');
        const wrenchSlot = overlay.locator('[data-ability-slot="fist"]').first();
        const boardImage = overlay.locator('img').first();
        await expect(overlay).toBeVisible({ timeout: 10000 });
        await expect(boardImage).toBeVisible({ timeout: 10000 });
        await expect.poll(async () => boardImage.evaluate((node) => (
            node instanceof HTMLImageElement
            && node.complete
            && node.naturalWidth > 0
            && node.naturalHeight > 0
        )), { timeout: 10000 }).toBe(true);
        await expect(wrenchSlot).toBeVisible({ timeout: 10000 });
        await expect(wrenchSlot).toHaveAttribute('data-base-ability-id', 'wrench-strike');
        await expect(wrenchSlot).toHaveAttribute('data-upgrade-card-interactive', 'true');

        await game.screenshot('发明家-扳手攻击II-角色面板描述', testInfo);
    });
});
