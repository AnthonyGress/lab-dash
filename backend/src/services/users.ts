import crypto from 'crypto';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import path from 'path';

import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from '../utils/secret';

const DEFAULT_USERS_FILE = path.join(__dirname, '../config/users.json');
const ACCESS_TOKEN_EXPIRY = '3d';
const SESSION_LIFETIME_SECONDS = 7 * 24 * 60 * 60;
// How long a session outlives its refresh, so other open tabs can pick up the new cookies
const ROTATION_GRACE_MS = 60 * 1000;

// Read on use so tests can point it at a throwaway file
const getUsersFile = (): string => process.env.USERS_FILE || DEFAULT_USERS_FILE;

type StoredSession = {
    /** SHA-256 of the session ID. The ID itself only exists inside the tokens. */
    id: string;
    expiresAt: number;
};

export interface User {
    username: string;
    passwordHash: string;
    role: 'admin' | 'user';
    sessions?: StoredSession[];
    /** Whole refresh tokens, as stored before sessions existed. Dropped at the next login. */
    refreshTokens?: string[];
}

export type SessionTokens = { accessToken: string; refreshToken: string };
export type SessionUser = { username: string; role: string; exp?: number };

type Claims = { username: string; sid: string; exp?: number };

export const readUsers = (): User[] => {
    try {
        const file = getUsersFile();

        // Create directory if it doesn't exist
        const dir = path.dirname(file);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Create file if it doesn't exist
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file, JSON.stringify([]));
            return [];
        }

        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error('Error reading users:', error);
        return [];
    }
};

export const writeUsers = (users: User[]): void => {
    try {
        const file = getUsersFile();
        const dir = path.dirname(file);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(file, JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('Error writing users:', error);
    }
};

const hashSessionId = (sessionId: string): string => crypto.createHash('sha256').update(sessionId).digest('hex');

const liveSessions = (user: User): StoredSession[] => (
    (user.sessions ?? []).filter(session => session.expiresAt > Date.now())
);

/** Throws what `jwt.verify` throws when the token is not ours or names no session. */
const verifyClaims = (token: string, key: Buffer, ignoreExpiration = false): Claims => {
    const payload = jwt.verify(token, key, { algorithms: ['HS256'], ignoreExpiration });

    if (typeof payload !== 'object' || typeof payload.username !== 'string' || typeof payload.sid !== 'string') {
        throw new jwt.JsonWebTokenError('Token names no session');
    }
    return payload as Claims;
};

/**
 * The account whose open session a token names. A valid signature is not enough:
 * whoever learns SECRET can sign anything, but cannot name a session, because
 * only the hash of its ID is stored.
 */
const findSessionOwner = (users: User[], claims: Claims): User | undefined => {
    const id = hashSessionId(claims.sid);

    return users.find(user => (
        user.username === claims.username && liveSessions(user).some(session => session.id === id)
    ));
};

const openSession = (users: User[], user: User, replacedSessionId?: string): SessionTokens => {
    const sessionId = crypto.randomBytes(32).toString('base64url');
    const replaced = replacedSessionId && hashSessionId(replacedSessionId);
    const now = Date.now();

    user.sessions = [
        ...liveSessions(user).map(session => (
            session.id === replaced
                ? { ...session, expiresAt: Math.min(session.expiresAt, now + ROTATION_GRACE_MS) }
                : session
        )),
        { id: hashSessionId(sessionId), expiresAt: now + SESSION_LIFETIME_SECONDS * 1000 }
    ];
    delete user.refreshTokens;
    writeUsers(users);

    // No role in here: it is read from the account on every request
    const claims = { username: user.username, sid: sessionId };
    return {
        accessToken: jwt.sign(claims, ACCESS_TOKEN_KEY, { expiresIn: ACCESS_TOKEN_EXPIRY }),
        refreshToken: jwt.sign(claims, REFRESH_TOKEN_KEY, { expiresIn: SESSION_LIFETIME_SECONDS })
    };
};

/** Logs an existing account in. Call it after the password has been checked. */
export const startSession = (username: string): SessionTokens | undefined => {
    const users = readUsers();
    const user = users.find(candidate => candidate.username === username);

    return user && openSession(users, user);
};

/** The account behind an access token, or undefined when the token or its session is not valid. */
export const verifyAccessToken = (token: string | undefined): SessionUser | undefined => {
    if (!token) return undefined;

    try {
        const claims = verifyClaims(token, ACCESS_TOKEN_KEY);
        const user = findSessionOwner(readUsers(), claims);

        return user && { username: user.username, role: user.role, exp: claims.exp };
    } catch {
        return undefined;
    }
};

/**
 * Trades a refresh token for a new pair. The session it came from ends a minute
 * later, so a copied refresh token is of no use once its owner has refreshed.
 */
export const rotateSession = (
    refreshToken: string
): { tokens: SessionTokens; isAdmin: boolean } | 'expired' | 'invalid' | 'unknown' => {
    let claims: Claims;
    try {
        claims = verifyClaims(refreshToken, REFRESH_TOKEN_KEY);
    } catch (error) {
        return error instanceof jwt.TokenExpiredError ? 'expired' : 'invalid';
    }

    const users = readUsers();
    const user = findSessionOwner(users, claims);
    if (!user) return 'unknown';

    return { tokens: openSession(users, user, claims.sid), isAdmin: user.role === 'admin' };
};

/** Ends the session a refresh token belongs to; its access token stops working too. */
export const revokeSession = (refreshToken: string): void => {
    let claims: Claims;
    try {
        // An expired token still names the session to close
        claims = verifyClaims(refreshToken, REFRESH_TOKEN_KEY, true);
    } catch {
        return;
    }

    const users = readUsers();
    const user = users.find(candidate => candidate.username === claims.username);
    if (!user?.sessions) return;

    const id = hashSessionId(claims.sid);
    user.sessions = liveSessions(user).filter(session => session.id !== id);
    writeUsers(users);
};
