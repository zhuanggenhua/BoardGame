import type { PlayerId } from '../../../engine/types';
import type { SmashUpCore, TitanCardDef, TitanState } from './types';
import { getTitanByController } from './abilityHelpers';

export interface TitanAbilityValidationContext {
    state: SmashUpCore;
    playerId: PlayerId;
    titan: TitanState;
    titanDef: TitanCardDef;
    baseIndex: number;
}

type TitanAbilityValidator = (ctx: TitanAbilityValidationContext) => string | null;

const titanSpecialValidators = new Map<string, TitanAbilityValidator>();
const titanTalentValidators = new Map<string, TitanAbilityValidator>();
const titanOngoingActivationValidators = new Map<string, TitanAbilityValidator>();

export function registerTitanSpecialValidator(defId: string, validator: TitanAbilityValidator): void {
    titanSpecialValidators.set(defId, validator);
}

export function registerTitanTalentValidator(defId: string, validator: TitanAbilityValidator): void {
    titanTalentValidators.set(defId, validator);
}

export function registerTitanOngoingActivationValidator(defId: string, validator: TitanAbilityValidator): void {
    titanOngoingActivationValidators.set(defId, validator);
}

export function hasTitanSpecialValidator(defId: string): boolean {
    return titanSpecialValidators.has(defId);
}

export function hasTitanTalentValidator(defId: string): boolean {
    return titanTalentValidators.has(defId);
}

export function hasTitanOngoingActivationValidator(defId: string): boolean {
    return titanOngoingActivationValidators.has(defId);
}

function validateTitanSummonMode(ctx: TitanAbilityValidationContext): string | null {
    if (ctx.titan.location.zone !== 'setaside') return null;

    const activeTitan = getTitanByController(ctx.state, ctx.playerId);
    if (activeTitan && activeTitan.uid !== ctx.titan.uid) {
        return '你已经有泰坦在场';
    }

    const player = ctx.state.players[ctx.playerId];
    if (!player) return '玩家不存在';

    if (ctx.titanDef.summonMode === 'insteadOfRegularMinion' && player.minionsPlayed >= player.minionLimit) {
        return '本回合随从额度已用完';
    }
    if (ctx.titanDef.summonMode === 'insteadOfRegularAction' && player.actionsPlayed >= player.actionLimit) {
        return '本回合行动额度已用完';
    }
    if (ctx.titanDef.summonMode === 'insteadOfRegularMinionAndAction') {
        if (player.minionsPlayed >= player.minionLimit) {
            return '本回合随从额度已用完';
        }
        if (player.actionsPlayed >= player.actionLimit) {
            return '本回合行动额度已用完';
        }
    }

    return null;
}

export function validateTitanSpecialActivation(ctx: TitanAbilityValidationContext): string | null {
    const summonModeError = validateTitanSummonMode(ctx);
    if (summonModeError) return summonModeError;
    return titanSpecialValidators.get(ctx.titan.defId)?.(ctx) ?? null;
}

export function validateTitanTalentUse(ctx: TitanAbilityValidationContext): string | null {
    const canUseGreatWolfSpiritDoubleTalent = ctx.titan.talentUsed
        && ctx.titan.location.zone === 'base'
        && (ctx.state.titans ?? []).some(sourceTitan =>
            sourceTitan.defId === 'werewolves_great_wolf_spirit'
            && sourceTitan.location.zone === 'base'
            && sourceTitan.location.baseIndex === ctx.titan.location.baseIndex
            && sourceTitan.controllerId === ctx.playerId
            && !(ctx.state.titanOngoingSuppressedUntilTurnEnd ?? []).includes(sourceTitan.uid),
        )
        && !(ctx.state.greatWolfSpiritDoubleTalentCardUids ?? []).includes(ctx.titan.uid);
    const canUseExpertTimingDoubleTalent = ctx.titan.talentUsed
        && ctx.titan.metadata?.mythicHorsesSeastarExtraTalent === true
        && ctx.titan.metadata?.mythicHorsesSeastarExtraTalentConsumed !== true;
    if (ctx.titan.talentUsed && !canUseGreatWolfSpiritDoubleTalent && !canUseExpertTimingDoubleTalent) {
        return '本回合天赋已使用';
    }
    return titanTalentValidators.get(ctx.titan.defId)?.(ctx) ?? null;
}

export function validateTitanOngoingActivation(ctx: TitanAbilityValidationContext): string | null {
    return titanOngoingActivationValidators.get(ctx.titan.defId)?.(ctx) ?? null;
}

export function clearTitanAbilityValidators(): void {
    titanSpecialValidators.clear();
    titanTalentValidators.clear();
    titanOngoingActivationValidators.clear();
}
