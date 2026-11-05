import { test, expect } from '../framework';
import { setChineseLocale } from '../helpers/common';

type InteractionOption = {
  id?: string;
  value?: unknown;
};

async function dispatchSmashUpCommand(
  page: any,
  type: string,
  payload: Record<string, unknown>,
  playerId = '0',
): Promise<void> {
  await page.evaluate(async ({ commandType, commandPayload, commandPlayerId }) => {
    const harness = (window as any).__BG_TEST_HARNESS__;
    await harness.command.dispatch({
      type: commandType,
      playerId: commandPlayerId,
      payload: commandPayload,
    });
  }, { commandType: type, commandPayload: payload, commandPlayerId: playerId });
  await page.waitForTimeout(300);
}

function optionValue(option: InteractionOption): Record<string, unknown> {
  return option.value && typeof option.value === 'object'
    ? option.value as Record<string, unknown>
    : {};
}

async function respondWithOptionIds(
  page: any,
  game: { getInteractionOptions: () => Promise<InteractionOption[]> },
  matchers: Array<(option: InteractionOption) => boolean>,
): Promise<void> {
  const options = await game.getInteractionOptions();
  const optionIds = matchers.map((matcher, index) => {
    const option = options.find(matcher);
    if (!option?.id) throw new Error(`相扑手交互选项 ${index + 1} 不存在`);
    return option.id;
  });
  await page.evaluate(async (ids) => {
    const harness = (window as any).__BG_TEST_HARNESS__;
    const current = harness?.state?.get?.()?.sys?.interaction?.current;
    if (!current?.playerId) throw new Error('当前没有可响应的相扑手交互');
    await harness.command.dispatch({
      type: 'SYS_INTERACTION_RESPOND',
      playerId: current.playerId,
      payload: { optionIds: ids },
    });
  }, optionIds);
  await page.waitForTimeout(300);
}

