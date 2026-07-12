# Two-Square Chess

Real-time two-player chess. A small Express server keeps game state in a
`data/db.json` file and the browser polls it every ~1.2s, so no external
database or accounts are needed.

## Run locally

```bash
npm install
npm start
```

Then open http://localhost:3000 — open it in two tabs (or two devices) to
play against yourself while testing.

## Deploy on Render

1. Push this folder to a GitHub repo.
2. On [render.com](https://render.com), click **New → Web Service** and
   connect that repo.
3. Settings:
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Deploy. Render gives you a public URL — send that link (and a room code
   generated in-app) to your friend and you're playing.

### Important: the JSON file is not permanent storage

Render's free web service disk is **ephemeral** — `data/db.json` will be
wiped whenever the service redeploys, restarts, or spins down after
inactivity on the free tier. That means:

- Games in progress can be lost if the server restarts mid-game.
- This is fine for casual games with a friend, but don't rely on it for
  anything you need to keep long-term.

If you want state that survives restarts, options in rough order of effort:
- Render's **persistent disk** add-on (small paid add-on, mounts a real
  volume so `data/db.json` survives restarts/redeploys).
- Swap the JSON file for a real database — Render's free Postgres tier, or
  a service like Supabase.

## How it works

- `GET /api/rooms/:code` — fetch a room's current state
- `POST /api/rooms/:code` — create a room (fails if the code exists)
- `PUT /api/rooms/:code` — update a room's state (used for joining and for
  every move); includes an optional `expectedLastUpdate` check so two
  simultaneous writes don't silently clobber each other

The frontend (`public/index.html`) polls `GET` every ~1.2 seconds and
redraws the board when the timestamp changes. Per-device data (sound
settings, win/loss stats, which room you were last in) is stored in the
browser's `localStorage`, not on the server.
