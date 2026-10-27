import { useState } from 'react';
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

const referenceLabels = {
    identity: '身份牌', ability: '能力牌', state: '条件与身份变化', resource: '宝石', item: '道具',
    'skill-attack': '追加至技能区', attack: '关联攻击牌', 'independent-deck': '独立牌库',
    ascension: '升华卡', seal: '令咒', 'servant-skill': '从者技能牌',
};
interface ReferenceCard { id: string; name: string; assetPath: string; kind: keyof typeof referenceLabels; backAssetPath?: string }

/** 选择资料只读原卡，不把关联物件当作开局已持有或已激活的对局状态。 */
export function FateIdentitySetup({ masterId, servantId, available, onSelect, onInspect, onConfirm, confirmEnabled }: Props) {
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
    return <section className="fd-identity-setup" aria-label="选择御主与从者" data-tutorial-id="fate-setup">
        <header className="fd-identity-heading"><small>FATE / DOMINATION</small><h1>准备圣杯战争</h1></header>
        <div className="fd-identity-workspace">
            <section className="fd-identity-roster" aria-label="身份候选">
                <nav role="tablist" aria-label="选择身份类型">
                    <button type="button" role="tab" aria-selected={kind === 'master'} onClick={() => setKind('master')}>御主</button>
                    <button type="button" role="tab" aria-selected={kind === 'servant'} onClick={() => setKind('servant')}>从者</button>
                </nav>
                <div className="fd-identity-candidates" role="tabpanel" aria-label={kind === 'master' ? '御主候选' : '从者候选'}>
                    {candidates.map(candidate => {
                        const name = candidate.name;
                        const enabled = candidate.id === selected || available(kind, candidate.id);
                        return <button key={candidate.id} type="button" className="fd-identity-candidate"
                            data-testid={`fate-setup-${kind}-${candidate.id}`} aria-label={`选择${kind === 'master' ? '御主' : '从者'}${name}`}
                            aria-pressed={candidate.id === selected} disabled={!enabled} onClick={() => onSelect(kind, candidate.id)}>
                            <OptimizedImage src={candidate.assetPath} alt={name}/>
                            <span>{name}</span>
                        </button>;
                    })}
                </div>
            </section>
            <section className="fd-identity-reader" aria-label="当前角色资料">
                <button type="button" className="fd-identity-reader-art" aria-label={`放大${current.name}${back ? '牌背' : ''}`} onClick={() => onInspect(image,current.name)}>
                    <OptimizedImage src={image} alt={current.name}/>
                </button>
                {current.backAssetPath && <button type="button" className="fd-identity-flip" onClick={() => setReading({scope,id:current.id,back:!back})}>{back ? '查看正面' : '查看牌背'}</button>}
            </section>
            <section className="fd-identity-references" aria-label={kind === 'master' ? '御主关联组件' : '从者技能牌'} data-testid="fate-identity-references" data-master-id={kind === 'master' ? masterId : undefined}>
                {references.map(card=><button key={card.id} type="button" className="fd-identity-reference"
                    data-testid={`fate-identity-reference-${card.id}`} data-reference-kind={card.kind}
                    aria-label={`阅读${card.name}`} aria-pressed={current.id===card.id}
                    onClick={()=>setReading({scope,id:card.id,back:false})}>
                    <span>{referenceLabels[card.kind]}</span>
                    <OptimizedImage src={card.assetPath} alt={card.name}/>
                </button>)}
            </section>
        </div>
        <footer className="fd-identity-footer">
            <div className="fd-identity-party" aria-label="本局已选身份"><span>御主 <b>{master.name}</b></span><span>从者 <b>{servant.name}</b></span></div>
            <button type="button" className="fd-identity-confirm" data-testid="fate-domination-primary-action" disabled={!confirmEnabled} onClick={onConfirm}>完成准备<ArrowRight size={20}/></button>
        </footer>
    </section>;
}
