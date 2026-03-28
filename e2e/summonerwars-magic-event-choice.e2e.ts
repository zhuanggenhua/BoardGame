import { test, expect } from './framework';
import type { EventCard, SummonerWarsCore } from '../src/games/summonerwars/domain/types';
import { createDeckByFactionId } from '../src/games/summonerwars/config/factions';
import { createInitializedCore, resetInstanceCounter } from '../src/games/summonerwars/__tests__/test-helpers';

const deterministicRandom = {
  shuffle: <T>(arr: T[]) => [...arr],
  random: () => 0.5,
  d: () => 1,
  range: (min: number) => min,
};

const findGoblinFrenzy = (): EventCard => {
  const card = createDeckByFactionId('goblin').deck.find(
    (entry): entry is EventCard => entry.cardType === 'event' && entry.id === 'goblin-frenzy',
  );
  if (!card) {
    throw new Error('未找到群情激愤事件卡');
  }
  return card;
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
      ...findGoblinFrenzy(),
      id: cardId,
    },
  ];

  return { core, cardId };
};

test.describe('召唤师战争 - 魔力阶段事件卡选择', () => {
  test('魔力阶段点击事件卡应弹出选择横幅', async ({ page, game }) => {
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
  });
});
