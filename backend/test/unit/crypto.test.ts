// Must stay first: it swaps in the test config before any app module loads

import '../helpers/fixture-config';

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { describe, it, TestContext } from 'node:test';

import { decrypt, encrypt, isEncrypted } from '../../src/utils/crypto';

const SAMPLES = [
    'hunter2',
    'api-key:with:colons',
    'pässwörd ünïcödé 密码 🔐',
    'x'.repeat(10_000)
];

/** Encrypts `text` with the app's scheme but under `key` instead of SECRET. */
const encryptWithKey = (text: string, key: string): string => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', crypto.scryptSync(key, 'salt', 32), iv);
    const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return `ENC:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${data.toString('base64')}`;
};

/** Encrypts `text` the way versions before 1.4 did: AES-256-CBC, ENC:<iv>:<data>. */
const encryptLegacy = (text: string, key: string = process.env.SECRET!): string => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', crypto.scryptSync(key, 'salt', 32), iv);
    const data = cipher.update(text, 'utf8', 'base64') + cipher.final('base64');
    return `ENC:${iv.toString('base64')}:${data}`;
};

/** A failed decrypt logs the cause; keep that out of the test output. */
const quiet = (t: TestContext): void => {
    t.mock.method(console, 'error', () => undefined);
    t.mock.method(console, 'warn', () => undefined);
};

describe('encrypt', () => {
    it('round-trips plain, unicode and long text', () => {
        for (const text of SAMPLES) {
            assert.equal(decrypt(encrypt(text)), text);
        }
    });

    it('produces ENC:<iv>:<tag>:<data> with a 12-byte IV and a 16-byte tag, all base64', () => {
        const parts = encrypt('secret').split(':');
        assert.equal(parts.length, 4);
        assert.equal(parts[0], 'ENC');
        assert.equal(Buffer.from(parts[1], 'base64').length, 12);
        assert.equal(Buffer.from(parts[2], 'base64').length, 16);
        assert.equal(Buffer.from(parts[3], 'base64').length, 'secret'.length);
    });

    it('uses a fresh IV each time, so the same text never encrypts the same way twice', () => {
        const first = encrypt('same text');
        const second = encrypt('same text');
        assert.notEqual(first, second);
        assert.equal(decrypt(first), 'same text');
        assert.equal(decrypt(second), 'same text');
    });

    it('leaves an empty string empty', () => {
        assert.equal(encrypt(''), '');
    });
});

describe('isEncrypted', () => {
    it('recognises only the ENC: prefix', () => {
        assert.equal(isEncrypted(encrypt('value')), true);
        assert.equal(isEncrypted('ENC:'), true);
        assert.equal(isEncrypted('enc:lowercase'), false);
        assert.equal(isEncrypted('a value with ENC: inside'), false);
        assert.equal(isEncrypted('plain'), false);
        assert.equal(isEncrypted(''), false);
    });

    it('is false for a missing value', () => {
        assert.equal(isEncrypted(undefined as unknown as string), false);
        assert.equal(isEncrypted(null as unknown as string), false);
    });
});

describe('decrypt', () => {
    it('returns text that was never encrypted unchanged', () => {
        assert.equal(decrypt('plain-password'), 'plain-password');
        assert.equal(decrypt('enc:not-the-marker'), 'enc:not-the-marker');
        assert.equal(decrypt(''), '');
    });

    it('still reads values saved by versions before 1.4', () => {
        for (const text of SAMPLES) {
            const legacy = encryptLegacy(text);
            assert.equal(legacy.split(':').length, 3);
            assert.equal(decrypt(legacy), text);
        }
    });

    it('returns an empty string for the wrong number of parts', (t) => {
        quiet(t);
        assert.equal(decrypt('ENC:'), '');
        assert.equal(decrypt('ENC:only-one-part'), '');
        assert.equal(decrypt(`${encrypt('secret')}:extra`), '');
    });

    it('returns an empty string instead of throwing on garbage', (t) => {
        quiet(t);
        const [, iv] = encrypt('secret').split(':');
        for (const garbage of ['ENC:!!:!!', 'ENC:short-iv:AAAA', `ENC:${iv}:not-a-whole-block`, `ENC:${iv}:`]) {
            assert.doesNotThrow(() => decrypt(garbage));
            assert.equal(decrypt(garbage), '');
        }
    });

    it('returns an empty string when any byte of the ciphertext or tag was changed', (t) => {
        quiet(t);
        const [prefix, iv, tag, data] = encrypt('a secret worth checking').split(':');

        for (let position = 0; position < Buffer.from(data, 'base64').length; position++) {
            const bytes = Buffer.from(data, 'base64');
            bytes[position] ^= 0x01;
            assert.equal(decrypt(`${prefix}:${iv}:${tag}:${bytes.toString('base64')}`), '', `byte ${position}`);
        }

        const tagBytes = Buffer.from(tag, 'base64');
        tagBytes[0] ^= 0x01;
        assert.equal(decrypt(`${prefix}:${iv}:${tagBytes.toString('base64')}:${data}`), '');
    });

    it('returns an empty string for a value encrypted under another key, every time', (t) => {
        quiet(t);
        for (let attempt = 0; attempt < 50; attempt++) {
            const foreign = encryptWithKey('secret', 'some-other-secret-that-is-long-enough');
            assert.equal(isEncrypted(foreign), true);
            assert.equal(decrypt(foreign), '');
        }
        // The same holds for the format of versions before 1.4, bar the rare padding that happens to look valid
        const foreignLegacy = encryptLegacy('secret', 'some-other-secret-that-is-long-enough');
        assert.notEqual(decrypt(foreignLegacy), 'secret');
    });
});
