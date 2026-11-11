import crypto from 'crypto';

const MIN_SECRET_LENGTH = 32;

// Shipped in older releases, the compose file and the Helm chart, so anyone can sign with them
const PUBLISHED_SECRETS = new Set(['@jZCgtn^qg8So*^^6A2M', 'YOUR_SECRET_KEY', 'changeme']);

/** Why a SECRET must not be used, or undefined when it may. */
export const secretProblem = (secret: string | undefined): string | undefined => {
    if (!secret?.trim()) return 'SECRET is not set.';
    if (PUBLISHED_SECRETS.has(secret.trim())) return 'SECRET is still a placeholder that anyone can look up.';
    return undefined;
};

// There is no built-in fallback: a value that ships with the app lets anyone forge an admin login
const loadSecret = (): string => {
    const secret = process.env.SECRET;
    const problem = secretProblem(secret);
    if (!problem) return secret as string;

    console.error([
        '',
        `❌ ${problem} Lab Dash does not start without a SECRET of its own.`,
        '   It signs logins and encrypts the saved passwords and API keys of your widgets.',
        '   Generate one:  openssl rand -base64 32',
        '   Docker:        set SECRET under "environment" in your compose file',
        '   Development:   put SECRET=<value> in backend/.env',
        '   If this install ran without a SECRET or with the placeholder until now, saved',
        '   widget passwords and API keys have to be entered again afterwards.',
        ''
    ].join('\n'));
    process.exit(1);
};

/** Encrypts stored credentials. Logins are signed with the keys derived from it below. */
export const SECRET = loadSecret();

const deriveKey = (purpose: string): Buffer => crypto.createHmac('sha256', SECRET).update(purpose).digest();

// One key per purpose, so a refresh token never verifies as an access token
export const ACCESS_TOKEN_KEY = deriveKey('lab-dash access token');
export const REFRESH_TOKEN_KEY = deriveKey('lab-dash refresh token');

export const isWeakSecret = (secret: string): boolean => secret.length < MIN_SECRET_LENGTH;

/** Warns, never blocks: installs with a short SECRET of their own keep starting. */
export const warnIfWeakSecret = (): void => {
    if (!isWeakSecret(SECRET)) return;

    console.warn([
        '',
        '⚠️  SECURITY WARNING: SECRET is shorter than 32 characters and may be guessable.',
        '   Set SECRET to a random value, for example: openssl rand -base64 32',
        '   Note: changing SECRET requires re-entering saved integration passwords and API keys.',
        ''
    ].join('\n'));
};
