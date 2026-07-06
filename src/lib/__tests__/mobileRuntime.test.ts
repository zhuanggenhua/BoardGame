import { describe, expect, it } from 'vitest';
import { getNativeMobileRuntimeDiagnostics } from '../mobile/mobileRuntime';

describe('mobile runtime detection', () => {
    it('treats androidBridge as the native Android shell even when imported Capacitor reports web', () => {
        const diagnostics = getNativeMobileRuntimeDiagnostics({
            capacitor: {
                getPlatform: () => 'web',
                isNativePlatform: () => false,
            },
            windowObject: {
                androidBridge: {},
            },
        });

        expect(diagnostics.nativeMobile).toBe(true);
        expect(diagnostics.nativeAndroid).toBe(true);
        expect(diagnostics.nativeIos).toBe(false);
        expect(diagnostics.platform).toBe('android');
        expect(diagnostics.hasAndroidBridge).toBe(true);
    });

    it('uses the window Capacitor signal when the import runtime is only a web stub', () => {
        const diagnostics = getNativeMobileRuntimeDiagnostics({
            capacitor: {
                getPlatform: () => 'web',
                isNativePlatform: () => false,
            },
            windowObject: {
                Capacitor: {
                    getPlatform: () => 'android',
                    isNativePlatform: () => true,
                },
            },
        });

        expect(diagnostics.nativeMobile).toBe(true);
        expect(diagnostics.nativeAndroid).toBe(true);
        expect(diagnostics.platform).toBe('android');
    });
});
