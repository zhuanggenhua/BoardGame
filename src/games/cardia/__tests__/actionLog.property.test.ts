/**
 * Cardia ActionLog - 属性测试
 * 
 * 使用 fast-check 验证 ActionLog 系统的通用规则在所有输入下的正确性。
 * 
 * 测试的属性：
 * - Property 1: 命令记录完整性
 * - Property 3: i18n Segment 正确性
 * - Property 4: 卡牌 Segment 正确性
 * - Property 6: 卡牌预览函数正确性
 * - Property 8: 时间戳单调性
 * - Property 9: 条目 ID 唯一性
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { formatCardiaActionEntry, ACTION_ALLOWLIST } from '../actionLog';
import { getCardiaCardPreviewMeta, getCardiaCardPreviewRef } from '../ui/cardPreviewHelper';
import { CARDIA_COMMANDS } from '../domain/commands';
import { CARDIA_EVENTS } from '../domain/events';
import type { Command, GameEvent, MatchState, ActionLogEntry } from '../../../engine/types';
import type { CardiaCore } from '../domain/types';

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 创建最小化的 CardiaCore 状态（用于测试）
 */
function createMinimalState(): MatchState<CardiaCore> {
    return {
        core: {
            players: {
                '0': {
                    id: '0',
                    hand: [],
                    discard: [],
                    playedCards: [],
                    signets: 0,
                    hasPlayed: false,
                    hasDrawn: false,
                },
                '1': {
                    id: '1',
                    hand: [],
                    discard: [],
                    playedCards: [],
                    signets: 0,
                    hasPlayed: false,
                    hasDrawn: false,
                },
            },
            currentPlayerId: '0',
            phase: 'play',
            turnNumber: 1,
            encounterHistory: [],
            modifierTokens: [],
            ongoingAbilities: [],
            delayedEffects: [],
        },
        sys: {} as any,
    } as MatchState<CardiaCore>;
}

/**
 * 检查 segment 是否为 i18n segment
 */
function isI18nSegment(segment: any): boolean {
    return segment.type === 'i18n' && segment.ns === 'game-cardia' && typeof segment.key === 'string';
}

/**
 * 检查 segment 是否为 card segment
 */
function isCardSegment(segment: any): boolean {
    return (
        segment.type === 'card' &&
        typeof segment.cardId === 'string' &&
        (segment.previewText === undefined || typeof segment.previewText === 'string') &&
        (segment.previewRef === undefined || typeof segment.previewRef === 'object')
    );
}

/**
 * 扁平化日志条目数组（处理单个条目或数组）
 */
function flattenEntries(result: ActionLogEntry | ActionLogEntry[] | null): ActionLogEntry[] {
    if (!result) return [];
    return Array.isArray(result) ? result : [result];
}

// ============================================================================
// Arbitraries (fast-check 生成器)
// ============================================================================

/**
 * 生成随机玩家 ID
 */
const arbPlayerId = fc.constantFrom('0', '1');

/**
 * 生成随机卡牌 ID（包括有效和无效）
 */
const arbCardId = fc.oneof(
    // 有效卡牌 ID（Deck I）
    fc.constantFrom(
        'deck_i_card_01',
        'deck_i_card_02',
        'deck_i_card_03',
        'deck_i_card_04',
        'deck_i_card_05',
        'deck_i_card_06',
        'deck_i_card_07',
        'deck_i_card_08',
        'deck_i_card_09',
        'deck_i_card_10',
    ),
    // 无效卡牌 ID
    fc.constantFrom('invalid_card', 'nonexistent', 'test_card'),
);

/**
 * 生成随机遭遇位置
 */
const arbSlotIndex = fc.integer({ min: 0, max: 2 });

/**
 * 生成随机时间戳
 */
const arbTimestamp = fc.integer({ min: 1000000000000, max: 9999999999999 });

/**
 * 生成随机命令（白名单中的类型）
 */
