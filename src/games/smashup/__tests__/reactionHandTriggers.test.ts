import { describe, expect, it } from 'vitest';
import { getReactionHandTriggerOptions } from '../ui/reactionHandTriggers';

describe('手牌可选触发入口', () => {
    it('唯一可选触发由当前玩家的同一手牌承接', () => {
        const result = getReactionHandTriggerOptions(
            [{ id: 'choose', value: { kind: 'trigger', triggerId: 'trigger-1' } }],
            [{ id: 'trigger-1', sourceCardUid: 'card-1', resolutionClass: 'optional' }],
            [{ uid: 'card-1' }],
        );
        expect(result.optionIdsByCardUid.get('card-1')).toBe('choose');
        expect(result.optionIds.has('choose')).toBe(true);
    });

    it('同一手牌存在多个响应或已有普通出牌选择时保留独立选项', () => {
        const triggers = [
            { id: 'one', sourceCardUid: 'card-1', resolutionClass: 'optional' },
            { id: 'two', sourceCardUid: 'card-1', resolutionClass: 'optional' },
        ];
        const first = { id: 'first', value: { kind: 'trigger', triggerId: 'one' } };
        expect(getReactionHandTriggerOptions([
            first, { id: 'second', value: { kind: 'trigger', triggerId: 'two' } },
        ], triggers, [{ uid: 'card-1' }]).optionIds.size).toBe(0);
        expect(getReactionHandTriggerOptions([
            first, { id: 'play', value: { kind: 'play_action', playerId: '0', cardUid: 'card-1' } },
        ], triggers, [{ uid: 'card-1' }]).optionIds.size).toBe(0);
    });

    it('禁用项、强制触发和不在当前手牌的来源不会变成手牌入口', () => {
        const result = getReactionHandTriggerOptions([
            { id: 'disabled', disabled: true, value: { kind: 'trigger', triggerId: 'one' } },
            { id: 'mandatory', value: { kind: 'trigger', triggerId: 'two' } },
            { id: 'other', value: { kind: 'trigger', triggerId: 'three' } },
        ], [
            { id: 'one', sourceCardUid: 'card-1', resolutionClass: 'optional' },
            { id: 'two', sourceCardUid: 'card-1', resolutionClass: 'mandatory' },
            { id: 'three', sourceCardUid: 'card-2', resolutionClass: 'optional' },
        ], [{ uid: 'card-1' }]);
        expect(result.optionIds.size).toBe(0);
        expect(result.optionIdsByCardUid.size).toBe(0);
    });
});
