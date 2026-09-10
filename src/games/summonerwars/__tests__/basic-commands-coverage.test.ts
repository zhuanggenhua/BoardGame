/**
 * 召唤师战争 - 未覆盖命令测试
 *
 * 覆盖以下低覆盖/兼容命令：
 * 1. SELECT_UNIT — 选择单位（设置 core.selectedUnit）
 * 2. SELECT_CUSTOM_DECK — 选择自定义牌组
 * 3. CONFIRM_ATTACK — 旧客户端攻击确认兼容 no-op
 */

import { describe, it, expect } from 'vitest';
import { SummonerWarsDomain, SW_COMMANDS, SW_EVENTS } from '../domain';
import type { SummonerWarsCore, PlayerId, FactionId } from '../domain/types';
import type { MatchState, RandomFn } from '../../../engine/types';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { FLOW_COMMANDS } from '../../../engine';
import { engineConfig, SUMMONER_WARS_CHEAT_COMMANDS } from '../game';
import { createInitializedCore } from './test-helpers';
import { BOARD_ROWS, BOARD_COLS, getSummoner } from '../domain/helpers';

// ============================================================================
// 测试工具
// ============================================================================

const fixedRandom: RandomFn = {
    random: () => 0,
    d: () => 1,
    range: (min) => min,
    shuffle: (arr) => [...arr],
};

/** 创建完整 MatchState（含 sys） */
function createMatchState(
    playerIds: string[],
    random: RandomFn,
    options?: { faction0?: FactionId; faction1?: FactionId }
): MatchState<SummonerWarsCore> {
    const core = createInitializedCore(playerIds, random, options);
    const sys = createInitialSystemState(playerIds as PlayerId[], []);
    return { core, sys };
}

/** 创建选角阶段的 MatchState（未完成阵营选择） */
function createSetupState(playerIds: string[], random: RandomFn): MatchState<SummonerWarsCore> {
    const core = SummonerWarsDomain.setup(playerIds, random);
    const sys = createInitialSystemState(playerIds as PlayerId[], []);
    return { core, sys };
}

const pipelineConfig = { domain: SummonerWarsDomain, systems: [] as never[] };

/** 执行命令 */
function execCmd(
    state: MatchState<SummonerWarsCore>,
    type: string,
    playerId: string,
    payload: Record<string, unknown>,
    random: RandomFn = fixedRandom,
) {
    return executePipeline(
        pipelineConfig,
        state,
        { type, playerId, payload, timestamp: Date.now() },
        random,
        ['0', '1']
    );
}


// ============================================================================
// 1. SELECT_UNIT — 选择单位
// ============================================================================

describe('SELECT_UNIT 选择单位', () => {
    it('选择己方单位成功，设置 selectedUnit', () => {
        const state = createMatchState(['0', '1'], fixedRandom);
        // 找到玩家0的一个单位位置
        let unitPos: { row: number; col: number } | null = null;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const unit = state.core.board[row]?.[col]?.unit;
                if (unit && unit.owner === '0') {
                    unitPos = { row, col };
                    break;
                }
            }
            if (unitPos) break;
        }
        expect(unitPos).toBeTruthy();

        const result = execCmd(state, SW_COMMANDS.SELECT_UNIT, '0', { position: unitPos });
        expect(result.success).toBe(true);
        if (result.success) {
            const newCore = (result.state as MatchState<SummonerWarsCore>).core;
            expect(newCore.selectedUnit).toEqual(unitPos);
        }
    });

    it('选择空位置也能成功（validate 无限制）', () => {
        const state = createMatchState(['0', '1'], fixedRandom);
        // 选择一个空位置
        const result = execCmd(state, SW_COMMANDS.SELECT_UNIT, '0', { position: { row: 3, col: 3 } });
        // SELECT_UNIT 的 validate 走 default 分支，始终返回 valid: true
        expect(result.success).toBe(true);
    });
});

// ============================================================================
// 2. SELECT_CUSTOM_DECK — 选择自定义牌组
// ============================================================================

