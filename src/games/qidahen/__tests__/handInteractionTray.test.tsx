import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QidahenDomain } from '../domain';
import type { QidahenCore, QidahenHandLimitDiscardSelection } from '../domain/types';
import { QidahenHandInteractionTray } from '../ui/QidahenHandInteractionTray';
import { resolveQidahenHandInteraction } from '../ui/handInteractionView';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, values: Record<string, unknown>) => String(values.defaultValue)
            .replace(/\{\{(\w+)\}\}/g, (_match, key: string) => String(values[key])),
    }),
}));

afterEach(cleanup);

const freshCore = (): QidahenCore => ({
    ...QidahenDomain.setup(['0', '1', '2'], () => 0.5),
    selectedActionId: null,
    sunYuanhuaTechSelection: null,
    wheelRecruitTrainProgress: null,
});

const mountTray = (
    core: QidahenCore,
    previewVisible = true,
    handLimitSelection: QidahenHandLimitDiscardSelection | null = null,
    selectedHandLimitCardIds: string[] = [],
) => {
    const actions = {
        onResolveHandLimitDiscard: vi.fn(),
        onConfirmSelectedAction: vi.fn(),
        onCancelSelectedActionPreview: vi.fn(),
        onResolveSunYuanhuaTech: vi.fn(),
        onConfirmWheelDispatchPayment: vi.fn(),
        onConfirmWheelRecruitTrainPayment: vi.fn(),
    };
    const view = render(
        <QidahenHandInteractionTray
            interaction={resolveQidahenHandInteraction(core, previewVisible, handLimitSelection, selectedHandLimitCardIds)}
            bottom={309}
            {...actions}
        />,
    );
    return { ...view, actions };
};

