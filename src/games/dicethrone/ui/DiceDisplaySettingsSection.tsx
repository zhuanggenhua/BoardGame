import React from 'react';
import { useTranslation } from 'react-i18next';
import type { GameRuntimeSettingsSectionProps } from '../../gameRuntimeAdapter';
import { useDiceThroneDisplayPreference } from './useDiceThroneDisplayPreference';

export function DiceDisplaySettingsSection({ t: _t }: GameRuntimeSettingsSectionProps) {
    const { boardDice3dEnabled, toggleBoardDice3d } = useDiceThroneDisplayPreference();
    const { t } = useTranslation('game-dicethrone');

    return (
        <div className="mt-4 space-y-3 rounded-lg border border-amber-400/20 bg-amber-500/10 p-3">
            <div>
                <div className="text-xs font-bold uppercase tracking-wider text-amber-200">{t('hud.diceDisplay.title')}</div>
                <div className="mt-1 text-[11px] text-white/55">{t('hud.diceDisplay.hint')}</div>
            </div>
            <label className="flex w-full items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left cursor-pointer">
                <div className="min-w-0">
                    <div className="text-xs font-bold text-white">{t('hud.diceDisplay.board3d')}</div>
                    <div className="mt-1 text-[11px] text-white/55">{t('hud.diceDisplay.board3dHint')}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold ${boardDice3dEnabled ? 'text-emerald-200' : 'text-white/60'}`}>
                        {boardDice3dEnabled ? t('hud.diceDisplay.enabled') : t('hud.diceDisplay.disabled')}
                    </span>
                    <button
                        type="button"
                        role="switch"
                        aria-label={t('hud.diceDisplay.board3d')}
                        aria-checked={boardDice3dEnabled}
                        onClick={toggleBoardDice3d}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full border border-white/10 transition-colors ${
                            boardDice3dEnabled ? 'bg-emerald-500/70' : 'bg-white/15'
                        }`}
                    >
                        <span
                            className={`pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_6px_rgba(0,0,0,0.35)] transition-transform ${
                                boardDice3dEnabled ? 'translate-x-5' : ''
                            }`}
                        />
                    </button>
                </div>
            </label>
        </div>
    );
}
