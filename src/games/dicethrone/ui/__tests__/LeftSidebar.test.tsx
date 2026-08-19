import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { initHeroState } from '../../domain/characters';
import { TOKEN_IDS } from '../../domain/ids';
import { createQueuedRandom } from '../../__tests__/test-utils';
import { TIANSHI_TOKENS } from '../../heroes/tianshi/tokens';
import { LeftSidebar } from '../LeftSidebar';

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: () => undefined },
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('../../../../components/common/overlays/InfoTooltip', () => ({
    InfoTooltip: ({ title, isVisible }: { title: unknown; isVisible: boolean }) => (
        <div data-testid="info-tooltip-probe" data-visible={String(isVisible)}>
            {String(title)}
        </div>
    ),
}));

describe('LeftSidebar 飞行 Token 入口', () => {
    it('阶段牌恢复可读尺寸后仍保留左侧 Token 两排容量', () => {
        const player = initHeroState('0', 'tianshi', createQueuedRandom([1]));
        player.tokens = {
            [TOKEN_IDS.FLIGHT]: 1,
            [TOKEN_IDS.PURIFY]: 1,
            [TOKEN_IDS.TAIJI]: 1,
            [TOKEN_IDS.EVASIVE]: 1,
            [TOKEN_IDS.ACCURACY]: 1,
            [TOKEN_IDS.CRIT]: 1,
        };

        const { container } = render(
            <LeftSidebar
                currentPhase="main1"
                viewPlayer={player}
                playerId="0"
                locale="zh-CN"
                tokenDefinitions={TIANSHI_TOKENS}
            />,
        );

        const tokenNodes = Array.from(container.querySelectorAll('[data-token-id]'));
        expect(tokenNodes).toHaveLength(6);

        const tokenContainer = container.querySelector('[data-tutorial-id="status-tokens"] > div');
        expect(tokenContainer).not.toBeNull();
        expect(tokenContainer).toHaveClass('flex-wrap-reverse');
        expect((tokenContainer as HTMLElement).style.maxWidth).toBe('13.7vw');
        expect(screen.getByTestId('turn-order-panel')).toContainElement(screen.getByTestId('dt-phase-indicator'));
    });

    it('进攻或防御掷骰时可点击飞行 Token 并交给上层处理', () => {
        const player = initHeroState('0', 'tianshi', createQueuedRandom([1]));
        player.tokens[TOKEN_IDS.FLIGHT] = 1;
        const onFlightClick = vi.fn();

        render(
            <LeftSidebar
                currentPhase="offensiveRoll"
                viewPlayer={player}
                playerId="0"
                locale="zh-CN"
                tokenDefinitions={TIANSHI_TOKENS}
                canUseFlight
                onFlightClick={onFlightClick}
            />,
        );

        fireEvent.click(screen.getByTestId(`dt-player-0-token-${TOKEN_IDS.FLIGHT}`));

        expect(onFlightClick).toHaveBeenCalledTimes(1);
    });

    it('响应阶段直接点击 Token 本体，左侧不再渲染独立提示框且仍保留悬浮说明', () => {
        const player = initHeroState('0', 'tianshi', createQueuedRandom([1]));
        player.tokens[TOKEN_IDS.FLIGHT] = 1;
        const onTokenClick = vi.fn();

        render(
            <LeftSidebar
                currentPhase="defensiveRoll"
                viewPlayer={player}
                playerId="0"
                locale="zh-CN"
                tokenDefinitions={TIANSHI_TOKENS}
                responseTokenIds={[TOKEN_IDS.FLIGHT]}
                onResponseTokenClick={onTokenClick}
            />,
        );

        const flightToken = screen.getByTestId(`dt-player-0-token-${TOKEN_IDS.FLIGHT}`);
        expect(screen.getByText(new RegExp(`tokens\\.${TOKEN_IDS.FLIGHT}\\.name`))).toBeInTheDocument();

        fireEvent.click(flightToken);

        expect(onTokenClick).toHaveBeenCalledWith(TOKEN_IDS.FLIGHT);
        expect(screen.queryByTestId('dicethrone-token-response-inline')).not.toBeInTheDocument();
    });
});
