// The configs that read the host system or combine other configs: disk monitor,
// download client, dual widget and system monitor.
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderInForm } from './form-host';
import { makeItem } from './render';
import { DashApi } from '../../src/api/dash-api';
import { DiskMonitorWidgetConfig } from '../../src/components/forms/configs/DiskMonitorWidgetConfig';
import { DownloadClientWidgetConfig } from '../../src/components/forms/configs/DownloadClientWidgetConfig';
import { DualWidgetConfig } from '../../src/components/forms/configs/DualWidgetConfig';
import { SystemMonitorWidgetConfig } from '../../src/components/forms/configs/SystemMonitorWidgetConfig';
import { DOWNLOAD_CLIENT_TYPE, ITEM_TYPE } from '../../src/types';

const GB = 1024 ** 3;
const MASKED = '**********';

const input = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement;
const checkbox = (name: string) => screen.getByRole('checkbox', { name }) as HTMLInputElement;
const radio = (name: string) => screen.getByRole('radio', { name }) as HTMLInputElement;

const disk = (mount: string, sizeGb: number) => ({
    fs: `/dev/${mount.replace(/\W/g, '') || 'root'}`,
    type: 'ext4',
    size: sizeGb * GB,
    used: 0,
    available: sizeGb * GB,
    use: 0,
    mount
});