test.describe('大杀四方国际事件相扑手修复后真实入口审计', () => {
  test('身体猛击、关胁与相扑新人从真实入口完成选择和最终状态收口', async ({ page, game }) => {
    test.setTimeout(180000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      numPlayers: 3,
      skipInitialization: true,
      seed: 20260919,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'body-slam', defId: 'sumo_wrestlers_body_slam', type: 'action', owner: '0' }],
        factions: ['sumo_wrestlers', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      player2: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_the_dohyo',
          minions: [
            { uid: 'own-at-zero', defId: 'sumo_wrestlers_rookie_sumo', owner: '0', controller: '0', power: 2 },
            { uid: 'player-one-at-zero', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
          ],
        },
        {
          defId: 'base_heya_training_stable',
          minions: [
            { uid: 'own-at-one', defId: 'sumo_wrestlers_third_tier', owner: '0', controller: '0', power: 3 },
            { uid: 'player-two-at-one-a', defId: 'musketeers_young_musketeer', owner: '2', controller: '2', power: 3 },
            { uid: 'player-two-at-one-b', defId: 'musketeers_dartagnan', owner: '2', controller: '2', power: 4 },
          ],
        },
        { defId: 'base_the_dohyo', minions: [] },
      ],
    });

    await game.playCard('sumo_wrestlers_body_slam');
    await game.waitForInteraction('sumo_wrestlers_body_slam_player', 10000);
    await game.selectInteractionOptionBy(
      option => optionValue(option).targetPlayerId === '2',
      '身体猛击选择玩家三',
    );
    await game.waitForInteraction('sumo_wrestlers_body_slam_base', 10000);
    await game.selectInteractionOptionBy(
      option => optionValue(option).baseIndex === 1,
      '身体猛击选择第二座来源基地',
    );
    await game.waitForInteraction('sumo_wrestlers_body_slam_destination', 10000);
    await game.selectInteractionOptionBy(
      option => optionValue(option).baseIndex === 2,
      '身体猛击选择第三座目的基地',
    );
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        source: state.core.bases[1]?.minions.map((minion: { uid?: string }) => minion.uid),
        destination: state.core.bases[2]?.minions.map((minion: { uid?: string }) => minion.uid),
      };
    }, { timeout: 10000 }).toEqual({
      source: ['own-at-one'],
      destination: ['player-two-at-one-a', 'player-two-at-one-b'],
    });

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [],
        deck: [{ uid: 'third-tier-draw', defId: 'sumo_wrestlers_performance_prize', type: 'action', owner: '0' }],
        discard: [],
        factions: ['sumo_wrestlers', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      player2: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_the_dohyo',
          minions: [
            { uid: 'third-tier-source', defId: 'sumo_wrestlers_third_tier', owner: '0', controller: '0', power: 3 },
            { uid: 'third-tier-target', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
          ],
        },
        { defId: 'base_heya_training_stable', minions: [] },
        { defId: 'base_the_dohyo', minions: [] },
      ],
    });

    await dispatchSmashUpCommand(page, 'su:use_talent', { minionUid: 'third-tier-source', baseIndex: 0 });
    await game.waitForInteraction('sumo_wrestlers_third_tier', 10000);
    await game.selectInteractionOptionBy(
      option => optionValue(option).skip === true,
      '关胁跳过移动',
    );
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        hand: state.core.players['0']?.hand.map((card: { uid?: string }) => card.uid),
        source: state.core.bases[0]?.minions.map((minion: { uid?: string }) => minion.uid),
      };
    }, { timeout: 10000 }).toEqual({
      hand: [],
      source: ['third-tier-source', 'third-tier-target'],
    });

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [],
        deck: [{ uid: 'third-tier-draw-2', defId: 'sumo_wrestlers_performance_prize', type: 'action', owner: '0' }],
        discard: [],
        factions: ['sumo_wrestlers', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      player2: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_the_dohyo',
          minions: [
            { uid: 'third-tier-source-2', defId: 'sumo_wrestlers_third_tier', owner: '0', controller: '0', power: 3 },
            { uid: 'third-tier-target-2', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
          ],
        },
        { defId: 'base_heya_training_stable', minions: [] },
        { defId: 'base_the_dohyo', minions: [] },
      ],
    });

    await dispatchSmashUpCommand(page, 'su:use_talent', { minionUid: 'third-tier-source-2', baseIndex: 0 });
    await game.waitForInteraction('sumo_wrestlers_third_tier', 10000);
    await game.selectInteractionOptionBy(
      option => optionValue(option).minionUid === 'third-tier-target-2',
      '关胁选择对手随从',
    );
    await game.waitForInteraction('sumo_wrestlers_third_tier_destination', 10000);
    await game.selectInteractionOptionBy(
      option => optionValue(option).baseIndex === 2,
      '关胁选择第三座目的基地',
    );
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        hand: state.core.players['0']?.hand.map((card: { uid?: string }) => card.uid),
        source: state.core.bases[0]?.minions.map((minion: { uid?: string }) => minion.uid),
        destination: state.core.bases[2]?.minions.map((minion: { uid?: string }) => minion.uid),
      };
    }, { timeout: 10000 }).toEqual({
      hand: ['third-tier-draw-2'],
      source: ['third-tier-source-2'],
      destination: ['third-tier-target-2'],
    });

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'rookie-fodder', defId: 'sumo_wrestlers_chikara_mizu', type: 'action', owner: '0' }],
        discard: [],
        factions: ['sumo_wrestlers', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      player2: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [{
        defId: 'base_the_dohyo',
        minions: [
          { uid: 'rookie-sumo-a', defId: 'sumo_wrestlers_rookie_sumo', owner: '0', controller: '0', power: 2 },
          { uid: 'rookie-sumo-b', defId: 'musketeers_young_musketeer', owner: '0', controller: '0', power: 3 },
        ],
      }],
    });

    await dispatchSmashUpCommand(page, 'su:use_talent', { minionUid: 'rookie-sumo-a', baseIndex: 0 });
    await game.waitForInteraction('sumo_wrestlers_rookie_sumo_discard', 10000);
    await game.selectInteractionOptionBy(
      option => optionValue(option).skip === true,
      '相扑新人跳过弃牌',
    );
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      const minions = state.core.bases[0]?.minions ?? [];
      return {
        hand: state.core.players['0']?.hand.map((card: { uid?: string }) => card.uid),
        discard: state.core.players['0']?.discard.map((card: { uid?: string }) => card.uid),
        counters: minions.map((minion: { powerCounters?: number }) => minion.powerCounters ?? 0),
      };
    }, { timeout: 10000 }).toEqual({
      hand: ['rookie-fodder'],
      discard: [],
      counters: [0, 0],
    });
  });

  test('相扑手剩余行动牌真实入口覆盖抽牌、力量模式、行动摧毁与移动', async ({ page, game }, testInfo) => {
    test.setTimeout(180000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'sumo_wrestlers,musketeers',
      p1: 'mounties,luchadors',
      skipFactionSelect: true,
      seed: 20260920,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'performance', defId: 'sumo_wrestlers_performance_prize', type: 'action', owner: '0' }],
        deck: [
          { uid: 'performance-draw-a', defId: 'sumo_wrestlers_rookie_sumo', type: 'minion', owner: '0' },
          { uid: 'performance-draw-b', defId: 'sumo_wrestlers_chikara_mizu', type: 'action', owner: '0' },
          { uid: 'performance-draw-c', defId: 'sumo_wrestlers_grasp_the_belt', type: 'action', owner: '0' },
        ],
        factions: ['sumo_wrestlers', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [{
        defId: 'base_the_dohyo',
        minions: [{ uid: 'performance-anchor', defId: 'sumo_wrestlers_rookie_sumo', owner: '0', controller: '0', power: 2 }],
      }],
    });

    await game.playCard('sumo_wrestlers_performance_prize');
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        hand: state.core.players['0']?.hand.map((card: { uid?: string }) => card.uid),
        deck: state.core.players['0']?.deck.map((card: { uid?: string }) => card.uid),
      };
    }, { timeout: 10000 }).toEqual({
      hand: ['performance-draw-a', 'performance-draw-b', 'performance-draw-c'],
      deck: [],
    });
    await game.screenshot('相扑手-表演奖-抽牌后', testInfo);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'chikara-plus-two', defId: 'sumo_wrestlers_chikara_mizu', type: 'action', owner: '0' }],
        factions: ['sumo_wrestlers', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [{
        defId: 'base_the_dohyo',
        minions: [{ uid: 'chikara-plus-two-target', defId: 'sumo_wrestlers_rookie_sumo', owner: '0', controller: '0', power: 2 }],
      }],
    });

    await game.playCard('sumo_wrestlers_chikara_mizu');
    await game.waitForInteraction('sumo_wrestlers_chikara_mizu_target', 10000);
    await game.selectInteractionOptionBy(
      option => optionValue(option).minionUid === 'chikara-plus-two-target',
      '力量满溢选择 +2 目标',
    );
    await game.waitForInteraction('sumo_wrestlers_chikara_mizu_mode', 10000);
    await game.selectInteractionOptionBy(option => optionValue(option).mode === 'power2', '力量满溢选择 +2');
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return state.core.bases[0]?.minions[0]?.tempPowerModifier ?? 0;
    }, { timeout: 10000 }).toBe(2);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'chikara-plus-four', defId: 'sumo_wrestlers_chikara_mizu', type: 'action', owner: '0' },
          { uid: 'chikara-fodder', defId: 'sumo_wrestlers_performance_prize', type: 'action', owner: '0' },
        ],
        discard: [],
        factions: ['sumo_wrestlers', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [{
        defId: 'base_the_dohyo',
        minions: [{ uid: 'chikara-plus-four-target', defId: 'sumo_wrestlers_rookie_sumo', owner: '0', controller: '0', power: 2 }],
      }],
    });

    await game.playCard('sumo_wrestlers_chikara_mizu');
    await game.waitForInteraction('sumo_wrestlers_chikara_mizu_target', 10000);
    await game.selectInteractionOptionBy(
      option => optionValue(option).minionUid === 'chikara-plus-four-target',
      '力量满溢选择 +4 目标',
    );
    await game.waitForInteraction('sumo_wrestlers_chikara_mizu_mode', 10000);
    await game.selectInteractionOptionBy(option => optionValue(option).mode === 'discardPower4', '力量满溢选择弃牌 +4');
    await game.waitForInteraction('sumo_wrestlers_chikara_mizu_discard', 10000);
    await game.selectInteractionOptionBy(
      option => optionValue(option).cardUid === 'chikara-fodder',
      '力量满溢选择弃牌支付',
    );
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        modifier: state.core.bases[0]?.minions[0]?.tempPowerModifier ?? 0,
        discard: state.core.players['0']?.discard.map((card: { uid?: string }) => card.uid),
      };
    }, { timeout: 10000 }).toEqual({ modifier: 4, discard: ['chikara-plus-four', 'chikara-fodder'] });

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'head-butt', defId: 'sumo_wrestlers_head_butt', type: 'action', owner: '0' }],
        discard: [],
        factions: ['sumo_wrestlers', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [{
        defId: 'base_the_dohyo',
        minions: [
          { uid: 'head-butt-own', defId: 'sumo_wrestlers_rookie_sumo', owner: '0', controller: '0', power: 2 },
          {
            uid: 'head-butt-enemy',
            defId: 'musketeers_young_musketeer',
            owner: '1',
            controller: '1',
            power: 3,
            attachedActions: [{ uid: 'head-butt-action', defId: 'musketeers_all_for_one', ownerId: '1' }],
          },
        ],
      }],
    });

    await game.playCard('sumo_wrestlers_head_butt');
    await game.waitForInteraction('sumo_wrestlers_head_butt', 10000);
    await game.selectInteractionOptionBy(
      option => optionValue(option).cardUid === 'head-butt-action',
      '头槌选择敌方附着行动',
    );
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        attached: state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'head-butt-enemy')?.attachedActions ?? [],
        discard: state.core.players['1']?.discard.map((card: { uid?: string }) => card.uid),
      };
    }, { timeout: 10000 }).toEqual({ attached: [], discard: ['head-butt-action'] });

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'grasp', defId: 'sumo_wrestlers_grasp_the_belt', type: 'action', owner: '0' }],
        discard: [],
        factions: ['sumo_wrestlers', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [
        {
          defId: 'base_the_dohyo',
          minions: [
            { uid: 'grasp-own', defId: 'sumo_wrestlers_rookie_sumo', owner: '0', controller: '0', power: 2 },
            { uid: 'grasp-enemy', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
          ],
        },
        { defId: 'base_heya_training_stable', minions: [] },
      ],
    });

    await game.playCard('sumo_wrestlers_grasp_the_belt');
    await game.waitForInteraction('sumo_wrestlers_grasp_the_belt', 10000);
    await game.selectInteractionOptionBy(option => optionValue(option).minionUid === 'grasp-enemy', '抓住腰带选择敌方随从');
    await game.waitForInteraction('sumo_wrestlers_grasp_the_belt_destination', 10000);
    await game.selectInteractionOptionBy(option => optionValue(option).baseIndex === 1, '抓住腰带选择第二座基地');
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        source: state.core.bases[0]?.minions.map((minion: { uid?: string }) => minion.uid),
        destination: state.core.bases[1]?.minions.map((minion: { uid?: string }) => minion.uid),
      };
    }, { timeout: 10000 }).toEqual({ source: ['grasp-own'], destination: ['grasp-enemy'] });

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'technique', defId: 'sumo_wrestlers_technique_prize', type: 'action', owner: '0' }],
        discard: [],
        factions: ['sumo_wrestlers', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [{
        defId: 'base_the_dohyo',
        minions: [
          { uid: 'technique-target', defId: 'sumo_wrestlers_rookie_sumo', owner: '0', controller: '0', power: 2 },
          { uid: 'technique-other', defId: 'sumo_wrestlers_third_tier', owner: '0', controller: '0', power: 3 },
          { uid: 'technique-enemy', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
        ],
      }],
    });

    await game.playCard('sumo_wrestlers_technique_prize');
    await game.waitForInteraction('sumo_wrestlers_technique_prize', 10000);
    await game.selectInteractionOptionBy(
      option => optionValue(option).minionUid === 'technique-target',
      '技术奖选择己方随从',
    );
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return state.core.bases[0]?.minions.map((minion: { uid?: string; powerCounters?: number }) => ({
        uid: minion.uid,
        counters: minion.powerCounters ?? 0,
      }));
    }, { timeout: 10000 }).toEqual([
      { uid: 'technique-target', counters: 3 },
      { uid: 'technique-other', counters: 0 },
      { uid: 'technique-enemy', counters: 0 },
    ]);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'spirit', defId: 'sumo_wrestlers_fighting_spirit_prize', type: 'action', owner: '0' }],
        deck: [
          { uid: 'spirit-draw-a', defId: 'sumo_wrestlers_rookie_sumo', type: 'minion', owner: '0' },
          { uid: 'spirit-draw-b', defId: 'sumo_wrestlers_chikara_mizu', type: 'action', owner: '0' },
        ],
        discard: [],
        factions: ['sumo_wrestlers', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [{
        defId: 'base_the_dohyo',
        minions: [
          { uid: 'spirit-target-a', defId: 'sumo_wrestlers_rookie_sumo', owner: '0', controller: '0', power: 2 },
          { uid: 'spirit-target-b', defId: 'sumo_wrestlers_top_tier', owner: '0', controller: '0', power: 4 },
          { uid: 'spirit-enemy', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
        ],
      }],
    });

    await game.playCard('sumo_wrestlers_fighting_spirit_prize');
    await game.waitForInteraction('sumo_wrestlers_fighting_spirit_prize', 10000);
    await respondWithOptionIds(page, game, [
      option => optionValue(option).minionUid === 'spirit-target-a',
      option => optionValue(option).minionUid === 'spirit-target-b',
    ]);
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        hand: state.core.players['0']?.hand.map((card: { uid?: string }) => card.uid),
        deck: state.core.players['0']?.deck.map((card: { uid?: string }) => card.uid),
        counters: state.core.bases[0]?.minions.map((minion: { uid?: string; powerCounters?: number }) => ({
          uid: minion.uid,
          counters: minion.powerCounters ?? 0,
        })),
      };
    }, { timeout: 10000 }).toEqual({
      hand: ['spirit-draw-a', 'spirit-draw-b'],
      deck: [],
      counters: [
        { uid: 'spirit-target-a', counters: 1 },
        { uid: 'spirit-target-b', counters: 1 },
        { uid: 'spirit-enemy', counters: 0 },
      ],
    });
    await game.screenshot('相扑手-剩余行动牌-真实入口收口', testInfo);
  });

  test('横纲、大关与两座相扑基地从真实触发入口收口', async ({ page, game }, testInfo) => {
    test.setTimeout(180000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'sumo_wrestlers,musketeers',
      p1: 'mounties,luchadors',
      skipFactionSelect: true,
      seed: 20260921,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        deck: [{ uid: 'yokozuna-draw', defId: 'sumo_wrestlers_performance_prize', type: 'action', owner: '0' }],
        discard: [],
        factions: ['sumo_wrestlers', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [
        {
          defId: 'base_the_dohyo',
          minions: [
            { uid: 'yokozuna-draw-minion', defId: 'sumo_wrestlers_yokozuna', owner: '0', controller: '0', power: 6 },
            { uid: 'yokozuna-draw-enemy', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
          ],
        },
        { defId: 'base_heya_training_stable', minions: [] },
      ],
    });

    await dispatchSmashUpCommand(page, 'su:use_talent', { minionUid: 'yokozuna-draw-minion', baseIndex: 0 });
    await game.waitForInteraction('sumo_wrestlers_yokozuna_mode', 10000);
    await game.selectInteractionOptionBy(option => optionValue(option).mode === 'draw', '横纲选择抽牌');
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return state.core.players['0']?.hand.map((card: { uid?: string }) => card.uid);
    }, { timeout: 10000 }).toEqual(['yokozuna-draw']);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [],
        discard: [],
        factions: ['sumo_wrestlers', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [
        {
          defId: 'base_the_dohyo',
          minions: [
            { uid: 'yokozuna-move-minion', defId: 'sumo_wrestlers_yokozuna', owner: '0', controller: '0', power: 6 },
            { uid: 'yokozuna-enemy', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
          ],
        },
        { defId: 'base_heya_training_stable', minions: [] },
      ],
    });

    await dispatchSmashUpCommand(page, 'su:use_talent', { minionUid: 'yokozuna-move-minion', baseIndex: 0 });
    await game.waitForInteraction('sumo_wrestlers_yokozuna_mode', 10000);
    await game.selectInteractionOptionBy(option => optionValue(option).mode === 'move', '横纲选择移动');
    await game.waitForInteraction('sumo_wrestlers_yokozuna_move', 10000);
    await game.selectInteractionOptionBy(option => optionValue(option).minionUid === 'yokozuna-enemy', '横纲选择敌方随从');
    await game.waitForInteraction('sumo_wrestlers_yokozuna_move_destination', 10000);
    await game.selectInteractionOptionBy(option => optionValue(option).baseIndex === 1, '横纲选择第二座基地');
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return state.core.bases.slice(0, 2).map((base: { minions?: Array<{ uid?: string }> }) => base.minions?.map(minion => minion.uid));
    }, { timeout: 10000 }).toEqual([['yokozuna-move-minion'], ['yokozuna-enemy']]);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'top-tier-stew', defId: 'sumo_wrestlers_bulking_stew', type: 'action', owner: '0' },
          { uid: 'top-tier-fodder', defId: 'sumo_wrestlers_performance_prize', type: 'action', owner: '0' },
        ],
        discard: [],
        factions: ['sumo_wrestlers', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [{
        defId: 'base_the_dohyo',
        minions: [
          { uid: 'top-tier-passive', defId: 'sumo_wrestlers_top_tier', owner: '0', controller: '0', power: 4 },
          { uid: 'top-tier-target', defId: 'sumo_wrestlers_rookie_sumo', owner: '0', controller: '0', power: 2 },
        ],
      }],
    });

    await game.playCard('sumo_wrestlers_bulking_stew');
    await game.waitForInteraction('sumo_wrestlers_bulking_stew_discard', 10000);
    await game.selectInteractionOptionBy(option => optionValue(option).cardUid === 'top-tier-fodder', '大关选择手牌弃置');
    await game.waitForInteraction('sumo_wrestlers_bulking_stew_target', 10000);
    await game.selectInteractionOptionBy(option => optionValue(option).minionUid === 'top-tier-target', '炖肉选择目标随从');
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return state.core.bases[0]?.minions.map((minion: { uid?: string; powerCounters?: number }) => ({
        uid: minion.uid,
        counters: minion.powerCounters ?? 0,
      }));
    }, { timeout: 10000 }).toEqual([
      { uid: 'top-tier-passive', counters: 1 },
      { uid: 'top-tier-target', counters: 1 },
    ]);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '1',
      phase: 'endTurn',
      player0: {
        hand: [{ uid: 'heya-fodder', defId: 'sumo_wrestlers_performance_prize', type: 'action', owner: '0' }],
        discard: [],
        factions: ['sumo_wrestlers', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [{
        defId: 'base_heya_training_stable',
        minions: [{ uid: 'heya-sumo', defId: 'sumo_wrestlers_rookie_sumo', owner: '0', controller: '0', power: 2 }],
      }],
    });

    await dispatchSmashUpCommand(page, 'ADVANCE_PHASE', {}, '1');
    await game.waitForInteraction('base_heya_training_stable', 10000);
    await game.selectInteractionOptionBy(
      option => optionValue(option).cardUid === 'heya-fodder' && optionValue(option).minionUid === 'heya-sumo',
      '训练馆选择弃牌与目标随从',
    );
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        discard: state.core.players['0']?.discard.map((card: { uid?: string }) => card.uid),
        counters: state.core.bases[0]?.minions[0]?.powerCounters ?? 0,
      };
    }, { timeout: 10000 }).toEqual({ discard: ['heya-fodder'], counters: 1 });

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'dohyo-play', defId: 'sumo_wrestlers_rookie_sumo', type: 'minion', owner: '0' }],
        discard: [],
        factions: ['sumo_wrestlers', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [
        {
          defId: 'base_the_dohyo',
          minions: [{ uid: 'dohyo-enemy', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 }],
        },
        { defId: 'base_heya_training_stable', minions: [] },
      ],
    });

    await dispatchSmashUpCommand(page, 'su:play_minion', { cardUid: 'dohyo-play', baseIndex: 0 });
    await game.waitForInteraction('international_incident_base_move', 10000);
    await game.selectInteractionOptionBy(
      option => optionValue(option).minionUid === 'dohyo-enemy' && optionValue(option).toBaseIndex === 1,
      '土俵选择敌方随从移到第二座基地',
    );
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return state.core.bases.slice(0, 2).map((base: { minions?: Array<{ uid?: string }> }) => base.minions?.map(minion => minion.uid));
    }, { timeout: 10000 }).toEqual([['dohyo-play'], ['dohyo-enemy']]);
    await game.screenshot('相扑手-横纲大关基地-真实触发收口', testInfo);
  });
});
