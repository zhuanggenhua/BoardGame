/**
 * 澶ф潃鍥涙柟 - 璇℃湳甯堟淳绯昏兘鍔?
 *
 * 涓婚锛氶櫡闃便€佸共鎵板鎵嬨€佹秷鐏殢浠?
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    destroyMinion,
    getMinionPower,
    buildMinionTargetOptions,
    resolveOrPrompt,
    buildAbilityFeedback,
    createSkipOption,
    buildStandardDrawEvents,
    getTitansOnBase,
} from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type {
    CardInstance,
    CardsDiscardedEvent,
    DeckReshuffledEvent,
    OngoingDetachedEvent,
    SmashUpEvent,
    LimitModifiedEvent,
    TriggerQueuedEvent,
    PowerCounterAddedEvent,
    BreakpointModifiedEvent,
} from '../domain/types';
import type { MinionCardDef, PlayerTurnRestrictionType, SmashUpCore } from '../domain/types';
import { matchesDefId } from '../domain/utils';
import { registerInterceptor, registerProtection, registerRestriction, registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext, TriggerResult } from '../domain/ongoingEffects';
import { getCardDef, getBaseDef } from '../data/cards';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import type { MatchState } from '../../../engine/types';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { FACTION_DISPLAY_NAMES } from '../domain/ids';
import { getOpponentLabel } from '../domain/utils';

type PayThePiperChoiceValue = { cardUid: string; defId: string };
type TricksterMarkOfSleepPodChoiceValue = { restrictionType: PlayerTurnRestrictionType };
type TricksterMarkOfSleepPodContext = {
    sourcePlayerId: string;
    targetPlayerId: string;
    remainingTargetPlayerIds: string[];
};

function buildPayThePiperDiscardOptions(core: SmashUpCore, playerId: string) {
    const player = core.players[playerId];
    if (!player) return [];
    return player.hand.map((card) => {
        const def = getCardDef(card.defId);
        return {
            id: `card-${card.uid}`,
            label: def?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            _source: 'hand' as const,
            displayMode: 'card' as const,
        };
    });
}

function queuePayThePiperDiscardChoice(
    matchState: MatchState<SmashUpCore>,
    playerId: string,
    now: number,
): MatchState<SmashUpCore> {
    const interaction = createSimpleChoice<PayThePiperChoiceValue>(
        `trickster_pay_the_piper_${playerId}_${now}`,
        playerId,
        '留下买路财：选择 1 张手牌弃掉',
        buildPayThePiperDiscardOptions(matchState.core, playerId),
        { sourceId: 'trickster_pay_the_piper', targetType: 'hand' },
    );
    (interaction.data as any).optionsGenerator = (state: MatchState<SmashUpCore>) =>
        buildPayThePiperDiscardOptions(state.core, playerId);
    return queueInteraction(matchState, interaction);
}

function createTricksterMarkOfSleepPodInteraction(
    sourcePlayerId: string,
    targetPlayerId: string,
    remainingTargetPlayerIds: string[],
    now: number,
) {
    const interaction = createSimpleChoice<TricksterMarkOfSleepPodChoiceValue>(
        `trickster_mark_of_sleep_pod_${targetPlayerId}_${now}`,
        sourcePlayerId,
        '睡眠印记：为' + getOpponentLabel(targetPlayerId) + '选择一项',
        [
            { id: 'no-action', label: '不能打出战术', value: { restrictionType: 'play_action' } },
            { id: 'no-move', label: '不能移动随从', value: { restrictionType: 'move_minion' } },
        ],
        { sourceId: 'trickster_mark_of_sleep_pod', targetType: 'generic' },
    );
    (interaction.data as any).continuationContext = {
        sourcePlayerId,
        targetPlayerId,
        remainingTargetPlayerIds,
    } satisfies TricksterMarkOfSleepPodContext;
    return interaction;
}

/** 渚忓剴 onPlay锛氭秷鐏姏閲忎綆浜庡繁鏂归殢浠庢暟閲忕殑闅忎粠 */
function tricksterGnome(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const myMinionCount = base.minions.filter(m => m.controller === ctx.playerId).length + 1;
    const targets = base.minions.filter(
        m => m.uid !== ctx.cardUid && getMinionPower(ctx.state, m, ctx.baseIndex) < myMinionCount
    );
    const options = targets.map(t => {
        const def = getCardDef(t.defId) as MinionCardDef | undefined;
        const name = def?.name ?? t.defId;
        const power = getMinionPower(ctx.state, t, ctx.baseIndex);
        return { uid: t.uid, defId: t.defId, baseIndex: ctx.baseIndex, label: name + ' (力量 ' + power + ')' };
    });
    // "浣犲彲浠?鏁堟灉锛氭坊鍔犺烦杩囬€夐」
    const minionOptions = buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' });
    minionOptions.push(createSkipOption());
    return resolveOrPrompt(ctx, minionOptions, {
        id: 'trickster_gnome',
        title: '閫夋嫨瑕佹秷鐏殑闅忎粠锛堝姏閲忎綆浜庡繁鏂归殢浠庢暟閲忥級锛屾垨璺宠繃',
        sourceId: 'trickster_gnome',
        targetType: 'minion',
        autoResolveIfSingle: false,
    }, (value) => {
        // 妫€鏌?skip 鏍囪
        if ((value as any).skip) return { events: [] };
        
        const { minionUid } = value as { minionUid?: string };
        if (!minionUid) return { events: [] };
        
        const target = targets.find(t => t.uid === minionUid);
        if (!target) return { events: [] };
        return { events: [destroyMinion(target.uid, target.defId, ctx.baseIndex, target.owner, undefined, 'trickster_gnome', ctx.now)] };
    });
}

type TricksterGnomePodPending = {
    gnomeUid: string;
    controller: string;
    baseIndex: number;
};

function countTitansOnBase(state: SmashUpCore, baseIndex: number): number {
    return getTitansOnBase(state, baseIndex).length;
}

function buildTricksterGnomePodOptions(
    state: SmashUpCore,
    baseIndex: number,
    sourcePlayerId: string,
    gnomeUid: string,
) {
    const base = state.bases[baseIndex];
    if (!base) return [createSkipOption()];

    const destroyThreshold = base.minions.length + countTitansOnBase(state, baseIndex);
    const targets = base.minions.filter(
        m => m.uid !== gnomeUid && getMinionPower(state, m, baseIndex) < destroyThreshold,
    );
    const options = targets.map(target => {
        const def = getCardDef(target.defId) as MinionCardDef | undefined;
        const power = getMinionPower(state, target, baseIndex);
        return {
            uid: target.uid,
            defId: target.defId,
            baseIndex,
            label: (def?.name ?? target.defId) + ' (力量 ' + power + ')',
        };
    });

    const minionOptions = buildMinionTargetOptions(options, {
        state,
        sourcePlayerId,
        effectType: 'destroy',
    });
    minionOptions.push(createSkipOption());
    return minionOptions;
}

function createTricksterGnomePodInteraction(
    state: SmashUpCore,
    pending: TricksterGnomePodPending,
    remaining: TricksterGnomePodPending[],
    now: number,
) {
    const base = state.bases[pending.baseIndex];
    if (!base?.minions.some(m => m.uid === pending.gnomeUid && m.defId === 'trickster_gnome_pod')) {
        return null;
    }

    const options = buildTricksterGnomePodOptions(state, pending.baseIndex, pending.controller, pending.gnomeUid);
    if (options.length === 1 && (options[0].value as any)?.skip) {
        return null;
    }

    const interaction = createSimpleChoice(
        `trickster_gnome_pod_${pending.gnomeUid}_${now}`,
        pending.controller,
        '侏儒：你可以消灭此基地一个力量低于这里随从与泰坦总数的随从',
        options as any[],
        { sourceId: 'trickster_gnome_pod', targetType: 'minion', autoResolveIfSingle: false },
    );
    (interaction.data as any).continuationContext = {
        baseIndex: pending.baseIndex,
        gnomeUid: pending.gnomeUid,
        controller: pending.controller,
        remaining,
    };
    (interaction.data as any).optionsGenerator = (nextState: MatchState<SmashUpCore>, data: any) => {
        const continuation = data?.continuationContext as TricksterGnomePodPending & { remaining?: TricksterGnomePodPending[] } | undefined;
        if (!continuation) return [createSkipOption()];
        const nextBase = nextState.core.bases[continuation.baseIndex];
        if (!nextBase?.minions.some(m => m.uid === continuation.gnomeUid && m.defId === 'trickster_gnome_pod')) {
            return [createSkipOption()];
        }
        return buildTricksterGnomePodOptions(
            nextState.core,
            continuation.baseIndex,
            continuation.controller,
            continuation.gnomeUid,
        );
    };
    return interaction;
}

function queueNextTricksterGnomePodInteraction(
    matchState: MatchState<SmashUpCore>,
    pendingList: TricksterGnomePodPending[],
    now: number,
): MatchState<SmashUpCore> | undefined {
    for (let index = 0; index < pendingList.length; index++) {
        const pending = pendingList[index];
        const remaining = pendingList.slice(index + 1);
        const interaction = createTricksterGnomePodInteraction(matchState.core, pending, remaining, now);
        if (!interaction) continue;
        return queueInteraction(matchState, interaction);
    }
    return undefined;
}

