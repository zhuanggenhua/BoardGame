/**
 * 大杀四方 - 重抽 (Mulligan) 集成测试
 *
 * 覆盖：
 * - 含随从手牌不触发重抽
 * - 全行动卡手牌自动重抽
 * - 重抽后仍无随从只重抽一次（必须保留第二次）
 * - 重抽后手牌/牌库总数守恒
 * - ALL_FACTIONS_SELECTED 事件包含 mulliganPlayers
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { SmashUpDomain } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import { createFlowSystem, createBaseSystems } from '../../../engine';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent, AllFactionsSelectedEvent } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS, STARTING_HAND_SIZE } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { initAllAbilities } from '../abilities';
import { execute } from '../domain/reducer';
import type { RandomFn } from '../../../engine/types';

const PLAYER_IDS = ['0', '1'];

beforeAll(() => {
    initAllAbilities();
});

// ============================================================================
// 工具函数
// ============================================================================

function createRunner(random?: RandomFn) {
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems: [
            createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
            ...createBaseSystems<SmashUpCore>(),
        ],
        playerIds: PLAYER_IDS,
        silent: true,
        ...(random ? { random } : {}),
    });
}

/** 确保前 5 张抽到的是随从（不触发重抽） */
function createMinionsFirstRandom(): RandomFn {
    return {
        random: () => 0.5,
        d: (max: number) => Math.ceil(max / 2),
        range: (min: number, max: number) => Math.floor((min + max) / 2),
        shuffle: <T>(arr: T[]): T[] => {
            return [...arr].sort((a: any, b: any) => {
                if (typeof a?.type !== 'string' || typeof b?.type !== 'string') return 0;
                if (a.type === 'minion' && b.type !== 'minion') return -1;
                if (a.type !== 'minion' && b.type === 'minion') return 1;
                return 0;
            });
        },
    };
}

/** 确保前 5 张抽到的全是行动卡（触发重抽） */
function createActionsFirstRandom(): RandomFn {
    return {
        random: () => 0.5,
        d: (max: number) => Math.ceil(max / 2),
        range: (min: number, max: number) => Math.floor((min + max) / 2),
        shuffle: <T>(arr: T[]): T[] => {
            return [...arr].sort((a: any, b: any) => {
                if (typeof a?.type !== 'string' || typeof b?.type !== 'string') return 0;
                if (a.type === 'action' && b.type !== 'action') return -1;
                if (a.type !== 'action' && b.type === 'action') return 1;
                return 0;
            });
        },
    };
}

const FIRST_THREE_COMMANDS = [
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
] as const;

const FOURTH_COMMAND = {
    type: SU_COMMANDS.SELECT_FACTION,
    playerId: '1',
    payload: { factionId: SMASHUP_FACTION_IDS.NINJAS },
    timestamp: 4,
};

const FULL_DRAFT_COMMANDS = [...FIRST_THREE_COMMANDS, FOURTH_COMMAND] as const;

// ============================================================================
// 测试
// ============================================================================

describe('SmashUp 重抽 (Mulligan)', () => {
    describe('含随从手牌不触发重抽', () => {
        it('起始手牌含随从时 mulliganPlayers 为空', () => {
            const random = createMinionsFirstRandom();
            const runner = createRunner(random);
            const midResult = runner.run({ name: '前3步', commands: [...FIRST_THREE_COMMANDS] });

            const events = execute(midResult.finalState, FOURTH_COMMAND as any, random);
            const evt = events.find(e => e.type === SU_EVENTS.ALL_FACTIONS_SELECTED) as AllFactionsSelectedEvent;

            expect(evt).toBeDefined();
            // 随从优先排序 → 首抽含随从 → 不触发重抽
            expect(evt.payload.mulliganPlayers).toBeUndefined();
        });

        it('手牌中包含随从卡', () => {
            const runner = createRunner(createMinionsFirstRandom());
            const result = runner.run({ name: '随从手牌', commands: [...FULL_DRAFT_COMMANDS] });
            for (const pid of PLAYER_IDS) {
                const hand = result.finalState.core.players[pid].hand;
                expect(hand.some(c => c.type === 'minion')).toBe(true);
            }
        });
    });

    describe('全行动卡手牌自动重抽', () => {
        it('mulliganPlayers 包含所有无随从的玩家', () => {
            const random = createActionsFirstRandom();
            const runner = createRunner(random);
            const midResult = runner.run({ name: '前3步', commands: [...FIRST_THREE_COMMANDS] });

            const events = execute(midResult.finalState, FOURTH_COMMAND as any, random);
            const evt = events.find(e => e.type === SU_EVENTS.ALL_FACTIONS_SELECTED) as AllFactionsSelectedEvent;

            expect(evt).toBeDefined();
            expect(evt.payload.mulliganPlayers).toBeDefined();
            // 行动卡优先排序 → 所有玩家首抽无随从 → 全员重抽
            expect(evt.payload.mulliganPlayers!.length).toBeGreaterThan(0);
            for (const pid of PLAYER_IDS) {
                expect(evt.payload.mulliganPlayers).toContain(pid);
            }
        });

        it('重抽后手牌+牌库总数仍为 40', () => {
            const runner = createRunner(createActionsFirstRandom());
            const result = runner.run({ name: '重抽守恒', commands: [...FULL_DRAFT_COMMANDS] });
            for (const pid of PLAYER_IDS) {
                const player = result.finalState.core.players[pid];
                expect(player.hand.length + player.deck.length).toBe(40);
            }
        });

        it('重抽后仍为 5 张手牌', () => {
            const runner = createRunner(createActionsFirstRandom());
            const result = runner.run({ name: '重抽手牌数', commands: [...FULL_DRAFT_COMMANDS] });
            for (const pid of PLAYER_IDS) {
                expect(result.finalState.core.players[pid].hand.length).toBe(STARTING_HAND_SIZE);
            }
        });
    });

    describe('重抽只执行一次（必须保留第二次）', () => {
        it('行动卡优先随机下最多重抽一次', () => {
            // actionsFirstRandom 让每次洗牌都把行动卡放前面，
            // 重抽后手牌仍全是行动卡，但规则限制只重抽一次
            const random = createActionsFirstRandom();
            const runner = createRunner(random);
            const midResult = runner.run({ name: '前3步', commands: [...FIRST_THREE_COMMANDS] });

            const events = execute(midResult.finalState, FOURTH_COMMAND as any, random);
            const evt = events.find(e => e.type === SU_EVENTS.ALL_FACTIONS_SELECTED) as AllFactionsSelectedEvent;

            expect(evt).toBeDefined();
            // 虽然重抽后仍无随从，但只重抽了一次
            // 验证每位玩家只出现一次
            const mulliganCounts = new Map<string, number>();
            for (const pid of evt.payload.mulliganPlayers ?? []) {
                mulliganCounts.set(pid, (mulliganCounts.get(pid) ?? 0) + 1);
            }
            for (const [, count] of mulliganCounts) {
                expect(count).toBe(1);
            }
        });
    });
});
