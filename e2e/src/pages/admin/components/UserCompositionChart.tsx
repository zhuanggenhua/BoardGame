import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Props {
    totalUsers: number;
    activeUsers: number;
    bannedUsers: number;
}

export default function UserCompositionChart({ totalUsers, activeUsers, bannedUsers }: Props) {
    const inactiveUsers = Math.max(0, totalUsers - activeUsers - bannedUsers);

    const data = [
        { name: '活跃用户', value: activeUsers, color: '#10b981' }, // Emerald-500
        { name: '沉默用户', value: inactiveUsers, color: '#e4e4e7' }, // Zinc-200
        { name: '封禁用户', value: bannedUsers, color: '#f43f5e' }, // Rose-500
    ].filter(d => d.value > 0);

    return (
        <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-xl shadow-zinc-200/50 flex flex-col h-[400px]">
            <div className="mb-2">
                <h3 className="text-lg font-bold text-zinc-900">用户构成</h3>
                <p className="text-xs text-zinc-500 mt-1">活跃 vs 沉默 vs 封禁</p>
            </div>

            <div className="flex-1 w-full min-h-0 relative">
                <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                        <Pie
                            data={data}
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend
                            verticalAlign="bottom"
                            height={36}
                            iconType="circle"
                            formatter={(value) => <span className="text-xs text-zinc-500 ml-1">{value}</span>}
                        />
                    </PieChart>
                </ResponsiveContainer>

                {/* Center Stats */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                    <div className="text-2xl font-bold text-zinc-900">{totalUsers}</div>
                    <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Total</div>
                </div>
            </div>
        </div>
    );
}
