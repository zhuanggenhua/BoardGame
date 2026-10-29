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
    const { t } = useTranslation(['lobby', 'common']);
    const [comment, setComment] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const submit = async (decision: 'approved' | 'rejected') => {
        if (!comment.trim()) { setError(t('platform.creatorReview.commentRequired')); return; }
        setBusy(true); setError('');
        try { await reviewSubmission(token, record.submissionId, { decision, comment: comment.trim(), revision: record.status === 'approved' && !record.gameId ? record.reviewRevision ?? record.updatedAt : record.updatedAt }); refresh(); }
        catch (cause) { setError(cause instanceof Error ? cause.message : t('platform.creatorReview.reviewFailed')); } finally { setBusy(false); }
    };
    return <article className="review-card"><div className="review-card-head"><h2>{record.name}</h2><span>{record.status === 'approved' ? t('platform.creatorReview.inclusionPending') : t('platform.creatorReview.pendingReview')}</span></div>
        <p>{t('platform.creatorReview.author')}: {record.author || t('platform.creatorReview.notProvided')} · {t('platform.creatorReview.category')}: {record.category === 'uncategorized' ? t('platform.uploadWorkspace.uncategorized') : t(`common:category.${record.category}`, { defaultValue: record.category })}</p>
        <p>{t('platform.creatorReview.players')}: {record.minPlayers != null && record.maxPlayers != null ? t('platform.creatorReview.playerRange', { min: record.minPlayers, max: record.maxPlayers }) : t('platform.creatorReview.notProvided')} · {t('platform.creatorReview.duration')}: {record.durationMinutes != null ? t('platform.creatorReview.durationMinutes', { minutes: record.durationMinutes }) : t('platform.creatorReview.notProvided')}</p>
        <p>{t('platform.creatorReview.gameDescription')}: {record.description}</p><p className="review-long-text">{t('platform.creatorReview.rules')}: {record.rules || t('platform.creatorReview.notProvided')}</p>
        <p><a href={record.url} target="_blank" rel="noopener noreferrer">{t('platform.creatorReview.openGameSite')} ↗</a>{record.authorProfileUrl && <> · <a href={record.authorProfileUrl} target="_blank" rel="noopener noreferrer">{t('platform.creatorReview.authorProfile')} ↗</a></>}</p>
        {record.coverUrl && <img className="review-cover" src={record.coverUrl} alt={t('platform.creatorReview.submissionCoverAlt', { name: record.name })} />}
        <label>{t('platform.creatorReview.reviewComment')}<textarea value={comment} onChange={event => setComment(event.target.value)} maxLength={2000} /></label>
        {error && <p role="alert">{error}</p>}
        <div className="review-actions"><button type="button" disabled={busy} onClick={() => void submit('approved')}>{record.status === 'approved' ? t('platform.creatorReview.retryInclusion') : t('platform.creatorReview.approveInclusion')}</button>{record.status === 'pending' && <button type="button" disabled={busy} onClick={() => void submit('rejected')}>{t('platform.creatorReview.rejectSubmission')}</button>}</div>
    </article>;
}

function ClaimReview({ token, claim, game, refresh }: { token: string; claim: CreatorClaim; game?: ExternalGame; refresh: () => void }) {
    const { t } = useTranslation('lobby');
    const [comment, setComment] = useState('');
    const [profileChecked, setProfileChecked] = useState(false);
    const [relationshipChecked, setRelationshipChecked] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const submit = async (decision: 'approved' | 'rejected') => {
        if (comment.trim().length < 5) { setError(t('platform.creatorReview.commentMinLength')); return; }
        setBusy(true); setError('');
        try { await reviewClaim(token, claim.claimId, { decision, comment: comment.trim(), evidenceDigest: claim.evidenceDigest,
            profileControlVerified: profileChecked, gameRelationshipVerified: relationshipChecked }); refresh(); }
        catch (cause) { setError(cause instanceof Error ? cause.message : t('platform.creatorReview.reviewFailed')); } finally { setBusy(false); }
    };
    return <article className="review-card"><div className="review-card-head"><h2>{game?.name ?? t('platform.creatorReview.gameHidden')}</h2><span>{t('platform.creatorReview.authorClaim')}</span></div>
        <p>{t('platform.creatorReview.applicant')}: {claim.applicantName || t('platform.creatorReview.accountUnavailable')}</p><p>{t('platform.creatorReview.workRelationship')}: {claim.explanation}</p>
        <p>{t('platform.creatorReview.authorProfile')}: <a href={claim.profileUrl} target="_blank" rel="noopener noreferrer">{claim.profileUrl} ↗</a></p>
        <p>{t('platform.creatorReview.verificationCode')}: <strong>{claim.verificationCode}</strong> · {t('platform.creatorReview.submissionDeadline', { deadline: new Date(claim.verificationExpiresAt).toLocaleString() })}</p>
        {claim.hasEvidence && <PrivateEvidence token={token} claimId={claim.claimId} admin />}
        <label className="review-check"><input type="checkbox" checked={profileChecked} onChange={event => setProfileChecked(event.target.checked)} /> {t('platform.creatorReview.profileControlChecked')}</label>
        <label className="review-check"><input type="checkbox" checked={relationshipChecked} onChange={event => setRelationshipChecked(event.target.checked)} /> {t('platform.creatorReview.relationshipChecked')}</label>
        <label>{t('platform.creatorReview.reviewComment')}<textarea value={comment} onChange={event => setComment(event.target.value)} maxLength={2000} /></label>
        {error && <p role="alert">{error}</p>}
        <div className="review-actions"><button type="button" disabled={busy || !profileChecked || !relationshipChecked} onClick={() => void submit('approved')}>{t('platform.creatorReview.approveClaim')}</button><button type="button" disabled={busy} onClick={() => void submit('rejected')}>{t('platform.creatorReview.rejectClaim')}</button></div>
    </article>;
}

