/**
 * 大杀四方 - 起手重抽集成测试
 *
 * 覆盖：
 * - 起手含随从时不触发重抽
 * - 起手全是行动牌时记录可重抽玩家
 * - 重抽交互入队后流程仍会离开 factionSelect
 * - 重抽后手牌与牌库总数守恒
 * - 最多只允许重抽一次
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { createBaseSystems, createFlowSystem } from '../../../engine';
import type { RandomFn } from '../../../engine/types';
import { GameTestRunner } from '../../../engine/testing';
import { initAllAbilities } from '../abilities';
import { SmashUpDomain } from '../domain';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { smashUpFlowHooks } from '../domain/index';
import { STARTING_HAND_MULLIGAN_SOURCE_ID } from '../domain/mulliganHandlers';
import { execute } from '../domain/reducer';
import type { AllFactionsSelectedEvent, SmashUpCommand, SmashUpCore, SmashUpEvent } from '../domain/types';
import { STARTING_HAND_SIZE, SU_COMMANDS, SU_EVENTS } from '../domain/types';

const PLAYER_IDS = ['0', '1'];

beforeAll(() => {
    initAllAbilities();
});

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
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
] as const;

const FOURTH_COMMAND = {
    type: SU_COMMANDS.SELECT_FACTION,
    playerId: '0',
    payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS },
    timestamp: 4,
};

const FULL_DRAFT_COMMANDS = [...FIRST_THREE_COMMANDS, FOURTH_COMMAND] as const;

describe('SmashUp 起手重抽', () => {
    describe('起手含随从时不触发重抽', () => {
        it('ALL_FACTIONS_SELECTED 不会记录 mulliganPlayers', () => {
            const random = createMinionsFirstRandom();
            const runner = createRunner(random);
            const midResult = runner.run({ name: '前三步选阵营', commands: [...FIRST_THREE_COMMANDS] });

            const events = execute(midResult.finalState, FOURTH_COMMAND as any, random);
            const evt = events.find(e => e.type === SU_EVENTS.ALL_FACTIONS_SELECTED) as AllFactionsSelectedEvent;

            expect(evt).toBeDefined();
            expect(evt.payload.mulliganPlayers).toBeUndefined();
        });

        it('最终起手牌中包含随从', () => {
            const runner = createRunner(createMinionsFirstRandom());
            const result = runner.run({ name: '随从优先起手', commands: [...FULL_DRAFT_COMMANDS] });

            for (const pid of PLAYER_IDS) {
                const hand = result.finalState.core.players[pid].hand;
                expect(hand.some(card => card.type === 'minion')).toBe(true);
            }
        });
    });

    describe('起手全是行动牌时触发重抽', () => {
        it('ALL_FACTIONS_SELECTED 会记录所有无随从玩家', () => {
            const random = createActionsFirstRandom();
            const runner = createRunner(random);
            const midResult = runner.run({ name: '前三步选阵营', commands: [...FIRST_THREE_COMMANDS] });

            const events = execute(midResult.finalState, FOURTH_COMMAND as any, random);
            const evt = events.find(e => e.type === SU_EVENTS.ALL_FACTIONS_SELECTED) as AllFactionsSelectedEvent;

            expect(evt).toBeDefined();
            expect(evt.payload.mulliganPlayers).toBeDefined();
            expect(evt.payload.mulliganPlayers!.length).toBeGreaterThan(0);
            for (const pid of PLAYER_IDS) {
                expect(evt.payload.mulliganPlayers).toContain(pid);
            }
        });

        it('重抽交互入队后仍会离开 factionSelect', () => {
            const runner = createRunner(createActionsFirstRandom());
            const result = runner.run({ name: '重抽后推进阶段', commands: [...FULL_DRAFT_COMMANDS] });

            expect(result.finalState.core.factionSelection).toBeUndefined();
            expect(result.finalState.sys.phase).toBe('startTurn');
            expect(result.finalState.sys.interaction.current?.data?.sourceId).toBe(STARTING_HAND_MULLIGAN_SOURCE_ID);
        });

        it('重抽后手牌与牌库总数仍为 40', () => {
            const runner = createRunner(createActionsFirstRandom());
            const result = runner.run({ name: '重抽总数守恒', commands: [...FULL_DRAFT_COMMANDS] });

            for (const pid of PLAYER_IDS) {
                const player = result.finalState.core.players[pid];
                expect(player.hand.length + player.deck.length).toBe(40);
            }
        });

        it('重抽后仍然保持 5 张手牌', () => {
            const runner = createRunner(createActionsFirstRandom());
            const result = runner.run({ name: '重抽后手牌数量', commands: [...FULL_DRAFT_COMMANDS] });

            for (const pid of PLAYER_IDS) {
                expect(result.finalState.core.players[pid].hand.length).toBe(STARTING_HAND_SIZE);
            }
        });
    });

    describe('重抽最多只执行一次', () => {
        it('即使再次洗到全行动牌，也只记录一次重抽资格', () => {
            const random = createActionsFirstRandom();
            const runner = createRunner(random);
            const midResult = runner.run({ name: '前三步选阵营', commands: [...FIRST_THREE_COMMANDS] });

            const events = execute(midResult.finalState, FOURTH_COMMAND as any, random);
            const evt = events.find(e => e.type === SU_EVENTS.ALL_FACTIONS_SELECTED) as AllFactionsSelectedEvent;

            expect(evt).toBeDefined();
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
