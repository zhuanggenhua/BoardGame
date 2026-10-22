import { useId, type ReactNode, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import './platform-details.css';

interface PlatformGameDetailsProps<T extends string> {
    presentation?: 'modal' | 'inline';
    rootRef?: Ref<HTMLDivElement>;
    title: string;
    description: string;
    thumbnail: ReactNode;
    playerOptions: readonly number[];
    bestPlayers: readonly number[];
    installedVersion?: string;
    primaryActions: ReactNode;
    secondaryActions: ReactNode;
    author: ReactNode;
    overlayControls?: ReactNode;
    tabs: readonly { id: T; label: string; mobileLabel?: string }[];
    selectedTab: T;
    onTab: (id: T) => void;
    onClose: () => void;
    children: ReactNode;
}

/** Presentation only: room, authentication and package decisions retain their existing owners. */
export function PlatformGameDetails<T extends string>({ presentation = 'modal', rootRef, title, description, thumbnail, playerOptions, bestPlayers, installedVersion,
    primaryActions, secondaryActions, author, overlayControls, tabs, selectedTab, onTab, onClose, children }: PlatformGameDetailsProps<T>) {
    const { t } = useTranslation(['lobby', 'common']);
    const contentId = useId();
    const counts = [...new Set(playerOptions)].sort((a, b) => a - b);
    const countLabel = counts.length > 1 && counts.every((value, index) => value === counts[0] + index)
        ? `${counts[0]}–${counts[counts.length - 1]}` : counts.join(' / ');
    return <div ref={rootRef} data-testid="game-details-modal-root" data-active-tab={selectedTab}
        className={`platform-game-details${presentation === 'inline' ? ' platform-game-details--inline' : ''}`}
        role={presentation === 'inline' ? 'region' : 'dialog'} aria-modal={presentation === 'inline' ? undefined : true} aria-labelledby={`${contentId}-title`}>
        <button type="button" className="platform-details-close" data-testid="game-details-close-button"
            aria-label={t('common:close')} onClick={onClose}><X aria-hidden="true" size={22} /></button>
        <header data-testid="game-details-sidebar" className="platform-details-summary">
            <div className="platform-details-cover">{thumbnail}</div>
            <h2 id={`${contentId}-title`} className="platform-details-title" data-testid="game-details-title" data-installed-version={installedVersion}>{title}
                    {installedVersion && <small>{installedVersion}</small>}</h2>
                <div data-testid="game-details-player-recommendation" className="platform-details-players">
                    {playerOptions.map(count => <span key={count} className={bestPlayers.includes(count) ? 'is-best' : undefined}
                        title={bestPlayers.includes(count) ? t('common:game_details.best_recommendation') : undefined}>{count}</span>)}
                    {bestPlayers.length > 0 && <small>{t('common:game_details.recommended_players')} {bestPlayers.join(' / ')}</small>}
                </div>
            {counts.length > 0 && <p className="platform-details-mobile-players">{t('common:game_details.player_count')} {countLabel}
                {bestPlayers.length > 0 && <strong>{t('common:game_details.recommended_players')} {bestPlayers.join(' / ')}</strong>}
            </p>}
            <p id={`${contentId}-description`} data-testid="game-details-description" className="platform-details-description">{description}</p>
            <div className="platform-details-actions"><div className="platform-details-primary">{primaryActions}</div>
            <div id={`${contentId}-secondary`} className="platform-details-secondary">{secondaryActions}</div>
            <div id={`${contentId}-author`} className="platform-details-author">{author}</div></div>
        </header>
        <div className="platform-details-main">
            <nav data-testid="game-details-tab-row" className="platform-details-tabs">
                {tabs.map(tab => <button key={tab.id} type="button" data-testid={`game-details-tab-${tab.id}`}
                    aria-current={selectedTab === tab.id ? 'page' : undefined} onClick={() => onTab(tab.id)}>
                    <span className="platform-details-tab-desktop">{tab.label}</span>
                    <span className="platform-details-tab-mobile">{tab.mobileLabel ?? tab.label}</span>
                </button>)}
            </nav>
            <div className="platform-details-content">{children}</div>
        </div>
        {overlayControls}
    </div>;
}