/**
 * 渚忓剴 POD beforeScoring锛?
 * 鍦ㄥ熀鍦拌鍒嗗墠锛屼綘鍙互娑堢伃姝ゅ熀鍦颁竴涓姏閲忎綆浜庤繖閲岄殢浠庡拰娉板潶鎬绘暟鐨勯殢浠庛€?
 * 杩欐槸鍦轰笂鑷姩瑙﹀彂鐨?beforeScoring 浜や簰锛屼笉搴旂户鎵垮熀纭€鐗堢殑 onPlay 閫昏緫銆?
 */
function tricksterGnomePodBeforeScoring(ctx: TriggerContext): TriggerResult {
    if (ctx.baseIndex === undefined || !ctx.matchState) return { events: [] };

    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };

    const pending = base.minions
        .filter(m => m.defId === 'trickster_gnome_pod')
        .map(m => ({ gnomeUid: m.uid, controller: m.controller, baseIndex: ctx.baseIndex! }));
    if (pending.length === 0) return { events: [] };

    const nextState = queueNextTricksterGnomePodInteraction(ctx.matchState, pending, ctx.now);
    return nextState ? { events: [], matchState: nextState } : { events: [] };
}

function tricksterGnomePodOnPlay(): AbilityResult {
    // POD 鐗堜緩鍎掔殑鐪熷疄鏁堟灉鍦?beforeScoring trigger 涓鐞嗐€?
    // 杩欓噷鏄惧紡娉ㄥ唽绌?onPlay锛岄樆姝㈣嚜鍔ㄥ埆鍚嶆妸鍩虹鐗堝叆鍦烘晥鏋滈敊璇鍒惰繃鏉ャ€?
    return { events: [] };
}

/** 甯﹁蛋瀹濈墿 onPlay锛氭瘡涓叾浠栫帺瀹堕殢鏈哄純涓ゅ紶鎵嬬墝 */
function tricksterTakeTheShinies(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const player = ctx.state.players[pid];
        if (player.hand.length === 0) continue;

        // 闅忔満閫夋嫨鑷冲2?
        const handCopy = [...player.hand];
        const discardUids: string[] = [];
        const count = Math.min(2, handCopy.length);
        for (let i = 0; i < count; i++) {
            const idx = Math.floor(ctx.random.random() * handCopy.length);
            discardUids.push(handCopy[idx].uid);
            handCopy.splice(idx, 1);
        }

        const evt: CardsDiscardedEvent = {
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId: pid, cardUids: discardUids },
            timestamp: ctx.now,
        };
        events.push(evt);
    }
    return { events };
}

/** 骞绘兂鐮寸 onPlay锛氭秷鐏竴涓凡鎵撳嚭鍒伴殢浠庢垨鍩哄湴涓婄殑琛屽姩?*/
function tricksterDisenchant(ctx: AbilityContext): AbilityResult {
    // 鏀堕泦鎵€鏈夊凡鎵撳嚭鐨勬寔缁鍔ㄥ崱锛堟弿杩版棤"瀵规墜"闄愬畾锛屽寘鍚嚜宸辩殑锛?
    const targets: { uid: string; defId: string; ownerId: string; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        for (const ongoing of base.ongoingActions) {
            const def = getCardDef(ongoing.defId);
            const name = def?.name ?? ongoing.defId;
            targets.push({ uid: ongoing.uid, defId: ongoing.defId, ownerId: ongoing.ownerId, label: `${name} (鍩哄湴琛屽姩)` });
        }
        for (const m of base.minions) {
            for (const attached of m.attachedActions) {
                const def = getCardDef(attached.defId);
                const name = def?.name ?? attached.defId;
                targets.push({ uid: attached.uid, defId: attached.defId, ownerId: attached.ownerId, label: `${name} (闄勭潃琛屽姩)` });
            }
        }
    }
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const options = targets.map((t, i) => ({
        id: `action-${i}`, label: t.label, value: { cardUid: t.uid, defId: t.defId, ownerId: t.ownerId }, _source: 'ongoing' as const,
        displayMode: 'card' as const,
    }));
    const interaction = createSimpleChoice(
        `trickster_disenchant_${ctx.now}`, ctx.playerId,
        '选择要消灭的行动牌', options as any[],
        { sourceId: 'trickster_disenchant', targetType: 'ongoing' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 闅愯斀杩烽浘 onPlay锛氭墦鍑哄綋鍥炲悎缁欎簣棰濆闅忎粠锛堜笌澶ф硶甯堝悓鐞嗭紝ongoing 鑳藉姏鍦ㄨ繘鍏ュ満涓婃椂鐢熸晥锛?*/
function tricksterEnshroudingMistOnPlay(ctx: AbilityContext): AbilityResult {
    // 鎵撳嚭褰撳洖鍚堢珛鍗崇粰浜堥澶栭殢浠庯紙闄愬畾鍒版鍩哄湴锛?
    return {
        events: [{
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: {
                playerId: ctx.playerId,
                limitType: 'minion' as const,
                delta: 1,
                reason: 'trickster_enshrouding_mist',
                restrictToBase: ctx.baseIndex,
            },
            timestamp: ctx.now,
        } as LimitModifiedEvent],
    };
}

/** 注册诡术师派系所有能力 */
export function registerTricksterAbilities(): void {
    registerAbility('trickster_gnome', 'onPlay', tricksterGnome);
    registerAbility('trickster_gnome_pod', 'onPlay', tricksterGnomePodOnPlay);
    // 甯﹁蛋瀹濈墿锛堣鍔ㄥ崱锛夛細姣忎釜瀵规墜闅忔満寮冧袱寮犳墜鐗?
    registerAbility('trickster_take_the_shinies', 'onPlay', tricksterTakeTheShinies);
    // 骞绘兂鐮寸锛堣鍔ㄥ崱锛夛細娑堢伃涓€涓凡鎵撳嚭鐨勮鍔ㄥ崱
    registerAbility('trickster_disenchant', 'onPlay', tricksterDisenchant);
    // 灏忓绮?onDestroy锛氳娑堢伃鍚庢娊1寮犵墝 + 瀵规墜闅忔満?寮犵墝
    registerAbility('trickster_gremlin', 'onDestroy', tricksterGremlinOnDestroy);
    // 娌夌潯鍗拌锛堣鍔ㄥ崱锛夛細瀵规墜涓嬪洖鍚堜笉鑳芥墦琛屽姩
    registerAbility('trickster_mark_of_sleep', 'onPlay', tricksterMarkOfSleep);
    registerAbility('trickster_mark_of_sleep_pod', 'onPlay', tricksterMarkOfSleepPod);
    // 灏佽矾锛坥ngoing锛夛細鎵撳嚭鏃堕€夋嫨涓€涓淳绯?
    registerAbility('trickster_block_the_path', 'onPlay', tricksterBlockThePath);
    // 闅愯斀杩烽浘锛坥ngoing锛夛細鎵撳嚭褰撳洖鍚堜篃缁欎簣棰濆闅忎粠锛堜笌澶ф硶甯堝悓鐞嗭級
    registerAbility('trickster_enshrouding_mist', 'onPlay', tricksterEnshroudingMistOnPlay);

    // 娉ㄥ唽 ongoing 鎷︽埅?
    registerTricksterOngoingEffects();
    registerTricksterPodAbilities();
}

function tricksterEnshroudingMistPodTalent(ctx: AbilityContext): AbilityResult {
    return {
        events: [{
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: {
                playerId: ctx.playerId,
                limitType: 'minion' as const,
                delta: 1,
                reason: 'trickster_enshrouding_mist_pod',
                restrictToBase: ctx.baseIndex,
            },
            timestamp: ctx.now,
        } as LimitModifiedEvent],
    };
}

function tricksterGnomePodSpecial(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const myCount = base.minions.filter(m => m.controller === ctx.playerId).length;
    if (myCount <= 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };

    const targets = base.minions.filter(m => getMinionPower(ctx.state, m, ctx.baseIndex) < myCount);
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };

    const options = targets.map(t => {
        const def = getCardDef(t.defId) as MinionCardDef | undefined;
        const name = def?.name ?? t.defId;
        const power = getMinionPower(ctx.state, t, ctx.baseIndex);
        return { uid: t.uid, defId: t.defId, baseIndex: ctx.baseIndex, label: name + ' (力量 ' + power + ')' };
    });
    const minionOptions = buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' });
    minionOptions.push(createSkipOption());

    return resolveOrPrompt(ctx, minionOptions, {
        id: 'trickster_gnome_pod',
        title: '渚忓剴锛氫綘鍙互娑堢伃杩欓噷涓€涓姏閲忎綆浜庝綘鍦ㄦ鍩哄湴闅忎粠鏁伴噺鐨勯殢浠庯紙鎴栬烦杩囷級',
        sourceId: 'trickster_gnome_pod',
        targetType: 'minion',
        autoResolveIfSingle: false,
    }, (value) => {
        if ((value as any).skip) return { events: [] };
        const { minionUid } = value as { minionUid?: string };
        if (!minionUid) return { events: [] };
        const target = targets.find(m => m.uid === minionUid);
        if (!target) return { events: [] };
        return { events: [destroyMinion(target.uid, target.defId, ctx.baseIndex, target.owner, ctx.playerId, 'trickster_gnome_pod', ctx.now)] };
    });
}

function registerTricksterPodAbilities(): void {
    registerAbility('trickster_take_the_shinies_pod', 'onPlay', tricksterTakeTheShinies);
    registerAbility('trickster_mark_of_sleep_pod', 'onPlay', tricksterMarkOfSleepPod);
    registerAbility('trickster_pixie_pod', 'onPlay', tricksterPixiePodOnPlay);
    registerAbility('trickster_enshrouding_mist_pod', 'talent', tricksterEnshroudingMistPodTalent);
    registerAbility('trickster_hideout_pod', 'talent', tricksterHideoutPodTalent);
    registerAbility('trickster_gnome_pod', 'onPlay', tricksterGnomePodOnPlay);
    registerAbility('trickster_gremlin_pod', 'onDestroy', () => ({ events: [] }));
    registerTricksterPodOngoingEffects();
    registerTrigger('trickster_gnome_pod', 'beforeScoring', tricksterGnomePodBeforeScoring);
}

function tricksterHideoutPodTalent(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const owner = ctx.state.players[ctx.playerId];
    if (!owner) return { events: [] };

    // 只允许与“打出到基地上”的持续战术交换（subtype=ongoing 且 ongoingTarget='base'）
    const isPlayOnBaseOngoing = (defId: string) => {
        const def = getCardDef(defId);
        return def?.type === 'action' && def.subtype === 'ongoing' && ((def.ongoingTarget ?? 'base') === 'base');
    };

    const handCandidates = owner.hand.filter(c => c.type === 'action' && isPlayOnBaseOngoing(c.defId));
    const deckCandidates = owner.deck.filter(c => c.type === 'action' && isPlayOnBaseOngoing(c.defId));

    if (handCandidates.length === 0 && deckCandidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
    }

    const options = [
        ...handCandidates.map((c, i) => {
            const def = getCardDef(c.defId);
            const name = def?.name ?? c.defId;
            return {
                id: `hand-${i}`,
                label: `手牌：${name}`,
                value: { zone: 'hand' as const, cardUid: c.uid, defId: c.defId },
                _source: 'hand' as const,
                displayMode: 'card' as const,
            };
        }),
        ...deckCandidates.map((c, i) => {
            const def = getCardDef(c.defId);
            const name = def?.name ?? c.defId;
            return {
                id: `deck-${i}`,
                label: `牌库：${name}`,
                value: { zone: 'deck' as const, cardUid: c.uid, defId: c.defId },
                _source: 'deck' as const,
                displayMode: 'card' as const,
            };
        }),
        createSkipOption() as any,
    ];

    const interaction = createSimpleChoice(
        `trickster_hideout_pod_swap_${ctx.now}`,
        ctx.playerId,
        '藏身处：选择要交换进来的基地持续战术（或跳过）',
        options as any[],
        { sourceId: 'trickster_hideout_pod_swap', targetType: 'generic' },
    );
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: { ...interaction.data, continuationContext: { baseIndex: ctx.baseIndex, hideoutUid: ctx.cardUid } } as any,
        }),
    };
}

