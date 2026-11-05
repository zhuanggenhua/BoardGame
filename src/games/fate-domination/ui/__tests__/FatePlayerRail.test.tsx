import {useState} from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {createReplayAdapter} from '../../../../engine/adapter';
import {FateDominationDomain} from '../../domain';
import {FatePlayerRail} from '../FatePlayerRail';

vi.mock('react-i18next',async()=>{
    const {createInstance}=await import('i18next');
    const locale=(await import('../../../../../public/locales/zh-CN/game-fate-domination.json')).default;
    const instance=createInstance();
    await instance.init({lng:'zh-CN',resources:{'zh-CN':{'game-fate-domination':locale}}});
    return {useTranslation:()=>({t:instance.getFixedT('zh-CN','game-fate-domination')})};
});
vi.mock('../../../../components/common/media/OptimizedImage',()=>({OptimizedImage:({alt}:{alt:string})=><img alt={alt}/>}));

function Table(){
    const [selectedId,onSelect]=useState<string|null>(null);
    const [core]=useState(()=>createReplayAdapter(FateDominationDomain,'hover-lifecycle').setup(['0','1','2']).core);
    return <FatePlayerRail core={core} viewerId="0" selectedId={selectedId} onSelect={onSelect} nameFor={id=>`玩家 ${Number(id)+1}`} onDetail={()=>{}} onInspect={()=>{}}/>;
}

it('快速进入再离开头像时，新启动的宽限计时不能被旧选中态的 effect 清掉',()=>{
    vi.useFakeTimers();
    try{
        render(<Table/>);
        const avatar=screen.getByRole('button',{name:'查看玩家 2详情'});
        act(()=>{fireEvent.pointerEnter(avatar);fireEvent.pointerLeave(avatar);});
        expect(screen.getByLabelText('玩家 2已打出')).toBeVisible();
        act(()=>vi.advanceTimersByTime(2501));
        expect(screen.queryByLabelText('玩家 2已打出')).toBeNull();
    }finally{vi.useRealTimers();}
});

it('宽限内进入牌排可以持续阅读，离开后才重新计时退场',()=>{
    vi.useFakeTimers();
    try{
        render(<Table/>);
        const avatar=screen.getByRole('button',{name:'查看玩家 2详情'});
        fireEvent.pointerEnter(avatar);fireEvent.pointerLeave(avatar);
        act(()=>vi.advanceTimersByTime(1000));
        const row=screen.getByLabelText('玩家 2已打出');
        fireEvent.pointerEnter(row);
        act(()=>vi.advanceTimersByTime(4000));
        expect(row).toBeVisible();
        fireEvent.pointerLeave(row);
        act(()=>vi.advanceTimersByTime(2501));
        expect(screen.queryByLabelText('玩家 2已打出')).toBeNull();
    }finally{vi.useRealTimers();}
});
