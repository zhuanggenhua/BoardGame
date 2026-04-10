/**
 * 婵犮垹鐖㈤崟顒傜シ闂佹悶鍎茬粙鎺楀蓟?- 闂佸綊鏅查懗鍫曟偨婵犳艾鏋侀柛顐ゅ枔娴滎垶鏌熼崙銈夋闁糕晛鎳庨々濂稿幢濡棿妗?
 *
 * 婵炴垶鎸搁ˇ閬嶏綖閹烘绠柨鏃囨閻掑鏌涢敐鍐ㄥ閻炴凹鍋婂畷鍦偓锝呭缁?
 * 1. protection - 婵烇絽娲︾换鍐╂叏閵忋倖鈷曢煫鍥ф捣閻倕鈽夐幘宕囆㈢憸鏉跨墦閹囨偡閹殿喗姣庨悷婊勬緲瀹曨剟骞栭悜鑺ユ櫖闁割偅绻嶅ú銈呪槈閹惧磭孝鐟滄媽灏欓幃顕€顢曢敐鍥嗐儵鏌ｈ箛锝呭箲闁逞屽厸濡炴帞绮径鎰煑婵°倐鍋撴い鏇ㄥ櫍楠炲秶鈧綆鍙庨弨浠嬫煕閺傝濡煎┑鍌涚墵瀹曨偄顓艰箛鏇狀槴
 * 2. restriction - 闂傚倸瀚崝鏇㈠春濡ゅ懎绠肩€广儱瀚粙濠囨煥濞戞澧曟い鈹懐鐭夊ù锝堫嚃閸撻箖鏌熼崹顐ｅ碍闁搞値鍙冨鎹愮疀鎼达絿鐓犻梺鍛婂笧婢ф鎮￠崶顒€鏄ラ柛婵嗗閸曢箖鏌曢崱鏇″厡妞も晪绠戦～銏ゅ閳ユ枼鍙洪柣鐐寸☉閼活垱鎱ㄩ埡鍛闁宠棄鎳愮粈?
 * 3. trigger - 婵炲瓨绮岄鍕枎閵忋垺鍠嗛柨鏇楀亾鐟滄澘鍊垮畷鍫曟倷閸撲焦顔嶉梺鎸庣☉閻楀棝銆呰濮婃崘绠涙惔锝囩厾闂佺绻堥崕鍗炩攦閳ь剟鏌￠崘顓炵厫缂佸鍏橀幃姗€顢樺┃鎯т壕濞达絽鎲＄粈鈧梺鍛婅壘閻楀繒鍒掗妸鈺佺骇闁绘柨鎲￠ˇ褔鏌熼崜浣规珪濠⒀勭箞閺?
 *
 * 闂佺懓鍤栭梽鍕春閸涙潙闂柕濠忕畱閻?defId 濠电偛顦崝宀勫船娴犲鏅€光偓閸愵亞顓奸柣鐐寸☉閺堫剙顪冮崒鐐插唨閻熸瑥瀚粊锕傛煕閿曚焦銆冪紒?ongoing 闁荤偞绋戦懟顖涙叏閳哄懎纭€闁炽儴娅曠€氭煡姊婚崨顓犵缂侇喚濞€閹虫鎸婃径濠庢綕闂佸搫琚崕鎾敋濡ゅ懎违?
 * 缂備胶铏庨崹浼村吹闁秴鏋侀柟宄扮焾閸熷酣鎮规担鍙夘潐缂佸彉鍗冲濠氬Ψ椤垵娈戦梺鍝勫暞濠€鍦閸洖绀傞柕澶堝劤缁夊ジ鏌涢幘宕囆ゅ┑顔芥倐楠炩偓濞撴艾锕︾粈澶娾槈閹惧磭校閻庡灚妫冨鍨緞婵犲倽顔夐梺鍛婄懄椤洦鎱ㄩ幖浣哥畱濞达絿顣介崑?
 */

import type { PlayerId, RandomFn, MatchState } from '../../../engine/types';
import type {
    ActiveDuel,
    DuelOutcomeKind,
    SmashUpCore,
    SmashUpEvent,
    MinionOnBase,
    TriggerInstance,
    TriggerQueuedEvent,
    PlayerTurnRestrictionType,
} from './types';
import { SU_EVENTS } from './types';
import { registerTriggerExecutor } from './triggerExecutors';
import { getBaseDef, getTitanDef } from '../data/cards';
import { matchesDefId, mustUseBaseLimitedMinionQuota } from './utils';

// ============================================================================
// 缂備緡鍋夐褔鎮楁搴樺亾鐟欏嫮鐓紒?
// ============================================================================

/** 婵烇絽娲︾换鍐╂叏閵忋垻灏甸悹鍥皺閳?*/
export type ProtectionType =
    | 'destroy'       // 婵炴垶鎸哥粔纾嬨亹閼碱剚鍋栨い鎰剁悼鍟搁梺?
    | 'move'          // 婵炴垶鎸哥粔纾嬨亹閼碱剚鍋栨い鎰╀紗閳哄懎绀?
    | 'affect'        // 婵炴垶鎸哥粔纾嬨亹閸懇鍋撴担鍐炬綈濠⒀勭矒瀹曪繝鏁嶉崟顐澓閻熸粍婢樺畷顒勫箹閻戣姤鏅柛顐ｇ箘閻ｎ厼鈽夐弬娆炬Х缂佺粯宀搁獮搴ㄥΧ韫囨洜顦?
    | 'action';       // 婵炴垶鎸哥粔纾嬨亹閸懇鍋撴担鍐炬綈濠⒀勭矌閹壆浠﹂挊澹鏌涘鐑╁亾閸愬樊娈梺?

/** 闂佺硶鏅涢幖顐耿閹绢喗鍤勯柦妯侯槸椤棃鏌涘Ο渚剰闁糕晜顨呰灋闁逞屽墴瀵濡烽妷銉︾槪闂佽桨绀佹惔婊呮閻楀牊浜ら柡鍌涘缁€鈧?true 闁荤偞绋忛崝搴ㄥΦ濮樿鲸瀚氶柕澶堝劤閸炪劑鏌涢敂钘夘€滈柛蹇旓耿瀹曟繂鈽夊搴㈣晧闂佸憡锚椤戝懘宕?*/
export type BaseAbilitySuppressionChecker = (state: SmashUpCore, baseIndex: number) => boolean;

/** 婵烇絽娲︾换鍐╂叏閵忕姈娑㈠焵椤掑嫬钃熼柕澶堝€楅悷鎰槈閹炬剚鍎愰柡?*/
export interface ProtectionCheckContext {
    state: SmashUpCore;
    /** 闁荤偞鍑归崑鍌滄崲濮樿泛绠柕鍫濇处閻ｉ亶姊婚崨顓犵缂?*/
    targetMinion: MinionOnBase;
    /** 闂傚倸鎳庣换瀣垝閻樿绠ラ柍褜鍓熷畷鐑藉Ω閵壯冩暏闂侀潻闄勬竟鍡涘磼閵娿儺鍤?*/
    targetBaseIndex: number;
    /** 闂佸憡鐟﹂崹濂稿箲閿濆牄浜归柛妤冨仦閹瑩鏌ｉ妸銉ヮ伀閻㈩垵娅ｉ埀顒傤攰椤旀劗妲愬▎鎾崇哗閻犲洦褰冨В濠囨煠閺夋寧瀚呯紒?*/
    sourcePlayerId: PlayerId;
    /** 婵烇絽娲︾换鍐╂叏閵忋垻灏甸悹鍥皺閳?*/
    protectionType: ProtectionType;
}

/** 婵烇絽娲︾换鍐╂叏閵忕姈娑㈠焵椤掑嫬钃熼柕澶堝劚濮ｆ劙鏌℃担绋跨盎缂佽京澧楀濠氬棘閹稿海顦?true 闁荤偞绋忛崝搴ㄥΦ濮樿鲸瀚氶柕澶嗘櫆椤撶懓霉閻樻煡顎楃憸鏉跨墛缁屽崬鈹戦崶顬?*/
export type ProtectionChecker = (ctx: ProtectionCheckContext) => boolean;

/** 闂傚倸瀚崝鏇㈠春濡ゅ啰灏甸悹鍥皺閳?*/
export type RestrictionType =
    | 'play_minion'   // 缂備礁鍊烽悞锕傤敆濞戙垹绠ラ柟鎯у暱濮ｅ姊婚崨顓犵缂侇喚濞€瀹曟岸鎮ч崼銏犲福闂佺硶鏅涢幖顐耿?
    | 'play_action';  // 缂備礁鍊烽悞锕傤敆濞戙垹绠ラ柟鎯у暱濮ｅ鎮跺☉妯垮濠殿喒鏅犲畷锟犲灳閸愯尙鍘掗梺鍝勬湰閸旀洟鎮㈤埀顒勬煕?

/** 闂傚倸瀚崝鏇㈠春濡も偓铻為柍褜鍓熷濠氬Ψ閵堝洨鎲繛鎴炴尭椤戝棝寮?*/
export interface RestrictionCheckContext {
    state: SmashUpCore;
    /** 闁荤偞鍑归崑濠傤瀶濞差亜绀嗛柛鎾茬劍閻ｉ亶鏌涢埡浣规儓婵犫偓鐎靛憡顫曢柕蹇曞Х缁?*/
    baseIndex: number;
    /** 闁诲繐绻戠换鍡涙儊椤栫偛绠肩€广儱瀚粙濠囨煟閵娿儱顏悽顖濇閳?*/
    playerId: PlayerId;
    /** 闂傚倸瀚崝鏇㈠春濡ゅ啰灏甸悹鍥皺閳?*/
    restrictionType: RestrictionType;
    /** 婵☆偆澧楃换鍌炈囨繝姘瀬闁绘鐗嗙粊锕傛煥濞戞澧曟い鈹洤纭€闁挎稑瀚·?defId闂侀潧妫旈悞锕€菐瀹曞洤瀵查柤濮愬€楅幖濂告煥?*/
    extra?: Record<string, unknown>;
}

/** 闂傚倸瀚崝鏇㈠春濡も偓铻為柍褜鍓熷濠氬Ψ閵夈儲鐦ｉ梺杞扮鎼存粎妲愰悧鍫熶氦闁哄倹瀵х粈鈧?true 闁荤偞绋忛崝搴ㄥΦ濮樿泛绠肩€广儱瀚粙濠囨偠濮樼厧浜版俊鐐そ瀹?*/
export type RestrictionChecker = (ctx: RestrictionCheckContext) => boolean;

/**
 * 婵炲瓨绮岄鍕枎閵忋倕绠柨鏃囨閻掑鏌涢敐搴ｅ帨缂佸彉鍗冲瀛樺緞缁嬫寧鏆曢梺杞扮閻楀﹪鎮樻径鎰櫖闁革富婀痯lacement Effects闂?
 *
 * 闁哄鏅滈弻銊ッ洪弽顓炵９闁煎綊鍋婇崵鏂库槈閺傛妲风紒妤€鑻锝夊即閻斿憡鍎?interceptEvent 婵炴垶鎸撮崑鎾绘煠閻ゎ垱褰х紒?
 * - undefined 闂?婵炴垶鎸哥粔鐢碘偓姘ュ€濋獮瀣敂鎼达絿顦╃紓鍌欑秬閸涱垱鏆板┑鈽嗗亐閸嬫捇鏌＄仦璇插姍缂佹鎳忕粙澶愬焵椤掍胶鈻旀い蹇撴噹椤忥繝鏌熼幖顓濈盎婵炲懏甯￠弫?
 * - SmashUpEvent / SmashUpEvent[] 闂?闂佸搫娲︾€笛冪暦?
 * - null 闂?闂佸憡姘ㄩ崑娑樷枍?
 */
export type EventInterceptor = (
    state: SmashUpCore,
    event: SmashUpEvent
) => SmashUpEvent | SmashUpEvent[] | null | undefined;

