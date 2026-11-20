import crypto from 'crypto';

import { SECRET } from './secret';

const PREFIX = 'ENC:';
const GCM_IV_LENGTH = 12;
// Derived once: scrypt is slow on purpose, and the key never changes while the server runs
const KEY = crypto.scryptSync(SECRET, 'salt', 32);

/**
 * Encrypts a secret with AES-256-GCM.
 * @returns `ENC:<iv>:<tag>:<data>`, each part base64. The tag lets `decrypt` tell a
 * tampered value, or one encrypted under another SECRET, apart from a good one.
 */
export function encrypt(text: string): string {
    if (!text) return '';

    const iv = crypto.randomBytes(GCM_IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
    const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);

    return `${PREFIX}${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${data.toString('base64')}`;
}

/**
 * Decrypts a value produced by `encrypt`. Values saved by versions before 1.4
 * (`ENC:<iv>:<data>`, AES-256-CBC) still decrypt.
 * @returns the plaintext; the input unchanged when it was never encrypted; '' when
 * the value is malformed, tampered with, or was encrypted under another SECRET
 */
export function decrypt(encryptedText: string): string {
    if (!encryptedText || !encryptedText.startsWith(PREFIX)) {
        return encryptedText;
    }

    try {
        const parts = encryptedText.split(':');

        if (parts.length === 4) {
            const [, iv, tag, data] = parts;
            const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(iv, 'base64'));
            decipher.setAuthTag(Buffer.from(tag, 'base64'));
            return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
        }

        if (parts.length === 3) {
            const [, iv, data] = parts;
            const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, Buffer.from(iv, 'base64'));
            return decipher.update(data, 'base64', 'utf8') + decipher.final('utf8');
        }

        console.warn('Invalid encrypted format - missing parts');
        return '';
    } catch (error) {
        console.error('Decryption error:', (error as Error).message);
        console.warn('Decryption failed - possibly encrypted with a different key');
        return '';
    }
}

/**
 * Checks if a string is already encrypted
 * @param text The text to check
 * @returns True if the text is encrypted
 */
export function isEncrypted(text: string): boolean {
    return text?.startsWith(PREFIX) || false;
}
