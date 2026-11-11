import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { makeItem, renderWithProviders } from './render';
import { setLive } from './widgets-helpers';
import { DiskMonitorWidget } from '../../src/components/dashboard/base-items/widgets/DiskMonitorWidget';
import GroupWidget from '../../src/components/dashboard/base-items/widgets/GroupWidget';
import { GroupWidgetItem } from '../../src/components/dashboard/base-items/widgets/GroupWidgetItem';
import { DiskUsageBar } from '../../src/components/dashboard/base-items/widgets/SystemMonitorWidget/DiskUsageWidget';
import { GaugeWidget } from '../../src/components/dashboard/base-items/widgets/SystemMonitorWidget/GaugeWidget';
import { SystemMonitorWidget } from '../../src/components/dashboard/base-items/widgets/SystemMonitorWidget/SystemMonitorWidget';
import { WeatherWidget } from '../../src/components/dashboard/base-items/widgets/WeatherWidget';
import { realtime } from '../../src/realtime/socket';
import { ITEM_TYPE } from '../../src/types';

const GiB = 1024 ** 3;

const metrics = {
    cpu: { currentLoad: 42.4, main: 50, physicalCores: 8, manufacturer: 'AMD', brand: 'Ryzen' },
    memory: { total: 32, active: 8, totalInstalled: 32 },
    disk: [{ fs: '/dev/sda1', mount: '/', size: 1000e9, used: 500e9, use: 50 }],
    network: { iface: 'eth0', rx_sec: 2 * 1024 * 1024, tx_sec: 512 * 1024, speed: 1000 },
    system: { arch: 'x64', distro: 'Debian', release: '12', kernel: '6.1', uptime: 3600 }
};

describe('system monitor widget', () => {
    it('says it is loading until the first reading arrives', () => {
        renderWithProviders(<SystemMonitorWidget id='sys-loading' />);
        expect(screen.getByText('Loading system data...')).toBeTruthy();
        expect(screen.getByRole('progressbar')).toBeTruthy();
    });

    it('shows the gauges, disk usage and internet status from the readings', () => {
        setLive('system.metrics', 'sys-data', { data: metrics });
        setLive('internet.status', undefined, { data: { status: 'online' } });
        renderWithProviders(<SystemMonitorWidget id='sys-data' config={{ gauges: ['cpu', 'temp', 'ram', 'network'] }} />);

        expect(screen.getByText('CPU')).toBeTruthy();
        expect(screen.getByText('42%')).toBeTruthy();
        expect(screen.getByText('TEMP')).toBeTruthy();
        expect(screen.getByText('122°F')).toBeTruthy();
        expect(screen.getByText('RAM')).toBeTruthy();
        expect(screen.getByText('25%')).toBeTruthy();
        expect(screen.getByText('NET')).toBeTruthy();
        expect(screen.getByText('512 KB')).toBeTruthy();
        expect(screen.getByText('2 MB')).toBeTruthy();
        expect(screen.getByText('Disk Usage: 50.0%')).toBeTruthy();
        expect(screen.getByText('500 GB / 1 TB')).toBeTruthy();

        // The info button opens the system information dialog
        fireEvent.click(screen.getAllByRole('button')[0]);
        expect(screen.getByText('System Information')).toBeTruthy();
        expect(screen.getByText(/8 Core AMD Ryzen/)).toBeTruthy();
        expect(screen.getByText(/Connected/)).toBeTruthy();
    });

    it('respects celsius and the hidden sections', () => {
        setLive('system.metrics', 'sys-celsius', { data: metrics });
        renderWithProviders(
            <SystemMonitorWidget id='sys-celsius' editMode
                config={{ temperatureUnit: 'celsius', gauges: ['temp', 'none'], showDiskUsage: false, showSystemInfo: false }} />
        );

        expect(screen.getByText('50°C')).toBeTruthy();
        expect(screen.queryByText('CPU')).toBeNull();
        expect(screen.queryByText(/Disk Usage/)).toBeNull();
        expect(screen.queryAllByRole('button')).toHaveLength(0);
    });

    it('shows the error from the server with a retry button', () => {
        setLive('system.metrics', 'sys-error', { error: 'System metrics unavailable' });
        renderWithProviders(<SystemMonitorWidget id='sys-error' />);

        expect(screen.getByText('System metrics unavailable')).toBeTruthy();
        fireEvent.click(screen.getByText('Retry'));
        expect(realtime.reconnect).toHaveBeenCalled();
    });

    it('renders a gauge with its value, suffix and title', () => {
        const { rerender } = renderWithProviders(<GaugeWidget title='CPU' value={37} />);
        expect(screen.getByText('37%')).toBeTruthy();
        expect(screen.getByText('CPU')).toBeTruthy();

        rerender(<GaugeWidget title='TEMP' value={70} temperature isFahrenheit />);
        expect(screen.getByText('70°F')).toBeTruthy();

        rerender(<GaugeWidget title='NET' value={1} total={1000} customContent={<span>custom</span>} />);
        expect(screen.getByText('custom')).toBeTruthy();
        expect(screen.queryByText('1%')).toBeNull();
    });

    it('renders the disk usage bar in gigabytes and terabytes', () => {
        renderWithProviders(<DiskUsageBar totalSpace={2000} usedSpace={750} usedPercentage={37.5} />);
        expect(screen.getByText('Disk Usage: 37.5%')).toBeTruthy();
        expect(screen.getByText('750 GB / 2 TB')).toBeTruthy();
    });
});

