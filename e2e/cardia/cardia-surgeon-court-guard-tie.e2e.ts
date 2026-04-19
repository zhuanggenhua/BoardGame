import { test, expect } from '@playwright/test';
import {
    setupCardiaTestScenario,
    readLiveState,
    playCard,
    waitForPhase,
} from '../helpers/cardia';

type CardiaState = {
    core: {
        phase: string;
        players: Record<string, {
            hand: Array<{ defId: string }>;
            playedCards: Array<{ uid: string; defId: string; signets: number }>;
        }>;
        modifierTokens: Array<{ cardId: string; value: number; source: string }>;
        encounterHistory: Array<{
            player1Influence: number;
            player2Influence: number;
            winnerId?: string;
            loserId?: string;
            player1Card?: { defId: string };
            player2Card?: { defId: string };
        }>;
    };
};

test.describe('Cardia - 外科医生 + 宫廷卫士平局回归', () => {
    test('第二回合 card07 修正后应为 9，和 card09 平局，不应给 P1 印戒', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_03', 'deck_i_card_07'],
                deck: ['deck_i_card_01', 'deck_i_card_05'],
            },
            player2: {
                hand: ['deck_i_card_04', 'deck_i_card_09', 'deck_i_card_07'],
                deck: ['deck_i_card_11', 'deck_i_card_06'],
            },
            phase: 'play',
        });

        try {
            // 回合1：外科医生注册延迟效果（-5）
            await playCard(setup.player1Page, 0); // deck_i_card_03
            await playCard(setup.player2Page, 0); // deck_i_card_04
            await waitForPhase(setup.player1Page, 'ability', 10000);

            const round1AbilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await round1AbilityButton.waitFor({ state: 'visible', timeout: 5000 });
            await round1AbilityButton.click();
            await waitForPhase(setup.player1Page, 'play', 10000);

            // 回合2：宫廷卫士 vs 伏击者
            await playCard(setup.player1Page, 0); // deck_i_card_07
            await playCard(setup.player2Page, 0); // deck_i_card_09
            await waitForPhase(setup.player1Page, 'ability', 10000);

            // P1 激活宫廷卫士，选择 Guild；P2 选择不弃牌（decline）
            const round2AbilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await round2AbilityButton.waitFor({ state: 'visible', timeout: 5000 });
            await round2AbilityButton.click();

            const p1Modal = setup.player1Page.locator('.fixed.inset-0.z-50');
            await p1Modal.waitFor({ state: 'visible', timeout: 5000 });
            const guildButton = p1Modal.locator('button').filter({ hasText: /guild|公会/i }).first();
            await guildButton.click();
            await p1Modal.waitFor({ state: 'hidden', timeout: 5000 });

            const p2Modal = setup.player2Page.locator('.fixed.inset-0.z-50');
            await p2Modal.waitFor({ state: 'visible', timeout: 5000 });
            const declineButton = p2Modal.locator('button').nth(1);
            await declineButton.click();
            await p2Modal.waitFor({ state: 'hidden', timeout: 5000 });

            // 等待状态同步
            await setup.player1Page.waitForTimeout(1200);

            const state = await readLiveState(setup.player1Page) as CardiaState;
            const core = state.core;

            const card07 = core.players['0'].playedCards.find(c => c.defId === 'deck_i_card_07');
            const card09 = core.players['1'].playedCards.find(c => c.defId === 'deck_i_card_09');
            expect(card07).toBeDefined();
            expect(card09).toBeDefined();

            const surgeonToken = core.modifierTokens.find(
                t => t.cardId === card07!.uid && t.source === 'ability_i_surgeon' && t.value === -5
            );
            const courtGuardToken = core.modifierTokens.find(
                t => t.cardId === card07!.uid && t.source === 'ability_i_court_guard' && t.value === 7
            );
            expect(surgeonToken).toBeDefined();
            expect(courtGuardToken).toBeDefined();

            const round2Encounter = core.encounterHistory[1];
            expect(round2Encounter).toBeDefined();
            expect(round2Encounter.player1Influence).toBe(9);
            expect(round2Encounter.player2Influence).toBe(9);
            expect(round2Encounter.winnerId).toBeUndefined();
            expect(round2Encounter.loserId).toBeUndefined();

            // 平局不放印戒：第二回合双方牌都不应获得印戒
            expect(card07!.signets).toBe(0);
            expect(card09!.signets).toBe(0);
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
