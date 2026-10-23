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
    // CHM 创造者 / 大空洞的亡者：结构化资源例外，供领域统一消费。
    manaLimit: master.id === 'm_zouken' ? 16 : 12,
    initialCommandSpells: master.id === 'm_zouken' ? 0 : 3,
    skills: master.skills.map(skill => ({...skill, isMasterSkill: true})),
    ascensionSkill: { ...master.ascensionSkill, id: `${master.id}:ascension` },
    assetPath: masterAssets[master.id] ?? `fate-domination/masters/${master.id}`,
    sourceStatus: 'verified',
    }));
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
    deck: [...servant.deck],
    skillCards: servant.skillCards.map(skill => ({...skill, ...(skill.id === 'sc_emiya_2' ? {oncePerGame: true} : {})})),
    id: servantIds[servant.trueName] ?? `servant-${servant.trueName}`,
    name: servant.trueName,
    assetPath: `fate-domination/servants/${servantIds[servant.trueName]}`,
    skillAssetPaths: (servant.skillCards ?? []).map(skill => `fate-domination/skills/${skill.id}`),
    sourceStatus: 'verified',
    }));
export const FATE_MASTER_BY_ID = Object.fromEntries(FATE_MASTERS.map((item) => [item.id, item])) as Record<string, MasterDefinition>;
export const FATE_SERVANT_BY_ID = Object.fromEntries(FATE_SERVANTS.map((item) => [item.id, item])) as Record<string, ServantDefinition>;
