// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { useHomeFormHudSuppression } from '../useHomeFormHudSuppression';
afterEach(cleanup);
function Probe({ mobile = true, editing = false }: { mobile?: boolean; editing?: boolean }) {
    const hidden = useHomeFormHudSuppression('/', mobile);
    return <><div className="platform-profile-identity">{editing && <form/>}</div>{!hidden && <div data-testid="fab-owner">面板和入口</div>}</>;
}
it('手机编辑时卸载整个面板owner，退出后恢复；桌面不受影响', async () => {
    const { rerender } = render(<Probe/>);
    expect(screen.getByTestId('fab-owner')).toBeTruthy();
    rerender(<Probe editing/>);
    await waitFor(() => expect(screen.queryByTestId('fab-owner')).toBeNull());
    rerender(<Probe/>);
    await waitFor(() => expect(screen.getByTestId('fab-owner')).toBeTruthy());
    rerender(<Probe editing mobile={false}/>);
    expect(screen.getByTestId('fab-owner')).toBeTruthy();
});
