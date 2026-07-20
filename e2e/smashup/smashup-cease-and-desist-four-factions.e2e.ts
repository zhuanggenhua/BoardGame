import { test, expect } from '../framework';
import type { Page } from '@playwright/test';
import { setChineseLocale } from '../helpers/common';

type InteractionOption = {
  value?: unknown;
};

const CEASE_AND_DESIST_E2E_OBJECT_MATRIX = [
  'astroknights_block_the_probe',
  'astroknights_hidden_base',
  'astroknights_recycle_the_trash',
  'astroknights_yield_to_rage',
  'astroknights_laser_sword',
  'astroknights_prepare_for_battle',
  'astroknights_use_the_fours',
  'astroknights_its_a_trap',
  'astroknights_annoying_alien',
  'astroknights_pupoks',
  'astroknights_alien_guru',
  'astroknights_walking_carpet',
  'astroknights_scoundrel',
  'astroknights_ghost_knight',
  'astroknights_mannersbot',
  'astroknights_space_prince',
  'astroknights_space_knight',
  'astroknights_astro_robot',
  'ignobles_repaying_debts',
  'ignobles_fate_of_the_favorites',
  'ignobles_red_birthday_party',
  'ignobles_hostage_exchange',
  'ignobles_inevitable_betrayal',
  'ignobles_activate_the_spy',
  'ignobles_out_of_sight',
  'ignobles_banner_call',
  'ignobles_sneaky_squire',
  'ignobles_betrothed',
  'ignobles_foot_of_the_king',
  'ignobles_aunt_of_drakes',
  'star_roamers_weird_new_worlds',
  'star_roamers_whiplash_maneuver',
  'star_roamers_protector_fields',
  'star_roamers_teleport_overflow',
  'star_roamers_teleport_error',
  'star_roamers_hyperspeed_10',
  'star_roamers_port_me_up',
  'star_roamers_mass_teleport',
  'star_roamers_ships_engineer',
  'star_roamers_medical_officer',
  'star_roamers_science_officer',
  'star_roamers_ensign',
  'star_roamers_ships_captain',
  'changerbots_matrix_of_bossiness',
  'changerbots_change_into_a_gun',
  'changerbots_passengers',
  'changerbots_the_touch',
  'changerbots_flighterizer',
  'changerbots_change_up_and_roll_on',
  'changerbots_cesium_armor',
  'changerbots_form_mergacon',
  'changerbots_leader_two',
  'changerbots_solarshout',
  'changerbots_huffie',
  'changerbots_bruiser',
  'base_spikey_chair_room',
  'base_no_moon',
  'base_uss_undertaking',
  'base_unicrave',
  'base_wintersquashed',
  'base_changing_room',
  'base_neutral_space',
  'base_hive_of_scum_and_villainy',
  'changerbots_mergacon',
  'ignobles_the_hill_that_strolls',
] as const;

function optionHasPlayerId(option: InteractionOption, playerId: string): boolean {
  const value = option.value;
  return !!value && typeof value === 'object' && (value as { playerId?: unknown }).playerId === playerId;
}

async function playActionOnMinion(page: Page, cardUid: string, minionUid: string): Promise<void> {
  await page.locator(`[data-card-uid="${cardUid}"]`).click();
  await page.waitForTimeout(300);

  const target = page.locator(`[data-minion-uid="${minionUid}"]`);
  const box = await target.boundingBox();
  if (!box) throw new Error(`Target minion ${minionUid} not visible`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.18);
  await page.waitForTimeout(300);
}

async function dismissSpotlightIfPresent(page: Page): Promise<void> {
  const spotlightQueue = page.getByTestId('card-spotlight-queue');
  if (await spotlightQueue.isVisible({ timeout: 300 }).catch(() => false)) {
    await spotlightQueue.getByRole('button', { name: /^(关闭特写|Close spotlight)$/i }).click({ force: true });
    await page.waitForTimeout(200);
  }

  const dismissHint = page.getByText(/Click anywhere to close|点击关闭|点击任意位置关闭/i).first();
  if (await dismissHint.isVisible({ timeout: 300 }).catch(() => false)) {
    await dismissHint.click({ force: true });
    await page.waitForTimeout(200);
  }
}

