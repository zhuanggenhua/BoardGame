import {useState} from 'react';
import {X} from 'lucide-react';
import {ModalBase} from '../../../components/common/overlays/ModalBase';
import type {UseCommandSpellCommand, FateDominationCore} from '../domain';
import {FATE_LOCATION_ORDER} from '../domain';
import {useTranslation} from 'react-i18next';
interface Props {
 core: FateDominationCore;
 playerId: string;
 isLegal: (payload: UseCommandSpellCommand['payload']) => boolean;
 onConfirm: (payload: UseCommandSpellCommand['payload']) => void;
 onClose: () => void;
 onChooseMove: () => void;
}
const OPTIONS = ['mana', 'battle', 'move'] as const;
export function FateCommandSpellChoice({core,playerId,isLegal,onConfirm,onClose,onChooseMove}:Props){
 const { t } = useTranslation('game-fate-domination');
 const [effect,setEffect]=useState<UseCommandSpellCommand['payload']['effect']|null>(null);
 const targets=FATE_LOCATION_ORDER.filter(targetLocationId=>isLegal({effect:'move',targetLocationId}));
 const payload=effect ? {effect} : null;
 const optionCopy = {
  mana: { title: t('ui.commandSpellChoice.manaTitle'), description: t('ui.commandSpellChoice.manaDescription') },
  battle: { title: t('ui.commandSpellChoice.battleTitle'), description: t('ui.commandSpellChoice.battleDescription') },
  move: { title: t('ui.commandSpellChoice.moveTitle'), description: t('ui.commandSpellChoice.moveDescription') },
 };
 return <ModalBase onClose={onClose} overlayClassName="!bg-black/75">
  <section data-tutorial-id="fate-seal-choice" className="fd-runtime-seal-choice" role="dialog" aria-modal="true" aria-label={t('ui.commandSpellChoice.dialogLabel')}>
   <header><div><h2>{t('ui.commandSpellChoice.title')}</h2><p>{t('ui.commandSpellChoice.remaining', { count: core.players[playerId].commandSpells })}</p></div><button type="button" aria-label={t('ui.commandSpellChoice.close')} onClick={onClose}><X size={22}/></button></header>
   <div className="fd-runtime-seal-options">{OPTIONS.map(effectId=><button key={effectId} type="button" aria-pressed={effect===effectId}
    disabled={effectId==='move'?targets.length===0:!isLegal({effect:effectId})} onClick={()=>{if(effectId==='move')onChooseMove();else setEffect(effectId);}}>
    <strong>{optionCopy[effectId].title}</strong><span>{optionCopy[effectId].description}</span>
   </button>)}</div>
   <footer><button type="button" disabled={!payload || !isLegal(payload)} onClick={()=>{if(payload && isLegal(payload))onConfirm(payload);}}>{t('ui.commandSpellChoice.confirm')}</button></footer>
  </section>
 </ModalBase>;
}
