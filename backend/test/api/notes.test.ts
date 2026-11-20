// Must stay first: it swaps in the test config before any app module loads
import '../helpers/fixture-config';

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { getConfig, updateConfig } from '../../src/services/config-store';
import { Note } from '../../src/types';
import { saveFixture } from '../helpers/fixture-config';
import { RunningApp, startApp } from '../helpers/http';
import { cookieFor } from '../helpers/sessions';

const ADMIN = cookieFor('admin');
const USER = cookieFor('user');
const PAST = '2024-01-01T00:00:00.000Z';

let app: RunningApp;
const call: RunningApp['call'] = (...args) => app.call(...args);

const note = (id: string, updatedAt: string, fontSize?: string): Note => ({
    id, title: `Note ${id}`, content: `Content ${id}`, createdAt: updatedAt, updatedAt, ...(fontSize ? { fontSize } : {})
});
const seed = (...notes: Note[]): void => {
    updateConfig(draft => {
        draft.notes = notes;
    });
};
const setDefaultFontSize = (size: string): void => {
    updateConfig(draft => {
        Object.assign(draft, { defaultNoteFontSize: size });
    });
};
const storedNotes = (): Note[] => getConfig().notes ?? [];
const storedNote = (id: string): Note | undefined => storedNotes().find(saved => saved.id === id);

before(async () => {
    app = await startApp();
});
after(() => app.close());
beforeEach(() => saveFixture());

describe('listing notes', () => {
    it('is public and lists the most recently updated first', async () => {
        seed(note('old', '2024-01-01T00:00:00.000Z', '16px'), note('new', '2024-03-01T00:00:00.000Z', '16px'), note('mid', '2024-02-01T00:00:00.000Z', '16px'));

        const reply = await call('GET', '/api/notes');

        assert.equal(reply.status, 200);
        assert.deepEqual(reply.body.map((listed: Note) => listed.id), ['new', 'mid', 'old']);
        assert.deepEqual(reply.body[0], note('new', '2024-03-01T00:00:00.000Z', '16px'));
    });

    it('answers with an empty list when there are no notes', async () => {
        const reply = await call('GET', '/api/notes');

        assert.equal(reply.status, 200);
        assert.deepEqual(reply.body, []);
    });

    it('gives notes saved without a font size the dashboard default, and keeps it', async () => {
        setDefaultFontSize('14px');
        seed(note('plain', PAST), note('sized', PAST, '20px'));

        const { body } = await call('GET', '/api/notes');

        assert.equal(body.find((listed: Note) => listed.id === 'plain').fontSize, '14px');
        assert.equal(body.find((listed: Note) => listed.id === 'sized').fontSize, '20px');
        assert.equal(storedNote('plain')!.fontSize, '14px');
        assert.equal(storedNote('sized')!.fontSize, '20px');
    });

    it('falls back to 16px when the dashboard has no default', async () => {
        seed(note('plain', PAST));

        assert.equal((await call('GET', '/api/notes')).body[0].fontSize, '16px');
        assert.equal(storedNote('plain')!.fontSize, '16px');
    });
});

describe('creating a note', () => {
    const draft = { id: 'n1', title: 'Shopping', content: 'Milk' };

    it('needs a login, not an admin', async () => {
        assert.equal((await call('POST', '/api/notes', undefined, draft)).status, 401);
        assert.equal((await call('POST', '/api/notes', USER, draft)).status, 201);
        assert.equal((await call('POST', '/api/notes', ADMIN, { ...draft, id: 'n2' })).status, 201);
        assert.deepEqual(storedNotes().map(saved => saved.id), ['n1', 'n2']);
    });

    it('requires a string id and title', async () => {
        const malformed = [{}, { title: 'T' }, { id: 7, title: 'T' }, { id: 'n1' }, { id: 'n1', title: '' }, { id: 'n1', title: ['T'] }];

        for (const body of malformed) {
            const reply = await call('POST', '/api/notes', USER, body);
            assert.equal(reply.status, 400, JSON.stringify(body));
            assert.equal(typeof reply.body.error, 'string');
        }
        assert.equal(getConfig().notes, undefined);
    });

    it('refuses an id that is already taken', async () => {
        seed(note('n1', PAST, '16px'));

        const reply = await call('POST', '/api/notes', USER, draft);

        assert.equal(reply.status, 409);
        assert.deepEqual(storedNotes(), [note('n1', PAST, '16px')]);
    });

    it('trims the text, stamps both dates and fills in the font size', async () => {
        const reply = await call('POST', '/api/notes', USER, { id: 'n1', title: '  Shopping  ', content: '  Milk \n' });

        assert.equal(reply.status, 201);
        const { createdAt, updatedAt, ...rest } = reply.body;
        assert.deepEqual(rest, { id: 'n1', title: 'Shopping', content: 'Milk', fontSize: '16px' });
        assert.equal(createdAt, updatedAt);
        assert.ok(Date.now() - new Date(createdAt).getTime() < 10_000);
        assert.deepEqual(storedNote('n1'), reply.body);
    });

    it('uses the dashboard default font size unless the note brings its own', async () => {
        setDefaultFontSize('14px');

        const defaulted = await call('POST', '/api/notes', USER, { id: 'a', title: 'A' });
        const own = await call('POST', '/api/notes', USER, { id: 'b', title: 'B', fontSize: '22px' });

        assert.equal(defaulted.body.fontSize, '14px');
        assert.equal(defaulted.body.content, '');
        assert.equal(own.body.fontSize, '22px');
    });
});

