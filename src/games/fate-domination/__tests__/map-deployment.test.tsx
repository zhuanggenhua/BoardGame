import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { createReplayAdapter } from '../../../engine/adapter';
import { FateDominationDomain } from '../domain';
import { FateMapSurface } from '../ui/FateMapSurface';

vi.mock('../../../engine/mapRenderer',()=>({PixiMapSceneHost:()=> <div/>}));
vi.mock('../../../components/common/media/OptimizedImage',()=>({OptimizedImage:({src,alt}:{src:string;alt:string})=><img src={src} alt={alt}/>}));
beforeEach(()=>vi.stubGlobal('ResizeObserver',class{observe(){} disconnect(){}}));

it('工房首位被占后，三个同值空点位分别可点，选中与提交保留实际点位',()=>{
    const adapter=createReplayAdapter(FateDominationDomain,'map-point-selection');
    let state=adapter.setup(['0','1','2']);state.core.phase='outpost';
    state=adapter.execute(state,{type:'DEPLOY_MASTER',playerId:'0',payload:{locationId:'workshop',deploymentSlot:0}}).state;
    const choose=vi.fn();
    render(<FateMapSurface core={state.core} locale="zh-CN" viewerId="1" legalLocations={['workshop']} selectedLocation="workshop" selectedDeploymentSlot={3} onLocation={choose} onInspect={vi.fn()}/>);
    expect(screen.getByRole('button',{name:'部署到魔术工房第1点位'}).hasAttribute('disabled')).toBe(true);
    for(const index of [2,3,4])expect(screen.getByRole('button',{name:`部署到魔术工房第${index}点位`}).hasAttribute('disabled')).toBe(false);
    const fourth=screen.getByRole('button',{name:'部署到魔术工房第4点位'});
    expect(fourth.getAttribute('aria-pressed')).toBe('true');
    for(const index of [2,3]){
        const other=screen.getByRole('button',{name:`部署到魔术工房第${index}点位`});
        expect(other.getAttribute('aria-pressed')).toBe('false');
        fireEvent.click(other);
        expect(choose).toHaveBeenLastCalledWith('workshop',index-1);
    }
    choose.mockClear();
    fireEvent.click(fourth);
    expect(choose).toHaveBeenCalledExactlyOnceWith('workshop',3);
});
