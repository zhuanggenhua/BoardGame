/**
 * Bug 验证：usesPerTurn 缺失导致的重复触发问题
 * 
 * 审计发现多个 beforeAttack/afterAttack 触发器没有 usesPerTurn 限制。
 * 本测试验证这是否真的导致运行时 bug。
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner, type TestCase } from '../../../engine/testing/GameTestRunner';
import { SummonerWarsDomain } from '../domain';
import { SW_COMMANDS, SW_EVENTS } from '../domain/types';
import type { SummonerWarsCore, Command, GameEvent } from '../domain/types';

const runner = new GameTestRunner<SummonerWarsCore, Command, GameEvent>({
  domain: SummonerWarsDomain,
  playerIds: ['0', '1'],
  systems: [],
  random: {
    random: () => 0.3,
    d: () => 1,
    range: (min) => min,
    shuffle: (arr) => [...arr],
  },
});

describe('Bug 验证：usesPerTurn 缺失', () => {
  it('life_drain (beforeAttack) 在同一回合连续攻击时是否重复触发', () => {
    // 初始化：德拉戈斯（有 life_drain）+ 2个友方牺牲品 + 2个敌方目标
    const testCase: TestCase<SummonerWarsCore> = {
      name: 'life_drain 重复触发测试',
      setupFn: (core: SummonerWarsCore) => {
        // 德拉戈斯在 (4,3)
        core.board[4][3] = {
          unit: {
            card: {
              id: 'dragos',
              cardType: 'unit',
              name: '德拉戈斯',
              faction: 'necromancer',
              unitClass: 'champion',
              strength: 2,
              life: 8,
              cost: 6,
              attackType: 'melee',
              attackRange: 1,
              abilities: ['life_drain'],
              deckSymbols: [],
            },
            currentLife: 8,
            owner: '0',
            uid: 'dragos-1',
            boosts: 0,
            attachedCards: [],
            attachedUnits: [],
            entanglementTargets: [],
          },
          structure: undefined,
        };
        
        // 友方牺牲品1 在 (4,2)
        core.board[4][2] = {
          unit: {
            card: {
              id: 'victim1',
              cardType: 'unit',
              name: '牺牲品1',
              faction: 'necromancer',
              unitClass: 'common',
              strength: 1,
              life: 2,
              cost: 1,
              attackType: 'melee',
              attackRange: 1,
              abilities: [],
              deckSymbols: [],
            },
            currentLife: 2,
            owner: '0',
            uid: 'victim1-1',
            boosts: 0,
            attachedCards: [],
            attachedUnits: [],
            entanglementTargets: [],
          },
          structure: undefined,
        };
        
        // 友方牺牲品2 在 (5,3)
        core.board[5][3] = {
          unit: {
            card: {
              id: 'victim2',
              cardType: 'unit',
              name: '牺牲品2',
              faction: 'necromancer',
              unitClass: 'common',
              strength: 1,
              life: 2,
              cost: 1,
              attackType: 'melee',
              attackRange: 1,
              abilities: [],
              deckSymbols: [],
            },
            currentLife: 2,
            owner: '0',
            uid: 'victim2-1',
            boosts: 0,
            attachedCards: [],
            attachedUnits: [],
            entanglementTargets: [],
          },
          structure: undefined,
        };
        
        // 敌方目标1 在 (4,4)
        core.board[4][4] = {
          unit: {
            card: {
              id: 'enemy1',
              cardType: 'unit',
              name: '敌人1',
              faction: 'frost',
              unitClass: 'common',
              strength: 2,
              life: 5,
              cost: 1,
              attackType: 'melee',
              attackRange: 1,
              abilities: [],
              deckSymbols: [],
            },
            currentLife: 5,
            owner: '1',
            uid: 'enemy1-1',
            boosts: 0,
            attachedCards: [],
            attachedUnits: [],
            entanglementTargets: [],
          },
          structure: undefined,
        };
        
        // 敌方目标2 在 (3,3)
        core.board[3][3] = {
          unit: {
            card: {
              id: 'enemy2',
              cardType: 'unit',
              name: '敌人2',
              faction: 'frost',
              unitClass: 'common',
              strength: 2,
              life: 5,
              cost: 1,
              attackType: 'melee',
              attackRange: 1,
              abilities: [],
              deckSymbols: [],
            },
            currentLife: 5,
            owner: '1',
            uid: 'enemy2-1',
            boosts: 0,
            attachedCards: [],
            attachedUnits: [],
            entanglementTargets: [],
          },
          structure: undefined,
        };
        
        core.phase = 'attack';
        core.currentPlayer = '0';
        core.players['0'].attackCount = 0;
        
        return core;
      },
      commands: [
        // 第一次攻击：使用 life_drain 消灭 victim1，攻击 enemy1
        {
          type: SW_COMMANDS.DECLARE_ATTACK,
          playerId: '0',
          payload: {
            attacker: { row: 4, col: 3 },
            target: { row: 4, col: 4 },
            beforeAttack: {
              abilityId: 'life_drain',
              targetUnitId: 'victim1-1',
            },
          },
        },
        // 第二次攻击：再次使用 life_drain 消灭 victim2，攻击 enemy2
        {
          type: SW_COMMANDS.DECLARE_ATTACK,
          playerId: '0',
          payload: {
            attacker: { row: 4, col: 3 },
            target: { row: 3, col: 3 },
            beforeAttack: {
              abilityId: 'life_drain',
              targetUnitId: 'victim2-1',
            },
          },
        },
      ],
      assertions: [
        {
          after: 0,
          fn: (state) => {
            // 第一次攻击后：victim1 应该被消灭
            const victim1 = state.board[4][2].unit;
            expect(victim1).toBeUndefined();
            
            // enemy1 应该受到伤害
            const enemy1 = state.board[4][4].unit;
            expect(enemy1).toBeDefined();
            expect(enemy1!.currentLife).toBeLessThan(5);
          },
        },
        {
          after: 1,
          fn: (state) => {
            // 第二次攻击后：检查是否成功（如果成功则说明 usesPerTurn 缺失）
            const victim2 = state.board[5][3].unit;
            
            if (!victim2) {
              console.warn('⚠️ BUG 确认：life_drain 在同一回合内触发了两次！');
              console.warn('   victim2 被消灭，说明 life_drain 没有 usesPerTurn 限制');
              console.warn('   应该添加 usesPerTurn: 1');
            } else {
              console.log('✅ life_drain 正确限制了每回合使用次数');
            }
            
            // 不强制断言失败，因为我们在验证 bug 存在
          },
        },
      ],
    };
    
    runner.run(testCase);
  });
  
  it('evasion (onAdjacentEnemyAttack) 在同一回合被多次攻击时是否重复触发', () => {
    // 初始化：有 evasion 的单位被两个敌人相邻
    const testCase: TestCase<SummonerWarsCore> = {
      name: 'evasion 重复触发测试',
      setupFn: (core: SummonerWarsCore) => {
        // 有 evasion 的单位在 (4,3)
        core.board[4][3] = {
          unit: {
            card: {
              id: 'evasion-unit',
              cardType: 'unit',
              name: '迷魂单位',
              faction: 'trickster',
              unitClass: 'common',
              strength: 2,
              life: 5,
              cost: 2,
              attackType: 'melee',
              attackRange: 1,
              abilities: ['evasion'],
              deckSymbols: [],
            },
            currentLife: 5,
            owner: '0',
            uid: 'evasion-1',
            boosts: 0,
            attachedCards: [],
            attachedUnits: [],
            entanglementTargets: [],
          },
          structure: undefined,
        };
        
        // 敌方攻击者1 在 (4,2)
        core.board[4][2] = {
          unit: {
            card: {
              id: 'attacker1',
              cardType: 'unit',
              name: '攻击者1',
              faction: 'frost',
              unitClass: 'common',
              strength: 3,
              life: 5,
              cost: 1,
              attackType: 'melee',
              attackRange: 1,
              abilities: [],
              deckSymbols: [],
            },
            currentLife: 5,
            owner: '1',
            uid: 'attacker1-1',
            boosts: 0,
            attachedCards: [],
            attachedUnits: [],
            entanglementTargets: [],
          },
          structure: undefined,
        };
        
        // 敌方攻击者2 在 (4,4)
        core.board[4][4] = {
          unit: {
            card: {
              id: 'attacker2',
              cardType: 'unit',
              name: '攻击者2',
              faction: 'frost',
              unitClass: 'common',
              strength: 3,
              life: 5,
              cost: 1,
              attackType: 'melee',
              attackRange: 1,
              abilities: [],
              deckSymbols: [],
            },
            currentLife: 5,
            owner: '1',
            uid: 'attacker2-1',
            boosts: 0,
            attachedCards: [],
            attachedUnits: [],
            entanglementTargets: [],
          },
          structure: undefined,
        };
        
        core.phase = 'attack';
        core.currentPlayer = '1';
        core.players['1'].attackCount = 0;
        
        return core;
      },
      commands: [
        // 第一次攻击：attacker1 攻击 evasion-unit
        {
          type: SW_COMMANDS.DECLARE_ATTACK,
          playerId: '1',
          payload: {
            attacker: { row: 4, col: 2 },
            target: { row: 4, col: 3 },
          },
        },
        // 第二次攻击：attacker2 攻击 evasion-unit
        {
          type: SW_COMMANDS.DECLARE_ATTACK,
          playerId: '1',
          payload: {
            attacker: { row: 4, col: 4 },
            target: { row: 4, col: 3 },
          },
        },
      ],
      assertions: [
        {
          after: 0,
          fn: (state, events) => {
            // 检查第一次攻击是否触发了 evasion
            const destroyEvents = events.filter(
              e => e.type === SW_EVENTS.UNIT_DESTROYED && (e.payload as any).unitId === 'attacker1-1'
            );
            
            if (destroyEvents.length > 0) {
              console.log('✅ 第一次攻击触发了 evasion，attacker1 被消灭');
            }
          },
        },
        {
          after: 1,
          fn: (state, events) => {
            // 检查第二次攻击是否再次触发了 evasion
            const destroyEvents = events.filter(
              e => e.type === SW_EVENTS.UNIT_DESTROYED && (e.payload as any).unitId === 'attacker2-1'
            );
            
            if (destroyEvents.length > 0) {
              console.warn('⚠️ BUG 确认：evasion 在同一回合内触发了两次！');
              console.warn('   应该添加 usesPerTurn: 1 限制');
            } else {
              console.log('✅ evasion 正确限制了每回合使用次数');
            }
          },
        },
      ],
    };
    
    runner.run(testCase);
  });
});
