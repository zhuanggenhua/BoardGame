import { projectFatePlayedCards } from '../domain/playerView';
import { X } from 'lucide-react';
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
    const selected = selectedId && selectedId !== viewerId && core.players[selectedId] ? projectFatePlayer(core, selectedId, viewerId) : null;
    const played = selected ? selected.player.publicView?.playedCards ?? projectFatePlayedCards(selected.player,viewerId) : [];
    const playedSkills=selected ? selected.player.publicView?.playedSkills ?? servantSkillsFor(selected.player)
        .filter(({skill})=>selected.player.activeSkills.includes(skill.id))
        .map(({skill,index})=>({id:skill.id,name:skill.name,assetPath:FATE_SERVANT_BY_ID[selected.player.servantId].skillAssetPaths[index]})) : [];
    return <aside className="fd-runtime-player-rail" aria-label="玩家席位">
        <div className="fd-runtime-seat-list">{core.playerIds.filter(id => id !== viewerId).map(id => {
            const view = projectFatePlayer(core, id, viewerId);
            return <section key={id} onPointerEnter={() => onSelect(id)} onFocus={() => onSelect(id)} className={`fd-runtime-seat${selectedId === id ? ' is-selected' : ''}${core.currentPlayerId === id ? ' is-current' : ''}`}>
                <div className="fd-runtime-seat-row">
                    <button type="button" className="fd-runtime-avatar" aria-label={`查看${nameFor(id)}详情`} onClick={() => onDetail(id)}>
                        {view.master && <OptimizedImage className="fd-runtime-master-avatar" src={fateTokenAsset(view.master.id)} alt={view.master.name}/>}
                        <OptimizedImage className="fd-runtime-servant-avatar" src={view.servant?.assetPath ?? 'fate-domination/backs/servant'} alt={view.servant?.name ?? '未揭示从者'}/>
                    </button>
                    <button type="button" className="fd-runtime-seat-summary" aria-expanded={selectedId === id} onClick={() => onSelect(id)}>
                        <b title={nameFor(id)}><span className="fd-seat-name">{nameFor(id)}</span>{core.currentPlayerId === id && <i>行动中</i>}</b>
                        <span>战果 {view.player.victoryPoints} · 魔力 {view.player.mana} · 手牌 {view.handCount}</span>
                    </button>
                </div>
            </section>;
        })}</div>
        {selected && selectedId && <section className="fd-runtime-opponent-drawer" aria-label={`${nameFor(selectedId)}已打出`}>
            <header><strong>合计威力 <b>{selected.power}</b></strong>
                <button type="button" aria-label="收起已打出卡牌" onClick={() => onSelect(null)}><X size={18}/></button></header>
            <div className="fd-runtime-public-cards">{played.map(card => {
                const definition = FATE_ATTACK_BY_ID[card.definitionId];
                if(card.definitionId==='hidden')return <div key={card.id} className="fd-hidden-played-card"><OptimizedImage src="fate-domination/backs/attack" alt="暗置攻击牌"/></div>;
                return definition && <button key={card.id} type="button" aria-label={`检视${definition.name}`} onClick={() => onInspect(definition.assetPath, definition.name)}><CardPreview previewRef={fateCardPreview(definition.assetPath)} title={definition.name} style={{width: '100%'}}/></button>;
            })}{playedSkills.map(card=><button key={card.id} type="button" aria-label={`检视${card.name}`} onClick={()=>onInspect(card.assetPath,card.name)}><OptimizedImage src={card.assetPath} alt={card.name}/></button>)}{!played.length && !playedSkills.length && <p>尚未打出攻击牌</p>}</div>
            {Boolean(selected.player.forcedRevealedHand?.length) && <section aria-label="无法明置而展示的手牌"><p>无法明置，展示手牌</p><div className="fd-runtime-public-cards">{selected.player.forcedRevealedHand.map(card=>{const definition=FATE_ATTACK_BY_ID[card.definitionId];return definition && <button key={card.id} type="button" aria-label={`检视${definition.name}`} onClick={()=>onInspect(definition.assetPath,definition.name)}><CardPreview previewRef={fateCardPreview(definition.assetPath)} title={definition.name}/></button>;})}</div></section>}
        </section>}
    </aside>;
}
