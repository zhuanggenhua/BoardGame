import {act,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {FateMasterAbilities} from '../FateMasterAbilities';

afterEach(()=>vi.useRealTimers());
const touch=(type:string)=>{
    const event=new Event(type,{bubbles:true});
    Object.assign(event,{pointerType:'touch',clientX:20,clientY:20});
    return event;
};

it('触控长按松手后仍可阅读，兼容click不发动；点外部退出说明',()=>{
    vi.useFakeTimers();
    const activate=vi.fn(),reading=vi.fn();
    render(<FateMasterAbilities abilities={[{id:'draw',name:'战略部署',description:'支付1魔力抽2张牌',actionable:true,enabled:true}]} onActivate={activate} onReadingChange={reading}/>);
    const button=screen.getByRole('button',{name:'发动战略部署'});
    fireEvent(button,touch('pointerdown'));
    act(()=>vi.advanceTimersByTime(550));
    fireEvent(button,touch('pointerup'));
    fireEvent(button,touch('pointerout'));
    fireEvent.click(button);
    expect(activate).not.toHaveBeenCalled();
    expect(reading).toHaveBeenLastCalledWith(true);
    expect(screen.getByTestId('info-tooltip')).toHaveTextContent('支付1魔力抽2张牌');
    fireEvent(document.body,touch('pointerdown'));
    expect(reading).toHaveBeenLastCalledWith(false);
});

it('不可发动的能力仍可聚焦阅读，但不会提交对局命令',()=>{
    const activate=vi.fn();
    render(<FateMasterAbilities abilities={[{id:'draw',name:'战略部署',description:'支付1魔力抽2张牌',actionable:true,enabled:false}]} onActivate={activate} onReadingChange={vi.fn()}/>);
    const button=screen.getByRole('button',{name:'发动战略部署'});
    fireEvent.focus(button);fireEvent.click(button);
    expect(button).toHaveAttribute('aria-disabled','true');
    expect(screen.getByTestId('info-tooltip')).toHaveTextContent('支付1魔力抽2张牌');
    expect(activate).not.toHaveBeenCalled();
});