describe('updating a note', () => {
    beforeEach(() => seed(note('n1', PAST, '18px'), note('n2', PAST)));

    it('needs a login', async () => {
        assert.equal((await call('PUT', '/api/notes/n1', undefined, { title: 'T' })).status, 401);
        assert.equal(storedNote('n1')!.title, 'Note n1');
    });

    it('changes the text, keeps the font size and moves updatedAt forward', async () => {
        const reply = await call('PUT', '/api/notes/n1', USER, { title: ' Renamed ', content: ' Changed ' });

        assert.equal(reply.status, 200);
        const { updatedAt, ...rest } = reply.body;
        assert.deepEqual(rest, { id: 'n1', title: 'Renamed', content: 'Changed', createdAt: PAST, fontSize: '18px' });
        assert.ok(new Date(updatedAt).getTime() > new Date(PAST).getTime());
        assert.deepEqual(storedNote('n1'), reply.body);
        assert.deepEqual(storedNote('n2'), note('n2', PAST));
    });

    it('takes a new font size, or the default for a note that never had one', async () => {
        const changed = await call('PUT', '/api/notes/n1', USER, { title: 'T', fontSize: '24px' });
        const migrated = await call('PUT', '/api/notes/n2', USER, { title: 'T' });

        assert.equal(changed.body.fontSize, '24px');
        assert.equal(migrated.body.fontSize, '16px');
        assert.equal(migrated.body.content, '');
    });

    it('requires a title and knows only existing notes', async () => {
        assert.equal((await call('PUT', '/api/notes/n1', USER, { content: 'no title' })).status, 400);
        assert.equal((await call('PUT', '/api/notes/n1', USER, { title: 42 })).status, 400);
        assert.equal((await call('PUT', '/api/notes/missing', USER, { title: 'T' })).status, 404);
        assert.deepEqual(storedNotes(), [note('n1', PAST, '18px'), note('n2', PAST)]);
    });
});

describe('changing the font size of every note', () => {
    it('applies to every note and reports how many', async () => {
        seed(note('n1', PAST, '18px'), note('n2', PAST), note('n3', PAST, '12px'));

        const reply = await call('PUT', '/api/notes/update-all-font-sizes', USER, { fontSize: '20px' });

        assert.equal(reply.status, 200);
        assert.deepEqual(reply.body, { message: 'Updated font size for 3 notes', updatedCount: 3 });
        assert.deepEqual(storedNotes(), [note('n1', PAST, '20px'), note('n2', PAST, '20px'), note('n3', PAST, '20px')]);
    });

    it('needs a login and a font size', async () => {
        seed(note('n1', PAST, '18px'));

        assert.equal((await call('PUT', '/api/notes/update-all-font-sizes', undefined, { fontSize: '20px' })).status, 401);
        assert.equal((await call('PUT', '/api/notes/update-all-font-sizes', USER, {})).status, 400);
        assert.equal((await call('PUT', '/api/notes/update-all-font-sizes', USER, { fontSize: 20 })).status, 400);
        assert.equal(storedNote('n1')!.fontSize, '18px');
    });
});

describe('deleting a note', () => {
    beforeEach(() => seed(note('n1', PAST, '16px'), note('n2', PAST, '16px')));

    it('removes just that note', async () => {
        const reply = await call('DELETE', '/api/notes/n1', USER);

        assert.equal(reply.status, 204);
        assert.equal(reply.body, '');
        assert.deepEqual(storedNotes(), [note('n2', PAST, '16px')]);
    });

    it('needs a login and an existing note', async () => {
        assert.equal((await call('DELETE', '/api/notes/n1')).status, 401);
        assert.equal((await call('DELETE', '/api/notes/missing', USER)).status, 404);
        assert.equal(storedNotes().length, 2);
    });
});

describe('notes and the rest of the config', () => {
    it('leaves the layout, pages and settings as they were', async () => {
        updateConfig(draft => {
            draft.title = 'My dashboard';
        });
        const previous = structuredClone(getConfig());

        await call('POST', '/api/notes', USER, { id: 'n1', title: 'A' });
        await call('PUT', '/api/notes/n1', USER, { title: 'B' });
        await call('PUT', '/api/notes/update-all-font-sizes', USER, { fontSize: '20px' });
        await call('DELETE', '/api/notes/n1', USER);

        const { notes, ...rest } = getConfig();
        assert.deepEqual(notes, []);
        assert.deepEqual(rest, previous);
    });
});
