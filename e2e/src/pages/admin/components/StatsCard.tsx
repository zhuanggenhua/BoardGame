
import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';
import { motion } from 'framer-motion';

interface StatsCardProps {
    title: string;
    value: string | number;
    icon: ReactNode;
    trend?: {
        value: number;
        isPositive: boolean;
        label: string;
    };
    className?: string;
    loading?: boolean;
}

export default function StatsCard({ title, value, icon, trend, className, loading }: StatsCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("bg-white p-6 rounded-2xl border border-zinc-100 shadow-xl shadow-zinc-200/50 hover:shadow-2xl hover:shadow-zinc-200/60 transition-all duration-300", className)}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">{title}</p>
                    {loading ? (
                        <div className="h-8 w-24 bg-zinc-100 rounded-lg animate-pulse" />
                    ) : (
                        <motion.h3
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            className="text-3xl font-bold text-zinc-900 tracking-tight"
                        >
                            {value}
                        </motion.h3>
                    )}
                </div>
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shadow-inner-sm">
                    {icon}
                </div>
            </div>
            {trend && !loading && (
                <div className="mt-4 flex items-center text-sm">
                    <span
                        className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold mr-2",
                            trend.isPositive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        )}
                    >
                        {trend.isPositive ? '↑' : '↓'} {trend.value}%
                    </span>
                    <span className="text-zinc-400 text-xs font-medium">{trend.label}</span>
                </div>
            )}
        </motion.div>
    );
}
