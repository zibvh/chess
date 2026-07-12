# Two-Square Chess

Real-time two-player chess. A small Express server keeps game state in
MongoDB and pushes every move to connected players instantly over a
WebSocket — no waiting on a poll interval, moves land the moment they're
played. There's only one game — everyone who opens the site plays (or
watches) the same persistent board, no room codes to create or share.
Whoever opens the site first can claim White or Black; a third visitor
watches as a spectator until a seat opens up. Each player sees the board
from their own side — White's pieces at the bottom for White, Black's
pieces at the bottom for Black.

## Run locally

1. Have a MongoDB instance available (local `mongod`, or a free
   [MongoDB Atlas](https://www.mongodb.com/atlas) cluster).
2. Set the connection string:
   ```bash
   export MONGODB_URI="mongodb://127.0.0.1:27017"   # or your Atlas URI
   ```
3. Install and run:
   ```bash
   npm install
   npm start
   ```

Then open http://localhost:3000 — open it in two tabs (or two devices) to
play against yourself while testing: join White in one tab, Black in the
other.

## Deploy on Render

1. Push this folder to a GitHub repo.
2. Set up a MongoDB database — the easiest free option is
   [MongoDB Atlas](https://www.mongodb.com/atlas) (free M0 cluster). Grab
   its connection string and allow network access from anywhere (or from
   Render's IPs).
3. On [render.com](https://render.com), click **New → Web Service** and
   connect that repo.
4. Settings:
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment Variable:** `MONGODB_URI` = your Atlas connection string
5. Deploy. Render gives you a public URL — send that link to your friend
   and you're playing. No room code needed; the URL alone is enough.

### Why MongoDB instead of the JSON file

The old version stored state in a `data/db.json` file, which Render's free
tier wipes on every restart/redeploy. MongoDB (especially a free Atlas
cluster) is a real, persistent database, so the game survives server
restarts, redeploys, and scale-to-zero — and reads/writes are faster than
round-tripping through a file on disk.

## How it works

- `GET /api/game` — fetch the (single, fixed) game's current state;
  auto-creates a fresh game the first time it's requested
- `PUT /api/game` — update the game's state (used for claiming/leaving a
  seat and for every move); includes an optional `expectedLastUpdate` check
  so two simultaneous writes don't silently clobber each other. On success,
  the server pushes the new state to every connected client over a
  WebSocket, so opponents see moves the instant they're played.
- `POST /api/game/reset` — reset the board back to a fresh game (same
  fixed id, so there's still nothing new to share); also broadcast over
  the WebSocket.

The frontend (`public/index.html`) opens a WebSocket connection on load and
updates the board the moment a broadcast arrives, with automatic
reconnect if the connection drops. It also polls `GET /api/game` every
~4 seconds as a fallback safety net, in case a WebSocket message is ever
missed. Per-device data (sound settings, win/loss stats, and which color
you last played) is stored in the browser's `localStorage`, not on the
server — your browser is recognized by a random client id, so refreshing
keeps your seat.
