import {useEffect,useRef,useState} from 'react';
import {InfoTooltip} from '../../../components/common/overlays/InfoTooltip';
import {useTouchLongPress} from '../../../hooks/ui/useTouchLongPress';
import {useTranslation} from 'react-i18next';

export interface FateMasterAbilityView {
    id: string;
    name: string;
    description: string | undefined;
    actionable: boolean;
    enabled: boolean;
}

/** 御主能力由牌桌发动，右侧说明只读；触控长按不触发发动。 */
export function FateMasterAbilities({abilities,onActivate,onReadingChange}:{abilities:readonly FateMasterAbilityView[];onActivate:(id:string)=>void;onReadingChange:(open:boolean)=>void}) {
    const { t } = useTranslation('game-fate-domination');
    const [reading,setReading]=useState<string|null>(null);
    const root=useRef<HTMLElement>(null);
    useEffect(()=>{onReadingChange(reading!==null);return()=>onReadingChange(false);},[reading,onReadingChange]);
    useEffect(()=>{
        if(!reading)return;
        const dismiss=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setReading(null);};
        document.addEventListener('pointerdown',dismiss);
        return()=>document.removeEventListener('pointerdown',dismiss);
    },[reading]);
    const touch=useTouchLongPress<string,string>({enabled:true,durationMs:500,moveCancelPx:10,clickBlockMs:500,onLongPress:id=>setReading(id)});
    return <section ref={root} className="fd-master-abilities" data-tutorial-id="fate-master-abilities" aria-label={t('ui.masterAbilities.label')}>
        {abilities.map(ability=><div key={ability.id} className="fd-master-ability" onPointerEnter={()=>setReading(ability.id)} onPointerLeave={event=>{if(event.pointerType!=='touch')setReading(null);}}>
            <button type="button" aria-label={ability.actionable?`发动${ability.name}`:ability.name} aria-disabled={!ability.enabled} onFocus={()=>setReading(ability.id)} onBlur={()=>setReading(null)}
                onPointerDown={event=>touch.handlePointerDown(event,ability.id,ability.id)} onPointerMove={event=>touch.handlePointerMove(event,ability.id)} onPointerUp={()=>touch.handlePointerUp(ability.id)} onPointerCancel={()=>touch.clearLongPressState(ability.id)}
                onContextMenu={event=>{event.preventDefault();setReading(ability.id);}} onKeyDown={event=>{if(event.key==='Escape')setReading(null);}}
                onClick={()=>{if(touch.shouldBlockClick(ability.id))return;if(ability.enabled){setReading(null);onActivate(ability.id);}}}>{ability.name}</button>
            <InfoTooltip title={ability.name} content={[ability.description]} position="right" isVisible={reading===ability.id}/>
        </div>)}
    </section>;
}
