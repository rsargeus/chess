# Chess Web App — Technical Spec

## Overview

A browser-based chess game with a REST API backend. The frontend handles rendering and user interaction; the backend enforces game rules and manages state. All games and moves are persisted in a database.

---

## Stack

### Backend
- **Runtime:** Node.js
- **Framework:** Express
- **Language:** TypeScript
- **Chess logic:** `chess.js` (move validation, check/checkmate detection, FEN/PGN)
- **Chess engine:** Stockfish (via `stockfish` npm package, runs as a child process on the backend)
- **Database:** MongoDB via `mongoose`
- **Local dev:** MongoDB running in Docker (`docker-compose.yml` provided)

### Frontend
- **Plain HTML + CSS + TypeScript** (no framework)
- **Bundler:** esbuild
- **Chess board rendering:** `chessboard.js` or hand-rolled SVG/CSS board
- **Communication:** `fetch` against the REST API

---

## Project Structure

```
chess/
├── backend/
│   ├── src/
│   │   ├── index.ts        # Express app entry point
│   │   ├── db.ts           # Mongoose connection
│   │   ├── models/
│   │   │   ├── Game.ts     # Game mongoose model/schema
│   │   │   └── Move.ts     # Move mongoose model/schema
│   │   ├── routes/
│   │   │   └── game.ts     # All /games routes
│   │   ├── gameStore.ts    # DB-backed game state logic
│   │   └── stockfish.ts    # Stockfish child process wrapper
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml      # MongoDB for local dev
├── frontend/
│   ├── src/
│   │   ├── index.html
│   │   ├── main.ts         # App entry point
│   │   ├── board.ts        # Board rendering
│   │   └── api.ts          # REST client
│   ├── package.json
│   └── tsconfig.json
└── SPEC.md
```

---

## Game Modes

### `pvp` — Two Players
Pass-and-play. Both sides are controlled by humans sharing the same browser. The backend applies moves and returns updated state; no automatic responses.

### `vs_computer` — Player vs Computer
The human always plays **White**. After each valid player move, the backend queries Stockfish for the computer's reply, applies it, then returns both moves in the response. The `POST /games/:gameId/moves` response includes an additional `computerMove` field.

#### Computer AI — Stockfish

Stockfish runs as a persistent **child process** on the backend, managed by `backend/src/stockfish.ts`. Communication uses the UCI (Universal Chess Interface) protocol over stdin/stdout.

**Flow for each computer move:**
1. Send `position fen <fen>` to Stockfish
2. Send a `go` command with the active search constraint (see parameters below)
3. Wait for `bestmove <move>` in stdout
4. Apply the move via `chess.js` and persist to the database

**Stockfish is installed** as the `stockfish` npm package (ships a pre-built binary), so no system installation is required.

#### Computer Difficulty — Levels

The player selects a **level from 1 to 10**, similar to chess.com. Each level maps to an ELO rating internally; the frontend only exposes the level number with a friendly label.

| Level | Label | ELO | Notes |
|-------|-------|-----|-------|
| 1 | Beginner | 800 | Random-ish play, many blunders |
| 2 | Novice | 1000 | |
| 3 | Casual | 1200 | Club beginner |
| 4 | Intermediate | 1400 | |
| 5 | Club Player | 1600 | |
| 6 | Advanced | 1800 | |
| 7 | Expert | 2000 | |
| 8 | Master | 2200 | |
| 9 | International Master | 2600 | |
| 10 | Grandmaster | 3190 | Near-maximum Stockfish strength |

Levels 1–9 use Stockfish's `UCI_LimitStrength` + `UCI_Elo` options. Level 10 disables the strength limit and lets Stockfish search at full depth.

The frontend shows the level picker as a visual slider or set of numbered buttons, with the label displayed alongside. The raw ELO is never shown to the user.

#### Computer Settings stored on the Game

The chosen level is stored on the game document so the same strength applies for every computer move throughout the game.

---

---

## Database Schema (MongoDB / Mongoose)

### `games` collection
```ts
{
  _id: ObjectId,
  fen: string,          // current board position (FEN)
  status: string,       // "active" | "check" | "checkmate" | "stalemate" | "draw" | "resigned"
  mode: string,         // "pvp" | "vs_computer"
  computerLevel: number | null,  // 1–10, only set when mode === "vs_computer"
  createdAt: Date,
  updatedAt: Date
}
```

