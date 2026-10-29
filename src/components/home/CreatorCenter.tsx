import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UI_Z_INDEX } from '../../core';
import { createCreatorClaim, getClaimEvidence, listCreatorClaims, listOwnedGames, submitCreatorClaim, uploadClaimEvidence, withdrawCreatorClaim } from '../../api/external-games';
import { listGameSubmissions } from '../../api/game-submissions';
import type { CreatorClaim } from '../../shared/externalGames';
import { GameSubmissionForm } from './PlatformUploadWorkspace';
import { getSessionStorage, readSessionStorageItem } from '../../lib/browserStorage';
import './platform-upload.css';
import './creator-center.css';

const submissionStatus = { draft: '草稿', pending: '待审核', approved: '已收录', rejected: '未通过' } as const;
const claimStatus = { draft: '待提交', pending: '待审核', approved: '已通过', rejected: '未通过' } as const;
type OpenSubmission = (id?: string) => void;

export function MySubmissions({ token, userId, onOpen, filter = 'all', onFilterChange = () => {} }: { token: string; userId: string; onOpen: OpenSubmission; filter?: string; onFilterChange?: (filter: string) => void }) {
    const records = useQuery({ queryKey: ['game-submissions', userId], queryFn: () => listGameSubmissions(token) });
    useEffect(() => {
        if (!records.isSuccess) return;
        const raw = readSessionStorageItem('bg-submission-return');
        if (!raw) return;
        try {
            const previous = JSON.parse(raw) as { userId?: unknown; filter?: unknown; scroll?: unknown };
            if (previous.userId === userId && previous.filter === filter && typeof previous.scroll === 'number') {
                window.requestAnimationFrame(() => window.scrollTo({ top: previous.scroll as number, behavior: 'instant' }));
                getSessionStorage()?.removeItem('bg-submission-return');
            }
        } catch { /* 列表仍可浏览，只放弃不可用的本次滚动位置。 */ }
    }, [filter, records.isSuccess, userId]);
    const items = records.data?.items.filter(record => filter === 'all' || record.status === filter) ?? [];
    const empty = records.isSuccess && !items.length;
    return <section className="creator-center"><header className="creator-heading"><h2>我的投稿</h2>{!empty && <button type="button" className="creator-primary" onClick={() => onOpen()}>＋ 投稿游戏</button>}</header>
        <label className="creator-filter">状态<select value={filter} onChange={event => onFilterChange(event.target.value)}><option value="all">全部</option>{Object.entries(submissionStatus).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        {records.isPending && <p role="status">正在加载投稿…</p>}
        {records.isError && <p role="alert">投稿读取失败。<button type="button" onClick={() => void records.refetch()}>重试</button></p>}
        {empty && <div className="creator-empty"><strong>还没有符合条件的投稿</strong><p>你提交的游戏会显示在这里。</p><button type="button" className="creator-primary" onClick={() => onOpen()}>＋ 投稿游戏</button></div>}
        <div className="creator-list">{items.map(record => <article className="creator-row" key={record.submissionId}>
            {record.coverUrl ? <img className="creator-thumb" src={record.coverUrl} alt="" /> : <span className="creator-thumb creator-thumb-placeholder">{record.name.slice(0, 1)}</span>}
            <div className="creator-row-main"><strong>{record.name}</strong><span className="creator-row-meta"><span className={`creator-status is-${record.status}`}>{record.status === 'approved' && !record.gameId ? '收录处理中' : submissionStatus[record.status]}</span><span>更新于 {new Date(record.updatedAt).toLocaleDateString()}</span></span>{record.reviewComment && <small>{record.reviewComment}</small>}</div>
            <div className="creator-row-actions"><button type="button" onClick={() => onOpen(record.submissionId)}>{record.status === 'pending' ? '查看投稿' : '编辑投稿'}</button></div>
        </article>)}</div>
    </section>;
}

export function MyWorks({ token, userId, onOpenGame }: { token: string; userId: string; onOpenGame: (id: string, preview?: boolean) => void }) {
    const client = useQueryClient();
    const games = useQuery({ queryKey: ['owned-external-games', userId], queryFn: () => listOwnedGames(token) });
    const [editingId, setEditingId] = useState('');
    const game = games.data?.items.find(item => item.gameId === editingId);
    const empty = games.isSuccess && !games.data.items.length;
    if (game) return <section className="creator-center"><button type="button" onClick={() => setEditingId('')}>← 返回我的作品</button><GameSubmissionForm key={game.gameId} ownedGame={game} onSaved={() => {
        setEditingId(''); void client.invalidateQueries({ queryKey: ['owned-external-games', userId] });
        void client.invalidateQueries({ queryKey: ['external-games'] }); void client.invalidateQueries({ queryKey: ['external-game', game.gameId] });
    }} /></section>;
    return <section className="creator-center"><header className="creator-heading"><h2>我的作品</h2></header>
        {games.isPending && <p role="status">正在加载作品…</p>}
        {games.isError && <p role="alert">作品读取失败。<button type="button" onClick={() => void games.refetch()}>重试</button></p>}
        {empty && <div className="creator-empty"><strong>还没有可管理的作品</strong><p>打开游戏详情，点击作者名字，在作者信息里申请认领。</p></div>}
        <div className="creator-list">{games.data?.items.map(item => <article className="creator-row" key={item.gameId}>
            {item.coverUrl ? <img className="creator-thumb" src={item.coverUrl} alt="" /> : <span className="creator-thumb creator-thumb-placeholder">{item.name.slice(0, 1)}</span>}
            <div className="creator-row-main"><strong>{item.name}</strong><span className="creator-row-meta"><span className={`creator-status ${item.published ? 'is-approved' : 'is-draft'}`}>{item.published ? '公开展示' : '未公开'}</span><span>{item.author}</span></span></div>
            <div className="creator-row-actions"><button type="button" onClick={() => setEditingId(item.gameId)}>编辑作品</button><button type="button" onClick={() => onOpenGame(item.gameId, true)}>预览作品</button></div>
        </article>)}</div>
    </section>;
}

export function PrivateEvidence({ token, claimId, admin = false }: { token: string; claimId: string; admin?: boolean }) {
    const [url, setUrl] = useState('');
    const [error, setError] = useState('');
    useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
    return <div className="creator-evidence">{url ? <><img src={url} alt="认证材料截图" /><button type="button" onClick={() => setUrl('')}>收起截图</button></> : <button type="button" onClick={async () => {
        setError(''); try { setUrl(URL.createObjectURL(await getClaimEvidence(token, claimId, admin))); } catch (cause) { setError(cause instanceof Error ? cause.message : '读取失败'); }
    }}>查看认证截图</button>}{error && <p role="alert">{error}</p>}</div>;
}

function CreatorClaimForm({ claim, token, gameId, gameName, profileUrl = '', onSaved }: {
    claim?: CreatorClaim; token: string; gameId: string; gameName: string; profileUrl?: string; onSaved: () => void;
}) {
    const [file, setFile] = useState<File>();
    const [preview, setPreview] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const pending = claim?.status === 'pending';
    const locked = pending || busy;
    useEffect(() => {
        if (file) {
            const objectUrl = URL.createObjectURL(file); setPreview(objectUrl);
            return () => URL.revokeObjectURL(objectUrl);
        }
        if (!claim?.hasEvidence) { setPreview(''); return; }
        let cancelled = false;
        let objectUrl = '';
        void getClaimEvidence(token, claim.claimId).then(blob => {
            if (cancelled) return;
            objectUrl = URL.createObjectURL(blob); setPreview(objectUrl);
        }).catch(() => { if (!cancelled) setPreview(''); });
        return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [file, claim?.claimId, claim?.hasEvidence, token]);
    return <form className="platform-upload-form" onSubmit={async event => {
        event.preventDefault();
        if (busy || pending) return;
        const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') ?? 'submit';
        const data = new FormData(event.currentTarget);
        const nextUrl = claim ? claim.profileUrl : String(data.get('profileUrl') ?? '').trim();
        const nextExplanation = claim ? claim.explanation : String(data.get('explanation') ?? '').trim();
        if (action === 'submit' && !file && !claim?.hasEvidence) { setError('请上传作者主页截图或控制权证据'); return; }
        setBusy(true); setError('');
        try {
            let claimId = claim?.claimId;
            if (!claimId) {
                const created = await createCreatorClaim(token, { gameId, profileUrl: nextUrl, explanation: nextExplanation });
                claimId = created.claimId;
            }
            if (file) await uploadClaimEvidence(token, claimId, file);
            if (action === 'submit') await submitCreatorClaim(token, claimId);
            onSaved();
        } catch (cause) { setError(cause instanceof Error ? cause.message : '申请失败'); }
        finally { setBusy(false); }
    }}>
        <header className="platform-upload-form-heading"><h2>申请认领</h2></header>
        <p>提交作者主页、关系说明，并上传能证明主页或作品控制权的截图。没有截图不能送审。</p>
        <p className="creator-claim-target">当前游戏：{gameName}</p>
        {claim && <p role="status"><span className={`creator-status is-${claim.status}`}>{claimStatus[claim.status]}</span>{claim.reviewComment ? ` · ${claim.reviewComment}` : ''}</p>}
        {pending && <p>审核期间资料已锁定。需要修改时可撤回申请。</p>}
        {claim && (claim.status === 'draft' || claim.status === 'pending') && <p className="creator-code">验证短码：<b>{claim.verificationCode}</b>，提交截止 {new Date(claim.verificationExpiresAt).toLocaleString()}。请将短码放到作者主页供管理员核对，或提供后台控制权截图。</p>}
        <fieldset disabled={locked} className="platform-upload-fields">
            <label>作者主页<input name="profileUrl" required type="url" placeholder="https://" maxLength={2048} defaultValue={claim?.profileUrl ?? profileUrl} readOnly={Boolean(claim)} /></label>
            <label className="platform-cover-upload">认证截图
                {preview && <img src={preview} alt="认证截图预览" onError={() => { setPreview(''); setError('截图无法预览，请换一张图片'); }} />}
                <input type="file" aria-label="认证截图" accept="image/png,image/jpeg,image/webp,image/avif" onChange={event => {
                    const selected = event.target.files?.[0];
                    if (selected && selected.size > 5 * 1024 * 1024) {
                        setFile(undefined); event.currentTarget.value = ''; setError('截图不能超过 5MB'); return;
                    }
                    setError(''); setFile(selected);
                }} />
                <small>必须上传作者主页截图或后台控制权证据，才能提交审核。</small>
            </label>
            <label className="creator-claim-explanation">你与游戏的关系<textarea name="explanation" required minLength={10} maxLength={4000} placeholder="请说明你如何参与制作这款游戏" defaultValue={claim?.explanation} readOnly={Boolean(claim)} /></label>
        </fieldset>
        {error && <p role="alert">{error}</p>}
        {pending ? <button type="button" disabled={busy} onClick={async () => {
            setBusy(true); setError('');
            try { await withdrawCreatorClaim(token, claim.claimId); onSaved(); }
            catch (cause) { setError(cause instanceof Error ? cause.message : '撤回失败'); } finally { setBusy(false); }
        }}>撤回申请</button> : <div className="platform-upload-actions">
            <button type="submit" value="draft" disabled={busy}>保存草稿</button>
            <button className="platform-submit" type="submit" value="submit" disabled={busy}>{busy ? '正在提交…' : '提交审核'}</button>
        </div>}
    </form>;
}

export function CreatorClaimPanel({ token, userId, gameId, gameName, profileUrl = '', onClose }: {
    token: string; userId: string; gameId: string; gameName: string; profileUrl?: string; onClose: () => void;
}) {
    const client = useQueryClient();
    const claims = useQuery({ queryKey: ['creator-claims', userId], queryFn: () => listCreatorClaims(token) });
    const mine = claims.data?.items.filter(item => item.gameId === gameId) ?? [];
    const active = mine.find(item => item.status === 'draft' || item.status === 'pending');
    const previous = mine.find(item => item.status === 'rejected');
    const refresh = () => { void client.invalidateQueries({ queryKey: ['creator-claims', userId] }); void client.invalidateQueries({ queryKey: ['owned-external-games', userId] }); };
    return <section className="creator-claim-overlay" data-testid="creator-claim-panel" style={{ zIndex: UI_Z_INDEX.modalContent }}>
        <div className="creator-claim-sheet">
            <button type="button" className="platform-upload-back" onClick={onClose}>← 返回游戏详情</button>
            {claims.isPending && <p role="status">正在加载申请…</p>}
            {claims.isError && <p role="alert">申请读取失败。<button type="button" onClick={() => void claims.refetch()}>重试</button></p>}
            {claims.isSuccess && <>
                {!active && previous && <p role="status">上次申请未通过{previous.reviewComment ? `：${previous.reviewComment}` : '。'}可修改材料后重新提交。</p>}
                <CreatorClaimForm key={active?.claimId ?? 'new'} claim={active} token={token} gameId={gameId} gameName={gameName} profileUrl={profileUrl} onSaved={refresh} />
            </>}
        </div>
    </section>;
}