describe('DiskMonitorWidgetConfig', () => {
    it('reports when the host has no disks to monitor', async () => {
        renderInForm((form) => <DiskMonitorWidgetConfig formContext={form} />);

        expect(screen.getByText('Layout & Disk Selection')).toBeTruthy();
        expect(screen.getByRole('combobox', { name: /Layout/ })).toBeTruthy();
        expect(checkbox('Show Disk Icons')).toBeTruthy();
        expect(checkbox('Show Name')).toBeTruthy();

        expect(await screen.findByText('No disks available for monitoring')).toBeTruthy();
        expect(screen.getByText('At least one disk must be selected')).toBeTruthy();
        expect(DashApi.getSystemInformation).toHaveBeenCalled();
    });

    it('lists the detected disks, picks the two largest and lets another be added', async () => {
        vi.mocked(DashApi.getSystemInformation).mockResolvedValueOnce({
            disk: [disk('/home', 200), disk('/', 500), disk('/mnt/data', 100)]
        });
        const { form } = renderInForm((ctx) => <DiskMonitorWidgetConfig formContext={ctx} />, {
            defaultValues: { layout: '2x2' }
        });

        expect(await screen.findByRole('button', { name: 'Add Disk (2/4)' })).toBeTruthy();
        // The per-disk selects carry no accessible name (the InputLabel and Select are not
        // linked), so the visible label and the chosen disk are what can be checked
        expect(screen.getAllByText('Disk 1').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Disk 2').length).toBeGreaterThan(0);
        expect(screen.getByText('Root (500.0 GB)')).toBeTruthy();
        expect(screen.getByText('Home (200.0 GB)')).toBeTruthy();
        const names = screen.getAllByLabelText('Custom Name') as HTMLInputElement[];
        expect(names.map((field) => field.value)).toEqual(['Root', 'Home']);
        expect(screen.getAllByRole('checkbox', { name: 'Show Mount Path' })).toHaveLength(2);

        fireEvent.click(screen.getByRole('button', { name: 'Add Disk (2/4)' }));

        expect(await screen.findByRole('button', { name: 'Add Disk (3/4)' })).toBeTruthy();
        expect(form().getValues('selectedDisks')).toEqual([
            { mount: '/', customName: 'Root', showMountPath: false },
            { mount: '/home', customName: 'Home', showMountPath: false },
            { mount: '/mnt/data', customName: 'data', showMountPath: false }
        ]);
    });

    it('hides the layout picker when it is part of a dual widget', async () => {
        renderInForm((form) => <DiskMonitorWidgetConfig formContext={form} fieldNamePrefix='top_' />);

        expect(screen.queryByRole('combobox', { name: /Layout/ })).toBeNull();
        expect(checkbox('Show Disk Icons')).toBeTruthy();
        expect(await screen.findByText('No disks available for monitoring')).toBeTruthy();
    });
});

describe('DownloadClientWidgetConfig', () => {
    it('renders the client radios with the qBittorrent login fields', async () => {
        renderInForm((form) => <DownloadClientWidgetConfig formContext={form} />, {
            defaultValues: { torrentClientType: DOWNLOAD_CLIENT_TYPE.QBITTORRENT }
        });

        expect(screen.getByText('Select Download Client:')).toBeTruthy();
        for (const name of ['qBittorrent', 'Deluge', 'Transmission', 'SABnzbd', 'NZBGet']) {
            expect(radio(name)).toBeTruthy();
        }
        expect(radio('qBittorrent').checked).toBe(true);
        expect(input(/^Host/)).toBeTruthy();
        expect(input(/^Username/).required).toBe(true);
        expect(input(/^Password/).required).toBe(true);
        expect(checkbox('Use SSL')).toBeTruthy();
        expect(checkbox('Show Name')).toBeTruthy();

        await waitFor(() => expect(input(/^Port/).value).toBe('8080'));
    });

    it('asks for an API key instead of a login once SABnzbd is picked', async () => {
        renderInForm((form) => <DownloadClientWidgetConfig formContext={form} />, {
            defaultValues: { torrentClientType: DOWNLOAD_CLIENT_TYPE.QBITTORRENT }
        });

        fireEvent.click(radio('SABnzbd'));

        expect(await screen.findByLabelText(/^API Key/)).toBeTruthy();
        expect(screen.queryByLabelText(/^Username/)).toBeNull();
        expect(screen.queryByLabelText(/^Password/)).toBeNull();
    });

    it('moves to the default port of the chosen client', async () => {
        renderInForm((form) => <DownloadClientWidgetConfig formContext={form} />, {
            defaultValues: { torrentClientType: DOWNLOAD_CLIENT_TYPE.QBITTORRENT }
        });

        fireEvent.click(radio('Deluge'));

        await waitFor(() => expect(input(/^Port/).value).toBe('8112'));
    });

    it('keeps the masked password of an existing client and stops requiring it', async () => {
        const existing = makeItem(ITEM_TYPE.DOWNLOAD_CLIENT, { config: { clientType: 'qbittorrent', _hasPassword: true } });
        renderInForm((form) => <DownloadClientWidgetConfig formContext={form} existingItem={existing} />, {
            defaultValues: { torrentClientType: DOWNLOAD_CLIENT_TYPE.QBITTORRENT, tcPassword: MASKED, tcPort: '9000' }
        });

        await waitFor(() => expect(input(/^Password/).required).toBe(false));
        expect(input(/^Password/).value).toBe(MASKED);
        expect(input(/^Port/).value).toBe('9000');
    });
});

describe('DualWidgetConfig', () => {
    it('renders the top and bottom tabs with a widget type picker', () => {
        renderInForm((form) => <DualWidgetConfig formContext={form} />);

        expect(screen.getByRole('tab', { name: 'Top Widget' }).getAttribute('aria-selected')).toBe('true');
        expect(screen.getByRole('tab', { name: 'Bottom Widget' })).toBeTruthy();
        expect(screen.getByRole('combobox', { name: /Widget Type/ })).toBeTruthy();
    });

    it('shows the fields of the chosen top widget and switches to the bottom tab', async () => {
        renderInForm((form) => <DualWidgetConfig formContext={form} />, {
            defaultValues: { topWidgetType: ITEM_TYPE.DATE_TIME_WIDGET, bottomWidgetType: '' }
        });

        expect(await screen.findByRole('checkbox', { name: 'Use 24-hour format' })).toBeTruthy();
        expect(screen.getByText('Date & Time')).toBeTruthy();

        fireEvent.click(screen.getByRole('tab', { name: 'Bottom Widget' }));

        await waitFor(() => expect(screen.getByRole('tab', { name: 'Bottom Widget' }).getAttribute('aria-selected')).toBe('true'));
        expect(screen.queryByRole('checkbox', { name: 'Use 24-hour format' })).toBeNull();
        expect(screen.getByRole('combobox', { name: /Widget Type/ })).toBeTruthy();
    });

    it('offers the bottom widget types and shows the weather fields when chosen', async () => {
        renderInForm((form) => <DualWidgetConfig formContext={form} />, {
            defaultValues: { topWidgetType: '', bottomWidgetType: '' }
        });

        fireEvent.click(screen.getByRole('tab', { name: 'Bottom Widget' }));
        await screen.findByRole('combobox', { name: /Widget Type/ });

        fireEvent.mouseDown(screen.getByRole('combobox', { name: /Widget Type/ }));
        const listbox = await screen.findByRole('listbox');
        expect(within(listbox).getAllByRole('option').map((option) => option.textContent)).toEqual([
            'Date & Time', 'Weather', 'System Monitor', 'Disk Monitor', 'Pi-hole', 'AdGuard Home'
        ]);
        fireEvent.click(within(listbox).getByRole('option', { name: 'Weather' }));

        // The wrapper draws its own unit radios and hides the inner config's copy with CSS,
        // so the heading is in the DOM twice
        expect((await screen.findAllByText('Temperature Unit:')).length).toBeGreaterThan(0);
        expect(screen.getByRole('radio', { name: 'Fahrenheit (°F)' })).toBeTruthy();
        expect(screen.getByLabelText('Search location')).toBeTruthy();
    });

    it('loads the saved top widget of an existing dual widget', async () => {
        const existing = makeItem(ITEM_TYPE.DUAL_WIDGET, {
            config: {
                topWidget: { type: ITEM_TYPE.PIHOLE_WIDGET, config: { host: 'pi.hole', port: '8080', _hasPassword: true } },
                bottomWidget: { type: ITEM_TYPE.WEATHER_WIDGET, config: { temperatureUnit: 'celsius' } }
            }
        });
        const { form } = renderInForm((ctx) => <DualWidgetConfig formContext={ctx} existingItem={existing} />, {
            defaultValues: { topWidgetType: ITEM_TYPE.PIHOLE_WIDGET, bottomWidgetType: ITEM_TYPE.WEATHER_WIDGET }
        });

        await waitFor(() => expect(input(/^Pi-hole Host/).value).toBe('pi.hole'));
        expect(input(/^Port/).value).toBe('8080');
        expect(input(/^Password \(Pi-hole v6\)/).value).toBe(MASKED);
        expect(form().getValues('bottom_temperatureUnit')).toBe('celsius');
    });
});

describe('SystemMonitorWidgetConfig', () => {
    it('renders the gauge selects and display toggles', () => {
        renderInForm((form) => <SystemMonitorWidgetConfig formContext={form} />, {
            defaultValues: { temperatureUnit: 'fahrenheit', gauge1: 'cpu', gauge2: 'temp', gauge3: 'ram' }
        });

        expect(screen.getByText('Temperature Unit:')).toBeTruthy();
        expect(radio('Fahrenheit (°F)').checked).toBe(true);
        expect(screen.getByRole('combobox', { name: /Left Gauge/ }).textContent).toBe('CPU Usage');
        expect(screen.getByRole('combobox', { name: /Middle Gauge/ }).textContent).toBe('CPU Temperature');
        expect(screen.getByRole('combobox', { name: /Right Gauge/ }).textContent).toBe('RAM Usage');
        expect(screen.getByText('Display Options')).toBeTruthy();
        for (const name of ['Show Disk Usage', 'Show System Info Button', 'Show Internet Status', 'Show IP in Tooltip']) {
            expect(checkbox(name)).toBeTruthy();
        }
        expect(screen.queryByRole('combobox', { name: /Network Interface/ })).toBeNull();
        expect(screen.queryByRole('combobox', { name: /IP Display Type/ })).toBeNull();
    });

    it('offers the host network interfaces once a network gauge is chosen', async () => {
        vi.mocked(DashApi.getSystemInformation).mockResolvedValue({
            networkInterfaces: [{ iface: 'eth0' }, { iface: 'wlan0' }],
            network: { iface: 'wlan0' }
        });
        try {
            const { form } = renderInForm((ctx) => <SystemMonitorWidgetConfig formContext={ctx} />, {
                defaultValues: { gauge1: 'network', gauge2: 'temp', gauge3: 'ram' }
            });

            const select = await screen.findByRole('combobox', { name: /Network Interface/ });
            await waitFor(() => expect(select.textContent).toBe('wlan0'));
            expect(form().getValues('networkInterface')).toBe('wlan0');
        } finally {
            vi.mocked(DashApi.getSystemInformation).mockImplementation(() => Promise.resolve(null));
        }
    });

    it('shows the IP display type once the IP tooltip is enabled', async () => {
        renderInForm((form) => <SystemMonitorWidgetConfig formContext={form} />, {
            defaultValues: { gauge1: 'cpu', gauge2: 'temp', gauge3: 'ram', showIP: false, ipDisplayType: 'wan' }
        });

        fireEvent.click(checkbox('Show IP in Tooltip'));

        const select = await screen.findByRole('combobox', { name: /IP Display Type/ });
        expect(select.textContent).toBe('WAN (Public IP)');
    });
});
