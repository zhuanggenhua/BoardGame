import * as Switch from '@radix-ui/react-switch';
import { useTranslation } from 'react-i18next';
import type { GameRuntimeSettingsSectionProps } from '../../gameRuntimeAdapter';
import { useSummonerWarsCombatEffectPreference } from './useSummonerWarsCombatEffectPreference';

export function SummonerWarsCombatEffectSettingsSection({ t: _t }: GameRuntimeSettingsSectionProps) {
    const { reducedCombatEffects, toggleReducedCombatEffects } = useSummonerWarsCombatEffectPreference();
    const { t } = useTranslation('game-summonerwars');

    return (
        <div className="mt-4 space-y-3 rounded-lg border border-sky-400/20 bg-sky-500/10 p-3">
            <div>
                <div className="text-xs font-bold uppercase tracking-wider text-sky-200">{t('hud.combatEffects.title')}</div>
                <div className="mt-1 text-[11px] text-white/55">{t('hud.combatEffects.hint')}</div>
            </div>
            <div className="flex w-full items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left">
                <div className="min-w-0">
                    <div className="text-xs font-bold text-white">{t('hud.combatEffects.reduced')}</div>
                    <div className="mt-1 text-[11px] text-white/55">{t('hud.combatEffects.reducedHint')}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <span className={`text-[10px] font-bold ${reducedCombatEffects ? 'text-emerald-200' : 'text-white/60'}`}>
                        {reducedCombatEffects ? t('hud.combatEffects.enabled') : t('hud.combatEffects.disabled')}
                    </span>
                    <Switch.Root
                        checked={reducedCombatEffects}
                        onCheckedChange={() => toggleReducedCombatEffects()}
                        aria-label={t('hud.combatEffects.reduced')}
                        data-testid="summonerwars-reduced-combat-effects-toggle"
                        className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full border border-white/10 bg-white/15 transition-colors data-[state=checked]:bg-emerald-500/80"
                    >
                        <Switch.Thumb
                            data-testid="summonerwars-reduced-combat-effects-toggle-thumb"
                            className="block h-5 w-5 rounded-full bg-white shadow-[0_1px_6px_rgba(0,0,0,0.35)] transition-transform duration-180"
                            style={{ transform: reducedCombatEffects ? 'translateX(22px)' : 'translateX(2px)' }}
                        />
                    </Switch.Root>
                </div>
            </div>
        </div>
    );
}
