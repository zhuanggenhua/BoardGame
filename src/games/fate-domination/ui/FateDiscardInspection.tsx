import {useEffect,useRef} from 'react';
import {X} from 'lucide-react';
import {ModalBase} from '../../../components/common/overlays/ModalBase';
import {CardPreview} from '../../../components/common/media/CardPreview';
import {useHorizontalDragScroll} from '../../../hooks/ui/useHorizontalDragScroll';
import {FATE_ATTACK_BY_ID} from '../data';
import {fateCardPreview} from '../data/cardArtwork';
import type {CardInstance} from '../domain';
export function FateDiscardInspection({cards,onClose,onInspect}:{cards:readonly CardInstance[];onClose:()=>void;onInspect:(asset:string,name:string)=>void}){
 const {ref}=useHorizontalDragScroll();
 const closeRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;closeRef.current?.focus();return()=>previous?.focus();},[]);
 return <ModalBase onClose={onClose} overlayClassName="!bg-black/75">
  <section data-tutorial-id="fate-discard" className="fd-discard-inspection" role="dialog" aria-modal="true" aria-label="自己的弃牌堆" onKeyDown={event=>{
    if(event.key==='Escape'){event.stopPropagation();onClose();}
    if(event.key==='Tab'){
      const buttons=event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
      const first=buttons[0],last=buttons[buttons.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
   }}>
   <header><h2>弃牌堆 · {cards.length}</h2><button type="button" ref={closeRef} aria-label="关闭弃牌堆" onClick={onClose}><X size={22}/></button></header>
   <div ref={ref} className="fd-discard-cards">{cards.map(card=>{
    const definition=FATE_ATTACK_BY_ID[card.definitionId];
    return definition&&<button key={card.id} type="button" aria-label={`检视${definition.name}`} onClick={()=>onInspect(definition.assetPath,definition.name)}><CardPreview previewRef={fateCardPreview(definition.assetPath)} title={definition.name} style={{width:'100%'}}/></button>;
   })}</div>
  </section>
 </ModalBase>;
}
