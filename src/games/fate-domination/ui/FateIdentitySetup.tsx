import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { FATE_MASTERS, FATE_SERVANTS } from '../data';
import { FATE_MASTER_REFERENCE_COMPONENTS } from '../data/masterReferenceComponents';
import './identity-setup.css';

type IdentityKind = 'master' | 'servant';
interface Props {
    masterId: string;
    servantId: string;
    available: (kind: IdentityKind, id: string) => boolean;
    onSelect: (kind: IdentityKind, id: string) => void;
    onInspect: (asset: string, name: string) => void;
    onConfirm: () => void;
    confirmEnabled: boolean;
}

type ReferenceKind = 'identity' | 'ability' | 'state' | 'resource' | 'item' | 'skill-attack' | 'attack' | 'independent-deck' | 'ascension' | 'seal' | 'servant-skill';
interface ReferenceCard { id: string; name: string; assetPath: string; kind: ReferenceKind; backAssetPath?: string }

/** 选择资料只读原卡，不把关联物件当作开局已持有或已激活的对局状态。 */
export function FateIdentitySetup({ masterId, servantId, available, onSelect, onInspect, onConfirm, confirmEnabled }: Props) {
    const { t } = useTranslation('game-fate-domination');
    const [kind, setKind] = useState<IdentityKind>('master');
    const [reading, setReading] = useState<{scope: string; id: string; back: boolean} | null>(null);
    const master = FATE_MASTERS.find(item => item.id === masterId)!;
    const servant = FATE_SERVANTS.find(item => item.id === servantId)!;
    const candidates = kind === 'master' ? FATE_MASTERS : FATE_SERVANTS;
    const selected = kind === 'master' ? masterId : servantId;
    const identity = kind === 'master' ? master : servant;
    const scope = `${kind}:${selected}`;
    const references: ReferenceCard[] = [
        {id:'identity',name:identity.name,assetPath:identity.assetPath,kind:'identity'},
        ...(kind === 'master' ? FATE_MASTER_REFERENCE_COMPONENTS[masterId] : servant.skillCards!.map((skill,index)=>({
            id:skill.id!,name:skill.name,assetPath:servant.skillAssetPaths[index],kind:'servant-skill' as const,
        }))),
    ];
    const current = references.find(card => reading?.scope === scope && card.id === reading.id) ?? references[0];
    const back = reading?.scope === scope && reading.id === current.id && reading.back && current.backAssetPath;
    const image = back ? current.backAssetPath! : current.assetPath;
    const referenceLabels: Record<ReferenceKind, string> = {
        identity: t('ui.identitySetup.references.identity'), ability: t('ui.identitySetup.references.ability'),
        state: t('ui.identitySetup.references.state'), resource: t('ui.identitySetup.references.resource'),
        item: t('ui.identitySetup.references.item'), 'skill-attack': t('ui.identitySetup.references.skillAttack'),
        attack: t('ui.identitySetup.references.attack'), 'independent-deck': t('ui.identitySetup.references.independentDeck'),
        ascension: t('ui.identitySetup.references.ascension'), seal: t('ui.identitySetup.references.seal'),
        'servant-skill': t('ui.identitySetup.references.servantSkill'),
    };
    const roleLabel = kind === 'master' ? t('ui.identitySetup.master') : t('ui.identitySetup.servant');
    return <section className="fd-identity-setup" aria-label={t('ui.identitySetup.dialogLabel')} data-tutorial-id="fate-setup">
        <header className="fd-identity-heading"><small>{t('brand')}</small><h1>{t('ui.identitySetup.title')}</h1></header>
        <div className="fd-identity-workspace">
            <section className="fd-identity-roster" aria-label={t('ui.identitySetup.roster')}>
                <nav role="tablist" aria-label={t('ui.identitySetup.identityType')}>
                    <button type="button" role="tab" aria-selected={kind === 'master'} onClick={() => setKind('master')}>{t('ui.identitySetup.master')}</button>
                    <button type="button" role="tab" aria-selected={kind === 'servant'} onClick={() => setKind('servant')}>{t('ui.identitySetup.servant')}</button>
                </nav>
                <div className="fd-identity-candidates" role="tabpanel" aria-label={kind === 'master' ? t('ui.identitySetup.masterCandidates') : t('ui.identitySetup.servantCandidates')}>
                    {candidates.map(candidate => {
                        const name = candidate.name;
                        const enabled = candidate.id === selected || available(kind, candidate.id);
                        return <button key={candidate.id} type="button" className="fd-identity-candidate"
                            data-testid={`fate-setup-${kind}-${candidate.id}`} aria-label={t('ui.identitySetup.selectCandidate', { role: roleLabel, name })}
                            aria-pressed={candidate.id === selected} disabled={!enabled} onClick={() => onSelect(kind, candidate.id)}>
                            <OptimizedImage src={candidate.assetPath} alt={name}/>
                            <span>{name}</span>
                        </button>;
                    })}
                </div>
            </section>
            <section className="fd-identity-reader" aria-label={t('ui.identitySetup.currentCharacter')}>
                <button type="button" className="fd-identity-reader-art" aria-label={t('ui.identitySetup.enlargeCard', { name: current.name, side: back ? t('ui.identitySetup.cardBackSide') : '' })} onClick={() => onInspect(image,current.name)}>
                    <OptimizedImage src={image} alt={current.name}/>
                </button>
                {current.backAssetPath && <button type="button" className="fd-identity-flip" onClick={() => setReading({scope,id:current.id,back:!back})}>{back ? t('ui.identitySetup.viewFront') : t('ui.identitySetup.viewBack')}</button>}
            </section>
            <section className="fd-identity-references" aria-label={kind === 'master' ? t('ui.identitySetup.masterReferences') : t('ui.identitySetup.servantReferences')} data-testid="fate-identity-references" data-master-id={kind === 'master' ? masterId : undefined}>
                {references.map(card=><button key={card.id} type="button" className="fd-identity-reference"
                    data-testid={`fate-identity-reference-${card.id}`} data-reference-kind={card.kind}
                    aria-label={t('ui.identitySetup.readCard', { name: card.name })} aria-pressed={current.id===card.id}
                    onClick={()=>setReading({scope,id:card.id,back:false})}>
                    <span>{referenceLabels[card.kind]}</span>
                    <OptimizedImage src={card.assetPath} alt={card.name}/>
                </button>)}
            </section>
        </div>
        <footer className="fd-identity-footer">
            <div className="fd-identity-party" aria-label={t('ui.identitySetup.selectedIdentities')}><span>{t('ui.identitySetup.master')} <b>{master.name}</b></span><span>{t('ui.identitySetup.servant')} <b>{servant.name}</b></span></div>
            <button type="button" className="fd-identity-confirm" data-testid="fate-domination-primary-action" disabled={!confirmEnabled} onClick={onConfirm}>{t('ui.identitySetup.complete')}<ArrowRight size={20}/></button>
        </footer>
    </section>;
}
