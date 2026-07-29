import { test, expect } from '../framework';
import { setChineseLocale } from '../helpers/common';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  clearEvidenceScreenshotsForTest,
  getEvidenceScreenshotPath,
  withJpegEvidenceScreenshotOptions,
} from '../framework/evidenceScreenshots';
import type { Locator, Page, TestInfo } from '@playwright/test';

type InteractionOption = {
  value?: {
    cardUid?: string;
    minionUid?: string;
    playerId?: string;
    choice?: string;
  };
};

type HalfTheBattleState = {
  core: {
    bases: Array<{
      minions: Array<{
        uid: string;
        defId?: string;
        owner?: string;
        controller?: string;
        talentUsed?: boolean;
        powerCounters?: number;
        attachedActions?: Array<{
          uid: string;
          defId: string;
          ownerId: string;
          metadata?: Record<string, unknown>;
        }>;
      }>;
      ongoingActions?: Array<{
        uid: string;
        defId: string;
        ownerId: string;
        talentUsed?: boolean;
      }>;
    }>;
    players: Record<string, {
      hand: Array<{ uid: string; defId: string }>;
      deck: Array<{ uid: string; defId: string }>;
      discard: Array<{ uid: string; defId: string }>;
    }>;
    triggerQueue?: unknown[];
  };
  sys: {
    phase?: string;
    interaction?: { current?: unknown } | null;
    responseWindow?: { current?: unknown } | null;
  };
};

const expectNoPendingFlow = async (game: { getState: () => Promise<HalfTheBattleState> }) => {
  await expect.poll(async () => {
    const state = await game.getState();
    return {
      interactionOpen: Boolean(state.sys.interaction?.current),
      responseWindowOpen: Boolean(state.sys.responseWindow?.current),
      triggerQueueLength: state.core.triggerQueue?.length ?? 0,
    };
  }, { timeout: 10000 }).toEqual({
    interactionOpen: false,
    responseWindowOpen: false,
    triggerQueueLength: 0,
  });
};

const waitForAnyInteractionSource = async (page: Page, sourceIds: string[], timeout = 10000): Promise<string> => {
  const handle = await page.waitForFunction((ids) => {
    const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
    const sourceId = state?.sys?.interaction?.current?.data?.sourceId;
    return ids.includes(sourceId) ? sourceId : false;
  }, sourceIds, { timeout, polling: 200 });
  return await handle.jsonValue() as string;
};

const saveVisibleClipEvidence = async (page: Page, locator: Locator, testInfo: TestInfo, name: string): Promise<void> => {
  const path = getEvidenceScreenshotPath(testInfo, name, {
    filename: `${name}.jpg`,
  });
  await mkdir(dirname(path), { recursive: true });
  await expect(locator).toBeVisible({ timeout: 15000 });
  const box = await locator.boundingBox();
  expect(box, `未获取到 ${name} 截图目标边界`).not.toBeNull();
  expect(box!.width, `${name} 截图目标宽度过小，可能只截到背景边角`).toBeGreaterThan(80);
  expect(box!.height, `${name} 截图目标高度过小，可能只截到背景边角`).toBeGreaterThan(110);
  const viewport = page.viewportSize();
  expect(viewport, '截图前应存在 viewport').not.toBeNull();
  const padding = 12;
  const x = Math.max(box!.x - padding, 0);
  const y = Math.max(box!.y - padding, 0);
  const right = Math.min(box!.x + box!.width + padding, viewport!.width);
  const bottom = Math.min(box!.y + box!.height + padding, viewport!.height);
  await page.screenshot(withJpegEvidenceScreenshotOptions({
    path,
    animations: 'disabled',
    scale: 'device',
    clip: {
      x,
      y,
      width: right - x,
      height: bottom - y,
    },
  }));
};

