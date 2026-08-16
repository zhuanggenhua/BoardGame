import React from 'react';
import { HeartPulse, Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { HeroState } from '../types';
import { ASSETS } from './assets';
import { buildLocalizedImageSet } from '../../../core';
import { GameButton } from './components/GameButton';

const NYRA_CROP = {
    backgroundSize: '324.3% 199.5%',
    backgroundPosition: '44.6% 7.2%',
};

export interface NyraDamageResponse {
    currentDamage: number;
    maxAssignableDamage: number;
    canRedirectToNyra: boolean;
    canAllocateWithBond: boolean;
    onRedirectToNyra: () => void;
    onAllocateWithBond: (amount: number) => void;
}

export const NyraCompanionPanel = ({
    player,
    locale,
    onConsumeBond,
    damageResponse,
}: {
    player: HeroState;
    locale?: string;
    onConsumeBond?: () => void;
    damageResponse?: NyraDamageResponse;
}) => {
    const { t } = useTranslation('game-dicethrone');
    const companion = player.companion;
    const maxAssignableDamage = Math.max(0, damageResponse?.maxAssignableDamage ?? 0);
    const [damageAllocation, setDamageAllocation] = React.useState(1);

    React.useEffect(() => {
        setDamageAllocation(Math.max(1, maxAssignableDamage));
    }, [maxAssignableDamage]);

    if (player.characterId !== 'lieren' || !companion) return null;

    const hp = Math.max(0, Math.min(companion.maxHp, companion.hp));
    const isActive = hp > 0;
    const bondCount = player.tokens.nyras_bond ?? 0;
    const backgroundImage = buildLocalizedImageSet(ASSETS.PLAYER_BOARD('lieren'), locale);

    return (
        <section
            className="w-full border border-emerald-300/35 bg-slate-950/80 px-2 py-1.5 shadow-md"
            aria-label={t('companion.nyra.label')}
            data-testid="nyra-companion-panel"
        >
            <div className="flex items-center gap-2">
                <div
                    className="h-10 w-10 shrink-0 border border-emerald-100/40 bg-black"
                    style={{ backgroundImage, backgroundRepeat: 'no-repeat', ...NYRA_CROP }}
                    role="img"
                    aria-label={t('companion.nyra.name')}
                />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-xs leading-none">
                        <span className="truncate font-semibold text-emerald-100">{t('companion.nyra.name')}</span>
                        <span className={isActive ? 'text-emerald-300' : 'text-slate-500'}>
                            {isActive ? t('companion.nyra.active') : t('companion.nyra.inactive')}
                        </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 text-sm font-semibold tabular-nums text-rose-200">
                            <HeartPulse className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                            <span>{hp}/{companion.maxHp}</span>
                        </div>
                        <div
                            className={bondCount > 0 ? 'flex items-center gap-1 text-amber-200' : 'flex items-center gap-1 text-slate-500'}
                            title={t('tokens.nyras_bond.name')}
                            data-testid="nyra-bond-state"
                        >
                            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="text-xs tabular-nums">{bondCount}/1</span>
                        </div>
                    </div>
                    <GameButton
                        size="sm"
                        variant="secondary"
                        className="mt-1 h-6 w-full !px-1 !py-0 !text-xs"
                        disabled={!onConsumeBond || bondCount <= 0 || hp >= companion.maxHp}
                        onClick={onConsumeBond}
                        data-testid="nyra-bond-heal-button"
                    >
                        {t('companion.nyra.healAction')}
                    </GameButton>
                    {damageResponse && isActive && damageResponse.currentDamage > 0 && (
                        <div className="mt-2 border-t border-emerald-300/20 pt-2">
                            <div className="mb-1 flex items-center justify-between gap-2 text-[11px] leading-none">
                                <span className="font-semibold text-emerald-100">{t('companion.nyra.takeDamage')}</span>
                                <span className="tabular-nums text-rose-200">
                                    {damageResponse.currentDamage}
                                </span>
                            </div>
                            {damageResponse.canRedirectToNyra && (
                                <GameButton
                                    size="sm"
                                    variant="primary"
                                    className="h-6 w-full !px-1 !py-0 !text-xs"
                                    onClick={damageResponse.onRedirectToNyra}
                                    data-testid="nyra-take-damage-button"
                                >
                                    {t('companion.nyra.takeDamageAction')}
                                </GameButton>
                            )}
                            {damageResponse.canAllocateWithBond && maxAssignableDamage > 0 && (
                                <div className="mt-2">
                                    <div className="mb-1 flex items-center justify-between text-[11px] text-cyan-100">
                                        <span>{t('companion.nyra.allocateDamage')}</span>
                                        <span className="tabular-nums">{Math.min(damageAllocation, maxAssignableDamage)}/{maxAssignableDamage}</span>
                                    </div>
                                    <input
                                        aria-label={t('companion.nyra.allocateDamage')}
                                        className="w-full accent-cyan-300"
                                        type="range"
                                        min={1}
                                        max={maxAssignableDamage}
                                        value={Math.min(damageAllocation, maxAssignableDamage)}
                                        onChange={(event) => setDamageAllocation(Number(event.target.value))}
                                    />
                                    <GameButton
                                        size="sm"
                                        variant="secondary"
                                        className="mt-1 h-6 w-full !px-1 !py-0 !text-xs"
                                        onClick={() => damageResponse.onAllocateWithBond(Math.min(damageAllocation, maxAssignableDamage))}
                                        data-testid="nyra-allocate-damage-button"
                                    >
                                        {t('companion.nyra.allocateDamageAction')}
                                    </GameButton>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};
