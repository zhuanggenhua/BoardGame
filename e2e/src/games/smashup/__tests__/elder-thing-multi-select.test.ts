/**
 * 远古之物多选功能单元测试
 * 测试远古之物"消灭两个己方随从"的多选交互
 */

import { describe, it, expect } from 'vitest';
import { createSimpleChoice } from '../../../engine/systems/InteractionSystem';

describe('远古之物多选交互', () => {
    it('应该创建包含 multi 配置的交互', () => {
        const options = [
            { id: 'minion-1', label: '随从 1', value: { minionUid: 'uid1', defId: 'def1', baseIndex: 0 } },
            { id: 'minion-2', label: '随从 2', value: { minionUid: 'uid2', defId: 'def2', baseIndex: 0 } },
            { id: 'minion-3', label: '随从 3', value: { minionUid: 'uid3', defId: 'def3', baseIndex: 0 } },
        ];

        const interaction = createSimpleChoice(
            'test_elder_thing_destroy',
            '0',
            '选择两个随从消灭',
            options,
            { sourceId: 'elder_thing_elder_thing_destroy_select', targetType: 'minion', multi: { min: 2, max: 2 } }
        );

        expect(interaction.kind).toBe('simple-choice');
        expect(interaction.playerId).toBe('0');
        expect(interaction.data.title).toBe('选择两个随从消灭');
        expect(interaction.data.options).toHaveLength(3);
        expect(interaction.data.multi).toEqual({ min: 2, max: 2 });
        expect(interaction.data.sourceId).toBe('elder_thing_elder_thing_destroy_select');
        expect(interaction.data.targetType).toBe('minion');
    });

    it('multi 配置应该正确传递到 data 中', () => {
        const interaction = createSimpleChoice(
            'test_multi',
            '0',
            '测试多选',
            [
                { id: 'opt1', label: '选项 1', value: { id: 1 } },
                { id: 'opt2', label: '选项 2', value: { id: 2 } },
            ],
            { multi: { min: 1, max: 2 } }
        );

        expect(interaction.data.multi).toBeDefined();
        expect(interaction.data.multi?.min).toBe(1);
        expect(interaction.data.multi?.max).toBe(2);
    });

    it('没有 multi 配置时应该是单选', () => {
        const interaction = createSimpleChoice(
            'test_single',
            '0',
            '测试单选',
            [
                { id: 'opt1', label: '选项 1', value: { id: 1 } },
                { id: 'opt2', label: '选项 2', value: { id: 2 } },
            ]
        );

        expect(interaction.data.multi).toBeUndefined();
    });
});
