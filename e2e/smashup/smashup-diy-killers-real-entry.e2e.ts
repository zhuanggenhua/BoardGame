import { test, expect } from '../framework';
import type { GameTestContext } from '../framework';
import type { Page } from '@playwright/test';
import { setChineseLocale } from '../helpers/common';

type InteractionOption = {
  id?: string;
  value?: {
    cardUid?: string;
    defId?: string;
    mode?: 'transfer' | 'destroy';
    targetMinionUid?: string;
    minionUid?: string;
    skip?: boolean;
  };
};

async function dismissSpotlightIfPresent(page: Page): Promise<void> {
  const spotlightQueue = page.getByTestId('card-spotlight-queue');
  if (await spotlightQueue.isVisible({ timeout: 300 }).catch(() => false)) {
    await spotlightQueue.getByRole('button', { name: /^(关闭特写|Close spotlight)$/i }).click({ force: true });
    await page.waitForTimeout(200);
  }
}

function optionHasCardUid(option: InteractionOption, cardUid: string): boolean {
  return option.value?.cardUid === cardUid;
}

async function openMichaelScoringScene(game: GameTestContext, seed: number): Promise<void> {
  await game.openTestGame('smashup', {
    p0: 'diy_killers,aliens',
    p1: 'pirates,ninjas',
    seat1: 'local-ai',
    skipFactionSelect: true,
    skipInitialization: false,
    seed,
  }, 45000);

  await game.setupScene({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
      hand: [{ uid: 'michael-card', defId: 'diy_killers_michael_myers', type: 'minion', owner: '0' }],
      deck: [{ uid: 'mask-card', defId: 'diy_killers_captain_kirk_mask', type: 'action', owner: '0' }],
      discard: [],
      factions: ['diy_killers', 'aliens'],
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
        defId: 'base_the_jungle',
        minions: [
          { uid: 'weak-target', defId: 'pirate_saucy_wench', owner: '1', controller: '1' },
          { uid: 'modified-target', defId: 'pirate_buccaneer', owner: '1', controller: '1', powerModifier: -2 },
          { uid: 'filler-target', defId: 'pirate_first_mate', owner: '1', controller: '1' },
        ],
      },
      {
        defId: 'base_the_factory',
        minions: [{ uid: 'off-base-weak', defId: 'pirate_first_mate', owner: '1', controller: '1' }],
      },
    ],
  });

  await game.playCard('diy_killers_michael_myers', { targetBaseIndex: 0 });
  await game.waitForInteraction('diy_killers_signature_search', 10000);
  await game.selectInteractionOptionBy(
    option => optionHasCardUid(option, 'mask-card'),
    '麦克尔检索柯克船长面具',
  );
  await game.waitForNoInteraction(10000);
}

