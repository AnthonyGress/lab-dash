// Must stay first: it swaps in the test config before any app module loads
import '../helpers/fixture-config';

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, afterEach, before, describe, it } from 'node:test';

import { readUsers, writeUsers } from '../../src/services/users';
import { REFRESH_TOKEN_KEY } from '../../src/utils/secret';
import { Reply, RunningApp, startApp } from '../helpers/http';
import { cookieFor } from '../helpers/sessions';

const PASSWORD = 'correct horse battery staple';
const DAY_SECONDS = 24 * 60 * 60;

const ADMIN = cookieFor('admin');
const USER = cookieFor('user');
// The fixture accounts have no password; this one logs in for real
writeUsers([...readUsers(), { username: 'owner', passwordHash: bcrypt.hashSync(PASSWORD, 4), role: 'admin' }]);
// Taken after the sessions and the account above exist, so a reset keeps them
const fixtureUsers = readUsers();

let app: RunningApp;
const call: RunningApp['call'] = (...args) => app.call(...args);

type SetCookie = { name: string; value: string; attributes: Record<string, string> };

/** Every cookie a reply sets, with attribute names lower-cased and flags mapped to '' */
const cookiesSet = (reply: Reply): SetCookie[] => reply.headers.getSetCookie().map(line => {
    const [pair, ...rest] = line.split('; ');
    const attributes: Record<string, string> = {};
    for (const part of rest) {
        const [key, ...value] = part.split('=');
        attributes[key.toLowerCase()] = value.join('=');
    }
    return { name: pair.slice(0, pair.indexOf('=')), value: pair.slice(pair.indexOf('=') + 1), attributes };
});

const cookieSet = (reply: Reply, name: string): SetCookie => {
    const found = cookiesSet(reply).filter(cookie => cookie.name === name);
    assert.equal(found.length, 1, `${name} set once`);
    return found[0];
};

const sessionCookies = (reply: Reply): string => (
    cookiesSet(reply).map(cookie => `${cookie.name}=${cookie.value}`).join('; ')
);

const login = (username: string, password = PASSWORD): Promise<Reply> => (
    call('POST', '/api/auth/login', undefined, { username, password })
);

before(async () => {
    app = await startApp();
});
after(() => app.close());

describe('signing up', () => {
    afterEach(() => writeUsers(fixtureUsers));

    it('requires a username and a password', async () => {
        for (const body of [{}, { username: 'someone' }, { password: PASSWORD }, { username: '', password: PASSWORD }]) {
            const reply = await call('POST', '/api/auth/signup', undefined, body);
            assert.equal(reply.status, 400, JSON.stringify(body));
            assert.deepEqual(reply.body, { message: 'Username and password are required' });
        }
        assert.deepEqual(readUsers(), fixtureUsers);
    });

    it('refuses a username that is already taken', async () => {
        const reply = await call('POST', '/api/auth/signup', undefined, { username: 'admin', password: PASSWORD });

        assert.equal(reply.status, 409);
        assert.deepEqual(reply.body, { message: 'Username already exists' });
        assert.deepEqual(readUsers(), fixtureUsers);
    });

    it('makes the first account an admin and every later one a regular user', async () => {
        writeUsers([]);

        const first = await call('POST', '/api/auth/signup', undefined, { username: 'first', password: PASSWORD });
        assert.equal(first.status, 201);
        assert.deepEqual(first.body, { message: 'User created successfully', username: 'first' });

        const second = await call('POST', '/api/auth/signup', undefined, { username: 'second', password: PASSWORD });
        assert.equal(second.status, 201);

        assert.deepEqual(readUsers().map(user => [user.username, user.role]), [['first', 'admin'], ['second', 'user']]);
    });

    it('stores a bcrypt hash of the password, never the password itself', async () => {
        await call('POST', '/api/auth/signup', undefined, { username: 'hashed', password: PASSWORD });

        const { passwordHash } = readUsers().find(user => user.username === 'hashed')!;
        assert.match(passwordHash, /^\$2[aby]\$/);
        assert.equal(bcrypt.compareSync(PASSWORD, passwordHash), true);
        assert.equal(fs.readFileSync(process.env.USERS_FILE!, 'utf-8').includes(PASSWORD), false);
    });

    it('does not log the new account in', async () => {
        const reply = await call('POST', '/api/auth/signup', undefined, { username: 'fresh', password: PASSWORD });

        assert.deepEqual(reply.headers.getSetCookie(), []);
        assert.equal(readUsers().find(user => user.username === 'fresh')!.sessions, undefined);
    });
});

