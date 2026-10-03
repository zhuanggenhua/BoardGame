import { test, expect } from '../framework';
import type { Page } from '@playwright/test';

type InteractionOption = {
  id?: string;
  value?: {
    cardUid?: string;
    defId?: string;
    minionUid?: string;
    kind?: string;
    mode?: string;
    skip?: boolean;
  };
};

type SmashUpState = {
  sys?: {
    phase?: string;
    interaction?: {
      current?: {
        playerId?: string;
        data?: {
          sourceId?: string;
          options?: InteractionOption[];
        };
      };
    };
  };
  core: {
    players: Record<string, {
      hand: Array<{ uid: string; defId: string }>;
      deck: Array<{ uid: string; defId: string }>;
      discard: Array<{ uid: string; defId: string }>;
      storedCards?: Array<{
        uid: string;
        defId: string;
        storedUnderUid?: string;
        storedUnderDefId?: string;
      }>;
    }>;
    bases: Array<{
      ongoingActions: Array<{ uid: string; defId: string; talentUsed?: boolean }>;
      minions: Array<{
        uid: string;
        defId: string;
        owner?: string;
        controller?: string;
        tempPowerModifier?: number;
      }>;
    }>;
  };
};

async function getState(page: Page): Promise<SmashUpState> {
  return page.evaluate(() => {
    const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
    if (!state) throw new Error('Smash Up TestHarness state is unavailable');
    return state;
  });
}

async function useTalentFromBoard(page: Page, uid: string, sourceId: string): Promise<Record<string, unknown>> {
  const card = page.locator(`[data-minion-uid="${uid}"]`);
  await expect(card).toBeVisible({ timeout: 15000 });
  await card.click({ force: true });
  await page.waitForTimeout(300);

  const currentSource = await page.evaluate(() => (
    (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current?.data?.sourceId ?? null
  ));
  let directResult: unknown = null;
  if (currentSource !== sourceId) {
    directResult = await page.evaluate(async ({ minionUid }) => {
      const harness = (window as any).__BG_TEST_HARNESS__;
      return await harness.command.dispatch({
        type: 'su:activate_special',
        playerId: '0',
        payload: { minionUid, baseIndex: 0 },
      });
    }, { minionUid: uid });
    await page.waitForTimeout(300);
  }
  return {
    currentSource,
    directResult,
    state: await page.evaluate(() => {
      const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
      return {
        phase: state?.sys?.phase,
        interaction: state?.sys?.interaction?.current?.data?.sourceId ?? null,
        responseWindow: state?.sys?.responseWindow?.current?.windowType ?? null,
        funkman: state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'funkman-live') ?? null,
      };
    }),
  };
}

async function selectReactionBySourceDefId(page: Page, sourceDefId: string): Promise<void> {
  const optionId = await page.evaluate((expectedSourceDefId) => {
    const harness = (window as any).__BG_TEST_HARNESS__;
    const state = harness?.state?.get?.();
    const interaction = state?.sys?.interaction?.current;
    const triggerById = new Map(
      (state?.core?.triggerQueue ?? []).map((trigger: any) => [trigger.id, trigger]),
    );
    const option = (interaction?.data?.options ?? []).find((candidate: any) => (
      triggerById.get(candidate.value?.triggerId)?.sourceDefId === expectedSourceDefId
    ));
    return option?.id ?? null;
  }, sourceDefId);

  expect(optionId, `未找到 ${sourceDefId} 的反应选项`).not.toBeNull();
  await page.locator(`[data-option-id="${optionId}"]`).click({ force: true });
  await page.waitForTimeout(300);
}