describe('disk monitor widget', () => {
    const disks = [
        { fs: '/dev/sda1', type: 'ext4', size: 1000 * GiB, used: 500 * GiB, available: 500 * GiB, use: 50, mount: '/' },
        { fs: '/dev/sdb1', type: 'ext4', size: 4000 * GiB, used: 1000 * GiB, available: 3000 * GiB, use: 25, mount: '/mnt/media' },
        { fs: '//nas/share', type: 'cifs', size: 10 * GiB, used: 1 * GiB, available: 9 * GiB, use: 10, mount: '/mnt/nas' }
    ];
    const selected = [
        { mount: '/', customName: 'Root', showMountPath: true },
        { mount: '/mnt/media', customName: 'Media' },
        { mount: '/mnt/nas', customName: 'NAS' }
    ];

    it('says it is loading, then that no disks are configured', () => {
        const { rerender } = renderWithProviders(<DiskMonitorWidget id='disk-loading' config={{ selectedDisks: selected }} />);
        expect(screen.getByText('Disk Monitor')).toBeTruthy();
        expect(screen.getByText('Loading disks...')).toBeTruthy();

        setLive('system.disks', 'disk-loading', { data: disks });
        rerender(<DiskMonitorWidget id='disk-loading' config={{ selectedDisks: [], showName: false }} />);
        expect(screen.queryByText('Disk Monitor')).toBeNull();
        expect(screen.getByText('No disks configured')).toBeTruthy();
    });

    it('shows the selected disks with their usage, skipping network shares', () => {
        setLive('system.disks', 'disk-data', { data: disks });
        renderWithProviders(<DiskMonitorWidget id='disk-data' config={{ selectedDisks: selected, layout: '1x5' }} />);

        expect(screen.getByText('Root')).toBeTruthy();
        expect(screen.getByText('/')).toBeTruthy();
        expect(screen.getByText('50.0%')).toBeTruthy();
        expect(screen.getByText('Free: 500.0 GB')).toBeTruthy();
        expect(screen.getByText('Total: 1.0 TB')).toBeTruthy();
        expect(screen.getByText('Media')).toBeTruthy();
        expect(screen.queryByText('/mnt/media')).toBeNull();
        expect(screen.getByText('25.0%')).toBeTruthy();
        expect(screen.getByText('Total: 4.0 TB')).toBeTruthy();
        expect(screen.queryByText('NAS')).toBeNull();
    });

    it('shows the error from the server', () => {
        setLive('system.disks', 'disk-error', { error: 'boom' });
        renderWithProviders(<DiskMonitorWidget id='disk-error' config={{ selectedDisks: selected }} />);

        expect(screen.getByText('Configuration Error')).toBeTruthy();
        expect(screen.getByText('Failed to fetch disk information')).toBeTruthy();
    });
});

