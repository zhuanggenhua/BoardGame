import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '../framework';
import type { Page } from '@playwright/test';
import { expectRightTrayBonusDiceConfirmation, getRightTrayDie, settleCurrentBonusDice } from './bonus-dice-flow';

type HandDiagCard = {
  cardId: string | null;
  hasExpectedAsset: boolean;
  observedAsset: string | null;
};

type HandDiag = {
  missing: boolean;
  shimmerCount?: number;
  cards?: HandDiagCard[];
};

type HeroId =
  | 'monk'
  | 'barbarian'
  | 'pyromancer'
  | 'moon_elf'
  | 'shadow_thief'
  | 'paladin'
  | 'samurai'
  | 'gunslinger';

type TestGameController = {
  openTestGame: (gameId: string) => Promise<void>;
  setupScene: (scene: Record<string, unknown>) => Promise<void>;
  waitForPhase: (phase: string, timeoutMs?: number) => Promise<void>;
  getState?: () => Promise<any>;
};

type AbilitySlotResolutionOptions = {
  characterId?: string;
  playerBoardFace?: string;
};

type AbilitySlotResolutionInput = AbilitySlotResolutionOptions & {
  abilityId: string;
};

const EVIDENCE_DIR = join(
  process.cwd(),
  'test-results',
  'evidence-screenshots',
  'dicethrone-hero-ability-cards-e2e',
);

function ensureEvidenceDir(): string {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  return EVIDENCE_DIR;
}

function getCp(player: any): number | null {
  return player?.resources?.cp ?? player?.resources?.CP ?? null;
}

function getHp(player: any): number | null {
  return player?.resources?.hp ?? player?.resources?.HP ?? null;
}

function getHandIds(player: any): string[] {
  return player?.hand?.map((card: any) => card.id) ?? [];
}

function getDiscardIds(player: any): string[] {
  return player?.discard?.map((card: any) => card.id) ?? [];
}

async function readState(game: TestGameController): Promise<any> {
  return await (game as any).getState();
}

async function waitForHandReady(page: Page, expectedCount: number): Promise<void> {
  await page.waitForFunction((count) => {
    const handArea = document.querySelector('[data-testid="hand-area"]');
    if (!handArea) return false;
    const cards = Array.from(handArea.querySelectorAll('[data-card-id]'));
    return cards.length === count
      && cards.every((card) => card.getAttribute('data-is-flipped') === 'true')
      && handArea.querySelectorAll('.atlas-shimmer').length === 0;
  }, expectedCount, { timeout: 15000, polling: 100 });
}

async function waitForHandVisualSettled(page: Page): Promise<void> {
  await page.waitForTimeout(900);
}

async function collectHandDiag(page: Page, expectedAssets: Record<string, string>): Promise<HandDiag> {
  return await page.evaluate((assetMap) => {
    const handArea = document.querySelector('[data-testid="hand-area"]');
    if (!handArea) return { missing: true };
    const cards = Array.from(handArea.querySelectorAll('[data-card-id]')).map((card) => {
      const cardId = card.getAttribute('data-card-id');
      const expectedAsset = cardId ? assetMap[cardId] : null;
      const targetNode = Array.from(card.querySelectorAll('*')).find((node) => {
        if (!expectedAsset) return false;
        if (node instanceof HTMLImageElement) {
          const candidates = [
            node.currentSrc,
            node.getAttribute('src'),
            node.getAttribute('data-debug-current-src'),
            node.getAttribute('data-debug-rendered-src'),
          ].filter(Boolean);
          return candidates.some((candidate) => candidate?.includes(expectedAsset));
        }
        if (node instanceof HTMLElement) {
          const bg = window.getComputedStyle(node).backgroundImage;
          return Boolean(bg) && bg.includes(expectedAsset);
        }
        return false;
      });
      const observedAsset = targetNode instanceof HTMLImageElement
        ? targetNode.getAttribute('data-debug-current-src')
          || targetNode.getAttribute('data-debug-rendered-src')
          || targetNode.getAttribute('src')
          || targetNode.currentSrc
        : targetNode instanceof HTMLElement
          ? window.getComputedStyle(targetNode).backgroundImage
          : null;
      return {
        cardId,
        hasExpectedAsset: Boolean(targetNode),
        observedAsset,
      };
    });
    return {
      missing: false,
      shimmerCount: handArea.querySelectorAll('.atlas-shimmer').length,
      cards,
    };
  }, expectedAssets);
}

async function expectHandUsesExpectedPreviewAssets(page: Page, _heroId: HeroId, hand: string[]): Promise<void> {
  const diag = await collectHandDiag(
    page,
    Object.fromEntries(hand.map((cardId) => [cardId, 'ability-cards.webp'])),
  );
  expect(diag).toMatchObject({ missing: false, shimmerCount: 0 });
}

async function setHarnessDiceValues(page: Page, values: number[]): Promise<void> {
  await page.evaluate((nextValues) => {
    (window as any).__BG_TEST_HARNESS__?.dice?.setValues?.(nextValues);
  }, values);
}

async function resetCommandRejection(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).__BG_LAST_COMMAND_REJECTED__ = null;
  });
}

async function setupHeroScene(
  page: Page,
  game: TestGameController,
  heroId: HeroId,
  hand: string[],
  options?: {
    opponentHeroId?: string;
    player0Resources?: Record<string, number>;
    player1Resources?: Record<string, number>;
    player0Tokens?: Record<string, number>;
    player1Tokens?: Record<string, number>;
    phase?: string;
    extra?: Record<string, unknown>;
  },
): Promise<void> {
  const phase = options?.phase ?? 'main1';
  await game.openTestGame('dicethrone');
  await game.setupScene({
    gameId: 'dicethrone',
    player0: {
      hand,
      discard: [],
      resources: { cp: 10, hp: 50, ...(options?.player0Resources ?? {}) },
      tokens: options?.player0Tokens ?? {},
    },
    player1: {
      hand: [],
      discard: [],
      resources: { cp: 2, hp: 50, ...(options?.player1Resources ?? {}) },
      tokens: options?.player1Tokens ?? {},
    },
    currentPlayer: '0',
    phase,
    extra: {
      selectedCharacters: { '0': heroId, '1': options?.opponentHeroId ?? 'barbarian' },
      hostStarted: true,
      pendingAttack: null,
      pendingDamage: undefined,
      rollCount: phase === 'offensiveRoll' ? 1 : 0,
      rollConfirmed: phase === 'offensiveRoll',
      ...(options?.extra ?? {}),
    },
  });

  await game.waitForPhase(phase, 10000);
  await expect.poll(async () => {
    const state = await readState(game);
    const player = state?.core?.players?.['0'];
    return {
      phase: state?.sys?.phase ?? null,
      activePlayerId: state?.core?.activePlayerId ?? null,
      characterId: state?.core?.selectedCharacters?.['0'] ?? null,
      handIds: getHandIds(player),
    };
  }, { timeout: 10000 }).toMatchObject({
    phase,
    activePlayerId: '0',
    characterId: heroId,
    handIds: hand,
  });

  await resetCommandRejection(page);
  await waitForHandReady(page, hand.length);
  await waitForHandVisualSettled(page);
  await expectHandUsesExpectedPreviewAssets(page, heroId, hand);
}

async function clickHandCard(page: Page, cardId: string): Promise<void> {
  const handCard = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
  await expect(handCard).toBeVisible({ timeout: 10000 });
  const cardBox = await page.evaluate((nextCardId) => {
    const node = document.querySelector(`[data-testid="hand-area"] [data-card-id="${nextCardId}"]`) as HTMLElement | null;
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }, cardId);
  if (!cardBox || cardBox.width <= 0 || cardBox.height <= 0) {
    throw new Error(`未能获取手牌 ${cardId} 的拖拽区域`);
  }

  const startX = cardBox.x + (cardBox.width / 2);
  const startY = cardBox.y + (cardBox.height * 0.78);
  const endY = Math.max(24, startY - 240);

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, endY, { steps: 12 });
  await page.mouse.up();
  await page.mouse.move(2, 2);
}

async function openFabPanel(page: Page, panelId: string): Promise<void> {
  const panel = page.locator(`[data-testid="fab-panel-${panelId}"]`).first();
  if (await panel.isVisible().catch(() => false)) {
    return;
  }

  const panelButton = page.locator(`[data-fab-id="${panelId}"]`).first();
  if (!(await panelButton.isVisible().catch(() => false))) {
    const mainButton = page.locator('[data-testid="fab-menu"] [data-fab-id]').first();
    await expect(mainButton).toBeVisible({ timeout: 10000 });
    await mainButton.click();
    await expect(panelButton).toBeVisible({ timeout: 10000 });
  }

  await panelButton.click();
  await expect(panel).toBeVisible({ timeout: 10000 });
}

async function expectActionLogLatestRowContains(
  page: Page,
  parts: string[],
): Promise<void> {
  await openFabPanel(page, 'action-log');
  const panel = page.locator('[data-testid="fab-panel-action-log"]').first();
  const rows = page.locator('[data-testid="hud-action-log-row"]');
  await expect(rows.first()).toBeVisible({ timeout: 10000 });
  const texts = (await rows.allInnerTexts()).map((text) => text.replace(/\s+/g, ' ').trim());
  const matched = texts.find((text) => parts.every((part) => text.includes(part)));
  expect(
    matched,
    `ActionLog 面板未找到预期记录: ${parts.join(' / ')}; 实际=${JSON.stringify(texts)}`,
  ).toBeTruthy();
  await page.locator('[data-fab-id="action-log"]').first().click();
  await expect(panel).toBeHidden({ timeout: 10000 });
}

async function captureActionLogPanel(page: Page, screenshotPath: string): Promise<void> {
  await openFabPanel(page, 'action-log');
  const panel = page.locator('[data-testid="fab-panel-action-log"]').first();
  await expect(page.locator('[data-testid="hud-action-log-row"]').first()).toBeVisible({ timeout: 10000 });
  await expect(panel).toBeVisible({ timeout: 10000 });
  await panel.screenshot({ path: screenshotPath });
  await page.locator('[data-fab-id="action-log"]').first().click();
  await expect(panel).toBeHidden({ timeout: 10000 });
}

