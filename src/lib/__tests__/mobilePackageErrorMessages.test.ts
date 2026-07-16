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
    it('把原生增量校验失败转成可执行的完整重下提示并保留详情', () => {
        expect(getGamePackageFailureMessageKey(undefined, '增量文件校验失败: i18n/zh-CN/dicethrone/foo.webp'))
            .toBe('packageManager.incrementalChecksumMismatchHint');
        const message = resolveGamePackageFailureMessage(
            t,
            undefined,
            '增量文件校验失败: i18n/zh-CN/dicethrone/foo.webp',
        );
        expect(message).toContain('packageManager.incrementalChecksumMismatchHint');
        expect(message).toContain('packageManager.errorDetail');
        expect(message).toContain('增量文件校验失败: i18n/zh-CN/dicethrone/foo.webp');
        expect(resolveGamePackageFailureActionLabel(t, undefined, '增量文件校验失败: i18n/zh-CN/dicethrone/foo.webp'))
            .toBe('packageManager.retryFullDownloadAction');
    });

    it('把完整素材包校验失败转成完整包失败提示并保留详情', () => {
        expect(getGamePackageFailureMessageKey('checksum-mismatch', '下载包校验失败，本地临时资源包已清理，将从头重试'))
            .toBe('packageManager.packageChecksumMismatchHint');
        const message = resolveGamePackageFailureMessage(
            t,
            'checksum-mismatch',
            '下载包校验失败，本地临时资源包已清理，将从头重试',
        );
        expect(message).toContain('packageManager.packageChecksumMismatchHint');
        expect(message).toContain('packageManager.errorDetail');
        expect(message).toContain('下载包校验失败，本地临时资源包已清理，将从头重试');
        expect(message).not.toContain('packageManager.incrementalChecksumMismatchHint');
        expect(resolveGamePackageFailureActionLabel(t, 'checksum-mismatch', '下载包校验失败，本地临时资源包已清理，将从头重试'))
            .toBe('packageManager.retryFullDownloadAction');
    });

    it('把服务端拒绝续传转成清理后完整重下提示并保留详情', () => {
        expect(getGamePackageFailureMessageKey('resume-not-supported', '服务端拒绝增量续传，本地临时文件校验失败'))
            .toBe('packageManager.resumeNotSupportedHint');
        const message = resolveGamePackageFailureMessage(
            t,
            'resume-not-supported',
            '服务端拒绝增量续传，本地临时文件校验失败',
        );
        expect(message).toContain('packageManager.resumeNotSupportedHint');
        expect(message).toContain('packageManager.errorDetail');
        expect(message).toContain('服务端拒绝增量续传，本地临时文件校验失败');
        expect(resolveGamePackageFailureActionLabel(t, 'resume-not-supported', '服务端拒绝增量续传，本地临时文件校验失败'))
            .toBe('packageManager.retryFullDownloadAction');
    });

    it('保留普通原生错误的原始说明', () => {
        expect(resolveGamePackageFailureMessage(t, 'unknown', '创建原生安装器超时，请重新发起。'))
            .toBe('创建原生安装器超时，请重新发起。');
    });
});
