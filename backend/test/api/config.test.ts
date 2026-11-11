// Must stay first: it swaps in the test config before any app module loads
import '../helpers/fixture-config';

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';

import { getConfig, updateConfig } from '../../src/services/config-store';
import { findItemById } from '../../src/utils/config-lookup';
import { decrypt, encrypt } from '../../src/utils/crypto';
import { fixture, saveFixture } from '../helpers/fixture-config';
import { Reply, RunningApp, startApp } from '../helpers/http';
import { cookieFor } from '../helpers/sessions';

const ADMIN = cookieFor('admin');
const USER = cookieFor('user');

let app: RunningApp;
const call: RunningApp['call'] = (...args) => app.call(...args);

const ids = (items: Array<{ id: string }>): string[] => items.map(item => item.id);
const find = (items: Reply['body'], id: string) => items.find((item: { id: string }) => item.id === id);
const widget = (id: string, type: string, config: Record<string, unknown>, adminOnly = false) => (
    { id, label: id, type, config, ...(adminOnly ? { adminOnly } : {}) }
);
const radarr = (id: string, config: Record<string, unknown>) => widget(id, 'radarr-widget', config);
const onDisk = (): string => fs.readFileSync(process.env.CONFIG_FILE!, 'utf-8');

before(async () => {
    app = await startApp();
});
after(() => app.close());
beforeEach(() => saveFixture());

describe('admin-only config routes', () => {
    it('refuse guests with 401 and regular users with 403', async () => {
        const routes: Array<[string, string]> = [
            ['POST', '/api/config'], ['GET', '/api/config/export'], ['POST', '/api/config/import'],
            ['GET', '/api/config/backup/status'], ['POST', '/api/config/backup/trigger'], ['POST', '/api/config/backup/restore']
        ];

        for (const [method, url] of routes) {
            const body = method === 'GET' ? undefined : { title: 'Taken over' };
            assert.equal((await call(method, url, undefined, body)).status, 401, `guest ${method} ${url}`);
            assert.equal((await call(method, url, USER, body)).status, 403, `user ${method} ${url}`);
        }
        assert.equal(getConfig().title, undefined);
    });
});

