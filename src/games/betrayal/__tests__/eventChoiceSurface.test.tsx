// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BetrayalEventChoiceSurface } from '../eventChoiceSurface';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../../core', () => ({ UI_Z_INDEX: { overlayRaised: 120 } }));
vi.mock('../atlasFrameSurface', () => ({ DiscoveryAtlasFrame: () => <div>event card</div> }));
vi.mock('../recentRollSurface', () => ({ RecentRollPanel: () => <div>roll result</div> }));

const props = (): React.ComponentProps<typeof BetrayalEventChoiceSurface> => ({
    choice: { sourceTitle: '吊死鬼', effect: { mode: 'chosenTrait', allowedTraits: ['might', 'speed', 'knowledge', 'sanity'], amount: 1 } } as any,
    isMobileViewport: false, isEventSymbolSkip: false, awaitsMapTargetClick: false,
    hasMapTargetRooms: false, hasResultPanel: true, latestDiscoveryVisual: null,
    roll: null, resultReadable: true, rollActorLabel: null, allTraitCheck: null,
    traitChoices: ['might', 'speed', 'knowledge', 'sanity'], selectedTrait: null,
    hasItemChoice: false, itemChoiceCards: [], selectedCardId: null,
    showDamageChoice: false, damageChoice: null, selectedDamageTraits: [],
    explorer: {} as any, phase: 'exploration' as any, locale: 'zh-CN',
    ready: false, canDecline: false, showAcceptButton: true,
    onSelectTrait: vi.fn(), onSelectCard: vi.fn(), onAdjustDamageTrait: vi.fn(),
    canIncrementDamageTrait: () => false, onResolve: vi.fn(),
});

afterEach(cleanup);

describe('event choice behavior', () => {
    it('keeps reward selection local until the player confirms it', () => {
        const input = props();
        input.ready = true;
        const view = render(<BetrayalEventChoiceSurface {...input} />);

        fireEvent.click(screen.getByTestId('betrayal-event-choice-trait-knowledge'));
        expect(input.onSelectTrait).toHaveBeenCalledWith('knowledge');
        expect(input.onResolve).not.toHaveBeenCalled();

        view.rerender(
            <BetrayalEventChoiceSurface {...input} selectedTrait="knowledge" />,
        );
        fireEvent.click(screen.getByTestId('betrayal-event-choice-confirm'));
        expect(input.onResolve).toHaveBeenCalledWith(true);
    });

    it('does not allow a completed trait check to be selected again', () => {
        const input = props();
        input.choice.effect = {
            mode: 'allTraitChecks',
            traits: ['speed', 'knowledge', 'sanity'],
        } as any;
        input.traitChoices = ['speed', 'knowledge', 'sanity'];
        input.allTraitCheck = {
            sourceTitle: '吊死鬼',
            playerId: '0',
            results: [{ trait: 'might', total: 5, dice: [2, 2, 1], passiveBonus: 0, passed: true }],
        };
        input.showAcceptButton = false;
        render(<BetrayalEventChoiceSurface {...input} />);

        expect((screen.getByTestId('betrayal-event-choice-trait-might') as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByTestId('betrayal-event-choice-trait-speed') as HTMLButtonElement).disabled).toBe(false);
        fireEvent.click(screen.getByTestId('betrayal-event-choice-trait-speed'));
        expect(input.onSelectTrait).toHaveBeenCalledWith('speed');
        expect(input.onResolve).not.toHaveBeenCalled();
    });

    it('allows the next trait check only after the current roll is readable', () => {
        const input = props();
        input.choice.effect = {
            mode: 'allTraitChecks',
            traits: ['speed', 'knowledge', 'sanity'],
        } as any;
        input.traitChoices = ['speed', 'knowledge', 'sanity'];
        input.allTraitCheck = {
            sourceTitle: '吊死鬼',
            playerId: '0',
            results: [{ trait: 'might', total: 5, dice: [2, 2, 1], passiveBonus: 0, passed: true }],
        };
        input.roll = { trait: 'might' } as any;
        input.isResolvingTraitRoll = true;
        input.resultReadable = false;
        input.disableTraitChoices = true;

        const view = render(<BetrayalEventChoiceSurface {...input} />);
        const nextCheck = screen.getByTestId('betrayal-event-choice-trait-speed') as HTMLButtonElement;
        expect(nextCheck.disabled).toBe(true);

        view.rerender(
            <BetrayalEventChoiceSurface
                {...input}
                resultReadable
                disableTraitChoices={false}
            />,
        );
        expect(nextCheck.disabled).toBe(false);
        fireEvent.click(nextCheck);
        expect(input.onSelectTrait).toHaveBeenCalledWith('speed');
        expect(input.onResolve).not.toHaveBeenCalled();
    });
});
