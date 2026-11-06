import {useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent} from 'react';
import type {LocationId} from '../domain';

interface Options {
    playerId:string|null;
    enabled:boolean;
    onBegin:()=>void;
    onDrop:(location:LocationId,slot?:number|null)=>void;
    onCancel:()=>void;
}

/** 指针生命周期由 window 接管，拖离头像或目标外松手仍能收尾。 */
export function useFateMapDrag(options:Options) {
    const latest=useRef(options);
    latest.current=options;
    const cleanup=useRef<(()=>void)|null>(null);
    const suppressClickUntil=useRef(0);
    const [point,setPoint]=useState<{x:number;y:number}|null>(null);
    useEffect(()=>()=>cleanup.current?.(),[]);
    useEffect(()=>{cleanup.current?.();setPoint(null);},[options.playerId,options.enabled]);
    const onPointerDownCapture=(event:ReactPointerEvent)=>{
        const source=(event.target as HTMLElement).closest<HTMLElement>('[data-fate-drag-source]');
        if(!source || source.dataset.fateDragSource!==options.playerId || !options.enabled || event.button!==0)return;
        event.stopPropagation();cleanup.current?.();
        const start={x:event.clientX,y:event.clientY},pointerId=event.pointerId;
        let dragging=false;
        const finish=()=>{window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',up,true);window.removeEventListener('pointercancel',cancel,true);window.removeEventListener('blur',cancel);cleanup.current=null;};
        const move=(next:PointerEvent)=>{
            if(next.pointerId!==pointerId)return;
            if(!dragging && Math.hypot(next.clientX-start.x,next.clientY-start.y)<7)return;
            if(!dragging){dragging=true;latest.current.onBegin();}
            next.preventDefault();next.stopPropagation();setPoint({x:next.clientX,y:next.clientY});
        };
        const cancel=()=>{finish();setPoint(null);if(dragging){suppressClickUntil.current=Date.now()+400;latest.current.onCancel();}};
        const up=(next:PointerEvent)=>{
            if(next.pointerId!==pointerId)return;
            finish();setPoint(null);if(!dragging)return;
            next.preventDefault();next.stopPropagation();suppressClickUntil.current=Date.now()+400;
            const target=document.elementFromPoint(next.clientX,next.clientY)?.closest<HTMLElement>('[data-fate-destination]');
            if(!target){latest.current.onCancel();return;}
            const slot=target.dataset.fateSlot;
            latest.current.onDrop(target.dataset.fateDestination as LocationId,slot===undefined?undefined:slot==='none'?null:Number(slot));
        };
        cleanup.current=finish;
        window.addEventListener('pointermove',move,{capture:true,passive:false});window.addEventListener('pointerup',up,true);window.addEventListener('pointercancel',cancel,true);window.addEventListener('blur',cancel);
    };
    const onClickCapture=(event:ReactMouseEvent)=>{if(Date.now()<suppressClickUntil.current){event.preventDefault();event.stopPropagation();}};
    return {point,onPointerDownCapture,onClickCapture};
}
