import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderInForm } from './form-host';
import { makeItem } from './render';
import { DashApi } from '../../src/api/dash-api';
import { AdGuardWidgetConfig } from '../../src/components/forms/configs/AdGuardWidgetConfig';
import { AppShortcutConfig } from '../../src/components/forms/configs/AppShortcutConfig';
import { DateTimeWidgetConfig } from '../../src/components/forms/configs/DateTimeWidgetConfig';
import { GroupWidgetConfig } from '../../src/components/forms/configs/GroupWidgetConfig';
import { MediaRequestManagerWidgetConfig } from '../../src/components/forms/configs/MediaRequestManagerWidgetConfig';
import { MediaServerWidgetConfig } from '../../src/components/forms/configs/MediaServerWidgetConfig';
import { NotesWidgetConfig } from '../../src/components/forms/configs/NotesWidgetConfig';
import { PiholeWidgetConfig } from '../../src/components/forms/configs/PiholeWidgetConfig';
import { PlaceholderConfig } from '../../src/components/forms/configs/PlaceholderConfig';
import { QueueManagementWidgetConfig } from '../../src/components/forms/configs/QueueManagementWidgetConfig';
import { RadarrWidgetConfig } from '../../src/components/forms/configs/RadarrWidgetConfig';
import { SonarrWidgetConfig } from '../../src/components/forms/configs/SonarrWidgetConfig';
import { WeatherWidgetConfig } from '../../src/components/forms/configs/WeatherWidgetConfig';
import { WidgetConfig } from '../../src/components/forms/configs/WidgetConfig';
import { ITEM_TYPE } from '../../src/types';

const MASKED = '**********';

const input = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement;
const checkbox = (name: string) => screen.getByRole('checkbox', { name }) as HTMLInputElement;
const radio = (name: string) => screen.getByRole('radio', { name }) as HTMLInputElement;

/** Opens a MUI Select (rendered in a portal) and picks the option with the given label. */
const pickOption = (selectName: RegExp, optionLabel: string) => {
    fireEvent.mouseDown(screen.getByRole('combobox', { name: selectName }));
    fireEvent.click(screen.getByRole('option', { name: optionLabel }));
};

describe('AdGuardWidgetConfig', () => {
    it('renders the AdGuard connection and credential fields for a new widget', () => {
        renderInForm((form) => <AdGuardWidgetConfig formContext={form} />);

        expect(input(/^AdGuard Home Host/)).toBeTruthy();
        expect(input(/^Port/).placeholder).toBe('3000');
        expect(input('Display Name').placeholder).toBe('AdGuard Home');
        expect(input(/^Username/)).toBeTruthy();
        expect(input(/^Password/).type).toBe('password');
        expect(checkbox('Use SSL').checked).toBe(false);
        expect(checkbox('Show Name')).toBeTruthy();
    });

    it('masks the stored credentials of an existing AdGuard widget', async () => {
        const existing = makeItem(ITEM_TYPE.ADGUARD_WIDGET, { config: { _hasUsername: true, _hasPassword: true } });
        renderInForm((form) => <AdGuardWidgetConfig formContext={form} existingItem={existing} />);

        await waitFor(() => expect(input(/^Username/).value).toBe(MASKED));
        expect(input(/^Password/).value).toBe(MASKED);
    });
});

