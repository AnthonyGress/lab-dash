// Import this file first. It pins SECRET and points the app at a throwaway
// config file so tests never read or write the real one.
import fs from 'fs';
import os from 'os';
import path from 'path';

process.env.SECRET = 'test-only-secret-value-at-least-32-characters';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-dash-test-'));
process.env.CONFIG_FILE = path.join(directory, 'config.json');
process.on('exit', () => fs.rmSync(directory, { recursive: true, force: true }));

// Unreachable on purpose: allowed requests fail fast upstream instead of hanging
const upstream = { host: '127.0.0.1', port: '1', apiKey: 'key', username: 'user', password: 'pass' };

export const fixture: any = {
    layout: {
        desktop: [
            { id: 'public-radarr', type: 'radarr-widget', config: upstream },
            { id: 'admin-radarr', type: 'radarr-widget', adminOnly: true, config: upstream },
            { id: 'public-qbit', type: 'torrent-client', config: { ...upstream, clientType: 'qbittorrent' } },
            { id: 'public-seerr', type: 'media-request-manager-widget', config: upstream },
            { id: 'public-pihole', type: 'pihole-widget', config: upstream },
            {
                id: 'public-group',
                type: 'group-widget',
                config: {
                    items: [{
                        id: 'group-child',
                        type: 'app-shortcut',
                        url: 'http://saved-in-group.test/',
                        macAddress: 'AA:BB:CC:DD:EE:01'
                    }]
                }
            },
            {
                id: 'admin-group',
                type: 'group-widget',
                adminOnly: true,
                config: { items: [{ id: 'admin-group-child', type: 'radarr-widget', config: upstream }] }
            },
            { id: 'dual', type: 'dual-widget', config: { topWidget: { type: 'radarr-widget', config: upstream } } },
            { id: 'public-wol', type: 'app-shortcut', config: { isWol: true, macAddress: 'AA-BB-CC-DD-EE-02' } },
            {
                id: 'admin-wol',
                type: 'app-shortcut',
                adminOnly: true,
                config: { isWol: true, macAddress: 'AA:BB:CC:DD:EE:03' }
            }
        ],
        mobile: [
            // Same item hidden on desktop but visible on mobile: guests can see it
            { id: 'admin-on-desktop-only', type: 'radarr-widget', config: upstream }
        ]
    },
    pages: [
        {
            id: 'admin-page',
            name: 'Admin',
            adminOnly: true,
            layout: { desktop: [{ id: 'admin-page-item', type: 'radarr-widget', config: upstream }], mobile: [] }
        }
    ]
};
fixture.layout.desktop.push({ id: 'admin-on-desktop-only', type: 'radarr-widget', adminOnly: true, config: upstream });

/** Writes the fixture to disk; call again after changing it. */
export const saveFixture = (): void => {
    fs.writeFileSync(process.env.CONFIG_FILE!, JSON.stringify(fixture), 'utf-8');
};

saveFixture();
