import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createCreatorClaim, getClaimEvidence, listCreatorClaims, listExternalGames, listOwnedGames, submitCreatorClaim, uploadClaimEvidence, withdrawCreatorClaim } from '../../api/external-games';
import { listGameSubmissions } from '../../api/game-submissions';
import type { CreatorClaim, ExternalGame } from '../../shared/externalGames';
import { GameSubmissionForm } from './PlatformUploadWorkspace';
import { getSessionStorage, readSessionStorageItem } from '../../lib/browserStorage';
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
    return <section className="creator-center"><header className="creator-heading"><div><h2>我的投稿</h2><p>查看你提交的游戏和审核进度。</p></div><button type="button" className="creator-primary" onClick={() => onOpen()}>＋ 投稿游戏</button></header>
        <label className="creator-filter">状态<select value={filter} onChange={event => onFilterChange(event.target.value)}><option value="all">全部</option>{Object.entries(submissionStatus).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        {records.isPending && <p role="status">正在加载投稿…</p>}
        {records.isError && <p role="alert">投稿读取失败。<button onClick={() => void records.refetch()}>重试</button></p>}
        {records.isSuccess && !items.length && <div className="creator-empty"><strong>还没有符合条件的投稿</strong><p>你提交的游戏会显示在这里。</p></div>}
        <div className="creator-list">{items.map(record => <article className="creator-row" key={record.submissionId}>
            {record.coverUrl ? <img className="creator-thumb" src={record.coverUrl} alt="" /> : <span className="creator-thumb creator-thumb-placeholder">{record.name.slice(0, 1)}</span>}
            <div className="creator-row-main"><strong>{record.name}</strong><span>{record.status === 'approved' && !record.gameId ? '收录处理中' : submissionStatus[record.status]} · 更新于 {new Date(record.updatedAt).toLocaleDateString()}</span>{record.reviewComment && <small>{record.reviewComment}</small>}</div>
            <button type="button" onClick={() => onOpen(record.submissionId)}>{record.status === 'pending' ? '查看投稿' : '编辑投稿'}</button>
        </article>)}</div>
    </section>;
}

