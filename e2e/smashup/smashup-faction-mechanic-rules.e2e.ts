import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '../framework';
import { setChineseLocale } from '../helpers/common';

function createFactionSelectionPlayerState(
  playerId: string,
  factions: [string, string],
) {
  return {
    id: playerId,
    vp: 0,
    hand: [],
    deck: [],
    discard: [],
    factions,
    minionsPlayed: 1,
    minionLimit: 1,
    actionsPlayed: 1,
    actionLimit: 1,
  };
}

function buildFactionMechanicRuleScene() {
  return {
    gameId: 'smashup',
    currentPlayer: '0' as const,
    phase: 'factionSelect' as const,
    extra: {
      core: {
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        turnNumber: 1,
        nextUid: 1000,
        players: {
          '0': createFactionSelectionPlayerState('0', ['aliens', 'pirates']),
          '1': createFactionSelectionPlayerState('1', ['robots', 'ninjas']),
        },
        factionSelection: {
          takenFactions: [],
          playerSelections: {
            '0': [],
            '1': [],
          },
          completedPlayers: [],
        },
      },
    },
  };
}

async function waitForFactionSelectionReady(page: import('@playwright/test').Page) {
  await expect(page.locator('h1').filter({ hasText: /Draft Your Factions|选择你的派系/i })).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('faction-filter-toolbar')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('faction-search-input')).toBeVisible({ timeout: 10000 });
}

test.describe('SmashUp 派系机制规则展示', () => {
  test('角色选择详情应为特有机制派系展示规则说明并输出截图', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);

    const evidenceDir = join(process.cwd(), 'test-results', 'evidence-screenshots', 'smashup-faction-mechanic-rules');
    mkdirSync(evidenceDir, { recursive: true });

    await setChineseLocale(page.context());
    await page.setViewportSize({ width: 1440, height: 900 });
    await game.openTestGame('smashup', { skipInitialization: true }, 20000);
    await game.setupScene(buildFactionMechanicRuleScene());
    await waitForFactionSelectionReady(page);

    const searchInput = page.getByTestId('faction-search-input');

    await searchInput.fill('cowboys');
    await expect(page.getByTestId('faction-option-cowboys')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('faction-option-cowboys').click();

    const mechanicRules = page.getByTestId('faction-mechanic-rules');
    await expect(mechanicRules).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('faction-mechanic-rule')).toContainText('决斗');
    await expect(page.getByTestId('faction-mechanic-rule')).not.toContainText('埋葬');

    await page.screenshot({ path: join(evidenceDir, 'cowboys-mechanic-rules.png'), fullPage: false });
    await page.screenshot({ path: testInfo.outputPath('cowboys-mechanic-rules.png'), fullPage: false });

    await page.getByTestId('faction-detail-close').click();
    await searchInput.fill('cthulhu');
    await expect(page.getByTestId('faction-option-minions_of_cthulhu')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('faction-option-minions_of_cthulhu').click();

    await expect(page.getByTestId('faction-mechanic-rules')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('faction-mechanic-rule')).toContainText('疯狂牌');

    await page.screenshot({ path: join(evidenceDir, 'cthulhu-mechanic-rules.png'), fullPage: false });
    await page.screenshot({ path: testInfo.outputPath('cthulhu-mechanic-rules.png'), fullPage: false });

    await page.getByTestId('faction-detail-close').click();
    await searchInput.fill('aliens');
    await expect(page.getByTestId('faction-option-aliens')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('faction-option-aliens').click();
    await expect(page.getByTestId('faction-mechanic-rules')).toHaveCount(0);
  });
});