/** 娉ㄥ唽璇℃湳甯堟淳绯荤殑浜や簰瑙ｅ喅澶勭悊鍑芥暟 */
export function registerTricksterInteractionHandlers(): void {
    // 渚忓剴锛氶€夋嫨鐩爣鍚庢秷鐏紙鏀寔璺宠繃锛?
    registerInteractionHandler('trickster_gnome', (state, playerId, value, _iData, _random, timestamp) => {
        // 缁熶竴妫€鏌?skip 鏍囪
        if ((value as any).skip) return { state, events: [] };
        
        const { minionUid, baseIndex } = value as { minionUid?: string; baseIndex?: number };
        if (!minionUid || baseIndex === undefined) return { state, events: [] };
        
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        return { state, events: [destroyMinion(target.uid, target.defId, baseIndex, target.owner, playerId, 'trickster_gnome', timestamp)] };
    });

    registerInteractionHandler('trickster_gnome_pod', (state, playerId, value, iData, _random, timestamp) => {
        const continuation = iData?.continuationContext as {
            baseIndex?: number;
            gnomeUid?: string;
            remaining?: TricksterGnomePodPending[];
        } | undefined;
        const baseIndex = (value as { baseIndex?: number } | undefined)?.baseIndex ?? continuation?.baseIndex;
        const selectedUid = (value as { minionUid?: string } | undefined)?.minionUid;
        const currentGnomeUid = continuation?.gnomeUid;
        const events: SmashUpEvent[] = [];

        if (!(value as any)?.skip && selectedUid && baseIndex !== undefined) {
            const base = state.core.bases[baseIndex];
            const target = base?.minions.find(m => m.uid === selectedUid);
            if (target) {
                events.push(destroyMinion(target.uid, target.defId, baseIndex, target.owner, playerId, 'trickster_gnome_pod', timestamp));
            }
        }

        const remaining = (continuation?.remaining ?? []).filter(entry => entry.gnomeUid !== currentGnomeUid);
        const nextState = queueNextTricksterGnomePodInteraction(state, remaining, timestamp);
        return { state: nextState ?? state, events };
    });

    // 骞绘兂鐮寸锛氶€夋嫨琛屽姩鍗″悗娑堢伃
    registerInteractionHandler('trickster_disenchant', (state, _playerId, value, _iData, _random, timestamp) => {
        const { cardUid: ongoingUid, defId, ownerId } = value as { cardUid: string; defId: string; ownerId: string };
        return { state, events: [{ type: SU_EVENTS.ONGOING_DETACHED, payload: { cardUid: ongoingUid, defId, ownerId, reason: 'trickster_disenchant' }, timestamp }] };
    });

    // 娌夌潯鍗拌锛氶€夋嫨瀵规墜鍚庢爣璁帮紙涓嬪洖鍚堢敓鏁堬級
    registerInteractionHandler('trickster_mark_of_sleep', (state, _playerId, value, _iData, _random, _timestamp) => {
        // 妫€鏌ュ彇娑堟爣璁?
        if ((value as any).__cancel__) return { state, events: [] };
        
        const { pid } = value as { pid: string };
        // 娣诲姞娌夌潯鏍囪锛屽湪瀵规墜鐨勪笅涓€涓洖鍚堝紑濮嬫椂鐢熸晥
        const currentMarked = state.core.sleepMarkedPlayers ?? [];
        if (currentMarked.includes(pid)) return { state, events: [] };
        return {
            state: { ...state, core: { ...state.core, sleepMarkedPlayers: [...currentMarked, pid] } },
            events: [],
        };
    });

    registerInteractionHandler('trickster_mark_of_sleep_pod', (state, _playerId, value, iData, _random, timestamp) => {
        const continuation = (iData as any)?.continuationContext as TricksterMarkOfSleepPodContext | undefined;
        const restrictionType = (value as TricksterMarkOfSleepPodChoiceValue | undefined)?.restrictionType;
        if (!continuation?.targetPlayerId || !continuation.sourcePlayerId || !restrictionType) {
            return { state, events: [] };
        }

        const nextRestrictions = [
            ...(state.core.playerRestrictionsUntilTurnStart ?? []).filter(entry => !(
                entry.sourcePlayerId === continuation.sourcePlayerId
                && entry.targetPlayerId === continuation.targetPlayerId
                && entry.restrictionType === restrictionType
            )),
            {
                sourcePlayerId: continuation.sourcePlayerId,
                targetPlayerId: continuation.targetPlayerId,
                restrictionType,
            },
        ];

        let nextState: MatchState<SmashUpCore> = {
            ...state,
            core: {
                ...state.core,
                playerRestrictionsUntilTurnStart: nextRestrictions,
            },
        };

        const [nextTargetPlayerId, ...remainingTargetPlayerIds] = continuation.remainingTargetPlayerIds;
        if (nextTargetPlayerId) {
            nextState = queueInteraction(
                nextState,
                createTricksterMarkOfSleepPodInteraction(
                    continuation.sourcePlayerId,
                    nextTargetPlayerId,
                    remainingTargetPlayerIds,
                    timestamp,
                ),
            );
        }

        return { state: nextState, events: [] };
    });

    // 灏佽矾锛氶€夋嫨娲剧郴鍚庯紝灏嗘淳绯讳俊鎭瓨鍏?ongoing 鐨?metadata
    registerInteractionHandler('trickster_block_the_path', (state, _playerId, value, iData, _random, _timestamp) => {
        // 妫€鏌ュ彇娑堟爣璁?
        if ((value as any).__cancel__) return { state, events: [] };
        
        const { factionId } = value as { factionId: string };
        const ctx = (iData as any)?.continuationContext as { cardUid: string; baseIndex: number };
        if (!ctx) return undefined;
        // 鎵惧埌鍒氶檮鐫€鐨?ongoing 骞舵洿鏂?metadata
        const newBases = state.core.bases.map((base, i) => {
            if (i !== ctx.baseIndex) return base;
            return {
                ...base,
                ongoingActions: base.ongoingActions.map(o => {
                    if (o.uid !== ctx.cardUid) return o;
                    return { ...o, metadata: { blockedFaction: factionId } };
                }),
            };
        });
        return { state: { ...state, core: { ...state.core, bases: newBases } }, events: [] };
    });

    // Pixie（战术）：先消灭一张已打出的战术，再选择 1-2 个己方随从分配两枚 +1 指示物
    registerInteractionHandler('trickster_pixie_pod_action_destroy', (state, playerId, value, _iData, random, timestamp) => {
        if ((value as any).__cancel__) return { state, events: [] };
        const { cardUid, defId, ownerId } = value as { cardUid: string; defId: string; ownerId: string };

        const myMinions: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
        for (let bi = 0; bi < state.core.bases.length; bi++) {
            const base = state.core.bases[bi];
            for (const m of base.minions) {
                if (m.controller !== playerId) continue;
                const def = getCardDef(m.defId) as MinionCardDef | undefined;
                const name = def?.name ?? m.defId;
                const power = getMinionPower(state.core, m, bi);
                myMinions.push({ uid: m.uid, defId: m.defId, baseIndex: bi, label: name + ' (力量 ' + power + ')' });
            }
        }
        if (myMinions.length === 0) {
            return {
                state,
                events: [{
                    type: SU_EVENTS.ONGOING_DETACHED,
                    payload: { cardUid, defId, ownerId, reason: 'trickster_pixie_pod_action' },
                    timestamp,
                } as OngoingDetachedEvent],
            };
        }

        const options = myMinions.map((m, i) => ({
            id: `minion-${i}`,
            label: m.label,
            value: { minionUid: m.uid, minionDefId: m.defId, baseIndex: m.baseIndex },
            _source: 'field' as const,
            displayMode: 'card' as const,
        }));

        const next = createSimpleChoice(
            `trickster_pixie_pod_action_counters_${timestamp}`,
            playerId,
            '小精灵（战术）：选择 1-2 个己方随从放置两枚 +1 指示物',
            options as any[],
            { sourceId: 'trickster_pixie_pod_action_counters', targetType: 'minion' },
            undefined,
            { min: 1, max: Math.min(2, options.length) },
        );
        return {
            state: queueInteraction(state, {
                ...next,
                data: { ...next.data, continuationContext: { destroy: { cardUid, defId, ownerId } } } as any,
            }),
            events: [{
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: { cardUid, defId, ownerId, reason: 'trickster_pixie_pod_action' },
                timestamp,
            } as OngoingDetachedEvent],
        };
    });

    registerInteractionHandler('trickster_pixie_pod_action_counters', (state, playerId, value, _iData, _random, timestamp) => {
        const selections = (Array.isArray(value) ? value : [value]) as { minionUid?: string; baseIndex?: number }[];
        const valid = selections.filter(s => s.minionUid && s.baseIndex !== undefined) as { minionUid: string; baseIndex: number }[];
        if (valid.length === 0) return { state, events: [] };

        const events: SmashUpEvent[] = [];
        if (valid.length === 1) {
            events.push({
                type: SU_EVENTS.POWER_COUNTER_ADDED,
                payload: { minionUid: valid[0].minionUid, baseIndex: valid[0].baseIndex, amount: 2, reason: 'trickster_pixie_pod_action' },
                timestamp,
            } as PowerCounterAddedEvent);
        } else {
            for (const s of valid.slice(0, 2)) {
                events.push({
                    type: SU_EVENTS.POWER_COUNTER_ADDED,
                    payload: { minionUid: s.minionUid, baseIndex: s.baseIndex, amount: 1, reason: 'trickster_pixie_pod_action' },
                    timestamp,
                } as PowerCounterAddedEvent);
            }
        }
        return { state, events };
    });

    registerInteractionHandler('trickster_pixie_pod_minion', (state, playerId, value, _iData, _random, timestamp) => {
        const selections = (Array.isArray(value) ? value : [value]) as { minionUid?: string; baseIndex?: number }[];
        const valid = selections.filter(s => s.minionUid && s.baseIndex !== undefined) as { minionUid: string; baseIndex: number }[];
        if (valid.length === 0) return { state, events: [] };
        const events: SmashUpEvent[] = valid.map(s => ({
            type: SU_EVENTS.POWER_COUNTER_ADDED,
            payload: { minionUid: s.minionUid, baseIndex: s.baseIndex, amount: 1, reason: 'trickster_pixie_pod_minion' },
            timestamp,
        } as PowerCounterAddedEvent));
        return { state, events };
    });

    registerInteractionHandler('trickster_flame_trap_pod_bp', (state, _playerId, value, _iData, _random, timestamp) => {
        const yes = (value as any)?.yes === true;
        if (!yes) return { state, events: [] };
        // 閫夋嫨绐楀彛鍙細鍦ㄦ嫢鏈夎€呭洖鍚堝紑濮嬫椂鍑虹幇锛屽洜姝ょ洿鎺ュ畾浣嶈鎷ユ湁鑰呯殑绗竴寮?trap
        const baseIndex = state.core.bases.findIndex(b => b.ongoingActions.some(o => o.defId === 'trickster_flame_trap_pod'));
        if (baseIndex < 0) return { state, events: [] };
        return {
            state,
            events: [{
                type: SU_EVENTS.BREAKPOINT_MODIFIED,
                payload: { baseIndex, delta: -4, reason: 'trickster_flame_trap_pod' },
                timestamp,
            } as BreakpointModifiedEvent],
        };
    });

    registerInteractionHandler('trickster_block_the_path_pod', (state, _playerId, value, iData, _random, _timestamp) => {
        if ((value as any).__cancel__) return { state, events: [] };
        const { blocked } = value as { blocked: Record<string, string> };
        const ctx = (iData as any)?.continuationContext as { cardUid: string; baseIndex: number };
        if (!ctx) return undefined;
        const newBases = state.core.bases.map((b, i) => {
            if (i !== ctx.baseIndex) return b;
            return {
                ...b,
                ongoingActions: b.ongoingActions.map(o => {
                    if (o.uid !== ctx.cardUid) return o;
                    return { ...o, metadata: { ...(o.metadata ?? {}), blockedFactionsByPlayer: blocked } };
                }),
            };
        });
        return { state: { ...state, core: { ...state.core, bases: newBases } }, events: [] };
    });

    registerInteractionHandler('trickster_hideout_pod_swap', (state, playerId, value, iData, random, timestamp) => {
        if ((value as any).skip) return { state, events: [] };
        if ((value as any).__cancel__) return { state, events: [] };
        const { zone, cardUid, defId } = value as { zone: 'hand' | 'deck'; cardUid: string; defId: string };
        const ctx = (iData as any)?.continuationContext as { baseIndex: number; hideoutUid: string };
        if (!ctx) return undefined;

        const base = state.core.bases[ctx.baseIndex];
        if (!base) return undefined;
        const hideout = base.ongoingActions.find(o => o.uid === ctx.hideoutUid);
        if (!hideout) return undefined;

        const player = state.core.players[playerId];
        if (!player) return undefined;

        const selectedCard = (zone === 'hand' ? player.hand : player.deck)
            .find(card => card.uid === cardUid && card.defId === defId);
        const selectedDef = getCardDef(defId);
        if (
            !selectedCard
            || selectedCard.type !== 'action'
            || selectedDef?.type !== 'action'
            || selectedDef.subtype !== 'ongoing'
            || ((selectedDef.ongoingTarget ?? 'base') !== 'base')
        ) {
            return { state, events: [] };
        }

        // 1) 从手牌/牌库移除目标战术
        const fromHand = zone === 'hand' ? player.hand.filter(c => c.uid !== cardUid) : player.hand;
        const fromDeck = zone === 'deck' ? player.deck.filter(c => c.uid !== cardUid) : player.deck;

        // 2) 藏身处离开基地；从手牌换出则回手，从牌库换出则洗回牌库
        const hideoutCard: CardInstance = { uid: hideout.uid, defId: hideout.defId, type: 'action', owner: hideout.ownerId };

        // 3) 鐩爣鎴樻湳杩涘叆鍩哄湴 ongoingActions锛堜繚鎸?cardUid锛?
        const newOngoing = { uid: cardUid, defId, ownerId: playerId, talentUsed: false };

        const newBases = state.core.bases.map((b, i) => {
            if (i !== ctx.baseIndex) return b;
            return {
                ...b,
                ongoingActions: [
                    ...b.ongoingActions.filter(o => o.uid !== hideout.uid),
                    newOngoing,
                ],
            };
        });

        const nextHand = zone === 'hand' ? [...fromHand, hideoutCard] : fromHand;
        const nextDeck = zone === 'deck' ? random.shuffle([...fromDeck, hideoutCard]) : fromDeck;

        let nextState = {
            ...state,
            core: {
                ...state.core,
                bases: newBases,
                players: {
                    ...state.core.players,
                    [playerId]: {
                        ...player,
                        hand: nextHand,
                        deck: nextDeck,
                    },
                },
            },
        };

        const events: SmashUpEvent[] = [];
        if (zone === 'deck') {
            events.push({
                type: SU_EVENTS.DECK_RESHUFFLED,
                payload: { playerId, deckUids: nextDeck.map(card => card.uid) },
                timestamp,
            } as DeckReshuffledEvent);
        }

        // 4) 浜ゆ崲鍚庯細浣犲彲浠ユ秷鐏繖閲屼竴涓垬鏂楀姏鈮?鐨勯殢浠庯紙鍙€夛級
        const updatedBase = nextState.core.bases[ctx.baseIndex];
        const candidates = updatedBase.minions.filter(m => getMinionPower(nextState.core, m, ctx.baseIndex) <= 2);
        if (candidates.length === 0) return { state: nextState, events };
        const options = candidates.map((m, i) => {
            const mDef = getCardDef(m.defId) as MinionCardDef | undefined;
            const name = mDef?.name ?? m.defId;
            const power = getMinionPower(nextState.core, m, ctx.baseIndex);
            return { id: 'm-' + i, label: name + ' (战斗力 ' + power + ')', value: { minionUid: m.uid, minionDefId: m.defId, baseIndex: ctx.baseIndex }, _source: 'field' as const, displayMode: 'card' as const };
        });
        options.push(createSkipOption() as any);

        const prompt = createSimpleChoice(
            `trickster_hideout_pod_destroy_${timestamp}`,
            playerId,
            '钘忚韩澶勶細浣犲彲浠ユ秷鐏繖閲屼竴涓垬鏂楀姏鈮?鐨勯殢浠庯紙鎴栬烦杩囷級',
            options as any[],
            { sourceId: 'trickster_hideout_pod_destroy', targetType: 'minion' },
        );
        nextState = queueInteraction(nextState, prompt);
        return { state: nextState, events };
    });

    registerInteractionHandler('trickster_hideout_pod_destroy', (state, playerId, value, _iData, _random, timestamp) => {
        if ((value as any).skip) return { state, events: [] };
        const { minionUid, baseIndex } = value as { minionUid?: string; baseIndex?: number };
        if (!minionUid || baseIndex === undefined) return { state, events: [] };
        const base = state.core.bases[baseIndex];
        const target = base?.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        return {
            state,
            events: [destroyMinion(target.uid, target.defId, baseIndex, target.owner, playerId, 'trickster_hideout_pod', timestamp)],
        };
    });

    registerInteractionHandler('trickster_pay_the_piper', (state, playerId, value, _iData, _random, timestamp) => {
        const { cardUid } = value as Partial<PayThePiperChoiceValue>;
        if (!cardUid) return { state, events: [] };
        const player = state.core.players[playerId];
        if (!player?.hand.some(card => card.uid === cardUid)) return { state, events: [] };
        return {
            state,
            events: [{
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId, cardUids: [cardUid] },
                timestamp,
            }],
        };
    });
}

