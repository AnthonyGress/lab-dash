// Import version from the root package.json
// This will be bundled at build time
import { version } from '../../package.json';

// Export the version for use in the app
export const APP_VERSION = version;
