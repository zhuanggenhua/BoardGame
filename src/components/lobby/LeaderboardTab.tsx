import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { LeaderboardEntry } from './leaderboardTypes';

interface LeaderboardTabProps {
    leaderboardData: {
        leaderboard: LeaderboardEntry[];
    } | null;
    error?: boolean;
}

export const LeaderboardTab = ({ leaderboardData, error }: LeaderboardTabProps) => {
    const { t } = useTranslation('lobby');

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
            <section>
                <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-[#8c7b64]">
                    {t('leaderboard.title')}
                </h4>
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
                            <div key={idx} className="flex justify-between items-center gap-4 py-2 border-b border-[#e5e0d0]/50 text-sm">
                                <div className="flex items-center gap-3">
                                    <span className={clsx(
                                        "w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold",
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
                                            {t(`leaderboard.tiers.${player.tier}`, { defaultValue: player.tier })}
                                            {player.provisional ? ` · ${t('leaderboard.provisional')}` : ''}
                                        </div>
                                    </div>
                                </div>
                                <div className="shrink-0 text-right text-[#8c7b64] text-xs font-mono">
                                    <div className="text-sm font-bold text-[#433422]">
                                        {t('leaderboard.rating', { rating: player.rating })}
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
        </div>
    );
};
