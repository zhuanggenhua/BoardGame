import { test, expect } from '../framework';

const TEST_CUSTOM_DECK = {
  id: 'test-deck-1',
  name: '测试牌组 - 极地矮人',
  summonerId: 'frost-summoner',
  summonerFaction: 'frost',
  freeMode: false,
  createdAt: '2026-03-19T00:00:00.000Z',
  updatedAt: '2026-03-19T00:00:00.000Z',
};

const waitForFactionSelection = async (page: import('@playwright/test').Page) => {
  await expect(
    page.locator('h1').filter({ hasText: /选择你的阵营|Choose your faction/i }),
  ).toBeVisible({ timeout: 10000 });
};

test.describe('召唤师战争 - 自定义牌组选择', () => {
  test('选择自定义牌组会写入 faction 与 customDeckData', async ({ page, game }, testInfo) => {
    await page.addInitScript((deck) => {
      (window as Window & { __TEST_CUSTOM_DECKS__?: unknown[] }).__TEST_CUSTOM_DECKS__ = [deck];
    }, TEST_CUSTOM_DECK);

    await game.openTestGame('summonerwars');
    await waitForFactionSelection(page);

    const customDeckCard = page.locator(`[data-testid="custom-deck-card-${TEST_CUSTOM_DECK.id}"]`);
    await expect(customDeckCard).toBeVisible({ timeout: 10000 });
    await customDeckCard.click();

    await expect.poll(async () => {
      const state = await game.getState();
      return JSON.stringify({
        faction: state?.core?.selectedFactions?.['0'] ?? null,
        deckId: state?.core?.customDeckData?.['0']?.id ?? null,
      });
    }, { timeout: 5000 }).toBe(JSON.stringify({
      faction: TEST_CUSTOM_DECK.summonerFaction,
      deckId: TEST_CUSTOM_DECK.id,
    }));

    await expect(customDeckCard).toHaveClass(/border-amber-400/);
    await expect(page.getByText(/自定义牌组|Custom Deck/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/^DIY$/).first()).toBeVisible({ timeout: 5000 });

    await game.screenshot('custom-deck-selected', testInfo);
  });
});
