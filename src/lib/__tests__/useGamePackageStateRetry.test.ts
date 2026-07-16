import { describe, expect, it } from 'vitest';
import { shouldResetGamePackageStateBeforeRetry } from '../../features/mobile-packages/useGamePackageState';

describe('shouldResetGamePackageStateBeforeRetry', () => {
    it('校验失败后重试必须保留失败状态，才能触发完整 ZIP 兜底', () => {
        expect(shouldResetGamePackageStateBeforeRetry({
            status: 'failed',
            errorCode: 'checksum-mismatch',
        })).toBe(false);
    });

    it('只有本地临时文件校验失败文字时，也必须保留失败状态', () => {
        expect(shouldResetGamePackageStateBeforeRetry({
            status: 'failed',
            errorCode: undefined,
            errorMessage: '本地临时文件校验失败',
        })).toBe(false);
    });

    it('只有拒绝增量续传文字时，也必须保留失败状态', () => {
        expect(shouldResetGamePackageStateBeforeRetry({
            status: 'failed',
            errorCode: undefined,
            errorMessage: '服务端拒绝增量续传，本地临时文件校验失败',
        })).toBe(false);
    });

    it('非校验失败仍按普通重试清理状态', () => {
        expect(shouldResetGamePackageStateBeforeRetry({
            status: 'failed',
            errorCode: 'network-timeout',
        })).toBe(true);
    });

    it('非失败状态仍按普通流程重置', () => {
        expect(shouldResetGamePackageStateBeforeRetry({
            status: 'not-installed',
            errorCode: undefined,
        })).toBe(true);
    });
});
