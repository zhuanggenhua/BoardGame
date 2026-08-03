import { test, expect } from '../framework';
import { setChineseLocale } from '../helpers/common';
import { clearEvidenceScreenshotsForTest } from '../framework/evidenceScreenshots';
import { SU_COMMANDS } from '../../src/games/smashup/domain/types';

type InteractionOption = {
  value?: {
    cardUid?: string;
    source?: string;
  };
};

type SmashUpE2EState = {
  core: {
    bases: Array<{
      minions: Array<{
        uid: string;
        defId: string;
        metadata?: Record<string, unknown>;
      }>;
      ongoingActions?: Array<{
        uid: string;
        defId: string;
        ownerId: string;
      }>;
    }>;
    players: Record<string, {
      deck: Array<{ uid: string; defId: string }>;
      hand: Array<{ uid: string; defId: string }>;
      discard: Array<{ uid: string; defId: string }>;
      minionsPlayed?: number;
      minionLimit?: number;
    }>;
  };
  sys: {
    phase?: string;
    interaction?: { current?: unknown } | null;
    responseWindow?: { current?: unknown } | null;
  };
};

const FIVE_FACTIONS = [
  { id: 'action_heroes', name: '动作英雄', baseSlots: [0, 1] },
  { id: 'backtimers', name: '返时者', baseSlots: [2, 3] },
  { id: 'extramorphs', name: '异形变体', baseSlots: [4, 5] },
  { id: 'teens', name: '青少年', baseSlots: [6, 7] },
  { id: 'wraithrustlers', name: '怨灵捕手', baseSlots: [8, 9] },
] as const;

const EXCELLENT_MOVIES_TEENS_BASE_ATLAS = 'smashup:excellent-movies-teens-bases';

