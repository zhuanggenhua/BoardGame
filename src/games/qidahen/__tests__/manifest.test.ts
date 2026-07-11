import { describe, expect, it } from 'vitest';
import { QIDAHEN_MANIFEST } from '../manifest';

describe('七大恨游戏清单', () => {
    it('正式完成后不再显示实施中标签', () => {
        expect(QIDAHEN_MANIFEST.statusTag).toBeUndefined();
    });
});