async function waitForUpgradeApplied(
  page: Page,
  game: TestGameController,
  abilityId: string,
  expectedLevel: number,
  expectedCp: number | null,
  expectedCardId: string,
  options?: {
    expectedHandIdsAfter?: string[];
  },
): Promise<void> {
  const expectedState: Record<string, unknown> = {
    reject: null,
    phase: 'main1',
    level: expectedLevel,
    discardIds: [],
    upgradeCardId: expectedCardId,
  };
  if (expectedCp !== null) {
    expectedState.cp = expectedCp;
  }

  await expect.poll(async () => {
    const state = await readState(game);
    const player = state?.core?.players?.['0'];
    return {
      reject: await page.evaluate(() => (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null),
      phase: state?.sys?.phase ?? null,
      level: player?.abilityLevels?.[abilityId] ?? 0,
      cp: getCp(player),
      handIds: getHandIds(player),
      discardIds: getDiscardIds(player),
      upgradeCardId: player?.upgradeCardByAbilityId?.[abilityId]?.cardId ?? null,
    };
  }, { timeout: 15000 }).toMatchObject(expectedState);

  const stateAfter = await readState(game);
  const handIdsAfter = getHandIds(stateAfter?.core?.players?.['0']);
  expect(handIdsAfter).not.toContain(expectedCardId);
  if (options?.expectedHandIdsAfter) {
    expect(handIdsAfter, `${expectedCardId} 结算后手牌异常，疑似额外抓牌`).toEqual(options.expectedHandIdsAfter);
  }
}

async function resolveAbilitySlotId(
  page: Page,
  abilityId: string,
  options?: AbilitySlotResolutionOptions,
): Promise<string | null> {
  return await page.evaluate(async ({
    abilityId: targetAbilityId,
    characterId: requestedCharacterId,
    playerBoardFace: requestedPlayerBoardFace,
  }: AbilitySlotResolutionInput) => {
    const {
      getAbilitySlotId,
      getAbilitySlotIdForCharacter,
    } = await import('/src/games/dicethrone/ui/abilitySlotMapping.ts');
    const activeBoard = document.querySelector('[data-testid="player-board-surface"] [data-ability-slot-scope="main-board"]')?.closest('[data-testid="player-board-surface"]');
    const inferredCharacterId = activeBoard?.getAttribute('data-character-id') ?? null;
    const inferredPlayerBoardFace = activeBoard
      ?.querySelector('[data-testid="player-board-face-shell"]')
      ?.getAttribute('data-player-board-face') ?? null;
    const characterId = requestedCharacterId ?? inferredCharacterId;
    const rawPlayerBoardFace = requestedPlayerBoardFace ?? inferredPlayerBoardFace;
    const playerBoardFace = rawPlayerBoardFace === 'normal' || rawPlayerBoardFace === 'cursed'
      ? rawPlayerBoardFace
      : undefined;
    if (characterId) {
      return getAbilitySlotIdForCharacter(characterId, targetAbilityId, playerBoardFace) ?? null;
    }
    return getAbilitySlotId(targetAbilityId) ?? null;
  }, { abilityId, ...options });
}

async function clickAbilitySlot(
  page: Page,
  abilityId: string,
  options?: AbilitySlotResolutionOptions,
): Promise<void> {
  const slotId = await resolveAbilitySlotId(page, abilityId, options);
  expect(slotId, `${abilityId} 未映射到技能槽`).toBeTruthy();
  const slot = page.locator(`[data-testid="player-board-surface"] [data-ability-slot-scope="main-board"][data-ability-slot="${slotId}"]`).first();
  await expect(slot).toBeVisible({ timeout: 10000 });
  await expect(slot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });

  const clickPoint = await page.evaluate((targetSlotId) => {
    const element = document.querySelector(
      `[data-testid="player-board-surface"] [data-ability-slot-scope="main-board"][data-ability-slot="${targetSlotId}"]`,
    ) as HTMLElement | null;
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    const xFractions = [0.5, 0.28, 0.72, 0.18, 0.82];
    const yFractions = [0.68, 0.5, 0.82, 0.34, 0.18];

    for (const yFraction of yFractions) {
      for (const xFraction of xFractions) {
        const x = rect.left + rect.width * xFraction;
        const y = rect.top + rect.height * yFraction;
        const topElement = document.elementFromPoint(x, y);
        if (topElement?.closest?.('button')) {
          continue;
        }
        const hitSlot = topElement?.closest?.('[data-ability-slot]');
        if (hitSlot === element) {
          return { x, y };
        }
      }
    }

    return null;
  }, slotId);

  expect(clickPoint, `${abilityId}/${slotId} 槽位必须存在避开“查看大图”按钮的真实可点击点`).not.toBeNull();
  await page.mouse.click(clickPoint!.x, clickPoint!.y);
}

async function clickCurrentPlayerAbilitySlot(
  page: Page,
  game: TestGameController,
  abilityId: string,
  playerId = '0',
): Promise<void> {
  const state = await readState(game);
  await clickAbilitySlot(page, abilityId, {
    characterId: state?.core?.selectedCharacters?.[playerId],
    playerBoardFace: state?.core?.players?.[playerId]?.playerBoardFace,
  });
}

async function chooseAbilityVariant(page: Page, label: string | RegExp): Promise<void> {
  const modalRoot = page.locator('#modal-root');
  const modalTitle = modalRoot.getByRole('heading', { name: '选择发动变体' }).first();
  await expect(modalTitle).toBeVisible({ timeout: 5000 });
  const button = modalRoot.getByRole('button', { name: label }).first();
  await expect(button).toBeVisible({ timeout: 5000 });
  await button.click();
  await expect(modalTitle).toBeHidden({ timeout: 5000 });
}

async function chooseAbilityVariantIfVisible(page: Page, label: string | RegExp): Promise<boolean> {
  const modalRoot = page.locator('#modal-root');
  const modalTitle = modalRoot.getByRole('heading', { name: '选择发动变体' }).first();
  if (!await modalTitle.isVisible({ timeout: 1200 }).catch(() => false)) {
    return false;
  }
  const button = modalRoot.getByRole('button', { name: label }).first();
  await expect(button).toBeVisible({ timeout: 5000 });
  await button.click();
  await expect(modalTitle).toBeHidden({ timeout: 5000 });
  return true;
}

async function skipTokenResponseIfNeeded(
  page: Page,
  game: TestGameController,
  fallbackPlayerId = '1',
): Promise<boolean> {
  const current = await page.evaluate(() => {
    const harness = (window as any).__BG_TEST_HARNESS__;
    const state = harness?.state?.get?.();
    const interaction = state?.sys?.interaction?.current ?? null;
    return {
      hasPendingDamage: Boolean(state?.core?.pendingDamage),
      responderId: state?.core?.pendingDamage?.responderId ?? null,
      interactionKind: interaction?.kind ?? null,
      interactionPlayerId: interaction?.playerId ?? null,
    };
  });

  if (!current.hasPendingDamage && current.interactionKind !== 'dt:token-response') {
    return false;
  }

  const playerId = current.responderId ?? current.interactionPlayerId ?? fallbackPlayerId;
  await page.evaluate(async (responderId) => {
    const harness = (window as any).__BG_TEST_HARNESS__;
    await harness?.command?.dispatch?.({
      type: 'SKIP_TOKEN_RESPONSE',
      playerId: responderId,
      payload: {},
    });
  }, playerId);

  await expect.poll(async () => {
    const state = await readState(game);
    const interaction = state?.sys?.interaction?.current ?? null;
    return {
      pendingDamage: state?.core?.pendingDamage ?? null,
      interactionKind: interaction?.kind ?? null,
    };
  }, { timeout: 10000 }).toMatchObject({
    pendingDamage: null,
    interactionKind: null,
  });

  return true;
}

async function clickAdvancePhase(page: Page): Promise<void> {
  const advanceButton = page.locator('[data-tutorial-id="advance-phase-button"]').first();
  await expect(advanceButton).toBeVisible({ timeout: 10000 });
  await advanceButton.click();
}

async function expectUpgradeStableOnPlayerBoard(
  page: Page,
  game: TestGameController,
  abilityId: string,
  cardId: string,
): Promise<void> {
  const state = await readState(game);
  const characterId = state?.core?.selectedCharacters?.['0'];
  const playerBoardFace = state?.core?.players?.['0']?.playerBoardFace;
  const slotId = await resolveAbilitySlotId(page, abilityId, { characterId, playerBoardFace });
  expect(slotId, `${abilityId} 未映射到技能槽`).toBeTruthy();
  await expect(page.locator(`[data-upgrade-preview-slot="${slotId}"]`).first()).toBeVisible({ timeout: 10000 });

  const stateAfter = await readState(game);
  const player = stateAfter?.core?.players?.['0'];
  expect(getDiscardIds(player), `${cardId} 不应留在弃牌堆`).not.toContain(cardId);
  expect(player?.upgradeCardByAbilityId?.[abilityId]?.cardId ?? null, `${abilityId} 应登记升级卡`).toBe(cardId);
}

async function waitForCardResolved(
  page: Page,
  game: TestGameController,
  cardId: string,
  expectedCp: number,
  options?: {
    expectedHandIdsAfter?: string[];
  },
): Promise<any> {
  await expect.poll(async () => {
    const state = await readState(game);
    const player = state?.core?.players?.['0'];
    return {
      reject: await page.evaluate(() => (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null),
      phase: state?.sys?.phase ?? null,
      cp: getCp(player),
      handIds: getHandIds(player),
      lastEventTypes: (state?.sys?.eventStream?.entries ?? []).slice(-8).map((entry: any) => entry?.event?.type ?? null),
    };
  }, { timeout: 15000 }).toMatchObject({
    reject: null,
    cp: expectedCp,
  });

  const stateAfter = await readState(game);
  const handIdsAfter = getHandIds(stateAfter?.core?.players?.['0']);
  expect(handIdsAfter).not.toContain(cardId);
  if (options?.expectedHandIdsAfter) {
    expect(handIdsAfter, `${cardId} 结算后手牌异常，疑似额外抓牌`).toEqual(options.expectedHandIdsAfter);
  }
  return stateAfter;
}

async function waitForHandAnimationSettled(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="hand-flying-card"]')).toHaveCount(0, { timeout: 5000 });
}

async function injectOffensiveRollDice(
  page: Page,
  game: TestGameController,
  values: number[],
  playerId = '0',
  definitionId = 'gunslinger-dice',
): Promise<void> {
  await page.evaluate(async ({ values, playerId, definitionId }) => {
    const harness = (window as any).__BG_TEST_HARNESS__;
    const state = harness?.state?.get?.();
    if (!harness || !state) {
      throw new Error('TestHarness state not ready');
    }

    const { getDieFaceByValue } = await import('/src/games/dicethrone/domain/diceRegistry.ts');
    const nextDice = values.map((value, index) => {
      const face = getDieFaceByValue(definitionId, value);
      const primarySymbol = face?.symbol ?? face?.symbols?.[0] ?? null;
      return {
        id: index,
        definitionId,
        value,
        symbol: primarySymbol,
        symbols: face?.symbols ?? (primarySymbol ? [primarySymbol] : []),
        isKept: false,
      };
    });

    harness.state.set({
      ...state,
      sys: {
        ...state.sys,
        phase: 'offensiveRoll',
        interaction: {
          current: undefined,
          queue: [],
        },
      },
      core: {
        ...state.core,
        activePlayerId: playerId,
        dice: nextDice,
        rollCount: 1,
        rollConfirmed: true,
        pendingAttack: null,
        pendingDamage: undefined,
      },
    });
    (window as any).__BG_LAST_COMMAND_REJECTED__ = null;
  }, { values, playerId, definitionId });

  await game.waitForPhase('offensiveRoll', 10000);
}

