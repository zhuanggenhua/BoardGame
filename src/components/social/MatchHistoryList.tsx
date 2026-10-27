import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { AUTH_API_URL } from '../../config/server';
import { getGameById } from '../../config/games.config';
import { resolveGameDisplayName } from '../lobby/gameDetailsContent';

interface MatchHistoryEntry {
    id: string;
    gameId: string;
    endedAt: string;
    result: 'win' | 'loss' | 'draw' | 'completed';
    opponents: string[];
}

/** 经典弹窗与现代个人中心共用的账户对局记录查询和列表。 */
export function MatchHistoryList() {
    const { t, i18n } = useTranslation(['lobby', 'social']);
    const { user, token } = useAuth();
    const history = useQuery({
        queryKey: ['match-history', user?.id],
        enabled: Boolean(user && token),
        queryFn: async (): Promise<MatchHistoryEntry[]> => {
            const response = await fetch(`${AUTH_API_URL}/profile/matches`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) throw new Error('match-history-load-failed');
            return response.json();
        },
    });

    if (history.isPending) return <p role="status">{t('social:matchHistory.loading')}</p>;
    if (history.isError) return <div role="alert" className="platform-history-error">
        {t('social:matchHistory.loadFailed')} <button type="button" className="underline underline-offset-2" onClick={() => void history.refetch()}>{t('lobby:platform.retry')}</button>
    </div>;
    if (history.data.length === 0) return <div className="text-center text-parchment-light-text py-12 italic">{t('social:matchHistory.empty')}</div>;

    return <>
        {history.data.map(match => {
            const game = getGameById(match.gameId);
            return <div key={match.id} data-testid="match-history-row" data-match-id={match.id} className="bg-white border border-parchment-card-border/20 rounded p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                    <div className={clsx(
                        'w-10 h-10 rounded-full flex items-center justify-center font-bold text-white',
                        match.result === 'win' ? 'bg-green-500' : match.result === 'loss' ? 'bg-red-500' : 'bg-gray-400',
                    )}>
                        {t(`social:matchHistory.resultShort.${match.result}`)}
                    </div>
                    <div>
                        <div className="font-bold text-parchment-base-text">{game ? resolveGameDisplayName(game, t) : match.gameId}</div>
                        <div className="text-xs text-parchment-light-text flex items-center gap-2">
                            {match.opponents.length > 0 && <span>{t('social:matchHistory.vs', { name: match.opponents.join('、') })}</span>}
                            <span className="w-1 h-1 rounded-full bg-parchment-light-text" />
                            <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(match.endedAt).toLocaleDateString(i18n.language)}</span>
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <div className={clsx(
                        'font-bold text-sm uppercase tracking-wider',
                        match.result === 'win' ? 'text-green-600' : match.result === 'loss' ? 'text-red-500' : 'text-gray-500',
                    )}>
                        {t(`social:matchHistory.result.${match.result}`)}
                    </div>
                </div>
            </div>;
        })}
    </>;
}
