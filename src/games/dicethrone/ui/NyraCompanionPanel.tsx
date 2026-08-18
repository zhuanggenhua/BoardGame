import React from 'react';
import { HeartPulse, Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { HeroState } from '../types';
import { ASSETS } from './assets';
import { buildLocalizedImageSet, HudPortal, UI_Z_INDEX } from '../../../core';
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
    variant = 'hud',
}: {
    player: HeroState;
    locale?: string;
    onConsumeBond?: () => void;
    damageResponse?: NyraDamageResponse;
    variant?: 'hud' | 'boardBadge';
}) => {
    const { t, i18n } = useTranslation('game-dicethrone');
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
    const activeDamageResponse = damageResponse && isActive && damageResponse.currentDamage > 0
        ? damageResponse
        : undefined;
    const showHealAction = !activeDamageResponse && Boolean(onConsumeBond) && bondCount > 0 && hp < companion.maxHp;
    const shortHealLabel = (locale ?? i18n.resolvedLanguage ?? i18n.language).toLowerCase().startsWith('en')
        ? 'Heal'
        : '治疗';
    const isBoardBadge = variant === 'boardBadge';
    const damageResponseDock = activeDamageResponse ? (
        <div
            className="fixed left-1/2 top-1/2 w-[32vw] min-w-[380px] max-w-[430px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-emerald-300/65 bg-slate-950/97 px-3.5 py-2 shadow-2xl shadow-black/70 backdrop-blur-md"
            style={{ zIndex: UI_Z_INDEX.overlayRaised + 20 }}
            data-testid="nyra-damage-response-dock"
            data-board-magnify-ignore="true"
            onClick={(event) => event.stopPropagation()}
        >
            <div className="mb-2 grid grid-cols-[3.15rem_minmax(0,1fr)_4.25rem] items-center gap-2.5">
                <div
                    className="h-[3.15rem] w-[3.15rem] rounded-xl border border-emerald-100/45 bg-black shadow-lg shadow-emerald-950/50"
                    style={{ backgroundImage, backgroundRepeat: 'no-repeat', ...NYRA_CROP }}
                    role="img"
                    aria-label={t('companion.nyra.name')}
                />
                <div className="min-w-0 leading-tight">
                    <div className="text-[12px] font-black uppercase tracking-[0.16em] text-emerald-300/80">
                        {t('companion.nyra.name')} · <span className="text-amber-200">{t('tokens.nyras_bond.name')}</span>
                    </div>
                    <div className="mt-0.5 text-[18px] font-black text-emerald-50">{t('companion.nyra.takeDamage')}</div>
                    <div className="mt-0.5 flex items-center gap-3 text-[13px] font-bold text-slate-200">
                        <span className="inline-flex items-center gap-1">
                            <HeartPulse className="h-4 w-4 text-rose-300" aria-hidden="true" />
                            {hp}/{companion.maxHp}
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <Link2 className="h-4 w-4 text-amber-200" aria-hidden="true" />
                            {bondCount}/1
                        </span>
                    </div>
                </div>
                <div className="shrink-0 rounded-xl border border-rose-300/45 bg-rose-950/60 px-2.5 py-1.5 text-right">
                    <div className="text-[11px] font-bold text-rose-200/80">{t('tokenResponse.currentDamage')}</div>
                    <div className="text-2xl font-black tabular-nums text-rose-100">{activeDamageResponse.currentDamage}</div>
                </div>
            </div>
            {activeDamageResponse.canAllocateWithBond && maxAssignableDamage > 0 && (
                <div className="mb-2 rounded-xl border border-cyan-300/35 bg-cyan-950/35 px-3 py-1.5">
                    <div className="mb-1 flex items-center justify-between gap-3 text-[14px] font-bold text-cyan-100">
                        <span>{t('companion.nyra.allocateDamage')}</span>
                        <span className="rounded-full bg-cyan-300/15 px-2.5 py-0.5 tabular-nums">{Math.min(damageAllocation, maxAssignableDamage)}/{maxAssignableDamage}</span>
                    </div>
                    <input
                        aria-label={t('companion.nyra.allocateDamage')}
                        className="h-6 w-full accent-cyan-300"
                        type="range"
                        min={1}
                        max={maxAssignableDamage}
                        value={Math.min(damageAllocation, maxAssignableDamage)}
                        onChange={(event) => setDamageAllocation(Number(event.target.value))}
                    />
                </div>
            )}
            <div className="grid grid-cols-1 gap-1">
                {activeDamageResponse.canRedirectToNyra && (
                    <GameButton
                        size="sm"
                        variant="primary"
                        className="h-12 w-full !px-5 !py-0 !text-[15px]"
                        onClick={activeDamageResponse.onRedirectToNyra}
                        data-testid="nyra-take-damage-button"
                    >
                        {t('companion.nyra.takeDamageAction')}
                    </GameButton>
                )}
                {activeDamageResponse.canAllocateWithBond && maxAssignableDamage > 0 && (
                    <GameButton
                        size="sm"
                        variant="secondary"
                        className="h-12 w-full !px-5 !py-0 !text-[15px]"
                        onClick={() => activeDamageResponse.onAllocateWithBond(Math.min(damageAllocation, maxAssignableDamage))}
                        data-testid="nyra-allocate-damage-button"
                    >
                        {t('companion.nyra.allocateDamageAction')}
                    </GameButton>
                )}
            </div>
        </div>
    ) : null;
    const damageResponseDockLayer = damageResponseDock ? (
        <HudPortal>{damageResponseDock}</HudPortal>
    ) : null;

    return (
        <div className="relative w-full" data-testid="nyra-companion-control">
            <section
                className={isBoardBadge
                    ? 'w-full rounded-xl border border-emerald-300/64 bg-slate-950/88 px-2 py-1.5 shadow-xl shadow-black/45 backdrop-blur-[2px]'
                    : 'w-full rounded-xl border border-emerald-300/55 bg-slate-950/90 px-1.5 py-1.5 shadow-xl shadow-black/45 backdrop-blur-[2px]'}
                aria-label={t('companion.nyra.label')}
                data-testid="nyra-companion-panel"
                data-nyra-variant={variant}
            >
                <div className={isBoardBadge ? 'flex items-center gap-1.5' : 'flex items-center gap-1.5'}>
                    <div
                        className={isBoardBadge
                            ? 'h-12 w-12 shrink-0 rounded-lg border border-emerald-100/45 bg-black'
                            : 'h-8 w-8 shrink-0 rounded-md border border-emerald-100/45 bg-black'}
                        style={{ backgroundImage, backgroundRepeat: 'no-repeat', ...NYRA_CROP }}
                        role="img"
                        aria-label={t('companion.nyra.name')}
                    />
                    <div className="min-w-0 flex-1 leading-none">
                        <div className="flex items-center justify-between gap-1">
                            <span className={isBoardBadge ? 'truncate text-[12px] font-black text-emerald-100' : 'truncate text-[11px] font-black text-emerald-100'}>{t('companion.nyra.name')}</span>
                            {activeDamageResponse && (
                                <span className="rounded bg-orange-500/20 px-1 text-[11px] font-black tabular-nums text-orange-100">
                                    {activeDamageResponse.currentDamage}
                                </span>
                            )}
                        </div>
                        <div className={isBoardBadge ? 'mt-1 flex items-center justify-between gap-1' : 'mt-1 flex items-center justify-between gap-1'}>
                            <div className={isBoardBadge ? 'flex items-center gap-1 text-[11px] font-black tabular-nums text-rose-200' : 'flex items-center gap-0.5 text-[11px] font-black tabular-nums text-rose-200'}>
                                <HeartPulse className={isBoardBadge ? 'h-3 w-3 text-rose-400' : 'h-3 w-3 text-rose-400'} aria-hidden="true" />
                                <span>{hp}/{companion.maxHp}</span>
                            </div>
                            <div
                                className={bondCount > 0 ? 'flex items-center gap-0.5 text-amber-200' : 'flex items-center gap-0.5 text-slate-500'}
                                title={t('tokens.nyras_bond.name')}
                                data-testid="nyra-bond-state"
                            >
                                <Link2 className={isBoardBadge ? 'h-3 w-3' : 'h-3 w-3'} aria-hidden="true" />
                                <span className={isBoardBadge ? 'text-[10px] font-black tabular-nums' : 'text-[10px] font-black tabular-nums'}>{bondCount}/1</span>
                            </div>
                            {!isBoardBadge && showHealAction && (
                                <GameButton
                                    size="sm"
                                    variant="secondary"
                                    className="h-5 min-w-[2rem] !min-h-0 !px-1 !py-0 !text-[9px]"
                                    onClick={onConsumeBond}
                                    title={t('companion.nyra.healAction')}
                                    aria-label={t('companion.nyra.healAction')}
                                    data-testid="nyra-bond-heal-button"
                                >
                                    {shortHealLabel}
                                </GameButton>
                            )}
                        </div>
                    </div>
                </div>
            </section>
            {damageResponseDockLayer}
        </div>
    );
};
