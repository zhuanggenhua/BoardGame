import { test, expect } from './framework';
import { setChineseLocale } from './helpers/common';

test.describe('SmashUp Spirit of the Forest 真实入口审计', () => {
  test('Fairies OR 分支：Titania 在丛林之灵在场时会先执行已选分支，再给剩余分支与跳过', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      extra: {
        core: {
          enabledExpansions: ['titans'],
          turnOrder: ['0', '1'],
          currentPlayerIndex: 0,
          turnNumber: 1,
          nextUid: 1000,
          players: {
            '0': {
              id: '0',
              vp: 0,
              hand: [
                { uid: 'hand-titania', defId: 'fairies_titania', type: 'minion', owner: '0' },
              ],
              deck: [],
              discard: [],
              factions: ['fairies', 'robots'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [],
              deck: [],
              discard: [],
              factions: ['pirates', 'aliens'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_the_mothership',
              breakpoint: 21,
              minions: [
                {
                  uid: 'enemy-first-mate',
                  defId: 'pirate_first_mate',
                  controller: '1',
                  owner: '1',
                  basePower: 2,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
              ],
              ongoingActions: [],
            },
            {
              defId: 'base_tortuga',
              breakpoint: 21,
              minions: [],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_factory_436_1337'],
          baseDiscard: [],
          titans: [
            {
              uid: 'spirit-1',
              defId: 'fairies_spirit_of_the_forest',
              faction: 'fairies',
              ownerId: '0',
              controllerId: '0',
              powerCounters: 0,
              talentUsed: false,
              location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            },
          ],
        },
      },
    });

    await game.waitForPhase('playCards', 10000);
    await game.waitForCurrentPlayer('0', 10000);
    const initialState = await game.getState();

    await game.playCard('fairies_titania', { targetBaseIndex: 0 });
    await game.waitForInteraction('fairies_titania', 10000);

    const firstPrompt = await page.evaluate(() => {
      const harness = (window as any).__BG_TEST_HARNESS__;
      const current = harness?.state?.get?.()?.sys?.interaction?.current;
      return {
        sourceId: current?.data?.sourceId ?? null,
        optionLabels: (current?.data?.options ?? []).map((option: any) => option?.label ?? null),
      };
    });
    expect(firstPrompt.sourceId).toBe('fairies_titania');
    expect(firstPrompt.optionLabels).toEqual(expect.arrayContaining([
      '额外打出一个随从',
      '将一个随从移回其拥有者手牌',
    ]));
    await expect(page.getByTestId('su-end-turn-action-button')).toHaveCount(0);
    await expect(page.getByTestId('su-end-turn-hints')).toHaveCount(0);
    await expect(page.getByTestId('su-end-turn-visibility-toggle')).toHaveCount(0);
    await game.screenshot('fairies-spirit-branch-prompt-visible', testInfo);

    await page.getByRole('button', { name: /将一个随从移回其拥有者手牌/i }).click();
    await game.waitForInteraction('fairies_titania_return_minion', 10000);
    await expect(page.getByTestId('prompt-overlay')).toHaveCount(0);
    await expect(page.getByTestId('su-end-turn-action-button')).toHaveCount(0);
    await expect(page.getByTestId('su-end-turn-hints')).toHaveCount(0);
    await expect(page.getByTestId('su-end-turn-visibility-toggle')).toHaveCount(0);
    await expect(page.locator('[data-minion-uid="enemy-first-mate"]')).toBeVisible();
    await game.screenshot('fairies-spirit-return-target-visible', testInfo);

    await page.locator('[data-minion-uid="enemy-first-mate"]').click();
    await game.waitForInteraction('fairies_titania', 10000);

    const followUpPrompt = await page.evaluate(() => {
      const harness = (window as any).__BG_TEST_HARNESS__;
      const current = harness?.state?.get?.()?.sys?.interaction?.current;
      const state = harness?.state?.get?.();
      return {
        sourceId: current?.data?.sourceId ?? null,
        optionLabels: (current?.data?.options ?? []).map((option: any) => option?.label ?? null),
        spiritUsedTurn: state?.core?.titans?.find((titan: any) => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn ?? null,
      };
    });
    expect(followUpPrompt.sourceId).toBe('fairies_titania');
    expect(followUpPrompt.optionLabels).toEqual(expect.arrayContaining(['额外打出一个随从', '跳过']));
    expect(followUpPrompt.optionLabels).not.toEqual(expect.arrayContaining(['将一个随从移回其拥有者手牌']));
    expect(followUpPrompt.spiritUsedTurn).toBeNull();
    await expect(page.getByTestId('su-end-turn-action-button')).toHaveCount(0);
    await expect(page.getByTestId('su-end-turn-hints')).toHaveCount(0);
    await expect(page.getByTestId('su-end-turn-visibility-toggle')).toHaveCount(0);
    await game.screenshot('fairies-spirit-follow-up-prompt-visible', testInfo);

    await page.getByRole('button', { name: /额外打出一个随从/i }).click();
    await game.waitForNoInteraction(10000);

    const finalState = await game.getState();
    expect(finalState.core.bases[0].minions.some((minion: any) => minion.uid === 'hand-titania')).toBe(true);
    expect(finalState.core.bases[0].minions.some((minion: any) => minion.uid === 'enemy-first-mate')).toBe(false);
    expect(finalState.core.players['1'].hand.some((card: any) => card.uid === 'enemy-first-mate')).toBe(true);
    expect(finalState.core.players['0'].minionLimit).toBe(initialState.core.players['0'].minionLimit + 1);
    expect(finalState.core.titans?.find((titan: any) => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn).toBe(1);
    await expect(page.getByTestId('su-end-turn-action-button')).toBeVisible();
    await game.screenshot('fairies-spirit-sequential-resolved', testInfo);
  });
});