test.describe('SmashUp 半场战争扩四派系真实入口验证', () => {
  test('派系选择页能看到忍者神龟、特种部队杰拉尔德、宇宙的巨人希曼、珍珠和幻像', async ({ page, game }, testInfo) => {
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

    await clearEvidenceScreenshotsForTest(testInfo);
    const factionIds = [
      { id: 'adolescent_epic_geckos', name: '忍者神龟' },
      { id: 'gi_gerald', name: '特种部队杰拉尔德' },
      { id: 'rulers_of_the_cosmos', name: '宇宙的巨人希曼' },
      { id: 'pearl_and_the_images', name: '珍珠和幻像' },
    ];

    const searchInput = page.getByTestId('faction-search-input');
    await expect(searchInput).toBeVisible({ timeout: 15000 });

    for (const faction of factionIds) {
      await searchInput.fill(faction.name);
      const option = page.getByTestId(`faction-option-${faction.id}`);
      await option.scrollIntoViewIfNeeded({ timeout: 15000 });
      await expect(option).toBeVisible({ timeout: 15000 });
      await expect(option.locator('.atlas-shimmer')).toHaveCount(0, { timeout: 15000 });
      await saveVisibleClipEvidence(page, option, testInfo, `${faction.name}派系选择网格卡片`);

      await option.click();
      const detailPanel = page.getByTestId('faction-detail-panel');
      await expect(detailPanel).toBeVisible({ timeout: 15000 });
      await expect(detailPanel).toContainText(faction.name, { timeout: 15000 });
      await expect(detailPanel.locator('.atlas-shimmer')).toHaveCount(0, { timeout: 15000 });
      await expect(page.getByTestId('faction-preview-card').first()).toBeVisible({ timeout: 15000 });
      await saveVisibleClipEvidence(page, detailPanel, testInfo, `${faction.name}派系详情面板`);

      await page.getByTestId('faction-detail-close').click();
      await expect(detailPanel).toHaveCount(0, { timeout: 10000 });
      await searchInput.fill('');
    }
  });

  test('希瑞真实天赋入口会临时贴上弃牌堆战术，并在回合结束置于所有者牌库底', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());

    await game.openTestGame('smashup', {
      p0: 'rulers_of_the_cosmos,adolescent_epic_geckos',
      p1: 'rulers_of_the_cosmos,pearl_and_the_images',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260728,
    }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        factions: ['rulers_of_the_cosmos', 'adolescent_epic_geckos'],
        hand: [],
        deck: [],
        discard: [],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: {
        factions: ['rulers_of_the_cosmos', 'pearl_and_the_images'],
        hand: [],
        deck: [],
        discard: [
          { uid: 'p1-magic-weapon', defId: 'rulers_cosmos_magic_weapon', type: 'action', owner: '1' },
        ],
      },
      bases: [
        {
          defId: 'base_power_castle',
          minions: [
            { uid: 'gal-woman', defId: 'rulers_cosmos_gal_woman', owner: '0', controller: '0', talentUsed: false },
          ],
          ongoingActions: [],
        },
        {
          defId: 'base_slime_pool',
          minions: [
            { uid: 'gecko-target', defId: 'geckos_hokusai', owner: '0', controller: '0', talentUsed: false },
          ],
          ongoingActions: [],
        },
      ],
    });

    await game.waitForPhase('playCards');
    await game.waitForCurrentPlayer('0');

    const galWoman = page.locator('[data-minion-uid="gal-woman"]').first();
    await expect(galWoman).toBeVisible({ timeout: 15000 });
    await game.screenshot('希瑞天赋发动前', testInfo);

    await galWoman.click({ force: true });
    await game.waitForInteraction('rulers_cosmos_gal_woman', 10000);
    await game.screenshot('希瑞选择弃牌堆战术', testInfo);

    await game.selectInteractionOptionBy(
      (option: InteractionOption) => option.value?.cardUid === 'p1-magic-weapon',
      '希瑞选择对手弃牌堆魔法武器',
    );

    await game.waitForInteraction('rulers_cosmos_gal_woman_target', 10000);
    await game.screenshot('希瑞选择附着目标', testInfo);

    await game.selectInteractionOptionBy(
      (option: InteractionOption) => option.value?.minionUid === 'gecko-target',
      '希瑞选择己方北斋为附着目标',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState() as HalfTheBattleState;
      const target = state.core.bases[1].minions.find((minion) => minion.uid === 'gecko-target');
      return {
        attachedWeapon: target?.attachedActions?.some((action) =>
          action.uid === 'p1-magic-weapon'
          && action.defId === 'rulers_cosmos_magic_weapon'
          && action.ownerId === '1'
          && action.metadata?.halfTheBattleGalWomanTemporary === true,
        ) ?? false,
        removedFromDiscard: !state.core.players['1'].discard.some((card) => card.uid === 'p1-magic-weapon'),
        galTalentUsed: state.core.bases[0].minions.find((minion) => minion.uid === 'gal-woman')?.talentUsed ?? false,
      };
    }, { timeout: 10000 }).toEqual({
      attachedWeapon: true,
      removedFromDiscard: true,
      galTalentUsed: true,
    });

    await game.screenshot('希瑞临时战术已贴上', testInfo);

    await game.advancePhase();

    await expect.poll(async () => {
      const state = await game.getState() as HalfTheBattleState;
      const target = state.core.bases[1].minions.find((minion) => minion.uid === 'gecko-target');
      return {
        stillAttached: target?.attachedActions?.some((action) => action.uid === 'p1-magic-weapon') ?? false,
        p1DeckBottom: state.core.players['1'].deck.at(-1)?.uid ?? null,
        p1DiscardHasWeapon: state.core.players['1'].discard.some((card) => card.uid === 'p1-magic-weapon'),
      };
    }, { timeout: 15000 }).toEqual({
      stillAttached: false,
      p1DeckBottom: 'p1-magic-weapon',
      p1DiscardHasWeapon: false,
    });

    await expectNoPendingFlow(game);
    await game.screenshot('希瑞回合结束临时战术置底', testInfo);
  });

  test('玩乐一整夜真实持续战术入口会让被选玩家在该基地额外打出低战力随从并给奖励', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());

    await game.openTestGame('smashup', {
      p0: 'pearl_and_the_images,adolescent_epic_geckos',
      p1: 'adolescent_epic_geckos,rulers_of_the_cosmos',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260729,
    }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        factions: ['pearl_and_the_images', 'adolescent_epic_geckos'],
        hand: [],
        deck: [
          { uid: 'p0-reward-card', defId: 'geckos_june', type: 'minion', owner: '0' },
        ],
        discard: [],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: {
        factions: ['adolescent_epic_geckos', 'rulers_of_the_cosmos'],
        hand: [
          { uid: 'p1-extra-minion', defId: 'geckos_june', type: 'minion', owner: '1' },
        ],
        deck: [],
        discard: [],
      },
      bases: [
        {
          defId: 'base_concert_venue',
          minions: [
            { uid: 'pearl', defId: 'pearl_images_pearl', owner: '0', controller: '0', talentUsed: false },
          ],
          ongoingActions: [
            { uid: 'jam-all-night', defId: 'pearl_images_jam_all_night_long', ownerId: '0', talentUsed: false },
          ],
        },
      ],
    });

    await game.waitForPhase('playCards');
    await game.waitForCurrentPlayer('0');

    const jam = page.locator('[data-ongoing-uid="jam-all-night"]').first();
    await expect(jam).toBeVisible({ timeout: 15000 });
    await game.screenshot('玩乐一整夜天赋发动前', testInfo);

    await jam.click({ force: true });
    await game.waitForInteraction('pearl_images_jam_all_night_long', 10000);
    await game.screenshot('玩乐一整夜选择玩家', testInfo);

    await game.selectInteractionOptionBy(
      (option: InteractionOption) => option.value?.playerId === '1',
      '玩乐一整夜选择玩家 1',
    );

    const nextSource = await waitForAnyInteractionSource(page, [
      'pearl_images_jam_all_night_long_minion',
      'pearl_images_jam_all_night_long_reward',
    ], 10000);
    if (nextSource === 'pearl_images_jam_all_night_long_minion') {
      await game.screenshot('玩乐一整夜被选玩家选择低战力随从', testInfo);
      await game.selectInteractionOptionBy(
        (option: InteractionOption) => option.value?.cardUid === 'p1-extra-minion',
        '玩乐一整夜被选玩家打出爱普莉尔',
      );
      await game.waitForInteraction('pearl_images_jam_all_night_long_reward', 10000);
    } else {
      await game.screenshot('玩乐一整夜被选玩家已自动打出低战力随从', testInfo);
    }
    await game.screenshot('玩乐一整夜奖励选择', testInfo);

    await game.selectInteractionOptionBy(
      (option: InteractionOption) => option.value?.choice === 'draw',
      '玩乐一整夜奖励抓牌',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState() as HalfTheBattleState;
      return {
        extraMinionOnBase: state.core.bases[0].minions.some((minion) =>
          minion.uid === 'p1-extra-minion'
          && minion.owner === '1'
          && minion.controller === '1',
        ),
        p1HandEmpty: state.core.players['1'].hand.length === 0,
        rewardDrawn: state.core.players['0'].hand.some((card) => card.uid === 'p0-reward-card'),
        rewardDeckEmpty: state.core.players['0'].deck.length === 0,
        jamTalentUsed: state.core.bases[0].ongoingActions?.find((action) => action.uid === 'jam-all-night')?.talentUsed ?? false,
        interactionOpen: Boolean(state.sys.interaction?.current),
        responseWindowOpen: Boolean(state.sys.responseWindow?.current),
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
      };
    }, { timeout: 10000 }).toEqual({
      extraMinionOnBase: true,
      p1HandEmpty: true,
      rewardDrawn: true,
      rewardDeckEmpty: true,
      jamTalentUsed: true,
      interactionOpen: false,
      responseWindowOpen: false,
      triggerQueueLength: 0,
    });

    await game.screenshot('玩乐一整夜已完成奖励收口', testInfo);
  });
});
