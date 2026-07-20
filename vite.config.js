import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';

// Inside DDEV, Vite runs in the web container while the browser is on the host,
// so it has to bind to all interfaces and advertise an HMR endpoint the browser
// can actually reach (the https ddev.site host, over wss). Outside DDEV these
// are omitted so `npm run dev` keeps Vite's normal localhost defaults.
const inDdev = !!process.env.IS_DDEV_PROJECT;
const ddevHost = `${process.env.DDEV_HOSTNAME ?? 'onesmalllife.ddev.site'}`;

export default defineConfig({
    ...(inDdev && {
        server: {
            host: '0.0.0.0',
            port: 5173,
            strictPort: true,
            origin: `https://${ddevHost}:5173`,
            cors: true,
            hmr: {
                host: ddevHost,
                protocol: 'wss',
                clientPort: 5173,
            },
        },
    }),
    plugins: [
        laravel({
            input: [
                'resources/css/app.css',
                'resources/js/app.js',
                'resources/game/bootstrap/main.ts',
            ],
            refresh: true,
        }),
    ],
    build: {
        rollupOptions: {
            output: {
                // Emit Phaser as its own cacheable vendor chunk so the game
                // code chunk stays small and the two download in parallel.
                manualChunks(id) {
                    if (id.includes('node_modules/phaser')) {
                        return 'phaser';
                    }
                },
            },
        },
    },
});
