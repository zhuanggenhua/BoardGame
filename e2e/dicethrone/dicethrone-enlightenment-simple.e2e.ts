/**
 * DiceThrone - 顿悟卡牌 E2E 测试
 *
 * 验证投出莲花时获得 2 太极、1 闪避、1 净化。
 */

import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import type { GameTestContext } from '../framework';
import { dragDiceThroneHandCardToPlay } from '../helpers/dicethrone';
import { settleCurrentBonusDice } from './bonus-dice-flow';

async function setupEnlightenmentScene(page: Page, game: GameTestContext): Promise<void> {
    await game.openTestGame('dicethrone');

    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            hand: ['card-enlightenment'],
            resources: { CP: 0, HP: 50 },
            tokens: { taiji: 0, evasive: 0, purify: 0 },
        },
        player1: {
            resources: { HP: 50 },
        },
        currentPlayer: '0',
        phase: 'main1',
        extra: {
            selectedCharacters: { '0': 'monk', '1': 'barbarian' },
            hostStarted: true,
        },
    });

    await game.waitForPhase('main1', 10000);
    await expect.poll(async () => {
        const state = await game.getState();
        return {
            activePlayerId: state?.core?.activePlayerId ?? null,
            hasCard: !!state?.core?.players?.['0']?.hand?.some((card: any) => card.id === 'card-enlightenment'),
        };
    }, { timeout: 10000 }).toMatchObject({
        activePlayerId: '0',
        hasCard: true,
    });

    await page.evaluate((value) => {
        (window as any).__BG_TEST_HARNESS__?.dice?.setValues?.([value]);
    }, 6);
}

test.describe('DiceThrone - 顿悟卡牌', () => {
    test('投出莲花 -> 获得2太极+1闪避+1净化', async ({ page, game }) => {
        await setupEnlightenmentScene(page, game);

        const enlightenmentCard = page.locator('[data-testid="hand-area"] [data-card-id="card-enlightenment"]').first();
        await expect(enlightenmentCard).toBeVisible({ timeout: 5000 });
        await dragDiceThroneHandCardToPlay(page, 'card-enlightenment');
        await settleCurrentBonusDice(page, () => game.getState(), { sourceAbilityId: 'card-enlightenment' });

        await expect.poll(async () => {
            const state = await game.getState();
            const player0 = state?.core?.players?.['0'];
            const bonusDieEvent = [...(state?.sys?.eventStream?.entries ?? [])]
                .reverse()
                .find((entry: any) => entry.event?.type === 'BONUS_DIE_ROLLED');

            return {
                handIds: player0?.hand?.map((card: any) => card.id) ?? [],
                tokens: player0?.tokens ?? {},
                bonusDieEffectKey: bonusDieEvent?.event?.payload?.effectKey ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            handIds: [],
            tokens: {
                taiji: 2,
                evasive: 1,
                purify: 1,
            },
            bonusDieEffectKey: 'bonusDie.effect.enlightenmentLotus',
        });

        const player0 = await game.getPlayerState('0');

        expect(player0?.hand?.map((card: any) => card.id) ?? []).not.toContain('card-enlightenment');
        expect(player0?.tokens?.taiji ?? 0).toBe(2);
        expect(player0?.tokens?.evasive ?? 0).toBe(1);
        expect(player0?.tokens?.purify ?? 0).toBe(1);
    });
});