test.describe('Smash Up 线上反馈真实入口复现', () => {
  test('古苏美尔神可以从弃牌堆选择留下买路钱并存到牌下', async ({ page, game }) => {
    test.setTimeout(120000);

    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        factions: ['wraithrustlers', 'tricksters'],
        hand: [],
        deck: [],
        discard: [
          { uid: 'pay-the-piper-discard', defId: 'trickster_pay_the_piper', type: 'action', owner: '0' },
        ],
          minionsPlayed: 0,
          minionLimit: 1,
          actionsPlayed: 0,
          actionLimit: 1,
      },
      player1: {
        factions: ['dragons', 'robots'],
        hand: [],
        deck: [],
        discard: [],
      },
      bases: [
        {
          defId: 'base_cave_of_shinies',
          minions: [],
          ongoingActions: [
            { uid: 'ancient-sumerian-god-live', defId: 'wraithrustlers_ancient_sumerian_god', ownerId: '0', talentUsed: false },
          ],
        },
        { defId: 'base_the_factory', minions: [], ongoingActions: [] },
      ],
    });

    await expect(page.locator('[data-ongoing-uid="ancient-sumerian-god-live"]')).toBeVisible({ timeout: 15000 });
    await expect.poll(async () => {
      const state = await getState(page);
      return {
        phase: state.sys?.phase,
        discard: state.core.players['0'].discard.map(card => card.defId),
      };
    }).toEqual({
      phase: 'playCards',
      discard: ['trickster_pay_the_piper'],
    });

    await page.locator('[data-ongoing-uid="ancient-sumerian-god-live"]').click({ force: true });
    await game.waitForInteraction('wraithrustlers_ancient_sumerian_god_store_action', 15000);

    const options = await game.getInteractionOptions() as InteractionOption[];
    expect(options.some(option => option.value?.cardUid === 'pay-the-piper-discard')).toBe(true);

    await game.selectInteractionOptionBy(
      option => option.value?.cardUid === 'pay-the-piper-discard',
      '选择留下买路钱',
    );
    await game.waitForNoInteraction(15000);

    await expect.poll(async () => {
      const state = await getState(page);
      const player = state.core.players['0'];
      return {
        discard: player.discard.map(card => card.defId),
        stored: (player.storedCards ?? []).map(card => ({
          defId: card.defId,
          storedUnderDefId: card.storedUnderDefId,
        })),
      };
    }).toEqual({
      discard: [],
      stored: [{
        defId: 'trickster_pay_the_piper',
        storedUnderDefId: 'wraithrustlers_ancient_sumerian_god',
      }],
    });
  });

  test('芬克曼移动古苏美尔神后，神牌下暂存的恶魔犬仍然保留', async ({ page, game }) => {
    test.setTimeout(120000);

    await game.openTestGame('smashup', {
      skipInitialization: true,
      playerID: '0',
      disableLocalAiAutomation: true,
    }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        factions: ['wraithrustlers', 'tricksters'],
        hand: [],
        deck: [],
        discard: [],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: {
        factions: ['dragons', 'robots'],
        hand: [],
        deck: [],
        discard: [],
      },
      bases: [
        {
          defId: 'base_cave_of_shinies',
          breakpoint: 1,
          minions: [
            {
              uid: 'funkman-live',
              defId: 'wraithrustlers_funkman',
              owner: '0',
              controller: '0',
              basePower: 30,
              talentUsed: false,
            },
          ],
          ongoingActions: [
            {
              uid: 'ancient-sumerian-god-live',
              defId: 'wraithrustlers_ancient_sumerian_god',
              ownerId: '0',
              talentUsed: false,
            },
          ],
        },
        { defId: 'base_the_factory', minions: [], ongoingActions: [] },
      ],
      extra: {
        core: {
          turnOrder: ['0', '1'],
          currentPlayerIndex: 0,
          turnNumber: 1,
          players: {
            '0': {
              storedCards: [
                {
                  uid: 'demon-dog-under-god',
                  defId: 'wraithrustlers_demon_dogs',
                  type: 'minion',
                  owner: '0',
                  storedByPlayerId: '0',
                  storedUnderUid: 'ancient-sumerian-god-live',
                  storedUnderDefId: 'wraithrustlers_ancient_sumerian_god',
                },
                {
                  uid: 'demon-dog-under-god-2',
                  defId: 'wraithrustlers_demon_dogs',
                  type: 'minion',
                  owner: '0',
                  storedByPlayerId: '0',
                  storedUnderUid: 'ancient-sumerian-god-live',
                  storedUnderDefId: 'wraithrustlers_ancient_sumerian_god',
                },
              ],
            },
          },
          bases: [
            {
              defId: 'base_cave_of_shinies',
              breakpoint: 1,
              minions: [
                {
                  uid: 'funkman-live',
                  defId: 'wraithrustlers_funkman',
                  owner: '0',
                  controller: '0',
                  basePower: 30,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
              ],
              ongoingActions: [
                {
                  uid: 'ancient-sumerian-god-live',
                  defId: 'wraithrustlers_ancient_sumerian_god',
                  ownerId: '0',
                  metadata: {},
                  talentUsed: false,
                },
              ],
            },
            {
              defId: 'base_the_factory',
              breakpoint: 25,
              minions: [],
              ongoingActions: [],
            },
          ],
        },
      },
    });

    await expect(page.getByTestId('su-end-turn-action-button')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('su-stored-under-ancient-sumerian-god-live'))
      .toHaveAttribute('data-stored-count', '2');
    await page.getByTestId('su-end-turn-action-button').click();

    await expect.poll(async () => {
      const state = await getState(page);
      const prompt = state.sys?.interaction?.current;
      return {
        sourceId: prompt?.data?.sourceId ?? null,
        playerId: prompt?.playerId ?? null,
        hasFunkmanOption: (prompt?.data?.options ?? []).some(option => (
          option.value?.kind === 'activate_special'
          && option.value?.minionUid === 'funkman-live'
        )),
      };
    }, {
      message: '结束回合后应先进入真实计分前响应，并暴露芬克曼特殊能力入口',
      timeout: 15000,
    }).toEqual({
      sourceId: 'smashup_reaction_choose',
      playerId: '0',
      hasFunkmanOption: true,
    });

    await game.selectInteractionOptionBy(
      option => (
        option.value?.kind === 'activate_special'
        && option.value?.minionUid === 'funkman-live'
      ),
      '计分前触发芬克曼',
    );
    await game.waitForInteraction('wraithrustlers_funkman', 15000);

    const options = await game.getInteractionOptions() as InteractionOption[];
    expect(options.some(option => (
      option.value?.cardUid === 'ancient-sumerian-god-live'
      && option.value?.targetBaseIndex === 1
    ))).toBe(true);

    await game.selectInteractionOptionBy(
      option => (
        option.value?.cardUid === 'ancient-sumerian-god-live'
        && option.value?.targetBaseIndex === 1
      ),
      '移动古苏美尔神到第二基地',
    );
    await game.waitForNoInteraction(15000);

    await expect.poll(async () => {
      const state = await getState(page);
      const player = state.core.players['0'];
      return {
        sourceActions: state.core.bases[0].ongoingActions.map(action => action.uid),
        targetActions: state.core.bases[1].ongoingActions.map(action => action.uid),
        stored: (player.storedCards ?? []).map(card => ({
          uid: card.uid,
          storedUnderUid: card.storedUnderUid,
          storedUnderDefId: card.storedUnderDefId,
        })),
      };
    }).toEqual({
      sourceActions: [],
      targetActions: ['ancient-sumerian-god-live'],
      stored: [
        {
          uid: 'demon-dog-under-god',
          storedUnderUid: 'ancient-sumerian-god-live',
          storedUnderDefId: 'wraithrustlers_ancient_sumerian_god',
        },
        {
          uid: 'demon-dog-under-god-2',
          storedUnderUid: 'ancient-sumerian-god-live',
          storedUnderDefId: 'wraithrustlers_ancient_sumerian_god',
        },
      ],
    });
    await expect(page.getByTestId('su-stored-under-ancient-sumerian-god-live'))
      .toHaveAttribute('data-stored-count', '2');
  });

  test('恶魔犬和古苏美尔神牌下的四张牌仍属于牌局，不是从游戏中删除', async ({ page, game }) => {
    test.setTimeout(120000);

    const visibleCards = Array.from({ length: 32 }, (_, index) => ({
      uid: `visible-card-${index}`,
      defId: 'trickster_hideout',
      type: 'action',
      owner: '0',
    }));

    await game.openTestGame('smashup', {
      skipInitialization: true,
      playerID: '0',
      disableLocalAiAutomation: true,
    }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        factions: ['wraithrustlers', 'tricksters'],
        hand: visibleCards.slice(0, 4),
        deck: visibleCards.slice(4, 24),
        discard: visibleCards.slice(24),
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: {
        factions: ['dragons', 'robots'],
        hand: [],
        deck: [],
        discard: [],
      },
      bases: [
        {
          defId: 'base_cave_of_shinies',
          minions: [
            { uid: 'demon-dogs-a', defId: 'wraithrustlers_demon_dogs', owner: '0', controller: '0', basePower: 2 },
            { uid: 'demon-dogs-b', defId: 'wraithrustlers_demon_dogs', owner: '0', controller: '0', basePower: 2 },
          ],
          ongoingActions: [
            { uid: 'ancient-god-count', defId: 'wraithrustlers_ancient_sumerian_god', ownerId: '0', talentUsed: false },
          ],
        },
        {
          defId: 'base_the_factory',
          minions: [{ uid: 'visible-minion', defId: 'trickster_gnome', owner: '0', controller: '0', basePower: 2 }],
          ongoingActions: [],
        },
      ],
      extra: {
        core: {
          players: {
            '0': {
              hand: visibleCards.slice(0, 4),
              deck: visibleCards.slice(4, 24),
              discard: visibleCards.slice(24),
              storedCards: [
                {
                  uid: 'stored-demon-dog-a',
                  defId: 'trickster_gnome',
                  type: 'minion',
                  owner: '0',
                  storedUnderUid: 'demon-dogs-a',
                  storedUnderDefId: 'wraithrustlers_demon_dogs',
                },
                {
                  uid: 'stored-demon-dog-b',
                  defId: 'trickster_gremlin',
                  type: 'minion',
                  owner: '0',
                  storedUnderUid: 'demon-dogs-b',
                  storedUnderDefId: 'wraithrustlers_demon_dogs',
                },
                {
                  uid: 'stored-god-a',
                  defId: 'trickster_pay_the_piper',
                  type: 'action',
                  owner: '0',
                  storedUnderUid: 'ancient-god-count',
                  storedUnderDefId: 'wraithrustlers_ancient_sumerian_god',
                },
                {
                  uid: 'stored-god-b',
                  defId: 'trickster_take_the_shinies',
                  type: 'action',
                  owner: '0',
                  storedUnderUid: 'ancient-god-count',
                  storedUnderDefId: 'wraithrustlers_ancient_sumerian_god',
                },
              ],
            },
          },
        },
      },
    });

    const state = await getState(page);
    const player = state.core.players['0'];
    const visibleCount = player.hand.length
      + player.deck.length
      + player.discard.length
      + state.core.bases.reduce((total, base) => total + base.minions.length + base.ongoingActions.length, 0);
    const stored = player.storedCards ?? [];

    expect(visibleCount).toBe(36);
    expect(stored).toHaveLength(4);
    expect(visibleCount + stored.length).toBe(40);
    expect(stored.map(card => card.defId).sort()).toEqual([
      'trickster_gnome',
      'trickster_gremlin',
      'trickster_pay_the_piper',
      'trickster_take_the_shinies',
    ]);
    await expect(page.getByTestId('su-stored-under-demon-dogs-a'))
      .toHaveAttribute('data-stored-count', '1');
    await expect(page.getByTestId('su-stored-under-demon-dogs-b'))
      .toHaveAttribute('data-stored-count', '1');
    await expect(page.getByTestId('su-stored-under-ancient-god-count'))
      .toHaveAttribute('data-stored-count', '2');
    await expect(page.locator('[data-stored-card-uid]')).toHaveCount(4);
  });

  test('反馈回归：爆破手真实入口移动后本回合不会再次循环移动', async ({ page, game }) => {
    test.setTimeout(120000);

    await game.openTestGame('smashup', { skipInitialization: true, playerID: '0' }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'scoreBases',
      randomQueue: [0.1, 0.1],
      player0: { factions: ['goblins', 'ninjas'], hand: [], deck: [], discard: [] },
      player1: { factions: ['pirates', 'ninjas'], hand: [], deck: [], discard: [] },
      bases: [
        {
          defId: 'base_goblin_town',
          minions: [{ uid: 'blaster-feedback-live', defId: 'goblins_blaster', owner: '0', controller: '0', basePower: 3 }],
          ongoingActions: [],
        },
        { defId: 'base_isis_swingin_pad', minions: [], ongoingActions: [] },
      ],
      extra: { core: { turnNumber: 14, scoringEligibleBaseIndices: [0, 1] } },
    });

    const dispatchBlaster = async (baseIndex: number, targetBaseIndex: number) => {
      await page.evaluate(async ({ baseIndex: currentBaseIndex, targetBaseIndex: destination }) => {
        await (window as any).__BG_TEST_HARNESS__?.command?.dispatch?.({
          type: 'su:activate_special',
          playerId: '0',
          payload: { minionUid: 'blaster-feedback-live', baseIndex: currentBaseIndex, targetBaseIndex: destination },
        });
      }, { baseIndex, targetBaseIndex });
      await page.waitForTimeout(300);
    };

    await dispatchBlaster(0, 1);
    await expect.poll(async () => {
      const state = await getState(page);
      return {
        base0: state.core.bases[0].minions.map(minion => minion.uid),
        base1: state.core.bases[1].minions.map(minion => minion.uid),
        usedTurn: state.core.bases[1].minions.find(minion => minion.uid === 'blaster-feedback-live')?.metadata?.goblinsBlasterUsedTurn ?? null,
      };
    }).toEqual({ base0: [], base1: ['blaster-feedback-live'], usedTurn: 14 });

    await dispatchBlaster(1, 0);
    await expect.poll(async () => {
      const state = await getState(page);
      return {
        base0: state.core.bases[0].minions.map(minion => minion.uid),
        base1: state.core.bases[1].minions.map(minion => minion.uid),
        usedTurn: state.core.bases[1].minions.find(minion => minion.uid === 'blaster-feedback-live')?.metadata?.goblinsBlasterUsedTurn ?? null,
      };
    }).toEqual({ base0: [], base1: ['blaster-feedback-live'], usedTurn: 14 });
  });

  test('反馈回归：摧毁恶魔犬后真实打出牌下暂存随从', async ({ page, game }) => {
    test.setTimeout(120000);

    await game.openTestGame('smashup', { skipInitialization: true, playerID: '0', disableLocalAiAutomation: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: { factions: ['wraithrustlers', 'tricksters'], hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1 },
      player1: { factions: ['dragons', 'robots'], hand: [], deck: [], discard: [] },
      bases: [{
        defId: 'base_the_jungle',
        minions: [{
          uid: 'accelerator-host-live',
          defId: 'wraithrustlers_roy',
          owner: '0',
          controller: '0',
          basePower: 3,
          attachedActions: [{ uid: 'accelerator-live', defId: 'wraithrustlers_unlicensed_nuclear_accelerator', ownerId: '0' }],
        }],
        ongoingActions: [{ uid: 'demon-dogs-live', defId: 'wraithrustlers_demon_dogs', ownerId: '0' }],
      }, { defId: 'base_the_factory', minions: [], ongoingActions: [] }],
      extra: { core: { players: { '0': { storedCards: [{ uid: 'stored-minion-live', defId: 'trickster_gremlin', type: 'minion', owner: '0', storedByPlayerId: '0', storedUnderUid: 'demon-dogs-live', storedUnderDefId: 'wraithrustlers_demon_dogs' }] } } } },
    });

    await page.evaluate(async () => {
      await (window as any).__BG_TEST_HARNESS__?.command?.dispatch?.({
        type: 'su:use_talent',
        playerId: '0',
        payload: { ongoingCardUid: 'accelerator-live', baseIndex: 0 },
      });
    });
    await game.waitForInteraction('wraithrustlers_unlicensed_nuclear_accelerator_destroy_action', 15000);
    await game.selectInteractionOptionBy(option => option.value?.cardUid === 'demon-dogs-live', '选择摧毁恶魔犬');
    await game.waitForInteraction('smashup_immediate_extra_minion', 15000);
    await game.selectInteractionOptionBy(option => option.value?.cardUid === 'stored-minion-live', '选择牌下暂存随从');
    await game.waitForInteraction('smashup_immediate_extra_minion_base', 15000);
    const baseOption = await game.getInteractionOptions() as InteractionOption[];
    const baseOptionId = baseOption.find(option => option.value?.baseIndex === 0)?.id ?? null;
    expect(baseOptionId).not.toBeNull();
    const base = page.locator('[data-base-index="0"]').first();
    if (await base.isVisible().catch(() => false)) {
      await base.click({ force: true });
    } else {
      await page.locator(`[data-option-id="${baseOptionId}"]`).click({ force: true });
    }
    await game.waitForNoInteraction(15000);

    await expect.poll(async () => {
      const state = await getState(page);
      return {
        baseMinions: state.core.bases[0].minions.map(minion => minion.uid),
        stored: (state.core.players['0'].storedCards ?? []).map(card => card.uid),
      };
    }).toEqual({ baseMinions: ['accelerator-host-live', 'stored-minion-live'], stored: [] });
  });

  test('图书馆怨灵被沃森摧毁后，真实入口抽三张牌', async ({ page, game }) => {
    test.setTimeout(120000);

    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        factions: ['wraithrustlers', 'tricksters'],
        hand: [
          { uid: 'watson-live', defId: 'wraithrustlers_watson', type: 'minion', owner: '0' },
        ],
        deck: [
          { uid: 'draw-1', defId: 'wraithrustlers_resurgence', type: 'action', owner: '0' },
          { uid: 'draw-2', defId: 'wraithrustlers_slimy', type: 'action', owner: '0' },
          { uid: 'draw-3', defId: 'wraithrustlers_demon_dogs', type: 'action', owner: '0' },
        ],
        discard: [],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: {
        factions: ['dragons', 'robots'],
        hand: [],
        deck: [],
        discard: [],
      },
      bases: [
        {
          defId: 'base_the_jungle',
          minions: [],
          ongoingActions: [
            { uid: 'librarian-live', defId: 'wraithrustlers_librarian_haunt', ownerId: '0' },
          ],
        },
        { defId: 'base_the_factory', minions: [], ongoingActions: [] },
      ],
    });

    await game.playCard('wraithrustlers_watson', { targetBaseIndex: 0 });
    await game.waitForInteraction('wraithrustlers_watson_choose_mode', 15000);
    await game.selectInteractionOptionBy(
      option => option.value?.mode === 'destroy',
      '沃森选择摧毁己方行动',
    );
    await game.waitForInteraction('wraithrustlers_watson_destroy_action', 15000);
    await game.selectInteractionOptionBy(
      option => option.value?.cardUid === 'librarian-live',
      '沃森选择摧毁图书馆怨灵',
    );
    await game.waitForNoInteraction(15000);

    await expect.poll(async () => {
      const state = await getState(page);
      const player = state.core.players['0'];
      return {
        hand: player.hand.map(card => card.uid),
        deck: player.deck.map(card => card.uid),
        ongoing: state.core.bases[0].ongoingActions.map(action => action.uid),
      };
    }).toEqual({
      hand: ['draw-1', 'draw-2', 'draw-3'],
      deck: [],
      ongoing: [],
    });
  });

  test('九头蛇特工在对手回合被摧毁后，控制者仍能真实打出额外随从', async ({ page, game }) => {
    test.setTimeout(120000);

    let controllerPage: Page | undefined;

    try {
      await game.openTestGame('smashup', { skipInitialization: true, playerID: '1' }, 45000);
      await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '1',
      phase: 'playCards',
      player0: {
        factions: ['hydra', 'kree'],
        hand: [
          { uid: 'extra-agent-live', defId: 'hydra_hydra_agent', type: 'minion', owner: '0' },
        ],
        deck: [],
        discard: [],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: {
        factions: ['tricksters', 'ninjas'],
        hand: [
          { uid: 'gnome-live', defId: 'trickster_gnome', type: 'minion', owner: '1' },
        ],
        deck: [],
        discard: [],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      bases: [
        {
          defId: 'base_juice_bar',
          minions: [
            { uid: 'hydra-agent-live', defId: 'hydra_hydra_agent', owner: '0', controller: '0', basePower: 2 },
            { uid: 'gnome-ally-a', defId: 'trickster_gremlin', owner: '1', controller: '1', basePower: 2 },
            { uid: 'gnome-ally-b', defId: 'trickster_brownie', owner: '1', controller: '1', basePower: 2 },
          ],
          ongoingActions: [],
        },
        { defId: 'base_the_factory', minions: [], ongoingActions: [] },
      ],
      });

    await expect.poll(async () => page.evaluate(() => {
      try {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return {
          currentPlayerIndex: state?.core?.currentPlayerIndex ?? null,
          phase: state?.sys?.phase ?? null,
          player1Hand: state?.core?.players?.['1']?.hand?.map((card: any) => card.uid) ?? [],
        };
      } catch {
        return { currentPlayerIndex: null, phase: null, player1Hand: [] };
      }
    })).toEqual({
      currentPlayerIndex: 1,
      phase: 'playCards',
      player1Hand: ['gnome-live'],
    });

    await game.playCard('trickster_gnome', { targetBaseIndex: 0 });
    const magnifyOverlay = page.getByTestId('su-card-magnify-overlay');
    if (await magnifyOverlay.isVisible().catch(() => false)) {
      await magnifyOverlay.click({ position: { x: 10, y: 10 }, force: true });
      await expect(magnifyOverlay).toBeHidden({ timeout: 1000 });
    }
    await expect.poll(async () => page.evaluate(() => (
      (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current?.data?.sourceId ?? null
    ))).toBe('smashup_immediate_extra_minion');
    const controllerSnapshot = await getState(page);

    controllerPage = await page.context().newPage();
    const controllerUrl = new URL(page.url());
    controllerUrl.searchParams.set('playerID', '0');
    await controllerPage.goto(controllerUrl.toString(), { waitUntil: 'domcontentloaded' });
    await controllerPage.waitForSelector('[data-testid="su-hand-area"]', { timeout: 20000 });
    await controllerPage.waitForFunction(
      () => {
        try {
          return Boolean((window as any).__BG_TEST_HARNESS__?.state?.get?.());
        } catch {
          return false;
        }
      },
      undefined,
      { timeout: 20000 },
    );
    // 侏儒摧毁已经完成；此处只把该正式快照同步到控制者页面，后续选择仍由控制者页面真实完成。
    await controllerPage.evaluate(async (snapshot) => {
      await (window as any).__BG_TEST_HARNESS__?.state?.set?.(snapshot);
    }, controllerSnapshot);
    await controllerPage.waitForFunction(
      () => (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current?.data?.sourceId
        === 'smashup_immediate_extra_minion',
      undefined,
      { timeout: 15000 },
    );
    const extraMinionOptionId = await controllerPage.evaluate(() => {
      const options = (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current?.data?.options ?? [];
      return options.find((option: any) => option?.value?.cardUid === 'extra-agent-live')?.id ?? null;
    });
    expect(extraMinionOptionId, '九头蛇控制者页面应显示额外随从选项').not.toBeNull();
    const extraMinionHandCard = controllerPage.locator('[data-card-uid="extra-agent-live"]');
    if (await extraMinionHandCard.isVisible().catch(() => false)) {
      await extraMinionHandCard.click({ force: true });
    } else {
      await controllerPage.locator(`[data-option-id="${extraMinionOptionId}"]`).click({ force: true });
    }

    await controllerPage.waitForFunction(
      () => (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current?.data?.sourceId
        === 'smashup_immediate_extra_minion_base',
      undefined,
      { timeout: 15000 },
    );
    const extraBaseOptionId = await controllerPage.evaluate(() => {
      const options = (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current?.data?.options ?? [];
      return options.find((option: any) => option?.value?.baseIndex === 0)?.id ?? null;
    });
    expect(extraBaseOptionId, '九头蛇控制者页面应显示原基地选项').not.toBeNull();
    const extraBase = controllerPage.locator('[data-base-index="0"]').first();
    if (await extraBase.isVisible().catch(() => false)) {
      await extraBase.click({ force: true });
    } else {
      await controllerPage.locator(`[data-option-id="${extraBaseOptionId}"]`).click({ force: true });
    }
    await controllerPage.waitForFunction(
      () => !(window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current,
      undefined,
      { timeout: 15000 },
    );

    await expect.poll(async () => {
      const state = await getState(controllerPage);
      return {
        baseMinions: state.core.bases[0].minions.map(minion => minion.uid),
        extraInHand: state.core.players['0'].hand.map(card => card.uid),
      };
    }).toEqual({
      baseMinions: ['gnome-ally-a', 'gnome-ally-b', 'gnome-live', 'extra-agent-live'],
      extraInHand: [],
    });
    } finally {
      await controllerPage?.close();
    }
  });

  test('驯鹿的心地比人好真实进入搜索流程，而不是给场上角色加两点力量', async ({ page, game }) => {
    test.setTimeout(120000);

    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        factions: ['frozen', 'munchkin_clerics'],
        hand: [
          { uid: 'reindeers-live', defId: 'frozen_reindeers_are_better_than_people', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'search-low-live', defId: 'frozen_snowgie', type: 'minion', owner: '0' },
          { uid: 'search-high-live', defId: 'frozen_anna', type: 'minion', owner: '0' },
        ],
        discard: [],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: {
        factions: ['pirates', 'ninjas'],
        hand: [],
        deck: [],
        discard: [],
      },
      bases: [
        {
          // 使用无角色打入后触发额外交互的基地，避免把基地自身效果误判成驯鹿搜索未收口。
          defId: 'base_halloween_town',
          minions: [
            { uid: 'anna-on-base', defId: 'frozen_anna', owner: '0', controller: '0', basePower: 4 },
          ],
          ongoingActions: [],
        },
        { defId: 'base_arendelle', minions: [], ongoingActions: [] },
      ],
    });

    await game.playCard('frozen_reindeers_are_better_than_people');
    await game.waitForInteraction('disney_four_factions_prompt', 15000);
    const searchOptions = await game.getInteractionOptions() as InteractionOption[];
    expect(searchOptions.some(option => option.value?.cardUid === 'search-low-live')).toBe(true);
    expect(searchOptions.some(option => option.value?.cardUid === 'search-high-live')).toBe(true);

    await game.selectInteractionOptionBy(
      option => option.value?.cardUid === 'search-low-live',
      '驯鹿搜索力量较低的角色',
    );
    await game.waitForInteraction('smashup_immediate_extra_minion', 15000);
    await game.selectInteractionOptionBy(
      option => option.value?.cardUid === 'search-low-live',
      '驯鹿选择被搜索角色作为额外随从',
    );
    await game.waitForInteraction('smashup_immediate_extra_minion_base', 15000);
    await game.selectInteractionOptionBy(
      option => option.value?.baseIndex === 0,
      '驯鹿选择第一基地',
    );
    await game.waitForNoInteraction(15000);

    await expect.poll(async () => {
      const state = await getState(page);
      const anna = state.core.bases[0].minions.find(minion => minion.uid === 'anna-on-base');
      return {
        minions: state.core.bases[0].minions.map(minion => minion.uid),
        annaTempPower: anna?.tempPowerModifier ?? 0,
        actionInDiscard: state.core.players['0'].discard.map(card => card.uid).includes('reindeers-live'),
      };
    }).toEqual({
      minions: ['anna-on-base', 'search-low-live'],
      annaTempPower: 0,
      actionInDiscard: true,
    });
  });

  test('抱头虫不会附着到当前力量5的佣兵', async ({ page, game }) => {
    test.setTimeout(90000);

    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        factions: ['extramorphs', 'super_spies'],
        hand: [{ uid: 'head-grabber-live', defId: 'extramorphs_head_grabber', type: 'action', owner: '0' }],
        deck: [],
        discard: [],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: {
        factions: ['goblins', 'ninjas'],
        hand: [],
        deck: [],
        discard: [],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      bases: [
        {
          defId: 'base_the_jungle',
          minions: [{
            uid: 'boosted-host-live',
            defId: 'goblins_gobbo',
            owner: '1',
            controller: '1',
            basePower: 2,
            powerCounters: 3,
          }],
          ongoingActions: [],
        },
        { defId: 'base_the_factory', minions: [], ongoingActions: [] },
      ],
    });

    await game.playCard('extramorphs_head_grabber', {
      targetBaseIndex: 0,
      targetMinionUid: 'boosted-host-live',
    });
    await page.waitForTimeout(1000);

    await expect.poll(async () => {
      const state = await game.getState();
      const host = state.core.bases[0].minions.find((minion: any) => minion.uid === 'boosted-host-live');
      return {
        headGrabberStillInHand: state.core.players['0'].hand.some((card: any) => card.uid === 'head-grabber-live'),
        attachedActions: host?.attachedActions?.map((action: any) => action.defId) ?? [],
      };
    }).toEqual({
      headGrabberStillInHand: true,
      attachedActions: [],
    });
  });

  test('贝儿弃掉魔法物品后，魔法物品能从弃牌堆作为额外随从打出', async ({ page, game }) => {
    test.setTimeout(120000);

    const fillerHand = Array.from({ length: 10 }, (_, index) => ({
      uid: `enchanted-filler-${index}`,
      defId: 'aladdin_wish',
      type: 'action',
      owner: '0',
    }));

    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        factions: ['beauty_and_the_beast', 'aladdin'],
        hand: [
          { uid: 'enchanted-object-live', defId: 'beauty_and_the_beast_enchanted_objects', type: 'minion', owner: '0' },
          ...fillerHand,
        ],
        deck: [],
        discard: [],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: {
        factions: ['pirates', 'ninjas'],
        hand: [],
        deck: [],
        discard: [],
      },
      bases: [
        {
          defId: 'base_agrabah_bazaar',
          minions: [{ uid: 'belle-live', defId: 'beauty_and_the_beast_belle', owner: '0', controller: '0', basePower: 4 }],
          ongoingActions: [],
        },
        { defId: 'base_halloween_town', minions: [], ongoingActions: [] },
      ],
    });

    await page.locator('[data-minion-uid="belle-live"]').click({ force: true });
    await game.waitForInteraction('beauty_and_the_beast_belle_talent', 15000);
    await game.selectInteractionOptionBy(
      option => option.value?.cardUid === 'enchanted-object-live',
      '贝儿弃掉魔法物品',
    );
    await game.waitForInteraction('smashup_reaction_choose', 15000);
    await selectReactionBySourceDefId(page, 'beauty_and_the_beast_enchanted_objects');
    await game.waitForInteraction('smashup_immediate_extra_minion', 15000);
    await game.selectInteractionOptionBy(
      option => option.value?.cardUid === 'enchanted-object-live',
      '魔法物品选择自身作为额外随从',
    );
    await game.waitForInteraction('smashup_immediate_extra_minion_base', 15000);
    await game.selectInteractionOptionBy(
      option => option.value?.baseIndex === 1,
      '魔法物品选择第二基地',
    );
    await game.waitForNoInteraction(15000);

    const state = await getState(page);
    expect(state.core.bases[1].minions.map(minion => minion.uid)).toContain('enchanted-object-live');
    expect(state.core.players['0'].discard.map(card => card.uid)).not.toContain('enchanted-object-live');
  });

  test('美女与野兽三张额外行动牌都能从弃牌堆继续完成真实效果', async ({ page, game }) => {
    test.setTimeout(180000);

    const runDiscardReaction = async (cardUid: string, defId: string) => {
      const fillerHand = Array.from({ length: 10 }, (_, index) => ({
        uid: `${cardUid}-filler-${index}`,
        defId: 'aladdin_wish',
        type: 'action',
        owner: '0',
      }));
      await game.openTestGame('smashup', { skipInitialization: true }, 45000);
      await game.setupScene({
        gameId: 'smashup',
        currentPlayer: '0',
        phase: 'playCards',
        player0: {
          factions: ['beauty_and_the_beast', 'aladdin'],
          hand: [{ uid: cardUid, defId, type: 'action', owner: '0' }, ...fillerHand],
          deck: defId === 'beauty_and_the_beast_discover_the_library'
            ? [
              { uid: `${cardUid}-draw-a`, defId: 'aladdin_wish', type: 'action', owner: '0' },
              { uid: `${cardUid}-draw-b`, defId: 'aladdin_wish', type: 'action', owner: '0' },
            ]
            : [],
          discard: [],
          minionsPlayed: 0,
          minionLimit: 1,
          actionsPlayed: 0,
          actionLimit: 2,
        },
        player1: {
          factions: ['pirates', 'ninjas'],
          hand: [],
          deck: [],
          discard: [],
        },
        bases: [
          {
            defId: 'base_agrabah_bazaar',
            minions: [{ uid: 'belle-talent-live', defId: 'beauty_and_the_beast_belle', owner: '0', controller: '0', basePower: 4 }],
            ongoingActions: [],
          },
          { defId: 'base_halloween_town', minions: [], ongoingActions: [] },
        ],
      });

      await page.locator('[data-minion-uid="belle-talent-live"]').click({ force: true });
      await game.waitForInteraction('beauty_and_the_beast_belle_talent', 15000);
      await game.selectInteractionOptionBy(option => option.value?.cardUid === cardUid, `贝儿弃掉 ${defId}`);
      await game.waitForInteraction('smashup_reaction_choose', 15000);
      await selectReactionBySourceDefId(page, defId);
      await game.waitForInteraction('smashup_immediate_extra_action', 15000);
      await game.selectInteractionOptionBy(option => option.value?.cardUid === cardUid, `选择 ${defId} 作为额外行动`);
      return { fillerHand, cardUid };
    };

    await runDiscardReaction('break-curse-live', 'beauty_and_the_beast_break_the_curse');
    await game.waitForInteraction('smashup_immediate_extra_action_base', 15000);
    await game.selectInteractionOptionBy(option => option.value?.baseIndex === 0, '打破诅咒选择第一基地');
    await game.waitForNoInteraction(15000);
    let state = await getState(page);
    expect(state.core.bases[0].minions.find(minion => minion.uid === 'belle-talent-live')?.tempPowerModifier).toBe(1);
    expect(state.core.players['0'].discard.map(card => card.uid)).toContain('break-curse-live');

    await runDiscardReaction('library-live', 'beauty_and_the_beast_discover_the_library');
    await game.waitForInteraction('beauty_and_the_beast_discard_hand', 15000);
    await game.selectInteractionOptionBy(option => option.value?.cardUid === 'library-live-filler-0', '图书馆弃掉一张手牌');
    await game.waitForNoInteraction(15000);
    state = await getState(page);
    expect(state.core.players['0'].hand.map(card => card.uid)).toContain('library-live-draw-a');
    expect(state.core.players['0'].hand.map(card => card.uid)).toContain('library-live-draw-b');
    expect(state.core.players['0'].discard.map(card => card.uid)).toContain('library-live');
  });

  test('冰雪奇缘的放手吧按文本完成抽取与牌库回收', async ({ page, game }) => {
    test.setTimeout(180000);

    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        factions: ['frozen', 'munchkin_clerics'],
        hand: [
          { uid: 'let-it-go-live', defId: 'frozen_let_it_go', type: 'action', owner: '0' },
          { uid: 'snowman-live', defId: 'frozen_do_you_want_to_build_a_snowman', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'deck-snowgie-live', defId: 'frozen_snowgie', type: 'minion', owner: '0' },
          { uid: 'deck-other-live', defId: 'frozen_olaf', type: 'minion', owner: '0' },
        ],
        discard: [
          { uid: 'discard-snowgie-live', defId: 'frozen_snowgie', type: 'minion', owner: '0' },
        ],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: {
        factions: ['pirates', 'ninjas'],
        hand: [],
        deck: [],
        discard: [],
      },
      bases: [
        {
          defId: 'base_arendelle',
          minions: [
            { uid: 'anna-target-live', defId: 'frozen_anna', owner: '0', controller: '0', basePower: 2 },
            { uid: 'olaf-target-live', defId: 'frozen_olaf', owner: '0', controller: '0', basePower: 3 },
          ],
          ongoingActions: [],
        },
      ],
    });

    await game.playCard('frozen_let_it_go');
    await game.waitForInteraction('disney_four_factions_prompt', 15000);
    await game.selectInteractionOptionBy(
      option => option.value?.cardUid === 'deck-other-live',
      '放手吧从牌库顶选择奥拉夫',
    );
    await expect.poll(async () => {
      const state = await getState(page);
      const player = state.core.players['0'];
      return {
        actionLimit: player.actionLimit,
        actionsPlayed: player.actionsPlayed,
      };
    }).toEqual({
      actionLimit: 1,
      actionsPlayed: 1,
    });
    const letItGoOverlay = page.getByTestId('su-card-magnify-overlay');
    if (await letItGoOverlay.isVisible().catch(() => false)) {
      await letItGoOverlay.click({ position: { x: 10, y: 10 }, force: true });
      await expect(letItGoOverlay).toBeHidden({ timeout: 1000 });
    }
    await game.waitForInteraction('disney_four_factions_prompt', 15000);
    await game.selectInteractionOptionBy(
      option => option.value?.cardUid === 'deck-snowgie-live',
      '放手吧把剩余雪宝放回牌库顶',
    );
    await game.waitForNoInteraction(15000);

    const state = await getState(page);
    expect(state.core.players['0'].hand.map(card => card.uid)).toContain('deck-other-live');
    expect(state.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-snowgie-live']);
    expect(state.core.players['0'].discard.map(card => card.uid)).toContain('let-it-go-live');
  });

  test('踢拳兄弟天赋后能真实打出牌下行动，并从暂存区进入弃牌堆', async ({ page, game }) => {
    test.setTimeout(120000);

    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        factions: ['action_heroes', 'pirates'],
        hand: [],
        deck: [],
        discard: [],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 1,
        actionLimit: 1,
      },
      player1: {
        factions: ['ninjas', 'aliens'],
        hand: [],
        deck: [],
        discard: [],
      },
      bases: [
        {
          defId: 'base_the_jungle',
          minions: [
            { uid: 'kickboxbro-live', defId: 'action_heroes_kickboxbro', owner: '0', controller: '0', basePower: 5 },
          ],
          ongoingActions: [],
        },
        { defId: 'base_the_factory', minions: [], ongoingActions: [] },
      ],
      extra: {
        core: {
          players: {
            '0': {
              storedCards: [{
                uid: 'stored-collateral-live',
                defId: 'action_heroes_collateral_damage',
                type: 'action',
                owner: '0',
                storedByPlayerId: '0',
                storedUnderUid: 'kickboxbro-live',
                storedUnderDefId: 'action_heroes_kickboxbro',
                reason: 'action_heroes_kickboxbro',
              }],
            },
          },
        },
      },
    });

    await expect(page.locator('[data-minion-uid="kickboxbro-live"]')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-minion-uid="kickboxbro-live"]').click({ force: true });
    await game.waitForInteraction('action_heroes_kickboxbro_play_stored', 15000);
    await game.selectInteractionOptionBy(
      option => option.value?.cardUid === 'stored-collateral-live',
      '踢拳兄弟选择牌下的抵押损失',
    );

    await game.waitForInteraction('smashup_immediate_extra_action', 15000);
    const extraActionOptions = await game.getInteractionOptions() as InteractionOption[];
    expect(extraActionOptions.some(option => option.value?.cardUid === 'stored-collateral-live')).toBe(true);
    await game.selectInteractionOptionBy(
      option => option.value?.cardUid === 'stored-collateral-live',
      '选择牌下行动作为额外行动',
    );
    await game.waitForInteraction('smashup_immediate_extra_action_base', 15000);
    await game.selectInteractionOptionBy(
      option => option.value?.baseIndex === 0,
      '抵押损失选择第一基地',
    );
    await game.waitForNoInteraction(15000);

    const state = await getState(page);
    expect(state.core.players['0'].storedCards ?? []).toEqual([]);
    expect(state.core.players['0'].discard.map(card => card.uid)).toContain('stored-collateral-live');
  });

  test('慢慢走开在真实计分后响应窗口把好市民回到拥有者手牌', async ({ page, game }) => {
    test.setTimeout(120000);

    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        factions: ['action_heroes', 'pirates'],
        hand: [
          { uid: 'walk-away-live', defId: 'action_heroes_walk_away_slowly', type: 'action', owner: '0' },
        ],
        deck: [],
        discard: [],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: {
        factions: ['ninjas', 'aliens'],
        hand: [],
        deck: [],
        discard: [],
      },
      bases: [
        {
          defId: 'base_the_jungle',
          breakpoint: 1,
          minions: [
            { uid: 'good-citizen-live', defId: 'action_heroes_commandbro', owner: '0', controller: '0', basePower: 13 },
            { uid: 'scoring-rival-live', defId: 'test_minion', owner: '1', controller: '1', basePower: 8 },
          ],
          ongoingActions: [],
        },
        { defId: 'base_the_factory', minions: [], ongoingActions: [] },
      ],
    });

    await expect(page.getByTestId('su-end-turn-action-button')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('su-end-turn-action-button').click();
    await game.waitForInteraction('smashup_reaction_choose', 20000);
    await game.playCard('action_heroes_walk_away_slowly', { targetBaseIndex: 0 });
    await game.waitForInteraction('action_heroes_walk_away_slowly', 15000);
    await game.selectInteractionOptionBy(
      option => option.value?.minionUid === 'good-citizen-live',
      '慢慢走开选择好市民',
    );
    await game.waitForNoInteraction(15000);

    await expect.poll(async () => {
      const state = await getState(page);
      return {
        hand: state.core.players['0'].hand.map(card => card.uid),
        baseMinions: state.core.bases.flatMap(base => base.minions.map(minion => minion.uid)),
      };
    }).toEqual({
      hand: expect.arrayContaining(['walk-away-live', 'good-citizen-live']),
      baseMinions: [],
    });
    await expect.poll(async () => {
      const state = await getState(page);
      return state.core.players['0'].hand.map(card => card.uid).sort();
    }).toEqual(['good-citizen-live', 'walk-away-live']);
  });
});