### `moves` collection
```ts
{
  _id: ObjectId,
  gameId: ObjectId,     // ref → games
  moveNumber: number,   // half-move (ply) count, starts at 1
  from: string,         // e.g. "e2"
  to: string,           // e.g. "e4"
  san: string,          // standard algebraic notation, e.g. "e4"
  fenAfter: string,     // board position after this move
  playedAt: Date
}
```

Moves are stored in a separate collection (not embedded in the game document) so that individual moves can be queried, paginated, or replayed efficiently regardless of game length.

---

## REST API

### `POST /games`
Create a new game. Inserts a row into `games`.

**Request:**
```json
{ "mode": "vs_computer", "computerLevel": 5 }
```

| Field | Required | Description |
|-------|----------|-------------|
| `mode` | no | `"pvp"` (default) or `"vs_computer"` |
| `computerLevel` | no | Integer 1–10. Default: `5`. Ignored when mode is `"pvp"` |

**Response:**
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
List all games (most recent first).

**Response:**
```json
[
  { "gameId": "abc123", "status": "checkmate", "createdAt": 1710000000, "moveCount": 42 },
  { "gameId": "def456", "status": "active",    "createdAt": 1710001000, "moveCount": 5 }
]
```

---

### `GET /games/:gameId`
Get current game state plus full move history.

**Response:**
```json
{
  "gameId": "abc123",
  "fen": "...",
  "turn": "w",
  "status": "active",
  "moves": [
    { "moveNumber": 1, "from": "e2", "to": "e4", "san": "e4", "fenAfter": "...", "playedAt": 1710000001 },
    { "moveNumber": 2, "from": "e7", "to": "e5", "san": "e5", "fenAfter": "...", "playedAt": 1710000010 }
  ]
}
```

Status values: `active` | `check` | `checkmate` | `stalemate` | `draw` | `resigned`

---

### `POST /games/:gameId/moves`
Submit a move. Inserts a row into `moves` and updates `games`.

**Request:**
```json
{ "from": "e2", "to": "e4" }
```

**Response (success, pvp):**
```json
{
  "fen": "...",
  "turn": "b",
  "status": "active",
  "move": { "moveNumber": 1, "san": "e4", "fenAfter": "..." },
  "computerMove": null
}
```

**Response (success, vs_computer):**
```json
{
  "fen": "...",
  "turn": "w",
  "status": "active",
  "move": { "moveNumber": 1, "san": "e4", "fenAfter": "..." },
  "computerMove": { "san": "e5", "from": "e7", "to": "e5" }
}
```
`fen` reflects the position **after the computer has moved**. The board is always returned to the player's turn.

**Response (invalid move):**
```json
{ "error": "Invalid move" }
```
HTTP 400

---

### `DELETE /games/:gameId`
Resign a game. Updates `games.status` to `resigned`. Moves are retained.

---

## Frontend Behaviour

1. On load, show a list of existing games (from `GET /games`) plus a "New Game" button.
2. New Game → show mode selection modal:
   - **Two Players**: call `POST /games` with `mode: "pvp"`
   - **vs Computer**: show a level picker (1–10) with a label (e.g. "Club Player"), then call `POST /games` with `mode: "vs_computer"` and `computerLevel`
3. Render the board from the FEN string.
4. User clicks a piece — highlight legal squares.
5. User clicks a destination — call `POST /games/:gameId/moves`.
6. Re-render board from returned FEN; update move history list.
7. Display turn indicator and game status.
8. On checkmate/stalemate, show result overlay with a "New Game" button.
9. Clicking a past game from the list replays it (loads move history, board shows final position).

---

## Running Locally

```bash
# Start MongoDB
docker-compose up -d

# Backend (port 3000)
cd backend && npm install && npm run dev

# Frontend (port 5173 or similar)
cd frontend && npm install && npm run dev
```

The frontend dev server proxies `/games` requests to the backend to avoid CORS issues.

`MONGODB_URI` defaults to `mongodb://localhost:27017/chess` and can be overridden via environment variable.

---

## Constraints

- Two players share one browser (pass-and-play) — no multiplayer/sockets
- No user accounts
- No promotion UI (auto-promote to queen)
- No draw offers — only stalemate/insufficient material detected automatically
- MongoDB runs locally via Docker; data persists in a named volume