/** 灏忓绮?onDestroy锛氳娑堢伃鍚庢娊1寮犵墝 + 姣忎釜瀵规墜闅忔満?寮犵墝 */
function tricksterGremlinOnDestroy(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];

    // ?寮犵墝
    events.push(...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now));

    // 姣忎釜瀵规墜闅忔満?寮犵墝
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const opponent = ctx.state.players[pid];
        if (!opponent || opponent.hand.length === 0) continue;
        const idx = Math.floor(ctx.random.random() * opponent.hand.length);
        const discardUid = opponent.hand[idx].uid;
        events.push({
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId: pid, cardUids: [discardUid] },
            timestamp: ctx.now,
        } as CardsDiscardedEvent);
    }

    return { events };
}

/** 灏佽矾 onPlay锛坥ngoing锛夛細閫夋嫨涓€涓淳绯伙紝璇ユ淳绯婚殢浠庝笉鑳借鎵撳嚭鍒版鍩哄湴 */
function tricksterBlockThePath(ctx: AbilityContext): AbilityResult {
    // 鏀堕泦鍦轰笂鎵€鏈夋淳绯?
    const factionSet = new Set<string>();
    for (const base of ctx.state.bases) {
        for (const m of base.minions) {
            const def = getCardDef(m.defId);
            if (def?.faction) factionSet.add(def.faction);
        }
    }
    // 涔熶粠鎵€鏈夌帺瀹舵墜鐗屼腑鏀堕泦娲剧郴
    for (const pid of ctx.state.turnOrder) {
        const player = ctx.state.players[pid];
        for (const c of player.hand) {
            const def = getCardDef(c.defId);
            if (def?.faction) factionSet.add(def.faction);
        }
    }
    if (factionSet.size === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const options = Array.from(factionSet).map((fid, i) => ({
        id: `faction-${i}`, label: FACTION_DISPLAY_NAMES[fid] || fid, value: { factionId: fid },
    }));
    const interaction = createSimpleChoice(
        `trickster_block_the_path_${ctx.now}`, ctx.playerId,
        '封路：选择一个派系（该派系随从不能被打出到此基地）', options as any[],
        { sourceId: 'trickster_block_the_path', targetType: 'generic', autoCancelOption: true },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, { ...interaction, data: { ...interaction.data, continuationContext: { cardUid: ctx.cardUid, baseIndex: ctx.baseIndex } } }) };
}

