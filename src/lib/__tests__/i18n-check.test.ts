import fs from 'fs';
import path from 'path';
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
    collectDiceThroneAbilityChoiceFaceLabelReferences,
    collectDiceThroneRawContractWarningsFromContent,
    collectZhCnLocaleEnglishWarnings,
    collectMissingTranslations,
    createWarningBaselineId,
    partitionWarningsAgainstBaseline,
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

    it('玩家可见本地化文案不得包含审查或 AI 过程话术', () => {
        const forbiddenPhrases = [
            '上屏',
            'off-screen',
            '看清后可关闭',
            '阅读后关闭',
            '确认是否受影响',
            '确认一下是否受影响',
            '如果有就给我看图',
            'setup 队列',
            'setup queue',
            '缺正面',
            'Front missing',
            '叛徒忽略事件',
        ];
        const forbiddenPatterns = [
            {
                label: '剧本编号+查阅拼接标题',
                pattern: /剧本[0-9一二三四五六七八九十]+查阅/,
            },
        ];
        const localeRoot = path.resolve('public/locales');
        const files: string[] = [];
        const collectFiles = (dir: string) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const entryPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    collectFiles(entryPath);
                } else if (entry.isFile() && entry.name.endsWith('.json')) {
                    files.push(entryPath);
                }
            }
        };
        const violations: string[] = [];
        const visit = (value: unknown, trail: string[], sourceFile: string) => {
            if (typeof value === 'string') {
                for (const phrase of forbiddenPhrases) {
                    if (value.includes(phrase)) {
                        violations.push(`${path.relative(process.cwd(), sourceFile)}:${trail.join('.')} -> ${phrase} in "${value}"`);
                    }
                }
                for (const { label, pattern } of forbiddenPatterns) {
                    if (pattern.test(value)) {
                        violations.push(`${path.relative(process.cwd(), sourceFile)}:${trail.join('.')} -> ${label} in "${value}"`);
                    }
                }
                return;
            }
            if (!value || typeof value !== 'object') {
                return;
            }
            for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
                visit(child, [...trail, key], sourceFile);
            }
        };

        collectFiles(localeRoot);
        for (const file of files) {
            visit(JSON.parse(fs.readFileSync(file, 'utf-8')), [], file);
        }

        expect(violations).toEqual([]);
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

    it('能解析 DiceThrone 英雄名 helper 返回的有限 key 集合', () => {
        const content = `
            import { useTranslation } from 'react-i18next';
            import { getDiceThroneCharacterNameKey } from '../domain/core-types';
            const { t } = useTranslation('game-dicethrone');
            const selectedCharacterNameKey = getDiceThroneCharacterNameKey(selectedCharacters[pid]);
            t(selectedCharacterNameKey);
        `;
        const result = collectReferencesFromContent(content, 'src/games/dicethrone/ui/DiceThroneHeroSelection.tsx', {
            defaultNamespace: 'game-dicethrone',
            knownNamespaces: new Set(['game-dicethrone']),
        });

        expect(result.warnings).toEqual([]);
        expect(result.references).toEqual(expect.arrayContaining([
            expect.objectContaining({ key: 'characters.monk', namespaces: ['game-dicethrone'] }),
            expect.objectContaining({ key: 'characters.barbarian', namespaces: ['game-dicethrone'] }),
            expect.objectContaining({ key: 'characters.pyromancer', namespaces: ['game-dicethrone'] }),
        ]));
    });

    it('DiceThrone 继续使用 hero.* 旧前缀时会产生阻断告警', () => {
        const content = `
            import { useTranslation } from 'react-i18next';
            const { t } = useTranslation('game-dicethrone');
            t(\`hero.${'${player.characterId}'}\`);
        `;
        const result = collectReferencesFromContent(content, 'src/games/dicethrone/ui/OpponentHeader.tsx', {
            defaultNamespace: 'game-dicethrone',
            knownNamespaces: new Set(['game-dicethrone']),
        });

        expect(result.warnings).toContainEqual(expect.objectContaining({
            type: 'deprecated-dicethrone-hero-key',
            key: 'hero.*',
        }));
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

    it('识别成员表达式上的字面量联合，并展开为具体 key', () => {
        const content = `
            import { useTranslation } from 'react-i18next';

            interface TelekinesisTargetModeState {
                abilityId: 'telekinesis' | 'high_telekinesis_instead';
            }

            interface Props {
                telekinesisTargetMode: TelekinesisTargetModeState | null;
            }

            function Demo({ telekinesisTargetMode }: Props) {
                const { t } = useTranslation('game-summonerwars');
                if (!telekinesisTargetMode) return null;
                t(\`statusBanners.abilityNames.${'${telekinesisTargetMode.abilityId}'}\`);
                return null;
            }
        `;

        const result = collectReferencesFromContent(content, 'demo.tsx', {
            defaultNamespace: 'common',
            knownNamespaces: new Set(['common', 'game-summonerwars']),
        });

        expect(result.references).toEqual(expect.arrayContaining([
            expect.objectContaining({
                key: 'statusBanners.abilityNames.telekinesis',
                namespaces: ['game-summonerwars'],
            }),
            expect.objectContaining({
                key: 'statusBanners.abilityNames.high_telekinesis_instead',
                namespaces: ['game-summonerwars'],
            }),
        ]));
        expect(result.references).not.toEqual(expect.arrayContaining([
            expect.objectContaining({
                key: 'statusBanners.abilityNames.*',
            }),
        ]));
        expect(result.warnings.some((warning) => warning.type === 'dynamic-key')).toBe(false);
    });

    it('能从解构函数参数类型中反推成员表达式联合并展开具体 key', () => {
        const content = `
            import { useTranslation } from 'react-i18next';

            type CharacterId = 'monk' | 'barbarian' | 'zhanshujia';
            interface HeroState { characterId: CharacterId; }
            interface HeroPanelProps { player: HeroState; }

            function HeroPanel({ player }: HeroPanelProps) {
                const { t } = useTranslation('game-dicethrone');
                t(\`hero.${'${player.characterId}'}\`);
                return null;
            }
        `;

        const result = collectReferencesFromContent(content, 'src/games/dicethrone/ui/Demo.tsx', {
            defaultNamespace: 'game-dicethrone',
            knownNamespaces: new Set(['game-dicethrone']),
        });

        expect(result.references).toEqual(expect.arrayContaining([
            expect.objectContaining({ key: 'hero.monk', namespaces: ['game-dicethrone'] }),
            expect.objectContaining({ key: 'hero.barbarian', namespaces: ['game-dicethrone'] }),
            expect.objectContaining({ key: 'hero.zhanshujia', namespaces: ['game-dicethrone'] }),
        ]));
        expect(result.references).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ key: 'hero.*' }),
        ]));
    });

    it('summonerwars StatusBanners 能展开 abilityId 联合并覆盖 instead key', () => {
        const filePath = path.resolve('src/games/summonerwars/ui/StatusBanners.tsx');
        const content = fs.readFileSync(filePath, 'utf-8');
        const result = collectReferencesFromContent(content, filePath, {
            defaultNamespace: 'common',
            knownNamespaces: new Set(['common', 'game-summonerwars']),
        });

        expect(result.references).toEqual(expect.arrayContaining([
            expect.objectContaining({
                key: 'statusBanners.abilityNames.telekinesis_instead',
                namespaces: ['game-summonerwars'],
            }),
            expect.objectContaining({
                key: 'statusBanners.abilityNames.high_telekinesis_instead',
                namespaces: ['game-summonerwars'],
            }),
            expect.objectContaining({
                key: 'statusBanners.abilityNames.mind_transmission',
                namespaces: ['game-summonerwars'],
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

    it('createSimpleChoice 直接使用可见标题且未写 titleKey 时会产生告警；写了 titleKey 则放行', () => {
        const content = `
            createSimpleChoice(
                'choice-1',
                playerId,
                '新娘：选择第一个效果',
                options,
                { sourceId: 'demo', targetType: 'generic' },
            );

            createSimpleChoice(
                'choice-2',
                playerId,
                '新娘：选择第二个效果',
                options,
                { sourceId: 'demo', targetType: 'generic', titleKey: 'ui.titan_the_bride_start_second_effect_title' },
            );
        `;
        const result = collectReferencesFromContent(content, 'demo.ts', {
            defaultNamespace: 'common',
            knownNamespaces: new Set(['common', 'game-smashup']),
        });

        expect(result.warnings).toContainEqual(expect.objectContaining({
            type: 'raw-simple-choice-title',
            key: '新娘：选择第一个效果',
            detail: expect.stringContaining('请改成 titleKey'),
        }));
        expect(result.warnings).not.toContainEqual(expect.objectContaining({
            type: 'raw-simple-choice-title',
            key: '新娘：选择第二个效果',
        }));
    });

    it('会拦截 helper 透传到 createSimpleChoice 的可见标题；补 titleKey 参数后放行', () => {
        const content = `
            function buildPrompt(interactionId, playerId, title, titleKey) {
                return createSimpleChoice(
                    interactionId,
                    playerId,
                    title,
                    options,
                    { sourceId: 'demo', targetType: 'generic', titleKey },
                );
            }

            buildPrompt('choice-1', playerId, '墓园：挖掘这里一张你的埋葬牌');
            buildPrompt('choice-2', playerId, '墓园：挖掘这里一张你的埋葬牌', 'ui.skeletons_graveyard_title');
        `;
        const result = collectReferencesFromContent(content, 'demo.ts', {
            defaultNamespace: 'common',
            knownNamespaces: new Set(['common', 'game-smashup']),
        });

        expect(result.warnings).toContainEqual(expect.objectContaining({
            type: 'raw-simple-choice-title',
            key: '墓园：挖掘这里一张你的埋葬牌',
            source: 'buildPrompt.title',
        }));
        expect(result.warnings.filter((warning) => (
            warning.type === 'raw-simple-choice-title'
            && warning.source === 'buildPrompt.title'
        ))).toHaveLength(1);
    });

    it('createSimpleChoice 内联可见 label 缺少 labelKey 时会产生告警', () => {
        const content = `
            createSimpleChoice(
                'choice-1',
                playerId,
                '选择一个分支',
                [
                    { id: 'raw', label: '抽两张牌', value: { draw: true }, displayMode: 'button' },
                    { id: 'keyed', label: '放置一个 +1 指示物', labelKey: 'ui.place_counter', value: { place: true }, displayMode: 'button' },
                ],
                { sourceId: 'demo', targetType: 'generic', titleKey: 'ui.demo_title' },
            );
        `;
        const result = collectReferencesFromContent(content, 'demo.ts', {
            defaultNamespace: 'common',
            knownNamespaces: new Set(['common', 'game-smashup']),
        });

        expect(result.warnings).toContainEqual(expect.objectContaining({
            type: 'raw-simple-choice-option-label',
            key: '抽两张牌',
        }));
        expect(result.warnings).not.toContainEqual(expect.objectContaining({
            type: 'raw-simple-choice-option-label',
            key: '放置一个 +1 指示物',
        }));
    });

    it('PromptOption 变量中的可见 label 缺少 labelKey 时会产生告警', () => {
        const content = `
            const options = [
                { id: 'raw', label: '放到鲜血领主上', value: { mode: 'store' }, displayMode: 'button' },
                { id: 'keyed', label: '抽 2 张牌', labelKey: 'ui.draw_two_cards', value: { draw: true }, displayMode: 'button' },
                { label: 'Debug only', value: 1 },
            ];
        `;
        const result = collectReferencesFromContent(content, 'demo.ts', {
            defaultNamespace: 'common',
            knownNamespaces: new Set(['common', 'game-smashup']),
        });

        expect(result.warnings).toContainEqual(expect.objectContaining({
            type: 'raw-prompt-option-label',
            key: '放到鲜血领主上',
        }));
        expect(result.warnings).not.toContainEqual(expect.objectContaining({
            type: 'raw-prompt-option-label',
            key: '抽 2 张牌',
        }));
        expect(result.warnings).not.toContainEqual(expect.objectContaining({
            type: 'raw-prompt-option-label',
            key: 'Debug only',
        }));
    });

    it('createSkipOption 直接使用可见 label 时会产生告警', () => {
        const content = `
            const options = [createSkipOption('跳过这次效果')];
            const keyedOptions = [createSkipOption('ui.skip')];
            const keyedFallbackOptions = [createSkipOption('跳过这次效果', 'ui.skip_effect')];
        `;
        const result = collectReferencesFromContent(content, 'demo.ts', {
            defaultNamespace: 'common',
            knownNamespaces: new Set(['common']),
        });

        expect(result.warnings).toContainEqual(expect.objectContaining({
            type: 'raw-create-skip-label',
            key: '跳过这次效果',
        }));
        expect(result.warnings).not.toContainEqual(expect.objectContaining({
            type: 'raw-create-skip-label',
            key: 'ui.skip',
        }));
        expect(result.warnings.filter((warning) => (
            warning.type === 'raw-create-skip-label'
            && warning.key === '跳过这次效果'
        ))).toHaveLength(1);
    });

    it('不会把注释里的示例 label / createSkipOption 当成真实 UI 文案告警', () => {
        const content = `
            // { id: '__cancel__', label: '取消', value: { __cancel__: true } }
            /* createSkipOption('跳过这次效果') */
            const options = [{ id: 'keyed', label: 'ui.skip', labelKey: 'ui.skip', value: { ok: true }, displayMode: 'button' }];
        `;
        const result = collectReferencesFromContent(content, 'demo.ts', {
            defaultNamespace: 'common',
            knownNamespaces: new Set(['common']),
        });

        expect(result.warnings).toEqual([]);
    });

    it('会拦截伪 *Key 字段里的可见文案，但放过 key 模板', () => {
        const content = `
            const config = {
                titleKey: '选择攻击目标',
                labelKey: condition ? '令2号玩家获得烟雾弹' : 'choices.ninjaSmokeScreen.option',
                nameKey: \`tokens.${'${def.id}'}.name\`,
            };
        `;
        const result = collectReferencesFromContent(content, 'demo.ts', {
            defaultNamespace: 'game-dicethrone',
            knownNamespaces: new Set(['game-dicethrone']),
        });

        expect(result.warnings).toContainEqual(expect.objectContaining({
            type: 'raw-i18n-key-property',
            key: '选择攻击目标',
            source: 'titleKey',
        }));
        expect(result.warnings).toContainEqual(expect.objectContaining({
            type: 'raw-i18n-key-property',
            key: '令2号玩家获得烟雾弹',
            source: 'labelKey',
        }));
        expect(result.warnings).not.toContainEqual(expect.objectContaining({
            type: 'raw-i18n-key-property',
            key: 'tokens.${def.id}.name',
        }));
    });

    it('会拦截 slider 直接写可见文案的标签字段', () => {
        const content = `
            const prompt = {
                confirmLabel: '确认转移 2 个力量指示物',
                valueLabel: condition ? '承受压力：2 / 3' : 'ui.giant_ants_under_pressure_value_label',
                skipLabel: '跳过这次转移',
            };
        `;
        const result = collectReferencesFromContent(content, 'demo.ts', {
            defaultNamespace: 'game-smashup',
            knownNamespaces: new Set(['game-smashup']),
        });

        expect(result.warnings).toContainEqual(expect.objectContaining({
            type: 'raw-slider-label',
            key: '确认转移 2 个力量指示物',
            source: 'confirmLabel',
        }));
        expect(result.warnings).toContainEqual(expect.objectContaining({
            type: 'raw-slider-label',
            key: '承受压力：2 / 3',
            source: 'valueLabel',
        }));
        expect(result.warnings).toContainEqual(expect.objectContaining({
            type: 'raw-slider-label',
            key: '跳过这次转移',
            source: 'skipLabel',
        }));
        expect(result.warnings).not.toContainEqual(expect.objectContaining({
            type: 'raw-slider-label',
            key: 'ui.giant_ants_under_pressure_value_label',
        }));
    });

    it('t(variable) 且提供 defaultValue 时，不把统一翻译 helper 误报为 dynamic-key', () => {
        const content = `
            function resolveSliderText(t, key, fallback) {
                if (!key) return fallback;
                return t(key, {
                    defaultValue: fallback,
                    count: 1,
                });
            }
        `;
        const result = collectReferencesFromContent(content, 'demo.tsx', {
            defaultNamespace: 'game-smashup',
            knownNamespaces: new Set(['game-smashup']),
        });

        expect(result.warnings).not.toContainEqual(expect.objectContaining({
            type: 'dynamic-key',
            key: 'key',
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
                            { value: 'diy', labelKey: 'games.smashup.setup.expansions.diy' },
                        ],
                    },
                    teamMode: {
                        labelKey: 'games.smashup.setup.teamMode.label',
                        optionsByPlayerCount: {
                            4: [
                                { value: 'off', labelKey: 'games.smashup.setup.teamMode.off' },
                                { value: '2v2', labelKey: 'games.smashup.setup.teamMode.2v2' },
                            ],
                        },
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
            expect.objectContaining({
                key: 'setup.expansions.diy',
                namespaces: ['game-smashup'],
            }),
            expect.objectContaining({
                key: 'setup.teamMode.label',
                namespaces: ['game-smashup'],
            }),
            expect.objectContaining({
                key: 'setup.teamMode.off',
                namespaces: ['game-smashup'],
            }),
            expect.objectContaining({
                key: 'setup.teamMode.2v2',
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

    it('忽略非翻译语义的 sfxKey，但保留像 effectKey 这样的业务 i18n key', () => {
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

        expect(result).toEqual(expect.arrayContaining([
            expect.objectContaining({
                key: 'bonusDie.effect.fire',
                namespaces: ['game-smashup'],
            }),
            expect.objectContaining({
                key: 'choices.confirm',
                namespaces: ['game-smashup'],
            }),
        ]));
        expect(result).toHaveLength(2);
    });

    it('warning baseline 只放过已登记旧债，新增告警仍会留下', () => {
        const legacyWarning = {
            type: 'raw-prompt-option-label',
            key: '放到鲜血领主上',
            file: 'src/games/smashup/abilities/demo.ts',
            line: 12,
            source: 'PromptOption.label',
            detail: 'legacy',
        } as const;
        const newWarning = {
            type: 'raw-simple-choice-title',
            key: '选择一个分支',
            file: 'src/games/smashup/abilities/demo.ts',
            line: 24,
            source: 'createSimpleChoice.title',
            detail: 'new',
        } as const;

        const baselineIds = new Set([createWarningBaselineId(legacyWarning)]);
        const result = partitionWarningsAgainstBaseline([legacyWarning, newWarning], baselineIds);

        expect(result.legacyWarnings).toEqual([legacyWarning]);
        expect(result.newWarnings).toEqual([newWarning]);
    });

    it('会识别中文语言包中的纯英文或中英混写可见文案', () => {
        const tempDir = fs.mkdtempSync(path.join(process.cwd(), 'temp-i18n-check-'));
        const filePath = path.join(tempDir, 'common.json');
        fs.writeFileSync(filePath, JSON.stringify({
            notFound: {
                headlineSub: 'Lost off the edge of the map',
                reload: '刷新页面 Reload',
                middleEnglish: '点击 Submit 按钮继续',
                allCapsEnglish: '点击 PLAY 按钮继续',
            },
            allowedTerms: {
                aiSupport: 'AI 支持',
                androidApp: '请在 Android App 内重试',
                shortcut: '支持截图粘贴 (Ctrl+V)',
                buffZone: 'Buff 区',
                duel: '当前 1v1 对局中按唯一对手结算',
                duelLabel: '对决（Duel）防御阶段不能手动掷骰',
                damageFlash: '受伤反馈·斜切视觉（DamageFlash 内部）',
                functionName: 'createBaseSystems() 自动包含',
                hookName: '前置（beforeCommand）',
                i18nTerm: '未能加载当前游戏的 i18n 资源，请重试',
                bugTerm: 'Bug 覆盖率估算:',
                modePayload: '交互完整性：Mode A(UI状态机payload) + Mode B(Handler注册链)',
                teamMode: '当前为 2v2 站位',
                multiplier: '获得2x[火魂]层火焰精通',
                multiplierPrefix: '伤害 x5',
                properNoun: 'DIY 模式',
                pascalCaseInternal: '挂到 BattleLogOverlay 里查看',
                pascalCaseAcronymInternal: '挂到 BattleHUDPanel 里查看',
                camelCaseInternal: '读取 roomDebugState 完成恢复',
                camelCaseIds: '按 spriteIds 和 frameIndex 做映射',
                kebabCaseInternal: '切到 room-debug-panel 查看详情',
                kebabCaseRoute: '切到 game-room-debug-panel 查看详情',
                fmMode: 'FM 模式',
                qqGroup: '加入 QQ 群',
                shaderFx: '召唤单位入场（Shader + 粒子混合版）',
                playerShort: 'P1 先手',
                teamMode3v3: '当前为 3v3 站位',
                multiplierX10: '伤害 x10',
                bundle: '请重新下载 Bundle',
                exportJson: '导出 JSON',
                ugcTitle: 'UGC 管理',
                c4Model: '🏛️ C4 模型 — L1 系统上下文',
                otaBundle: '当前 Bundle 与最新 OTA 不一致',
                policyId: '策略 ID',
                providerId: '提供方 ID',
                gameIdError: '非法 gameId，已忽略订阅',
                cpGain: '获得2CP',
                vpGain: '获得 1 VP',
                debugIds: '按稳定 cardId 处理，不把 atlasIndex 当唯一键',
                futureId: '按 matchId 过滤最新快照',
                futureVersion: '当前 bundleVersion 与 appVersion 不一致',
                futureHandler: '统一交给 choiceHandler 处理',
                futurePayload: '调试 syncPayload 是否缺字段',
                futureOverlay: '挂到 ReplayOverlay 里查看',
                futureSlug: '切到 create-room-debug-panel 查看详情',
                sdkGuide: '打开 SDK 文档',
                nodeJsServer: '连接 Node.js 服务',
                oauthLogin: '切换 OAuth 登录',
                semver: '系统健康监控 v1.2.0',
                worldName: '征服 Itharia 的战场',
                webviewCompat: '通常是 WebView 兼容性或启动阶段资源初始化卡住了',
                corsConfig: '请使用本地代理或检查 CORS 配置',
                mongoServer: '请确认后端容器（MongoDB/Server）已启动',
                imageFormats: '仅支持 JPG、PNG、WebP、GIF，最大 5MB',
                appShell: '当前 Bundle {{bundleVersion}}，App 壳版本 {{appVersion}}',
                podLabel: '浪人（POD）',
                romanDeck: 'II 牌组（进阶）',
                teamLabel: 'A 队 vs B 队',
                mathFormula: '小顺子：造成 6+X 伤害',
            },
        }, null, 2));

        const warnings = collectZhCnLocaleEnglishWarnings(tempDir);

        expect(warnings).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'zh-cn-locale-english',
                source: 'zh-CN:common.notFound.headlineSub',
                key: 'Lost off the edge of the map',
            }),
            expect.objectContaining({
                type: 'zh-cn-locale-english',
                source: 'zh-CN:common.notFound.reload',
                key: '刷新页面 Reload',
            }),
            expect.objectContaining({
                type: 'zh-cn-locale-english',
                source: 'zh-CN:common.notFound.middleEnglish',
                key: '点击 Submit 按钮继续',
            }),
            expect.objectContaining({
                type: 'zh-cn-locale-english',
                source: 'zh-CN:common.notFound.allCapsEnglish',
                key: '点击 PLAY 按钮继续',
            }),
        ]));

        expect(warnings).not.toEqual(expect.arrayContaining([
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.aiSupport',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.androidApp',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.buffZone',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.duelLabel',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.damageFlash',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.functionName',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.hookName',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.i18nTerm',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.bugTerm',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.modePayload',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.shortcut',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.duel',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.teamMode',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.multiplier',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.multiplierPrefix',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.properNoun',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.pascalCaseInternal',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.pascalCaseAcronymInternal',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.camelCaseInternal',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.camelCaseIds',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.kebabCaseInternal',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.kebabCaseRoute',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.fmMode',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.qqGroup',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.shaderFx',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.playerShort',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.teamMode3v3',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.multiplierX10',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.bundle',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.exportJson',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.ugcTitle',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.c4Model',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.otaBundle',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.policyId',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.providerId',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.gameIdError',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.cpGain',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.vpGain',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.debugIds',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.futureId',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.futureVersion',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.futureHandler',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.futurePayload',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.futureOverlay',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.futureSlug',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.sdkGuide',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.nodeJsServer',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.oauthLogin',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.semver',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.worldName',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.webviewCompat',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.corsConfig',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.mongoServer',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.imageFormats',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.appShell',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.podLabel',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.romanDeck',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.teamLabel',
            }),
            expect.objectContaining({
                source: 'zh-CN:common.allowedTerms.mathFormula',
            }),
        ]));

        fs.rmSync(tempDir, { recursive: true, force: true });
    });
});

describe('DiceThrone ability choice face label scan', () => {
    it('从技能触发条件收集分支选择需要的动态骰面文案 key', () => {
        const refs = collectDiceThroneAbilityChoiceFaceLabelReferences({
            ninja: {
                abilities: [
                    {
                        id: 'shadow-step',
                        name: 'abilities.shadow-step.name',
                        type: 'offensive',
                        variants: [
                            {
                                id: 'shadow-step-2-main',
                                trigger: { type: 'diceSet', faces: { mask: 4 } },
                                effects: [],
                            },
                            {
                                id: 'death-blossom',
                                trigger: { type: 'diceSet', faces: { ninja_katana: 3, shuriken: 2 } },
                                effects: [],
                            },
                        ],
                    },
                ],
            },
        });

        expect(refs.map(ref => ref.key).sort()).toEqual([
            'abilityChoice.faceLabel.mask',
            'abilityChoice.faceLabel.ninja_katana',
            'abilityChoice.faceLabel.shuriken',
        ]);
    });

    it('缺少动态骰面文案时会进入 i18n 缺失 key 报告', () => {
        const refs = collectDiceThroneAbilityChoiceFaceLabelReferences({
            ninja: {
                abilities: [
                    {
                        id: 'shadow-step',
                        name: 'abilities.shadow-step.name',
                        type: 'offensive',
                        variants: [
                            {
                                id: 'shadow-step-2-main',
                                trigger: { type: 'diceSet', faces: { mask: 4 } },
                                effects: [],
                            },
                        ],
                    },
                ],
            },
        });
        const missing = collectMissingTranslations(
            refs,
            {
                'zh-CN': {
                    'game-dicethrone': {
                        abilityChoice: { faceLabel: {} },
                    },
                },
            },
            ['zh-CN'],
        );

        expect(missing).toEqual([
            expect.objectContaining({
                namespaces: ['game-dicethrone'],
                key: 'abilityChoice.faceLabel.mask',
                languages: ['zh-CN'],
            }),
        ]);
    });

    it('mixed dotted-key locale 结构不会把已存在的 DiceThrone key 误报为缺失', () => {
        const missing = collectMissingTranslations(
            [{
                key: 'bonusDie.effect.luckyRoll.result',
                namespaces: ['game-dicethrone'],
                file: 'demo.ts',
                line: 1,
                source: 'test',
            }],
            {
                'zh-CN': {
                    'game-dicethrone': {
                        bonusDie: {
                            effect: {
                                'luckyRoll.result': '治疗{{healAmount}}',
                            },
                        },
                    },
                },
                en: {
                    'game-dicethrone': {
                        bonusDie: {
                            effect: {
                                'luckyRoll.result': 'Heal {{healAmount}}',
                            },
                        },
                    },
                },
            },
            ['zh-CN', 'en'],
        );

        expect(missing).toEqual([]);
    });
});

describe('DiceThrone raw contract audit', () => {
    it('会抓出 helper 参数里的原始可见文案', () => {
        const content = `
            const demo = () => [
                damage(5, '造成 5 点伤害。'),
                custom('demo-action', '若投出 3 个相同数字，施加击倒。', 'preDefense'),
                grantToken('self', TOKEN_IDS.BOUNTY, 1, '对手获得 1 个赏金。', 'preDefense'),
            ];
        `;

        const warnings = collectDiceThroneRawContractWarningsFromContent(
            content,
            'D:/gongzuo/webgame/BoardGame/src/games/dicethrone/heroes/gunslinger/abilities.ts',
        );

        expect(warnings).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'raw-dicethrone-contract-text',
                key: '造成 5 点伤害。',
                source: 'damage.arg1',
            }),
            expect.objectContaining({
                type: 'raw-dicethrone-contract-text',
                key: '若投出 3 个相同数字，施加击倒。',
                source: 'custom.arg1',
            }),
            expect.objectContaining({
                type: 'raw-dicethrone-contract-text',
                key: '对手获得 1 个赏金。',
                source: 'grantToken.arg3',
            }),
        ]));
    });

    it('不会把已 key 化的 helper 参数误报为原始文案', () => {
        const content = `
            const demo = () => [
                damage(5, abilityEffectText('slash', 'damage5')),
                customEffect('demo-custom', 'opponent', abilityEffectText('slash', 'bonus')),
                grantToken('self', TOKEN_IDS.BOUNTY, 1, abilityEffectText('slash', 'gainBounty')),
            ];
        `;

        const warnings = collectDiceThroneRawContractWarningsFromContent(
            content,
            'D:/gongzuo/webgame/BoardGame/src/games/dicethrone/heroes/ninja/abilities.ts',
        );

        expect(warnings).toEqual([]);
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
        expect(shouldIncludeChangedGitFile('.codex/skill/demo/SKILL.md')).toBe(false);
        expect(shouldIncludeChangedGitFile('.devin/skills/demo/SKILL.md')).toBe(false);
        expect(shouldIncludeChangedGitFile('.windsurf/skills/demo/SKILL.md')).toBe(false);
        expect(shouldIncludeChangedGitFile('evidence/scope-audit.md')).toBe(false);
        expect(shouldIncludeChangedGitFile('tmp/temp-reducer-diff.txt')).toBe(false);
        expect(shouldIncludeChangedGitFile('test-out.txt')).toBe(false);
        expect(shouldIncludeChangedGitFile('android/app/src/main/assets/public/locales/en/lobby.json')).toBe(false);
    });
});
