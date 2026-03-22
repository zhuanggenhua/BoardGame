/**
 * 澶ф潃鍥涙柟 (Smash Up) - 鍛戒护楠岃瘉
 */

import type { MatchState, ValidationResult } from '../../../engine/types';
import type { SmashUpCommand, SmashUpCore, ActionCardDef, FusionCardDef, PlayConstraint } from './types';
import { SU_COMMANDS, getCurrentPlayerId, HAND_LIMIT } from './types';
import { getCardDef, getFusionDef, getMinionDef, getMinionLikePower } from '../data/cards';
import { isCardSuppressed, isOperationRestricted } from './ongoingEffects';
import {
    getScoringEligibleBaseIndices,
    getPlayerEffectivePowerOnBase,
} from './ongoingModifiers';
import { canPlayFromDiscard } from './discardPlayability';
import { isSpecialLimitBlocked } from './abilityHelpers';
import {
    actionLikeNeedsResponseWindowBase,
    getActionLikeResponseWindowTiming,
    canUseBaseLimitedMinionQuota,
    canUseSameNameMinionQuota,
    getMaxRemainingGlobalPowerLimitedQuota,
    mustUseBaseLimitedMinionQuota,
    mustUseGlobalPowerLimitedMinionQuota,
    isCardActionLike,
    isCardMinionLike,
} from './utils';

function hasActiveBearNecessitiesPodRestriction(core: SmashUpCore, playerId: string): boolean {
    for (const base of core.bases) {
        const hasPlayerMinion = base.minions.some(minion => minion.controller === playerId);
        if (!hasPlayerMinion) continue;
        const hasOpponentActivePod = base.ongoingActions.some(ongoing =>
            ongoing.defId === 'bear_cavalry_bear_necessities_pod'
            && ongoing.ownerId !== playerId
            && ongoing.talentUsed === true,
        );
        if (hasOpponentActivePod) return true;
    }
    return false;
}

function isExtraMinionPlayAttempt(
    core: SmashUpCore,
    playerId: string,
    baseIndex: number,
    cardDefId: string,
    basePower: number,
    fromDiscard: boolean,
    consumesNormalLimit: boolean,
): boolean {
    const player = core.players[playerId];
    if (!player) return false;
    const globalQuotaRemaining = player.minionLimit - player.minionsPlayed;
    if (fromDiscard && consumesNormalLimit === false) return true;
    if (player.minionsPlayed >= 1) return true;
    if (globalQuotaRemaining <= 0) {
        if (canUseBaseLimitedMinionQuota(core, player, baseIndex, cardDefId, basePower)) return true;
        if (canUseSameNameMinionQuota(player, cardDefId)) return true;
    }
    if (mustUseBaseLimitedMinionQuota(core, player, baseIndex, cardDefId, basePower)) return true;
    if (mustUseGlobalPowerLimitedMinionQuota(core, player, baseIndex, cardDefId, basePower)) return true;
    return false;
}

function isExtraActionPlayAttempt(core: SmashUpCore, playerId: string): boolean {
    const player = core.players[playerId];
    if (!player) return false;
    return player.actionsPlayed >= 1;
}

