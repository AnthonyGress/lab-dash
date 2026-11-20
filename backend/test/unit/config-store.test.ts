// Must stay first: it swaps in the test config before any app module loads
import '../helpers/fixture-config';

import { Request, Response } from 'express';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, TestContext } from 'node:test';

import { ConfigChange, getConfig, getConfigFile, onConfigChanged, updateConfig } from '../../src/services/config-store';
import { Config } from '../../src/types';
import { trackRequestOrigin } from '../../src/utils/request-origin';

const CONFIG_FILE = process.env.CONFIG_FILE!;
const TEMP_DIR = path.dirname(CONFIG_FILE);

const emptyConfig = (): Config => ({ layout: { desktop: [], mobile: [] } });

/** Points the store at `file` while `body` runs, then back at the fixture. */
const withConfigFile = <T>(file: string, body: () => T): T => {
    const previous = process.env.CONFIG_FILE;
    process.env.CONFIG_FILE = file;
    try {
        return body();
    } finally {
        process.env.CONFIG_FILE = previous;
    }
};

/** Every change announced from now until the test ends. */
const recordChanges = (t: TestContext): ConfigChange[] => {
    const changes: ConfigChange[] = [];
    t.after(onConfigChanged(change => changes.push(change)));
    return changes;
};

/** Runs `body` as if it were handling a request sent by the browser tab `clientId`. */
const asRequestFrom = (clientId: string, body: () => void): void => {
    const request = { get: (name: string) => (name === 'x-client-id' ? clientId : undefined) } as unknown as Request;
    trackRequestOrigin(request, {} as Response, body);
};

const afterPendingCallbacks = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

const temporaryFilesNextToConfig = (): string[] => fs.readdirSync(TEMP_DIR).filter(name => name.endsWith('.tmp'));

/** Unreadable configs are reported with console.error; keep that out of the test output. */
const quiet = (t: TestContext): void => {
    t.mock.method(console, 'error', () => undefined);
};

describe('getConfigFile', () => {
    it('follows CONFIG_FILE', () => {
        assert.equal(getConfigFile(), CONFIG_FILE);

        const elsewhere = path.join(TEMP_DIR, 'elsewhere.json');
        assert.equal(withConfigFile(elsewhere, getConfigFile), elsewhere);
        assert.equal(getConfigFile(), CONFIG_FILE);
    });
});

describe('getConfig', () => {
    it('falls back to an empty layout when the file is missing', () => {
        const missing = path.join(TEMP_DIR, 'missing.json');
        assert.deepEqual(withConfigFile(missing, getConfig), emptyConfig());
    });

    it('falls back to an empty layout when the file is blank', (t) => {
        quiet(t);
        const blank = path.join(TEMP_DIR, 'blank.json');
        fs.writeFileSync(blank, ' \n\t\n', 'utf-8');
        assert.deepEqual(withConfigFile(blank, getConfig), emptyConfig());
    });

    it('falls back to an empty layout when the file is not JSON', (t) => {
        quiet(t);
        const broken = path.join(TEMP_DIR, 'broken.json');
        fs.writeFileSync(broken, '{ "layout": ', 'utf-8');
        assert.doesNotThrow(() => withConfigFile(broken, getConfig));
        assert.deepEqual(withConfigFile(broken, getConfig), emptyConfig());
    });

    it('hands out the same parsed config until it is saved again', () => {
        const first = getConfig();
        assert.equal(getConfig(), first);

        const saved = updateConfig(draft => {
            draft.title = 'saved once';
        });

        const second = getConfig();
        assert.notEqual(second, first);
        assert.equal(second.title, 'saved once');
        assert.deepEqual(second, saved);
    });

    it('picks up an edit made outside the app and announces it afterwards', async (t) => {
        const changes = recordChanges(t);
        const before = getConfig();

        let content = JSON.stringify({ ...before, title: 'edited outside the app' }, null, 2);
        // A same-sized write within the same mtime tick would look unchanged
        while (Buffer.byteLength(content) === fs.statSync(CONFIG_FILE).size) content += '\n';
        fs.writeFileSync(CONFIG_FILE, content, 'utf-8');

        const after = getConfig();
        assert.notEqual(after, before);
        assert.equal(after.title, 'edited outside the app');
        assert.equal(getConfig(), after);

        assert.equal(changes.length, 0, 'the change is announced after the read returns');
        await afterPendingCallbacks();
        assert.equal(changes.length, 1);
        assert.equal(changes[0].scope, 'config');
        assert.equal(changes[0].origin, undefined);
    });
});

