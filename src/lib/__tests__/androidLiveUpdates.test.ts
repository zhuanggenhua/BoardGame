import {
    compareBundleVersion,
    compareVersion,
    isManifestCompatibleWithNativeVersion,
    readAndroidLiveUpdateActivityState,
    readAndroidLiveUpdateConfig,
    requestAndroidLiveUpdateCheck,
    startAndroidLiveUpdateBackgroundCheck,
    subscribeAndroidLiveUpdateActivityState,
} from '../mobile/androidLiveUpdates';
import {
    getSocketIoTransports,
    shouldTryAllSocketTransports,
} from '../socketConnectionConfig';
import {
    fetchAndroidNativeUpdateManifest,
    isAndroidNativeUpdateAvailable,
    readAndroidNativeUpdateConfig,
    resolveAndroidWebAppDownload,
    type AndroidAppInfo,
} from '../mobile/androidNativeUpdates';
import { detectNativeAndroidRuntime } from '../mobile/androidRuntime';
import {
    resolveOtaForceUpdateOptions,
} from '../../../scripts/mobile/ota-publish-config.mjs';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import packageJson from '../../../package.json';
import { beforeEach } from 'vitest';

const currentAppVersion = packageJson.version.replace(/^v/i, '').split('-')[0] || packageJson.version.replace(/^v/i, '');
const currentVersionedApkUrl = `http://8.148.71.102/official/native-app-updates/android/stable/packages/${currentAppVersion}.apk?v=${currentAppVersion}`;

beforeEach(() => {
    Object.defineProperty(window, 'Capacitor', {
        configurable: true,
        value: {
            isNativePlatform: () => true,
            getPlatform: () => 'android',
        },
    });
});

afterEach(() => {
    cleanup();
    delete (window as typeof window & { Capacitor?: unknown }).Capacitor;
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.doUnmock('@capacitor/core');
    vi.doUnmock('../mobile/androidRuntime');
    vi.doUnmock('../mobile/androidLiveUpdates');
    vi.doUnmock('../mobile/androidNativeUpdates');
});

