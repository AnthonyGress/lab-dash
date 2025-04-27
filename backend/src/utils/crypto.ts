import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.SECRET || '@jZCgtn^qg8So*^^6A2M';
const IV_LENGTH = 16; // For AES, this is always 16 bytes

/**
 * Encrypts sensitive data using AES-256-CBC
 * @param text The plaintext to encrypt
 * @returns Encrypted string in format 'iv:encryptedData' encoded in base64
 */
export function encrypt(text: string): string {
    if (!text) return '';

    // Create a random initialization vector
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create a cipher using the encryption key and IV
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32); // Generate a 32-byte key
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Return IV and encrypted data as a single base64 string
    return `ENC:${iv.toString('base64')}:${encrypted}`;
}

/**
 * Decrypts data that was encrypted with the encrypt function
 * @param encryptedText The encrypted text (format: 'iv:encryptedData' in base64)
 * @returns The decrypted plaintext, or empty string if decryption fails
 */
export function decrypt(encryptedText: string): string {
    if (!encryptedText || !encryptedText.startsWith('ENC:')) {
        return encryptedText;
    }

    try {
        // Split the encrypted text into IV and data components
        const parts = encryptedText.split(':');
        if (parts.length !== 3) {
            console.warn('Invalid encrypted format - missing parts');
            return ''; // Return empty string for invalid format
        }

        const iv = Buffer.from(parts[1], 'base64');
        const encryptedData = parts[2];

        // Create a decipher using the encryption key and IV
        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32); // Generate a 32-byte key
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

        // Decrypt the data
        let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
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
    return text?.startsWith('ENC:') || false;
}
