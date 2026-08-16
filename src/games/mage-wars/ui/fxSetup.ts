import { FxRegistry } from '../../../engine/fx';
import { MW_FX } from './fxCues';
import { AttackImpactRenderer, DamageImpactRenderer, SpellPushRenderer, SpellTeleportRenderer, SummonRenderer } from './fxRenderers';

function createRegistry(): FxRegistry {
    const registry = new FxRegistry();

    registry.register(MW_FX.SUMMON, SummonRenderer, {
        timeoutMs: 2400,
        maxConcurrent: 2,
        debounceMs: 60,
        budget: {
            areaPolicy: 'cell',
            estimatedCost: 'medium',
            maxDpr: 1.25,
            reducedMaxDpr: 1,
        },
    });

    registry.register(MW_FX.ATTACK_IMPACT, AttackImpactRenderer, {
        timeoutMs: 5600,
        maxConcurrent: 2,
        debounceMs: 60,
        budget: {
            areaPolicy: 'cell',
            estimatedCost: 'medium',
            maxDpr: 1.25,
            reducedMaxDpr: 1,
        },
    });

    registry.register(MW_FX.SPELL_PUSH, SpellPushRenderer, {
        timeoutMs: 5000,
        maxConcurrent: 3,
        debounceMs: 40,
        budget: {
            areaPolicy: 'cell',
            estimatedCost: 'low',
            maxDpr: 1.25,
            reducedMaxDpr: 1,
        },
    });
    registry.register(MW_FX.SPELL_TELEPORT, SpellTeleportRenderer, {
        timeoutMs: 5200,
        maxConcurrent: 3,
        debounceMs: 40,
        budget: {
            areaPolicy: 'cell',
            estimatedCost: 'medium',
            maxDpr: 1.25,
            reducedMaxDpr: 1,
        },
    });

    registry.register(MW_FX.DAMAGE_IMPACT, DamageImpactRenderer, {
        timeoutMs: 1100,
        maxConcurrent: 4,
        debounceMs: 20,
        budget: {
            areaPolicy: 'cell',
            estimatedCost: 'medium',
            maxDpr: 1.25,
            reducedMaxDpr: 1,
        },
    });

    return registry;
}

export const mageWarsFxRegistry = createRegistry();
