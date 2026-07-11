import { HttpException, HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AdminMobileReleaseService } from '../src/modules/admin/admin-mobile-release.service';

describe('AdminMobileReleaseService', () => {
    it('正式 Android OTA 发布必须拒绝跳过 latest.json', async () => {
        const service = new AdminMobileReleaseService();

        await expect(service.publishAndroidOta({
            channel: 'stable',
            dryRun: false,
            forceUpdate: true,
            skipLatest: true,
        })).rejects.toMatchObject({
            status: HttpStatus.BAD_REQUEST,
            message: '正式 Android OTA 发布禁止跳过 latest.json。手机端依赖 latest.json 发现更新，跳过会导致无法更新。',
        });
    });

    it('正式 Android OTA 发布拒绝跳过 latest.json 时返回 HttpException', async () => {
        const service = new AdminMobileReleaseService();

        await expect(service.publishAndroidOta({
            channel: 'stable',
            dryRun: false,
            forceUpdate: true,
            skipLatest: true,
        })).rejects.toThrow(HttpException);
    });

    it('正式 Android 原生更新发布必须拒绝跳过 latest.json', async () => {
        const service = new AdminMobileReleaseService();

        await expect(service.publishAndroidNative({
            channel: 'stable',
            dryRun: false,
            forceUpdate: true,
            skipBuild: true,
            skipLatest: true,
        })).rejects.toMatchObject({
            status: HttpStatus.BAD_REQUEST,
            message: '正式 Android 原生更新发布禁止跳过 latest.json。手机端依赖 latest.json 发现新版 APK，跳过会导致无法更新。',
        });
    });
});