describe('reading the config', () => {
    it('hides admin-only items, group children and pages from guests and regular users alike', async () => {
        updateConfig(draft => {
            find(draft.layout.desktop, 'public-group').config.items.push(widget('hidden-child', 'app-shortcut', {}, true));
        });

        const guest = await call('GET', '/api/config');
        const user = await call('GET', '/api/config', USER);

        assert.equal(guest.status, 200);
        assert.deepEqual(ids(guest.body.layout.desktop), ['public-radarr', 'public-qbit', 'public-seerr', 'public-pihole', 'public-group', 'dual', 'public-wol']);
        assert.deepEqual(ids(find(guest.body.layout.desktop, 'public-group').config.items), ['group-child']);
        assert.deepEqual(guest.body.pages, []);
        // Hidden on desktop but shown to guests on mobile, so it only goes out in that layout
        assert.deepEqual(ids(guest.body.layout.mobile), ['admin-on-desktop-only']);
        assert.equal(user.status, 200);
        assert.deepEqual(user.body, guest.body);
    });

    it('gives admins every item and page', async () => {
        const { body } = await call('GET', '/api/config', ADMIN);

        assert.deepEqual(ids(body.layout.desktop), ids(fixture.layout.desktop));
        assert.deepEqual(ids(find(body.layout.desktop, 'admin-group').config.items), ['admin-group-child']);
        assert.deepEqual(ids(body.pages), ['admin-page']);
        assert.deepEqual(ids(body.pages[0].layout.desktop), ['admin-page-item']);
    });

    it('replaces the secrets of each widget type with flags, for admins too', async () => {
        const secret = { apiKey: 'key-7f3a9c', apiToken: 'token-2b4d8e', password: 'pw-9c1e5f', username: 'adguard-5e2a7b' };
        updateConfig(draft => {
            draft.layout.desktop = [
                widget('pihole', 'pihole-widget', { host: 'h', apiToken: secret.apiToken, password: secret.password }),
                widget('adguard', 'adguard-widget', { host: 'h', username: secret.username, password: secret.password }),
                widget('qbit', 'torrent-client', { host: 'h', clientType: 'qbittorrent', username: 'qbit-user', password: secret.password }),
                widget('sab', 'download-client', { host: 'h', password: secret.password }),
                widget('jellyfin', 'media-server-widget', { host: 'h', apiKey: secret.apiKey }),
                widget('sonarr', 'sonarr-widget', { host: 'h', apiKey: secret.apiKey }),
                widget('seerr', 'media-request-manager-widget', { host: 'h', apiKey: secret.apiKey }),
                widget('dual', 'dual-widget', {
                    topWidget: { type: 'pihole-widget', config: { host: 'h', apiToken: secret.apiToken } },
                    bottomWidget: { type: 'adguard-widget', config: { host: 'h', username: secret.username, password: secret.password } }
                }),
                // The form only offers a few widget types for a dual widget, but the file may hold any
                widget('dual-arr', 'dual-widget', {
                    topWidget: { type: 'radarr-widget', config: { host: 'h', apiKey: secret.apiKey } },
                    bottomWidget: { config: { host: 'h', username: secret.username, password: secret.password } }
                })
            ];
        });

        for (const [who, cookie] of [['guest', undefined], ['user', USER], ['admin', ADMIN]] as const) {
            const text = JSON.stringify((await call('GET', '/api/config', cookie)).body);
            for (const value of Object.values(secret)) {
                assert.equal(text.includes(value), false, `${who} can read ${value}`);
            }
        }

        const { body } = await call('GET', '/api/config', ADMIN);
        const configOf = (id: string) => find(body.layout.desktop, id).config;
        assert.deepEqual(configOf('pihole'), { host: 'h', _hasApiToken: true, _hasPassword: true });
        assert.deepEqual(configOf('adguard'), { host: 'h', _hasUsername: true, _hasPassword: true });
        // Only AdGuard treats the username as a secret
        assert.deepEqual(configOf('qbit'), { host: 'h', clientType: 'qbittorrent', username: 'qbit-user', _hasPassword: true });
        assert.deepEqual(configOf('sab'), { host: 'h', _hasPassword: true });
        for (const id of ['jellyfin', 'sonarr', 'seerr']) {
            assert.deepEqual(configOf(id), { host: 'h', _hasApiKey: true }, id);
        }
        assert.deepEqual(configOf('dual'), {
            topWidget: { type: 'pihole-widget', config: { host: 'h', _hasApiToken: true } },
            bottomWidget: { type: 'adguard-widget', config: { host: 'h', _hasUsername: true, _hasPassword: true } }
        });
        // A half without a type keeps its username to itself, in case it is an AdGuard login
        assert.deepEqual(configOf('dual-arr'), {
            topWidget: { type: 'radarr-widget', config: { host: 'h', _hasApiKey: true } },
            bottomWidget: { config: { host: 'h', _hasUsername: true, _hasPassword: true } }
        });
    });

    it('masks secrets inside groups and on pages as well', async () => {
        updateConfig(draft => {
            find(draft.layout.desktop, 'admin-group').config.items[0].config = { host: 'h', apiKey: 'key-7f3a9c' };
            find(draft.layout.desktop, 'public-group').config.items.push(radarr('group-radarr', { host: 'h', apiKey: 'key-7f3a9c' }));
            find(draft.pages![0].layout.desktop, 'admin-page-item').config = { host: 'h', apiKey: 'key-7f3a9c' };
        });

        const admin = (await call('GET', '/api/config', ADMIN)).body;
        const guest = (await call('GET', '/api/config')).body;

        assert.equal(JSON.stringify(admin).includes('key-7f3a9c'), false);
        assert.deepEqual(find(admin.layout.desktop, 'admin-group').config.items[0].config, { host: 'h', _hasApiKey: true });
        assert.deepEqual(find(admin.pages[0].layout.desktop, 'admin-page-item').config, { host: 'h', _hasApiKey: true });
        assert.deepEqual(find(find(guest.layout.desktop, 'public-group').config.items, 'group-radarr').config, { host: 'h', _hasApiKey: true });
    });
});

