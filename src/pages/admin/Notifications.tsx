import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { ADMIN_API_URL } from '../../config/server';
import { Plus, Trash2, Pencil, Eye, EyeOff } from 'lucide-react';

interface NotificationItem {
    _id: string;
    title: string;
    content: string;
    published: boolean;
    expiresAt?: string;
    createdAt: string;
}

export default function AdminNotifications() {
    const { token } = useAuth();
    const toast = useToast();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);

    // 编辑状态
    const [editing, setEditing] = useState<NotificationItem | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [expiresAt, setExpiresAt] = useState('');
    const [published, setPublished] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch(`${ADMIN_API_URL}/notifications`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            setNotifications(data.notifications);
        } catch {
            toast.error('获取通知列表失败');
        } finally {
            setLoading(false);
        }
    }, [token, toast]);

    useEffect(() => {
        if (token) fetchNotifications();
    }, [token, fetchNotifications]);

    const resetForm = () => {
        setTitle('');
        setContent('');
        setExpiresAt('');
        setPublished(true);
        setEditing(null);
        setShowForm(false);
    };

    const openCreate = () => {
        resetForm();
        setShowForm(true);
    };

    const openEdit = (item: NotificationItem) => {
        setEditing(item);
        setTitle(item.title);
        setContent(item.content);
        setExpiresAt(item.expiresAt ? item.expiresAt.slice(0, 16) : '');
        setPublished(item.published);
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) return;
        setSubmitting(true);
        try {
            const body: Record<string, unknown> = { title: title.trim(), content: content.trim(), published };
            if (expiresAt) body.expiresAt = new Date(expiresAt).toISOString();

            const url = editing
                ? `${ADMIN_API_URL}/notifications/${editing._id}`
                : `${ADMIN_API_URL}/notifications`;
            const method = editing ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error('Failed');
            toast.success(editing ? '通知已更新' : '通知已创建');
            resetForm();
            await fetchNotifications();
        } catch {
            toast.error('操作失败');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`${ADMIN_API_URL}/notifications/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed');
            toast.success('已删除');
            await fetchNotifications();
        } catch {
            toast.error('删除失败');
        }
    };

    const togglePublish = async (item: NotificationItem) => {
        try {
            const res = await fetch(`${ADMIN_API_URL}/notifications/${item._id}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ published: !item.published }),
            });
            if (!res.ok) throw new Error('Failed');
            await fetchNotifications();
        } catch {
            toast.error('操作失败');
        }
    };

    const isExpired = (item: NotificationItem) => item.expiresAt && new Date(item.expiresAt) < new Date();

    return (
        <div className="h-full overflow-y-auto p-8">
            <div className="max-w-[1200px] mx-auto space-y-6 pb-10">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">系统通知</h1>
                        <p className="text-zinc-500 mt-1">管理面向所有用户的系统公告</p>
                    </div>
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <Plus size={16} /> 发布通知
                    </button>
                </div>

                {/* 创建/编辑表单 */}
                {showForm && (
                    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4 shadow-sm">
                        <h2 className="font-bold text-lg text-zinc-800">{editing ? '编辑通知' : '新建通知'}</h2>
                        <div>
                            <label className="block text-sm font-medium text-zinc-600 mb-1">标题</label>
                            <input
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                placeholder="通知标题"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-600 mb-1">内容</label>
                            <textarea
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                rows={4}
                                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-y"
                                placeholder="通知内容..."
                                required
                            />
                        </div>
                        <div className="flex gap-4 items-end">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-zinc-600 mb-1">过期时间（可选）</label>
                                <input
                                    type="datetime-local"
                                    value={expiresAt}
                                    onChange={e => setExpiresAt(e.target.value)}
                                    className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                />
                            </div>
                            <label className="flex items-center gap-2 pb-2 cursor-pointer">
                                <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} className="rounded" />
                                <span className="text-sm text-zinc-600">立即发布</span>
                            </label>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                            >
                                {submitting ? '提交中...' : editing ? '保存' : '发布'}
                            </button>
                            <button type="button" onClick={resetForm} className="px-5 py-2 bg-zinc-100 text-zinc-600 rounded-lg text-sm hover:bg-zinc-200 transition-colors">
                                取消
                            </button>
                        </div>
                    </form>
                )}

                {/* 通知列表 */}
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="text-center text-zinc-400 py-16 text-sm">暂无通知</div>
                ) : (
                    <div className="space-y-3">
                        {notifications.map(item => (
                            <div key={item._id} className="bg-white rounded-xl border border-zinc-200 p-5 flex items-start justify-between gap-4 shadow-sm">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-zinc-800 truncate">{item.title}</h3>
                                        {!item.published && (
                                            <span className="text-[10px] px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded font-medium">草稿</span>
                                        )}
                                        {isExpired(item) && (
                                            <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-500 rounded font-medium">已过期</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-zinc-500 line-clamp-2 whitespace-pre-wrap">{item.content}</p>
                                    <div className="text-xs text-zinc-400 mt-2">
                                        {new Date(item.createdAt).toLocaleString('zh-CN')}
                                        {item.expiresAt && <span className="ml-3">过期：{new Date(item.expiresAt).toLocaleString('zh-CN')}</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <button onClick={() => togglePublish(item)} className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors" title={item.published ? '取消发布' : '发布'}>
                                        {item.published ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                    <button onClick={() => openEdit(item)} className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-indigo-600 transition-colors" title="编辑">
                                        <Pencil size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(item._id)} className="p-2 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors" title="删除">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
