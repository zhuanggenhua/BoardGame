import type {
    GameRuntimeAdapter,
    GameRuntimeSettingsSectionProps,
} from '../gameRuntimeAdapter';
import { SMASHUP_FORCE_DISMISS_EVENT } from './ui/CardMagnifyOverlay';
import {
    SmashUpOverlayProvider,
    useSmashUpOverlay,
} from './ui/SmashUpOverlayContext';

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
    HudSettingsSection: SmashUpHudRuntimeSettingsSection,
    seatSwap: {
        mode: 'instant',
        requestCommandType: 'su:swap_seat',
        respondCommandType: null,
        cancelCommandType: null,
    },
};