/** 闁荤喐鐟辩粻鎴ｃ亹閸岀偛绫嶉柤绋跨仛缁?*/
export type TriggerTiming =
    | 'onDuelStarted'
    | 'onDuelResolved'
    | 'onMinionPlayed'     // 闂傚倸鎳庣换瀣垝閻樿绀傞柕澶堝劜缁ㄦ岸鏌?
    | 'onActionPlayed'     // 闁荤偞绋戦懟顖涙叏閳哄懎纭€闁斥晛鍟埅鐢告煕閹寸姴鍔嬫俊鐐插€块弫宥夊醇閵忊剝娈㈡繛瀛樼矊妤犳悂鎮㈤埀顒勬煕閿旇棄顎滈柛蹇旓耿瀹曟繂鈽夐姀鈱掓洟鏌涢幒鎿冩當閻庡灚鐓￠弫?
    | 'onCardsDiscarded'   // 闂佸綊娼ч鍥ㄦ櫠濠靛棭鍤曢柛鎰典簽閺嬪倿鏌?
    | 'onCardBuried'       // 闂佸憡顨愮槐鏇熸櫠濠靛牊鍋栨い鎰╁灮閸樻垿鏌︽笟鍥у婵?
    | 'onBuriedCardUncovered' // 闂佺硶鏅涢鍫ュ箠瀹ュ鍋嬬€光偓閸愮偓钑夌紓鍌氱墣椤曆呮閹达箑绫?
    | 'onBaseRevealed'     // 闂佺硶鏅涢幖顐耿鐎靛摜绀勯悹鍥ㄥ絻濮?闂佸搫娲︾€笛冪暦閺屻儱瑙﹂幖绮光偓鍐叉辈闂侀潻濡囩亸銊ф濞嗘挸绠ラ柍杞拌兌濞兼棃鏌涢埡浣规儓婵犫偓鐎靛憡鍠嗛柨鏇楀亾鐟滄澘鍊块弫?
    | 'onMinionDestroyed'  // 闂傚倸鎳庣换瀣垝閻樺灚鍋栨い鎰剁悼鍟搁梺璇叉禋閸樿棄顪?
    | 'onMinionMoved'      // 闂傚倸鎳庣换瀣垝閻樺灚鍋栨い鎰╀紗閳哄懎绀夐柕濠忛檮椤?
    | 'onCardReturnedToHand' // 闂佸憡顨愮槐鏇熸櫠濠靛洨顩烽幖绮瑰墲缁ㄦ艾鈽夐幘绛规敾闁搞劊鍔岄锝夊礃椤忓嫷鏉洪梺鍓插亜濡粎鎹㈠鈧畷妤呭Ψ閿曗偓椤や線鏌ｅΔ鈧張顒€顪?
    | 'onDeckInspected'    // 闂佺粯顨呴懟顖滆姳鏉堚晜鍋栨い鎰剁悼閸欌偓闂?/ 闁诲繒鍋炲ú婊堝Φ?/ 濠碘槅鍋€閸嬫挾绱掓笟鍨仾婵?
    | 'onMinionAffected'   // 闂傚倸鎳庣换瀣垝閻樺灚鍋栨い鎰╁焺閸ょ娀鏌熼棃娑卞剱闁哄懌鍎靛绋款煥閸愵煈娈梺鍛婄箓缁夐潧顪冮崒鐐存櫖闁割偓绲肩划鐢告煕濮橆剛澧涙俊鐐插€垮鐢告偖鐎靛摜鐛ュ┑鐐村灥閻楀繑瀵?缂備礁顦抽褎鎱?闂佸憡姊归惄顖炲闯閻戞鈹嶆い鏃囧Г閺?闂傚倸瀚€氼喖顭?闂佺鐭囬崘銊у幀闂佸搫顦崯顐ャ亹婢舵劕鍗抽弶鍫濆⒔缁€?
    | 'onMinionDiscardedFromBase' // 闂佺硶鏅涢幖顐耿鐎靛摜纾奸柟鎯у閺嗩剟鏌￠崘銊у煟婵炲牄鍨虹粋鎺撴償閵堝孩钑夐悗娈垮枛閸熶即鎮块崱娑欐櫖闁割偁鍎叉慨婊勭箾閹存繄澧㈠ù鐓庡暣閺?
    | 'onTurnEnd'          // 闂佹悶鍎抽崑娑㈠箖鎼达絿纾奸柟鎯х摠鐏忓棝鏌?
    | 'onTurnStart'        // 闂佹悶鍎抽崑娑㈠箖鎼粹槅鍤曢柍褜鍓氶幈銊р偓锝庡亝椤?
    | 'beforeScoring'      // 闂佺硶鏅涢幖顐耿鐎靛憡濯奸柍銉ュ暱閻庡鏌?
    | 'afterScoring';      // 闂佺硶鏅涢幖顐耿鐎靛憡濯奸柍銉ュ暱閻庡鏌?

/** 閻熸粍婢樺畷顒勫箹妞嬪海灏甸悹鍥皺閳ь剛鍏橀弫宥夊醇濠婂懐鐓?onMinionAffected 闂佸搫鍟抽崺鏍э耿娓氣偓瀹曟劗娑垫搴ｎ槴 */
export type TitanAwareTriggerTiming = TriggerTiming | 'onTitanMoved';

export type AffectType =
    | 'destroy'
    | 'move'
    | 'return'
    | 'power_change'
    | 'attach_action'
    | 'control_change'
    | 'cancel_ability'
    | 'shuffle_into_deck';

/** 闁荤喐鐟辩粻鎴ｃ亹閸屾稓鈻斿┑鐘辫兌閻熸捇鏌?*/
export interface TriggerContext {
    state: SmashUpCore;
    /** 完整的 match 状态，用于触发器创建交互 */
    matchState?: MatchState<SmashUpCore>;
    timing: TitanAwareTriggerTiming;
    /** 具体触发来源实例 uid */
    sourceCardUid?: string;
    /** 触发来源所在基地 */
    sourceBaseIndex?: number;
    /** 触发来源控制者 */
    sourceControllerId?: PlayerId;
    /** 事件关联玩家 */
    playerId: PlayerId;
    /** 事件关联基地 */
    baseIndex?: number;
    /** 决斗上下文（onDuelStarted / onDuelResolved） */
    duel?: ActiveDuel;
    duelSourceId?: string;
    duelOutcome?: DuelOutcomeKind;
    duelChallenger?: MinionOnBase;
    duelChallenged?: MinionOnBase;
    duelWinner?: MinionOnBase;
    duelLoser?: MinionOnBase;
    duelTie?: boolean;
    /** onMinionMoved 时：移动前基地 */
    moveFromBaseIndex?: number;
    /** onMinionMoved 时：移动后基地 */
    moveToBaseIndex?: number;
    /** 触发相关随从 */
    triggerMinion?: MinionOnBase;
    /** 触发相关随从 UID */
    triggerMinionUid?: string;
    /** 触发相关随从 defId */
    triggerMinionDefId?: string;
    /** 消灭者（仅 onMinionDestroyed） */
    destroyerId?: PlayerId;
    /** 事件原因 */
    reason?: string;
    /** 影响类型（仅 onMinionAffected） */
    affectType?: AffectType;
    /** 基地计分排名（仅 afterScoring） */
    rankings?: { playerId: PlayerId; power: number; vp: number }[];
    /** 埋葬/翻开相关卡牌 UID */
    buriedCardUid?: string;
    /** 埋葬/翻开相关卡牌 defId */
    buriedCardDefId?: string;
    /** 埋葬/翻开相关卡牌控制者 */
    buriedCardControllerId?: PlayerId;
    /** 埋葬来源 */
    buriedFrom?: 'hand' | 'discard' | 'play' | 'deck';
    /** onActionPlayed 时：行动牌目标基地 */
    actionTargetBaseIndex?: number;
    /** onActionPlayed 时：行动牌目标类型 */
    actionTargetType?: 'base' | 'minion';
    /** onActionPlayed 时：行动牌目标随从 */
    actionTargetMinionUid?: string;
    /** REVEAL_HAND / REVEAL_DECK_TOP / onDeckInspected 时：暴露卡牌 */
    inspectionCards?: Array<{ uid: string; defId: string }>;
    /** REVEAL_HAND / REVEAL_DECK_TOP / onDeckInspected 时：暴露区域 */
    inspectionZone?: 'deck' | 'hand';
    /** REVEAL_HAND / REVEAL_DECK_TOP / onDeckInspected 时：被查看玩家 */
    inspectionTargetPlayerIds?: PlayerId[];
    /** REVEAL_HAND / REVEAL_DECK_TOP / onDeckInspected 时：实际查看者 */
    inspectionCausePlayerId?: PlayerId;
    random: RandomFn;
    now: number;
}

/** 闁荤喐鐟辩粻鎴ｃ亹閸岀偛鐐婇柣鎰濞堝爼鏌涢幋锝呅撻柡鍡欏枑濞煎寮幐搴ｎ槬闂?*/
export interface TriggerResult {
    events: SmashUpEvent[];
    /** 婵犵鈧啿鈧綊鎮樻径灞惧枂闁挎洍鍋撶憸鏉垮€垮畷鎶藉Ω閳哄倷绮柣鐔告磻缁€渚€宕归崡鐑嗗殘閺夌偟澧楅崬澶娒瑰鍕嚋缂佽鲸鐟︽穱濠囧磼濠婂啳绀嬮柣搴ｆ嚀閻栧ジ鍩€椤掆偓椤︽壆鈧哎鍔戦弫宥嗗緞濞戞氨顦柡澶嗘櫆閺屻劌煤閺嶎厼鍗抽悗娑櫳戦悡鈧梺鍛婅壘濞村嘲鈻?matchState */
    matchState?: MatchState<SmashUpCore>;
}

/** 闁荤喐鐟辩粻鎴ｃ亹閸岀偛鐐婇柣鎰濞堝爼鏌涢幋锝呅撻柡鍡欏枛閺佸秴顫濆畷鍥╊唹闂佹悶鍎抽崑妯活殽閸ヮ剚鍋ㄩ柣鏃傚劋閻ｅ崬霉濠婂喚鍎庢繛鍡愬灲閺佸秹宕煎┑鍥ь伅闂佸憡鐟崹鍫曞焵椤掆偓椤﹀崬鈻?matchState闂?*/
export type TriggerCallback = (ctx: TriggerContext) => SmashUpEvent[] | TriggerResult;

// ============================================================================
// 闂佺懓鍤栭梽鍕春閸涙潙闂柕濠忛檮閺嗗牓鏌涢幇顒佹拱婵炵⒈鍨堕幆?
// ============================================================================

interface ProtectionEntry {
    /** 闂佸湱绮崝鎺旀閸偆鈹嶆繝闈涙搐琚橀梺?ongoing 闂佸憡顨愮槐鏇熸櫠濠靛绠ｉ柡宥庡幗椤撶懓霉?defId */
    sourceDefId: string;
    protectionType: ProtectionType;
    checker: ProtectionChecker;
    /** 濠电偞鍨甸悧鎰板焵椤掍緡娈旈柣搴ㄦ敱缁屽崬鈹戦崶顬垿鏌ㄥ☉娆庝孩鐞氭繈鏌涘▎鎰仴闁诡喗顨婂Λ渚€鍩€椤掑倹鍟哄ù锝呮贡鍟搁梺璇叉禋閸樿棄顭囬棃娑掓敠闁归偊鍓欓獮銏ゆ煟濡も偓閻妲愬▎鎰箚?trickster_hideout闂?*/
    consumable?: boolean;
}

interface RestrictionEntry {
    sourceDefId: string;
    restrictionType: RestrictionType;
    checker: RestrictionChecker;
}

interface TriggerEntry {
    sourceDefId: string;
    timing: TitanAwareTriggerTiming;
    callback: TriggerCallback;
    optional?: boolean;
    phase?: 'replacement' | 'reaction';
    playerContext?: 'eventPlayer' | 'sourceController';
    baseScoped?: boolean;
    /** true 闂佸搫鍟抽崺鏍偓鍨矒瀹曢攱娼幍顔炬啰濠殿噯绲界换瀣煂濠婂牆绾ч柕澶涘閻栭亶鎮楅崷顓炰粧缂佽翰鍎靛畷锟犲即閻樺樊浠鹃梺绋跨箞閸庨潧危?闂佸湱鐟抽崱鈺傛杸闂佹寧绋戦惌渚€鍩€椤掆偓婵傛梻绮径鎰強妞ゆ牗绋戦惁?defId 闂佽壈椴搁懝楣冨箖鎼淬垻鈻旈柍褜鍓欓埢?*/
    perInstance?: boolean;
    /** true 闂佸搫鍟崕濂搞€呴敃鈧晥闁稿本绋掗梽宥嗙節瑜庨崝鏇犳崲閳ь剙顪冮妶鍫敽缂傚秴鎳忕粋宥嗘償閿涘嫮歇闂佸憡鎸哥粔鐤杺闂佸憡鐟﹂崹鐢割敋椤旇姤鍎熼柡鍐ㄥ€归悾閬嶆煕閳轰焦鎯堟繝鈧幘顔芥櫖闁割偅绮庢导鎰攽閳ュ啿鈧粙顢橀幖浣哥闁糕剝顨堥崬銊╂煕閿曞偆鏆掔紒妤€鍊块幆鍐礋椤栨侗鍚傛繛瀵稿Т閸戠晫妲?*/
    sourceScope?: 'any' | 'triggerBase';
    /**
     * Global triggers bypass the "source must be in play" witness check.
     * Use for Special cards that can be played from hand/discard when a condition happens.
     */
    global?: boolean;
    /** global 闁荤喐鐟辩粻鎴ｃ亹閸岀偛闂柕濞垮劚鐢帡鎮规担鍦憙妞ゎ偄妫涢幏鐘虫媴閻戞鏆犻梺鍝勵槶閸庤尙鑺遍鈧畷鐘诲传閸曨厼骞嶉梺鎸庣⊕閻╊垳鍒掗婊勫?hand + discard */
    globalZones?: Array<'hand' | 'discard' | 'deck'>;
}

