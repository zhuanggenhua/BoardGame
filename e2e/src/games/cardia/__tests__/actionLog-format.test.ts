/**
 * ActionLog 格式化测试
 */

import { describe, it, expect } from 'vitest';
import { formatCardiaActionEntry } from '../actionLog';
import { CARDIA_COMMANDS } from '../domain/commands';
import { CARDIA_EVENTS } from '../domain/events';
import type { Command, GameEvent, MatchState } from '../../../engine/types';
import type { CardiaCore } from '../domain/types';

describe('formatCardiaActionEntry', () => {
    describe('PLAY_CARD 命令', () => {
        it('应该生成包含卡牌和遭遇位置的日志条目', () => {
            const command: Command = {
                type: CARDIA_COMMANDS.PLAY_CARD,
                playerId: '0',
                timestamp: 1234567890,
                payload: {
                    cardUid: 'deck_i_card_15_1234567890_abc',
                },
            };

            const events: GameEvent[] = [
                {
                    type: CARDIA_EVENTS.CARD_PLAYED.type,
                    payload: {
                        cardUid: 'deck_i_card_15_1234567890_abc',
                        playerId: '0',
                        slotIndex: 0,
                    },
                },
            ];

            const state = {} as MatchState<CardiaCore>;

            const result = formatCardiaActionEntry({ command, state, events });

            expect(result).not.toBeNull();
            expect(Array.isArray(result)).toBe(false);

            const entry = result as any;
            expect(entry.segments).toHaveLength(3);

            // 第一个 segment: "打出"
            expect(entry.segments[0]).toMatchObject({
                type: 'i18n',
                ns: 'game-cardia',
                key: 'actionLog.playCard',
            });

            // 第二个 segment: 卡牌名称
            expect(entry.segments[1]).toMatchObject({
                type: 'card',
                cardId: 'deck_i_card_15_1234567890_abc',
                previewText: 'cards.deck_i_card_15.name',
            });

            // 第三个 segment: "到遭遇 1"（内部索引0 + 1）
            expect(entry.segments[2]).toMatchObject({
                type: 'i18n',
                ns: 'game-cardia',
                key: 'actionLog.toSlot',
                params: { slot: 1 },
            });
        });

        it('应该正确处理不同的遭遇位置', () => {
            const command: Command = {
                type: CARDIA_COMMANDS.PLAY_CARD,
                playerId: '0',
                timestamp: 1234567890,
                payload: {
                    cardUid: 'deck_i_card_01_1234567890_xyz',
                },
            };

            const events: GameEvent[] = [
                {
                    type: CARDIA_EVENTS.CARD_PLAYED.type,
                    payload: {
                        cardUid: 'deck_i_card_01_1234567890_xyz',
                        playerId: '0',
                        slotIndex: 5,
                    },
                },
            ];

            const state = {} as MatchState<CardiaCore>;

            const result = formatCardiaActionEntry({ command, state, events });

            expect(result).not.toBeNull();
            const entry = result as any;

            // 验证 slotIndex 参数（内部索引5 + 1 = 6）
            expect(entry.segments[2]).toMatchObject({
                type: 'i18n',
                ns: 'game-cardia',
                key: 'actionLog.toSlot',
                params: { slot: 6 },
            });
        });
    });
});
