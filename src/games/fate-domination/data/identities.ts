import type { MasterDefinition, ServantDefinition } from '../domain/types';
import { DEMO_MASTERS, DEMO_SERVANTS } from './demo-data';

const masterAssets: Record<string, string> = { m_shirou_emiya: 'fate-domination/masters/emiya-shirou' };
const SELECTABLE_MASTER_NAMES = [
    '间桐雁夜', '间桐慎二', '卫宫士郎', '雨生龙之介', '远坂时臣', '伊莉雅斯菲尔',
    '间桐樱', '韦伯·维尔维特', '言峰绮礼', '肯尼斯', '间桐脏砚', '卫宫切嗣', '远坂凛',
] as const;

export const FATE_MASTERS: MasterDefinition[] = SELECTABLE_MASTER_NAMES
    .map((name) => DEMO_MASTERS.find((master) => master.name === name))
    .filter((master): master is (typeof DEMO_MASTERS)[number] => Boolean(master))
    .map((master) => ({
    ...master,
    assetPath: masterAssets[master.id] ?? 'fate-domination/masters/master-slot-b',
    sourceStatus: 'verified',
    }));
/* fallback retained for partially generated installs */
const fallbackMasters: MasterDefinition[] = [
    { id: 'master-shirou', name: '卫宫士郎', assetPath: 'fate-domination/masters/emiya-shirou', sourceStatus: 'verified' },
    { id: 'master-slot-b', name: '御主卡位 B（待核验）', assetPath: 'fate-domination/masters/master-slot-b', sourceStatus: 'unverified' },
];
if (FATE_MASTERS.length === 0) FATE_MASTERS.push(...fallbackMasters);

const SELECTABLE_SERVANT_NAMES = [
    '阿尔托莉雅·潘德拉贡', '赫拉克勒斯', '吉尔伽美什', '佐佐木小次郎', '美狄亚',
    '哈桑·萨巴赫(咒腕)', '卫宫', '兰斯洛特', '安格拉·曼纽', '伊斯坎达尔',
    '迪卢木多·奥迪那', '吉尔·德·雷', '库·丘林', '美杜莎',
] as const;

const servantIds: Record<string, string> = {
    '阿尔托莉雅·潘德拉贡': 'servant-saber',
    '赫拉克勒斯': 'servant-heracles',
    '吉尔伽美什': 'servant-gilgamesh',
    '佐佐木小次郎': 'servant-sasaki',
    '美狄亚': 'servant-caster',
    '哈桑·萨巴赫(咒腕)': 'servant-hassan',
    '卫宫': 'servant-archer',
    '兰斯洛特': 'servant-berserker',
    '安格拉·曼纽': 'servant-avenger',
    '伊斯坎达尔': 'servant-rider',
    '迪卢木多·奥迪那': 'servant-lancer',
    '吉尔·德·雷': 'servant-gilles',
    '库·丘林': 'servant-cu-chulainn',
    '美杜莎': 'servant-medusa',
};

export const FATE_SERVANTS: ServantDefinition[] = SELECTABLE_SERVANT_NAMES
    .map((name) => DEMO_SERVANTS.find((servant) => servant.trueName === name))
    .filter((servant): servant is (typeof DEMO_SERVANTS)[number] => Boolean(servant))
    .map((servant) => ({
    ...servant,
    id: servantIds[servant.trueName] ?? `servant-${servant.id}`,
    name: servant.trueName,
    assetPath: 'fate-domination/servants/saber',
    skillAssetPaths: [],
    sourceStatus: 'verified',
    }));
const fallbackServants: ServantDefinition[] = [
    { id: 'servant-saber', name: 'Saber', assetPath: 'fate-domination/servants/saber', skillAssetPaths: [
        'fate-domination/servants/saber-skill-1',
        'fate-domination/servants/saber-skill-2',
        'fate-domination/servants/saber-skill-3',
    ], sourceStatus: 'verified' },
];
if (FATE_SERVANTS.length === 0) FATE_SERVANTS.push(...fallbackServants);

export const FATE_MASTER_BY_ID = Object.fromEntries(FATE_MASTERS.map((item) => [item.id, item])) as Record<string, MasterDefinition>;
export const FATE_SERVANT_BY_ID = Object.fromEntries(FATE_SERVANTS.map((item) => [item.id, item])) as Record<string, ServantDefinition>;
