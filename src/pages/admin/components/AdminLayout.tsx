import { Link, Outlet, useLocation } from 'react-router-dom';
import { Suspense, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
    Activity,
    Bell,
    ChevronRight,
    DoorOpen,
    Gamepad2,
    Heart,
    LayoutDashboard,
    LogOut,
    MessageSquareWarning,
    Rocket,
    ScrollText,
    Users,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useModalStack } from '../../../contexts/ModalStackContext';
import { cn } from '../../../lib/utils';
import { AdminListPageSkeleton } from './AdminSkeletons';

type NavItem = {
    icon: typeof LayoutDashboard;
    labelKey: string;
    path: string;
};

const DEVELOPER_NAV_ITEMS: NavItem[] = [
    { icon: LayoutDashboard, labelKey: 'admin.layout.nav.overview', path: '/admin' },
    { icon: Gamepad2, labelKey: 'admin.layout.nav.matches', path: '/admin/matches' },
    { icon: ScrollText, labelKey: 'admin.layout.nav.changelogs', path: '/admin/changelogs' },
    { icon: MessageSquareWarning, labelKey: 'admin.layout.nav.feedback', path: '/admin/feedback' },
];

const VIEWER_NAV_ITEMS: NavItem[] = [
    { icon: LayoutDashboard, labelKey: 'admin.layout.nav.overview', path: '/admin' },
    { icon: Gamepad2, labelKey: 'admin.layout.nav.matches', path: '/admin/matches' },
    { icon: MessageSquareWarning, labelKey: 'admin.layout.nav.feedback', path: '/admin/feedback' },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
    { icon: LayoutDashboard, labelKey: 'admin.layout.nav.overview', path: '/admin' },
    { icon: Users, labelKey: 'admin.layout.nav.users', path: '/admin/users' },
    { icon: ScrollText, labelKey: 'admin.layout.nav.changelogs', path: '/admin/changelogs' },
    { icon: Gamepad2, labelKey: 'admin.layout.nav.matches', path: '/admin/matches' },
    { icon: DoorOpen, labelKey: 'admin.layout.nav.rooms', path: '/admin/rooms' },
    { icon: Heart, labelKey: 'admin.layout.nav.sponsors', path: '/admin/sponsors' },
    { icon: MessageSquareWarning, labelKey: 'admin.layout.nav.feedback', path: '/admin/feedback' },
    { icon: Bell, labelKey: 'admin.layout.nav.notifications', path: '/admin/notifications' },
    { icon: Rocket, labelKey: 'admin.layout.nav.mobile_release', path: '/admin/release-center' },
    { icon: Activity, labelKey: 'admin.layout.nav.health', path: '/admin/health' },
];

export default function AdminLayout() {
    const { t } = useTranslation('lobby');
    const adminT = (key: string, options?: Record<string, unknown>) => t(`admin.layout.${key}`, options);
    const { user, logout } = useAuth();
    const location = useLocation();
    const { closeAll } = useModalStack();

    useEffect(() => {
        closeAll();
    }, [closeAll]);

    const isDeveloper = user?.role === 'developer';
    const isViewer = !user || user.role === 'user';
    const navItems = isDeveloper ? DEVELOPER_NAV_ITEMS : (isViewer ? VIEWER_NAV_ITEMS : ADMIN_NAV_ITEMS);
    const roleLabel = user?.role === 'admin'
        ? t('admin.layout.role.admin')
        : user?.role === 'developer'
            ? t('admin.layout.role.developer')
            : user?.role === 'user'
                ? t('admin.layout.role.user')
                : t('admin.layout.role.guest');

    const isActive = (path: string) => {
        if (path === '/admin') return location.pathname === '/admin';
        return location.pathname.startsWith(path);
    };

    return (
        <div className="h-screen w-full overflow-hidden bg-zinc-50 font-sans text-zinc-900 flex">
            <aside className="z-20 flex w-72 flex-shrink-0 flex-col bg-zinc-950 text-zinc-400 shadow-xl">
                <div className="flex-shrink-0 p-6">
                    <div className="flex items-center gap-3 px-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
                            <span className="text-lg font-bold text-white">A</span>
                        </div>
                        <div>
                            <h1 className="text-sm font-bold tracking-wide text-white">
                                {isDeveloper
                                    ? adminT('panel.title_developer')
                                    : isViewer
                                        ? adminT('panel.title_viewer')
                                        : adminT('panel.title_admin')}
                            </h1>
                            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60">
                                {isDeveloper ? adminT('panel.subtitle_developer') : isViewer ? adminT('panel.subtitle_viewer') : adminT('panel.subtitle_admin')}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="custom-scrollbar flex-1 space-y-1 overflow-y-auto px-4 py-4">
                    <div className="px-4 pb-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{adminT('menu')}</p>
                    </div>
                    {navItems.map((item) => {
                        const active = isActive(item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={cn(
                                    'group relative flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200',
                                    active ? 'text-white' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
                                )}
                            >
                                {active && (
                                    <motion.div
                                        layoutId="sidebar-active"
                                        className="absolute inset-0 rounded-xl border border-indigo-500/20 bg-indigo-600/10"
                                        initial={false}
                                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                    />
                                )}
                                <item.icon
                                    size={20}
                                    className={cn(
                                        'relative z-10 transition-colors',
                                        active ? 'text-indigo-400' : 'text-zinc-500 group-hover:text-zinc-300'
                                    )}
                                />
                                <span className="relative z-10 font-medium">{t(item.labelKey)}</span>
                                {active && <ChevronRight size={16} className="relative z-10 ml-auto text-indigo-400 opacity-80" />}
                            </Link>
                        );
                    })}
                </div>

                <div className="mt-auto p-4">
                    <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/50 p-4">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-zinc-700 bg-zinc-800">
                                {user?.avatar ? (
                                    <img src={user.avatar} alt={user.username} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-zinc-800 font-bold text-zinc-400">
                                        {user?.username?.[0]?.toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold text-white">{user?.username ?? t('admin.layout.role.guest')}</p>
                                <p className="truncate text-xs text-zinc-500">{roleLabel}</p>
                            </div>
                        </div>
                        {user ? (
                            <button
                                onClick={logout}
                                className="flex w-full items-center justify-center gap-2 rounded-lg border border-transparent bg-red-400/10 px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:border-red-400/20 hover:bg-red-400/20"
                            >
                                <LogOut size={14} />
                                {adminT('logout')}
                            </button>
                        ) : null}
                    </div>
                    <div className="mt-4 text-center">
                        <Link to="/" className="text-xs text-zinc-600 transition-colors hover:text-indigo-400">
                            {adminT('back_home')}
                        </Link>
                    </div>
                </div>
            </aside>

            <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-zinc-50">
                <Suspense fallback={<AdminListPageSkeleton rows={3} />}>
                    <Outlet />
                </Suspense>
            </main>
        </div>
    );
}
