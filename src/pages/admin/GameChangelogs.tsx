import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { ADMIN_API_URL } from '../../config/server';
import { getAllGames } from '../../config/games.config';
import { cn } from '../../lib/utils';
import { logger } from '../../lib/logger';
import { AdminCardListSkeleton } from './components/AdminSkeletons';

type GameChangelogItem = {
    id: string;
    gameId: string;
    title: string;
    versionLabel: string | null;
    content: string;
    published: boolean;
    pinned: boolean;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
};

type GameChangelogResponse = {
    items: GameChangelogItem[];
    availableGameIds: string[] | null;
};

type FormState = {
    gameId: string;
    title: string;
    versionLabel: string;
    content: string;
    pinned: boolean;
    published: boolean;
};

const EMPTY_FORM: FormState = {
    gameId: '',
    title: '',
    versionLabel: '',
    content: '',
    pinned: false,
    published: true,
};

const normalizeErrorMessage = async (response: Response, fallback: string) => {
    const payload = await response.json().catch(() => null) as { error?: string; message?: string } | null;
    return payload?.error || payload?.message || fallback;
};

export default function AdminGameChangelogs() {
    const { t } = useTranslation('lobby');
    const { token } = useAuth();
    const toast = useToast();
    const [items, setItems] = useState<GameChangelogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<GameChangelogItem | null>(null);
    const [selectedGameId, setSelectedGameId] = useState('');
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [availableGameIds, setAvailableGameIds] = useState<string[] | null>(null);

    const allGames = useMemo(
        () => getAllGames().filter((game) => game.type === 'game' && !game.isUgc),
        []
    );

    const manageableGames = useMemo(() => {
        if (!Array.isArray(availableGameIds)) {
            return allGames;
        }
        const allowed = new Set(availableGameIds);
        return allGames.filter((game) => allowed.has(game.id));
    }, [allGames, availableGameIds]);

    const gameTitleMap = useMemo(
        () => new Map(allGames.map((game) => [game.id, t(game.titleKey, { defaultValue: game.id })])),
        [allGames, t]
    );

    const getGameTitle = useCallback(
        (gameId: string) => gameTitleMap.get(gameId) ?? gameId,
        [gameTitleMap]
    );

    const fetchChangelogs = useCallback(async (gameId?: string) => {
        if (!token) return;
        setLoading(true);
        try {
            const query = gameId ? `?gameId=${encodeURIComponent(gameId)}` : '';
            const res = await fetch(`${ADMIN_API_URL}/game-changelogs${query}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                const message = await normalizeErrorMessage(res, t('admin.gameChangelogs.toast.fetch_failed'));
                throw new Error(message);
            }
            const data = await res.json() as GameChangelogResponse;
            setItems(Array.isArray(data.items) ? data.items : []);
            setAvailableGameIds(Array.isArray(data.availableGameIds) ? data.availableGameIds : null);
        } catch (error) {
            logger.error('[AdminGameChangelogs] 获取更新日志失败', {
                gameId,
                error,
            });
            toast.error(error instanceof Error ? error.message : t('admin.gameChangelogs.toast.fetch_failed'));
        } finally {
            setLoading(false);
        }
    }, [t, toast, token]);

    useEffect(() => {
        if (!token) return;
        void fetchChangelogs(selectedGameId || undefined);
    }, [fetchChangelogs, selectedGameId, token]);

    useEffect(() => {
        if (!selectedGameId) return;
        if (manageableGames.some((game) => game.id === selectedGameId)) return;
        setSelectedGameId('');
    }, [manageableGames, selectedGameId]);

    const resetForm = useCallback(() => {
        setEditing(null);
        setShowForm(false);
        setForm({
            ...EMPTY_FORM,
            gameId: manageableGames[0]?.id ?? '',
        });
    }, [manageableGames]);

    const openCreate = () => {
        if (manageableGames.length === 0) {
            toast.error(t('admin.gameChangelogs.empty.no_manageable_games'));
            return;
        }
        setEditing(null);
        setShowForm(true);
        setForm({
            ...EMPTY_FORM,
            gameId: selectedGameId || manageableGames[0]?.id || '',
        });
    };

    const openEdit = (item: GameChangelogItem) => {
        setEditing(item);
        setShowForm(true);
        setForm({
            gameId: item.gameId,
            title: item.title,
            versionLabel: item.versionLabel ?? '',
            content: item.content,
            pinned: item.pinned,
            published: item.published,
        });
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!token || !form.gameId || !form.title.trim() || !form.content.trim()) return;

        setSubmitting(true);
        try {
            const payload = {
                gameId: form.gameId,
                title: form.title.trim(),
                versionLabel: form.versionLabel.trim(),
                content: form.content.trim(),
                pinned: form.pinned,
                published: form.published,
            };
            const url = editing
                ? `${ADMIN_API_URL}/game-changelogs/${editing.id}`
                : `${ADMIN_API_URL}/game-changelogs`;
            const res = await fetch(url, {
                method: editing ? 'PUT' : 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const message = await normalizeErrorMessage(
                    res,
                    editing
                        ? t('admin.gameChangelogs.toast.update_failed')
                        : t('admin.gameChangelogs.toast.create_failed')
                );
                throw new Error(message);
            }
            toast.success(
                editing
                    ? t('admin.gameChangelogs.toast.update_success')
                    : t('admin.gameChangelogs.toast.create_success')
            );
            resetForm();
            await fetchChangelogs(selectedGameId || undefined);
        } catch (error) {
            logger.error('[AdminGameChangelogs] 保存更新日志失败', {
                editingId: editing?.id,
                error,
            });
            toast.error(error instanceof Error ? error.message : t('admin.gameChangelogs.toast.save_failed'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!token) return;
        if (!window.confirm(t('admin.gameChangelogs.confirm.delete'))) return;

        try {
            const res = await fetch(`${ADMIN_API_URL}/game-changelogs/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                const message = await normalizeErrorMessage(res, t('admin.gameChangelogs.toast.delete_failed'));
                throw new Error(message);
            }
            toast.success(t('admin.gameChangelogs.toast.delete_success'));
            await fetchChangelogs(selectedGameId || undefined);
        } catch (error) {
            logger.error('[AdminGameChangelogs] 删除更新日志失败', {
                id,
                error,
            });
            toast.error(error instanceof Error ? error.message : t('admin.gameChangelogs.toast.delete_failed'));
        }
    };

    const togglePublish = async (item: GameChangelogItem) => {
        if (!token) return;
        try {
            const res = await fetch(`${ADMIN_API_URL}/game-changelogs/${item.id}`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ published: !item.published }),
            });
            if (!res.ok) {
                const message = await normalizeErrorMessage(res, t('admin.gameChangelogs.toast.toggle_publish_failed'));
                throw new Error(message);
            }
            toast.success(
                item.published
                    ? t('admin.gameChangelogs.toast.unpublish_success')
                    : t('admin.gameChangelogs.toast.publish_success')
            );
            await fetchChangelogs(selectedGameId || undefined);
        } catch (error) {
            logger.error('[AdminGameChangelogs] 切换发布状态失败', {
                id: item.id,
                error,
            });
            toast.error(
                error instanceof Error ? error.message : t('admin.gameChangelogs.toast.toggle_publish_failed')
            );
        }
    };

    return (
        <div className="h-full overflow-y-auto p-8">
            <div className="mx-auto max-w-[1200px] space-y-6 pb-10">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
                            {t('admin.gameChangelogs.title')}
                        </h1>
                        <p className="mt-1 text-zinc-500">
                            {t('admin.gameChangelogs.description')}
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <select
                            value={selectedGameId}
                            onChange={(event) => setSelectedGameId(event.target.value)}
                            className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-700 shadow-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/15"
                        >
                            <option value="">{t('admin.gameChangelogs.filters.all_games')}</option>
                            {manageableGames.map((game) => (
                                    <option key={game.id} value={game.id}>
                                        {t(game.titleKey, { defaultValue: game.id })}
                                    </option>
                                ))}
                        </select>
                        <button
                            type="button"
                            onClick={openCreate}
                            disabled={manageableGames.length === 0}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Plus size={16} />
                            {t('admin.gameChangelogs.actions.create')}
                        </button>
                    </div>
                </div>

                {showForm && (
                    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-bold text-zinc-900">
                                    {editing
                                        ? t('admin.gameChangelogs.form.edit_title')
                                        : t('admin.gameChangelogs.form.create_title')}
                                </h2>
                                <p className="mt-1 text-sm text-zinc-500">
                                    {t('admin.gameChangelogs.form.scope_hint')}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={resetForm}
                                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-50"
                            >
                                {t('admin.gameChangelogs.actions.cancel')}
                            </button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-zinc-600">
                                    {t('admin.gameChangelogs.form.game_label')}
                                </label>
                                <select
                                    value={form.gameId}
                                    onChange={(event) => setForm((current) => ({ ...current, gameId: event.target.value }))}
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/15"
                                    required
                                >
                                    {manageableGames.map((game) => (
                                        <option key={game.id} value={game.id}>
                                            {t(game.titleKey, { defaultValue: game.id })}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-zinc-600">
                                    {t('admin.gameChangelogs.form.version_label')}
                                </label>
                                <input
                                    value={form.versionLabel}
                                    onChange={(event) => setForm((current) => ({ ...current, versionLabel: event.target.value }))}
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/15"
                                    placeholder={t('admin.gameChangelogs.form.version_placeholder')}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-zinc-600">
                                {t('admin.gameChangelogs.form.title_label')}
                            </label>
                            <input
                                value={form.title}
                                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/15"
                                placeholder={t('admin.gameChangelogs.form.title_placeholder')}
                                required
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-zinc-600">
                                {t('admin.gameChangelogs.form.content_label')}
                            </label>
                            <textarea
                                value={form.content}
                                onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
                                rows={6}
                                className="w-full resize-y rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/15"
                                placeholder={t('admin.gameChangelogs.form.content_placeholder')}
                                required
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-5">
                            <label className="flex items-center gap-2 text-sm text-zinc-600">
                                <input
                                    type="checkbox"
                                    checked={form.pinned}
                                    onChange={(event) => setForm((current) => ({ ...current, pinned: event.target.checked }))}
                                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                {t('admin.gameChangelogs.form.pinned')}
                            </label>
                            <label className="flex items-center gap-2 text-sm text-zinc-600">
                                <input
                                    type="checkbox"
                                    checked={form.published}
                                    onChange={(event) => setForm((current) => ({ ...current, published: event.target.checked }))}
                                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                {t('admin.gameChangelogs.form.publish_now')}
                            </label>
                        </div>
                        <p className="text-xs leading-5 text-amber-700">
                            {t('admin.gameChangelogs.form.publish_hint')}
                        </p>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {submitting
                                    ? t('admin.gameChangelogs.actions.submitting')
                                    : editing
                                        ? t('admin.gameChangelogs.actions.save')
                                        : t('admin.gameChangelogs.actions.create_entry')}
                            </button>
                            <button
                                type="button"
                                onClick={resetForm}
                                className="rounded-lg bg-zinc-100 px-5 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-200"
                            >
                                {t('admin.gameChangelogs.actions.cancel')}
                            </button>
                        </div>
                    </form>
                )}

                {loading ? (
                    <AdminCardListSkeleton rows={4} />
                ) : items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white py-16 text-center text-sm text-zinc-400">
                        {manageableGames.length === 0
                            ? t('admin.gameChangelogs.empty.no_manageable_games')
                            : t('admin.gameChangelogs.empty.no_items')}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {items.map((item) => {
                            const displayDate = item.publishedAt || item.updatedAt || item.createdAt;
                            return (
                                <article key={item.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="truncate text-lg font-bold text-zinc-900">{item.title}</h3>
                                                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-500">
                                                    {getGameTitle(item.gameId)}
                                                </span>
                                                {item.versionLabel && (
                                                    <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-500">
                                                        {item.versionLabel}
                                                    </span>
                                                )}
                                                <span
                                                    className={cn(
                                                        'rounded-full px-2 py-0.5 text-[11px] font-medium',
                                                        item.published
                                                            ? 'bg-emerald-50 text-emerald-700'
                                                            : 'bg-zinc-100 text-zinc-500'
                                                    )}
                                                >
                                                    {item.published
                                                        ? t('admin.gameChangelogs.status.published')
                                                        : t('admin.gameChangelogs.status.draft')}
                                                </span>
                                                {item.pinned && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                                        <Pin size={12} />
                                                        {t('admin.gameChangelogs.status.pinned')}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-600 line-clamp-4">
                                                {item.content}
                                            </p>
                                            <div className="mt-3 text-xs text-zinc-400">
                                                {t('admin.gameChangelogs.status.latest_time', {
                                                    time: new Date(displayDate).toLocaleString('zh-CN'),
                                                })}
                                            </div>
                                        </div>

                                        <div className="flex shrink-0 items-center gap-1 self-start">
                                            <button
                                                type="button"
                                                onClick={() => togglePublish(item)}
                                                className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                                                title={
                                                    item.published
                                                        ? t('admin.gameChangelogs.actions.unpublish')
                                                        : t('admin.gameChangelogs.actions.publish')
                                                }
                                            >
                                                {item.published ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openEdit(item)}
                                                className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-indigo-600"
                                                title={t('admin.gameChangelogs.actions.edit')}
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(item.id)}
                                                className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500"
                                                title={t('admin.gameChangelogs.actions.delete')}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
