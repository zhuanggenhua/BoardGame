import { test, expect } from '../framework';
import type { Page } from '@playwright/test';
import { setChineseLocale } from '../helpers/common';

type InteractionOption = {
  id?: string;
  value?: unknown;
};

function optionHasCardUid(option: InteractionOption, cardUid: string): boolean {
  const value = option.value;
  return !!value && typeof value === 'object' && (value as { cardUid?: unknown }).cardUid === cardUid;
}

async function dismissSpotlightIfPresent(page: Page): Promise<void> {
  const spotlightQueue = page.getByTestId('card-spotlight-queue');
  if (await spotlightQueue.isVisible({ timeout: 300 }).catch(() => false)) {
    await spotlightQueue.getByRole('button', { name: /^(关闭特写|Close spotlight)$/i }).click({ force: true });
    await page.waitForTimeout(200);
  }
}

async function expectCleanResolution(game: { getState: () => Promise<{ sys?: { interaction?: { current?: { data?: { sourceId?: string } } } }; core?: { triggerQueue?: unknown[] } }> }): Promise<void> {
  await expect.poll(async () => {
    const state = await game.getState();
    return {
      interactionSource: state.sys?.interaction?.current?.data?.sourceId ?? null,
      triggerQueueLength: state.core?.triggerQueue?.length ?? 0,
    };
  }, { timeout: 10000 }).toEqual({
    interactionSource: null,
    triggerQueueLength: 0,
  });
}

