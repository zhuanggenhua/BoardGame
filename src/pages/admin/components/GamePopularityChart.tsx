import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getAllGames } from '../../../config/games.config';

interface GameStat {
    gameName: string;
    totalDuration: number;
    avgDuration: number;
    count: number;
}

interface Props {
    stats: GameStat[];
}

const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    return `${hours}h`;
};

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308'];
const BASE_CHART_HEIGHT = 280;
const ROW_HEIGHT = 42;

export default function GamePopularityChart({ stats }: Props) {
    const { t } = useTranslation('lobby');
    const adminT = (key: string, options?: Record<string, unknown>) => t(`admin.dashboard.${key}`, options);
    const gameConfigs = useMemo(
        () => getAllGames().filter((game) => game.type === 'game' && !game.isUgc),
        []
    );
    const data = useMemo(() => {
        const statsByGameId = new Map(stats.map((game) => [game.gameName, game]));
        const officialGameIdSet = new Set(gameConfigs.map((game) => game.id));
        const merged = gameConfigs.map((game) => {
            const stat = statsByGameId.get(game.id);
            return {
                gameId: game.id,
                name: t(game.titleKey, { defaultValue: game.id }),
                duration: stat?.totalDuration ?? 0,
                count: stat?.count ?? 0,
            };
        });
        stats.forEach((stat) => {
            if (officialGameIdSet.has(stat.gameName)) {
                return;
            }
            merged.push({
                gameId: stat.gameName,
                name: stat.gameName,
                duration: stat.totalDuration,
                count: stat.count,
            });
        });
        merged.sort((a, b) => {
            if (b.duration !== a.duration) {
                return b.duration - a.duration;
            }
            if (b.count !== a.count) {
                return b.count - a.count;
            }
            return a.name.localeCompare(b.name, 'zh-CN');
        });
        return merged.map((item, index) => ({
            ...item,
            color: COLORS[index % COLORS.length],
        }));
    }, [gameConfigs, stats, t]);
    const chartHeight = Math.max(BASE_CHART_HEIGHT, data.length * ROW_HEIGHT);

    return (
        <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-xl shadow-zinc-200/50 flex flex-col h-[400px]">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-zinc-900">{adminT('game_popularity.title')}</h3>
                    <p className="text-xs text-zinc-500 mt-1">{adminT('game_popularity.description')}</p>
                </div>
            </div>

            {data.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-zinc-400">{adminT('common.no_data')}</div>
            ) : (
                <div className="flex-1 min-h-0 w-full overflow-y-auto pr-1">
                    <ResponsiveContainer width="100%" height={chartHeight}>
                        <BarChart
                            layout="vertical"
                            data={data}
                            margin={{ top: 0, right: 30, left: 40, bottom: 0 }}
                            barSize={28}
                        >
                            <XAxis type="number" hide />
                            <YAxis
                                type="category"
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#52525b', fontSize: 13, fontWeight: 500 }}
                                width={100}
                            />
                            <Tooltip
                                cursor={{ fill: 'transparent' }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                            <div className="bg-white p-3 rounded-xl shadow-xl border border-zinc-100 text-xs">
                                                <div className="font-bold text-zinc-900 mb-1 capitalize">{data.name}</div>
                                                <div className="text-zinc-500">{adminT('game_popularity.total_duration')}: <span className="text-indigo-600 font-mono font-medium">{formatDuration(data.duration)}</span></div>
                                                <div className="text-zinc-500">{adminT('game_popularity.total_matches')}: <span className="text-indigo-600 font-mono font-medium">{data.count}</span></div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar dataKey="duration" radius={[0, 6, 6, 0]}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
