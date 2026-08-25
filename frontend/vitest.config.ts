import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __BACKEND_URL__: '""',
    __AUTH0_DOMAIN__: '""',
    __AUTH0_CLIENT_ID__: '""',
    __AUTH0_AUDIENCE__: '""',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**', 'src/main.ts', 'src/sound.ts'],
    },
  },
});