async function openAndInjectGunslingerAttackModifierScene(
  page: Page,
  game: TestGameController,
  options: {
    cardId: 'card-wild-west' | 'card-eat-my-lead';
    sourceAbilityId: string;
    diceValues: number[];
  },
): Promise<void> {
  await game.openTestGame('dicethrone');
  await page.evaluate(async ({ cardId, sourceAbilityId, diceValues }) => {
    const harness = (window as any).__BG_TEST_HARNESS__;
    const state = harness?.state?.get?.();
    if (!harness || !state) {
      throw new Error('TestHarness state not ready');
    }

    harness.dice.setValues(diceValues);

    const random = {
      random: () => 0.5,
      d: (max: number) => Math.min(max, 1),
      range: (min: number, _max: number) => min,
      shuffle: <T,>(array: T[]) => [...array],
    };

    const [{ initHeroState }, { GUNSLINGER_CARDS }] = await Promise.all([
      import('/src/games/dicethrone/domain/characters.ts'),
      import('/src/games/dicethrone/heroes/gunslinger/cards.ts'),
    ]);

    const gunslingerBase = initHeroState('0', 'gunslinger', random as any);
    const defenderBase = initHeroState('1', 'barbarian', random as any);
    const card = GUNSLINGER_CARDS.find((entry: any) => entry.id === cardId);
    if (!card) {
      throw new Error(`${cardId} not found`);
    }

    harness.state.set({
      ...state,
      sys: {
        ...state.sys,
        phase: 'offensiveRoll',
        interaction: {
          current: undefined,
          queue: [],
        },
        eventStream: {
          ...(state.sys?.eventStream ?? {}),
          entries: [],
        },
      },
      core: {
        ...state.core,
        activePlayerId: '0',
        hostStarted: true,
        selectedCharacters: {
          ...(state.core.selectedCharacters ?? {}),
          '0': 'gunslinger',
          '1': 'barbarian',
        },
        rollCount: 1,
        rollConfirmed: true,
        dice: [
          { id: 0, value: 1, isKept: false, playerId: '0' },
          { id: 1, value: 1, isKept: false, playerId: '0' },
          { id: 2, value: 2, isKept: false, playerId: '0' },
          { id: 3, value: 3, isKept: false, playerId: '0' },
          { id: 4, value: 4, isKept: false, playerId: '0' },
        ],
        pendingDamage: undefined,
        pendingBonusDiceSettlement: undefined,
        players: {
          ...state.core.players,
          '0': {
            ...gunslingerBase,
            hand: [JSON.parse(JSON.stringify(card))],
            discard: [],
            resources: {
              ...gunslingerBase.resources,
              cp: 4,
              hp: 50,
            },
            tokens: {
              ...gunslingerBase.tokens,
              loaded: cardId === 'card-wild-west' ? 1 : 0,
            },
          },
          '1': {
            ...defenderBase,
            discard: [],
            resources: {
              ...defenderBase.resources,
              hp: 50,
            },
          },
        },
        pendingAttack: {
          attackerId: '0',
          defenderId: '1',
          isDefendable: true,
          sourceAbilityId,
          damage: 6,
          bonusDamage: 0,
          attackModifierBonusDamage: 0,
          damageResolved: false,
          resolvedDamage: 0,
          preDefenseResolved: false,
          offensiveRollEndTokenResolved: false,
        },
      },
    });

    (window as any).__BG_LAST_COMMAND_REJECTED__ = null;
  }, options);

  await game.waitForPhase('offensiveRoll', 10000);
  await waitForHandReady(page, 1);
  await waitForHandVisualSettled(page);
  await expectHandUsesExpectedPreviewAssets(page, 'gunslinger', [options.cardId]);
}

async function openAndInjectSamuraiAttackModifierScene(
  page: Page,
  game: TestGameController,
  options: {
    cardId: 'card-righteousness' | 'card-zanshin';
    defenderCharacter: 'monk' | 'paladin';
    sourceAbilityId: string;
    diceValues: number[];
  },
): Promise<void> {
  await game.openTestGame('dicethrone');
  await page.evaluate(async ({ cardId, defenderCharacter, sourceAbilityId, diceValues }) => {
    const harness = (window as any).__BG_TEST_HARNESS__;
    const state = harness?.state?.get?.();
    if (!harness || !state) {
      throw new Error('TestHarness state not ready');
    }

    harness.dice.setValues(diceValues);

    const random = {
      random: () => 0.5,
      d: (max: number) => Math.min(max, 1),
      range: (min: number, _max: number) => min,
      shuffle: <T,>(array: T[]) => [...array],
    };

    const [{ initHeroState }, { SAMURAI_CARDS }] = await Promise.all([
      import('/src/games/dicethrone/domain/characters.ts'),
      import('/src/games/dicethrone/heroes/samurai/cards.ts'),
    ]);

    const samuraiBase = initHeroState('0', 'samurai', random as any);
    const defenderBase = initHeroState('1', defenderCharacter, random as any);
    const card = SAMURAI_CARDS.find((entry: any) => entry.id === cardId);
    if (!card) {
      throw new Error(`${cardId} not found`);
    }

    harness.state.set({
      ...state,
      sys: {
        ...state.sys,
        phase: 'offensiveRoll',
        interaction: {
          current: undefined,
          queue: [],
        },
        eventStream: {
          ...(state.sys?.eventStream ?? {}),
          entries: [],
        },
      },
      core: {
        ...state.core,
        activePlayerId: '0',
        hostStarted: true,
        selectedCharacters: {
          ...(state.core.selectedCharacters ?? {}),
          '0': 'samurai',
          '1': defenderCharacter,
        },
        rollCount: 1,
        rollConfirmed: true,
        dice: [
          { id: 0, value: 1, isKept: false, playerId: '0' },
          { id: 1, value: 1, isKept: false, playerId: '0' },
          { id: 2, value: 1, isKept: false, playerId: '0' },
          { id: 3, value: 4, isKept: false, playerId: '0' },
          { id: 4, value: 4, isKept: false, playerId: '0' },
        ],
        pendingDamage: undefined,
        pendingBonusDiceSettlement: undefined,
        players: {
          ...state.core.players,
          '0': {
            ...samuraiBase,
            hand: [JSON.parse(JSON.stringify(card))],
            discard: [],
            resources: {
              ...samuraiBase.resources,
              cp: 4,
              hp: 50,
            },
          },
          '1': {
            ...defenderBase,
            discard: [],
            resources: {
              ...defenderBase.resources,
              hp: 50,
            },
          },
        },
        pendingAttack: {
          attackerId: '0',
          defenderId: '1',
          isDefendable: true,
          sourceAbilityId,
          damage: 6,
          bonusDamage: 0,
          attackModifierBonusDamage: 0,
          damageResolved: false,
          resolvedDamage: 0,
          preDefenseResolved: false,
          offensiveRollEndTokenResolved: false,
        },
      },
    });

    (window as any).__BG_LAST_COMMAND_REJECTED__ = null;
  }, options);

  await game.waitForPhase('offensiveRoll', 10000);
  await waitForHandReady(page, 1);
  await waitForHandVisualSettled(page);
  await expectHandUsesExpectedPreviewAssets(page, 'samurai', [options.cardId]);
}

async function openAndInjectSamuraiMasamune2Scene(
  page: Page,
  game: TestGameController,
  options: {
    defenderCharacter: 'paladin' | 'monk';
  },
): Promise<void> {
  await game.openTestGame('dicethrone');
  await page.evaluate(async ({ defenderCharacter }) => {
    const harness = (window as any).__BG_TEST_HARNESS__;
    const state = harness?.state?.get?.();
    if (!harness || !state) {
      throw new Error('TestHarness state not ready');
    }

    const random = {
      random: () => 0.5,
      d: (max: number) => Math.min(max, 1),
      range: (min: number, _max: number) => min,
      shuffle: <T,>(array: T[]) => [...array],
    };

    const [{ initHeroState }, { MASAMUNE_2 }, { SAMURAI_CARDS }] = await Promise.all([
      import('/src/games/dicethrone/domain/characters.ts'),
      import('/src/games/dicethrone/heroes/samurai/abilities.ts'),
      import('/src/games/dicethrone/heroes/samurai/cards.ts'),
    ]);

    const samuraiBase = initHeroState('0', 'samurai', random as any);
    const defenderBase = initHeroState('1', defenderCharacter, random as any);
    const upgradeCard = SAMURAI_CARDS.find((entry: any) => entry.id === 'upgrade-masamune-2');
    if (!upgradeCard) {
      throw new Error('upgrade-masamune-2 not found');
    }

    harness.state.set({
      ...state,
      sys: {
        ...state.sys,
        phase: 'offensiveRoll',
        interaction: {
          current: undefined,
          queue: [],
        },
        eventStream: {
          ...(state.sys?.eventStream ?? {}),
          entries: [],
        },
      },
      core: {
        ...state.core,
        activePlayerId: '0',
        hostStarted: true,
        selectedCharacters: {
          ...(state.core.selectedCharacters ?? {}),
          '0': 'samurai',
          '1': defenderCharacter,
        },
        rollCount: 1,
        rollConfirmed: true,
        dice: [
          { id: 0, value: 1, isKept: false, playerId: '0' },
          { id: 1, value: 2, isKept: false, playerId: '0' },
          { id: 2, value: 3, isKept: false, playerId: '0' },
          { id: 3, value: 4, isKept: false, playerId: '0' },
          { id: 4, value: 5, isKept: false, playerId: '0' },
        ],
        pendingAttack: null,
        pendingDamage: undefined,
        pendingBonusDiceSettlement: undefined,
        players: {
          ...state.core.players,
          '0': {
            ...samuraiBase,
            hand: [],
            discard: [],
            abilities: samuraiBase.abilities.map((ability: any) => (
              ability.id === 'masamune' ? JSON.parse(JSON.stringify(MASAMUNE_2)) : ability
            )),
            abilityLevels: {
              ...(samuraiBase.abilityLevels ?? {}),
              masamune: 2,
            },
            upgradeCardByAbilityId: {
              ...(samuraiBase.upgradeCardByAbilityId ?? {}),
              masamune: {
                cardId: upgradeCard.id,
                cpCost: upgradeCard.cpCost,
              },
            },
            resources: {
              ...samuraiBase.resources,
              cp: 4,
              hp: 50,
            },
          },
          '1': {
            ...defenderBase,
            hand: [],
            discard: [],
            resources: {
              ...defenderBase.resources,
              hp: 50,
            },
          },
        },
      },
    });

    (window as any).__BG_LAST_COMMAND_REJECTED__ = null;
  }, options);

  await expect.poll(async () => {
    const state = await readState(game);
    return {
      phase: state?.sys?.phase ?? null,
      activePlayerId: state?.core?.activePlayerId ?? null,
      attackerCharacter: state?.core?.selectedCharacters?.['0'] ?? null,
      defenderCharacter: state?.core?.selectedCharacters?.['1'] ?? null,
      masamuneLevel: state?.core?.players?.['0']?.abilityLevels?.masamune ?? 0,
      pendingAttack: state?.core?.pendingAttack ?? null,
      diceCount: state?.core?.dice?.length ?? 0,
    };
  }, { timeout: 10000 }).toMatchObject({
    phase: 'offensiveRoll',
    activePlayerId: '0',
    attackerCharacter: 'samurai',
    defenderCharacter: options.defenderCharacter,
    masamuneLevel: 2,
    pendingAttack: null,
    diceCount: 5,
  });
}