describe('AppShortcutConfig', () => {
    it('renders the shortcut fields with the health check and icon picker', async () => {
        renderInForm((form) => <AppShortcutConfig formContext={form} onCustomIconSelect={() => undefined} />);

        expect(input(/^Shortcut Name/)).toBeTruthy();
        expect(input(/^URL/)).toBeTruthy();
        expect(screen.getByRole('combobox', { name: /Health Check Type/ })).toBeTruthy();
        expect(input('Health Check URL')).toBeTruthy();
        expect(screen.getByLabelText('Select Icon*')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Select Custom Icon' })).toBeTruthy();
        expect(checkbox('Wake-on-LAN').checked).toBe(false);
        expect(checkbox('Show Name')).toBeTruthy();
        expect(checkbox('Admin Only')).toBeTruthy();

        await waitFor(() => expect(DashApi.getIconList).toHaveBeenCalled());
        expect(DashApi.getCustomIcons).toHaveBeenCalled();
    });

    it('swaps the URL fields for Wake-on-LAN fields when the box is ticked', async () => {
        renderInForm((form) => <AppShortcutConfig formContext={form} onCustomIconSelect={() => undefined} />);

        fireEvent.click(checkbox('Wake-on-LAN'));

        expect(await screen.findByLabelText(/^MAC Address/)).toBeTruthy();
        expect(input('Broadcast Address (Optional)')).toBeTruthy();
        expect(input('Port (Optional)')).toBeTruthy();
        expect(screen.queryByLabelText(/^URL/)).toBeNull();
        expect(screen.queryByLabelText('Health Check URL')).toBeNull();
    });

    it('relabels the health check field when the ping type is chosen', async () => {
        renderInForm((form) => <AppShortcutConfig formContext={form} onCustomIconSelect={() => undefined} />, {
            defaultValues: { healthCheckType: 'http' }
        });

        pickOption(/Health Check Type/, 'Ping Host');

        expect(await screen.findByLabelText('Hostname or IP Address')).toBeTruthy();
        expect(screen.queryByLabelText('Health Check URL')).toBeNull();
    });
});

describe('DateTimeWidgetConfig', () => {
    it('renders the location search and the 24-hour toggle', () => {
        renderInForm((form) => <DateTimeWidgetConfig formContext={form} />);

        expect(input('Search location')).toBeTruthy();
        expect(screen.getByText('Enter a zip code or city')).toBeTruthy();
        expect(checkbox('Use 24-hour format').checked).toBe(false);
    });

    it('binds its fields under a position prefix for the dual widget', () => {
        renderInForm((form) => <DateTimeWidgetConfig formContext={form} fieldNamePrefix='top_' />, {
            defaultValues: { top_use24Hour: true }
        });

        expect(checkbox('Use 24-hour format').checked).toBe(true);
    });
});

describe('GroupWidgetConfig', () => {
    it('renders the group name, layout and show-name fields', () => {
        renderInForm((form) => <GroupWidgetConfig formContext={form} />, { defaultValues: { maxItems: '3' } });

        expect(input(/^Group Name/)).toBeTruthy();
        expect(screen.getByRole('combobox', { name: /Layout/ })).toBeTruthy();
        expect(screen.getByText('3 Items (3x1)')).toBeTruthy();
        expect(checkbox('Show Name')).toBeTruthy();
    });
});

describe('MediaRequestManagerWidgetConfig', () => {
    it('renders the Jellyseerr form by default', () => {
        renderInForm((form) => <MediaRequestManagerWidgetConfig formContext={form} />);

        expect(screen.getByText('Select Service:')).toBeTruthy();
        expect(radio('Jellyseerr').checked).toBe(true);
        expect(radio('Overseerr').checked).toBe(false);
        expect(input('Display Name')).toBeTruthy();
        expect(input(/^Host/)).toBeTruthy();
        expect(input(/^Port/)).toBeTruthy();
        expect(input(/^API Key/).type).toBe('password');
        expect(checkbox('Use SSL')).toBeTruthy();
        expect(checkbox('Show Name')).toBeTruthy();
    });

    it('renames the service when Overseerr is chosen', async () => {
        renderInForm((form) => <MediaRequestManagerWidgetConfig formContext={form} />, {
            defaultValues: { mediaRequestManagerService: 'jellyseerr', mediaRequestManagerName: 'Jellyseerr' }
        });

        fireEvent.click(radio('Overseerr'));

        await waitFor(() => expect(input('Display Name').value).toBe('Overseerr'));
        expect(radio('Overseerr').checked).toBe(true);
    });
});

describe('MediaServerWidgetConfig', () => {
    it('renders the media server fields with Jellyfin selected and its default port', async () => {
        renderInForm((form) => <MediaServerWidgetConfig formContext={form} />, {
            defaultValues: { mediaServerType: 'jellyfin' }
        });

        expect(screen.getByText('Select Media Server:')).toBeTruthy();
        expect(radio('Jellyfin').checked).toBe(true);
        expect(radio('Emby')).toBeTruthy();
        expect(input(/^Host/).placeholder).toBe('192.168.1.100 or jellyfin.example.com');
        expect(input(/^API Key/).type).toBe('password');
        expect(screen.getByText('Generate in Jellyfin: Dashboard > API Keys')).toBeTruthy();
        expect(checkbox('Use SSL')).toBeTruthy();
        expect(checkbox('Show Label')).toBeTruthy();

        await waitFor(() => expect(input(/^Port/).value).toBe('8096'));
        expect(input('Display Name').value).toBe('Jellyfin');
    });

    it('switches the display name when Emby is picked', async () => {
        renderInForm((form) => <MediaServerWidgetConfig formContext={form} />, {
            defaultValues: { mediaServerType: 'jellyfin', mediaServerName: 'Jellyfin' }
        });

        fireEvent.click(radio('Emby'));

        await waitFor(() => expect(input('Display Name').value).toBe('Emby'));
    });
});

describe('NotesWidgetConfig', () => {
    it('renders the display name, font size and label toggle', () => {
        renderInForm((form) => <NotesWidgetConfig formContext={form} />, {
            defaultValues: { defaultNoteFontSize: '16px' }
        });

        expect(input('Display Name').placeholder).toBe('Notes');
        expect(screen.getByRole('combobox', { name: /Default Font Size/ })).toBeTruthy();
        expect(screen.getByText('16')).toBeTruthy();
        expect(checkbox('Show Label')).toBeTruthy();
    });
});

describe('PiholeWidgetConfig', () => {
    it('renders the Pi-hole connection and credential fields', () => {
        renderInForm((form) => <PiholeWidgetConfig formContext={form} />);

        expect(input(/^Pi-hole Host/)).toBeTruthy();
        expect(input(/^Port/)).toBeTruthy();
        expect(input('Display Name').placeholder).toBe('Pi-hole');
        expect(input(/^API Token \(Pi-hole v5\)/).type).toBe('password');
        expect(input(/^Password \(Pi-hole v6\)/).type).toBe('password');
        expect(screen.getByText('Enter your Pi-hole admin password')).toBeTruthy();
        expect(checkbox('Use SSL')).toBeTruthy();
        expect(checkbox('Show Name')).toBeTruthy();
    });

    it('disables the API token once a password is typed', async () => {
        renderInForm((form) => <PiholeWidgetConfig formContext={form} />);

        fireEvent.change(input(/^Password \(Pi-hole v6\)/), { target: { value: 'hunter2' } });

        await waitFor(() => expect(input(/^API Token \(Pi-hole v5\)/).disabled).toBe(true));
        expect(screen.getByText('Password already provided')).toBeTruthy();
    });

    it('masks the stored token of an existing Pi-hole widget', async () => {
        const existing = makeItem(ITEM_TYPE.PIHOLE_WIDGET, { config: { _hasApiToken: true } });
        renderInForm((form) => <PiholeWidgetConfig formContext={form} existingItem={existing} />);

        await waitFor(() => expect(input(/^API Token \(Pi-hole v5\)/).value).toBe(MASKED));
        expect(input(/^Password \(Pi-hole v6\)/).value).toBe('');
    });
});

describe('PlaceholderConfig', () => {
    it('renders the size select and the admin toggle', () => {
        renderInForm((form) => <PlaceholderConfig formContext={form} />, { defaultValues: { placeholderSize: 'app' } });

        expect(screen.getByRole('combobox', { name: /Placeholder Size/ })).toBeTruthy();
        expect(screen.getByText('App Shortcut')).toBeTruthy();
        expect(checkbox('Admin Only')).toBeTruthy();
    });
});

describe('QueueManagementWidgetConfig and its Sonarr and Radarr variants', () => {
    it('renders the generic queue fields for the given service', () => {
        renderInForm((form) => <QueueManagementWidgetConfig formContext={form} serviceName='Lidarr' defaultPort='8686' />);

        expect(input('Display Name')).toBeTruthy();
        expect(input(/^Host/).placeholder).toBe('localhost');
        expect(input(/^Port/).placeholder).toBe('8686');
        expect(input(/^API Key/).placeholder).toBe('Enter your Lidarr API key');
        expect(screen.getByText('Find your API key in Lidarr: Settings → General → Security → API Key')).toBeTruthy();
        expect(checkbox('Use SSL')).toBeTruthy();
        expect(checkbox('Show Label')).toBeTruthy();
    });

    it('renders the Radarr form with its default port', () => {
        renderInForm((form) => <RadarrWidgetConfig formContext={form} />);

        expect(input(/^Port/).placeholder).toBe('7878');
        expect(input(/^API Key/).placeholder).toBe('Enter your Radarr API key');
    });

    it('renders the Sonarr form with its default port', () => {
        renderInForm((form) => <SonarrWidgetConfig formContext={form} />);

        expect(input(/^Port/).placeholder).toBe('8989');
        expect(input(/^API Key/).placeholder).toBe('Enter your Sonarr API key');
    });
});

describe('WeatherWidgetConfig', () => {
    it('renders the temperature unit radios and the location search', () => {
        renderInForm((form) => <WeatherWidgetConfig formContext={form} />);

        expect(screen.getByText('Temperature Unit:')).toBeTruthy();
        expect(radio('Fahrenheit (°F)').checked).toBe(true);
        expect(radio('Celsius (°C)').checked).toBe(false);
        expect(input('Search location')).toBeTruthy();
        expect(screen.getByText('Enter a zip code or city')).toBeTruthy();
    });

    it('shows the saved location and unit of an existing widget', async () => {
        renderInForm((form) => <WeatherWidgetConfig formContext={form} />, {
            defaultValues: {
                temperatureUnit: 'celsius',
                location: { name: 'Austin, TX', latitude: 30.27, longitude: -97.74 }
            }
        });

        await waitFor(() => expect(input('Search location').value).toBe('Austin, TX'));
        expect(radio('Celsius (°C)').checked).toBe(true);
    });
});

describe('WidgetConfig', () => {
    it.each([
        [ITEM_TYPE.WEATHER_WIDGET, 'Temperature Unit:'],
        [ITEM_TYPE.DATE_TIME_WIDGET, 'Use 24-hour format'],
        [ITEM_TYPE.SYSTEM_MONITOR_WIDGET, 'Display Options'],
        [ITEM_TYPE.DISK_MONITOR_WIDGET, 'Layout & Disk Selection'],
        [ITEM_TYPE.PIHOLE_WIDGET, /Pi-hole Host/],
        [ITEM_TYPE.ADGUARD_WIDGET, /AdGuard Home Host/],
        [ITEM_TYPE.DOWNLOAD_CLIENT, 'Select Download Client:'],
        [ITEM_TYPE.TORRENT_CLIENT, 'Select Download Client:'],
        [ITEM_TYPE.DUAL_WIDGET, 'Top Widget'],
        [ITEM_TYPE.GROUP_WIDGET, /Group Name/],
        [ITEM_TYPE.MEDIA_SERVER_WIDGET, 'Select Media Server:'],
        [ITEM_TYPE.MEDIA_REQUEST_MANAGER_WIDGET, 'Select Service:'],
        [ITEM_TYPE.NOTES_WIDGET, /Default Font Size/],
        [ITEM_TYPE.SONARR_WIDGET, /Find your API key in Sonarr/],
        [ITEM_TYPE.RADARR_WIDGET, /Find your API key in Radarr/]
    ])('renders the %s configuration', (widgetType, expected) => {
        renderInForm((form) => <WidgetConfig formContext={form} widgetType={widgetType} />);

        expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
    });

    it('renders nothing for an unknown widget type', () => {
        const { container } = renderInForm((form) => <WidgetConfig formContext={form} widgetType='mystery-widget' />);

        expect(container.querySelector('form')!.children.length).toBe(0);
    });
});
