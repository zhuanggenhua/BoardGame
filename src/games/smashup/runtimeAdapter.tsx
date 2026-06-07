import type { MatchState } from '../../engine/types';
import type {
    GameRuntimeAdapter,
    GameHudRuntimeSuppressionInput,
    GameRuntimeSettingsSectionProps,
} from '../gameRuntimeAdapter';
import { getSmashUpReactionWindowPresentation } from './domain/reactionWindowState';
import { SMASHUP_FORCE_DISMISS_EVENT } from './ui/CardMagnifyOverlay';
import {
    SmashUpOverlayProvider,
    useSmashUpOverlay,
} from './ui/SmashUpOverlayContext';
import { isSmashUpPromptOwnedByPlayer } from './ui/interactionMode';

function shouldSuppressSmashUpHudFab({
    mode,
    state,
    playerId,
}: GameHudRuntimeSuppressionInput): boolean {
    if (!state) return false;

    const currentPrompt = state.sys?.interaction?.current as { playerId?: unknown } | null | undefined;
    const effectivePlayerId = playerId ?? (
        (mode === 'local' || mode === 'tutorial')
            ? ((state.core as Record<string, unknown> | undefined)?.currentPlayer as string | undefined) ?? null
            : null
    );

    if (!effectivePlayerId) {
        return Boolean(currentPrompt) || Boolean(getSmashUpReactionWindowPresentation(state as MatchState<unknown>));
    }

    if (isSmashUpPromptOwnedByPlayer({ currentPrompt, playerID: effectivePlayerId })) {
        return true;
    }

    const reactionWindow = getSmashUpReactionWindowPresentation(state as MatchState<unknown>);
    if (!reactionWindow) return false;

    if (reactionWindow.activePlayerId === effectivePlayerId) {
        return true;
    }

    const pendingInteractionId = state.sys?.responseWindow?.current?.pendingInteractionId;
    return !currentPrompt && !pendingInteractionId;
}

function SmashUpHudRuntimeSettingsSection({ t }: GameRuntimeSettingsSectionProps) {
    const { overlayEnabled, interactionMode, toggleOverlay, setInteractionMode } = useSmashUpOverlay();

    return (
        <div className="mt-4 space-y-3 rounded-lg border border-violet-400/20 bg-violet-500/10 p-3">
            <div>
                <div className="text-xs font-bold uppercase tracking-wider text-violet-200">{t('hud.smashup.title')}</div>
                <div className="mt-1 text-[11px] text-white/55">{t('hud.smashup.interactionHint')}</div>
            </div>
            <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase text-white/45">{t('hud.smashup.interaction')}</div>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setInteractionMode('click')}
                        className={`rounded-md border px-3 py-2 text-xs font-bold transition-colors ${interactionMode === 'click'
                            ? 'border-violet-300 bg-violet-300/25 text-white'
                            : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'}`}
                    >
                        {t('hud.smashup.modeClick')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setInteractionMode('drag')}
                        className={`rounded-md border px-3 py-2 text-xs font-bold transition-colors ${interactionMode === 'drag'
                            ? 'border-violet-300 bg-violet-300/25 text-white'
                            : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'}`}
                    >
                        {t('hud.smashup.modeDrag')}
                    </button>
                </div>
            </div>
            <button
                type="button"
                onClick={toggleOverlay}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left transition-colors hover:bg-white/10"
            >
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <div className="text-xs font-bold text-white">{t('hud.smashup.overlay')}</div>
                        <div className="mt-1 text-[11px] text-white/55">{t('hud.smashup.overlayHint')}</div>
                    </div>
                    <div className={`rounded-full px-2 py-1 text-[10px] font-bold ${overlayEnabled
                        ? 'bg-emerald-400/20 text-emerald-200'
                        : 'bg-white/10 text-white/60'}`}
                    >
                        {overlayEnabled ? t('hud.smashup.enabled') : t('hud.smashup.disabled')}
                    </div>
                </div>
            </button>
        </div>
    );
}

export const smashUpGameRuntimeAdapter: GameRuntimeAdapter = {
    PageProvider: SmashUpOverlayProvider,
    dismissTransientUi: () => {
        if (typeof window === 'undefined') {
            return false;
        }
        window.dispatchEvent(new CustomEvent(SMASHUP_FORCE_DISMISS_EVENT));
        return true;
    },
    shouldSuppressHudFab: shouldSuppressSmashUpHudFab,
    HudSettingsSection: SmashUpHudRuntimeSettingsSection,
    seatSwap: {
        mode: 'instant',
        requestCommandType: 'su:swap_seat',
        respondCommandType: null,
        cancelCommandType: null,
    },
};
