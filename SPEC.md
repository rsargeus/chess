# Chess Web App — Technical Spec

## Overview

A browser-based chess game with a REST API backend, Auth0 authentication, Stockfish AI opponent, real-time multiplayer via WebSockets, Stripe payments for premium membership, and full game/move persistence in MongoDB Atlas. The frontend is plain TypeScript with no framework; the backend is Express + TypeScript.

---

## Stack

### Backend
- **Runtime:** Node.js
- **Framework:** Express
- **Language:** TypeScript
- **Chess logic:** `chess.js` (move validation, check/checkmate detection, FEN)
- **Chess engine:** Stockfish via `stockfish` npm package (ASM.js build, runs as a child process)
- **Database:** MongoDB Atlas via `mongoose`
- **Auth:** `express-oauth2-jwt-bearer` (validates Auth0 JWTs), `jose` (JWT verification for WebSocket connections)
- **Payments:** Stripe Checkout + webhooks
- **Real-time:** `ws` WebSocket server
- **API docs:** OpenAPI 3.0 spec (`backend/src/openapi.ts`) served as Swagger UI at `/api-docs`

### Frontend
- **Plain HTML + CSS + TypeScript** (no framework)
- **Bundler:** esbuild
- **Auth:** `@auth0/auth0-spa-js`
- **Chess board:** hand-rolled SVG board with cburnett-style pieces
- **Communication:** `fetch` against the REST API + native `WebSocket` for real-time events

---

## Project Structure

```
chess/
├── backend/
│   ├── src/
│   │   ├── index.ts                  # Entry point — starts server, attaches WebSocket
│   │   ├── app.ts                    # Express app (importable in tests)
│   │   ├── db.ts                     # Mongoose connection
│   │   ├── wsServer.ts               # WebSocket server (rooms per gameId, JWT auth)
│   │   ├── gameStore.ts              # DB-backed game state logic
│   │   ├── stockfish.ts              # Stockfish child process wrapper
│   │   ├── auth0Management.ts        # Auth0 Management API (roles, premium, cache)
│   │   ├── openapi.ts                # OpenAPI 3.0 spec (served at /api-docs)
│   │   ├── middleware/
│   │   │   └── auth.ts               # JWT validation middleware
│   │   ├── models/
│   │   │   ├── Game.ts               # Game mongoose model/schema
│   │   │   └── Move.ts               # Move mongoose model/schema
│   │   ├── routes/
│   │   │   ├── game.ts               # /games routes
│   │   │   ├── me.ts                 # GET /me (authoritative premium check)
│   │   │   ├── checkout.ts           # POST /checkout (Stripe)
│   │   │   └── webhook.ts            # POST /webhooks/stripe
│   │   └── __tests__/
│   │       ├── setup.ts              # MongoDB memory server setup
│   │       ├── gameStore.test.ts     # Unit tests for game logic
│   │       └── routes/
│   │           └── game.test.ts      # Integration tests for HTTP endpoints
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── scripts/
│   │   ├── build.js                  # esbuild production build
│   │   └── dev.js                    # esbuild watch + dev server + proxy
│   ├── src/
│   │   ├── index.html                # App shell + all CSS
│   │   ├── main.ts                   # App entry point, auth boot, UI logic
│   │   ├── board.ts                  # Board rendering + click handling (supports flip)
│   │   ├── api.ts                    # REST client (attaches JWT to every request)
│   │   ├── auth.ts                   # Auth0 SPA client wrapper
│   │   ├── ws-client.ts              # WebSocket client (auth, reconnect)
│   │   ├── sound.ts                  # Move/capture/check/game-over sounds
│   │   ├── chess-hero.png            # Login page background image
│   │   ├── chess-welcome.png         # Lobby welcome image
│   │   └── __tests__/
│   │       └── api.test.ts           # Unit tests for REST client
│   ├── package.json
│   └── tsconfig.json
├── .gitignore
├── CLAUDE.md
├── README.md
└── SPEC.md
```

---

## Authentication

Auth0 is used for authentication with two connection types:
- **Google** (social login)
- **Username-Password-Authentication** (email + password)

### Flow
1. App loads → `initAuth()` initialises the Auth0 SPA client with `useRefreshTokens: true` + `cacheLocation: 'localstorage'` (required for Safari ITP compatibility)
2. If not authenticated → show login screen
3. Login redirects to Auth0 Universal Login, returns with a JWT
4. JWT is stored by the Auth0 SDK and attached to every API request as `Authorization: Bearer <token>`
5. Backend validates the JWT using `express-oauth2-jwt-bearer`; `req.auth.payload.sub` is the user ID

