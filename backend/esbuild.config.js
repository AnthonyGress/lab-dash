const esbuild = require('esbuild');
const { nodeExternalsPlugin } = require('esbuild-node-externals');

const isProduction = process.env.NODE_ENV === 'production';

(async () => {
    const ctx = await esbuild.context({
        entryPoints: ['index.ts'],
        bundle: true,
        platform: 'node',
        target: 'node22',
        outfile: 'dist/index.js',
        tsconfig: 'tsconfig.json',
        sourcemap: !isProduction,
        minify: isProduction,
        external: ['express'],
        plugins: [nodeExternalsPlugin()],
    });

    if (!isProduction) {
        console.log('👀 Watching for file changes...');
        await ctx.watch();
    } else {
        console.log('🚀 Building for production...');
        await ctx.dispose();
    }
})();