interface TriggerSourceLocation {
    uid?: string;
    baseIndex?: number;
    controllerId?: PlayerId;
    titanUid?: string;
}

interface InterceptorEntry {
    sourceDefId: string;
    interceptor: EventInterceptor;
}

// ============================================================================
// 濠电偛顦崝宀勫船閻ｅ本鍋?
// ============================================================================

const protectionRegistry: ProtectionEntry[] = [];
const restrictionRegistry: RestrictionEntry[] = [];
const triggerRegistry: TriggerEntry[] = [];
const interceptorRegistry: InterceptorEntry[] = [];
const baseAbilitySuppressionRegistry: { sourceDefId: string; checker: BaseAbilitySuppressionChecker }[] = [];

/** 濠电偛顦崝宀勫船閼恒儳鈹嶆繝闈涙搐琚橀梺鐟板殩闂勫嫰宕洪崨鏉戦棷?*/
export function registerProtection(
    sourceDefId: string,
    protectionType: ProtectionType,
    checker: ProtectionChecker,
    options?: { consumable?: boolean }
): void {
    // 闂佸憡锚椤兘宕抽崨濠勨攳婵犻潧娲よ闂佹寧绋掗懝楣冨箖閹惧鈻旈柍?sourceDefId + protectionType 闂佸憡鐟禍婵嬪极閻愬搫绀冮悘鐐跺亹椤忚鲸绻涢崱蹇旑潐缂佽鲸鐟╁濂稿矗婢舵ê澹?HMR 闂備焦褰冪粔鎾囬幓鎺嗘灃闁靛鍎遍弬鈧梺?
    if (protectionRegistry.some(e => e.sourceDefId === sourceDefId && e.protectionType === protectionType)) return;
    protectionRegistry.push({ sourceDefId, protectionType, checker, consumable: options?.consumable });
}

/** 濠电偛顦崝宀勫船娴犲鈷旈柟閭﹀墮閻撴垿鏌熼崙銈夋闁糕晛鎳樺畷?*/
export function registerRestriction(
    sourceDefId: string,
    restrictionType: RestrictionType,
    checker: RestrictionChecker
): void {
    // 闂佸憡锚椤兘宕抽崨濠勨攳婵犻潧娲よ闂佹寧绋掗懝楣冨箖閹惧鈻旈柍?sourceDefId + restrictionType 闂佸憡鐟禍婵嬪极閻愬搫绀冮悘鐐跺亹椤忚鲸绻涢崱蹇旑潐缂佽鲸鐟╁濂稿矗婢舵ê澹?HMR 闂備焦褰冪粔鎾囬幓鎺嗘灃闁靛鍎遍弬鈧梺?
    if (restrictionRegistry.some(e => e.sourceDefId === sourceDefId && e.restrictionType === restrictionType)) return;
    restrictionRegistry.push({ sourceDefId, restrictionType, checker });
}

/** 濠电偛顦崝宀勫船閻ｅ本鍠嗛柨鏇楀亾鐟滄澘鍊块獮蹇涙晜閽樺鍔甸梺?*/
export function registerTrigger(
    sourceDefId: string,
    timing: TitanAwareTriggerTiming,
    callback: TriggerCallback,
    options?: {
        optional?: boolean;
        phase?: 'replacement' | 'reaction';
        global?: boolean;
        globalZones?: Array<'hand' | 'discard' | 'deck'>;
        playerContext?: 'eventPlayer' | 'sourceController';
        baseScoped?: boolean;
        perInstance?: boolean;
        sourceScope?: 'any' | 'triggerBase';
    }
): void {
    // 闂佸憡锚椤兘宕抽崨濠勨攳婵犻潧娲よ闂佹寧绋掗懝楣冨箖閹惧鈻旈柍?sourceDefId + timing 闂佸憡鐟禍婵嬪极閻愬搫绀冮悘鐐跺亹椤忚鲸绻涢崱蹇旑潐缂佽鲸鐟╁濂稿矗婢舵ê澹?HMR 闂備焦褰冪粔鎾囬幓鎺嗘灃闁靛鍎遍弬鈧梺?
    if (triggerRegistry.some(e => e.sourceDefId === sourceDefId && e.timing === timing)) return;
    triggerRegistry.push({
        sourceDefId,
        timing,
        callback,
        optional: options?.optional,
        phase: options?.phase ?? 'reaction',
        perInstance: options?.perInstance,
        sourceScope: options?.sourceScope ?? 'any',
        global: options?.global,
        globalZones: options?.globalZones,
        playerContext: options?.playerContext ?? 'eventPlayer',
        baseScoped: options?.baseScoped ?? true,
    });
    registerTriggerExecutor(sourceDefId, timing, callback);
}

function locateSources(state: SmashUpCore, sourceDefId: string): TriggerSourceLocation[] {
    const locations: TriggerSourceLocation[] = [];
    for (let i = 0; i < state.bases.length; i++) {
        const base = state.bases[i];
        if (base.defId === sourceDefId) locations.push({ baseIndex: i });
        for (const ongoing of base.ongoingActions.filter(o => o.defId === sourceDefId)) {
            locations.push({ uid: ongoing.uid, baseIndex: i, controllerId: ongoing.ownerId });
        }
        for (const minion of base.minions.filter(m => m.defId === sourceDefId)) {
            locations.push({ uid: minion.uid, baseIndex: i, controllerId: minion.controller });
        }
        for (const m of base.minions) {
            for (const attached of m.attachedActions?.filter(a => a.defId === sourceDefId) ?? []) {
                locations.push({ uid: attached.uid, baseIndex: i, controllerId: attached.ownerId });
            }
        }
    }
    for (const titan of state.titans ?? []) {
        if (titan.defId !== sourceDefId || titan.location.zone !== 'base') continue;
        locations.push({
            uid: titan.uid,
            titanUid: titan.uid,
            baseIndex: titan.location.baseIndex,
            controllerId: titan.controllerId,
        });
    }
    for (const special of state.pendingAfterScoringSpecials ?? []) {
        if (special.sourceDefId !== sourceDefId) continue;
        locations.push({
            uid: special.cardUid,
            baseIndex: special.baseIndex,
            controllerId: special.playerId,
        });
    }
    return locations;
}

function locateSource(state: SmashUpCore, sourceDefId: string): TriggerSourceLocation {
    return locateSources(state, sourceDefId)[0] ?? {};
}

function isTriggerSourceEligible(
    entry: TriggerEntry,
    timing: TitanAwareTriggerTiming,
    located: TriggerSourceLocation,
    triggerBaseIndex: number | undefined,
): boolean {
    if (triggerBaseIndex === undefined) return true;
    if (
        entry.baseScoped !== false
        && (timing === 'onMinionMoved' || timing === 'onMinionAffected' || timing === 'onTitanMoved')
        && located.baseIndex !== triggerBaseIndex
    ) {
        return false;
    }
    if (entry.sourceScope === 'triggerBase' && located.baseIndex !== triggerBaseIndex) {
        return false;
    }
    return true;
}

function buildTriggerId(
    entry: TriggerEntry,
    timing: TitanAwareTriggerTiming,
    now: number,
    order: number,
    located: TriggerSourceLocation,
): string {
    if (entry.perInstance) {
        return `${timing}:${entry.sourceDefId}:${now}:${order}`;
    }
    return `${timing}:${entry.sourceDefId}:${now}:${order}`;
}

function createTriggerInstance(
    entry: TriggerEntry,
    timing: TitanAwareTriggerTiming,
    now: number,
    order: number,
    pid: PlayerId,
    located: TriggerSourceLocation,
    ctx: Omit<TriggerContext, 'timing'>,
): TriggerInstance {
    return {
        id: buildTriggerId(entry, timing, now, order, located),
        timing,
        sourceDefId: entry.sourceDefId,
        sourceCardUid: located.uid,
        sourceControllerId: located.controllerId,
        sourceBaseIndex: located.baseIndex,
        mandatory: entry.optional ? false : true,
        ownerPlayerId: entry.playerContext === 'sourceController' && located.controllerId
            ? located.controllerId
            : pid,
        witnessRequirement: 'inPlayAtTriggerTime',
        witnessed: true,
        baseIndex: ctx.baseIndex,
        moveFromBaseIndex: ctx.moveFromBaseIndex,
        moveToBaseIndex: ctx.moveToBaseIndex,
        triggerMinionUid: ctx.triggerMinionUid,
        triggerMinionDefId: ctx.triggerMinionDefId,
        triggerMinionPower: (ctx as any).triggerMinionPower,
        destroyerId: ctx.destroyerId,
        reason: ctx.reason,
        affectType: ctx.affectType,
        rankings: ctx.rankings,
        buriedCardUid: (ctx as any).buriedCardUid,
        buriedCardDefId: (ctx as any).buriedCardDefId,
        buriedCardControllerId: (ctx as any).buriedCardControllerId,
        buriedFrom: (ctx as any).buriedFrom,
        actionTargetBaseIndex: ctx.actionTargetBaseIndex,
        actionTargetType: ctx.actionTargetType,
        actionTargetMinionUid: ctx.actionTargetMinionUid,
        inspectionCards: ctx.inspectionCards,
        inspectionZone: ctx.inspectionZone,
        inspectionTargetPlayerIds: ctx.inspectionTargetPlayerIds,
        inspectionCausePlayerId: ctx.inspectionCausePlayerId,
        lkiMinion: ctx.triggerMinion
            ? {
                uid: ctx.triggerMinion.uid,
                defId: ctx.triggerMinion.defId,
                owner: ctx.triggerMinion.owner,
                controller: ctx.triggerMinion.controller,
                baseIndex: ctx.baseIndex ?? located.baseIndex ?? -1,
                basePower: ctx.triggerMinion.basePower,
                powerCounters: ctx.triggerMinion.powerCounters,
                powerModifier: ctx.triggerMinion.powerModifier,
                tempPowerModifier: ctx.triggerMinion.tempPowerModifier,
                attachedActionDefIds: ctx.triggerMinion.attachedActions?.map(a => a.defId) ?? [],
                metadata: ctx.triggerMinion.metadata ? { ...ctx.triggerMinion.metadata } : undefined,
            }
            : undefined,
    };
}

function shouldSkipTriggerInstance(
    state: SmashUpCore,
    entry: TriggerEntry,
    timing: TitanAwareTriggerTiming,
    located: TriggerSourceLocation,
): boolean {
    return entry.sourceDefId === 'explorers_very_large_boulder'
        && timing === 'onMinionMoved'
        && !!located.titanUid
        && (state.veryLargeBoulderTriggeredTurnByTitan ?? {})[located.titanUid] === state.turnNumber;
}

