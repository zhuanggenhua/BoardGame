/**
 * 召唤师战争 - 幻化能力修复验证测试
 * 
 * 验证幻化能力不会导致卡死，能正常选择目标并复制技能
 */

import { test, expect } from '../fixtures';
import { waitForTestHarness } from '../helpers/testHarness';

test.describe('召唤师战争 - 幻化能力修复', () => {
  test('幻化能力正常工作，不会卡死', async ({ summonerWarsMatch }) => {
    const { page, player1 } = summonerWarsMatch;

    // 等待测试工具就绪
    await waitForTestHarness(page);

    // 构造测试场景：心灵巫女（有幻化能力）+ 附近有士兵
    await page.evaluate(() => {
      const harness = window.__BG_TEST_HARNESS__!;
      
      // 清空棋盘
      const state = harness.state.get();
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 8; col++) {
          if (state.core.board[row][col].unit) {
            harness.state.patch({
              core: {
                board: {
                  [row]: {
                    [col]: { unit: null }
                  }
                }
              }
            });
          }
        }
      }

      // 放置心灵巫女（玩家0，有幻化能力）
      harness.state.patch({
        core: {
          phase: 'move',
          currentPlayer: '0',
          board: {
            3: {
              4: {
                unit: {
                  instanceId: 'witch-1',
                  owner: '0',
                  damage: 0,
                  boosts: 0,
                  card: {
                    id: 'trickster-mind-witch-1',
                    defId: 'trickster_mind_witch',
                    type: 'unit',
                    name: '心灵巫女',
                    faction: 'trickster',
                    strength: 1,
                    life: 3,
                    cost: 1,
                    attackType: 'ranged',
                    attackRange: 3,
                    unitClass: 'common',
                    abilities: ['illusion'],
                    deckSymbols: []
                  }
                }
              }
            },
            // 放置一个有技能的士兵（玩家1，3格内）
            3: {
              6: {
                unit: {
                  instanceId: 'soldier-1',
                  owner: '1',
                  damage: 0,
                  boosts: 0,
                  card: {
                    id: 'test-soldier-1',
                    defId: 'test_soldier',
                    type: 'unit',
                    name: '测试士兵',
                    faction: 'trickster',
                    strength: 2,
                    life: 2,
                    cost: 1,
                    attackType: 'melee',
                    attackRange: 1,
                    unitClass: 'common',
                    abilities: ['charge', 'ferocity'],
                    deckSymbols: []
                  }
                }
              }
            }
          }
        }
      });
    });

    // 等待 UI 更新
    await page.waitForTimeout(500);

    // 验证初始状态：心灵巫女在场
    const witchExists = await page.locator('[data-unit-id="witch-1"]').count();
    expect(witchExists).toBe(1);

    // 触发移动阶段（幻化是 onPhaseStart 触发）
    // 由于已经在 move 阶段，需要先推进到下一阶段再回到 move
    await page.evaluate(() => {
      const harness = window.__BG_TEST_HARNESS__!;
      harness.command.dispatch({
        type: 'sw:advance_phase',
        payload: {},
        playerId: '0'
      });
    });

    await page.waitForTimeout(300);

    // 推进到下一回合的 move 阶段
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => {
        const harness = window.__BG_TEST_HARNESS__!;
        harness.command.dispatch({
          type: 'sw:advance_phase',
          payload: {},
          playerId: harness.state.get().core.currentPlayer
        });
      });
      await page.waitForTimeout(200);
    }

    // 验证幻化提示出现
    const illusionPrompt = page.locator('text=/幻化|选择.*士兵/i');
    await expect(illusionPrompt).toBeVisible({ timeout: 3000 });

    // 点击目标士兵（3, 6）
    const targetCell = page.locator('[data-cell-coord="3-6"]');
    await targetCell.click();

    // 等待命令执行
    await page.waitForTimeout(500);

    // 验证：
    // 1. 幻化提示消失（abilityMode 被清理）
    await expect(illusionPrompt).not.toBeVisible({ timeout: 2000 });

    // 2. 心灵巫女获得了目标士兵的技能
    const witchAbilities = await page.evaluate(() => {
      const state = window.__BG_TEST_HARNESS__!.state.get();
      const witch = state.core.board[3][4].unit;
      return witch?.tempAbilities ?? [];
    });
    
    expect(witchAbilities).toContain('charge');
    expect(witchAbilities).toContain('ferocity');

    // 3. 页面没有卡死（能继续操作）
    const phaseButton = page.locator('button:has-text("下一阶段")');
    await expect(phaseButton).toBeEnabled({ timeout: 1000 });
  });

  test('幻化能力可以取消', async ({ summonerWarsMatch }) => {
    const { page } = summonerWarsMatch;

    await waitForTestHarness(page);

    // 构造相同场景
    await page.evaluate(() => {
      const harness = window.__BG_TEST_HARNESS__!;
      
      harness.state.patch({
        core: {
          phase: 'move',
          currentPlayer: '0',
          board: {
            3: {
              4: {
                unit: {
                  instanceId: 'witch-1',
                  owner: '0',
                  damage: 0,
                  boosts: 0,
                  card: {
                    id: 'trickster-mind-witch-1',
                    defId: 'trickster_mind_witch',
                    type: 'unit',
                    name: '心灵巫女',
                    faction: 'trickster',
                    strength: 1,
                    life: 3,
                    cost: 1,
                    attackType: 'ranged',
                    attackRange: 3,
                    unitClass: 'common',
                    abilities: ['illusion'],
                    deckSymbols: []
                  }
                }
              }
            }
          }
        }
      });
    });

    // 触发幻化
    await page.evaluate(() => {
      const harness = window.__BG_TEST_HARNESS__!;
      for (let i = 0; i < 7; i++) {
        harness.command.dispatch({
          type: 'sw:advance_phase',
          payload: {},
          playerId: harness.state.get().core.currentPlayer
        });
      }
    });

    await page.waitForTimeout(500);

    // 验证幻化提示出现
    const illusionPrompt = page.locator('text=/幻化|选择.*士兵/i');
    await expect(illusionPrompt).toBeVisible({ timeout: 3000 });

    // 点击取消按钮
    const cancelButton = page.locator('button:has-text("取消")');
    await cancelButton.click();

    // 验证提示消失
    await expect(illusionPrompt).not.toBeVisible({ timeout: 1000 });

    // 验证页面没有卡死
    const phaseButton = page.locator('button:has-text("下一阶段")');
    await expect(phaseButton).toBeEnabled({ timeout: 1000 });
  });
});
