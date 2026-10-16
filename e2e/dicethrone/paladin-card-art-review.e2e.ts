/** 本次卡图错配的现场核验；逐卡语义以录入合同为准。 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '../framework';

const changes = [
  { id: 'card-righteous-combat-2', index: 10, cost: 2, title: '正义战法二级' },
  { id: 'card-righteous-combat-3', index: 8, cost: 4, title: '正义战法三级' },
  { id: 'card-surprise', index: 20, cost: 2, title: '惊不惊喜' },
  { id: 'card-worthy-of-me', index: 21, cost: 1, title: '不愧是我' },
  { id: 'card-unexpected', index: 22, cost: 3, title: '意不意外' },
];

test('圣骑士五张错配卡的正式手牌与放大入口', async ({ page, game }, testInfo) => {
  test.setTimeout(150000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await game.openTestGame('dicethrone');
  await game.setupScene({ gameId: 'dicethrone',
    player0: { hand: changes.map(card => card.id), discard: [], resources: { cp: 10, hp: 50 } },
    player1: { hand: [], discard: [], resources: { cp: 2, hp: 50 } },
    currentPlayer: '0', phase: 'main1',
    extra: { selectedCharacters: { '0': 'paladin', '1': 'monk' }, hostStarted: true,
      pendingAttack: null, pendingDamage: undefined },
  });
  await game.waitForPhase('main1', 15000);
  const hand = page.getByTestId('hand-area');
  await expect(hand.locator('[data-card-id]')).toHaveCount(5);
  await expect(hand.locator('.atlas-shimmer')).toHaveCount(0, { timeout: 20000 });
  await expect(hand.locator('[data-is-flipped="true"]')).toHaveCount(5);
  const before = await game.getState();
  expect(before.core.players['0'].hand.map((card: any) => ({ id: card.id, index: card.previewRef?.index, cost: card.cpCost })))
    .toEqual(changes.map(card => ({ id: card.id, index: card.index, cost: card.cost })));
  await page.mouse.move(10, 10);
  await page.waitForTimeout(650);
  await game.screenshot('圣骑士五张修正卡_出牌前手牌', testInfo);

  for (const card of changes) {
    const entry = hand.locator(`[data-card-id="${card.id}"]`).first();
    await entry.hover();
    await page.waitForTimeout(300);
    await entry.click();
    const overlay = page.getByTestId('board-magnify-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay.locator('.atlas-shimmer')).toHaveCount(0);
    await page.waitForTimeout(350);
    await game.screenshot(`圣骑士_${card.title}_正式放大卡面`, testInfo);
    await page.getByTestId('board-magnify-overlay-close').click();
    await expect(overlay).toBeHidden();
  }
  const card = hand.locator('[data-card-id="card-righteous-combat-2"]').first();
  await card.hover();
  await page.waitForTimeout(300);
  const box = await card.boundingBox();
  if (!box) throw new Error('正义战法II未显示');
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, startY - 220, { steps: 12 });
  await page.mouse.up();
  await page.mouse.move(10, 10);
  await expect.poll(async () => {
    const state = await game.getState();
    const player = state.core.players['0'];
    return { cp: player.resources.cp, level: player.abilityLevels['righteous-combat'],
      upgradeCardId: player.upgradeCardByAbilityId?.['righteous-combat']?.cardId };
  }, { timeout: 20000 }).toEqual({ cp: 8, level: 2, upgradeCardId: 'card-righteous-combat-2' });
  await expect(hand.locator('[data-card-id="card-righteous-combat-2"]')).toHaveCount(0);
  await page.waitForTimeout(900);
  await game.screenshot('圣骑士_正义战法二级_扣2CP并升级成功', testInfo);
  const dir = join(process.cwd(), 'evidence/圣骑士卡图错配/20261015T142510Z');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'browser-assertions.json'), JSON.stringify({ gameId: 'dicethrone', evidenceCategory: 'independent',
    scope: '五张完整卡面与真实手牌/放大入口；正义战法II真实拖动出牌结算',
    cards: changes, beforeCp: 10, afterCp: 8, beforeLevel: before.core.players['0'].abilityLevels['righteous-combat'],
    afterLevel: 2, actor: '0', scene: 'main1合法代表态，结果未预置' }, null, 2));
});