/** 娌夌潯鍗拌 onPlay锛氶€夋嫨涓€涓鎵嬶紝鍏朵笅鍥炲悎涓嶈兘鎵撹鍔ㄥ崱 */
function tricksterMarkOfSleep(ctx: AbilityContext): AbilityResult {
    // 鍙互閫夋嫨浠讳綍鐜╁锛堝寘鎷嚜宸憋級
    const allPlayers = ctx.state.turnOrder;
    const options = allPlayers.map((pid, i) => ({
        id: `player-${i}`, 
        label: pid === ctx.playerId ? '你自己' : getOpponentLabel(pid), 
        value: { pid },
    }));
    const interaction = createSimpleChoice(
        `trickster_mark_of_sleep_${ctx.now}`, ctx.playerId,
        '选择一个玩家（其下回合不能打行动卡）', options as any[],
        { sourceId: 'trickster_mark_of_sleep', targetType: 'player', autoCancelOption: true },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 睡眠印记 POD onPlay：为每个其他玩家分别选择“不能打出战术”或“不能移动随从” */
function tricksterMarkOfSleepPod(ctx: AbilityContext): AbilityResult {
    const otherPlayers = ctx.state.turnOrder.filter(pid => pid !== ctx.playerId);
    if (otherPlayers.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const [firstTargetPlayerId, ...remainingTargetPlayerIds] = otherPlayers;
    return {
        events: [],
        matchState: queueInteraction(
            ctx.matchState,
            createTricksterMarkOfSleepPodInteraction(
                ctx.playerId,
                firstTargetPlayerId,
                remainingTargetPlayerIds,
                ctx.now,
            ),
        ),
    };
}

function tricksterPixiePodOnPlay(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };

    const isPixieMinion = base.minions.some(m => m.uid === ctx.cardUid);
    if (isPixieMinion) {
        const me = ctx.state.players[ctx.playerId];
        if (!me) return { events: [] };
        const myHand = me.hand.length;
        const hasLessOpponent = ctx.state.turnOrder
            .filter(pid => pid !== ctx.playerId)
            .some(pid => (ctx.state.players[pid]?.hand.length ?? 0) < myHand);
        if (!hasLessOpponent) {
            return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
        }

        const myMinionsHere = base.minions.filter(m => m.controller === ctx.playerId);
        if (myMinionsHere.length === 0) return { events: [] };
        const options = myMinionsHere.map((m, i) => {
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const name = def?.name ?? m.defId;
            const power = getMinionPower(ctx.state, m, ctx.baseIndex);
            return {
                id: `minion-${i}`,
                label: `${name} (力量 ${power})`,
                value: { minionUid: m.uid, minionDefId: m.defId, baseIndex: ctx.baseIndex },
                _source: 'field' as const,
                displayMode: 'card' as const,
            };
        });
        const interaction = createSimpleChoice(
            `trickster_pixie_pod_minion_${ctx.now}`,
            ctx.playerId,
            '小精灵：选择任意数量己方随从放置 +1 力量指示物（可不选）',
            options as any[],
            { sourceId: 'trickster_pixie_pod_minion', targetType: 'minion' },
            undefined,
            { min: 0, max: options.length },
        );
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }

    const targets: { uid: string; defId: string; ownerId: string; label: string }[] = [];
    for (let bi = 0; bi < ctx.state.bases.length; bi++) {
        const b = ctx.state.bases[bi];
        for (const oa of b.ongoingActions) {
            const def = getCardDef(oa.defId);
            const name = def?.name ?? oa.defId;
            targets.push({ uid: oa.uid, defId: oa.defId, ownerId: oa.ownerId, label: `${name} (基地)` });
        }
        for (const m of b.minions) {
            for (const aa of m.attachedActions) {
                const def = getCardDef(aa.defId);
                const name = def?.name ?? aa.defId;
                targets.push({ uid: aa.uid, defId: aa.defId, ownerId: aa.ownerId, label: `${name} (附着)` });
            }
        }
    }
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const options = targets.map((t, i) => ({
        id: `action-${i}`,
        label: t.label,
        value: { cardUid: t.uid, defId: t.defId, ownerId: t.ownerId },
        _source: 'ongoing' as const,
        displayMode: 'card' as const,
    }));
    const interaction = createSimpleChoice(
        `trickster_pixie_pod_action_destroy_${ctx.now}`,
        ctx.playerId,
        '小精灵（战术）：选择要消灭的已打出战术',
        options as any[],
        { sourceId: 'trickster_pixie_pod_action_destroy', targetType: 'ongoing', autoCancelOption: true },
    );
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: { ...interaction.data, continuationContext: { baseIndex: ctx.baseIndex } } as any,
        }),
    };
}
// executeMarkOfSleep 宸茬Щ闄わ紝娌夌潯鍗拌鏀逛负鏍囪妯″紡锛堝湪瀵规墜鍥炲悎寮€濮嬫椂鐢熸晥锛?

