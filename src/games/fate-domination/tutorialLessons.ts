import type {FatePassageId,FateTutorialCopy} from './tutorialText';

/** 作者目标总账：先选学习目标及必要来源，再让正式动作投影消费；这些理由不进入玩家文案。 */
export const FATE_TUTORIAL_LESSONS = {
 opening:{goal:'知道怎样赢',when:'首个规则决定之前',why:'胜负句已包含十一天，不重复局长',passages:['victory']},
 preparation:{goal:'补充手牌',when:'首次准备',why:'理解手牌从何而来',passages:['preparation']},
 deployment:{goal:'首次在工房取得魔力',when:'第一次实际选择工房点位',why:'工房顺序与收益沿用首次部署选择的同一来源，不换一个来源ID重复通用部署规则',passages:['workshopOrder']},
 deploymentChoice:{goal:'选择合法部署地点与点位',when:'首次部署选择',why:'在学员首次选点时解释部署地点与工房顺序，工房收益不在两段重复；地利留到实际战场部署',passages:['deploymentPlaces','workshopOrder']},
 battleDeployment:{goal:'选择战场地利',when:'首次在战场部署',why:'战场的印刷位置影响战力，不能当作工房收益的同类重复',passages:['terrain']},
 outpost:{goal:'识别前哨能力时机',when:'首次部署后',why:'部署后仍能使用前哨能力',passages:['outpostAbility']},
 masterReading:{goal:'通过头像读取即将使用的御主能力',when:'首次使用战略部署之前',why:'先教角色资料与原卡检视入口，再立即使用所读能力；不在移动中插入无关窗口参观',passages:[]},
 cardReading:{goal:'读出攻击牌费用与威力',when:'首次费用准备之前',why:'用即将打出的骑乘识别两个数字；卡文本身已写明打出时，不再另讲被动分类',passages:['attackFields']},
 normalAttack:{goal:'选择两张常规攻击',when:'首次普通牌出牌',why:'建立本轮攻击',passages:['attack']},
 mixedAttack:{goal:'从手牌及技能区选择常规攻击',when:'首次使用技能攻击',why:'区分两个真实来源',passages:['attack','mixedAttack']},
 darkAttack:{goal:'选择暗置出牌',when:'首次暗置',why:'看清不支付、不计威力及来源限制',passages:['dark']},
 battlefieldDarkAttack:{goal:'理解战场上的明暗混合出牌',when:'首次战场暗置',why:'战场必须有一张明置，暗置牌不耗魔力且不计威力',passages:['battlefieldFaceUp','darkTraits']},
 masterAbility:{goal:'使用当前御主能力',when:'首次实际使用或观察该御主能力',why:'在实际使用处连接前哨时机与当前能力，不另加部署后说明卡',passages:['outpostAbility']},
 riding:{goal:'使用坐骑召唤',when:'骑乘已激活后的行动',why:'激活后的行动能力与打出时触发不同，追加攻击参与当前战场',passages:['activatedAbility']},
 ridingChoice:{goal:'完成本次骑乘追加攻击',when:'坐骑召唤已打开正式选择',why:'只点名固定演示的实际牌，不再重复已读的时机、数量限制和确认入口',passages:[]},
 movement:{goal:'选择完整移动路线',when:'首次普通移动',why:'先移动到参与战斗的地点，再建立常规攻击；一次选完整路线并支付。战果领取留给实际战斗结算',passages:['actionOrder','movementPayment']},
 engagement:{goal:'理解抵达交战地点后为何不能常规移动',when:'首次实际移动抵达交战战场后',why:'到达的战场已有对手；用原文交代交战限制，不以按钮消失代替说明',passages:['engagement']},
 sealMana:{goal:'用令咒补足技能行动的魔力',when:'首次费用准备',why:'按当前实际魔力与8点技能门槛决定逐枚支付次数；恢复面板承接真实效果',passages:['skillThreshold']},
 sealBattle:{goal:'用令咒强化战斗',when:'首次选择强化',why:'理解当前新增的战斗效果',passages:['sealBattle']},
 sealMove:{goal:'用令咒移动',when:'首次令咒移动',why:'地点与默认无视交战是当前新增差异；若已用急行教过费用，不重讲费用',passages:['sealMove','effectMovementCost','effectMovementEngagement']},
 actionAbility:{goal:'识别当前卡的行动能力',when:'首次新增行动能力',why:'急行原卡已说明方向和无视交战；只补原卡未写明的效果移动费用，不把同一限制再讲一遍',passages:['effectMovementCost']},
 endAction:{goal:'结束本席行动',when:'当前行动已完成',why:'通过正式电子入口把行动权交还下一席',passages:[]},
 battle:{goal:'参与战斗并等待其他席',when:'首次战斗阶段',why:'全员结束后才结算',passages:['battle']},
 settlement:{goal:'计算战力并取得战果',when:'首次战场结算',why:'实际比较战力时再说明胜者领取事件战果，不在移动教学预讲结算',passages:['settlement','battlefieldReward']},
 roundReturn:{goal:'看懂本轮攻击的去向',when:'首次实际回合清理之后',why:'技能返区、普通牌进入弃牌堆',passages:['roundEndTiming','roundReturn']},
 discard:{goal:'回看自己的弃牌',when:'实际清理后第一次查看',why:'在第一轮收牌后的实际弃牌处解释去向并检视，不拆成两张阅读卡',passages:['roundEndTiming','roundReturn','discardInspect']},
 postBattle:{goal:'决定是否恢复令咒',when:'当前事件战场获胜后',why:'当前事件明确允许胜者恢复',passages:['postBattleReward']},
 publicPower:{goal:'查看公开合计威力与攻击',when:'第一轮攻击已公开',why:'比较当前战场局面，只补头像悬停这一非显然输入；不复述系统已经显示的公开读数',passages:[]},
 revelation:{goal:'识别真名解放后的公开信息',when:'真实首次揭示',why:'从者及技能此后可以查看',passages:['revelation']},
 elimination:{goal:'识别淘汰',when:'真实第十天清理后',why:'区分存活席与淘汰席',passages:['elimination']},
 phaseOrder:{goal:'完成阶段并交还行动权',when:'首次阶段交接',why:'所有席位完成后才换阶段',passages:['order']},
 navigation:{goal:'检视当前地图规则',when:'首次地图交互',why:'电子版的拖动、缩放与检视不是纸面操作',passages:[]},
} satisfies Record<string,{goal:string;when:string;why:string;passages:readonly FatePassageId[]}>;
export type FateLessonId=keyof typeof FATE_TUTORIAL_LESSONS;
export function fateLessonCopy(lessonId:FateLessonId,input?:FateTutorialCopy['input']):FateTutorialCopy {
 return {lessonId,passages:[...FATE_TUTORIAL_LESSONS[lessonId].passages],...(input?{input}:{})};
}
