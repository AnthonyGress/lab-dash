import { act, fireEvent, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './render';
import { StatusIndicator } from '../../src/components/dashboard/base-items/widgets/StatusIndicator';
import { WidgetContainer } from '../../src/components/dashboard/base-items/widgets/WidgetContainer';
import { GlobalCustomScrollbar } from '../../src/components/GlobalCustomScrollbar';
import { lazyComponent, useHasBeenOpen } from '../../src/components/lazy';
import { Logo } from '../../src/components/Logo';
import { RealtimeStatusBanner } from '../../src/components/RealtimeStatusBanner';
import { ScrollToTop } from '../../src/components/ScrollToTop';
import { realtime } from '../../src/realtime/socket';

describe('app shell pieces', () => {
    it('renders the logo with its alt text and size', () => {
        renderWithProviders(<Logo size={24} alt='Lab Dash' />);

        const image = screen.getByAltText('Lab Dash');
        expect(image.tagName).toBe('IMG');
    });

    it('renders the status indicator only for a usable address', () => {
        const { container, rerender } = renderWithProviders(<StatusIndicator itemId='a' url='http://nas.local' />);
        expect(container.querySelector('[class*="MuiBox"]')).not.toBeNull();

        rerender(<StatusIndicator itemId='a' url='not a url' />);
        expect(container.innerHTML).toBe('');
    });

    it('renders a widget container around its children', () => {
        renderWithProviders(
            <WidgetContainer editMode={false} id='w'>
                <span>inside</span>
            </WidgetContainer>
        );

        expect(screen.getByText('inside')).toBeTruthy();
    });

    it('renders the realtime banner and scroll helper without a connection', () => {
        const { container } = renderWithProviders(<><RealtimeStatusBanner /><ScrollToTop /></>);
        expect(container).toBeTruthy();
    });
});

describe('Logo', () => {
    it('falls back to a generic alt text', () => {
        renderWithProviders(<Logo />);

        expect(screen.getByAltText('Logo Icon').tagName).toBe('IMG');
    });
});

describe('GlobalCustomScrollbar', () => {
    const setPageHeight = (height: number) =>
        Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: height });

    afterEach(() => {
        Reflect.deleteProperty(document.documentElement, 'scrollHeight');
    });

    it('renders nothing while the page fits in the window', () => {
        const { container } = renderWithProviders(<GlobalCustomScrollbar />);

        expect(container.innerHTML).toBe('');
    });

    it('shows a track with a thumb sized to the page once it scrolls', () => {
        setPageHeight(window.innerHeight * 4);
        const { container } = renderWithProviders(<GlobalCustomScrollbar />);

        const track = container.firstElementChild as HTMLElement;
        const thumb = track.firstElementChild as HTMLElement;
        expect(thumb).not.toBeNull();
        // A quarter of the window, since the page is four windows tall
        expect(getComputedStyle(thumb).height).toBe(`${window.innerHeight / 4}px`);
        expect(getComputedStyle(track).opacity).toBe('0');

        fireEvent.scroll(window);
        expect(getComputedStyle(track).opacity).toBe('1');
    });
});

describe('RealtimeStatusBanner', () => {
    const setStatus = (status: ReturnType<typeof realtime.getStatus>) => vi.mocked(realtime.getStatus).mockReturnValue(status);
    const banner = () => screen.queryByRole('alert');

    afterEach(() => {
        setStatus('open');
    });

    it('stays quiet while the connection is open', () => {
        setStatus('open');
        renderWithProviders(<RealtimeStatusBanner />);

        expect(banner()).toBeNull();
    });

    it('stays quiet while still connecting', () => {
        setStatus('connecting');
        renderWithProviders(<RealtimeStatusBanner />);

        expect(banner()).toBeNull();
    });

    it('warns about missing WebSocket support when live data is unavailable', () => {
        setStatus('unavailable');
        renderWithProviders(<RealtimeStatusBanner />);

        expect(banner()?.textContent).toContain('Live updates are unavailable');
        expect(banner()?.textContent).toContain('enable WebSocket support');
    });

    it('can be dismissed and comes back if the connection fails again later', async () => {
        setStatus('unavailable');
        renderWithProviders(<RealtimeStatusBanner />);
        const notifyStatusChange = vi.mocked(realtime.onStatus).mock.calls[0][0];

        fireEvent.click(screen.getByTitle('Close'));
        await waitFor(() => expect(banner()).toBeNull());

        act(() => {
            setStatus('open');
            notifyStatusChange();
        });
        expect(banner()).toBeNull();

        act(() => {
            setStatus('unavailable');
            notifyStatusChange();
        });
        expect(banner()?.textContent).toContain('Live updates are unavailable');
    });
});

describe('ScrollToTop', () => {
    // Declared as a bare FC, but the app passes children through it
    const ScrollToTopWithChildren = ScrollToTop;

    it('scrolls to the top on arrival and renders its children', () => {
        const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
        renderWithProviders(<ScrollToTopWithChildren><span>page body</span></ScrollToTopWithChildren>);

        expect(screen.getByText('page body')).toBeTruthy();
        expect(scrollTo).toHaveBeenCalledWith(0, 0);
        scrollTo.mockRestore();
    });

    it('leaves the scroll position alone when the address has a hash', () => {
        const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
        renderWithProviders(<ScrollToTop />, { route: '/#notes' });

        expect(scrollTo).not.toHaveBeenCalled();
        scrollTo.mockRestore();
    });
});

describe('lazyComponent', () => {
    it('shows the fallback until the component has loaded, then the component', async () => {
        const Loaded = ({ name }: { name: string }) => <span>loaded {name}</span>;
        const Lazy = lazyComponent<{ name: string }>(() => Promise.resolve(Loaded), <span>loading…</span>);
        renderWithProviders(<Lazy name='settings' />);

        expect(screen.getByText('loading…')).toBeTruthy();
        expect(await screen.findByText('loaded settings')).toBeTruthy();
        expect(screen.queryByText('loading…')).toBeNull();
    });

    it('renders nothing while loading when no fallback is given', async () => {
        const Loaded = () => <span>ready</span>;
        const Lazy = lazyComponent(() => Promise.resolve(Loaded));
        const { container } = renderWithProviders(<Lazy />);

        expect(container.innerHTML).toBe('');
        expect(await screen.findByText('ready')).toBeTruthy();
    });
});

describe('useHasBeenOpen', () => {
    it('stays true from the first time the modal is opened', () => {
        const { result, rerender } = renderHook(({ open }: { open: boolean }) => useHasBeenOpen(open), {
            initialProps: { open: false }
        });
        expect(result.current).toBe(false);

        rerender({ open: true });
        expect(result.current).toBe(true);

        rerender({ open: false });
        expect(result.current).toBe(true);
    });

    it('is true straight away for a modal that starts open', () => {
        const { result } = renderHook(() => useHasBeenOpen(true));

        expect(result.current).toBe(true);
    });
});
