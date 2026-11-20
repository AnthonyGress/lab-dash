import jwt from 'jsonwebtoken';

import { startSession } from '../../src/services/users';
import { ACCESS_TOKEN_KEY } from '../../src/utils/secret';

/**
 * An access token for a real session of one of the fixture accounts ('admin' or 'user').
 * With `options` the token is re-signed for that session, e.g. to make it expire early.
 */
export const tokenFor = (username: string, options?: jwt.SignOptions): string => {
    const tokens = startSession(username);
    if (!tokens) throw new Error(`No fixture account named ${username}`);
    if (!options) return tokens.accessToken;

    const { sid } = jwt.decode(tokens.accessToken) as { sid: string };
    return jwt.sign({ username, sid }, ACCESS_TOKEN_KEY, options);
};

export const cookieFor = (username: string, options?: jwt.SignOptions): string => (
    `access_token=${tokenFor(username, options)}`
);
