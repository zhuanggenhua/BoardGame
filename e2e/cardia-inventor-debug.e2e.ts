import { test } from '@playwright/test';
import { setupCardiaTestScenario, playCard, waitForPhase } from './helpers/cardia';

/**
 * 发明家调试测试 - 只测试交互部分
 */
test('发明家交互调试', async ({ browser }) => {
    const setup = await setupCardiaTestScenario(browser, {
        player1: {
            hand: ['deck_i_card_15'],
            deck: ['deck_i_card_01'],
            playedCards: [{ defId: 'deck_i_card_03', signets: 0, encounterIndex: 0 }],
        },
        player2: {
            hand: ['deck_i_card_16'],
            deck: ['deck_i_card_07'],
            playedCards: [{ defId: 'deck_i_card_10', signets: 0, encounterIndex: 0 }],
        },
        phase: 'play',
    });
    
    try {
        // 监听所有控制台输出
        setup.player1Page.on('console', msg => console.log('[Browser]', msg.text()));
        
        await playCard(setup.player1Page, 0);
        await playCard(setup.player2Page, 0);
        await waitForPhase(setup.player1Page, 'ability');
        
        const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
        await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
        await abilityButton.click();
        await setup.player1Page.waitForTimeout(1000);
        
        const modal = setup.player1Page.locator('.fixed.inset-0.z-50');
        await modal.waitFor({ state: 'visible', timeout: 5000 });
        
        const cardGrid = modal.locator('.grid');
        const cardButtons = cardGrid.locator('button');
        
        await cardButtons.nth(0).click();
        await setup.player1Page.waitForTimeout(300);
        await cardButtons.nth(1).click();
        await setup.player1Page.waitForTimeout(300);
        
        const confirmButton = modal.locator('button').filter({ hasText: /confirm|确认/i });
        await confirmButton.first().click({ timeout: 5000 });
        
        // 等待足够长的时间来查看日志
        await setup.player1Page.waitForTimeout(3000);
        
    } finally {
        await setup.player1Context.close();
        await setup.player2Context.close();
    }
});
