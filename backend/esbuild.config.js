const esbuild = require('esbuild');
const { copy } = require('esbuild-plugin-copy');
const { nodeExternalsPlugin } = require('esbuild-node-externals');

const isProduction = process.env.NODE_ENV === 'production';

esbuild.build({
    entryPoints: ['index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node22',
    outfile: 'dist/index.js',
    tsconfig: 'tsconfig.json',
    sourcemap: !isProduction,
    minify: isProduction,
    external: ['express'],
    plugins: [
        nodeExternalsPlugin(),
        copy({
            assets: [
                { from: ['./package.json'], to: ['./package.json'] },
                { from: ['./src/config/config.json'], to: ['./config/config.json'] },
            ],
        }),
    ],
}).then(() => {
    console.log('✅ Build complete.');
}).catch(() => {
    console.error('❌ Build failed.');
    process.exit(1);
});