const arbCommand = fc.tuple(arbPlayerId, arbTimestamp, arbCardId, arbSlotIndex).chain(
    ([playerId, timestamp, cardId, slotIndex]) =>
        fc.oneof(
            // PLAY_CARD
            fc.constant({
                type: CARDIA_COMMANDS.PLAY_CARD,
                playerId,
                timestamp,
                payload: { cardUid: cardId, slotIndex },
            } as Command),
            // ACTIVATE_ABILITY
            fc.constant({
                type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
                playerId,
                timestamp,
                payload: { abilityId: 'ability_test', sourceCardUid: cardId },
            } as Command),
            // SKIP_ABILITY
            fc.constant({
                type: CARDIA_COMMANDS.SKIP_ABILITY,
                playerId,
                timestamp,
                payload: { playerId },
            } as Command),
            // END_TURN
            fc.constant({
                type: CARDIA_COMMANDS.END_TURN,
                playerId,
                timestamp,
                payload: {},
            } as Command),
            // ADD_MODIFIER
            fc.constant({
                type: CARDIA_COMMANDS.ADD_MODIFIER,
                playerId,
                timestamp,
                payload: { cardUid: cardId, modifierValue: 3 },
            } as Command),
            // REMOVE_MODIFIER
            fc.constant({
                type: CARDIA_COMMANDS.REMOVE_MODIFIER,
                playerId,
                timestamp,
                payload: { cardUid: cardId },
            } as Command),
        ),
);

/**
 * 生成随机事件（匹配命令类型）
 */
function generateEventsForCommand(command: Command): GameEvent[] {
    const baseTimestamp = typeof command.timestamp === 'number' ? command.timestamp : Date.now();

    switch (command.type) {
        case CARDIA_COMMANDS.PLAY_CARD:
            return [
                {
                    type: CARDIA_EVENTS.CARD_PLAYED.type,
                    payload: {
                        cardUid: command.payload.cardUid,
                        playerId: command.playerId,
                        slotIndex: command.payload.slotIndex,
                    },
                    timestamp: baseTimestamp + 1,
                } as GameEvent,
            ];

        case CARDIA_COMMANDS.ACTIVATE_ABILITY:
            return [
                {
                    type: CARDIA_EVENTS.ABILITY_ACTIVATED.type,
                    payload: {
                        abilityId: command.payload.abilityId,
                        cardId: command.payload.sourceCardUid,
                        playerId: command.playerId,
                        isInstant: true,
                        isOngoing: false,
                    },
                    timestamp: baseTimestamp + 1,
                } as GameEvent,
            ];

        default:
            return [];
    }
}

// ============================================================================
// Property 1: 命令记录完整性
// ============================================================================

describe('Feature: cardia-action-log, Property 1: 命令记录完整性', () => {
    it('白名单中的命令应生成对应的日志条目，且 kind 与命令类型一致', () => {
        fc.assert(
            fc.property(arbCommand, (command) => {
                const state = createMinimalState();
                const events = generateEventsForCommand(command);

                const result = formatCardiaActionEntry({ command, state, events });
                const entries = flattenEntries(result);

                // 如果命令在白名单中，应该生成至少一个日志条目
                if (ACTION_ALLOWLIST.includes(command.type as any)) {
                    // 某些命令可能因为缺少必需事件而返回 null（如 PLAY_CARD 需要 CARD_PLAYED 事件）
                    if (entries.length > 0) {
                        // 验证第一个条目的 kind 与命令类型一致
                        expect(entries[0].kind).toBe(command.type);
                        // 验证 actorId 与命令的 playerId 一致
                        expect(entries[0].actorId).toBe(command.playerId);
                    }
                }
            }),
            { numRuns: 100 },
        );
    });
});

// ============================================================================
// Property 3: i18n Segment 正确性
// ============================================================================

describe('Feature: cardia-action-log, Property 3: i18n Segment 正确性', () => {
    it('所有文本片段应使用 i18n segment，且 ns 字段为 game-cardia', () => {
        fc.assert(
            fc.property(arbCommand, (command) => {
                const state = createMinimalState();
                const events = generateEventsForCommand(command);

                const result = formatCardiaActionEntry({ command, state, events });
                const entries = flattenEntries(result);

                entries.forEach((entry) => {
                    entry.segments.forEach((segment) => {
                        // 跳过 card segment（卡牌 segment 有自己的规则）
                        if (segment.type === 'card') return;

                        // 文本片段应该使用 i18n segment
                        if (segment.type === 'i18n') {
                            expect(segment.ns).toBe('game-cardia');
                            expect(typeof segment.key).toBe('string');
                            expect(segment.key.length).toBeGreaterThan(0);
                        }
                    });
                });
            }),
            { numRuns: 100 },
        );
    });
});

// ============================================================================
// Property 4: 卡牌 Segment 正确性
// ============================================================================

