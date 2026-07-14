import { HttpException, HttpStatus } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminMobileReleaseService } from '../src/modules/admin/admin-mobile-release.service';

describe('AdminMobileReleaseService', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

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

    it('正式 Android OTA 发布后读取不到线上 latest.json 必须失败', async () => {
        const service = new AdminMobileReleaseService();
        vi.spyOn(service as unknown as { runAndroidRelease(args: string[]): Promise<unknown> }, 'runAndroidRelease').mockResolvedValue({
            exitCode: 0,
            output: 'OTA bundle 已发布',
            parsed: {},
        });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 503,
            json: async () => ({}),
        }));

        await expect(service.publishAndroidOta({
            channel: 'stable',
            dryRun: false,
            forceUpdate: true,
            skipLatest: false,
        })).rejects.toMatchObject({
            status: HttpStatus.SERVICE_UNAVAILABLE,
            response: expect.objectContaining({
                error: 'latest manifest unavailable',
                failure: expect.objectContaining({
                    reason: 'http-error',
                    status: 503,
                }),
                missingFields: ['latest.json'],
            }),
        });
    });

    it('正式 Android 原生更新发布后 latest.json 缺关键字段必须失败', async () => {
        const service = new AdminMobileReleaseService();
        vi.spyOn(service as unknown as { runAndroidRelease(args: string[]): Promise<unknown> }, 'runAndroidRelease').mockResolvedValue({
            exitCode: 0,
            output: 'Android 原生更新已发布',
            parsed: {},
        });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                version: '1.2.3',
                url: 'https://assets.easyboardgame.top/official/native-app-updates/android/stable/app.apk',
            }),
        }));

        await expect(service.publishAndroidNative({
            channel: 'stable',
            dryRun: false,
            forceUpdate: true,
            skipBuild: true,
            skipLatest: false,
        })).rejects.toMatchObject({
            status: HttpStatus.SERVICE_UNAVAILABLE,
            response: expect.objectContaining({
                error: 'latest manifest unavailable',
                failure: null,
                missingFields: ['checksum', 'size'],
            }),
        });
    });

    it('正式 Android OTA 发布后 latest.json 不是 JSON 必须带失败原因', async () => {
        const service = new AdminMobileReleaseService();
        vi.spyOn(service as unknown as { runAndroidRelease(args: string[]): Promise<unknown> }, 'runAndroidRelease').mockResolvedValue({
            exitCode: 0,
            output: 'OTA bundle 已发布',
            parsed: {},
        });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => {
                throw new SyntaxError('Unexpected token < in JSON');
            },
        }));

        await expect(service.publishAndroidOta({
            channel: 'stable',
            dryRun: false,
            forceUpdate: true,
            skipLatest: false,
        })).rejects.toMatchObject({
            status: HttpStatus.SERVICE_UNAVAILABLE,
            response: expect.objectContaining({
                error: 'latest manifest unavailable',
                failure: expect.objectContaining({
                    reason: 'invalid-json',
                    message: 'Unexpected token < in JSON',
                }),
                missingFields: ['latest.json'],
            }),
        });
    });
});