describe('logging in', () => {
    it('requires a username and a password', async () => {
        for (const body of [{}, { username: 'owner' }, { password: PASSWORD }]) {
            const reply = await call('POST', '/api/auth/login', undefined, body);
            assert.equal(reply.status, 400, JSON.stringify(body));
            assert.deepEqual(reply.body, { message: 'Username and password are required' });
        }
    });

    it('answers an unknown account and a wrong password alike', async () => {
        const unknown = await login('nobody');
        const wrong = await login('owner', 'guess');

        assert.equal(unknown.status, 401);
        assert.deepEqual(unknown.body, { message: 'Invalid credentials' });
        assert.equal(wrong.status, 401);
        assert.deepEqual(wrong.body, unknown.body);
        assert.deepEqual(unknown.headers.getSetCookie(), []);
    });

    it('names the account and sets a one-day access cookie and a seven-day refresh cookie', async () => {
        const reply = await login('owner');

        assert.equal(reply.status, 200);
        assert.deepEqual(reply.body, { message: 'Login successful', username: 'owner', isAdmin: true });

        const access = cookieSet(reply, 'access_token');
        const refresh = cookieSet(reply, 'refresh_token');
        assert.equal(cookiesSet(reply).length, 2);
        assert.equal(access.attributes['max-age'], String(DAY_SECONDS));
        assert.equal(refresh.attributes['max-age'], String(7 * DAY_SECONDS));
        for (const cookie of [access, refresh]) {
            assert.match(cookie.value, /^[\w-]+\.[\w-]+\.[\w-]+$/, `${cookie.name} is a JWT`);
            assert.equal(cookie.attributes.httponly, '');
            assert.equal(cookie.attributes.samesite, 'Lax');
            assert.equal(cookie.attributes.path, '/');
            assert.equal('secure' in cookie.attributes, false);
        }
        assert.notEqual(access.value, refresh.value);
    });
});

describe('refreshing a session', () => {
    const refreshWith = (token: string): Promise<Reply> => call('POST', '/api/auth/refresh', `refresh_token=${token}`);

    it('has nothing to do without a refresh cookie', async () => {
        const reply = await call('POST', '/api/auth/refresh');

        assert.equal(reply.status, 204);
        assert.equal(reply.body, '');
        assert.deepEqual(reply.headers.getSetCookie(), []);
    });

    it('says why a token is refused and tells the browser to drop both cookies', async () => {
        const claims = { username: 'owner', sid: 'never-opened' };
        const refused: Array<[string, string]> = [
            ['not-a-token', 'Invalid refresh token'],
            [jwt.sign(claims, 'wrong-key'), 'Invalid refresh token'],
            [jwt.sign(claims, REFRESH_TOKEN_KEY, { expiresIn: -10 }), 'Refresh token expired'],
            [jwt.sign(claims, REFRESH_TOKEN_KEY), 'Refresh token not found']
        ];

        for (const [token, message] of refused) {
            const reply = await refreshWith(token);
            assert.equal(reply.status, 401, message);
            assert.deepEqual(reply.body, { message });
            for (const name of ['access_token', 'refresh_token']) {
                const cleared = cookieSet(reply, name);
                assert.equal(cleared.value, '');
                assert.equal(cleared.attributes.expires, 'Thu, 01 Jan 1970 00:00:00 GMT');
            }
        }
    });
});

describe('logging out', () => {
    it('answers without a session cookie and leaves the cookies alone', async () => {
        const reply = await call('POST', '/api/auth/logout');

        assert.equal(reply.status, 200);
        assert.deepEqual(reply.body, { message: 'No session to logout' });
        assert.deepEqual(reply.headers.getSetCookie(), []);
    });

    it('expires both cookies the way they were set', async () => {
        const reply = await call('POST', '/api/auth/logout', sessionCookies(await login('owner')));

        assert.equal(reply.status, 200);
        assert.deepEqual(reply.body, { message: 'Logged out successfully' });
        for (const name of ['access_token', 'refresh_token']) {
            const cleared = cookiesSet(reply).filter(cookie => cookie.name === name);
            assert.ok(cleared.length > 0, `${name} is cleared`);
            for (const cookie of cleared) {
                assert.equal(cookie.value, '');
                assert.equal(cookie.attributes.path, '/');
                assert.equal(cookie.attributes.expires, 'Thu, 01 Jan 1970 00:00:00 GMT');
            }
            assert.ok(cleared.some(cookie => cookie.attributes.httponly === '' && cookie.attributes.samesite === 'Lax'));
        }
    });
});

describe('checking whether accounts exist', () => {
    afterEach(() => writeUsers(fixtureUsers));

    it('is public and answers for an empty users file too', async () => {
        const withAccounts = await call('GET', '/api/auth/check-users');
        assert.equal(withAccounts.status, 200);
        assert.deepEqual(withAccounts.body, { hasUsers: true });

        writeUsers([]);
        assert.deepEqual((await call('GET', '/api/auth/check-users')).body, { hasUsers: false });
    });
});

describe('checking for an admin', () => {
    it('needs a valid login', async () => {
        const guest = await call('GET', '/api/auth/check-admin');
        assert.equal(guest.status, 401);
        assert.deepEqual(guest.body, { message: 'Authentication required' });

        const forged = await call('GET', '/api/auth/check-admin', 'access_token=not-a-token');
        assert.equal(forged.status, 401);
        assert.deepEqual(forged.body, { message: 'Invalid or expired token' });
    });

    it('tells admins and regular users apart', async () => {
        const admin = await call('GET', '/api/auth/check-admin', ADMIN);
        const user = await call('GET', '/api/auth/check-admin', USER);

        assert.equal(admin.status, 200);
        assert.deepEqual(admin.body, { isAdmin: true });
        assert.equal(user.status, 200);
        assert.deepEqual(user.body, { isAdmin: false });
    });
});
