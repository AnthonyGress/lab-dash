// Get version from Vite's environment variables
// This was set in vite.config.ts to read from the root package.json
const appVersion = import.meta.env.APP_VERSION as string;

// Export the version for use in the app
export const APP_VERSION = appVersion;
