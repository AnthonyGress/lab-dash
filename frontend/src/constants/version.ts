// Get version from Vite environment variable that's injected at build time
// This is a more reliable approach than direct importing package.json
export const APP_VERSION = import.meta.env.APP_VERSION || '1.0.2';
