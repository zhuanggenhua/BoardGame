/**
 * 召唤师战争 - ActionLog 格式化测试
 * 
 * 验证 i18n segment 结构（延迟翻译），不再 mock i18n.t
 */

import { describe, expect, it } from 'vitest';
import type { ActionLogEntry, ActionLogSegment, Command, GameEvent, MatchState } from '../../../engine/types';
import { SW_COMMANDS, SW_EVENTS } from '../domain/types';
import type { SummonerWarsCore } from '../domain/types';
import { formatSummonerWarsActionEntry } from '../actionLog';

const normalizeEntries = (result: ActionLogEntry | ActionLogEntry[] | null): ActionLogEntry[] => {
    if (!result) return [];
    return Array.isArray(result) ? result : [result];
};

const createCore = (): SummonerWarsCore => ({
    board: [],
    players: {} as SummonerWarsCore['players'],
    phase: 'summon',
    currentPlayer: '0',
    turnNumber: 1,
    selectedFactions: { '0': 'necromancer', '1': 'trickster' },
    readyPlayers: { '0': true, '1': true },
    hostPlayerId: '0',
    hostStarted: true,
    abilityUsageCount: {},
});

/** 查找 i18n segment */
const findI18nSegment = (segments: ActionLogSegment[], key: string) =>
    segments.find((s) => s.type === 'i18n' && s.key === key) as
    Extract<ActionLogSegment, { type: 'i18n' }> | undefined;

