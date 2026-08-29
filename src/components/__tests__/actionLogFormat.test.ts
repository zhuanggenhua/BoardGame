import { describe, expect, it } from 'vitest';
import type { ActionLogEntry } from '../../engine/types';
import {
    buildActionLogRows,
    createStateBackedActionLogPlayerLabel,
    formatActionLogSegments,
} from '../game/utils/actionLogFormat';

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

    it('formatActionLogSegments 支持 diceResult 缺失/异常数据', () => {
        const result = formatActionLogSegments([
            { type: 'text', text: '掷骰' },
            { type: 'diceResult', spriteAsset: 'summonerwars/common/dice', spriteCols: 3, spriteRows: 3 } as any,
        ]);
        expect(result).toBe('掷骰');
    });

    it('formatActionLogSegments 显示 diceResult 数值', () => {
        const result = formatActionLogSegments([
            { type: 'text', text: '掷骰' },
            { type: 'diceResult', spriteAsset: 'summonerwars/common/dice', spriteCols: 3, spriteRows: 3, dice: [{ value: 1 }, { value: 2 }] } as any,
        ]);
        expect(result).toBe('掷骰 [1,2]');
    });

    it('玩家名兜底会从游戏状态读取探索者显示名', () => {
        const getPlayerLabel = createStateBackedActionLogPlayerLabel({
            core: {
                currentExplorer: { playerId: '0', displayName: '薇薇安' },
                otherExplorers: [{ playerId: '1', displayName: '布兰登' }],
            },
            sys: {
                actionLog: { entries: [], maxEntries: 50 },
            },
        } as any);

        expect(getPlayerLabel('0')).toBe('薇薇安');
        expect(getPlayerLabel('1')).toBe('布兰登');
        expect(getPlayerLabel('2')).toBe('P2');
    });
});
