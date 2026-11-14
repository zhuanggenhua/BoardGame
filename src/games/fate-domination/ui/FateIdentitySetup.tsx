import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check, Maximize2 } from 'lucide-react';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { FATE_MASTERS, FATE_SERVANTS } from '../data';
import { FATE_MASTER_REFERENCE_COMPONENTS } from '../data/masterReferenceComponents';
import './identity-setup.css';

type IdentityKind = 'master' | 'servant';
interface Props {
    masterId: string;
    servantId: string;
    available: (kind: IdentityKind, id: string) => boolean;
    onInspect: (asset: string, name: string) => void;
    onConfirm: (identities: { masterId: string; servantId: string }) => void;
    confirmEnabled: boolean;
}

type ReferenceKind = 'identity' | 'ability' | 'state' | 'resource' | 'item' | 'skill-attack' | 'attack' | 'independent-deck' | 'ascension' | 'seal' | 'servant-skill';
interface ReferenceCard { id: string; name: string; assetPath: string; kind: ReferenceKind; backAssetPath?: string }

/** 选择资料只读原卡，不把关联物件当作开局已持有或已激活的对局状态。 */
export function FateIdentitySetup({ masterId, servantId, available, onInspect, onConfirm, confirmEnabled }: Props) {
    const { t } = useTranslation('game-fate-domination');
    const [kind, setKind] = useState<IdentityKind>('master');
    const [chosen, setChosen] = useState<Partial<Record<IdentityKind, string>>>({});
    const [reading, setReading] = useState<{scope: string; id: string; back: boolean} | null>(null);
    const master = FATE_MASTERS.find(item => item.id === (chosen.master ?? masterId))!;
    const servant = FATE_SERVANTS.find(item => item.id === (chosen.servant ?? servantId))!;
    const candidates = kind === 'master' ? FATE_MASTERS : FATE_SERVANTS;
    const identity = kind === 'master' ? master : servant;
    const scope = `${kind}:${identity.id}`;
    const references: ReferenceCard[] = [
        {id:'identity',name:identity.name,assetPath:identity.assetPath,kind:'identity'},
        ...(kind === 'master' ? FATE_MASTER_REFERENCE_COMPONENTS[master.id] : (servant.skillCards ?? []).map((skill,index)=>({
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
        <header className="fd-identity-heading"><h1>{t('ui.identitySetup.title')}</h1>
            <nav role="tablist" aria-label={t('ui.identitySetup.identityType')}>
                {(['master', 'servant'] as const).map(role => <button key={role} type="button" role="tab" aria-selected={kind === role} onClick={() => setKind(role)}>
                    {t(`ui.identitySetup.${role}`)}{chosen[role] && <Check size={15} aria-hidden="true"/>}
                </button>)}
            </nav>
        </header>
        <div className="fd-identity-workspace">
            <section className="fd-identity-roster" aria-label={t('ui.identitySetup.roster')}>
                <p>{t(kind === 'master' ? 'ui.identitySetup.chooseMaster' : 'ui.identitySetup.chooseServant')}</p>
                <div className="fd-identity-candidates" role="tabpanel" aria-label={kind === 'master' ? t('ui.identitySetup.masterCandidates') : t('ui.identitySetup.servantCandidates')}>
                    {candidates.map(candidate => {
                        const name = candidate.name;
                        const enabled = available(kind, candidate.id);
                        return <button key={candidate.id} type="button" className="fd-identity-candidate"
                            data-testid={`fate-setup-${kind}-${candidate.id}`} aria-label={t('ui.identitySetup.selectCandidate', { role: roleLabel, name })}
                            aria-pressed={chosen[kind] === candidate.id} disabled={!enabled} onClick={() => setChosen(current => ({ ...current, [kind]: candidate.id }))}>
                            <OptimizedImage src={candidate.assetPath} alt=""/>
                            <span>{name}</span>
                        </button>;
                    })}
                </div>
            </section>
            <section className="fd-identity-reader" aria-label={t('ui.identitySetup.currentCharacter')}>
                <h2>{identity.name}</h2>
                <button type="button" className="fd-identity-reader-art" aria-label={t('ui.identitySetup.enlargeCard', { name: current.name, side: back ? t('ui.identitySetup.cardBackSide') : '' })} onClick={() => onInspect(image,current.name)}>
                    <OptimizedImage src={image} alt={current.name}/>
                    <Maximize2 size={18} aria-hidden="true"/>
                </button>
                {current.backAssetPath && <button type="button" className="fd-identity-flip" onClick={() => setReading({scope,id:current.id,back:!back})}>{back ? t('ui.identitySetup.viewFront') : t('ui.identitySetup.viewBack')}</button>}
            </section>
            <section className="fd-identity-reference-shelf" aria-label={kind === 'master' ? t('ui.identitySetup.masterReferences') : t('ui.identitySetup.servantReferences')} data-testid="fate-identity-references" data-master-id={kind === 'master' ? master.id : undefined}>
                <h3>{t(kind === 'master' ? 'ui.identitySetup.masterReferences' : 'ui.identitySetup.servantReferences')}</h3>
                <div className="fd-identity-references">{references.map(card=><button key={card.id} type="button" className="fd-identity-reference"
                    data-testid={`fate-identity-reference-${card.id}`} data-reference-kind={card.kind}
                    aria-label={t('ui.identitySetup.readCard', { name: card.name })} aria-pressed={current.id===card.id}
                    onClick={()=>setReading({scope,id:card.id,back:false})}>
                    <OptimizedImage src={card.assetPath} alt=""/>
                    <b>{card.name}</b>
                    <span>{referenceLabels[card.kind]}</span>
                </button>)}</div>
            </section>
        </div>
        <footer className="fd-identity-footer">
            <div className="fd-identity-party" aria-label={t('ui.identitySetup.selectedIdentities')}>
                <span>{t('ui.identitySetup.master')} <b>{chosen.master ? master.name : t('ui.identitySetup.notSelected')}</b></span>
                <span>{t('ui.identitySetup.servant')} <b>{chosen.servant ? servant.name : t('ui.identitySetup.notSelected')}</b></span>
            </div>
            {chosen.master && !chosen.servant && kind === 'master'
                ? <button type="button" className="fd-identity-confirm" onClick={() => setKind('servant')}>{t('ui.identitySetup.servant')}<ArrowRight size={20}/></button>
                : <button type="button" className="fd-identity-confirm" data-testid="fate-domination-primary-action"
                    disabled={!confirmEnabled || !chosen.master || !chosen.servant}
                    onClick={() => onConfirm({masterId: master.id, servantId: servant.id})}>{t('ui.identitySetup.complete')}<ArrowRight size={20}/></button>}
        </footer>
    </section>;
}
