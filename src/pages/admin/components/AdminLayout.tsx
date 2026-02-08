import { Link, useLocation, Outlet } from 'react-router-dom';
import React, { useEffect, Suspense } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useModalStack } from '../../../contexts/ModalStackContext';
import { LayoutDashboard, Users, Gamepad2, LogOut, ChevronRight, MessageSquareWarning, DoorOpen, Activity } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { motion } from 'framer-motion';

export default function AdminLayout() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const { closeAll } = useModalStack();

    // 进入管理后台时，清理所有可能残留的弹窗 (如：从游戏页跳转过来时遗留的聊天窗口)
    useEffect(() => {
        closeAll();
    }, [closeAll]);


    const navItems = [
        { icon: LayoutDashboard, label: '概览', path: '/admin' },
        { icon: Users, label: '用户管理', path: '/admin/users' },
        { icon: Gamepad2, label: '对局记录', path: '/admin/matches' },
        { icon: DoorOpen, label: '房间管理', path: '/admin/rooms' },
        { icon: MessageSquareWarning, label: '反馈管理', path: '/admin/feedback' },
        { icon: Activity, label: '系统健康', path: '/admin/health' },
    ];

    const isActive = (path: string) => {
        if (path === '/admin') return location.pathname === '/admin';
        return location.pathname.startsWith(path);
    };

    return (
        <div className="h-screen w-full bg-zinc-50 flex font-sans text-zinc-900 overflow-hidden">
            {/* 侧边栏 */}
            <aside className="w-72 bg-zinc-950 text-zinc-400 flex-shrink-0 flex flex-col shadow-xl z-20">
                <div className="p-6 flex-shrink-0">
                    <div className="flex items-center gap-3 px-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <span className="text-white font-bold text-lg">A</span>
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-white tracking-wide">ADMIN PANEL</h1>
                            <p className="text-[10px] uppercase tracking-wider font-semibold opacity-60">BoardGame Platform</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 px-4 py-4 space-y-1 overflow-y-auto custom-scrollbar">
                    <div className="px-4 pb-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Menu</p>
                    </div>
                    {navItems.map((item) => {
                        const active = isActive(item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={cn(
                                    "group relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                                    active ? "text-white" : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
                                )}
                            >
                                {active && (
                                    <motion.div
                                        layoutId="sidebar-active"
                                        className="absolute inset-0 bg-indigo-600/10 border border-indigo-500/20 rounded-xl"
                                        initial={false}
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}
                                <item.icon size={20} className={cn("relative z-10 transition-colors", active ? "text-indigo-400" : "text-zinc-500 group-hover:text-zinc-300")} />
                                <span className="relative z-10 font-medium">{item.label}</span>
                                {active && <ChevronRight size={16} className="relative z-10 ml-auto text-indigo-400 opacity-80" />}
                            </Link>
                        );
                    })}
                </div>

                <div className="p-4 mt-auto">
                    <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800/50">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-zinc-800 border-2 border-zinc-700 overflow-hidden flex-shrink-0">
                                {user?.avatar ? (
                                    <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-400 font-bold bg-zinc-800">
                                        {user?.username?.[0]?.toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-white truncate">{user?.username}</p>
                                <p className="text-xs text-zinc-500 truncate">{user?.role || 'Admin'}</p>
                            </div>
                        </div>
                        <button
                            onClick={logout}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded-lg transition-colors border border-transparent hover:border-red-400/20"
                        >
                            <LogOut size={14} />
                            退出登录
                        </button>
                    </div>
                    <div className="mt-4 text-center">
                        <Link to="/" className="text-xs text-zinc-600 hover:text-indigo-400 transition-colors">
                            返回主站首页 &rarr;
                        </Link>
                    </div>
                </div>
            </aside>

            {/* 主内容区 */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-zinc-50">
                <Suspense fallback={<div className="flex h-full items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>}>
                    <Outlet />
                </Suspense>
            </main>
        </div>
    );
}
