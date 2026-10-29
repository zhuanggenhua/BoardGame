import { Archive, Layers } from 'lucide-react';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { CardPreview } from '../../../components/common/media/CardPreview';
import type { FateDominationCore } from '../domain';
import { projectFatePlayer } from './playerPresentation';
import { fateCommandSealPreview, fateTokenAsset } from './identityArtwork';
import {resolveFatePlayerAbility} from '../domain/abilityRegistry';
import {FateMasterAbilities} from './FateMasterAbilities';
interface Props {
    core: FateDominationCore;
    playerId: string;
    name: string;
    sealEnabled: boolean;
    pileInfo?: string;
    onDetail: () => void;
    onSeal: () => void;
    onPile: (pile: 'deck' | 'discard') => void;
    canActivateAbility: (id: string) => boolean;
    onActivateAbility: (id: string) => void;
    onAbilityTipChange: (open: boolean) => void;
}
/** Identity and physical objects remain the action owners in the lower-left play area. */
export function FateSelfDock({core, playerId, name, sealEnabled, pileInfo, onDetail, onSeal, onPile,canActivateAbility,onActivateAbility,onAbilityTipChange}: Props) {
    const view = projectFatePlayer(core, playerId, playerId);
    return <aside data-tutorial-id="fate-self" className="fd-self-dock" aria-label="本人席位">
        <div className="fd-self-objects">
            <div className="fd-self-piles">
                <button type="button" aria-label={`抽牌堆 ${view.deckCount} 张`} onClick={() => onPile('deck')}><Layers className="board-shell-fixed-icon" size={22}/><b>{view.deckCount}</b></button>
                <button type="button" aria-label={`弃牌堆 ${view.discardCount} 张`} onClick={() => onPile('discard')}><Archive className="board-shell-fixed-icon" size={22}/><b>{view.discardCount}</b></button>
                {pileInfo && <div className="fd-self-pile-info" role="status">{pileInfo}</div>}
            </div>
            <button type="button" className="fd-self-seals" aria-label="使用令咒" disabled={!sealEnabled} onClick={onSeal}>
                {Array.from({length: view.player.commandSpells}, (_, index) => <CardPreview key={index} previewRef={fateCommandSealPreview(view.player.masterId)} alt="令咒" style={{position:'absolute',top:(view.player.commandSpells - 1 - index) * 5,left:index * 18,width:78,zIndex:view.player.commandSpells-index}}/>)}
            </button>
        </div>
        <div className="fd-self-character"><button type="button" className="fd-self-identity" aria-description={view.player.eliminated ? '已淘汰，观战中' : undefined} aria-label={`查看${name}详情`} onClick={onDetail}>
            <span className="fd-runtime-avatar"><OptimizedImage className="fd-runtime-master-avatar" src={fateTokenAsset(view.player.masterId)} alt={view.master?.name ?? ''}/><OptimizedImage className="fd-runtime-servant-avatar" src={view.servant?.assetPath ?? 'fate-domination/backs/servant'} alt={view.servant?.name ?? ''}/>{view.player.eliminated && <span className="fd-avatar-elimination" aria-hidden="true"/>}</span>
            <span className="fd-self-copy"><strong>{name}</strong><small>{view.master?.name} · {view.servant?.name ?? '从者'}</small><span className="fd-self-stats"><span>魔力 <b>{view.player.mana}</b></span><span>战果 <b>{view.player.victoryPoints}</b></span></span></span>
        </button><FateMasterAbilities abilities={(view.master?.skills??[]).map(ability=>{
            const source=view.player.skills.find(skill=>skill.isMasterSkill&&skill.id.split(':')[0]===ability.id);
            return {id:source?.id??ability.id,name:ability.name,description:ability.desc,actionable:Boolean(source&&resolveFatePlayerAbility(core,playerId,source.id)),enabled:Boolean(source&&canActivateAbility(source.id))};
        })} onActivate={onActivateAbility} onReadingChange={onAbilityTipChange}/></div>
    </aside>;
}