// ============================================================================
// Ongoing 鎷︽埅鍣ㄦ敞鍐?
// ============================================================================

/** 娉ㄥ唽璇℃湳甯堟淳绯荤殑 ongoing 鎷︽埅?*/
function registerTricksterOngoingEffects(): void {
    // 灏忕煯濡栵細鍏朵粬鐜╁鎵撳嚭鍔涢噺鏇翠綆鐨勯殢浠庡埌鍚屽熀鍦版椂娑堢伃璇ラ殢浠?
    registerTrigger('trickster_leprechaun', 'onMinionPlayed', (trigCtx) => {
        if (!trigCtx.triggerMinionUid || !trigCtx.triggerMinionDefId || trigCtx.baseIndex === undefined) return [];
        // 鎵惧埌 leprechaun 鎵€鍦ㄥ熀鍦?
        for (let i = 0; i < trigCtx.state.bases.length; i++) {
            const base = trigCtx.state.bases[i];
            const leprechaun = base.minions.find(m => matchesDefId(m.defId, 'trickster_leprechaun'));
            if (!leprechaun) continue;
            // 鍙湪鍚屽熀鍦拌Е?
            if (i !== trigCtx.baseIndex) continue;
            // 鍙鍏朵粬鐜╁瑙﹀彂
            if (leprechaun.controller === trigCtx.playerId) continue;
            // 妫€鏌ユ墦鍑虹殑闅忎粠鍔涢噺鏄惁浣庝簬 leprechaun
            const lepPower = getMinionPower(trigCtx.state, leprechaun, i);
            const triggerMinion = base.minions.find(m => m.uid === trigCtx.triggerMinionUid);
            if (!triggerMinion) continue;
            const trigPower = getMinionPower(trigCtx.state, triggerMinion, i);
            if (trigPower < lepPower) {
                return [{
                    type: SU_EVENTS.MINION_DESTROYED,
                    payload: {
                        minionUid: trigCtx.triggerMinionUid,
                        minionDefId: trigCtx.triggerMinionDefId,
                        fromBaseIndex: i,
                        ownerId: trigCtx.playerId,
                        reason: 'trickster_leprechaun',
                    },
                    timestamp: trigCtx.now,
                }];
            }
        }
        return [];
    });

    // 甯冩湕灏硷細琚鎵嬪崱鐗屾晥鏋滃奖鍝嶆椂锛屽鎵嬪純涓ゅ紶鐗?
    // "褰卞搷"鍖呭惈锛氭秷鐏€佺Щ鍔ㄣ€佽礋鍔涢噺淇敼銆侀檮鐫€瀵规墜琛屽姩鍗★紙瑙勫垯鏈鏄犲皠锛?
    registerTrigger('trickster_brownie', 'onMinionAffected', (trigCtx) => {
        if (trigCtx.triggerMinionDefId !== 'trickster_brownie') return [];
        const brownieOwner = trigCtx.triggerMinion?.controller;
        if (!brownieOwner || brownieOwner === trigCtx.playerId) return [];
        // 瀵规墜锛堣Е鍙戝奖鍝嶇殑鐜╁锛夊純涓ゅ紶鐗?
        const opponent = trigCtx.state.players[trigCtx.playerId];
        if (!opponent || opponent.hand.length === 0) return [];
        const discardCount = Math.min(2, opponent.hand.length);
        const discardUids: string[] = [];
        const handCopy = [...opponent.hand];
        for (let j = 0; j < discardCount; j++) {
            const idx = Math.floor(trigCtx.random.random() * handCopy.length);
            discardUids.push(handCopy[idx].uid);
            handCopy.splice(idx, 1);
        }
        return [{
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId: trigCtx.playerId, cardUids: discardUids },
            timestamp: trigCtx.now,
        }];
    });

    // 杩烽浘绗肩僵锛氭鍩哄湴涓婂彲棰濆鎵撳嚭涓€涓殢浠庡埌姝ゅ熀鍦帮紙鍥炲悎寮€濮嬫椂缁欏熀鍦伴檺瀹氶搴︼級
    registerTrigger('trickster_enshrouding_mist', 'onTurnStart', (trigCtx) => {
        for (let bi = 0; bi < trigCtx.state.bases.length; bi++) {
            const base = trigCtx.state.bases[bi];
            const mist = base.ongoingActions.find(o => matchesDefId(o.defId, 'trickster_enshrouding_mist'));
            if (!mist) continue;
            // 鍙湪鎷ユ湁鑰呯殑鍥炲悎瑙﹀彂
            if (mist.ownerId !== trigCtx.playerId) continue;
            return [{
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: {
                    playerId: mist.ownerId,
                    limitType: 'minion' as const,
                    delta: 1,
                    reason: 'trickster_enshrouding_mist',
                    restrictToBase: bi,
                },
                timestamp: trigCtx.now,
            }];
        }
        return [];
    });

    // 钘忚韩澶勶細淇濇姢鍚屽熀鍦板繁鏂归殢浠庝笉鍙楀鎵嬭鍔ㄥ崱褰卞搷锛堟秷鑰楀瀷锛氳Е鍙戝悗鑷瘉锛?
    registerProtection('trickster_hideout', 'action', (ctx) => {
        // 妫€鏌ョ洰鏍囬殢浠庢槸鍚﹂檮鐫€浜?hideout锛堥檮鐫€鍦ㄩ殢浠庝笂鐨勬儏鍐碉級
        const attachedHideout = ctx.targetMinion.attachedActions.find(a => matchesDefId(a.defId, 'trickster_hideout'));
        if (attachedHideout) {
            // 鍙繚鎶?Hideout 鎷ユ湁鑰呯殑闅忎粠锛屼笖琛屽姩鍗℃潵鑷鎵?
            return ctx.targetMinion.controller === attachedHideout.ownerId && ctx.sourcePlayerId !== attachedHideout.ownerId;
        }
        // 涔熸鏌ュ熀鍦颁笂鐨?ongoing锛堟墦鍦ㄥ熀鍦颁笂鐨勬儏鍐碉級
        const base = ctx.state.bases[ctx.targetBaseIndex];
        const baseHideout = base?.ongoingActions.find(o => matchesDefId(o.defId, 'trickster_hideout'));
        if (baseHideout) {
            // 鍙繚鎶?Hideout 鎷ユ湁鑰呯殑闅忎粠锛屼笖琛屽姩鍗℃潵鑷鎵?
            return ctx.targetMinion.controller === baseHideout.ownerId && ctx.sourcePlayerId !== baseHideout.ownerId;
        }
        return false;
    }, { consumable: true });

    // 鐏劙闄烽槺锛氬叾浠栫帺瀹舵墦鍑洪殢浠庡埌姝ゅ熀鍦版椂娑堢伃璇ラ殢浠?
    registerTrigger('trickster_flame_trap', 'onMinionPlayed', (trigCtx) => {
        if (!trigCtx.triggerMinionUid || !trigCtx.triggerMinionDefId || trigCtx.baseIndex === undefined) return [];
        for (let i = 0; i < trigCtx.state.bases.length; i++) {
            const base = trigCtx.state.bases[i];
            const trap = base.ongoingActions.find(o => matchesDefId(o.defId, 'trickster_flame_trap'));
            if (!trap || i !== trigCtx.baseIndex) continue;
            // 鍙鍏朵粬鐜╁瑙﹀彂
            if (trap.ownerId === trigCtx.playerId) continue;
            return [
                // 娑堢伃鎵撳嚭鐨勯殢浠?
                {
                    type: SU_EVENTS.MINION_DESTROYED,
                    payload: {
                        minionUid: trigCtx.triggerMinionUid,
                        minionDefId: trigCtx.triggerMinionDefId,
                        fromBaseIndex: i,
                        ownerId: trigCtx.playerId,
                        reason: 'trickster_flame_trap',
                    },
                    timestamp: trigCtx.now,
                },
                // 娑堢伃鐏劙闄烽槺鏈韩
                {
                    type: SU_EVENTS.ONGOING_DETACHED,
                    payload: {
                        cardUid: trap.uid,
                        defId: trap.defId,
                        ownerId: trap.ownerId,
                        reason: 'trickster_flame_trap_self_destruct',
                    },
                    timestamp: trigCtx.now,
                },
            ];
        }
        return [];
    });

    // 灏佽矾锛氭寚瀹氭淳绯讳笉鑳芥墦鍑洪殢浠庡埌姝ゅ熀鍦帮紙鎻忚堪鏃?瀵规墜"闄愬畾锛屽鎵€鏈夌帺瀹剁敓鏁堬級
    registerRestriction('trickster_block_the_path', 'play_minion', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return false;
        const blockAction = base.ongoingActions.find(o => matchesDefId(o.defId, 'trickster_block_the_path'));
        if (!blockAction) return false;
        // 妫€鏌ヨ闄愬埗鐨勬淳绯?
        const blockedFaction = blockAction.metadata?.blockedFaction as string | undefined;
        if (!blockedFaction) return false;
        // 妫€鏌ユ墦鍑虹殑闅忎粠鏄惁灞炰簬琚檺鍒剁殑娲剧郴
        const minionDefId = ctx.extra?.minionDefId as string | undefined;
        if (!minionDefId) return false;
        const def = getCardDef(minionDefId);
        return def?.faction === blockedFaction;
    });

    // 浠樼瑳鎵嬬殑閽憋細瀵规墜鎵撳嚭闅忎粠鍚庡純涓€寮犵墝
    registerTrigger('trickster_pay_the_piper', 'onMinionPlayed', (trigCtx) => {
        if (!trigCtx.triggerMinionUid || trigCtx.baseIndex === undefined) return [];
        for (let i = 0; i < trigCtx.state.bases.length; i++) {
            const base = trigCtx.state.bases[i];
            const piper = base.ongoingActions.find(o => matchesDefId(o.defId, 'trickster_pay_the_piper'));
            if (!piper || i !== trigCtx.baseIndex) continue;
            // 鍙鍏朵粬鐜╁瑙﹀彂
            if (piper.ownerId === trigCtx.playerId) continue;
            // 瀵规墜鑷繁閫夋嫨寮冩帀 1 寮犳墜鐗?
            const opponent = trigCtx.state.players[trigCtx.playerId];
            if (!opponent || opponent.hand.length === 0) continue;
            if (!trigCtx.matchState) {
                return [{
                    type: SU_EVENTS.CARDS_DISCARDED,
                    payload: { playerId: trigCtx.playerId, cardUids: [opponent.hand[0].uid] },
                    timestamp: trigCtx.now,
                }];
            }
            return {
                events: [],
                matchState: queuePayThePiperDiscardChoice(trigCtx.matchState, trigCtx.playerId, trigCtx.now),
            };
        }
        return [];
    });
}