describe('updateConfig', () => {
    it('gives the mutation a copy, leaving the config handed out earlier alone', () => {
        const before = getConfig();
        const title = before.title;
        const items = before.layout.desktop.length;

        updateConfig(draft => {
            draft.title = 'changed in the draft';
            draft.layout.desktop.push({ id: 'added', label: 'Added', type: 'app-shortcut' });
        });

        assert.equal(before.title, title);
        assert.equal(before.layout.desktop.length, items);
        assert.equal(getConfig().title, 'changed in the draft');
        assert.equal(getConfig().layout.desktop.length, items + 1);
    });

    it('saves what the mutation returns, or the draft when it returns nothing', () => {
        const replaced = updateConfig(() => ({ ...emptyConfig(), title: 'replaced' }));
        assert.equal(replaced.title, 'replaced');
        assert.deepEqual(getConfig(), { ...emptyConfig(), title: 'replaced' });

        const mutated = updateConfig(draft => {
            draft.title = 'mutated';
        });
        assert.equal(mutated.title, 'mutated');
        assert.equal(getConfig().title, 'mutated');
    });

    it('writes the result to disk as indented JSON without leaving a temporary file', () => {
        const saved = updateConfig(draft => {
            draft.title = 'on disk';
        });

        assert.equal(fs.readFileSync(CONFIG_FILE, 'utf-8'), JSON.stringify(saved, null, 2));
        assert.deepEqual(temporaryFilesNextToConfig(), []);
    });

    it('hands back the config the next read returns', () => {
        const saved = updateConfig(draft => {
            draft.title = 'handed back';
        });
        assert.deepEqual(getConfig(), saved);
    });

    it('creates the directory of a config file that does not exist yet', () => {
        const nested = path.join(TEMP_DIR, 'nested', 'deeper', 'config.json');
        assert.equal(fs.existsSync(path.dirname(nested)), false);

        const saved = withConfigFile(nested, () => updateConfig(draft => {
            draft.title = 'first save';
        }));

        assert.deepEqual(saved, { ...emptyConfig(), title: 'first save' });
        assert.equal(fs.readFileSync(nested, 'utf-8'), JSON.stringify(saved, null, 2));
        assert.deepEqual(fs.readdirSync(path.dirname(nested)), ['config.json']);
        assert.equal(getConfigFile(), CONFIG_FILE);
    });
});

describe('onConfigChanged', () => {
    it('tells listeners what changed, with config as the default scope', (t) => {
        const changes = recordChanges(t);

        updateConfig(draft => {
            draft.title = 'scoped';
        });

        assert.equal(changes.length, 1);
        assert.equal(changes[0].scope, 'config');
        assert.equal(changes[0].origin, undefined);
    });

    it('passes the notes scope through', (t) => {
        const changes = recordChanges(t);

        updateConfig(draft => {
            draft.notes = [];
        }, 'notes');

        assert.deepEqual(changes.map(change => change.scope), ['notes']);
    });

    it('stops calling a listener once it unsubscribes', () => {
        const changes: ConfigChange[] = [];
        const unsubscribe = onConfigChanged(change => changes.push(change));

        updateConfig(draft => {
            draft.title = 'heard';
        });
        unsubscribe();
        updateConfig(draft => {
            draft.title = 'not heard';
        });

        assert.equal(changes.length, 1);
    });

    it('names the browser tab whose request made the change', (t) => {
        const changes = recordChanges(t);

        asRequestFrom('tab-42', () => updateConfig(draft => {
            draft.title = 'from a tab';
        }));

        assert.deepEqual(changes, [{ scope: 'config', origin: 'tab-42' }]);
    });

    it('leaves the origin out for a change made outside a request or with an oversized client id', (t) => {
        const changes = recordChanges(t);

        updateConfig(draft => {
            draft.title = 'no request';
        });
        asRequestFrom('x'.repeat(65), () => updateConfig(draft => {
            draft.title = 'oversized id';
        }));

        assert.deepEqual(changes.map(change => change.origin), [undefined, undefined]);
    });
});
