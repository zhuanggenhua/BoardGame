import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { ModalBase } from '../../../components/common/overlays/ModalBase';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import type { FateDominationCore } from '../domain/types';
import { projectFatePlayer } from './playerPresentation';
import {projectFatePlayerView, projectFateSkillCards} from '../domain/playerView';
import './player-detail.css';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { fateCommandSealPreview, fateTokenAsset } from './identityArtwork';
interface Props {
    core: FateDominationCore;
    playerId: string;
    viewerId: string | null;
    servantBack: string;
    skillBack: string;
    onPlayer: (id: string) => void;
    onClose: () => void;
    onInspect: (assetPath: string, name: string) => void;
}
export function FatePlayerDetail({ core, playerId, viewerId, servantBack, skillBack, onPlayer, onClose, onInspect }: Props) {
    const { t } = useTranslation('game-fate-domination');
    const ref = useRef<HTMLButtonElement>(null);
    const visibleCore = projectFatePlayerView(core, viewerId);
    const view = projectFatePlayer(visibleCore, playerId, viewerId);
    const sealPreview = fateCommandSealPreview(view.player.masterId);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        ref.current?.focus();
        return () => { previous?.focus(); };
    }, []);
    const visibleSkills = projectFateSkillCards(view.player,viewerId).map((card,index)=>({name:card?.name??t('ui.playerDetail.hiddenSkill', { number: index + 1 }),assetPath:card?.assetPath??skillBack}));
    const playerName = view.master?.name ?? t('ui.playerDetail.playerFallback');
    return <ModalBase onClose={onClose} overlayClassName="!bg-black/75" containerClassName="p-0">
        <section data-tutorial-id="fate-detail" className="fd-player-detail" role="dialog" aria-modal="true" aria-label={t('ui.playerDetail.dialogLabel', { name: playerName })} onKeyDown={event => { if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
    } else if (event.key === 'Tab') {
        const controls = event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    } }}>
        <section className="fd-player-detail-frame">
            <header className="fd-player-detail-header">
                <nav aria-label={t('ui.playerDetail.switchPlayerNav')}>{visibleCore.playerIds.map(id => {
                    const other = projectFatePlayer(visibleCore, id, viewerId);
                    return <button key={id} type="button" aria-label={t('ui.playerDetail.switchPlayer', { number: Number(id) + 1, name: other.master?.name ?? '' })} aria-current={id === playerId ? 'page' : undefined} onClick={() => onPlayer(id)}>
                        <OptimizedImage src={fateTokenAsset(other.player.masterId)} alt=""/>
                        <span><small>{t('ui.playerDetail.player', { number: Number(id) + 1 })}</small>{other.master?.name ?? t('ui.playerDetail.master')}</span>
                    </button>;
                })}</nav>
                <button ref={ref} className="fd-player-detail-close" type="button" aria-label={t('ui.playerDetail.close')} onClick={onClose}><X size={22}/></button>
            </header>
            <div className="fd-player-detail-stats"><span>{t('ui.playerDetail.mana')} <b>{view.player.mana}</b></span><span>{t('ui.playerDetail.commandSeals')} <b>{view.player.commandSpells}</b></span><span>{t('ui.playerDetail.victoryPoints')} <b>{view.player.victoryPoints}</b></span><span className={view.player.eliminated ? 'fd-eliminated-status' : undefined}>{view.location}</span>{!view.servantVisible && view.servantClass && <span aria-label={t('ui.playerDetail.knownClass')}>{t('ui.playerDetail.class')} <b>{view.servantClass}</b></span>}</div>
            <div className="fd-player-detail-content">
                <div className="fd-player-detail-identity">
                    <button type="button" className="fd-detail-art" aria-label={t('ui.playerDetail.inspectMaster')} onClick={() => view.master && onInspect(view.master.assetPath, view.master.name)}>
                        {view.master && <OptimizedImage src={view.master.assetPath} alt={view.master.name}/>}
                    </button>
                    <button type="button" className="fd-detail-art" aria-label={view.servantVisible ? t('ui.playerDetail.inspectServant') : t('ui.playerDetail.servantNotRevealed')} onClick={() => view.servant && onInspect(view.servant.assetPath, view.servant.name)}>
                        <OptimizedImage src={view.servant?.assetPath ?? servantBack} alt={view.servant?.name ?? t('ui.playerDetail.unrevealedServantBack')}/>
                    </button>
                    <div className="fd-player-detail-ability">
                        <div className="fd-detail-seals" aria-label={t('ui.playerDetail.remainingSeals', { count: view.player.commandSpells })}>
                            {Array.from({ length: view.player.commandSpells }, (_, index) => <CardPreview key={index} previewRef={sealPreview} alt={t('ui.playerDetail.commandSealAlt')} className="fd-detail-seal-card" style={{ position: 'absolute', left: index * 28, top: (view.player.commandSpells - 1 - index) * 4, zIndex: view.player.commandSpells - index }}/>)}
                        </div>
                <section className="fd-detail-ability-copy" aria-label={t('ui.playerDetail.masterAbilityDescription')}>
                    {view.master?.skills?.map(ability => <p key={ability.id}><strong>{ability.name}</strong> {ability.desc}</p>)}
                </section>
                    </div>
                </div>
                <section className="fd-player-detail-skills" aria-label={t('ui.playerDetail.servantSkills')}>
                    {visibleSkills.map((card, index) => <button key={`${card.name}-${index}`} type="button" className="fd-detail-art" aria-label={t('ui.playerDetail.inspectCard', { name: card.name })} disabled={card.assetPath === skillBack} onClick={() => onInspect(card.assetPath, card.name)}>
                        <OptimizedImage src={card.assetPath} alt={card.name}/>
                    </button>)}
                </section>
            </div>
        </section>
        </section>
    </ModalBase>;
}
