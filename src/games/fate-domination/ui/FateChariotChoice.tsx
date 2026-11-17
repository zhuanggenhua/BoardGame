import { CardPreview } from '../../../components/common/media/CardPreview';
import { CardInspectButton } from '../../../components/common/overlays/CardInspectButton';
import { fateCardPreview } from '../data/cardArtwork';
import type { FateChariotChoiceData } from '../domain/chariotChoice';
import type { InteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import { useTranslation } from 'react-i18next';
import { useTouchLongPress } from '../../../hooks/ui/useTouchLongPress';
import './chariot-choice.css';

/** The drawn events are visible only to the deciding player; one click submits the choice. */
export function FateChariotChoice({interaction,onChoose,onInspect}:{interaction:InteractionDescriptor<FateChariotChoiceData>;onChoose:(id:string)=>void;onInspect:(asset:string,name:string)=>void}) {
    const {t}=useTranslation('game-fate-domination');
    const touch=useTouchLongPress<string,{asset:string;name:string}>({enabled:true,durationMs:500,moveCancelPx:10,clickBlockMs:500,onLongPress:(_id,card)=>onInspect(card.asset,card.name)});
    return <section className="fd-chariot-choice" aria-label={t('ui.chariotChoice.label')} data-testid="fate-chariot-choice">
        <p>{t('ui.chariotChoice.prompt')}</p>
        <div>{interaction.data.fateContext.offered.map(card=><div className="fd-chariot-card group" key={card.id}><button type="button" aria-label={t('ui.chariotChoice.card',{name:card.name})}
            onPointerDown={event=>touch.handlePointerDown(event,card.id,{asset:card.assetPath,name:card.name})} onPointerMove={event=>touch.handlePointerMove(event,card.id)}
            onPointerUp={()=>touch.handlePointerUp(card.id)} onPointerCancel={()=>touch.handlePointerUp(card.id)}
            onContextMenu={event=>{event.preventDefault();onInspect(card.assetPath,card.name);}} onClick={()=>{if(!touch.shouldBlockClick(card.id))onChoose(card.id);}}>
            <CardPreview previewRef={fateCardPreview(card.assetPath)} title={card.name} style={{width:'100%'}}/>
        </button><CardInspectButton ariaLabel={t('ui.hand.enlargeCard',{name:card.name})} sourceCardId={card.id} buttonSize="32px" onInspect={()=>onInspect(card.assetPath,card.name)}/></div>)}</div>
    </section>;
}
