// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BetrayalEventChoiceSurface } from '../eventChoiceSurface';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../../core', () => ({ UI_Z_INDEX: { overlayRaised: 120 } }));
vi.mock('../atlasFrameSurface', () => ({ DiscoveryAtlasFrame: () => <div>正式事件卡</div> }));
vi.mock('../recentRollSurface', () => ({ RecentRollPanel: () => <div>检定结果</div> }));
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
describe('事件选择的单一底栏', () => {
    it('候选与提交属于同一底栏，候选点击不提交奖励', () => {
        const input = props(); render(<BetrayalEventChoiceSurface {...input} />);
        const dock = screen.getByTestId('betrayal-decision-action-dock');
        for (const trait of input.traitChoices) {
            expect(dock.contains(screen.getByTestId(`betrayal-event-choice-trait-${trait}`))).toBe(true);
        }
        expect(dock.contains(screen.getByTestId('betrayal-event-choice-confirm'))).toBe(true);
        fireEvent.click(screen.getByTestId('betrayal-event-choice-trait-knowledge'));
        expect(input.onSelectTrait).toHaveBeenCalledWith('knowledge');
        expect(input.onResolve).not.toHaveBeenCalled();
    });
    it('不选地图目标时使用全屏命中遮罩，事件内容与操作栏分区', () => {
        render(<BetrayalEventChoiceSurface {...props()} />);
        expect(screen.getByTestId('betrayal-event-choice-backdrop').className).toContain('inset-0');
        const content = screen.getByTestId('betrayal-event-choice-content');
        expect(content.contains(screen.getByTestId('betrayal-decision-action-dock'))).toBe(false);
    });
    it('已完成的属性保留原槽位并禁用，不把剩余属性重新排位', () => {
        const input = props();
        input.choice.effect = { mode: 'allTraitChecks', traits: ['speed', 'knowledge', 'sanity'] } as any;
        input.traitChoices = ['speed', 'knowledge', 'sanity'];
        input.allTraitCheck = { sourceTitle: '吊死鬼', playerId: '0', results: [{ trait: 'might', total: 5, dice: [2, 2, 1], passiveBonus: 0, passed: true }] };
        input.showAcceptButton = false;
        render(<BetrayalEventChoiceSurface {...input} />);
        const might = screen.getByTestId('betrayal-event-choice-trait-might') as HTMLButtonElement;
        expect(might.disabled).toBe(true);
        expect(might.textContent).toContain('5');
        const choices = screen.getByTestId('betrayal-event-choice-traits');
        expect([...choices.querySelectorAll('button')].map(button => button.dataset.testid)).toEqual(
            ['might', 'speed', 'knowledge', 'sanity'].map(trait => `betrayal-event-choice-trait-${trait}`),
        );
    });

    it('投骰时保留属性入口，但不提前泄露当前点数或奖励阶段', () => {
        const input = props();
        input.choice.effect = { mode: 'allTraitChecks', traits: ['speed', 'knowledge', 'sanity'] } as any;
        input.traitChoices = ['speed', 'knowledge', 'sanity'];
        input.allTraitCheck = { sourceTitle: '吊死鬼', playerId: '0', results: [{ trait: 'might', total: 5, dice: [2, 2, 1], passiveBonus: 0, passed: true }] };
        input.roll = { trait: 'might' } as any;
        input.isResolvingTraitRoll = true;
        input.resultReadable = false;
        input.disableTraitChoices = true;
        const view = render(<BetrayalEventChoiceSurface {...input} />);
        expect(screen.getByTestId('betrayal-event-choice-trait-might').textContent).not.toContain('5');
        expect((screen.getByTestId('betrayal-event-choice-trait-speed') as HTMLButtonElement).disabled).toBe(true);
        expect(screen.getByText('检定结果')).toBeTruthy();
        view.rerender(<BetrayalEventChoiceSurface {...input} resultReadable disableTraitChoices={false} />);
        expect(screen.getByTestId('betrayal-event-choice-trait-might').textContent).toContain('5');
        const reward = props();
        reward.choice.allTraitCheckProgress = { results: input.allTraitCheck.results };
        view.rerender(<BetrayalEventChoiceSurface {...reward} isResolvingTraitRoll resultReadable={false} />);
        expect(screen.queryByText('board.discovery.chooseRewardTrait')).toBeNull();
        expect(screen.getByText('board.status.chooseCheckTrait')).toBeTruthy();
    });

});