/** 收集符合当前时机的触发器实例，供全局反应队列后续排序与执行。 */
export function collectTriggers(
    state: SmashUpCore,
    timing: TitanAwareTriggerTiming,
    ctx: Omit<TriggerContext, 'timing'>,
): TriggerQueuedEvent | undefined {
    if (triggerRegistry.length === 0) return undefined;
    const triggers: TriggerInstance[] = [];
    const now = ctx.now;
    const pid = ctx.playerId;

    for (const entry of triggerRegistry) {
        if (entry.timing !== timing) continue;
        // Only queue reaction-phase triggers (replacement effects must remain immediate)
        if (entry.phase === 'replacement') continue;
        if (entry.global) {
            if (!isSourceInZones(state, entry.sourceDefId, entry.globalZones ?? ['hand', 'discard'])) continue;
            triggers.push(createTriggerInstance(entry, timing, now, triggers.length, pid, {}, ctx));
            continue;
        }

        const locatedSources = locateSources(state, entry.sourceDefId);
        if (locatedSources.length === 0) {
            if (!entry.perInstance && isSourceActive(state, entry.sourceDefId)) {
                triggers.push(createTriggerInstance(entry, timing, now, triggers.length, pid, {}, ctx));
            }
            continue;
        }

        if (entry.perInstance) {
            for (const located of locatedSources) {
                if (!isTriggerSourceEligible(entry, timing, located, ctx.baseIndex)) continue;
                if (shouldSkipTriggerInstance(state, entry, timing, located)) continue;
                triggers.push(createTriggerInstance(entry, timing, now, triggers.length, pid, located, ctx));
            }
            continue;
        }

        const located = locatedSources[0];
        if (!isTriggerSourceEligible(entry, timing, located, ctx.baseIndex)) continue;
        if (shouldSkipTriggerInstance(state, entry, timing, located)) continue;
        triggers.push(createTriggerInstance(entry, timing, now, triggers.length, pid, located, ctx));
    }

    if (triggers.length === 0) return undefined;
    return {
        type: SU_EVENTS.TRIGGER_QUEUED,
        payload: { triggers },
        timestamp: now,
    } as TriggerQueuedEvent;
}

/** 濠电偛顦崝宀勫船閼恒儳顩查悗锝傛櫆椤愪粙鏌熼崙銈夋闁糕晛鎳樺畷鎶解€﹂幒鏃傤槱闂佸搫娲ら妵姗€宕鍕瀬闁割偆鍠撴禍顖炴煥?*/
export function registerInterceptor(
    sourceDefId: string,
    interceptor: EventInterceptor
): void {
    // 闂佸憡锚椤兘宕抽崨濠勨攳婵犻潧娲よ闂佹寧绋掗懝楣冨箖閹惧鈻旈柍?sourceDefId 闂佸憡鐟禍婵嬪极閻愬搫绀冮悘鐐跺亹椤忚鲸绻涢崱蹇旑潐缂佽鲸鐟╁濂稿矗婢舵ê澹?HMR 闂備焦褰冪粔鎾囬幓鎺嗘灃闁靛鍎遍弬鈧梺?
    if (interceptorRegistry.some(e => e.sourceDefId === sourceDefId)) return;
    interceptorRegistry.push({ sourceDefId, interceptor });
}

/** 濠电偛顦崝宀勫船娴犲鏄ラ柛婵嗗閸曢箖鏌ょ€圭姵顥夊┑顔肩箻瀹曘垻鈧綆浜滈悡鎴︽煥濞戞澧曟い?alien_jammed_signal闂佹寧绋掔喊宥嗘櫠瀹ュ瀚夊璺鸿嫰鐠愮喖鎮楃涵鍛厫婵☆偁鍊楅幉鎾幢濮楀棗濡伴梺绯曟櫅閹碱偄锕㈤幘顔藉殑闁芥ê顦～鏃堟煥?*/
export function registerBaseAbilitySuppression(
    sourceDefId: string,
    checker: BaseAbilitySuppressionChecker
): void {
    // 闂佸憡锚椤兘宕抽崨濠勨攳婵犻潧娲よ闂佹寧绋掗懝楣冨箖閹惧鈻旈柍?sourceDefId 闂佸憡鐟禍婵嬪极閻愬搫绀冮悘鐐跺亹椤忚鲸绻涢崱蹇旑潐缂佽鲸鐟╁濂稿矗婢舵ê澹?HMR 闂備焦褰冪粔鎾囬幓鎺嗘灃闁靛鍎遍弬鈧梺?
    if (baseAbilitySuppressionRegistry.some(e => e.sourceDefId === sourceDefId)) return;
    baseAbilitySuppressionRegistry.push({ sourceDefId, checker });
}

/** 濠电偞鎸搁幊鎰板煘閺嶎厼绠ラ柍褜鍓熷鍨緞鐎ｎ偅娈橀梺鍛婂姇閻線濡撮崘顔芥櫖闁割偆鍠撻妶鎾偣閸ャ劍绀堥柡浣靛€濋弫?*/
export function clearOngoingEffectRegistry(): void {
    protectionRegistry.length = 0;
    restrictionRegistry.length = 0;
    triggerRegistry.length = 0;
    interceptorRegistry.length = 0;
    baseAbilitySuppressionRegistry.length = 0;
}

export function hasRegisteredTrigger(sourceDefId: string, timing: TriggerTiming): boolean {
    return triggerRegistry.some(entry => entry.sourceDefId === sourceDefId && entry.timing === timing);
}

/**
 * 婵炴垶鎸鹃崕銈嗘櫠瀹ュ瀚?POD 闂佺粯顨呴悧濠傦耿娴煎瓨鍎嶉柛鏇ㄥ亜楠炪垽鏌ｅΔ鈧張顒佺珶閹烘鐓傞煫鍥ㄦ⒐閺嗗牓鏌?trigger/restriction/protection 闂佸憡甯╅崑鍕箖?
 * 
 * POD 闂?defId 闂佸搫绉堕崢褏妲愰埄鍐枖?闂佸憡顭囬崰鎾存櫠濮婃攨fId + _pod"闂佹寧绋戦悧鍡涖€?alien_scout_pod闂佹寧绋戦ˇ顓㈠焵?
 * 濠殿喗绺块崐鏇㈠吹闁秴鏋佸ù鑲╃節閹查箖鏌涘Ο鐑橆棞闁告垟鈧枼鏋栭柕濞垮劚閺傗偓闁荤偞渚楅悡澶屾濠靛牅鐒婇柛鈩冪懐閸庡﹪鏌涘顒傚閻㈩垼鍋呴幈銊р偓锝庝海閸╁瞼鈧鍠栫换鎺戔枔?defId 闂佹眹鍔岀€氼厽鏅跺澶婂珘?trigger/restriction/protection 婵犮垼娉涚粔鎾春濡ゅ啰纾兼繛鍡楁禋閸ょ娀骞栫€涙ɑ鈷掓繛?_pod 闂佺粯顨呴悧濠傦耿娴兼潙违?
 * 闁哄鏅滈悷锕傛偋闁秴绫嶉柣妯肩帛娴犳ê鈽夐幘璺哄妺闁伙腹鍓濈粙?POD 闂佸憡銇涢埀顒€鍟跨粈瀣煟濞嗘ê澧扮紒槌栦邯瀹?trigger 婵炲濯寸徊鍧楁偉濠婂牊鏅悘鐐跺Г閻ㄦ垿鏌ら崘娴嬪亾閻曚礁鏁ら梺绋跨箲閸庡ジ宕靛鍫濈闁靛ě鍕厱闂佸綊娼ч悘婵嬫偄閳ь剛鐥娑樹壕闂佺粯顨呴悧蹇撯枔閹达箑绀傞柕濞垮労濞堢増绻涢幘铏暈闁搞劍鐟╅弻鍛村及韫囨洖绔奸梺?
 * 
 * 闂婎偄娲ら幊姗€濡磋箛娑樻嵍闁靛绠戦。鏌ユ煛閸繍妲规繛锝呯－閸栨牜绱掑Ο缁樻畼闂佸憡鍔曢懟顖炴偩椤掆偓琚欓柡鍥╁仦閸婄敻鎮圭€ｎ亜鏆熼柡浣靛€曢～銏ゅΧ閸涱厽鐦ｉ梺杞版祰閸╁洭鍩€?
 */
export function registerPodOngoingAliases(): void {
    let mappedCount = 0;
    
    // 1. 闂佸搫瀚慨鎾儍?Trigger
    const triggersToAdd: TriggerEntry[] = [];
    for (const entry of triggerRegistry) {
        const { sourceDefId, timing, callback } = entry;
        
        // 闁荤姴鎼悿鍥╂崲閸愵煈鍟呴柤纰卞墰閻ュ懘鏌?_pod 闂?
        if (sourceDefId.endsWith('_pod')) continue;
        if (getTitanDef(sourceDefId)) continue;
        
        const podDefId = `${sourceDefId}_pod`;
        
        // 婵犵鈧啿鈧綊鎮?POD 闂佺粯顨呴悧濠傦耿閺夋鍟呴柤纰卞墰閻ュ懏绻涙径鍫濆闁哥偘绮欓弫宥呯暆閸愵亜鍔滈柡澶嗘櫅濞村嫮妲愬▎鎰枖鐎广儱鐗滃ú顒勬煟閳哄倻澧俊顖氼槸椤曪綀绠涢弮鈧弳鍫ユ煕閹邦剛鐒跨紒?
        const alreadyRegistered = triggerRegistry.some(
            e => e.sourceDefId === podDefId && e.timing === timing
        );
        if (alreadyRegistered) continue;
        
        // 濠电儑缍€椤曆勬叏閻愬搫绀嗛柡澶庢硶缁愨剝绻涙径鍫濆闁哥偘绮欏畷姘旈崟鈹惧亾?
        triggersToAdd.push({
            sourceDefId: podDefId,
            timing,
            callback,
            optional: entry.optional,
            phase: entry.phase,
            perInstance: entry.perInstance,
            sourceScope: entry.sourceScope,
            global: entry.global,
            globalZones: entry.globalZones,
        });
        mappedCount++;
    }
    
    // 闂佸綊娼х紞濠囧闯閸濆媱搴ｆ嫚閹绘帩娼遍梺鎸庣☉閻楁挻瀵奸埡鍛鐎广儱鎳忛煬顒勬⒑椤掆偓缁夋潙顔忔繝姘睄闁哄牆鐏氶崣蹇涙煛閳ь剛鎲撮崟顒侇啀缂傚倷绀佺€氬摜妲?
    for (const entry of triggersToAdd) {
        registerTrigger(entry.sourceDefId, entry.timing, entry.callback, {
            optional: entry.optional,
            phase: entry.phase,
            perInstance: entry.perInstance,
            sourceScope: entry.sourceScope,
            global: entry.global,
            globalZones: entry.globalZones,
        });
    }
    
    // 2. 闂佸搫瀚慨鎾儍?Restriction
    const restrictionsToAdd: RestrictionEntry[] = [];
    for (const entry of restrictionRegistry) {
        const { sourceDefId, restrictionType, checker } = entry;
        
        if (sourceDefId.endsWith('_pod')) continue;
        if (getTitanDef(sourceDefId)) continue;
        
        const podDefId = `${sourceDefId}_pod`;
        
        const alreadyRegistered = restrictionRegistry.some(
            e => e.sourceDefId === podDefId && e.restrictionType === restrictionType
        );
        if (alreadyRegistered) continue;
        
        restrictionsToAdd.push({ sourceDefId: podDefId, restrictionType, checker });
        mappedCount++;
    }
    
    restrictionRegistry.push(...restrictionsToAdd);
    
    // 3. 闂佸搫瀚慨鎾儍?Protection
    const protectionsToAdd: ProtectionEntry[] = [];
    for (const entry of protectionRegistry) {
        const { sourceDefId, protectionType, checker } = entry;
        
        if (sourceDefId.endsWith('_pod')) continue;
        if (getTitanDef(sourceDefId)) continue;
        
        const podDefId = `${sourceDefId}_pod`;
        
        const alreadyRegistered = protectionRegistry.some(
            e => e.sourceDefId === podDefId && e.protectionType === protectionType
        );
        if (alreadyRegistered) continue;
        
        protectionsToAdd.push({ sourceDefId: podDefId, protectionType, checker });
        mappedCount++;
    }
    
    protectionRegistry.push(...protectionsToAdd);
    
    // 4. 闂佸搫瀚慨鎾儍?BaseAbilitySuppression
    const suppressionsToAdd: { sourceDefId: string; checker: BaseAbilitySuppressionChecker }[] = [];
    for (const entry of baseAbilitySuppressionRegistry) {
        const { sourceDefId, checker } = entry;
        
        if (sourceDefId.endsWith('_pod')) continue;
        if (getTitanDef(sourceDefId)) continue;
        
        const podDefId = `${sourceDefId}_pod`;
        
        const alreadyRegistered = baseAbilitySuppressionRegistry.some(
            e => e.sourceDefId === podDefId
        );
        if (alreadyRegistered) continue;
        
        suppressionsToAdd.push({ sourceDefId: podDefId, checker });
        mappedCount++;
    }
    
    baseAbilitySuppressionRegistry.push(...suppressionsToAdd);
    
    // 闂佸搫瀚慨鎾儍閻樼鍋撻悷鐗堟拱闁搞劍宀搁弫宥夊醇濠靛棗娈ラ梺鐓庮殠娴滄粍鎱ㄩ埡鍛強闁绘灏欏▓?POD 闂佺粯顨呴悧濠傦耿娴煎瓨鍎?trigger/restriction/protection闂?
}

