const DEFAULT_SECRET = '@jZCgtn^qg8So*^^6A2M';
const PLACEHOLDER_SECRETS = new Set([DEFAULT_SECRET, 'YOUR_SECRET_KEY', 'changeme']);
const MIN_SECRET_LENGTH = 32;

// Single source for the value that signs sessions and encrypts stored credentials.
// The fallback is kept so existing installs keep starting and keep decrypting.
export const SECRET = process.env.SECRET || DEFAULT_SECRET;

export const isWeakSecret = (secret: string): boolean => (
    secret.length < MIN_SECRET_LENGTH || PLACEHOLDER_SECRETS.has(secret.trim())
);

/** Warns, never blocks: a weak secret lets anyone forge an admin session. */
export const warnIfWeakSecret = (): void => {
    if (!isWeakSecret(SECRET)) return;

    console.warn([
        '',
        '⚠️  SECURITY WARNING: SECRET is missing, shorter than 32 characters, or a placeholder.',
        '   Anyone who can reach this server can forge an admin login.',
        '   Set SECRET to a random value, for example: openssl rand -base64 32',
        '   Note: changing SECRET requires re-entering saved integration passwords and API keys.',
        ''
    ].join('\n'));
};