export function MyWorks({ token, userId, onTab, onOpenGame }: { token: string; userId: string; onTab: (tab: string) => void; onOpenGame: (id: string, preview?: boolean) => void }) {
    const client = useQueryClient();
    const games = useQuery({ queryKey: ['owned-external-games', userId], queryFn: () => listOwnedGames(token) });
    const [editingId, setEditingId] = useState('');
    const game = games.data?.items.find(item => item.gameId === editingId);
    if (game) return <section className="creator-center"><button type="button" onClick={() => setEditingId('')}>← 返回我的作品</button><GameSubmissionForm key={game.gameId} ownedGame={game} onSaved={() => {
        setEditingId(''); void client.invalidateQueries({ queryKey: ['owned-external-games', userId] });
        void client.invalidateQueries({ queryKey: ['external-games'] }); void client.invalidateQueries({ queryKey: ['external-game', game.gameId] });
    }} /></section>;
    return <section className="creator-center"><header className="creator-heading"><div><h2>我的作品</h2><p>管理通过作者认领的游戏。</p></div><button type="button" className="creator-primary" onClick={() => onTab('verification')}>申请认领</button></header>
        {games.isPending && <p role="status">正在加载作品…</p>}
        {games.isError && <p role="alert">作品读取失败。<button onClick={() => void games.refetch()}>重试</button></p>}
        {games.isSuccess && !games.data.items.length && <div className="creator-empty"><strong>还没有可管理的作品</strong><p>通过作者认证后，作品会显示在这里。</p></div>}
        <div className="creator-list">{games.data?.items.map(item => <article className="creator-row" key={item.gameId}>
            {item.coverUrl ? <img className="creator-thumb" src={item.coverUrl} alt="" /> : <span className="creator-thumb creator-thumb-placeholder">{item.name.slice(0, 1)}</span>}
            <div className="creator-row-main"><strong>{item.name}</strong><span>{item.published ? '公开展示' : '未公开'} · {item.author}</span></div>
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

function ClaimItem({ claim, game, token, refresh }: { claim: CreatorClaim; game?: ExternalGame; token: string; refresh: () => void }) {
    const [file, setFile] = useState<File>();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const act = async (operation: () => Promise<unknown>) => {
        setBusy(true); setError(''); try { await operation(); refresh(); }
        catch (cause) { setError(cause instanceof Error ? cause.message : '操作失败'); } finally { setBusy(false); }
    };
    return <article className="creator-claim"><div className="creator-row-main"><strong>{game?.name ?? '游戏已隐藏'}</strong><span>{claimStatus[claim.status]} · {claim.profileUrl}</span>
        {claim.reviewComment && <p>{claim.reviewComment}</p>}
        {(claim.status === 'draft' || claim.status === 'pending') && <p>验证短码：<b>{claim.verificationCode}</b>，提交截止 {new Date(claim.verificationExpiresAt).toLocaleString()}。请将短码放到作者主页供管理员核对，或提供后台控制权截图。</p>}
    </div>
    {claim.hasEvidence && <PrivateEvidence token={token} claimId={claim.claimId} />}
    {claim.status === 'draft' && <div className="creator-claim-actions"><label>认证截图<input type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={event => setFile(event.target.files?.[0])} /></label>
        <button type="button" disabled={busy || !file} onClick={() => file && void act(() => uploadClaimEvidence(token, claim.claimId, file))}>上传截图</button>
        <button type="button" disabled={busy || !claim.hasEvidence} onClick={() => void act(() => submitCreatorClaim(token, claim.claimId))}>提交审核</button></div>}
    {(claim.status === 'draft' || claim.status === 'pending') && <button type="button" disabled={busy} onClick={() => void act(() => withdrawCreatorClaim(token, claim.claimId))}>撤回申请</button>}
    {error && <p role="alert">{error}</p>}</article>;
}

export function CreatorVerification({ token, userId, initialGameId }: { token: string; userId: string; initialGameId: string }) {
    const client = useQueryClient();
    const claims = useQuery({ queryKey: ['creator-claims', userId], queryFn: () => listCreatorClaims(token) });
    const games = useQuery({ queryKey: ['external-games'], queryFn: listExternalGames });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [selectedGameId, setSelectedGameId] = useState(initialGameId);
    useEffect(() => setSelectedGameId(initialGameId), [initialGameId]);
    const refresh = () => { void client.invalidateQueries({ queryKey: ['creator-claims', userId] }); void client.invalidateQueries({ queryKey: ['owned-external-games', userId] }); };
    return <section className="creator-center"><header className="creator-heading"><div><h2>作者认证</h2><p>确认作者身份后，可管理对应作品。</p></div></header>
        <form className="creator-claim-form" onSubmit={async event => {
            event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); setBusy(true); setError('');
            try { await createCreatorClaim(token, { gameId: String(data.get('gameId')), profileUrl: String(data.get('profileUrl')).trim(), explanation: String(data.get('explanation')).trim() }); refresh(); form.reset(); setSelectedGameId(''); }
            catch (cause) { setError(cause instanceof Error ? cause.message : '申请失败'); } finally { setBusy(false); }
        }}>
            <h3>申请认领</h3><p>先选择作品并填写作者主页；下一步上传截图并提交审核。</p>
            <label>选择游戏<select name="gameId" required value={selectedGameId} onChange={event => setSelectedGameId(event.target.value)}><option value="">请选择已收录游戏</option>{games.data?.items.map(game => <option key={game.gameId} value={game.gameId}>{game.name} · {game.author}</option>)}</select></label>
            <label>作者主页<input name="profileUrl" required type="url" placeholder="https://" maxLength={2048} /></label>
            <label>你与游戏的关系<textarea name="explanation" required minLength={10} maxLength={4000} placeholder="请说明你如何参与制作这款游戏" /></label>
            {games.isError && <p role="alert">游戏列表读取失败。<button type="button" onClick={() => void games.refetch()}>重试</button></p>}
            {error && <p role="alert">{error}</p>}<button className="creator-primary" type="submit" disabled={busy || games.isPending || games.isError}>创建认证申请</button>
        </form>
        <h3 className="creator-section-title">我的申请</h3>
        {claims.isPending && <p role="status">正在加载申请…</p>}
        {claims.isError && <p role="alert">申请读取失败。<button onClick={() => void claims.refetch()}>重试</button></p>}
        {claims.isSuccess && !claims.data.items.length && <p className="creator-empty">还没有申请记录。</p>}
        <div className="creator-list">{claims.data?.items.map(claim => <ClaimItem key={claim.claimId} claim={claim} game={games.data?.items.find(game => game.gameId === claim.gameId)} token={token} refresh={refresh} />)}</div>
    </section>;
}
