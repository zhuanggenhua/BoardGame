import { FxRegistry } from '../../../engine/fx';
import { MW_FX } from './fxCues';
import { AttackImpactRenderer, DamageImpactRenderer, SpellCastRenderer, SpellPushRenderer } from './fxRenderers';

function createRegistry(): FxRegistry {
    const registry = new FxRegistry();

    registry.register(MW_FX.SPELL_CAST, SpellCastRenderer, {
        timeoutMs: 1500,
        maxConcurrent: 3,
        debounceMs: 40,
        budget: {
            areaPolicy: 'cell',
            estimatedCost: 'medium',
            maxDpr: 1.25,
            reducedMaxDpr: 1,
        },
    });

    registry.register(MW_FX.ATTACK_IMPACT, AttackImpactRenderer, {
        timeoutMs: 1800,
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
        timeoutMs: 1250,
        maxConcurrent: 3,
        debounceMs: 40,
        budget: {
            areaPolicy: 'cell',
            estimatedCost: 'low',
            maxDpr: 1.25,
            reducedMaxDpr: 1,
        },
    });
    registry.register(MW_FX.SPELL_TELEPORT, SpellCastRenderer, {
        timeoutMs: 1500,
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
