/**
 * SmashUp - ActionLog 格式化测试
 * 
 * 验证 formatSmashUpActionEntry 生成正确的 i18n segment（延迟翻译）。
 */

import { describe, expect, it } from 'vitest';
import type { ActionLogEntry, ActionLogSegment, Command, GameEvent, MatchState } from '../../../engine/types';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import type { SmashUpCore } from '../domain/types';
import { formatSmashUpActionEntry } from '../actionLog';
import { makeBase, makeMatchState, makeStateWithBases } from './helpers';

const normalizeEntries = (result: ActionLogEntry | ActionLogEntry[] | null): ActionLogEntry[] => {
    if (!result) return [];
    return Array.isArray(result) ? result : [result];
};

const createMatchState = (): MatchState<SmashUpCore> => {
    const core = makeStateWithBases([makeBase('base_the_homeworld')]);
    return makeMatchState(core);
};

/** 从 segments 中提取所有 i18n segment 的 key */
const getI18nKeys = (segments: ActionLogSegment[]): string[] =>
    segments.filter(s => s.type === 'i18n').map(s => (s as { key: string }).key);

/** 查找指定 key 的 i18n segment */
const findI18nSegment = (segments: ActionLogSegment[], key: string) =>
    segments.find(s => s.type === 'i18n' && (s as { key: string }).key === key) as
    | { type: 'i18n'; ns: string; key: string; params?: Record<string, string | number>; paramI18nKeys?: string[] }
    | undefined;

