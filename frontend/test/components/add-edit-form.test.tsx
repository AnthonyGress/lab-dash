// The add/edit item form, its two step pickers and the hook that fills it from an
// existing item.
import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { renderInForm } from './form-host';
import { adminContext, makeContext, makeItem, makePage, renderWithProviders } from './render';
import { DashApi } from '../../src/api/dash-api';
import { AddEditForm } from '../../src/components/forms/AddEditForm/AddEditForm';
import { WIDGET_OPTIONS } from '../../src/components/forms/AddEditForm/constants';
import { ItemTypeSelector } from '../../src/components/forms/AddEditForm/ItemSelector';
import { FormValues } from '../../src/components/forms/AddEditForm/types';
import { useExistingItem } from '../../src/components/forms/AddEditForm/useExistingItem';
import { WidgetSelector } from '../../src/components/forms/AddEditForm/WidgetSelector';
import { ToastProvider } from '../../src/components/toast/ToastManager';
import { AppContext } from '../../src/context/AppContext';
import { ThemeContextProvider } from '../../src/theme/ThemeContext';
import { DashboardItem, ITEM_TYPE } from '../../src/types';

const MASKED = '**********';

const input = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement;
const type = (field: HTMLInputElement, value: string) => fireEvent.change(field, { target: { value } });
const fileInput = (container: HTMLElement) => container.querySelector('input[type="file"]') as HTMLInputElement;

describe('ItemTypeSelector', () => {
    it('offers the current item types and leaves out the legacy placeholder', () => {
        renderInForm((form) => <ItemTypeSelector formContext={form} setCurrentStep={vi.fn()} />);

        expect(screen.getByText('Choose an Item Type*')).toBeTruthy();
        expect(screen.getByText('Shortcut')).toBeTruthy();
        expect(screen.getByText('Widget')).toBeTruthy();
        expect(screen.getByText('Page')).toBeTruthy();
        expect(screen.getByText('Link to websites, applications, or services')).toBeTruthy();
        expect(screen.queryByText('Placeholder')).toBeNull();
    });

    it('records the chosen type and moves to the matching step', () => {
        const setCurrentStep = vi.fn();
        const { form } = renderInForm((ctx) => <ItemTypeSelector formContext={ctx} setCurrentStep={setCurrentStep} />);

        fireEvent.click(screen.getByText('Widget'));
        expect(form().getValues('itemType')).toBe('widget');
        expect(setCurrentStep).toHaveBeenLastCalledWith('widget-select');

        fireEvent.click(screen.getByText('Page'));
        expect(form().getValues('itemType')).toBe(ITEM_TYPE.PAGE);
        expect(setCurrentStep).toHaveBeenLastCalledWith('configure');
    });
});

describe('WidgetSelector', () => {
    it('lists every widget with its description', () => {
        renderInForm((form) => <WidgetSelector formContext={form} setCurrentStep={vi.fn()} />);

        for (const option of WIDGET_OPTIONS) {
            expect(screen.getByText(option.label)).toBeTruthy();
            // trimmed: the Media Server description carries a trailing space in constants.ts
            expect(screen.getByText(option.description.trim())).toBeTruthy();
        }
    });

    it('stores the picked widget type and goes on to configure it', () => {
        const setCurrentStep = vi.fn();
        const { form } = renderInForm((ctx) => <WidgetSelector formContext={ctx} setCurrentStep={setCurrentStep} />);

        fireEvent.click(screen.getByText('Notes'));

        expect(form().getValues('widgetType')).toBe(ITEM_TYPE.NOTES_WIDGET);
        expect(setCurrentStep).toHaveBeenCalledWith('configure');
    });
});

