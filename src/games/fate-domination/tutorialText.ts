import { FATE_MASTERS, FATE_SERVANTS } from './data';
import type {FateLessonId} from './tutorialLessons';

const play = 'intake/rules/chm-进行一场圣杯战争.md';
const introduction = 'intake/rules/chm-前情提要与内容物介绍.md';
const excerpt = (source: string, section: string, quote: string) => ({ source, section, quote });
const paperExcerpt = (source:string,section:string,sourceQuote:string) => ({...excerpt(source,section,sourceQuote.replace(/\s*[（(][CDJK][）)]\s*/g,'')),sourceQuote,transcription:'omit-paper-figure-labels' as const});

/** 同语种只摘取当前所需原句；定位与操作说明保留在作者数据，不进入玩家正文。 */
export const FATE_TUTORIAL_PASSAGES = {
    duration: excerpt(introduction, '如何进行游戏', '圣杯战争将持续11天【回合】。'),
    victory: excerpt(introduction, '如何进行游戏', '在第 11 天【回合结束时】，拥有最多 VP 的玩家将获得圣杯并赢得游戏。'),
    order: excerpt(play, '游戏流程', '当所有玩家进行完了一个阶段后，进入下一阶段并重复上述过程。'),
    preparation: excerpt(play, '准备阶段', '按回合顺位，所有玩家从他们的牌堆中抽牌，将他们的手牌补充到上限（通常为3，此时已经有3张以上则不抽。）。'),
    deployment: paperExcerpt(play, '前哨阶段（白天）', '按回合顺位，玩家们将自己的御主立牌部署于魔术工房或战场（不可部署于侦查），若部署于魔术工房，该玩家立即获得部署处所标注的魔力值（C）。'),
    terrain: paperExcerpt(play, '前哨阶段（白天）', '若部署于战场且位于地利位置（D），战力结算时，若该玩家仍位于此位置，获得等同于该地利位置标注的地利数的合计威力（地利可以被其他能力影响而增加或减少）。'),
    outpostAbility: excerpt(play, '前哨阶段（白天）', '玩家可以于自己的前哨阶段的任意时候（包括部署前和部署后）使用自己的“前哨阶段”能力。'),
    actionOrder: excerpt(play, '行动阶段（夜晚）', '然后，按回合顺位，玩家们必须以如下顺序进行行动： 1.进行常规移动。2.进行常规出牌。'),
    actionAbility: excerpt(play, '行动阶段（夜晚）', '玩家可以于自己的行动阶段的任意时刻使用自己的“行动阶段”能力。'),
    activatedAbility: excerpt(play, '行动阶段（夜晚）', '印刷于攻击或技能牌上的“行动阶段”能力若不具有“被动/”，则需要将此牌激活才可使用。（激活：明置于你的攻击区）'),
    movement: excerpt(play, '常规移动', '你可以通过花费合计的移动成本（E），从一处地点移动至另一处。（移动是连续的）'),
    movementPayment: excerpt(play, '常规移动', '常规移动不可拆分，需一次决定起点与终点且一次性花费魔力。'),
    battlefieldReward: excerpt(play, '战力结算', '令胜利者（们）获得该战场事件牌的战果点数之和的战果'),
    attack: excerpt(play, '常规出牌', '打出正好两张攻击牌作为你本回合的常规出牌。'),
    mixedAttack: excerpt(play, '常规出牌', '它们可以是你手中的普通攻击牌（背面为深蓝色），或是你技能区的技能攻击（背面为红色且具有魔力消耗和威力）'),
    skillThreshold: excerpt(play, '常规出牌', '通常你必须在出牌前拥有8点及以上的魔力才可以从技能区打出攻击。'),
    attackFields: paperExcerpt(introduction,'攻击卡牌','攻击牌有魔力消耗 (J) 和基本威力 (K)。'),
    playTiming: excerpt(introduction,'能力卡牌','“打出时：”-可以理解为在您打出此牌时必须遵循的“被动：”能力。'),
    dark: excerpt(play, '常规出牌', '若你不位于战场，你可以打出两张暗置牌，暗置牌处于未被激活的状态，它们不消耗魔力，不计算威力，也不属于攻击且于回合结束时进入你的弃牌堆。通常而言，技能牌不能被暗置打出。'),
    battlefieldFaceUp: excerpt(play, '常规出牌', '若你位于战场，则你的常规出牌中必须要有一张明置牌。'),
    darkTraits: excerpt(play, '常规出牌', '暗置牌处于未被激活的状态，它们不消耗魔力，不计算威力，也不属于攻击且于回合结束时进入你的弃牌堆。通常而言，技能牌不能被暗置打出。'),
    power: excerpt(play, '常规出牌', '然后，计算你当前的合计威力并向其他玩家展示。'),
    additional: excerpt(play, '效果打出牌', '部分卡牌文字允许你打出额外的攻击，这些卡牌均不属于常规出牌。'),
    hidden: excerpt(play, '召唤从者', '因为圣杯战争是秘密进行的，从者的情报隐藏也是重要的一环，所以尽量不要在游戏前和开始时向其他玩家透露任何有关于你从者的信息。'),
    revelation: excerpt(play, '真名解放', '有些卡牌会拥有【真名解放】词条，当你使用这些卡牌后，立即展示你的从者概览卡与所有技能牌并处于【真名解放】状态。'),
    battle: excerpt(play, '战斗阶段（夜晚）', '然后，在所有玩家的战斗阶段结束后开始进行战力结算。'),
    settlement: excerpt(play, '战力结算', '一名玩家激活的攻击威力+地利数+受到自己能力的影响以及局势牌和天气牌的影响。'),
    roundEndTiming: excerpt(play,'回合结束时','回合结束时'),
    roundReturn: excerpt(play,'回合结束时','令技能牌明置返回其技能区并令非技能牌暗置进入其弃牌堆'),
    discardInspect: excerpt(play,'回合结束时','你可以于任何时候查看自己的弃牌堆。'),
    postBattleReward: excerpt('intake/catalog/events-fuyuki-ocr.md','E12 / 遏制第三方威胁','此战场的胜者可以恢复1枚令咒。'),
    afterBattle: excerpt(play, '回合结束时', '结算“战斗阶段后/战斗结束后/战斗后等类似描述”效果，“若你获胜/战败”亦于此时点结算。'),
    sealBattle: excerpt(introduction,'令咒','获得2 点合计威力以及获胜后获得 2 点战果点数'),
    sealMana: excerpt(introduction,'令咒','4 点法力值'),
    sealMove: excerpt(introduction,'令咒','在深山町或新都进行移动'),
    elimination: excerpt(introduction, '如何进行游戏', '在第 10 天【回合结束时】，除了 VP 的前 2 名的玩家外，所有玩家都被淘汰出局。'),
    masterDraw: excerpt('data/demo-data.ts#m_waver/s2', '战略部署', FATE_MASTERS.find(master => master.id === 'm_waver')!.skills!.find(skill => skill.name === '战略部署')!.desc!),
    riding: excerpt('data/demo-data.ts#sc_iskandar_1', '骑乘', FATE_SERVANTS.find(servant => servant.trueName === '伊斯坎达尔')!.skillCards!.find(skill => skill.id === 'sc_iskandar_1')!.desc!),
};

