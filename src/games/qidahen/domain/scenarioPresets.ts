import type { QidahenScenarioId, QidahenScenarioPreset } from './types';

const QIDAHEN_SCENARIO_PRESETS: Record<QidahenScenarioId, QidahenScenarioPreset> = {
    'post-sarhu-1619': {
        id: 'post-sarhu-1619',
        label: '剧本一：萨尔浒战后（1619）',
        yearIndex: 0,
        ruleSource: 'confirmed',
        factionOrder: ['ming', 'mongol', 'jin'],
        factions: {
            ming: {
                factionId: 'ming',
                handCount: 3,
                fixedCharacterIds: [],
                characterChoiceGroups: [],
                guaranteedArmamentLevels: {
                    'artillery-tech': 1,
                },
                armamentChoiceGroups: [],
                removedCharacterIds: [],
            },
            mongol: {
                factionId: 'mongol',
                handCount: 6,
                fixedCharacterIds: ['mongol-lindan-hutuktu'],
                characterChoiceGroups: [],
                guaranteedArmamentLevels: {
                    'cavalry-armor': 1,
                },
                armamentChoiceGroups: [],
                removedCharacterIds: [],
            },
            jin: {
                factionId: 'jin',
                handCount: 10,
                fixedCharacterIds: ['jin-nurhaci'],
                characterChoiceGroups: [
                    { count: 1, characterIds: ['jin-eidu', 'jin-fan-wencheng'] },
                ],
                guaranteedArmamentLevels: {
                    'infantry-armor': 1,
                },
                armamentChoiceGroups: [],
                removedCharacterIds: [],
            },
        },
    },
    'shanhaiguan-1622': {
        id: 'shanhaiguan-1622',
        label: '剧本二：山海关之议（1622）',
        yearIndex: 3,
        ruleSource: 'confirmed',
        factionOrder: ['ming', 'mongol', 'jin'],
        factions: {
            ming: {
                factionId: 'ming',
                handCount: 2,
                fixedCharacterIds: ['ming-mao-wenlong'],
                characterChoiceGroups: [
                    { count: 1, characterIds: ['ming-wang-huazhen', 'ming-xiong-tingbi'] },
                ],
                guaranteedArmamentLevels: {
                    'artillery-tech': 1,
                },
                armamentChoiceGroups: [
                    { count: 1, armamentIds: ['cavalry-armor', 'infantry-armor', 'artillery-tech'] },
                    { count: 1, armamentIds: ['cavalry-firearm', 'long-barreled-musket'] },
                ],
                removedCharacterIds: [],
            },
            mongol: {
                factionId: 'mongol',
                handCount: 6,
                fixedCharacterIds: ['mongol-lindan-hutuktu', 'mongol-choghtu-taiji'],
                characterChoiceGroups: [],
                guaranteedArmamentLevels: {
                    'horse-breeding': 1,
                    'cavalry-armor': 1,
                },
                armamentChoiceGroups: [],
                removedCharacterIds: [],
            },
            jin: {
                factionId: 'jin',
                handCount: 6,
                fixedCharacterIds: ['jin-nurhaci'],
                characterChoiceGroups: [
                    { count: 1, characterIds: ['jin-eidu', 'jin-fan-wencheng'] },
                    { count: 1, characterIds: ['jin-amin', 'jin-manggultai'] },
                ],
                guaranteedArmamentLevels: {
                    'manzhou-banners': 1,
                    'infantry-armor': 1,
                },
                armamentChoiceGroups: [],
                removedCharacterIds: [],
            },
        },
    },
    'dingmao-rebellion-1627': {
        id: 'dingmao-rebellion-1627',
        label: '二人剧本：丁卯胡乱（1627）',
        yearIndex: 8,
        ruleSource: 'confirmed',
        factionOrder: ['ming', 'jin'],
        factions: {
            ming: {
                factionId: 'ming',
                handCount: 5,
                fixedCharacterIds: ['ming-wei-zhongxian', 'ming-sun-chengzong', 'ming-mao-wenlong'],
                characterChoiceGroups: [],
                guaranteedArmamentLevels: {
                    'artillery-tech': 2,
                },
                armamentChoiceGroups: [
                    { count: 1, armamentIds: ['cavalry-firearm', 'long-barreled-musket'] },
                ],
                removedCharacterIds: ['ming-xiong-tingbi'],
            },
            mongol: {
                factionId: 'mongol',
                handCount: 0,
                fixedCharacterIds: [],
                characterChoiceGroups: [],
                guaranteedArmamentLevels: {},
                armamentChoiceGroups: [],
                removedCharacterIds: [],
            },
            jin: {
                factionId: 'jin',
                handCount: 6,
                fixedCharacterIds: [],
                characterChoiceGroups: [
                    { count: 1, characterIds: ['jin-huangtaiji', 'jin-amin', 'jin-daisan'] },
                    { count: 1, characterIds: ['jin-yanguli', 'jin-fan-wencheng'] },
                ],
                guaranteedArmamentLevels: {
                    'manzhou-banners': 1,
                    'mongol-banners': 1,
                    'han-banners': 1,
                    'infantry-armor': 2,
                },
                armamentChoiceGroups: [],
                removedCharacterIds: ['jin-nurhaci', 'jin-eidu'],
            },
        },
    },
};

export const getQidahenScenarioPreset = (scenarioId: QidahenScenarioId): QidahenScenarioPreset => {
    const preset = QIDAHEN_SCENARIO_PRESETS[scenarioId];
    return {
        ...preset,
        factionOrder: [...preset.factionOrder],
        factions: {
            ming: {
                ...preset.factions.ming,
                fixedCharacterIds: [...preset.factions.ming.fixedCharacterIds],
                characterChoiceGroups: preset.factions.ming.characterChoiceGroups.map((group) => ({
                    ...group,
                    characterIds: [...group.characterIds],
                })),
                guaranteedArmamentLevels: { ...preset.factions.ming.guaranteedArmamentLevels },
                armamentChoiceGroups: preset.factions.ming.armamentChoiceGroups.map((group) => ({
                    ...group,
                    armamentIds: [...group.armamentIds],
                })),
                removedCharacterIds: [...preset.factions.ming.removedCharacterIds],
            },
            mongol: {
                ...preset.factions.mongol,
                fixedCharacterIds: [...preset.factions.mongol.fixedCharacterIds],
                characterChoiceGroups: preset.factions.mongol.characterChoiceGroups.map((group) => ({
                    ...group,
                    characterIds: [...group.characterIds],
                })),
                guaranteedArmamentLevels: { ...preset.factions.mongol.guaranteedArmamentLevels },
                armamentChoiceGroups: preset.factions.mongol.armamentChoiceGroups.map((group) => ({
                    ...group,
                    armamentIds: [...group.armamentIds],
                })),
                removedCharacterIds: [...preset.factions.mongol.removedCharacterIds],
            },
            jin: {
                ...preset.factions.jin,
                fixedCharacterIds: [...preset.factions.jin.fixedCharacterIds],
                characterChoiceGroups: preset.factions.jin.characterChoiceGroups.map((group) => ({
                    ...group,
                    characterIds: [...group.characterIds],
                })),
                guaranteedArmamentLevels: { ...preset.factions.jin.guaranteedArmamentLevels },
                armamentChoiceGroups: preset.factions.jin.armamentChoiceGroups.map((group) => ({
                    ...group,
                    armamentIds: [...group.armamentIds],
                })),
                removedCharacterIds: [...preset.factions.jin.removedCharacterIds],
            },
        },
    };
};
