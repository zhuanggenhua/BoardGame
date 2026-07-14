import { describe, expect, it } from 'vitest';
import { QIDAHEN_MANIFEST } from '../manifest';

describe('七大恨游戏清单', () => {
    it('未经用户明确允许不得关闭实施中标签', () => {
        expect(QIDAHEN_MANIFEST.statusTag).toBe('under_construction');
    });
});
