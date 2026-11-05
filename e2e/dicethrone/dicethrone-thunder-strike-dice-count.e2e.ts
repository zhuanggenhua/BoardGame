import { test, expect } from '../framework';
import type { GameTestContext } from '../framework';
import { expectRightTrayBonusDiceConfirmation } from './bonus-dice-flow';

const THUNDER_STRIKE_SETTLEMENT_ID = 'thunder-strike-e2e';
const THUNDER_STRIKE_BONUS_DICE = [
    { index: 0, value: 2, face: 'palm' },
    { index: 1, value: 4, face: 'taiji' },
    { index: 2, value: 6, face: 'lotus' },
] as const;
const THUNDER_STRIKE_CONTEXT_DICE = THUNDER_STRIKE_BONUS_DICE.map((die) => ({
    id: die.index,
    value: die.value,
    symbol: die.face,
    symbols: [die.face],
    isKept: false,
    ownerId: '0',
    definitionId: 'monk-dice',
}));

async function setupThunderStrikeSettlement(game: GameTestContext): Promise<void> {
    await game.openTestGame('dicethrone');

    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { CP: 0, HP: 50 },
            tokens: { taiji: 3 },
        },
        player1: {
            resources: { HP: 50 },
        },
        currentPlayer: '0',
        phase: 'main2',
        extra: {
            selectedCharacters: { '0': 'monk', '1': 'barbarian' },
            hostStarted: true,
            pendingBonusDiceSettlement: {
                id: THUNDER_STRIKE_SETTLEMENT_ID,
                sourceAbilityId: 'thunder-strike',
                attackerId: '0',
                targetId: '1',
                dice: THUNDER_STRIKE_BONUS_DICE,
                rerollCostTokenId: 'taiji',
                rerollCostAmount: 2,
                rerollCount: 0,
                readyToSettle: false,
                resolutionMode: 'damage',
                continuation: { kind: 'attack', settlementStage: 'readyToResolve', markBonusDiceResolved: true },
            },
            currentRollContext: {
                id: `bonus:${THUNDER_STRIKE_SETTLEMENT_ID}`,
                kind: 'bonus',
                ownerPlayerId: '0',
                targetPlayerId: '1',
                sourceAbilityId: 'thunder-strike',
                dice: THUNDER_STRIKE_CONTEXT_DICE,
                status: 'open',
                policy: {
                    modifiableBy: 'any',
                    rerollableBy: 'any',
                    allowPassiveReroll: true,
                    allowDiceCardTargeting: true,
                    ultimateLocked: false,
                    blocksPhaseFlow: true,
                },
                settlement: {
                    mode: 'damage',
                    metadata: {
                        pendingBonusDiceSettlementId: THUNDER_STRIKE_SETTLEMENT_ID,
                    },
                },
                display: {
                    surface: 'diceTray',
                    replayOnly: false,
                },
            },
        },
    });
}

test.describe('雷霆万钧骰子数量验证', () => {
    test('应显示 3 个奖励骰和太极重掷信息', async ({ page, game }) => {
        await setupThunderStrikeSettlement(game);

        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            return {
                diceCount: settlement?.dice?.length ?? 0,
                attackerId: settlement?.attackerId ?? null,
                targetId: settlement?.targetId ?? null,
                rerollCostTokenId: settlement?.rerollCostTokenId ?? null,
                rerollCostAmount: settlement?.rerollCostAmount ?? null,
                currentRollOwner: state?.core?.currentRollContext?.ownerPlayerId ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            diceCount: 3,
            attackerId: '0',
            targetId: '1',
            rerollCostTokenId: 'taiji',
            rerollCostAmount: 2,
            currentRollOwner: '0',
        });

        await expectRightTrayBonusDiceConfirmation(page, () => game.getState(), {
            sourceAbilityId: 'thunder-strike',
            expectedOwnerId: '0',
            expectedDefinitionId: 'monk-dice',
            expectedOwnerName: /武僧|Monk/,
        });

        const state = await game.getState();
        const settlement = state?.core?.pendingBonusDiceSettlement;

        expect(settlement?.dice?.length ?? 0).toBe(3);
        expect(settlement?.rerollCostTokenId ?? null).toBe('taiji');
        expect(settlement?.rerollCostAmount ?? null).toBe(2);
        expect(state?.core?.players?.['0']?.tokens?.taiji ?? 0).toBe(3);
    });
});
