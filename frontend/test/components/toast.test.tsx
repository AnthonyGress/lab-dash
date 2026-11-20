import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './render';
import { ToastInitializer } from '../../src/components/toast/ToastInitializer';
import { ToastManager, ToastProvider, useToast } from '../../src/components/toast/ToastManager';

const onAction = vi.fn();

/** Buttons that raise each kind of toast through the hook */
const Consumer = () => {
    const toast = useToast();

    return (
        <>
            <button onClick={() => toast.success('Saved')}>save</button>
            <button onClick={() => toast.error('Broke')}>fail</button>
            <button onClick={() => toast.info('Heads up')}>inform</button>
            <button onClick={() => toast.success('Gone soon', 1000)}>brief</button>
            <button onClick={() => toast.success('Moved', 5000, { label: 'Open page', onClick: onAction })}>move</button>
        </>
    );
};

const alerts = () => screen.queryAllByRole('alert');

afterEach(() => {
    vi.useRealTimers();
});

describe('ToastManager without a provider', () => {
    // Runs before anything has mounted a ToastInitializer in this file
    it('warns instead of throwing when nothing has registered yet', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        ToastManager.success('nobody listens');
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('ToastManager not initialized'));
        warn.mockRestore();
    });
});

describe('ToastProvider and useToast', () => {
    it('shows a success toast with the message', () => {
        renderWithProviders(<Consumer />);

        fireEvent.click(screen.getByText('save'));

        const alert = screen.getByRole('alert');
        expect(alert.textContent).toContain('Saved');
        expect(alert.className).toContain('MuiAlert-filledSuccess');
    });

    it('shows error and info toasts in their own colours', () => {
        renderWithProviders(<Consumer />);

        fireEvent.click(screen.getByText('fail'));
        fireEvent.click(screen.getByText('inform'));

        const [error, info] = alerts();
        expect(error.textContent).toContain('Broke');
        expect(error.className).toContain('MuiAlert-filledError');
        expect(info.textContent).toContain('Heads up');
        expect(info.className).toContain('MuiAlert-filledInfo');
    });

    it('closes a toast from its close button', async () => {
        renderWithProviders(<Consumer />);
        fireEvent.click(screen.getByText('save'));

        fireEvent.click(screen.getByTitle('Close'));
        await waitFor(() => expect(alerts()).toHaveLength(0));
    });

    it('runs the action of a toast and closes it', async () => {
        renderWithProviders(<Consumer />);
        fireEvent.click(screen.getByText('move'));

        fireEvent.click(screen.getByRole('button', { name: 'Open page' }));
        expect(onAction).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(alerts()).toHaveLength(0));
    });

    it('removes a toast by itself after its duration', () => {
        vi.useFakeTimers();
        renderWithProviders(<Consumer />);
        fireEvent.click(screen.getByText('brief'));
        expect(alerts()).toHaveLength(1);

        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(alerts()).toHaveLength(0);
    });

    it('refuses to be used outside the provider', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        expect(() => render(<Consumer />)).toThrow('useToast must be used within a ToastProvider');
        error.mockRestore();
    });
});

describe('ToastInitializer', () => {
    it('lets code outside React raise toasts through the static manager', () => {
        renderWithProviders(<ToastInitializer />);

        act(() => {
            ToastManager.success('Layout saved');
        });
        expect(screen.getByRole('alert').textContent).toContain('Layout saved');

        act(() => {
            ToastManager.error('Save failed');
            ToastManager.info('Reconnecting');
        });
        const messages = alerts().map(alert => alert.textContent);
        expect(messages.some(text => text?.includes('Save failed'))).toBe(true);
        expect(messages.some(text => text?.includes('Reconnecting'))).toBe(true);
    });

    it('renders nothing of its own', () => {
        const { container } = render(
            <ToastProvider>
                <ToastInitializer />
            </ToastProvider>
        );

        expect(container.innerHTML).toBe('');
    });
});