describe('useExistingItem', () => {
    const value = makeContext();
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ThemeContextProvider>
            <MemoryRouter>
                <ToastProvider>
                    <AppContext.Provider value={value}>{children}</AppContext.Provider>
                </ToastProvider>
            </MemoryRouter>
        </ThemeContextProvider>
    );

    const renderFilled = (existingItem: DashboardItem | null) => {
        const setCustomIconFile = vi.fn();
        const hook = renderHook(() => {
            const formContext = useForm<FormValues>();
            useExistingItem({ existingItem, formContext, setCustomIconFile });
            return formContext;
        }, { wrapper });
        return { ...hook, setCustomIconFile };
    };

    it('fills the form from an existing Pi-hole widget and masks its token', () => {
        const { result, setCustomIconFile } = renderFilled(makeItem(ITEM_TYPE.PIHOLE_WIDGET, {
            label: 'DNS',
            adminOnly: true,
            config: { host: 'pi.hole', port: '80', ssl: true, _hasApiToken: true, displayName: 'Pi' }
        }));

        const values = result.current.getValues();
        expect(values.itemType).toBe('widget');
        expect(values.widgetType).toBe(ITEM_TYPE.PIHOLE_WIDGET);
        expect(values.shortcutName).toBe('DNS');
        expect(values.adminOnly).toBe(true);
        expect(values.piholeHost).toBe('pi.hole');
        expect(values.piholePort).toBe('80');
        expect(values.piholeSsl).toBe(true);
        expect(values.piholeApiToken).toBe(MASKED);
        expect(values.piholePassword).toBe('');
        expect(values.piholeName).toBe('Pi');
        expect(values.showLabel).toBe(true);
        expect(setCustomIconFile).toHaveBeenCalledWith(null);
    });

    it('maps legacy item types onto their current equivalents', () => {
        const torrent = renderFilled(makeItem(ITEM_TYPE.TORRENT_CLIENT, { config: { clientType: 'deluge', _hasPassword: true } }));
        expect(torrent.result.current.getValues('itemType')).toBe('widget');
        expect(torrent.result.current.getValues('widgetType')).toBe(ITEM_TYPE.DOWNLOAD_CLIENT);
        expect(torrent.result.current.getValues('torrentClientType')).toBe('deluge');
        expect(torrent.result.current.getValues('tcPort')).toBe('8112');
        expect(torrent.result.current.getValues('tcPassword')).toBe(MASKED);

        const spacer = renderFilled(makeItem(ITEM_TYPE.BLANK_ROW));
        expect(spacer.result.current.getValues('itemType')).toBe(ITEM_TYPE.PLACEHOLDER);
        expect(spacer.result.current.getValues('placeholderSize')).toBe('row');
    });

    it('starts a new item with blank defaults', () => {
        const { result } = renderFilled(null);

        const values = result.current.getValues();
        expect(values.itemType).toBe('');
        expect(values.widgetType).toBe('');
        expect(values.shortcutName).toBe('');
        expect(values.icon).toBeNull();
        expect(values.showLabel).toBe(false);
        expect(values.sonarrPort).toBe('8989');
        expect(values.mediaServerName).toBe('Jellyfin');
        expect(values.displayName).toBe('Notes');
        expect(values.maxItems).toBe('3');
    });

    it('loads both halves of a dual widget once the reset has settled', async () => {
        const { result } = renderFilled(makeItem(ITEM_TYPE.DUAL_WIDGET, {
            config: {
                topWidget: { type: ITEM_TYPE.PIHOLE_WIDGET, config: { host: 'pi.hole', _hasPassword: true } },
                bottomWidget: { type: ITEM_TYPE.WEATHER_WIDGET, config: { temperatureUnit: 'celsius' } }
            }
        }));

        expect(result.current.getValues('topWidgetType')).toBe(ITEM_TYPE.PIHOLE_WIDGET);
        expect(result.current.getValues('bottomWidgetType')).toBe(ITEM_TYPE.WEATHER_WIDGET);
        await waitFor(() => expect(result.current.getValues('top_piholeHost')).toBe('pi.hole'));
        expect(result.current.getValues('top_piholePassword')).toBe(MASKED);
        expect(result.current.getValues('bottom_temperatureUnit')).toBe('celsius');
    });
});

