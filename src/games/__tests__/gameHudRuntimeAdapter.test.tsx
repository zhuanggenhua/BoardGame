import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MatchState } from '../../engine/types';
import { diceThroneGameRuntimeAdapter } from '../dicethrone/runtimeAdapter';
import { mageWarsGameRuntimeAdapter } from '../mage-wars/runtimeAdapter';
import { smashUpGameRuntimeAdapter } from '../smashup/runtimeAdapter';
import {
    GameHudRuntimeSettingsSection,
    tryHandleGameHudForceDismiss,
} from '../gameHudRuntimeAdapter';
import { useGameHudFabLayout } from '../useGameHudFabLayout';

vi.mock('../registry', () => ({
    getGameImplementation: (gameId: string) => (
        gameId === 'smashup'
            ? { runtimeAdapter: smashUpGameRuntimeAdapter }
            : gameId === 'dicethrone'
                ? { runtimeAdapter: diceThroneGameRuntimeAdapter }
                : gameId === 'mage-wars'
                    ? { runtimeAdapter: mageWarsGameRuntimeAdapter }
                : null
    ),
    subscribeGameImplementationReady: () => () => undefined,
}));

function GameHudFabLayoutProbe({ gameId }: { gameId: string }) {
    const layout = useGameHudFabLayout(gameId);
    return (
        <div
            data-testid="game-hud-fab-layout"
            data-position={layout?.position}
            data-storage-key={layout?.storageKey}
            data-legacy-offset-key={layout?.legacyOffsetStorageKey}
            data-offset={JSON.stringify(layout?.resolveInitialOffset?.(720))}
        />
    );
}

describe('gameHudRuntimeAdapter', () => {
    it('通用图形设置始终渲染，smashup 额外渲染专属设置', () => {
        const t = (key: string) => key;

        const { rerender } = render(<>{GameHudRuntimeSettingsSection({ gameId: 'splendor', t })}</>);
        expect(screen.getByText('hud.graphics.title')).toBeInTheDocument();
        expect(screen.queryByText('hud.smashup.title')).toBeNull();

        rerender(<>{GameHudRuntimeSettingsSection({ gameId: 'smashup', t })}</>);
        expect(screen.getByText('hud.graphics.title')).toBeInTheDocument();
        expect(screen.getByText('hud.smashup.title')).toBeInTheDocument();
        expect(screen.getByText('hud.smashup.overlay')).toBeInTheDocument();
    });

    it('Mage Wars HUD FAB 配置通过当前游戏 runtime adapter 提供，保留原布局参数', () => {
        const { rerender } = render(<GameHudFabLayoutProbe gameId="mage-wars" />);
        expect(screen.getByTestId('game-hud-fab-layout')).toHaveAttribute('data-position', 'top-left');
        expect(screen.getByTestId('game-hud-fab-layout')).toHaveAttribute('data-storage-key', 'game_hud_fab_position:mage-wars:v4');
        expect(screen.getByTestId('game-hud-fab-layout')).toHaveAttribute('data-legacy-offset-key', 'game_hud_fab_offset:mage-wars');
        expect(screen.getByTestId('game-hud-fab-layout')).toHaveAttribute('data-offset', JSON.stringify({ left: 160 }));

        rerender(<GameHudFabLayoutProbe gameId="dicethrone" />);
        expect(screen.getByTestId('game-hud-fab-layout')).toHaveAttribute('data-position', 'top-right');
        expect(screen.getByTestId('game-hud-fab-layout')).toHaveAttribute('data-storage-key', 'game_hud_fab_position:dicethrone:v1');
        expect(screen.getByTestId('game-hud-fab-layout')).toHaveAttribute('data-offset', JSON.stringify({ top: -48 }));
    });

    it('dicethrone 奖励骰不得由 HUD force dismiss 代替骰盘普通确认', () => {
        const dispatch = vi.fn();
        const state = {
            core: {
                pendingBonusDiceSettlement: {
                    attackerId: '0',
                },
            },
        } as unknown as MatchState<unknown>;

        expect(tryHandleGameHudForceDismiss({
            gameId: 'dicethrone',
            state,
            playerId: '0',
            dispatch,
        })).toBe(false);
        expect(dispatch).not.toHaveBeenCalled();
    });

    it('dicethrone bonus-dice 不属于当前玩家时，不应吞掉共享 HUD force dismiss', () => {
        const dispatch = vi.fn();
        const state = {
            core: {
                pendingBonusDiceSettlement: {
                    attackerId: '1',
                },
            },
        } as unknown as MatchState<unknown>;

        expect(tryHandleGameHudForceDismiss({
            gameId: 'dicethrone',
            state,
            playerId: '0',
            dispatch,
        })).toBe(false);
        expect(dispatch).not.toHaveBeenCalled();
    });
});
