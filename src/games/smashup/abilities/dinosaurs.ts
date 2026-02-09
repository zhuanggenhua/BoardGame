/**
 * 大杀四方 - 恐龙派系能力
 *
 * 主题：高力量、消灭低力量随从、力量增强
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { destroyMinion, addPowerCounter, getMinionPower } from '../domain/abilityHelpers';
import type { SmashUpEvent } from '../domain/types';

/** 注册恐龙派系所有能力 */
export function registerDinosaurAbilities(): void {
    registerAbility('dino_laser_triceratops', 'onPlay', dinoLaserTriceratops);
    registerAbility('dino_wild_stuffing', 'onPlay', dinoWildStuffing);
    registerAbility('dino_augmentation', 'onPlay', dinoAugmentation);
    registerAbility('dino_howl', 'onPlay', dinoHowl);
    registerAbility('dino_natural_selection', 'onPlay', dinoNaturalSelection);
    registerAbility('dino_wild_rampage', 'onPlay', dinoWildRampage);
    registerAbility('dino_survival_of_the_fittest', 'onPlay', dinoSurvivalOfTheFittest);
}


/** 激光三角龙 onPlay：消灭本基地一个力量≤2的随从 */
function dinoLaserTriceratops(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const target = base.minions.find(
        m => m.uid !== ctx.cardUid && getMinionPower(ctx.state, m, ctx.baseIndex) <= 2
    );
    if (!target) return { events: [] };
    return {
        events: [destroyMinion(target.uid, target.defId, ctx.baseIndex, target.owner, 'dino_laser_triceratops', ctx.now)],
    };
}

/** 野蛮践踏 onPlay：消灭一个力量≤3的随从（任意基地） */
function dinoWildStuffing(ctx: AbilityContext): AbilityResult {
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        const target = base.minions.find(
            m => m.controller !== ctx.playerId && getMinionPower(ctx.state, m, i) <= 3
        );
        if (target) {
            return {
                events: [destroyMinion(target.uid, target.defId, i, target.owner, 'dino_wild_stuffing', ctx.now)],
            };
        }
    }
    return { events: [] };
}

/** 机能强化 onPlay：一个随从+4力量（MVP：自动选己方力量最高的随从） */
function dinoAugmentation(ctx: AbilityContext): AbilityResult {
    let bestMinion: { uid: string; baseIndex: number; power: number } | undefined;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId) {
                const power = getMinionPower(ctx.state, m, i);
                if (!bestMinion || power > bestMinion.power) {
                    bestMinion = { uid: m.uid, baseIndex: i, power };
                }
            }
        }
    }
    if (!bestMinion) return { events: [] };
    return { events: [addPowerCounter(bestMinion.uid, bestMinion.baseIndex, 4, 'dino_augmentation', ctx.now)] };
}

/** 咆哮 onPlay：你的全部随从+1力量 */
function dinoHowl(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId) {
                events.push(addPowerCounter(m.uid, i, 1, 'dino_howl', ctx.now));
            }
        }
    }
    return { events };
}

/** 物竞天择 onPlay：消灭力量低于你随从的对手随从 */
function dinoNaturalSelection(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    let myMaxPower = 0;
    for (const m of base.minions) {
        if (m.controller === ctx.playerId) {
            const power = getMinionPower(ctx.state, m, ctx.baseIndex);
            if (power > myMaxPower) myMaxPower = power;
        }
    }
    if (myMaxPower === 0) return { events: [] };
    const target = base.minions.find(
        m => m.controller !== ctx.playerId && getMinionPower(ctx.state, m, ctx.baseIndex) < myMaxPower
    );
    if (!target) return { events: [] };
    return {
        events: [destroyMinion(target.uid, target.defId, ctx.baseIndex, target.owner, 'dino_natural_selection', ctx.now)],
    };
}

/** 疯狂暴走 onPlay：你在目标基地的每个随从+2力量 */
function dinoWildRampage(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    for (const m of base.minions) {
        if (m.controller === ctx.playerId) {
            events.push(addPowerCounter(m.uid, ctx.baseIndex, 2, 'dino_wild_rampage', ctx.now));
        }
    }
    return { events };
}

/** 适者生存 onPlay：消灭所有拥有最低力量的随从 */
function dinoSurvivalOfTheFittest(ctx: AbilityContext): AbilityResult {
    let minPower = Infinity;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            const power = getMinionPower(ctx.state, m, i);
            if (power < minPower) minPower = power;
        }
    }
    if (minPower === Infinity) return { events: [] };
    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (getMinionPower(ctx.state, m, i) === minPower) {
                events.push(destroyMinion(m.uid, m.defId, i, m.owner, 'dino_survival_of_the_fittest', ctx.now));
            }
        }
    }
    return { events };
}

// 暴龙雷克斯：无能力（纯力量7）
// dino_armor_stego (ongoing) - 已通过 ongoingModifiers 系统实现力量修正
// dino_war_raptor (ongoing) - 已通过 ongoingModifiers 系统实现力量修正
// TODO: dino_tooth_and_claw (ongoing) - 保护随从（需要 ongoing 效果系统）
// TODO: dino_upgrade (ongoing) - +2力量且不能被消灭（需要 ongoing 效果系统）
