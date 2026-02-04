import { describe, expect, it } from 'vitest';
import type { ActionLogEntry } from '../../engine/types';
import { buildActionLogRows, formatActionLogSegments } from '../game/actionLogFormat';

describe('actionLogFormat', () => {
    it('formatActionLogSegments 拼接文本与卡牌预览', () => {
        const result = formatActionLogSegments([
            { type: 'text', text: '玩家行动' },
            { type: 'card', cardId: 'card-1', previewText: '卡牌A' },
        ]);
        expect(result).toBe('玩家行动 卡牌A');
    });

    it('buildActionLogRows 使用倒序并回退到 kind', () => {
        const entries: ActionLogEntry[] = [
            {
                id: 'a',
                timestamp: 100,
                actorId: '1',
                kind: 'KIND_A',
                segments: [],
            },
            {
                id: 'b',
                timestamp: 200,
                actorId: '2',
                kind: 'KIND_B',
                segments: [{ type: 'text', text: '行动B' }],
            },
        ];

        const rows = buildActionLogRows(entries, {
            formatTime: (ts) => `t${ts}`,
            getPlayerLabel: (playerId) => `P${playerId}`,
        });

        expect(rows).toHaveLength(2);
        expect(rows[0]).toMatchObject({
            id: 'b',
            timeLabel: 't200',
            playerLabel: 'P2',
            text: '行动B',
        });
        expect(rows[1]).toMatchObject({
            id: 'a',
            timeLabel: 't100',
            playerLabel: 'P1',
            text: 'KIND_A',
        });
    });
});
