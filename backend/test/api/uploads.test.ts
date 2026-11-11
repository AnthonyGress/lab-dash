// Must stay first: it swaps in the test config before any app module loads
import '../helpers/fixture-config';

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';

import { RunningApp, startApp } from '../helpers/http';
import { cookieFor } from '../helpers/sessions';

const ADMIN = cookieFor('admin');
const UPLOADS = process.env.UPLOAD_DIRECTORY!;
const ICONS = path.join(UPLOADS, 'app-icons');
// A 1x1 PNG, so served files have real image bytes to compare
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

let app: RunningApp;
const call: RunningApp['call'] = (...args) => app.call(...args);

type Listed = { name: string; path: string; size: number; uploadDate: string; type: string };

/** Writes `relative` (a path inside the uploads folder) and returns its full path. */
const seed = (relative: string, content: Buffer | string = PNG): string => {
    const file = path.join(UPLOADS, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    return file;
};
const listImages = () => call('GET', '/api/uploads/images', ADMIN);
const paths = (images: Listed[]): string[] => images.map(image => image.path);
const remove = (imagePath: unknown) => call('DELETE', '/api/uploads/images', ADMIN, { imagePath });
const pause = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

before(async () => {
    app = await startApp();
});
after(() => app.close());
beforeEach(() => {
    fs.rmSync(UPLOADS, { recursive: true, force: true });
    fs.mkdirSync(ICONS, { recursive: true });
});

describe('listing uploaded images', () => {
    it('reports root files as backgrounds and app-icons files as app icons', async () => {
        seed('wallpaper.jpg');
        seed('app-icons/plex-1700000000000.png');

        const { status, body } = await listImages();

        assert.equal(status, 200);
        const byPath = Object.fromEntries((body.images as Listed[]).map(image => [image.path, image]));
        assert.deepEqual(Object.keys(byPath).sort(), ['/uploads/app-icons/plex-1700000000000.png', '/uploads/wallpaper.jpg']);
        assert.equal(byPath['/uploads/wallpaper.jpg'].type, 'background');
        assert.equal(byPath['/uploads/wallpaper.jpg'].name, 'wallpaper.jpg');
        assert.equal(byPath['/uploads/app-icons/plex-1700000000000.png'].type, 'app-icon');
        // The timestamp the upload added comes off the display name, the extension stays
        assert.equal(byPath['/uploads/app-icons/plex-1700000000000.png'].name, 'plex.png');
        for (const image of body.images as Listed[]) {
            assert.equal(image.size, PNG.length, image.path);
            assert.ok(Number.isFinite(Date.parse(image.uploadDate)), image.path);
        }
    });

    it('keeps the hyphenated parts of an icon name and leaves names without a timestamp alone', async () => {
        seed('app-icons/my-app-1700000000001.PNG');
        seed('app-icons/logo.svg');

        const names = (await listImages()).body.images.map((image: Listed) => image.name).sort();

        assert.deepEqual(names, ['logo.svg', 'my-app.PNG']);
    });

    it('skips files that are not images, sub-directories and anything inside other folders', async () => {
        seed('notes.txt', 'not an image');
        seed('app-icons/readme.md', 'not an image');
        seed('other-folder/hidden.png');
        seed('app-icons/nested/deep.png');
        seed('shown.webp');

        const { body } = await listImages();

        assert.deepEqual(paths(body.images), ['/uploads/shown.webp']);
    });

    it('sorts newest first across both folders', async () => {
        // The sort reads each file's birth time, which cannot be set afterwards, so the files are created in order
        seed('app-icons/first-1700000000000.png');
        await pause(30);
        seed('second.png');
        await pause(30);
        seed('app-icons/third-1700000000000.png');
        await pause(30);
        seed('fourth.jpg');

        const { body } = await listImages();

        assert.deepEqual(paths(body.images), [
            '/uploads/fourth.jpg',
            '/uploads/app-icons/third-1700000000000.png',
            '/uploads/second.png',
            '/uploads/app-icons/first-1700000000000.png'
        ]);
    });

    it('answers with an empty list when the folders are empty or missing', async () => {
        assert.deepEqual((await listImages()).body, { images: [] });

        fs.rmdirSync(ICONS);
        assert.deepEqual((await listImages()).body, { images: [] });

        fs.rmSync(UPLOADS, { recursive: true, force: true });
        const reply = await listImages();
        assert.equal(reply.status, 200);
        assert.deepEqual(reply.body, { images: [] });
    });
});

describe('deleting an uploaded image', () => {
    it('removes a background or an app icon by the path it is served from', async () => {
        const background = seed('wallpaper.jpg');
        const icon = seed('app-icons/plex-1700000000000.png');

        const first = await remove('/uploads/wallpaper.jpg');
        assert.equal(first.status, 200);
        assert.deepEqual(first.body, { message: 'Image deleted successfully' });
        assert.equal(fs.existsSync(background), false);
        assert.equal(fs.existsSync(icon), true);

        assert.equal((await remove('/uploads/app-icons/plex-1700000000000.png')).status, 200);
        assert.equal(fs.existsSync(icon), false);
        assert.ok(fs.statSync(ICONS).isDirectory(), 'the app-icons folder stays');
    });

    it('accepts the path without its leading slash', async () => {
        const file = seed('wallpaper.jpg');

        assert.equal((await remove('uploads/wallpaper.jpg')).status, 200);
        assert.equal(fs.existsSync(file), false);
    });

    it('needs a non-empty string image path', async () => {
        seed('wallpaper.jpg');
        const bodies = [undefined, {}, { imagePath: 42 }, { imagePath: '' }, { imagePath: null }, { imagePath: ['/uploads/wallpaper.jpg'] }];

        for (const body of bodies) {
            const reply = await call('DELETE', '/api/uploads/images', ADMIN, body);
            assert.equal(reply.status, 400, JSON.stringify(body));
            assert.deepEqual(reply.body, { message: 'Image path is required' });
        }
        assert.deepEqual(fs.readdirSync(UPLOADS).sort(), ['app-icons', 'wallpaper.jpg']);
    });

    it('answers 404 for a file that is not there and for the app-icons folder itself', async () => {
        const missing = await remove('/uploads/missing.png');
        assert.equal(missing.status, 404);
        assert.deepEqual(missing.body, { message: 'Image not found' });

        // A folder is not an image: it stays, and the caller is told there is no such image
        const folder = await remove('/uploads/app-icons');
        assert.equal(folder.status, 404);
        assert.ok(fs.statSync(ICONS).isDirectory());
    });

    it('refuses paths that would leave the uploads folder, and the target is untouched', async () => {
        const configFile = process.env.CONFIG_FILE!;
        // The config file sits right next to the uploads folder, so one '..' reaches it
        assert.equal(path.resolve(UPLOADS, '../config.json'), configFile);
        const configBefore = fs.readFileSync(configFile, 'utf-8');
        const legit = seed('legit.png');
        const escapes = [
            '/uploads/../config.json',
            '/uploads/app-icons/../../config.json',
            '/uploads//etc/passwd',
            '../../etc/passwd',
            '/etc/passwd',
            'uploads-evil/x.png',
            '/uploads/',
            '/uploads/.',
            '/uploads/..',
            'legit.png'
        ];

        for (const imagePath of escapes) {
            const reply = await remove(imagePath);
            assert.equal(reply.status, 400, imagePath);
            assert.deepEqual(reply.body, { message: 'Invalid image path' }, imagePath);
        }

        assert.equal(fs.readFileSync(configFile, 'utf-8'), configBefore);
        assert.equal(fs.existsSync(legit), true);
    });
});

describe('serving uploaded files', () => {
    it('hands out the bytes of a background and of an app icon', async () => {
        seed('wallpaper.png');
        seed('app-icons/plex-1700000000000.png');

        for (const url of ['/uploads/wallpaper.png', '/uploads/app-icons/plex-1700000000000.png']) {
            const response = await fetch(`${app.baseUrl}${url}`);
            assert.equal(response.status, 200, url);
            assert.match(response.headers.get('content-type') ?? '', /^image\/png/, url);
            assert.deepEqual(Buffer.from(await response.arrayBuffer()), PNG, url);
        }
    });
});