/** 闂佸吋鍎抽崲鑼躲亹閸パ€鏋栭柕濞垮劚閺傗偓闁荤偞绋忛崝宀勫Φ閸モ晙鐒婇煫鍥ュ劤缁€鍕偣鐎ｎ亜鏆㈤柣锔诲灦閹粙鈥﹂幒鏃傤槴 */
export function getOngoingEffectRegistrySize(): {
    protection: number;
    restriction: number;
    trigger: number;
    interceptor: number;
} {
    return {
        protection: protectionRegistry.length,
        restriction: restrictionRegistry.length,
        trigger: triggerRegistry.length,
        interceptor: interceptorRegistry.length,
    };
}

/** 闂佸吋鍎抽崲鑼躲亹閸ヮ剙绠ラ柍褜鍓熷鍨緞婵犲倸娈ュ┑鐐差槶閸斿矂宕禒瀣剭?sourceDefId闂佹寧绋戦悧蹇涘极閵堝棛顩查幖娣€曢崢鎾煕閺冣偓缁嬫牠銆侀幋鐐碘枖闁告繂瀚烽崥鈧柣鐘辫濡插嫮妲?*/
export function getRegisteredOngoingEffectIds(): {
    protectionIds: Set<string>;
    restrictionIds: Set<string>;
    triggerIds: Map<string, TriggerTiming[]>;
    interceptorIds: Set<string>;
    baseAbilitySuppressionIds: Set<string>;
} {
    const protectionIds = new Set(protectionRegistry.map(e => e.sourceDefId));
    const restrictionIds = new Set(restrictionRegistry.map(e => e.sourceDefId));
    const interceptorIds = new Set(interceptorRegistry.map(e => e.sourceDefId));
    const baseAbilitySuppressionIds = new Set(baseAbilitySuppressionRegistry.map(e => e.sourceDefId));

    // trigger 闂傚倸娲犻崑鎾绘偡閺囨碍顦风紒缁樺哺閹?timing 婵烇絽娲犻崜婵囧閸涘瓨鏅€光偓閳ь剟寮妶鍡欘洸閹兼番鍨虹痪顖滅磼椤旂厧鈷旈柍銉︼耿閹啴宕熼顐㈡倎闁?
    const triggerIds = new Map<string, TriggerTiming[]>();
    for (const entry of triggerRegistry) {
        const existing = triggerIds.get(entry.sourceDefId) ?? [];
        existing.push(entry.timing);
        triggerIds.set(entry.sourceDefId, existing);
    }

    return { protectionIds, restrictionIds, triggerIds, interceptorIds, baseAbilitySuppressionIds };
}


// ============================================================================
// 闂佸搫琚崕鎾敋?API
// ============================================================================

/**
 * 濠碘槅鍋€閸嬫捇鏌＄仦璇插姎闁绘柡鍋撻梺闈╅檮婵粙宕楀鈧畷婵嗏槈濞嗘剫锕傛煕濮樺墽鐣虫い顐畵瀹曘垻鈧綆浜滈悡?
 *
 * 闂備緡鍓欑粔鏉戭啅婵犳艾绠ラ柍褜鍓熷鍨緞婵犲嫬鏁ら梺闈╅檮婵粙宕楀鈧畷婵嗏槈濡櫣顏婚梺鍛婂笩閸╂牠寮悙鍝勭閻忕偠濮ら悵銈夋煥濞戞瀚扮憸鎶婂懏鍟哄ù锝堫潐缁犳帒鈽夐幘顖氫壕婵炴垶鎼╂禍锝囨崲閹达箑鐐?true 闁诲繐绻楃划楣冨Υ閸愵亞鐭嗗Δ锔筋儥濞煎爼鏌涘Ο渚剰闁糕晜顨婃俊?
 * 闂佹椿娼块崝瀣姳?alien_jammed_signal 缂?闂佸搫鍟版慨楣冿綖鐎ｎ喖鏄ラ柛婵嗗閸曢箖鏌ょ€圭姵顥夊┑?闂佽桨绀侀悧濠囨倶婢舵劕违?
 */
export function isBaseAbilitySuppressed(
    state: SmashUpCore,
    baseIndex: number
): boolean {
    // 1. 濠碘槅鍋€閸嬫捇鏌＄仦璇插姎闁绘柡鍋撴繛瀛樼矊濞撮攱鎱ㄩ幖浣哥畱濞达絿鍎ら悾鍗炩槈閹惧磭鎽犳俊鐐插€垮畷銏⑩偓锝庝簻閻撴垿鏌ㄥ☉妯煎缂佽翰鍎叉穱濠囧磼閿斿墽鐛ラ梺杞扮閻楀﹪鎮樻径濠庡晠闁肩⒈鍓涘▔銏㈢磼?闂佸憡銇涢埀顒€鍟块崵鎺旂磼閸屾繍鍤欐繝褉鍋撻梺鎸庣☉婵傛梻寰婃ィ鍐ㄥ偍閻庯綆浜滈悡鎴︽煙闂€鎰厡闁汇垹顭峰畷姘紣娴ｈ櫣鎲繛鎴炴惄娴滄粌煤閺嶎厼瑙﹂柛顐ｇ箘绾捐鈹戦纰卞劀缂?
    if (state.suppressedBasesUntilTurnStart?.some(s => s.baseIndex === baseIndex)) {
        return true;
    }

    // 2. 濠碘槅鍋€閸嬫捇鏌＄仦璇插姎闁绘柡鍋撴繛瀛樼矊妤犵鈹冮埀顒€鈽夐幘绛瑰伐鐎规洟浜堕幃褍鐣濋埀顒€鈻撻幋锕€绠板ù锝堟閺侀箖鏌涘Ο渚剰闁?
    if (baseAbilitySuppressionRegistry.length === 0) return false;
    for (const entry of baseAbilitySuppressionRegistry) {
        const filteredState = getSuppressionFilteredStateForSource(state, entry.sourceDefId);
        if (!isSourceActiveOnBase(filteredState, entry.sourceDefId, baseIndex)) continue;
        if (entry.checker(filteredState, baseIndex)) return true;
    }
    return false;
}

/** 濠碘槅鍋€閸嬫捇鏌＄仦璇插姎鐎规洟浜堕幃褍鐣濋崘銊ュ箣闂佸憡姊圭粙鎺懳ｉ幖浣歌Е闁挎洍鍋撴い锔规櫆缁傚秵鎯旈垾宕囶伝闂佸憡甯楀﹢褰掓嚈?*/
export function isCardSuppressed(
    state: SmashUpCore,
    cardUid: string,
): boolean {
    return state.suppressedCardsUntilTurnStart?.some(entry => entry.cardUid === cardUid) ?? false;
}

export function getSuppressionFilteredStateForSource(
    state: SmashUpCore,
    sourceDefId: string,
): SmashUpCore {
    if (!state.suppressedCardsUntilTurnStart?.length) {
        return state;
    }

    const suppressedUids = new Set(state.suppressedCardsUntilTurnStart.map(entry => entry.cardUid));
    let changed = false;

    const bases = state.bases.map(base => {
        let baseChanged = false;

        const ongoingActions = base.ongoingActions.filter(action => {
            const keep = !(action.defId === sourceDefId && suppressedUids.has(action.uid));
            if (!keep) baseChanged = true;
            return keep;
        });

        const minions = base.minions.flatMap(minion => {
            if (minion.defId === sourceDefId && suppressedUids.has(minion.uid)) {
                baseChanged = true;
                return [];
            }

            const attachedActions = (minion.attachedActions ?? []).filter(action => {
                const keep = !(action.defId === sourceDefId && suppressedUids.has(action.uid));
                if (!keep) baseChanged = true;
                return keep;
            });

            if (attachedActions.length !== (minion.attachedActions ?? []).length) {
                return [{ ...minion, attachedActions }];
            }

            return [minion];
        });

        if (!baseChanged) {
            return base;
        }

        changed = true;
        return {
            ...base,
            minions,
            ongoingActions,
        };
    });

    if (!changed) {
        return state;
    }

    return {
        ...state,
        bases,
    };
}

/**
 * 濠碘槅鍋€閸嬫捇鏌＄仦璇插姦婵炲牄鍨虹粋鎺撴償閵忊寬锕傛煕濮樺墽鐣辩憸鏉跨墛缁屽崬鈹戦崶顬?
 *
 * 闂備緡鍓欑粔鏉戭啅婵犳艾绠ラ柍褜鍓熷鍨緞婢跺瞼顔旈梺纭呯堪閸婃牜鈧哎鍊濋獮瀣敂閸曨剛褰滈梺鎸庣☉閼活垵銇愯閹茬増鎷呯憴鍕暢婵炴垶鎸撮崑鎾斥槈閹垮啩娴风紒缁樺灴瀹?true 闁诲繐绻楃划楣冨Υ閸愵亞鐭嗛柛婵嗗缂嶁偓婵烇絽娲︾换鍐╂叏閵忋倕违?
 * 闂佸憡鐟禍婵嗭耿娴ｅ浜归柟鎹愭珪缁ㄦ艾鈽夐幘绛瑰伐闁宦板姂瀹曠兘濡搁敃鈧徊鐟般€掑顓犫棩缂佺粯宀搁獮搴ㄥΧ閸ャ劎鏆?ongoing 闂佸憡顨愮槐鏇熸櫠濠靛绠ｉ柡宥庡幗椤撶懓霉閻樻彃顒㈡俊鐐插€块弫宥囦沪缁涘娈搁柟鐓庣摠濮婂湱鈧哎鍊濋獮瀣敂閸曨剛褰滈梺褰掓涧缁夊爼寮幘璇叉瀬闁割偅绋堥崑?
 */
export function isMinionProtected(
    state: SmashUpCore,
    targetMinion: MinionOnBase,
    targetBaseIndex: number,
    sourcePlayerId: PlayerId,
    protectionType: ProtectionType
): boolean {
    if (hasTurnScopedMetadataProtection(state, targetMinion, protectionType)) return true;
    if (protectionRegistry.length === 0) return false;

    const ctx: ProtectionCheckContext = {
        state,
        targetMinion,
        targetBaseIndex,
        sourcePlayerId,
        protectionType,
    };

    for (const entry of protectionRegistry) {
        if (entry.protectionType !== protectionType) continue;
        // 濠碘槅鍋€閸嬫捇鏌＄仦璇插姎婵犙€鍋撴繛鎴炴尭閿曘儱危閹间礁瑙﹂柨鏃囧Г缁犳帡鏌熺紒妯哄缂佽泛鐏氱粚鍗炩攽閸ヮ灝鎴︽煟閵娿儱顏繛濂告涧閳瑰啴骞囬崜浣侯槱ongoing 闂佸憡銇涢崜婵嬪垂閵娾晜鈷曢煫鍥ф捣閻倝鏌?
        const filteredState = getSuppressionFilteredStateForSource(state, entry.sourceDefId);
        if (!isSourceActive(filteredState, entry.sourceDefId)) continue;
        if (entry.checker({ ...ctx, state: filteredState })) return true;
    }
    return false;
}

