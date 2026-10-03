import { describe, expect, it } from 'vitest';
import { FATE_DOMINATION_MANIFEST } from '../manifest';

describe('命运支配游戏清单', () => {
    it('实施完成前必须保留实施中标记', () => {
        expect(FATE_DOMINATION_MANIFEST.statusTag).toBe('under_construction');
    });
});
