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

test('收集故事从对手手牌打出属于自己的附着行动', async ({ page, game }, testInfo) => {
  test.setTimeout(120000);
  await setChineseLocale(page.context());
  await game.openTestGame('smashup', { numPlayers: 2, skipInitialization: true }, 45000);
  await game.setupScene({
    gameId: 'smashup', currentPlayer: '0', phase: 'playCards',
    player0: {
      hand: [{ uid: 'collecting', defId: 'anansi_tales_collecting_stories', type: 'action', owner: '0' }],
      deck: [], discard: [], factions: ['anansi_tales', 'mounties'], actionsPlayed: 0, actionLimit: 1,
    },
    player1: {
      hand: [
        { uid: 'borrowed-ongoing', defId: 'mounties_bring_em_in', type: 'action', owner: '0' },
        { uid: 'opponent-card', defId: 'ninja_acolyte', type: 'minion', owner: '1' },
      ],
      deck: [], discard: [], factions: ['pirates', 'ninjas'],
    },
    bases: [{ defId: 'base_the_factory', minions: [{ uid: 'target', defId: 'wizard_neophyte', owner: '0', controller: '0', power: 2 }] }],
  });
  await game.playCard('anansi_tales_collecting_stories');
  await game.waitForInteraction('anansi_tales_collecting_stories_player', 10000);
  const playerOptions = await game.getInteractionOptions();
  const otherPlayer = playerOptions.find(option => option.value?.targetPlayerId === '1');
  expect(otherPlayer).toBeDefined();
  await page.locator(`[data-option-id="${otherPlayer.id}"]`).click();
  await game.waitForInteraction('anansi_tales_collecting_stories', 10000);
  const options = await game.getInteractionOptions();
  const borrowed = options.find(option => option.value?.cardUid === 'borrowed-ongoing');
  const opponentCard = options.find(option => option.value?.cardUid === 'opponent-card');
  expect(borrowed).toBeDefined();
  expect(opponentCard?.disabled).toBe(true);
  await expect(page.locator(`[data-option-id="${opponentCard.id}"]`)).toBeVisible();
  await game.screenshot('收集故事-选择对手手中自己的附着行动', testInfo);
  await page.locator(`[data-option-id="${borrowed.id}"]`).click();
  await expect.poll(async () => {
    const state = await game.getState();
    const interaction = state.sys.interaction?.current;
    return interaction?.data?.options?.some((option: { value?: { minionUid?: string } }) => option.value?.minionUid === 'target') ?? false;
  }, { timeout: 10000 }).toBe(true);
  await page.locator('[data-minion-uid="target"]').click();
  await expect.poll(async () => {
    const state = await game.getState();
    return state.core.bases[0].minions[0].attachedActions.some((card: { uid: string }) => card.uid === 'borrowed-ongoing');
  }).toBe(true);
  await game.screenshot('收集故事-附着行动完成', testInfo);
});

for (const playAs of ['minion', 'action'] as const) {
  test(`收集故事从对手手牌将融合牌作为 ${playAs} 打出`, async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { numPlayers: 2, skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup', currentPlayer: '0', phase: 'playCards',
      player0: {
        hand: [{ uid: 'collecting', defId: 'anansi_tales_collecting_stories', type: 'action', owner: '0' }],
        deck: [], discard: [], factions: ['anansi_tales', 'adolescent_epic_geckos'], actionsPlayed: 0, actionLimit: 1,
      },
      player1: {
        hand: [{ uid: 'borrowed-fusion', defId: 'geckos_kc_smith', type: 'fusion', owner: '0' }],
        deck: [], discard: [], factions: ['pirates', 'ninjas'],
      },
      bases: [{ defId: 'base_the_factory', minions: [] }],
    });
    await game.playCard('anansi_tales_collecting_stories');
    await game.waitForInteraction('anansi_tales_collecting_stories_player', 10000);
    const opponent = (await game.getInteractionOptions()).find(option => option.value?.targetPlayerId === '1');
    expect(opponent).toBeDefined();
    await page.locator(`[data-option-id="${opponent.id}"]`).click();
    await game.waitForInteraction('anansi_tales_collecting_stories', 10000);
    const fusion = (await game.getInteractionOptions()).find(option => option.value?.cardUid === 'borrowed-fusion');
    expect(fusion).toBeDefined();
    await page.locator(`[data-option-id="${fusion.id}"]`).click();
    await game.waitForInteraction('anansi_tales_collecting_stories_fusion', 10000);
    const modes = await game.getInteractionOptions();
    const mode = modes.find(option => option.value?.playAs === playAs);
    expect(mode?.disabled).not.toBe(true);
    await game.screenshot('收集故事-选择融合牌面', testInfo);
    await page.locator(`[data-option-id="${mode.id}"]`).click();
    if (playAs === 'minion') {
      await game.waitForInteraction('anansi_tales_collecting_stories_base', 10000);
      await page.locator('[data-base-index="0"]').first().click();
    }
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        opponentHasCard: state.core.players['1'].hand.some((card: { uid: string }) => card.uid === 'borrowed-fusion'),
        inPlay: state.core.bases[0].minions.some((card: { uid: string }) => card.uid === 'borrowed-fusion'),
        discarded: state.core.players['0'].discard.some((card: { uid: string }) => card.uid === 'borrowed-fusion'),
      };
    }).toEqual({ opponentHasCard: false, inPlay: playAs === 'minion', discarded: playAs === 'action' });
    await game.screenshot('收集故事-融合牌打出完成', testInfo);
  });
}