/**
 * 濠碘槅鍋€閸嬫捇鏌＄仦璇插姦婵炲牄鍨虹粋鎺撴償閵忊寬锕傛煕濮樺墽鐣辩憸鏉跨墦瀹曟碍瀵肩€涙ê顫″┑鐐村灥閻楁劙鍩€椤掍緡娈旈柣搴ㄦ敱缁屽崬鈹戦崶顬垿鏌ㄥ☉妯煎ⅱ闁轰降鍊栫粋宥嗘償閿濆棛鐛ラ梺鍝勭Т濞差參鍩€椤掆偓椤︽壆鈧哎鍔嶅濠氬炊閵婏箑袘闂?
 *
 * 濠电偞鍨甸悧鎰板焵椤掍緡娈旈柣搴ㄦ敱缁屽崬鈹戦崶顬垿鏌ㄥ☉妯煎妞?tooth_and_claw闂佹寧绋戦ˇ顔剧箔婢跺鍎熼柡鍌涘闊剟鏌ｉ埡濠傛灍闁绘牭缍侀弻鍛緞鐎ｎ亶浠撮梻鍌氬暢閸╂牠顢欑仦鐐氦闁搞儯鍔嶆慨銏ゆ煥?
 * 闂佸吋婢橀懟顖滆姳閺屻儱鎹堕柕濞垮€楅惃鎴澝归悩铏瀯濡ょ姴娲幃浠嬫偄闁垮鈧敻姊洪锝勪孩缂?filterProtectedDestroyEvents 濠电偞鍨甸悧鎰板焵椤掍緡娈旀い锔规櫊閹爼宕遍幇銊ヤ壕?
 */
export function isMinionProtectedNonConsumable(
    state: SmashUpCore,
    targetMinion: MinionOnBase,
    targetBaseIndex: number,
    sourcePlayerId: PlayerId,
    protectionType: ProtectionType
): boolean {
    if (hasTurnScopedMetadataProtection(state, targetMinion, protectionType)) return true;
    if (protectionRegistry.length === 0) return false;

    const ctx: ProtectionCheckContext = {
        state,
        targetMinion,
        targetBaseIndex,
        sourcePlayerId,
        protectionType,
    };

    for (const entry of protectionRegistry) {
        if (entry.protectionType !== protectionType) continue;
        if (entry.consumable) continue; // 闁荤姴鎼悿鍥╂崲閸愩劉妲堥柛顐岛閸嬫挸螖閳ь剟鎮楅柨瀣攳婵犻潧娲よ
        const filteredState = getSuppressionFilteredStateForSource(state, entry.sourceDefId);
        if (!isSourceActive(filteredState, entry.sourceDefId)) continue;
        if (entry.checker({ ...ctx, state: filteredState })) return true;
    }
    return false;
}

function hasTurnScopedMetadataProtection(
    state: SmashUpCore,
    targetMinion: MinionOnBase,
    protectionType: ProtectionType,
): boolean {
    const metadata = targetMinion.metadata ?? {};
    const currentTurn = state.turnNumber ?? 0;
    const destroyUntilTurn = typeof metadata.tempProtectDestroyUntilTurnNumber === 'number'
        ? metadata.tempProtectDestroyUntilTurnNumber
        : undefined;
    const moveUntilTurn = typeof metadata.tempProtectMoveUntilTurnNumber === 'number'
        ? metadata.tempProtectMoveUntilTurnNumber
        : undefined;
    const affectUntilTurn = typeof metadata.tempProtectAffectUntilTurnNumber === 'number'
        ? metadata.tempProtectAffectUntilTurnNumber
        : undefined;

    if (protectionType === 'destroy') return (destroyUntilTurn ?? -1) >= currentTurn;
    if (protectionType === 'move') return (moveUntilTurn ?? -1) >= currentTurn;
    if (protectionType === 'affect' || protectionType === 'action') return (affectUntilTurn ?? -1) >= currentTurn;
    return false;
}

/**
 * 返回一个可被消耗的保护来源。
 *
 * 只有在 `isMinionProtected()` 已确认目标受到保护时，这里才会继续查找具体来源；
 * 例如 `trickster_hideout` 这类持续效果，会在真正拦截 destroy / move / affect 前
 * 定位到对应的 ongoing 来源，供后续发出 `ONGOING_DETACHED` 或移除保护状态使用。
 */
export function getConsumableProtectionSource(
    state: SmashUpCore,
    targetMinion: MinionOnBase,
    targetBaseIndex: number,
    sourcePlayerId: PlayerId,
    protectionType: ProtectionType
): { uid: string; defId: string; ownerId: string } | undefined {
    if (protectionRegistry.length === 0) return undefined;

    const ctx: ProtectionCheckContext = {
        state,
        targetMinion,
        targetBaseIndex,
        sourcePlayerId,
        protectionType,
    };

    for (const entry of protectionRegistry) {
        if (entry.protectionType !== protectionType) continue;
        if (!entry.consumable) continue;
        const filteredState = getSuppressionFilteredStateForSource(state, entry.sourceDefId);
        if (!isSourceActive(filteredState, entry.sourceDefId)) continue;
        if (!entry.checker({ ...ctx, state: filteredState })) continue;
        // 闂佺懓鐏氶崕鎶藉春鐏炶В妲堥柛顐岛閸嬫挸螖閳ь剟鎮楅柨瀣攳婵犻潧娲よ闂佸搫顦崕鑼姳椤曗偓閺佸秶浠﹂崜褍寮ㄩ梺鐟扮仛閸庢娊宕ｉ幐搴㈠闁规崘鍩栭悾?ongoing 闂佸憡顨愮槐鏇熸櫠濠靛牃鍋撻崷顓炰粧缂?
        const base = filteredState.bases[targetBaseIndex];
        if (!base) continue;
        // 闂佺绻愰悧濠囁夐崨鏉戣摕闁靛鏅滈鐟懊归悩鏌ュ弰婵＄虎鍣ｉ幆鍫ュ焵?
        const filteredTargetMinion = base.minions.find(minion => minion.uid === targetMinion.uid) ?? targetMinion;
        const attached = filteredTargetMinion.attachedActions.find(a => a.defId === entry.sourceDefId);
        if (attached) return { uid: attached.uid, defId: attached.defId, ownerId: attached.ownerId };
        // 闂佸憡鍔曠粔鐢杆夐崨鏉戣摕闁靛鍎抽崬銊╂煕?ongoing
        const ongoing = base.ongoingActions.find(o => o.defId === entry.sourceDefId);
        if (ongoing) return { uid: ongoing.uid, defId: ongoing.defId, ownerId: ongoing.ownerId };
    }
    return undefined;
}

/**
 * 濠碘槅鍋€閸嬫捇鏌＄仦璇插姕闁瑰ジ鏀遍幏鍛煥閸曨儷锕傛煕濮樺墽鐣虫い顐畵濮婁粙骞囬鈧悡?
 *
 * 婵炴垶鎸堕崐鏇㈡儑閺夎娑㈠焵椤掑嫬钃熼柕澶樺灣缁?
 * 1. 闂佺硶鏅涢幖顐耿鐎电硶鍋撶憴鍕叝缂佺姷鍠愮粙澶嬬節閸曨剛鏆?restrictions闂佹寧绋戦悧濠囧汲閻旂厧绠叉い鏇楀亾闁崇懓绉瑰畷婵嬧€﹂幒鏃傤槷闂佺厧顨庢禍婊勬叏閳哄啯鍠嗛柨婵嗘閳ь兛绮欓弫?
 * 2. ongoing 闂佽桨绀侀悧濠囨倶婢跺ň鏋栭柕濞垮劚閺傗偓闁荤偞渚楅悡澶屾濞嗘垶鍋橀悘鐐舵琚熼梺?闂傚倸鎳庣换瀣垝閻樼粯鍎嶉柛鏇ㄥ墮椤忥繝鏌熼幖顓濈盎婵炲懏甯￠弫?
 */
export function isOperationRestricted(
    state: SmashUpCore,
    baseIndex: number,
    playerId: PlayerId,
    restrictionType: RestrictionType,
    extra?: Record<string, unknown>
): boolean {
    const base = state.bases[baseIndex];
    if (!base) return false;

    // 1. 闂佺硶鏅涢幖顐耿鐎电硶鍋撶憴鍕叝缂佺姷鍠愮粙澶嬬節閸曨剛鏆犻梻鍌氬閸旀洟宕哄Δ鍐╁枂闁告洦鍋勯悘鐔兼煥濞戞澧涢柡鍡欏枛楠炴垿顢氶埀顒勫煘瀹ュ绀夋い顓熷笧缁€?
    const baseDef = getBaseDef(base.defId);
    if (baseDef?.restrictions) {
        for (const r of baseDef.restrictions) {
            if (r.type !== restrictionType) continue;
            // 闂佸搫鍟版慨闈涱焽椤栨稓顩烽柛顐ｆ礃椤庢瑩鏌?
            if (!r.condition) return true;
            // 闂佸搫顦埀顒€寮堕浠嬫⒒閸曨剙濮囬柛鈺傤殜閺佸秴顫㈤悽顣濸ower闂佹寧绋戦悧鍡樻叏韫囨稒鐓?<= maxPower 闂佹眹鍔岀€氭澘鈻撻姀锛勵浄閹兼番鍊ゅ鍓佺磼閸屾瑧鍔嶆い鎺撶洴閺?
            if (r.condition.maxPower !== undefined && restrictionType === 'play_minion') {
                const basePower = extra?.basePower as number | undefined;
                if (basePower !== undefined && basePower <= r.condition.maxPower) {
                    // Tsar's Palace + Infiltrate FAQ闂?
                    // 闂佸吋鐪归崕鎾敋濮樿埖鍋濋柍杞扮贰閸熲偓闂侀潻璐熼崝蹇涱敋濮樿泛鏄ラ柛婵嗗閸曟儳鈽夐幘绛规敾婵犫偓娓氣偓閹虫盯顢旈崟顓犵暢闂佺鐭囬崘銊у幀闂?Infiltrate闂佹寧绋戝绌昦y-on-base 闁荤偞绋戦懟顖涙叏閳哄懏鏅鑸电〒缁€?
                    // 闂佸憡甯楅悷銉ㄣ亹閸欏顩烽柕澶涢檮閿熴儵鎮峰▎蹇旑棏闁逞屽墯缁楊摰wer闂? 婵炴垶鎸哥粔纾嬨亹閺屻儱绠ラ柟鎯у暱濮ｅ鏌嶉妷锔剧畼婵炲牊鍨垮浠嬪箛椤掆偓閻撴垿鏌?
                    if (baseDef.id === 'base_tsars_palace') {
                        const hasBaseInfiltrate = base.ongoingActions.some(o =>
                            o.ownerId === playerId && o.defId.startsWith('ninja_infiltrate'),
                        );
                        if (hasBaseInfiltrate) {
                            continue;
                        }
                    }
                    return true;
                }
            }
            // 闂佸搫顦埀顒€寮堕浠嬫⒒閸曨剙濮囬柛鈺傤殜閺佸秴顫㈤悞鐜箁aPlayMinionPowerMax闂佹寧绋戦悧鎾宦烽崒娑樼窞闁哄诞鍐╃様闂佺粯顨呴張顒€顪冮崒鐐茬婵炴垯鍨瑰▍?> limit 闂佹眹鍔岀€氭澘鈻撻姀锛勵浄閹兼番鍊ゅ鍓佺磼閸屾瑧鍔嶆い鎺撶洴閺?
            if (r.condition.extraPlayMinionPowerMax !== undefined && restrictionType === 'play_minion') {
                const basePower = extra?.basePower as number | undefined;
                const isExtraMinionPlay = extra?.isExtraMinionPlayAttempt as boolean | undefined;
                const usingBaseLimitedQuota = (extra?.usesBaseLimitedMinionQuota as boolean | undefined)
                    ?? mustUseBaseLimitedMinionQuota(
                        state,
                        state.players[playerId],
                        baseIndex,
                        extra?.minionDefId as string | undefined,
                        basePower,
                    );
                if ((isExtraMinionPlay || usingBaseLimitedQuota) && basePower !== undefined && basePower > r.condition.extraPlayMinionPowerMax) {
                    return true;
                }
            }
            // 闂佸搫顦埀顒€寮堕浠嬫⒒閸曨剙濮囬柛鈺傤殜閺佸秴顫㈤悽绉恑onPlayLimitPerTurn闂佹寧绋戦悧濠囨儊閿熺姴鐐婇柣鎰级閸娿倖鎱ㄩ敐鍛缂傚秴鎳橀幃鎶藉煛娓氬洤鏅欓梺闈╄礋閸斿秹顢楀┑瀣槬闁告繂瀚崟楣冩煙閸偅灏柛銈庡弮濮婃崘绠涙惔锝囩厾婵炴垶鎸搁敃顏勵瀶濞差亝鏅?
            if (r.condition.minionPlayLimitPerTurn !== undefined && restrictionType === 'play_minion') {
                const player = state.players[playerId];
                const playedAtBase = player?.minionsPlayedPerBase?.[baseIndex] ?? 0;
                if (playedAtBase >= r.condition.minionPlayLimitPerTurn) {
                    // Antarctic Base + Infiltrate FAQ闂?
                    // 闂佸吋鐪归崕鎵礊濮椻偓瀹曠兘濡搁…鎴濇畽闂佺硶鏅涢幖顐耿鐎涙鈻斿┑鐘插暞缁犳帡鏌ゆ總澶夌盎缂佽绶氶獮鎺曨槻闁糕晜顨婇幆?Infiltrate闂佹寧绋戝绌昦y-on-base 闁荤偞绋戦懟顖涙叏閳哄懏鏅鑸电〒缁€澶愭煕閹烘挾鎳佺紓宥嗭耿瀹曪綁顢涘▎搴ｉ瀺闂婎偄娲ㄩ弲顐﹀汲閹邦喗瀚氶柕澶嗘櫆椤庢瑩鏌涢幒鏇犲牚闁?
                    if (baseDef.id === 'base_antarctic_base') {
                        const hasBaseInfiltrate = base.ongoingActions.some(o =>
                            o.ownerId === playerId && o.defId.startsWith('ninja_infiltrate'),
                        );
                        if (hasBaseInfiltrate) {
                            continue;
                        }
                    }
                    return true;
                }
            }
        }
    }

    // 2. ongoing 闂佽桨绀侀悧濠囨倶婢跺ň鏋栭柕濞垮劚閺傗偓闁荤偞渚楅悡澶屾濞嗘垶鍋橀悘鐐舵琚熼梺?闂傚倸鎳庣换瀣垝閻樼粯鍎嶉柛鏇ㄥ墮椤忥繝鏌熼幖顓濈盎婵炲懏甯￠弫?
    if (restrictionRegistry.length > 0) {
        const ctx: RestrictionCheckContext = {
            state,
            baseIndex,
            playerId,
            restrictionType,
            extra,
        };
        for (const entry of restrictionRegistry) {
            if (entry.restrictionType !== restrictionType) continue;
            const filteredState = getSuppressionFilteredStateForSource(state, entry.sourceDefId);
            if (!isSourceActiveOnBase(filteredState, entry.sourceDefId, baseIndex)) continue;
            if (entry.checker({ ...ctx, state: filteredState })) return true;
        }
    }

    return false;
}