test.describe('SmashUp Excellent Movies + Teens 五派系真实入口验证', () => {
  test('派系选择页可看到五个已完成派系，并能显示卡牌与基地详情', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await clearEvidenceScreenshotsForTest(testInfo);

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
            '0': { id: '0', vp: 0, hand: [], deck: [], discard: [], factions: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1 },
            '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], factions: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1 },
          },
          factionSelection: {
            takenFactions: [],
            playerSelections: { '0': [], '1': [] },
            completedPlayers: [],
          },
        },
      },
    });

    const searchInput = page.getByTestId('faction-search-input');
    await expect(searchInput).toBeVisible({ timeout: 15000 });

    for (const faction of FIVE_FACTIONS) {
      await searchInput.fill(faction.name);
      const option = page.getByTestId(`faction-option-${faction.id}`);
      await option.scrollIntoViewIfNeeded({ timeout: 15000 });
      await expect(option).toBeVisible({ timeout: 15000 });
      await expect(option.locator('.atlas-shimmer')).toHaveCount(0, { timeout: 15000 });

      await option.click();
      const detailPanel = page.getByTestId('faction-detail-panel');
      await expect(detailPanel).toBeVisible({ timeout: 15000 });
      await expect(detailPanel).toContainText(faction.name, { timeout: 15000 });
      await expect(detailPanel.locator('.atlas-shimmer')).toHaveCount(0, { timeout: 15000 });
      await expect(page.getByTestId('faction-detail-implementation-banner'), `${faction.name} 不应再显示实施中横幅`)
        .toHaveCount(0);
      await expect(page.getByTestId('faction-preview-card').first(), `${faction.name} 应显示卡牌预览`)
        .toBeVisible({ timeout: 15000 });
      await detailPanel.getByRole('tab', { name: /基地/ }).click();
      const baseCards = page.getByTestId('faction-base-card');
      await expect(baseCards.first(), `${faction.name} 应显示基地图集预览`)
        .toBeVisible({ timeout: 15000 });
      for (const [index, baseSlot] of faction.baseSlots.entries()) {
        const atlasFrame = baseCards.nth(index).locator('[data-card-atlas-frame="true"]');
        await expect(atlasFrame, `${faction.name} 基地 ${index + 1} 应使用 Excellent Movies + Teens 基地图集`)
          .toHaveAttribute('data-card-atlas-id', EXCELLENT_MOVIES_TEENS_BASE_ATLAS);
        await expect(atlasFrame, `${faction.name} 基地 ${index + 1} 应使用正确 atlas 槽位`)
          .toHaveAttribute('data-card-atlas-index', String(baseSlot));
        await expect(atlasFrame.locator('[data-card-atlas-img="true"]'), `${faction.name} 基地 ${index + 1} 应加载 atlas 图片`)
          .toBeVisible({ timeout: 15000 });
      }

      await game.screenshot(`${faction.name}派系详情面板`, testInfo);

      await page.getByTestId('faction-detail-close').click();
      await expect(detailPanel).toHaveCount(0, { timeout: 10000 });
      await searchInput.fill('');
    }
  });

  test('异形变体蛋田天赋在真实页面中创建牌库额外随从提示，并能打出抱胸怪', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
    await setChineseLocale(page.context());
    await clearEvidenceScreenshotsForTest(testInfo);

    await game.openTestGame('smashup', {
      p0: 'extramorphs,action_heroes',
      p1: 'teens,wraithrustlers',
      skipFactionSelect: true,
      skipInitialization: true,
      seed: 20260803,
    }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        factions: ['extramorphs', 'action_heroes'],
        hand: [],
        deck: [
          { uid: 'alien-life', defId: 'extramorphs_alien_life_form', type: 'minion', owner: '0' },
          { uid: 'chestbreaker', defId: 'extramorphs_chestbreaker', type: 'minion', owner: '0' },
        ],
        discard: [],
        minionsPlayed: 1,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: {
        factions: ['teens', 'wraithrustlers'],
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
          minions: [],
          ongoingActions: [{ uid: 'egg-field', defId: 'extramorphs_egg_field', ownerId: '0' }],
        },
      ],
    });

    await game.waitForPhase('playCards');
    await expect(page.getByTestId('base-zone-0')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-ongoing-uid="egg-field"]')).toBeVisible({ timeout: 15000 });
    await game.screenshot('异形变体蛋田天赋发动前', testInfo);

    await page.evaluate(async (commandType) => {
      const harness = (window as any).__BG_TEST_HARNESS__;
      await harness.command.dispatch({
        type: commandType,
        playerId: '0',
        payload: { ongoingCardUid: 'egg-field', baseIndex: 0 },
      });
    }, SU_COMMANDS.USE_TALENT);

    await game.waitForInteraction('smashup_immediate_extra_minion', 10000);
    await game.screenshot('异形变体蛋田选择牌库额外随从', testInfo);

    await game.selectInteractionOptionBy(
      (option: InteractionOption) => option.value?.cardUid === 'chestbreaker' && option.value?.source === 'deck',
      '蛋田选择牌库中的抱胸怪',
    );
    await game.waitForNoInteraction(10000);
    await game.screenshot('异形变体蛋田打出抱胸怪后', testInfo);

    await expect.poll(async () => {
      const state = await game.getState() as SmashUpE2EState;
      return {
        deckUids: state.core.players['0'].deck.map(card => card.uid),
        minionUids: state.core.bases[0].minions.map(minion => minion.uid),
        playedFrom: state.core.bases[0].minions.find(minion => minion.uid === 'chestbreaker')?.metadata?.playedFrom,
        minionsPlayed: state.core.players['0'].minionsPlayed,
        minionLimit: state.core.players['0'].minionLimit,
        interactionOpen: Boolean(state.sys.interaction?.current),
        responseWindowOpen: Boolean(state.sys.responseWindow?.current),
      };
    }, { timeout: 10000 }).toEqual({
      deckUids: ['alien-life'],
      minionUids: ['chestbreaker'],
      playedFrom: 'deck',
      minionsPlayed: 1,
      minionLimit: 1,
      interactionOpen: false,
      responseWindowOpen: false,
    });
  });
});