function registerTricksterPodOngoingEffects(): void {
    registerTrigger('trickster_brownie_pod', 'onMinionAffected', () => []);
    registerTrigger('trickster_enshrouding_mist_pod', 'onTurnStart', () => []);
    registerProtection('trickster_hideout_pod', 'action', () => false);
    // Hideout POD锛氬叾浠栫帺瀹朵笉鑳藉皢闅忎粠绉诲姩鍒版鍩哄湴锛堢敤浜嬩欢鎷︽埅鍣ㄩ樆姝㈢Щ鍔級
    registerInterceptor('trickster_hideout_pod', (state, event) => {
        if (event.type !== SU_EVENTS.MINION_MOVED) return undefined;
        const { toBaseIndex, fromBaseIndex, minionUid } = (event as any).payload as { toBaseIndex: number; fromBaseIndex: number; minionUid: string };
        const toBase = state.bases[toBaseIndex];
        if (!toBase) return undefined;
        const hideout = toBase.ongoingActions.find(o => o.defId === 'trickster_hideout_pod');
        if (!hideout) return undefined;
        const fromBase = state.bases[fromBaseIndex];
        const moving = fromBase?.minions.find(m => m.uid === minionUid);
        if (!moving) return undefined;
        // 杩戜技瑙勫垯锛氱Щ鍔ㄨ€呴€氬父鏄闅忎粠鐨勬帶鍒惰€?
        if (moving.controller !== hideout.ownerId) return null;
        return undefined;
    });

    // Leprechaun POD锛氭瘡鍥炲悎绗竴娆♀€滃鎵嬫墦鍑哄姏閲忔洿浣庣殑闅忎粠鍒版鍩哄湴锛堢粨绠楀悗浠嶅湪鍦猴級鈥濇椂娑堢伃涔?
    registerTrigger('trickster_leprechaun_pod', 'onMinionPlayed', (trigCtx) => {
        if (!trigCtx.triggerMinionUid || !trigCtx.triggerMinionDefId || trigCtx.baseIndex === undefined) return [];
        const baseIndex = trigCtx.baseIndex;
        const base = trigCtx.state.bases[baseIndex];
        if (!base) return [];

        // 鎵惧埌璇ュ熀鍦颁笂鐨?leprechaun锛堝彲鑳藉涓級
        const leps = base.minions.filter(m => m.defId === 'trickster_leprechaun_pod');
        if (leps.length === 0) return [];

        // 瑙﹀彂鐨勯殢浠庡繀椤讳粛鍦ㄨ鍩哄湴锛堥伩鍏?Twister 绛夊湪缁撶畻涓Щ鍔級
        const playedMinion = base.minions.find(m => m.uid === trigCtx.triggerMinionUid);
        if (!playedMinion) return [];

        const events: SmashUpEvent[] = [];
        for (const lep of leps) {
            // 鍙鍏朵粬鐜╁瑙﹀彂
            if (lep.controller === trigCtx.playerId) continue;

            const used = (lep as any).metadata?.leprechaunPodLastTurnTriggered as number | undefined;
            if (used === trigCtx.state.turnNumber) continue;

            const lepPower = getMinionPower(trigCtx.state, lep, baseIndex);
            const playedPower = getMinionPower(trigCtx.state, playedMinion, baseIndex);
            if (playedPower >= lepPower) continue;

            events.push({
                type: SU_EVENTS.MINION_DESTROYED,
                payload: {
                    minionUid: playedMinion.uid,
                    minionDefId: playedMinion.defId,
                    fromBaseIndex: baseIndex,
                    ownerId: trigCtx.playerId,
                    destroyerId: lep.controller,
                    reason: 'trickster_leprechaun_pod',
                },
                timestamp: trigCtx.now,
            });
            events.push({
                type: SU_EVENTS.MINION_METADATA_UPDATED,
                payload: {
                    minionUid: lep.uid,
                    baseIndex,
                    metadataUpdate: { leprechaunPodLastTurnTriggered: trigCtx.state.turnNumber },
                    reason: 'trickster_leprechaun_pod_once_per_turn',
                },
                timestamp: trigCtx.now,
            } as any);
            break;
        }
        return events;
    });

    // Brownie POD锛氭瘡鍥炲悎涓€娆★紝褰撳鎵嬪湪鍙︿竴鍩哄湴鎵撳嚭闅忎粠鍚庯紝浣犳娊 1 寮犵墝
    registerTrigger('trickster_brownie_pod', 'onMinionPlayed', (trigCtx) => {
        if (!trigCtx.triggerMinionUid || trigCtx.baseIndex === undefined) return [];
        // 瀵规墜鎵撳嚭鐨勯殢浠庯細playerId=鎵撳嚭鑰咃紱闇€瑕佹壘鍒版墍鏈?brownie_pod锛堝彲鑳藉涓級
        const events: SmashUpEvent[] = [];
        for (let bi = 0; bi < trigCtx.state.bases.length; bi++) {
            const base = trigCtx.state.bases[bi];
            for (const brownie of base.minions.filter(m => m.defId === 'trickster_brownie_pod')) {
                if (brownie.controller === trigCtx.playerId) continue;
                if (bi === trigCtx.baseIndex) continue; // 鍙︿竴鍩哄湴
                const ownerId = brownie.controller;
                const used = (brownie as any).metadata?.browniePodLastTurnTriggered as number | undefined;
                if (used === trigCtx.state.turnNumber) continue;

                // 鎶?1
                const owner = trigCtx.state.players[ownerId];
                if (!owner) continue;
                const drawEvents = buildStandardDrawEvents(trigCtx.state, ownerId, 1, trigCtx.random, trigCtx.now);
                if (drawEvents.length === 0) continue;
                events.push(...drawEvents);
                events.push({
                    type: SU_EVENTS.MINION_METADATA_UPDATED,
                    payload: {
                        minionUid: brownie.uid,
                        baseIndex: bi,
                        metadataUpdate: { browniePodLastTurnTriggered: trigCtx.state.turnNumber },
                        reason: 'trickster_brownie_pod_once_per_turn',
                    },
                    timestamp: trigCtx.now,
                } as any);
            }
        }
        return events;
    });

    // Gremlin POD锛氳娑堢伃杩涘叆寮冪墝鍫嗗悗鎶?1锛涜嫢琚秷鐏垯姣忎綅瀵规墜闅忔満寮?1
    registerTrigger('trickster_gremlin_pod', 'onMinionDestroyed', (trigCtx) => {
        if (trigCtx.triggerMinionDefId !== 'trickster_gremlin_pod') return [];
        const ownerId = trigCtx.triggerMinion?.owner ?? trigCtx.playerId;
        const player = trigCtx.state.players[ownerId];
        if (!player) return [];
        const events: SmashUpEvent[] = [];
        events.push(...buildStandardDrawEvents(trigCtx.state, ownerId, 1, trigCtx.random, trigCtx.now));
        for (const pid of trigCtx.state.turnOrder) {
            if (pid === ownerId) continue;
            const opp = trigCtx.state.players[pid];
            if (!opp || opp.hand.length === 0) continue;
            const idx = Math.floor(trigCtx.random.random() * opp.hand.length);
            events.push({
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId: pid, cardUids: [opp.hand[idx].uid] },
                timestamp: trigCtx.now,
            } as CardsDiscardedEvent);
        }
        return events;
    });

    // Gremlin POD锛氬熀鍦拌鍒嗘竻鍦烘椂杩涘叆寮冪墝鍫嗭紙闈炴秷鐏級涔熸娊 1
    registerTrigger('trickster_gremlin_pod', 'onMinionDiscardedFromBase', (trigCtx) => {
        if (trigCtx.triggerMinionDefId !== 'trickster_gremlin_pod') return [];
        const ownerId = trigCtx.triggerMinion?.owner ?? trigCtx.playerId;
        const player = trigCtx.state.players[ownerId];
        if (!player) return [];
        return buildStandardDrawEvents(trigCtx.state, ownerId, 1, trigCtx.random, trigCtx.now);
    });

    // Flame Trap POD锛氬鎵嬫墦鍑洪殢浠庡埌姝ゅ熀鍦板悗锛屽厛鑷瘉鍐嶅皾璇曟秷鐏闅忎粠
    registerTrigger('trickster_flame_trap_pod', 'onMinionPlayed', (trigCtx) => {
        if (!trigCtx.triggerMinionUid || !trigCtx.triggerMinionDefId || trigCtx.baseIndex === undefined) return [];
        const bi = trigCtx.baseIndex;
        const base = trigCtx.state.bases[bi];
        if (!base) return [];
        const trap = base.ongoingActions.find(o => o.defId === 'trickster_flame_trap_pod');
        if (!trap) return [];
        if (trap.ownerId === trigCtx.playerId) return [];
        return [
            {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: { cardUid: trap.uid, defId: trap.defId, ownerId: trap.ownerId, reason: 'trickster_flame_trap_pod' },
                timestamp: trigCtx.now,
            } as OngoingDetachedEvent,
            {
                type: SU_EVENTS.MINION_DESTROYED,
                payload: {
                    minionUid: trigCtx.triggerMinionUid,
                    minionDefId: trigCtx.triggerMinionDefId,
                    fromBaseIndex: bi,
                    ownerId: trigCtx.playerId,
                    destroyerId: trap.ownerId,
                    reason: 'trickster_flame_trap_pod',
                },
                timestamp: trigCtx.now,
            },
        ];
    });

    // Flame Trap POD锛氫綘鍥炲悎寮€濮嬫椂锛屽彲浠ヨ姝ゅ熀鍦版湰鍥炲悎 breakpoint -4
    registerTrigger('trickster_flame_trap_pod', 'onTurnStart', (trigCtx) => {
        for (let bi = 0; bi < trigCtx.state.bases.length; bi++) {
            const base = trigCtx.state.bases[bi];
            const trap = base.ongoingActions.find(o => o.defId === 'trickster_flame_trap_pod');
            if (!trap) continue;
            if (trap.ownerId !== trigCtx.playerId) continue;
            const options = [
                { id: 'yes', label: '是（本回合该基地 breakpoint -4）', value: { yes: true }, displayMode: 'button' as const },
                { id: 'no', label: '否', value: { yes: false }, displayMode: 'button' as const },
            ];
            const interaction = createSimpleChoice(
                `trickster_flame_trap_pod_bp_${trigCtx.now}`,
                trigCtx.playerId,
                '鐏劙闄烽槺锛氭槸鍚﹂檷浣庢鍩哄湴鐖嗗垎绾匡紵',
                options as any[],
                { sourceId: 'trickster_flame_trap_pod_bp', targetType: 'option', autoCancelOption: false },
            );
            return { events: [], matchState: queueInteraction(trigCtx.matchState as any, interaction) } as any;
        }
        return [];
    });

    // Pay the Piper POD锛氬鎵嬪湪姝ゅ熀鍦版墦鍑洪殢浠庡悗锛岃鐜╁寮?1 寮犵墝锛堝厛鎸夐殢鏈哄疄鐜帮紝鍚庣画鍙崌绾т负閫夋嫨寮冪墝锛?
    registerTrigger('trickster_pay_the_piper_pod', 'onMinionPlayed', (trigCtx) => {
        if (!trigCtx.triggerMinionUid || trigCtx.baseIndex === undefined) return [];
        const bi = trigCtx.baseIndex;
        const base = trigCtx.state.bases[bi];
        if (!base) return [];
        const piper = base.ongoingActions.find(o => o.defId === 'trickster_pay_the_piper_pod');
        if (!piper) return [];
        if (piper.ownerId === trigCtx.playerId) return [];
        const opponent = trigCtx.state.players[trigCtx.playerId];
        if (!opponent || opponent.hand.length === 0) return [];
        const idx = Math.floor(trigCtx.random.random() * opponent.hand.length);
        return [{
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId: trigCtx.playerId, cardUids: [opponent.hand[idx].uid] },
            timestamp: trigCtx.now,
        } as CardsDiscardedEvent];
    });

    // Block the Path POD锛氬姣忎釜瀵规墜鎸囧畾鍏舵嫢鏈夌殑涓€涓淳绯伙紝闃绘璇ュ鎵嬫淳绯婚殢浠庢墦鍒版鍩哄湴
    registerAbility('trickster_block_the_path_pod', 'onPlay', (ctx) => {
        const otherPlayers = ctx.state.turnOrder.filter(pid => pid !== ctx.playerId);
        if (otherPlayers.length === 0) return { events: [] };
        const perOpponentFactions = otherPlayers.map(pid => ({
            pid,
            factions: (ctx.state.players[pid]?.factions ?? []).filter(Boolean) as string[],
        }));
        if (perOpponentFactions.some(x => x.factions.length === 0)) {
            return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
        }

        // 缁勫悎锛氭瘡浣嶅鎵嬪湪鍏朵袱涓淳绯讳腑閫変竴涓紙鏈€澶?3 浣嶅鎵?鈫?2^3 = 8锛?
        const combos: { blocked: Record<string, string>; label: string }[] = [];
        const total = 1 << otherPlayers.length;
        for (let mask = 0; mask < total; mask++) {
            const blocked: Record<string, string> = {};
            const parts: string[] = [];
            for (let i = 0; i < otherPlayers.length; i++) {
                const { pid, factions } = perOpponentFactions[i];
                const pick = ((mask >> i) & 1) === 1 ? factions[1] : factions[0];
                blocked[pid] = pick;
                const name = FACTION_DISPLAY_NAMES[pick] ?? pick;
                parts.push(`${getOpponentLabel(pid)}：${name}`);
            }
            combos.push({ blocked, label: parts.join('；') });
        }
        const options = combos.map((c, i) => ({
            id: `combo-${i}`,
            label: c.label,
            value: { blocked: c.blocked },
        }));
        const interaction = createSimpleChoice(
            `trickster_block_the_path_pod_${ctx.now}`,
            ctx.playerId,
            '通路禁止：为每个对手指定一个派系',
            options as any[],
            { sourceId: 'trickster_block_the_path_pod', targetType: 'option', autoCancelOption: true },
        );
        // continuationContext 鐢?Board.tsx/InteractionHandlers 闇€瑕佸瓨 cardUid/baseIndex
        return { events: [], matchState: queueInteraction(ctx.matchState, { ...interaction, data: { ...interaction.data, continuationContext: { cardUid: ctx.cardUid, baseIndex: ctx.baseIndex } } as any }) };
    });

    registerRestriction('trickster_block_the_path_pod', 'play_minion', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return false;
        const block = base.ongoingActions.find(o => o.defId === 'trickster_block_the_path_pod');
        if (!block) return false;
        const per = block.metadata?.blockedFactionsByPlayer as Record<string, string> | undefined;
        const blockedFaction = per?.[ctx.playerId];
        if (!blockedFaction) return false;
        const minionDefId = ctx.extra?.minionDefId as string | undefined;
        if (!minionDefId) return false;
        const def = getCardDef(minionDefId);
        return def?.faction === blockedFaction;
    });

}
