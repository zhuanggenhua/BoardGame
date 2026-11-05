import type { EventCardDefinition } from '../domain/types';

// Repeated slots intentionally reference the same printed face (events-fuyuki-ocr.md).
const eventAssets: Record<string,string> = {"fuyuki_E0": "reclaim-illya", "fuyuki_E1": "risk-it-all", "fuyuki_E2": "risk-it-all", "fuyuki_E3": "holy-ground", "fuyuki_E4": "fire-suppression", "fuyuki_E5": "power-test", "fuyuki_E6": "fate-battle", "fuyuki_E7": "high-ground", "fuyuki_E8": "ground-zero", "fuyuki_E9": "glorious-duel", "fuyuki_E10": "ritual-site", "fuyuki_E11": "treacherous-ground", "fuyuki_E12": "suppress-threat", "fuyuki_E13": "ambush", "fuyuki_E14": "ambush", "fuyuki_E15": "synergy", "fuyuki_E16": "reality-marble", "fuyuki_E17": "reality-marble", "fuyuki_E18": "leyline", "fuyuki_E19": "leyline"};

// Authoring source: intake/catalog/events-fuyuki-ocr.md (CHM), not demo summaries.
const lockedEvents: Array<[string,number,string]> = [
  [
    "夺回伊莉雅",
    5,
    ""
  ],
  [
    "铤而走险",
    4,
    "战果排名倒数第一者于此战场+12合计威力，倒数第二+8合计威力，倒数第三+4合计威力。（分数相同时，假设末位为A、B，倒数第二为C，第三为D，则A、B各+12，C+4，D+0）"
  ],
  [
    "铤而走险",
    4,
    "战果排名倒数第一者于此战场+12合计威力，倒数第二+8合计威力，倒数第三+4合计威力。（分数相同时，假设末位为A、B，倒数第二为C，第三为D，则A、B各+12，C+4，D+0）"
  ],
  [
    "圣地",
    3,
    "魔术攻击于此战场获得威力+3。"
  ],
  [
    "火力压制",
    3,
    "迅捷攻击于此战场获得威力+3。"
  ],
  [
    "强度测验",
    3,
    "力量攻击于此战场获得威力+3。"
  ],
  [
    "命运之战",
    2,
    "此战场上基本威力1和2的攻击基本威力增加至5。"
  ],
  [
    "占领高地",
    3,
    "位于此战场的玩家计算战力时，将其地利翻倍。"
  ],
  [
    "归零地",
    3,
    "此战场的地利位置不提供地利。"
  ],
  [
    "光荣的决斗",
    2,
    "力量攻击于此战场获得威力+2。"
  ],
  [
    "祭祀之地",
    2,
    "魔术攻击于此战场获得威力+2。"
  ],
  [
    "险恶地形",
    2,
    "迅捷攻击于此战场获得威力+2。"
  ],
  [
    "遏制第三方威胁",
    2,
    "基本威力4及以上的攻击于此战场获得+1威力。此战场的胜者可以恢复1枚令咒。"
  ],
  [
    "偷袭",
    2,
    "从者真名隐藏的玩家于此战场合计威力+5。"
  ],
  [
    "偷袭",
    2,
    "从者真名隐藏的玩家于此战场合计威力+5。"
  ],
  [
    "协同",
    2,
    "于此战场的玩家，其所有攻击若至少有一种属性相同，则合计威力+4。"
  ],
  [
    "固有结界",
    2,
    "特殊攻击于此战场禁止打出。所有玩家不能移动至此地点也不能离开此地点。"
  ],
  [
    "固有结界",
    2,
    "特殊攻击于此战场禁止打出。所有玩家不能移动至此地点也不能离开此地点。"
  ],
  [
    "地脉",
    2,
    "位于此战场的玩家在此战场发生战斗后，获得2点魔力。"
  ],
  [
    "地脉",
    2,
    "位于此战场的玩家在此战场发生战斗后，获得2点魔力。"
  ]
];

export const FATE_EVENTS: EventCardDefinition[] = lockedEvents.map(([name,victoryPoints,effectSummary],index) => {
 const id=`fuyuki_E${index}`;
 return {id,name,victoryPoints,effectSummary,sourceStatus:'verified',assetPath:`fate-domination/events/${eventAssets[id]}`};
});

export const FATE_EVENT_BACK = 'fate-domination/events/back';
