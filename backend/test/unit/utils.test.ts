// Must stay first: it swaps in the test config before any app module loads
import '../helpers/fixture-config';

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, it, TestContext } from 'node:test';

import { UPLOAD_DIRECTORY } from '../../src/constants/constants';
import { removeExistingFiles } from '../../src/utils/utils';

const ICONS = path.join(UPLOAD_DIRECTORY, 'app-icons');

/** Writes a small file at `relative`, a path inside the uploads folder. */
const write = (relative: string): void => {
    const file = path.join(UPLOAD_DIRECTORY, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, relative);
};
const entries = (directory: string): string[] => fs.readdirSync(directory).sort();

beforeEach(() => {
    fs.rmSync(UPLOAD_DIRECTORY, { recursive: true, force: true });
    fs.mkdirSync(ICONS, { recursive: true });
});

describe('removeExistingFiles', () => {
    it('works on the uploads folder the tests point the app at', () => {
        assert.equal(UPLOAD_DIRECTORY, process.env.UPLOAD_DIRECTORY);
    });

    it('removes every file at the root of the uploads folder, whatever its name', () => {
        write('wallpaper.png');
        write('photo.JPG');
        write('notes.txt');
        write('.hidden');

        removeExistingFiles();

        assert.deepEqual(entries(UPLOAD_DIRECTORY), ['app-icons']);
    });

    it('keeps the one file it is told to keep', () => {
        write('old.png');
        write('new.png');

        removeExistingFiles('new.png');

        assert.deepEqual(entries(UPLOAD_DIRECTORY), ['app-icons', 'new.png']);
        assert.equal(fs.readFileSync(path.join(UPLOAD_DIRECTORY, 'new.png'), 'utf-8'), 'new.png');
    });

    it('never touches sub-directories or what is inside them', () => {
        write('background.png');
        write('app-icons/plex-1700000000000.png');
        write('app-icons/nested/deep.png');
        fs.mkdirSync(path.join(UPLOAD_DIRECTORY, 'empty-folder'));

        removeExistingFiles();

        assert.deepEqual(entries(UPLOAD_DIRECTORY), ['app-icons', 'empty-folder']);
        assert.deepEqual(entries(ICONS), ['nested', 'plex-1700000000000.png']);
        assert.deepEqual(entries(path.join(ICONS, 'nested')), ['deep.png']);
    });

    it('does nothing when there is nothing to remove', () => {
        removeExistingFiles();
        removeExistingFiles('not-there.png');

        assert.deepEqual(entries(UPLOAD_DIRECTORY), ['app-icons']);
    });

    it('logs instead of throwing when the folder is missing, and does not create it', (t: TestContext) => {
        const logged = t.mock.method(console, 'error', () => undefined);
        fs.rmSync(UPLOAD_DIRECTORY, { recursive: true, force: true });

        assert.doesNotThrow(() => removeExistingFiles());
        assert.doesNotThrow(() => removeExistingFiles('anything.png'));

        assert.equal(logged.mock.callCount(), 2);
        assert.equal(fs.existsSync(UPLOAD_DIRECTORY), false);
    });
});
