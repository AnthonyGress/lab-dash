// Must stay first: it swaps in the test config before any app module loads
import '../helpers/fixture-config';

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';

import { Reply, RunningApp, startApp } from '../helpers/http';
import { cookieFor } from '../helpers/sessions';

const ADMIN = cookieFor('admin');
const USER = cookieFor('user');
const UPLOADS = process.env.UPLOAD_DIRECTORY!;
const ICONS = path.join(UPLOADS, 'app-icons');
// A 1x1 PNG, so the stored bytes can be compared
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

let app: RunningApp;
const call: RunningApp['call'] = (...args) => app.call(...args);

type Part = { field: string; name: string; type?: string };
type Icon = { name: string; filePath: string; source: string };
type CustomIcon = { name: string; path: string; source: string };

/** Posts a multipart form with one PNG per part, as the admin unless told otherwise. */
const post = async (url: string, parts: Part[], cookie: string = ADMIN): Promise<Reply> => {
    const form = new FormData();
    form.append('note', 'a plain field, so the form is never empty');
    for (const part of parts) {
        form.append(part.field, new File([new Uint8Array(PNG)], part.name, { type: part.type ?? 'image/png' }));
    }
    const response = await fetch(`${app.baseUrl}${url}`, {
        method: 'POST', headers: { cookie }, body: form, signal: AbortSignal.timeout(8000)
    });
    return { status: response.status, body: await response.json(), headers: response.headers };
};
const files = (parts: string[]): Part[] => parts.map(name => ({ field: 'files', name }));
const byPath = (icons: CustomIcon[]): CustomIcon[] => [...icons].sort((a, b) => (a.path < b.path ? -1 : 1));
const stored = (): string[] => fs.readdirSync(ICONS).sort();

before(async () => {
    app = await startApp();
});
after(() => app.close());
beforeEach(() => {
    fs.rmSync(UPLOADS, { recursive: true, force: true });
    fs.mkdirSync(ICONS, { recursive: true });
});

describe('uploading one app icon', () => {
    it('needs a file in the "file" field', async () => {
        for (const reply of [await call('POST', '/api/app-shortcut/upload', ADMIN, {}), await post('/api/app-shortcut/upload', [])]) {
            assert.equal(reply.status, 400);
            assert.deepEqual(reply.body, { message: 'No file uploaded' });
        }
        assert.deepEqual(stored(), []);
    });

    it('stores the file under app-icons as <sanitized name>-<timestamp>.<ext> and reports a display name', async () => {
        const started = Date.now();

        const reply = await post('/api/app-shortcut/upload', [{ field: 'file', name: 'My App!.png' }]);

        assert.equal(reply.status, 200);
        assert.equal(reply.body.message, 'App icon uploaded successfully');
        assert.match(reply.body.filePath, /^\/uploads\/app-icons\/My-App-\d+\.png$/);
        const timestamp = Number(reply.body.filePath.match(/-(\d+)\.png$/)[1]);
        assert.ok(timestamp >= started && timestamp <= Date.now(), 'the suffix is the upload time');
        // The display name keeps the spaces and drops the characters that are not word, space, dot or dash
        assert.equal(reply.body.name, 'My App.png');
        assert.equal(reply.body.source, 'custom');

        const file = path.join(UPLOADS, reply.body.filePath.replace('/uploads/', ''));
        assert.deepEqual(fs.readFileSync(file), PNG);
        assert.deepEqual(stored(), [path.basename(file)]);
    });

    it('turns runs of spaces, underscores and dashes into one dash in the stored name and drops other characters', async () => {
        const reply = await post('/api/app-shortcut/upload', [{ field: 'file', name: 'my_cool  icon (v2)!.svg', type: 'image/svg+xml' }]);

        assert.equal(reply.status, 200);
        assert.match(reply.body.filePath, /^\/uploads\/app-icons\/my-cool-icon-v2-\d+\.svg$/);
        assert.equal(reply.body.name, 'my cool icon v2.svg');
        assert.match(stored()[0], /^my-cool-icon-v2-\d+\.svg$/);
    });

    it('keeps a file whose name carries a path inside the app-icons folder', async () => {
        const reply = await post('/api/app-shortcut/upload', [{ field: 'file', name: '../../escape.png' }]);

        assert.equal(reply.status, 200);
        assert.match(reply.body.filePath, /^\/uploads\/app-icons\/escape-\d+\.png$/);
        assert.match(stored()[0], /^escape-\d+\.png$/);
        assert.deepEqual(fs.readdirSync(UPLOADS), ['app-icons']);
        assert.equal(fs.existsSync(path.resolve(UPLOADS, '../escape.png')), false);
    });
});

