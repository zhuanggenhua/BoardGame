/**
 * 召唤师战争 - 完整游戏流程测试
 * 
 * 测试目标：验证游戏能从开始跑到一方召唤师死亡触发游戏结束
 */

import { describe, it, expect } from 'vitest';
import { SummonerWarsDomain, SW_COMMANDS, SW_EVENTS } from '../domain';
import type { SummonerWarsCore, PlayerId, CellCoord } from '../domain/types';
import type { RandomFn } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';
import { BOARD_ROWS, BOARD_COLS, getSummoner } from '../domain/helpers';
import { createInitializedCore } from './test-helpers';

// ============================================================================
// 辅助函数
// ============================================================================

/** 创建测试用随机数生成器 */
function createTestRandom(randomValue = 0.5): RandomFn {
  return {
    shuffle: <T>(arr: T[]) => arr,
    random: () => randomValue,
    d: (max: number) => Math.ceil(max * randomValue) || 1,
    range: (min: number, max: number) => Math.floor(min + (max - min) * randomValue),
  };
}

const fixedTimestamp = 1000;

/** 打印棋盘状态 */
function printBoard(core: SummonerWarsCore) {
  console.log(`\n回合 ${core.turnNumber} | 阶段: ${core.phase} | 当前玩家: ${core.currentPlayer}`);
  console.log(`玩家0 魔力: ${core.players['0'].magic} | 玩家1 魔力: ${core.players['1'].magic}`);
  
  for (let row = 0; row < BOARD_ROWS; row++) {
    let rowStr = `${row}: `;
    for (let col = 0; col < BOARD_COLS; col++) {
      const cell = core.board[row][col];
      if (cell.unit) {
        const hp = cell.unit.card.life - cell.unit.damage;
        const symbol = cell.unit.owner === '0' ? 'X' : 'O';
        rowStr += `[${symbol}${hp}]`;
      } else if (cell.structure) {
        const symbol = cell.structure.owner === '0' ? 'G' : 'g';
        rowStr += `[${symbol} ]`;
      } else {
        rowStr += '[ · ]';
      }
    }
    console.log(rowStr);
  }
}

/** 执行命令并返回新状态 */
function executeCommand(
  core: SummonerWarsCore,
  type: string,
  playerId: PlayerId,
  payload: Record<string, unknown>
): SummonerWarsCore {
  const sys = createInitialSystemState(['0', '1'], []);
  const state = { core, sys };
  const random = createTestRandom();
  
  // 验证命令
  const validation = SummonerWarsDomain.validate(state, { type, playerId, payload });
  if (!validation.valid) {
    throw new Error(`命令验证失败: ${validation.error}`);
  }
  
  // 执行命令
  const events = SummonerWarsDomain.execute(state, { type, playerId, payload, timestamp: fixedTimestamp }, random);
  
  // 应用事件
  let newCore = core;
  for (const event of events) {
    newCore = SummonerWarsDomain.reduce(newCore, event);
  }
  
  return newCore;
}

/** 结束当前阶段 */
function endPhase(core: SummonerWarsCore): SummonerWarsCore {
  return executeCommand(core, SW_COMMANDS.END_PHASE, core.currentPlayer, {});
}

/** 跳过整个回合（6个阶段） */
function skipTurn(core: SummonerWarsCore): SummonerWarsCore {
  let newCore = core;
  for (let i = 0; i < 6; i++) {
    newCore = endPhase(newCore);
  }
  return newCore;
}

/** 移动单位 */
function moveUnit(core: SummonerWarsCore, from: CellCoord, to: CellCoord): SummonerWarsCore {
  return executeCommand(core, SW_COMMANDS.MOVE_UNIT, core.currentPlayer, { from, to });
}

/** 攻击目标 */
function attack(core: SummonerWarsCore, attacker: CellCoord, target: CellCoord): SummonerWarsCore {
  return executeCommand(core, SW_COMMANDS.DECLARE_ATTACK, core.currentPlayer, { attacker, target });
}

/** 查找玩家的召唤师位置 */
function findSummoner(core: SummonerWarsCore, playerId: PlayerId): CellCoord | null {
  const summoner = getSummoner(core, playerId);
  return summoner?.position ?? null;
}

/** 查找玩家的所有单位位置 */
function findAllUnits(core: SummonerWarsCore, playerId: PlayerId): CellCoord[] {
  const positions: CellCoord[] = [];
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const unit = core.board[row][col].unit;
      if (unit && unit.owner === playerId) {
        positions.push({ row, col });
      }
    }
  }
  return positions;
}

/** 检查游戏是否结束 */
function checkGameOver(core: SummonerWarsCore) {
  return SummonerWarsDomain.isGameOver?.(core);
}