test.describe('大杀四方《环游世界：国际事件》摔角手对象级真实入口审计', () => {
  test('黄色恶魔从真实出牌入口在牌库与弃牌堆中选择 Set-Up 行动', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'yellow-demon', defId: 'luchadors_yellow_demon', type: 'minion', owner: '0' },
        ],
        deck: [
          { uid: 'yellow-deck-setup', defId: 'luchadors_powerful_set_up', type: 'action', owner: '0' },
          { uid: 'yellow-deck-invalid', defId: 'luchadors_tag_team', type: 'action', owner: '0' },
        ],
        discard: [
          { uid: 'yellow-discard-setup', defId: 'luchadors_smart_set_up', type: 'action', owner: '0' },
        ],
        factions: ['luchadors', 'mounties'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [{ defId: 'base_ringside', minions: [] }],
    });

    await game.screenshot('01-黄色恶魔-出牌前', testInfo);
    await game.playCard('luchadors_yellow_demon', { targetBaseIndex: 0 });
    await game.waitForInteraction('international_incident_base_move', 10000);

    const options = await game.getInteractionOptions();
    expect(options.some(option => optionHasCardUid(option, 'yellow-deck-setup'))).toBe(true);
    expect(options.some(option => optionHasCardUid(option, 'yellow-discard-setup'))).toBe(true);
    expect(options.some(option => optionHasCardUid(option, 'yellow-deck-invalid'))).toBe(false);
    await game.screenshot('02-黄色恶魔-牌库与弃牌堆候选', testInfo);

    await game.selectInteractionOptionBy(
      option => optionHasCardUid(option, 'yellow-discard-setup'),
      '黄色恶魔选择弃牌堆 Set-Up',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      const base = state.core.bases[0];
      return {
        minionUids: base?.minions.map((minion: { uid?: string }) => minion.uid) ?? [],
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        deckUids: player.deck.map((card: { uid?: string }) => card.uid),
        discardUids: player.discard.map((card: { uid?: string }) => card.uid),
      };
    }, { timeout: 10000 }).toEqual({
      minionUids: ['yellow-demon'],
      handUids: ['yellow-discard-setup'],
      deckUids: ['yellow-deck-setup', 'yellow-deck-invalid'],
      discardUids: [],
    });
    await expectCleanResolution(game);
    await game.screenshot('03-黄色恶魔-选择后进入手牌并清理', testInfo);
  });

  test('Muchoslam 先生的真实出牌与天赋入口都能回收并额外打出行动', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'senor-muchoslam', defId: 'luchadors_senor_muchoslam', type: 'minion', owner: '0' },
          { uid: 'senor-pin', defId: 'luchadors_pin', type: 'action', owner: '0' },
        ],
        discard: [
          { uid: 'senor-recover', defId: 'luchadors_tag_team', type: 'action', owner: '0' },
        ],
        factions: ['luchadors', 'mounties'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [{
        defId: 'base_ringside',
        minions: [{ uid: 'senor-host', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 }],
      }],
    });

    await game.screenshot('04-Muchoslam-出牌前', testInfo);
    await game.playCard('luchadors_senor_muchoslam', { targetBaseIndex: 0 });
    await game.waitForInteraction('luchadors_senor_muchoslam', 10000);
    await game.screenshot('05-Muchoslam-选择弃牌堆行动', testInfo);
    await game.selectInteractionOptionBy(
      option => optionHasCardUid(option, 'senor-recover'),
      'Muchoslam 先生回收弃牌堆行动',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        handUids: state.core.players['0']?.hand.map((card: { uid?: string }) => card.uid),
        discardUids: state.core.players['0']?.discard.map((card: { uid?: string }) => card.uid),
        minionTalentUsed: state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'senor-muchoslam')?.talentUsed ?? false,
      };
    }, { timeout: 10000 }).toEqual({
      handUids: ['senor-pin', 'senor-recover'],
      discardUids: [],
      minionTalentUsed: false,
    });

    await page.locator('[data-minion-uid="senor-muchoslam"]').click({ force: true });
    await page.waitForTimeout(300);
    await game.screenshot('06-Muchoslam-天赋入口获得额外行动', testInfo);
    await expect.poll(async () => {
      const state = await game.getState();
      const minion = state.core.bases[0]?.minions.find((entry: { uid?: string }) => entry.uid === 'senor-muchoslam');
      const player = state.core.players['0'];
      return {
        talentUsed: minion?.talentUsed ?? false,
        actionLimit: player?.actionLimit,
        actionsPlayed: player?.actionsPlayed,
      };
    }, { timeout: 10000 }).toEqual({ talentUsed: true, actionLimit: 2, actionsPlayed: 0 });

    await game.playCard('luchadors_pin', { targetMinionUid: 'senor-host' });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const host = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'senor-host');
      const player = state.core.players['0'];
      return {
        attached: host?.attachedActions.map((action: { defId?: string }) => action.defId) ?? [],
        actionsPlayed: player?.actionsPlayed,
        actionLimit: player?.actionLimit,
        discardUids: player?.discard.map((card: { uid?: string }) => card.uid) ?? [],
      };
    }, { timeout: 10000 }).toEqual({
      attached: ['luchadors_pin'],
      actionsPlayed: 1,
      actionLimit: 2,
      discardUids: [],
    });
    await expectCleanResolution(game);
    await game.screenshot('07-Muchoslam-额外行动附着后', testInfo);
  });

  test('点名出局真实入口返回己方行动并摧毁带行动的随从', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'out-count', defId: 'luchadors_out_for_the_count', type: 'action', owner: '0' }],
        factions: ['luchadors', 'mounties'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [{
        defId: 'base_ringside',
        minions: [{
          uid: 'out-target',
          defId: 'musketeers_young_musketeer',
          owner: '1',
          controller: '1',
          power: 3,
          attachedActions: [
            { uid: 'out-own-action', defId: 'luchadors_smart_set_up', ownerId: '0' },
            { uid: 'out-opponent-action', defId: 'musketeers_all_for_one', ownerId: '1' },
          ],
        }],
      }],
    });

    await game.screenshot('08-点名出局-出牌前', testInfo);
    await game.playCard('luchadors_out_for_the_count');
    await game.waitForInteraction('luchadors_out_for_the_count', 10000);
    await game.screenshot('09-点名出局-选择随从与己方行动', testInfo);
    await game.selectInteractionOptionBy(option => {
      const value = option.value;
      return !!value
        && typeof value === 'object'
        && (value as { minionUid?: unknown }).minionUid === 'out-target'
        && (value as { actionUid?: unknown }).actionUid === 'out-own-action';
    }, '点名出局选择目标与己方行动');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const base = state.core.bases[0];
      const player = state.core.players['0'];
      return {
        remainingMinionUids: base?.minions.map((minion: { uid?: string }) => minion.uid) ?? [],
        handUids: player?.hand.map((card: { uid?: string }) => card.uid) ?? [],
        discardUids: player?.discard.map((card: { uid?: string }) => card.uid) ?? [],
      };
    }, { timeout: 10000 }).toEqual({
      remainingMinionUids: [],
      handUids: ['out-own-action'],
      discardUids: ['out-count'],
    });
    await expectCleanResolution(game);
    await game.screenshot('10-点名出局-回收并摧毁后', testInfo);
  });

  test('强力 Set-Up 真实附着后只增强同基地的本方随从', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'powerful-setup', defId: 'luchadors_powerful_set_up', type: 'action', owner: '0' }],
        factions: ['luchadors', 'mounties'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [{
        defId: 'base_ringside',
        minions: [
          { uid: 'powerful-ally', defId: 'luchadors_yellow_demon', owner: '0', controller: '0', power: 2 },
          { uid: 'powerful-host', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
        ],
      }],
    });

    await game.playCard('luchadors_powerful_set_up', { targetMinionUid: 'powerful-host' });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect(page.getByTestId('su-minion-power-badge-powerful-ally')).toHaveAttribute('title', /强力 Set-Up: \+1/);
    await expect(page.getByTestId('su-minion-power-badge-powerful-host')).toHaveCount(0);
    await expect.poll(async () => {
      const state = await game.getState();
      const host = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'powerful-host');
      return host?.attachedActions.map((action: { defId?: string }) => action.defId) ?? [];
    }, { timeout: 10000 }).toEqual(['luchadors_powerful_set_up']);
    await expectCleanResolution(game);
    await game.screenshot('11-强力Set-Up-附着与本方加力后', testInfo);
  });

  test('Flor Loca 真实出牌后读取对手随从上的己方行动并获得持续加力', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'flor-loca', defId: 'luchadors_flor_loca', type: 'minion', owner: '0' }],
        factions: ['luchadors', 'mounties'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [{
        defId: 'base_ringside',
        minions: [{
          uid: 'flor-opponent-host',
          defId: 'musketeers_young_musketeer',
          owner: '1',
          controller: '1',
          power: 3,
          attachedActions: [{ uid: 'flor-owned-action', defId: 'luchadors_smart_set_up', ownerId: '0' }],
        }],
      }],
    });

    await game.playCard('luchadors_flor_loca', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect(page.getByTestId('su-minion-power-badge-flor-loca')).toHaveAttribute('title', /Flor Loca: \+2/);
    await expect.poll(async () => {
      const state = await game.getState();
      const flor = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'flor-loca');
      const host = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'flor-opponent-host');
      return {
        florPower: flor?.basePower,
        hostAttached: host?.attachedActions.map((action: { uid?: string }) => action.uid) ?? [],
      };
    }, { timeout: 10000 }).toEqual({
      florPower: 3,
      hostAttached: ['flor-owned-action'],
    });
    await expectCleanResolution(game);
    await game.screenshot('12-Flor-Loca-持续加力后', testInfo);
  });
});