describe('七大恨手牌决策托盘', () => {
    it('没有当前手牌决策时不占槽位，过期行动选中值不会重新打开支付', () => {
        const core = { ...freshCore(), selectedActionId: 'grant-pardon' };
        mountTray(core, false);
        expect(screen.queryByTestId('qidahen-hand-interaction-tray')).toBeNull();
    });

    it('势力行动显示真实选牌名称，费用不足不能确认，但仍可取消', () => {
        const core = { ...freshCore(), selectedActionId: 'grant-pardon', selectedPaymentCardIds: [] };
        const { actions } = mountTray(core);
        expect(screen.getByTestId('qidahen-action-payment-status').textContent).toContain('需弃 3 张');
        const confirm = screen.getByRole('button', { name: '确认执行' }) as HTMLButtonElement;
        expect(confirm.disabled).toBe(true);
        fireEvent.click(confirm);
        fireEvent.click(screen.getByRole('button', { name: '取消本次行动' }));
        expect(actions.onConfirmSelectedAction).not.toHaveBeenCalled();
        expect(actions.onCancelSelectedActionPreview).toHaveBeenCalledTimes(1);
    });

    it('选足费用后由原行动确认回调提交，托盘自身不修改手牌', () => {
        const core = freshCore();
        core.selectedActionId = 'grant-pardon';
        core.selectedPaymentCardIds = core.handCards.slice(0, 3).map((card) => card.id);
        const before = structuredClone(core);
        const { actions } = mountTray(core);
        const labels = core.handCards.slice(0, 3).map((card) => card.label).join('、');
        expect(screen.getByTestId('qidahen-action-payment-selected-cards').textContent).toContain(labels);
        fireEvent.click(screen.getByRole('button', { name: '确认执行' }));
        expect(actions.onConfirmSelectedAction).toHaveBeenCalledTimes(1);
        expect(actions.onConfirmWheelDispatchPayment).not.toHaveBeenCalled();
        expect(core).toEqual(before);
    });

    it('轮盘支付优先于遗留的势力行动预览，只提交轮盘支付', () => {
        const core = freshCore();
        Object.assign(core, {
            turnPhase: 'dispatch-targeting', wheelActionUsed: true, actionWheelPosition: 'wheel-diplomacy',
            payment: { required: 1, selected: 1, prompt: '' }, selectedActionId: 'grant-pardon',
            selectedPaymentCardIds: [core.handCards[0].id],
        });
        const { actions } = mountTray(core);
        expect(screen.queryByTestId('qidahen-action-payment-panel')).toBeNull();
        expect(screen.getByTestId('qidahen-wheel-dispatch-payment-status').textContent).toContain('需弃 1 张');
        fireEvent.click(screen.getByRole('button', { name: '确认弃牌' }));
        expect(actions.onConfirmWheelDispatchPayment).toHaveBeenCalledTimes(1);
        expect(actions.onConfirmSelectedAction).not.toHaveBeenCalled();
    });

    it('额外训练要求恰好一张牌，展示与确认保持同一支付用途', () => {
        const core = freshCore();
        core.wheelRecruitTrainProgress = {
            source: 'wheel', phase: 'payment', paymentPurpose: 'extra',
            actionsCompleted: 4, extraTrainingsCompleted: 0, trainingOnly: false, summaryLines: [],
        };
        core.selectedPaymentCardIds = [core.handCards[0].id];
        const { actions, rerender } = mountTray(core);
        expect(screen.getByText('额外训练 · 弃牌')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: '确认弃牌' }));
        expect(actions.onConfirmWheelRecruitTrainPayment).toHaveBeenCalledTimes(1);
        core.selectedPaymentCardIds.push(core.handCards[1].id);
        rerender(<QidahenHandInteractionTray interaction={resolveQidahenHandInteraction(core, true, null, [])} bottom={309} {...actions} />);
        expect((screen.getByRole('button', { name: '确认弃牌' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('突袭即使选足牌，没有合法地区也不能提交，并保留目标提示', () => {
        const core = freshCore();
        core.selectedActionId = 'raid';
        core.selectedPaymentCardIds = [core.handCards[0].id];
        core.regions = [];
        const { actions } = mountTray(core);
        expect(screen.getByTestId('qidahen-action-payment-hint').textContent).toContain('选择目标地区');
        fireEvent.click(screen.getByRole('button', { name: '确认执行' }));
        expect(actions.onConfirmSelectedAction).not.toHaveBeenCalled();
    });

    it('突袭支付同时保留目标、进攻来源、边界和已选牌', () => {
        const { rerender, actions } = mountTray(freshCore());
        rerender(<QidahenHandInteractionTray interaction={{
            kind: 'action', action: { id: 'raid', label: '突袭作战', cost: 1 },
            selectedCardLabels: ['银两'], selectedCount: 1, canConfirm: true,
            raidTarget: { targetRegionName: '叶赫部', resolutionHint: '辽东 → 叶赫部 · 平原 3 · 出兵3/战力8' },
        }} bottom={309} {...actions} />);
        expect(screen.getByTestId('qidahen-action-payment-hint').textContent).toContain('辽东 → 叶赫部 · 平原 3');
        expect(screen.getByTestId('qidahen-action-payment-selected-cards').textContent).toContain('银两');
        expect((screen.getByRole('button', { name: '确认执行' }) as HTMLButtonElement).disabled).toBe(false);
    });

    it('超手牌上限按当前选择数确认，不会使用另一项支付的选择数', () => {
        const core = freshCore();
        core.selectedPaymentCardIds = core.handCards.slice(0, 3).map((card) => card.id);
        const selection: QidahenHandLimitDiscardSelection = {
            factionId: 'ming', factionName: '大明', handCount: 17, handLimit: 15,
            requiredDiscardCount: 2, candidateCardIds: [], selectedCardIds: [],
        };
        const { actions, rerender } = mountTray(core, false, selection, ['a']);
        expect((screen.getByRole('button', { name: '确认弃牌' }) as HTMLButtonElement).disabled).toBe(true);
        rerender(<QidahenHandInteractionTray interaction={resolveQidahenHandInteraction(core, false, selection, ['a', 'b'])} bottom={309} {...actions} />);
        fireEvent.click(screen.getByRole('button', { name: '确认弃牌' }));
        expect(actions.onResolveHandLimitDiscard).toHaveBeenCalledTimes(1);
        expect(actions.onConfirmSelectedAction).not.toHaveBeenCalled();
    });

    it('孙元化支付不足时仍可明确跳过，不触发确认', () => {
        const core = freshCore();
        core.sunYuanhuaTechSelection = {
            source: 'sun-yuanhua', title: '孙元化科技', summary: '',
            requiredCardCount: 2, candidateCardIds: [], selectedCardIds: [],
        };
        const { actions } = mountTray(core);
        expect((screen.getByRole('button', { name: '确认打科技' }) as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(screen.getByRole('button', { name: '跳过孙元化科技' }));
        expect(actions.onResolveSunYuanhuaTech).toHaveBeenCalledExactlyOnceWith('skip');
    });
});
