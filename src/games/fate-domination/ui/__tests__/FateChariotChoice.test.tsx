import '../../__tests__/helpers/i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { FateChariotChoice } from '../FateChariotChoice';
import { FATE_EVENTS } from '../../data';

it('查看事件牌不会提交，点击卡面才选择',()=>{
 const offered=FATE_EVENTS.slice(0,2),choose=vi.fn(),inspect=vi.fn();
 render(<FateChariotChoice interaction={{data:{fateContext:{offered}}} as never} onChoose={choose} onInspect={inspect}/>);
 fireEvent.click(screen.getByRole('button',{name:`放大${offered[0].name}`}));
 expect(inspect).toHaveBeenCalledExactlyOnceWith(offered[0].assetPath,offered[0].name);
 expect(choose).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:`选择事件 ${offered[1].name}`}));
 expect(choose).toHaveBeenCalledExactlyOnceWith(offered[1].id);
});