test.describe('大杀四方杀人狂真实入口审计', () => {
  test('派系详情页显示杀人狂卡牌与图集', async ({ page, game }, testInfo) => {
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
    await search.fill('diy_killers');
    const option = page.getByTestId('faction-option-diy_killers');
    await expect(option).toBeVisible({ timeout: 15000 });
    await option.click();

    const detail = page.getByTestId('faction-detail-panel');
    await expect(detail).toBeVisible({ timeout: 10000 });
    await expect(detail.getByRole('heading', { name: '杀人狂' })).toBeVisible();
    await expect(detail.getByText('简易武器').first()).toBeVisible();
    await expect(detail.getByText('大砍刀').first()).toBeVisible();
    await expect(detail.locator('.atlas-shimmer')).toHaveCount(0);
    await game.screenshot('01-杀人狂-派系详情与图集', testInfo);
  });

  test('杰森从真实打牌入口检索大砍刀并完成交互收口', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_killers,aliens',
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
        hand: [{ uid: 'jason-card', defId: 'diy_killers_jason', type: 'minion', owner: '0' }],
        deck: [{ uid: 'machete-card', defId: 'diy_killers_machete', type: 'action', owner: '0' }],
        discard: [],
        factions: ['diy_killers', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: { hand: [], deck: [], discard: [], factions: ['pirates', 'ninjas'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0 },
      bases: [
        { defId: 'base_diy_killers_camp_crystal_lake', minions: [] },
        { defId: 'base_diy_killers_nightmare_world', minions: [] },
      ],
    });

    await game.playCard('diy_killers_jason', { targetBaseIndex: 0 });
    await game.waitForInteraction('diy_killers_signature_search', 10000);
    await game.screenshot('02-杀人狂-杰森签名装备检索', testInfo);
    await game.selectInteractionOptionBy(option => optionHasCardUid(option, 'machete-card'), '杰森检索大砍刀');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        hand: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        baseMinions: state.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      hand: ['machete-card'],
      baseMinions: ['jason-card'],
      interactionOpen: false,
    });
    await game.screenshot('03-杀人狂-杰森检索后收口', testInfo);
  });

  test('钉子头从真实打牌入口检索地狱魔盒并转移己方行动', async ({ page, game }, testInfo) => {
    test.setTimeout(150000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_killers,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260919,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'pinhead-card', defId: 'diy_killers_pinhead', type: 'minion', owner: '0' }],
        deck: [{ uid: 'box-card', defId: 'diy_killers_hell_puzzle_box', type: 'action', owner: '0' }],
        discard: [],
        factions: ['diy_killers', 'aliens'],
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
          defId: 'base_the_factory',
          minions: [
            {
              uid: 'source-minion',
              defId: 'diy_killers_jason',
              owner: '0',
              controller: '0',
              attachedActions: [
                { uid: 'source-action', defId: 'diy_killers_machete', ownerId: '0' },
              ],
            },
          ],
        },
        {
          defId: 'base_the_mothership',
          minions: [
            { uid: 'target-minion', defId: 'pirate_first_mate', owner: '1', controller: '1' },
          ],
        },
      ],
    });

    await game.playCard('diy_killers_pinhead', { targetBaseIndex: 0 });
    await game.waitForInteraction('diy_killers_signature_search', 10000);
    await game.screenshot('10-杀人狂-钉子头检索地狱魔盒', testInfo);
    await game.selectInteractionOptionBy(
      option => option.value?.cardUid === 'box-card',
      '钉子头检索地狱魔盒',
    );
    await game.waitForNoInteraction(10000);

    const pinhead = page.locator('[data-minion-uid="pinhead-card"]');
    await expect(pinhead).toBeVisible({ timeout: 10000 });
    await pinhead.click({ force: true });
    await game.waitForInteraction('diy_killers_pinhead', 10000);
    const pinheadState = await game.getState();
    const pinheadOptions = (pinheadState.sys?.interaction?.current?.data?.options ?? []) as InteractionOption[];
    expect(pinheadOptions.some(option => (
      option.value?.mode === 'transfer'
      && option.value.cardUid === 'source-action'
      && option.value.targetMinionUid === 'target-minion'
    ))).toBe(true);
    await game.screenshot('11-杀人狂-钉子头转移行动目标选择', testInfo);
    await game.selectInteractionOptionBy(
      option => option.value?.mode === 'transfer'
        && option.value?.cardUid === 'source-action'
        && option.value?.targetMinionUid === 'target-minion',
      '钉子头转移己方行动到另一个随从',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const source = state.core.bases[0]?.minions?.find((minion: { uid?: string }) => minion.uid === 'source-minion');
      const target = state.core.bases[1]?.minions?.find((minion: { uid?: string }) => minion.uid === 'target-minion');
      const pinheadState = state.core.bases[0]?.minions?.find((minion: { uid?: string }) => minion.uid === 'pinhead-card');
      return {
        hand: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        sourceAttached: source?.attachedActions?.map((action: { uid?: string }) => action.uid) ?? [],
        targetAttached: target?.attachedActions?.map((action: { uid?: string }) => action.uid) ?? [],
        pinheadTalentUsed: pinheadState?.talentUsed ?? false,
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      hand: ['box-card'],
      sourceAttached: [],
      targetAttached: ['source-action'],
      pinheadTalentUsed: true,
      interactionOpen: false,
    });
    await game.screenshot('12-杀人狂-钉子头转移行动收口', testInfo);
  });

  test('柯克船长面具从真实附着入口累计被摧毁随从的有效力量', async ({ page, game }, testInfo) => {
    test.setTimeout(150000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_killers,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260919,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'mask-card', defId: 'diy_killers_captain_kirk_mask', type: 'action', owner: '0' },
          { uid: 'savage-card', defId: 'diy_killers_savage_attack', type: 'action', owner: '0' },
        ],
        deck: [],
        discard: [],
        factions: ['diy_killers', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 2,
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
          defId: 'base_the_factory',
          minions: [
            { uid: 'mask-host', defId: 'diy_killers_michael_myers', owner: '0', controller: '0' },
            { uid: 'mask-victim', defId: 'pirate_first_mate', owner: '1', controller: '1', powerModifier: 1 },
          ],
        },
        { defId: 'base_the_mothership', minions: [] },
      ],
    });

    await game.playCard('diy_killers_captain_kirk_mask', { targetBaseIndex: 0, targetMinionUid: 'mask-host' });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const host = state.core.bases[0]?.minions?.find((minion: { uid?: string }) => minion.uid === 'mask-host');
      return host?.attachedActions?.map((action: { uid?: string }) => action.uid) ?? [];
    }, { timeout: 10000 }).toEqual(['mask-card']);
    await game.screenshot('13-杀人狂-柯克船长面具已附着', testInfo);

    await game.playCard('diy_killers_savage_attack');
    await game.waitForInteraction('diy_killers_savage_attack', 10000);
    await game.screenshot('14-杀人狂-柯克船长面具摧毁目标选择', testInfo);
    await game.selectInteractionOptionBy(
      option => option.value?.minionUid === 'mask-victim',
      '野蛮攻击摧毁面具测试目标',
    );

    await expect.poll(async () => {
      const state = await game.getState();
      const host = state.core.bases[0]?.minions?.find((minion: { uid?: string }) => minion.uid === 'mask-host');
      const victim = state.core.bases[0]?.minions?.find((minion: { uid?: string }) => minion.uid === 'mask-victim');
      return {
        hostTempPowerModifier: host?.tempPowerModifier ?? 0,
        victimPresent: Boolean(victim),
      };
    }, { timeout: 10000 }).toEqual({
      hostTempPowerModifier: 3,
      victimPresent: false,
    });
    await game.screenshot('15-杀人狂-柯克船长面具自动累计力量', testInfo);

    await game.waitForInteraction('diy_killers_savage_attack_boost', 10000);
    await game.selectInteractionOptionBy(option => option.value?.skip === true, '跳过野蛮攻击额外加力');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      const host = state.core.bases[0]?.minions?.find((minion: { uid?: string }) => minion.uid === 'mask-host');
      const victim = state.core.bases[0]?.minions?.find((minion: { uid?: string }) => minion.uid === 'mask-victim');
      return {
        hostTempPowerModifier: host?.tempPowerModifier ?? 0,
        hostAttached: host?.attachedActions?.map((action: { uid?: string }) => action.uid) ?? [],
        victimPresent: Boolean(victim),
        savageInDiscard: player?.discard?.some((card: { uid?: string }) => card.uid === 'savage-card') ?? false,
        interactionOpen: Boolean(state.sys?.interaction?.current),
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
      };
    }, { timeout: 10000 }).toEqual({
      hostTempPowerModifier: 3,
      hostAttached: ['mask-card'],
      victimPresent: false,
      savageInDiscard: true,
      interactionOpen: false,
      triggerQueueLength: 0,
    });
    await game.screenshot('16-杀人狂-柯克船长面具力量累计收口', testInfo);
  });

  test('野蛮攻击从真实打牌入口按印刷力量和基地条件摧毁并给同基地杀人狂加力', async ({ page, game }, testInfo) => {
    test.setTimeout(150000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_killers,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260919,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'savage-card', defId: 'diy_killers_savage_attack', type: 'action', owner: '0' }],
        deck: [],
        discard: [],
        factions: ['diy_killers', 'aliens'],
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
        actionLimit: 1,
        vp: 0,
      },
      bases: [
        {
          defId: 'base_the_factory',
          minions: [
            { uid: 'killer', defId: 'diy_killers_jason', owner: '0', controller: '0' },
            { uid: 'printed-2-effective-4', defId: 'pirate_first_mate', owner: '1', controller: '1', powerModifier: 2 },
            { uid: 'printed-4-effective-2', defId: 'pirate_buccaneer', owner: '1', controller: '1', powerModifier: -2 },
          ],
        },
        {
          defId: 'base_the_mothership',
          minions: [{ uid: 'off-base-weak', defId: 'pirate_first_mate', owner: '1', controller: '1' }],
        },
      ],
    });

    await game.playCard('diy_killers_savage_attack');
    await game.waitForInteraction('diy_killers_savage_attack', 10000);
    const targetPrompt = await game.getState();
    const targetOptions = (targetPrompt.sys?.interaction?.current?.data?.options ?? []) as InteractionOption[];
    expect(targetOptions.some(option => option.value?.minionUid === 'printed-2-effective-4')).toBe(true);
    expect(targetOptions.some(option => option.value?.minionUid === 'printed-4-effective-2')).toBe(false);
    expect(targetOptions.some(option => option.value?.minionUid === 'off-base-weak')).toBe(false);
    await game.screenshot('17-杀人狂-野蛮攻击目标筛选', testInfo);

    await game.selectInteractionOptionBy(
      option => option.value?.minionUid === 'printed-2-effective-4',
      '选择印刷力量 2 的目标',
    );
    await game.waitForInteraction('diy_killers_savage_attack_boost', 10000);
    const boostPrompt = await game.getState();
    const boostOptions = (boostPrompt.sys?.interaction?.current?.data?.options ?? []) as InteractionOption[];
    expect(boostOptions.some(option => option.value?.minionUid === 'killer')).toBe(true);
    expect(boostOptions.some(option => option.value?.minionUid === 'off-base-weak')).toBe(false);
    await game.screenshot('18-杀人狂-野蛮攻击同基地杀人狂加力选择', testInfo);

    await game.selectInteractionOptionBy(option => option.value?.minionUid === 'killer', '给同基地杀人狂加力');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const base = state.core.bases[0];
      const killer = base?.minions?.find((minion: { uid?: string }) => minion.uid === 'killer');
      return {
        targetPresent: Boolean(base?.minions?.some((minion: { uid?: string }) => minion.uid === 'printed-2-effective-4')),
        excludedTargetPresent: Boolean(base?.minions?.some((minion: { uid?: string }) => minion.uid === 'printed-4-effective-2')),
        offBaseTargetPresent: Boolean(state.core.bases[1]?.minions?.some((minion: { uid?: string }) => minion.uid === 'off-base-weak')),
        killerTempPowerModifier: killer?.tempPowerModifier ?? 0,
        savageInDiscard: state.core.players['0']?.discard?.some((card: { uid?: string }) => card.uid === 'savage-card') ?? false,
        interactionOpen: Boolean(state.sys?.interaction?.current),
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
      };
    }, { timeout: 10000 }).toEqual({
      targetPresent: false,
      excludedTargetPresent: true,
      offBaseTargetPresent: true,
      killerTempPowerModifier: 3,
      savageInDiscard: true,
      interactionOpen: false,
      triggerQueueLength: 0,
    });
    await game.screenshot('19-杀人狂-野蛮攻击生命周期收口', testInfo);
  });

  test('杰森从真实打牌入口完成大砍刀移动、反应摧毁和力量结算', async ({ page, game }, testInfo) => {
    test.setTimeout(180000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_killers,aliens',
      p1: 'pirates,ninjas',
      seat1: 'local-ai',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260919,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'jason-card', defId: 'diy_killers_jason', type: 'minion', owner: '0' }],
        deck: [{ uid: 'machete-card', defId: 'diy_killers_machete', type: 'action', owner: '0' }],
        discard: [],
        factions: ['diy_killers', 'aliens'],
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
        { defId: 'base_the_factory', minions: [] },
        {
          defId: 'base_the_mothership',
          minions: [
            { uid: 'weak-target', defId: 'pirate_first_mate', owner: '1', controller: '1' },
            { uid: 'strong-target', defId: 'pirate_buccaneer', owner: '1', controller: '1' },
          ],
        },
      ],
    });

    await game.playCard('diy_killers_jason', { targetBaseIndex: 0 });
    await game.waitForInteraction('diy_killers_signature_search', 10000);
    await game.selectInteractionOptionBy(option => optionHasCardUid(option, 'machete-card'), '杰森检索大砍刀');
    await game.waitForNoInteraction(10000);

    await game.playCard('diy_killers_machete', { targetBaseIndex: 0, targetMinionUid: 'jason-card' });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const host = state.core.bases[0]?.minions?.find((minion: { uid?: string }) => minion.uid === 'jason-card');
      return {
        hand: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        attached: host?.attachedActions?.map((action: { uid?: string }) => action.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      hand: [],
      attached: ['machete-card'],
      interactionOpen: false,
    });
    await game.screenshot('04-杀人狂-杰森已附着大砍刀', testInfo);

    const jasonHost = page.locator('[data-minion-uid="jason-card"]');
    await page.mouse.move(0, 0);
    await jasonHost.hover();
    await expect(jasonHost).toHaveAttribute('data-attached-overlay-visible', 'true', { timeout: 10000 });
    const machete = page.locator('[data-attached-action-uid="machete-card"]');
    await expect(machete).toBeVisible({ timeout: 10000 });
    await machete.click({ force: true });
    await game.waitForInteraction('diy_killers_machete', 10000);
    await game.screenshot('05-杀人狂-杰森大砍刀选择目标基地', testInfo);
    await game.selectInteractionOptionBy(option => option.value?.toBaseIndex === 1, '大砍刀移动杰森到第二基地');

    await expect.poll(async () => {
      const state = await game.getState();
      return state.core.bases[1]?.minions?.some((minion: { uid?: string }) => minion.uid === 'jason-card') ?? false;
    }, { timeout: 10000 }).toBe(true);

    await game.waitForInteraction('smashup_reaction_choose', 15000);
    const reactionState = await game.getState();
    const reactionOptions = (reactionState.sys?.interaction?.current?.data?.options ?? []) as Array<{
      label?: string;
      value?: { triggerId?: string };
    }>;
    expect(reactionOptions.some(option => option.value?.triggerId?.includes('diy_killers_jason'))).toBe(true);
    await game.screenshot('06-杀人狂-杰森移动后的反应窗口', testInfo);
    await game.selectInteractionOptionBy(
      option => option.value?.triggerId?.includes('diy_killers_jason'),
      '选择杰森移动触发',
    );

    await game.waitForInteraction('diy_killers_jason_destroy', 10000);
    const jasonPromptState = await game.getState();
    const jasonOptions = (jasonPromptState.sys?.interaction?.current?.data?.options ?? []) as Array<{
      value?: { minionUid?: string; skip?: boolean };
    }>;
    expect(jasonOptions.some(option => option.value?.minionUid === 'weak-target')).toBe(true);
    expect(jasonOptions.some(option => option.value?.minionUid === 'strong-target')).toBe(false);
    expect(jasonOptions.some(option => option.value?.skip === true)).toBe(true);
    await game.screenshot('07-杀人狂-杰森力量阈值目标候选', testInfo);
    await game.selectInteractionOptionBy(
      option => option.value?.minionUid === 'weak-target',
      '杰森摧毁力量三或以下目标',
    );

    await game.waitForNoInteraction(15000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const host = state.core.bases[1]?.minions?.find((minion: { uid?: string }) => minion.uid === 'jason-card');
      const weakTarget = state.core.bases[1]?.minions?.find((minion: { uid?: string }) => minion.uid === 'weak-target');
      const strongTarget = state.core.bases[1]?.minions?.find((minion: { uid?: string }) => minion.uid === 'strong-target');
      return {
        weakTargetPresent: Boolean(weakTarget),
        strongTargetPresent: Boolean(strongTarget),
        jasonTempPowerModifier: host?.tempPowerModifier ?? 0,
        jasonUsedTurn: host?.metadata?.diyKillersJasonUsedTurn ?? null,
        interactionOpen: Boolean(state.sys?.interaction?.current),
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
      };
    }, { timeout: 15000 }).toMatchObject({
      weakTargetPresent: false,
      strongTargetPresent: true,
      jasonTempPowerModifier: 3,
      jasonUsedTurn: 1,
      interactionOpen: false,
      triggerQueueLength: 0,
    });
    await game.screenshot('08-杀人狂-杰森摧毁弱目标并叠加力量', testInfo);

    await game.advancePhase();
    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      const host = state.core.bases[1]?.minions?.find((minion: { uid?: string }) => minion.uid === 'jason-card');
      return {
        macheteInHand: player?.hand?.some((card: { uid?: string }) => card.uid === 'machete-card') ?? false,
        jasonTempPowerModifier: host?.tempPowerModifier ?? 0,
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 20000 }).toMatchObject({
      macheteInHand: true,
      jasonTempPowerModifier: 0,
      interactionOpen: false,
    });
    await game.screenshot('09-杀人狂-杰森回合结束大砍刀回手并清除临时力量', testInfo);
  });

  test('麦克尔从真实计分前入口摧毁印刷力量不超过三的同基地随从并继续计分', async ({ page, game }, testInfo) => {
    test.setTimeout(150000);
    await setChineseLocale(page.context());
    await openMichaelScoringScene(game, 20260919);

    await game.advancePhase();
    await game.waitForInteraction('smashup_reaction_choose', 30000);
    const reactionState = await game.getState();
    const reactionOptions = (reactionState.sys?.interaction?.current?.data?.options ?? []) as Array<{
      value?: { triggerId?: string };
    }>;
    expect(reactionOptions.some(option => option.value?.triggerId?.includes('diy_killers_michael_myers'))).toBe(true);
    await game.screenshot('10-杀人狂-麦克尔计分前反应窗口', testInfo);
    await game.selectInteractionOptionBy(
      option => option.value?.triggerId?.includes('diy_killers_michael_myers'),
      '选择麦克尔计分前特殊能力',
    );

    await game.waitForInteraction('diy_killers_michael_myers', 10000);
    const michaelPromptState = await game.getState();
    const michaelOptions = (michaelPromptState.sys?.interaction?.current?.data?.options ?? []) as Array<{
      value?: {
        minionUid?: string;
        targetMinionUid?: string;
        skip?: boolean;
        sourceUid?: string;
        fieldInteractionType?: string;
      };
    }>;
    expect(michaelOptions.some(option => option.value?.targetMinionUid === 'weak-target')).toBe(true);
    expect(michaelOptions.some(option => option.value?.targetMinionUid === 'filler-target')).toBe(true);
    expect(michaelOptions.some(option => option.value?.targetMinionUid === 'modified-target')).toBe(false);
    expect(michaelOptions.some(option => option.value?.targetMinionUid === 'off-base-weak')).toBe(false);
    expect(michaelOptions.some(option => option.value?.skip === true)).toBe(true);
    expect(michaelOptions.filter(option => option.value?.targetMinionUid === 'weak-target')[0]?.value).toMatchObject({
      sourceUid: 'michael-card',
      fieldInteractionType: 'source-target',
    });
    await game.screenshot('11-杀人狂-麦克尔按印刷力量筛选目标', testInfo);
    await game.selectInteractionOptionBy(
      option => option.value?.targetMinionUid === 'weak-target',
      '麦克尔摧毁印刷力量三的目标',
    );

    await game.waitForNoInteraction(20000);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        player0Vp: state.core.players['0']?.vp ?? 0,
        player1Vp: state.core.players['1']?.vp ?? 0,
        offBaseWeakPresent: state.core.bases.some((base: { minions?: Array<{ uid?: string }> }) =>
          base.minions?.some(minion => minion.uid === 'off-base-weak') ?? false,
        ),
        interactionOpen: Boolean(state.sys?.interaction?.current),
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
      };
    }, { timeout: 20000 }).toEqual({
      player0Vp: 2,
      player1Vp: 0,
      offBaseWeakPresent: true,
      interactionOpen: false,
      triggerQueueLength: 0,
    });
    await game.screenshot('12-杀人狂-麦克尔摧毁目标后计分收口', testInfo);
  });

  test('麦克尔计分前特殊能力可以跳过并保留原始计分结果', async ({ page, game }, testInfo) => {
    test.setTimeout(150000);
    await setChineseLocale(page.context());
    await openMichaelScoringScene(game, 20260920);

    await game.advancePhase();
    await game.waitForInteraction('smashup_reaction_choose', 30000);
    await game.selectInteractionOptionBy(
      option => option.value?.triggerId?.includes('diy_killers_michael_myers'),
      '选择麦克尔计分前特殊能力',
    );
    await game.waitForInteraction('diy_killers_michael_myers', 10000);

    const promptState = await game.getState();
    const options = (promptState.sys?.interaction?.current?.data?.options ?? []) as Array<{
      value?: { targetMinionUid?: string; skip?: boolean };
    }>;
    expect(options.some(option => option.value?.targetMinionUid === 'weak-target')).toBe(true);
    expect(options.some(option => option.value?.skip === true)).toBe(true);
    await game.screenshot('13-杀人狂-麦克尔计分前跳过选项', testInfo);
    await game.selectInteractionOptionBy(
      option => option.value?.skip === true,
      '麦克尔跳过摧毁',
    );

    await game.waitForNoInteraction(20000);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        player0Vp: state.core.players['0']?.vp ?? 0,
        player1Vp: state.core.players['1']?.vp ?? 0,
        interactionOpen: Boolean(state.sys?.interaction?.current),
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
      };
    }, { timeout: 20000 }).toEqual({
      player0Vp: 0,
      player1Vp: 2,
      interactionOpen: false,
      triggerQueueLength: 0,
    });
    await game.screenshot('14-杀人狂-麦克尔跳过后计分收口', testInfo);
  });

  test('简易武器从真实打牌入口抽取并实际消费限定额外行动', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_killers,aliens',
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
        hand: [{ uid: 'weapon', defId: 'diy_killers_improvised_weapon', type: 'action', owner: '0' }],
        deck: [
          { uid: 'not-matching', defId: 'diy_killers_oh_no', type: 'action', owner: '0' },
          { uid: 'machete', defId: 'diy_killers_machete', type: 'action', owner: '0' },
        ],
        discard: [],
        factions: ['diy_killers', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: { hand: [], deck: [], discard: [], factions: ['pirates', 'ninjas'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0 },
      bases: [
        {
          defId: 'base_diy_killers_camp_crystal_lake',
          minions: [{ uid: 'host', defId: 'diy_killers_jason', owner: '0', controller: '0' }],
        },
        { defId: 'base_diy_killers_nightmare_world', minions: [] },
      ],
    });

    await game.playCard('diy_killers_improvised_weapon');
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        hand: player?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        restricted: player?.specificExtraActionPlays?.map((entry: { cardUid?: string; destroyAttachedActionAtTurnEnd?: boolean }) => ({
          cardUid: entry.cardUid,
          destroyAttachedActionAtTurnEnd: entry.destroyAttachedActionAtTurnEnd,
        })) ?? [],
      };
    }, { timeout: 10000 }).toEqual({
      hand: ['machete'],
      restricted: [{ cardUid: 'machete', destroyAttachedActionAtTurnEnd: true }],
    });
    await game.screenshot('04-杀人狂-简易武器抽到限定附着行动', testInfo);

    await game.playCard('diy_killers_machete', { targetBaseIndex: 0, targetMinionUid: 'host' });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      const host = state.core.bases[0]?.minions?.find((minion: { uid?: string }) => minion.uid === 'host');
      return {
        hand: player?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        discard: player?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        restricted: player?.specificExtraActionPlays ?? [],
        attached: host?.attachedActions?.map((action: { uid?: string; metadata?: Record<string, unknown> }) => ({ uid: action.uid, metadata: action.metadata })) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      hand: [],
      discard: ['weapon'],
      restricted: [],
      attached: [{ uid: 'machete', metadata: expect.objectContaining({
        diyKillersImprovisedWeaponControllerId: '0',
      }) }],
      interactionOpen: false,
    });
    await game.screenshot('05-杀人狂-简易武器限定行动已附着', testInfo);
  });

  test('人皮脸从真实打牌入口检索电锯并在下一回合触发摧毁', async ({ page, game }, testInfo) => {
    test.setTimeout(150000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_killers,aliens',
      p1: 'pirates,ninjas',
      seat1: 'local-ai',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260919,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'leatherface-card', defId: 'diy_killers_leatherface', type: 'minion', owner: '0' }],
        deck: [{ uid: 'chainsaw-card', defId: 'diy_killers_chainsaw', type: 'action', owner: '0' }],
        discard: [],
        factions: ['diy_killers', 'aliens'],
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
          defId: 'base_the_factory',
          minions: [{ uid: 'weak-target', defId: 'ghosts_spectre', owner: '1', controller: '1' }],
        },
        { defId: 'base_diy_killers_nightmare_world', minions: [] },
      ],
    });

    await game.playCard('diy_killers_leatherface', { targetBaseIndex: 0 });
    await game.waitForInteraction('diy_killers_signature_search', 10000);
    await game.screenshot('06-杀人狂-人皮脸检索电锯', testInfo);
    await game.selectInteractionOptionBy(
      option => option.value?.cardUid === 'chainsaw-card',
      '人皮脸选择牌库中的电锯',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        hand: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        baseMinions: state.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
      };
    }, { timeout: 10000 }).toEqual({
      hand: ['chainsaw-card'],
      baseMinions: ['weak-target', 'leatherface-card'],
    });

    await page.locator('[data-card-uid="chainsaw-card"]').click({ force: true });
    await expect(page.locator('[data-minion-uid="leatherface-card"]')).toHaveAttribute(
      'data-highlighted',
      'true',
      { timeout: 10000 },
    );
    await page.locator('[data-minion-uid="leatherface-card"]').click({ force: true });
    await page.waitForTimeout(300);
    const postChainsawState = await game.getState();
    const postChainsawLeatherface = postChainsawState.core.bases[0]?.minions?.find(
      (minion: { uid?: string }) => minion.uid === 'leatherface-card',
    );
    expect(postChainsawState.core.players['0']?.hand?.some((card: { uid?: string }) => card.uid === 'chainsaw-card')).toBe(false);
    expect(postChainsawLeatherface?.attachedActions?.some((action: { uid?: string }) => action.uid === 'chainsaw-card')).toBe(true);
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const leatherface = state.core.bases[0]?.minions?.find((minion: { uid?: string }) => minion.uid === 'leatherface-card');
      return {
        hand: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        attached: leatherface?.attachedActions?.map((action: { uid?: string }) => action.uid) ?? [],
        powerCounters: leatherface?.powerCounters ?? 0,
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      hand: [],
      attached: ['chainsaw-card'],
      powerCounters: 0,
      interactionOpen: false,
    });
    await game.screenshot('07-杀人狂-人皮脸已附着电锯', testInfo);

    await game.advancePhase();
    await game.waitForInteraction('smashup_reaction_choose', 30000);
    await game.screenshot('08-杀人狂-人皮脸下一回合反应窗口', testInfo);

    await game.selectInteractionOptionBy(
      option => option.value?.triggerId && /人皮脸|leatherface/i.test(String(option.label ?? '')),
      '人皮脸反应触发',
    );
    await game.waitForInteraction('diy_killers_leatherface_destroy', 10000);
    await game.screenshot('09-杀人狂-人皮脸选择摧毁目标', testInfo);
    await game.selectInteractionOptionBy(
      option => option.value?.minionUid === 'weak-target',
      '人皮脸摧毁力量三或以下目标',
    );

    await game.waitForInteraction('smashup_reaction_choose', 10000);
    await game.screenshot('10-杀人狂-人皮脸摧毁后电锯响应窗口', testInfo);
    await game.selectInteractionOptionBy(
      option => option.value?.triggerId && /电锯|chainsaw/i.test(String(option.label ?? '')),
      '电锯摧毁后可选移动触发',
    );
    await game.waitForInteraction('diy_killers_chainsaw_move', 10000);
    await game.screenshot('11-杀人狂-电锯移动宿主选择', testInfo);
    await game.selectInteractionOptionBy(
      option => option.id === 'pass' || option.value?.kind === 'pass' || option.value?.skip === true || /不移动|让过|skip/i.test(String(option.label ?? '')),
      '电锯让过移动宿主',
    );

    await expect.poll(async () => {
      const state = await game.getState();
      const leatherface = state.core.bases[0]?.minions?.find((minion: { uid?: string }) => minion.uid === 'leatherface-card');
      return {
        remainingMinions: state.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        powerCounters: leatherface?.powerCounters ?? 0,
        usedTurn: leatherface?.metadata?.diyKillersLeatherfaceUsedTurn ?? null,
        triggerQueue: state.core.triggerQueue ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
        interactionSource: state.sys?.interaction?.current?.data?.sourceId ?? null,
        queuedInteractions: state.sys?.interaction?.queue?.map((interaction: { data?: { sourceId?: string } }) => interaction.data?.sourceId ?? null) ?? [],
      };
    }, { timeout: 15000 }).toEqual({
      remainingMinions: ['leatherface-card'],
      powerCounters: 1,
      usedTurn: expect.any(Number),
      triggerQueue: [],
      interactionOpen: false,
      interactionSource: null,
      queuedInteractions: [],
    });
    await game.screenshot('12-杀人狂-人皮脸摧毁目标并完成生命周期收口', testInfo);
  });

  test('弗莱迪从真实打牌入口检索爪子手套并完成天赋摧毁生命周期', async ({ page, game }, testInfo) => {
    test.setTimeout(150000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_killers,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260919,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'freddy-card', defId: 'diy_killers_freddy_krueger', type: 'minion', owner: '0' }],
        deck: [{ uid: 'glove-card', defId: 'diy_killers_clawed_glove', type: 'action', owner: '0' }],
        discard: [],
        factions: ['diy_killers', 'aliens'],
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
          defId: 'base_the_factory',
          minions: [
            { uid: 'weak-target', defId: 'ghost_ghost', owner: '1', controller: '1' },
            { uid: 'strong-target', defId: 'ghost_spirit', owner: '1', controller: '1' },
          ],
        },
        { defId: 'base_diy_killers_nightmare_world', minions: [] },
      ],
    });

    await game.playCard('diy_killers_freddy_krueger', { targetBaseIndex: 0 });
    await game.waitForInteraction('diy_killers_signature_search', 10000);
    await game.screenshot('13-杀人狂-弗莱迪检索爪子手套', testInfo);
    await game.selectInteractionOptionBy(
      option => option.value?.cardUid === 'glove-card',
      '弗莱迪选择牌库中的爪子手套',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        hand: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        baseMinions: state.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
      };
    }, { timeout: 10000 }).toEqual({
      hand: ['glove-card'],
      baseMinions: ['weak-target', 'strong-target', 'freddy-card'],
    });

    await page.locator('[data-card-uid="glove-card"]').click({ force: true });
    await expect(page.locator('[data-minion-uid="freddy-card"]')).toHaveAttribute(
      'data-highlighted',
      'true',
      { timeout: 10000 },
    );
    await page.locator('[data-minion-uid="freddy-card"]').click({ force: true });
    await page.waitForTimeout(300);
    const postGloveState = await game.getState();
    const postGloveFreddy = postGloveState.core.bases[0]?.minions?.find(
      (minion: { uid?: string }) => minion.uid === 'freddy-card',
    );
    expect(postGloveState.core.players['0']?.hand?.some((card: { uid?: string }) => card.uid === 'glove-card')).toBe(false);
    expect(postGloveFreddy?.attachedActions?.some((action: { uid?: string }) => action.uid === 'glove-card')).toBe(true);
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const freddy = state.core.bases[0]?.minions?.find((minion: { uid?: string }) => minion.uid === 'freddy-card');
      return {
        hand: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        attached: freddy?.attachedActions?.map((action: { uid?: string }) => action.uid) ?? [],
        powerCounters: freddy?.powerCounters ?? 0,
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      hand: [],
      attached: ['glove-card'],
      powerCounters: 0,
      interactionOpen: false,
    });
    await game.screenshot('14-杀人狂-弗莱迪已附着爪子手套', testInfo);

    await page.locator('[data-minion-uid="freddy-card"]').click({ force: true });
    await game.waitForInteraction('diy_killers_freddy_krueger_destroy', 10000);
    const talentPromptState = await game.getState();
    const talentOptions = (talentPromptState.sys?.interaction?.current?.data?.options ?? []) as Array<{
      value?: { minionUid?: string; skip?: boolean };
    }>;
    expect(talentOptions.some(option => option.value?.minionUid === 'weak-target')).toBe(true);
    expect(talentOptions.some(option => option.value?.minionUid === 'strong-target')).toBe(false);
    expect(talentOptions.some(option => option.value?.skip === true)).toBe(true);
    await game.screenshot('15-杀人狂-弗莱迪天赋减力量后目标候选', testInfo);
    await game.selectInteractionOptionBy(
      option => option.value?.minionUid === 'weak-target',
      '弗莱迪摧毁减益后力量一目标',
    );

    await game.waitForNoInteraction(15000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const base = state.core.bases[0];
      const freddy = base?.minions?.find((minion: { uid?: string }) => minion.uid === 'freddy-card');
      const strong = base?.minions?.find((minion: { uid?: string }) => minion.uid === 'strong-target');
      return {
        remainingMinions: base?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        weakStillPresent: Boolean(base?.minions?.some((minion: { uid?: string }) => minion.uid === 'weak-target')),
        strongPowerModifier: strong?.powerModifier ?? 0,
        freddyTalentUsed: freddy?.talentUsed ?? false,
        freddyPowerCounters: freddy?.powerCounters ?? 0,
        triggerQueue: state.core.triggerQueue ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 15000 }).toEqual({
      remainingMinions: ['strong-target', 'freddy-card'],
      weakStillPresent: false,
      strongPowerModifier: -1,
      freddyTalentUsed: true,
      freddyPowerCounters: 1,
      triggerQueue: [],
      interactionOpen: false,
    });
    await game.screenshot('16-杀人狂-弗莱迪摧毁目标并完成爪子手套触发收口', testInfo);
  });

  test('爪子手套从真实附着天赋入口给同基地仆从减力并在下回合开始清除', async ({ page, game }, testInfo) => {
    test.setTimeout(150000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'diy_killers,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260923,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'glove-card', defId: 'diy_killers_clawed_glove', type: 'action', owner: '0' }],
        deck: [],
        discard: [],
        factions: ['diy_killers', 'aliens'],
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
          defId: 'base_the_factory',
          minions: [
            { uid: 'freddy-card', defId: 'diy_killers_freddy_krueger', owner: '0', controller: '0' },
            { uid: 'weak-target', defId: 'ghost_ghost', owner: '1', controller: '1' },
            { uid: 'strong-target', defId: 'ghost_spirit', owner: '1', controller: '1' },
          ],
        },
        { defId: 'base_the_mothership', minions: [] },
      ],
    });

    await game.playCard('diy_killers_clawed_glove', { targetBaseIndex: 0, targetMinionUid: 'freddy-card' });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const freddy = state.core.bases[0]?.minions?.find((minion: { uid?: string }) => minion.uid === 'freddy-card');
      return {
        hand: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        attached: freddy?.attachedActions?.map((action: { uid?: string }) => action.uid) ?? [],
      };
    }, { timeout: 10000 }).toEqual({
      hand: [],
      attached: ['glove-card'],
    });
    await game.screenshot('17-杀人狂-爪子手套真实附着', testInfo);

    const attachedGlove = page.locator('[data-attached-action-uid="glove-card"]');
    await page.locator('[data-minion-uid="freddy-card"]').hover();
    await expect(attachedGlove).toBeVisible({ timeout: 10000 });
    const attachedHitSamples = await attachedGlove.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const fractions = Array.from({ length: 9 }, (_, index) => (index + 1) / 10);
      return fractions.flatMap(xFraction => fractions.map(yFraction => {
        const x = rect.left + rect.width * xFraction;
        const y = rect.top + rect.height * yFraction;
        const frontmost = document.elementFromPoint(x, y);
        return {
          x,
          y,
          uid: frontmost?.closest('[data-attached-action-uid]')?.getAttribute('data-attached-action-uid') ?? null,
        };
      }));
    });
    const attachedHitPoint = attachedHitSamples.find(sample => sample.uid === 'glove-card');
    if (!attachedHitPoint) {
      throw new Error(`爪子手套附着卡没有可真实命中的前景区域；hit samples=${JSON.stringify(attachedHitSamples)}`);
    }
    await page.mouse.move(attachedHitPoint.x, attachedHitPoint.y);
    await page.waitForTimeout(200);
    const attachedHitTarget = await page.evaluate(({ x, y }) => {
      const frontmost = document.elementFromPoint(x, y);
      return frontmost?.closest('[data-attached-action-uid]')?.getAttribute('data-attached-action-uid') ?? null;
    }, attachedHitPoint);
    expect(attachedHitTarget).toBe('glove-card');
    await page.mouse.click(attachedHitPoint.x, attachedHitPoint.y);
    await game.waitForInteraction('diy_killers_clawed_glove', 10000);
    const promptState = await game.getState();
    const promptOptions = (promptState.sys?.interaction?.current?.data?.options ?? []) as Array<{
      value?: { minionUid?: string };
    }>;
    expect(promptOptions.some(option => option.value?.minionUid === 'weak-target')).toBe(true);
    expect(promptOptions.some(option => option.value?.minionUid === 'strong-target')).toBe(true);
    await game.screenshot('18-杀人狂-爪子手套同基地目标选择', testInfo);
    await game.selectInteractionOptionBy(
      option => option.value?.minionUid === 'weak-target',
      '爪子手套选择同基地目标',
    );

    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const base = state.core.bases[0];
      const target = base?.minions?.find((minion: { uid?: string }) => minion.uid === 'weak-target');
      const freddy = base?.minions?.find((minion: { uid?: string }) => minion.uid === 'freddy-card');
      return {
        targetPowerModifier: target?.powerModifier ?? 0,
        attached: freddy?.attachedActions?.map((action: { uid?: string }) => action.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
      };
    }, { timeout: 10000 }).toEqual({
      targetPowerModifier: -1,
      attached: ['glove-card'],
      interactionOpen: false,
      triggerQueueLength: 0,
    });
    await game.screenshot('19-杀人狂-爪子手套减力收口', testInfo);

    await game.advancePhase();
    await expect.poll(async () => {
      const state = await game.getState();
      const target = state.core.bases[0]?.minions?.find((minion: { uid?: string }) => minion.uid === 'weak-target');
      return {
        targetPowerModifier: target?.powerModifier ?? 0,
        interactionOpen: Boolean(state.sys?.interaction?.current),
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
      };
    }, { timeout: 20000 }).toEqual({
      targetPowerModifier: 0,
      interactionOpen: false,
      triggerQueueLength: 0,
    });
    await game.screenshot('20-杀人狂-爪子手套下回合开始清除减力', testInfo);
  });
});