export type FatePassageId = keyof typeof FATE_TUTORIAL_PASSAGES;
export interface FateTutorialCopy {
    lessonId?: FateLessonId;
    passages: FatePassageId[];
    /** 仅限来源未描述的电子版输入；不得填入界面布局、验收或设计说明。 */
    input?: { text: string; owner: string };
    /** 当前实际能力卡的身份；正文直接取正式卡文，不能套用其他角色能力。 */
    ability?: { masterId?: string; servantId?: string; skillId: string; clause?: 'action' };
    /** 观察他席新后果时标明归属，避免卡文的“你”被误认为当前学员。 */
    observer?: { playerId: string; abilityName?: string };
}

export function fateTutorialText(copy: FateTutorialCopy): string {
    const source = copy.ability;
    const owner = source?.masterId ? FATE_MASTERS.find(master=>master.id===source.masterId) : FATE_SERVANTS.find(servant=>servant.id===source?.servantId);
    const skills = owner && ('skills' in owner ? owner.skills : 'skillCards' in owner ? owner.skillCards : undefined);
    const description = source ? skills?.find(skill=>skill.id===source.skillId)?.desc : undefined;
    const ability = source?.clause==='action' ? description?.split('\n').filter(line=>line.includes('行动阶段：')).join('\n') : description;
    return [...(copy.observer?[`玩家 ${Number(copy.observer.playerId)+1}${copy.observer.abilityName?' · '+copy.observer.abilityName:''}`]:[]),...copy.passages.map(id => FATE_TUTORIAL_PASSAGES[id].quote), ...(ability ? [ability] : []), ...(copy.input ? [copy.input.text] : [])].join('\n\n');
}
