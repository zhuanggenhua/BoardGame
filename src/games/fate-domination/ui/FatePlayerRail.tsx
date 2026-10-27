import { projectFatePlayedCards } from '../domain/playerView';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fateTokenAsset } from '../data/identityArtwork';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { fateCardPreview } from '../data/cardArtwork';
import './identityArtwork';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { FATE_ATTACK_BY_ID } from '../data';
import type { FateDominationCore } from '../domain';
import { projectFatePlayer, servantSkillsFor } from './playerPresentation';
import {FATE_SERVANT_BY_ID} from '../data';
interface Props {
    core: FateDominationCore;
    viewerId: string | null;
    selectedId: string | null;
    nameFor: (id: string) => string;
    onSelect: (id: string | null) => void;
    onDetail: (id: string) => void;
    onInspect: (asset: string, name: string) => void;
}
/** Persistent identity anchors; public cards expand beside them without displacing other seats. */
export function FatePlayerRail({ core, viewerId, selectedId, nameFor, onSelect, onDetail, onInspect }: Props) {
    const seats = useRef(new Map<string, HTMLElement>());
    const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const [position, setPosition] = useState({ top: 88, right: 274, maxWidth: 640 });
    const keepOpen = () => { clearTimeout(hideTimer.current); };
    const hideLater = () => {
        keepOpen();
        hideTimer.current = setTimeout(() => onSelect(null), 2500);
    };
    const show = (id: string) => { keepOpen(); onSelect(id); };
    useEffect(() => () => clearTimeout(hideTimer.current), [selectedId]);
    useLayoutEffect(() => {
        if (!selectedId) return;
        const place = () => {
            const rect = seats.current.get(selectedId)?.getBoundingClientRect();
            if (!rect) return;
            setPosition({ top: Math.max(12, Math.min(rect.top, window.innerHeight - 192)), right: window.innerWidth - rect.left + 12, maxWidth: Math.max(120, rect.left - 28) });
        };
        place();
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
    }, [selectedId]);
    const selected = selectedId && selectedId !== viewerId && core.players[selectedId] ? projectFatePlayer(core, selectedId, viewerId) : null;
    const played = selected ? selected.player.publicView?.playedCards ?? projectFatePlayedCards(selected.player,viewerId) : [];
    const playedSkills=selected ? selected.player.publicView?.playedSkills ?? servantSkillsFor(selected.player)
        .filter(({skill})=>selected.player.activeSkills.includes(skill.id))
        .map(({skill,index})=>({id:skill.id,name:skill.name,assetPath:FATE_SERVANT_BY_ID[selected.player.servantId].skillAssetPaths[index]})) : [];
    return <aside data-tutorial-id="fate-opponents" className="fd-runtime-player-rail" aria-label="玩家席位">
        <div className="fd-runtime-seat-list">{core.playerIds.filter(id => id !== viewerId).map(id => {
            const view = projectFatePlayer(core, id, viewerId);
            return <section key={id} ref={node => { if (node) seats.current.set(id, node); else seats.current.delete(id); }} onPointerLeave={hideLater} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) hideLater(); }} className={`fd-runtime-seat${selectedId === id ? ' is-selected' : ''}${core.currentPlayerId === id ? ' is-current' : ''}`}>
                <div className="fd-runtime-seat-row">
                    <button type="button" className="fd-runtime-avatar" aria-description={view.player.eliminated ? '已淘汰' : undefined} aria-label={`查看${nameFor(id)}详情`} onPointerEnter={() => show(id)} onPointerLeave={hideLater} onFocus={() => show(id)} onClick={() => onDetail(id)}>
                        {view.master && <OptimizedImage className="fd-runtime-master-avatar" src={fateTokenAsset(view.master.id)} alt={view.master.name}/>}
                        <OptimizedImage className="fd-runtime-servant-avatar" src={view.servant?.assetPath ?? 'fate-domination/backs/servant'} alt={view.servant?.name ?? '未揭示从者'}/>
                        {view.player.eliminated && <span className="fd-avatar-elimination" aria-hidden="true"/>}
                    </button>
                    <button type="button" className="fd-runtime-seat-summary" aria-expanded={selectedId === id} onClick={() => show(id)}>
                        <b title={nameFor(id)}><span className="fd-seat-name">{nameFor(id)}</span><strong className="fd-seat-power" aria-label={`${nameFor(id)}合计威力`}><small>威力</small>{view.power}</strong>{!view.player.eliminated && core.currentPlayerId === id && <i>行动中</i>}</b>
                        <span>战果 {view.player.victoryPoints} · 魔力 {view.player.mana} · 手牌 {view.handCount}</span>
                    </button>
                </div>
            </section>;
        })}</div>
        {selected && selectedId && <section className="fd-runtime-opponent-cards" style={position} aria-label={`${nameFor(selectedId)}已打出`} onPointerEnter={keepOpen} onPointerLeave={hideLater} onFocus={keepOpen} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) hideLater(); }} onKeyDown={event => { if (event.key === 'Escape') onSelect(null); }}>
            <div className="fd-runtime-public-cards">{played.map(card => {
                const definition = FATE_ATTACK_BY_ID[card.definitionId];
                if(card.definitionId==='hidden')return <div key={card.id} className="fd-hidden-played-card"><OptimizedImage src="fate-domination/backs/attack" alt="暗置攻击牌"/></div>;
                return definition && <button key={card.id} type="button" aria-label={`检视${definition.name}`} onClick={() => onInspect(definition.assetPath, definition.name)}><CardPreview previewRef={fateCardPreview(definition.assetPath)} title={definition.name} style={{width: '100%'}}/></button>;
            })}{playedSkills.map(card=><button key={card.id} type="button" aria-label={`检视${card.name}`} onClick={()=>onInspect(card.assetPath,card.name)}><OptimizedImage src={card.assetPath} alt={card.name}/></button>)}{!played.length && !playedSkills.length && <p>尚未打出攻击牌</p>}</div>
            {Boolean(selected.player.forcedRevealedHand?.length) && <section aria-label="无法明置而展示的手牌"><p>无法明置，展示手牌</p><div className="fd-runtime-public-cards">{selected.player.forcedRevealedHand.map(card=>{const definition=FATE_ATTACK_BY_ID[card.definitionId];return definition && <button key={card.id} type="button" aria-label={`检视${definition.name}`} onClick={()=>onInspect(definition.assetPath,definition.name)}><CardPreview previewRef={fateCardPreview(definition.assetPath)} title={definition.name}/></button>;})}</div></section>}
        </section>}
    </aside>;
}