describe('group widgets', () => {
    const items = [
        { id: 'g1', name: 'Plex', url: 'http://plex.local', icon: 'plex.svg' },
        { id: 'g2', name: 'Sonarr', url: 'http://sonarr.local', icon: 'sonarr.svg', showLabel: false },
        { id: 'g3', name: 'Radarr', url: 'http://radarr.local', icon: 'radarr.svg' },
        { id: 'g4', name: 'Hidden', url: 'http://hidden.local', icon: 'hidden.svg' }
    ];

    it('renders the group name and up to the allowed number of shortcuts', () => {
        renderWithProviders(<GroupWidget id='group-1' name='Media' items={items} />);

        expect(screen.getByText('Media')).toBeTruthy();
        expect(screen.getByAltText('Plex')).toBeTruthy();
        expect(screen.getByText('Plex')).toBeTruthy();
        expect(screen.getByAltText('Sonarr')).toBeTruthy();
        expect(screen.queryByText('Sonarr')).toBeNull();
        expect(screen.getByAltText('Radarr')).toBeTruthy();
        expect(screen.queryByAltText('Hidden')).toBeNull();
        expect(screen.getAllByRole('link')).toHaveLength(3);
        expect(screen.queryByTitle('Edit group to add items')).toBeNull();
        expect(screen.queryByTestId('MoreVertIcon')).toBeNull();
    });

    it('offers an add slot and edit menus in edit mode, and calls back on edit and delete', () => {
        const onEdit = vi.fn();
        const onRemove = vi.fn();
        const onItemEdit = vi.fn();
        renderWithProviders(
            <GroupWidget id='group-2' name='Servers' items={items.slice(0, 1)} maxItems='6_2x3' isEditing showLabel={false}
                onEdit={onEdit} onRemove={onRemove} onItemEdit={onItemEdit} />
        );

        expect(screen.queryByText('Servers')).toBeNull();
        expect(screen.getByTitle('Edit group to add items')).toBeTruthy();
        expect(screen.queryAllByRole('link')).toHaveLength(0);

        // The first menu belongs to the group, the second to its only shortcut
        const menus = screen.getAllByTestId('MoreVertIcon');
        expect(menus).toHaveLength(2);
        fireEvent.click(menus[0]);
        fireEvent.click(screen.getByText('Edit'));
        expect(onEdit).toHaveBeenCalledTimes(1);
        fireEvent.click(menus[0]);
        fireEvent.click(screen.getByText('Delete'));
        expect(onRemove).toHaveBeenCalledTimes(1);

        // The group's menu is still fading out, so its entries are in the DOM next to the shortcut's
        fireEvent.click(menus[1]);
        const edits = screen.getAllByText('Edit');
        fireEvent.click(edits[edits.length - 1]);
        expect(onItemEdit).toHaveBeenCalledWith('g1');
    });

    it('renders the dashboard group item around its group', () => {
        const group = makeItem(ITEM_TYPE.GROUP_WIDGET, { id: 'group-3', label: 'Downloads', config: { items: items.slice(0, 2), maxItems: 3 } });
        renderWithProviders(
            <GroupWidgetItem id={group.id} label={group.label} config={group.config} editMode={false} />,
            { context: { dashboardLayout: [group] } }
        );

        expect(document.querySelector('[data-widget-id="group-3"]')).not.toBeNull();
        expect(screen.getByText('Downloads')).toBeTruthy();
        expect(screen.getByAltText('Plex')).toBeTruthy();
        expect(screen.getByAltText('Sonarr')).toBeTruthy();
    });

    it('hides the group label when the item says so', () => {
        renderWithProviders(<GroupWidgetItem id='group-4' label='Quiet' config={{ items: items.slice(0, 1), showLabel: false }} editMode />);

        expect(screen.queryByText('Quiet')).toBeNull();
        expect(screen.getByAltText('Plex')).toBeTruthy();
        expect(screen.getByTitle('Edit group to add items')).toBeTruthy();
    });
});

describe('weather widget', () => {
    const location = { name: 'Paris, Île-de-France, France', latitude: 48.85, longitude: 2.35 };
    const forecast = {
        current: { temperature_2m: 20, weathercode: 0, windspeed_10m: 12 },
        daily: {
            temperature_2m_max: [25, 26, 27, 28, 29],
            temperature_2m_min: [15, 16, 17, 18, 19],
            weathercode: [0, 2, 61, 71, 95],
            time: ['2025-06-02', '2025-06-03', '2025-06-04', '2025-06-05', '2025-06-06'],
            sunrise: ['2025-06-02T05:50', '2025-06-03T05:50', '2025-06-04T05:50', '2025-06-05T05:50', '2025-06-06T05:50'],
            sunset: ['2025-06-02T21:40', '2025-06-03T21:40', '2025-06-04T21:40', '2025-06-05T21:40', '2025-06-06T21:40']
        }
    };

    it('asks for a location when none is set', () => {
        renderWithProviders(<WeatherWidget id='weather-none' />);
        expect(screen.getByText('Weather unavailable')).toBeTruthy();
        expect(screen.getByText('Please set a location in the widget settings')).toBeTruthy();
    });

    it('spins until the forecast arrives', () => {
        renderWithProviders(<WeatherWidget id='weather-loading' config={{ location }} />);
        expect(screen.getByRole('progressbar')).toBeTruthy();
    });

    it('shows the current temperature and the five-day forecast', () => {
        setLive('weather.forecast', 'weather-data', { data: forecast });
        renderWithProviders(<WeatherWidget id='weather-data' config={{ location }} />);

        expect(screen.getByText('Paris, France')).toBeTruthy();
        expect(screen.getByText('68°F')).toBeTruthy();
        expect(screen.getByText('Mon')).toBeTruthy();
        expect(screen.getByText('Fri')).toBeTruthy();
        expect(screen.getByText('84°F')).toBeTruthy();
        // The current temperature plus one high per forecast day
        expect(screen.getAllByText(/^\d{2}°F$/)).toHaveLength(6);

        fireEvent.click(screen.getByText('Mon').parentElement!.querySelector('svg')!);
        expect(screen.getByText('Clear')).toBeTruthy();
        expect(screen.getByText('High:').parentElement).toHaveProperty('textContent', 'High: 77°F');
    });

    it('shows celsius when the unit says so', () => {
        setLive('weather.forecast', 'weather-celsius', { data: forecast });
        renderWithProviders(<WeatherWidget id='weather-celsius' config={{ location, temperatureUnit: 'celsius' }} />);

        expect(screen.getByText('20°C')).toBeTruthy();
        expect(screen.getByText('29°C')).toBeTruthy();
    });

    it('shows the error from the server with a retry button', () => {
        setLive('weather.forecast', 'weather-error', { error: 'Weather service unavailable' });
        renderWithProviders(<WeatherWidget id='weather-error' config={{ location }} />);

        expect(screen.getByText('Weather service unavailable')).toBeTruthy();
        fireEvent.click(screen.getByText('Retry'));
        expect(realtime.reconnect).toHaveBeenCalled();
    });
});
