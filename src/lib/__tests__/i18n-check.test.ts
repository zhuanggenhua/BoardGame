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
    collectMissingTranslations,
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

    it('createSimpleChoice 直接使用英文标题时，即使写了 titleKey 也会产生告警', () => {
        const content = `
            createSimpleChoice(
                'choice-1',
                playerId,
                'The Bride: choose the first effect',
                options,
                { sourceId: 'demo', targetType: 'generic' },
            );

            createSimpleChoice(
                'choice-2',
                playerId,
                'The Bride: choose the second effect',
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
            key: 'The Bride: choose the first effect',
            detail: expect.stringContaining('请补 titleKey'),
        }));
        expect(result.warnings).toContainEqual(expect.objectContaining({
            type: 'raw-simple-choice-title',
            key: 'The Bride: choose the second effect',
            detail: expect.stringContaining('即使已写 titleKey'),
        }));
    });

    it('createSimpleChoice 内联英文 label 缺少 labelKey 时会产生告警', () => {
        const content = `
            createSimpleChoice(
                'choice-1',
                playerId,
                'Choose a branch',
                [
                    { id: 'raw', label: 'Draw 2 cards', value: { draw: true }, displayMode: 'button' },
                    { id: 'keyed', label: 'Place a +1 counter', labelKey: 'ui.place_counter', value: { place: true }, displayMode: 'button' },
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
            key: 'Draw 2 cards',
        }));
        expect(result.warnings).not.toContainEqual(expect.objectContaining({
            type: 'raw-simple-choice-option-label',
            key: 'Place a +1 counter',
        }));
    });

    it('PromptOption 变量中的英文 label 缺少 labelKey 时会产生告警', () => {
        const content = `
            const options = [
                { id: 'raw', label: 'Place it on Ancient Lord', value: { mode: 'store' }, displayMode: 'button' },
                { id: 'keyed', label: 'Draw 2 cards', labelKey: 'ui.draw_two_cards', value: { draw: true }, displayMode: 'button' },
                { label: 'Debug only', value: 1 },
            ];
        `;
        const result = collectReferencesFromContent(content, 'demo.ts', {
            defaultNamespace: 'common',
            knownNamespaces: new Set(['common', 'game-smashup']),
        });

        expect(result.warnings).toContainEqual(expect.objectContaining({
            type: 'raw-prompt-option-label',
            key: 'Place it on Ancient Lord',
        }));
        expect(result.warnings).not.toContainEqual(expect.objectContaining({
            type: 'raw-prompt-option-label',
            key: 'Draw 2 cards',
        }));
        expect(result.warnings).not.toContainEqual(expect.objectContaining({
            type: 'raw-prompt-option-label',
            key: 'Debug only',
        }));
    });

    it('createSkipOption 直接使用英文 label 时会产生告警', () => {
        const content = `
            const options = [createSkipOption('Skip this effect')];
            const zhOptions = [createSkipOption('跳过')];
        `;
        const result = collectReferencesFromContent(content, 'demo.ts', {
            defaultNamespace: 'common',
            knownNamespaces: new Set(['common']),
        });

        expect(result.warnings).toContainEqual(expect.objectContaining({
            type: 'raw-create-skip-label',
            key: 'Skip this effect',
        }));
        expect(result.warnings).not.toContainEqual(expect.objectContaining({
            type: 'raw-create-skip-label',
            key: '跳过',
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
