import { ScrollText, Shield, User as UserIcon, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ModalBase } from '../../../components/common/overlays/ModalBase';
import type { UserRole } from '../../../contexts/AuthContext';
import { cn } from '../../../lib/utils';

type GameOption = {
    id: string;
    titleKey: string;
};

type RoleTarget = {
    id: string;
    username: string;
    email?: string;
    role: UserRole;
};

interface UserRoleModalProps {
    target: RoleTarget;
    roleDraft: UserRole;
    developerGameIdsDraft: string[];
    gameOptions: GameOption[];
    saving: boolean;
    saveDisabled: boolean;
    roleLocked: boolean;
    onClose: () => void;
    onSave: () => void;
    onRoleChange: (role: UserRole) => void;
    onToggleGame: (gameId: string) => void;
}

const ROLE_CARDS: Array<{
    role: UserRole;
    labelKey: string;
    hintKey: string;
    icon: typeof UserIcon;
    activeClassName: string;
}> = [
    {
        role: 'user',
        labelKey: 'admin.roleModal.roles.user.label',
        hintKey: 'admin.roleModal.roles.user.hint',
        icon: UserIcon,
        activeClassName: 'border-zinc-800 bg-zinc-900 text-white',
    },
    {
        role: 'developer',
        labelKey: 'admin.roleModal.roles.developer.label',
        hintKey: 'admin.roleModal.roles.developer.hint',
        icon: ScrollText,
        activeClassName: 'border-amber-500 bg-amber-500 text-white',
    },
    {
        role: 'admin',
        labelKey: 'admin.roleModal.roles.admin.label',
        hintKey: 'admin.roleModal.roles.admin.hint',
        icon: Shield,
        activeClassName: 'border-indigo-500 bg-indigo-600 text-white',
    },
];

export function UserRoleModal({
    target,
    roleDraft,
    developerGameIdsDraft,
    gameOptions,
    saving,
    saveDisabled,
    roleLocked,
    onClose,
    onSave,
    onRoleChange,
    onToggleGame,
}: UserRoleModalProps) {
    const { t } = useTranslation('lobby');
    const adminT = (key: string, options?: Record<string, unknown>) => t(`admin.roleModal.${key}`, options);

    return (
        <ModalBase
            onClose={saving ? undefined : onClose}
            closeOnBackdrop={!saving}
            overlayClassName="bg-zinc-950/50 backdrop-blur-sm"
            containerClassName="p-4 sm:p-6"
        >
            <div className="pointer-events-auto flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl sm:max-h-[calc(100vh-3rem)]">
                <div className="flex flex-none items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4 sm:px-6">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-500">
                            {adminT('eyebrow')}
                        </p>
                        <h2 className="mt-2 text-xl font-bold text-zinc-900">
                            {adminT('title')}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-zinc-500">
                            {adminT('description')}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-xl border border-zinc-200 p-2 text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={adminT('close_aria')}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
                    <div className="space-y-5">
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 px-4 py-3.5">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate text-base font-semibold text-zinc-900">{target.username}</p>
                                    <p className="truncate font-mono text-xs text-zinc-500">
                                        {target.email || target.id}
                                    </p>
                                </div>
                                <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600">
                                    {adminT('current_role', { role: t(`admin.roleModal.roles.${roleDraft}.label`) })}
                                </span>
                            </div>
                        </div>

                        {roleLocked && (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                {adminT('locked_warning')}
                            </div>
                        )}

                        <div className="space-y-3">
                            <div>
                                <p className="text-sm font-semibold text-zinc-900">{adminT('role_section_title')}</p>
                                <p className="mt-1 text-xs leading-5 text-zinc-500">
                                    {adminT('description')}
                                </p>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                {ROLE_CARDS.map((card) => {
                                    const Icon = card.icon;
                                    const active = roleDraft === card.role;
                                    return (
                                        <button
                                            key={card.role}
                                            type="button"
                                            onClick={() => onRoleChange(card.role)}
                                            disabled={roleLocked || saving}
                                            className={cn(
                                                'flex min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-center transition-colors',
                                                active
                                                    ? card.activeClassName
                                                    : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50',
                                                (roleLocked || saving) && 'cursor-not-allowed opacity-60'
                                            )}
                                        >
                                            <div className={cn(
                                                'flex h-9 w-9 items-center justify-center rounded-xl',
                                                active ? 'bg-white/15' : 'bg-zinc-100 text-zinc-500'
                                            )}>
                                                <Icon size={18} />
                                            </div>
                                            <span className="truncate text-sm font-semibold">{t(card.labelKey)}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            <p className="text-xs font-medium text-zinc-500">
                                {t(ROLE_CARDS.find((card) => card.role === roleDraft)?.hintKey ?? 'admin.roleModal.roles.user.hint')}
                            </p>
                        </div>

                        {roleDraft === 'developer' && (
                            <div className="rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-amber-900">{adminT('games.title')}</p>
                                        <p className="mt-1 text-xs leading-5 text-amber-800/80">
                                            {adminT('games.description')}
                                        </p>
                                    </div>
                                    <span className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                        {adminT('games.selected_count', { count: developerGameIdsDraft.length })}
                                    </span>
                                </div>

                                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                    {gameOptions.map((game) => {
                                        const checked = developerGameIdsDraft.includes(game.id);
                                        return (
                                            <label
                                                key={game.id}
                                                className={cn(
                                                    'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors',
                                                    checked
                                                        ? 'border-amber-300 bg-white text-amber-900'
                                                        : 'border-amber-100 bg-white/70 text-zinc-700'
                                                )}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => onToggleGame(game.id)}
                                                    disabled={roleLocked || saving}
                                                    className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                                                />
                                                <span className="truncate">{t(game.titleKey, { defaultValue: game.id })}</span>
                                            </label>
                                        );
                                    })}
                                </div>

                                {developerGameIdsDraft.length === 0 && (
                                    <p className="mt-3 text-xs font-medium text-rose-600">
                                        {adminT('games.required')}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-none items-center justify-end gap-3 border-t border-zinc-100 px-5 py-4 sm:px-6">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {adminT('cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={saveDisabled}
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {saving ? adminT('saving') : adminT('save')}
                    </button>
                </div>
            </div>
        </ModalBase>
    );
}
