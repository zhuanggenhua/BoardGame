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

function optionHasMinionUid(option: InteractionOption, minionUid: string): boolean {
  const value = option.value;
  return !!value && typeof value === 'object' && (value as { minionUid?: unknown }).minionUid === minionUid;
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
  test('大战怪物允许玩家选择回手行动并洗入其余所选牌', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { p0: 'luchadors,musketeers', p1: 'mounties,sumo_wrestlers', skipFactionSelect: true, seed: 20261128 }, 45000);
    await game.setupScene({
      gameId: 'smashup', currentPlayer: '0', phase: 'playCards',
      player0: {
        hand: [{ uid: 'monsters-source', defId: 'luchadors_senor_muchoslam_vs_the_monsters', type: 'action', owner: '0' }],
        deck: [{ uid: 'monsters-deck-a', defId: 'luchadors_yellow_demon', type: 'minion', owner: '0' }, { uid: 'monsters-deck-b', defId: 'luchadors_capa_roja', type: 'minion', owner: '0' }],
        discard: [
          { uid: 'monsters-quick', defId: 'luchadors_quick_set_up', type: 'action', owner: '0' },
          { uid: 'monsters-smart', defId: 'luchadors_smart_set_up', type: 'action', owner: '0' },
          { uid: 'monsters-standard', defId: 'musketeers_biding_time', type: 'action', owner: '0' },
        ], factions: ['luchadors', 'musketeers'], actionsPlayed: 0, actionLimit: 1,
      },
      player1: { hand: [], deck: [], discard: [], factions: ['mounties', 'sumo_wrestlers'] },
      bases: [{ defId: 'base_the_factory', minions: [] }],
    });
    await game.playCard('luchadors_senor_muchoslam_vs_the_monsters');
    await game.waitForInteraction('luchadors_senor_muchoslam_vs_the_monsters', 10000);
    const discardPanel = page.locator('[data-discard-view-panel]');
    await expect(discardPanel).toContainText('选择任意数量弃牌堆行动');
    for (const uid of ['monsters-quick', 'monsters-smart', 'monsters-standard']) {
      await discardPanel.locator(`[data-card-uid="${uid}"]`).click({ force: true });
    }
    await game.screenshot('大战怪物-选择三张弃牌', testInfo);
    await game.confirm();
    await game.waitForInteraction('luchadors_muchoslam_vs_monsters_recover', 10000);
    await expect(discardPanel).toContainText('选择一张可打在随从上的行动回手');
    const options = await game.getInteractionOptions();
    expect(options.some(option => optionHasCardUid(option, 'monsters-quick'))).toBe(true);
    expect(options.some(option => optionHasCardUid(option, 'monsters-smart'))).toBe(true);
    expect(options.some(option => optionHasCardUid(option, 'monsters-standard'))).toBe(false);
    await game.screenshot('大战怪物-选择回手行动', testInfo);
    await discardPanel.locator('[data-card-uid="monsters-smart"]').click({ force: true });
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const player = (await game.getState()).core.players['0'];
      return {
        hand: player.hand.map((card: { uid: string }) => card.uid).sort(),
        deck: player.deck.map((card: { uid: string }) => card.uid).sort(),
      };
    }).toEqual({ hand: ['monsters-smart'], deck: ['monsters-deck-a', 'monsters-deck-b', 'monsters-quick', 'monsters-standard'] });
    await game.screenshot('大战怪物-回手并洗入牌库', testInfo);
  });

  test('聪明 Set-Up 的宿主转为己方控制后仍可在首个随从打到此处时抽牌', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { p0: 'luchadors,musketeers', p1: 'mounties,sumo_wrestlers', skipFactionSelect: true, seed: 20261127 }, 45000);
    await game.setupScene({
      gameId: 'smashup', currentPlayer: '0', phase: 'playCards',
      player0: {
        hand: [{ uid: 'smart-new-minion', defId: 'musketeers_young_musketeer', type: 'minion', owner: '0' }],
        deck: [{ uid: 'smart-draw', defId: 'luchadors_tag_team', type: 'action', owner: '0' }],
        discard: [], factions: ['luchadors', 'musketeers'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
      },
      player1: { hand: [], deck: [], discard: [], factions: ['mounties', 'sumo_wrestlers'] },
      bases: [{ defId: 'base_the_factory', minions: [
        { uid: 'smart-host', defId: 'mounties_dudlee', owner: '1', controller: '0', power: 2, attachedActions: [{ uid: 'smart-attached', defId: 'luchadors_smart_set_up', ownerId: '0' }] },
      ] }],
    });
    await game.playCard('musketeers_young_musketeer', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => (await game.getState()).core.players['0'].hand.map((card: { uid: string }) => card.uid)).toContain('smart-draw');
    await game.screenshot('摔角手-己方控制宿主的聪明Set-Up触发抽牌', testInfo);
  });

  test('压制只能选择附着有自己行动的随从', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { p0: 'luchadors,sumo_wrestlers', p1: 'musketeers,mounties', skipFactionSelect: true, seed: 20261126 }, 45000);
    await game.setupScene({
      gameId: 'smashup', currentPlayer: '0', phase: 'playCards',
      player0: { hand: [{ uid: 'pin-hand', defId: 'luchadors_pin', type: 'action', owner: '0' }], deck: [], discard: [], factions: ['luchadors', 'sumo_wrestlers'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1 },
      player1: { hand: [], deck: [], discard: [], factions: ['musketeers', 'mounties'] },
      bases: [{ defId: 'base_the_factory', minions: [
        { uid: 'pin-legal', defId: 'mounties_dudlee', owner: '1', controller: '1', power: 3, attachedActions: [{ uid: 'pin-own-action', defId: 'luchadors_quick_set_up', ownerId: '0' }] },
        { uid: 'pin-no-action', defId: 'mounties_dudlee', owner: '1', controller: '1', power: 3 },
        { uid: 'pin-opponent-action', defId: 'mounties_northern_mover', owner: '1', controller: '1', power: 4, attachedActions: [{ uid: 'pin-enemy-action', defId: 'mounties_battle_moose', ownerId: '1' }] },
      ] }],
    });
    await page.locator('[data-card-uid="pin-hand"]').click();
    await expect(page.locator('[data-minion-uid="pin-legal"]')).toHaveAttribute('data-highlighted', 'true');
    await expect(page.locator('[data-minion-uid="pin-no-action"]')).not.toHaveAttribute('data-highlighted', 'true');
    await expect(page.locator('[data-minion-uid="pin-opponent-action"]')).not.toHaveAttribute('data-highlighted', 'true');
    await game.screenshot('摔角手-压制只高亮已有自己行动的随从', testInfo);
    await page.locator('[data-minion-uid="pin-legal"]').click({ force: true });
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      const target = state.core.bases[0].minions.find((minion: { uid: string }) => minion.uid === 'pin-legal');
      return target?.attachedActions.map((action: { uid: string }) => action.uid);
    }).toEqual(['pin-own-action', 'pin-hand']);
    await game.screenshot('摔角手-压制附着合法目标', testInfo);
  });

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
        minions: [{ uid: 'senor-host', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3, attachedActions: [{ uid: 'senor-existing', defId: 'luchadors_quick_set_up', ownerId: '0' }] }],
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
    await game.waitForInteraction('smashup_immediate_extra_action', 10000);
    const actionOptions = await game.getInteractionOptions();
    expect(actionOptions.some(option => optionHasCardUid(option, 'senor-pin'))).toBe(true);
    expect(actionOptions.some(option => optionHasCardUid(option, 'senor-recover'))).toBe(false);
    await game.screenshot('06-Muchoslam-天赋选择合法额外行动', testInfo);
    await page.locator('[data-card-uid="senor-pin"]').click({ force: true });
    await game.waitForInteraction('smashup_immediate_extra_action_minion', 10000);
    const targetOptions = await game.getInteractionOptions();
    expect(targetOptions.some(option => optionHasMinionUid(option, 'senor-host'))).toBe(true);
    expect(targetOptions.some(option => optionHasMinionUid(option, 'senor-muchoslam'))).toBe(false);
    await game.screenshot('06b-Muchoslam-天赋选择对方随从', testInfo);
    await page.locator('[data-minion-uid="senor-host"]').click({ force: true });
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
      attached: ['luchadors_quick_set_up', 'luchadors_pin'],
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
