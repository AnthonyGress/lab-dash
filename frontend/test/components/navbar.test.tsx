import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { adminContext, emptyConfig, makeItem, makePage, renderWithProviders } from './render';
import { DashApi } from '../../src/api/dash-api';
import { ResponsiveAppBar } from '../../src/components/navbar/ResponsiveAppBar';
import { WithNav } from '../../src/components/navbar/WithNav';
import { WithoutNav } from '../../src/components/navbar/WithoutNav';
import { ToastInitializer } from '../../src/components/toast/ToastInitializer';
import { realtime } from '../../src/realtime/socket';
import { ITEM_TYPE } from '../../src/types';
import { getAppVersion } from '../../src/utils/version';

/** Shows where the router is, so navigation from the menu can be seen */
const Location = () => <span data-testid='location'>{useLocation().pathname}</span>;
const location = () => screen.getByTestId('location').textContent;

const openMenu = () => fireEvent.click(screen.getByTestId('MenuIcon').closest('button')!);
const toolbarButtons = () => screen.getAllByRole('button');

/** What the server last pushed on a live stream (see setup.ts) */
const pushLive = (topic: string, state: unknown) =>
    (realtime as unknown as { __setState: (topic: string, itemId: string | undefined, state: unknown) => void })
        .__setState(topic, undefined, state);

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('ResponsiveAppBar', () => {
    it('shows the dashboard title and offers a guest the login entry', () => {
        renderWithProviders(<ResponsiveAppBar><Location /></ResponsiveAppBar>);
        expect(screen.getAllByText('Lab Dash').length).toBeGreaterThan(0);

        openMenu();
        expect(screen.getByText('Home')).toBeTruthy();
        expect(screen.getByText('Donate')).toBeTruthy();
        expect(screen.getByText('Version')).toBeTruthy();
        expect(screen.getByText(`v${getAppVersion()}`)).toBeTruthy();
        expect(screen.queryByText('Edit Dashboard')).toBeNull();
        expect(screen.queryByText('Settings')).toBeNull();
        expect(screen.queryByText('Logout')).toBeNull();
        expect(screen.queryByTestId('AddIcon')).toBeNull();

        fireEvent.click(screen.getByText('Login'));
        expect(location()).toBe('/login');
    });

    it('shows the configured title instead of the default', () => {
        renderWithProviders(<ResponsiveAppBar><span /></ResponsiveAppBar>, { context: { config: emptyConfig({ title: 'Home Lab' }) } });

        expect(screen.getAllByText('Home Lab').length).toBeGreaterThan(0);
        expect(screen.queryByText('Lab Dash')).toBeNull();
    });

    it('gives an administrator the edit, settings and account entries', () => {
        const { context } = renderWithProviders(<ResponsiveAppBar><Location /></ResponsiveAppBar>, { context: adminContext() });

        openMenu();
        expect(screen.getByText('Settings')).toBeTruthy();
        expect(screen.getByText('admin')).toBeTruthy();
        expect(screen.getByText('Administrator')).toBeTruthy();
        expect(screen.getByText('Logout')).toBeTruthy();
        expect(screen.queryByText('Login')).toBeNull();

        fireEvent.click(screen.getByText('Edit Dashboard'));
        expect(context.setEditMode).toHaveBeenCalledWith(true);
    });

    it('logs out and says so', async () => {
        const { context } = renderWithProviders(
            <ResponsiveAppBar><ToastInitializer /><Location /></ResponsiveAppBar>,
            { context: adminContext(), route: '/settings' }
        );

        openMenu();
        fireEvent.click(screen.getByText('Logout'));

        await waitFor(() => expect(location()).toBe('/'));
        expect(DashApi.logout).toHaveBeenCalledTimes(1);
        expect(context.setIsLoggedIn).toHaveBeenCalledWith(false);
        expect(context.setIsAdmin).toHaveBeenCalledWith(false);
        expect((await screen.findByRole('alert')).textContent).toContain('Logged out');
    });

    it('shows Done and Add Item while editing and saves the layout from Done', () => {
        const layout = [makeItem(ITEM_TYPE.APP_SHORTCUT)];
        const { context } = renderWithProviders(<ResponsiveAppBar><span /></ResponsiveAppBar>, {
            context: adminContext({ editMode: true, dashboardLayout: layout })
        });

        // One for wide screens, one for phones
        expect(screen.getAllByText('Done')).toHaveLength(2);
        expect(screen.getByLabelText('Add Item')).toBeTruthy();

        fireEvent.click(screen.getAllByText('Done')[0]);
        expect(context.setEditMode).toHaveBeenCalledWith(false);
        expect(context.saveLayout).toHaveBeenCalledWith(layout);
    });

    it('opens the add item form from the plus button', async () => {
        renderWithProviders(<ResponsiveAppBar><span /></ResponsiveAppBar>, { context: adminContext({ editMode: true }) });

        fireEvent.click(screen.getByLabelText('Add Item'));

        expect(await screen.findByText('Add Item')).toBeTruthy();
    });

    it('lists the pages in the menu and navigates to one', () => {
        renderWithProviders(<ResponsiveAppBar><Location /></ResponsiveAppBar>, {
            context: { pages: [makePage('Media'), makePage('Home Lab')] }
        });

        openMenu();
        expect(screen.getByText('Media')).toBeTruthy();
        fireEvent.click(screen.getByText('Home Lab'));

        expect(location()).toBe('/home-lab');
    });

    it('lets an administrator in edit mode delete a page from the menu', () => {
        const { context } = renderWithProviders(<ResponsiveAppBar><span /></ResponsiveAppBar>, {
            context: adminContext({ editMode: true, pages: [makePage('Media')] })
        });

        openMenu();
        const row = screen.getByText('Media').closest('li')!;
        // The row itself, then its edit and delete buttons
        const [, , remove] = within(row).getAllByRole('button');
        fireEvent.click(remove);

        expect(context.deletePage).toHaveBeenCalledWith('media-page');
    });

    it('flags an available update and opens its details for a signed-in user', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) })));
        renderWithProviders(<ResponsiveAppBar><span /></ResponsiveAppBar>, {
            context: adminContext({ updateAvailable: true, latestVersion: 'v9.9.9' })
        });

        openMenu();
        expect(screen.getByText('Version v9.9.9')).toBeTruthy();
        fireEvent.click(screen.getByText('Update Available'));

        expect(await screen.findByText('A new version is available: v9.9.9')).toBeTruthy();
    });

    it('points out a recent update and opens the release notes', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) })));
        renderWithProviders(<ResponsiveAppBar><span /></ResponsiveAppBar>, { context: { recentlyUpdated: true } });

        openMenu();
        expect(screen.queryByText('Version')).toBeNull();
        fireEvent.click(screen.getByText('Recently Updated'));

        expect(await screen.findByText(`Current Version: ${getAppVersion()}`)).toBeTruthy();
    });

    it('shows the global search when enabled, but not on the settings screen', () => {
        const search = { config: emptyConfig({ search: true }) };
        const { unmount } = renderWithProviders(<ResponsiveAppBar><span /></ResponsiveAppBar>, { context: search });
        // One for wide screens, one for phones
        expect(screen.getAllByPlaceholderText('Search...')).toHaveLength(2);
        unmount();

        renderWithProviders(<ResponsiveAppBar><span /></ResponsiveAppBar>, { context: search, route: '/settings' });
        expect(screen.queryByPlaceholderText('Search...')).toBeNull();
    });

    it('reports the internet connection and the addresses in its tooltip', async () => {
        pushLive('internet.status', { data: { status: 'online' } });
        vi.mocked(DashApi.getIPAddresses).mockResolvedValueOnce({ wan: '203.0.113.7', lan: '10.0.0.5' });
        renderWithProviders(<ResponsiveAppBar><span /></ResponsiveAppBar>, {
            context: { config: emptyConfig({ showIP: true, ipDisplayType: 'both' }) }
        });

        // The globe sits before the menu button
        const [globe, menu] = toolbarButtons();
        expect(within(menu).getByTestId('MenuIcon')).toBeTruthy();
        fireEvent.click(globe);

        expect(await screen.findByText('Internet Connected')).toBeTruthy();
        expect(await screen.findByText('203.0.113.7')).toBeTruthy();
        expect(screen.getByText('WAN:')).toBeTruthy();
        expect(screen.getByText('LAN:')).toBeTruthy();
        expect(screen.getByText('10.0.0.5')).toBeTruthy();
    });

    it('leaves out the internet indicator when it is turned off', () => {
        renderWithProviders(<ResponsiveAppBar><span /></ResponsiveAppBar>, {
            context: { config: emptyConfig({ showInternetIndicator: false }) }
        });

        expect(toolbarButtons()).toHaveLength(1);
    });
});

