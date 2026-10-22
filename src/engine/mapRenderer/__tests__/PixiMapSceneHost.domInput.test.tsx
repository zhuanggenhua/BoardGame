// @vitest-environment jsdom
import React from 'react';
import {act, cleanup, render, waitFor} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
const runtime = vi.hoisted(() => ({app: null as any}));
vi.mock('@pixi/react', () => ({extend: vi.fn(), useTick: vi.fn(), useApplication: () => ({app: runtime.app, isInitialised: true}), Application: ({children}: {children: React.ReactNode}) => <>{children}</>}));
vi.mock('pixi.js', () => ({Assets: {load: vi.fn()}, Container: class {}, Graphics: class {}, Rectangle: class {}, Sprite: class {}, Texture: {EMPTY:{}}, isWebGLSupported: () => true, isWebGPUSupported: () => false}));
vi.mock('../PixiSceneViewport', () => ({PixiSceneViewport: () => null}));
vi.mock('../PixiSceneSpriteLayer', () => ({PixiSceneSpriteLayer: ({onResourceStateChange}: any) => {React.useEffect(() => {onResourceStateChange({status:'ready',resourceUrl:''});}, [onResourceStateChange]); return null;}}));
import {PixiMapSceneHost} from '../PixiMapSceneHost';
afterEach(() => {cleanup(); document.body.innerHTML=''; vi.restoreAllMocks();});
async function setup() {
 const surface=document.createElement('div'); const button=document.createElement('button'); surface.append(button); document.body.append(surface);
 const captures=new Set<number>(); surface.setPointerCapture=(id)=>{captures.add(id);};surface.hasPointerCapture=(id)=>captures.has(id);surface.releasePointerCapture=(id)=>{captures.delete(id);};
 const canvas=document.createElement('canvas'); canvas.getBoundingClientRect=()=>({left:0,top:0,width:500,height:300,right:500,bottom:300,x:0,y:0,toJSON(){}});
 runtime.app={canvas,screen:{width:500,height:300}};
 const click=vi.fn();button.addEventListener('click',click);const onViewportChange=vi.fn();const onResourceStateChange=vi.fn();
 const result=render(<PixiMapSceneHost inputElement={surface} mapWidth={500} mapHeight={300} viewport={{zoom:1,panX:0,panY:0}} interactive regionSelectionEnabled={false} onViewportChange={onViewportChange} onResourceStateChange={onResourceStateChange}/>);
 await waitFor(()=>expect(onResourceStateChange).toHaveBeenLastCalledWith(expect.objectContaining({status:'ready'})));
 const pointer=(type:string,x:number,y:number,id=1)=>act(()=>{const e=new MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0});Object.defineProperties(e,{pointerId:{value:id},pointerType:{value:'touch'}});button.dispatchEvent(e);});
 const activate=(detail:number)=>act(()=>{button.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,detail}));});
 return {surface,button,click,pointer,activate,onViewportChange,result};
}
it('DOM地点上拖动后抑制指针click，下一次普通点击仍可操作',async()=>{
 const t=await setup();t.pointer('pointerdown',10,10);t.pointer('pointermove',70,10);t.pointer('pointerup',70,10);t.activate(1);
 expect(t.click).not.toHaveBeenCalled();await waitFor(()=>expect(t.onViewportChange).toHaveBeenCalledWith(expect.objectContaining({panX:60})));
 t.pointer('pointerdown',70,10);t.pointer('pointerup',70,10);t.activate(1);expect(t.click).toHaveBeenCalledOnce();
});
it('取消指针后键盘激活不会被遗留的拖动抑制吞掉',async()=>{
 const t=await setup();t.pointer('pointerdown',10,10);t.pointer('pointercancel',10,10);t.activate(0);expect(t.click).toHaveBeenCalledOnce();
});

it('双指松开第一指及最后一指均不把兼容click发送给地点按钮',async()=>{
 const t=await setup();t.pointer('pointerdown',10,10,1);t.pointer('pointerdown',100,10,2);
 t.pointer('pointermove',140,10,2);t.pointer('pointerup',10,10,1);t.activate(1);expect(t.click).not.toHaveBeenCalled();
 t.pointer('pointerup',140,10,2);t.activate(1);expect(t.click).not.toHaveBeenCalled();
 t.pointer('pointerdown',20,20,3);t.pointer('pointerup',20,20,3);t.activate(1);expect(t.click).toHaveBeenCalledOnce();
});
