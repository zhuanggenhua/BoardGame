import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AbilityOverlays } from '../AbilityOverlays';

const mockUseCoarsePointer = vi.fn(() => false);
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
    initReactI18next: {
        type: '3rdParty',
        init: vi.fn(),
    },
}));

vi.mock('../../../components/common/media/CardPreview', () => ({
    CardPreview: ({ previewRef, className }: { previewRef?: { atlasId?: string; index?: number }; className?: string }) => (
        <div
            data-testid="mock-card-preview"
            data-atlas-id={previewRef?.atlasId ?? ''}
            data-preview-index={previewRef?.index ?? -1}
            className={className}
        />
    ),
}));

vi.mock('../../../hooks/ui/useCoarsePointer', () => ({
    useCoarsePointer: () => mockUseCoarsePointer(),
}));

describe('AbilityOverlays', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        mockUseCoarsePointer.mockReturnValue(false);
    });

    const renderAbilityOverlays = (overrides: Partial<React.ComponentProps<typeof AbilityOverlays>> = {}) => {
        return render(
            <div style={{ position: 'relative', width: 1200, height: 900 }}>
                <AbilityOverlays
                    isEditing={false}
                    availableAbilityIds={[]}
                    canSelect={false}
                    canHighlight={false}
                    onSelectAbility={vi.fn()}
                    selectedAbilityId={undefined}
                    activatingAbilityId={undefined}
                    abilityLevels={{ 'fist-technique': 2 }}
                    characterId="monk"
                    locale="zh-CN"
                    onMagnifyCard={vi.fn()}
                    {...overrides}
                />
            </div>
        );
    };

    it('已放置升级卡在无主点击语义时可直接点击放大', () => {
        const onMagnifyCard = vi.fn();
        const { container } = renderAbilityOverlays({ onMagnifyCard });

        const fistSlot = container.querySelector('[data-ability-slot="fist"]');
        expect(fistSlot).not.toBeNull();

        fireEvent.click(fistSlot!);

        expect(onMagnifyCard).toHaveBeenCalledTimes(1);
        expect(onMagnifyCard.mock.calls[0]?.[0]).toMatchObject({ id: 'card-thrust-punch-2' });
    });

    it('可选技能槽位点击仍优先走选中逻辑', () => {
        const onSelectAbility = vi.fn();
        const onMagnifyCard = vi.fn();
        const { container } = renderAbilityOverlays({
            availableAbilityIds: ['fist-technique'],
            canSelect: true,
            onSelectAbility,
            onMagnifyCard,
        });

        const fistSlot = container.querySelector('[data-ability-slot="fist"]');
        expect(fistSlot).not.toBeNull();

        fireEvent.click(fistSlot!);

        expect(onSelectAbility).toHaveBeenCalledWith('fist-technique');
        expect(onMagnifyCard).not.toHaveBeenCalled();
    });

    it('桌面端可选升级槽位提供独立放大按钮，不抢占选中点击', () => {
        const onSelectAbility = vi.fn();
        const onMagnifyCard = vi.fn();
        const { container, getByTestId } = renderAbilityOverlays({
            availableAbilityIds: ['fist-technique'],
            canSelect: true,
            onSelectAbility,
            onMagnifyCard,
        });

        const fistSlot = container.querySelector('[data-ability-slot="fist"]');
        expect(fistSlot).not.toBeNull();

        fireEvent.click(getByTestId('dt-upgrade-magnify-button-fist'));

        expect(onMagnifyCard).toHaveBeenCalledTimes(1);
        expect(onMagnifyCard.mock.calls[0]?.[0]).toMatchObject({ id: 'card-thrust-punch-2' });
        expect(onSelectAbility).not.toHaveBeenCalled();
    });

    it('高亮但不可选时点击仍保留原提示逻辑，不会被放大吞掉', () => {
        const onHighlightedAbilityClick = vi.fn();
        const onMagnifyCard = vi.fn();
        const { container } = renderAbilityOverlays({
            availableAbilityIds: ['fist-technique'],
            canSelect: false,
            canHighlight: true,
            onHighlightedAbilityClick,
            onMagnifyCard,
        });

        const fistSlot = container.querySelector('[data-ability-slot="fist"]');
        expect(fistSlot).not.toBeNull();

        fireEvent.click(fistSlot!);

        expect(onHighlightedAbilityClick).toHaveBeenCalledTimes(1);
        expect(onMagnifyCard).not.toHaveBeenCalled();
    });

});
