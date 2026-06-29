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
            <button
                type="button"
                onClick={toggleBoardDice3d}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left transition-colors hover:bg-white/10"
            >
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <div className="text-xs font-bold text-white">{t('hud.diceDisplay.board3d')}</div>
                        <div className="mt-1 text-[11px] text-white/55">{t('hud.diceDisplay.board3dHint')}</div>
                    </div>
                    <div className={`rounded-full px-2 py-1 text-[10px] font-bold ${boardDice3dEnabled
                        ? 'bg-emerald-400/20 text-emerald-200'
                        : 'bg-white/10 text-white/60'}`}
                    >
                        {boardDice3dEnabled ? t('hud.diceDisplay.enabled') : t('hud.diceDisplay.disabled')}
                    </div>
                </div>
            </button>
        </div>
    );
}