async function openAndInjectSamuraiStandTall2DefenseScene(
  page: Page,
  game: TestGameController,
): Promise<void> {
  await game.openTestGame('dicethrone');
  await page.evaluate(async () => {
    const harness = (window as any).__BG_TEST_HARNESS__;
    const state = harness?.state?.get?.();
    if (!harness || !state) {
      throw new Error('TestHarness state not ready');
    }

    const random = {
      random: () => 0.5,
      d: (max: number) => Math.min(max, 1),
      range: (min: number, _max: number) => min,
      shuffle: <T,>(array: T[]) => [...array],
    };

    const [{ initHeroState, createCharacterDice }, { STAND_TALL_2 }, { SAMURAI_CARDS }] = await Promise.all([
      import('/src/games/dicethrone/domain/characters.ts'),
      import('/src/games/dicethrone/heroes/samurai/abilities.ts'),
      import('/src/games/dicethrone/heroes/samurai/cards.ts'),
    ]);

    // 重要：本用例需要“防御方（Samurai）”能够真实点击掷骰按钮。
    // 本项目 E2E 的 openTestGame 默认以 player '0' 作为可交互视角，
    // 因此这里让 Samurai 作为 player '0'，Monk 作为进攻方 player '1'。
    const samuraiBase = initHeroState('0', 'samurai', random as any);
    const attackerBase = initHeroState('1', 'monk', random as any);
    const upgradeCard = SAMURAI_CARDS.find((entry: any) => entry.id === 'upgrade-stand-tall-2');
    if (!upgradeCard) {
      throw new Error('upgrade-stand-tall-2 not found');
    }

    const baseDice = createCharacterDice('samurai');
    const dice = baseDice.map((die: any, index: number) => ({
      ...die,
      value: 1,
      // Stand Tall II：掷 4 颗，UI 仍渲染 5 颗，但第 5 颗默认 Locked（isKept=true）
      isKept: index >= 4,
    }));

    // 直接注入到 defensiveRoll，避免依赖“推进按钮 enabled/disabled”的不稳定条件。
    harness.state.set({
      ...state,
      sys: {
        ...state.sys,
        phase: 'defensiveRoll',
        interaction: {
          current: undefined,
          queue: [],
        },
        eventStream: {
          ...(state.sys?.eventStream ?? {}),
          entries: [],
        },
      },
      core: {
        ...state.core,
        // activePlayerId 在防御掷骰阶段仍是“回合主动玩家”（进攻方），掷骰者由 pendingAttack.defenderId 决定。
        activePlayerId: '1',
        hostStarted: true,
        selectedCharacters: {
          ...(state.core.selectedCharacters ?? {}),
          '0': 'samurai',
          '1': 'monk',
        },
        rollCount: 0,
        rollLimit: 1,
        rollConfirmed: false,
        rollDiceCount: 4,
        dice,
        pendingDamage: undefined,
        pendingBonusDiceSettlement: undefined,
        players: {
          ...state.core.players,
          '0': {
            ...samuraiBase,
            hand: [],
            discard: [],
            abilities: samuraiBase.abilities.map((ability: any) => (
              ability.id === 'stand-tall' ? JSON.parse(JSON.stringify(STAND_TALL_2)) : ability
            )),
            abilityLevels: {
              ...(samuraiBase.abilityLevels ?? {}),
              'stand-tall': 2,
            },
            upgradeCardByAbilityId: {
              ...(samuraiBase.upgradeCardByAbilityId ?? {}),
              'stand-tall': {
                cardId: upgradeCard.id,
                cpCost: upgradeCard.cpCost,
              },
            },
            resources: {
              ...samuraiBase.resources,
              hp: 50,
              cp: 2,
            },
          },
          '1': {
            ...attackerBase,
            hand: [],
            discard: [],
            resources: {
              ...attackerBase.resources,
              hp: 50,
              cp: 2,
            },
          },
        },
        pendingAttack: {
          attackerId: '1',
          defenderId: '0',
          isDefendable: true,
          damage: 5,
          bonusDamage: 0,
          defenseAbilityId: 'stand-tall',
          sourceAbilityId: 'harmony',
        },
      },
    });

    (window as any).__BG_LAST_COMMAND_REJECTED__ = null;
  });

  await expect.poll(async () => {
    const state = await readState(game);
    return {
      phase: state?.sys?.phase ?? null,
      activePlayerId: state?.core?.activePlayerId ?? null,
      defenderCharacter: state?.core?.selectedCharacters?.['0'] ?? null,
      standTallLevel: state?.core?.players?.['0']?.abilityLevels?.['stand-tall'] ?? 0,
      sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
      pendingAttackDefender: state?.core?.pendingAttack?.defenderId ?? null,
    };
  }, { timeout: 10000 }).toMatchObject({
    phase: 'defensiveRoll',
    activePlayerId: '1',
    defenderCharacter: 'samurai',
    standTallLevel: 2,
    sourceAbilityId: 'harmony',
    pendingAttackDefender: '0',
  });
}

