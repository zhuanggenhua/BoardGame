import { describe, expect, it } from 'vitest';
import {
    getGamePackageFailureMessageKey,
    resolveGamePackageFailureActionLabel,
    resolveGamePackageFailureMessage,
} from '../../features/mobile-packages/errorMessages';

const t = ((key: string, values?: Record<string, unknown>) => (
    values ? `${key}:${JSON.stringify(values)}` : key
)) as never;

describe('game package failure messages', () => {
    it('把原生增量校验失败转成可执行的完整重下提示', () => {
        expect(getGamePackageFailureMessageKey(undefined, '增量文件校验失败: i18n/zh-CN/dicethrone/foo.webp'))
            .toBe('packageManager.checksumMismatchHint');
        const message = resolveGamePackageFailureMessage(
            t,
            undefined,
            '增量文件校验失败: i18n/zh-CN/dicethrone/foo.webp',
        );
        expect(message).toContain('packageManager.checksumMismatchHint');
        expect(message).not.toContain('packageManager.errorDetail');
        expect(message).not.toContain('增量文件校验失败: i18n/zh-CN/dicethrone/foo.webp');
        expect(resolveGamePackageFailureActionLabel(t, undefined, '增量文件校验失败: i18n/zh-CN/dicethrone/foo.webp'))
            .toBe('packageManager.retryFullDownloadAction');
    });

    it('把服务端拒绝续传转成升级 App 后重下的提示', () => {
        expect(getGamePackageFailureMessageKey('resume-not-supported', '服务端拒绝增量续传，本地临时文件校验失败'))
            .toBe('packageManager.resumeNotSupportedHint');
        const message = resolveGamePackageFailureMessage(
            t,
            'resume-not-supported',
            '服务端拒绝增量续传，本地临时文件校验失败',
        );
        expect(message).toContain('packageManager.resumeNotSupportedHint');
        expect(message).not.toContain('packageManager.errorDetail');
        expect(message).not.toContain('服务端拒绝增量续传，本地临时文件校验失败');
        expect(resolveGamePackageFailureActionLabel(t, 'resume-not-supported', '服务端拒绝增量续传，本地临时文件校验失败'))
            .toBe('packageManager.retryFullDownloadAction');
    });

    it('保留普通原生错误的原始说明', () => {
        expect(resolveGamePackageFailureMessage(t, 'unknown', '创建原生安装器超时，请重新发起。'))
            .toBe('创建原生安装器超时，请重新发起。');
    });
});
