import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Deterministic game-logic and TypeScript system tests live next to the
        // code they cover, under resources/game.
        include: ['resources/game/**/*.{test,spec}.ts'],
        environment: 'node',
    },
});
