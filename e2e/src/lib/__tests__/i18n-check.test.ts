import { describe, it, expect, vi, afterEach } from 'vitest';
import { createScopedLogger } from '../logger';
import {
    I18N_RUNTIME_MODE,
    normalizeI18nLanguage,
    LANGUAGE_OPTIONS,
    RUNTIME_SUPPORTED_LANGUAGES,
} from '../i18n/types';
import {
    parseNamespaceLiteral,
    collectManifestReferencesFromContent,
    collectStaticKeyReferencesFromContent,
    collectReferencesFromContent,
} from '../../../scripts/verify/i18n-check';
import {
    collectImplicitCandidateFiles,
    shouldIncludeChangedGitFile,
} from '../../../scripts/infra/check-file-encoding.mjs';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('i18n language normalization', () => {
    it('maps browser variants to supported locales', () => {
        expect(normalizeI18nLanguage('en-US')).toBe(I18N_RUNTIME_MODE === 'android' ? 'zh-CN' : 'en');
        expect(normalizeI18nLanguage('en-GB')).toBe(I18N_RUNTIME_MODE === 'android' ? 'zh-CN' : 'en');
        expect(normalizeI18nLanguage('zh')).toBe('zh-CN');
        expect(normalizeI18nLanguage('zh-TW')).toBe('zh-CN');
        expect(normalizeI18nLanguage(undefined)).toBe('zh-CN');
        expect(normalizeI18nLanguage('fr-FR')).toBe('zh-CN');
    });

    it('keeps runtime language options aligned with the current build mode', () => {
        if (I18N_RUNTIME_MODE === 'android') {
            expect(RUNTIME_SUPPORTED_LANGUAGES).toEqual(['zh-CN']);
            expect(LANGUAGE_OPTIONS).toEqual([{ code: 'zh-CN', label: '中文' }]);
            return;
        }

        expect(RUNTIME_SUPPORTED_LANGUAGES).toEqual(['zh-CN', 'en']);
        expect(LANGUAGE_OPTIONS).toEqual([
            { code: 'zh-CN', label: '中文' },
            { code: 'en', label: 'English' },
        ]);
    });
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
            t(\`home.pre${'${id}'}\`);
        `;
        const result = collectReferencesFromContent(content, 'demo.tsx', {
            defaultNamespace: 'common',
            knownNamespaces: new Set(['common', 'lobby']),
        });
        expect(result.warnings.some((warning) => warning.type === 'dynamic-key')).toBe(true);
    });

    it('i18n.exists 命名空间一致时可作为 t(variable) 的保护条件', () => {
        const content = `
            import { useTranslation } from 'react-i18next';
            const { t } = useTranslation('game-summonerwars');
            const key = \`phase.${'${phaseId}'}\`;
            if (i18n.exists(key, { ns: 'game-summonerwars' })) {
                t(key);
            }
        `;
        const result = collectReferencesFromContent(content, 'demo.tsx', {
            defaultNamespace: 'common',
            knownNamespaces: new Set(['common', 'game-summonerwars']),
        });
        expect(result.warnings.some((warning) => warning.type === 'dynamic-key')).toBe(false);
        expect(result.warnings.some((warning) => warning.type === 'exists-namespace-mismatch')).toBe(false);
    });

    it('i18n.exists 命名空间不一致时会产生 mismatch 告警', () => {
        const content = `
            import { useTranslation } from 'react-i18next';
            const { t } = useTranslation('game-summonerwars');
            const key = 'phase.summon';
            if (i18n.exists(key, { ns: 'common' })) {
                t(key);
            }
        `;
        const result = collectReferencesFromContent(content, 'demo.tsx', {
            defaultNamespace: 'common',
            knownNamespaces: new Set(['common', 'game-summonerwars']),
        });
        expect(result.warnings).toContainEqual(expect.objectContaining({
            type: 'exists-namespace-mismatch',
            key: 'key',
        }));
    });

    it('混合字面量与动态 namespace 时，仍保留可确定的字面量 namespace', () => {
        const content = `
            import { useTranslation } from 'react-i18next';
            const gameNamespace = 'game-smashup';
            const { t } = useTranslation(['lobby', gameNamespace]);
            t('createRoom.title');
        `;

        const result = collectReferencesFromContent(content, 'demo.tsx', {
            defaultNamespace: 'common',
            knownNamespaces: new Set(['common', 'lobby', 'game-smashup']),
        });

        expect(result.references).toContainEqual(expect.objectContaining({
            key: 'createRoom.title',
            namespaces: ['lobby'],
        }));
        expect(result.warnings.some((warning) => warning.type === 'dynamic-namespace')).toBe(false);
    });

    it('识别 template literal 的单段动态模式并生成可验证引用', () => {
        const content = `
            import { useTranslation } from 'react-i18next';
            const { t } = useTranslation('game-summonerwars');
            t(\`phase.${'${phaseId}'}\`);
            t(\`statusBanners.abilityNames.${'${abilityId}'}\`);
        `;

        const result = collectReferencesFromContent(content, 'demo.tsx', {
            defaultNamespace: 'common',
            knownNamespaces: new Set(['common', 'game-summonerwars']),
        });

        expect(result.references).toEqual(expect.arrayContaining([
            expect.objectContaining({
                key: 'phase.*',
                namespaces: ['game-summonerwars'],
                patternSegments: ['phase', null],
            }),
            expect.objectContaining({
                key: 'statusBanners.abilityNames.*',
                namespaces: ['game-summonerwars'],
                patternSegments: ['statusBanners', 'abilityNames', null],
            }),
        ]));
        expect(result.warnings.some((warning) => warning.type === 'dynamic-key')).toBe(false);
    });

    it('识别变量承载的 template literal 模式，并展开可确定的前缀字面量', () => {
        const content = `
            import { useTranslation } from 'react-i18next';
            const { t } = useTranslation('game-dicethrone');
            const i18nPrefix = isToken ? 'tokens' : 'statusEffects';
            const descriptionKey = \`${'${i18nPrefix}'}.${'${effectId}'}.description\`;
            const nameKey = \`${'${i18nPrefix}'}.${'${effectId}'}.name\`;
            t(descriptionKey, { returnObjects: true });
            t(nameKey);
        `;

        const result = collectReferencesFromContent(content, 'demo.tsx', {
            defaultNamespace: 'common',
            knownNamespaces: new Set(['common', 'game-dicethrone']),
        });

        expect(result.references).toEqual(expect.arrayContaining([
            expect.objectContaining({
                key: 'tokens.*.description',
                namespaces: ['game-dicethrone'],
                patternSegments: ['tokens', null, 'description'],
            }),
            expect.objectContaining({
                key: 'statusEffects.*.description',
                namespaces: ['game-dicethrone'],
                patternSegments: ['statusEffects', null, 'description'],
            }),
            expect.objectContaining({
                key: 'tokens.*.name',
                namespaces: ['game-dicethrone'],
                patternSegments: ['tokens', null, 'name'],
            }),
            expect.objectContaining({
                key: 'statusEffects.*.name',
                namespaces: ['game-dicethrone'],
                patternSegments: ['statusEffects', null, 'name'],
            }),
        ]));
        expect(result.warnings.some((warning) => warning.type === 'dynamic-key')).toBe(false);
    });

    it('命令校验直接返回自然语言错误文案会产生告警', () => {
        const content = `
            export function validate() {
                return { valid: false, error: 'Not in play phase' };
            }
        `;
        const result = collectReferencesFromContent(content, 'demo.ts', {
            defaultNamespace: 'common',
            knownNamespaces: new Set(['common']),
        });

        expect(result.warnings).toContainEqual(expect.objectContaining({
            type: 'raw-validation-error',
            key: 'Not in play phase',
        }));
    });

    it('识别 manifest 中的 setupOptions 与基础展示 key', () => {
        const content = `
            const entry = {
                titleKey: 'games.smashup.title',
                descriptionKey: 'games.smashup.description',
                playersKey: 'games.smashup.players',
                setupOptions: {
                    expansions: {
                        labelKey: 'games.smashup.setup.expansions.label',
                        options: [
                            { value: 'titans', labelKey: 'games.smashup.setup.expansions.titans' },
                        ],
                    },
                },
            };
        `;

        const result = collectManifestReferencesFromContent(
            content,
            'D:/gongzuo/webgame/BoardGame/src/games/smashup/manifest.ts',
            new Set(['lobby', 'game-smashup']),
        );

        expect(result).toEqual(expect.arrayContaining([
            expect.objectContaining({
                key: 'games.smashup.title',
                namespaces: ['lobby'],
            }),
            expect.objectContaining({
                key: 'games.smashup.description',
                namespaces: ['lobby'],
            }),
            expect.objectContaining({
                key: 'games.smashup.players',
                namespaces: ['lobby'],
            }),
            expect.objectContaining({
                key: 'setup.expansions.label',
                namespaces: ['game-smashup'],
            }),
            expect.objectContaining({
                key: 'setup.expansions.titans',
                namespaces: ['game-smashup'],
            }),
        ]));
    });

    it('识别游戏目录中的静态 *Key 配置，并推断到游戏 namespace', () => {
        const content = `
            export const CONFIG = {
                titleKey: 'interaction.selectPlayer',
                labelKey: 'choices.confirm',
                nameKey: 'factions.pirates.name',
            };
        `;

        const result = collectStaticKeyReferencesFromContent(
            content,
            'D:/gongzuo/webgame/BoardGame/src/games/smashup/ui/factionMeta.ts',
            new Set(['game-smashup', 'common']),
        );

        expect(result).toEqual(expect.arrayContaining([
            expect.objectContaining({
                key: 'interaction.selectPlayer',
                namespaces: ['game-smashup'],
            }),
            expect.objectContaining({
                key: 'choices.confirm',
                namespaces: ['game-smashup'],
            }),
            expect.objectContaining({
                key: 'factions.pirates.name',
                namespaces: ['game-smashup'],
            }),
        ]));
    });

    it('识别 useTranslation 指向的非游戏 namespace 静态 *Key 配置', () => {
        const content = `
            import { useTranslation } from 'react-i18next';
            const { t } = useTranslation('lobby');
            const ITEMS = [
                { labelKey: 'ai.capture' },
                { labelKey: 'ai.local' },
            ];
            void t;
        `;

        const result = collectStaticKeyReferencesFromContent(
            content,
            'D:/gongzuo/webgame/BoardGame/src/components/lobby/AiSupportPills.tsx',
            new Set(['lobby', 'common']),
        );

        expect(result).toEqual(expect.arrayContaining([
            expect.objectContaining({
                key: 'ai.capture',
                namespaces: ['lobby'],
            }),
            expect.objectContaining({
                key: 'ai.local',
                namespaces: ['lobby'],
            }),
        ]));
    });

    it('忽略非翻译语义的 *Key 字段，例如 sfxKey/effectKey', () => {
        const content = `
            export const FX = {
                sfxKey: 'magic.general.arcane.hit_001',
                effectKey: 'bonusDie.effect.fire',
                labelKey: 'choices.confirm',
            };
        `;

        const result = collectStaticKeyReferencesFromContent(
            content,
            'D:/gongzuo/webgame/BoardGame/src/games/smashup/data/demo.ts',
            new Set(['game-smashup']),
        );

        expect(result).toEqual([
            expect.objectContaining({
                key: 'choices.confirm',
                namespaces: ['game-smashup'],
            }),
        ]);
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
