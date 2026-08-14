import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AbilityOverlays } from '../AbilityOverlays';

describe('AbilityOverlays source selection', () => {
    it('奖励骰期仍按已记录来源显示选中技能，而不是按当前骰盘可用技能推导', () => {
        const { container } = render(
            <AbilityOverlays
                isEditing={false}
                availableAbilityIds={[]}
                canSelect={false}
                canHighlight={false}
                onSelectAbility={vi.fn()}
                selectedAbilityId="death-blossom"
                characterId="ninja"
            />,
        );

        const sourceSlot = container.querySelector('[data-ability-slot="sky"]');
        const diceDerivedSlot = container.querySelector('[data-ability-slot="lotus"]');

        expect(sourceSlot).toHaveAttribute('data-selected-ability-id', 'death-blossom');
        expect(sourceSlot).toHaveAttribute('data-is-selected', 'true');
        expect(sourceSlot).toHaveAttribute('data-available-ability-id', '');
        expect(sourceSlot).toHaveAttribute('data-can-click', 'false');
        expect(container.querySelector('[data-testid="dt-ability-selected-sky"]')).not.toBeNull();

        expect(diceDerivedSlot).toHaveAttribute('data-is-selected', 'false');
        expect(container.querySelector('[data-testid="dt-ability-selected-lotus"]')).toBeNull();
    });
});
