import { Archive, Layers } from 'lucide-react';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { CardPreview } from '../../../components/common/media/CardPreview';
import type { FateDominationCore } from '../domain';
import { projectFatePlayer } from './playerPresentation';
import { fateCommandSealPreview, fateTokenAsset } from './identityArtwork';
import {resolveFatePlayerAbility} from '../domain/abilityRegistry';
import {FateMasterAbilities} from './FateMasterAbilities';
import {useTranslation} from 'react-i18next';
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
    const { t } = useTranslation('game-fate-domination');
    const view = projectFatePlayer(core, playerId, playerId);
    return <aside data-tutorial-id="fate-self" className="fd-self-dock" aria-label={t('ui.selfDock.playerSeat')}>
        <div className="fd-self-objects">
            <div className="fd-self-piles">
                <button type="button" aria-label={t('ui.selfDock.drawPileCount', { count: view.deckCount })} onClick={() => onPile('deck')}><Layers className="board-shell-fixed-icon" size={22}/><b>{view.deckCount}</b></button>
                <button type="button" aria-label={t('ui.selfDock.discardPileCount', { count: view.discardCount })} onClick={() => onPile('discard')}><Archive className="board-shell-fixed-icon" size={22}/><b>{view.discardCount}</b></button>
                {pileInfo && <div className="fd-self-pile-info" role="status">{pileInfo}</div>}
            </div>
            <button type="button" data-tutorial-id="fate-self-seals" className="fd-self-seals" aria-label={t('ui.selfDock.useCommandSeal')} disabled={!sealEnabled} onClick={onSeal}>
                {Array.from({length: view.player.commandSpells}, (_, index) => <CardPreview key={index} previewRef={fateCommandSealPreview(view.player.masterId)} alt={t('ui.selfDock.commandSealAlt')} style={{position:'absolute',top:(view.player.commandSpells - 1 - index) * 5,left:index * 18,width:78,zIndex:view.player.commandSpells-index}}/>)}
            </button>
        </div>
        <div className="fd-self-character"><button type="button" className="fd-self-identity" aria-description={view.player.eliminated ? t('ui.selfDock.eliminatedSpectating') : undefined} aria-label={t('ui.selfDock.viewPlayerDetails', { name })} onClick={onDetail}>
            <span data-tutorial-id="fate-self-avatar" className="fd-runtime-avatar"><OptimizedImage className="fd-runtime-master-avatar" src={fateTokenAsset(view.player.masterId)} alt={view.master?.name ?? ''}/><OptimizedImage className="fd-runtime-servant-avatar" src={view.servant?.assetPath ?? 'fate-domination/backs/servant'} alt={view.servant?.name ?? ''}/>{view.player.eliminated && <span className="fd-avatar-elimination" aria-hidden="true"/>}</span>
            <span className="fd-self-copy"><strong>{name}</strong><small>{view.master?.name} · {view.servant?.name ?? t('ui.selfDock.servant')}</small><span className="fd-self-stats"><span>{t('ui.selfDock.mana')} <b>{view.player.mana}</b></span><span>{t('ui.selfDock.victoryPoints')} <b>{view.player.victoryPoints}</b></span></span></span>
        </button><FateMasterAbilities abilities={(view.master?.skills??[]).map(ability=>{
            const source=view.player.skills.find(skill=>skill.isMasterSkill&&skill.id.split(':')[0]===ability.id);
            return {id:source?.id??ability.id,name:ability.name,description:ability.desc,actionable:Boolean(source&&resolveFatePlayerAbility(core,playerId,source.id)),enabled:Boolean(source&&canActivateAbility(source.id))};
        })} onActivate={onActivateAbility} onReadingChange={onAbilityTipChange}/></div>
    </aside>;
}