### User isolation
Each game stores the creator's `userId`. Multiplayer games additionally store `whiteUserId` and `blackUserId`. All queries check that the requesting user matches at least one of these fields.

---

## Game Modes

### `pvp` — Two Players (local)
Pass-and-play. Both sides are controlled by humans sharing the same browser.

### `vs_computer` — Player vs Computer *(Premium)*
The human plays **White**. After each valid player move, the backend queries Stockfish for the computer's reply, applies it, and returns both moves in the response. Requires a Premium membership.

#### Computer AI — Stockfish

Stockfish runs as a persistent **child process** managed by `backend/src/stockfish.ts`, communicating over UCI (stdin/stdout).

**Flow for each computer move:**
1. Send `position fen <fen>` to Stockfish
2. Send `go movetime <ms>` (time varies by level)
3. Wait for `bestmove <move>` in stdout
4. Apply the move via `chess.js` and persist to the database
5. Fallback to a random legal move if Stockfish throws

#### Difficulty Levels

| Level | Label | ELO | Move time |
|-------|-------|-----|-----------|
| 1 | Beginner | 800 | 200ms |
| 2 | Novice | 1000 | 200ms |
| 3 | Casual | 1200 | 300ms |
| 4 | Intermediate | 1400 | 300ms |
| 5 | Club Player | 1600 | 500ms |
| 6 | Advanced | 1800 | 500ms |
| 7 | Expert | 2000 | 1000ms |
| 8 | Master | 2200 | 1000ms |
| 9 | Int. Master | 2600 | 1500ms |
| 10 | Grandmaster | — | 3000ms |

Levels 1–9 use `UCI_LimitStrength` + `UCI_Elo`. Level 10 disables strength limiting (full Stockfish strength).

### `multiplayer` — Online (free)
Two registered users play against each other remotely with no time limit between moves (correspondence chess style with live WebSocket updates).

**Flow:**
1. Player A creates a multiplayer game → receives an `inviteCode`
2. Frontend shows an invite link: `https://<app>?join=<inviteCode>`
3. Player B opens the link → joins via `POST /games/join/:inviteCode` → assigned Black
4. Both players connect to the WebSocket server for their game room
5. After each move the backend broadcasts a `{ type: "move", gameId }` event to all connected clients
6. Receiving client fetches fresh game state via `GET /games/:gameId`
7. Board auto-flips for the Black player (own pieces always at bottom)
8. If a player is offline, they pick up the latest state when they next open the game

---

## Premium Membership

Computer mode (vs_computer) requires a one-time Premium payment of 20 kr via Stripe.

### Flow
1. User attempts to start a vs_computer game without Premium
2. Payment modal shown → user clicks Pay → `POST /checkout` creates a Stripe Checkout session
3. User completes payment on Stripe's hosted page
4. Stripe sends `checkout.session.completed` webhook to `POST /webhooks/stripe`
5. Webhook calls Auth0 Management API to assign the Premium role to the user
6. Frontend polls `GET /me` every 2s (up to 10 attempts) after `?payment=success` redirect to detect the new role

### Authoritative premium check — `GET /me`
Rather than trusting JWT claims (which may be stale), all premium checks go through `GET /me`. This endpoint calls the Auth0 Management API directly to read the user's current roles. Results are cached with a 30s TTL per user; the cache is invalidated immediately when the webhook assigns Premium.

---

## Database Schema (MongoDB / Mongoose)

Two collections: `games` and `moves`. There is no join — moves are fetched separately by `gameId` and merged in the application layer.