describe('androidLiveUpdates', () => {
    it('读取 OTA 配置时，只有启用且 manifest URL 合法才算开启', () => {
        expect(readAndroidLiveUpdateConfig({
            VITE_ANDROID_OTA_ENABLED: 'true',
            VITE_ANDROID_OTA_MANIFEST_URL: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
            VITE_ANDROID_OTA_CHANNEL: 'stable',
            VITE_ANDROID_OTA_APP_READY_TIMEOUT_MS: '15000',
        })).toEqual({
            enabled: true,
            manifestUrl: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
            manifestUrls: ['https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json'],
            channel: 'stable',
            appReadyTimeoutMs: 15000,
        });

        expect(readAndroidLiveUpdateConfig({
            VITE_ANDROID_OTA_ENABLED: 'true',
            VITE_ANDROID_OTA_MANIFEST_URL: '/relative.json',
        }).enabled).toBe(false);
    });

    it('debug 测试包默认禁用 OTA，即使环境变量显式开启也不生效', () => {
        expect(readAndroidLiveUpdateConfig({
            VITE_ANDROID_OTA_ENABLED: 'true',
            VITE_ANDROID_OTA_MANIFEST_URL: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
            VITE_CAPACITOR_APP_ID: 'top.easyboardgame.app.debug',
        }).enabled).toBe(false);
    });

    it('显式允许 debug 包 OTA 后，测试包才恢复 OTA 能力', () => {
        expect(readAndroidLiveUpdateConfig({
            VITE_ANDROID_OTA_ENABLED: 'true',
            VITE_ANDROID_OTA_MANIFEST_URL: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
            VITE_CAPACITOR_APP_ID: 'top.easyboardgame.app.debug',
            VITE_ANDROID_OTA_ALLOW_DEBUG_APP: 'true',
        }).enabled).toBe(true);
    });

    it('即使只有 CAPACITOR_APP_ID，debug 测试包也必须禁用 OTA', () => {
        expect(readAndroidLiveUpdateConfig({
            VITE_ANDROID_OTA_ENABLED: 'true',
            VITE_ANDROID_OTA_MANIFEST_URL: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
            CAPACITOR_APP_ID: 'top.easyboardgame.app.debug',
        }).enabled).toBe(false);
    });

    it('debug 测试包默认禁用原生更新检查，即使环境变量显式开启也不生效', () => {
        expect(readAndroidNativeUpdateConfig({
            VITE_ANDROID_NATIVE_UPDATE_ENABLED: 'true',
            VITE_ANDROID_NATIVE_UPDATE_MANIFEST_URL: 'https://assets.easyboardgame.top/official/native-app-updates/android/stable/latest.json',
            VITE_CAPACITOR_APP_ID: 'top.easyboardgame.app.debug',
        }).enabled).toBe(false);
    });

    it('显式允许 debug 包原生更新后，测试包才恢复原生更新能力', () => {
        expect(readAndroidNativeUpdateConfig({
            VITE_ANDROID_NATIVE_UPDATE_ENABLED: 'true',
            VITE_ANDROID_NATIVE_UPDATE_MANIFEST_URL: 'https://assets.easyboardgame.top/official/native-app-updates/android/stable/latest.json',
            VITE_CAPACITOR_APP_ID: 'top.easyboardgame.app.debug',
            VITE_ANDROID_NATIVE_UPDATE_ALLOW_DEBUG_APP: 'true',
        }).enabled).toBe(true);
    });

    it('即使只有 CAPACITOR_APP_ID，debug 测试包也必须禁用原生更新检查', () => {
        expect(readAndroidNativeUpdateConfig({
            VITE_ANDROID_NATIVE_UPDATE_ENABLED: 'true',
            VITE_ANDROID_NATIVE_UPDATE_MANIFEST_URL: 'https://assets.easyboardgame.top/official/native-app-updates/android/stable/latest.json',
            CAPACITOR_APP_ID: 'top.easyboardgame.app.debug',
        }).enabled).toBe(false);
    });

    it('网页端下载入口优先解析 native update latest.json 中的 APK 地址', async () => {
        const result = await resolveAndroidWebAppDownload({
            VITE_ANDROID_NATIVE_UPDATE_MANIFEST_URL: 'https://assets.easyboardgame.top/official/native-app-updates/android/stable/latest.json',
        }, vi.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => ({
                version: '0.5.1',
                url: 'https://assets.easyboardgame.top/official/native-app-updates/android/stable/packages/0.5.1.apk',
                checksum: 'abc123',
            }),
        } as Response)));

        expect(result).toEqual({
            url: 'https://assets.easyboardgame.top/official/native-app-updates/android/stable/packages/0.5.1.apk?v=abc123',
            source: 'manifest',
        });
    });

    it('latest.json 不可用时，网页端下载入口回退到显式 APK 直链', async () => {
        const result = await resolveAndroidWebAppDownload({
            VITE_ANDROID_NATIVE_UPDATE_MANIFEST_URL: 'https://assets.easyboardgame.top/official/native-app-updates/android/stable/latest.json',
            VITE_ANDROID_APP_DOWNLOAD_URL: 'https://assets.easyboardgame.top/official/native-app-updates/android/stable/packages/manual.apk',
        }, vi.fn(async () => ({
            ok: false,
            status: 503,
            json: async () => ({}),
        } as Response)));

        expect(result).toEqual({
            url: currentVersionedApkUrl,
            source: 'versioned',
        });
    });

    it('网页端下载入口在未显式配置时默认回退到官方 stable manifest', async () => {
        const result = await resolveAndroidWebAppDownload({}, vi.fn(async (input) => ({
            ok: true,
            status: 200,
            json: async () => ({
                version: '0.5.2',
                url: String(input).replace('latest.json', 'packages/0.5.2.apk'),
                publishedAt: '2026-05-23T02:00:05.837Z',
            }),
        } as Response)));

        expect(result).toEqual({
            url: 'https://assets.easyboardgame.top/official/native-app-updates/android/stable/packages/0.5.2.apk?v=2026-05-23T02%3A00%3A05.837Z',
            source: 'manifest',
        });
    });

    it('manifest 不可用时，网页端下载入口按当前站点版本兜底到对应 APK', async () => {
        const result = await resolveAndroidWebAppDownload({
            VITE_ANDROID_NATIVE_UPDATE_MANIFEST_URL: 'https://assets.easyboardgame.top/official/native-app-updates/android/stable/latest.json',
        }, vi.fn(async () => ({
            ok: false,
            status: 503,
            json: async () => ({}),
        } as Response)));

        expect(result).toEqual({
            url: currentVersionedApkUrl,
            source: 'versioned',
        });
    });

    it('默认 manifest 也不可用且没有 APK 直链时，网页端下载入口返回 manifest-unavailable', async () => {
        const result = await resolveAndroidWebAppDownload({}, vi.fn(async () => ({
            ok: false,
            status: 404,
            json: async () => ({}),
        } as Response)));

        expect(result).toEqual({
            url: currentVersionedApkUrl,
            source: 'versioned',
        });
    });

    it('网页登录下载入口读取不到 latest.json 时仍允许回退下载', async () => {
        const manifest = await fetchAndroidNativeUpdateManifest(
            'https://assets.easyboardgame.top/official/native-app-updates/android/stable/latest.json',
            vi.fn(async () => ({
                ok: false,
                status: 404,
                json: async () => ({}),
            } as Response)),
        );

        expect(manifest).toBeNull();
    });

    it('手机内原生更新检查读取不到 latest.json 时必须抛错', async () => {
        vi.resetModules();
        vi.stubEnv('VITE_ANDROID_NATIVE_UPDATE_ENABLED', 'true');
        vi.stubEnv('VITE_ANDROID_NATIVE_UPDATE_MANIFEST_URL', 'https://assets.easyboardgame.top/official/native-app-updates/android/stable/latest.json');
        vi.stubEnv('VITE_CAPACITOR_APP_ID', 'top.easyboardgame.app');
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: false,
            status: 404,
            json: async () => ({}),
        } as Response)));

        vi.doMock('@capacitor/core', async (importOriginal) => {
            const actual = await importOriginal<typeof import('@capacitor/core')>();
            return {
                ...actual,
                registerPlugin: vi.fn(() => ({
                    getAppInfo: vi.fn().mockResolvedValue({
                        packageName: 'top.easyboardgame.app',
                        versionName: '0.5.0',
                        versionCode: 500,
                        canRequestPackageInstalls: true,
                    }),
                })),
            };
        });
        vi.doMock('../mobile/androidRuntime', async (importOriginal) => {
            const actual = await importOriginal<typeof import('../mobile/androidRuntime')>();
            return {
                ...actual,
                isNativeAndroidRuntime: () => true,
            };
        });

        const {
            checkAndroidNativeUpdateAvailability: checkAvailability,
        } = await import('../mobile/androidNativeUpdates');

        await expect(checkAvailability()).rejects.toThrow(
            '原生更新清单读取失败，已尝试 2 个入口',
        );
    });

    it('版本比较按数值段处理', () => {
        expect(compareVersion('1.2.0', '1.1.9')).toBe(1);
        expect(compareVersion('1.2.0', '1.2.0')).toBe(0);
        expect(compareVersion('1.2.0', '1.2.1')).toBe(-1);
        expect(compareVersion('1.2.0+20260329', '1.2.0')).toBe(0);
    });

    it('bundle 版本比较会阻止旧基线 OTA 覆盖更新原生壳或较新的同基线 OTA', () => {
        expect(compareBundleVersion('0.5.8-ota-2026-05-23T01-00-00-000Z', '0.5.8')).toBe(1);
        expect(compareBundleVersion('0.5.7-ota-2026-05-23T01-00-00-000Z', '0.5.8')).toBe(-1);
        expect(compareBundleVersion('0.5.61-ota-2026-05-23T01-00-00-000Z', '0.5.61-ota-2026-05-23T00-28-30-595Z')).toBe(1);
        expect(compareBundleVersion('0.5.61-ota-2026-05-23T00-28-30-595Z', '0.5.61-ota-2026-05-23T01-00-00-000Z')).toBe(-1);
    });

    it('读取原生已准备更新状态时保留结构化错误码', async () => {
        vi.resetModules();

        vi.doMock('@capacitor/core', async (importOriginal) => {
            const actual = await importOriginal<typeof import('@capacitor/core')>();
            return {
                ...actual,
                registerPlugin: vi.fn(() => ({
                    getPreparedUpdateState: vi.fn().mockResolvedValue({
                        exists: true,
                        version: '0.5.2',
                        status: 'error',
                        errorCode: 'checksum-mismatch',
                        errorMessage: '更新包校验失败，请重新下载',
                        updatedAt: 123456,
                    }),
                })),
            };
        });
        vi.doMock('../mobile/androidRuntime', async (importOriginal) => {
            const actual = await importOriginal<typeof import('../mobile/androidRuntime')>();
            return {
                ...actual,
                isNativeAndroidRuntime: () => true,
            };
        });

        const {
            mapNativeUpdateEventToState,
            readPreparedAndroidUpdateState,
        } = await import('../mobile/androidNativeUpdates');

        const preparedState = await readPreparedAndroidUpdateState('0.5.2');
        expect(preparedState).toMatchObject({
            version: '0.5.2',
            status: 'error',
            errorCode: 'checksum-mismatch',
            errorMessage: '更新包校验失败，请重新下载',
        });

        expect(mapNativeUpdateEventToState(preparedState!, { blocking: true })).toMatchObject({
            phase: 'error',
            blocking: true,
            errorCode: 'checksum-mismatch',
            reason: '更新包校验失败，请重新下载',
        });
    });

    it('原生 AppUpdate 插件在旧 Android 壳缺失时，订阅更新状态应静默降级而不是抛出未处理拒绝', async () => {
        vi.resetModules();

        const addListenerMock = vi.fn().mockRejectedValue(
            new Error('"AppUpdate" plugin is not implemented on android'),
        );

        vi.doMock('@capacitor/core', async (importOriginal) => {
            const actual = await importOriginal<typeof import('@capacitor/core')>();
            return {
                ...actual,
                registerPlugin: vi.fn(() => ({
                    addListener: addListenerMock,
                })),
            };
        });
        vi.doMock('../mobile/androidRuntime', async (importOriginal) => {
            const actual = await importOriginal<typeof import('../mobile/androidRuntime')>();
            return {
                ...actual,
                isNativeAndroidRuntime: () => true,
            };
        });

        const {
            subscribeAndroidNativeUpdateState,
        } = await import('../mobile/androidNativeUpdates');

        await expect(
            subscribeAndroidNativeUpdateState(() => undefined),
        ).resolves.toBeNull();
        expect(addListenerMock).toHaveBeenCalledWith('updateStateChanged', expect.any(Function));
    });

    it('旧 Android 壳缺少 CapacitorUpdater 插件时，注册 OTA 监听应静默降级而不是抛出未处理拒绝', async () => {
        vi.resetModules();

        const addListenerMock = vi.fn().mockRejectedValue(
            new Error('"CapacitorUpdater" plugin is not implemented on android'),
        );

        vi.doMock('@capacitor/core', () => ({
            Capacitor: {
                isNativePlatform: () => true,
                getPlatform: () => 'android',
            },
            registerPlugin: vi.fn(() => ({})),
        }));
        vi.doMock('@capgo/capacitor-updater', () => ({
            CapacitorUpdater: {
                notifyAppReady: vi.fn(),
                current: vi.fn(),
                list: vi.fn(),
                download: vi.fn(),
                next: vi.fn(),
                set: vi.fn(),
                reload: vi.fn(),
                setMultiDelay: vi.fn(),
                addListener: addListenerMock,
            },
        }));

        const { registerAndroidLiveUpdateListeners } = await import('../mobile/androidLiveUpdates');
        const result = await registerAndroidLiveUpdateListeners();

        expect(result).toBeNull();
        expect(addListenerMock).toHaveBeenCalledWith('download', expect.any(Function));
    });

    it('旧 Android 壳缺少 CapacitorUpdater 插件时，读取 OTA 快照应回退成 updaterLoaded=false', async () => {
        vi.resetModules();

        vi.doMock('@capacitor/core', () => ({
            Capacitor: {
                isNativePlatform: () => true,
                getPlatform: () => 'android',
            },
            registerPlugin: vi.fn(() => ({})),
        }));
        vi.doMock('@capgo/capacitor-updater', () => ({
            CapacitorUpdater: {
                notifyAppReady: vi.fn(),
                current: vi.fn().mockRejectedValue(
                    new Error('"CapacitorUpdater" plugin is not implemented on android'),
                ),
                list: vi.fn(),
                download: vi.fn(),
                next: vi.fn(),
                set: vi.fn(),
                reload: vi.fn(),
                setMultiDelay: vi.fn(),
                addListener: vi.fn(),
            },
        }));

        const { readAndroidLiveUpdateSnapshot } = await import('../mobile/androidLiveUpdates');
        const snapshot = await readAndroidLiveUpdateSnapshot({
            includeManifest: false,
            envOverride: {
                VITE_ANDROID_OTA_ENABLED: 'true',
                VITE_ANDROID_OTA_MANIFEST_URL: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
                VITE_ANDROID_OTA_CHANNEL: 'stable',
            },
        });

        expect(snapshot).toMatchObject({
            enabled: true,
            nativeAndroid: true,
            updaterLoaded: false,
        });
    });

    it('读取 OTA 快照时会保留用户可见更新号', async () => {
        vi.resetModules();

        vi.doMock('@capacitor/core', () => ({
            Capacitor: {
                isNativePlatform: () => true,
                getPlatform: () => 'android',
            },
            registerPlugin: vi.fn(() => ({})),
        }));
        vi.doMock('@capgo/capacitor-updater', () => ({
            CapacitorUpdater: {
                notifyAppReady: vi.fn(),
                current: vi.fn().mockResolvedValue({
                    native: '0.6.4',
                    bundle: {
                        id: 'bundle-current',
                        version: '6.0.0-ota-2026-07-12T02-09-07-688Z',
                        downloaded: '2026-07-12T02:10:17.804Z',
                        checksum: 'abc',
                        status: 'success',
                    },
                }),
                list: vi.fn(),
                download: vi.fn(),
                next: vi.fn(),
                set: vi.fn(),
                reload: vi.fn(),
                setMultiDelay: vi.fn(),
                addListener: vi.fn(),
            },
        }));
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: {
                get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
            },
            json: async () => ({
                version: '6.0.0-ota-2026-07-12T02-09-07-688Z',
                displayVersion: '600',
                productVersion: '0.6.4',
                url: 'https://assets.easyboardgame.top/official/app-updates/android/stable/bundles/6.0.0-ota-2026-07-12T02-09-07-688Z.zip',
                checksum: 'abc',
                channel: 'stable',
                forceUpdate: true,
            }),
        }));

        const { readAndroidLiveUpdateSnapshot } = await import('../mobile/androidLiveUpdates');
        const snapshot = await readAndroidLiveUpdateSnapshot({
            includeManifest: true,
            envOverride: {
                VITE_ANDROID_OTA_ENABLED: 'true',
                VITE_ANDROID_OTA_MANIFEST_URL: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
                VITE_ANDROID_OTA_CHANNEL: 'stable',
            },
        });

        expect(snapshot).toMatchObject({
            currentBundleVersion: '6.0.0-ota-2026-07-12T02-09-07-688Z',
            currentDisplayVersion: '600',
            manifestVersion: '6.0.0-ota-2026-07-12T02-09-07-688Z',
            manifestDisplayVersion: '600',
            manifestProductVersion: '0.6.4',
        });
    });

    it('读取 OTA 快照时主清单失败后会使用 IP 兜底清单', async () => {
        vi.resetModules();

        vi.doMock('@capacitor/core', () => ({
            Capacitor: {
                isNativePlatform: () => true,
                getPlatform: () => 'android',
            },
            registerPlugin: vi.fn(() => ({})),
        }));
        vi.doMock('@capgo/capacitor-updater', () => ({
            CapacitorUpdater: {
                notifyAppReady: vi.fn(),
                current: vi.fn().mockResolvedValue({
                    native: '0.6.4',
                    bundle: {
                        id: 'bundle-current',
                        version: '6.0.0-ota-2026-08-14T13-26-06-707Z',
                        downloaded: '2026-08-14T13:30:00.000Z',
                        checksum: 'old',
                        status: 'success',
                    },
                }),
                list: vi.fn(),
                download: vi.fn(),
                next: vi.fn(),
                set: vi.fn(),
                reload: vi.fn(),
                setMultiDelay: vi.fn(),
                addListener: vi.fn(),
            },
        }));
        const primaryManifestUrl = 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json';
        const fallbackManifestUrl = 'http://8.148.71.102/official/app-updates/android/stable/latest.json';
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.startsWith(primaryManifestUrl)) {
                return new Response('unavailable', { status: 503 });
            }
            if (url.startsWith(fallbackManifestUrl)) {
                return new Response(JSON.stringify({
                    version: '6.0.0-ota-2026-08-15T10-48-13-358Z',
                    displayVersion: '665',
                    productVersion: '0.6.4',
                    url: 'http://8.148.71.102/official/app-updates/android/stable/bundles/6.0.0-ota-2026-08-15T10-48-13-358Z.zip',
                    checksum: 'new',
                    channel: 'stable',
                    forceUpdate: true,
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            return new Response('unexpected', { status: 500 });
        });
        vi.stubGlobal('fetch', fetchMock);

        const { readAndroidLiveUpdateSnapshot } = await import('../mobile/androidLiveUpdates');
        const snapshot = await readAndroidLiveUpdateSnapshot({
            includeManifest: true,
            envOverride: {
                VITE_ANDROID_OTA_ENABLED: 'true',
                VITE_ANDROID_OTA_MANIFEST_URL: primaryManifestUrl,
                VITE_ANDROID_OTA_MANIFEST_FALLBACK_URLS: fallbackManifestUrl,
                VITE_ANDROID_OTA_CHANNEL: 'stable',
            },
        });

        expect(snapshot).toMatchObject({
            manifestUrl: fallbackManifestUrl,
            manifestVersion: '6.0.0-ota-2026-08-15T10-48-13-358Z',
            manifestDisplayVersion: '665',
        });
        expect(fetchMock.mock.calls.map(([input]) => String(input).split('?')[0])).toEqual([
            primaryManifestUrl,
            fallbackManifestUrl,
        ]);
    });

    it('manifest 兼容性支持 targetNativeVersion 精确命中', () => {
        expect(isManifestCompatibleWithNativeVersion({
            version: '0.5.0-ota.1',
            url: 'https://example.com/bundle.zip',
            targetNativeVersion: '0.5.0',
        }, '0.5.0')).toMatchObject({
            compatible: true,
            reason: 'manifest 包含原生版本门禁字段，已按规则忽略',
        });

        expect(isManifestCompatibleWithNativeVersion({
            version: '0.5.0-ota.1',
            url: 'https://example.com/bundle.zip',
            targetNativeVersion: ['0.5.0', '0.5.1'],
        }, '0.5.2')).toMatchObject({
            compatible: true,
            reason: 'manifest 包含原生版本门禁字段，已按规则忽略',
        });
    });

    it('manifest 兼容性支持 min/max nativeVersion 门控', () => {
        expect(isManifestCompatibleWithNativeVersion({
            version: '0.5.0-ota.1',
            url: 'https://example.com/bundle.zip',
            minNativeVersion: '0.5.0',
            maxNativeVersion: '0.5.9',
        }, '0.5.3')).toMatchObject({
            compatible: true,
            reason: 'manifest 包含原生版本门禁字段，已按规则忽略',
        });

        expect(isManifestCompatibleWithNativeVersion({
            version: '0.5.0-ota.1',
            url: 'https://example.com/bundle.zip',
            minNativeVersion: '0.5.4',
        }, '0.5.3')).toMatchObject({
            compatible: true,
            reason: 'manifest 包含原生版本门禁字段，已按规则忽略',
        });

        expect(isManifestCompatibleWithNativeVersion({
            version: '0.5.0-ota.1',
            url: 'https://example.com/bundle.zip',
            maxNativeVersion: '0.5.2',
        }, '0.5.3')).toMatchObject({
            compatible: true,
            reason: 'manifest 包含原生版本门禁字段，已按规则忽略',
        });
    });

    it('OTA 发布默认强制更新并写入默认文案', () => {
        expect(resolveOtaForceUpdateOptions()).toEqual({
            forceUpdate: true,
            forceUpdateTitle: '正在更新',
            forceUpdateMessage: '正在下载必要更新，请稍候',
        });
    });

    it('OTA 发布允许覆盖强更文案', () => {
        expect(resolveOtaForceUpdateOptions({
            forceUpdateTitle: '自定义标题',
            forceUpdateMessage: '自定义正文',
        })).toEqual({
            forceUpdate: true,
            forceUpdateTitle: '自定义标题',
            forceUpdateMessage: '自定义正文',
        });
    });

    it('OTA 发布禁止显式关闭强制更新', () => {
        expect(() => resolveOtaForceUpdateOptions({
            noForceUpdateFlag: true,
        })).toThrow('所有 OTA 已强制更新，禁止使用 --no-force-update。');
    });

    it('即时 OTA 请求没有订阅管理器时也必须自跑并退出 checking 活动态', async () => {
        const states: string[] = [];
        const unsubscribe = subscribeAndroidLiveUpdateActivityState((state) => {
            states.push(`${state.active}:${state.phase}`);
        });

        requestAndroidLiveUpdateCheck({
            interactive: true,
            applyMode: 'immediate',
        });

        await waitFor(() => {
            expect(readAndroidLiveUpdateActivityState()).toMatchObject({
                active: false,
                phase: 'idle',
            });
        });

        unsubscribe();

        expect(states).toContain('true:checking');
    });

    it('真正开始即时 OTA 检查时可直接把首帧切到 downloading 活动态', async () => {
        const states: string[] = [];
        const unsubscribe = subscribeAndroidLiveUpdateActivityState((state) => {
            states.push(`${state.active}:${state.phase}`);
        });

        await startAndroidLiveUpdateBackgroundCheck({
            applyMode: 'immediate',
            initialImmediatePhase: 'downloading',
            envOverride: {
                VITE_ANDROID_OTA_ENABLED: 'false',
                VITE_ANDROID_OTA_MANIFEST_URL: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
            },
        });

        unsubscribe();

        expect(states).toContain('true:downloading');
        expect(readAndroidLiveUpdateActivityState()).toMatchObject({
            active: false,
            phase: 'idle',
        });
    });

    it('强制 OTA manifest 若当前 bundle 已是最新版，不应先闪出 blocking gate', async () => {
        vi.resetModules();
        vi.stubEnv('VITE_ANDROID_OTA_ENABLED', 'true');
        vi.stubEnv('VITE_ANDROID_OTA_MANIFEST_URL', 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json');
        vi.stubEnv('VITE_ANDROID_OTA_CHANNEL', 'stable');
        vi.stubEnv('VITE_ANDROID_OTA_APP_READY_TIMEOUT_MS', '15000');

        vi.doMock('@capacitor/core', () => ({
            Capacitor: {
                isNativePlatform: () => true,
                getPlatform: () => 'android',
            },
            registerPlugin: vi.fn(() => ({})),
        }));

        const currentMock = vi.fn().mockResolvedValue({
            native: '0.5.1',
            bundle: {
                id: 'bundle-current',
                version: '0.5.1-ota-2026-04-04T03-34-46-472Z',
                downloaded: '2026-04-04T03:40:00.000Z',
                checksum: 'abc',
                status: 'success',
            },
        });

        vi.doMock('@capgo/capacitor-updater', () => ({
            CapacitorUpdater: {
                notifyAppReady: vi.fn(),
                current: currentMock,
                list: vi.fn(),
                download: vi.fn(),
                next: vi.fn(),
                set: vi.fn(),
                reload: vi.fn(),
                setMultiDelay: vi.fn(),
                addListener: vi.fn(async () => ({ remove: async () => undefined })),
            },
        }));

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: {
                get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
            },
            json: async () => ({
                version: '0.5.1-ota-2026-04-04T03-34-46-472Z',
                url: 'https://assets.easyboardgame.top/official/app-updates/android/stable/bundles/0.5.1-ota-2026-04-04T03-34-46-472Z.zip',
                checksum: 'abc',
                channel: 'stable',
                forceUpdate: true,
                forceUpdateTitle: '正在更新',
                forceUpdateMessage: '正在下载必要更新，请稍候',
            }),
        }));

        const { startAndroidLiveUpdateBackgroundCheck } = await import('../mobile/androidLiveUpdates');
        const states: Array<{ phase: string; blocking: boolean }> = [];

        const result = await startAndroidLiveUpdateBackgroundCheck({
            force: true,
            envOverride: {
                VITE_ANDROID_OTA_ENABLED: 'true',
                VITE_ANDROID_OTA_MANIFEST_URL: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
                VITE_ANDROID_OTA_CHANNEL: 'stable',
                VITE_ANDROID_OTA_APP_READY_TIMEOUT_MS: '15000',
            },
            onForceStateChange: (state) => {
                states.push({ phase: state.phase, blocking: state.blocking });
            },
        });

        expect(result).toEqual({ status: 'up-to-date' });
        expect(currentMock).toHaveBeenCalledTimes(1);
        expect(states.some((state) => state.blocking)).toBe(false);
    });

    it('OTA 清单读取失败时必须返回显式错误并显示阻塞错误态', async () => {
        vi.resetModules();

        vi.doMock('@capacitor/core', () => ({
            Capacitor: {
                isNativePlatform: () => true,
                getPlatform: () => 'android',
            },
            registerPlugin: vi.fn(() => ({})),
        }));

        const currentMock = vi.fn();
        vi.doMock('@capgo/capacitor-updater', () => ({
            CapacitorUpdater: {
                notifyAppReady: vi.fn(),
                current: currentMock,
                list: vi.fn(),
                download: vi.fn(),
                next: vi.fn(),
                set: vi.fn(),
                reload: vi.fn(),
                setMultiDelay: vi.fn(),
                addListener: vi.fn(async () => ({ remove: async () => undefined })),
            },
        }));

        const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
        vi.stubGlobal('fetch', fetchMock);

        const { startAndroidLiveUpdateBackgroundCheck } = await import('../mobile/androidLiveUpdates');
        const states: Array<{ phase: string; blocking: boolean; reason?: string }> = [];

        const result = await startAndroidLiveUpdateBackgroundCheck({
            force: true,
            envOverride: {
                VITE_ANDROID_OTA_ENABLED: 'true',
                VITE_ANDROID_OTA_MANIFEST_URL: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
                VITE_ANDROID_OTA_CHANNEL: 'stable',
                VITE_ANDROID_OTA_APP_READY_TIMEOUT_MS: '15000',
            },
            onForceStateChange: (state) => {
                states.push({
                    phase: state.phase,
                    blocking: state.blocking,
                    reason: state.reason,
                });
            },
        });

        expect(result).toEqual({
            status: 'error',
            reason: 'OTA 清单读取失败：已尝试 1 个清单入口均失败：https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json: Failed to fetch',
        });
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json?ota-check='),
            expect.objectContaining({
                method: 'GET',
                headers: { Accept: 'application/json' },
            }),
        );
        expect(currentMock).not.toHaveBeenCalled();
        expect(states).toContainEqual({
            phase: 'error',
            blocking: true,
            reason: 'OTA 清单读取失败：已尝试 1 个清单入口均失败：https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json: Failed to fetch',
        });
    });

    it('OTA 清单不存在时必须返回显式错误并显示阻塞错误态', async () => {
        vi.resetModules();

        vi.doMock('@capacitor/core', () => ({
            Capacitor: {
                isNativePlatform: () => true,
                getPlatform: () => 'android',
            },
            registerPlugin: vi.fn(() => ({})),
        }));

        const currentMock = vi.fn();
        vi.doMock('@capgo/capacitor-updater', () => ({
            CapacitorUpdater: {
                notifyAppReady: vi.fn(),
                current: currentMock,
                list: vi.fn(),
                download: vi.fn(),
                next: vi.fn(),
                set: vi.fn(),
                reload: vi.fn(),
                setMultiDelay: vi.fn(),
                addListener: vi.fn(async () => ({ remove: async () => undefined })),
            },
        }));

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            status: 404,
            ok: false,
            headers: {
                get: () => null,
            },
            json: vi.fn(),
        }));

        const { startAndroidLiveUpdateBackgroundCheck } = await import('../mobile/androidLiveUpdates');
        const states: Array<{ phase: string; blocking: boolean; reason?: string }> = [];

        const result = await startAndroidLiveUpdateBackgroundCheck({
            envOverride: {
                VITE_ANDROID_OTA_ENABLED: 'true',
                VITE_ANDROID_OTA_MANIFEST_URL: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
                VITE_ANDROID_OTA_CHANNEL: 'stable',
                VITE_ANDROID_OTA_APP_READY_TIMEOUT_MS: '15000',
            },
            onForceStateChange: (state) => {
                states.push({
                    phase: state.phase,
                    blocking: state.blocking,
                    reason: state.reason,
                });
            },
        });

        expect(result).toEqual({
            status: 'error',
            reason: 'OTA 清单不存在：已尝试 1 个清单入口均失败：https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json: 404 https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
        });
        expect(currentMock).not.toHaveBeenCalled();
        expect(states).toContainEqual({
            phase: 'error',
            blocking: true,
            reason: 'OTA 清单不存在：已尝试 1 个清单入口均失败：https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json: 404 https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
        });
    });

    it('后台 OTA 检查遇到更老基线的 latest manifest 时，必须视为已是最新而不是回退下载', async () => {
        vi.resetModules();
        vi.stubEnv('VITE_ANDROID_OTA_ENABLED', 'true');
        vi.stubEnv('VITE_ANDROID_OTA_MANIFEST_URL', 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json');
        vi.stubEnv('VITE_ANDROID_OTA_CHANNEL', 'stable');
        vi.stubEnv('VITE_ANDROID_OTA_APP_READY_TIMEOUT_MS', '15000');

        vi.doMock('@capacitor/core', () => ({
            Capacitor: {
                isNativePlatform: () => true,
                getPlatform: () => 'android',
            },
            registerPlugin: vi.fn(() => ({})),
        }));

        const currentMock = vi.fn().mockResolvedValue({
            native: '0.5.8',
            bundle: {
                id: 'builtin',
                version: '0.5.8',
                downloaded: '1970-01-01T00:00:00.000Z',
                checksum: '',
                status: 'success',
            },
        });
        const listMock = vi.fn();
        const downloadMock = vi.fn();

        vi.doMock('@capgo/capacitor-updater', () => ({
            CapacitorUpdater: {
                notifyAppReady: vi.fn(),
                current: currentMock,
                list: listMock,
                download: downloadMock,
                next: vi.fn(),
                set: vi.fn(),
                reload: vi.fn(),
                setMultiDelay: vi.fn(),
                addListener: vi.fn(async () => ({ remove: async () => undefined })),
            },
        }));

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: {
                get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
            },
            json: async () => ({
                version: '0.5.7-ota-2026-05-23T00-28-30-595Z',
                url: 'https://assets.easyboardgame.top/official/app-updates/android/stable/bundles/0.5.7-ota-2026-05-23T00-28-30-595Z.zip',
                checksum: 'abc',
                channel: 'stable',
            }),
        }));

        const { startAndroidLiveUpdateBackgroundCheck } = await import('../mobile/androidLiveUpdates');

        const result = await startAndroidLiveUpdateBackgroundCheck({
            force: true,
            envOverride: {
                VITE_ANDROID_OTA_ENABLED: 'true',
                VITE_ANDROID_OTA_MANIFEST_URL: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
                VITE_ANDROID_OTA_CHANNEL: 'stable',
                VITE_ANDROID_OTA_APP_READY_TIMEOUT_MS: '15000',
            },
        });

        expect(result).toEqual({ status: 'up-to-date' });
        expect(currentMock).toHaveBeenCalledTimes(1);
        expect(listMock).not.toHaveBeenCalled();
        expect(downloadMock).not.toHaveBeenCalled();
    });

    it('后台 OTA 检查遇到当前 bundle 版本号偏大时，应通过更高内部游标桥接更新', async () => {
        vi.resetModules();
        vi.stubEnv('VITE_ANDROID_OTA_ENABLED', 'true');
        vi.stubEnv('VITE_ANDROID_OTA_MANIFEST_URL', 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json');
        vi.stubEnv('VITE_ANDROID_OTA_CHANNEL', 'stable');
        vi.stubEnv('VITE_ANDROID_OTA_APP_READY_TIMEOUT_MS', '15000');

        vi.doMock('@capacitor/core', () => ({
            Capacitor: {
                isNativePlatform: () => true,
                getPlatform: () => 'android',
            },
            registerPlugin: vi.fn(() => ({})),
        }));

        const currentMock = vi.fn().mockResolvedValue({
            native: '0.6.0',
            bundle: {
                id: 'bad-version-bundle',
                version: '5.9.0',
                downloaded: '2026-06-15T00:00:00.000Z',
                checksum: 'old',
                status: 'success',
            },
        });
        const listMock = vi.fn().mockResolvedValue({ bundles: [] });
        const downloadMock = vi.fn().mockResolvedValue({
            id: 'bundle-next',
            version: '6.0.0-ota-bridge-2026-06-16T01-22-25-293Z',
            downloaded: '2026-06-16T01:23:00.000Z',
            checksum: 'new',
            status: 'success',
        });
        const nextMock = vi.fn().mockResolvedValue(undefined);
        const setMultiDelayMock = vi.fn().mockResolvedValue(undefined);

        vi.doMock('@capgo/capacitor-updater', () => ({
            CapacitorUpdater: {
                notifyAppReady: vi.fn(),
                current: currentMock,
                list: listMock,
                download: downloadMock,
                next: nextMock,
                set: vi.fn(),
                reload: vi.fn(),
                setMultiDelay: setMultiDelayMock,
                addListener: vi.fn(async () => ({ remove: async () => undefined })),
            },
        }));

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: {
                get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
            },
            json: async () => ({
                version: '6.0.0-ota-bridge-2026-06-16T01-22-25-293Z',
                url: 'https://assets.easyboardgame.top/official/app-updates/android/stable/bundles/6.0.0-ota-bridge-2026-06-16T01-22-25-293Z.zip',
                checksum: 'new',
                channel: 'stable',
                publishedAt: '2026-06-16T01:22:26.114Z',
            }),
        }));

        const { startAndroidLiveUpdateBackgroundCheck } = await import('../mobile/androidLiveUpdates');

        const result = await startAndroidLiveUpdateBackgroundCheck({
            force: true,
            envOverride: {
                VITE_ANDROID_OTA_ENABLED: 'true',
                VITE_ANDROID_OTA_MANIFEST_URL: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
                VITE_ANDROID_OTA_CHANNEL: 'stable',
                VITE_ANDROID_OTA_APP_READY_TIMEOUT_MS: '15000',
            },
        });

        expect(result).toEqual({
            status: 'queued',
            version: '6.0.0-ota-bridge-2026-06-16T01-22-25-293Z',
            source: 'downloaded',
            mode: 'background',
        });
        expect(currentMock).toHaveBeenCalledTimes(1);
        expect(listMock).toHaveBeenCalledTimes(1);
        expect(downloadMock).toHaveBeenCalledWith({
            url: 'https://assets.easyboardgame.top/official/app-updates/android/stable/bundles/6.0.0-ota-bridge-2026-06-16T01-22-25-293Z.zip',
            version: '6.0.0-ota-bridge-2026-06-16T01-22-25-293Z',
            checksum: 'new',
        });
        expect(nextMock).toHaveBeenCalledWith({ id: 'bundle-next' });
        expect(setMultiDelayMock).toHaveBeenCalledWith({
            delayConditions: [{ kind: 'background', value: '0' }],
        });
    });

    it('强制 OTA manifest 若发现新版本，后台检查也必须立即阻塞应用', async () => {
        vi.resetModules();

        vi.doMock('@capacitor/core', () => ({
            Capacitor: {
                isNativePlatform: () => true,
                getPlatform: () => 'android',
            },
            registerPlugin: vi.fn(() => ({})),
        }));

        const currentMock = vi.fn().mockResolvedValue({
            native: '0.5.1',
            bundle: {
                id: 'bundle-current',
                version: '0.5.1-ota-2026-04-04T03-00-00-000Z',
                downloaded: '2026-04-04T03:10:00.000Z',
                checksum: 'old',
                status: 'success',
            },
        });
        const listMock = vi.fn().mockResolvedValue({ bundles: [] });
        const downloadMock = vi.fn().mockResolvedValue({
            id: 'bundle-next',
            version: '0.5.1-ota-2026-04-04T03-34-46-472Z',
            downloaded: '2026-04-04T03:45:00.000Z',
            checksum: 'new',
            status: 'success',
        });
        const setMultiDelayMock = vi.fn().mockResolvedValue(undefined);
        const nextMock = vi.fn().mockResolvedValue(undefined);
        const setMock = vi.fn().mockResolvedValue(undefined);

        vi.doMock('@capgo/capacitor-updater', () => ({
            CapacitorUpdater: {
                notifyAppReady: vi.fn(),
                current: currentMock,
                list: listMock,
                download: downloadMock,
                next: nextMock,
                set: setMock,
                reload: vi.fn(),
                setMultiDelay: setMultiDelayMock,
                addListener: vi.fn(async () => ({ remove: async () => undefined })),
            },
        }));

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: {
                get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
            },
            json: async () => ({
                version: '0.5.1-ota-2026-04-04T03-34-46-472Z',
                url: 'https://assets.easyboardgame.top/official/app-updates/android/stable/bundles/0.5.1-ota-2026-04-04T03-34-46-472Z.zip',
                checksum: 'new',
                channel: 'stable',
                forceUpdate: true,
                forceUpdateTitle: '正在更新',
                forceUpdateMessage: '正在下载必要更新，请稍候',
            }),
        }));

        const { startAndroidLiveUpdateBackgroundCheck } = await import('../mobile/androidLiveUpdates');
        const states: Array<{ phase: string; blocking: boolean }> = [];

        const result = await startAndroidLiveUpdateBackgroundCheck({
            force: true,
            envOverride: {
                VITE_ANDROID_OTA_ENABLED: 'true',
                VITE_ANDROID_OTA_MANIFEST_URL: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
                VITE_ANDROID_OTA_CHANNEL: 'stable',
                VITE_ANDROID_OTA_APP_READY_TIMEOUT_MS: '15000',
            },
            onForceStateChange: (state) => {
                states.push({ phase: state.phase, blocking: state.blocking });
            },
        });

        expect(result).toEqual({
            status: 'queued',
            version: '0.5.1-ota-2026-04-04T03-34-46-472Z',
            source: 'downloaded',
            mode: 'immediate',
        });
        expect(downloadMock).toHaveBeenCalledTimes(1);
        expect(nextMock).not.toHaveBeenCalled();
        expect(setMultiDelayMock).not.toHaveBeenCalled();
        expect(setMock).toHaveBeenCalledWith({ id: 'bundle-next' });
        expect(states.some((state) => state.blocking)).toBe(true);
    });

    it('本地同版本 bundle 若仍在 downloading，不应误判为可直接排队的缓存包', async () => {
        vi.resetModules();

        vi.doMock('@capacitor/core', () => ({
            Capacitor: {
                isNativePlatform: () => true,
                getPlatform: () => 'android',
            },
            registerPlugin: vi.fn(() => ({})),
        }));

        const currentMock = vi.fn().mockResolvedValue({
            native: '0.5.1',
            bundle: {
                id: 'bundle-current',
                version: '0.5.1-ota-2026-04-04T03-00-00-000Z',
                downloaded: '2026-04-04T03:10:00.000Z',
                checksum: 'old',
                status: 'success',
            },
        });
        const listMock = vi.fn().mockResolvedValue({
            bundles: [{
                id: 'bundle-downloading',
                version: '0.5.1-ota-2026-04-04T03-34-46-472Z',
                downloaded: '',
                checksum: 'new',
                status: 'downloading',
            }],
        });
        const downloadMock = vi.fn().mockResolvedValue({
            id: 'bundle-next',
            version: '0.5.1-ota-2026-04-04T03-34-46-472Z',
            downloaded: '2026-04-04T03:45:00.000Z',
            checksum: 'new',
            status: 'success',
        });
        const nextMock = vi.fn().mockResolvedValue(undefined);
        const setMultiDelayMock = vi.fn().mockResolvedValue(undefined);

        vi.doMock('@capgo/capacitor-updater', () => ({
            CapacitorUpdater: {
                notifyAppReady: vi.fn(),
                current: currentMock,
                list: listMock,
                download: downloadMock,
                next: nextMock,
                set: vi.fn(),
                reload: vi.fn(),
                setMultiDelay: setMultiDelayMock,
                addListener: vi.fn(async () => ({ remove: async () => undefined })),
            },
        }));

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: {
                get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
            },
            json: async () => ({
                version: '0.5.1-ota-2026-04-04T03-34-46-472Z',
                url: 'https://assets.easyboardgame.top/official/app-updates/android/stable/bundles/0.5.1-ota-2026-04-04T03-34-46-472Z.zip',
                checksum: 'new',
                channel: 'stable',
                forceUpdate: false,
            }),
        }));

        const { startAndroidLiveUpdateBackgroundCheck } = await import('../mobile/androidLiveUpdates');

        const result = await startAndroidLiveUpdateBackgroundCheck({
            force: true,
            envOverride: {
                VITE_ANDROID_OTA_ENABLED: 'true',
                VITE_ANDROID_OTA_MANIFEST_URL: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
                VITE_ANDROID_OTA_CHANNEL: 'stable',
                VITE_ANDROID_OTA_APP_READY_TIMEOUT_MS: '15000',
            },
        });

        expect(result).toEqual({
            status: 'queued',
            version: '0.5.1-ota-2026-04-04T03-34-46-472Z',
            source: 'downloaded',
            mode: 'background',
        });
        expect(downloadMock).toHaveBeenCalledTimes(1);
        expect(nextMock).toHaveBeenCalledWith({ id: 'bundle-next' });
        expect(setMultiDelayMock).toHaveBeenCalledWith({
            delayConditions: [{ kind: 'background', value: '0' }],
        });
    });

    it('OTA 下载超时后应返回错误，并释放检查锁以便下一次重新发起', async () => {
        vi.resetModules();
        vi.useFakeTimers();

        vi.doMock('@capacitor/core', () => ({
            Capacitor: {
                isNativePlatform: () => true,
                getPlatform: () => 'android',
            },
            registerPlugin: vi.fn(() => ({})),
        }));

        const currentMock = vi.fn().mockResolvedValue({
            native: '0.5.1',
            bundle: {
                id: 'bundle-current',
                version: '0.5.1-ota-2026-04-04T03-00-00-000Z',
                downloaded: '2026-04-04T03:10:00.000Z',
                checksum: 'old',
                status: 'success',
            },
        });
        const listMock = vi.fn().mockResolvedValue({ bundles: [] });
        const downloadMock = vi.fn()
            .mockImplementationOnce(() => new Promise(() => undefined))
            .mockResolvedValueOnce({
                id: 'bundle-next',
                version: '0.5.1-ota-2026-04-04T03-34-46-472Z',
                downloaded: '2026-04-04T03:45:00.000Z',
                checksum: 'new',
                status: 'success',
            });
        const nextMock = vi.fn().mockResolvedValue(undefined);
        const setMultiDelayMock = vi.fn().mockResolvedValue(undefined);

        vi.doMock('@capgo/capacitor-updater', () => ({
            CapacitorUpdater: {
                notifyAppReady: vi.fn(),
                current: currentMock,
                list: listMock,
                download: downloadMock,
                next: nextMock,
                set: vi.fn(),
                reload: vi.fn(),
                setMultiDelay: setMultiDelayMock,
                addListener: vi.fn(async () => ({ remove: async () => undefined })),
            },
        }));

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: {
                get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
            },
            json: async () => ({
                version: '0.5.1-ota-2026-04-04T03-34-46-472Z',
                url: 'https://assets.easyboardgame.top/official/app-updates/android/stable/bundles/0.5.1-ota-2026-04-04T03-34-46-472Z.zip',
                checksum: 'new',
                channel: 'stable',
                forceUpdate: false,
            }),
        }));

        const { startAndroidLiveUpdateBackgroundCheck } = await import('../mobile/androidLiveUpdates');

        try {
            const firstCheckPromise = startAndroidLiveUpdateBackgroundCheck({
                force: true,
                envOverride: {
                    VITE_ANDROID_OTA_ENABLED: 'true',
                    VITE_ANDROID_OTA_MANIFEST_URL: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
                    VITE_ANDROID_OTA_CHANNEL: 'stable',
                    VITE_ANDROID_OTA_APP_READY_TIMEOUT_MS: '10000',
                },
            });

            await vi.advanceTimersByTimeAsync(60000);

            await expect(firstCheckPromise).resolves.toEqual({
                status: 'error',
                reason: 'OTA 下载超时：超过 60000ms 未完成 bundle 下载',
            });

            const retryResult = await startAndroidLiveUpdateBackgroundCheck({
                envOverride: {
                    VITE_ANDROID_OTA_ENABLED: 'true',
                    VITE_ANDROID_OTA_MANIFEST_URL: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
                    VITE_ANDROID_OTA_CHANNEL: 'stable',
                    VITE_ANDROID_OTA_APP_READY_TIMEOUT_MS: '10000',
                },
            });

            expect(retryResult).toEqual({
                status: 'queued',
                version: '0.5.1-ota-2026-04-04T03-34-46-472Z',
                source: 'downloaded',
                mode: 'background',
            });
            expect(downloadMock).toHaveBeenCalledTimes(2);
            expect(nextMock).toHaveBeenCalledWith({ id: 'bundle-next' });
            expect(setMultiDelayMock).toHaveBeenCalledWith({
                delayConditions: [{ kind: 'background', value: '0' }],
            });
        } finally {
            vi.useRealTimers();
        }
    });

    it('手动按钮触发 OTA 时应立即应用并自动重启', async () => {
        vi.resetModules();

        vi.doMock('@capacitor/core', () => ({
            Capacitor: {
                isNativePlatform: () => true,
                getPlatform: () => 'android',
            },
            registerPlugin: vi.fn(() => ({})),
        }));

        const currentMock = vi.fn().mockResolvedValue({
            native: '0.5.1',
            bundle: {
                id: 'bundle-current',
                version: '0.5.1-ota-2026-04-04T03-00-00-000Z',
                downloaded: '2026-04-04T03:10:00.000Z',
                checksum: 'old',
                status: 'success',
            },
        });
        const listMock = vi.fn().mockResolvedValue({ bundles: [] });
        const downloadMock = vi.fn().mockResolvedValue({
            id: 'bundle-next',
            version: '0.5.1-ota-2026-04-04T03-34-46-472Z',
            downloaded: '2026-04-04T03:45:00.000Z',
            checksum: 'new',
            status: 'success',
        });
        const nextMock = vi.fn().mockResolvedValue(undefined);
        const setMultiDelayMock = vi.fn().mockResolvedValue(undefined);
        const setMock = vi.fn().mockResolvedValue(undefined);
        const reloadMock = vi.fn().mockResolvedValue(undefined);

        vi.doMock('@capgo/capacitor-updater', () => ({
            CapacitorUpdater: {
                notifyAppReady: vi.fn(),
                current: currentMock,
                list: listMock,
                download: downloadMock,
                next: nextMock,
                set: setMock,
                reload: reloadMock,
                setMultiDelay: setMultiDelayMock,
                addListener: vi.fn(async () => ({ remove: async () => undefined })),
            },
        }));

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: {
                get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
            },
            json: async () => ({
                version: '0.5.1-ota-2026-04-04T03-34-46-472Z',
                url: 'https://assets.easyboardgame.top/official/app-updates/android/stable/bundles/0.5.1-ota-2026-04-04T03-34-46-472Z.zip',
                checksum: 'new',
                channel: 'stable',
                forceUpdate: false,
            }),
        }));

        const { startAndroidLiveUpdateBackgroundCheck } = await import('../mobile/androidLiveUpdates');
        const states: Array<{ phase: string; blocking: boolean }> = [];

        const result = await startAndroidLiveUpdateBackgroundCheck({
            force: true,
            applyMode: 'immediate',
            envOverride: {
                VITE_ANDROID_OTA_ENABLED: 'true',
                VITE_ANDROID_OTA_MANIFEST_URL: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
                VITE_ANDROID_OTA_CHANNEL: 'stable',
                VITE_ANDROID_OTA_APP_READY_TIMEOUT_MS: '15000',
            },
            onForceStateChange: (state) => {
                states.push({ phase: state.phase, blocking: state.blocking });
            },
        });

        expect(result).toEqual({
            status: 'queued',
            version: '0.5.1-ota-2026-04-04T03-34-46-472Z',
            source: 'downloaded',
            mode: 'immediate',
        });
        expect(downloadMock).toHaveBeenCalledTimes(1);
        expect(setMock).toHaveBeenCalledWith({ id: 'bundle-next' });
        expect(reloadMock).toHaveBeenCalledTimes(1);
        expect(nextMock).not.toHaveBeenCalled();
        expect(setMultiDelayMock).not.toHaveBeenCalled();
        expect(states.some((state) => state.blocking)).toBe(true);
    });

    it('后台自动检查未结束时，手动立即更新不应被背景任务串行阻塞', async () => {
        vi.resetModules();

        vi.doMock('@capacitor/core', () => ({
            Capacitor: {
                isNativePlatform: () => true,
                getPlatform: () => 'android',
            },
            registerPlugin: vi.fn(() => ({})),
        }));

        let resolveFirstDownload: ((value: {
            id: string;
            version: string;
            downloaded: string;
            checksum: string;
            status: 'success';
        }) => void) | null = null;
        const downloadMock = vi.fn()
            .mockImplementationOnce(() => new Promise((resolve) => {
                resolveFirstDownload = resolve;
            }))
            .mockResolvedValueOnce({
                id: 'bundle-immediate',
                version: '0.5.1-ota-2026-04-04T03-34-46-472Z',
                downloaded: '2026-04-04T03:45:00.000Z',
                checksum: 'new',
                status: 'success',
            });

        const nextMock = vi.fn().mockResolvedValue(undefined);
        const setMock = vi.fn().mockResolvedValue(undefined);
        const reloadMock = vi.fn().mockResolvedValue(undefined);
        const setMultiDelayMock = vi.fn().mockResolvedValue(undefined);

        vi.doMock('@capgo/capacitor-updater', () => ({
            CapacitorUpdater: {
                notifyAppReady: vi.fn(),
                current: vi.fn().mockResolvedValue({
                    native: '0.5.1',
                    bundle: {
                        id: 'bundle-current',
                        version: '0.5.1-ota-2026-04-04T03-00-00-000Z',
                        downloaded: '2026-04-04T03:10:00.000Z',
                        checksum: 'old',
                        status: 'success',
                    },
                }),
                list: vi.fn().mockResolvedValue({ bundles: [] }),
                download: downloadMock,
                next: nextMock,
                set: setMock,
                reload: reloadMock,
                setMultiDelay: setMultiDelayMock,
                addListener: vi.fn(async () => ({ remove: async () => undefined })),
            },
        }));

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: {
                get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
            },
            json: async () => ({
                version: '0.5.1-ota-2026-04-04T03-34-46-472Z',
                url: 'https://assets.easyboardgame.top/official/app-updates/android/stable/bundles/0.5.1-ota-2026-04-04T03-34-46-472Z.zip',
                checksum: 'new',
                channel: 'stable',
                forceUpdate: false,
            }),
        }));

        const { startAndroidLiveUpdateBackgroundCheck } = await import('../mobile/androidLiveUpdates');

        const backgroundPromise = startAndroidLiveUpdateBackgroundCheck({
            applyMode: 'background',
            envOverride: {
                VITE_ANDROID_OTA_ENABLED: 'true',
                VITE_ANDROID_OTA_MANIFEST_URL: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
                VITE_ANDROID_OTA_CHANNEL: 'stable',
                VITE_ANDROID_OTA_APP_READY_TIMEOUT_MS: '15000',
            },
        });

        await Promise.resolve();
        await Promise.resolve();

        const immediateResult = await startAndroidLiveUpdateBackgroundCheck({
            force: true,
            applyMode: 'immediate',
            envOverride: {
                VITE_ANDROID_OTA_ENABLED: 'true',
                VITE_ANDROID_OTA_MANIFEST_URL: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
                VITE_ANDROID_OTA_CHANNEL: 'stable',
                VITE_ANDROID_OTA_APP_READY_TIMEOUT_MS: '15000',
            },
        });

        expect(immediateResult).toEqual({
            status: 'queued',
            version: '0.5.1-ota-2026-04-04T03-34-46-472Z',
            source: 'downloaded',
            mode: 'immediate',
        });
        expect(downloadMock).toHaveBeenCalledTimes(2);
        expect(setMock).toHaveBeenCalledWith({ id: 'bundle-immediate' });
        expect(reloadMock).toHaveBeenCalledTimes(1);
        expect(nextMock).not.toHaveBeenCalled();

        resolveFirstDownload?.({
            id: 'bundle-background',
            version: '0.5.1-ota-2026-04-04T03-34-46-472Z',
            downloaded: '2026-04-04T03:46:00.000Z',
            checksum: 'new',
            status: 'success',
        });

        await expect(backgroundPromise).resolves.toEqual({
            status: 'queued',
            version: '0.5.1-ota-2026-04-04T03-34-46-472Z',
            source: 'downloaded',
            mode: 'background',
        });
        expect(nextMock).toHaveBeenCalledWith({ id: 'bundle-background' });
        expect(setMultiDelayMock).toHaveBeenCalledWith({
            delayConditions: [{ kind: 'background', value: '0' }],
        });
    });

    it('读取原生 APK 自更新配置时，只有启用且 manifest URL 合法才算开启', () => {
        expect(readAndroidNativeUpdateConfig({
            VITE_ANDROID_NATIVE_UPDATE_ENABLED: 'true',
            VITE_ANDROID_NATIVE_UPDATE_MANIFEST_URL: 'https://assets.easyboardgame.top/official/native-app-updates/android/stable/latest.json',
            VITE_ANDROID_NATIVE_UPDATE_CHANNEL: 'stable',
        })).toEqual({
            enabled: true,
            manifestUrl: 'https://assets.easyboardgame.top/official/native-app-updates/android/stable/latest.json',
            manifestUrls: [
                'https://assets.easyboardgame.top/official/native-app-updates/android/stable/latest.json',
                'http://8.148.71.102/official/native-app-updates/android/stable/latest.json',
            ],
            channel: 'stable',
        });

        expect(readAndroidNativeUpdateConfig({
            VITE_ANDROID_NATIVE_UPDATE_ENABLED: 'true',
            VITE_ANDROID_NATIVE_UPDATE_MANIFEST_URL: '/relative.json',
        }).enabled).toBe(false);
    });

    it('原生 APK 自更新优先比较 versionCode，否则回退到 versionName', () => {
        const appInfo: AndroidAppInfo = {
            versionName: '0.5.0',
            versionCode: 500,
            canRequestPackageInstalls: true,
        };

        expect(isAndroidNativeUpdateAvailable({
            version: '0.5.0',
            versionCode: 501,
            url: 'https://example.com/app.apk',
        }, appInfo)).toBe(true);

        expect(isAndroidNativeUpdateAvailable({
            version: '0.5.1',
            url: 'https://example.com/app.apk',
        }, {
            ...appInfo,
            versionCode: undefined,
        })).toBe(true);

        expect(isAndroidNativeUpdateAvailable({
            version: '0.4.9',
            versionCode: 499,
            url: 'https://example.com/app.apk',
        }, appInfo)).toBe(false);
    });

    it('原生更新主清单重定向时会改用 IP 兜底清单', async () => {
        vi.resetModules();
        const primaryManifestUrl = 'https://assets.easyboardgame.top/official/native-app-updates/android/stable/latest.json';
        const fallbackManifestUrl = 'http://8.148.71.102/official/native-app-updates/android/stable/latest.json';

        vi.stubEnv('VITE_ANDROID_NATIVE_UPDATE_ENABLED', 'true');
        vi.stubEnv('VITE_ANDROID_NATIVE_UPDATE_MANIFEST_URL', primaryManifestUrl);
        vi.stubEnv('VITE_ANDROID_NATIVE_UPDATE_MANIFEST_FALLBACK_URLS', fallbackManifestUrl);
        vi.stubEnv('VITE_CAPACITOR_APP_ID', 'top.easyboardgame.app');
        vi.doMock('@capacitor/core', async (importOriginal) => {
            const actual = await importOriginal<typeof import('@capacitor/core')>();
            return {
                ...actual,
                registerPlugin: vi.fn(() => ({
                    getAppInfo: vi.fn().mockResolvedValue({
                        packageName: 'top.easyboardgame.app',
                        versionName: '0.5.0',
                        versionCode: 500,
                        canRequestPackageInstalls: true,
                    }),
                })),
            };
        });
        vi.doMock('../mobile/androidRuntime', async (importOriginal) => {
            const actual = await importOriginal<typeof import('../mobile/androidRuntime')>();
            return {
                ...actual,
                isNativeAndroidRuntime: () => true,
            };
        });
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url === primaryManifestUrl) {
                return new Response(null, {
                    status: 302,
                    headers: { Location: fallbackManifestUrl },
                });
            }
            if (url === fallbackManifestUrl) {
                return new Response(JSON.stringify({
                    version: '0.5.2',
                    versionCode: 502,
                    url: 'http://8.148.71.102/official/native-app-updates/android/stable/packages/0.5.2.apk',
                    checksum: 'abc123',
                    size: 123456,
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            return new Response('unexpected', { status: 500 });
        });
        vi.stubGlobal('fetch', fetchMock);

        const {
            checkAndroidNativeUpdateAvailability: checkAvailability,
        } = await import('../mobile/androidNativeUpdates');
        const result = await checkAvailability();

        expect(result).toMatchObject({
            available: true,
            manifest: {
                version: '0.5.2',
                url: 'http://8.148.71.102/official/native-app-updates/android/stable/packages/0.5.2.apk',
            },
        });
        expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
            primaryManifestUrl,
            fallbackManifestUrl,
        ]);
    });

    it('Android 运行时边界必须看真实原生环境，而不是只看构建模式或孤立桥对象', () => {
        expect(detectNativeAndroidRuntime({
            capacitor: {
                isNativePlatform: () => false,
                getPlatform: () => 'web',
            },
        })).toBe(false);

        expect(detectNativeAndroidRuntime({
            capacitor: {
                isNativePlatform: () => true,
                getPlatform: () => 'android',
            },
        })).toBe(true);

        expect(detectNativeAndroidRuntime({
            capacitor: {
                isNativePlatform: () => false,
                getPlatform: () => 'web',
            },
            windowObject: {
                androidBridge: {},
            },
        })).toBe(false);

        expect(detectNativeAndroidRuntime({
            capacitor: {
                isNativePlatform: () => false,
                getPlatform: () => 'web',
            },
            windowObject: {
                Capacitor: {
                    isNativePlatform: () => true,
                    getPlatform: () => 'android',
                },
            },
        })).toBe(false);

        expect(detectNativeAndroidRuntime({
            capacitor: {},
            windowObject: {
                Capacitor: {
                    isNativePlatform: () => true,
                    getPlatform: () => 'android',
                },
            },
        })).toBe(true);
    });

    it('AndroidLiveUpdateManager 首次自动检查只走后台模式', async () => {
        vi.resetModules();

        const startMock = vi.fn().mockResolvedValue({ status: 'up-to-date' });
        const subscribeMock = vi.fn(() => () => undefined);

        vi.doMock('../mobile/androidLiveUpdates', () => ({
            registerAndroidLiveUpdateListeners: vi.fn().mockResolvedValue(undefined),
            subscribeAndroidLiveUpdateRequests: subscribeMock,
            startAndroidLiveUpdateBackgroundCheck: startMock,
        }));
        vi.doMock('../mobile/androidNativeUpdates', () => ({
            requestAndroidNativeUpdateCheck: vi.fn(),
        }));
        vi.doMock('../mobile/androidRuntime', () => ({
            isNativeAndroidRuntime: () => true,
        }));
        vi.doMock('../../contexts/ToastContext', () => ({
            useToast: () => ({
                success: vi.fn(),
                error: vi.fn(),
            }),
        }));
        vi.doMock('../../components/system/AndroidForceUpdateGate', () => ({
            AndroidForceUpdateGate: () => null,
        }));

        const { AndroidLiveUpdateManager } = await import('../../components/system/AndroidLiveUpdateManager');
        render(createElement(AndroidLiveUpdateManager));

        await waitFor(() => {
            expect(startMock).toHaveBeenCalledTimes(1);
        });
        expect(startMock).toHaveBeenCalledWith(expect.objectContaining({
            applyMode: 'background',
            onForceStateChange: expect.any(Function),
        }));
        expect(subscribeMock).toHaveBeenCalledTimes(1);
    });

    it('AndroidLiveUpdateManager 手动升级回退到原生更新时保留 interactive 语义', async () => {
        vi.resetModules();

        let requestListener: ((request: {
            interactive?: boolean;
            applyMode?: 'background' | 'immediate';
            initialImmediatePhase?: 'checking' | 'downloading';
        }) => void) | null = null;

        const startMock = vi.fn()
            .mockResolvedValueOnce({ status: 'up-to-date' })
            .mockResolvedValueOnce({
                status: 'incompatible',
                version: '0.5.2',
                reason: '需要升级原生壳',
            });
        const requestNativeUpdateCheckMock = vi.fn();

        vi.doMock('../mobile/androidLiveUpdates', () => ({
            registerAndroidLiveUpdateListeners: vi.fn().mockResolvedValue(undefined),
            subscribeAndroidLiveUpdateRequests: vi.fn((listener) => {
                requestListener = listener;
                return () => undefined;
            }),
            startAndroidLiveUpdateBackgroundCheck: startMock,
        }));
        vi.doMock('../mobile/androidNativeUpdates', () => ({
            requestAndroidNativeUpdateCheck: requestNativeUpdateCheckMock,
        }));
        vi.doMock('../mobile/androidRuntime', () => ({
            isNativeAndroidRuntime: () => true,
        }));
        vi.doMock('../../contexts/ToastContext', () => ({
            useToast: () => ({
                success: vi.fn(),
                error: vi.fn(),
            }),
        }));
        vi.doMock('../../components/system/AndroidForceUpdateGate', () => ({
            AndroidForceUpdateGate: () => null,
        }));

        const { AndroidLiveUpdateManager } = await import('../../components/system/AndroidLiveUpdateManager');
        render(createElement(AndroidLiveUpdateManager));

        await waitFor(() => {
            expect(typeof requestListener).toBe('function');
            expect(startMock).toHaveBeenCalledTimes(1);
        });

        await act(async () => {
            requestListener?.({
                interactive: true,
                applyMode: 'immediate',
                initialImmediatePhase: 'checking',
            });
        });

        await waitFor(() => {
            expect(requestNativeUpdateCheckMock).toHaveBeenCalledWith({ interactive: true });
        });
    });

    it('AndroidLiveUpdateManager 手动检查已是最新版本时也要主动清掉检查中遮罩', async () => {
        vi.resetModules();

        let requestListener: ((request: {
            interactive?: boolean;
            applyMode?: 'background' | 'immediate';
            initialImmediatePhase?: 'checking' | 'downloading';
        }) => void) | null = null;
        const toastSuccessMock = vi.fn();

        const startMock = vi.fn()
            .mockResolvedValueOnce({ status: 'up-to-date' })
            .mockImplementationOnce(async (options?: {
                onForceStateChange?: (state: { phase: string; blocking: boolean }) => void;
            }) => {
                options?.onForceStateChange?.({
                    phase: 'checking',
                    blocking: true,
                });
                return { status: 'up-to-date' } as const;
            });

        vi.doMock('../mobile/androidLiveUpdates', () => ({
            registerAndroidLiveUpdateListeners: vi.fn().mockResolvedValue(undefined),
            subscribeAndroidLiveUpdateRequests: vi.fn((listener) => {
                requestListener = listener;
                return () => undefined;
            }),
            startAndroidLiveUpdateBackgroundCheck: startMock,
        }));
        vi.doMock('../mobile/androidNativeUpdates', () => ({
            requestAndroidNativeUpdateCheck: vi.fn(),
        }));
        vi.doMock('../mobile/androidRuntime', () => ({
            isNativeAndroidRuntime: () => true,
        }));
        vi.doMock('../../contexts/ToastContext', () => ({
            useToast: () => ({
                success: toastSuccessMock,
                error: vi.fn(),
            }),
        }));
        vi.doMock('../../components/system/AndroidForceUpdateGate', () => ({
            AndroidForceUpdateGate: ({ state }: { state: { phase: string; blocking: boolean } }) => (
                createElement('div', { 'data-testid': 'force-update-phase' }, `${state.phase}:${String(state.blocking)}`)
            ),
        }));

        const { AndroidLiveUpdateManager } = await import('../../components/system/AndroidLiveUpdateManager');
        const view = render(createElement(AndroidLiveUpdateManager));

        await waitFor(() => {
            expect(typeof requestListener).toBe('function');
            expect(startMock).toHaveBeenCalledTimes(1);
        });

        await act(async () => {
            requestListener?.({
                interactive: true,
                applyMode: 'immediate',
                initialImmediatePhase: 'checking',
            });
        });

        await waitFor(() => {
            expect(view.getByTestId('force-update-phase').textContent).toBe('hidden:false');
            expect(toastSuccessMock).toHaveBeenCalledWith('nativeUpdate.toast.upToDate', 'nativeUpdate.eyebrow', {
                dedupeKey: 'android-ota-up-to-date',
                ttlMs: 3000,
            });
        });
    });

    it('AndroidLiveUpdateManager 后台 OTA 错误应保留错误遮罩，不再用一次性 toast 静默降级', async () => {
        vi.resetModules();

        const toastErrorMock = vi.fn();
        const startMock = vi.fn()
            .mockImplementationOnce(async (options?: {
                onForceStateChange?: (state: { phase: string; blocking: boolean; reason?: string }) => void;
            }) => {
                const reason = 'OTA 清单不存在：已尝试 1 个清单入口均失败：https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json: 404 https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json';
                options?.onForceStateChange?.({
                    phase: 'error',
                    blocking: true,
                    reason,
                });
                return {
                    status: 'error',
                    reason,
                } as const;
            });

        vi.doMock('../mobile/androidLiveUpdates', () => ({
            registerAndroidLiveUpdateListeners: vi.fn().mockResolvedValue(undefined),
            subscribeAndroidLiveUpdateRequests: vi.fn(() => () => undefined),
            startAndroidLiveUpdateBackgroundCheck: startMock,
        }));
        vi.doMock('../mobile/androidNativeUpdates', () => ({
            requestAndroidNativeUpdateCheck: vi.fn(),
        }));
        vi.doMock('../mobile/androidRuntime', () => ({
            isNativeAndroidRuntime: () => true,
        }));
        vi.doMock('../../contexts/ToastContext', () => ({
            useToast: () => ({
                success: vi.fn(),
                error: toastErrorMock,
            }),
        }));
        vi.doMock('../../components/system/AndroidForceUpdateGate', () => ({
            AndroidForceUpdateGate: ({ state }: { state: { phase: string; blocking: boolean; reason?: string } }) => (
                createElement('div', { 'data-testid': 'force-update-phase' }, `${state.phase}:${String(state.blocking)}:${state.reason ?? ''}`)
            ),
        }));

        const { AndroidLiveUpdateManager } = await import('../../components/system/AndroidLiveUpdateManager');
        const view = render(createElement(AndroidLiveUpdateManager));

        await waitFor(() => {
            expect(view.getByTestId('force-update-phase').textContent).toBe(
                'error:true:OTA 清单不存在：已尝试 1 个清单入口均失败：https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json: 404 https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
            );
        });
        expect(toastErrorMock).not.toHaveBeenCalled();
    });

    it('AndroidNativeUpdateManager 非强更自动检查应后台预下载，但手动检查才允许进入安装链路', async () => {
        vi.resetModules();

        let requestListener: ((request: { interactive?: boolean }) => void) | null = null;
        const preloadMock = vi.fn().mockResolvedValue({ status: 'prepared', version: '0.5.2', progressPercent: 100 });
        const prepareMock = vi.fn().mockResolvedValue({ status: 'installer-launched' });

        vi.doMock('../mobile/androidNativeUpdates', () => ({
            HIDDEN_ANDROID_NATIVE_UPDATE_STATE: {
                phase: 'hidden',
                blocking: false,
            },
            checkAndroidNativeUpdateAvailability: vi.fn().mockResolvedValue({
                available: true,
                manifest: {
                    version: '0.5.2',
                    url: 'https://example.com/app.apk',
                    forceUpdate: false,
                    forceUpdateTitle: '需要升级',
                    forceUpdateMessage: '请安装新版应用',
                },
            }),
            continueAndroidNativeUpdateInstall: vi.fn(),
            mapNativeUpdateEventToState: vi.fn(() => ({
                phase: 'checking',
                blocking: true,
            })),
            openAndroidUnknownSourcesSettings: vi.fn(),
            prepareAndroidNativeUpdateInstall: prepareMock,
            readPreparedAndroidUpdateState: vi.fn().mockResolvedValue(null),
            requestAndroidNativeUpdateCheck: vi.fn(),
            readAndroidNativeUpdateConfig: vi.fn(() => ({
                enabled: true,
                manifestUrl: 'https://example.com/latest.json',
                channel: 'stable',
            })),
            startAndroidNativeUpdatePreload: preloadMock,
            subscribeAndroidNativeUpdateRequests: vi.fn((listener) => {
                requestListener = listener;
                return () => undefined;
            }),
            subscribeAndroidNativeUpdateState: vi.fn().mockResolvedValue({
                remove: async () => undefined,
            }),
        }));
        vi.doMock('../mobile/androidRuntime', () => ({
            isNativeAndroidRuntime: () => true,
        }));
        vi.doMock('../../contexts/ToastContext', () => ({
            useToast: () => ({
                warning: vi.fn(),
                success: vi.fn(),
                info: vi.fn(),
                error: vi.fn(),
            }),
        }));
        vi.doMock('react-i18next', () => ({
            useTranslation: () => ({
                t: (key: string) => key,
            }),
        }));
        vi.doMock('../../components/system/AndroidNativeUpdateGate', () => ({
            AndroidNativeUpdateGate: () => null,
        }));

        const { AndroidNativeUpdateManager } = await import('../../components/system/AndroidNativeUpdateManager');
        render(createElement(AndroidNativeUpdateManager));

        await waitFor(() => {
            expect(typeof requestListener).toBe('function');
            expect(preloadMock).toHaveBeenCalledTimes(1);
        });
        expect(prepareMock).not.toHaveBeenCalled();

        await act(async () => {
            requestListener?.({ interactive: true });
        });

        await waitFor(() => {
            expect(prepareMock).toHaveBeenCalledTimes(1);
        });
    });

    it('AndroidNativeUpdateManager 强更自动检查应继续进入原生安装链路', async () => {
        vi.resetModules();

        const prepareMock = vi.fn().mockResolvedValue({ status: 'installer-launched' });

        vi.doMock('../mobile/androidNativeUpdates', () => ({
            HIDDEN_ANDROID_NATIVE_UPDATE_STATE: {
                phase: 'hidden',
                blocking: false,
            },
            checkAndroidNativeUpdateAvailability: vi.fn().mockResolvedValue({
                available: true,
                manifest: {
                    version: '0.5.2',
                    url: 'https://example.com/app.apk',
                    forceUpdate: true,
                    forceUpdateTitle: '需要升级',
                    forceUpdateMessage: '请安装新版应用',
                },
            }),
            continueAndroidNativeUpdateInstall: vi.fn(),
            mapNativeUpdateEventToState: vi.fn(() => ({
                phase: 'checking',
                blocking: true,
            })),
            openAndroidUnknownSourcesSettings: vi.fn(),
            prepareAndroidNativeUpdateInstall: prepareMock,
            readPreparedAndroidUpdateState: vi.fn().mockResolvedValue(null),
            requestAndroidNativeUpdateCheck: vi.fn(),
            readAndroidNativeUpdateConfig: vi.fn(() => ({
                enabled: true,
                manifestUrl: 'https://example.com/latest.json',
                channel: 'stable',
            })),
            subscribeAndroidNativeUpdateRequests: vi.fn(() => () => undefined),
            subscribeAndroidNativeUpdateState: vi.fn().mockResolvedValue({
                remove: async () => undefined,
            }),
        }));
        vi.doMock('../mobile/androidRuntime', () => ({
            isNativeAndroidRuntime: () => true,
        }));
        vi.doMock('../../contexts/ToastContext', () => ({
            useToast: () => ({
                warning: vi.fn(),
                success: vi.fn(),
                info: vi.fn(),
                error: vi.fn(),
            }),
        }));
        vi.doMock('react-i18next', () => ({
            useTranslation: () => ({
                t: (key: string) => key,
            }),
        }));
        vi.doMock('../../components/system/AndroidNativeUpdateGate', () => ({
            AndroidNativeUpdateGate: () => null,
        }));

        const { AndroidNativeUpdateManager } = await import('../../components/system/AndroidNativeUpdateManager');
        render(createElement(AndroidNativeUpdateManager));

        await waitFor(() => {
            expect(prepareMock).toHaveBeenCalledTimes(1);
        });
    });

    it('AndroidNativeUpdateManager 冷启动命中原生下载中状态时应自动续传但非强更不阻塞页面', async () => {
        vi.resetModules();

        const preloadMock = vi.fn().mockResolvedValue({ status: 'prepared' });
        const mapStateMock = vi.fn(() => ({
            phase: 'downloading',
            blocking: true,
            progressPercent: 42,
        }));

        vi.doMock('../mobile/androidNativeUpdates', () => ({
            HIDDEN_ANDROID_NATIVE_UPDATE_STATE: {
                phase: 'hidden',
                blocking: false,
            },
            checkAndroidNativeUpdateAvailability: vi.fn().mockResolvedValue({
                available: true,
                manifest: {
                    version: '0.5.2',
                    url: 'https://example.com/app.apk',
                    forceUpdate: false,
                    forceUpdateTitle: '需要升级',
                    forceUpdateMessage: '请安装新版应用',
                },
            }),
            continueAndroidNativeUpdateInstall: vi.fn(),
            mapNativeUpdateEventToState: mapStateMock,
            openAndroidUnknownSourcesSettings: vi.fn(),
            prepareAndroidNativeUpdateInstall: vi.fn(),
            readPreparedAndroidUpdateState: vi.fn().mockResolvedValue({
                version: '0.5.2',
                status: 'downloading',
                progressPercent: 42,
            }),
            requestAndroidNativeUpdateCheck: vi.fn(),
            readAndroidNativeUpdateConfig: vi.fn(() => ({
                enabled: true,
                manifestUrl: 'https://example.com/latest.json',
                channel: 'stable',
            })),
            startAndroidNativeUpdatePreload: preloadMock,
            subscribeAndroidNativeUpdateRequests: vi.fn(() => () => undefined),
            subscribeAndroidNativeUpdateState: vi.fn().mockResolvedValue({
                remove: async () => undefined,
            }),
        }));
        vi.doMock('../mobile/androidRuntime', () => ({
            isNativeAndroidRuntime: () => true,
        }));
        vi.doMock('../../contexts/ToastContext', () => ({
            useToast: () => ({
                warning: vi.fn(),
                success: vi.fn(),
                info: vi.fn(),
                error: vi.fn(),
            }),
        }));
        vi.doMock('react-i18next', () => ({
            useTranslation: () => ({
                t: (key: string) => key,
            }),
        }));
        vi.doMock('../../components/system/AndroidNativeUpdateGate', () => ({
            AndroidNativeUpdateGate: () => null,
        }));

        const { AndroidNativeUpdateManager } = await import('../../components/system/AndroidNativeUpdateManager');
        render(createElement(AndroidNativeUpdateManager));

        await waitFor(() => {
            expect(preloadMock).toHaveBeenCalledTimes(1);
        });
        expect(mapStateMock).toHaveBeenCalledWith(expect.objectContaining({
            status: 'downloading',
            progressPercent: 42,
        }), expect.objectContaining({
            blocking: false,
        }));
    });

    it('AndroidNativeUpdateManager 命中同版本在途下载任务时，应继续显示下载态而不是掉回 checking/error', async () => {
        vi.resetModules();

        const preloadMock = vi.fn().mockResolvedValue({
            version: '0.5.2',
            status: 'downloading',
            progressPercent: 68,
            progressMode: 'determinate',
        });
        const mapStateMock = vi.fn(() => ({
            phase: 'downloading',
            blocking: false,
            progressPercent: 68,
        }));

        vi.doMock('../mobile/androidNativeUpdates', () => ({
            HIDDEN_ANDROID_NATIVE_UPDATE_STATE: {
                phase: 'hidden',
                blocking: false,
            },
            checkAndroidNativeUpdateAvailability: vi.fn().mockResolvedValue({
                available: true,
                manifest: {
                    version: '0.5.2',
                    url: 'https://example.com/app.apk',
                    forceUpdate: false,
                    forceUpdateTitle: '需要升级',
                    forceUpdateMessage: '请安装新版应用',
                },
            }),
            continueAndroidNativeUpdateInstall: vi.fn(),
            mapNativeUpdateEventToState: mapStateMock,
            openAndroidUnknownSourcesSettings: vi.fn(),
            prepareAndroidNativeUpdateInstall: vi.fn(),
            readPreparedAndroidUpdateState: vi.fn().mockResolvedValue({
                version: '0.5.2',
                status: 'downloading',
                progressPercent: 42,
            }),
            requestAndroidNativeUpdateCheck: vi.fn(),
            readAndroidNativeUpdateConfig: vi.fn(() => ({
                enabled: true,
                manifestUrl: 'https://example.com/latest.json',
                channel: 'stable',
            })),
            startAndroidNativeUpdatePreload: preloadMock,
            subscribeAndroidNativeUpdateRequests: vi.fn(() => () => undefined),
            subscribeAndroidNativeUpdateState: vi.fn().mockResolvedValue({
                remove: async () => undefined,
            }),
        }));
        vi.doMock('../mobile/androidRuntime', () => ({
            isNativeAndroidRuntime: () => true,
        }));
        vi.doMock('../../contexts/ToastContext', () => ({
            useToast: () => ({
                warning: vi.fn(),
                success: vi.fn(),
                info: vi.fn(),
                error: vi.fn(),
            }),
        }));
        vi.doMock('react-i18next', () => ({
            useTranslation: () => ({
                t: (key: string) => key,
            }),
        }));
        vi.doMock('../../components/system/AndroidNativeUpdateGate', () => ({
            AndroidNativeUpdateGate: () => null,
        }));

        const { AndroidNativeUpdateManager } = await import('../../components/system/AndroidNativeUpdateManager');
        render(createElement(AndroidNativeUpdateManager));

        await waitFor(() => {
            expect(preloadMock).toHaveBeenCalledTimes(1);
        });
        expect(mapStateMock).toHaveBeenLastCalledWith(expect.objectContaining({
            status: 'downloading',
            progressPercent: 68,
        }), expect.objectContaining({
            blocking: false,
        }));
    });

    it('AndroidNativeUpdateManager 冷启动命中原生下载中状态时强更版本仍应保持阻塞态', async () => {
        vi.resetModules();

        const prepareMock = vi.fn().mockResolvedValue({ status: 'installer-launched' });
        const mapStateMock = vi.fn(() => ({
            phase: 'downloading',
            blocking: true,
            progressPercent: 42,
        }));

        vi.doMock('../mobile/androidNativeUpdates', () => ({
            HIDDEN_ANDROID_NATIVE_UPDATE_STATE: {
                phase: 'hidden',
                blocking: false,
            },
            checkAndroidNativeUpdateAvailability: vi.fn().mockResolvedValue({
                available: true,
                manifest: {
                    version: '0.5.2',
                    url: 'https://example.com/app.apk',
                    forceUpdate: true,
                    forceUpdateTitle: '需要升级',
                    forceUpdateMessage: '请安装新版应用',
                },
            }),
            continueAndroidNativeUpdateInstall: vi.fn(),
            mapNativeUpdateEventToState: mapStateMock,
            openAndroidUnknownSourcesSettings: vi.fn(),
            prepareAndroidNativeUpdateInstall: prepareMock,
            readPreparedAndroidUpdateState: vi.fn().mockResolvedValue({
                version: '0.5.2',
                status: 'downloading',
                progressPercent: 42,
            }),
            requestAndroidNativeUpdateCheck: vi.fn(),
            readAndroidNativeUpdateConfig: vi.fn(() => ({
                enabled: true,
                manifestUrl: 'https://example.com/latest.json',
                channel: 'stable',
            })),
            subscribeAndroidNativeUpdateRequests: vi.fn(() => () => undefined),
            subscribeAndroidNativeUpdateState: vi.fn().mockResolvedValue({
                remove: async () => undefined,
            }),
        }));
        vi.doMock('../mobile/androidRuntime', () => ({
            isNativeAndroidRuntime: () => true,
        }));
        vi.doMock('../../contexts/ToastContext', () => ({
            useToast: () => ({
                warning: vi.fn(),
                success: vi.fn(),
                info: vi.fn(),
                error: vi.fn(),
            }),
        }));
        vi.doMock('react-i18next', () => ({
            useTranslation: () => ({
                t: (key: string) => key,
            }),
        }));
        vi.doMock('../../components/system/AndroidNativeUpdateGate', () => ({
            AndroidNativeUpdateGate: () => null,
        }));

        const { AndroidNativeUpdateManager } = await import('../../components/system/AndroidNativeUpdateManager');
        render(createElement(AndroidNativeUpdateManager));

        await waitFor(() => {
            expect(prepareMock).toHaveBeenCalledTimes(1);
        });
        expect(mapStateMock).toHaveBeenCalledWith(expect.objectContaining({
            status: 'downloading',
            progressPercent: 42,
        }), expect.objectContaining({
            blocking: true,
        }));
    });

    it('AndroidNativeUpdateManager 已后台预下载完成时，手动检查应直接继续安装而不是重新下载', async () => {
        vi.resetModules();

        let requestListener: ((request: { interactive?: boolean }) => void) | null = null;
        const continueMock = vi.fn().mockResolvedValue({ status: 'installer-launched' });
        const prepareMock = vi.fn();

        vi.doMock('../mobile/androidNativeUpdates', () => ({
            HIDDEN_ANDROID_NATIVE_UPDATE_STATE: {
                phase: 'hidden',
                blocking: false,
            },
            checkAndroidNativeUpdateAvailability: vi.fn().mockResolvedValue({
                available: true,
                manifest: {
                    version: '0.5.2',
                    url: 'https://example.com/app.apk',
                    forceUpdate: false,
                    forceUpdateTitle: '需要升级',
                    forceUpdateMessage: '请安装新版应用',
                },
            }),
            continueAndroidNativeUpdateInstall: continueMock,
            mapNativeUpdateEventToState: vi.fn(() => ({
                phase: 'hidden',
                blocking: false,
            })),
            openAndroidUnknownSourcesSettings: vi.fn(),
            prepareAndroidNativeUpdateInstall: prepareMock,
            startAndroidNativeUpdatePreload: vi.fn(),
            readPreparedAndroidUpdateState: vi.fn().mockResolvedValue({
                version: '0.5.2',
                status: 'prepared',
                progressPercent: 100,
            }),
            requestAndroidNativeUpdateCheck: vi.fn(),
            readAndroidNativeUpdateConfig: vi.fn(() => ({
                enabled: true,
                manifestUrl: 'https://example.com/latest.json',
                channel: 'stable',
            })),
            subscribeAndroidNativeUpdateRequests: vi.fn((listener) => {
                requestListener = listener;
                return () => undefined;
            }),
            subscribeAndroidNativeUpdateState: vi.fn().mockResolvedValue({
                remove: async () => undefined,
            }),
        }));
        vi.doMock('../mobile/androidRuntime', () => ({
            isNativeAndroidRuntime: () => true,
        }));
        vi.doMock('../../contexts/ToastContext', () => ({
            useToast: () => ({
                warning: vi.fn(),
                success: vi.fn(),
                info: vi.fn(),
                error: vi.fn(),
            }),
        }));
        vi.doMock('react-i18next', () => ({
            useTranslation: () => ({
                t: (key: string) => key,
            }),
        }));
        vi.doMock('../../components/system/AndroidNativeUpdateGate', () => ({
            AndroidNativeUpdateGate: () => null,
        }));

        const { AndroidNativeUpdateManager } = await import('../../components/system/AndroidNativeUpdateManager');
        render(createElement(AndroidNativeUpdateManager));

        await waitFor(() => {
            expect(typeof requestListener).toBe('function');
        });

        await act(async () => {
            requestListener?.({ interactive: true });
        });

        await waitFor(() => {
            expect(continueMock).toHaveBeenCalledWith('0.5.2');
        });
        expect(prepareMock).not.toHaveBeenCalled();
    });

    it('AndroidNativeUpdateManager 已恢复错误态时，手动重试应重新发起 prepare', async () => {
        vi.resetModules();

        let requestListener: ((request: { interactive?: boolean }) => void) | null = null;
        const prepareMock = vi.fn().mockResolvedValue({ status: 'installer-launched' });

        vi.doMock('../mobile/androidNativeUpdates', () => ({
            HIDDEN_ANDROID_NATIVE_UPDATE_STATE: {
                phase: 'hidden',
                blocking: false,
            },
            checkAndroidNativeUpdateAvailability: vi.fn().mockResolvedValue({
                available: true,
                manifest: {
                    version: '0.5.2',
                    url: 'https://example.com/app.apk',
                    forceUpdate: false,
                    forceUpdateTitle: '需要升级',
                    forceUpdateMessage: '请安装新版应用',
                },
            }),
            continueAndroidNativeUpdateInstall: vi.fn(),
            mapNativeUpdateEventToState: vi.fn(() => ({
                phase: 'error',
                blocking: true,
            })),
            openAndroidUnknownSourcesSettings: vi.fn(),
            prepareAndroidNativeUpdateInstall: prepareMock,
            readPreparedAndroidUpdateState: vi.fn().mockResolvedValue({
                version: '0.5.2',
                status: 'error',
                errorMessage: '网络超时',
            }),
            requestAndroidNativeUpdateCheck: vi.fn(),
            readAndroidNativeUpdateConfig: vi.fn(() => ({
                enabled: true,
                manifestUrl: 'https://example.com/latest.json',
                channel: 'stable',
            })),
            subscribeAndroidNativeUpdateRequests: vi.fn((listener) => {
                requestListener = listener;
                return () => undefined;
            }),
            subscribeAndroidNativeUpdateState: vi.fn().mockResolvedValue({
                remove: async () => undefined,
            }),
        }));
        vi.doMock('../mobile/androidRuntime', () => ({
            isNativeAndroidRuntime: () => true,
        }));
        vi.doMock('../../contexts/ToastContext', () => ({
            useToast: () => ({
                warning: vi.fn(),
                success: vi.fn(),
                info: vi.fn(),
                error: vi.fn(),
            }),
        }));
        vi.doMock('react-i18next', () => ({
            useTranslation: () => ({
                t: (key: string) => key,
            }),
        }));
        vi.doMock('../../components/system/AndroidNativeUpdateGate', () => ({
            AndroidNativeUpdateGate: () => null,
        }));

        const { AndroidNativeUpdateManager } = await import('../../components/system/AndroidNativeUpdateManager');
        render(createElement(AndroidNativeUpdateManager));

        await waitFor(() => {
            expect(typeof requestListener).toBe('function');
        });
        expect(prepareMock).not.toHaveBeenCalled();

        await act(async () => {
            requestListener?.({ interactive: true });
        });

        await waitFor(() => {
            expect(prepareMock).toHaveBeenCalledTimes(1);
        });
    });

    it('游戏包增量安装方法在老 Android 壳不可用时，回退到全量下载', async () => {
        vi.resetModules();

        const installGamePackageIncremental = vi.fn().mockRejectedValue(
            new Error('GamePackage.installGamePackageIncremental() is not implemented on android'),
        );
        const installGamePackage = vi.fn().mockResolvedValue({
            gameId: 'dicethrone',
            runtimeChannel: 'stable',
            status: 'installed',
            assetPackVersion: '0.5.61-dicethrone-pkg-2026-04-25T15-35-05-209Z',
            assetRootPath: '/data/user/0/top.easyboardgame.app/files/game-packages/dicethrone/current/assets',
            installedAt: 123456,
        });

        vi.doMock('@capacitor/core', async (importOriginal) => {
            const actual = await importOriginal<typeof import('@capacitor/core')>();
            return {
                ...actual,
                Capacitor: {
                    ...actual.Capacitor,
                    isNativePlatform: () => true,
                    getPlatform: () => 'android',
                },
                registerPlugin: vi.fn(() => ({
                    addListener: vi.fn().mockResolvedValue({
                        remove: async () => undefined,
                    }),
                    ensureNotificationPermission: vi.fn().mockResolvedValue({
                        required: false,
                        granted: true,
                        canPrompt: false,
                        state: 'granted',
                    }),
                    installGamePackageIncremental,
                    installGamePackage,
                })),
            };
        });
        vi.doMock('../mobile/androidRuntime', () => ({
            isNativeAndroidRuntime: () => true,
        }));

        const { createNativeGamePackageInstallHandle } = await import('../../features/mobile-packages/nativeGamePackagePlugin');

        const handle = await createNativeGamePackageInstallHandle({
            gameId: 'dicethrone',
            runtimeChannel: 'stable',
            assetPackId: 'dicethrone',
            assetPackVersion: '0.5.61-dicethrone-pkg-2026-04-25T15-35-05-209Z',
            assetPackUrl: 'https://assets.easyboardgame.top/official/mobile-packages/android/stable/bundles/dicethrone/0.5.61-dicethrone-pkg-2026-04-25T15-35-05-209Z.zip',
            assetPackChecksum: '05c4067df2ba9f44824a6d6caf477397606ebc104c93601a91a83273b6f20790',
            assetPackFileIndexUrl: 'https://assets.easyboardgame.top/official/mobile-packages/android/stable/file-index/dicethrone/0.5.61-dicethrone-pkg-2026-04-25T15-35-05-209Z.json',
            assetPackFileIndexChecksum: '26754117a37bb3dcd2f9c9c5b1e369e9ec907ba68fe26634ee78f9d94a612c41',
            source: 'remote',
        }, {
            onStateChange: vi.fn(),
            onInstalledAssetBaseUrl: vi.fn(),
        });

        expect(handle).not.toBeNull();

        const state = await handle!.finished;

        expect(installGamePackageIncremental).toHaveBeenCalledTimes(1);
        expect(installGamePackage).toHaveBeenCalledTimes(1);
        expect(state).toMatchObject({
            status: 'installed',
            installedVersion: '0.5.61-dicethrone-pkg-2026-04-25T15-35-05-209Z',
            localAssetBaseUrl: '/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/dicethrone/current/assets',
        });
    });
});

describe('socketConnectionConfig', () => {
    it('允许 polling 回退时仍然优先 websocket', () => {
        expect(getSocketIoTransports()).toEqual(['websocket', 'polling']);
        expect(shouldTryAllSocketTransports()).toBe(true);
    });
});
