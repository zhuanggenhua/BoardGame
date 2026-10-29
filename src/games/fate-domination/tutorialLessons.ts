import type {FatePassageId,FateTutorialCopy} from './tutorialText';

/** 作者目标总账：先选学习目标及必要来源，再让正式动作投影消费；这些理由不进入玩家文案。 */
export const FATE_TUTORIAL_LESSONS = {
 opening:{goal:'知道怎样赢',when:'首个规则决定之前',why:'胜负句已包含十一天，不重复局长',passages:['victory']},
 preparation:{goal:'补充手牌',when:'首次准备',why:'理解手牌从何而来',passages:['preparation']},
 deployment:{goal:'选择具体部署点',when:'第一次前哨部署',why:'取得印刷魔力或地利',passages:['deployment']},
 deploymentChoice:{goal:'选择合法部署地点与点位',when:'首次部署选择',why:'让玩家按当前合法地图选点，解释工房与战场都按印刷数值从高到低占用',passages:['deployment','workshopOrder','terrainOrder']},
 battleDeployment:{goal:'选择战场地利',when:'首次在战场部署',why:'战场的印刷位置影响战力，不能当作工房收益的同类重复',passages:['terrain']},
 outpost:{goal:'识别前哨能力时机',when:'首次部署后',why:'部署后仍能使用前哨能力',passages:['outpostAbility']},
 cardReading:{goal:'读出攻击牌费用、威力和时机',when:'首次行动、使用技能之前',why:'在真实卡面识别支付字段和能力时机',passages:['attackFields','playTiming']},
 normalAttack:{goal:'选择两张常规攻击',when:'首次普通牌出牌',why:'建立本轮攻击',passages:['attack']},
 mixedAttack:{goal:'从手牌及技能区选择常规攻击',when:'首次使用技能攻击',why:'区分两个真实来源',passages:['attack','mixedAttack']},
 darkAttack:{goal:'选择暗置出牌',when:'首次暗置',why:'看清不支付、不计威力及来源限制',passages:['dark']},
 battlefieldDarkAttack:{goal:'理解战场上的明暗混合出牌',when:'首次战场暗置',why:'战场必须有一张明置，暗置牌不耗魔力且不计威力',passages:['battlefieldFaceUp','darkTraits']},
 masterAbility:{goal:'使用当前御主能力',when:'首次实际使用或观察该御主能力',why:'按当前能力原卡的时机、费用和效果理解，不能套用其他御主',passages:[]},
 riding:{goal:'使用坐骑召唤',when:'骑乘已激活后的行动',why:'激活后的行动能力与打出时触发不同，追加攻击参与当前战场',passages:['activatedAbility']},
 ridingChoice:{goal:'完成本次骑乘追加攻击',when:'坐骑召唤已打开正式选择',why:'只点名固定演示的实际牌，不再重复已读的时机、数量限制和确认入口',passages:[]},
 movement:{goal:'选择完整移动路线',when:'首次普通移动',why:'先移动到参与战斗的地点，争取战场事件战果，再建立常规攻击；一次选完整路线并支付',passages:['actionOrder','movementPayment','battlefieldReward']},
 engagement:{goal:'理解抵达交战地点后为何不能常规移动',when:'首次实际移动抵达交战战场后',why:'到达的战场已有对手；用原文交代交战限制，不以按钮消失代替说明',passages:['engagement']},
 sealMana:{goal:'用令咒补足技能行动的魔力',when:'首次费用准备',why:'按当前实际魔力与8点技能门槛决定逐枚支付次数；恢复面板承接真实效果',passages:['skillThreshold']},
 sealBattle:{goal:'用令咒强化战斗',when:'首次选择强化',why:'理解当前新增的战斗效果',passages:['sealBattle']},
 sealMove:{goal:'用令咒移动',when:'首次效果移动',why:'理解使用地点限制与效果移动默认无视交战，不能和常规移动混为一谈',passages:['sealMove','effectMovement']},
 actionAbility:{goal:'识别当前卡的行动能力',when:'首次新增行动能力',why:'先识别已打出的急行及无视交战的效果移动，再选择目的地，不能从追加攻击直接跳到移动选择',passages:['effectMovement']},
 endAction:{goal:'结束本席行动',when:'当前行动已完成',why:'通过正式电子入口把行动权交还下一席',passages:[]},
 battle:{goal:'参与战斗并等待其他席',when:'首次战斗阶段',why:'全员结束后才结算',passages:['battle']},
 settlement:{goal:'计算战力',when:'首次战场结算',why:'攻击、地利与正式修正共同决定结果',passages:['settlement']},
 roundReturn:{goal:'看懂本轮攻击的去向',when:'首次实际回合清理之后',why:'技能返区、普通牌进入弃牌堆',passages:['roundEndTiming','roundReturn']},
 discard:{goal:'回看自己的弃牌',when:'实际清理后第一次查看',why:'知道这些牌来自刚结束的攻击',passages:['discardInspect']},
 postBattle:{goal:'决定是否恢复令咒',when:'当前事件战场获胜后',why:'当前事件明确允许胜者恢复',passages:['postBattleReward']},
 publicPower:{goal:'查看公开合计威力与攻击',when:'第一轮攻击已公开',why:'比较当前战场局面',passages:['power']},
 revelation:{goal:'识别真名解放后的公开信息',when:'真实首次揭示',why:'从者及技能此后可以查看',passages:['revelation']},
 elimination:{goal:'识别淘汰',when:'真实第十天清理后',why:'区分存活席与淘汰席',passages:['elimination']},
 phaseOrder:{goal:'完成阶段并交还行动权',when:'首次阶段交接',why:'所有席位完成后才换阶段',passages:['order']},
 navigation:{goal:'检视当前地图规则',when:'首次地图交互',why:'电子版的拖动、缩放与检视不是纸面操作',passages:[]},
} satisfies Record<string,{goal:string;when:string;why:string;passages:readonly FatePassageId[]}>;
export type FateLessonId=keyof typeof FATE_TUTORIAL_LESSONS;
export function fateLessonCopy(lessonId:FateLessonId,input?:FateTutorialCopy['input']):FateTutorialCopy {
 return {lessonId,passages:[...FATE_TUTORIAL_LESSONS[lessonId].passages],...(input?{input}:{})};
}
