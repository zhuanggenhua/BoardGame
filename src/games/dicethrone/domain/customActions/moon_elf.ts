/**
 * 鏈堢簿鐏?(Moon Elf) 涓撳睘 Custom Action 澶勭悊鍣?
 *
 * 鍖呭惈锛?
 * - 闀垮紦杩炲嚮鍒ゅ畾 (Longbow Bonus Check)
 * - 鐖嗚绠粨绠?(Exploding Arrow Resolve)
 * - 杩峰奖姝ョ粨绠?(Elusive Step Resolve)
 * - 琛屽姩鍗￠€昏緫 (Moon Shadow Strike / Volley / Watch Out)
 */

import { getActiveDice, getAttackMaxDuplicateValueCount, getFaceCounts, getPendingBonusSettlementDice, getPlayerDieFace } from '../rules';
import { STATUS_IDS, MOON_ELF_DICE_FACE_IDS, TOKEN_IDS } from '../ids';
import { RESOURCE_IDS } from '../resources';
import type {
    DiceThroneEvent,
    DamageDealtEvent,
    DamageShieldGrantedEvent,
    InteractionRequestedEvent,
    PendingInteraction,
    StatusAppliedEvent,
    StatusRemovedEvent,
    BonusDieRolledEvent,
    RollLimitChangedEvent,
} from '../types';
import { buildDrawEvents } from '../deckEvents';
import { registerCustomActionHandler, createDisplayOnlySettlement, type CustomActionContext } from '../effects';
import { registerBonusDiceSettlementHandler } from '../bonusDiceSettlement';
import { createDamageCalculation } from '../../../../engine/primitives/damageCalculation';
import type { BonusDieInfo } from '../types';

const FACE = MOON_ELF_DICE_FACE_IDS;
const MOON_ELF_VOLLEY_SETTLEMENT_ID = 'moon-elf-volley';

// ============================================================================
// 杈呭姪鍑芥暟
// ============================================================================

