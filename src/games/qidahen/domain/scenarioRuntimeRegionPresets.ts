import {
    buildArtilleryTroopStack,
    buildFactionTroopStack,
    buildMercenaryTroopStack,
    buildRegularTroopStack,
} from './troopStacks';
import { cloneSpecialTroopStacksAsPieces } from './troopCompat';
import type { QidahenCore, QidahenScenarioId, QidahenSpecialTroopStack } from './types';

type QidahenScenarioRuntimeRegionPreset = Partial<Pick<QidahenCore['regions'][number], 'controller' | 'troops' | 'population' | 'note'>> & {
    specialTroops?: QidahenSpecialTroopStack[];
};

const QIDAHEN_SCENARIO_RUNTIME_REGION_PRESETS: Partial<Record<QidahenScenarioId, Partial<Record<string, QidahenScenarioRuntimeRegionPreset>>>> = {
    'post-sarhu-1619': {
        'city-region-1': {
            controller: 'ming',
            troops: 1,
            population: 2,
            specialTroops: [buildRegularTroopStack('ming', 'post-sarhu-1619-datong', 1, 1)],
        },
        'city-region-2': {
            controller: 'neutral',
            troops: 0,
            population: 2,
            specialTroops: [],
        },
        'city-region-3': {
            controller: 'neutral',
            troops: 0,
            population: 2,
            specialTroops: [],
        },
        'city-region-4': {
            controller: 'neutral',
            troops: 0,
            population: 2,
            specialTroops: [],
        },
        'city-region-5': {
            controller: 'jin',
            troops: 1,
            population: 1,
            specialTroops: [buildRegularTroopStack('jin', 'post-sarhu-1619-huifa', 1, 2)],
        },
        'city-region-6': {
            controller: 'mongol',
            troops: 1,
            population: 1,
            specialTroops: [buildMercenaryTroopStack('mongol', 'post-sarhu-1619-zhalute', 1, 2, 'cavalry')],
        },
        'city-region-7': {
            controller: 'mongol',
            troops: 1,
            population: 2,
            specialTroops: [buildRegularTroopStack('mongol', 'post-sarhu-1619-yehe', 1, 2)],
        },
        'city-region-8': {
            controller: 'mongol',
            troops: 1,
            population: 1,
            specialTroops: [buildMercenaryTroopStack('mongol', 'post-sarhu-1619-balin', 1, 2, 'cavalry')],
        },
        'city-region-9': {
            controller: 'jin',
            troops: 1,
            population: 1,
            specialTroops: [buildRegularTroopStack('jin', 'post-sarhu-1619-hada', 1, 2)],
        },
        'city-region-10': {
            controller: 'mongol',
            troops: 1,
            population: 1,
            specialTroops: [buildMercenaryTroopStack('mongol', 'post-sarhu-1619-neikalkha', 1, 2, 'cavalry')],
        },
        'city-region-11': {
            controller: 'jin',
            troops: 2,
            population: 2,
            specialTroops: [buildRegularTroopStack('jin', 'post-sarhu-1619-changbai', 2, 2)],
        },
        'xian-xing': {
            controller: 'ming',
            troops: 1,
            population: 0,
            specialTroops: [buildMercenaryTroopStack('ming', 'post-sarhu-1619-hamheung', 1, 2)],
        },
        'city-region-13': {
            controller: 'jin',
            troops: 3,
            population: 2,
            specialTroops: [
                buildFactionTroopStack('jin', 'post-sarhu-1619-jianzhou-elite', 'infantry', 2, 4),
                buildRegularTroopStack('jin', 'post-sarhu-1619-jianzhou-regular', 1, 2),
            ],
        },
        'city-region-14': {
            controller: 'mongol',
            troops: 3,
            population: 3,
            specialTroops: [buildFactionTroopStack('mongol', 'post-sarhu-1619-chahar', 'cavalry', 3, 3)],
        },
        'city-region-15': {
            controller: 'ming',
            troops: 3,
            population: 3,
            specialTroops: [
                buildFactionTroopStack('ming', 'post-sarhu-1619-liaobei-cavalry', 'cavalry', 2, 1),
                buildArtilleryTroopStack('ming', 'post-sarhu-1619-liaobei', 1, 1),
            ],
            note: '剧本一起始本土拆模：辽北独立承接 2 个 Lv1 骑兵、1 个 Lv1 炮兵与 3 人口。',
        },
        'city-region-15-liaodong': {
            controller: 'ming',
            troops: 3,
            population: 3,
            specialTroops: [
                buildArtilleryTroopStack('ming', 'post-sarhu-1619-liaodong', 1, 1),
                buildRegularTroopStack('ming', 'post-sarhu-1619-liaodong', 2, 1),
            ],
            note: '剧本一起始本土拆模：辽东独立承接 1 个 Lv1 炮兵、2 个 Lv1 步兵与 3 人口。',
        },
        'city-region-16': {
            controller: 'mongol',
            troops: 1,
            population: 1,
            specialTroops: [buildMercenaryTroopStack('mongol', 'post-sarhu-1619-keshiketeng', 1, 2, 'cavalry')],
        },
        'city-region-17': {
            controller: 'mongol',
            troops: 1,
            population: 1,
            specialTroops: [buildMercenaryTroopStack('mongol', 'post-sarhu-1619-naiman', 1, 2, 'cavalry')],
        },
        'city-region-18': {
            controller: 'ming',
            troops: 1,
            population: 0,
            specialTroops: [buildMercenaryTroopStack('ming', 'post-sarhu-1619-pyongyang', 1, 2)],
        },
        'city-region-19': {
            controller: 'mongol',
            troops: 1,
            population: 1,
            specialTroops: [buildMercenaryTroopStack('mongol', 'post-sarhu-1619-aohanbu', 1, 2, 'cavalry')],
        },
        'city-region-19-liaoxi': {
            controller: 'ming',
            troops: 1,
            population: 2,
            specialTroops: [buildRegularTroopStack('ming', 'post-sarhu-1619-liaoxi', 1, 1)],
        },
        'city-region-20': {
            controller: 'neutral',
            troops: 0,
            population: 3,
            specialTroops: [],
        },
        'city-region-21': {
            controller: 'neutral',
            troops: 0,
            population: 2,
            specialTroops: [],
        },
        'city-region-22': {
            controller: 'ming',
            troops: 1,
            population: 2,
            specialTroops: [buildRegularTroopStack('ming', 'post-sarhu-1619-dongjiang', 1, 1)],
        },
        'city-region-24': {
            controller: 'ming',
            troops: 1,
            population: 2,
            specialTroops: [buildRegularTroopStack('ming', 'post-sarhu-1619-xuanfu', 1, 1)],
        },
        'city-region-26': {
            controller: 'neutral',
            troops: 0,
            population: 3,
            specialTroops: [],
        },
        'city-region-27': {
            controller: 'ming',
            troops: 1,
            population: 2,
            specialTroops: [buildRegularTroopStack('ming', 'post-sarhu-1619-baoding', 1, 1)],
        },
        'city-region-28-jizhen': {
            controller: 'ming',
            troops: 1,
            population: 2,
            specialTroops: [buildRegularTroopStack('ming', 'post-sarhu-1619-jizhen', 1, 1)],
            note: '剧本一起始本土拆模：蓟镇独立承接 1 个 Lv1 部队与 2 人口。',
        },
        'city-region-28': {
            controller: 'ming',
            troops: 3,
            population: 5,
            specialTroops: [buildRegularTroopStack('ming', 'post-sarhu-1619-shuntian', 3, 2)],
            note: '剧本一起始本土拆模：顺天独立承接 3 个 Lv2 部队与 5 人口。',
        },
        'city-region-29': {
            controller: 'ming',
            troops: 1,
            population: 0,
            specialTroops: [buildMercenaryTroopStack('ming', 'post-sarhu-1619-hanseong', 1, 2)],
        },
        'city-region-30': {
            controller: 'ming',
            troops: 1,
            population: 2,
            specialTroops: [buildRegularTroopStack('ming', 'post-sarhu-1619-shanxi', 1, 1)],
        },
        'city-region-31': {
            controller: 'ming',
            troops: 1,
            population: 2,
            specialTroops: [buildRegularTroopStack('ming', 'post-sarhu-1619-yansui', 1, 1)],
        },
        'city-region-32': {
            controller: 'ming',
            troops: 1,
            population: 2,
            specialTroops: [buildRegularTroopStack('ming', 'post-sarhu-1619-denglai', 1, 1)],
        },
        'city-region-33': {
            controller: 'ming',
            troops: 1,
            population: 2,
            specialTroops: [buildRegularTroopStack('ming', 'post-sarhu-1619-shandong', 1, 1)],
        },
    },
    'shanhaiguan-1622': {
        'city-region-1': {
            controller: 'ming',
            troops: 2,
            population: 2,
            specialTroops: [buildRegularTroopStack('ming', 'shanhaiguan-1622-datong', 2, 2)],
        },
        'city-region-2': {
            controller: 'mongol',
            troops: 0,
            population: 3,
            specialTroops: [],
        },
        'city-region-3': {
            controller: 'neutral',
            troops: 0,
            population: 2,
            specialTroops: [],
        },
        'city-region-4': {
            controller: 'jin',
            troops: 2,
            population: 2,
            specialTroops: [buildRegularTroopStack('jin', 'shanhaiguan-1622-wulabu', 2, 2)],
        },
        'city-region-5': {
            controller: 'jin',
            troops: 1,
            population: 1,
            specialTroops: [buildMercenaryTroopStack('jin', 'shanhaiguan-1622-huifa', 1, 2)],
        },
        'city-region-6': {
            controller: 'mongol',
            troops: 1,
            population: 2,
            specialTroops: [buildMercenaryTroopStack('mongol', 'shanhaiguan-1622-zhalute', 1, 2, 'cavalry')],
        },
        'city-region-7': {
            controller: 'jin',
            troops: 2,
            population: 2,
            specialTroops: [buildRegularTroopStack('jin', 'shanhaiguan-1622-yehe', 2, 2)],
        },
        'city-region-8': {
            controller: 'mongol',
            troops: 1,
            population: 1,
            specialTroops: [buildMercenaryTroopStack('mongol', 'shanhaiguan-1622-balin', 1, 2, 'cavalry')],
        },
        'city-region-9': {
            controller: 'jin',
            troops: 1,
            population: 1,
            specialTroops: [buildMercenaryTroopStack('jin', 'shanhaiguan-1622-hada', 1, 2)],
        },
        'city-region-10': {
            controller: 'mongol',
            troops: 1,
            population: 1,
            specialTroops: [buildMercenaryTroopStack('mongol', 'shanhaiguan-1622-neikalkha', 1, 2, 'cavalry')],
        },
        'city-region-11': {
            controller: 'jin',
            troops: 2,
            population: 2,
            specialTroops: [buildRegularTroopStack('jin', 'shanhaiguan-1622-changbai', 2, 2)],
        },
        'xian-xing': {
            controller: 'ming',
            troops: 1,
            specialTroops: [buildMercenaryTroopStack('ming', 'shanhaiguan-1622-hamheung', 1, 2)],
        },
        'city-region-13': {
            controller: 'jin',
            troops: 2,
            population: 2,
            specialTroops: [buildRegularTroopStack('jin', 'shanhaiguan-1622-jianzhou', 2, 3)],
        },
        'city-region-14': {
            controller: 'mongol',
            troops: 3,
            population: 3,
            specialTroops: [buildFactionTroopStack('mongol', 'shanhaiguan-1622-chahar', 'cavalry', 3, 3)],
        },
        'city-region-15': {
            controller: 'jin',
            troops: 2,
            population: 3,
            specialTroops: [buildRegularTroopStack('jin', 'shanhaiguan-1622-liaobei', 2, 4)],
            note: '剧本二起始控制区：辽北独立承接 2 个 Lv4 步兵、3 人口，并保留规则书干旱标记语义。',
        },
        'city-region-15-liaodong': {
            controller: 'jin',
            troops: 2,
            population: 3,
            specialTroops: [buildRegularTroopStack('jin', 'shanhaiguan-1622-liaodong', 2, 4)],
            note: '剧本二起始控制区：辽东独立承接 2 个 Lv4 步兵、3 人口，并保留规则书干旱标记语义。',
        },
        'city-region-16': {
            controller: 'mongol',
            troops: 1,
            population: 2,
            specialTroops: [buildMercenaryTroopStack('mongol', 'shanhaiguan-1622-keshiketeng', 1, 2, 'cavalry')],
        },
        'city-region-17': {
            controller: 'mongol',
            troops: 1,
            population: 1,
            specialTroops: [buildMercenaryTroopStack('mongol', 'shanhaiguan-1622-naiman', 1, 2, 'cavalry')],
        },
        'city-region-19': {
            controller: 'mongol',
            troops: 1,
            population: 1,
            specialTroops: [buildMercenaryTroopStack('mongol', 'shanhaiguan-1622-aohanbu', 1, 2, 'cavalry')],
            note: '剧本二起始控制区：敖汉部独立承接 1 个 Lv2 雇佣骑兵与 1 人口。',
        },
        'city-region-18': {
            controller: 'ming',
            troops: 1,
            specialTroops: [buildMercenaryTroopStack('ming', 'shanhaiguan-1622-pyongyang', 1, 2)],
        },
        'city-region-19-liaoxi': {
            controller: 'ming',
            troops: 0,
            population: 0,
            specialTroops: [],
            note: '剧本二起始本土：辽西独立承接 0 部队、0 人口。',
        },
        'city-region-20': {
            controller: 'neutral',
            troops: 0,
            population: 3,
            specialTroops: [],
        },
        'city-region-21': {
            controller: 'mongol',
            troops: 3,
            population: 2,
            specialTroops: [
                buildFactionTroopStack('mongol', 'shanhaiguan-1622-kalaqin-regular', 'cavalry', 2, 3),
                buildMercenaryTroopStack('mongol', 'shanhaiguan-1622-kalaqin', 1, 3, 'cavalry'),
            ],
        },
        'city-region-22': {
            controller: 'ming',
            troops: 2,
            population: 2,
            specialTroops: [buildRegularTroopStack('ming', 'shanhaiguan-1622-dongjiang', 2, 2)],
        },
        'city-region-24': {
            controller: 'ming',
            troops: 2,
            population: 2,
            specialTroops: [buildRegularTroopStack('ming', 'shanhaiguan-1622-xuanfu', 2, 2)],
        },
        'city-region-26': {
            controller: 'mongol',
            troops: 3,
            population: 4,
            specialTroops: [
                buildFactionTroopStack('mongol', 'shanhaiguan-1622-eerduosi-regular', 'cavalry', 2, 3),
                buildMercenaryTroopStack('mongol', 'shanhaiguan-1622-eerduosi', 1, 3, 'cavalry'),
            ],
        },
        'city-region-27': {
            controller: 'ming',
            troops: 0,
            population: 4,
            specialTroops: [],
        },
        'city-region-28-jizhen': {
            controller: 'ming',
            troops: 4,
            population: 4,
            specialTroops: [
                buildRegularTroopStack('ming', 'shanhaiguan-1622-jizhen', 3, 3),
                buildArtilleryTroopStack('ming', 'shanhaiguan-1622-jizhen', 1, 2),
            ],
            note: '剧本二起始本土拆模：蓟镇当前先承接原共区里的前线部队、炮兵与 4 人口。',
        },
        'city-region-28': {
            controller: 'ming',
            troops: 0,
            population: 1,
            specialTroops: [],
            note: '剧本二起始本土拆模：顺天当前先从原共区里单独析出 1 人口，兵力仍全部留在蓟镇前线。',
        },
        'city-region-29': {
            controller: 'ming',
            troops: 1,
            specialTroops: [buildMercenaryTroopStack('ming', 'shanhaiguan-1622-hanseong', 1, 2)],
        },
        'city-region-30': {
            controller: 'ming',
            troops: 0,
            population: 4,
            specialTroops: [],
        },
        'city-region-31': {
            controller: 'ming',
            troops: 2,
            population: 2,
            specialTroops: [buildRegularTroopStack('ming', 'shanhaiguan-1622-yansui', 2, 2)],
        },
        'city-region-32': {
            controller: 'ming',
            troops: 2,
            population: 2,
            specialTroops: [buildRegularTroopStack('ming', 'shanhaiguan-1622-denglai', 2, 2)],
        },
        'city-region-33': {
            controller: 'ming',
            troops: 0,
            population: 4,
            specialTroops: [],
        },
    },
    'dingmao-rebellion-1627': {
        'city-region-1': {
            controller: 'ming',
            troops: 1,
            population: 2,
            specialTroops: [buildRegularTroopStack('ming', 'dingmao-1627-datong', 1, 2)],
        },
        'city-region-2': {
            controller: 'neutral',
            troops: 0,
            population: 0,
            specialTroops: [],
        },
        'city-region-3': {
            controller: 'jin',
            troops: 2,
            population: 1,
            specialTroops: [buildFactionTroopStack('mongol', 'dingmao-1627-keerqin', 'cavalry', 2, 2)],
        },
        'city-region-4': {
            controller: 'jin',
            troops: 1,
            population: 1,
            specialTroops: [buildRegularTroopStack('jin', 'dingmao-1627-wulabu', 1, 2)],
        },
        'city-region-5': {
            controller: 'jin',
            troops: 1,
            population: 1,
            specialTroops: [buildMercenaryTroopStack('jin', 'dingmao-1627-huifa', 1, 2)],
        },
        'city-region-6': {
            controller: 'neutral',
            troops: 0,
            population: 1,
            specialTroops: [],
        },
        'city-region-7': {
            controller: 'jin',
            troops: 1,
            population: 1,
            specialTroops: [buildRegularTroopStack('jin', 'dingmao-1627-yehe', 1, 2)],
        },
        'city-region-8': {
            controller: 'neutral',
            troops: 0,
            population: 1,
            specialTroops: [],
        },
        'city-region-9': {
            controller: 'jin',
            troops: 1,
            population: 1,
            specialTroops: [buildMercenaryTroopStack('jin', 'dingmao-1627-hada', 1, 2)],
        },
        'city-region-10': {
            controller: 'jin',
            troops: 1,
            population: 1,
            specialTroops: [buildFactionTroopStack('mongol', 'dingmao-1627-neikalkha', 'cavalry', 1, 1)],
        },
        'city-region-11': {
            controller: 'jin',
            troops: 1,
            population: 2,
            specialTroops: [buildRegularTroopStack('jin', 'dingmao-1627-changbai', 1, 2)],
            note: '剧本三起始本土：长白当前按 1 个 Lv2 部队与 2 人口落地，并在注释层保留干旱标记语义。',
        },
        'xian-xing': {
            controller: 'jin',
            troops: 1,
            specialTroops: [buildFactionTroopStack('jin', 'dingmao-1627-hamheung', 'cavalry', 1, 2)],
        },
        'city-region-13': {
            controller: 'jin',
            troops: 2,
            population: 2,
            specialTroops: [
                buildFactionTroopStack('jin', 'dingmao-1627-jianzhou-elite', 'infantry', 1, 4),
                buildRegularTroopStack('jin', 'dingmao-1627-jianzhou-regular', 1, 3),
            ],
            note: '剧本三起始本土：建州当前按 1 个 Lv4 步兵、1 个 Lv3 部队与 2 人口落地，并在注释层保留干旱标记语义。',
        },
        'city-region-14': {
            controller: 'neutral',
            troops: 0,
            population: 0,
            specialTroops: [],
        },
        'city-region-15': {
            controller: 'jin',
            troops: 2,
            population: 2,
            specialTroops: [buildRegularTroopStack('jin', 'dingmao-1627-liaobei', 2, 3)],
            note: '剧本三起始控制区：辽北独立承接 2 个 Lv3 步兵、2 人口，并保留规则书本土标记语义。',
        },
        'city-region-15-liaodong': {
            controller: 'jin',
            troops: 2,
            population: 2,
            specialTroops: [buildRegularTroopStack('jin', 'dingmao-1627-liaodong', 2, 3)],
            note: '剧本三起始控制区：辽东独立承接 2 个 Lv3 步兵、2 人口，并保留规则书本土标记语义。',
        },
        'city-region-16': {
            controller: 'neutral',
            troops: 0,
            population: 1,
            specialTroops: [],
        },
        'city-region-17': {
            controller: 'jin',
            troops: 1,
            population: 1,
            specialTroops: [buildFactionTroopStack('mongol', 'dingmao-1627-naiman', 'cavalry', 1, 1)],
        },
        'city-region-19': {
            controller: 'jin',
            troops: 1,
            population: 1,
            specialTroops: [buildFactionTroopStack('mongol', 'dingmao-1627-aohanbu', 'cavalry', 1, 1)],
            note: '剧本三起始控制区：敖汉部独立承接 1 个蒙古 Lv1 骑兵与 1 人口。',
        },
        'city-region-18': {
            controller: 'ming',
            troops: 1,
            specialTroops: [buildMercenaryTroopStack('ming', 'dingmao-1627-pyongyang', 1, 2)],
        },
        'city-region-19-liaoxi': {
            controller: 'ming',
            troops: 3,
            population: 4,
            specialTroops: [
                buildMercenaryTroopStack('ming', 'dingmao-1627-liaoxi', 2, 2),
                buildArtilleryTroopStack('ming', 'dingmao-1627-liaoxi', 1, 2),
            ],
            note: '剧本三起始本土：辽西独立承接 2 个 Lv2 雇佣部队、1 个 Lv2 炮兵与 4 人口。',
        },
        'city-region-20': {
            controller: 'neutral',
            troops: 0,
            population: 2,
            specialTroops: [],
        },
        'city-region-21': {
            controller: 'ming',
            troops: 1,
            population: 1,
            specialTroops: [buildFactionTroopStack('mongol', 'dingmao-1627-kalaqin', 'cavalry', 1, 2)],
            note: '剧本三起始反面控制标记：喀喇沁部承接 1 个蒙古 Lv2 骑兵与 1 人口；朵颜部尚无已确认独立运行时区域。',
        },
        'city-region-22': {
            controller: 'ming',
            troops: 3,
            population: 4,
            specialTroops: [
                buildMercenaryTroopStack('ming', 'dingmao-1627-dongjiang', 2, 2),
                buildArtilleryTroopStack('ming', 'dingmao-1627-dongjiang', 1, 2),
            ],
        },
        'city-region-24': {
            controller: 'ming',
            troops: 1,
            population: 2,
            specialTroops: [buildRegularTroopStack('ming', 'dingmao-1627-xuanfu', 1, 2)],
        },
        'city-region-26': {
            controller: 'ming',
            troops: 1,
            population: 3,
            specialTroops: [buildFactionTroopStack('mongol', 'dingmao-1627-eerduosi', 'cavalry', 1, 2)],
        },
        'city-region-27': {
            controller: 'ming',
            troops: 0,
            population: 4,
            specialTroops: [],
        },
        'city-region-28-jizhen': {
            controller: 'ming',
            troops: 3,
            population: 4,
            specialTroops: [
                buildRegularTroopStack('ming', 'dingmao-1627-jizhen', 2, 3),
                buildArtilleryTroopStack('ming', 'dingmao-1627-jizhen', 1, 2),
            ],
            note: '剧本三起始本土拆模：蓟镇当前先承接原共区里的前线部队、炮兵与 4 人口。',
        },
        'city-region-28': {
            controller: 'ming',
            troops: 0,
            population: 1,
            specialTroops: [],
            note: '剧本三起始本土拆模：顺天当前先从原共区里单独析出 1 人口，兵力仍全部留在蓟镇前线。',
        },
        'city-region-29': {
            controller: 'ming',
            troops: 1,
            specialTroops: [buildMercenaryTroopStack('ming', 'dingmao-1627-hanseong', 1, 2)],
        },
        'city-region-30': {
            controller: 'ming',
            troops: 0,
            population: 4,
            specialTroops: [],
        },
        'city-region-31': {
            controller: 'ming',
            troops: 1,
            population: 2,
            specialTroops: [buildRegularTroopStack('ming', 'dingmao-1627-yansui', 1, 2)],
        },
        'city-region-32': {
            controller: 'ming',
            troops: 1,
            population: 2,
            specialTroops: [buildRegularTroopStack('ming', 'dingmao-1627-denglai', 1, 2)],
        },
        'city-region-33': {
            controller: 'ming',
            troops: 3,
            population: 5,
            specialTroops: [
                buildRegularTroopStack('ming', 'dingmao-1627-shandong', 2, 3),
                buildArtilleryTroopStack('ming', 'dingmao-1627-shandong', 1, 2),
            ],
        },
    },
};

export const applyQidahenScenarioRuntimeRegionPreset = (
    regions: QidahenCore['regions'],
    scenarioId: QidahenScenarioId,
): QidahenCore['regions'] => {
    const preset = QIDAHEN_SCENARIO_RUNTIME_REGION_PRESETS[scenarioId];
    if (!preset) {
        return regions;
    }

    return regions.map((region) => {
        const override = preset[region.id];
        if (!override || region.isLogicalRegion) {
            return region;
        }
        return {
            ...region,
            controller: override.controller ?? region.controller,
            troops: override.troops ?? region.troops,
            population: override.population ?? region.population,
            note: override.note ?? region.note,
            specialTroops: override.specialTroops
                ? cloneSpecialTroopStacksAsPieces(override.specialTroops)
                : region.specialTroops,
        };
    });
};