export function validate(
    state: MatchState<SmashUpCore>,
    command: SmashUpCommand
): ValidationResult {
    const core = state.core;
    const currentPlayerId = getCurrentPlayerId(core);
    const phase = state.sys.phase;

    // 闃插尽鎬ф鏌ワ細纭繚 command 鍜?type 瀛樺湪
    if (!command || typeof command.type !== 'string') {
        return { valid: false, error: 'Invalid command: missing type' };
    }

    // 绯荤粺鍛戒护锛圫YS_ 鍓嶇紑锛夌敱寮曟搸灞傚鐞嗭紝棰嗗煙灞傜洿鎺ユ斁琛?
    if (command.type.startsWith('SYS_')) {
        return { valid: true };
    }

    switch (command.type) {
        case SU_COMMANDS.PLAY_MINION: {
            // meFirst 鍝嶅簲绐楀彛鏈熼棿锛氬厑璁镐粠鎵嬬墝鎵撳嚭 beforeScoringPlayable 闅忎粠鍒板嵆灏嗚鍒嗙殑鍩哄湴
            const minionResponseWindow = state.sys.responseWindow?.current;
            if (minionResponseWindow && minionResponseWindow.windowType === 'meFirst') {
                const responderQueue = minionResponseWindow.responderQueue;
                const currentResponderId = responderQueue[minionResponseWindow.currentResponderIndex];
                if (command.playerId !== currentResponderId) {
                    return { valid: false, error: '绛夊緟瀵规柟鍝嶅簲' };
                }
                const mfPlayer = core.players[command.playerId];
                if (!mfPlayer) return { valid: false, error: '鐜╁涓嶅瓨鍦? };
                const mfCard = mfPlayer.hand.find(c => c.uid === command.payload.cardUid);
                if (!mfCard) return { valid: false, error: '手牌中没有该卡牌' };
                if (!isCardMinionLike(mfCard)) return { valid: false, error: '该卡牌不是随从' };
                const mfDef = getMinionDef(mfCard.defId);
                const mfFusionDef = getFusionDef(mfCard.defId);
                if (!mfDef && !mfFusionDef) return { valid: false, error: '卡牌定义不存在' };
                if (!(mfDef?.beforeScoringPlayable || mfFusionDef?.minionBeforeScoringPlayable)) {
                    return { valid: false, error: '该随从不能在基地计分前打出' };
                }
                const mfBaseIndex = command.payload.baseIndex;
                if (mfBaseIndex < 0 || mfBaseIndex >= core.bases.length) {
                    return { valid: false, error: '鏃犳晥鐨勫熀鍦扮储寮? };
                }
                const mfEligible = getScoringEligibleBaseIndices(core);
                if (!mfEligible.includes(mfBaseIndex)) {
                    return { valid: false, error: '鍙兘鎵撳嚭鍒板嵆灏嗚鍒嗙殑鍩哄湴' };
                }
                if (isSpecialLimitBlocked(core, mfCard.defId, mfBaseIndex)) {
                    return { valid: false, error: '璇ュ熀鍦版湰鍥炲悎宸蹭娇鐢ㄨ繃鍚岀粍鐗规畩鑳藉姏' };
                }
                return { valid: true };
            }

            if (phase !== 'playCards') {
                return { valid: false, error: '鍙兘鍦ㄥ嚭鐗岄樁娈垫墦鍑洪殢浠? };
            }
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: 'player_mismatch' };
            }
            const player = core.players[command.playerId];
            if (!player) return { valid: false, error: '鐜╁涓嶅瓨鍦? };

            const { baseIndex, fromDiscard } = command.payload;
            if (baseIndex < 0 || baseIndex >= core.bases.length) {
                return { valid: false, error: '鏃犳晥鐨勫熀鍦扮储寮? };
            }

            // 浠庡純鐗屽爢鎵撳嚭锛氶€氳繃 discardPlayability 妯″潡楠岃瘉
            if (fromDiscard) {
                const discardCheck = canPlayFromDiscard(core, command.playerId, command.payload.cardUid, baseIndex);
                if (!discardCheck) {
                    return { valid: false, error: '璇ュ崱鐗屼笉鑳戒粠寮冪墝鍫嗘墦鍑哄埌姝ゅ熀鍦? };
                }
                // 娑堣€楁甯搁搴︾殑寮冪墝鍫嗗嚭鐗岄渶瑕佹鏌ラ搴?
                if (discardCheck.consumesNormalLimit && player.minionsPlayed >= player.minionLimit) {
                    return { valid: false, error: '鏈洖鍚堥殢浠庨搴﹀凡鐢ㄥ畬' };
                }
                // 闄愬埗妫€鏌?
                const discardCard = player.discard.find(c => c.uid === command.payload.cardUid);
                if (!discardCard || !isCardMinionLike(discardCard)) {
                    return { valid: false, error: '弃牌堆中没有该随从' };
                }
                const basePower = getMinionLikePower(discardCard.defId) ?? 0;
                const blockedByBearNecessitiesPod = hasActiveBearNecessitiesPodRestriction(core, command.playerId)
                    && isExtraMinionPlayAttempt(
                        core,
                        command.playerId,
                        baseIndex,
                        discardCard.defId,
                        basePower,
                        true,
                        discardCheck.consumesNormalLimit,
                    );
                if (blockedByBearNecessitiesPod) {
                    return { valid: false, error: '受黑熊口粮POD限制：你不能打出额外牌' };
                }
                const usesBaseLimitedMinionQuota = discardCheck.consumesNormalLimit
                    && mustUseBaseLimitedMinionQuota(core, player, baseIndex, discardCard.defId, basePower);
                if (isOperationRestricted(core, baseIndex, command.playerId, 'play_minion', {
                    minionDefId: discardCard.defId,
                    basePower,
                    usesBaseLimitedMinionQuota,
                })) {
                    return { valid: false, error: '璇ュ熀鍦扮姝㈡墦鍑鸿闅忎粠' };
                }
                return { valid: true };
            }

            // 姝ｅ父鎵嬬墝鎵撳嚭锛氬叏灞€棰濆害 + 鍚屽悕棰濆害 + 鍩哄湴闄愬畾棰濆害
            const baseQuota = player.baseLimitedMinionQuota?.[baseIndex] ?? 0;
            const sameNameRemaining = player.sameNameMinionRemaining ?? 0;
            const globalQuotaRemaining = player.minionLimit - player.minionsPlayed;
            if (globalQuotaRemaining <= 0 && sameNameRemaining <= 0 && baseQuota <= 0) {
                return { valid: false, error: '鏈洖鍚堥殢浠庨搴﹀凡鐢ㄥ畬' };
            }
            const card = player.hand.find(c => c.uid === command.payload.cardUid);
            if (!card) return { valid: false, error: '手牌中没有该卡牌' };
            if (!isCardMinionLike(card)) return { valid: false, error: '该卡牌不是随从' };
            const minionDef = getMinionDef(card.defId);
            const fusionDef = getFusionDef(card.defId);
            const basePower = (minionDef?.power ?? fusionDef?.minionPower) ?? 0;
            const blockedByBearNecessitiesPod = hasActiveBearNecessitiesPodRestriction(core, command.playerId)
                && isExtraMinionPlayAttempt(
                    core,
                    command.playerId,
                    baseIndex,
                    card.defId,
                    basePower,
                    false,
                    true,
                );
            if (blockedByBearNecessitiesPod) {
                return { valid: false, error: '受黑熊口粮POD限制：你不能打出额外牌' };
            }
            const usesBaseLimitedMinionQuota = mustUseBaseLimitedMinionQuota(core, player, baseIndex, card.defId, basePower);
            // 鍚屽悕棰濆害妫€鏌ワ細鍏ㄥ眬棰濆害鐢ㄥ畬鍚庯紝濡傛灉鍙墿鍚屽悕棰濆害锛屽繀椤诲尮閰嶅凡閿佸畾鐨?defId
            if (globalQuotaRemaining <= 0 && sameNameRemaining > 0 && baseQuota <= 0) {
                // 宸查攣瀹?defId 鏃讹紝鍙兘鎵撳嚭鍚屽悕闅忎粠
                if (player.sameNameMinionDefId !== null && player.sameNameMinionDefId !== undefined && card.defId !== player.sameNameMinionDefId) {
                    return { valid: false, error: '棰濆鍑虹墝鍙兘鎵撳嚭鍚屽悕闅忎粠' };
                }
            }
            // 鍩哄湴闄愬畾鍚屽悕棰濆害妫€鏌ワ細鍏ㄥ眬棰濆害鍜屽叏灞€鍚屽悕棰濆害閮界敤瀹屽悗锛屼娇鐢ㄥ熀鍦伴檺瀹氶搴︽椂妫€鏌ュ悓鍚嶇害鏉?
            if (usesBaseLimitedMinionQuota) {
                if (player.baseLimitedSameNameRequired?.[baseIndex]) {
                    // 蹇呴』涓庤Е鍙戣兘鍔涙椂鐨勯殢浠庡悓鍚?
                    const requiredDefId = player.baseLimitedSameNameDefId?.[baseIndex];
                    if (requiredDefId && card.defId !== requiredDefId) {
                        const requiredCard = getCardDef(requiredDefId);
                        const requiredName = requiredCard?.name ?? requiredDefId;
                        return { valid: false, error: `鍙兘鎵撳嚭涓庤Е鍙戣兘鍔涚殑闅忎粠鍚屽悕鐨勯殢浠庯紙${requiredName}锛塦 };
                    }
                }
            }
            // 鍏ㄥ眬鍔涢噺闄愬埗妫€鏌ワ細棰濆鍑虹墝鏈轰細鍙兘鏈夊姏閲忎笂闄愶紙濡傚鍥細鍔涢噺鈮?锛?
            if (mustUseGlobalPowerLimitedMinionQuota(core, player, baseIndex, card.defId, basePower)) {
                const maxAllowedPower = getMaxRemainingGlobalPowerLimitedQuota(player);
                if (maxAllowedPower !== undefined && basePower > maxAllowedPower) {
                    return { valid: false, error: `棰濆鍑虹墝鍙兘鎵撳嚭鍔涢噺鈮?{maxAllowedPower}鐨勯殢浠巂 };
                }
            }
            // 闄愬埗妫€鏌ワ細鏄惁绂佹鎵撳嚭闅忎粠鍒版鍩哄湴锛堝寘鎷熀鍦版晥鏋滃拰 ongoing 鏁堟灉锛?
            if (isOperationRestricted(core, baseIndex, command.playerId, 'play_minion', {
                minionDefId: card.defId,
                basePower,
                usesBaseLimitedMinionQuota,
            })) {
                return { valid: false, error: '璇ュ熀鍦扮姝㈡墦鍑鸿闅忎粠' };
            }
            // 随从打出约束（数据驱动）
            const constraint = minionDef?.playConstraint ?? fusionDef?.minionPlayConstraint;
            if (constraint) {
                const constraintError = checkPlayConstraint(constraint, core, baseIndex, command.playerId);
                if (constraintError) return { valid: false, error: constraintError };
            }
            return { valid: true };
        }

        case SU_COMMANDS.PLAY_ACTION: {
            console.log('[DEBUG] PLAY_ACTION validation: start', {
                playerId: command.playerId,
                cardUid: command.payload.cardUid,
                targetBaseIndex: command.payload.targetBaseIndex,
                hasResponseWindow: !!state.sys.responseWindow?.current,
                windowType: state.sys.responseWindow?.current?.windowType,
            });

            // 鍝嶅簲绐楀彛鏈熼棿锛氬厑璁稿綋鍓嶅搷搴旇€呮墦鍑虹壒娈婅鍔ㄥ崱
            const responseWindow = state.sys.responseWindow?.current;
            if (responseWindow && (responseWindow.windowType === 'meFirst' || responseWindow.windowType === 'afterScoring')) {
                const responderQueue = responseWindow.responderQueue;
                const currentResponderId = responderQueue[responseWindow.currentResponderIndex];
                
                console.log('[DEBUG] PLAY_ACTION validation: in response window', {
                    currentResponderId,
                    commandPlayerId: command.playerId,
                    isCurrentResponder: command.playerId === currentResponderId,
                    windowType: responseWindow.windowType,
                });
                
                if (command.playerId !== currentResponderId) {
                    console.log('[DEBUG] PLAY_ACTION validation: BLOCKED - not current responder');
                    return { valid: false, error: '绛夊緟瀵规柟鍝嶅簲' };
                }
                const rPlayer = core.players[command.playerId];
                if (!rPlayer) {
                    console.log('[DEBUG] PLAY_ACTION validation: BLOCKED - player not found');
                    return { valid: false, error: '鐜╁涓嶅瓨鍦? };
                }
                const rCard = rPlayer.hand.find(c => c.uid === command.payload.cardUid);
                if (!rCard) {
                    console.log('[DEBUG] PLAY_ACTION validation: BLOCKED - card not in hand');
                    return { valid: false, error: '鎵嬬墝涓病鏈夎鍗＄墝' };
                }
                if (!isCardActionLike(rCard)) {
                    console.log('[DEBUG] PLAY_ACTION validation: BLOCKED - not action card');
                    return { valid: false, error: '璇ュ崱鐗屼笉鏄鍔ㄥ崱' };
                }
                const rDef = getCardDef(rCard.defId) as ActionCardDef | FusionCardDef | undefined;
                if (!rDef) {
                    console.log('[DEBUG] PLAY_ACTION validation: BLOCKED - card def not found');
                    return { valid: false, error: '鍗＄墝瀹氫箟涓嶅瓨鍦? };
                }
                const responseTiming = getActionLikeResponseWindowTiming(rDef);
                if (!responseTiming) {
                    console.log('[DEBUG] PLAY_ACTION validation: BLOCKED - not special card', {
                        defId: rCard.defId,
                    });
                    return { valid: false, error: '该行动卡不能在响应窗口中打出' };
                }
                
                // 检查响应窗口时机是否匹配窗口类型
                const cardTiming = responseTiming;
                if (responseWindow.windowType === 'meFirst' && cardTiming !== 'beforeScoring') {
                    console.log('[DEBUG] PLAY_ACTION validation: BLOCKED - wrong timing for meFirst window', {
                        cardTiming,
                        windowType: responseWindow.windowType,
                    });
                    return { valid: false, error: '璇ュ崱鐗屽彧鑳藉湪璁″垎鍚庢墦鍑? };
                }
                if (responseWindow.windowType === 'afterScoring' && cardTiming !== 'afterScoring') {
                    console.log('[DEBUG] PLAY_ACTION validation: BLOCKED - wrong timing for afterScoring window', {
                        cardTiming,
                        windowType: responseWindow.windowType,
                    });
                    return { valid: false, error: '璇ュ崱鐗屽彧鑳藉湪璁″垎鍓嶆墦鍑? };
                }

                const targetBase = command.payload.targetBaseIndex;
                console.log('[DEBUG] PLAY_ACTION validation: checking base requirement', {
                    responseNeedsBase: actionLikeNeedsResponseWindowBase(rDef),
                    targetBase,
                });
                
                const needsBase = actionLikeNeedsResponseWindowBase(rDef);
                if (needsBase) {
                    if (typeof targetBase !== 'number' || !Number.isInteger(targetBase)) {
                        console.log('[DEBUG] PLAY_ACTION validation: BLOCKED - needs base but no valid base provided');
                        return { valid: false, error: '该行动卡需要选择一个达标基地' };
                    }
                    const targetBaseIndex = targetBase;
                    if (targetBaseIndex < 0 || targetBaseIndex >= core.bases.length) {
                        console.log('[DEBUG] PLAY_ACTION validation: BLOCKED - invalid base index');
                        return { valid: false, error: '鏃犳晥鐨勫熀鍦扮储寮? };
                    }

                    // 浣跨敤缁熶竴鏌ヨ鍑芥暟锛堜紭鍏堥攣瀹氬垪琛紝鍥為€€瀹炴椂璁＄畻锛?
                    const eligibleIndices = getScoringEligibleBaseIndices(core);
                    console.log('[DEBUG] PLAY_ACTION validation: eligible bases', {
                        eligibleIndices,
                        targetBaseIndex,
                        isEligible: eligibleIndices.includes(targetBaseIndex),
                    });
                    
                    if (!eligibleIndices.includes(targetBaseIndex)) {
                        console.log('[DEBUG] PLAY_ACTION validation: BLOCKED - base not eligible');
                        return { valid: false, error: '鍙兘閫夋嫨杈惧埌涓寸晫鐐圭殑鍩哄湴' };
                    }

                    // specialLimitGroup 妫€鏌ワ細璇ュ熀鍦版湰鍥炲悎鏄惁宸蹭娇鐢ㄨ繃鍚岀粍 special 鑳藉姏
                    const isBlocked = isSpecialLimitBlocked(core, rCard.defId, targetBaseIndex);
                    console.log('[DEBUG] PLAY_ACTION validation: special limit check', {
                        cardDefId: rCard.defId,
                        targetBaseIndex,
                        isBlocked,
                    });
                    
                    if (isBlocked) {
                        console.log('[DEBUG] PLAY_ACTION validation: BLOCKED - special limit');
                        return { valid: false, error: '璇ュ熀鍦版湰鍥炲悎宸蹭娇鐢ㄨ繃鍚岀粍鐗规畩鑳藉姏' };
                    }
                } else if (targetBase !== undefined) {
                    console.log('[DEBUG] PLAY_ACTION validation: BLOCKED - base provided but not needed');
                    return { valid: false, error: '该行动卡不需要基地目标' };
                }

                console.log('[DEBUG] PLAY_ACTION validation: PASSED (Me First! mode)');
                return { valid: true };
            }

            if (phase !== 'playCards') {
                return { valid: false, error: '鍙兘鍦ㄥ嚭鐗岄樁娈垫墦鍑鸿鍔ㄥ崱' };
            }
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: 'player_mismatch' };
            }
            const player = core.players[command.playerId];
            if (!player) return { valid: false, error: '玩家不存在' };
            if (hasActiveBearNecessitiesPodRestriction(core, command.playerId) && isExtraActionPlayAttempt(core, command.playerId)) {
                return { valid: false, error: '受黑熊口粮POD限制：你不能打出额外牌' };
            }
            if (player.actionsPlayed >= player.actionLimit) {
                return { valid: false, error: '鏈洖鍚堣鍔ㄩ搴﹀凡鐢ㄥ畬' };
            }
            const card = player.hand.find(c => c.uid === command.payload.cardUid);
            if (!card) return { valid: false, error: '手牌中没有该卡牌' };
            if (!isCardActionLike(card)) return { valid: false, error: '该卡牌不是行动卡' };
            const def = getCardDef(card.defId) as ActionCardDef | FusionCardDef | undefined;
            if (!def) return { valid: false, error: '卡牌定义不存在' };
            const subtype = (def as any).type === 'fusion'
                ? (def as FusionCardDef).actionSubtype
                : (def as ActionCardDef).subtype;
            // 特殊行动卡只能在响应窗口中打出，不能在正常出牌阶段使用
            if (subtype === 'special') {
                const cardTiming = (def as any).type === 'fusion'
                    ? ((def as FusionCardDef).actionSpecialTiming ?? 'beforeScoring')
                    : ((def as ActionCardDef).specialTiming ?? 'beforeScoring');
                if (cardTiming === 'beforeScoring') {
                    return { valid: false, error: '璇ョ壒娈婅鍔ㄥ崱鍙兘鍦ㄥ熀鍦拌鍒嗗墠鐨勫搷搴旂獥鍙ｄ腑鎵撳嚭' };
                } else {
                    return { valid: false, error: '璇ョ壒娈婅鍔ㄥ崱鍙兘鍦ㄥ熀鍦拌鍒嗗悗鐨勫搷搴旂獥鍙ｄ腑鎵撳嚭' };
                }
            }

            // 鎸佺画琛屽姩鍗★細蹇呴』鏄惧紡閫夋嫨闄勭潃鐩爣
            const targetBase = command.payload.targetBaseIndex;
            if (subtype === 'ongoing') {
                if (typeof targetBase !== 'number' || !Number.isInteger(targetBase)) {
                    return { valid: false, error: '鎸佺画琛屽姩鍗￠渶瑕侀€夋嫨鐩爣鍩哄湴' };
                }
                if (targetBase < 0 || targetBase >= core.bases.length) {
                    return { valid: false, error: '鏃犳晥鐨勫熀鍦扮储寮? };
                }

                const ongoingTarget = (def as any).type === 'fusion'
                    ? ((def as FusionCardDef).actionOngoingTarget ?? 'base')
                    : (((def as ActionCardDef).ongoingTarget ?? 'base'));
                const targetMinionUid = command.payload.targetMinionUid;
                if (ongoingTarget === 'minion') {
                    if (!targetMinionUid) {
                        return { valid: false, error: '璇ユ寔缁鍔ㄥ崱闇€瑕侀€夋嫨鐩爣闅忎粠' };
                    }
                    const targetMinion = core.bases[targetBase].minions.find(m => m.uid === targetMinionUid);
                    if (!targetMinion) {
                        return { valid: false, error: '鍩哄湴涓婃病鏈夎闅忎粠' };
                    }
                } else if (targetMinionUid !== undefined) {
                    return { valid: false, error: '璇ユ寔缁鍔ㄥ崱涓嶉渶瑕侀€夋嫨闅忎粠鐩爣' };
                }

                // 打出约束检查（数据驱动）
                const playConstraint = (def as any).type === 'fusion'
                    ? (def as FusionCardDef).actionPlayConstraint
                    : (def as ActionCardDef).playConstraint;
                if (playConstraint) {
                    const constraintError = checkPlayConstraint(playConstraint, core, targetBase, command.playerId);
                    if (constraintError) return { valid: false, error: constraintError };
                }
            }

            // ongoing 闄愬埗妫€鏌ワ細鏄惁绂佹鎵撳嚭琛屽姩鍗″埌鐩爣鍩哄湴
            // 娉ㄦ剰锛歰ngoingTarget='minion' 鐨勮鍔ㄥ崱闄勭潃鍒伴殢浠庝笂锛屼笉鍙楀熀鍦?play_action 闄愬埗
            if (typeof targetBase === 'number') {
                const ongoingTarget = (def as any).type === 'fusion'
                    ? ((def as FusionCardDef).actionOngoingTarget ?? 'base')
                    : (((def as ActionCardDef).ongoingTarget ?? 'base'));
                if (ongoingTarget === 'base' && isOperationRestricted(core, targetBase, command.playerId, 'play_action')) {
                    return { valid: false, error: '璇ュ熀鍦扮姝㈡墦鍑鸿鍔ㄥ崱' };
                }
            }
            return { valid: true };
        }

        case SU_COMMANDS.DISCARD_TO_LIMIT: {
            if (phase !== 'draw') {
                return { valid: false, error: '鍙兘鍦ㄦ娊鐗岄樁娈靛純鐗? };
            }
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: 'player_mismatch' };
            }
            const player = core.players[command.playerId];
            if (!player) return { valid: false, error: '鐜╁涓嶅瓨鍦? };
            const excess = player.hand.length - HAND_LIMIT;
            if (excess <= 0) return { valid: false, error: '鎵嬬墝鏈秴杩囦笂闄? };
            if (command.payload.cardUids.length !== excess) {
                return { valid: false, error: `闇€瑕佸純鎺?${excess} 寮犵墝` };
            }
            const handUids = new Set(player.hand.map(c => c.uid));
            for (const uid of command.payload.cardUids) {
                if (!handUids.has(uid)) {
                    return { valid: false, error: `鎵嬬墝涓笉瀛樺湪 uid=${uid}` };
                }
            }
            return { valid: true };
        }

        case SU_COMMANDS.SELECT_FACTION: {
            if (phase !== 'factionSelect') {
                return { valid: false, error: '鍙兘鍦ㄦ淳绯婚€夋嫨闃舵閫夋嫨娲剧郴' };
            }
            // Check turn order strictness
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: 'player_mismatch' };
            }
            const selection = core.factionSelection;
            if (!selection) return { valid: false, error: '娲剧郴閫夋嫨鐘舵€佹湭鍒濆鍖? };

            const factionId = command.payload.factionId;
            if (selection.takenFactions.includes(factionId)) {
                return { valid: false, error: '璇ユ淳绯诲凡琚€夋嫨' };
            }
            const playerSelections = selection.playerSelections[command.playerId] || [];
            if (playerSelections.length >= 2) {
                return { valid: false, error: '浣犲凡閫夋嫨浜嗕袱涓淳绯? };
            }

            return { valid: true };
        }

        case SU_COMMANDS.USE_TALENT: {
            if (phase !== 'playCards') {
                return { valid: false, error: '鍙兘鍦ㄥ嚭鐗岄樁娈典娇鐢ㄥぉ璧? };
            }
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: 'player_mismatch' };
            }
            const { minionUid, ongoingCardUid, baseIndex } = command.payload;
            const targetBase = core.bases[baseIndex];
            if (!targetBase) return { valid: false, error: '鏃犳晥鐨勫熀鍦扮储寮? };

            // ongoing 琛屽姩鍗″ぉ璧嬶紙鍩哄湴涓婃垨闅忎粠闄勭潃锛?
            if (ongoingCardUid) {
                // 鍏堟煡鍩哄湴 ongoingActions
                let ongoing = targetBase.ongoingActions.find(o => o.uid === ongoingCardUid);
                // 鍐嶆煡闅忎粠 attachedActions
                if (!ongoing) {
                    for (const m of targetBase.minions) {
                        const aa = m.attachedActions.find(a => a.uid === ongoingCardUid);
                        if (aa) { ongoing = aa; break; }
                    }
                }
                if (!ongoing) return { valid: false, error: '鍩哄湴涓婃病鏈夎鎸佺画琛屽姩鍗? };
                if (ongoing.ownerId !== command.playerId) {
                    return { valid: false, error: '鍙兘浣跨敤鑷繁鐨勬寔缁鍔ㄥ崱澶╄祴' };
                }
                if (ongoing.talentUsed) {
                    return { valid: false, error: '鏈洖鍚堝ぉ璧嬪凡浣跨敤' };
                }
                if (isCardSuppressed(core, ongoingCardUid)) {
                    return { valid: false, error: '璇ュ崱鐗岃兘鍔涘凡琚帇鍒? };
                }
                const oDef = getCardDef(ongoing.defId);
                if (!oDef || !('abilityTags' in oDef) || !oDef.abilityTags?.includes('talent')) {
                    return { valid: false, error: '璇ユ寔缁鍔ㄥ崱娌℃湁澶╄祴鑳藉姏' };
                }
                return { valid: true };
            }

            // 闅忎粠澶╄祴
            if (!minionUid) return { valid: false, error: '蹇呴』鎸囧畾闅忎粠鎴栨寔缁鍔ㄥ崱' };
            const targetMinion = targetBase.minions.find(m => m.uid === minionUid);
            if (!targetMinion) return { valid: false, error: '鍩哄湴涓婃病鏈夎闅忎粠' };
            if (targetMinion.controller !== command.playerId) {
                return { valid: false, error: '鍙兘浣跨敤鑷繁鎺у埗鐨勯殢浠庣殑澶╄祴' };
            }
            if (targetMinion.talentUsed) {
                // 宸ㄧ煶闃典緥澶栵細鍏佽涓€涓殢浠庢瘡鍥炲悎浣跨敤鎵嶈兘涓ゆ
                const isStandingStones = targetBase.defId === 'base_standing_stones';
                const doubleTalentAvailable = !core.standingStonesDoubleTalentMinionUid;
                if (!(isStandingStones && doubleTalentAvailable)) {
                    return { valid: false, error: '鏈洖鍚堝ぉ璧嬪凡浣跨敤' };
                }
            }
            if (isCardSuppressed(core, minionUid)) {
                return { valid: false, error: '璇ュ崱鐗岃兘鍔涘凡琚帇鍒? };
            }
            // 妫€鏌ユ槸鍚︽湁澶╄祴鑳藉姏
            const mDef = getCardDef(targetMinion.defId);
            if (!mDef || !('abilityTags' in mDef) || !mDef.abilityTags?.includes('talent')) {
                return { valid: false, error: '璇ラ殢浠庢病鏈夊ぉ璧嬭兘鍔? };
            }
            return { valid: true };
        }

        case SU_COMMANDS.ACTIVATE_SPECIAL: {
            // 鍏佽鍦?playCards 鍜?scoreBases 闃舵婵€娲荤壒娈婅兘鍔?
            // scoreBases 闃舵锛氬熀鍦拌鍒嗗墠鐨?beforeScoring 鐗规畩鑳藉姏锛堝蹇嶈€呬緧浠庯級
            if (phase !== 'playCards' && phase !== 'scoreBases') {
                return { valid: false, error: '鍙兘鍦ㄥ嚭鐗岄樁娈垫垨璁″垎闃舵婵€娲荤壒娈婅兘鍔? };
            }
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: 'player_mismatch' };
            }
            const { minionUid: spMinionUid, baseIndex: spBaseIndex } = command.payload;
            const spBase = core.bases[spBaseIndex];
            if (!spBase) return { valid: false, error: '鏃犳晥鐨勫熀鍦扮储寮? };
            const spMinion = spBase.minions.find(m => m.uid === spMinionUid);
            if (!spMinion) return { valid: false, error: '鍩哄湴涓婃病鏈夎闅忎粠' };
            if (spMinion.controller !== command.playerId) {
                return { valid: false, error: '鍙兘婵€娲昏嚜宸辨帶鍒剁殑闅忎粠鐨勭壒娈婅兘鍔? };
            }
            const spDef = getCardDef(spMinion.defId);
            if (!spDef || !('abilityTags' in spDef) || !spDef.abilityTags?.includes('special')) {
                return { valid: false, error: '璇ラ殢浠庢病鏈夌壒娈婅兘鍔? };
            }
            if (isCardSuppressed(core, spMinionUid)) {
                return { valid: false, error: '璇ュ崱鐗岃兘鍔涘凡琚帇鍒? };
            }
            // specialLimitGroup 妫€鏌?
            if (isSpecialLimitBlocked(core, spMinion.defId, spBaseIndex)) {
                return { valid: false, error: '璇ュ熀鍦版湰鍥炲悎宸蹭娇鐢ㄨ繃鍚岀粍鐗规畩鑳藉姏' };
            }
            // scoreBases 闃舵棰濆楠岃瘉锛氬彧鑳藉湪杈炬爣鍩哄湴涓婃縺娲?
            if (phase === 'scoreBases') {
                const eligibleIndices = getScoringEligibleBaseIndices(core);
                if (!eligibleIndices.includes(spBaseIndex)) {
                    return { valid: false, error: '鍙兘鍦ㄨ揪鍒颁复鐣岀偣鐨勫熀鍦颁笂婵€娲昏鍒嗗墠鐗规畩鑳藉姏' };
                }
                // 鍝嶅簲绐楀彛浠嶆墦寮€鏃朵笉鍏佽婵€娲伙紙Me First! 浼樺厛锛?
                if (state.sys.responseWindow?.current) {
                    return { valid: false, error: 'Me First! 鍝嶅簲绐楀彛浠嶅湪杩涜涓? };
                }
            }
            return { valid: true };
        }

        default:
            // RESPONSE_PASS 鐢卞紩鎿?ResponseWindowSystem 澶勭悊锛岄鍩熷眰鐩存帴鏀捐
            if ((command as { type: string }).type === 'RESPONSE_PASS') {
                return { valid: true };
            }
            return { valid: false, error: '鏈煡鍛戒护' };
    }
}

/**
 * 閫氱敤鎵撳嚭绾︽潫妫€鏌ワ紙鏁版嵁椹卞姩锛夈€?
 * 杩斿洖 null 琛ㄧず閫氳繃锛岃繑鍥炲瓧绗︿覆琛ㄧず鎷掔粷鍘熷洜銆?
 */
function checkPlayConstraint(
    constraint: PlayConstraint,
    core: SmashUpCore,
    baseIndex: number,
    playerId: string,
): string | null {
    if (constraint === 'requireOwnMinion') {
        const hasOwnMinion = core.bases[baseIndex].minions.some(m => m.controller === playerId);
        if (!hasOwnMinion) return '鐩爣鍩哄湴涓婂繀椤绘湁浣犵殑闅忎粠';
        return null;
    }
    if (constraint === 'onlyCardInHand') {
        const handSize = core.players[playerId]?.hand.length ?? 0;
        if (handSize !== 1) return '鍙兘鍦ㄦ湰鍗℃槸浣犵殑鍞竴鎵嬬墝鏃舵墦鍑?;
        return null;
    }
    if (typeof constraint === 'object' && constraint.type === 'requireOwnPower') {
        const base = core.bases[baseIndex];
        const myPower = getPlayerEffectivePowerOnBase(core, base, baseIndex, playerId);
        if (myPower < constraint.minPower) {
            return `鍙兘鎵撳埌浣犺嚦灏戞嫢鏈?{constraint.minPower}鐐瑰姏閲忕殑鍩哄湴`;
        }
        return null;
    }
    return null;
}