### `games` collection
```ts
{
  _id: ObjectId,
  userId: string,               // Auth0 sub of creator
  whiteUserId: string | null,   // multiplayer: white player's Auth0 sub
  blackUserId: string | null,   // multiplayer: black player's Auth0 sub (null until joined)
  inviteCode: string | null,    // multiplayer: random hex join code
  fen: string,                  // current board position (FEN)
  status: string,               // "active" | "check" | "checkmate" | "stalemate" | "draw" | "resigned"
  mode: string,                 // "pvp" | "vs_computer" | "multiplayer"
  computerLevel: number | null, // 1–10, null when mode is not "vs_computer"
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `userId` — used by `GET /games` to list a user's own games
- `{ whiteUserId, blackUserId }` — used in multiplayer queries to find games where the user is either player
- `inviteCode` (sparse) — used by `POST /games/join/:inviteCode` lookup

**Access patterns:**
- List all games for a user: `{ $or: [{ userId }, { whiteUserId }, { blackUserId }] }`, sorted by `createdAt` descending
- Join by invite: `{ inviteCode }`, atomically sets `blackUserId` if null

### `moves` collection
```ts
{
  _id: ObjectId,
  gameId: ObjectId,   // ref → games
  moveNumber: number, // half-move (ply) count, starts at 1
  from: string,       // e.g. "e2"
  to: string,         // e.g. "e4"
  san: string,        // standard algebraic notation
  fenAfter: string,   // board position after this move
  playedAt: Date
}
```

**Indexes:**
- `{ gameId, moveNumber }` — used to fetch the full move history for a game in order

**Access patterns:**
- Full history: `{ gameId }` sorted by `moveNumber` ascending — returned as part of `GET /games/:gameId`
- Move count: derived from `moveNumber` of the last document (used in game list summaries)

### Relationships

```
games (1) ──< moves (N)
  _id       gameId
```

The `moves` collection is append-only. The `games` document is updated in place after each move (new `fen`, new `status`, new `updatedAt`). There is no embedded move array in the game document — moves are always stored separately to keep the game document small and to avoid MongoDB's 16 MB document limit for long games.

---

## API Documentation

The backend serves an interactive Swagger UI at **`http://localhost:3000/api-docs`**.

The OpenAPI 3.0 spec is defined in `backend/src/openapi.ts`.

---

## REST API

All routes except `/health` require a valid Auth0 JWT in the `Authorization: Bearer` header.

### `GET /health`
Health check. No authentication required. Returns `{ "ok": true }` when the server is ready.

Used by the frontend to detect Render cold starts: if the backend does not respond within 3 seconds, a "Waking up server…" banner is shown with a progress indicator. After 60 seconds without a response, the banner changes to "Server unavailable. Try refreshing."

---

### `GET /me`
Returns the authenticated user's current premium status, sourced directly from Auth0 (not JWT claims).

**Response:** `{ "premium": true }`

---

### `POST /games`
Create a new game.

**Request:** `{ "mode": "vs_computer", "computerLevel": 5 }`
Modes: `"pvp"` | `"vs_computer"` | `"multiplayer"`

**Response `201`:** Full `GameState` object including `inviteCode` (multiplayer only) and `playerColor`.

---

### `POST /games/join/:inviteCode`
Join an existing multiplayer game as Black. Atomically claims the `blackUserId` slot.

**Response:** `GameState` with `playerColor: "b"`

---

### `GET /games`
List games where the user is creator, White, or Black. Most recent first.

---

### `GET /games/:gameId`
Get current game state plus full move history.

---

### `POST /games/:gameId/moves`
Submit a player move. In multiplayer, validates that it is the requesting user's turn.

**Request:** `{ "from": "e2", "to": "e4" }`

**Response:** Updated FEN, status, player's move, and (if vs_computer) the computer's reply.

---

### `DELETE /games/:gameId`
Resign the game. Sets `status` to `"resigned"`.

---

### `POST /checkout`
Create a Stripe Checkout session for Premium membership.

**Response:** `{ "url": "https://checkout.stripe.com/..." }`

---

## WebSocket

The backend exposes a WebSocket server on the same port as HTTP.

### Connection & Auth
1. Client opens `ws(s)://<backend>`
2. Client immediately sends: `{ "type": "auth", "token": "<JWT>", "gameId": "<id>" }`
3. Server verifies the JWT via Auth0 JWKS and checks `canAccess(game, userId)`
4. On success: socket is added to the game room. On failure: connection closed with 1008.
5. Unauthenticated connections that don't send the auth message within 5s are dropped.

### Events (server → client)
| Type | When |
|------|------|
| `move` | A move was applied |
| `opponent_joined` | Player B joined the game |
| `resigned` | A player resigned |

All events carry `{ "type": "...", "gameId": "..." }`. The client reacts by calling `GET /games/:gameId` to fetch the authoritative state.

### Reconnect
The frontend WebSocket client reconnects automatically after 3s on disconnect. State is always recoverable from REST.

---

## Frontend Behaviour

