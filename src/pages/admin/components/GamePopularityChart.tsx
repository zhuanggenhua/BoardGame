import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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

export default function GamePopularityChart({ stats }: Props) {
    // Process data for the chart
    const data = stats.map((game, index) => ({
        name: game.gameName,
        duration: game.totalDuration,
        count: game.count,
        color: COLORS[index % COLORS.length]
    }));

    return (
        <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-xl shadow-zinc-200/50 flex flex-col h-[400px]">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-zinc-900">游戏热度排行</h3>
                    <p className="text-xs text-zinc-500 mt-1">按游戏总时长排名</p>
                </div>
            </div>

            {data.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-zinc-400">暂无数据</div>
            ) : (
                <div className="flex-1 w-full min-h-0">
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart
                            layout="vertical"
                            data={data}
                            margin={{ top: 0, right: 30, left: 40, bottom: 0 }}
                            barSize={32}
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
                                                <div className="text-zinc-500">总时长: <span className="text-indigo-600 font-mono font-medium">{formatDuration(data.duration)}</span></div>
                                                <div className="text-zinc-500">总局数: <span className="text-indigo-600 font-mono font-medium">{data.count}</span></div>
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
