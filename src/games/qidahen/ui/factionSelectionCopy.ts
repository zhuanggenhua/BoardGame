import type { QidahenFactionId, QidahenScenarioId } from '../domain/types';

export const QIDAHEN_FACTION_SELECT_IDS: readonly QidahenFactionId[] = ['ming', 'mongol', 'jin'];

export const QIDAHEN_FACTION_MARKER_ASSET: Record<QidahenFactionId, string> = {
    ming: 'qidahen/markers/ming-control-diplomacy-marker-a',
    mongol: 'qidahen/markers/mongol-control-diplomacy-marker-a',
    jin: 'qidahen/markers/jin-control-diplomacy-marker-a',
};

export interface QidahenFactionActionCopy {
    id: string;
    name: string;
    effect: string;
}

export interface QidahenFactionSelectCopy {
    intro: string;
    facts: string;
    actions: readonly QidahenFactionActionCopy[];
}

export const QIDAHEN_FACTION_SELECT_COPY: Record<QidahenFactionId, QidahenFactionSelectCopy> = {
    ming: {
        intro: '屹立百年的火药帝国。萨尔浒之役后对东北掌握力大不如前，领土岌岌可危。',
        facts: '手牌上限 15 · 牌库 40 · 仅大明可无条件使用水路',
        actions: [
            {
                id: 'raid',
                name: '突袭作战',
                effect: '弃1张手牌，执行进攻行动(不能执行调度)。',
            },
            {
                id: 'recruit',
                name: '征召军队',
                effect: '弃1张手牌，建立6个等级2部队，或2个等级4的川兵(特殊步兵)部队。',
            },
            {
                id: 'grant-pardon',
                name: '赐印招安',
                effect: '弃3张手牌，指定1个对手，对手相邻于大明控制区域的1个部队移动到相邻的大明控制区域并转换阵营成为大明部队。(必须由被指定的玩家选择部队)',
            },
            {
                id: 'drive-tiger',
                name: '驱虎吞狼',
                effect: '弃3张手牌，指定1个对手抽6张手牌，大明指挥该玩家最多6个部队进行调度进攻，进行野战或城战时由该玩家打出战术牌、劫掠、战损、撤退。需该玩家同意才可执行。',
            },
        ],
    },
    mongol: {
        intro: '向来纷争的蒙古诸部，重新统一在察哈尔部林丹汗帐下，摆出争霸态势。',
        facts: '手牌上限 10 · 牌库 20',
        actions: [
            {
                id: 'raid',
                name: '突袭作战',
                effect: '弃1张手牌，执行进攻行动(不能执行调度)。',
            },
            {
                id: 'ma-shi-trade',
                name: '马市贸易',
                effect: '弃1张手牌，大明玩家选择建立1-3个部队，蒙古玩家抽2倍张数的手牌。',
            },
            {
                id: 'khan-edict',
                name: '大汗令箭',
                effect: '弃1张手牌，执行「征兵训练」或是「外交雇佣」行动，不需再支付花费。',
            },
        ],
    },
    jin: {
        intro: '建州女真首领努尔哈赤起兵复仇，建立后金国。',
        facts: '手牌上限 10 · 牌库 18',
        actions: [
            {
                id: 'raid',
                name: '突袭作战',
                effect: '弃1张手牌，执行进攻行动(不能执行调度)。',
            },
            {
                id: 'marriage-subjugation',
                name: '联姻诱降',
                effect: '弃2张手牌，指定1个邻近自己控制区域的对手控制区域，该玩家必须支付等同该区域部队数量2倍的手牌，否则该区域成为后金控制，所有部队被消灭，其中一个部队转换阵营成为后金部队(可以获得炮兵)。不能对首都区域、长城以南使用，「辽西」计算时2个部队不需要支付(视为存在于蓟镇山海关)。若指定区域处于围城状态，此行动只对城外部队生效，也不影响该地区控制权。',
            },
        ],
    },
};

export const QIDAHEN_SCENARIO_SHORT_NAME: Record<QidahenScenarioId, string> = {
    'post-sarhu-1619': '萨尔浒战后',
    'shanhaiguan-1622': '山海关之议',
    'dingmao-rebellion-1627': '丁卯胡乱',
};
