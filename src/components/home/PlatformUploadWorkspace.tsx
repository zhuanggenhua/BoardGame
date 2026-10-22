import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { listGameSubmissions, saveGameSubmission, submitGameSubmission, uploadSubmissionCover, type GameSubmissionDraft, type GameSubmissionRecord } from '../../api/game-submissions';
import { useDocumentScrollLock } from '../../hooks/ui/useDocumentScrollLock';
import './platform-upload.css';

const statusLabels = { draft: '草稿', pending: '待审核', approved: '已通过', rejected: '需修改' };

function SubmissionForm({ record, onSaved }: { record?: GameSubmissionRecord; onSaved: (id: string) => void }) {
    const { token, user } = useAuth();
    const [draftId, setDraftId] = useState(record?.submissionId);
    const [url, setUrl] = useState(record?.url ?? '');
    const [file, setFile] = useState<File>();
    const [preview, setPreview] = useState(record?.coverUrl ?? '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        if (!file) { setPreview(record?.coverUrl ?? ''); return; }
        const objectUrl = URL.createObjectURL(file); setPreview(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [file, record?.coverUrl]);
    let validUrl = false;
    try { const parsed = new URL(url); validUrl = ['http:', 'https:'].includes(parsed.protocol) && Boolean(parsed.hostname) && !parsed.username && !parsed.password; } catch { /* Empty or incomplete input is an editable form state. */ }
    return <form className="platform-upload-form" onSubmit={async event => {
        event.preventDefault();
        if (!token || busy) return;
        const form = new FormData(event.currentTarget);
        const data: GameSubmissionDraft = {
            name: String(form.get('name') ?? '').trim(), url: url.trim(), category: String(form.get('category')),
            minPlayers: Number(form.get('minPlayers')), maxPlayers: Number(form.get('maxPlayers')),
            author: String(form.get('author') ?? '').trim(), description: String(form.get('description') ?? '').trim(), rules: String(form.get('rules') ?? '').trim(),
            ...(form.get('durationMinutes') ? { durationMinutes: Number(form.get('durationMinutes')) } : {}),
        };
        if (!validUrl || data.minPlayers > data.maxPlayers) { setError('请检查游戏链接与人数范围'); return; }
        if (!file && !record?.coverUrl) { setError('请选择封面图片'); return; }
        setBusy(true); setError('');
        try {
            const saved = await saveGameSubmission(token, data, draftId);
            setDraftId(saved.submissionId);
            if (file) await uploadSubmissionCover(token, saved.submissionId, file);
            await submitGameSubmission(token, saved.submissionId);
            onSaved(saved.submissionId);
        } catch (cause) { setError(cause instanceof Error ? cause.message : '提交失败，请重试'); }
        finally { setBusy(false); }
    }}>
        <h2>{record ? record.name : '上传新游戏'}</h2>
        <p>提交游戏链接、介绍、封面和规则。审核通过后展示，不替代官方游戏实现。</p>
        {record && <p role="status">{statusLabels[record.status]}{record.reviewComment ? ` · ${record.reviewComment}` : ''}</p>}
        <div className="platform-upload-fields">
            <label>游戏名称<input name="name" required maxLength={100} defaultValue={record?.name} /></label>
            <label>游戏链接<input name="url" type="url" required value={url} onChange={event => setUrl(event.target.value)} placeholder="https://" aria-describedby="submission-url-check" />
                <small id="submission-url-check">{!url ? '填写可访问的游戏链接' : validUrl ? '链接格式有效；尚未验证网站运行情况' : '请填写完整的 http 或 https 链接'}</small>
            </label>
            <label>类别<select name="category" defaultValue={record?.category ?? 'card'}>
                <option value="card">卡牌</option><option value="dice">骰子</option><option value="abstract">抽象</option><option value="wargame">战棋</option><option value="casual">休闲</option><option value="tools">工具</option>
            </select></label>
            <fieldset><legend>人数</legend><div className="platform-player-range">
                <select name="minPlayers" aria-label="最少人数" defaultValue={record?.minPlayers ?? 2}>{Array.from({ length: 16 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select>
                <span>至</span><select name="maxPlayers" aria-label="最多人数" defaultValue={record?.maxPlayers ?? 4}>{Array.from({ length: 16 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select>
            </div></fieldset>
            <label>估计时长（分钟）<input name="durationMinutes" type="number" min={1} max={1440} defaultValue={record?.durationMinutes} /></label>
            <label>作者<input name="author" maxLength={100} defaultValue={record?.author ?? user?.username} /></label>
            <label>介绍<textarea name="description" required maxLength={10000} defaultValue={record?.description} /></label>
            <label>规则文档<textarea name="rules" maxLength={50000} defaultValue={record?.rules} /></label>
            <label className="platform-cover-upload">封面
                {preview && <img src={preview} alt="投稿封面预览" />}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={event => {
                    const selected = event.target.files?.[0];
                    if (selected && selected.size > 10 * 1024 * 1024) {
                        setFile(undefined); event.currentTarget.value = ''; setError('封面不能超过 10 MB'); return;
                    }
                    setError(''); setFile(selected);
                }} />
            </label>
        </div>
        {error && <p role="alert">{error}</p>}
        <button className="platform-submit" type="submit" disabled={busy}>{busy ? '正在提交…' : '提交审核'}</button>
    </form>;
}

export function PlatformUploadWorkspace({ onLogin }: { onLogin: () => void }) {
    const { token, user } = useAuth();
    const client = useQueryClient();
    const [selectedId, setSelectedId] = useState<string>();
    const [showList, setShowList] = useState(false);
    const listDialog = useRef<HTMLDialogElement>(null);
    useDocumentScrollLock(Boolean(user) && showList);
    useEffect(() => { if (!user) setShowList(false); }, [user]);
    useEffect(() => {
        if (showList && listDialog.current && !listDialog.current.open) listDialog.current.showModal();
        if (!showList && listDialog.current?.open) listDialog.current.close();
    }, [showList]);
    const queryKey = ['game-submissions', user?.id] as const;
    const records = useQuery({ queryKey, queryFn: () => listGameSubmissions(token!), enabled: Boolean(token && user) });
    if (!user) return <section className="platform-upload-login"><h2>上传新游戏</h2><p>登录后可以保存投稿并查看审核结果。</p><button type="button" onClick={onLogin}>登录</button></section>;
    const selected = records.data?.items.find(record => record.submissionId === selectedId);
    const listContent = <>
        <button type="button" onClick={() => { setSelectedId(undefined); setShowList(false); }}>上传新游戏</button>
        {records.data?.items.map(record => <button key={record.submissionId} type="button" aria-current={record.submissionId === selectedId ? 'page' : undefined}
            onClick={() => { setSelectedId(record.submissionId); setShowList(false); }}>{record.name}<small>{statusLabels[record.status]}</small></button>)}
        {records.isPending && <p role="status">正在加载投稿…</p>}
        {records.isSuccess && records.data.items.length === 0 && <p className="platform-upload-empty" role="status">还没有投稿，填写新游戏资料后可提交审核。</p>}
        {records.error && <p role="alert">加载投稿失败<button type="button" onClick={() => void records.refetch()}>重试</button></p>}
    </>;
    return <section className="platform-upload-workspace">
        <button className="platform-upload-list-toggle" type="button" aria-expanded={showList} onClick={() => setShowList(true)}>工坊列表</button>
        <aside className="platform-upload-list">{listContent}</aside>
        <dialog ref={listDialog} className="platform-upload-drawer" aria-label="工坊列表" onCancel={() => setShowList(false)} onClose={() => setShowList(false)} onClick={event => {
            if (event.target === event.currentTarget) setShowList(false);
        }}>
            {showList && <div className="platform-upload-drawer-panel"><header><h2>工坊列表</h2><button type="button" aria-label="关闭工坊列表" onClick={() => setShowList(false)}>×</button></header>{listContent}</div>}
        </dialog>
        <SubmissionForm key={selected?.submissionId ?? 'new'} record={selected} onSaved={id => {
            setSelectedId(id); void client.invalidateQueries({ queryKey });
        }} />
    </section>;
}
