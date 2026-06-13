import { qidahenChronologyPreview } from '../ui/cardAtlas';
import { filterFactionOrderForScenario } from './factionTurnOrder';
import type { QidahenCore, QidahenFactionId, QidahenScenarioId } from './types';

type QidahenChronologyCharacterAvailability =
    | {
        mode: 'none';
        summary: string;
    }
    | {
        mode: 'exact';
        summary: string;
        characterIds: string[];
    }
    | {
        mode: 'representative';
        summary: string;
        characterIds: string[];
    };

interface QidahenChronologyYearConfig {
    previewIndex: number;
    factionOrder: QidahenFactionId[];
    source: 'confirmed' | 'inferred';
    characterAvailabilityByFaction: Record<QidahenFactionId, QidahenChronologyCharacterAvailability>;
}

const QIDAHEN_YEAR_SEQUENCE = [
    '天命四年 1619',
    '天命五年 1620',
    '天命六年 1621',
    '天命七年 1622',
    '天命八年 1623',
    '天命九年 1624',
    '天命十年 1625',
    '天命十一年 1626',
    '天聪元年 1627',
    '天聪二年 1628',
    '天聪三年 1629',
] as const;

const QIDAHEN_CHRONOLOGY_YEAR_CONFIGS: QidahenChronologyYearConfig[] = [
    {
        previewIndex: 1,
        factionOrder: ['mongol', 'jin', 'ming'],
        source: 'confirmed',
        characterAvailabilityByFaction: {
            ming: {
                mode: 'representative',
                summary: '任意人物牌',
                characterIds: [
                    'ming-gao-di',
                    'ming-xiong-tingbi',
                    'ming-yang-gao',
                    'ming-yuan-chonghuan',
                    'ming-sun-yuanhua',
                    'ming-mao-wenlong',
                    'ming-wang-huazhen',
                    'ming-feng-quan',
                ],
            },
            mongol: { mode: 'none', summary: '无' },
            jin: { mode: 'exact', summary: '莽古尔泰、代善、阿敏', characterIds: ['jin-manggultai', 'jin-daisan', 'jin-amin'] },
        },
    },
    {
        previewIndex: 3,
        factionOrder: ['ming', 'mongol', 'jin'],
        source: 'inferred',
        characterAvailabilityByFaction: {
            ming: { mode: 'exact', summary: '高第、熊廷弼、杨镐', characterIds: ['ming-gao-di', 'ming-xiong-tingbi', 'ming-yang-gao'] },
            mongol: { mode: 'representative', summary: '台吉中择一', characterIds: ['mongol-choghtu-taiji', 'mongol-oba-taiji'] },
            jin: {
                mode: 'representative',
                summary: '任意人物牌',
                characterIds: ['jin-daisan', 'jin-amin', 'jin-manggultai', 'jin-yanguli', 'jin-fan-wencheng', 'jin-huangtaiji'],
            },
        },
    },
    {
        previewIndex: 4,
        factionOrder: ['mongol', 'jin', 'ming'],
        source: 'inferred',
        characterAvailabilityByFaction: {
            ming: { mode: 'none', summary: '无' },
            mongol: { mode: 'representative', summary: '台吉中择一', characterIds: ['mongol-choghtu-taiji', 'mongol-oba-taiji'] },
            jin: {
                mode: 'representative',
                summary: '任意人物牌',
                characterIds: ['jin-daisan', 'jin-amin', 'jin-manggultai', 'jin-yanguli', 'jin-fan-wencheng', 'jin-huangtaiji'],
            },
        },
    },
    {
        previewIndex: 2,
        factionOrder: ['mongol', 'jin', 'ming'],
        source: 'confirmed',
        characterAvailabilityByFaction: {
            ming: { mode: 'none', summary: '无' },
            mongol: { mode: 'representative', summary: '台吉中择一', characterIds: ['mongol-choghtu-taiji', 'mongol-oba-taiji'] },
            jin: {
                mode: 'representative',
                summary: '任意人物牌',
                characterIds: ['jin-daisan', 'jin-amin', 'jin-manggultai', 'jin-yanguli', 'jin-fan-wencheng', 'jin-huangtaiji'],
            },
        },
    },
    {
        previewIndex: 5,
        factionOrder: ['mongol', 'ming', 'jin'],
        source: 'inferred',
        characterAvailabilityByFaction: {
            ming: { mode: 'exact', summary: '袁崇焕、孙元化、高第、王化贞', characterIds: ['ming-yuan-chonghuan', 'ming-sun-yuanhua', 'ming-gao-di', 'ming-wang-huazhen'] },
            mongol: { mode: 'exact', summary: '奥巴台吉', characterIds: ['mongol-oba-taiji'] },
            jin: { mode: 'exact', summary: '代善、额亦都、范文程', characterIds: ['jin-daisan', 'jin-eidu', 'jin-fan-wencheng'] },
        },
    },
    {
        previewIndex: 6,
        factionOrder: ['mongol', 'ming', 'jin'],
        source: 'inferred',
        characterAvailabilityByFaction: {
            ming: { mode: 'exact', summary: '熊廷弼、孙元化、毛文龙、冯铨', characterIds: ['ming-xiong-tingbi', 'ming-sun-yuanhua', 'ming-mao-wenlong', 'ming-feng-quan'] },
            mongol: { mode: 'exact', summary: '衮楚克图吉', characterIds: ['mongol-gunchu-ketuji'] },
            jin: { mode: 'exact', summary: '代善、额亦都、阿敏', characterIds: ['jin-daisan', 'jin-eidu', 'jin-amin'] },
        },
    },
    {
        previewIndex: 7,
        factionOrder: ['jin', 'ming', 'mongol'],
        source: 'inferred',
        characterAvailabilityByFaction: {
            ming: { mode: 'representative', summary: '阁党中择一', characterIds: ['ming-feng-quan', 'ming-gao-di', 'ming-wang-huazhen'] },
            mongol: {
                mode: 'representative',
                summary: '任意人物牌',
                characterIds: ['mongol-qisai-noyan', 'mongol-gunchu-ketuji', 'mongol-oba-taiji', 'mongol-choghtu-taiji'],
            },
            jin: { mode: 'none', summary: '无' },
        },
    },
    {
        previewIndex: 8,
        factionOrder: ['ming', 'jin', 'mongol'],
        source: 'inferred',
        characterAvailabilityByFaction: {
            ming: { mode: 'none', summary: '无' },
            mongol: { mode: 'exact', summary: '林丹·乎图克图、齐赛诺延、绰克图台吉', characterIds: ['mongol-lindan-hutuktu', 'mongol-qisai-noyan', 'mongol-choghtu-taiji'] },
            jin: { mode: 'exact', summary: '代善、额亦都、扬古利', characterIds: ['jin-daisan', 'jin-eidu', 'jin-yanguli'] },
        },
    },
    {
        previewIndex: 0,
        factionOrder: ['ming', 'jin', 'mongol'],
        source: 'confirmed',
        characterAvailabilityByFaction: {
            ming: { mode: 'none', summary: '无' },
            mongol: { mode: 'representative', summary: '台吉中择一', characterIds: ['mongol-choghtu-taiji', 'mongol-oba-taiji'] },
            jin: { mode: 'representative', summary: '贝勒中择一', characterIds: ['jin-daisan', 'jin-amin', 'jin-manggultai', 'jin-huangtaiji'] },
        },
    },
    {
        previewIndex: 9,
        factionOrder: ['jin', 'mongol', 'ming'],
        source: 'inferred',
        characterAvailabilityByFaction: {
            ming: {
                mode: 'representative',
                summary: '东林党中择一',
                characterIds: ['ming-yuan-chonghuan', 'ming-sun-yuanhua', 'ming-xiong-tingbi', 'ming-mao-wenlong'],
            },
            mongol: { mode: 'representative', summary: '台吉中择一', characterIds: ['mongol-choghtu-taiji', 'mongol-oba-taiji'] },
            jin: { mode: 'none', summary: '无' },
        },
    },
    {
        previewIndex: 10,
        factionOrder: ['jin', 'ming', 'mongol'],
        source: 'inferred',
        characterAvailabilityByFaction: {
            ming: {
                mode: 'representative',
                summary: '任意人物牌',
                characterIds: [
                    'ming-yuan-chonghuan',
                    'ming-sun-yuanhua',
                    'ming-xiong-tingbi',
                    'ming-mao-wenlong',
                    'ming-feng-quan',
                    'ming-gao-di',
                    'ming-wang-huazhen',
                    'ming-yang-gao',
                ],
            },
            mongol: { mode: 'exact', summary: '齐赛诺延、奥巴台吉、绰克图台吉', characterIds: ['mongol-qisai-noyan', 'mongol-oba-taiji', 'mongol-choghtu-taiji'] },
            jin: { mode: 'exact', summary: '扬古利、范文程', characterIds: ['jin-yanguli', 'jin-fan-wencheng'] },
        },
    },
];

