import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { ModalBase } from '../../../components/common/overlays/ModalBase';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import type { FateDominationCore } from '../domain/types';
import { projectFatePlayer } from './playerPresentation';
import {projectFateSkillCards} from '../domain/playerView';
import {resolveFatePlayerAbility} from '../domain/abilityRegistry';
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
    canActivateAbility?: (sourceId: string) => boolean;
    onActivateAbility?: (sourceId: string) => void;
}
export function FatePlayerDetail({ core, playerId, viewerId, servantBack, skillBack, onPlayer, onClose, onInspect, canActivateAbility, onActivateAbility }: Props) {
    const ref = useRef<HTMLButtonElement>(null);
    const view = projectFatePlayer(core, playerId, viewerId);
    const sealPreview = fateCommandSealPreview(view.player.masterId);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        ref.current?.focus();
        return () => { previous?.focus(); };
    }, []);
    const visibleSkills = projectFateSkillCards(view.player,viewerId).map((card,index)=>({name:card?.name??`暗置技能 ${index+1}`,assetPath:card?.assetPath??skillBack}));
    return <ModalBase onClose={onClose} overlayClassName="!bg-black/75" containerClassName="p-0">
        <section data-tutorial-id="fate-detail" className="fd-player-detail" role="dialog" aria-modal="true" aria-label={`${view.master?.name ?? '玩家'}详情`} onKeyDown={event => { if (event.key === 'Escape') {
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
                <nav aria-label="切换玩家">{core.playerIds.map(id => {
                    const other = projectFatePlayer(core, id, viewerId);
                    return <button key={id} type="button" aria-label={`切换到玩家${Number(id) + 1} ${other.master?.name ?? ''}`} aria-current={id === playerId ? 'page' : undefined} onClick={() => onPlayer(id)}>
                        <OptimizedImage src={fateTokenAsset(other.player.masterId)} alt=""/>
                        <span><small>玩家 {Number(id) + 1}</small>{other.master?.name ?? '御主'}</span>
                    </button>;
                })}</nav>
                <button ref={ref} className="fd-player-detail-close" type="button" aria-label="关闭玩家详情" onClick={onClose}><X size={22}/></button>
            </header>
            <div className="fd-player-detail-stats"><span>魔力 <b>{view.player.mana}</b></span><span>令咒 <b>{view.player.commandSpells}</b></span><span>战果 <b>{view.player.victoryPoints}</b></span><span className={view.player.eliminated ? 'fd-eliminated-status' : undefined}>{view.location}</span>{!view.servantVisible && view.servantClass && <span aria-label="已知职阶">职阶 <b>{view.servantClass}</b></span>}</div>
            <div className="fd-player-detail-content">
                <div className="fd-player-detail-identity">
                    <button type="button" className="fd-detail-art" aria-label="检视御主能力" onClick={() => view.master && onInspect(view.master.assetPath, view.master.name)}>
                        {view.master && <OptimizedImage src={view.master.assetPath} alt={view.master.name}/>}
                    </button>
                    <button type="button" className="fd-detail-art" aria-label={view.servantVisible ? '检视从者' : '从者尚未解放'} onClick={() => view.servant && onInspect(view.servant.assetPath, view.servant.name)}>
                        <OptimizedImage src={view.servant?.assetPath ?? servantBack} alt={view.servant?.name ?? '未解放从者牌背'}/>
                    </button>
                    <div className="fd-player-detail-ability">
                        <div className="fd-detail-seals" aria-label={`剩余令咒${view.player.commandSpells}`}>
                            {Array.from({ length: view.player.commandSpells }, (_, index) => <CardPreview key={index} previewRef={sealPreview} alt="令咒" className="fd-detail-seal-card" style={{ position: 'absolute', left: index * 28, top: (view.player.commandSpells - 1 - index) * 4, zIndex: view.player.commandSpells - index }}/>)}
                        </div>
                <section className="fd-detail-ability-copy" aria-label="御主能力说明">
                    {view.master?.skills?.map(ability => {
                        const source = view.player.skills.find(skill => skill.isMasterSkill && skill.id.split(':')[0] === ability.id);
                        const actionable = view.own && onActivateAbility && source && resolveFatePlayerAbility(core, playerId, source.id);
                        return <p key={ability.id}><strong>{ability.name}</strong> {ability.desc}
                            {actionable && <button type="button" className="fd-detail-ability-action" aria-label={`发动${ability.name}`} disabled={!canActivateAbility?.(source.id)} onClick={() => onActivateAbility(source.id)}>发动</button>}
                        </p>;
                    })}
                </section>
                    </div>
                </div>
                <section className="fd-player-detail-skills" aria-label="从者技能">
                    {visibleSkills.map((card, index) => <button key={`${card.name}-${index}`} type="button" className="fd-detail-art" aria-label={`检视${card.name}`} disabled={card.assetPath === skillBack} onClick={() => onInspect(card.assetPath, card.name)}>
                        <OptimizedImage src={card.assetPath} alt={card.name}/>
                    </button>)}
                </section>
            </div>
        </section>
        </section>
    </ModalBase>;
}
