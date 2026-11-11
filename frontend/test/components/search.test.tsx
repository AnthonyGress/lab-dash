import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';

import { emptyConfig, makeItem, makePage, renderWithProviders } from './render';
import { GlobalSearch } from '../../src/components/search/GlobalSearch';
import { SearchBar, SearchOption } from '../../src/components/search/SearchBar';
import { ITEM_TYPE } from '../../src/types';

/** The search bar is controlled; this owns its value the way GlobalSearch does */
const Controlled = ({ options, placeholder }: { options?: SearchOption[]; placeholder?: string }) => {
    const [value, setValue] = useState('');

    return <SearchBar placeholder={placeholder} searchValue={value} setSearchValue={setValue} autocompleteOptions={options} />;
};

const options: SearchOption[] = [
    { label: 'Plex', url: 'http://plex.local' },
    { label: 'Sonarr', url: 'http://sonarr.local' }
];

const input = () => screen.getByRole('combobox') as HTMLInputElement;
const type = (text: string) => fireEvent.change(input(), { target: { value: text } });
const option = (name: string) => screen.findByRole('option', { name });

let openWindow: MockInstance;

beforeEach(() => {
    openWindow = vi.spyOn(window, 'open').mockImplementation(() => null);
});

afterEach(() => {
    openWindow.mockRestore();
});

describe('SearchBar', () => {
    it('names the default search provider in its placeholder', () => {
        renderWithProviders(<Controlled />);

        expect(screen.getByPlaceholderText('Search with Google')).toBeTruthy();
    });

    it('names the configured search provider instead', () => {
        renderWithProviders(<Controlled />, {
            context: { config: emptyConfig({ searchProvider: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q={query}' } }) }
        });

        expect(screen.getByPlaceholderText('Search with DuckDuckGo')).toBeTruthy();
    });

    it('uses the placeholder it is given', () => {
        renderWithProviders(<Controlled placeholder='Search...' />);

        expect(screen.getByPlaceholderText('Search...')).toBeTruthy();
    });

    it('suggests the items whose name contains the typed text', async () => {
        renderWithProviders(<Controlled options={options} />);

        type('pl');

        expect(await option('Plex')).toBeTruthy();
        expect(screen.queryByRole('option', { name: 'Sonarr' })).toBeNull();
    });

    it('offers a web search when nothing matches', async () => {
        renderWithProviders(<Controlled options={options} />);

        type('zzz');

        expect(await option('Search Google for "zzz"')).toBeTruthy();
    });

    it('opens the first matching item on Enter and clears the field', () => {
        renderWithProviders(<Controlled options={options} />);

        type('son');
        fireEvent.keyDown(input(), { key: 'Enter' });

        expect(openWindow).toHaveBeenCalledWith('http://sonarr.local', '_blank', 'noopener,noreferrer');
        // Once: the Autocomplete reports the same Enter as a change, which must not open a second window
        expect(openWindow).toHaveBeenCalledTimes(1);
        expect(input().value).toBe('');
    });

    it('searches the web on Enter when nothing matches', () => {
        renderWithProviders(<Controlled options={options} />);

        type('zzz top');
        fireEvent.keyDown(input(), { key: 'Enter' });

        expect(openWindow).toHaveBeenCalledWith('https://www.google.com/search?q=zzz%20top', '_blank', 'noopener,noreferrer');
        expect(openWindow).toHaveBeenCalledTimes(1);
    });

    it('opens an item when its suggestion is clicked', async () => {
        renderWithProviders(<Controlled options={options} />);

        type('pl');
        fireEvent.click(await option('Plex'));

        expect(openWindow).toHaveBeenCalledWith('http://plex.local', '_blank', 'noopener,noreferrer');
    });
});

describe('GlobalSearch', () => {
    const plex = makeItem(ITEM_TYPE.APP_SHORTCUT, { id: 'plex', label: 'Plex', url: 'http://plex.local' });
    const tools = makeItem(ITEM_TYPE.GROUP_WIDGET, {
        id: 'tools',
        label: 'Tools',
        config: { items: [{ id: 'portainer', name: 'Portainer', url: 'http://portainer.local' }] }
    });
    const torrents = makeItem(ITEM_TYPE.TORRENT_CLIENT, {
        id: 'qbit',
        label: 'qBittorrent',
        url: 'ignored',
        config: { host: 'nas.local', port: '8080', ssl: true }
    });
    const media = makePage('Media', {
        layout: {
            desktop: [makeItem(ITEM_TYPE.APP_SHORTCUT, { id: 'd', label: 'Desktop only', url: 'http://d.local' })],
            mobile: [makeItem(ITEM_TYPE.APP_SHORTCUT, { id: 'm', label: 'Mobile only', url: 'http://m.local' })]
        }
    });

    it('searches the dashboard items and the shortcuts inside groups', async () => {
        renderWithProviders(<GlobalSearch />, { context: { dashboardLayout: [plex, tools] } });

        expect(screen.getByPlaceholderText('Search...')).toBeTruthy();
        type('p');

        expect(await option('Plex')).toBeTruthy();
        expect(screen.getByRole('option', { name: 'Portainer' })).toBeTruthy();
        expect(screen.queryByRole('option', { name: 'Tools' })).toBeNull();
    });

    it('builds the address of a torrent client from its connection settings', async () => {
        renderWithProviders(<GlobalSearch />, { context: { dashboardLayout: [torrents] } });

        type('qbit');
        fireEvent.click(await option('qBittorrent'));

        expect(openWindow).toHaveBeenCalledWith('https://nas.local:8080', '_blank', 'noopener,noreferrer');
    });

    it('includes the other pages while on the home page, using the desktop layouts', async () => {
        renderWithProviders(<GlobalSearch />, { context: { dashboardLayout: [plex], pages: [media] } });

        type('only');

        expect(await option('Desktop only')).toBeTruthy();
        expect(screen.queryByRole('option', { name: 'Mobile only' })).toBeNull();
    });

    it('uses the mobile layouts of the other pages on a small screen', async () => {
        const desktopMatchMedia = window.matchMedia;
        window.matchMedia = (query: string) => ({ ...desktopMatchMedia(query), matches: query.includes('max-width') });

        try {
            renderWithProviders(<GlobalSearch />, { context: { dashboardLayout: [plex], pages: [media] } });
            type('only');

            expect(await option('Mobile only')).toBeTruthy();
            expect(screen.queryByRole('option', { name: 'Desktop only' })).toBeNull();
        } finally {
            window.matchMedia = desktopMatchMedia;
        }
    });

    it('searches only the current page away from home', async () => {
        renderWithProviders(<GlobalSearch />, { context: { dashboardLayout: [plex], pages: [media] }, route: '/media' });

        type('o');

        expect(await option('Search Google for "o"')).toBeTruthy();
        expect(screen.queryByRole('option', { name: 'Desktop only' })).toBeNull();
    });

    it('focuses the field on Ctrl+K', () => {
        renderWithProviders(<GlobalSearch />);
        expect(document.activeElement).not.toBe(input());

        fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

        expect(document.activeElement).toBe(input());
    });
});
