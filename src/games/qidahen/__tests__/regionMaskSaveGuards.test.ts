import { describe, expect, it } from 'vitest';
import { getQidahenRegionMaskSaveBlockedReason } from '../regionMaskSaveGuards';

describe('七大恨 region-mask 保存门禁', () => {
    it('工作区还在自动回读时，必须阻止保存，避免旧内存态覆盖正式结果', () => {
        expect(getQidahenRegionMaskSaveBlockedReason({
            workspaceLoadState: 'loading',
            outputDir: 'src/games/qidahen/data',
        })).toContain('正在读取 src/games/qidahen/data 里的当前工作区数据');
    });

    it('工作区回读失败时，必须继续阻止保存，避免把旧内存态写回磁盘', () => {
        expect(getQidahenRegionMaskSaveBlockedReason({
            workspaceLoadState: 'failed',
            outputDir: 'temp/devtools/qidahen-region-mask-workspaces/manual-boundary-user',
        })).toContain('当前工作区读取失败');
    });

    it('工作区回读完成后，不再阻止保存', () => {
        expect(getQidahenRegionMaskSaveBlockedReason({
            workspaceLoadState: 'ready',
            outputDir: 'src/games/qidahen/data',
        })).toBeNull();
    });
});
