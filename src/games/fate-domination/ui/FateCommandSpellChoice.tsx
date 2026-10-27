import {useState} from 'react';
import {X} from 'lucide-react';
import {ModalBase} from '../../../components/common/overlays/ModalBase';
import type {UseCommandSpellCommand, FateDominationCore} from '../domain';
import {FATE_LOCATION_ORDER} from '../domain';
interface Props {
 core: FateDominationCore;
 playerId: string;
 isLegal: (payload: UseCommandSpellCommand['payload']) => boolean;
 onConfirm: (payload: UseCommandSpellCommand['payload']) => void;
 onClose: () => void;
 onChooseMove: () => void;
}
const OPTIONS = [
 {id:'mana',title:'恢复魔力',description:'获得 4 点魔力。'},
 {id:'battle',title:'强化战斗',description:'本回合总威力 +2；每赢得一场战斗，额外获得 2 点战果。'},
 {id:'move',title:'令咒移动',description:'从深山町或新都移动到任意合法地点，无视交战状态。'},
] as const;
export function FateCommandSpellChoice({core,playerId,isLegal,onConfirm,onClose,onChooseMove}:Props){
 const [effect,setEffect]=useState<UseCommandSpellCommand['payload']['effect']|null>(null);
 const targets=FATE_LOCATION_ORDER.filter(targetLocationId=>isLegal({effect:'move',targetLocationId}));
 const payload=effect ? {effect} : null;
 return <ModalBase onClose={onClose} overlayClassName="!bg-black/75">
  <section data-tutorial-id="fate-seal-choice" className="fd-runtime-seal-choice" role="dialog" aria-modal="true" aria-label="使用令咒">
   <header><div><h2>使用令咒</h2><p>剩余 {core.players[playerId].commandSpells} 枚 · 本次消耗 1 枚</p></div><button type="button" aria-label="关闭令咒选择" onClick={onClose}><X size={22}/></button></header>
   <div className="fd-runtime-seal-options">{OPTIONS.map(option=><button key={option.id} type="button" aria-pressed={effect===option.id}
    disabled={option.id==='move'?targets.length===0:!isLegal({effect:option.id})} onClick={()=>{if(option.id==='move')onChooseMove();else setEffect(option.id);}}>
    <strong>{option.title}</strong><span>{option.description}</span>
   </button>)}</div>
   <footer><button type="button" disabled={!payload || !isLegal(payload)} onClick={()=>{if(payload && isLegal(payload))onConfirm(payload);}}>确认使用</button></footer>
  </section>
 </ModalBase>;
}
