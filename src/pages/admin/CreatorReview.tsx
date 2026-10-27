import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getCreatorReviewQueue, reviewClaim, reviewSubmission, updateEmbedCheck } from '../../api/external-games';
import type { GameSubmissionRecord } from '../../api/game-submissions';
import type { CreatorClaim, ExternalGame } from '../../shared/externalGames';
import { useAuth } from '../../contexts/AuthContext';
import { PrivateEvidence } from '../../components/home/CreatorCenter';
import './creator-review.css';

function SubmissionReview({ token, record, refresh }: { token: string; record: GameSubmissionRecord; refresh: () => void }) {
    const { t } = useTranslation('common');
    const [comment, setComment] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const submit = async (decision: 'approved' | 'rejected') => {
        if (!comment.trim()) { setError('请填写审核意见'); return; }
        setBusy(true); setError('');
        try { await reviewSubmission(token, record.submissionId, { decision, comment: comment.trim(), revision: record.status === 'approved' && !record.gameId ? record.reviewRevision ?? record.updatedAt : record.updatedAt }); refresh(); }
        catch (cause) { setError(cause instanceof Error ? cause.message : '审核失败'); } finally { setBusy(false); }
    };
    return <article className="review-card"><div className="review-card-head"><h2>{record.name}</h2><span>{record.status === 'approved' ? '收录待完成' : '待审核'}</span></div>
        <p>作者：{record.author || '未填写'} · 类别：{record.category === 'uncategorized' ? '暂不分类' : t(`category.${record.category}`, { defaultValue: record.category })}</p>
        <p>人数：{record.minPlayers != null && record.maxPlayers != null ? `${record.minPlayers}–${record.maxPlayers} 人` : '未填写'} · 时长：{record.durationMinutes != null ? `${record.durationMinutes} 分钟` : '未填写'}</p>
        <p>介绍：{record.description}</p><p className="review-long-text">规则：{record.rules || '未填写'}</p>
        <p><a href={record.url} target="_blank" rel="noopener noreferrer">打开游戏网站 ↗</a>{record.authorProfileUrl && <> · <a href={record.authorProfileUrl} target="_blank" rel="noopener noreferrer">作者主页 ↗</a></>}</p>
        {record.coverUrl && <img className="review-cover" src={record.coverUrl} alt={`${record.name}投稿封面`} />}
        <label>审核意见<textarea value={comment} onChange={event => setComment(event.target.value)} maxLength={2000} /></label>
        {error && <p role="alert">{error}</p>}
        <div className="review-actions"><button type="button" disabled={busy} onClick={() => void submit('approved')}>{record.status === 'approved' ? '重试收录' : '批准收录'}</button>{record.status === 'pending' && <button type="button" disabled={busy} onClick={() => void submit('rejected')}>驳回投稿</button>}</div>
    </article>;
}

function ClaimReview({ token, claim, game, refresh }: { token: string; claim: CreatorClaim; game?: ExternalGame; refresh: () => void }) {
    const [comment, setComment] = useState('');
    const [profileChecked, setProfileChecked] = useState(false);
    const [relationshipChecked, setRelationshipChecked] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const submit = async (decision: 'approved' | 'rejected') => {
        if (comment.trim().length < 5) { setError('请填写至少五个字的审核意见'); return; }
        setBusy(true); setError('');
        try { await reviewClaim(token, claim.claimId, { decision, comment: comment.trim(), evidenceDigest: claim.evidenceDigest,
            profileControlVerified: profileChecked, gameRelationshipVerified: relationshipChecked }); refresh(); }
        catch (cause) { setError(cause instanceof Error ? cause.message : '审核失败'); } finally { setBusy(false); }
    };
    return <article className="review-card"><div className="review-card-head"><h2>{game?.name ?? '游戏已隐藏'}</h2><span>作者认领</span></div>
        <p>申请人：{claim.applicantName || '账号资料不可用'}</p><p>作品关系：{claim.explanation}</p>
        <p>作者主页：<a href={claim.profileUrl} target="_blank" rel="noopener noreferrer">{claim.profileUrl} ↗</a></p>
        <p>验证短码：<strong>{claim.verificationCode}</strong> · 提交截止 {new Date(claim.verificationExpiresAt).toLocaleString()}</p>
        {claim.hasEvidence && <PrivateEvidence token={token} claimId={claim.claimId} admin />}
        <label className="review-check"><input type="checkbox" checked={profileChecked} onChange={event => setProfileChecked(event.target.checked)} /> 已核对作者主页控制权</label>
        <label className="review-check"><input type="checkbox" checked={relationshipChecked} onChange={event => setRelationshipChecked(event.target.checked)} /> 已核对作者与该游戏的关系</label>
        <label>审核意见<textarea value={comment} onChange={event => setComment(event.target.value)} maxLength={2000} /></label>
        {error && <p role="alert">{error}</p>}
        <div className="review-actions"><button type="button" disabled={busy || !profileChecked || !relationshipChecked} onClick={() => void submit('approved')}>批准认领</button><button type="button" disabled={busy} onClick={() => void submit('rejected')}>驳回申请</button></div>
    </article>;
}

