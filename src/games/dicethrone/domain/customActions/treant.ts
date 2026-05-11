import { createDisplayOnlySettlement, registerCustomActionHandler, type CustomActionContext } from '../effects';
import { RESOURCE_IDS } from '../resources';
import { buildDrawEvents } from '../deckEvents';
import { getPlayerDieFace } from '../rules';
import { CP_MAX } from '../types';
import type {
    BonusDieRolledEvent,
    CpChangedEvent,
    DiceThroneEvent,
    HealAppliedEvent,
} from '../events';

function handleSaplingHealCp({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const currentCp = state.players[attackerId]?.resources[RESOURCE_IDS.CP] ?? 0;
    return [
        {
            type: 'HEAL_APPLIED',
            payload: { targetId: attackerId, amount: 1, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as HealAppliedEvent,
        {
            type: 'CP_CHANGED',
            payload: {
                playerId: attackerId,
                delta: currentCp >= CP_MAX ? 0 : 1,
                newValue: Math.min(currentCp + 1, CP_MAX),
                sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 1,
        } as CpChangedEvent,
    ];
}

function handleSaplingDraw({ attackerId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    return buildDrawEvents(state, attackerId, 1, random, 'ABILITY_EFFECT', timestamp, sourceAbilityId);
}

function handleLifeSapUse({ attackerId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];

    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value) ?? '';
    const healAmount = Math.ceil(value / 2);
    const die = {
        index: 0,
        value,
        face,
        effectKey: 'bonusDie.effect.treantLifeSap',
        effectParams: { value, heal: healAmount },
    };

    return [
        {
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId: attackerId,
                targetPlayerId: attackerId,
                effectKey: 'bonusDie.effect.treantLifeSap',
                effectParams: { value, heal: healAmount },
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as BonusDieRolledEvent,
        createDisplayOnlySettlement(sourceAbilityId, attackerId, attackerId, [die], timestamp + 1, {
            summaryEffectKey: 'bonusDie.effect.treantLifeSapResult',
            summaryEffectParams: { value, heal: healAmount },
        }),
        {
            type: 'HEAL_APPLIED',
            payload: { targetId: attackerId, amount: healAmount, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 2,
        } as HealAppliedEvent,
    ];
}

export function registerTreantCustomActions(): void {
    registerCustomActionHandler('treant-sapling-heal-cp', handleSaplingHealCp, { categories: ['resource', 'token'] });
    registerCustomActionHandler('treant-sapling-draw', handleSaplingDraw, { categories: ['card', 'token'] });
    registerCustomActionHandler('treant-life-sap-use', handleLifeSapUse, { categories: ['dice', 'resource', 'token'] });
}