function EmbedReview({ token, game, refresh }: { token: string; game: ExternalGame; refresh: () => void }) {
    const { t } = useTranslation('lobby');
    const [status, setStatus] = useState(game.embedStatus);
    const [reason, setReason] = useState(game.embedReason);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    return <form className="review-card" onSubmit={async event => {
        event.preventDefault(); setBusy(true); setError('');
        try { await updateEmbedCheck(token, game.gameId, { status, reason, url: game.url }); refresh(); }
        catch (cause) { setError(cause instanceof Error ? cause.message : t('platform.creatorReview.saveFailed')); } finally { setBusy(false); }
    }}><div className="review-card-head"><h2>{game.name}</h2><span>{game.published ? t('platform.creatorReview.public') : t('platform.creatorReview.hidden')}</span></div>
        <p><a href={game.url} target="_blank" rel="noopener noreferrer">{game.url} ↗</a></p>
        <label>{t('platform.creatorReview.embedCheckResult')}<select value={status} onChange={event => setStatus(event.target.value as typeof status)}><option value="unknown">{t('platform.creatorReview.notChecked')}</option><option value="allowed">{t('platform.creatorReview.embeddingAllowed')}</option><option value="blocked">{t('platform.creatorReview.embeddingBlocked')}</option></select></label>
        <label>{t('platform.creatorReview.checkNotes')}<textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} /></label>
        {error && <p role="alert">{error}</p>}<div className="review-actions"><button type="submit" disabled={busy}>{t('platform.creatorReview.saveCheckResult')}</button></div>
    </form>;
}

export default function CreatorReview() {
    const { t } = useTranslation('lobby');
    const { token } = useAuth();
    const client = useQueryClient();
    const [tab, setTab] = useState<'submissions' | 'claims' | 'games'>('submissions');
    const queue = useQuery({ queryKey: ['creator-review'], queryFn: () => getCreatorReviewQueue(token!), enabled: Boolean(token) });
    const refresh = () => { void client.invalidateQueries({ queryKey: ['creator-review'] }); void client.invalidateQueries({ queryKey: ['external-games'] }); };
    return <div className="creator-review-page"><Link to="/admin" className="creator-review-back">← {t('platform.creatorReview.backToAdmin')}</Link><header><h1>{t('platform.creatorReview.title')}</h1><p>{t('platform.creatorReview.pageDescription')}</p><button type="button" disabled={queue.isFetching} onClick={() => void queue.refetch()}>{t('platform.creatorReview.refreshQueue')}</button></header>
        <nav className="review-tabs" aria-label={t('platform.creatorReview.reviewTypes')}>{([['submissions', t('platform.creatorReview.submissions')], ['claims', t('platform.creatorReview.claims')], ['games', t('platform.creatorReview.games')]] as const).map(([id, label]) => <button key={id} type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => { setTab(id); void queue.refetch(); }}>{label}</button>)}</nav>
        {queue.isPending && <p role="status">{t('platform.creatorReview.loadingQueue')}</p>}
        {queue.isFetching && !queue.isPending && <p role="status">{t('platform.creatorReview.refreshingQueue')}</p>}
        {queue.isError && <p role="alert">{t('platform.creatorReview.queueLoadFailed')} <button onClick={() => void queue.refetch()}>{t('platform.retry')}</button></p>}
        {queue.data && !queue.isFetching && !queue.isError && <div className="review-list">
            {tab === 'submissions' && (queue.data.submissions.length ? queue.data.submissions.map(record => <SubmissionReview key={record.submissionId} token={token!} record={record} refresh={refresh} />) : <p className="review-empty">{t('platform.creatorReview.emptySubmissions')}</p>)}
            {tab === 'claims' && (queue.data.claims.length ? queue.data.claims.map(claim => <ClaimReview key={claim.claimId} token={token!} claim={claim} game={queue.data.games.find(game => game.gameId === claim.gameId)} refresh={refresh} />) : <p className="review-empty">{t('platform.creatorReview.emptyClaims')}</p>)}
            {tab === 'games' && (queue.data.games.length ? queue.data.games.map(game => <EmbedReview key={`${game.gameId}-${game.updatedAt}`} token={token!} game={game} refresh={refresh} />) : <p className="review-empty">{t('platform.creatorReview.emptyGames')}</p>)}
        </div>}
    </div>;
}
