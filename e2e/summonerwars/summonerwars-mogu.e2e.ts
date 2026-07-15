import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import { GameTestContext } from '../framework/GameTestContext';
import {
  applyCoreState,
  clickBoardElement,
  clickFactionReady,
  clickFactionStart,
  closeDebugPanelIfOpen,
  createSWRoomViaAPI,
  GAME_NAME,
  getFactionCard,
  getFactionStartButton,
  getPlayerStatusCard,
  initSWContext,
  readCoreState,
  selectFactionById,
  setupSWOnlineMatch,
  waitForFactionSelectionReady,
  waitForPhase,
  waitForSummonerWarsUI,
} from '../helpers/summonerwars';
import {
  ensureGameServerAvailable,
  joinMatchViaAPI,
  seedMatchCredentials,
} from '../helpers/common';
import { getMatchState } from '../helpers/state-injection';
import { DESKTOP_REFERENCE_VIEWPORT } from '../../src/shared/referenceViewports';
import type { BoardUnit, CellCoord, EventCard, PlayerId, SummonerWarsCore, UnitCard } from '../../src/games/summonerwars/domain/types';

async function joinGuestToMoguMatch(page: Page, matchId: string) {
  const credentials = await joinMatchViaAPI(page, GAME_NAME, matchId, '1', 'Guest-SW-Mogu');
  if (!credentials) {
    throw new Error(`Failed to join SummonerWars match: ${matchId}`);
  }

  await seedMatchCredentials(page, GAME_NAME, matchId, '1', credentials);
  await page.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=1`, { waitUntil: 'domcontentloaded' });
}

function moguUnitCard(id: string, name: string, abilities: string[] = [], overrides: Partial<UnitCard> = {}): UnitCard {
  return {
    id,
    cardType: 'unit',
    name,
    unitClass: 'common',
    faction: 'mogu',
    strength: 2,
    life: 3,
    cost: 1,
    attackType: 'melee',
    attackRange: 1,
    abilities,
    deckSymbols: [],
    ...overrides,
  };
}

function moguEventCard(
  id: string,
  name: string,
  playPhase: EventCard['playPhase'],
  overrides: Partial<EventCard> = {},
): EventCard {
  return {
    id,
    cardType: 'event',
    name,
    faction: 'mogu',
    cost: 0,
    playPhase,
    effect: name,
    deckSymbols: [],
    ...overrides,
  };
}

function placeUnit(
  core: SummonerWarsCore,
  pos: CellCoord,
  card: UnitCard,
  owner: PlayerId = '0',
  overrides: Partial<BoardUnit> = {},
): BoardUnit {
  const unit: BoardUnit = {
    instanceId: overrides.instanceId ?? `${card.id}-e2e-${pos.row}-${pos.col}`,
    cardId: overrides.cardId ?? card.id,
    card,
    owner,
    position: pos,
    damage: overrides.damage ?? 0,
    boosts: overrides.boosts ?? 0,
    hasMoved: overrides.hasMoved ?? false,
    hasAttacked: overrides.hasAttacked ?? false,
    extraAttacks: overrides.extraAttacks,
    attachedCards: overrides.attachedCards,
    healingMode: overrides.healingMode,
    wasAttackedThisTurn: overrides.wasAttackedThisTurn,
    tempAbilities: overrides.tempAbilities,
    originalOwner: overrides.originalOwner,
    attachedUnits: overrides.attachedUnits,
  };
  core.board[pos.row][pos.col].unit = unit;
  return unit;
}

function clearMoguBoard(core: SummonerWarsCore) {
  for (const row of core.board) {
    for (const cell of row) {
      cell.unit = undefined;
      cell.structure = undefined;
    }
  }
  core.currentPlayer = '0';
  core.selectedUnit = undefined;
  core.players['0'].magic = 10;
  core.players['0'].hand = [];
  core.players['0'].discard = [];
  core.players['0'].activeEvents = [];
}

function prepareMoguBloodInfusionUiState(core: SummonerWarsCore) {
  clearMoguBoard(core);
  core.phase = 'move';

  const magePosition = { row: 4, col: 3 };
  const allyPosition = { row: 4, col: 5 };
  const mage = placeUnit(
    core,
    magePosition,
    moguUnitCard('mogu-withering-mage-e2e', '枯萎法师', ['mogu_blood_infusion'], {
      attackType: 'ranged',
      attackRange: 3,
      cost: 2,
      strength: 4,
    }),
  );
  placeUnit(core, allyPosition, moguUnitCard('mogu-ally-e2e', '友方单位'));

  return { core, mage, magePosition, allyPosition };
}

function prepareMoguSymbioticSelfHealingUiState(core: SummonerWarsCore) {
  clearMoguBoard(core);
  core.phase = 'move';
  const summonerPosition = { row: 4, col: 3 };
  const targetPosition = { row: 4, col: 4 };
  placeUnit(core, summonerPosition, moguUnitCard('mogu-kubenk-e2e', '库鞭克', [], {
    unitClass: 'summoner',
    strength: 4,
    life: 7,
    cost: 0,
  }));
  placeUnit(core, targetPosition, moguUnitCard('mogu-spore-plague-body-e2e-target', '菌袍疫病体'), '0', {
    damage: 1,
    boosts: 0,
  });
  core.players['0'].hand = [
    moguEventCard('mogu-symbiotic-self-healing-1', '共生自愈', 'move'),
  ];
  return { core, targetPosition };
}

function prepareMoguReleaseSporesUiState(core: SummonerWarsCore) {
  clearMoguBoard(core);
  core.phase = 'magic';
  const summonerPosition = { row: 4, col: 3 };
  const firstTargetPosition = { row: 4, col: 4 };
  const secondTargetPosition = { row: 3, col: 3 };
  placeUnit(core, summonerPosition, moguUnitCard('mogu-kubenk-e2e', '库鞭克', [], {
    unitClass: 'summoner',
    strength: 4,
    life: 7,
    cost: 0,
  }));
  core.players['0'].hand = [
    moguEventCard('mogu-release-spores-1', '释放菌袍', 'magic', {
      eventType: 'legendary',
    }),
  ];
  core.players['0'].discard = [
    moguUnitCard('mogu-spore-plague-body-e2e-a', '菌袍疫病体'),
    moguUnitCard('mogu-spore-plague-body-e2e-b', '菌袍疫病体'),
  ];
  return { core, firstTargetPosition, secondTargetPosition };
}

async function choosePlayMagicEvent(page: Page, matchId: string) {
  await expect.poll(async () => {
    const state = await getMatchState(matchId, page) as {
      sys?: { interaction?: { current?: { data?: { sw?: { type?: string } } } } };
    };
    return state.sys?.interaction?.current?.data?.sw?.type ?? null;
  }, { timeout: 8000 }).toBe('magic_event_choice');

  await expect(page.getByTestId('sw-ability-prompt')).toContainText(/打出事件卡|Magic phase|play or discard/i);
  const playButton = page.getByRole('button', { name: /^打出$|^Play$/i });
  await expect(playButton).toBeVisible({ timeout: 8000 });
  await playButton.click();
}

const setHarnessDiceValues = async (page: Page, values: number[]) => {
  await page.evaluate((diceValues) => {
    const harness = (window as Window & {
      __BG_TEST_HARNESS__?: { dice?: { setValues?: (items: number[]) => void } };
    }).__BG_TEST_HARNESS__;
    if (typeof harness?.dice?.setValues !== 'function') {
      throw new Error('__BG_TEST_HARNESS__.dice.setValues not found');
    }
    harness.dice.setValues(diceValues);
  }, values);
};

async function endPhaseAndWaitFor(page: Page, nextPhase: SummonerWarsCore['phase']) {
  const endPhaseButton = page.getByTestId('sw-end-phase');
  await expect(endPhaseButton).toBeVisible({ timeout: 8000 });
  await expect(endPhaseButton).toBeEnabled({ timeout: 8000 });
  await endPhaseButton.click();
  await page.waitForTimeout(250);
  const currentPhase = await page.getByTestId('sw-action-banner').getAttribute('data-phase');
  if (currentPhase !== nextPhase) {
    await expect(endPhaseButton).toBeEnabled({ timeout: 8000 });
    await endPhaseButton.click();
  }
  await waitForPhase(page, nextPhase);
}

function prepareMoguTransmissionUiState(core: SummonerWarsCore) {
  clearMoguBoard(core);
  core.phase = 'move';

  const shamanStartPosition = { row: 4, col: 3 };
  const shamanMovePosition = { row: 4, col: 4 };
  const allyPosition = { row: 4, col: 5 };
  const shaman = placeUnit(core, shamanStartPosition, moguUnitCard('mogu-blood-shaman-e2e', '鲜血萨满', ['mogu_transmission'], {
    attackType: 'ranged',
    attackRange: 3,
    cost: 1,
    strength: 3,
  }), '0', {
    boosts: 2,
  });
  placeUnit(core, allyPosition, moguUnitCard('mogu-transmission-ally-e2e', '友方单位'), '0', {
    boosts: 0,
  });

  return { core, shaman, shamanStartPosition, shamanMovePosition, allyPosition };
}

function prepareMoguFanaticalFungusUiState(core: SummonerWarsCore) {
  clearMoguBoard(core);
  core.phase = 'move';

  const unitStartPosition = { row: 4, col: 3 };
  const unitMovePosition = { row: 4, col: 4 };
  const pushedPosition = { row: 4, col: 5 };
  const movedUnit = placeUnit(core, unitStartPosition, moguUnitCard('mogu-fanatical-unit-e2e', '菌袍疫病体'), '0', {
    boosts: 0,
    damage: 0,
  });
  core.players['0'].activeEvents = [
    moguEventCard('mogu-fanatical-fungus-0-0', '狂热菌菇', 'summon', {
      eventType: 'common',
      isActive: true,
    }),
  ];

  return { core, movedUnit, unitStartPosition, unitMovePosition, pushedPosition };
}

function prepareMoguCommandHorizontalAttackUiState(core: SummonerWarsCore) {
  clearMoguBoard(core);
  core.phase = 'attack';
  core.players['0'].attackCount = 3;
  const summonerPosition = { row: 4, col: 2 };
  const targetPosition = { row: 4, col: 4 };
  const enemyPosition = { row: 4, col: 5 };
  placeUnit(core, summonerPosition, moguUnitCard('mogu-kubenk-e2e-command', '库鞭克', [], {
    unitClass: 'summoner',
    strength: 4,
    life: 7,
    cost: 0,
  }));
  const target = placeUnit(core, targetPosition, moguUnitCard('mogu-command-target-e2e', '友方士兵', [], {
    unitClass: 'common',
    strength: 2,
    life: 3,
    cost: 1,
    attackType: 'melee',
    attackRange: 1,
  }));
  const enemy = placeUnit(core, enemyPosition, moguUnitCard('mogu-command-enemy-e2e', '横向相邻敌方单位', [], {
    faction: 'necromancer',
    unitClass: 'common',
    strength: 1,
    life: 5,
    cost: 1,
  }), '1');
  core.players['0'].hand = [
    moguEventCard('mogu-command-1', '命令', 'attack', {
      eventType: 'legendary',
    }),
  ];
  return { core, target, enemy, targetPosition, enemyPosition };
}

function prepareMoguDecayBurstMutationUiState(core: SummonerWarsCore) {
  clearMoguBoard(core);
  core.phase = 'move';
  const maShuoDaPosition = { row: 4, col: 4 };
  const bodyPosition = { row: 4, col: 5 };
  placeUnit(core, maShuoDaPosition, moguUnitCard('mogu-ma-shuo-da-e2e-chain', '玛硕达', ['mogu_decay'], {
    unitClass: 'champion',
    strength: 3,
    life: 8,
    cost: 3,
  }));
  placeUnit(core, bodyPosition, moguUnitCard('mogu-spore-plague-body-e2e-chain', '菌袍疫病体', [
    'mogu_burst',
    'mogu_fungal_mutation',
  ], {
    unitClass: 'common',
    strength: 2,
    life: 2,
    cost: 0,
  }), '0', {
    boosts: 1,
  });
  const beast = moguUnitCard('mogu-fungal-beast-e2e-chain', '菌化野兽', [
    'mogu_infection',
    'mogu_parasite',
  ], {
    unitClass: 'common',
    strength: 3,
    life: 5,
    cost: 3,
  });
  core.players['0'].discard = [beast];
  return { core, maShuoDaPosition, bodyPosition, beast };
}

function prepareMoguInfectionReplacementUiState(core: SummonerWarsCore) {
  clearMoguBoard(core);
  core.phase = 'attack';
  placeUnit(core, { row: 6, col: 1 }, moguUnitCard('mogu-kubenk-e2e-infection', '库鞭克', [], {
    unitClass: 'summoner',
    strength: 4,
    life: 7,
    cost: 0,
  }));
  placeUnit(core, { row: 1, col: 1 }, moguUnitCard('necro-summoner-e2e-infection', '敌方召唤师', [], {
    faction: 'necromancer',
    unitClass: 'summoner',
    strength: 4,
    life: 7,
    cost: 0,
  }), '1');
  const beastPosition = { row: 4, col: 4 };
  const enemyPosition = { row: 4, col: 5 };
  placeUnit(core, beastPosition, moguUnitCard('mogu-fungal-beast-e2e-infection', '菌化野兽', [
    'mogu_infection',
    'mogu_parasite',
  ], {
    unitClass: 'common',
    strength: 3,
    life: 5,
    cost: 3,
    attackType: 'melee',
    attackRange: 1,
  }));
  placeUnit(core, enemyPosition, moguUnitCard('mogu-infection-enemy-e2e', '待替换敌方单位', [], {
    faction: 'necromancer',
    unitClass: 'common',
    strength: 1,
    life: 2,
    cost: 1,
  }), '1');
  const body = moguUnitCard('mogu-spore-plague-body-e2e-infection', '菌袍疫病体', [
    'mogu_burst',
    'mogu_fungal_mutation',
  ], {
    unitClass: 'common',
    strength: 2,
    life: 2,
    cost: 0,
  });
  core.players['0'].discard = [body];
  return { core, beastPosition, enemyPosition, body };
}

function prepareMoguFinalFormUiState(core: SummonerWarsCore) {
  clearMoguBoard(core);
  core.phase = 'summon';
  placeUnit(core, { row: 6, col: 1 }, moguUnitCard('mogu-kubenk-e2e-final-form', '库鞭克', [], {
    unitClass: 'summoner',
    strength: 4,
    life: 7,
    cost: 0,
  }));
  const firstBeastPosition = { row: 4, col: 4 };
  const chosenBeastPosition = { row: 5, col: 4 };
  const firstBeast = placeUnit(core, firstBeastPosition, moguUnitCard('mogu-fungal-beast-e2e-final-a', '菌化野兽', [
    'mogu_infection',
    'mogu_parasite',
  ], {
    unitClass: 'common',
    strength: 3,
    life: 5,
    cost: 3,
  }), '0', {
    boosts: 5,
  });
  const chosenBeast = placeUnit(core, chosenBeastPosition, moguUnitCard('mogu-fungal-beast-e2e-final-b', '菌化野兽', [
    'mogu_infection',
    'mogu_parasite',
  ], {
    unitClass: 'common',
    strength: 3,
    life: 5,
    cost: 3,
  }), '0', {
    boosts: 6,
  });
  const giant = moguUnitCard('mogu-malformed-giant-e2e-final', '畸形巨怪', ['mogu_final_form'], {
    unitClass: 'champion',
    strength: 5,
    life: 13,
    cost: 3,
  });
  core.players['0'].hand = [giant];
  return { core, firstBeast, chosenBeast, firstBeastPosition, chosenBeastPosition, giant };
}

test.describe('SummonerWars Mogu faction entry', () => {
  test('selects Mogu from real faction selection and starts a match with Mogu units visible', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({
      baseURL,
      viewport: DESKTOP_REFERENCE_VIEWPORT,
    });
    await initSWContext(hostContext, '__sw_mogu_entry_host');
    const hostPage = await hostContext.newPage();
    const hostGame = new GameTestContext(hostPage);

    const guestContext = await browser.newContext({
      baseURL,
      viewport: DESKTOP_REFERENCE_VIEWPORT,
    });
    await initSWContext(guestContext, '__sw_mogu_entry_guest');
    const guestPage = await guestContext.newPage();

    try {
      await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
      if (!(await ensureGameServerAvailable(hostPage))) {
        test.skip(true, 'Game server unavailable');
      }

      const matchId = await createSWRoomViaAPI(hostPage);
      if (!matchId) {
        test.skip(true, 'Room creation failed');
      }

      await hostPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
      await waitForFactionSelectionReady(hostPage);

      await guestPage.goto('/', { waitUntil: 'domcontentloaded' });
      await joinGuestToMoguMatch(guestPage, matchId);
      await waitForFactionSelectionReady(guestPage);

      await expect(getFactionCard(hostPage, 'mogu')).toBeVisible({ timeout: 10000 });
      await expect(hostPage.getByTestId('sw-faction-card-mogu-status-ribbon')).toBeVisible({ timeout: 10000 });
      await hostGame.screenshot('mogu-selection-entry', testInfo);

      await selectFactionById(hostPage, 'mogu');
      await expect(getFactionCard(hostPage, 'mogu')).toHaveAttribute('data-selected', 'true');
      await expect(getPlayerStatusCard(hostPage, '0')).toContainText(/莫古|Mogu/i);
      await hostGame.screenshot('mogu-selection-picked', testInfo);

      await selectFactionById(guestPage, 'necromancer');
      await clickFactionReady(guestPage);
      await expect(getFactionStartButton(hostPage)).toBeEnabled({ timeout: 10000 });
      await clickFactionStart(hostPage);

      await waitForSummonerWarsUI(hostPage, 30000);
      await waitForSummonerWarsUI(guestPage, 30000);

      await expect(hostPage.getByTestId('sw-phase-tracker')).toBeVisible();
      await expect(hostPage.getByTestId('sw-hand-area')).toBeVisible();
      await expect(hostPage.getByTestId('sw-map-container')).toBeVisible();
      await expect(
        hostPage.locator('[data-unit-name*="库鞭克"], [data-unit-name*="枯萎法师"], [data-unit-name*="菌袍疫病体"]').first(),
      ).toBeVisible({ timeout: 10000 });

      await hostGame.screenshot('mogu-game-started', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('uses Mogu Blood Infusion through the real board ability button', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'mogu', 'necromancer');

    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed');
      return;
    }

    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);

    try {
      const prepared = prepareMoguBloodInfusionUiState(await readCoreState(hostPage) as SummonerWarsCore);
      await applyCoreState(hostPage, prepared.core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'move');

      const mageSelector = `[data-testid="sw-unit-${prepared.magePosition.row}-${prepared.magePosition.col}"][data-owner="0"]`;
      const allySelector = `[data-testid="sw-unit-${prepared.allyPosition.row}-${prepared.allyPosition.col}"][data-owner="0"]`;

      await expect(hostPage.locator(mageSelector).first()).toBeVisible({ timeout: 5000 });
      await expect(hostPage.locator(allySelector).first()).toBeVisible({ timeout: 5000 });
      await clickBoardElement(hostPage, mageSelector);

      const abilityButton = hostPage.getByRole('button', { name: /鲜血灌注|Blood Infusion/i });
      await expect(abilityButton).toBeVisible({ timeout: 8000 });
      await hostGame.screenshot('mogu-blood-infusion-button-visible', testInfo);
      await abilityButton.click();

      await expect.poll(async () => {
        const state = await getMatchState(matchId, hostPage) as {
          sys?: {
            interaction?: {
              current?: {
                data?: { sw?: { type?: string; abilityId?: string; step?: string } };
              };
            };
          };
        };
        const sw = state.sys?.interaction?.current?.data?.sw;
        return {
          type: sw?.type ?? null,
          abilityId: sw?.abilityId ?? null,
          step: sw?.step ?? null,
        };
      }, { timeout: 8000 }).toEqual({
        type: 'activated_ability_target',
        abilityId: 'mogu_blood_infusion',
        step: 'selectUnit',
      });

      await clickBoardElement(hostPage, allySelector);

      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        const ally = state.board[prepared.allyPosition.row]?.[prepared.allyPosition.col]?.unit;
        return {
          boosts: ally?.boosts ?? 0,
          damage: ally?.damage ?? 0,
        };
      }, { timeout: 8000 }).toEqual({ boosts: 1, damage: 1 });

      await hostGame.screenshot('mogu-blood-infusion-resolved', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('plays Mogu Symbiotic Self-Healing from hand and resolves selected target', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'mogu', 'necromancer');

    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed');
      return;
    }

    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);

    try {
      const prepared = prepareMoguSymbioticSelfHealingUiState(await readCoreState(hostPage) as SummonerWarsCore);
      await applyCoreState(hostPage, prepared.core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'move');

      const cardSelector = '[data-card-id="mogu-symbiotic-self-healing-1"]';
      const targetSelector = `[data-testid="sw-unit-${prepared.targetPosition.row}-${prepared.targetPosition.col}"][data-owner="0"]`;

      await expect(hostPage.locator(cardSelector).first()).toBeVisible({ timeout: 8000 });
      await expect(hostPage.locator(cardSelector).first()).toHaveAttribute('data-can-play', 'true', { timeout: 8000 });
      await hostPage.locator(cardSelector).first().click();

      await expect.poll(async () => {
        const state = await getMatchState(matchId, hostPage) as {
          sys?: { interaction?: { current?: { data?: { sw?: { type?: string } } } } };
        };
        return state.sys?.interaction?.current?.data?.sw?.type ?? null;
      }, { timeout: 8000 }).toBe('mogu_symbiotic_self_healing_select_targets');

      await expect(hostPage.getByTestId('sw-ability-prompt')).toContainText(/共生自愈|Symbiotic/i);
      await clickBoardElement(hostPage, targetSelector);
      await expect(hostPage.getByRole('button', { name: /确认选择|Confirm Selection/i })).toBeVisible({ timeout: 8000 });
      await hostGame.screenshot('mogu-symbiotic-self-healing-selected', testInfo);
      await hostPage.getByRole('button', { name: /确认选择|Confirm Selection/i }).click();

      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        const target = state.board[prepared.targetPosition.row]?.[prepared.targetPosition.col]?.unit;
        const handIds = state.players['0'].hand.map((card) => card.id);
        return {
          damage: target?.damage ?? null,
          boosts: target?.boosts ?? null,
          cardStillInHand: handIds.includes('mogu-symbiotic-self-healing-1'),
        };
      }, { timeout: 8000 }).toEqual({
        damage: 0,
        boosts: 1,
        cardStillInHand: false,
      });

      await expect.poll(async () => {
        const state = await getMatchState(matchId, hostPage) as {
          sys?: { interaction?: { current?: unknown } };
        };
        return state.sys?.interaction?.current ?? null;
      }, { timeout: 8000 }).toBeNull();

      await hostPage.waitForTimeout(1500);
      await hostGame.screenshot('mogu-symbiotic-self-healing-resolved', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('plays Mogu Symbiotic Self-Healing from hand and can skip with no target selected', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'mogu', 'necromancer');

    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed');
      return;
    }

    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);

    try {
      const prepared = prepareMoguSymbioticSelfHealingUiState(await readCoreState(hostPage) as SummonerWarsCore);
      await applyCoreState(hostPage, prepared.core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'move');

      const cardSelector = '[data-card-id="mogu-symbiotic-self-healing-1"]';
      await expect(hostPage.locator(cardSelector).first()).toBeVisible({ timeout: 8000 });
      await expect(hostPage.locator(cardSelector).first()).toHaveAttribute('data-can-play', 'true', { timeout: 8000 });
      await hostPage.locator(cardSelector).first().click();

      await expect.poll(async () => {
        const state = await getMatchState(matchId, hostPage) as {
          sys?: { interaction?: { current?: { data?: { sw?: { type?: string } } } } };
        };
        return state.sys?.interaction?.current?.data?.sw?.type ?? null;
      }, { timeout: 8000 }).toBe('mogu_symbiotic_self_healing_select_targets');

      await expect(hostPage.getByTestId('sw-ability-prompt')).toContainText(/共生自愈|Symbiotic/i);
      await hostGame.screenshot('mogu-symbiotic-self-healing-skip-ready', testInfo);
      await hostPage.getByRole('button', { name: /^跳过$|^Skip$/i }).click();

      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        const target = state.board[prepared.targetPosition.row]?.[prepared.targetPosition.col]?.unit;
        return {
          damage: target?.damage ?? null,
          boosts: target?.boosts ?? null,
          cardStillInHand: state.players['0'].hand.some((card) => card.id === 'mogu-symbiotic-self-healing-1'),
          cardInDiscard: state.players['0'].discard.some((card) => card.id === 'mogu-symbiotic-self-healing-1'),
        };
      }, { timeout: 8000 }).toEqual({
        damage: 1,
        boosts: 0,
        cardStillInHand: false,
        cardInDiscard: true,
      });

      await expect.poll(async () => {
        const state = await getMatchState(matchId, hostPage) as {
          sys?: { interaction?: { current?: unknown } };
        };
        return state.sys?.interaction?.current ?? null;
      }, { timeout: 8000 }).toBeNull();

      await hostPage.waitForTimeout(1500);
      await hostGame.screenshot('mogu-symbiotic-self-healing-skip-resolved', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('plays Mogu Command and resolves a horizontal extra attack before destroying the target', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'mogu', 'necromancer');

    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed');
      return;
    }

    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);

    try {
      const prepared = prepareMoguCommandHorizontalAttackUiState(await readCoreState(hostPage) as SummonerWarsCore);
      await applyCoreState(hostPage, prepared.core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'attack');

      const cardSelector = '[data-card-id="mogu-command-1"]';
      await expect(hostPage.locator(cardSelector).first()).toBeVisible({ timeout: 8000 });
      await expect(hostPage.locator(cardSelector).first()).toHaveAttribute('data-can-play', 'true', { timeout: 8000 });
      await hostPage.locator(cardSelector).first().click();

      await expect.poll(async () => {
        const state = await getMatchState(matchId, hostPage) as {
          sys?: { interaction?: { current?: { data?: { sw?: { type?: string } } } } };
        };
        return state.sys?.interaction?.current?.data?.sw?.type ?? null;
      }, { timeout: 8000 }).toBe('event_target');
      await expect(hostPage.getByTestId('sw-ability-prompt')).toContainText(/选择事件卡目标|event target/i);
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${prepared.targetPosition.row}-${prepared.targetPosition.col}"][data-owner="0"]`);

      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        const target = state.board[prepared.targetPosition.row]?.[prepared.targetPosition.col]?.unit;
        return {
          extraAttacks: target?.extraAttacks ?? null,
          destroyAfterExtraAttackSource: target?.destroyAfterExtraAttackSource ?? null,
          cardStillInHand: state.players['0'].hand.some((card) => card.id === 'mogu-command-1'),
        };
      }, { timeout: 8000 }).toEqual({
        extraAttacks: 1,
        destroyAfterExtraAttackSource: 'mogu_command',
        cardStillInHand: false,
      });

      await hostGame.screenshot('mogu-command-extra-attack-granted', testInfo);
      await setHarnessDiceValues(hostPage, [1, 1]);
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${prepared.targetPosition.row}-${prepared.targetPosition.col}"][data-owner="0"]`);
      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return state.selectedUnit ?? null;
      }, { timeout: 8000 }).toEqual(prepared.targetPosition);
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${prepared.enemyPosition.row}-${prepared.enemyPosition.col}"][data-owner="1"]`);

      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        const target = state.board[prepared.targetPosition.row]?.[prepared.targetPosition.col]?.unit;
        const enemy = state.board[prepared.enemyPosition.row]?.[prepared.enemyPosition.col]?.unit;
        return {
          targetRemoved: target == null,
          enemyName: enemy?.card.name ?? null,
          enemyDamaged: (enemy?.damage ?? 0) > 0,
        };
      }, { timeout: 10000 }).toEqual({
        targetRemoved: true,
        enemyName: '横向相邻敌方单位',
        enemyDamaged: true,
      });

      await expect.poll(async () => {
        const state = await getMatchState(matchId, hostPage) as {
          sys?: { interaction?: { current?: unknown } };
        };
        return state.sys?.interaction?.current ?? null;
      }, { timeout: 8000 }).toBeNull();

      await hostPage.waitForTimeout(1500);
      await hostGame.screenshot('mogu-command-horizontal-attack-resolved', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('resolves Mogu Decay into Burst and Fungal Mutation across real phase endings', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'mogu', 'necromancer');

    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed');
      return;
    }

    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);

    try {
      const prepared = prepareMoguDecayBurstMutationUiState(await readCoreState(hostPage) as SummonerWarsCore);
      await applyCoreState(hostPage, prepared.core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'move');
      await hostGame.screenshot('mogu-decay-chain-before-move-end', testInfo);

      await endPhaseAndWaitFor(hostPage, 'build');
      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        const maShuoDa = state.board[prepared.maShuoDaPosition.row]?.[prepared.maShuoDaPosition.col]?.unit;
        const body = state.board[prepared.bodyPosition.row]?.[prepared.bodyPosition.col]?.unit;
        return {
          maShuoDaDamage: maShuoDa?.damage ?? null,
          bodyName: body?.card.name ?? null,
          bodyBoosts: body?.boosts ?? null,
        };
      }, { timeout: 10000 }).toEqual({
        maShuoDaDamage: 1,
        bodyName: '菌袍疫病体',
        bodyBoosts: 3,
      });

      await endPhaseAndWaitFor(hostPage, 'attack');
      await endPhaseAndWaitFor(hostPage, 'magic');
      await hostGame.screenshot('mogu-decay-chain-before-magic-end', testInfo);
      await endPhaseAndWaitFor(hostPage, 'draw');

      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        const replaced = state.board[prepared.bodyPosition.row]?.[prepared.bodyPosition.col]?.unit;
        return {
          replacedName: replaced?.card.name ?? null,
          replacedCardId: replaced?.card.id ?? null,
          beastStillInDiscard: state.players['0'].discard.some((card) => card.id === prepared.beast.id),
        };
      }, { timeout: 10000 }).toEqual({
        replacedName: '菌化野兽',
        replacedCardId: prepared.beast.id,
        beastStillInDiscard: false,
      });

      await expect.poll(async () => {
        const state = await getMatchState(matchId, hostPage) as {
          sys?: { interaction?: { current?: unknown } };
        };
        return state.sys?.interaction?.current ?? null;
      }, { timeout: 8000 }).toBeNull();

      await hostPage.waitForTimeout(1500);
      await hostGame.screenshot('mogu-decay-burst-mutation-resolved', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('replaces a destroyed enemy with Spore Plague Body after a real Fungal Beast attack', async ({ browser }, testInfo) => {
    test.setTimeout(240000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'mogu', 'necromancer');

    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed');
      return;
    }

    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);

    try {
      const prepared = prepareMoguInfectionReplacementUiState(await readCoreState(hostPage) as SummonerWarsCore);
      await applyCoreState(hostPage, prepared.core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'attack');
      await setHarnessDiceValues(hostPage, [1, 1, 1]);

      await clickBoardElement(hostPage, `[data-testid="sw-unit-${prepared.beastPosition.row}-${prepared.beastPosition.col}"][data-owner="0"]`);
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${prepared.enemyPosition.row}-${prepared.enemyPosition.col}"][data-owner="1"]`);

      const replacementSelector = `[data-testid="sw-unit-${prepared.enemyPosition.row}-${prepared.enemyPosition.col}"]`;
      const replacementUnit = hostPage.locator(replacementSelector);
      await expect(replacementUnit).toBeVisible({ timeout: 10000 });
      await expect(replacementUnit).toHaveAttribute('data-owner', '0', { timeout: 10000 });
      await expect(replacementUnit).toHaveAttribute('data-unit-name', '菌袍疫病体', { timeout: 10000 });

      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        const beast = state.board[prepared.beastPosition.row]?.[prepared.beastPosition.col]?.unit;
        const replacement = state.board[prepared.enemyPosition.row]?.[prepared.enemyPosition.col]?.unit;
        return {
          beastName: beast?.card.name ?? null,
          replacementName: replacement?.card.name ?? null,
          replacementOwner: replacement?.owner ?? null,
          bodyStillInDiscard: state.players['0'].discard.some((card) => card.id === prepared.body.id),
        };
      }, { timeout: 10000 }).toEqual({
        beastName: '菌化野兽',
        replacementName: '菌袍疫病体',
        replacementOwner: '0',
        bodyStillInDiscard: false,
      });

      await expect.poll(async () => {
        const state = await getMatchState(matchId, hostPage) as {
          sys?: { interaction?: { current?: unknown } };
        };
        return state.sys?.interaction?.current ?? null;
      }, { timeout: 8000 }).toBeNull();

      await hostPage.waitForTimeout(1500);
      await hostGame.screenshot('mogu-infection-replacement-resolved', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('summons Malformed Giant by replacing the chosen 5-charge Fungal Beast from the real board entry', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'mogu', 'necromancer');

    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed');
      return;
    }

    const { hostPage, hostContext, guestContext } = match;
    const hostGame = new GameTestContext(hostPage);

    try {
      const prepared = prepareMoguFinalFormUiState(await readCoreState(hostPage) as SummonerWarsCore);
      await applyCoreState(hostPage, prepared.core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'summon');

      const cardSelector = `[data-card-id="${prepared.giant.id}"]`;
      await expect(hostPage.locator(cardSelector).first()).toBeVisible({ timeout: 8000 });
      await hostPage.locator(cardSelector).first().click();

      await expect(hostPage.locator(
        `[data-testid="sw-cell-${prepared.chosenBeastPosition.row}-${prepared.chosenBeastPosition.col}"]`,
      )).toHaveAttribute('data-valid-summon', 'true', { timeout: 8000 });
      await hostGame.screenshot('mogu-final-form-targets-highlighted', testInfo);
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${prepared.chosenBeastPosition.row}-${prepared.chosenBeastPosition.col}"][data-owner="0"]`);

      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        const first = state.board[prepared.firstBeastPosition.row]?.[prepared.firstBeastPosition.col]?.unit;
        const chosen = state.board[prepared.chosenBeastPosition.row]?.[prepared.chosenBeastPosition.col]?.unit;
        return {
          firstName: first?.card.name ?? null,
          firstId: first?.card.id ?? null,
          chosenName: chosen?.card.name ?? null,
          chosenId: chosen?.card.id ?? null,
          giantStillInHand: state.players['0'].hand.some((card) => card.id === prepared.giant.id),
          magic: state.players['0'].magic,
        };
      }, { timeout: 10000 }).toEqual({
        firstName: '菌化野兽',
        firstId: prepared.firstBeast.card.id,
        chosenName: '畸形巨怪',
        chosenId: prepared.giant.id,
        giantStillInHand: false,
        magic: 7,
      });

      await hostPage.waitForTimeout(1000);
      await hostGame.screenshot('mogu-final-form-resolved', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('plays Mogu Release Spores from hand and summons discard bodies to selected cells', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'mogu', 'necromancer');

    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed');
      return;
    }

    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);

    try {
      const prepared = prepareMoguReleaseSporesUiState(await readCoreState(hostPage) as SummonerWarsCore);
      await applyCoreState(hostPage, prepared.core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'magic');

      const cardSelector = '[data-card-id="mogu-release-spores-1"]';
      await expect(hostPage.locator(cardSelector).first()).toBeVisible({ timeout: 8000 });
      await expect(hostPage.locator(cardSelector).first()).toHaveAttribute('data-can-play', 'true', { timeout: 8000 });
      await hostPage.locator(cardSelector).first().click();
      await choosePlayMagicEvent(hostPage, matchId);

      await expect.poll(async () => {
        const state = await getMatchState(matchId, hostPage) as {
          sys?: { interaction?: { current?: { data?: { sw?: { type?: string } } } } };
        };
        return state.sys?.interaction?.current?.data?.sw?.type ?? null;
      }, { timeout: 8000 }).toBe('mogu_release_spores_select_positions');

      await expect(hostPage.getByTestId('sw-ability-prompt')).toContainText(/释放菌袍|Release/i);
      await clickBoardElement(hostPage, `[data-testid="sw-cell-${prepared.firstTargetPosition.row}-${prepared.firstTargetPosition.col}"]`);
      await clickBoardElement(hostPage, `[data-testid="sw-cell-${prepared.secondTargetPosition.row}-${prepared.secondTargetPosition.col}"]`);
      await expect(hostPage.getByRole('button', { name: /确认选择|Confirm Selection/i })).toBeVisible({ timeout: 8000 });
      await hostGame.screenshot('mogu-release-spores-selected', testInfo);
      await hostPage.getByRole('button', { name: /确认选择|Confirm Selection/i }).click();

      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        const first = state.board[prepared.firstTargetPosition.row]?.[prepared.firstTargetPosition.col]?.unit;
        const second = state.board[prepared.secondTargetPosition.row]?.[prepared.secondTargetPosition.col]?.unit;
        return {
          firstName: first?.card.name ?? null,
          secondName: second?.card.name ?? null,
          firstOwner: first?.owner ?? null,
          secondOwner: second?.owner ?? null,
          discardCount: state.players['0'].discard.length,
          discardIds: state.players['0'].discard.map((card) => card.id),
          cardStillInHand: state.players['0'].hand.some((card) => card.id === 'mogu-release-spores-1'),
        };
      }, { timeout: 8000 }).toEqual({
        firstName: '菌袍疫病体',
        secondName: '菌袍疫病体',
        firstOwner: '0',
        secondOwner: '0',
        discardCount: 1,
        discardIds: ['mogu-release-spores-1'],
        cardStillInHand: false,
      });

      await expect.poll(async () => {
        const state = await getMatchState(matchId, hostPage) as {
          sys?: { interaction?: { current?: unknown } };
        };
        return state.sys?.interaction?.current ?? null;
      }, { timeout: 8000 }).toBeNull();

      await hostPage.waitForTimeout(5200);
      await hostGame.screenshot('mogu-release-spores-resolved', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('plays Mogu Release Spores from hand and can skip without summoning bodies', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'mogu', 'necromancer');

    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed');
      return;
    }

    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);

    try {
      const prepared = prepareMoguReleaseSporesUiState(await readCoreState(hostPage) as SummonerWarsCore);
      await applyCoreState(hostPage, prepared.core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'magic');

      const cardSelector = '[data-card-id="mogu-release-spores-1"]';
      await expect(hostPage.locator(cardSelector).first()).toBeVisible({ timeout: 8000 });
      await expect(hostPage.locator(cardSelector).first()).toHaveAttribute('data-can-play', 'true', { timeout: 8000 });
      await hostPage.locator(cardSelector).first().click();
      await choosePlayMagicEvent(hostPage, matchId);

      await expect.poll(async () => {
        const state = await getMatchState(matchId, hostPage) as {
          sys?: { interaction?: { current?: { data?: { sw?: { type?: string } } } } };
        };
        return state.sys?.interaction?.current?.data?.sw?.type ?? null;
      }, { timeout: 8000 }).toBe('mogu_release_spores_select_positions');

      await expect(hostPage.getByTestId('sw-ability-prompt')).toContainText(/释放菌袍|Release/i);
      await hostGame.screenshot('mogu-release-spores-skip-ready', testInfo);
      await hostPage.getByRole('button', { name: /^跳过$|^Skip$/i }).click();

      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return {
          firstCellUnit: state.board[prepared.firstTargetPosition.row]?.[prepared.firstTargetPosition.col]?.unit?.card.name ?? null,
          secondCellUnit: state.board[prepared.secondTargetPosition.row]?.[prepared.secondTargetPosition.col]?.unit?.card.name ?? null,
          discardIds: state.players['0'].discard.map((card) => card.id),
          cardStillInHand: state.players['0'].hand.some((card) => card.id === 'mogu-release-spores-1'),
        };
      }, { timeout: 8000 }).toEqual({
        firstCellUnit: null,
        secondCellUnit: null,
        discardIds: ['mogu-spore-plague-body-e2e-a', 'mogu-spore-plague-body-e2e-b', 'mogu-release-spores-1'],
        cardStillInHand: false,
      });

      await expect.poll(async () => {
        const state = await getMatchState(matchId, hostPage) as {
          sys?: { interaction?: { current?: unknown } };
        };
        return state.sys?.interaction?.current ?? null;
      }, { timeout: 8000 }).toBeNull();

      await hostPage.waitForTimeout(1500);
      await hostGame.screenshot('mogu-release-spores-skip-resolved', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('resolves Blood Shaman Transmission after a real move interaction', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'mogu', 'necromancer');

    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed');
      return;
    }

    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);

    try {
      const prepared = prepareMoguTransmissionUiState(await readCoreState(hostPage) as SummonerWarsCore);
      await applyCoreState(hostPage, prepared.core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'move');

      await clickBoardElement(hostPage, `[data-testid="sw-unit-${prepared.shamanStartPosition.row}-${prepared.shamanStartPosition.col}"][data-owner="0"]`);
      await clickBoardElement(hostPage, `[data-testid="sw-cell-${prepared.shamanMovePosition.row}-${prepared.shamanMovePosition.col}"]`);

      await expect.poll(async () => {
        const state = await getMatchState(matchId, hostPage) as {
          sys?: { interaction?: { current?: { data?: { sw?: { type?: string; step?: string } } } } };
        };
        const sw = state.sys?.interaction?.current?.data?.sw;
        return { type: sw?.type ?? null, step: sw?.step ?? null };
      }, { timeout: 8000 }).toEqual({ type: 'after_move_mogu_transmission', step: 'selectMode' });

      await expect(hostPage.getByTestId('sw-ability-prompt')).toContainText(/菌落传导|Transmission/i);
      await hostGame.screenshot('mogu-transmission-select-mode', testInfo);
      await hostPage.getByRole('button', { name: /从自身传输|Self/i }).click();

      await expect.poll(async () => {
        const state = await getMatchState(matchId, hostPage) as {
          sys?: { interaction?: { current?: { data?: { sw?: { type?: string; step?: string } } } } };
        };
        const sw = state.sys?.interaction?.current?.data?.sw;
        return { type: sw?.type ?? null, step: sw?.step ?? null };
      }, { timeout: 8000 }).toEqual({ type: 'after_move_mogu_transmission', step: 'selectTarget' });

      await clickBoardElement(hostPage, `[data-testid="sw-unit-${prepared.allyPosition.row}-${prepared.allyPosition.col}"][data-owner="0"]`);

      await expect.poll(async () => {
        const state = await getMatchState(matchId, hostPage) as {
          sys?: { interaction?: { current?: { data?: { sw?: { type?: string; step?: string } } } } };
        };
        const sw = state.sys?.interaction?.current?.data?.sw;
        return { type: sw?.type ?? null, step: sw?.step ?? null };
      }, { timeout: 8000 }).toEqual({ type: 'after_move_mogu_transmission', step: 'selectAmount' });

      await hostGame.screenshot('mogu-transmission-select-amount', testInfo);
      await hostPage.getByRole('button', { name: /^2$/ }).click();

      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        const shaman = state.board[prepared.shamanMovePosition.row]?.[prepared.shamanMovePosition.col]?.unit;
        const ally = state.board[prepared.allyPosition.row]?.[prepared.allyPosition.col]?.unit;
        return {
          shamanBoosts: shaman?.boosts ?? null,
          allyBoosts: ally?.boosts ?? null,
          shamanAtMoveCell: shaman?.card.name ?? null,
        };
      }, { timeout: 10000 }).toEqual({
        shamanBoosts: 0,
        allyBoosts: 2,
        shamanAtMoveCell: '鲜血萨满',
      });

      await expect.poll(async () => {
        const state = await getMatchState(matchId, hostPage) as {
          sys?: { interaction?: { current?: unknown } };
        };
        return state.sys?.interaction?.current ?? null;
      }, { timeout: 8000 }).toBeNull();

      await hostPage.waitForTimeout(1500);
      await hostGame.screenshot('mogu-transmission-resolved', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('resolves Fanatical Fungus after a real move interaction with push target', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'mogu', 'necromancer');

    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed');
      return;
    }

    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);

    try {
      const prepared = prepareMoguFanaticalFungusUiState(await readCoreState(hostPage) as SummonerWarsCore);
      await applyCoreState(hostPage, prepared.core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'move');

      await clickBoardElement(hostPage, `[data-testid="sw-unit-${prepared.unitStartPosition.row}-${prepared.unitStartPosition.col}"][data-owner="0"]`);
      await clickBoardElement(hostPage, `[data-testid="sw-cell-${prepared.unitMovePosition.row}-${prepared.unitMovePosition.col}"]`);

      await expect.poll(async () => {
        const state = await getMatchState(matchId, hostPage) as {
          sys?: { interaction?: { current?: { data?: { sw?: { type?: string } } } } };
        };
        return state.sys?.interaction?.current?.data?.sw?.type ?? null;
      }, { timeout: 8000 }).toBe('after_move_mogu_fanatical_fungus');

      await expect(hostPage.getByTestId('sw-ability-prompt')).toContainText(/狂热菌菇|Fanatical/i);
      await hostGame.screenshot('mogu-fanatical-fungus-select-position', testInfo);
      await clickBoardElement(hostPage, `[data-testid="sw-cell-${prepared.pushedPosition.row}-${prepared.pushedPosition.col}"]`);

      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        const movedFrom = state.board[prepared.unitMovePosition.row]?.[prepared.unitMovePosition.col]?.unit;
        const pushed = state.board[prepared.pushedPosition.row]?.[prepared.pushedPosition.col]?.unit;
        return {
          movedFrom: movedFrom?.card.name ?? null,
          pushedName: pushed?.card.name ?? null,
          pushedBoosts: pushed?.boosts ?? null,
          pushedDamage: pushed?.damage ?? null,
        };
      }, { timeout: 10000 }).toEqual({
        movedFrom: null,
        pushedName: '菌袍疫病体',
        pushedBoosts: 1,
        pushedDamage: 1,
      });

      await expect.poll(async () => {
        const state = await getMatchState(matchId, hostPage) as {
          sys?: { interaction?: { current?: unknown } };
        };
        return state.sys?.interaction?.current ?? null;
      }, { timeout: 8000 }).toBeNull();

      await hostPage.waitForTimeout(1500);
      await hostGame.screenshot('mogu-fanatical-fungus-resolved', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });
});