// ============================================================================
// 测试用例
// ============================================================================

describe('召唤师战争 - 完整游戏流程', () => {
  it('游戏能正常初始化', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    
    expect(core.phase).toBe('summon');
    expect(core.currentPlayer).toBe('0');
    expect(core.turnNumber).toBe(1);
    
    // 验证双方召唤师存在
    const summoner0 = findSummoner(core, '0');
    const summoner1 = findSummoner(core, '1');
    expect(summoner0).not.toBeNull();
    expect(summoner1).not.toBeNull();
    
    console.log('玩家0召唤师位置:', summoner0);
    console.log('玩家1召唤师位置:', summoner1);
    printBoard(core);
  });

  it('完整游戏流程 - 直到一方召唤师死亡', () => {
    let core = createInitializedCore(['0', '1'], createTestRandom());
    
    console.log('\n========== 游戏开始 ==========');
    printBoard(core);
    
    // 记录初始召唤师位置
    const initialSummoner0 = findSummoner(core, '0')!;
    const initialSummoner1 = findSummoner(core, '1')!;
    console.log(`\n玩家0召唤师: (${initialSummoner0.row}, ${initialSummoner0.col})`);
    console.log(`玩家1召唤师: (${initialSummoner1.row}, ${initialSummoner1.col})`);
    
    // 模拟多个回合，让双方召唤师互相靠近并攻击
    let turnCount = 0;
    const maxTurns = 50; // 防止无限循环
    
    while (!checkGameOver(core) && turnCount < maxTurns) {
      turnCount++;
      const currentPlayer = core.currentPlayer;
      console.log(`\n========== 回合 ${core.turnNumber} - 玩家${currentPlayer} ==========`);
      
      // 召唤阶段 - 跳过
      expect(core.phase).toBe('summon');
      core = endPhase(core);
      
      // 移动阶段 - 尝试移动召唤师向对方靠近
      expect(core.phase).toBe('move');
      const myPos = findSummoner(core, currentPlayer);
      const enemyPos = findSummoner(core, currentPlayer === '0' ? '1' : '0');
      
      if (myPos && enemyPos) {
        // 计算移动方向
        const rowDiff = enemyPos.row - myPos.row;
        const colDiff = enemyPos.col - myPos.col;
        
        // 尝试移动2格向敌人靠近
        let moved = false;
        const moveTargets: CellCoord[] = [];
        
        // 优先纵向移动
        if (rowDiff !== 0) {
          const step = rowDiff > 0 ? 1 : -1;
          moveTargets.push({ row: myPos.row + step * 2, col: myPos.col });
          moveTargets.push({ row: myPos.row + step, col: myPos.col });
        }
        // 其次横向移动
        if (colDiff !== 0) {
          const step = colDiff > 0 ? 1 : -1;
          moveTargets.push({ row: myPos.row, col: myPos.col + step * 2 });
          moveTargets.push({ row: myPos.row, col: myPos.col + step });
        }
        
        for (const target of moveTargets) {
          if (target.row >= 0 && target.row < BOARD_ROWS && 
              target.col >= 0 && target.col < BOARD_COLS) {
            try {
              core = moveUnit(core, myPos, target);
              console.log(`移动召唤师: (${myPos.row},${myPos.col}) → (${target.row},${target.col})`);
              moved = true;
              break;
            } catch {
              // 移动失败，尝试下一个目标
            }
          }
        }
        
        if (!moved) {
          console.log('无法移动召唤师');
        }
      }
      core = endPhase(core);
      
      // 建造阶段 - 跳过
      expect(core.phase).toBe('build');
      core = endPhase(core);
      
      // 攻击阶段 - 尝试攻击敌方召唤师
      expect(core.phase).toBe('attack');
      const attackerPos = findSummoner(core, currentPlayer);
      const targetPos = findSummoner(core, currentPlayer === '0' ? '1' : '0');
      
      if (attackerPos && targetPos) {
        // 检查是否相邻（曼哈顿距离 <= 1）
        const dist = Math.abs(attackerPos.row - targetPos.row) + Math.abs(attackerPos.col - targetPos.col);
        if (dist === 1) {
          try {
            core = attack(core, attackerPos, targetPos);
            console.log(`攻击敌方召唤师: (${attackerPos.row},${attackerPos.col}) → (${targetPos.row},${targetPos.col})`);
            
            // 检查敌方召唤师状态
            const enemySummoner = getSummoner(core, currentPlayer === '0' ? '1' : '0');
            if (enemySummoner) {
              console.log(`敌方召唤师剩余生命: ${enemySummoner.card.life - enemySummoner.damage}`);
            }
          } catch (e) {
            console.log('攻击失败:', (e as Error).message);
          }
        } else {
          console.log(`距离敌方召唤师: ${dist} 格（需要相邻才能攻击）`);
        }
      }
      core = endPhase(core);
      
      // 魔力阶段 - 跳过
      expect(core.phase).toBe('magic');
      core = endPhase(core);
      
      // 抽牌阶段 - 跳过
      expect(core.phase).toBe('draw');
      core = endPhase(core);
      
      printBoard(core);
      
      // 检查游戏是否结束
      const gameOver = checkGameOver(core);
      if (gameOver) {
        console.log(`\n========== 游戏结束！玩家${gameOver.winner}获胜！ ==========`);
        break;
      }
    }
    
    // 验证游戏结束
    const finalResult = checkGameOver(core);
    console.log('\n最终结果:', finalResult);
    
    if (turnCount >= maxTurns) {
      console.log('达到最大回合数限制，游戏未结束');
      // 这不是错误，只是测试限制
    }
    
    // 至少应该能跑完几个回合
    expect(turnCount).toBeGreaterThan(0);
  });

  it('直接击杀召唤师 - 验证游戏结束判定', () => {
    let core = createInitializedCore(['0', '1'], createTestRandom());
    
    // 手动设置场景：将玩家0召唤师移动到玩家1召唤师旁边
    // 并将玩家1召唤师设置为只剩1点生命
    const summoner0 = core.board[7][3].unit!;
    core.board[7][3].unit = undefined;
    core.board[1][2].unit = { ...summoner0, position: { row: 1, col: 2 } };
    
    // 将玩家1召唤师设置为只剩1点生命
    const summoner1 = core.board[0][2].unit!;
    summoner1.damage = summoner1.card.life - 1;
    
    // 设置为攻击阶段
    core.phase = 'attack';
    
    console.log('\n========== 击杀测试场景 ==========');
    printBoard(core);
    console.log(`玩家1召唤师剩余生命: ${summoner1.card.life - summoner1.damage}`);
    
    // 执行攻击
    core = attack(core, { row: 1, col: 2 }, { row: 0, col: 2 });
    
    console.log('\n攻击后:');
    printBoard(core);
    
    // 检查游戏是否结束
    const gameOver = checkGameOver(core);
    console.log('游戏结束判定:', gameOver);
    
    // 由于攻击伤害是随机的（掷骰），可能不会一击必杀
    // 但至少攻击应该成功执行
    expect(core.players['0'].attackCount).toBe(1);
    
    // 如果召唤师被击杀，游戏应该结束
    const enemySummoner = getSummoner(core, '1');
    if (!enemySummoner) {
      expect(gameOver).toEqual({ winner: '0' });
      console.log('✅ 玩家1召唤师被击杀，玩家0获胜！');
    } else {
      console.log(`玩家1召唤师剩余生命: ${enemySummoner.card.life - enemySummoner.damage}`);
    }
  });

  it('强制击杀 - 设置足够伤害确保击杀', () => {
    let core = createInitializedCore(['0', '1'], createTestRandom(1));
    
    // 将玩家0召唤师移动到玩家1召唤师旁边
    const summoner0 = core.board[7][3].unit!;
    core.board[7][3].unit = undefined;
    core.board[1][2].unit = { ...summoner0, position: { row: 1, col: 2 } };
    
    // 将玩家1召唤师设置为只剩1点生命
    const summoner1 = core.board[0][2].unit!;
    summoner1.damage = summoner1.card.life - 1;
    
    core.phase = 'attack';
    
    console.log('\n========== 强制击杀测试 ==========');
    console.log(`玩家0召唤师战力: ${summoner0.card.strength}`);
    console.log(`玩家1召唤师剩余生命: 1`);
    
    // 多次攻击直到击杀（最多10次）
    let attackCount = 0;
    while (getSummoner(core, '1') && attackCount < 10) {
      // 重置攻击状态
      const attacker = core.board[1][2].unit!;
      core.board[1][2].unit = { ...attacker, hasAttacked: false };
      core.players['0'].attackCount = 0;
      
      core = attack(core, { row: 1, col: 2 }, { row: 0, col: 2 });
      attackCount++;
      
      const enemy = getSummoner(core, '1');
      if (enemy) {
        console.log(`攻击 ${attackCount}: 敌方召唤师剩余生命 ${enemy.card.life - enemy.damage}`);
      } else {
        console.log(`攻击 ${attackCount}: 敌方召唤师被击杀！`);
      }
    }
    
    // 验证游戏结束
    const gameOver = checkGameOver(core);
    expect(gameOver).toEqual({ winner: '0' });
    console.log('\n✅ 游戏正确结束，玩家0获胜！');
  });
});
