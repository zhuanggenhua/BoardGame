import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest } from '../framework/evidenceScreenshots';
import { closeDebugPanelIfOpen, dragDiceThroneHandCardToPlay } from '../helpers/dicethrone';
import { shot } from '../helpers/dicethroneThorEvidence';

// 预期来自实体卡：意不意外改变两颗骰；一掷千金获得向上取整的半数骰点 CP。
test('索尔意不意外沿旧骰盘修改两颗骰子并确认', async ({ page, game }, info) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(info);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await game.openTestGame('dicethrone', { playerID: '0', seat1: 'human' }, 120000);
    await game.setupScene({ gameId: 'dicethrone', phase: 'main1', currentPlayer: '0', randomQueue: [.08, .08, .08, .08, .08],
        player0: { hand: ['card-unexpected'], resources: { hp: 50, cp: 5 } }, player1: { hand: [] },
        extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true, dice: [], rollCount: 0, rollConfirmed: false } });
    await closeDebugPanelIfOpen(page);
    await page.locator('[data-tutorial-id="advance-phase-button"]').click();
    await page.locator('[data-tutorial-id="dice-roll-button"]').click();
    await dragDiceThroneHandCardToPlay(page, 'card-unexpected');
    await shot(page, info, '01-原骰盘显示两骰调整入口');
    await page.getByTestId('die-adjust-increment-0').click();
    await page.getByTestId('die-adjust-increment-1').click();
    await shot(page, info, '02-两颗骰子预览后沿原按钮确认');
    await page.getByTestId('dice-interaction-confirm-button').click();
    await expect.poll(async () => (await game.getState()).core.currentRollContext?.dice.map((d: { value: number }) => d.value)).toEqual([2, 2, 1, 1, 1]);
    await shot(page, info, '03-确认后仅两颗骰子改变');
});

for (const roll of [1, 6]) test(`索尔一掷千金投出${roll}后沿原效果骰确认`, async ({ page, game }, info) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(info);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await game.openTestGame('dicethrone', { playerID: '0', seat1: 'human' }, 120000);
    await game.setupScene({ gameId: 'dicethrone', phase: 'main1', currentPlayer: '0', randomQueue: [(roll - .5) / 6],
        player0: { hand: ['card-one-throw-fortune'], resources: { hp: 50, cp: 5 } }, player1: { hand: [] },
        extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true } });
    await closeDebugPanelIfOpen(page);
    await dragDiceThroneHandCardToPlay(page, 'card-one-throw-fortune');
    await expect.poll(async () => (await game.getState()).core.pendingBonusDiceSettlement?.dice[0].value).toBe(roll);
    await shot(page, info, '01-效果骰结果在原骰盘待确认');
    await page.locator('[data-tutorial-id="dice-confirm-button"]').click();
    await expect.poll(async () => (await game.getState()).core.players['0'].resources.cp).toBe(5 + Math.ceil(roll / 2));
    await shot(page, info, '02-确认后获得对应CP');
});

test('索尔抬一手在对手确认后选择对手骰并强制重投', async ({ page, game }, info) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(info);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await game.openTestGame('dicethrone', { playerID: '0', seat1: 'human' }, 120000);
    await game.setupScene({ gameId: 'dicethrone', phase: 'offensiveRoll', currentPlayer: '1', randomQueue: [.92],
        player0: { hand: ['card-give-hand'], resources: { hp: 50, cp: 5 } }, player1: { hand: [] },
        responseWindow: { windowType: 'afterRollConfirmed', responderQueue: ['0'], currentResponderIndex: 0 },
        extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true, rollCount: 3, rollLimit: 3,
            rollDiceCount: 5, rollConfirmed: true, pendingAttack: null,
            dice: [{ id: 0, value: 1, isKept: true }, { id: 1, value: 2, isKept: true }, { id: 2, value: 3, isKept: true }, { id: 3, value: 4, isKept: true }, { id: 4, value: 5, isKept: true }] } });
    await closeDebugPanelIfOpen(page);
    await dragDiceThroneHandCardToPlay(page, 'card-give-hand');
    await shot(page, info, '01-对手已确认骰面后原骰盘选择目标');
    await page.getByTestId('die-button-0').click();
    await shot(page, info, '02-选中对手骰后原确认入口可用');
    await page.getByTestId('dice-interaction-confirm-button').click();
    await expect.poll(async () => (await game.getState()).core.dice.map((d: { value: number }) => d.value)).toEqual([6, 2, 3, 4, 5]);
    await shot(page, info, '03-确认后仅选中对手骰重投');
});

test('索尔意不意外可在对手确认后改变对手两颗骰子', async ({ page, game }, info) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(info);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await game.openTestGame('dicethrone', { playerID: '0', seat1: 'human' }, 120000);
    await game.setupScene({ gameId: 'dicethrone', phase: 'offensiveRoll', currentPlayer: '1',
        player0: { hand: ['card-unexpected'], resources: { hp: 50, cp: 5 } }, player1: { hand: [] },
        responseWindow: { windowType: 'afterRollConfirmed', responderQueue: ['0'], currentResponderIndex: 0 },
        extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true, rollCount: 3, rollLimit: 3,
            rollDiceCount: 5, rollConfirmed: true, pendingAttack: null,
            dice: [{ id: 0, value: 1, isKept: true }, { id: 1, value: 2, isKept: true }, { id: 2, value: 3, isKept: true }, { id: 3, value: 4, isKept: true }, { id: 4, value: 5, isKept: true }] } });
    await closeDebugPanelIfOpen(page);
    await dragDiceThroneHandCardToPlay(page, 'card-unexpected');
    await shot(page, info, '01-对手已确认后原骰盘允许修改');
    await page.getByTestId('die-adjust-increment-0').click();
    await page.getByTestId('die-adjust-increment-1').click();
    await shot(page, info, '02-两颗对手骰预览后原确认可用');
    await page.getByTestId('dice-interaction-confirm-button').click();
    await expect.poll(async () => (await game.getState()).core.dice.map((d: { value: number }) => d.value)).toEqual([2, 3, 3, 4, 5]);
    await shot(page, info, '03-确认后仅两颗对手骰改变');
});
