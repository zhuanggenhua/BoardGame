import {fireEvent,render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {FateIdentitySetup} from '../ui/FateIdentitySetup';
import {FATE_MASTER_REFERENCE_COMPONENTS} from '../data/masterReferenceComponents';
import {FATE_MASTERS} from '../data';

vi.mock('../../../components/common/media/OptimizedImage',()=>({OptimizedImage:({src,alt}:{src:string;alt:string})=><img src={src} alt={alt}/>}));

it('每个开放御主有自己的原卡关系，牌背不算独立能力，独立牌库不算从者技能',()=>{
    expect(Object.keys(FATE_MASTER_REFERENCE_COMPONENTS).sort()).toEqual(FATE_MASTERS.map(master=>master.id).sort());
    expect(Object.values(FATE_MASTER_REFERENCE_COMPONENTS).flat()).toHaveLength(49);
    expect(Object.values(FATE_MASTER_REFERENCE_COMPONENTS).flat().filter(card=>card.backAssetPath)).toHaveLength(2);
    expect(FATE_MASTER_REFERENCE_COMPONENTS.m_tokiomi.filter(card=>card.kind==='item')).toHaveLength(4);
    expect(FATE_MASTER_REFERENCE_COMPONENTS.m_kayneth.filter(card=>card.kind==='independent-deck')).toHaveLength(3);
    expect(FATE_MASTER_REFERENCE_COMPONENTS.m_zouken.some(card=>card.kind==='seal')).toBe(false);
});

it('阅读凛的关联攻击、宝石正反面不提交身份，不改变角色；换御主不带走上一角色的阅读状态',()=>{
    const onSelect=vi.fn(),onInspect=vi.fn(),onConfirm=vi.fn();
    const props={masterId:'m_rin',servantId:'servant-rider',available:()=>true,onSelect,onInspect,onConfirm,confirmEnabled:true};
    const view=render(<FateIdentitySetup {...props}/>);
    expect(screen.queryByLabelText('从者技能牌')).toBeNull();
    fireEvent.click(screen.getByTestId('fate-identity-reference-gandr-shot'));
    expect(screen.getByRole('button',{name:'放大阴炁弹'})).toBeTruthy();
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('fate-identity-reference-gems'));
    fireEvent.click(screen.getByRole('button',{name:'查看牌背'}));
    expect(screen.getByRole('button',{name:'放大宝石牌背'})).toBeTruthy();
    expect(onSelect).not.toHaveBeenCalled();expect(onConfirm).not.toHaveBeenCalled();
    view.rerender(<FateIdentitySetup {...props} masterId="m_kayneth"/>);
    expect(screen.getByRole('button',{name:'放大肯尼斯'})).toBeTruthy();
    expect(screen.queryByRole('button',{name:'查看正面'})).toBeNull();
    expect(screen.getByTestId('fate-identity-references').querySelectorAll('[data-reference-kind="independent-deck"]')).toHaveLength(3);
    fireEvent.click(screen.getByRole('tab',{name:'从者'}));
    expect(screen.getByLabelText('从者技能牌').querySelectorAll('[data-reference-kind="servant-skill"]')).toHaveLength(3);
    expect(screen.queryByLabelText('御主关联组件')).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
});
