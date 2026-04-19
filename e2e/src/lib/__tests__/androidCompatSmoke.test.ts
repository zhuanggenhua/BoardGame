import {
    analyzeRawScreenshot,
    buildCompatNavigationUrl,
    detectFriendlyPrompt,
    extractUiStrings,
    parseMajorVersion,
    parsePackageVersionName,
    resolveCompatSmokeRoutePath,
} from '../../../scripts/mobile/android-compat-smoke-shared.mjs';

describe('androidCompatSmoke helpers', () => {
    it('能从版本字符串里取出主版本号', () => {
        expect(parseMajorVersion('137.0.7151.72')).toBe(137);
        expect(parseMajorVersion('Current WebView package (name, version): (com.google.android.webview, 88.0.4324.181)')).toBe(88);
        expect(parseMajorVersion('')).toBeNull();
    });

    it('能从 dumpsys 或 webviewupdate 输出中提取版本号', () => {
        expect(parsePackageVersionName('versionName=88.0.4324.181')).toBe('88.0.4324.181');
        expect(parsePackageVersionName('Current WebView package (name, version): (com.google.android.webview, 137.0.7151.72)')).toBe('137.0.7151.72');
    });

    it('能从 UI dump 中提取文本并识别友好提示', () => {
        const values = extractUiStrings('<node text="页面没有正常显示" content-desc="刷新重试" /><node text="返回大厅" />');
        expect(values).toEqual(['页面没有正常显示', '刷新重试', '返回大厅']);
        expect(detectFriendlyPrompt(values)).toBe(true);
    });

    it('能把 route 或深链统一转换成 WebView 内导航路径', () => {
        expect(resolveCompatSmokeRoutePath('/play/dicethrone/tutorial')).toBe('/play/dicethrone/tutorial');
        expect(resolveCompatSmokeRoutePath('top.easyboardgame.app://play/dicethrone/local?seed=1')).toBe('/play/dicethrone/local?seed=1');
        expect(resolveCompatSmokeRoutePath('https://easyboardgame.top/play/dicethrone/local?seed=1')).toBe('/play/dicethrone/local?seed=1');
        expect(buildCompatNavigationUrl('/play/dicethrone/tutorial')).toBe('http://localhost/play/dicethrone/tutorial');
    });

    it('能根据像素分布识别纯黑截图风险', () => {
        const blackFrame = analyzeRawScreenshot({
            data: Buffer.from([
                0, 0, 0, 255,
                0, 0, 0, 255,
                0, 0, 0, 255,
                0, 0, 0, 255,
            ]),
            width: 2,
            height: 2,
            channels: 4,
        });
        expect(blackFrame.blackScreenSuspected).toBe(true);

        const brightFrame = analyzeRawScreenshot({
            data: Buffer.from([
                255, 255, 255, 255,
                255, 255, 255, 255,
                255, 255, 255, 255,
                255, 255, 255, 255,
            ]),
            width: 2,
            height: 2,
            channels: 4,
        });
        expect(brightFrame.blackScreenSuspected).toBe(false);
    });
});
