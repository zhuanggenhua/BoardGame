import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface RetentionItem {
    label: string;
    rate: number;
    total: number;
    retained: number;
}

interface Props {
    data: RetentionItem[];
    loading?: boolean;
}

const COLORS = ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'];

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

export default function RetentionChart({ data, loading }: Props) {
    const chartData = data.map(item => ({
        ...item,
        percent: item.rate * 100,
    }));

    return (
        <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-xl shadow-zinc-200/50 flex flex-col h-[400px]">
            <div className="mb-4">
                <h3 className="text-lg font-bold text-zinc-900">用户留存</h3>
                <p className="text-xs text-zinc-500 mt-1">各周期注册用户的回访率（基于近一周注册用户样本）</p>
            </div>
            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-full space-y-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-3 rounded-full bg-zinc-100 animate-pulse" />
                        ))}
                    </div>
                </div>
            ) : chartData.length === 0 || chartData.every(d => d.total === 0) ? (
                <div className="flex-1 flex items-center justify-center text-zinc-400">暂无数据</div>
            ) : (
                <div className="flex-1 w-full min-h-0">
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                            <XAxis
                                dataKey="label"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#a1a1aa', fontSize: 12 }}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#a1a1aa', fontSize: 12 }}
                                domain={[0, 100]}
                                tickFormatter={(v) => `${v}%`}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(_value: unknown, _name: unknown, props: { payload?: { rate?: number; total?: number; retained?: number } }) => {
                                    const { rate = 0, total = 0, retained = 0 } = props.payload ?? {};
                                    return [`${formatPercent(rate)}（${retained}/${total} 人）`, '留存率'];
                                }}
                            />
                            <Bar dataKey="percent" radius={[6, 6, 0, 0]} maxBarSize={48}>
                                {chartData.map((_, index) => (
                                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