/** 鏂藉姞鐘舵€佹晥鏋滃苟杩斿洖浜嬩欢 */
function applyStatus(
    targetId: string,
    statusId: string,
    stacks: number,
    sourceAbilityId: string,
    state: CustomActionContext['state'],
    timestamp: number
): StatusAppliedEvent {
    const target = state.players[targetId];
    const currentStacks = target?.statusEffects[statusId] ?? 0;
    const def = state.tokenDefinitions.find(e => e.id === statusId);
    const maxStacks = def?.stackLimit || 99;
    const newTotal = Math.min(currentStacks + stacks, maxStacks);
    return {
        type: 'STATUS_APPLIED',
        payload: { targetId, statusId, stacks, newTotal, sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    };
}

/** 閫犳垚浼ゅ骞惰繑鍥炰簨浠?
 * 
 * 銆愬凡杩佺Щ鍒版柊浼ゅ璁＄畻绠＄嚎銆?
 */
function dealDamage(
    ctx: CustomActionContext,
    targetId: string,
    amount: number,
    sourceAbilityId: string,
    timestamp: number
): DamageDealtEvent {
    // 浣跨敤鏂颁激瀹宠绠楃绾?
    const damageCalc = createDamageCalculation({
        source: { playerId: ctx.attackerId, abilityId: sourceAbilityId, phase: ctx.damagePhase },
        target: { playerId: targetId },
        baseDamage: amount,
        state: ctx.state,
        timestamp,
        autoCollectTokens: false,
        autoCollectStatus: true,  // 鍚敤鐘舵€佷慨姝ｆ敹闆嗭紙閿佸畾绛?debuff锛?
        autoCollectShields: false,
    });
    
    const events = damageCalc.toEvents();
    return events[0] as DamageDealtEvent;
}

interface MoonElfFiveDiceRollResult {
    dice: BonusDieInfo[];
    diceValues: number[];
    diceFaces: string[];
    bowCount: number;
    footCount: number;
    moonCount: number;
}

function rollMoonElfFiveBonusDice(
    state: CustomActionContext['state'],
    attackerId: string,
    random: NonNullable<CustomActionContext['random']>,
): MoonElfFiveDiceRollResult {
    const dice: BonusDieInfo[] = [];
    const diceValues: number[] = [];
    const diceFaces: string[] = [];

    for (let index = 0; index < 5; index += 1) {
        const value = random.d(6);
        const face = getPlayerDieFace(state, attackerId, value) ?? '';
        dice.push({ index, value, face });
        diceValues.push(value);
        diceFaces.push(face);
    }

    return {
        dice,
        diceValues,
        diceFaces,
        bowCount: diceFaces.filter(face => face === FACE.BOW).length,
        footCount: diceFaces.filter(face => face === FACE.FOOT).length,
        moonCount: diceFaces.filter(face => face === FACE.MOON).length,
    };
}

function createMoonElfFiveDiceEvents(
    attackerId: string,
    opponentId: string,
    roll: MoonElfFiveDiceRollResult,
    summaryEffectKey: string,
    summaryEffectParams: Record<string, string | number>,
    timestamp: number,
): BonusDieRolledEvent[] {
    const events = roll.dice.map((die) => ({
        type: 'BONUS_DIE_ROLLED',
        payload: {
            value: die.value,
            face: die.face,
            playerId: attackerId,
            targetPlayerId: opponentId,
            effectParams: { value: die.value, index: die.index },
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: timestamp + die.index,
    } as BonusDieRolledEvent));

    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: {
            value: roll.diceValues[0],
            face: roll.diceFaces[0],
            playerId: attackerId,
            targetPlayerId: opponentId,
            effectKey: summaryEffectKey,
            effectParams: summaryEffectParams,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: timestamp + roll.dice.length,
    } as BonusDieRolledEvent);

    return events;
}

// ============================================================================
// 闀垮紦杩炲嚮鍒ゅ畾 (Longbow Bonus Check)
// ============================================================================

/**
 * 闀垮紦 II 杩炲嚮锛氭鏌ユ敾鍑婚闈㈡槸鍚︽湁 鈮? 涓浉鍚岋紝鑻ユ槸鍒欐柦鍔犵紶缁?
 * 娉ㄦ剰锛歱ostDamage 鏃堕瀛愬凡琚槻寰￠樁娈甸噸缃紝蹇呴』浣跨敤 pendingAttack 蹇収
 */
function handleLongbowBonusCheck4(context: CustomActionContext): DiceThroneEvent[] {
    const { sourceAbilityId, state, timestamp, ctx } = context;
    const opponentId = ctx.defenderId;
    if (!opponentId) {
        console.warn('[moon_elf] handleLongbowBonusCheck4: No defenderId in context');
        return [];
    }
    const hasMatch = getAttackMaxDuplicateValueCount(state) >= 4;
    if (!hasMatch) return [];
    return [applyStatus(opponentId, STATUS_IDS.ENTANGLE, 1, sourceAbilityId, state, timestamp)];
}

/**
 * 闀垮紦 III 杩炲嚮锛氭鏌ユ敾鍑婚闈㈡槸鍚︽湁 鈮? 涓浉鍚岋紝鑻ユ槸鍒欐柦鍔犵紶缁?
 * 娉ㄦ剰锛歱ostDamage 鏃堕瀛愬凡琚槻寰￠樁娈甸噸缃紝蹇呴』浣跨敤 pendingAttack 蹇収
 */
function handleLongbowBonusCheck3(context: CustomActionContext): DiceThroneEvent[] {
    const { sourceAbilityId, state, timestamp, ctx } = context;
    const opponentId = ctx.defenderId;
    if (!opponentId) {
        console.warn('[moon_elf] handleLongbowBonusCheck3: No defenderId in context');
        return [];
    }
    const hasMatch = getAttackMaxDuplicateValueCount(state) >= 3;
    if (!hasMatch) return [];
    return [applyStatus(opponentId, STATUS_IDS.ENTANGLE, 1, sourceAbilityId, state, timestamp)];
}

function handleSilencingTraceSelectEvasiveTarget({
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'selectPlayer',
        titleKey: 'interaction.selectPlayerForEvasive',
        selectCount: 1,
        selected: [],
        targetPlayerIds: Object.keys(state.players),
        tokenGrantConfig: { tokenId: TOKEN_IDS.EVASIVE, amount: 1 },
    };
    return [{
        type: 'INTERACTION_REQUESTED',
        payload: { interaction },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as InteractionRequestedEvent];
}

// ============================================================================
// 鐖嗚绠粨绠?(Exploding Arrow Resolve)
// ============================================================================

/**
 * 鐖嗚绠?I锛氭姇鎺?楠帮紝閫犳垚 3 + 1脳寮?+ 1脳瓒?浼ゅ锛屽鎵嬩涪澶?1脳鏈?CP锛岄€犳垚鑷寸洸
 * 
 * 鍥剧墖瑙勫垯锛?
 * - 鎺烽5楠?
 * - 閫犳垚 3 + 1脳寮撻潰鏁?+ 1脳瓒抽潰鏁?浼ゅ
 * - 鍙﹀瀵规墜涓㈠け 1脳鏈堥潰鏁?CP
 * - 閫犳垚鑷寸洸
 */
function handleExplodingArrowResolve1(context: CustomActionContext): DiceThroneEvent[] {
    return resolveExplodingArrowMultiDie(
        context,
        'bonusDie.effect.explodingArrow.result',
        1,
        1,
        false,
    );
}

/**
 * 鐖嗚绠?II锛氭姇鎺?楠帮紝閫犳垚 3 + 1脳寮?+ 2脳瓒?浼ゅ锛屽苟鏂藉姞鑷寸洸
 */
function handleExplodingArrowResolve2(context: CustomActionContext): DiceThroneEvent[] {
    return resolveExplodingArrowMultiDie(
        context,
        'bonusDie.effect.explodingArrow2.result',
        1,
        2,
        false,
    );
}

/**
 * 鐖嗚绠?III锛氭姇鎺?楠帮紝閫犳垚 3 + 1脳寮?+ 2脳瓒?浼ゅ锛屽苟鏂藉姞鑷寸洸鍜岀紶缁?
 */
function handleExplodingArrowResolve3(context: CustomActionContext): DiceThroneEvent[] {
    return resolveExplodingArrowMultiDie(
        context,
        'bonusDie.effect.explodingArrow3.result',
        1,
        2,
        true,
    );
}

function resolveExplodingArrowMultiDie(
    context: CustomActionContext,
    summaryEffectKey: string,
    bowDamageMultiplier: number,
    footDamageMultiplier: number,
    includeEntangle: boolean,
): DiceThroneEvent[] {
    const { attackerId, sourceAbilityId, state, timestamp, random, ctx } = context;
    if (!random) return [];
    const opponentId = ctx.defenderId;
    if (!opponentId) return [];

    const events: DiceThroneEvent[] = [];
    const roll = rollMoonElfFiveBonusDice(state, attackerId, random);
    const { dice, bowCount, footCount, moonCount } = roll;
    const damageAmount = 3 + (bowDamageMultiplier * bowCount) + (footDamageMultiplier * footCount);

    events.push(
        ...createMoonElfFiveDiceEvents(
            attackerId,
            opponentId,
            roll,
            summaryEffectKey,
            {
                bowCount,
                footCount,
                moonCount,
                damage: damageAmount,
            },
            timestamp,
        ),
    );

    if (damageAmount > 0) {
        events.push(dealDamage(context, opponentId, damageAmount, sourceAbilityId, timestamp + 6));
    }

    if (moonCount > 0) {
        const targetPlayer = state.players[opponentId];
        const currentCp = targetPlayer?.resources[RESOURCE_IDS.CP] ?? 0;
        const cpLoss = moonCount;
        const newCp = Math.max(0, currentCp - cpLoss);
        events.push({
            type: 'CP_CHANGED',
            payload: { playerId: opponentId, delta: -cpLoss, newValue: newCp, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 7,
        } as import('../types').CpChangedEvent);
    }

    events.push(applyStatus(opponentId, STATUS_IDS.BLINDED, 1, sourceAbilityId, state, timestamp + 8));
    if (includeEntangle) {
        events.push(applyStatus(opponentId, STATUS_IDS.ENTANGLE, 1, sourceAbilityId, state, timestamp + 9));
    }

    events.push(
        createDisplayOnlySettlement(
            sourceAbilityId,
            attackerId,
            opponentId,
            dice,
            timestamp + (includeEntangle ? 10 : 9),
        ),
    );

    return events;
}

// ============================================================================
// 杩峰奖姝ョ粨绠?(Elusive Step Resolve)
// ============================================================================

/**
 * 杩峰奖姝?I锛氶槻寰℃幏楠帮紝缁熻瓒?FOOT)鏁伴噺
 * 鍥剧墖瑙勫垯锛?
 * - 鑻ヨ冻闈⑩墺2锛屾姷鎸′竴鍗婁激瀹筹紙鍚戜笂鍙栨暣锛?
 * - 姣忔湁瓒抽潰锛岄€犳垚1浼ゅ
 */
function handleElusiveStepResolve1(context: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, sourceAbilityId, state, timestamp, ctx } = context;
    const events: DiceThroneEvent[] = [];
    const faceCounts = getFaceCounts(getActiveDice(state));
    const bowCount = faceCounts[FACE.BOW] ?? 0;
    const footCount = faceCounts[FACE.FOOT] ?? 0;
    // 闃插尽涓婁笅鏂囷細ctx.attackerId = 闃插尽鑰咃紝ctx.defenderId = 鍘熸敾鍑昏€?
    const opponentId = ctx.defenderId;

    // Missed Me: for every 2 Bow, deal 1 damage.
    const reflectedDamage = Math.floor(bowCount / 2);
    if (reflectedDamage > 0) {
        events.push(dealDamage(context, opponentId, reflectedDamage, sourceAbilityId, timestamp));
    }

    // 瓒抽潰鈮?鏃讹紝鎺堜簣 50% 鍑忎激鎶ょ浘
    if (footCount >= 2) {
        events.push({
            type: 'DAMAGE_SHIELD_GRANTED',
            payload: {
                targetId: attackerId,
                value: 0,  // 鐧惧垎姣旀姢鐩句笉浣跨敤 value
                reductionPercent: 50,  // 50% 鍑忎激
                sourceId: sourceAbilityId,
                preventStatus: false,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as DamageShieldGrantedEvent);
    }

    return events;
}

/**
 * 杩峰奖姝?II锛氶槻寰℃幏楠帮紝缁熻瓒?FOOT)鏁伴噺
 * 鍥剧墖瑙勫垯锛堟帹娴嬪崌绾х増锛夛細
 * - 鑻ヨ冻闈⑩墺2锛屾姷鎸′竴鍗婁激瀹筹紙鍚戜笂鍙栨暣锛?
 * - 姣忔湁瓒抽潰锛岄€犳垚1浼ゅ
 * - 棰濆锛氳冻闈⑩墺3鏃惰幏寰?闂伩
 */
function handleElusiveStepResolve2(context: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, sourceAbilityId, state, timestamp, ctx } = context;
    const events: DiceThroneEvent[] = [];
    const faceCounts = getFaceCounts(getActiveDice(state));
    const bowCount = faceCounts[FACE.BOW] ?? 0;
    const footCount = faceCounts[FACE.FOOT] ?? 0;
    // 闃插尽涓婁笅鏂囷細ctx.attackerId = 闃插尽鑰咃紝ctx.defenderId = 鍘熸敾鍑昏€?
    const opponentId = ctx.defenderId;

    // Missed Me II follows the same reflect rule: every 2 Bow deals 1 damage.
    const reflectedDamage = Math.floor(bowCount / 2);
    if (reflectedDamage > 0) {
        events.push(dealDamage(context, opponentId, reflectedDamage, sourceAbilityId, timestamp));
    }

    // 瓒抽潰鈮?鏃讹紝鎺堜簣 50% 鍑忎激鎶ょ浘
    if (footCount >= 2) {
        events.push({
            type: 'DAMAGE_SHIELD_GRANTED',
            payload: {
                targetId: attackerId,
                value: 0,  // 鐧惧垎姣旀姢鐩句笉浣跨敤 value
                reductionPercent: 50,  // 50% 鍑忎激
                sourceId: sourceAbilityId,
                preventStatus: false,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as DamageShieldGrantedEvent);
    }

    return events;
}

// ============================================================================
// 琛屽姩鍗￠€昏緫
// ============================================================================

/**
 * 鏈堝奖琚汉 (Moon Shadow Strike)锛氭姇鎺?楠板垽瀹?
 * - 鏈?MOON)锛氭柦鍔犺嚧鐩?+ 缂犵粫 + 閿佸畾
 * - 鍏朵粬锛氭娊1寮犵墝
 */
function handleMoonShadowStrike(context: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, sourceAbilityId, state, timestamp, random, ctx } = context;
    if (!random) return [];
    const opponentId = ctx.defenderId;
    if (!opponentId) {
        console.warn('[moon_elf] handleMoonShadowStrike: No defenderId in context');
        return [];
    }
    const events: DiceThroneEvent[] = [];

    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value) ?? '';
    
    // 鏍规嵁楠伴潰璁剧疆涓嶅悓鐨?effectKey
    const isMoon = face === FACE.MOON;
    const effectKey = isMoon 
        ? 'bonusDie.effect.moonShadowStrike.moon'  // 鏈堥潰锛氭柦鍔燿ebuff
        : 'bonusDie.effect.moonShadowStrike.other'; // 鍏朵粬锛氭娊鐗?
    
    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: { value, face, playerId: attackerId, targetPlayerId: opponentId, effectKey, effectParams: { value } },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent);

    if (isMoon) {
        // 鏈堬細鏂藉姞鑷寸洸 + 缂犵粫 + 閿佸畾锛堢粰瀵规墜锛?
        events.push(applyStatus(opponentId, STATUS_IDS.BLINDED, 1, sourceAbilityId, state, timestamp));
        events.push(applyStatus(opponentId, STATUS_IDS.ENTANGLE, 1, sourceAbilityId, state, timestamp));
        events.push(applyStatus(opponentId, STATUS_IDS.TARGETED, 1, sourceAbilityId, state, timestamp));
    } else {
        // 闈炴湀锛氭娊1寮犵墝锛堢粰鑷繁锛?
        events.push(...buildDrawEvents(state, attackerId, 1, random, 'ABILITY_EFFECT', timestamp, sourceAbilityId));
    }

    return events;
}

/**
 * 涓囩榻愬彂 (Volley)锛氭敾鍑讳慨姝ｃ€傛姇鎺?楠帮紝澧炲姞寮撻潰鏁懊?浼ゅ锛屾柦鍔犵紶缁?
 */
function handleVolley(context: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, sourceAbilityId, state, timestamp, random, ctx } = context;
    if (!random) return [];
    const opponentId = ctx.defenderId;
    if (!opponentId) {
        console.warn('[moon_elf] handleVolley: No defenderId in context');
        return [];
    }
    const events: DiceThroneEvent[] = [];
    const roll = rollMoonElfFiveBonusDice(state, attackerId, random);
    const bowCount = roll.bowCount;

    events.push(
        ...createMoonElfFiveDiceEvents(
            attackerId,
            opponentId,
            roll,
            'bonusDie.effect.volley.result',
            {
                bowCount,
                bonusDamage: bowCount,
            },
            timestamp,
        ),
    );

    events.push(createDisplayOnlySettlement(
        sourceAbilityId,
        attackerId,
        opponentId,
        roll.dice,
        timestamp + 6,
        {
            summaryEffectKey: 'bonusDie.effect.volley.result',
            summaryEffectParams: {
                bowCount,
                bonusDamage: bowCount,
            },
            customResolutionId: MOON_ELF_VOLLEY_SETTLEMENT_ID,
            allowDiceModification: true,
            opensAfterRollConfirmedResponseWindow: bowCount > 0,
        },
    ));

    return events;
}

/**
 * 鐪嬬 (Watch Out)锛氭敾鍑讳慨姝ｃ€傛姇鎺?楠板垽瀹?
 * - 寮?BOW)锛氬鍔?浼ゅ
 * - 瓒?FOOT)锛氭柦鍔犵紶缁?
 * - 鏈?MOON)锛氭柦鍔犺嚧鐩?
 */
function handleWatchOut(context: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, sourceAbilityId, state, timestamp, random, ctx } = context;
    if (!random) return [];
    const events: DiceThroneEvent[] = [];
    const opponentId = ctx.defenderId;

    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value) ?? '';
    const effectKey = face === FACE.BOW
        ? 'bonusDie.effect.watchOut.bow'
        : face === FACE.FOOT
            ? 'bonusDie.effect.watchOut.foot'
            : face === FACE.MOON
                ? 'bonusDie.effect.watchOut.moon'
                : 'bonusDie.effect.watchOut';
    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: { value, face, playerId: attackerId, targetPlayerId: opponentId, effectKey, effectParams: { value } },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent);

    if (face === FACE.BOW) {
        // 弓：增加 2 伤害（统一交给 reducer 决定是直接加到当前攻击，还是排队到 pendingBonusDamage）。
        events.push({
            type: 'BONUS_DAMAGE_ADDED',
            payload: {
                playerId: attackerId,
                amount: 2,
                sourceCardId: 'watch-out',
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as DiceThroneEvent);
    } else if (face === FACE.FOOT) {
        // 瓒筹細鏂藉姞缂犵粫
        events.push(applyStatus(opponentId, STATUS_IDS.ENTANGLE, 1, sourceAbilityId, state, timestamp));
    } else if (face === FACE.MOON) {
        // 鏈堬細鏂藉姞鑷寸洸
        events.push(applyStatus(opponentId, STATUS_IDS.BLINDED, 1, sourceAbilityId, state, timestamp));
    }

    return events;
}

// ============================================================================
// 鐘舵€佹晥鏋滈挬瀛?
// ============================================================================

/**
 * 鑷寸洸鍒ゅ畾 (Blinded Check)锛氭敾鍑绘柟鏈夎嚧鐩叉椂锛屾姇鎺?楠?
 * - 1-2锛氭敾鍑绘棤鏁堬紙浼ゅ褰掗浂锛?
 * - 3-6锛氭敾鍑绘甯?
 * 鍒ゅ畾鍚庣Щ闄よ嚧鐩茬姸鎬?
 */
function handleBlindedCheck(context: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, state, timestamp, random } = context;
    if (!random) return [];
    const events: DiceThroneEvent[] = [];

    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value) ?? '';
    
    // 鏍规嵁楠板€艰缃笉鍚岀殑 effectKey
    const isMiss = value <= 2;
    const effectKey = isMiss
        ? 'bonusDie.effect.blinded.miss'  // 1-2锛氭敾鍑诲け璐?
        : 'bonusDie.effect.blinded.hit';   // 3-6锛氭敾鍑绘垚鍔?
    
    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: { value, face, playerId: attackerId, targetPlayerId: attackerId, effectKey },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent);

    // 绉婚櫎鑷寸洸鐘舵€侊紙涓€娆℃€э級
    const currentStacks = state.players[attackerId]?.statusEffects[STATUS_IDS.BLINDED] ?? 0;
    if (currentStacks > 0) {
        events.push({
            type: 'STATUS_REMOVED',
            payload: { targetId: attackerId, statusId: STATUS_IDS.BLINDED, stacks: currentStacks },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as StatusRemovedEvent);
    }

    // 1-2锛氭敾鍑诲け璐ワ紝灏?pendingAttack 鏍囪涓烘棤鏁?
    if (isMiss) {
        // 閫氳繃灏?pendingAttack 鐨?sourceAbilityId 娓呯┖鏉ヤ娇鏀诲嚮鏃犳晥
        // 杩欐牱 resolveAttack 涓嶄細浜х敓浼ゅ浜嬩欢
        if (state.pendingAttack) {
            state.pendingAttack.sourceAbilityId = undefined;
        }
    }

    return events;
}