test.describe('DiceThrone hand card preview regression', () => {
  test('samurai and gunslinger hand cards should use ability atlas without shimmer', async ({ page, game }) => {
    test.setTimeout(120000);
    const evidenceDir = ensureEvidenceDir();

    await setupHeroScene(page, game, 'samurai', [
      'upgrade-solemnity-2',
      'upgrade-budo-2',
      'upgrade-masamune-2',
    ]);
    await page.screenshot({ path: join(evidenceDir, 'preview-samurai-hand.png'), fullPage: true });

    await setupHeroScene(page, game, 'gunslinger', [
      'upgrade-fan-the-hammer-2',
      'upgrade-take-cover-2',
      'upgrade-duel-2',
    ]);
    await page.screenshot({ path: join(evidenceDir, 'preview-gunslinger-hand.png'), fullPage: true });
  });

  test('老派系升级牌稳定态应与新派系一致：进入技能槽而不是留在弃牌堆', async ({ page, game }) => {
    test.setTimeout(360000);
    const evidenceDir = ensureEvidenceDir();

    const legacyScenarios = [
      { heroId: 'monk', cardId: 'card-thrust-punch-2', abilityId: 'fist-technique', expectedSlotId: 'fist' },
      { heroId: 'monk', cardId: 'card-mahayana-2', abilityId: 'harmony', expectedSlotId: 'combo' },
      { heroId: 'monk', cardId: 'card-lotus-bloom-2', abilityId: 'lotus-palm', expectedSlotId: 'lightning' },
      { heroId: 'barbarian', cardId: 'card-slap-2', abilityId: 'slap' },
      { heroId: 'pyromancer', cardId: 'card-fireball-2', abilityId: 'fireball' },
      { heroId: 'pyromancer', cardId: 'card-magma-armor-2', abilityId: 'magma-armor' },
      { heroId: 'moon_elf', cardId: 'upgrade-longbow-2', abilityId: 'longbow' },
      { heroId: 'shadow_thief', cardId: 'upgrade-dagger-strike-2', abilityId: 'dagger-strike' },
      { heroId: 'paladin', cardId: 'card-holy-strike-2', abilityId: 'holy-strike' },
    ] as const;

    for (const scenario of legacyScenarios) {
      await test.step(`老派系 ${scenario.heroId} 打出 ${scenario.cardId}`, async () => {
        await setupHeroScene(page, game, scenario.heroId, [scenario.cardId], {
          opponentHeroId: 'monk',
        });
        await clickHandCard(page, scenario.cardId);
        await waitForUpgradeApplied(page, game, scenario.abilityId, 2, null, scenario.cardId, {
          expectedHandIdsAfter: [],
        });
        await waitForHandAnimationSettled(page);
        await expectUpgradeStableOnPlayerBoard(page, game, scenario.abilityId, scenario.cardId);
        if ('expectedSlotId' in scenario) {
          const stateAfterUpgrade = await readState(game);
          const characterId = stateAfterUpgrade?.core?.selectedCharacters?.['0'];
          const playerBoardFace = stateAfterUpgrade?.core?.players?.['0']?.playerBoardFace;
          const slotId = await resolveAbilitySlotId(page, scenario.abilityId, { characterId, playerBoardFace });
          expect(slotId, `${scenario.cardId} 应落在 ${scenario.expectedSlotId} 物理槽`).toBe(scenario.expectedSlotId);
          await expect(page.locator(`[data-upgrade-preview-slot="${scenario.expectedSlotId}"]`).first()).toBeVisible({ timeout: 10000 });
        }
        await page.screenshot({
          path: join(evidenceDir, `legacy-${scenario.heroId}-${scenario.abilityId}-upgrade-stable.png`),
          fullPage: true,
        });
      });
    }
  });

  test('圣骑士满升级牌端到端截图', async ({ page, game }) => {
    test.setTimeout(120000);
    const evidenceDir = ensureEvidenceDir();
    const beforeScreenshotPath = join(evidenceDir, 'legacy-paladin-before-upgrades-board.png');
    const screenshotPath = join(evidenceDir, 'legacy-paladin-full-upgrades-board.png');

    await setupHeroScene(page, game, 'paladin', [], {
      opponentHeroId: 'monk',
    });
    await expect(page.locator('[data-testid="player-board-surface"][data-character-id="paladin"]').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: beforeScreenshotPath, fullPage: true });
    console.log(`[E2E-SCREENSHOT] ${beforeScreenshotPath}`);

    await game.openTestGame('dicethrone');
    await page.evaluate(async () => {
      const harness = (window as any).__BG_TEST_HARNESS__;
      const state = harness?.state?.get?.();
      if (!harness || !state) {
        throw new Error('TestHarness state not ready');
      }

      const [{ initHeroState }, { PALADIN_CARDS }, abilitiesModule] = await Promise.all([
        import('/src/games/dicethrone/domain/characters.ts'),
        import('/src/games/dicethrone/heroes/paladin/cards.ts'),
        import('/src/games/dicethrone/heroes/paladin/abilities.ts'),
      ]);

      const random = {
        random: () => 0.5,
        d: (max: number) => Math.min(max, 1),
        range: (min: number, _max: number) => min,
        shuffle: <T,>(array: T[]) => [...array],
      };
      const paladinBase = initHeroState('0', 'paladin', random as any);
      const opponentBase = initHeroState('1', 'monk', random as any);

      const upgradeSpecs = [
        { abilityId: 'holy-defense', level: 3, cardId: 'card-holy-defense-3', def: abilitiesModule.HOLY_DEFENSE_3 },
        { abilityId: 'holy-light', level: 2, cardId: 'card-holy-light-2', def: abilitiesModule.HOLY_LIGHT_2 },
        { abilityId: 'righteous-combat', level: 3, cardId: 'card-righteous-combat-3', def: abilitiesModule.RIGHTEOUS_COMBAT_3 },
        { abilityId: 'blessing-of-might', level: 2, cardId: 'card-blessing-of-might-2', def: abilitiesModule.BLESSING_OF_MIGHT_2 },
        { abilityId: 'holy-strike', level: 2, cardId: 'card-holy-strike-2', def: abilitiesModule.HOLY_STRIKE_2 },
        { abilityId: 'vengeance', level: 2, cardId: 'card-vengeance-2', def: abilitiesModule.VENGEANCE_2 },
        { abilityId: 'righteous-prayer', level: 2, cardId: 'card-righteous-prayer-2', def: abilitiesModule.RIGHTEOUS_PRAYER_2 },
        { abilityId: 'tithes', level: 2, cardId: 'card-tithes-2', def: abilitiesModule.PALADIN_TITHES_UPGRADED },
      ];

      const upgradeCards = new Map(PALADIN_CARDS.map((card: any) => [card.id, card]));
      const abilityLevels = { ...(paladinBase.abilityLevels ?? {}) };
      const upgradeCardByAbilityId = { ...(paladinBase.upgradeCardByAbilityId ?? {}) };
      const upgradedAbilities = paladinBase.abilities.map((ability: any) => {
        const spec = upgradeSpecs.find((entry) => entry.abilityId === ability.id);
        if (!spec) return ability;
        const card = upgradeCards.get(spec.cardId) as any;
        if (!card) {
          throw new Error(`${spec.cardId} not found`);
        }
        abilityLevels[spec.abilityId] = spec.level;
        upgradeCardByAbilityId[spec.abilityId] = {
          cardId: spec.cardId,
          cpCost: card.cpCost,
        };
        return JSON.parse(JSON.stringify(spec.def));
      });
      const tithesCard = upgradeCards.get('card-tithes-2') as any;
      if (!tithesCard) {
        throw new Error('card-tithes-2 not found');
      }
      abilityLevels.tithes = 2;
      upgradeCardByAbilityId.tithes = {
        cardId: 'card-tithes-2',
        cpCost: tithesCard.cpCost,
      };
      const upgradedPassiveAbilities = (paladinBase.passiveAbilities ?? []).map((ability: any) => (
        ability.id === 'tithes'
          ? JSON.parse(JSON.stringify(abilitiesModule.PALADIN_TITHES_UPGRADED))
          : ability
      ));

      harness.state.set({
        ...state,
        sys: {
          ...state.sys,
          phase: 'main1',
          interaction: {
            current: undefined,
            queue: [],
          },
          eventStream: {
            ...(state.sys?.eventStream ?? {}),
            entries: [],
          },
        },
        core: {
          ...state.core,
          activePlayerId: '0',
          hostStarted: true,
          selectedCharacters: {
            ...(state.core.selectedCharacters ?? {}),
            '0': 'paladin',
            '1': 'monk',
          },
          pendingAttack: null,
          pendingDamage: undefined,
          pendingBonusDiceSettlement: undefined,
          rollCount: 0,
          rollConfirmed: false,
          players: {
            ...state.core.players,
            '0': {
              ...paladinBase,
              hand: [],
              discard: [],
              abilities: upgradedAbilities,
              passiveAbilities: upgradedPassiveAbilities,
              abilityLevels,
              upgradeCardByAbilityId,
              resources: {
                ...paladinBase.resources,
                cp: 20,
                hp: 50,
              },
            },
            '1': {
              ...opponentBase,
              hand: [],
              discard: [],
              resources: {
                ...opponentBase.resources,
                cp: 2,
                hp: 50,
              },
            },
          },
        },
      });
      (window as any).__BG_LAST_COMMAND_REJECTED__ = null;
    });

    await game.waitForPhase('main1', 10000);
    await expect.poll(async () => {
      const state = await readState(game);
      const player = state?.core?.players?.['0'];
      return {
        characterId: state?.core?.selectedCharacters?.['0'] ?? null,
        upgradedCount: Object.keys(player?.upgradeCardByAbilityId ?? {}).length,
        holyDefenseCard: player?.upgradeCardByAbilityId?.['holy-defense']?.cardId ?? null,
        holyLightCard: player?.upgradeCardByAbilityId?.['holy-light']?.cardId ?? null,
      };
    }, { timeout: 10000 }).toMatchObject({
      characterId: 'paladin',
      upgradedCount: 8,
      holyDefenseCard: 'card-holy-defense-3',
      holyLightCard: 'card-holy-light-2',
    });

    const expectedSlots = ['fist', 'chi', 'sky', 'lotus', 'combo', 'lightning', 'calm', 'meditate'];
    for (const slotId of expectedSlots) {
      await expect(page.locator(`[data-upgrade-preview-slot="${slotId}"]`).first()).toBeVisible({ timeout: 10000 });
    }

    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`[E2E-SCREENSHOT] ${screenshotPath}`);
  });

  test('老派系升级后点击新面板卡图物理槽应触发正确技能', async ({ page, game }) => {
    test.setTimeout(180000);
    const evidenceDir = ensureEvidenceDir();

    await setupHeroScene(page, game, 'monk', ['card-thrust-punch-2'], {
      opponentHeroId: 'barbarian',
    });
    await clickHandCard(page, 'card-thrust-punch-2');
    await waitForUpgradeApplied(page, game, 'fist-technique', 2, null, 'card-thrust-punch-2', {
      expectedHandIdsAfter: [],
    });
    await waitForHandAnimationSettled(page);
    await expectUpgradeStableOnPlayerBoard(page, game, 'fist-technique', 'card-thrust-punch-2');

    const stateAfterUpgrade = await readState(game);
    const characterId = stateAfterUpgrade?.core?.selectedCharacters?.['0'];
    const playerBoardFace = stateAfterUpgrade?.core?.players?.['0']?.playerBoardFace;
    const slotId = await resolveAbilitySlotId(page, 'fist-technique', { characterId, playerBoardFace });
    expect(slotId, '僧侣拳法应落在 v2 面板通用 fist 物理槽').toBe('fist');

    await injectOffensiveRollDice(page, game, [1, 1, 1, 1, 1], '0', 'monk-dice');
    await clickCurrentPlayerAbilitySlot(page, game, 'fist-technique');

    await expect.poll(async () => {
      const state = await readState(game);
      const expectedDamage = await page.evaluate(async () => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const matchState = harness?.state?.get?.();
        if (!matchState?.core?.pendingAttack) return null;
        const { getPendingAttackExpectedDamage } = await import('/src/games/dicethrone/domain/utils.ts');
        return getPendingAttackExpectedDamage(matchState.core, matchState.core.pendingAttack);
      });

      return {
        reject: await page.evaluate(() => (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null),
        sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
        expectedDamage,
      };
    }, { timeout: 15000 }).toMatchObject({
      reject: null,
      sourceAbilityId: 'fist-technique-2-5',
      expectedDamage: 9,
    });

    await page.screenshot({
      path: join(evidenceDir, 'legacy-monk-fist-technique-upgraded-slot-click.png'),
      fullPage: true,
    });
  });

  test('gunslinger 专属升级牌应逐张可打出并正确升级到基础技能', async ({ page, game }) => {
    test.setTimeout(420000);
    const evidenceDir = ensureEvidenceDir();

    const singleUpgrades = [
      { cardId: 'upgrade-revolver-2', abilityId: 'revolver', expectedLevel: 2, expectedCp: 8 },
      { cardId: 'upgrade-bounty-hunter-2', abilityId: 'bounty-hunter', expectedLevel: 2, expectedCp: 9 },
      { cardId: 'upgrade-fan-the-hammer-2', abilityId: 'fan-the-hammer', expectedLevel: 2, expectedCp: 8, verifyAbility: true },
      { cardId: 'upgrade-take-cover-2', abilityId: 'take-cover', expectedLevel: 2, expectedCp: 8 },
      { cardId: 'upgrade-deadeye-2', abilityId: 'deadeye', expectedLevel: 2, expectedCp: 8 },
      { cardId: 'upgrade-duel-2', abilityId: 'duel', expectedLevel: 2, expectedCp: 7 },
      { cardId: 'upgrade-quick-draw', abilityId: 'quick-draw', expectedLevel: 2, expectedCp: 8 },
    ] as const;

    for (const scenario of singleUpgrades) {
      await test.step(`枪手打出 ${scenario.cardId}`, async () => {
        await setupHeroScene(page, game, 'gunslinger', [scenario.cardId], {
          opponentHeroId: 'monk',
        });
        await clickHandCard(page, scenario.cardId);
        await waitForUpgradeApplied(page, game, scenario.abilityId, scenario.expectedLevel, scenario.expectedCp, scenario.cardId, {
          expectedHandIdsAfter: [],
        });

        if (scenario.cardId === 'upgrade-deadeye-2') {
          await waitForHandAnimationSettled(page);
          const deadeyeUpgradeSlot = page.locator('[data-upgrade-preview-slot="lightning"]').first();
          await expect(deadeyeUpgradeSlot).toBeVisible({ timeout: 10000 });
          await page.screenshot({ path: join(evidenceDir, 'gunslinger-upgrade-deadeye-after-play.png'), fullPage: true });
        }

        if (scenario.verifyAbility) {
          await injectOffensiveRollDice(page, game, [1, 2, 3, 4, 5]);
          await clickCurrentPlayerAbilitySlot(page, game, scenario.abilityId);
          await chooseAbilityVariantIfVisible(page, /左輪速射 II|左轮速射 II|5 顆連續|5 颗连续|large straight/i);

          await expect.poll(async () => {
            const state = await readState(game);
            const expectedDamage = await page.evaluate(async () => {
              const harness = (window as any).__BG_TEST_HARNESS__;
              const matchState = harness?.state?.get?.();
              if (!matchState?.core?.pendingAttack) return null;
              const { getPendingAttackExpectedDamage } = await import('/src/games/dicethrone/domain/utils.ts');
              return getPendingAttackExpectedDamage(matchState.core, matchState.core.pendingAttack);
            });

            return {
              reject: await page.evaluate(() => (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null),
              sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
              expectedDamage,
            };
          }, { timeout: 15000 }).toMatchObject({
            reject: null,
            sourceAbilityId: 'fan-the-hammer-2-main',
            expectedDamage: 8,
          });
        }
      });
    }

    await test.step('枪手顺序打出 showdown II 和 III', async () => {
      await setupHeroScene(page, game, 'gunslinger', ['upgrade-showdown-2', 'upgrade-showdown-3'], {
        opponentHeroId: 'monk',
      });

      await clickHandCard(page, 'upgrade-showdown-2');
      await waitForUpgradeApplied(page, game, 'showdown', 2, 9, 'upgrade-showdown-2', {
        expectedHandIdsAfter: ['upgrade-showdown-3'],
      });

      await clickHandCard(page, 'upgrade-showdown-3');
      await waitForUpgradeApplied(page, game, 'showdown', 3, null, 'upgrade-showdown-3', {
        expectedHandIdsAfter: [],
      });
    });

    await waitForHandAnimationSettled(page);
    await page.screenshot({ path: join(evidenceDir, 'gunslinger-upgrades-end-to-end.png'), fullPage: true });
  });

  test('gunslinger upgrade-deadeye-2 端到端：升级后触发死亡之眼 II 并结算 8 点不可防御伤害', async ({ page, game }) => {
    test.setTimeout(180000);
    const evidenceDir = ensureEvidenceDir();

    await setupHeroScene(page, game, 'gunslinger', ['upgrade-deadeye-2'], {
      opponentHeroId: 'monk',
      player1Resources: { cp: 0, hp: 50 },
    });

    await clickHandCard(page, 'upgrade-deadeye-2');
    await waitForUpgradeApplied(page, game, 'deadeye', 2, 8, 'upgrade-deadeye-2', {
      expectedHandIdsAfter: [],
    });
    await waitForHandAnimationSettled(page);

    const actionLogAfterUpgrade = await page.evaluate(() => {
      const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
      const entries = state?.sys?.actionLog?.entries ?? [];
      return entries.slice(-3).map((entry: any) => ({
        kind: entry?.kind ?? null,
        actorId: entry?.actorId ?? null,
        segments: (entry?.segments ?? []).map((segment: any) => ({
          type: segment?.type ?? null,
          key: segment?.key ?? null,
          cardId: segment?.cardId ?? null,
          previewText: segment?.previewText ?? null,
          params: segment?.params ?? null,
        })),
      }));
    });
    expect(actionLogAfterUpgrade.some((entry: any) => entry?.kind === 'PLAY_UPGRADE_CARD')).toBe(true);
    expect(
      actionLogAfterUpgrade.some((entry: any) => entry?.segments?.some((segment: any) =>
        segment?.key === 'actionLog.playUpgradeCard' || segment?.cardId === 'upgrade-deadeye-2')),
    ).toBe(true);
    await expectActionLogLatestRowContains(page, ['打出升级卡', '死亡之眼 II']);
    await captureActionLogPanel(page, join(evidenceDir, 'gunslinger-upgrade-deadeye-action-log.png'));

    const deadeyeUpgradeSlot = page.locator('[data-upgrade-preview-slot="lightning"]').first();
    await expect(deadeyeUpgradeSlot).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: join(evidenceDir, 'gunslinger-upgrade-deadeye-after-play.png'), fullPage: true });

    await injectOffensiveRollDice(page, game, [6, 6, 6, 6, 1]);
    const deadeyeDebug = await page.evaluate(async () => {
      const harness = (window as any).__BG_TEST_HARNESS__;
      const matchState = harness?.state?.get?.();
      if (!matchState?.core || !matchState?.sys) {
        return null;
      }
      const { getAvailableAbilityIds } = await import('/src/games/dicethrone/domain/rules.ts');
      const availableAbilityIds = getAvailableAbilityIds(matchState.core, '0', matchState.sys.phase);
      return {
        phase: matchState.sys.phase ?? null,
        selectedAbilityId: matchState.core.selectedAttack?.abilityId ?? null,
        availableAbilityIds,
        dice: (matchState.core.dice ?? []).map((die: any) => ({
          value: die.value ?? null,
          symbol: die.symbol ?? null,
          symbols: die.symbols ?? [],
          definitionId: die.definitionId ?? null,
        })),
      };
    });
    expect(deadeyeDebug, `deadeye 调试状态异常: ${JSON.stringify(deadeyeDebug)}`).toMatchObject({
      phase: 'offensiveRoll',
    });
    expect(deadeyeDebug?.availableAbilityIds ?? [], `deadeye 未进入可用技能列表: ${JSON.stringify(deadeyeDebug)}`).toContain('deadeye-2-main');

    await clickAbilitySlot(page, 'deadeye');
    await chooseAbilityVariant(page, /死亡之眼 II|4\s*个准星|4\s*個準心|4bullseye/i);

    const waitForDeadeyeAttack = async (timeout: number) => {
      await expect.poll(async () => {
        const state = await readState(game);
        const expectedDamage = await page.evaluate(async () => {
          const harness = (window as any).__BG_TEST_HARNESS__;
          const matchState = harness?.state?.get?.();
          if (!matchState?.core?.pendingAttack) return null;
          const { getPendingAttackExpectedDamage } = await import('/src/games/dicethrone/domain/utils.ts');
          return getPendingAttackExpectedDamage(matchState.core, matchState.core.pendingAttack);
        });

        return {
          reject: await page.evaluate(() => (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null),
          phase: state?.sys?.phase ?? null,
          sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
          isDefendable: state?.core?.pendingAttack?.isDefendable ?? null,
          expectedDamage,
        };
      }, { timeout }).toMatchObject({
        reject: null,
        phase: 'offensiveRoll',
        sourceAbilityId: 'deadeye-2-main',
        isDefendable: false,
        expectedDamage: 8,
      });
    };

    try {
      await waitForDeadeyeAttack(5000);
    } catch (error) {
      const afterClickDebug = await page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const matchState = harness?.state?.get?.();
        return {
          selectedAttack: matchState?.core?.selectedAttack ?? null,
          pendingAttack: matchState?.core?.pendingAttack ?? null,
          lastRejected: (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null,
        };
      });
      throw new Error(`deadeye UI 点击后未发起攻击: ${JSON.stringify(afterClickDebug)}; 原错误=${String(error)}`);
    }

    await clickAdvancePhase(page);

    await expect.poll(async () => {
      const state = await readState(game);
      return {
        reject: await page.evaluate(() => (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null),
        phase: state?.sys?.phase ?? null,
        pendingAttack: state?.core?.pendingAttack ?? null,
        opponentHp: getHp(state?.core?.players?.['1']),
        opponentKnockdown: state?.core?.players?.['1']?.statusEffects?.knockdown ?? 0,
      };
    }, { timeout: 15000 }).toMatchObject({
      reject: null,
      phase: 'main2',
      pendingAttack: null,
      opponentHp: 42,
      opponentKnockdown: 1,
    });

    await page.screenshot({ path: join(evidenceDir, 'gunslinger-deadeye-attack-resolved.png'), fullPage: true });
  });

  test('gunslinger 复合升级子技能应在打出升级牌后从技能槽正确触发', async ({ page, game }) => {
    test.setTimeout(360000);
    const evidenceDir = ensureEvidenceDir();

    await test.step('枪手打出 upgrade-fan-the-hammer-2 后触发枪托击打', async () => {
      await setupHeroScene(page, game, 'gunslinger', ['upgrade-fan-the-hammer-2'], {
        opponentHeroId: 'paladin',
        player1Tokens: { protect: 1 },
      });
      await clickHandCard(page, 'upgrade-fan-the-hammer-2');
      await waitForUpgradeApplied(page, game, 'fan-the-hammer', 2, 8, 'upgrade-fan-the-hammer-2', {
        expectedHandIdsAfter: [],
      });
      await expectUpgradeStableOnPlayerBoard(page, game, 'fan-the-hammer', 'upgrade-fan-the-hammer-2');
      await injectOffensiveRollDice(page, game, [4, 4, 6, 1, 1]);
      await clickAbilitySlot(page, 'fan-the-hammer');
      await clickAdvancePhase(page);
      await skipTokenResponseIfNeeded(page, game, '1');

      await expect.poll(async () => {
        const state = await readState(game);
        return {
          reject: await page.evaluate(() => (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null),
          selfEvasive: state?.core?.players?.['0']?.tokens?.evasive ?? 0,
          opponentKnockdown: state?.core?.players?.['1']?.statusEffects?.knockdown ?? 0,
          opponentProtect: state?.core?.players?.['1']?.tokens?.protect ?? 0,
          opponentHp: getHp(state?.core?.players?.['1']),
          pendingAttack: state?.core?.pendingAttack ?? null,
        };
      }, { timeout: 15000 }).toMatchObject({
        reject: null,
        selfEvasive: 1,
        opponentKnockdown: 1,
        // E2E 里的防守方是 AI；它会正常花费守护，把 1 点直接伤害降为 0。
        opponentProtect: 0,
        opponentHp: 50,
        pendingAttack: null,
      });

      await expectActionLogLatestRowContains(page, ['枪托击打']);
      await captureActionLogPanel(page, join(evidenceDir, 'gunslinger-pistol-whip-action-log.png'));
    });

    await test.step('枪手打出 card-wanted', async () => {
      await setupHeroScene(page, game, 'gunslinger', ['card-wanted']);
      await clickHandCard(page, 'card-wanted');
      const stateAfter = await waitForCardResolved(page, game, 'card-wanted', 8, {
        expectedHandIdsAfter: [],
      });
      expect(stateAfter.core.players['1'].tokens?.bounty ?? 0).toBe(1);
    });

    await test.step('枪手打出 card-spin-the-chamber', async () => {
      await setupHeroScene(page, game, 'gunslinger', ['card-spin-the-chamber']);
      await clickHandCard(page, 'card-spin-the-chamber');
      const stateAfter = await waitForCardResolved(page, game, 'card-spin-the-chamber', 9, {
        expectedHandIdsAfter: [],
      });
      expect(stateAfter.core.players['0'].tokens?.loaded ?? 0).toBe(1);
    });

    await test.step('枪手打出 card-high-noon', async () => {
      await setupHeroScene(page, game, 'gunslinger', ['card-high-noon']);
      await setHarnessDiceValues(page, [1]);
      await clickHandCard(page, 'card-high-noon');
      await waitForCardResolved(page, game, 'card-high-noon', 9, {
        expectedHandIdsAfter: [],
      });
      await expectRightTrayBonusDiceConfirmation(page, () => readState(game), {});
      await settleCurrentBonusDice(page, () => readState(game), {});
      const stateAfter = await readState(game);
      const entries = stateAfter?.sys?.eventStream?.entries ?? [];
      const latestBonusDieEvent = [...entries].reverse().find((entry: any) => entry.event?.type === 'BONUS_DIE_ROLLED');
      expect(latestBonusDieEvent?.event?.payload?.effectKey).toBe('bonusDie.effect.gunslingerHighNoonBullet');
      expect(getHp(stateAfter.core.players['1'])).toBe(48);
      expect(stateAfter.core.players['1'].statusEffects?.knockdown ?? 0).toBe(0);
      expect(stateAfter.core.players['1'].tokens?.bounty ?? 0).toBe(0);
    });

    await test.step('枪手打出 upgrade-take-cover-2 后触发标记目标', async () => {
      await setupHeroScene(page, game, 'gunslinger', ['upgrade-take-cover-2'], {
        opponentHeroId: 'monk',
      });
      await clickHandCard(page, 'upgrade-take-cover-2');
      await waitForUpgradeApplied(page, game, 'take-cover', 2, 8, 'upgrade-take-cover-2', {
        expectedHandIdsAfter: [],
      });
      await expectUpgradeStableOnPlayerBoard(page, game, 'take-cover', 'upgrade-take-cover-2');
      await injectOffensiveRollDice(page, game, [4, 4, 4, 1, 1]);
      await clickAbilitySlot(page, 'take-cover');
      await chooseAbilityVariant(page, /标记目标|3dash/i);
      await clickAdvancePhase(page);

      await expect.poll(async () => {
        const state = await readState(game);
        return {
          reject: await page.evaluate(() => (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null),
          selfEvasive: state?.core?.players?.['0']?.tokens?.evasive ?? 0,
          opponentBounty: state?.core?.players?.['1']?.tokens?.bounty ?? 0,
          pendingAttack: state?.core?.pendingAttack ?? null,
        };
      }, { timeout: 15000 }).toMatchObject({
        reject: null,
        selfEvasive: 2,
        opponentBounty: 1,
        pendingAttack: null,
      });

      await expectActionLogLatestRowContains(page, ['标记目标']);
      await captureActionLogPanel(page, join(evidenceDir, 'gunslinger-mark-the-target-action-log.png'));
    });

    await test.step('枪手打出 upgrade-deadeye-2 后触发执法者', async () => {
      await setupHeroScene(page, game, 'gunslinger', ['upgrade-deadeye-2'], {
        opponentHeroId: 'monk',
      });
      await clickHandCard(page, 'upgrade-deadeye-2');
      await waitForUpgradeApplied(page, game, 'deadeye', 2, 8, 'upgrade-deadeye-2', {
        expectedHandIdsAfter: [],
      });
      await expectUpgradeStableOnPlayerBoard(page, game, 'deadeye', 'upgrade-deadeye-2');
      await injectOffensiveRollDice(page, game, [6, 6, 6, 1, 1]);
      await clickAbilitySlot(page, 'deadeye');
      await clickAdvancePhase(page);

      await expect.poll(async () => {
        const state = await readState(game);
        return {
          reject: await page.evaluate(() => (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null),
          selfEvasive: state?.core?.players?.['0']?.tokens?.evasive ?? 0,
          opponentBounty: state?.core?.players?.['1']?.tokens?.bounty ?? 0,
          opponentKnockdown: state?.core?.players?.['1']?.statusEffects?.knockdown ?? 0,
          pendingAttack: state?.core?.pendingAttack ?? null,
        };
      }, { timeout: 15000 }).toMatchObject({
        reject: null,
        selfEvasive: 1,
        opponentBounty: 1,
        opponentKnockdown: 1,
        pendingAttack: null,
      });

      await expectActionLogLatestRowContains(page, ['执法者']);
      await captureActionLogPanel(page, join(evidenceDir, 'gunslinger-the-law-action-log.png'));
    });

    await waitForHandAnimationSettled(page);
    await page.screenshot({ path: join(evidenceDir, 'gunslinger-main-cards-end-to-end.png'), fullPage: true });
  });

  test('gunslinger 攻击修正牌应逐张可打出并挂到当前攻击链路', async ({ page, game }) => {
    test.setTimeout(240000);
    const evidenceDir = ensureEvidenceDir();

    await test.step('枪手打出 card-wild-west（Loaded 奖励骰重投后由右侧骰盘确认）', async () => {
      await openAndInjectGunslingerAttackModifierScene(page, game, {
        cardId: 'card-wild-west',
        sourceAbilityId: 'showdown',
        diceValues: [1],
      });
      await clickHandCard(page, 'card-wild-west');

      await expect.poll(async () => {
        const state = await readState(game);
        return {
          reject: await page.evaluate(() => (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null),
          loadedTokens: state?.core?.players?.['0']?.tokens?.loaded ?? 0,
          boostAdds: state?.core?.pendingAttack?.loadedBonusDieBoost?.postSettleBonusDamageAdds?.length ?? 0,
          settlement: state?.core?.pendingBonusDiceSettlement ?? null,
        };
      }, { timeout: 15000 }).toMatchObject({
        reject: null,
        loadedTokens: 1,
        boostAdds: 1,
        settlement: null,
      });

      const resolveAttackButton = page.getByRole('button', { name: /^(Resolve Attack|结算攻击)$/i }).first();
      await expect(resolveAttackButton).toBeVisible({ timeout: 5000 });
      await expect(resolveAttackButton).toBeEnabled({ timeout: 5000 });
      await resolveAttackButton.click({ force: true });

      const waitForLoadedChoice = async (timeout: number) => {
        await expect.poll(async () => {
          const state = await readState(game);
          const current = state?.sys?.interaction?.current;
          const options = Array.isArray(current?.data?.options) ? current.data.options : [];
          return {
            reject: await page.evaluate(() => (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null),
            kind: current?.kind ?? null,
            playerId: current?.playerId ?? null,
            optionIds: options.map((option: any) => option?.value?.customId ?? option?.customId ?? option?.id),
          };
        }, { timeout }).toMatchObject({
          reject: null,
          kind: 'simple-choice',
          playerId: '0',
          optionIds: expect.arrayContaining(['use-loaded']),
        });
      };

      try {
        await waitForLoadedChoice(2000);
      } catch {
        await page.evaluate(async () => {
          await (window as any).__BG_TEST_HARNESS__?.command?.dispatch?.({
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: {},
          });
        });
        await waitForLoadedChoice(10000);
      }

      await expect.poll(async () => {
        const state = await readState(game);
        const current = state?.sys?.interaction?.current;
        const options = Array.isArray(current?.data?.options) ? current.data.options : [];
        return {
          kind: current?.kind ?? null,
          playerId: current?.playerId ?? null,
          optionIds: options.map((option: any) => option?.value?.customId ?? option?.customId ?? option?.id),
        };
      }, { timeout: 10000 }).toMatchObject({
        kind: 'simple-choice',
        playerId: '0',
        optionIds: expect.arrayContaining(['use-loaded']),
      });
      const loadedOption = page.getByRole('button', { name: /^装填$/ }).first();
      await expect(loadedOption).toBeVisible({ timeout: 5000 });
      await loadedOption.click({ force: true });

      await expectRightTrayBonusDiceConfirmation(page, () => readState(game), {});
      const bonusDie = getRightTrayDie(page, 0);
      await expect(bonusDie).toBeVisible({ timeout: 5000 });
      await bonusDie.click({ force: true });

      await expect.poll(async () => {
        const state = await readState(game);
        return {
          loadedTokens: state?.core?.players?.['0']?.tokens?.loaded ?? 0,
          settlementDiceCount: state?.core?.pendingBonusDiceSettlement?.dice?.length ?? 0,
          rerollCount: state?.core?.pendingBonusDiceSettlement?.rerollCount ?? 0,
        };
      }, { timeout: 15000 }).toMatchObject({
        loadedTokens: 0,
        settlementDiceCount: 1,
        rerollCount: 1,
      });

      await settleCurrentBonusDice(page, () => readState(game), {});

      await expect.poll(async () => {
        const state = await readState(game);
        return {
          settlement: state?.core?.pendingBonusDiceSettlement ?? null,
          pendingAttack: state?.core?.pendingAttack
            ? {
              attackerId: state.core.pendingAttack.attackerId,
              defenderId: state.core.pendingAttack.defenderId,
              sourceAbilityId: state.core.pendingAttack.sourceAbilityId,
              attackModifierBonusDamage: state.core.pendingAttack.attackModifierBonusDamage ?? 0,
              totalBonusDamage: state.core.pendingAttack.bonusDamage ?? 0,
              settlementStage: state.core.pendingAttack.settlementStage ?? null,
              offensiveRollEndTokenResolved: state.core.pendingAttack.offensiveRollEndTokenResolved ?? null,
            }
            : null,
          defenderHp: getHp(state?.core?.players?.['1']),
          lastResolvedAttackDamage: state?.core?.lastResolvedAttackDamage ?? null,
        };
      }, { timeout: 15000 }).toMatchObject({
        settlement: null,
        pendingAttack: {
          attackerId: '0',
          defenderId: '1',
          sourceAbilityId: 'showdown',
          attackModifierBonusDamage: 1,
          totalBonusDamage: 2,
          settlementStage: 'preDamage',
          offensiveRollEndTokenResolved: true,
        },
        defenderHp: 50,
        lastResolvedAttackDamage: null,
      });
    });

    await test.step('枪手打出 card-eat-my-lead', async () => {
      await openAndInjectGunslingerAttackModifierScene(page, game, {
        cardId: 'card-eat-my-lead',
        sourceAbilityId: 'showdown',
        diceValues: [1, 1, 1, 1, 1],
      });
      await clickHandCard(page, 'card-eat-my-lead');

      await expectRightTrayBonusDiceConfirmation(page, () => readState(game), {});
      await expect.poll(async () => {
        const state = await readState(game);
        const entries = state?.sys?.eventStream?.entries ?? [];
        return {
          reject: await page.evaluate(() => (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null),
          handIds: getHandIds(state?.core?.players?.['0']),
          attackModifierBonusDamage: state?.core?.pendingAttack?.attackModifierBonusDamage ?? 0,
          totalBonusDamage: state?.core?.pendingAttack?.bonusDamage ?? 0,
          settlementDiceCount: state?.core?.pendingBonusDiceSettlement?.dice?.length ?? 0,
          bonusDieEventCount: entries.filter((entry: any) => entry.event?.type === 'BONUS_DIE_ROLLED').length,
          knockdown: state?.core?.players?.['1']?.statusEffects?.knockdown ?? 0,
        };
      }, { timeout: 15000 }).toMatchObject({
        reject: null,
        attackModifierBonusDamage: 0,
        totalBonusDamage: 0,
        settlementDiceCount: 5,
        bonusDieEventCount: 5,
        knockdown: 0,
      });

      await settleCurrentBonusDice(page, () => readState(game), {});

      await expect.poll(async () => {
        const state = await readState(game);
        return {
          settlement: state?.core?.pendingBonusDiceSettlement ?? null,
          attackModifierBonusDamage: state?.core?.pendingAttack?.attackModifierBonusDamage ?? 0,
          totalBonusDamage: state?.core?.pendingAttack?.bonusDamage ?? 0,
          knockdown: state?.core?.players?.['1']?.statusEffects?.knockdown ?? 0,
        };
      }, { timeout: 15000 }).toMatchObject({
        settlement: null,
        attackModifierBonusDamage: 5,
        totalBonusDamage: 5,
        knockdown: 1,
      });
    });

    await waitForHandAnimationSettled(page);
    await page.screenshot({ path: join(evidenceDir, 'gunslinger-attack-modifiers-end-to-end.png'), fullPage: true });
  });

  test('samurai 专属升级牌应逐张可打出并正确升级到基础技能', async ({ page, game }) => {
    test.setTimeout(420000);
    const evidenceDir = ensureEvidenceDir();

    const singleUpgrades = [
      { cardId: 'upgrade-solemnity-2', abilityId: 'solemnity', expectedLevel: 2, expectedCp: 8 },
      { cardId: 'upgrade-budo-2', abilityId: 'budo', expectedLevel: 2, expectedCp: 8 },
      { cardId: 'upgrade-masamune-2', abilityId: 'masamune', expectedLevel: 2, expectedCp: 8 },
      { cardId: 'upgrade-slot-06-2', abilityId: 'samurai-slot-06', expectedLevel: 2, expectedCp: 8 },
      { cardId: 'upgrade-stand-tall-2', abilityId: 'stand-tall', expectedLevel: 2, expectedCp: 7 },
    ] as const;

    for (const scenario of singleUpgrades) {
      await test.step(`武士打出 ${scenario.cardId}`, async () => {
        await setupHeroScene(page, game, 'samurai', [scenario.cardId], {
          opponentHeroId: 'monk',
        });
        await clickHandCard(page, scenario.cardId);
        await waitForUpgradeApplied(page, game, scenario.abilityId, scenario.expectedLevel, scenario.expectedCp, scenario.cardId, {
          expectedHandIdsAfter: [],
        });
      });
    }

    await test.step('武士顺序打出 katana-slice II 和 III', async () => {
      await setupHeroScene(page, game, 'samurai', ['upgrade-katana-slice-2', 'upgrade-katana-slice-3'], {
        opponentHeroId: 'monk',
      });

      await clickHandCard(page, 'upgrade-katana-slice-2');
      await waitForUpgradeApplied(page, game, 'katana-slice', 2, 8, 'upgrade-katana-slice-2', {
        expectedHandIdsAfter: ['upgrade-katana-slice-3'],
      });

      await clickHandCard(page, 'upgrade-katana-slice-3');
      await waitForUpgradeApplied(page, game, 'katana-slice', 3, null, 'upgrade-katana-slice-3', {
        expectedHandIdsAfter: [],
      });
    });

    await test.step('武士顺序打出 wakizashi II 和 III', async () => {
      await setupHeroScene(page, game, 'samurai', ['upgrade-wakizashi-2', 'upgrade-wakizashi-3'], {
        opponentHeroId: 'monk',
      });

      await clickHandCard(page, 'upgrade-wakizashi-2');
      await waitForUpgradeApplied(page, game, 'wakizashi', 2, 8, 'upgrade-wakizashi-2', {
        expectedHandIdsAfter: ['upgrade-wakizashi-3'],
      });

      await clickHandCard(page, 'upgrade-wakizashi-3');
      await waitForUpgradeApplied(page, game, 'wakizashi', 3, null, 'upgrade-wakizashi-3', {
        expectedHandIdsAfter: [],
      });
    });

    await waitForHandAnimationSettled(page);
    await page.screenshot({ path: join(evidenceDir, 'samurai-upgrades-end-to-end.png'), fullPage: true });
  });

  test('samurai 主阶段专属技能牌应逐张可打出并结算到正确结果', async ({ page, game }) => {
    test.setTimeout(240000);
    const evidenceDir = ensureEvidenceDir();

    await test.step('武士打出 card-samurai-honor', async () => {
      await setupHeroScene(page, game, 'samurai', ['card-samurai-honor'], {
        opponentHeroId: 'monk',
      });
      await clickHandCard(page, 'card-samurai-honor');
      const stateAfter = await waitForCardResolved(page, game, 'card-samurai-honor', 9, {
        expectedHandIdsAfter: [],
      });
      expect(stateAfter.core.players['0'].tokens?.honor ?? 0).toBe(2);
    });

    await test.step('武士打出 card-you-should-be-ashamed', async () => {
      await setupHeroScene(page, game, 'samurai', ['card-you-should-be-ashamed'], {
        opponentHeroId: 'monk',
      });
      await clickHandCard(page, 'card-you-should-be-ashamed');
      const stateAfter = await waitForCardResolved(page, game, 'card-you-should-be-ashamed', 9, {
        expectedHandIdsAfter: [],
      });
      expect(stateAfter.core.players['1'].tokens?.shame ?? 0).toBe(2);
    });

    await test.step('武士打出 card-no-retreat', async () => {
      await setupHeroScene(page, game, 'samurai', ['card-no-retreat'], {
        opponentHeroId: 'monk',
      });
      await clickHandCard(page, 'card-no-retreat');
      const stateAfter = await waitForCardResolved(page, game, 'card-no-retreat', 9, {
        expectedHandIdsAfter: [],
      });
      expect(stateAfter.core.players['0'].tokens?.samurai_retribution ?? 0).toBe(1);
    });

    await waitForHandAnimationSettled(page);
    await page.screenshot({ path: join(evidenceDir, 'samurai-main-cards-end-to-end.png'), fullPage: true });
  });

  test('samurai 荣誉与耻辱主阶段手牌在接近上限时应 clamp 到 stackLimit', async ({ page, game }) => {
    test.setTimeout(240000);
    const evidenceDir = ensureEvidenceDir();

    await test.step('武士荣耀在已有 1 层荣誉时再授予 2 层，最终应 clamp 到 2', async () => {
      await setupHeroScene(page, game, 'samurai', ['card-samurai-honor'], {
        opponentHeroId: 'monk',
        player0Tokens: { honor: 1 },
      });
      await clickHandCard(page, 'card-samurai-honor');
      const stateAfter = await waitForCardResolved(page, game, 'card-samurai-honor', 9, {
        expectedHandIdsAfter: [],
      });
      expect(stateAfter.core.players['0'].tokens?.honor ?? 0).toBe(2);
      await waitForHandAnimationSettled(page);
      await page.screenshot({ path: join(evidenceDir, 'samurai-honor-clamp-after-play.png'), fullPage: true });
    });

    await test.step('武士耻辱牌在目标已有 1 层耻辱时再施加 2 层，最终应 clamp 到 2', async () => {
      await setupHeroScene(page, game, 'samurai', ['card-you-should-be-ashamed'], {
        opponentHeroId: 'monk',
        player1Tokens: { shame: 1 },
      });
      await clickHandCard(page, 'card-you-should-be-ashamed');
      const stateAfter = await waitForCardResolved(page, game, 'card-you-should-be-ashamed', 9, {
        expectedHandIdsAfter: [],
      });
      expect(stateAfter.core.players['1'].tokens?.shame ?? 0).toBe(2);
      await waitForHandAnimationSettled(page);
      await page.screenshot({ path: join(evidenceDir, 'samurai-shame-clamp-after-play.png'), fullPage: true });
    });
  });

  test('samurai 攻击修正牌应逐张可打出并挂到当前攻击链路', async ({ page, game }) => {
    test.setTimeout(240000);
    const evidenceDir = ensureEvidenceDir();

    await test.step('武士打出 card-righteousness', async () => {
      await openAndInjectSamuraiAttackModifierScene(page, game, {
        cardId: 'card-righteousness',
        defenderCharacter: 'monk',
        sourceAbilityId: 'katana-slice-3',
        diceValues: [1],
      });
      await clickHandCard(page, 'card-righteousness');

      await expectRightTrayBonusDiceConfirmation(page, () => readState(game), {});
      await expect.poll(async () => {
        const state = await readState(game);
        const entries = state?.sys?.eventStream?.entries ?? [];
        const latestBonusDieEvent = [...entries].reverse().find((entry: any) => entry.event?.type === 'BONUS_DIE_ROLLED');
        const settlementDice = state?.core?.pendingBonusDiceSettlement?.dice ?? [];
        return {
          reject: await page.evaluate(() => (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null),
          handIds: getHandIds(state?.core?.players?.['0']),
          effectKey: latestBonusDieEvent?.event?.payload?.effectKey ?? null,
          settlementDiceCount: settlementDice.length,
          settlementDisplayOnly: state?.core?.pendingBonusDiceSettlement?.displayOnly ?? null,
          attackModifierBonusDamage: state?.core?.pendingAttack?.attackModifierBonusDamage ?? 0,
          totalBonusDamage: state?.core?.pendingAttack?.bonusDamage ?? 0,
          shame: state?.core?.players?.['1']?.tokens?.shame ?? 0,
          samuraiRetribution: state?.core?.players?.['0']?.tokens?.samurai_retribution ?? 0,
        };
      }, { timeout: 15000 }).toMatchObject({
        reject: null,
        effectKey: 'bonusDie.effect.samuraiRighteousnessKatana',
        settlementDiceCount: 1,
        settlementDisplayOnly: true,
        attackModifierBonusDamage: 0,
        totalBonusDamage: 0,
        shame: 0,
        samuraiRetribution: 0,
      });

      await settleCurrentBonusDice(page, () => readState(game), {});

      await expect.poll(async () => {
        const state = await readState(game);
        return {
          settlement: state?.core?.pendingBonusDiceSettlement ?? null,
          attackModifierBonusDamage: state?.core?.pendingAttack?.attackModifierBonusDamage ?? 0,
          totalBonusDamage: state?.core?.pendingAttack?.bonusDamage ?? 0,
          shame: state?.core?.players?.['1']?.tokens?.shame ?? 0,
          samuraiRetribution: state?.core?.players?.['0']?.tokens?.samurai_retribution ?? 0,
        };
      }, { timeout: 15000 }).toMatchObject({
        settlement: null,
        attackModifierBonusDamage: 2,
        totalBonusDamage: 2,
        shame: 0,
        samuraiRetribution: 0,
      });
    });

    await test.step('武士打出 card-zanshin', async () => {
      await openAndInjectSamuraiAttackModifierScene(page, game, {
        cardId: 'card-zanshin',
        defenderCharacter: 'paladin',
        sourceAbilityId: 'katana-slice-3',
        diceValues: [1, 4, 6, 6, 1],
      });
      await clickHandCard(page, 'card-zanshin');

      await expectRightTrayBonusDiceConfirmation(page, () => readState(game), {});
      await expect.poll(async () => {
        const state = await readState(game);
        const entries = state?.sys?.eventStream?.entries ?? [];
        const settlementDice = state?.core?.pendingBonusDiceSettlement?.dice ?? [];
        return {
          reject: await page.evaluate(() => (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null),
          handIds: getHandIds(state?.core?.players?.['0']),
          bonusDieEventCount: entries.filter((entry: any) => entry.event?.type === 'BONUS_DIE_ROLLED').length,
          settlementDiceCount: settlementDice.length,
          settlementFaces: settlementDice.map((die: any) => die.face ?? null),
          settlementDisplayOnly: state?.core?.pendingBonusDiceSettlement?.displayOnly ?? null,
          attackModifierBonusDamage: state?.core?.pendingAttack?.attackModifierBonusDamage ?? 0,
          totalBonusDamage: state?.core?.pendingAttack?.bonusDamage ?? 0,
          shame: state?.core?.players?.['1']?.tokens?.shame ?? 0,
          samuraiRetribution: state?.core?.players?.['0']?.tokens?.samurai_retribution ?? 0,
        };
      }, { timeout: 15000 }).toMatchObject({
        reject: null,
        bonusDieEventCount: 5,
        settlementDiceCount: 5,
        settlementFaces: ['katana', 'helm', 'rising_sun', 'rising_sun', 'katana'],
        settlementDisplayOnly: true,
        attackModifierBonusDamage: 0,
        totalBonusDamage: 0,
        shame: 0,
        samuraiRetribution: 0,
      });

      await settleCurrentBonusDice(page, () => readState(game), {});

      await expect.poll(async () => {
        const state = await readState(game);
        return {
          settlement: state?.core?.pendingBonusDiceSettlement ?? null,
          attackModifierBonusDamage: state?.core?.pendingAttack?.attackModifierBonusDamage ?? 0,
          totalBonusDamage: state?.core?.pendingAttack?.bonusDamage ?? 0,
          shame: state?.core?.players?.['1']?.tokens?.shame ?? 0,
          samuraiRetribution: state?.core?.players?.['0']?.tokens?.samurai_retribution ?? 0,
        };
      }, { timeout: 15000 }).toMatchObject({
        settlement: null,
        attackModifierBonusDamage: 2,
        totalBonusDamage: 2,
        shame: 1,
        // 真相源（tip.webp）标注反击（samurai_retribution）堆叠上限为 1；授予时应被 clamp
        samuraiRetribution: 1,
      });
    });

    await waitForHandAnimationSettled(page);
    await page.screenshot({ path: join(evidenceDir, 'samurai-attack-modifiers-end-to-end.png'), fullPage: true });
  });

  test('samurai Stand Tall II 应显示 4 骰防御并在无盾时不自加 Shame', async ({ page, game }) => {
    test.setTimeout(240000);
    const evidenceDir = ensureEvidenceDir();

    await openAndInjectSamuraiStandTall2DefenseScene(page, game);
    await page.screenshot({ path: join(evidenceDir, 'samurai-stand-tall-2-before-response.png'), fullPage: true });

    // 部分 defensiveRoll 场景会先显示“对方发动进攻 / 开始防御”提示层，此时应先点击进入防御掷骰。
    const startDefenseButton = page.getByRole('button', { name: /开始防御|Start Defense/i }).first();
    if (await startDefenseButton.isVisible({ timeout: 1500 }).catch(() => false)) {
      await startDefenseButton.click();
      await expect(startDefenseButton).toBeHidden({ timeout: 5000 }).catch(() => {});
      await page.screenshot({ path: join(evidenceDir, 'samurai-stand-tall-2-after-start-defense.png'), fullPage: true });
    }

    await expect.poll(async () => {
      const state = await readState(game);
      return {
        reject: await page.evaluate(() => (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null),
        phase: state?.sys?.phase ?? null,
        defenseAbilityId: state?.core?.pendingAttack?.defenseAbilityId ?? null,
        rollCount: state?.core?.rollCount ?? null,
        rollerId: state?.core?.pendingAttack?.defenderId ?? null,
      };
    }, { timeout: 10000 }).toMatchObject({
      reject: null,
      phase: 'defensiveRoll',
      defenseAbilityId: 'stand-tall',
      rollCount: 0,
      rollerId: '0',
    });

    // 状态保留第 5 颗 locked 骰用于语义回放；当前 UI 只渲染 4 颗可掷骰。
    await expect.poll(async () => {
      const state = await readState(game);
      const dice = state?.core?.dice ?? [];
      return {
        reject: await page.evaluate(() => (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null),
        phase: state?.sys?.phase ?? null,
        rollDiceCount: state?.core?.rollDiceCount ?? null,
        diceTotal: dice.length,
        keptCount: dice.filter((d: any) => d?.isKept).length,
      };
    }, { timeout: 10000 }).toMatchObject({
      reject: null,
      phase: 'defensiveRoll',
      rollDiceCount: 4,
      diceTotal: 5,
      keptCount: 1,
    });

    const defensiveDice = page.locator('[data-tutorial-id="dice-tray"] [data-testid="die"]');
    await expect(defensiveDice).toHaveCount(4, { timeout: 5000 });
    await expect(page.locator('[data-tutorial-id="dice-roll-button"]').first()).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: join(evidenceDir, 'samurai-stand-tall-2-defense-roll-4dice.png'), fullPage: true });

    await setHarnessDiceValues(page, [1, 1, 1, 1]);
    await page.locator('[data-tutorial-id="dice-roll-button"]').first().click();

    // 防御阶段：掷骰后必须“确认”，再推进阶段触发攻击结算
    const confirmButton = page.locator('[data-tutorial-id="dice-confirm-button"]').first();
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();

    await expect.poll(async () => {
      const state = await readState(game);
      return {
        reject: await page.evaluate(() => (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null),
        phase: state?.sys?.phase ?? null,
        rollConfirmed: state?.core?.rollConfirmed ?? null,
        rollCount: state?.core?.rollCount ?? null,
      };
    }, { timeout: 10000 }).toMatchObject({
      reject: null,
      phase: 'defensiveRoll',
      rollConfirmed: true,
      rollCount: 1,
    });

    const advanceButton = page.locator('[data-tutorial-id="advance-phase-button"]').first();
    await expect(advanceButton).toBeVisible({ timeout: 5000 });
    await expect(advanceButton).toBeEnabled({ timeout: 10000 });
    await advanceButton.click();
    for (let frame = 1; frame <= 6; frame += 1) {
      await page.waitForTimeout(120);
      await page.screenshot({
        path: join(evidenceDir, `samurai-stand-tall-2-damage-fx-frame-${frame}.png`),
        fullPage: true,
      });
    }

    await expect.poll(async () => {
      const state = await readState(game);
      return {
        reject: await page.evaluate(() => (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null),
        phase: state?.sys?.phase ?? null,
        pendingAttack: state?.core?.pendingAttack ?? null,
        attackerHp: getHp(state?.core?.players?.['1']),
        samuraiHp: getHp(state?.core?.players?.['0']),
        samuraiShame: state?.core?.players?.['0']?.tokens?.shame ?? 0,
      };
    }, { timeout: 15000 }).toMatchObject({
      reject: null,
      phase: 'main1',
      pendingAttack: null,
      attackerHp: 46,
      samuraiHp: 45,
      samuraiShame: 0,
    });

    await page.screenshot({ path: join(evidenceDir, 'samurai-stand-tall-2-settled-no-shame.png'), fullPage: true });
  });

});
