import { act, render } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { PixiSceneViewport } from '../PixiSceneViewport';
const state=vi.hoisted(()=>({ready:true,resize:vi.fn(),screen:{width:1920,height:1080}}));
vi.mock('@pixi/react',()=>({useApplication:()=>({isInitialised:state.ready,app:{screen:state.screen,renderer:{resize:state.resize}}})}));
let notify:()=>void; const disconnect=vi.fn();
beforeEach(()=>{state.ready=true;state.screen={width:1920,height:1080};state.resize.mockClear();disconnect.mockClear();vi.stubGlobal('ResizeObserver',class {constructor(callback:()=>void){notify=callback;}observe(){}disconnect=disconnect;});});
it('父容器晚于窗口完成布局时按容器尺寸同步画布，不保持旧高度',()=>{
 const host=document.createElement('div'); let width=1920,height=1080;
 Object.defineProperties(host,{clientWidth:{get:()=>width},clientHeight:{get:()=>height}});
 const view=render(<PixiSceneViewport hostRef={{current:host}}/>);
 expect(state.resize).not.toHaveBeenCalled();
 width=1366;height=768;act(()=>notify());
 expect(state.resize).toHaveBeenLastCalledWith(1366,768);
 view.unmount();expect(disconnect).toHaveBeenCalledOnce();
});
it('变换缩放的棋盘采用逻辑容器尺寸，不采用变换后的视觉尺寸',()=>{
 const host=document.createElement('div');Object.defineProperties(host,{clientWidth:{value:1920},clientHeight:{value:1080}});
 host.getBoundingClientRect=()=>({width:844,height:475} as DOMRect);
 state.screen={width:300,height:150};render(<PixiSceneViewport hostRef={{current:host}}/>);
 expect(state.resize).toHaveBeenCalledWith(1920,1080);
});
it('渲染器未就绪或者容器隐藏为零时不提交无效尺寸',()=>{
 const host=document.createElement('div');state.ready=false;
 const view=render(<PixiSceneViewport hostRef={{current:host}}/>);
 expect(state.resize).not.toHaveBeenCalled();state.ready=true;
 view.rerender(<PixiSceneViewport hostRef={{current:host}}/>);
 expect(state.resize).not.toHaveBeenCalled();
});
