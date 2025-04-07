import react from '@vitejs/plugin-react-swc';
import fs from 'fs';
import { resolve } from 'path';
import { defineConfig } from 'vite';

// Read the version from the root package.json
const packageJson = JSON.parse(
    fs.readFileSync(resolve(__dirname, '../package.json'), 'utf-8')
);

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 2022
    },
    define: {
        // Inject the version as a global variable
        'import.meta.env.APP_VERSION': JSON.stringify(packageJson.version),
    },
    // build: {
    //     rollupOptions: {
    //         output: {
    //             manualChunks(id) {
    //                 if (id.includes('node_modules')) {
    //                     const modulePath = id.split('node_modules/')[1];
    //                     const topLevelFolder = modulePath.split('/')[0];
    //                     if (topLevelFolder !== '.pnpm') {
    //                         return topLevelFolder;
    //                     }
    //                     const scopedPackageName = modulePath.split('/')[1];
    //                     const chunkName = scopedPackageName.split('@')[scopedPackageName.startsWith('@') ? 1 : 0];
    //                     return chunkName;
    //                 }
    //             }
    //         }
    //     }
    // }
});
