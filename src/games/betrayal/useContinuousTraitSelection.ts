import { useCallback, useEffect, useState } from 'react';
import type { BetrayalTraitKey } from './game';

/** Carries one explicit user selection across the existing roll-finalize command. */
export function useContinuousTraitSelection({ currentChoiceId, nextChoiceId, canAdvance, onAdvance, onSelect }: {
    currentChoiceId: string | null;
    nextChoiceId: string | null;
    canAdvance: boolean;
    onAdvance: () => void;
    onSelect: (trait: BetrayalTraitKey) => void;
}) {
    const [intent, setIntent] = useState<{ choiceId: string; trait: BetrayalTraitKey } | null>(null);
    useEffect(() => {
        if (!intent) return;
        if (currentChoiceId === intent.choiceId) {
            setIntent(null);
            onSelect(intent.trait);
        } else if (!nextChoiceId) {
            setIntent(null);
        }
    }, [currentChoiceId, nextChoiceId, intent, onSelect]);
    return useCallback((trait: BetrayalTraitKey) => {
        if (!nextChoiceId) { onSelect(trait); return; }
        if (!canAdvance) return;
        setIntent({ choiceId: nextChoiceId, trait });
        onAdvance();
    }, [nextChoiceId, canAdvance, onAdvance, onSelect]);
}
