import { describe, it, expect, vi, afterEach } from 'vitest';
import { createScopedLogger } from '../logger';
import { parseNamespaceLiteral, collectReferencesFromContent } from '../../../scripts/verify/i18n-check';
import {
    collectImplicitCandidateFiles,
    shouldIncludeChangedGitFile,
} from '../../../scripts/infra/check-file-encoding.mjs';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('i18n 静态检查工具', () => {
    it('解析 namespace 数组字面量', () => {
        expect(parseNamespaceLiteral("['lobby', 'auth']")).toEqual(['lobby', 'auth']);
    });

    it('识别 useTranslation/Toast/i18nKey 的引用', () => {
        const content = `
            import { useTranslation } from 'react-i18next';
            const { t } = useTranslation(['lobby', 'auth']);
            t('home.title');
            t('auth:login.title');
            t('welcome', { ns: 'lobby' });
            toast.error({ kind: 'i18n', key: 'error.roomFull', ns: 'lobby' });
        `;
        const result = collectReferencesFromContent(content, 'demo.tsx', {
            defaultNamespace: 'common',
            knownNamespaces: new Set(['common', 'lobby', 'auth']),
        });
        const byKey = (key: string) => result.references.find((item) => item.key === key);

        expect(byKey('home.title')?.namespaces).toEqual(['lobby', 'auth']);
        expect(byKey('login.title')?.namespaces).toEqual(['auth']);
        expect(byKey('welcome')?.namespaces).toEqual(['lobby']);
        expect(byKey('error.roomFull')?.namespaces).toEqual(['lobby']);
    });

    it('动态 key 会产生告警', () => {
        const content = `
            import { useTranslation } from 'react-i18next';
            const { t } = useTranslation('lobby');
            t(\`home.${'${id}'}\`);
        `;
        const result = collectReferencesFromContent(content, 'demo.tsx', {
            defaultNamespace: 'common',
            knownNamespaces: new Set(['common', 'lobby']),
        });
        expect(result.warnings.some((warning) => warning.type === 'dynamic-key')).toBe(true);
    });
});

describe('logger scoped helper', () => {
    it('输出单行 JSON 作用域日志', () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const scopedLogger = createScopedLogger('TEST_SCOPE');

        scopedLogger.info('hello', { value: 1, ok: true });

        expect(logSpy).toHaveBeenCalled();
        const firstCall = logSpy.mock.calls[0];
        expect(String(firstCall[0])).toContain('[TEST_SCOPE] {"stage":"hello","value":1,"ok":true}');
    });
});

describe('encoding check candidate scope', () => {
    it('补充默认范围外的正式改动文件，同时保留默认目录', () => {
        expect(collectImplicitCandidateFiles(
            ['src/app.ts', 'docs/guide.md'],
            [
                'vite.config.ts',
                'public/locales/zh-CN/lobby.json',
                '.github/workflows/android-release-build.yml',
                'evidence/debug-note.md',
            ],
        )).toEqual([
            '.github/workflows/android-release-build.yml',
            'docs/guide.md',
            'public/locales/zh-CN/lobby.json',
            'src/app.ts',
            'vite.config.ts',
        ]);
    });

    it('过滤工具噪音和 Android 生成产物，只放行正式改动文件', () => {
        expect(shouldIncludeChangedGitFile('vite.config.ts')).toBe(true);
        expect(shouldIncludeChangedGitFile('public/locales/en/lobby.json')).toBe(true);
        expect(shouldIncludeChangedGitFile('.github/workflows/android-release-build.yml')).toBe(true);
        expect(shouldIncludeChangedGitFile('android/build.gradle')).toBe(true);

        expect(shouldIncludeChangedGitFile('.kiro/specs/demo/tasks.md')).toBe(false);
        expect(shouldIncludeChangedGitFile('.windsurf/skills/demo/SKILL.md')).toBe(false);
        expect(shouldIncludeChangedGitFile('evidence/scope-audit.md')).toBe(false);
        expect(shouldIncludeChangedGitFile('tmp/temp-reducer-diff.txt')).toBe(false);
        expect(shouldIncludeChangedGitFile('test-out.txt')).toBe(false);
        expect(shouldIncludeChangedGitFile('android/app/src/main/assets/public/locales/en/lobby.json')).toBe(false);
    });
});