1. On load → check Auth0 session
   - Not authenticated → show login screen (hero image background, Google + email buttons)
   - `?join=<code>` in URL → save code, proceed to login, join game after auth
   - Authenticated → show app → probe backend (see below)
2. **Backend wake-up probe**: on app load, `GET /health` is called immediately
   - Response within 3 s → no banner shown (server already warm)
   - No response after 3 s → "Waking up server… First visit may take ~30 seconds" banner shown below header with a progress indicator; New Game is disabled
   - Response arrives → banner disappears, New Game re-enabled, game list loads
   - No response after 60 s → banner changes to "Server unavailable. Try refreshing."
3. **Lobby**: welcome image until a game starts; sidebar lists the user's games (shown as skeleton placeholders while probing)
3. **New Game** → mode modal (Two Players / vs Computer / Online)
   - vs Computer → premium check via `/me` → payment modal if needed → level slider
   - Online → create game → show invite link modal with copy button
4. **Joining**: `?join=<code>` in URL → automatically join game after login
5. **Board**: click piece to highlight legal moves; click destination to submit
   - Multiplayer: board is non-interactive when it's the opponent's turn
   - Board auto-flips for Black players
6. **WebSocket**: connects when a game loads; live updates opponent's moves
7. **Move history**: scrollable list; ← → buttons to navigate past positions
8. **Captured pieces**: shown below board with material score
9. After each move the board re-renders from FEN; move list updates
10. Game over → overlay → "Quit" → lobby
11. Promotion always auto-promotes to queen

---

## Testing

### Backend — Vitest + Supertest + mongodb-memory-server

| Layer | File | What it tests |
|-------|------|---------------|
| Unit | `src/__tests__/gameStore.test.ts` | `createGame`, `listGames`, `getGame`, `applyMove`, `resignGame` |
| Integration | `src/__tests__/routes/game.test.ts` | All HTTP endpoints via Supertest, including premium gating |

**Mocks:**
- `jwtCheck` middleware replaced with no-op injecting `req.auth = { payload: { sub: 'test-user' } }`
- `getBestMove` (Stockfish) mocked to return `e7e5` instantly

```bash
cd backend && npm test               # run once
cd backend && npm run test:watch     # watch mode
cd backend && npm run test:coverage  # with coverage report
```

### Frontend — Vitest + jsdom

| File | What it tests |
|------|---------------|
| `src/__tests__/api.test.ts` | All API client functions: HTTP method, URL, headers, body, error handling |

```bash
cd frontend && npm test
```

---

## Deployment

### Frontend — Cloudflare Pages

- **URL:** https://chess-2h6.pages.dev
- **Build command:** `npm install && node scripts/build.js`
- **Output directory:** `dist/`
- **Root directory:** `frontend/`
- **Environment variables** (injected at bundle time):
  - `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_AUDIENCE`
  - `BACKEND_URL` → `https://chess-backend-in1l.onrender.com`
  - `WS_URL` is derived automatically: `BACKEND_URL` with `http` → `ws`

### Backend — Render (Web Service, Free tier)

- **URL:** https://chess-backend-in1l.onrender.com
- **Build command:** `npm install && npm run build`
- **Start command:** `npm start`
- **Region:** Frankfurt
- **Environment variables:**
  - `MONGODB_URI`, `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`
  - `AUTH0_CLIENT_ID`, `AUTH0_MANAGEMENT_CLIENT_ID`, `AUTH0_MANAGEMENT_CLIENT_SECRET`
  - `AUTH0_PREMIUM_ROLE_ID`
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`
  - `FRONTEND_URL` → `https://chess-2h6.pages.dev`
  - `BACKEND_URL` → `https://chess-backend-in1l.onrender.com`

> **Note:** Free tier spins down after 15 minutes of inactivity. First request after inactivity may take 30–60 seconds. The frontend handles this via the backend wake-up probe (see Frontend Behaviour). Upgrade to Starter ($7/month) for always-on availability.

### CORS
Restricted to `FRONTEND_URL` in production. Falls back to `*` if not set (local dev only).

### Stripe webhooks
Production webhook endpoint: `https://chess-backend-in1l.onrender.com/webhooks/stripe`
Listens for `checkout.session.completed`. Stripe CLI tunnel required for local development.

---

## Constraints

- Promotion always defaults to queen (no UI)
- No draw offers — draws detected automatically (stalemate, insufficient material, etc.)
- MongoDB hosted on Atlas
- Premium is a one-time payment (not a subscription)
