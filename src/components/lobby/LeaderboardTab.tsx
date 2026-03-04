import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

interface LeaderboardTabProps {
    leaderboardData: {
        leaderboard: { name: string; wins: number; matches: number }[];
    } | null;
    error?: boolean;
}

export const LeaderboardTab = ({ leaderboardData, error }: LeaderboardTabProps) => {
    const { t } = useTranslation('lobby');

    if (error) {
        return (
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                    <p className="text-[#8c7b64] text-xs italic tracking-wider">{t('leaderboard.error')}</p>
                </div>
            </div>
        );
    }

    if (!leaderboardData) {
        return (
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                    <div className="w-8 h-8 border-2 border-parchment-brown/20 border-t-parchment-brown rounded-full animate-spin" />
                    <p className="text-[#8c7b64] text-xs italic tracking-wider">{t('leaderboard.loading')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
            <div className="space-y-6">
                <section>
                    <h4 className="text-xs font-bold text-[#8c7b64] uppercase tracking-widest mb-3">{t('leaderboard.title')}</h4>
                    {leaderboardData.leaderboard.length === 0 ? (
                        <p className="text-sm text-[#433422]/60 italic">{t('leaderboard.empty')}</p>
                    ) : (
                        <div className="space-y-1">
                            {leaderboardData.leaderboard.map((player, idx) => (
                                <div key={idx} className="flex justify-between items-center py-2 border-b border-[#e5e0d0]/50 text-sm">
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
                                        <span className="font-bold text-[#433422]">{player.name}</span>
                                    </div>
                                    <span className="text-[#8c7b64] text-xs font-mono">
                                        {t('leaderboard.record', { wins: player.wins, matches: player.matches })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};