/** 濠碘槅鍋€閸嬫捇鏌＄仦璇插姢閻㈩垵娅ｉ埀顒傤攰閸╂牕危閹间礁瑙﹂柨鏇楀亾妞わ腹鏅滅粋宥嗘償閵忕姷妲风紓鍌欑贰閸樻椽鎳欓幋锔藉剭闁告洦鍋勫鍧楁倶閻愨晛浜鹃梻鍌氬閸旀洟宕哄Δ鍛櫖闁割偅绻嶅ú銈夋煟椤愵剛纾挎繝鈧姀銈呯闁瑰嘲鐭堥崬?POD闂?*/
export function hasPlayerTurnRestriction(
    state: SmashUpCore,
    playerId: PlayerId,
    restrictionType: PlayerTurnRestrictionType,
): boolean {
    return state.playerRestrictionsUntilTurnStart?.some(
        entry => entry.targetPlayerId === playerId && entry.restrictionType === restrictionType,
    ) ?? false;
}

/**
 * 闂佸湱鐟抽崱鈺傛杸婵炲瓨绮岄鍕枎閵忋倕绠柨鏃囨閻掑鏌ㄥ☉娆忓摵濞存粌鐖煎畷銏ゅ幢濡粯娈橀梺鍛婂姇閻厧鈻撻幋锕€绠柨鏃囨閻掑鏌涢敐搴ｅ帨缂佽鲸绻勭划顓㈩敄鐠侯煈浼囨繛鎴炴惄娴滐絿鎹㈤幋锕€鐐婇柣鎰劋婵?undefined 闂佹眹鍔岀€氼喚鍒掗妸鈺佸嚑婵犲﹤鎳忛弲鎼佹煛?
 *
 * 闁哄鏅滈弻銊ッ洪弽顓炵９缁绢參顥撶粣?
 * - undefined 闂?闂佸搫鍟版慨鐢碘偓姘ュ€濋獮瀣敂閸曨剛褰滈梺鍛婄墪缂嶅﹪宕?
 * - SmashUpEvent / SmashUpEvent[] 闂?闂佸搫娲︾€笛冪暦?
 * - null 闂?闂佸憡姘ㄩ崑娑樷枍?
 */
export function interceptEvent(
    state: SmashUpCore,
    event: SmashUpEvent
): SmashUpEvent | SmashUpEvent[] | null | undefined {
    if (interceptorRegistry.length === 0) return undefined;

    for (const entry of interceptorRegistry) {
        const filteredState = getSuppressionFilteredStateForSource(state, entry.sourceDefId);
        if (!isSourceActive(filteredState, entry.sourceDefId)) continue;
        const result = entry.interceptor(filteredState, event);
        if (result !== undefined) return result;
    }
    return undefined;
}

/**
 * 闁荤喐鐟辩粻鎴ｃ亹閸岀偛绠伴柛銉戝懏姣庨梺鍝勫暢閸╂牕鈹冮埀顒勬煟閵娿儱顏褍绉瑰鍨緞鐎ｎ亶浠梺瑙勬儗娴滄粌鈻?
 *
 * 闁哄鏅滈弻銊ッ洪弽顓炵闁逞屽墴瀵灚寰勯獮顔芥礋瀹曪綁骞嬪┑鍥╁綔婵炲瓨绫傞崨顔芥闂佹眹鍔岀€氼亞鑺遍妸锔绢浄閻犺櫣鍎ょ€氭煡鏌涘▎妯虹仸闁逞屽墮椤﹀崬鈻?matchState闂?
 */
export function fireTriggers(
    state: SmashUpCore,
    timing: TitanAwareTriggerTiming,
    ctx: Omit<TriggerContext, 'timing'>,
    options?: { phase?: 'replacement' | 'reaction' }
): TriggerResult {
    if (triggerRegistry.length === 0) {
        return { events: [] };
    }

    const events: SmashUpEvent[] = [];
    let matchState = ctx.matchState;
    const fullCtx: TriggerContext = { ...ctx, timing };

    for (const entry of triggerRegistry) {
        if (entry.timing !== timing) continue;
        if (options?.phase && (entry.phase ?? 'reaction') !== options.phase) continue;
        
        const filteredState = getSuppressionFilteredStateForSource(state, entry.sourceDefId);
        const getFilteredMatchState = () => (
            matchState && matchState.core === state
                ? { ...matchState, core: filteredState }
                : matchState
        );

        if (entry.global) {
            if (!isSourceInZones(state, entry.sourceDefId, entry.globalZones ?? ['hand', 'discard'])) continue;
            const result = entry.callback({ ...fullCtx, state: filteredState, matchState: getFilteredMatchState() });
            const triggerEvents = Array.isArray(result) ? result : result.events;
            if (triggerEvents.length > 0) {
                events.push(...triggerEvents);
            }
            if (!Array.isArray(result) && result.matchState) {
                matchState = result.matchState;
            }
            continue;
        }

        const locatedSources = locateSources(filteredState, entry.sourceDefId);
        if (locatedSources.length === 0) {
            if (!entry.perInstance && isSourceActive(filteredState, entry.sourceDefId)) {
                const result = entry.callback({ ...fullCtx, state: filteredState, matchState: getFilteredMatchState() });
                const triggerEvents = Array.isArray(result) ? result : result.events;
                if (triggerEvents.length > 0) {
                    events.push(...triggerEvents);
                }
                if (!Array.isArray(result) && result.matchState) {
                    matchState = result.matchState;
                }
            }
            continue;
        }

        const sourcesToExecute = entry.perInstance
            ? locatedSources.filter(located => isTriggerSourceEligible(entry, timing, located, ctx.baseIndex))
            : [selectSpecificSourceLocation(locatedSources, ctx)].filter(located => (
                located !== undefined && isTriggerSourceEligible(entry, timing, located, ctx.baseIndex)
            ));
        if (sourcesToExecute.length === 0) continue;

        for (const located of sourcesToExecute) {
            const result = entry.callback({
                ...fullCtx,
                state: filteredState,
                matchState: getFilteredMatchState(),
                sourceCardUid: located.uid,
                sourceBaseIndex: located.baseIndex,
                sourceControllerId: located.controllerId,
            });
            const triggerEvents = Array.isArray(result) ? result : result.events;
            if (triggerEvents.length > 0) {
                events.push(...triggerEvents);
            }
            if (!Array.isArray(result) && result.matchState) {
                matchState = result.matchState;
            }
        }
    }

    return { events, matchState };
}

function selectSpecificSourceLocation(
    locatedSources: TriggerSourceLocation[],
    ctx: Omit<TriggerContext, 'timing'>,
): TriggerSourceLocation | undefined {
    const preferredUid = ctx.sourceCardUid ?? ctx.triggerMinionUid;
    if (preferredUid) {
        const matched = locatedSources.find(located => located.uid === preferredUid);
        if (matched) {
            return matched;
        }
    }
    return locatedSources[0];
}

/**
 * 婵炲濮撮幊鎾诡杺闂佸憡鐟﹂崹鍓佲偓鍨皑閳ь剝顫夌喊宥咁焽闂堟稈鏀?defId 闂佹眹鍔岀€氼垵顤傞梺鍛婄懄閸ㄩ潧鈻嶉幒妤€违?
 *
 * 闂佹椿娼块崝瀣姳椤掑嫬鐏虫繝濠傚暞閸婂崬鈽夐幘顖氫壕 Start Turn 缂備焦鍔栭〃鍛般亹濞戞瑧鈻旀い鎾跺枑閻撯偓闁哄鏅滅粙鎴濃攦閳ь剟鏌ｉ妸銉ヮ仼鐎规洟浜堕幃褍鐣濋崟顑跨帛闁荤喐娲戦懗鍫曟偟濞戙垹绀嗛柡鍕潧婢跺本鍠嗛柨鏇楀亾鐟滄澘鍊块崹鎯р攽婵犲嫮顔愮紓渚囧亯椤曆冣攦閳ь剟鏌￠崪浣哥伈缂?
 * 闂備緡鍓欓悘婵嬪储閵堝鐓傜€广儱妫欓悡鈧梺瑙勵問閸嬪懎顕ｉ崸妤€绀傞柕濞炬櫅閸?onTurnStart 闂佸搫顦崕鑼姳椤曗偓婵?
 */
export function fireTriggerForSource(
    state: SmashUpCore,
    sourceDefId: string,
    timing: TriggerTiming,
    ctx: Omit<TriggerContext, 'timing'>,
    options?: { phase?: 'replacement' | 'reaction' }
): TriggerResult {
    if (triggerRegistry.length === 0) {
        return { events: [] };
    }

    const events: SmashUpEvent[] = [];
    let matchState = ctx.matchState;
    const fullCtx: TriggerContext = { ...ctx, timing };

    for (const entry of triggerRegistry) {
        if (entry.sourceDefId !== sourceDefId) continue;
        if (entry.timing !== timing) continue;
        if (options?.phase && (entry.phase ?? 'reaction') !== options.phase) continue;

        const filteredState = getSuppressionFilteredStateForSource(state, entry.sourceDefId);
        const getFilteredMatchState = () => (
            matchState && matchState.core === state
                ? { ...matchState, core: filteredState }
                : matchState
        );

        if (entry.global) {
            if (!isSourceInHandOrDiscard(state, entry.sourceDefId)) continue;
            const result = entry.callback({ ...fullCtx, state: filteredState, matchState: getFilteredMatchState() });
            const triggerEvents = Array.isArray(result) ? result : result.events;
            if (triggerEvents.length > 0) {
                events.push(...triggerEvents);
            }
            if (!Array.isArray(result) && result.matchState) {
                matchState = result.matchState;
            }
            continue;
        }

        const locatedSources = locateSources(filteredState, entry.sourceDefId);
        if (locatedSources.length === 0) {
            if (!entry.perInstance && isSourceActive(filteredState, entry.sourceDefId)) {
                const result = entry.callback({ ...fullCtx, state: filteredState, matchState: getFilteredMatchState() });
                const triggerEvents = Array.isArray(result) ? result : result.events;
                if (triggerEvents.length > 0) {
                    events.push(...triggerEvents);
                }
                if (!Array.isArray(result) && result.matchState) {
                    matchState = result.matchState;
                }
            }
            continue;
        }

        const sourcesToExecute = entry.perInstance
            ? locatedSources.filter(located => isTriggerSourceEligible(entry, timing, located, ctx.baseIndex))
            : [selectSpecificSourceLocation(locatedSources, ctx)].filter(located => (
                located !== undefined && isTriggerSourceEligible(entry, timing, located, ctx.baseIndex)
            ));
        if (sourcesToExecute.length === 0) continue;

        for (const located of sourcesToExecute) {
            const result = entry.callback({
                ...fullCtx,
                state: filteredState,
                matchState: getFilteredMatchState(),
                sourceCardUid: located.uid,
                sourceBaseIndex: located.baseIndex,
                sourceControllerId: located.controllerId,
            });
            const triggerEvents = Array.isArray(result) ? result : result.events;
            if (triggerEvents.length > 0) {
                events.push(...triggerEvents);
            }
            if (!Array.isArray(result) && result.matchState) {
                matchState = result.matchState;
            }
        }
    }

    return { events, matchState };
}

