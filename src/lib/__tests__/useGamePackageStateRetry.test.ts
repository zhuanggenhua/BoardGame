import { describe, expect, it } from 'vitest';
import {
    shouldCleanGamePackageStateBeforeRetry,
    shouldResetGamePackageStateBeforeRetry,
} from '../../features/mobile-packages/useGamePackageState';

describe('shouldResetGamePackageStateBeforeRetry', () => {
    it('校验失败后重试不走普通 reset，而是走清洁重下', () => {
        expect(shouldResetGamePackageStateBeforeRetry({
            status: 'failed',
            errorCode: 'checksum-mismatch',
        })).toBe(false);
        expect(shouldCleanGamePackageStateBeforeRetry({
            status: 'failed',
            errorCode: 'checksum-mismatch',
        })).toBe(true);
    });

    it('只有本地临时文件校验失败文字时，也必须走清洁重下', () => {
        expect(shouldResetGamePackageStateBeforeRetry({
            status: 'failed',
            errorCode: undefined,
            errorMessage: '本地临时文件校验失败',
        })).toBe(false);
        expect(shouldCleanGamePackageStateBeforeRetry({
            status: 'failed',
            errorCode: undefined,
            errorMessage: '本地临时文件校验失败',
        })).toBe(true);
    });

    it('只有拒绝增量续传文字时，也必须走清洁重下', () => {
        expect(shouldResetGamePackageStateBeforeRetry({
            status: 'failed',
            errorCode: undefined,
            errorMessage: '服务端拒绝增量续传，本地临时文件校验失败',
        })).toBe(false);
        expect(shouldCleanGamePackageStateBeforeRetry({
            status: 'failed',
            errorCode: undefined,
            errorMessage: '服务端拒绝增量续传，本地临时文件校验失败',
        })).toBe(true);
    });

    it('非校验失败仍按普通重试清理状态', () => {
        expect(shouldResetGamePackageStateBeforeRetry({
            status: 'failed',
            errorCode: 'network-timeout',
        })).toBe(true);
        expect(shouldCleanGamePackageStateBeforeRetry({
            status: 'failed',
            errorCode: 'network-timeout',
        })).toBe(false);
    });

    it('非失败状态仍按普通流程重置', () => {
        expect(shouldResetGamePackageStateBeforeRetry({
            status: 'not-installed',
            errorCode: undefined,
        })).toBe(true);
        expect(shouldCleanGamePackageStateBeforeRetry({
            status: 'not-installed',
            errorCode: undefined,
        })).toBe(false);
    });
});
