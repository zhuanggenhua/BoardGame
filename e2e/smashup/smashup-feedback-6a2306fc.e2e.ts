import { test, expect } from './framework';
import { setChineseLocale } from './helpers/common';

test.describe('SmashUp 线上反馈 6a2306fc：附着战术不被后续随从遮挡', () => {
  test('同一基地后续玩家出随从后仍可悬停并点击前一随从的附着战术', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      extra: {
        core: {
          turnOrder: ['0', '1'],
          currentPlayerIndex: 0,
          turnNumber: 1,
          nextUid: 50,
          players: {
            '0': {
              id: '0',
              vp: 0,
              hand: [],
              deck: [],
              discard: [],
              factions: ['cyborg_apes', 'pirates'],
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
              factions: ['magical_girls', 'ghosts'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_rhodes_plaza',
              minions: [
                {
                  uid: 'host-minion',
                  defId: 'pirate_saucy_wench',
                  controller: '0',
                  owner: '0',
                  basePower: 3,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [
                    // 使用无天赋的附着战术，确保点击验证的是“看卡/命中”而不是发动天赋。
                    { uid: 'attached-tactic', defId: 'trickster_hideout', ownerId: '0', talentUsed: false },
                  ],
                },
                {
                  uid: 'covering-minion',
                  defId: 'magical_girls_power_maid',
                  controller: '1',
                  owner: '1',
                  basePower: 3,
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
            { defId: 'base_the_factory', minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_portal_room'],
          baseDiscard: [],
        },
      },
    });

    await game.waitForPhase('playCards', 10000);
    const host = page.locator('[data-minion-uid="host-minion"]');
    const attached = page.locator('[data-attached-action-uid="attached-tactic"]');
    await host.hover();
    await expect(attached).toBeVisible({ timeout: 5000 });
    await expect(attached).toBeEnabled({ timeout: 5000 });
    await attached.click();
    await expect(page.getByTestId('su-card-magnify-content')).toHaveAttribute('data-card-def-id', 'trickster_hideout');
    await game.screenshot('feedback-6a2306fc-attached-action-clickable', testInfo);
  });
});