describe('WithNav', () => {
    const routes = (
        <Routes>
            <Route element={<WithNav />}>
                <Route path='/' element={<p>home content</p>} />
                <Route path='/settings' element={<p>settings content</p>} />
            </Route>
        </Routes>
    );

    it('wraps the routed page in the app bar', () => {
        renderWithProviders(routes);

        expect(screen.getByText('home content')).toBeTruthy();
        expect(screen.getAllByText('Lab Dash').length).toBeGreaterThan(0);
    });

    it('sends a guest away from the settings route', async () => {
        renderWithProviders(routes, { route: '/settings' });

        expect(await screen.findByText('home content')).toBeTruthy();
        expect(screen.queryByText('settings content')).toBeNull();
    });

    it('lets an administrator stay on the settings route', () => {
        renderWithProviders(routes, { route: '/settings', context: adminContext() });

        expect(screen.getByText('settings content')).toBeTruthy();
    });
});

describe('WithoutNav', () => {
    it('renders the routed page with no app bar', () => {
        renderWithProviders(
            <Routes>
                <Route element={<WithoutNav />}>
                    <Route path='/' element={<p>bare content</p>} />
                </Route>
            </Routes>
        );

        expect(screen.getByText('bare content')).toBeTruthy();
        expect(screen.queryByText('Lab Dash')).toBeNull();
        expect(screen.queryByTestId('MenuIcon')).toBeNull();
    });
});
