import { test, expect } from '../framework';
import type { EventCard, SummonerWarsCore } from '../../src/games/summonerwars/domain/types';
import { createInitializedCore, resetInstanceCounter } from '../../src/games/summonerwars/__tests__/test-helpers';

const deterministicRandom = {
  shuffle: <T>(arr: T[]) => [...arr],
  random: () => 0.5,
  d: () => 1,
  range: (min: number) => min,
};

const buildMagicEventChoiceCore = (): { core: SummonerWarsCore; cardId: string } => {
  resetInstanceCounter();
  const core = createInitializedCore(['0', '1'], deterministicRandom, {
    faction0: 'goblin',
    faction1: 'necromancer',
  });

  const cardId = 'test-goblin-frenzy';
  core.currentPlayer = '0';
  core.phase = 'magic';
  core.players['0'].magic = 1;
  core.players['0'].hand = [
    {
      id: cardId,
      cardType: 'event',
      name: '魔力阶段事件',
      eventType: 'common',
      faction: 'goblin',
      cost: 1,
      playPhase: 'magic',
      effect: '测试魔力阶段事件打出/弃置分流',
      deckSymbols: [],
    },
  ];

  return { core, cardId };
};

const buildAttackPhaseEventDiscardCore = (): { core: SummonerWarsCore; cardId: string } => {
  resetInstanceCounter();
  const core = createInitializedCore(['0', '1'], deterministicRandom, {
    faction0: 'goblin',
    faction1: 'necromancer',
  });

  const cardId = 'test-attack-phase-event';
  core.currentPlayer = '0';
  core.phase = 'magic';
  core.players['0'].magic = 0;
  core.players['0'].hand = [
    {
      id: cardId,
      cardType: 'event',
      name: '攻击阶段事件',
      eventType: 'common',
      faction: 'goblin',
      cost: 3,
      playPhase: 'attack',
      effect: '测试攻击阶段事件在魔力阶段弃置',
      deckSymbols: [],
    },
  ];

  return { core, cardId };
};

test.describe('召唤师战争 - 魔力阶段事件卡选择', () => {
  test('魔力阶段点击事件卡应弹出选择横幅', async ({ page, game }, testInfo) => {
    await game.openTestGame('summonerwars');

    const { core, cardId } = buildMagicEventChoiceCore();
    await game.setupScene({
      gameId: 'summonerwars',
      currentPlayer: core.currentPlayer,
      phase: core.phase,
      extra: { core },
    });

    await expect(page.getByTestId('sw-hand-area')).toBeVisible({ timeout: 10000 });

    const card = page.locator(`[data-card-id="${cardId}"]`);
    await expect(card).toBeVisible({ timeout: 5000 });
    await card.click();

    await expect(page.getByRole('button', { name: /Play|打出/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /Discard|弃牌/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /Cancel|取消/i })).toBeVisible({ timeout: 5000 });
    await game.screenshot('magic-event-choice-banner-visible', testInfo);
  });

  test('魔力阶段选择打出事件卡应正确结算', async ({ page, game }, testInfo) => {
    await game.openTestGame('summonerwars');

    const { core, cardId } = buildMagicEventChoiceCore();
    await game.setupScene({
      gameId: 'summonerwars',
      currentPlayer: core.currentPlayer,
      phase: core.phase,
      extra: { core },
    });

    await expect(page.getByTestId('sw-hand-area')).toBeVisible({ timeout: 10000 });
    const card = page.locator(`[data-card-id="${cardId}"]`);
    await expect(card).toBeVisible({ timeout: 5000 });
    await card.click();

    const playButton = page.getByRole('button', { name: /Play|打出/i });
    await expect(playButton).toBeVisible({ timeout: 5000 });
    await playButton.click();

    await expect.poll(async () => {
      const state = await game.getState();
      return state?.core?.players?.['0']?.magic ?? null;
    }, { timeout: 5000 }).toBe(0);

    await expect.poll(async () => {
      const state = await game.getState();
      const hand = state?.core?.players?.['0']?.hand ?? [];
      return hand.some((entry: { id?: string }) => entry.id === cardId);
    }, { timeout: 5000 }).toBe(false);

    await expect.poll(async () => {
      const state = await game.getState();
      const discard = state?.core?.players?.['0']?.discard ?? [];
      return discard.some((entry: { id?: string }) => entry.id === cardId);
    }, { timeout: 5000 }).toBe(true);

    await game.screenshot('magic-event-choice-play-resolved', testInfo);
  });

  test('魔力阶段选择弃牌事件卡应获得魔力并弃置', async ({ page, game }, testInfo) => {
    await game.openTestGame('summonerwars');

    const { core, cardId } = buildMagicEventChoiceCore();
    await game.setupScene({
      gameId: 'summonerwars',
      currentPlayer: core.currentPlayer,
      phase: core.phase,
      extra: { core },
    });

    await expect(page.getByTestId('sw-hand-area')).toBeVisible({ timeout: 10000 });
    const card = page.locator(`[data-card-id="${cardId}"]`);
    await expect(card).toBeVisible({ timeout: 5000 });
    await card.click();

    const discardButton = page.getByRole('button', { name: /Discard|弃牌/i });
    await expect(discardButton).toBeVisible({ timeout: 5000 });
    await discardButton.click();

    await expect.poll(async () => {
      const state = await game.getState();
      return state?.core?.players?.['0']?.magic ?? null;
    }, { timeout: 5000 }).toBe(2);

    await expect.poll(async () => {
      const state = await game.getState();
      const hand = state?.core?.players?.['0']?.hand ?? [];
      return hand.some((entry: { id?: string }) => entry.id === cardId);
    }, { timeout: 5000 }).toBe(false);

    await expect.poll(async () => {
      const state = await game.getState();
      const discard = state?.core?.players?.['0']?.discard ?? [];
      return discard.some((entry: { id?: string }) => entry.id === cardId);
    }, { timeout: 5000 }).toBe(true);

    await game.screenshot('magic-event-choice-discard-resolved', testInfo);
  });

  test('魔力阶段点击攻击阶段事件卡应进入弃牌流程而不是报阶段错误', async ({ page, game }, testInfo) => {
    await game.openTestGame('summonerwars');

    const { core, cardId } = buildAttackPhaseEventDiscardCore();
    await game.setupScene({
      gameId: 'summonerwars',
      currentPlayer: core.currentPlayer,
      phase: core.phase,
      extra: { core },
    });

    await expect(page.getByTestId('sw-hand-area')).toBeVisible({ timeout: 10000 });
    const card = page.locator(`[data-card-id="${cardId}"]`);
    await expect(card).toBeVisible({ timeout: 5000 });
    await card.click();

    const confirmDiscardButton = page.getByTestId('sw-confirm-discard');
    await expect(confirmDiscardButton).toBeVisible({ timeout: 5000 });
    await game.screenshot('magic-attack-only-event-discard-ready', testInfo);
    await confirmDiscardButton.click();

    await expect.poll(async () => {
      const state = await game.getState();
      return state?.core?.players?.['0']?.magic ?? null;
    }, { timeout: 5000 }).toBe(1);

    await expect.poll(async () => {
      const state = await game.getState();
      const hand = state?.core?.players?.['0']?.hand ?? [];
      return hand.some((entry: { id?: string }) => entry.id === cardId);
    }, { timeout: 5000 }).toBe(false);
    await game.screenshot('magic-attack-only-event-discard-resolved', testInfo);
  });
});
