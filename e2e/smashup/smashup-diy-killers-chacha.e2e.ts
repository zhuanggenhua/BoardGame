import { test, expect } from '../framework';
import { setChineseLocale } from '../helpers/common';

const cardId = 'diy_killers_cha_cha_cha_ha_ha_ha';

test.describe('杀人狂恰恰恰真实入口', () => {
  test('预置代表态：移动杰森后选择牌库顶并处理他的摧毁反应', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_killers,pirates', p1: 'ninjas,aliens', skipFactionSelect: true,
      skipInitialization: false, seed: 20261120,
    }, 45000);
    await game.setupScene({
      gameId: 'smashup', currentPlayer: '0', phase: 'playCards',
      player0: {
        hand: [{ uid: 'chacha', defId: cardId, type: 'action', owner: '0' }],
        deck: [], discard: [], factions: ['diy_killers', 'pirates'], minionsPlayed: 0,
        minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0,
      },
      player1: {
        hand: [], deck: [], discard: [], factions: ['ninjas', 'aliens'],
        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0,
      },
      bases: [
        { defId: 'base_the_factory', minions: [
          { uid: 'jason', defId: 'diy_killers_jason', owner: '0', controller: '0' },
        ] },
        { defId: 'base_the_mothership', minions: [
          { uid: 'target', defId: 'ninja_acolyte', owner: '1', controller: '1' },
        ] },
      ],
    });
    await game.playCard(cardId);
    await game.waitForInteraction(cardId, 10000);
    await page.locator('[data-minion-uid="jason"]').click();
    await game.waitForInteraction(`${cardId}_base`, 10000);
    await page.locator('[data-base-index="1"]').first().click();
    await game.waitForInteraction(`${cardId}_followup`, 10000);
    await page.getByRole('button', { name: /放到牌库顶/ }).first().click();
    await game.waitForInteraction('smashup_reaction_choose', 15000);
    await game.screenshot('01-预置代表态-杰森移动反应', testInfo);
    await page.locator('[data-minion-uid="jason"]').click();
    await game.waitForInteraction('diy_killers_jason_destroy', 10000);
    await page.locator('[data-minion-uid="target"]').click();
    await game.waitForNoInteraction(15000);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        jason: state.core.bases[1].minions.some((minion: { uid: string }) => minion.uid === 'jason'),
        target: state.core.players['1'].discard.some((card: { uid: string }) => card.uid === 'target'),
        deckTop: state.core.players['0'].deck[0]?.uid,
        interactionQueue: state.sys.interaction?.queue?.length ?? 0,
        triggerQueue: state.core.triggerQueue?.length ?? 0,
      };
    }, { timeout: 10000 }).toEqual({ jason: true, target: true, deckTop: 'chacha', interactionQueue: 0, triggerQueue: 0 });
  });

  test('预置代表态：唯一己方随从受藤蔓缠绕保护时可继续选择后续效果', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_killers,killer_plants', p1: 'pirates,aliens', skipFactionSelect: true,
      skipInitialization: false, seed: 20261120,
    }, 45000);
    await game.setupScene({
      gameId: 'smashup', currentPlayer: '0', phase: 'playCards',
      player0: {
        hand: [{ uid: 'chacha', defId: cardId, type: 'action', owner: '0' }],
        deck: [], discard: [], factions: ['diy_killers', 'killer_plants'], minionsPlayed: 0,
        minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0,
      },
      player1: {
        hand: [], deck: [], discard: [], factions: ['pirates', 'aliens'],
        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0,
      },
      bases: [
        { defId: 'base_the_factory', minions: [
          { uid: 'own', defId: 'diy_killers_jason', owner: '0', controller: '0' },
        ], ongoingActions: [{ uid: 'entangled', defId: 'killer_plant_entangled', ownerId: '0' }] },
        { defId: 'base_the_mothership', minions: [] },
      ],
    });
    await game.playCard(cardId);
    await game.waitForInteraction(`${cardId}_followup`, 10000);
    await expect(page.getByRole('button', { name: /^跳过$/ }).first()).toBeVisible();
    await page.waitForTimeout(1000);
    await game.screenshot('01-预置保护状态-选择可选后续', testInfo);
    await page.getByRole('button', { name: /^跳过$/ }).first().click();
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        ownAtBase: state.core.bases[0].minions.some((minion: { uid: string }) => minion.uid === 'own'),
        discarded: state.core.players['0'].discard.some((card: { uid: string }) => card.uid === 'chacha'),
        actionLimit: state.core.players['0'].actionLimit,
        queue: state.core.triggerQueue?.length ?? 0,
      };
    }, { timeout: 10000 }).toEqual({ ownAtBase: true, discarded: true, actionLimit: 1, queue: 0 });
  });

  for (const branch of [
    { name: '跳过', button: /^跳过$/, deckTop: false, actionLimit: 1 },
    { name: '回牌库顶', button: /放到牌库顶/, deckTop: true, actionLimit: 1 },
    { name: '额外行动', button: /打出一个额外行动/, deckTop: false, actionLimit: 2 },
  ]) {
    test(`预置代表态：真实打出、移动后选择${branch.name}`, async ({ page, game }, testInfo) => {
      test.setTimeout(120000);
      await setChineseLocale(page.context());
      await game.openTestGame('smashup', {
        p0: 'diy_killers,pirates', p1: 'ninjas,aliens', skipFactionSelect: true,
        skipInitialization: false, seed: 20261120,
      }, 45000);
      await game.setupScene({
        gameId: 'smashup', currentPlayer: '0', phase: 'playCards',
        player0: {
          hand: [{ uid: 'chacha', defId: cardId, type: 'action', owner: '0' }],
          deck: [{ uid: 'deck-top', defId: 'pirate_first_mate', type: 'minion', owner: '0' }],
          discard: [], factions: ['diy_killers', 'pirates'], minionsPlayed: 0,
          minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0,
        },
        player1: {
          hand: [], deck: [], discard: [], factions: ['ninjas', 'aliens'],
          minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0,
        },
        bases: [
          { defId: 'base_the_factory', minions: [
            { uid: 'own', defId: 'pirate_buccaneer', owner: '0', controller: '0' },
            { uid: 'enemy', defId: 'ninja_acolyte', owner: '1', controller: '1' },
          ] },
          { defId: 'base_the_mothership', minions: [] },
        ],
      });

      await game.playCard(cardId);
      await game.waitForInteraction(cardId, 10000);
      await expect(page.locator('[data-minion-uid="own"]')).toBeVisible();
      await game.screenshot('01-预置代表态-选择己方随从', testInfo);
      await page.locator('[data-minion-uid="own"]').click();
      await game.waitForInteraction(`${cardId}_base`, 10000);
      await game.screenshot('02-预置代表态-选择移动基地', testInfo);
      await page.locator('[data-base-index="1"]').first().click();
      await game.waitForInteraction(`${cardId}_followup`, 10000);
      await expect(page.getByRole('button', { name: branch.button }).first()).toBeVisible();
      await expect(page.locator('[data-base-index="1"]').first()).toHaveAttribute('data-selectable', 'false');
      // 等基地选择的退出动画结束，再记录可供判断的后续选择画面。
      await page.waitForTimeout(1000);
      await game.screenshot('03-预置代表态-选择后续效果', testInfo);
      await page.getByRole('button', { name: branch.button }).first().click();
      await game.waitForNoInteraction(10000);
      await expect.poll(async () => {
        const state = await game.getState();
        const player = state.core.players['0'];
        return {
          moved: state.core.bases[1].minions.some((minion: { uid: string }) => minion.uid === 'own'),
          oldBase: state.core.bases[0].minions.some((minion: { uid: string }) => minion.uid === 'own'),
          deckTop: player.deck[0]?.uid,
          discarded: player.discard.some((card: { uid: string }) => card.uid === 'chacha'),
          actionLimit: player.actionLimit,
          queue: state.core.triggerQueue?.length ?? 0,
        };
      }, { timeout: 10000 }).toEqual({
        moved: true, oldBase: false, deckTop: branch.deckTop ? 'chacha' : 'deck-top',
        discarded: !branch.deckTop, actionLimit: branch.actionLimit, queue: 0,
      });
      await game.screenshot('04-预置代表态-移动与后续效果结算', testInfo);
    });
  }
});
