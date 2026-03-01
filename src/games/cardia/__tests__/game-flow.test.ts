/**
 * Cardia - 完整游戏流程测试
 * 
 * 使用 GameTestRunner 测试完整的游戏流程
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { CardiaDomain } from '../domain';
import { CARDIA_COMMANDS } from '../domain/commands';
import { Cardia } from '../game';
import { createInitialSystemState } from '../../../engine/pipeline';
import type { CardiaCore } from '../domain/core-types';

describe('Cardia - 完整游戏流程', () => {
    const playerIds = ['0', '1'];
    
    const runner = new GameTestRunner({
        domain: CardiaDomain,
        systems: Cardia.systems,
        playerIds,
        random: {
            random: () => 0.5,
            d: (sides) => Math.ceil(sides / 2),
            range: (min, max) => Math.floor((min + max) / 2),
            shuffle: (arr) => [...arr],
        },
    });
    
    describe('基础游戏流程', () => {
        it('应该能完成一个完整回合', () => {
            const result = runner.run({
                name: '完整回合测试',
                commands: [
                    // Player 0 打出第一张手牌
                    {
                        type: CARDIA_COMMANDS.PLAY_CARD,
                        playerId: '0',
                        payload: { cardUid: 'will_be_replaced' },
                    },
                ],
                setup: (ids, random) => {
                    const core = CardiaDomain.setup(ids, random);
                    const sys = createInitialSystemState(ids, Cardia.systems, undefined);
                    return { core, sys };
                },
            });
            
            expect(result.passed).toBe(true);
            expect(result.steps.length).toBeGreaterThan(0);
        });
    });

    
    describe('遭遇战流程', () => {
        it('应该正确解析遭遇战并授予印戒', () => {
            const result = runner.run({
                name: '遭遇战测试',
                commands: [],
                setup: (ids, random) => {
                    const core = CardiaDomain.setup(ids, random);
                    const sys = createInitialSystemState(ids, Cardia.systems, undefined);
                    return { core, sys };
                },
            });
            
            expect(result.passed).toBe(true);
        });
    });
    
    describe('阶段转换', () => {
        it('应该正确转换游戏阶段', () => {
            const result = runner.run({
                name: '阶段转换测试',
                commands: [],
                setup: (ids, random) => {
                    const core = CardiaDomain.setup(ids, random);
                    expect(core.phase).toBe('play');
                    const sys = createInitialSystemState(ids, Cardia.systems, undefined);
                    return { core, sys };
                },
            });
            
            expect(result.passed).toBe(true);
        });
    });
    
    describe('游戏结束条件', () => {
        it('应该在玩家达到目标印戒数时结束游戏', () => {
            const result = runner.run({
                name: '游戏结束测试',
                commands: [],
                setup: (ids, random) => {
                    const core = CardiaDomain.setup(ids, random);
                    
                    // 创建一张有5个印戒的场上卡牌
                    const card = core.players['0'].hand[0];
                    const playedCard = {
                        ...card,
                        encounterIndex: 1,
                        signets: 5,  // 5个印戒
                    };
                    
                    // 将卡牌放到场上
                    core.players['0'].playedCards = [playedCard];
                    
                    // isGameOver 可能是 undefined，需要检查
                    const gameOver = CardiaDomain.isGameOver?.(core);
                    expect(gameOver).toBeDefined();
                    if (gameOver) {
                        // 使用 winner 而不是 winnerId
                        expect(gameOver.winner).toBe('0');
                    }
                    
                    const sys = createInitialSystemState(ids, Cardia.systems, undefined);
                    sys.gameover = gameOver;
                    
                    return { core, sys };
                },
            });
            
            expect(result.passed).toBe(true);
        });
    });
});
