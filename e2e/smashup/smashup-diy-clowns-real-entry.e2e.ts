import { test, expect } from '../framework';
import type { Page } from '@playwright/test';
import { setChineseLocale } from '../helpers/common';

async function dismissSpotlightIfPresent(page: Page): Promise<void> {
  const spotlightQueue = page.getByTestId('card-spotlight-queue');
  if (await spotlightQueue.isVisible({ timeout: 300 }).catch(() => false)) {
    await spotlightQueue.getByRole('button', { name: /^(关闭特写|Close spotlight)$/i }).click({ force: true });
    await page.waitForTimeout(200);
  }
}

async function dismissRevealIfPresent(page: Page): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    const dismissButton = page.getByTestId('reveal-dismiss-btn');
    if (!await dismissButton.isVisible({ timeout: 1500 }).catch(() => false)) break;
    await dismissButton.click({ force: true });
    await page.waitForTimeout(300);
  }
}

test.describe('大杀四方小丑真实入口审计', () => {
  test('派系详情页显示小丑卡牌与图集', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'factionSelect',
      extra: {
        core: {
          turnOrder: ['0', '1'],
          currentPlayerIndex: 0,
          turnNumber: 1,
          nextUid: 1000,
          players: {
            '0': { id: '0', vp: 0, hand: [], deck: [], discard: [], factions: ['aliens', 'pirates'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1 },
            '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], factions: ['ninjas', 'robots'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1 },
          },
          factionSelection: {
            takenFactions: [],
            playerSelections: { '0': [], '1': [] },
            completedPlayers: [],
          },
        },
      },
    });

    const search = page.getByTestId('faction-search-input');
    await search.fill('diy_clowns');
    const option = page.getByTestId('faction-option-diy_clowns');
    await expect(option).toBeVisible({ timeout: 15000 });
    await option.click();

    const detail = page.getByTestId('faction-detail-panel');
    await expect(detail).toBeVisible({ timeout: 10000 });
    await expect(detail.getByRole('heading', { name: '小丑' })).toBeVisible();
    await expect(detail.getByText('麦当劳小丑').first()).toBeVisible();
    await expect(detail.getByText('小丑金字塔').first()).toBeVisible();
    await expect(detail.locator('.atlas-shimmer')).toHaveCount(0);
    await game.screenshot('01-小丑-派系详情与图集', testInfo);
  });

  test('滑稽小丑从真实弃牌堆入口用通常行动打出标准行动并放回牌库底', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_clowns,aliens',
      p1: 'pirates,ninjas',
      seat1: 'human',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260918,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [],
        deck: [{ uid: 'slapstick-deck-tail', defId: 'diy_clowns_clown_girl', type: 'minion', owner: '0' }],
        discard: [{ uid: 'slapstick-discard', defId: 'diy_clowns_confetti_bucket', type: 'action', owner: '0' }],
        field: [{ uid: 'slapstick-source', defId: 'diy_clowns_slapstick_clown', baseIndex: 0, owner: '0', controller: '0', power: 5 }],
        factions: ['diy_clowns', 'aliens'],
        minionsPlayed: 1,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: { hand: [], deck: [], discard: [], factions: ['pirates', 'ninjas'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0 },
      bases: [
        { defId: 'base_the_factory', minions: [{ uid: 'slapstick-source', defId: 'diy_clowns_slapstick_clown', owner: '0', controller: '0', power: 5 }] },
        { defId: 'base_the_homeworld', minions: [] },
      ],
    });

    await page.getByTestId('su-discard-toggle').click();
    const discardPanel = page.locator('[data-discard-view-panel]');
    await expect(discardPanel).toBeVisible({ timeout: 10000 });
    await expect(discardPanel.locator('[data-card-uid="slapstick-discard"]')).toBeVisible({ timeout: 10000 });
    await game.screenshot('02-小丑-滑稽小丑弃牌堆标准行动入口', testInfo);

    await discardPanel.locator('[data-card-uid="slapstick-discard"]').click({ force: true });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        hand: player?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        discard: player?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        deck: player?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        actionsPlayed: player?.actionsPlayed,
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      hand: [],
      discard: [],
      deck: ['slapstick-deck-tail', 'slapstick-discard'],
      actionsPlayed: 1,
      interactionOpen: false,
    });
    await game.screenshot('03-小丑-滑稽小丑通常行动与牌库底收口', testInfo);
  });

  test('沉默小丑从真实弃牌堆入口在无通常行动额度时额外打出标准行动', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_clowns,aliens',
      p1: 'pirates,ninjas',
      seat1: 'human',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260918,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [],
        deck: [{ uid: 'silent-deck-tail', defId: 'diy_clowns_clown_girl', type: 'minion', owner: '0' }],
        discard: [{ uid: 'silent-discard', defId: 'diy_clowns_confetti_bucket', type: 'action', owner: '0' }],
        field: [{ uid: 'silent-source', defId: 'diy_clowns_silent_clown', baseIndex: 0, owner: '0', controller: '0', power: 3 }],
        factions: ['diy_clowns', 'aliens'],
        minionsPlayed: 1,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 0,
        vp: 0,
      },
      player1: { hand: [], deck: [], discard: [], factions: ['pirates', 'ninjas'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0 },
      bases: [
        { defId: 'base_the_factory', minions: [{ uid: 'silent-source', defId: 'diy_clowns_silent_clown', owner: '0', controller: '0', power: 3 }] },
        { defId: 'base_the_homeworld', minions: [] },
      ],
    });

    await page.getByTestId('su-discard-toggle').click();
    const discardPanel = page.locator('[data-discard-view-panel]');
    await expect(discardPanel).toBeVisible({ timeout: 10000 });
    await expect(discardPanel.locator('[data-card-uid="silent-discard"]')).toBeVisible({ timeout: 10000 });
    await game.screenshot('04-小丑-沉默小丑无通常额度的弃牌堆入口', testInfo);

    await discardPanel.locator('[data-card-uid="silent-discard"]').click({ force: true });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        hand: player?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        discard: player?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        deck: player?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        actionsPlayed: player?.actionsPlayed,
        actionLimit: player?.actionLimit,
        usedDiscardPlayAbilities: player?.usedDiscardPlayAbilities ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      hand: [],
      discard: [],
      deck: ['silent-deck-tail', 'silent-discard'],
      actionsPlayed: 0,
      actionLimit: 0,
      usedDiscardPlayAbilities: ['diy_clowns_silent_clown:silent-source'],
      interactionOpen: false,
    });
    await game.screenshot('05-小丑-沉默小丑额外行动与牌库底收口', testInfo);
  });

  test('跳舞小丑从真实天赋入口随机选择标准行动并确认额外打出', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_clowns,aliens',
      p1: 'pirates,ninjas',
      seat1: 'human',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260918,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [],
        deck: [{ uid: 'dancing-deck-tail', defId: 'diy_clowns_clown_girl', type: 'minion', owner: '0' }],
        discard: [
          { uid: 'dancing-action-a', defId: 'diy_clowns_confetti_bucket', type: 'action', owner: '0' },
          { uid: 'dancing-action-b', defId: 'diy_clowns_confetti_bucket', type: 'action', owner: '0' },
        ],
        field: [{ uid: 'dancing-source', defId: 'diy_clowns_dancing_clown', baseIndex: 0, owner: '0', controller: '0', power: 4 }],
        factions: ['diy_clowns', 'aliens'],
        minionsPlayed: 1,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: { hand: [], deck: [], discard: [], factions: ['pirates', 'ninjas'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0 },
      bases: [
        { defId: 'base_the_factory', minions: [{ uid: 'dancing-source', defId: 'diy_clowns_dancing_clown', owner: '0', controller: '0', power: 4 }] },
        { defId: 'base_the_homeworld', minions: [] },
      ],
    });

    await page.locator('[data-minion-uid="dancing-source"]').first().click({ force: true });
    await game.waitForInteraction('diy_clowns_dancing_clown', 10000);
    const discardPanel = page.locator('[data-discard-view-panel]');
    await expect(discardPanel).toBeVisible({ timeout: 10000 });

    const prompted = await game.getState();
    const prompt = prompted.sys?.interaction?.current;
    const pickedActionUid = prompt?.data?.options?.find((option: any) => option.value?.cardUid)?.value?.cardUid;
    expect(prompt?.data?.sourceId).toBe('diy_clowns_dancing_clown');
    expect(['dancing-action-a', 'dancing-action-b']).toContain(pickedActionUid);
    expect(prompt?.data?.options?.some((option: any) => option.value?.skip === true)).toBe(true);
    await expect(discardPanel.locator(`[data-card-uid="${pickedActionUid}"]`)).toBeVisible({ timeout: 10000 });
    await game.screenshot('06-小丑-跳舞小丑随机行动确认', testInfo);

    await game.selectInteractionOptionBy(
      option => option.value?.cardUid === pickedActionUid,
      '跳舞小丑确认随机行动',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      const dancing = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'dancing-source');
      return {
        hand: player?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        discard: player?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        deck: player?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        actionsPlayed: player?.actionsPlayed,
        talentUsed: dancing?.talentUsed,
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      hand: [],
      discard: [pickedActionUid === 'dancing-action-a' ? 'dancing-action-b' : 'dancing-action-a'],
      deck: ['dancing-deck-tail', pickedActionUid],
      actionsPlayed: 0,
      talentUsed: true,
      interactionOpen: false,
    });
    await game.screenshot('07-小丑-跳舞小丑额外行动与牌库底收口', testInfo);
  });

  test('小丑学院从真实打出随从入口可选回收标准行动且同回合只触发一次', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_clowns,aliens',
      p1: 'pirates,ninjas',
      seat1: 'human',
      disableLocalAiAutomation: true,
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260918,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'academy-minion-1', defId: 'diy_clowns_silent_clown', type: 'minion', owner: '0' },
          { uid: 'academy-minion-2', defId: 'diy_clowns_clown_girl', type: 'minion', owner: '0' },
        ],
        deck: [],
        discard: [
          { uid: 'academy-action-a', defId: 'diy_clowns_colorful_scarf', type: 'action', owner: '0' },
          { uid: 'academy-action-b', defId: 'diy_clowns_confetti_bucket', type: 'action', owner: '0' },
          { uid: 'academy-discard-minion', defId: 'diy_clowns_mrs_clown', type: 'minion', owner: '0' },
        ],
        factions: ['diy_clowns', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 2,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: { hand: [], deck: [], discard: [], factions: ['pirates', 'ninjas'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0 },
      bases: [
        { defId: 'base_diy_clowns_clown_academy', minions: [] },
        { defId: 'base_the_factory', minions: [] },
      ],
    });

    await game.playCard('diy_clowns_silent_clown', { targetBaseIndex: 0 });
    await game.waitForInteraction('smashup_reaction_choose', 10000);

    const reactionState = await game.getState();
    const academyTrigger = (reactionState.core.triggerQueue ?? []).find((trigger: any) =>
      trigger.sourceDefId === 'base_diy_clowns_clown_academy',
    );
    expect(academyTrigger, '第一次打入随从后应进入小丑学院可选响应').toBeTruthy();
    const reactionOptions = await game.getInteractionOptions();
    expect(reactionOptions.some(option => option.value?.triggerId === academyTrigger.id)).toBe(true);
    expect(reactionOptions.some(option => option.value?.kind === 'pass')).toBe(true);
    await game.screenshot('01-小丑-小丑学院第一次打入后的可选响应', testInfo);

    await game.selectInteractionOptionBy(
      option => option.value?.triggerId === academyTrigger.id,
      '接受小丑学院回收标准行动',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return Boolean(player?.hand?.some((card: { uid?: string }) => card.uid === 'academy-action-a' || card.uid === 'academy-action-b'));
    }, { timeout: 10000 }).toBe(true);
    const acceptedState = await game.getState();
    const acceptedPlayer = acceptedState.core.players['0'];
    const acceptedHand = acceptedPlayer?.hand?.map((card: { uid?: string }) => card.uid) ?? [];
    const acceptedDiscard = acceptedPlayer?.discard?.map((card: { uid?: string }) => card.uid) ?? [];
    expect(acceptedHand.filter((uid: string) => uid === 'academy-action-a' || uid === 'academy-action-b')).toHaveLength(1);
    expect(acceptedDiscard.filter((uid: string) => uid === 'academy-action-a' || uid === 'academy-action-b')).toHaveLength(1);
    expect(acceptedDiscard).toContain('academy-discard-minion');
    expect(acceptedState.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid)).toContain('academy-minion-1');
    expect(acceptedState.core.triggerQueue ?? []).toEqual([]);
    expect(acceptedState.sys?.interaction?.current).toBeUndefined();
    await game.screenshot('02-小丑-小丑学院回收标准行动收口', testInfo);

    await game.playCard('diy_clowns_clown_girl', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);

    const secondState = await game.getState();
    const secondPlayer = secondState.core.players['0'];
    const secondHand = secondPlayer?.hand?.map((card: { uid?: string }) => card.uid) ?? [];
    const secondDiscard = secondPlayer?.discard?.map((card: { uid?: string }) => card.uid) ?? [];
    expect(secondHand).not.toContain('academy-minion-2');
    expect(secondHand.filter((uid: string) => uid === 'academy-action-a' || uid === 'academy-action-b')).toHaveLength(1);
    expect(secondDiscard).toContain('academy-discard-minion');
    expect(secondState.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid)).toEqual([
      'academy-minion-1',
      'academy-minion-2',
    ]);
    expect(secondState.core.triggerQueue ?? []).toEqual([]);
    expect(secondState.sys?.interaction?.current).toBeUndefined();
    await game.screenshot('03-小丑-小丑学院同回合第二次打入不重复触发', testInfo);
  });

  test('麦当劳小丑从真实打牌入口展示两张行动并手选抽取一张', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_clowns,aliens',
      p1: 'pirates,ninjas',
      seat1: 'human',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260918,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'mcdonald', defId: 'diy_clowns_mcdonald_clown', type: 'minion', owner: '0' }],
        deck: [
          { uid: 'top-minion', defId: 'diy_clowns_silent_clown', type: 'minion', owner: '0' },
          { uid: 'action-a', defId: 'diy_clowns_colorful_scarf', type: 'action', owner: '0' },
          { uid: 'action-b', defId: 'diy_clowns_confetti_bucket', type: 'action', owner: '0' },
          { uid: 'rest-minion', defId: 'diy_clowns_clown_girl', type: 'minion', owner: '0' },
        ],
        discard: [],
        factions: ['diy_clowns', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 2,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: { hand: [], deck: [], discard: [], factions: ['pirates', 'ninjas'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0 },
      bases: [
        { defId: 'base_diy_clowns_clown_academy', minions: [] },
        { defId: 'base_diy_clowns_circus_tent', minions: [] },
      ],
    });

    await game.playCard('diy_clowns_mcdonald_clown', { targetBaseIndex: 0 });
    await game.waitForInteraction('diy_clowns_mcdonald_clown', 10000);
    await expect(page.getByText('麦当劳小丑：选择一张展示的行动加入手牌')).toBeVisible();
    await game.screenshot('02-小丑-麦当劳小丑展示行动', testInfo);

    const options = await game.getInteractionOptions();
    expect(options.filter(option => option.value?.cardUid === 'action-a' || option.value?.cardUid === 'action-b')).toHaveLength(2);
    await game.selectInteractionOptionBy(option => option.value?.cardUid === 'action-b', '麦当劳小丑抽取第二张行动');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        hand: player?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        discard: player?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        deck: player?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      hand: ['action-b'],
      discard: ['action-a'],
      deck: ['top-minion', 'rest-minion'],
      interactionOpen: false,
    });
    await game.screenshot('03-小丑-麦当劳小丑抽取与弃置收口', testInfo);
  });

  test('小丑金字塔只有一个己方随从时仍要求显式选择并结算力量与额外行动', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_clowns,aliens',
      p1: 'pirates,ninjas',
      seat1: 'human',
      disableLocalAiAutomation: true,
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260918,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'pyramid', defId: 'diy_clowns_clown_pyramid', type: 'action', owner: '0' }],
        deck: [],
        discard: [],
        factions: ['diy_clowns', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: { hand: [], deck: [], discard: [], factions: ['pirates', 'ninjas'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0 },
      bases: [
        { defId: 'base_diy_clowns_clown_academy', minions: [{ uid: 'host', defId: 'diy_clowns_silent_clown', owner: '0', controller: '0' }] },
        { defId: 'base_diy_clowns_circus_tent', minions: [] },
      ],
    });

    await game.playCard('diy_clowns_clown_pyramid', { targetBaseIndex: 0 });
    await game.waitForInteraction('diy_clowns_clown_pyramid', 10000);
    await expect(page.getByText('小丑金字塔：选择获得力量加成的己方随从')).toBeVisible();

    const stateBefore = await game.getState();
    const interaction = stateBefore.sys?.interaction?.current;
    expect(interaction?.data?.autoResolveIfSingle).toBe(false);
    expect(interaction?.data?.options?.map((option: any) => option.value?.minionUid)).toEqual(['host']);
    await game.screenshot('04-小丑-金字塔单候选仍需手选', testInfo);

    await game.selectInteractionOptionBy(option => option.value?.minionUid === 'host', '小丑金字塔选择己方随从');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      const host = state.core.bases[0]?.minions?.find((minion: { uid?: string }) => minion.uid === 'host');
      return {
        tempPowerModifier: host?.tempPowerModifier ?? 0,
        actionsPlayed: player?.actionsPlayed,
        actionLimit: player?.actionLimit,
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      tempPowerModifier: 1,
      actionsPlayed: 1,
      actionLimit: 2,
      interactionOpen: false,
    });
    await game.screenshot('05-小丑-金字塔力量与额外行动收口', testInfo);
  });

  test('香蕉皮从真实打牌入口完成来源基地、至多两个随从与目标基地三段选择', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_clowns,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260918,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'banana-peel', defId: 'diy_clowns_banana_peel', type: 'action', owner: '0' }],
        deck: [],
        discard: [],
        factions: ['diy_clowns', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: {
        hand: [],
        deck: [],
        discard: [],
        factions: ['pirates', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      bases: [
        {
          defId: 'base_diy_clowns_clown_academy',
          minions: [
            { uid: 'banana-a', defId: 'diy_clowns_silent_clown', owner: '0', controller: '0' },
            { uid: 'banana-b', defId: 'diy_clowns_clown_girl', owner: '0', controller: '0' },
            { uid: 'banana-opponent', defId: 'pirates_first_mate', owner: '1', controller: '1' },
          ],
        },
        { defId: 'base_diy_clowns_circus_tent', minions: [] },
        { defId: 'base_central_brain', minions: [] },
      ],
    });

    await game.playCard('diy_clowns_banana_peel');
    await game.waitForInteraction('diy_clowns_banana_peel', 10000);
    await expect(page.getByText('香蕉皮：选择来源基地')).toBeVisible();

    const sourceState = await game.getState();
    const sourcePrompt = sourceState.sys?.interaction?.current;
    expect(sourcePrompt?.data?.autoResolveIfSingle).toBe(false);
    expect(sourcePrompt?.data?.options?.map((option: any) => option.value?.fromBaseIndex)).toEqual([0]);
    await game.screenshot('06-小丑-香蕉皮选择来源基地', testInfo);
    await page.locator('[data-option-id="base-0"]').first().click({ force: true });

    await game.waitForInteraction('diy_clowns_banana_peel_minions', 10000);
    await expect(page.getByText('香蕉皮：选择至多两个要移动的己方随从')).toBeVisible();
    const minionState = await game.getState();
    const minionPrompt = minionState.sys?.interaction?.current;
    expect(minionPrompt?.data?.multi).toEqual({ min: 0, max: 2 });
    expect(minionPrompt?.data?.options?.map((option: any) => option.value?.minionUid)).toEqual(['banana-a', 'banana-b']);
    await expect(page.locator('[data-minion-uid="banana-a"][data-highlighted="true"]')).toBeVisible();
    await expect(page.locator('[data-minion-uid="banana-b"][data-highlighted="true"]')).toBeVisible();
    await expect(page.locator('[data-minion-uid="banana-opponent"][data-highlighted="true"]')).toHaveCount(0);
    await game.screenshot('07-小丑-香蕉皮选择至多两个己方随从', testInfo);

    await page.locator('[data-minion-uid="banana-a"]').click({ force: true });
    await page.locator('[data-minion-uid="banana-b"]').click({ force: true });
    await expect(page.locator('[data-minion-uid="banana-a"][data-selected="true"]')).toBeVisible();
    await expect(page.locator('[data-minion-uid="banana-b"][data-selected="true"]')).toBeVisible();
    await game.confirm();

    await game.waitForInteraction('diy_clowns_banana_peel_base', 10000);
    await expect(page.getByText('香蕉皮：选择目标基地')).toBeVisible();
    const destinationState = await game.getState();
    const destinationPrompt = destinationState.sys?.interaction?.current;
    expect(destinationPrompt?.data?.options?.map((option: any) => option.value?.toBaseIndex)).toEqual([1, 2]);
    await game.screenshot('08-小丑-香蕉皮选择目标基地', testInfo);
    await page.locator('[data-option-id="base-1"]').first().click({ force: true });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        source: state.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        destination: state.core.bases[1]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        hand: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        discard: state.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      source: ['banana-opponent'],
      destination: ['banana-a', 'banana-b'],
      hand: [],
      discard: ['banana-peel'],
      interactionOpen: false,
    });
    await game.screenshot('09-小丑-香蕉皮移动收口', testInfo);
  });

  test('小丑车从真实打牌入口在弃牌堆面板多选两张牌并洗回牌库', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_clowns,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260918,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'clown-car', defId: 'diy_clowns_clown_car', type: 'action', owner: '0' }],
        deck: [{ uid: 'deck-keep', defId: 'diy_clowns_clown_girl', type: 'minion', owner: '0' }],
        discard: [
          { uid: 'car-a', defId: 'diy_clowns_colorful_scarf', type: 'action', owner: '0' },
          { uid: 'car-b', defId: 'diy_clowns_confetti_bucket', type: 'action', owner: '0' },
          { uid: 'car-keep', defId: 'diy_clowns_silent_clown', type: 'minion', owner: '0' },
        ],
        factions: ['diy_clowns', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: { hand: [], deck: [], discard: [], factions: ['pirates', 'ninjas'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0 },
      bases: [
        { defId: 'base_diy_clowns_clown_academy', minions: [] },
        { defId: 'base_diy_clowns_circus_tent', minions: [] },
        { defId: 'base_central_brain', minions: [] },
      ],
    });

    await game.playCard('diy_clowns_clown_car');
    await game.waitForInteraction('diy_clowns_clown_car', 10000);

    const interactionState = await game.getState();
    const interaction = interactionState.sys?.interaction?.current;
    expect(interaction?.data?.multi).toEqual({ min: 0, max: 2 });
    expect(interaction?.data?.options?.map((option: any) => option.value?.cardUid)).toEqual(['car-a', 'car-b', 'car-keep']);
    const discardPanel = page.locator('[data-discard-view-panel]');
    await expect(discardPanel).toBeVisible();
    await expect(discardPanel.getByRole('heading', { name: '弃牌堆 (4)' })).toBeVisible();
    await expect(discardPanel.locator('[data-card-uid="car-a"]')).toBeVisible();
    await expect(discardPanel.locator('[data-card-uid="car-b"]')).toBeVisible();
    await expect(discardPanel.locator('[data-card-uid="car-keep"]')).toBeVisible();
    await game.screenshot('10-小丑-小丑车弃牌堆多选', testInfo);

    await discardPanel.locator('[data-card-uid="car-a"]').click({ force: true });
    await discardPanel.locator('[data-card-uid="car-b"]').click({ force: true });
    await expect(discardPanel.locator('[data-card-uid="car-a"] [data-selected="true"], [data-card-uid="car-a"].scale-110')).toHaveCount(1);
    await expect(discardPanel.locator('[data-card-uid="car-b"] [data-selected="true"], [data-card-uid="car-b"].scale-110')).toHaveCount(1);
    await game.confirm();
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        hand: player?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        deck: player?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        discard: player?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual(expect.objectContaining({
      hand: [],
      discard: ['car-keep', 'clown-car'],
      interactionOpen: false,
    }));

    const finalState = await game.getState();
    const finalDeck = finalState.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid) ?? [];
    expect(new Set(finalDeck)).toEqual(new Set(['deck-keep', 'car-a', 'car-b']));
    expect(finalDeck).toHaveLength(3);
    await game.screenshot('11-小丑-小丑车洗回牌库收口', testInfo);
  });

  test('小丑夫人从真实行动入口进入可选抽牌响应并清理响应队列', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_clowns,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260918,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'action', defId: 'diy_clowns_colorful_scarf', type: 'action', owner: '0' }],
        deck: [
          { uid: 'draw-card', defId: 'diy_clowns_clown_girl', type: 'minion', owner: '0' },
          { uid: 'draw-card-2', defId: 'diy_clowns_silent_clown', type: 'minion', owner: '0' },
          { uid: 'draw-card-3', defId: 'diy_clowns_mcdonald_clown', type: 'minion', owner: '0' },
        ],
        discard: [],
        factions: ['diy_clowns', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: { hand: [], deck: [], discard: [], factions: ['pirates', 'ninjas'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0 },
      bases: [
        { defId: 'base_diy_clowns_clown_academy', minions: [{ uid: 'mrs', defId: 'diy_clowns_mrs_clown', owner: '0', controller: '0' }] },
        { defId: 'base_diy_clowns_circus_tent', minions: [] },
      ],
    });

    await game.playCard('diy_clowns_colorful_scarf');
    await game.waitForInteraction('smashup_reaction_choose', 10000);
    await game.screenshot('06-小丑-小丑夫人可选响应窗', testInfo);

    await game.selectInteractionOptionBy(option => option.value?.triggerId?.includes('diy_clowns_mrs_clown'), '接受小丑夫人抽牌');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      const mrs = state.core.bases[0]?.minions?.find((minion: { uid?: string }) => minion.uid === 'mrs');
      return {
        hand: player?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        mrsUsedTurn: mrs?.metadata?.diyClownsMrsClownUsedTurn,
        triggerQueue: state.core.triggerQueue ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
        hand: ['draw-card', 'draw-card-2', 'draw-card-3'],
      mrsUsedTurn: 1,
      triggerQueue: [],
      interactionOpen: false,
    });
    await game.screenshot('07-小丑-小丑夫人抽牌响应收口', testInfo);
  });

  test('小丑女从真实打牌入口搜索牌库行动并完成弃置', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_clowns,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260918,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'girl', defId: 'diy_clowns_clown_girl', type: 'minion', owner: '0' }],
        deck: [
          { uid: 'deck-action', defId: 'diy_clowns_colorful_scarf', type: 'action', owner: '0' },
          { uid: 'deck-minion', defId: 'diy_clowns_silent_clown', type: 'minion', owner: '0' },
        ],
        discard: [],
        factions: ['diy_clowns', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: { hand: [], deck: [], discard: [], factions: ['pirates', 'ninjas'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0 },
      bases: [
        { defId: 'base_the_factory', minions: [] },
        { defId: 'base_diy_clowns_circus_tent', minions: [] },
      ],
    });

    await game.playCard('diy_clowns_clown_girl', { targetBaseIndex: 0 });
    await game.waitForInteraction('diy_clowns_clown_girl', 10000);
    await expect(page.getByText('小丑女：选择从牌库弃置的行动牌')).toBeVisible();
    await game.screenshot('08-小丑-小丑女牌库搜索', testInfo);
    await game.selectInteractionOptionBy(option => option.value?.cardUid === 'deck-action', '小丑女选择牌库行动');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        discard: player?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        deck: player?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      discard: ['deck-action'],
      deck: ['deck-minion'],
      interactionOpen: false,
    });
    await game.screenshot('09-小丑-小丑女弃置收口', testInfo);
  });

  test('马戏篷从真实打出随从入口展示行动并执行弃置分支', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_clowns,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260918,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'silent', defId: 'diy_clowns_silent_clown', type: 'minion', owner: '0' }],
        deck: [
          { uid: 'top-action', defId: 'diy_clowns_colorful_scarf', type: 'action', owner: '0' },
          { uid: 'rest-minion', defId: 'diy_clowns_clown_girl', type: 'minion', owner: '0' },
        ],
        discard: [],
        factions: ['diy_clowns', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: { hand: [], deck: [], discard: [], factions: ['pirates', 'ninjas'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0 },
      bases: [
        { defId: 'base_diy_clowns_circus_tent', minions: [] },
        { defId: 'base_the_factory', minions: [] },
      ],
    });

    await game.playCard('diy_clowns_silent_clown', { targetBaseIndex: 0 });
    await game.waitForInteraction('base_diy_clowns_circus_tent', 10000);
    await expect(page.getByText('马戏篷：是否弃掉展示的行动牌？')).toBeVisible();
    await game.screenshot('10-小丑-马戏篷展示行动', testInfo);
    await game.selectInteractionOptionBy(option => option.value?.discard === true, '马戏篷弃置展示行动');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        discard: player?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        deck: player?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      discard: ['top-action'],
      deck: ['rest-minion'],
      interactionOpen: false,
    });
    await game.screenshot('11-小丑-马戏篷弃置收口', testInfo);
  });

  test('惊吓盒从手牌真实入口只允许力量不超过3的额外随从', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_clowns,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260918,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'jack-hand', defId: 'diy_clowns_jack_in_the_box', type: 'action', owner: '0' },
          { uid: 'jack-eligible', defId: 'diy_clowns_silent_clown', type: 'minion', owner: '0' },
          { uid: 'jack-too-high-4', defId: 'diy_clowns_mrs_clown', type: 'minion', owner: '0' },
          { uid: 'jack-too-high-5', defId: 'diy_clowns_slapstick_clown', type: 'minion', owner: '0' },
        ],
        deck: [],
        discard: [],
        field: [{ uid: 'jack-existing', defId: 'diy_clowns_clown_girl', baseIndex: 1, owner: '0', controller: '0', power: 2 }],
        factions: ['diy_clowns', 'aliens'],
        minionsPlayed: 1,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: { hand: [], deck: [], discard: [], factions: ['pirates', 'ninjas'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0 },
      bases: [
        { defId: 'base_the_factory', minions: [] },
        { defId: 'base_the_homeworld', minions: [] },
      ],
    });

    await game.playCard('diy_clowns_jack_in_the_box');
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        hand: player?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        discard: player?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        actionsPlayed: player?.actionsPlayed,
        minionsPlayed: player?.minionsPlayed,
        minionLimit: player?.minionLimit,
        extraMinionPowerMax: player?.extraMinionPowerMax,
        extraMinionPowerCaps: player?.extraMinionPowerCaps,
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      hand: ['jack-eligible', 'jack-too-high-4', 'jack-too-high-5'],
      discard: ['jack-hand'],
      actionsPlayed: 1,
      minionsPlayed: 1,
      minionLimit: 2,
      extraMinionPowerMax: 3,
      extraMinionPowerCaps: [3],
      interactionOpen: false,
    });
    await game.screenshot('12-小丑-惊吓盒普通打出后力量上限3', testInfo);

    const tooHighCard = page.locator('[data-card-uid="jack-too-high-4"]');
    await tooHighCard.click({ force: true });
    await expect(tooHighCard).toHaveAttribute('data-selected', 'true');
    await expect(page.locator('[data-base-index][data-selectable="true"]')).toHaveCount(0);
    await tooHighCard.click({ force: true });

    await page.locator('[data-card-uid="jack-eligible"]').click({ force: true });
    await expect(page.locator('[data-base-index="0"][data-selectable="true"]')).toHaveCount(1);
    await page.locator('[data-base-index="0"]').click({ force: true });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        hand: player?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        discard: player?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        base0: state.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        minionsPlayed: player?.minionsPlayed,
        minionLimit: player?.minionLimit,
        extraMinionPowerMax: player?.extraMinionPowerMax,
        extraMinionPowerCaps: player?.extraMinionPowerCaps,
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      hand: ['jack-too-high-4', 'jack-too-high-5'],
      discard: ['jack-hand'],
      base0: ['jack-eligible'],
      minionsPlayed: 2,
      minionLimit: 2,
      extraMinionPowerMax: undefined,
      extraMinionPowerCaps: undefined,
      interactionOpen: false,
    });
    await game.screenshot('13-小丑-惊吓盒普通额外随从收口', testInfo);
  });

  test('惊吓盒从弃牌堆真实入口把力量上限提高到4并消费额外随从额度', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_clowns,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260918,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'jack-discard-eligible-4', defId: 'diy_clowns_mrs_clown', type: 'minion', owner: '0' },
          { uid: 'jack-discard-too-high-5', defId: 'diy_clowns_slapstick_clown', type: 'minion', owner: '0' },
        ],
        deck: [],
        discard: [{ uid: 'jack-discard', defId: 'diy_clowns_jack_in_the_box', type: 'action', owner: '0' }],
        field: [{ uid: 'jack-slapstick-source', defId: 'diy_clowns_slapstick_clown', baseIndex: 0, owner: '0', controller: '0', power: 5 }],
        factions: ['diy_clowns', 'aliens'],
        minionsPlayed: 1,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: { hand: [], deck: [], discard: [], factions: ['pirates', 'ninjas'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0 },
      bases: [
        { defId: 'base_the_factory', minions: [] },
        { defId: 'base_the_homeworld', minions: [] },
      ],
    });

    const discardToggle = page.getByTestId('su-discard-toggle');
    await discardToggle.click({ force: true });
    const discardPanel = page.locator('[data-discard-view-panel]');
    await expect(discardPanel).toBeVisible();
    await expect(discardPanel.locator('[data-card-uid="jack-discard"]')).toBeVisible();
    await game.screenshot('14-小丑-惊吓盒从弃牌堆可打出', testInfo);

    await discardPanel.locator('[data-card-uid="jack-discard"]').click({ force: true });
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        hand: player?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        discard: player?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        deck: player?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        actionsPlayed: player?.actionsPlayed,
        usedDiscardPlayAbilities: player?.usedDiscardPlayAbilities ?? [],
        minionsPlayed: player?.minionsPlayed,
        extraMinionPowerMax: player?.extraMinionPowerMax,
        extraMinionPowerCaps: player?.extraMinionPowerCaps,
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      hand: ['jack-discard-eligible-4', 'jack-discard-too-high-5'],
      discard: [],
      deck: ['jack-discard'],
      actionsPlayed: 1,
      usedDiscardPlayAbilities: ['diy_clowns_slapstick_clown:jack-slapstick-source'],
      minionsPlayed: 1,
      extraMinionPowerMax: 4,
      extraMinionPowerCaps: [4],
      interactionOpen: false,
    });
    await game.screenshot('15-小丑-惊吓盒弃牌堆打出后力量上限4', testInfo);

    const tooHighCard = page.locator('[data-card-uid="jack-discard-too-high-5"]');
    await tooHighCard.click({ force: true });
    await expect(tooHighCard).toHaveAttribute('data-selected', 'true');
    await expect(page.locator('[data-base-index][data-selectable="true"]')).toHaveCount(0);
    await tooHighCard.click({ force: true });

    await page.locator('[data-card-uid="jack-discard-eligible-4"]').click({ force: true });
    await expect(page.locator('[data-base-index="0"][data-selectable="true"]')).toHaveCount(1);
    await page.locator('[data-base-index="0"]').click({ force: true });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        hand: player?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        discard: player?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        deck: player?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        base0: state.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        minionsPlayed: player?.minionsPlayed,
        minionLimit: player?.minionLimit,
        extraMinionPowerMax: player?.extraMinionPowerMax,
        extraMinionPowerCaps: player?.extraMinionPowerCaps,
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      hand: ['jack-discard-too-high-5'],
      discard: [],
      deck: ['jack-discard'],
      base0: ['jack-slapstick-source', 'jack-discard-eligible-4'],
      minionsPlayed: 2,
      minionLimit: 2,
      extraMinionPowerMax: undefined,
      extraMinionPowerCaps: undefined,
      interactionOpen: false,
    });
    await game.screenshot('16-小丑-惊吓盒弃牌堆额外随从收口', testInfo);
  });

  test('彩色围巾从手牌真实入口抽两张并结束交互', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_clowns,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260918,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'scarf-hand', defId: 'diy_clowns_colorful_scarf', type: 'action', owner: '0' },
          { uid: 'scarf-keep', defId: 'diy_clowns_confetti_bucket', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'scarf-draw-1', defId: 'diy_clowns_clown_girl', type: 'minion', owner: '0' },
          { uid: 'scarf-draw-2', defId: 'diy_clowns_silent_clown', type: 'minion', owner: '0' },
          { uid: 'scarf-draw-3', defId: 'diy_clowns_mrs_clown', type: 'minion', owner: '0' },
        ],
        discard: [],
        factions: ['diy_clowns', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: { hand: [], deck: [], discard: [], factions: ['pirates', 'ninjas'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0 },
      bases: [
        { defId: 'base_the_factory', minions: [] },
        { defId: 'base_the_homeworld', minions: [] },
      ],
    });

    await game.playCard('diy_clowns_colorful_scarf');
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        hand: player?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        discard: player?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        deck: player?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      hand: ['scarf-keep', 'scarf-draw-1', 'scarf-draw-2'],
      discard: ['scarf-hand'],
      deck: ['scarf-draw-3'],
      interactionOpen: false,
    });
    await game.screenshot('17-小丑-彩色围巾手牌抽两张收口', testInfo);
  });

  test('彩色围巾从弃牌堆真实入口可弃一张手牌并额外抽一张', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_clowns,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260918,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'scarf-fodder', defId: 'diy_clowns_confetti_bucket', type: 'action', owner: '0' }],
        deck: [
          { uid: 'scarf-extra-1', defId: 'diy_clowns_clown_girl', type: 'minion', owner: '0' },
          { uid: 'scarf-extra-2', defId: 'diy_clowns_silent_clown', type: 'minion', owner: '0' },
          { uid: 'scarf-extra-3', defId: 'diy_clowns_mrs_clown', type: 'minion', owner: '0' },
        ],
        discard: [{ uid: 'scarf-discard', defId: 'diy_clowns_colorful_scarf', type: 'action', owner: '0' }],
        field: [{ uid: 'scarf-silent', defId: 'diy_clowns_silent_clown', baseIndex: 0, owner: '0', controller: '0', power: 3 }],
        factions: ['diy_clowns', 'aliens'],
        minionsPlayed: 1,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: { hand: [], deck: [], discard: [], factions: ['pirates', 'ninjas'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0 },
      bases: [
        { defId: 'base_the_factory', minions: [] },
        { defId: 'base_the_homeworld', minions: [] },
      ],
    });

    const discardToggle = page.getByTestId('su-discard-toggle');
    await discardToggle.click({ force: true });
    const discardPanel = page.locator('[data-discard-view-panel]');
    await expect(discardPanel).toBeVisible();
    await discardPanel.locator('[data-card-uid="scarf-discard"]').click({ force: true });
    await game.waitForInteraction('diy_clowns_colorful_scarf', 10000);
    await expect(page.getByText('彩色围巾：选择要弃掉的手牌，或跳过')).toBeVisible();

    const options = await game.getInteractionOptions();
    expect(options.some(option => option.value?.cardUid === 'scarf-fodder')).toBe(true);
    expect(options.some(option => option.value?.skip === true)).toBe(true);
    await game.screenshot('18-小丑-彩色围巾弃牌堆额外抽牌选择', testInfo);

    await game.selectInteractionOptionBy(option => option.value?.cardUid === 'scarf-fodder', '彩色围巾弃一张手牌');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        hand: player?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        discard: player?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        deck: player?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        actionsPlayed: player?.actionsPlayed,
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      hand: ['scarf-extra-1', 'scarf-extra-2', 'scarf-extra-3'],
      discard: ['scarf-fodder'],
      deck: ['scarf-discard'],
      actionsPlayed: 0,
      interactionOpen: false,
    });
    await game.screenshot('19-小丑-彩色围巾弃牌堆额外抽牌收口', testInfo);
  });

  test('馅饼砸脸从手牌真实入口只让玩家选择己方随从并获得+2力量', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_clowns,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260918,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'pie-hand', defId: 'diy_clowns_pie_in_the_face', type: 'action', owner: '0' }],
        deck: [],
        discard: [],
        factions: ['diy_clowns', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: { hand: [], deck: [], discard: [], factions: ['pirates', 'ninjas'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0 },
      bases: [
        { defId: 'base_the_factory', minions: [{ uid: 'pie-own', defId: 'diy_clowns_silent_clown', owner: '0', controller: '0', power: 3 }] },
        { defId: 'base_the_homeworld', minions: [{ uid: 'pie-opponent', defId: 'diy_clowns_slapstick_clown', owner: '1', controller: '1', power: 5 }] },
      ],
    });

    await game.playCard('diy_clowns_pie_in_the_face');
    await game.waitForInteraction('diy_clowns_pie_in_the_face', 10000);
    await expect(page.getByText('馅饼砸脸：选择获得力量的己方随从')).toBeVisible();

    const interaction = await game.getState();
    expect(interaction.sys?.interaction?.current?.data?.autoResolveIfSingle).toBe(false);
    expect(interaction.sys?.interaction?.current?.data?.options?.map((option: any) => option.value?.minionUid)).toEqual(['pie-own']);
    await game.screenshot('20-小丑-馅饼砸脸手牌来源选择己方随从', testInfo);

    await game.selectInteractionOptionBy(option => option.value?.minionUid === 'pie-own', '馅饼砸脸选择己方随从');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      const own = state.core.bases[0]?.minions?.find((minion: { uid?: string }) => minion.uid === 'pie-own');
      const opponent = state.core.bases[1]?.minions?.find((minion: { uid?: string }) => minion.uid === 'pie-opponent');
      return {
        discard: player?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        ownTempPowerModifier: own?.tempPowerModifier ?? 0,
        opponentTempPowerModifier: opponent?.tempPowerModifier ?? 0,
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      discard: ['pie-hand'],
      ownTempPowerModifier: 2,
      opponentTempPowerModifier: 0,
      interactionOpen: false,
    });
    await game.screenshot('21-小丑-馅饼砸脸手牌来源力量收口', testInfo);
  });

  test('馅饼砸脸从弃牌堆真实入口改为+4并把行动放回牌库底', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_clowns,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260918,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [],
        deck: [{ uid: 'pie-deck-tail', defId: 'diy_clowns_clown_girl', type: 'minion', owner: '0' }],
        discard: [{ uid: 'pie-discard', defId: 'diy_clowns_pie_in_the_face', type: 'action', owner: '0' }],
        field: [{ uid: 'pie-silent-source', defId: 'diy_clowns_silent_clown', baseIndex: 0, owner: '0', controller: '0', power: 3 }],
        factions: ['diy_clowns', 'aliens'],
        minionsPlayed: 1,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: { hand: [], deck: [], discard: [], factions: ['pirates', 'ninjas'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0 },
      bases: [
        { defId: 'base_the_factory', minions: [{ uid: 'pie-opponent-discard', defId: 'diy_clowns_slapstick_clown', owner: '1', controller: '1', power: 5 }] },
        { defId: 'base_the_homeworld', minions: [] },
      ],
    });

    const discardToggle = page.getByTestId('su-discard-toggle');
    await discardToggle.click({ force: true });
    const discardPanel = page.locator('[data-discard-view-panel]');
    await expect(discardPanel).toBeVisible();
    await discardPanel.locator('[data-card-uid="pie-discard"]').click({ force: true });
    await game.waitForInteraction('diy_clowns_pie_in_the_face', 10000);
    await expect(page.getByText('馅饼砸脸：选择获得力量的己方随从')).toBeVisible();

    const interaction = await game.getState();
    expect(interaction.sys?.interaction?.current?.data?.autoResolveIfSingle).toBe(false);
    expect(interaction.sys?.interaction?.current?.data?.options?.map((option: any) => option.value?.minionUid)).toEqual(['pie-silent-source']);
    await game.screenshot('22-小丑-馅饼砸脸弃牌堆来源选择己方随从', testInfo);

    await game.selectInteractionOptionBy(option => option.value?.minionUid === 'pie-silent-source', '馅饼砸脸弃牌堆来源选择己方随从');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      const own = state.core.bases[0]?.minions?.find((minion: { uid?: string }) => minion.uid === 'pie-silent-source');
      const opponent = state.core.bases[0]?.minions?.find((minion: { uid?: string }) => minion.uid === 'pie-opponent-discard');
      return {
        discard: player?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        deck: player?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        ownTempPowerModifier: own?.tempPowerModifier ?? 0,
        opponentTempPowerModifier: opponent?.tempPowerModifier ?? 0,
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      discard: [],
      deck: ['pie-deck-tail', 'pie-discard'],
      ownTempPowerModifier: 4,
      opponentTempPowerModifier: 0,
      interactionOpen: false,
    });
    await game.screenshot('23-小丑-馅饼砸脸弃牌堆来源力量与牌库收口', testInfo);
  });

  test('杂耍从真实打牌入口让两名玩家依次手选牌库顶三张中的行动牌', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_clowns,aliens',
      p1: 'pirates,ninjas',
      seat1: 'human',
      disableLocalAiAutomation: true,
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260918,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'juggling', defId: 'diy_clowns_juggling', type: 'action', owner: '0' }],
        deck: [
          { uid: 'p0-minion', defId: 'diy_clowns_silent_clown', type: 'minion', owner: '0' },
          { uid: 'p0-action-a', defId: 'diy_clowns_colorful_scarf', type: 'action', owner: '0' },
          { uid: 'p0-action-b', defId: 'diy_clowns_confetti_bucket', type: 'action', owner: '0' },
          { uid: 'p0-tail', defId: 'diy_clowns_clown_girl', type: 'minion', owner: '0' },
        ],
        discard: [],
        factions: ['diy_clowns', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: {
        hand: [],
        deck: [
          { uid: 'p1-action-a', defId: 'diy_clowns_colorful_scarf', type: 'action', owner: '1' },
          { uid: 'p1-minion', defId: 'diy_clowns_silent_clown', type: 'minion', owner: '1' },
          { uid: 'p1-action-b', defId: 'diy_clowns_confetti_bucket', type: 'action', owner: '1' },
          { uid: 'p1-tail', defId: 'diy_clowns_clown_girl', type: 'minion', owner: '1' },
        ],
        discard: [],
        factions: ['pirates', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      bases: [
        { defId: 'base_the_factory', minions: [] },
        { defId: 'base_the_homeworld', minions: [] },
      ],
    });

    await game.playCard('diy_clowns_juggling');
    await game.waitForInteraction('diy_clowns_juggling_pick_action', 10000);
    await expect(page.getByText('杂耍：选择要弃置的行动牌')).toBeVisible();

    const firstOptions = await game.getInteractionOptions();
    expect(firstOptions.map(option => option.value?.cardUid)).toEqual(['p0-action-a', 'p0-action-b']);
    await game.screenshot('22-小丑-杂耍第一名玩家选择行动牌', testInfo);

    await game.selectInteractionOptionBy(
      option => option.value?.cardUid === 'p0-action-b',
      '杂耍第一名玩家选择第二张行动牌',
    );
    await dismissRevealIfPresent(page);
    await game.waitForInteraction('diy_clowns_juggling_pick_action', 10000);

    const secondState = await game.getState();
    expect(secondState.sys?.interaction?.current?.playerId).toBe('1');
    const secondOptions = await game.getInteractionOptions();
    expect(secondOptions.map(option => option.value?.cardUid)).toEqual(['p1-action-a', 'p1-action-b']);
    await game.screenshot('23-小丑-杂耍第二名玩家选择行动牌', testInfo);

    await game.selectInteractionOptionBy(
      option => option.value?.cardUid === 'p1-action-a',
      '杂耍第二名玩家选择第一张行动牌',
    );
    await game.waitForNoInteraction(10000);
    await dismissRevealIfPresent(page);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player0 = state.core.players['0'];
      const player1 = state.core.players['1'];
      return {
        player0Hand: player0?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        player0Discard: player0?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        player0Deck: player0?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        player1Discard: player1?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        player1Deck: player1?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      player0Hand: [],
      player0Discard: ['juggling', 'p0-action-b'],
      player0Deck: ['p0-minion', 'p0-action-a', 'p0-tail'],
      player1Discard: ['p1-action-a'],
      player1Deck: ['p1-minion', 'p1-action-b', 'p1-tail'],
      interactionOpen: false,
    });
    await game.screenshot('24-小丑-杂耍两名玩家弃置与牌库顺序收口', testInfo);
  });

  test('五彩纸屑桶从真实打牌入口多选手牌并等量抽牌', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_clowns,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260918,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'bucket', defId: 'diy_clowns_confetti_bucket', type: 'action', owner: '0' },
          { uid: 'bucket-card-1', defId: 'diy_clowns_colorful_scarf', type: 'action', owner: '0' },
          { uid: 'bucket-card-2', defId: 'diy_clowns_juggling', type: 'action', owner: '0' },
          { uid: 'bucket-card-3', defId: 'diy_clowns_pie_in_the_face', type: 'action', owner: '0' },
          { uid: 'bucket-keep', defId: 'diy_clowns_banana_peel', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'bucket-draw-1', defId: 'diy_clowns_clown_girl', type: 'minion', owner: '0' },
          { uid: 'bucket-draw-2', defId: 'diy_clowns_silent_clown', type: 'minion', owner: '0' },
          { uid: 'bucket-draw-3', defId: 'diy_clowns_mrs_clown', type: 'minion', owner: '0' },
        ],
        discard: [],
        factions: ['diy_clowns', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: { hand: [], deck: [], discard: [], factions: ['pirates', 'ninjas'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0 },
      bases: [
        { defId: 'base_the_factory', minions: [] },
        { defId: 'base_the_homeworld', minions: [] },
      ],
    });

    await game.playCard('diy_clowns_confetti_bucket');
    await game.waitForInteraction('diy_clowns_confetti_bucket', 10000);
    await expect(page.getByText('五彩纸屑桶：选择要弃置的手牌')).toBeVisible();

    const interaction = await game.getState();
    expect(interaction.sys?.interaction?.current?.data?.multi).toEqual({ min: 0, max: 4 });
    expect(interaction.sys?.interaction?.current?.data?.options?.map((option: any) => option.value?.cardUid)).toEqual([
      'bucket-card-1',
      'bucket-card-2',
      'bucket-card-3',
      'bucket-keep',
    ]);
    await game.screenshot('20-小丑-五彩纸屑桶多选手牌', testInfo);

    await page.locator('[data-card-uid="bucket-card-1"]').click({ force: true });
    await page.locator('[data-card-uid="bucket-card-2"]').click({ force: true });
    await expect(page.locator('[data-card-uid="bucket-card-1"][data-discard-selected="true"]')).toHaveCount(1);
    await expect(page.locator('[data-card-uid="bucket-card-2"][data-discard-selected="true"]')).toHaveCount(1);
    await game.confirm();
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        hand: player?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        discard: player?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        deck: player?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        actionsPlayed: player?.actionsPlayed,
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      hand: ['bucket-card-3', 'bucket-keep', 'bucket-draw-1', 'bucket-draw-2'],
      discard: ['bucket', 'bucket-card-1', 'bucket-card-2'],
      deck: ['bucket-draw-3'],
      actionsPlayed: 1,
      interactionOpen: false,
    });
    await game.screenshot('21-小丑-五彩纸屑桶弃牌抽牌收口', testInfo);
  });
});
