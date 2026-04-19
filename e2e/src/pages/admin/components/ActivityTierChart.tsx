import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ActivityTier {
    label: string;
    count: number;
    color: string;
    description: string;
}

interface Props {
    tiers: ActivityTier[];
    totalUsers: number;
    loading?: boolean;
}

export default function ActivityTierChart({ tiers, totalUsers, loading }: Props) {
    const data = tiers.filter(t => t.count > 0);

    return (
        <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-xl shadow-zinc-200/50 flex flex-col h-[400px]">
            <div className="mb-2">
                <h3 className="text-lg font-bold text-zinc-900">活跃度分层</h3>
                <p className="text-xs text-zinc-500 mt-1">基于最后活跃时间的用户分层</p>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full border-4 border-zinc-100 border-t-indigo-500 animate-spin" />
                </div>
            ) : data.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-zinc-400">暂无数据</div>
            ) : (
                <div className="flex-1 w-full min-h-0 relative">
                    <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                            <Pie
                                data={data}
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={4}
                                dataKey="count"
                                nameKey="label"
                                stroke="none"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={index} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(value?: number, name?: string) => {
                                    const tier = tiers.find(t => t.label === name);
                                    const v = value ?? 0;
                                    const pct = totalUsers > 0 ? ((v / totalUsers) * 100).toFixed(1) : '0';
                                    return [`${v} 人（${pct}%）`, `${name ?? ''} · ${tier?.description ?? ''}`];
                                }}
                            />
                            <Legend
                                verticalAlign="bottom"
                                height={36}
                                iconType="circle"
                                formatter={(value) => <span className="text-xs text-zinc-500 ml-1">{value}</span>}
                            />
                        </PieChart>
                    </ResponsiveContainer>

                    {/* 中心数字 */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                        <div className="text-2xl font-bold text-zinc-900">{totalUsers}</div>
                        <div className="text-[10px] text-zinc-400 uppercase tracking-wider">总用户</div>
                    </div>
                </div>
            )}
        </div>
    );
}
