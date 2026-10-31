import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { UI_Z_INDEX } from '../../core';
import { ModalBase } from '../common/overlays/ModalBase';
import { useAuth } from '../../contexts/AuthContext';
import { CreatorClaimPanel } from './CreatorCenter';
import './platform-upload.css';
import './creator-center.css';

interface GameAuthorInfoProps {
    authorName: string;
    actions?: ReactNode | ((close: () => void) => ReactNode);
}

const actionClassName = 'platform-author-action';

/** 详情作者入口：与原生游戏同一套点击作者 → 作者信息弹层。 */
export function GameAuthorInfo({ authorName, actions }: GameAuthorInfoProps) {
    const { t } = useTranslation('lobby');
    const [open, setOpen] = useState(false);
    const close = () => setOpen(false);
    const actionNodes = typeof actions === 'function' ? actions(close) : actions;
    return <>
        <button type="button" data-testid="game-details-author-button-mobile" onClick={() => setOpen(true)}
            aria-label={t('authorInfo.buttonHint')} title={t('authorInfo.buttonHint')}>
            {authorName}
        </button>
        {open && createPortal(
            <ModalBase onClose={close} closeOnBackdrop containerClassName="p-4 sm:p-8">
                <div data-platform-dialog="author" data-testid="game-details-author-modal"
                    className="pointer-events-auto w-[min(92vw,24rem)] rounded-[8px] border border-parchment-card-border/30 bg-parchment-card-bg p-5 text-parchment-base-text shadow-parchment-card-hover">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-parchment-light-text">
                                <Info size={14} />
                                <span>{t('authorInfo.title')}</span>
                            </div>
                            <h3 className="mt-3 text-xl font-bold leading-tight">{authorName}</h3>
                        </div>
                        <button type="button" onClick={close}
                            className="platform-dialog-close rounded-full p-1.5 text-parchment-light-text transition-colors hover:bg-parchment-base-bg hover:text-parchment-base-text cursor-pointer"
                            title={t('authorInfo.close')}>
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <p className="platform-author-placeholder mt-3 text-sm leading-6 text-parchment-light-text">{t('authorInfo.hint')}</p>
                    {actionNodes ? <div className="platform-author-actions mt-4 grid gap-2">{actionNodes}</div> : null}
                </div>
            </ModalBase>,
            document.body,
        )}
    </>;
}

interface ExternalGameAuthorProps {
    author: string;
    authorProfileUrl?: string;
    gameId: string;
    gameName: string;
    isOwner: boolean;
    onManageWorks: () => void;
}

/** 外站作者：复用原生作者弹层，只在弹层里补主页和认领。 */
export function ExternalGameAuthor({ author, authorProfileUrl, gameId, gameName, isOwner, onManageWorks }: ExternalGameAuthorProps) {
    const { t } = useTranslation('lobby');
    const { user, token } = useAuth();
    const [claimOpen, setClaimOpen] = useState(false);
    const label = author || '未填写';
    const overlay = claimOpen
        ? (user && token
            ? <CreatorClaimPanel token={token} userId={user.id} gameId={gameId} gameName={gameName} profileUrl={authorProfileUrl} onClose={() => setClaimOpen(false)} />
            : <section className="creator-claim-overlay" data-testid="creator-claim-panel" style={{ zIndex: UI_Z_INDEX.modalContent }}>
                <div className="creator-claim-sheet">
                    <button type="button" className="platform-upload-back" onClick={() => setClaimOpen(false)}>← {t('platform.creatorCenter.claim.backToGame')}</button>
                    <section className="platform-upload-login">
                        <h2>{t('platform.creatorCenter.claim.title')}</h2>
                        <p>{t('platform.creatorCenter.claim.loginPrompt')}</p>
                    </section>
                </div>
            </section>)
        : null;
    return <>
        <GameAuthorInfo authorName={label} actions={close => <>
            {authorProfileUrl && <a className="platform-author-profile-link" href={authorProfileUrl} target="_blank" rel="noopener noreferrer">{authorProfileUrl}</a>}
            {isOwner
                ? <button type="button" className={actionClassName} onClick={() => { close(); onManageWorks(); }}>{t('authorInfo.manageWorks')}</button>
                : <button type="button" className={`${actionClassName} platform-author-action--claim`} onClick={() => { close(); setClaimOpen(true); }}>{t('authorInfo.claim')}</button>}
        </>} />
        {overlay && createPortal(overlay, document.body)}
    </>;
}