describe('uploading several app icons at once', () => {
    it('needs at least one file in the "files" field', async () => {
        for (const reply of [await call('POST', '/api/app-shortcut/upload-batch', ADMIN, {}), await post('/api/app-shortcut/upload-batch', [])]) {
            assert.equal(reply.status, 400);
            assert.deepEqual(reply.body, { message: 'No files uploaded' });
        }
        assert.deepEqual(stored(), []);
    });

    it('stores each file and lists them in the order they were sent', async () => {
        const reply = await post('/api/app-shortcut/upload-batch', [
            ...files(['Plex.png', 'Sonarr Beta.png']), { field: 'files', name: 'radarr_v4.webp', type: 'image/webp' }
        ]);

        assert.equal(reply.status, 200);
        assert.equal(reply.body.message, '3 app icon(s) uploaded successfully');
        const icons = reply.body.icons as Icon[];
        assert.deepEqual(icons.map(icon => icon.name), ['Plex.png', 'Sonarr Beta.png', 'radarr v4.webp']);
        assert.match(icons[0].filePath, /^\/uploads\/app-icons\/Plex-\d+\.png$/);
        assert.match(icons[1].filePath, /^\/uploads\/app-icons\/Sonarr-Beta-\d+\.png$/);
        assert.match(icons[2].filePath, /^\/uploads\/app-icons\/radarr-v4-\d+\.webp$/);
        assert.deepEqual(icons.map(icon => icon.source), ['custom', 'custom', 'custom']);
        assert.deepEqual(stored(), icons.map(icon => path.basename(icon.filePath)).sort());
    });

    it('takes 20 files but refuses a batch of 21 and keeps none of them', async () => {
        const twenty = files(Array.from({ length: 20 }, (_, index) => `icon-${index}.png`));

        const accepted = await post('/api/app-shortcut/upload-batch', twenty);
        assert.equal(accepted.status, 200);
        assert.equal(accepted.body.icons.length, 20);
        assert.equal(stored().length, 20);

        fs.rmSync(ICONS, { recursive: true, force: true });
        const refused = await post('/api/app-shortcut/upload-batch', [...twenty, { field: 'files', name: 'one-too-many.png' }]);
        assert.equal(refused.status, 400);
        assert.equal(refused.body.success, false);
        // Multer's wording for a file past the limit differs between 2.x releases
        assert.match(refused.body.message, /^Unexpected (file )?field$/);
        assert.deepEqual(stored(), []);
    });
});

describe('listing custom icons', () => {
    it('is public, creates the folder when it is missing and answers with an empty list', async () => {
        fs.rmSync(ICONS, { recursive: true, force: true });

        const reply = await call('GET', '/api/app-shortcut/custom-icons');

        assert.equal(reply.status, 200);
        assert.deepEqual(reply.body, { icons: [] });
        assert.ok(fs.statSync(ICONS).isDirectory());
    });

    it('lists uploaded icons by display name, for guests and users alike', async () => {
        const uploaded = await post('/api/app-shortcut/upload', [{ field: 'file', name: 'My App!.png' }]);
        // A file that never went through the upload keeps its full name, with dashes shown as spaces
        fs.writeFileSync(path.join(ICONS, 'legacy-icon.svg'), PNG);
        // Not icons: a stray system file, a text file and a folder
        fs.writeFileSync(path.join(ICONS, '.DS_Store'), 'junk');
        fs.writeFileSync(path.join(ICONS, 'readme.txt'), 'notes');
        fs.mkdirSync(path.join(ICONS, 'nested.png'), { recursive: true });

        const guest = await call('GET', '/api/app-shortcut/custom-icons');
        const user = await call('GET', '/api/app-shortcut/custom-icons', USER);

        assert.equal(guest.status, 200);
        assert.deepEqual(byPath(guest.body.icons), [
            { name: 'My App.png', path: uploaded.body.filePath, source: 'custom' },
            { name: 'legacy icon.svg', path: '/uploads/app-icons/legacy-icon.svg', source: 'custom' }
        ]);
        assert.equal(user.status, 200);
        assert.deepEqual(byPath(user.body.icons), byPath(guest.body.icons));
    });
});
