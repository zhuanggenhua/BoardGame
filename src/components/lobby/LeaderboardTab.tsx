import { useState } from 'react';
import { LEADERBOARD_TIERS } from '../../shared/leaderboardTiers';
import { X } from 'lucide-react';
import { ModalBase } from '../common/overlays/ModalBase';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { LeaderboardEntry } from './leaderboardTypes';

interface LeaderboardTabProps {
    leaderboardData: {
        leaderboard: LeaderboardEntry[];
    } | null;
    error?: boolean;
    modern?: boolean;
}

export const LeaderboardTab = ({ leaderboardData, error, modern = false }: LeaderboardTabProps) => {
    const { t } = useTranslation('lobby');
    const [infoOpen, setInfoOpen] = useState<'points' | 'tiers' | null>(null);

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
            <section>
                {!modern && <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-[#8c7b64]">
                    {t('leaderboard.title')}
                </h4>}
                {error ? (
                    <div className="rounded-[6px] border border-dashed border-[#e5e0d0] bg-[#f8f4eb]/70 px-4 py-8 text-center">
                        <p className="text-sm italic text-[#8c7b64]">{t('leaderboard.error')}</p>
                    </div>
                ) : !leaderboardData ? (
                    <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-[6px] border border-dashed border-[#e5e0d0] bg-[#f8f4eb]/70">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-parchment-brown/20 border-t-parchment-brown" />
                        <p className="text-xs italic tracking-wider text-[#8c7b64]">{t('leaderboard.loading')}</p>
                    </div>
                ) : leaderboardData.leaderboard.length === 0 ? (
                    <div className="rounded-[6px] border border-dashed border-[#e5e0d0] bg-[#f8f4eb]/70 px-4 py-8 text-center">
                        <p className="text-sm italic text-[#433422]/60">{t('leaderboard.empty')}</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {leaderboardData.leaderboard.map((player, idx) => (
                            <div key={idx} className="flex min-w-0 justify-between items-center gap-2 py-2 border-b border-[#e5e0d0]/50 text-sm">
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                    <span className={clsx(
                                        "w-5 h-5 shrink-0 flex items-center justify-center rounded-full text-[10px] font-bold",
                                        idx === 0 ? "bg-yellow-400 text-yellow-900" :
                                            idx === 1 ? "bg-gray-300 text-gray-800" :
                                                idx === 2 ? "bg-orange-300 text-orange-900" :
                                                    "bg-[#f3f0e6] text-[#8c7b64]"
                                    )}>
                                        {idx + 1}
                                    </span>
                                    <div className="min-w-0">
                                        <div className="truncate font-bold text-[#433422]">{player.name}</div>
                                        <div className="mt-0.5 truncate text-[11px] font-semibold text-[#8c7b64]">
                                            {modern ? <button type="button" className="underline underline-offset-2" onClick={() => setInfoOpen('tiers')}>{t(`leaderboard.tiers.${player.tier}`, { defaultValue: player.tier })}</button> : t(`leaderboard.tiers.${player.tier}`, { defaultValue: player.tier })}
                                            {player.provisional ? ` · ${t('leaderboard.provisional')}` : ''}
                                        </div>
                                    </div>
                                </div>
                                <div className="shrink-0 text-right text-[#8c7b64] text-xs font-mono">
                                    <div className="text-sm font-bold text-[#433422]">
                                        {modern ? <button type="button" className="underline underline-offset-4" onClick={() => setInfoOpen('points')}>{t('leaderboard.points', { rating: player.rating })}</button> : t('leaderboard.rating', { rating: player.rating })}
                                    </div>
                                    <div>
                                        {t('leaderboard.record', {
                                            wins: player.wins,
                                            losses: player.losses,
                                            draws: player.draws,
                                            matches: player.matches,
                                            winRate: Math.round(player.winRate * 100),
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
            {modern && infoOpen && <ModalBase visualStyle="home-v2" onClose={() => setInfoOpen(null)}>
                <section role="dialog" aria-modal="true" aria-label={t(infoOpen === 'tiers' ? 'leaderboard.tiersTitle' : 'leaderboard.pointsTitle')} data-platform-dialog="ranking-info" className="pointer-events-auto w-[min(90vw,420px)] border-[3px] border-black bg-white p-5 text-black shadow-[6px_6px_0_#d5ff00]">
                    <div className="flex items-center justify-between gap-4"><h2 className="text-lg font-bold">{t(infoOpen === 'tiers' ? 'leaderboard.tiersTitle' : 'leaderboard.pointsTitle')}</h2><button type="button" autoFocus className="platform-dialog-close" aria-label={t('common:close')} onClick={() => setInfoOpen(null)}><X size={20} /></button></div>
                    {infoOpen === 'points' ? <p className="mt-4 text-sm leading-6">{t('leaderboard.pointsHelp')}</p> : <ul className="mt-4 space-y-2 text-sm">{LEADERBOARD_TIERS.map((tier, index) => <li key={tier.id} className="flex justify-between gap-4"><span>{t(`leaderboard.tiers.${tier.id}`)}</span><span>{index === 0 ? t('leaderboard.tierAtLeast', { min: tier.min }) : index === LEADERBOARD_TIERS.length - 1 ? t('leaderboard.tierAtMost', { max: LEADERBOARD_TIERS[index - 1].min - 1 }) : t('leaderboard.tierRange', { min: tier.min, max: LEADERBOARD_TIERS[index - 1].min - 1 })}</span></li>)}</ul>}
                </section>
            </ModalBase>}
        </div>
    );
};
