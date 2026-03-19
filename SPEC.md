# Chess Web App — Technical Spec

## Overview

A browser-based chess game with a REST API backend, Auth0 authentication, Stockfish AI opponent, and full game/move persistence in MongoDB Atlas. The frontend is plain TypeScript with no framework; the backend is Express + TypeScript.

---

## Stack

### Backend
- **Runtime:** Node.js
- **Framework:** Express
- **Language:** TypeScript
- **Chess logic:** `chess.js` (move validation, check/checkmate detection, FEN)
- **Chess engine:** Stockfish via `stockfish` npm package (ASM.js build, runs as a child process)
- **Database:** MongoDB Atlas via `mongoose`
- **Auth:** `express-oauth2-jwt-bearer` (validates Auth0 JWTs on all `/games` routes)

### Frontend
- **Plain HTML + CSS + TypeScript** (no framework)
- **Bundler:** esbuild
- **Auth:** `@auth0/auth0-spa-js`
- **Chess board:** hand-rolled SVG board with cburnett-style pieces
- **Communication:** `fetch` against the REST API with `Authorization: Bearer <token>` headers

---

## Project Structure

```
chess/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express app entry point
│   │   ├── db.ts                 # Mongoose connection
│   │   ├── middleware/
│   │   │   └── auth.ts           # JWT validation middleware
│   │   ├── models/
│   │   │   ├── Game.ts           # Game mongoose model/schema
│   │   │   └── Move.ts           # Move mongoose model/schema
│   │   ├── routes/
│   │   │   └── game.ts           # All /games routes
│   │   ├── gameStore.ts          # DB-backed game state logic
│   │   └── stockfish.ts          # Stockfish child process wrapper
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── scripts/
│   │   ├── build.js              # esbuild production build
│   │   └── dev.js                # esbuild watch + dev server + /games proxy
│   ├── src/
│   │   ├── index.html            # App shell + all CSS
│   │   ├── main.ts               # App entry point, auth boot, UI logic
│   │   ├── board.ts              # Board rendering + click handling
│   │   ├── api.ts                # REST client (attaches JWT to every request)
│   │   ├── auth.ts               # Auth0 SPA client wrapper
│   │   ├── chess-hero.png        # Login page background image
│   │   └── chess-welcome.png     # Lobby welcome image
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
1. App loads → `initAuth()` initialises the Auth0 SPA client
2. If not authenticated → show login screen
3. Login redirects to Auth0 Universal Login, returns with a JWT
4. JWT is stored by the Auth0 SDK and attached to every API request as `Authorization: Bearer <token>`
5. Backend validates the JWT using `express-oauth2-jwt-bearer`; `req.auth.payload.sub` is the user ID

### User isolation
Each game is stored with a `userId` field (the Auth0 `sub` claim). All queries are scoped to the authenticated user — users can only see and interact with their own games.

---

## Game Modes

### `pvp` — Two Players
Pass-and-play. Both sides are controlled by humans sharing the same browser.

### `vs_computer` — Player vs Computer
The human plays **White**. After each valid player move, the backend queries Stockfish for the computer's reply, applies it, and returns both moves in the response.

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

---

## Database Schema (MongoDB / Mongoose)

### `games` collection
```ts
{
  _id: ObjectId,
  userId: string,               // Auth0 sub claim
  fen: string,                  // current board position (FEN)
  status: string,               // "active" | "check" | "checkmate" | "stalemate" | "draw" | "resigned"
  mode: string,                 // "pvp" | "vs_computer"
  computerLevel: number | null, // 1–10, null when mode is "pvp"
  createdAt: Date,
  updatedAt: Date
}
```

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

---

## REST API

All routes require a valid Auth0 JWT in the `Authorization: Bearer` header.

### `POST /games`
Create a new game.

**Request:**
```json
{ "mode": "vs_computer", "computerLevel": 5 }
```

**Response `201`:**
```json
{
  "gameId": "abc123",
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "turn": "w",
  "status": "active",
  "mode": "vs_computer",
  "computerLevel": 5
}
```

---

### `GET /games`
List the authenticated user's games, most recent first.

---

### `GET /games/:gameId`
Get current game state plus full move history. Returns 404 if the game belongs to another user.

---

### `POST /games/:gameId/moves`
Submit a player move.

**Request:** `{ "from": "e2", "to": "e4" }`

**Response:** Updated FEN, status, the player's move, and (if vs_computer) the computer's reply move.

---

### `DELETE /games/:gameId`
Resign the game. Sets `status` to `"resigned"`.

---

## Frontend Behaviour

1. On load → check Auth0 session
   - Not authenticated → show login screen (hero image background, Google + email buttons)
   - Authenticated → show app
2. **Lobby**: welcome image shown until a game starts; sidebar lists the user's games (filtered to active by default)
3. **New Game** button → mode selection modal → (if vs computer) level slider → start game
4. **Board**: click a piece to highlight legal moves; click a destination to submit the move
5. After each move the board re-renders from the returned FEN; move list updates
6. Game over → overlay with "Quit" button → returns to lobby
7. **Resign** button visible only during an active game; after resigning → "Quit" → lobby
8. **Lobby** button in header → return to welcome screen at any time
9. Promotion always auto-promotes to queen (no UI)

---

## Constraints

- Two players share one browser (pass-and-play) — no real-time multiplayer
- Promotion always defaults to queen
- No draw offers — draws detected automatically (stalemate, insufficient material)
- MongoDB hosted on Atlas; configure connection string in `backend/.env`
