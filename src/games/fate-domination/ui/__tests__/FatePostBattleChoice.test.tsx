import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createSimpleChoice } from '../../../../engine/systems/InteractionSystem';
import { FatePostBattleChoice } from '../FatePostBattleChoice';
import { FATE_SEAL_RESTORE_CHOICE } from '../../domain/postBattleChoice';
vi.mock('../../../../components/common/media/CardPreview', () => ({ CardPreview: ({ title }: { title: string }) => <div data-testid="source-card">{title}</div> }));
const choice = (id: string, playerId = '0') => createSimpleChoice(id, playerId, '战后恢复令咒', [
    { id: 'restore', label: '恢复一枚令咒', value: 'restore' }, { id: 'decline', label: '不恢复', value: 'decline' },
], { sourceId: FATE_SEAL_RESTORE_CHOICE, autoResolveIfSingle: false });
it('卡牌来源与两项选择同屏，选项只选中，唯一确认才提交', () => {
    const confirm = vi.fn();
    render(<FatePostBattleChoice interaction={choice('reward-0')} viewerId="0" onConfirm={confirm} />);
    expect(screen.getByTestId('source-card')).toBeTruthy();
    expect(screen.getByRole('button', { name: '确认选择' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '不恢复' })); expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '确认选择' })); expect(confirm).toHaveBeenCalledWith('reward-0', 'decline');
    expect(screen.queryByRole('button', { name: /取消|关闭/ })).toBeNull();
});
it('下一位奖励不沿用选中态；退出键不能丢弃已提交的结算', () => {
    const confirm = vi.fn(); const view = render(<FatePostBattleChoice interaction={choice('reward-0')} viewerId="0" onConfirm={confirm} />);
    fireEvent.click(screen.getByRole('button', { name: '恢复一枚令咒' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' }); expect(screen.getByRole('dialog')).toBeTruthy();
    view.rerender(<FatePostBattleChoice interaction={choice('reward-1', '1')} viewerId="1" onConfirm={confirm} />);
    expect(screen.getByRole('button', { name: '确认选择' })).toBeDisabled(); expect(confirm).not.toHaveBeenCalled();
});
it('其他在线席位不能操作该选择', () => {
    render(<FatePostBattleChoice interaction={choice('reward-0')} viewerId="1" onConfirm={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
});
