# E2E tests

Playwright suite driving the real app against the local dev servers (nothing
mocked). See `SPEC.md` § Testing → End-to-end for what each spec covers.

## Local

Both dev servers must be running first:

```bash
cd backend && npm run dev    # :3000
cd frontend && npm run dev   # :5173
```

Then, from this directory:

```bash
cp .env.example .env   # fill in two Auth0 test accounts
npm ci
npm test               # headless
npm run test:ui        # interactive
npm run test:headed    # headed browser
```

Running the full suite in one sequence needs `DISABLE_RATE_LIMITING=true` in
`backend/.env` — 39 tests hitting `/games` repeatedly exceeds the normal
300-requests/15-min budget well before finishing. Never set this on Render.

## CI (GitHub Actions)

`.github/workflows/ci.yml` runs this suite on every push/PR to `master`. It
needs these repo secrets configured (Settings → Secrets and variables →
Actions) before it'll pass — without them it fails with a self-explanatory
error (Mongo connection refused, Auth0 login failure, etc.), it doesn't skip
silently:

| Secret | Same value as |
|---|---|
| `MONGODB_URI` | `backend/.env` |
| `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `AUTH0_CLIENT_ID` | `backend/.env` |
| `AUTH0_MANAGEMENT_CLIENT_ID`, `AUTH0_MANAGEMENT_CLIENT_SECRET` | `backend/.env` |
| `AUTH0_PREMIUM_ROLE_ID` | `backend/.env` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` | `backend/.env` |
| `GROQ_API_KEY` | `backend/.env` |
| `PLAYWRIGHT_USER1_EMAIL`, `PLAYWRIGHT_USER1_PASSWORD` | `e2e/.env` |
| `PLAYWRIGHT_USER2_EMAIL`, `PLAYWRIGHT_USER2_PASSWORD` | `e2e/.env` |

`FRONTEND_URL` and `DISABLE_RATE_LIMITING` are hardcoded in the workflow, not
secrets — they're the same every run.
