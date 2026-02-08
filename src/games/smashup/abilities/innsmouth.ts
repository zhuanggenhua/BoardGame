/**
 * 大杀四方 - 印斯茅斯派系能力
 *
 * 主题：同名随从联动、数量优势
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { addPowerCounter, grantExtraMinion, drawMadnessCards } from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { SmashUpEvent, DeckReshuffledEvent } from '../domain/types';

/** 注册印斯茅斯派系所有能力 */
export function registerInnsmouthAbilities(): void {
    // 深潜者（行动卡）：力量≤2的己方随从各+1力量
    registerAbility('innsmouth_the_deep_ones', 'onPlay', innsmouthTheDeepOnes);
    // 新人（行动卡）：所有玩家将弃牌堆随从洗回牌库
    registerAbility('innsmouth_new_acolytes', 'onPlay', innsmouthNewAcolytes);
    // 招募（行动卡）：抽最多3张疯狂卡，每张 = 额外打出1个随从
    registerAbility('innsmouth_recruitment', 'onPlay', innsmouthRecruitment);
}

/** 深潜者 onPlay：每个你的力量≤2的随从获得+1力量 */
function innsmouthTheDeepOnes(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        for (const m of base.minions) {
            if (m.controller === ctx.playerId && m.basePower <= 2) {
                events.push(addPowerCounter(m.uid, i, 1, 'innsmouth_the_deep_ones', ctx.now));
            }
        }
    }
    return { events };
}

/** 新人 onPlay：所有玩家将弃牌堆中的所有随从洗回牌库 */
function innsmouthNewAcolytes(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (const pid of ctx.state.turnOrder) {
        const player = ctx.state.players[pid];
        const minionsInDiscard = player.discard.filter(c => c.type === 'minion');
        if (minionsInDiscard.length === 0) continue;
        // 合并牌库 + 弃牌堆随从，洗牌
        const newDeckCards = [...player.deck, ...minionsInDiscard];
        const shuffled = ctx.random.shuffle([...newDeckCards]);
        const evt: DeckReshuffledEvent = {
            type: SU_EVENTS.DECK_RESHUFFLED,
            payload: {
                playerId: pid,
                deckUids: shuffled.map(c => c.uid),
            },
            timestamp: ctx.now,
        };
        events.push(evt);
    }
    return { events };
}

/** 招募 onPlay：抽最多3张疯狂卡，每张成功抽取 = 额外打出1个随从（MVP：尽量抽满3张） */
function innsmouthRecruitment(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    // 尝试抽3张疯狂卡
    const madnessEvt = drawMadnessCards(ctx.playerId, 3, ctx.state, 'innsmouth_recruitment', ctx.now);
    if (madnessEvt) {
        events.push(madnessEvt);
        // 每张成功抽取的疯狂卡 = 1个额外随从
        const actualDrawn = madnessEvt.payload.cardUids.length;
        for (let i = 0; i < actualDrawn; i++) {
            events.push(grantExtraMinion(ctx.playerId, 'innsmouth_recruitment', ctx.now));
        }
    }
    return { events };
}

// TODO: innsmouth_the_locals (onPlay) - 展示牌库顶3张，同名放手牌（需要 reveal 机制）
// TODO: innsmouth_mysteries_of_the_deep - 同名随从≥3时抽牌+可选疯狂卡（需要 Madness）
// TODO: innsmouth_sacred_circle (ongoing+talent) - 额外打出同名随从（需要 ongoing + talent 系统）
// TODO: innsmouth_return_to_the_sea (special) - 计分后同名随从回手牌（需要 afterScoring 时机）
// TODO: innsmouth_spreading_the_word - 额外打出同名随从（需要 Prompt 选名字）
// TODO: innsmouth_in_plain_sight (ongoing) - 力量≤2随从不受影响（需要 ongoing 效果系统）