/**
 * 缂犵粫鏁堟灉 (Entangle Effect)锛氬噺灏戞敾鍑绘柟鐨勬幏楠版鏁?
 * 鍦ㄨ繘鏀绘幏楠伴樁娈靛紑濮嬫椂妫€鏌ュ苟搴旂敤
 */
function handleEntangleEffect(context: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, sourceAbilityId, state, timestamp } = context;
    const events: DiceThroneEvent[] = [];

    // 鍑忓皯1娆℃幏楠版満浼氾紙3 -> 2锛?
    // 娉ㄦ剰锛氭 handler 鍦?offensiveRoll 闃舵瑙﹀彂锛屼絾 state.rollLimit 鍙兘杩樻槸鏃ч樁娈电殑鍊硷紝
    // 鍥犳鍩轰簬榛樿鍊?3 璁＄畻锛岀‘淇濈粨鏋滃缁堟槸 2銆?
    const defaultOffensiveRollLimit = 3;
    const newLimit = defaultOffensiveRollLimit - 1;
    const delta = -1;
    events.push({
        type: 'ROLL_LIMIT_CHANGED',
        payload: { playerId: attackerId, delta, newLimit, sourceCardId: sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as RollLimitChangedEvent);

    // 绉婚櫎缂犵粫鐘舵€侊紙涓€娆℃€э級
    const currentStacks = state.players[attackerId]?.statusEffects[STATUS_IDS.ENTANGLE] ?? 0;
    if (currentStacks > 0) {
        events.push({
            type: 'STATUS_REMOVED',
            payload: { targetId: attackerId, statusId: STATUS_IDS.ENTANGLE, stacks: currentStacks },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as StatusRemovedEvent);
    }

    return events;
}

// 閿佸畾 (Targeted) 鏄寔缁晥鏋滐紝鍙椾激鏃?+2 浼ゅ锛屼笉浼氳嚜鍔ㄧЩ闄ゃ€?
// 浼ゅ淇閫氳繃 TokenDef.passiveTrigger.actions[modifyStat]锛岀敱 createDamageCalculation 鐨?collectStatusModifiers 鑷姩澶勭悊銆?
// 绉婚櫎鍙兘閫氳繃鍑€鍖栫瓑涓诲姩鎵嬫銆?

// ============================================================================
// 娉ㄥ唽
// ============================================================================

export function registerMoonElfCustomActions(): void {
    registerBonusDiceSettlementHandler(MOON_ELF_VOLLEY_SETTLEMENT_ID, ({ state, settlement, timestamp }) => {
        const bowCount = getPendingBonusSettlementDice(settlement)
            .filter(die => die.face === FACE.BOW).length;
        const followupEvents: DiceThroneEvent[] = [];

        if (bowCount > 0) {
            followupEvents.push({
                type: 'BONUS_DAMAGE_ADDED',
                payload: {
                    playerId: settlement.attackerId,
                    amount: bowCount,
                    sourceCardId: 'volley',
                },
                sourceCommandType: 'SKIP_BONUS_DICE_REROLL',
                timestamp: timestamp + 1,
            } as DiceThroneEvent);
        }

        followupEvents.push(
            applyStatus(
                settlement.targetId,
                STATUS_IDS.ENTANGLE,
                1,
                settlement.sourceAbilityId,
                state,
                timestamp + 2,
            ),
        );

        return {
            totalDamage: bowCount,
            followupEvents,
        };
    });

    // 闀垮紦杩炲嚮鍒ゅ畾
    registerCustomActionHandler('moon_elf-longbow-bonus-check-4', handleLongbowBonusCheck4, {
        categories: ['status'],
        usesAttackDiceSnapshot: true,
    });
    registerCustomActionHandler('moon_elf-longbow-bonus-check-3', handleLongbowBonusCheck3, {
        categories: ['status'],
        usesAttackDiceSnapshot: true,
    });
    registerCustomActionHandler('moon_elf-silencing-trace-select-evasive-target', handleSilencingTraceSelectEvasiveTarget, {
        categories: ['token'],
        requiresInteraction: true,
    });

    // 鐖嗚绠粨绠?
    registerCustomActionHandler('moon_elf-exploding-arrow-resolve-1', handleExplodingArrowResolve1, {
        categories: ['dice', 'damage', 'status', 'resource'],
    });
    registerCustomActionHandler('moon_elf-exploding-arrow-resolve-2', handleExplodingArrowResolve2, {
        categories: ['dice', 'damage', 'status', 'resource'],
    });
    registerCustomActionHandler('moon_elf-exploding-arrow-resolve-3', handleExplodingArrowResolve3, {
        categories: ['dice', 'damage', 'status', 'resource'],
    });

    // 杩峰奖姝ョ粨绠?
    registerCustomActionHandler('moon_elf-elusive-step-resolve-1', handleElusiveStepResolve1, {
        categories: ['dice', 'damage', 'defense', 'token'],
    });
    registerCustomActionHandler('moon_elf-elusive-step-resolve-2', handleElusiveStepResolve2, {
        categories: ['dice', 'damage', 'defense', 'token', 'status'],
    });

    // 琛屽姩鍗?
    registerCustomActionHandler('moon_elf-action-moon-shadow-strike', handleMoonShadowStrike, {
        categories: ['dice', 'status', 'resource'],
        requiresSelectedDefender: true,
    });
    registerCustomActionHandler('moon_elf-action-volley', handleVolley, {
        categories: ['dice', 'status'],
        requiresSelectedDefender: true,
    });
    registerCustomActionHandler('moon_elf-action-watch-out', handleWatchOut, {
        categories: ['dice', 'status'],
        requiresSelectedDefender: true,
    });

    // 鐘舵€佹晥鏋滈挬瀛?
    registerCustomActionHandler('moon_elf-blinded-check', handleBlindedCheck, {
        categories: ['dice', 'status'],
    });
    registerCustomActionHandler('moon_elf-entangle-effect', handleEntangleEffect, {
        categories: ['dice', 'status'],
    });
    // 閿佸畾 (Targeted) 鏄寔缁晥鏋滐紝鏃犻渶娉ㄥ唽绉婚櫎 handler
}

