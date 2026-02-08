import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TrendPoint {
    date: string;
    active: number;
    matches: number;
}

interface Props {
    data: TrendPoint[];
    loading?: boolean;
}

const formatLabel = (value: string) => {
    if (!value) return '';
    return value.length >= 10 ? value.slice(5) : value;
};

export default function GlobalTrendChart({ data, loading }: Props) {
    const hasData = data.length > 0;
    return (
        <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-xl shadow-zinc-200/50 flex flex-col h-[400px]">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-zinc-900">活跃趋势</h3>
                    <p className="text-xs text-zinc-500 mt-1">近 7 天用户活跃度与对局数</p>
                </div>
            </div>
            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-full space-y-3">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div key={index} className="h-3 rounded-full bg-zinc-100 animate-pulse" />
                        ))}
                    </div>
                </div>
            ) : !hasData ? (
                <div className="flex-1 flex items-center justify-center text-zinc-400">暂无数据</div>
            ) : (
                <div className="flex-1 w-full min-h-0">
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorMatches" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#a1a1aa', fontSize: 12 }}
                                dy={10}
                                tickFormatter={formatLabel}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#a1a1aa', fontSize: 12 }}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                cursor={{ stroke: '#e4e4e7', strokeWidth: 1 }}
                                labelFormatter={(label) => `日期 ${label}`}
                            />
                            <Area
                                type="monotone"
                                dataKey="active"
                                stroke="#6366f1"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorActive)"
                                name="活跃用户"
                            />
                            <Area
                                type="monotone"
                                dataKey="matches"
                                stroke="#34d399"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorMatches)"
                                name="对局数"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
