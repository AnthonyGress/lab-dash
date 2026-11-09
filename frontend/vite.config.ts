import react from '@vitejs/plugin-react-swc';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

// Get the directory name for ES modules
const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Read the root package.json version
const rootPackagePath = resolve(__dirname, '../package.json');
const rootPackageJson = JSON.parse(readFileSync(rootPackagePath, 'utf-8'));
const rootVersion = rootPackageJson.version;

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 2022,
        host: '0.0.0.0' // Allow access from network
    },
    define: {
        // Expose the root version to the frontend code
        'import.meta.env.APP_VERSION': JSON.stringify(rootVersion),
    },
    build: {
        rollupOptions: {
            output: {
                // Libraries change far less often than the app: in their own files,
                // a new release does not make browsers download them again
                manualChunks(id) {
                    if (!id.includes('/node_modules/')) return;

                    if (/\/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(id)) {
                        return 'react';
                    }
                    if (id.includes('/node_modules/@mui/') || id.includes('/node_modules/@emotion/')) {
                        return 'mui';
                    }
                    if (/\/node_modules\/(react-markdown|remark-|rehype-|unified|micromark|mdast-|hast-|vfile|unist-)/.test(id)) {
                        return 'markdown';
                    }
                    // Everything else follows the code that uses it, so libraries only
                    // needed by the forms are downloaded with the forms
                }
            }
        }
    }
});
