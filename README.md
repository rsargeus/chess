# Chess

A browser-based chess application with a REST backend, persistent game history, Auth0 authentication, and Stockfish AI opponent.

## Features

- Play chess against a friend (two players) or against the computer
- 10 difficulty levels (Beginner → Grandmaster) powered by Stockfish
- Login with Google or email/password via Auth0
- All games and moves saved to MongoDB
- Chess.com-style board with SVG pieces and coordinate labels
- Game lobby with history and active-games filter

## Tech Stack

**Backend**
- Node.js + Express + TypeScript
- chess.js for move validation
- Stockfish (ASM.js build) for AI moves
- Mongoose + MongoDB Atlas
- Auth0 JWT authentication (`express-oauth2-jwt-bearer`)

**Frontend**
- Plain TypeScript bundled with esbuild
- `@auth0/auth0-spa-js` for authentication
- SVG chess pieces (cburnett style)

## Prerequisites

- Node.js 18+
- A [MongoDB Atlas](https://www.mongodb.com/atlas) account (free tier works)
- An [Auth0](https://auth0.com) account (free tier works)

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/rsargeus/chess.git
cd chess
```

### 2. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. Configure Auth0

1. Create a **Single Page Application** in Auth0
   - Allowed Callback URLs: `http://localhost:5173`
   - Allowed Logout URLs: `http://localhost:5173`
   - Allowed Web Origins: `http://localhost:5173`
2. Create an **API** with identifier `https://chess-api`
3. Enable **Google** and **Username-Password-Authentication** connections

### 4. Environment variables

**`backend/.env`**
```
MONGODB_URI=your_mongodb_connection_string
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://chess-api
```

**`frontend/.env`**
```
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your_auth0_client_id
AUTH0_AUDIENCE=https://chess-api
```

### 5. Run

In one terminal:
```bash
cd backend && npm run dev
```

In another terminal:
```bash
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173).
