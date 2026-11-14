import { describe, expect, it } from 'vitest';
import { MongoStorage } from '../MongoStorage';
import type { StoredMatchState } from '../../../engine/transport/storage';

describe('MongoStorage 状态持久化裁剪', () => {
    it('只遍历需要保留的撤回快照，并保留原有 undefined 清理语义', () => {
        const discarded = { get expensive() { throw new Error('不应遍历已裁剪快照'); } };
        const state = {
            G: {
                core: { hp: 12, absent: undefined },
                sys: { undo: { snapshots: [discarded, { core: { hp: 10, absent: undefined } }, undefined], maxSnapshots: 10 } },
            },
            _stateID: 3,
        };
        const sanitize = (new MongoStorage() as unknown as { sanitizeStateForStorage: (value: StoredMatchState) => StoredMatchState }).sanitizeStateForStorage;
        const result = sanitize.call(new MongoStorage(), state as unknown as StoredMatchState);
        expect(result).toEqual({ G: { core: { hp: 12 }, sys: { undo: { snapshots: [{ core: { hp: 10 } }], maxSnapshots: 10 } } }, _stateID: 3 });
        expect(state.G.sys.undo.snapshots).toHaveLength(3);
    });
});