const getChronologyYearConfig = (yearIndex: number): QidahenChronologyYearConfig => (
    QIDAHEN_CHRONOLOGY_YEAR_CONFIGS[Math.max(0, Math.min(yearIndex, QIDAHEN_CHRONOLOGY_YEAR_CONFIGS.length - 1))]
    ?? QIDAHEN_CHRONOLOGY_YEAR_CONFIGS[QIDAHEN_CHRONOLOGY_YEAR_CONFIGS.length - 1]
);

export const getYearLabelByIndex = (yearIndex: number): string => (
    QIDAHEN_YEAR_SEQUENCE[Math.max(0, Math.min(yearIndex, QIDAHEN_YEAR_SEQUENCE.length - 1))]
    ?? QIDAHEN_YEAR_SEQUENCE[QIDAHEN_YEAR_SEQUENCE.length - 1]
);

export const getQidahenMaxChronologyYearIndex = (): number => (
    QIDAHEN_YEAR_SEQUENCE.length - 1
);

export const buildYearCardSlots = (yearIndex: number): QidahenCore['yearCards'] => [
    { id: 'current-year', label: '今年纪年卡', previewRef: qidahenChronologyPreview(getChronologyYearConfig(yearIndex).previewIndex) },
    { id: 'next-year', label: '下一年纪年', previewRef: qidahenChronologyPreview(getChronologyYearConfig(yearIndex + 1).previewIndex) },
];

export const getFactionOrderForYearIndex = (
    scenarioId: QidahenScenarioId,
    yearIndex: number,
): QidahenFactionId[] => (
    filterFactionOrderForScenario(scenarioId, getChronologyYearConfig(yearIndex).factionOrder)
);

export const getChronologyCharacterAvailabilityForYear = (
    yearIndex: number,
    factionId: QidahenFactionId,
): QidahenChronologyCharacterAvailability => (
    getChronologyYearConfig(yearIndex).characterAvailabilityByFaction[factionId]
);
