import type { GameHudLayoutResolver } from '../components/game/framework/widgets/gameHudLayout';
import { MOBILE_MAX_VIEWPORT_WIDTH } from '../shared/mobileSupport';

// These two games predate runtimeAdapter. Keep their existing layout here until
// their client entries supply the adapter, without coupling the shared HUD to IDs.
const legacyLayouts: Record<string, GameHudLayoutResolver> = {
    betrayal: ({ isSetupPhase, state }) => ({
        position: isSetupPhase || (state as { core?: { phase?: unknown } } | null)?.core?.phase === 'characterSelect'
            ? 'top-right' : 'bottom-right',
        storageKey: 'game_hud_fab_position:betrayal:v2',
    }),
    tictactoe: ({ viewportWidth, viewportHeight }) => viewportWidth > 0
        && viewportWidth <= MOBILE_MAX_VIEWPORT_WIDTH && viewportHeight > viewportWidth
        ? {
            position: 'top-right',
            storageKey: 'game_hud_fab_position:tictactoe:portrait:v1',
            initialOffset: { top: Math.max(0, Math.min(64, viewportHeight * 0.075)) },
        } : {},
};

export function resolveGameHudLayout(gameId?: string | null, resolver?: GameHudLayoutResolver): GameHudLayoutResolver | undefined {
    return resolver ?? legacyLayouts[gameId ?? ''];
}
