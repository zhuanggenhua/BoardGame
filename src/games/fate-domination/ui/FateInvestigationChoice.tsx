import {CardPreview} from '../../../components/common/media/CardPreview';
import {CardInspectButton} from '../../../components/common/overlays/CardInspectButton';
import {useTouchLongPress} from '../../../hooks/ui/useTouchLongPress';
import type {InteractionDescriptor} from '../../../engine/systems/InteractionSystem';
import {useTranslation} from 'react-i18next';
import type {CSSProperties} from 'react';
import {FATE_ATTACK_BY_ID} from '../data';
import {fateCardPreview} from '../data/cardArtwork';
import {FATE_INVESTIGATION_KEEP,type FateInvestigationChoiceData} from '../domain/investigationChoice';
import './investigation-choice.css';

/** 仅调查者收到已查看的牌；牌本体选择放回，保留原样是规则允许的选择。 */
export function FateInvestigationChoice({interaction,targetName,canChoose,onChoose,onInspect}:{interaction:InteractionDescriptor<FateInvestigationChoiceData>;targetName:string;canChoose:(id:string)=>boolean;onChoose:(id:string)=>void;onInspect:(asset:string,name:string)=>void}) {
    const {t}=useTranslation('game-fate-domination');
    const touch=useTouchLongPress<string,{asset:string;name:string}>({enabled:true,durationMs:500,moveCancelPx:10,clickBlockMs:500,onLongPress:(_id,card)=>onInspect(card.asset,card.name)});
    return <section className="fd-investigation-choice" aria-label={t('ui.investigationChoice.label')} data-testid="fate-investigation-choice">
        <div className="fd-investigation-prompt"><span>{t(interaction.data.fateContext.offered.length?'ui.investigationChoice.prompt':'ui.investigationChoice.empty',{name:targetName})}</span><button type="button" aria-disabled={!canChoose(FATE_INVESTIGATION_KEEP)} onClick={()=>onChoose(FATE_INVESTIGATION_KEEP)}>{t(interaction.data.fateContext.offered.length?'ui.investigationChoice.keep':'ui.investigationChoice.done')}</button></div>
        <div className="fd-investigation-cards" style={{'--fd-investigation-count':Math.max(1,interaction.data.fateContext.offered.length)} as CSSProperties}>{interaction.data.fateContext.offered.map(card=>{
            const definition=FATE_ATTACK_BY_ID[card.definitionId];if(!definition)return null;
            return <div key={card.id} className="fd-investigation-card group"><button type="button" aria-disabled={!canChoose(card.id)} aria-label={t('ui.investigationChoice.card',{name:definition.name})}
                onPointerDown={event=>touch.handlePointerDown(event,card.id,{asset:definition.assetPath,name:definition.name})} onPointerMove={event=>touch.handlePointerMove(event,card.id)}
                onPointerUp={()=>touch.handlePointerUp(card.id)} onPointerCancel={()=>touch.handlePointerUp(card.id)}
                onContextMenu={event=>{event.preventDefault();onInspect(definition.assetPath,definition.name);}} onClick={()=>{if(!touch.shouldBlockClick(card.id))onChoose(card.id);}}>
                <CardPreview previewRef={fateCardPreview(definition.assetPath)} title={definition.name} style={{width:'100%'}}/>
            </button><CardInspectButton ariaLabel={t('ui.hand.enlargeCard',{name:definition.name})} sourceCardId={card.id} buttonSize="32px" onInspect={()=>onInspect(definition.assetPath,definition.name)}/></div>;
        })}</div>
    </section>;
}