describe('AddEditForm', () => {
    const renderForm = (props: Partial<Parameters<typeof AddEditForm>[0]> = {}, context = adminContext()) => {
        const handleClose = vi.fn();
        const rendered = renderWithProviders(<AddEditForm handleClose={handleClose} {...props} />, { context });
        return { ...rendered, handleClose };
    };

    it('starts on the item type chooser with no save button', () => {
        renderForm();

        expect(screen.getByText('Choose an Item Type*')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    });

    it('shows the shortcut fields after choosing Shortcut and can go back', async () => {
        renderForm();

        fireEvent.click(screen.getByText('Shortcut'));

        expect(await screen.findByText('Configure Shortcut')).toBeTruthy();
        expect(input(/^Shortcut Name/)).toBeTruthy();
        expect(input(/^URL/)).toBeTruthy();
        expect(screen.getByLabelText('Select Icon*')).toBeTruthy();
        expect(screen.getByRole('checkbox', { name: 'Admin Only' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Back' }));

        expect(await screen.findByText('Choose an Item Type*')).toBeTruthy();
    });

    it('walks through the widget picker to the widget fields', async () => {
        renderForm();

        fireEvent.click(screen.getByText('Widget'));

        expect(await screen.findByText('Select Widget')).toBeTruthy();
        expect(screen.getByText('Pi-hole')).toBeTruthy();

        fireEvent.click(screen.getByText('Weather'));

        expect(await screen.findByText('Configure Weather')).toBeTruthy();
        expect(screen.getByText('Temperature Unit:')).toBeTruthy();
        expect(screen.getByRole('checkbox', { name: 'Admin Only' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Back' }));

        expect(await screen.findByText('Select Widget')).toBeTruthy();
    });

    it('adds a new app shortcut with a custom icon', async () => {
        const { container, context, handleClose } = renderForm();
        fireEvent.click(screen.getByText('Shortcut'));
        await screen.findByText('Configure Shortcut');

        type(input(/^Shortcut Name/), 'NAS');
        type(input(/^URL/), 'http://nas.local');
        const icon = new File(['x'], 'nas.png', { type: 'image/png' });
        fireEvent.change(fileInput(container), { target: { files: [icon] } });
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));

        await waitFor(() => expect(context.addItem).toHaveBeenCalledTimes(1));
        expect(DashApi.uploadAppIcon).toHaveBeenCalledWith(icon);
        expect(context.addItem).toHaveBeenCalledWith(expect.objectContaining({
            label: 'NAS',
            url: 'http://nas.local',
            type: ITEM_TYPE.APP_SHORTCUT,
            icon: { name: 'nas', path: 'blob:test', source: 'custom-pending' },
            adminOnly: false,
            config: undefined
        }));
        await waitFor(() => expect(handleClose).toHaveBeenCalled());
        expect(context.refreshDashboard).toHaveBeenCalled();
    });

    it('refuses a shortcut that is missing its required fields', async () => {
        const { context } = renderForm();
        fireEvent.click(screen.getByText('Shortcut'));
        await screen.findByText('Configure Shortcut');

        type(input(/^URL/), 'nas.local');
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));

        expect(await screen.findByText('Invalid url. Ex "http://192.168.x.x" or "unifi-network://"')).toBeTruthy();
        expect(screen.getAllByText('This field is required').length).toBeGreaterThan(0);
        expect(context.addItem).not.toHaveBeenCalled();
    });

    it('creates a page from the page fields', async () => {
        const { context, handleClose } = renderForm();

        fireEvent.click(screen.getByText('Page'));

        expect(await screen.findByText('Configure Page')).toBeTruthy();
        expect(screen.getByText('Pages are added to the navigation menu')).toBeTruthy();
        type(input(/^Page Name/), 'Media');
        fireEvent.click(screen.getByRole('checkbox', { name: 'Admin Only' }));
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));

        await waitFor(() => expect(context.addPage).toHaveBeenCalledWith('Media', true));
        await waitFor(() => expect(handleClose).toHaveBeenCalled());
        expect(context.addItem).not.toHaveBeenCalled();
    });

    it('rejects a page name that is already taken', async () => {
        const { context } = renderForm({}, adminContext({ pages: [makePage('Media')] }));
        fireEvent.click(screen.getByText('Page'));
        await screen.findByText('Configure Page');

        type(input(/^Page Name/), 'media');
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));

        expect(await screen.findByText('A page named "media" already exists. Please choose a different name.')).toBeTruthy();
        expect(context.addPage).not.toHaveBeenCalled();
    });

    it('opens an existing shortcut on its fields and saves through updateItem', async () => {
        const existing = makeItem(ITEM_TYPE.APP_SHORTCUT, {
            id: 'plex',
            label: 'Plex',
            url: 'http://plex.local',
            icon: { path: 'plex.png', name: 'Plex' },
            showLabel: true
        });
        const { context, handleClose } = renderForm({ existingItem: existing });

        expect(screen.getByText('Configure Shortcut')).toBeTruthy();
        await waitFor(() => expect(input(/^Shortcut Name/).value).toBe('Plex'));
        expect(input(/^URL/).value).toBe('http://plex.local');
        expect(screen.getByAltText('Plex')).toBeTruthy();
        expect((screen.getByRole('checkbox', { name: 'Show Name' }) as HTMLInputElement).checked).toBe(true);
        expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();

        type(input(/^Shortcut Name/), 'Plex Media');
        fireEvent.click(screen.getByRole('button', { name: 'Update' }));

        await waitFor(() => expect(context.updateItem).toHaveBeenCalledWith('plex', expect.objectContaining({
            label: 'Plex Media',
            url: 'http://plex.local',
            type: ITEM_TYPE.APP_SHORTCUT,
            icon: { path: 'plex.png', name: 'Plex', source: '' },
            showLabel: true
        })));
        await waitFor(() => expect(handleClose).toHaveBeenCalled());
        expect(context.addItem).not.toHaveBeenCalled();
    });

    it('edits a page through the onSubmit callback instead of the context', async () => {
        const onSubmit = vi.fn();
        const existing: DashboardItem = { id: 'media-page', type: ITEM_TYPE.PAGE, label: 'Media', adminOnly: false };
        const { context, handleClose } = renderForm({ existingItem: existing, onSubmit });

        expect(screen.getByText('Configure Page')).toBeTruthy();
        await waitFor(() => expect(input(/^Page Name/).value).toBe('Media'));

        type(input(/^Page Name/), 'Movies');
        fireEvent.click(screen.getByRole('button', { name: 'Update' }));

        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ id: 'media-page', label: 'Movies' })));
        expect(handleClose).toHaveBeenCalled();
        expect(context.addPage).not.toHaveBeenCalled();
    });

    it('opens an existing widget on its configuration step', async () => {
        const existing = makeItem(ITEM_TYPE.PIHOLE_WIDGET, { config: { host: 'pi.hole', port: '80', _hasPassword: true } });
        renderForm({ existingItem: existing });

        expect(screen.getByText('Configure Pi-hole')).toBeTruthy();
        await waitFor(() => expect(input(/^Pi-hole Host/).value).toBe('pi.hole'));
        expect(input(/^Password \(Pi-hole v6\)/).value).toBe(MASKED);
        expect(screen.getByRole('button', { name: 'Update' })).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Back' }));

        expect(await screen.findByText('Select Widget')).toBeTruthy();
    });
});