describe('SELECT_CUSTOM_DECK 选择自定义牌组', () => {
    it('选角阶段选择自定义牌组成功', () => {
        const state = createSetupState(['0', '1'], fixedRandom);

        const deckData = {
            name: '测试牌组',
            summonerId: 'necro-summoner',
            summonerFaction: 'necromancer',
            cards: [
                { cardId: 'necro-undead-warrior', faction: 'necromancer', count: 3 },
                { cardId: 'necro-skeleton-archer', faction: 'necromancer', count: 3 },
            ],
        };

        const result = execCmd(state, SW_COMMANDS.SELECT_CUSTOM_DECK, '0', { deckData });
        expect(result.success).toBe(true);
        if (result.success) {
            const newCore = (result.state as MatchState<SummonerWarsCore>).core;
            // 应触发 FACTION_SELECTED 事件，设置阵营为 necromancer
            expect(newCore.selectedFactions['0']).toBe('necromancer');
            // 自定义牌组数据应被存储
            expect(newCore.customDeckData?.['0']).toBeTruthy();
        }
    });

    it('游戏已开始时选择自定义牌组失败', () => {
        const state = createMatchState(['0', '1'], fixedRandom);
        // 游戏已初始化（hostStarted=true）
        const deckData = {
            name: '测试牌组',
            summonerId: 'necro-summoner',
            summonerFaction: 'necromancer',
            cards: [],
        };

        const result = execCmd(state, SW_COMMANDS.SELECT_CUSTOM_DECK, '0', { deckData });
        expect(result.success).toBe(false);
    });

    it('缺少牌组数据时失败', () => {
        const state = createSetupState(['0', '1'], fixedRandom);
        const result = execCmd(state, SW_COMMANDS.SELECT_CUSTOM_DECK, '0', {});
        expect(result.success).toBe(false);
    });

    it('缺少召唤师 ID 时失败', () => {
        const state = createSetupState(['0', '1'], fixedRandom);
        const result = execCmd(state, SW_COMMANDS.SELECT_CUSTOM_DECK, '0', {
            deckData: { name: '测试', summonerFaction: 'necromancer', cards: [] },
        });
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// 3. CONFIRM_ATTACK — 旧客户端兼容 no-op
// ============================================================================

describe('CONFIRM_ATTACK 旧攻击确认兼容', () => {
    it('旧客户端发送 CONFIRM_ATTACK 时不报错且不改变核心状态', () => {
        const state = createMatchState(['0', '1'], fixedRandom);
        state.core.phase = 'attack';
        const beforeCore = structuredClone(state.core);

        const result = execCmd(state, SW_COMMANDS.CONFIRM_ATTACK, '0', {
            diceResults: ['melee', 'melee', 'special'],
        });

        expect(result.success).toBe(true);
        expect(result.events).toEqual([]);
        if (result.success) {
            const newState = result.state as MatchState<SummonerWarsCore>;
            expect(newState.core).toEqual(beforeCore);
        }
    });
});

describe('召唤师死亡后的终局命令锁', () => {
    it('敌方召唤师被攻击摧毁后立刻写入胜者，且不能继续推进阶段', () => {
        const state = createMatchState(['0', '1'], fixedRandom);
        state.core.phase = 'attack';
        state.sys.phase = 'attack';
        state.core.currentPlayer = '0';
        state.core.players['0'].attackCount = 0;
        state.core.players['0'].hasAttackedEnemy = false;

        for (let row = 0; row < BOARD_ROWS; row += 1) {
            for (let col = 0; col < BOARD_COLS; col += 1) {
                const unit = state.core.board[row]?.[col]?.unit;
                if (unit && unit.card.unitClass !== 'summoner') {
                    state.core.board[row][col].unit = undefined;
                }
            }
        }

        const ownSummoner = getSummoner(state.core, '0');
        const enemySummoner = getSummoner(state.core, '1');
        expect(ownSummoner).toBeDefined();
        expect(enemySummoner).toBeDefined();
        if (!ownSummoner || !enemySummoner) return;

        const target = enemySummoner.position;
        const attacker = target.row < BOARD_ROWS - 1
            ? { row: target.row + 1, col: target.col }
            : { row: target.row - 1, col: target.col };

        state.core.board[ownSummoner.position.row][ownSummoner.position.col].unit = undefined;
        state.core.board[attacker.row][attacker.col].unit = {
            ...ownSummoner,
            position: attacker,
            damage: 0,
            hasAttacked: false,
            card: {
                ...ownSummoner.card,
                strength: 1,
                attackType: 'melee',
                attackRange: 1,
                abilities: [],
            },
        };
        state.core.board[target.row][target.col].unit = {
            ...enemySummoner,
            damage: enemySummoner.card.life - 1,
            card: {
                ...enemySummoner.card,
                abilities: [],
            },
        };

        const killResult = execCmd(state, SW_COMMANDS.DECLARE_ATTACK, '0', { attacker, target });

        expect(killResult.success).toBe(true);
        expect(killResult.events.some(event => event.type === SW_EVENTS.UNIT_DESTROYED)).toBe(true);
        expect(killResult.state.sys.gameover).toEqual({ winner: '0' });
        expect(killResult.state.core.board[target.row][target.col].unit).toBeUndefined();

        const continueResult = execCmd(killResult.state, SW_COMMANDS.END_PHASE, '0', {});

        expect(continueResult.success).toBe(false);
        expect(continueResult.error).toBe('game_over');
        expect(continueResult.state.core.phase).toBe('attack');
        expect(continueResult.state.sys.gameover).toEqual({ winner: '0' });

        const flowContinueResult = executePipeline(
            engineConfig,
            killResult.state,
            { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '0', payload: {}, timestamp: Date.now() },
            fixedRandom,
            ['0', '1'],
        );

        expect(flowContinueResult.success).toBe(false);
        expect(flowContinueResult.error).toBe('game_over');
        expect(flowContinueResult.state.core.phase).toBe('attack');
        expect(flowContinueResult.state.sys.gameover).toEqual({ winner: '0' });
    });
});

describe('召唤师战争调试扣血', () => {
    it('扣减非致死血量时只增加召唤师伤害，不触发终局', () => {
        const state = createMatchState(['0', '1'], fixedRandom);
        const beforeSummoner = getSummoner(state.core, '1');
        expect(beforeSummoner).toBeDefined();
        if (!beforeSummoner) return;

        const result = executePipeline(
            engineConfig,
            state,
            {
                type: SUMMONER_WARS_CHEAT_COMMANDS.DAMAGE_SUMMONER,
                playerId: '0',
                payload: { playerId: '1', amount: 1 },
                timestamp: Date.now(),
            },
            fixedRandom,
            ['0', '1'],
        );

        expect(result.success).toBe(true);
        expect(result.events.some(event => event.type === SW_EVENTS.UNIT_DAMAGED)).toBe(true);
        expect(result.events.some(event => event.type === SW_EVENTS.UNIT_DESTROYED)).toBe(false);
        expect(result.state.sys.gameover).toBeUndefined();

        const afterSummoner = getSummoner(result.state.core, '1');
        expect(afterSummoner).toBeDefined();
        expect(afterSummoner?.damage).toBe(beforeSummoner.damage + 1);
    });

    it('扣到生命归零时走正常摧毁链路并写入游戏结束', () => {
        const state = createMatchState(['0', '1'], fixedRandom);
        const enemySummoner = getSummoner(state.core, '1');
        expect(enemySummoner).toBeDefined();
        if (!enemySummoner) return;

        const attackerMagicBefore = state.core.players['0'].magic;
        const result = executePipeline(
            engineConfig,
            state,
            {
                type: SUMMONER_WARS_CHEAT_COMMANDS.DAMAGE_SUMMONER,
                playerId: '0',
                payload: { playerId: '1', amount: enemySummoner.card.life - enemySummoner.damage },
                timestamp: Date.now(),
            },
            fixedRandom,
            ['0', '1'],
        );

        expect(result.success).toBe(true);
        expect(result.events.some(event => event.type === SW_EVENTS.UNIT_DAMAGED)).toBe(true);
        expect(result.events.some(event => event.type === SW_EVENTS.UNIT_DESTROYED)).toBe(true);
        expect(getSummoner(result.state.core, '1')).toBeUndefined();
        expect(result.state.core.players['0'].magic).toBe(attackerMagicBefore);
        expect(result.state.sys.gameover).toEqual({ winner: '0' });
    });
});

 