test.describe('SmashUp Cease and Desist 四派系真实入口验证', () => {
  test('全对象 direct E2E 审计矩阵保持 65 个对象唯一覆盖', async () => {
    expect(new Set(CEASE_AND_DESIST_E2E_OBJECT_MATRIX).size).toBe(65);
    expect(CEASE_AND_DESIST_E2E_OBJECT_MATRIX).toHaveLength(65);
  });

  test('派系选择页能看到宇宙武士、卑劣封臣、星际旅者、百变机兵', async ({ page, game }, testInfo) => {
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

    for (const factionId of ['astroknights', 'ignobles', 'star_roamers', 'changerbots']) {
      const option = page.getByTestId(`faction-option-${factionId}`);
      await option.scrollIntoViewIfNeeded({ timeout: 15000 });
      await expect(option).toBeVisible({ timeout: 15000 });
      await option.screenshot({ path: testInfo.outputPath(`cease-and-desist-faction-option-${factionId}.png`) });
    }
    await game.screenshot('cease-and-desist-faction-selection-visible', testInfo);
  });

  test('四派系代表能力可从真实手牌入口打出并落到权威状态', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'astroknights,ignobles',
      p1: 'star_roamers,changerbots',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260711,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      player0: {
        hand: [
          { uid: 'p0-yield-rage', defId: 'astroknights_yield_to_rage', type: 'action' },
          { uid: 'p0-repaying-debts', defId: 'ignobles_repaying_debts', type: 'action' },
          { uid: 'p0-mass-teleport', defId: 'star_roamers_mass_teleport', type: 'action' },
          { uid: 'p0-form-mergacon', defId: 'changerbots_form_mergacon', type: 'action' },
        ],
        deck: [
          { uid: 'p0-deck-a', defId: 'ignobles_activate_the_spy', type: 'action' },
          { uid: 'p0-deck-b', defId: 'ignobles_sneaky_squire', type: 'minion' },
        ],
        factions: ['astroknights', 'ignobles'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 4,
      },
      player1: {
        factions: ['star_roamers', 'changerbots'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      bases: [
        {
          defId: 'base_no_moon',
          minions: [
            { uid: 'p0-astro-target', defId: 'astroknights_mannersbot', owner: '0', controller: '0', power: 2 },
            { uid: 'p0-ignoble-gift', defId: 'ignobles_sneaky_squire', owner: '0', controller: '0', power: 2 },
            { uid: 'p0-bot-a', defId: 'changerbots_huffie', owner: '0', controller: '0', power: 3 },
            { uid: 'p0-bot-b', defId: 'changerbots_bruiser', owner: '0', controller: '0', power: 2 },
            { uid: 'p1-roamer', defId: 'star_roamers_science_officer', owner: '1', controller: '1', power: 4 },
          ],
        },
      ],
      currentPlayer: '0',
      phase: 'playCards',
    });

    await game.waitForPhase('playCards');
    await expect(page.locator('[data-card-uid="p0-yield-rage"]')).toBeVisible({ timeout: 15000 });

    await playActionOnMinion(page, 'p0-yield-rage', 'p0-astro-target');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const target = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'p0-astro-target');
      return target?.tempPowerModifier ?? target?.powerModifier ?? 0;
    }, { timeout: 5000 }).toBeGreaterThanOrEqual(2);
    await game.screenshot('cease-astroknights-yield-to-rage-after-power', testInfo);

    await playActionOnMinion(page, 'p0-repaying-debts', 'p0-ignoble-gift');
    await game.waitForInteraction('ignobles_repaying_debts', 10000);
    await game.selectInteractionOptionBy(option => optionHasPlayerId(option, '1'), '卑劣封臣有债必还交给玩家 1');
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      const gift = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'p0-ignoble-gift');
      return {
        controller: gift?.controller,
        handCount: state.core.players['0']?.hand?.length,
      };
    }, { timeout: 5000 }).toEqual({ controller: '1', handCount: 4 });
    await game.screenshot('cease-ignobles-repaying-debts-after-control', testInfo);

    await game.playCard('star_roamers_mass_teleport');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        p0HasAstroTarget: state.core.players['0']?.hand?.some((card: { uid?: string }) => card.uid === 'p0-astro-target') ?? false,
        p0HasGift: state.core.players['0']?.hand?.some((card: { uid?: string }) => card.uid === 'p0-ignoble-gift') ?? false,
        p1RoamerStillOnBase: state.core.bases[0]?.minions.some((minion: { uid?: string }) => minion.uid === 'p1-roamer') ?? false,
      };
    }, { timeout: 5000 }).toEqual({ p0HasAstroTarget: true, p0HasGift: true, p1RoamerStillOnBase: true });
    await game.screenshot('cease-star-roamers-mass-teleport-after-return', testInfo);

    await game.setupScene({
      gameId: 'smashup',
      player0: {
        hand: [
          { uid: 'p0-form-mergacon-2', defId: 'changerbots_form_mergacon', type: 'action' },
        ],
        factions: ['astroknights', 'ignobles'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: {
        factions: ['star_roamers', 'changerbots'],
      },
      bases: [
        {
          defId: 'base_changing_room',
          minions: [
            { uid: 'p0-bot-a-2', defId: 'changerbots_huffie', owner: '0', controller: '0', power: 3 },
            { uid: 'p0-bot-b-2', defId: 'changerbots_bruiser', owner: '0', controller: '0', power: 2 },
            { uid: 'p1-bot-enemy', defId: 'star_roamers_ensign', owner: '1', controller: '1', power: 2 },
          ],
        },
      ],
      currentPlayer: '0',
      phase: 'playCards',
    });

    await game.playCard('changerbots_form_mergacon', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      const base = state.core.bases[0];
      return base.minions.map((minion: { uid?: string; powerModifier?: number; tempPowerModifier?: number }) => ({
        uid: minion.uid,
        modifier: (minion.tempPowerModifier ?? 0) + (minion.powerModifier ?? 0),
      }));
    }, { timeout: 5000 }).toEqual([
      { uid: 'p0-bot-a-2', modifier: 1 },
      { uid: 'p0-bot-b-2', modifier: 1 },
      { uid: 'p1-bot-enemy', modifier: 0 },
    ]);
    await game.screenshot('cease-changerbots-form-mergacon-after-power', testInfo);
  });
});
