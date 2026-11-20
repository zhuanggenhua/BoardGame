import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { fateTokenAsset } from '../data/identityArtwork';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { fateCardPreview } from '../data/cardArtwork';
import './identityArtwork';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { FATE_ATTACK_BY_ID } from '../data';
import type { FateDominationCore } from '../domain';
import { resolveLocationKind } from '../domain/movement';
import { projectFateOpponentCards, projectFatePlayer } from './playerPresentation';
import {useTranslation} from 'react-i18next';
interface Props {
    core: FateDominationCore;
    viewerId: string | null;
    selectedId: string | null;
    nameFor: (id: string) => string;
    onSelect: (id: string | null) => void;
    onDetail: (id: string) => void;
    onInspect: (asset: string, name: string) => void;
    investigationTargets?: readonly string[];
    onInvestigateTarget?: (id:string)=>void;
}
/** Persistent identity anchors; public cards expand beside them without displacing other seats. */
export function FatePlayerRail({ core, viewerId, selectedId, nameFor, onSelect, onDetail, onInspect, investigationTargets, onInvestigateTarget }: Props) {
    const { t } = useTranslation('game-fate-domination');
    const seats = useRef(new Map<string, HTMLElement>());
    const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const activeSeat = useRef(selectedId);
    activeSeat.current = selectedId;
    const [position, setPosition] = useState({ top: 88, right: 274, maxWidth: 640 });
    const cards = selectedId ? projectFateOpponentCards(core.players[selectedId], viewerId) : null;
    const hasForcedReveal = Boolean(cards?.revealedHand.length);
    const keepOpen = () => { clearTimeout(hideTimer.current); };
    const hideLater = (id:string) => {
        if (activeSeat.current !== id) return;
        keepOpen();
        hideTimer.current = setTimeout(() => {if (activeSeat.current === id) onSelect(null);}, 2500);
    };
    const show = (id: string) => { keepOpen(); activeSeat.current = id; onSelect(id); };
    // 换席由 show 取消旧计时；只在卸载时清理，避免旧选中态的延后 cleanup 清掉新计时。
    useEffect(() => () => clearTimeout(hideTimer.current), []);
    useLayoutEffect(() => {
        if (!selectedId) return;
        const place = () => {
            const rect = seats.current.get(selectedId)?.getBoundingClientRect();
            if (!rect) return;
            setPosition({ top: Math.max(12, Math.min(rect.top, window.innerHeight - (hasForcedReveal ? 382 : 192))), right: window.innerWidth - rect.left + 12, maxWidth: Math.max(120, rect.left - 28) });
        };
        place();
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
    }, [selectedId, hasForcedReveal]);
    const played = cards?.attacks ?? [];
    const playedSkills = cards?.skills ?? [];
    const revealedHand = cards?.revealedHand ?? [];
    const publicCount = played.length + playedSkills.length;
    const visibleCount = Math.max(publicCount, revealedHand.length);
    return <aside data-tutorial-id="fate-opponents" className="fd-runtime-player-rail" aria-label={t('ui.playerRail.playerSeats')}>
        <div className="fd-runtime-seat-list">{core.playerIds.filter(id => id !== viewerId).map(id => {
            const view = projectFatePlayer(core, id, viewerId);
            const inBattlefield = view.player.locationId !== null && resolveLocationKind(view.player.locationId) === 'battlefield';
            const targetable=investigationTargets?.includes(id)===true;
            const chooseTarget = () => onInvestigateTarget?.(id);
            const expanded = selectedId === id && cards !== null;
            return <section key={id} data-tutorial-id={`fate-player-${id}`} ref={node => { if (node) seats.current.set(id, node); else seats.current.delete(id); }} onPointerLeave={() => hideLater(id)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) hideLater(id); }} className={`fd-runtime-seat${expanded ? ' is-selected' : ''}${core.currentPlayerId === id ? ' is-current' : ''}`}>
                <div className="fd-runtime-seat-row">
                    <button type="button" className={`fd-runtime-avatar${targetable?' is-investigation-target':''}`} aria-disabled={investigationTargets ? !targetable : undefined} aria-description={view.player.eliminated ? t('ui.playerRail.eliminated') : undefined} aria-label={targetable?t('ui.investigationChoice.target',{name:nameFor(id)}):t('ui.playerRail.viewPlayerDetails', { name: nameFor(id) })} onPointerEnter={() => {if(!investigationTargets)show(id);}} onPointerLeave={() => hideLater(id)} onFocus={() => {if(!investigationTargets)show(id);}} onClick={investigationTargets ? chooseTarget : () => onDetail(id)}>
                        {view.master && <OptimizedImage className="fd-runtime-master-avatar" src={fateTokenAsset(view.master.id)} alt={view.master.name}/>}
                        <OptimizedImage className="fd-runtime-servant-avatar" src={view.servant?.assetPath ?? 'fate-domination/backs/servant'} alt={view.servant?.name ?? t('ui.playerRail.unrevealedServant')}/>
                        {view.player.eliminated && <span className="fd-avatar-elimination" aria-hidden="true"/>}
                    </button>
                    <button type="button" className="fd-runtime-seat-summary" aria-disabled={investigationTargets ? !targetable : undefined} aria-expanded={expanded} onClick={investigationTargets ? chooseTarget : () => show(id)}>
                        <b title={nameFor(id)}><span className="fd-seat-name">{nameFor(id)}</span>
                            {!view.player.eliminated && view.defeated && <strong className="fd-seat-power is-defeated">{t('ui.map.defeated')}</strong>}
                            {!view.player.eliminated && !view.defeated && inBattlefield &&
                                <strong className="fd-seat-power" aria-label={t('ui.playerRail.totalPower', { name: nameFor(id) })}><small>{t('ui.playerRail.power')}</small>{view.power}</strong>}
                            {!view.player.eliminated && core.currentPlayerId === id && <i>{t('ui.playerRail.acting')}</i>}
                        </b>
                        <span>{t('ui.playerRail.playerStats', { victoryPoints: view.player.victoryPoints, mana: view.player.mana, hand: view.handCount })}</span>
                    </button>
                </div>
            </section>;
        })}</div>
        {cards && selectedId && <section className="fd-runtime-opponent-cards" style={{...position,width:Math.min(position.maxWidth, visibleCount * 120),maxHeight:hasForcedReveal?'calc(100dvh - 24px)':undefined}} aria-label={t('ui.playerRail.playedCards', { name: nameFor(selectedId) })} onPointerEnter={keepOpen} onPointerLeave={() => hideLater(selectedId)} onFocus={event => { if(event.target.matches(':focus-visible'))keepOpen(); }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) hideLater(selectedId); }} onKeyDown={event => { if (event.key === 'Escape') onSelect(null); }}>
            {publicCount > 0 && <div className="fd-runtime-public-cards" style={{'--fd-public-count':publicCount} as CSSProperties}>{played.map(card => {
                const definition = FATE_ATTACK_BY_ID[card.definitionId];
                if(card.definitionId==='hidden')return <div key={card.id} className="fd-hidden-played-card"><OptimizedImage src="fate-domination/backs/attack" alt={t('ui.playerRail.faceDownAttack')}/></div>;
                return definition && <button key={card.id} type="button" aria-label={t('ui.playerRail.inspectCard', { name: definition.name })} onClick={() => onInspect(definition.assetPath, definition.name)}><CardPreview previewRef={fateCardPreview(definition.assetPath)} title={definition.name} style={{width: '100%'}}/></button>;
            })}{playedSkills.map(card=><button key={card.id} type="button" aria-label={t('ui.playerRail.inspectCard', { name: card.name })} onClick={()=>onInspect(card.assetPath,card.name)}><OptimizedImage src={card.assetPath} alt={card.name}/></button>)}</div>}
            {hasForcedReveal && <section aria-label={t('ui.playerRail.forcedRevealSection')}><p>{t('ui.playerRail.forcedRevealText')}</p><div className="fd-runtime-public-cards" style={{'--fd-public-count':revealedHand.length} as CSSProperties}>{revealedHand.map(card=>{const definition=FATE_ATTACK_BY_ID[card.definitionId];return definition && <button key={card.id} type="button" aria-label={t('ui.playerRail.inspectCard', { name: definition.name })} onClick={()=>onInspect(definition.assetPath,definition.name)}><CardPreview previewRef={fateCardPreview(definition.assetPath)} title={definition.name}/></button>;})}</div></section>}
        </section>}
    </aside>;
}
