import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      STRIPE_SECRET_KEY: 'sk_test_dummy',
      STRIPE_WEBHOOK_SECRET: 'whsec_dummy',
      STRIPE_PRICE_ID: 'price_dummy',
      GROQ_API_KEY: 'dummy',
      FRONTEND_URL: 'http://localhost:5173',
      AUTH0_DOMAIN: 'test.auth0.com',
      AUTH0_AUDIENCE: 'https://chess-api',
    },
    setupFiles: ['./src/__tests__/setup.ts'],
    hookTimeout: 30000,
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**', 'src/index.ts', 'src/openapi.ts'],
    },
  },
});