describe('formatSmashUpActionEntry', () => {
    it('PLAY_MINION 生成 i18n segment + card segment', () => {
        const command: Command = {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'pirate_king-1-1', baseIndex: 0 },
            timestamp: 1,
        };
        const event: GameEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: { playerId: '0', cardUid: 'pirate_king-1-1', defId: 'pirate_king', baseIndex: 0, power: 5 },
            timestamp: 1,
        } as GameEvent;

        const result = formatSmashUpActionEntry({
            command,
            state: createMatchState(),
            events: [event],
        });
        const entries = normalizeEntries(result);

        const commandEntry = entries.find((entry) => entry.kind === SU_EVENTS.MINION_PLAYED);
        expect(commandEntry).toBeTruthy();
        // 应包含 i18n segment（playMinion）和 card segment
        const i18nKeys = getI18nKeys(commandEntry!.segments);
        expect(i18nKeys).toContain('actionLog.minionPlayed');
        const cardSegments = commandEntry?.segments.filter(segment => segment.type === 'card');
        expect(cardSegments?.[0]).toMatchObject({ cardId: 'pirate_king' });
        // 应包含 onBase i18n segment
        expect(i18nKeys).toContain('actionLog.onBase');
    });

    it('BASE_SCORED 生成排名 i18n segment', () => {
        const command: Command = {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'pirate_dinghy-1-1' },
            timestamp: 2,
        };
        const event: GameEvent = {
            type: SU_EVENTS.BASE_SCORED,
            payload: {
                baseIndex: 0,
                baseDefId: 'base_the_homeworld',
                rankings: [
                    { playerId: '0', power: 12, vp: 3 },
                    { playerId: '1', power: 9, vp: 2 },
                ],
            },
            timestamp: 2,
        } as GameEvent;

        const result = formatSmashUpActionEntry({
            command,
            state: createMatchState(),
            events: [event],
        });
        const entries = normalizeEntries(result);
        const scoredEntry = entries.find((entry) => entry.kind === SU_EVENTS.BASE_SCORED);

        expect(scoredEntry).toBeTruthy();
        const i18nKeys = getI18nKeys(scoredEntry!.segments);
        expect(i18nKeys).toContain('actionLog.baseScored');
        expect(i18nKeys).toContain('actionLog.baseScoredRanking');

        // 验证排名参数
        const rankingSegs = scoredEntry!.segments.filter(
            s => s.type === 'i18n' && (s as { key: string }).key === 'actionLog.baseScoredRanking'
        ) as { params?: Record<string, string | number> }[];
        expect(rankingSegs).toHaveLength(2);
        expect(rankingSegs[0].params?.playerId).toBe('0');
        expect(rankingSegs[0].params?.vp).toBe(3);
    });

    it('BASE_SCORED 在非随从力量存在时仍显示正确总力量', () => {
        const command: Command = {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'pirate_dinghy-1-1' },
            timestamp: 2,
        };
        const event: GameEvent = {
            type: SU_EVENTS.BASE_SCORED,
            payload: {
                baseIndex: 0,
                baseDefId: 'base_the_homeworld',
                rankings: [
                    { playerId: '0', power: 10, vp: 3 },
                ],
                minionBreakdowns: {
                    '0': [
                        {
                            defId: 'test_minion',
                            basePower: 5,
                            finalPower: 5,
                            modifiers: [],
                        },
                    ],
                },
            },
            timestamp: 2,
        } as GameEvent;

        const result = formatSmashUpActionEntry({
            command,
            state: createMatchState(),
            events: [event],
        });
        const entries = normalizeEntries(result);
        const scoredEntry = entries.find((entry) => entry.kind === SU_EVENTS.BASE_SCORED);

        expect(scoredEntry).toBeTruthy();
        const breakdownSegment = scoredEntry!.segments.find(
            segment => segment.type === 'breakdown'
        ) as { type: 'breakdown'; displayText: string; lines: Array<{ label: string }> } | undefined;
        expect(breakdownSegment?.displayText).toBe('10');
        expect(breakdownSegment?.lines.some(line => line.label === 'actionLog.powerModifier.nonMinion')).toBe(true);
    });

    it('MINION_MOVED 生成 fromTo i18n segment', () => {
        const command: Command = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'pirate_king-1-1', baseIndex: 0 },
            timestamp: 3,
        };
        const event: GameEvent = {
            type: SU_EVENTS.MINION_MOVED,
            payload: {
                minionUid: 'pirate_king-1-1',
                minionDefId: 'pirate_king',
                fromBaseIndex: 0,
                toBaseIndex: 0,
                reason: 'test',
            },
            timestamp: 3,
        } as GameEvent;

        const result = formatSmashUpActionEntry({
            command,
            state: createMatchState(),
            events: [event],
        });
        const entries = normalizeEntries(result);
        const movedEntry = entries.find((entry) => entry.kind === SU_EVENTS.MINION_MOVED);
        expect(movedEntry).toBeTruthy();
        const i18nKeys = getI18nKeys(movedEntry!.segments);
        expect(i18nKeys).toContain('actionLog.minionMoved');
        expect(i18nKeys).toContain('actionLog.fromTo');
    });

    it('VP_AWARDED 追加原因 i18n segment', () => {
        const command: Command = {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'pirate_dinghy-1-1' },
            timestamp: 4,
        };
        const event: GameEvent = {
            type: SU_EVENTS.VP_AWARDED,
            payload: { playerId: '0', amount: 2, reason: 'test-reason' },
            timestamp: 4,
        } as GameEvent;

        const result = formatSmashUpActionEntry({
            command,
            state: createMatchState(),
            events: [event],
        });
        const entries = normalizeEntries(result);
        const vpEntry = entries.find((entry) => entry.kind === SU_EVENTS.VP_AWARDED);
        expect(vpEntry).toBeTruthy();
        const i18nKeys = getI18nKeys(vpEntry!.segments);
        expect(i18nKeys).toContain('actionLog.vpAwarded');
        expect(i18nKeys).toContain('actionLog.reasonSuffix');

        const vpSeg = findI18nSegment(vpEntry!.segments, 'actionLog.vpAwarded');
        expect(vpSeg?.params?.playerId).toBe('0');
        expect(vpSeg?.params?.amount).toBe(2);

        const reasonSeg = findI18nSegment(vpEntry!.segments, 'actionLog.reasonSuffix');
        expect(reasonSeg?.params?.reason).toBe('test-reason');
    });

    it('REVEAL_HAND 生成正确的 i18n segment', () => {
        const command: Command = {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'test-1', baseIndex: 0 },
            timestamp: 1,
        };
        const event: GameEvent = {
            type: SU_EVENTS.REVEAL_HAND,
            payload: {
                targetPlayerId: '0',
                viewerPlayerId: 'all',
                cards: [{ uid: 'card1', defId: 'pirate_king' }, { uid: 'card2', defId: 'pirate_first_mate' }],
                reason: 'wizard_scry',
            },
            timestamp: 1,
        } as GameEvent;

        const result = formatSmashUpActionEntry({
            command,
            state: createMatchState(),
            events: [event],
        });

        const entries = normalizeEntries(result);
        expect(entries).toHaveLength(1);
        const entry = entries[0];
        expect(entry).toBeTruthy();
        const i18nKeys = getI18nKeys(entry!.segments);
        expect(i18nKeys).toContain('actionLog.revealHand');
        
        const revealSeg = findI18nSegment(entry!.segments, 'actionLog.revealHand');
        expect(revealSeg?.params?.playerId).toBe('0');
        expect(revealSeg?.params?.count).toBe(2);
    });

    it('REVEAL_DECK_TOP 生成正确的 i18n segment', () => {
        const command: Command = {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'test-1', baseIndex: 0 },
            timestamp: 1,
        };
        const event: GameEvent = {
            type: SU_EVENTS.REVEAL_DECK_TOP,
            payload: {
                targetPlayerId: '0',
                viewerPlayerId: 'all',
                cards: [{ uid: 'card1', defId: 'wizard_summon' }],
                count: 1,
                reason: 'wizard_neophyte',
                sourcePlayerId: '0',
            },
            timestamp: 1,
        } as GameEvent;

        const result = formatSmashUpActionEntry({
            command,
            state: createMatchState(),
            events: [event],
        });

        const entries = normalizeEntries(result);
        expect(entries).toHaveLength(1);
        const entry = entries[0];
        expect(entry).toBeTruthy();
        const i18nKeys = getI18nKeys(entry!.segments);
        expect(i18nKeys).toContain('actionLog.revealDeckTop');
        
        const revealSeg = findI18nSegment(entry!.segments, 'actionLog.revealDeckTop');
        expect(revealSeg?.params?.playerId).toBe('0');
        expect(revealSeg?.params?.count).toBe(1);
    });

    it('PERMANENT_POWER_ADDED 生成正确的 i18n segment', () => {
        const command: Command = {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'test-1', baseIndex: 0 },
            timestamp: 1,
        };
        const event: GameEvent = {
            type: SU_EVENTS.PERMANENT_POWER_ADDED,
            payload: {
                minionUid: 'minion-1',
                amount: 2,
                baseIndex: 0,
                reason: 'frankenstein_igor',
            },
            timestamp: 1,
        } as GameEvent;

        const result = formatSmashUpActionEntry({
            command,
            state: createMatchState(),
            events: [event],
        });

        const entries = normalizeEntries(result);
        expect(entries).toHaveLength(1);
        const entry = entries[0];
        expect(entry).toBeTruthy();
        const i18nKeys = getI18nKeys(entry!.segments);
        expect(i18nKeys).toContain('actionLog.permanentPowerAdded');
        
        const powerSeg = findI18nSegment(entry!.segments, 'actionLog.permanentPowerAdded');
        expect(powerSeg?.params?.amount).toBe(2);
    });
});