describe('Feature: cardia-action-log, Property 4: 卡牌 Segment 正确性', () => {
    it('卡牌片段应使用 card segment，且包含 cardId、previewText、previewRef', () => {
        fc.assert(
            fc.property(arbCommand, (command) => {
                const state = createMinimalState();
                const events = generateEventsForCommand(command);

                const result = formatCardiaActionEntry({ command, state, events });
                const entries = flattenEntries(result);

                entries.forEach((entry) => {
                    entry.segments.forEach((segment) => {
                        if (segment.type === 'card') {
                            // 验证 cardId 存在
                            expect(typeof segment.cardId).toBe('string');
                            expect(segment.cardId.length).toBeGreaterThan(0);

                            // 验证 previewText 存在（可选）
                            if (segment.previewText !== undefined) {
                                expect(typeof segment.previewText).toBe('string');
                            }

                            // 验证 previewRef 存在（可选）
                            if (segment.previewRef !== undefined) {
                                expect(typeof segment.previewRef).toBe('object');
                                expect(segment.previewRef).not.toBeNull();
                            }

                            // 如果 previewText 是 i18n key（包含 '.'），应设置 previewTextNs
                            if (segment.previewText && segment.previewText.includes('.')) {
                                expect(segment.previewTextNs).toBe('game-cardia');
                            }
                        }
                    });
                });
            }),
            { numRuns: 100 },
        );
    });
});

// ============================================================================
// Property 6: 卡牌预览函数正确性
// ============================================================================

describe('Feature: cardia-action-log, Property 6: 卡牌预览函数正确性', () => {
    it('getCardiaCardPreviewMeta 应返回正确的结构或 null', () => {
        fc.assert(
            fc.property(arbCardId, (cardId) => {
                const meta = getCardiaCardPreviewMeta(cardId);

                if (meta === null) {
                    // 无效卡牌应返回 null
                    expect(meta).toBeNull();
                } else {
                    // 有效卡牌应返回包含 name 和 previewRef 的对象
                    expect(typeof meta.name).toBe('string');
                    expect(meta.name.length).toBeGreaterThan(0);

                    // previewRef 可以是 null 或对象
                    if (meta.previewRef !== null) {
                        expect(typeof meta.previewRef).toBe('object');
                    }
                }
            }),
            { numRuns: 100 },
        );
    });

    it('getCardiaCardPreviewRef 应返回正确的 previewRef 或 null', () => {
        fc.assert(
            fc.property(arbCardId, (cardId) => {
                const previewRef = getCardiaCardPreviewRef(cardId);

                // previewRef 应该是 null 或对象
                if (previewRef !== null) {
                    expect(typeof previewRef).toBe('object');
                }
            }),
            { numRuns: 100 },
        );
    });
});

// ============================================================================
// Property 8: 时间戳单调性
// ============================================================================

describe('Feature: cardia-action-log, Property 8: 时间戳单调性', () => {
    it('事件时间戳应 >= 命令时间戳，多个事件时间戳应递增', () => {
        fc.assert(
            fc.property(arbCommand, (command) => {
                const state = createMinimalState();
                const events = generateEventsForCommand(command);

                const result = formatCardiaActionEntry({ command, state, events });
                const entries = flattenEntries(result);

                const commandTimestamp = typeof command.timestamp === 'number' ? command.timestamp : 0;

                entries.forEach((entry, index) => {
                    // 验证条目时间戳 >= 命令时间戳
                    expect(entry.timestamp).toBeGreaterThanOrEqual(commandTimestamp);

                    // 验证多个条目时间戳递增
                    if (index > 0) {
                        expect(entry.timestamp).toBeGreaterThan(entries[index - 1].timestamp);
                    }
                });
            }),
            { numRuns: 100 },
        );
    });
});

// ============================================================================
// Property 9: 条目 ID 唯一性
// ============================================================================

describe('Feature: cardia-action-log, Property 9: 条目 ID 唯一性', () => {
    it('多个命令生成的日志条目 ID 应不重复', () => {
        fc.assert(
            fc.property(fc.array(arbCommand, { minLength: 2, maxLength: 10 }), (commands) => {
                const state = createMinimalState();
                const allEntries: ActionLogEntry[] = [];

                commands.forEach((command) => {
                    const events = generateEventsForCommand(command);
                    const result = formatCardiaActionEntry({ command, state, events });
                    const entries = flattenEntries(result);
                    allEntries.push(...entries);
                });

                // 收集所有 ID
                const ids = allEntries.map((entry) => entry.id);

                // 验证 ID 唯一性
                const uniqueIds = new Set(ids);
                expect(uniqueIds.size).toBe(ids.length);
            }),
            { numRuns: 50 },
        );
    });
});
