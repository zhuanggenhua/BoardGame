import { test, expect } from '../framework';
import { setChineseLocale } from '../helpers/common';

test('阿克耶海龟在三人局可将手牌交给指定的另一位玩家', async ({ page, game }, testInfo) => {
  test.setTimeout(120000);
  await setChineseLocale(page.context());
  await game.openTestGame('smashup', { numPlayers: 3, skipInitialization: true }, 45000);
  await game.setupScene({
    gameId: 'smashup', currentPlayer: '0', phase: 'playCards',
    player0: {
      hand: [
        { uid: 'turtle', defId: 'anansi_tales_akye_the_turtle', type: 'minion', owner: '0' },
        { uid: 'gift-card', defId: 'wizard_mystic_studies', type: 'action', owner: '0' },
      ],
      deck: [
        { uid: 'draw-a', defId: 'wizard_neophyte', type: 'minion', owner: '0' },
        { uid: 'draw-b', defId: 'wizard_neophyte', type: 'minion', owner: '0' },
      ],
      discard: [], factions: ['anansi_tales', 'wizards'], minionsPlayed: 0, minionLimit: 1,
    },
    player1: { hand: [], deck: [], discard: [], factions: ['mounties', 'sumo_wrestlers'] },
    player2: { hand: [], deck: [], discard: [], factions: ['pirates', 'ninjas'] },
    bases: [{ defId: 'base_the_factory', minions: [] }],
  });
  await game.playCard('anansi_tales_akye_the_turtle', { targetBaseIndex: 0 });
  await game.waitForInteraction('anansi_tales_akye_the_turtle', 10000);
  const options = await game.getInteractionOptions();
  const first = options.find(option => option.value?.cardUid === 'gift-card' && option.value?.targetPlayerId === '1');
  const second = options.find(option => option.value?.cardUid === 'gift-card' && option.value?.targetPlayerId === '2');
  expect(first).toBeDefined();
  expect(second).toBeDefined();
  await expect(page.locator(`[data-option-id="${second.id}"]`)).toContainText('P3');
  await game.screenshot('三人局-海龟赠牌候选', testInfo);
  await expect(page.locator(`[data-option-id="${second.id}"]`)).toBeVisible({ timeout: 10000 });
  await page.locator(`[data-option-id="${second.id}"]`).click();
  await game.waitForNoInteraction(10000);
  await expect.poll(async () => {
    const players = (await game.getState()).core.players;
    return {
      p1: players['1'].hand.map((card: { uid: string }) => card.uid),
      p2: players['2'].hand.map((card: { uid: string }) => card.uid),
    };
  }).toEqual({ p1: [], p2: ['gift-card'] });
  await game.screenshot('三人局-指定玩家收到赠牌', testInfo);
});

test('智慧之锅在三人局必须分别给两名玩家不同的牌', async ({ page, game }, testInfo) => {
  test.setTimeout(120000);
  await setChineseLocale(page.context());
  await game.openTestGame('smashup', { numPlayers: 3, skipInitialization: true }, 45000);
  await game.setupScene({
    gameId: 'smashup', currentPlayer: '0', phase: 'playCards',
    player0: {
      hand: [{ uid: 'wisdom', defId: 'anansi_tales_pot_of_wisdom', type: 'action', owner: '0' }],
      deck: [
        { uid: 'gift-a', defId: 'wizard_mystic_studies', type: 'action', owner: '0' },
        { uid: 'gift-b', defId: 'wizard_neophyte', type: 'minion', owner: '0' },
      ],
      discard: [], factions: ['anansi_tales', 'wizards'], actionsPlayed: 0, actionLimit: 1,
    },
    player1: { hand: [], deck: [], discard: [], factions: ['mounties', 'sumo_wrestlers'] },
    player2: { hand: [], deck: [], discard: [], factions: ['pirates', 'ninjas'] },
    bases: [{ defId: 'base_the_factory', minions: [] }],
  });
  await game.playCard('anansi_tales_pot_of_wisdom');
  await game.waitForInteraction('anansi_tales_pot_of_wisdom', 10000);
  const options = await game.getInteractionOptions();
  const findGift = (uid: string, target: string) => {
    const option = options.find(item => item.value?.cardUid === uid && item.value?.targetPlayerId === target);
    expect(option).toBeDefined();
    return page.locator(`[data-option-id="${option.id}"]`);
  };
  const aToOne = findGift('gift-a', '1');
  const aToTwo = findGift('gift-a', '2');
  const bToOne = findGift('gift-b', '1');
  const bToTwo = findGift('gift-b', '2');
  const confirm = page.getByRole('button', { name: /^确认/ });
  await aToOne.click();
  await aToTwo.click();
  await game.screenshot('智慧之锅-重复选择同一张牌', testInfo);
  await expect(confirm).toBeDisabled();
  await aToTwo.click();
  await bToOne.click();
  await expect(confirm).toBeDisabled();
  await bToOne.click();
  await bToTwo.click();
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await game.waitForNoInteraction(10000);
  await expect.poll(async () => {
    const players = (await game.getState()).core.players;
    return {
      p1: players['1'].hand.map((card: { uid: string }) => card.uid),
      p2: players['2'].hand.map((card: { uid: string }) => card.uid),
      actionLimit: players['0'].actionLimit,
    };
  }).toEqual({ p1: ['gift-a'], p2: ['gift-b'], actionLimit: 2 });
  await expect(page.locator('[data-testid="su-hand-area"] [data-card-uid="gift-a"]')).toHaveCount(0, { timeout: 10000 });
  await expect(page.locator('[data-testid="su-hand-area"] [data-card-uid="gift-b"]')).toHaveCount(0, { timeout: 10000 });
  await game.screenshot('智慧之锅-分别赠牌完成', testInfo);
});
