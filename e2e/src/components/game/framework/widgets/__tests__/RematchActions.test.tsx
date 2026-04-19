/**
 * RematchActions 向后兼容测试
 *
 * Feature: dicethrone-game-over-screen, Property 5: 框架层向后兼容
 *
 * 验证：不传 renderButton 时，渲染输出与扩展前一致——
 * 相同的 DOM 结构、相同的 CSS 类、相同的交互行为。
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RematchActions } from '../RematchActions';
import type { RematchButtonProps } from '../RematchActions';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
}));

// Mock react-i18next：identity 函数，返回 key 本身
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

beforeEach(() => {
    vi.clearAllMocks();
});

// Feature: dicethrone-game-over-screen, Property 5: 框架层向后兼容
describe('RematchActions 向后兼容（不传 renderButton）', () => {
    // 1. 单人模式：渲染 play-again 和 back-to-lobby 按钮，使用 HoverOverlayLabel
    it('单人模式：渲染 play-again 和 back-to-lobby 按钮，包含正确的 data-testid', () => {
        const reset = vi.fn();
        const { container } = render(
            <RematchActions
                playerID="0"
                reset={reset}
                isMultiplayer={false}
            />,
        );

        // 容器 data-testid 和模式标记
        const actions = screen.getByTestId('rematch-actions');
        expect(actions).toHaveAttribute('data-rematch-mode', 'single');

        // play-again 按钮存在且包含 HoverOverlayLabel 文本
        const playAgainBtn = screen.getByTestId('rematch-play-again');
        expect(playAgainBtn.tagName).toBe('BUTTON');
        expect(playAgainBtn).toHaveTextContent('rematch.playAgain');

        // back-to-lobby 按钮存在
        const backBtn = screen.getByTestId('rematch-back-to-lobby');
        expect(backBtn.tagName).toBe('BUTTON');
        expect(backBtn).toHaveTextContent('rematch.backToLobby');

        // HoverOverlayLabel 渲染了 span.relative.z-10
        const hoverSpans = container.querySelectorAll('span.relative.z-10');
        expect(hoverSpans.length).toBe(2); // play-again + back-to-lobby

        // 点击 play-again 调用 reset
        fireEvent.click(playAgainBtn);
        expect(reset).toHaveBeenCalledTimes(1);

        // 点击 back-to-lobby 导航到首页
        fireEvent.click(backBtn);
        expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    // 2. 多人模式 - 未投票：渲染 vote 按钮、投票点、back-to-lobby
    it('多人模式未投票：渲染 vote 按钮、投票点、back-to-lobby', () => {
        const onVote = vi.fn();
        render(
            <RematchActions
                playerID="0"
                isMultiplayer={true}
                totalPlayers={2}
                rematchState={{ votes: { '0': false, '1': false }, ready: false }}
                onVote={onVote}
            />,
        );

        const actions = screen.getByTestId('rematch-actions');
        expect(actions).toHaveAttribute('data-rematch-mode', 'multi');
        expect(actions).toHaveAttribute('data-rematch-voted', 'false');
        expect(actions).toHaveAttribute('data-rematch-ready', 'false');

        // vote 按钮
        const voteBtn = screen.getByTestId('rematch-vote');
        expect(voteBtn.tagName).toBe('BUTTON');
        expect(voteBtn).toHaveTextContent('rematch.votePlayAgain');

        // 投票点
        const voteDots = screen.getByTestId('rematch-vote-dots');
        const dots = voteDots.querySelectorAll('span');
        expect(dots.length).toBe(2);

        // back-to-lobby
        expect(screen.getByTestId('rematch-back-to-lobby')).toBeInTheDocument();

        // 不应出现 cancel-vote、waiting、restarting
        expect(screen.queryByTestId('rematch-cancel-vote')).toBeNull();
        expect(screen.queryByTestId('rematch-waiting')).toBeNull();
        expect(screen.queryByTestId('rematch-restarting')).toBeNull();

        // 点击 vote 调用 onVote
        fireEvent.click(voteBtn);
        expect(onVote).toHaveBeenCalledTimes(1);
    });

    // 3. 多人模式 - 已投票：渲染 cancel-vote、投票点、等待文本、back-to-lobby
    it('多人模式已投票：渲染 cancel-vote、投票点、等待文本、back-to-lobby', () => {
        const onVote = vi.fn();
        render(
            <RematchActions
                playerID="0"
                isMultiplayer={true}
                totalPlayers={2}
                rematchState={{ votes: { '0': true, '1': false }, ready: false }}
                onVote={onVote}
            />,
        );

        const actions = screen.getByTestId('rematch-actions');
        expect(actions).toHaveAttribute('data-rematch-voted', 'true');
        expect(actions).toHaveAttribute('data-rematch-ready', 'false');

        // cancel-vote 按钮
        const cancelBtn = screen.getByTestId('rematch-cancel-vote');
        expect(cancelBtn.tagName).toBe('BUTTON');
        expect(cancelBtn).toHaveTextContent('rematch.cancelVote');

        // 投票点（其中一个应为已投票样式）
        const voteDots = screen.getByTestId('rematch-vote-dots');
        const dots = voteDots.querySelectorAll('span');
        expect(dots.length).toBe(2);
        // 第一个玩家已投票 → 绿色样式
        expect(dots[0].className).toContain('bg-emerald-400');
        // 第二个玩家未投票 → 灰色样式
        expect(dots[1].className).toContain('bg-white/30');

        // 等待文本
        const waiting = screen.getByTestId('rematch-waiting');
        expect(waiting).toHaveTextContent('rematch.waitingForOpponent');

        // back-to-lobby
        expect(screen.getByTestId('rematch-back-to-lobby')).toBeInTheDocument();

        // 不应出现 vote、restarting
        expect(screen.queryByTestId('rematch-vote')).toBeNull();
        expect(screen.queryByTestId('rematch-restarting')).toBeNull();

        // 点击 cancel-vote 调用 onVote（toggle）
        fireEvent.click(cancelBtn);
        expect(onVote).toHaveBeenCalledTimes(1);
    });

    // 4. 多人模式 - ready：渲染 restarting 指示器（div，非 button）、back-to-lobby
    it('多人模式 ready：渲染 restarting 指示器（div）和 back-to-lobby', () => {
        render(
            <RematchActions
                playerID="0"
                isMultiplayer={true}
                totalPlayers={2}
                rematchState={{ votes: { '0': true, '1': true }, ready: true }}
            />,
        );

        const actions = screen.getByTestId('rematch-actions');
        expect(actions).toHaveAttribute('data-rematch-ready', 'true');

        // restarting 指示器是 div，不是 button
        const restarting = screen.getByTestId('rematch-restarting');
        expect(restarting.tagName).toBe('DIV');
        expect(restarting).toHaveTextContent('rematch.restarting');
        expect(restarting.className).toContain('animate-pulse');
        expect(restarting.className).toContain('text-emerald-400');

        // back-to-lobby 仍然存在
        expect(screen.getByTestId('rematch-back-to-lobby')).toBeInTheDocument();

        // 不应出现 vote、cancel-vote、waiting
        expect(screen.queryByTestId('rematch-vote')).toBeNull();
        expect(screen.queryByTestId('rematch-cancel-vote')).toBeNull();
        expect(screen.queryByTestId('rematch-waiting')).toBeNull();
    });

    // 5. 传入 renderButton：验证自定义渲染函数被调用，接收正确的 RematchButtonProps
    it('传入 renderButton 时，自定义渲染函数被调用并接收正确的 props', () => {
        const renderButton = vi.fn((props: RematchButtonProps) => (
            <button data-testid={`custom-${props.role}`} onClick={props.onClick}>
                {props.label}
            </button>
        ));

        render(
            <RematchActions
                playerID="0"
                reset={() => {}}
                isMultiplayer={false}
                renderButton={renderButton}
            />,
        );

        // renderButton 被调用了 2 次（playAgain + backToLobby）
        expect(renderButton).toHaveBeenCalledTimes(2);

        // 验证 playAgain 调用的 props
        const playAgainCall = renderButton.mock.calls.find(
            (call) => call[0].role === 'playAgain',
        );
        expect(playAgainCall).toBeDefined();
        expect(playAgainCall![0].label).toBe('rematch.playAgain');
        expect(typeof playAgainCall![0].onClick).toBe('function');

        // 验证 backToLobby 调用的 props
        const backCall = renderButton.mock.calls.find(
            (call) => call[0].role === 'backToLobby',
        );
        expect(backCall).toBeDefined();
        expect(backCall![0].label).toBe('rematch.backToLobby');
        expect(typeof backCall![0].onClick).toBe('function');

        // 默认的 HoverOverlayLabel 不应出现
        expect(screen.queryByTestId('rematch-play-again')).toBeNull();
        expect(screen.queryByTestId('rematch-back-to-lobby')).toBeNull();

        // 自定义按钮已渲染
        expect(screen.getByTestId('custom-playAgain')).toBeInTheDocument();
        expect(screen.getByTestId('custom-backToLobby')).toBeInTheDocument();
    });

    // 多人模式 + renderButton：验证 restarting role 也走自定义渲染
    it('多人模式 ready + renderButton：restarting 走自定义渲染', () => {
        const renderButton = vi.fn((props: RematchButtonProps) => (
            <span data-testid={`custom-${props.role}`}>{props.label}</span>
        ));

        render(
            <RematchActions
                playerID="0"
                isMultiplayer={true}
                totalPlayers={2}
                rematchState={{ votes: { '0': true, '1': true }, ready: true }}
                renderButton={renderButton}
            />,
        );

        // restarting 走自定义渲染，不再是默认的 div
        expect(screen.getByTestId('custom-restarting')).toBeInTheDocument();
        expect(screen.queryByTestId('rematch-restarting')).toBeNull();

        // 验证 restarting 的 props
        const restartingCall = renderButton.mock.calls.find(
            (call) => call[0].role === 'restarting',
        );
        expect(restartingCall).toBeDefined();
        expect(restartingCall![0].label).toBe('rematch.restarting');
        expect(restartingCall![0].disabled).toBe(true);
    });

    // back-to-lobby 使用 onBackToLobby 回调（而非默认导航）
    it('onBackToLobby 回调优先于默认导航', () => {
        const onBackToLobby = vi.fn();
        render(
            <RematchActions
                playerID="0"
                isMultiplayer={false}
                onBackToLobby={onBackToLobby}
            />,
        );

        fireEvent.click(screen.getByTestId('rematch-back-to-lobby'));
        expect(onBackToLobby).toHaveBeenCalledTimes(1);
        expect(mockNavigate).not.toHaveBeenCalled();
    });
});