function isSourceInZones(
    state: SmashUpCore,
    sourceDefId: string,
    zones: Array<'hand' | 'discard' | 'deck'>,
): boolean {
    for (const p of Object.values(state.players)) {
        if (zones.includes('hand') && p.hand?.some(c => c.defId === sourceDefId)) return true;
        if (zones.includes('discard') && p.discard?.some(c => c.defId === sourceDefId)) return true;
        if (zones.includes('deck') && p.deck?.some(c => c.defId === sourceDefId)) return true;
    }
    if ((state.titans ?? []).some(titan => titan.defId === sourceDefId)) {
        return true;
    }
    return false;
}

// ============================================================================
// 闂佸憡鍔曢幊姗€宕曠€涙ɑ缍囬柛娑卞幖琚?
// ============================================================================

/**
 * 濠碘槅鍋€閸嬫捇鏌＄仦璇插姕閻庢哎鍊濋獮瀣敂閸曨剛褰滈梺鍝勵槶閸庤尙鑺遍鈧浼搭敍濮橆厼鍓ㄩ梺闈╄礋閸斿苯鈹冮埀顒€鈽夐幘绛规敾婵＄偠娉曢幑?
 *
 * 闂佸搫顦崕鑼姳椤曗偓瀹曪綁顢涘▎搴ｉ瀺闂佸搫瀚烽崹鐣屾?
 * 1. 闂佺硶鏅涢幖顐耿閹绢喖瀚夋い鎺戝暣閻撯晠鏌ㄥ☉妯荤秳ase.defId闂?
 * 2. 闂佺硶鏅涢幖顐耿鐎涙鈻斿┑鐘插閻?ongoing 闁荤偞绋戦懟顖涙叏閳哄懎纭€闁宠棄鎳愮粈鍒糿goingActions 婵炴垶鎼╅崢鎯р枔?defId闂?
 * 3. 闂佺硶鏅涢幖顐耿鐎涙鈻斿┑鐘插閻ｉ亶姊婚崨顓犵缂侇喚濞€閺佸秹宕搁。寮塱ons 婵炴垶鎼╅崢鎯р枔?defId闂佹寧绋戞總鏃傜箔閺嶎厼瀚?ongoing 闂佺厧鐤囧Λ鍕叏韫囨稑鍐€闁搞儮鏅╅崝顕€鏌?
 * 4. 闂傚倸鎳庣换瀣垝閻樺磭鈻斿┑鐘叉处椤庡秹鏌ｉ鐔蜂壕闂?ongoing 闁荤偞绋戦懟顖涙叏閳哄懎纭€闁宠棄鎳愮粈鍒焧tachedActions 婵炴垶鎼╅崢鎯р枔?defId闂?
 */
function isSourceActive(state: SmashUpCore, sourceDefId: string): boolean {
    if (state.pendingAfterScoringSpecials?.some(s => s.sourceDefId === sourceDefId)) {
        return true;
    }
    for (const base of state.bases) {
        // 濠碘槅鍋€閸嬫捇鏌＄仦璇插姎闁绘柡鍋撻梺闈╁婢ф锕㈡导瀵稿彆?
        if (base.defId === sourceDefId) {
            return true;
        }
        // 濠碘槅鍋€閸嬫捇鏌＄仦璇插姎闁绘柡鍋撻梺闈╃畵椤ｏ妇绮崒鐐村剭?ongoing 闁荤偞绋戦懟顖涙叏閳哄懎纭€?
        if (base.ongoingActions.some(o => o.defId === sourceDefId)) {
            return true;
        }
        // 濠碘槅鍋€閸嬫捇鏌＄仦璇插姎闁绘柡鍋撻梺闈╃畵椤ｏ妇绮崒鐐村剭闁告洦鍨遍鐟懊?
        if (base.minions.some(m => m.defId === sourceDefId)) {
            return true;
        }
        // 濠碘槅鍋€閸嬫捇鏌＄仦璇插姦婵炲牄鍨虹粋鎺撴償濠靛牏鎲梻鍌氬鐎氼喖顭囬崘顔藉剭闁告洦鍣弨浠嬫煕閺傝濡肩€?
        for (const m of base.minions) {
            if (m.attachedActions?.some(a => a.defId === sourceDefId)) {
                return true;
            }
        }
    }

    if ((state.titans ?? []).some(titan => titan.defId === sourceDefId && titan.location.zone === 'base')) {
        return true;
    }
    
    return false;
}

/**
 * 濠碘槅鍋€閸嬫捇鏌＄仦璇插姕閻庢哎鍊濋獮瀣敂閸曨剛褰滈梺鍝勵槶閸庤尙鑺遍鈧浼搭敍濮橆厼鍓ㄩ梺闈╄礋閸斿秶鈧灚姘ㄩ埀顒冾潐閼归箖鎮㈤埀顒勬煕閿曞偆鏆掔紒妤€鍊哥叅闁哄嫬绻掗埞?
 * 闂佹椿娼块崝瀣姳椤掑嫬鏄ラ柛婵嗗閸曢箖鏌ゆ總澶夋捣闂傚ň鏅犻幆鍐礋椤栨侗鈧瑩鏌涢幒鏇炵厫闁哄懌鍎靛?
 */
export function isSourceActiveOnBase(state: SmashUpCore, sourceDefId: string, baseIndex: number): boolean {
    const base = state.bases[baseIndex];
    if (!base) return false;
    // 濠碘槅鍋€閸嬫捇鏌＄仦璇插姎闁绘柡鍋撻梺闈╁婢ф锕㈡导瀵稿彆?
    if (base.defId === sourceDefId) return true;
    // 濠碘槅鍋€閸嬫捇鏌＄仦璇插姎闁绘柡鍋撻梺闈╃畵椤ｏ妇绮崒鐐村剭?ongoing 闁荤偞绋戦懟顖涙叏閳哄懎纭€?
    if (base.ongoingActions.some(o => o.defId === sourceDefId)) return true;
    // 濠碘槅鍋€閸嬫捇鏌＄仦璇插姎闁绘柡鍋撻梺闈╃畵椤ｏ妇绮崒鐐村剭闁告洦鍨遍鐟懊?
    if (base.minions.some(m => m.defId === sourceDefId)) return true;
    for (const minion of base.minions) {
        if (minion.attachedActions?.some(action => action.defId === sourceDefId)) {
            return true;
        }
    }
    if ((state.titans ?? []).some(titan =>
        titan.defId === sourceDefId
        && titan.location.zone === 'base'
        && titan.location.baseIndex === baseIndex,
    )) {
        return true;
    }
    return false;
}

// ============================================================================
// 闂佺硶鏅涢幖顐耿閹绢喗鈷旈柟閭﹀墮閻撴垵菐閸ワ絽澧插ù鐓庢嚇瀵濡烽…鎴濇畱闂佹寧绋戝﹢绂?闁诲繒鍋涢崐閿嬬箾閸ヮ剚鍋ㄦい顓熷笧缁€?
// ============================================================================

/** 闂佺硶鏅涢幖顐耿閹绢喗鈷旈柟閭﹀墮閻撴垵菐閸ワ絽澧插ù鐓庢嚇閺佸秹宕奸姀鈩冩婵?UI 闂佸搫瀚晶浠嬪Φ濮樿埖鏅?*/
export interface BaseRestrictionInfo {
    /** 闂傚倸瀚崝鏇㈠春濡ゅ啰灏甸悹鍥皺閳?*/
    type: 'blocked_faction' | 'blocked_action';
    /** 闂佸搫瀚晶浠嬪Φ濮樿泛妫橀柛銉ｅ妽閹烽亶鏌ㄥ☉妯煎妞も敪鍏犳椽宕滆閸忓洭鏌涘顒傂ょ悮銊╂煥?*/
    displayText: string;
    /** 闂佸搫顦崕鑼姳椤曗偓瀹曪繝鏁嶉崟顐澓 defId */
    sourceDefId: string;
}

/**
 * 闂佸吋鍎抽崲鑼躲亹閸ヮ剙鏄ラ柛婵嗗閸曟儳鈽夐幘绛瑰姛婵炲牊鍨块獮宥夊焵椤掑嫬瀚夊鑸靛姈椤庢瑩鏌涢幒鎾存瀯濞ｅ洤锕獮渚€顢涢妶鍥╊槱闂佹椿娼块崝瀣姳?UI 闂佸搫瀚晶浠嬪Φ濮樿埖鏅?
 *
 * @param state 閻熸粎澧楅幐鍛婃櫠閻樺眰鈧帡宕ㄦ繝鍌滀簽闂佺粯顭堥崺鏍焵?
 * @param baseIndex 闂佺硶鏅涢幖顐耿鐎靛憡顫曢柕蹇曞Х缁?
 * @returns 闂傚倸瀚崝鏇㈠春濡や胶鈹嶉柍鈺佸暕缁辨牠鏌℃担鐟邦棆缂?
 */
export function getBaseRestrictions(state: SmashUpCore, baseIndex: number): BaseRestrictionInfo[] {
    const base = state.bases[baseIndex];
    if (!base) return [];

    const restrictions: BaseRestrictionInfo[] = [];

    // 濠碘槅鍋€閸嬫捇鏌?Block the Path闂佹寧绋戦悧鍡涙儍濠靛牊宕夋い鏍ュ€楃粈?
    const blockAction = base.ongoingActions.find(o => matchesDefId(o.defId, 'trickster_block_the_path'));
    if (blockAction) {
        const blockedFaction = blockAction.metadata?.blockedFaction as string | undefined;
        if (blockedFaction) {
            // 闁诲海鏁搁崢褔宕?FACTION_DISPLAY_NAMES 婵炴潙鍚嬪畝鎼佸焵椤掑倸校闁搞劍鑹鹃銉╊敂閸℃鐣炬繛鎾寸缁诲棛绮嬮崱娑欐櫖閻忕偞鍎抽。鎻捗归悩顔煎姤缂佺粯鐗犻弻灞界暆閳ь剙煤閸ф绠抽柕澶堝€曢埢蹇涙煟?factionId
            // UI 闁诲繒鍋涢崐椋庢娴煎瓨鐒绘慨妯虹－缁?i18n 闂?FACTION_DISPLAY_NAMES 闁哄鍎愰崜姘暦閺屻儱鍙婇柛鎾椾椒绮甸梺鍛婅壘缁夋儼鈪?
            restrictions.push({
                type: 'blocked_faction',
                displayText: blockedFaction,
                sourceDefId: blockAction.defId,
            });
        }
    }

    // 闂佸搫鐗滄禍婵嗩焽閻㈢鐭楁い鏍ㄧ懁缁ㄤ即鏌涢敂鍝勫缂佺粯鐗犻弻宀€浠﹂幆褎缍夐梺鍛婃⒒婵挳宕ｉ悙顒傤浄闁哄稁鍘介娆撴煕閹烘垵顣抽悶姘煎亰瀹曞湱鈧絽澧庣粈鍕攽?Ornate Dome 缂備礁鍊烽悞锕傤敆濞戙垹绠ラ柟鎹愵嚃閺€浠嬫煕閺傝濡肩€规洟浜堕弫?
    // const domeAction = base.ongoingActions.find(o => o.defId === 'steampunk_ornate_dome');
    // if (domeAction) {
    //     restrictions.push({
    //         type: 'blocked_action',
    //         displayText: 'action',
    //         sourceDefId: 'steampunk_ornate_dome',
    //     });
    // }

    return restrictions;
}

