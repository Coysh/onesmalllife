import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';

export default defineConfig({
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