describe('saving the config', () => {
    it('stores a secret the way the client encrypted it and answers with it masked', async () => {
        const { encrypted } = (await call('POST', '/api/config/encrypt', ADMIN, { value: 'radarr-key-7f3a' })).body;

        const reply = await call('POST', '/api/config', ADMIN, {
            layout: { desktop: [radarr('new-radarr', { host: 'h', apiKey: encrypted })], mobile: [] }
        });

        assert.equal(reply.status, 200);
        assert.equal(reply.body.message, 'Config saved successfully');
        assert.deepEqual(find(reply.body.updatedConfig.layout.desktop, 'new-radarr').config, { host: 'h', _hasApiKey: true });
        const saved = findItemById('new-radarr')!.config!;
        // Kept as sent, not encrypted a second time
        assert.equal(saved.apiKey, encrypted);
        assert.match(onDisk(), /"apiKey": "ENC:/);
        assert.equal(onDisk().includes('radarr-key-7f3a'), false);
        assert.equal(decrypt(saved.apiKey), 'radarr-key-7f3a');
    });

    it('encrypts a credential that arrives in plain text, wherever the item sits', async () => {
        const reply = await call('POST', '/api/config', ADMIN, {
            layout: {
                desktop: [
                    radarr('plain-radarr', { host: 'h', apiKey: 'plain-key-4d2e' }),
                    widget('plain-adguard', 'adguard-widget', { host: 'h', username: 'ad-user-91c0', password: 'ad-pw-7a3f' }),
                    widget('plain-qbit', 'torrent-client', { host: 'h', clientType: 'qbittorrent', username: 'qbit-user', password: 'qb-pw-5e1d' }),
                    widget('plain-group', 'group-widget', { items: [radarr('plain-group-child', { host: 'h', apiKey: 'plain-key-4d2e' })] }),
                    widget('plain-dual', 'dual-widget', {
                        topWidget: { type: 'pihole-widget', config: { host: 'h', apiToken: 'pi-token-2c8b' } },
                        bottomWidget: { type: 'radarr-widget', config: { host: 'h', apiKey: 'plain-key-4d2e' } }
                    })
                ],
                mobile: []
            },
            pages: [{ id: 'p', name: 'P', layout: { desktop: [radarr('plain-page-item', { host: 'h', apiKey: 'plain-key-4d2e' })], mobile: [] } }]
        });

        assert.equal(reply.status, 200);
        for (const value of ['plain-key-4d2e', 'ad-user-91c0', 'ad-pw-7a3f', 'qb-pw-5e1d', 'pi-token-2c8b']) {
            assert.equal(onDisk().includes(value), false, value);
            assert.equal(JSON.stringify(reply.body).includes(value), false, value);
        }
        for (const id of ['plain-radarr', 'plain-group-child', 'plain-page-item']) {
            assert.equal(decrypt(findItemById(id)!.config!.apiKey), 'plain-key-4d2e', id);
        }
        const adguard = findItemById('plain-adguard')!.config!;
        assert.equal(decrypt(adguard.username), 'ad-user-91c0');
        assert.equal(decrypt(adguard.password), 'ad-pw-7a3f');
        const qbit = findItemById('plain-qbit')!.config!;
        // A torrent client's username is shown in its form, so it is stored as is
        assert.equal(qbit.username, 'qbit-user');
        assert.equal(decrypt(qbit.password), 'qb-pw-5e1d');
        const dual = findItemById('plain-dual')!.config!;
        assert.equal(decrypt(dual.topWidget.config.apiToken), 'pi-token-2c8b');
        assert.equal(decrypt(dual.bottomWidget.config.apiKey), 'plain-key-4d2e');
    });

    it('keeps stored secrets when the client sends the flags back in their place', async () => {
        const stored = { apiKey: encrypt('arr-key'), apiToken: encrypt('pihole-token'), username: encrypt('adguard-user'), password: encrypt('adguard-pw') };
        const dual = {
            topWidget: { type: 'pihole-widget', config: { host: 'h', apiToken: stored.apiToken } },
            bottomWidget: { type: 'adguard-widget', config: { host: 'h', username: stored.username, password: stored.password } }
        };
        updateConfig(draft => {
            find(draft.layout.desktop, 'public-radarr').config = { host: 'h', apiKey: stored.apiKey };
            find(draft.layout.desktop, 'admin-group').config.items[0].config = { host: 'h', apiKey: stored.apiKey };
            find(draft.layout.desktop, 'dual').config = dual;
            find(draft.pages![0].layout.desktop, 'admin-page-item').config = { host: 'h', apiKey: stored.apiKey };
        });

        // The browser edits what GET gave it and sends the whole thing back
        const { body: edited } = await call('GET', '/api/config', ADMIN);
        edited.title = 'Renamed';
        const reply = await call('POST', '/api/config', ADMIN, edited);

        assert.equal(reply.status, 200);
        assert.equal(getConfig().title, 'Renamed');
        for (const id of ['public-radarr', 'admin-group-child', 'admin-page-item']) {
            assert.deepEqual(findItemById(id)!.config, { host: 'h', apiKey: stored.apiKey }, id);
        }
        assert.deepEqual(findItemById('dual')!.config, dual);
        // The flags are for the wire only
        assert.equal(onDisk().includes('_has'), false);
    });

    it('takes a new secret over the stored one, and drops one that is neither sent nor flagged', async () => {
        const replacement = encrypt('arr-key-2');
        updateConfig(draft => {
            find(draft.layout.desktop, 'public-radarr').config = { host: 'h', apiKey: encrypt('arr-key-1') };
            find(draft.layout.desktop, 'public-pihole').config = { host: 'h', apiToken: encrypt('token') };
        });

        await call('POST', '/api/config', ADMIN, {
            layout: {
                desktop: [
                    radarr('public-radarr', { host: 'h', _hasApiKey: true, apiKey: replacement }),
                    widget('public-pihole', 'pihole-widget', { host: 'h' })
                ],
                mobile: []
            }
        });

        assert.deepEqual(findItemById('public-radarr')!.config, { host: 'h', apiKey: replacement });
        assert.deepEqual(findItemById('public-pihole')!.config, { host: 'h' });
    });

    it('follows an item that moves into or out of a group', async () => {
        const apiKey = encrypt('arr-key');
        updateConfig(draft => {
            find(draft.layout.desktop, 'public-radarr').config = { host: 'h', apiKey };
            find(draft.layout.desktop, 'admin-group').config.items[0].config = { host: 'h', apiKey };
        });

        const group = widget('public-group', 'group-widget', { items: [radarr('public-radarr', { host: 'h', _hasApiKey: true })] });
        await call('POST', '/api/config', ADMIN, {
            layout: { desktop: [radarr('admin-group-child', { host: 'h', _hasApiKey: true }), group], mobile: [] }
        });

        assert.deepEqual(findItemById('admin-group-child')!.config, { host: 'h', apiKey });
        assert.deepEqual(findItemById('public-radarr')!.config, { host: 'h', apiKey });
    });

    it('copies the credentials of the item a duplicate was made from', async () => {
        const apiKey = encrypt('arr-key');
        updateConfig(draft => {
            find(draft.layout.desktop, 'public-radarr').config = { host: 'h', apiKey };
        });

        const copy = radarr('copy', { host: 'h', _hasApiKey: true, _duplicatedFrom: 'public-radarr' });
        await call('POST', '/api/config', ADMIN, {
            layout: { desktop: [radarr('public-radarr', { host: 'h', _hasApiKey: true }), copy], mobile: [] }
        });

        assert.deepEqual(findItemById('copy')!.config, { host: 'h', apiKey });
    });

    it('merges top-level fields and leaves the ones it did not get alone', async () => {
        updateConfig(draft => {
            draft.notes = [{ id: 'n1', title: 'Keep', content: '', createdAt: 'then', updatedAt: 'then' }];
            delete draft.pages;
        });
        const previous = getConfig();

        const reply = await call('POST', '/api/config', ADMIN, { title: 'Renamed', themeColor: '#123456' });

        assert.equal(reply.status, 200);
        const saved = getConfig();
        assert.equal(saved.title, 'Renamed');
        assert.equal(saved.themeColor, '#123456');
        assert.deepEqual(saved.layout, previous.layout);
        assert.deepEqual(saved.notes, previous.notes);
        // A missing section is created rather than left out
        assert.deepEqual(saved.pages, []);
    });
});

describe('exporting and importing the config', () => {
    it('downloads the stored file, secrets included', async () => {
        updateConfig(draft => {
            find(draft.layout.desktop, 'public-radarr').config.apiKey = encrypt('arr-key');
        });

        const reply = await call('GET', '/api/config/export', ADMIN);

        assert.equal(reply.status, 200);
        assert.match(reply.headers.get('content-type') ?? '', /^application\/json/);
        assert.match(reply.headers.get('content-disposition') ?? '', /^attachment; filename=lab-dash-backup-\d{4}-\d{2}-\d{2}\.json$/);
        assert.deepEqual(reply.body, getConfig());
        assert.match(find(reply.body.layout.desktop, 'public-radarr').config.apiKey, /^ENC:/);
    });

    it('brings an export back on import, keeping encrypted secrets and encrypting plain ones', async () => {
        const stored = encrypt('arr-key');
        updateConfig(draft => {
            draft.title = 'Before';
            draft.layout.desktop = [
                radarr('public-radarr', { host: 'h', apiKey: stored }),
                radarr('plain-radarr', { host: 'h', apiKey: 'typed-into-the-file' })
            ];
        });
        const exported = (await call('GET', '/api/config/export', ADMIN)).body;
        updateConfig(() => ({ layout: { desktop: [], mobile: [] }, title: 'Wiped' }));

        const reply = await call('POST', '/api/config/import', ADMIN, exported);

        assert.equal(reply.status, 200);
        const imported = getConfig();
        assert.equal(imported.title, 'Before');
        assert.equal(imported.pages![0].id, 'admin-page');
        // The fixture page item held a plain-text key, which the import encrypted
        assert.equal(decrypt(findItemById('admin-page-item')!.config!.apiKey), 'key');
        assert.equal(findItemById('public-radarr')!.config!.apiKey, stored);
        assert.notEqual(findItemById('plain-radarr')!.config!.apiKey, 'typed-into-the-file');
        assert.equal(decrypt(findItemById('plain-radarr')!.config!.apiKey), 'typed-into-the-file');
        assert.deepEqual(find(reply.body.updatedConfig.layout.desktop, 'public-radarr').config, { host: 'h', _hasApiKey: true });
        assert.equal(JSON.stringify(reply.body).includes('ENC:'), false);
        assert.equal(JSON.stringify(reply.body).includes('typed-into-the-file'), false);
    });

    it('adds an empty layout when the imported file has none', async () => {
        const reply = await call('POST', '/api/config/import', ADMIN, { title: 'Bare' });

        assert.equal(reply.status, 200);
        assert.deepEqual(getConfig(), { title: 'Bare', layout: { desktop: [], mobile: [] } });
    });

    it('rejects anything that is not a dashboard and keeps the stored config', async () => {
        const previous = onDisk();

        for (const body of ['not json', '"text"', '123', 'true', 'null']) {
            const reply = await call('POST', '/api/config/import', ADMIN, body);
            assert.equal(reply.status, 400, body);
            assert.equal(typeof reply.body.message, 'string');
        }
        const notDashboards = [
            [],
            [{ id: 'item' }],
            {},
            { layout: 'desktop' },
            { layout: [] },
            { pages: {} }
        ];
        for (const body of notDashboards) {
            const reply = await call('POST', '/api/config/import', ADMIN, body);
            assert.equal(reply.status, 400, JSON.stringify(body));
            assert.equal(reply.body.message, 'Invalid configuration format');
        }
        assert.equal(onDisk(), previous);
    });

    it('fills in a layout that is missing its desktop or mobile list', async () => {
        const reply = await call('POST', '/api/config/import', ADMIN, { layout: { desktop: [radarr('only-desktop', { host: 'h' })] } });

        assert.equal(reply.status, 200);
        assert.deepEqual(getConfig().layout.mobile, []);
        assert.equal(getConfig().layout.desktop[0].id, 'only-desktop');
    });
});

describe('config backups', () => {
    // Backups sit next to the config file, so here they land in the test's temp folder
    const backupDir = path.join(path.dirname(process.env.CONFIG_FILE!), 'backups');

    before(() => {
        // Nothing has created the folder yet: the first backup has to
        fs.rmSync(backupDir, { recursive: true, force: true });
    });

    it('reports that nothing was backed up yet and refuses to restore', async () => {
        const status = await call('GET', '/api/config/backup/status', ADMIN);
        assert.equal(status.status, 200);
        assert.equal(status.body.lastBackupTime, null);
        assert.equal(status.body.backupExists, false);
        assert.ok(new Date(status.body.nextBackupTime).getTime() > Date.now());

        const restore = await call('POST', '/api/config/backup/restore', ADMIN);
        assert.equal(restore.status, 500);
        assert.equal(restore.body.error, 'No backup file found');
    });

    it('writes the backup next to the config file, creating the folder, and restores it', async () => {
        const snapshot = structuredClone(getConfig());
        assert.equal(fs.existsSync(backupDir), false);

        const trigger = await call('POST', '/api/config/backup/trigger', ADMIN);
        assert.equal(trigger.status, 200);
        const { _backupMetadata, ...contents } = JSON.parse(fs.readFileSync(path.join(backupDir, 'config-weekly-backup.json'), 'utf-8'));
        assert.deepEqual(contents, snapshot);
        assert.equal(_backupMetadata.originalConfigPath, process.env.CONFIG_FILE);
        assert.ok(fs.existsSync(path.join(backupDir, 'backup-metadata.json')));

        const status = (await call('GET', '/api/config/backup/status', ADMIN)).body;
        const last = new Date(status.lastBackupTime).getTime();
        assert.equal(status.backupExists, true);
        assert.ok(Date.now() - last < 10_000);
        assert.equal(new Date(status.nextBackupTime).getTime() - last, 7 * 24 * 60 * 60 * 1000);

        updateConfig(draft => {
            draft.title = 'Changed since the backup';
        });
        const restore = await call('POST', '/api/config/backup/restore', ADMIN);
        assert.equal(restore.status, 200);
        assert.deepEqual(getConfig(), snapshot);
    });
});