function EmbedReview({ token, game, refresh }: { token: string; game: ExternalGame; refresh: () => void }) {
    const [status, setStatus] = useState(game.embedStatus);
    const [reason, setReason] = useState(game.embedReason);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    return <form className="review-card" onSubmit={async event => {
        event.preventDefault(); setBusy(true); setError('');
        try { await updateEmbedCheck(token, game.gameId, { status, reason, url: game.url }); refresh(); }
        catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败'); } finally { setBusy(false); }
    }}><div className="review-card-head"><h2>{game.name}</h2><span>{game.published ? '公开' : '隐藏'}</span></div>
        <p><a href={game.url} target="_blank" rel="noopener noreferrer">{game.url} ↗</a></p>
        <label>实际嵌入检查结果<select value={status} onChange={event => setStatus(event.target.value as typeof status)}><option value="unknown">待检查</option><option value="allowed">允许嵌入</option><option value="blocked">不允许嵌入</option></select></label>
        <label>检查说明<textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} /></label>
        {error && <p role="alert">{error}</p>}<div className="review-actions"><button type="submit" disabled={busy}>保存检查结果</button></div>
    </form>;
}

export default function CreatorReview() {
    const { token } = useAuth();
    const client = useQueryClient();
    const [tab, setTab] = useState<'submissions' | 'claims' | 'games'>('submissions');
    const queue = useQuery({ queryKey: ['creator-review'], queryFn: () => getCreatorReviewQueue(token!), enabled: Boolean(token) });
    const refresh = () => { void client.invalidateQueries({ queryKey: ['creator-review'] }); void client.invalidateQueries({ queryKey: ['external-games'] }); };
    return <div className="creator-review-page"><Link to="/admin" className="creator-review-back">← 返回管理后台</Link><header><h1>投稿与作者认证</h1><p>核对游戏投稿、作者身份和外站嵌入状态。</p><button type="button" disabled={queue.isFetching} onClick={() => void queue.refetch()}>刷新队列</button></header>
        <nav className="review-tabs" aria-label="审核类型">{([['submissions', '游戏投稿'], ['claims', '作者认领'], ['games', '嵌入检查']] as const).map(([id, label]) => <button key={id} type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => { setTab(id); void queue.refetch(); }}>{label}</button>)}</nav>
        {queue.isPending && <p role="status">正在加载审核队列…</p>}
        {queue.isFetching && !queue.isPending && <p role="status">正在刷新审核队列…</p>}
        {queue.isError && <p role="alert">审核队列读取失败。<button onClick={() => void queue.refetch()}>重试</button></p>}
        {queue.data && !queue.isFetching && !queue.isError && <div className="review-list">
            {tab === 'submissions' && (queue.data.submissions.length ? queue.data.submissions.map(record => <SubmissionReview key={record.submissionId} token={token!} record={record} refresh={refresh} />) : <p className="review-empty">暂无待审核投稿。</p>)}
            {tab === 'claims' && (queue.data.claims.length ? queue.data.claims.map(claim => <ClaimReview key={claim.claimId} token={token!} claim={claim} game={queue.data.games.find(game => game.gameId === claim.gameId)} refresh={refresh} />) : <p className="review-empty">暂无待审核认证。</p>)}
            {tab === 'games' && (queue.data.games.length ? queue.data.games.map(game => <EmbedReview key={`${game.gameId}-${game.updatedAt}`} token={token!} game={game} refresh={refresh} />) : <p className="review-empty">暂无已收录外部游戏。</p>)}
        </div>}
    </div>;
}