describe('formatSummonerWarsActionEntry — i18n segments', () => {
    it('ACTIVATE_ABILITY 带来源与目标卡牌', () => {
        const command: Command = {
            type: SW_COMMANDS.ACTIVATE_ABILITY,
            playerId: '0',
            payload: {
                abilityId: 'revive_undead',
                sourceUnitId: 'necro-elut-bar-0',
                targetCardId: 'necro-funeral-pyre-0-1',
            },
        };

        const entry = normalizeEntries(formatSummonerWarsActionEntry({
            command,
            state: { core: createCore() } as MatchState<SummonerWarsCore>,
            events: [] as GameEvent[],
        }));

        // 验证 i18n segment
        const activateSeg = findI18nSegment(entry[0].segments, 'actionLog.activateAbility');
        expect(activateSeg).toBeTruthy();
        expect(activateSeg!.ns).toBe('game-summonerwars');

        // 验证卡牌 segments
        const cardSegments = entry[0].segments.filter((s) => s.type === 'card');
        expect(cardSegments).toHaveLength(2);
        expect(cardSegments[0]).toMatchObject({ cardId: 'necro-elut-bar-0', previewText: '伊路特-巴尔' });
        expect(cardSegments[1]).toMatchObject({ cardId: 'necro-funeral-pyre-0-1', previewText: '殉葬火堆' });
    });

    it('MOVE_UNIT 使用 UNIT_MOVED 事件解析移动单位', () => {
        const command: Command = {
            type: SW_COMMANDS.MOVE_UNIT,
            playerId: '0',
            payload: { from: { row: 1, col: 1 }, to: { row: 2, col: 1 } },
        };

        const entry = normalizeEntries(formatSummonerWarsActionEntry({
            command,
            state: { core: createCore() } as MatchState<SummonerWarsCore>,
            events: [{
                type: SW_EVENTS.UNIT_MOVED,
                payload: { unitId: 'necro-elut-bar-0' },
                timestamp: 1,
            } as GameEvent],
        }));

        // 验证 i18n segment
        const moveSeg = findI18nSegment(entry[0].segments, 'actionLog.moveUnit');
        expect(moveSeg).toBeTruthy();

        // 验证卡牌 segment
        const cardSegment = entry[0].segments.find((s) => s.type === 'card');
        expect(cardSegment).toMatchObject({ cardId: 'necro-elut-bar-0', previewText: '伊路特-巴尔' });

        // 验证位置 i18n segments
        const posSegs = entry[0].segments.filter((s) => s.type === 'i18n' && s.key === 'actionLog.position');
        expect(posSegs).toHaveLength(2);
    });

    it('SUMMON_UNIT 生成卡牌片段与坐标', () => {
        const command: Command = {
            type: SW_COMMANDS.SUMMON_UNIT,
            playerId: '0',
            payload: { cardId: 'necro-funeral-pyre-0-1', position: { row: 0, col: 2 } },
        };

        const entry = normalizeEntries(formatSummonerWarsActionEntry({
            command,
            state: { core: createCore() } as MatchState<SummonerWarsCore>,
            events: [] as GameEvent[],
        }));

        // 验证 i18n segment
        const summonSeg = findI18nSegment(entry[0].segments, 'actionLog.summonUnit');
        expect(summonSeg).toBeTruthy();

        // 验证卡牌 segment
        expect(entry[0].segments.some((s) => s.type === 'card' && s.cardId === 'necro-funeral-pyre-0-1')).toBe(true);

        // 验证位置 i18n segment
        const posSeg = findI18nSegment(entry[0].segments, 'actionLog.position');
        expect(posSeg).toBeTruthy();
        expect(posSeg!.params).toEqual({ row: 1, col: 3 });
    });

    it('DISCARD_FOR_MAGIC 包含多张卡牌', () => {
        const command: Command = {
            type: SW_COMMANDS.DISCARD_FOR_MAGIC,
            playerId: '0',
            payload: { cardIds: ['necro-funeral-pyre-0-1', 'necro-hellfire-blade-0'] },
        };

        const entry = normalizeEntries(formatSummonerWarsActionEntry({
            command,
            state: { core: createCore() } as MatchState<SummonerWarsCore>,
            events: [] as GameEvent[],
        }));

        // 验证 i18n segment
        const discardSeg = findI18nSegment(entry[0].segments, 'actionLog.discardForMagic');
        expect(discardSeg).toBeTruthy();

        // 验证卡牌 segments
        const cardSegments = entry[0].segments.filter((s) => s.type === 'card');
        expect(cardSegments).toHaveLength(2);
        expect(cardSegments.map((s) => s.type === 'card' && s.cardId)).toEqual([
            'necro-funeral-pyre-0-1',
            'necro-hellfire-blade-0',
        ]);

        // 验证分隔符 i18n segment
        const sepSeg = findI18nSegment(entry[0].segments, 'actionLog.cardSeparator');
        expect(sepSeg).toBeTruthy();
    });

    it('UNIT_DAMAGED 生成事件日志', () => {
        const command: Command = {
            type: SW_COMMANDS.SUMMON_UNIT,
            playerId: '0',
            payload: { cardId: 'necro-undead-warrior-0', position: { row: 0, col: 0 } },
        };

        const result = normalizeEntries(formatSummonerWarsActionEntry({
            command,
            state: { core: createCore() } as MatchState<SummonerWarsCore>,
            events: [{
                type: SW_EVENTS.UNIT_DAMAGED,
                payload: { position: { row: 0, col: 0 }, damage: 2, cardId: 'necro-undead-warrior-0' },
                timestamp: 2,
            } as GameEvent],
        }));

        const damagedEntry = result.find((e) => e.kind === SW_EVENTS.UNIT_DAMAGED);
        expect(damagedEntry).toBeTruthy();

        // 验证 i18n segment
        const damageSeg = findI18nSegment(damagedEntry!.segments, 'actionLog.unitDamaged');
        expect(damageSeg).toBeTruthy();
        expect(damageSeg!.params).toEqual({ amount: 2 });
    });

    it('CONTROL_TRANSFERRED 记录控制权转移', () => {
        const command: Command = {
            type: SW_COMMANDS.MOVE_UNIT,
            playerId: '0',
            payload: { from: { row: 0, col: 0 }, to: { row: 0, col: 1 } },
        };

        const result = normalizeEntries(formatSummonerWarsActionEntry({
            command,
            state: { core: createCore() } as MatchState<SummonerWarsCore>,
            events: [{
                type: SW_EVENTS.CONTROL_TRANSFERRED,
                payload: { targetPosition: { row: 0, col: 0 }, targetUnitId: 'necro-undead-warrior-0', newOwner: '1', temporary: true },
                timestamp: 3,
            } as GameEvent],
        }));

        const controlEntry = result.find((e) => e.kind === SW_EVENTS.CONTROL_TRANSFERRED);
        expect(controlEntry).toBeTruthy();

        // 验证 i18n segment — 使用 playerId 直接传参
        const controlSeg = findI18nSegment(controlEntry!.segments, 'actionLog.controlTransferred');
        expect(controlSeg).toBeTruthy();
        expect(controlSeg!.params).toEqual({ playerId: '1' });

        // 验证临时标记
        const tempSeg = findI18nSegment(controlEntry!.segments, 'actionLog.controlTransferredTemporary');
        expect(tempSeg).toBeTruthy();
    });

    it('PLAY_EVENT 生成卡牌片段', () => {
        const command: Command = {
            type: SW_COMMANDS.PLAY_EVENT,
            playerId: '0',
            payload: { cardId: 'necro-funeral-pyre-0-1' },
        };

        const entry = normalizeEntries(formatSummonerWarsActionEntry({
            command,
            state: { core: createCore() } as MatchState<SummonerWarsCore>,
            events: [] as GameEvent[],
        }));

        const playSeg = findI18nSegment(entry[0].segments, 'actionLog.playEvent');
        expect(playSeg).toBeTruthy();

        const cardSegment = entry[0].segments.find((s) => s.type === 'card');
        expect(cardSegment?.type === 'card' && cardSegment.cardId).toBe('necro-funeral-pyre-0-1');
    });

    it('DECLARE_ATTACK 治疗模式显示治疗量', () => {
        const command: Command = {
            type: SW_COMMANDS.DECLARE_ATTACK,
            playerId: '0',
            payload: { attacker: { row: 3, col: 3 }, target: { row: 3, col: 4 } },
        };

        const entry = normalizeEntries(formatSummonerWarsActionEntry({
            command,
            state: { core: createCore() } as MatchState<SummonerWarsCore>,
            events: [{
                type: SW_EVENTS.UNIT_ATTACKED,
                payload: {
                    attacker: { row: 3, col: 3 }, target: { row: 3, col: 4 },
                    attackerId: 'paladin-temple-priest-0',
                    attackType: 'melee', diceCount: 2,
                    baseStrength: 2,
                    diceResults: [], hits: 0,
                    healingMode: true, healAmount: 2,
                },
                timestamp: 1,
            } as GameEvent],
        }));

        // 验证使用治疗标签而非攻击标签
        const healSeg = findI18nSegment(entry[0].segments, 'actionLog.healAttackUnit');
        expect(healSeg).toBeTruthy();

        // 验证显示治疗量
        const healAmountSeg = findI18nSegment(entry[0].segments, 'actionLog.attackHealing');
        expect(healAmountSeg).toBeTruthy();
        expect(healAmountSeg!.params).toEqual({ amount: 2 });

        // 验证不显示命中数
        const hitsSeg = findI18nSegment(entry[0].segments, 'actionLog.attackHits');
        expect(hitsSeg).toBeUndefined();
    });

    it('DECLARE_ATTACK 普通攻击显示命中数', () => {
        const command: Command = {
            type: SW_COMMANDS.DECLARE_ATTACK,
            playerId: '0',
            payload: { attacker: { row: 3, col: 3 }, target: { row: 2, col: 3 } },
        };

        const entry = normalizeEntries(formatSummonerWarsActionEntry({
            command,
            state: { core: createCore() } as MatchState<SummonerWarsCore>,
            events: [{
                type: SW_EVENTS.UNIT_ATTACKED,
                payload: {
                    attacker: { row: 3, col: 3 }, target: { row: 2, col: 3 },
                    attackerId: 'necro-undead-warrior-0',
                    attackType: 'melee', diceCount: 1,
                    baseStrength: 1,
                    diceResults: [], hits: 1,
                },
                timestamp: 1,
            } as GameEvent],
        }));

        // 验证使用攻击标签
        const attackSeg = findI18nSegment(entry[0].segments, 'actionLog.attackUnit');
        expect(attackSeg).toBeTruthy();

        // 验证显示命中数
        const hitsSeg = findI18nSegment(entry[0].segments, 'actionLog.attackHits');
        expect(hitsSeg).toBeTruthy();
        expect(hitsSeg!.params).toEqual({ hits: 1 });

        // 验证不显示治疗量
        const healSeg = findI18nSegment(entry[0].segments, 'actionLog.attackHealing');
        expect(healSeg).toBeUndefined();
    });
});
